## Short answer

**Yes — autopilot is wired to the Blueprint, and it's working as designed.** But the data shows a sharp drop-off at the "approved blueprint" gate, which is likely why it can feel like nothing is happening.

## How they're connected (in code)

In `supabase/functions/content-autopilot/index.ts:165-196`, the eligibility query for every autopilot run is:

1. `content_ideas.autopilot = true`
2. `content_ideas.blueprint_id IS NOT NULL` ← every autopilot idea must belong to a Blueprint
3. The linked `weekly_blueprints` row must have `status = 'approved'` **OR** the idea itself must have `approval_status = 'approved'`
4. `content_ideas.status IN ('suggested', 'scheduled')`
5. `scheduled_for` is today (in the brand's local timezone) or a retryable miss from the last 3 days

So the Blueprint isn't decorative — it is the gate. No approved Blueprint → no autopilot generation → no email.

## What the live data says

Across the whole project right now:

| Metric | Count |
|---|---|
| Brands with autopilot ON | 17 |
| Total Blueprints | 337 |
| Approved Blueprints | 16 |
| Autopilot ideas total | 142 |
| Autopilot ideas linked to a Blueprint | **142 / 142 (100%)** ✅ |
| Autopilot ideas inside an *approved* Blueprint | **17 / 142 (12%)** ⚠️ |
| Autopilot ideas already generated | 12 |
| **Eligible to fire today** | **1** |

## What this means

- The wiring is correct: every autopilot idea has a `blueprint_id`, and 12 have actually been processed end-to-end.
- The bottleneck is **Blueprint approval**. 17 brands have autopilot turned on, but only ~16 weeks of content have ever been approved. If a user enables autopilot but doesn't approve their weekly Blueprint, **nothing will generate and no email will send** — by design.
- Combined with the earlier audit (no committed pg_cron jobs in the repo), this is the second-most-likely reason a user thinks autopilot is broken: their Blueprint is sitting in draft.

## Recommended follow-ups (not implementing yet — need your call)

1. **Surface the blocker in the UI.** On the Cockpit / Blueprint page, show a clear banner when autopilot is ON but the current week's Blueprint isn't approved: *"Autopilot is paused — approve this week's Blueprint to start delivering."*
2. **One-click "Approve & enable autopilot"** on the Blueprint page (you already added the Reset + Generate buttons there).
3. **Optional: auto-approve mode.** A per-brand toggle in autopilot settings: *"Auto-approve new weekly Blueprints"* — for users who trust the system fully.
4. Combine this with the Phase 1 cron-registration fix from the previous plan so the eligible ideas actually get picked up at the scheduled time.

Want me to switch to build mode and tackle (1) + (4) together? That's the smallest change that gets autopilot reliably firing for users who already have an approved Blueprint and clearly tells the rest why it isn't.
