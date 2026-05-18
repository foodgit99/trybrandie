## Goal

Remove `/briefing` as a separate surface and bring the unique pieces it owns into a collapsible **"Week blueprint"** panel on `/cockpit`. `/content` remains the deep editor; `/cockpit` becomes the single weekly command center.

## What `/briefing` uniquely owns today

Most of Briefing is already mirrored on Cockpit (week strip, approve-all, day cards, narrative arc tags). The pieces Cockpit doesn't yet have:

1. **Blueprint lock/unlock flow** — reads/writes `weekly_blueprints` (status `draft` / `approved` / `locked`), creates the row on approve, links `content_ideas.blueprint_id`.
2. **Week rationale framing** — the "Approve your week / Your week is locked in" headline, week range, narrative-arc explanation per day (Teaser → Educate → Hard Sell → Urgency → Closing → Story → Recap).
3. **Quick Pivot sheet** — per-day textarea that rewrites `content_ideas.prompt`, clears `design_id`, resets `status` to `suggested` so autopilot regenerates the drop.
4. **Locked-state UX** — "Unlock week" button, status badge, sticky approve bar copy.

## Implementation

### 1. Add a "Week blueprint" collapsible panel on `/cockpit`

- New section above **This Week's Blueprint** (or wrapping it), using `@/components/ui/collapsible`.
- Trigger row: `Week {n} blueprint` + status pill (`Draft` / `Locked`) + chevron. Default **open** when there are pending drafts, **collapsed** when locked.
- Body contains:
  - One-paragraph rationale (the existing "Approve / Locked / Awaiting" copy + week date range).
  - The 7-day narrative-arc legend (one-line strip of `ARC_TAGS` with the date underneath) so users see *why* each day exists. Cockpit's existing `DayRow` list stays below.
  - Stat trio (`Drops planned`, `Days covered`, `Status`) — small inline variant, not the full-width cards from Briefing.

### 2. Wire blueprint state into Cockpit

- Add a `useQuery(["blueprint", brand.id, weekStartISO])` mirroring Briefing's query.
- Extend the existing `handleApproveAll` to also upsert the `weekly_blueprints` row (`status: "approved"`, `approved_at: now()`) and set `blueprint_id` on each updated `content_ideas` row — same logic as Briefing today.
- Add `handleUnlock` (flip blueprint back to `draft`) shown when `isLocked`.
- Approve-all button keeps current placement; copy switches to "Unlock week" when locked.

### 3. Port Quick Pivot

- Move the Briefing `Sheet` + `handleQuickPivot` into Cockpit.
- Add a `Quick pivot` action on each `DayRow` (only when not locked) next to the existing open-in-content affordance.

### 4. Delete `/briefing`

- Remove `<Route path="/briefing" …>` from `src/App.tsx` (add a redirect to `/cockpit` so old links/emails don't 404).
- Delete `src/pages/Briefing.tsx`.
- Remove the `Briefing` entry from `src/components/FloatingNavBar.tsx` `navItems`. Cockpit (`Gauge`) stays.
- Remove `/briefing` from `public/sitemap.xml` if listed.

### 5. Repoint the Monday email

- In `supabase/functions/monday-briefing/index.ts`, change any link that points to `/briefing` to `/cockpit` (anchor to `#week-blueprint` if helpful).
- No schema or cron changes.

### 6. Query-key hygiene (light touch, not full sync)

- Invalidate both `["cockpit-week-ideas"]` and the new `["blueprint", …]` keys after approve / unlock / pivot, so the panel stays in sync within Cockpit. Full Cockpit ↔ Content realtime sync is **out of scope** for this change.

## Files touched

```text
src/pages/Cockpit.tsx              edit  (add panel, blueprint query, pivot sheet, unlock)
src/pages/Briefing.tsx             delete
src/App.tsx                        edit  (remove route, add /briefing → /cockpit redirect)
src/components/FloatingNavBar.tsx  edit  (drop Briefing nav item)
public/sitemap.xml                 edit  (drop /briefing entry if present)
supabase/functions/monday-briefing/index.ts  edit  (link → /cockpit)
```

No DB migrations. No changes to `/content`. No realtime work.

## Out of scope

- Unifying React Query cache keys across `/cockpit` and `/content`.
- Adding Supabase Realtime on `content_ideas`.
- Redesigning Cockpit beyond inserting the collapsible panel.