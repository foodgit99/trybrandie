

# Content Hub Gap Fixes

## Gaps to Address

1. **Strategy changes don't refresh the calendar** — Creating/editing/deleting a pillar, series, or campaign has no effect on weekly ideas. The calendar stays stale.
2. **No manual content idea creation** — Users can't add their own ideas to specific days on the calendar.
3. **Campaign ideas not linked** — `campaign_id` is hardcoded to `null` in `generate_weekly_ideas` (line 318 of edge function).
4. **Weekly calendar hidden when no pillars exist** — The "This Week" section is gated behind `hasPillars`, so users with only manual ideas or campaigns see nothing.

## Plan

### 1. Auto-regenerate weekly ideas after strategy changes

After any successful pillar/series/campaign save or delete in `ContentHub.tsx`, automatically call `generate_weekly_ideas` in the background. This keeps the calendar in sync with the user's strategy without requiring a manual click.

- In `savePillar`, `deletePillar`, `saveSeries`, `deleteSeries`, `saveCampaign`, `deleteCampaign`: after the query invalidation, trigger `callEngine("generate_weekly_ideas")` silently (no blocking spinner, just a subtle refresh).
- Show a small toast: "Updating your weekly plan..." → "Weekly plan updated."
- Skip auto-regen if no pillars and no series and no campaigns exist (nothing to generate from).

### 2. Manual content idea creation on the calendar

Add an "Add idea" capability per day on the weekly calendar:

- A small `+` button on each day row that opens a lightweight dialog.
- Dialog fields: **Title** (required), **Prompt** (required, the Studio instruction), **Pillar** (optional dropdown), **Series** (optional dropdown), **Campaign** (optional dropdown).
- On save, insert into `content_ideas` with `status: "scheduled"`, `scheduled_for` set to that day's date, `idea_type: "single"`.
- Add edit and delete actions on individual ideas (pencil/trash icons on hover, matching pillar/series card pattern).
- New state: `IdeaForm` interface, `ideaDialogOpen`, `editingIdeaId`, `ideaForm`, `ideaDay` (to track which day).

### 3. Fix campaign_id linking in edge function

In `supabase/functions/brand-engine/index.ts`, the `generate_weekly_ideas` action:

- Add `campaign_name` to the AI tool schema (alongside `series_name`).
- Build a `campaignMap` like `pillarMap` and `seriesMap`.
- Map `campaign_id` from the AI response instead of hardcoding `null`.

### 4. Show calendar regardless of pillars

Remove the `hasPillars` gate on the "This Week" section. The calendar should always be visible so users can manually add ideas even without AI-generated pillars. Keep the "Generate Ideas" button but show it alongside a "+" manual add option.

## Files Changed

| File | Change |
|---|---|
| `src/pages/ContentHub.tsx` | Auto-regen after CRUD, manual idea CRUD dialogs, ungated calendar |
| `supabase/functions/brand-engine/index.ts` | campaign_id mapping fix |

## UX Notes

- Auto-regen runs silently — no full-screen loader, just a subtle "Updating weekly plan..." toast so the user isn't blocked.
- Manual idea dialog is minimal: title + prompt + optional associations. No clutter.
- Calendar day rows gain a `+` button (visible on hover on desktop, always visible on mobile) for quick manual additions.
- Ideas gain hover edit/delete icons matching the existing pillar/series pattern.

