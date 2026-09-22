// Design Quality Scorer
// Multimodal critic that scores a rendered social graphic against its brief
// on 5 dimensions and returns a small set of concrete, actionable signals.
// Used by design-studio to pick the best of N Blueprint candidates and to
// surface "what to fix" hints back to the user.

export interface QualityScore {
  brand_fidelity: number;   // 0-100 — correct logo/colour/typography presence and scale
  hierarchy: number;        // 0-100 — clear focal order, headline → CTA flow
  readability: number;      // 0-100 — legibility, contrast, font sizing, no overlap
  composition: number;      // 0-100 — balance, alignment, whitespace
  on_brief: number;         // 0-100 — faithfulness to the brief intent
  overall: number;          // 0-100 — weighted overall
}

export interface QualityResult {
  scores: QualityScore;
  signals: string[];                       // 0-4 short imperative fixes
  verdict: "pass" | "warn" | "fail";
  model: string;
}

export interface ScoreOpts {
  imageUrl: string;
  brief: string;
  brandName?: string | null;
  brandColors?: string[];
  copy?: { headline?: string; subheadline?: string; cta?: string } | null;
  category?: string | null;
  apiKey: string;
}

/**
 * Weighted aggregate used to break ties when the AI returns identical `overall`
 * scores. Mirrors what most users care about most.
 */
export function weightedOverall(s: QualityScore): number {
  return Math.round(
    s.on_brief * 0.30 +
    s.brand_fidelity * 0.25 +
    s.readability * 0.20 +
    s.hierarchy * 0.15 +
    s.composition * 0.10,
  );
}

export async function scoreDesignImage(opts: ScoreOpts): Promise<QualityResult | null> {
  const model = "google/gemini-2.5-flash";
  const sys =
    "You are Brandie's Quality Critic. Score a rendered social graphic against its brief. " +
    "Be strict but fair. Look at the actual pixels: read the rendered text, check colour usage, " +
    "judge layout balance. Output ONLY the tool call.";

  const copyLine = opts.copy
    ? `COPY (must be spelled exactly): headline="${opts.copy.headline || ""}"` +
      (opts.copy.subheadline ? ` sub="${opts.copy.subheadline}"` : "") +
      (opts.copy.cta ? ` cta="${opts.copy.cta}"` : "")
    : "";

  const userText = [
    `BRIEF: ${opts.brief.slice(0, 1200)}`,
    `BRAND: ${opts.brandName || "?"}${opts.brandColors?.length ? ` | colours ${opts.brandColors.slice(0, 3).join(", ")}` : ""}`,
    opts.category ? `CATEGORY: ${opts.category}` : "",
    copyLine,
    "Rate each dimension 0-100. Then list 2-4 concrete actionable signals as short imperatives — " +
    "e.g. \"increase contrast between headline and background\", \"logo is too small in lower-left — scale 2x\", " +
    "\"CTA misspelled, should read 'Shop Now'\". Skip vague feedback.",
  ].filter(Boolean).join("\n");

  const tool = {
    type: "function",
    function: {
      name: "score_design",
      description: "Return per-dimension quality scores plus actionable signals.",
      parameters: {
        type: "object",
        properties: {
          brand_fidelity: { type: "integer", minimum: 0, maximum: 100 },
          hierarchy: { type: "integer", minimum: 0, maximum: 100 },
          readability: { type: "integer", minimum: 0, maximum: 100 },
          composition: { type: "integer", minimum: 0, maximum: 100 },
          on_brief: { type: "integer", minimum: 0, maximum: 100 },
          overall: { type: "integer", minimum: 0, maximum: 100 },
          signals: {
            type: "array",
            items: { type: "string" },
            minItems: 0,
            maxItems: 4,
            description: "Short, concrete fixes. Skip if the design is genuinely flawless.",
          },
          verdict: { type: "string", enum: ["pass", "warn", "fail"] },
        },
        required: [
          "brand_fidelity",
          "hierarchy",
          "readability",
          "composition",
          "on_brief",
          "overall",
          "signals",
          "verdict",
        ],
        additionalProperties: false,
      },
    },
  };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS.shortJson,
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: opts.imageUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "score_design" } },
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[design-scorer] http ${resp.status}:`, body.slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      console.error("[design-scorer] no tool_call in response");
      return null;
    }
    const parsed = JSON.parse(argsStr);
    const scores: QualityScore = {
      brand_fidelity: clamp(parsed.brand_fidelity),
      hierarchy: clamp(parsed.hierarchy),
      readability: clamp(parsed.readability),
      composition: clamp(parsed.composition),
      on_brief: clamp(parsed.on_brief),
      overall: clamp(parsed.overall),
    };
    const signals: string[] = Array.isArray(parsed.signals)
      ? parsed.signals.map((s: any) => String(s)).filter((s: string) => s.length > 0).slice(0, 4)
      : [];
    const verdict = parsed.verdict === "pass" || parsed.verdict === "fail" ? parsed.verdict : "warn";
    return { scores, signals, verdict, model };
  } catch (e) {
    console.error("[design-scorer] failed", e instanceof Error ? e.message : e);
    return null;
  }
}

function clamp(n: any): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
