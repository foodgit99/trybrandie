import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import SEO from "@/components/SEO";
import { getCategoryMeta, parseCategoryIds } from "@/lib/contentCategories";

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
          "id, title, prompt, content_category, scheduled_for, status, approval_status, design_id",
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
    if (!text || !ideas.length) return;
    setEditing(true);
    try {
      // Try to detect a day keyword
      const dayIdx = WEEKDAY_NAMES.findIndex((d) => text.toLowerCase().includes(d.toLowerCase()));
      let target: Idea | undefined;
      if (dayIdx >= 0) {
        target = ideas.find((it) => {
          if (!it.scheduled_for) return false;
          const wd = new Date(it.scheduled_for).getDay();
          const idx = wd === 0 ? 6 : wd - 1;
          return idx === dayIdx;
        });
      }

      if (!target) {
        toast({
          title: "Tell me which day to change",
          description: "e.g. \"Swap Thursday's post for a restock announcement.\"",
        });
        return;
      }

      // Lightweight Copywriter-style update: rewrite the prompt with the user's instruction.
      // The Creative Director / agent cascade lands in Phase D; this keeps the loop tight.
      const cleanedDirection = text.replace(/^(swap|change|replace|make|update|set)/i, "").trim();
      const newTitle = cleanedDirection
        .replace(/^[^a-z0-9]+/i, "")
        .split(/[.!?\n]/)[0]
        .trim()
        .slice(0, 80);

      const { error } = await supabase
        .from("content_ideas")
        .update({
          title: newTitle || target.title,
          prompt: cleanedDirection || target.prompt,
          approval_status: "pending",
          status: "draft",
          design_id: null,
        })
        .eq("id", target.id);
      if (error) throw error;
      toast({
        title: `${WEEKDAY_NAMES[dayIdx]} updated`,
        description: "Brandie rewrote that day. Approve when you're happy.",
      });
      setEditText("");
      invalidate();
    } catch (err: any) {
      toast({ title: "Couldn't edit", description: err.message, variant: "destructive" });
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
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/v2/blueprint" replace />;
  if (!brand || !brand.onboarding_complete) return <Navigate to="/v2/onboarding" replace />;

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
    <div className="min-h-screen bg-background lg:pl-20 pb-40">
      <SEO title="Weekly Blueprint — Brandie" description="Your week, as a story." path="/v2/blueprint" noindex />

      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 space-y-10">
        <header className="space-y-3">
          <Link
            to="/v2/cockpit"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Cockpit
          </Link>
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
            This week, as a story.
          </h1>
          <p className="text-muted-foreground max-w-xl">
            {ideas.length === 0
              ? "Nothing planned this week yet. Head to the Cockpit to generate."
              : approvedAll
              ? "All approved. Edit any day by speaking to Brandie below."
              : "Review the arc. Tap to approve, or talk to Brandie at the bottom to tweak."}
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
                        Nothing scheduled — Brandie kept this day light.
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
                              <p className="font-medium leading-snug">{it.title}</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {it.prompt}
                              </p>
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
                    placeholder='e.g. "Swap Thursday for a restock announcement."'
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
