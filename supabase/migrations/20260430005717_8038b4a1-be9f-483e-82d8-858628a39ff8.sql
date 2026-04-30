-- Phase 2: Autopilot mode + planner schema
ALTER TABLE public.autopilot_settings
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'assisted',
  ADD COLUMN IF NOT EXISTS min_queue_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS weekly_plan_last_run timestamptz;

ALTER TABLE public.autopilot_settings
  DROP CONSTRAINT IF EXISTS autopilot_settings_mode_check;
ALTER TABLE public.autopilot_settings
  ADD CONSTRAINT autopilot_settings_mode_check
  CHECK (mode IN ('manual', 'assisted', 'autonomous'));

-- Backfill mode based on existing enabled flag
UPDATE public.autopilot_settings
SET mode = CASE WHEN enabled THEN 'assisted' ELSE 'manual' END
WHERE mode = 'assisted' AND enabled = false;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;