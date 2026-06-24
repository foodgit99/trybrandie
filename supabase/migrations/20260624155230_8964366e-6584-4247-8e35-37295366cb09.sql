ALTER TABLE public.content_pillars ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS canvas_size text;