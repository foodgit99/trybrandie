

# System Audit: Brandie AI Pipeline

## WORKING PROPERLY

### 1. Core Generation Pipeline
The 10-stage pipeline (Context Assembly → Brief Agent → Genome → Copywriter → Caption → Scoring → Renderer → Auto-Save) is fully implemented and structurally sound. All agents use structured tool calling with proper fallbacks.

### 2. Brief Agent (Structured Tool Calling)
Outputs `creative_direction`, `composition_goal`, `emotional_tone`, `design_focus`, `explanation` via the `set_brief` tool. Fallback to content parsing if tool call fails. This is working correctly.

### 3. Parallel Execution
Brief Agent + Genome Composer run in parallel via `Promise.all` (line 1489). Copywriter + Caption also run in parallel (line 1699). Inspiration style analysis runs in parallel with brief. Latency optimization is properly implemented.

### 4. Genome Composer (Deterministic)
Full pipeline: base preset selection → inspiration tag override → trend overrides (intensity-blended) → mutation engine (15% rate, preference-biased) → brand lock enforcement. All working as designed.

### 5. Genome Scoring + Stability Gate
Five-dimension scoring (brand_alignment, trend_balance, visual_clarity, conversion, visual_balance) with deterministic repair when overall < 55. Post-repair re-scoring is correctly implemented (line 1743).

### 6. Credit Gate + Intent Classifier
MINOR/MAJOR edit classification via `gemini-2.5-flash-lite`. Free edits skip credit deduction. Tier-based limits (free/entrepreneur/creator/agency) with monthly reset. Low-credit warning emails. All working.

### 7. Special Instructions Injection
Injected into all four agents: Brief Agent (line 977), Copywriter (line 1564), Caption (line 1637), Image Renderer (line 1765). Full pipeline coverage confirmed.

### 8. Chat Action (Brand-Aware)
Chat mode injects brand context, audience intelligence, and trend data into the system prompt. Working correctly.

### 9. RAG Preference Engine
Genome preference weighting from past designs (upvoted=3x, neutral=1x, downvoted=0x). Top gene values surfaced as preference context. Working correctly.

### 10. Canvas Format Handling
Three sizes (square, landscape, portrait) with format-specific instructions for brief, copywriter, and renderer. Dimension logging from PNG headers. Working.

### 11. Product Image Injection
Keyword-based relevance detection, injected only when contextually appropriate. User-attached images take priority. Working.

### 12. Retry Helper
Exponential backoff for server errors (500/502/503/504). Rate limit (429) and payment (402) errors not retried. Working.

---

## WORKING PARTIALLY (Bugs / Gaps)

### 1. `copy_structure` Not Saved on Edits
**Bug**: `copy_structure` is saved when creating a new design (line 205 in `DesignGenerationContext.tsx`) but NOT when editing an existing design (line 174-182). The edit update block is missing `copy_structure`.

**Impact**: Copy density learning from the RAG engine only learns from first-generation designs, not iterative edits. If a user edits a design and the copy changes, the new structure is lost.

### 2. Duplicated Line in Copywriter Prompt
**Bug**: Line 1546 duplicates line 1545: `- User's original request: "${userPrompt}"` appears twice in the copywriter system prompt.

**Impact**: Minor — wastes tokens but doesn't break functionality.

### 3. Edit Pattern Tracking — Double DB Read
The edit pattern bias reads `edit_patterns` from cache at line 634 (for generation bias), and the edit pattern tracker reads it again at line 799 (to append new patterns). These are two separate queries for the same row in the same request. The first read (line 480) already fetches `edit_patterns` as part of the chat cache query, but the edit tracker doesn't reuse it.

**Impact**: Minor — one unnecessary DB query per edit action.

### 4. Chat History RAG Cache — Missing `edit_patterns` Preservation
When the chat RAG cache is refreshed (line 576-583), the upsert only includes `user_id`, `tags`, `message_count`, `updated_at`. It does NOT include `edit_patterns`. Since the upsert is on `user_id` conflict, this will overwrite the row and set `edit_patterns` to its default value (`[]`), erasing all learned edit patterns.

**Impact**: HIGH — edit patterns are silently wiped every time the chat cache refreshes (whenever message count changes and >= 5 messages). This is a data loss bug.

### 5. Inspiration Images Not Passed from Frontend
The edge function reads `brand.inspiration_examples` (line 926), but looking at the brand object passed from the frontend, the `useBrand` hook fetches from the `brands` table which has no `inspiration_examples` column. Inspiration images are in the `brand_inspiration` table. They're never loaded into the brand object passed to the edge function.

**Impact**: HIGH — inspiration images uploaded in Brand Centre are never used in design generation. The inspiration style analysis and genome override logic (lines 1017-1199) never fire.

### 6. Genome Data Not Saved on Edits with `copy_structure`
Similar to issue #1 — on edits (line 174-182), `genome` and `caption` are saved but `copy_structure` is missing.

---

## NOT WORKING AT ALL

### 1. Copy Pattern Learning (Dead Code in Practice)
The copy pattern learning (line 427-458) queries `copy_structure` from past designs. But since `copy_structure` is only saved on new designs (not edits — see bug #1), AND the feature was only added recently, most existing designs have NULL `copy_structure`. The feature requires at least 2 upvoted designs with `copy_structure` data to activate. For existing users, this will never trigger until they generate and upvote multiple new designs.

**Status**: Code is correct but effectively dead for existing users.

### 2. Trend Affinity Learning (Dead Code in Practice)
The trend affinity learning (line 448-458) looks for upvoted designs with `trend_used`. But the query at line 371 only fetches 8 designs ordered by `vote DESC, created_at DESC`. If a user has many designs, trending ones may not be in the top 8. Also, the threshold is `>= 2` upvoted designs with the same trend — a fairly high bar.

**Status**: Works in theory but very rarely triggers.

### 3. Edit Pattern Learning (Broken by Cache Wipe — Bug #4)
As described in Partial #4, edit patterns are wiped every time the chat cache refreshes. This means the edit bias context (line 630-665) will almost never accumulate enough patterns (needs 3+ of the same type) to trigger because the data keeps getting reset.

**Status**: Functionally broken due to the cache wipe bug.

---

## Recommended Fixes (Priority Order)

### P0 — Critical Bugs

1. **Fix cache wipe bug**: When upserting chat preference cache (line 576-583), preserve existing `edit_patterns` by reading them first or including them in the upsert.

2. **Fix inspiration images**: Load `brand_inspiration` URLs in the frontend's `useBrand` hook (or in the edge function itself) and pass them as `brand.inspiration_examples`.

### P1 — Medium Bugs

3. **Save `copy_structure` on edits**: Add `...(data.copy_structure && { copy_structure: data.copy_structure })` to the edit update block (line 174-182 in `DesignGenerationContext.tsx`).

4. **Remove duplicated line**: Delete the duplicate `- User's original request` line (1546) in the copywriter prompt.

### P2 — Minor Optimizations

5. **Deduplicate edit_patterns DB read**: Reuse the cached `edit_patterns` from the chat RAG query instead of querying again in the edit tracker.

---

## Files That Need Changes

| File | Fix |
|---|---|
| `supabase/functions/design-studio/index.ts` | Fix cache wipe (#1), load inspiration images (#2), remove duplicate line (#4), deduplicate DB read (#5) |
| `src/contexts/DesignGenerationContext.tsx` | Save `copy_structure` on edits (#3) |
| `src/hooks/useBrand.tsx` | Load inspiration image URLs into brand object (#2) |

