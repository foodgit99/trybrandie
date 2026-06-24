ALTER TABLE public.autopilot_settings
ADD COLUMN IF NOT EXISTS default_canvas_size text
  CHECK (default_canvas_size IS NULL OR default_canvas_size IN ('1080x1080','1080x1350','1080x1920'));