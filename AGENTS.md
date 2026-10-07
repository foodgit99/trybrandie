# Architecture rules

- Creator Network lives in `src/features/creator-network/` and `supabase/functions/creator-network-*`; other files only register it — keeps the module removable without touching core Brandie.
- Creator Network visibility is gated by the `creator_network_settings.enabled` row (CREATOR_NETWORK_ENABLED) read only through `useCreatorNetwork()` — one switch, enforced by both UI and RLS.
- Creator Network roles live in `creator_network_members`, never in the global `app_role` enum — internal operator roles must not leak into customer auth.
- Creator Network tables are `creator_network_*`, additive and RLS-protected; the activity log is append-only — audit integrity.
- Creator Network AI jobs must reach brand data only via `_shared/creator-network-brand-context.ts` — privacy-filtered projection, never raw Brand Centre.
- Blueprint approval canonical path today is the client-side bulk update in `src/pages/v2/Blueprint.tsx`; `approve-blueprint` edge function is secondary — nothing new should depend on either until unified.
- Creator Network opportunity stages change only through `creator_network_transition_opportunity()` (a trigger blocks direct edits) — dependencies and roles are enforced server-side.
- Creator Network prospect renders reuse `design-enqueue` with an id-less brand object built by `services/productionContext.ts` — prospects never become Brandie brands.
- Private Network money moves only through finance RPCs backed by append-only settlements (UNIQUE reference) and per-earning allocations (UNIQUE earning) — aggregate balances must never authorise a release, reversal or budget increase.
