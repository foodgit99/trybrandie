

# Multi-Agent Developer Guide — Brandie Audit & Operationalisation Plan

## Executive Assessment

The document is a solid, opinionated guide to building multi-agent AI products. Brandie's architecture already follows many of its core principles — but there are meaningful gaps, and a few areas where I respectfully disagree with the guide's recommendations for Brandie's specific context.

---

## Where Brandie Already Adheres

### 1. Orchestrator / Subagent Pattern (Section 2.1, Pattern 1)
Brandie's `design-studio` edge function acts as a de facto orchestrator. It classifies intent (`chat`, `generate`, `edit`), assembles context (brand, audience, trend, session memory), invokes Copywriter and Creative Director sequentially, then triggers rendering. This maps cleanly to the Orchestrator/Subagent pattern described in the guide.

### 2. Agent Granularity — Single Responsibility (Section 2.2)
Brandie already separates concerns across distinct edge functions:
- `audience-intelligence` — JTBD profile generation
- `brand-strategist` — conversational brand advisor
- `brand-engine` — content strategy (pillars, series, campaigns)
- `design-studio` — design generation/editing
- `brand-scraper` — website import
- `logo-designer` — logo generation
- `trend-scout` / `trend-recommend` — trend intelligence

Each function does one thing. This aligns with the guide's "split at domain boundaries" principle.

### 3. Structured Outputs (Section 3.2 / 11.2)
All AI calls use tool/function calling with explicit JSON schemas (Pydantic-equivalent). The Copywriter outputs `{ headline, subheadline, cta, ... }`, the Creative Director outputs a Visual Style Genome. This matches the guide's strong recommendation for typed inputs/outputs.

### 4. RAG-Based Personalisation / DPLI (Section 4.3)
Brandie has a functioning personalisation loop:
- Past design genomes are tallied by vote weight (upvote=3x, neutral=1x, downvote=0)
- Chat preference tags are extracted via LLM and cached (`chat_preference_cache`)
- Edit patterns are tracked and fed back as bias context
- Copy density preferences are learned from upvoted designs

This is exactly the "capture implicitly, don't ask users to fill preference forms" principle from Section 4.3.

### 5. Retry with Exponential Backoff (Section 3.3 / 5.3)
The `retryFetch` helper in `design-studio` implements exponential backoff for transient 5xx errors, skipping retries on 429/402. This matches the resilient invocation pattern in Figure 3.2.

### 6. Rate Limiting and Cost Controls (Section 9.1)
Credit-based system with per-run deduction, free tier limits, and graceful 402 responses. The guide recommends per-user budgets and per-run cost caps — Brandie implements this through its credit model.

### 7. Deterministic Router over LLM Orchestrator (Section 3.1)
The `design-studio` function uses deterministic `if (action === "generate")` / `if (action === "edit")` branching rather than an LLM orchestrator. The guide explicitly recommends this for "known, well-defined workflow categories" — which is exactly Brandie's situation.

---

## Where Brandie Falls Short

### Gap 1: No Output Validation / Schema Enforcement
**Guide reference**: Section 3.3 ("Validate all agent outputs against typed schemas"), Section 11.3 ("Silent failure propagation").

**Current state**: After the Copywriter and Creative Director LLM calls, Brandie parses the JSON but does no schema validation. If the model returns malformed copy (missing `headline`) or an invalid genome (wrong enum value for `emotion`), it propagates silently downstream.

**Risk**: The renderer receives garbage, produces a broken design, and the user sees a low-quality result with no explanation.

### Gap 2: No Timeout Pyramid
**Guide reference**: Section 9.1 ("Set timeouts at every level").

**Current state**: Edge functions have Deno's default timeout but no per-agent or per-tool-call timeout. The Copywriter call, Creative Director call, and render call all run without explicit deadlines. If the AI gateway hangs, the entire request hangs.

### Gap 3: No Circuit Breaker on External Dependencies
**Guide reference**: Section 5.3 ("Circuit Breaker Pattern").

**Current state**: If the Lovable AI gateway, Firecrawl, or Nano Banana renderer starts failing repeatedly, Brandie will keep hitting it on every request. There is no circuit breaker to short-circuit after N failures and return a cached/fallback result.

