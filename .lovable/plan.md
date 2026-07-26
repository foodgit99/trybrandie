## Goal
Produce a comprehensive PDF: a full inventory of every AI agent in Brandie, with model, trigger, inputs, outputs, pipeline role, cost per run, and an open-source substitution recommendation.

## What I found so far (confirmed by scanning `supabase/functions/`)
There are ~25 AI-calling agents. Models in use today:

- `google/gemini-3.6-flash` — strategist-agent, stage-agent (6 personas), agent-roundtable, strategist-agent-webhook
- `google/gemini-3-flash-preview` — brand-engine (planner), brand-strategist, audience-intelligence, audience-suggest, competitor-digest, competitor-discover, trend-scout, design-studio caption pass
- `google/gemini-3.1-pro-preview` — brand-scraper, video-studio brain
- `google/gemini-2.5-flash` — email-marketing-generate, design-scorer
- `google/gemini-2.5-flash-lite` — holiday-feed, summarise-update, v2-edit-router, design-studio compression/inspiration passes, video-studio fast pass
- Image: `google/gemini-3-pro-image-preview` → `gemini-3.1-flash-image-preview` → `gemini-2.5-flash-image` (design-studio, video-studio), `openai/gpt-image-2` (logo-designer)
- `_shared/model-fallback.ts` defines the reasoning/light/planning/image fallback ladders

## Plan

1. **Complete the inventory** — read each AI-calling edge function plus `_shared/agent-tools.ts`, `stage-personas.ts`, `model-fallback.ts`, and `supabase/config.toml` / cron schedules to capture per agent: trigger (user action, cron, chained call, webhook), input sources (tables, RAG context, web scrape), output destinations (tables, storage, email, push), number of model calls per run, whether it's in the content pipeline, and tool/write access.

2. **Ground the cost column in real data** — pull actual usage from the AI Gateway request logs (per-model token usage and credit cost over the recent window) and combine with call counts per run to give a credits-per-run estimate per agent, with a low/typical/high band. Any agent with no logged traffic will be marked "estimated" rather than given a fake number.

3. **Open-source recommendation column** — for each agent, a Yes/No plus a named candidate and a one-line reason. Expected shape: light classification/compression/routing agents (v2-edit-router, summarise-update, holiday-feed, design-scorer, category classifiers) are strong OSS candidates (e.g. Llama 3.3 70B / Qwen 2.5 72B / Mistral Small class); deep-reasoning strategy and image-rendering agents stay on frontier models (no viable OSS parity for Gemini image rendering). I'll be explicit that OSS models are not currently servable through the Lovable AI Gateway, so adoption means self-hosting or a third-party OSS inference provider — the doc will state that trade-off rather than imply a one-line swap.

4. **Build the PDF** with ReportLab in Brandie's brand palette (Beige `#FAF8F5`, Charcoal `#2B2D33`, Gold `#C4993B`), landscape US Letter for the wide table. Structure:
   - Cover + methodology/caveats page
   - Executive summary: spend concentration, top 5 cost drivers, headline OSS savings opportunity
   - Master agent table (landscape, one row per agent, columns: Agent · Function · Model · Trigger · Inputs · Outputs · Pipeline stage · Calls/run · Est. credits/run · Frequency · Monthly cost weight · OSS? · OSS candidate · Why)
   - Per-cluster deep dives (Content pipeline · Conversational agents · Intelligence/research · Rendering · Email · Utility)
   - Cost model appendix and a phased OSS migration recommendation

5. **QA** — render every page to images and inspect for clipped/overflowing table text, then deliver to `/mnt/documents` as a downloadable artifact.

## Notes
- This is a read-only analysis: no application code changes.
- Credit figures are estimates derived from logged gateway usage, not a billing statement; the doc will label them as such.
