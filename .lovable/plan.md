## Goal

When autopilot is enabled for a brand, the system should automatically generate carousels (not just single graphics) for ideas whose content type benefits from a multi-slide format — without the user manually toggling each idea.

## Current state

- `content-autopilot/index.ts` **already** branches on `idea.content_format === "carousel"` and calls `design-studio` with `action: "generate_carousel"`. ✅
- `brand-engine` weekly-ideas generator already assigns `content_format: "graphic" | "carousel"` per idea via the LLM. ✅
- **Gap 1 — Autopilot enrolment.** Both `brand-engine.generate_weekly_ideas` and `autopilot-planner` seed mode insert `content_ideas` rows **without** `autopilot: true`. The DB default is `false`, so the runner's `.eq("autopilot", true)` filter excludes them. Autopilot only fires today for ideas the user manually bulk-toggles.
- **Gap 2 — Seed playbooks.** `autopilot-planner` seed playbooks mis-use `idea_type: "carousel"` on two entries (retail "Style this", services "How we work") instead of `content_format: "carousel"`, and never assign `content_format` to any seeded idea.
- **Gap 3 — Slide count.** `content-autopilot` hardcodes `slideCount = 5`. `content_ideas` has no per-idea slide count, so all autopilot carousels are stuck at 5 slides.
- **Gap 4 — Format classification rule.** The LLM in `brand-engine` decides format ad-hoc. We should anchor a deterministic rule for autopilot.

## Plan

### 1. Auto-enrol new ideas into autopilot when brand has autopilot enabled

In both `brand-engine` insert paths (`generate_weekly_ideas`, `fill_empty_days`) and `autopilot-planner` seed mode:

- Read `autopilot_settings.enabled` for the brand once.
- If `enabled === true`, set `autopilot: true` on every inserted `content_ideas` row.
- Seed mode already turns autopilot ON at the end — so seeded ideas should be inserted with `autopilot: true` directly.

This makes "autopilot enabled" the single source of truth — no per-idea toggle needed.

### 2. Make seed playbooks carousel-aware

In `supabase/functions/autopilot-planner/index.ts`:

- Replace the mis-typed `idea_type: "carousel"` entries with `content_format: "carousel"` on educational / how-to / listicle / step-by-step seeds. Curate ~2 carousel ideas per playbook:
  - restaurants → "Behind the kitchen" (carousel, 4 slides)
  - beauty → "Treatment 101" (carousel, 4 slides)
  - fitness → "Form check" (carousel, 5 slides)
  - retail → "Style this" (carousel, 5 slides)
  - services → "How we work" (carousel, 5 slides)
  - general → "Tip of the week" (carousel, 4 slides)
- Insert each seed with explicit `content_format` (default `"graphic"`) and `slide_count` when carousel.

### 3. Per-idea slide count

- Migration: add `slide_count INT` (nullable, range check 2–10) to `content_ideas`.
- `brand-engine` weekly generator: extend the LLM JSON schema with optional `slide_count` (2–10). Default to 5 when carousel + null.
- `content-autopilot`: use `idea.slide_count ?? 5` instead of the hardcoded `5`. Pass through to `design-studio`.
- `ContentHub` idea dialog: when format = carousel, surface a small slide-count select (2–10, default 5). UI-only addition.

### 4. Format-routing rule (server-side anchor)

In `brand-engine` weekly generator, after the LLM returns ideas, run a deterministic post-pass: if `content_category` ∈ {`education`, `thought_leadership`, `social_proof` (case-study sub-type)} or `pillar_name` matches `how-to|tips|listicle|step|guide`, force `content_format = "carousel"`. Prevents the LLM from defaulting everything to "graphic".

### 5. Telemetry

Log `content_format` and `slide_count` in `autopilot_run_events` (extend the `logEvent` helper signature — additive only, no schema change required since we can stuff into existing `error_message` field is wrong; instead add nullable `metadata JSONB` column to `autopilot_run_events` and write `{format, slide_count}` on `completed` events). This lets us measure carousel mix per brand.

## Technical details

- Files edited:
  - `supabase/functions/autopilot-planner/index.ts` — seed playbooks + autopilot enrolment in seed mode.
  - `supabase/functions/brand-engine/index.ts` — autopilot enrolment in `generate_weekly_ideas` + `fill_empty_days`, slide_count in LLM schema, deterministic format post-pass.
  - `supabase/functions/content-autopilot/index.ts` — use `idea.slide_count`, log metadata.
  - `src/pages/ContentHub.tsx` — slide-count select in idea dialog (carousel only).
- Migrations:
  - `ALTER TABLE content_ideas ADD COLUMN slide_count INT CHECK (slide_count BETWEEN 2 AND 10);`
  - `ALTER TABLE autopilot_run_events ADD COLUMN metadata JSONB;`
- No new edge functions, no credit-model changes (carousel pricing already handled inside `design-studio`).

## Out of scope

- Changing carousel pricing or model selection (already standardised on `gemini-3-pro-image-preview` per memory).
- Retroactively flipping `autopilot=true` on existing ideas — only new inserts after this change get auto-enrolled. We can add a one-shot backfill if you want.
