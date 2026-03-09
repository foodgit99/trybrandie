
## Affiliate Partner Email System

### Current State
- `send-email` edge function already exists with Resend integration and 5 email types (welcome, referral_reward, out_of_credits, payment_confirmation, low_credits)
- `admin-action` function handles affiliate CRUD — when an admin updates `affiliates.status`, no email fires
- `paystack-webhook` creates commission records when a payment is made by a referred user — no email fires
- `AffiliateDashboard` handles payout requests — no email fires

### Emails Needed (6 total)

| Trigger | Event | Recipient | Where to hook |
|---|---|---|---|
| Application submitted | Affiliate signs up | Affiliate | `AffiliateSignup.tsx` (after insert) |
| Application approved | Admin changes `status → approved` | Affiliate | `admin-action` update handler |
| Application rejected | Admin changes `status → rejected/suspended` | Affiliate | `admin-action` update handler |
| New referral signed up | New row in `affiliate_referrals` | Affiliate | `paystack-webhook` or a new DB hook |
| Commission earned | `affiliate_commissions` record inserted | Affiliate | `paystack-webhook` (after insert) |
| Payout processed | Admin changes `affiliate_payouts.status → paid/rejected` | Affiliate | `admin-action` update handler |

### Plan

**1. Add 6 affiliate email templates to `supabase/functions/send-email/index.ts`**

New email types:
- `affiliate_application_received` — "We received your application, we'll review it shortly"
- `affiliate_approved` — "You're approved! Here's your affiliate link + dashboard link"
- `affiliate_rejected` — "Your application wasn't approved"
- `affiliate_new_referral` — "Someone signed up using your link" (triggered when referral is created)
- `affiliate_commission_earned` — "You earned ₦X commission" (triggered on commission insert)
- `affiliate_payout_processed` — "Your payout of ₦X has been paid / rejected"

**2. Update `supabase/functions/admin-action/index.ts`**

In the `update` case, detect when `table === "affiliates"` or `table === "affiliate_payouts"` and the `status` field is being changed, then look up the affiliate's user email and fire the appropriate email via internal call to `send-email`.

Specifically:
- `affiliates` update: status → `approved` → send `affiliate_approved`; status → `rejected` or `suspended` → send `affiliate_rejected`
- `affiliate_payouts` update: status → `paid` → send `affiliate_payout_processed` (paid); status → `rejected` → send `affiliate_payout_processed` (rejected)

**3. Update `supabase/functions/paystack-webhook/index.ts`**

After inserting `affiliate_commissions`, look up the affiliate's user email and send `affiliate_commission_earned`. Also add `affiliate_new_referral` email when a referral is marked `converted`.

**4. Update `src/pages/AffiliateSignup.tsx`**

After successful `affiliates` insert, call `send-email` with type `affiliate_application_received` and the user's email.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | Add 6 affiliate email HTML templates + cases |
| `supabase/functions/admin-action/index.ts` | Detect status changes → fire email in `update` case |
| `supabase/functions/paystack-webhook/index.ts` | Fire commission + referral emails after DB writes |
| `src/pages/AffiliateSignup.tsx` | Call send-email after successful application submission |
