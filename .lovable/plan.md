# Move Design Generation to Background Job + Polling

## Why

Today `design-studio` runs the full pipeline (Copywriter → Creative Director → gpt-image-2 render → upload) inside a single synchronous edge-function call. The client `await`s `supabase.functions.invoke("design-studio", …)` and the function holds the HTTP connection open the entire time. Edge functions have a **150s idle timeout** — `gpt-image-2` at higher quality, carousels (multiple slides), and any retry easily blow past that, producing the `IDLE_TIMEOUT` 504 we just hit. The current workaround (forcing `quality: "low"`) sacrifices fidelity.

A background job + polling architecture decouples request duration from render duration: the API returns immediately with a job ID, work continues in the background, the UI polls (or subscribes to) status until the result is ready.

## Architecture

```text
[Client]  POST /design-studio (intent: enqueue)
   │
   ▼
[design-studio fn] insert design_jobs row (status=queued)
   │  return { job_id } immediately (<1s)
   ▼
[Worker]  picks up job, runs Copywriter → CD → gpt-image-2 → upload
   │      updates design_jobs.status as it progresses
   ▼
[Client]  polls GET /design-job-status?id=… (or Realtime subscribe)
   │      until status ∈ {succeeded, failed}
   ▼      then reads result payload (design id, image URL, copy, scores)
```

## Pieces to build

### 1. `design_jobs` table

Columns: `id uuid pk`, `user_id uuid`, `brand_id uuid`, `kind text` ('single' | 'carousel'), `status text` ('queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'), `progress int` (0–100), `stage text` ('copy' | 'direction' | 'render' | 'upload'), `input jsonb` (prompt + options), `result jsonb` (design id, image URLs, copy, scores), `error jsonb`, `attempts int`, `created_at`, `updated_at`, `started_at`, `finished_at`. RLS: owner can select; service role full. Realtime enabled on the table for push updates.

### 2. Worker execution model — pick ONE

- **Option A — Inngest (recommended).** Inngest connector is already documented in this project. Steps are durable, retries are built in, no 150s limit (per-step budget), and execution is observable. The enqueue handler sends `app/design.requested`; an Inngest function runs the pipeline and writes progress to `design_jobs`. **Best fit.**
- **Option B — `EdgeRuntime.waitUntil` + cron sweeper.** Cheaper to ship: the enqueue function spawns the work via `waitUntil` so the response returns instantly while the runtime keeps processing. A pg_cron job every 1m retries any `running` row older than ~3m as a safety net. Downside: still subject to a single edge worker's wall-clock and cold restarts; less robust for carousels.
- **Option C — pg_cron + `pg_net` polling worker.** Cron every 30s picks oldest `queued` row, calls `design-studio-worker` function. Simple but adds up to 30s startup latency per job.

Recommend **Option A (Inngest)**; fall back to **B** if we want zero new dependencies.

### 3. Refactor `design-studio/index.ts`

Split into two entrypoints:
- `design-studio` (enqueue): validate input, insert `design_jobs` row, dispatch worker (Inngest event or `waitUntil`), return `{ job_id }`. Sub-second.
- `design-studio-worker` (or Inngest function): contains the existing pipeline (`renderVariation`, carousel loop, `renderWithGptImage`, uploads, credit deduction, brand-updates write). Wraps each stage with a `design_jobs` update (`stage`, `progress`). On success writes `result` + `status='succeeded'`; on failure writes `error` + `status='failed'` and refunds credits.

Credit handling: **reserve** credits at enqueue (deduct now, refund on failure) so users can't double-spend by enqueueing many jobs.

### 4. Status endpoint OR Realtime

Two ways for the client to learn about completion:
- **Polling endpoint** `design-job-status` — simple `select` by `id`, returns row. Client polls every 2s with backoff.
- **Supabase Realtime** subscription on `design_jobs` filtered by `id`. Push-based, no polling load. Recommended; fall back to polling if the channel drops.

### 5. Client refactor (`DesignGenerationContext.tsx`)

Replace the single `supabase.functions.invoke("design-studio", …)` await with:
1. Call enqueue → get `job_id`.
2. Subscribe to Realtime row OR start a 2s polling loop.
3. Update existing UI state (`stage`, `progress`) to drive `GenerationLoader` (now we can show real stage labels, not just rotating quotes).
4. On `succeeded`, hydrate the design into chat exactly like today.
5. On `failed`, surface `error.message`, refund handled server-side.
6. `stopGeneration()` becomes a `PATCH` setting `status='cancelled'`; worker checks this flag between stages.

### 6. Misc

- Add idempotency: enqueue accepts an optional `client_request_id` (UUID) with a UNIQUE constraint to dedupe accidental double-submits.
- Logs: keep `tracer.ts` spans inside the worker; tag with `job_id`.
- Backward compat: keep the synchronous path behind a feature flag for one release so we can A/B before fully cutting over.

## Effort estimate

- Schema + RLS + migration: ~30 min
- Enqueue split + worker extraction: ~2 h (mostly moving code, not rewriting)
- Inngest wiring (Option A) OR `waitUntil` plumbing (Option B): ~1 h
- Client polling/Realtime + loader stage hookup: ~1.5 h
- Credit reserve/refund + cancel + idempotency: ~1 h
- QA across single + carousel + failure paths: ~1 h

Roughly **half a day to a day** of focused work for Option B; **~1 day** for Option A (worth it for carousels).

## What we'd get

- No more 150s timeouts — renders can take 60–120s+ at higher quality.
- We can restore `gpt-image-2` `quality: "high"`.
- Real progress UI (stage + %) instead of indeterminate spinner.
- Resilient to client disconnects, page reloads, network blips — the job keeps running and the user finds it in their gallery.
- Foundation for queued bulk generations (autopilot already wants this).

## Open questions

1. Inngest vs `waitUntil` — do you want to take on the Inngest dependency now, or ship the lighter `waitUntil` version first and upgrade later?
2. Should we keep showing the chat-inline preview, or move completed jobs to a "Recent generations" tray since the user might navigate away while waiting?
3. Cancellation semantics: full refund always, or only if cancelled before the render stage starts?
