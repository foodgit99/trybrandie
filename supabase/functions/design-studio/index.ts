import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- RETRY HELPER (exponential backoff for transient failures) ---
async function retryFetch(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Don't retry on 429/402 (rate limit / payment) — these are intentional
      if (response.ok || response.status === 429 || response.status === 402) {
        return response;
      }
      // Retry only on server errors
      if ([500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        console.log(`retryFetch: attempt ${attempt + 1} failed with ${response.status}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response; // Non-retryable error, return as-is
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`retryFetch: attempt ${attempt + 1} threw error, retrying in ${delay}ms...`, e);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("retryFetch: all attempts failed");
}

// --- GENOME SCORING FUNCTION (extracted for reuse) ---
function computeGenomeScores(
  genomeData: any,
  brand: any,
  trend: string | undefined,
  trend_intensity: number | undefined,
  copyStructure: any
): Record<string, number> {
  const scores: Record<string, number> = {};

  // 1. Brand Alignment Score (0-100)
  let brandScore = 60;
  const brandVibe = (brand?.vibe || "").toLowerCase();
  const vibeEmotionMap: Record<string, string[]> = {
    cinematic: ["luxurious", "authoritative", "futuristic"],
    minimal: ["calm", "authoritative"],
    bold: ["energetic", "rebellious"],
    playful: ["playful", "warm", "energetic"],
    luxury: ["luxurious", "calm", "authoritative"],
    corporate: ["authoritative", "calm"],
  };
  if (vibeEmotionMap[brandVibe]?.includes(genomeData.emotion)) brandScore += 15;
  const tonePersonalityMap: Record<string, string[]> = {
    professional: ["corporate", "editorial"],
    humourous: ["friendly", "street"],
    formal: ["corporate", "editorial"],
    casual: ["friendly", "street"],
    inspirational: ["editorial", "friendly"],
  };
  const brandTone = (brand?.tone_of_voice || "").toLowerCase();
  if (tonePersonalityMap[brandTone]?.includes(genomeData.typography.font_personality)) brandScore += 10;
  if (["high", "extreme"].includes(genomeData.color.contrast)) brandScore += 10;
  if (genomeData.texture.distortion !== "none" && brandVibe !== "bold") brandScore -= 5;
  scores.brand_alignment = Math.max(0, Math.min(100, brandScore + 5));

  // 2. Trend Balance Score (0-100)
  let trendScore = 70;
  if (trend && trend !== "none") {
    const intensity = trend_intensity ?? 40;
    const trendExpectations: Record<string, Record<string, any>> = {
      "tactile-rebellion": { texture_type: "paper", emotion: "warm", balance: "dynamic" },
      "hyper-chromatic": { saturation: "neon", contrast: "extreme", emotion: "energetic" },
      "technical-mono": { saturation: "muted", grid_type: "strict_grid", emotion: "futuristic" },
      "neo-naturalism": { texture_type: "paper", emotion: "calm", contrast: "low" },
      "kinetic-typography": { balance: "dynamic", hierarchy_logic: "strong_headline_dominance", emotion: "energetic" },
    };
    const expected = trendExpectations[trend] || {};
    let matches = 0;
    const total = Object.keys(expected).length;
    for (const [key, val] of Object.entries(expected)) {
      for (const cat of Object.values(genomeData)) {
        if (typeof cat === "object" && cat !== null && (cat as any)[key] === val) matches++;
      }
      if (genomeData[key] === val) matches++;
    }
    const matchRatio = total > 0 ? matches / total : 0;
    const idealMatchRatio = intensity / 100;
    const deviation = Math.abs(matchRatio - idealMatchRatio);
    trendScore = Math.round(85 - deviation * 60);
  }
  scores.trend_balance = Math.max(0, Math.min(100, trendScore));

  // 3. Visual Clarity Score (0-100)
  let clarityScore = 50;
  if (["high", "extreme"].includes(genomeData.color.contrast)) clarityScore += 20;
  else if (genomeData.color.contrast === "medium") clarityScore += 10;
  if (genomeData.typography.hierarchy_logic === "strong_headline_dominance") clarityScore += 15;
  else if (genomeData.typography.hierarchy_logic === "balanced_hierarchy") clarityScore += 10;
  if (genomeData.layout.spacing_density === "minimal") clarityScore += 10;
  else if (genomeData.layout.spacing_density === "balanced") clarityScore += 5;
  if (genomeData.composition.focal_strategy === "single_focal_point") clarityScore += 10;
  if (genomeData.texture.distortion !== "none") clarityScore -= 10;
  if (genomeData.texture.intensity === "heavy") clarityScore -= 5;
  scores.visual_clarity = Math.max(0, Math.min(100, clarityScore));

  // 4. Conversion Score (0-100)
  let conversionScore = 40;
  if (copyStructure?.cta && copyStructure.cta.length > 0) conversionScore += 20;
  if (genomeData.composition.focal_strategy === "single_focal_point") conversionScore += 15;
  if (genomeData.typography.hierarchy_logic === "strong_headline_dominance") conversionScore += 10;
  if (["energetic", "authoritative", "rebellious"].includes(genomeData.emotion)) conversionScore += 10;
  if (genomeData.layout.content_ratio === "balanced") conversionScore += 5;
  scores.conversion = Math.max(0, Math.min(100, conversionScore));

  // 5. Visual Balance Score (0-100)
  let balanceScore = 50;
  if (genomeData.layout.balance === "symmetrical") balanceScore += 20;
  else if (genomeData.layout.balance === "asymmetrical") balanceScore += 15;
  else if (genomeData.layout.balance === "dynamic") balanceScore += 10;
  if (genomeData.composition.layering_depth === "medium") balanceScore += 15;
  else if (genomeData.composition.layering_depth === "flat") balanceScore += 10;
  if (genomeData.layout.spacing_density === "balanced") balanceScore += 10;
  if (genomeData.color.gradient_logic !== "multi_spectrum") balanceScore += 5;
  scores.visual_balance = Math.max(0, Math.min(100, balanceScore));

  // Overall score (weighted average)
  scores.overall = Math.round(
    scores.brand_alignment * 0.30 +
    scores.trend_balance * 0.15 +
    scores.visual_clarity * 0.25 +
    scores.conversion * 0.15 +
    scores.visual_balance * 0.15
  );

  return scores;
}

// --- BRAND COLOR ANALYSIS HELPER ---
function analyzeBrandColors(primaryColors: string[]): { temperature: string; saturation: string } {
  if (!primaryColors || primaryColors.length === 0) return { temperature: "neutral", saturation: "balanced" };
  
  // Simple heuristic: analyze hex colors for warmth/coolness and saturation
  let warmCount = 0, coolCount = 0, highSat = 0, lowSat = 0;
  for (const hex of primaryColors) {
    const clean = hex.replace("#", "");
    if (clean.length < 6) continue;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    // Warm = reds/yellows/oranges dominate, Cool = blues/greens dominate
    if (r > b) warmCount++;
    else if (b > r) coolCount++;
    // Saturation approximation
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const satRatio = max > 0 ? (max - min) / max : 0;
    if (satRatio > 0.5) highSat++;
    else if (satRatio < 0.2) lowSat++;
  }
  const temperature = warmCount > coolCount ? "warm" : coolCount > warmCount ? "cool" : "neutral";
  const saturation = highSat > lowSat ? "vibrant" : lowSat > highSat ? "muted" : "balanced";
  return { temperature, saturation };
}

// --- FONT-TO-PERSONALITY MAP ---
function mapFontToPersonality(fontName: string): string | null {
  if (!fontName) return null;
  const lower = fontName.toLowerCase();
  // Corporate fonts
  if (/arial|helvetica|inter|roboto|open\s?sans|lato|source\s?sans|nunito\s?sans/i.test(lower)) return "corporate";
  // Editorial/serif fonts
  if (/playfair|merriweather|georgia|times|garamond|libre\s?baskerville|cormorant|lora|dm\s?serif/i.test(lower)) return "editorial";
  // Friendly fonts
  if (/poppins|nunito|quicksand|rounded|comic|baloo|fredoka|patrick/i.test(lower)) return "friendly";
  // Street/display fonts
  if (/impact|bebas|anton|black\s?ops|bangers|permanent\s?marker|rubik\s?mono/i.test(lower)) return "street";
  // Futuristic fonts
  if (/orbitron|rajdhani|exo|audiowide|space\s?grotesk|jost|outfit|syne/i.test(lower)) return "futuristic";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, brand, action, canvas_size, previous_prompt, previous_image_url, user_image_url, audience_id, trend, trend_intensity, render_quality } = await req.json();

    // === CHAT ACTION (with brand context) ===
    if (action === "chat") {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Fetch brand context for chat
      let chatBrandContext = "";
      let chatAudienceContext = "";
      let chatTrendContext = "";

      if (brand?.id) {
        // Build brand context
        chatBrandContext = `
BRAND CONTEXT (use this to give brand-aware advice):
- Brand name: ${brand.name || "Unknown"}
- Tagline: ${brand.tagline || "None"}
- Description: ${brand.description || "None"}
- Vibe: ${brand.vibe || "Modern"}
- Tone of voice: ${brand.tone_of_voice || "Professional"}
- Personality traits: ${(brand.personality_traits || []).join(", ") || "None"}
- Primary colours: ${(brand.primary_colors || []).join(", ") || "None specified"}
- Secondary colours: ${(brand.secondary_colors || []).join(", ") || "None specified"}
- Primary font: ${brand.typography_primary || "Not set"}
- Secondary font: ${brand.typography_secondary || "Not set"}`;

        // Fetch audience data
        try {
          const { data: audienceData } = await adminClient
            .from("target_audiences")
            .select("jtbd_profile, label")
            .eq("brand_id", brand.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (audienceData?.jtbd_profile) {
            const p = audienceData.jtbd_profile as any;
            chatAudienceContext = `
AUDIENCE INTELLIGENCE:
- Target persona: ${p.persona_summary || "N/A"}
- Core job: ${p.core_job_statement || "N/A"}
- Key struggles: ${(p.struggling_moments || []).slice(0, 3).join("; ")}
- Emotional drivers: ${(p.emotional_outcomes || []).slice(0, 3).join("; ")}`;
          }
        } catch (e) {
          console.log("Chat: audience fetch failed:", e);
        }

        // Fetch trend preferences
        try {
          const { data: trendPref } = await adminClient
            .from("brand_trend_preferences")
            .select("selected_trend, default_trend_intensity, trend_enabled")
            .eq("brand_id", brand.id)
            .maybeSingle();

          if (trendPref?.trend_enabled && trendPref.selected_trend && trendPref.selected_trend !== "none") {
            chatTrendContext = `
TREND CONTEXT: The brand currently has "${trendPref.selected_trend}" trend active at ${trendPref.default_trend_intensity}% intensity.`;
          }
        } catch (e) {
          console.log("Chat: trend fetch failed:", e);
        }
      }

      const chatSystemPrompt = `You are Brandie, a senior creative director with deep brand strategy expertise. You help users refine their design ideas before generating. Be confident, professional, calm. Never apologise excessively. Suggest improvements. Keep responses concise (2-3 sentences max). When advising on designs, always recommend photorealistic imagery and clean, modern aesthetics unless the user explicitly wants something different. Prioritise the user's intent and their Brand Centre settings (colours, fonts, tone, personality, inspiration) above all else.${chatBrandContext}${chatAudienceContext}${chatTrendContext}

When you have brand context, reference it naturally in your advice — suggest using specific brand colours, recommend copy that matches the tone of voice, and consider the target audience when discussing design strategy.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: chatSystemPrompt },
            ...messages,
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Chat failed");
      }

      const chatData = await response.json();
      const content = chatData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ message: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate" || action === "edit") {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Fetch audience intelligence for the brand
      let audienceContext = "";
      if (brand?.id || audience_id) {
        try {
          let query = adminClient.from("target_audiences").select("jtbd_profile");
          if (audience_id) {
            query = query.eq("id", audience_id);
          } else {
            query = query.eq("brand_id", brand.id).order("created_at", { ascending: true }).limit(1);
          }
          const { data: audienceData } = await query.maybeSingle();
          
          const profile = audienceData?.jtbd_profile;
          if (profile && typeof profile === "object" && Object.keys(profile).length > 0) {
            const p = profile as any;
            audienceContext = `

AUDIENCE INTELLIGENCE (use to sharpen copy and visual strategy):
- Target persona: ${p.persona_summary || "N/A"}
- Core job: ${p.core_job_statement || "N/A"}
- Key struggles: ${(p.struggling_moments || []).join("; ")}
- Emotional drivers: ${(p.emotional_outcomes || []).slice(0, 3).join("; ")}
- Buying triggers: ${(p.buying_triggers || []).join("; ")}
- Hesitation factors: ${(p.hesitation_factors || []).join("; ")}
- Top messaging angles: ${(p.messaging_angles || []).slice(0, 3).join("; ")}
- Conversion levers: ${(p.conversion_levers_ranked || []).slice(0, 3).join("; ")}

CONVERSION RULES:
1. Select top 1-2 emotional drivers and weave them into the headline/copy
2. Reference a struggling moment the audience relates to
3. Amplify the desired outcome
4. Neutralise the top anxiety/hesitation factor
5. Visual strategy should match emotional driver (Status→bold/luxury, Security→calm/soft, Growth→energetic)`;
          }
        } catch (e) {
          console.log("No audience data found, proceeding without:", e);
        }
      }

      // --- RAG PERSONALISATION ENGINE ---
      // Query user's top-rated past designs with genomes to build preference signals
      let preferenceContext = "";
      let preferenceWeights: Record<string, Record<string, number>> = {};
      let copyPreferenceContext = "";
      try {
        const { data: pastDesigns } = await adminClient
          .from("designs")
          .select("genome, vote, copy_structure, trend_used")
          .eq("user_id", user.id)
          .not("genome", "is", null)
          .order("vote", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);

        if (pastDesigns && pastDesigns.length >= 2) {
          // Tally gene values weighted by vote: upvoted=3, neutral=1, downvoted=0
          const tally: Record<string, Record<string, Record<string, number>>> = {};
          for (const d of pastDesigns) {
            const g = d.genome as any;
            if (!g) continue;
            const weight = d.vote === 1 ? 3 : d.vote === -1 ? 0 : 1;
            for (const [cat, val] of Object.entries(g)) {
              if (cat === "_scores" || cat === "emotion" || cat === "_refined") continue;
              if (typeof val === "object" && val !== null) {
                if (!tally[cat]) tally[cat] = {};
                for (const [field, fv] of Object.entries(val as any)) {
                  if (typeof fv !== "string") continue;
                  if (!tally[cat][field]) tally[cat][field] = {};
                  tally[cat][field][fv] = (tally[cat][field][fv] || 0) + weight;
                }
              }
            }
            // emotion (top-level string)
            if (g.emotion && typeof g.emotion === "string") {
              if (!tally["_emotion"]) tally["_emotion"] = { value: {} };
              tally["_emotion"]["value"][g.emotion] = (tally["_emotion"]["value"][g.emotion] || 0) + weight;
            }
          }

          // Find top value per gene
          const topGenes: string[] = [];
          for (const [cat, fields] of Object.entries(tally)) {
            for (const [field, counts] of Object.entries(fields)) {
              // Store weights for mutation bias
              if (!preferenceWeights[cat]) preferenceWeights[cat] = {};
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              if (sorted.length > 0 && sorted[0][1] >= 3) {
                const label = cat === "_emotion" ? "emotion" : `${cat}.${field}`;
                topGenes.push(`${label}=${sorted[0][0]}`);
                preferenceWeights[cat][field] = sorted[0][1];
                // Store preferred value for mutation bias
                preferenceWeights[cat][`_preferred_${field}`] = sorted[0][0] as any;
              }
            }
          }

          if (topGenes.length > 0) {
            preferenceContext = `\n\nUSER STYLE PREFERENCES (from ${pastDesigns.length} past designs, weighted by upvotes — bias toward these when appropriate but don't force them):\n${topGenes.join(", ")}`;
            console.log("RAG preference context:", preferenceContext);
          }

          // --- COPY PATTERN LEARNING ---
          // Track copy density preferences from upvoted designs
          const upvotedWithCopy = pastDesigns.filter(d => d.vote === 1 && d.copy_structure);
          if (upvotedWithCopy.length >= 2) {
            let headlineOnly = 0;
            let fullCopy = 0;
            let avgFieldsUsed = 0;
            for (const d of upvotedWithCopy) {
              const cs = d.copy_structure as any;
              if (!cs) continue;
              const fieldsUsed = [cs.headline, cs.subheadline, cs.cta, cs.supporting_text].filter(f => f && f.trim() !== "").length;
              avgFieldsUsed += fieldsUsed;
              if (fieldsUsed <= 1) headlineOnly++;
              else if (fieldsUsed >= 3) fullCopy++;
            }
            avgFieldsUsed = Math.round(avgFieldsUsed / upvotedWithCopy.length);
            const copyDensity = headlineOnly > fullCopy ? "minimal (headline-focused)" : fullCopy > headlineOnly ? "rich (headline + subheadline + CTA)" : "balanced";
            copyPreferenceContext = `\nUSER COPY PREFERENCE: User tends to prefer ${copyDensity} copy density (avg ${avgFieldsUsed} text fields used in upvoted designs).`;
            console.log("Copy preference context:", copyPreferenceContext);
          }

          // --- TREND AFFINITY LEARNING ---
          const trendCounts: Record<string, number> = {};
          for (const d of pastDesigns) {
            if (d.vote === 1 && d.trend_used && d.trend_used !== "none") {
              trendCounts[d.trend_used] = (trendCounts[d.trend_used] || 0) + 1;
            }
          }
          const topTrend = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0];
          if (topTrend && topTrend[1] >= 2) {
            preferenceContext += `\nPREFERRED TREND: User's upvoted designs frequently use "${topTrend[0]}" trend.`;
          }
        }
      } catch (e) {
        console.log("RAG preference retrieval failed, proceeding without:", e);
      }

      // --- CHAT HISTORY RAG (cached LLM-summarised preference tags) ---
      let chatHistoryContext = "";
      try {
        // Count current user messages to check against cache
        const { count: currentMsgCount } = await adminClient
          .from("design_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("role", "user");

        const msgCount = currentMsgCount ?? 0;

        if (msgCount >= 3) {
          // Check cache: reuse if message count hasn't changed
          const { data: cached } = await adminClient
            .from("chat_preference_cache")
            .select("tags, message_count")
            .eq("user_id", user.id)
            .maybeSingle();

          let tags: any = null;
          let cacheHit = false;

          if (cached && cached.message_count === msgCount && cached.tags && Object.keys(cached.tags).length > 0) {
            tags = cached.tags;
            cacheHit = true;
            console.log(`Chat RAG cache HIT (${msgCount} messages)`);
          } else if (msgCount >= 5) {
            // Cache miss or stale — run LLM extraction
            console.log(`Chat RAG cache MISS (cached: ${cached?.message_count ?? 0}, current: ${msgCount})`);

            // Fetch messages with their parent design's vote score
            const { data: recentMessages } = await adminClient
              .from("design_messages")
              .select("content, design_id")
              .eq("user_id", user.id)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(40);

            if (recentMessages && recentMessages.length >= 5) {
              // Batch-fetch vote scores for all related designs
              const designIds = [...new Set(recentMessages.map((m: any) => m.design_id))];
              const { data: designVotes } = await adminClient
                .from("designs")
                .select("id, vote")
                .in("id", designIds);

              const voteMap: Record<string, number> = {};
              if (designVotes) {
                for (const d of designVotes) {
                  voteMap[d.id] = d.vote ?? 0;
                }
              }

              // Weight messages: upvoted design msgs repeated 3x, neutral 1x, downvoted skipped
              const weightedMessages: string[] = [];
              for (const m of recentMessages) {
                const vote = voteMap[m.design_id] ?? 0;
                if (vote < 0) continue; // skip messages from downvoted designs
                const text = m.content.trim().substring(0, 150);
                const repeats = vote > 0 ? 3 : 1;
                for (let i = 0; i < repeats; i++) {
                  weightedMessages.push(text);
                }
              }

              const rawMessages = weightedMessages.slice(0, 45).join("\n- ");

              const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    {
                      role: "system",
                      content: `You are a design preference analyst. Given a user's recent chat messages from a brand design tool, extract structured preference tags.

Output ONLY a JSON object with these fields (use empty arrays if no clear pattern):
{
  "visual_styles": ["up to 3 recurring visual style preferences, e.g. 'minimalist', 'bold gradients', 'dark backgrounds'"],
  "color_preferences": ["up to 3 color tendencies, e.g. 'warm tones', 'neon accents', 'monochrome'"],
  "typography_preferences": ["up to 2, e.g. 'large headlines', 'serif fonts', 'handwritten feel'"],
  "content_topics": ["up to 3 recurring topics/industries, e.g. 'product launches', 'motivational quotes', 'food photography'"],
  "tone_preferences": ["up to 2, e.g. 'professional', 'playful', 'luxury', 'casual'"],
  "layout_preferences": ["up to 2, e.g. 'text-heavy', 'image-dominant', 'centered layout'"],
  "recurring_requests": ["up to 2 specific patterns, e.g. 'always asks for CTA buttons', 'prefers short copy'"]
}

Be concise. Only include tags with clear evidence from multiple messages. Output valid JSON only.`,
                    },
                    {
                      role: "user",
                      content: `Recent user messages:\n- ${rawMessages}`,
                    },
                  ],
                }),
              });

              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                const rawContent = extractData.choices?.[0]?.message?.content || "";
                try {
                  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                  if (jsonMatch) tags = JSON.parse(jsonMatch[0]);
                } catch { /* ignore parse errors */ }

                // Persist to cache (upsert by user_id)
                if (tags && typeof tags === "object") {
                  await adminClient
                    .from("chat_preference_cache")
                    .upsert(
                      { user_id: user.id, tags, message_count: msgCount, updated_at: new Date().toISOString() },
                      { onConflict: "user_id" }
                    );
                  console.log("Chat RAG: extracted and cached preference tags");
                }
              } else {
                console.log("Chat RAG extraction call failed:", extractResponse.status);
              }
            }
          }

          // Build context string from tags (cached or freshly extracted)
          if (tags && typeof tags === "object") {
            const tagLines: string[] = [];
            const tagMap: Record<string, string[]> = {
              "Visual styles": tags.visual_styles,
              "Color preferences": tags.color_preferences,
              "Typography": tags.typography_preferences,
              "Content topics": tags.content_topics,
              "Tone": tags.tone_preferences,
              "Layout": tags.layout_preferences,
              "Patterns": tags.recurring_requests,
            };
            for (const [label, values] of Object.entries(tagMap)) {
              if (Array.isArray(values) && values.length > 0) {
                tagLines.push(`- ${label}: ${values.join(", ")}`);
              }
            }
            if (tagLines.length > 0) {
              chatHistoryContext = `\n\nUSER STYLE PREFERENCE TAGS (extracted from recent conversations${cacheHit ? ", cached" : ""} — use to inform decisions but ALWAYS prioritise the current prompt):\n${tagLines.join("\n")}`;
            }
          } else if (msgCount >= 3 && msgCount < 5) {
            // Fallback for 3-4 messages: simple condensation
            const { data: fewMessages } = await adminClient
              .from("design_messages")
              .select("content")
              .eq("user_id", user.id)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(5);
            if (fewMessages) {
              const condensed = fewMessages.map((m: any) => m.content.trim().substring(0, 120)).join(" | ");
              chatHistoryContext = `\n\nCONVERSATION HISTORY INSIGHTS (recent user requests — look for recurring patterns):\n${condensed}`;
            }
          }
        }
      } catch (e) {
        console.log("Chat history RAG failed, proceeding without:", e);
      }

      // Build trend context
      let trendContext = "";
      if (trend && trend !== "none") {
        const trendPresets: Record<string, any> = {
          "tactile-rebellion": {
            name: "Tactile Rebellion",
            visual_characteristics: "Paper textures, grain overlays, hand-drawn marks, imperfect alignment, scrapbook-style collage layouts, torn edges, stamp effects",
            typography_style: "Handwritten or rough serif fonts, irregular baselines, ink-stamp lettering, slightly rotated text blocks",
            color_profile: "Muted earth tones layered with the brand palette, cream/kraft paper backgrounds, ink-wash colour effects",
            texture_elements: "Heavy grain, paper fibre texture, ink splatter, tape/sticker overlays, pencil scribbles",
            copy_tone_hint: "More expressive and human — use imperfect, authentic, conversational language",
          },
          "hyper-chromatic": {
            name: "Hyper Chromatic",
            visual_characteristics: "Extremely vibrant colour contrasts, neon accents, bold gradients, energetic compositions, light leak effects, prismatic colour splits",
            typography_style: "Heavy bold sans-serif, oversized display type, colour-filled text, glow effects on headlines",
            color_profile: "Saturated neon accents blended with brand colours, vivid gradients, high-contrast complementary pairings",
            texture_elements: "Light leaks, chromatic aberration, glass refraction, holographic sheen, subtle noise on gradients",
            copy_tone_hint: "High-energy promotional language — bold, punchy, exclamatory, confident",
          },
          "technical-mono": {
            name: "Technical Mono",
            visual_characteristics: "Monospaced typography, clean grid structures, industrial aesthetic, futuristic UI elements, data-visualization motifs, blueprint feel",
            typography_style: "Monospaced fonts for all text, fixed-width grid alignment, code-editor aesthetic, minimal font-weight variation",
            color_profile: "Desaturated palette with single brand-colour accent, dark backgrounds, terminal-green or cyan highlights",
            texture_elements: "Dot grids, scan lines, subtle noise, circuit-board patterns, thin rule lines",
            copy_tone_hint: "Shorter and sharper copy — precise, technical, no-nonsense, data-driven",
          },
          "neo-naturalism": {
            name: "Neo Naturalism",
            visual_characteristics: "Calm colour palettes, organic textures, nature-inspired imagery, generous breathing space, soft rounded shapes, botanical motifs",
            typography_style: "Elegant thin serifs or rounded sans-serif, generous letter-spacing, light font weights, organic flow",
            color_profile: "Soft greens, warm terracottas, sky blues blended with brand palette, low saturation, natural harmony",
            texture_elements: "Watercolour washes, linen textures, leaf shadows, soft bokeh, natural light effects",
            copy_tone_hint: "Calm and soothing tone — gentle, reassuring, mindful, nurturing",
          },
          "kinetic-typography": {
            name: "Kinetic Typography",
            visual_characteristics: "Motion-oriented layouts, elastic typography, strong visual hierarchy, energetic diagonal compositions, speed lines, dynamic angles",
            typography_style: "Elastic/stretched display fonts, extreme size contrasts, slanted baselines, overlapping text layers, variable font weight animation feel",
            color_profile: "High-contrast brand colours with motion blur accents, speed gradients, directional colour transitions",
            texture_elements: "Motion blur streaks, speed lines, dynamic shadows, perspective distortion, wind effects",
            copy_tone_hint: "Energetic and dynamic — action-oriented verbs, short punchy phrases, momentum-building",
          },
        };

        const t = trendPresets[trend];
        if (t) {
          const intensity = trend_intensity ?? 40;
          trendContext = `

TREND STYLING (blend with brand, never override):
- Active trend: ${t.name}
- Intensity: ${intensity}/100 (0=pure brand, 100=full trend)
- Visual characteristics: ${t.visual_characteristics}
- Typography influence: ${t.typography_style}
- Color treatment: ${t.color_profile}
- Texture elements: ${t.texture_elements}

TREND RULES:
1. Brand colours, fonts, and voice ALWAYS take priority
2. At intensity <25, apply only subtle hints of the trend aesthetic
3. At intensity 50, balance brand and trend equally
4. At intensity >75, trend styling is dominant but brand colours remain
5. Adapt copy tone slightly: ${t.copy_tone_hint}`;
        }
      }
      // --- Intent classification for edits ---
      let isFreeEdit = false;
      const userPrompt = messages[messages.length - 1]?.content || "";

      if (action === "edit" && previous_prompt) {
        // Use a fast LLM call to classify intent
        const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are an intent classifier for a design tool. Classify the user's edit request as either MINOR or MAJOR.

MINOR edits (free, no credit cost):
- Changing headline text, CTA text, or subheadline text
- Fixing a typo
- Changing the wording of existing text
- Making text shorter or longer
- Changing tone of existing copy (e.g. "make it more casual")

MAJOR edits (costs 1 credit):
- Changing the layout or composition
- Changing colours or colour scheme
- Changing the background image or visual style
- Adding or removing visual elements
- Changing the overall design direction
- Requesting a completely different design
- Adding images or changing imagery
- Changing font/typography style
- Resizing or repositioning elements

Respond with ONLY the word "MINOR" or "MAJOR". Nothing else.`,
              },
              { role: "user", content: `Previous design brief: "${previous_prompt}"\n\nUser's edit request: "${userPrompt}"` },
            ],
          }),
        });

        if (classifyResponse.ok) {
          const classifyData = await classifyResponse.json();
          const classification = (classifyData.choices?.[0]?.message?.content || "").trim().toUpperCase();
          isFreeEdit = classification === "MINOR";
          console.log(`Intent classification: ${classification} (isFreeEdit: ${isFreeEdit})`);
        }
      }

      // Check and increment generation count — skip for free edits
      if (!isFreeEdit) {
        const creditCost = render_quality === "hd" ? 2 : 1;
        const { data: profile } = await adminClient
          .from("profiles")
          .select("generations_count, generations_reset_at, bonus_credits, referral_code, subscription_tier")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          const resetAt = new Date(profile.generations_reset_at);
          const now = new Date();
          const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

          // Determine monthly limit based on tier
          const tierLimits: Record<string, number> = {
            free: 10,
            entrepreneur: 50,
            creator: 150,
            agency: 400,
          };
          const monthlyLimit = tierLimits[profile.subscription_tier] || 10;
          const totalCredits = monthlyLimit + (profile.bonus_credits || 0);

          if (needsReset) {
            await adminClient
              .from("profiles")
              .update({ generations_count: creditCost, generations_reset_at: now.toISOString(), bonus_earned_count: 0, bonus_earned_reset_at: now.toISOString() })
              .eq("user_id", user.id);
          } else {
            if (profile.generations_count + creditCost > totalCredits) {
              return new Response(JSON.stringify({ error: "Monthly generation limit reached. Please upgrade your plan." }), {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            
            const newCount = profile.generations_count + creditCost;
            await adminClient
              .from("profiles")
              .update({ generations_count: newCount })
              .eq("user_id", user.id);

            // Check if credits are running low (< 5 remaining) and send warning email
            const remainingCredits = totalCredits - newCount;
            if (remainingCredits > 0 && remainingCredits < 5) {
              try {
                const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
                const userEmail = userData?.user?.email;
                
                if (userEmail && profile.referral_code) {
                  console.log(`Sending low credits warning to ${userEmail}, remaining: ${remainingCredits}`);
                  
                  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                  
                  fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${serviceKey}`,
                    },
                    body: JSON.stringify({
                      type: "low_credits",
                      to: userEmail,
                      data: { 
                        remaining_credits: remainingCredits,
                        referral_code: profile.referral_code 
                      },
                    }),
                  }).catch(e => console.error("Low credits email failed:", e));
                }
              } catch (e) {
                console.error("Error checking for low credits email:", e);
              }
            }
          }
        }
      }

      // Determine canvas dimensions
      const size = canvas_size || "1080x1080";
      const [w, h] = size.split("x");
      const sizeLabels: Record<string, string> = {
        "1080x1080": "square (1080x1080, aspect ratio 1:1)",
        "1920x1080": "landscape rectangle (1920x1080, aspect ratio 16:9)",
        "1080x1920": "portrait story (1080x1920, aspect ratio 9:16)",
      };
      const sizeLabel = sizeLabels[size] || `${w}x${h}`;

      // Canvas format context for upstream agents
      const canvasFormatBrief = size === "1080x1080"
        ? "\n\nCANVAS FORMAT: SQUARE (1:1). Design for a PERFECTLY SQUARE canvas. Plan a centered, compact, symmetrical composition. All elements should be balanced around the center. Avoid wide horizontal layouts — keep content compact and vertically centered."
        : size === "1080x1920"
        ? "\n\nCANVAS FORMAT: TALL PORTRAIT (9:16). Design for a TALL, NARROW canvas. Plan a vertically stacked composition with elements flowing top-to-bottom. Use strong vertical hierarchy. Avoid wide horizontal spreads — stack elements vertically."
        : "\n\nCANVAS FORMAT: WIDE LANDSCAPE (16:9). Design for a WIDE, HORIZONTAL canvas. Plan a horizontally spread composition. Content can span the full width. Use horizontal balance and side-by-side element placement.";

      const canvasFormatCopy = size === "1080x1080"
        ? "\n\nCANVAS FORMAT: SQUARE (1:1). Keep copy SHORT and COMPACT — fewer text elements, tight word count. A square canvas has limited space. Prefer a strong headline with minimal supporting text."
        : size === "1080x1920"
        ? "\n\nCANVAS FORMAT: TALL PORTRAIT (9:16). Copy should follow a VERTICAL HIERARCHY — headline at top, supporting text in middle, CTA at bottom. You have vertical space so stacked text blocks work well, but keep each block concise."
        : "\n\nCANVAS FORMAT: WIDE LANDSCAPE (16:9). You have more HORIZONTAL space. Copy can be slightly more expansive. Side-by-side text elements work well. Keep good horizontal balance.";

      // Collect inspiration examples for context
      const inspirationUrls: string[] = brand?.inspiration_examples || [];

      // Fetch product images for contextual use
      let productImageUrls: string[] = [];
      let productImageContext = "";
      if (brand?.id) {
        try {
          const { data: productData } = await adminClient
            .from("brand_products")
            .select("image_url, label")
            .eq("brand_id", brand.id)
            .order("created_at", { ascending: true })
            .limit(6);
          if (productData && productData.length > 0) {
            productImageUrls = productData.map((p: any) => p.image_url);
            const labels = productData.filter((p: any) => p.label).map((p: any) => p.label).join(", ");
            productImageContext = `\n\nPRODUCT IMAGES AVAILABLE: The brand has ${productData.length} product image(s)${labels ? ` (${labels})` : ""}. When the design is promoting, showcasing, or related to the brand's products, incorporate a product image as a SUPPORTING visual element — but do NOT make it the hero of every design. Use product images when contextually relevant (e.g., product launches, promotions, offers, showcases). For motivational, informational, or brand-awareness posts, product images are optional. The user's attached image always takes priority over product images.`;
          }
        } catch (e) {
          console.log("Product images fetch failed, proceeding without:", e);
        }
      }

      const brandContext = brand
        ? `You are Brandie, a senior creative director with 20+ years of experience. You design STRICTLY within the user's brand system.

BRAND SYSTEM (YOU MUST USE THESE EXACT VALUES):
- Brand name: ${brand.name}
- Tagline: ${brand.tagline || "None"}
- Description: ${brand.description || "None"}
- Vibe: ${brand.vibe || "Modern"}
- Tone of voice: ${brand.tone_of_voice || "Professional"}
- Personality traits: ${(brand.personality_traits || []).join(", ") || "None specified"}
- Primary colours (MUST dominate the design): ${(brand.primary_colors || []).join(", ")}
- Secondary colours: ${(brand.secondary_colors || []).join(", ")}
- Accent colours: ${(brand.accent_colors || []).join(", ")}
- Primary font: ${brand.typography_primary || "Clean sans-serif"}
- Secondary font: ${brand.typography_secondary || "Serif"}
${inspirationUrls.length > 0 ? `- Brand inspiration/style references: The brand has ${inspirationUrls.length} inspiration image(s) that define the desired visual aesthetic. Match this visual style closely.` : ""}
${brand.image_style_preferences?.length ? `- Image style preferences: ${brand.image_style_preferences.join(", ")}` : ""}
${audienceContext}${trendContext}${productImageContext}${preferenceContext}${chatHistoryContext}

DESIGN PHILOSOPHY (ALWAYS APPLY):
1. ALWAYS use PHOTOREALISTIC imagery and real photography. Use natural textures, real environments, and lifelike visuals. NEVER use cartoons, clip art, flat illustrations, or AI-looking abstract art — UNLESS the user EXPLICITLY requests illustrations, cartoons, or abstract styles.
2. Designs MUST follow modern design principles: strong visual hierarchy, balanced composition, generous whitespace, clean typography, and overall visual appeal. Every design should look like it was crafted by a top-tier design agency.
3. The USER'S INTENT carries the HIGHEST weight. Whatever the user asks for, deliver EXACTLY that. Never override, reinterpret, or ignore the user's specific request.
4. Brand Centre data (colours, fonts, tone, personality, vibe, inspiration) carries the SECOND HIGHEST weight. Always stay on-brand.
5. ALL text/copy on the design MUST align with the brand's value proposition and speak directly to the brand's target customer. Every word must serve a purpose — no filler text, no placeholder copy, no lorem ipsum, no decorative text that doesn't belong. Only include text that a real customer would expect to see on a professional marketing graphic for this brand.
6. Do NOT add unnecessary text elements. If the design only needs a headline, do not add a subheadline or CTA just to fill space. Let the design breathe. Only include text elements that are relevant to the user's request and the brand's messaging.
7. COLOUR CONTRAST IS CRITICAL: Always ensure text is highly legible against the background. If the background is dark, use light/white text. If the background is light, use dark text. When placing text over images, ALWAYS add a semi-transparent overlay, gradient scrim, or solid colour block behind the text to guarantee readability. Never place light text on light backgrounds or dark text on dark backgrounds. Contrast and legibility are non-negotiable.

${brand.special_instructions ? `SPECIAL INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY THESE DIRECTIVES):
${brand.special_instructions}

` : ""}CRITICAL RULES:
1. The design MUST directly address the user's request. If they ask for a "happy monday flyer", the headline MUST say "Happy Monday" or similar. NEVER create generic unrelated designs.
2. Use the EXACT brand hex colours listed above as the dominant palette. Do NOT invent new colours.
3. Use the brand fonts specified above.
4. Match the brand vibe: ${brand.vibe || "Modern"}
5. Match the tone of voice: ${brand.tone_of_voice || "Professional"}
6. Reflect these personality traits in the design: ${(brand.personality_traits || []).join(", ") || "Professional"}
7. Strong visual hierarchy: headline, subheadline, optional CTA — but ONLY if they are relevant and warranted by the user's request.
8. Generous negative space, modern 2026 aesthetic
9. Include the brand name "${brand.name}" somewhere in the design
10. Canvas size: ${sizeLabel}
11. If the user attaches an image, treat it as the PRIMARY visual reference. Follow their instructions about it LITERALLY. The attached image takes priority over all other visual considerations.
12. Photorealistic by default. Clean, modern, and visually stunning. No cartoon or clip art unless user asks.
13. NEVER add random motivational quotes, taglines, or text that the user did not ask for. Every piece of text must be intentional and relevant to the specific request.
14. ALWAYS ensure sufficient colour contrast between text and its background. Use overlays, scrims, or solid blocks behind text when placed over images.`
        : "You are a helpful design assistant. Create beautiful, photorealistic social media graphics that directly match the user's request. Use real photography and modern design principles: clean layout, strong hierarchy, generous whitespace, and visual appeal.";

      // For edits, include context about the previous design
      const editContext = action === "edit" && previous_prompt
        ? `\n\nPREVIOUS DESIGN CONTEXT: The user already has a design based on this brief: "${previous_prompt}". They now want to EDIT it. Preserve the overall layout and structure but apply their requested changes. This is a refinement, not a full redesign.`
        : "";

      // Build user image context for the brief
      const userImageContext = user_image_url
        ? `\n\nCRITICAL: The user has attached a reference image. You MUST incorporate this image into the design exactly as instructed. Follow the user's instructions about this image strictly and precisely. The attached image is the PRIMARY visual element.`
        : "";

      const briefUserContent = user_image_url
        ? [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: user_image_url } },
          ]
        : userPrompt;

      // --- PARALLEL: Brief Agent + Inspiration Style Analysis ---
      // Launch inspiration analysis in parallel with brief if inspiration images exist
      let inspirationStyleTagsPromise: Promise<string[]> | null = null;
      if (inspirationUrls.length > 0) {
        inspirationStyleTagsPromise = (async () => {
          try {
            const inspContent: any[] = [
              { type: "text", text: "Analyze these brand inspiration images and extract 3-5 visual style tags that describe the aesthetic. Return ONLY a JSON array of strings, e.g. [\"luxurious\", \"minimal\", \"editorial\", \"warm tones\", \"high contrast\"]. Tags should be from this vocabulary when possible: luxurious, minimal, editorial, warm, cool, bold, playful, corporate, futuristic, organic, rebellious, calm, energetic, streetwear, retro, natural, dramatic, clean." },
            ];
            for (const url of inspirationUrls.slice(0, 2)) {
              inspContent.push({ type: "image_url", image_url: { url } });
            }
            const inspResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [{ role: "user", content: inspContent }],
              }),
            });
            if (inspResponse.ok) {
              const inspData = await inspResponse.json();
              const rawContent = inspData.choices?.[0]?.message?.content || "";
              const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const tags = JSON.parse(jsonMatch[0]);
                console.log("Inspiration style tags:", tags);
                return tags as string[];
              }
            }
          } catch (e) {
            console.log("Inspiration analysis failed, proceeding without:", e);
          }
          return [];
        })();
      }

      // Brief Agent call (with retry)
      const briefResponse = await retryFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: brandContext + editContext + userImageContext + canvasFormatBrief + `\n\nThe user's request is below.\n\nRespond with TWO parts clearly separated:\n\nPART 1 - DESIGN BRIEF: A detailed image generation prompt (3-4 sentences) describing EXACTLY what to create. The design MUST match the user's request topic. Specify the exact hex colour codes from the brand system, the font names, layout details, and composition. Be extremely specific. IMPORTANT: Your layout and composition directions MUST be optimised for the canvas format specified above.${user_image_url ? " CRITICAL: The user provided a reference image — describe how to incorporate it prominently into the design as the user instructs." : ""}\n\nPART 2 - EXPLANATION: A brief, confident explanation (1-2 sentences) of your design choices referencing the brand colours and fonts by name. Speak like a creative director.` },
            ...messages.slice(0, -1),
            { role: "user", content: briefUserContent },
          ],
        }),
      });

      if (!briefResponse.ok) {
        if (briefResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (briefResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await briefResponse.text();
        console.error("Brief generation error:", briefResponse.status, errText);
        throw new Error("Failed to generate design brief");
      }

      const briefData = await briefResponse.json();
      const briefContent = briefData.choices?.[0]?.message?.content || "";

      const designPrompt = briefContent.includes("DESIGN BRIEF:")
        ? briefContent.split("DESIGN BRIEF:")[1].split("EXPLANATION:")[0].trim()
        : briefContent.split("\n")[0];

      const explanation = briefContent.includes("EXPLANATION:")
        ? briefContent.split("EXPLANATION:")[1].trim()
        : "I've crafted this design with your brand identity in mind.";

      // --- DETERMINISTIC GENOME COMPOSER ---
      let genomeData: any = null;
      try {
        // 1. Pick a base genome preset from brand vibe
        const vibePresetMap: Record<string, string> = {
          cinematic: "luxury-editorial",
          minimal: "minimalist-modern",
          bold: "bold-startup",
          playful: "streetwear-alte",
          luxury: "luxury-editorial",
          corporate: "corporate-clean",
          futuristic: "tech-futurism",
          natural: "organic-natural",
          retro: "retro-futurism",
        };
        const brandVibeLower = (brand?.vibe || "").toLowerCase();
        let basePresetId = vibePresetMap[brandVibeLower] || "bold-startup";

        // --- INSPIRATION IMAGE INFLUENCE ON GENOME ---
        // If inspiration analysis ran, use tags to potentially override preset selection
        if (inspirationStyleTagsPromise) {
          const inspirationTags = await inspirationStyleTagsPromise;
          if (inspirationTags.length > 0) {
            // Map inspiration tags to preset candidates
            const tagPresetMap: Record<string, string> = {
              luxurious: "luxury-editorial",
              luxury: "luxury-editorial",
              editorial: "luxury-editorial",
              minimal: "minimalist-modern",
              minimalist: "minimalist-modern",
              clean: "minimalist-modern",
              bold: "bold-startup",
              energetic: "bold-startup",
              playful: "streetwear-alte",
              streetwear: "streetwear-alte",
              rebellious: "neo-brutalism",
              futuristic: "tech-futurism",
              corporate: "corporate-clean",
              organic: "organic-natural",
              natural: "organic-natural",
              calm: "organic-natural",
              retro: "retro-futurism",
              dramatic: "luxury-editorial",
              warm: "organic-natural",
            };
            // Count votes per preset from inspiration tags
            const presetVotes: Record<string, number> = {};
            for (const tag of inspirationTags) {
              const lower = tag.toLowerCase();
              const preset = tagPresetMap[lower];
              if (preset) {
                presetVotes[preset] = (presetVotes[preset] || 0) + 1;
              }
            }
            // If inspiration suggests a different preset than vibe, and it has strong signal (2+ votes), override
            const topInspirationPreset = Object.entries(presetVotes).sort((a, b) => b[1] - a[1])[0];
            if (topInspirationPreset && topInspirationPreset[1] >= 2 && topInspirationPreset[0] !== basePresetId) {
              console.log(`Inspiration override: "${basePresetId}" → "${topInspirationPreset[0]}" (${topInspirationPreset[1]} tag votes from: ${inspirationTags.join(", ")})`);
              basePresetId = topInspirationPreset[0];
            } else if (topInspirationPreset) {
              console.log(`Inspiration tags (${inspirationTags.join(", ")}) align with or insufficient to override current preset "${basePresetId}"`);
            }
          }
        }

        // Hardcoded genome presets
        const GENOME_PRESETS: Record<string, any> = {
          "minimalist-modern": {
            color: { palette_type: "monochrome", temperature: "neutral", contrast: "medium", saturation: "muted", gradient_logic: "flat" },
            typography: { font_personality: "corporate", weight_system: "light", hierarchy_logic: "text_minimal", typography_layout: "centered", text_effect: "none" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "minimal", content_ratio: "balanced" },
            composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "flat" },
            texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
            illustration: { style: "none", detail_level: "minimal", line_weight: "thin" },
            image_style: { lighting: "natural", color_grading: "monochrome", framing: "wide" },
            emotion: "calm",
          },
          "luxury-editorial": {
            color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "balanced", gradient_logic: "metallic_gradient" },
            typography: { font_personality: "editorial", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "none" },
            layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "image_dominant" },
            composition: { visual_direction: "diagonal", focal_strategy: "dual_focal", layering_depth: "deep_layered" },
            texture: { texture_type: "paper", intensity: "subtle", distortion: "none" },
            illustration: { style: "none", detail_level: "high", line_weight: "thin" },
            image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "portrait" },
            emotion: "luxurious",
          },
          "streetwear-alte": {
            color: { palette_type: "triadic", temperature: "warm", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" },
            typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "overlay", text_effect: "outline" },
            layout: { grid_type: "broken_grid", balance: "dynamic", spacing_density: "dense", content_ratio: "text_dominant" },
            composition: { visual_direction: "diagonal", focal_strategy: "distributed", layering_depth: "deep_layered" },
            texture: { texture_type: "grain", intensity: "heavy", distortion: "glitch" },
            illustration: { style: "abstract", detail_level: "medium", line_weight: "bold" },
            image_style: { lighting: "neon", color_grading: "vibrant", framing: "close_crop" },
            emotion: "rebellious",
          },
          "neo-brutalism": {
            color: { palette_type: "complementary", temperature: "neutral", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" },
            typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "drop_shadow" },
            layout: { grid_type: "broken_grid", balance: "asymmetrical", spacing_density: "dense", content_ratio: "text_dominant" },
            composition: { visual_direction: "horizontal", focal_strategy: "single_focal_point", layering_depth: "medium" },
            texture: { texture_type: "grain", intensity: "medium", distortion: "none" },
            illustration: { style: "flat", detail_level: "minimal", line_weight: "bold" },
            image_style: { lighting: "dramatic", color_grading: "vibrant", framing: "wide" },
            emotion: "rebellious",
          },
          "retro-futurism": {
            color: { palette_type: "split_complementary", temperature: "cool", contrast: "high", saturation: "neon", gradient_logic: "multi_spectrum" },
            typography: { font_personality: "futuristic", weight_system: "bold", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "neon" },
            layout: { grid_type: "modular_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "radial", focal_strategy: "single_focal_point", layering_depth: "deep_layered" },
            texture: { texture_type: "metallic", intensity: "medium", distortion: "warp" },
            illustration: { style: "3d", detail_level: "high", line_weight: "medium" },
            image_style: { lighting: "neon", color_grading: "cinematic", framing: "wide" },
            emotion: "futuristic",
          },
          "organic-natural": {
            color: { palette_type: "analogous", temperature: "warm", contrast: "low", saturation: "muted", gradient_logic: "soft_gradient" },
            typography: { font_personality: "friendly", weight_system: "light", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "none" },
            layout: { grid_type: "freeform", balance: "symmetrical", spacing_density: "minimal", content_ratio: "image_dominant" },
            composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "medium" },
            texture: { texture_type: "paper", intensity: "subtle", distortion: "none" },
            illustration: { style: "hand_drawn", detail_level: "medium", line_weight: "thin" },
            image_style: { lighting: "natural", color_grading: "vintage", framing: "wide" },
            emotion: "organic",
          },
          "tech-futurism": {
            color: { palette_type: "monochrome", temperature: "cool", contrast: "high", saturation: "balanced", gradient_logic: "soft_gradient" },
            typography: { font_personality: "futuristic", weight_system: "regular", hierarchy_logic: "text_minimal", typography_layout: "left_editorial", text_effect: "none" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "horizontal", focal_strategy: "distributed", layering_depth: "medium" },
            texture: { texture_type: "digital_noise", intensity: "subtle", distortion: "none" },
            illustration: { style: "3d", detail_level: "high", line_weight: "thin" },
            image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "wide" },
            emotion: "futuristic",
          },
          "bold-startup": {
            color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "vibrant", gradient_logic: "soft_gradient" },
            typography: { font_personality: "friendly", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "centered", text_effect: "none" },
            layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "diagonal", focal_strategy: "single_focal_point", layering_depth: "medium" },
            texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
            illustration: { style: "flat", detail_level: "medium", line_weight: "medium" },
            image_style: { lighting: "natural", color_grading: "vibrant", framing: "wide" },
            emotion: "energetic",
          },
          "corporate-clean": {
            color: { palette_type: "analogous", temperature: "cool", contrast: "medium", saturation: "balanced", gradient_logic: "flat" },
            typography: { font_personality: "corporate", weight_system: "regular", hierarchy_logic: "balanced_hierarchy", typography_layout: "left_editorial", text_effect: "none" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "horizontal", focal_strategy: "dual_focal", layering_depth: "flat" },
            texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
            illustration: { style: "none", detail_level: "minimal", line_weight: "thin" },
            image_style: { lighting: "soft", color_grading: "vibrant", framing: "wide" },
            emotion: "authoritative",
          },
        };

        // 2. Trend-to-genome override mappings
        const TREND_OVERRIDES: Record<string, any> = {
          "tactile-rebellion": {
            color: { saturation: "muted", temperature: "warm" },
            typography: { font_personality: "editorial", text_effect: "none" },
            layout: { grid_type: "freeform", balance: "dynamic" },
            texture: { texture_type: "paper", intensity: "heavy", distortion: "none" },
            image_style: { color_grading: "vintage" },
            emotion: "warm",
          },
          "hyper-chromatic": {
            color: { saturation: "neon", contrast: "extreme", gradient_logic: "multi_spectrum" },
            typography: { weight_system: "ultra_bold", text_effect: "neon" },
            texture: { texture_type: "digital_noise", intensity: "subtle" },
            image_style: { lighting: "neon", color_grading: "vibrant" },
            emotion: "energetic",
          },
          "technical-mono": {
            color: { saturation: "muted", temperature: "cool", contrast: "high" },
            typography: { font_personality: "futuristic", weight_system: "regular", hierarchy_logic: "text_minimal" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced" },
            texture: { texture_type: "digital_noise", intensity: "subtle" },
            image_style: { lighting: "dramatic", color_grading: "monochrome" },
            emotion: "futuristic",
          },
          "neo-naturalism": {
            color: { saturation: "muted", temperature: "warm", contrast: "low", gradient_logic: "soft_gradient" },
            typography: { font_personality: "friendly", weight_system: "light" },
            layout: { spacing_density: "minimal" },
            texture: { texture_type: "paper", intensity: "subtle" },
            image_style: { lighting: "natural", color_grading: "vintage" },
            emotion: "calm",
          },
          "kinetic-typography": {
            color: { contrast: "high" },
            typography: { weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "overlay" },
            layout: { grid_type: "broken_grid", balance: "dynamic" },
            composition: { visual_direction: "diagonal", layering_depth: "deep_layered" },
            texture: { texture_type: "none", distortion: "warp" },
            emotion: "energetic",
          },
        };

        // 3. Deep clone the base preset
        genomeData = JSON.parse(JSON.stringify(GENOME_PRESETS[basePresetId] || GENOME_PRESETS["bold-startup"]));
        console.log(`Genome Composer (deterministic): base preset="${basePresetId}" for vibe="${brandVibeLower}"`);

        // 4. Apply trend overrides if trend is selected, blended by intensity
        if (trend && trend !== "none" && TREND_OVERRIDES[trend]) {
          const overrides = TREND_OVERRIDES[trend];
          const intensity = (trend_intensity ?? 40) / 100;
          for (const [category, values] of Object.entries(overrides)) {
            if (category === "emotion") {
              if (intensity > 0.3) genomeData.emotion = values;
            } else if (typeof values === "object" && values !== null && genomeData[category]) {
              for (const [field, val] of Object.entries(values as Record<string, string>)) {
                if (Math.random() < intensity) {
                  genomeData[category][field] = val;
                }
              }
            }
          }
          console.log(`Genome: trend "${trend}" overrides applied at intensity ${trend_intensity ?? 40}%`);
        }

        // --- GENOME MUTATION ENGINE (15%) ---
        const MUTATION_RATE = 0.15;
        const freeGeneOptions: Record<string, Record<string, string[]>> = {
          layout: {
            grid_type: ["strict_grid", "modular_grid", "broken_grid", "freeform"],
            balance: ["symmetrical", "asymmetrical", "dynamic"],
            spacing_density: ["minimal", "balanced", "dense"],
            content_ratio: ["image_dominant", "text_dominant", "balanced"],
          },
          composition: {
            visual_direction: ["vertical", "horizontal", "diagonal", "radial"],
            focal_strategy: ["single_focal_point", "dual_focal", "distributed"],
            layering_depth: ["flat", "medium", "deep_layered"],
          },
          texture: {
            texture_type: ["none", "grain", "paper", "digital_noise", "plastic", "metallic"],
            intensity: ["subtle", "medium", "heavy"],
            distortion: ["none", "glitch", "warp", "pixel_sort"],
          },
          illustration: {
            style: ["none", "3d", "flat", "hand_drawn", "abstract", "cartoon", "clay"],
            detail_level: ["minimal", "medium", "high"],
            line_weight: ["thin", "medium", "bold"],
          },
          image_style: {
            lighting: ["natural", "dramatic", "neon", "soft"],
            color_grading: ["cinematic", "vintage", "vibrant", "monochrome"],
            framing: ["close_crop", "wide", "portrait"],
          },
        };
        const semiFlexGeneOptions: Record<string, Record<string, string[]>> = {
          typography: {
            weight_system: ["light", "regular", "bold", "ultra_bold"],
            text_effect: ["none", "outline", "drop_shadow", "gradient", "glitch", "neon"],
            typography_layout: ["centered", "left_editorial", "split_text", "overlay"],
          },
          color: {
            temperature: ["warm", "neutral", "cool"],
            gradient_logic: ["flat", "soft_gradient", "metallic_gradient", "multi_spectrum"],
          },
        };
        const emotionOptions = ["energetic", "calm", "luxurious", "playful", "rebellious", "authoritative", "warm", "futuristic", "organic"];

        let mutationCount = 0;
        const pickMutationValue = (category: string, field: string, options: string[], current: string): string => {
          const prefKey = `_preferred_${field}`;
          const preferred = preferenceWeights[category]?.[prefKey] as unknown as string;
          if (preferred && preferred !== current && options.includes(preferred)) {
            if (Math.random() < 0.6) return preferred;
          }
          const alternatives = options.filter((o: string) => o !== current);
          return alternatives.length > 0 ? alternatives[Math.floor(Math.random() * alternatives.length)] : current;
        };

        for (const [category, fields] of Object.entries(freeGeneOptions)) {
          for (const [field, options] of Object.entries(fields)) {
            if (Math.random() < MUTATION_RATE) {
              genomeData[category][field] = pickMutationValue(category, field, options, genomeData[category]?.[field]);
              mutationCount++;
            }
          }
        }
        for (const [category, fields] of Object.entries(semiFlexGeneOptions)) {
          for (const [field, options] of Object.entries(fields)) {
            if (Math.random() < MUTATION_RATE / 2) {
              genomeData[category][field] = pickMutationValue(category, field, options, genomeData[category]?.[field]);
              mutationCount++;
            }
          }
        }
        if (Math.random() < MUTATION_RATE / 2) {
          const currentEmotion = genomeData.emotion;
          const prefEmotion = preferenceWeights["_emotion"]?.["_preferred_value"] as unknown as string;
          if (prefEmotion && prefEmotion !== currentEmotion && emotionOptions.includes(prefEmotion) && Math.random() < 0.6) {
            genomeData.emotion = prefEmotion;
          } else {
            const altEmotions = emotionOptions.filter((e: string) => e !== currentEmotion);
            genomeData.emotion = altEmotions[Math.floor(Math.random() * altEmotions.length)];
          }
          mutationCount++;
        }

        if (mutationCount > 0) {
          console.log(`Genome Mutation: ${mutationCount} gene(s) mutated (preference-biased)`);
        }

        // --- BRAND LOCK ENFORCEMENT ---
        // Override locked genes with actual brand values to prevent genome contradicting brand
        if (brand) {
          let lockCount = 0;

          // Lock color genes based on brand colors
          if (brand.primary_colors && brand.primary_colors.length > 0) {
            const colorAnalysis = analyzeBrandColors(brand.primary_colors);
            // Lock temperature and saturation to match brand colors
            if (genomeData.color.temperature !== colorAnalysis.temperature) {
              genomeData.color.temperature = colorAnalysis.temperature;
              lockCount++;
            }
            if (genomeData.color.saturation !== colorAnalysis.saturation && !["neon", "muted"].includes(genomeData.color.saturation)) {
              // Only override if genome saturation strongly conflicts (neon/muted are trend-driven, allow those)
              genomeData.color.saturation = colorAnalysis.saturation;
              lockCount++;
            }
          }

          // Lock typography personality based on brand font
          if (brand.typography_primary) {
            const mappedPersonality = mapFontToPersonality(brand.typography_primary);
            if (mappedPersonality && genomeData.typography.font_personality !== mappedPersonality) {
              genomeData.typography.font_personality = mappedPersonality;
              lockCount++;
            }
          }

          if (lockCount > 0) {
            console.log(`Brand Lock: ${lockCount} gene(s) locked to brand values`);
          }
        }

        console.log("Final genome:", JSON.stringify(genomeData));
      } catch (e) {
        console.error("Genome Composer error, proceeding without:", e);
      }

      // Serialize genome into a human-readable styling block for the image prompt
      const genomeContext = genomeData ? `

VISUAL STYLE GENOME (follow these precise styling instructions):
- Color: ${genomeData.color.palette_type.replace(/_/g, " ")} palette, ${genomeData.color.temperature} temperature, ${genomeData.color.contrast} contrast, ${genomeData.color.saturation} saturation, ${genomeData.color.gradient_logic.replace(/_/g, " ")}
- Typography: ${genomeData.typography.font_personality} personality, ${genomeData.typography.weight_system.replace(/_/g, " ")} weight, ${genomeData.typography.hierarchy_logic.replace(/_/g, " ")}, ${genomeData.typography.typography_layout.replace(/_/g, " ")} layout${genomeData.typography.text_effect !== "none" ? `, ${genomeData.typography.text_effect.replace(/_/g, " ")} effect` : ""}
- Layout: ${genomeData.layout.grid_type.replace(/_/g, " ")}, ${genomeData.layout.balance} balance, ${genomeData.layout.spacing_density} density, ${genomeData.layout.content_ratio.replace(/_/g, " ")}
- Composition: ${genomeData.composition.visual_direction} direction, ${genomeData.composition.focal_strategy.replace(/_/g, " ")}, ${genomeData.composition.layering_depth.replace(/_/g, " ")} layering
- Texture: ${genomeData.texture.texture_type.replace(/_/g, " ")}${genomeData.texture.texture_type !== "none" ? `, ${genomeData.texture.intensity} intensity` : ""}${genomeData.texture.distortion !== "none" ? `, ${genomeData.texture.distortion} distortion` : ""}
- Image Style: ${genomeData.image_style.lighting} lighting, ${genomeData.image_style.color_grading} grading, ${genomeData.image_style.framing.replace(/_/g, " ")} framing
- Emotion: ${genomeData.emotion}` : "";

      // --- PARALLEL: COPYWRITER + CAPTION AGENTS ---
      let copyStructure: { headline: string; subheadline: string; cta: string; supporting_text: string } | null = null;
      let captionText: string | null = null;

      const trendPresetForCopy = trend && trend !== "none" ? (({
        "tactile-rebellion": "More expressive and human — use imperfect, authentic, conversational language",
        "hyper-chromatic": "High-energy promotional language — bold, punchy, exclamatory, confident",
        "technical-mono": "Shorter and sharper copy — precise, technical, no-nonsense, data-driven",
        "neo-naturalism": "Calm and soothing tone — gentle, reassuring, mindful, nurturing",
        "kinetic-typography": "Energetic and dynamic — action-oriented verbs, short punchy phrases, momentum-building",
      } as Record<string, string>)[trend] || "") : "";

      // Copywriter Agent (runs in parallel with Caption)
      const copywriterPromise = (async () => {
        try {
          const copywriterPrompt = `You are a world-class brand copywriter. Your job is to write the EXACT text that will appear on a social media graphic.

CONTEXT:
- Design brief: ${designPrompt}
- User's original request: "${userPrompt}"
- Brand name: ${brand?.name || "Unknown"}
- Brand tone of voice: ${brand?.tone_of_voice || "Professional"}
- Brand personality: ${(brand?.personality_traits || []).join(", ") || "Professional"}
- Brand vibe: ${brand?.vibe || "Modern"}
${audienceContext ? `\n${audienceContext}` : ""}
${trendPresetForCopy ? `\nCOPY TONE ADJUSTMENT: ${trendPresetForCopy}` : ""}${canvasFormatCopy}${chatHistoryContext}
${genomeData ? `\nVISUAL DENSITY CONTEXT: The design uses ${genomeData.layout.content_ratio.replace(/_/g, " ")} content ratio with ${genomeData.typography.hierarchy_logic.replace(/_/g, " ")}. Adjust copy length accordingly — text_minimal means fewer words, text_dominant means richer copy.` : ""}

RULES:
1. The copy MUST directly address the user's request topic: "${userPrompt}"
2. Total word count across ALL fields: 15-25 words maximum
3. Use the brand's tone of voice and personality
4. If audience intelligence is provided, leverage emotional drivers and messaging angles for persuasion
5. NEVER use generic filler like "Elevate your brand" or "Take it to the next level" unless that's what the user asked for
6. The headline is the most important element — make it punchy, specific, and on-topic
7. Leave fields empty ("") if they are not needed for this design. Not every design needs all fields.
8. The copy must sound like it was written by the brand, not by a generic AI
${brand?.special_instructions ? `\nSPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY):\n${brand.special_instructions}` : ""}`;

          const copyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: copywriterPrompt },
                { role: "user", content: `Write the exact copy for this design. Return structured JSON only.` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "set_copy",
                  description: "Set the exact copy text for the social media graphic",
                  parameters: {
                    type: "object",
                    properties: {
                      headline: { type: "string", description: "Main headline text (required, 3-8 words)" },
                      subheadline: { type: "string", description: "Supporting subheadline (optional, 3-10 words, empty string if not needed)" },
                      cta: { type: "string", description: "Call to action text (optional, 2-5 words, empty string if not needed)" },
                      supporting_text: { type: "string", description: "Any additional small text (optional, empty string if not needed)" },
                    },
                    required: ["headline", "subheadline", "cta", "supporting_text"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "set_copy" } },
            }),
          });

          if (copyResponse.ok) {
            const copyData = await copyResponse.json();
            const toolCall = copyData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const result = JSON.parse(toolCall.function.arguments);
              console.log("Copywriter output:", JSON.stringify(result));
              return result;
            }
          } else {
            console.error("Copywriter agent failed, falling back to image model copy:", copyResponse.status);
          }
        } catch (e) {
          console.error("Copywriter agent error, falling back:", e);
        }
        return null;
      })();

      // Caption Agent (runs in parallel with Copywriter — uses design brief directly, not copy output)
      const captionPromise = (async () => {
        try {
          const captionSystemPrompt = `You are Brandie's social media caption writer. You write scroll-stopping, brand-aligned captions for social media posts.

BRAND CONTEXT:
- Brand: ${brand?.name || "Unknown"}
- Tone: ${brand?.tone_of_voice || "Professional"}
- Personality: ${(brand?.personality_traits || []).join(", ") || "None"}
- Vibe: ${brand?.vibe || "Modern"}
${audienceContext ? `\n${audienceContext}` : ""}

RULES:
1. Write a ready-to-post caption (2-4 sentences max)
2. Match the brand's tone of voice exactly
3. Include a clear call-to-action or engagement hook
4. Generate 5-10 relevant hashtags mixing popular and niche
5. Use line breaks between caption and hashtags
6. Do NOT use generic filler — every word must serve the brand
7. If audience data is available, use emotional drivers and messaging angles
${brand?.special_instructions ? `\nSPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY):\n${brand.special_instructions}` : ""}`;

          // Caption uses design brief + user prompt directly (no dependency on copywriter)
          const captionUserPrompt = `Write a social media caption for this design:
Brief: ${designPrompt}
User request: "${userPrompt}"`;

          const captionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: captionSystemPrompt },
                { role: "user", content: captionUserPrompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "set_caption",
                  description: "Set the social media caption and hashtags for the design",
                  parameters: {
                    type: "object",
                    properties: {
                      caption: { type: "string", description: "The main caption text (2-4 sentences, ready to post)" },
                      hashtags: {
                        type: "array",
                        items: { type: "string" },
                        description: "5-10 relevant hashtags including the # symbol",
                      },
                    },
                    required: ["caption", "hashtags"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "set_caption" } },
            }),
          });

          if (captionResponse.ok) {
            const captionData = await captionResponse.json();
            const toolCall = captionData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              const result = parsed.caption + "\n\n" + (parsed.hashtags || []).join(" ");
              console.log("Caption Agent output:", result);
              return result;
            }
          } else {
            console.error("Caption agent failed:", captionResponse.status);
          }
        } catch (e) {
          console.error("Caption agent error:", e);
        }
        return null;
      })();

      // Await both in parallel
      const [copyResult, captionResult] = await Promise.all([copywriterPromise, captionPromise]);
      copyStructure = copyResult;
      captionText = captionResult;

      // --- GENOME SCORING ENGINE (using extracted function) ---
      let genomeScores: Record<string, number> | null = null;
      if (genomeData) {
        genomeScores = computeGenomeScores(genomeData, brand, trend, trend_intensity, copyStructure);
        console.log("Genome Scores:", JSON.stringify(genomeScores));
        genomeData._scores = genomeScores;

        // --- DESIGN STABILITY GATE ---
        let stabilityRefined = false;
        if (genomeScores.overall < 55) {
          console.log(`Stability Gate triggered: overall=${genomeScores.overall}, applying deterministic fixes...`);
          const dimensions = ["brand_alignment", "trend_balance", "visual_clarity", "conversion", "visual_balance"];
          const weakest = dimensions.reduce((a, b) => (genomeScores![a] < genomeScores![b] ? a : b));

          if (weakest === "visual_clarity") {
            genomeData.color.contrast = "high";
            genomeData.typography.hierarchy_logic = "strong_headline_dominance";
            genomeData.layout.spacing_density = "balanced";
            genomeData.composition.focal_strategy = "single_focal_point";
            genomeData.texture.distortion = "none";
          } else if (weakest === "brand_alignment") {
            const vibeEmotions: Record<string, string> = { cinematic: "luxurious", minimal: "calm", bold: "energetic", playful: "playful", luxury: "luxurious", corporate: "authoritative" };
            genomeData.emotion = vibeEmotions[(brand?.vibe || "").toLowerCase()] || genomeData.emotion;
            const toneFonts: Record<string, string> = { professional: "corporate", humourous: "friendly", formal: "corporate", casual: "friendly", inspirational: "editorial" };
            genomeData.typography.font_personality = toneFonts[(brand?.tone_of_voice || "").toLowerCase()] || genomeData.typography.font_personality;
          } else if (weakest === "conversion") {
            genomeData.composition.focal_strategy = "single_focal_point";
            genomeData.typography.hierarchy_logic = "strong_headline_dominance";
            if (!["energetic", "authoritative", "rebellious"].includes(genomeData.emotion)) genomeData.emotion = "energetic";
          } else if (weakest === "visual_balance") {
            genomeData.layout.balance = "asymmetrical";
            genomeData.composition.layering_depth = "medium";
            genomeData.layout.spacing_density = "balanced";
          }

          genomeData._refined = true;
          stabilityRefined = true;
          console.log("Stability Gate: genome refined deterministically for", weakest);

          // Re-compute actual scores after fixes (instead of just +15)
          genomeScores = computeGenomeScores(genomeData, brand, trend, trend_intensity, copyStructure);
          console.log("Genome Scores (post-refinement):", JSON.stringify(genomeScores));
          genomeData._scores = genomeScores;
        }
      }

      const copyInjection = copyStructure
        ? `\n\nEXACT TEXT TO RENDER ON THE DESIGN (use these EXACT words, do NOT modify, rephrase, or add ANY other text):
- Headline: "${copyStructure.headline}"${copyStructure.subheadline ? `\n- Subheadline: "${copyStructure.subheadline}"` : ""}${copyStructure.cta ? `\n- CTA: "${copyStructure.cta}"` : ""}${copyStructure.supporting_text ? `\n- Supporting text: "${copyStructure.supporting_text}"` : ""}
CRITICAL: Render ONLY the text listed above. Do NOT invent, add, or modify any text. Every word on the graphic must match exactly.`
        : "";

      // Build image generation content
      const userImageInstruction = user_image_url
        ? ` CRITICAL: The user has provided a reference image (attached). Incorporate it into the design EXACTLY as the user describes. This image is the PRIMARY visual reference and must be used prominently.`
        : "";
      const dimensionEnforcement = size === "1080x1080"
        ? "CRITICAL DIMENSION REQUIREMENT: This image MUST be PERFECTLY SQUARE — equal width and height (1:1 aspect ratio). The canvas is 1080x1080 pixels. Do NOT create a landscape or portrait image. It MUST be a SQUARE."
        : size === "1080x1920"
        ? "CRITICAL DIMENSION REQUIREMENT: This image MUST be TALL PORTRAIT format — 9:16 aspect ratio (1080x1920 pixels). It must be significantly taller than it is wide. Do NOT create a landscape or square image."
        : "CRITICAL DIMENSION REQUIREMENT: This image MUST be WIDE LANDSCAPE format — 16:9 aspect ratio (1920x1080 pixels). It must be significantly wider than it is tall. Do NOT create a square or portrait image.";

      const imagePromptText = `${dimensionEnforcement}\n\nCreate a PHOTOREALISTIC, clean, modern, visually stunning professional social media graphic (${sizeLabel} format, ${w}x${h} pixels). Use REAL PHOTOGRAPHY, natural textures, and lifelike imagery — NOT cartoons, clip art, or flat illustrations — unless the user specifically requests otherwise. The design must be professionally composed with balanced layout, clear visual hierarchy, generous breathing room, and a polished 2026 aesthetic. CRITICAL TEXT CONTRAST RULE: ALL text MUST have excellent colour contrast against its background. When placing text over photographic or busy backgrounds, ALWAYS use a semi-transparent overlay, gradient scrim, or solid colour block behind the text. Light text on dark backgrounds, dark text on light backgrounds — never low-contrast combinations. Readability is non-negotiable.${copyInjection} ${copyStructure ? "" : `CRITICAL TEXT RULES: Only include text that directly serves the user's request and aligns with the brand's value proposition. Do NOT add filler text, random quotes, unnecessary taglines, or decorative text that wasn't asked for. Every word on the design must be intentional and relevant. If the design only needs a headline, do not add extra text elements just to fill space.`} IMPORTANT: The design must be about "${userPrompt}". Use these exact brand colours: primary ${(brand?.primary_colors || []).join(", ")}, secondary ${(brand?.secondary_colors || []).join(", ")}, accent ${(brand?.accent_colors || []).join(", ")}. Fonts: ${brand?.typography_primary || "sans-serif"} and ${brand?.typography_secondary || "serif"}. Tone: ${brand?.tone_of_voice || "Professional"}. ${brand?.logo_url ? "CRITICAL: Include the company logo (provided as attached image) prominently in the design, typically in the bottom or top corner." : ""}${userImageInstruction}${genomeContext || (trendContext ? ` TREND STYLING OVERLAY: Apply the following trend aesthetic as a styling layer on top of the base brand design.${trendContext}` : "")} ${designPrompt}${brand?.special_instructions ? ` SPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY): ${brand.special_instructions}` : ""}`;

      // Collect all image references
      const imageRefs: { type: string; image_url: { url: string } }[] = [];
      if (brand?.logo_url) imageRefs.push({ type: "image_url", image_url: { url: brand.logo_url } });
      if (user_image_url) imageRefs.push({ type: "image_url", image_url: { url: user_image_url } });
      if (action === "edit" && previous_image_url) imageRefs.push({ type: "image_url", image_url: { url: previous_image_url } });
      for (const inspUrl of inspirationUrls.slice(0, 2)) {
        imageRefs.push({ type: "image_url", image_url: { url: inspUrl } });
      }
      const productKeywords = /product|promo|promotion|offer|sale|showcase|launch|discount|deal|shop|buy|order|new arrival|collection|menu|service/i;
      const isProductRelevant = productKeywords.test(userPrompt) || productKeywords.test(designPrompt);
      if (isProductRelevant && productImageUrls.length > 0 && !user_image_url) {
        for (const prodUrl of productImageUrls.slice(0, 2)) {
          imageRefs.push({ type: "image_url", image_url: { url: prodUrl } });
        }
        console.log(`Product images injected: ${Math.min(2, productImageUrls.length)} (prompt matched product context)`);
      }

      const imageContent = imageRefs.length > 0
        ? [
            { type: "text", text: imagePromptText + (action === "edit" && previous_image_url ? " EDIT: Keep the overall layout similar to the previous design but apply the user's changes." : "") },
            ...imageRefs,
          ]
        : imagePromptText;

      // Image Renderer (with retry)
      const imageResponse = await retryFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: render_quality === "hd" ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: imageContent,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!imageResponse.ok) {
        if (imageResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (imageResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await imageResponse.text();
        console.error("Image generation error:", imageResponse.status, errText);
        throw new Error("Failed to generate image");
      }

      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageBase64) {
        throw new Error("No image was generated. Try a different prompt.");
      }

      let base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      let binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // --- POST-PROCESS: Log actual dimensions from PNG header ---
      const targetW = parseInt(w);
      const targetH = parseInt(h);
      try {
        if (binaryData.length > 24 && binaryData[1] === 0x50 && binaryData[2] === 0x4E && binaryData[3] === 0x47) {
          const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
          const actualW = view.getUint32(16, false);
          const actualH = view.getUint32(20, false);
          console.log(`Generated image dimensions: ${actualW}x${actualH}, target: ${targetW}x${targetH}`);
        }
      } catch (dimErr) {
        console.error("Dimension check failed:", dimErr);
      }

      const filePath = `${user.id}/${crypto.randomUUID()}.png`;

      const { error: uploadError } = await adminClient.storage
        .from("designs")
        .upload(filePath, binaryData, { contentType: "image/png" });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to save generated image");
      }

      const { data: urlData } = adminClient.storage.from("designs").getPublicUrl(filePath);

      const wasRefined = genomeData?._refined === true;

      return new Response(
        JSON.stringify({
          image_url: urlData.publicUrl,
          explanation,
          design_prompt: designPrompt,
          free_edit: isFreeEdit,
          ...(copyStructure ? { copy_structure: copyStructure } : {}),
          ...(genomeData ? { genome: genomeData } : {}),
          ...(genomeScores ? { genome_scores: genomeScores } : {}),
          refined: wasRefined,
          ...(captionText ? { caption: captionText } : {}),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("design-studio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
