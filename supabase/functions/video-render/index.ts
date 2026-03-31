import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VEO_MODEL = "veo-3.1-generate-preview";
const VEO_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface SceneRow {
  id: string;
  scene_index: number;
  description: string;
  image_url: string | null;
  duration_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user.id;

    const body = await req.json();
    const { video_project_id } = body;

    if (!video_project_id) {
      return new Response(JSON.stringify({ error: "video_project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: project, error: projErr } = await supabaseAdmin
      .from("video_projects")
      .select("id, user_id, intent, brand_id, render_status")
      .eq("id", video_project_id)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (project.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (project.render_status === "rendering") {
      return new Response(JSON.stringify({ error: "Render already in progress" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credits (5 for render)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("generations_count, generations_reset_at, bonus_credits, subscription_tier")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const tierLimits: Record<string, number> = { free: 10, entrepreneur: 50, creator: 150, agency: 400 };
      const limit = tierLimits[profile.subscription_tier || "free"] || 10;
      const resetAt = new Date(profile.generations_reset_at);
      const now = new Date();
      let count = profile.generations_count;
      if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
        count = 0;
      }
      const bonus = profile.bonus_credits ?? 0;
      if (count + 5 > limit + bonus) {
        return new Response(JSON.stringify({ error: "Insufficient credits. Video rendering requires 5 credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get scenes
    const { data: scenes, error: scenesErr } = await supabaseAdmin
      .from("video_scenes")
      .select("id, scene_index, description, image_url, duration_ms")
      .eq("video_project_id", video_project_id)
      .order("scene_index", { ascending: true });

    if (scenesErr || !scenes || scenes.length === 0) {
      return new Response(JSON.stringify({ error: "No scenes found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as rendering
    await supabaseAdmin
      .from("video_projects")
      .update({ render_status: "rendering" })
      .eq("id", video_project_id);

    // Get aspect ratio from intent
    const platform = project.intent?.platform || "instagram";
    const aspectRatio = ["tiktok", "reels", "youtube_shorts"].includes(platform) ? "9:16" : "16:9";

    // Render each scene sequentially
    const sceneVideoUrls: string[] = [];

    for (const scene of scenes as SceneRow[]) {
      try {
        const durationSeconds = Math.min(8, Math.max(5, Math.round(scene.duration_ms / 1000)));

        // Submit to Veo
        const generateRes = await fetch(
          `${VEO_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${GOOGLE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{ prompt: scene.description }],
              parameters: {
                aspectRatio,
                durationSeconds,
                sampleCount: 1,
              },
            }),
          }
        );

        if (!generateRes.ok) {
          const errText = await generateRes.text();
          console.error(`Veo generation failed for scene ${scene.scene_index}:`, errText);
          continue;
        }

        const operation = await generateRes.json();
        const operationName = operation.name;

        if (!operationName) {
          console.error(`No operation name for scene ${scene.scene_index}`);
          continue;
        }

        // Poll for completion (up to 10 minutes per scene)
        let done = false;
        let result: any = null;
        const maxAttempts = 60; // 60 * 10s = 10 minutes
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise((r) => setTimeout(r, 10000)); // 10s

          const pollRes = await fetch(
            `${VEO_BASE}/${operationName}?key=${GOOGLE_AI_API_KEY}`
          );

          if (!pollRes.ok) {
            console.error(`Poll failed for scene ${scene.scene_index}:`, await pollRes.text());
            continue;
          }

          result = await pollRes.json();
          if (result.done) {
            done = true;
            break;
          }
        }

        if (!done || !result?.response) {
          console.error(`Scene ${scene.scene_index} timed out or failed`);
          continue;
        }

        // Extract video data
        const videoData = result.response?.generatedSamples?.[0]?.video;
        if (!videoData?.bytesBase64Encoded) {
          console.error(`No video data for scene ${scene.scene_index}`);
          continue;
        }

        // Decode base64 and upload to storage
        const binaryString = atob(videoData.bytesBase64Encoded);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const storagePath = `video-renders/${video_project_id}/scene-${scene.scene_index}.mp4`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("designs")
          .upload(storagePath, bytes, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`Upload failed for scene ${scene.scene_index}:`, uploadErr.message);
          continue;
        }

        const { data: urlData } = supabaseAdmin.storage.from("designs").getPublicUrl(storagePath);
        const videoUrl = urlData.publicUrl;

        // Update scene with video URL
        await supabaseAdmin
          .from("video_scenes")
          .update({ video_url: videoUrl })
          .eq("id", scene.id);

        sceneVideoUrls.push(videoUrl);
      } catch (sceneErr) {
        console.error(`Error rendering scene ${scene.scene_index}:`, sceneErr);
      }
    }

    // Use first scene video as the "rendered" video for now
    // (Full stitching would require ffmpeg which isn't available in edge functions)
    const renderedVideoUrl = sceneVideoUrls.length > 0 ? sceneVideoUrls[0] : null;

    // Update project status
    const finalStatus = sceneVideoUrls.length > 0 ? "rendered" : "failed";
    await supabaseAdmin
      .from("video_projects")
      .update({
        render_status: finalStatus,
        rendered_video_url: renderedVideoUrl,
      })
      .eq("id", video_project_id);

    // Deduct credits
    if (sceneVideoUrls.length > 0) {
      const resetAt = new Date(profile?.generations_reset_at || new Date());
      const now = new Date();
      const currentCount = (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear())
        ? 0
        : (profile?.generations_count || 0);

      await supabaseAdmin
        .from("profiles")
        .update({
          generations_count: currentCount + 5,
          generations_reset_at: now.toISOString(),
        })
        .eq("user_id", userId);

      await supabaseAdmin
        .from("video_projects")
        .update({ credits_used: 8 }) // 3 storyboard + 5 render
        .eq("id", video_project_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        render_status: finalStatus,
        rendered_video_url: renderedVideoUrl,
        scenes_rendered: sceneVideoUrls.length,
        total_scenes: scenes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("video-render error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
