CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      INSERT INTO public.partner_leads (partner_id, user_id, source, referral_code)
      VALUES (v_partner_id, NEW.id, 'referral_link', lower(v_partner_slug))
      ON CONFLICT (user_id) DO NOTHING;

      -- Partner-sponsored signup credits: budget is the only stop condition.
      BEGIN
        SELECT * INTO v_grant
        FROM public.partner_credit_grants
        WHERE partner_id = v_partner_id
          AND status = 'approved'
          AND starts_at <= now()
          AND credits_granted + credits_per_signup <= total_budget_credits
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;

        IF v_grant.id IS NOT NULL THEN
          SELECT p.user_id, p.name INTO v_partner_user, v_partner_name
          FROM public.partner_profiles p WHERE p.id = v_partner_id;

          INSERT INTO public.credit_rewards (user_id, amount, remaining, reason, granted_by, expires_at)
          VALUES (
            NEW.id,
            v_grant.credits_per_signup,
            v_grant.credits_per_signup,
            'partner_grant:' || v_grant.id::text || ':' || COALESCE(v_partner_name, v_partner_id::text),
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

          UPDATE public.partner_leads
          SET credit_grant_id = v_grant.id,
              credits_granted = v_grant.credits_per_signup,
              credited_at = now()
          WHERE user_id = NEW.id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'partner credit grant skipped for %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;