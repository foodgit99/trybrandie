import { useEffect, useMemo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Target,
  Megaphone,
  Layers,
  Heart,
  Calendar,
  ArrowRight,
  Activity,
  CheckCircle2,
  Clock,
  Wand2,
  Power,
  Sun,
  CalendarDays,
  Gauge,
  TrendingUp,
} from "lucide-react";

import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import AgentChatDock, { AgentContext } from "@/components/v2/AgentChatDock";
import { CONTENT_CATEGORIES, getCategoryMeta } from "@/lib/contentCategories";
import { cn } from "@/lib/utils";
import IdeaThumb from "@/components/v2/IdeaThumb";
import FunnelsEditableTab from "@/components/v2/hub/FunnelsEditableTab";
import CampaignsEditableTab from "@/components/v2/hub/CampaignsEditableTab";
import TrendsTab from "@/components/v2/hub/TrendsTab";

/* ------------------------------ Funnel model ------------------------------ */

type FunnelStageId = "awareness" | "consideration" | "conversion" | "retention";

const FUNNEL_STAGES: Array<{
  id: FunnelStageId;
  label: string;
  blurb: string;
  icon: any;
  accent: string;
  categories: string[];
}> = [
  { id: "awareness", label: "Awareness", blurb: "Get strangers to notice you.", icon: Sparkles, accent: "from-sky-500/20 to-sky-500/0 text-sky-700 dark:text-sky-300", categories: ["educational", "informational", "trending", "entertainment"] },
  { id: "consideration", label: "Consideration", blurb: "Turn lookers into trust.", icon: Layers, accent: "from-violet-500/20 to-violet-500/0 text-violet-700 dark:text-violet-300", categories: ["social_proof", "bts", "interactive"] },
  { id: "conversion", label: "Conversion", blurb: "Move trust into sales.", icon: Target, accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-700 dark:text-emerald-300", categories: ["promotional", "announcement"] },
  { id: "retention", label: "Retention", blurb: "Keep customers coming back.", icon: Heart, accent: "from-rose-500/20 to-rose-500/0 text-rose-700 dark:text-rose-300", categories: ["holidays"] },
];

function categoryToStage(catId?: string | null): FunnelStageId {
  if (!catId) return "awareness";
  return (FUNNEL_STAGES.find((st) => st.categories.includes(catId))?.id ?? "awareness") as FunnelStageId;
}

/* -------------------------------- Types ---------------------------------- */

type Idea = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  approval_status: string;
  scheduled_for: string | null;
  content_category: string | null;
  funnel_stage: string | null;
  campaign_id: string | null;
  campaign_rationale: string | null;
  funnel_rationale: string | null;
  design_id: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
  created_at: string;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  post_count: number;
  content_category: string | null;
  created_at: string;
};

type Blueprint = {
  id: string;
  week_start_date: string;
  status: string;
  approved_at: string | null;
  source: string;
  created_at: string;
};

type EngineSettings = { enabled: boolean; delivery_time: string } | null;

