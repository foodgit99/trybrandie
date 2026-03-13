

# System Audit — Current State

## WORKING PROPERLY (13 items)

1. **Core Generation Pipeline** — All 10 stages execute correctly when data reaches them.
2. **Brief Agent (Structured Tool Calling)** — `set_brief` tool outputs structured JSON with fallback parsing. Working.
3. **Parallel Execution** — Brief + Genome in parallel, Copywriter + Caption in parallel. Working.
4. **Genome Composer** — Deterministic pipeline: preset → inspiration override → trend override → mutation → brand lock. Working.
5. **Genome Scoring + Stability Gate** — Five-dimension scoring with deterministic repair below 55. Working.
6. **Credit Gate + Intent Classifier** — MINOR/MAJOR classification, tier limits, monthly reset, bonus credits. Working.
7. **Chat Action (Brand-Aware)** — Injects brand context, audience, trends into chat system prompt. Working.
8. **RAG Preference Engine** — Genome preference weighting from past designs. Working.
9. **Canvas Format Handling** — Three sizes with format-specific instructions. Working.
10. **Retry Helper** — Exponential backoff for server errors. Working.
11. **Cache Wipe Fix** — `edit_patterns` preserved during chat RAG cache upsert (line 580-584). Fixed.
12. **`copy_structure` Save on Edits** — Now included in edit update block (line 182). Fixed.
13. **Caption Agent** — Runs in parallel, structured tool calling with hashtags. Working.

---

## WORKING PARTIALLY (2 items)

### 1. Edit Pattern Tracking — Redundant DB Read (Minor)
**Line 799-803**: The edit pattern tracker queries `chat_preference_cache` separately instead of reusing `cachedPrefs` (already fetched at line 478-483). One unnecessary DB query per edit action.

**Impact**: Minor latency waste. Not a correctness issue.

### 2. Copy Pattern / Trend Affinity Learning — Cold Start Problem
Both features require upvoted designs with `copy_structure` data (added recently) or matching `trend_used` values. The query only fetches 8 designs. For existing users, these rarely trigger. For new users, they need 2+ upvoted designs before activation.

**Impact**: Medium — features work in theory but take many interactions to activate.

---

## NOT WORKING AT ALL (2 critical bugs)

### BUG 1: `brand.id` and `special_instructions` Missing from Frontend Payload (P0 — CRITICAL)

**Location**: `src/pages/DesignStudio.tsx` lines 381-396

The `brandPayload` sent to the edge function is missing two critical fields:
- **`id`** — The brand's UUID
- **`special_instructions`** — The user's custom directives

The edge function relies on `brand?.id` for:
- **Inspiration images** (line 927-941) — loads from `brand_inspiration` table. Without `brand.id`, this query never runs. The fix from the last audit is dead code.
- **Product images** (line 946-962) — loads from `brand_products` table. Never fires.
- **Chat mode audience/trend context** (lines 226-278) — uses `brand?.id` for audience and trend pref queries. Falls back to working via `audience_id` param for generation, but chat mode gets no brand-linked context.

The edge function reads `brand.special_instructions` for:
- Brief Agent prompt (line 992-994)
- Copywriter prompt (line 1578)
- Caption prompt (line 1651)
- Image Renderer prompt (line 1779)

Without this field in the payload, **Special Instructions are never injected into any agent**. The entire Special Instructions feature is non-functional despite the code being correct on the backend.

**Fix**: Add `id: brand.id` and `special_instructions: (brand as any).special_instructions` to the `brandPayload` object.

### BUG 2: Inspiration Images Still Non-Functional (P0 — consequence of Bug 1)

The last audit added code to load inspiration images from the `brand_inspiration` table (line 927-941). This code works correctly but never executes because `brand?.id` is undefined (Bug 1). The inspiration style analysis, genome override logic, and inspiration image injection into the renderer are all dead code paths.

**Fix**: Resolved by fixing Bug 1.

---

## Summary

| Category | Count | Details |
|---|---|---|
| Working Properly | 13 | Core pipeline, all agents, scoring, credit gate, cache fixes |
| Working Partially | 2 | Redundant DB read (minor), learning cold start |
| Not Working | 2 | Missing `brand.id` + `special_instructions` in payload → breaks inspiration, products, and special instructions |

## Recommended Fixes

### P0 — One-line fix in `src/pages/DesignStudio.tsx`

Add the missing fields to `brandPayload` (line 381-396):

```typescript
const brandPayload = brand
  ? {
      id: brand.id,                                          // ADD
      name: brand.name,
      tagline: brand.tagline,
      description: brand.description,
      vibe: brand.vibe,
      primary_colors: brand.primary_colors,
      secondary_colors: brand.secondary_colors,
      accent_colors: brand.accent_colors,
      typography_primary: brand.typography_primary,
      typography_secondary: brand.typography_secondary,
      logo_url: brand.logo_url,
      tone_of_voice: (brand as any).tone_of_voice,
      personality_traits: (brand as any).personality_traits,
      special_instructions: (brand as any).special_instructions,  // ADD
    }
  : null;
```

### P2 — Deduplicate edit_patterns DB read

In `supabase/functions/design-studio/index.ts` line 799-803, replace the separate DB query with `cachedPrefs?.edit_patterns` (already fetched at line 478-483).

