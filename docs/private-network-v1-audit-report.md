# Private Network V1 — Gap Audit & Fix Report

Date: 2026-10-06. Flags at end of audit: **Private Network OFF, Creator Network OFF** (verified by query). No customer data touched, no messages or payouts sent.

## 1. Reviewer findings and resolution

| # | Finding | Resolution | Evidence |
|---|---|---|---|
| A1 | Client `licenceEligibility.ts` ignored `starts_at` | Added `starts_at`; dates are UTC calendar days (start of `starts_at` → end of `expires_at`) | unit test "denies before starts_at", "expiry lasts to end of day UTC" |
| A2 | Missing scope defaulted to Commercial | Scope must equal `Commercial` exactly (client + server `IS DISTINCT FROM`). DB column is also NOT NULL | unit test "denies missing scope"; E2E "licence scope can never be blank" |
| A3 | Absent requested platform/territory bypassed lists | Client: listed platforms/territories/restricted categories require the request to name them. Server (PN): licence with **no** named platforms or territories is hard-denied; campaign must name territories; every requested/target platform must be covered by exact family match (no prefix LIKE) | E2E "no named platforms denied", "no named territories denied", "uncovered platform denied" |
| A4 | Midnight-based expiry | Server compares `now()` with `(expires_at + 1 day) UTC`; campaign must end by licence expiry; campaign may not start before licence start | E2E "licence before start date denied", "expired licence detected live" |
| A5 | Restrictions / approvals | Restricted brands, restricted categories (new `campaigns.content_category`, editor field added; required when licence restricts), creator approval, licence brand, licence↔job match | E2E "restricted category denied" |
| A6 | Private third-party redistribution must be explicit | Requires operator confirmation **plus agreement evidence text** (new `creatives.private_redistribution_evidence`, input in Operator Console). Never inferred from paid-ads or creator-posted permission. Approver must also hold Creator Network access | E2E "needs explicit confirmation", "needs agreement evidence" |
| A7 | Fulfilled, human-QA clean master; voice/twin | Requires clean master, Human QA approve, job `rights_mode = Commercial`, opportunity stage `Fulfilled`, voice permission for video, digital-twin permission for twin jobs | code: migration 0009 |
| A8 | No raw CN private paths/licence/contact data to publishers | Feed returns no storage path/licence fields; media only via 15-min signed URL from `private-network-media` after eligibility; `creative_eligibility` no longer callable by users; operator/brand-only `private_network_review_reasons()` | E2E "internal licence check not directly callable", "publisher cannot read licence review reasons" |
| A9 | Sharing must not need Twilio/contacts | PN code has no Twilio/whatsapp-send reference (grep). Uses OS share sheet, `wa.me` deep link, download/copy | grep: 0 matches |
| A10 | `campaigns_public` one-active rule must not leak | PN uses its own `private_network_campaigns`; no trigger/reference to `campaigns_public` (grep 0 matches); multiple PN campaigns allowed per brand | grep |

## 2. Additional defects found and fixed during the audit

- `private_network_publish` accepted a NULL platform (NULL cast passed) → placement insert trigger now rejects. E2E "publish needs a platform".
- `private_network_balance` leaked another publisher's "requested" payout total → now returns NULL unless owner/operator. E2E "non-owner cannot read another publisher balance".
- Anonymous role still held table privileges on all `private_network_*` tables (RLS returned 0 rows, so no data leaked, but E2E flagged it) → revoked from `anon`/`PUBLIC` (migration 0011); re-checked: anon has no privileges.
- Operator Console called the now-internal eligibility function → switched to `review_reasons`.

Migrations: `0009_private_network_strict_rights.sql`, `0010_private_network_rpc_hardening.sql`, `0011_private_network_revoke_anon.sql`.

## 3. Executed evidence

**Server E2E** (`supabase/tests/private_network_e2e.sql`, executed as one transaction that rolls itself back): **100 checks, 99 PASS, 1 FAIL → fixed** (anon table privilege, see §2; fixed by 0011 and verified by catalog query, not by a re-run of the full script). Covered: flag OFF blocks mutations/feed/publish/redirect; profile save/readback and approval gating; owner forced to draft/unfunded; no self-approval; no self-activation; funding needs operator + reference; domain allow-list; preview licence ineligible; strict licence rules (§1); feed relevance score `pn-match-v1` with reasons, paging without duplicates, saved filter; idempotent publish; no earnings at publish; per-publisher cap; platform check; atomic reservation (900 of 1000); exhausted budget refusal; share → `share_initiated` only; redirect to stored destination + click dedupe; hostile token refused; events withheld before verification; proof folder ownership; rejection needs reason; rejected-proof resubmission; single verification; base fee once; bonus + replay idempotency; conversion withheld when budget exhausted; self-action rejected; publisher cannot report events; cancel releases reservation; budget conserved; append-only ledger; payout needs available balance, finance-only release, overdraw refused, one open payout, settlement needs reference, no double settle; revoked licence blocks **publish** and feed, expired rights stop **redirect**; pause/end; RLS for publisher A/B, brand owner, other tenant, CN data hidden; direct calls to internal RPCs (eligibility, reservation release, ingest, audit log, redirect resolver) refused.

