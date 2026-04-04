import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Download,
  Copy,
  Clock,
  Film,
  Type,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Scene {
  scene_index: number;
  description: string;
  image_url: string | null;
  video_url?: string | null;
  duration_ms: number;
  text_overlay: {
    text?: string;
    position?: string;
    style?: string;
  } | null;
  transition: string;
}

interface ScriptVariation {
  id: string;
  label: string;
  hook: string;
  script_summary: string;
}

interface Props {
  scenes: Scene[];
  variations?: ScriptVariation[];
  selectedVariation?: string;
  onSelectVariation?: (id: string) => void;
  caption?: string | null;
  hashtags?: string[];
  loading?: boolean;
  status?: string;
  renderStatus?: string;
  renderedVideoUrl?: string | null;
}

const VideoPreview = ({
  scenes,
  variations,
  selectedVariation,
  onSelectVariation,
  caption,
  hashtags,
  loading,
  status,
  renderStatus,
  renderedVideoUrl,
}: Props) => {
  const [currentScene, setCurrentScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration_ms, 0);

  useEffect(() => {
    if (playing && scenes.length > 0) {
      const scene = scenes[currentScene];
      timerRef.current = window.setTimeout(() => {
        if (currentScene < scenes.length - 1) {
          setCurrentScene((prev) => prev + 1);
        } else {
          setPlaying(false);
          setCurrentScene(0);
        }
      }, scene.duration_ms);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentScene, scenes]);

  const togglePlay = () => {
    if (!playing && currentScene >= scenes.length - 1) setCurrentScene(0);
    setPlaying(!playing);
  };

  const handleDownload = async () => {
    if (!renderedVideoUrl) return;
    try {
      const response = await fetch(renderedVideoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brandie-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(renderedVideoUrl, "_blank");
    }
  };

  // Loading state — show progress through pipeline stages
  if (loading) {
    const stageLabels: Record<string, string> = {
      scripting: "Writing the script…",
      storyboarding: "Building the storyboard…",
      composing: "Composing scenes…",
      rendering: "Rendering your video… This may take 10–15 minutes.",
      processing: "Processing…",
    };

    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-base font-medium">Creating your video…</p>
          <p className="text-sm text-muted-foreground">
            {stageLabels[status || "processing"] || "Processing…"}
          </p>
          {status === "rendering" && (
            <p className="text-xs text-muted-foreground/70 mt-2">
              You can leave this page — we'll notify you when it's done.
            </p>
          )}
        </div>
        {/* Stage indicators */}
        <div className="flex gap-3 items-center">
          {["scripting", "storyboarding", "rendering"].map((stage, i) => {
            const stages = ["scripting", "storyboarding", "rendering"];
            const currentIdx = stages.indexOf(status || "");
            const isDone = currentIdx > i;
            const isCurrent = currentIdx === i;
            return (
              <div key={stage} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  isDone ? "bg-primary" : isCurrent ? "bg-primary animate-pulse" : "bg-muted"
                }`} />
                <span className={`text-[10px] capitalize ${
                  isDone || isCurrent ? "text-foreground" : "text-muted-foreground"
                }`}>{stage === "scripting" ? "Script" : stage === "storyboarding" ? "Storyboard" : "Render"}</span>
                {i < 2 && <div className={`w-6 h-px ${isDone ? "bg-primary" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Rendered video — show final video player
  if (renderStatus === "rendered" && renderedVideoUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 px-4 py-3 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Your video is ready!</p>
          </div>
          {/* Video player */}
          <div className="relative aspect-[9/16] max-h-[450px] w-full mx-auto rounded-2xl overflow-hidden bg-muted border border-border">
            <video
              src={renderedVideoUrl}
              controls
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          </div>
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Download Video
          </Button>
          {/* Caption */}
          {caption && (
            <Card>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Type className="h-3 w-3" /> Caption
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => navigator.clipboard.writeText(caption + (hashtags?.length ? "\n\n" + hashtags.join(" ") : ""))}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{caption}</p>
                {hashtags && hashtags.length > 0 && (
                  <p className="text-xs text-primary/70">{hashtags.join(" ")}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Render failed
  if (renderStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Video rendering failed</p>
          <p className="text-xs text-muted-foreground">
            Something went wrong during rendering. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // Empty scenes state
  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Complete the guided flow to generate your video scenes
        </p>
      </div>
    );
  }

  // Storyboard preview (fallback — shouldn't normally be seen in new flow)
  const scene = scenes[currentScene];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      {/* Variation selector */}
      {variations && variations.length > 1 && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Script Variations
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {variations.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelectVariation?.(v.id)}
                className={`flex-shrink-0 text-left p-2.5 rounded-xl border transition-all max-w-[180px] ${
                  selectedVariation === v.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <Badge variant="secondary" className="text-[9px] mb-1">{v.label}</Badge>
                <p className="text-[11px] font-medium line-clamp-2">{v.hook}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scene preview */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-3 overflow-y-auto">
        <div className="relative aspect-[9/16] max-h-[400px] w-full mx-auto rounded-2xl overflow-hidden bg-muted border border-border">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScene}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              {scene.video_url ? (
                <video src={scene.video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              ) : scene.image_url ? (
                <img src={scene.image_url} alt={`Scene ${scene.scene_index + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 p-4">
                  <p className="text-xs text-muted-foreground text-center">{scene.description}</p>
                </div>
              )}
              {scene.text_overlay?.text && (
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-white text-sm font-medium">{scene.text_overlay.text}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-[10px] bg-black/50 text-white border-none backdrop-blur-sm">
              {currentScene + 1}/{scenes.length}
            </Badge>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentScene(Math.max(0, currentScene - 1))} disabled={currentScene === 0}>
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" className="h-9 w-9 rounded-full" onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentScene(Math.min(scenes.length - 1, currentScene + 1))} disabled={currentScene === scenes.length - 1}>
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Timeline strip */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {scenes.map((s, i) => (
            <button
              key={i}
              onClick={() => { setCurrentScene(i); setPlaying(false); }}
              className={`flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentScene ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {s.image_url ? (
                <img src={s.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground">{i + 1}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Scene details */}
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Scene {currentScene + 1}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {(scene.duration_ms / 1000).toFixed(1)}s
                <span>·</span>
                <span>{scene.transition}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{scene.description}</p>
          </CardContent>
        </Card>

        {/* Caption */}
        {caption && (
          <Card>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Type className="h-3 w-3" /> Caption
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigator.clipboard.writeText(caption + (hashtags?.length ? "\n\n" + hashtags.join(" ") : ""))}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{caption}</p>
              {hashtags && hashtags.length > 0 && (
                <p className="text-xs text-primary/70">{hashtags.join(" ")}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {scenes.length} scenes · {(totalDuration / 1000).toFixed(0)}s total
        </span>
        <Badge variant="secondary" className="text-[10px]">
          Video Preview
        </Badge>
      </div>
    </div>
  );
};

export default VideoPreview;
