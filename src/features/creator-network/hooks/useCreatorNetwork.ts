import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CnRole } from "../types";

/**
 * Single source of truth for the CREATOR_NETWORK_ENABLED flag + operator access.
 * The flag lives in `creator_network_settings.enabled` (admin-toggled); the same
 * flag is enforced server-side by RLS via `creator_network_can()`.
 */
export function useCreatorNetwork() {
  const { user, loading: authLoading } = useAuth();

  const q = useQuery({
    queryKey: ["creator-network-access", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const db = supabase as any;
      const [flag, admin, members] = await Promise.all([
        db.from("creator_network_settings").select("enabled").maybeSingle(),
        db.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
        db.from("creator_network_members").select("role").eq("user_id", user!.id),
      ]);
      const roles = ((members.data ?? []) as { role: CnRole }[]).map((m) => m.role);
      return {
        CREATOR_NETWORK_ENABLED: !!flag.data?.enabled,
        isBrandieAdmin: !!admin.data,
        roles,
      };
    },
  });

  const enabled = !!q.data?.CREATOR_NETWORK_ENABLED;
  const isBrandieAdmin = !!q.data?.isBrandieAdmin;
  const roles = q.data?.roles ?? [];
  const isOperator = isBrandieAdmin || roles.length > 0;

  return {
    loading: authLoading || (!!user && q.isLoading),
    enabled,
    isBrandieAdmin,
    roles,
    /** Visible = flag on AND authorised. */
    canAccess: enabled && isOperator,
    hasRole: (r: CnRole) => isBrandieAdmin || roles.includes("admin") || roles.includes(r),
    refetch: q.refetch,
  };
}
