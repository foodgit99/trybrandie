-- Add bonus cap tracking columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN bonus_earned_count integer NOT NULL DEFAULT 0,
  ADD COLUMN bonus_earned_reset_at timestamptz NOT NULL DEFAULT now();

-- Replace process_referral function with monthly cap logic
CREATE OR REPLACE FUNCTION public.process_referral(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code text;
  v_referrer_id uuid;
  v_referrer_email text;
  v_already_claimed boolean;
  v_bonus_earned_count integer;
  v_bonus_reset_at timestamptz;
BEGIN
  SELECT referred_by INTO v_referral_code
  FROM profiles WHERE user_id = p_user_id;

  IF v_referral_code IS NULL OR v_referral_code = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_referral');
  END IF;

  SELECT EXISTS(SELECT 1 FROM referral_rewards WHERE referred_user_id = p_user_id)
  INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;

  SELECT user_id INTO v_referrer_id
  FROM profiles WHERE referral_code = v_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  -- Check monthly bonus cap for the referrer
  SELECT bonus_earned_count, bonus_earned_reset_at INTO v_bonus_earned_count, v_bonus_reset_at
  FROM profiles WHERE user_id = v_referrer_id;

  -- Reset counter if we're in a new month
  IF v_bonus_reset_at < date_trunc('month', now()) THEN
    v_bonus_earned_count := 0;
    UPDATE profiles 
    SET bonus_earned_count = 0, bonus_earned_reset_at = now()
    WHERE user_id = v_referrer_id;
  END IF;

  -- Check if cap reached (3 bonus events per month)
  IF v_bonus_earned_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'monthly_bonus_cap_reached');
  END IF;

  SELECT email INTO v_referrer_email
  FROM auth.users WHERE id = v_referrer_id;

  -- Award credits and increment bonus earned count
  UPDATE profiles 
  SET bonus_credits = bonus_credits + 5, 
      bonus_earned_count = bonus_earned_count + 1
  WHERE user_id = v_referrer_id;

  INSERT INTO referral_rewards (referrer_user_id, referred_user_id, credits_awarded)
  VALUES (v_referrer_id, p_user_id, 5);

  RETURN jsonb_build_object('success', true, 'credits_awarded', 5, 'referrer_email', v_referrer_email);
END;
$function$;