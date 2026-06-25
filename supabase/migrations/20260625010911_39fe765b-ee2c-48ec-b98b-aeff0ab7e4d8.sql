ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS product_ref uuid REFERENCES public.brand_products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_content_ideas_product_ref ON public.content_ideas(product_ref);