

## Plan: Elevate AI Agent System Prompts for Design Quality

### What Changes

Update the system prompts for all three agents (Copywriter/Brief Generator, Renderer, and Chat agent) in `supabase/functions/design-studio/index.ts` to enforce:

1. **Realistic imagery** by default (photographic, not illustrated/cartoon) unless user asks otherwise
2. **Clean, modern, visually appealing** design principles (whitespace, hierarchy, balance)
3. **Strict brand compliance** — brand colours, fonts, tone, and inspiration are weighted heavily
4. **User intent has highest priority** — the user's specific request always overrides defaults
5. **Inspiration images from Brand Centre** passed as visual context to the renderer

### Technical Details

**File:** `supabase/functions/design-studio/index.ts`

#### A. Copywriter/Brief Agent (brandContext + system prompt, ~line 77–103)

Add to the brand context block:
- "ALWAYS use photorealistic imagery and photography unless the user explicitly requests illustrations, cartoons, or abstract art."
- "Designs must follow modern design principles: strong visual hierarchy, balanced composition, generous whitespace, clean typography, and visual appeal."
- "User intent and Brand Centre data (colours, fonts, tone, personality, inspiration) carry the HIGHEST weight. Never override what the user asks for."
- Reference inspiration examples from brand data: pass `brand.image_style_preferences` and `brand.inspiration_examples` into the context so the brief agent knows the brand's visual style.

#### B. Renderer / Image Generation Prompt (~line 169–185)

Update `imagePromptText` to prepend:
- "Create a PHOTOREALISTIC, clean, modern design. Use real photography and natural textures — NOT cartoons, clip art, or flat illustrations — unless the user specifically requests otherwise."
- "The design must be visually stunning, professionally composed, with balanced layout, clear hierarchy, and generous breathing room."
- Pass brand inspiration images (if any exist in `brand.inspiration_examples`) as additional image references alongside logo and user-attached images, so the renderer can match the brand's established visual style.

#### C. Chat Agent (~line 261–267)

Update system prompt to include:
- "When advising on designs, always recommend photorealistic imagery and clean modern aesthetics unless the user wants something different."
- "Prioritise the user's intent and their Brand Centre settings above all else."

#### D. Inspiration Image Passthrough

In the image generation section, if `brand.inspiration_examples` array has entries, include up to 2 inspiration images as `image_url` references alongside the logo — giving the renderer direct visual context of the brand's preferred aesthetic.

### No Database Changes

All changes are prompt-level updates within the existing edge function.

