// v2-edit-router — Conversational edit dispatcher for the Blueprint composer.
// Classifies the user's natural-language instruction with Lovable AI (Flash-Lite)
// then dispatches to the right surface: text rewrite, visual regen, or full strategy
// cascade. Avoids regenerating the full design when a partial edit suffices.
// PRD §7 "Edit Decision Tree".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classifyEditIntent, type EditKind } from "../_shared/edit-intent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = EditKind;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuthed = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAuthed.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { idea_id, instruction } = body as { idea_id?: string; instruction?: string };
    if (!idea_id || !instruction || instruction.length < 3) {
      return new Response(JSON.stringify({ error: "missing idea_id or instruction" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Ownership check
    const { data: idea, error: ideaErr } = await supabase
      .from("content_ideas")
      .select("id, brand_id, user_id, title, prompt, design_id")
      .eq("id", idea_id)
      .single();
    if (ideaErr || !idea) {
      return new Response(JSON.stringify({ error: "idea not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (idea.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { kind, rewritten_title, rewritten_prompt } = classifyEditIntent(instruction);

    // Dispatch — common rule: never wipe a design unless the kind demands a regen.
    const patch: Record<string, unknown> = {
      title: rewritten_title || idea.title,
      prompt: rewritten_prompt || idea.prompt,
      approval_status: "pending",
    };

    if (kind === "visual" || kind === "strategy") {
      // Drop the rendered asset so it'll be re-rendered on next open.
      patch.design_id = null;
      patch.status = "draft";
    }
    // "text" — keep design_id; only the caption changes (frontend can show the
    // rewritten prompt; design renderer respects new caption on next regen).

    const { error: upErr } = await supabase
      .from("content_ideas")
      .update(patch)
      .eq("id", idea_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, kind, title: rewritten_title, prompt: rewritten_prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[v2-edit-router] fatal:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
