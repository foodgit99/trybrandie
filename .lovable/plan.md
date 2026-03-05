

## Plan: Trend Lab Module

Adds a trend intelligence layer between Brand Centre and AI agents, enabling trend-aware design generation while preserving brand consistency.

### What Gets Built

1. **Database**: New `brand_trend_preferences` table storing per-brand trend settings (selected trend, intensity, enabled flag). Add `trend_used`, `trend_intensity` columns to existing `designs` table.
2. **Brand Centre UI**: New collapsible "Trend Lab" section after Target Audience Intelligence with trend preset cards, intensity slider, and enable/disable toggle
3. **Design Studio UI**: Compact trend selector above chat input (alongside existing audience selector) with trend toggle, preset picker, and intensity slider
4. **Design Pipeline**: Update `design-studio` edge function to accept trend tokens and inject trend styling instructions into the Brief Agent and Renderer prompts
5. **Feedback Learning**: Store trend metadata on saved designs; use upvote/downvote signals for trend preference tracking

---

### Technical Details

#### A. Database Migration

```sql
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

-- RLS via brand ownership (same pattern as target_audiences)
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
```

No separate `trend_profiles` table needed at MVP — trend presets are defined as constants in code (easily extensible later via DB).

#### B. Trend Presets (Code Constants)

Define in a shared file `src/lib/trendPresets.ts` and reused across Brand Centre, Design Studio, and edge function:

5 presets each with: `id`, `name`, `description`, `visual_characteristics`, `typography_style`, `color_profile`, `texture_elements`, `copy_tone_hint`. These are the styling tokens injected into the AI prompts.

#### C. Brand Centre UI

**File:** `src/pages/BrandCentre.tsx`

Add a new collapsible card after the Target Audience section:

- Header: "Trend Lab" with a Palette icon and status badge ("Off" / trend name)
- Collapsed: shows active trend name and intensity if enabled
- Expanded:
  - Toggle switch to enable/disable trend styling
  - Grid of 5 trend preset cards (name, short description, select button)
  - Intensity slider (0-100, default 40) with labels
  - Auto-saves to `brand_trend_preferences` on change via mutation

#### D. Design Studio UI

**File:** `src/pages/DesignStudio.tsx`

Add a trend selector pill next to the existing audience selector above the chat input:

- Palette icon pill showing "No trend" or selected trend name
- Dropdown with: "No trend", 5 trend presets, intensity slider
- State: `trendEnabled`, `selectedTrend`, `trendIntensity` — initialized from `brand_trend_preferences` query
- Pass `trend`, `trend_intensity` in the edge function request body

#### E. Design Pipeline Integration

**File:** `supabase/functions/design-studio/index.ts`

Accept `trend` (string ID) and `trend_intensity` (0-100) from the request body.

When a trend is active, inject into `brandContext`:

```
TREND STYLING (blend with brand, never override):
- Active trend: {trend_name}
- Intensity: {intensity}/100 (0=pure brand, 100=full trend)
- Visual characteristics: {characteristics}
- Typography influence: {typography_style}
- Color treatment: {color_profile}
- Texture elements: {texture_elements}

TREND RULES:
1. Brand colours, fonts, and voice ALWAYS take priority
2. At intensity <25, apply only subtle hints
3. At intensity 50, balance brand and trend equally
4. At intensity >75, trend styling is dominant but brand colours remain
5. Adapt copy tone slightly: {copy_tone_hint}
```

Also inject trend tokens into the Renderer prompt so Nano Banana applies the styling overlay.

When `trend` is null/undefined, the pipeline works exactly as before.

#### F. Design Saving with Trend Metadata

When saving a design in `DesignStudio.tsx`, include `trend_used` and `trend_intensity` in the insert payload. The edge function also returns these values so the frontend can store them.

#### G. Feedback Learning

Existing upvote/downvote on designs already stores `vote` on the `designs` table. With `trend_used` and `trend_intensity` now on designs, future recommendation logic can query which trends received the most upvotes per brand. No additional changes needed at MVP — the data foundation is in place.

### What Does NOT Change

- Existing tables, RLS policies, auth flow untouched
- Audience intelligence pipeline unchanged
- Credit system unchanged
- The pipeline falls back gracefully when no trend is selected
- Onboarding flow untouched

