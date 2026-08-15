CREATE TABLE public.email_sender_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  from_name text NOT NULL,
  reply_to text,
  reply_to_verified_at timestamp with time zone,
  reply_to_token text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_sender_aliases_status_check CHECK (status IN ('pending','approved','rejected','revoked'))
);

GRANT SELECT, INSERT ON public.email_sender_aliases TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.email_sender_aliases TO authenticated;
GRANT ALL ON public.email_sender_aliases TO service_role;

ALTER TABLE public.email_sender_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view and create their own aliases"
  ON public.email_sender_aliases
  FOR SELECT
  TO authenticated
  USING (public.has_brand_access(brand_id, auth.uid()));

CREATE POLICY "Brand owners can create alias requests"
  ON public.email_sender_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update alias status"
  ON public.email_sender_aliases
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete alias rows"
  ON public.email_sender_aliases
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX email_sender_aliases_handle_lower_idx
  ON public.email_sender_aliases (lower(handle));

CREATE UNIQUE INDEX email_sender_aliases_active_per_brand_idx
  ON public.email_sender_aliases (brand_id)
  WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.validate_email_alias()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  reserved text[] := ARRAY['admin','support','billing','noreply','postmaster','abuse','news','hello','security','info','no-reply','mail','hostmaster','webmaster','www','api','app','brandie','trybrandie','team','sales','marketing','careers','jobs','press','media','legal','dmarc','smtp','mx','autodiscover','autoconfig','ftp','imap','pop','pop3','exchange','owa','remote','vpn','secure','ssl','tls','mx1','mx2','mail1','mail2','smtp1','smtp2','email','emails','e-mail','messages','message','msg','message','contact','contacts','inquiry','enquiries','feedback','help','service','services','orders','order','payments','payment','invoice','invoices','receipt','receipts','transactions','billing','accounts','account','members','member','users','user','customers','customer','clients','client','partners','partner','vendors','vendor','affiliates','affiliate','subscribers','subscriber','list','lists','newsletter','newsletters','campaign','campaigns','broadcast','broadcasts','promo','promotions','promotion','offers','offer','deals','deal','shop','store','catalog','catalogue','products','product','merchandise','buy','purchase','checkout','cart','order','orders','shipping','delivery','track','tracking','returns','return','refund','refunds','exchange','exchanges','warranty','support','helpdesk','help-desk','service','services','desk','tickets','ticket','chat','live','livechat','live-chat','bot','agent','agents','operator','operators','csr','cs','customer-success','success'];
BEGIN
  -- normalize
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

  -- ensure one pending/approved per brand per user? Actually allow one active per brand; also don't allow multiple pending requests for same brand? We'll allow only one non-rejected row per brand to keep it simple.
  IF EXISTS (
    SELECT 1 FROM public.email_sender_aliases
    WHERE brand_id = NEW.brand_id
      AND status IN ('pending','approved')
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'ALIAS_ALREADY_REQUESTED' USING HINT = 'This brand already has a pending or approved alias.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_sender_aliases_validate
  BEFORE INSERT OR UPDATE ON public.email_sender_aliases
  FOR EACH ROW EXECUTE FUNCTION public.validate_email_alias();

CREATE TRIGGER trg_email_sender_aliases_updated_at
  BEFORE UPDATE ON public.email_sender_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
