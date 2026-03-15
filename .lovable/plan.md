

# Daily Content Reminder Email System

## Overview

Create a new edge function triggered by a daily cron job that queries each user's scheduled content ideas for the day, then sends a summary email via the existing `send-email` function with a CTA to the Content Hub.

## Architecture

```text
pg_cron (daily 7am UTC)
  → net.http_post → content-daily-reminder edge function
    → query content_ideas WHERE scheduled_for = today
    → group by user_id
    → for each user with ideas: call send-email with type "daily_content_reminder"
```

## Implementation

### 1. New email template in `send-email` edge function

Add a `daily_content_reminder` type with an HTML template that shows:
- A greeting with the user's name
- Today's date formatted nicely
- A list of content idea titles scheduled for the day (with pillar/series labels if linked)
- A prominent "Open Content Hub" CTA button linking to `/content`
- Matches existing Brandie email styling (dark header, gold accent)

### 2. New edge function: `content-daily-reminder`

- Uses service role key to query across all users
- Queries `content_ideas` joined with `profiles` and `auth.users` (for email) where `scheduled_for = today` and `status IN ('suggested', 'scheduled')`
- Groups ideas by `user_id`
- Optionally joins `content_pillars` and `post_series` to include labels
- For each user, calls `send-email` with type `daily_content_reminder`, passing the user's email and the list of ideas
- Skips users with no ideas for the day
- Returns a summary of how many emails were sent

### 3. Cron job setup

- Schedule via `cron.schedule` to run daily (e.g., `0 7 * * *` — 7am UTC)
- Calls the `content-daily-reminder` edge function

### 4. Config update

- Add `[functions.content-daily-reminder]` with `verify_jwt = false` to config.toml (handled automatically)

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | Add `daily_content_reminder` template + case |
| `supabase/functions/content-daily-reminder/index.ts` | New edge function — query today's ideas, send emails per user |
| SQL (via insert tool) | pg_cron job to invoke the function daily |

## Technical Notes

- The cron job SQL will be run via the insert tool (not migration) since it contains project-specific URLs and keys
- The reminder function uses the service role key to read across users — no RLS bypass needed since it runs server-side
- Users with zero ideas for the day get no email (no spam)
- The email lists idea titles as bullet points with optional pillar/series context

