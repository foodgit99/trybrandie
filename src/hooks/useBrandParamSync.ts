import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useBrand } from "./useBrand";

/**
 * Builds a link that carries the current brand selection, e.g.
 * brandHref("/brand/editor#audience", id) -> "/brand/editor?brand=<id>#audience"
 */
export function brandHref(path: string, brandId?: string | null) {
  if (!brandId) return path;
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}brand=${encodeURIComponent(brandId)}${hash ? `#${hash}` : ""}`;
}

/**
 * Keeps `?brand=<id>` in sync with the active brand:
 * - a brand id in the URL wins and switches the active brand
 * - otherwise the active brand id is written into the URL (replace, no history entry)
 */
export function useBrandParamSync() {
  const { brands, activeBrandId, setActiveBrand } = useBrand();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("brand");

  useEffect(() => {
    if (!brands || brands.length === 0) return;

    if (requested) {
      if (requested === activeBrandId) return;
      if (brands.some((b: any) => b.id === requested)) {
        setActiveBrand(requested);
      } else {
        // stale/unknown id, drop it
        const next = new URLSearchParams(searchParams);
        next.delete("brand");
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (activeBrandId) {
      const next = new URLSearchParams(searchParams);
      next.set("brand", activeBrandId);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, requested, activeBrandId]);

  return activeBrandId;
}
