
-- Add referral columns and bonus_credits to profiles
ALTER TABLE public.profiles
  ADD COLUMN referral_code text UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  ADD COLUMN referred_by text,
  ADD COLUMN bonus_credits integer NOT NULL DEFAULT 0;

-- Backfill referral_code for existing profiles that got NULL
UPDATE public.profiles SET referral_code = substr(gen_random_uuid()::text, 1, 8) WHERE referral_code IS NULL;

-- Create referral_rewards tracking table
CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  credits_awarded integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral rewards"
  ON public.referral_rewards FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

-- Update handle_new_user to store referred_by from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, referred_by)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'referred_by'
  );
  RETURN NEW;
END;
$function$;

-- Create security definer function to process referrals (avoids RLS issues)
CREATE OR REPLACE FUNCTION public.process_referral(p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code text;
  v_referrer_id uuid;
  v_already_claimed boolean;
BEGIN
  -- Get the referred_by code from the new user's profile
  SELECT referred_by INTO v_referral_code
  FROM profiles WHERE user_id = p_user_id;

  IF v_referral_code IS NULL OR v_referral_code = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_referral');
  END IF;

  -- Check if already claimed
  SELECT EXISTS(SELECT 1 FROM referral_rewards WHERE referred_user_id = p_user_id)
  INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_claimed');
  END IF;

  -- Find the referrer
  SELECT user_id INTO v_referrer_id
  FROM profiles WHERE referral_code = v_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  -- Prevent self-referral
  IF v_referrer_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  -- Award credits
  UPDATE profiles SET bonus_credits = bonus_credits + 5 WHERE user_id = v_referrer_id;

  -- Track the reward
  INSERT INTO referral_rewards (referrer_user_id, referred_user_id, credits_awarded)
  VALUES (v_referrer_id, p_user_id, 5);

  RETURN jsonb_build_object('success', true, 'credits_awarded', 5);
END;
$function$;
