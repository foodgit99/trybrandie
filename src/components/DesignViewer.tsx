import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Calendar, Download, FolderPlus } from "lucide-react";
import { format } from "date-fns";

interface Design {
  id: string;
  title: string | null;
  prompt: string;
  image_url: string;
  created_at: string;
  canvas_size: string;
}

interface DesignViewerProps {
  designs: Design[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onAddToFolder?: (designId: string) => void;
}

const DesignViewer = ({ designs, initialIndex, open, onClose, onAddToFolder }: DesignViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isCarousel = designs.length > 1;

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < designs.length - 1 ? i + 1 : i));
  }, [designs.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goNext, goPrev, onClose]);

  if (!open || designs.length === 0) return null;

  const design = designs[currentIndex];

  const handleDownload = async () => {
    try {
      const resp = await fetch(design.image_url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.title || "design"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab if blob fetch fails (e.g., CORS).
      window.open(design.image_url, "_blank");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted-foreground/60">
                {currentIndex + 1} / {designs.length}
              </span>
              <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-[400px]">
                {design.title || "Untitled"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {onAddToFolder && (
                <button
                  onClick={() => onAddToFolder(design.id)}
                  className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleDownload}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Main image area */}
          <div className="flex-1 flex items-center justify-center px-4 sm:px-16 relative min-h-0">
            {/* Prev button */}
            {currentIndex > 0 && (
              <button
                onClick={goPrev}
                className="absolute left-2 sm:left-6 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-muted/30 text-muted-foreground/50 hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.img
                key={design.id}
                src={design.image_url}
                alt={design.title || design.prompt}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="max-h-full max-w-full object-contain rounded-2xl"
              />
            </AnimatePresence>

            {/* Next button */}
            {currentIndex < designs.length - 1 && (
              <button
                onClick={goNext}
                className="absolute right-2 sm:right-6 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-muted/30 text-muted-foreground/50 hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Dot indicators for carousel sets */}
          {isCarousel && (
            <div className="flex items-center justify-center gap-1.5 py-2">
              {designs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Thumbnail strip for carousel sets */}
          {isCarousel && (
            <div className="flex items-center justify-center gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
              {designs.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`shrink-0 h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentIndex
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={d.image_url}
                    alt={`Slide ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Bottom info */}
          <div className="flex items-center justify-center gap-3 px-4 py-4">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <Calendar className="h-3 w-3" />
              {format(new Date(design.created_at), "MMM d, yyyy · h:mm a")}
            </div>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground/50">{design.canvas_size}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DesignViewer;
