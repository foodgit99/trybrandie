# Add Trends tab to /hub

Add a new "Trends" tab to the Content Hub that surfaces a live feed of what's trending in the brand's industry and with the brand's target audience. Powered by the existing `trend-scout` edge function and `brand_trend_intel` cache (no new backend work).

## What the user sees

New tab appears alongside Today / This Week / Funnels / Campaigns:

```text
[☀ Today] [📅 This Week] [≡ Funnels] [📣 Campaigns] [📈 Trends]
```

Tab content (`TrendsTab`):
- Header row: "What's trending now" + small "Updated 3h ago · Refreshes weekly" line + `Refresh` button (calls trend-scout with `force_refresh: true`; first refresh per ISO week is free, subsequent cost 2 credits — surfaced via existing `check_only` flow with a confirm dialog).
- Live feed of trend cards (one per trend returned by trend-scout):
  - Trend title (serif, large)
  - 2–3 sentence summary
  - "Why this matters for {brand.name}" pulled from `relevance_to_brand`
  - 3–4 `content_angles` as chips
  - Per-card action: **"Turn into a post"** → navigates to `/studio?prompt=<angle or trend>&category=trending` so the angle seeds a Studio generation
- Empty / first-load state: friendly card with a single "Scan trends" button (free first run of the week).
- Loading: 3 skeleton cards.
- Error: inline message + retry.

Live-feed feel: subtle pulse dot in the header ("Live · scanned weekly"), staggered fade-in on cards, optimistic UI on refresh.

## Technical details

- **No DB or edge-function changes.** Reuse:
  - `supabase.functions.invoke('trend-scout', { body: { brand_id, check_only: true } })` to read cost.
  - `supabase.functions.invoke('trend-scout', { body: { brand_id, force_refresh } })` to fetch/refresh.
  - Cache is the `brand_trend_intel` row already maintained by trend-scout.
- Initial load: read `brand_trend_intel` directly via `supabase.from('brand_trend_intel').select('trends_data, generated_at').eq('brand_id', brand.id).maybeSingle()` — if present, render immediately; if absent, show empty state with "Scan trends" CTA that invokes trend-scout.
- New file: `src/components/v2/hub/TrendsTab.tsx` containing the tab UI, react-query hooks, and refresh confirm dialog. Uses existing shadcn `Button`, `Badge`, `AlertDialog`, `Skeleton`.
- Edit `src/pages/v2/Hub.tsx`:
  - Extend `TabId` to include `"trends"`.
  - Add `{ id: "trends", label: "Trends", icon: TrendingUp }` to `TABS`.
  - Add `{tab === "trends" && <TrendsTab brand={brand} onSeedStudio={(prompt) => navigate('/studio?prompt=' + encodeURIComponent(prompt) + '&category=trending')} />}` inside the existing `AnimatePresence` block.
  - Extend `agentContext` switch: `tab === "trends"` → `{ scope: "trends", label: "Industry trends" }`.
- Studio already accepts a `prompt` query param; if `category` is not yet read by Studio, the prompt seeding is still useful — no Studio change required for this scope.

## Out of scope

- No changes to `trend-scout`, no new tables, no new credit logic.
- No new "trend feeds" beyond what `trend-scout` already returns (industry + audience-aligned trends in one synthesis).
- No autopilot integration changes.
