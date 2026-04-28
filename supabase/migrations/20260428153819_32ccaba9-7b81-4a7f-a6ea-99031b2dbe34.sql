ALTER TABLE public.brand_updates
  ADD COLUMN IF NOT EXISTS confidence integer,
  ADD COLUMN IF NOT EXISTS missing_fields text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.brand_updates
  DROP CONSTRAINT IF EXISTS brand_updates_confidence_range;
ALTER TABLE public.brand_updates
  ADD CONSTRAINT brand_updates_confidence_range
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100));

CREATE INDEX IF NOT EXISTS brand_updates_brand_status_conf_idx
  ON public.brand_updates (brand_id, status, confidence DESC);