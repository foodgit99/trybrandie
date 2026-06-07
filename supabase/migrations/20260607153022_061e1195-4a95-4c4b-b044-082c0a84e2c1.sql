
REVOKE EXECUTE ON FUNCTION public.has_brand_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_brand_access(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enforce_brand_limit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_brand_limit() TO authenticated, service_role;
