# Harden the Inngest dispatch layer

Inngest isn't the primary cause of the 10-minute hangs (that's the Edge Runtime wall-time kill, now covered by the heartbeat + watchdog). But three things in the current Inngest wiring can amplify slowness and cause duplicate work. Fix all three.

## What's wrong today

1. **`retries: 2` on the dispatch step** (`supabase/functions/inngest/index.ts:15`). The step's only job is `fetch(design-studio)`; it throws if `res.ok` is false. If `design-studio` returns non-2xx *after* the background pipeline has already started running (via `EdgeRuntime.waitUntil`), Inngest will retry — spawning a **second isolate** for the same `job_id`. That doubles model spend and can race two writers on the same `design_jobs` row.
2. **No idempotency check in `design-studio`.** Nothing rejects a second dispatch for a `job_id` already in `running` / `succeeded` / `failed`. A retry silently starts a fresh pipeline on top of a live one.
3. **`concurrency.limit: 5`** globally. An autopilot burst (a Blueprint approval fires 5+ jobs at once) queues manual `/post` generations behind cron work, which reads to the user as "carousel is hanging."

## The fix

### 1. `supabase/functions/inngest/index.ts`
- Drop `retries: 2` → `retries: 0` on `designWorker`. The heartbeat + watchdog is now the authoritative failure signal; Inngest retrying on top of that only creates duplicates.
- Raise `concurrency.limit` from `5` → `15` so autopilot bursts and manual generations don't head-of-line-block each other. (Real concurrency is still capped by Edge Runtime isolate quota; this just widens the Inngest gate.)
- Before dispatching, `step.run("idempotency-check", …)` fetches `design_jobs.status` for `job_id`. If it's anything other than `queued`, return `{ skipped: true, reason: "already_dispatched", status }` — no retry, no second isolate.

### 2. `supabase/functions/design-studio/index.ts` (background entry)
- At the top of the background carousel/single handler (right after parsing `job_id`), do a single `UPDATE design_jobs SET status='running', heartbeat_at=now(), started_at=coalesce(started_at, now()) WHERE id=$1 AND status='queued' RETURNING id`. If zero rows come back, log `duplicate_dispatch_ignored` and return 200 immediately — this is the compare-and-swap that makes retries safe even if step 1 misses.
- Keep everything else (heartbeats, watchdog, parallel rendering) exactly as shipped.

### 3. Ack-path robustness
- In the Inngest `step.run("dispatch-pipeline", …)`, treat 2xx **and** 409 (idempotency reject) as success — don't throw. Only 5xx / network errors should surface, and even those now won't retry because `retries: 0`.

## Files touched

- `supabase/functions/inngest/index.ts` — `retries: 0`, `concurrency.limit: 15`, idempotency pre-check step, treat 409 as ack.
- `supabase/functions/design-studio/index.ts` — compare-and-swap `queued → running` guard at background entry; early-return on duplicate.

## Explicitly NOT changing

- Heartbeat writes, watchdog cron, and the 3→5 slide concurrency shipped in the last turn.
- Pro remains the default image model.
- `design-enqueue` — its job insert + event send stays as-is.

## How I'll verify

- Fire the same `app/design.requested` event twice back-to-back for one `job_id`; confirm exactly one pipeline runs and the second returns `duplicate_dispatch_ignored`.
- Force `design-studio` to return 500 once mid-run; confirm Inngest does **not** retry (no second isolate in AI Gateway logs for that `job_id`).
- Trigger an autopilot burst of 8 jobs while manually generating a carousel from `/post`; confirm the manual job starts within seconds instead of queueing behind the burst.
