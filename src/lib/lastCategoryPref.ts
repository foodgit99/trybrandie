// Per-user, per-dialog last-selected content category memory.
// Synced to the user's profile (cross-device) and mirrored in localStorage
// for instant rehydration before the network round-trip completes.

import { supabase } from "@/integrations/supabase/client";

export type CategoryDialogKind = "series" | "campaign" | "idea";

const COL: Record<CategoryDialogKind, "last_category_series" | "last_category_campaign" | "last_category_idea"> = {
  series: "last_category_series",
  campaign: "last_category_campaign",
  idea: "last_category_idea",
};

const lsKey = (userId: string, kind: CategoryDialogKind) =>
  `brandie:lastCategory:${userId}:${kind}`;

/** Read instantly from localStorage cache (sync). */
export const getLastCategory = (
  userId: string | undefined,
  kind: CategoryDialogKind
): string => {
  if (!userId || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(lsKey(userId, kind)) || "";
  } catch {
    return "";
  }
};

/** Persist to localStorage + profile (fire-and-forget). */
export const setLastCategory = (
  userId: string | undefined,
  kind: CategoryDialogKind,
  category: string | null | undefined
) => {
  if (!userId) return;
  const value = (category || "").trim();
  if (!value) return;

  // 1) Write through to localStorage immediately
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(lsKey(userId, kind), value);
    } catch {
      // ignore
    }
  }

  // 2) Sync to profile (cross-device)
  void supabase
    .from("profiles")
    .update({ [COL[kind]]: value })
    .eq("user_id", userId)
    .then(({ error }) => {
      if (error) console.warn("[lastCategoryPref] profile sync failed", error.message);
    });
};

/** Pull saved values from the profile and prime localStorage. Call once on app/page load. */
export const hydrateLastCategoriesFromProfile = async (userId: string | undefined) => {
  if (!userId || typeof window === "undefined") return;
  const { data, error } = await supabase
    .from("profiles")
    .select("last_category_series, last_category_campaign, last_category_idea")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return;
  const map: Record<CategoryDialogKind, string | null | undefined> = {
    series: (data as any).last_category_series,
    campaign: (data as any).last_category_campaign,
    idea: (data as any).last_category_idea,
  };
  (Object.keys(map) as CategoryDialogKind[]).forEach((kind) => {
    const v = (map[kind] || "").trim();
    try {
      if (v) window.localStorage.setItem(lsKey(userId, kind), v);
    } catch {
      // ignore
    }
  });
};
