Problem

Today (Sun 21 Jun 2026) is Father's Day, observed in Nigeria, US, UK and most countries on the 3rd Sunday of June. The autopilot didn't schedule a Father's Day post because in our hardcoded holiday calendar Father's Day is tagged only as `region: "US"` and `region: "UK"`. For an NG brand, the `holiday-feed` region filter drops both entries, so neither the live feed nor the fallback surfaces Father's Day. Mother's Day has the same bug (US/UK only).

## Fix

Promote Father's Day and Mother's Day to a single `global` entry in both holiday calendar files so they surface for every region (NG, ZA, IN, etc.), the same way we treat Christmas, Valentine's Day, etc.

### Files to edit

1. `supabase/functions/_shared/holiday-calendar.ts`
  - Replace the two US/UK `Father's Day` entries with one `{ month: 6, day: 1, name: "Father's Day", region: "global", content_type: "engagement", dates: FATHERS_US }`.
  - Replace the US/UK `Mother's Day` entries with one global `Mother's Day` entry using `MOTHERS_US` (US/UK share the 2nd Sunday of May convention for most markets; UK's true Mothering Sunday stays as a separate UK-tagged entry if it already exists, otherwise drop the UK-only one).
2. `src/lib/holidayCalendar.ts`
  - Mirror the same change so the client-side fallback (used by `ChatSuggestions`) matches.

### Verification

- Run `getUpcomingHolidays(7)` mentally for today: "Father's Day" should appear with `daysUntil: 0`.
- After the next autopilot run, the Blueprint for the week of 15 Jun 2026 should include a Father's Day idea for NG brands.

### Out of scope

- No changes to the live Firecrawl feed prompt (the fallback already covers this case).
- No DB migration; this is purely the hardcoded calendar.