## System Audit Fixes — Completed

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

## Brand Engine — Implemented

### What Was Built

#### Database Tables
- `content_pillars` — 5 AI-generated content themes per brand
- `post_series` — Recurring content formats (e.g. "Tip Tuesday")
- `campaigns` — Campaign ideas with multi-post breakdowns
- `content_ideas` — Weekly post ideas with ready-to-use Studio prompts

All tables have RLS policies scoped to brand ownership.

#### Edge Function: `brand-engine`
Actions: `generate_pillars`, `generate_series`, `generate_campaigns`, `generate_weekly_ideas`
Uses `google/gemini-3-flash-preview` with structured tool calling.
Inputs: brand data, audience JTBD profiles, past designs, trend preferences.

#### Content Hub Page (`/content`)
- Auto-generates full content strategy on first visit
- Displays: Content Pillars, Weekly Calendar, Recurring Series, Campaigns
- Each idea has a `→` button that navigates to Studio with pre-filled prompt
- Regenerate buttons for each section individually or all at once

#### Integrations
- **Studio**: Reads `prompt` and `content_idea_id` from URL params; marks idea as "created" after design generation
- **Dashboard**: Content Hub CTA button added alongside Create New Design
- **Navigation**: "Content Hub" added to hamburger menu
- **Auto-setup**: First visit triggers sequential generation (pillars → series → campaigns → weekly ideas)

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/brand-engine/index.ts` | New edge function with 4 AI-powered actions |
| `src/pages/ContentHub.tsx` | New Content Hub page |
| `src/App.tsx` | Added `/content` route |
| `src/components/AppHeader.tsx` | Added Content Hub nav item |
| `src/pages/Index.tsx` | Added Content Hub CTA to dashboard |
| `src/pages/DesignStudio.tsx` | URL param prompt auto-fill + content_idea_id tracking |
| `supabase/config.toml` | Added brand-engine function config |
| Database migration | Created 4 new tables with RLS |

## Brand Strategist Agent — Implemented

### What Was Built
- **"Plan" chat mode toggle** in the Design Studio input area (lightbulb icon pill)
- Toggles between "Create" (design generation) and "Plan" (brand strategy chat)
- In Plan mode: design controls (canvas size, quality, trends, image attach) are hidden
- Separate `planMessages` state — switching modes preserves both conversations
- Streaming SSE responses with token-by-token rendering and abort/stop support

### Edge Function: `brand-strategist`
- Fetches full brand context: brand profile, audiences (JTBD), content pillars, series, campaigns, inspiration/product counts, recent designs
- System prompt: seasoned branding expert with knowledge of all major frameworks (Archetypes, StoryBrand, JTBD, Blue Ocean, Kapferer, Keller, etc.)
- Friendly + supportive tone, references user's actual brand data naturally
- Hard boundary: refuses any topic not related to branding for the user's brand
- No credit consumption — advisory only

### Files Changed
| File | Change |
|---|---|
| `supabase/functions/brand-strategist/index.ts` | New streaming edge function |
| `src/pages/DesignStudio.tsx` | Plan mode toggle, separate message state, conditional UI |
| `supabase/config.toml` | Added brand-strategist function config |
