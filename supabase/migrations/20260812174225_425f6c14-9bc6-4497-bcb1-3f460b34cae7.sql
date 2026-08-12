ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_delivery_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id uuid,
  to_number text NOT NULL,
  message_sid text,
  status text NOT NULL DEFAULT 'queued',
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_deliveries_idea_unique
  ON public.whatsapp_deliveries (idea_id) WHERE idea_id IS NOT NULL;

GRANT SELECT ON public.whatsapp_deliveries TO authenticated;
GRANT ALL ON public.whatsapp_deliveries TO service_role;

ALTER TABLE public.whatsapp_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own whatsapp deliveries"
  ON public.whatsapp_deliveries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);