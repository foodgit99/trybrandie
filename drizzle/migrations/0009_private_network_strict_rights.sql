ALTER TABLE public.private_network_campaigns ADD COLUMN IF NOT EXISTS content_category text;
ALTER TABLE public.private_network_creatives ADD COLUMN IF NOT EXISTS private_redistribution_evidence text;

CREATE OR REPLACE FUNCTION public.private_network_platform_family(_p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _p IN ('whatsapp_status','whatsapp_chat') THEN 'whatsapp' ELSE _p END
$$;

CREATE OR REPLACE FUNCTION public.private_network_licence_covers_platform(_lic text[], _p text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (SELECT 1 FROM unnest(COALESCE(_lic,'{}')) x
    WHERE lower(btrim(x)) IN (lower(_p), public.private_network_platform_family(_p), replace(lower(_p),'_',' ')))
$$;

CREATE OR REPLACE FUNCTION public.private_network_creative_eligibility(_creative uuid, _platform text DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; c record; lic record; job record; opp_stage text; r text[] := '{}'; bname text; p text; plats text[];
BEGIN
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF NOT FOUND THEN RETURN ARRAY['Creative not found.']; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id;
  plats := CASE WHEN _platform IS NOT NULL THEN ARRAY[_platform] ELSE COALESCE(c.target_platforms,'{}') END;
  IF cr.rights_expires_at IS NOT NULL AND cr.rights_expires_at <= now() THEN r := array_append(r, 'Distribution rights have expired.'); END IF;
  IF cr.rights_expires_at IS NOT NULL AND c.ends_at IS NOT NULL AND c.ends_at > cr.rights_expires_at THEN r := array_append(r, 'Campaign runs past the distribution rights expiry.'); END IF;
  IF cardinality(cr.rights_platforms) > 0 THEN
    FOREACH p IN ARRAY plats LOOP
      IF NOT (p = ANY(cr.rights_platforms)) THEN r := array_append(r, 'Rights do not cover ' || p || '.'); END IF;
    END LOOP;
  END IF;
  IF cr.media_source = 'creator_network' THEN
    SELECT * INTO lic FROM public.creator_network_licences WHERE id = cr.cn_licence_id;
    IF NOT FOUND THEN RETURN array_append(r, 'Creator licence not found.'); END IF;
    SELECT * INTO job FROM public.creator_network_production_jobs WHERE id = cr.cn_production_job_id;
    SELECT name INTO bname FROM public.brands WHERE id = c.brand_id;
    IF COALESCE(lic.revoked,false) OR lic.revoked_at IS NOT NULL THEN r := array_append(r, 'Creator licence revoked.'); END IF;
    -- dates: a licence runs from the start of starts_at to the END of expires_at (UTC), compared with now()
    IF lic.expires_at IS NOT NULL AND now() >= ((lic.expires_at + 1)::timestamp AT TIME ZONE 'UTC') THEN r := array_append(r, 'Creator licence expired.'); END IF;
    IF lic.starts_at IS NOT NULL AND now() < (lic.starts_at::timestamp AT TIME ZONE 'UTC') THEN r := array_append(r, 'Creator licence not started yet.'); END IF;
    IF lic.starts_at IS NOT NULL AND c.starts_at IS NOT NULL AND c.starts_at < (lic.starts_at::timestamp AT TIME ZONE 'UTC') THEN r := array_append(r, 'Campaign starts before the licence starts.'); END IF;
    IF lic.expires_at IS NOT NULL AND (c.ends_at IS NULL OR c.ends_at > ((lic.expires_at + 1)::timestamp AT TIME ZONE 'UTC')) THEN r := array_append(r, 'Campaign must end by the licence expiry.'); END IF;
    IF lic.licence_scope IS DISTINCT FROM 'Commercial' THEN r := array_append(r, 'Licence scope is not explicitly Commercial.'); END IF;
    IF lic.status IS NULL OR lic.status NOT IN ('Signed','Active') THEN r := array_append(r, 'Licence is not signed/active.'); END IF;
    IF NOT COALESCE(lic.likeness_permission,false) THEN r := array_append(r, 'Likeness permission missing.'); END IF;
    IF NOT COALESCE(lic.organic_social_permission,false) THEN r := array_append(r, 'Organic social permission missing.'); END IF;
    IF lic.brand_id IS NOT NULL AND lic.brand_id <> c.brand_id THEN r := array_append(r, 'Licence belongs to a different brand.'); END IF;
    IF bname IS NOT NULL AND lower(bname) = ANY(public.private_network_lower(lic.restricted_brands)) THEN r := array_append(r, 'Brand is restricted by the licence.'); END IF;
    IF cardinality(COALESCE(lic.restricted_categories,'{}')) > 0 THEN
      IF COALESCE(btrim(c.content_category),'') = '' THEN r := array_append(r, 'Licence restricts categories: campaign must state its category.');
      ELSIF lower(btrim(c.content_category)) = ANY(public.private_network_lower(lic.restricted_categories)) THEN r := array_append(r, 'Category ' || c.content_category || ' is restricted.'); END IF;
    END IF;
    IF cardinality(COALESCE(lic.platforms,'{}')) = 0 THEN r := array_append(r, 'Licence names no platforms: platform coverage must be explicit.');
    ELSIF cardinality(plats) = 0 THEN r := array_append(r, 'No platform requested.');
    ELSE
      FOREACH p IN ARRAY plats LOOP
        IF NOT public.private_network_licence_covers_platform(lic.platforms, p) THEN r := array_append(r, 'Licence does not cover ' || p || '.'); END IF;
      END LOOP;
    END IF;
    IF cardinality(COALESCE(lic.territories,'{}')) = 0 THEN r := array_append(r, 'Licence names no territories: territory coverage must be explicit.');
    ELSIF cardinality(COALESCE(c.target_geographies,'{}')) = 0 THEN r := array_append(r, 'Campaign must name its target territories for licensed content.');
    ELSIF NOT (public.private_network_lower(c.target_geographies) <@ public.private_network_lower(lic.territories)) THEN
      r := array_append(r, 'Campaign geography is outside the licence territories.'); END IF;
    IF COALESCE(lic.creator_approval_required,false) AND NOT cr.creator_approval_recorded THEN r := array_append(r, 'Creator approval required and not recorded.'); END IF;
    IF job.id IS NULL OR job.creator_id <> lic.creator_id THEN r := array_append(r, 'Production job does not match the licence.');
    ELSE
      IF lic.production_job_id IS NOT NULL AND lic.production_job_id <> job.id THEN r := array_append(r, 'Licence is for a different production job.'); END IF;
      IF job.clean_master_path IS NULL THEN r := array_append(r, 'No clean master: watermarked previews are not distributable.'); END IF;
      IF job.rights_mode IS DISTINCT FROM 'Commercial' THEN r := array_append(r, 'Production job was made under preview rights only.'); END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.job_id = job.id AND pr.stage = 'Human QA' AND pr.decision = 'Approve') THEN
        r := array_append(r, 'Human QA approval missing.'); END IF;
      SELECT o.stage INTO opp_stage FROM public.creator_network_opportunities o WHERE o.id = COALESCE(job.opportunity_id, lic.opportunity_id);
      IF opp_stage IS DISTINCT FROM 'Fulfilled' THEN r := array_append(r, 'Opportunity is not Fulfilled.'); END IF;
      IF cr.media_type = 'video' AND NOT COALESCE(lic.voice_permission,false) THEN r := array_append(r, 'Video asset needs voice permission.'); END IF;
      IF lower(COALESCE(job.rights_mode,'')) LIKE '%twin%' AND NOT COALESCE(lic.digital_twin_permission,false) THEN r := array_append(r, 'Digital-twin permission missing.'); END IF;
    END IF;
    IF NOT cr.private_redistribution_confirmed OR length(btrim(COALESCE(cr.private_redistribution_evidence,''))) < 8 THEN
      r := array_append(r, 'Explicit private third-party redistribution authorization (with agreement evidence) not recorded.'); END IF;
  ELSE
    IF NOT cr.rights_attested OR length(btrim(COALESCE(cr.rights_attestation,''))) < 3 THEN r := array_append(r, 'Rights attestation missing.'); END IF;
  END IF;
  RETURN r;
END $$;

DROP FUNCTION IF EXISTS public.private_network_review_creative(uuid, text, text, boolean);
CREATE OR REPLACE FUNCTION public.private_network_review_creative(_id uuid, _decision text, _reason text DEFAULT NULL, _confirm_private_rights boolean DEFAULT false, _evidence text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; reasons text[];
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'PN: Moderator role required.'; END IF;
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Creative not found.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  IF _decision = 'approve' THEN
    IF cr.status <> 'pending' THEN RAISE EXCEPTION 'PN: Only pending creatives can be approved.'; END IF;
    IF cr.media_source = 'creator_network' THEN
      IF NOT public.creator_network_has_access(auth.uid(), NULL) THEN RAISE EXCEPTION 'PN: Licensed creator masters need a reviewer with Creator Network access.'; END IF;
      UPDATE public.private_network_creatives SET private_redistribution_confirmed = COALESCE(_confirm_private_rights,false),
        private_redistribution_evidence = NULLIF(left(btrim(COALESCE(_evidence,'')),500),'') WHERE id = _id;
    END IF;
    reasons := public.private_network_creative_eligibility(_id, NULL);
    IF cardinality(reasons) > 0 THEN RAISE EXCEPTION 'PN: Not eligible: %', array_to_string(reasons, ' '); END IF;
    UPDATE public.private_network_creatives SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), review_reason=_reason WHERE id=_id;
  ELSIF _decision IN ('reject','revoke') THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    UPDATE public.private_network_creatives SET status = CASE WHEN _decision='reject' THEN 'rejected' ELSE 'revoked' END,
      reviewed_by=auth.uid(), reviewed_at=now(), review_reason=_reason WHERE id=_id;
  ELSE RAISE EXCEPTION 'PN: Unknown decision.'; END IF;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('creative', _id, 'creative_' || _decision, jsonb_build_object('reason', _reason, 'evidence', _evidence), cr.is_test);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.private_network_review_creative(uuid, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.private_network_review_creative(uuid, text, text, boolean, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.private_network_creative_eligibility(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_network_creative_eligibility(uuid, text) TO service_role;

-- publish must name a real platform (a NULL cast previously slipped through)
CREATE OR REPLACE FUNCTION public.private_network_publish_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.platform IS NULL THEN RAISE EXCEPTION 'PN: A platform is required.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pn_placement_platform_guard ON public.private_network_placements;
CREATE TRIGGER pn_placement_platform_guard BEFORE INSERT ON public.private_network_placements FOR EACH ROW EXECUTE FUNCTION public.private_network_publish_guard();