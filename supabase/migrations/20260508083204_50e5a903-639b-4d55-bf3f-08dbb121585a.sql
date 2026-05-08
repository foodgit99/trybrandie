ALTER TABLE public.autopilot_settings
ADD COLUMN IF NOT EXISTS auto_fill_mode text NOT NULL DEFAULT 'free_only';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'autopilot_settings_auto_fill_mode_check') THEN
    ALTER TABLE public.autopilot_settings
      ADD CONSTRAINT autopilot_settings_auto_fill_mode_check
      CHECK (auto_fill_mode IN ('never','free_only','always'));
  END IF;
END $$;