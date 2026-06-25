## Goal
Add a dedicated `/profile` route where the user can manage personal profile info, security, contact, and locale, with an avatar uploader backed by a new storage bucket.

## 1. Backend

**Migration** — extend `public.profiles`:
- `avatar_url text`
- `whatsapp_number text` (already exists per `handle_new_user` — verify; add only if missing)
- `locale text` (e.g. `en`, `en-NG`)
- `timezone text` (IANA, e.g. `Africa/Lagos`)

No new tables. Existing RLS on `profiles` already restricts to `auth.uid()`.

**Storage** — create public `avatars` bucket via `supabase--storage_create_bucket`. Add RLS on `storage.objects`:
- Public read for `bucket_id='avatars'`.
- Authenticated insert/update/delete only when the first path segment equals `auth.uid()::text` (so each user owns `avatars/<uid>/...`).

## 2. Frontend

**New route** `/profile` registered in `src/App.tsx` (auth-guarded like `/settings`). Page file: `src/pages/v2/Profile.tsx`, using `NewAppHeader` + `NewFloatingNav` layout (matches v2 pages) with `lg:pl-20`.

**Sections** (single page, card-grouped):
1. **Identity** — avatar uploader (preview, replace, remove), full name, read-only email.
2. **Contact** — WhatsApp number with country-code helper.
3. **Locale** — language select (subset) + timezone select (IANA list via `Intl.supportedValuesOf('timeZone')`).
4. **Security** — change password (current + new + confirm via `supabase.auth.updateUser({ password })`), "Sign out of all sessions" (`supabase.auth.signOut({ scope: 'global' })`).

**Form** — `react-hook-form` + `zod` schema (trim, length caps, E.164-ish phone regex, password ≥ 8 chars). Save persists to `profiles` via Supabase upsert keyed on `user_id`.

**Avatar upload flow** — client picks file (≤2 MB, image/*), uploads to `avatars/<uid>/avatar-<ts>.<ext>`, gets public URL, writes to `profiles.avatar_url`. Old object best-effort deleted.

**Settings link** — add a "Manage profile" row at the top of `src/pages/v2/Settings.tsx` (and legacy `src/pages/Settings.tsx`) that navigates to `/profile`.

**Header avatar** (small) — `NewAppHeader` shows the avatar thumbnail next to credits when `avatar_url` exists; click → `/profile`. Falls back to initials.

## 3. Validation & UX
- Toasts for save success/failure.
- Disabled save button until form is dirty + valid.
- Optimistic avatar preview; revert on upload failure.
- Mobile-first layout, cards stack; matches warm neutral palette tokens.

## 4. Out of scope
- Email change (Supabase requires re-verification flow — flag as future).
- 2FA.
- Deleting account (already covered elsewhere per knowledge base).

## Technical notes
- Files touched/created:
  - new: `src/pages/v2/Profile.tsx`
  - edit: `src/App.tsx`, `src/components/v2/NewAppHeader.tsx`, `src/pages/v2/Settings.tsx`, `src/pages/Settings.tsx`
  - migration: `profiles` columns + `storage.objects` policies
  - storage tool: create `avatars` bucket (public)
