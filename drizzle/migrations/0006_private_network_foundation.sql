-- Private Network V1 foundation: additive, RLS-protected, flag-gated.
CREATE TYPE public.private_network_platform AS ENUM ('whatsapp_status','whatsapp_chat','instagram','facebook','tiktok','x','other');

CREATE TABLE public.private_network_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.private_network_settings (id, enabled) VALUES (true, false);

CREATE TABLE public.private_network_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','moderator','finance')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.private_network_publishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected','deleted')),
  status_reason text,
  display_name text,
  occupation text,
  location_country text,
  location_state text,
  location_city text,
  age_bracket text CHECK (age_bracket IS NULL OR age_bracket IN ('18-24','25-34','35-44','45-54','55+')),
  languages text[] NOT NULL DEFAULT '{}',
  interests text[] NOT NULL DEFAULT '{}',
  communities text[] NOT NULL DEFAULT '{}',
  industries text[] NOT NULL DEFAULT '{}',
  school text,
  workplace text,
  affiliations text[] NOT NULL DEFAULT '{}',
  platforms text[] NOT NULL DEFAULT '{}',
  audience_size_estimate integer CHECK (audience_size_estimate IS NULL OR audience_size_estimate >= 0),
  audience_views_estimate integer CHECK (audience_views_estimate IS NULL OR audience_views_estimate >= 0),
  audience_geographies text[] NOT NULL DEFAULT '{}',
  audience_age_brackets text[] NOT NULL DEFAULT '{}',
  estimates_are_self_reported boolean NOT NULL DEFAULT true,
  creator_link_status text NOT NULL DEFAULT 'none' CHECK (creator_link_status IN ('none','pending','verified','rejected')),
  creator_link_code text,
  creator_id uuid,
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test boolean NOT NULL DEFAULT false,
  record_source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.private_network_allowed_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  host text NOT NULL,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, host)
);

CREATE SEQUENCE public.private_network_campaign_seq;
CREATE TABLE public.private_network_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('PNC-' || lpad(nextval('public.private_network_campaign_seq')::text, 4, '0')),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  landing_url text NOT NULL,
  landing_host text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','active','paused','ended','rejected')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  target_platforms text[] NOT NULL DEFAULT '{}',
  target_languages text[] NOT NULL DEFAULT '{}',
  target_geographies text[] NOT NULL DEFAULT '{}',
  target_interests text[] NOT NULL DEFAULT '{}',
  target_age_brackets text[] NOT NULL DEFAULT '{}',
  min_audience integer,
  base_fee_ngn numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_fee_ngn >= 0),
  action_bonus_ngn numeric(12,2) NOT NULL DEFAULT 0 CHECK (action_bonus_ngn >= 0),
  conversion_commission_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (conversion_commission_pct >= 0 AND conversion_commission_pct <= 50),
  max_placements integer CHECK (max_placements IS NULL OR max_placements > 0),
  per_publisher_cap integer NOT NULL DEFAULT 1 CHECK (per_publisher_cap > 0),
  budget_ngn numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_ngn >= 0),
  budget_reserved_ngn numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_reserved_ngn >= 0),
  budget_spent_ngn numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_spent_ngn >= 0),
  funding_status text NOT NULL DEFAULT 'unfunded' CHECK (funding_status IN ('unfunded','funded_manual','test')),
  funding_reference text,
  review_note text,
  is_test boolean NOT NULL DEFAULT false,
  record_source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pn_budget_conserved CHECK (budget_reserved_ngn + budget_spent_ngn <= budget_ngn)
);

CREATE TABLE public.private_network_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.private_network_campaigns(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  media_source text NOT NULL CHECK (media_source IN ('creator_network','brand_design','upload')),
  design_id uuid,
  storage_bucket text,
  storage_path text,
  public_media_url text,
  caption text,
  cn_production_job_id uuid,
  cn_licence_id uuid,
  creator_approval_recorded boolean NOT NULL DEFAULT false,
  private_redistribution_confirmed boolean NOT NULL DEFAULT false,
  rights_attested boolean NOT NULL DEFAULT false,
  rights_attestation text,
  rights_attested_by uuid,
  rights_attested_at timestamptz,
  rights_platforms text[] NOT NULL DEFAULT '{}',
  rights_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  is_test boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.private_network_likes (
  publisher_id uuid NOT NULL REFERENCES public.private_network_publishers(id) ON DELETE CASCADE,
  creative_id uuid NOT NULL REFERENCES public.private_network_creatives(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, creative_id)
);
CREATE TABLE public.private_network_saves (
  publisher_id uuid NOT NULL REFERENCES public.private_network_publishers(id) ON DELETE CASCADE,
  creative_id uuid NOT NULL REFERENCES public.private_network_creatives(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, creative_id)
);

CREATE TABLE public.private_network_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT ('pn' || replace(gen_random_uuid()::text,'-','')),
  publisher_id uuid NOT NULL REFERENCES public.private_network_publishers(id),
  campaign_id uuid NOT NULL REFERENCES public.private_network_campaigns(id),
  creative_id uuid NOT NULL REFERENCES public.private_network_creatives(id),
  platform public.private_network_platform NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','share_initiated','proof_submitted','verified','rejected','cancelled')),
  snapshot_base_fee numeric(12,2) NOT NULL,
  snapshot_action_bonus numeric(12,2) NOT NULL,
  snapshot_commission_pct numeric(5,2) NOT NULL,
  reserved_amount numeric(12,2) NOT NULL DEFAULT 0,
  idempotency_key text,
  share_method text,
  share_initiated_at timestamptz,
  proof_path text,
  proof_url text,
  proof_note text,
  proof_submitted_at timestamptz,
  resubmission_count integer NOT NULL DEFAULT 0,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  verified_at timestamptz,
  cancelled_at timestamptz,
  clicks integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX private_network_placements_one_live
  ON public.private_network_placements (publisher_id, campaign_id, creative_id, platform) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX private_network_placements_idem
  ON public.private_network_placements (publisher_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE public.private_network_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.private_network_placements(id),
  event_type text NOT NULL CHECK (event_type IN ('click','qualified_action','conversion')),
  source text NOT NULL CHECK (source IN ('redirect','server')),
  external_event_id text,
  amount numeric(14,2),
  actor_user_id uuid,
  caller_user_id uuid,
  ip_hash text,
  ua_hash text,
  outcome text NOT NULL DEFAULT 'recorded',
  earned_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX private_network_events_ext ON public.private_network_events (source, external_event_id) WHERE external_event_id IS NOT NULL;
CREATE INDEX private_network_events_rate ON public.private_network_events (ip_hash, created_at);
CREATE INDEX private_network_events_placement ON public.private_network_events (placement_id, event_type, created_at);

CREATE TABLE public.private_network_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES public.private_network_publishers(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','paid','rejected','cancelled')),
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference text,
  reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  paid_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX private_network_payouts_one_open ON public.private_network_payouts (publisher_id) WHERE status IN ('requested','approved');

CREATE TABLE public.private_network_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES public.private_network_publishers(id),
  placement_id uuid REFERENCES public.private_network_placements(id),
  campaign_id uuid REFERENCES public.private_network_campaigns(id),
  event_id uuid REFERENCES public.private_network_events(id),
  payout_id uuid REFERENCES public.private_network_payouts(id),
  entry_type text NOT NULL CHECK (entry_type IN ('base_fee','action_bonus','conversion_commission','release','payout','reversal')),
  bucket text NOT NULL CHECK (bucket IN ('pending','available','paid')),
  amount numeric(12,2) NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  note text,
  created_by uuid,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX private_network_ledger_pub ON public.private_network_ledger (publisher_id, bucket);

CREATE TABLE public.private_network_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.private_network_settings, public.private_network_members, public.private_network_publishers,
  public.private_network_allowed_domains, public.private_network_campaigns, public.private_network_creatives,
  public.private_network_placements, public.private_network_events, public.private_network_payouts,
  public.private_network_ledger, public.private_network_activity_log TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.private_network_likes, public.private_network_saves TO authenticated;
GRANT INSERT, UPDATE ON public.private_network_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.private_network_creatives TO authenticated;
GRANT ALL ON public.private_network_settings, public.private_network_members, public.private_network_publishers,
  public.private_network_allowed_domains, public.private_network_campaigns, public.private_network_creatives,
  public.private_network_likes, public.private_network_saves, public.private_network_placements, public.private_network_events,
  public.private_network_payouts, public.private_network_ledger, public.private_network_activity_log TO service_role;
GRANT USAGE ON SEQUENCE public.private_network_campaign_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.private_network_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.private_network_settings WHERE id), false)
$$;
CREATE OR REPLACE FUNCTION public.private_network_has_role(_uid uuid, _role text DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid, 'admin') OR EXISTS (
    SELECT 1 FROM public.private_network_members m WHERE m.user_id = _uid AND (_role IS NULL OR m.role = _role OR m.role = 'admin')))
