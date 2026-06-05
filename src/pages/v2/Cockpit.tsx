import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Loader2,
  Power,
  Sparkles,
  Calendar as CalendarIcon,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import { getCategoryMeta, parseCategoryIds } from "@/lib/contentCategories";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun .. 6 Sat
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

type Idea = {
  id: string;
  title: string;
  prompt: string;
  content_category: string | null;
  scheduled_for: string | null;
  day_of_week: number | null;
  status: string;
  approval_status: string;
};

const Cockpit = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const weekStart = useMemo(() => startOfWeek(), []);
  const weekEnd = useMemo(() => endOfWeek(), []);

  const { data: ideas = [], isLoading: ideasLoading, refetch } = useQuery({
    queryKey: ["v2-cockpit-ideas", brand?.id, weekStart.toISOString()],
    queryFn: async (): Promise<Idea[]> => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id, title, prompt, content_category, scheduled_for, day_of_week, status, approval_status")
        .eq("brand_id", brand.id)
        .gte("scheduled_for", weekStart.toISOString())
        .lt("scheduled_for", weekEnd.toISOString())
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
    enabled: !!brand?.id,
  });

  // Group ideas by day index (0=Mon..6=Sun)
  const byDay = useMemo(() => {
    const map = new Map<number, Idea[]>();
    for (const it of ideas) {
      if (!it.scheduled_for) continue;
      const d = new Date(it.scheduled_for);
      const wd = d.getDay(); // 0 Sun..6 Sat
      const idx = wd === 0 ? 6 : wd - 1;
      const arr = map.get(idx) ?? [];
      arr.push(it);
      map.set(idx, arr);
    }
    return map;
  }, [ideas]);

  const totalThisWeek = ideas.length;
  const approvedCount = ideas.filter((i) => i.approval_status === "approved" || i.status === "scheduled").length;
  const allApproved = totalThisWeek > 0 && approvedCount === totalThisWeek;

  // Phase I: one-time toast nudge when the week is unseeded
  useEffect(() => {
    if (ideasLoading || !brand?.id) return;
    if (totalThisWeek !== 0) return;
    const key = `v2-unseeded-nudge-${brand.id}-${weekStart.toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast({
      title: "This week isn't drafted yet.",
      description: "Tap Generate this week, or wait for Monday's briefing.",
    });
  }, [ideasLoading, brand?.id, totalThisWeek, weekStart, toast]);

  const handleSeed = async () => {
    if (!brand?.id) return;
    setSeeding(true);
    try {
      const { error } = await supabase.functions.invoke("autopilot-planner", {
        body: { brand_id: brand.id, playbook_id: (brand as any).playbook_id ?? "general", seed: true },
      });
      if (error) throw error;
      toast({ title: "Brewing your week", description: "Refresh in a moment." });
      setTimeout(() => refetch(), 4000);
    } catch (err: any) {
      toast({ title: "Couldn't plan the week", description: err.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const handleApproveAll = async () => {
    if (!brand?.id || !totalThisWeek) return;
    setApproving(true);
    try {
      const ids = ideas.map((i) => i.id);
      const { error } = await supabase
        .from("content_ideas")
        .update({ approval_status: "approved", status: "scheduled" })
        .in("id", ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["v2-cockpit-ideas"] });
      toast({ title: "Week approved.", description: "We'll nudge you each morning when each post is ready." });
    } catch (err: any) {
      toast({ title: "Couldn't approve", description: err.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  if (authLoading || brandLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/cockpit" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] || "there";

  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;

  return (
    <div className="min-h-dvh bg-background lg:pl-20">
      <SEO title="Cockpit — Brandie" description="Your Monday briefing." path="/cockpit" noindex />
      <NewAppHeader />


      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-24 space-y-12">
        {/* HERO BRIEFING */}
        <header className="space-y-3">
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="font-serif text-4xl sm:text-6xl tracking-tight leading-[1]">
            Good morning, {firstName}.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            {totalThisWeek === 0
              ? "Your engine hasn't drafted this week yet. One tap and it will."
              : allApproved
              ? "This week is fully approved. We'll handle the rest."
              : `Your weekly strategy is ready. ${totalThisWeek} posts, sequenced into a 5-day arc.`}
          </p>
        </header>

        {/* WEEK STRIP */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
              The week ahead
            </h2>
            <Link
              to="/blueprint"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Review in detail <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1.5" aria-busy={ideasLoading}>
            {DAY_LABELS.map((label, idx) => {
              const dayIdeas = byDay.get(idx) ?? [];
              const isToday = idx === todayIdx;
              const isPast = idx < todayIdx;
              return (
                <Link
                  key={label}
                  to="/blueprint"
                  className={`relative rounded-xl border p-2.5 sm:p-3 min-h-[100px] flex flex-col gap-1.5 transition-all hover:border-foreground/40 ${
                    isToday
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card"
                  } ${isPast && !isToday ? "opacity-60" : ""}`}
                >
                  <p
                    className={`text-[10px] tracking-wider uppercase ${
                      isToday ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </p>
                  {ideasLoading ? (
                    <div className="mt-auto space-y-1" aria-hidden>
                      <div className="h-1.5 w-3/4 rounded-full bg-muted animate-pulse" />
                      <div className="h-1.5 w-1/2 rounded-full bg-muted animate-pulse" />
                    </div>
                  ) : dayIdeas.length === 0 ? (
                    <span
                      className={`text-[10px] mt-auto ${
                        isToday ? "text-background/40" : "text-muted-foreground/40"
                      }`}
                      aria-label="No posts"
                    >
                      —
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1 mt-auto">
                      {dayIdeas.slice(0, 2).map((it) => {
                        const catId = parseCategoryIds(it.content_category)[0];
                        const meta = catId ? getCategoryMeta(catId) : undefined;
                        return (
                          <div key={it.id} className="flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                meta?.dotClass ?? "bg-muted-foreground"
                              }`}
                            />
                            <span
                              className={`text-[10px] truncate ${
                                isToday ? "text-background" : "text-foreground"
                              }`}
                            >
                              {it.title}
                            </span>
                          </div>
                        );
                      })}
                      {dayIdeas.length > 2 && (
                        <span
                          className={`text-[10px] ${
                            isToday ? "text-background/60" : "text-muted-foreground"
                          }`}
                        >
                          +{dayIdeas.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* THE ARC */}
        {totalThisWeek > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
              This week's arc
            </h2>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {ideas.slice(0, 5).map((it, i) => {
                const catId = parseCategoryIds(it.content_category)[0];
                const meta = catId ? getCategoryMeta(catId) : undefined;
                const dayLabel = it.scheduled_for
                  ? new Date(it.scheduled_for).toLocaleDateString(undefined, {
                      weekday: "long",
                    })
                  : "Unscheduled";
                return (
                  <motion.div
                    key={it.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="px-5 py-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors"
                  >
                    <span className="font-serif text-2xl text-muted-foreground w-10 shrink-0">
                      0{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-[11px] tracking-wider uppercase text-muted-foreground">
                        <span>{dayLabel}</span>
                        {meta && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                              {meta.short}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="font-medium leading-snug">{it.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {it.prompt}
                      </p>
                    </div>
                    {(it.approval_status === "approved" || it.status === "scheduled") && (
                      <Check className="h-4 w-4 text-foreground/50 shrink-0 mt-1" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* APPROVAL ACTION */}
        <section className="rounded-3xl border border-border bg-foreground text-background p-7 sm:p-10 space-y-5">
          {totalThisWeek === 0 ? (
            <>
              <h3 className="font-serif text-3xl tracking-tight">Plant this week.</h3>
              <p className="text-background/70 max-w-md">
                Your engine will draft a 5-day arc tuned to your playbook, audience and
                products. About 30 seconds.
              </p>
              <Button
                onClick={handleSeed}
                disabled={seeding || ideasLoading}
                size="lg"
                variant="secondary"
                className="rounded-full h-12 px-6 gap-2 text-base"
              >
                {seeding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Brewing
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate this week
                  </>
                )}
              </Button>
            </>
          ) : allApproved ? (
            <>
              <h3 className="font-serif text-3xl tracking-tight">Approved. ✓</h3>
              <p className="text-background/70 max-w-md">
                The system has the wheel. You'll get a push when each post is ready to publish.
              </p>
              <Button
                onClick={() => navigate("/blueprint")}
                size="lg"
                variant="secondary"
                className="rounded-full h-12 px-6 gap-2 text-base"
              >
                Open the Blueprint <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <h3 className="font-serif text-3xl tracking-tight">
                One tap and the week ships.
              </h3>
              <p className="text-background/70 max-w-md">
                {approvedCount > 0
                  ? `${approvedCount} of ${totalThisWeek} approved. Approve the rest, or open the Blueprint to edit anything first.`
                  : `${totalThisWeek} posts ready to review. Tweak conversationally in the Blueprint, or approve the whole week now.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleApproveAll}
                  disabled={approving}
                  size="lg"
                  variant="secondary"
                  className="rounded-full h-12 px-6 gap-2 text-base"
                >
                  {approving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Approving
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4" /> Approve the week
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => navigate("/blueprint")}
                  size="lg"
                  variant="ghost"
                  className="rounded-full h-12 px-5 gap-2 text-base text-background hover:bg-background/10 hover:text-background"
                >
                  <CalendarIcon className="h-4 w-4" /> Edit first
                </Button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default Cockpit;
