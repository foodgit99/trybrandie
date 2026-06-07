## Goal

Give Creator and Agency brand **owners** a Usage tab inside Brand Centre that answers: "What is happening on this brand, by whom, and how many credits did it cost?" — purely from data we already capture. No schema changes.

Plan-gated: only owners on Creator or Agency tiers see the tab. Free/Entrepreneur owners see an upgrade nudge. Team members never see it (owner-only).

---

## What the tab shows

A single `BrandUsagePanel` mounted as a new "Usage" tab in `src/pages/v2/BrandCentre.tsx`, with a date-range selector (Last 7 / 30 / 90 days; default 30).

### 1. Headline stats (4 cards)
- **Designs generated** — `designs` rows for this brand in range.
- **Credits spent** — sum of `design_traces.metrics->>'credits'` joined to designs in range; falls back to `count(designs) * 1` when traces lack a credit field. We'll surface whichever is non-null.
- **Autopilot posts** — `content_ideas` rows where `autopilot = true` and `autopilot_status = 'completed'` in range.
- **Active members** — distinct `user_id`s that produced a design/idea in range (owner + accepted team members).

### 2. Daily activity sparkline
Group `designs.created_at` by day for the range. Tiny `recharts` area chart (matches existing admin look).

### 3. Member leaderboard
Table joining `designs.user_id` → `brand_team_members` (or owner) → counts:
- Avatar/initial, display name (email when full name missing), role badge (Owner / Editor / Viewer)
- Designs generated
- Last active timestamp

Owner appears first, then members sorted by design count.

### 4. Content breakdown
Two small donut/list combos:
- **By category** — group `content_ideas.content_category` (uses the 10-intent taxonomy already in `src/lib/contentCategories.ts`).
- **By format** — `content_ideas.content_format` (graphic vs carousel vs video).

### 5. Recent activity feed (last 20)
Unified list of: design generated, idea approved, autopilot post completed, member joined. Each row shows actor, action, timestamp. Pure read; click-through to the design opens the existing viewer.

---

## Technical Details

**New files**
- `src/components/brands/BrandUsagePanel.tsx` — the whole tab.
- `src/hooks/useBrandUsage.ts` — React Query hook that fetches all five sections in parallel, keyed by `[brand_id, range_days]`, `staleTime: 60s`.

**Edited**
- `src/pages/v2/BrandCentre.tsx` — add `usage` tab after `team`. Gate visibility: only when current user is the brand owner AND `useSubscription().features.team === true` (Creator/Agency). Otherwise show a slim upgrade CTA card in place.

**Data sources (all existing, owner-readable via current RLS)**
- `designs` (brand_id, user_id, created_at)
- `design_traces` (user_id, metrics) joined client-side by run id when present; if joining proves messy we'll just use `designs` count and label the card "Designs generated" instead of credits.
- `content_ideas` (brand_id, user_id, autopilot, autopilot_status, content_category, content_format, created_at)
- `brand_team_members` (brand_id, user_id, email, role, status, accepted_at)
- `brands` (owner display)

**Queries — keep client-side**

We avoid new RPCs. The brand owner already has SELECT on every row above. For larger brands we cap each query at 5,000 rows in range and aggregate in JS.

**Owner check**

`useBrand` already tags brands with `__role: 'owner' | 'member'`. Tab and queries gated on `activeBrand.__role === 'owner'`.

**Empty + loading states**

- Loading: skeleton cards (`@/components/ui/skeleton`).
- Empty (no activity in range): friendly "Nothing yet for this window" with a link to Studio.

**Non-goals (V1)**

- Per-member credit attribution (we'd need to backfill credit cost into traces — out of scope).
- Export to CSV (easy follow-up).
- Cross-brand rollup (lives at agency level; separate feature).
- Realtime updates — 60s stale time is enough.

---

## Migration order

No migrations. Pure frontend.

1. Build `useBrandUsage` hook.
2. Build `BrandUsagePanel` with the five sections.
3. Wire into Brand Centre v2 behind the owner + plan gate.
4. Smoke-test on an Agency brand with real activity.
