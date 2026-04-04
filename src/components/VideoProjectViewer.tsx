import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Trash2, Target, Zap, Clock, Play, Loader2, AlertCircle } from "lucide-react";
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
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (project) {
      setRenderStatus(null);
      setRenderedVideoUrl(null);
    }
  }, [project?.id]);

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
        stopPolling();
        queryClient.invalidateQueries({ queryKey: ["video-projects"] });

        toast({
          title: data.render_status === "rendered" ? "Video rendered!" : "Render failed",
          description: data.render_status === "rendered" ? "Your video is ready to download." : "Something went wrong during rendering.",
          variant: data.render_status === "rendered" ? "default" : "destructive",
        });
      }
    }, 15000);
  }, [project?.id, stopPolling, queryClient, toast]);

  // Auto-start polling if project is rendering
  useEffect(() => {
    if (open && project) {
      const status = renderStatus || project.render_status;
      if (status === "rendering") {
        startPolling();
      }
    }
  }, [open, project?.id, project?.render_status, renderStatus, startPolling]);

  if (!project) return null;

  const currentRenderStatus = renderStatus || project.render_status || "pending";
  const currentVideoUrl = renderedVideoUrl || project.rendered_video_url;
  const strategy = project.storyboard?.strategy;
  const intent = project.intent || {};

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

  const handleDownloadVideo = () => {
    if (!currentVideoUrl) return;
    const a = document.createElement("a");
    a.href = currentVideoUrl;
    a.download = `brandie-video-${Date.now()}.mp4`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Downloading video" });
  };

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

        {/* Intent badges */}
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

        {/* Main content area */}
        <div className="px-5">
          {/* Rendered video */}
          {currentRenderStatus === "rendered" && currentVideoUrl && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Play className="h-3 w-3" /> Your Video
                </p>
                <video
                  src={currentVideoUrl}
                  controls
                  className="w-full rounded-xl"
                  style={{ maxHeight: 400 }}
                />
              </CardContent>
            </Card>
          )}

          {/* Rendering in progress */}
          {currentRenderStatus === "rendering" && (
            <Card className="border-dashed">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Rendering your video…</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This may take 10–15 minutes. You can close this dialog and come back later.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed */}
          {currentRenderStatus === "failed" && (
            <Card className="border-destructive/50">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm font-medium">Rendering failed</p>
                <p className="text-xs text-muted-foreground">
                  Something went wrong during video rendering. Please try generating a new video.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pending (storyboard created but not yet rendered) */}
          {currentRenderStatus === "pending" && (
            <Card className="border-dashed">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                <Clock className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Video pending</p>
                <p className="text-xs text-muted-foreground">
                  This video hasn't been rendered yet. Generate a new video from the studio to start the process.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Caption & hashtags */}
        {(project.caption || (project.hashtags && project.hashtags.length > 0)) && (
          <Card className="mx-5 border-dashed">
            <CardContent className="p-3 space-y-1">
              {project.caption && (
                <p className="text-xs text-muted-foreground">{project.caption}</p>
              )}
              {project.hashtags && project.hashtags.length > 0 && (
                <p className="text-[11px] text-primary">
                  {project.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
          {currentVideoUrl && currentRenderStatus === "rendered" && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5 text-xs flex-1"
              onClick={handleDownloadVideo}
            >
              <Download className="h-3.5 w-3.5" /> Download Video
            </Button>
          )}
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