

## Plan: Add Chat Messages to RAG Personalisation Engine

### Current State

The RAG engine currently has **one data source**: past design genomes weighted by vote scores. It extracts gene preferences (e.g., "user prefers warm palettes, bold typography") from the `designs` table.

Chat messages are stored in `design_messages` but are **never queried** by the RAG engine. This means valuable user intent signals — style preferences, feedback, correction patterns, tone directions — expressed in conversation are lost between sessions.

### What Gets Built

**1. Chat Preference Extraction** (inside `design-studio/index.ts`)

Add a new RAG step that queries the user's recent chat messages to extract recurring style/preference signals. This runs alongside the existing genome-based RAG.

- Query the user's last ~30 messages (role = "user") from `design_messages`, ordered by recency
- Concatenate them into a compact summary string
- Inject into the Brief Agent and Copywriter prompts as a "CONVERSATION HISTORY INSIGHTS" context block

**2. Lightweight Preference Summarisation**

Rather than passing raw chat messages (too noisy, too many tokens), use a compact extraction approach:

- Filter only **user** messages (not assistant responses)
- Take the most recent 30 messages across all designs for that user
- Trim each to first 120 characters to capture intent without bloating the prompt
- Inject as: `"Recent user requests and preferences (use to understand their style and content patterns): [messages]"`

This is cheap (no extra LLM call) and gives the agents a sense of what the user typically asks for — recurring themes, preferred tones, common topics.

**3. Structured Preference Signals (Enhancement)**

For higher-quality extraction, add an optional step where the Brief Agent's system prompt is updated to note:

> "The user's recent chat history is provided below. Look for recurring patterns: preferred visual styles, common topics/industries, tone preferences, and content types they request most. Use these patterns to inform your brief — but always prioritise the current prompt."

### Integration Points

The chat context is injected at **LOW priority** — below brand data and audience intelligence, at the same level as genome RAG preferences. It informs but never overrides the current prompt.

```text
Priority Stack:
1. Current user prompt (HIGHEST)
2. Brand Centre data
3. User attached image
4. Audience JTBD
5. Trend Lab
6. Genome RAG preferences  ← existing
7. Chat history patterns   ← NEW
```

### File Changes

| File | Change |
|---|---|
| `supabase/functions/design-studio/index.ts` | Add chat message RAG query after genome RAG; inject condensed chat context into Brief Agent and Copywriter prompts |

### What Does NOT Change

- No new database tables or migrations needed — `design_messages` already exists with the right schema
- No UI changes — this is an invisible intelligence layer
- No additional API/LLM calls — raw messages are condensed and injected as prompt context
- Existing genome-based RAG remains unchanged

