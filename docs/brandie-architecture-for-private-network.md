# Brandie architecture and current implementation report, for adding a Private Network module

This is a read-only audit as of 2 October 2026. Nothing in the code, schema, data or feature flags was changed. Every claim below comes from reading files or querying the live catalog.

Status labels: **IMPL** means implemented and verified. **IMPL-UT** means implemented but not tested end to end. **PH** means placeholder, hidden or blocked.

## 1. Stack
- **Frontend:** React 18, Vite 5 (react and react-dom are deduped), TypeScript, Tailwind v3, shadcn/ui, TanStack Query and react-router v6.
- **Backend:** Lovable Cloud, which provides Postgres, Auth, Storage and Deno edge functions.
  - There are 64 functions in `supabase/functions/`.
  - Migration history: 138 legacy migrations in `supabase/migrations/`, plus Drizzle migrations `drizzle/migrations/0001–0005`. All of the Drizzle migrations belong to Creator Network.
- **AI:** calls go through the Lovable AI Gateway, using `_shared/model-fallback.ts`, `token-budget.ts`, `tracer.ts`, `ai-cache.ts`, `circuit-breaker.ts`, `sanitise.ts` and `validate-output.ts`.
- **Tests:** Vitest, with `src/features/creator-network/__tests__/` holding 31 passing rule tests (re-run 2 Oct 2026). Playwright runs ad hoc and is not in CI.
- **Build:** the latest entry, at 2026-10-02T20:36Z, is `build OK`. TypeScript is clean.

## 2. Auth, roles and tenant boundaries
- **Auth state:** a singleton store, `src/lib/authStore.ts`, sits behind `useAuth()` in `src/hooks/useAuth.tsx`. It makes one `getSession` call per page load. Do not create a second auth listener.
- **Global roles:**
  - The `app_role` enum has `admin`, `moderator` and `user`.
  - Roles are stored as `user_roles(id, user_id, role app_role, created_at)`.
  - Checks use `has_role(uid, role)`, a security definer. The client reads it through `useAdminRole`.
- **Module roles stay in separate tables:**
  - `creator_network_members(id, user_id, role text, created_at, created_by)`, with the roles admin, research, partnerships, production and sales.
  - It is checked through `creator_network_has_access`, `creator_network_can(_role)` and `creator_network_can_any(_roles[])`. A Brandie admin is treated as a Creator Network admin.
  - Partners use `is_marketing_partner` and `partner_id_for_user`. Affiliates use `useAffiliateRole`.
- **Tenants:** the tenant is the brand.
  - `brands.user_id` is the owner.
  - `brand_team_members(brand_id, user_id, email, role, status, invite_token, …)` holds team members.
  - Access helpers: `has_brand_access`, `is_brand_owner` and `is_active_brand_member`.
  - There is no organisation or workspace table.
- **Background jobs:** the service role bypasses checks, and the user context comes from the request body (see the Autopilot rule).

## 3. Routes and navigation (`src/App.tsx`, 60 routes)
- **Public:** `/`, `/auth`, `/reset-password`, `/verify-alias`, `/c/:slug`, `/invite/:token`, `/pricing`, `/affiliates`, `/affiliate/signup`.
- **App:** `/onboarding`, `/cockpit`, `/blueprint`, `/post/:dayId`, `/report`, `/brand`, `/brand/editor`, `/brands`, `/settings`, `/profile`, `/partner`, `/engine`, `/hub`, `/content-hub`, `/agent*`, `/studio`, `/history`, `/support`, `/plans`, `/affiliate`, `/admin`, `/admin/google-connect`.
- **Module:** `/creator-network/*` is lazy-loaded (`App.tsx:70`) and served by `CreatorNetworkRoutes.tsx`, which is wrapped in `CreatorNetworkGate`.
- **Redirects and legacy:** `/v2/*` and `/legacy/*` are redirect and legacy groups and must not be touched. There is also a `*` catch-all.
- **Navigation:**
  - `src/components/v2/NewFloatingNav.tsx` holds the `primaryPrefixes` allow-list (lines 60–76). The nav only renders on these prefixes.
  - The same file defines a `creatorNetworkItem` that is appended when `useCreatorNetwork().canAccess` is true (around line 92).
  - `NewAppHeader.tsx` holds the menu. It also has a download link for the Creator Network readiness report at line 147.
  - `src/pages/Admin.tsx` registers tabs; `CreatorNetworkAdminTab` is at lines 87 and 3213.

