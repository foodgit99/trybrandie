CREATE OR REPLACE FUNCTION public.private_network_creative_eligibility(_creative uuid, _platform text DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; c record; lic record; job record; r text[] := '{}'; fam text; bname text;
BEGIN
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF NOT FOUND THEN RETURN ARRAY['Creative not found.']; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id;
  IF cr.rights_expires_at IS NOT NULL AND cr.rights_expires_at < now() THEN r := r || 'Distribution rights have expired.'; END IF;
  IF _platform IS NOT NULL AND cardinality(cr.rights_platforms) > 0 AND NOT (_platform = ANY(cr.rights_platforms)) THEN
    r := r || ('Rights do not cover ' || _platform || '.'); END IF;
  IF cr.media_source = 'creator_network' THEN
    SELECT * INTO lic FROM public.creator_network_licences WHERE id = cr.cn_licence_id;
    IF NOT FOUND THEN RETURN r || 'Creator licence not found.'; END IF;
    SELECT * INTO job FROM public.creator_network_production_jobs WHERE id = cr.cn_production_job_id;
    SELECT name INTO bname FROM public.brands WHERE id = c.brand_id;
    IF lic.revoked THEN r := r || 'Creator licence revoked.'; END IF;
    IF lic.expires_at IS NOT NULL AND lic.expires_at < current_date THEN r := r || 'Creator licence expired.'; END IF;
    IF lic.starts_at IS NOT NULL AND lic.starts_at > current_date THEN r := r || 'Creator licence not started yet.'; END IF;
    IF c.ends_at IS NOT NULL AND lic.expires_at IS NOT NULL AND c.ends_at::date > lic.expires_at THEN r := r || 'Campaign runs past the licence expiry.'; END IF;
    IF lic.licence_scope <> 'Commercial' OR lic.status NOT IN ('Signed','Active') THEN r := r || 'Preview-only or unsigned licence: not commercially eligible.'; END IF;
    IF NOT lic.likeness_permission THEN r := r || 'Likeness permission missing.'; END IF;
    IF NOT lic.organic_social_permission THEN r := r || 'Organic social permission missing.'; END IF;
    IF lic.brand_id IS NOT NULL AND lic.brand_id <> c.brand_id THEN r := r || 'Licence belongs to a different brand.'; END IF;
    IF bname IS NOT NULL AND lower(bname) = ANY(public.private_network_lower(lic.restricted_brands)) THEN r := r || 'Brand is restricted by the licence.'; END IF;
    IF _platform IS NOT NULL AND cardinality(lic.platforms) > 0 THEN
      fam := split_part(_platform, '_', 1);
      IF NOT EXISTS (SELECT 1 FROM unnest(lic.platforms) p WHERE lower(p) LIKE fam || '%') THEN r := r || ('Licence does not cover ' || fam || '.'); END IF;
    END IF;
    IF cardinality(lic.territories) > 0 AND cardinality(c.target_geographies) > 0
       AND NOT (public.private_network_lower(c.target_geographies) <@ public.private_network_lower(lic.territories)) THEN
      r := r || 'Campaign geography is outside the licence territories.'; END IF;
    IF lic.creator_approval_required AND NOT cr.creator_approval_recorded THEN r := r || 'Creator approval required and not recorded.'; END IF;
    IF job.id IS NULL OR job.creator_id <> lic.creator_id THEN r := r || 'Production job does not match the licence.';
    ELSE
      IF job.clean_master_path IS NULL THEN r := r || 'No clean master: watermarked previews are not distributable.'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.job_id = job.id AND pr.stage = 'Human QA' AND pr.decision = 'Approve') THEN
        r := r || 'Human QA approval missing.'; END IF;
    END IF;
    IF NOT cr.private_redistribution_confirmed THEN r := r || 'Explicit private-redistribution rights not confirmed by an operator.'; END IF;
  ELSE
    IF NOT cr.rights_attested THEN r := r || 'Rights attestation missing.'; END IF;
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_list_cn_masters()
RETURNS TABLE(production_job_id uuid, job_code text, creator_id uuid, creator_name text, licence_id uuid, licence_status text, licence_scope text,
  organic boolean, platforms text[], territories text[], expires_at date, revoked boolean, has_clean_master boolean, qa_approved boolean, is_test boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.private_network_is_operator() OR NOT public.creator_network_has_access(auth.uid(), NULL) THEN
    RAISE EXCEPTION 'PN: Needs both Private Network operator and Creator Network access.'; END IF;
  RETURN QUERY
  SELECT j.id, j.code, j.creator_id, cr.display_name, l.id, l.status, l.licence_scope, l.organic_social_permission, l.platforms, l.territories,
         l.expires_at, l.revoked, j.clean_master_path IS NOT NULL,
         EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.job_id = j.id AND pr.stage='Human QA' AND pr.decision='Approve'),
         j.is_test
  FROM public.creator_network_production_jobs j
  JOIN public.creator_network_creators cr ON cr.id = j.creator_id
  JOIN public.creator_network_licences l ON l.creator_id = j.creator_id AND (l.production_job_id = j.id OR l.opportunity_id = j.opportunity_id)
  ORDER BY j.created_at DESC;
END $$;
