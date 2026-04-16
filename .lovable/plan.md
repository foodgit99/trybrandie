

## Plan: Admin Credit Reward System

### Concept
A new credit bucket — **reward credits** — that admins can grant to specific users with a set expiry date. These credits are non-renewable, expire automatically, and slot into the existing deduction hierarchy between Bonus and Paid credits.

**Deduction order becomes:** Free Monthly → Bonus → **Reward** → Paid

### Database

**New table: `credit_rewards`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | recipient |
| amount | integer | credits granted |
| remaining | integer | credits left to use |
| reason | text | admin note (e.g. "contest winner") |
| granted_by | uuid | admin user_id |
| expires_at | timestamptz | when these credits expire |
| created_at | timestamptz | grant date |

RLS: admins full access, users can SELECT own rows. Service role full access for edge functions.

### Admin UI — `src/pages/Admin.tsx`

- Add a "Grant Credits" button on user detail sheets
- Dialog with fields: amount (number), reason (text), expires in (dropdown: 7 days, 14 days, 30 days, 60 days, 90 days, custom date)
- Uses the existing `admin-action` edge function with a new `grant_reward` operation
- Show active rewards on user detail view with remaining balance and expiry countdown

### Edge Function — `supabase/functions/admin-action/index.ts`

- Add `grant_reward` operation that inserts into `credit_rewards`
- Add `credit_rewards` to `ALLOWED_TABLES` for admin list/view

### Credit Deduction — All 6 Edge Functions

Update the deduction logic in these files to:
1. Query `credit_rewards` for the user where `remaining > 0` and `expires_at > now()`, ordered by `expires_at ASC` (use soonest-expiring first)
2. After consuming bonus credits and before paid credits, consume from reward credits
3. Decrement `remaining` on each reward row used

Files to update:
- `supabase/functions/design-studio/index.ts`
- `supabase/functions/brand-engine/index.ts`
- `supabase/functions/video-render/index.ts`
- `supabase/functions/video-studio/index.ts`
- `supabase/functions/logo-designer/index.ts`
- `supabase/functions/trend-scout/index.ts`

### Credit Display — Frontend

Update credit calculation in these files to include reward credits in the total:
- `src/components/AppHeader.tsx`
- `src/components/LowCreditsBanner.tsx`
- `src/pages/Index.tsx`
- `src/pages/Plans.tsx` (if it shows balance)

Query: `SELECT COALESCE(SUM(remaining), 0) FROM credit_rewards WHERE user_id = ? AND remaining > 0 AND expires_at > now()`

### Files
- New migration — `credit_rewards` table + RLS
- `supabase/functions/admin-action/index.ts` — new `grant_reward` operation + table allowlist
- `supabase/functions/design-studio/index.ts` — reward deduction step
- `supabase/functions/brand-engine/index.ts` — reward deduction step
- `supabase/functions/video-render/index.ts` — reward deduction step
- `supabase/functions/video-studio/index.ts` — reward deduction step
- `supabase/functions/logo-designer/index.ts` — reward deduction step
- `supabase/functions/trend-scout/index.ts` — reward deduction step
- `src/components/AppHeader.tsx` — include reward credits in balance
- `src/components/LowCreditsBanner.tsx` — include reward credits
- `src/pages/Index.tsx` — include reward credits
- `src/pages/Admin.tsx` — grant credits UI + reward display

