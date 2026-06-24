import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWeekHolidaysAsync, fetchHolidayFeed, resolveBrandRegion } from "../_shared/holiday-feed.ts";
import { fetchRecentUpdates, fetchAllUpdatesForPlanning, formatUpdatesForPrompt, markUpdatesUsed, tierFor } from "../_shared/brand-updates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const CONTENT_CATEGORIES_REF = `
THE 10 CONTENT CATEGORIES:
1. Announcement — New launches, updates, pivots. Bold headline energy.
2. Educational — Tips, how-tos, industry insights. Builds audience status. Authority tone.
3. Informational — Logistics: hours, pricing, policies. Removes buying friction.
4. Entertainment — Memes, relatable moments, scroll-stoppers. Makes brand human.
5. Promotional — Direct CTA: buy, sign up, click. The ask.
6. Trending — Current cultural moments, audio trends, formats. Algorithmic reach play.
7. Holidays & Greetings — Cultural moments, national days, festivities. Real-world connection.
8. Social Proof / UGC — Testimonials, case studies, customer stories. Affiliation trigger.
9. Behind-the-Scenes (BTS) — Team, process, messy middle. Trust and authenticity.
10. Interactive / Engagement — Polls, Q&A, "this or that", feedback requests. Two-way conversation.
`.trim();

const CONTENT_CATEGORY_ENUM = ["announcement", "educational", "informational", "entertainment", "promotional", "trending", "holidays", "social_proof", "bts", "interactive"];

// Categories that strongly prefer carousel format (multi-slide swipeable content)
const CAROUSEL_CATEGORIES = new Set(["educational", "informational", "social_proof"]);
const CAROUSEL_PILLAR_REGEX = /\b(how[- ]?to|tips?|listicle|step|guide|tutorial|breakdown|before[- ]?after)\b/i;

function forceCarouselFormat(rawFormat: any, category: any, pillarName: any): "graphic" | "carousel" {
  const fmt = rawFormat === "carousel" ? "carousel" : "graphic";
  if (fmt === "carousel") return "carousel";
  if (typeof category === "string" && CAROUSEL_CATEGORIES.has(category)) return "carousel";
  if (typeof pillarName === "string" && CAROUSEL_PILLAR_REGEX.test(pillarName)) return "carousel";
  return "graphic";
}

function clampSlideCount(raw: any): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(2, Math.round(n)));
}

// Strategic Arc — Mon..Sun narrative roles (Blueprint plan-of-record).
const WEEK_ARC = ["Hook", "Educate", "Proof", "Offer", "Urgency", "Lifestyle", "Community"];

// Ensure a weekly_blueprints row exists for (brand, week_start) and return its id.
// Idempotent via the (brand_id, week_start_date) UNIQUE constraint.
async function ensureBlueprint(client: any, brandId: string, userId: string, weekStart: string): Promise<string | null> {
  try {
    const { data: existing } = await client
      .from("weekly_blueprints")
      .select("id")
      .eq("brand_id", brandId)
      .eq("week_start_date", weekStart)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await client
      .from("weekly_blueprints")
      .upsert(
        { brand_id: brandId, user_id: userId, week_start_date: weekStart, status: "draft", source: "autopilot" },
        { onConflict: "brand_id,week_start_date" },
      )
      .select("id")
      .single();
    if (error) {
      console.warn("[brand-engine] ensureBlueprint upsert warn:", error.message);
      return null;
    }
    return created?.id ?? null;
  } catch (e) {
    console.warn("[brand-engine] ensureBlueprint failed:", e);
    return null;
  }
}





serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const token = authHeader.replace("Bearer ", "");
    const isServiceCall = token === serviceKey;

    // Read body once so we can use user_id from it for service calls
    const body = await req.json().catch(() => ({}));
    const { action, brand_id, pillar_ids, series_ids, week_offset, skip_credit_check, user_id: bodyUserId, target_days } = body || {};

    let userId: string;
    let supabase: ReturnType<typeof createClient>;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    if (isServiceCall) {
      // Background job (e.g. autopilot-planner cron) — use service client and trust user_id from body
      if (!bodyUserId) {
        return new Response(JSON.stringify({ error: "Service calls require user_id in body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = bodyUserId;
      supabase = serviceClient;
    } else {
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        console.error("Auth error in brand-engine:", userError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = user.id;
    }


    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabase.from("brands").select("*").eq("id", brand_id).single();
    if (brandErr || !brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gather context
    const [audienceRes, designsRes, trendRes, productsRes, updatesRows] = await Promise.all([
      supabase.from("target_audiences").select("jtbd_profile, label").eq("brand_id", brand_id).limit(3),
      supabase.from("designs").select("title, prompt, trend_used").eq("brand_id", brand_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("brand_trend_preferences").select("*").eq("brand_id", brand_id).maybeSingle(),
      supabase.from("brand_products").select("label, description, product_type, price, features, duration, pricing_model, is_featured").eq("brand_id", brand_id).order("created_at", { ascending: true }).limit(10),
      fetchRecentUpdates(supabase, brand_id, { limit: 12, recencyDays: 60 }),
    ]);

    const audiences = audienceRes.data || [];
    const pastDesigns = designsRes.data || [];
    const trendPrefs = trendRes.data;
    const products = productsRes.data || [];
    const recentUpdates = (updatesRows as any) || [];

    const brandContext = `
