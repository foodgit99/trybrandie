-- One canonical audit record per opportunity stage transition.
CREATE OR REPLACE FUNCTION public.creator_network_transition_opportunity(_opportunity_id uuid, _to text, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.creator_network_opportunities;
  ord text[] := ARRAY['Identified','Validated','Creative Strategy','Ready for Production','Producing','QA','Ready for Outreach','Outreach Sent','Engaged','Checkout','Won','Fulfilled'];
  roles text[];
  from_i int; to_i int;
  cr public.creator_network_creators;
  mt public.creator_network_matches;
  prev_stage text;
BEGIN
  SELECT * INTO o FROM public.creator_network_opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CN_TRANSITION: opportunity not found'; END IF;
  prev_stage := o.stage;
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
  VALUES ('human', auth.uid(), 'opportunity_transition', 'opportunity', o.id, prev_stage, _to, _reason, 'transition_rpc',
          CASE WHEN o.is_test THEN 'test' ELSE 'human' END, o.is_test);
  RETURN jsonb_build_object('id', o.id, 'stage', o.stage, 'outcome', o.outcome);
END $function$;

-- Generic logger skips opportunity stage updates made inside the transition RPC (the RPC writes the canonical row).
CREATE OR REPLACE FUNCTION public.creator_network_log_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE col text := TG_ARGV[0]; old_v text; new_v text; entity text := TG_ARGV[1];
BEGIN
  IF TG_TABLE_NAME = 'creator_network_opportunities' AND TG_OP = 'UPDATE'
     AND COALESCE(current_setting('creator_network.transition', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  new_v := to_jsonb(NEW) ->> col;
  IF TG_OP = 'UPDATE' THEN old_v := to_jsonb(OLD) ->> col; END IF;
  IF TG_OP = 'INSERT' OR old_v IS DISTINCT FROM new_v THEN
    INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, previous_state, new_state, reason, source, record_source, is_test)
    VALUES (CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'human' END, auth.uid(),
      CASE WHEN TG_OP='INSERT' THEN entity || '_created' ELSE entity || '_' || col || '_changed' END,
      entity, NEW.id, old_v, new_v,
      COALESCE(to_jsonb(NEW) ->> 'lost_reason', to_jsonb(NEW) ->> 'revocation_reason', to_jsonb(NEW) ->> 'blocker', to_jsonb(NEW) ->> 'reason'),
      TG_TABLE_NAME, CASE WHEN COALESCE((to_jsonb(NEW)->>'is_test')::boolean,false) THEN 'test' ELSE 'system' END,
      COALESCE((to_jsonb(NEW)->>'is_test')::boolean, false));
  END IF;
  RETURN NEW;
END $function$;