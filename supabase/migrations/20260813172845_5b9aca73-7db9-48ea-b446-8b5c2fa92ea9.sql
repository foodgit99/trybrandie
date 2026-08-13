CREATE OR REPLACE FUNCTION public.validate_campaign_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_assigned integer;
BEGIN
  -- Priority guardrail (1 = low, 2 = normal, 3 = high)
  IF NEW.priority IS NULL OR NEW.priority < 1 OR NEW.priority > 3 THEN
    NEW.priority := 2;
  END IF;

  -- Quota guardrail: whole number clamped into [1, 30]
  IF NEW.post_count IS NULL THEN
    NEW.post_count := 1;
  END IF;
  NEW.post_count := LEAST(30, GREATEST(1, NEW.post_count));

  -- Quota can never drop below the number of posts already assigned
  IF TG_OP = 'UPDATE' THEN
    SELECT count(*) INTO v_assigned
    FROM public.content_ideas
    WHERE campaign_id = NEW.id;

    IF v_assigned > NEW.post_count THEN
      RAISE EXCEPTION 'CAMPAIGN_QUOTA_BELOW_ASSIGNED: % posts are already assigned to this campaign', v_assigned
        USING HINT = 'Unassign posts first or set the quota to at least the assigned count.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;