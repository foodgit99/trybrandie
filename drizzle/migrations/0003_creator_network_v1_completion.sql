-- Creator Network V1 completion: role-scoped writes, canonical opportunity transitions, audit coverage.

CREATE OR REPLACE FUNCTION public.creator_network_can_any(_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.creator_network_enabled() AND auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.creator_network_members m
               WHERE m.user_id = auth.uid() AND (m.role = 'admin' OR m.role = ANY(_roles))))
$$;
GRANT EXECUTE ON FUNCTION public.creator_network_can_any(text[]) TO authenticated;

-- Additive columns for the production / outreach gates
ALTER TABLE public.creator_network_production_jobs ADD COLUMN IF NOT EXISTS output_url text;
ALTER TABLE public.creator_network_sales ADD COLUMN IF NOT EXISTS outreach_approved_by uuid;
ALTER TABLE public.creator_network_sales ADD COLUMN IF NOT EXISTS outreach_approved_at timestamptz;

-- Role-scoped write policies (admin always allowed through creator_network_can_any)
DO $$
DECLARE t text; r text[];
BEGIN
  FOR t, r IN SELECT * FROM (VALUES
    ('creator_network_creators', ARRAY['research','partnerships']),
    ('creator_network_audience_profiles', ARRAY['research']),
    ('creator_network_validations', ARRAY['partnerships']),
    ('creator_network_interviews', ARRAY['partnerships']),
    ('creator_network_licences', ARRAY['partnerships']),
    ('creator_network_brand_safety_reviews', ARRAY['partnerships','research']),
    ('creator_network_prospects', ARRAY['research','sales']),
    ('creator_network_prospect_products', ARRAY['research']),
    ('creator_network_matches', ARRAY['research']),
    ('creator_network_findings', ARRAY['research']),
    ('creator_network_opportunities', ARRAY['research','partnerships','production','sales']),
    ('creator_network_concepts', ARRAY['production']),
    ('creator_network_production_jobs', ARRAY['production']),
    ('creator_network_production_reviews', ARRAY['production']),
    ('creator_network_sales', ARRAY['sales']),
    ('creator_network_tasks', ARRAY['research','partnerships','production','sales']),
    ('creator_network_ai_runs', ARRAY[]::text[]),
    ('creator_network_earnings', ARRAY[]::text[]),
    ('creator_network_payouts', ARRAY[]::text[]),
    ('creator_network_experiments', ARRAY[]::text[])
  ) v(a,b) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "cn insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "cn update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "cn insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.creator_network_can_any(%L::text[]))', t, r);
    EXECUTE format('CREATE POLICY "cn update" ON public.%I FOR UPDATE TO authenticated USING (public.creator_network_can_any(%L::text[])) WITH CHECK (public.creator_network_can_any(%L::text[]))', t, r, r);
  END LOOP;
END $$;
-- Findings stay immutable except via supersession RPC (admin direct edit only)
DROP POLICY IF EXISTS "cn update" ON public.creator_network_findings;
CREATE POLICY "cn update" ON public.creator_network_findings FOR UPDATE TO authenticated
  USING (public.creator_network_can('admin')) WITH CHECK (public.creator_network_can('admin'));

-- Storage: uploads by production/partnerships only
DROP POLICY IF EXISTS "cn assets write" ON storage.objects;
CREATE POLICY "cn assets write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'creator-network-assets' AND public.creator_network_can_any(ARRAY['production','partnerships']));
DROP POLICY IF EXISTS "cn assets update" ON storage.objects;
CREATE POLICY "cn assets update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'creator-network-assets' AND public.creator_network_can_any(ARRAY['production','partnerships']));

