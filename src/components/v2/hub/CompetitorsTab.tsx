import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Sparkles,
  RefreshCw,
  Trash2,
  Plus,
  Wand2,
  ArrowRight,
  Globe,
  Instagram,
  TrendingUp,
  Lock,
  Eye,
} from "lucide-react";
import CompetitorDetailsDialog from "@/components/v2/hub/CompetitorDetailsDialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";


type Competitor = {
  id: string;
  name: string;
  domain: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  discovery_source: "auto" | "user";
  discovery_rationale: string | null;
  last_scanned_at: string | null;
};

type Signal = {
  id: string;
  competitor_id: string;
  signal_type: string;
  summary: string;
  rationale: string | null;
  content_idea_id: string | null;
  week_start_date: string;
};

function tierCap(planId: string | null | undefined): number | null {
  if (planId === "agency") return null;
  if (planId === "creator") return 3;
  return 1;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never scanned";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Scanned today";
  if (d === 1) return "Scanned yesterday";
  if (d < 7) return `Scanned ${d}d ago`;
  return `Scanned ${new Date(iso).toLocaleDateString()}`;
}

export default function CompetitorsTab({ brand }: { brand: { id: string } }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: sub } = useSubscription();
  const cap = tierCap((sub as any)?.planId);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);


  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ["hub-competitors", brand.id],
    queryFn: async (): Promise<Competitor[]> => {
      const { data, error } = await supabase
        .from("brand_competitors")
        .select("*")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Competitor[];
    },
  });

  const { data: signals = [] } = useQuery({
    queryKey: ["hub-competitor-signals", brand.id],
    queryFn: async (): Promise<Signal[]> => {
      const { data, error } = await supabase
        .from("competitor_signals")
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Signal[];
    },
  });

  const signalsByCompetitor = new Map<string, Signal[]>();
  for (const s of signals) {
    const arr = signalsByCompetitor.get(s.competitor_id) ?? [];
    arr.push(s);
    signalsByCompetitor.set(s.competitor_id, arr);
  }

  const atCap = cap !== null && competitors.length >= cap;

  const discoverAuto = useMutation({
    mutationFn: async () => {
      setDiscovering(true);
      const { data, error } = await supabase.functions.invoke("competitor-discover", {
        body: { brand_id: brand.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["hub-competitors", brand.id] });
      toast({
        title: "Competitors discovered",
        description: `Added ${data?.inserted ?? 0} rivals. ${data?.skipped ?? 0} skipped.`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Could not discover competitors",
        description: e?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    },
    onSettled: () => setDiscovering(false),
  });

  const removeCompetitor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("brand_competitors")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hub-competitors", brand.id] }),
  });

  const rescan = useMutation({
    mutationFn: async (id: string) => {
      setBusyId(id);
      const { error } = await supabase.functions.invoke("competitor-scan", {
        body: { competitor_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-competitors", brand.id] });
      toast({ title: "Refreshed", description: "Fresh snapshot pulled." });
    },
    onError: (e: any) =>
      toast({
        title: "Scan failed",
        description: e?.message ?? "Try again shortly.",
        variant: "destructive",
      }),
    onSettled: () => setBusyId(null),
  });

  const runDigest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("competitor-digest", {
        body: { brand_id: brand.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-competitor-signals", brand.id] });
      qc.invalidateQueries({ queryKey: ["hub-ideas", brand.id] });
      toast({ title: "Digest ready", description: "New signals and ideas are live." });
    },
    onError: (e: any) =>
      toast({
        title: "Digest failed",
        description: e?.message ?? "Try again shortly.",
        variant: "destructive",
      }),
  });

  const addManual = useMutation({
    mutationFn: async (payload: { name: string; domain: string; instagram_handle: string | null }) => {
      const { error } = await supabase.from("brand_competitors").insert({
        brand_id: brand.id,
        name: payload.name,
        domain: payload.domain,
        instagram_handle: payload.instagram_handle,
        discovery_source: "user",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hub-competitors", brand.id] });
      setAddOpen(false);
      toast({ title: "Added", description: "Competitor tracked." });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("COMPETITOR_LIMIT_REACHED")) {
        toast({
          title: "You're at your competitor limit",
          description: "Upgrade to Creator or Agency to track more.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Could not add", description: msg, variant: "destructive" });
      }
    },
  });





  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Competitors</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Brandie watches your rivals every week — what they launch, how they position, and where they're winning — then turns the best angles into posts on your Blueprint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {competitors.length}
            {cap !== null ? ` / ${cap}` : ""} tracked
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={runDigest.isPending || competitors.length === 0}
            onClick={() => runDigest.mutate()}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {runDigest.isPending ? "Digesting…" : "Run digest"}
          </Button>


          <AddCompetitorDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            disabled={atCap}
            onSubmit={(p) => addManual.mutate(p)}
            submitting={addManual.isPending}
          />
        </div>
      </div>

      {/* Empty state */}
      {competitors.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center space-y-4">
          <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="space-y-1.5">
            <h3 className="font-serif text-xl">No competitors yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Let Brandie auto-discover your top {cap ?? "few"} rivals from your industry and audience. Takes about 15 seconds.
            </p>
          </div>
          <Button onClick={() => discoverAuto.mutate()} disabled={discovering}>
            <Wand2 className="h-4 w-4 mr-1.5" />
            {discovering ? "Discovering…" : "Auto-discover competitors"}
          </Button>
        </div>
      )}

      {/* Grid */}
      {competitors.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => {
            const ss = signalsByCompetitor.get(c.id) ?? [];
            return (
              <motion.article
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3"
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center text-sm font-semibold">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {timeAgo(c.last_scanned_at)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      c.discovery_source === "auto" && "border-primary/40 text-primary",
                    )}
                  >
                    {c.discovery_source === "auto" ? "Auto" : "Yours"}
                  </Badge>
                </header>

                {c.discovery_rationale && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {c.discovery_rationale}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {c.domain && (
                    <a
                      href={c.domain.startsWith("http") ? c.domain : `https://${c.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted hover:bg-muted/70"
                    >
                      <Globe className="h-3 w-3" /> {c.domain}
                    </a>
                  )}
                  {c.instagram_handle && (
                    <a
                      href={`https://instagram.com/${c.instagram_handle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted hover:bg-muted/70"
                    >
                      <Instagram className="h-3 w-3" /> @{c.instagram_handle.replace(/^@/, "")}
                    </a>
                  )}
                </div>

                {ss.length > 0 && (
                  <div className="mt-1 space-y-2 border-t border-border pt-3">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                      This week
                    </p>
                    {ss.slice(0, 3).map((s) => (
                      <div key={s.id} className="text-xs space-y-0.5">
                        <p className="flex items-start gap-1.5">
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                              s.signal_type === "steal_the_angle"
                                ? "bg-emerald-500"
                                : s.signal_type === "seo_win"
                                ? "bg-blue-500"
                                : "bg-amber-500",
                            )}
                          />
                          <span className="line-clamp-2">{s.summary}</span>
                        </p>
                        {s.content_idea_id && (
                          <button
                            onClick={() => navigate(`/post/${s.content_idea_id}`)}
                            className="ml-3 inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                          >
                            Turn into a post <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <footer className="mt-auto flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === c.id}
                    onClick={() => rescan.mutate(c.id)}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5 mr-1", busyId === c.id && "animate-spin")}
                    />
                    Refresh
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailsId(c.id)}
                      title="View details"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCompetitor.mutate(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </footer>

              </motion.article>
            );
          })}
        </div>
      )}

      {atCap && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You're tracking the max for your plan. Upgrade to watch more rivals.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/plans")}>
            Upgrade
          </Button>
        </div>
      )}
        </div>
      )}

      <CompetitorDetailsDialog
        open={!!detailsId}
        onOpenChange={(v) => !v && setDetailsId(null)}
        competitor={competitors.find((c) => c.id === detailsId) ?? null}
        signals={signals}
        brandId={brand.id}
      />
    </div>
  );
}


function AddCompetitorDialog({
  open,
  onOpenChange,
  disabled,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  disabled: boolean;
  onSubmit: (p: { name: string; domain: string; instagram_handle: string | null }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [handle, setHandle] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="h-4 w-4 mr-1.5" /> Add manually
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a competitor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Domain (e.g. example.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <Input
            placeholder="Instagram handle (optional)"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={submitting || !name.trim() || !domain.trim()}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                domain: domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, ""),
                instagram_handle: handle.trim() ? handle.trim().replace(/^@/, "") : null,
              })
            }
          >
            {submitting ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
