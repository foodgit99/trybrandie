CREATE TABLE IF NOT EXISTS public.private_network_integration_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  label text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_hint text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  is_test boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.private_network_integration_keys TO authenticated;
GRANT ALL ON public.private_network_integration_keys TO service_role;
ALTER TABLE public.private_network_integration_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn keys: operator read" ON public.private_network_integration_keys FOR SELECT TO authenticated
  USING (public.private_network_enabled() AND public.private_network_is_operator());

ALTER TABLE public.private_network_events
  ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS integration_key_id uuid REFERENCES public.private_network_integration_keys(id),
  ADD COLUMN IF NOT EXISTS reconciled_by uuid,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconcile_note text;
REVOKE INSERT, UPDATE, DELETE ON public.private_network_events FROM authenticated, anon, PUBLIC;
CREATE UNIQUE INDEX IF NOT EXISTS pn_events_server_external_uniq ON public.private_network_events (external_event_id) WHERE source = 'server';

CREATE OR REPLACE FUNCTION public.private_network_create_integration_key(_brand uuid, _label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text := 'pnk_' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''); nid uuid; t boolean;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'PN: Private Network admin required.'; END IF;
  IF COALESCE(btrim(_label),'') = '' THEN RAISE EXCEPTION 'PN: Label required.'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.brands WHERE id=_brand) INTO t;
  IF NOT t THEN RAISE EXCEPTION 'PN: Brand not found.'; END IF;
  INSERT INTO public.private_network_integration_keys (brand_id, label, key_hash, key_hint, created_by)
  VALUES (_brand, left(_label,100), encode(sha256(convert_to(k,'UTF8')),'hex'), right(k,4), auth.uid()) RETURNING id INTO nid;
  PERFORM public.private_network_log('integration_key', nid, 'created', jsonb_build_object('brand', _brand, 'label', _label), false);
  RETURN jsonb_build_object('id', nid, 'key', k);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_revoke_integration_key(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.private_network_has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'PN: Private Network admin required.'; END IF;
  UPDATE public.private_network_integration_keys SET revoked_at = now() WHERE id = _id AND revoked_at IS NULL;
  PERFORM public.private_network_log('integration_key', _id, 'revoked', '{}'::jsonb, false);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_creative_eligibility(_creative uuid, _platform text DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; c record; lic record; job record; opp_stage text; r text[] := '{}'; bname text; p text; plats text[];
BEGIN
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF NOT FOUND THEN RETURN ARRAY['Creative not found.']; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id;
  IF NOT FOUND THEN RETURN ARRAY['Campaign not found.']; END IF;
  IF cr.is_test IS DISTINCT FROM c.is_test THEN r := array_append(r, 'Test and live records cannot mix (creative vs campaign).'); END IF;
  plats := CASE WHEN _platform IS NOT NULL THEN ARRAY[_platform] ELSE COALESCE(c.target_platforms,'{}') END;
  IF cardinality(plats) = 0 THEN r := array_append(r, 'No platform requested: campaign must name its platforms.'); END IF;
  IF _platform IS NOT NULL AND NOT (_platform = ANY(COALESCE(c.target_platforms,'{}'))) THEN r := array_append(r, 'Platform ' || _platform || ' is not part of this campaign.'); END IF;
  IF cr.rights_expires_at IS NOT NULL AND cr.rights_expires_at <= now() THEN r := array_append(r, 'Distribution rights have expired.'); END IF;
  IF cr.rights_expires_at IS NOT NULL AND (c.ends_at IS NULL OR c.ends_at > cr.rights_expires_at) THEN r := array_append(r, 'Campaign must end by the distribution rights expiry.'); END IF;
  IF cardinality(COALESCE(cr.rights_platforms,'{}')) > 0 THEN
    FOREACH p IN ARRAY plats LOOP
      IF NOT (p = ANY(cr.rights_platforms)) THEN r := array_append(r, 'Rights do not cover ' || p || '.'); END IF;
    END LOOP;
  END IF;
  IF cr.media_source = 'creator_network' THEN
    SELECT * INTO lic FROM public.creator_network_licences WHERE id = cr.cn_licence_id;
    IF NOT FOUND THEN RETURN array_append(r, 'Creator licence not found.'); END IF;
    SELECT * INTO job FROM public.creator_network_production_jobs WHERE id = cr.cn_production_job_id;
    SELECT name INTO bname FROM public.brands WHERE id = c.brand_id;
    IF lic.is_test IS DISTINCT FROM c.is_test THEN r := array_append(r, 'Test and live records cannot mix (licence vs campaign).'); END IF;
    IF COALESCE(lic.revoked,false) OR lic.revoked_at IS NOT NULL THEN r := array_append(r, 'Creator licence revoked.'); END IF;
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
    ELSIF cardinality(plats) > 0 THEN
      FOREACH p IN ARRAY plats LOOP
        IF NOT public.private_network_licence_covers_platform(lic.platforms, p) THEN r := array_append(r, 'Licence does not cover ' || p || '.'); END IF;
      END LOOP;
    END IF;
    IF cardinality(COALESCE(lic.territories,'{}')) = 0 THEN r := array_append(r, 'Licence names no territories: territory coverage must be explicit.');
    ELSIF cardinality(COALESCE(c.target_geographies,'{}')) = 0 THEN r := array_append(r, 'Campaign must name its target territories for licensed content.');
    ELSIF NOT (public.private_network_lower(c.target_geographies) <@ public.private_network_lower(lic.territories)) THEN
      r := array_append(r, 'Campaign geography is outside the licence territories.'); END IF;
    IF COALESCE(lic.creator_approval_required,false) AND NOT cr.creator_approval_recorded THEN r := array_append(r, 'Creator approval required and not recorded.'); END IF;
    IF job.id IS NULL OR job.creator_id IS DISTINCT FROM lic.creator_id THEN r := array_append(r, 'Production job does not match the licence creator.');
    ELSE
      IF job.is_test IS DISTINCT FROM c.is_test THEN r := array_append(r, 'Test and live records cannot mix (production job vs campaign).'); END IF;
      IF lic.production_job_id IS NOT NULL THEN
        IF lic.production_job_id <> job.id THEN r := array_append(r, 'Licence is for a different production job.'); END IF;
      ELSIF lic.opportunity_id IS NULL OR job.opportunity_id IS NULL OR lic.opportunity_id <> job.opportunity_id THEN
        r := array_append(r, 'Licence is not bound to this production job or its opportunity.');
      END IF;
      IF lic.opportunity_id IS NOT NULL AND job.opportunity_id IS NOT NULL AND lic.opportunity_id <> job.opportunity_id THEN
        r := array_append(r, 'Licence and production job belong to different opportunities.'); END IF;
      IF job.clean_master_path IS NULL THEN r := array_append(r, 'No clean master: watermarked previews are not distributable.'); END IF;
      IF job.rights_mode IS DISTINCT FROM 'Commercial' THEN r := array_append(r, 'Production job was made under preview rights only.'); END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.job_id = job.id AND pr.stage = 'Human QA' AND pr.decision = 'Approve') THEN
        r := array_append(r, 'Human QA approval missing.'); END IF;
      IF job.opportunity_id IS NULL THEN r := array_append(r, 'Production job has no opportunity.');
      ELSE
        SELECT o.stage INTO opp_stage FROM public.creator_network_opportunities o WHERE o.id = job.opportunity_id;
        IF opp_stage IS DISTINCT FROM 'Fulfilled' THEN r := array_append(r, 'Opportunity is not Fulfilled.'); END IF;
      END IF;
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

CREATE OR REPLACE FUNCTION public.private_network_add_cn_creative(_campaign uuid, _job uuid, _licence uuid, _caption text, _rights_platforms text[], _rights_expires timestamptz, _creator_approval boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; l record; c record; nid uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_is_operator() OR NOT public.creator_network_has_access(auth.uid(), NULL) THEN
    RAISE EXCEPTION 'PN: Needs both Private Network operator and Creator Network access.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = _campaign;
  SELECT * INTO j FROM public.creator_network_production_jobs WHERE id = _job;
  SELECT * INTO l FROM public.creator_network_licences WHERE id = _licence;
  IF c.id IS NULL OR j.id IS NULL OR l.id IS NULL OR l.creator_id IS DISTINCT FROM j.creator_id THEN RAISE EXCEPTION 'PN: Campaign, job or licence not found / mismatched.'; END IF;
  IF NOT ((l.production_job_id IS NOT NULL AND l.production_job_id = j.id)
       OR (l.production_job_id IS NULL AND l.opportunity_id IS NOT NULL AND l.opportunity_id = j.opportunity_id)) THEN
    RAISE EXCEPTION 'PN: Licence is not bound to this production job or its opportunity.'; END IF;
  IF c.is_test IS DISTINCT FROM j.is_test OR c.is_test IS DISTINCT FROM l.is_test THEN
    RAISE EXCEPTION 'PN: Test and live records cannot mix.'; END IF;
  IF j.clean_master_path IS NULL THEN RAISE EXCEPTION 'PN: Only clean masters can be distributed. Watermarked previews are ineligible.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  INSERT INTO public.private_network_creatives (campaign_id, media_type, media_source, storage_bucket, storage_path, caption, cn_production_job_id, cn_licence_id,
    creator_approval_recorded, rights_platforms, rights_expires_at, status, is_test, created_by)
  VALUES (_campaign, CASE WHEN j.video_project_id IS NOT NULL THEN 'video' ELSE 'image' END, 'creator_network', 'creator-network-assets', j.clean_master_path,
    left(_caption, 2000), _job, _licence, COALESCE(_creator_approval,false), COALESCE(_rights_platforms,'{}'), _rights_expires, 'pending', c.is_test, auth.uid())
  RETURNING id INTO nid;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('creative', nid, 'cn_master_added', jsonb_build_object('job', j.code, 'licence', _licence), c.is_test);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_creative_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rpc boolean := COALESCE(current_setting('private_network.rpc', true), '') = 'on'; _brand uuid; _test boolean;
BEGIN
  PERFORM public.private_network_validate_platforms(NEW.rights_platforms);
  NEW.updated_at := now();
  IF _rpc OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  SELECT brand_id, is_test INTO _brand, _test FROM public.private_network_campaigns WHERE id = NEW.campaign_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.media_source = 'creator_network' THEN RAISE EXCEPTION 'PN: Creator Network masters are added by operators only.'; END IF;
    IF NEW.media_source = 'brand_design' THEN
      SELECT image_url INTO NEW.public_media_url FROM public.designs WHERE id = NEW.design_id AND brand_id = _brand;
      IF NEW.public_media_url IS NULL THEN RAISE EXCEPTION 'PN: Design not found for this brand.'; END IF;
      NEW.media_type := 'image'; NEW.storage_bucket := NULL; NEW.storage_path := NULL;
    ELSE
      NEW.storage_bucket := 'private-network-media'; NEW.public_media_url := NULL;
      IF NEW.storage_path IS NULL OR split_part(NEW.storage_path, '/', 1) <> _brand::text THEN RAISE EXCEPTION 'PN: Upload must live in this brand folder.'; END IF;
    END IF;
    NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.review_reason := NULL;
    NEW.private_redistribution_confirmed := false; NEW.private_redistribution_evidence := NULL;
    NEW.cn_licence_id := NULL; NEW.cn_production_job_id := NULL; NEW.created_by := auth.uid(); NEW.is_test := COALESCE(_test, false);
    IF NEW.rights_attested THEN NEW.rights_attested_by := auth.uid(); NEW.rights_attested_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'PN: Reviewed creative cannot be edited; add a new one.'; END IF;
  IF NEW.status <> OLD.status OR NEW.private_redistribution_confirmed <> OLD.private_redistribution_confirmed
     OR NEW.private_redistribution_evidence IS DISTINCT FROM OLD.private_redistribution_evidence
     OR NEW.media_source <> OLD.media_source OR NEW.campaign_id <> OLD.campaign_id OR NEW.media_type <> OLD.media_type
     OR NEW.cn_licence_id IS DISTINCT FROM OLD.cn_licence_id OR NEW.cn_production_job_id IS DISTINCT FROM OLD.cn_production_job_id
     OR NEW.storage_bucket IS DISTINCT FROM OLD.storage_bucket OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.public_media_url IS DISTINCT FROM OLD.public_media_url OR NEW.design_id IS DISTINCT FROM OLD.design_id
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.review_reason IS DISTINCT FROM OLD.review_reason OR NEW.is_test <> OLD.is_test
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.rights_attested_by IS DISTINCT FROM OLD.rights_attested_by THEN
    RAISE EXCEPTION 'PN: That field changes only through review.';
  END IF;
  IF (OLD.media_source = 'creator_network') AND (NEW.creator_approval_recorded IS DISTINCT FROM OLD.creator_approval_recorded
     OR NEW.rights_platforms IS DISTINCT FROM OLD.rights_platforms OR NEW.rights_expires_at IS DISTINCT FROM OLD.rights_expires_at) THEN
    RAISE EXCEPTION 'PN: Creator Network rights fields change only through operators.';
  END IF;
  IF NEW.rights_attested AND NOT OLD.rights_attested THEN NEW.rights_attested_by := auth.uid(); NEW.rights_attested_at := now(); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_campaign_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rpc boolean := COALESCE(current_setting('private_network.rpc', true), '') = 'on';
BEGIN
  IF NEW.landing_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/[^\s]*)?$' THEN RAISE EXCEPTION 'PN: Landing URL must be a valid https:// address.'; END IF;
  NEW.landing_host := lower(substring(NEW.landing_url from '^https://([^/:?#]+)'));
  PERFORM public.private_network_validate_platforms(NEW.target_platforms);
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'PN: End date must be after start date.'; END IF;
  NEW.updated_at := now();
  IF _rpc OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft'; NEW.funding_status := 'unfunded'; NEW.funding_reference := NULL;
    NEW.budget_reserved_ngn := 0; NEW.budget_spent_ngn := 0; NEW.owner_user_id := auth.uid(); NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.funding_status IS DISTINCT FROM OLD.funding_status
     OR NEW.funding_reference IS DISTINCT FROM OLD.funding_reference OR NEW.budget_reserved_ngn <> OLD.budget_reserved_ngn
     OR NEW.budget_spent_ngn <> OLD.budget_spent_ngn OR NEW.brand_id <> OLD.brand_id OR NEW.owner_user_id <> OLD.owner_user_id
     OR NEW.code <> OLD.code OR NEW.is_test <> OLD.is_test OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
    RAISE EXCEPTION 'PN: Status, funding and budget counters change only through Private Network actions.';
  END IF;
  IF OLD.funding_status IS DISTINCT FROM 'unfunded' AND NEW.budget_ngn IS DISTINCT FROM OLD.budget_ngn THEN
    RAISE EXCEPTION 'PN: Budget of a funded campaign changes only through operator funding.'; END IF;
  IF OLD.status NOT IN ('draft','rejected') THEN
    RAISE EXCEPTION 'PN: Only draft or rejected campaigns can be edited directly; use Private Network actions.';
  END IF;
  RETURN NEW;