Brand: ${brand.name}
Tagline: ${brand.tagline || "N/A"}
Description: ${brand.description || "N/A"}
Tone: ${brand.tone_of_voice || "N/A"}
Personality: ${(brand.personality_traits || []).join(", ") || "N/A"}
Vibe: ${brand.vibe || "N/A"}
Special Instructions: ${brand.special_instructions || "N/A"}
`.trim();

    const audienceContext = audiences.length > 0
      ? audiences.map((a: any) => `Audience "${a.label}": ${JSON.stringify(a.jtbd_profile)}`).join("\n")
      : "No audience data available.";

    const pastDesignContext = pastDesigns.length > 0
      ? pastDesigns.map((d: any) => `- ${d.title || d.prompt}${d.trend_used ? ` (trend: ${d.trend_used})` : ""}`).join("\n")
      : "No past designs yet.";

    const trendContext = trendPrefs?.trend_enabled
      ? `Active trend: ${trendPrefs.selected_trend}, Preferred: ${(trendPrefs.preferred_trends || []).join(", ")}`
      : "No trend preferences set.";

    const productContext = products.length > 0
      ? products
          .sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
          .map((p: any, i: number) => {
          const parts = [`${i + 1}. ${p.is_featured ? "⭐ " : ""}"${p.label || "Untitled"}" (${p.product_type || "physical"}${p.price ? `, ${p.price}` : ""}${p.product_type === "service" && p.pricing_model ? `, ${p.pricing_model}` : ""}${p.product_type === "service" && p.duration ? `, ${p.duration}` : ""})`];
          if (p.description) parts.push(`— ${p.description}`);
          const featureLabel = p.product_type === "service" ? "Includes" : "Features";
          if (p.features?.length > 0) parts.push(`${featureLabel}: ${p.features.join(", ")}`);
          return parts.join(" ");
        }).join("\n")
      : "No products or services catalogued yet.";

    // Confidence-aware injection. The shared formatter tags each line with
    // [HIGH]/[MED] so the agent knows what to quote vs. what to treat as
    // soft inspiration. LOW-confidence updates are filtered upstream by
    // fetchRecentUpdates (default minTier = "medium").
    const updatesBlock = formatUpdatesForPrompt(recentUpdates);

    const fullContext = `${brandContext}\n\nPRODUCTS & SERVICES:\n${productContext}\n\nAUDIENCE INTELLIGENCE:\n${audienceContext}\n\nPAST DESIGNS:\n${pastDesignContext}\n\nTREND PREFERENCES:\n${trendContext}${updatesBlock}`;

    // --- WEEKLY GENERATION TRACKING HELPERS ---
    const getISOWeekStart = () => {
      const now = new Date();
      const day = now.getDay(); // 0=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      return monday;
    };

    const checkContentGenStatus = async () => {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("content_hub_gen_count, content_hub_gen_reset_at, generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits")
        .eq("user_id", userId)
        .single();
      if (!profile) throw new Error("Profile not found");

      const weekStart = getISOWeekStart();
      const resetAt = new Date(profile.content_hub_gen_reset_at);
      const genCount = resetAt < weekStart ? 0 : (profile.content_hub_gen_count || 0);
      const isFree = genCount === 0;

      // Calculate available credits with new model
      const FREE_MONTHLY = 5;
      const genResetAt = new Date(profile.generations_reset_at);
      const now = new Date();
      const monthReset = now.getMonth() !== genResetAt.getMonth() || now.getFullYear() !== genResetAt.getFullYear();
      const effectiveGenCount = monthReset ? 0 : profile.generations_count;
      const freeRemaining = Math.max(0, FREE_MONTHLY - effectiveGenCount);

      // Query active reward credits
      const { data: rewardRows } = await serviceClient
        .from("credit_rewards")
        .select("id, remaining")
        .eq("user_id", userId)
        .gt("remaining", 0)
        .gt("expires_at", now.toISOString())
        .order("expires_at", { ascending: true });
      const rewardCredits = (rewardRows || []).reduce((s: number, r: any) => s + r.remaining, 0);

      const availableCredits = freeRemaining + (profile.bonus_credits || 0) + rewardCredits + ((profile as any).paid_credits || 0);

      return { is_free: isFree, credits_required: isFree ? 0 : 2, available_credits: availableCredits, profile, rewardRows: rewardRows || [] };
    };

    const deductAndTrackGeneration = async (profile: any, rewardRows?: any[]) => {
      const weekStart = getISOWeekStart();
      const resetAt = new Date(profile.content_hub_gen_reset_at);
      const currentCount = resetAt < weekStart ? 0 : (profile.content_hub_gen_count || 0);

      const updates: any = {
        content_hub_gen_count: currentCount + 1,
        content_hub_gen_reset_at: new Date().toISOString(),
      };

      if (currentCount >= 1) {
        // Deduction order: free monthly → bonus → reward → paid
        const FREE_MONTHLY = 5;
        const genResetAt = new Date(profile.generations_reset_at);
        const now = new Date();
        const monthReset = now.getMonth() !== genResetAt.getMonth() || now.getFullYear() !== genResetAt.getFullYear();
        const effectiveGenCount = monthReset ? 0 : (profile.generations_count || 0);
        const freeRemaining = Math.max(0, FREE_MONTHLY - effectiveGenCount);
        const bonusCredits = profile.bonus_credits || 0;
        const paidCredits = (profile as any).paid_credits || 0;

        let remainingCost = 2;
        const freeToUse = Math.min(remainingCost, freeRemaining);
        updates.generations_count = effectiveGenCount + freeToUse;
        if (monthReset) updates.generations_reset_at = now.toISOString();
        remainingCost -= freeToUse;

        if (remainingCost > 0) {
          const bonusToUse = Math.min(remainingCost, bonusCredits);
          updates.bonus_credits = bonusCredits - bonusToUse;
          remainingCost -= bonusToUse;
        }

        // Consume reward credits (soonest-expiring first)
        if (remainingCost > 0 && rewardRows && rewardRows.length > 0) {
          for (const rw of rewardRows) {
            if (remainingCost <= 0) break;
            const toUse = Math.min(remainingCost, rw.remaining);
            await serviceClient.from("credit_rewards").update({ remaining: rw.remaining - toUse }).eq("id", rw.id);
            remainingCost -= toUse;
          }
        }

        if (remainingCost > 0) {
          updates.paid_credits = paidCredits - remainingCost;
        }
      }

      await serviceClient.from("profiles").update(updates).eq("user_id", userId);
    };

    const enforceContentGenCredits = async () => {
      const status = await checkContentGenStatus();
      if (!status.is_free && status.available_credits < 2) {
        return { blocked: true, response: new Response(JSON.stringify({ error: "Not enough credits. You need 2 credits for this generation." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
      }
      return { blocked: false, profile: status.profile, rewardRows: status.rewardRows };
    };

    // --- ACTION HANDLERS ---

    if (action === "check_content_gen_status") {
      const status = await checkContentGenStatus();
      return jsonResponse({ is_free: status.is_free, credits_required: status.credits_required, available_credits: status.available_credits });
    }

    // --- Next Best Action: deterministic recommendation engine ---
    // Reads brand signals (pillars, ideas, autopilot, holidays) and returns ONE prioritized action.
    // No AI call — fast, free, predictable. The "intelligence" is the prioritization heuristic.
    if (action === "recommend_next_action") {
      const today = new Date();
      const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

      const [pillarsRes, ideasRes, autopilotRes, lastRunRes, creditStatus] = await Promise.all([
        supabase.from("content_pillars").select("id, name").eq("brand_id", brand_id),
        supabase.from("content_ideas").select("id, status, scheduled_for, autopilot_status, autopilot, pillar_id").eq("brand_id", brand_id),
        supabase.from("autopilot_settings").select("enabled, delivery_time").eq("brand_id", brand_id).maybeSingle(),
        supabase.from("autopilot_runs").select("started_at, errors, processed").order("started_at", { ascending: false }).limit(1).maybeSingle(),
        checkContentGenStatus().catch(() => null),
      ]);

      const pillars = pillarsRes.data || [];
      const ideas = ideasRes.data || [];
      const autopilot = autopilotRes.data;
      const region = await resolveBrandRegion(supabase, brand_id);
      const upcomingHolidays = await fetchHolidayFeed(supabase, { region, days: 14 });

      const failedIdeas = ideas.filter((i: any) =>
        i.autopilot_status === "failed_no_credits" || i.autopilot_status === "failed_error"
      );
      const upcomingScheduled = ideas.filter((i: any) => {
        if (!i.scheduled_for) return false;
        const d = new Date(i.scheduled_for);
        return d >= today && d <= in14Days;
      });
      const pendingDesign = ideas.filter((i: any) => i.status !== "created").length;

      // --- Priority cascade (highest to lowest) ---
      type Action = {
        severity: "critical" | "warn" | "info" | "good";
        headline: string;
        reason: string;
        cta_label: string;
        cta_action:
          | "open_pillars"
          | "open_campaigns"
          | "open_series"
          | "generate_weekly_ideas"
          | "open_studio"
          | "enable_autopilot"
          | "topup_credits"
          | "review_failed";
        cta_payload?: Record<string, unknown>;
      };
      const candidates: Action[] = [];

      // 1. CRITICAL — Failed autopilot (out of credits)
      const noCreditFails = failedIdeas.filter((i: any) => i.autopilot_status === "failed_no_credits").length;
      if (noCreditFails > 0) {
        candidates.push({
          severity: "critical",
          headline: `${noCreditFails} autopilot post${noCreditFails > 1 ? "s" : ""} couldn't generate — out of credits`,
          reason: "Your brand depends on consistent posting. Credits are how autopilot keeps that promise.",
          cta_label: "Top up credits",
          cta_action: "topup_credits",
        });
      }

      // 2. CRITICAL — No pillars yet
      if (pillars.length === 0) {
        candidates.push({
          severity: "critical",
          headline: "No content pillars yet — your brand has no editorial spine",
          reason: "Pillars are the 3–5 themes your brand stands for. Without them, every post feels random and audiences struggle to remember why to follow you.",
          cta_label: "Generate pillars",
          cta_action: "open_pillars",
        });
      }

      // 3. WARN — Holiday in next 7 days with no scheduled content
      const soonHoliday = upcomingHolidays.find((h: any) => h.daysUntil >= 0 && h.daysUntil <= 7);
      if (soonHoliday && upcomingScheduled.length < 3) {
        candidates.push({
          severity: "warn",
          headline: `${soonHoliday.name} is coming up — and your week looks empty`,
          reason: "Audiences are already searching and talking about this moment. Brands that show up early ride that wave instead of fighting for attention from scratch.",
          cta_label: "Plan this week",
          cta_action: "generate_weekly_ideas",
        });
      }

      // 4. WARN — Autopilot off
      if (!autopilot?.enabled) {
        candidates.push({
          severity: "warn",
          headline: "Autopilot is off — your brand depends on you remembering",
          reason: "The biggest reason brands stop posting isn't strategy — it's friction. Autopilot turns content from a recurring task into a system.",
          cta_label: "Enable autopilot",
          cta_action: "enable_autopilot",
        });
      }

      // 5. WARN — Empty week (no scheduled ideas)
      if (upcomingScheduled.length === 0 && pillars.length > 0) {
        candidates.push({
          severity: "warn",
          headline: "No content scheduled for the next 14 days",
          reason: "Consistency compounds. Even 2–3 posts per week beats sporadic bursts because audiences learn when to expect you.",
          cta_label: "Generate this week's ideas",
          cta_action: "generate_weekly_ideas",
        });
      }

      // 6. INFO — Big design backlog
      if (pendingDesign >= 5) {
        candidates.push({
          severity: "info",
          headline: `${pendingDesign} ideas waiting to be designed`,
          reason: "Ideas only matter when they ship. Convert your backlog into actual posts before adding more.",
          cta_label: "Open studio",
          cta_action: "open_studio",
        });
      }

      // 7. INFO — Errored ideas (other than no-credit) ready to retry
      const errorFails = failedIdeas.filter((i: any) => i.autopilot_status === "failed_error").length;
      if (errorFails > 0 && noCreditFails === 0) {
        candidates.push({
          severity: "info",
          headline: `${errorFails} idea${errorFails > 1 ? "s" : ""} failed — ready to retry`,
          reason: "Most autopilot errors are transient (gateway hiccups). Retrying usually works.",
          cta_label: "Review failed",
          cta_action: "review_failed",
        });
      }

      // 8. GOOD — Everything healthy
      if (candidates.length === 0) {
        candidates.push({
          severity: "good",
          headline: "Your brand is on track this week",
          reason: `Pillars set, ${upcomingScheduled.length} ideas scheduled, autopilot ${autopilot?.enabled ? "running" : "ready"}. Use this calm to invest in something deeper.`,
          cta_label: "Plan a campaign",
          cta_action: "open_campaigns",
        });
      }

      const pick = candidates[0];
      return jsonResponse({
        recommendation: pick,
        signals: {
          pillars_count: pillars.length,
          scheduled_next_14d: upcomingScheduled.length,
          pending_design: pendingDesign,
          failed_no_credits: noCreditFails,
          failed_error: errorFails,
          autopilot_enabled: !!autopilot?.enabled,
          available_credits: creditStatus?.available_credits ?? null,
          upcoming_holiday: soonHoliday ? { name: soonHoliday.name, days_until: soonHoliday.daysUntil } : null,
        },
      });
    }

    if (action === "generate_pillars") {
      const creditCheck = await enforceContentGenCredits();
      if (creditCheck.blocked) return creditCheck.response;

      const result = await callAI(lovableKey, {
        system: `You are a brand content strategist. Given a brand's identity, audience, and past content, generate exactly 5 content pillars — recurring content themes that will build the brand's presence on social media. Each pillar should have a name, description, emoji icon, and a content_categories field listing which content categories this pillar serves.

${CONTENT_CATEGORIES_REF}

IMPORTANT: Each pillar should map to 1-3 content categories from the list above. The 5 pillars together MUST collectively cover at least 7 of the 10 categories. Ensure variety — don't cluster all pillars under Educational and Promotional. Be specific to this brand, not generic.`,
        user: `Generate 5 content pillars for this brand:\n\n${fullContext}`,
        tool: {
          name: "create_pillars",
          description: "Create 5 content pillars for the brand",
          parameters: {
            type: "object",
            properties: {
              pillars: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    icon_emoji: { type: "string" },
                    content_categories: { type: "string", description: "Comma-separated list of content categories this pillar covers, e.g. 'educational, social_proof'" },
                  },
                  required: ["name", "description", "icon_emoji", "content_categories"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pillars"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      // Delete existing pillars for this brand, then insert new
      await serviceClient.from("content_pillars").delete().eq("brand_id", brand_id).eq("user_id", userId);
      const pillarsToInsert = result.data.pillars.map((p: any, i: number) => ({
        brand_id,
        user_id: userId,
        name: p.name,
        description: p.description,
        icon_emoji: p.icon_emoji,
        sort_order: i,
        content_category: p.content_categories || null,
      }));
      const { data: inserted, error: insertErr } = await serviceClient.from("content_pillars").insert(pillarsToInsert).select();
      if (insertErr) throw new Error(`Insert pillars failed: ${insertErr.message}`);

      // Track generation
      await deductAndTrackGeneration(creditCheck.profile, creditCheck.rewardRows);

      return jsonResponse({ pillars: inserted });
    }

    if (action === "generate_series") {
      let creditProfile: any = null;
      let creditCheck: any = null;
      if (!skip_credit_check) {
        creditCheck = await enforceContentGenCredits();
        if (creditCheck.blocked) return creditCheck.response;
        creditProfile = creditCheck.profile;
      }

      // Fetch pillars
      const { data: pillars } = await supabase.from("content_pillars").select("*").eq("brand_id", brand_id).order("sort_order");
      const pillarContext = (pillars || []).map((p: any) => `${p.icon_emoji} ${p.name}: ${p.description}`).join("\n");

      const result = await callAI(lovableKey, {
        system: `You are a social media content strategist. Given a brand and its content pillars, generate 3-4 recurring post series. Each series is a repeating content format (e.g. "Tip Tuesday", "Customer Spotlight Sunday"). Assign each to a day of the week, a pillar, and a primary content_category.

${CONTENT_CATEGORIES_REF}

Each series should align with a specific content category. Ensure variety — avoid clustering all series under the same category. The series together should cover at least 3 different categories. Be creative and specific to this brand.`,
        user: `Generate recurring post series for this brand:\n\n${fullContext}\n\nCONTENT PILLARS:\n${pillarContext}`,
        tool: {
          name: "create_series",
          description: "Create recurring post series",
          parameters: {
            type: "object",
            properties: {
              series: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    recurrence: { type: "string", enum: ["weekly", "biweekly", "monthly"] },
                    preferred_day: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
                    pillar_name: { type: "string" },
                    visual_style_notes: { type: "string" },
                    content_category: { type: "string", enum: CONTENT_CATEGORY_ENUM },
                  },
                  required: ["name", "description", "recurrence", "preferred_day", "pillar_name", "visual_style_notes", "content_category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["series"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      await serviceClient.from("post_series").delete().eq("brand_id", brand_id).eq("user_id", userId);
      const pillarMap = new Map((pillars || []).map((p: any) => [p.name.toLowerCase(), p.id]));
      const seriesToInsert = result.data.series.map((s: any) => ({
        brand_id,
        user_id: userId,
        pillar_id: pillarMap.get(s.pillar_name.toLowerCase()) || null,
        name: s.name,
        description: s.description,
        recurrence: s.recurrence,
        preferred_day: s.preferred_day,
        visual_style_notes: s.visual_style_notes,
        content_category: s.content_category || null,
      }));
      const { data: inserted, error: insertErr } = await serviceClient.from("post_series").insert(seriesToInsert).select();
      if (insertErr) throw new Error(`Insert series failed: ${insertErr.message}`);

      if (creditProfile) await deductAndTrackGeneration(creditProfile, creditCheck?.rewardRows);

      return jsonResponse({ series: inserted });
    }

    if (action === "generate_campaigns") {
      let creditProfile: any = null;
      let creditCheck: any = null;
      if (!skip_credit_check) {
        creditCheck = await enforceContentGenCredits();
        if (creditCheck.blocked) return creditCheck.response;
        creditProfile = creditCheck.profile;
      }

      const result = await callAI(lovableKey, {
        system: `You are a brand campaign strategist. Generate 2-3 campaign ideas for this brand. Each campaign should have a catchy name, description, post count (3-7 posts), and a primary content_category.

${CONTENT_CATEGORIES_REF}

Each campaign should target a specific content category. Vary categories across campaigns — e.g. one promotional campaign, one social proof campaign, one announcement campaign. Be specific and seasonal/topical.`,
        user: `Generate campaign ideas:\n\n${fullContext}`,
        tool: {
          name: "create_campaigns",
          description: "Create campaign ideas",
          parameters: {
            type: "object",
            properties: {
              campaigns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    post_count: { type: "number" },
                    content_category: { type: "string", enum: CONTENT_CATEGORY_ENUM },
                  },
                  required: ["name", "description", "post_count", "content_category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["campaigns"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      await serviceClient.from("campaigns").delete().eq("brand_id", brand_id).eq("user_id", userId);
      const campaignsToInsert = result.data.campaigns.map((c: any) => ({
        brand_id,
        user_id: userId,
        name: c.name,
        description: c.description,
        post_count: c.post_count,
        content_category: c.content_category || null,
      }));
      const { data: inserted, error: insertErr } = await serviceClient.from("campaigns").insert(campaignsToInsert).select();
      if (insertErr) throw new Error(`Insert campaigns failed: ${insertErr.message}`);

      if (creditProfile) await deductAndTrackGeneration(creditProfile, creditCheck?.rewardRows);

      return jsonResponse({ campaigns: inserted });
    }

    if (action === "generate_weekly_ideas") {
      let creditProfile: any = null;
      let creditCheck: any = null;
      if (!skip_credit_check) {
        creditCheck = await enforceContentGenCredits();
        if (creditCheck.blocked) return creditCheck.response;
        creditProfile = creditCheck.profile;
      }

      const [pillarsRes, seriesRes, campaignsRes, trendIntelRes, recentIdeasRes] = await Promise.all([
        // Order least-recently-used pillars first so the AI naturally rotates them.
        supabase
          .from("content_pillars")
          .select("*")
          .eq("brand_id", brand_id)
          .order("last_used_at", { ascending: true, nullsFirst: true })
          .order("sort_order"),
        supabase.from("post_series").select("*").eq("brand_id", brand_id),
        supabase.from("campaigns").select("*").eq("brand_id", brand_id),
        supabase.from("brand_trend_intel").select("trends_data, generated_at").eq("brand_id", brand_id).maybeSingle(),
        (() => {
          // Widen to 28 days and pull title + prompt so the planner can avoid
          // repeating recent topics — not just recent categories.
          const since = new Date();
          since.setDate(since.getDate() - 28);
          return supabase
            .from("content_ideas")
            .select("title, prompt, content_category, scheduled_for, created_at, pillar_id")
            .eq("brand_id", brand_id)
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: false })
            .limit(60);
        })(),
      ]);

      const pillars = pillarsRes.data || [];
      const series = seriesRes.data || [];
      const campaigns = campaignsRes.data || [];

      const pillarContext = pillars
        .map((p: any) => {
          const lu = p.last_used_at ? ` (last used ${new Date(p.last_used_at).toISOString().split("T")[0]})` : " (never used — PRIORITISE)";
          return `${p.icon_emoji} ${p.name}: ${p.description}${lu}`;
        })
        .join("\n");
      const seriesContext = series.map((s: any) => `${s.name} (${s.recurrence}, ${s.preferred_day}): ${s.description}`).join("\n");
      const campaignContext = campaigns.map((c: any) => `${c.name}: ${c.description} (${c.post_count} posts)`).join("\n");


      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      // Apply week_offset if provided
      const offset = typeof week_offset === "number" ? week_offset : 0;
      monday.setDate(monday.getDate() + offset * 7);
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const weekDates = days.map((d, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return { day: d, date: date.toISOString().split("T")[0] };
      });

      // --- Holiday detection (live Firecrawl feed, brand-region aware) ---
      const brandRegion = await resolveBrandRegion(supabase, brand_id);
      const weekHolidays = await getWeekHolidaysAsync(supabase, monday, brandRegion);

      const holidayContext = weekHolidays.length > 0
        ? `\n\nHOLIDAYS THIS WEEK:\n${weekHolidays.map(h => `- ${h.name} (${h.date.toISOString().split("T")[0]}, ${h.region}) — ${h.content_type} content`).join("\n")}\nIMPORTANT: Generate at least one idea themed around each holiday. Tag holiday ideas with idea_type "holiday".`
        : "";

      // Inject trend intel if available
      const trendIntel = trendIntelRes.data;
      const trendIntelContext = trendIntel?.trends_data && Array.isArray(trendIntel.trends_data) && trendIntel.trends_data.length > 0
        ? `\n\nINDUSTRY TREND INTELLIGENCE (use these to inform content angles):\n${(trendIntel.trends_data as any[]).map((t: any) => `- ${t.title}: ${t.summary}`).join("\n")}`
        : "";

      // --- Last-2-weeks coverage gap analysis ---
      const recentIdeas = recentIdeasRes.data || [];
      const recentCounts: Record<string, number> = {};
      for (const cat of CONTENT_CATEGORY_ENUM) recentCounts[cat] = 0;
      for (const r of recentIdeas) {
        const c = (r as any).content_category;
        if (c && Object.prototype.hasOwnProperty.call(recentCounts, c)) recentCounts[c] += 1;
      }
      const missingCategories = CONTENT_CATEGORY_ENUM.filter(c => recentCounts[c] === 0);
      const underusedCategories = CONTENT_CATEGORY_ENUM
        .filter(c => recentCounts[c] > 0 && recentCounts[c] <= 1)
        .sort((a, b) => recentCounts[a] - recentCounts[b]);
      const overusedCategories = CONTENT_CATEGORY_ENUM
        .filter(c => recentCounts[c] >= 3)
        .sort((a, b) => recentCounts[b] - recentCounts[a]);

      const coverageContext = `\n\nLAST 2 WEEKS — CATEGORY COVERAGE:\n${CONTENT_CATEGORY_ENUM.map(c => `- ${c}: ${recentCounts[c]}`).join("\n")}\n${missingCategories.length > 0 ? `\nMISSING (0 posts in last 14 days — PRIORITIZE THESE): ${missingCategories.join(", ")}` : ""}${underusedCategories.length > 0 ? `\nUNDERUSED (1 post in last 14 days — favor these): ${underusedCategories.join(", ")}` : ""}${overusedCategories.length > 0 ? `\nOVERUSED (3+ posts in last 14 days — minimize these): ${overusedCategories.join(", ")}` : ""}`;

      // Topic-level repetition guard: surface the most recent idea titles so the
      // AI doesn't re-invent the same concept week after week with a new wrapper.
      const recentTitles = recentIdeas
        .slice(0, 30)
        .map((r: any) => `- "${r.title}"${r.content_category ? ` [${r.content_category}]` : ""}`)
        .join("\n");
      const recentTitlesContext = recentTitles
        ? `\n\nRECENT IDEAS (last 28 days) — DO NOT REPEAT OR PARAPHRASE THESE TOPICS. Pick fresh angles, different hooks, different formats:\n${recentTitles}`
        : "";


      const result = await callAI(lovableKey, {
        system: `You are a social media content planner and format strategist. Generate 5-7 post ideas for this week. Each idea should have a title, a ready-to-use design prompt (that can be sent directly to an AI design studio), and be assigned to a specific day. Use the brand's content pillars, series, and campaigns to inform the ideas. The prompts should be specific, mentioning the brand name and what the graphic should show. If a campaign is relevant, include the campaign_name field matching the exact campaign name provided.

${CONTENT_CATEGORIES_REF}

CRITICAL — CONTENT CATEGORY ASSIGNMENT:
Each idea MUST be assigned a content_category. The value MUST be exactly one of: ${CONTENT_CATEGORY_ENUM.join(", ")}. No other values are accepted.

CRITICAL — WEEKLY CATEGORY DIVERSITY:
This week's ideas MUST collectively cover at least 6 of the 10 content categories. Do NOT assign more than 2 ideas to the same category in a single week. Aim for maximum variety across the week.

CRITICAL — COVERAGE GAP CORRECTION:
Use the LAST 2 WEEKS coverage data below to actively rebalance the brand's content mix:
- ALWAYS include at least one idea from each MISSING category (when relevant to the brand).
- Favor UNDERUSED categories over repeating recent ones.
- AVOID OVERUSED categories unless tied to a holiday, campaign, or recurring series for this week.

Use the content category to determine the visual approach and copy tone in the design prompt:
- Announcement → bold, high-energy headline prompt
- Educational → structured, tip-based prompt with clear hierarchy
- Promotional → CTA-forward, offer-driven prompt
- Entertainment → playful, relatable, scroll-stopping prompt
- Social Proof → testimonial/quote-driven prompt
- BTS → authentic, candid, behind-the-scenes prompt
- Interactive → question-driven, engagement-focused prompt

CRITICAL — CONTENT FORMAT ASSIGNMENT:
You MUST assign a content_format to each idea based on the content type and pillar. Use this expert mapping:
- "carousel" → Educational, How-to, Tips & Tricks, Storytelling, Case Study, Product Showcase, Step-by-step guides, Listicles, Before/After
- "graphic" → Promotional, Sales, Announcements, Testimonials, Quotes, Engagement/Interactive, Inspirational, UGC/Community, Single visual CTA, Behind the Scenes, Process highlights, Culture/Team, Event/Recap

Choose the format that best serves the content's PURPOSE, not just its pillar label. Educational content works best as carousels (swipeable learning). All other content works best as single graphics or carousels. Do NOT assign "video" format.

HOLIDAY IDEAS: If holidays are listed, generate at least one idea per holiday with idea_type "holiday" and content_category "holidays". Holiday ideas should feel authentic to the brand, not generic "Happy [Holiday]" posts.

TREND INTELLIGENCE: If industry trends are provided, weave them naturally into content ideas where relevant. Don't force every trend into every idea.`,
        user: `Generate this week's content ideas:\n\n${fullContext}\n\nPILLARS (ordered least-recently-used first — favour those that haven't been used in a while):\n${pillarContext}\n\nSERIES:\n${seriesContext}\n\nCAMPAIGNS:\n${campaignContext}\n\nWEEK DATES: ${weekDates.map(d => `${d.day}: ${d.date}`).join(", ")}${holidayContext}${trendIntelContext}${coverageContext}${recentTitlesContext}`,
        tool: {
          name: "create_weekly_ideas",
          description: "Create post ideas for the week",
          parameters: {
            type: "object",
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    prompt: { type: "string" },
                    day: { type: "string", enum: days },
                    pillar_name: { type: "string" },
                    series_name: { type: "string" },
                    campaign_name: { type: "string" },
                    idea_type: { type: "string", enum: ["single", "series_post", "campaign_post", "holiday"] },
                    content_format: { type: "string", enum: ["graphic", "carousel"] },
                    slide_count: { type: "integer", minimum: 2, maximum: 10, description: "Use when content_format is 'carousel' (default 5)." },
                    content_category: { type: "string", enum: CONTENT_CATEGORY_ENUM },
                  },
                  required: ["title", "prompt", "day", "pillar_name", "idea_type", "content_format", "content_category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ideas"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      // Delete existing suggested ideas for this week
      const weekStart = weekDates[0].date;
      const weekEnd = weekDates[6].date;
      await serviceClient.from("content_ideas").delete()
        .eq("brand_id", brand_id)
        .eq("user_id", userId)
        .eq("status", "suggested")
        .gte("scheduled_for", weekStart)
        .lte("scheduled_for", weekEnd);

      const pillarMap = new Map(pillars.map((p: any) => [p.name.toLowerCase(), p.id]));
      const seriesMap = new Map(series.map((s: any) => [s.name.toLowerCase(), s.id]));
      const campaignMap = new Map(campaigns.map((c: any) => [c.name.toLowerCase(), c.id]));
      const dateMap = new Map(weekDates.map((d) => [d.day, d.date]));
      const dayIndex = new Map(weekDates.map((d, i) => [d.day, i])); // monday=0..sunday=6

      // Auto-enrol into autopilot if brand has autopilot enabled
      const { data: apSettings } = await serviceClient
        .from("autopilot_settings")
        .select("enabled")
        .eq("brand_id", brand_id)
        .maybeSingle();
      const autopilotOn = !!apSettings?.enabled;

      // Ensure a weekly_blueprints row exists so ideas link to a real plan-of-record.
      const blueprintId = await ensureBlueprint(serviceClient, brand_id, userId, weekStart);

      const ideasToInsert = result.data.ideas.map((idea: any) => {
        const format = forceCarouselFormat(idea.content_format, idea.content_category, idea.pillar_name);
        const slides = format === "carousel" ? clampSlideCount(idea.slide_count) : null;
        const dIdx = dayIndex.get(idea.day);
        const arc = typeof dIdx === "number" ? WEEK_ARC[dIdx] : null;
        return {
          brand_id,
          user_id: userId,
          blueprint_id: blueprintId,
          pillar_id: pillarMap.get((idea.pillar_name || "").toLowerCase()) || null,
          series_id: idea.series_name ? seriesMap.get(idea.series_name.toLowerCase()) || null : null,
          campaign_id: idea.campaign_name ? campaignMap.get(idea.campaign_name.toLowerCase()) || null : null,
          title: idea.title,
          prompt: idea.prompt,
          idea_type: idea.idea_type,
          content_format: format,
          slide_count: slides,
          content_category: CONTENT_CATEGORY_ENUM.includes(idea.content_category) ? idea.content_category : null,
          status: "suggested",
          scheduled_for: dateMap.get(idea.day) || null,
          day_of_week: typeof dIdx === "number" ? dIdx : null,
          strategic_arc: arc,
          playbook_role: arc,
          autopilot: autopilotOn,
        };
      });

      const { data: inserted, error: insertErr } = await serviceClient.from("content_ideas").insert(ideasToInsert).select();
      if (insertErr) throw new Error(`Insert ideas failed: ${insertErr.message}`);

      if (creditProfile) await deductAndTrackGeneration(creditProfile, creditCheck?.rewardRows);

      return jsonResponse({ ideas: inserted });
    }

    if (action === "fill_empty_days") {
      // Additive: generate ONE idea per empty day in the target week. Never deletes existing.
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      const offset = typeof week_offset === "number" ? week_offset : 0;
      monday.setDate(monday.getDate() + offset * 7);
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const weekDates = days.map((d, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return { day: d, date: date.toISOString().split("T")[0] };
      });
      const weekStart = weekDates[0].date;
      const weekEnd = weekDates[6].date;

      // Find which days already have ideas
      const { data: existing } = await supabase
        .from("content_ideas")
        .select("scheduled_for")
        .eq("brand_id", brand_id)
        .gte("scheduled_for", weekStart)
        .lte("scheduled_for", weekEnd);
      const filledDates = new Set((existing || []).map((r: any) => r.scheduled_for));
      let emptyDays = weekDates.filter((d) => !filledDates.has(d.date));

      // Optional caller restriction (e.g. fill a single day)
      if (Array.isArray(target_days) && target_days.length > 0) {
        const set = new Set(target_days);
        emptyDays = emptyDays.filter((d) => set.has(d.day));
      }

      if (emptyDays.length === 0) {
        return jsonResponse({ ideas: [], filled: 0, message: "No empty days to fill." });
      }

      let creditProfile: any = null;
      let creditCheck: any = null;
      if (!skip_credit_check) {
        creditCheck = await enforceContentGenCredits();
        if (creditCheck.blocked) return creditCheck.response;
        creditProfile = creditCheck.profile;
      }

      const [pillarsRes, seriesRes, campaignsRes, recentIdeasRes] = await Promise.all([
        supabase.from("content_pillars").select("*").eq("brand_id", brand_id).order("sort_order"),
        supabase.from("post_series").select("*").eq("brand_id", brand_id),
        supabase.from("campaigns").select("*").eq("brand_id", brand_id),
        (() => {
          const since = new Date();
          since.setDate(since.getDate() - 14);
          return supabase
            .from("content_ideas")
            .select("content_category, title")
            .eq("brand_id", brand_id)
            .gte("created_at", since.toISOString());
        })(),
      ]);
      const pillars = pillarsRes.data || [];
      const series = seriesRes.data || [];
      const campaigns = campaignsRes.data || [];
      const pillarContext = pillars.map((p: any) => `${p.icon_emoji || ""} ${p.name}: ${p.description || ""}`).join("\n");
      const seriesContext = series.map((s: any) => `${s.name} (${s.recurrence}, ${s.preferred_day}): ${s.description || ""}`).join("\n");
      const campaignContext = campaigns.map((c: any) => `${c.name}: ${c.description || ""}`).join("\n");

      const recent = recentIdeasRes.data || [];
      const recentTitles = recent.slice(0, 30).map((r: any) => r.title).filter(Boolean).join(" | ");
      const recentCounts: Record<string, number> = {};
      for (const cat of CONTENT_CATEGORY_ENUM) recentCounts[cat] = 0;
      for (const r of recent) {
        const c = (r as any).content_category;
        if (c && Object.prototype.hasOwnProperty.call(recentCounts, c)) recentCounts[c] += 1;
      }
      const missing = CONTENT_CATEGORY_ENUM.filter((c) => recentCounts[c] === 0);

      // Holidays for the week — bias empty days that match a holiday
      const weekHolidays = await getWeekHolidaysAsync(supabase, monday, await resolveBrandRegion(supabase, brand_id));
      const holidayByDay: Record<string, string> = {};
      for (const h of weekHolidays) {
        const d = new Date(h.date);
        const idx = (d.getDay() + 6) % 7;
        holidayByDay[days[idx]] = h.name;
      }

      const targetSpec = emptyDays
        .map((d) => `- ${d.day} (${d.date})${holidayByDay[d.day] ? ` — HOLIDAY: ${holidayByDay[d.day]}` : ""}`)
        .join("\n");

      const result = await callAI(lovableKey, {
        system: `You are a social media content planner. Generate exactly ONE post idea for EACH listed empty day. Do not repeat or rephrase the recent titles provided. Maximize category variety, prioritising categories that are missing from the last 14 days when relevant to the brand.

${CONTENT_CATEGORIES_REF}

Each idea MUST include a content_category from: ${CONTENT_CATEGORY_ENUM.join(", ")}.
Holiday days MUST use idea_type "holiday" and content_category "holidays".
Use content_format "carousel" only for educational/how-to/listicle/step-by-step ideas; otherwise "graphic". Never "video".`,
        user: `Brand: ${brand.name}\n\nFILL THESE EMPTY DAYS (one idea per day, in order):\n${targetSpec}\n\nPILLARS:\n${pillarContext}\n\nSERIES:\n${seriesContext}\n\nCAMPAIGNS:\n${campaignContext}\n\nMISSING CATEGORIES (last 14 days — prioritise): ${missing.join(", ") || "none"}\nRECENT TITLES (do NOT repeat): ${recentTitles || "none"}`,
        tool: {
          name: "fill_days",
          description: "Create one idea per empty day",
          parameters: {
            type: "object",
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    prompt: { type: "string" },
                    day: { type: "string", enum: days },
                    pillar_name: { type: "string" },
                    series_name: { type: "string" },
                    campaign_name: { type: "string" },
                    idea_type: { type: "string", enum: ["single", "series_post", "campaign_post", "holiday"] },
                    content_format: { type: "string", enum: ["graphic", "carousel"] },
                    slide_count: { type: "integer", minimum: 2, maximum: 10, description: "Use when content_format is 'carousel' (default 5)." },
                    content_category: { type: "string", enum: CONTENT_CATEGORY_ENUM },
                  },
                  required: ["title", "prompt", "day", "idea_type", "content_format", "content_category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ideas"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      const pillarMap = new Map(pillars.map((p: any) => [p.name.toLowerCase(), p.id]));
      const seriesMap = new Map(series.map((s: any) => [s.name.toLowerCase(), s.id]));
      const campaignMap = new Map(campaigns.map((c: any) => [c.name.toLowerCase(), c.id]));
      const dateMap = new Map(weekDates.map((d) => [d.day, d.date]));
      const dayIndex = new Map(weekDates.map((d, i) => [d.day, i]));
      const allowedDays = new Set(emptyDays.map((d) => d.day));

      const { data: apSettings } = await serviceClient
        .from("autopilot_settings")
        .select("enabled")
        .eq("brand_id", brand_id)
        .maybeSingle();
      const autopilotOn = !!apSettings?.enabled;

      const blueprintId = await ensureBlueprint(serviceClient, brand_id, userId, weekStart);

      const ideasToInsert = (result.data.ideas || [])
        .filter((idea: any) => allowedDays.has(idea.day))
        .map((idea: any) => {
          const format = forceCarouselFormat(idea.content_format, idea.content_category, idea.pillar_name);
          const slides = format === "carousel" ? clampSlideCount(idea.slide_count) : null;
          const dIdx = dayIndex.get(idea.day);
          const arc = typeof dIdx === "number" ? WEEK_ARC[dIdx] : null;
          return {
            brand_id,
            user_id: userId,
            blueprint_id: blueprintId,
            pillar_id: pillarMap.get((idea.pillar_name || "").toLowerCase()) || null,
            series_id: idea.series_name ? seriesMap.get(idea.series_name.toLowerCase()) || null : null,
            campaign_id: idea.campaign_name ? campaignMap.get(idea.campaign_name.toLowerCase()) || null : null,
            title: idea.title,
            prompt: idea.prompt,
            idea_type: idea.idea_type,
            content_format: format,
            slide_count: slides,
            content_category: CONTENT_CATEGORY_ENUM.includes(idea.content_category) ? idea.content_category : null,
            status: "suggested",
            scheduled_for: dateMap.get(idea.day) || null,
            day_of_week: typeof dIdx === "number" ? dIdx : null,
            strategic_arc: arc,
            playbook_role: arc,
            autopilot: autopilotOn,
          };
        });

      let inserted: any[] = [];
      if (ideasToInsert.length > 0) {
        const { data, error: insertErr } = await serviceClient.from("content_ideas").insert(ideasToInsert).select();
        if (insertErr) throw new Error(`Insert ideas failed: ${insertErr.message}`);
        inserted = data || [];
      }

      if (creditProfile && inserted.length > 0) await deductAndTrackGeneration(creditProfile, creditCheck?.rewardRows);

      return jsonResponse({ ideas: inserted, filled: inserted.length });
    }

    if (action === "categorize_existing") {
      // Backfill content_category for legacy rows where it's NULL.
      // Free action — no credit deduction. Caps per call to keep prompt size sane.
      const PER_TABLE_LIMIT = 40;

      const [pillarsNull, seriesNull, campaignsNull, ideasNull] = await Promise.all([
        supabase.from("content_pillars").select("id, name, description")
          .eq("brand_id", brand_id).is("content_category", null).limit(PER_TABLE_LIMIT),
        supabase.from("post_series").select("id, name, description")
          .eq("brand_id", brand_id).is("content_category", null).limit(PER_TABLE_LIMIT),
        supabase.from("campaigns").select("id, name, description")
          .eq("brand_id", brand_id).is("content_category", null).limit(PER_TABLE_LIMIT),
        supabase.from("content_ideas").select("id, title, prompt, idea_type")
          .eq("brand_id", brand_id).is("content_category", null).limit(PER_TABLE_LIMIT),
      ]);

      const items: Array<{ kind: string; id: string; text: string }> = [];
      for (const p of pillarsNull.data || []) items.push({ kind: "pillar", id: p.id, text: `${p.name}: ${p.description || ""}` });
      for (const s of seriesNull.data || []) items.push({ kind: "series", id: s.id, text: `${s.name}: ${s.description || ""}` });
      for (const c of campaignsNull.data || []) items.push({ kind: "campaign", id: c.id, text: `${c.name}: ${c.description || ""}` });
      for (const i of ideasNull.data || []) items.push({ kind: "idea", id: i.id, text: `${i.title}${i.idea_type === "holiday" ? " [holiday]" : ""}: ${i.prompt || ""}` });

      if (items.length === 0) {
        return jsonResponse({ updated: 0, processed: 0, remaining_in_batch: 0, more_available: false, message: "Nothing to categorize." });
      }

      const result = await callAI(lovableKey, {
        system: `You are a content classifier. For each item, assign exactly ONE content_category from the enum.

${CONTENT_CATEGORIES_REF}

Rules:
- The category id MUST be one of: ${CONTENT_CATEGORY_ENUM.join(", ")}.
- For pillars, pick the dominant category if it spans several.
- Items tagged [holiday] should be categorized as "holidays".
- Match the item's intent, not just keywords.
- Return one classification per input item, preserving order.`,
        user: `Classify each item below and return its content_category.\n\nBrand: ${brand.name}\n\nITEMS:\n${items.map((it, i) => `${i + 1}. [${it.kind}] ${it.text}`).join("\n")}`,
        tool: {
          name: "classify_items",
          description: "Assign a content_category to each item",
          parameters: {
            type: "object",
            properties: {
              classifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number", description: "1-based index of the item" },
                    content_category: { type: "string", enum: CONTENT_CATEGORY_ENUM },
                  },
                  required: ["index", "content_category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["classifications"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      const tableMap: Record<string, string> = {
        pillar: "content_pillars",
        series: "post_series",
        campaign: "campaigns",
        idea: "content_ideas",
      };

      let updated = 0;
      for (const cls of result.data.classifications || []) {
        const item = items[cls.index - 1];
        if (!item) continue;
        if (!CONTENT_CATEGORY_ENUM.includes(cls.content_category)) continue;
        const table = tableMap[item.kind];
        if (!table) continue;
        const { error: updErr } = await serviceClient
          .from(table)
          .update({ content_category: cls.content_category })
          .eq("id", item.id)
          .is("content_category", null); // safety: don't overwrite
        if (!updErr) updated += 1;
      }

      return jsonResponse({
        updated,
        processed: items.length,
        remaining_in_batch: items.length - updated,
        more_available:
          (pillarsNull.data?.length || 0) === PER_TABLE_LIMIT ||
          (seriesNull.data?.length || 0) === PER_TABLE_LIMIT ||
          (campaignsNull.data?.length || 0) === PER_TABLE_LIMIT ||
          (ideasNull.data?.length || 0) === PER_TABLE_LIMIT,
      });
    }

    if (action === "plan_from_updates") {
      // One-tap: turn the user's recent Updates into a draft of suggested content ideas.
      // Free action — no credit deduction (small, targeted, ≤5 ideas, status=suggested only).
      //
      // Confidence-aware:
      //   • HIGH/MED updates → become drafted ideas the AI can build on.
      //   • LOW updates      → become follow-up questions returned to the
      //                        user instead of forcing weak content.

      // Pull ALL active updates (not just the medium-tier prompt set) so we
      // can also raise follow-ups for the LOW ones.
      const allUpdates = await fetchAllUpdatesForPlanning(supabase, brand_id, 60, 25);
      if (!allUpdates || allUpdates.length === 0) {
        return new Response(
          JSON.stringify({ error: "No recent updates to plan from. Add an update first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const planEligible = allUpdates
        .filter((u) => tierFor(u.confidence) !== "low")
        .slice(0, 8);
      const lowConfidence = allUpdates
        .filter((u) => tierFor(u.confidence) === "low")
        .slice(0, 5);

      // No ideas-eligible updates? Return follow-ups only so the user knows
      // what to flesh out before planning will work.
      if (planEligible.length === 0) {
        const followUpsOnly = lowConfidence.map((u) => ({
          update_id: u.id,
          update_title: u.title || u.content.slice(0, 60),
          update_type: u.update_type,
          confidence: u.confidence ?? 0,
          missing_fields: Array.isArray(u.missing_fields) ? u.missing_fields.slice(0, 4) : [],
          question: buildFollowUpQuestion(u),
        }));
        return jsonResponse({
          ideas: [],
          count: 0,
          updates_used: 0,
          follow_ups: followUpsOnly,
          message: "Your updates need more detail before the AI can draft solid posts. Answer a couple of follow-ups and try again.",
        });
      }

      const updatesList = planEligible
        .map((u: any, i: number) => {
          const tier = tierFor(u.confidence).toUpperCase();
          const conf = typeof u.confidence === "number" ? u.confidence : "?";
          const attr = u.attribution ? ` — ${u.attribution}` : "";
          const body = u.content?.trim() ? ` :: ${u.content.trim().slice(0, 280)}` : "";
          const gaps =
            Array.isArray(u.missing_fields) && u.missing_fields.length > 0
              ? ` :: missing → ${u.missing_fields.slice(0, 3).join(", ")}`
              : "";
          return `${i + 1}. id=${u.id} | tier=${tier} (conf=${conf}) | type=${u.update_type} | date=${u.event_date} | ${u.title || u.content.slice(0, 60)}${attr}${body}${gaps}`;
        })
        .join("\n");

      const result = await callAI(lovableKey, {
        system: `You are a social media content planner. Convert each provided business UPDATE into ONE on-brand post idea.

${CONTENT_CATEGORIES_REF}

CRITICAL RULES:
- Generate exactly ONE idea per update (max 5 ideas total — pick the strongest if more provided).
- Each idea MUST reference the real update (no invented testimonials, events, or figures).
- Assign a content_category from this enum ONLY: ${CONTENT_CATEGORY_ENUM.join(", ")}.
- Strong defaults by update type:
  • testimonial / customer_story / press / milestone → "social_proof"
  • event / csr → "bts" (or "holidays" if explicitly tied to a holiday)
  • product / partnership → "announcement" (use "promotional" if it's a clear sales offer)
  • other → pick the most natural fit.
- content_format: "carousel" only for clearly multi-point updates (lists, step-by-step, multi-quote). Otherwise "graphic".
- title: punchy, ≤ 60 chars.
- prompt: a ready-to-use design prompt mentioning the brand and what the graphic should show, grounded in the update's actual facts.
- Reference the source update by its id in source_update_id.

CONFIDENCE-AWARE WRITING:
Each update is tagged with a tier — read it before drafting:
  • [HIGH] (conf ≥ 75): the update is specific and verified. Quote the names, numbers, dates, and quotes that exist on it. The post can be concrete and committal.
  • [MED]  (conf 45–74): the update is thin or partial. Write at the THEMATIC level only. NEVER invent specific names, numbers, dates, outcomes, or quotes that aren't in the update. The "missing → ..." hint tells you what facts are absent — keep the prompt abstract around those gaps. If a great post would require a fact you don't have, say so in needs_user_input and lower draft_confidence.
- For each idea, also output:
  • draft_confidence (0–100): how confident YOU are this draft is publish-ready as-is.
  • needs_user_input (string[]): up to 3 short phrases the user should confirm or fill in BEFORE generating (e.g. "exact discount %", "customer first name", "event location"). Empty array if nothing is needed.

FOLLOW-UPS:
For any LOW-confidence updates supplied separately, propose ONE short, plain-language question per update that, if answered, would let the AI plan a strong post next time. Reference what's already known so the user doesn't repeat themselves.`,
        user: `Brand context:\n${brandContext}\n\nPRODUCTS & SERVICES:\n${productContext}\n\nAUDIENCE INTELLIGENCE:\n${audienceContext}\n\nUPDATES TO PLAN FROM (HIGH/MED only):\n${updatesList}${
          lowConfidence.length > 0
            ? `\n\nLOW-CONFIDENCE UPDATES (do NOT plan ideas for these — produce a single short follow-up question per item under follow_ups instead):\n${lowConfidence
                .map(
                  (u: any, i: number) =>
                    `${i + 1}. id=${u.id} | type=${u.update_type} | conf=${u.confidence ?? 0} | ${u.title || u.content.slice(0, 60)}${u.content?.trim() ? ` :: ${u.content.trim().slice(0, 200)}` : ""}${
                      Array.isArray(u.missing_fields) && u.missing_fields.length > 0
                        ? ` :: missing → ${u.missing_fields.slice(0, 3).join(", ")}`
                        : ""
                    }`,
                )
                .join("\n")}`
            : ""
        }`,
        tool: {
          name: "plan_ideas_from_updates",
          description: "Create draft post ideas for HIGH/MED updates and follow-up questions for LOW updates.",
          parameters: {
            type: "object",
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    source_update_id: { type: "string" },
                    title: { type: "string" },
                    prompt: { type: "string" },
                    content_format: { type: "string", enum: ["graphic", "carousel"] },
                    content_category: { type: "string", enum: CONTENT_CATEGORY_ENUM },
                    draft_confidence: { type: "integer", minimum: 0, maximum: 100 },
                    needs_user_input: {
                      type: "array",
                      items: { type: "string" },
                      description: "Short specifics the user should confirm before generating. Empty if none.",
                    },
                  },
                  required: [
                    "source_update_id",
                    "title",
                    "prompt",
                    "content_format",
                    "content_category",
                    "draft_confidence",
                    "needs_user_input",
                  ],
                  additionalProperties: false,
                },
              },
              follow_ups: {
                type: "array",
                description: "One short question per LOW-confidence update.",
                items: {
                  type: "object",
                  properties: {
                    update_id: { type: "string" },
                    question: { type: "string" },
                  },
                  required: ["update_id", "question"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ideas", "follow_ups"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      const validIds = new Set(planEligible.map((u: any) => u.id));
      const updateById = new Map(planEligible.map((u: any) => [u.id, u]));
      const ideasToInsert = (result.data.ideas || [])
        .filter((idea: any) => validIds.has(idea.source_update_id))
        .slice(0, 5)
        .map((idea: any) => {
          const src: any = updateById.get(idea.source_update_id);
          const srcConf = typeof src?.confidence === "number" ? src.confidence : 60;
          const draftConf = typeof idea.draft_confidence === "number" ? idea.draft_confidence : srcConf;
          // Cap draft confidence at the source's confidence — the post can't
          // be more reliable than its seed.
          const finalConf = Math.max(0, Math.min(100, Math.min(draftConf, srcConf)));
          const needs = Array.isArray(idea.needs_user_input)
            ? idea.needs_user_input.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 3)
            : [];
          // Soft-prefix the prompt with the user-input checklist when MED.
          const promptWithGuard =
            tierFor(srcConf) === "medium" && needs.length > 0
              ? `${idea.prompt}\n\nBefore rendering, confirm with the user: ${needs.join("; ")}.`
              : idea.prompt;
          return {
            brand_id,
            user_id: userId,
            title: idea.title,
            prompt: promptWithGuard,
            idea_type: "single",
            content_format: idea.content_format || "graphic",
            content_category: CONTENT_CATEGORY_ENUM.includes(idea.content_category)
              ? idea.content_category
              : null,
            status: "suggested",
            scheduled_for: null,
            // surfaced back to caller (not persisted unless schema supports)
            _draft_confidence: finalConf,
            _needs_user_input: needs,
          };
        });

      // Strip transport-only fields before insert
      const dbRows = ideasToInsert.map(({ _draft_confidence: _dc, _needs_user_input: _nui, ...row }: any) => row);

      if (dbRows.length === 0 && lowConfidence.length === 0) {
        return new Response(
          JSON.stringify({ error: "Couldn't draft ideas from those updates. Try adding more detail and retry." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let inserted: any[] = [];
      if (dbRows.length > 0) {
        const { data, error: insertErr } = await serviceClient
          .from("content_ideas")
          .insert(dbRows)
          .select();
        if (insertErr) throw new Error(`Insert ideas failed: ${insertErr.message}`);
        inserted = data || [];
      }

      // Combine model-supplied follow-ups with deterministic fallbacks for any
      // LOW-confidence updates the model skipped.
      const modelFollowUps = Array.isArray(result.data.follow_ups) ? result.data.follow_ups : [];
      const followUpById = new Map<string, string>(
        modelFollowUps
          .filter((f: any) => f && typeof f.update_id === "string" && typeof f.question === "string")
          .map((f: any) => [f.update_id, f.question.trim().slice(0, 200)] as [string, string]),
      );
      const followUps = lowConfidence.map((u) => ({
        update_id: u.id,
        update_title: u.title || u.content.slice(0, 60),
        update_type: u.update_type,
        confidence: u.confidence ?? 0,
        missing_fields: Array.isArray(u.missing_fields) ? u.missing_fields.slice(0, 4) : [],
        question: followUpById.get(u.id) || buildFollowUpQuestion(u),
      }));

      // Mark the source updates as used (fire-and-forget).
      const usedIds = Array.from(
        new Set(
          (result.data.ideas || [])
            .map((i: any) => i.source_update_id)
            .filter((id: any) => validIds.has(id)),
        ),
      ) as string[];
      markUpdatesUsed(serviceClient, usedIds).catch(() => {});

      // Attach per-idea draft metadata onto the response so the client can
      // show "needs your input" badges.
      const enrichedIdeas = inserted.map((row) => {
        const meta = ideasToInsert.find((i: any) => i.title === row.title && i.prompt.startsWith(row.prompt.split("\n\nBefore")[0]));
        return {
          ...row,
          draft_confidence: meta?._draft_confidence ?? null,
          needs_user_input: meta?._needs_user_input ?? [],
        };
      });

      return jsonResponse({
        ideas: enrichedIdeas,
        count: inserted.length,
        updates_used: usedIds.length,
        follow_ups: followUps,
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("brand-engine error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- HELPERS ---

async function callAI(apiKey: string, opts: { system: string; user: string; tool: any }): Promise<{ data?: any; error?: string; status?: number }> {
  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      tools: [{ type: "function", function: opts.tool }],
      tool_choice: { type: "function", function: { name: opts.tool.name } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return { error: "Rate limit exceeded. Please try again in a moment.", status: 429 };
    if (response.status === 402) return { error: "AI service temporarily unavailable. Please try again.", status: 503 };
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    return { error: "AI generation failed", status: 500 };
  }

  const json = await response.json();
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    // Fallback: try to parse content as JSON
    const content = json.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return { data: parsed };
      } catch {
        return { error: "AI did not return structured output" };
      }
    }
    return { error: "AI did not return structured output" };
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return { data: parsed };
  } catch {
    return { error: "Failed to parse AI output" };
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(result: { error?: string; status?: number }) {
  return new Response(JSON.stringify({ error: result.error }), {
    status: result.status || 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Deterministic fallback follow-up question — used when the LLM doesn't
// supply one for a low-confidence update, or when there are no ideas-eligible
// updates so we skip the LLM call entirely.
function buildFollowUpQuestion(u: any): string {
  const gaps: string[] = Array.isArray(u.missing_fields) ? u.missing_fields.slice(0, 2) : [];
  const headline = (u.title || u.content || "this update").toString().trim().slice(0, 60);
  const typeAsk: Record<string, string> = {
    testimonial: "Who said it, and what specific result did they get?",
    customer_story: "Which customer is this about, and what's the one number or outcome that proves the change?",
    product: "What's the launch date, price, and the single biggest thing this changes for customers?",
    event: "When and where is it, and what should people do (book / show up / RSVP)?",
    milestone: "What's the exact number reached, and over what time period?",
    csr: "Who did you partner with, where, and what was the tangible impact?",
    press: "Which outlet ran it, the headline, and a link?",
    partnership: "Who's the partner, what are you doing together, and when does it start?",
    other: "What's the one specific fact (name, number, date, or outcome) you'd want a post to lead with?",
  };
  const base = typeAsk[u.update_type] || typeAsk.other;
  if (gaps.length > 0) {
    return `For "${headline}" — ${base} (Missing: ${gaps.join(", ")}.)`;
  }
  return `For "${headline}" — ${base}`;
}
