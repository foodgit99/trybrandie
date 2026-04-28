## Goal

Make every content category produce its own world-class output by enriching it across **five dimensions**: copy directive, brief directive, **layout recipe**, **image style preset**, and **CTA policy** — plus a **research enrichment step** for categories that need fresh information, and a **category-bias step** in the Genome Composer so visuals lean toward the right typography/composition/texture genes per category.

---

## 1. Per-category enrichment matrix

Each of the 10 categories gets a single config object with these fields:

| Field | Purpose |
|---|---|
| `copy_directive` | Concrete copy spec (length, tone, persona, words to avoid) |
| `brief_directive` | Concrete art-direction spec (focal anchor, hierarchy, mood) |
| `layout_recipe` | `{ grid, focal, hierarchy_ratio, cta_position, type_personality, palette_bias, suggested_aspect, info_density }` |
| `image_style` | `{ medium, lighting, color_grading, framing, illustration_override, infographic_mode }` |
| `cta_policy` | `"required" \| "optional" \| "forbidden"` (+ caption CTA policy) |
| `caption_directive` | Emoji/hashtag policy + length |
| `needs_fresh_info` | Whether to invoke research enrichment |
| `research_focus` | What to look up (e.g. "current viral formats", "today's holiday context") |
| `genome_bias` | Soft overrides for VSGS genes (e.g. typography.font_personality, composition.focal_strategy) |

### The 10 category enrichments

**Announcement** — CTA: optional. Hero = the news. Layout: strict_grid, single_focal, headline-dominant. Image style: cinematic photo / dramatic lighting / wide framing. Caption: 1 emoji max, 3–5 hashtags. No research.

**Educational** — CTA: optional ("Save this", "Read more"). Infographic_mode: ON when prompt implies steps/lists/stats. Layout: modular_grid with numbered/sectioned blocks, balanced hierarchy, info_density = dense. Image style: clean illustration or schematic; minimal photography; supports diagrams/icons/charts. Caption: educational expansion, save/share CTA.

**Informational** — CTA: forbidden (utility, not persuasion). Infographic_mode: ON for hours/locations/policies/menus. Layout: strict_grid, text_dominant, max readability, scannable. Image style: minimal/flat illustration or none; pure typography preferred. Caption: factual, no hashtags or 1–2 max.

**Entertainment** — CTA: forbidden. Tone: meme-like, humorous, no promotional undertone. Layout: broken_grid or freeform, dynamic balance, single bold punchline focal. Image style: meme-aesthetic photo or playful illustration, high-saturation, candid. Type personality: street/friendly. Research: ON — pull current meme/format references. Caption: 0–1 emoji, 0–2 hashtags, conversational only — no "Shop now" / "Learn more".

**Promotional** — CTA: required (most prominent element). Layout: dynamic balance, dual_focal (offer + CTA), high contrast, image_dominant or balanced, palette_bias = warm/high-saturation. Image style: product hero photography, dramatic lighting, vibrant grading. Caption: clear CTA, urgency, code/link.

**Trending** — CTA: optional. Research: ON — fetch current viral formats / cultural moments relevant to brand niche; bias the design toward that format. Layout: format-aware (whatever the trend dictates). Image style: matches the current trend aesthetic. Caption: trending hashtags prioritised.

**Holidays & Greetings** — CTA: forbidden (unless prompt explicitly combines with promo, then optional). Research: ON — confirm today's/upcoming holiday context, regional relevance, traditional motifs/colours. Layout: centered, symmetrical, warm festive palette bias. Image style: warm cinematic, soft lighting, festive motifs. Caption: heartfelt, 1–2 emoji, light hashtags, no sales language.

**Social Proof** — CTA: optional ("Join them", "See more reviews"). Layout: quote-as-hero, single_focal, balanced hierarchy, includes attribution slot. Image style: real-feel photography (customer/result) or clean quote card with subtle texture. Caption: trust-reinforcing.

**Behind-the-Scenes** — CTA: forbidden by default. Layout: freeform, asymmetrical, candid framing, image_dominant, low text density. Image style: candid documentary photography, natural lighting, close_crop. Type personality: friendly. Caption: personal, 1–2 emoji.

**Interactive / Engagement** — CTA: required but conversational ("Vote below", "Tell us"). Infographic_mode: ON for this-or-that / poll layouts (split layout, two clear choices, question-mark visual). Layout: split or symmetrical for choice, bold question. Image style: bright, playful. Caption: directly asks for replies. Research: optional (only if topic is time-sensitive).

