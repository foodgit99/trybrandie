import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, TrendingUp, ArrowRight, Radio, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = {
  title: string;
  summary: string;
  relevance_to_brand: string;
  content_angles: string[];
};

type IntelRow = {
  trends_data: Trend[] | null;
  generated_at: string | null;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function TrendsTab({
  brand,
  onSeedStudio,
  onCampaignCreated,
}: {
  brand: { id: string; name: string };
  onSeedStudio: (prompt: string) => void;
  onCampaignCreated?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [costInfo, setCostInfo] = useState<{ is_free: boolean; credits_required: number; available_credits: number } | null>(null);
  const [campaignFor, setCampaignFor] = useState<Trend | null>(null);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [savingCampaign, setSavingCampaign] = useState(false);

  useEffect(() => {
    if (!campaignFor) return;
    setCName(campaignFor.title.slice(0, 80));
    setCDesc(
      [campaignFor.summary, campaignFor.relevance_to_brand].filter(Boolean).join("\n\n"),
    );
    setPicked((campaignFor.content_angles ?? []).map((_, i) => i));
  }, [campaignFor]);

  const createCampaign = async () => {
    if (!campaignFor || !user) return;
    if (!cName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSavingCampaign(true);
    try {
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          brand_id: brand.id,
          user_id: user.id,
          name: cName.trim(),
          description: cDesc.trim(),
          content_category: "trending",
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const angles = (campaignFor.content_angles ?? []).filter((_, i) => picked.includes(i));
      if (angles.length > 0) {
        const rows = angles.map((angle, i) => {
          const when = new Date();
          when.setDate(when.getDate() + i + 1);
          when.setHours(9, 0, 0, 0);
          return {
            brand_id: brand.id,
            user_id: user.id,
            campaign_id: (campaign as any).id,
            title: angle.slice(0, 120),
            prompt: `${campaignFor.title} — ${angle}\n\nTrend context: ${campaignFor.summary}`,
            content_category: "trending",
            content_format: "graphic",
            idea_type: "single",
            status: "scheduled",
            scheduled_for: when.toISOString(),
          };
        });
        const { error: ideaErr } = await supabase.from("content_ideas").insert(rows as never);
        if (ideaErr) throw ideaErr;
      }

      qc.invalidateQueries({ queryKey: ["hub-campaigns", brand.id] });
      qc.invalidateQueries({ queryKey: ["hub-ideas", brand.id] });
      toast({
        title: "Campaign created",
        description: angles.length
          ? `${angles.length} post${angles.length > 1 ? "s" : ""} scheduled from this trend.`
          : "Add posts to it whenever you're ready.",
      });
      setCampaignFor(null);
      onCampaignCreated?.();
    } catch (e: any) {
      toast({ title: "Couldn't create campaign", description: e?.message, variant: "destructive" });
    } finally {
      setSavingCampaign(false);
    }
  };

  const { data: intel, isLoading } = useQuery({
    queryKey: ["hub-trends", brand.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_trend_intel")
        .select("trends_data, generated_at")
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as IntelRow | null;
    },
  });

  const refresh = useMutation({
    mutationFn: async (force: boolean) => {
      const { data, error } = await supabase.functions.invoke("trend-scout", {
        body: { brand_id: brand.id, force_refresh: force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { trends: Trend[]; generated_at: string; cached?: boolean };
    },
    onSuccess: (data) => {
      qc.setQueryData(["hub-trends", brand.id], {
        trends_data: data.trends,
        generated_at: data.generated_at,
      } satisfies IntelRow);
      toast({ title: data.cached ? "Trends loaded" : "Trends refreshed" });
    },
    onError: (e: any) => {
      toast({ title: "Trend scan failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const handleRefreshClick = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("trend-scout", {
        body: { brand_id: brand.id, check_only: true },
      });
      if (error) throw error;
      const info = data as { is_free: boolean; credits_required: number; available_credits: number };
      setCostInfo(info);
      if (info.is_free) {
        refresh.mutate(true);
      } else {
        setConfirmOpen(true);
      }
    } catch (e: any) {
      toast({ title: "Could not check refresh cost", description: e?.message, variant: "destructive" });
    }
  };

  const trends = intel?.trends_data ?? [];
  const hasData = trends.length > 0;
  const busy = refresh.isPending;

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <Radio className="h-3 w-3" />
            <span>Live · scanned weekly</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif tracking-tight mt-1">What's trending now</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {hasData && intel?.generated_at
              ? `Updated ${timeAgo(intel.generated_at)} · tuned to ${brand.name}'s industry and audience`
              : `Industry signals tuned to ${brand.name}'s audience`}
          </p>
        </div>
        {hasData && (
          <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRefreshClick} disabled={busy}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", busy && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      {/* States */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !hasData ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <TrendingUp className="h-6 w-6 mx-auto text-muted-foreground" />
          <h3 className="mt-3 text-sm font-medium">No trend scan yet</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Run a free weekly scan to surface what's moving in your industry and with your target customer.
          </p>
          <Button size="sm" className="rounded-xl mt-4" onClick={handleRefreshClick} disabled={busy}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {busy ? "Scanning…" : "Scan trends"}
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {trends.map((t, idx) => (
            <motion.li
              key={`${t.title}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.04 }}
              className="rounded-2xl border border-border bg-card/40 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                    Trend {String(idx + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-serif text-xl tracking-tight mt-1">{t.title}</h3>
                </div>
                <Badge variant="outline" className="rounded-full text-[10px] shrink-0">
                  <TrendingUp className="h-3 w-3 mr-1" /> Live
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mt-2">{t.summary}</p>

              {t.relevance_to_brand && (
                <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs">
                  <span className="font-medium">Why this matters: </span>
                  <span className="text-muted-foreground">{t.relevance_to_brand}</span>
                </div>
              )}

              {Array.isArray(t.content_angles) && t.content_angles.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                    Content angles
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.content_angles.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => onSeedStudio(`${t.title}: ${a}`)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-secondary/60 transition-colors text-left"
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => onSeedStudio(`${t.title} — ${t.summary}`)}
                >
                  Turn into a post <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
                <Button size="sm" className="rounded-xl" onClick={() => setCampaignFor(t)}>
                  <Megaphone className="h-3.5 w-3.5 mr-1.5" /> Turn into a campaign
                </Button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh trends?</AlertDialogTitle>
            <AlertDialogDescription>
              Your free weekly scan is used. Refreshing again costs{" "}
              <strong>{costInfo?.credits_required ?? 2} credits</strong>. You have{" "}
              {costInfo?.available_credits ?? 0} available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                refresh.mutate(true);
              }}
            >
              Use credits & refresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
