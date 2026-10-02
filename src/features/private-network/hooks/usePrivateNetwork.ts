import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PnRole, Publisher } from "../types";

/**
 * Single source of truth for PRIVATE_NETWORK_ENABLED + the caller's Private Network context.
 * The same flag is enforced server-side by RLS and every private_network_* RPC.
 */
export function usePrivateNetwork() {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery({
    queryKey: ["pn", "access", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const db = supabase as any;
      const [flag, admin, members, pub, brands] = await Promise.all([
        db.from("private_network_settings").select("enabled").maybeSingle(),
        db.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
        db.from("private_network_members").select("role").eq("user_id", user!.id),
        db.from("private_network_publishers").select("*").eq("user_id", user!.id).maybeSingle(),
        db.from("brands").select("id,name").eq("is_archived", false).order("name"),
      ]);
      return {
        enabled: !!flag.data?.enabled,
        isBrandieAdmin: !!admin.data,
        roles: ((members.data ?? []) as { role: PnRole }[]).map((m) => m.role),
        publisher: (pub.data ?? null) as Publisher | null,
        brands: (brands.data ?? []) as { id: string; name: string }[],
      };
    },
  });
  const d = q.data;
  const roles = d?.roles ?? [];
  const isBrandieAdmin = !!d?.isBrandieAdmin;
  const hasRole = (r?: PnRole) => isBrandieAdmin || roles.includes("admin") || (!!r && roles.includes(r));
  return {
    user,
    loading: authLoading || (!!user && q.isLoading),
    enabled: !!d?.enabled,
    isBrandieAdmin,
    roles,
    isOperator: isBrandieAdmin || roles.length > 0,
    hasRole,
    publisher: d?.publisher ?? null,
    isApprovedPublisher: d?.publisher?.status === "approved",
    brands: d?.brands ?? [],
    /** Any signed-in user can open the module (to onboard) once the flag is ON. */
    canAccess: !!d?.enabled && !!user,
    refetch: q.refetch,
  };
}
