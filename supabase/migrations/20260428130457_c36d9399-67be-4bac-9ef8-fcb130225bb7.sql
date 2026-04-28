-- Per-user, per-brand dialog preferences (scoped to Brand Centre)
CREATE TABLE IF NOT EXISTS public.user_brand_dialog_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  last_category_series text,
  last_category_campaign text,
  last_category_idea text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brand_id)
);

ALTER TABLE public.user_brand_dialog_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own brand dialog prefs"
  ON public.user_brand_dialog_prefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own brand dialog prefs"
  ON public.user_brand_dialog_prefs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own brand dialog prefs"
  ON public.user_brand_dialog_prefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage brand dialog prefs"
  ON public.user_brand_dialog_prefs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_brand_dialog_prefs_updated_at
  BEFORE UPDATE ON public.user_brand_dialog_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_brand_dialog_prefs_user_brand
  ON public.user_brand_dialog_prefs (user_id, brand_id);