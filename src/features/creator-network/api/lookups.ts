import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCnList } from "./db";
import { fromBrandProduct, fromProspectProduct, type NormalizedProduct } from "../services/normalizedProduct";

/** Brandie brands visible to the operator (RLS decides). Only id + name — no Brand Centre internals. */
export function useBrandOptions() {
  return useQuery({
    queryKey: ["cn", "brand-options"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("brands").select("id, name").order("name").limit(500);
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

export function useNameMaps() {
  const creators = useCnList("creators", { select: "id, code, display_name", order: "display_name", ascending: true });
  const prospects = useCnList("prospects", { select: "id, code, business_name", order: "business_name", ascending: true });
  const brands = useBrandOptions();
  const creatorName = (id?: string | null) => creators.data?.find((c) => c.id === id)?.display_name ?? "—";
  const partyName = (r: { brand_id?: string | null; prospect_id?: string | null }) =>
    r.brand_id ? brands.data?.find((b) => b.id === r.brand_id)?.name ?? "Brand" : r.prospect_id ? prospects.data?.find((p) => p.id === r.prospect_id)?.business_name ?? "Prospect" : "—";
  return {
    creators: creators.data ?? [],
    prospects: prospects.data ?? [],
    brands: brands.data ?? [],
    creatorName,
    partyName,
  };
}

/** Normalized products for a brand or prospect — matching doesn't care which source. */
export function useNormalizedProducts(owner: { brand_id?: string | null; prospect_id?: string | null }) {
  return useQuery<NormalizedProduct[]>({
    queryKey: ["cn", "products", owner.brand_id, owner.prospect_id],
    enabled: !!(owner.brand_id || owner.prospect_id),
    queryFn: async () => {
      const db = supabase as any;
      if (owner.brand_id) {
        const { data } = await db.from("brand_products").select("id, brand_id, label, description, price, image_url, product_type").eq("brand_id", owner.brand_id);
        return (data ?? []).map(fromBrandProduct);
      }
      const { data } = await db.from("creator_network_prospect_products").select("*").eq("prospect_id", owner.prospect_id);
      return (data ?? []).map(fromProspectProduct);
    },
  });
}
