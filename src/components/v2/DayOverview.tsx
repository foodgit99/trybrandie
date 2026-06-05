import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { getCategoryMeta, parseCategoryIds } from "@/lib/contentCategories";
import IdeaThumb from "@/components/v2/IdeaThumb";

type Idea = {
  id: string;
  title: string;
  prompt: string;
  content_category: string | null;
  scheduled_for: string | null;
  day_of_week: number | null;
  status: string;
  approval_status: string;
  design_id?: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
};

interface DayOverviewProps {
  dayLabel: string;
  date: Date;
  isToday: boolean;
  ideas: Idea[];
  onClose: () => void;
  onApprove: (id: string) => Promise<void> | void;
  onApproveAll: () => Promise<void> | void;
  onSeed?: () => Promise<void> | void;
  approvingId: string | null;
  approvingAll: boolean;
  seeding?: boolean;
  weekIsEmpty: boolean;
}

const DayOverview = ({
  dayLabel,
  date,
  isToday,
  ideas,
  onClose,
  onApprove,
  onApproveAll,
  onSeed,
  approvingId,
  approvingAll,
  seeding,
  weekIsEmpty,
}: DayOverviewProps) => {
  const unapprovedCount = ideas.filter(
    (i) => !(i.approval_status === "approved" || i.status === "scheduled"),
  ).length;

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={date.toISOString()}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="rounded-3xl border border-border bg-card overflow-hidden"
      >
        <header className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4 border-b border-border">
          <div className="space-y-1">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
              {isToday ? "Today" : dayLabel}
            </p>
            <h3 className="font-serif text-2xl sm:text-3xl tracking-tight">
              {date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {ideas.length === 0
                ? "Nothing scheduled here."
                : `${ideas.length} ${ideas.length === 1 ? "post" : "posts"}${
                    unapprovedCount ? ` · ${unapprovedCount} pending` : " · all approved"
                  }`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close day overview"
            className="text-muted-foreground hover:text-foreground transition-colors -mt-1"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-6 sm:px-8 py-5 space-y-4">
          {ideas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Brandie kept this day light. {weekIsEmpty
                ? "Generate the week to fill it in."
                : "Tweak the plan from the Blueprint if you'd like to add something."}
            </div>
          ) : (
            <ul className="space-y-3">
              {ideas.map((it) => {
                const catId = parseCategoryIds(it.content_category)[0];
                const meta = catId ? getCategoryMeta(catId) : undefined;
                const isApproved =
                  it.approval_status === "approved" || it.status === "scheduled";
                const isApprovingThis = approvingId === it.id;
                return (
                  <li
                    key={it.id}
                    className="rounded-2xl border border-border bg-background p-4 sm:p-5 space-y-3"
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
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!isApproved && (
                        <Button
                          size="sm"
                          onClick={() => onApprove(it.id)}
                          disabled={isApprovingThis}
                          className="rounded-full h-8 px-3 gap-1.5"
                        >
                          {isApprovingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                      )}
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 px-3 gap-1.5"
                      >
                        <Link to={`/post/${it.id}`}>Open post</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-4 border-t border-border bg-secondary/30">
          <Link
            to="/blueprint"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Edit in Blueprint <ArrowRight className="h-3 w-3" />
          </Link>
          <div className="flex items-center gap-2">
            {ideas.length === 0 && weekIsEmpty && onSeed && (
              <Button
                size="sm"
                onClick={onSeed}
                disabled={seeding}
                className="rounded-full h-9 px-4 gap-1.5"
              >
                {seeding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate this week
              </Button>
            )}
            {unapprovedCount > 1 && (
              <Button
                size="sm"
                onClick={onApproveAll}
                disabled={approvingAll}
                className="rounded-full h-9 px-4 gap-1.5"
              >
                {approvingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Approve day
              </Button>
            )}
          </div>
        </footer>
      </motion.section>
    </AnimatePresence>
  );
};

export default DayOverview;
