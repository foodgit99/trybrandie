CREATE OR REPLACE FUNCTION public.private_network_creative_eligibility(_creative uuid, _platform text DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; c record; lic record; job record; r text[] := '{}'; fam text; bname text;
BEGIN
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF NOT FOUND THEN RETURN ARRAY['Creative not found.']; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id;
  IF cr.rights_expires_at IS NOT NULL AND cr.rights_expires_at < now() THEN r := array_append(r, 'Distribution rights have expired.'); END IF;
  IF _platform IS NOT NULL AND cardinality(cr.rights_platforms) > 0 AND NOT (_platform = ANY(cr.rights_platforms)) THEN
    r := array_append(r, 'Rights do not cover ' || _platform || '.'); END IF;
  IF cr.media_source = 'creator_network' THEN
    SELECT * INTO lic FROM public.creator_network_licences WHERE id = cr.cn_licence_id;
    IF NOT FOUND THEN RETURN array_append(r, 'Creator licence not found.'); END IF;
    SELECT * INTO job FROM public.creator_network_production_jobs WHERE id = cr.cn_production_job_id;
    SELECT name INTO bname FROM public.brands WHERE id = c.brand_id;
    IF lic.revoked THEN r := array_append(r, 'Creator licence revoked.'); END IF;
    IF lic.expires_at IS NOT NULL AND lic.expires_at < current_date THEN r := array_append(r, 'Creator licence expired.'); END IF;
    IF lic.starts_at IS NOT NULL AND lic.starts_at > current_date THEN r := array_append(r, 'Creator licence not started yet.'); END IF;
    IF c.ends_at IS NOT NULL AND lic.expires_at IS NOT NULL AND c.ends_at::date > lic.expires_at THEN r := array_append(r, 'Campaign runs past the licence expiry.'); END IF;
    IF lic.licence_scope <> 'Commercial' OR lic.status NOT IN ('Signed','Active') THEN r := array_append(r, 'Preview-only or unsigned licence: not commercially eligible.'); END IF;
    IF NOT lic.likeness_permission THEN r := array_append(r, 'Likeness permission missing.'); END IF;
    IF NOT lic.organic_social_permission THEN r := array_append(r, 'Organic social permission missing.'); END IF;
    IF lic.brand_id IS NOT NULL AND lic.brand_id <> c.brand_id THEN r := array_append(r, 'Licence belongs to a different brand.'); END IF;
    IF bname IS NOT NULL AND lower(bname) = ANY(public.private_network_lower(lic.restricted_brands)) THEN r := array_append(r, 'Brand is restricted by the licence.'); END IF;
    IF _platform IS NOT NULL AND cardinality(lic.platforms) > 0 THEN
      fam := split_part(_platform, '_', 1);
      IF NOT EXISTS (SELECT 1 FROM unnest(lic.platforms) p WHERE lower(p) LIKE fam || '%') THEN r := array_append(r, 'Licence does not cover ' || fam || '.'); END IF;
    END IF;
    IF cardinality(lic.territories) > 0 AND cardinality(c.target_geographies) > 0
       AND NOT (public.private_network_lower(c.target_geographies) <@ public.private_network_lower(lic.territories)) THEN
      r := array_append(r, 'Campaign geography is outside the licence territories.'); END IF;
    IF lic.creator_approval_required AND NOT cr.creator_approval_recorded THEN r := array_append(r, 'Creator approval required and not recorded.'); END IF;
    IF job.id IS NULL OR job.creator_id <> lic.creator_id THEN r := array_append(r, 'Production job does not match the licence.');
    ELSE
      IF job.clean_master_path IS NULL THEN r := array_append(r, 'No clean master: watermarked previews are not distributable.'); END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.job_id = job.id AND pr.stage = 'Human QA' AND pr.decision = 'Approve') THEN
        r := array_append(r, 'Human QA approval missing.'); END IF;
    END IF;
    IF NOT cr.private_redistribution_confirmed THEN r := array_append(r, 'Explicit private-redistribution rights not confirmed by an operator.'); END IF;
  ELSE
    IF NOT cr.rights_attested THEN r := array_append(r, 'Rights attestation missing.'); END IF;
  END IF;
  RETURN r;
END $$;
