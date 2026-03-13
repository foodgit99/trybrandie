

# Fix: Special Instructions not being followed in designs

## Problem

Special Instructions are only injected into the **Brief Agent's** system prompt (line 870). The downstream agents that actually produce the final output — the **Copywriter**, **Caption Agent**, and **Image Renderer** — never see the special instructions directly. The Brief Agent may partially reflect them in its design brief, but there's no guarantee the instructions carry through to the final image and copy.

## Fix

Inject `brand.special_instructions` into three additional places:

**1. Copywriter Agent prompt** (~line 1388)
Add after the existing rules:
```
${brand?.special_instructions ? `\nSPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY): ${brand.special_instructions}` : ""}
```

**2. Image generation prompt** (~line 1588)
Append special instructions into `imagePromptText` so the image model sees them directly:
```
${brand?.special_instructions ? ` SPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY): ${brand.special_instructions}` : ""}
```

**3. Caption Agent prompt** (wherever the caption system prompt is built)
Add special instructions so captions also respect brand directives.

## Files changed

| File | Change |
|---|---|
| `supabase/functions/design-studio/index.ts` | Add `special_instructions` to copywriter prompt, image prompt, and caption prompt |

This ensures every agent in the pipeline sees and obeys the special instructions, not just the brief agent.

