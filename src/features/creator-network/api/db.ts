import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Row } from "../types";

export type CnTable =
  | "creators" | "audience_profiles" | "validations" | "interviews" | "prospects" | "prospect_products"
  | "matches" | "opportunities" | "concepts" | "licences" | "production_jobs" | "production_reviews"
  | "sales" | "earnings" | "payouts" | "findings" | "tasks" | "ai_runs" | "brand_safety_reviews"
  | "experiments" | "activity_log" | "members";

export const cnTable = (t: CnTable) => (supabase as any).from(`creator_network_${t}`);

type Filter = Record<string, string | number | boolean | null | undefined>;

export function useCnList(table: CnTable, opts: { filter?: Filter; order?: string; ascending?: boolean; limit?: number; select?: string; enabled?: boolean } = {}) {
  const { filter = {}, order = "created_at", ascending = false, limit = 500, select = "*", enabled = true } = opts;
  return useQuery<Row[]>({
    queryKey: ["cn", table, filter, order, ascending, limit, select],
    enabled,
    queryFn: async () => {
      let q = cnTable(table).select(select).order(order, { ascending }).limit(limit);
      for (const [k, v] of Object.entries(filter)) {
        if (v === undefined) continue;
        q = v === null ? q.is(k, null) : q.eq(k, v);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCnOne(table: CnTable, id: string | undefined) {
  return useQuery<Row | null>({
    queryKey: ["cn", table, "one", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await cnTable(table).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Human-readable error from Postgres/RLS/trigger messages. */
export function friendlyError(e: any): string {
  const m = String(e?.message ?? e ?? "Something went wrong");
  if (/row-level security/i.test(m)) return "You don't have permission for this action in Creator Network.";
  if (/creator_network_concepts_one_selected/.test(m)) return "Only one concept per opportunity can be Selected or Approved.";
  if (/check constraint/i.test(m)) {
    if (/lost_reason|stage/.test(m)) return "A reason is required when marking an opportunity Lost.";
    if (/reason/.test(m)) return "A reason is required for Edit, Reject and Regenerate decisions.";
    if (/blocker/.test(m)) return "Describe the blocker before marking this Blocked.";
    if (/revocation/.test(m)) return "A revocation reason is required.";
  }
  return m;
}

export function useCnMutation(table: CnTable) {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ["cn"] });
  };
  return {
    insert: useMutation({
      mutationFn: async (values: Record<string, any>) => {
        const { data, error } = await cnTable(table).insert(values).select().single();
        if (error) throw error;
        return data as Row;
      },
      onSuccess: () => { done(); toast.success("Saved"); },
      onError: (e) => toast.error(friendlyError(e)),
    }),
    update: useMutation({
      mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
        const { data, error } = await cnTable(table).update(values).eq("id", id).select().single();
        if (error) throw error;
        return data as Row;
      },
      onSuccess: () => { done(); toast.success("Updated"); },
      onError: (e) => toast.error(friendlyError(e)),
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await cnTable(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => { done(); toast.success("Deleted"); },
      onError: (e) => toast.error(friendlyError(e)),
    }),
  };
}

export async function signedAssetUrl(path: string, seconds = 600): Promise<string | null> {
  const { data } = await supabase.storage.from("creator-network-assets").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
