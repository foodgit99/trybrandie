# User-editable funnel stages

Today a brand can only rename a funnel stage and change its one-line description. The four stages themselves, their order, and which content categories fall into each stage are hardcoded. This plan makes the funnel a real, brand-owned structure: add stages, remove stages, reorder them, and decide which content categories map into each.

## What the user gets

In Hub → Funnels → "Edit stages":

- **Add a stage** with its own name, description, and category mapping (e.g. "Nurture" between Consideration and Conversion).
- **Remove a stage.** Posts sitting in it are moved to the nearest remaining stage, and the user is told where they went before confirming.
- **Reorder stages** (move up / move down) so the board reads in the order they actually sell.
- **Pick categories per stage** from the existing content categories, with a warning if a category is claimed by two stages or left unclaimed.
- **Custom art direction note** per stage — a free-text line telling the renderer how posts in that stage should look. Built-in stages keep their existing direction as the default.
- **Reset to defaults** stays available and restores the standard 4-stage funnel.

The Funnels board, the "Move to stage" menu, the stage cards, and the planner's stage balancing all follow the brand's stage list rather than the fixed four.

## Behaviour rules

- Every brand must keep at least two stages; the editor blocks going below that.
- The four built-in stage IDs (`awareness`, `consideration`, `conversion`, `retention`) can be renamed, reordered, remapped, or removed, but their IDs are never reused for a different meaning — custom stages get their own slug IDs.
- Any post whose stage no longer exists is treated as belonging to the first stage that claims its content category, falling back to the first stage in the list. Nothing ever renders as "no stage".
- Removing or reordering stages triggers no automatic replanning; the change applies to the next weekly plan (with an optional "replan the rest of this week" prompt reusing the existing mid-cycle replan path).

## Technical notes

**Data**: keep everything in the existing `brands.funnel_stages` JSONB column — no migration needed. Extend the stored shape from `{id,label,blurb}` to a full ordered stage list: `{id, label, blurb, categories: string[], art_direction?: string, custom?: boolean}`. An empty array still means "use defaults", so existing brands are unaffected.

**Shared resolution**: rewrite `resolveBrandStages` in both `src/lib/funnelStages.ts` and `supabase/functions/_shared/funnel-stages.ts` (kept as mirrors) to:
- return the stored ordered list when present, merged over defaults for built-in IDs;
- expose `categoryToStage` and `getEffectiveStage` driven by the resolved list rather than the constant;
- assign icons/accents deterministically for custom stages (hash the slug into the existing accent palette) so the UI keeps its look.
- `FunnelStageId` becomes `string` with the built-in IDs as named constants; `normaliseStageId` validates against the brand's resolved list instead of a fixed union.

**UI**: rework `EditStagesDialog` in `src/components/v2/hub/FunnelsEditableTab.tsx` into a stage-list editor (add / remove / reorder rows, category multi-select via existing `contentCategories` metadata, art-direction textarea, validation messages, removal-reassignment confirmation). Replace the fixed `Record<FunnelStageId, …>` buckets with a keyed map built from the resolved stages.

**Planner** (`supabase/functions/brand-engine/index.ts`): build the stage enum, coverage counts, under-served ranking, and the prompt's funnel section from the brand's resolved stages instead of `STAGE_IDS`; drop the hardcoded "cover at least 3 of 4" wording in favour of a proportional rule based on stage count.

**Renderer** (`supabase/functions/_shared/campaign-context.ts`): prefer the stage's `art_direction` when present, then the built-in `STAGE_ART_DIRECTION`, then a generic fallback built from the stage label and blurb, so custom stages still produce a real creative directive.

**Campaign routing** (`supabase/functions/_shared/resolve-autopilot-campaign.ts`): derive stage → category lists and stage labels from the brand's resolved stages (fetched alongside the brand) rather than the module-level constants, keeping the existing fallback chain and quota guards intact.

**Settings**: the "default funnel stage" picker in `src/pages/v2/Settings.tsx` lists the brand's stages, and a stored default that no longer exists falls back to the first stage.
