
CREATE OR REPLACE FUNCTION public.increment_affiliate_earned(p_affiliate_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.affiliates
  SET total_earned = total_earned + p_amount
  WHERE id = p_affiliate_id;
END;
$$;
