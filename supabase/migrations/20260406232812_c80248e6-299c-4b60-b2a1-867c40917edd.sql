
CREATE TABLE public.autopilot_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  delivery_time text NOT NULL DEFAULT 'morning',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (brand_id)
);

ALTER TABLE public.autopilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their autopilot settings"
  ON public.autopilot_settings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = autopilot_settings.brand_id AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their autopilot settings"
  ON public.autopilot_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = autopilot_settings.brand_id AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their autopilot settings"
  ON public.autopilot_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = autopilot_settings.brand_id AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage autopilot settings"
  ON public.autopilot_settings FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
