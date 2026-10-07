ALTER TABLE public.private_network_campaigns ADD COLUMN IF NOT EXISTS funded_amount_ngn numeric NOT NULL DEFAULT 0;
ALTER TABLE public.private_network_creatives ADD COLUMN IF NOT EXISTS source_master_path text;
ALTER TABLE public.private_network_creatives ADD COLUMN IF NOT EXISTS source_master_etag text;
ALTER TABLE public.private_network_creatives ADD COLUMN IF NOT EXISTS source_opportunity_id uuid;

CREATE TABLE IF NOT EXISTS public.private_network_funding_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.private_network_campaigns(id),
  kind text NOT NULL CHECK (kind IN ('initial','top_up','test')),
  amount numeric NOT NULL CHECK (amount > 0),
  reference text NOT NULL,
  recorded_by uuid,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pn_funding_reference_uniq UNIQUE (reference)
);
GRANT SELECT ON public.private_network_funding_settlements TO authenticated;
GRANT ALL ON public.private_network_funding_settlements TO service_role;
ALTER TABLE public.private_network_funding_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PN operators read funding settlements" ON public.private_network_funding_settlements FOR SELECT TO authenticated
  USING (public.private_network_is_operator());
CREATE TRIGGER pn_funding_append_only BEFORE UPDATE OR DELETE ON public.private_network_funding_settlements
  FOR EACH ROW EXECUTE FUNCTION public.private_network_block_mutation();

CREATE TABLE IF NOT EXISTS public.private_network_earning_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  earning_entry_id uuid NOT NULL REFERENCES public.private_network_ledger(id),
  kind text NOT NULL CHECK (kind IN ('release','reversal')),
  amount numeric NOT NULL,
  ledger_entry_id uuid REFERENCES public.private_network_ledger(id),
  batch text,
  created_by uuid,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pn_allocation_once UNIQUE (earning_entry_id)
);
GRANT SELECT ON public.private_network_earning_allocations TO authenticated;
GRANT ALL ON public.private_network_earning_allocations TO service_role;
ALTER TABLE public.private_network_earning_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PN operators read allocations" ON public.private_network_earning_allocations FOR SELECT TO authenticated
  USING (public.private_network_is_operator());
CREATE TRIGGER pn_allocation_append_only BEFORE UPDATE OR DELETE ON public.private_network_earning_allocations
  FOR EACH ROW EXECUTE FUNCTION public.private_network_block_mutation();

CREATE OR REPLACE FUNCTION public.private_network_funding_ok(_campaign uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.private_network_campaigns c WHERE c.id = _campaign AND c.budget_ngn > 0
    AND (c.funding_status = 'funded_manual' OR (c.funding_status = 'test' AND c.is_test))
    AND c.funded_amount_ngn >= c.budget_ngn
    AND c.funded_amount_ngn = (SELECT COALESCE(sum(s.amount),0) FROM public.private_network_funding_settlements s WHERE s.campaign_id = c.id))
$$;

