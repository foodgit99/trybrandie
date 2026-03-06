

## Plan: Add Quality Toggle (Fast / HD) to Design Studio

### What Changes

**1. Frontend — `src/pages/DesignStudio.tsx`**
- Add a new state: `renderQuality` with values `"fast"` or `"hd"`, defaulting to `"fast"`
- Add a toggle control (segmented button or small select) near the existing canvas size selector, labelled "Fast" and "HD" with brief descriptions (Fast = quick renders, HD = higher quality, slower)
- Pass `render_quality` in the `supabase.functions.invoke("design-studio", { body: { ... } })` payload

**2. Backend — `supabase/functions/design-studio/index.ts`**
- Destructure `render_quality` from the request body (line 34)
- At the image generation call (~line 839), conditionally set the model:
  - `"fast"` or undefined → `"google/gemini-2.5-flash-image"`
  - `"hd"` → `"google/gemini-3-pro-image-preview"`

### UI Placement

The toggle will sit in the toolbar row alongside the canvas size selector, audience selector, and trend selector — a compact two-option segmented control using existing Button components with `variant="outline"` / `variant="default"` styling. It will show a small `Sparkles` icon for HD mode.

### No Database Changes Required

The quality preference is ephemeral per session — no migration needed.

