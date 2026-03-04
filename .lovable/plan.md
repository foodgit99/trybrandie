

## Plan: Target Audience Intelligence Module

This feature transforms Brandie from "brand-aware" to "conversion-aware" by adding a JTBD (Jobs-to-be-Done) audience profiling system that feeds into the AI design pipeline.

### What Gets Built

1. **Database**: New `target_audiences` table storing raw user answers and AI-generated JTBD profiles per brand
2. **Edge Function**: New `audience-intelligence` function that converts raw answers into a structured JTBD model using AI
3. **Brand Centre UI**: New collapsible "Target Audience Intelligence" section with a guided questionnaire and profile summary view
4. **Design Pipeline Integration**: Update `design-studio` edge function to fetch and inject JTBD data into Copywriter and Renderer prompts
5. **Design Studio Frontend**: Pass audience data alongside brand data when invoking the edge function

---

### Technical Details

#### A. Database Migration

Create `target_audiences` table:

```sql
CREATE TABLE public.target_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Primary Audience',
  raw_inputs jsonb NOT NULL DEFAULT '{}',
  jtbd_profile jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.target_audiences ENABLE ROW LEVEL SECURITY;

-- RLS: users can CRUD their own audience profiles via brand ownership
CREATE POLICY "Users can view their audiences"
  ON public.target_audiences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can insert their audiences"
  ON public.target_audiences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can update their audiences"
  ON public.target_audiences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE POLICY "Users can delete their audiences"
  ON public.target_audiences FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM brands WHERE brands.id = target_audiences.brand_id AND brands.user_id = auth.uid()));

CREATE TRIGGER update_target_audiences_updated_at
  BEFORE UPDATE ON public.target_audiences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### B. New Edge Function: `audience-intelligence`

**File:** `supabase/functions/audience-intelligence/index.ts`

- Accepts `raw_inputs` (the 5-section questionnaire answers) and `brand` context
- Calls `google/gemini-3-flash-preview` with tool calling to extract structured JTBD output:
  - `persona_summary`, `core_job_statement`, `struggling_moments`, `push_forces`, `pull_forces`, `anxiety_forces`, `habit_forces`, `functional_outcomes[]`, `emotional_outcomes[]`, `social_outcomes[]`, `buying_triggers[]`, `hesitation_factors[]`, `messaging_angles[]`, `language_patterns[]`, `conversion_levers_ranked[]`
- Returns the structured profile; frontend saves it to `target_audiences.jtbd_profile`

#### C. Brand Centre UI Update

**File:** `src/pages/BrandCentre.tsx`

Add a new collapsible card after the Inspiration section titled "Target Audience Intelligence":

- **Status indicator**: "Not configured" / "Profile active"
- **Collapsed view**: Shows `persona_summary` and `core_job_statement` if configured
- **Expanded/Edit view**: A stepped form with 5 sections (simple textarea questions, not JTBD jargon):
  1. Who Are They? (who buys, life stage, what they improve)
  2. Their Struggle (frustrations, what's not working, what they've tried)
  3. Motivation (success looks like, consequences of inaction)
  4. Buying Context (when they decide, what makes them hesitate)
  5. Emotional Drivers (multi-select: Status, Security, Growth, Belonging, Freedom, Simplicity, Recognition)
- **"Generate Profile" button** calls `audience-intelligence` edge function
- **"Regenerate" button** re-processes existing raw inputs
- Full JTBD profile displayed in a clean, readable card layout after generation

#### D. Design Pipeline Integration

**File:** `supabase/functions/design-studio/index.ts`

- At the start of `generate`/`edit` actions, fetch `target_audiences` for the brand (use the first/active one)
- Inject JTBD context into `brandContext` prompt for the Brief Agent:
  ```
  AUDIENCE INTELLIGENCE (use to sharpen copy and visual strategy):
  - Target persona: {persona_summary}
  - Core job: {core_job_statement}
  - Key struggles: {struggling_moments}
  - Emotional drivers: {top emotional outcomes}
  - Buying triggers: {buying_triggers}
  - Hesitation factors: {hesitation_factors}
  - Top messaging angles: {messaging_angles}
  - Conversion levers: {conversion_levers_ranked}

  CONVERSION RULES:
  1. Select top 1-2 emotional drivers and weave them into the headline/copy
  2. Reference a struggling moment the audience relates to
  3. Amplify the desired outcome
  4. Neutralise the top anxiety/hesitation factor
  5. Visual strategy should match emotional driver (Status→bold/luxury, Security→calm/soft, Growth→energetic)
  ```
- This data is injected ONLY when a JTBD profile exists; otherwise the pipeline works exactly as before

#### E. Design Studio Frontend

**File:** `src/pages/DesignStudio.tsx`

- Fetch `target_audiences` for the current brand using a `useQuery` hook
- Pass the first audience's `jtbd_profile` in the `brand` payload sent to the edge function (as `brand.audience_profile`)

### What Does NOT Change

- No changes to existing tables, RLS policies, or auth
- The design pipeline falls back gracefully when no audience profile exists
- Onboarding flow is untouched (audience is an advanced/optional feature)
- Credit system, intent classification, and feedback engine remain unchanged