CREATE OR REPLACE FUNCTION public.private_network_placement_live_reasons(_placement uuid, _states text[]) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record; c record; cr record; pub record; r text[] := '{}';
BEGIN
  SELECT * INTO pl FROM public.private_network_placements WHERE id = _placement;
  IF NOT FOUND THEN RETURN ARRAY['Placement not found.']; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = pl.campaign_id;
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = pl.creative_id;
  SELECT * INTO pub FROM public.private_network_publishers WHERE id = pl.publisher_id;
  IF NOT (c.status = ANY(_states)) THEN r := array_append(r, 'Campaign state ' || c.status || ' not allowed.'); END IF;
  IF 'ended' <> ALL(_states) AND c.ends_at IS NOT NULL AND c.ends_at <= now() THEN r := array_append(r, 'Campaign window has ended.'); END IF;
  IF NOT public.private_network_funding_ok(c.id) THEN r := array_append(r, 'Campaign funding does not cover its budget.'); END IF;
  IF cr.status IS DISTINCT FROM 'approved' THEN r := array_append(r, 'Creative is not approved (' || COALESCE(cr.status,'missing') || ').'); END IF;
  IF pub.status IS DISTINCT FROM 'approved' THEN r := array_append(r, 'Publisher is not approved.'); END IF;
  IF pl.is_test IS DISTINCT FROM c.is_test OR cr.is_test IS DISTINCT FROM c.is_test OR pub.is_test IS DISTINCT FROM c.is_test THEN
    r := array_append(r, 'Test and live records cannot mix.'); END IF;
  r := r || public.private_network_creative_eligibility(pl.creative_id, pl.platform::text);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_record_funding(_id uuid, _status text, _reference text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN RAISE EXCEPTION 'PN: Record funding with the verified settled amount (record_funding with _amount).'; END $function$;

CREATE OR REPLACE FUNCTION public.private_network_record_funding(_id uuid, _status text, _reference text, _amount numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c record; ref text := btrim(COALESCE(_reference,''));
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Campaign not found.'; END IF;
  IF _status NOT IN ('unfunded','funded_manual','test') THEN RAISE EXCEPTION 'PN: Unknown funding status.'; END IF;
  IF _status = 'unfunded' THEN
    IF c.status IN ('active','paused') OR c.budget_reserved_ngn > 0 OR c.budget_spent_ngn > 0
       OR EXISTS (SELECT 1 FROM public.private_network_funding_settlements WHERE campaign_id=_id) THEN
      RAISE EXCEPTION 'PN: Settled funding cannot be removed; end the campaign instead.'; END IF;
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET funding_status='unfunded', funding_reference=NULL WHERE id=_id;
    PERFORM set_config('private_network.rpc', 'off', true);
    PERFORM public.private_network_log('campaign', _id, 'funding_unfunded', '{}'::jsonb, c.is_test);
    RETURN;
  END IF;
  IF _status = 'test' AND NOT c.is_test THEN RAISE EXCEPTION 'PN: Test funding is only allowed on TEST campaigns.'; END IF;
  IF _status = 'funded_manual' AND c.is_test THEN RAISE EXCEPTION 'PN: TEST campaigns use test funding only.'; END IF;
  IF c.funding_status <> 'unfunded' THEN RAISE EXCEPTION 'PN: Already funded; use a budget top-up.'; END IF;
  IF length(ref) < 4 THEN RAISE EXCEPTION 'PN: A settlement reference is required.'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'PN: Enter the verified settled amount.'; END IF;
  IF c.budget_ngn <= 0 OR _amount < c.budget_ngn THEN RAISE EXCEPTION 'PN: Settled amount (%) must cover the campaign budget (%).', _amount, c.budget_ngn; END IF;
  IF EXISTS (SELECT 1 FROM public.private_network_funding_settlements WHERE reference = ref) THEN RAISE EXCEPTION 'PN: That settlement reference was already used.'; END IF;
  INSERT INTO public.private_network_funding_settlements (campaign_id, kind, amount, reference, recorded_by, is_test)
  VALUES (_id, CASE WHEN _status='test' THEN 'test' ELSE 'initial' END, _amount, ref, auth.uid(), c.is_test);
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET funding_status=_status, funding_reference=ref, funded_amount_ngn = funded_amount_ngn + _amount WHERE id=_id;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('campaign', _id, 'funding_' || _status, jsonb_build_object('reference', ref, 'amount', _amount), c.is_test);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_top_up_budget(_id uuid, _amount numeric, _reference text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c record; ref text := btrim(COALESCE(_reference,''));
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Campaign not found.'; END IF;
  IF NOT public.private_network_funding_ok(_id) THEN RAISE EXCEPTION 'PN: Campaign has no valid initial funding.'; END IF;
  IF c.status NOT IN ('pending_review','active','paused') THEN RAISE EXCEPTION 'PN: Cannot top up a % campaign.', c.status; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'PN: Enter the verified settled amount.'; END IF;
  IF length(ref) < 4 THEN RAISE EXCEPTION 'PN: A settlement reference is required.'; END IF;
  IF EXISTS (SELECT 1 FROM public.private_network_funding_settlements WHERE reference = ref) THEN RAISE EXCEPTION 'PN: That settlement reference was already used.'; END IF;
  INSERT INTO public.private_network_funding_settlements (campaign_id, kind, amount, reference, recorded_by, is_test)
  VALUES (_id, 'top_up', _amount, ref, auth.uid(), c.is_test);
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET funded_amount_ngn = funded_amount_ngn + _amount, budget_ngn = budget_ngn + _amount WHERE id=_id;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('campaign', _id, 'budget_top_up', jsonb_build_object('reference', ref, 'amount', _amount), c.is_test);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_campaign_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _rpc boolean := COALESCE(current_setting('private_network.rpc', true), '') = 'on';
BEGIN
  IF NEW.landing_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/[^\s]*)?$' THEN RAISE EXCEPTION 'PN: Landing URL must be a valid https:// address.'; END IF;
  NEW.landing_host := lower(substring(NEW.landing_url from '^https://([^/:?#]+)'));
  PERFORM public.private_network_validate_platforms(NEW.target_platforms);
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'PN: End date must be after start date.'; END IF;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.budget_ngn > OLD.budget_ngn AND OLD.funding_status <> 'unfunded' AND NEW.funded_amount_ngn < NEW.budget_ngn THEN
    RAISE EXCEPTION 'PN: Budget increase must be covered by a finance top-up.'; END IF;
  IF _rpc OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft'; NEW.funding_status := 'unfunded'; NEW.funding_reference := NULL;
    NEW.budget_reserved_ngn := 0; NEW.budget_spent_ngn := 0; NEW.funded_amount_ngn := 0; NEW.owner_user_id := auth.uid(); NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.funding_status IS DISTINCT FROM OLD.funding_status
     OR NEW.funding_reference IS DISTINCT FROM OLD.funding_reference OR NEW.budget_reserved_ngn <> OLD.budget_reserved_ngn
     OR NEW.budget_spent_ngn <> OLD.budget_spent_ngn OR NEW.brand_id <> OLD.brand_id OR NEW.owner_user_id <> OLD.owner_user_id
     OR NEW.funded_amount_ngn <> OLD.funded_amount_ngn OR NEW.code <> OLD.code OR NEW.is_test <> OLD.is_test OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
    RAISE EXCEPTION 'PN: Status, funding and budget counters change only through Private Network actions.';
  END IF;
  IF OLD.funding_status IS DISTINCT FROM 'unfunded' AND NEW.budget_ngn IS DISTINCT FROM OLD.budget_ngn THEN
    RAISE EXCEPTION 'PN: Budget of a funded campaign changes only through operator funding.'; END IF;
  IF OLD.status NOT IN ('draft','rejected') THEN
    RAISE EXCEPTION 'PN: Only draft or rejected campaigns can be edited directly; use Private Network actions.';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_campaign_transition(_id uuid, _to text, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c record; op boolean := public.private_network_has_role(auth.uid(), 'moderator'); owner boolean;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Campaign not found.'; END IF;
  owner := public.has_brand_access(c.brand_id, auth.uid());
  IF NOT (op OR owner) THEN RAISE EXCEPTION 'PN: Not your campaign.'; END IF;
  IF _to = 'pending_review' THEN
    IF c.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'PN: Only drafts can be submitted.'; END IF;
    IF c.budget_ngn <= 0 OR c.base_fee_ngn <= 0 THEN RAISE EXCEPTION 'PN: Set a budget and a base fee per post.'; END IF;
    IF c.budget_ngn < c.base_fee_ngn THEN RAISE EXCEPTION 'PN: Budget is smaller than one base fee.'; END IF;
    IF cardinality(c.target_platforms) = 0 THEN RAISE EXCEPTION 'PN: Choose at least one platform.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.private_network_creatives WHERE campaign_id=_id AND status IN ('pending','approved')) THEN RAISE EXCEPTION 'PN: Add at least one creative.'; END IF;
  ELSIF _to = 'active' THEN
    IF c.status NOT IN ('pending_review','paused') THEN RAISE EXCEPTION 'PN: Campaign cannot be activated from %.', c.status; END IF;
    IF c.status = 'pending_review' AND NOT op THEN RAISE EXCEPTION 'PN: An operator must approve activation.'; END IF;
    IF NOT public.private_network_funding_ok(_id) THEN RAISE EXCEPTION 'PN: Verified settled funding must cover the campaign budget.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.private_network_allowed_domains d WHERE d.brand_id = c.brand_id AND d.host = c.landing_host) THEN
      RAISE EXCEPTION 'PN: Landing domain % is not on the approved list.', c.landing_host; END IF;
    IF c.ends_at IS NOT NULL AND c.ends_at <= now() THEN RAISE EXCEPTION 'PN: Campaign end date has passed.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.private_network_creatives cr WHERE cr.campaign_id=_id AND cr.status='approved'
                   AND cardinality(public.private_network_creative_eligibility(cr.id, NULL)) = 0) THEN
      RAISE EXCEPTION 'PN: No approved creative with valid rights.'; END IF;
  ELSIF _to = 'paused' THEN
    IF c.status <> 'active' THEN RAISE EXCEPTION 'PN: Only active campaigns can be paused.'; END IF;
  ELSIF _to = 'ended' THEN
    IF c.status NOT IN ('active','paused','pending_review','draft') THEN RAISE EXCEPTION 'PN: Campaign already closed.'; END IF;
  ELSIF _to = 'rejected' THEN
    IF NOT op OR c.status <> 'pending_review' THEN RAISE EXCEPTION 'PN: Only an operator can reject a submitted campaign.'; END IF;
    IF COALESCE(btrim(_note),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
  ELSE RAISE EXCEPTION 'PN: Unknown status.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET status=_to, review_note=COALESCE(_note, review_note) WHERE id=_id;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('campaign', _id, 'campaign_' || _to, jsonb_build_object('from', c.status, 'note', _note), c.is_test);
  RETURN jsonb_build_object('status', _to);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_publish(_creative uuid, _platform text, _idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE p record; cr record; c record; ex record; reasons text[]; n int; avail numeric; nid uuid; tok text;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO p FROM public.private_network_publishers WHERE user_id = auth.uid() FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'approved' THEN RAISE EXCEPTION 'PN: Approved publisher profile required.'; END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT * INTO ex FROM public.private_network_placements WHERE publisher_id = p.id AND idempotency_key = _idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('placement_id', ex.id, 'token', ex.token, 'status', ex.status, 'replayed', true); END IF;
  END IF;
  PERFORM _platform::public.private_network_platform;
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF cr.id IS NULL OR cr.status <> 'approved' THEN RAISE EXCEPTION 'PN: This creative is not available.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id FOR UPDATE;
  IF c.status <> 'active' OR c.starts_at > now() OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN RAISE EXCEPTION 'PN: Campaign is not live.'; END IF;
  IF NOT public.private_network_funding_ok(c.id) THEN RAISE EXCEPTION 'PN: Campaign funding does not cover its budget.'; END IF;
  IF c.is_test <> p.is_test OR cr.is_test <> c.is_test THEN RAISE EXCEPTION 'PN: Test and live records cannot mix.'; END IF;
  IF NOT (_platform = ANY(c.target_platforms)) OR NOT (_platform = ANY(p.platforms)) THEN RAISE EXCEPTION 'PN: Platform not part of this campaign or your profile.'; END IF;
  reasons := public.private_network_creative_eligibility(_creative, _platform);
  IF cardinality(reasons) > 0 THEN RAISE EXCEPTION 'PN: Not eligible: %', array_to_string(reasons, ' '); END IF;
  SELECT * INTO ex FROM public.private_network_placements WHERE publisher_id=p.id AND creative_id=_creative AND platform=_platform::public.private_network_platform AND status <> 'cancelled';
  IF FOUND THEN RETURN jsonb_build_object('placement_id', ex.id, 'token', ex.token, 'status', ex.status, 'replayed', true); END IF;
  SELECT count(*) INTO n FROM public.private_network_placements WHERE publisher_id=p.id AND campaign_id=c.id AND status <> 'cancelled';
  IF n >= c.per_publisher_cap THEN RAISE EXCEPTION 'PN: You have reached the post limit for this campaign.'; END IF;
  IF c.max_placements IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.private_network_placements WHERE campaign_id=c.id AND status <> 'cancelled';
    IF n >= c.max_placements THEN RAISE EXCEPTION 'PN: Campaign is full.'; END IF;
  END IF;
  avail := c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn;
  IF avail < c.base_fee_ngn THEN RAISE EXCEPTION 'PN: Campaign budget is used up.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET budget_reserved_ngn = budget_reserved_ngn + c.base_fee_ngn WHERE id = c.id;
  PERFORM set_config('private_network.rpc', 'off', true);
  INSERT INTO public.private_network_placements (publisher_id, campaign_id, creative_id, platform, snapshot_base_fee, snapshot_action_bonus,
    snapshot_commission_pct, reserved_amount, idempotency_key, is_test)
  VALUES (p.id, c.id, _creative, _platform::public.private_network_platform, c.base_fee_ngn, c.action_bonus_ngn, c.conversion_commission_pct,
    c.base_fee_ngn, _idempotency_key, c.is_test)
  RETURNING id, token INTO nid, tok;
  PERFORM public.private_network_log('placement', nid, 'reserved', jsonb_build_object('campaign', c.code, 'platform', _platform, 'fee', c.base_fee_ngn), c.is_test);
  RETURN jsonb_build_object('placement_id', nid, 'token', tok, 'status', 'reserved', 'replayed', false);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_review_proof(_placement uuid, _decision text, _reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pl record; live text[];
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'PN: Moderator role required.'; END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE id=_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Placement not found.'; END IF;
  IF pl.status <> 'proof_submitted' THEN RAISE EXCEPTION 'PN: Nothing to review (state %).', pl.status; END IF;
  IF _decision = 'verify' THEN
    PERFORM 1 FROM public.private_network_campaigns WHERE id = pl.campaign_id FOR UPDATE;
    PERFORM 1 FROM public.private_network_publishers WHERE id = pl.publisher_id FOR SHARE;
    live := public.private_network_placement_live_reasons(pl.id, ARRAY['active','paused']);
    IF cardinality(live) > 0 THEN RAISE EXCEPTION 'PN: Cannot verify: %', array_to_string(live, ' '); END IF;
    IF pl.reserved_amount <> pl.snapshot_base_fee THEN RAISE EXCEPTION 'PN: Reservation does not match the snapshot fee.'; END IF;
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_reserved_ngn = GREATEST(budget_reserved_ngn - pl.reserved_amount, 0),
      budget_spent_ngn = budget_spent_ngn + pl.snapshot_base_fee WHERE id = pl.campaign_id;
    PERFORM set_config('private_network.rpc', 'off', true);
    UPDATE public.private_network_placements SET status='verified', verified_at=now(), reviewed_by=auth.uid(), reviewed_at=now(), reserved_amount=0, updated_at=now() WHERE id=_placement;
    INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, entry_type, bucket, amount, idempotency_key, created_by, is_test)
    VALUES (pl.publisher_id, pl.id, pl.campaign_id, 'base_fee', 'pending', pl.snapshot_base_fee, 'base:' || pl.id, auth.uid(), pl.is_test)
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSIF _decision = 'reject' THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    UPDATE public.private_network_placements SET status='rejected', reject_reason=_reason, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_placement;
  ELSIF _decision = 'reject_final' THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    PERFORM public.private_network_release_reservation(pl.campaign_id, pl.reserved_amount);
    UPDATE public.private_network_placements SET status='cancelled', reject_reason=_reason, cancelled_at=now(), reserved_amount=0, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_placement;
  ELSE RAISE EXCEPTION 'PN: Unknown decision.'; END IF;
  PERFORM public.private_network_log('placement', _placement, 'proof_' || _decision, jsonb_build_object('reason', _reason), pl.is_test);
  RETURN jsonb_build_object('ok', true);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_resolve_redirect(_token text, _ip_hash text, _ua_hash text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pl record; c record; recent int; dup boolean; dest text;
BEGIN
  IF NOT public.private_network_enabled() THEN RETURN jsonb_build_object('ok', false, 'reason', 'off'); END IF;
  IF _token !~ '^pn[0-9a-f]{32}$' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE token = _token;
  IF NOT FOUND OR pl.status NOT IN ('share_initiated','proof_submitted','verified','reserved') THEN RETURN jsonb_build_object('ok', false, 'reason', 'unavailable'); END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = pl.campaign_id;
  IF c.status NOT IN ('active','paused') OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN RETURN jsonb_build_object('ok', false, 'reason', 'ended'); END IF;
  IF cardinality(public.private_network_placement_live_reasons(pl.id, ARRAY['active','paused'])) > 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'rights'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.private_network_allowed_domains d WHERE d.brand_id = c.brand_id AND d.host = c.landing_host) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'domain'); END IF;
  dest := c.landing_url || CASE WHEN position('?' in c.landing_url) > 0 THEN '&' ELSE '?' END || 'pn_ref=' || pl.token;
  SELECT count(*) INTO recent FROM public.private_network_events WHERE ip_hash = _ip_hash AND created_at > now() - interval '10 minutes';
  IF recent >= 30 THEN RETURN jsonb_build_object('ok', true, 'url', dest, 'counted', false, 'reason', 'rate_limited'); END IF;
  dup := EXISTS (SELECT 1 FROM public.private_network_events WHERE placement_id = pl.id AND event_type='click' AND ip_hash = _ip_hash AND created_at > now() - interval '24 hours');
  INSERT INTO public.private_network_events (placement_id, event_type, source, ip_hash, ua_hash, outcome, is_test)
  VALUES (pl.id, 'click', 'redirect', _ip_hash, _ua_hash, CASE WHEN dup THEN 'duplicate' ELSE 'counted' END, pl.is_test);
  IF NOT dup THEN UPDATE public.private_network_placements SET clicks = clicks + 1 WHERE id = pl.id; END IF;
  RETURN jsonb_build_object('ok', true, 'url', dest, 'counted', NOT dup);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_ingest_event(_caller uuid, _key_hash text, _token text, _type text, _external_id text, _amount numeric, _actor uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  ELSIF cardinality(public.private_network_placement_live_reasons(pl.id, ARRAY['active','paused','ended'])) > 0 THEN outcome := 'withheld_ineligible';
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
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_reconcile_event(_event uuid, _approve boolean, _verified_amount numeric DEFAULT NULL::numeric, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  ELSIF cardinality(public.private_network_placement_live_reasons(pl.id, ARRAY['active','paused','ended'])) > 0 THEN outc := 'withheld_ineligible'; earn := 0;
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
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_release_pending(_publisher uuid)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE amt numeric; p record; k text := gen_random_uuid()::text; out_id uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  SELECT * INTO p FROM public.private_network_publishers WHERE id=_publisher FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Publisher not found.'; END IF;
  CREATE TEMP TABLE IF NOT EXISTS pn_rel_tmp (id uuid, amount numeric) ON COMMIT DROP;
  DELETE FROM pn_rel_tmp;
  INSERT INTO pn_rel_tmp SELECT l.id, l.amount FROM public.private_network_ledger l
   WHERE l.publisher_id=_publisher AND l.bucket='pending' AND l.entry_type IN ('base_fee','action_bonus','conversion_commission')
     AND l.amount > 0 AND NOT EXISTS (SELECT 1 FROM public.private_network_earning_allocations a WHERE a.earning_entry_id = l.id);
  SELECT COALESCE(sum(amount),0) INTO amt FROM pn_rel_tmp;
  IF amt <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.private_network_ledger (publisher_id, entry_type, bucket, amount, idempotency_key, created_by, is_test, note)
  VALUES (_publisher, 'release', 'pending', -amt, 'rel-out:' || k, auth.uid(), p.is_test, 'Released to available') RETURNING id INTO out_id;
  INSERT INTO public.private_network_ledger (publisher_id, entry_type, bucket, amount, idempotency_key, created_by, is_test, note)
  VALUES (_publisher, 'release', 'available', amt, 'rel-in:' || k, auth.uid(), p.is_test, 'Released to available');
  INSERT INTO public.private_network_earning_allocations (earning_entry_id, kind, amount, ledger_entry_id, batch, created_by, is_test)
  SELECT t.id, 'release', t.amount, out_id, k, auth.uid(), p.is_test FROM pn_rel_tmp t;
  PERFORM public.private_network_log('publisher', _publisher, 'earnings_released', jsonb_build_object('amount', amt, 'batch', k), p.is_test);
  RETURN amt;
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_reverse_entry(_entry uuid, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE e record; a record; rid uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
  SELECT * INTO e FROM public.private_network_ledger WHERE id=_entry;
  IF NOT FOUND OR e.entry_type NOT IN ('base_fee','action_bonus','conversion_commission') OR e.bucket <> 'pending' OR e.amount <= 0 THEN
    RAISE EXCEPTION 'PN: Only earning entries can be reversed.'; END IF;
  PERFORM 1 FROM public.private_network_publishers WHERE id=e.publisher_id FOR UPDATE;
  SELECT * INTO a FROM public.private_network_earning_allocations WHERE earning_entry_id = e.id;
  IF FOUND THEN
    IF a.kind = 'reversal' THEN RAISE EXCEPTION 'PN: This earning was already reversed.'; END IF;
    RAISE EXCEPTION 'PN: This earning was already released to available/paid; it cannot be reversed against other balances.';
  END IF;
  INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, entry_type, bucket, amount, idempotency_key, created_by, is_test, note)
  VALUES (e.publisher_id, e.placement_id, e.campaign_id, 'reversal', 'pending', -e.amount, 'rev:' || e.id, auth.uid(), e.is_test, _reason) RETURNING id INTO rid;
  INSERT INTO public.private_network_earning_allocations (earning_entry_id, kind, amount, ledger_entry_id, created_by, is_test)
  VALUES (e.id, 'reversal', e.amount, rid, auth.uid(), e.is_test);
  IF e.campaign_id IS NOT NULL THEN
    PERFORM 1 FROM public.private_network_campaigns WHERE id = e.campaign_id FOR UPDATE;
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_spent_ngn = GREATEST(budget_spent_ngn - e.amount, 0) WHERE id = e.campaign_id;
    PERFORM set_config('private_network.rpc', 'off', true);
  END IF;
  PERFORM public.private_network_log('ledger', _entry, 'reversed', jsonb_build_object('reason', _reason, 'amount', e.amount), e.is_test);
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_creative_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _allowed text[]; _rpc boolean := COALESCE(current_setting('private_network.rpc', true), '') = 'on'; _brand uuid; _test boolean;
BEGIN
  PERFORM public.private_network_validate_platforms(NEW.rights_platforms);
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND (NEW.media_source IS DISTINCT FROM OLD.media_source OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.media_type IS DISTINCT FROM OLD.media_type OR NEW.is_test IS DISTINCT FROM OLD.is_test OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.cn_production_job_id IS DISTINCT FROM OLD.cn_production_job_id OR NEW.cn_licence_id IS DISTINCT FROM OLD.cn_licence_id
     OR NEW.storage_bucket IS DISTINCT FROM OLD.storage_bucket OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.public_media_url IS DISTINCT FROM OLD.public_media_url OR NEW.design_id IS DISTINCT FROM OLD.design_id
     OR NEW.source_master_path IS DISTINCT FROM OLD.source_master_path OR NEW.source_master_etag IS DISTINCT FROM OLD.source_master_etag
     OR NEW.source_opportunity_id IS DISTINCT FROM OLD.source_opportunity_id
     OR (OLD.media_source = 'creator_network' AND NEW.creator_approval_recorded IS DISTINCT FROM OLD.creator_approval_recorded)) THEN
    RAISE EXCEPTION 'PN: Source metadata and import approvals are immutable.';
  END IF;
  IF _rpc OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  _allowed := CASE WHEN COALESCE(OLD.media_source, NEW.media_source) = 'creator_network' THEN ARRAY['caption','updated_at']
    ELSE ARRAY['caption','updated_at','rights_attested','rights_attestation','rights_platforms','rights_expires_at'] END;
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
    NEW.cn_licence_id := NULL; NEW.cn_production_job_id := NULL; NEW.creator_approval_recorded := false;
    NEW.source_master_path := NULL; NEW.source_master_etag := NULL; NEW.source_opportunity_id := NULL; NEW.rights_attested_by := NULL; NEW.rights_attested_at := NULL; NEW.created_by := auth.uid(); NEW.is_test := COALESCE(_test, false);
    IF NEW.rights_attested THEN NEW.rights_attested_by := auth.uid(); NEW.rights_attested_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'PN: Reviewed creative cannot be edited; add a new one.'; END IF;
  IF (to_jsonb(NEW) - _allowed) IS DISTINCT FROM (to_jsonb(OLD) - _allowed) THEN
    RAISE EXCEPTION 'PN: Only caption and draft rights fields can be edited; other fields change only through review.';
  END IF;
  IF NEW.rights_attested AND NOT OLD.rights_attested THEN NEW.rights_attested_by := auth.uid(); NEW.rights_attested_at := now(); END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_add_cn_creative(_campaign uuid, _job uuid, _licence uuid, _caption text, _rights_platforms text[], _rights_expires timestamp with time zone, _creator_approval boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _etag text; j record; l record; c record; nid uuid;
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
  SELECT o.metadata->>'eTag' INTO _etag FROM storage.objects o WHERE o.bucket_id='creator-network-assets' AND o.name=j.clean_master_path;
  IF _etag IS NULL THEN RAISE EXCEPTION 'PN: Clean master file not found in Creator Network storage.'; END IF;
  IF j.opportunity_id IS NULL THEN RAISE EXCEPTION 'PN: Production job has no opportunity.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  INSERT INTO public.private_network_creatives (source_master_path, source_master_etag, source_opportunity_id, campaign_id, media_type, media_source, storage_bucket, storage_path, caption, cn_production_job_id, cn_licence_id,
    creator_approval_recorded, rights_platforms, rights_expires_at, status, is_test, created_by)
  VALUES (j.clean_master_path, _etag, j.opportunity_id, _campaign, CASE WHEN j.video_project_id IS NOT NULL THEN 'video' ELSE 'image' END, 'creator_network', 'creator-network-assets', j.clean_master_path,
    left(_caption, 2000), _job, _licence, COALESCE(_creator_approval,false), COALESCE(_rights_platforms,'{}'), _rights_expires, 'pending', c.is_test, auth.uid())
  RETURNING id INTO nid;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('creative', nid, 'cn_master_added', jsonb_build_object('job', j.code, 'licence', _licence), c.is_test);
  RETURN nid;
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_creative_eligibility(_creative uuid, _platform text DEFAULT NULL::text)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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
      IF job.clean_master_path IS NULL THEN r := array_append(r, 'No clean master: watermarked previews are not distributable.');
      ELSE
        IF cr.storage_bucket IS DISTINCT FROM 'creator-network-assets' OR cr.storage_path IS DISTINCT FROM job.clean_master_path
           OR cr.source_master_path IS DISTINCT FROM job.clean_master_path THEN
          r := array_append(r, 'Snapshot master path no longer matches the job clean master.'); END IF;
        IF cr.source_master_etag IS NULL OR cr.source_master_etag IS DISTINCT FROM
           (SELECT o.metadata->>'eTag' FROM storage.objects o WHERE o.bucket_id='creator-network-assets' AND o.name=job.clean_master_path) THEN
          r := array_append(r, 'Clean master file changed or is missing since import.'); END IF;
      END IF;
      IF cr.source_opportunity_id IS NULL OR cr.source_opportunity_id IS DISTINCT FROM job.opportunity_id THEN
        r := array_append(r, 'Imported opportunity no longer matches the production job.'); END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.private_network_feed(_limit integer DEFAULT 12, _offset integer DEFAULT 0, _saved_only boolean DEFAULT false)
 RETURNS TABLE(creative_id uuid, campaign_id uuid, campaign_code text, campaign_name text, description text, brand_name text, brand_logo text, media_type text, media_source text, public_media_url text, caption text, base_fee_ngn numeric, action_bonus_ngn numeric, commission_pct numeric, ends_at timestamp with time zone, platforms text[], score integer, score_version text, reasons text[], liked boolean, saved boolean, my_placement_status text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
#variable_conflict use_column
DECLARE p record;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO p FROM public.private_network_publishers WHERE user_id = auth.uid();
  IF p.id IS NULL OR p.status <> 'approved' THEN RAISE EXCEPTION 'PN: Your publisher profile is not approved yet.'; END IF;
  _limit := LEAST(GREATEST(COALESCE(_limit,12),1),50); _offset := GREATEST(COALESCE(_offset,0),0);
  RETURN QUERY
  WITH cand AS (
    SELECT cr.id AS cid, c.*, cr.media_type AS mt, cr.media_source AS ms, cr.public_media_url AS pmu, cr.caption AS cap,
      b.name AS bname, b.logo_url AS blogo,
      ARRAY(SELECT x FROM (SELECT unnest(c.target_platforms) INTERSECT SELECT unnest(p.platforms)) q(x)
            WHERE cardinality(public.private_network_creative_eligibility(cr.id, x)) = 0 ORDER BY x) AS plats,
      (public.private_network_lower(p.languages) && public.private_network_lower(c.target_languages)) AS lang_ok,
      (public.private_network_lower(p.audience_geographies || ARRAY[p.location_country, p.location_state, p.location_city]) && public.private_network_lower(c.target_geographies)) AS geo_ok,
      (public.private_network_lower(p.interests || p.industries || p.communities) && public.private_network_lower(c.target_interests)) AS int_ok,
      ((p.audience_age_brackets || ARRAY[p.age_bracket]) && c.target_age_brackets) AS age_ok
    FROM public.private_network_creatives cr
    JOIN public.private_network_campaigns c ON c.id = cr.campaign_id
    JOIN public.brands b ON b.id = c.brand_id
    WHERE cr.status = 'approved' AND c.status = 'active' AND c.starts_at <= now() AND (c.ends_at IS NULL OR c.ends_at > now())
      AND c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn >= c.base_fee_ngn
      AND c.target_platforms && p.platforms
      AND (c.min_audience IS NULL OR COALESCE(p.audience_size_estimate,0) >= c.min_audience)
      AND c.is_test = p.is_test AND cr.is_test = p.is_test
      AND public.private_network_funding_ok(c.id)
      AND (NOT _saved_only OR EXISTS (SELECT 1 FROM public.private_network_saves s WHERE s.publisher_id = p.id AND s.creative_id = cr.id))
  ), scored AS (
    SELECT cand.*,
      (20 + CASE WHEN cardinality(target_languages)=0 THEN 10 WHEN lang_ok THEN 25 ELSE 0 END
          + CASE WHEN cardinality(target_geographies)=0 THEN 10 WHEN geo_ok THEN 25 ELSE 0 END
          + CASE WHEN cardinality(target_interests)=0 THEN 8 WHEN int_ok THEN 20 ELSE 0 END
          + CASE WHEN cardinality(target_age_brackets)=0 THEN 4 WHEN age_ok THEN 10 ELSE 0 END)::int AS sc,
      array_remove(ARRAY[
        'Platform: ' || array_to_string(plats, ', '),
        CASE WHEN lang_ok THEN 'Language matches the campaign' WHEN cardinality(target_languages)=0 THEN 'Any language' END,
        CASE WHEN geo_ok THEN 'Your audience location matches' WHEN cardinality(target_geographies)=0 THEN 'Any location' END,
        CASE WHEN int_ok THEN 'Your interests or communities match' END,
        CASE WHEN age_ok THEN 'Audience age matches' END
      ], NULL) AS rs
    FROM cand WHERE cardinality(cand.plats) > 0
  )
  SELECT s.cid, s.id, s.code, s.name, s.description, s.bname, s.blogo, s.mt, s.ms, s.pmu, s.cap, s.base_fee_ngn, s.action_bonus_ngn,
    s.conversion_commission_pct, s.ends_at, s.plats, s.sc, 'pn-match-v1'::text, s.rs,
    EXISTS (SELECT 1 FROM public.private_network_likes l WHERE l.publisher_id = p.id AND l.creative_id = s.cid),
    EXISTS (SELECT 1 FROM public.private_network_saves v WHERE v.publisher_id = p.id AND v.creative_id = s.cid),
    (SELECT pl.status FROM public.private_network_placements pl WHERE pl.publisher_id = p.id AND pl.creative_id = s.cid AND pl.status <> 'cancelled' ORDER BY pl.created_at DESC LIMIT 1)
  FROM scored s
  ORDER BY s.sc DESC, s.created_at DESC, s.cid
  LIMIT _limit OFFSET _offset;
END $function$;

DO $$ DECLARE f record;
  user_rpcs text[] := ARRAY['private_network_add_cn_creative','private_network_allow_domain','private_network_balance','private_network_campaign_transition',
    'private_network_cancel_placement','private_network_delete_profile','private_network_enabled','private_network_feed','private_network_is_operator',
    'private_network_list_cn_masters','private_network_mark_share','private_network_metrics','private_network_my_placements','private_network_my_publisher_id',
    'private_network_publish','private_network_record_funding','private_network_release_pending','private_network_request_payout','private_network_reverse_entry',
    'private_network_review_creative','private_network_review_payout','private_network_review_proof','private_network_review_publisher','private_network_review_reasons',
    'private_network_save_profile','private_network_set_enabled','private_network_set_member','private_network_submit_creator_link','private_network_submit_proof',
    'private_network_create_integration_key','private_network_revoke_integration_key','private_network_reconcile_event','private_network_top_up_budget'];
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname LIKE 'private_network%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    IF f.proname = ANY(user_rpcs) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig); END IF;
  END LOOP;
END $$;