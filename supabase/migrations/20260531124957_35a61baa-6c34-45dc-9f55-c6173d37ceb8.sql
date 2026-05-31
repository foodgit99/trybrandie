-- Phase 6: Genome preset feedback loop
-- RPC to adjust genome_preset_weights when a user votes on a design.
-- Reads preset_id from designs.genome->>'preset_id' and adjusts weight
-- by +0.1 (upvote) / -0.1 (downvote), clamped to [0.1, 3.0].
-- If the row doesn't exist it is inserted starting from 1.0.

CREATE OR REPLACE FUNCTION public.record_preset_feedback(
  p_design_id uuid,
  p_vote integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_user_id uuid;
  v_preset_id text;
  v_delta numeric;
BEGIN
  IF p_vote NOT IN (-1, 0, 1) THEN
    RETURN;
  END IF;
  IF p_vote = 0 THEN
    RETURN;
  END IF;

  SELECT brand_id, user_id, genome->>'preset_id'
    INTO v_brand_id, v_user_id, v_preset_id
  FROM public.designs
  WHERE id = p_design_id;

  IF v_brand_id IS NULL OR v_preset_id IS NULL OR v_preset_id = '' THEN
    RETURN;
  END IF;

  -- Ownership check: only the brand owner can move their weights
  IF NOT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = v_brand_id AND b.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  v_delta := CASE WHEN p_vote = 1 THEN 0.1 ELSE -0.1 END;

  INSERT INTO public.genome_preset_weights (brand_id, preset_id, category, weight)
  VALUES (v_brand_id, v_preset_id, 'all', GREATEST(0.1, LEAST(3.0, 1.0 + v_delta)))
  ON CONFLICT (brand_id, preset_id, category)
  DO UPDATE SET
    weight = GREATEST(0.1, LEAST(3.0, public.genome_preset_weights.weight + v_delta)),
    updated_at = now();
END;
$$;

-- Ensure unique constraint exists for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'genome_preset_weights_brand_preset_category_key'
  ) THEN
    ALTER TABLE public.genome_preset_weights
      ADD CONSTRAINT genome_preset_weights_brand_preset_category_key
      UNIQUE (brand_id, preset_id, category);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.record_preset_feedback(uuid, integer) TO authenticated;