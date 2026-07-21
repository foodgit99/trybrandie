
-- 1. Heartbeat column
ALTER TABLE public.design_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_design_jobs_running_heartbeat
  ON public.design_jobs (heartbeat_at)
  WHERE status = 'running';

-- 2. Stall-finalizer function: fail any running job whose heartbeat is stale.
CREATE OR REPLACE FUNCTION public.finalize_stalled_design_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.design_jobs
    SET status = 'failed',
        error = jsonb_build_object(
          'message', 'worker_timeout',
          'detail', 'Job exceeded edge runtime wall-time without heartbeat'
        ),
        finished_at = now()
    WHERE status = 'running'
      AND COALESCE(heartbeat_at, started_at, created_at) < now() - interval '3 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- 3. Schedule watchdog every minute
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('finalize-stalled-design-jobs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-stalled-design-jobs');
    PERFORM cron.schedule(
      'finalize-stalled-design-jobs',
      '* * * * *',
      $cron$ SELECT public.finalize_stalled_design_jobs(); $cron$
    );
  END IF;
END $$;
