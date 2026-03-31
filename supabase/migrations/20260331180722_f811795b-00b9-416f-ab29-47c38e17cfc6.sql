ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS price text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';

-- Add UPDATE RLS policy (currently missing)
CREATE POLICY "Users can update their brand products"
ON public.brand_products
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM brands WHERE brands.id = brand_products.brand_id AND brands.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM brands WHERE brands.id = brand_products.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Admins can update brand products"
ON public.brand_products
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));