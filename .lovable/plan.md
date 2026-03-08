

## Plan: Super Admin Page with Full CRUD

### Approach
Create a dedicated `/admin` page that provides full CRUD management for all app data tables, secured by a `user_roles` table with server-side role checking. Mobile-first, tab-based UI with Apple-inspired design.

### 1. Database Changes (1 migration)

**Create admin role system:**
- `app_role` enum: `admin`, `moderator`, `user`
- `user_roles` table: `id`, `user_id` (FK auth.users), `role` (app_role), unique(user_id, role)
- `has_role()` security definer function
- RLS on `user_roles`: admins can read all, users can read own

**Add SELECT policies for admin on all tables:**
- `profiles`, `brands`, `designs`, `design_messages`, `affiliates`, `affiliate_referrals`, `affiliate_commissions`, `affiliate_payouts`, `target_audiences`, `referral_rewards`, `brand_trend_preferences`, `brand_inspiration`, `design_folders`, `design_folder_assignments`
- Admin gets SELECT, UPDATE, DELETE on all tables via `has_role(auth.uid(), 'admin')`

**Seed your admin role** (manual step — you'll need to insert your user_id into `user_roles`)

### 2. Backend: Admin Edge Function

**New `supabase/functions/admin-action/index.ts`**
- Verifies caller has admin role using service role key
- Supports operations: `list`, `get`, `update`, `delete`, `insert` on any public table
- Pagination support (offset, limit)
- Returns row counts for dashboard stats

### 3. Frontend: Admin Page

**New `src/pages/Admin.tsx`**
- Mobile-optimized tab interface with horizontal scrollable tabs for each table
- Tables managed: Users/Profiles, Brands, Designs, Affiliates, Referrals, Commissions, Payouts, Audiences
- Each tab shows:
  - Search/filter bar
  - Responsive card-list on mobile (not table rows)
  - Tap to expand/edit inline
  - Delete with confirmation dialog
  - Add new record button
- Dashboard overview tab with key stats (total users, designs, affiliates, revenue)
- Edit modal/sheet (vaul drawer on mobile) with auto-generated form fields per table

**New `src/hooks/useAdminRole.tsx`**
- Checks if current user has admin role
- Returns `{ isAdmin, loading }`

### 4. Routing

- Add `/admin` route in `App.tsx`, wrapped in a new `AdminRoute` guard that checks `useAdminRole`
- Add Admin link in AppHeader dropdown (only visible to admins)

### Files Changed

| File | Change |
|---|---|
| SQL migration | Create `user_roles` table, `has_role()` fn, admin RLS policies on all tables |
| `supabase/functions/admin-action/index.ts` | New — edge function for admin CRUD |
| `src/pages/Admin.tsx` | New — full admin dashboard |
| `src/hooks/useAdminRole.tsx` | New — admin role check hook |
| `src/App.tsx` | Add `/admin` route with AdminRoute guard |
| `src/components/AppHeader.tsx` | Show Admin link for admins |

