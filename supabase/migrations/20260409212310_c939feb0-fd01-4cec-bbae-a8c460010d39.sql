-- Atomic lock function for autopilot idea processing
CREATE OR REPLACE FUNCTION public.lock_autopilot_idea(p_idea_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE content_ideas
  SET autopilot_status = 'processing'
  WHERE id = p_idea_id
    AND (autopilot_status IS NULL
      OR autopilot_status NOT IN ('processing', 'completed'))
  RETURNING id;
$$;