
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS strategic_arc text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS v2_enabled boolean NOT NULL DEFAULT false;
