import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TourStep = {
  id: string;
  targetId: string;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  /** Optional group title to expand before highlighting. */
  group?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 10;

function measure(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top + window.scrollY - PAD,
    left: r.left + window.scrollX - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

export default function GuidedTour({
  steps,
  index,
  onNext,
  onSkipStep,
  onClose,
  onAction,
  justCompletedLabel,
}: {
  steps: TourStep[];
  index: number;
  onNext: () => void;
  onSkipStep: () => void;
  onClose: () => void;
  onAction: () => void;
  justCompletedLabel?: string | null;
}) {
  const step = steps[index];
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Expand the containing group, then measure.
  useEffect(() => {
    if (!step) return;
    if (step.group) {
      window.dispatchEvent(
        new CustomEvent("brandie-tour:open-group", { detail: { title: step.group } }),
      );
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    let frame: number | null = null;
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      const next = measure(step.targetId);
      if (next) {
        setRect(next);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const target = Math.max(next.top - 120, 0);
        window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
        return;
      }
      if (attempts < 40) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [step?.id, step?.targetId]);

  // Keep the cutout aligned on resize / scroll.
  useEffect(() => {
    if (!step) return;
    const update = () => setRect(measure(step.targetId));
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [step?.targetId]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [step?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext]);

  if (!step) return null;

  const viewportTop = rect ? rect.top - window.scrollY : 120;
  const spaceBelow = rect ? window.innerHeight - (viewportTop + rect.height) : 400;
  const placeBelow = spaceBelow > 280 || viewportTop < 260;

  const cardStyle: React.CSSProperties = rect
    ? {
        position: "absolute",
        top: placeBelow ? rect.top + rect.height + 12 : Math.max(rect.top - 12, 8),
        left: rect.left,
        width: Math.min(Math.max(rect.width, 280), 420),
        transform: placeBelow ? undefined : "translateY(-100%)",
      }
    : { position: "fixed", top: 100, left: 16, right: 16, maxWidth: 420 };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Brand setup walkthrough">
      {/* Dim layer with a cutout over the target */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-foreground/60" style={rect ? { clipPath: cutout(rect) } : undefined} />
      </div>
      <button
        type="button"
        aria-label="Close walkthrough"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="absolute inset-0 overflow-visible pointer-events-none">
        {rect && (
          <div
            className="absolute rounded-2xl ring-2 ring-primary transition-all duration-200"
            style={{
              top: rect.top - window.scrollY,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        )}
      </div>

      <div
        ref={cardRef}
        tabIndex={-1}
        className="pointer-events-auto outline-none"
        style={{
          ...cardStyle,
          top:
            typeof cardStyle.top === "number" && rect
              ? (cardStyle.top as number) - window.scrollY
              : cardStyle.top,
          position: "fixed",
        }}
      >
        <div className="rounded-2xl border border-border bg-card shadow-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
              Step {index + 1} of {steps.length}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Skip tour"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {justCompletedLabel && (
            <p className="text-xs text-primary">Nice, {justCompletedLabel} is done.</p>
          )}

          <div className="space-y-1.5">
            <p className="font-medium">{step.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button asChild size="sm" className="rounded-full gap-1.5" onClick={onAction}>
              <Link to={step.actionHref}>
                {step.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={onSkipStep}>
              {index === steps.length - 1 ? "Finish" : "Next"}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Builds an evenodd-style clip path with a rounded-ish rectangular hole. */
function cutout(rect: Rect) {
  const top = rect.top - window.scrollY;
  const left = rect.left;
  const right = rect.left + rect.width;
  const bottom = top + rect.height;
  return `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${top}px, ${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, 0 ${top}px)`;
}
