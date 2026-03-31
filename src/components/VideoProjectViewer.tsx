import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Trash2, Target, Zap, Clock } from "lucide-react";
import VideoPreview from "@/components/VideoPreview";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface VideoProject {
  id: string;
  intent: any;
  script: any;
  storyboard: any;
  caption: string | null;
  hashtags: string[] | null;
  status: string;
  credits_used: number;
  selected_variation: number | null;
  created_at: string;
  video_scenes: Array<{
    id: string;
    scene_index: number;
    description: string;
    image_url: string | null;
    duration_ms: number;
    text_overlay: any;
    transition: string;
  }>;
}

interface Props {
  project: VideoProject | null;
  open: boolean;
  onClose: () => void;
}

const VideoProjectViewer = ({ project, open, onClose }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  if (!project) return null;

  const scenes = (project.video_scenes || [])
    .sort((a, b) => a.scene_index - b.scene_index)
    .map((s) => ({
      scene_index: s.scene_index,
      description: s.description,
      image_url: s.image_url,
      duration_ms: s.duration_ms,
      text_overlay: s.text_overlay,
      transition: s.transition,
    }));

  const variations = project.script?.variations?.map((v: any, i: number) => ({
    id: i === 0 ? "a" : "b",
    label: v.label || (i === 0 ? "Bold Hook" : "Story Angle"),
    hook: v.hook || "",
    script_summary: v.script_summary || "",
  })) || [];

  const strategy = project.storyboard?.strategy;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("video_projects").delete().eq("id", project.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Video project deleted" });
      queryClient.invalidateQueries({ queryKey: ["video-projects"] });
      onClose();
    }
    setDeleting(false);
  };

  const handleDownloadScenes = () => {
    const imageScenes = scenes.filter((s) => s.image_url);
    if (imageScenes.length === 0) {
      toast({ title: "No scene images to download" });
      return;
    }
    imageScenes.forEach((s, i) => {
      const a = document.createElement("a");
      a.href = s.image_url!;
      a.download = `scene-${i + 1}.png`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    toast({ title: `Downloading ${imageScenes.length} scene images` });
  };

  const intent = project.intent || {};

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-serif text-lg">
              {intent.goal || "Video Project"}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {project.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(project.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Intent summary */}
        <div className="px-5 flex flex-wrap gap-2">
          {intent.platform && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Target className="h-3 w-3" /> {intent.platform}
            </Badge>
          )}
          {intent.style && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Zap className="h-3 w-3" /> {intent.style}
            </Badge>
          )}
          {intent.duration && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Clock className="h-3 w-3" /> {intent.duration}s
            </Badge>
          )}
        </div>

        {/* Video Preview */}
        <div className="min-h-[400px] border-y border-border">
          <VideoPreview
            scenes={scenes}
            variations={variations}
            caption={project.caption}
            hashtags={project.hashtags || []}
          />
        </div>

        {/* Strategy summary */}
        {strategy && (
          <Card className="mx-5 border-dashed">
            <CardContent className="p-3 space-y-1">
              <p className="text-xs font-medium">Strategy</p>
              {strategy.hook_style && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Hook:</span> {strategy.hook_style}
                </p>
              )}
              {strategy.pacing && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Pacing:</span> {strategy.pacing}
                </p>
              )}
              {strategy.emotional_arc && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Arc:</span> {strategy.emotional_arc}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs flex-1"
            onClick={handleDownloadScenes}
          >
            <Download className="h-3.5 w-3.5" /> Download Scenes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoProjectViewer;