---

## 2. Research Agent (new)

A new helper `enrichWithResearch(category, userPrompt, brand)` runs **only when** `needs_fresh_info === true`.

- Calls Perplexity (`sonar` model, `search_recency_filter` = `day` for trending/entertainment, `week` for holidays/informational) using the existing `PERPLEXITY_API_KEY` secret.
- Falls back gracefully (returns empty enrichment) if key missing or call fails — never blocks generation.
- Returns a small `research_context` string injected into the brief + copy + caption agents.
- Cached per (category + brand_id + day) in-memory for the function instance to avoid duplicate calls in a session.
- Runs in parallel with category classification once category is known.

Used for: **trending, entertainment, holidays, informational** (and optionally interactive when the prompt mentions a date/event).

---

## 3. Genome Composer category-bias step

After the Genome Composer produces `genomeData`, apply `applyCategoryBias(genomeData, category, lockRules)`:

- Each category declares soft preferences (e.g. Educational → `typography.hierarchy_logic = "balanced_hierarchy"`, `layout.content_ratio = "text_dominant"`, `texture.intensity = "subtle"`).
- Bias only mutates **free** or **semi_flexible** genes per `DEFAULT_LOCK_RULES`. Locked genes (brand colour primary, brand font) are never touched.
- Update `computeGenomeScores` to add a **Category Fit Score** (0–100) measuring how well the genome aligns with the category's preferred genes — surfaced in stability metrics and used by the existing auto-refinement pass.

---

## 4. CTA enforcement

- A new `enforceCTAPolicy(copyStructure, category)` runs after the copywriter:
  - `forbidden` → blanks `cta` and removes CTA-style language from `headline`/`subheadline` (regex sweep for "shop", "buy", "book", "learn more", "sign up", "click", "get yours").
  - `required` → if CTA is empty, asks copywriter for a single-shot retry with CTA mandatory; if still empty, injects a sensible default from category.
  - `optional` → no-op.
- The renderer prompt is updated so when `cta_policy === "forbidden"`, it includes: *"Do NOT include any CTA button, action prompt, or transactional language in this design."*
- Caption agent receives the same policy and mirrors it (no "Shop now" in entertainment captions, etc.).

---

## 5. Image style + infographic injection into renderer

`renderVariation` builds the image prompt today from one big template. Add a `categoryRenderInjection` block built from `image_style` + `layout_recipe`:

- Medium (photo / illustration / mixed / infographic)
- Lighting + grading
- Framing + focal anchor
- When `infographic_mode === true` (Educational steps, Informational facts, Interactive polls): explicit instruction to render numbered blocks, icons, data visualisation, or split-choice layout instead of a single hero photo.
- Type personality nudge (e.g. "use a friendly geometric sans" for Entertainment).

This is appended to the existing image prompt **after** brand colours/fonts (so brand always wins), and **before** trend overlay.

---

## 6. Files to change

- **`supabase/functions/design-studio/index.ts`** — replace the current `CONTENT_CATEGORIES` config with the enriched matrix; add `enforceCTAPolicy`, `enrichWithResearch`, `applyCategoryBias`, `buildCategoryRenderInjection`; wire them into the brief/copy/caption/render pipeline; extend `computeGenomeScores` with Category Fit.
- **New shared helper**: `supabase/functions/_shared/category-recipes.ts` — exports the 10-category matrix + helper functions so the same recipes can be reused by `brand-engine`, `content-autopilot`, and any future agent that needs them.
- **`supabase/functions/brand-engine/index.ts`** — import the shared recipes so weekly content ideas already carry the right CTA policy and infographic intent into Studio.
- **No frontend / no DB migration** required.

---

## 7. Secret needed

The research step needs `PERPLEXITY_API_KEY`. If it's not already configured, I'll prompt for it via `add_secret` before deploying — but the code will degrade gracefully (no research enrichment) if the key is absent, so the rest of the upgrade ships independently.

---

## Outcome

Each category becomes self-sufficient: Educational ships infographic-style designs with save-CTA copy; Entertainment ships meme-like visuals with zero promotional language; Holidays pull today's actual occasion via research; Promotional always carries a clear CTA; Informational stays utility-clean with no sales push. Visuals, copy, captions, and genome all bend toward category fit — without breaking brand locks.