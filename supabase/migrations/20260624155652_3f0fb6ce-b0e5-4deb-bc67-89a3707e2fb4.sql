ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS quality_score jsonb,
  ADD COLUMN IF NOT EXISTS quality_signals jsonb;