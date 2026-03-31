ALTER TABLE public.video_scenes ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS rendered_video_url text;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'pending';