## 4. Existing modules
| Module | Key files and functions | Status |
|---|---|---|
| Blueprint / Autopilot | `pages/v2/Blueprint.tsx` (approveWeek, a client-side bulk update), `autopilot-planner`, `content-autopilot`, `autopilot-retry`, `approve-blueprint` (secondary) | IMPL |
| Studio / Design pipeline | `design-enqueue` → `design_jobs` → `design-dispatch` → `design-studio` → `designs` | IMPL |
| Hub, Trends, Competitors | `pages/v2/Hub.tsx`, `trend-*`, `competitor-*` | IMPL |
| Campaign pages (one live at a time) | `campaigns_public`, `campaign-engine`, `campaign-track`, `campaign-scheduler`, `/c/:slug`, `UnifiedCampaigns.tsx` | IMPL |
| Content campaigns | `campaigns`, `_shared/campaign-context.ts`, `resolve-autopilot-campaign.ts` | IMPL |
| Partner | `partner_*` (profiles, referral_links, leads, campaigns, campaign_sends, automations, credit_grants, email_suppression), `partner-portal`, `partner-campaign-send`, `partner-automation-tick` | IMPL |
| Affiliate | `affiliates`, `affiliate_referrals`, `affiliate_commissions`, `affiliate_payouts` | IMPL |
| Email (Brandie Outbox) | `email-marketing-*`, `marketing_*`, `email_*`, via Resend | IMPL |
| WhatsApp | `whatsapp-send`, `whatsapp_deliveries`, via Twilio | PH (trial expired, error 20003) |
| Video | `video-studio`, `video-render`, `video_projects` and `video_scenes` | PH (screens removed, needs API keys) |
| Creator Network V1 | `src/features/creator-network/**`, `creator-network-ai` | IMPL, flag OFF, closure E2E passed except WhatsApp |
| **"Distribution OS"** | Nothing by this name exists. Distribution today is spread across Campaign pages, Partner, Affiliate, Email and WhatsApp. | Absent |
| **Private Network** | No code, tables, functions or flags exist (a search for `private.?network` found nothing). | Absent |

## 5. Data, row security, storage and functions
- **Row security:** every public table has row security with policies.
  - No policy targets `anon` directly. Public reads go through security-definer RPCs: `get_campaign_page(_slug)` and `get_active_campaign_page()`.
  - All `creator_network_*` tables are scoped to authenticated users and gated by `creator_network_can*`.
  - `creator_network_activity_log` allows only INSERT and SELECT, so it is append-only.
  - `creator_network_settings` allows only SELECT and UPDATE, and holds a single row (`id boolean`).
- **Storage buckets:**
  - Public: `brand-logos`, `brand-inspiration`, `designs`, `brand-products`.
  - Private: `avatars` and `creator-network-assets`. Creator Network assets are only served through signed URLs, via `signedAssetUrl()` in `api/db.ts`.
