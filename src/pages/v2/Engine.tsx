import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Activity,
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  Cpu,
  Loader2,
  PauseCircle,
  PlayCircle,
  Power,
  Radar,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

type Mode = "manual" | "assisted" | "autonomous";
type Delivery = "morning" | "afternoon" | "evening";
type AutoFill = "never" | "free_only" | "always";

type AutopilotRow = {
  id: string;
  brand_id: string;
  user_id: string;
  enabled: boolean;
  mode: Mode;
  delivery_time: Delivery;
  timezone: string;
  min_queue_threshold: number;
  auto_fill_mode: AutoFill;
  weekly_plan_last_run: string | null;
};

const MODE_OPTIONS: { id: Mode; label: string; description: string; icon: any }[] = [
  {
    id: "manual",
    label: "Manual",
    description: "You drive. The engine waits for your prompts.",
    icon: SettingsIcon,
  },
  {
    id: "assisted",
    label: "Assisted",
    description: "Drafts the week. You approve before anything ships.",
    icon: Wand2,
  },
  {
    id: "autonomous",
    label: "Autonomous",
    description: "Plans, designs and ships on schedule. Hands free.",
    icon: Zap,
  },
];

const DELIVERY_OPTIONS: { id: Delivery; label: string; sub: string }[] = [
  { id: "morning", label: "Morning", sub: "8:00" },
  { id: "afternoon", label: "Afternoon", sub: "13:00" },
  { id: "evening", label: "Evening", sub: "18:00" },
];

const AUTOFILL_OPTIONS: { id: AutoFill; label: string; description: string }[] = [
  { id: "never", label: "Never", description: "Pause when credits run out." },
  { id: "free_only", label: "Free credits only", description: "Use free monthly allowance, then pause." },
  { id: "always", label: "Always", description: "Use any credits available — never stops." },
];

const PIPELINE = [
  { id: "research", label: "Research", sub: "Trends + JTBD", icon: Radar },
  { id: "ideation", label: "Ideation", sub: "8-pillar prompts", icon: Brain },
  { id: "strategy", label: "Strategy", sub: "5-day arc", icon: Activity },
  { id: "planning", label: "Planning", sub: "Weekly Blueprint", icon: Calendar },
  { id: "execution", label: "Execution", sub: "Copy + design", icon: Sparkles },
  { id: "reporting", label: "Reporting", sub: "Learns & adapts", icon: Cpu },
];

