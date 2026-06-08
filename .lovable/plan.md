## Problem
Users are signing in successfully, but the app then fails to load their completed brand and sends them to `/onboarding`, where the new session-expired screen appears repeatedly.

Two issues are visible:
- The `brands` table has no Data API grants for logged-in users, even though it has RLS policies. That can make brand lookups fail for everyone after login.
- The recent stale-session fix treats too many brand-load errors as fatal session errors, so a database permission/query issue becomes a forced “session expired” loop.

## Fix plan

1. **Restore logged-in access to the `brands` table**
   - Add a backend migration granting authenticated users the needed access to `public.brands`.
   - Keep RLS policies intact, so users still only access their own brands or team brands.
   - Grant service-role access for backend functions.

2. **Make session-expired handling precise**
   - Update `useAuth` so it clears local sessions only when auth validation truly returns invalid-token/session errors.
   - Stop treating every 401/403 as a stale session by default.

3. **Stop onboarding from trapping users on unrelated brand errors**
   - Update `useBrand` to redirect to `/auth` only for actual JWT/session errors.
   - For permission or database errors, expose the error without clearing the user’s session.
   - Ensure brand loading only runs after auth is ready and a valid user exists.

4. **Improve protected-route behavior**
   - If brand loading has an error, show a small retry/sign-out error state instead of redirecting to onboarding.
   - Only redirect to `/onboarding` when the user is authenticated and the brand query successfully returns no completed brand.

5. **Verify**
   - Check auth logs stop showing repeated forced `/user` failures after login.
   - Confirm a known completed account can load `/` and route to `/cockpit` instead of `/onboarding`.
   - Confirm a truly new account still reaches onboarding.