

# System Audit — Current State (Post-Fixes)

## WORKING PROPERLY (15 items)

1. **Core Generation Pipeline** — Full 10-stage pipeline executes correctly: Context Assembly → Brief Agent → Genome Composer → Copywriter + Caption → Genome Scoring → Stability Gate → Image Renderer → Auto-Save.
2. **Brief Agent (Structured Tool Calling)** — `set_brief` tool outputs structured JSON with graceful fallback to content parsing. Working.
3. **Parallel Execution** — Brief + Genome + Inspiration Analysis in parallel (line 1063). Copywriter + Caption in parallel (line 1707). Working.
4. **Genome Composer** — Full deterministic pipeline: preset → inspiration override → trend override → mutation → brand lock. Working.
5. **Genome Scoring + Stability Gate** — Five-dimension scoring with deterministic repair below 55 and post-repair re-scoring. Working.
6. **Credit Gate + Intent Classifier** — MINOR/MAJOR classification, tier limits, monthly reset, bonus credits, HD cost (2 credits). Working.
7. **Special Instructions Injection** — Injected into Brief Agent (line 1077 via brandContext), Copywriter (line 1572), Caption (line 1645), Image Renderer (line 1773). All four agents covered. Working.
8. **Chat Action (Brand-Aware)** — Injects brand context, audience intelligence, and trend data into chat system prompt. Uses `brand.id` for DB queries (line 226). Working.
9. **RAG Preference Engine** — Genome preference weighting from past designs (upvoted=3x, neutral=1x, downvoted=0x). Working.
10. **Canvas Format Handling** — Three sizes (square/landscape/portrait) with format-specific instructions. Working.
11. **Product Image Injection** — Loads from `brand_products` table using `brand.id` (line 940-956). Keyword-based relevance gating. Working.
12. **Inspiration Images Pipeline** — Loads from `brand_inspiration` table using `brand.id` (line 921-934). Inspiration style analysis runs in parallel. Tags override genome preset selection. Images injected into renderer (line 1780-1782). Working.
13. **Retry Helper** — Exponential backoff for server errors. Rate limit/payment errors not retried. Working.
14. **Edit Pattern Tracking** — Classifies edit type via keyword matching (line 787-795), appends to `cachedPrefs.edit_patterns` (reusing hoisted variable, line 799), saves to cache preserving last 50. Working.
15. **Cache Wipe Fix** — `edit_patterns` preserved during chat RAG cache upsert via `existingEditPatterns` (line 580-584). Working.

## WORKING PROPERLY BUT WITH COLD START (2 items)

16. **Copy Pattern Learning** — Code is correct (line 427-446). Requires 2+ upvoted designs with `copy_structure` data. Since `copy_structure` was added recently and is now saved on both creates and edits, this will activate over time. No code bug — just needs data accumulation.

17. **Edit Pattern Bias** — Code is correct (line 634-665). Requires 3+ patterns of the same type. Since the cache wipe bug is fixed, patterns now accumulate properly. Will activate naturally as users make edits.

## WORKING PARTIALLY (3 items)

### 1. Trend Affinity Learning — Low Activation Rate
**Location**: Line 448-458
The RAG query fetches only 8 designs ordered by `vote DESC, created_at DESC` (line 376-378). Trend affinity requires 2+ upvoted designs with the same `trend_used` in those 8 results. For users with many designs, relevant trend data may fall outside the top 8.

**Impact**: Medium — feature works but activates rarely. Increasing the limit to 15-20 would improve activation without significant performance cost.

### 2. `brand.image_style_preferences` — Dead Reference
**Location**: Line 974
The brand context includes `brand.image_style_preferences` but the `brands` table has no such column. This line always evaluates to falsy and the conditional never renders.

**Impact**: Low — no errors, just dead code. Either the column should be added or the line removed.

### 3. `copy_structure` Saving on Edits — Indentation Bug Risk
**Location**: `DesignGenerationContext.tsx` line 180-182
The edit update block has inconsistent indentation:
```
              ...(selected_trend && selected_trend !== "none" && { trend_used: selected_trend, trend_intensity: params.trend_intensity }),
            ...(data.genome && { genome: data.genome }),
              ...(data.caption && { caption: data.caption }),
```
Line 180 (`data.genome`) has less indentation than surrounding lines. While this doesn't cause a runtime bug (JavaScript ignores whitespace), it makes the code harder to maintain and could mask issues during future edits.

**Impact**: Low — cosmetic only, no runtime effect.

## NOT WORKING AT ALL (0 items)

All previously identified critical bugs have been fixed:
- `brand.id` is now in the payload (line 383)
- `special_instructions` is now in the payload (line 396)
- `edit_patterns` preserved during cache upsert (line 580-584)
- `copy_structure` saved on edits (line 182)
- Edit pattern DB read deduplicated (line 799 uses `cachedPrefs`)

## Summary

| Category | Count |
|---|---|
| Working Properly | 15 |
| Working (cold start) | 2 |
| Working Partially | 3 |
| Not Working | 0 |

## Recommended Improvements (Optional)

| Priority | Fix | Impact |
|---|---|---|
| P2 | Increase RAG design query limit from 8 to 15-20 (line 378) | Better trend affinity + preference learning activation |
| P3 | Remove dead `image_style_preferences` reference (line 974) | Code cleanliness |
| P3 | Fix indentation in `DesignGenerationContext.tsx` edit block | Code readability |

The system is in good shape. All critical and medium-priority bugs from previous audits have been resolved. The remaining items are minor optimizations.

