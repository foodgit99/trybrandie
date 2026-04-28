-- Create brand_updates table
CREATE TABLE public.brand_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL,
  user_id UUID NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  attribution TEXT,
  image_url TEXT,
  source_url TEXT,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'active',
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_updates_brand_status_date
  ON public.brand_updates (brand_id, status, event_date DESC);

CREATE INDEX idx_brand_updates_brand_type
  ON public.brand_updates (brand_id, update_type);

ALTER TABLE public.brand_updates ENABLE ROW LEVEL SECURITY;

-- User policies (mirrors brand_products pattern: ownership via brands join)
CREATE POLICY "Users can view their brand updates"
ON public.brand_updates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = brand_updates.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can insert their brand updates"
ON public.brand_updates
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = brand_updates.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can update their brand updates"
ON public.brand_updates
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = brand_updates.brand_id AND brands.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = brand_updates.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can delete their brand updates"
ON public.brand_updates
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = brand_updates.brand_id AND brands.user_id = auth.uid()
));

-- Admin policies
CREATE POLICY "Admins can view all brand updates"
ON public.brand_updates
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update brand updates"
ON public.brand_updates
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete brand updates"
ON public.brand_updates
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_brand_updates_updated_at
BEFORE UPDATE ON public.brand_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();