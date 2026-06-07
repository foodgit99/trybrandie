## Goal

Activate the two remaining headline features for paid tiers:

- **Team Access** (Creator + Agency): brand owner invites teammates by email; teammates accept via magic link, then see the brand in their BrandSwitcher and can read/edit it.
- **Client Folders** (Agency only): organise brands into named, colour-coded folders that group the BrandSwitcher and the `/brands` page.

Tables `brand_team_members` and `client_folders` already exist; this plan wires them end-to-end.

---

## Part 1 — Team Access

### 1.1 Brand-data RLS update (migration)

Today most brand-scoped tables (`designs`, `content_ideas`, `content_pillars`, `campaigns`, `brand_products`, `brand_inspiration`, `brand_updates`, `brand_trend_preferences`, `autopilot_settings`, `design_jobs`) restrict access via `brands.user_id = auth.uid()`. Active team members can't read or write them.

Add a parallel SELECT/INSERT/UPDATE/DELETE policy on each of those tables using the existing `public.has_brand_access(brand_id, auth.uid())` security-definer function so any `active` member gets the same access as the owner. Original owner policies stay untouched.

For `brands` itself: add a `Team members can view their brands` SELECT policy using `has_brand_access`. Owners keep their full CRUD.

### 1.2 `useBrand` includes member brands

Switch the brand fetch from `eq("user_id", user.id)` to a union: owned brands plus brands where the user is an `active` row in `brand_team_members`. Simplest: two queries merged client-side, de-duped by id, tagged with `__role: 'owner' | 'member'` for UI badges.

### 1.3 Invite UI (Brand Centre → Team tab)

New `TeamMembersPanel` component lives inside Brand Centre. Shows:
- Plan-gate: if `useSubscription().features.team === false`, render an upgrade CTA pointing to `/pricing`.
- List of current members (`brand_team_members` for active brand) with status badge (`pending`/`active`/`revoked`), role (`editor`/`viewer`), invited-at, and a "Revoke" action.
- Inline form: email + role select → INSERTs a row with `status='pending'`, `invited_by=auth.uid()`, auto-generated `invite_token`.
- After INSERT, calls `send-email` with new template `team_invite` → CTA opens `/invite/:token`.

### 1.4 New edge function: `team-invite-accept`

POST `{ token }`. Service-role client:
1. Reads `brand_team_members` row by `invite_token`, returns 404 if missing/revoked.
2. Validates the requesting JWT (`getUser` on the Authorization bearer). Required — invites are not anonymous.
3. If the row's `email` doesn't match `auth.users.email`, returns 409 `email_mismatch`.
4. Updates the row: `user_id = auth.uid()`, `status = 'active'`, `accepted_at = now()`, blanks `invite_token`.
5. Returns `{ brand_id, brand_name }` so the frontend can redirect to `/cockpit` with that brand active.

### 1.5 New route: `/invite/:token`

`AcceptInvite.tsx` page:
- If user not signed in → redirect to `/auth?redirect=/invite/:token`.
- If signed in → calls `team-invite-accept`. Renders states: loading, success (auto-set active brand + redirect), `email_mismatch` (show signed-in email vs invited email, prompt sign-out), `not_found` (link expired).

### 1.6 Email template

Add `team_invite` case to `send-email` with the existing subscription-shell pattern. CTA → `${APP_URL}/invite/:token`. Inputs: `brand_name`, `inviter_name`, `token`.

---

## Part 2 — Client Folders (Agency)

### 2.1 No schema change needed

`client_folders` and `brands.client_folder_id` already exist. Just need UI gated by `useSubscription().features.client_folders === true`.

### 2.2 Folder CRUD on `/brands`

Extend the existing `Brands.tsx` page with a left rail (desktop) / segmented chips (mobile) listing folders + "All brands" + "Unassigned". Add `+ New folder` action → modal with name + colour swatch. Edit/delete via row menu.

Each brand card gets a folder badge (coloured dot + name) and a "Move to folder" item in its row menu.

### 2.3 BrandSwitcher grouping

When the user has > 1 folder, group the dropdown by folder name with the folder colour as a leading dot. Brands without `client_folder_id` show under "Unfiled". When client_folders is disabled (Creator/Free), render the flat list as today.

### 2.4 Non-Agency safeguard

Even though `client_folders` policy is owner-only, the UI hides folder controls and folder badges for Creator/Free/Entrepreneur. They simply don't see the feature.

---

## Technical Details

### Files

**New**
- `src/components/team/TeamMembersPanel.tsx`
- `src/pages/AcceptInvite.tsx`
- `src/components/brands/FolderManager.tsx` (CRUD modal + rail)
- `supabase/functions/team-invite-accept/index.ts`
- migration: brand-data RLS additions + brands SELECT for members

**Edited**
- `src/hooks/useBrand.tsx` — owned + member brands union
- `src/components/BrandSwitcher.tsx` — folder grouping + member badge
- `src/pages/Brands.tsx` — folder rail + move-to-folder + badges
- `src/pages/BrandCentre.tsx` (and/or `src/pages/v2/BrandCentre.tsx`) — add Team tab hosting `TeamMembersPanel`
- `src/App.tsx` — register `/invite/:token`
- `supabase/functions/send-email/index.ts` — `team_invite` case

### Invite-email CTA routing

`team_invite` CTA → `${APP_URL}/invite/{token}`. Already-signed-in users land on the accept page; signed-out users get bounced through `/auth?redirect=...` then back.

### Role enforcement (V1)

`editor` and `viewer` both get full read access via RLS. We **do not** enforce viewer-only at the DB layer in V1 — too many tables to gate. Instead, the frontend hides edit/destructive controls when `member.role === 'viewer'`. Documented as a known V1 limitation; tightening is a follow-up.

### Subscription gates

`TeamMembersPanel` and Folder UI both read `useSubscription().features`. Gating is presentational; the brand-limit trigger on `brands` already blocks downgraded users from adding brands.

### Out of scope (V1)

- Per-row viewer-only enforcement at the DB layer.
- Bulk invite, CSV import.
- Folder sharing between agency teammates.
- Drag-and-drop folder reordering.
- Email notifications when a member is revoked.

---

## Migration order

1. RLS additions (member access on brand-scoped tables + brands SELECT).
2. `team-invite-accept` edge function + `team_invite` email template (deploy together).
3. Frontend: `useBrand` union → BrandSwitcher → TeamMembersPanel → AcceptInvite → Folder UI.

After approval I'll run the migration first, then deploy functions, then ship the UI.
