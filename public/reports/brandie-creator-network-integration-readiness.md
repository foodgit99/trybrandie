# BRANDIE CURRENT BUILD
## Creator Network Integration Readiness Report

**Date:** 2026-10-01
**Scope:** Full current-state audit of the Brandie codebase (`/dev-server`): frontend, backend edge functions, database, design system, billing, and product features — assessed for readiness to host a future "Creator Network" module.
**Method:** Static source analysis (no live DB writes, no modifications). Every statement is tagged **Observed** (confirmed in code/migrations), **Inferred** (strongly suggested by architecture), or **Recommended** (proposal for Creator Network). No secrets, keys, or tokens appear in this report.

---

## 1. Executive Summary

**Observed:** Brandie is a mature, production-grade autonomous marketing platform: React 18 + Vite 5 + TypeScript + Tailwind/shadcn frontend, ~84 Postgres tables, ~84 Supabase edge functions, Paystack billing, Resend email, Twilio WhatsApp, Firebase push, and a multi-model AI pipeline (Gemini family + GPT-Image + Veo) routed through the Lovable AI Gateway.

**Observed:** The schema contains **zero Creator Network primitives** — no creators, licensing, royalties, external-party tasks, or deliverable-evidence tables. The word "creator" exists only as a subscription tier name.

**Observed:** The closest existing structural templates for a Creator Network are: (a) the **Partner subsystem** (`partner_profiles`, `partner_referral_links`, `partner_leads`, `partner_credit_grants`, `partner_id_for_user()`) — an external-party entity with profile, tracking links, and admin-governed budgets; (b) the **affiliate commission ledger** (`affiliate_commissions`, `increment_affiliate_earned()`) — a payout-accounting template; (c) the **status/approval enum pattern** on `content_ideas`, `email_sender_aliases`, `partner_credit_grants` — a reusable workflow convention.

**Recommended:** Build Creator Network as a fully additive, feature-flagged module under its own route namespace (`/creators/*`) and table prefix (`creator_*`), reusing the brand-context provider, credit-gate, and tracer shared services, and touching no existing tables except via nullable FK references. A phased rollout (schema → internal admin → invite-only beta → GA) is outlined in §26.

**Overall readiness verdict: GOOD.** The architecture is modular enough (shared `_shared/` services, helper-function RLS patterns, queue-based job pipelines) to absorb a Creator Network without destabilizing existing flows — provided the fragile areas in §21 are respected.

---

## 2. Current Product Inventory

| Feature | State | Summary |
|---|---|---|
| Brand Centre | Production-ready | Brand identity, palette, typography, audiences (JTBD), products, gallery, trend prefs, competitors. Editor: `src/pages/BrandCentre.tsx` (live at `/brand/editor`); read view: `src/pages/v2/BrandCentre.tsx`. |
| Content Hub | Production-ready | Pillars, funnels (derived), campaigns, trends, competitors, Outbox (email marketing, tier-gated). Legacy: `src/pages/ContentHub.tsx`; v2: `src/pages/v2/ContentHubV2.tsx` + `src/components/v2/hub/*`. |
| Weekly Blueprint | Production-ready | AI-planned weekly arc, approve/edit flow, Strategist chat dock. `src/pages/v2/Blueprint.tsx`, `weekly_blueprints` table. |
| Design Studio | Production-ready | Chat-driven generation, carousels, sizes, watermarks. Single implementation `src/pages/DesignStudio.tsx`; v2 is a pass-through. |
| Content Autopilot | Production-ready | Weekly planner + daily render windows + notify (email/WhatsApp). `content-autopilot`, `autopilot-planner`, `autopilot-retry`, `autopilot-notify`. |
| Video Engine | Experimental / orphaned frontend | Backend (`video-studio`, `video-render`, Veo) is substantial, but `VideoGuidedFlow`/`VideoProjectViewer` are **not imported by any route** — no live entry point. |
| Billing | Production-ready | Paystack PAYG credit packs + subscription tiers; 5-source credit model (free/bonus/reward/subscription/paid). |
| Partner module | Production-ready | Partner dashboard, leads CRM, email campaigns, automations, credit grants. |
| Affiliate module | Production-ready | Two-tier commissions, payouts, share kit, monthly digest. |
| Campaign module (public pages) | Production-ready | `/c/:slug` landing pages, one-live-at-a-time, event tracking, partner attribution. |
| Admin panel | Production-ready | 16 tabs incl. Users, Brands, Designs, Subscriptions, Affiliates, Partners, Commissions, Payouts, Roles, AI Traces. `src/pages/Admin.tsx`. |
| Agent cockpit | Production-ready | Stage agents, Roundtable multi-agent chat. `src/pages/agent/*`. |
| Notifications | Push/email production-ready; WhatsApp partial | FCM push, Resend email; WhatsApp mostly outbound share links + template sends. |
| Analytics/LLM-ops | Production-ready | GA + first-party `product_events`; `design_traces` + `AdminTracesTab`; `autopilot_run_events` + `PipelineTelemetry`. |
| Testing | Placeholder | One trivial test file; no real coverage. |

---

## 3. Route Map

**Observed** (from `src/App.tsx`): guards are `ProtectedRoute` (user + completed brand), `OnboardingRoute`, `AuthRoute`, `AdminRoute` (`has_role` admin). Affiliate/partner routes are only login-gated; role checks live inside the pages.

