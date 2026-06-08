## What is causing it

This is not primarily caused by the pricing model UI itself. The strongest signal is backend access: the key public tables used immediately after login currently show **no Data API grants** for `authenticated`, `service_role`, or `anon` in `information_schema.role_table_grants`.

That means users can authenticate successfully, but the app cannot reliably read the brand/account tables it needs after login. When the brand lookup fails, routing falls back toward onboarding, creating the loop.

The pricing updates may be related only if yesterday's pricing/billing migration changed or recreated grants around tables such as `subscriptions`, `subscription_plans`, `credit_rewards`, or broadly affected public table privileges. The login loop itself is being triggered at the post-login brand/account data load step, not the password login step.

## Fix plan

1. **Restore required table access immediately**
   - Add a backend migration that grants logged-in app access to the tables used during login/bootstrap:
     - `brands`
     - `brand_team_members`
     - `profiles`
     - `subscriptions`
     - `subscription_plans`
     - `credit_rewards`
   - Keep existing row-level rules intact, so users still only see their own data.
   - Grant backend service access where needed for functions and automation.
   - Grant public read only where already intended, e.g. `subscription_plans`.

2. **Add a safety migration for all existing app tables**
   - Re-run the missing-grant repair across public base tables so older tables are not silently unreachable.
   - This fixes the likely project-wide grant regression without weakening row-level security.

3. **Patch auth/brand loading to avoid loop amplification**
   - Stop calling `useAuth()` twice on the same route via `useBrand(user)`, because nested auth listeners can multiply `/user` requests and make bad cached-session loops worse.
   - Only clear local sessions for real JWT/session errors.
   - Only redirect to onboarding when the brand query succeeds and returns no completed brand.

4. **Validate with live signals**
   - Confirm grants now appear for the affected tables.
   - Confirm auth logs show normal `/user` 200 responses after login.
   - Confirm an existing completed account routes to `/cockpit`, while a genuinely new account still routes to `/onboarding`.

## Technical note

The logs show some `bad_jwt / missing sub claim` requests from the preview domain, but the custom domain also shows successful `/user` responses. That means the bigger blocker is not password authentication itself; it is the app's post-login data access and routing path.