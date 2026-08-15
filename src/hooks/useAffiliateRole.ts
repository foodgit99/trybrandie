import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Returns the caller's affiliate record, when they have one. */
export function useAffiliateRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-self", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("id, status")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return {
    affiliate: data ?? null,
    isAffiliate: !!data && data.status === "approved",
    loading: isLoading,
  };
}
