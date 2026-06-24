## Findings — autopilot ↔ Blueprint is wired, but the weekly lifecycle is broken

I pulled live data + cron config. The picture changed materially from the last audit.

### What's actually working ✅

1. **Cron is registered** (set up via the runtime SQL tool, not migrations — that's correct per Lovable guidance):
   - `autopilot-morning` daily 06:00 UTC → `content-autopilot {"delivery_time":"morning"}`
   - `autopilot-afternoon` daily 12:00 UTC
   - `autopilot-evening` daily 17:00 UTC
   - `autopilot-planner-weekly` Sundays 00:30 UTC → `autopilot-planner`
   - `autopilot-retry-daily` daily 06:00 UTC → `autopilot-retry`
   - `daily-execution-push-hourly` hourly :00 → `daily-execution-push`
2. **Cron is firing** — `autopilot_runs` shows entries every morning/afternoon/evening for the last 7+ days.
3. **Autopilot IS gated on the Blueprint** — `content-autopilot/index.ts` requires `blueprint_id IS NOT NULL` AND `weekly_blueprints.status='approved'`. All 142 autopilot ideas in the DB have a `blueprint_id` (100%).
4. **The "Design Ready" email send is wired** — fires `autopilot_design_ready` after a successful generation, plus `daily-execution-push` sends `daily_drop_ready` hourly.

### What's actually broken ❌

| # | Issue | Evidence |
|---|---|---|
| 1 | **Weekly blueprints are not being approved/created for the current week.** 14 of 17 brands with autopilot ON have their last approved blueprint dated **2026-06-15** — that week ended on 2026-06-21. Today is **2026-06-24**. So those brands have **nothing in scope** for the autopilot to generate. | Live query of `weekly_blueprints` grouped per brand |
| 2 | **Only 1 brand ("Solutions expert") has an eligible idea for today.** Every other brand returns 0 from the autopilot eligibility query. | `eligible_today` column in the per-brand table |
| 3 | **Morning runs never complete** — `autopilot_runs.completed_at` is NULL on every 06:00 UTC run, but afternoon and evening runs all complete in <1s. Almost certainly an Edge Function timeout because the morning run is the only one with brands to process (all 17 brands are on "morning"). | `autopilot_runs` last 10 rows |
| 4 | **No idea actually gets processed even when eligible.** All recent morning runs show `ideas_found: 0, processed: 0` despite the DB having 1 eligible idea today. Either the brand-level filter is dropping it, or the function dies before reaching the eligibility query. | Same |
| 5 | **No safety net for missed weeks.** `autopilot-planner-weekly` runs Sunday 00:30 UTC. If it fails or the user doesn't approve, the system silently sits idle for the entire week with no banner, no email, no nudge. | Behaviour confirmed by data + code |
| 6 | **All 17 brands collapse on the same timezone window.** All are `Africa/Lagos` + `morning`. That means one Edge Function invocation must handle every brand sequentially. This is fragile and the likely cause of (3). | `autopilot_settings` aggregate |

## Implementation plan

I'll do this in **two phases**: a small Phase A that ships the user-visible fix (Blueprint approval banner + retry button) and the morning-timeout fix, then a Phase B that hardens the planner so users don't fall off a cliff each Monday.

### Phase A — Stop the bleeding (small, ship today)

**A1. Surface the real blocker in the Cockpit + Blueprint pages.**
- Add a query that resolves, for the active brand: "is autopilot ON AND there is no approved blueprint covering today?".
- When true, show a high-contrast banner: *"Autopilot is paused — your current week's Blueprint isn't approved yet. Approve it to start receiving content."* with an "Open Blueprint" button.
- Place it at the top of `/cockpit` and `/blueprint`.

**A2. Add an "Approve this week" CTA on the Blueprint page** when the current week's blueprint exists but is in draft. One click sets `status='approved'` and `approved_at=now()`.

**A3. Fix the morning-run timeout.**
- Investigate `content-autopilot/index.ts` brand-loop: confirm sequential processing per brand and add (a) a `Promise.allSettled` over brands (capped at ~5 concurrent) and (b) a per-brand try/catch so one slow brand doesn't kill the run.
- Add `completed_at` write inside a `finally`, plus an error string on `autopilot_runs.error_details` so we can see *why* runs hang.

**A4. Quick smoke test.**
- Manually invoke `content-autopilot` with `{"delivery_time":"morning"}` via `supabase--curl_edge_functions`.
- Query `autopilot_runs` for the new row + `email_send_log` for `autopilot_design_ready` to confirm an email actually went out for "Solutions expert".

### Phase B — Make the weekly lifecycle self-healing (next pass)

**B1.** Have `autopilot-planner-weekly` log to `autopilot_run_events` so we can see why brands didn't get a new blueprint.

**B2.** Add a "missed week" recovery: if Monday rolls in and a brand with autopilot ON has no blueprint covering this week, the planner auto-creates one in **draft** (not approved) and sends a one-off "Your Blueprint is ready to approve" email so the user can approve in 1 tap.

**B3.** Optional per-brand toggle: *"Auto-approve weekly Blueprints"* in autopilot settings. For users who fully trust the system, this skips the manual approval step entirely.

### Technical details

- Frontend changes: new `useAutopilotStatus(brandId)` hook → query `autopilot_settings`, `weekly_blueprints` (latest covering today), returns `{ enabled, currentWeekStatus: 'approved' | 'draft' | 'missing' }`. Banner component reads it; Cockpit + Blueprint pages mount the banner.
- Edge function changes: `content-autopilot/index.ts` brand loop → `Promise.allSettled` with concurrency 5, per-brand try/catch, finally-block writes to `autopilot_runs`.
- DB: no schema change in Phase A. Phase B may add `autopilot_settings.auto_approve_blueprints boolean default false`.

## Questions before I switch to build

1. **Approve Phase A only**, or bundle Phase B (planner self-heal + missed-week email) in the same pass? Phase A is ~2 file edits + 1 edge function tweak; Phase B is ~3 more changes.
2. **Auto-approve toggle (B3)** — include or skip? Some users will want it, others will hate losing the manual review step.
