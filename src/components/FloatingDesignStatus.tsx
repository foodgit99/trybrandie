import { useDesignGeneration } from "@/contexts/DesignGenerationContext";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, X, Sparkles, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function FloatingDesignStatus() {
  const { status, result, error, progress, clearResult, stopGeneration } = useDesignGeneration();
  const navigate = useNavigate();
  const location = useLocation();
  const toastFired = useRef(false);

  const isOnStudio = location.pathname === "/studio";
  const isVisible = status !== "idle" && !isOnStudio;

  // Play a subtle chime sound
  const playChime = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  // Fire toast + chime on completion
  useEffect(() => {
    if (status === "complete" && !toastFired.current) {
      toastFired.current = true;
      playChime();
      toast.success("Your design is ready!", { duration: 5000 });
    }
    if (status === "idle") {
      toastFired.current = false;
    }
  }, [status]);


  const handleClick = () => {
    if (status === "complete" && result?.design_id) {
      navigate(`/studio?design=${result.design_id}`);
      clearResult();
    } else if (status === "generating") {
      navigate("/studio");
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
          className="fixed bottom-6 right-6 z-[9999]"
        >
          {/* Pulsing glow ring when complete */}
          {status === "complete" && (
            <motion.div
              className="absolute inset-0 rounded-2xl bg-primary/20"
              animate={{ opacity: [0, 0.5, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div
            onClick={handleClick}
            className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl cursor-pointer hover:shadow-xl transition-shadow min-w-[240px] max-w-[320px] ${
              status === "complete"
                ? "border-primary/40 bg-card/95 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)]"
                : "border-border bg-card/95 shadow-lg"
            }`}
          >
            {/* Close / Stop button */}
            {status === "generating" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopGeneration();
                }}
                className="absolute -top-2 -right-2 rounded-full bg-destructive/90 p-1 hover:bg-destructive transition-colors"
                title="Stop generation"
              >
                <Square className="h-3 w-3 text-destructive-foreground fill-current" />
              </button>
            )}
            {(status === "complete" || status === "error") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearResult();
                }}
                className="absolute -top-2 -right-2 rounded-full bg-muted p-1 hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}

            {/* Icon */}
            {status === "generating" && (
              <div className="flex-shrink-0 rounded-xl bg-primary/10 p-2">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            )}
            {status === "complete" && (
              <div className="flex-shrink-0 rounded-xl bg-green-500/10 p-2">
                {result?.image_url ? (
                  <img
                    src={result.image_url}
                    alt="Design preview"
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>
            )}
            {status === "error" && (
              <div className="flex-shrink-0 rounded-xl bg-destructive/10 p-2">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
            )}

            {/* Text */}
            <div className="flex-1 min-w-0">
              {status === "generating" && (
                <>
                  <p className="text-sm font-medium text-foreground">Creating your design… {progress}%</p>
                  <p className="text-xs text-muted-foreground truncate">This may take a moment</p>
                </>
              )}
              {status === "complete" && (
                <>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    Design ready! <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Click to view →
                  </p>
                </>
              )}
              {status === "error" && (
                <>
                  <p className="text-sm font-medium text-destructive">Generation failed</p>
                  <p className="text-xs text-muted-foreground truncate">{error || "Something went wrong"}</p>
                </>
              )}
            </div>

            {/* Generating pulse bar */}
            {status === "generating" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl overflow-hidden bg-primary/10">
                <motion.div
                  className="h-full bg-primary/60"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
