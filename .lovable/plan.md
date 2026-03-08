

## Plan: Social Media Caption Generation

### Overview
After each design generation, Brandie will also produce a social-media-optimised, brand-aligned caption with hashtags. This uses an additional AI call in the existing `design-studio` edge function and surfaces the caption in the chat UI.

### Step 1: Caption Agent in Edge Function (`supabase/functions/design-studio/index.ts`)

After the Copywriter Agent (around line 792), add a **Caption Agent** call using tool calling to produce structured output:

```json
{ "caption": "...", "hashtags": ["#tag1", "#tag2", ...] }
```

The agent receives: brand name, tone, personality, vibe, audience context, the design brief, and the copy structure. It generates a ready-to-post social media caption (2-4 sentences) with 5-10 relevant hashtags. Uses `google/gemini-3-flash-preview` (fast, cheap).

The result is included in the response JSON as `caption` (string combining text + hashtags).

### Step 2: Frontend Display (`src/pages/DesignStudio.tsx`)

- When a design is generated, display the caption below the explanation text in the assistant message bubble
- Style it in a distinct card/block with a "Copy caption" button
- Store caption in the `designs` table alongside existing fields

### Step 3: Database Migration

Add a `caption` text column to the `designs` table so captions persist with saved designs.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/design-studio/index.ts` | Add Caption Agent call after Copywriter, include `caption` in response |
| `src/pages/DesignStudio.tsx` | Display caption card with copy button below generated designs |
| DB migration | Add `caption` text column to `designs` table |

