CREATE TABLE IF NOT EXISTS public.notification_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  to_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_email_outbox TO authenticated;
GRANT ALL ON public.notification_email_outbox TO service_role;

ALTER TABLE public.notification_email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view notification outbox" ON public.notification_email_outbox;
CREATE POLICY "Admins view notification outbox"
ON public.notification_email_outbox FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS notification_email_outbox_due_idx
  ON public.notification_email_outbox (status, next_attempt_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('notification-email-retry')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-email-retry');
    PERFORM cron.schedule(
      'notification-email-retry',
      '*/10 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://pcmwvadretlclaljhzpv.supabase.co/functions/v1/notification-email-retry',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"source": "cron"}'::jsonb,
        timeout_milliseconds := 30000
      );
      $cron$
    );
  END IF;
END $$;