$$;
CREATE OR REPLACE FUNCTION public.private_network_is_operator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.private_network_has_role(auth.uid(), NULL)
$$;
CREATE OR REPLACE FUNCTION public.private_network_my_publisher_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.private_network_publishers WHERE user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.private_network_lower(_a text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(lower(btrim(x))), '{}') FROM unnest(_a) x WHERE btrim(x) <> ''
$$;
CREATE OR REPLACE FUNCTION public.private_network_log(_entity text, _id uuid, _action text, _details jsonb DEFAULT '{}'::jsonb, _is_test boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.private_network_activity_log (actor_id, entity_type, entity_id, action, details, is_test)
  VALUES (auth.uid(), _entity, _id, _action, COALESCE(_details, '{}'::jsonb), COALESCE(_is_test, false))
$$;
CREATE OR REPLACE FUNCTION public.private_network_require_enabled() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PN: Sign in required.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.private_network_validate_platforms(_a text[]) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE x text;
BEGIN
  FOREACH x IN ARRAY COALESCE(_a, '{}') LOOP
    PERFORM x::public.private_network_platform;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PN: % is append-only.', TG_TABLE_NAME; END $$;
CREATE TRIGGER pn_ledger_append_only BEFORE UPDATE OR DELETE ON public.private_network_ledger FOR EACH ROW EXECUTE FUNCTION public.private_network_block_mutation();
CREATE TRIGGER pn_log_append_only BEFORE UPDATE OR DELETE ON public.private_network_activity_log FOR EACH ROW EXECUTE FUNCTION public.private_network_block_mutation();

CREATE OR REPLACE FUNCTION public.private_network_campaign_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rpc boolean := COALESCE(current_setting('private_network.rpc', true), '') = 'on';
BEGIN
  IF NEW.landing_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/[^\s]*)?$' THEN RAISE EXCEPTION 'PN: Landing URL must be a valid https:// address.'; END IF;
  NEW.landing_host := lower(substring(NEW.landing_url from '^https://([^/:?#]+)'));
  PERFORM public.private_network_validate_platforms(NEW.target_platforms);
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'PN: End date must be after start date.'; END IF;
  NEW.updated_at := now();
  IF _rpc OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
    NEW.status := 'draft'; NEW.funding_status := 'unfunded'; NEW.funding_reference := NULL;
    NEW.budget_reserved_ngn := 0; NEW.budget_spent_ngn := 0; NEW.owner_user_id := auth.uid(); NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.funding_status IS DISTINCT FROM OLD.funding_status
     OR NEW.funding_reference IS DISTINCT FROM OLD.funding_reference OR NEW.budget_reserved_ngn <> OLD.budget_reserved_ngn
     OR NEW.budget_spent_ngn <> OLD.budget_spent_ngn OR NEW.brand_id <> OLD.brand_id OR NEW.owner_user_id <> OLD.owner_user_id
     OR NEW.code <> OLD.code OR NEW.is_test <> OLD.is_test THEN
    RAISE EXCEPTION 'PN: Status, funding and budget counters change only through Private Network actions.';
  END IF;
  IF OLD.status NOT IN ('draft','rejected') AND NOT public.private_network_is_operator() THEN
    RAISE EXCEPTION 'PN: Only draft or rejected campaigns can be edited.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pn_campaign_guard BEFORE INSERT OR UPDATE ON public.private_network_campaigns FOR EACH ROW EXECUTE FUNCTION public.private_network_campaign_guard();

CREATE OR REPLACE FUNCTION public.private_network_creative_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rpc boolean := COALESCE(current_setting('private_network.rpc', true), '') = 'on'; _brand uuid; _test boolean;
BEGIN
  PERFORM public.private_network_validate_platforms(NEW.rights_platforms);
  NEW.updated_at := now();
  IF _rpc OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  SELECT brand_id, is_test INTO _brand, _test FROM public.private_network_campaigns WHERE id = NEW.campaign_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.media_source = 'creator_network' THEN RAISE EXCEPTION 'PN: Creator Network masters are added by operators only.'; END IF;
    IF NEW.media_source = 'brand_design' THEN
      SELECT image_url INTO NEW.public_media_url FROM public.designs WHERE id = NEW.design_id AND brand_id = _brand;
      IF NEW.public_media_url IS NULL THEN RAISE EXCEPTION 'PN: Design not found for this brand.'; END IF;
      NEW.media_type := 'image'; NEW.storage_bucket := NULL; NEW.storage_path := NULL;
    ELSE
      NEW.storage_bucket := 'private-network-media'; NEW.public_media_url := NULL;
      IF NEW.storage_path IS NULL OR split_part(NEW.storage_path, '/', 1) <> _brand::text THEN RAISE EXCEPTION 'PN: Upload must live in this brand folder.'; END IF;
    END IF;
    NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.private_redistribution_confirmed := false;
    NEW.cn_licence_id := NULL; NEW.cn_production_job_id := NULL; NEW.created_by := auth.uid(); NEW.is_test := COALESCE(_test, false);
    IF NEW.rights_attested THEN NEW.rights_attested_by := auth.uid(); NEW.rights_attested_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'PN: Reviewed creative cannot be edited; add a new one.'; END IF;
  IF NEW.status <> OLD.status OR NEW.private_redistribution_confirmed <> OLD.private_redistribution_confirmed
     OR NEW.media_source <> OLD.media_source OR NEW.campaign_id <> OLD.campaign_id
     OR NEW.cn_licence_id IS DISTINCT FROM OLD.cn_licence_id OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'PN: That field changes only through review.';
  END IF;
  IF NEW.rights_attested AND NOT OLD.rights_attested THEN NEW.rights_attested_by := auth.uid(); NEW.rights_attested_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pn_creative_guard BEFORE INSERT OR UPDATE ON public.private_network_creatives FOR EACH ROW EXECUTE FUNCTION public.private_network_creative_guard();

ALTER TABLE public.private_network_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_network_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY pn_settings_read ON public.private_network_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY pn_members_read ON public.private_network_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.private_network_is_operator());
CREATE POLICY pn_publishers_read ON public.private_network_publishers FOR SELECT TO authenticated
  USING ((user_id = auth.uid() AND public.private_network_enabled()) OR public.private_network_is_operator());
CREATE POLICY pn_domains_read ON public.private_network_allowed_domains FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND public.has_brand_access(brand_id, auth.uid())));
CREATE POLICY pn_campaigns_read ON public.private_network_campaigns FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND public.has_brand_access(brand_id, auth.uid())));
CREATE POLICY pn_campaigns_insert ON public.private_network_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.private_network_enabled() AND public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY pn_campaigns_update ON public.private_network_campaigns FOR UPDATE TO authenticated
  USING (public.private_network_enabled() AND (public.private_network_is_operator() OR public.has_brand_access(brand_id, auth.uid())))
  WITH CHECK (public.private_network_is_operator() OR public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY pn_creatives_read ON public.private_network_creatives FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND EXISTS (
    SELECT 1 FROM public.private_network_campaigns c WHERE c.id = campaign_id AND public.has_brand_access(c.brand_id, auth.uid()))));
CREATE POLICY pn_creatives_write ON public.private_network_creatives FOR INSERT TO authenticated
  WITH CHECK (public.private_network_enabled() AND EXISTS (
    SELECT 1 FROM public.private_network_campaigns c WHERE c.id = campaign_id AND public.has_brand_access(c.brand_id, auth.uid())));
CREATE POLICY pn_creatives_update ON public.private_network_creatives FOR UPDATE TO authenticated
  USING (public.private_network_enabled() AND status = 'pending' AND EXISTS (
    SELECT 1 FROM public.private_network_campaigns c WHERE c.id = campaign_id AND public.has_brand_access(c.brand_id, auth.uid())));
CREATE POLICY pn_creatives_delete ON public.private_network_creatives FOR DELETE TO authenticated
  USING (public.private_network_enabled() AND status = 'pending' AND NOT EXISTS (SELECT 1 FROM public.private_network_placements p WHERE p.creative_id = private_network_creatives.id)
    AND EXISTS (SELECT 1 FROM public.private_network_campaigns c WHERE c.id = campaign_id AND public.has_brand_access(c.brand_id, auth.uid())));
CREATE POLICY pn_likes_own ON public.private_network_likes FOR ALL TO authenticated
  USING (public.private_network_enabled() AND publisher_id = public.private_network_my_publisher_id())
  WITH CHECK (public.private_network_enabled() AND publisher_id = public.private_network_my_publisher_id());
CREATE POLICY pn_saves_own ON public.private_network_saves FOR ALL TO authenticated
  USING (public.private_network_enabled() AND publisher_id = public.private_network_my_publisher_id())
  WITH CHECK (public.private_network_enabled() AND publisher_id = public.private_network_my_publisher_id());
CREATE POLICY pn_placements_read ON public.private_network_placements FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND (
    publisher_id = public.private_network_my_publisher_id()
    OR EXISTS (SELECT 1 FROM public.private_network_campaigns c WHERE c.id = campaign_id AND public.has_brand_access(c.brand_id, auth.uid())))));
CREATE POLICY pn_events_read ON public.private_network_events FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND EXISTS (
    SELECT 1 FROM public.private_network_placements p JOIN public.private_network_campaigns c ON c.id = p.campaign_id
    WHERE p.id = placement_id AND public.has_brand_access(c.brand_id, auth.uid()))));
