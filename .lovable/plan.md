

## Plan: Add Contextual Action Buttons to Strategist Responses

### Overview
After each strategist (plan mode) assistant message finishes streaming, the AI will optionally include structured action suggestions embedded in the response. These appear as clickable buttons below the message, allowing the user to jump to the Design Studio (design mode) with a pre-filled prompt, or navigate to the Content Hub to generate ideas.

### Approach

**1. Modify the edge function (`supabase/functions/brand-strategist/index.ts`)**

Update the system prompt to instruct the AI to optionally append a JSON block at the end of its response when — and only when — the conversation naturally leads to a concrete, actionable next step. The format:

```
<!-- ACTIONS
[{"label":"Design this","action":"design","prompt":"Create a bold promo post for..."},{"label":"Generate content ideas","action":"ideas","prompt":"Summer campaign ideas for..."}]
ACTIONS -->
```

The system prompt will emphasize: do NOT always include actions. Only include them when the strategist's advice naturally concludes with a specific, actionable design or content task.

**2. Parse actions from assistant messages (client-side in `DesignStudio.tsx`)**

- Create a utility function `parseStrategistActions(content: string)` that extracts the JSON actions block and returns `{ cleanContent: string, actions: Array<{label, action, prompt}> }`.
- When rendering plan messages, strip the actions block from the displayed markdown and render action buttons below the message bubble.

**3. Render action buttons below strategist messages**

- Only show on assistant messages that contain parsed actions.
- Style as small, pill-shaped buttons with appropriate icons (Palette for design, Lightbulb for ideas).
- On click:
  - `"design"` action: Switch to create mode (`setChatMode("create")`), populate the input with the prompt.
  - `"ideas"` action: Navigate to `/content-hub` (or trigger idea generation if applicable).

### Files Changed
- `supabase/functions/brand-strategist/index.ts` — Add action instruction to system prompt
- `src/pages/DesignStudio.tsx` — Parse actions from plan messages, render action buttons, handle click actions

### Key Constraints
- Actions are suggested sparingly — the system prompt will explicitly instruct the AI to only include them when the advice leads to a clear next step.
- Maximum 2 actions per response.
- The hidden JSON block is stripped from the visible message so the UX stays clean.

