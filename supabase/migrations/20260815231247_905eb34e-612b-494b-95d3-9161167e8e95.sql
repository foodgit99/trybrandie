CREATE TABLE public.partner_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  credits_per_signup integer NOT NULL,
  total_budget_credits integer NOT NULL,
  credits_granted integer NOT NULL DEFAULT 0,
  leads_credited integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  request_note text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.partner_credit_grants TO authenticated;
GRANT ALL ON public.partner_credit_grants TO service_role;

ALTER TABLE public.partner_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view their own credit grants"
  ON public.partner_credit_grants FOR SELECT
  TO authenticated
  USING (partner_id = public.partner_id_for_user(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners request their own credit grants"
  ON public.partner_credit_grants FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id = public.partner_id_for_user(auth.uid())
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND credits_granted = 0
    AND leads_credited = 0
  );

CREATE POLICY "Admins manage credit grants"
  ON public.partner_credit_grants FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages credit grants"
  ON public.partner_credit_grants FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX partner_credit_grants_one_pending
  ON public.partner_credit_grants (partner_id) WHERE status = 'pending';
CREATE UNIQUE INDEX partner_credit_grants_one_active
  ON public.partner_credit_grants (partner_id) WHERE status = 'approved';

CREATE TRIGGER trg_partner_credit_grants_updated
  BEFORE UPDATE ON public.partner_credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_partner_credit_grant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.credits_per_signup < 1 OR NEW.credits_per_signup > 50 THEN
    RAISE EXCEPTION 'GRANT_CREDITS_PER_SIGNUP_INVALID'
      USING HINT = 'Credits per signup must be between 1 and 50.';
  END IF;
  IF NEW.total_budget_credits < NEW.credits_per_signup THEN
    RAISE EXCEPTION 'GRANT_BUDGET_TOO_SMALL'
      USING HINT = 'Total budget must be at least the credits given per signup.';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.ends_at <= now() THEN
    RAISE EXCEPTION 'GRANT_END_DATE_INVALID'
      USING HINT = 'The end date must be in the future.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partner_credit_grants_validate
  BEFORE INSERT OR UPDATE ON public.partner_credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.validate_partner_credit_grant();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_affiliate_code text;
  v_affiliate_id uuid;
  v_partner_slug text;
  v_partner_id uuid;
  v_grant public.partner_credit_grants;
  v_partner_user uuid;
  v_partner_name text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, referred_by, whatsapp_number)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'referred_by',
    NEW.raw_user_meta_data->>'whatsapp_number'
  );

  v_affiliate_code := NEW.raw_user_meta_data->>'affiliate_code';
  IF v_affiliate_code IS NOT NULL AND v_affiliate_code != '' THEN
    SELECT id INTO v_affiliate_id FROM public.affiliates WHERE affiliate_code = v_affiliate_code AND status = 'approved';
    IF v_affiliate_id IS NOT NULL THEN
      INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id)
      VALUES (v_affiliate_id, NEW.id);
    END IF;
  END IF;

  -- Marketing Partner attribution (permanent)
  v_partner_slug := COALESCE(NEW.raw_user_meta_data->>'partner_slug', v_affiliate_code);
  IF v_partner_slug IS NOT NULL AND v_partner_slug != '' THEN
    SELECT p.id INTO v_partner_id
    FROM public.partner_profiles p
    WHERE p.slug = lower(v_partner_slug) AND p.status = 'active'
    LIMIT 1;

    IF v_partner_id IS NULL THEN
      SELECT l.partner_id INTO v_partner_id
      FROM public.partner_referral_links l
      JOIN public.partner_profiles p ON p.id = l.partner_id
      WHERE l.code = lower(v_partner_slug) AND l.active = true AND p.status = 'active'
      LIMIT 1;
    END IF;

    IF v_partner_id IS NOT NULL THEN
      INSERT INTO public.partner_leads (partner_id, user_id, source)
      VALUES (v_partner_id, NEW.id, 'referral_link')
      ON CONFLICT (user_id) DO NOTHING;

      -- Partner-sponsored signup credits: grant when a live, in-budget grant exists
      BEGIN
        SELECT * INTO v_grant
        FROM public.partner_credit_grants
        WHERE partner_id = v_partner_id
          AND status = 'approved'
          AND starts_at <= now()
          AND ends_at > now()
        LIMIT 1
        FOR UPDATE;

        IF v_grant.id IS NOT NULL
           AND v_grant.credits_granted + v_grant.credits_per_signup <= v_grant.total_budget_credits THEN
          SELECT p.user_id, p.name INTO v_partner_user, v_partner_name
          FROM public.partner_profiles p WHERE p.id = v_partner_id;

          INSERT INTO public.credit_rewards (user_id, amount, remaining, reason, granted_by, expires_at)
          VALUES (
            NEW.id,
            v_grant.credits_per_signup,
            v_grant.credits_per_signup,
            'partner_grant:' || COALESCE(v_partner_name, v_partner_id::text),
            COALESCE(v_partner_user, NEW.id),
            now() + interval '30 days'
          );

          UPDATE public.partner_credit_grants
          SET credits_granted = credits_granted + v_grant.credits_per_signup,
              leads_credited = leads_credited + 1,
              status = CASE
                WHEN credits_granted + v_grant.credits_per_signup + v_grant.credits_per_signup > total_budget_credits
                  THEN 'exhausted' ELSE status END
          WHERE id = v_grant.id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'partner credit grant skipped for %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;