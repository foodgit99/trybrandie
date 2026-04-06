import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine which delivery window this invocation is for
    let deliveryWindow = "morning"; // default
    try {
      const body = await req.json();
      if (body?.delivery_time) deliveryWindow = body.delivery_time;
    } catch { /* no body or invalid JSON — use default */ }

    console.log(`[autopilot] Running for delivery_time=${deliveryWindow}`);

    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];
    console.log(`[autopilot] Date: ${today}`);

    // Fetch all autopilot ideas scheduled for today
    const { data: ideas, error: ideasErr } = await supabase
      .from("content_ideas")
      .select("*")
      .eq("autopilot", true)
      .eq("scheduled_for", today)
      .in("status", ["suggested", "scheduled"]);

    if (ideasErr) {
      console.error("[autopilot] Failed to fetch ideas:", ideasErr);
      return new Response(JSON.stringify({ error: ideasErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ideas || ideas.length === 0) {
      console.log("[autopilot] No autopilot ideas for today.");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch autopilot_settings for all relevant brands to filter by delivery_time
    const brandIds = [...new Set(ideas.map((i: any) => i.brand_id))];
    const { data: allSettings } = await supabase
      .from("autopilot_settings")
      .select("brand_id, delivery_time, timezone")
      .in("brand_id", brandIds);

    // Map of delivery_time windows to their UTC trigger hours
    const windowUtcHours: Record<string, number> = { morning: 6, afternoon: 12, evening: 18 };

    const settingsMap = new Map<string, { delivery_time: string; timezone: string }>();
    for (const s of allSettings || []) {
      settingsMap.set(s.brand_id, {
        delivery_time: s.delivery_time || "morning",
        timezone: s.timezone || "Africa/Lagos",
      });
    }

    // Filter ideas: check if the current UTC hour matches the brand's
    // desired delivery time converted from their local timezone to UTC.
    const nowUtc = new Date();
    const currentUtcHour = nowUtc.getUTCHours();

    const filteredIdeas = ideas.filter((idea: any) => {
      const settings = settingsMap.get(idea.brand_id) || { delivery_time: "morning", timezone: "Africa/Lagos" };
      // Only process if the delivery_time label matches the invocation window
      if (settings.delivery_time !== deliveryWindow) return false;

      // Calculate what UTC hour the brand's local delivery time corresponds to
      const localHour = windowUtcHours[settings.delivery_time] ?? 6;
      // Get the timezone offset by formatting a date in that timezone
      const formatter = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, hour: "numeric", hour12: false });
      const localNowHour = parseInt(formatter.format(nowUtc), 10);
      const offsetHours = localNowHour - currentUtcHour;
      const targetUtcHour = ((localHour - offsetHours) % 24 + 24) % 24;

      // Allow a 2-hour window around the target UTC hour to account for cron timing
      const diff = Math.abs(currentUtcHour - targetUtcHour);
      const hourDiff = Math.min(diff, 24 - diff);
      return hourDiff <= 1;
    });

    if (filteredIdeas.length === 0) {
      console.log(`[autopilot] No ideas for delivery_time=${deliveryWindow}`);
      return new Response(JSON.stringify({ processed: 0, delivery_time: deliveryWindow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[autopilot] ${filteredIdeas.length} ideas match delivery_time=${deliveryWindow}`);

    console.log(`[autopilot] Found ${filteredIdeas.length} ideas to process`);

    let processed = 0;
    let skipped = 0;

    for (const idea of filteredIdeas) {
      try {
        // Load brand
        const { data: brand } = await supabase
          .from("brands")
          .select("*")
          .eq("id", idea.brand_id)
          .single();

        if (!brand) {
          console.warn(`[autopilot] No brand found for idea ${idea.id}`);
          continue;
        }

        // Load user profile for credits check
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", idea.user_id)
          .single();

        if (!profile) {
          console.warn(`[autopilot] No profile for user ${idea.user_id}`);
          continue;
        }

        // Get user email
        const { data: authUser } = await supabase.auth.admin.getUserById(idea.user_id);
        const userEmail = authUser?.user?.email;

        // Load audience (optional)
        const { data: audience } = await supabase
          .from("target_audiences")
          .select("jtbd_profile, label")
          .eq("brand_id", idea.brand_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        // Load trend preferences (optional)
        const { data: trendPref } = await supabase
          .from("brand_trend_preferences")
          .select("selected_trend, default_trend_intensity, trend_enabled")
          .eq("brand_id", idea.brand_id)
          .maybeSingle();

        // Call design-studio internally via service role
        const designPayload: Record<string, any> = {
          user_id: idea.user_id,
          action: "generate",
          canvas_size: "1080x1080",
          render_quality: "fast",
          messages: [{ role: "user", content: idea.prompt }],
          brand: {
            id: brand.id,
            name: brand.name,
            tagline: brand.tagline,
            description: brand.description,
            vibe: brand.vibe,
            tone_of_voice: brand.tone_of_voice,
            personality_traits: brand.personality_traits,
            primary_colors: brand.primary_colors,
            secondary_colors: brand.secondary_colors,
            accent_colors: brand.accent_colors,
            typography_primary: brand.typography_primary,
            typography_secondary: brand.typography_secondary,
            typography_display: brand.typography_display,
            logo_url: brand.logo_url,
            special_instructions: brand.special_instructions,
          },
        };

        if (audience?.jtbd_profile) {
          designPayload.audience_id = audience.label || "primary";
        }

        if (trendPref?.trend_enabled && trendPref.selected_trend && trendPref.selected_trend !== "none") {
          designPayload.trend = trendPref.selected_trend;
          designPayload.trend_intensity = trendPref.default_trend_intensity || 40;
        }

        // Call design-studio edge function
        const designRes = await fetch(`${supabaseUrl}/functions/v1/design-studio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(designPayload),
        });

        if (!designRes.ok) {
          const errBody = await designRes.text();
          console.error(`[autopilot] design-studio failed for idea ${idea.id}: ${designRes.status} ${errBody}`);

          // If 402 (no credits), notify user and skip
          if (designRes.status === 402 && userEmail) {
            await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                type: "autopilot_no_credits",
                to: userEmail,
                data: { idea_title: idea.title },
              }),
            }).catch(() => {});
          }
          skipped++;
          continue;
        }

        const designData = await designRes.json();

        if (!designData?.image_url) {
          console.error(`[autopilot] No image_url returned for idea ${idea.id}`);
          skipped++;
          continue;
        }

        // Save design to designs table
        const { data: savedDesign, error: saveErr } = await supabase
          .from("designs")
          .insert({
            user_id: idea.user_id,
            brand_id: idea.brand_id,
            title: idea.title.slice(0, 100),
            prompt: designData.design_prompt || idea.prompt,
            image_url: designData.image_url,
            canvas_size: "1080x1080",
            vote: 0,
            ...(designData.genome && { genome: designData.genome }),
            ...(designData.caption && { caption: designData.caption }),
            ...(designData.copy_structure && { copy_structure: designData.copy_structure }),
            ...(trendPref?.trend_enabled && trendPref.selected_trend !== "none" && {
              trend_used: trendPref.selected_trend,
              trend_intensity: trendPref.default_trend_intensity,
            }),
          })
          .select("id")
          .single();

        if (saveErr) {
          console.error(`[autopilot] Failed to save design for idea ${idea.id}:`, saveErr);
          skipped++;
          continue;
        }

        // Update content_ideas with design_id and status
        await supabase
          .from("content_ideas")
          .update({
            design_id: savedDesign.id,
            status: "created",
          })
          .eq("id", idea.id);

        // Send email notification
        if (userEmail) {
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              type: "autopilot_design_ready",
              to: userEmail,
              data: {
                idea_title: idea.title,
                image_url: designData.image_url,
                design_id: savedDesign.id,
              },
            }),
          }).catch((e) => console.error(`[autopilot] Email failed for idea ${idea.id}:`, e));
        }

        processed++;
        console.log(`[autopilot] ✅ Processed idea ${idea.id} → design ${savedDesign.id}`);
      } catch (ideaErr) {
        console.error(`[autopilot] Error processing idea ${idea.id}:`, ideaErr);
        skipped++;
      }
    }

    console.log(`[autopilot] Done (${deliveryWindow}). Processed: ${processed}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ processed, skipped, total: filteredIdeas.length, delivery_time: deliveryWindow }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[autopilot] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
