# Blueprint Audit — Findings & Fix Plan

## What I found

The Blueprint pipeline has two real, separate problems. Both are fixable without changing the architecture.

### 1. Why the weekly plan repeats

The Sunday planner (`brand-engine` → `generate_weekly_ideas`) does look at history, but only at the **category level**. It reads the last 14 days of `content_ideas` and tells the AI "you've used `educational` 3 times, `bts` 0 times" — but it never shows the AI the **titles or prompts** of those past ideas. So week after week the AI happily re-invents "Tip of the week" or "Today's special" because, structurally, those are different ideas with the right category mix.

Contributing factors:
- No `last_used_at` tracking on `content_pillars` or `post_series`, so the same pillar anchors the same day-role every week.
- The onboarding `PLAYBOOK_SEEDS` are fully static (7 hard-coded ideas per vertical). They only run once at onboarding (idempotent), so they explain *week 1* feeling templated, not perpetual repetition.
- The interesting bit: the `fill_empty_days` handler in the same file already does the right thing — it loads recent `title`s and tells the AI "do NOT repeat these". `generate_weekly_ideas` just doesn't.

### 2. Why Blueprint designs look lower quality than Studio

Yes, both paths call the same `design-studio` function — but **`content-autopilot` sends a broken payload** that silently strips the most important context.

| Field | Studio sends | content-autopilot sends | Effect |
|---|---|---|---|
| `audience_id` | UUID from `target_audiences.id` | the audience **label string** (e.g. `"Young Professionals"`) | `design-studio` does `.eq("id", audience_id)` → returns null → **JTBD profile is completely dropped**. Brief Agent falls back to `"general audience — broad appeal"`. This is the biggest quality gap. |
| `canvas_size` | user-selected platform preset | hardcoded `"1080x1080"` | No portrait/story support from Blueprint. |
| `messages` | full conversation | single message with `idea.prompt` | Expected for automation; quality then depends entirely on how rich `idea.prompt` is. |

Brand object, inspiration images, products, and RAG preference context all flow through correctly because `design-studio` re-fetches them from the DB using `brand.id`/`user.id`. So the *only* substantive quality leak is the audience.

---

## Proposed fixes

### Fix A — Stop the JTBD context from being dropped (biggest quality win)
In `supabase/functions/content-autopilot/index.ts` (~line 457):
- Change `designPayload.audience_id = audience.label || "primary"` → pass the actual `audience.id` (UUID).
- Load the audience by querying `target_audiences` for the brand (preferring the primary/most-recent one) and pass its `id`.

### Fix B — Make `generate_weekly_ideas` topic-aware (biggest repetition win)
In `supabase/functions/brand-engine/index.ts` (`generate_weekly_ideas`, ~lines 675-810):
- Extend the recent-history query to also select `title` and `prompt` (currently only `content_category, scheduled_for`).
- Build a `recentTitles` block (mirroring what `fill_empty_days` already does at line 941) covering the last 21–28 days.
- Inject it into the AI system prompt as a "do NOT repeat these topics or near-duplicates — vary the angle" constraint.

### Fix C — Pillar rotation signal (secondary repetition win)
- Add `last_used_at timestamptz` to `content_pillars` (migration).
- In `generate_weekly_ideas`, after inserting ideas, stamp `last_used_at = now()` on the pillars referenced.
- Order pillars surfaced to the AI by `last_used_at ASC NULLS FIRST` and label least-recently-used ones as "prioritise these".

### Fix D — Let the planner choose a canvas size (small quality/variety win)
- Either: pass `canvas_size: "1080x1350"` (portrait) by default in `content-autopilot` since portrait performs better on IG, **or**
- Add an optional `canvas_size` column on `content_ideas` that the planner can set per idea (e.g. carousels stay 1:1, single-image posts go 4:5). Then `content-autopilot` forwards it.

I'd recommend starting with the simple default switch (portrait 1080×1350) unless you want per-idea control.

---

## Implications

- **Fix A** is a one-line behavioural change but will visibly lift design quality for every autopilot post immediately — Brief Agent will start using real struggling moments, emotional drivers and conversion levers instead of "general audience".
- **Fix B** doesn't increase token cost much (titles are short) and the AI will start producing genuinely different weekly arcs. Combined with Fix C, repetition should largely disappear.
- **Fix C** requires a small DB migration and a write-back in the planner. Low risk.
- **Fix D** (portrait default) is a one-character change with a noticeable visual upgrade on IG/feeds.
- None of this touches the Studio path, the design-studio function itself, or the user-facing `/blueprint` UI.

---

## Order of operations

1. Fix A (audience UUID) — biggest quality lift, smallest change.
2. Fix B (recent titles in planner prompt) — biggest repetition lift.
3. Fix C (pillar `last_used_at` + migration) — reinforces variety.
4. Fix D (portrait default or per-idea canvas) — polish.

Want me to proceed with all four, or start with A + B only?
