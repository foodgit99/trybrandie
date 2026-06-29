import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  RotateCcw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import AutopilotStatusBanner from "@/components/v2/AutopilotStatusBanner";
import { getCategoryMeta, parseCategoryIds } from "@/lib/contentCategories";
import IdeaThumb from "@/components/v2/IdeaThumb";
import { useAutopilotStatus } from "@/hooks/useAutopilotStatus";


const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

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

type Idea = {
  id: string;
  title: string;
  prompt: string;
  content_category: string | null;
  scheduled_for: string | null;
  status: string;
  approval_status: string;
  design_id: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
};

const Blueprint = () => {
  const { user, loading: authLoading } = useAuth();
  const { brand, isLoading: brandLoading } = useBrand(user);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const weekStart = useMemo(() => startOfWeek(), []);
  const weekEnd = useMemo(() => endOfWeek(), []);

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["v2-blueprint-ideas", brand?.id, weekStart.toISOString()],
    queryFn: async (): Promise<Idea[]> => {
      if (!brand?.id) return [];
      const { data, error } = await supabase
        .from("content_ideas")
        .select(
          "id, title, prompt, content_category, scheduled_for, status, approval_status, design_id, design:design_id(image_url, caption)",
        )
        .eq("brand_id", brand.id)
        .gte("scheduled_for", weekStart.toISOString())
        .lt("scheduled_for", weekEnd.toISOString())
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
    enabled: !!brand?.id,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["v2-blueprint-ideas"] });

  // Conversational edit bar
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const handleConversationalEdit = async () => {
    const text = editText.trim();
    if (!text || !brand?.id) return;
    setEditing(true);
    try {
      const lower = text.toLowerCase();
      const dayIdx = WEEKDAY_NAMES.findIndex((d) => lower.includes(d.toLowerCase()));

      const mentionsWeek =
        /\b(week|whole week|entire week|7\s*days|this\s*week)\b/.test(lower) ||
        (dayIdx < 0 &&
          /\b(plan|generate|create|build|draft|fill|refresh|regenerate|redo|replan|reset|start over)\b/.test(lower));

      const isReplace =
        /\b(refresh|regenerate|redo|replan|reset|start over|new week|fresh|wipe|clear)\b/.test(lower);

      const isFill = /\b(fill|add|finish|complete|empty days|missing days)\b/.test(lower);

      // ── INTENT 1: Whole-week plan / refresh / fill ──
      if (mentionsWeek || (dayIdx < 0 && (isReplace || isFill))) {
        const action = isReplace || ideas.length === 0 ? "generate_weekly_ideas" : "fill_empty_days";
        const { error } = await supabase.functions.invoke("brand-engine", {
          body: { action, brand_id: brand.id },
        });
        if (error) throw error;
        toast({
          title: action === "generate_weekly_ideas" ? "Week replanned" : "Empty days filled",
          description: "Brandie just reshaped your week. Review and approve below.",
        });
        setEditText("");
        invalidate();
        return;
      }

      // ── INTENT 2: Day-specific edit ──
      if (dayIdx >= 0) {
        const target = ideas.find((it) => {
          if (!it.scheduled_for) return false;
          const wd = new Date(it.scheduled_for).getDay();
          const idx = wd === 0 ? 6 : wd - 1;
          return idx === dayIdx;
        });

        if (!target) {
          const { error } = await supabase.functions.invoke("brand-engine", {
            body: { action: "fill_empty_days", brand_id: brand.id },
          });
          if (error) throw error;
          toast({
            title: `${WEEKDAY_NAMES[dayIdx]} added`,
            description: "Brandie drafted a post for that day. You can tweak it now.",
          });
          setEditText("");
          invalidate();
          return;
        }

        const { data, error } = await supabase.functions.invoke("v2-edit-router", {
          body: { idea_id: target.id, instruction: text },
        });
        if (error) throw error;
        const kind = (data as any)?.kind ?? "text";
        toast({
          title: `${WEEKDAY_NAMES[dayIdx]} updated`,
          description:
            kind === "visual"
              ? "Brandie will re-render the visual."
              : kind === "strategy"
                ? "Brandie reshaped the strategy."
                : "Brandie rewrote the caption.",
        });
        setEditText("");
        invalidate();
        return;
      }

      // ── INTENT 3: Ambiguous ──
      toast({
        title: "Tell Brandie what to do",
        description:
          'Try "plan this week", "refresh the entire week", or "change Thursday\'s post to a restock announcement".',
      });
    } catch (err: any) {
      toast({ title: "Couldn't do that", description: err.message, variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const approveOne = async (id: string) => {
    const { error } = await supabase
      .from("content_ideas")
      .update({ approval_status: "approved", status: "scheduled" })
      .eq("id", id);
    if (error) {
      toast({ title: "Couldn't approve", description: error.message, variant: "destructive" });
      return;
    }
    invalidate();
  };

  const [resetting, setResetting] = useState(false);
  const resetWeek = async () => {
    if (!brand?.id) return;
    setResetting(true);
    try {
      const { error: delErr } = await supabase
        .from("content_ideas")
        .delete()
        .eq("brand_id", brand.id)
        .gte("scheduled_for", weekStart.toISOString())
        .lt("scheduled_for", weekEnd.toISOString());
      if (delErr) throw delErr;
      invalidate();
      toast({
        title: "Replanning your week…",
        description: "Brandie is drafting a fresh arc. This takes a few seconds.",
      });
      const { error: genErr } = await supabase.functions.invoke("brand-engine", {
        body: { action: "generate_weekly_ideas", brand_id: brand.id },
      });
      if (genErr) throw genErr;
      toast({
        title: "Fresh week ready",
        description: "Review the new arc and approve the days you like.",
      });
      invalidate();
    } catch (err: any) {
      toast({ title: "Couldn't reset week", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const removeOne = async (id: string) => {
    const { error } = await supabase.from("content_ideas").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Removed." });
    invalidate();
  };

  if (authLoading || brandLoading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/blueprint" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/onboarding" replace />;

  const grouped = WEEKDAY_NAMES.map((name, idx) => {
    const dayIdeas = ideas.filter((it) => {
      if (!it.scheduled_for) return false;
      const wd = new Date(it.scheduled_for).getDay();
      const i = wd === 0 ? 6 : wd - 1;
      return i === idx;
    });
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + idx);
    return { name, idx, date, ideas: dayIdeas };
  });

  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const approvedAll =
    ideas.length > 0 &&
    ideas.every((i) => i.approval_status === "approved" || i.status === "scheduled");

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-40">
      <SEO title="Weekly Blueprint, Brandie" description="Your week, as a story." path="/blueprint" noindex />
      <NewAppHeader />


      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-10">
        <AutopilotStatusBanner brandId={brand?.id} showApproveAll />
        <header className="space-y-3">
          <Link
            to="/cockpit"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Cockpit
          </Link>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
              This week, as a story.
            </h1>
            {ideas.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resetting}
                    className="rounded-full h-9 px-3 gap-1.5 shrink-0"
                  >
                    {resetting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Reset week
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset this week?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This clears every post Brandie planned for this week — approved or not —
                      and immediately drafts a fresh arc in its place. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep week</AlertDialogCancel>
                    <AlertDialogAction onClick={resetWeek}>Reset & replan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-muted-foreground max-w-xl">
            {resetting
              ? "Brandie is drafting a fresh arc for this week. Hang tight — this takes a few seconds."
              : ideas.length === 0
              ? 'Nothing planned this week yet. Tell Brandie below — try "plan this week" — and she\'ll draft the full arc.'
              : approvedAll
              ? 'All approved. Edit any day, or say "refresh the entire week" to start over.'
              : "Review the arc. Tap to approve, or talk to Brandie at the bottom to plan, refresh, or tweak any day."}
          </p>

        </header>

        {/* TIMELINE */}
        <section className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" aria-hidden />
          <ol className="space-y-6">
            {grouped.map(({ name, idx, date, ideas: dayIdeas }) => {
              const isToday = idx === todayIdx;
              return (
                <li key={name} className="grid grid-cols-[40px_1fr] gap-4">
                  <div className="relative">
                    <div
                      className={`h-10 w-10 rounded-full border-2 grid place-items-center text-[10px] font-medium ${
                        isToday
                          ? "bg-foreground text-background border-foreground"
                          : dayIdeas.length
                          ? "bg-background border-foreground text-foreground"
                          : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>

                  <div className="pt-1.5 space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-serif text-2xl tracking-tight">{name}</h3>
                      <span className="text-[10px] tracking-wider uppercase text-muted-foreground">
                        {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    {dayIdeas.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Nothing scheduled, Brandie kept this day light.
                      </div>
                    ) : (
                      <AnimatePresence>
                        {dayIdeas.map((it) => {
                          const catId = parseCategoryIds(it.content_category)[0];
                          const meta = catId ? getCategoryMeta(catId) : undefined;
                          const isApproved =
                            it.approval_status === "approved" || it.status === "scheduled";
                          return (
                            <motion.div
                              key={it.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px] tracking-wider uppercase text-muted-foreground">
                                <div className="flex items-center gap-2 min-w-0">
                                  {meta && (
                                    <span className="flex items-center gap-1.5">
                                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                                      {meta.short}
                                    </span>
                                  )}
                                  {isApproved && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-1 text-foreground">
                                        <Check className="h-3 w-3" /> Approved
                                      </span>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeOne(it.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  aria-label="Remove post"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="flex gap-3">
                                <IdeaThumb design={it.design} emoji={meta?.short?.[0]} size="md" />
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="font-medium leading-snug">{it.title}</p>
                                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                    {it.prompt}
                                  </p>
                                  {it.design?.caption && (
                                    <p className="text-xs text-muted-foreground/80 italic line-clamp-2">
                                      "{it.design.caption}"
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                {!isApproved && (
                                  <Button
                                    size="sm"
                                    onClick={() => approveOne(it.id)}
                                    className="rounded-full h-8 px-3 gap-1.5"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                )}
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full h-8 px-3 gap-1.5"
                                >
                                  <Link to={`/post/${it.id}`}>Open</Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full h-8 px-3 gap-1.5 text-muted-foreground"
                                  onClick={() => {
                                    setEditText(`Change ${name}'s post to `);
                                    composerRef.current?.focus();
                                  }}
                                >
                                  <Wand2 className="h-3.5 w-3.5" /> Tweak
                                </Button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        )}
      </main>

      {/* CONVERSATIONAL EDIT BAR */}
      <div className="fixed bottom-0 inset-x-0 lg:pl-20 z-30 pointer-events-none">
        <div className="px-3 pb-3 sm:pb-5 lg:pb-6 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <div
              className="rounded-3xl border border-border bg-background/95 backdrop-blur shadow-lg shadow-foreground/5 p-3 sm:p-3.5"
              style={{ marginBottom: "max(env(safe-area-inset-bottom), 64px)" }}
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] tracking-wider uppercase text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Talk to Brandie
                  </div>
                  <Textarea
                    ref={composerRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder='e.g. "Plan this week" · "Refresh the entire week" · "Change Thursday to a restock announcement"'
                    className="min-h-[44px] max-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-1 text-[15px] placeholder:text-muted-foreground/60"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleConversationalEdit();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleConversationalEdit}
                  disabled={!editText.trim() || editing}
                  size="icon"
                  className="rounded-full h-10 w-10 shrink-0"
                  aria-label="Send edit"
                >
                  {editing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Blueprint;
