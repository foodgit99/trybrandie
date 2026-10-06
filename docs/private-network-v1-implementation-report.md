# Private Network V1 — Implementation Report

Status: built, server-tested, **flag OFF** (enablement is your decision). See `docs/private-network-v1-audit-report.md` for the gap audit and the full executed evidence list.

## Where things live
- Frontend: `src/features/private-network/` (routes `/private-network/*`: feed, saved, published, earnings, profile, manage). Registrations only in `src/App.tsx`, `src/components/v2/NewFloatingNav.tsx`, `src/components/v2/NewAppHeader.tsx`, `src/pages/Admin.tsx` (+ `src/components/admin/PrivateNetworkAdminTab.tsx`).
- Database: migrations `0006`–`0011` (`private_network_*` tables, enum `private_network_platform`, RLS, append-only ledger/activity log, security-definer RPCs). Private buckets `private-network-proofs`, `private-network-media`.
- Edge functions: `private-network-redirect` (public, opaque token), `private-network-events` (authenticated trusted ingest), `private-network-media` (signed URLs).
- Flag: `private_network_settings.enabled`, read by `usePrivateNetwork()` and enforced by every RPC, RLS write path, storage insert policy and edge function.

## Event ingest contract (R7)
`POST /functions/v1/private-network-events`, `Authorization: Bearer <JWT of campaign brand owner/team member or PN operator>`
`{ "pn_ref": "pn<32 hex>", "event_type": "qualified_action" | "conversion", "external_event_id": "<unique>", "amount_ngn"?: number, "actor_user_id"?: uuid }`
Idempotent per external id; publishers cannot report their own events; events before proof verification earn 0; rate-limited. The redirect appends `pn_ref` to the stored, allow-listed landing URL. Existing affiliate/partner attribution is untouched (separate tables and ledger).

## Requirement matrix

| Req | Status | Evidence type |
|---|---|---|
| R1 Modular, additive, flag-gated | Done | Executed (E2E flag OFF/ON checks, live 410/401 with flag OFF) |
| R2 Publisher biodata, estimates, edit/delete, creator link | Done | Executed save/readback + RLS; UI code-reviewed, not re-run signed-in |
| R3 Feed/Saved/Published/Earnings/Profile, matching with score version + reasons, paging | Done | Executed (score `pn-match-v1`, distinct paging, saved filter); UI not re-run signed-in with flag ON |
| R4 Campaign owner + operator workflow, funding honesty | Done | Executed (draft/unfunded forced, operator funding with reference, domain allow-list) |
| R5 Publish → unique link, snapshot rates, atomic reservation, share paths, honest states | Done (server); native share needs real device | Executed server; native OS share **not verifiable** in automation |
| R6 Published manager | Done | Code; data via `private_network_my_placements` |
| R7 Redirect + trusted events | Done | Executed (dedupe, hostile token, OFF, ended, rights expiry, self-action, idempotency) |
| R8 Ledger, balances, payouts | Done | Executed (append-only, release, overdraw, single open payout, reference, no double settle) |
| R9 Creator Network rights adapter | Done (strict rules from audit) | Executed (preview ineligible, scope/platform/territory/start/expiry/category/revocation, explicit redistribution evidence) |
| R10 Admin operations + RLS | Done | Executed RLS matrix; Operator Console code |
| R11 Validation | Partial | Server E2E + unit tests executed; signed-in multi-device browser run with flag ON and real-phone share pending |

## Remaining gaps
- Signed-in browser walkthrough with the flag ON (desktop/tablet/mobile) — waits on your go-ahead to switch the flag on for a test window.
- Real-phone test of native share / WhatsApp Status.
- Baseline (not this module): Twilio trial expired.

## Rollback
Switch the flag OFF (already OFF) and remove the four registration edits. Do not drop `private_network_*` data as routine rollback.
