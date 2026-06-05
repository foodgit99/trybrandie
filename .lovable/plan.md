## Goal

Make the V2 experience the single destination for all Brandie notifications: emails land users on the right V2 surfaces, the V2 Settings page is the one knob for delivery timing, and a few new V2-specific moments get their own notifications.

## 1. Repoint existing emails to V2 routes

**Daily drop email (`daily-execution-push` → `send-email` `daily_drop_ready`)**
- Change the CTA URL from `/cockpit?drop=<id>` to `/post/<idea_id>` (V2 DailyPost).
- Rename the payload field `design_id` → `idea_id` for clarity (the value is already the content_ideas row id). Keep `design_id` as a fallback for one release.

**Monday briefing email (`monday-briefing` → `send-email` `monday_briefing`)**
- Change the CTA URL from `/cockpit#week-blueprint` to `/blueprint` (V2 Blueprint).

**App.tsx redirects**
- Update the `/briefing → /cockpit#week-blueprint` redirect to `/briefing → /blueprint` so any pre-existing email links keep working.
- Add a redirect `/cockpit?drop=<id> → /post/<id>` (small effect in V2 Cockpit that reads `?drop=` on mount and `navigate("/post/" + id, { replace: true })`).

## 2. Expose missing delivery prefs in V2 Settings

Today, V2 `Settings.tsx` only edits `monday_briefing_hour`. Both `daily-execution-push` and `monday-briefing` also read `daily_push_hour` and `posting_timezone` from `profiles`, but those are not editable in V2.

Add to the existing "Notifications" card in `src/pages/v2/Settings.tsx`:
- **Daily drop time** — number picker (0-23), saves to `profiles.daily_push_hour` (default 8).
- **Posting timezone** — select with the common IANA zones, saves to `profiles.posting_timezone` (default `Africa/Lagos`).
- A small "Send me a test drop now" button that invokes `daily-execution-push` for the current user only (admin-style trigger guarded server-side by `user_id` in the body).

## 3. Retire `content-daily-reminder`

- Run a `supabase--insert` SQL change to `cron.unschedule(...)` the legacy job.
- Delete the `supabase/functions/content-daily-reminder` directory and remove the `daily_content_reminder` case from `send-email/index.ts`.
- Keep `daily-execution-push` as the single daily notifier.

## 4. New V2-specific notification triggers

Add three new templates in `send-email/index.ts` and wire the triggers:

**a. `studio_generation_ready`** — fired when a Design Studio background job completes (the existing 50s background-generation pill flow). CTA → `/studio/g/<generation_id>` (or current studio result route). Only sent when the user closed the tab / the run took longer than ~45s, so we don't spam fast jobs. Wired from the studio completion handler (client) by calling `send-email` with the user's email.

**b. `weekly_recap`** — Sunday evening email summarising the past week's generations and approved drops, with a CTA → `/history`. New cron `weekly-recap` (Sun 18:00 local per profile, same time-zone logic as `monday-briefing`). Queries `designs` + `content_ideas` joined for the last 7 days.

**c. `brand_centre_incomplete`** — sent once if a user finishes onboarding but `brands.completeness_score < 60` after 48h. CTA → `/brand/editor`. Triggered by a small once-per-user check inside the existing `monday-briefing` sweep (set `profiles.brand_nudge_sent_at` after sending).

All three reuse the same Lovable Emails pipeline (`send-email` Edge Function, Resend). No new infra.

## 5. Verification

- Use `supabase--curl_edge_functions` to invoke `daily-execution-push` and `monday-briefing` for a test user and confirm the email links point at `/post/<id>` and `/blueprint`.
- Manually visit `/cockpit?drop=<id>` to confirm it forwards to `/post/<id>`.
- Save a new daily push hour in V2 Settings, re-invoke the cron, confirm the new hour is honored.

## Technical Notes

- Files touched:
  - `supabase/functions/send-email/index.ts` — update `daily_drop_ready` URL, update `monday_briefing` URL, add 3 new cases, remove `daily_content_reminder` case.
  - `supabase/functions/daily-execution-push/index.ts` — payload field rename only.
  - `supabase/functions/monday-briefing/index.ts` — add brand-incomplete nudge.
  - New `supabase/functions/weekly-recap/index.ts`.
  - Delete `supabase/functions/content-daily-reminder/`.
  - `src/App.tsx` — update `/briefing` redirect, mount drop-forward effect (or add inside `V2Cockpit`).
  - `src/pages/v2/Cockpit.tsx` — `?drop=` forwarder.
  - `src/pages/v2/Settings.tsx` — add daily-push-hour, timezone, test-send.
  - Studio completion handler — call `send-email` with `studio_generation_ready` on long runs.
- DB: one column on `profiles` (`brand_nudge_sent_at TIMESTAMPTZ`). Migration uses the standard `update_updated_at_column` trigger; no new tables, so no GRANT block needed.
- Cron: `supabase--insert` to schedule `weekly-recap` hourly and to `cron.unschedule('content-daily-reminder')`.
- Out of scope: in-app push/web-push, WhatsApp delivery, SMS — emails only.
