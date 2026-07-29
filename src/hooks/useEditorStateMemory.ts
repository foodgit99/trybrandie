import { useEffect, useRef } from "react";

/**
 * Remembers a small snapshot of the Brand Editor UI state (open panels,
 * selected profile, which field was being edited) per brand, so navigating
 * away and returning to /brand/editor restores where you left off.
 */
export type EditorStateSnapshot = {
  editing?: string | null;
  audienceOpen?: boolean;
  selectedAudienceId?: string | null;
  audienceEditing?: boolean;
  trendLabOpen?: boolean;
  researchLabOpen?: boolean;
  editingProductId?: string | null;
};

const keyFor = (brandId?: string | null) => `brand-editor-state:${brandId || "none"}`;

export function readEditorState(brandId?: string | null): EditorStateSnapshot | null {
  if (typeof window === "undefined" || !brandId) return null;
  try {
    const raw = window.sessionStorage.getItem(keyFor(brandId));
    return raw ? (JSON.parse(raw) as EditorStateSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearEditorState(brandId?: string | null) {
  try {
    window.sessionStorage.removeItem(keyFor(brandId));
  } catch {
    /* ignore */
  }
}

/**
 * Persists the snapshot whenever it changes, and calls `restore` once with
 * the previously saved snapshot when the brand becomes available.
 */
export function useEditorStateMemory(
  brandId: string | undefined | null,
  snapshot: EditorStateSnapshot,
  restore: (saved: EditorStateSnapshot) => void,
) {
  const restoredFor = useRef<string | null>(null);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  // Restore once per brand.
  useEffect(() => {
    if (!brandId || restoredFor.current === brandId) return;
    restoredFor.current = brandId;
    const saved = readEditorState(brandId);
    if (saved) restoreRef.current(saved);
  }, [brandId]);

  // Save on every change (only after restore ran, to avoid clobbering).
  useEffect(() => {
    if (!brandId || restoredFor.current !== brandId) return;
    try {
      window.sessionStorage.setItem(keyFor(brandId), JSON.stringify(snapshot));
    } catch {
      /* ignore */
    }
  }, [brandId, snapshot]);
}
