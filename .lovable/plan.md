# Brandie Creator Network V1 — Implementation Plan

An internal, operator-only module at `/creator-network`. It's behind a feature flag and kept inside its own boundary. Nothing customer-facing changes.

## Delivery order (each phase ships and gets regression-checked before the next)

- **Phase 0, Foundation:** add the missing auth migration, the feature flag, membership roles, the route shell, the one nav entry, the Admin tab, and tests.
- **Phase 1, Intelligence and Validation:** Overview, My Work, Creator Command Center and Creator Detail, audience profiles, validations, interviews (submitted in one atomic step), evidence with supersession, brand safety, AI Work, activity log, and Next Best Action.
- **Phase 2, Matching and Strategy:** prospects, prospect products, a single shared product shape, matches, the 13-stage opportunity board, and concepts with human approval.
- **Phase 3, Production handoff:** production jobs that point into the existing design and video pipelines, stage reviews, and watermarked previews.
- **Phase 4, Sales and Rights:** sales, licences, the preview vs commercial rights check, the earnings ledger, and clean-master delivery.
- **Phase 5, Learning:** experiments and the learning metrics. "No data yet" shows when there is nothing to divide by.

## Migrations (all additive, reversible, RLS on, with GRANTs)

1. `backfill_authorization_primitives`: `app_role`, `user_roles`, and `has_role()` written exactly as they exist live, using `IF NOT EXISTS` and `CREATE OR REPLACE`. I check it against the live catalog before applying. Behaviour does not change.
2. `creator_network_foundation`: `creator_network_members` (roles: admin, research, partnerships, production, sales), `creator_network_has_access(uid, role)` (security definer, where a Brandie admin counts as Creator Network admin), the human-readable ID sequences and generator (CRT-, MAT-, OPP-, CON-, JOB-), and the `record_source` enum.
3. Phase 1 tables: `creators`, `audience_profiles`, `validations`, `interviews`, `findings`, `brand_safety_reviews`, `tasks`, `ai_runs`, `activity_log`, all with the `creator_network_` prefix. Also the `creator_network_submit_interview()` RPC (atomic) and the `creator_network_supersede_finding()` RPC.
4. Phase 2 to 5 tables: `prospects`, `prospect_products`, `matches`, `opportunities`, `concepts` (a partial unique index allows one selected concept per opportunity), `production_jobs`, `production_reviews` (a trigger requires a reason for edit, reject and regenerate), `licences`, `sales`, `earnings`, `payouts`, `experiments`. Stage-transition triggers write to `activity_log`.
5. A nullable `content_ideas.creator_network_source_id`, added only in Phase 4.
6. A private storage bucket, `creator-network-assets`, read through signed URLs only.

Every table gets `record_source` and `is_test`. The KPI views filter out `is_test = true`.

## New files

```text
src/features/creator-network/
  hooks/useCreatorNetwork.ts      flag + role gate (single source)
  api/*.ts                        typed queries/mutations per entity
  services/nextBestAction.ts      deterministic rules
  services/matchScoring.ts        weighted score, reach de-emphasised
  services/claimGating.ts         CREATOR_PERSONAL_EXPERIENCE lock
  services/licenceEligibility.ts  preview vs commercial check
  services/metrics.ts             denominator-safe ratios
  services/normalizedProduct.ts
  components/*                    shared shell, stage dialogs, empty states
  pages/*                         12 routes
  __tests__/*.test.ts
src/components/admin/CreatorNetworkAdminTab.tsx  (thin wrapper)
supabase/functions/creator-network-ai/           human-triggered AI runs
supabase/functions/_shared/creator-network-brand-context.ts
```

## Existing files changed (registration only)

- `src/App.tsx`: one lazy route group.
- `src/components/v2/NewFloatingNav.tsx`: add the prefix to the whitelist and one entry, shown only when the gate passes.
- `src/components/v2/NewAppHeader.tsx`: one menu item, shown only when the gate passes.
- `src/pages/Admin.tsx`: register one tab.

These stay untouched: auth files, the Supabase client, the design-studio, enqueue and dispatch internals, Paystack, the brand-context, credit-gate and model-fallback modules, tokens, Tailwind, existing migrations, and `/legacy/*`.

## Integration contracts

- **Brand context:** `getCreatorNetworkBrandContext(brandId, {projection})` wraps `buildBrandContext()` and returns only allowed fields.
- **Design:** insert a row through `design-enqueue` and store `design_job_id`.
- **Video:** create `video_projects` and invoke `video-studio`, then store `video_project_id`.
- **AI:** calls go through `creator-network-ai`, which uses the gateway, model-fallback, token-budget, tracer, ai-cache, sanitise and validate-output. Each run is a real `ai_runs` row.
- **Analytics:** `trackEvent` with IDs only. No private content goes into events.

## Blueprint approval (documented, not changed)

I'll record which path is canonical in `AGENTS.md`. Creator Network uses its own concept and stage approvals.

## Feature flag

`CREATOR_NETWORK_ENABLED` is read from `app_settings` (a backend setting the admin can toggle). When it's off, the routes redirect to `/` and the nav entry is hidden.

## Risks

- **Scope:** a large surface, handled by shipping in phases.
- **Mismatch in the auth backfill:** checked against the live catalog first.
- **Leaking private creator data:** prevented by RLS and the private bucket.

## Test plan

Vitest unit tests cover NBA, scoring, claim gating, denominators and licence eligibility. SQL checks cover RLS for member vs non-member vs admin, the supersession RPC, the unique selected concept, and the review-reason trigger. Playwright covers desktop, tablet and mobile, keyboard, empty states and dialogs. A regression smoke test runs on Brand Centre, Hub, Blueprint, Studio, Plans, Auth, Admin, Partner and Affiliate. Results are reported as PASS, PARTIAL, FAIL or BLOCKED.

## Rollback

1. Turn the flag off. The module disappears.
2. Revert the 4 registration edits.
3. Drop the `creator_network_*` tables, the RPCs and the bucket. No existing table depends on them, since the `content_ideas` column is nullable.

## Deliverable

After the work is done, I write the "BRANDIE CREATOR NETWORK V1 — Implementation & Regression Report" and save it as a .md file with a download button.