-- Opportunity stage may only change through the canonical transition RPC
CREATE OR REPLACE FUNCTION public.creator_network_guard_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('creator_network.transition', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.stage <> 'Identified' THEN
    RAISE EXCEPTION 'CN_TRANSITION: new opportunities start at Identified';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    RAISE EXCEPTION 'CN_TRANSITION: stage changes must use the transition operation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cn_guard_stage ON public.creator_network_opportunities;
CREATE TRIGGER cn_guard_stage BEFORE INSERT OR UPDATE ON public.creator_network_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_guard_stage();

-- Sales no longer move opportunity stages implicitly; they only create earnings.
CREATE OR REPLACE FUNCTION public.creator_network_after_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'Paid' AND NEW.creator_id IS NOT NULL AND COALESCE(NEW.creator_royalty,0) > 0 THEN
    INSERT INTO public.creator_network_earnings(creator_id, opportunity_id, sale_id, earning_type, royalty, gross_sale_amount, payable_amount, currency, record_source, is_test)
    VALUES (NEW.creator_id, NEW.opportunity_id, NEW.id, 'Royalty', NEW.creator_royalty, NEW.paid_amount, NEW.creator_royalty, NEW.currency,
            CASE WHEN NEW.is_test THEN 'test' ELSE 'system' END, NEW.is_test)
    ON CONFLICT (sale_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.creator_network_transition_opportunity(_opportunity_id uuid, _to text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.creator_network_opportunities;
  ord text[] := ARRAY['Identified','Validated','Creative Strategy','Ready for Production','Producing','QA','Ready for Outreach','Outreach Sent','Engaged','Checkout','Won','Fulfilled'];
  roles text[];
  from_i int; to_i int;
  cr public.creator_network_creators;
  mt public.creator_network_matches;
BEGIN
  SELECT * INTO o FROM public.creator_network_opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CN_TRANSITION: opportunity not found'; END IF;
  IF o.stage IN ('Lost','Fulfilled') THEN RAISE EXCEPTION 'CN_TRANSITION: % is terminal', o.stage; END IF;

  roles := CASE _to
    WHEN 'Validated' THEN ARRAY['research','partnerships']
    WHEN 'Creative Strategy' THEN ARRAY['research','partnerships','production']
    WHEN 'Ready for Production' THEN ARRAY['production']
    WHEN 'Producing' THEN ARRAY['production']
    WHEN 'QA' THEN ARRAY['production']
    WHEN 'Ready for Outreach' THEN ARRAY['production']
    WHEN 'Outreach Sent' THEN ARRAY['sales']
    WHEN 'Engaged' THEN ARRAY['sales']
    WHEN 'Checkout' THEN ARRAY['sales']
    WHEN 'Won' THEN ARRAY['sales']
    WHEN 'Fulfilled' THEN ARRAY['sales','production']
    WHEN 'Lost' THEN ARRAY['research','partnerships','production','sales']
    ELSE NULL END;
  IF roles IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: unknown stage %', _to; END IF;
  IF NOT public.creator_network_can_any(roles) THEN RAISE EXCEPTION 'CN_TRANSITION: your Creator Network role cannot move opportunities to %', _to; END IF;

  IF _to = 'Lost' THEN
    IF COALESCE(trim(_reason),'') = '' THEN RAISE EXCEPTION 'CN_TRANSITION: a Lost reason is required'; END IF;
  ELSE
    from_i := array_position(ord, o.stage); to_i := array_position(ord, _to);
    IF to_i IS DISTINCT FROM from_i + 1 THEN
      RAISE EXCEPTION 'CN_TRANSITION: % cannot move to % (next allowed: %)', o.stage, _to, ord[from_i + 1];
    END IF;
    SELECT * INTO cr FROM public.creator_network_creators WHERE id = o.creator_id;

    IF _to = 'Validated' THEN
      IF cr.id IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: creator missing'; END IF;
      IF o.brand_id IS NULL AND o.prospect_id IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: business or prospect missing'; END IF;
      IF o.product_id IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: product missing'; END IF;
      SELECT * INTO mt FROM public.creator_network_matches WHERE id = o.match_id;
      IF mt.id IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: a match is required'; END IF;
      IF COALESCE(trim(mt.reasoning),'') = '' OR mt.confidence IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: match needs reasoning and confidence'; END IF;
    ELSIF _to = 'Creative Strategy' THEN
      IF cr.brand_safety_status = 'Flagged' OR cr.status IN ('Paused','Rejected') THEN
        RAISE EXCEPTION 'CN_TRANSITION: creator is no longer eligible (status %, safety %)', cr.status, cr.brand_safety_status; END IF;
    ELSIF _to = 'Ready for Production' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_concepts c WHERE c.opportunity_id = o.id AND c.status = 'Approved' AND c.approved_by IS NOT NULL) THEN
        RAISE EXCEPTION 'CN_TRANSITION: a human-approved concept is required'; END IF;
    ELSIF _to = 'Producing' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_licences l WHERE l.creator_id = o.creator_id AND l.likeness_permission
          AND NOT l.revoked AND l.status IN ('Negotiating','Signed','Active') AND (l.expires_at IS NULL OR l.expires_at >= current_date)) THEN
        RAISE EXCEPTION 'CN_TRANSITION: creator has not granted likeness permission for a private preview'; END IF;
      IF cr.profile_image_path IS NULL THEN RAISE EXCEPTION 'CN_TRANSITION: creator reference asset (profile image) is required'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_jobs j WHERE j.opportunity_id = o.id) THEN
        RAISE EXCEPTION 'CN_TRANSITION: create a production job first'; END IF;
    ELSIF _to = 'QA' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_jobs j WHERE j.opportunity_id = o.id AND (j.output_url IS NOT NULL OR j.preview_path IS NOT NULL)) THEN
        RAISE EXCEPTION 'CN_TRANSITION: no production output yet'; END IF;
    ELSIF _to = 'Ready for Outreach' THEN
      IF o.blocker IS NOT NULL THEN RAISE EXCEPTION 'CN_TRANSITION: unresolved blocker: %', o.blocker; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_jobs j
          WHERE j.opportunity_id = o.id AND j.preview_path IS NOT NULL AND NOT j.blocked
            AND EXISTS (SELECT 1 FROM public.creator_network_production_reviews r WHERE r.job_id = j.id AND r.stage = 'Human QA' AND r.decision = 'Approve')) THEN
        RAISE EXCEPTION 'CN_TRANSITION: needs a watermarked preview and a Human QA approval'; END IF;
    ELSIF _to = 'Outreach Sent' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_sales s WHERE s.opportunity_id = o.id AND s.outreach_approved_at IS NOT NULL AND s.sent_at IS NOT NULL) THEN
        RAISE EXCEPTION 'CN_TRANSITION: needs an approved outreach package marked as sent by a human'; END IF;
    ELSIF _to = 'Engaged' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_sales s WHERE s.opportunity_id = o.id AND COALESCE(trim(s.response),'') <> '') THEN
        RAISE EXCEPTION 'CN_TRANSITION: record the business response first'; END IF;
    ELSIF _to = 'Checkout' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_sales s WHERE s.opportunity_id = o.id
          AND (s.response_classification IN ('Interested','Negotiating','Won') OR s.status IN ('Negotiating','Won'))) THEN
        RAISE EXCEPTION 'CN_TRANSITION: needs purchase intent (Interested/Negotiating)'; END IF;
    ELSIF _to = 'Won' THEN
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_sales s WHERE s.opportunity_id = o.id AND s.payment_status = 'Paid') THEN
        RAISE EXCEPTION 'CN_TRANSITION: payment must be recorded as Paid'; END IF;
    ELSIF _to = 'Fulfilled' THEN
      IF NOT public.creator_network_has_commercial_licence(o.creator_id) THEN
        RAISE EXCEPTION 'CN_TRANSITION: no active commercial licence for this creator'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_jobs j WHERE j.opportunity_id = o.id AND j.clean_master_path IS NOT NULL AND j.rights_mode = 'Commercial') THEN
        RAISE EXCEPTION 'CN_TRANSITION: clean master not delivered'; END IF;
      IF EXISTS (SELECT 1 FROM public.creator_network_sales s WHERE s.opportunity_id = o.id AND s.payment_status = 'Paid' AND COALESCE(s.creator_royalty,0) > 0
          AND NOT EXISTS (SELECT 1 FROM public.creator_network_earnings e WHERE e.sale_id = s.id)) THEN
        RAISE EXCEPTION 'CN_TRANSITION: creator earning record missing'; END IF;
    END IF;
  END IF;

  PERFORM set_config('creator_network.transition', 'on', true);
  UPDATE public.creator_network_opportunities SET stage = _to,
    lost_reason = CASE WHEN _to = 'Lost' THEN _reason ELSE lost_reason END,
    outcome = CASE WHEN _to IN ('Won','Lost','Fulfilled') THEN _to ELSE outcome END
  WHERE id = o.id RETURNING * INTO o;
  PERFORM set_config('creator_network.transition', 'off', true);

  INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, previous_state, new_state, reason, source, record_source, is_test)
  VALUES ('human', auth.uid(), 'opportunity_transition', 'opportunity', o.id, (SELECT stage FROM (SELECT 1) x(y), LATERAL (SELECT NULL::text) z(stage)), _to, _reason, 'transition_rpc',
          CASE WHEN o.is_test THEN 'test' ELSE 'human' END, o.is_test);
  RETURN jsonb_build_object('id', o.id, 'stage', o.stage, 'outcome', o.outcome);
