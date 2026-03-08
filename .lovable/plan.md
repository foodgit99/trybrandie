

## Plan: Affiliate Marketer System

### Overview
Build a full affiliate partner system where external marketers can sign up, get a unique affiliate link, track referred signups and paid conversions, and earn 20% commission on payments. Includes a dedicated affiliate dashboard with earnings, referral tracking, and payout management.

### Database Changes (4 new tables, 1 migration)

**1. `affiliates` table** — stores affiliate partner accounts
- `id`, `user_id` (FK to auth.users), `affiliate_code` (unique), `status` (pending/approved/suspended), `commission_rate` (default 0.20), `total_earned`, `total_paid`, `created_at`
- RLS: users can read/update their own row

**2. `affiliate_referrals` table** — tracks users who signed up via affiliate link
- `id`, `affiliate_id` (FK), `referred_user_id`, `status` (signed_up/converted), `created_at`
- RLS: affiliates can read their own referrals

**3. `affiliate_commissions` table** — tracks earned commissions per payment
- `id`, `affiliate_id` (FK), `referral_id` (FK), `payment_reference`, `payment_amount`, `commission_amount`, `status` (pending/approved/paid), `created_at`
- RLS: affiliates can read their own commissions

**4. `affiliate_payouts` table** — tracks payout requests and history
- `id`, `affiliate_id` (FK), `amount`, `status` (requested/processing/paid/rejected), `bank_name`, `account_number`, `account_name`, `created_at`, `processed_at`
- RLS: affiliates can read/insert their own payouts

### Backend Changes

**5. Update `paystack-webhook/index.ts`**
- On `charge.success`, check if the paying user was referred by an affiliate
- If so, create a commission record (20% of payment amount) in `affiliate_commissions`
- Update the affiliate's `total_earned`

### Frontend Changes

**6. Affiliate signup page (`src/pages/AffiliateSignup.tsx`)**
- Public page where anyone can apply to become an affiliate
- Form: name, email, password + auto-create affiliate record with "pending" status
- Or existing users can apply from settings

**7. Affiliate dashboard (`src/pages/AffiliateDashboard.tsx`)**
- Overview cards: total earned, pending commissions, total paid, total referrals
- Affiliate link with copy button and share buttons
- Referrals table: user email (masked), signup date, conversion status
- Commissions table: amount, date, status
- Payout section: request payout, bank details form, payout history

**8. Update `src/App.tsx`**
- Add `/affiliate` route (affiliate dashboard, protected)
- Add `/affiliate/signup` route (public)

**9. Update `src/pages/Auth.tsx`**
- Detect `?aff=CODE` query param and store in signup metadata as `affiliate_code`

**10. Update `handle_new_user` DB function**
- On new user creation, check if `affiliate_code` metadata exists
- If valid, create an `affiliate_referrals` record linking the new user to the affiliate

### Route Structure

| Route | Page | Access |
|---|---|---|
| `/affiliate/signup` | Affiliate application form | Public |
| `/affiliate` | Affiliate dashboard | Authenticated affiliates |

### Files Changed

| File | Change |
|---|---|
| DB migration | Create 4 tables + update trigger |
| `supabase/functions/paystack-webhook/index.ts` | Add commission tracking on payment |
| `src/pages/AffiliateSignup.tsx` | New — affiliate application |
| `src/pages/AffiliateDashboard.tsx` | New — affiliate dashboard |
| `src/App.tsx` | Add affiliate routes |
| `src/pages/Auth.tsx` | Detect `?aff=` param |

