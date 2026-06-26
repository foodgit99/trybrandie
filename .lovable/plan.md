
## What I found

Your brand's idea (`Hustle No Be Muscle: The Executive View`, scheduled today) was picked up by the 6:00 AM autopilot run but failed with: **`Failed to generate design brief`** (an HTTP 429 from the Lovable AI Gateway disguised as a generic error). Because the row was stamped `autopilot_status='failed_error'`, no email was sent and no design was produced.

This is **not isolated** — looking at `autopilot_run_events` for the 6:00 AM run, almost every brand processed in the same window shows the same error pattern:

> `Rate limit exceeded for trace 019f028392d97d14bb94b116fdabf769. Retry after ~7000ms.`

### Root causes (in order of impact)

1. **Rate-limit storm.** `content-autopilot` runs `CONCURRENCY=3` per brand and fires immediately on `0 6 * * *`. Combined with the volume of brands and the per-trace rate limit on the gateway, the first wave of brands triggers 429s for everyone behind them.
2. **429 is treated as a permanent failure.** In `processIdea`, when `design-studio` returns 429, the idea is stamped `failed_error` instead of being left in a retryable state. `design-studio` itself comments "Don't retry on 429" (line 257-258), so the throttle wins.
3. **`autopilot-retry` runs at the same minute** (`0 6 * * *`) as `autopilot-morning`, doubling the load and re-failing yesterday's failures into today's window.
4. **`pg_net` 5-second timeout** — every cron invocation of `content-autopilot` shows `Timeout of 5000 ms reached` in `net._http_response`. The function keeps running, but we have no observability and any failure inside is silent.
5. **Backfill needed for today.** All of today's `failed_error` ideas will sit until tomorrow's retry; we should re-enqueue them now so your post lands today.

## Fix

### 1. `supabase/functions/content-autopilot/index.ts`
- Parse "Retry after Nms" out of the `design-studio` error response. On a 429:
  - Do NOT set `autopilot_status='failed_error'`.
  - Set `autopilot_status='pending'` (retryable) and log `rate_limited` to `autopilot_run_events`.
  - Within the same invocation, retry the idea up to 2 times after sleeping `Retry-After + jitter`.
- Lower in-call concurrency from 3 to 1 for the first 30 s of the run and add a 1.5–3 s jitter between batches so the cron tick doesn't fan out simultaneously across brands.

### 2. `supabase/functions/design-studio/index.ts`
- In the Brief Agent path (line 1847-1853), surface `429` with the `Retry-After` payload to the caller instead of collapsing it into `"Failed to generate design brief"`. This makes the autopilot retry logic above actually work.

### 3. Cron schedule
- Move `autopilot-retry-daily` from `0 6 * * *` to `30 8 * * *` so it never collides with `autopilot-morning`.
- Bump `net.http_post` timeout on the three autopilot-* jobs from the default 5 s to 60 s via `timeout_milliseconds`, so cron sees real responses and we get visibility.

### 4. Backfill today
- Re-enqueue every idea with `scheduled_for = CURRENT_DATE AND autopilot_status = 'failed_error'` by flipping it back to `pending` and invoking `content-autopilot` once with `delivery_time='now'` so your post — and everyone else's — generates today.

### Technical notes
- `lock_autopilot_idea` already prevents a concurrent double-process, so the in-call retry is safe.
- The gateway's "trace" rate limit is per-key/per-window — staggering + honoring `Retry-After` is the documented mitigation; no key/header change required.
- All migrations here are cron updates only; no schema changes.

After deploy I will run the backfill once and confirm `autopilot_status='completed'` and `design_id` populated on your idea `d76411be`.
