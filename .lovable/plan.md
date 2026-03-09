

# Cap Bonus Credit Earnings to 3 Per Month

## Context
Currently, users can earn unlimited referral bonus credits (5 credits per successful referral). This creates potential for abuse. The cap limits a user to earning bonus credits from referrals **3 times per month** (max 15 bonus credits/month), resetting on the 1st of each month at midnight.

## Approach

### 1. Add tracking columns to `profiles` table
Add two new columns:
- `bonus_earned_count` (integer, default 0) — tracks how many times bonus credits were earned this month
- `bonus_earned_reset_at` (timestamptz, default now()) — tracks when the counter was last reset

### 2. Update `process_referral` database function
Before awarding credits, check:
- If `bonus_earned_reset_at` is in a previous month, reset `bonus_earned_count` to 0
- If `bonus_earned_count >= 3`, return early with `reason: 'monthly_bonus_cap_reached'`
- Otherwise, increment both `bonus_credits` and `bonus_earned_count`

### 3. Update monthly reset logic in `design-studio` edge function
When `needsReset` triggers (new month), also reset `bonus_earned_count` to 0 and update `bonus_earned_reset_at`.

## Files to Change
- **Migration**: Add `bonus_earned_count` and `bonus_earned_reset_at` columns to `profiles`
- **Migration**: Replace `process_referral` function with cap logic
- **`supabase/functions/design-studio/index.ts`**: Reset `bonus_earned_count` on month rollover

## Key Detail
The cap is on the **number of referral reward events** (3 times), not the credit amount. Each event still awards 5 credits, so max monthly bonus = 15 credits.

