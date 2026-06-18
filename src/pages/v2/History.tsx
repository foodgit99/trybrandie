import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Search, ImageIcon, Calendar, Layers, MessageCircle, ExternalLink } from "lucide-react";
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
  content_idea_id: string | null;
  idea?: { title: string | null; scheduled_for: string | null } | null;
};

// A grouped item: either a single design or a carousel (multiple slides).
type HistoryItem =
  | { kind: "single"; key: string; cover: Design; created_at: string; sort_at: string; idea_title: string | null }
  | {
      kind: "carousel";
      key: string;
      cover: Design;
      slides: Design[];
      created_at: string;
      sort_at: string;
      idea_title: string | null;
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
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [carouselDesignId, setCarouselDesignId] = useState<string | null>(null);
  const [carouselTitle, setCarouselTitle] = useState<string | undefined>(undefined);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);


  const { data: designs = [], isLoading } = useQuery({
    queryKey: ["v2-history-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select(
          "id, title, prompt, image_url, caption, created_at, canvas_size, carousel_id, slide_index, content_idea_id, idea:content_idea_id(title, scheduled_for)",
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
  // Ordering: prefer the idea's scheduled_for date (so a carousel rendered after
  // midnight still shows up under its Blueprint day), fall back to created_at.
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

    const sortKey = (d: Design) =>
      d.idea?.scheduled_for
        ? new Date(d.idea.scheduled_for).toISOString()
        : d.created_at;

    for (const [cid, slides] of carouselMap.entries()) {
      slides.sort((a, b) => {
        const ai = a.slide_index ?? 999;
        const bi = b.slide_index ?? 999;
        return ai - bi;
      });
      const cover = slides[0];
      const created_at = slides.reduce(
        (max, s) => (s.created_at > max ? s.created_at : max),
        slides[0].created_at,
      );
      const sort_at = sortKey(cover);
      const idea_title = cover.idea?.title ?? null;
      result.push({ kind: "carousel", key: `c:${cid}`, cover, slides, created_at, sort_at, idea_title });
    }
    for (const d of singles) {
      result.push({
        kind: "single",
        key: `s:${d.id}`,
        cover: d,
        created_at: d.created_at,
        sort_at: sortKey(d),
        idea_title: d.idea?.title ?? null,
      });
    }

    result.sort((a, b) => (b.sort_at > a.sort_at ? 1 : -1));
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
      const key = groupLabel(new Date(item.sort_at));
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

  const handleWhatsApp = async (item: HistoryItem) => {
    setSharingId(item.key);
    const cover = item.cover;
    const caption = cover.caption || cover.title || "";
    const slidesToShare =
      item.kind === "carousel"
        ? item.slides.filter((s) => !!s.image_url)
        : [cover];
    const baseName = (cover.title || (item.kind === "carousel" ? "carousel" : "design"))
      .replace(/[^a-z0-9-_]+/gi, "_");

    try {
      // Try native share with image(s) + caption — the OS share sheet shows
      // WhatsApp on iOS/Android and the image + caption travel together.
      if (
        slidesToShare.length > 0 &&
        typeof navigator !== "undefined" &&
        (navigator as any).canShare
      ) {
        try {
          const files: File[] = [];
          for (let i = 0; i < slidesToShare.length; i++) {
            const s = slidesToShare[i];
            const res = await fetch(s.image_url);
            const blob = await res.blob();
            files.push(
              new File(
                [blob],
                `${baseName}${item.kind === "carousel" ? `-slide-${i + 1}` : ""}.png`,
                { type: blob.type || "image/png" },
              ),
            );
          }
          const sharePayload: ShareData = { text: caption, files };
          if ((navigator as any).canShare(sharePayload)) {
            await (navigator as any).share(sharePayload);
            try {
              if (caption) await navigator.clipboard.writeText(caption);
            } catch { /* clipboard optional */ }
            return;
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return; // user cancelled
          // fall through to wa.me fallback
        }
      }

      // Fallback: copy caption, save first slide, open wa.me with caption.
      try {
        if (caption) await navigator.clipboard.writeText(caption);
      } catch { /* clipboard optional */ }
      if (slidesToShare[0]?.image_url) {
        await downloadOne(
          slidesToShare[0].image_url,
          `${baseName}${item.kind === "carousel" ? "-slide-1" : ""}.png`,
        );
      }
      toast({
        title: "Caption copied",
        description:
          item.kind === "carousel"
            ? "First slide saved. Attach it in WhatsApp and paste the caption."
            : "Image saved. Attach it in WhatsApp and paste the caption.",
      });
      window.open(
        `https://wa.me/?text=${encodeURIComponent(caption)}`,
        "_blank",
        "noopener",
      );
    } finally {
      setSharingId(null);
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

  const handleOpenPost = async (item: HistoryItem) => {
    setOpeningId(item.key);
    try {
      const designIds =
        item.kind === "carousel"
          ? item.slides.map((s) => s.id)
          : [item.cover.id];
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id, created_at")
        .in("design_id", designIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) {
        toast({
          title: "No linked post",
          description: "This design wasn't created from a scheduled post.",
          variant: "destructive",
        });
        return;
      }
      navigate(`/post/${data.id}`);
    } catch (e) {
      toast({
        title: "Couldn't open post",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setOpeningId(null);
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
                            <div className="flex items-center gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPost(item);
                                }}
                                disabled={openingId === item.key}
                                aria-label="Open in Post"
                              >
                                {openingId === item.key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-600 hover:bg-emerald-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWhatsApp(item);
                                }}
                                disabled={sharingId === item.key}
                                aria-label={
                                  isCarousel ? "Send carousel to WhatsApp" : "Send to WhatsApp"
                                }
                              >
                                {sharingId === item.key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <MessageCircle className="h-3.5 w-3.5" />
                                )}
                              </Button>

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
