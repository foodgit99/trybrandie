import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Returns the caller's Marketing Partner profile, when they have one. */
export function usePartnerRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["partner-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_profiles")
        .select("id, name, slug, status, partner_type, logo_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return {
    partner: data ?? null,
    isPartner: !!data && data.status === "active",
    loading: isLoading,
  };
}
