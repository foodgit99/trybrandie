import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("spinner-ring shrink-0", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-9 w-9",
    },
  },
  defaultVariants: { size: "md" },
});

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

/** Brand spectrum loading ring — consistent across light and dark themes. */
export const Spinner = ({ className, size, label = "Loading", ...props }: SpinnerProps) => (
  <div role="status" aria-label={label} className={cn("inline-flex", className)} {...props}>
    <span className={spinnerVariants({ size })} />
    <span className="sr-only">{label}</span>
  </div>
);

/** Centered spinner + optional caption for full-panel loading states. */
export const LoadingState = ({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className)}>
    <Spinner size="lg" label={label} />
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export default Spinner;
