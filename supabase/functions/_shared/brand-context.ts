// Shared, grounded brand-context builder used by conversational agents.
// Returns a markdown block describing the brand, audience, strategy and recent output.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function buildBrandContext(
  sb: SupabaseClient,
  brandId: string,
): Promise<{ brand: any; context: string } | null> {
  const [
    brandRes,
    audienceRes,
    pillarsRes,
    seriesRes,
    campaignsRes,
    productsRes,
    galleryRes,
    designsRes,
    ideasRes,
    trendIntelRes,
    competitorsRes,
  ] = await Promise.all([
    sb.from("brands").select("*").eq("id", brandId).maybeSingle(),
    sb.from("target_audiences").select("label, jtbd_profile").eq("brand_id", brandId),
    sb.from("content_pillars").select("name, description").eq("brand_id", brandId).order("sort_order"),
    sb.from("post_series").select("name, description, recurrence, preferred_day").eq("brand_id", brandId),
    sb.from("campaigns").select("name, description, post_count").eq("brand_id", brandId),
    sb.from("brand_products").select("label, description, product_type, price, features, duration, pricing_model, is_featured, image_url, gallery_images").eq("brand_id", brandId),
    sb.from("brand_inspiration").select("label").eq("brand_id", brandId),
    sb.from("designs").select("title, prompt, trend_used, vote, content_category, created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(12),
    sb.from("content_ideas").select("title, scheduled_for, status, content_category, funnel_stage").eq("brand_id", brandId).order("scheduled_for", { ascending: true }).limit(15),
    sb.from("brand_trend_intel").select("trends_data, generated_at").eq("brand_id", brandId).maybeSingle(),
    sb.from("brand_competitors").select("name, website, is_active").eq("brand_id", brandId).limit(10),
  ]);

  const brand = brandRes.data;
  if (!brand) return null;

  const audiences = audienceRes.data ?? [];
  const pillars = pillarsRes.data ?? [];
  const series = seriesRes.data ?? [];
  const campaigns = campaignsRes.data ?? [];
  const products = productsRes.data ?? [];
  const gallery = (galleryRes.data ?? []).filter((g: any) => g.label);
  const designs = designsRes.data ?? [];
  const ideas = ideasRes.data ?? [];
  const competitors = competitorsRes.data ?? [];

  const trendBlock = (() => {
    const intel = trendIntelRes.data as any;
    if (!intel?.trends_data || !Array.isArray(intel.trends_data) || intel.trends_data.length === 0) {
      return "No trend intelligence cached yet — suggest refreshing Trend Intel from the Content Hub.";
    }
    const days = Math.floor((Date.now() - new Date(intel.generated_at).getTime()) / 86_400_000);
    return `*Last refreshed ${days === 0 ? "today" : `${days} day(s) ago`}*\n` +
      (intel.trends_data as any[]).slice(0, 6).map((t: any) =>
        `- **${t.title}** — ${t.summary}\n  Relevance: ${t.relevance_to_brand}\n  Angles: ${(t.content_angles || []).join("; ")}`,
      ).join("\n");
  })();

  const context = `
## Brand Profile
- Name: ${brand.name}
- Tagline: ${brand.tagline || "Not set"}
- Description: ${brand.description || "Not set"}
- Vibe: ${brand.vibe || "Not set"}
- Tone of voice: ${brand.tone_of_voice || "Not set"}
- Personality: ${(brand.personality_traits || []).join(", ") || "Not set"}
- Colours: primary ${(brand.primary_colors || []).join(", ") || "-"} | secondary ${(brand.secondary_colors || []).join(", ") || "-"} | accent ${(brand.accent_colors || []).join(", ") || "-"}
- Typography: ${brand.typography_primary || "-"} / ${brand.typography_secondary || "-"} / ${brand.typography_display || "-"}
- Logo: ${brand.logo_url ? "uploaded" : "missing"}
- Special instructions: ${brand.special_instructions || "None"}

## Products & Services
${products.length ? products
  .sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
  .map((p: any, i: number) => {
    let line = `${i + 1}. ${p.is_featured ? "⭐ " : ""}**${p.label || "Untitled"}** (${p.product_type}${p.price ? `, ${p.pricing_model ? p.pricing_model + " " : ""}${p.price}` : ""}${p.duration ? `, ${p.duration}` : ""})`;
    if (p.description) line += ` — ${p.description}`;
    if (p.features?.length) line += `\n   Includes: ${p.features.join(", ")}`;
    const shots = [p.image_url, ...((p.gallery_images as string[]) || [])].filter(Boolean).length;
    line += `\n   Real photos on file: ${shots > 0 ? `${shots} (use these exact images when referencing this ${p.product_type === "service" ? "service" : "product"} — never invent a substitute)` : "none yet (advise the user to upload one in Brand Centre)"}`;
    return line;
  }).join("\n") : "None added yet."}

*Product imagery rule: when copy, a plan, or a design references a specific product or service, use its stored photo(s) verbatim. Only fabricate imagery for products with no photo on file.*

## Target Audiences (JTBD)
${audiences.length ? audiences.map((a: any) => {
  const p = a.jtbd_profile || {};
  return `### ${a.label}
- Persona: ${p.persona_summary || "N/A"}
- Core job: ${p.core_job_statement || "N/A"}
- Struggling moments: ${(p.struggling_moments || []).join("; ") || "N/A"}
- Emotional outcomes: ${(p.emotional_outcomes || []).join("; ") || "N/A"}
- Messaging angles: ${(p.messaging_angles || []).join("; ") || "N/A"}`;
}).join("\n") : "Not defined yet."}

## Content Pillars
${pillars.length ? pillars.map((p: any) => `- **${p.name}**: ${p.description}`).join("\n") : "None yet."}

## Recurring Series
${series.length ? series.map((s: any) => `- **${s.name}** (${s.recurrence}${s.preferred_day ? `, ${s.preferred_day}` : ""}): ${s.description}`).join("\n") : "None yet."}

## Campaigns
${campaigns.length ? campaigns.map((c: any) => `- **${c.name}** (${c.post_count} posts): ${c.description}`).join("\n") : "None yet."}

## Upcoming / recent ideas in the plan
${ideas.length ? ideas.map((i: any) => `- ${i.scheduled_for ?? "unscheduled"} — "${i.title}" [${i.content_category ?? "uncategorised"}${i.funnel_stage ? `, ${i.funnel_stage}` : ""}] (${i.status ?? "draft"})`).join("\n") : "Nothing planned yet."}

## Recent designs & signal
${designs.length ? designs.map((d: any) => `- "${d.title || (d.prompt || "").slice(0, 60)}"${d.content_category ? ` [${d.content_category}]` : ""}${d.trend_used ? ` (trend: ${d.trend_used})` : ""}${d.vote === 1 ? " 👍" : d.vote === -1 ? " 👎" : ""}`).join("\n") : "No designs shipped yet."}

## Brand gallery labels (real assets available to designs)
${gallery.length ? gallery.map((g: any) => `- ${g.label}`).join("\n") : "No labelled gallery images yet."}

## Tracked competitors
${competitors.length ? competitors.map((c: any) => `- ${c.name}${c.website ? ` (${c.website})` : ""}${c.is_active ? "" : " [paused]"}`).join("\n") : "None tracked yet."}

## Industry trend intelligence
${trendBlock}
`.trim();

  return { brand, context };
}
