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
import { Download, Loader2, Search, ImageIcon, Calendar } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import DesignViewer from "@/components/DesignViewer";

type Design = {
  id: string;
  title: string | null;
  prompt: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  canvas_size: string;
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: designs = [], isLoading } = useQuery({
    queryKey: ["v2-history-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("id, title, prompt, image_url, caption, created_at, canvas_size")
        .eq("user_id", user!.id)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Design[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return designs;
    return designs.filter(
      (d) =>
        d.title?.toLowerCase().includes(q) ||
        d.prompt?.toLowerCase().includes(q) ||
        d.caption?.toLowerCase().includes(q)
    );
  }, [designs, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Design[]>();
    for (const d of filtered) {
      const key = groupLabel(new Date(d.created_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleDownload = async (d: Design) => {
    try {
      setDownloadingId(d.id);
      const resp = await fetch(d.image_url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(d.title || "design").replace(/[^a-z0-9-_]+/gi, "_")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Download failed", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
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
      <SEO title="History - Brandie" description="Every generation, one tap away." path="/history" noindex />
      <NewAppHeader />

      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-8">
        <header className="space-y-2">
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">History</p>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
            Everything you've made.
          </h1>
          <p className="text-muted-foreground">
            {designs.length} {designs.length === 1 ? "generation" : "generations"} · view, download, repost.
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
              {designs.length === 0 ? "No generations yet" : "No matches"}
            </p>
            <p className="text-sm text-muted-foreground">
              {designs.length === 0
                ? "Head to the Studio or approve a daily post - they'll all land here."
                : "Try a different search."}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([label, items]) => (
              <section key={label} className="space-y-4">
                <div className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <Badge variant="secondary" className="ml-1 rounded-full text-[10px]">
                    {items.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {items.map((d) => {
                    const globalIndex = filtered.findIndex((x) => x.id === d.id);
                    return (
                      <motion.div
                        key={d.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative rounded-2xl overflow-hidden border border-border bg-card"
                      >
                        <button
                          onClick={() => {
                            setViewerIndex(globalIndex);
                            setViewerOpen(true);
                          }}
                          className="block w-full aspect-square bg-muted"
                          aria-label={`Open ${d.title || "design"}`}
                        >
                          <img
                            src={d.image_url}
                            alt={d.title || d.prompt?.slice(0, 80) || "Generated design"}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </button>

                        <div className="p-3 space-y-2">
                          <p className="text-sm font-medium line-clamp-1">
                            {d.title || "Untitled"}
                          </p>
                          {d.caption && (
                            <p className="text-xs text-muted-foreground line-clamp-2 italic">
                              {d.caption}
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(d.created_at), "h:mm a")}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => handleDownload(d)}
                              disabled={downloadingId === d.id}
                            >
                              {downloadingId === d.id ? (
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
        designs={filtered.map((d) => ({
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
    </div>
  );
};

export default HistoryV2;
