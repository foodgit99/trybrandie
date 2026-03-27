ALTER TABLE public.profiles 
  ADD COLUMN content_hub_gen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN content_hub_gen_reset_at timestamptz NOT NULL DEFAULT now();