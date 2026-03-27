

## Content Hub — Free Generation Limit + Credit Confirmation Dialog

### Overview

Users get 1 free AI generation per week in the Content Hub. After using it, subsequent generations (including for other weeks) cost 2 credits, with a confirmation dialog before proceeding.

### What needs to happen

#### 1. Database: Track weekly Content Hub generations

Add a `content_hub_generations` column to the `profiles` table plus a `content_hub_gen_reset_at` timestamp to track the weekly allowance.

**Migration SQL:**
```sql
ALTER TABLE profiles 
  ADD COLUMN content_hub_gen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN content_hub_gen_reset_at timestamptz NOT NULL DEFAULT now();
```

#### 2. Backend: Brand-engine edge function changes

In `supabase/functions/brand-engine/index.ts`:

- Before executing any AI generation action (`generate_pillars`, `generate_series`, `generate_campaigns`, `generate_weekly_ideas`), check the user's `content_hub_gen_count` and `content_hub_gen_reset_at`.
- If `content_hub_gen_reset_at` is before the start of the current ISO week, treat `content_hub_gen_count` as 0 (reset).
- If count is 0 (first free generation this week): proceed for free, then increment `content_hub_gen_count` to 1 and set `content_hub_gen_reset_at` to now.
- If count >= 1: check that the user has >= 2 credits available (bonus + plan credits). If not, return 402. If yes, deduct 2 credits and increment count.
- Add a new action `check_content_gen_status` that returns `{ is_free: boolean, credits_required: number }` without generating anything — the frontend calls this to decide whether to show the dialog.

#### 3. Frontend: Credit confirmation dialog in ContentHub

In `src/pages/ContentHub.tsx`:

- Add an `AlertDialog` (already imported pattern) that shows when a generation would cost credits.
- New state: `creditDialogOpen`, `pendingAction` (stores which action to run after confirmation).
- Modify all generation trigger points (`handleGenerate`, `handleFullGenerate`, the auto-generate on first visit) to first call the `check_content_gen_status` action.
  - If `is_free` is true: proceed directly.
  - If `is_free` is false: show the dialog with the message "You've used your free generation this week. This will cost 2 credits. Would you like to proceed?" with Cancel and Proceed buttons.
- Cancel: close dialog, do nothing.
- Proceed: close dialog, run the stored `pendingAction`.
- The initial auto-generate on first visit (when no pillars exist) is always free since it's the user's first generation.

### Files to modify

| File | Action |
|------|--------|
| Database migration | Create — add `content_hub_gen_count` and `content_hub_gen_reset_at` to profiles |
| `supabase/functions/brand-engine/index.ts` | Modify — add generation tracking, credit deduction, and `check_content_gen_status` action |
| `src/pages/ContentHub.tsx` | Modify — add confirmation dialog and pre-check logic before generations |

### Technical details

- The `handleFullGenerate` flow (Regenerate All) counts as 1 generation event, not 4 separate ones, since it's a single user action.
- The silent auto-regen (`silentRegenWeeklyIdeas`) triggered after CRUD operations on pillars/series/campaigns will also check credits — if the user has no credits, it silently skips instead of showing a dialog.
- Weekly reset is based on ISO week (Monday to Sunday), matching the Content Hub's calendar model.