END $$;
GRANT EXECUTE ON FUNCTION public.creator_network_transition_opportunity(uuid, text, text) TO authenticated;

-- Approve outreach package (sales/admin), stamps approver
CREATE OR REPLACE FUNCTION public.creator_network_approve_outreach(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.creator_network_sales;
BEGIN
  IF NOT public.creator_network_can_any(ARRAY['sales']) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO s FROM public.creator_network_sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF COALESCE(trim(s.outreach_message),'') = '' THEN RAISE EXCEPTION 'Write the outreach message first'; END IF;
  UPDATE public.creator_network_sales SET outreach_approved_by = auth.uid(), outreach_approved_at = now() WHERE id = _sale_id;
  INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, new_state, source, record_source, is_test)
  VALUES ('human', auth.uid(), 'outreach_package_approved', 'sale', _sale_id, 'Approved', 'sales', CASE WHEN s.is_test THEN 'test' ELSE 'human' END, s.is_test);
END $$;
GRANT EXECUTE ON FUNCTION public.creator_network_approve_outreach(uuid) TO authenticated;

-- Extra material-mutation audit triggers
DROP TRIGGER IF EXISTS cn_log_contact ON public.creator_network_creators;
CREATE TRIGGER cn_log_contact AFTER UPDATE OF contact_status ON public.creator_network_creators
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_log_transition('contact_status', 'creator');
DROP TRIGGER IF EXISTS cn_log_payment ON public.creator_network_sales;
CREATE TRIGGER cn_log_payment AFTER UPDATE OF payment_status ON public.creator_network_sales
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_log_transition('payment_status', 'sale');
DROP TRIGGER IF EXISTS cn_log_response ON public.creator_network_sales;
CREATE TRIGGER cn_log_response AFTER UPDATE OF response_classification ON public.creator_network_sales
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_log_transition('response_classification', 'sale');
DROP TRIGGER IF EXISTS cn_log_preview ON public.creator_network_production_jobs;
CREATE TRIGGER cn_log_preview AFTER UPDATE OF preview_path, clean_master_path ON public.creator_network_production_jobs
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_log_transition('preview_path', 'production_job');
DROP TRIGGER IF EXISTS cn_log_revoke ON public.creator_network_licences;
CREATE TRIGGER cn_log_revoke AFTER UPDATE OF revoked ON public.creator_network_licences
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_log_transition('revoked', 'licence');