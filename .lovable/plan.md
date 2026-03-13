


## Architectural Refactoring — Implementation Status

### Completed Changes

#### Phase 1: Brief Agent Refactoring ✅
- Converted Brief Agent from free-text output (`DESIGN BRIEF: ... EXPLANATION: ...`) to **structured tool calling**
- Now outputs: `{ creative_direction, composition_goal, emotional_tone, design_focus, explanation }`
- Removed brittle string splitting (`split("DESIGN BRIEF:")[1].split("EXPLANATION:")`)
- Structured brief fields injected into Copywriter Agent for richer context
- Fallback to content parsing if tool call fails (graceful degradation)

#### Phase 2: Parallel Brief + Genome Execution ✅
- Brief Agent and Genome Composer now run in **parallel** via `Promise.all`
- Saves ~1-2s latency per generation (genome is deterministic, no LLM dependency)
- Error handling preserves rate limit (429) and credit exhaustion (402) responses

#### Phase 3: Extended Learning Layer ✅
- Added `copy_structure` JSONB column to `designs` table
- RAG Preference Engine now tracks:
  - **Copy density patterns**: headline-only vs full copy from upvoted designs
  - **Trend affinity**: which trends appear most in upvoted designs
- Copy preference context injected into Brief Agent and Copywriter

#### Phase 4: Special Instructions — Full Pipeline Coverage ✅
- Special Instructions injected into all agents:
  - Brief Agent system prompt ✓
  - Copywriter Agent ✓
  - Caption Agent ✓
  - Image Renderer prompt ✓

#### Phase 5: Edit Pattern Learning ✅
- Added `edit_patterns` JSONB column to `chat_preference_cache` table
- After each edit action, the system classifies the edit type using keyword matching:
  - `less_text`, `more_text`, `bigger_text`, `smaller_text`, `layout_change`, `color_change`, `style_change`
- Edit patterns stored in cache (last 50 edits retained)
- RAG Preference Engine reads edit patterns and builds `editBiasContext` when a pattern appears 3+ times
- Edit bias injected into Brief Agent prompt to pre-apply learned preferences
- Example: If user frequently requests "less text", future designs will default to minimal, headline-focused copy

### Architecture (Current)

```text
User Request
  ↓
[0] Action Router (chat / generate / edit)
  ↓
[1] Context Assembly (parallel)
  - Brand Centre data
  - Audience Intelligence (JTBD)
  - Trend Lab context
  - Product images
  - Inspiration images
  - RAG Preference Engine (genome + copy + trend patterns)
  - Chat History RAG
  - Edit Pattern Bias (learned from frequent edits)
  ↓
[2] Intent Classifier (edits: MINOR/MAJOR)
  → Edit Pattern Tracker (stores edit type for future bias)
  ↓
[3] Credit Gate
  ↓
[4] PARALLEL: Brief Agent + Genome Composer
  - Brief Agent → structured JSON (creative_direction, composition_goal, emotional_tone, design_focus)
  - Genome Composer → deterministic Visual Style Genome (brand locks + trend overrides + mutation)
  ↓
[5] PARALLEL: Copywriter Agent + Caption Agent
  - Both receive: brief context, genome density hints, brand data, audience, special instructions
  ↓
[6] Genome Scoring Engine
  - Scores: brand_alignment, trend_balance, visual_clarity, conversion, visual_balance
  - Stability Gate: if overall < 55, apply deterministic fixes + re-score
  ↓
[7] Image Renderer (Fast: gemini-2.5-flash-image / HD: gemini-3-pro-image-preview)
  - Input: creative_direction + visual genome + structured copy + brand tokens + image refs
  ↓
[8] Auto-Save (design, genome, copy_structure, caption, scores)
```

### What Was Skipped (and Why)

| Suggestion | Reason |
|---|---|
| Formal Orchestrator Controller | Current action routing is sufficient |
| Visual Composition Agent | Image models don't follow pixel-level layout specs |
| Reordering Genome before Brief | They're independent; parallel is better |
| Feedback updating mutation weights in real-time | Already implemented via RAG preference bias |
| Brand Strategist Agent | Brand Centre UI is the right approach — user control, not LLM hallucination |

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/design-studio/index.ts` | Brief Agent structured tool calls, parallel execution, extended RAG learning, edit pattern tracking + bias |
| Database migration | Added `copy_structure` JSONB column to `designs` table |
| Database migration | Added `edit_patterns` JSONB column to `chat_preference_cache` table |
