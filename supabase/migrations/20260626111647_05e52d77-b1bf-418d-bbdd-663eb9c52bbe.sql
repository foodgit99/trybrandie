
-- ============ CONTACTS ============
CREATE TABLE public.marketing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('pending','subscribed','unsubscribed','bounced','complained')),
  source text,
  consent_at timestamptz,
  double_opt_in_token text,
  timezone text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_contacts TO authenticated;
GRANT ALL ON public.marketing_contacts TO service_role;
ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team can read contacts" ON public.marketing_contacts FOR SELECT TO authenticated USING (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "team can write contacts" ON public.marketing_contacts FOR INSERT TO authenticated WITH CHECK (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "team can update contacts" ON public.marketing_contacts FOR UPDATE TO authenticated USING (public.has_brand_access(brand_id, auth.uid()));
CREATE POLICY "team can delete contacts" ON public.marketing_contacts FOR DELETE TO authenticated USING (public.has_brand_access(brand_id, auth.uid()));
CREATE TRIGGER trg_marketing_contacts_updated BEFORE UPDATE ON public.marketing_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_marketing_contacts_brand_status ON public.marketing_contacts(brand_id, status);
CREATE INDEX idx_marketing_contacts_tags ON public.marketing_contacts USING gin(tags);

-- ============ SEGMENTS ============
CREATE TABLE public.marketing_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rules jsonb NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_segments TO authenticated;
GRANT ALL ON public.marketing_segments TO service_role;
ALTER TABLE public.marketing_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team can manage segments" ON public.marketing_segments FOR ALL TO authenticated USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));
CREATE TRIGGER trg_marketing_segments_updated BEFORE UPDATE ON public.marketing_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SIGNUP FORMS ============
CREATE TABLE public.email_signup_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  headline text,
  description text,
  success_message text DEFAULT 'Thanks! Check your inbox to confirm.',
  redirect_url text,
  default_tags text[] NOT NULL DEFAULT '{}',
  double_opt_in boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_signup_forms TO authenticated;
GRANT SELECT ON public.email_signup_forms TO anon;
GRANT ALL ON public.email_signup_forms TO service_role;
ALTER TABLE public.email_signup_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active forms" ON public.email_signup_forms FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "team manage forms" ON public.email_signup_forms FOR ALL TO authenticated USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- ============ BROADCASTS ============
CREATE TABLE public.email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  idea_id uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.marketing_segments(id) ON DELETE SET NULL,
  funnel_stage_id uuid REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  preheader text,
  body_md text,
  body_html text,
  cta_label text,
  cta_url text,
  template_key text DEFAULT 'classic',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','approved','sending','sent','failed','cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  opens_count integer NOT NULL DEFAULT 0,
  clicks_count integer NOT NULL DEFAULT 0,
  unsubs_count integer NOT NULL DEFAULT 0,
  bounces_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  ai_alt_subjects jsonb,
  deliverability_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_broadcasts TO authenticated;
GRANT ALL ON public.email_broadcasts TO service_role;
ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manage broadcasts" ON public.email_broadcasts FOR ALL TO authenticated USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));
CREATE TRIGGER trg_email_broadcasts_updated BEFORE UPDATE ON public.email_broadcasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_email_broadcasts_brand_status ON public.email_broadcasts(brand_id, status, scheduled_for);

-- ============ SENDS ============
CREATE TABLE public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid REFERENCES public.email_broadcasts(id) ON DELETE CASCADE,
  journey_enrollment_id uuid,
  contact_id uuid NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','bounced','complained','suppressed')),
  error_message text,
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  revenue_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, contact_id)
);
GRANT SELECT ON public.email_sends TO authenticated;
GRANT ALL ON public.email_sends TO service_role;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read sends" ON public.email_sends FOR SELECT TO authenticated USING (public.has_brand_access(brand_id, auth.uid()));
CREATE INDEX idx_email_sends_broadcast ON public.email_sends(broadcast_id);
CREATE INDEX idx_email_sends_contact ON public.email_sends(contact_id);

-- ============ LINKS ============
CREATE TABLE public.email_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.email_broadcasts(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  url text NOT NULL,
  label text,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_links TO authenticated;
GRANT ALL ON public.email_links TO service_role;
ALTER TABLE public.email_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read links" ON public.email_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.email_broadcasts b WHERE b.id = broadcast_id AND public.has_brand_access(b.brand_id, auth.uid())));

-- ============ JOURNEYS ============
CREATE TABLE public.marketing_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('signup','tag_added','purchase','inactivity','manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_journeys TO authenticated;
GRANT ALL ON public.marketing_journeys TO service_role;
ALTER TABLE public.marketing_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manage journeys" ON public.marketing_journeys FOR ALL TO authenticated USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));
CREATE TRIGGER trg_marketing_journeys_updated BEFORE UPDATE ON public.marketing_journeys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.marketing_journeys(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  wait_minutes integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  preheader text,
  body_md text NOT NULL,
  cta_label text,
  cta_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_journey_steps TO authenticated;
GRANT ALL ON public.marketing_journey_steps TO service_role;
ALTER TABLE public.marketing_journey_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manage journey steps" ON public.marketing_journey_steps FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.marketing_journeys j WHERE j.id = journey_id AND public.has_brand_access(j.brand_id, auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.marketing_journeys j WHERE j.id = journey_id AND public.has_brand_access(j.brand_id, auth.uid())));

CREATE TABLE public.marketing_journey_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.marketing_journeys(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','failed')),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, contact_id)
);
GRANT SELECT ON public.marketing_journey_enrollments TO authenticated;
GRANT ALL ON public.marketing_journey_enrollments TO service_role;
ALTER TABLE public.marketing_journey_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read enrollments" ON public.marketing_journey_enrollments FOR SELECT TO authenticated USING (public.has_brand_access(brand_id, auth.uid()));
CREATE INDEX idx_journey_enrollments_due ON public.marketing_journey_enrollments(status, next_run_at);

-- ============ PREFERENCES ============
CREATE TABLE public.email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL UNIQUE REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  promotions boolean NOT NULL DEFAULT true,
  newsletters boolean NOT NULL DEFAULT true,
  product_updates boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_preferences TO authenticated;
GRANT ALL ON public.email_preferences TO service_role;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manage prefs" ON public.email_preferences FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.marketing_contacts c WHERE c.id = contact_id AND public.has_brand_access(c.brand_id, auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.marketing_contacts c WHERE c.id = contact_id AND public.has_brand_access(c.brand_id, auth.uid())));

-- ============ SUPPRESSION ============
CREATE TABLE public.marketing_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, email)
);
GRANT SELECT, INSERT, DELETE ON public.marketing_suppression TO authenticated;
GRANT ALL ON public.marketing_suppression TO service_role;
ALTER TABLE public.marketing_suppression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manage suppression" ON public.marketing_suppression FOR ALL TO authenticated USING (public.has_brand_access(brand_id, auth.uid())) WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- ============ AUTOPILOT SETTINGS extension ============
ALTER TABLE public.autopilot_settings
  ADD COLUMN IF NOT EXISTS marketing_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_email_frequency_cap integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS marketing_email_quiet_hours_start integer NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS marketing_email_quiet_hours_end integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS marketing_email_reply_to text,
  ADD COLUMN IF NOT EXISTS marketing_email_from_name text,
  ADD COLUMN IF NOT EXISTS marketing_email_physical_address text;
