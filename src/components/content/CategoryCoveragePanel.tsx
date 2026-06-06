import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CONTENT_CATEGORIES, parseCategoryIds, type ContentCategoryId } from "@/lib/contentCategories";
import { Plus, Sparkles } from "lucide-react";

interface Item {
  content_category?: string | null;
}

interface CategoryCoveragePanelProps {
  weeklyIdeas: Item[];
  pillars: Item[];
  series: Item[];
  campaigns: Item[];
  onAddIdeaForCategory?: (id: ContentCategoryId) => void;
  className?: string;
}

type Scope = "week" | "all";

/**
 * Compact "are my 10 categories balanced?" indicator that sits inside the calendar collapsible.
 * Two scopes: This Week's ideas (default) or Pillars + Series + Campaigns combined.
 */
export default function CategoryCoveragePanel({
  weeklyIdeas,
  pillars,
  series,
  campaigns,
  onAddIdeaForCategory,
  className,
}: CategoryCoveragePanelProps) {
  const [scope, setScope] = useState<Scope>("week");

  const counts = useMemo(() => {
    const map = new Map<ContentCategoryId, number>();
    const source: Item[] =
      scope === "week"
        ? weeklyIdeas
        : [...(pillars || []), ...(series || []), ...(campaigns || [])];
    for (const item of source || []) {
      const ids = parseCategoryIds(item?.content_category);
      // For pillars (which can carry multiple) count each; ideas typically have one.
      for (const id of ids) {
        map.set(id, (map.get(id) || 0) + 1);
      }
    }
    return map;
  }, [scope, weeklyIdeas, pillars, series, campaigns]);

  const covered = CONTENT_CATEGORIES.filter((c) => (counts.get(c.id) || 0) > 0).length;
  const total = CONTENT_CATEGORIES.length;
  const coverageRatio = covered / total;
  const healthLabel =
    coverageRatio >= 0.7 ? "Balanced" : coverageRatio >= 0.4 ? "Could be more varied" : "Heavily skewed";
  const healthColor =
    coverageRatio >= 0.7
      ? "text-emerald-600 dark:text-emerald-400"
      : coverageRatio >= 0.4
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 space-y-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold truncate">Category coverage</span>
          <span className={cn("text-[10px] font-medium shrink-0", healthColor)}>
            {covered}/{total} · {healthLabel}
          </span>
        </div>
        <div className="flex items-center rounded-full bg-muted/60 p-0.5 text-[10px] font-medium shrink-0">
          <button
            onClick={() => setScope("week")}
            className={cn(
              "rounded-full px-2 py-0.5 transition-colors",
              scope === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Week
          </button>
          <button
            onClick={() => setScope("all")}
            className={cn(
              "rounded-full px-2 py-0.5 transition-colors",
              scope === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Plan
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CONTENT_CATEGORIES.map((c) => {
          const count = counts.get(c.id) || 0;
          const empty = count === 0;
          const clickable = empty && scope === "week" && !!onAddIdeaForCategory;
          return (
            <button
              key={c.id}
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onAddIdeaForCategory?.(c.id) : undefined}
              title={
                empty
                  ? clickable
                    ? `Add an idea for ${c.label}`
                    : `${c.label}, not covered`
                  : `${c.label}, ${count}`
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                empty
                  ? "border-dashed border-border/70 bg-transparent text-muted-foreground/60"
                  : cn(c.badgeClass, "border-transparent"),
                clickable && "hover:border-primary/50 hover:text-foreground cursor-pointer",
              )}
            >
              <span className="leading-none">{c.emoji}</span>
              <span className="leading-none">{c.short}</span>
              {empty ? (
                clickable ? <Plus className="h-2.5 w-2.5" /> : null
              ) : (
                <span className="leading-none font-semibold">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
