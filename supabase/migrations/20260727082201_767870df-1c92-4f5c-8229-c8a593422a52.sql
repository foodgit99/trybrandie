ALTER TABLE public.autopilot_settings
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE OR REPLACE FUNCTION public.pause_dormant_autopilot(p_days integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH stale AS (
    SELECT s.brand_id
    FROM public.autopilot_settings s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.enabled = true
      AND COALESCE(u.last_sign_in_at, u.created_at) < now() - make_interval(days => p_days)
  ), updated AS (
    UPDATE public.autopilot_settings s
    SET enabled = false,
        paused_reason = 'dormant_user',
        paused_at = now()
    FROM stale
    WHERE s.brand_id = stale.brand_id
    RETURNING s.brand_id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_dormant_autopilot(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_dormant_autopilot(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.is_user_dormant(_user_id uuid, _days integer DEFAULT 15)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND COALESCE(u.last_sign_in_at, u.created_at) < now() - make_interval(days => _days)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_dormant(uuid, integer) TO authenticated, service_role;