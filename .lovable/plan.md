

# Plan: Trend Research Agent + Holiday Intelligence

## Analysis: Should This Be One Agent?

No. These are three distinct concerns with different data sources, refresh cadences, and costs:

| Concern | Data Source | Refresh Rate | Cost |
|---------|-----------|-------------|------|
| Industry trend research | Web search (Perplexity) | Weekly / on-demand | High (API call) |
| Holiday calendar | Static dataset | Yearly | Zero |
| Holiday content ideas | AI generation | When planning weekly content | Low (piggyback on existing) |

**Recommended split: 2 components, not 1 monolithic agent.**

---

## Component 1: Industry Trend Scout (Edge Function)

A new `trend-scout` edge function that uses the Lovable AI gateway to synthesize current industry trends. No external API key needed — it uses Gemini with a carefully crafted prompt that asks for current, real-world trends based on the brand's industry, audience, and season.

### How it works
- Called on-demand from the Brand Strategist chat or Content Hub
- Receives `brand_id`, fetches brand context (industry, audience, vibe)
- Asks Gemini to identify 5-7 current trends in the brand's industry/niche, considering the current month and season
- Returns structured JSON: `{ trends: [{ title, summary, relevance_to_brand, content_angles[] }] }`
- Results are cached in a new `brand_trend_intel` table (refreshed max once per week)

### Integration points
- **Brand Strategist**: System prompt includes cached trend intel as additional context section
- **Content Hub / `generate_weekly_ideas`**: The AI prompt gets trend intel injected so ideas reflect current industry movements
- **UI**: A "Trend Intel" card in Content Hub showing latest researched trends

### Database
New table `brand_trend_intel`:
- `id`, `brand_id`, `user_id`, `trends_data` (jsonb), `generated_at` (timestamp)
- RLS: users can only see their own brand's intel
- One row per brand, upserted on refresh

---

## Component 2: Holiday Calendar Engine (Deterministic)

A static holiday dataset embedded directly in the `brand-engine` edge function — no AI call, no web search.

### How it works
- A comprehensive `HOLIDAYS` constant mapping month+day to holiday entries (country-aware, starting with global + US + UK + NG/ZA for African markets)
- Each holiday has: `name`, `date`, `region`, `content_type` (e.g. "promotional", "engagement", "inspirational")
- When `generate_weekly_ideas` runs, it checks the target week for upcoming holidays
- Holidays are injected into the AI prompt: "This week includes [Holiday]. Generate at least one idea themed around it."
- Holiday ideas get a special `idea_type: "holiday"` tag

### Content Hub UI changes
- Holiday ideas display with a calendar/gift icon badge
- Holidays appear as subtle markers on the weekly calendar view

---

## Files to Create/Modify

1. **Create** `supabase/functions/trend-scout/index.ts` — new edge function
2. **Create** migration — `brand_trend_intel` table with RLS
3. **Modify** `supabase/functions/brand-engine/index.ts` — add holiday data to `generate_weekly_ideas`, add `refresh_trend_intel` action
4. **Modify** `supabase/functions/brand-strategist/index.ts` — inject cached trend intel into system prompt
5. **Modify** `supabase/config.toml` — register `trend-scout` function
6. **Modify** `src/pages/ContentHub.tsx` — holiday badges, trend intel card, refresh button
7. **Modify** `src/integrations/supabase/types.ts` — auto-updated after migration

### Estimated scope
~300 lines new code, ~50 lines modified across existing files. No new API keys required — uses Lovable AI gateway for trend research.

