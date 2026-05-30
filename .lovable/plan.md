# Design Generation Pipeline — Audit & Optimisation Plan

This is a diagnostic plan, not a build plan. It maps the current orchestration, scores each input's real-world influence, surfaces what's broken vs. partial, and proposes a ranked set of fixes. Approving this plan moves us into the implementation phase for the High-Priority fixes in §4 (Medium-Priority items will be confirmed individually).

---

## 1. Current Orchestration Architecture

**Entry:** `DesignStudio.tsx:696` → `DesignGenerationContext.startGeneration` → `design-enqueue` (HTTP 202) → Inngest `app/design.requested` → `design-studio` worker (`runFullHandler`).

**Pipeline inside `design-studio/index.ts`:**

```text
 1. Auth + parse                         (553–613)
 2. Context compression (>15 msgs)       (621–700)    flash-lite
 3. Audience JTBD fetch                  (840–879)    DB
 4. RAG genome preference tally          (881–941)    deterministic
 5. Chat-history preference extraction   (980–1155)   flash-lite (cached)
 6. Edit pattern bias                    (1160–1191)  deterministic
 7. Trend context build                  (1193–1260)  hardcoded presets
 8. Brand context assembly               (1527–1573)  template
 9. Canvas resolve                       (1462–1471)
10. Inspiration style analysis  ─┐       (1473–1629)  flash-lite
11. Content category classify   │parallel(1632–1644)  rules → flash-lite
12. Firecrawl research          ─┘       (1650–1691)  HTTP (→ offline)
13. Brief Agent          ─┐parallel      (1697–1796)  gemini-3.1-pro
14. Genome Composer      ─┘ (deterministic)(1798–2146)
15. Genome validation                    (2158–2167)
16. Copywriter           ─┐parallel      (2246–2338)  gemini-3-flash
17. Caption              ─┘              (2340–2427)  gemini-3-flash
18. CTA policy + Category bias           (2433–2445)  deterministic
19. Stability gate (scoring)             (2448–2481)  deterministic
20. Renderer                             (2501–2556)  openai/gpt-image-2 (low)
21. Canvas enforcement + upload + credit (141–232, 2546–2574)
22. Trace persist                        (2577–2591)
```

Frontend polls via Realtime on `design_jobs` (3s fallback).

---

## 2. Inputs & Their Real Weight on the Output

| Input | Declared weight | Actual influence | Where injected |
|---|---|---|---|
| User prompt | "HIGHEST" (`1549`) | **Medium** — one sentence inside a ~2,000-word image prompt | brief, copy, caption, image prompt |
| Brand Centre (colors, fonts, tone, special_instructions) | "Second highest" | **High** — but only 2 genes hard-locked (color temp/saturation, font personality) | system prompt + image prompt (twice) |
| Audience JTBD profile | High (intent) | **Low** — present as soft hint in system prompts; **no field in `set_brief` schema**; not in genome composer | brand/copy/caption system prompts; Firecrawl query |
| Trend + intensity | Variable (slider) | **Unstable** — per-gene `Math.random() < intensity` blending; then partly undone by brand-lock and category-bias | genome overrides; trend overlay text in image prompt |
| Visual Style Genome | Core "DNA" | **Medium** — serialized text appended near end of image prompt; not enforced by renderer | image prompt tail |
| RAG upvote preferences | Advisory | **Low** until 5+ upvotes accumulate (threshold ≥ 3 score) | brand context + mutation bias |
| Chat-history pref tags | Lowest | **Very low** — explicit "prioritise current prompt" disclaimer | brand context, copywriter |
| Edit-pattern bias | Suggestion | **Low** — only fires at ≥ 3 occurrences | brief system prompt |
| Category bias | Soft (70% per gene) | **High & disruptive** — runs LAST so it can silently undo trend + brand intent | mutates genome in place |
| Firecrawl research | Soft | **Near zero** — almost always falls back to generic seasonal heuristic (logs confirm `0 results`) | brief/copy/caption system prompts |

**Net effect:** the strongest deterministic signal on the final pixels is the **base genome preset chosen from `vibePresetMap`**, which is keyed off `brand.vibe` only and ignores both content category and user prompt.

---

## 3. What's Broken / Partial / Not Working

### Broken (causes visible quality bugs)

1. **Category never picks the base preset.** Lagos-meme prompt → category `entertainment` ✅, but base preset = `luxury-editorial` because that's the brand vibe. Category bias afterwards only nudges individual genes at 70% — luxury DNA survives. (`1803–1815`, `2439`)
2. **Trend vs. category bias collision** — both can target the same gene with opposite values; category bias runs last and wins arbitrarily. (`2014` then `2441`)
3. **Stochastic trend blending** — same settings produce different genomes per run; no seed. (`2014`)
4. **`brand.industry` never sent from frontend** but used in Firecrawl query → research always weakened. (`DesignStudio.tsx:678–693` vs. `design-studio:1683`)
5. **Firecrawl returns 0 results for entertainment** — offline heuristic is generic seasonal text, adds no grounding. (`category-recipes.ts:745–822`)
6. **Platform hardcoded to "Instagram"** in research query regardless of canvas. (`1688`)
7. **Caption agent never sees final `copyStructure`** — caption text and on-image headline can drift. (`2340–2427`)

