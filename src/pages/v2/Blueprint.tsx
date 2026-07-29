import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
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
  X,
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

async function approveBlueprintWeek(brandId: string, weekStart: Date, weekEnd: Date) {
  const weekStartDate = weekStart.toISOString().slice(0, 10);
  const weekEndDate = weekEnd.toISOString().slice(0, 10);

  const { data: blueprintIds } = await supabase
    .from("content_ideas")
    .select("blueprint_id")
    .eq("brand_id", brandId)
    .not("blueprint_id", "is", null)
    .gte("scheduled_for", weekStartDate)
    .lt("scheduled_for", weekEndDate);

  const ids = Array.from(
    new Set((blueprintIds ?? []).map((row: any) => row.blueprint_id).filter(Boolean)),
  );

  await supabase
    .from("content_ideas")
    .update({ approval_status: "approved", status: "scheduled" })
    .eq("brand_id", brandId)
    .gte("scheduled_for", weekStartDate)
    .lt("scheduled_for", weekEndDate);

  if (ids.length > 0) {
    await supabase
      .from("weekly_blueprints" as any)
      .update({ status: "approved", approved_at: new Date().toISOString() } as any)
      .in("id", ids);
  }
}

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

  // ── Mode-aware auto-planning ────────────────────────────────────────────
  const { data: apStatus } = useAutopilotStatus(brand?.id);
  const mode = apStatus?.mode ?? null;
  const autoPlannedRef = useRef<Set<string>>(new Set());
  const [autoPlanning, setAutoPlanning] = useState(false);

  useEffect(() => {
    if (!brand?.id || !mode || isLoading) return;
    if (mode === "manual") return;
    if (ideas.length > 0) return;
    const key = `${brand.id}:${weekStart.toISOString()}`;
    if (autoPlannedRef.current.has(key)) return;
    autoPlannedRef.current.add(key);

    (async () => {
      setAutoPlanning(true);
      try {
        toast({
          title: "Brandie is planning your week…",
          description:
            mode === "autonomous"
              ? "Drafting the arc, approving it, and starting today's post."
              : "Drafting the arc — review and approve when ready.",
        });
        const { error: genErr } = await supabase.functions.invoke("brand-engine", {
          body: { action: "generate_weekly_ideas", brand_id: brand.id },
        });
        if (genErr) throw genErr;

        if (mode === "autonomous") {
          await approveBlueprintWeek(brand.id, weekStart, weekEnd);
          // Kick today's render immediately; don't await failures fatally.
          supabase.functions
            .invoke("content-autopilot", { body: { brand_id: brand.id, force: true } })
            .catch((e) => console.warn("[blueprint] content-autopilot kick failed", e));
        }

        invalidate();
        toast({
          title: mode === "autonomous" ? "Week live" : "Week drafted",
          description:
            mode === "autonomous"
              ? "Brandie approved the week. Today's post is rendering."
              : "Review the arc and tap Approve week when you're happy.",
        });
      } catch (err: any) {
        toast({
          title: "Couldn't auto-plan the week",
          description: err.message ?? String(err),
          variant: "destructive",
        });
      } finally {
        setAutoPlanning(false);
      }
    })();
  }, [brand?.id, mode, ideas.length, isLoading, weekStart, weekEnd]);

  // ── Autonomous: auto-generate any approved-but-unrendered ideas ─────────
  const autoGenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!brand?.id || mode !== "autonomous" || isLoading) return;
    const pending = ideas.filter(
      (i) => i.approval_status === "approved" && !i.design_id,
    );
    if (pending.length === 0) return;
    // Key by the set of pending idea ids so new approvals re-trigger.
    const key = `${brand.id}:${pending.map((i) => i.id).sort().join(",")}`;
    if (autoGenRef.current.has(key)) return;
    autoGenRef.current.add(key);
    supabase.functions
      .invoke("content-autopilot", { body: { brand_id: brand.id, force: true } })
      .catch((e) => console.warn("[blueprint] autonomous autogen kick failed", e));
  }, [brand?.id, mode, isLoading, ideas]);

  // Approve every unapproved idea for this week (Assisted ritual).
  const [approvingWeek, setApprovingWeek] = useState(false);
  const approveWeek = async () => {
    if (!brand?.id) return;
    setApprovingWeek(true);
    try {
      await approveBlueprintWeek(brand.id, weekStart, weekEnd);
      supabase.functions
        .invoke("content-autopilot", { body: { brand_id: brand.id, force: true } })
        .catch((e) => console.warn("[blueprint] content-autopilot kick failed", e));
      toast({
        title: "Week approved",
        description: "Brandie will render and email each day on schedule.",
      });
      invalidate();
    } catch (err: any) {
      toast({ title: "Couldn't approve week", description: err.message, variant: "destructive" });
    } finally {
      setApprovingWeek(false);
    }
  };



  // ── Strategist Agent chat ───────────────────────────────────────────────
  const [tokenReady, setTokenReady] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTokenReady(session?.access_token ?? null);
    });
    const sub = supabase.auth.onAuthStateChange((_e, s) =>
      setTokenReady(s?.access_token ?? null),
    );
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  // The Strategist is always autonomous. Ensure a settings row exists with autonomy on.
  useEffect(() => {
    if (!user || !brand?.id) return;
    supabase
      .from("agent_settings")
      .upsert(
        { user_id: user.id, brand_id: brand.id, autonomy_enabled: true },
        { onConflict: "user_id,brand_id" },
      )
      .then(() => {});
  }, [user, brand?.id]);


  const [agentThreadId, setAgentThreadId] = useState<string | null>(null);
  const agentThreadIdRef = useRef<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const ensureAgentThread = async (): Promise<string | null> => {
    if (agentThreadIdRef.current) return agentThreadIdRef.current;
    if (!user || !brand?.id) return null;
    const { data } = await supabase
      .from("agent_conversations")
      .insert({ user_id: user.id, brand_id: brand.id, title: "Blueprint chat" })
      .select("id")
      .single();
    if (data?.id) {
      agentThreadIdRef.current = data.id;
      setAgentThreadId(data.id);
    }
    return data?.id ?? null;
  };

  const agentApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strategist-agent`;
  const {
    messages: agentMessages,
    append: agentAppend,
    isLoading: agentStreaming,
    setMessages: setAgentMessages,
  } = useChat({
    id: "blueprint-agent",
    api: agentApiUrl,
    headers: tokenReady
      ? {
          Authorization: `Bearer ${tokenReady}`,
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        }
      : undefined,
    experimental_prepareRequestBody: ({ messages }) => ({
      messages,
      brand_id: brand?.id,
      conversation_id: agentThreadIdRef.current,
    }),

    onFinish: async (message) => {
      const tid = agentThreadIdRef.current;
      if (tid && user) {
        await supabase.from("agent_messages").insert({
          conversation_id: tid,
          user_id: user.id,
          role: "assistant",
          parts: (message as any).parts ?? [{ type: "text", text: message.content }],
        });
        await supabase
          .from("agent_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", tid);
      }
      invalidate();
    },

    onError: (err) =>
      toast({
        title: "Strategist hit an error",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      }),
  });

  // Conversational edit bar
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [agentMessages, agentStreaming]);

  const sendToAgent = async (text: string) => {
    let threadId = agentThreadIdRef.current;
    if (!threadId) threadId = await ensureAgentThread();
    if (!threadId) throw new Error("Couldn't start a strategist conversation.");

    if (user) {
      await supabase.from("agent_messages").insert({
        conversation_id: threadId,
        user_id: user.id,
        role: "user",
        parts: [{ type: "text", text }],
      });
    }
    setChatOpen(true);
    await agentAppend({ role: "user", content: text });
  };


  const handleConversationalEdit = async () => {
    const text = editText.trim();
    if (!text || !brand?.id) return;
    setEditing(true);
    try {
      // Strategist agent handles every user query end-to-end (always autonomous).
      setEditText("");
      await sendToAgent(text);
      return;

      // Fallback (autonomy off): legacy regex intent router.
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
              <div className="flex items-center gap-2 shrink-0">
                {!approvedAll && (
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={approveWeek}
                    disabled={approvingWeek}
                    className="rounded-full h-9 px-3 gap-1.5"
                  >

                    {approvingWeek ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Approve week
                  </Button>
                )}
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
              </div>
            )}
          </div>
          <p className="text-muted-foreground max-w-xl">
            {resetting
              ? "Brandie is drafting a fresh arc for this week. Hang tight — this takes a few seconds."
              : autoPlanning
              ? "Brandie is drafting your week — this takes a few seconds."
              : ideas.length === 0
              ? mode === "manual"
                ? 'Nothing planned this week yet. Tell Brandie below — try "plan this week" — and she\'ll draft the full arc.'
                : "Brandie will draft your week any moment now."
              : approvedAll
              ? 'All approved. Edit any day, or say "refresh the entire week" to start over.'
              : mode === "autonomous"
              ? "Review the arc. Brandie auto-approves on autonomous mode — tap any day to tweak it."
              : "Review the arc and tap Approve week, or talk to your Brand Strategist at the bottom to tweak any day."}
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
                          ? "bg-foreground text-background border-foreground shadow-glow"
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
                              className={`rounded-2xl border bg-card p-4 sm:p-5 space-y-3 transition-shadow ${
                                isToday
                                  ? "border-brandie-violet/30 shadow-glow-soft"
                                  : "border-border"
                              }`}
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
          <div className="max-w-2xl mx-auto pointer-events-auto space-y-2">
            {/* Strategist agent chat panel */}
            {chatOpen && (agentMessages.length > 0 || agentStreaming) && (() => {
              const TOOL_LABELS: Record<string, string> = {
                get_brand_snapshot: "Reading your brand",
                get_blueprint: "Checking your blueprint",
                get_recent_designs: "Reviewing recent designs",
                query_holidays: "Scanning upcoming holidays",
                query_trends: "Pulling trend intel",
                create_campaign: "Creating a campaign",
                create_content_pillar: "Adding a content pillar",
                draft_content_idea: "Drafting a content idea",
                schedule_idea: "Scheduling an idea",
                update_idea_caption: "Rewriting a caption",
                enqueue_design_generation: "Queueing a design",
              };
              const humanTool = (t: string) =>
                TOOL_LABELS[t] ?? t.replace(/^tool-/, "").replace(/_/g, " ");

              // Derive live status from the last assistant message.
              const lastAssistant = [...agentMessages].reverse().find((m: any) => m.role === "assistant");
              const lastParts: any[] = (lastAssistant as any)?.parts ?? [];
              const activeTool = lastParts
                .filter((p: any) => p.type?.startsWith("tool-"))
                .find((p: any) => p.state !== "output-available" && p.state !== "output-error");
              const lastText = lastParts
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("");
              let statusLabel: string | null = null;
              if (agentStreaming) {
                if (activeTool) statusLabel = `${humanTool((activeTool.type || "").replace(/^tool-/, ""))}…`;
                else if (!lastText.trim()) statusLabel = "Thinking…";
                else statusLabel = "Writing…";
              }

              return (
              <div className="rounded-3xl border border-border bg-background/95 backdrop-blur shadow-lg shadow-foreground/5 overflow-hidden">
                {/* Streaming progress bar */}
                {agentStreaming && (
                  <div className="h-0.5 w-full bg-muted overflow-hidden" aria-hidden>
                    <div
                      className="h-full w-1/3 bg-foreground/70"
                      style={{ animation: "blueprint-progress 1.4s ease-in-out infinite" }}
                    />
                    <style>{`@keyframes blueprint-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
                  <div className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> Strategist
                    {agentStreaming && (
                      <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-[11px] text-foreground/80">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent" style={{ animation: "blueprint-shimmer 2s linear infinite" }}>
                          {statusLabel}
                        </span>
                        <style>{`@keyframes blueprint-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setChatOpen(false);
                      setAgentMessages([]);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close chat"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div ref={chatScrollRef} className="max-h-[40vh] overflow-y-auto px-4 py-3 space-y-3">
                  {agentMessages.map((m: any) => {
                    const parts = m.parts ?? [{ type: "text", text: m.content }];
                    const text = parts
                      .filter((p: any) => p.type === "text")
                      .map((p: any) => p.text)
                      .join("");
                    const toolParts = parts.filter((p: any) => p.type?.startsWith("tool-"));
                    return (
                      <div key={m.id} className="text-sm">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          {m.role === "user" ? "You" : "Brandie"}
                        </div>
                        {text && (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                            <ReactMarkdown>{text}</ReactMarkdown>
                          </div>
                        )}
                        {toolParts.map((tp: any, i: number) => {
                          const name = (tp.type || "tool").replace(/^tool-/, "");
                          const done = tp.state === "output-available";
                          const errored = tp.state === "output-error";
                          return (
                            <div
                              key={i}
                              className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"
                            >
                              {done ? (
                                <Check className="h-3 w-3 text-foreground" />
                              ) : errored ? (
                                <X className="h-3 w-3 text-destructive" />
                              ) : (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              <span>{humanTool(name)}{done ? "" : errored ? " · failed" : "…"}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {agentStreaming && !lastAssistant && (
                    <div className="text-sm">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Brandie
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{statusLabel ?? "Thinking…"}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
              );
            })()}
            <div
              className="rounded-3xl border border-border bg-background/95 backdrop-blur shadow-lg shadow-foreground/5 p-3 sm:p-3.5"
              style={{ marginBottom: "max(env(safe-area-inset-bottom), 64px)" }}
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] tracking-wider uppercase text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    talk to your Brand Strategist
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
                  disabled={!editText.trim() || editing || agentStreaming}
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
