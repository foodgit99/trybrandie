-- =========================
-- Partner campaigns
-- =========================
CREATE TABLE public.partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  preheader text,
  body text NOT NULL DEFAULT '',
  audience jsonb NOT NULL DEFAULT '{"statuses": []}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_campaigns TO authenticated;
GRANT ALL ON public.partner_campaigns TO service_role;
ALTER TABLE public.partner_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners manage their own campaigns"
ON public.partner_campaigns FOR ALL TO authenticated
USING (partner_id = public.partner_id_for_user(auth.uid()))
WITH CHECK (partner_id = public.partner_id_for_user(auth.uid()));

CREATE POLICY "Admins view all partner campaigns"
ON public.partner_campaigns FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_campaigns_updated
BEFORE UPDATE ON public.partner_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_partner_campaigns_partner ON public.partner_campaigns(partner_id, created_at DESC);
CREATE INDEX idx_partner_campaigns_due ON public.partner_campaigns(status, scheduled_for);

-- =========================
-- Campaign sends
-- =========================
CREATE TABLE public.partner_campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.partner_campaigns(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  lead_user_id uuid NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_id text,
  error text,
  opened_at timestamptz,
  clicked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_campaign_sends TO authenticated;
GRANT ALL ON public.partner_campaign_sends TO service_role;
ALTER TABLE public.partner_campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view their own campaign sends"
ON public.partner_campaign_sends FOR SELECT TO authenticated
USING (partner_id = public.partner_id_for_user(auth.uid()));

CREATE POLICY "Admins view all partner campaign sends"
ON public.partner_campaign_sends FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_partner_campaign_sends_campaign ON public.partner_campaign_sends(campaign_id);

-- =========================
-- Automations
-- =========================
CREATE TABLE public.partner_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger text NOT NULL,
  delay_hours integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  body text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sent_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_automations TO authenticated;
GRANT ALL ON public.partner_automations TO service_role;
ALTER TABLE public.partner_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners manage their own automations"
ON public.partner_automations FOR ALL TO authenticated
USING (partner_id = public.partner_id_for_user(auth.uid()))
WITH CHECK (partner_id = public.partner_id_for_user(auth.uid()));

CREATE POLICY "Admins view all partner automations"
ON public.partner_automations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_automations_updated
BEFORE UPDATE ON public.partner_automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_partner_automations_partner ON public.partner_automations(partner_id);

-- =========================
-- Automation runs (idempotency)
-- =========================
CREATE TABLE public.partner_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.partner_automations(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  lead_user_id uuid NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, lead_user_id)
);

GRANT SELECT ON public.partner_automation_runs TO authenticated;
GRANT ALL ON public.partner_automation_runs TO service_role;
ALTER TABLE public.partner_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view their own automation runs"
ON public.partner_automation_runs FOR SELECT TO authenticated
USING (partner_id = public.partner_id_for_user(auth.uid()));

CREATE POLICY "Admins view all partner automation runs"
ON public.partner_automation_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_partner_automation_runs_automation ON public.partner_automation_runs(automation_id);

-- =========================
-- Suppression
-- =========================
CREATE TABLE public.partner_email_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, email)
);

GRANT SELECT ON public.partner_email_suppression TO authenticated;
GRANT ALL ON public.partner_email_suppression TO service_role;
ALTER TABLE public.partner_email_suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view their own suppression list"
ON public.partner_email_suppression FOR SELECT TO authenticated
USING (partner_id = public.partner_id_for_user(auth.uid()));

CREATE POLICY "Admins view all partner suppression"
ON public.partner_email_suppression FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- Hourly tick for automations + scheduled campaigns
-- =========================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('partner-automation-tick')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'partner-automation-tick');
    PERFORM cron.schedule(
      'partner-automation-tick',
      '7 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://pcmwvadretlclaljhzpv.supabase.co/functions/v1/partner-automation-tick',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"source": "cron"}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;