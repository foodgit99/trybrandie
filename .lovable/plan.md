# Unplug Inngest — Full Migration Plan

Goal: remove the Inngest dependency entirely while keeping today's behavior: enqueue returns in <1s, workers pick up jobs within 1–2s, concurrency capped at 15, idempotent dispatch, and the heartbeat/watchdog stays authoritative for failure.

## Architecture

Replace the Inngest event → `designWorker` → `design-studio` hop with a Postgres-native dispatch chain:

```text
client → design-enqueue → INSERT design_jobs (status='queued')
                        → pg_notify('design_job_queued', job_id)   [instant path]
                        → return job_id

pg_notify listener        → design-dispatch edge fn (async)         [instant path]
   (Supabase DB webhook       → compare-and-swap 'queued'→'running'
    on design_jobs INSERT)    → fetch-and-forget POST design-studio
                              → return 202

pg_cron every 5s          → design-dispatch (sweeper)               [safety net]
                              → claims any 'queued' rows older than 5s
                              → same CAS + dispatch path
```

Two triggers converge on one dispatcher, so a dropped webhook is picked up by the cron sweep within ~5s. The compare-and-swap in `design-studio` (already shipped) makes double-dispatch a no-op returning 409.

## Why this hits the 1–2s pickup requirement

Supabase Database Webhooks fire on `INSERT` in <500ms typical, invoking an edge function directly. The cron sweep is only a fallback. Neither depends on Inngest's queue infra, and both run inside the Supabase project — no cross-service auth.

## Concurrency & burst handling

- `design-dispatch` is stateless and returns 202 fast, so hitting 5–7 in parallel from a Blueprint approval is fine.
- The 15-concurrency cap moves into `design_jobs` itself: dispatcher counts `status='running'` rows for the workspace/globally before dispatching; if ≥15, it leaves the row queued and lets the next sweep pick it up.
- Priority ordering (`priority DESC, created_at ASC`) is enforced in the dispatcher's `SELECT ... FOR UPDATE SKIP LOCKED`.

## Changes

### 1. New edge function: `supabase/functions/design-dispatch/index.ts`
- Two entrypoints in one handler:
  - **Webhook mode**: called by Supabase DB webhook with `{ record: design_jobs_row }`. Attempts to dispatch that specific job.
  - **Sweep mode**: called by pg_cron with `{ mode: 'sweep' }`. Selects up to N queued rows (age > 5s or all), respects the 15-concurrency cap, dispatches each.
- Dispatch = CAS `queued→running` + `fetch(design-studio, ...)` without awaiting the body, same shape as the current Inngest step.
- Verify `verify_jwt = false` in `supabase/config.toml`.

### 2. `supabase/functions/design-enqueue/index.ts`
- Remove `sendInngestEvent` and the `LOVABLE_API_KEY` / `INNGEST_API_KEY` reads.
- Keep the `design_jobs` INSERT exactly as-is — the webhook fires from it.
- On success, return `{ job_id, status: 'queued' }` as before. No behavior change for the client.

### 3. Delete `supabase/functions/inngest/index.ts`
- Remove the function directory. Remove its entry from `supabase/config.toml` if one exists.

### 4. Database changes (single migration)
- Add DB webhook (via Supabase management API is not available here — instead we use `pg_net` from a trigger):
  - `CREATE OR REPLACE FUNCTION public.notify_design_job_queued()` — on `AFTER INSERT` when `NEW.status = 'queued'`, calls `net.http_post` to `${SUPABASE_URL}/functions/v1/design-dispatch` with `{ job_id: NEW.id }` and the service-role apikey header.
  - `CREATE TRIGGER trg_notify_design_job_queued AFTER INSERT ON public.design_jobs ...`
- Add pg_cron sweep every 5s calling `design-dispatch` with `{ mode: 'sweep' }`. Uses `pg_net` and the anon key + Bearer service-role, matching the existing `autopilot-retry-daily` pattern.
- Ensure `pg_cron` and `pg_net` are enabled (already used elsewhere in the project).

Because this cron references the project URL and service-role key, it uses the **insert tool**, not migration — same rule the project already follows for scheduled functions.

### 5. Secrets cleanup (deferred)
- After a week of clean logs, `INNGEST_API_KEY` and `INNGEST_SIGNING_KEY` (connector-managed) can be disconnected via the Inngest connector. Do not touch these in this plan — the connector owns them.

## Rollout

1. Ship migration + new `design-dispatch` fn + updated `design-enqueue` in one push.
2. Delete `inngest` function last, after verifying `design_jobs` are moving `queued → running` on the webhook path (check `stage='queued'→'planning'` transitions in the DB).
3. Monitor `design_jobs` for any rows sitting in `queued` >10s — that's the signal the webhook path is failing and cron sweep is doing the work.

## Risks & mitigations

- **Webhook fails silently**: cron sweep picks it up within 5s.
- **Concurrency stampede on cron tick**: dispatcher's `FOR UPDATE SKIP LOCKED` + 15-cap prevents overrun.
- **Trigger blocks the INSERT**: `net.http_post` from `pg_net` is async — the trigger returns immediately.
- **Heartbeat/watchdog unchanged**: existing 3-min stall detector in `finalize_stalled_design_jobs` continues to catch stuck `running` rows. No change needed.

## Out of scope

- No changes to `design-studio` internals, heartbeat, watchdog, or the client (`DesignGenerationContext.tsx`).
- No changes to carousel pipeline, model cascade, or gallery logic.
- Inngest connector stays linked at the workspace level until you disconnect it manually; nothing in code will reference it.
