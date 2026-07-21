
ALTER TABLE public.brand_inspiration ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY brand_id ORDER BY created_at ASC) - 1 AS rn
  FROM public.brand_inspiration
)
UPDATE public.brand_inspiration bi SET position = r.rn FROM ranked r WHERE bi.id = r.id AND bi.position = 0;

CREATE INDEX IF NOT EXISTS brand_inspiration_brand_position_idx ON public.brand_inspiration(brand_id, position);
