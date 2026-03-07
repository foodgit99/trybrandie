

## Plan: Activate Design Genome System, Genome Mutation, Genome Scoring, and RAG Personalisation Engine

### Current State

The **Genome Composer**, **Mutation Engine**, and **Scoring Engine** are already fully implemented in the edge function but their outputs are only partially used:
- Genome is stored on saved designs (`genome` JSONB column) — good
- Genome scores are displayed in the UI — good
- Votes are saved on designs — good
- **However**: none of this historical data feeds back into future generations. The pipeline generates every design from scratch with no memory of what the user liked.

### What We Will Build

#### 1. RAG Personalisation Engine (Edge Function)

Before invoking the Genome Composer, query the user's **top-rated past designs** (upvoted or most recent with genomes) and inject their genome patterns as "preference signals" into the Genome Composer prompt.

**In `design-studio/index.ts`:**
- After fetching audience context (~line 77), add a new block: query `designs` table for user's designs ordered by `vote DESC, created_at DESC`, limit 5, where `genome IS NOT NULL`
- Extract common patterns: most frequent emotion, dominant layout preferences, preferred texture types, etc.
- Build a `preferenceContext` string summarising the user's style DNA
- Inject this into the Genome Composer system prompt so it biases toward proven preferences while the Mutation Engine still introduces variety

#### 2. Design Stability Score — Pre-Render Quality Gate

After the Genome Scoring Engine runs (~line 794), add a quality gate:
- If `genomeScores.overall < 55`, trigger a **refinement pass** — re-invoke the Genome Composer with the low-scoring genome and explicit instructions to improve the weakest dimension
- Cap at 1 retry to avoid cost explosion
- Log when refinement triggers

#### 3. Smarter Genome Mutation Engine

The mutation engine already works but is fully random. Enhance it:
- Use RAG preference data to **bias mutations toward previously upvoted gene values** rather than pure random selection
- If the user has upvoted 3+ designs with `emotion: "energetic"`, mutations on the emotion gene should favour that value
- Keep the 15% / 7.5% rates unchanged

#### 4. Frontend — Show Design Stability Badge

In `DesignStudio.tsx`, when `genome_scores` are returned:
- Show a small coloured badge next to the score button: green (75+), amber (55-74), red (<55)
- If a refinement pass occurred, show "Refined" label

### Technical Details

**Edge function changes** (`supabase/functions/design-studio/index.ts`):
- ~30 lines for RAG preference retrieval
- ~15 lines for stability gate logic
- ~10 lines to pass preference weights into mutation engine
- Return `refined: true` in response if refinement triggered

**Frontend changes** (`src/pages/DesignStudio.tsx`):
- ~10 lines for stability badge rendering

**No database changes required** — all data already exists in the `designs` table with `genome`, `vote`, and `user_id` columns.

### Flow Summary

```text
User Prompt
  ↓
Context Assembly (Brand + Audience + Trend)
  ↓
[NEW] RAG: Query top-rated past genomes → build preference signals
  ↓
Genome Composer (now receives preference signals)
  ↓
Genome Mutation (now biased by preferences, not pure random)
  ↓
Genome Scoring
  ↓
[NEW] Stability Gate: if score < 55 → refine genome → re-score
  ↓
Copywriter Agent
  ↓
Image Renderer
  ↓
Output + Scores + Stability Badge
```