END $$;

DROP FUNCTION IF EXISTS public.private_network_ingest_event(uuid, text, text, text, numeric, uuid);
CREATE OR REPLACE FUNCTION public.private_network_ingest_event(_caller uuid, _key_hash text, _token text, _type text, _external_id text, _amount numeric, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record; c record; pub record; k record; kid uuid; eid uuid; earn numeric := 0; outcome text := 'recorded'; recent int; avail numeric; trust text;
BEGIN
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  IF _type NOT IN ('qualified_action','conversion') THEN RAISE EXCEPTION 'PN: Unknown event type.'; END IF;
  IF COALESCE(btrim(_external_id),'') = '' OR length(_external_id) > 200 THEN RAISE EXCEPTION 'PN: external_event_id required.'; END IF;
  IF _amount IS NOT NULL AND (_amount < 0 OR _amount > 100000000) THEN RAISE EXCEPTION 'PN: Amount invalid.'; END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Unknown reference.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = pl.campaign_id FOR UPDATE;
  SELECT * INTO pub FROM public.private_network_publishers WHERE id = pl.publisher_id;
  IF pl.is_test IS DISTINCT FROM c.is_test OR pub.is_test IS DISTINCT FROM c.is_test THEN RAISE EXCEPTION 'PN: Test and live records cannot mix.'; END IF;
  IF _key_hash IS NOT NULL THEN
    SELECT * INTO k FROM public.private_network_integration_keys WHERE key_hash = _key_hash AND revoked_at IS NULL;
    IF NOT FOUND OR k.brand_id <> c.brand_id THEN RAISE EXCEPTION 'PN: Caller cannot report events for this campaign.'; END IF;
    trust := 'integration_key'; kid := k.id;
  ELSIF _caller IS NOT NULL AND public.private_network_has_role(_caller, NULL) THEN trust := 'operator';
  ELSIF _caller IS NOT NULL AND public.has_brand_access(c.brand_id, _caller) THEN trust := 'brand_user';
  ELSE RAISE EXCEPTION 'PN: Caller cannot report events for this campaign.'; END IF;
  IF EXISTS (SELECT 1 FROM public.private_network_events WHERE source='server' AND external_event_id = _external_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  SELECT count(*) INTO recent FROM public.private_network_events
    WHERE created_at > now() - interval '1 minute' AND ((_caller IS NOT NULL AND caller_user_id = _caller) OR (kid IS NOT NULL AND integration_key_id = kid));
  IF recent >= 120 THEN RAISE EXCEPTION 'PN: Rate limit exceeded.'; END IF;
  IF _type = 'conversion' AND (_amount IS NULL OR _amount <= 0) THEN RAISE EXCEPTION 'PN: Conversion amount required.'; END IF;
  IF (_actor IS NOT NULL AND _actor = pub.user_id) OR _caller = pub.user_id THEN outcome := 'rejected_self_action';
  ELSIF pl.status <> 'verified' THEN outcome := 'withheld_unverified_post';
  ELSIF c.status NOT IN ('active','paused','ended') THEN outcome := 'withheld_campaign_state';
  ELSIF trust = 'brand_user' THEN outcome := 'pending_reconciliation';
  ELSE
    earn := CASE WHEN _type='qualified_action' THEN pl.snapshot_action_bonus ELSE round(_amount * pl.snapshot_commission_pct / 100, 2) END;
    avail := c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn;
    IF earn <= 0 THEN outcome := 'no_reward_configured'; earn := 0;
    ELSIF avail < earn THEN outcome := 'withheld_budget_exhausted'; earn := 0;
    ELSE outcome := 'earned'; END IF;
  END IF;
  INSERT INTO public.private_network_events (placement_id, event_type, source, external_event_id, amount, actor_user_id, caller_user_id, outcome, earned_amount, is_test, trust_level, integration_key_id)
  VALUES (pl.id, _type, 'server', _external_id, _amount, _actor, _caller, outcome, earn, pl.is_test, trust, kid) RETURNING id INTO eid;
  IF outcome = 'earned' THEN
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_spent_ngn = budget_spent_ngn + earn WHERE id = c.id;
    PERFORM set_config('private_network.rpc', 'off', true);
    INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, event_id, entry_type, bucket, amount, idempotency_key, created_by, is_test)
    VALUES (pl.publisher_id, pl.id, c.id, eid, CASE WHEN _type='qualified_action' THEN 'action_bonus' ELSE 'conversion_commission' END, 'pending', earn, 'evt:' || eid, COALESCE(_caller, k.created_by), pl.is_test);
  END IF;
  IF outcome NOT LIKE 'rejected%' THEN
    UPDATE public.private_network_placements SET leads = leads + CASE WHEN _type='qualified_action' THEN 1 ELSE 0 END,
      conversions = conversions + CASE WHEN _type='conversion' THEN 1 ELSE 0 END WHERE id = pl.id;
  END IF;
  INSERT INTO public.private_network_activity_log (actor_id, entity_type, entity_id, action, details, is_test)
  VALUES (_caller, 'event', eid, _type, jsonb_build_object('outcome', outcome, 'earned', earn, 'external_id', _external_id, 'trust', trust), pl.is_test);
  RETURN jsonb_build_object('ok', true, 'event_id', eid, 'outcome', outcome, 'earned', earn, 'trust', trust);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_reconcile_event(_event uuid, _approve boolean, _verified_amount numeric DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; pl record; c record; earn numeric := 0; avail numeric; amt numeric; outc text;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  IF COALESCE(btrim(_note),'') = '' THEN RAISE EXCEPTION 'PN: A reconciliation note (source reference) is required.'; END IF;
  SELECT * INTO e FROM public.private_network_events WHERE id = _event FOR UPDATE;
  IF NOT FOUND OR e.outcome <> 'pending_reconciliation' THEN RAISE EXCEPTION 'PN: Event is not awaiting reconciliation.'; END IF;
  IF e.caller_user_id = auth.uid() THEN RAISE EXCEPTION 'PN: You cannot reconcile an event you reported.'; END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE id = e.placement_id FOR UPDATE;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = pl.campaign_id FOR UPDATE;
  IF NOT _approve THEN outc := 'rejected_reconciliation';
  ELSE
    amt := COALESCE(_verified_amount, e.amount);
    IF e.event_type = 'conversion' AND (amt IS NULL OR amt <= 0 OR amt > 100000000) THEN RAISE EXCEPTION 'PN: Verified amount required.'; END IF;
    earn := CASE WHEN e.event_type='qualified_action' THEN pl.snapshot_action_bonus ELSE round(amt * pl.snapshot_commission_pct / 100, 2) END;
    avail := c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn;
    IF earn <= 0 THEN outc := 'no_reward_configured'; earn := 0;
    ELSIF avail < earn THEN outc := 'withheld_budget_exhausted'; earn := 0;
    ELSE outc := 'earned'; END IF;
  END IF;
  UPDATE public.private_network_events SET outcome = outc, earned_amount = earn, amount = COALESCE(amt, amount),
    reconciled_by = auth.uid(), reconciled_at = now(), reconcile_note = left(_note, 500) WHERE id = e.id;
  IF outc = 'earned' THEN
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_spent_ngn = budget_spent_ngn + earn WHERE id = c.id;
    PERFORM set_config('private_network.rpc', 'off', true);
    INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, event_id, entry_type, bucket, amount, idempotency_key, created_by, is_test)
    VALUES (pl.publisher_id, pl.id, c.id, e.id, CASE WHEN e.event_type='qualified_action' THEN 'action_bonus' ELSE 'conversion_commission' END, 'pending', earn, 'evt:' || e.id, auth.uid(), pl.is_test);
  END IF;
  PERFORM public.private_network_log('event', e.id, 'reconciled', jsonb_build_object('outcome', outc, 'earned', earn, 'note', _note), pl.is_test);
  RETURN jsonb_build_object('ok', true, 'outcome', outc, 'earned', earn);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_publish_cohort_ok(_creative uuid, _publisher uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.private_network_creatives cr JOIN public.private_network_campaigns c ON c.id = cr.campaign_id
    JOIN public.private_network_publishers p ON p.id = _publisher WHERE cr.id = _creative AND cr.is_test = c.is_test AND c.is_test = p.is_test)
$$;
CREATE OR REPLACE FUNCTION public.private_network_publish_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.platform IS NULL THEN RAISE EXCEPTION 'PN: A platform is required.'; END IF;
  IF TG_OP = 'INSERT' AND NOT public.private_network_publish_cohort_ok(NEW.creative_id, NEW.publisher_id) THEN
    RAISE EXCEPTION 'PN: Test and live records cannot mix.'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE f record;
  user_rpcs text[] := ARRAY['private_network_add_cn_creative','private_network_allow_domain','private_network_balance','private_network_campaign_transition',
    'private_network_cancel_placement','private_network_delete_profile','private_network_enabled','private_network_feed','private_network_is_operator',
    'private_network_list_cn_masters','private_network_mark_share','private_network_metrics','private_network_my_placements','private_network_my_publisher_id',
    'private_network_publish','private_network_record_funding','private_network_release_pending','private_network_request_payout','private_network_reverse_entry',
    'private_network_review_creative','private_network_review_payout','private_network_review_proof','private_network_review_publisher','private_network_review_reasons',
    'private_network_save_profile','private_network_set_enabled','private_network_set_member','private_network_submit_creator_link','private_network_submit_proof',
    'private_network_create_integration_key','private_network_revoke_integration_key','private_network_reconcile_event'];
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname LIKE 'private_network%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    IF f.proname = ANY(user_rpcs) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig); END IF;
  END LOOP;
END $$;