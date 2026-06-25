ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS campaign_rationale text,
  ADD COLUMN IF NOT EXISTS funnel_rationale text;