ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;

CREATE OR REPLACE FUNCTION public.validate_campaign_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.priority IS NULL OR NEW.priority < 1 OR NEW.priority > 3 THEN
    NEW.priority := 2;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campaign_priority ON public.campaigns;
CREATE TRIGGER trg_validate_campaign_priority
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_priority();