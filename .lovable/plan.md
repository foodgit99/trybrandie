
## Goal

Let users on the Audience step of `/onboarding` (v2) click one button to have Brandie draft answers to all 11 questionnaire fields, then edit before continuing. Track which fields stayed AI-generated vs were user-edited so we can weight downstream quality.

## Quality impact — what we accept

- **Wins:** dramatic drop in step abandonment; median user reaches a usable JTBD profile instead of bouncing or typing one-word answers.
- **Risks:** autofill bias (users accept generic guesses), sanitised frustrations, marketing-speak `language_patterns`. The mitigations below contain this — they do not eliminate it. Net: ~70% of a thoughtful manual fill, ~250% of a rushed/skipped fill.

## Mitigations baked in

1. AI-suggested fields render with a subtle warm-amber tint and a small "AI draft" pill until the user edits them.
2. Helper text above the form after suggestion: *"Brandie's best guess based on your brand. Please correct anything that doesn't match your real customers — especially the words they use."*
3. The two highest-leverage fields (`frustrations`, `emotional_drivers`) get an extra inline nudge: *"Worth double-checking — this drives every caption."*
4. Per-field provenance saved on `target_audiences` so we can later identify brands whose audience is mostly AI-guessed and re-prompt them once real post engagement data exists.

## Backend

### 1. New edge function: `audience-suggest`

- Input: `{ brand_id }`. Function resolves auth, loads the brand row + `brand_products` rows.
- Builds a context block: name, description, tagline, industry/playbook, vibe, personality_traits, tone_of_voice, special_instructions, website_url, and a compact list of products/services (label + description + price).
- Calls `google/gemini-3-flash-preview` via Lovable AI Gateway with a tool-call schema mirroring `raw_inputs`:
  - strings: `who_buys`, `life_stage`, `improving`, `frustrations`, `not_working`, `tried_before`, `success_looks_like`, `consequences`, `when_buy`, `hesitations`
  - array: `emotional_drivers[]` (3–5 items, from the same fixed vocabulary the manual form uses)
  - plus `confidence` map: `{ field_name: 0..1 }`
- System prompt explicitly instructs: "Use language a Nigerian SME owner would actually hear from buyers. Avoid corporate jargon. If you do not have evidence for a field, return a short honest placeholder rather than fabricating specifics."
- Returns `{ raw_inputs, confidence }`. Maps 429→429, 402→402, gateway failures→503, matching existing convention.
- Deployed with `verify_jwt = false` and validates JWT in code (project pattern).

### 2. Schema change — provenance on `target_audiences`

Add one column:

- `field_sources jsonb NOT NULL DEFAULT '{}'::jsonb`
  Shape: `{ who_buys: "ai_suggested" | "user_edited" | "user_written", ... }`

No new table. RLS already covers `target_audiences`. Add via migration tool.

## Frontend

### 3. Audience step on `src/pages/v2/Onboarding.tsx`

Above the first question, primary button: **"✨ Suggest with Brandie"** (full-width on mobile, inline on desktop). Helper line beneath: *"Get a draft based on your brand, then make it yours."*

State additions in the step component:
- `suggesting: boolean`
- `fieldSources: Record<FieldKey, 'ai_suggested' | 'user_edited' | 'user_written'>` (initialised to `'user_written'` for anything the user typed before clicking).

On click:
- POST to `audience-suggest` with `brand_id`.
- On success: merge returned `raw_inputs` into form state for all fields that are currently empty OR were previously `ai_suggested`; mark those fields `ai_suggested`. Fields the user already typed into are preserved and stay `user_written`.
- On error: toast with the existing 402/503 messaging conventions.

Per-field behaviour:
- Inputs/textareas read a `data-source` attribute and apply a `bg-amber-50/40 border-amber-200` tint when `ai_suggested`.
- Render a small "AI draft" pill in the field label row.
- `onChange` flips the field's source to `'user_edited'` and removes the tint.
- For `emotional_drivers` chips, toggling any chip flips the source to `'user_edited'`.

Continue button stays enabled (soft nudge per user's choice). On submit:
- Persist `raw_inputs` + `field_sources` to `target_audiences` via the existing save path.
- Then call existing `audience-intelligence` exactly as today to build the JTBD profile.

### 4. Analytics

Three `trackEvent` calls via `src/lib/analytics.ts`:
- `audience_suggest_clicked` `{ brand_id }`
- `audience_suggest_completed` `{ brand_id, latency_ms }`
- `audience_suggest_submitted` `{ brand_id, edited_count, ai_kept_count, total_fields: 11 }`

The third one is the key signal for whether quality is holding.

## Files touched

- **New:** `supabase/functions/audience-suggest/index.ts`
- **Migration:** add `field_sources` column to `target_audiences`
- **Edit:** the Audience step component used by `src/pages/v2/Onboarding.tsx` (locate the existing 5-section questionnaire component and extend it; do not create a parallel form)
- **Edit:** the save path that writes `target_audiences` to include `field_sources`
- **No change** to `audience-intelligence` — it keeps consuming `raw_inputs` unchanged

## Out of scope (deliberately)

- Re-prompting users later based on `field_sources`. Column is in place; UI for it ships in a separate iteration once we have data.
- Changing the manual questionnaire copy or sections.
- Affecting the v1 `/onboarding` audience flow (this change is v2 only).
