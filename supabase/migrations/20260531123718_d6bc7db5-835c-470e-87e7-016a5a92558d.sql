-- Phase 4: per-brand gene lock policy
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS gene_lock_policy JSONB;

-- Phase 5: persisted layout schema for real edits
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS layout_schema JSONB;
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS creative_director_version TEXT;

-- Phase 6: feedback weights table
CREATE TABLE IF NOT EXISTS public.genome_preset_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, category, preset_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genome_preset_weights TO authenticated;
GRANT ALL ON public.genome_preset_weights TO service_role;

ALTER TABLE public.genome_preset_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage weights for own brands"
ON public.genome_preset_weights
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = genome_preset_weights.brand_id AND b.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = genome_preset_weights.brand_id AND b.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_gpw_brand_cat ON public.genome_preset_weights (brand_id, category);