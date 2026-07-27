DROP FUNCTION IF EXISTS public.pause_dormant_autopilot(integer);

CREATE OR REPLACE FUNCTION public.pause_dormant_autopilot(p_days integer DEFAULT 15)
RETURNS TABLE (brand_id uuid, user_id uuid, brand_name text, email text, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH stale AS (
    SELECT s.brand_id AS bid,
           s.user_id AS uid,
           u.email::text AS mail,
           COALESCE(u.last_sign_in_at, u.created_at) AS last_seen
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
    WHERE s.brand_id = stale.bid
    RETURNING s.brand_id AS bid
  )
  SELECT st.bid, st.uid, b.name::text, st.mail, st.last_seen
  FROM updated up
  JOIN stale st ON st.bid = up.bid
  LEFT JOIN public.brands b ON b.id = st.bid;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_dormant_autopilot(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_dormant_autopilot(integer) TO service_role;