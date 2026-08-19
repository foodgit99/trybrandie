-- Campaign module: one live campaign landing page at a time
CREATE TABLE public.campaigns_public (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  goal text,
  audience text,
  offer_text text,
  status text NOT NULL DEFAULT 'draft',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_note text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  views_count integer NOT NULL DEFAULT 0,
  clicks_count integer NOT NULL DEFAULT 0,
  signups_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns_public TO authenticated;
GRANT ALL ON public.campaigns_public TO service_role;

ALTER TABLE public.campaigns_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own campaign pages"
ON public.campaigns_public FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Only one campaign can ever be live
CREATE UNIQUE INDEX campaigns_public_single_active ON public.campaigns_public ((status)) WHERE status = 'active';
CREATE INDEX campaigns_public_user_idx ON public.campaigns_public (user_id);
CREATE INDEX campaigns_public_status_idx ON public.campaigns_public (status);

CREATE TRIGGER trg_campaigns_public_updated
BEFORE UPDATE ON public.campaigns_public
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Slug + status guardrails
CREATE OR REPLACE FUNCTION public.validate_campaign_public()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  reserved text[] := ARRAY['auth','admin','partner','cockpit','blueprint','settings','profile','pricing','plans','support','brand','brands','studio','history','hub','engine','post','report','agent','c','api','onboarding','affiliate','affiliates'];
BEGIN
  NEW.slug := lower(trim(NEW.slug));
  IF NEW.slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' THEN
    RAISE EXCEPTION 'CAMPAIGN_SLUG_INVALID' USING HINT = 'Use 3-50 lowercase letters, numbers or hyphens.';
  END IF;
  IF NEW.slug = ANY(reserved) THEN
    RAISE EXCEPTION 'CAMPAIGN_SLUG_RESERVED' USING HINT = 'That link name is reserved.';
  END IF;
  IF NEW.status NOT IN ('draft','pending_review','approved','active','paused','archived','rejected') THEN
    RAISE EXCEPTION 'CAMPAIGN_STATUS_INVALID';
  END IF;
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'CAMPAIGN_WINDOW_INVALID' USING HINT = 'The end date must come after the start date.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_campaigns_public_validate
BEFORE INSERT OR UPDATE ON public.campaigns_public
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_public();

-- Public analytics events
CREATE TABLE public.campaign_page_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns_public(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  section_key text,
  referral_slug text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.campaign_page_events TO authenticated;
GRANT ALL ON public.campaign_page_events TO service_role;

ALTER TABLE public.campaign_page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign owners and admins read events"
ON public.campaign_page_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns_public c WHERE c.id = campaign_id AND c.user_id = auth.uid())
);

CREATE INDEX campaign_page_events_campaign_idx ON public.campaign_page_events (campaign_id, created_at DESC);
CREATE INDEX campaign_page_events_name_idx ON public.campaign_page_events (campaign_id, event_name);

-- Public read helpers (no anon table grants)
CREATE OR REPLACE FUNCTION public.get_active_campaign_page()
RETURNS TABLE(id uuid, name text, slug text, offer_text text, ends_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.name, c.slug, c.offer_text, c.ends_at
  FROM public.campaigns_public c
  WHERE c.status = 'active'
    AND c.starts_at <= now()
    AND (c.ends_at IS NULL OR c.ends_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_page(_slug text)
RETURNS TABLE(id uuid, name text, slug text, goal text, offer_text text, sections jsonb, copy jsonb, status text, ends_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.name, c.slug, c.goal, c.offer_text, c.sections, c.copy, c.status, c.ends_at
  FROM public.campaigns_public c
  WHERE c.slug = lower(trim(_slug))
    AND c.status = 'active'
    AND c.starts_at <= now()
    AND (c.ends_at IS NULL OR c.ends_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_campaign_page() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_page(text) TO anon, authenticated;

-- Auto-deactivate campaigns whose window elapsed
CREATE OR REPLACE FUNCTION public.expire_campaign_pages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.campaigns_public
    SET status = 'archived', deactivated_at = now()
    WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- Activating a campaign archives whatever was live before
CREATE OR REPLACE FUNCTION public.activate_campaign_page(_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.campaigns_public
  SET status = 'archived', deactivated_at = now()
  WHERE status = 'active' AND id <> _campaign_id;

  UPDATE public.campaigns_public
  SET status = 'active', activated_at = now(), deactivated_at = NULL
  WHERE id = _campaign_id;
END;
$$;

SELECT cron.schedule(
  'expire-campaign-pages',
  '*/15 * * * *',
  $$SELECT public.expire_campaign_pages();$$
);