# Next steps after Inngest sync

The sync succeeded — `Design pipeline worker` is registered. The one **Failed** run is Inngest's automatic post-sync test invocation, which fires with an empty `event.data`. Our worker destructures `job_id` and `body` from `event.data` and throws when they're missing. No real design has been queued yet (the `design_jobs` table is empty).

## Step 1 — Guard the worker against empty/test payloads

In `supabase/functions/inngest/index.ts`, validate `event.data` at the top of the function and return a no-op result instead of throwing when `job_id` or `body` is missing. This keeps Inngest's health/test invocations green and avoids noisy "Failed" rows in the dashboard.

## Step 2 — Trigger a real end-to-end test

From the app:
1. Go to **Design Studio**
2. Submit a prompt to generate a design

This exercises the full path:

```text
UI → DesignGenerationContext
   → design-enqueue (inserts design_jobs row, sends app/design.requested event via gateway)
   → Inngest worker (dispatches to design-studio with service-role auth)
   → design-studio (runs pipeline in background, writes result to design_jobs)
   → UI polls design_jobs → FloatingDesignStatus pill → /studio?design=...
```

## Step 3 — Verify each hop

After triggering one generation, check:
- `design_jobs` row created with `status='queued'`, then `processing`, then `completed`
- Inngest dashboard shows a new **Succeeded** run for `Design pipeline worker`
- Edge function logs for `design-enqueue` and `design-studio` are clean
- The floating pill appears, then the finished design opens in `/studio`

## Step 4 — If anything fails

Most likely failure modes and where to look:
- **Event not received by Inngest** → `design-enqueue` logs (gateway 4xx/5xx)
- **Worker runs but design-studio 401/403** → service-role auth header in worker dispatch
- **design-studio runs but no DB write** → `job_id`/`user_id` plumbing in `design-studio`
- **UI never updates** → realtime/poll subscription in `DesignGenerationContext`

## Technical details

- Empty-payload guard: check `event?.data?.job_id && event?.data?.body` before destructuring; return `{ skipped: true, reason: "no payload (likely sync test)" }` otherwise.
- No schema or UI changes required for step 1 — it's a 3-line edit in the Inngest worker.
- Steps 2–4 are observational; only file change is the worker guard.
