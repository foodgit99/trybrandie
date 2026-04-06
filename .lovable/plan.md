

## Plan: Fill All Autopilot Gaps

After reviewing the full autopilot system, here are the gaps identified and the plan to address each.

### Identified Gaps

1. **No retry mechanism** — Ideas that fail (no credits, design-studio errors) stay in `suggested`/`scheduled` status forever and are never retried since the function filters by `scheduled_for = today`
2. **No visual failure indicator on calendar cards** — Users have no in-app way to know an autopilot idea failed
3. **No status tracking for autopilot failures** — The `content_ideas` table has no way to record that autopilot attempted but failed
4. **Input validation missing** — The edge function doesn't validate its input per best practices
5. **No duplicate-run guard** — If the cron fires twice (or function is invoked manually), ideas could be processed again
6. **Master autopilot toggle doesn't cascade** — Toggling "Enable Autopilot for all new ideas" only affects new ideas; no way to bulk-enable existing ideas

---

### Implementation Plan

#### Step 1 — Database Migration

Add a column to `content_ideas` to track autopilot failure:

```sql
ALTER TABLE content_ideas 
  ADD COLUMN autopilot_status text DEFAULT NULL;
-- Values: NULL (not attempted), 'pending', 'processing', 'completed', 'failed_no_credits', 'failed_error'
```

#### Step 2 — Update Edge Function (`content-autopilot/index.ts`)

- **Mark ideas as `processing`** at the start of each idea loop (prevents duplicate runs)
- **Filter out** ideas already in `processing` or `completed` autopilot_status
- **On failure**: set `autopilot_status` to `failed_no_credits` or `failed_error`
- **On success**: set `autopilot_status` to `completed`
- **Retry logic**: Also query ideas where `autopilot_status IN ('failed_no_credits', 'failed_error')` and `scheduled_for` is within the last 3 days (gives a retry window)
- **Add input validation** with basic checks on the `delivery_time` parameter

#### Step 3 — UI: Failure Badge on Calendar Cards (`ContentHub.tsx`)

- Show a red warning badge on idea cards where `autopilot_status` starts with `failed`
  - `failed_no_credits` → "⚠️ No credits" badge with tooltip
  - `failed_error` → "⚠️ Failed" badge with tooltip
- Show a green check badge for `autopilot_status = 'completed'`
- Add a "Retry" button on failed cards that resets `autopilot_status` to `pending` and updates `scheduled_for` to today

#### Step 4 — Bulk Toggle for Existing Ideas

- When the master autopilot toggle is turned ON, prompt the user: "Enable autopilot for all existing scheduled ideas this week?"
- If confirmed, batch-update all `weeklyIdeas` to set `autopilot = true`

---

### Files Changed

| File | Change |
|---|---|
| Migration SQL | Add `autopilot_status` column to `content_ideas` |
| `supabase/functions/content-autopilot/index.ts` | Processing guard, failure tracking, retry window, input validation |
| `src/pages/ContentHub.tsx` | Failure/success badges on cards, retry button, bulk toggle prompt |
| `src/integrations/supabase/types.ts` | Auto-updated with new column |

### Technical Details

- The retry window (3 days) ensures failed ideas get re-attempted on subsequent cron runs without manual intervention
- The `processing` status acts as a mutex to prevent duplicate processing if cron fires twice
- The retry specifically re-checks credit availability, so `failed_no_credits` ideas auto-resolve when credits are topped up
- Badge colors: red for failures, green for completed, amber for processing