Post-run check: 0 PN publishers, 0 PN campaigns, test CN licence unchanged, both flags OFF.

**Live endpoints (flag OFF):** redirect with unknown token → 410 "no longer available" (reason `off`); events and media without login → 401.

**Browser (mobile 390px, signed out, flag OFF):** `/private-network/feed` → redirected to sign-in, no page errors.

**Unit tests:** 43 pass (Creator Network 35 incl. 4 new licence rules, Private Network 8). Build log: `build OK`.


## 5. Second review round (live-SQL findings) — verified, fixed, re-tested

Migration `0012_private_network_bindings_trust_grants.sql`; edge function `private-network-events` redeployed; Operator Console gained *Events awaiting reconciliation* and *Integration keys* (Finance tab).

| Finding | Live state found | Fix |
|---|---|---|
| Eligibility omits restricted categories / voice / twin / Fulfilled / binding | Categories, voice, twin, Fulfilled were already live (0009). Binding was loose: a licence with no job only needed the same creator; opportunity taken from licence when job had none | Licence must name **this job**, or (no job named) name **the job's own opportunity**; licence and job opportunities must agree; Fulfilled checked on the job's opportunity only |
| `add_cn_creative` accepts same creator's unrelated licence | Confirmed | Adapter refuses unless the exact job/opportunity binding holds |
| Territory bypass when campaign geographies empty | Already denied live (0009) | Kept; covered by test |
| NULL platform at approval/activation/feed bypasses coverage | Confirmed for campaigns with no named platforms (empty list skipped all platform checks) | Empty campaign platform list is now a hard ineligibility reason; a requested platform must also be in the campaign list |
| Mixed test/live cohorts | Adapter set `creative.is_test` = campaign OR job OR licence; publish compared only campaign vs publisher | Adapter rejects any mismatch; eligibility (used by approval, activation, feed, publish, media, redirect) rejects creative/licence/job ≠ campaign; placement insert trigger rejects creative/campaign/publisher mismatch; event ingest rejects placement/publisher/campaign mismatch. Ledger and payouts inherit the placement's cohort |
| Brand-user JWT could forge a paid conversion amount | Confirmed: any `has_brand_access` user earned the publisher commission on any amount | Three trust levels: **integration key** (server-to-server, sha256-hashed, admin-issued, revocable, brand-scoped) and **operator** earn immediately; **brand-user JWT** events are stored as `pending_reconciliation`, earn 0, and only a finance reviewer (not the reporter) can approve with a source reference and a verified amount. External ids are unique (index) and idempotent |
| Owner RLS updates not fully guarded | Campaign guard already covered status/funding/counters; creative guard missed evidence, job id, bucket, media URL, reviewer fields, CN rights fields | Campaign guard also locks review note and budget once funded; creative guard locks all review/rights/cohort/media-pointer fields; CN rights fields operator-only |
| Service-only helpers executable via RPC | Trigger functions and `require_enabled`/`lower`/`validate_platforms` executable by `anon`; `has_role(any uid)`, platform helpers executable by `authenticated` | Every PN function revoked from PUBLIC/anon/authenticated, then only the 32 user-facing RPCs re-granted to signed-in users (each checks role/ownership inside). Internal helpers: service role only |

### Re-run evidence (rollback-only, 2026-10-07 00:00 UTC)
Full server E2E `supabase/tests/private_network_e2e.sql`: **108 checks, 108 PASS, 0 FAIL**. New checks include: brand-user conversion earns 0 until reconciled; reporter cannot reconcile; reconciliation needs source reference; finance rejects forged amount; reconciles once; unknown and revoked integration keys refused; unbound licence denied in eligibility and in the adapter; live CN job in TEST campaign denied; adapter refuses mixed cohort; live creative in TEST campaign denied; campaign without named platforms ineligible; owner cannot change funded budget, counters or rights evidence; anon can execute 0 PN functions; signed-in users can execute 0 internal helpers.
Post-run: 0 publishers, 0 campaigns, 0 keys, fixture licence/job restored, both flags OFF.
Live endpoint (flag OFF): events with a well-formed key → 403 "switched off"; malformed key → 401.
Unit tests 43/43, type check clean, build OK.

Limitations of this round: the owner-budget/counter guard tests ran on an ended campaign, so the status rule would also have blocked them; the dedicated funded-budget rule is code-reviewed, not isolated by a test. Reconciliation *approve* path is code-reviewed; only reject/once/permissions were executed.

## 4. Not verified / limitations (honest)

