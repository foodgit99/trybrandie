

## Plan: Rewards Tab in Admin Panel

### Goal
Add a dedicated "Rewards" tab to the Admin page where admins can manage all credit rewards in one place — view history, edit, delete, and grant rewards to multiple users (or all) at once.

### UI — New `RewardsTab` component in `src/pages/Admin.tsx`

**Tab placement**: Add "Rewards" as a new tab alongside the existing Admin tabs (Users, Brands, Designs, Affiliates, Campaigns, Traces, etc.).

**Section 1 — Stats header**
- Total rewards granted (all time)
- Total credits outstanding (sum of `remaining` where `expires_at > now()`)
- Total credits expired/unused
- Active recipients count

**Section 2 — Grant Rewards (bulk-capable)**
A "Grant Rewards" button opens a dialog with:
- **Recipient selection mode** (radio):
  - Specific users — searchable multi-select list (search by name/email/referral code)
  - All users on a tier — checkboxes for Free, Entrepreneur, Creator, Agency
  - All users — single confirmation checkbox
- **Amount** (number input, min 1)
- **Reason** (text input)
- **Expires in** (dropdown: 7, 14, 30, 60, 90 days, or custom date picker)
- Live count: "This will grant X credits to Y users"
- Submit triggers the new `bulk_grant_reward` operation

**Section 3 — Rewards table**
Columns: Recipient (name/email), Amount, Remaining, Reason, Granted by, Granted on, Expires (with countdown badge — green/amber/red/expired), Status, Actions
- Filters: status (active / expired / depleted), search by user, sort by date/expiry
- Pagination (50/page)
- Row actions: Edit, Delete

**Section 4 — Edit dialog**
- Edit `amount` (adjusts `remaining` proportionally if not yet consumed), `reason`, `expires_at`
- Cannot reduce `remaining` below 0

**Section 5 — Delete confirmation**
- AlertDialog confirming deletion (irreversibly removes the reward; if `remaining < amount`, warns that consumed credits are not refunded)

### Backend — `supabase/functions/admin-action/index.ts`

Add 3 new operations:

1. **`bulk_grant_reward`** — accepts `{ recipients: 'specific'|'tier'|'all', user_ids?: string[], tiers?: string[], amount, reason, expires_in_days }`. Resolves the recipient list, then bulk-inserts into `credit_rewards`. Returns `{ granted: number, user_count: number }`.

2. **`update_reward`** — accepts `{ id, amount?, reason?, expires_at? }`. Updates the row, recalculating `remaining` if amount changes and credits haven't been consumed yet.

3. **`reward_stats`** — returns aggregate stats for the header section.

The existing `list` operation already supports `credit_rewards` (it's in `ALLOWED_TABLES`), so listing/filtering reuses that. Same for `delete`.

### Files to edit
- `src/pages/Admin.tsx` — add Rewards tab + RewardsTab component (or split into `src/components/admin/RewardsTab.tsx` for cleanliness)
- `supabase/functions/admin-action/index.ts` — add `bulk_grant_reward`, `update_reward`, `reward_stats` operations

### Notes
- No DB migration needed — the `credit_rewards` table already supports all required fields
- Bulk grants insert one row per user (preserves per-user expiry tracking and remaining balance)
- The existing user-detail "Grant Reward Credits" dialog stays as a quick shortcut

