import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import AudiencePromptDialog from "./AudiencePromptDialog";
import { trackEvent } from "@/lib/analytics";

// Routes where the prompt is allowed to appear.
const ELIGIBLE_ROUTES = ["/", "/dashboard", "/cockpit", "/content", "/studio", "/history"];

// Routes where the user is already engaging with audiences, suppress.
const AUDIENCE_ROUTES = ["/brand"];

// Pacing constants
const REQUIRED_SESSION_MS = 45 * 1000;       // 45 s of active time before first show
const NEW_BRAND_GRACE_MS = 24 * 60 * 60 * 1000; // 24h after brand creation
const SUPPRESS_LATER_MS = 3 * 24 * 60 * 60 * 1000;     // 3 days
const SUPPRESS_DISMISS_MS = 5 * 24 * 60 * 60 * 1000;   // 5 days
const SUPPRESS_VISITED_AUDIENCE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const LIFETIME_CAP = 3;

type PromptState = {
  shownCount: number;
  lastShownAt: number;
  lastAction: "dismissed" | "later" | "never" | "accepted" | null;
  suppressUntil: number;
};

function storageKey(userId: string, brandId: string) {
  return `brandie:audience-prompt:v1:${userId}:${brandId}`;
}

function readState(userId: string, brandId: string): PromptState {
  try {
    const raw = localStorage.getItem(storageKey(userId, brandId));
    if (!raw) return { shownCount: 0, lastShownAt: 0, lastAction: null, suppressUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      shownCount: Number(parsed.shownCount) || 0,
      lastShownAt: Number(parsed.lastShownAt) || 0,
      lastAction: parsed.lastAction ?? null,
      suppressUntil: Number(parsed.suppressUntil) || 0,
    };
  } catch {
    return { shownCount: 0, lastShownAt: 0, lastAction: null, suppressUntil: 0 };
  }
}

function writeState(userId: string, brandId: string, state: PromptState) {
  try {
    localStorage.setItem(storageKey(userId, brandId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function isEligibleRoute(pathname: string) {
  return ELIGIBLE_ROUTES.some((r) => (r === "/" ? pathname === "/" : pathname.startsWith(r)));
}

function isAudienceRoute(pathname: string) {
  return AUDIENCE_ROUTES.some((r) => pathname.startsWith(r));
}

const AudiencePromptManager = () => {
  const { user } = useAuth();
  const { brand } = useBrand(user);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const shownThisSessionRef = useRef(false);
  const sessionMsRef = useRef(0);

  const userId = user?.id;
  const brandId = brand?.id;
  const onboardingComplete = !!brand?.onboarding_complete;
  const brandCreatedAt = brand?.created_at ? new Date(brand.created_at).getTime() : 0;

  // Query audience count
  const { data: audienceCount } = useQuery({
    queryKey: ["audience-prompt-count", brandId],
    queryFn: async () => {
      if (!brandId) return null;
      const { count, error } = await supabase
        .from("target_audiences" as any)
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId);
      if (error) return null;
      return count ?? 0;
    },
    enabled: !!brandId && onboardingComplete,
    staleTime: 5 * 60 * 1000,
  });

  // If user lands on /brand?section=audience, suppress for 2 days (they're handling it).
  useEffect(() => {
    if (!userId || !brandId) return;
    if (isAudienceRoute(location.pathname)) {
      const state = readState(userId, brandId);
      const newSuppress = Math.max(state.suppressUntil, Date.now() + SUPPRESS_VISITED_AUDIENCE_MS);
      if (newSuppress !== state.suppressUntil) {
        writeState(userId, brandId, { ...state, suppressUntil: newSuppress });
      }
    }
  }, [location.pathname, userId, brandId]);

  // If audiences exist, clear localStorage for this brand.
  useEffect(() => {
    if (!userId || !brandId) return;
    if (typeof audienceCount === "number" && audienceCount > 0) {
      try {
        localStorage.removeItem(storageKey(userId, brandId));
      } catch {
        /* ignore */
      }
    }
  }, [audienceCount, userId, brandId]);

  // Session timer (only ticks on eligible routes + visible tab).
  useEffect(() => {
    if (!userId || !brandId) return;
    if (!onboardingComplete) return;
    if (typeof audienceCount !== "number" || audienceCount > 0) return;
    if (shownThisSessionRef.current) return;

    const state = readState(userId, brandId);
    if (state.lastAction === "never") return;
    if (state.shownCount >= LIFETIME_CAP) return;
    if (Date.now() < state.suppressUntil) return;
    if (brandCreatedAt && Date.now(), brandCreatedAt < NEW_BRAND_GRACE_MS) return;

    let interval: number | null = null;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (!isEligibleRoute(location.pathname)) return;
      if (isAudienceRoute(location.pathname)) return;

      sessionMsRef.current += 1000;
      if (sessionMsRef.current >= REQUIRED_SESSION_MS && !shownThisSessionRef.current) {
        shownThisSessionRef.current = true;
        setOpen(true);
        const next: PromptState = {
          ...state,
          shownCount: state.shownCount + 1,
          lastShownAt: Date.now(),
        };
        writeState(userId, brandId, next);
        trackEvent(
          "audience_prompt_impression",
          {
            shown_count: next.shownCount,
            route: location.pathname,
            brand_age_ms: brandCreatedAt ? Date.now() - brandCreatedAt : null,
          },
          { userId, brandId }
        );
      }
    };

    interval = window.setInterval(tick, 1000);
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [userId, brandId, onboardingComplete, audienceCount, brandCreatedAt, location.pathname]);

  const updateAction = (action: PromptState["lastAction"], suppressMs: number) => {
    if (!userId || !brandId) return;
    const state = readState(userId, brandId);
    writeState(userId, brandId, {
      ...state,
      lastAction: action,
      suppressUntil: Date.now() + suppressMs,
    });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Treat raw close as a dismissal unless we already recorded another action.
      const state = userId && brandId ? readState(userId, brandId) : null;
      if (state && state.lastAction !== "later" && state.lastAction !== "never" && state.lastAction !== "accepted") {
        updateAction("dismissed", SUPPRESS_DISMISS_MS);
        trackEvent("audience_prompt_dismissed", { method: "close" }, { userId, brandId });
      }
    }
  };

  const handleLater = () => {
    updateAction("later", SUPPRESS_LATER_MS);
    trackEvent("audience_prompt_later", {}, { userId, brandId });
    setOpen(false);
  };

  const handleNever = () => {
    updateAction("never", 365 * 24 * 60 * 60 * 1000);
    trackEvent("audience_prompt_never", {}, { userId, brandId });
    setOpen(false);
  };

  const handleAccept = () => {
    updateAction("accepted", SUPPRESS_LATER_MS);
    trackEvent("audience_prompt_accepted", {}, { userId, brandId });
    setOpen(false);
  };

  if (!brand) return null;

  return (
    <AudiencePromptDialog
      open={open}
      onOpenChange={handleOpenChange}
      brand={brand as any}
      onLater={handleLater}
      onNever={handleNever}
      onAccept={handleAccept}
    />
  );
};

export default AudiencePromptManager;
