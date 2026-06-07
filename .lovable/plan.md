
# Hybrid Pricing: PAYG + 3-Tier Subscriptions

## 1. Goals & guardrails

- PAYG (₦5,000 / 20 credits) stays the default and ships unchanged.
- Layer a 3-tier monthly subscription on top: Entrepreneur ₦18,500 / 100 cr, Creator ₦37,000 / 200 cr, Agency ₦92,500 / 500 cr.
- Free 5/mo and PAYG packs remain available for everyone, even subscribers (additive).
- Monthly subscription credits **expire** on renewal (use-it-or-lose-it).
- Recurring billing handled as monthly one-off Paystack charges driven by a scheduler + email/WhatsApp reminders (no Paystack Plans API).
- Build out the full feature set the new tiers advertise: Multi-Brand, Team Access, Client Folders, White-Label Exports, Priority Rendering.
- Reuse existing deduction order; add subscription credits as a new bucket.

## 2. Credit model (deduction order)

New order, soonest-expiring first:
1. **Free monthly** (5/mo)
2. **Subscription credits** (expire on renewal day)
3. **Bonus credits** (referrals)
4. **Reward credits** (`credit_rewards`)
5. **Paid credits** (PAYG, never expire)

Every credit-spending edge function (`design-studio`, `logo-designer`, `carousel`, `content-autopilot`, `video-studio`, `trend-recommend`, etc.) needs a shared helper update to deduct in this order.

## 3. Data model

### New table: `subscription_plans` (catalog, read-only)
`id (slug)`, `name`, `price_naira`, `monthly_credits`, `brand_limit` (1 or null=unlimited), `features jsonb` (team, client_folders, white_label, priority_rendering booleans), `sort_order`.
Seed: `entrepreneur`, `creator`, `agency`.

### New table: `subscriptions`
- `id`, `user_id` (unique), `plan_id`, `status` (`active` | `past_due` | `cancelled`), `current_period_start`, `current_period_end`, `cancel_at_period_end bool`, `last_charge_reference`, timestamps.
- RLS: user reads own row, service_role writes, admin all.

### New table: `subscription_credits` (per-period grant ledger)
- `id`, `subscription_id`, `user_id`, `amount`, `remaining`, `granted_at`, `expires_at` (= period end).
- Lets us cleanly expire and audit per-cycle grants.

### New table: `subscription_charges` (renewal ledger)
- `id`, `subscription_id`, `user_id`, `paystack_reference UNIQUE`, `amount`, `status` (`pending`|`success`|`failed`), `attempt_count`, timestamps.

### New table: `brand_team_members`
- `id`, `brand_id`, `user_id` (nullable until accept), `email`, `role` (`owner`|`editor`|`viewer`), `status` (`pending`|`active`|`revoked`), `invited_by`, `invited_at`, `accepted_at`.
- Brand access policies updated so members with `active` status get same read/write rights via a helper SQL function `has_brand_access(brand_id, user_id)`.

### New table: `client_folders` (Agency only)
- `id`, `owner_user_id`, `name`, `color`, timestamps.
- `brands` table gets nullable `client_folder_id` (Agency users group brands into folders).

### `brands` constraint
- Add `is_archived bool default false`. Enforce brand-limit on insert via trigger: if user's plan = `entrepreneur` or free → max 1 active brand; Creator/Agency → unlimited.

### `profiles` additions
- `priority_render_until timestamptz` (set when active subscription includes priority).
- Existing `subscription_tier` text column is reused; values become `free | entrepreneur | creator | agency`.

All new public tables get GRANTs to authenticated + service_role + RLS scoped to ownership.

## 4. Billing flow (Paystack, one-off recurring)

1. **Initial purchase**: new edge function `paystack-subscribe` → creates Paystack transaction with metadata `{type:"subscription", plan_id, user_id}`, reuses callback to `/plans`.
2. **paystack-webhook / paystack-verify**: branch on `metadata.type`.
   - If `subscription` first charge: insert `subscriptions` row (active, period = +30 days), insert `subscription_credits` grant, update `profiles.subscription_tier` and `priority_render_until`.
   - Idempotent via `subscription_charges.paystack_reference UNIQUE`.
3. **Renewal scheduler** (new edge function `subscription-renewals` + pg_cron daily 06:00 Africa/Lagos):
   - For subs whose `current_period_end <= now() + 3 days` and not `cancel_at_period_end`: send reminder email + WhatsApp via existing `send-email` and notification rails.
   - On `current_period_end`: attempt charge via Paystack `transaction/charge_authorization` using the stored `authorization_code` from the first transaction (Paystack returns this on every charge).
     - Success → roll period forward 30 days, expire old `subscription_credits`, insert fresh grant.
     - Failure → set `status='past_due'`, send dunning email; retry T+1, T+3, T+7. After 7 days → `status='cancelled'`, drop tier to `free`, expire credits.
