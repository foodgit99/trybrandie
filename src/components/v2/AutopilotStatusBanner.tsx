import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAutopilotStatus } from "@/hooks/useAutopilotStatus";

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 7);
  return e;
}

type Props = {
  brandId: string | null | undefined;
  /** When true, show an "Approve all" inline action (only on /blueprint). */
  showApproveAll?: boolean;
  className?: string;
};

const AutopilotStatusBanner = ({ brandId, showApproveAll = false, className = "" }: Props) => {
  const { data, isLoading } = useAutopilotStatus(brandId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [planning, setPlanning] = useState(false);

  if (isLoading || !data || !data.paused || data.mode === "manual") return null;

  const isBlueprintPage = typeof window !== "undefined" && window.location.pathname.startsWith("/blueprint");

  const planWeek = async () => {
    if (!brandId) return;
    setPlanning(true);
    toast({ title: "Brandie is planning your week…", description: "Drafting the arc — approve it when you're happy." });
    const { error } = await supabase.functions.invoke("brand-engine", {
      body: { action: "generate_weekly_ideas", brand_id: brandId },
    });
    setPlanning(false);
    if (error) {
      toast({ title: "Couldn't plan the week", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Week drafted", description: "Review the arc and approve to start Autopilot." });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["autopilot-status", brandId] }),
      qc.invalidateQueries({ queryKey: ["blueprint-ideas"] }),
      qc.invalidateQueries({ queryKey: ["cockpit-ideas"] }),
    ]);
  };

  const approveAll = async () => {
    if (!brandId) return;
    setApproving(true);
    const weekStart = startOfWeek().toISOString().slice(0, 10);
    const weekEnd = endOfWeek().toISOString().slice(0, 10);

    const { data: blueprintRows } = await supabase
      .from("content_ideas")
      .select("blueprint_id")
      .eq("brand_id", brandId)
      .eq("autopilot", true)
      .not("blueprint_id", "is", null)
      .gte("scheduled_for", weekStart)
      .lt("scheduled_for", weekEnd);

    const blueprintIds = Array.from(
      new Set((blueprintRows ?? []).map((row: any) => row.blueprint_id).filter(Boolean)),
    );

    const { error } = await supabase
      .from("content_ideas")
      .update({ approval_status: "approved", status: "scheduled" })
      .eq("brand_id", brandId)
      .eq("autopilot", true)
      .not("blueprint_id", "is", null)
      .gte("scheduled_for", weekStart)
      .lt("scheduled_for", weekEnd);
    if (!error && blueprintIds.length > 0) {
      await supabase
        .from("weekly_blueprints" as any)
        .update({ status: "approved", approved_at: new Date().toISOString() } as any)
        .in("id", blueprintIds);
    }
    setApproving(false);
    if (error) {
      toast({ title: "Couldn't approve week", description: error.message, variant: "destructive" });
      return;
    }
    supabase.functions
      .invoke("content-autopilot", { body: { brand_id: brandId, force: true } })
      .catch((e) => console.warn("[autopilot-banner] content-autopilot kick failed", e));
    toast({ title: "Approved", description: "Autopilot is live for this week." });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["autopilot-status", brandId] }),
      qc.invalidateQueries({ queryKey: ["blueprint-ideas"] }),
      qc.invalidateQueries({ queryKey: ["cockpit-ideas"] }),
    ]);
  };

  const title =
    data.reason === "no_ideas"
      ? "Autopilot is paused — no Blueprint for this week."
      : "Autopilot is paused — your week isn't approved yet.";

  const body =
    data.reason === "no_ideas"
      ? 'Tell Brandie to "plan this week" in the Blueprint and she\'ll draft the full arc. Autopilot starts as soon as you approve.'
      : `${data.thisWeekIdeas} post${data.thisWeekIdeas === 1 ? "" : "s"} are drafted but unapproved. Approve them to let Autopilot generate & email them at your delivery time.`;

  return (
    <div
      className={`rounded-2xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="shrink-0 h-9 w-9 rounded-full bg-amber-200/70 dark:bg-amber-500/20 grid place-items-center">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm sm:text-base text-amber-900 dark:text-amber-100">{title}</p>
          <p className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-200/80 mt-0.5">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {data.reason === "no_ideas" ? (
          <Button size="sm" onClick={planWeek} disabled={planning} className="rounded-full h-9 gap-1.5">
            {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Plan this week
          </Button>
        ) : null}
        {showApproveAll && data.reason === "no_approved" ? (
          <Button
            size="sm"
            onClick={approveAll}
            disabled={approving}
            className="rounded-full h-9 gap-1.5"
          >
            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve week
          </Button>
        ) : null}
        {!isBlueprintPage && (
          <Button asChild size="sm" variant="outline" className="rounded-full h-9 gap-1.5">
            <Link to="/blueprint">
              Open Blueprint <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default AutopilotStatusBanner;
