ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS gallery_labels_used text[],
  ADD COLUMN IF NOT EXISTS content_category text;

CREATE INDEX IF NOT EXISTS designs_brand_category_idx
  ON public.designs (brand_id, content_category, created_at DESC);