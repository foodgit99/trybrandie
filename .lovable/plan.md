

## Fix Autopilot Lock Query — Final Root Cause & Plan

### What's happening now

The cron jobs ARE running. The morning run at 6 AM UTC correctly found 2 ideas. But both were logged as `skipped_locked` — meaning the lock update returned no rows.

The ideas have `autopilot_status = NULL`. The lock query uses `.or("autopilot_status.is.null,and(autopilot_status.neq.processing,autopilot_status.neq.completed)")` which should match NULL rows — but it doesn't.

### Root cause

The supabase-js client's `.or()` filter combined with `.update()` and the nested `and()` syntax is not producing the expected PostgREST query for NULL handling. This is a known edge case with PostgREST's `and()` inside `or()` on PATCH requests. The `.or()` approach has now failed twice despite being theoretically correct.

### The fix: Use a database function for atomic locking

Instead of fighting PostgREST filter syntax, create a simple SQL function that does the lock atomically using plain SQL `IS NULL` — which is guaranteed to work:

```sql
CREATE FUNCTION lock_autopilot_idea(p_idea_id uuid)
RETURNS uuid AS $$
  UPDATE content_ideas
  SET autopilot_status = 'processing'
  WHERE id = p_idea_id
    AND (autopilot_status IS NULL
      OR autopilot_status NOT IN ('processing', 'completed'))
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;
```

Then in the edge function, replace the fragile `.update().or()` chain with:
```typescript
const { data: lockResult } = await supabase.rpc('lock_autopilot_idea', { p_idea_id: idea.id });
```

### Implementation steps

1. **Create migration** with the `lock_autopilot_idea` database function (SECURITY DEFINER to bypass RLS)
2. **Update `content-autopilot/index.ts`** — replace the `.update().eq().or().select().maybeSingle()` lock with a single `supabase.rpc('lock_autopilot_idea', ...)` call
3. **Reset stuck ideas** — update existing ideas that should have been processed (those with `autopilot_status = NULL` and `scheduled_for` in the past few days) so they get retried
4. **Deploy and test** — redeploy the edge function and invoke it to verify the lock works

### Why this is the definitive fix

- Pure SQL `IS NULL` is guaranteed to work — no PostgREST filter ambiguity
- `SECURITY DEFINER` bypasses RLS, matching the service-role intent
- Atomic: a single UPDATE with RETURNING — no race conditions
- Simple: one RPC call replaces 5 chained method calls

### Files involved

- New migration: `lock_autopilot_idea` function + reset stuck ideas
- `supabase/functions/content-autopilot/index.ts` — replace lock logic

