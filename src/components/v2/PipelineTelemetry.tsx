import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Brain,
  Calendar,
  CheckCircle2,
  Cpu,
  Loader2,
  Radar,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StageLogsSheet, { type StageLogEntry } from "./StageLogsSheet";

type StageId = "research" | "ideation" | "strategy" | "planning" | "execution" | "reporting";
type StageStatus = "running" | "healthy" | "error" | "idle" | "waiting";

export type StageDef = {
  id: StageId;
  label: string;
  sub: string;
  icon: any;
};

const PIPELINE: StageDef[] = [
  { id: "research", label: "Research", sub: "Trends + JTBD", icon: Radar },
  { id: "ideation", label: "Ideation", sub: "8-pillar prompts", icon: Brain },
  { id: "strategy", label: "Strategy", sub: "5-day arc", icon: Activity },
  { id: "planning", label: "Planning", sub: "Weekly Blueprint", icon: Calendar },
  { id: "execution", label: "Execution", sub: "Copy + design", icon: Sparkles },
  { id: "reporting", label: "Reporting", sub: "Learns & adapts", icon: Cpu },
];

type StageState = {
  id: StageId;
  status: StageStatus;
  lastAt: string | null;
  events: StageLogEntry[];
};

function relTime(iso: string | null, now: number): string {
  if (!iso) return "No activity yet";
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now, t);
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusFromEvents(
  enabled: boolean,
  lastAt: string | null,
  events: StageLogEntry[],
): StageStatus {
  if (!enabled) return "waiting";
  const now = Date.now();
  const hasProcessing = events.some((e) => e.status === "processing");
  const recent = lastAt && now - new Date(lastAt).getTime() < 90_000;
  if (hasProcessing || recent) return "running";
  const latest = events[0];
  if (latest && (latest.error || /fail|error/i.test(latest.status))) return "error";
  if (lastAt && now - new Date(lastAt).getTime() < 7 * 24 * 60 * 60 * 1000) return "healthy";
  return "idle";
}

const STATUS_LABEL: Record<StageStatus, string> = {
  running: "Running",
  healthy: "Healthy",
  error: "Error",
  idle: "Idle",
  waiting: "Waiting",
};

const STATUS_DOT: Record<StageStatus, string> = {
  running: "bg-emerald-500 animate-pulse",
  healthy: "bg-emerald-500/70",
  error: "bg-red-500",
  idle: "bg-muted-foreground/40",
  waiting: "bg-muted-foreground/30",
};

