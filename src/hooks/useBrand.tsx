import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  // Cross-tab + cross-component sync
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

  const { data: brands, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ["brands", user?.id],
    queryFn: async () => {
      if (!user) return [] as any[];
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
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

  // If localStorage has a stale id, clear it once brands resolve
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
      // Invalidate brand-scoped queries so pages refetch with new brand
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
    refetch,
  };
}
