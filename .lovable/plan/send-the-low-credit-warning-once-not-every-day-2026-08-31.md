# Send the low-credit warning once, not every day

Today two credit-related emails can fire repeatedly:

- `low_credits` — sent from the design pipeline every time a generation leaves the user with 1-4 credits, so a user near zero gets one on every single design.
- `autopilot_no_credits` — sent from the autopilot completion hook every time a scheduled post fails for lack of credits, which can be daily (and more than once a day).

The only email that should recur daily is the autopilot "your post of the day is ready" delivery.

## What changes

1. **Low-credit warning: once per top-up cycle.** Record on the user's profile when the warning was sent. The warning is only sent if it has never been sent, or if the user has topped up / had their credits refilled since the last one. Running low again after a fresh top-up re-arms it once.
2. **Autopilot out-of-credits notice: once per cycle too.** Same gate — the first failure notifies, subsequent failures stay silent (the in-app banner and the failed status already show it) until credits are added again.
3. **No change to the daily design-ready email**, push, or WhatsApp delivery.
4. The in-app low-credits banner stays as-is — it is free to show every session.

## Technical notes

- New nullable columns on `public.profiles`: `low_credits_notified_at timestamptz` and `credits_topped_up_at timestamptz` (migration + no grant change needed since profiles is already exposed). `credits_topped_up_at` is stamped wherever credits are added: `paystack-webhook`, `paystack-verify`, admin credit grants, and `credit_rewards` insertion paths used by referrals/partner grants.
- `supabase/functions/design-studio/index.ts` (~line 1629): before sending `low_credits`, skip when `low_credits_notified_at` is set and is later than `credits_topped_up_at`; on send, stamp `low_credits_notified_at = now()`.
- `supabase/functions/autopilot-notify/index.ts` (~line 54): apply the same gate to the `autopilot_no_credits` email and share the same timestamp so the user gets one notice, not two.
- Gate logic lives in one small shared helper (`supabase/functions/_shared/credit-notice.ts`) used by both functions to avoid drift.
- Both functions get redeployed after the change.
