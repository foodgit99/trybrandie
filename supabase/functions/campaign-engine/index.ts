// Campaign module backend.
//
// One campaign is live at a time (a billboard). Partners create campaigns that
// an admin must approve; admins can create and activate directly. The engine
// writes the landing-page copy in Brandie's brand language; humans edit and
// approve it before anything goes public.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OGILVY_COPY_DOCTRINE } from "../_shared/ogilvy-copy-doctrine.ts";
import {
  CAMPAIGN_COPY_SCHEMA,
  CAMPAIGN_SECTION_LABELS,
  normaliseSections,
  type CampaignSectionKey,
} from "../_shared/campaign-sections.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

function scrub(v: unknown, max = 400): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function generateCopy(
  key: string,
  campaign: { name: string; goal: string | null; audience: string | null; offer_text: string | null },
  sections: CampaignSectionKey[],
): Promise<{ ok: true; copy: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const sectionList = sections.map((s) => `- ${s} (${CAMPAIGN_SECTION_LABELS[s]})`).join("\n");

  const system = `You are Brandie's campaign copywriter. You write the copy for a public campaign landing page that lives on Brandie's own domain, so it MUST sound like Brandie.

${OGILVY_COPY_DOCTRINE}

BRANDIE BRAND LANGUAGE (non-negotiable):
- Brandie is an autonomous content system for small businesses: pick a playbook, hit start, a full week of on-brand posts is generated, sequenced and waiting.
- Voice: calm, editorial, confident. Short sentences. Concrete nouns. No hype stacking, no emoji, no ALL CAPS, no exclamation marks.
- Never invent features Brandie does not have. Real capabilities: industry playbooks, always-full weekly queue, brand memory, conversational edits, audience intelligence (JTBD), trend adaptation, carousels, WhatsApp/email delivery, CEO briefing.
- Never invent prices, discounts, guarantees, statistics or customer names beyond the offer text given to you.
- British-leaning spelling, Nigerian small-business reality where examples help.

Return STRICT JSON only, with exactly these top-level keys (and no others): ${sections.join(", ")}.
Shape reference (only include the keys listed above):
${CAMPAIGN_COPY_SCHEMA}`;

  const user = `Campaign name: ${campaign.name}
Goal: ${campaign.goal || "drive signups"}
Target audience: ${campaign.audience || "small business owners who post inconsistently"}
Offer / message to carry: ${campaign.offer_text || "start free, first week of content in under 60 seconds"}

Sections on this page, in order:
${sectionList}

Write the copy. Every headline must earn the next line. The hero headline is under 60 characters.`;

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("campaign-engine AI error", res.status, text);
    if (res.status === 429) return { ok: false, status: 429, error: "AI is rate limited. Try again in a moment." };
    if (res.status === 402) return { ok: false, status: 402, error: "AI credits are exhausted. Top up to keep generating." };
    return { ok: false, status: 503, error: "The campaign engine could not reach the AI service." };
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, copy: parsed && typeof parsed === "object" ? parsed : {} };
  } catch {
    return { ok: false, status: 502, error: "The campaign engine returned copy it could not parse. Try again." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: adminFlag } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = !!adminFlag;

    const { data: partner } = await admin
      .from("partner_profiles")
      .select("id, name, status")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPartner = !!partner && partner.status === "active";

    if (!isAdmin && !isPartner) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const campaignId = body?.campaign_id ? String(body.campaign_id) : null;

    const loadCampaign = async () => {
      if (!campaignId) return null;
      const { data } = await admin.from("campaigns_public").select("*").eq("id", campaignId).maybeSingle();
      return data;
    };
    const canEdit = (c: any) => isAdmin || c?.user_id === user.id;

    switch (action) {
      case "list": {
        let q = admin.from("campaigns_public").select("*").order("created_at", { ascending: false });
        if (!isAdmin) q = q.eq("user_id", user.id);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);

        const { data: live } = await admin
          .from("campaigns_public")
          .select("id, name, slug, user_id, partner_id, ends_at")
          .eq("status", "active")
          .maybeSingle();

        return json({ campaigns: data || [], live: live || null, is_admin: isAdmin, partner: partner || null });
      }

      case "create": {
        const name = scrub(body?.name, 120);
        if (!name) return json({ error: "A campaign name is required." }, 400);
        let slug = slugify(scrub(body?.slug, 60) || name);
        if (slug.length < 3) slug = `${slug}-campaign`;

        // Keep the link unique without failing the user's first attempt.
        const { data: taken } = await admin.from("campaigns_public").select("slug").eq("slug", slug).maybeSingle();
        if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

        const sections = normaliseSections(body?.sections);
        const payload = {
          user_id: user.id,
          partner_id: isPartner ? partner!.id : null,
          name,
          slug,
          goal: scrub(body?.goal, 400) || null,
          audience: scrub(body?.audience, 400) || null,
          offer_text: scrub(body?.offer_text, 600) || null,
          sections,
          starts_at: body?.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
          ends_at: body?.ends_at ? new Date(body.ends_at).toISOString() : null,
          status: "draft",
        };
        const { data, error } = await admin.from("campaigns_public").insert(payload).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ campaign: data });
      }

      case "update": {
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!canEdit(c)) return json({ error: "forbidden" }, 403);

        const patch: Record<string, unknown> = {};
        if (body?.name !== undefined) patch.name = scrub(body.name, 120);
        if (body?.goal !== undefined) patch.goal = scrub(body.goal, 400) || null;
        if (body?.audience !== undefined) patch.audience = scrub(body.audience, 400) || null;
        if (body?.offer_text !== undefined) patch.offer_text = scrub(body.offer_text, 600) || null;
        if (body?.sections !== undefined) patch.sections = normaliseSections(body.sections);
        if (body?.copy !== undefined && body.copy && typeof body.copy === "object") patch.copy = body.copy;
        if (body?.starts_at !== undefined) patch.starts_at = new Date(body.starts_at).toISOString();
        if (body?.ends_at !== undefined) patch.ends_at = body.ends_at ? new Date(body.ends_at).toISOString() : null;
        if (body?.partner_campaign_id !== undefined) {
          patch.partner_campaign_id = await resolveEmailCampaignLink(body.partner_campaign_id);
        }


        // Editing a live or reviewed campaign is allowed, but any content change
        // on a partner campaign under review sends it back to the queue.
        if (!isAdmin && c.status === "pending_review") patch.status = "pending_review";

        const { data, error } = await admin
          .from("campaigns_public")
          .update(patch)
          .eq("id", c.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ campaign: data });
      }

      case "generate_copy": {
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!canEdit(c)) return json({ error: "forbidden" }, 403);

        const key = Deno.env.get("LOVABLE_API_KEY");
        if (!key) return json({ error: "AI is not configured." }, 500);

        const sections = normaliseSections(body?.sections ?? c.sections);
        const result = await generateCopy(key, c, sections);
        if (!result.ok) return json({ error: result.error }, result.status);

        const { data, error } = await admin
          .from("campaigns_public")
          .update({ copy: result.copy, sections })
          .eq("id", c.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ campaign: data });
      }

      case "submit": {
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!canEdit(c)) return json({ error: "forbidden" }, 403);
        if (!c.copy || Object.keys(c.copy).length === 0) {
          return json({ error: "Generate the page copy before submitting for review." }, 400);
        }
        const { data, error } = await admin
          .from("campaigns_public")
          .update({ status: "pending_review", submitted_at: new Date().toISOString(), review_note: null })
          .eq("id", c.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ campaign: data });
      }

      case "approve":
      case "reject": {
        if (!isAdmin) return json({ error: "forbidden" }, 403);
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        const { data, error } = await admin
          .from("campaigns_public")
          .update({
            status: action === "approve" ? "approved" : "rejected",
            approved_at: action === "approve" ? new Date().toISOString() : null,
            review_note: scrub(body?.note, 600) || null,
          })
          .eq("id", c.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ campaign: data });
      }

      case "activate": {
        if (!isAdmin) return json({ error: "Only an admin can put a campaign live." }, 403);
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!["approved", "paused", "archived"].includes(c.status)) {
          return json({ error: "Approve the campaign before putting it live." }, 400);
        }
        if (c.ends_at && new Date(c.ends_at) <= new Date()) {
          return json({ error: "This campaign's end date has already passed." }, 400);
        }
        const { error } = await admin.rpc("activate_campaign_page", { _campaign_id: c.id });
        if (error) return json({ error: error.message }, 400);
        const { data } = await admin.from("campaigns_public").select("*").eq("id", c.id).single();
        return json({ campaign: data });
      }

      case "pause": {
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!canEdit(c)) return json({ error: "forbidden" }, 403);
        const { data, error } = await admin
          .from("campaigns_public")
          .update({ status: "paused", deactivated_at: new Date().toISOString() })
          .eq("id", c.id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ campaign: data });
      }

      case "delete": {
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!canEdit(c)) return json({ error: "forbidden" }, 403);
        if (c.status === "active") return json({ error: "Pause the campaign before deleting it." }, 400);
        const { error } = await admin.from("campaigns_public").delete().eq("id", c.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "stats": {
        const c = await loadCampaign();
        if (!c) return json({ error: "not_found" }, 404);
        if (!canEdit(c)) return json({ error: "forbidden" }, 403);

        const { data: events } = await admin
          .from("campaign_page_events")
          .select("event_name, section_key, referral_slug, created_at")
          .eq("campaign_id", c.id)
          .order("created_at", { ascending: false })
          .limit(5000);

        const totals: Record<string, number> = {};
        const sections: Record<string, number> = {};
        const referrals: Record<string, number> = {};
        for (const e of events || []) {
          totals[e.event_name] = (totals[e.event_name] || 0) + 1;
          if (e.event_name === "section_view" && e.section_key) {
            sections[e.section_key] = (sections[e.section_key] || 0) + 1;
          }
          if (e.referral_slug) referrals[e.referral_slug] = (referrals[e.referral_slug] || 0) + 1;
        }

        return json({
          totals,
          sections,
          referrals,
          recent: (events || []).slice(0, 50),
        });
      }

      default:
        return json({ error: "invalid_action" }, 400);
    }
  } catch (err) {
    console.error("campaign-engine error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
