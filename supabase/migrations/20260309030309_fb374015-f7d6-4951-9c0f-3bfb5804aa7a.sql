
-- Create brand_products table
CREATE TABLE public.brand_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;

-- RLS policies (mirroring brand_inspiration)
CREATE POLICY "Users can view their brand products"
  ON public.brand_products FOR SELECT
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_products.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can insert their brand products"
  ON public.brand_products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_products.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can delete their brand products"
  ON public.brand_products FOR DELETE
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_products.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Admins can view all brand products"
  ON public.brand_products FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete brand products"
  ON public.brand_products FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create dedicated storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-products', 'brand-products', true);

-- Storage RLS policies
CREATE POLICY "Users can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-products' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-products');

CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-products' AND auth.uid()::text = (storage.foldername(name))[1]);
