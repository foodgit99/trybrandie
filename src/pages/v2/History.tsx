import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Search, ImageIcon, Calendar, Layers, MessageCircle } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import DesignViewer from "@/components/DesignViewer";
import CarouselPreviewDialog from "@/components/content/CarouselPreviewDialog";

type Design = {
  id: string;
  title: string | null;
  prompt: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  canvas_size: string;
  carousel_id: string | null;
  slide_index: number | null;
};

// A grouped item: either a single design or a carousel (multiple slides).
type HistoryItem =
  | { kind: "single"; key: string; cover: Design; created_at: string }
  | {
      kind: "carousel";
      key: string;
      cover: Design;
      slides: Design[];
      created_at: string;
    };

function groupLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d, yyyy");
}

const HistoryV2 = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [carouselDesignId, setCarouselDesignId] = useState<string | null>(null);
  const [carouselTitle, setCarouselTitle] = useState<string | undefined>(undefined);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: designs = [], isLoading } = useQuery({
    queryKey: ["v2-history-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select(
          "id, title, prompt, image_url, caption, created_at, canvas_size, carousel_id, slide_index",
        )
        .eq("user_id", user!.id)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Design[];
    },
    enabled: !!user,
  });

  // Collapse carousel slides into single items; preserve singles.
  // Ordering: newest activity first (max created_at across the carousel).
  const items: HistoryItem[] = useMemo(() => {
    const carouselMap = new Map<string, Design[]>();
    const singles: Design[] = [];
    for (const d of designs) {
      if (d.carousel_id) {
        const arr = carouselMap.get(d.carousel_id) ?? [];
        arr.push(d);
        carouselMap.set(d.carousel_id, arr);
      } else {
        singles.push(d);
      }
    }

    const result: HistoryItem[] = [];

    for (const [cid, slides] of carouselMap.entries()) {
      // Sort slides by slide_index (nulls last)
      slides.sort((a, b) => {
        const ai = a.slide_index ?? 999;
        const bi = b.slide_index ?? 999;
        return ai - bi;
      });
      const cover = slides[0];
      // Most recent created_at in the group drives ordering
      const created_at = slides.reduce(
        (max, s) => (s.created_at > max ? s.created_at : max),
        slides[0].created_at,
      );
      result.push({ kind: "carousel", key: `c:${cid}`, cover, slides, created_at });
    }
    for (const d of singles) {
      result.push({ kind: "single", key: `s:${d.id}`, cover: d, created_at: d.created_at });
    }

    result.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    return result;
  }, [designs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const pool =
        item.kind === "carousel"
          ? item.slides
          : [item.cover];
      return pool.some(
        (d) =>
          d.title?.toLowerCase().includes(q) ||
          d.prompt?.toLowerCase().includes(q) ||
          d.caption?.toLowerCase().includes(q),
      );
    });
  }, [items, query]);

  // Singles-only flat list for the DesignViewer (which doesn't render carousels).
  const singleDesignsFlat = useMemo(
    () =>
      filtered
        .filter((i): i is Extract<HistoryItem, { kind: "single" }> => i.kind === "single")
        .map((i) => i.cover),
    [filtered],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const key = groupLabel(new Date(item.created_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totalGenerations = designs.length;
  const totalItems = items.length;

  const downloadOne = async (url: string, filename: string) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownload = async (item: HistoryItem) => {
    try {
      setDownloadingId(item.key);
      if (item.kind === "single") {
        const d = item.cover;
        await downloadOne(
          d.image_url,
          `${(d.title || "design").replace(/[^a-z0-9-_]+/gi, "_")}.png`,
        );
      } else {
        const baseName = (item.cover.title || "carousel").replace(/[^a-z0-9-_]+/gi, "_");
        // Sequential download — keeps it simple, no zip dep.
        for (let i = 0; i < item.slides.length; i++) {
          const s = item.slides[i];
          await downloadOne(s.image_url, `${baseName}_slide-${i + 1}.png`);
          // Small delay so the browser doesn't drop downloads
          await new Promise((r) => setTimeout(r, 250));
        }
        toast({
          title: "Carousel saved",
          description: `${item.slides.length} slides downloaded.`,
        });
      }
    } catch (e) {
      toast({
        title: "Download failed",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const openItem = (item: HistoryItem) => {
    if (item.kind === "carousel") {
      setCarouselDesignId(item.cover.id);
      setCarouselTitle(item.cover.title || undefined);
    } else {
      const idx = singleDesignsFlat.findIndex((x) => x.id === item.cover.id);
      setViewerIndex(Math.max(0, idx));
      setViewerOpen(true);
    }
  };

  if (authLoading || brandLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/history" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="History, Brandie" description="Every generation, one tap away." path="/history" noindex />
      <NewAppHeader />

      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-8">
        <header className="space-y-2">
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">History</p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
            Everything you've made.
          </h1>
          <p className="text-muted-foreground">
            {totalItems} {totalItems === 1 ? "post" : "posts"} · {totalGenerations}{" "}
            {totalGenerations === 1 ? "generation" : "generations"} · view, download, repost.
          </p>
        </header>

        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, prompt or caption…"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">
              {totalItems === 0 ? "No generations yet" : "No matches"}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalItems === 0
                ? "Head to the Studio or approve a daily post, they'll all land here."
                : "Try a different search."}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([label, groupItems]) => (
              <section key={label} className="space-y-4">
                <div className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <Badge variant="secondary" className="ml-1 rounded-full text-[10px]">
                    {groupItems.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {groupItems.map((item) => {
                    const d = item.cover;
                    const isCarousel = item.kind === "carousel";
                    const slideCount = isCarousel ? item.slides.length : 1;
                    return (
                      <motion.div
                        key={item.key}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative rounded-2xl overflow-hidden border border-border bg-card"
                      >
                        {/* Stacked-card hint for carousels */}
                        {isCarousel && (
                          <>
                            <div
                              aria-hidden
                              className="absolute -top-1.5 left-2 right-2 h-2 rounded-t-2xl bg-card border border-b-0 border-border opacity-70"
                            />
                            <div
                              aria-hidden
                              className="absolute -top-3 left-4 right-4 h-2 rounded-t-2xl bg-card border border-b-0 border-border opacity-40"
                            />
                          </>
                        )}

                        <button
                          onClick={() => openItem(item)}
                          className="relative block w-full aspect-square bg-muted"
                          aria-label={`Open ${d.title || (isCarousel ? "carousel" : "design")}`}
                        >
                          <img
                            src={d.image_url}
                            alt={d.title || d.prompt?.slice(0, 80) || "Generated design"}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          {isCarousel && (
                            <Badge
                              className="absolute top-2 right-2 rounded-full bg-background/85 backdrop-blur text-foreground border border-border gap-1 px-2 py-0.5 text-[10px] font-medium"
                              variant="secondary"
                            >
                              <Layers className="h-3 w-3" />
                              {slideCount}
                            </Badge>
                          )}
                        </button>

                        <div className="p-3 space-y-2">
                          <p className="text-sm font-medium line-clamp-1">
                            {d.title || (isCarousel ? "Untitled carousel" : "Untitled")}
                          </p>
                          {d.caption && (
                            <p className="text-xs text-muted-foreground line-clamp-2 italic">
                              {d.caption}
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {isCarousel
                                ? `${slideCount} slides · ${format(new Date(item.created_at), "h:mm a")}`
                                : format(new Date(d.created_at), "h:mm a")}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item);
                              }}
                              disabled={downloadingId === item.key}
                              aria-label={
                                isCarousel ? "Download all slides" : "Download design"
                              }
                            >
                              {downloadingId === item.key ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <DesignViewer
        designs={singleDesignsFlat.map((d) => ({
          id: d.id,
          title: d.title,
          prompt: d.prompt,
          image_url: d.image_url,
          created_at: d.created_at,
          canvas_size: d.canvas_size,
        }))}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <CarouselPreviewDialog
        open={!!carouselDesignId}
        onOpenChange={(open) => {
          if (!open) {
            setCarouselDesignId(null);
            setCarouselTitle(undefined);
          }
        }}
        designId={carouselDesignId}
        title={carouselTitle}
      />
    </div>
  );
};

export default HistoryV2;
