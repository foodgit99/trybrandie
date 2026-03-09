

## Plan: Background Design Generation with Floating Status Indicator

### Problem
When a user navigates away from the Design Studio during generation, the component unmounts and the in-flight request is lost.

### Solution
Extract the generation logic into a **React Context** that lives at the App level (above the router), so generation survives page navigation. Add a **floating indicator component** rendered globally that shows progress and links back to the studio.

### Architecture

```text
App.tsx
├── DesignGenerationProvider  ← NEW context wrapping BrowserRouter
│   ├── BrowserRouter
│   │   ├── Routes...
│   │   └── DesignStudio (calls context.startGeneration instead of inline fetch)
│   └── FloatingDesignStatus  ← NEW floating component, always rendered
```

### New Files

**1. `src/contexts/DesignGenerationContext.tsx`**
- React context + provider holding generation state: `status` (idle | generating | complete | error), `progress` message, `result` (image_url, design_id, explanation, genome, etc.), `error`
- Exposes `startGeneration(params)` — takes the same payload currently passed to `supabase.functions.invoke("design-studio", ...)`, fires the request, updates state, handles auto-save on completion
- Exposes `clearResult()` to reset after user acknowledges
- The provider holds all the async logic currently in `sendMessage()` (edge function call + auto-save + credit refresh)
- Generation runs in the context regardless of which page is mounted

**2. `src/components/FloatingDesignStatus.tsx`**
- Rendered inside the provider, outside the router (always visible)
- Only appears when `status !== 'idle'`
- Fixed position bottom-right, small pill/card with:
  - **Generating**: pulsing animation + "Creating your design..." text
  - **Complete**: success icon + "Design ready!" + thumbnail preview
  - **Error**: error state with message
- Clicking navigates to `/studio?design={designId}` (or back to studio with result)
- Auto-dismisses after 30 seconds if not clicked, or user can close it
- Uses framer-motion for enter/exit animations
- Plays a subtle toast notification on completion

### Changes to Existing Files

**`src/App.tsx`**
- Wrap `BrowserRouter` with `DesignGenerationProvider`
- Render `FloatingDesignStatus` inside the provider

**`src/pages/DesignStudio.tsx`**
- Import and use `useDesignGeneration()` context
- Replace the inline `supabase.functions.invoke` call in `sendMessage()` with `context.startGeneration(params)`
- Listen to context state changes to update local messages, currentImage, etc. when generation completes (via useEffect on context.result)
- Keep all UI state (messages, input, canvas size, etc.) local — only the async generation is delegated to context

### Behavior Details

- When generating and user navigates away: floating pill stays visible showing "Creating..."
- On completion: pill updates to "Design ready! Click to view", toast fires
- Clicking the pill navigates to `/studio?design={id}`
- If user is already on `/studio`, the pill still shows but the result is also applied directly to the page state
- Only one generation at a time (startGeneration is a no-op if already generating)

### Files Changed

| File | Change |
|---|---|
| `src/contexts/DesignGenerationContext.tsx` | New — context provider with generation logic |
| `src/components/FloatingDesignStatus.tsx` | New — floating status pill component |
| `src/App.tsx` | Wrap with provider, render floating component |
| `src/pages/DesignStudio.tsx` | Delegate generation to context, sync results back |

