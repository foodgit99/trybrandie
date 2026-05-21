ALTER TABLE public.content_ideas ADD COLUMN slide_count INT CHECK (slide_count BETWEEN 2 AND 10);
ALTER TABLE public.autopilot_run_events ADD COLUMN metadata JSONB;