import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Square } from "lucide-react";

const QUOTES = [
  "Mixing your brand palette…",
  "Composing the layout grid…",
  "Whispering to the typography…",
  "Balancing whitespace like a Swiss designer…",
  "Channeling your audience's emotions…",
  "Polishing the pixels…",
  "Choosing the perfect focal point…",
  "Aligning with your brand voice…",
  "Adding a touch of magic ✨",
  "Calibrating contrast and rhythm…",
  "Designs aren't made, they're conducted…",
  "Layering trend cues onto your DNA…",
  "Whittling the headline to its essence…",
  "Tuning the visual hierarchy…",
  "Letting the negative space breathe…",
  "Almost there — making it gallery-worthy…",
];

interface Props {
  onStop?: () => void;
  compact?: boolean;
}

export default function GenerationLoader({ onStop, compact = false }: Props) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % QUOTES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-secondary to-secondary px-4 py-3 ${
        compact ? "max-w-[320px]" : "max-w-[380px]"
      }`}
    >
      {/* Animated shimmer */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
        animate={{ x: ["0%", "400%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center gap-3">
        {/* Pulsing sparkle orb */}
        <div className="relative flex-shrink-0">
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/30"
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          <div className="relative h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-4 w-4 text-primary" />
            </motion.div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground/90 mb-1">Designing your post</div>
          <div className="relative h-4 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ y: 14, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -14, opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="absolute inset-0 text-xs text-muted-foreground truncate"
              >
                {QUOTES[index]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {onStop && (
          <button
            onClick={onStop}
            className="flex-shrink-0 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive px-2 py-1 text-xs font-medium transition-colors flex items-center gap-1"
            title="Stop generation"
          >
            <Square className="h-2.5 w-2.5 fill-current" />
            Stop
          </button>
        )}
      </div>

      {/* Bottom indeterminate progress */}
      <div className="relative mt-3 h-0.5 w-full overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
