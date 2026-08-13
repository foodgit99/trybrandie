// Brandie Structured Design Engine (pilot, /studio only).
//
// Pipeline:
//   prompt + brand + genome
//        -> Creative Director (LLM)  -> Brandie Design Schema + asset requests
//        -> Asset generation (image model, ART ONLY, never text)
//        -> Canvas renderer (schema -> SVG -> PNG)
//        -> designs row (image_url + design_schema) + revision history
//
// Actions: generate | edit | rerender | revisions
// This function is intentionally standalone: the legacy design-studio /
// autopilot / cockpit pipeline is untouched.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  applyPatch,
  BDS_VERSION,
  type DesignSchema,
  headingFontFor,
  normaliseSchema,
  overlapReport,
  renderSchemaToPng,
  type SchemaPatchOp,
} from "../_shared/design-schema.ts";
import { callWithFallback, MODEL_CHAINS } from "../_shared/model-fallback.ts";
import { creditGate } from "../_shared/credit-gate.ts";
import {
  applyGenomeDecor,
  artStyleSuffix,
  genomeDirective,
  resolveGenome,
} from "../_shared/design-art-direction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const ASSET_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
];

const SIZES: Record<string, { w: number; h: number }> = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1350": { w: 1080, h: 1350 },
  "1080x1920": { w: 1080, h: 1920 },
  "1200x628": { w: 1200, h: 628 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sizeFor(canvasSize?: string) {
  return SIZES[canvasSize || "1080x1080"] || SIZES["1080x1080"];
}

function imageSizeFor(w: number, h: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const r = w / h;
  if (r > 1.15) return "1536x1024";
  if (r < 0.87) return "1024x1536";
  return "1024x1024";
}

const NO_TEXT_RULE =
  "ABSOLUTE RULE: the image must contain NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks, NO UI, NO captions anywhere. " +
  "It is a raw art asset that Brandie will compose typography on top of. Leave calm, uncluttered areas for text.";

// ---------------------------------------------------------------- asset gen

async function generateAsset(
  apiKey: string,
  prompt: string,
  w: number,
  h: number,
): Promise<Uint8Array | null> {
  const size = imageSizeFor(w, h);
  for (const model of ASSET_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch(`${GATEWAY}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: `${prompt}\n\n${NO_TEXT_RULE}` }],
          modalities: ["image", "text"],
          size,
          n: 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
      if (!res.ok) {
        console.warn(`[asset] ${model} failed ${res.status}`);
        continue;
      }
      const data = await res.json();
      const b64: string | undefined = data?.data?.[0]?.b64_json;
      if (!b64) continue;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.message === "CREDITS_EXHAUSTED") throw e;
      console.warn(`[asset] ${model} threw`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function upload(admin: any, userId: string, bytes: Uint8Array, tag: string): Promise<string | null> {
  const path = `${userId}/${tag}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  const { error } = await admin.storage.from("designs").upload(path, bytes, { contentType: "image/png" });
  if (error) {
    console.error("[upload] failed:", error.message);
    return null;
  }
  const { data } = admin.storage.from("designs").getPublicUrl(path);
  return data?.publicUrl || null;
}

// ---------------------------------------------------------------- CD prompt

const SCHEMA_TOOL = {
  type: "function",
  function: {
    name: "set_design",
    description: "Emit the complete Brandie Design Schema for one social graphic.",
    parameters: {
      type: "object",
      properties: {
        rationale: { type: "string", description: "One sentence on the design decision." },
        caption: { type: "string", description: "20-30 word social caption for this post." },
        heading_personality: {
          type: "string",
          enum: ["corporate", "friendly", "futuristic", "street", "editorial"],
        },
        background: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["solid", "gradient", "image"] },
            color: { type: "string", description: "hex" },
            color2: { type: "string", description: "hex, gradient only" },
            angle: { type: "number" },
            source: { type: "string", description: "asset key, image backgrounds only" },
            overlay_color: { type: "string", description: "hex scrim over an image background" },
            overlay_opacity: { type: "number" },
          },
          required: ["type"],
          additionalProperties: false,
        },
        asset_requests: {
          type: "array",
          description:
            "Art assets to generate (max 2). Photography/illustration only — never text. Use key 'bg_art' for a background and 'hero_art' for a focal subject.",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              prompt: { type: "string" },
              orientation: { type: "string", enum: ["square", "portrait", "landscape"] },
            },
            required: ["key", "prompt"],
            additionalProperties: false,
          },
        },
        elements: {
          type: "array",
          description: "Ordered design elements. Coordinates are absolute pixels on the canvas.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["text", "image", "logo", "shape", "button"] },
              role: {
                type: "string",
                enum: ["headline", "subhead", "body", "cta", "product", "logo", "decor"],
              },
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
              z: { type: "number" },
              opacity: { type: "number" },
              content: { type: "string", description: "text / button label" },
              font: { type: "string", enum: ["heading", "body"] },
              fontSize: { type: "number" },
              weight: { type: "number", enum: [400, 500, 600, 700] },
              color: { type: "string" },
              align: { type: "string", enum: ["left", "center", "right"] },
              lineHeight: { type: "number" },
              uppercase: { type: "boolean" },
              maxLines: { type: "number" },
              source: { type: "string", description: "asset key for image/logo elements" },
              fit: { type: "string", enum: ["cover", "contain"] },
              radius: { type: "number" },
              shape: { type: "string", enum: ["rect", "ellipse", "line"] },
              fill: { type: "string" },
              textColor: { type: "string" },
            },
            required: ["id", "type", "role", "x", "y", "w", "h"],
            additionalProperties: false,
          },
        },
      },
      required: ["rationale", "caption", "heading_personality", "background", "elements"],
      additionalProperties: false,
    },
  },
};

