-- 1. Tier on affiliates
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'friend_of_brandie';

-- 2. Partner profiles
CREATE TABLE public.partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'marketing_partner',
  slug text NOT NULL UNIQUE,
  logo_url text,
  contact_person text,
  contact_email text,
  contact_phone text,
  organization text,
  commission_first_pct numeric NOT NULL DEFAULT 0,
  commission_recurring_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_profiles TO authenticated;
GRANT ALL ON public.partner_profiles TO service_role;
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own profile"
  ON public.partner_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage partner profiles"
  ON public.partner_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_profiles_updated
  BEFORE UPDATE ON public.partner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Partner referral links
CREATE TABLE public.partner_referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Primary',
  click_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_referral_links TO authenticated;
GRANT ALL ON public.partner_referral_links TO service_role;
ALTER TABLE public.partner_referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own links"
  ON public.partner_referral_links FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_profiles p
      WHERE p.id = partner_referral_links.partner_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage partner links"
  ON public.partner_referral_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_referral_links_updated
  BEFORE UPDATE ON public.partner_referral_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Partner leads (permanent attribution)
CREATE TABLE public.partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'referral_link',
  attributed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_leads_partner ON public.partner_leads(partner_id);

GRANT SELECT ON public.partner_leads TO authenticated;
GRANT ALL ON public.partner_leads TO service_role;
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own leads"
  ON public.partner_leads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.partner_profiles p
      WHERE p.id = partner_leads.partner_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage partner leads"
  ON public.partner_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_leads_updated
  BEFORE UPDATE ON public.partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Helper functions
CREATE OR REPLACE FUNCTION public.is_marketing_partner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_profiles p
    WHERE p.user_id = _user_id AND p.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.partner_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM public.partner_profiles p WHERE p.user_id = _user_id LIMIT 1;
$$;

-- 6. Attribution at signup
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
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;