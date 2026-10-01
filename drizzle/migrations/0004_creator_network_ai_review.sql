ALTER TABLE public.creator_network_ai_runs ADD COLUMN IF NOT EXISTS reviewed_by uuid, ADD COLUMN IF NOT EXISTS reviewed_at timestamptz, ADD COLUMN IF NOT EXISTS review_decision text;
CREATE OR REPLACE FUNCTION public.creator_network_review_ai_run(_run_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.creator_network_ai_runs;
BEGIN
  IF NOT public.creator_network_can(NULL) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _decision NOT IN ('Accepted','Rejected') THEN RAISE EXCEPTION 'Decision must be Accepted or Rejected'; END IF;
  SELECT * INTO r FROM public.creator_network_ai_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI run not found'; END IF;
  IF r.status <> 'Needs Review' THEN RAISE EXCEPTION 'Only runs that need review can be reviewed'; END IF;
  UPDATE public.creator_network_ai_runs SET status='Completed', reviewed_by=auth.uid(), reviewed_at=now(), review_decision=_decision WHERE id=_run_id;
  INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, previous_state, new_state, source, record_source, is_test)
  VALUES ('human', auth.uid(), 'ai_run_reviewed', 'ai_run', _run_id, 'Needs Review', _decision, 'ai_work', CASE WHEN r.is_test THEN 'test' ELSE 'human' END, r.is_test);
END $$;
GRANT EXECUTE ON FUNCTION public.creator_network_review_ai_run(uuid, text) TO authenticated;