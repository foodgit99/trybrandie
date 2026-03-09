-- Remove pg_net email calls from handle_new_user (keep core logic)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_affiliate_code text;
  v_affiliate_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, referred_by)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'referred_by'
  );

  v_affiliate_code := NEW.raw_user_meta_data->>'affiliate_code';
  IF v_affiliate_code IS NOT NULL AND v_affiliate_code != '' THEN
    SELECT id INTO v_affiliate_id FROM public.affiliates WHERE affiliate_code = v_affiliate_code AND status = 'approved';
    IF v_affiliate_id IS NOT NULL THEN
      INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id)
      VALUES (v_affiliate_id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Remove pg_net email calls from process_referral (keep core logic, return referrer_email for frontend use)
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

  SELECT email INTO v_referrer_email
  FROM auth.users WHERE id = v_referrer_id;

  UPDATE profiles SET bonus_credits = bonus_credits + 5 WHERE user_id = v_referrer_id;

  INSERT INTO referral_rewards (referrer_user_id, referred_user_id, credits_awarded)
  VALUES (v_referrer_id, p_user_id, 5);

  RETURN jsonb_build_object('success', true, 'credits_awarded', 5, 'referrer_email', v_referrer_email);
END;
$function$;