
## Autonomous Engine — Audit Findings

**Short answer: no, it's not working properly.** Autonomous is set up correctly for 17 brands, but today's morning delivery only shipped 1 of 12 due posts, and 5 autonomous brands have zero ideas for the week.

### What I checked
- `autopilot_settings` — 17 brands on `mode=autonomous, delivery_time=morning, Africa/Lagos`. Correct.
- Cron jobs — `autopilot-morning/afternoon/evening` fire at 06/12/17 UTC (7am/1pm/6pm Lagos). Correct.
- `autopilot_runs` — this morning: `ideas_found=44, processed=1, completed_at=NULL`. Yesterday morning: `ideas_found=41, processed=1, completed_at=NULL`. Same shape both days.
- `content_ideas` scheduled for today across autonomous brands: **1 completed, 1 failed_error, 3 pending, 10 unclaimed**. Only "Abarcos ltd" received today's post; 11 other brands did not.
- `design_jobs` in the last 24h — three jobs died with `worker_timeout` (edge wall-clock limit) at stages `starting` and `cover_done`.
- 5 autonomous brands have **0 ideas for the entire week** (DADA, Ignite Lounge, Lighthouse Cleaning, Victory spot, Zeepway) — the planner never seeded them.

### Root causes (three separate bugs)

**1. content-autopilot dies after ~1 idea per morning run.**
The 06:00 UTC sweep finds ~44 due ideas and processes them serially with inter-idea jitter. It hits the edge-runtime wall-clock before it finishes, `completed_at` never gets written, and the remaining 43 ideas sit at `autopilot_status=null` for the rest of the day. The 08:30 UTC `autopilot-retry-daily` sweep should backfill them but isn't, because retry only picks up `failed_no_credits` / `failed_error` rows — untouched (`null`) ideas from the same day are not re-scanned by any later run.

**2. autopilot-planner only runs once a week (Sun 00:30 UTC).**
Any brand that turns on autopilot mid-week, or whose Sunday plan silently failed, stays empty until the following Sunday. That's why 5 autonomous brands have no ideas at all this week.

**3. design-studio wall-clock kills carousel/complex jobs.**
Three jobs in the last 24h hit `worker_timeout`. Heartbeat/watchdog catches them, but for autonomous brands this becomes today's missed post with no automatic retry inside the morning window.

### Fix plan

**A. Make content-autopilot survive the queue.**
- Replace the "process everything found this tick" loop with a bounded chunk (e.g. process 8–10 ideas, then re-enqueue itself via `pg_net` for the next batch until empty).
- Emit `autopilot_runs.completed_at` on both graceful exit paths so ops can see partial progress.
- Add an "unfinished morning" recovery: at the 12:00 UTC afternoon tick, include yesterday+today `null`/`pending` ideas for morning-delivery brands (not just today's window). Same for evening.

**B. Give autopilot-planner a daily top-up.**
- Add a daily 00:15 UTC cron that runs `autopilot-planner` for brands with fewer than N pending ideas in the current week. Keep the Sunday cron as the full weekly seed.
- Log a `run_event` per brand seeded so failures are visible.

**C. Harden design-studio timeouts for autonomous jobs.**
- On worker_timeout, if `source=autopilot` and no retry has fired yet, auto-enqueue one retry (single-shot) instead of leaving the idea as `failed_error`.
- Keep the existing heartbeat/watchdog untouched.

**D. Observability — one small addition.**
- On the Cockpit's Engine card, surface "today's autonomous shipments: X of Y" from `content_ideas` so this failure mode is visible without opening the DB.

No client/UX changes beyond (D). Everything else is edge-function + one new cron.

### Out of scope
- Rewriting the design-studio carousel pipeline (already hardened last week).
- Changing delivery-time semantics or timezone handling.
- Migrating any planner logic to Inngest (we removed it).
