## Problem

A user successfully paid for 20 credits via Paystack but their account was never credited and they remained on the free tier.

After tracing the flow:

```
Plans page  →  paystack-checkout  →  Paystack hosted page  →  user pays
                                                                  │
                          ┌───────────────────────────────────────┤
                          ▼                                       ▼
            paystack-webhook (server→server)        redirect → /plans?reference=…
            (the ONLY function that credits)        → calls paystack-verify
                                                    (verifies status only,
                                                     does NOT credit)
```

### Root causes

1. **Single point of failure.** Only `paystack-webhook` writes `paid_credits`. `paystack-verify` was deliberately made a no-op for crediting (comment says "Credits are deposited by paystack-webhook"). If the webhook URL isn't registered in the Paystack dashboard, the request is dropped, the signature check fails, or the Supabase function is cold/erroring, the user never gets credits.
2. **No payment ledger.** There is no `payment_transactions` table. A failed webhook leaves no audit trail and cannot be replayed safely. Edge function logs for `paystack-webhook` currently return "No logs found", which strongly suggests the webhook is not being delivered at all.
3. **No idempotency guard.** Even if we make `verify` also credit, today both functions could run and double-credit the same transaction.
4. **No retry/observability.** The webhook silently returns `401` on signature failure and has no structured logging of received events.

## Goal

A user who pays should *always* get credited:
- via the webhook (primary, fast),
- or via the redirect-back verify call (fallback),
- or via an admin-triggered manual reconcile,
- and **never twice for the same transaction**.

## Plan

### 1. Add a payment ledger table

New table `public.payment_transactions`:

- `reference` (text, **unique**) — Paystack transaction reference
- `user_id`, `credits`, `amount` (NGN), `currency`
- `status` — `pending` | `credited` | `failed`
- `credited_via` — `webhook` | `verify` | `manual`
- `credited_at`, `created_at`, `raw_event` (jsonb)

RLS:
- Users can `SELECT` their own rows.
- Admins can `SELECT` / `UPDATE` all rows (for reconciliation).
- Only the service role inserts/updates from edge functions.

The unique constraint on `reference` is what guarantees idempotency: whichever function (webhook or verify) calls a `crediting helper` first wins; the second one becomes a no-op.

### 2. Centralise crediting in a shared helper

Create `supabase/functions/_shared/credit-payment.ts` with one function used by both `paystack-webhook` and `paystack-verify`:

- Atomically insert into `payment_transactions` with status `credited`. If the insert fails because the reference already exists → return `{ already_credited: true }` and exit.
- If the insert succeeds → add `credits` to `profiles.paid_credits` for that user.
- Then run the affiliate-commission logic (also keyed off the unique `reference` so it cannot double-pay).

This collapses the "who is allowed to credit?" question into a single race-safe code path.

### 3. Fix `paystack-verify` to be a real fallback

After it confirms the transaction status with Paystack:

- Call the shared helper to credit the user if not already credited.
- Return `{ verified, credits, amount, currency, credited: true|false, already_credited }` so the frontend can react.
- Keep sending the confirmation email, but only when this call is the one that actually credited (avoid duplicate emails when the webhook already did it).

### 4. Harden `paystack-webhook`

- Use the shared crediting helper instead of inline updates.
- Always log: event type, reference, user_id, signature-valid yes/no, and the outcome (`credited` / `already_credited` / `error`). Currently failures are invisible.
- On signature failure, log a structured warning (still return 401) so we can spot misconfigured webhook secrets in Cloud logs.

### 5. Frontend: poll until credited on the /plans return

`src/pages/Plans.tsx` already calls `paystack-verify` once on the redirect callback. Upgrade it to:

- Poll `paystack-verify` up to ~10× over ~20 s, stopping as soon as `credited || already_credited` is true.
- Refresh the profile/credit queries on success.
- If polling exhausts, show a clearer message ("Payment received — credits are syncing, refresh in a moment") instead of "verification failed".

This makes the success page resilient to webhook lag.

### 6. Reconcile the user who already paid

For the specific affected user:

- Look up the transaction reference (Paystack dashboard or the `paystack-verify` call), insert a `payment_transactions` row, increment `paid_credits` by 20.
- This will be done as a one-off `insert` once we know the user_id and reference. (Will ask for those before running.)

### 7. Optional admin tool

Small admin action: paste a Paystack reference → calls `paystack-verify` → triggers crediting. Useful for any future stuck payments. Low priority; can ship after the core fix.

## What this does NOT change

- Pricing, packages, or the checkout function — all unchanged.
- The `subscription_tier` field is intentionally left alone. Buying a credit pack doesn't move a user between tiers (Free / Entrepreneur / Creator / Agency); it tops up `paid_credits`. If you actually want credit packs to also bump the tier, tell me and I'll add it.

## Open questions

1. Should buying a credit pack also change `subscription_tier` (e.g. from `free` to `entrepreneur`), or is the tier purely about plan subscriptions and credit packs only affect `paid_credits`?
2. Do you have the Paystack reference (or the user's email) for the affected payment, so I can include the one-off reconciliation in the same change?
