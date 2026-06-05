import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
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
  Pencil,
  Wand2,
  Power,
  Image as ImageIcon,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import AgentChatDock, { AgentContext } from "@/components/v2/AgentChatDock";
import { CONTENT_CATEGORIES, type ContentCategoryId, getCategoryMeta } from "@/lib/contentCategories";
import { cn } from "@/lib/utils";

/* ------------------------------ Funnel model ------------------------------ */

type FunnelStageId = "awareness" | "consideration" | "conversion" | "retention";

const FUNNEL_STAGES: Array<{
  id: FunnelStageId;
  label: string;
  blurb: string;
  icon: any;
  accent: string;
  categories: ContentCategoryId[];
}> = [
  {
    id: "awareness",
    label: "Awareness",
    blurb: "Get strangers to notice you.",
    icon: Sparkles,
    accent: "from-sky-500/20 to-sky-500/0 text-sky-700 dark:text-sky-300",
    categories: ["educational", "informational", "trending", "entertainment"],
  },
  {
    id: "consideration",
    label: "Consideration",
    blurb: "Turn lookers into trust.",
    icon: Layers,
    accent: "from-violet-500/20 to-violet-500/0 text-violet-700 dark:text-violet-300",
    categories: ["social_proof", "bts", "interactive"],
  },
  {
    id: "conversion",
    label: "Conversion",
    blurb: "Move trust into sales.",
    icon: Target,
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-700 dark:text-emerald-300",
    categories: ["promotional", "announcement"],
  },
  {
    id: "retention",
    label: "Retention",
    blurb: "Keep customers coming back.",
    icon: Heart,
    accent: "from-rose-500/20 to-rose-500/0 text-rose-700 dark:text-rose-300",
    categories: ["holidays"],
  },
];

function categoryToStage(catId?: string | null): FunnelStageId {
  if (!catId) return "awareness";
  const s = FUNNEL_STAGES.find((st) => (st.categories as string[]).includes(catId));
  return s?.id ?? "awareness";
}

/* ------------------------------- Data types ------------------------------- */

type Idea = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  approval_status: string;
  scheduled_for: string | null;
  content_category: string | null;
  campaign_id: string | null;
  design_id: string | null;
  created_at: string;
};

type Campaign = {
  id: string;
  name: string;
  description: string;
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

type EngineSettings = {
  enabled: boolean;
  delivery_time: string;
} | null;

/* ---------------------------------- Page ---------------------------------- */

type TabId = "funnels" | "strategy" | "campaigns" | "content";

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: "funnels", label: "Funnels", icon: Layers },
  { id: "strategy", label: "Strategy", icon: Target },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "content", label: "Content", icon: ImageIcon },
];

