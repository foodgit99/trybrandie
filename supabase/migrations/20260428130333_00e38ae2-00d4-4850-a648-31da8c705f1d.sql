ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_category_series text,
  ADD COLUMN IF NOT EXISTS last_category_campaign text,
  ADD COLUMN IF NOT EXISTS last_category_idea text;