ALTER TABLE public.campaigns_public
  ADD COLUMN IF NOT EXISTS partner_campaign_id uuid REFERENCES public.partner_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_public_partner_campaign
  ON public.campaigns_public (partner_campaign_id);