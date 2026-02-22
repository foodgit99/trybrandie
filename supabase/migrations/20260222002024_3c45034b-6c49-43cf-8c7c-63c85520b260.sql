
-- Brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  vibe TEXT CHECK (vibe IN ('Minimal', 'Bold', 'Luxury', 'Playful', 'Corporate', 'Cinematic')),
  primary_colors TEXT[] DEFAULT '{}',
  secondary_colors TEXT[] DEFAULT '{}',
  accent_colors TEXT[] DEFAULT '{}',
  typography_primary TEXT,
  typography_secondary TEXT,
  typography_display TEXT,
  logo_url TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brands" ON public.brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own brands" ON public.brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own brands" ON public.brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brands" ON public.brands FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Brand inspiration table
CREATE TABLE public.brand_inspiration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_inspiration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their brand inspiration" ON public.brand_inspiration FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_inspiration.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can insert their brand inspiration" ON public.brand_inspiration FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_inspiration.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can delete their brand inspiration" ON public.brand_inspiration FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_inspiration.brand_id AND brands.user_id = auth.uid()));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-logos', 'brand-logos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-inspiration', 'brand-inspiration', true);

-- Storage policies for brand-logos
CREATE POLICY "Users can upload their own logos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view logos" ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-logos');
CREATE POLICY "Users can update their own logos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own logos" ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for brand-inspiration
CREATE POLICY "Users can upload their own inspiration" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-inspiration' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view inspiration" ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-inspiration');
CREATE POLICY "Users can delete their own inspiration" ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-inspiration' AND auth.uid()::text = (storage.foldername(name))[1]);
