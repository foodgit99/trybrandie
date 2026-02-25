

# Brandie MVP — Remaining Gaps vs PRD

After auditing every page, the edge function, and the database schema against the PRD and Definition of Done, here is what is already complete and what still needs to be built.

## Already Complete

- Brand creation via onboarding (name, tagline, description, logo, colours, typography, vibe, inspiration)
- Brand Centre for viewing and editing brand data
- Design generation via chat with brand context + logo injection
- Canvas size selection (Square / Story)
- Download in PNG and JPG with free-tier watermark
- Upvote / Downvote feedback on designs
- Save designs to database
- Recent designs on home dashboard
- Plans page with four tiers
- Generation limit gating (10/month for free tier)
- Authentication (email/password)

## Remaining Gaps (3 items)

### 1. Missing Brand Fields: Tone of Voice and Personality Traits

The PRD specifies `tone_of_voice` and `personality_traits[]` as core Brand Centre fields used by the Copywriter Agent. The current database only has `vibe`. Without these, the AI cannot accurately match the brand's voice.

**Changes:**
- Database migration: add `tone_of_voice` (text, nullable) and `personality_traits` (text[], default '{}') columns to `brands`
- Onboarding: add step for tone of voice (text input, e.g. "Friendly and warm" / "Professional and authoritative") and personality traits (multi-select chips like "Witty", "Warm", "Bold", "Sophisticated", "Approachable", "Energetic")
- Brand Centre: add editable sections for both new fields
- Edge function: include `tone_of_voice` and `personality_traits` in the brand context prompt sent to the AI

### 2. Conversational Edit Flow (Partial Regeneration)

Currently every user message triggers a full new design generation (1 credit). The PRD requires an edit flow where minor changes (headline tweak, colour adjustment, tone shift) do not trigger a full regeneration.

**Changes:**
- Edge function: add an `"edit"` action alongside `"generate"` and `"chat"`
- The orchestrator logic uses the LLM to classify the user's intent (new design vs edit)
- For edits, the previous design's prompt and image are passed back to the image model with modification instructions — this still calls the renderer but preserves the core layout
- Frontend: track the current `designPrompt` in session state and send it with edit requests
- Minor text-only edits (handled by chat action) remain free; layout/visual edits cost 1 credit

### 3. Credit Counter Display

The PRD mentions a "clear credit meter" as risk mitigation. Users currently have no visibility into how many generations they have left.

**Changes:**
- Home dashboard header: show "X / 10 generations used" badge
- Design Studio header: show remaining credits
- Fetch from `profiles.generations_count` and `profiles.generations_reset_at`

---

## Technical Details

**Database migration:**
```sql
ALTER TABLE brands ADD COLUMN tone_of_voice text;
ALTER TABLE brands ADD COLUMN personality_traits text[] DEFAULT '{}';
```

**Files to modify:**
- `supabase/functions/design-studio/index.ts` — add edit action, include tone_of_voice and personality_traits in brand context
- `src/pages/Onboarding.tsx` — add 2 new steps (tone of voice + personality traits), adjust step count from 8 to 10
- `src/pages/BrandCentre.tsx` — add editable sections for tone_of_voice and personality_traits
- `src/pages/DesignStudio.tsx` — send tone_of_voice and personality_traits with brand payload, add edit flow logic, show credit counter
- `src/pages/Index.tsx` — show credit counter in header

**No new files needed.** All changes extend existing components and the existing edge function.

