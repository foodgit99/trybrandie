# Affiliate menu entry, admin entry stays admin-only

## What I found

- The "Admin Panel" item in the account menu (`src/components/v2/NewAppHeader.tsx`) is already gated by the `has_role(uid, 'admin')` check, and `/admin` itself is guarded by `AdminRoute`, which redirects non-admins home.
- In the database, exactly one account holds the `admin` role, and that same account also has an affiliate row (`webjobz110@gmail.com`). The other two affiliate accounts have no roles at all. So the Admin entry appears for that one account because it genuinely is an admin, not because affiliates bypass the gate.
- There is no "Affiliate Dashboard" entry anywhere in the menu, so affiliates have no way to reach `/affiliate` from the app shell. That is the real gap.

## What I'll build

1. **Affiliate role hook** — a small hook that looks up the signed-in user's own row in `affiliates` (self-select is already permitted by RLS) and reports whether they are an approved affiliate.
2. **Affiliate Dashboard menu item** — added to the account dropdown, shown only to approved affiliates, navigating to `/affiliate`. Placed in the same group as the Partner Dashboard entry.
3. **Admin entry unchanged** — remains admin-role-only. If you also want that one account's admin role removed so it behaves purely as an affiliate, say so and I'll revoke it; I won't touch roles otherwise.

## Technical notes

- New file: `src/hooks/useAffiliateRole.ts`, using react-query like `usePartnerRole` (same 5-minute stale time), selecting `id, status` from `affiliates` filtered on `user_id`, `maybeSingle`.
- `NewAppHeader.tsx`: consume the hook and render an `Affiliate Dashboard` `DropdownMenuItem` (Users/Handshake-style icon) when `isAffiliate`, above the Partner/Admin block.
- No schema or policy changes, no backend function changes.