| Path | Guard | Component | Purpose |
|---|---|---|---|
| `/auth` | AuthRoute | `pages/Auth.tsx` | Login/signup/forgot |
| `/reset-password`, `/verify-alias`, `/c/:slug`, `/invite/:token`, `/pricing`, `/affiliates`, `/affiliate/signup` | public | various | Reset, alias verify, campaign page, team invite, pricing, affiliate funnel |
| `/` | dynamic | `V2Landing` / redirect | Root dispatcher |
| `/onboarding` | OnboardingRoute | `pages/v2/Onboarding.tsx` | Brand setup wizard |
| `/cockpit` | Protected | `pages/v2/Cockpit.tsx` | Main dashboard |
| `/blueprint` | Protected | `pages/v2/Blueprint.tsx` | Weekly plan |
| `/post/:dayId` | Protected | `pages/v2/DailyPost.tsx` | Daily post |
| `/report` | Protected | `pages/v2/Report.tsx` | Weekly report |
| `/brand`, `/brand/editor` | Protected | v2 view / legacy editor | Brand Centre |
| `/brands` | Protected | `pages/Brands.tsx` | Multi-brand |
| `/settings`, `/profile` | Protected | v2 pages | Account |
| `/partner` | Protected (role in page) | `pages/PartnerDashboard.tsx` | Partner dashboard |
| `/engine` | Protected | `pages/v2/Engine.tsx` | Agent engine |
| `/content-hub`, `/hub` | Protected | v2 hub pages | Content Hub |
| `/agent`, `/agent/:threadId`, `/agent/settings` | Protected | `pages/agent/*` | Agent cockpit |
| `/studio` | Protected | `pages/v2/Studio.tsx` (pass-through) | Design Studio |
| `/history`, `/support`, `/plans` | Protected | v2/legacy pages | Utility |
| `/affiliate` | Protected (role in page) | `pages/AffiliateDashboard.tsx` | Affiliate dashboard |
| `/admin`, `/admin/google-connect` | AdminRoute | `pages/Admin.tsx` | Admin console |
| `/legacy/*` | Protected/public mirror | legacy pages | Legacy UX generation |
| `/dashboard`, `/briefing`, `/v2/*` | redirects | `<Navigate>` | Bookmark shims |
| `*` | public | `NotFound` | 404 |

**Observed:** two parallel UX generations coexist (v2 primary + `/legacy/*` mirror). Global chrome mounted outside routes: `FloatingDesignStatus`, `FloatingNavBar`, `NewFloatingNav`, `LowCreditsBanner`, `AudiencePromptManager`, `ScrollToTop`, `RouteAnalytics`, `PartnerRefCapture`.

---

## 4. Repository Architecture

**Observed:**
- `src/pages` (23 files + `v2/`, `agent/`, `admin/` subfolders) — legacy + shared pages; `src/pages/v2` (16 files) — primary experience.
- `src/components` — chrome/widgets plus feature subfolders: `admin`, `affiliate`, `audience`, `brands`, `campaign`, `content`, `design`, `home`, `landing`, `partner`, `team`, `v2` (incl. `v2/agents`, `v2/hub`), `ui` (44 shadcn primitives).
- `src/hooks` — auth/roles/brand/subscription/autopilot/theme utilities.
- `src/lib` — domain helpers (authStore, analytics, genome, campaign, partner, PDF export, etc.).
- `src/contexts` — single `DesignGenerationContext`.
- `src/integrations/supabase` — generated client/types (do not edit).
- `supabase/functions` — ~84 edge functions + `_shared/` (30+ shared modules).
- `supabase/migrations` — 138 migration files (~4,600 lines).

**Shared code Creator Network should reuse (Recommended):** `_shared/brand-context.ts` (brand grounding), `_shared/credit-gate.ts` (credit check/charge), `_shared/model-fallback.ts` (AI retry chains), `_shared/tracer.ts` (LLM-ops tracing), `_shared/token-budget.ts`, `_shared/ai-cache.ts`, `_shared/sanitise.ts`, `_shared/validate-output.ts`, `cn()` + shadcn `components/ui`, `useAuth`/`useBrand`, `LoadingState`/skeleton/empty-state primitives.

