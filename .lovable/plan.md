
# Pipeline Optimization Plan — 15 Recommendations

Goal: align generation output more tightly to user intent by promoting the prompt, introducing a Creative Director Agent with persisted layout schemas, making audience JTBD a first-class signal, tightening trend/inspiration handling, closing the feedback loop, and adding telemetry.

Rollout is phased so each phase is shippable independently and the pipeline stays green throughout.

---

## Phase 1 — Quick wins (no schema changes)

**Scope:** prompt-level changes inside `design-studio/index.ts` only. Zero risk to current pipeline.

1. **#1 Promote user prompt** — restructure prompt builder so the verbatim user prompt is the first and last block (repeated slot). Strip the ~2KB of styling boilerplate down to ≤3 sentences of polish guidance.
2. **#10 Move `special_instructions`** to the top of the prompt, immediately after the user prompt slot.
3. **#14 Per-brand prompt budget cap** — if assembled prompt > 3.5KB, progressively drop boilerplate (polish hints first, then research enrichment, then inspiration captions).
4. **#13 Drop Firecrawl/research from hot path** for categories where it historically returns 0 results. Add an allowlist in `category-recipes.ts` (e.g. only run research for `educational`, `industry_news`).

**Files:** `supabase/functions/design-studio/index.ts`, `supabase/functions/_shared/category-recipes.ts`.

---

## Phase 2 — Telemetry + observability

**Scope:** make Phase 1 results measurable before going further.

5. **#15 Telemetry expansion** — add to `design_traces` payload:
   - `prompt_length_chars`
   - `refs_used_count`, `refs_skipped[]`
   - `genome_overall_score`
   - `stability_gate_fired` (bool) + `stability_gate_gene_patched`
   - `tier_used` (which fallback tier rendered)
   - `category_confidence` (for #11)
   - `research_skipped` (for #13)
6. Surface these in `AdminTracesTab.tsx` as sortable columns + 7-day averages.

**Files:** `supabase/functions/_shared/tracer.ts`, `supabase/functions/design-studio/index.ts`, `src/components/admin/AdminTracesTab.tsx`.

---

## Phase 3 — Audience & inspiration upgrades

**Scope:** make existing inputs actually influence the output.

7. **#4 Audience JTBD as first-class input** —
   - Inject `core_job_statement`, top emotional drivers, and one buying trigger directly into the renderer prompt (new "Audience" block).
   - Add audience-alignment score to the genome scorer (new metric weighted 15%).
8. **#7 Tighten inspiration handling** —
   - Lower preset-vote threshold from 2 → 1.
   - Add `dominant_palette` (top-3 hex via image analysis) and `composition_vector` (rule-of-thirds / centered / asymmetric) extraction to `render-refs.ts`.
   - Inject those as structured tokens into genome composer instead of free-text caption only.
9. **#11 Category confidence** — replace binary category override with a 0-1 confidence score. If `< 0.7`, blend instead of overwrite category bias.

**Files:** `supabase/functions/design-studio/index.ts`, `supabase/functions/_shared/render-refs.ts`, `supabase/functions/audience-intelligence/index.ts` (read path only).

---

## Phase 4 — Stability + per-brand policy

10. **#5 Raise Stability Gate** floor from 55 → 65. Add second-pass refinement for paid-tier users (Entrepreneur+).
11. **#6 Per-brand lock policy** — new `brand.gene_lock_policy` JSONB field with shape:
    ```
    { locked: ["color_primary"], semi_flexible: ["typography"], free: ["texture","layout"] }
    ```
    Genome composer respects per-brand locks during composition + mutation.
12. **#9 Carousel coherence** — in `design-studio` carousel orchestrator, compute genome once for slide 1, deep-clone and lock all genes for slides 2-N. Only copy + image_instructions vary.

**Schema change:** one migration adding `gene_lock_policy JSONB` to `brands` (nullable, default null → falls back to global defaults).

---

## Phase 5 — Creative Director Agent + persisted layout schema  ✅ shipped (single-design path)

**Scope:** the biggest architectural change. Unlocks real edits and feedback loop.

13. **#2 Creative Director Agent** — ✅
    - New stage between Stability Gate and Renderer in `design-studio/index.ts`.
    - Calls `MODEL_CHAINS.reasoning` (gemini-2.5-pro → 3.1-pro-preview fallback) via tool-call, emitting `layout_schema` JSON: `{ canvas_grid, regions[{role,position,size,treatment}], focal_point, hierarchy, palette_application, background_treatment, visual_motifs[] }`.
    - Schema injected into renderer prompt as `LAYOUT BLUEPRINT` block (after audience, before genome).
    - Best-effort: failure does NOT block render.
    - Tracer metrics: `creative_director_fired`, `layout_schema_regions`.
14. **#3 Persist `layout_schema`** — ✅
    - Columns `layout_schema JSONB` + `creative_director_version TEXT` already on `designs` (Phase 4 migration).
    - Returned in single-design response; persisted by `DesignGenerationContext.tsx` on design insert.
    - Carousel persistence deferred (single CD call per carousel still TODO).
15. **#8 Mask-based edits** — ⏭ deferred to a follow-up; requires `previous_image_url` + mask compositing.

**Schema changes:** none (used columns added in Phase 4 migration).


---

## Phase 6 — Feedback loop

16. **#12 Close feedback loop** —
    - New table `genome_preset_weights (brand_id, category, preset_id, weight, updated_at)`.
    - Upvote on a design: `weight += 0.1` for that `(category, genome_preset)` combo.
    - Downvote: `weight -= 0.1`, floored at 0.
    - Genome Composer's preset selection multiplies base score by `weight` (default 1.0).

**Schema change:** one migration for the weights table + GRANTs + RLS (user can only read/write weights for brands they own).

---

## Out of plan / explicitly deferred

- Replacing gpt-image-2 (user wants to keep it).
- True regional inpainting beyond text-region masks.
- Multi-modal feedback signals beyond upvote/downvote.

---

## Technical notes

- All edge function changes ship via `supabase--deploy_edge_functions`; no client-side breaking changes.
- SSE response shape (`image_generation.partial_image` / `image_generation.completed`) is preserved across every phase.
- Credit deduction logic is untouched; Creative Director call is wrapped in `circuit-breaker.ts` and fails open (skips schema step) so a Gemini outage cannot block renders.
- Each phase can be deployed and rolled back independently. Recommended cadence: P1+P2 together, then P3, then P4, then P5, then P6.

---

## Files touched (summary)

```text
Phase 1-2: design-studio/, _shared/category-recipes.ts, _shared/tracer.ts, admin/AdminTracesTab.tsx
Phase 3:   design-studio/, _shared/render-refs.ts
Phase 4:   design-studio/, brands migration
Phase 5:   design-studio/, designs migration, new creative-director stage
Phase 6:   genome_preset_weights migration, design-studio/ scoring path, vote handler
```

Total estimated effort: ~3-4 days across 6 deploys.
