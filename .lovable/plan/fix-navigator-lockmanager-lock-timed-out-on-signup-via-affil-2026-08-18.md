# Fix "Navigator LockManager lock timed out" on signup via affiliate link

## What the user sees

On `trybrandie.com` (mobile Safari, many open tabs), the app shows a red error strip and "Couldn't load your brand" with:

```text
Error: Acquiring an exclusive Navigator LockManager lock
"lock:sb-...-auth-token" timed out waiting 10000ms
```

## Why it happens

The auth client serialises every session read/refresh behind one browser-wide exclusive lock keyed on the auth token. In this app, `useAuth` is a plain hook — not a shared context — and it is mounted many times at once (`App`, `useBrand`, `useSubscription`, `useAdminRole`, `useAffiliateRole`, `usePartnerRole`, plus most pages). Each mount fires `getSession()` **and** a network `getUser()`, and dozens of other places call `supabase.auth.getSession()` independently. Every one of those takes the same lock; on a slow mobile connection with several tabs sharing the same origin, one slow token refresh holds the lock and the rest time out after 10s. The rejected promise bubbles out of the brand query, so the failure is reported as "Couldn't load your brand".

The auth logs also show repeated `403 invalid claim: missing sub claim` on `/user`, consistent with `getUser()` being hammered with a stale/anon token during this window.

## The fix

1. **One shared auth store.** Move the session logic out of the per-component hook into a module-level singleton: a single `onAuthStateChange` subscription plus a single in-flight `getSession()` promise, with subscribers notified from memory. `useAuth()` keeps its exact current return shape (`user`, `session`, `loading`, `signOut`), so no call sites change.
2. **Stop the redundant `getUser()` storm.** Validate the cached session at most once per page load (deduped in the singleton), and only when a session actually exists. Keep the existing stale-session cleanup behaviour (clear `sb-*` keys and fall through to `/auth`) — just run it once instead of once per mounted hook.
3. **Serve tokens from memory.** Add a small `getAccessToken()` helper backed by the same store and use it in the many `supabase.auth.getSession()` call sites that only need a bearer token for an edge-function call (partner, admin, agent, hub panels). This removes most remaining lock acquisitions.
4. **Fail soft on lock timeouts.** Treat "LockManager lock ... timed out" as a transient error: retry once after a short delay before surfacing it, and never treat it as an invalid session (today it can push a signed-in user toward a logout path). The brand query gets the same handling so a single slow refresh no longer shows "Couldn't load your brand".

Affiliate/partner referral capture is unaffected — the `?ref=` slug handling stays exactly as is; this error was purely session-lock contention on load.

## Technical notes

- New `src/lib/authStore.ts`: singleton holding `{ session, user, loading }`, one `onAuthStateChange` subscription, deduped `ensureSession()` / `ensureValidated()`, `subscribe()`, and `getAccessToken()`.
- `src/hooks/useAuth.tsx` becomes a thin subscriber to that store; `isInvalidSessionError` moves into the store and gains an explicit lock-timeout exclusion.
- `src/hooks/useBrand.tsx`: wrap the brands query so a lock-timeout error retries once and is not classified as a JWT error.
- Replace direct `supabase.auth.getSession()` token reads with `getAccessToken()` in the edge-function callers listed above.
- `src/integrations/supabase/client.ts` is auto-generated and will not be touched.

## Verification

- Load the app cold with the affiliate link in a browser with several tabs open on the same origin and confirm no lock-timeout error and no "Couldn't load your brand".
- Confirm sign-in, sign-out, and the affiliate signup path still work, and that partner/admin edge-function calls still authenticate.
