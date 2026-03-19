

## Brand Strategist Agent — "Plan" Chat Mode

### Overview
Add a toggleable "Plan" mode to the Design Studio chat that switches from the design generation pipeline to a conversational Brand Strategist agent. This agent is a seasoned branding expert with full context of the user's brand and audience data. It helps users think through brand strategy, answer branding questions, and give recommendations — but strictly refuses to discuss anything outside branding as it relates to the user's brand.

### Architecture

```text
Studio Chat
  ├── Mode: "Create" (default) → existing generate/edit pipeline
  └── Mode: "Plan" (toggle) → Brand Strategist agent (chat-only, no image generation)
```

### Implementation

#### 1. New Edge Function: `supabase/functions/brand-strategist/index.ts`
- Dedicated function (not shoehorned into design-studio) for clean separation
- Fetches full brand context: `brands`, `target_audiences`, `brand_trend_preferences`, `content_pillars`, `post_series`, `campaigns`, `special_instructions`, `brand_inspiration` count, `brand_products` count, recent design themes
- System prompt encodes:
  - Expert branding knowledge (positioning, messaging, differentiation, brand architecture, storytelling frameworks)
  - Friendly + supportive tone (team member meets seasoned consultant)
  - Hard boundary: refuses any topic not related to branding for the user's brand (e.g., coding, recipes, general knowledge)
  - References user's actual brand data naturally in responses
- Uses `google/gemini-3-flash-preview` (fast, capable)
- Sends full conversation history for multi-turn context

#### 2. UI Changes: `src/pages/DesignStudio.tsx`
- Add `chatMode` state: `"create" | "plan"`
- Add a toggle pill/button in the input area (next to the audience selector) labeled "Plan" with a lightbulb or brain icon
- When `chatMode === "plan"`:
  - Hide design-specific controls (canvas size, quality toggle, trend selector, image attachment)
  - Change placeholder text to "Ask your brand strategist..."
  - Change empty state messaging to strategist-specific welcome
  - Send messages directly to `brand-strategist` function via `supabase.functions.invoke()` (no design generation context needed)
  - Render responses as markdown chat bubbles (no image rendering, no genome scores)
  - Separate message history from design messages (use `planMessages` state)
- When toggling back to "create", design messages remain intact

#### 3. System Prompt Core Directives
- "You are a Brand Strategist — a seasoned branding expert who has studied and applied frameworks used by the world's most successful brands (Brand Archetypes, StoryBrand, Jobs-to-be-Done, Blue Ocean, Brand Pyramid, etc.)"
- "You have full context of the user's brand. Reference their specific colors, tone, audience, pillars, and strategy naturally."
- "Your tone is friendly and supportive — like a trusted team member who also happens to be a world-class branding consultant."
- "CRITICAL: You must ONLY discuss topics related to branding as it pertains to the user's brand. If asked about anything else (coding, recipes, general knowledge, other brands not in competitive context), politely decline and redirect to branding."

#### 4. Config Updates
- `supabase/config.toml`: Add `brand-strategist` function entry with `verify_jwt = false`

### Files Changed
| File | Change |
|---|---|
| `supabase/functions/brand-strategist/index.ts` | New edge function with full brand context assembly and strategist system prompt |
| `src/pages/DesignStudio.tsx` | Add `chatMode` toggle, separate plan message state, conditional UI rendering, plan mode send logic |
| `supabase/config.toml` | Add brand-strategist function config |

### What This Does NOT Do
- No database changes needed (chat is ephemeral, no persistence for plan conversations)
- No credit consumption for Plan mode (it's advisory, not generative)
- No changes to the existing design generation pipeline

