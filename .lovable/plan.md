

## Fix: Autopilot Email "View in Design History" Link

### Problem
The email template uses `/design-history` which doesn't exist as a route. The correct route is `/history`.

### Change
**`supabase/functions/send-email/index.ts`** — Update the link URL from `${APP_URL}/design-history` to `${APP_URL}/history` (appears twice: once in the download button fallback and once in the "View in Design History" text link).

Then redeploy the `send-email` edge function.

