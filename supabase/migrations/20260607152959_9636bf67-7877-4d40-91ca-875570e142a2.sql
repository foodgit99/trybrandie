
-- =========================================================================
-- PHASE 1: Subscription model foundation
-- =========================================================================

-- 1. subscription_plans (catalog) ---------------------------------------------
CREATE TABLE public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_naira integer NOT NULL,
  monthly_credits integer NOT NULL,
  brand_limit integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are readable by everyone"
  ON public.subscription_plans FOR SELECT
  USING (true);
CREATE POLICY "Admins manage plans"
  ON public.subscription_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.subscription_plans (id, name, price_naira, monthly_credits, brand_limit, features, sort_order)
VALUES
  ('entrepreneur', 'Entrepreneur', 18500, 100, 1,
   '{"team":false,"client_folders":false,"white_label":false,"priority_rendering":false}'::jsonb, 1),
  ('creator', 'Creator', 37000, 200, NULL,
   '{"team":true,"client_folders":false,"white_label":false,"priority_rendering":false}'::jsonb, 2),
  ('agency', 'Agency', 92500, 500, NULL,
   '{"team":true,"client_folders":true,"white_label":true,"priority_rendering":true}'::jsonb, 3);

-- 2. subscriptions ------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active', -- active | past_due | cancelled
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  authorization_code text,
  customer_code text,
  last_charge_reference text,
  last_renewal_attempt_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_user ON public.subscriptions(user_id);
CREATE INDEX idx_subs_status_period ON public.subscriptions(status, current_period_end);
GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users update own subscription cancel flag"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3. subscription_credits (per-cycle grant ledger) ---------------------------
CREATE TABLE public.subscription_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  remaining integer NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX idx_subcredits_user_active
  ON public.subscription_credits(user_id, expires_at)
  WHERE remaining > 0;
GRANT SELECT ON public.subscription_credits TO authenticated;
GRANT ALL ON public.subscription_credits TO service_role;
ALTER TABLE public.subscription_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription credits"
  ON public.subscription_credits FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all subscription credits"
  ON public.subscription_credits FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages subscription credits"
  ON public.subscription_credits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4. subscription_charges -----------------------------------------------------
CREATE TABLE public.subscription_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  paystack_reference text NOT NULL UNIQUE,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending', -- pending | success | failed
  charge_type text NOT NULL DEFAULT 'initial', -- initial | renewal | upgrade
  attempt_count integer NOT NULL DEFAULT 1,
  failure_reason text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_charges_sub ON public.subscription_charges(subscription_id, created_at DESC);
GRANT SELECT ON public.subscription_charges TO authenticated;
GRANT ALL ON public.subscription_charges TO service_role;
ALTER TABLE public.subscription_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own charges"
  ON public.subscription_charges FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all charges"
  ON public.subscription_charges FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages charges"
  ON public.subscription_charges FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 5. client_folders -----------------------------------------------------------
CREATE TABLE public.client_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#C4993B',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_folders_owner ON public.client_folders(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_folders TO authenticated;
GRANT ALL ON public.client_folders TO service_role;
ALTER TABLE public.client_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own client folders"
  ON public.client_folders FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Admins view all client folders"
  ON public.client_folders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. brand_team_members -------------------------------------------------------
CREATE TABLE public.brand_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  user_id uuid, -- null until invite is accepted
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor', -- owner | editor | viewer
  status text NOT NULL DEFAULT 'pending', -- pending | active | revoked
  invite_token text UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 24),
  invited_by uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, email)
);
CREATE INDEX idx_team_brand ON public.brand_team_members(brand_id);
CREATE INDEX idx_team_user ON public.brand_team_members(user_id) WHERE user_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_team_members TO authenticated;
GRANT ALL ON public.brand_team_members TO service_role;
ALTER TABLE public.brand_team_members ENABLE ROW LEVEL SECURITY;

-- Brand owners manage memberships on their own brands
CREATE POLICY "Brand owners manage memberships"
  ON public.brand_team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_team_members.brand_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_team_members.brand_id AND b.user_id = auth.uid()
    )
  );

-- A logged-in user can view their own membership rows (so they can list brands they belong to)
CREATE POLICY "Members view own memberships"
  ON public.brand_team_members FOR SELECT
  USING (auth.uid() = user_id);

-- Admins
CREATE POLICY "Admins manage all memberships"
  ON public.brand_team_members FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can write (for invite acceptance edge function)
CREATE POLICY "Service role manages memberships"
  ON public.brand_team_members FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 7. has_brand_access helper -------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_brand_access(_brand_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands b WHERE b.id = _brand_id AND b.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.brand_team_members m
    WHERE m.brand_id = _brand_id AND m.user_id = _user_id AND m.status = 'active'
  );
$$;

-- 8. Column additions --------------------------------------------------------
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS client_folder_id uuid REFERENCES public.client_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS priority_render_until timestamptz;

ALTER TABLE public.design_jobs
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_jobs_priority_queue
  ON public.design_jobs (priority DESC, created_at ASC)
  WHERE status = 'queued';

-- 9. updated_at triggers -----------------------------------------------------
CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_subscription_charges_updated
  BEFORE UPDATE ON public.subscription_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_client_folders_updated
  BEFORE UPDATE ON public.client_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_team_members_updated
  BEFORE UPDATE ON public.brand_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Brand-limit enforcement trigger ----------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_brand_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit integer;
  v_existing integer;
BEGIN
  -- Find user's active tier
  SELECT COALESCE(s.plan_id, p.subscription_tier, 'free')
    INTO v_tier
  FROM public.profiles p
  LEFT JOIN public.subscriptions s
    ON s.user_id = p.user_id AND s.status = 'active'
  WHERE p.user_id = NEW.user_id;

  -- Map tier -> limit. NULL = unlimited.
  IF v_tier IN ('creator', 'agency') THEN
    v_limit := NULL;
  ELSE
    v_limit := 1;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_existing
    FROM public.brands
    WHERE user_id = NEW.user_id AND is_archived = false;
    IF v_existing >= v_limit THEN
      RAISE EXCEPTION 'BRAND_LIMIT_REACHED'
        USING HINT = 'Upgrade to Creator or Agency to add more brands.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_brand_limit
  BEFORE INSERT ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_limit();