const PATCH_TOOL = {
  type: "function",
  function: {
    name: "patch_design",
    description: "Modify specific elements of an existing Brandie Design Schema. Change only what was asked.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One short sentence describing the change made." },
        ops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["set", "delete", "duplicate", "reorder"] },
              id: {
                type: "string",
                description: "element id, or 'background' / 'canvas' for those objects",
              },
              props: { type: "string", description: "JSON object string of properties to set" },
              z: { type: "number" },
            },
            required: ["op", "id"],
            additionalProperties: false,
          },
        },
        asset_requests: {
          type: "array",
          description: "Only when new artwork is genuinely required (max 1).",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              prompt: { type: "string" },
              orientation: { type: "string", enum: ["square", "portrait", "landscape"] },
            },
            required: ["key", "prompt"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "ops"],
      additionalProperties: false,
    },
  },
};

function designSystemPrompt(w: number, h: number) {
  return `You are Brandie's Creative Director. You do not write image prompts — you produce a DESIGN DOCUMENT: an exact, production-ready layout for a ${w}x${h}px social graphic.

Rules you must obey:
- Coordinates are absolute pixels inside 0,0 → ${w},${h}. Nothing may sit outside the canvas.
- Keep a safe margin of at least ${Math.round(w * 0.07)}px on every edge.
- Text elements: give each a generous box (w/h) so long copy can wrap. Set maxLines honestly.
- Strong hierarchy: exactly ONE headline, at ${Math.round(h * 0.055)}–${Math.round(h * 0.11)}px. Subhead roughly 35–45% of the headline size. CTA button height ${Math.round(h * 0.06)}–${Math.round(h * 0.085)}px.
- Never overlap two text boxes. Text over photography must sit on a scrim, solid shape, or a calm region.
- EVERY text element MUST include an explicit "color", and every button MUST include "fill" and "textColor". Never omit them.
- Use only brand colours supplied plus white/near-black. Contrast rule: on a dark background use #FFFFFF (or a very light brand tint) for copy; on a light background use near-black. Never place dark text on a dark background or light text on a light background.
- Place the brand logo (asset key "brand_logo") as a type:"logo" element, small, in a corner, when a logo is available.
- Product/gallery images available to you are listed as asset keys — prefer them over generating new art.
- Only request generated art when the design genuinely needs photography, texture or an illustrated background. Requested art NEVER contains text.
- Copy is yours to write: short, concrete, benefit-led. Headline max 7 words. Subhead max 14 words. CTA max 3 words.
- Output must validate against the tool schema exactly. No extra fields.`;
}