export default function PipelineTelemetry({
  brandId,
  enabled,
}: {
  brandId: string;
  enabled: boolean;
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [activeStage, setActiveStage] = useState<StageDef | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);

  // Realtime: invalidate when new autopilot event lands for this brand
  useEffect(() => {
    if (!brandId) return;
    const channel = supabase
      .channel(`pipeline-events-${brandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "autopilot_run_events",
          filter: `brand_id=eq.${brandId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["v2-pipeline-telemetry", brandId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [brandId, qc]);

  const { data } = useQuery({
    queryKey: ["v2-pipeline-telemetry", brandId],
    enabled: !!brandId,
    refetchInterval: 20_000,
    queryFn: async (): Promise<Record<StageId, StageState>> => {
      const [trendRes, ideationRes, strategyRes, planningRes, runsRes, eventsRes] =
        await Promise.all([
          supabase
            .from("brand_trend_intel")
            .select("generated_at")
            .eq("brand_id", brandId)
            .order("generated_at", { ascending: false })
            .limit(1),
          supabase
            .from("content_ideas")
            .select("id,title,created_at,autopilot")
            .eq("brand_id", brandId)
            .eq("autopilot", true)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("content_ideas")
            .select("id,title,created_at,strategic_arc")
            .eq("brand_id", brandId)
            .not("strategic_arc", "is", null)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("content_ideas")
            .select("id,title,created_at,blueprint_id,scheduled_for")
            .eq("brand_id", brandId)
            .not("blueprint_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("autopilot_runs")
            .select("id,started_at,completed_at,processed,errors,ideas_found")
            .order("started_at", { ascending: false })
            .limit(10),
          supabase
            .from("autopilot_run_events")
            .select("id,created_at,status,error_message,idea_id,metadata")
            .eq("brand_id", brandId)
            .order("created_at", { ascending: false })
            .limit(30),
        ]);

      const ideaIds = Array.from(
        new Set(
          (eventsRes.data ?? [])
            .map((e: any) => e.idea_id)
            .filter(Boolean),
        ),
      );
      const ideaTitles: Record<string, string> = {};
      if (ideaIds.length) {
        const { data: ideas } = await supabase
          .from("content_ideas")
          .select("id,title")
          .in("id", ideaIds);
        for (const i of ideas ?? []) ideaTitles[(i as any).id] = (i as any).title;
      }

      const evMapped: StageLogEntry[] = (eventsRes.data ?? []).map((e: any) => ({
        id: e.id,
        at: e.created_at,
        status: e.status,
        error: e.error_message,
        title: ideaTitles[e.idea_id] ?? "Untitled idea",
      }));

      const stateFor = (
        id: StageId,
        lastAt: string | null,
        events: StageLogEntry[],
      ): StageState => ({
        id,
        lastAt,
        events,
        status: statusFromEvents(enabled, lastAt, events),
      });

      const research = stateFor(
        "research",
        (trendRes.data?.[0] as any)?.generated_at ?? null,
        [],
      );
      const ideation = stateFor(
        "ideation",
        (ideationRes.data?.[0] as any)?.created_at ?? null,
        (ideationRes.data ?? []).map((r: any) => ({
          id: r.id,
          at: r.created_at,
          status: "created",
          error: null,
          title: r.title,
        })),
      );
      const strategy = stateFor(
        "strategy",
        (strategyRes.data?.[0] as any)?.created_at ?? null,
        (strategyRes.data ?? []).map((r: any) => ({
          id: r.id,
          at: r.created_at,
          status: "sequenced",
          error: null,
          title: r.title,
        })),
      );
      const planning = stateFor(
        "planning",
        (planningRes.data?.[0] as any)?.created_at ?? null,
        (planningRes.data ?? []).map((r: any) => ({
          id: r.id,
          at: r.created_at,
          status: r.scheduled_for ? `scheduled ${r.scheduled_for}` : "planned",
          error: null,
          title: r.title,
        })),
      );
      const execution = stateFor(
        "execution",
        (eventsRes.data?.[0] as any)?.created_at ?? null,
        evMapped,
      );
      const reporting = stateFor(
        "reporting",
        (runsRes.data?.[0] as any)?.completed_at ?? null,
        (runsRes.data ?? []).map((r: any) => ({
          id: r.id,
          at: r.completed_at ?? r.started_at,
          status: r.completed_at
            ? `${r.processed}/${r.ideas_found} processed${r.errors ? `, ${r.errors} errors` : ""}`
            : "in progress",
          error: r.errors > 0 ? `${r.errors} errors this run` : null,
          title: `Autopilot run ${new Date(r.started_at).toLocaleString()}`,
        })),
      );

      return { research, ideation, strategy, planning, execution, reporting };
    },
  });

  const stages = useMemo(() => {
    return PIPELINE.map((s) => ({
      def: s,
      state:
        data?.[s.id] ??
        ({ id: s.id, status: enabled ? "idle" : "waiting", lastAt: null, events: [] } as StageState),
    }));
  }, [data, enabled]);

  const runningIdx = stages.findIndex((s) => s.state.status === "running");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
          End-to-end pipeline
        </h2>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
            }`}
          />
          {enabled ? "Loop active · live" : "Loop paused"}
        </span>
      </div>

      <div className="relative rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div
          className="hidden sm:block absolute left-8 right-8 top-[58px] h-px bg-border"
          aria-hidden
        />
        <ol className="grid grid-cols-2 sm:grid-cols-6 gap-4 relative">
          {stages.map(({ def, state }, i) => {
            const Icon = def.icon;
            const isRunning = state.status === "running";
            const isError = state.status === "error";
            const isDone =
              runningIdx > -1
                ? i < runningIdx && state.lastAt !== null
                : state.lastAt !== null && state.status !== "idle" && state.status !== "waiting";
            return (
              <li key={def.id}>
                <button
                  type="button"
                  onClick={() => setActiveStage(def)}
                  className="w-full flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 text-left rounded-2xl p-1 -m-1 hover:bg-foreground/[0.03] transition-colors"
                  aria-label={`${def.label} stage logs`}
                >
                  <motion.div
                    animate={isRunning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ duration: 1.6, repeat: isRunning ? Infinity : 0 }}
                    className={`relative z-10 h-10 w-10 rounded-full grid place-items-center border-2 shrink-0 ${
                      isError
                        ? "bg-red-500/10 border-red-500 text-red-600"
                        : isRunning
                        ? "bg-foreground text-background border-foreground"
                        : isDone
                        ? "bg-background border-foreground text-foreground"
                        : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    {isError ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-tight truncate">{def.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight truncate">
                      {def.sub}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 sm:justify-center">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[state.status]}`} />
                      <span className="text-[10px] text-muted-foreground">
                        {STATUS_LABEL[state.status]} · {relTime(state.lastAt, now)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <StageLogsSheet
        open={!!activeStage}
        onOpenChange={(v) => !v && setActiveStage(null)}
        stage={activeStage}
        state={activeStage ? data?.[activeStage.id] ?? null : null}
        now={now}
        brandId={brandId}
      />
    </section>
  );
}
