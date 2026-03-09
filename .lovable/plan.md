

# Brandie — Full User Flow Audit

## 1. Landing Page (`/`)
**Status: Working**
- Marketing landing page renders for unauthenticated users
- Hero chat input with animated placeholder works — submits redirect to `/auth?prompt=...`
- Navigation to sign in / sign up works
- Feature sections, CTA, footer all render correctly

**Issue (minor):** The hero chat input redirects to `/auth?prompt=...` but the Auth page does NOT read or use the `prompt` query param. The user's typed prompt is lost after signup/login. This is a **partially working** flow — the intent to carry the prompt into the studio is broken.

---

## 2. Authentication (`/auth`)
**Status: Working**
- Login, signup, forgot password modes all present
- Referral code (`?ref=`) and affiliate code (`?aff=`) params are captured on signup
- Email confirmation flow triggers correctly
- Redirect to `/` after login works

**Issue (minor):** The `?mode=signup` param from landing page CTAs is not read — the Auth page always starts on "login" mode unless `?ref` or `?aff` is present. Users clicking "Get started" land on login, not signup.

---

## 3. Password Reset (`/reset-password`)
**Status: Working with caveat**
- Checks for `type=recovery` in hash fragment
- Allows password update via `supabase.auth.updateUser`

**Potential issue:** Modern Supabase auth may use PKCE flow where the hash format differs. If the redirect URL doesn't include `type=recovery` in the hash, users see "Invalid or expired reset link" permanently. This could be **partially working** depending on the auth config.

---

## 4. Onboarding (`/onboarding`)
**Status: Working**
- 10-step guided flow collecting brand data
- Logo upload to `brand-logos` storage bucket
- Inspiration upload to `brand-inspiration` storage bucket
- Brand record created with `onboarding_complete: true`
- Welcome email sent (fire-and-forget)
- Redirects to `/` on completion

**No issues found.** All steps have proper validation, back/next navigation works, and data persistence is correct.

---

## 5. Dashboard (`/` when authenticated, or `/dashboard`)
**Status: Working**
- Shows recent designs (up to 6)
- Referral banner with copy/share functionality
- Navigation to studio and brand centre
- Credit badge in header

**No issues found.**

---

## 6. Design Studio (`/studio`)
**Status: Working (core flow)**
- Chat-based design generation with AI
- Canvas size selection (square, landscape, story)
- Quality toggle (fast/HD)
- Audience selector from saved JTBD profiles
- Trend selector with intensity slider
- Image attachment support
- Auto-save designs and chat messages
- Load existing design via `?design=` param
- Vote (thumbs up/down), download (PNG/JPG with watermark), copy URL, regenerate
- Genome scores display
- Caption display with copy
- Credit limit checking
- Chat suggestions (empty state and post-message)
- Floating design status when navigating away

**Issue (minor):** The `loading` state is set to `true` on `sendMessage` but is only set back to `false` inside the `useEffect` watching `generation.status`. If the user navigates away and back, the `loading` flag may not reset properly since it's local state. However, this is a minor edge case.

**Issue (minor):** Vote state (`vote`) is shared across all messages. If a user generates multiple designs in one session, voting on the latest design correctly updates the DB, but the UI shows the same vote state for all image messages. This is cosmetic.

---

## 7. Brand Centre (`/brand`)
**Status: Working**
- All brand fields editable (name, tagline, description, colors, typography, vibe, tone, personality)
- Logo upload/update
- Inspiration image upload/delete
- Product image upload/delete
- Target Audience Intelligence (JTBD) — add/edit/delete audience profiles, generate AI profiles
- Trend Lab — enable/disable trends, select trend, adjust intensity

**No issues found.** All CRUD operations, mutations, and queries appear correct.

---

## 8. Design History (`/history`)
**Status: Working**
- Displays all designs in grid
- Folder system: create, rename, delete folders, assign designs
- Design viewer modal
- Filter by folder

**No issues found.**

---

## 9. Settings (`/settings`)
**Status: Working**
- Account info display
- Brand link to Brand Centre
- Plan info (hardcoded "Free Plan")
- Theme toggle (light/dark/system)
- Referral section with copy/share
- Sign out

**Issue (minor):** Plan section always shows "Free Plan" hardcoded. It doesn't read from `profile.subscription_tier`. Users who upgraded via Plans page would still see "Free Plan" here.

---

## 10. Plans (`/plans`)
**Status: Working (UI), Partially Working (payments)**
- Displays 4 tiers with NGN pricing
- Current tier badge reads from profile
- Paystack checkout integration via edge function
- Payment verification callback handling

**Potential issue:** Payment integration depends on `paystack-checkout` and `paystack-verify` edge functions having valid Paystack API keys configured. If secrets aren't set, upgrades will fail silently with a toast error.

---

## 11. Affiliate Signup (`/affiliate/signup`)
**Status: Working**
- Signup for non-authenticated users (creates account + affiliate record)
- Application for authenticated users
- Duplicate check
- Email notification (fire-and-forget)

**Note:** This route is NOT behind `ProtectedRoute`, which is intentional for public access.

---

## 12. Affiliate Dashboard (`/affiliate`)
**Status: Working (UI)**
- Protected route
- Shows affiliate stats, referrals, commissions, payouts
- Bank details form
- Payout request

---

## 13. Admin (`/admin`)
**Status: Working (UI)**
- Protected by `AdminRoute` (checks `user_roles` table)
- Multi-tab admin panel for managing users, brands, designs, affiliates

---

## 14. Floating Design Status
**Status: Working**
- Shows when generating/complete and NOT on `/studio`
- Hidden on studio page
- Click navigates to studio with design ID
- Pulsing glow on completion
- Chime + toast on completion

---

## Summary Table

| Flow | Status | Issues |
|------|--------|--------|
| Landing page | **Working** | Hero prompt lost after auth redirect |
| Auth (login/signup) | **Working** | `?mode=signup` param ignored |
| Password reset | **Working** | May break with PKCE auth flow |
| Onboarding | **Working** | None |
| Dashboard | **Working** | None |
| Design Studio | **Working** | Minor vote state shared across messages |
| Brand Centre | **Working** | None |
| Design History | **Working** | None |
| Settings | **Partially working** | Plan always shows "Free Plan" |
| Plans/Payments | **Partially working** | Depends on Paystack secrets |
| Affiliate Signup | **Working** | None |
| Affiliate Dashboard | **Working** | None |
| Admin | **Working** | None |
| Floating Status | **Working** | None |

## Priority Fixes Recommended

1. **Auth page: Read `?mode=signup`** — Landing CTAs send users to signup but they land on login
2. **Hero prompt carry-through** — Save prompt to sessionStorage, load it in studio after auth
3. **Settings: Show actual subscription tier** — Read from `profile.subscription_tier` instead of hardcoded "Free Plan"