function brandBlock(brand: any, extra: Record<string, unknown>) {
  const primary = (brand?.primary_colors || []) as string[];
  const accent = (brand?.accent_colors || []) as string[];
  return [
    `Brand: ${brand?.name || "Unnamed"}`,
    brand?.description ? `About: ${String(brand.description).slice(0, 300)}` : "",
    brand?.vibe ? `Vibe: ${brand.vibe}` : "",
    brand?.tone_of_voice ? `Tone: ${brand.tone_of_voice}` : "",
    primary.length ? `Primary colours: ${primary.slice(0, 3).join(", ")}` : "",
    accent.length ? `Accent colours: ${accent.slice(0, 2).join(", ")}` : "",
    ...Object.entries(extra).map(([k, v]) => (v ? `${k}: ${String(v).slice(0, 400)}` : "")),
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------- handler

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body?.action || "generate";

    // ---------------------------------------------------------- revisions
    if (action === "revisions") {
      const { data } = await admin
        .from("design_schema_revisions")
        .select("id, label, image_url, created_at, schema")
        .eq("design_id", body.design_id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return json({ revisions: data || [] });
    }

    const persist = async (
      schema: DesignSchema,
      imageUrl: string,
      opts: { designId?: string | null; brandId?: string | null; title: string; caption?: string | null; label: string; prompt?: string; canvasSize: string },
    ) => {
      let designId = opts.designId || null;
      if (designId) {
        await admin
          .from("designs")
          .update({
            image_url: imageUrl,
            design_schema: schema,
            design_schema_version: BDS_VERSION,
            canvas_size: opts.canvasSize,
            ...(opts.caption ? { caption: opts.caption } : {}),
          })
          .eq("id", designId)
          .eq("user_id", user.id);
      } else {
        const { data: row, error } = await admin
          .from("designs")
          .insert({
            user_id: user.id,
            brand_id: opts.brandId || null,
            title: opts.title.slice(0, 100) || "Untitled",
            prompt: (opts.prompt || opts.title).slice(0, 2000),
            image_url: imageUrl,
            canvas_size: opts.canvasSize,
            vote: 0,
            design_schema: schema,
            design_schema_version: BDS_VERSION,
            ...(opts.caption ? { caption: opts.caption } : {}),
          })
          .select("id")
          .single();
        if (error) console.error("[persist] insert failed:", error.message);
        designId = row?.id || null;
      }
      if (designId) {
        await admin.from("design_schema_revisions").insert({
          design_id: designId,
          user_id: user.id,
          schema,
          image_url: imageUrl,
          label: opts.label,
        });
      }
      return designId;
    };

    // ---------------------------------------------------------- rerender
    // Manual editor saves: no AI call, no credit — just re-render the document.
    if (action === "rerender") {
      const canvasSize = body.canvas_size || "1080x1080";
      const { w, h } = sizeFor(canvasSize);
      const schema = normaliseSchema(body.schema, { width: w, height: h });
      const png = await renderSchemaToPng(schema);
      const imageUrl = await upload(admin, user.id, png, "bds");
      if (!imageUrl) return json({ error: "Failed to store rendered image" }, 500);
      const designId = await persist(schema, imageUrl, {
        designId: body.design_id,
        brandId: body.brand_id,
        title: body.title || "Untitled",
        canvasSize,
        label: body.label || "Manual edit",
      });
      return json({ schema, image_url: imageUrl, design_id: designId, warnings: overlapReport(schema) });
    }

    // ---------------------------------------------------------- edit (AI)
    if (action === "edit") {
      const canvasSize = body.canvas_size || "1080x1080";
      const { w, h } = sizeFor(canvasSize);
      const current = normaliseSchema(body.schema, { width: w, height: h });
      const instruction = String(body.instruction || "").slice(0, 1000);
      if (!instruction.trim()) return json({ error: "Missing instruction" }, 400);

      const inventory = current.elements
        .map((e) =>
          `- ${e.id} (${e.type}/${e.role}) box ${Math.round(e.x)},${Math.round(e.y)} ${Math.round(e.w)}x${Math.round(e.h)}` +
          ("content" in e ? ` text:"${String((e as any).content).slice(0, 60)}"` : "") +
          ("fontSize" in e ? ` size:${(e as any).fontSize}` : "") +
          ("color" in e ? ` colour:${(e as any).color}` : ""),
        )
        .join("\n");

      const { response, modelUsed } = await callWithFallback(
        MODEL_CHAINS.reasoning,
        (model) => ({
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: `You edit an existing Brandie Design Schema on a ${w}x${h}px canvas by emitting the SMALLEST set of ops that satisfies the request. Never rebuild the design. Never touch elements the user did not mention. Keep everything inside the canvas with a ${Math.round(w * 0.07)}px margin, keep text readable and non-overlapping. "props" must be a JSON object string, e.g. {"fontSize":68}.`,
              },
              {
                role: "user",
                content: `Canvas: ${w}x${h}\nBackground: ${JSON.stringify(current.background)}\nElements:\n${inventory}\n\nUser request: "${instruction}"`,
              },
            ],
            tools: [PATCH_TOOL],
            tool_choice: { type: "function", function: { name: "patch_design" } },
          }),
        }),
        `${GATEWAY}/chat/completions`,
        apiKey,
      );

      if (!response.ok) {
        const status = response.status === 429 ? 503 : response.status === 402 ? 402 : 500;
        return json({ error: status === 402 ? "AI credits exhausted." : "The editor is busy — try again." }, status);
      }
      const data = await response.json();
      const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return json({ error: "Could not interpret that edit." }, 422);
      const parsed = JSON.parse(args);

      const ops: SchemaPatchOp[] = (parsed.ops || []).map((o: any) => ({
        op: o.op,
        id: o.id,
        z: o.z,
        props: (() => {
          if (!o.props) return undefined;
          if (typeof o.props === "object") return o.props;
          try {
            return JSON.parse(o.props);
          } catch {
            return undefined;
          }
        })(),
      }));

      let next = applyPatch(current, ops);

      // Optional new artwork for this edit (charged 1 credit).
      const reqs = (parsed.asset_requests || []).slice(0, 1);
      if (reqs.length) {
        const gate = await creditGate(admin, user.id, 1);
        if (!gate.ok) return json({ error: "Not enough credits for new artwork." }, 402);
        for (const r of reqs) {
          const bytes = await generateAsset(apiKey, r.prompt, w, h);
          if (!bytes) continue;
          const url = await upload(admin, user.id, bytes, "asset");
          if (url) next.assets = { ...(next.assets || {}), [r.key]: url };
        }
        await gate.charge();
      }

      const png = await renderSchemaToPng(next);
      const imageUrl = await upload(admin, user.id, png, "bds");
      if (!imageUrl) return json({ error: "Failed to store rendered image" }, 500);
      const designId = await persist(next, imageUrl, {
        designId: body.design_id,
        brandId: body.brand_id,
        title: body.title || "Untitled",
        canvasSize,
        label: parsed.summary || "AI edit",
      });

      return json({
        schema: next,
        image_url: imageUrl,
        design_id: designId,
        summary: parsed.summary || "Updated.",
        ops,
        model: modelUsed,
        warnings: overlapReport(next),
      });
    }

    // ---------------------------------------------------------- generate
    if (action !== "generate") return json({ error: "Unknown action" }, 400);

    const prompt = String(body.prompt || "").slice(0, 2000);
    if (!prompt.trim()) return json({ error: "Missing prompt" }, 400);
    const canvasSize = body.canvas_size || "1080x1080";
    const { w, h } = sizeFor(canvasSize);
    const brand = body.brand || {};

    const gate = await creditGate(admin, user.id, 2);
    if (!gate.ok) {
      return json({ error: "Not enough credits. Please upgrade your plan or purchase more credits." }, 402);
    }

    // Gallery / product / logo assets available to the Creative Director.
    const gallery: Array<{ url: string; label?: string; role?: string }> = Array.isArray(body.gallery)
      ? body.gallery.slice(0, 6)
      : [];
    const assets: Record<string, string> = {};
    const assetLines: string[] = [];
    if (brand?.logo_url) {
      assets["brand_logo"] = brand.logo_url;
      assetLines.push(`- brand_logo (the brand logo, use as type "logo")`);
    }
    gallery.forEach((g, i) => {
      if (!g?.url) return;
      const key = `gallery_${i + 1}`;
      assets[key] = g.url;
      assetLines.push(`- ${key}${g.label ? ` — ${g.label}` : ""}${g.role ? ` (${g.role})` : ""}`);
    });

    const userBlock = `${brandBlock(brand, {
      Audience: body.audience_summary,
      Genome: body.genome ? JSON.stringify(body.genome).slice(0, 800) : "",
      Trend: body.trend,
      Category: body.content_category,
    })}

Available asset keys (prefer these over generating art):
${assetLines.length ? assetLines.join("\n") : "- none"}

Design request: "${prompt}"`;

    const { response, modelUsed } = await callWithFallback(
      MODEL_CHAINS.reasoning,
      (model) => ({
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: designSystemPrompt(w, h) },
            { role: "user", content: userBlock },
          ],
          tools: [SCHEMA_TOOL],
          tool_choice: { type: "function", function: { name: "set_design" } },
        }),
      }),
      `${GATEWAY}/chat/completions`,
      apiKey,
    );

    if (!response.ok) {
      const status = response.status === 402 ? 402 : response.status === 429 ? 503 : 500;
      return json(
        { error: status === 402 ? "AI credits exhausted." : "The design engine is busy — please retry." },
        status,
      );
    }
    const data = await response.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: "The Creative Director returned no design." }, 502);
    const cd = JSON.parse(args);

    // ------- asset generation (art only, max 2)
    const requests = (cd.asset_requests || []).slice(0, 2);
    for (const r of requests) {
      if (!r?.key || !r?.prompt) continue;
      const dims =
        r.orientation === "portrait"
          ? { w: 1024, h: 1536 }
          : r.orientation === "landscape"
            ? { w: 1536, h: 1024 }
            : { w, h };
      try {
        const bytes = await generateAsset(apiKey, r.prompt, dims.w, dims.h);
        if (!bytes) continue;
        const url = await upload(admin, user.id, bytes, "asset");
        if (url) assets[r.key] = url;
      } catch (e) {
        if (e instanceof Error && e.message === "CREDITS_EXHAUSTED") {
          return json({ error: "AI credits exhausted." }, 402);
        }
        console.warn("[asset] request failed", e instanceof Error ? e.message : e);
      }
    }

    // ------- assemble + normalise
    const bg = cd.background || { type: "solid", color: "#FFFFFF" };
    const schemaInput = {
      schema_version: BDS_VERSION,
      canvas: { width: w, height: h },
      background: {
        type: bg.type,
        color: bg.color,
        color2: bg.color2,
        angle: bg.angle,
        source: bg.source,
        ...(bg.overlay_color
          ? { overlay: { color: bg.overlay_color, opacity: bg.overlay_opacity ?? 0.35 } }
          : {}),
      },
      fonts: {
        heading: headingFontFor(cd.heading_personality || body.genome?.typography?.font_personality),
        body: "Poppins",
      },
      assets,
      elements: (cd.elements || []).filter((e: any) => {
        // Drop image/logo elements whose asset never materialised.
        if (e?.type === "image" || e?.type === "logo") return !!assets[e.source];
        return true;
      }),
      meta: { rationale: cd.rationale, model: modelUsed, generated_at: new Date().toISOString() },
    };

    // Background art that failed to generate degrades to a solid brand colour.
    if (schemaInput.background.type === "image" && !assets[schemaInput.background.source || ""]) {
      schemaInput.background = {
        type: "solid",
        color: (brand?.primary_colors?.[0] as string) || "#111111",
      } as any;
    }

    const schema = normaliseSchema(schemaInput, { width: w, height: h });
    if (!schema.elements.length) return json({ error: "The design came back empty — please retry." }, 502);

    const png = await renderSchemaToPng(schema);
    const imageUrl = await upload(admin, user.id, png, "bds");
    if (!imageUrl) return json({ error: "Failed to store rendered image" }, 500);

    await gate.charge();

    const designId = await persist(schema, imageUrl, {
      designId: body.design_id || null,
      brandId: brand?.id || body.brand_id || null,
      title: prompt,
      prompt,
      caption: cd.caption || null,
      canvasSize,
      label: "Generated",
    });

    return json({
      schema,
      image_url: imageUrl,
      design_id: designId,
      caption: cd.caption || null,
      rationale: cd.rationale || null,
      model: modelUsed,
      warnings: overlapReport(schema),
    });
  } catch (e) {
    console.error("[design-structured] error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
