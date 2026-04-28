// Per-user, per-dialog last-selected content category memory.
// Stored in localStorage so it persists across sessions on the same device.

export type CategoryDialogKind = "series" | "campaign" | "idea";

const key = (userId: string, kind: CategoryDialogKind) =>
  `brandie:lastCategory:${userId}:${kind}`;

export const getLastCategory = (
  userId: string | undefined,
  kind: CategoryDialogKind
): string => {
  if (!userId || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key(userId, kind)) || "";
  } catch {
    return "";
  }
};

export const setLastCategory = (
  userId: string | undefined,
  kind: CategoryDialogKind,
  category: string | null | undefined
) => {
  if (!userId || typeof window === "undefined") return;
  try {
    if (category && category.trim()) {
      window.localStorage.setItem(key(userId, kind), category.trim());
    }
  } catch {
    // ignore
  }
};
