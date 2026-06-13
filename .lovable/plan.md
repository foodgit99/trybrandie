## Goal

Pull holidays and current cultural events from the live web via Firecrawl Search, scoped to each brand's region, instead of relying on the hardcoded `HOLIDAYS` list. Keep the existing hardcoded list strictly as a safety-net fallback.

## Approach

1. **New shared module** `supabase/functions/_shared/holiday-feed.ts`
   - `fetchHolidaysForBrand(supabase, brand, days = 30)` → returns `UpcomingHoliday[]` shaped exactly like today's `getUpcomingHolidays` so call sites don't change.
   - Reads `brand.country` (and `audience.region` if present) to build a region-aware Firecrawl query, e.g.:
     `"public holidays and cultural observances in {Country} from {today} to {today+30d}"`.
   - Calls Firecrawl `/v2/search` (REST, server-side, `FIRECRAWL_API_KEY`) with `limit: 5` and `scrapeOptions.formats: ['markdown']`.
   - Pipes the scraped markdown into Lovable AI Gateway (Gemini Flash-Lite) with a strict JSON schema:
     `[{ name, date (YYYY-MM-DD), region, content_type: 'promotional'|'engagement'|'inspirational' }]`.
   - Validates dates, drops anything outside the requested window, dedupes by `name+date`.

2. **Caching in `research_cache`**
   - Cache key: `holiday-feed:{country}:{isoWeek}`.
   - TTL: 7 days. One Firecrawl call per brand-region per week.
   - On cache hit, skip Firecrawl entirely.

3. **Fallback**
   - If Firecrawl errors, AI parse fails, or returns 0 events → fall back to the existing hardcoded `HOLIDAYS` resolver (`holiday-calendar.ts`). Log a warning trace.

4. **Call-site updates** (signature-compatible, no behaviour change beyond data source)
   - `supabase/functions/brand-engine/index.ts`
   - `supabase/functions/brand-strategist/index.ts`
   - `supabase/functions/design-studio/index.ts`
   - `supabase/functions/_shared/category-recipes.ts` (if it imports the calendar)
   - Each switches from `getUpcomingHolidays(days)` to `await fetchHolidaysForBrand(supabase, brand, days)`.

5. **Client (`src/lib/holidayCalendar.ts` + `ChatSuggestions.tsx`, `ContentHub.tsx`)**
   - Add a thin edge function `holiday-feed` (GET, `verify_jwt = true`) that takes `brand_id` and returns the cached feed for that brand.
   - `holidayCalendar.ts` keeps the current hardcoded version as a synchronous fallback and exports a new `getUpcomingHolidaysForBrand(brandId)` async helper that calls the edge function.
   - `ChatSuggestions` + `ContentHub` switch to the async helper with the sync version as the initial render fallback.

6. **Hardcoded list stays in place** in both `src/lib/holidayCalendar.ts` and `supabase/functions/_shared/holiday-calendar.ts` purely as offline fallback. No further maintenance of year-by-year `dates` maps is required — Firecrawl handles correctness.

## Technical notes

- Firecrawl already linked (`FIRECRAWL_API_KEY` present). Use REST `https://api.firecrawl.dev/v2/search` per the firecrawl guide; server-side only.
- AI parse uses existing Lovable AI Gateway (no new secrets). Model: `google/gemini-2.5-flash-lite` style call already used elsewhere in the project.
- `research_cache` table already exists — reuse it (key, value JSONB, expires_at).
- Brand region resolution priority: `brands.country` → audience profile region → `'global'`.
- Schema unchanged except for cache rows; no migration needed if `research_cache` already supports arbitrary keys.

## Out of scope

- Removing the hardcoded calendar files (kept as fallback).
- Holidays older than today or further than the requested window.
- Per-user holiday preferences (still inferred from brand region only).