import { supabase } from "@/integrations/supabase/client";
import { cnTable, signedAssetUrl } from "../api/db";
import { checkClaims } from "./claimGating";

/**
 * Normalises a Brandie brand OR an external Creator Network prospect into the
 * minimal render context the existing design pipeline accepts. Prospects are
 * never converted into Brandie brands: they are passed as an id-less brand
 * object, which design-studio already supports (all brand-id lookups are guarded).
 */
export interface ProductionContext {
  source: "brand" | "prospect";
  brand: Record<string, any>;
  brief: string;
}

const line = (label: string, v: unknown) => (v ? `${label}: ${Array.isArray(v) ? v.join(", ") : v}` : null);

export async function buildCreatorNetworkProductionContext(opportunityId: string, conceptId: string): Promise<ProductionContext> {
  const { data: opp, error } = await cnTable("opportunities").select("*").eq("id", opportunityId).maybeSingle();
  if (error || !opp) throw new Error("Opportunity not found");
  const { data: concept } = await cnTable("concepts").select("*").eq("id", conceptId).maybeSingle();
  if (!concept || concept.status !== "Approved") throw new Error("Concept must be human-approved");
  const claims = checkClaims(concept.claims);
  if (!claims.ok) throw new Error(claims.reason);
  const { data: creator } = await cnTable("creators").select("display_name,profile_image_path").eq("id", opp.creator_id).maybeSingle();

  let product: any = null;
  if (opp.product_id && opp.product_source === "prospect_product") {
    product = (await cnTable("prospect_products").select("name,description,category,image_url,product_url").eq("id", opp.product_id).maybeSingle()).data;
  } else if (opp.product_id) {
    product = (await (supabase as any).from("brand_products").select("label,description,image_url").eq("id", opp.product_id).maybeSingle()).data;
    if (product) product.name = product.label;
  }

  const refs: string[] = [];
  if (product?.image_url) refs.push(product.image_url);
  if (creator?.profile_image_path) {
    const u = await signedAssetUrl(creator.profile_image_path, 3600);
    if (u) refs.push(u);
  }

  let brand: Record<string, any>;
  let business: any = null;
  if (opp.prospect_id) {
    business = (await cnTable("prospects").select("business_name,category,location,urls,products_summary,target_customer,brand_positioning,visual_style,observed_content_gap").eq("id", opp.prospect_id).maybeSingle()).data;
    if (!business) throw new Error("Prospect not found");
    // id-less brand object: no Brand Centre row is created or required.
    brand = {
      name: business.business_name,
      description: [business.products_summary, business.brand_positioning].filter(Boolean).join(" — ") || null,
      vibe: business.visual_style || "Modern",
      tone_of_voice: "Warm, confident",
      personality_traits: [],
      primary_colors: [],
      secondary_colors: [],
      inspiration_examples: refs,
      prefer_gallery_first: true,
      special_instructions: "Private speculative ad preview. Feature the supplied product photo exactly as-is and the supplied creator reference as the on-camera person.",
    };
  } else if (opp.brand_id) {
    const { data: b } = await (supabase as any).from("brands").select("*").eq("id", opp.brand_id).maybeSingle();
    if (!b) throw new Error("Brand not accessible to you");
    brand = { ...b, inspiration_examples: [...refs, ...(b.inspiration_examples ?? [])] };
    business = { business_name: b.name };
  } else throw new Error("Opportunity has no business");

  const brief = [
    `Create a 1080x1080 static speculative ad for ${business.business_name}.`,
    line("Category", business.category), line("Product", product?.name), line("Product description", product?.description),
    line("Target customer", business.target_customer), line("Positioning", business.brand_positioning),
    line("Content gap", business.observed_content_gap), line("Public visual cues", business.visual_style),
    line("Concept", concept.concept_name), line("Hook", concept.hook), line("Idea", concept.strategic_idea),
    line("Creator role", concept.creator_role && `${creator?.display_name ?? "Creator"} as ${concept.creator_role}`),
    line("Approved claims", (concept.claims ?? []).map((c: any) => c.text)),
    line("Platform", concept.platform), line("CTA", concept.cta),
    "Do not imply the creator personally used the product unless a claim says so.",
  ].filter(Boolean).join("\n");

  return { source: opp.prospect_id ? "prospect" : "brand", brand, brief };
}
