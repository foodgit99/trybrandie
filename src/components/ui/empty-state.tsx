import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/** Shared empty state: dashed brand-washed surface + neon medallion. */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  className,
  children,
}: EmptyStateProps) => (
  <div
    className={cn(
      "empty-surface flex flex-col items-center justify-center gap-3 px-4 py-8",
      className,
    )}
  >
    {Icon && (
      <span className="empty-medallion h-11 w-11">
        <Icon className="h-5 w-5" />
      </span>
    )}
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
    </div>
    {ctaLabel && onCta && (
      <Button variant="outline" size="sm" className="rounded-xl mt-1" onClick={onCta}>
        {ctaLabel}
      </Button>
    )}
    {children}
  </div>
);

export default EmptyState;
