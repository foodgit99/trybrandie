
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS content_category text;
ALTER TABLE public.content_pillars ADD COLUMN IF NOT EXISTS content_category text;
ALTER TABLE public.post_series ADD COLUMN IF NOT EXISTS content_category text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS content_category text;