type TabId = "today" | "week" | "funnels" | "campaigns" | "trends";

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "week", label: "This Week", icon: CalendarDays },
  { id: "funnels", label: "Funnels", icon: Layers },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const Hub = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabId) || "today";

  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  const { data: ideas = [] } = useQuery({
    queryKey: ["hub-ideas", brand?.id],
    enabled: !!brand?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id,title,prompt,status,approval_status,scheduled_for,content_category,funnel_stage,campaign_id,campaign_rationale,funnel_rationale,design_id,created_at,design:design_id(image_url,caption)")
        .eq("brand_id", brand!.id)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["hub-campaigns", brand?.id],
    enabled: !!brand?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id,name,description,post_count,content_category,created_at")
        .eq("brand_id", brand!.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const { data: blueprints = [] } = useQuery({
    queryKey: ["hub-blueprints", brand?.id],
    enabled: !!brand?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_blueprints")
        .select("id,week_start_date,status,approved_at,source,created_at")
        .eq("brand_id", brand!.id)
        .order("week_start_date", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Blueprint[];
    },
  });

  const { data: engine } = useQuery<EngineSettings>({
    queryKey: ["hub-engine", brand?.id],
    enabled: !!brand?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("autopilot_settings")
        .select("enabled, delivery_time")
        .eq("brand_id", brand!.id)
        .maybeSingle();
      return (data as EngineSettings) ?? null;
    },
  });

  useEffect(() => {
    if (!brand?.id) return;
    const channel = supabase
      .channel(`hub-ideas-${brand.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_ideas", filter: `brand_id=eq.${brand.id}` },
        () => {}
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [brand?.id]);

  const today = useMemo(() => new Date(), []);

  const todayIdeas = useMemo(
    () => ideas.filter((i) => i.scheduled_for && isSameDay(new Date(i.scheduled_for), today)),
    [ideas, today]
  );

  const stageBuckets = useMemo(() => {
    const map: Record<FunnelStageId, Idea[]> = { awareness: [], consideration: [], conversion: [], retention: [] };
    ideas.forEach((i) => { map[categoryToStage(i.content_category)].push(i); });
    return map;
  }, [ideas]);

  const agentContext: AgentContext = useMemo(() => {
    if (tab === "today") return { scope: "content", label: "Today's posts" };
    if (tab === "week") return { scope: "strategy", label: "Weekly strategic arc" };
    if (tab === "funnels") return { scope: "funnel", label: "Funnel overview" };
    if (tab === "campaigns") return { scope: "campaign", label: "Campaign library" };
    if (tab === "trends") return { scope: "trends", label: "Industry trends" };
    return { scope: "hub", label: "Content Hub" };
  }, [tab]);

  if (authLoading || brandLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth?next=/hub" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-background pb-32 lg:pl-20">
      <SEO title="Content Hub, Brandie" description="Your autonomous content cockpit: today, this week, funnels, and campaigns, orchestrated end-to-end." path="/hub" />
      <NewAppHeader />

      <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-6xl mx-auto space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span>Content Hub</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif tracking-tight">
            Today, this week, end-to-end.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
            Everything the engine has planned, lined up by funnel and campaign. Tap any post to open it for review or hand it back to your strategist.
          </p>
        </header>

        {/* Engine status, mirrors /engine live card */}
        <section className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-stretch">
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl border p-5 transition-colors",
              engine?.enabled
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card"
            )}
          >
            {/* Ambient "engine working" pulse, sweeps left → right */}
            {engine?.enabled && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/2 rounded-3xl"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, hsl(152 85% 55% / 0.35) 45%, hsl(152 95% 70% / 0.6) 50%, hsl(152 85% 55% / 0.35) 55%, transparent 100%)",
                  filter: "blur(8px)",
                }}
                initial={{ left: "-50%" }}
                animate={{ left: ["-50%", "100%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }}
              />
            )}

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p
                  className={cn(
                    "text-[10px] tracking-[0.22em] uppercase",
                    engine?.enabled ? "text-background/60" : "text-muted-foreground"
                  )}
                >
                  {engine?.enabled ? "Running" : "Standby"}
                </p>
                <p className="font-serif text-2xl tracking-tight mt-1">
                  {engine?.enabled ? "Engine live" : "Engine off"}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "relative mt-3 flex items-center gap-1.5 text-[11px]",
                engine?.enabled ? "text-background/70" : "text-muted-foreground"
              )}
            >
              {engine?.enabled ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              )}
              {ideas.length} ideas · {campaigns.length} campaigns · {blueprints.length} blueprints
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:justify-center">
            <Button variant="outline" className="rounded-2xl h-auto py-3 justify-start gap-2" onClick={() => navigate("/engine")}>
              <Power className="h-4 w-4" /> Engine
            </Button>
            <Button variant="outline" className="rounded-2xl h-auto py-3 justify-start gap-2" onClick={() => navigate("/studio")}>
              <Wand2 className="h-4 w-4" /> Studio
            </Button>
          </div>
        </section>

        {/* Tabs */}
        <nav aria-label="Content sections" className="relative">
          <div className="inline-flex w-full sm:w-auto items-center gap-1.5 p-1.5 rounded-2xl border border-border bg-muted/60 shadow-inner overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-pressed={active}
                  className={cn(
                    "relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                    active
                      ? "text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="hub-tab-pill"
                      className="absolute inset-0 rounded-xl bg-foreground shadow-md ring-1 ring-foreground/10"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative tracking-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>


        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "today" && (
              <TodayTab
                ideas={todayIdeas}
                onOpenPost={(id) => navigate(`/post/${id}`)}
                onOpenCockpit={() => navigate("/cockpit")}
              />
            )}
            {tab === "week" && (
              <WeekTab
                blueprints={blueprints}
                ideas={ideas}
                onOpenBlueprint={() => navigate("/blueprint")}
                onOpenPost={(id) => navigate(`/post/${id}`)}
              />
            )}
            {tab === "funnels" && (
              <FunnelsEditableTab
                ideas={ideas}
                brand={brand}
                onOpenPost={(id) => navigate(`/post/${id}`)}
                invalidateKeys={[["hub-ideas", brand.id], ["brands-and-memberships"]]}
              />
            )}
            {tab === "campaigns" && (
              <CampaignsEditableTab
                campaigns={campaigns}
                ideas={ideas}
                brand={brand}
                onOpenPost={(id) => navigate(`/post/${id}`)}
                invalidateKeys={[["hub-campaigns", brand.id], ["hub-ideas", brand.id]]}
              />
            )}
            {tab === "trends" && (
              <TrendsTab
                brand={brand}
                onSeedStudio={(prompt) => navigate(`/studio?prompt=${encodeURIComponent(prompt)}&category=trending`)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AgentChatDock brandId={brand.id} context={agentContext} />
    </div>
  );
};

export default Hub;

/* ============================== Sub-sections ============================== */

function TodayTab({
  ideas, onOpenPost, onOpenCockpit,
}: { ideas: Idea[]; onOpenPost: (id: string) => void; onOpenCockpit: () => void }) {
  if (ideas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Sun className="h-6 w-6 mx-auto text-muted-foreground" />
        <h3 className="mt-3 text-sm font-medium">Nothing scheduled for today</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          Open the Cockpit to see this week's plan, or ask the strategist below to fill the day.
        </p>
        <Button size="sm" variant="outline" className="rounded-xl mt-4" onClick={onOpenCockpit}>
          Open Cockpit <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
      {ideas.map((i) => {
        const cat = getCategoryMeta(i.content_category ?? "");
        return (
          <li key={i.id}>
            <button onClick={() => onOpenPost(i.id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors">
              <IdeaThumb design={i.design} emoji={cat?.emoji} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{i.title}</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {cat?.label ?? "-"} · {i.status}
                </span>
                {i.design?.caption && (
                  <span className="block text-[11px] text-muted-foreground/80 italic truncate mt-0.5">
                    "{i.design.caption}"
                  </span>
                )}
              </span>
              <Badge variant="secondary" className="rounded-full text-[10px]">{i.approval_status}</Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function WeekTab({
  blueprints, ideas, onOpenBlueprint, onOpenPost,
}: { blueprints: Blueprint[]; ideas: Idea[]; onOpenBlueprint: () => void; onOpenPost: (id: string) => void }) {
  const current = blueprints[0];
  const currentIdeas = current
    ? ideas.filter((i) => {
        if (!i.scheduled_for) return false;
        const d = new Date(i.scheduled_for);
        const start = new Date(current.week_start_date);
        const end = new Date(start); end.setDate(start.getDate() + 7);
        return d >= start && d < end;
      })
    : [];

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground">This week's strategic arc</div>
            <h3 className="text-lg font-medium mt-1">
              {current ? `Week of ${new Date(current.week_start_date).toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : "No active blueprint"}
            </h3>
            <div className="mt-1 text-xs text-muted-foreground">
              {current ? `${current.status}${current.approved_at ? " · approved" : ""}` : "The engine will draft one on its next run."}
            </div>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onOpenBlueprint}>
            Open Blueprint <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>

        {currentIdeas.length > 0 && (
          <ol className="mt-5 space-y-2">
            {currentIdeas.slice(0, 7).map((i, idx) => {
              const cat = getCategoryMeta(i.content_category ?? "");
              return (
                <li key={i.id}>
                  <button onClick={() => onOpenPost(i.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-secondary/40 transition-colors text-left">
                    <span className="text-[10px] tabular-nums text-muted-foreground w-5">{String(idx + 1).padStart(2, "0")}</span>
                    <IdeaThumb design={i.design} emoji={cat?.emoji} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{i.title}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {i.scheduled_for ? new Date(i.scheduled_for).toLocaleDateString(undefined, { weekday: "short" }) : "Unscheduled"} · {cat?.label ?? "-"}
                      </span>
                      {i.design?.caption && (
                        <span className="block text-[11px] text-muted-foreground/80 italic truncate mt-0.5">
                          "{i.design.caption}"
                        </span>
                      )}
                    </span>
                    <Badge variant="secondary" className="rounded-full text-[10px]">{i.status}</Badge>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border p-4 bg-card/40">
          <div className="text-xs text-muted-foreground">Pillar mix</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CONTENT_CATEGORIES.map((c) => {
              const count = ideas.filter((i) => i.content_category === c.id).length;
              if (!count) return null;
              return (
                <Badge key={c.id} className={cn("rounded-full text-[10px] border", c.badgeClass)} variant="outline">
                  {c.emoji} {c.short} · {count}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-border p-4 bg-card/40">
          <div className="text-xs text-muted-foreground">Recent blueprints</div>
          <ul className="mt-3 space-y-1.5">
            {blueprints.slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-center justify-between text-xs">
                <span>{new Date(b.week_start_date).toLocaleDateString()}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {b.approved_at ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Clock className="h-3 w-3" />}
                  {b.status}
                </span>
              </li>
            ))}
            {blueprints.length === 0 && (
              <li className="text-xs text-muted-foreground">No blueprints yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FunnelsTab({
  stageBuckets, onOpenPost,
}: { stageBuckets: Record<FunnelStageId, Idea[]>; onOpenPost: (id: string) => void }) {
  const totals = (Object.keys(stageBuckets) as FunnelStageId[]).reduce((acc, k) => acc + stageBuckets[k].length, 0);

  return (
    <section className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FUNNEL_STAGES.map((s) => {
          const bucket = stageBuckets[s.id];
          const pct = totals ? Math.round((bucket.length / totals) * 100) : 0;
          const Icon = s.icon;
          return (
            <div key={s.id} className={cn("relative overflow-hidden rounded-2xl border border-border p-4 bg-gradient-to-br", s.accent)}>
              <div className="flex items-start justify-between">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{pct}%</span>
              </div>
              <div className="mt-6">
                <div className="text-2xl font-semibold">{bucket.length}</div>
                <div className="text-sm font-medium mt-0.5">{s.label}</div>
                <div className="text-[11px] opacity-80 mt-1">{s.blurb}</div>
              </div>
            </div>
          );
        })}
      </div>

      {FUNNEL_STAGES.map((s) => {
        const items = stageBuckets[s.id].slice(0, 6);
        const Icon = s.icon;
        return (
          <div key={s.id} className="rounded-2xl border border-border bg-card/40">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{s.label}</h3>
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">{stageBuckets[s.id].length}</Badge>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="p-5 text-xs text-muted-foreground">
                No content here yet. Ask the strategist to generate {s.label.toLowerCase()} ideas.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((i) => {
                  const cat = getCategoryMeta(i.content_category ?? "");
                  return (
                    <li key={i.id}>
                      <button onClick={() => onOpenPost(i.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors">
                        <IdeaThumb design={i.design} emoji={cat?.emoji} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{i.title}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {i.scheduled_for ?? "Unscheduled"} · {i.status}
                          </span>
                          {i.design?.caption && (
                            <span className="block text-[11px] text-muted-foreground/80 italic truncate mt-0.5">
                              "{i.design.caption}"
                            </span>
                          )}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

function CampaignsTab({
  campaigns, ideas, onOpenPost, onCreate,
}: { campaigns: Campaign[]; ideas: Idea[]; onOpenPost: (id: string) => void; onCreate: () => void }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Megaphone className="h-6 w-6 mx-auto text-muted-foreground" />
        <h3 className="mt-3 text-sm font-medium">No campaigns yet</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          Ask the strategist below to spin up a multi-post campaign, or jump into the Studio to draft one.
        </p>
        <Button size="sm" variant="outline" className="rounded-xl mt-4" onClick={onCreate}>
          Open Studio <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }
  return (
    <section className="grid sm:grid-cols-2 gap-3">
      {campaigns.map((c) => {
        const cat = getCategoryMeta(c.content_category ?? "");
        const linkedIdeas = ideas.filter((i) => i.campaign_id === c.id);
        const done = linkedIdeas.filter((i) => i.status === "completed" || i.status === "posted").length;
        const pct = linkedIdeas.length ? Math.round((done / linkedIdeas.length) * 100) : 0;
        const firstIdea = linkedIdeas[0];
        return (
          <button
            key={c.id}
            onClick={() => firstIdea && onOpenPost(firstIdea.id)}
            disabled={!firstIdea}
            className="text-left rounded-2xl border border-border bg-card/40 p-4 hover:bg-secondary/40 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description || "-"}</div>
              </div>
              {cat && (
                <Badge variant="outline" className={cn("rounded-full text-[10px] shrink-0", cat.badgeClass)}>
                  {cat.emoji} {cat.short}
                </Badge>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{linkedIdeas.length} posts</span>
              <span>{pct}% delivered</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} />
            </div>
          </button>
        );
      })}
    </section>
  );
}
