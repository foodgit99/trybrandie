
CREATE TABLE public.design_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  image_url text,
  attached_image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.design_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own design messages"
ON public.design_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own design messages"
ON public.design_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own design messages"
ON public.design_messages FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_design_messages_design_id ON public.design_messages(design_id);
CREATE INDEX idx_design_messages_created_at ON public.design_messages(design_id, created_at);
