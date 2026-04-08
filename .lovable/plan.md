
Goal: make Autopilot reliable end-to-end so scheduled designs actually run at the selected time, generate the design, and send the email.

What I found
- The previous NULL-lock bug is already fixed in `supabase/functions/content-autopilot/index.ts`.
- There is real data waiting to run:
  - `autopilot_settings` has an enabled evening setup for brand `9b3ea2d9-...` with timezone `Africa/Lagos`.
  - `content_ideas` contains an idea for today (`2026-04-08`) with `autopilot = true` and `autopilot_status = null`.
- But there are no backend invocation logs for:
  - `content-autopilot`
  - `send-email`
  - `design-studio`
- I also checked the migrations: `pg_cron` and `pg_net` are enabled, but there is no migration that actually schedules `content-autopilot`.

Most likely root cause
- Autopilot is not failing during processing anymore; it is not being triggered at all.
- So the 6 PM job the UI implies exists is not actually scheduled in the backend.

Secondary issues I would fix at the same time
- `content-autopilot` does not currently enforce `autopilot_settings.enabled`, so the master toggle is not truly a master switch.
- The worker uses a single UTC “today” date before timezone filtering. That can drift for non-UTC brands and should be changed to brand-local date logic.
- There is no durable run history, so when something goes wrong it is too easy to miss.

Implementation plan

1. Add the missing backend scheduler
- Create explicit cron jobs for `morning`, `afternoon`, and `evening`.
- Each cron job should call `content-autopilot` with the proper `delivery_time` payload and authenticated headers.
- Use stable job names so the schedule is easy to update safely later.

2. Harden `content-autopilot` itself
- Filter brands by `autopilot_settings.enabled = true`.
- Resolve “today” per brand timezone instead of using one global UTC date.
- Keep the existing NULL-safe lock logic.
- Return structured diagnostics for:
  - ideas found
  - ideas skipped by disabled setting
  - ideas skipped by time window
  - processed count
  - failure reasons

3. Add durable observability
- Create an `autopilot_runs` table to store each run:
  - `delivery_time`
  - `started_at`, `completed_at`
  - `brand_id` / `idea_id` where relevant
  - processed/skipped/error counts
  - error payloads
- Optionally add an `autopilot_run_events` child table for per-idea diagnostics.
- This makes future failures visible even when edge logs are sparse.

4. Add a manual recovery path
- Add a protected “Run autopilot now” action in admin or the content calendar.
- Allow running for:
  - current brand
  - selected delivery window
  - optionally a single idea
- This gives a safe retry path without waiting for the next cron window.

5. Improve the calendar UX so expectations match reality
- Show:
  - next scheduled run in the brand’s local timezone
  - last successful run
  - last failure reason
- If autopilot is enabled but no scheduler heartbeat has been recorded recently, show a warning badge instead of silently looking healthy.

6. Add regression tests
- Edge function tests for:
  - evening run in `Africa/Lagos`
  - timezone date-boundary cases
  - disabled autopilot settings
  - NULL autopilot status lock acquisition
  - failed render / no credits paths
- Verify the cron payloads match what `content-autopilot` expects.

Definition of done
- A 6 PM brand-local autopilot item is picked up automatically.
- A design row is created.
- The content idea moves to `autopilot_status = completed` and `status = created`.
- The email notification is sent.
- A durable run record exists showing what happened.
- The UI shows the next run and last run clearly.

Files likely involved
- `supabase/functions/content-autopilot/index.ts`
- new migration for cron jobs and run-tracking table(s)
- `src/pages/ContentHub.tsx`
- optionally `supabase/config.toml` for function-specific hardening if needed

Why this should solve it once and for all
- It fixes the actual missing trigger, not just downstream processing.
- It makes scheduling observable.
- It removes timezone ambiguity.
- It adds a manual fallback for support/debugging.