### Gap 4: No Observability / Tracing
**Guide reference**: Section 7.1–7.4 ("Build observability from day one").

**Current state**: Brandie uses `console.log` for debugging. There are no structured traces, no span IDs linking Copywriter → Creative Director → Renderer, no cost-per-run tracking, no latency metrics. Debugging a bad design output requires reading raw logs with no correlation.

### Gap 5: No Evaluator / Quality Gate
**Guide reference**: Section 2.1 Pattern 3 ("Evaluator/Optimiser Loop"), Section 10.3.

**Current state**: The genome scoring system (`computeGenomeScores`) runs *after* generation and stores scores, but never gates output. A design with a brand_alignment score of 20/100 is still shown to the user. The guide recommends a quality gate that triggers automatic correction if below threshold.

### Gap 6: No Input Sanitisation for Agent Context
**Guide reference**: Section 6.2 ("Prompt Injection: Defence in Depth").

**Current state**: User prompts, brand descriptions, and scraped website content are injected directly into LLM system/user messages without any sanitisation. The `brand-scraper` passes raw Firecrawl markdown into the AI context. A malicious website could embed prompt injection in its content.

### Gap 7: No Agent Capability Manifest
**Guide reference**: Section 6.3 ("Agent Authorisation Model").

**Current state**: All edge functions use the same service role key with full database access. There is no explicit capability manifest limiting which tables/tools each agent can read/write.

### Gap 8: No Memory Namespace Isolation Enforcement
**Guide reference**: Section 4.3 ("Respect boundaries. Never inject private user memories into shared contexts").

**Current state**: Isolation is enforced at the query level (`.eq("user_id", user.id)`) but not at the storage layer via RLS for all memory-related tables. If a bug omits the user_id filter, cross-user data bleed is possible.

### Gap 9: No Context Compression
**Guide reference**: Section 4.2 ("Working Memory Management").

**Current state**: The design-studio chat passes the full message history to the LLM. There is no compression or summarisation when the conversation grows long. The chat preference extraction partially addresses this, but the raw message history still grows unbounded.

---

## Where I Disagree with the Guide

### Disagreement 1: "Migrate to custom orchestration within 6–12 months" (Section 10.2)
The guide recommends starting with CrewAI/LangGraph and migrating to custom. Brandie already *is* custom — edge functions with direct LLM calls. This is the right choice for Brandie. The overhead of introducing a Python-based orchestration framework (LangGraph, CrewAI) into a Deno/TypeScript edge function architecture would be significant with minimal benefit. Brandie's workflow categories are well-defined; deterministic routing is correct.

### Disagreement 2: Separate vector DB for memory (Section 10.1)
The guide suggests pgvector for <1M vectors. Brandie currently uses structured JSON storage for preferences (chat_preference_cache, genome tallies) rather than vector embeddings. For Brandie's current scale and use case, this is *more appropriate* than vector search. The preference data is categorical (e.g., "user prefers bold headlines"), not semantic. Introducing a vector DB would add complexity without improving retrieval quality. When Brandie reaches the point where it stores thousands of nuanced, free-text preference memories, then pgvector becomes relevant.

### Disagreement 3: Evaluation Sets in CI/CD (Section 8 Layer 4)
The guide recommends 50–200 golden test cases run in CI/CD. For Brandie — a creative tool where "correct" is subjective and varies by brand — maintaining a golden eval set is extremely expensive and prone to false negatives. A better investment for Brandie is the genome scoring system (which already exists) combined with user feedback signals (which already exist). I would invest in *automated quality floor checks* (e.g., "does the genome contain valid enum values?") rather than subjective eval sets.

### Disagreement 4: Swarm Pattern recommendation (Section 2.1 Pattern 4)
The guide presents the Swarm pattern as viable for "massively parallel exploration." Brandie's pipeline is inherently sequential (copy → visual direction → render). There is nothing to parallelise in a swarm. The guide's own caveat — "state conflicts when multiple agents write to the same memory slot" — is a significant risk for a design system where all agents must agree on a single output. The Pipeline + Orchestrator hybrid Brandie uses is correct.

