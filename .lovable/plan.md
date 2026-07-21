## What I found

Your most recent carousel job (`631bc388…`, started 2026-07-21 03:49:05) is still in the DB as `status=running, stage=starting, progress=5` — with no `finished_at`, no `error`, no result. It's not alone: **every carousel job since July 7 that didn't finish sits in exactly the same state** (`ca667d65…`, `afcf4b53…`, `8b3b917a…`, `33d26e98…`, `c053ce90…`). All show `stage="starting", progress=5` — the initial marker written by `design-studio` at line 4040 — and never advance.

Meanwhile the AI Gateway logs show the model calls themselves are healthy: image generations are returning in ~27–30s (`019f82cb-9b26-75c9…`, `019f82cb-9c09-72c8…`, `019f82cb-0b63-7e17…`, etc.), and one 60-second call was cancelled (`019f7ec4-b2f3-7b1a…`) — matching the ~94-second gap before the isolate got killed.

### Root cause

`design-studio` runs the carousel inside `EdgeRuntime.waitUntil(work)` (index.ts line 4082). The pipeline writes `stage="starting"` **once** before rendering, then only writes again at the very end (`succeeded` or `failed`). Nothing writes in between.

When the pipeline exceeds Supabase Edge Runtime's wall-time (~150s CPU), the isolate is killed. Because the kill happens outside the `try/catch`, the `failed` branch never runs — so the row is stranded at `stage="starting"` forever, and the client just keeps polling a row that will never change. That's your "10 minutes and nothing happened."

Even when it *does* finish, a 5-slide Pro carousel today is: cover (~30s) + ceil(4/3)×30s inner batches (~60s) + planning + copy + critic ≈ 120–150s, right at the ceiling. A 10-slide is guaranteed to exceed it.

## The fix

### 1. Emit progress heartbeats from inside the carousel loop

In `supabase/functions/design-studio/index.ts` (`renderSlide` / carousel orchestrator around lines 3786–3934), after the cover finishes and after every inner slide resolves, `UPDATE design_jobs SET progress=..., stage='slide_k_of_n', updated_at=now() WHERE id=jobId`. This gives the UI real progress and — critical — a fresh `updated_at` we can use for stall detection.

### 2. Add a stall watchdog so stuck jobs stop lying to the UI

Two changes:
- Add a `heartbeat_at timestamptz` column (or reuse `updated_at`) on `design_jobs`; bump it on every progress write.
- A tiny server-side finalizer (either a new `pg_cron` that flips `running` jobs with `heartbeat_at < now() - interval '3 min'` to `failed` with `error={message:'worker_timeout'}`, or a check inside `design-enqueue`/the poll path that does the same lazily on read). Either way the client stops spinning forever.

### 3. Keep carousels inside the wall-time budget

Two complementary changes to `renderSlide` / the carousel loop:
- Raise inner-slide concurrency from 3 → 5 so a 5-slide carousel is cover + 1 parallel batch (~60s total) and a 10-slide is cover + 2 batches (~90s).
- For carousels of ≥6 slides, split the work: cover job renders the cover + writes slide rows for the plan, then enqueues a follow-up `design-studio` invocation (via the existing Inngest event pattern in `design-enqueue`) that renders the remaining slides in a fresh isolate. Each isolate then owns ≤5 slides and stays well under the wall-time.

### 4. Client shows slides as they land

`DesignGenerationContext` already subscribes to `design_jobs`; add a parallel subscription to `designs` filtered by `carousel_id=eq.<id>` so each slide appears in the UI the moment it's written, instead of waiting for the whole job to flip to `succeeded`. The final `succeeded` write still triggers the "complete" state.

### 5. Backfill the stranded jobs

One-off SQL migration to mark the 5 stranded `stage="starting"` carousel jobs as `failed` with a clear message, so if any user is still polling one it resolves.

## Files touched

- `supabase/functions/design-studio/index.ts` — heartbeat writes in the carousel loop, concurrency 3→5, split-into-follow-up-job for ≥6 slides.
- New migration — add `heartbeat_at` to `design_jobs`, backfill stranded rows, add stall-watchdog (either `pg_cron` job or a stored function called from the poll path).
- `src/contexts/DesignGenerationContext.tsx` — subscribe to `designs` by `carousel_id` for progressive slide display; treat `heartbeat_at` age as a soft-fail signal.

## Explicitly NOT changing

- Pro remains the default image model (per your last direction).
- Copy validation, arc gates, gallery-first, product-ref routing — all preserved.

## How I'll verify

- Generate a 5-slide and a 10-slide carousel end-to-end; both finish and `design_jobs.status` flips to `succeeded`.
- Kill a slide mid-run (temporary throw) and confirm the watchdog marks the job `failed` within 3 minutes instead of hanging.
- Confirm slides appear one-by-one in the UI as each renders.
