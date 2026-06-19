## Problem

Today (June 19) is **World Sickle Cell Day**, but the autopilot didn't schedule a post for it.

### Why it slipped through

The autopilot planner pulls holidays from `holiday-feed` (Firecrawl, cached weekly), and falls back to a hardcoded list in `supabase/functions/_shared/holiday-calendar.ts` (mirrored client-side in `src/lib/holidayCalendar.ts`). When this week's plan was generated (Mon Jun 15, targeting Jun 15–21):

1. Firecrawl's top results for "public holidays in [region] between Jun 15–21" returned the obvious ones (Father's Day, Juneteenth, Youth Day SA) but missed the UN observance.
2. The hardcoded fallback also doesn't list World Sickle Cell Day — so even on a Firecrawl miss there was nothing to inject.

Result: no holiday card was generated for Friday Jun 19, so the planner filled the day with a generic strategic-arc post instead.

## Fix

Add the missing UN/global awareness days to the hardcoded fallback so they are guaranteed to appear regardless of Firecrawl coverage. The Firecrawl path stays unchanged; this only fills the safety net.

### Days to add (both files, identical entries)

| Date | Name | Region | Type |
|---|---|---|---|
| Jun 19 | World Sickle Cell Day | global | inspirational |
| Jun 20 | World Refugee Day | global | inspirational |
| May 31 | World No Tobacco Day | global | inspirational |
| Jul 11 | World Population Day | global | inspirational |
| Aug 8 | International Cat Day | global | engagement |
| Sep 8 | International Literacy Day | global | inspirational |
| Oct 5 | World Teachers' Day | global | inspirational |
| Oct 16 | World Food Day | global | inspirational |
| Nov 14 | World Diabetes Day | global | inspirational |
| Dec 1 | World AIDS Day | global | inspirational |
| Dec 3 | International Day of Persons with Disabilities | global | inspirational |
| Dec 10 | Human Rights Day | global | inspirational |

These are all fixed-date UN/WHO observances — no per-year date table needed.

## Files to touch

- `supabase/functions/_shared/holiday-calendar.ts` — add entries to the `HOLIDAYS` array (Global section).
- `src/lib/holidayCalendar.ts` — mirror the same entries so the client-side fallback matches.

## Out of scope

- No planner, brand-engine, or scheduler logic changes.
- No retroactive backfill for today — the week is already generated and the user can add today's post manually via the existing flow if desired.
- No Firecrawl prompt tuning (separate effort if recurring misses become a pattern).

## Verify

After the edit, in the browser console:
```js
import("/src/lib/holidayCalendar.ts").then(m => console.log(m.getUpcomingHolidays(7)))
```
…should include "World Sickle Cell Day" when run on/before Jun 19. Next Monday's autopilot run will then pick it up via the fallback path if Firecrawl misses it again.
