
-- Weekly blueprints table
CREATE TABLE IF NOT EXISTS public.weekly_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | approved | locked
  approved_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'autopilot', -- autopilot | manual | seed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_blueprints_user_week
  ON public.weekly_blueprints (user_id, week_start_date DESC);

ALTER TABLE public.weekly_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their blueprints"
  ON public.weekly_blueprints FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = weekly_blueprints.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can insert their blueprints"
  ON public.weekly_blueprints FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = weekly_blueprints.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can update their blueprints"
  ON public.weekly_blueprints FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = weekly_blueprints.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can delete their blueprints"
  ON public.weekly_blueprints FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = weekly_blueprints.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Admins manage all blueprints"
  ON public.weekly_blueprints FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages blueprints"
  ON public.weekly_blueprints FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- content_ideas additions
ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS blueprint_id UUID REFERENCES public.weekly_blueprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved', -- draft | approved | locked  (default approved keeps legacy ideas working)
  ADD COLUMN IF NOT EXISTS day_of_week SMALLINT, -- 0=Mon..6=Sun
  ADD COLUMN IF NOT EXISTS playbook_role TEXT, -- teaser/education/proof/urgency/close/story/recap
  ADD COLUMN IF NOT EXISTS whatsapp_dm TEXT;

CREATE INDEX IF NOT EXISTS idx_content_ideas_blueprint ON public.content_ideas (blueprint_id);
CREATE INDEX IF NOT EXISTS idx_content_ideas_approval ON public.content_ideas (brand_id, approval_status);

-- profiles additions for the ritual
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS posting_timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  ADD COLUMN IF NOT EXISTS daily_push_hour SMALLINT NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS monday_briefing_hour SMALLINT NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS last_monday_briefing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_daily_push_at TIMESTAMPTZ;

-- Trigger: keep updated_at fresh on weekly_blueprints
DROP TRIGGER IF EXISTS trg_weekly_blueprints_updated ON public.weekly_blueprints;
CREATE TRIGGER trg_weekly_blueprints_updated
  BEFORE UPDATE ON public.weekly_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
