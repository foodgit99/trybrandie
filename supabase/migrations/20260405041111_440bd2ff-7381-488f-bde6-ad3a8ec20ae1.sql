CREATE TABLE public.design_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  user_id uuid NOT NULL,
  spans jsonb DEFAULT '[]'::jsonb,
  total_latency_ms integer,
  total_input_tokens integer DEFAULT 0,
  total_output_tokens integer DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.design_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traces" ON public.design_traces FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all traces" ON public.design_traces FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages traces" ON public.design_traces FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_design_traces_user ON public.design_traces(user_id);
CREATE INDEX idx_design_traces_created ON public.design_traces(created_at);