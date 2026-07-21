import { useEffect, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Palette,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  buildCompetitorDeepReportPdf,
  buildRecommendedActions,
} from "@/lib/competitorDeepReportPdf";
import { citationsForSignal } from "@/lib/competitorSources";
import { resolveReportAccess, policyForTier } from "@/lib/reportAccess";
import { cn } from "@/lib/utils";


const DEFAULT_ACCENT = "#C4993B";
const ACCENT_SWATCHES = [
  "#C4993B", // Brandie gold
  "#2B2D33", // Charcoal
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#EC4899", // Pink
];

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
  metadata?: any;
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

type PolicyRow = { label: string; included: boolean; note?: string };

function buildPolicyRows(policy: ReturnType<typeof policyForTier>): PolicyRow[] {
  return [
    {
      label: "Signal rationale ('Why it matters')",
      included: policy.showSignalRationale,
    },
    {
      label: "Snapshot excerpts of their public surface",
      included: policy.showSnapshotExcerpts,
    },
    {
      label: "'What to steal this week' ideas playbook",
      included: policy.showIdeas,
      note:
        policy.showIdeas && policy.maxIdeas != null
          ? `Capped at ${policy.maxIdeas}`
          : undefined,
    },
    {
      label: "Recommended action steps",
      included: policy.showRecommendedActions,
    },
    {
      label: "Sources & citations appendix",
      included: policy.showSourcesAppendix,
      note:
        policy.showSourcesAppendix && policy.maxCitations != null
          ? `Capped at ${policy.maxCitations}`
          : undefined,
    },
    {
      label: "Full signals table",
      included: true,
      note:
        policy.maxSignalsInTable != null
          ? `Capped at ${policy.maxSignalsInTable}`
          : "All signals included",
    },
  ];
}

