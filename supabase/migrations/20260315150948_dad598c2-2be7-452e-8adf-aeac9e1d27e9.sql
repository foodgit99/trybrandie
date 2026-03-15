
-- Content Pillars table
CREATE TABLE public.content_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_emoji text NOT NULL DEFAULT '📌',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their content pillars" ON public.content_pillars FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_pillars.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can insert their content pillars" ON public.content_pillars FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_pillars.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can update their content pillars" ON public.content_pillars FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_pillars.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can delete their content pillars" ON public.content_pillars FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_pillars.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Admins can view all content pillars" ON public.content_pillars FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage content pillars" ON public.content_pillars FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Post Series table
CREATE TABLE public.post_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pillar_id uuid REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  recurrence text NOT NULL DEFAULT 'weekly',
  preferred_day text,
  visual_style_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their post series" ON public.post_series FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = post_series.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can insert their post series" ON public.post_series FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = post_series.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can update their post series" ON public.post_series FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = post_series.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can delete their post series" ON public.post_series FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = post_series.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Admins can manage post series" ON public.post_series FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = campaigns.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can insert their campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = campaigns.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can update their campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = campaigns.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can delete their campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = campaigns.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Admins can manage campaigns" ON public.campaigns FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Content Ideas table
CREATE TABLE public.content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pillar_id uuid REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  series_id uuid REFERENCES public.post_series(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  idea_type text NOT NULL DEFAULT 'single',
  status text NOT NULL DEFAULT 'suggested',
  scheduled_for date,
  design_id uuid REFERENCES public.designs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their content ideas" ON public.content_ideas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_ideas.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can insert their content ideas" ON public.content_ideas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_ideas.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can update their content ideas" ON public.content_ideas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_ideas.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Users can delete their content ideas" ON public.content_ideas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = content_ideas.brand_id AND brands.user_id = auth.uid()));
CREATE POLICY "Admins can manage content ideas" ON public.content_ideas FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at triggers
CREATE TRIGGER update_content_pillars_updated_at BEFORE UPDATE ON public.content_pillars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_series_updated_at BEFORE UPDATE ON public.post_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