const ContentHubV2 = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabId) || "funnels";
  const focusedItem = params.get("item");

  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  /* ----------------------------- Data queries ----------------------------- */

  const { data: ideas = [] } = useQuery({
    queryKey: ["hubv2-ideas", brand?.id],
    enabled: !!brand?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id,title,prompt,status,approval_status,scheduled_for,content_category,campaign_id,design_id,created_at")
        .eq("brand_id", brand!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["hubv2-campaigns", brand?.id],
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
    queryKey: ["hubv2-blueprints", brand?.id],
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
    queryKey: ["hubv2-engine", brand?.id],
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

  /* ----------------------------- Realtime ping ---------------------------- */

  useEffect(() => {
    if (!brand?.id) return;
    const channel = supabase
      .channel(`hubv2-ideas-${brand.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_ideas", filter: `brand_id=eq.${brand.id}` },
        () => {
          // Refresh handled by react-query refetch interval below.
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [brand?.id]);

  /* ----------------------------- Derived state ---------------------------- */

  const stageBuckets = useMemo(() => {
    const map: Record<FunnelStageId, Idea[]> = {
      awareness: [], consideration: [], conversion: [], retention: [],
    };
    ideas.forEach((i) => { map[categoryToStage(i.content_category)].push(i); });
    return map;
  }, [ideas]);

  const selectedIdea = useMemo(
    () => ideas.find((i) => i.id === focusedItem) ?? null,
    [ideas, focusedItem]
  );

  const agentContext: AgentContext = useMemo(() => {
    if (selectedIdea) {
      return {
        scope: "content",
        label: selectedIdea.title.slice(0, 60),
        selection: {
          id: selectedIdea.id,
          title: selectedIdea.title,
          prompt: selectedIdea.prompt.slice(0, 400),
          category: selectedIdea.content_category,
          status: selectedIdea.status,
          scheduled_for: selectedIdea.scheduled_for,
        },
      };
    }
    if (tab === "funnels") return { scope: "funnel", label: "Funnel overview" };
    if (tab === "strategy") return { scope: "strategy", label: "Weekly strategic arc" };
    if (tab === "campaigns") return { scope: "campaign", label: "Campaign library" };
    if (tab === "content") return { scope: "content", label: "Content queue" };
    return { scope: "hub", label: "Content Hub" };
  }, [tab, selectedIdea]);

  /* ------------------------------- Guards -------------------------------- */

  if (authLoading || brandLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth?next=/content-hub" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  /* -------------------------------- Render ------------------------------- */

  return (
    <div className="min-h-screen bg-background pb-32 lg:pl-20">
      <SEO title="Content Hub — Brandie" description="Strategic command surface for your funnels, strategy, campaigns and content. Work hand-in-hand with the brand agents." path="/content-hub" />
      <NewAppHeader />

      <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span>Content Hub</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif tracking-tight">
            Command your content, end-to-end.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
            Funnels, strategy, campaigns, and every individual post — orchestrated by the autonomous engine
            and shaped together with your brand agents.
          </p>
        </header>

        {/* Engine status strip */}
        <section className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5 flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className={cn(
                "absolute inset-0 rounded-full animate-ping",
                engine?.enabled ? "bg-emerald-500/40" : "bg-muted-foreground/30"
              )} />
              <span className={cn(
                "relative block h-2.5 w-2.5 rounded-full",
                engine?.enabled ? "bg-emerald-500" : "bg-muted-foreground/60"
              )} />
            </div>
            <span className="text-sm font-medium">
              Engine {engine?.enabled ? "running" : "idle"}
            </span>
            {engine?.delivery_time && (
              <span className="text-xs text-muted-foreground">· delivers {engine.delivery_time}</span>
            )}
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="text-xs text-muted-foreground">
            {ideas.length} ideas · {campaigns.length} campaigns · {blueprints.length} blueprints
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate("/engine")}>
              <Power className="h-3.5 w-3.5 mr-1.5" /> Engine
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate("/blueprint")}>
              <Calendar className="h-3.5 w-3.5 mr-1.5" /> Calendar
            </Button>
          </div>
        </section>

        {/* Tabs */}
        <nav aria-label="Content sections" className="relative">
          <div className="flex items-center gap-1 p-1 rounded-2xl border border-border bg-card/40 overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="hub-tab-pill"
                      className="absolute inset-0 rounded-xl bg-background border border-border shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "funnels" && <FunnelsTab stageBuckets={stageBuckets} onOpenIdea={(id) => { const next = new URLSearchParams(params); next.set("tab", "content"); next.set("item", id); setParams(next); }} />}
            {tab === "strategy" && <StrategyTab blueprints={blueprints} ideas={ideas} onOpenBlueprint={() => navigate("/blueprint")} />}
            {tab === "campaigns" && <CampaignsTab campaigns={campaigns} ideas={ideas} />}
            {tab === "content" && (
              <ContentTab
                ideas={ideas}
                focusedId={focusedItem}
                onFocus={(id) => { const next = new URLSearchParams(params); if (id) next.set("item", id); else next.delete("item"); setParams(next); }}
                onOpenPost={(id) => navigate(`/post/${id}`)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AgentChatDock brandId={brand.id} context={agentContext} />
    </div>
  );
};

export default ContentHubV2;

/* ============================== Sub-sections ============================== */

function FunnelsTab({
  stageBuckets,
  onOpenIdea,
}: {
  stageBuckets: Record<FunnelStageId, Idea[]>;
  onOpenIdea: (id: string) => void;
}) {
  const totals = (Object.keys(stageBuckets) as FunnelStageId[]).reduce(
    (acc, k) => acc + stageBuckets[k].length, 0
  );

  return (
    <section className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FUNNEL_STAGES.map((s) => {
          const bucket = stageBuckets[s.id];
          const pct = totals ? Math.round((bucket.length / totals) * 100) : 0;
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border p-4 bg-gradient-to-br",
                s.accent
              )}
            >
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
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                  {stageBuckets[s.id].length}
                </Badge>
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
                      <button
                        onClick={() => onOpenIdea(i.id)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors"
                      >
                        <span className="text-base">{cat?.emoji ?? "•"}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{i.title}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {i.scheduled_for ?? "Unscheduled"} · {i.status}
                          </span>
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

function StrategyTab({
  blueprints,
  ideas,
  onOpenBlueprint,
}: {
  blueprints: Blueprint[];
  ideas: Idea[];
  onOpenBlueprint: () => void;
}) {
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
            Open calendar <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>

        {currentIdeas.length > 0 && (
          <ol className="mt-5 space-y-2">
            {currentIdeas.slice(0, 7).map((i, idx) => {
              const cat = getCategoryMeta(i.content_category ?? "");
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background"
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground w-5">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-base">{cat?.emoji ?? "•"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{i.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {i.scheduled_for ? new Date(i.scheduled_for).toLocaleDateString(undefined, { weekday: "short" }) : "Unscheduled"} · {cat?.label ?? "—"}
                    </span>
                  </span>
                  <Badge variant="secondary" className="rounded-full text-[10px]">{i.status}</Badge>
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

function CampaignsTab({ campaigns, ideas }: { campaigns: Campaign[]; ideas: Idea[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Megaphone className="h-6 w-6 mx-auto text-muted-foreground" />
        <h3 className="mt-3 text-sm font-medium">No campaigns yet</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          Ask the strategist below to spin up a multi-post campaign around a launch, restock, or seasonal moment.
        </p>
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
        return (
          <div key={c.id} className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description || "—"}</div>
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
          </div>
        );
      })}
    </section>
  );
}

function ContentTab({
  ideas,
  focusedId,
  onFocus,
  onOpenPost,
}: {
  ideas: Idea[];
  focusedId: string | null;
  onFocus: (id: string | null) => void;
  onOpenPost: (id: string) => void;
}) {
  const [stageFilter, setStageFilter] = useState<FunnelStageId | "all">("all");

  const filtered = useMemo(() => {
    if (stageFilter === "all") return ideas;
    return ideas.filter((i) => categoryToStage(i.content_category) === stageFilter);
  }, [ideas, stageFilter]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {(["all", ...FUNNEL_STAGES.map((s) => s.id)] as Array<FunnelStageId | "all">).map((id) => (
          <button
            key={id}
            onClick={() => setStageFilter(id)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              stageFilter === id
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {id === "all" ? "All" : FUNNEL_STAGES.find((s) => s.id === id)?.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground p-8 text-center border border-dashed border-border rounded-2xl">
          No content in this slice yet.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
          {filtered.slice(0, 60).map((i) => {
            const cat = getCategoryMeta(i.content_category ?? "");
            const active = i.id === focusedId;
            return (
              <li
                key={i.id}
                className={cn("group flex items-center gap-3 px-4 py-3 transition-colors", active ? "bg-secondary/60" : "hover:bg-secondary/40")}
              >
                <button onClick={() => onFocus(active ? null : i.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="text-base">{cat?.emoji ?? "•"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{i.title}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {i.scheduled_for ?? "Unscheduled"} · {cat?.label ?? "—"} · {i.status}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-8 px-2 rounded-lg" onClick={() => onFocus(i.id)}>
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 rounded-lg" onClick={() => onOpenPost(i.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {focusedId && (
        <div className="text-[11px] text-muted-foreground">
          Strategist is focused on this post. Open the chat to rewrite, re-pillar, or re-sequence it.
        </div>
      )}
    </section>
  );
}