CREATE POLICY pn_payouts_read ON public.private_network_payouts FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND publisher_id = public.private_network_my_publisher_id()));
CREATE POLICY pn_ledger_read ON public.private_network_ledger FOR SELECT TO authenticated
  USING (public.private_network_is_operator() OR (public.private_network_enabled() AND publisher_id = public.private_network_my_publisher_id()));
CREATE POLICY pn_log_read ON public.private_network_activity_log FOR SELECT TO authenticated USING (public.private_network_is_operator());

CREATE OR REPLACE FUNCTION public.private_network_creative_eligibility(_creative uuid, _platform text DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; c record; lic record; job record; r text[] := '{}'; fam text; bname text;
BEGIN
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF NOT FOUND THEN RETURN ARRAY['Creative not found.']; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id;
  IF cr.rights_expires_at IS NOT NULL AND cr.rights_expires_at < now() THEN r := r || 'Distribution rights have expired.'; END IF;
  IF _platform IS NOT NULL AND cardinality(cr.rights_platforms) > 0 AND NOT (_platform = ANY(cr.rights_platforms)) THEN
    r := r || ('Rights do not cover ' || _platform || '.'); END IF;
  IF cr.media_source = 'creator_network' THEN
    SELECT * INTO lic FROM public.creator_network_licences WHERE id = cr.cn_licence_id;
    IF NOT FOUND THEN RETURN r || 'Creator licence not found.'; END IF;
    SELECT * INTO job FROM public.creator_network_production_jobs WHERE id = cr.cn_production_job_id;
    SELECT name INTO bname FROM public.brands WHERE id = c.brand_id;
    IF lic.revoked THEN r := r || 'Creator licence revoked.'; END IF;
    IF lic.expires_at IS NOT NULL AND lic.expires_at < current_date THEN r := r || 'Creator licence expired.'; END IF;
    IF lic.starts_at IS NOT NULL AND lic.starts_at > current_date THEN r := r || 'Creator licence not started yet.'; END IF;
    IF c.ends_at IS NOT NULL AND lic.expires_at IS NOT NULL AND c.ends_at::date > lic.expires_at THEN r := r || 'Campaign runs past the licence expiry.'; END IF;
    IF lic.licence_scope <> 'Commercial' OR lic.status NOT IN ('Signed','Active') THEN r := r || 'Preview-only or unsigned licence: not commercially eligible.'; END IF;
    IF NOT lic.likeness_permission THEN r := r || 'Likeness permission missing.'; END IF;
    IF NOT lic.organic_social_permission THEN r := r || 'Organic social permission missing.'; END IF;
    IF lic.brand_id IS NOT NULL AND lic.brand_id <> c.brand_id THEN r := r || 'Licence belongs to a different brand.'; END IF;
    IF bname IS NOT NULL AND lower(bname) = ANY(public.private_network_lower(lic.restricted_brands)) THEN r := r || 'Brand is restricted by the licence.'; END IF;
    IF _platform IS NOT NULL AND cardinality(lic.platforms) > 0 THEN
      fam := split_part(_platform, '_', 1);
      IF NOT EXISTS (SELECT 1 FROM unnest(lic.platforms) p WHERE lower(p) LIKE fam || '%') THEN r := r || ('Licence does not cover ' || fam || '.'); END IF;
    END IF;
    IF cardinality(lic.territories) > 0 AND cardinality(c.target_geographies) > 0
       AND NOT (public.private_network_lower(c.target_geographies) <@ public.private_network_lower(lic.territories)) THEN
      r := r || 'Campaign geography is outside the licence territories.'; END IF;
    IF lic.creator_approval_required AND NOT cr.creator_approval_recorded THEN r := r || 'Creator approval required and not recorded.'; END IF;
    IF job.id IS NULL OR job.creator_id <> lic.creator_id THEN r := r || 'Production job does not match the licence.';
    ELSE
      IF job.clean_master_path IS NULL THEN r := r || 'No clean master: watermarked previews are not distributable.'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.production_job_id = job.id AND pr.stage = 'Human QA' AND pr.decision = 'Approve') THEN
        r := r || 'Human QA approval missing.'; END IF;
    END IF;
    IF NOT cr.private_redistribution_confirmed THEN r := r || 'Explicit private-redistribution rights not confirmed by an operator.'; END IF;
  ELSE
    IF NOT cr.rights_attested THEN r := r || 'Rights attestation missing.'; END IF;
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_list_cn_masters()
RETURNS TABLE(production_job_id uuid, job_code text, creator_id uuid, creator_name text, licence_id uuid, licence_status text, licence_scope text,
  organic boolean, platforms text[], territories text[], expires_at date, revoked boolean, has_clean_master boolean, qa_approved boolean, is_test boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.private_network_is_operator() OR NOT public.creator_network_has_access(auth.uid(), NULL) THEN
    RAISE EXCEPTION 'PN: Needs both Private Network operator and Creator Network access.'; END IF;
  RETURN QUERY
  SELECT j.id, j.code, j.creator_id, cr.display_name, l.id, l.status, l.licence_scope, l.organic_social_permission, l.platforms, l.territories,
         l.expires_at, l.revoked, j.clean_master_path IS NOT NULL,
         EXISTS (SELECT 1 FROM public.creator_network_production_reviews pr WHERE pr.production_job_id = j.id AND pr.stage='Human QA' AND pr.decision='Approve'),
         j.is_test
  FROM public.creator_network_production_jobs j
  JOIN public.creator_network_creators cr ON cr.id = j.creator_id
  JOIN public.creator_network_licences l ON l.creator_id = j.creator_id AND (l.production_job_id = j.id OR l.opportunity_id = j.opportunity_id)
  ORDER BY j.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_add_cn_creative(_campaign uuid, _job uuid, _licence uuid, _caption text, _rights_platforms text[], _rights_expires timestamptz, _creator_approval boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; l record; c record; nid uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_is_operator() OR NOT public.creator_network_has_access(auth.uid(), NULL) THEN
    RAISE EXCEPTION 'PN: Needs both Private Network operator and Creator Network access.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = _campaign;
  SELECT * INTO j FROM public.creator_network_production_jobs WHERE id = _job;
  SELECT * INTO l FROM public.creator_network_licences WHERE id = _licence;
  IF c.id IS NULL OR j.id IS NULL OR l.id IS NULL OR l.creator_id <> j.creator_id THEN RAISE EXCEPTION 'PN: Campaign, job or licence not found / mismatched.'; END IF;
  IF j.clean_master_path IS NULL THEN RAISE EXCEPTION 'PN: Only clean masters can be distributed. Watermarked previews are ineligible.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  INSERT INTO public.private_network_creatives (campaign_id, media_type, media_source, storage_bucket, storage_path, caption, cn_production_job_id, cn_licence_id,
    creator_approval_recorded, rights_platforms, rights_expires_at, status, is_test, created_by)
  VALUES (_campaign, CASE WHEN j.video_project_id IS NOT NULL THEN 'video' ELSE 'image' END, 'creator_network', 'creator-network-assets', j.clean_master_path,
    left(_caption, 2000), _job, _licence, COALESCE(_creator_approval,false), COALESCE(_rights_platforms,'{}'), _rights_expires, 'pending', c.is_test OR j.is_test OR l.is_test, auth.uid())
  RETURNING id INTO nid;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('creative', nid, 'cn_master_added', jsonb_build_object('job', j.code, 'licence', _licence), c.is_test);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_review_creative(_id uuid, _decision text, _reason text DEFAULT NULL, _confirm_private_rights boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cr record; reasons text[];
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'PN: Moderator role required.'; END IF;
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Creative not found.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  IF _decision = 'approve' THEN
    IF cr.media_source = 'creator_network' THEN
      UPDATE public.private_network_creatives SET private_redistribution_confirmed = COALESCE(_confirm_private_rights,false) WHERE id = _id;
    END IF;
    reasons := public.private_network_creative_eligibility(_id, NULL);
    IF cardinality(reasons) > 0 THEN RAISE EXCEPTION 'PN: Not eligible: %', array_to_string(reasons, ' '); END IF;
    UPDATE public.private_network_creatives SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), review_reason=_reason WHERE id=_id;
  ELSIF _decision IN ('reject','revoke') THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    UPDATE public.private_network_creatives SET status = CASE WHEN _decision='reject' THEN 'rejected' ELSE 'revoked' END,
      reviewed_by=auth.uid(), reviewed_at=now(), review_reason=_reason WHERE id=_id;
  ELSE RAISE EXCEPTION 'PN: Unknown decision.'; END IF;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('creative', _id, 'creative_' || _decision, jsonb_build_object('reason', _reason), cr.is_test);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_save_profile(_p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; arr text[]; k text;
BEGIN
  PERFORM public.private_network_require_enabled();
  FOREACH k IN ARRAY ARRAY['languages','interests','communities','industries','affiliations','platforms','audience_geographies','audience_age_brackets'] LOOP
    IF jsonb_typeof(_p->k) IS NOT NULL AND jsonb_typeof(_p->k) <> 'array' THEN RAISE EXCEPTION 'PN: % must be a list.', k; END IF;
    IF jsonb_array_length(COALESCE(_p->k,'[]'::jsonb)) > 20 THEN RAISE EXCEPTION 'PN: Too many % (max 20).', k; END IF;
  END LOOP;
  SELECT COALESCE(array_agg(x), '{}') INTO arr FROM jsonb_array_elements_text(COALESCE(_p->'platforms','[]')) x;
  PERFORM public.private_network_validate_platforms(arr);
  INSERT INTO public.private_network_publishers AS t (user_id, display_name, occupation, location_country, location_state, location_city, age_bracket,
    languages, interests, communities, industries, school, workplace, affiliations, platforms, audience_size_estimate, audience_views_estimate,
    audience_geographies, audience_age_brackets, payout_details)
  VALUES (auth.uid(), left(_p->>'display_name',80), left(_p->>'occupation',120), left(_p->>'location_country',80), left(_p->>'location_state',80),
    left(_p->>'location_city',80), NULLIF(_p->>'age_bracket',''),
    ARRAY(SELECT left(x,60) FROM jsonb_array_elements_text(COALESCE(_p->'languages','[]')) x),
    ARRAY(SELECT left(x,60) FROM jsonb_array_elements_text(COALESCE(_p->'interests','[]')) x),
    ARRAY(SELECT left(x,80) FROM jsonb_array_elements_text(COALESCE(_p->'communities','[]')) x),
    ARRAY(SELECT left(x,60) FROM jsonb_array_elements_text(COALESCE(_p->'industries','[]')) x),
    left(_p->>'school',120), left(_p->>'workplace',120),
    ARRAY(SELECT left(x,80) FROM jsonb_array_elements_text(COALESCE(_p->'affiliations','[]')) x), arr,
    NULLIF(_p->>'audience_size_estimate','')::int, NULLIF(_p->>'audience_views_estimate','')::int,
    ARRAY(SELECT left(x,60) FROM jsonb_array_elements_text(COALESCE(_p->'audience_geographies','[]')) x),
    ARRAY(SELECT left(x,10) FROM jsonb_array_elements_text(COALESCE(_p->'audience_age_brackets','[]')) x),
    COALESCE(_p->'payout_details','{}'::jsonb))
  ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name, occupation=EXCLUDED.occupation, location_country=EXCLUDED.location_country,
    location_state=EXCLUDED.location_state, location_city=EXCLUDED.location_city, age_bracket=EXCLUDED.age_bracket, languages=EXCLUDED.languages,
    interests=EXCLUDED.interests, communities=EXCLUDED.communities, industries=EXCLUDED.industries, school=EXCLUDED.school, workplace=EXCLUDED.workplace,
    affiliations=EXCLUDED.affiliations, platforms=EXCLUDED.platforms, audience_size_estimate=EXCLUDED.audience_size_estimate,
    audience_views_estimate=EXCLUDED.audience_views_estimate, audience_geographies=EXCLUDED.audience_geographies,
    audience_age_brackets=EXCLUDED.audience_age_brackets, payout_details=EXCLUDED.payout_details,
    status = CASE WHEN t.status = 'deleted' THEN 'pending' ELSE t.status END, updated_at=now()
  RETURNING id INTO pid;
  PERFORM public.private_network_log('publisher', pid, 'profile_saved');
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_release_reservation(_campaign uuid, _amount numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.private_network_campaigns WHERE id = _campaign FOR UPDATE;
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET budget_reserved_ngn = GREATEST(budget_reserved_ngn - _amount, 0) WHERE id = _campaign;
  PERFORM set_config('private_network.rpc', 'off', true);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_delete_profile() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.private_network_my_publisher_id(); p record;
BEGIN
  IF auth.uid() IS NULL OR pid IS NULL THEN RAISE EXCEPTION 'PN: No profile.'; END IF;
  FOR p IN SELECT * FROM public.private_network_placements WHERE publisher_id = pid AND status IN ('reserved','share_initiated','rejected') FOR UPDATE LOOP
    PERFORM public.private_network_release_reservation(p.campaign_id, p.reserved_amount);
    UPDATE public.private_network_placements SET status='cancelled', cancelled_at=now(), reserved_amount=0, updated_at=now() WHERE id = p.id;
  END LOOP;
  DELETE FROM public.private_network_likes WHERE publisher_id = pid;
  DELETE FROM public.private_network_saves WHERE publisher_id = pid;
  UPDATE public.private_network_publishers SET status='deleted', display_name=NULL, occupation=NULL, location_country=NULL, location_state=NULL, location_city=NULL,
    age_bracket=NULL, languages='{}', interests='{}', communities='{}', industries='{}', school=NULL, workplace=NULL, affiliations='{}', platforms='{}',
    audience_size_estimate=NULL, audience_views_estimate=NULL, audience_geographies='{}', audience_age_brackets='{}', creator_link_code=NULL,
    creator_link_status='none', creator_id=NULL, payout_details='{}', updated_at=now() WHERE id = pid;
  PERFORM public.private_network_log('publisher', pid, 'profile_deleted');
END $$;

CREATE OR REPLACE FUNCTION public.private_network_submit_creator_link(_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.private_network_my_publisher_id();
BEGIN
  PERFORM public.private_network_require_enabled();
  IF pid IS NULL THEN RAISE EXCEPTION 'PN: Save your profile first.'; END IF;
  IF _code !~ '^[A-Za-z]{3}-[0-9]{3,6}$' THEN RAISE EXCEPTION 'PN: Enter your creator code, e.g. CRT-0001.'; END IF;
  UPDATE public.private_network_publishers SET creator_link_code = upper(_code), creator_link_status='pending', creator_id=NULL, updated_at=now() WHERE id = pid;
  PERFORM public.private_network_log('publisher', pid, 'creator_link_requested');
  RETURN jsonb_build_object('status','pending');
END $$;

CREATE OR REPLACE FUNCTION public.private_network_review_publisher(_id uuid, _decision text, _reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; cid uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'PN: Moderator role required.'; END IF;
  SELECT * INTO p FROM public.private_network_publishers WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR p.status = 'deleted' THEN RAISE EXCEPTION 'PN: Publisher not found.'; END IF;
  IF _decision IN ('suspend','reject') AND COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
  IF _decision = 'approve' THEN UPDATE public.private_network_publishers SET status='approved', status_reason=_reason, updated_at=now() WHERE id=_id;
  ELSIF _decision = 'suspend' THEN UPDATE public.private_network_publishers SET status='suspended', status_reason=_reason, updated_at=now() WHERE id=_id;
  ELSIF _decision = 'reject' THEN UPDATE public.private_network_publishers SET status='rejected', status_reason=_reason, updated_at=now() WHERE id=_id;
  ELSIF _decision IN ('link_verify','link_reject') THEN
    IF _decision = 'link_verify' THEN
      SELECT id INTO cid FROM public.creator_network_creators WHERE code = p.creator_link_code AND (user_id IS NULL OR user_id = p.user_id);
      IF cid IS NULL THEN RAISE EXCEPTION 'PN: Creator code does not match a creator for this person.'; END IF;
      UPDATE public.private_network_publishers SET creator_link_status='verified', creator_id=cid, updated_at=now() WHERE id=_id;
    ELSE UPDATE public.private_network_publishers SET creator_link_status='rejected', creator_id=NULL, updated_at=now() WHERE id=_id; END IF;
  ELSE RAISE EXCEPTION 'PN: Unknown decision.'; END IF;
  PERFORM public.private_network_log('publisher', _id, 'publisher_' || _decision, jsonb_build_object('reason', _reason), p.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_campaign_transition(_id uuid, _to text, _note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; op boolean := public.private_network_has_role(auth.uid(), 'moderator'); owner boolean;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Campaign not found.'; END IF;
  owner := public.has_brand_access(c.brand_id, auth.uid());
  IF NOT (op OR owner) THEN RAISE EXCEPTION 'PN: Not your campaign.'; END IF;
  IF _to = 'pending_review' THEN
    IF c.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'PN: Only drafts can be submitted.'; END IF;
    IF c.budget_ngn <= 0 OR c.base_fee_ngn <= 0 THEN RAISE EXCEPTION 'PN: Set a budget and a base fee per post.'; END IF;
    IF c.budget_ngn < c.base_fee_ngn THEN RAISE EXCEPTION 'PN: Budget is smaller than one base fee.'; END IF;
    IF cardinality(c.target_platforms) = 0 THEN RAISE EXCEPTION 'PN: Choose at least one platform.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.private_network_creatives WHERE campaign_id=_id AND status IN ('pending','approved')) THEN RAISE EXCEPTION 'PN: Add at least one creative.'; END IF;
  ELSIF _to = 'active' THEN
    IF c.status NOT IN ('pending_review','paused') THEN RAISE EXCEPTION 'PN: Campaign cannot be activated from %.', c.status; END IF;
    IF c.status = 'pending_review' AND NOT op THEN RAISE EXCEPTION 'PN: An operator must approve activation.'; END IF;
    IF NOT (c.funding_status = 'funded_manual' OR (c.funding_status = 'test' AND c.is_test)) THEN RAISE EXCEPTION 'PN: Funding has not been recorded by an operator.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.private_network_allowed_domains d WHERE d.brand_id = c.brand_id AND d.host = c.landing_host) THEN
      RAISE EXCEPTION 'PN: Landing domain % is not on the approved list.', c.landing_host; END IF;
    IF c.ends_at IS NOT NULL AND c.ends_at <= now() THEN RAISE EXCEPTION 'PN: Campaign end date has passed.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.private_network_creatives cr WHERE cr.campaign_id=_id AND cr.status='approved'
                   AND cardinality(public.private_network_creative_eligibility(cr.id, NULL)) = 0) THEN
      RAISE EXCEPTION 'PN: No approved creative with valid rights.'; END IF;
  ELSIF _to = 'paused' THEN
    IF c.status <> 'active' THEN RAISE EXCEPTION 'PN: Only active campaigns can be paused.'; END IF;
  ELSIF _to = 'ended' THEN
    IF c.status NOT IN ('active','paused','pending_review','draft') THEN RAISE EXCEPTION 'PN: Campaign already closed.'; END IF;
  ELSIF _to = 'rejected' THEN
    IF NOT op OR c.status <> 'pending_review' THEN RAISE EXCEPTION 'PN: Only an operator can reject a submitted campaign.'; END IF;
    IF COALESCE(btrim(_note),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
  ELSE RAISE EXCEPTION 'PN: Unknown status.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET status=_to, review_note=COALESCE(_note, review_note) WHERE id=_id;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('campaign', _id, 'campaign_' || _to, jsonb_build_object('from', c.status, 'note', _note), c.is_test);
  RETURN jsonb_build_object('status', _to);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_record_funding(_id uuid, _status text, _reference text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id=_id FOR UPDATE;
  IF _status = 'test' AND NOT c.is_test THEN RAISE EXCEPTION 'PN: Test funding is only allowed on TEST campaigns.'; END IF;
  IF _status = 'funded_manual' AND COALESCE(btrim(_reference),'') = '' THEN RAISE EXCEPTION 'PN: A payment reference is required.'; END IF;
  IF _status NOT IN ('unfunded','funded_manual','test') THEN RAISE EXCEPTION 'PN: Unknown funding status.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET funding_status=_status, funding_reference=_reference WHERE id=_id;
  PERFORM set_config('private_network.rpc', 'off', true);
  PERFORM public.private_network_log('campaign', _id, 'funding_' || _status, jsonb_build_object('reference', _reference), c.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_allow_domain(_brand uuid, _host text, _allow boolean DEFAULT true) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'PN: Moderator role required.'; END IF;
  IF _host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN RAISE EXCEPTION 'PN: Invalid host.'; END IF;
  IF _allow THEN INSERT INTO public.private_network_allowed_domains (brand_id, host, approved_by) VALUES (_brand, lower(_host), auth.uid()) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.private_network_allowed_domains WHERE brand_id=_brand AND host=lower(_host); END IF;
  PERFORM public.private_network_log('domain', _brand, CASE WHEN _allow THEN 'domain_allowed' ELSE 'domain_removed' END, jsonb_build_object('host', _host));
END $$;

CREATE OR REPLACE FUNCTION public.private_network_feed(_limit int DEFAULT 12, _offset int DEFAULT 0, _saved_only boolean DEFAULT false)
RETURNS TABLE(creative_id uuid, campaign_id uuid, campaign_code text, campaign_name text, description text, brand_name text, brand_logo text,
  media_type text, media_source text, public_media_url text, caption text, base_fee_ngn numeric, action_bonus_ngn numeric, commission_pct numeric,
  ends_at timestamptz, platforms text[], score int, score_version text, reasons text[], liked boolean, saved boolean, my_placement_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE p record;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO p FROM public.private_network_publishers WHERE user_id = auth.uid();
  IF p.id IS NULL OR p.status <> 'approved' THEN RAISE EXCEPTION 'PN: Your publisher profile is not approved yet.'; END IF;
  _limit := LEAST(GREATEST(COALESCE(_limit,12),1),50); _offset := GREATEST(COALESCE(_offset,0),0);
  RETURN QUERY
  WITH cand AS (
    SELECT cr.id AS cid, c.*, cr.media_type AS mt, cr.media_source AS ms, cr.public_media_url AS pmu, cr.caption AS cap,
      b.name AS bname, b.logo_url AS blogo,
      ARRAY(SELECT unnest(c.target_platforms) INTERSECT SELECT unnest(p.platforms)) AS plats,
      (public.private_network_lower(p.languages) && public.private_network_lower(c.target_languages)) AS lang_ok,
      (public.private_network_lower(p.audience_geographies || ARRAY[p.location_country, p.location_state, p.location_city]) && public.private_network_lower(c.target_geographies)) AS geo_ok,
      (public.private_network_lower(p.interests || p.industries || p.communities) && public.private_network_lower(c.target_interests)) AS int_ok,
      ((p.audience_age_brackets || ARRAY[p.age_bracket]) && c.target_age_brackets) AS age_ok
    FROM public.private_network_creatives cr
    JOIN public.private_network_campaigns c ON c.id = cr.campaign_id
    JOIN public.brands b ON b.id = c.brand_id
    WHERE cr.status = 'approved' AND c.status = 'active' AND c.starts_at <= now() AND (c.ends_at IS NULL OR c.ends_at > now())
      AND c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn >= c.base_fee_ngn
      AND c.target_platforms && p.platforms
      AND (c.min_audience IS NULL OR COALESCE(p.audience_size_estimate,0) >= c.min_audience)
      AND c.is_test = p.is_test
      AND cardinality(public.private_network_creative_eligibility(cr.id, NULL)) = 0
      AND (NOT _saved_only OR EXISTS (SELECT 1 FROM public.private_network_saves s WHERE s.publisher_id = p.id AND s.creative_id = cr.id))
  ), scored AS (
    SELECT cand.*,
      (20 + CASE WHEN cardinality(target_languages)=0 THEN 10 WHEN lang_ok THEN 25 ELSE 0 END
          + CASE WHEN cardinality(target_geographies)=0 THEN 10 WHEN geo_ok THEN 25 ELSE 0 END
          + CASE WHEN cardinality(target_interests)=0 THEN 8 WHEN int_ok THEN 20 ELSE 0 END
          + CASE WHEN cardinality(target_age_brackets)=0 THEN 4 WHEN age_ok THEN 10 ELSE 0 END)::int AS sc,
      array_remove(ARRAY[
        'Platform: ' || array_to_string(plats, ', '),
        CASE WHEN lang_ok THEN 'Language matches the campaign' WHEN cardinality(target_languages)=0 THEN 'Any language' END,
        CASE WHEN geo_ok THEN 'Your audience location matches' WHEN cardinality(target_geographies)=0 THEN 'Any location' END,
        CASE WHEN int_ok THEN 'Your interests or communities match' END,
        CASE WHEN age_ok THEN 'Audience age matches' END
      ], NULL) AS rs
    FROM cand
  )
  SELECT s.cid, s.id, s.code, s.name, s.description, s.bname, s.blogo, s.mt, s.ms, s.pmu, s.cap, s.base_fee_ngn, s.action_bonus_ngn,
    s.conversion_commission_pct, s.ends_at, s.plats, s.sc, 'pn-match-v1'::text, s.rs,
    EXISTS (SELECT 1 FROM public.private_network_likes l WHERE l.publisher_id = p.id AND l.creative_id = s.cid),
    EXISTS (SELECT 1 FROM public.private_network_saves v WHERE v.publisher_id = p.id AND v.creative_id = s.cid),
    (SELECT pl.status FROM public.private_network_placements pl WHERE pl.publisher_id = p.id AND pl.creative_id = s.cid AND pl.status <> 'cancelled' ORDER BY pl.created_at DESC LIMIT 1)
  FROM scored s
  ORDER BY s.sc DESC, s.created_at DESC, s.cid
  LIMIT _limit OFFSET _offset;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_publish(_creative uuid, _platform text, _idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; cr record; c record; ex record; reasons text[]; n int; avail numeric; nid uuid; tok text;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO p FROM public.private_network_publishers WHERE user_id = auth.uid() FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'approved' THEN RAISE EXCEPTION 'PN: Approved publisher profile required.'; END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT * INTO ex FROM public.private_network_placements WHERE publisher_id = p.id AND idempotency_key = _idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('placement_id', ex.id, 'token', ex.token, 'status', ex.status, 'replayed', true); END IF;
  END IF;
  PERFORM _platform::public.private_network_platform;
  SELECT * INTO cr FROM public.private_network_creatives WHERE id = _creative;
  IF cr.id IS NULL OR cr.status <> 'approved' THEN RAISE EXCEPTION 'PN: This creative is not available.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = cr.campaign_id FOR UPDATE;
  IF c.status <> 'active' OR c.starts_at > now() OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN RAISE EXCEPTION 'PN: Campaign is not live.'; END IF;
  IF c.is_test <> p.is_test THEN RAISE EXCEPTION 'PN: Test and live records cannot mix.'; END IF;
  IF NOT (_platform = ANY(c.target_platforms)) OR NOT (_platform = ANY(p.platforms)) THEN RAISE EXCEPTION 'PN: Platform not part of this campaign or your profile.'; END IF;
  reasons := public.private_network_creative_eligibility(_creative, _platform);
  IF cardinality(reasons) > 0 THEN RAISE EXCEPTION 'PN: Not eligible: %', array_to_string(reasons, ' '); END IF;
  SELECT * INTO ex FROM public.private_network_placements WHERE publisher_id=p.id AND creative_id=_creative AND platform=_platform::public.private_network_platform AND status <> 'cancelled';
  IF FOUND THEN RETURN jsonb_build_object('placement_id', ex.id, 'token', ex.token, 'status', ex.status, 'replayed', true); END IF;
  SELECT count(*) INTO n FROM public.private_network_placements WHERE publisher_id=p.id AND campaign_id=c.id AND status <> 'cancelled';
  IF n >= c.per_publisher_cap THEN RAISE EXCEPTION 'PN: You have reached the post limit for this campaign.'; END IF;
  IF c.max_placements IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.private_network_placements WHERE campaign_id=c.id AND status <> 'cancelled';
    IF n >= c.max_placements THEN RAISE EXCEPTION 'PN: Campaign is full.'; END IF;
  END IF;
  avail := c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn;
  IF avail < c.base_fee_ngn THEN RAISE EXCEPTION 'PN: Campaign budget is used up.'; END IF;
  PERFORM set_config('private_network.rpc', 'on', true);
  UPDATE public.private_network_campaigns SET budget_reserved_ngn = budget_reserved_ngn + c.base_fee_ngn WHERE id = c.id;
  PERFORM set_config('private_network.rpc', 'off', true);
  INSERT INTO public.private_network_placements (publisher_id, campaign_id, creative_id, platform, snapshot_base_fee, snapshot_action_bonus,
    snapshot_commission_pct, reserved_amount, idempotency_key, is_test)
  VALUES (p.id, c.id, _creative, _platform::public.private_network_platform, c.base_fee_ngn, c.action_bonus_ngn, c.conversion_commission_pct,
    c.base_fee_ngn, _idempotency_key, c.is_test)
  RETURNING id, token INTO nid, tok;
  PERFORM public.private_network_log('placement', nid, 'reserved', jsonb_build_object('campaign', c.code, 'platform', _platform, 'fee', c.base_fee_ngn), c.is_test);
  RETURN jsonb_build_object('placement_id', nid, 'token', tok, 'status', 'reserved', 'replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_mark_share(_placement uuid, _method text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF _method NOT IN ('native_share','whatsapp_link','download','copy') THEN RAISE EXCEPTION 'PN: Unknown share method.'; END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE id=_placement AND publisher_id = public.private_network_my_publisher_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Placement not found.'; END IF;
  IF pl.status IN ('cancelled','verified') THEN RETURN; END IF;
  UPDATE public.private_network_placements SET status = CASE WHEN status='reserved' THEN 'share_initiated' ELSE status END,
    share_method=_method, share_initiated_at=COALESCE(share_initiated_at, now()), updated_at=now() WHERE id=_placement;
  PERFORM public.private_network_log('placement', _placement, 'share_initiated', jsonb_build_object('method', _method), pl.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_cancel_placement(_placement uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO pl FROM public.private_network_placements WHERE id=_placement AND publisher_id = public.private_network_my_publisher_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Placement not found.'; END IF;
  IF pl.status NOT IN ('reserved','share_initiated','rejected') THEN RAISE EXCEPTION 'PN: This post can no longer be cancelled.'; END IF;
  PERFORM public.private_network_release_reservation(pl.campaign_id, pl.reserved_amount);
  UPDATE public.private_network_placements SET status='cancelled', cancelled_at=now(), reserved_amount=0, updated_at=now() WHERE id=_placement;
  PERFORM public.private_network_log('placement', _placement, 'cancelled', '{}'::jsonb, pl.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_submit_proof(_placement uuid, _path text, _url text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO pl FROM public.private_network_placements WHERE id=_placement AND publisher_id = public.private_network_my_publisher_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Placement not found.'; END IF;
  IF pl.status NOT IN ('reserved','share_initiated','rejected') THEN RAISE EXCEPTION 'PN: Proof cannot be submitted in state %.', pl.status; END IF;
  IF COALESCE(_path,'') = '' AND COALESCE(_url,'') = '' THEN RAISE EXCEPTION 'PN: Add a screenshot or a link to your post.'; END IF;
  IF _path IS NOT NULL AND split_part(_path,'/',1) <> auth.uid()::text THEN RAISE EXCEPTION 'PN: Proof must be in your own folder.'; END IF;
  IF _url IS NOT NULL AND _url !~* '^https://' THEN RAISE EXCEPTION 'PN: Proof link must start with https://'; END IF;
  IF pl.status = 'rejected' AND pl.resubmission_count >= 3 THEN RAISE EXCEPTION 'PN: Resubmission limit reached.'; END IF;
  UPDATE public.private_network_placements SET status='proof_submitted', proof_path=_path, proof_url=_url, proof_note=left(_note,500),
    proof_submitted_at=now(), resubmission_count = resubmission_count + CASE WHEN pl.status='rejected' THEN 1 ELSE 0 END,
    reject_reason=NULL, updated_at=now() WHERE id=_placement;
  PERFORM public.private_network_log('placement', _placement, 'proof_submitted', jsonb_build_object('resubmission', pl.status='rejected'), pl.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_review_proof(_placement uuid, _decision text, _reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'moderator') THEN RAISE EXCEPTION 'PN: Moderator role required.'; END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE id=_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Placement not found.'; END IF;
  IF pl.status <> 'proof_submitted' THEN RAISE EXCEPTION 'PN: Nothing to review (state %).', pl.status; END IF;
  IF _decision = 'verify' THEN
    PERFORM 1 FROM public.private_network_campaigns WHERE id = pl.campaign_id FOR UPDATE;
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_reserved_ngn = GREATEST(budget_reserved_ngn - pl.reserved_amount, 0),
      budget_spent_ngn = budget_spent_ngn + pl.snapshot_base_fee WHERE id = pl.campaign_id;
    PERFORM set_config('private_network.rpc', 'off', true);
    UPDATE public.private_network_placements SET status='verified', verified_at=now(), reviewed_by=auth.uid(), reviewed_at=now(), reserved_amount=0, updated_at=now() WHERE id=_placement;
    INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, entry_type, bucket, amount, idempotency_key, created_by, is_test)
    VALUES (pl.publisher_id, pl.id, pl.campaign_id, 'base_fee', 'pending', pl.snapshot_base_fee, 'base:' || pl.id, auth.uid(), pl.is_test)
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSIF _decision = 'reject' THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    UPDATE public.private_network_placements SET status='rejected', reject_reason=_reason, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_placement;
  ELSIF _decision = 'reject_final' THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    PERFORM public.private_network_release_reservation(pl.campaign_id, pl.reserved_amount);
    UPDATE public.private_network_placements SET status='cancelled', reject_reason=_reason, cancelled_at=now(), reserved_amount=0, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_placement;
  ELSE RAISE EXCEPTION 'PN: Unknown decision.'; END IF;
  PERFORM public.private_network_log('placement', _placement, 'proof_' || _decision, jsonb_build_object('reason', _reason), pl.is_test);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_resolve_redirect(_token text, _ip_hash text, _ua_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record; c record; recent int; dup boolean; dest text;
BEGIN
  IF NOT public.private_network_enabled() THEN RETURN jsonb_build_object('ok', false, 'reason', 'off'); END IF;
  IF _token !~ '^pn[0-9a-f]{32}$' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE token = _token;
  IF NOT FOUND OR pl.status NOT IN ('share_initiated','proof_submitted','verified','reserved') THEN RETURN jsonb_build_object('ok', false, 'reason', 'unavailable'); END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = pl.campaign_id;
  IF c.status NOT IN ('active','paused') OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN RETURN jsonb_build_object('ok', false, 'reason', 'ended'); END IF;
  IF cardinality(public.private_network_creative_eligibility(pl.creative_id, pl.platform::text)) > 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'rights'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.private_network_allowed_domains d WHERE d.brand_id = c.brand_id AND d.host = c.landing_host) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'domain'); END IF;
  dest := c.landing_url || CASE WHEN position('?' in c.landing_url) > 0 THEN '&' ELSE '?' END || 'pn_ref=' || pl.token;
  SELECT count(*) INTO recent FROM public.private_network_events WHERE ip_hash = _ip_hash AND created_at > now() - interval '10 minutes';
  IF recent >= 30 THEN RETURN jsonb_build_object('ok', true, 'url', dest, 'counted', false, 'reason', 'rate_limited'); END IF;
  dup := EXISTS (SELECT 1 FROM public.private_network_events WHERE placement_id = pl.id AND event_type='click' AND ip_hash = _ip_hash AND created_at > now() - interval '24 hours');
  INSERT INTO public.private_network_events (placement_id, event_type, source, ip_hash, ua_hash, outcome, is_test)
  VALUES (pl.id, 'click', 'redirect', _ip_hash, _ua_hash, CASE WHEN dup THEN 'duplicate' ELSE 'counted' END, pl.is_test);
  IF NOT dup THEN UPDATE public.private_network_placements SET clicks = clicks + 1 WHERE id = pl.id; END IF;
  RETURN jsonb_build_object('ok', true, 'url', dest, 'counted', NOT dup);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_ingest_event(_caller uuid, _token text, _type text, _external_id text, _amount numeric, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl record; c record; pub record; eid uuid; earn numeric := 0; outcome text := 'recorded'; recent int; avail numeric;
BEGIN
  IF NOT public.private_network_enabled() THEN RAISE EXCEPTION 'PN: Private Network is switched off.'; END IF;
  IF _type NOT IN ('qualified_action','conversion') THEN RAISE EXCEPTION 'PN: Unknown event type.'; END IF;
  IF COALESCE(btrim(_external_id),'') = '' OR length(_external_id) > 200 THEN RAISE EXCEPTION 'PN: external_event_id required.'; END IF;
  SELECT * INTO pl FROM public.private_network_placements WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Unknown reference.'; END IF;
  SELECT * INTO c FROM public.private_network_campaigns WHERE id = pl.campaign_id FOR UPDATE;
  IF NOT (public.private_network_has_role(_caller, NULL) OR public.has_brand_access(c.brand_id, _caller)) THEN RAISE EXCEPTION 'PN: Caller cannot report events for this campaign.'; END IF;
  SELECT * INTO pub FROM public.private_network_publishers WHERE id = pl.publisher_id;
  IF EXISTS (SELECT 1 FROM public.private_network_events WHERE source='server' AND external_event_id = _external_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  SELECT count(*) INTO recent FROM public.private_network_events WHERE caller_user_id = _caller AND created_at > now() - interval '1 minute';
  IF recent >= 120 THEN RAISE EXCEPTION 'PN: Rate limit exceeded.'; END IF;
  IF _type = 'conversion' AND (_amount IS NULL OR _amount <= 0) THEN RAISE EXCEPTION 'PN: Conversion amount required.'; END IF;
  IF (_actor IS NOT NULL AND _actor = pub.user_id) OR _caller = pub.user_id THEN outcome := 'rejected_self_action';
  ELSIF pl.status <> 'verified' THEN outcome := 'withheld_unverified_post';
  ELSIF c.status NOT IN ('active','paused','ended') THEN outcome := 'withheld_campaign_state';
  ELSE
    earn := CASE WHEN _type='qualified_action' THEN pl.snapshot_action_bonus ELSE round(_amount * pl.snapshot_commission_pct / 100, 2) END;
    avail := c.budget_ngn - c.budget_reserved_ngn - c.budget_spent_ngn;
    IF earn <= 0 THEN outcome := 'no_reward_configured'; earn := 0;
    ELSIF avail < earn THEN outcome := 'withheld_budget_exhausted'; earn := 0;
    ELSE outcome := 'earned'; END IF;
  END IF;
  INSERT INTO public.private_network_events (placement_id, event_type, source, external_event_id, amount, actor_user_id, caller_user_id, outcome, earned_amount, is_test)
  VALUES (pl.id, _type, 'server', _external_id, _amount, _actor, _caller, outcome, earn, pl.is_test) RETURNING id INTO eid;
  IF outcome = 'earned' THEN
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_spent_ngn = budget_spent_ngn + earn WHERE id = c.id;
    PERFORM set_config('private_network.rpc', 'off', true);
    INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, event_id, entry_type, bucket, amount, idempotency_key, created_by, is_test)
    VALUES (pl.publisher_id, pl.id, c.id, eid, CASE WHEN _type='qualified_action' THEN 'action_bonus' ELSE 'conversion_commission' END, 'pending', earn, 'evt:' || eid, _caller, pl.is_test);
  END IF;
  IF outcome NOT LIKE 'rejected%' THEN
    UPDATE public.private_network_placements SET leads = leads + CASE WHEN _type='qualified_action' THEN 1 ELSE 0 END,
      conversions = conversions + CASE WHEN _type='conversion' THEN 1 ELSE 0 END WHERE id = pl.id;
  END IF;
  INSERT INTO public.private_network_activity_log (actor_id, entity_type, entity_id, action, details, is_test)
  VALUES (_caller, 'event', eid, _type, jsonb_build_object('outcome', outcome, 'earned', earn, 'external_id', _external_id), pl.is_test);
  RETURN jsonb_build_object('ok', true, 'event_id', eid, 'outcome', outcome, 'earned', earn);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_balance(_publisher uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pending', COALESCE(sum(amount) FILTER (WHERE bucket='pending'),0),
    'available', COALESCE(sum(amount) FILTER (WHERE bucket='available'),0),
    'paid', COALESCE(sum(amount) FILTER (WHERE bucket='paid'),0),
    'reversed', COALESCE(-sum(amount) FILTER (WHERE entry_type='reversal'),0),
    'requested', COALESCE((SELECT sum(amount) FROM public.private_network_payouts WHERE publisher_id=_publisher AND status IN ('requested','approved')),0))
  FROM public.private_network_ledger WHERE publisher_id = _publisher
    AND (_publisher = public.private_network_my_publisher_id() OR public.private_network_is_operator())
$$;

CREATE OR REPLACE FUNCTION public.private_network_release_pending(_publisher uuid) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE amt numeric; p record; k text := gen_random_uuid()::text;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  SELECT * INTO p FROM public.private_network_publishers WHERE id=_publisher FOR UPDATE;
  SELECT COALESCE(sum(amount),0) INTO amt FROM public.private_network_ledger WHERE publisher_id=_publisher AND bucket='pending';
  IF amt <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.private_network_ledger (publisher_id, entry_type, bucket, amount, idempotency_key, created_by, is_test, note)
  VALUES (_publisher, 'release', 'pending', -amt, 'rel-out:' || k, auth.uid(), p.is_test, 'Released to available'),
         (_publisher, 'release', 'available', amt, 'rel-in:' || k, auth.uid(), p.is_test, 'Released to available');
  PERFORM public.private_network_log('publisher', _publisher, 'earnings_released', jsonb_build_object('amount', amt), p.is_test);
  RETURN amt;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_request_payout(_amount numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; avail numeric; nid uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT * INTO p FROM public.private_network_publishers WHERE user_id=auth.uid() FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'approved' THEN RAISE EXCEPTION 'PN: Approved publisher profile required.'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'PN: Enter an amount.'; END IF;
  IF COALESCE(p.payout_details->>'account_number','') = '' THEN RAISE EXCEPTION 'PN: Add your payout account in Profile first.'; END IF;
  IF EXISTS (SELECT 1 FROM public.private_network_payouts WHERE publisher_id=p.id AND status IN ('requested','approved')) THEN RAISE EXCEPTION 'PN: You already have a payout in progress.'; END IF;
  SELECT COALESCE(sum(amount),0) INTO avail FROM public.private_network_ledger WHERE publisher_id=p.id AND bucket='available';
  IF _amount > avail THEN RAISE EXCEPTION 'PN: Amount is more than your available balance.'; END IF;
  INSERT INTO public.private_network_payouts (publisher_id, amount, payout_details, is_test) VALUES (p.id, _amount, p.payout_details, p.is_test) RETURNING id INTO nid;
  PERFORM public.private_network_log('payout', nid, 'payout_requested', jsonb_build_object('amount', _amount), p.is_test);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_review_payout(_id uuid, _decision text, _reference text DEFAULT NULL, _reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po record; avail numeric;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  SELECT * INTO po FROM public.private_network_payouts WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PN: Payout not found.'; END IF;
  PERFORM 1 FROM public.private_network_publishers WHERE id=po.publisher_id FOR UPDATE;
  IF _decision = 'approve' AND po.status = 'requested' THEN
    UPDATE public.private_network_payouts SET status='approved', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_id;
  ELSIF _decision = 'reject' AND po.status IN ('requested','approved') THEN
    IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
    UPDATE public.private_network_payouts SET status='rejected', reason=_reason, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_id;
  ELSIF _decision = 'paid' AND po.status = 'approved' THEN
    IF COALESCE(btrim(_reference),'') = '' THEN RAISE EXCEPTION 'PN: Settlement reference required.'; END IF;
    SELECT COALESCE(sum(amount),0) INTO avail FROM public.private_network_ledger WHERE publisher_id=po.publisher_id AND bucket='available';
    IF avail < po.amount THEN RAISE EXCEPTION 'PN: Insufficient available balance.'; END IF;
    INSERT INTO public.private_network_ledger (publisher_id, payout_id, entry_type, bucket, amount, idempotency_key, created_by, is_test, note)
    VALUES (po.publisher_id, po.id, 'payout', 'available', -po.amount, 'payout-out:' || po.id, auth.uid(), po.is_test, _reference),
           (po.publisher_id, po.id, 'payout', 'paid', po.amount, 'payout-in:' || po.id, auth.uid(), po.is_test, _reference);
    UPDATE public.private_network_payouts SET status='paid', reference=_reference, paid_at=now(), reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() WHERE id=_id;
  ELSE RAISE EXCEPTION 'PN: Cannot % a payout in state %.', _decision, po.status; END IF;
  PERFORM public.private_network_log('payout', _id, 'payout_' || _decision, jsonb_build_object('reference', _reference, 'reason', _reason), po.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_reverse_entry(_entry uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; bal numeric;
BEGIN
  PERFORM public.private_network_require_enabled();
  IF NOT public.private_network_has_role(auth.uid(), 'finance') THEN RAISE EXCEPTION 'PN: Finance role required.'; END IF;
  IF COALESCE(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'PN: A reason is required.'; END IF;
  SELECT * INTO e FROM public.private_network_ledger WHERE id=_entry;
  IF NOT FOUND OR e.entry_type NOT IN ('base_fee','action_bonus','conversion_commission') THEN RAISE EXCEPTION 'PN: Only earning entries can be reversed.'; END IF;
  PERFORM 1 FROM public.private_network_publishers WHERE id=e.publisher_id FOR UPDATE;
  SELECT COALESCE(sum(amount),0) INTO bal FROM public.private_network_ledger WHERE publisher_id=e.publisher_id AND bucket='pending';
  IF bal < e.amount THEN RAISE EXCEPTION 'PN: Earning already released; reverse before release or adjust manually.'; END IF;
  INSERT INTO public.private_network_ledger (publisher_id, placement_id, campaign_id, entry_type, bucket, amount, idempotency_key, created_by, is_test, note)
  VALUES (e.publisher_id, e.placement_id, e.campaign_id, 'reversal', 'pending', -e.amount, 'rev:' || e.id, auth.uid(), e.is_test, _reason);
  IF e.campaign_id IS NOT NULL THEN
    PERFORM set_config('private_network.rpc', 'on', true);
    UPDATE public.private_network_campaigns SET budget_spent_ngn = GREATEST(budget_spent_ngn - e.amount, 0) WHERE id = e.campaign_id;
    PERFORM set_config('private_network.rpc', 'off', true);
  END IF;
  PERFORM public.private_network_log('ledger', _entry, 'reversed', jsonb_build_object('reason', _reason, 'amount', e.amount), e.is_test);
END $$;

CREATE OR REPLACE FUNCTION public.private_network_my_placements()
RETURNS TABLE(id uuid, token text, status text, platform text, campaign_name text, campaign_code text, brand_name text, creative_id uuid,
  media_type text, caption text, base_fee numeric, action_bonus numeric, commission_pct numeric, share_method text, share_initiated_at timestamptz,
  proof_submitted_at timestamptz, proof_url text, reject_reason text, resubmission_count int, verified_at timestamptz, clicks int, leads int,
  conversions int, earned numeric, created_at timestamptz, campaign_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.private_network_require_enabled();
  RETURN QUERY SELECT pl.id, pl.token, pl.status, pl.platform::text, c.name, c.code, b.name, pl.creative_id, cr.media_type, cr.caption,
    pl.snapshot_base_fee, pl.snapshot_action_bonus, pl.snapshot_commission_pct, pl.share_method, pl.share_initiated_at, pl.proof_submitted_at, pl.proof_url,
    pl.reject_reason, pl.resubmission_count, pl.verified_at, pl.clicks, pl.leads, pl.conversions,
    COALESCE((SELECT sum(l.amount) FROM public.private_network_ledger l WHERE l.placement_id = pl.id AND l.entry_type IN ('base_fee','action_bonus','conversion_commission','reversal')),0),
    pl.created_at, c.status
  FROM public.private_network_placements pl
  JOIN public.private_network_campaigns c ON c.id = pl.campaign_id
  JOIN public.private_network_creatives cr ON cr.id = pl.creative_id
  JOIN public.brands b ON b.id = c.brand_id
  WHERE pl.publisher_id = public.private_network_my_publisher_id()
  ORDER BY pl.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.private_network_metrics(_include_test boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.private_network_is_operator() THEN RAISE EXCEPTION 'PN: Operator only.'; END IF;
  RETURN jsonb_build_object(
    'publishers', (SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.private_network_publishers WHERE _include_test OR NOT is_test GROUP BY status) s),
    'campaigns', (SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.private_network_campaigns WHERE _include_test OR NOT is_test GROUP BY status) s),
    'placements', (SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM public.private_network_placements WHERE _include_test OR NOT is_test GROUP BY status) s),
    'clicks', (SELECT COALESCE(sum(clicks),0) FROM public.private_network_placements WHERE _include_test OR NOT is_test),
    'leads', (SELECT COALESCE(sum(leads),0) FROM public.private_network_placements WHERE _include_test OR NOT is_test),
    'conversions', (SELECT COALESCE(sum(conversions),0) FROM public.private_network_placements WHERE _include_test OR NOT is_test),
    'budget', (SELECT jsonb_build_object('total', COALESCE(sum(budget_ngn),0), 'reserved', COALESCE(sum(budget_reserved_ngn),0), 'spent', COALESCE(sum(budget_spent_ngn),0))
               FROM public.private_network_campaigns WHERE (_include_test OR NOT is_test) AND funding_status <> 'unfunded'),
    'ledger', (SELECT jsonb_object_agg(bucket, total) FROM (SELECT bucket, sum(amount) total FROM public.private_network_ledger WHERE _include_test OR NOT is_test GROUP BY bucket) s),
    'payouts', (SELECT jsonb_object_agg(status, total) FROM (SELECT status, sum(amount) total FROM public.private_network_payouts WHERE _include_test OR NOT is_test GROUP BY status) s));
END $$;

CREATE OR REPLACE FUNCTION public.private_network_set_enabled(_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'PN: Brandie admin only.'; END IF;
  UPDATE public.private_network_settings SET enabled=_enabled, updated_by=auth.uid(), updated_at=now() WHERE id;
  PERFORM public.private_network_log('settings', NULL, CASE WHEN _enabled THEN 'enabled' ELSE 'disabled' END);
END $$;
CREATE OR REPLACE FUNCTION public.private_network_set_member(_email text, _role text, _add boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'PN: Brandie admin only.'; END IF;
  IF _role NOT IN ('admin','moderator','finance') THEN RAISE EXCEPTION 'PN: Unknown role.'; END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(btrim(_email));
  IF uid IS NULL THEN RAISE EXCEPTION 'PN: No account with that email.'; END IF;
  IF _add THEN INSERT INTO public.private_network_members (user_id, role, created_by) VALUES (uid, _role, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.private_network_members WHERE user_id=uid AND role=_role; END IF;
  PERFORM public.private_network_log('member', uid, CASE WHEN _add THEN 'member_added' ELSE 'member_removed' END, jsonb_build_object('role', _role));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'private_network_enabled()','private_network_has_role(uuid,text)','private_network_is_operator()','private_network_my_publisher_id()',
    'private_network_creative_eligibility(uuid,text)','private_network_list_cn_masters()',
    'private_network_add_cn_creative(uuid,uuid,uuid,text,text[],timestamptz,boolean)','private_network_review_creative(uuid,text,text,boolean)',
    'private_network_save_profile(jsonb)','private_network_delete_profile()','private_network_submit_creator_link(text)',
    'private_network_review_publisher(uuid,text,text)','private_network_campaign_transition(uuid,text,text)',
    'private_network_record_funding(uuid,text,text)','private_network_allow_domain(uuid,text,boolean)','private_network_feed(int,int,boolean)',
    'private_network_publish(uuid,text,text)','private_network_mark_share(uuid,text)','private_network_cancel_placement(uuid)',
    'private_network_submit_proof(uuid,text,text,text)','private_network_review_proof(uuid,text,text)','private_network_balance(uuid)',
    'private_network_release_pending(uuid)','private_network_request_payout(numeric)','private_network_review_payout(uuid,text,text,text)',
    'private_network_reverse_entry(uuid,text)','private_network_my_placements()','private_network_metrics(boolean)',
    'private_network_set_enabled(boolean)','private_network_set_member(text,text,boolean)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || f || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || f || ' TO authenticated, service_role';
  END LOOP;
  FOREACH f IN ARRAY ARRAY['private_network_resolve_redirect(text,text,text)','private_network_ingest_event(uuid,text,text,text,numeric,uuid)',
    'private_network_log(text,uuid,text,jsonb,boolean)','private_network_release_reservation(uuid,numeric)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || f || ' FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || f || ' TO service_role';
  END LOOP;
END $$;

CREATE POLICY pn_proofs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'private-network-proofs' AND (storage.foldername(name))[1] = auth.uid()::text AND public.private_network_enabled());
CREATE POLICY pn_proofs_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'private-network-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.private_network_is_operator()));
CREATE POLICY pn_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'private-network-media' AND public.private_network_enabled()
    AND EXISTS (SELECT 1 FROM public.brands b WHERE b.id::text = (storage.foldername(name))[1] AND public.has_brand_access(b.id, auth.uid())));
CREATE POLICY pn_media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'private-network-media' AND (public.private_network_is_operator()
    OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id::text = (storage.foldername(name))[1] AND public.has_brand_access(b.id, auth.uid()))));

COMMENT ON TABLE public.private_network_ledger IS 'Private Network earnings ledger. Append-only, double-entry buckets; separate from affiliate ledger.';