- Full signed-in browser walkthrough with the flag ON (desktop/tablet/mobile) was **not re-run** in this audit pass; the flag stays OFF until you decide on enablement.
- Native OS share sheet and actual WhatsApp Status posting need a **real phone**; automation cannot confirm a post. The app never treats sharing as proof — earnings only follow operator-verified proof.
- Edge-function happy paths (signed media for an approved publisher, trusted event ingest with a real brand-owner JWT) are verified via the same database functions in E2E, not via live HTTP with the flag ON.
- Concurrency is enforced by row locks (`FOR UPDATE` on campaign/publisher) and unique idempotency keys; no parallel load test was run.
- Baseline, separate from this module: Twilio trial expired (blocks WhatsApp *automated* notifications only; PN sharing does not use Twilio).

## 6. Financial / source-integrity audit (A–G) — migration 0013

Verified against the live function definitions before changing. Every item below had a real gap and is now fixed in `drizzle/migrations/0013_private_network_financial_integrity.sql`; evidence comes from the full server test (`supabase/tests/private_network_e2e.sql`), which ran once on the final schema: **143 PASS, 0 FAIL, 1 NOTE**. The run ended in a forced rollback. A catalog check afterwards found 0 publishers, 0 campaigns, 0 funding settlements, 0 allocations, and PN and CN both OFF.

| # | Gap found | Fix | Regression evidence (executed) |
|---|---|---|---|
| A | `review_proof` verify awarded without rechecking anything | New `private_network_placement_live_reasons()` checks campaign state and window, funding coverage, creative approved, publisher approved, a single TEST cohort, and full rights eligibility for the placement platform; it also requires reservation = snapshot fee. Runs before reserve→spent and before the base reward | PASS verify refused for revoked creative / suspended publisher / underfunded campaign; PASS refused verifications awarded nothing; PASS base fee credited once after conditions restored |
| B | `reverse_entry` checked the aggregate pending balance | New append-only `private_network_earning_allocations` table with UNIQUE(earning_entry_id). Release allocates each unallocated earning. Reversal needs an unallocated earning and allocates it as `reversal` | PASS released/paid earning cannot be reversed; PASS each released earning has exactly one allocation; PASS duplicate reversal refused; PASS reversal returns exactly the earning to budget; PASS reversed earning never released; PASS other publisher's balances untouched; PASS second allocation rejected by uniqueness |
| C | Funding was only a status + reference; publishing ignored funding | `funded_amount_ngn` plus an append-only `private_network_funding_settlements` table with a UNIQUE reference. `record_funding(_id,_status,_reference,_amount)` requires amount ≥ budget; the old 3-argument form now refuses. Funding can't be removed from active/paused or spent campaigns. Only finance can `top_up_budget` (new reference; raises budget and funded amount together). A guard blocks any budget rise that funding doesn't cover. `private_network_funding_ok()` is enforced at activation, feed, publish, proof verify, redirect, event ingest and reconciliation | PASS status-only funding refused; PASS amount must cover budget; PASS TEST can't record live funding; PASS unique reference; PASS audited settlement row; PASS active campaign cannot lose funding; PASS top-up reference must be new; PASS top-up raises budget+funding; PASS only finance tops up; PASS uncovered budget increase refused; PASS owner cannot edit funded amount; PASS publish checks funding |
| D | Pending UPDATE allowed source/approval field changes | Source metadata (campaign, media source/type, CN job/licence, bucket/path/URL/design, snapshot path/hash/opportunity, is_test, created_by, CN creator-approval stamp) is now immutable on every UPDATE, including the server path. Owners use a whitelist: caption, plus rights attestation/platforms/expiry for non-CN content only | PASS CN job id / approval stamp / bucket / hash immutable server-side; PASS cohort immutable; PASS owner cannot change media URL, review stamps, CN rights or evidence |
| E | Redirect didn't check creative approval | Redirect, event ingest and reconciliation all use the live-state check (creative must be `approved`) | PASS redirect stops when creative revoked; PASS event on revoked creative earns 0 (`withheld_ineligible`) |
| F | No source-master integrity check | Import snapshots `source_master_path`, the storage-object `eTag` and `source_opportunity_id`, and refuses masters missing from storage. Eligibility requires the path, hash and opportunity to still match the job's clean master, plus Fulfilled, Human QA, Commercial and the licence binding | PASS import snapshots path/hash/opportunity; PASS replaced clean master invalidates; PASS restored master matches. NOTE: Creator Network itself forbids a job with no opportunity, so the "opportunity changed" branch is defence-in-depth and couldn't be triggered |
| G | Feed called eligibility with a NULL platform | Feed platforms = campaign ∩ publisher, filtered per platform through eligibility; a creative is hidden when none survive. Empty campaign platforms/territories are still denied | PASS feed lists only rights-covered platforms; PASS creative hidden when the intersection is empty |

Other checks: users can't read or write settlements or allocations; `funding_ok` and `live_reasons` can't be executed by signed-in users or anonymous visitors. 8 PN unit tests pass and the build is OK. The Operator console now asks for the verified settled amount, has a "Top up budget" action, and shows the settled amount. It was not opened in a browser. No real funding, payouts or messages were made.
