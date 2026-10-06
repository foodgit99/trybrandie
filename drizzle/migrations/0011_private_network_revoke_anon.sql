DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'private\_network\_%' AND c.relkind='r' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.private_network_platform_family(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.private_network_licence_covers_platform(text[], text) FROM PUBLIC, anon;