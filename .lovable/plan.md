

## Plan: Friends of Brandie — Two-Tier Affiliate System

### What Exists Today

- **Single-tier affiliate system**: affiliates earn a flat `commission_rate` (20%) on payments from referred users
- **Tables**: `affiliates`, `affiliate_referrals`, `affiliate_commissions`, `affiliate_payouts`
- **Commission logic**: in `paystack-webhook` — looks up the direct affiliate for the paying user, calculates commission, inserts into `affiliate_commissions`, increments `total_earned`
- **Dashboard**: shows stats, referrals, commissions, bank details, payout requests
- **No concept of**: recurring vs first-payment rates, second-tier affiliates, or affiliate-recruits-affiliate relationships

### What Needs to Change

#### 1. Database Migrations

**A. Add `recruited_by` column to `affiliates` table**
- `recruited_by uuid REFERENCES affiliates(id) ON DELETE SET NULL` — tracks which affiliate recruited this affiliate
- This single column enables the entire two-tier hierarchy (max depth = 1 parent)

**B. Add `commission_type` column to `affiliate_commissions` table**
- `commission_type text NOT NULL DEFAULT 'tier1_first'` — values: `tier1_first`, `tier1_recurring`, `tier2_first`, `tier2_recurring`
- Enables the dashboard to distinguish earning sources

**C. Add `is_first_payment` tracking**
- Add `payment_count` column to `affiliate_referrals` (default 0) to distinguish first vs recurring payments
- Increment on each successful payment

#### 2. Commission Logic Update (`paystack-webhook`)

Current: flat 20% on all payments.

New logic per payment:

```text
1. Look up direct affiliate (Tier 1)
2. Check if this is the customer's first payment (payment_count = 0)
3. Tier 1 commission:
   - First payment: 20%
   - Recurring: 5%
4. Look up Tier 1 affiliate's `recruited_by` → Tier 2 affiliate
5. If Tier 2 exists:
   - First payment: 5%
   - Recurring: 3%
6. Insert commission records with appropriate `commission_type`
7. Increment `total_earned` for both affiliates
8. Increment `payment_count` on the referral
```

#### 3. Affiliate Signup — Recruitment Tracking

**A. Add recruitment link support**
- Affiliates get a second link: `trybrandie.lovable.app/affiliate/signup?ref=AFFILIATE_CODE`
- When a new affiliate signs up via this link, set `recruited_by` to the recruiting affiliate's ID

**B. Update `AffiliateSignup.tsx`**
- Read `ref` query param
- On affiliate record creation, look up the recruiting affiliate and set `recruited_by`

#### 4. Dashboard Enhancements (`AffiliateDashboard.tsx`)

**A. Stats cards update**
- Split earnings display: "Direct Earnings" vs "Network Earnings"
- Show recruited affiliates count

**B. New "My Network" tab/section**
- List of affiliates recruited by this user
- Each row: affiliate code (masked), status, referrals count, your Tier 2 earnings from them

**C. Commission table update**
- Add "Type" column showing tier/type badge (Tier 1 First, Tier 1 Recurring, Tier 2 First, Tier 2 Recurring)

**D. Recruitment link section**
- New card with the affiliate recruitment link + copy/share buttons

#### 5. Affiliate Signup Page Updates

- Update benefit cards to mention two-tier earnings: "Earn 20% on first payments, 5% lifetime, plus second-tier commissions"
- Add a "Recruit Affiliates" benefit card

#### 6. Admin Visibility

- No admin panel changes strictly required — existing admin views already show all affiliates and commissions
- The `commission_type` column will naturally appear in commission records

### Technical Details

- **Migration**: 1 SQL migration adding `recruited_by` to `affiliates`, `commission_type` to `affiliate_commissions`, `payment_count` to `affiliate_referrals`
- **Edge function**: Update `paystack-webhook/index.ts` with the tiered commission calculation
- **Frontend**: Update `AffiliateDashboard.tsx` (network section, commission types), `AffiliateSignup.tsx` (recruitment link handling)
- **No new tables** — extends existing schema
- **Guardrail**: Only 2 tiers max enforced by design (single `recruited_by` column, no recursive lookups)

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | Add 3 columns across 3 tables |
| `supabase/functions/paystack-webhook/index.ts` | Tiered commission logic |
| `src/pages/AffiliateDashboard.tsx` | Network tab, commission types, recruitment link |
| `src/pages/AffiliateSignup.tsx` | Read `ref` param, set `recruited_by` |

