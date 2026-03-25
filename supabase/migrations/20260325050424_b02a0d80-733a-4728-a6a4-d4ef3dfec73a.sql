
CREATE TABLE public.video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  content_idea_id uuid REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  script jsonb DEFAULT NULL,
  storyboard jsonb DEFAULT NULL,
  timeline jsonb DEFAULT NULL,
  caption text DEFAULT NULL,
  hashtags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft',
  video_url text DEFAULT NULL,
  selected_variation integer DEFAULT NULL,
  credits_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.video_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  scene_index integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  image_url text DEFAULT NULL,
  duration_ms integer NOT NULL DEFAULT 3000,
  text_overlay jsonb DEFAULT NULL,
  transition text NOT NULL DEFAULT 'fade',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video projects"
  ON public.video_projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video projects"
  ON public.video_projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video projects"
  ON public.video_projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video projects"
  ON public.video_projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all video projects"
  ON public.video_projects FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their video scenes"
  ON public.video_scenes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_scenes.video_project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their video scenes"
  ON public.video_scenes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_scenes.video_project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their video scenes"
  ON public.video_scenes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_scenes.video_project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their video scenes"
  ON public.video_scenes FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE video_projects.id = video_scenes.video_project_id
    AND video_projects.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all video scenes"
  ON public.video_scenes FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_video_projects_updated_at
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
