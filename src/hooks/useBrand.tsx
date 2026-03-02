import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useBrand(externalUser?: { id: string } | null) {
  const { user: authUser, loading: authLoading } = useAuth();
  const user = externalUser !== undefined ? externalUser : authUser;

  const { data: brand, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ["brand", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // If no external user was provided, account for auth still loading
  const isLoading = externalUser !== undefined ? queryLoading : (authLoading || queryLoading);

  return { brand, isLoading, refetch };
}
