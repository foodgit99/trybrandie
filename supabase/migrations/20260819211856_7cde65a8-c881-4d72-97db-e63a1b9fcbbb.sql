REVOKE EXECUTE ON FUNCTION public.activate_campaign_page(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_campaign_pages() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_campaign_public() FROM anon, authenticated;