- **Functions with `verify_jwt=false`** (each validates the caller itself): design-studio, audience-intelligence, summarise-update, trend-recommend, paystack-checkout/webhook/verify, admin-action, send-email, brand-engine, brand-strategist, video-studio/render, trend-scout, brand-scraper, autopilot-planner/retry, design-enqueue/dispatch, email-marketing-*, email-alias-verify, notification-email-retry, creator-network-ai.
- **Triggers to respect:**
  - `creator_network_guard_stage`: opportunity stages can only change through `creator_network_transition_opportunity()`.
  - `creator_network_gate_production`: production requires rights.
  - `creator_network_after_sale`: a paid sale automatically creates an earning.
  - `creator_network_concept_approval`.
  - `creator_network_log_transition`: muted through the session setting `creator_network.transition` while the RPC runs.
  - `enforce_brand_limit` and `enforce_competitor_limit`.
  - `validate_campaign_public`: only one active campaign.

## 6. Exact shapes to integrate with
- **`creator_network_licences`:**
  - Links: id, creator_id!, brand_id, prospect_id, opportunity_id, production_job_id.
  - Terms: licence_scope! ('Preview' or 'Commercial'), status! (Negotiating, Signed, Active, …).
  - Permissions (all booleans): likeness, voice, organic_social, paid_advertising, creator_posted, digital_twin.
  - Coverage lists (arrays): platforms[], territories[], restricted_categories[], restricted_brands[].
  - Dates and approvals: starts_at, expires_at, duration_months, creator_approval_required, approval_requirements, agreement_path.
  - Money: compensation_model, fixed_fee, royalty_rate, currency, payment_status.
  - Revocation and housekeeping: revoked, revoked_at, revocation_reason, record_source, is_test.
- **`creator_network_production_jobs`:**
  - Links: id, code (JOB-), opportunity_id!, concept_id!, creator_id!, brand_id, prospect_id, product_source, product_id.
  - Rights and pipeline links: rights_mode!, design_job_id, video_project_id.
  - Workflow: stage!.
  - Assets: preview_path, clean_master_path, output_url.
  - Status: blocked, blocker, is_test.
- **`creator_network_sales`:**
  - Links: id, code, opportunity_id!, brand_id, prospect_id, creator_id, production_job_id.
  - Outreach: channel, offer_price, currency, outreach_message, outreach_approved_by, outreach_approved_at, sent_at.
  - Response and payment: response_classification, status, payment_status, paid_amount, creator_royalty, is_test.
- **`creator_network_earnings`:** creator_id!, opportunity_id, sale_id, earning_type!, fixed_fee, royalty, gross_sale_amount, payable_amount!, currency, status, paid_at, payout_id, payout_reference, is_test.
- **`campaigns_public`:**
  - Ownership: id, user_id!, partner_id, partner_campaign_id.
  - Content: name, slug!, goal, audience, offer_text, sections jsonb, copy jsonb.
  - Lifecycle: status!, review_note, starts_at, ends_at, submitted_at, approved_at, activated_at, deactivated_at.
  - Counters: views_count, clicks_count, signups_count.
- **`campaign_page_events`:** campaign_id!, event_name!, section_key, referral_slug, user_id.
- **Partner tables:**
  - `partner_profiles`: id, user_id!, affiliate_id, slug!, partner_type, status, commission_first_pct, commission_recurring_pct, start_date, end_date.
  - `partner_referral_links`: partner_id!, code!, label, click_count, active.
  - `partner_leads`: partner_id!, user_id!, source!, attributed_at, referral_code, credit_grant_id, credits_granted.
- **Affiliate tables:** `affiliates` holds affiliate_code, tier, commission_rate, totals and bank details. `affiliate_referrals` and `affiliate_commissions` hold payment_reference, payment_amount, commission_amount and commission_type.
- **Payments:**
  - `payment_transactions` has reference UNIQUE, user_id, credits, amount, currency, status, credited_via and raw_event.
  - `subscriptions` and `subscription_charges` (paystack_reference UNIQUE).
- **`content_ideas`:** already has a nullable `creator_network_source_id`. This is the precedent for linking a module row into the core.
- **Delivery and contacts:**
  - `whatsapp_deliveries`: user_id, idea_id, to_number, message_sid, status, error_text, reason.
  - `marketing_contacts`: brand_id, email, tags[], status, consent_at, double_opt_in_token, metadata.
  - `marketing_suppression`: brand_id, email, reason.
