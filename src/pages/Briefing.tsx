import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, getWeek } from "date-fns";
import {
  CheckCircle2,
  Lock,
  Loader2,
  Sparkles,
  Replace,
  Pencil,
  Image as ImageIcon,
  AlertCircle,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ARC_TAGS = ["Teaser", "Educate", "Hard Sell", "Urgency", "Closing", "Story", "Recap"];

const Briefing = () => {
  const { user } = useAuth();
  const { brand } = useBrand(user);
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [pivotIdea, setPivotIdea] = useState<any | null>(null);
  const [pivotPrompt, setPivotPrompt] = useState("");
  const [pivotSaving, setPivotSaving] = useState(false);

  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const sunday = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekStartISO = useMemo(() => monday.toISOString().split("T")[0], [monday]);
  const weekNum = getWeek(today);

  // Blueprint
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

  // Ideas
  const { data: ideas = [], isLoading, refetch: refetchIdeas } = useQuery({
    queryKey: ["briefing-ideas", brand?.id, weekStartISO],
    queryFn: async () => {
      if (!brand?.id) return [];
      const { data } = await supabase
        .from("content_ideas")
        .select("*, designs:design_id(image_url, caption)")
        .eq("brand_id", brand.id)
        .gte("scheduled_for", weekStartISO)
        .lte("scheduled_for", sunday.toISOString().split("T")[0])
        .order("scheduled_for");
      return data || [];
    },
    enabled: !!brand?.id,
  });

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(monday, i);
      const dayIdeas = ideas.filter((idea: any) => {
        if (!idea.scheduled_for) return false;
        return isSameDay(new Date(idea.scheduled_for), date);
      });
      return { date, idea: dayIdeas[0] || null, arc: ARC_TAGS[i] };
    });
  }, [ideas, monday]);

  const isLocked = blueprint?.status === "locked" || blueprint?.status === "approved";
  const draftCount = ideas.filter(
    (i: any) => i.approval_status === "draft" || (!i.approval_status && i.status === "suggested")
  ).length;
  const approvedCount = ideas.length - draftCount;
  const daysCovered = days.filter((d) => d.idea).length;

  const handleApproveAll = async () => {
    if (!brand?.id) return;
    setApproving(true);
    try {
      // Ensure blueprint exists
      let bpId = blueprint?.id;
      if (!bpId && user) {
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
      } else if (bpId) {
        await supabase
          .from("weekly_blueprints")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", bpId);
      }

      // Flip all draft ideas to approved + scheduled, link to blueprint
      const ids = ideas.map((i: any) => i.id);
      if (ids.length) {
        await supabase
          .from("content_ideas")
          .update({
            approval_status: "approved",
            status: "scheduled",
            blueprint_id: bpId,
          } as any)
          .in("id", ids);
      }

      toast({
        title: "Week approved",
        description: `${ids.length} drops locked in. Brandie will deliver them on schedule.`,
      });
      qc.invalidateQueries({ queryKey: ["briefing-ideas"] });
      qc.invalidateQueries({ queryKey: ["blueprint"] });
      refetchBp();
      refetchIdeas();
    } catch (e: any) {
      toast({ title: "Couldn't approve", description: e.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const handleUnlock = async () => {
    if (!blueprint?.id) return;
    await supabase
      .from("weekly_blueprints")
      .update({ status: "draft", approved_at: null })
      .eq("id", blueprint.id);
    toast({ title: "Week unlocked", description: "You can now edit or swap drops." });
    refetchBp();
  };

  const handleQuickPivot = async () => {
    if (!pivotIdea || !pivotPrompt.trim()) return;
    setPivotSaving(true);
    try {
      await supabase
        .from("content_ideas")
        .update({
          prompt: pivotPrompt.trim(),
          design_id: null, // re-generation needed
          status: "suggested",
          autopilot_status: null,
        } as any)
        .eq("id", pivotIdea.id);
      toast({
        title: "Day updated",
        description: "Brandie will regenerate this drop on the next autopilot run.",
      });
      setPivotIdea(null);
      setPivotPrompt("");
      refetchIdeas();
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e.message, variant: "destructive" });
    } finally {
      setPivotSaving(false);
    }
  };

  const openPivot = (idea: any) => {
    setPivotIdea(idea);
    setPivotPrompt(idea?.prompt || "");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 lg:pl-24">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Briefing Room · Week {weekNum}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            {isLocked ? "Your week is locked in." : "Approve your week."}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {format(monday, "MMM d")} – {format(sunday, "MMM d")} ·{" "}
            {isLocked
              ? "Brandie is on the wheel. Just show up and share."
              : "Review each day, swap anything that doesn't fit, then approve once."}
          </p>
        </motion.section>

        {/* Status strip */}
        <section className="mb-8 grid grid-cols-3 gap-3">
          <StatCard label="Drops planned" value={ideas.length} />
          <StatCard label="Days covered" value={`${daysCovered}/7`} />
          <StatCard
            label="Status"
            value={
              isLocked ? (
                <span className="inline-flex items-center gap-1 text-base">
                  <Lock className="h-3.5 w-3.5" /> Locked
                </span>
              ) : (
                <span className="text-base">Awaiting</span>
              )
            }
          />
        </section>

        {/* Days */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : daysCovered === 0 ? (
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
            <Button onClick={() => navigate("/content")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate this week
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {days.map((d, i) => (
              <DayCard
                key={i}
                date={d.date}
                arc={d.arc}
                idea={d.idea}
                isToday={isSameDay(d.date, today)}
                locked={isLocked}
                onPivot={openPivot}
              />
            ))}
          </div>
        )}
      </main>

      {/* Sticky Approve Bar */}
      {ideas.length > 0 && (
        <div
          className="fixed inset-x-0 z-40 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl lg:left-24"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {isLocked
                  ? `Week locked · ${approvedCount} drops scheduled`
                  : `${draftCount} draft${draftCount === 1 ? "" : "s"} ready to review`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {isLocked
                  ? "Unlock to edit any drop."
                  : "One tap approves the entire week."}
              </p>
            </div>
            {isLocked ? (
              <Button variant="outline" size="sm" onClick={handleUnlock}>
                <Lock className="mr-2 h-4 w-4" />
                Unlock week
              </Button>
            ) : (
              <Button onClick={handleApproveAll} disabled={approving} size="lg">
                {approving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve All Drops
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Quick Pivot Sheet */}
      <Sheet open={!!pivotIdea} onOpenChange={(o) => !o && setPivotIdea(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">Quick pivot</SheetTitle>
            <SheetDescription>
              Rewrite the angle for this drop. Brandie will regenerate the design on the next
              autopilot run.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {pivotIdea && (
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

const StatCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Card className="border-border/60 bg-card p-4">
    <p className="font-serif text-3xl leading-none text-foreground">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </Card>
);

const DayCard = ({
  date,
  arc,
  idea,
  isToday,
  locked,
  onPivot,
}: {
  date: Date;
  arc: string;
  idea: any | null;
  isToday: boolean;
  locked: boolean;
  onPivot: (idea: any) => void;
}) => {
  const hasDesign = !!idea?.design_id;
  const caption = idea?.designs?.caption;
  const image = idea?.designs?.image_url;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        isToday ? "border-foreground/40" : "border-border/60"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex w-14 shrink-0 flex-col items-center pt-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {format(date, "EEE")}
          </span>
          <span className="font-serif text-2xl leading-none text-foreground">
            {format(date, "d")}
          </span>
        </div>

        <div className="aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {image ? (
            <img src={image} alt={idea.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {idea?.playbook_role || arc}
            </span>
            {idea?.content_format === "carousel" && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                Carousel
              </Badge>
            )}
            {isToday && <Badge className="h-4 px-1.5 text-[10px]">Today</Badge>}
            {!hasDesign && idea && (
              <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px]">
                <AlertCircle className="h-2.5 w-2.5" />
                Drafting
              </Badge>
            )}
          </div>
          {idea ? (
            <>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{idea.title}</p>
              {caption && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{caption}</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground">No drop yet for this day</p>
          )}
        </div>
      </div>

      {idea && !locked && (
        <div className="mt-3 flex justify-end gap-2 border-t border-border/40 pt-3">
          <Button variant="ghost" size="sm" onClick={() => onPivot(idea)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Quick pivot
          </Button>
        </div>
      )}
    </div>
  );
};

export default Briefing;
