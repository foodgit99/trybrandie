

## Plan: Strengthen Seasonal & Holiday Awareness Across Brandie

### Current State Assessment

Seasonal/holiday awareness exists in **3 places**, but with significant gaps:

1. **Brand Engine (content idea generation)** — Has a hardcoded holiday calendar (~40 entries) that injects holiday context when generating weekly content ideas. Tags ideas as `idea_type: "holiday"` with amber badges. **This is the strongest implementation.**

2. **ChatSuggestions** — Has a basic month-to-season map with 1-2 events per month. Only used for suggestion chip text. Very shallow.

3. **Brand Strategist** — Has **zero** seasonal/holiday awareness. No date context is injected into its system prompt at all. It doesn't know what month it is.

4. **Design Studio** — Has **zero** seasonal/holiday awareness. No seasonal context in prompts.

5. **Trend Scout** — Mentions "seasonal opportunities" in its system prompt but has no structured holiday data.

### Gaps

- The holiday list is hardcoded and only in one edge function — not reusable
- The strategist doesn't know the current date or upcoming holidays
- No proactive "upcoming events" surface for users — holidays only appear after content is generated
- No way for users to see what's coming up next week/month to plan ahead
- Missing many holidays (Mother's Day varies by country, Eid, Diwali, Lunar New Year, etc.)

---

### Plan

**Step 1: Create a shared holiday calendar utility**

Create `supabase/functions/_shared/holiday-calendar.ts` — a reusable module with:
- The full holiday list (expanded with more global events: Eid, Diwali, Lunar New Year, Pride Month, etc.)
- Helper functions: `getUpcomingHolidays(days: number)`, `getThisWeekHolidays()`, `getCurrentSeasonalContext()`
- Export current date context string for injection into any AI prompt

**Step 2: Inject seasonal context into the Brand Strategist**

Update `brand-strategist/index.ts` to:
- Import the shared holiday calendar
- Add current date + upcoming holidays (next 14 days) to the system prompt
- Instruct the strategist to proactively reference upcoming events when relevant to the brand

**Step 3: Inject seasonal context into the Design Studio**

Update `design-studio/index.ts` to include current date and upcoming holidays so design prompts are seasonally aware.

**Step 4: Add an "Upcoming Events" section to the Content Hub**

Add a compact, always-visible card at the top of the Content Hub showing:
- Next 2-4 upcoming holidays/events (within 14 days)
- Each with a quick "Create Design" or "Plan Content" action button
- Shows the date, event name, and suggested content type
- If no events are upcoming, show "No major events in the next 2 weeks"

This gives users a **proactive planning surface** — they can see what's coming and act on it without waiting for the AI to generate ideas.

**Step 5: Update ChatSuggestions with richer seasonal data**

Replace the shallow month-to-season map with the shared holiday data so suggestion chips reference real upcoming events rather than generic seasonal labels.

### Files Changed

- `supabase/functions/_shared/holiday-calendar.ts` — New shared utility
- `supabase/functions/brand-strategist/index.ts` — Add seasonal context to system prompt
- `supabase/functions/design-studio/index.ts` — Add seasonal context
- `supabase/functions/brand-engine/index.ts` — Refactor to use shared holiday module
- `src/pages/ContentHub.tsx` — Add "Upcoming Events" card
- `src/components/ChatSuggestions.tsx` — Use real upcoming events

### UX Impact

Users will see upcoming holidays/events front-and-center in the Content Hub, the strategist will proactively weave seasonal context into advice, and designs will be naturally season-aware — making Brandie feel like a team member who always knows what's coming up.