4. **Cancel**: user toggles `cancel_at_period_end=true` from Settings; credits stay until period end, then `status='cancelled'`.
5. **Upgrade/downgrade**: immediate plan switch; pro-rate by charging the diff for upgrades, schedule downgrade at period end. (V1: simple — upgrade now / downgrade at period end, no proration to keep math simple.)

## 5. Feature gating

Single `useSubscription()` hook returns `{ plan, features, brandLimit, isActive, periodEnd }`. Used everywhere:

- **Multi-Brand**: Brand switcher in `NewAppHeader` (dropdown), new `/brands` management page, server-side enforcement via insert trigger.
- **Team Access** (Creator+): Invite UI inside Brand Centre → Settings tab. Email invite via Resend with magic link. Member acceptance flow on `/invite/:token` route. Brand RLS updated to allow team members.
- **Client Folders** (Agency): New folder CRUD UI in Brand switcher; `client_folder_id` on `brands`. Grouped sidebar view.
- **White-Label Exports** (Agency): Watermark logic in `design-studio` / download path checks plan → omit watermark for Agency on all credit types (today's rule: paid credits = no watermark; Agency = no watermark ever).
- **Priority Rendering** (Agency): `design_jobs` worker (`design-enqueue` / `inngest`) reads `priority_render_until` and orders queue by `(priority DESC, created_at ASC)`. Add `priority smallint default 0` to `design_jobs`.

## 6. UI changes

### `/pricing` (public) and `/plans` (in-app)
Restructure into two stacked sections:
- **Subscriptions** (3 cards, Creator highlighted "Most popular"). Each card: price, monthly credits, brand limit, feature checklist, CTA "Start Entrepreneur / Creator / Agency". Active sub shows "Current plan" with manage button.
- **Or top up anytime** — existing slider PAYG block kept beneath.

Toggle to switch monthly/annual is **out of scope** (V1 monthly only).

### `/settings` → new "Subscription" section
- Current plan + next renewal date + credits used vs granted.
- Buttons: Change plan / Cancel at period end / Reactivate.
- Payment history table from `subscription_charges`.

### `NewAppHeader` credits badge
- Tooltip breakdown: Subscription (X/Y), Free, Bonus, Reward, Paid.
- Brand switcher appears next to logo when user has > 1 brand.

### Landing page `LandingPricing`
- Add subscription cards above PAYG slider. CTA copy keeps "Start free" path.

### Admin panel
- New "Subscriptions" tab: list subs with status, plan, MRR, churn. Manual override buttons (grant period, force-cancel).

## 7. Migration sequence

1. **Migration A**: tables `subscription_plans` (+ seed), `subscriptions`, `subscription_credits`, `subscription_charges`, `brand_team_members`, `client_folders`. GRANTs + RLS. Adds `priority smallint` to `design_jobs`, `client_folder_id uuid`, `is_archived bool` to `brands`, `priority_render_until timestamptz` to `profiles`.
2. **Migration B**: helper SQL function `has_brand_access`; update brand-related RLS policies to use it; brand-limit insert trigger.
3. **Migration C**: pg_cron schedule for `subscription-renewals` (via insert tool — contains anon key).
4. Edge functions: `paystack-subscribe`, `subscription-renewals`, `subscription-cancel`, `team-invite-accept`. Update `paystack-webhook` and `paystack-verify` to branch on `metadata.type`.
5. Shared helper `supabase/functions/_shared/credit-deduction.ts` updated to include subscription bucket; all callers updated.
6. Frontend: `useSubscription`, `/pricing` + `/plans` redesign, Settings subscription panel, brand switcher, team invite UI, client folders UI, white-label/priority enforcement.
7. Landing + admin updates.

## 8. Out of scope (V1)

- Annual billing / discounts.
- Proration on plan changes (downgrade defers to period end; upgrade is fresh full charge).
- Per-seat pricing for teams (seats are unlimited within Creator/Agency for V1).
- SSO / SAML for Agency.

## 9. Risks & notes

- Paystack `authorization_code` is required for unattended renewals — first charge must capture and store it on `subscriptions.authorization_code` (encrypted at rest is overkill for V1; stored plain — it's tied to user+merchant and can't be used elsewhere).
- Multi-brand changes touch many queries that currently assume `brands.user_id = auth.uid()` with `maybeSingle`. Audit `useBrand`, autopilot, content hub, design studio for the active-brand id (store in context / URL param).
- Migration B will rewrite brand RLS — must test team-member read paths thoroughly.
- Credits expiring on renewal must run inside the same transaction that grants the new batch to avoid a window where users have zero.

After approval I will execute migrations first (one at a time), then edge functions, then frontend.
