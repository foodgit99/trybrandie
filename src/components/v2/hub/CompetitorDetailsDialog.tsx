import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  FileDown,
  Globe,
  Instagram,
  ArrowRight,
  Calendar,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  buildCompetitorDeepReportPdf,
  buildRecommendedActions,
} from "@/lib/competitorDeepReportPdf";
import { cn } from "@/lib/utils";

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
  created_at?: string;
};

const SIGNAL_META: Record<
  string,
  { label: string; color: string; dot: string; tint: string }
> = {
  steal_the_angle: {
    label: "Steal the angle",
    color: "#10B981",
    dot: "bg-emerald-500",
    tint: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  seo_win: {
    label: "SEO win",
    color: "#3B82F6",
    dot: "bg-blue-500",
    tint: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  },
  positioning_shift: {
    label: "Positioning shift",
    color: "#F59E0B",
    dot: "bg-amber-500",
    tint: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function CompetitorDetailsDialog({
  open,
  onOpenChange,
  competitor,
  signals,
  brandId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  competitor: Competitor | null;
  signals: Signal[];
  brandId: string;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const compSignals = useMemo(
    () => signals.filter((s) => s.competitor_id === competitor?.id),
    [signals, competitor?.id],
  );

  const { data: snapshots = [] } = useQuery({
    queryKey: ["competitor-snapshots", competitor?.id],
    enabled: !!competitor?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitor_snapshots")
        .select("source, week_start_date, scanned_at, extracted, error")
        .eq("competitor_id", competitor!.id)
        .order("scanned_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ideaIds = compSignals
    .map((s) => s.content_idea_id)
    .filter((v): v is string => !!v);

  const { data: ideas = [] } = useQuery({
    queryKey: ["competitor-ideas", competitor?.id, ideaIds.join(",")],
    enabled: !!competitor?.id && open && ideaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_ideas")
        .select(
          "id, title, content_category, scheduled_for, campaign_rationale, funnel_rationale",
        )
        .in("id", ideaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = {
    steal_the_angle: compSignals.filter((s) => s.signal_type === "steal_the_angle").length,
    seo_win: compSignals.filter((s) => s.signal_type === "seo_win").length,
    positioning_shift: compSignals.filter((s) => s.signal_type === "positioning_shift").length,
  };

  const barData = [
    { name: "Steal the angle", value: counts.steal_the_angle, fill: "#10B981" },
    { name: "SEO win", value: counts.seo_win, fill: "#3B82F6" },
    { name: "Positioning", value: counts.positioning_shift, fill: "#F59E0B" },
  ];

  const pieData = barData.filter((d) => d.value > 0);

  const weekData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of compSignals) {
      map.set(s.week_start_date, (map.get(s.week_start_date) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([week, value]) => ({ week: fmtDate(week), value }));
  }, [compSignals]);

  const actions = competitor ? buildRecommendedActions(competitor, compSignals) : [];

  const siteSnap = snapshots.find((s: any) => s.source === "site");
  const igSnap = snapshots.find((s: any) => s.source === "instagram");

  async function handleExport() {
    if (!competitor) return;
    setExporting(true);
    try {
      const { data: brandRow } = await supabase
        .from("brands")
        .select("name, logo_url")
        .eq("id", brandId)
        .maybeSingle();
      const doc = await buildCompetitorDeepReportPdf({
        brand: {
          name: (brandRow as any)?.name ?? "Your brand",
          logo_url: (brandRow as any)?.logo_url ?? null,
        },
        competitor: competitor as any,
        signals: compSignals as any,
        snapshots: snapshots as any,
        ideas: ideas as any,
      });
      const date = new Date().toISOString().slice(0, 10);
      const slug = competitor.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      doc.save(`Brandie-${slug}-Deep-Dive-${date}.pdf`);
      toast({ title: "Report ready", description: "PDF downloaded." });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ?? "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  if (!competitor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {competitor.logo_url ? (
                <img
                  src={competitor.logo_url}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover border border-border shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-muted grid place-items-center text-lg font-semibold shrink-0">
                  {competitor.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <DialogTitle className="font-serif text-2xl truncate">
                  {competitor.name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {competitor.domain && (
                    <a
                      href={
                        competitor.domain.startsWith("http")
                          ? competitor.domain
                          : `https://${competitor.domain}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Globe className="h-3 w-3" /> {competitor.domain}
                    </a>
                  )}
                  {competitor.instagram_handle && (
                    <a
                      href={`https://instagram.com/${competitor.instagram_handle.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Instagram className="h-3 w-3" />
                      @{competitor.instagram_handle.replace(/^@/, "")}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last scan {fmtDate(competitor.last_scanned_at)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {competitor.discovery_source === "auto" ? "Auto-discovered" : "Added by you"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          {competitor.discovery_rationale && (
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
              {competitor.discovery_rationale}
            </p>
          )}
        </DialogHeader>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {barData.map((b) => (
            <div key={b.name} className="rounded-xl border border-border bg-card p-3">
              <div
                className="h-1 w-8 rounded-full mb-2"
                style={{ background: b.fill }}
              />
              <p className="text-2xl font-semibold">{b.value}</p>
              <p className="text-[11px] text-muted-foreground">{b.name}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2 mt-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Signal mix
            </p>
            {pieData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground h-48 grid place-items-center">
                No signals yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
              {weekData.length > 1 ? "Signals per week" : "Signal counts"}
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekData.length > 1 ? weekData : barData}>
                  <XAxis
                    dataKey={weekData.length > 1 ? "week" : "name"}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill="#C4993B"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Signals list */}
        <section className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-medium">All signals</h3>
            <span className="text-xs text-muted-foreground">
              ({compSignals.length})
            </span>
          </div>
          {compSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No signals yet — run a digest to surface what changed this week.
            </p>
          ) : (
            <ul className="space-y-2">
              {compSignals.map((s) => {
                const meta = SIGNAL_META[s.signal_type] ?? {
                  label: s.signal_type,
                  color: "#999",
                  dot: "bg-muted",
                  tint: "bg-muted text-foreground border-border",
                };
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-border bg-card p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="outline" className={cn("text-[10px]", meta.tint)}>
                        {meta.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {fmtDate(s.week_start_date)}
                      </span>
                    </div>
                    <p className="text-sm">{s.summary}</p>
                    {s.rationale && (
                      <p className="text-xs text-muted-foreground">{s.rationale}</p>
                    )}
                    {s.content_idea_id && (
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/post/${s.content_idea_id}`);
                        }}
                        className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      >
                        Turn into a post <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Public surface */}
        {(siteSnap?.extracted || igSnap?.extracted) && (
          <section className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Their public surface</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {siteSnap?.extracted && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Website
                  </p>
                  {(siteSnap.extracted as any).title && (
                    <p className="text-sm font-medium">
                      {(siteSnap.extracted as any).title}
                    </p>
                  )}
                  {(siteSnap.extracted as any).description && (
                    <p className="text-xs text-muted-foreground">
                      {(siteSnap.extracted as any).description}
                    </p>
                  )}
                  {(siteSnap.extracted as any).summary && (
                    <p className="text-xs leading-relaxed">
                      {(siteSnap.extracted as any).summary}
                    </p>
                  )}
                </div>
              )}
              {igSnap?.extracted && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Instagram
                  </p>
                  {(igSnap.extracted as any).summary && (
                    <p className="text-xs leading-relaxed">
                      {(igSnap.extracted as any).summary}
                    </p>
                  )}
                  {(igSnap.extracted as any).bio_and_recent && (
                    <p className="text-[11px] text-muted-foreground whitespace-pre-line line-clamp-6">
                      {(igSnap.extracted as any).bio_and_recent}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recommended actions */}
        <section className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Recommended action steps</h3>
          </div>
          <div className="space-y-3">
            {actions.map((a) => (
              <div
                key={a.title}
                className="rounded-xl border-l-4 border-primary bg-card border border-border p-3"
              >
                <p className="font-medium text-sm mb-2">{a.title}</p>
                <ol className="space-y-1.5 text-sm">
                  {a.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary font-semibold shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-muted-foreground leading-relaxed">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background border-t border-border mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-1.5" />
            {exporting ? "Preparing report…" : "Export PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
