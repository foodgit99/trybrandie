# Brandie Partner Module — Phase 1 (Foundation)

Introduce a two-tier affiliate system and give higher-tier partners their own growth environment: referral link, permanent lead attribution, dashboard and CRM.

- **Friend of Brandie** — the basic tier every approved affiliate has today. Nothing changes for them.
- **Marketing Partner** — promoted by admin only. Gets the Partner Dashboard, referral slug, lead CRM and (later phases) email + automation.

Phase 1 stops before email sending and automations. Those land in Phase 2/3 on top of this foundation.

## What gets built

### 1. Tier on the existing affiliate record
Affiliates keep one record. A new `tier` field holds `friend_of_brandie` (default) or `marketing_partner`. Existing referral codes, commissions and payouts keep working untouched.

Marketing Partner extras live in a companion `partner_profiles` record: partner name, partner type (Marketing Partner for now, expandable), slug, logo, contact person, phone, organization, start/end date, status, internal notes.

**Commission:** Marketing Partner commission defaults to **0%** on both first and recurring payments. Admin sets the rate manually per partner on the partner profile. The existing 20%/5% Friend-of-Brandie rates are untouched.

### 2. Admin: promote a user to Marketing Partner
In the Admin users area, a **Promote to Partner** action opens a form: partner name, type, contact person, email, phone, organization, slug (auto-suggested from name), commission rate (first / recurring, both default 0), status, start date, optional end date, notes.

Saving creates or upgrades the affiliate record to `marketing_partner`, creates the partner profile and generates the referral link `https://trybrandie.com/?ref=<slug>`.

A new **Partners** table in Admin lists every Marketing Partner with leads, paid users, revenue and status, and supports: edit, change commission, suspend/reactivate, regenerate or revoke the referral slug, manually attribute a user, view leads, export.

### 3. Referral link and permanent attribution
`/?ref=<slug>` stores the referral in a cookie/localStorage (90 days) and increments the link's click count. At signup the slug is passed through in user metadata; the existing signup trigger resolves it to a partner and writes a permanent lead row (`partner_id`, `user_id`, source, attributed_at). Attribution never changes after that — plan changes, credit purchases and inactivity leave it intact. If a slug matches a Friend-of-Brandie affiliate code instead, existing affiliate attribution keeps working exactly as it does today.

### 4. Partner Dashboard (`/partner`)
Visible only to users whose affiliate tier is `marketing_partner`. Greeting plus headline metrics: Leads, Activated, Paying users, Conversion rate, Credits distributed. A "This week" block with new leads / activated / paid. Quick actions: Copy referral link, view leads, export CSV. Email/campaign/automation quick actions are shown as coming in Phase 2 (disabled).

### 5. Partner CRM — My Leads
A table of attributed users: name, email, status, credits, designs created, last active, plan, joined. Filter by status, search, sort, export CSV.

Statuses are computed, not stored: New, Activated, Active, Low Credits, Exhausted, Paid, Inactive, Churned.

Clicking a lead opens a profile: acquisition source, join date, plan, credit balance, designs created, last active, plus a lightweight activity timeline (signup, brand setup, design creation, credit thresholds, purchases).

### 6. Privacy boundary (enforced server-side)
Partners see only: name, email, signup date, plan, credit balance, usage/activity counts, designs created count, last active, subscription status.

Partners never see: passwords, payment details, design content or images, private conversations or AI context, brand data, other partners' leads, or any user not attributed to them. Lead reads go through a partner-scoped edge function using a whitelist of fields — never a direct client query against `profiles`.

## Technical notes

- **Migration**: add `tier` to `affiliates`; new tables `partner_profiles`, `partner_referral_links`, `partner_leads`. Each gets GRANTs, RLS, `created_at`/`updated_at` with the standard update trigger. Security-definer helpers `is_marketing_partner(_user_id)` and `partner_id_for_user(_user_id)`; RLS scopes partner reads to their own rows only.
- **Attribution**: extend `handle_new_user()` to resolve a `partner_slug` in user metadata into a `partner_leads` row; keep current `affiliate_code` handling as-is.
- **New edge function `partner-portal`**: JWT-validated actions `overview`, `leads`, `lead_detail`, `export_leads` — aggregates credits/designs/activity server-side and returns only whitelisted fields.
- **Admin**: extend `admin-action` with `promote_to_partner`, partner CRUD, slug regeneration and manual attribution; register `partner_profiles` / `partner_leads` / `partner_referral_links` in the admin tables list.
- **Frontend**: `src/pages/PartnerDashboard.tsx` with `PartnerLeadsTable` and `LeadDetailDialog`; `/partner` route guarded by tier; ref-capture hook mounted on the landing/auth entry; nav entry shown only for Marketing Partners. Existing affiliate dashboard stays as-is for Friend of Brandie.
- Partner email uses a **separate pipeline** (its own `partner_campaigns` tables and send function) in Phase 2 — kept independent of the brand Outbox engine.
