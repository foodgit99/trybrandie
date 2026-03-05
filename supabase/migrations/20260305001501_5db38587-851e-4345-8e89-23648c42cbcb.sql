
-- Brand trend preferences
CREATE TABLE public.brand_trend_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE,
  trend_enabled boolean NOT NULL DEFAULT false,
  selected_trend text NOT NULL DEFAULT 'none',
  default_trend_intensity integer NOT NULL DEFAULT 40,
  preferred_trends text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_trend_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their trend prefs" ON public.brand_trend_preferences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_trend_preferences.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can insert their trend prefs" ON public.brand_trend_preferences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_trend_preferences.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can update their trend prefs" ON public.brand_trend_preferences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_trend_preferences.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can delete their trend prefs" ON public.brand_trend_preferences FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = brand_trend_preferences.brand_id AND brands.user_id = auth.uid()));

CREATE TRIGGER update_brand_trend_preferences_updated_at
  BEFORE UPDATE ON public.brand_trend_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trend metadata to designs
ALTER TABLE public.designs
  ADD COLUMN trend_used text DEFAULT NULL,
  ADD COLUMN trend_intensity integer DEFAULT NULL;
