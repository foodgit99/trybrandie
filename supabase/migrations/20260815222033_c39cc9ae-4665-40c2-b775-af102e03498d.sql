ALTER TABLE public.email_sender_aliases
  ADD COLUMN partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  ALTER COLUMN brand_id DROP NOT NULL;

ALTER TABLE public.email_sender_aliases
  ADD CONSTRAINT email_sender_aliases_owner_chk
  CHECK ((brand_id IS NOT NULL AND partner_id IS NULL) OR (brand_id IS NULL AND partner_id IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS email_sender_aliases_handle_active_idx
  ON public.email_sender_aliases (lower(handle))
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS email_sender_aliases_partner_idx
  ON public.email_sender_aliases (partner_id);

CREATE POLICY "Partners can view their own aliases"
ON public.email_sender_aliases
FOR SELECT
TO authenticated
USING (partner_id IS NOT NULL AND partner_id = public.partner_id_for_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_email_alias()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  reserved text[] := ARRAY['admin','support','billing','noreply','postmaster','abuse','news','hello','security','info','no-reply','mail','hostmaster','webmaster','www','api','app','brandie','trybrandie','team','sales','marketing','careers','jobs','press','media','legal','dmarc','smtp','mx','autodiscover','autoconfig','ftp','imap','pop','pop3','exchange','owa','remote','vpn','secure','ssl','tls','mx1','mx2','mail1','mail2','smtp1','smtp2','email','emails','e-mail','messages','message','msg','contact','contacts','inquiry','enquiries','feedback','help','service','services','orders','order','payments','payment','invoice','invoices','receipt','receipts','transactions','accounts','account','members','member','users','user','customers','customer','clients','client','partners','partner','vendors','vendor','affiliates','affiliate','subscribers','subscriber','list','lists','newsletter','newsletters','campaign','campaigns','broadcast','broadcasts','promo','promotions','promotion','offers','offer','deals','deal','shop','store','catalog','catalogue','products','product','merchandise','buy','purchase','checkout','cart','shipping','delivery','track','tracking','returns','return','refund','refunds','exchanges','warranty','helpdesk','help-desk','desk','tickets','ticket','chat','live','livechat','live-chat','bot','agent','agents','operator','operators','csr','cs','customer-success','success'];
BEGIN
  NEW.handle = lower(trim(both from NEW.handle));

  IF NEW.handle IS NULL OR char_length(NEW.handle) < 3 OR char_length(NEW.handle) > 30 THEN
    RAISE EXCEPTION 'ALIAS_HANDLE_INVALID_LENGTH' USING HINT = 'Handle must be 3–30 characters.';
  END IF;

  IF NEW.handle !~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$' THEN
    RAISE EXCEPTION 'ALIAS_HANDLE_INVALID_FORMAT' USING HINT = 'Handle can only contain lowercase letters, numbers, dots, and hyphens, and must start/end with a letter or number.';
  END IF;

  IF NEW.handle ~ '(\.\.|--|-\.|\.\-)' THEN
    RAISE EXCEPTION 'ALIAS_HANDLE_CONSECUTIVE_SEPARATORS' USING HINT = 'Handle cannot contain consecutive dots, hyphens, or separators.';
  END IF;

  IF NEW.handle = ANY(reserved) THEN
    RAISE EXCEPTION 'ALIAS_HANDLE_RESERVED' USING HINT = 'That handle is reserved for system use.';
  END IF;

  -- One pending/approved alias per brand, or per partner
  IF NEW.brand_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.email_sender_aliases
    WHERE brand_id = NEW.brand_id
      AND status IN ('pending','approved')
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'ALIAS_ALREADY_REQUESTED' USING HINT = 'This brand already has a pending or approved alias.';
  END IF;

  IF NEW.partner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.email_sender_aliases
    WHERE partner_id = NEW.partner_id
      AND status IN ('pending','approved')
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'ALIAS_ALREADY_REQUESTED' USING HINT = 'This partner already has a pending or approved alias.';
  END IF;

  RETURN NEW;
END;
$function$;