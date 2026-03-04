CREATE TABLE public.target_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Primary Audience',
  raw_inputs jsonb NOT NULL DEFAULT '{}',
  jtbd_profile jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.target_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their audiences"
  ON public.target_audiences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can insert their audiences"
  ON public.target_audiences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can update their audiences"
  ON public.target_audiences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can delete their audiences"
  ON public.target_audiences FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE TRIGGER update_target_audiences_updated_at
  BEFORE UPDATE ON public.target_audiences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();