

## Investigation Results: Autopilot Not Processing Ideas

### Root Cause

**SQL NULL comparison bug in the lock-acquisition query (line 128-129).**

The autopilot function finds the correct ideas (confirmed: `total: 2` in the 6 AM UTC response), but the "duplicate-run guard" silently rejects every idea because of how SQL handles NULL comparisons.

The lock query is:
```typescript
.update({ autopilot_status: "processing" })
.eq("id", idea.id)
.neq("autopilot_status", "processing")   // line 128
.neq("autopilot_status", "completed")    // line 129
```

All autopilot ideas have `autopilot_status = NULL`. In SQL, `NULL != 'processing'` evaluates to `NULL` (not `TRUE`), so the `.neq()` filter **excludes every row where `autopilot_status` is NULL**. The update matches zero rows, `lockResult` is `null`, and the idea is silently skipped via `continue` (line 135) — without even incrementing the `skipped` counter.

This is confirmed by the pg_net response log from today's 6 AM UTC run:
```json
{"processed":0,"skipped":0,"total":2,"delivery_time":"morning"}
```

### Fix (1 file change)

**`supabase/functions/content-autopilot/index.ts`** — Replace the `.neq()` filters with a combined `.or()` that explicitly handles NULL:

```typescript
// Before (broken with NULLs):
.eq("id", idea.id)
.neq("autopilot_status", "processing")
.neq("autopilot_status", "completed")

// After (NULL-safe):
.eq("id", idea.id)
.or("autopilot_status.is.null,and(autopilot_status.neq.processing,autopilot_status.neq.completed)")
```

Also increment `skipped` on the `continue` path (line 135) so the response accurately reports skipped ideas.

### Secondary issue: silent skip counter

When the lock fails, `continue` is called without incrementing `skipped`, so the response misleadingly reports `skipped: 0` even when ideas were skipped. This will be fixed by adding `skipped++` before the `continue`.

### After fix

Redeploy the `content-autopilot` edge function. The next scheduled cron run will pick up today's ideas (they are still in `autopilot_status: null` and within the 3-day retry window).

