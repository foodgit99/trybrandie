
-- Autopilot run history for observability
CREATE TABLE public.autopilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_time text NOT NULL,
  ideas_found integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.autopilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages autopilot runs"
  ON public.autopilot_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view autopilot runs"
  ON public.autopilot_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Per-idea event log
CREATE TABLE public.autopilot_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.autopilot_runs(id) ON DELETE CASCADE,
  idea_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autopilot_run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages autopilot run events"
  ON public.autopilot_run_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view autopilot run events"
  ON public.autopilot_run_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_autopilot_runs_started ON public.autopilot_runs(started_at DESC);
CREATE INDEX idx_autopilot_run_events_run ON public.autopilot_run_events(run_id);
