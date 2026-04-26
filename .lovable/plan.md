## Plan: Equal Category Distribution Across the Content Hub

The 10 categories (Announcement, Educational, Informational, Entertainment, Promotional, Trending, Holidays, Social Proof/UGC, BTS, Interactive) already exist in the schema and the AI prompts *try* to enforce variety — but the work isn't visible in the UI, pillar categories aren't normalized to the enum, and the calendar has no per-week coverage check. This plan closes the loop end-to-end.

---

### 1. Normalize pillar categories to the enum (backend)

**File:** `supabase/functions/brand-engine/index.ts`

* Change the `generate_pillars` tool schema so each pillar returns `content_categories: string[]` (array of enum values) instead of a free-form comma-separated string. This eliminates the current mess (`"Educational, Informational, Behind-the-Scenes (BTS)"` vs. the enum `bts`).
* Tighten the system prompt: the 5 pillars MUST collectively cover **at least 8 of the 10 categories** (was 7), with no category appearing in more than 2 pillars.
* On insert, store as a normalized comma-separated lowercase enum string (so existing `text` column works without a migration).

### 2. Strengthen calendar distribution (backend)

**File:** `supabase/functions/brand-engine/index.ts` → `generate_weekly_ideas`

* Raise the minimum from "at least 4 different categories per week" to **at least 6 of 10**, and add a soft cap (no category > 3 ideas/week excluding holidays) to prevent clustering.
* Pass the **last 2 weeks' category counts** into the prompt so the model deliberately fills underused categories ("Last 14 days: educational=8, promotional=2, bts=0 → prioritize bts, informational, trending").
* Add a deterministic post-validation pass: if the returned set covers fewer than 6 categories, re-prompt once with an explicit gap list before inserting.

### 3. Surface categories in the UI (frontend)

**File:** `src/pages/ContentHub.tsx`

* **Pillar cards, Series rows, Campaign cards** — render small category chips (max 3, "+N more") using a shared `CategoryBadge` component with consistent colors per category (e.g. educational = blue, promotional = gold, holidays = amber).
* **Calendar rows** — append a single subtle category dot (color-coded) before the idea title. No text label, to keep the "clean & tidy" rule from the previous round.
* **Idea/Pillar/Series/Campaign edit dialogs** — add a `Select` (single value, enum) so users can manually correct or assign categories.

### 4. New "Category Coverage" panel (frontend)

**File:** `src/components/content/CategoryCoveragePanel.tsx` (new)

* A compact horizontal bar showing all 10 categories with a count badge for the **current week's ideas** (and a toggle for "All pillars/series/campaigns").
* Empty categories shown muted with a "+ Add" affordance that pre-fills a new idea with that category.
* Placed inside the Calendar `Collapsible`, directly above the day list — gives users an at-a-glance "is my content balanced this week?" signal.

### 5. Shared category metadata (frontend)

**File:** `src/lib/contentCategories.ts` (new)

```ts
export const CONTENT_CATEGORIES = [
  { id: 'announcement', label: 'Announcement', emoji: '📢', color: '...' },
  { id: 'educational',  label: 'Educational',  emoji: '🎓', color: '...' },
  // …all 10
];
```

Used by `CategoryBadge`, the coverage panel, calendar dots, and edit-dialog selects — single source of truth for label/emoji/color.

### 6. Backfill safeguard (no migration needed)

The existing `text` column tolerates legacy values. New rows (after this PR) will be normalized; old NULL rows will simply show as "Uncategorized" with a one-click "Auto-categorize" button on each pillar/series/campaign card that calls a new lightweight `brand-engine` action `categorize_existing` (uses Flash-Lite, no credits charged) to fill them in.

---

### Out of scope (intentionally)

* No DB schema change — `content_category` stays as `text` to avoid breaking the 360+ existing rows.
* No changes to the design generation pipeline — categories already flow into design prompts via `content-categorization`.
* No re-generation of existing pillars/series — users can manually trigger "Regenerate" if they want enforced variety applied.

### Files touched

* `supabase/functions/brand-engine/index.ts` (modify: pillar schema, weekly prompt, new `categorize_existing` action)
* `src/pages/ContentHub.tsx` (modify: render badges, calendar dots, mount coverage panel, add category select to dialogs)
* `src/components/content/CategoryBadge.tsx` (new)
* `src/components/content/CategoryCoveragePanel.tsx` (new)
* `src/lib/contentCategories.ts` (new)
