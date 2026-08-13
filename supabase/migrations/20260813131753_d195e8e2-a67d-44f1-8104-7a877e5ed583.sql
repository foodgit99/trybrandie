ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS design_schema JSONB;
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS design_schema_version INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS structured_design_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.design_schema_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  schema JSONB NOT NULL,
  image_url TEXT,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_schema_revisions_design_idx
  ON public.design_schema_revisions (design_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_schema_revisions TO authenticated;
GRANT ALL ON public.design_schema_revisions TO service_role;

ALTER TABLE public.design_schema_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own design revisions"
  ON public.design_schema_revisions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);