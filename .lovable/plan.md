

## Plan: Two-Tier Affiliate Email Notification System

### Current State

The `send-email` edge function already has these affiliate templates:
- `affiliate_application_received` — sent on signup
- `affiliate_approved` / `affiliate_rejected` — admin actions
- `affiliate_new_referral` — Tier 1 notified when a customer signs up
- `affiliate_commission_earned` — generic commission email (no tier distinction)
- `affiliate_payout_processed` — payout updates

The `paystack-webhook` already sends commission emails to both Tier 1 and Tier 2 affiliates, and sends `affiliate_new_referral` to Tier 1 only.

### What's Missing

| # | Notification | Recipient | Trigger |
|---|---|---|---|
| 1 | New affiliate recruited | Tier 2 (recruiter) | Affiliate signs up via `?ref=CODE` |
| 2 | Tier 2 customer signup | Tier 2 (recruiter) | Customer signs up via a recruited affiliate's link |
| 3 | Commission type distinction | Both tiers | Payment — emails should say "direct" vs "network" and "first" vs "recurring" |
| 4 | Payout threshold reached | Either tier | `total_earned` crosses minimum payout amount |

**Additional notifications you didn't mention (recommended):**
- **Monthly earnings summary** — scheduled digest with total earned, new referrals, network growth
- **Payout threshold reached** — "You've earned enough to request a payout!"

### Changes

#### 1. New Email Templates (in `send-email/index.ts`)

**A. `affiliate_new_recruit`** — Sent to Tier 2 affiliate when someone they recruited becomes an affiliate
- Data: recruited affiliate's name/code
- CTA: "View My Network" → dashboard

**B. `affiliate_network_referral`** — Sent to Tier 2 affiliate when a customer signs up via their recruited affiliate
- Data: which affiliate brought the customer
- CTA: "View Network Earnings" → dashboard

**C. Update `affiliate_commission_earned`** — Add tier/type context
- Show whether it's "Direct commission" or "Network commission"
- Show whether it's "First payment bonus (20%)" or "Lifetime share (5%)" etc.
- Data: `commission_type` (`tier1_first`, `tier1_recurring`, `tier2_first`, `tier2_recurring`), `commission_amount`, `payment_amount`

**D. `affiliate_payout_threshold`** — Sent when earnings cross the minimum payout threshold
- CTA: "Request Payout" → dashboard

#### 2. Trigger Points

**A. `AffiliateSignup.tsx`** — After creating affiliate record with `recruited_by`:
- Look up the recruiting affiliate's email
- Send `affiliate_new_recruit` to them

**B. `paystack-webhook/index.ts`** — Already sends Tier 1 and Tier 2 commission emails. Updates needed:
- Pass `commission_type` to the email so it shows tier context
- After Tier 2 commission, check if `total_earned` crossed payout threshold → send `affiliate_payout_threshold`
- Same check for Tier 1

**C. `handle_new_user` trigger or webhook** — When a customer signs up with an `affiliate_code`:
- The existing flow already sends `affiliate_new_referral` to the direct affiliate
- NEW: Look up the direct affiliate's `recruited_by` → send `affiliate_network_referral` to the Tier 2 affiliate

#### 3. Network Referral Notification

The `handle_new_user` DB trigger currently creates the `affiliate_referrals` row but doesn't send emails (that happens elsewhere). The best place to add the Tier 2 customer signup notification is in the `paystack-webhook` — on first payment, notify the Tier 2 affiliate that a new customer in their network made their first purchase. This is already partially done but needs the network referral email added.

Alternatively, add a lightweight check in the signup flow (client-side `AffiliateSignup.tsx` or a new edge function) to notify Tier 2 when a new customer signs up via a recruited affiliate's link.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | Add 3 new templates, update commission template with tier context |
| `supabase/functions/paystack-webhook/index.ts` | Pass `commission_type` to emails, add payout threshold check, add Tier 2 network referral notification on first payment |
| `src/pages/AffiliateSignup.tsx` | Send `affiliate_new_recruit` email to recruiting affiliate on signup |

### Suggested Additional Notifications (Phase 2)

- **Monthly earnings digest** — pg_cron job summarizing the month's affiliate performance
- **Affiliate milestone badges** — "You've earned ₦50,000!" celebration emails

