
-- Create design folders table
CREATE TABLE public.design_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for design-folder assignments
CREATE TABLE public.design_folder_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.design_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(design_id, folder_id)
);

-- Enable RLS
ALTER TABLE public.design_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_folder_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for design_folders
CREATE POLICY "Users can view their own folders" ON public.design_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own folders" ON public.design_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own folders" ON public.design_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own folders" ON public.design_folders FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for design_folder_assignments (user owns the folder)
CREATE POLICY "Users can view their folder assignments" ON public.design_folder_assignments FOR SELECT USING (EXISTS (SELECT 1 FROM public.design_folders WHERE design_folders.id = design_folder_assignments.folder_id AND design_folders.user_id = auth.uid()));
CREATE POLICY "Users can insert folder assignments" ON public.design_folder_assignments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.design_folders WHERE design_folders.id = design_folder_assignments.folder_id AND design_folders.user_id = auth.uid()));
CREATE POLICY "Users can delete folder assignments" ON public.design_folder_assignments FOR DELETE USING (EXISTS (SELECT 1 FROM public.design_folders WHERE design_folders.id = design_folder_assignments.folder_id AND design_folders.user_id = auth.uid()));

-- Add updated_at trigger for design_folders
CREATE TRIGGER update_design_folders_updated_at BEFORE UPDATE ON public.design_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
