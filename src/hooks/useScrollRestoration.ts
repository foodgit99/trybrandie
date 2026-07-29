import { useEffect, useRef } from "react";

/**
 * Persists window scroll position per key (sessionStorage) and restores it
 * once the page content is ready, so returning to a page keeps the same view.
 */
export function useScrollRestoration(key: string, ready: boolean = true) {
  const storageKey = `scrollpos:${key}`;
  const restored = useRef(false);

  // Save on scroll (throttled via rAF) and on unmount.
  useEffect(() => {
    let frame: number | null = null;
    const save = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        try {
          sessionStorage.setItem(storageKey, String(window.scrollY));
        } catch {
          /* ignore */
        }
      });
    };

    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      if (frame !== null) cancelAnimationFrame(frame);
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };
  }, [storageKey]);

  // Restore once content has rendered tall enough.
  useEffect(() => {
    if (!ready || restored.current) return;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(storageKey);
    } catch {
      raw = null;
    }
    const target = Number(raw);
    if (!raw || Number.isNaN(target) || target <= 0) {
      restored.current = true;
      return;
    }

    let attempts = 0;
    let frame: number | null = null;

    const tryScroll = () => {
      attempts += 1;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= target || attempts > 40) {
        window.scrollTo({ top: Math.min(target, Math.max(maxScroll, 0)), behavior: "auto" });
        restored.current = true;
        return;
      }
      frame = requestAnimationFrame(tryScroll);
    };

    frame = requestAnimationFrame(tryScroll);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [ready, storageKey]);
}

/** Collapsible section state persisted in localStorage. */
export function readGroupOpen(storageKey: string) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey) !== "closed";
  } catch {
    return true;
  }
}

export function writeGroupOpen(storageKey: string, open: boolean) {
  try {
    window.localStorage.setItem(storageKey, open ? "open" : "closed");
  } catch {
    /* ignore */
  }
}
