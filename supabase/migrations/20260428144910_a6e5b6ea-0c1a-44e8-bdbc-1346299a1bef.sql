ALTER TABLE public.brand_trend_preferences
  ADD COLUMN IF NOT EXISTS research_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.brand_trend_preferences.research_prefs IS
  'Per-category research overrides. Shape: { [category_id]: { mode: "fast"|"accurate", recency: "24h"|"7d"|"30d", enabled?: boolean } }';