ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trend_intel_gen_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trend_intel_gen_reset_at timestamptz NOT NULL DEFAULT now();