import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TourStep } from "@/components/v2/GuidedTour";

type TourState = "pending" | "active" | "done" | "dismissed";

const key = (brandId?: string | null) => `brandie-tour:${brandId || "none"}`;

function read(brandId?: string | null): TourState {
  if (typeof window === "undefined" || !brandId) return "pending";
  try {
    const raw = window.localStorage.getItem(key(brandId));
    if (raw === "done" || raw === "dismissed" || raw === "active") return raw;
    return "pending";
  } catch {
    return "pending";
  }
}

function write(brandId: string | undefined | null, value: TourState) {
  if (!brandId) return;
  try {
    window.localStorage.setItem(key(brandId), value);
  } catch {
    /* ignore */
  }
}

export type TourSignals = {
  hasDescription: boolean;
  hasPalette: boolean;
  hasTypography: boolean;
  hasAudience: boolean;
  hasProducts: boolean;
  hasGallery: boolean;
};

/**
 * First-run walkthrough state for the Brand Centre. Builds the step list from
 * whatever is still empty, remembers progress per brand, and never auto-runs
 * again once completed or dismissed.
 */
export function useFirstRunTour(
  brandId: string | undefined,
  signals: TourSignals,
  hrefs: Record<string, string>,
  ready: boolean,
) {
  const [state, setState] = useState<TourState>("pending");
  const [index, setIndex] = useState(0);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;
    setState(read(brandId));
    setIndex(0);
  }, [brandId]);

  const steps = useMemo<TourStep[]>(() => {
    const all: (TourStep & { done: boolean })[] = [
      {
        id: "basics",
        targetId: "tour-basics",
        group: "Identity",
        title: "Tell Brandie what you do",
        body: "A one-paragraph description and your tone of voice. Every caption is written from these two lines.",
        actionLabel: "Describe your brand",
        actionHref: hrefs.editor,
        done: signals.hasDescription,
      },
      {
        id: "palette",
        targetId: "tour-palette",
        group: "Identity",
        title: "Set your brand colours",
        body: "Add 2 to 4 hex codes. Without them Brandie picks its own palette and your posts stop looking consistent.",
        actionLabel: "Set your colours",
        actionHref: hrefs.editor,
        done: signals.hasPalette,
      },
      {
        id: "typography",
        targetId: "tour-typography",
        group: "Identity",
        title: "Choose your fonts",
        body: "A display font for headlines and a body font for supporting copy, so every design shares one type system.",
        actionLabel: "Choose fonts",
        actionHref: hrefs.editor,
        done: signals.hasTypography,
      },
      {
        id: "audience",
        targetId: "tour-audience",
        group: "Strategy",
        title: "Build your audience profile",
        body: "Who they are, what they struggle with, and what makes them buy. This is what turns generic posts into content that converts.",
        actionLabel: "Build the profile",
        actionHref: hrefs.audience,
        done: signals.hasAudience,
      },
      {
        id: "offer",
        targetId: "tour-offer",
        group: "Strategy",
        title: "Add what you sell",
        body: "Products or services with photos and prices. Promotional posts and carousels are built directly from this list.",
        actionLabel: "Add a product or service",
        actionHref: hrefs.editor,
        done: signals.hasProducts,
      },
      {
        id: "gallery",
        targetId: "tour-gallery",
        group: "Assets",
        title: "Upload real photos",
        body: "Products, team, premises, screenshots. Brandie uses your exact images before it generates anything, so designs match reality.",
        actionLabel: "Open the gallery",
        actionHref: hrefs.gallery,
        done: signals.hasGallery,
      },
    ];
    return all.filter((s) => !s.done).map(({ done, ...rest }) => rest);
  }, [signals, hrefs]);

  // Auto-offer the tour on a first run with work outstanding.
  const showWelcome = ready && state === "pending" && steps.length > 0;
  const active = ready && state === "active" && steps.length > 0;

  // If the user finished everything while paused mid-tour, close it out.
  useEffect(() => {
    if (state === "active" && ready && steps.length === 0) {
      setState("done");
      write(brandId, "done");
    }
  }, [state, ready, steps.length, brandId]);

  // Detect a step that got completed while the tour was paused.
  const prevIds = useRef<string[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    const ids = steps.map((s) => s.id);
    const before = prevIds.current;
    prevIds.current = ids;
    if (!before) return;
    const finished = before.find((id) => !ids.includes(id));
    if (finished) setJustCompleted(finished);
  }, [steps, ready]);

  // Keep the index inside bounds as steps complete.
  useEffect(() => {
    if (index > steps.length - 1) setIndex(Math.max(steps.length - 1, 0));
  }, [steps.length, index]);

  const start = useCallback(() => {
    setState("active");
    setIndex(0);
    write(brandId, "active");
  }, [brandId]);

  const dismiss = useCallback(() => {
    setState("dismissed");
    write(brandId, "dismissed");
  }, [brandId]);

  const close = useCallback(() => {
    setState("done");
    write(brandId, "done");
  }, [brandId]);

  const next = useCallback(() => {
    setJustCompleted(null);
    setIndex((i) => {
      if (i >= steps.length - 1) {
        setState("done");
        write(brandId, "done");
        return i;
      }
      return i + 1;
    });
  }, [steps.length, brandId]);

  /** Called when the user follows a step's action link, keeps the tour paused. */
  const pauseForAction = useCallback(() => {
    write(brandId, "active");
  }, [brandId]);

  const replay = useCallback(() => {
    setState("active");
    setIndex(0);
    setJustCompleted(null);
    write(brandId, "active");
  }, [brandId]);

  return {
    steps,
    index,
    active,
    showWelcome,
    justCompleted,
    setJustCompleted,
    start,
    dismiss,
    close,
    next,
    pauseForAction,
    replay,
    remaining: steps.length,
  };
}
