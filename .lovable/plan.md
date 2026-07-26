# Chat with every pipeline agent

Turn each of the six Engine stages (Research, Ideation, Strategy, Planning, Execution, Reporting) into a chattable specialist. The user opens a stage on `/engine`, the Stage Logs sheet opens, and a **Chat with agent** button (replacing "Open Content Hub") opens that agent's conversation.

## What the user gets

1. On `/engine`, tapping a pipeline stage opens the Stage Logs sheet as today (telemetry unchanged).
2. The footer button becomes **Chat with [Agent name]** — e.g. "Chat with the Planning agent". The existing surface link ("Open Content Hub", "Open Report") moves into the chat's quick-actions so nothing is lost.
3. Tapping it flips the sheet into a chat view: thread list at the top (with **New thread**), transcript below, composer pinned at the bottom, and a Back arrow to return to logs.
4. Each agent speaks as a senior specialist in its own field — current tools, frameworks and playbooks — and like a teammate who genuinely cares about the brand's results. Every reply is grounded in the actual brand: audience JTBD, pillars, products, gallery, campaigns, recent performance.
5. Agents can **act**, not just advise: they can create ideas, reshuffle the arc, schedule posts, trigger scans etc. within their own domain, using the existing approval + undo flow already built for the Strategist.
6. Threads are saved to the account, per agent per brand, and reload on any device.

## The six agent personas

| Stage | Persona | Expertise |
|---|---|---|
| Research | Market & Audience Analyst | Trend forecasting, JTBD interviewing, social listening, competitor signal reading |
| Ideation | Creative Ideator | 8-pillar framework, hook psychology, angle generation, Ogilvy copy doctrine |
| Strategy | Campaign Strategist | Narrative arcs, funnel sequencing, offer laddering, positioning |
| Planning | Content Planner | Cadence, quota balancing, calendar ops, seasonal/holiday timing |
| Execution | Creative Director | Visual style genome, layout hierarchy, caption craft, carousel arcs |
| Reporting | Growth Analyst | Conversion vs vanity metrics, cohort reading, feedback-loop tuning |

All six share the same hard boundaries already enforced for the Strategist: no billing/payments/roles/other users' data, no deletions, no live publishing, brand-scoped only.

## Technical approach

**Backend — one function, six personas.** Add `supabase/functions/stage-agent/index.ts`, modelled on the existing `strategist-agent`:
- Accepts `{ agent, brand_id, conversation_id, messages, approved_action_ids }`; validates `agent` against the six known ids.
- Reuses `_shared/agent-tools.ts` for tool building, approvals, ceilings and undo, but exposes only the tool subset relevant to that agent's stage (e.g. Reporting is read-mostly).
- Extracts the brand-context builder currently inlined in `brand-strategist/index.ts` into `_shared/brand-context.ts` so both functions share one grounded context block (brand, audiences, pillars, series, campaigns, products, recent designs, trend intel, seasonal context). `brand-strategist` keeps working unchanged.
- Per-agent system prompt = shared brand context + persona/expertise block + shared guardrails + the existing Ogilvy doctrine where copy is involved.
- Streams via `streamText` + `toDataStreamResponse` with `maxSteps: 50`, same as the Strategist route.
- Persists the user message and the completed assistant message to `agent_messages` on finish.

**Storage — no new tables.** Reuse `agent_conversations` / `agent_messages`, storing the agent id in the existing `channel` column as `stage:<agent>`. Only migration needed: an index on `(user_id, brand_id, channel, last_message_at desc)` for fast thread lists, plus a GRANT check on the existing tables.

**Frontend.**
- Install the AI Elements chat primitives (`conversation`, `message`, `prompt-input`, `tool`, `shimmer`) and build the chat surface from them.
- New `src/components/v2/agents/AgentChatPanel.tsx`: thread list + `useChat` transcript keyed by thread id, tool-activity cards (collapsed by default), approval cards reusing the Strategist's approve/undo endpoints, quick-action chips per agent, and auto-focused composer.
- New `src/lib/stageAgents.ts`: the single source of truth for the six agent ids, display names, blurbs, quick prompts and destination links — consumed by both the sheet and the function's persona registry.
- `StageLogsSheet.tsx` gains a `view` state (`logs` | `chat`), the new footer button, and a back control. Telemetry rendering is untouched.
- Threads are addressable in-sheet (selected thread id in state, restored from the newest thread on open); the sheet is a dialog, not a page, so no new routes.

## Out of scope
- No changes to the existing Blueprint strategist chat or `/agent` cockpit.
- No changes to autopilot, generation pipelines, or billing.
