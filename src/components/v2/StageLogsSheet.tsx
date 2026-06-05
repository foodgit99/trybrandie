import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type StageLogEntry = {
  id: string;
  at: string;
  status: string;
  error: string | null;
  title: string;
};

type StageDef = { id: string; label: string; sub: string; icon: any };
type StageState = {
  id: string;
  status: string;
  lastAt: string | null;
  events: StageLogEntry[];
};

function relTime(iso: string | null, now: number): string {
  if (!iso) return "—";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const STAGE_COPY: Record<string, { title: string; body: string }> = {
  research: {
    title: "Research",
    body: "Trend Scout + JTBD agents pull market signals and audience pain points before anything ships.",
  },
  ideation: {
    title: "Ideation",
    body: "Generates idea cards across the 8-pillar framework from your brand, audience and trends.",
  },
  strategy: {
    title: "Strategy",
    body: "Sequences ideas into a 5-day narrative arc — no random posts, only intentional pacing.",
  },
  planning: {
    title: "Planning",
    body: "Drops the arc into the Weekly Blueprint with dates and delivery slots.",
  },
  execution: {
    title: "Execution",
    body: "Copywriter + Creative Director + renderer turn each idea into a finished, branded asset.",
  },
  reporting: {
    title: "Reporting",
    body: "Folds outcomes back into preferences and weights so next week is sharper than this one.",
  },
};

const FOOTER_LINK: Record<string, { label: string; to: string }> = {
  research: { label: "Open Trend Lab", to: "/trend-lab" },
  ideation: { label: "Open Content Hub", to: "/content-hub" },
  strategy: { label: "Open Content Hub", to: "/content-hub?tab=strategy" },
  planning: { label: "Open Content Hub", to: "/content-hub?tab=strategy" },
  execution: { label: "Open Content Hub", to: "/content-hub?tab=content" },
  reporting: { label: "Open Report", to: "/report" },
};

export default function StageLogsSheet({
  open,
  onOpenChange,
  stage,
  state,
  now,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stage: StageDef | null;
  state: StageState | null;
  now: number;
}) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: row } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!row);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stage) return null;
  const copy = STAGE_COPY[stage.id] ?? { title: stage.label, body: stage.sub };
  const link = FOOTER_LINK[stage.id];
  const events = state?.events ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
            Stage logs
          </div>
          <SheetTitle className="font-serif text-2xl tracking-tight">
            {copy.title}
          </SheetTitle>
          <SheetDescription className="text-sm">{copy.body}</SheetDescription>
          <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5 capitalize">
              {state?.status ?? "idle"}
            </span>
            <span>
              Last activity: {relTime(state?.lastAt ?? null, now)}
            </span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No telemetry yet for this stage.
            </div>
          ) : (
            events.map((e) => {
              const isErr = !!e.error || /fail|error/i.test(e.status);
              const isProc = /process/i.test(e.status);
              return (
                <div
                  key={e.id}
                  className="rounded-xl border border-border bg-card p-3 space-y-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {isErr ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : isProc ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                      <p className="text-[13px] font-medium truncate">{e.title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {relTime(e.at, now)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-5 capitalize">
                    {e.status.replace(/_/g, " ")}
                  </p>
                  {e.error && (
                    <p className="text-[11px] text-red-600 pl-5 break-words">{e.error}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t flex flex-col gap-2">
          {link && (
            <Button asChild variant="outline" className="w-full">
              <Link to={link.to} onClick={() => onOpenChange(false)}>
                {link.label}
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to="/admin" onClick={() => onOpenChange(false)}>
                View full run logs (admin)
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