- **`design_jobs`:** user_id, brand_id, kind, status, progress, stage, input jsonb, result jsonb, error jsonb, attempts, priority, heartbeat_at.

### Licensing contract (reuse, do not reimplement)
`src/features/creator-network/services/licenceEligibility.ts` exports `checkEligibility(licences: LicenceLike[], req: UsageRequest): { allowed, reasons[] }`.
- `req` has the shape `{ mode: 'Preview'|'Commercial', usage: 'paid'|'organic'|'creator_posted', platform?, territory?, category?, brandName?, needsVoice?, needsDigitalTwin?, creatorApproved?, today? }`.
- Preview needs a non-revoked licence with `likeness_permission` and a status of Signed, Active or Negotiating.
- Commercial needs a Signed or Active Commercial-scope licence covering the usage, platform and territory, with no restricted category or brand, and creator approval recorded if the licence requires it.
- This check currently runs on the client only. Server-side enforcement exists only in the production gate trigger.
- **For Private Network distribution of licensed likeness assets:** the server must check eligibility again before every send. This means porting it to a SQL function, or to `_shared/`, as part of the new module.
- **Asset handling:** only `clean_master_path` from a Fulfilled job may be distributed commercially. `preview_path` is watermarked (`utils/watermark.ts`) and stays internal.

### Attribution contract
- **Partner referral:** `src/lib/partnerRef.ts` stores `brandie_partner_ref` in localStorage for 90 days.
  - It is captured from `?ref=` or `?partner=`.
  - At signup it becomes a `partner_leads` row (`_shared/partner-leads.ts`, `process_referral`). Attribution is permanent.
- **Campaign:** `src/lib/campaignTrack.ts` stores `brandie_campaign_ref` for 90 days.
  - `trackCampaignEvent(event, slug, section)` calls the `campaign-track` function with `{ slug, event: view|section_view|cta_click|signup|conversion, section, ref }`.
  - This tracking is additive only.
- **Precedence:** affiliate attribution always wins over campaign attribution. A Private Network must add its own source tag and must never overwrite `partner_leads` or affiliate attribution.
- **Payment credit:** both `paystack-webhook` and `paystack-verify` add credits. They are safe to run twice because of the reference UNIQUE constraints. Deduction order: Free, then Subscription (credit_rewards), then Bonus, then Reward, then Paid.

## 7. Reusable services
- **Brand data:** `_shared/creator-network-brand-context.ts` provides `getCreatorNetworkBrandContext(sb, brandId, 'internal'|'external')`. Use it as the pattern for any brand data the module reads, through a privacy-filtered projection.
- **Rendering:** call `design-enqueue` with an id-less brand object, as in `services/productionContext.ts`.
- **Credits:** `_shared/credit-gate.ts`. A 402 means the user is out of credits; a 503 means the gateway failed.
- **Email:** `_shared/partner-email.ts` and `marketing-email-render.ts`, the suppression tables and `partner-unsubscribe`.
- **Notifications:** `send-email`, `push-send` and `whatsapp-send`.
- **Shared rules and helpers:** `services/metrics.ts` (ratios that are safe when there is nothing to divide by), `nextBestAction.ts`, and `api/db.ts` (`useCnList`, `useCnMutation`, `friendlyError` and the transition RPC). Copy these patterns into the new module rather than importing across modules.

