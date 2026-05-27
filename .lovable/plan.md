## Goal

Make `openai/gpt-image-2` the sole image rendering model for both single designs and carousels in `supabase/functions/design-studio/index.ts`. Remove all Gemini image models from rendering paths.

## Scope

- `supabase/functions/design-studio/index.ts` — single render (`renderVariation`, ~L2487–2545), carousel slide render (~L2829–2886), and any other image-render call site (search confirms only the chat-completions image calls in this file).
- `supabase/functions/_shared/model-fallback.ts` — repoint `imageFast` and `imageHD` chains to gpt-image-2 (image generation only).
- Leave non-rendering features alone: Logo Designer (`logo-designer/index.ts`) stays on Gemini per existing onboarding behaviour; chat/reasoning calls in design-studio (Copywriter, Creative Director, genome, captions) are unchanged.

## API changes (the key shift)

gpt-image-2 uses **`/v1/images/generations`**, not `/v1/chat/completions`. Body shape is different:

```json
{ "model": "openai/gpt-image-2", "prompt": "...", "size": "1024x1024", "quality": "low" }
```

- No `messages`, no `modalities`, no `image_config.aspect_ratio`.
- Response shape: `data[0].b64_json` (non-streaming) — pure base64, no `data:image/png;base64,` prefix.

We will use non-streaming (`stream` omitted) on the backend — edge functions return a single JSON to the client, and `enforceCanvasDimensions` already crop/resizes to exact target dims afterward.

## Implementation

1. **Helper**: add a local `renderWithGptImage(prompt, w, h)` helper inside `design-studio/index.ts` that:
   - Maps `(w, h)` to the nearest supported gpt-image-2 `size` (`1024x1024`, `1024x1536`, `1536x1024`) by aspect ratio.
   - POSTs to `https://ai.gateway.lovable.dev/v1/images/generations` with `{ model: "openai/gpt-image-2", prompt, size, quality: "high" }`.
   - Wraps with `retryFetch`; on `429` → `RATE_LIMIT`, `402` → `CREDITS_EXHAUSTED`.
   - Returns base64 string (already raw — no `data:` prefix to strip).
   - Includes one retry on missing `data[0].b64_json`.

2. **Single render (`renderVariation`)**:
   - Remove `imageRefs` / `imageContent` multimodal payload (gpt-image-2 is text-only prompt).
   - Fold any reference-image context (logo URL, inspiration URL, product URL, brand colours) **into the text prompt** as descriptive instructions (e.g. "Brand logo URL for reference: …", "Use these brand colours: …"). Keep `user_image_url`/`previous_image_url` mentions as text-only hints since gpt-image-2 generations can't ingest them — note this as a known limitation.
   - Replace the fetch block with `await renderWithGptImage(finalPromptText, w, h)`.
   - Drop `mapToGeminiAspectRatio` usage at this site.

3. **Carousel render (loop ~L2829–2886)**:
   - Same swap: build a single text prompt per slide (including logo description if `brand?.logo_url` exists), call `renderWithGptImage`, decode `b64_json`, run `enforceCanvasDimensions`, upload as today.

4. **`_shared/model-fallback.ts`**:
   - `imageFast.primary` and `imageHD.primary` → `"openai/gpt-image-2"`.
   - `fallbacks` → `[]` (user wants only gpt-image-2). Keep the chain structure so callers don't break.
   - Note: only `logo-designer` currently imports these chains for images; verify it still works since it builds chat-completions requests — if it would break, leave `MODEL_CHAINS.imageFast/HD` unused by design-studio and just hardcode gpt-image-2 in design-studio, leaving logo-designer's local Gemini choice untouched. **Decision: hardcode in design-studio, do NOT change `model-fallback.ts`** to avoid collateral damage to logo-designer.

5. **Cleanup**: remove now-unused `mapToGeminiAspectRatio` import/calls in the two render paths (function itself can stay if used elsewhere — will check during edit).

## Known tradeoffs (called out, not blockers)

- **Reference images dropped**: gpt-image-2 generations endpoint doesn't accept logo/product/inspiration image inputs. We'll describe them in the prompt instead. Logo placement fidelity will degrade vs. the current Gemini chat-image approach.
- **Aspect ratios**: gpt-image-2 only supports 1:1, 2:3, 3:2. Non-matching canvases (e.g. 9:16 stories) will be generated at the closest supported size then center-cropped by `enforceCanvasDimensions` — already in place, so output dims stay correct.
- **Cost/latency**: gpt-image-2 is generally slower and more expensive than Gemini Flash Image. Acceptable per user request.

## Verification

- Trigger a single design render and a carousel render from the UI; confirm both produce images and upload successfully.
- Check edge function logs for `400` from the images endpoint (would indicate body-shape mismatch).
