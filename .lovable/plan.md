
# Default Design Size Preference (Cockpit + Autonomous Mode)

## Decision
Add a **Default design size** preference in Settings that controls the canvas used for all Cockpit and Autonomous Mode generations. Studio keeps its existing per-generation size picker.

## Options Offered
Curated to safe, universally-usable sizes:
- **Square 1080×1080** (default — safest cross-platform)
- **Portrait 1080×1350** (IG/FB feed portrait)
- **Story / Reel 1080×1920** (vertical 9:16)

Carousels remain forced to square regardless of this preference (multi-slide UX requirement).

## Schema
- `autopilot_settings.default_canvas_size text` — nullable, check constraint on the three values above. Defaults to `'1080x1080'` when null.

## Server (Autonomous Mode + Cockpit ideation)
`supabase/functions/brand-engine/index.ts`
- In `generate_weekly_ideas` and `fill_empty_days`, read `default_canvas_size` from `autopilot_settings` alongside the other autopilot defaults.
- Resolution order for `canvas_size` per idea:
  1. If `content_format === "carousel"` → `1080x1080`
  2. Else if user has a `default_canvas_size` → use it
  3. Else fall back to current behaviour (AI-suggested → format default)

Any other Cockpit-side idea inserter (`autopilot-planner` seeding) applies the same default.

## Frontend
- `src/pages/v2/Settings.tsx`: new "Default design size" row inside the existing Autonomous Mode section — three-pill toggle (Square / Portrait / Story), persists to `autopilot_settings.default_canvas_size`. Subtitle: "Used for Cockpit and Autonomous Mode posts. You can still override per-design in Studio."
- No changes to `/studio` — the existing size picker stays.
- `src/integrations/supabase/types.ts` regenerates after the migration.

## Out of Scope
- No changes to Studio UI/flow.
- No backfill of existing `content_ideas.canvas_size`.
- No new sizes beyond the three above (keeps the UI a clean 3-pill toggle).

## Verification
- Set preference to Portrait → trigger Autonomous Mode generation → confirm new non-carousel ideas have `canvas_size = '1080x1350'` and carousels are still `1080x1080`.
- Set preference to Square → confirm everything generates square.
- Open Studio → confirm the per-generation size picker still works and isn't affected.
