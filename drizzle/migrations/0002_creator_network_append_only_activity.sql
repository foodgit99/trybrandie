-- Activity log is append-only and attributable: no UPDATE/DELETE for anyone via the API,
-- and human inserts must be stamped with the caller's own id.
DROP POLICY IF EXISTS "cn update" ON public.creator_network_activity_log;
DROP POLICY IF EXISTS "cn delete" ON public.creator_network_activity_log;
DROP POLICY IF EXISTS "cn insert" ON public.creator_network_activity_log;
CREATE POLICY "cn insert own" ON public.creator_network_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.creator_network_can(NULL) AND actor_id = auth.uid());
REVOKE UPDATE, DELETE ON public.creator_network_activity_log FROM authenticated;