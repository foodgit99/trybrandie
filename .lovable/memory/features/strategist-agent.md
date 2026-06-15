---
name: Autonomous Strategist Agent
description: Tool-using executive agent with guardrails, undo, external webhook, and dedicated cockpit at /agent
type: feature
---
Autonomous Brand Strategist Agent — coexists with the legacy `brand-strategist` (chat-only advisor), never modifies it.

## Routes & UI
- `/agent` + `/agent/:threadId` → AgentCockpit.tsx (thread list + chat, threaded + DB-persisted per chat-agent-ui-contract)
- `/agent/settings` → AgentSettings.tsx (master switch, per-tool Auto/Confirm/Off, persona, forbidden topics, ceilings, API tokens, activity log + undo)
- Discoverability: small "Agent ↗" link in `AgentChatDock` header. Page itself gates with opt-in screen if `autonomy_enabled = false`.

## Edge functions
- `strategist-agent` — streaming AI SDK chat; tools from `_shared/agent-tools.ts`; `stepCountIs(50)`; reads `agent_settings` to resolve tool modes + ceilings. Returns 403 if autonomy disabled.
- `strategist-agent-webhook` — public endpoint; auth via bearer token from `agent_api_tokens` (sha256-hashed). Single-shot `generateText` with `stepCountIs(25)`. Stores conv via `external_thread_id`.
- `agent-tokens` — create/list/revoke tokens. Raw token shown ONCE on create; only sha256 hash + 12-char prefix stored.
- `agent-undo` — reverses reversible actions via stored `reverse_payload`. Restricted to {campaigns, content_pillars, post_series, content_ideas}.

## Tool catalog (in `_shared/agent-tools.ts`)
Reads: `get_brand_snapshot`, `get_blueprint`, `get_recent_designs`, `query_holidays`, `query_trends`.
Writes (reversible): `create_campaign`, `create_content_pillar`, `draft_content_idea`, `schedule_idea`, `update_idea_caption`.
Spend (non-reversible, counts vs spend ceiling): `enqueue_design_generation`.

## Guardrails (enforced in code, not just prompt)
- `TABLE_DENYLIST` — billing/subscriptions/payments/affiliates/profiles/user_roles/oauth/api_tokens.
- No DELETE tool exposed; agent has no delete capability.
- No live social publishing; only writes to `content_ideas.scheduled_for` (existing autopilot cron delivers).
- `brand_id` always injected from session, never from model args.
- Per-tool mode (auto/confirm/off) from `agent_settings.tool_modes`; confirm mode returns `{requires_approval, action_id, summary}` and writes a pending row to `agent_actions` (status=awaiting_approval). UI sends `approved_action_ids[]` back to resume.
- Daily ceilings: total tool calls (default 50) and design spends (default 10) — counted from `agent_actions` for today.

## Tables (all RLS-scoped to user)
- `agent_settings(user_id, brand_id UNIQUE)`: autonomy_enabled, tool_modes jsonb, daily_tool_ceiling, daily_spend_ceiling, persona_notes, forbidden_topics[].
- `agent_conversations(user_id, brand_id, channel, external_thread_id, title)`.
- `agent_messages(conversation_id, role, parts jsonb)` — stores AI SDK parts.
- `agent_actions(user_id, brand_id, tool_name, input, output, status, is_reversible, reverse_payload, spend_units)` — audit log + undo source.
- `agent_api_tokens(user_id, token_hash UNIQUE, token_prefix, label, revoked_at)`.

## Critical invariants
- Existing `brand-strategist` edge function and chat dock behavior are UNCHANGED.
- Agent is feature-flagged via `agent_settings.autonomy_enabled` (default false). Endpoints return 403 if off.
- AI SDK v4 API: `useChat` from `@ai-sdk/react`, `streamText` + `tool` from `npm:ai@4.3.16`, `convertToModelMessages`, `stepCountIs`. Provider via `@ai-sdk/openai-compatible` → Lovable AI Gateway.
