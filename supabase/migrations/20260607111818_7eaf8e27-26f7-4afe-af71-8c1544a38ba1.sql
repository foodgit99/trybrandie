
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS primary_channel text,
  ADD COLUMN IF NOT EXISTS channel_handle text,
  ADD COLUMN IF NOT EXISTS channel_url text,
  ADD COLUMN IF NOT EXISTS audience_size text,
  ADD COLUMN IF NOT EXISTS audience_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS regions text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS used_brandie boolean,
  ADD COLUMN IF NOT EXISTS brandie_experience text,
  ADD COLUMN IF NOT EXISTS promo_plan text,
  ADD COLUMN IF NOT EXISTS content_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS posting_cadence text,
  ADD COLUMN IF NOT EXISTS why_join text,
  ADD COLUMN IF NOT EXISTS agreed_disclosure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreed_terms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS application_submitted_at timestamptz;
