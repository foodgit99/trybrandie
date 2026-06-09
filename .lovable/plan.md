# Why nothing arrived today

I traced your account (`desksolutions.expert@gmail.com`, brand "Solutions expert") through the autopilot system. Here's what happened:

**Timeline**
- `autopilot_settings` for your brand was set to `enabled=true, mode=autonomous, delivery_time=morning` at **16:18 UTC today** (≈ 5:18 PM Lagos).
- The autopilot's **morning sweep ran at 06:00 UTC today** (≈ 7:00 AM Lagos) — *before* you flipped the switch. At that point your brand wasn't enabled, so it wasn't picked up.
- The afternoon (12:00 UTC) and evening (17:00 UTC) sweeps only process brands whose `delivery_time` matches that window — yours is `morning`, so they correctly skipped you.
- Result: today's idea (`Moving Beyond the Manual Logbook`, scheduled_for `2026-06-09`) is still sitting at `status=suggested, autopilot_status=NULL`. Nothing was rendered, nothing was emailed.

**Secondary bug I uncovered while looking**
Even tomorrow's 7 AM run won't pick up today's missed idea. The query in `content-autopilot` only matches:
- ideas scheduled for *local today* with `autopilot_status` null/pending, **or**
- ideas from the last 3 days **only if** their `autopilot_status` is `failed_no_credits` / `failed_error`.

An idea that was simply never attempted (status NULL, date in the past) falls into a dead zone and is permanently skipped. This will silently affect anyone who turns on autopilot after their delivery window, or anyone whose brand was added mid-week.

# The plan

### 1. Recover today's post for you (one-off)
Manually invoke `content-autopilot` for `delivery_time=morning` after temporarily marking today's idea as eligible — or simpler, directly call the rendering path for that one idea so you get today's email within minutes.

### 2. Fix the catch-up gap (code change)
In `supabase/functions/content-autopilot/index.ts`, extend the retry branch of the `content_ideas` query so missed ideas are caught on the next run:

```text
scheduled_for >= retryFrom AND scheduled_for <= localToday
  AND (autopilot_status IN (failed_no_credits, failed_error)
       OR autopilot_status IS NULL)
  AND status IN (suggested, scheduled)
```

This way, if a user enables autopilot late in the day, the next morning sweep will still render the missed post (up to 3 days back) instead of orphaning it.

### 3. Immediate-trigger on enabling Autonomous (small UX win)
When the user flips the Engine to Autonomous in `src/pages/v2/Engine.tsx`, if today's scheduled idea exists and the delivery window has already passed for today, fire `content-autopilot` once with `{ delivery_time: <their window>, brand_id: <theirs>, force: true }`. Add an optional `brand_id` + `force` path to the edge function that bypasses the hour-window check for a single brand.

### Files touched
- `supabase/functions/content-autopilot/index.ts` — relax retry query; add optional `{ brand_id, force }` single-brand path.
- `src/pages/v2/Engine.tsx` — when toggling to Autonomous, call the force path so today isn't lost.

### What you'll see after this ships
- I'll trigger the recovery call for your brand so today's post lands in your inbox.
- Tomorrow's morning sweep will now catch any same-week ideas that were missed for any reason.
- Future users enabling Autonomous mid-day will get today's post immediately instead of waiting until tomorrow.
