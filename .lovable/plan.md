

## Problem

The dimension enforcement currently happens only as a text instruction to the image model at render time. The Brief Agent and Copywriter have no awareness of the canvas shape, so they plan layouts and copy density for an unknown format. The image model then defaults to its preferred landscape ratio because nothing upstream constrained the design direction to a specific shape.

## Solution: Propagate Canvas Format Upstream

Make the canvas dimensions a first-class input to every stage of the pipeline, not just a last-minute instruction to the renderer. Additionally, add post-processing to guarantee correct output dimensions.

```text
Current:  Brief Agent (no size awareness) → Copywriter (no size awareness) → Renderer (size in prompt, ignored)
Proposed: Brief Agent (size-aware layout) → Copywriter (size-aware density) → Renderer (size-aware) → Post-process crop
```

### Changes (single file: `supabase/functions/design-studio/index.ts`)

**1. Inject canvas format into the Brief Agent prompt**

Add explicit format instructions to the Brief Agent system prompt (around line 315) so it plans compositions for the correct shape:
- Square: "Design for a SQUARE 1:1 canvas. Plan a centered, compact composition."
- Portrait: "Design for a TALL PORTRAIT 9:16 canvas. Plan a vertically stacked composition."  
- Landscape: "Design for a WIDE LANDSCAPE 16:9 canvas. Plan a horizontally spread composition."

This ensures the brief itself describes a layout that fits the selected shape.

**2. Inject canvas format into the Copywriter prompt**

Add format context to the Copywriter system prompt (around line 361) so it adjusts copy density:
- Square: shorter copy, fewer elements
- Landscape: can accommodate more horizontal text
- Portrait: vertical hierarchy, stacked text blocks

**3. Post-process: crop output to exact target dimensions**

After receiving the generated image (after line 502), decode the base64 PNG, read its actual dimensions from the PNG header, and if it doesn't match the target aspect ratio, use a lightweight pure-JS image library (`imagescript` via esm.sh) to center-crop it to the correct dimensions. This is the safety net that guarantees correct output regardless of what the model produces.

**4. Keep existing dimension enforcement in the image prompt**

The `dimensionEnforcement` text stays as-is — it works as a strong hint. The post-processing crop is the fallback guarantee.

### Risk Mitigation
- `imagescript` is a pure TypeScript/JS library — no native binaries needed, works in Deno edge functions
- Center-crop preserves the focal content (center of the design)
- If the image library fails, we fall back to the raw image (no worse than current behavior)

