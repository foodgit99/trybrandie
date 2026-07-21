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
  Layers,
} from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import AutopilotStatusBanner from "@/components/v2/AutopilotStatusBanner";
import DayOverview from "@/components/v2/DayOverview";
import CEOBriefingPreview from "@/components/v2/CEOBriefingPreview";
import PushOptInCard from "@/components/PushOptInCard";
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
  autopilot?: boolean | null;
  autopilot_status?: string | null;
  design_id?: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
};


const Cockpit = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingDay, setApprovingDay] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  // Forward legacy email deep-links like /cockpit?drop=<idea_id> to /post/<idea_id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drop = params.get("drop");
    if (drop) navigate(`/post/${drop}`, { replace: true });
  }, [navigate]);

  const weekStart = useMemo(() => startOfWeek(), []);
  const weekEnd = useMemo(() => endOfWeek(), []);

  const { data: ideas = [], isLoading: ideasLoading, refetch } = useQuery({
    queryKey: ["v2-cockpit-ideas", brand?.id, weekStart.toISOString()],
    queryFn: async (): Promise<Idea[]> => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id, title, prompt, content_category, scheduled_for, day_of_week, status, approval_status, autopilot, autopilot_status, design_id, design:design_id(image_url, caption)")
        .eq("brand_id", brand.id)
        .gte("scheduled_for", weekStart.toISOString())
        .lt("scheduled_for", weekEnd.toISOString())
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
    enabled: !!brand?.id,
  });

  const { data: recentDesigns = [] } = useQuery({
    queryKey: ["v2-cockpit-recent-designs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("designs")
        .select("id, title, image_url, caption, created_at, content_idea_id, carousel_id, slide_index")
        .eq("user_id", user.id)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;

      // Collapse carousel slides into a single tile (use cover = lowest slide_index).
      type Item = {
        id: string;
        title: string | null;
        image_url: string | null;
        created_at: string;
        carousel_id: string | null;
        slide_count: number;
      };
      const singles: Item[] = [];
      const groups = new Map<string, Item[]>();
      for (const d of (data ?? []) as any[]) {
        if (d.carousel_id) {
          const arr = groups.get(d.carousel_id) ?? [];
          arr.push(d);
          groups.set(d.carousel_id, arr);
        } else {
          singles.push({ ...d, slide_count: 1 });
        }
      }
      const carousels: Item[] = [];
      for (const [cid, slides] of groups.entries()) {
        const sorted = [...slides].sort(
          (a: any, b: any) => (a.slide_index ?? 0) - (b.slide_index ?? 0),
        );
        const cover = sorted[0];
        carousels.push({
          id: cover.id,
          title: cover.title,
          image_url: cover.image_url,
          created_at: cover.created_at,
          carousel_id: cid,
          slide_count: sorted.length,
        });
      }
      return [...singles, ...carousels]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 12);
    },
    enabled: !!user?.id,
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
      toast({ title: "Drafting your week…", description: "Brandie is sketching the arc. A few seconds." });
      const { error } = await supabase.functions.invoke("brand-engine", {
        body: { action: "generate_weekly_ideas", brand_id: brand.id },
      });
      if (error) throw error;
      await refetch();
      toast({ title: "Week ready", description: "Review the arc and approve the days you like." });
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

  const handleApproveOne = async (id: string) => {
    setApprovingId(id);
    try {
      const { error } = await supabase
        .from("content_ideas")
        .update({ approval_status: "approved", status: "scheduled" })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["v2-cockpit-ideas"] });
    } catch (err: any) {
      toast({ title: "Couldn't approve", description: err.message, variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveDay = async (dayIdeas: Idea[]) => {
    if (!dayIdeas.length) return;
    setApprovingDay(true);
    try {
      const ids = dayIdeas.map((i) => i.id);
      const { error } = await supabase
        .from("content_ideas")
        .update({ approval_status: "approved", status: "scheduled" })
        .in("id", ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["v2-cockpit-ideas"] });
      toast({ title: "Day approved." });
    } catch (err: any) {
      toast({ title: "Couldn't approve", description: err.message, variant: "destructive" });
    } finally {
      setApprovingDay(false);
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
      <SEO title="Cockpit, Brandie" description="Your Monday briefing." path="/cockpit" noindex />
      <NewAppHeader />


      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-24 space-y-12">
        <AutopilotStatusBanner brandId={brand?.id} />
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
          </div>

          <div className="grid grid-cols-7 gap-1.5" aria-busy={ideasLoading}>
            {DAY_LABELS.map((label, idx) => {
              const dayIdeas = byDay.get(idx) ?? [];
              const isToday = idx === todayIdx;
              const isPast = idx < todayIdx;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedDayIdx(idx)}
                  aria-pressed={(selectedDayIdx ?? todayIdx) === idx}
                  className={`relative text-left rounded-xl border p-2.5 sm:p-3 min-h-[100px] flex flex-col gap-1.5 transition-all hover:border-foreground/40 ${
                    (selectedDayIdx ?? todayIdx) === idx
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : ""
                  } ${
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
                      -
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
                </button>
              );
            })}
          </div>

          {(() => {
            const activeDayIdx = selectedDayIdx ?? todayIdx;
            const dayIdeas = byDay.get(activeDayIdx) ?? [];
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + activeDayIdx);
            return (
              <DayOverview
                dayLabel={DAY_LABELS[activeDayIdx]}
                date={dayDate}
                isToday={activeDayIdx === todayIdx}
                ideas={dayIdeas}
                onClose={() => setSelectedDayIdx(todayIdx)}
                onApprove={handleApproveOne}
                onApproveAll={() => handleApproveDay(dayIdeas)}
                onSeed={handleSeed}
                approvingId={approvingId}
                approvingAll={approvingDay}
                seeding={seeding}
                weekIsEmpty={totalThisWeek === 0}
              />
            );
          })()}
        </section>

        {/* THE ARC */}
        {totalThisWeek > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
                This week's arc
              </h2>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Swipe →
              </span>
            </div>
            <div
              className="-mx-5 sm:-mx-8 px-5 sm:px-8 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <ol className="flex gap-3 sm:gap-4 pb-2">
                {ideas.slice(0, 7).map((it, i) => {
                  const catId = parseCategoryIds(it.content_category)[0];
                  const meta = catId ? getCategoryMeta(catId) : undefined;
                  const dayLabel = it.scheduled_for
                    ? new Date(it.scheduled_for).toLocaleDateString(undefined, {
                        weekday: "long",
                      })
                    : "Unscheduled";
                  const isApproved =
                    it.approval_status === "approved" || it.status === "scheduled";
                  return (
                    <motion.li
                      key={it.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="snap-start shrink-0 w-[78%] sm:w-[300px]"
                    >
                      <Link
                        to={`/post/${it.id}`}
                        className="group h-full flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/40 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <span className="font-serif text-3xl text-muted-foreground leading-none">
                            0{i + 1}
                          </span>
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-foreground/60">
                              <Check className="h-3 w-3" /> Approved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
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
                        <p className="font-medium leading-snug line-clamp-2">
                          {it.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">
                          {it.prompt}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                          Open <ArrowRight className="h-3 w-3" />
                        </span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}


        {/* STUDIO CARD */}
        <section className="rounded-3xl border border-border bg-card p-7 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="space-y-2 max-w-md">
            <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Studio
            </div>
            <h3 className="font-serif text-3xl tracking-tight">Create something off-script.</h3>
            <p className="text-muted-foreground">
              Need a one-off post outside this week's plan? Open the Studio and prompt your way to a fresh design.
            </p>
          </div>
          <Button
            onClick={() => navigate("/studio")}
            size="lg"
            className="rounded-full h-12 px-6 gap-2 text-base shrink-0"
          >
            Open the Studio <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        {/* PUSH OPT-IN */}
        <PushOptInCard />

        {/* CEO BRIEFING PREVIEW */}
        <CEOBriefingPreview brandId={brand?.id} brandName={brand?.name} />

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

        {/* HISTORY CAROUSEL */}
        {recentDesigns.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                  History
                </div>
                <h3 className="font-serif text-2xl tracking-tight mt-1">Recently shipped</h3>
              </div>
              <Link
                to="/history"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <ol className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none">
                {recentDesigns.map((d: any) => (
                  <li key={d.id} className="snap-start shrink-0 w-[160px] sm:w-[180px]">
                    <Link
                      to={`/history?design=${d.id}`}
                      className="group block rounded-2xl overflow-hidden border border-border bg-card transition-all hover:border-foreground/40"
                    >
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        <img
                          src={d.image_url}
                          alt={d.title ?? "Design"}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
                        />
                        {d.carousel_id && d.slide_count > 1 && (
                          <span
                            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm"
                            aria-label={`Carousel, ${d.slide_count} slides`}
                          >
                            <Layers className="h-3 w-3" />
                            {d.slide_count}
                          </span>
                        )}
                      </div>
                      {d.title && (
                        <div className="p-2.5">
                          <p className="text-xs font-medium line-clamp-2">{d.title}</p>
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Cockpit;
