import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Power, ArrowRight, Plus, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  brandId: string | null | undefined;
  firstName?: string | null;
};

const weekISO = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
};

const EngineStatusHero = ({ brandId, firstName }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["autopilot-settings-hero", brandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("autopilot_settings")
        .select("enabled, mode")
        .eq("brand_id", brandId!)
        .maybeSingle();
      return data;
    },
    enabled: !!brandId,
  });

  const { start, end } = weekISO();
  const { data: weekIdeas } = useQuery({
    queryKey: ["engine-week-ideas", brandId, start],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_ideas")
        .select("id, title, scheduled_for, status")
        .eq("brand_id", brandId!)
        .gte("scheduled_for", start)
        .lt("scheduled_for", end)
        .order("scheduled_for", { ascending: true });
      return data || [];
    },
    enabled: !!brandId,
  });

  const queued = (weekIdeas || []).filter((i) => i.status !== "created").length;
  const published = (weekIdeas || []).filter((i) => i.status === "created").length;
  const todayISO = new Date().toISOString().split("T")[0];
  const next = (weekIdeas || []).find((i) => i.status !== "created" && (i.scheduled_for || "") >= todayISO);
  const enabled = !!settings?.enabled;

  const togglePower = async () => {
    if (!brandId) return;
    if (!settings) {
      // Fetch user_id then upsert
      const { data: brand } = await supabase.from("brands").select("user_id").eq("id", brandId).single();
      if (!brand) return;
      await supabase.from("autopilot_settings").insert({
        brand_id: brandId,
        user_id: brand.user_id,
        enabled: true,
        mode: "autonomous",
      });
      toast({ title: "Engine started" });
    } else {
      await supabase.from("autopilot_settings").update({ enabled: !settings.enabled }).eq("brand_id", brandId);
      toast({ title: settings.enabled ? "Engine paused" : "Engine running" });
    }
    refetchSettings();
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  })();

  const formatDay = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long" });
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="absolute -inset-12 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </p>
            <h2 className="text-2xl sm:text-3xl font-serif tracking-tight mt-1">
              {enabled ? "Your engine is running." : "Your engine is paused."}
            </h2>
          </div>
          <button
            onClick={togglePower}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              enabled
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
            title={enabled ? "Pause engine" : "Start engine"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                enabled ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
              }`}
            />
            {enabled ? "Live" : "Paused"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Queued</p>
            <p className="text-xl font-serif font-semibold mt-0.5">{queued}</p>
            <p className="text-[10px] text-muted-foreground">posts this week</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Published</p>
            <p className="text-xl font-serif font-semibold mt-0.5 flex items-center gap-1">
              {published}
              {published > 0 && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
            </p>
            <p className="text-[10px] text-muted-foreground">so far</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next</p>
            <p className="text-sm font-medium mt-0.5 truncate">
              {next ? formatDay(next.scheduled_for) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {next ? next.title : "Nothing queued"}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="h-10 rounded-xl gap-2 flex-1" onClick={() => navigate("/content")}>
            <CalendarDays className="h-4 w-4" />
            Review this week
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl gap-2 hidden sm:inline-flex"
            onClick={() => navigate("/studio")}
          >
            <Plus className="h-4 w-4" />
            New design
          </Button>
        </div>
      </div>
    </section>
  );
};

export default EngineStatusHero;
