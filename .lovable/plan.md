

## Fix: Password Reset Link Redirects to Wrong Page

### Problem
When a user clicks the password reset link in their email, they're taken to a Lovable page instead of the `/reset-password` page on the app. This happens because the Supabase auth redirect URL allowlist doesn't include all the domains the app is served from (`trybrandie.com`, `trybrandie.lovable.app`).

### Root Cause
The `resetPasswordForEmail` call in `Auth.tsx` uses `window.location.origin` as the `redirectTo` URL. This is correct, but Supabase only allows redirects to URLs that are explicitly allowlisted in its auth configuration. If the domain isn't in the allowlist, Supabase redirects to its default site URL instead.

### Solution
Use the `configure_auth` tool to add all project domains to the Supabase redirect URL allowlist:
- `https://trybrandie.com/reset-password`
- `https://trybrandie.lovable.app/reset-password`
- `https://trybrandie.com/**`  
- `https://trybrandie.lovable.app/**`

This ensures the password reset flow works regardless of which domain the user is on.

### No Code Changes Needed
The existing code in `Auth.tsx` and `ResetPassword.tsx` is correct. This is purely a backend auth configuration update.

### Files
- No file changes — only Supabase auth redirect URL configuration update

