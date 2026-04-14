

## Plan: Add Content Categorisation to the Design Pipeline

### Problem
The design pipeline currently has no awareness of *what type* of content the user is requesting. An announcement post, a promotional graphic, and an educational infographic all go through identical creative logic. This means the Brief Agent, Copywriter, and Renderer don't adapt their visual strategy, copy tone, or composition to the content category — resulting in designs that may not fully align with the user's intent.

### Approach: Lightweight Categoriser + Context Injection

Add a fast, deterministic-first content categoriser that runs early in the pipeline, then inject the category and its creative guidelines into the **Brief Agent**, **Copywriter**, and **Caption Agent** prompts. No new edge function or standalone agent needed — this is a prompt enrichment layer inside `design-studio/index.ts`.

### The 10 Content Categories

| # | Category | Key Visual/Copy Signals |
|---|----------|------------------------|
| 1 | Announcement | Bold headline, "new/launch/introducing", high energy |
| 2 | Educational | Structured info, tips/steps, authority tone |
| 3 | Informational | Clean/minimal, factual, logistical details |
| 4 | Entertainment | Playful, meme-like, relatable, scroll-stopping |
| 5 | Promotional | CTA-heavy, offer/price, urgency signals |
| 6 | Trending | Cultural moment, format-aware, reach-focused |
| 7 | Holidays & Greetings | Festive, warm, celebratory, seasonal |
| 8 | Social Proof / UGC | Testimonials, quotes, trust-building |
| 9 | Behind-the-Scenes | Authentic, raw, human, candid feel |
| 10 | Interactive / Engagement | Question-driven, poll-like, conversation starter |

### Changes — `supabase/functions/design-studio/index.ts`

**Step 1: Add category definitions map (~50 lines)**
- Define a `CONTENT_CATEGORIES` constant mapping each category ID to its name, description, and creative directives for copy, visual style, and composition.
- Example: `promotional` → CTA must be prominent, urgency language, high-contrast, product-focused layout.

**Step 2: Add rule-based categoriser with LLM fallback (~40 lines)**
- First attempt deterministic classification using keyword/regex patterns against the user prompt (e.g., "launching" → announcement, "tips" → educational, "sale/offer/discount" → promotional, "happy birthday/merry christmas" → holidays).
- If no confident match (no pattern fires), use a single fast LLM call (`gemini-2.5-flash-lite`) with a structured tool call to classify into one of the 10 categories. This runs in parallel with the existing Inspiration Analysis promise — zero added latency.

**Step 3: Inject category context into Brief Agent prompt (~5 lines)**
- Append a `CONTENT CATEGORY` section to the Brief Agent's system prompt with the category name and its visual/composition directives.
- Example: "This is PROMOTIONAL content. The composition must foreground the offer/CTA. Use high-energy, action-oriented visual direction."

**Step 4: Inject category context into Copywriter Agent prompt (~5 lines)**
- Append category-specific copy guidelines to the Copywriter's system prompt.
- Example: "This is EDUCATIONAL content. Structure the copy as clear, digestible insight. Use authority-building language. The headline should promise value."

**Step 5: Inject category context into Caption Agent prompt (~3 lines)**
- Append category name so the caption matches the content intent.
- Example: "This is SOCIAL PROOF content. The caption should reinforce trust and encourage sharing."

**Step 6: Include category in the response payload (~2 lines)**
- Add `content_category` to the JSON response so the frontend can display or log it.

### Why This Approach

- **No new agent or edge function** — the categoriser is a lightweight step inside the existing pipeline
- **Zero added latency** — rule-based classification is instant; LLM fallback runs in parallel with existing async work
- **All agents benefit** — Brief, Copywriter, and Caption each receive category-specific directives without overloading any single agent
- **Genome is not affected** — visual style genome remains brand-driven; the category influences *composition intent* and *copy strategy*, not low-level gene values

### Files
- `supabase/functions/design-studio/index.ts` — all changes in this single file