**Code Creator Network should NOT directly depend on (Recommended):** `design-studio/index.ts` internals (4,473 lines — call it via the `design_jobs` queue instead), `Admin.tsx` internals, `authStore.ts` internals (use `useAuth`), generated `types.ts` (regenerate, don't hand-edit).

---

## 5. Frontend Architecture

**Observed:**
- **Stack:** React 18.3.1, Vite 5.4.19 (SWC), TS 5.8.3, react-router-dom 6.30.1, Tailwind 3.4.17, shadcn/Radix, `next-themes`.
- **Forms:** react-hook-form + zod (usage varies; `Auth.tsx` uses controlled state).
- **State:** no global store; React Query v5 for server state, module pub/sub `authStore.ts` for auth, Context for design jobs, localStorage + custom events for active-brand selection.
- **Mutations:** direct Supabase calls in handlers + manual query invalidation; no uniform `useMutation` wrapper.
- **Toasts:** dual systems (shadcn `Toaster` + `sonner`) mounted together.
- **Uploads:** direct `supabase.storage` calls per page; no shared upload abstraction.
- **Loading/empty:** design-system primitives (`.skeleton-surface`, `.spinner-ring`, `.empty-surface`, `LoadingState`).
- **Errors:** route guards handle auth/brand errors with recovery UI; `authStore` has lock-timeout/invalid-session discrimination. **No app-wide React ErrorBoundary found (Inferred absence).**
- **Navigation:** three coexisting nav surfaces — `FloatingNavBar` (legacy, prefix-gated), `NewFloatingNav` (v2, prefix whitelist + "More" sheet), `NewAppHeader` (per-page, hardcoded menu items gated by role hooks).

**Recommended (Creator Network):** add routes under `/creators/*`, add the prefix to `NewFloatingNav`'s `primaryPrefixes` (else nav disappears), add a menu item in `NewAppHeader` gated by a new `useCreatorRole` hook, use React Query + shadcn primitives, and reuse the skeleton/empty-state classes.

---

## 6. Design System & HIG Baseline

**Observed** (`src/index.css`, `tailwind.config.ts`):
- **Tokens:** full semantic HSL token set (`--background`…`--ring`, `--sidebar-*`) mapped into Tailwind; brand tokens `--brandie-warm/gold/charcoal/stone/neon` + 5-stop logo spectrum with `--gradient-spectrum`/`--gradient-brand-soft`.
- **Themes:** genuine dual palettes for light/dark (`.dark` + parallel `.theme-light`/`.theme-dark` classes — observed duplication, likely transitional); `next-themes` class strategy, default light, system enabled.
- **Typography:** DM Sans (body) + Instrument Serif (headings, applied globally to `h1–h6`); Tailwind default scale; `.eyebrow` micro-label class.
- **Radius/shadows:** `--radius: 0.75rem`; custom `flat`/`raised` shadows plus `glow`/`glow-soft`/`focusglow` brand glows.
- **Component classes:** `.section-surface`, `.section-accent-rail`, `.status-dot*`, `.nav-active-pill`, `.skeleton-surface`, `.spinner-ring`, `.empty-surface`/`.empty-medallion`; `prefers-reduced-motion` respected.
- **Breakpoints:** Tailwind defaults; `lg:` (1024px) is the mobile↔desktop nav switch; container capped at 1400px.

**Recommended (Creator Network UI rules):** use only semantic tokens (no hardcoded colors), DM Sans/Instrument Serif pairing, `lg:` breakpoint convention, existing skeleton/empty-state/spinner primitives, dialogs capped at `max-h-[85vh] overflow-y-auto`, action icons visible on mobile / hover on desktop, and respect the floating-nav safe-area rules (bottom bar mobile, left rail desktop).

---

## 7. Authentication, Users & Permissions

**Observed:**
- **Auth store:** `src/lib/authStore.ts` — module-level pub/sub singleton avoiding Supabase Navigator LockManager contention; one `onAuthStateChange` listener, deduped init, `getAccessToken()` with 30s expiry buffer, lock-timeout vs invalid-session discrimination.
- **Hook:** `useAuth()` thin subscriber; `Auth.tsx` handles login/signup/forgot + referral/affiliate/partner/campaign attribution metadata at signup.
- **Guards:** router-level for user/admin; affiliate/partner roles checked inside pages via `useAffiliateRole` (`affiliates` row, status approved) and `usePartnerRole` (`partner_profiles` row, status active).
- **Roles:** `user_roles` table + `has_role(uuid, app_role)` SECURITY DEFINER function; `app_role` enum = admin/moderator/user. Roles are never stored on `profiles`.
- **Workspaces:** `brands` is the tenancy root; `brand_team_members` (status='active') grants team access via `has_brand_access()`; no viewer/editor granularity (team member ≈ owner).

**Critical gap (Observed):** `app_role`, `user_roles`, and `has_role()` are **not defined in any tracked migration** — they exist in the live DB but cannot be rebuilt from source control. Backfilling a migration is recommended independently of Creator Network.

**Recommended (Creator Network):** model creators as a first-class external party like partners: `creator_profiles` (user_id) + `creator_id_for_user()` helper + `useCreatorRole` hook + in-page gating (matching the partner pattern), rather than a new `app_role` value — creators are a program membership, not a platform-wide role. Admin oversight continues via `has_role(...,'admin')`.

---

## 8. Supabase Architecture

**Observed:** Lovable Cloud backend (single instance serves preview + published). ~84 tables, ~84 edge functions, 5 storage buckets, 30+ DB functions, 50+ triggers, 4 confirmed pg_cron jobs.

**Confirmed pg_cron jobs (Observed in migrations):**

| Job | Schedule | Target |
|---|---|---|
| `finalize-stalled-design-jobs` | every minute | `finalize_stalled_design_jobs()` |
| `partner-automation-tick` | hourly :07 | edge function via pg_net |
| `notification-email-retry` | every 10 min | edge function via pg_net |
| `expire-campaign-pages` | every 15 min | `expire_campaign_pages()` |

**Inferred:** additional schedules (design-dispatch ~5s sweep, content-autopilot windows, autopilot-planner weekly, autopilot-retry daily, email-marketing-journey-tick, monday-briefing, weekly-recap, subscription-renewals, affiliate-monthly-digest) are configured outside migrations (dashboard/CLI).

**Edge function groups (Observed):** brand intelligence (`brand-scraper`, `brand-engine`, `brand-strategist`, `audience-intelligence`, `trend-scout`, `competitor-*`), design pipeline (`design-enqueue` → `design-dispatch` → `design-studio`), video (`video-studio`, `video-render`), autopilot (`content-autopilot`, `autopilot-planner/-retry/-notify`), billing (`paystack-*`, `subscription-*`), email marketing (`email-marketing-*`, `send-email`, `notification-email-retry`), partner/affiliate (`partner-*`, `admin-affiliate-insights`, `affiliate-monthly-digest`), admin/support (`admin-action`, `support-submit`, `approve-blueprint`), integrations (`whatsapp-send`, `push-*`, `google-oauth-*`).

---

## 9. RLS & Security

**Observed patterns (429 policy statements across 84 tables; every table has RLS enabled):**
1. **User-scoped** (`auth.uid() = user_id`): profiles, subscriptions, design_jobs, affiliates, etc.
2. **Brand-scoped via `has_brand_access()`** (owner OR active team member): the dominant pattern.
3. **Partner-scoped via `partner_id_for_user()`**: all `partner_*` tables.
4. **Admin override via `has_role(...,'admin')`**: most repeated non-owner pattern.
5. **Service-role-only writes**: design_jobs, notification_email_outbox, subscription_credits, etc.
6. **Public surfaces via SECURITY DEFINER functions** (e.g. `get_campaign_page`) instead of broad table policies.

**Observed strengths:** GRANT statements accompany table creates; mutation functions for campaign pages revoked from anon/authenticated; validation triggers enforce business rules at the DB layer; no wide-open `USING (true)` for authenticated.

**Observed risks:** `design_jobs.brand_id` lacks an FK; all 5 storage buckets are public-read (path-guessable); cron HTTP calls hit fixed project URLs — edge functions must verify callers; `email_sender_aliases` mixes brand/partner ownership behind one CHECK.

**Security constraints Creator Network must respect (Recommended):** new tables get RLS + GRANTs in the same migration; creator data scoped via a `creator_id_for_user()` helper; brand-side visibility via `has_brand_access()`; admin oversight via `has_role`; no creator PII in public buckets; payouts/licensing tables service-role-write only; never expose other brands' data to creators (mirroring the partner privacy rule: whitelisted fields only).

---

## 10. Current Data Model

**Observed entity graph (abridged):**

```
auth.users
 ├─ profiles (1:1; credits, plan, notification state)
 ├─ brands (1:many) ← brand_team_members
 │   ├─ brand_products, brand_inspiration, target_audiences,
 │   │  brand_trend_preferences/intel, brand_competitors → snapshots → signals
 │   ├─ content_pillars, post_series, campaigns → content_ideas
 │   ├─ designs → design_messages; design_jobs → design_traces
 │   ├─ design_folders → assignments; video_projects → video_scenes
 │   ├─ agent_settings → agent_conversations → messages/actions
 │   ├─ autopilot_settings → autopilot_runs → run_events
 │   ├─ email_campaigns → logs; weekly_blueprints; genome_preset_weights
 │   └─ strategy_conversations → messages; client_folders
 ├─ subscriptions → plans/charges/credits; payment_transactions
 ├─ affiliates → referrals/commissions/payouts; referral_rewards; credit_rewards
 ├─ partner_profiles → referral_links, leads, campaigns → sends,
 │   automations → runs, email_suppression, credit_grants
 │   └─ campaigns_public → campaign_page_events
 └─ google_oauth_tokens, push_subscriptions, support_tickets, whatsapp_deliveries
(global) marketing_contacts/segments, email_broadcasts/sends/links,
  journeys/steps/enrollments, preferences, suppression, notification_email_outbox
```

**Observed cross-boundary keys:** `brand_id` is the dominant tenancy key; `user_id` for account-level concerns (billing, affiliate, partner); `partner_campaign_id` bridges partner → public campaign pages; `design_id`/`job_id` link the design lifecycle across three tables.

**Creator Network overlap (Observed):** none existing — no creators, licensing, royalties, external tasks, or deliverable evidence. Nearest templates: partner subsystem, affiliate commission ledger, approval-status enums, helper-function RLS pattern.

---

## 11. Brand Centre Integration

**Observed:** Brand Centre manages identity, palette, typography, multiple JTBD audiences, products (with image galleries), inspiration gallery, trend preferences, competitors, team members; supported by `brand-scraper`, `audience-intelligence`, `logo-designer` functions. `_shared/brand-context.ts` `buildBrandContext()` is the single shared grounding function used by agentic edge functions (parallel-fetches brands, audiences, pillars, series, campaigns, products, inspiration, recent designs, upcoming ideas, trend intel, competitors into one markdown block).

**Recommended integration:** Creator Network should consume brand context **only** through `buildBrandContext()` (or a derived, whitelisted subset) when generating creator briefs — never query brand tables directly from creator-facing surfaces. Creator-facing briefs should receive a privacy-filtered projection (name, vibe, tone, palette, product summaries) exactly as the partner-lead whitelist pattern does today.

---

## 12. Content Hub Integration

**Observed:** `content_ideas` carries three overlapping status columns (`status`: draft→scheduled→created; `approval_status`: draft→approved; `autopilot_status`: pending→processing→completed/failed_*). Weekly Blueprint approval has two independent code paths (client bulk-update in `Blueprint.tsx` and the `approve-blueprint` edge function). V2 "funnels" are a derived stage label on ideas, not a stored entity. "Campaigns" in Content Hub (internal content campaigns) are unrelated to public `campaigns_public` pages — same word, two systems.

**Recommended integration:** creator-produced content should enter the pipeline as `content_ideas` rows (or a linked `creator_submissions` table referenced by FK) so it flows through the existing approval → schedule → render → notify machinery unchanged. Do not add a fourth status column; reuse `approval_status` for the brand-approves-creator-work gate.

---

## 13. Video Engine Integration

**Observed:** backend is substantial (`video-studio` 686 lines: Gemini planning + scene images; `video-render` 401 lines: Veo 3.1 via direct Google API with `GOOGLE_AI_API_KEY`, brand style directive built independently of `brand-context.ts` — duplication debt). Tables `video_projects`/`video_scenes` exist with brand-scoped RLS. **Frontend is orphaned: `VideoGuidedFlow`/`VideoProjectViewer` are imported by no route; there is no `/video` path.**

**Recommended integration:** treat Video Engine as a backend-only capability. Creator Network video deliverables should submit through the same `video_projects`/`video_scenes` tables and `video-render` function (job-handoff contract, §25), not reimplement rendering. Note the existing frontend gap — if Creator Network needs video review UI, it will also incidentally wire up the orphaned components.

---

## 14. AI & Model Integrations

**Observed:**
- **Gateway:** Lovable AI Gateway (OpenAI-shaped chat completions) used by nearly all generative functions; single exception: `video-render` calls Google's Generative Language API directly for Veo.
- **Model chains (`_shared/model-fallback.ts`):** reasoning `gemini-2.5-pro` → `gemini-3.1-pro-preview` → `gpt-5-mini`; fast `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gpt-5-nano`; chat `gemini-3-flash-preview` → …; image `gemini-3-pro-image-preview` → `gemini-3.1-flash-image-preview` → `gemini-2.5-flash-image`; `gpt-image-2` for logos; `gemini-3.6-flash` for agent chat; Veo 3.1 for video.
- **Resilience:** `callWithFallback` retries 429/5xx across the chain, treats 4xx as final; `_shared/circuit-breaker.ts`, `_shared/timeout.ts`, `_shared/ai-cache.ts` (research_cache), `_shared/token-budget.ts` (output ceilings), `_shared/validate-output.ts`.
- **Doctrine modules:** `ogilvy-copy-doctrine.ts` (copy rules), `locale-doctrine.ts` (Nigerian casting defaults), `category-rules.ts`/`edit-intent.ts` (deterministic replacements for former LLM calls).

**Recommended integration:** Creator Network AI tasks (creator matching, brief generation, submission review) must go through the gateway + `model-fallback` + `token-budget` + `tracer`, apply deterministic-first logic where rules suffice, and add new doctrines as `_shared/` modules rather than inline prompts.

---

## 15. Credits, Billing & Entitlements

**Observed:**
- **Credit sources (5):** free monthly (5, reset monthly), bonus, reward (`credit_rewards`, earliest-expiry first), subscription, paid — merged in `CreditsBadge`.
- **Deduction order (`_shared/credit-gate.ts`):** free → bonus → reward → paid; availability checked up front, `.charge()` only after successful render (deferred deduction).
- **Paystack:** checkout (₦5,000/20-credit unit, 20–200 bounds), subscribe, verify (client polls 10×2s), webhook (HMAC-SHA512 verified; idempotent via `subscription_charges.paystack_reference` / `payment_transactions.reference` uniqueness; computes two-tier affiliate commissions 20%/5%/5%/3%, milestone + ₦5,000 payout-threshold emails).
- **Entitlement gates:** Outbox tier allow-list; competitor caps by tier; watermark removal on paid credits; brand/competitor limit triggers.

**Recommended integration:** creator royalty payouts should **not** ride the user credit system; model them on the affiliate commission ledger (`affiliate_commissions` + `affiliate_payouts` + `increment_affiliate_earned()` pattern) with a `creator_earnings`/`creator_payouts` pair. If brands pay for creator work, charge via the existing `credit-gate` deferred pattern. Reuse Paystack webhook idempotency conventions for any new payment event types.

---

## 16. Storage & Media

**Observed buckets:** `brand-logos`, `brand-inspiration`, `brand-products`, `designs` (all public-read; owner-write via `user_id` first path segment), `avatars` (private-ish; same prefix convention). No shared upload abstraction in the frontend.

**Recommended integration:** add a `creator-assets` bucket (private; creator-write via prefix, brand-read only via signed URLs or SECURITY DEFINER function) for submissions/portfolios. Do not place creator work-in-progress in the public `designs` bucket — anything there is world-readable by URL.

---

## 17. Tasks, Reviews & Human-in-the-Loop Systems

**Observed:** no generic task/workflow engine exists. HITL is modeled as status transitions: Blueprint approval (client bulk-update + `approve-blueprint` function), campaign page approval (admin via `campaign-engine`), partner credit grants (`partner_credit_grants.status` pending→approved), email alias approval, `admin-action` allow-listed mutation gateway, `support-submit` tickets (`BRD-XXXXX`). `content_ideas.approval_status` is the internal content approval gate.

**Recommended integration:** creator task assignment/submission/review should be a new `creator_tasks` + `creator_submissions` pair using the established status-enum + admin/partner-approval convention, with admin oversight surfaced as a new Admin tab through the existing `admin-action` allow-list pattern (add the new tables to `ALLOWED_TABLES`).

---

## 18. Logging, Analytics & Learning

**Observed:** `RouteAnalytics` (GA pageviews + user id), `lib/analytics.ts` `trackEvent` (GA + first-party `product_events` table, never throws), `_shared/tracer.ts` → `design_traces`/`ai_traces` with `AdminTracesTab` + `trace-alert`, `autopilot_run_events` + `PipelineTelemetry`, `genome_preset_weights` + `record_preset_feedback()` (design preference learning loop), `campaign_page_events` (public page analytics).

**Recommended integration:** emit Creator Network product events through `trackEvent`, trace creator-related AI calls through `tracer`, and model creator-performance learning on the `genome_preset_weights` feedback pattern (brand ratings of creator deliveries adjusting future matching weights).

---

## 19. Deployment & Environments

**Observed:** Vite dev server + Lovable preview/published URLs + custom domain (trybrandie.com); single Lovable Cloud backend serves both preview and production. Migrations applied via the migration tool; edge functions deployed per-function; `supabase/config.toml` sets `verify_jwt = false` per function (in-code JWT validation instead). Env/secrets managed as platform secrets (names only: `LOVABLE_API_KEY`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `TWILIO_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIRECRAWL_API_KEY`, `GOOGLE_*`, `MARKETING_EMAIL_DOMAIN`, etc.).

**Recommended integration:** ship Creator Network behind a feature flag (e.g. `CREATOR_NETWORK_ENABLED` env + a `creator_profiles.status` gate), deploy as additive migrations + new edge functions + new routes, with no changes to existing function behavior when the flag is off.

---

## 20. Testing & Quality

**Observed:** weakest area. Exactly one test file (`src/test/example.test.ts`, trivial). Vitest + jsdom + ESLint properly wired but unused for coverage. No edge-function tests. Quality controls that do exist: DB-level validation triggers, `_shared/validate-output.ts` for AI output shape, HMAC webhook verification, idempotency keys on payments, CAS job claiming, stalled-job watchdog.

**Recommended integration:** budget test authorship for Creator Network from day one (credit/royalty math, RLS policy tests, submission workflow), and do not assume existing CI protects shared surfaces — manual regression QA on Blueprint, Studio, billing before each phase gate.

---

## 21. Technical Debt & Fragile Areas

**Critical (Observed):**
- `app_role` enum, `user_roles` table, `has_role()` function absent from tracked migrations — schema not rebuildable from source control; all admin authorization depends on them.
- `authStore.ts` lock-timeout handling is subtle; auth regressions affect every page.

**High (Observed):**
- `design-studio/index.ts` is 4,473 lines — the render pipeline is powerful but monolithic; integrate via the `design_jobs` queue, never by importing internals.
- Blueprint approval has two independent code paths (client bulk-update vs `approve-blueprint`) that could drift.
- Video Engine frontend is orphaned (no route) while backend is live.
- `content_ideas` has three overlapping status columns with no formal state machine doc.

**Medium (Observed):**
- Dual UX generations (v2 + `/legacy/*` mirror) double some maintenance; `Plans.tsx`/`Pricing.tsx` near-duplicate billing logic; `LowCreditsBanner` has stale `/v2` route-hiding logic (dead no-op).
- `video-render` duplicates brand-directive logic instead of reusing `brand-context.ts`.
- All storage buckets public-read; `design_jobs.brand_id` missing FK.
- Affiliate/partner role checks live inside pages, not router guards — refactors can silently expose them.

**Low (Observed):** dual toast systems; no shared upload abstraction; `.theme-*` class duplication alongside `.dark`; no app-wide ErrorBoundary.

---

## 22. Creator Network Modularity Plan

**Recommended:**
- **Module boundary:** all creator code under `src/pages/creators/`, `src/components/creators/`, `supabase/functions/creator-*`, tables prefixed `creator_*`. No edits inside existing feature folders except the integration points listed in §27.
- **Routes:** namespace `/creators/*` (creator-facing) + `/brand/creators` or a Hub tab (brand-facing) + Admin tab. Public creator application page at `/creators/apply` (mirrors `/affiliate/signup`).
- **Data access:** creators query only their own `creator_*` rows via `creator_id_for_user()`; brands see creator deliverables through `has_brand_access()`-checked joins; cross-party visibility always via whitelisted projections (partner-privacy pattern).
- **Database:** additive migrations only; nullable FKs from `creator_*` to `brands`/`auth.users`; never add columns to existing tables except nullable FK references (e.g. `content_ideas.creator_submission_id`).
- **Permissions:** new helper `creator_id_for_user()` + `has_creator_access()` mirroring partner helpers; admin oversight via existing `has_role`.
- **Feature flag:** `CREATOR_NETWORK_ENABLED` env checked in a `useCreatorNetwork()` hook and in each `creator-*` function; flag off = routes render NotFound, functions 404.
- **Navigation:** add `/creators` prefix to `NewFloatingNav` whitelist + a gated `NewAppHeader` menu item; no changes to `FloatingNavBar` (legacy).
- **Shared services:** reuse `brand-context`, `credit-gate`, `model-fallback`, `tracer`, `token-budget`, `ai-cache`, `send-email`, `push-send`, `whatsapp-send` via function invocations.
- **Isolation:** removing the module = drop `creator_*` tables, delete `creator-*` functions, remove routes/nav items, drop nullable FK columns. No other feature should hold a NOT NULL dependency on creator tables.

---

## 23. Proposed Component Tree

**Recommended:**

```
src/pages/creators/
  CreatorApply.tsx          (public application, mirrors AffiliateSignup)
  CreatorDashboard.tsx      (creator home: tasks, earnings, profile)
  CreatorTaskDetail.tsx     (brief view + submission upload)
  CreatorEarnings.tsx       (ledger + payouts)
  CreatorProfileEdit.tsx    (portfolio, rates, niches)
src/pages/brand/            (or components/v2/hub/)
  BrandCreatorsTab.tsx      (brand-facing: matched creators, briefs, reviews)
  CreatorReviewDialog.tsx   (approve/reject submission + rating)
src/components/creators/
  CreatorStatusBadge.tsx
  CreatorTaskCard.tsx
  CreatorSubmissionUploader.tsx
  CreatorMatchCard.tsx
src/components/admin/
  AdminCreatorsTab.tsx      (approval queue, payouts, oversight)
src/hooks/
  useCreatorRole.ts         (mirrors usePartnerRole)
  useCreatorNetwork.ts      (feature flag)
```

---

## 24. Proposed Database Impact

**Recommended new tables (all additive, RLS + GRANTs in same migration):**

| Table | Purpose | Access pattern |
|---|---|---|
| `creator_profiles` | Creator entity (user_id, niches, portfolio, rates, status pending/approved) | creator self + admin |
| `creator_applications` | Application intake + review status | creator self + admin |
| `creator_tasks` | Briefs assigned to creators (brand_id, creator_id, brief, due, status) | creator + brand (`has_brand_access`) + admin |
| `creator_submissions` | Deliverables (task_id, asset refs, notes, status draft/submitted/approved/rejected) | creator + brand + admin |
| `creator_licenses` | Usage-rights terms per submission (scope, duration, territory) | creator + brand + admin; service-role write |
| `creator_earnings` | Royalty/payment ledger (mirrors `affiliate_commissions`) | creator self + admin; service-role write |
| `creator_payouts` | Payout records (mirrors `affiliate_payouts`) | creator self + admin; service-role write |
| `creator_ratings` | Brand feedback on deliveries (feeds matching weights) | brand write, creator read own aggregate |

**Recommended modifications to existing tables:** nullable `content_ideas.creator_submission_id` FK only. Nothing else.

---

## 25. Proposed Integration Contracts

**Recommended:**
- **Brand Context Provider:** creator-facing AI calls receive a whitelisted projection of `buildBrandContext()` output (no internal strategy, no other-brand data).
- **Content Brief Handoff:** brand creates `creator_tasks` row → creator notified via existing `send-email`/`push-send` → submission returns as `creator_submissions` → on approval, optionally materialized into `content_ideas` (status `draft`) for the normal pipeline.
- **Design/Video Job Handoff:** if creator briefs need Brandie-rendered assets, enqueue through `design-enqueue`/`video_projects` exactly as autopilot does — never call `design-studio` directly.
- **Credit Usage:** brand-side charges for creator-related renders go through `credit-gate` deferred pattern; creator compensation is separate (earnings ledger, not credits).
- **Learning Event:** brand approve/reject + rating writes `creator_ratings`; matching uses aggregated weights (genome-preset-weights pattern).

---

## 26. Migration / Rollout Strategy

**Recommended:**
- **Phase 0 — Foundations:** backfill missing `app_role`/`user_roles`/`has_role()` migration (independent debt); add feature flag; scaffold route namespace + empty dashboard behind flag.
- **Phase 1 — Schema + Admin:** `creator_*` tables, RLS, helpers, Admin tab (approval queue), application page. Internal testing only.
- **Phase 2 — Creator MVP:** dashboard, task list, submission upload, earnings view. Invite-only creators (admin-approved).
- **Phase 3 — Brand side:** Hub tab for briefs/reviews, `content_ideas` handoff, notifications.
- **Phase 4 — Money:** earnings ledger, payouts via Paystack conventions, licensing terms capture.
- **Phase 5 — Intelligence:** matching weights, ratings feedback loop, tracer/analytics dashboards. GA flag-on rollout.

Each phase is independently shippable and reversible; flag off at any point returns the app to current behavior.

---

## 27. Existing Files That Would Change

**Recommended (minimal, additive edits only):**
- `src/App.tsx` — add `/creators/*` routes (new guard composition, no changes to existing guards).
- `src/components/v2/NewFloatingNav.tsx` — add `/creators` to `primaryPrefixes` (+ optional nav item).
- `src/components/v2/NewAppHeader.tsx` — one gated menu item.
- `src/pages/Admin.tsx` — register `AdminCreatorsTab` in `TABLES`.
- `supabase/functions/admin-action/index.ts` — add `creator_*` tables to `ALLOWED_TABLES`.
- `supabase/config.toml` — `verify_jwt = false` entries for new `creator-*` functions.
- `src/integrations/supabase/types.ts` — regenerate (tooling, not hand-edit).
- `content_ideas` — one nullable FK column via migration.

## 28. Existing Files That Should Not Change

**Recommended (do not touch):**
- `src/lib/authStore.ts`, `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx` (auth core).
- `src/integrations/supabase/client.ts`, `previewAuthStorage.ts` (generated).
- `supabase/functions/design-studio/index.ts`, `design-enqueue`, `design-dispatch` (render pipeline — integrate via queue only).
- `supabase/functions/paystack-*` (billing truth) — extend via new event types, don't modify existing branches.
- `_shared/brand-context.ts`, `credit-gate.ts`, `model-fallback.ts` (consume, don't edit).
- All existing migrations (append-only).
- `src/index.css` tokens / `tailwind.config.ts` (reuse tokens).
- Legacy `/legacy/*` pages.

---

## 29. Open Questions

1. **Inferred:** Are the non-migration cron schedules (autopilot windows, planner, journey-tick, briefings) configured in the dashboard? They should be captured in migrations for reproducibility.
2. **Inferred:** Which Blueprint approval path (client bulk-update vs `approve-blueprint` function) is canonical? Reconcile before creator submissions reuse the gate.
3. Is the Video Engine intentionally shelved or mid-launch? Affects whether creator video deliverables can rely on it.
4. Should creators be full auth users (partner pattern) or lightweight external contacts (marketing_contacts pattern)? This report recommends full auth users.
5. Royalty payouts: Paystack transfers to creators, or manual/off-platform settlement initially?
6. Do creator submissions require IP/licensing capture at MVP, or can `creator_licenses` wait for Phase 4?
7. Should creator work be watermarkable/revocable if a brand's subscription lapses (entitlement question)?

---

## 30. Final Recommendation

**Recommended:** Proceed. Brandie's architecture is genuinely ready for a Creator Network: the partner subsystem proves the external-party pattern end-to-end (profile → links → leads → budgets → admin approval), the affiliate ledger proves payout accounting, the design_jobs queue proves async work orchestration, and the helper-function RLS conventions make a third party type a well-trodden path.

Build it as a fully additive, feature-flagged module (`/creators/*`, `creator_*` tables, `creator-*` functions), reuse shared services rather than forking them, keep creator compensation off the user-credit system, and fix the two critical pre-existing debts first (untracked admin-role schema; dual Blueprint approval paths). Follow the six-phase rollout in §26; Phase 1 (schema + admin approval queue + application page) is the recommended first milestone.

---

# MACHINE-READABLE SUMMARY

```json
{
  "brandie_stack": {
    "frontend": "React 18.3.1 + Vite 5.4.19 + TypeScript 5.8.3 + Tailwind 3.4.17 + shadcn/Radix + react-router-dom 6.30.1 + @tanstack/react-query v5",
    "backend": "Lovable Cloud (Supabase): ~84 tables, ~84 edge functions (Deno), 5 storage buckets, pg_cron",
    "payments": "Paystack (checkout, subscribe, verify, webhook HMAC-SHA512)",
    "email": "Resend", "whatsapp": "Twilio", "push": "Firebase Cloud Messaging",
    "ai_gateway": "Lovable AI Gateway (OpenAI-shaped); direct Google API only for Veo video"
  },
  "routes": ["/auth", "/reset-password", "/verify-alias", "/c/:slug", "/invite/:token", "/", "/onboarding", "/cockpit", "/blueprint", "/post/:dayId", "/report", "/brand", "/brand/editor", "/brands", "/settings", "/profile", "/partner", "/engine", "/content-hub", "/hub", "/agent", "/agent/:threadId", "/agent/settings", "/studio", "/history", "/support", "/plans", "/pricing", "/affiliates", "/affiliate/signup", "/affiliate", "/admin", "/admin/google-connect", "/legacy/*"],
  "existing_modules": ["Brand Centre", "Content Hub", "Weekly Blueprint", "Design Studio", "Content Autopilot", "Video Engine (backend only, frontend orphaned)", "Billing (Paystack)", "Partner module", "Affiliate module", "Public Campaign pages", "Admin panel", "Agent cockpit", "Email marketing (Outbox)", "Notifications (push/email/WhatsApp)", "Analytics + LLM-ops traces"],
  "supabase": {
    "tables": ["profiles", "brands", "brand_team_members", "brand_products", "brand_inspiration", "target_audiences", "brand_competitors", "content_pillars", "content_ideas", "campaigns", "weekly_blueprints", "designs", "design_jobs", "design_traces", "video_projects", "video_scenes", "subscriptions", "subscription_plans", "subscription_charges", "subscription_credits", "credit_rewards", "payment_transactions", "affiliates", "affiliate_referrals", "affiliate_commissions", "affiliate_payouts", "partner_profiles", "partner_leads", "partner_campaigns", "partner_credit_grants", "campaigns_public", "campaign_page_events", "email_broadcasts", "email_sends", "marketing_contacts", "marketing_journeys", "autopilot_settings", "autopilot_runs", "autopilot_run_events", "agent_conversations", "agent_messages", "user_roles", "support_tickets", "push_subscriptions", "google_oauth_tokens", "whatsapp_deliveries", "notification_email_outbox", "product_events", "genome_preset_weights", "email_sender_aliases", "client_folders", "design_folders", "research_cache", "strategy_conversations", "strategy_messages", "referral_rewards", "post_series", "brand_trend_preferences", "brand_trend_intel", "competitor_snapshots", "competitor_signals", "brand_updates", "user_brand_dialog_prefs", "chat_preference_cache", "design_schema_revisions", "design_messages", "design_folder_assignments", "agent_settings", "agent_actions", "agent_api_tokens", "affiliate_monthly_digest(n/a)", "email_campaigns", "email_campaign_logs", "email_links", "email_preferences", "email_signup_forms", "marketing_segments", "marketing_journey_steps", "marketing_journey_enrollments", "marketing_suppression", "partner_referral_links", "partner_campaign_sends", "partner_automations", "partner_automation_runs", "partner_email_suppression", "google_oauth_states"],
    "functions": ["handle_new_user", "has_role", "has_brand_access", "is_brand_owner", "is_active_brand_member", "is_marketing_partner", "partner_id_for_user", "process_referral", "increment_affiliate_earned", "lock_autopilot_idea", "pause_dormant_autopilot", "is_user_dormant", "finalize_stalled_design_jobs", "enforce_brand_limit", "enforce_competitor_limit", "validate_campaign_priority", "validate_campaign_public", "validate_email_alias", "validate_partner_credit_grant", "get_active_campaign_page", "get_campaign_page", "activate_campaign_page", "expire_campaign_pages", "record_preset_feedback", "rearm_low_credit_notice", "update_updated_at_column", "notify_design_job_queued"],
    "edge_functions": ["design-enqueue", "design-dispatch", "design-studio", "brand-engine", "brand-strategist", "brand-scraper", "audience-intelligence", "audience-suggest", "trend-scout", "trend-recommend", "competitor-discover", "competitor-scan", "competitor-digest", "competitor-orchestrator", "holiday-feed", "summarise-update", "logo-designer", "agent-roundtable", "agent-tokens", "agent-undo", "stage-agent", "strategist-agent", "strategist-agent-webhook", "v2-edit-router", "monday-briefing", "daily-execution-push", "weekly-recap", "approve-blueprint", "trace-alert", "video-studio", "video-render", "content-autopilot", "autopilot-planner", "autopilot-retry", "autopilot-notify", "paystack-checkout", "paystack-subscribe", "paystack-verify", "paystack-webhook", "subscription-manage", "subscription-renewals", "email-marketing-plan", "email-marketing-generate", "email-marketing-send", "email-marketing-journey-tick", "email-marketing-track", "email-marketing-signup", "email-marketing-verify-domain", "email-alias-verify", "partner-automation-tick", "partner-campaign-send", "partner-portal", "partner-unsubscribe", "admin-affiliate-insights", "affiliate-monthly-digest", "admin-action", "support-submit", "campaign-scheduler", "campaign-track", "campaign-engine", "team-invite-accept", "send-email", "whatsapp-send", "push-register", "push-send", "notification-email-retry", "google-oauth-start", "google-oauth-callback", "google-access-token"],
    "storage_buckets": ["avatars (private)", "brand-inspiration (public)", "brand-logos (public)", "brand-products (public)", "designs (public)"],
    "rls_summary": ["user-scoped (auth.uid()=user_id)", "brand-scoped via has_brand_access()", "partner-scoped via partner_id_for_user()", "admin override via has_role('admin')", "service-role-only writes for job/ledger tables", "public reads only via SECURITY DEFINER functions"]
  },
  "auth": {
    "store": "src/lib/authStore.ts module pub/sub singleton (LockManager-safe)",
    "guards": "ProtectedRoute / OnboardingRoute / AuthRoute / AdminRoute in App.tsx; affiliate+partner roles checked in-page",
    "roles": "user_roles + has_role() SECURITY DEFINER; app_role enum (admin/moderator/user); NOT present in tracked migrations (critical gap)",
    "workspaces": "brands = tenancy root; brand_team_members via has_brand_access(); no viewer/editor granularity"
  },
  "design_system": {
    "tokens": "semantic HSL tokens + --brandie-* (warm/gold/charcoal/stone/neon) + 5-stop spectrum gradients",
    "fonts": "DM Sans body, Instrument Serif headings",
    "themes": "light/dark via next-themes class strategy; genuine dual palettes",
    "primitives": "44 shadcn components + custom skeleton-surface/spinner-ring/empty-surface/status-dot classes",
    "breakpoints": "Tailwind defaults; lg: switches mobile bottom bar ↔ desktop left rail"
  },
  "ai_integrations": ["google/gemini-2.5-pro", "google/gemini-3.1-pro-preview", "google/gemini-3-flash-preview", "google/gemini-3.6-flash", "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "google/gemini-3-pro-image-preview", "google/gemini-3.1-flash-image-preview", "google/gemini-2.5-flash-image", "openai/gpt-image-2", "openai/gpt-5-mini", "openai/gpt-5-nano", "google/veo-3.1-generate-preview (direct API)"],
  "billing": {
    "provider": "Paystack",
    "credit_sources": ["free_monthly(5)", "bonus", "reward(earliest-expiry)", "subscription", "paid"],
    "deduction_order": "free → bonus → reward → paid (deferred charge after successful render)",
    "pricing": "₦5,000 per 20-credit unit (20–200 bounds) + subscription tiers",
    "idempotency": "payment_transactions.reference + subscription_charges.paystack_reference uniqueness; HMAC-SHA512 webhook verification"
  },
  "creator_network": {
    "recommended_route_namespace": "/creators/*",
    "recommended_module_path": "src/pages/creators + src/components/creators + supabase/functions/creator-* + creator_* tables",
    "feature_flag_recommended": true,
    "existing_entities_to_reuse": ["partner_profiles pattern (external party)", "affiliate_commissions/payouts pattern (earnings ledger)", "content_ideas.approval_status (review gate)", "has_brand_access/partner_id_for_user helper pattern", "design_jobs queue (render handoff)", "credit-gate (brand-side charges)", "tracer/product_events (logging)", "genome_preset_weights (feedback learning)"],
    "new_entities_required": ["creator_profiles", "creator_applications", "creator_tasks", "creator_submissions", "creator_licenses", "creator_earnings", "creator_payouts", "creator_ratings"],
    "integration_points": ["buildBrandContext (whitelisted projection)", "content_ideas handoff (nullable creator_submission_id FK)", "design-enqueue/video_projects job handoff", "send-email/push-send/whatsapp-send notifications", "admin-action ALLOWED_TABLES", "NewFloatingNav primaryPrefixes", "NewAppHeader menu", "Admin.tsx TABLES"],
    "files_likely_to_change": ["src/App.tsx", "src/components/v2/NewFloatingNav.tsx", "src/components/v2/NewAppHeader.tsx", "src/pages/Admin.tsx", "supabase/functions/admin-action/index.ts", "supabase/config.toml", "src/integrations/supabase/types.ts (regenerate)", "content_ideas (one nullable FK via migration)"],
    "files_that_should_not_change": ["src/lib/authStore.ts", "src/hooks/useAuth.tsx", "src/pages/Auth.tsx", "src/integrations/supabase/client.ts", "src/integrations/supabase/previewAuthStorage.ts", "supabase/functions/design-studio/index.ts", "supabase/functions/design-enqueue/index.ts", "supabase/functions/design-dispatch/index.ts", "supabase/functions/paystack-webhook/index.ts", "supabase/functions/_shared/brand-context.ts", "supabase/functions/_shared/credit-gate.ts", "supabase/functions/_shared/model-fallback.ts", "src/index.css", "tailwind.config.ts", "all existing migrations"],
    "top_risks": ["app_role/user_roles/has_role missing from migrations (schema not rebuildable)", "design-studio monolith (4473 lines) — integrate via queue only", "dual Blueprint approval code paths may drift", "content_ideas triple status columns undocumented", "Video Engine frontend orphaned", "affiliate/partner role checks live in pages not router guards", "public-read storage buckets", "no test coverage for shared surfaces"],
    "recommended_first_milestone": "Phase 1: additive creator_* schema + RLS + creator_id_for_user() helper + admin approval queue tab + public /creators/apply page, all behind CREATOR_NETWORK_ENABLED flag"
  }
}
```
