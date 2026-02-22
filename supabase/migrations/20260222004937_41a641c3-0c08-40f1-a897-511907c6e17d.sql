
ALTER TABLE public.profiles
ADD COLUMN generations_count integer NOT NULL DEFAULT 0,
ADD COLUMN generations_reset_at timestamptz NOT NULL DEFAULT now();
