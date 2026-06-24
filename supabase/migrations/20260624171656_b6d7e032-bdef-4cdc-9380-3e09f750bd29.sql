-- 1. Campaigns: allow optional description
ALTER TABLE public.campaigns ALTER COLUMN description DROP NOT NULL;
ALTER TABLE public.campaigns ALTER COLUMN description SET DEFAULT '';

-- 2. Content ideas: per-post funnel stage override
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS funnel_stage TEXT;
COMMENT ON COLUMN public.content_ideas.funnel_stage IS 'Optional override for funnel bucket. When NULL, the bucket is derived from content_category. Allowed values: awareness | consideration | conversion | retention.';

-- 3. Brands: per-brand funnel stage rename/blurb (array of {id,label,blurb})
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS funnel_stages JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.brands.funnel_stages IS 'Per-brand overrides for the 4 funnel stages. Array of {id,label,blurb}. Empty array means use defaults.';