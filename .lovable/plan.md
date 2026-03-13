

# Architectural Refactoring — Analysis and Implementation Plan

## Assessment of the Four Risks

### Risk 1: Brief Agent Is Too Powerful — AGREE (Medium Priority)

The current Brief Agent (line 948-962) receives the entire brand context, audience, trends, preferences, chat history, and user prompt as a single massive system prompt (~2000+ tokens of context). It outputs both a `DESIGN BRIEF` (which becomes the image prompt seed) and an `EXPLANATION`. This is problematic because:

- If the brief hallucinates a colour or layout direction, every downstream agent inherits the mistake
- The brief is simultaneously trying to be a creative strategist AND an image prompt writer

**Recommendation**: Split the Brief Agent into two concerns — a **Strategic Director** (outputs creative_direction, emotional_tone, composition_goal, design_focus as structured JSON) and let the image prompt be assembled deterministically from structured outputs. This is the highest-impact change.

### Risk 2: No Orchestrator Layer — PARTIALLY AGREE (Low Priority for now)

The current code already has implicit orchestration via the `action` switch (`chat` / `generate` / `edit`) at line 217-322. Adding a formal Orchestrator class would be cleaner but the current code is a single edge function — the routing logic is simple enough that a formal orchestrator adds abstraction without significant functional gain at this stage.

**Recommendation**: Skip a formal Orchestrator for now. The action-based routing is adequate. Revisit when adding new action types (e.g., `batch`, `template`, `remix`).

### Risk 3: Genome Runs Too Early — DISAGREE

The genome currently runs AFTER the brief (line 991), and this is actually correct for Brandie's architecture. The genome is **deterministic** — it's computed from brand vibe + trend + preferences + mutation, NOT from the brief content. The brief and genome are independent branches that merge at the image prompt. Moving genome before the brief would not change the brief's output because the brief doesn't read the genome.

However, the brief SHOULD be genome-aware so its creative direction doesn't conflict with genome decisions. The fix is not to reorder, but to **run them in parallel** and then validate compatibility.

**Recommendation**: Run Genome Composer in parallel with Brief Agent (saves ~1-2s latency), then inject genome context into the Copywriter (already done) and use the Scoring Engine to catch conflicts.

### Risk 4: No Learning Layer — AGREE (Medium Priority)

The RAG Preference Engine (line 366-428) already reads past genomes weighted by votes, and the Mutation Engine (line 1258-1295) uses preference bias. But this only affects genome gene selection. It does NOT feed back into:
- Copy tone preferences
- Layout density preferences  
- Trend affinity

**Recommendation**: Extend the preference cache to track copy and layout patterns from upvoted designs.

### Visual Composition Agent — DISAGREE (for now)

Adding a layout schema agent between Copywriter and Renderer would add another LLM call (~2-3s latency) and the image generation models (Gemini image models) don't reliably follow precise pixel-level layout instructions. The genome's layout/composition genes already serve this purpose at the right abstraction level. A composition agent would be valuable if Brandie moved to a canvas-based renderer (HTML/CSS or Figma), but not with current image generation.

---

## Implementation Plan (Phased)

### Phase 1: Strategic Brief Refactoring (High Impact)

**File**: `supabase/functions/design-studio/index.ts`

Split the Brief Agent output from a free-text `DESIGN BRIEF + EXPLANATION` into structured JSON via tool calling:

```text
Current:  Brief Agent → free text → parsed by string splitting
Proposed: Brief Agent → tool call → { creative_direction, composition_goal, emotional_tone, design_focus, explanation }
```

Changes:
- Convert Brief Agent to use structured tool calling (like Copywriter already does)
- Output fields: `creative_direction` (2-3 sentences), `composition_goal` (layout intent), `emotional_tone` (single word), `design_focus` (what's the hero element), `explanation` (for user)
- Remove the brittle `.split("DESIGN BRIEF:")[1].split("EXPLANATION:")` parsing (line 983-989)
- The `creative_direction` replaces `designPrompt` in downstream usage
- Include genome context in the Brief Agent prompt so it can align creative direction with the visual system

### Phase 2: Parallel Genome + Brief (Latency Optimization)

**File**: `supabase/functions/design-studio/index.ts`

Currently genome runs sequentially after brief. Since genome is deterministic (doesn't depend on brief output), run them in parallel:

```text
Current:  Brief Agent (sequential) → Genome Composer → Copywriter+Caption (parallel) → Scorer → Renderer
Proposed: Brief Agent + Genome Composer (parallel) → Copywriter+Caption (parallel) → Scorer → Renderer
```

This saves 0-1s (genome is fast but currently blocks the pipeline).

### Phase 3: Extended Learning Layer

**File**: `supabase/functions/design-studio/index.ts`

Extend the RAG Preference Engine to also track:
- **Copy density patterns**: From upvoted designs, track whether the user prefers headline-only vs full copy structures
- **Trend affinity**: Track which trends appear in upvoted designs to influence trend recommendations

Changes:
- When building `preferenceContext`, also extract copy_structure patterns from past designs (requires storing copy_structure in the designs table)
- Add a `copy_structure` JSONB column to the designs table

**Database migration**:
```sql
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS copy_structure jsonb DEFAULT NULL;
```

### Phase 4: Special Instructions — Full Pipeline Coverage (Already Done)

Special Instructions are now injected into:
- Brief Agent system prompt (line 870) ✓
- Copywriter Agent (line 1389) ✓
- Caption Agent (line 1462) ✓
- Image Renderer prompt (line 1590) ✓

No further changes needed here.

---

## File Changes Summary

| File | Phase | Change |
|---|---|---|
| `supabase/functions/design-studio/index.ts` | 1 | Refactor Brief Agent to structured tool call output |
| `supabase/functions/design-studio/index.ts` | 2 | Parallelize Brief + Genome execution |
| `supabase/functions/design-studio/index.ts` | 3 | Extend RAG preference engine for copy patterns |
| Database migration | 3 | Add `copy_structure` JSONB column to designs |

## What I Recommend We Skip

| Suggestion | Reason |
|---|---|
| Formal Orchestrator Controller | Current action routing is sufficient; adds abstraction without functional gain |
| Visual Composition Agent | Image models don't follow pixel-level layout specs; genome layout genes are the right abstraction |
| Reordering Genome before Brief | They're independent; parallel execution is better than reordering |
| Feedback updating mutation weights in real-time | Already implemented via RAG preference bias in mutation engine |

## Execution Order

I recommend implementing Phase 1 first (Brief Agent refactoring) as it has the highest impact on design quality and pipeline reliability. Phases 2-3 can follow incrementally.

