# Brandie architecture report before adding a Private Network module (read-only)

This plan covers one thing: writing a full architecture report. I will not change any code or data. The output is a downloadable report, `brandie-architecture-for-private-network.md`, saved to Files.

## Checks already done (read-only)
- No "Private Network" code or tables exist yet, and nothing called "Distribution OS" exists. Today, distribution is spread across several pieces: the Campaigns module (`campaigns_public`, the `campaign-engine`, `campaign-track` and `campaign-scheduler` functions), Partner (`partner_*` tables, the `partner-portal`, `partner-campaign-send` and `partner-automation-tick` functions), Affiliate, Email marketing (the `email-marketing-*` functions and the `marketing_*` tables) and WhatsApp (the `whatsapp-send` function, which is blocked because the Twilio trial expired).
- Creator Network V1 is built, switched OFF (`creator_network_settings.enabled=false`) and closed except for the WhatsApp check. It is the model to copy: everything lives in a feature folder, it is registered in 4 places, it uses its own roles table and its own private storage bucket.
- There are 6 storage buckets. Only `avatars` and `creator-network-assets` are private.
- No design jobs are queued or running. The latest build log shows no errors.
- There are 64 backend functions, 138 older migration files, and 5 Drizzle migrations, all Creator Network ones (0001–0005).

## Report sections
1. **Stack:** React 18, Vite, TS, Tailwind, shadcn, TanStack Query, Lovable Cloud, Deno backend functions, Vitest and Playwright.
2. **Auth, roles and tenants:** the singleton `authStore` and `useAuth`. App-level roles use `app_role` with `user_roles` and `has_role()`. Module roles have their own tables (`creator_network_members`). Brands act as tenants through `has_brand_access`, `is_brand_owner` and `brand_team_members`. Partners use `partner_id_for_user`.
3. **Routes and navigation:** the 60 routes in `src/App.tsx`, the allow-list and "more" items in `NewFloatingNav.tsx`, the menu in `NewAppHeader.tsx`, and the tab registry in `Admin.tsx` (around line 3213).
4. **Modules, each labelled implemented, placeholder or untested:** Blueprint, Studio, Hub, Autopilot, Campaigns, Partner, Affiliate, Email, WhatsApp, Creator Network (licences, preview vs commercial rights, earnings, watermarking), and Video (built, but its screens are removed and it is waiting on keys).
5. **Data:** every table group with its policy count and how it is protected, the security-definer helpers, the storage buckets, and the backend functions that skip the login-token check (listed from `config.toml`).
6. **Integrations:** Paystack (the webhook and verify step both add credits and can safely run twice), credit deduction order, referral, partner and campaign attribution (affiliate always wins), the AI gateway with fallbacks, budgets and tracing, Resend, and Twilio.
7. **Reusable services:** `design-enqueue`, `_shared/creator-network-brand-context.ts`, `credit-gate`, `licenceEligibility`, `watermark`, the `metrics` denominator guards, the `campaignTrack` event ingest, and the partner send and suppression pipeline.
8. **Integration points for Private Network:** the one route group, one nav entry, one Admin tab, a `private_network_settings` on/off switch, a `private_network_members` roles table, a `useprivate_network()` gate hook, `private-network-*` backend functions, and read-only links to Creator Network licensed assets and campaigns through views or RPCs, never direct writes.
9. **Migration strategy:** additive tables named `private_network_*`, with GRANTs and row security set in the same migration; nullable foreign keys only; no changes to existing tables, except optional nullable link columns added in a later phase.
10. **Switch-off and rollback:** turn the switch off, undo the 4 registration edits, then drop the module's own tables.
11. **Expansion boundaries:** what the module may read (licensed assets, approved campaigns, privacy-filtered brand context) and what it must never touch (billing, auth, the core content pipeline internals).
12. **Risks and missing pieces:** WhatsApp delivery depends on Twilio, which is blocked. There is no unified "distribution" model yet. Private Network inherits Creator Network's licence rules. The partner and affiliate attribution rules must not conflict. Public endpoints can be abused. The module should not depend on Blueprint approval.
13. **Test and build status:** 62 passing rule tests, a clean typecheck, a clean build, and what each part was last tested against.

## Technical method
To fill in each section, I will read the files, query the database's catalog (policies, grants, functions and triggers) and pull a count of each route. Every claim in the report will cite a file and line number or a query. The plan is finished when the report is saved and attached.
