

# Plan: Admin CRM & Email Campaign Manager

## Summary
Build a Mailchimp-style email campaign system inside the Admin panel. Admins can segment users by filters (subscription tier, signup date, activity level, etc.), compose rich branded emails with live preview, send immediately or schedule for later, and track send history.

## Database Changes

### 1. New table: `email_campaigns`
Stores each campaign with its content, audience filters, status, and schedule.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| admin_user_id | uuid | Who created it |
| subject | text | Email subject line |
| headline | text | Email headline |
| body | text | Message body (supports newlines for paragraphs) |
| cta_text | text | Optional button text |
| cta_url | text | Optional button URL |
| segment_filters | jsonb | `{ tier: [], has_brand: bool, signed_up_before/after: date, min_designs: int, has_referrals: bool }` |
| status | text | `draft` / `scheduled` / `sending` / `sent` / `failed` |
| scheduled_for | timestamptz | Null = send immediately |
| recipient_count | int | Calculated at send time |
| sent_count | int | Default 0 |
| failed_count | int | Default 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: Admin-only (read/write/delete via `has_role`).

### 2. New table: `email_campaign_logs`
Tracks individual send results per campaign.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| campaign_id | uuid | FK to email_campaigns |
| user_id | uuid | Recipient |
| email | text | Recipient email |
| status | text | `sent` / `failed` |
| error | text | Nullable |
| sent_at | timestamptz | |

RLS: Admin-only SELECT.

## Backend Changes

### 3. Update `supabase/functions/admin-action/index.ts`
Add new operations:

- **`segment_count`**: Given `segment_filters` jsonb, query profiles + auth to count matching users. Filters: `subscription_tier` (array), `has_brand` (bool), `signed_up_after` / `signed_up_before` (date), `min_designs` (int), `has_referrals` (bool).
- **`send_campaign`**: Given a campaign ID, fetch the campaign, resolve segment to user list, loop and send via the existing `send-email` function using a new `campaign` email type, update campaign status and logs.
- **`campaign_stats`**: Return aggregate stats for a campaign (sent/failed/total).

Add `email_campaigns` and `email_campaign_logs` to `ALLOWED_TABLES` so list/get/update/delete work.

### 4. Update `supabase/functions/send-email/index.ts`
Add a new email type `campaign` that accepts `{ subject_line, headline, message, cta_text, cta_url }` — reuses the existing `affiliateBroadcastHtml` template style but with a generic footer ("You received this from Brandie" instead of affiliate-specific).

### 5. New edge function: `supabase/functions/campaign-scheduler/index.ts`
A lightweight function invoked by pg_cron every minute. Queries `email_campaigns` where `status = 'scheduled'` and `scheduled_for <= now()`, then invokes the `admin-action` `send_campaign` operation for each.

## Frontend Changes

### 6. New tab in Admin: "Email CRM" (replaces current "Broadcast")
A full-featured campaign manager with sub-views:

**Campaign List View:**
- Table/cards showing all campaigns with status badges (Draft, Scheduled, Sending, Sent)
- Stats per campaign: recipients, sent, failed
- Actions: Edit (draft only), Duplicate, Delete, View Report

**Campaign Composer (Sheet/Dialog):**
- **Audience Segment Builder**: Multi-select chips for subscription tier (Free, Entrepreneur, Creator, Agency), toggles for "Has brand", "Has designs", "Signed up in last N days", date range picker
- **Live recipient count**: Updates as filters change (debounced API call)
- **Email composer**: Subject, headline, body (textarea), optional CTA button
- **Live email preview**: Rendered preview matching Brandie's email style
- **Schedule options**: "Send Now" or "Schedule" with date/time picker
- **Send confirmation dialog**: Shows recipient count and schedule

**Campaign Report View:**
- Summary stats: total recipients, sent, failed
- Log table with individual send statuses

### 7. Files changed/created:
1. `supabase/functions/admin-action/index.ts` — add segment_count, send_campaign ops + allowed tables
2. `supabase/functions/send-email/index.ts` — add `campaign` email type
3. `supabase/functions/campaign-scheduler/index.ts` — new cron-triggered function
4. `src/pages/Admin.tsx` — replace BroadcastTab with full CRM EmailTab
5. DB migration — create `email_campaigns` + `email_campaign_logs` tables + pg_cron job

## Technical Notes
- Segment resolution happens server-side in admin-action using service role to query profiles and auth.users
- Emails sent via existing Resend integration (no new API keys needed)
- Scheduled campaigns use pg_cron calling the campaign-scheduler edge function
- All operations are admin-gated via `has_role` check in the edge function

