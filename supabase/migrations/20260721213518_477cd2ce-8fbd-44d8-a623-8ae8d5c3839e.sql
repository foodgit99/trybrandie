
-- brand_competitors
CREATE TABLE public.brand_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  instagram_handle text,
  logo_url text,
  discovery_source text NOT NULL DEFAULT 'auto' CHECK (discovery_source IN ('auto','user')),
  discovery_rationale text,
  is_active boolean NOT NULL DEFAULT true,
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_brand_competitors_brand ON public.brand_competitors(brand_id) WHERE is_active;
CREATE UNIQUE INDEX uq_brand_competitors_brand_domain ON public.brand_competitors(brand_id, lower(domain)) WHERE domain IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_competitors TO authenticated;
GRANT ALL ON public.brand_competitors TO service_role;
ALTER TABLE public.brand_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view competitors" ON public.brand_competitors FOR SELECT TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "Team can insert competitors" ON public.brand_competitors FOR INSERT TO authenticated
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "Team can update competitors" ON public.brand_competitors FOR UPDATE TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "Team can delete competitors" ON public.brand_competitors FOR DELETE TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()));

CREATE TRIGGER trg_brand_competitors_updated
  BEFORE UPDATE ON public.brand_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- competitor_snapshots
CREATE TABLE public.competitor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES public.brand_competitors(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  week_start_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('site','instagram','semrush')),
  raw jsonb,
  extracted jsonb,
  tokens_used integer DEFAULT 0,
  cost_credits numeric DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_competitor_snapshots_week ON public.competitor_snapshots(competitor_id, week_start_date, source);
CREATE INDEX idx_competitor_snapshots_brand_week ON public.competitor_snapshots(brand_id, week_start_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_snapshots TO authenticated;
GRANT ALL ON public.competitor_snapshots TO service_role;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view snapshots" ON public.competitor_snapshots FOR SELECT TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "Team can manage snapshots" ON public.competitor_snapshots FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- competitor_signals
CREATE TABLE public.competitor_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES public.brand_competitors(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('launch','offer','angle','seo_win','positioning_shift','steal_the_angle')),
  summary text NOT NULL,
  rationale text,
  content_idea_id uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  acted_on boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_competitor_signals_brand_week ON public.competitor_signals(brand_id, week_start_date DESC);
CREATE INDEX idx_competitor_signals_competitor ON public.competitor_signals(competitor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_signals TO authenticated;
GRANT ALL ON public.competitor_signals TO service_role;
ALTER TABLE public.competitor_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view signals" ON public.competitor_signals FOR SELECT TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "Team can manage signals" ON public.competitor_signals FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- Tier cap enforcement
CREATE OR REPLACE FUNCTION public.enforce_competitor_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit integer;
  v_existing integer;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.brands WHERE id = NEW.brand_id;

  SELECT COALESCE(s.plan_id, p.subscription_tier, 'free')
    INTO v_tier
  FROM public.profiles p
  LEFT JOIN public.subscriptions s
    ON s.user_id = p.user_id AND s.status = 'active'
  WHERE p.user_id = v_owner;

  IF v_tier = 'agency' THEN
    v_limit := NULL;
  ELSIF v_tier = 'creator' THEN
    v_limit := 3;
  ELSE
    v_limit := 1;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_existing
    FROM public.brand_competitors
    WHERE brand_id = NEW.brand_id AND is_active = true;
    IF v_existing >= v_limit THEN
      RAISE EXCEPTION 'COMPETITOR_LIMIT_REACHED'
        USING HINT = 'Upgrade to Creator or Agency to track more competitors.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_competitor_limit
  BEFORE INSERT ON public.brand_competitors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_competitor_limit();
