## What I found

- Lovable Cloud is healthy.
- The deployed `inngest` function still shows **no recent backend invocations** in our function logs.
- The screenshot is still the same single run ID: `01KST0EH5V2844VKXD7TRQATB8`, queued at **5/29/2026, 2:58:14 PM**.
- The trigger is `inngest/function.invoked`, which is Inngest’s own sync/test invocation, not a real `app/design.requested` generation event.

## Likely root cause

The function is registered, but Inngest’s automatic post-sync test run is still failing before the worker sees a real design payload. The safest fix is to make the worker explicitly treat internal Inngest test invocations as no-op success runs, and then test the actual generation path separately.

## Plan

1. Update the Inngest worker handler
   - Detect internal Inngest test/sync invocations more defensively.
   - Return a successful no-op response when there is no real `job_id`, `user_id`, and design `body`.
   - Keep real design runs strict: if `design-studio` returns an error, the worker should still fail so we see genuine pipeline issues.

2. Deploy only the `inngest` backend function
   - This ensures Inngest sync uses the updated handler.

3. Test the Inngest endpoint directly
   - Call the deployed `inngest` function with a lightweight request to confirm it reaches Lovable Cloud and no longer crashes on empty/test-like payloads.

4. Ask you to resync once after deployment
   - After deployment, resync should create a **Succeeded** sync/test run instead of another failed one.

5. Then test the real generation pipeline
   - Generate one design from Design Studio.
   - Verify `design-enqueue` creates a job.
   - Verify the Inngest run trigger changes from `inngest/function.invoked` to the real design event path.
   - If that real run fails, debug the actual `design-studio` error rather than the sync/test noise.

## Technical details

- File to change: `supabase/functions/inngest/index.ts`
- No database changes needed.
- No frontend changes needed.
- The current screenshot does not prove the real design pipeline is failing; it shows Inngest’s internal function invocation failing. This plan separates that from the actual `app/design.requested` event flow.