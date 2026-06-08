## Problem

Users with a stale Supabase session token (e.g. after a JWT key rotation) are silently trapped on `/onboarding`:

1. `supabase.auth.getSession()` reads the token from localStorage without server validation → `user` is populated.
2. PostgREST rejects the JWT (`403 bad_jwt: invalid claim: missing sub claim`), so brand queries return 0 rows under RLS.
3. `ProtectedRoute` sees no brand → redirects to `/onboarding`, where writes also fail.

Confirmed in auth logs (recurring `bad_jwt` 403s from `trybrandie.lovable.app`) and DB (the affected user has `onboarding_complete = true`).

## Fix

### 1. Validate the session on boot in `src/hooks/useAuth.tsx`

Replace the bare `getSession()` call with a sequence that also calls `supabase.auth.getUser()` once on mount. If `getUser()` returns an `AuthApiError` whose status is 401/403 or whose code is `bad_jwt` / `invalid_claim` / `user_not_found`, run `supabase.auth.signOut({ scope: 'local' })`, clear `user`/`session`, and set `loading = false`. This forces routing to fall through to `/auth` instead of `/onboarding`.

Keep the existing `onAuthStateChange` subscription so subsequent sign-ins still update state.

### 2. Add the same guard inside `useBrand`'s query

When the `brands` select returns an error matching `PGRST301` / message contains `JWT` / `invalid claim`, call `supabase.auth.signOut({ scope: 'local' })` so any token that becomes invalid after boot also triggers a clean re-login.

### 3. Friendlier `OnboardingRoute` fallback

If `OnboardingRoute` renders with `user` set but the `brands` fetch errored (not just empty), show a small "Your session expired — sign in again" screen with a button that calls `signOut()` and navigates to `/auth`, instead of silently rendering the onboarding wizard. This is the visible safety net for any future auth edge case.

### 4. No DB or RLS changes

The data is correct; this is purely a client-side stale-token handling fix.

## Technical notes

- `supabase.auth.signOut({ scope: 'local' })` clears the local session without round-tripping the (already-invalid) token to the server.
- We deliberately keep the redirect to `/auth` (not `/`) so users immediately see the login screen rather than the marketing landing.
- The change is isolated to `src/hooks/useAuth.tsx`, `src/hooks/useBrand.tsx`, and `src/App.tsx` (`OnboardingRoute`).

## Out of scope

- Rotating Supabase keys or changing auth providers.
- Any changes to onboarding UI/flow itself.
