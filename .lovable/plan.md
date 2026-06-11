## Owner-only Google OAuth (offline) — get a refresh token for Gmail + Analytics

You're the only user that will ever connect. So we don't need a per-user tokens table or admin UI — we just need a one-time "Connect Google" flow that captures your refresh token and stores it as a secret. After that, any edge function can mint fresh access tokens on demand.

### Scopes
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`
- `openid email` (so we can verify it's your account during callback)

### Flow

```text
/admin/google-connect   →  click "Connect Google"
        │
        ▼
google-oauth-start  (edge fn)
        │  builds Google authorize URL with
        │  access_type=offline, prompt=consent, scope=...
        ▼
accounts.google.com/oauth  →  you approve
        │
        ▼
google-oauth-callback  (edge fn, public)
        │  exchanges ?code for tokens
        │  verifies email == OWNER_EMAIL (hardcoded admin allowlist via has_role)
        │  stores refresh_token + access_token + expiry in `google_oauth_tokens`
        ▼
redirect back to /admin/google-connect?status=ok  → shows "Connected as you@…"
```

### Database — one row, owner-only

```text
google_oauth_tokens
  id uuid pk
  user_id uuid          -- the admin who connected (you)
  google_email text
  refresh_token text    -- the prize
  access_token text
  expires_at timestamptz
  scopes text[]
  created_at, updated_at timestamptz
```

RLS: only `has_role(auth.uid(), 'admin')` can `SELECT`. No inserts/updates from client — edge functions use service role. (Refresh tokens never reach the browser.)

### Edge functions

1. **`google-oauth-start`** (admin-only, verifies JWT + admin role) — returns `{ url }` with the Google authorize URL, includes a signed `state` (random nonce stored in a short-lived row or HMAC of user_id+timestamp) to prevent CSRF.
2. **`google-oauth-callback`** (public, `verify_jwt = false` because Google redirects here without our session) — validates `state`, POSTs `code` to `https://oauth2.googleapis.com/token`, decodes the ID token to confirm the email matches your owner email, upserts the row, redirects to `/admin/google-connect?status=ok|error`.
3. **`google-access-token`** (admin-only helper) — internal utility other edge functions call to get a fresh access token. Reads the row, if `expires_at < now()+60s` calls Google's refresh endpoint with `refresh_token`, updates the row, returns the new `access_token`. This is the function every future Gmail/Analytics call will use.

### Secrets to add

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` — the deployed callback URL of `google-oauth-callback`. I'll generate the exact value after the function is scaffolded and tell you what to paste into your Google Cloud Console "Authorized redirect URIs".
- `GOOGLE_OWNER_EMAIL` — the Gmail address allowed to complete the flow (safety net so nobody else can connect).

### Frontend

One page: **`/admin/google-connect`** (guarded by `useAdminRole`). Shows:
- Current status (connected as `you@gmail.com`, scopes, last refresh) or a "Connect Google" button.
- Connect button calls `google-oauth-start`, then `window.location = data.url`.
- After callback redirect, reads `?status=` and toasts success/error.
- "Disconnect" button (clears the row + revokes via `https://oauth2.googleapis.com/revoke`).
- "Copy refresh token" button (admin-only, since you specifically asked to obtain it) — fetches it via a tiny `google-token-reveal` admin edge function so we don't bake the secret into the bundle.

### Order of operations

1. You add the three Google secrets + owner email.
2. I run the migration for `google_oauth_tokens`.
3. I scaffold the three edge functions + the admin page.
4. I tell you the exact `redirect_uri` to paste into Google Cloud Console.
5. You click "Connect Google" → grant consent → refresh token lands in DB → you can copy it from the page.

### Out of scope (we can add later)
- Per-user Google connections.
- Actual Gmail send / Analytics report code (this plan only covers obtaining and storing the refresh token + a reusable access-token helper).
- Multi-account support.
