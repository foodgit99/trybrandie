## Goal

Add a new structured data source called **Updates** — a lightweight, time-stamped log of real-world events happening inside the business (testimonials, product updates, events, CSR moments, milestones, press, partnerships, customer stories, etc.). The AI uses recent Updates as a "current events feed" for the brand, alongside Brand Centre, Audience, Trend Lab, Products, and Firecrawl research. It is especially weighted for **Social Proof**, **BTS**, **Announcement**, and **Trending** content categories.

## What the user gets

1. **Brand Centre → Updates** — a new card where the user can quickly drop short updates ("Just got a glowing review from Tola at Lagos Tech Hub", "Launched v2 of the dashboard today", "Sponsored a coding bootcamp last week") with optional image, type, and date.
2. **Content Hub** — when generating ideas (especially Social Proof, BTS, Announcement, Trending, Promotional), the system pulls recent Updates and uses them as factual seed material so ideas reference real, current happenings instead of generic suggestions.
3. **Design Studio** — Updates feed into the prompt context for matching categories so copy quotes/references are drawn from real events. Used Updates can be marked so we don't repeat them too often.
4. **Updates panel in chat** — small expandable "Pulled from your Updates" panel sits next to the existing Research Sources panel, listing which Updates fed the design.

## Data model

New table `brand_updates`:

```text
id            uuid pk
brand_id      uuid (RLS via brands.user_id)
user_id       uuid
update_type   text  -- testimonial | product | event | csr | milestone | press | partnership | customer_story | other
title         text  -- short headline (<=120)
content       text  -- the actual update body (<=600)
attribution   text  -- e.g. "Tola, Lagos Tech Hub" (used for testimonials)
image_url     text  -- optional photo
source_url    text  -- optional link
event_date    date  -- when it happened (default today)
expires_at    date  -- optional auto-archive (e.g. event-only updates)
status        text  -- 'active' | 'archived'
times_used    int   default 0
last_used_at  timestamptz
created_at    timestamptz default now()
updated_at    timestamptz default now()
```

RLS: same pattern as `brand_products` (owner CRUD via brands join, admin all).

## Backend integration

**Shared helper** `_shared/brand-updates.ts`:
- `fetchRecentUpdates(supabase, brandId, { categoryId, limit })` — returns active, non-expired updates ordered by recency, with category-aware filtering:
  - `social_proof` → prefer `testimonial`, `customer_story`
  - `bts` → prefer `event`, `csr`, `milestone`
  - `announcement` → prefer `product`, `milestone`, `press`, `partnership`
  - `trending` → most recent of any type (last 14 days)
  - `promotional` → prefer `product`, `milestone`
  - others → recent of any type as soft context
- `formatUpdatesForPrompt(updates)` — produces a compact bullet block.
- `markUpdatesUsed(supabase, ids)` — increments `times_used` and stamps `last_used_at` (soft-deprioritises recently used items in next call).

**`brand-engine` (Content Hub idea generator)**:
- Add `brand_updates` to the parallel context fetch.
- Inject an `UPDATES (recent business activity, prefer these as seed material when relevant):` block into `fullContext`.
- Update the system prompt instructions to tell the model to ground Social Proof / BTS / Announcement ideas in actual updates when present, and to never fabricate testimonials when an updates list exists.

**`design-studio`**:
- After category classification, fetch top 3–5 category-relevant updates.
- For Social Proof: if a testimonial update exists, the copywriter must use the verbatim quote + attribution rather than inventing one.
- For BTS / Announcement / Trending: pass updates as factual grounding to both the Copywriter Agent and (for image direction) the Creative Director Agent.
- Return `updates_used: [{id, title, type}]` in the response so the UI can display the panel and the server can call `markUpdatesUsed`.
- Updates context is added before Firecrawl enrichment so live web research complements (not replaces) first-party data.

**`content-autopilot`**:
- Same updates fetch is included, weighted toward fresh updates so the daily autopilot reflects what actually happened in the business.

## Frontend

**`src/pages/BrandCentre.tsx`** — new "Updates" section (placed between Products & Services and Inspiration):
- Header with description: "Drop quick real-time updates — testimonials, events, product news. The AI uses these as fresh, factual material for your content."
- Quick-add inline composer (single text field + type chip + optional image + date), submits with ⌘Enter.
- List of recent updates as compact cards with type badge, date, content preview, attribution, image thumb, "Used N times" hint, edit/archive/delete actions.
- Filter chips by type; "Show archived" toggle.
- Empty state with 3 example prompts.

**`src/pages/DesignStudio.tsx` + `DesignGenerationContext.tsx`**:
- Extend `Message` / `GenerationResult` with optional `updatesUsed: { id, title, type }[]`.
- New collapsible "Pulled from your Updates" panel inside assistant bubbles (sibling of Research Sources panel), with a small `Newspaper` icon.

**`src/pages/ContentHub.tsx`**:
- Add a small "X recent updates feeding ideas" indicator near the Generate Ideas button when updates exist. Clicking opens a quick drawer linking to Brand Centre → Updates.

**`src/lib/contentCategories.ts`**:
- No category changes (Updates is a data source, not a category). Add a small helper `getUpdateTypePreference(categoryId)` mirroring backend logic for UI hints.

## Migration

```text
supabase/migrations/<timestamp>_brand_updates.sql
```

- Create table, indexes on `(brand_id, status, event_date desc)` and `(brand_id, update_type)`.
- RLS policies: user CRUD via `brands` join; admin ALL via `has_role`.
- Storage: reuse existing `brand-products` bucket pattern — actually use the existing `brand-inspiration` bucket for update photos to avoid bucket sprawl (public read, owner write).

## Out of scope (kept for later)

- Bulk import from email/Slack/Zapier.
- Auto-extraction of testimonials from connected review sites.
- Per-update sentiment tagging.
- Auto-expire scheduling beyond the optional `expires_at` field.

## Files touched

- `supabase/migrations/<ts>_brand_updates.sql` (new)
- `supabase/functions/_shared/brand-updates.ts` (new)
- `supabase/functions/brand-engine/index.ts`
- `supabase/functions/design-studio/index.ts`
- `supabase/functions/content-autopilot/index.ts`
- `src/pages/BrandCentre.tsx`
- `src/pages/DesignStudio.tsx`
- `src/pages/ContentHub.tsx`
- `src/contexts/DesignGenerationContext.tsx`
- `src/lib/contentCategories.ts` (small helper)
- `src/integrations/supabase/types.ts` (auto-regenerated)

After approval I'll switch to build mode and implement in this order: migration → shared helper → brand-engine → design-studio → autopilot → Brand Centre UI → Design Studio panel → Content Hub indicator.