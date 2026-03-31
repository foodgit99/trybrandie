ALTER TABLE public.brand_products ADD COLUMN IF NOT EXISTS duration text NOT NULL DEFAULT '';
ALTER TABLE public.brand_products ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT '';