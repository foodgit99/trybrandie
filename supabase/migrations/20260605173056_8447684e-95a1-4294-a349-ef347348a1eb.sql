ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_nudge_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_weekly_recap_at timestamptz;