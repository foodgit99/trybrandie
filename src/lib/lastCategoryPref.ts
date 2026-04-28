// Per-user, per-brand, per-dialog last-selected content category memory.
// Synced to `user_brand_dialog_prefs` (cross-device) with localStorage cache for instant rehydration.

import { supabase } from "@/integrations/supabase/client";

export type CategoryDialogKind = "series" | "campaign" | "idea";

const COL: Record<CategoryDialogKind, "last_category_series" | "last_category_campaign" | "last_category_idea"> = {
  series: "last_category_series",
  campaign: "last_category_campaign",
  idea: "last_category_idea",
};

const lsKey = (userId: string, brandId: string, kind: CategoryDialogKind) =>
  `brandie:lastCategory:${userId}:${brandId}:${kind}`;

/**
 * Sync read from localStorage cache (per user + brand).
 * If `availableCategories` is provided, validates the saved value against it
 * (case-insensitive) and returns "" if the category was renamed/removed —
 * also clearing the stale cache entry so it won't be used again.
 */
export const getLastCategory = (
  userId: string | undefined,
  brandId: string | undefined,
  kind: CategoryDialogKind,
  availableCategories?: ReadonlyArray<string>
): string => {
  if (!userId || !brandId || typeof window === "undefined") return "";
  let saved = "";
  try {
    saved = window.localStorage.getItem(lsKey(userId, brandId, kind)) || "";
  } catch {
    return "";
  }
  if (!saved) return "";
  if (!availableCategories || availableCategories.length === 0) return saved;

  const norm = (s: string) => s.trim().toLowerCase();
  const match = availableCategories.find((c) => norm(c) === norm(saved));
  if (match) return match; // canonical casing from current options

  // Stale value — clear cache so it's not reused.
  try {
    window.localStorage.removeItem(lsKey(userId, brandId, kind));
  } catch {
    // ignore
  }
  return "";
};

/** Persist to localStorage + `user_brand_dialog_prefs` (fire-and-forget upsert). */
export const setLastCategory = (
  userId: string | undefined,
  brandId: string | undefined,
  kind: CategoryDialogKind,
  category: string | null | undefined
) => {
  if (!userId || !brandId) return;
  const value = (category || "").trim();
  if (!value) return;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(lsKey(userId, brandId, kind), value);
    } catch {
      // ignore
    }
  }

  void supabase
    .from("user_brand_dialog_prefs")
    .upsert(
      { user_id: userId, brand_id: brandId, [COL[kind]]: value },
      { onConflict: "user_id,brand_id" }
    )
    .then(({ error }) => {
      if (error) console.warn("[lastCategoryPref] brand pref sync failed", error.message);
    });
};

/** Clear the saved last category for a user/brand/dialog (localStorage + DB). */
export const clearLastCategory = (
  userId: string | undefined,
  brandId: string | undefined,
  kind: CategoryDialogKind
) => {
  if (!userId || !brandId) return;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(lsKey(userId, brandId, kind));
    } catch {
      // ignore
    }
  }
  void supabase
    .from("user_brand_dialog_prefs")
    .upsert(
      { user_id: userId, brand_id: brandId, [COL[kind]]: null },
      { onConflict: "user_id,brand_id" }
    )
    .then(({ error }) => {
      if (error) console.warn("[lastCategoryPref] brand pref clear failed", error.message);
    });
};

/** Pull saved values for the current brand and prime localStorage. */
export const hydrateLastCategoriesForBrand = async (
  userId: string | undefined,
  brandId: string | undefined
) => {
  if (!userId || !brandId || typeof window === "undefined") return;
  const { data, error } = await supabase
    .from("user_brand_dialog_prefs")
    .select("last_category_series, last_category_campaign, last_category_idea")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
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
      if (v) window.localStorage.setItem(lsKey(userId, brandId, kind), v);
    } catch {
      // ignore
    }
  });
};
