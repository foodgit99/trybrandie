
-- 1. Affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  affiliate_code text NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  status text NOT NULL DEFAULT 'pending',
  commission_rate numeric NOT NULL DEFAULT 0.20,
  total_earned numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  bank_name text,
  account_number text,
  account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own row" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Affiliates can update own row" ON public.affiliates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert affiliate" ON public.affiliates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Affiliate referrals
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'signed_up',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own referrals" ON public.affiliate_referrals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_referrals.affiliate_id AND user_id = auth.uid()));

-- 3. Affiliate commissions
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.affiliate_referrals(id),
  payment_reference text,
  payment_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own commissions" ON public.affiliate_commissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_commissions.affiliate_id AND user_id = auth.uid()));

-- 4. Affiliate payouts
CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own payouts" ON public.affiliate_payouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_payouts.affiliate_id AND user_id = auth.uid()));
CREATE POLICY "Affiliates can request payouts" ON public.affiliate_payouts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_payouts.affiliate_id AND user_id = auth.uid()));

-- 5. Update handle_new_user to track affiliate referrals
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Check for affiliate code
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
$$;

-- updated_at trigger for affiliates
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
