-- Cache table for LLM-extracted chat preference tags
CREATE TABLE public.chat_preference_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_preference_cache ENABLE ROW LEVEL SECURITY;

-- Only the edge function (service role) reads/writes this table
-- No user-facing RLS policies needed, but add admin read access
CREATE POLICY "Service role manages cache" ON public.chat_preference_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view cache" ON public.chat_preference_cache
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));