const Engine = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [pausing, setPausing] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["v2-engine-settings", brand?.id],
    queryFn: async (): Promise<AutopilotRow | null> => {
      if (!brand?.id) return null;
      const { data, error } = await supabase
        .from("autopilot_settings")
        .select("*")
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (error) throw error;
      return (data as AutopilotRow) ?? null;
    },
    enabled: !!brand?.id,
  });

  // Local mirror so toggles feel instant
  const [draft, setDraft] = useState<Partial<AutopilotRow>>({});
  useEffect(() => {
    if (settings) setDraft({});
  }, [settings?.id]);

  const merged: AutopilotRow | null = useMemo(() => {
    if (!settings && !brand?.id) return null;
    const base: AutopilotRow =
      settings ?? {
        id: "",
        brand_id: brand!.id,
        user_id: user!.id,
        enabled: false,
        mode: "assisted",
        delivery_time: "morning",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
        min_queue_threshold: 5,
        auto_fill_mode: "free_only",
        weekly_plan_last_run: null,
      };
    return { ...base, ...draft } as AutopilotRow;
  }, [settings, draft, brand?.id, user?.id]);

  // Live queue stats
  const { data: queueStats } = useQuery({
    queryKey: ["v2-engine-stats", brand?.id],
    queryFn: async () => {
      if (!brand?.id) return { queued: 0, approved: 0, shipped: 0, processing: 0 };
      const now = new Date();
      const horizon = new Date(now);
      horizon.setDate(now.getDate() + 14);
      const { data } = await supabase
        .from("content_ideas")
        .select("id, status, approval_status, autopilot_status, scheduled_for")
        .eq("brand_id", brand.id)
        .gte("scheduled_for", now.toISOString().slice(0, 10))
        .lt("scheduled_for", horizon.toISOString().slice(0, 10));
      const rows = data ?? [];
      return {
        queued: rows.length,
        approved: rows.filter(
          (r) => r.approval_status === "approved" || r.status === "scheduled",
        ).length,
        shipped: rows.filter((r) => r.autopilot_status === "completed").length,
        processing: rows.filter((r) => r.autopilot_status === "processing").length,
      };
    },
    enabled: !!brand?.id,
    refetchInterval: 15_000,
  });

  const upsert = async (patch: Partial<AutopilotRow>) => {
    if (!brand?.id || !user?.id || !merged) return;
    setSaving(true);
    setDraft((d) => ({ ...d, ...patch }));
    try {
      const payload = {
        brand_id: brand.id,
        user_id: user.id,
        enabled: merged.enabled,
        mode: merged.mode,
        delivery_time: merged.delivery_time,
        timezone: merged.timezone,
        min_queue_threshold: merged.min_queue_threshold,
        auto_fill_mode: merged.auto_fill_mode,
        ...patch,
      };
      const { error } = await supabase
        .from("autopilot_settings")
        .upsert(payload, { onConflict: "brand_id" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["v2-engine-settings"] });
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSeedNow = async () => {
    if (!brand?.id) return;
    setSeeding(true);
    try {
      const { error } = await supabase.functions.invoke("autopilot-planner", {
        body: {
          brand_id: brand.id,
          playbook_id: (brand as any).playbook_id ?? "general",
          seed: true,
        },
      });
      if (error) throw error;
      toast({
        title: "Engine spinning up",
        description: "Drafting this week's arc. Refresh the Cockpit in a moment.",
      });
    } catch (err: any) {
      toast({ title: "Couldn't start", description: err.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const handlePauseWeek = async () => {
    setPausing(true);
    try {
      await upsert({ enabled: false });
      toast({ title: "Engine paused", description: "Nothing will ship until you switch it back on." });
    } finally {
      setPausing(false);
    }
  };

  if (authLoading || brandLoading || settingsLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/engine" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;
  if (!merged) return null;

  const lastRun = merged.weekly_plan_last_run
    ? new Date(merged.weekly_plan_last_run)
    : null;
  const lastRunLabel = lastRun
    ? lastRun.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";

  const activeStageIdx = merged.enabled
    ? Math.min(
        PIPELINE.length - 1,
        Math.max(
          0,
          (queueStats?.processing ?? 0) > 0
            ? 4
            : (queueStats?.queued ?? 0) > 0
            ? 3
            : 1,
        ),
      )
    : -1;

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO
        title="Engine — Brandie"
        description="Command your autonomous content engine."
        path="/engine"
        noindex
      />
      <NewAppHeader />

      <main className="max-w-4xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-12">
        {/* HERO + MASTER SWITCH */}
        <header className="space-y-5">
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Mission Control
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-3">
              <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
                The Engine.
              </h1>
              <p className="text-muted-foreground max-w-xl">
                Six agents working in concert — researching, ideating, designing and
                shipping. You hold the keys.
              </p>
            </div>

            <div
              className={`rounded-3xl border p-5 min-w-[260px] transition-colors ${
                merged.enabled
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className={`text-[10px] tracking-[0.22em] uppercase ${
                      merged.enabled ? "text-background/60" : "text-muted-foreground"
                    }`}
                  >
                    {merged.enabled ? "Running" : "Standby"}
                  </p>
                  <p className="font-serif text-2xl tracking-tight mt-1">
                    {merged.enabled ? "Engine live" : "Engine off"}
                  </p>
                </div>
                <Switch
                  checked={merged.enabled}
                  disabled={saving}
                  onCheckedChange={(v) => upsert({ enabled: v })}
                  aria-label="Toggle autonomous engine"
                />
              </div>
              <div
                className={`mt-3 flex items-center gap-1.5 text-[11px] ${
                  merged.enabled ? "text-background/70" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    merged.enabled ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"
                  }`}
                />
                Last plan: {lastRunLabel}
              </div>
            </div>
          </div>
        </header>

        {/* LIVE STATS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Queued", value: queueStats?.queued ?? 0, sub: "next 14 days" },
            { label: "Approved", value: queueStats?.approved ?? 0, sub: "ready to ship" },
            { label: "Processing", value: queueStats?.processing ?? 0, sub: "rendering now" },
            { label: "Shipped", value: queueStats?.shipped ?? 0, sub: "this period" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card p-4 space-y-1"
            >
              <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                {s.label}
              </p>
              <p className="font-serif text-3xl tracking-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </section>

        {/* PIPELINE VISUAL */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
              End-to-end pipeline
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {merged.enabled ? "Loop active" : "Loop paused"}
            </span>
          </div>

          <div className="relative rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div
              className="hidden sm:block absolute left-8 right-8 top-[58px] h-px bg-border"
              aria-hidden
            />
            <ol className="grid grid-cols-2 sm:grid-cols-6 gap-4 relative">
              {PIPELINE.map((stage, i) => {
                const Icon = stage.icon;
                const isActive = i === activeStageIdx;
                const isDone = i < activeStageIdx;
                return (
                  <li key={stage.id} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                    <motion.div
                      animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{ duration: 1.6, repeat: isActive ? Infinity : 0 }}
                      className={`relative z-10 h-10 w-10 rounded-full grid place-items-center border-2 shrink-0 ${
                        isActive
                          ? "bg-foreground text-background border-foreground"
                          : isDone
                          ? "bg-background border-foreground text-foreground"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </motion.div>
                    <div>
                      <p className="text-[12px] font-medium leading-tight">{stage.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {stage.sub}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* MODE */}
        <section className="space-y-4">
          <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Engine mode
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {MODE_OPTIONS.map(({ id, label, description, icon: Icon }) => {
              const active = merged.mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => upsert({ mode: id })}
                  disabled={saving}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:border-foreground/40"
                  }`}
                >
                  <Icon className="h-5 w-5 mb-3" />
                  <p className="font-medium">{label}</p>
                  <p
                    className={`text-xs mt-1 leading-snug ${
                      active ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
                    {description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* DELIVERY + QUEUE */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
                Daily delivery
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                When ready posts land in your inbox + WhatsApp.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_OPTIONS.map(({ id, label, sub }) => {
                const active = merged.delivery_time === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => upsert({ delivery_time: id })}
                    disabled={saving}
                    className={`rounded-xl border p-3 text-center transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background hover:border-foreground/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{label}</p>
                    <p
                      className={`text-[11px] ${
                        active ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {sub}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Timezone: {merged.timezone}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
                Queue threshold
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Auto-plan a new week when the runway drops below this.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-3xl tracking-tight">
                  {merged.min_queue_threshold}
                </span>
                <span className="text-xs text-muted-foreground">posts ahead</span>
              </div>
              <Slider
                value={[merged.min_queue_threshold]}
                min={1}
                max={14}
                step={1}
                onValueCommit={(v) => upsert({ min_queue_threshold: v[0] })}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, min_queue_threshold: v[0] }))
                }
                disabled={saving}
              />
            </div>
          </div>
        </section>

        {/* AUTOFILL */}
        <section className="space-y-4">
          <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Credit policy
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {AUTOFILL_OPTIONS.map(({ id, label, description }) => {
              const active = merged.auto_fill_mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => upsert({ auto_fill_mode: id })}
                  disabled={saving}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card hover:border-foreground/40"
                  }`}
                >
                  <p className="font-medium">{label}</p>
                  <p
                    className={`text-xs mt-1 leading-snug ${
                      active ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
                    {description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* CONTROL ROW */}
        <section className="rounded-3xl border border-border bg-foreground text-background p-6 sm:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] tracking-[0.22em] uppercase text-background/60">
                Quick controls
              </p>
              <h3 className="font-serif text-2xl tracking-tight">
                Take the wheel.
              </h3>
              <p className="text-background/70 text-sm max-w-md">
                Force a fresh plan, pause for a beat, or jump into the Blueprint to
                tweak the arc by hand.
              </p>
            </div>
            <Power className="h-6 w-6 text-background/40 shrink-0" />
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              onClick={handleSeedNow}
              disabled={seeding}
              size="lg"
              variant="secondary"
              className="rounded-full h-11 px-5 gap-2"
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Run a plan now
            </Button>
            <Button
              onClick={handlePauseWeek}
              disabled={pausing || !merged.enabled}
              size="lg"
              variant="ghost"
              className="rounded-full h-11 px-5 gap-2 text-background hover:bg-background/10 hover:text-background"
            >
              {pausing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PauseCircle className="h-4 w-4" />
              )}
              Pause engine
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="rounded-full h-11 px-5 gap-2 text-background hover:bg-background/10 hover:text-background"
            >
              <Link to="/blueprint">
                <Calendar className="h-4 w-4" />
                Edit the week
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="rounded-full h-11 px-5 gap-2 text-background hover:bg-background/10 hover:text-background"
            >
              <Link to="/brand">
                <RefreshCw className="h-4 w-4" />
                Retune brand inputs
              </Link>
            </Button>
          </div>
        </section>

        <div className="text-center">
          <Link
            to="/cockpit"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Back to Cockpit <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Engine;
