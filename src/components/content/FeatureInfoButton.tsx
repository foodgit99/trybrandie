import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeatureInfoButtonProps {
  title: string;
  summary: string;
  learnMore: string;
  className?: string;
  iconClassName?: string;
  /** Stop click propagation (useful when nested inside another button) */
  stopPropagation?: boolean;
}

/**
 * Small "i" icon button that opens a dialog explaining a feature.
 * Includes a collapsible "Learn more" section with deeper business/marketing context.
 */
export function FeatureInfoButton({
  title,
  summary,
  learnMore,
  className,
  iconClassName,
  stopPropagation = true,
}: FeatureInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setExpanded(false);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          onClick={(e) => {
            if (stopPropagation) {
              e.stopPropagation();
              e.preventDefault();
            }
            setOpen(true);
          }}
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0",
            className,
          )}
        >
          <Info className={cn("h-3.5 w-3.5", iconClassName)} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>{summary}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-2 text-xs gap-1 text-primary hover:text-primary"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Learn more <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
          {expanded && (
            <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-xs leading-relaxed whitespace-pre-line animate-accordion-down">
              {learnMore}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeatureInfoButton;
