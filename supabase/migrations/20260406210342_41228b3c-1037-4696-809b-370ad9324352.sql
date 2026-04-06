
-- Add recruited_by to affiliates (tracks which affiliate recruited this one)
ALTER TABLE public.affiliates
  ADD COLUMN recruited_by uuid REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- Add commission_type to affiliate_commissions
ALTER TABLE public.affiliate_commissions
  ADD COLUMN commission_type text NOT NULL DEFAULT 'tier1_first';

-- Add payment_count to affiliate_referrals (0 = no payments yet)
ALTER TABLE public.affiliate_referrals
  ADD COLUMN payment_count integer NOT NULL DEFAULT 0;
