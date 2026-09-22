# Replace unnecessary AI calls with fixed rules

Six places in the system currently ask an AI model to do work that plain rules already handle. Each one costs money, adds seconds of waiting, and can fail or drift. Swapping them for fixed logic makes the app faster, cheaper and more predictable — with no change to what the user sees.

## What changes

**1. Holiday and cultural event feed**
Today it searches the web and asks an AI to read the results. The app already ships a full holiday calendar (Nigerian + global, with content angles). Switch to that calendar as the primary source; keep the web-search path off by default behind a flag so it can be re-enabled later.

**2. "What kind of edit is this?" router in the Blueprint composer**
Currently an AI decides whether an instruction is a wording change, a look change, or a whole new idea. Replace with keyword matching (colour/font/layout/background → look; caption/headline/wording/shorter → text; swap/replace/different idea/audience/format → strategy). Anything unmatched stays a text edit, exactly as the AI fallback does today. Title/prompt rewriting keeps working from the instruction itself.

**3. Content category detection in the design pipeline**
Rules already run first; the AI only handles leftovers. Trust the category already chosen in the request or stored on the idea, expand the rule list to cover the common leftovers, and drop the AI fallback (defaulting to the existing "general" bucket).

**4. Long chat compression in the Studio**
Instead of paying an AI to summarise older messages, keep the first brief plus the most recent turns and a short factual digest of dropped messages (counts, colours/fonts mentioned, last design state). Same context budget, no model call.

**5. Bulk item categorisation in the planner**
The planner sends batches of items to an AI purely to label them. Reuse the same shared rule set as item 3, and leave genuinely ambiguous items in the default bucket.

**6. Gallery image style tagging**
Every render currently asks a vision model to describe the brand's gallery photos. Derive style tags from the brand's own settings (vibe, personality, tone, gallery labels) instead, so no vision call happens per render.

## What stays AI-powered

Copywriting, strategy, design direction, image rendering, audience intelligence, trend and competitor research, logo generation, and email drafting — all genuine generation, not labelling.

## Technical notes

- New shared module `supabase/functions/_shared/category-rules.ts` holding one rule table, used by `design-studio` and `brand-engine` (replaces `classifyCategoryWithLLM` and the `classify_items` tool call).
- New shared module `supabase/functions/_shared/edit-intent.ts` for the Blueprint edit router; `v2-edit-router` drops its gateway call.
- `_shared/holiday-feed.ts`: `fetchHolidayFeed` returns calendar-derived events (`source: "fallback"`) unless `HOLIDAY_FEED_LIVE=true`; Firecrawl + AI parse path kept but gated. `research_cache` writes unchanged.
- `design-studio`: remove the inspiration vision-tagging fetch and the summarisation fetch; replace with deterministic helpers. Keep the chat-preference cache (real preference inference) untouched.
- Deploy `design-studio`, `brand-engine`, `v2-edit-router`, `holiday-feed`, plus any function importing the shared holiday module.
- No database or UI changes; no schema migrations.

## Verification

- Trigger an edit of each kind in the Blueprint composer and confirm routing matches today's behaviour.
- Generate one single design and one carousel; confirm category, gallery/product image handling and output quality are unchanged.
- Load the Trends/holiday surfaces and confirm upcoming events still render with dates and angles.
- Run a weekly plan and confirm items land in the same category buckets.
