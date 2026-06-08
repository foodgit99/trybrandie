## What is causing the error

The current error is **not the pricing model update itself**.

The live backend now shows the real blocker:

`infinite recursion detected in policy for relation "brands"`

This happens because two access rules reference each other:

```text
brands policy
  checks brand_team_members
    brand_team_members policy
      checks brands
        brands policy runs again
          loop forever
```

So existing users are logged in, but when the app tries to load their brand, the database cannot finish evaluating access rules and returns this recursion error. The app then shows “Couldn't load your brand”.

## Fix plan

1. **Break the recursive policy chain**
   - Add safe backend helper functions that check:
     - whether a user owns a brand
     - whether a user is an active team member of a brand
   - These helpers will run as trusted backend functions so the checks do not trigger RLS again.

2. **Replace the broken policies**
   - Update the `brands` team-member view policy so it uses the helper instead of directly querying `brand_team_members`.
   - Update the `brand_team_members` owner-management policy so it uses the helper instead of directly querying `brands`.

3. **Keep existing access behavior intact**
   - Brand owners can still access their brands.
   - Active team members can still view brands they belong to.
   - Admin/service-role policies remain unchanged.
   - RLS stays enabled; this is not a security bypass for users.

4. **Validate after the migration**
   - Re-check the live policies to confirm there is no direct `brands` ↔ `brand_team_members` recursion.
   - Confirm the reported error no longer appears in backend logs.
   - Existing completed users should load their brand and reach the main app instead of `/onboarding`.

## Technical details

The migration will likely:

```sql
create or replace function public.is_brand_owner(...)
returns boolean
security definer
...

create or replace function public.is_active_brand_member(...)
returns boolean
security definer
...

drop policy "Team members can view their brands" on public.brands;
create policy "Team members can view their brands"
on public.brands
for select
to authenticated
using (public.is_active_brand_member(id, auth.uid()));

drop policy "Brand owners manage memberships" on public.brand_team_members;
create policy "Brand owners manage memberships"
on public.brand_team_members
for all
to authenticated
using (public.is_brand_owner(brand_id, auth.uid()))
with check (public.is_brand_owner(brand_id, auth.uid()));
```

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>