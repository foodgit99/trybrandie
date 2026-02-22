
-- Designs table for saving generated designs
CREATE TABLE public.designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title TEXT,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  canvas_size TEXT NOT NULL DEFAULT '1080x1080',
  vote SMALLINT DEFAULT 0 CHECK (vote IN (-1, 0, 1)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own designs" ON public.designs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own designs" ON public.designs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own designs" ON public.designs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own designs" ON public.designs FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for generated designs
INSERT INTO storage.buckets (id, name, public) VALUES ('designs', 'designs', true);

CREATE POLICY "Users can upload designs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view designs" ON storage.objects FOR SELECT
  USING (bucket_id = 'designs');
CREATE POLICY "Users can delete their designs" ON storage.objects FOR DELETE
  USING (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);
