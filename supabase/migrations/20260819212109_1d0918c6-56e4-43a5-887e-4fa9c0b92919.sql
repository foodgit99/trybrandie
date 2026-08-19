DROP FUNCTION IF EXISTS public.get_active_campaign_page();

CREATE OR REPLACE FUNCTION public.get_active_campaign_page()
RETURNS TABLE(id uuid, name text, slug text, offer_text text, ends_at timestamptz, partner_slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.name, c.slug, c.offer_text, c.ends_at, p.slug AS partner_slug
  FROM public.campaigns_public c
  LEFT JOIN public.partner_profiles p ON p.id = c.partner_id
  WHERE c.status = 'active'
    AND c.starts_at <= now()
    AND (c.ends_at IS NULL OR c.ends_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_campaign_page() TO anon, authenticated;