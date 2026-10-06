-- Private Network V1 end-to-end server test. Runs entirely inside one transaction and
-- ends with RAISE EXCEPTION so EVERYTHING (including the temporary flag ON) is rolled back.
-- Run via the database tool as one DO block (pg_temp.as_user may be inlined as set_config('request.jwt.claims', ...)).
-- Output: the exception message contains PASS/FAIL lines. Fixtures are TEST-only and fake user ids.
CREATE OR REPLACE FUNCTION pg_temp.as_user(_u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', _u, 'role', 'authenticated')::text, true);
  SELECT set_config('request.jwt.claim.sub', _u::text, true);
$$;

DO $$
DECLARE
  admin uuid := '967a088c-6d77-4369-abb0-fb9e98e0d4d6';
  owner uuid := '7b28f0b2-bc0b-4539-91f8-6f27836534f9';
  brand uuid := 'ce9ba1da-ee14-4a01-8256-4b74e7ee8e5f';
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); ud uuid := gen_random_uuid(); ord uuid := gen_random_uuid();
  pa uuid; pb uuid; pc uuid; pd uuid; camp uuid; cr_up uuid; cr_cn uuid; cr_prev uuid; r jsonb; r2 jsonb; tok text; tokb text; plc uuid; plb uuid; n int; t text;
  res text[] := '{}'; khash text := encode(sha256(convert_to('pnk_TEST_ONLY','UTF8')),'hex'); kid uuid; ev uuid; cr_mix uuid; ok boolean; v numeric; prof jsonb;