function ExportPolicyBanner({
  policy,
  isTeamMember,
  preparedByEmail,
}: {
  policy: ReturnType<typeof policyForTier>;
  isTeamMember: boolean;
  preparedByEmail: string | null;
}) {
  const rows = buildPolicyRows(policy);
  const tone = policy.isFull
    ? {
        wrap: "border-emerald-500/30 bg-emerald-500/5",
        icon: "text-emerald-600",
        Icon: ShieldCheck,
        headline: `Full ${policy.tierLabel} export`,
        sub: "No watermark. Every section will be included in your PDF.",
      }
    : policy.watermark === "diagonal"
      ? {
          wrap: "border-amber-500/40 bg-amber-500/10",
          icon: "text-amber-700",
          Icon: ShieldAlert,
          headline: `${policy.tierLabel} — sample export`,
          sub: `A diagonal "${policy.watermarkText}" watermark will be stamped across every page, and several sections will be redacted.`,
        }
      : {
          wrap: "border-amber-500/30 bg-amber-500/5",
          icon: "text-amber-700",
          Icon: ShieldAlert,
          headline: `${policy.tierLabel} export — partial redactions`,
          sub: `A subtle footer watermark ("${policy.watermarkText}") will appear on every page. Some sections are capped or hidden.`,
        };
  const Icon = tone.Icon;
  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-3 sm:p-4",
        tone.wrap,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", tone.icon)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{tone.headline}</p>
            <Badge variant="outline" className="text-[10px]">
              Before you export
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{tone.sub}</p>

          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.label} className="flex items-start gap-2 text-xs">
                {r.included ? (
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(
                    "leading-snug",
                    r.included ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  {r.label}
                  {r.note && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground no-underline">
                      · {r.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {isTeamMember && preparedByEmail && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              You'll be credited as <span className="font-medium">Prepared by {preparedByEmail}</span> in
              the footer. Tier is inherited from the brand owner's plan.
            </p>
          )}
          {!policy.isFull && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Upgrade the brand owner's plan to remove the watermark and unlock hidden sections.
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Report branding controls (persisted on brands row)
  const { data: brandRow, refetch: refetchBrand } = useQuery({
    queryKey: ["brand-report-branding", brandId],
    enabled: !!brandId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("name, logo_url, report_title, report_accent_color, report_logo_url")
        .eq("id", brandId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [reportTitle, setReportTitle] = useState("");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [reportLogoUrl, setReportLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!brandRow) return;
    setReportTitle((brandRow as any).report_title ?? "");
    setAccentColor((brandRow as any).report_accent_color ?? DEFAULT_ACCENT);
    setReportLogoUrl(
      (brandRow as any).report_logo_url ?? (brandRow as any).logo_url ?? null,
    );
  }, [brandRow]);

  async function saveBranding() {
    setSavingBranding(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update({
          report_title: reportTitle.trim() || null,
          report_accent_color: accentColor || null,
          report_logo_url: reportLogoUrl || null,
        })
        .eq("id", brandId);
      if (error) throw error;
      await refetchBrand();
      toast({ title: "Report branding saved" });
    } catch (e: any) {
      toast({
        title: "Couldn't save",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${brandId}/report-logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("brand-logos").getPublicUrl(path);
      setReportLogoUrl(pub.publicUrl);
      toast({ title: "Logo uploaded", description: "Click Save to apply." });
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message ?? "Try a smaller image.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  }


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

  const { data: reportAccess } = useQuery({
    queryKey: ["report-access", brandId],
    enabled: !!brandId && open,
    queryFn: () => resolveReportAccess(brandId),
  });
  const policy = reportAccess ? policyForTier(reportAccess.tier) : null;

  async function handleExport() {
    if (!competitor) return;
    setExporting(true);
    try {
      const access = reportAccess ?? (await resolveReportAccess(brandId));
      const doc = await buildCompetitorDeepReportPdf({
        brand: {
          name: (brandRow as any)?.name ?? "Your brand",
          logo_url: (brandRow as any)?.logo_url ?? null,
        },
        competitor: competitor as any,
        signals: compSignals as any,
        snapshots: snapshots as any,
        ideas: ideas as any,
        branding: {
          reportTitle: reportTitle.trim() || null,
          accentColor: accentColor || null,
          brandLogoUrl: reportLogoUrl,
        },
        access,
      });
      const date = new Date().toISOString().slice(0, 10);
      const slug = competitor.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const titleSlug = (reportTitle.trim() || "Deep-Dive")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");
      const tierSuffix = access.tier === "agency" ? "" : `-${access.tier}`;
      doc.save(`Brandie-${slug}-${titleSlug}${tierSuffix}-${date}.pdf`);
      toast({
        title: "Report ready",
        description: policyForTier(access.tier).isFull
          ? "PDF downloaded."
          : `Redacted preview downloaded (${policyForTier(access.tier).tierLabel}).`,
      });
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

        {/* Export policy banner — shows what the current tier will include or redact */}
        {policy && (
          <ExportPolicyBanner
            policy={policy}
            isTeamMember={!!reportAccess?.isTeamMember}
            preparedByEmail={reportAccess?.preparedByEmail ?? null}
          />
        )}



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
                    {(() => {
                      const cites = citationsForSignal(s, competitor);
                      if (cites.length === 0) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            Sources
                          </span>
                          {cites.map((c) => (
                            <a
                              key={c.url}
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-foreground/80 hover:text-primary hover:border-primary/40"
                              title={c.url}
                            >
                              {c.channel === "instagram" ? (
                                <Instagram className="h-2.5 w-2.5" />
                              ) : (
                                <Globe className="h-2.5 w-2.5" />
                              )}
                              {c.label}
                            </a>
                          ))}
                        </div>
                      );
                    })()}
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
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background border-t border-border mt-6 flex flex-wrap justify-end gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Palette className="h-4 w-4 mr-1.5" style={{ color: accentColor }} />
                Report branding
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Customize your PDF</p>
                <p className="text-xs text-muted-foreground">
                  Applied to every report you export for this brand.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-title" className="text-xs">
                  Report title
                </Label>
                <Input
                  id="report-title"
                  placeholder="Competitor Deep Dive"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  maxLength={60}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Accent color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick accent color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-9 rounded-md border border-border bg-transparent cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 flex-1 font-mono text-xs"
                    maxLength={7}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ACCENT_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccentColor(c)}
                      className={cn(
                        "h-6 w-6 rounded-full border transition",
                        accentColor.toLowerCase() === c.toLowerCase()
                          ? "border-foreground ring-2 ring-offset-1 ring-foreground/30"
                          : "border-border hover:scale-110",
                      )}
                      style={{ background: c }}
                      aria-label={`Use ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Report logo</Label>
                <div className="flex items-center gap-2">
                  {reportLogoUrl ? (
                    <img
                      src={reportLogoUrl}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md border border-dashed border-border grid place-items-center text-[10px] text-muted-foreground">
                      Logo
                    </div>
                  )}
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleLogoUpload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full cursor-pointer"
                      disabled={uploadingLogo}
                    >
                      <span>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        {uploadingLogo ? "Uploading…" : "Upload"}
                      </span>
                    </Button>
                  </label>
                  {reportLogoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReportLogoUrl(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Falls back to your brand logo when empty.
                </p>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={saveBranding} disabled={savingBranding}>
                  {savingBranding ? "Saving…" : "Save branding"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {policy && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                policy.isFull
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-700 border-amber-500/30",
              )}
              title={
                policy.isFull
                  ? "Full report — no watermark, all sections included."
                  : `Redacted export. Watermark: ${policy.watermark}. Hidden: ${[
                      !policy.showSignalRationale && "signal rationale",
                      !policy.showSnapshotExcerpts && "snapshot excerpts",
                      !policy.showIdeas && "ideas playbook",
                      !policy.showRecommendedActions && "action steps",
                      !policy.showSourcesAppendix && "sources appendix",
                    ]
                      .filter(Boolean)
                      .join(", ") || "some sections"}.`
              }
            >
              {policy.isFull ? "Full export" : `${policy.tierLabel} · watermarked`}
            </Badge>
          )}
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
