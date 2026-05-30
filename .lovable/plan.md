# Fix: "Generation failed — Cannot read headers: request closed"

## Root cause

In `supabase/functions/design-studio/index.ts`, the outer `serve` handler runs the pipeline as a detached task via `EdgeRuntime.waitUntil(work)` and immediately returns a `202` ack to the Inngest worker.

Inside `work`, it calls `runFullHandler(cloneReq())`, where `cloneReq()` builds a new `Request` with `headers: req.headers` — passing the **original** request's `Headers` object by reference. The inner handler then reads `req.headers.get("Authorization")` (line 562).

By the time the deferred `work` actually runs, the outer request has already been returned/closed. On Supabase Edge Runtime, the original `req.headers` is backed by the live request stream — accessing it after the request is closed throws:

> `Cannot read headers: request closed`

This is written to `design_jobs.error.message`, surfaced to the client through the realtime subscription, and rendered by the toast in `DesignStudio.tsx`.

The `01KST0EH5V2844VKXD7TRQATB8` Inngest run failure is a separate, already-resolved issue (test invoke with no payload). The new generation failure is this header-snapshot bug.

## Fix

Snapshot the headers into a fresh `Headers` instance **before** returning the `202`, and use that snapshot when building the cloned request inside `work`.

### Change in `supabase/functions/design-studio/index.ts` (around lines 2949–2966)

- Right after reading `bodyText`, build `const headersSnapshot = new Headers(req.headers);` while the request is still open.
- Update `cloneReq` to use `headersSnapshot` instead of `req.headers`.
- Also snapshot `req.url` and `req.method` into local consts so nothing reaches back into the closed request.

No behavior change for sync mode (no `job_id`) — it still calls `runFullHandler(cloneReq())` synchronously before the response returns, so headers are valid either way; using the snapshot is harmless.

## Verification

1. Deploy `design-studio` only.
2. From the app, generate one design from `/studio` (the route the user is on).
3. Expected:
   - `design-enqueue` returns a `job_id`.
   - Inngest worker hits `design-studio`, gets `202` immediately.
   - `design_jobs` row goes `queued → running → succeeded`.
   - No "Cannot read headers" error in `design_jobs.error`.
4. If a real pipeline error occurs, it will now be a genuine design-studio error (model failure, credit issue, etc.) and we can debug that on its own.

## Out of scope

- No frontend changes.
- No changes to `inngest`, `design-enqueue`, or DB schema.
- The stale `01KST0EH5V2844VKXD7TRQATB8` Inngest run can be ignored or dismissed in the dashboard.
