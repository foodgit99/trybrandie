import { cn } from "@/lib/utils";
import {
  CONTENT_CATEGORIES,
  getCategoryMeta,
  parseCategoryIds,
  type ContentCategoryId,
} from "@/lib/contentCategories";

interface CategoryBadgeProps {
  id: ContentCategoryId | string;
  size?: "xs" | "sm";
  className?: string;
  showEmoji?: boolean;
}

/** Single category chip used on pillars, series, campaigns, and inside dialogs. */
export function CategoryBadge({ id, size = "xs", className, showEmoji = true }: CategoryBadgeProps) {
  const meta = getCategoryMeta(id);
  if (!meta) return null;
  const sizeCls =
    size === "xs"
      ? "text-[9px] px-1.5 py-0 h-4 gap-0.5"
      : "text-[10px] px-2 py-0.5 h-5 gap-1";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold shrink-0",
        sizeCls,
        meta.badgeClass,
        className,
      )}
      title={meta.label}
    >
      {showEmoji && <span className="leading-none">{meta.emoji}</span>}
      <span className="leading-none">{meta.short}</span>
    </span>
  );
}

interface CategoryBadgeListProps {
  raw?: string | null;
  max?: number;
  size?: "xs" | "sm";
  emptyLabel?: string;
  className?: string;
}

/** Render a list of category badges from a raw stored value (id, comma-list, or legacy label string). */
export function CategoryBadgeList({
  raw,
  max = 3,
  size = "xs",
  emptyLabel,
  className,
}: CategoryBadgeListProps) {
  const ids = parseCategoryIds(raw);
  if (ids.length === 0) {
    if (!emptyLabel) return null;
    return (
      <span className={cn("inline-flex items-center text-[10px] text-muted-foreground/70 italic", className)}>
        {emptyLabel}
      </span>
    );
  }
  const shown = ids.slice(0, max);
  const overflow = ids.length, shown.length;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((id) => (
        <CategoryBadge key={id} id={id} size={size} />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] font-medium text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}

/** Tiny color-coded dot used inline on the calendar rows (no text). */
export function CategoryDot({ raw, className }: { raw?: string | null; className?: string }) {
  const ids = parseCategoryIds(raw);
  if (ids.length === 0) return null;
  const meta = getCategoryMeta(ids[0]);
  if (!meta) return null;
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", meta.dotClass, className)}
      title={meta.label}
    />
  );
}

export { CONTENT_CATEGORIES };
