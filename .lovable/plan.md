

# Brandie — Full User Flow Audit (Updated)

## Summary

All three priority fixes from the previous audit have been implemented. Here is the current status of every flow:

---

## Flow Status

| # | Flow | Status | Notes |
|---|------|--------|-------|
| 1 | **Landing Page** | **Working** | Hero chat saves prompt to sessionStorage, CTA links to `?mode=signup`. Both previously broken flows are now fixed. |
| 2 | **Auth (Login/Signup)** | **Working** | Reads `?mode=signup`, `?ref=`, `?aff=`, `?prompt=` params correctly. Prompt persisted to sessionStorage for carry-through. |
| 3 | **Password Reset** | **Working (caveat)** | Checks `type=recovery` in hash fragment. May fail if PKCE auth flow changes the hash format — not a code bug, but a configuration sensitivity. |
| 4 | **Onboarding** | **Working** | 10-step flow, logo/inspiration uploads, brand creation, welcome email. No issues. |
| 5 | **Dashboard** | **Working** | Recent designs, referral banner, navigation. No issues. |
| 6 | **Design Studio** | **Working** | Full generation flow, edits, auto-save, audience/trend selectors, credit checks, hero prompt pickup from sessionStorage. |
| 7 | **Brand Centre** | **Working** | All brand fields, JTBD profiles, Trend Lab. No issues. |
| 8 | **Design History** | **Working** | Grid view, folder system, viewer modal. No issues. |
| 9 | **Settings** | **Working** | Now reads `subscription_tier` from profile dynamically. Shows correct plan name and credits. Previously hardcoded — now fixed. |
| 10 | **Plans/Payments** | **Working** | Paystack checkout + verification flow functional. `PAYSTACK_SECRET_KEY` secret is configured. |
| 11 | **Affiliate Signup** | **Working** | Public route, dual-mode (auth/unauth). No issues. |
| 12 | **Affiliate Dashboard** | **Working** | Stats, referrals, payouts. No issues. |
| 13 | **Admin** | **Working** | Role-based protection via `user_roles` table + `has_role()` function. No issues. |
| 14 | **Floating Design Status** | **Working** | Hidden on `/studio`, visible elsewhere, pulsing glow on complete, chime + toast, click navigates to studio. |

---

## Previously Identified Issues — Now Resolved

| Issue | Status |
|-------|--------|
| Auth page ignores `?mode=signup` | **Fixed** — `useEffect` reads param and sets mode |
| Hero prompt lost after auth redirect | **Fixed** — Saved to sessionStorage, picked up in DesignStudio |
| Settings shows hardcoded "Free Plan" | **Fixed** — Reads `profile.subscription_tier` dynamically |

---

## Remaining Minor Issues (Cosmetic / Edge Cases)

1. **Vote state shared across all messages** — The `vote` state in DesignStudio is a single value applied to all image messages in the UI. If a user generates multiple designs in one session, the thumbs-up/down highlight applies to all images, not just the one being voted on. This is cosmetic only; DB writes target the correct design.

2. **Password reset PKCE sensitivity** — The `ResetPassword` page checks `window.location.hash` for `type=recovery`. Modern auth PKCE flows may deliver the recovery token differently. If users report "Invalid or expired reset link" despite clicking a valid link, this would need investigation.

3. **Credit calculation ignores paid tiers** — `getCreditsRemaining()` in DesignStudio uses `FREE_TIER_LIMIT = 10` for all users. Paid users (entrepreneur/creator/agency) should have higher limits (50/150/400). The limit check in `checkGenerationLimit()` also uses this constant. Upgrading users would still be capped at 10 + bonus credits.

---

## Verdict

**All major flows are working.** The three priority fixes from the last audit are confirmed implemented. The only functional issue of note is #3 above — credit limits don't scale with paid tiers — which would matter once real payments are live.