### Agreement Note
I agree with everything else in the guide — particularly the emphasis on DPLI as a moat (Brandie is already building this), the "God Agent" anti-pattern warning (Brandie avoids this), and the async-first architecture recommendation (Brandie should move toward this for long renders).

---

## Operationalisation Plan

### Phase 1 — Safety & Reliability (Immediate Priority)

**1. Add output schema validation for all agent calls**
After each LLM call (Copywriter, Creative Director, Genome), validate the parsed JSON against the expected TypeScript types. If validation fails, retry once with a "your output was malformed, here is the schema" correction prompt. If the retry fails, return a structured error to the user rather than a broken design.

**2. Add input sanitisation**
Create a shared `sanitise.ts` utility in `supabase/functions/_shared/` that strips HTML/markdown injection patterns from user-provided content before it enters agent context. Apply to: user prompts in design-studio, brand descriptions, scraped website content in brand-scraper, and any other external text.

**3. Add timeout guards**
Wrap each LLM call and external API call (Firecrawl, renderer) in a `Promise.race` with explicit timeouts: 30s for individual AI calls, 60s for the full design pipeline.

### Phase 2 — Observability (Next Sprint)

**4. Implement structured tracing**
Create a `Trace` utility that generates a `run_id` per request and logs structured spans for each stage (context assembly, copywriter, creative director, genome scoring, render). Store traces in a `design_traces` table with: run_id, user_id, agent_name, input_tokens, output_tokens, latency_ms, error, cost_estimate. This enables debugging bad designs by replaying the exact context each agent received.

**5. Add key metrics logging**
Track per the guide's Table 7.1: end-to-end latency, agent failure rate, token cost per run, context utilisation %, tool call success rate. Store as aggregate metrics in a `system_metrics` table for admin dashboard visibility.

### Phase 3 — Quality Gates (Following Sprint)

**6. Activate genome score gating**
The scoring system exists but is passive. Add a quality floor: if `overall` score < 45, automatically run a refinement pass — send the genome back to the Creative Director with the specific low-scoring dimensions flagged, requesting targeted improvements. Cap at 1 refinement pass to avoid unbounded loops.

**7. Add brand consistency enforcement**
Before rendering, verify: (a) colours in the genome match the brand palette, (b) font personality aligns with brand fonts, (c) emotion aligns with brand vibe. If deviation exceeds threshold, auto-correct the genome's locked genes per the VSGS lock rules that already exist in `genomeTypes.ts`.

### Phase 4 — Resilience (Month 2)

**8. Implement circuit breaker for AI gateway**
Track consecutive failures per external dependency. After 3 failures in 60 seconds, stop calling that service and return a user-friendly error ("Our design engine is temporarily busy, please try again in a moment") instead of repeatedly timing out.

**9. Add model fallback chain**
If the primary model (`gemini-2.5-pro`) fails or is rate-limited, fall back to `gemini-2.5-flash`. If that fails, fall back to `gpt-5-mini`. Define this chain in a shared config.

**10. Context compression for long conversations**
When the design-studio chat history exceeds 15 messages, summarise older messages into a `[Session Summary]` block and keep only the last 8 messages in full. Use `gemini-2.5-flash-lite` for fast summarisation.

---

## Files Affected

| Change | Files |
|--------|-------|
| Output validation | `supabase/functions/design-studio/index.ts` |
| Input sanitisation | New: `supabase/functions/_shared/sanitise.ts`, Modified: `design-studio`, `brand-scraper`, `brand-strategist` |
| Timeout guards | `design-studio/index.ts`, `brand-scraper/index.ts` |
| Tracing system | New: `supabase/functions/_shared/tracer.ts`, migration for `design_traces` table |
| Genome quality gate | `design-studio/index.ts` |
| Circuit breaker | New: `supabase/functions/_shared/circuit-breaker.ts` |
| Model fallback | New: `supabase/functions/_shared/model-fallback.ts` |
| Context compression | `design-studio/index.ts` |

## Priority Order
1. Input sanitisation + output validation (security + reliability)
2. Timeout guards (reliability)
3. Structured tracing (debuggability)
4. Genome quality gate (output quality)
5. Circuit breaker + model fallback (resilience)
6. Context compression (scalability)

