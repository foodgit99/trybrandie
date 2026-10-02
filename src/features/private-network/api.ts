import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export function pnError(e: any): string {
  const m = String(e?.message ?? e ?? "Something went wrong");
  if (/PN:/.test(m)) return m.replace(/^.*PN:\s*/, "");
  if (/row-level security/i.test(m)) return "You don't have permission for this in Private Network.";
  if (/pn_budget_conserved/.test(m)) return "Budget can't be lower than what is already reserved or spent.";
  if (/invalid input value for enum/.test(m)) return "Unknown platform.";
  return m;
}

export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(`private_network_${fn}`, args);
  if (error) throw new Error(pnError(error));
  return data as T;
}

export const pnFrom = (t: string) => db.from(`private_network_${t}`);

export async function signedMedia(ids: string[]): Promise<Record<string, { url: string | null; media_type: string }>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.functions.invoke("private-network-media", { body: { creative_ids: ids } });
  if (error) throw error;
  return (data?.media ?? {}) as Record<string, { url: string | null; media_type: string }>;
}

export async function signedProof(placementId: string): Promise<string | null> {
  const { data } = await supabase.functions.invoke("private-network-media", { body: { proof_placement_id: placementId } });
  return data?.url ?? null;
}

/** Mutation wrapper: toasts friendly errors, invalidates every Private Network query. */
export function usePnAction<A>(fn: (a: A) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pn"] });
      if (success) toast.success(success);
    },
    onError: (e) => toast.error(pnError(e)),
  });
}

export function usePnQuery<T>(key: unknown[], fn: () => Promise<T>, enabled = true) {
  return useQuery<T>({ queryKey: ["pn", ...key], queryFn: fn, enabled });
}
