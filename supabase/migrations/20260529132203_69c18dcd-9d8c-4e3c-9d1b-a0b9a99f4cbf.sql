-- Background job queue for design generation
CREATE TABLE public.design_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid,
  kind text NOT NULL DEFAULT 'single',
  status text NOT NULL DEFAULT 'queued',
  progress int NOT NULL DEFAULT 0,
  stage text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX idx_design_jobs_user ON public.design_jobs(user_id, created_at DESC);
CREATE INDEX idx_design_jobs_status ON public.design_jobs(status) WHERE status IN ('queued','running');

GRANT SELECT, INSERT, UPDATE ON public.design_jobs TO authenticated;
GRANT ALL ON public.design_jobs TO service_role;

ALTER TABLE public.design_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own design jobs"
  ON public.design_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own design jobs"
  ON public.design_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_design_jobs_updated_at
  BEFORE UPDATE ON public.design_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for push updates to the client
ALTER TABLE public.design_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.design_jobs;