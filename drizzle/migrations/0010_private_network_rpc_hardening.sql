CREATE OR REPLACE FUNCTION public.private_network_review_reasons(_creative uuid) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  PERFORM public.private_network_require_enabled();
  SELECT c.brand_id INTO b FROM public.private_network_creatives cr JOIN public.private_network_campaigns c ON c.id = cr.campaign_id WHERE cr.id = _creative;
  IF NOT (public.private_network_is_operator() OR (b IS NOT NULL AND public.has_brand_access(b, auth.uid()))) THEN
    RAISE EXCEPTION 'PN: Not permitted.'; END IF;
  RETURN public.private_network_creative_eligibility(_creative, NULL);
END $$;
REVOKE ALL ON FUNCTION public.private_network_review_reasons(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.private_network_review_reasons(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.private_network_balance(_publisher uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _publisher = public.private_network_my_publisher_id() OR public.private_network_is_operator() OR auth.uid() IS NULL THEN
   (SELECT jsonb_build_object(
    'pending', COALESCE(sum(amount) FILTER (WHERE bucket='pending'),0),
    'available', COALESCE(sum(amount) FILTER (WHERE bucket='available'),0),
    'paid', COALESCE(sum(amount) FILTER (WHERE bucket='paid'),0),
    'reversed', COALESCE(-sum(amount) FILTER (WHERE entry_type='reversal'),0),
    'requested', COALESCE((SELECT sum(amount) FROM public.private_network_payouts WHERE publisher_id=_publisher AND status IN ('requested','approved')),0))
    FROM public.private_network_ledger WHERE publisher_id = _publisher)
  ELSE NULL END
$$;