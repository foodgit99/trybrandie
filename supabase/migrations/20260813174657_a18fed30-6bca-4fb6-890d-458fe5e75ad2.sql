ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_active ON public.campaigns (brand_id, is_active);