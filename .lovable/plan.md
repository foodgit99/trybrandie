

# Plan: Fix All Missing/Not Working Items in Design Studio Pipeline

## Overview
Six fixes to the `supabase/functions/design-studio/index.ts` edge function. No database changes needed.

---

## 1. Parallel Agent Execution (~2-4s latency reduction)

Currently Copywriter → Caption → Scoring runs sequentially. Caption doesn't hard-depend on Copywriter output (it can use the design brief directly).

**Change:** Run Copywriter and Caption as `Promise.all()`, then run Genome Scoring after.

```text
BEFORE: Brief → Genome → Copywriter → Caption → Scoring → Image
AFTER:  Brief → Genome → [Copywriter + Caption] parallel → Scoring → Image
```

The Caption prompt will use `designPrompt` and `userPrompt` instead of `copyStructure` fields. This removes the sequential dependency.

---

## 2. Brand Lock Enforcement in Genome Composer

After the genome is composed (preset + trend overrides + mutation), override locked genes with actual brand values. This prevents the genome from contradicting brand settings.

**Change:** After the mutation engine (line ~933), add a brand lock pass:
- If brand has `primary_colors`, force `genome.color.palette_type` to match brand palette logic and set `temperature`/`saturation` based on brand color analysis.
- If brand has `typography_primary`, map it to the closest `font_personality` value.
- Skip overriding genes that are already aligned.
- Locked genes: `color.palette_type`, `color.saturation`, `typography.font_personality`, `typography.weight_system`. Semi-flexible genes like `color.temperature` get overridden only if they strongly conflict.

---

## 3. Inspiration Image Influence on Genome

Currently inspiration images only go to the image renderer as visual refs. They should also influence genome selection.

**Change:** Before the genome composer runs, if inspiration images exist, use a fast LLM call (`gemini-2.5-flash-lite`) to analyze 1-2 inspiration image URLs and extract style tags (e.g., "luxurious", "minimal", "editorial", "warm tones"). Use these tags to bias the base preset selection instead of relying solely on the `vibe` field. This runs in parallel with the Brief Agent call to avoid adding latency.

---

## 4. Chat Action Brand Context

The `chat` action (line 1393-1431) uses a generic system prompt with no brand data.

**Change:** Before the chat response, fetch the user's brand (same query as generate/edit). Inject brand name, colors, fonts, tone, vibe, personality, audience summary, and trend preferences into the chat system prompt. This makes pre-generation conversations brand-aware.

The chat action will need a small data-fetch block at the top (brand query + optional audience query). Since `brand` is passed in the request body already, we just need to use it in the system prompt.

---

## 5. Error Recovery / Retry

Currently, if the Brief Agent or Image Renderer returns a transient 500, the function immediately throws. No retry.

**Change:** Add a `retryFetch` helper that wraps `fetch()` with:
- Max 2 retries (3 total attempts)
- Only retry on 500, 502, 503, 504 status codes
- Exponential backoff: 1s, 2s delays
- Apply to: Brief Agent call, Image Renderer call (the two critical non-fallback stages)
- Copywriter and Caption already have graceful fallbacks, so no retry needed there.

---

## 6. Stability Gate Re-scoring

Currently after applying deterministic fixes, the code just adds `+15` to the overall score (line 1252).

**Change:** After applying fixes, re-run the same scoring logic (brand alignment, visual clarity, trend balance, conversion, visual balance) against the mutated genome. Replace the `scores.overall + 15` with the actual recomputed weighted average. This requires extracting the scoring logic into a reusable function.

---

## Implementation Approach

All changes are in a single file: `supabase/functions/design-studio/index.ts`. The function will be redeployed after changes.

**Estimated sections affected:**
- Lines 1-10: Add `retryFetch` helper
- Lines 624-650: Wrap Brief Agent in retry
- Lines 700-933: Brand lock pass after mutation, inspiration analysis parallel with brief
- Lines 950-1031: Copywriter stays as-is
- Lines 1033-1108: Caption refactored to not depend on copyStructure
- Lines 950-1108: Wrap both in Promise.all
- Lines 1110-1255: Extract scoring into function, call twice if stability gate triggers
- Lines 1302-1334: Wrap Image Renderer in retry
- Lines 1393-1431: Enrich chat system prompt with brand context

