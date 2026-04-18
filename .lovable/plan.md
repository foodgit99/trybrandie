

I'll create three Mermaid flowchart artifacts mapping the complete data flow for each pipeline, plus a reference markdown file describing each agent's inputs/outputs.

### Flows I'll document

**1. Studio-First Flow** (`DesignStudio.tsx` → `design-studio` edge function)
   - Single-design `generate` / `edit` path
   - Carousel `generate_carousel` path

**2. Content Hub Flow** (`ContentHub.tsx` → `brand-engine` edge function)
   - `generate_pillars` → `generate_series` → `generate_campaigns` → `generate_weekly_ideas` chain
   - Each downstream design generation handed off to `design-studio`

**3. Content Autopilot Flow** (cron → `content-autopilot` → `design-studio` → `send-email`)
   - Auto-generates daily content for opted-in brands

### Each diagram will show
- **Entry point** (UI / cron) and request body
- **Auth + credit check** (free → bonus → reward → paid hierarchy)
- **Context assembly** (brand, audience JTBD, trend, RAG memory, products, holiday calendar)
- **Agent stages** with their model + input/output:
  - Content Category Classifier (rule-based → LLM fallback)
  - Brief Agent (Gemini Flash)
  - Genome Composer (preset → mutation → brand lock → stability gate)
  - Copywriter Agent (Gemini Flash, structured tool call)
  - Caption Agent (parallel with Copywriter)
  - Renderer (Gemini 3 Pro Image)
- **Reliability layer** (circuit breaker, retry, validation, tracer spans)
- **Persistence** (designs / content_ideas / pillars tables)
- **End output** (image URL + copy + caption returned to user)

### Files I'll produce
- `/mnt/documents/studio_flow.mmd` — Studio-first end-to-end pipeline
- `/mnt/documents/content_hub_flow.mmd` — Strategy → calendar → design pipeline
- `/mnt/documents/autopilot_flow.mmd` — Background scheduled pipeline
- `/mnt/documents/pipeline_reference.md` — Companion document with agent specs, models used, parallelism notes, and credit math

Each `.mmd` will be emitted as a `<lov-artifact>` with `mime_type="text/vnd.mermaid"` and the markdown as a separate artifact. Diagrams will use top-down `flowchart TD` with subgraphs for clear stage grouping and avoid emojis.

