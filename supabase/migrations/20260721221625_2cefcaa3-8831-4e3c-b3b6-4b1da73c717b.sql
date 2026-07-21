ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS report_title text,
  ADD COLUMN IF NOT EXISTS report_accent_color text,
  ADD COLUMN IF NOT EXISTS report_logo_url text;