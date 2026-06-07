
-- ============================================================
-- Team Access: allow active team members to read/write brand-scoped data
-- via the existing public.has_brand_access(brand_id, user_id) function.
-- Owner policies are left untouched.
-- ============================================================

-- brands: members can SELECT their assigned brands
DROP POLICY IF EXISTS "Team members can view their brands" ON public.brands;
CREATE POLICY "Team members can view their brands"
  ON public.brands FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_team_members m
      WHERE m.brand_id = brands.id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- Helper macro pattern: per-table member ALL policy
-- designs
DROP POLICY IF EXISTS "Team members can manage brand designs" ON public.designs;
CREATE POLICY "Team members can manage brand designs"
  ON public.designs FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- content_ideas
DROP POLICY IF EXISTS "Team members can manage content ideas" ON public.content_ideas;
CREATE POLICY "Team members can manage content ideas"
  ON public.content_ideas FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- content_pillars
DROP POLICY IF EXISTS "Team members can manage content pillars" ON public.content_pillars;
CREATE POLICY "Team members can manage content pillars"
  ON public.content_pillars FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- campaigns
DROP POLICY IF EXISTS "Team members can manage campaigns" ON public.campaigns;
CREATE POLICY "Team members can manage campaigns"
  ON public.campaigns FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- brand_products
DROP POLICY IF EXISTS "Team members can manage brand products" ON public.brand_products;
CREATE POLICY "Team members can manage brand products"
  ON public.brand_products FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- brand_inspiration
DROP POLICY IF EXISTS "Team members can manage brand inspiration" ON public.brand_inspiration;
CREATE POLICY "Team members can manage brand inspiration"
  ON public.brand_inspiration FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- brand_updates
DROP POLICY IF EXISTS "Team members can manage brand updates" ON public.brand_updates;
CREATE POLICY "Team members can manage brand updates"
  ON public.brand_updates FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- brand_trend_preferences
DROP POLICY IF EXISTS "Team members can manage trend prefs" ON public.brand_trend_preferences;
CREATE POLICY "Team members can manage trend prefs"
  ON public.brand_trend_preferences FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- autopilot_settings
DROP POLICY IF EXISTS "Team members can manage autopilot settings" ON public.autopilot_settings;
CREATE POLICY "Team members can manage autopilot settings"
  ON public.autopilot_settings FOR ALL TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()))
  WITH CHECK (public.has_brand_access(brand_id, auth.uid()));

-- design_jobs (brand_id may be null for unscoped jobs; member access only when brand_id is set)
DROP POLICY IF EXISTS "Team members can view brand design jobs" ON public.design_jobs;
CREATE POLICY "Team members can view brand design jobs"
  ON public.design_jobs FOR SELECT TO authenticated
  USING (brand_id IS NOT NULL AND public.has_brand_access(brand_id, auth.uid()));

-- brand_trend_intel
DROP POLICY IF EXISTS "Team members can view trend intel" ON public.brand_trend_intel;
CREATE POLICY "Team members can view trend intel"
  ON public.brand_trend_intel FOR SELECT TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()));
