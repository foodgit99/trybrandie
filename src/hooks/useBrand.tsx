import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isLockTimeoutError } from "@/lib/authStore";
import { useAuth } from "./useAuth";


const ACTIVE_BRAND_KEY = "brandie.activeBrandId";

function readActiveBrandId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_BRAND_KEY);
  } catch {
    return null;
  }
}

function writeActiveBrandId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_BRAND_KEY, id);
    else localStorage.removeItem(ACTIVE_BRAND_KEY);
  } catch {
    /* noop */
  }
}

export function useBrand(externalUser?: { id: string } | null) {
  const { user: authUser, loading: authLoading } = useAuth();
  const user = externalUser !== undefined ? externalUser : authUser;
  const queryClient = useQueryClient();

  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(() =>
    readActiveBrandId()
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_BRAND_KEY) setActiveBrandIdState(e.newValue);
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null | undefined;
      setActiveBrandIdState(detail ?? null);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("brandie:active-brand-changed", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "brandie:active-brand-changed",
        onCustom as EventListener
      );
    };
  }, []);

  const { data: brands, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ["brands-and-memberships", user?.id],
    queryFn: async () => {
      if (!user) return [] as any[];

      // 1. Owned brands
      const ownedPromise = supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      // 2. Brands the user is an active team member of
      const membershipsPromise = supabase
        .from("brand_team_members")
        .select("brand_id, role")
        .eq("user_id", user.id)
        .eq("status", "active");

      const [{ data: owned, error: oErr }, { data: memberships, error: mErr }] =
        await Promise.all([ownedPromise, membershipsPromise]);

      if (oErr) {
        // Only treat as a stale-session error if the message actually points
        // at JWT/claim problems. Plain permission / network errors should
        // surface as query errors instead of forcing a logout loop.
        const msg = String((oErr as any)?.message ?? "").toLowerCase();
        const code = String((oErr as any)?.code ?? "").toUpperCase();
        const isJwtError =
          code === "PGRST301" ||
          msg.includes("jwt") ||
          msg.includes("invalid claim") ||
          msg.includes("missing sub");
        if (isJwtError) {
          try {
            await supabase.auth.signOut({ scope: "local" } as any);
            Object.keys(localStorage)
              .filter((k) => k.startsWith("sb-"))
              .forEach((k) => localStorage.removeItem(k));
            if (typeof window !== "undefined") window.location.href = "/auth";
          } catch {
            /* ignore */
          }
        }
        throw oErr;
      }
      if (mErr) {
        // Don't hard-fail brand loading if memberships table query fails
        console.warn("memberships fetch failed", mErr);
      }

      const ownedIds = new Set((owned ?? []).map((b: any) => b.id));
      const memberBrandIds = (memberships ?? [])
        .map((m: any) => m.brand_id)
        .filter((id: string) => !ownedIds.has(id));

      let memberBrands: any[] = [];
      if (memberBrandIds.length > 0) {
        const { data: mb } = await supabase
          .from("brands")
          .select("*")
          .in("id", memberBrandIds);
        memberBrands = mb ?? [];
      }

      const roleByBrand: Record<string, string> = {};
      for (const m of memberships ?? []) {
        roleByBrand[(m as any).brand_id] = (m as any).role || "editor";
      }

      const ownedTagged = (owned ?? []).map((b: any) => ({ ...b, __role: "owner" as const }));
      const memberTagged = memberBrands.map((b: any) => ({
        ...b,
        __role: "member" as const,
        __member_role: roleByBrand[b.id] || "editor",
      }));

      return [...ownedTagged, ...memberTagged];
    },
    enabled: !!user,
    // A transient auth-token lock timeout must not surface as
    // "Couldn't load your brand" — retry it once after a short delay.
    retry: (failureCount, error) => failureCount < 1 && isLockTimeoutError(error),
    retryDelay: 800,
  });




  const activeBrand = (() => {
    if (!brands || brands.length === 0) return null;
    const nonArchived = brands.filter((b: any) => !b.is_archived);
    const pool = nonArchived.length > 0 ? nonArchived : brands;
    if (activeBrandId) {
      const match = pool.find((b: any) => b.id === activeBrandId);
      if (match) return match;
    }
    return pool[0];
  })();

  useEffect(() => {
    if (!brands || brands.length === 0) return;
    if (activeBrandId && !brands.some((b: any) => b.id === activeBrandId)) {
      writeActiveBrandId(null);
      setActiveBrandIdState(null);
    }
  }, [brands, activeBrandId]);

  const setActiveBrand = useCallback(
    (id: string | null) => {
      writeActiveBrandId(id);
      setActiveBrandIdState(id);
      window.dispatchEvent(
        new CustomEvent("brandie:active-brand-changed", { detail: id })
      );
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const isLoading =
    externalUser !== undefined ? queryLoading : authLoading || queryLoading;

  return {
    brand: activeBrand,
    brands: brands ?? [],
    activeBrandId: activeBrand?.id ?? null,
    setActiveBrand,
    isLoading,
    error: queryError as Error | null,
    refetch,
  };
}

