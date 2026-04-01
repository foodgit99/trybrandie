import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Trash2, Target, Zap, Clock, Play, Loader2 } from "lucide-react";
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
  render_status?: string;
  rendered_video_url?: string | null;
  video_scenes: Array<{
    id: string;
    scene_index: number;
    description: string;
    image_url: string | null;
    video_url?: string | null;
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
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset local state when project changes
  useEffect(() => {
    if (project) {
      setRenderStatus(null);
      setRenderedVideoUrl(null);
      setRendering(false);
    }
  }, [project?.id]);

  // Stop polling on unmount or close
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) stopPolling();
    return stopPolling;
  }, [open, stopPolling]);

  // Start polling when render is in progress
  const startPolling = useCallback(() => {
    stopPolling();
    if (!project?.id) return;

    pollRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from("video_projects")
        .select("render_status, rendered_video_url")
        .eq("id", project.id)
        .single();

      if (error || !data) return;

      if (data.render_status === "rendered" || data.render_status === "failed") {
        setRenderStatus(data.render_status);
        setRenderedVideoUrl(data.rendered_video_url);
        setRendering(false);
        stopPolling();
        queryClient.invalidateQueries({ queryKey: ["video-projects"] });

        if (data.render_status === "rendered") {
          toast({ title: "Video rendered!", description: "Your video is ready to download." });
        } else {
          toast({ title: "Render failed", description: "Some scenes could not be rendered.", variant: "destructive" });
        }
      }
    }, 15000); // Poll every 15 seconds
  }, [project?.id, stopPolling, queryClient, toast]);

  // Auto-start polling if project is already rendering when opened
  useEffect(() => {
    if (open && project && (renderStatus || project.render_status) === "rendering") {
      setRendering(true);
      startPolling();
    }
  }, [open, project?.id, project?.render_status, renderStatus, startPolling]);

  if (!project) return null;

  const scenes = (project.video_scenes || [])
    .sort((a, b) => a.scene_index - b.scene_index)
    .map((s) => ({
      scene_index: s.scene_index,
      description: s.description,
      image_url: s.image_url,
      video_url: s.video_url || null,
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
  const currentRenderStatus = renderStatus || project.render_status || "pending";
  const currentVideoUrl = renderedVideoUrl || project.rendered_video_url;

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

  const handleRenderVideo = async () => {
    setRendering(true);
    setRenderStatus("rendering");
    
    // Start polling immediately — the edge function takes 10-20 min
    startPolling();
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ video_project_id: project.id }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Render failed" }));
        stopPolling();
        if (res.status === 402) {
          toast({ title: "Insufficient credits", description: "Video rendering requires 5 credits.", variant: "destructive" });
        } else {
          toast({ title: "Render failed", description: errData.error, variant: "destructive" });
        }
        setRenderStatus("failed");
        setRendering(false);
        return;
      }

      // The edge function may return quickly if it completes fast,
      // or polling will catch the completion for long renders
      const result = await res.json();
      if (result.render_status === "rendered" || result.render_status === "failed") {
        stopPolling();
        setRenderStatus(result.render_status);
        setRenderedVideoUrl(result.rendered_video_url || null);
        setRendering(false);
        queryClient.invalidateQueries({ queryKey: ["video-projects"] });
        toast({
          title: result.render_status === "rendered" ? "Video rendered!" : "Render completed with issues",
          description: `${result.scenes_rendered}/${result.total_scenes} scenes rendered`,
        });
      }
      // If still rendering, polling will handle the rest
    } catch (e: any) {
      // Don't stop polling on network timeout — the render may still be running server-side
      toast({ title: "Render request sent", description: "We'll update you when it's ready. You can close this dialog and come back later." });
    }
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

  const handleDownloadVideo = () => {
    const url = currentVideoUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `brandie-video-${Date.now()}.mp4`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Downloading video" });
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
              {currentRenderStatus !== "pending" && (
                <Badge
                  variant={currentRenderStatus === "rendered" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {currentRenderStatus === "rendering" ? "Rendering…" : currentRenderStatus}
                </Badge>
              )}
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

        {/* Rendered video player */}
        {project.rendered_video_url && currentRenderStatus === "rendered" && (
          <div className="px-5">
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Play className="h-3 w-3" /> Rendered Video
                </p>
                <video
                  src={project.rendered_video_url}
                  controls
                  className="w-full rounded-xl"
                  style={{ maxHeight: 400 }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Video Preview (storyboard) */}
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
        <div className="px-5 pb-5 flex flex-wrap items-center gap-2">
          {/* Render Video button */}
          {currentRenderStatus !== "rendered" && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5 text-xs flex-1"
              onClick={handleRenderVideo}
              disabled={rendering || currentRenderStatus === "rendering"}
            >
              {rendering || currentRenderStatus === "rendering" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering…
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Render Video (5 credits)
                </>
              )}
            </Button>
          )}
          {/* Download rendered video */}
          {project.rendered_video_url && currentRenderStatus === "rendered" && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5 text-xs flex-1"
              onClick={handleDownloadVideo}
            >
              <Download className="h-3.5 w-3.5" /> Download Video
            </Button>
          )}
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