BEGIN
  -- 0. flag OFF blocks mutations
  PERFORM pg_temp.as_user(ua);
  BEGIN PERFORM public.private_network_save_profile('{}'); res := res || 'FAIL off-mutation allowed'::text; EXCEPTION WHEN OTHERS THEN res := res || ('PASS flag OFF blocks save_profile: ' || SQLERRM); END;
  UPDATE public.private_network_settings SET enabled = true WHERE id;

  prof := '{"display_name":"TEST Pub","occupation":"Trader","location_country":"Nigeria","location_city":"Lagos","age_bracket":"25-34","languages":["English","Yoruba"],"interests":["fashion"],"communities":["market traders"],"industries":["retail"],"platforms":["whatsapp_status","instagram"],"audience_size_estimate":"500","audience_geographies":["Lagos"],"audience_age_brackets":["25-34"],"payout_details":{"bank_name":"TEST","account_number":"0000000000","account_name":"TEST"}}';
  pa := public.private_network_save_profile(prof);
  PERFORM pg_temp.as_user(ub); pb := public.private_network_save_profile(prof);
  PERFORM pg_temp.as_user(uc); pc := public.private_network_save_profile(prof);
  PERFORM pg_temp.as_user(ud); pd := public.private_network_save_profile(prof);
  UPDATE public.private_network_publishers SET is_test = true, record_source='test' WHERE id IN (pa,pb,pc,pd);
  SELECT count(*) INTO n FROM public.private_network_publishers WHERE id=pa AND languages = ARRAY['English','Yoruba'] AND audience_size_estimate=500 AND status='pending';
  res := res || (CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END || ' profile save/readback pending');
  PERFORM pg_temp.as_user(ua);
  BEGIN PERFORM * FROM public.private_network_feed(5,0,false); res := res || 'FAIL feed before approval'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS unapproved publisher cannot read feed'::text; END;
  BEGIN PERFORM public.private_network_review_publisher(pb,'approve'); res := res || 'FAIL publisher self-approve'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS non-operator cannot approve publishers'::text; END;
  PERFORM pg_temp.as_user(admin);
  PERFORM public.private_network_review_publisher(pa,'approve'); PERFORM public.private_network_review_publisher(pb,'approve');
  PERFORM public.private_network_review_publisher(pc,'approve'); PERFORM public.private_network_review_publisher(pd,'approve');

  -- 1. campaign owner creates TEST draft
  PERFORM pg_temp.as_user(owner);
  BEGIN
    INSERT INTO public.private_network_campaigns (brand_id, owner_user_id, name, landing_url) VALUES (brand, owner, 'TEST bad', 'javascript:alert(1)');
    res := res || 'FAIL unsafe landing accepted'::text;
  EXCEPTION WHEN OTHERS THEN res := res || 'PASS unsafe landing URL rejected'::text; END;
  INSERT INTO public.private_network_campaigns (brand_id, owner_user_id, name, landing_url, status, funding_status, budget_spent_ngn, target_platforms, target_languages, target_geographies,
    base_fee_ngn, action_bonus_ngn, conversion_commission_pct, budget_ngn, per_publisher_cap, is_test, record_source, ends_at, content_category)
  VALUES (brand, owner, 'TEST PN Campaign', 'https://trybrandie.com/pn-test', 'active', 'funded_manual', 999, ARRAY['whatsapp_status','instagram'], ARRAY['English'], ARRAY['Lagos'],
    300, 100, 10, 1000, 1, true, 'test', now() + interval '30 days', 'beauty') RETURNING id INTO camp;
  SELECT count(*) INTO n FROM public.private_network_campaigns WHERE id=camp AND status='draft' AND funding_status='unfunded' AND budget_spent_ngn=0;
  res := res || (CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END || ' owner insert forced to draft/unfunded (cannot self-fund) ' || camp);
  INSERT INTO public.private_network_creatives (campaign_id, media_type, media_source, storage_path, caption, rights_attested, rights_attestation, status)
  VALUES (camp, 'video', 'upload', brand::text || '/' || camp::text || '/test.mp4', 'TEST caption', true, 'TEST owns', 'approved') RETURNING id INTO cr_up;
  SELECT status INTO t FROM public.private_network_creatives WHERE id=cr_up;
  res := res || (CASE WHEN t='pending' THEN 'PASS' ELSE 'FAIL' END || ' owner cannot self-approve creative');
  BEGIN PERFORM public.private_network_add_cn_creative(camp, '026335f1-a19c-4612-8ff4-31f0a2851826', '3d347602-1975-4d36-bba7-dd46fc89de06', 'x', '{}', NULL, true);
    res := res || 'FAIL owner added CN master'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS owner cannot add Creator Network masters'::text; END;
  BEGIN UPDATE public.private_network_campaigns SET status='active' WHERE id=camp; res := res || 'FAIL direct status edit'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS direct status edit blocked'::text; END;
  r := public.private_network_campaign_transition(camp, 'pending_review');
  BEGIN PERFORM public.private_network_campaign_transition(camp, 'active'); res := res || 'FAIL owner self-activated'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS owner cannot activate'::text; END;

  -- 2. operator review
  PERFORM pg_temp.as_user(admin);
  cr_cn := public.private_network_add_cn_creative(camp, '026335f1-a19c-4612-8ff4-31f0a2851826', '3d347602-1975-4d36-bba7-dd46fc89de06', 'TEST licensed', ARRAY['whatsapp_status','instagram'], NULL, true);
  cr_prev := public.private_network_add_cn_creative(camp, '026335f1-a19c-4612-8ff4-31f0a2851826', 'b47e90a3-3e00-4fed-af32-58a7c6fb4fa3', 'TEST preview', '{}', NULL, true);
  BEGIN PERFORM public.private_network_campaign_transition(camp, 'active'); res := res || 'FAIL activated unfunded'::text; EXCEPTION WHEN OTHERS THEN res := res || ('PASS unfunded activation blocked: ' || SQLERRM); END;
  BEGIN PERFORM public.private_network_record_funding(camp, 'funded_manual', NULL); res := res || 'FAIL funding without ref'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS funding needs reference'::text; END;
  PERFORM public.private_network_record_funding(camp, 'test', 'TEST');
  BEGIN PERFORM public.private_network_campaign_transition(camp, 'active'); res := res || 'FAIL activated without domain'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS unapproved domain blocks activation'::text; END;
  PERFORM public.private_network_allow_domain(brand, 'trybrandie.com', true);
  BEGIN PERFORM public.private_network_campaign_transition(camp, 'active'); res := res || 'FAIL activated without approved creative'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS no approved creative blocks activation'::text; END;
  BEGIN PERFORM public.private_network_review_creative(cr_cn, 'approve', NULL, false); res := res || 'FAIL CN approved w/o explicit rights'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS CN master needs explicit private-redistribution confirmation'::text; END;
  BEGIN PERFORM public.private_network_review_creative(cr_prev, 'approve', NULL, true); res := res || 'FAIL preview licence approved'::text; EXCEPTION WHEN OTHERS THEN res := res || ('PASS preview-only licence ineligible: ' || left(SQLERRM, 90)); END;
  BEGIN PERFORM public.private_network_review_creative(cr_cn, 'approve', NULL, true, NULL); res := res || 'FAIL CN approved without agreement evidence'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS CN approval needs agreement evidence'::text; END;
  -- strict licence rules (all changes rolled back with the transaction)
  UPDATE public.creator_network_licences SET platforms = ARRAY['WhatsApp','Instagram'], territories = ARRAY['Lagos','NG'] WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  BEGIN UPDATE public.creator_network_licences SET licence_scope = NULL WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06'; res := res || 'FAIL blank licence scope stored'::text;
  EXCEPTION WHEN not_null_violation THEN res := res || 'PASS licence scope can never be blank; PN also requires scope = Commercial explicitly'::text; END;
  UPDATE public.creator_network_licences SET licence_scope = 'Commercial', platforms = '{}' WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, 'instagram'), ' ');
  res := res || (CASE WHEN t LIKE '%names no platforms%' THEN 'PASS' ELSE 'FAIL' END || ' licence with no named platforms is denied');
  UPDATE public.creator_network_licences SET platforms = ARRAY['Instagram'] WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, 'whatsapp_status'), ' ');
  res := res || (CASE WHEN t LIKE '%does not cover whatsapp_status%' THEN 'PASS' ELSE 'FAIL' END || ' uncovered platform denied (creator_posted/paid-ads not used as a substitute)');
  UPDATE public.creator_network_licences SET platforms = ARRAY['WhatsApp','Instagram'], territories = '{}' WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, NULL), ' ');
  res := res || (CASE WHEN t LIKE '%names no territories%' THEN 'PASS' ELSE 'FAIL' END || ' licence with no named territories is denied');
  UPDATE public.creator_network_licences SET territories = ARRAY['Lagos','NG'], starts_at = current_date + 3 WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, NULL), ' ');
  res := res || (CASE WHEN t LIKE '%not started%' THEN 'PASS' ELSE 'FAIL' END || ' licence before start date denied');
  UPDATE public.creator_network_licences SET starts_at = current_date - 7, restricted_categories = ARRAY['Beauty'] WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, NULL), ' ');
  res := res || (CASE WHEN t LIKE '%restricted%' THEN 'PASS' ELSE 'FAIL' END || ' restricted category denied');
  UPDATE public.creator_network_licences SET restricted_categories = '{}' WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  PERFORM public.private_network_review_creative(cr_cn, 'approve', NULL, true, 'TEST agreement clause 7.2 private redistribution');
  PERFORM public.private_network_review_creative(cr_up, 'approve');
  PERFORM public.private_network_campaign_transition(camp, 'active');
  res := res || 'PASS operator activated funded TEST campaign'::text;

  -- 3. feed + matching + paging
  PERFORM pg_temp.as_user(ua);
  SELECT count(*) INTO n FROM public.private_network_feed(10,0,false);
  SELECT score || ' ' || array_to_string(reasons, '; ') INTO t FROM public.private_network_feed(1,0,false);
  res := res || (CASE WHEN n=2 THEN 'PASS' ELSE 'FAIL' END || ' feed shows 2 eligible creatives (preview excluded); top: ' || t);
  SELECT count(DISTINCT creative_id) INTO n FROM (SELECT creative_id FROM public.private_network_feed(1,0,false) UNION ALL SELECT creative_id FROM public.private_network_feed(1,1,false)) x;
  res := res || (CASE WHEN n=2 THEN 'PASS' ELSE 'FAIL' END || ' paging returns distinct items');
  INSERT INTO public.private_network_saves (publisher_id, creative_id) VALUES (pa, cr_up);
  SELECT count(*) INTO n FROM public.private_network_feed(10,0,true);
  res := res || (CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END || ' saved filter');

  -- 4. publish / reservation / idempotency / caps / budget
  r := public.private_network_publish(cr_up, 'whatsapp_status', 'k1'); tok := r->>'token'; plc := (r->>'placement_id')::uuid;
  r2 := public.private_network_publish(cr_up, 'whatsapp_status', 'k1');
  res := res || (CASE WHEN (r2->>'replayed')::boolean AND r2->>'token'=tok THEN 'PASS' ELSE 'FAIL' END || ' publish idempotent replay ' || plc);
  SELECT count(*) INTO n FROM public.private_network_ledger WHERE publisher_id=pa;
  res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' no earnings at publish');
  BEGIN PERFORM public.private_network_publish(cr_cn, 'instagram', 'k2'); res := res || 'FAIL cap exceeded'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS per-publisher cap enforced'::text; END;
  PERFORM pg_temp.as_user(ub);
  BEGIN PERFORM public.private_network_publish(cr_up, 'tiktok', 'x'); res := res || 'FAIL wrong platform'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS platform outside campaign refused'::text; END;
  r := public.private_network_publish(cr_up, 'instagram', 'kb'); plb := (r->>'placement_id')::uuid; tokb := r->>'token';
  PERFORM pg_temp.as_user(uc); r := public.private_network_publish(cr_cn, 'whatsapp_status', 'kc');
  res := res || (CASE WHEN r ? 'token' THEN 'PASS' ELSE 'FAIL' END || ' licensed CN master publishable on covered platform');
  PERFORM pg_temp.as_user(ud);
  BEGIN PERFORM public.private_network_publish(cr_up, 'whatsapp_status', 'kd'); res := res || 'FAIL budget overrun'::text; EXCEPTION WHEN OTHERS THEN res := res || ('PASS exhausted budget refuses reservation: ' || SQLERRM); END;
  SELECT budget_reserved_ngn INTO v FROM public.private_network_campaigns WHERE id=camp;
  res := res || (CASE WHEN v=900 THEN 'PASS' ELSE 'FAIL' END || ' atomic reservation total ' || v);

  -- 5. share initiation + redirect
  PERFORM pg_temp.as_user(ua);
  PERFORM public.private_network_mark_share(plc, 'native_share');
  SELECT status INTO t FROM public.private_network_placements WHERE id=plc;
  res := res || (CASE WHEN t='share_initiated' THEN 'PASS' ELSE 'FAIL' END || ' share sheet -> share_initiated (not verified, no earnings)');
  r := public.private_network_resolve_redirect(tok, 'iphash1', 'ua1');
  r2 := public.private_network_resolve_redirect(tok, 'iphash1', 'ua1');
  res := res || (CASE WHEN (r->>'counted')::boolean AND NOT (r2->>'counted')::boolean AND r->>'url' LIKE 'https://trybrandie.com/pn-test?pn_ref=' || tok THEN 'PASS' ELSE 'FAIL' END || ' redirect to stored destination, click dedup');
  r := public.private_network_resolve_redirect('https://evil.com', 'x', 'y');
  res := res || (CASE WHEN NOT (r->>'ok')::boolean THEN 'PASS' ELSE 'FAIL' END || ' hostile token refused');

  -- 6. events before verification are withheld (trusted server key for this TEST brand)
  INSERT INTO public.private_network_integration_keys (brand_id, label, key_hash, key_hint, created_by, is_test) VALUES (brand, 'TEST key', khash, 'TEST', admin, true) RETURNING id INTO kid;
  r := public.private_network_ingest_event(NULL, khash, tok, 'qualified_action', 'TEST-e0', NULL, NULL);
  res := res || (CASE WHEN r->>'outcome'='withheld_unverified_post' THEN 'PASS' ELSE 'FAIL' END || ' lead before verification earns 0');

  -- 7. proof, rejection, resubmit, verify
  BEGIN PERFORM public.private_network_submit_proof(plc, ub::text || '/x.jpg', NULL, NULL); res := res || 'FAIL foreign proof path'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS proof must be in own folder'::text; END;
  PERFORM public.private_network_submit_proof(plc, ua::text || '/' || plc::text || '/1.jpg', NULL, 'TEST');
  PERFORM pg_temp.as_user(ord);
  BEGIN PERFORM public.private_network_review_proof(plc, 'verify'); res := res || 'FAIL ordinary user verified'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS ordinary user cannot verify proof'::text; END;
  PERFORM pg_temp.as_user(admin);
  BEGIN PERFORM public.private_network_review_proof(plc, 'reject', NULL); res := res || 'FAIL reject w/o reason'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS rejection needs a reason'::text; END;
  PERFORM public.private_network_review_proof(plc, 'reject', 'TEST screenshot blurry');
  PERFORM pg_temp.as_user(ua);
  PERFORM public.private_network_submit_proof(plc, ua::text || '/' || plc::text || '/2.jpg', 'https://instagram.com/p/test', NULL);
  SELECT resubmission_count INTO n FROM public.private_network_placements WHERE id=plc;
  res := res || (CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END || ' resubmission recorded');
  PERFORM pg_temp.as_user(admin);
  PERFORM public.private_network_review_proof(plc, 'verify');
  BEGIN PERFORM public.private_network_review_proof(plc, 'verify'); res := res || 'FAIL double verify'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS double verification refused'::text; END;
  SELECT count(*), sum(amount) INTO n, v FROM public.private_network_ledger WHERE placement_id=plc AND entry_type='base_fee';
  res := res || (CASE WHEN n=1 AND v=300 THEN 'PASS' ELSE 'FAIL' END || ' base fee credited once (pending 300)');

  -- 8. trusted events
  r := public.private_network_ingest_event(NULL, khash, tok, 'qualified_action', 'TEST-e1', NULL, NULL);
  r2 := public.private_network_ingest_event(NULL, khash, tok, 'qualified_action', 'TEST-e1', NULL, NULL);
  res := res || (CASE WHEN r->>'outcome'='earned' AND (r->>'earned')::numeric=100 AND (r2->>'duplicate')::boolean THEN 'PASS' ELSE 'FAIL' END || ' qualified action bonus + replay idempotent');
  r := public.private_network_ingest_event(NULL, khash, tok, 'conversion', 'TEST-e2', 5000, NULL);
  res := res || (CASE WHEN r->>'outcome'='withheld_budget_exhausted' THEN 'PASS' ELSE 'FAIL' END || ' conversion withheld when budget exhausted');
  r := public.private_network_ingest_event(NULL, khash, tok, 'qualified_action', 'TEST-e3', NULL, ua);
  res := res || (CASE WHEN r->>'outcome'='rejected_self_action' THEN 'PASS' ELSE 'FAIL' END || ' self-action rejected');
  BEGIN PERFORM public.private_network_ingest_event(ua, NULL, tok, 'conversion', 'TEST-e4', 100, NULL); res := res || 'FAIL publisher reported own conversion'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS publisher/untrusted caller cannot report events'::text; END;
  PERFORM pg_temp.as_user(uc); PERFORM public.private_network_cancel_placement((SELECT id FROM public.private_network_placements WHERE publisher_id=pc));
  r := public.private_network_ingest_event(NULL, khash, tok, 'conversion', 'TEST-e5', 2000, NULL);
  res := res || (CASE WHEN (r->>'earned')::numeric=200 THEN 'PASS' ELSE 'FAIL' END || ' conversion commission 10% after cancel freed budget');
  SELECT budget_reserved_ngn + budget_spent_ngn INTO v FROM public.private_network_campaigns WHERE id=camp;
  res := res || (CASE WHEN v <= 1000 THEN 'PASS' ELSE 'FAIL' END || ' budget conserved (reserved+spent=' || v || ' <= 1000)');

  -- 9. ledger immutability + payouts
  BEGIN UPDATE public.private_network_ledger SET amount = 99999 WHERE publisher_id=pa; res := res || 'FAIL ledger mutable'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS ledger append-only'::text; END;
  PERFORM pg_temp.as_user(ua);
  BEGIN PERFORM public.private_network_request_payout(100); res := res || 'FAIL payout from pending'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS payout needs available balance'::text; END;
  PERFORM pg_temp.as_user(owner);
  BEGIN PERFORM public.private_network_release_pending(pa); res := res || 'FAIL non-finance release'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS only finance can release'::text; END;
  r := public.private_network_balance(pa);
  res := res || (CASE WHEN r IS NULL THEN 'PASS' ELSE 'FAIL' END || ' non-owner cannot read another publisher balance');
  PERFORM pg_temp.as_user(admin);
  v := public.private_network_release_pending(pa);
  res := res || (CASE WHEN v=600 THEN 'PASS' ELSE 'FAIL' END || ' released ' || v);
  PERFORM pg_temp.as_user(ua);
  BEGIN PERFORM public.private_network_request_payout(1000); res := res || 'FAIL overdraw'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS payout above balance refused'::text; END;
  plb := public.private_network_request_payout(500);
  BEGIN PERFORM public.private_network_request_payout(50); res := res || 'FAIL duplicate payout'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS one open payout at a time'::text; END;
  PERFORM pg_temp.as_user(admin);
  PERFORM public.private_network_review_payout(plb, 'approve');
  BEGIN PERFORM public.private_network_review_payout(plb, 'paid', NULL); res := res || 'FAIL paid w/o ref'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS settlement needs reference'::text; END;
  PERFORM public.private_network_review_payout(plb, 'paid', 'TEST-REF-001');
  BEGIN PERFORM public.private_network_review_payout(plb, 'paid', 'TEST-REF-002'); res := res || 'FAIL double settle'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS payout cannot settle twice'::text; END;
  r := public.private_network_balance(pa);
  res := res || (CASE WHEN (r->>'available')::numeric=100 AND (r->>'paid')::numeric=500 AND (r->>'pending')::numeric=0 THEN 'PASS' ELSE 'FAIL' END || ' balances ' || r::text);

  -- 10. rights revocation/expiry rechecked live
  UPDATE public.creator_network_licences SET revoked = true, revoked_at = now(), revocation_reason = 'TEST revoke' WHERE id='3d347602-1975-4d36-bba7-dd46fc89de06';
  SELECT array_to_string(public.private_network_creative_eligibility(cr_cn, 'whatsapp_status'), ' ') INTO t;
  res := res || (CASE WHEN t LIKE '%revoked%' THEN 'PASS' ELSE 'FAIL' END || ' revoked licence detected live');
  PERFORM pg_temp.as_user(ud);
  BEGIN PERFORM public.private_network_publish(cr_cn, 'instagram', 'kd-rev'); res := res || 'FAIL publish on revoked licence'::text;
  EXCEPTION WHEN OTHERS THEN res := res || (CASE WHEN SQLERRM LIKE '%revoked%' THEN 'PASS' ELSE 'FAIL' END || ' publish refused on revoked licence: ' || left(SQLERRM, 80)); END;
  BEGIN PERFORM public.private_network_publish(cr_up, NULL, 'kd-null'); res := res || 'FAIL publish without platform'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS publish needs a platform'::text; END;
  UPDATE public.creator_network_licences SET revoked = false, revoked_at = NULL, revocation_reason = NULL, expires_at = current_date - 1 WHERE id='3d347602-1975-4d36-bba7-dd46fc89de06';
  SELECT array_to_string(public.private_network_creative_eligibility(cr_cn, 'whatsapp_status'), ' ') INTO t;
  res := res || (CASE WHEN t LIKE '%expired%' THEN 'PASS' ELSE 'FAIL' END || ' expired licence detected live');
  PERFORM pg_temp.as_user(ua);
  SELECT count(*) INTO n FROM public.private_network_feed(10,0,false) WHERE creative_id = cr_cn;
  res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' expired-licence creative removed from feed');
  PERFORM set_config('private_network.rpc', 'on', true); -- simulate a rights-expiry change made by the server
  UPDATE public.private_network_creatives SET rights_expires_at = now() - interval '1 day' WHERE id = cr_up;
  r := public.private_network_resolve_redirect(tok, 'iphash2', 'ua');
  res := res || (CASE WHEN r->>'reason'='rights' THEN 'PASS' ELSE 'FAIL' END || ' redirect stops when rights expire');
  UPDATE public.private_network_creatives SET rights_expires_at = NULL WHERE id = cr_up;
  PERFORM set_config('private_network.rpc', 'off', true);

  -- 11. pause / end
  PERFORM pg_temp.as_user(owner);
  PERFORM public.private_network_campaign_transition(camp, 'paused');
  PERFORM pg_temp.as_user(ud);
  BEGIN PERFORM public.private_network_publish(cr_up, 'instagram', 'kd2'); res := res || 'FAIL publish on paused'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS paused campaign refuses new posts'::text; END;
  PERFORM pg_temp.as_user(owner); PERFORM public.private_network_campaign_transition(camp, 'ended');
  r := public.private_network_resolve_redirect(tok, 'iphash3', 'ua');
  res := res || (CASE WHEN r->>'reason'='ended' THEN 'PASS' ELSE 'FAIL' END || ' ended campaign link unavailable');

  -- 12. RLS as real authenticated role
  PERFORM pg_temp.as_user(ub);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.private_network_publishers; res := res || (CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END || ' publisher B sees only own biodata (' || n || ')');
  SELECT count(*) INTO n FROM public.private_network_ledger WHERE publisher_id = pa; res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' publisher B cannot read A ledger');
  SELECT count(*) INTO n FROM public.private_network_campaigns; res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' publisher B cannot read campaign budgets');
  BEGIN INSERT INTO public.private_network_likes (publisher_id, creative_id) VALUES (pa, cr_up); res := res || 'FAIL cross-publisher like'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS cannot write likes as another publisher'::text; END;
  BEGIN INSERT INTO public.private_network_ledger (publisher_id, entry_type, bucket, amount, idempotency_key) VALUES (pb,'base_fee','available',1e6,'hack'); res := res || 'FAIL self-credit'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS publisher cannot write ledger'::text; END;
  BEGIN PERFORM public.private_network_creative_eligibility(cr_cn, NULL); res := res || 'FAIL publisher can call internal eligibility'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS internal licence check not directly callable'::text; END;
  BEGIN PERFORM public.private_network_review_reasons(cr_cn); res := res || 'FAIL publisher read review reasons'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS publisher cannot read licence review reasons'::text; END;
  BEGIN PERFORM public.private_network_release_reservation(camp, 100); res := res || 'FAIL direct reservation release'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS reservation release not directly callable'::text; END;
  BEGIN PERFORM public.private_network_ingest_event(ub, NULL, tok, 'conversion', 'TEST-x', 1, NULL); res := res || 'FAIL direct ingest'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS event ingest not directly callable by users'::text; END;
  BEGIN PERFORM public.private_network_log('placement', plc, 'forged'); res := res || 'FAIL direct log'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS audit log not directly writable'::text; END;
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.as_user(owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.private_network_publishers; res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' brand owner cannot read publisher biodata');
  SELECT count(*) INTO n FROM public.private_network_campaigns WHERE id = camp; res := res || (CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END || ' brand owner reads own campaign');
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.as_user(ord);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.private_network_campaigns; res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' other tenant cannot read brand A campaigns');
  BEGIN INSERT INTO public.private_network_campaigns (brand_id, owner_user_id, name, landing_url) VALUES (brand, ord, 'x', 'https://a.com'); res := res || 'FAIL cross-tenant campaign'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS cannot create campaign for another brand'::text; END;
  SELECT count(*) INTO n FROM public.creator_network_creators; res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' publisher/ordinary user cannot open Creator Network data');
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN SELECT count(*) INTO n FROM public.private_network_placements; res := res || ('FAIL anon has table access (rows ' || n || ')'); EXCEPTION WHEN insufficient_privilege THEN res := res || 'PASS anonymous has no table privilege on placements'::text; END;
  BEGIN PERFORM public.private_network_feed(1,0,false); res := res || 'FAIL anon feed'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS anonymous cannot call feed'::text; END;
  BEGIN PERFORM public.private_network_resolve_redirect(tok, 'a', 'b'); res := res || 'FAIL anon direct redirect RPC'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS anonymous cannot call redirect RPC directly (edge function only)'::text; END;
  EXECUTE 'RESET ROLE';

  -- 12b. gap-closure: event trust, bindings, cohorts, guards, grants
  PERFORM pg_temp.as_user(admin);
  r := public.private_network_ingest_event(owner, NULL, tok, 'conversion', 'TEST-bu1', 999999, NULL);
  res := res || (CASE WHEN r->>'outcome'='pending_reconciliation' AND (r->>'earned')::numeric=0 AND r->>'trust'='brand_user' THEN 'PASS' ELSE 'FAIL' END || ' brand-user JWT conversion earns 0 until reconciled (' || (r->>'outcome') || ')');
  ev := (r->>'event_id')::uuid;
  PERFORM pg_temp.as_user(owner);
  BEGIN PERFORM public.private_network_reconcile_event(ev, true, NULL, 'self'); res := res || 'FAIL brand user reconciled own event'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS brand user cannot reconcile'::text; END;
  PERFORM pg_temp.as_user(admin);
  BEGIN PERFORM public.private_network_reconcile_event(ev, true, NULL, NULL); res := res || 'FAIL reconcile without note'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS reconciliation needs a source reference'::text; END;
  r := public.private_network_reconcile_event(ev, false, NULL, 'TEST not in order system');
  res := res || (CASE WHEN r->>'outcome'='rejected_reconciliation' THEN 'PASS' ELSE 'FAIL' END || ' finance can reject a forged amount');
  BEGIN PERFORM public.private_network_reconcile_event(ev, true, 10, 'again'); res := res || 'FAIL double reconcile'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS event reconciles once'::text; END;
  BEGIN PERFORM public.private_network_ingest_event(NULL, encode(sha256(convert_to('pnk_wrong','UTF8')),'hex'), tok, 'conversion', 'TEST-k1', 10, NULL); res := res || 'FAIL unknown key accepted'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS unknown integration key refused'::text; END;
  UPDATE public.private_network_integration_keys SET revoked_at = now() WHERE id = kid;
  BEGIN PERFORM public.private_network_ingest_event(NULL, khash, tok, 'conversion', 'TEST-k2', 10, NULL); res := res || 'FAIL revoked key accepted'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS revoked integration key refused'::text; END;
  -- exact licence binding
  UPDATE public.creator_network_licences SET production_job_id = NULL, opportunity_id = NULL WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, 'instagram'), ' ');
  res := res || (CASE WHEN t LIKE '%not bound to this production job%' THEN 'PASS' ELSE 'FAIL' END || ' unbound licence of same creator denied');
  BEGIN PERFORM public.private_network_add_cn_creative(camp, '026335f1-a19c-4612-8ff4-31f0a2851826', '3d347602-1975-4d36-bba7-dd46fc89de06', 'x', ARRAY['instagram'], NULL, true);
    res := res || 'FAIL adapter accepted unrelated licence'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS adapter refuses licence not bound to the job'::text; END;
  UPDATE public.creator_network_licences SET production_job_id = '026335f1-a19c-4612-8ff4-31f0a2851826', opportunity_id = 'c9ad87a0-efe7-4836-8e99-1b3bdc267d04' WHERE id = '3d347602-1975-4d36-bba7-dd46fc89de06';
  -- cohort mixing
  UPDATE public.creator_network_production_jobs SET is_test = false WHERE id = '026335f1-a19c-4612-8ff4-31f0a2851826';
  t := array_to_string(public.private_network_creative_eligibility(cr_cn, 'instagram'), ' ');
  res := res || (CASE WHEN t LIKE '%cannot mix (production job%' THEN 'PASS' ELSE 'FAIL' END || ' live CN job in TEST campaign denied');
  BEGIN PERFORM public.private_network_add_cn_creative(camp, '026335f1-a19c-4612-8ff4-31f0a2851826', '3d347602-1975-4d36-bba7-dd46fc89de06', 'x', ARRAY['instagram'], NULL, true);
    res := res || 'FAIL adapter mixed cohorts'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS adapter refuses mixed test/live cohort'::text; END;
  UPDATE public.creator_network_production_jobs SET is_test = true WHERE id = '026335f1-a19c-4612-8ff4-31f0a2851826';
  UPDATE public.private_network_creatives SET is_test = false WHERE id = cr_up;
  t := array_to_string(public.private_network_creative_eligibility(cr_up, 'instagram'), ' ');
  res := res || (CASE WHEN t LIKE '%cannot mix (creative%' THEN 'PASS' ELSE 'FAIL' END || ' live creative in TEST campaign denied');
  UPDATE public.private_network_creatives SET is_test = true WHERE id = cr_up;
  -- empty campaign platforms
  PERFORM set_config('private_network.rpc','on',true);
  UPDATE public.private_network_campaigns SET target_platforms = '{}' WHERE id = camp;
  t := array_to_string(public.private_network_creative_eligibility(cr_up, NULL), ' ');
  res := res || (CASE WHEN t LIKE '%No platform requested%' THEN 'PASS' ELSE 'FAIL' END || ' campaign without named platforms is ineligible');
  UPDATE public.private_network_campaigns SET target_platforms = ARRAY['whatsapp_status','instagram'] WHERE id = camp;
  PERFORM set_config('private_network.rpc','off',true);
  -- owner write guards
  PERFORM pg_temp.as_user(owner);
  BEGIN UPDATE public.private_network_campaigns SET budget_ngn = 1e9 WHERE id = camp; res := res || 'FAIL owner raised funded budget'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS owner cannot change funded budget'::text; END;
  BEGIN UPDATE public.private_network_campaigns SET budget_spent_ngn = 0 WHERE id = camp; res := res || 'FAIL owner reset spent'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS owner cannot edit spent/reserved counters'::text; END;
  BEGIN UPDATE public.private_network_creatives SET private_redistribution_evidence = 'forged evidence' WHERE id = cr_prev; res := res || 'FAIL owner edited rights evidence'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS owner cannot edit rights approval/evidence'::text; END;
  -- execute grant matrix
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname LIKE 'private_network%' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' anon can execute no PN function (' || n || ')');
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname IN
    ('private_network_ingest_event','private_network_resolve_redirect','private_network_release_reservation','private_network_log','private_network_creative_eligibility',
     'private_network_has_role','private_network_require_enabled','private_network_publish_cohort_ok','private_network_block_mutation','private_network_campaign_guard',
     'private_network_creative_guard','private_network_publish_guard','private_network_validate_platforms','private_network_lower','private_network_licence_covers_platform','private_network_platform_family')
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  res := res || (CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END || ' internal helpers not executable by signed-in users (' || n || ')');

  -- 13. flag OFF again
  UPDATE public.private_network_settings SET enabled = false WHERE id;
  PERFORM pg_temp.as_user(ua);
  BEGIN PERFORM * FROM public.private_network_feed(1,0,false); res := res || 'FAIL feed while off'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS flag OFF blocks feed'::text; END;
  BEGIN PERFORM public.private_network_publish(cr_up, 'instagram', 'off'); res := res || 'FAIL publish while off'::text; EXCEPTION WHEN OTHERS THEN res := res || 'PASS flag OFF blocks publish'::text; END;
  r := public.private_network_resolve_redirect(tok, 'x', 'y');
  res := res || (CASE WHEN r->>'reason'='off' THEN 'PASS' ELSE 'FAIL' END || ' flag OFF disables redirect');

  RAISE EXCEPTION E'PN_E2E_RESULTS (rolled back)\n%', array_to_string(res, E'\n');
END $$;