### Partial (works but doesn't carry the weight it should)

8. **JTBD profile** is fetched and pasted into a system prompt but absent from the `set_brief` tool schema — the structured-output LLM ignores it freely. (`1711–1729`)
9. **Genome scores** are computed and shown in UI but never fed back as a refinement loop or into the image prompt; stability gate threshold (`overall < 55`) almost never triggers. (`404–508`, `2452`)
10. **Inspiration override** needs ≥ 2 tag votes — single-inspiration brands can never trigger it. (`1855`)
11. **Brand-lock locks only 2 genes** (color temp/saturation, font personality); layout/composition/emotion are all overridable. (`2115–2134`)
12. **Genome context placed at the tail** of the ~2k-word image prompt — earlier tokens (brand colors, philosophy block) get more attention from gpt-image-2's text encoder.

### Not working / dead

13. **Inngest retries = 0** — one transient failure kills the job. (`inngest/index.ts:12`)
14. **Unreachable duplicate `return` at `824`** in the chat branch — dead code.
15. **`MODEL_CHAINS.reasoning` primary** is `google/gemini-3.1-pro-preview`; unclear if it resolves or always falls back to `gemini-2.5-pro` — needs verification via logs.

---

## 4. Recommendations (Ranked)

### High Priority — ship first, biggest intent-alignment lift

**H1. Category-driven base preset override** (`design-studio/index.ts:1803`)
Before vibe lookup, force entertainment/trending/interactive into expressive presets (`streetwear-alte`, `neo-brutalism`, `bold-startup`). 3-line change; would have fixed the Lagos meme single-handedly.

**H2. Deterministic trend blending** — replace per-gene `Math.random()` with a ranked top-N gene application where N = `round(total * intensity)`. Reproducible, intensity actually means what it says.

**H3. Resolve trend vs. category-bias conflicts** — pass a `trendLockedGenes` set into `applyCategoryBias` so trend-modified genes are protected when intensity ≥ 50.

**H4. Send `brand.industry`** from `DesignStudio.tsx:678` payload so Firecrawl can produce relevant research.

**H5. Pass `copyStructure.headline` into caption agent** so caption + image are semantically aligned.

**H6. Un-hardcode platform** at `1688` — use `canvas.platform`.

**H7. Move user prompt + final genome context to the top of the image prompt** at `2519`; relegate philosophy block lower. Realigns the renderer to user intent.

### Medium Priority — confirm individually before building

**M1. Add `audience_insight` field to the `set_brief` tool schema** — forces the brief LLM to surface one JTBD driver as structured output.

**M2. Scoring refinement loop** — if `brand_alignment < 50` after the stability gate, regenerate the genome once before rendering.

**M3. Lock more genes for the brand** — at minimum `layout.balance` and `emotion` for brands with explicit `personality_traits`.

**M4. Trigger inspiration override on single-vote agreement** when brand has only 1 inspiration image.

**M5. Better Firecrawl fallback** — include the user's topic in the offline heuristic instead of seasonal boilerplate; route entertainment to a meme-format prompt template.

**M6. Seed RNG** in genome mutation from `user.id + job_id` for reproducibility and easier debugging.

**M7. Inngest retries** — set to 2 with exponential backoff for transient gateway failures.

**M8. Verify `gemini-3.1-pro-preview` model id** actually resolves at the gateway; otherwise pin to `gemini-2.5-pro` directly.

### Low Priority — housekeeping

- Remove dead `return` at `design-studio:824`.
- Add structured logs for each stage's contribution to final genome (which genes came from preset vs. trend vs. category vs. mutation vs. brand-lock) for ongoing debugging.

---

## 5. Implementation Status

- **Batch A (H1, H3, H4, H5, H6)** — ✅ shipped.
- **Batch B (H2, H7)** — ✅ shipped.
- **Batch C (M1, M2, M3, M4, M5, M7, M8)** — ✅ shipped.
  - M1: `audience_insight` added to `set_brief` tool schema + required field.
  - M2: brand-alignment safety net runs a second refinement pass when `brand_alignment < 50`.
  - M3: brands with `personality_traits` now lock `emotion` and `layout.balance`.
  - M4: single-vote inspiration override allowed when the brand has only one reference image.
  - M5: offline Firecrawl heuristic now grounds in the user's `topic` and emits meme-format guidance when the prompt reads like a meme.
  - M7: Inngest retries set to 2 (default exponential backoff; design-studio dispatch is idempotent on `job_id`).
  - M8: `MODEL_CHAINS.reasoning` pinned to `gemini-2.5-pro` (the 3.1-pro-preview id was 404-ing at the gateway and silently falling back).
- **Deferred**
  - **M6** (seeded RNG from `user.id + job_id`) — debugging-only nicety; requires threading the seed through the genome composer and mutation engine. Will pick up when we add full per-stage tracing.
  - **Low-priority housekeeping** (dead `return` removal, per-stage gene-source logging) — defer to next cleanup pass.


