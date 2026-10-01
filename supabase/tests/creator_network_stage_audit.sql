-- Regression: each opportunity stage transition writes exactly ONE audit row with
-- previous_stage, new_stage, reason, actor and timestamp. Run as an admin session; rolls back.
-- Usage: run inside a transaction with request.jwt.claims set to an admin user, role authenticated.
do $$
declare o uuid; n int; r record;
begin
  select id into o from public.creator_network_opportunities where is_test and stage not in ('Lost','Fulfilled') limit 1;
  if o is null then raise exception 'SKIP: no open TEST opportunity'; end if;
  perform public.creator_network_transition_opportunity(o, 'Lost', 'regression test');
  select count(*) into n from public.creator_network_activity_log
   where entity_id = o and created_at = now() and new_state = 'Lost';
  if n <> 1 then raise exception 'FAIL: expected 1 audit row, got %', n; end if;
  select * into r from public.creator_network_activity_log where entity_id = o and created_at = now() and new_state = 'Lost';
  if r.previous_state is null or r.actor_id is null or r.reason is distinct from 'regression test' or r.created_at is null then
    raise exception 'FAIL: incomplete audit row %', row_to_json(r);
  end if;
  raise exception 'PASS (rolled back)';
end $$;
