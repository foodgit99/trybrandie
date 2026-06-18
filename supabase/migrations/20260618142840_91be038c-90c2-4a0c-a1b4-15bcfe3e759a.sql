ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS content_idea_id uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS designs_brand_idea_idx ON public.designs(brand_id, content_idea_id);
CREATE INDEX IF NOT EXISTS designs_content_idea_idx ON public.designs(content_idea_id);