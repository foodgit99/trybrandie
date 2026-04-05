

# Complete the Multi-Agent Operationalisation Plan

## Status Summary
Phase 1 (Safety) is ~80% done. Phases 2–4 are largely unimplemented — shared utilities were created but never wired in.

## Remaining Work

### 1. Wire circuit breaker into design-studio AI calls
**File:** `supabase/functions/design-studio/index.ts`
- Before each AI gateway fetch (Copywriter, Creative Director, Renderer), check `isCircuitOpen("ai-gateway")`
- If open, return a user-friendly error immediately
- After successful calls, call `recordSuccess("ai-gateway")`
- After failures, call `recordFailure("ai-gateway")`

### 2. Wire model fallback into design-studio AI calls
**File:** `supabase/functions/design-studio/index.ts`
- Replace direct `retryFetch` calls to the AI gateway with `callWithFallback` using the appropriate chain (`MODEL_CHAINS.reasoning` for Copywriter/Creative Director, `MODEL_CHAINS.fast` for classification)
- Keep `retryFetch` for non-AI calls (renderer)

### 3. Add sanitisation to brand-strategist
**File:** `supabase/functions/brand-strategist/index.ts`
- Import `sanitise` from shared
- Sanitise user messages before injecting into the strategist prompt

### 4. Create design_traces database table
**Migration SQL:**
```sql
CREATE TABLE public.design_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  spans jsonb DEFAULT '[]',
  total_latency_ms integer,
  total_input_tokens integer DEFAULT 0,
  total_output_tokens integer DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.design_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own traces" ON public.design_traces FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_design_traces_user ON public.design_traces(user_id);
CREATE INDEX idx_design_traces_created ON public.design_traces(created_at);
```

### 5. Persist traces to database
**File:** `supabase/functions/design-studio/index.ts`
- After `tracer.log()`, insert the trace summary into `design_traces` using the admin Supabase client
- Include run_id, user_id, spans, total latency, token counts

### 6. Implement genome quality gating
**File:** `supabase/functions/design-studio/index.ts`
- After `computeGenomeScores`, check if `scores.overall < 45`
- If below threshold, send genome back to Creative Director with flagged low-scoring dimensions
- Cap at 1 refinement pass to avoid loops
- Log refinement in tracer

### 7. Add brand consistency enforcement pre-render
**File:** `supabase/functions/design-studio/index.ts`
- Before renderer call, verify genome colours align with brand palette
- Verify font personality matches brand tone mapping
- Auto-correct mismatched locked genes per VSGS rules already in genomeTypes.ts

### 8. Implement context compression for long chats
**File:** `supabase/functions/design-studio/index.ts`
- When chat history exceeds 15 messages, summarise older messages into a `[Session Summary]` block using `gemini-2.5-flash-lite`
- Keep the last 8 messages in full
- Use the fast model chain with timeout guard

## Files Affected
| File | Changes |
|------|---------|
| `supabase/functions/design-studio/index.ts` | Circuit breaker wiring, model fallback, quality gate, brand enforcement, context compression, trace persistence |
| `supabase/functions/brand-strategist/index.ts` | Input sanitisation |
| New migration | `design_traces` table |

## Implementation Order
1. Circuit breaker + model fallback wiring (reliability)
2. Brand-strategist sanitisation (security)
3. Design traces table + persistence (observability)
4. Genome quality gating (quality)
5. Brand consistency enforcement (quality)
6. Context compression (scalability)

