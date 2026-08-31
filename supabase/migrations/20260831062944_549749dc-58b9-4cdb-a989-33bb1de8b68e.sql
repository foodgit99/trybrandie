ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS low_credits_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS credits_topped_up_at timestamptz;

CREATE OR REPLACE FUNCTION public.rearm_low_credit_notice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.paid_credits, 0) > COALESCE(OLD.paid_credits, 0)
     OR COALESCE(NEW.bonus_credits, 0) > COALESCE(OLD.bonus_credits, 0)
     OR COALESCE(NEW.generations_count, 0) < COALESCE(OLD.generations_count, 0) THEN
    NEW.credits_topped_up_at := now();
    NEW.low_credits_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rearm_low_credit_notice ON public.profiles;
CREATE TRIGGER trg_rearm_low_credit_notice
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.rearm_low_credit_notice();

CREATE OR REPLACE FUNCTION public.rearm_low_credit_notice_on_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_topped_up_at = now(), low_credits_notified_at = NULL
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rearm_low_credit_notice_reward ON public.credit_rewards;
CREATE TRIGGER trg_rearm_low_credit_notice_reward
AFTER INSERT ON public.credit_rewards
FOR EACH ROW EXECUTE FUNCTION public.rearm_low_credit_notice_on_reward();