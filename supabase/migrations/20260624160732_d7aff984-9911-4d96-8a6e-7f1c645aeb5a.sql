ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS arc_role text,
  ADD COLUMN IF NOT EXISTS slide_label text,
  ADD COLUMN IF NOT EXISTS narrative_thread text;