## 8. Integration points for Private Network
These mirror Creator Network's four registration edits.
1. **Route:** one lazy route in `App.tsx`: `/private-network/*` → `src/features/private-network/PrivateNetworkRoutes.tsx`.
2. **Navigation:** in `NewFloatingNav.tsx`, add the prefix to `primaryPrefixes` and add one item shown when `usePrivateNetwork().canAccess` is true.
3. **Header:** in `NewAppHeader.tsx`, optionally add one menu item behind the same gate.
4. **Admin:** in `Admin.tsx`, add one tab wrapper, `components/admin/PrivateNetworkAdminTab.tsx`.
5. **Backend functions:** `supabase/functions/private-network-*`, plus a `[functions.x]` entry in config.toml if the function checks the caller itself.
6. **Reading Creator Network data:** use only security-definer RPCs or views that expose distributable licensed assets. Never write to `creator_network_*` tables directly.
7. **Optional core link (in a later phase):** a nullable `campaigns_public.private_network_id` or `content_ideas.private_network_source_id`.

## 9. Additive migration strategy
- **One Drizzle migration per phase**, starting at `0006_private_network_foundation`. Steps run in this order:
  1. Create the tables.
  2. GRANT access to authenticated and service_role (no anon).
  3. Enable row security.
  4. Create the policies, using helper functions that are created first.
- **Foundation tables:**
  - `private_network_settings(id boolean pk default true, enabled bool default false, updated_by, updated_at)`.
  - `private_network_members(user_id, role text, created_by)`.
  - `private_network_has_access(uid, role)`, a security definer where a Brandie admin counts as module admin.
  - `private_network_can(_role)`, which checks the enabled flag and the role.
  - `private_network_activity_log`, append-only.
- **Every table carries** `record_source` and `is_test`. KPIs exclude rows where `is_test` is true.
- **Rules:** no changes to existing columns or types; no NOT NULL without a DEFAULT; time-based rules are validated by triggers, not CHECK constraints.
- **Storage:** a private bucket `private-network-assets` with signed URLs only.

## 10. Feature flag and rollback
- **Flag:** `private_network_settings.enabled`, OFF by default. It is read only through `usePrivateNetwork()` and enforced in row security through `private_network_can()`.
- **Rollback:**
  1. Turn the flag off.
  2. Revert the 3–4 registration edits.
  3. Drop the `private_network_*` tables, functions and bucket. No core table will depend on them.
- **Leave alone:** the current flags. Creator Network is OFF and must stay OFF.

## 11. Expansion boundaries
- **The module may read:** distributable licences and clean masters (through an RPC), approved and active campaign metadata, the privacy-filtered brand context, and partner IDs for attribution.
- **The module must not touch:** auth files, `client.ts` and `types.ts`, Paystack and credit tables, the design pipeline internals, Blueprint approval, the `app_role` enum, the Creator Network stage machine, `/legacy` and `/v2` redirects, or existing migrations.

## 12. Risks and missing dependencies
1. WhatsApp is blocked because the Twilio trial expired. Any WhatsApp distribution channel is blocked until it is upgraded.
2. The licence check only runs on the client. It needs a server-side port before any commercial distribution.
3. There is no single model for distribution or channels yet. The module must define its own, rather than overloading `campaigns_public`, which allows only one active page.
4. Attribution could collide with partner and affiliate attribution. Use additive tags only and keep the precedence rule.
5. Public or unauthenticated endpoints can be abused. Use the `campaign-track` pattern: a whitelist, no personal data, and validation.
6. Consent and suppression: reuse `marketing_suppression` and the unsubscribe flow. Private recipients need recorded consent.
7. There are no CI tests for core Brandie. Regression checks are manual with Playwright.
8. Video distribution is a placeholder.
9. The two Blueprint approval paths (client-side and edge function) are not unified. Do not depend on either.

## 13. Test, build and queued work
- **Build and tests:** build OK (latest build log), 31 Vitest tests passing (2 files, re-run this audit).
- **SQL audit:** `supabase/tests/creator_network_stage_audit.sql`.
- **Queued and running work:** 0 design jobs queued or running at audit time.
- **Open item:** the WhatsApp re-test and the V1 tag for Creator Network, both blocked on Twilio.
- **Current flag:** `creator_network_settings.enabled = false`.
