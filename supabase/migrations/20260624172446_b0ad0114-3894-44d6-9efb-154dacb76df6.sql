ALTER TABLE public.autopilot_settings
  ADD COLUMN IF NOT EXISTS default_funnel_stage text,
  ADD COLUMN IF NOT EXISTS default_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.autopilot_settings
  DROP CONSTRAINT IF EXISTS autopilot_settings_default_funnel_stage_check;
ALTER TABLE public.autopilot_settings
  ADD CONSTRAINT autopilot_settings_default_funnel_stage_check
  CHECK (default_funnel_stage IS NULL OR default_funnel_stage IN ('awareness','consideration','conversion','retention'));