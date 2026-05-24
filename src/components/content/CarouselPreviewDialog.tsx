import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Download, Loader2, LayoutGrid, Maximize2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Slide {
  id: string;
  image_url: string;
  slide_index: number;
  copy_structure: any;
}

interface CarouselPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Any design_id that belongs to the carousel (or a single design id). */
  designId: string | null;
  title?: string;
}

export default function CarouselPreviewDialog({ open, onOpenChange, designId, title }: CarouselPreviewDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"single" | "grid">("single");

  useEffect(() => {
    if (!open || !designId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setIndex(0);
      try {
        const { data: seed } = await supabase
          .from("designs")
          .select("id, carousel_id, image_url, slide_index, copy_structure")
          .eq("id", designId)
          .maybeSingle();
        if (cancelled) return;
        if (!seed) {
          setSlides([]);
          return;
        }
        if (!seed.carousel_id) {
          setSlides([{ id: seed.id, image_url: seed.image_url, slide_index: 0, copy_structure: seed.copy_structure }]);
          return;
        }
        const { data } = await supabase
          .from("designs")
          .select("id, image_url, slide_index, copy_structure")
          .eq("carousel_id", seed.carousel_id)
          .order("slide_index", { ascending: true });
        if (cancelled) return;
        setSlides(
          (data || []).map((d: any, i: number) => ({
            id: d.id,
            image_url: d.image_url,
            slide_index: d.slide_index ?? i,
            copy_structure: d.copy_structure,
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, designId]);

  const current = slides[index];
  const headline = useMemo(() => {
    const c = current?.copy_structure;
    if (!c) return null;
    return c.headline || c.hook || c.title || null;
  }, [current]);

  const downloadAll = async () => {
    for (let i = 0; i < slides.length; i++) {
      try {
        const resp = await fetch(slides[i].image_url);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `slide-${i + 1}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        /* skip */
      }
    }
    toast({ title: `${slides.length} slides downloaded` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4" />
            <span className="truncate">{title || "Carousel preview"}</span>
            {slides.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {slides.length} slide{slides.length === 1 ? "" : "s"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading slides…</span>
          </div>
        ) : slides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm">No slides yet for this idea.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* View toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                <button
                  onClick={() => setView("single")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    view === "single" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Maximize2 className="h-3 w-3 inline mr-1" />
                  Single
                </button>
                <button
                  onClick={() => setView("grid")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    view === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3 inline mr-1" />
                  Grid
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={downloadAll} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download all
              </Button>
            </div>

            {view === "single" ? (
              <>
                <div className="relative bg-muted/30 rounded-xl overflow-hidden aspect-square">
                  <img
                    src={current.image_url}
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {index > 0 && (
                    <button
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 backdrop-blur shadow-sm flex items-center justify-center hover:bg-background"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  {index < slides.length - 1 && (
                    <button
                      onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 backdrop-blur shadow-sm flex items-center justify-center hover:bg-background"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-background/90 backdrop-blur text-[11px] font-semibold">
                    {index + 1} / {slides.length}
                  </div>
                </div>

                {headline && (
                  <p className="text-sm text-muted-foreground line-clamp-2 px-1">{headline}</p>
                )}

                {/* Thumbnail strip */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setIndex(i)}
                      className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === index ? "border-primary" : "border-transparent hover:border-border"
                      }`}
                    >
                      <img src={s.image_url} alt={`Slide ${i + 1} thumbnail`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 right-0 px-1 py-0.5 text-[9px] font-bold bg-background/80 backdrop-blur rounded-tl">
                        {i + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setIndex(i);
                      setView("single");
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border hover:border-primary transition-colors"
                  >
                    <img src={s.image_url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent text-[10px] font-semibold text-white">
                      Slide {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
