

## Analysis

The design pipeline currently has a two-step process:
1. **Brief generation** (gemini-3-flash-preview) — produces a design brief and explanation
2. **Image rendering** (gemini-2.5-flash-image) — generates the image including all text

The problem: the image model is responsible for both visuals AND copy. It receives a design brief with general direction but is free to invent its own text. This results in generic, off-brand copy like "DON'T JUST AD-LIBS... DESIGN YOUR FLYER for that weekend thing!" instead of sharp, brand-aligned messaging.

## Solution: Add a Dedicated Copywriter Agent Step

Insert a **Copywriter Agent** between the brief and the renderer. This agent produces exact, structured copy (headline, subheadline, CTA, supporting text) that is then passed verbatim to the image model with strict instructions to render it exactly as written.

### Pipeline Change

```text
Current:  User Prompt → Brief Agent → Image Renderer
Proposed: User Prompt → Brief Agent → Copywriter Agent → Image Renderer
```

### Implementation (single file: `supabase/functions/design-studio/index.ts`)

**Step 1 — Add Copywriter Agent call after brief generation (after line ~342)**

- Call `gemini-3-flash-preview` with a Copywriter system prompt that:
  - Receives the design brief, brand tone/personality, audience JTBD signals, and trend copy tone hint
  - Outputs structured JSON: `{ headline, subheadline, cta, supporting_text }`
  - Enforces 20-30 word max total
  - Aligns copy with the user's actual request topic
  - Uses audience emotional drivers and messaging angles
  - Adapts tone to the active trend's `copy_tone_hint`

**Step 2 — Inject exact copy into the image generation prompt (line ~348)**

- Modify `imagePromptText` to include the exact copy with explicit instructions: "Use these EXACT words on the design. Do NOT modify, rephrase, or add any text beyond what is provided."
- Structure: `EXACT TEXT TO RENDER: Headline: "..." | Subheadline: "..." | CTA: "..."`

**Step 3 — Return the structured copy in the response**

- Include `copy_structure` in the JSON response so the frontend can display/reference it.

### Copywriter System Prompt (core logic)

The Copywriter receives:
- The design brief (what the design is about)
- Brand tone, personality traits, vibe
- Audience JTBD signals (struggling moments, emotional drivers, messaging angles)
- Trend copy tone hint (if active)
- The user's original prompt

It must produce copy that:
- Directly addresses the user's request topic
- Uses the brand's tone of voice
- Leverages audience psychology for persuasion
- Stays within 20-30 words total
- Never adds generic filler or unrelated taglines

### Risk Mitigation
- Adds one extra LLM call (~1-2s latency) but uses the fast flash model
- If the copywriter call fails, falls back to the current behavior (image model generates its own copy)

