import SEO from "@/components/SEO";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, getWeek } from "date-fns";
import {
  Gauge,
  CheckCircle2,
  Sparkles,
  Image as ImageIcon,
  CalendarCheck,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Share2,
  Copy,
  Loader2,
  Clock,
  Plus,
  ChevronRight,
  ChevronDown,
  Lock,
  Pencil,
  Replace,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Narrative arc tags map by day-of-week (Mon-Sun)
const ARC_TAGS = ["Teaser", "Educate", "Hard Sell", "Urgency", "Closing", "Story", "Recap"];

// Idea Stack angles (Pillar 2)
const ANGLES = [
  { key: "storyteller", label: "The Storyteller", hint: "Origin or behind-the-scenes" },
  { key: "problem", label: "Problem / Solution", hint: "Pain → your offer" },
  { key: "proof", label: "Social Proof", hint: "Customer wins & testimonials" },
  { key: "authority", label: "The Authority", hint: "Educate to lead the market" },
  { key: "urgency", label: "Urgency", hint: "Limited time / stock" },
  { key: "behind", label: "Behind the Scenes", hint: "Process, people, place" },
  { key: "testimonial", label: "Testimonial", hint: "Real words from buyers" },
];

const Cockpit = () => {
  const { user } = useAuth();
  const { brand } = useBrand(user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dropParam = searchParams.get("drop");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [pivotIdea, setPivotIdea] = useState<any | null>(null);
  const [pivotPrompt, setPivotPrompt] = useState("");
  const [pivotSaving, setPivotSaving] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState(true);

  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const sunday = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekStartISO = useMemo(() => monday.toISOString().split("T")[0], [monday]);
  const weekNum = getWeek(today);

  // Profile (credits)
  const { data: profile } = useQuery({
    queryKey: ["cockpit-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("paid_credits, bonus_credits, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as { paid_credits: number; bonus_credits: number; full_name: string | null } | null;
    },
    enabled: !!user,
  });

  // Week ideas
  const { data: ideas = [], isLoading: ideasLoading, refetch: refetchIdeas } = useQuery({
    queryKey: ["cockpit-week-ideas", brand?.id, monday.toDateString()],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data } = await supabase
        .from("content_ideas")
        .select("*, designs:design_id(image_url, caption)")
        .eq("brand_id", brand.id)
        .gte("scheduled_for", monday.toISOString().split("T")[0])
        .lte("scheduled_for", sunday.toISOString().split("T")[0])
        .order("scheduled_for");
      return data || [];
    },
    enabled: !!brand?.id,
  });

  // Weekly blueprint (lock/unlock state)
  const { data: blueprint, refetch: refetchBp } = useQuery({
    queryKey: ["blueprint", brand?.id, weekStartISO],
    queryFn: async () => {
      if (!brand?.id) return null;
      const { data } = await supabase
        .from("weekly_blueprints")
        .select("*")
        .eq("brand_id", brand.id)
        .eq("week_start_date", weekStartISO)
        .maybeSingle();
      return data;
    },
    enabled: !!brand?.id,
  });

  const isLocked = blueprint?.status === "locked" || blueprint?.status === "approved";

  // Group by day
  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(monday, i);
      const dayIdeas = ideas.filter((idea: any) => {
        if (!idea.scheduled_for) return false;
        const d = new Date(idea.scheduled_for);
        return isSameDay(d, date);
      });
      return { date, dayIdeas, arc: ARC_TAGS[i] };
    });
  }, [ideas, monday]);

  // Signals
  const totalCredits = (profile?.paid_credits ?? 0) + (profile?.bonus_credits ?? 0);
  const approvedCount = ideas.filter((i: any) => i.status === "scheduled" || i.status === "posted").length;
  const designsReady = ideas.filter((i: any) => i.design_id).length;
  const daysCovered = days.filter((d) => d.dayIdeas.length > 0).length;
  const pendingApproval = ideas.filter((i: any) => i.status === "suggested" || i.status === "created").length;

  // Default open when drafts pending, collapsed when locked
  useEffect(() => {
    setRationaleOpen(!isLocked);
  }, [isLocked]);

  const todayIdeas = useMemo(
    () => ideas.filter((i: any) => i.scheduled_for && isSameDay(new Date(i.scheduled_for), today)),
    [ideas, today]
  );
  const todaysDrop = todayIdeas.find((i: any) => i.design_id) || todayIdeas[0];

  // Auto-scroll to today's drop section if arrived via daily push deep link
  useEffect(() => {
    if (dropParam) {
      setTimeout(() => {
        const el = document.getElementById("todays-drop");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [dropParam]);

  const greeting = useMemo(() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, [today]);

  const firstName = (profile?.full_name || user?.email?.split("@")[0] || "there").split(" ")[0];

  const invalidateWeek = () => {
    qc.invalidateQueries({ queryKey: ["cockpit-week-ideas"] });
    qc.invalidateQueries({ queryKey: ["blueprint"] });
    refetchIdeas();
    refetchBp();
  };

  // Approve all (mark suggested → scheduled) AND upsert blueprint row
  const handleApproveAll = async () => {
    if (!brand?.id || !user) return;
    setApproving(true);
    try {
      // Ensure blueprint exists & mark approved
      let bpId = blueprint?.id;
      if (!bpId) {
        const { data: newBp, error: bpErr } = await supabase
          .from("weekly_blueprints")
          .insert({
            user_id: user.id,
            brand_id: brand.id,
            week_start_date: weekStartISO,
            status: "approved",
            approved_at: new Date().toISOString(),
            source: "manual",
          })
          .select("id")
          .single();
        if (bpErr) throw bpErr;
        bpId = newBp.id;
      } else {
        await supabase
          .from("weekly_blueprints")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", bpId);
      }

      // Flip drafts to scheduled + link blueprint
      const ids = ideas
        .filter((i: any) => i.status === "suggested" || i.status === "created")
        .map((i: any) => i.id);
      const allIds = ideas.map((i: any) => i.id);
      if (ids.length) {
        const { error } = await supabase
          .from("content_ideas")
          .update({ status: "scheduled" } as any)
          .in("id", ids);
        if (error) throw error;
      }
      if (allIds.length && bpId) {
        await supabase
          .from("content_ideas")
          .update({ blueprint_id: bpId } as any)
          .in("id", allIds);
      }

      toast({ title: "Week locked in", description: `${allIds.length} drops scheduled. Brandie will deliver on schedule.` });
      invalidateWeek();
    } catch (e: any) {
      toast({ title: "Couldn't approve", description: e.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const handleUnlock = async () => {
    if (!blueprint?.id) return;
    try {
      await supabase
        .from("weekly_blueprints")
        .update({ status: "draft", approved_at: null })
        .eq("id", blueprint.id);
      toast({ title: "Week unlocked", description: "You can edit or swap drops." });
      invalidateWeek();
    } catch (e: any) {
      toast({ title: "Couldn't unlock", description: e.message, variant: "destructive" });
    }
  };

  const openPivot = (idea: any) => {
    setPivotIdea(idea);
    setPivotPrompt(idea?.prompt || "");
  };

  const handleQuickPivot = async () => {
    if (!pivotIdea || !pivotPrompt.trim()) return;
    setPivotSaving(true);
    try {
      await supabase
        .from("content_ideas")
        .update({
          prompt: pivotPrompt.trim(),
          design_id: null,
          status: "suggested",
          autopilot_status: null,
        } as any)
        .eq("id", pivotIdea.id);
      toast({ title: "Day updated", description: "Brandie will regenerate this drop on the next autopilot run." });
      setPivotIdea(null);
      setPivotPrompt("");
      invalidateWeek();
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e.message, variant: "destructive" });
    } finally {
      setPivotSaving(false);
    }
  };

  const handleGenerateWeek = () => navigate("/content");

  const shareToWhatsApp = async (idea: any) => {
    const caption = idea.designs?.caption || idea.title || "Check this out";
    const imageUrl: string | undefined = idea.designs?.image_url || idea.designs?.render_url;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (imageUrl) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
        const file = new File([blob], `brandie-drop.${ext}`, { type: blob.type || "image/jpeg" });
        const payload: ShareData = { files: [file], text: caption, title: "Today's Drop" };
        if (navigator.canShare?.(payload) && navigator.share) {
          try {
            await navigator.share(payload);
            return;
          } catch (err: any) {
            if (err?.name === "AbortError") return;
          }
        }

        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = `brandie-drop.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 2000);

        try { await navigator.clipboard.writeText(caption); } catch {}

        const waUrl = isMobile
          ? `https://wa.me/?text=${encodeURIComponent(caption)}`
          : `https://web.whatsapp.com/`;
        window.open(waUrl, "_blank");

        toast({ title: "Image downloaded", description: "Caption copied. Attach the image in WhatsApp to post." });
        return;
      } catch (e) {
        // fall through
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
  };

  const copyCaption = async (idea: any) => {
    const caption = idea.designs?.caption || idea.title || "";
    await navigator.clipboard.writeText(caption);
    toast({ title: "Caption copied" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Cockpit - Brandie" description="Today's drop and one-tap WhatsApp share." path="/cockpit" noindex />
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 lg:pl-24">
        {/* Briefing Header */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                The Briefing · Week {weekNum}
              </p>
              <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
                {greeting}, {firstName}.
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {pendingApproval > 0
                  ? `Your Week ${weekNum} blueprint is ready for review.`
                  : daysCovered > 0
                  ? "Your week is locked in. Time to execute."
                  : "Let's build this week's blueprint."}
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 sm:flex">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">{totalCredits} credits</span>
            </div>
          </div>
        </motion.section>

        {/* Signal Strip */}
        <section className="mb-8 grid grid-cols-3 gap-3">
          <SignalCard label="Approved" value={approvedCount} icon={CheckCircle2} />
          <SignalCard label="Designs ready" value={designsReady} icon={ImageIcon} />
          <SignalCard label="Days covered" value={`${daysCovered}/7`} icon={CalendarCheck} />
        </section>

        {/* Week Blueprint */}
        <section id="week-blueprint" className="mb-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-2xl text-foreground">This Week's Blueprint</h2>
              <p className="text-sm text-muted-foreground">
                {format(monday, "MMM d")} – {format(sunday, "MMM d")}
              </p>
            </div>
            {isLocked ? (
              <Button variant="outline" size="sm" onClick={handleUnlock}>
                <Lock className="mr-2 h-4 w-4" />
                Unlock week
              </Button>
            ) : pendingApproval > 0 ? (
              <Button onClick={handleApproveAll} disabled={approving} size="sm">
                {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Approve All ({pendingApproval})
              </Button>
            ) : daysCovered === 0 ? (
              <Button onClick={handleGenerateWeek} size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </Button>
            ) : null}
          </div>

          {/* Rationale collapsible */}
          {daysCovered > 0 && (
            <Collapsible open={rationaleOpen} onOpenChange={setRationaleOpen} className="mb-4">
              <Card className="border-border/60 bg-card">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Week {weekNum} blueprint
                    </span>
                    <Badge variant={isLocked ? "default" : "outline"} className="h-5 gap-1 px-2 text-[10px]">
                      {isLocked ? (<><Lock className="h-2.5 w-2.5" /> Locked</>) : pendingApproval > 0 ? "Draft" : "Awaiting"}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      rationaleOpen && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 border-t border-border/60 px-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      {isLocked
                        ? "Brandie is on the wheel. Just show up and share - each day is mapped to a narrative arc that builds momentum across the week."
                        : pendingApproval > 0
                        ? "Review each day below, swap anything that doesn't fit with Quick pivot, then approve once. Each day is mapped to a narrative arc that builds momentum across the week."
                        : "Each day is mapped to a narrative arc that builds momentum across the week."}
                    </p>
                    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {days.map((d, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex w-20 shrink-0 flex-col items-center rounded-xl border px-2 py-2",
                            isSameDay(d.date, today) ? "border-foreground/40 bg-secondary" : "border-border/60"
                          )}
                        >
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {format(d.date, "EEE")}
                          </span>
                          <span className="font-serif text-base leading-none text-foreground">
                            {format(d.date, "d")}
                          </span>
                          <span className="mt-1 text-center text-[10px] font-medium text-foreground/80">
                            {d.arc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {ideasLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : daysCovered === 0 ? (
            <EmptyBlueprint onGenerate={handleGenerateWeek} />
          ) : (
            <div className="space-y-3">
              {days.map((d, i) => (
                <DayRow
                  key={i}
                  date={d.date}
                  arc={d.arc}
                  ideas={d.dayIdeas}
                  isToday={isSameDay(d.date, today)}
                  locked={isLocked}
                  onOpen={() => navigate("/content")}
                  onPivot={openPivot}
                />
              ))}
            </div>
          )}
        </section>

        {/* Trend Pulse */}
        <section className="mb-10">
          <Card className="border-border/60 bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-secondary p-2.5">
                <TrendingUp className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-foreground">Trend Pulse</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Localized hooks shaping your niche this week.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PulseChip label="Payday weekend" />
                  <PulseChip label="Back-to-school" />
                  <PulseChip label="Local holiday triggers" />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/content")}>
                View
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        </section>

        {/* Idea Stack */}
        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-2xl text-foreground">Idea Stack</h2>
              <p className="text-sm text-muted-foreground">Swap an angle into any day.</p>
            </div>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ANGLES.map((a) => (
              <button
                key={a.key}
                onClick={() => navigate("/content")}
                className="group flex w-44 shrink-0 flex-col justify-between rounded-2xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-foreground/30"
              >
                <div className="rounded-lg bg-secondary p-2 w-fit">
                  <Lightbulb className="h-3.5 w-3.5 text-foreground" />
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold text-foreground">{a.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.hint}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs text-foreground opacity-60 transition-opacity group-hover:opacity-100">
                  Use this
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Today's Drop */}
        {todaysDrop && (
          <section id="todays-drop" className="mb-6">
            <h2 className="mb-3 font-serif text-2xl text-foreground">Today's Drop</h2>
            <Card className="overflow-hidden border-border/60 bg-card">
              <div className="flex flex-col sm:flex-row">
                <div className="aspect-square w-full bg-muted sm:w-40 sm:shrink-0">
                  {todaysDrop.designs?.image_url ? (
                    <img
                      src={todaysDrop.designs.image_url}
                      alt={todaysDrop.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      {format(today, "EEE · MMM d")}
                    </Badge>
                    <p className="font-medium text-foreground">{todaysDrop.title}</p>
                    {todaysDrop.designs?.caption && (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {todaysDrop.designs.caption}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => shareToWhatsApp(todaysDrop)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share to WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyCaption(todaysDrop)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy caption
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </section>
        )}
      </main>

      {/* Quick Pivot Sheet */}
      <Sheet open={!!pivotIdea} onOpenChange={(o) => !o && setPivotIdea(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">Quick pivot</SheetTitle>
            <SheetDescription>
              Rewrite the angle for this drop. Brandie will regenerate the design on the next autopilot run.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {pivotIdea && pivotIdea.scheduled_for && (
              <div className="rounded-xl border border-border/60 bg-card p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {format(new Date(pivotIdea.scheduled_for), "EEEE · MMM d")}
                </p>
                <p className="mt-1 font-medium text-foreground">{pivotIdea.title}</p>
              </div>
            )}
            <Textarea
              value={pivotPrompt}
              onChange={(e) => setPivotPrompt(e.target.value)}
              placeholder="e.g. swap to a restock announcement for the bestseller scarf"
              className="min-h-[140px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPivotIdea(null)}>
                Cancel
              </Button>
              <Button onClick={handleQuickPivot} disabled={pivotSaving || !pivotPrompt.trim()}>
                {pivotSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Replace className="mr-2 h-4 w-4" />
                )}
                Save pivot
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const SignalCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Card className="border-border/60 bg-card p-4">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    <p className="mt-3 font-serif text-3xl leading-none text-foreground">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </Card>
);

const PulseChip = ({ label }: { label: string }) => (
  <span className="rounded-full border border-border/60 bg-secondary px-3 py-1 text-xs font-medium text-foreground">
    {label}
  </span>
);

const DayRow = ({
  date,
  arc,
  ideas,
  isToday,
  locked,
  onOpen,
  onPivot,
}: {
  date: Date;
  arc: string;
  ideas: any[];
  isToday: boolean;
  locked: boolean;
  onOpen: () => void;
  onPivot: (idea: any) => void;
}) => {
  const idea = ideas[0];
  const status = idea?.status;
  const hasDesign = !!idea?.design_id;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-colors",
        isToday ? "border-foreground/40" : "border-border/60"
      )}
    >
      <button
        onClick={onOpen}
        className="group flex w-full items-center gap-4 p-4 text-left"
      >
        <div className="flex w-14 shrink-0 flex-col items-center">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{format(date, "EEE")}</span>
          <span className="font-serif text-2xl leading-none text-foreground">{format(date, "d")}</span>
        </div>

        <div className="h-10 w-px bg-border/60" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {arc}
            </span>
            {idea?.content_format === "carousel" && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                Carousel
              </Badge>
            )}
            {isToday && (
              <Badge className="h-4 px-1.5 text-[10px]">Today</Badge>
            )}
          </div>
          {idea ? (
            <p className="mt-1 truncate text-sm font-medium text-foreground">{idea.title}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground italic">Open day to add a post</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {idea ? (
            <StatusPill status={status} hasDesign={hasDesign} />
          ) : (
            <span className="rounded-full border border-dashed border-border p-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </button>

      {idea && !locked && (
        <div className="flex justify-end gap-2 border-t border-border/40 px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPivot(idea);
            }}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Quick pivot
          </Button>
        </div>
      )}
    </div>
  );
};

const StatusPill = ({ status, hasDesign }: { status?: string; hasDesign: boolean }) => {
  if (status === "posted")
    return (
      <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
        <CheckCircle2 className="h-3 w-3" /> Posted
      </span>
    );
  if (status === "scheduled")
    return (
      <span className="flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
        <CheckCircle2 className="h-3 w-3" /> Scheduled
      </span>
    );
  if (hasDesign)
    return (
      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground">
        Ready
      </span>
    );
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Drafting
    </span>
  );
};

const EmptyBlueprint = ({ onGenerate }: { onGenerate: () => void }) => (
  <Card className="flex flex-col items-center gap-4 border-dashed border-border bg-card p-10 text-center">
    <div className="rounded-full bg-secondary p-3">
      <Sparkles className="h-5 w-5 text-foreground" />
    </div>
    <div>
      <p className="font-serif text-xl text-foreground">No blueprint yet</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Generate this week's plan and Brandie will fill every day with on-brand content.
      </p>
    </div>
    <Button onClick={onGenerate}>
      <Sparkles className="mr-2 h-4 w-4" />
      Generate this week
    </Button>
  </Card>
);

export default Cockpit;
