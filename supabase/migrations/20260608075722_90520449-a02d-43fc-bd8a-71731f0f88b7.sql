
-- Fix infinite recursion between brands and brand_team_members policies
-- by routing the cross-table checks through SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.is_brand_owner(_brand_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = _brand_id AND b.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_brand_member(_brand_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brand_team_members m
    WHERE m.brand_id = _brand_id
      AND m.user_id = _user_id
      AND m.status = 'active'
  );
$$;

-- Replace the recursive policies

DROP POLICY IF EXISTS "Team members can view their brands" ON public.brands;
CREATE POLICY "Team members can view their brands"
ON public.brands
FOR SELECT
TO authenticated
USING (public.is_active_brand_member(id, auth.uid()));

DROP POLICY IF EXISTS "Brand owners manage memberships" ON public.brand_team_members;
CREATE POLICY "Brand owners manage memberships"
ON public.brand_team_members
FOR ALL
TO authenticated
USING (public.is_brand_owner(brand_id, auth.uid()))
WITH CHECK (public.is_brand_owner(brand_id, auth.uid()));
