
# Autonomous Brand Strategist Agent

Upgrade the existing `brand-strategist` from a chat-only advisor into a tool-using executive agent that can plan, decide, and act across the app on the user's behalf — with hard guardrails, full auditability, and per-capability user control.

## Guiding constraints

- **Additive, not destructive.** The current strategist chat keeps working exactly as today. The new agent lives behind a feature flag (`autonomy_enabled`) defaulted OFF. Existing surfaces (`brand-strategist` edge function, ChatSuggestions, Hub chat dock) are untouched in behavior until the flag is on.
- **Never touches sensitive surfaces.** Hard-coded denylist (enforced in the agent runtime, not just the prompt): `subscriptions`, `subscription_charges`, `subscription_credits`, `payment_transactions`, `affiliates`, `affiliate_commissions`, `affiliate_payouts`, `affiliate_referrals`, `profiles` (PII columns), `user_roles`, `google_oauth_tokens`. No deletes anywhere. No live social publishing.
- **Scoped to one user + active brand.** Every tool call resolves `user_id` + `brand_id` from the authenticated context and uses the user's JWT (not service role) for DB reads/writes so existing RLS does the second line of defense.
- **Daily action ceiling.** Configurable per-day caps on (a) total tool calls, (b) credit-spending actions, (c) designs generated. Hard stop returns a polite "ceiling reached" message.

---

## 1. New agent runtime — `supabase/functions/strategist-agent/index.ts`

A new edge function that runs the agentic loop. **Does not replace** `brand-strategist`; coexists.

- Built on AI SDK (`npm:ai`) + Lovable AI Gateway, model `google/gemini-3-flash-preview` (Gemini 3.1 Pro for complex multi-step), `stepCountIs(50)`.
- Streams `toUIMessageStreamResponse` so the UI renders tool calls, tool results, and assistant text natively via `message.parts`.
- Loads same brand context as today's strategist (brand, audiences, pillars, series, campaigns, products, recent designs, trend intel, holiday feed).
- Loads the user's `agent_settings` row to know which tools are Auto / Confirm / Off and the current daily ceiling.

### Tool catalog (all server-side, validated with Zod)

Each tool declares `mode: "read" | "write" | "spend"` and `needsApproval` resolved per-call from user settings.

**Read / research (no side effects):**
- `get_brand_snapshot` — current brand, audiences, pillars
- `get_blueprint` — today/this-week's planned posts
- `get_recent_designs` — last N designs + votes
- `query_trends` — calls existing `trend-scout` for live trend data
- `query_holidays` — calls `holiday-feed` for upcoming regional holidays
- `get_content_coverage` — pillar/category balance over last 14 days
- `get_brand_pulse` — composite health score

**Write (drafts only, no live publish):**
- `create_campaign` — inserts row in `campaigns`
- `create_content_pillar` — inserts row in `content_pillars`
- `create_post_series` — inserts row in `post_series`
- `draft_content_idea` — inserts into `content_ideas` (status=draft)
- `build_strategic_arc` — orchestrator: drafts 3–7 sequenced ideas across pillars for a date range and writes them to `content_ideas` + a new row in `weekly_blueprints`
- `schedule_idea` — sets `scheduled_for` on an existing `content_ideas` row
- `update_idea_caption` — edits draft copy on a `content_ideas` row
- `enqueue_design_generation` (spend) — calls `design-enqueue` for a specific idea; counts against the design ceiling
- `update_autopilot_settings` — toggles autopilot on/off and times (never billing-adjacent fields)

**Other agents:**
- `delegate_to_research` — calls `trend-scout` / `audience-suggest`
- `delegate_to_copywriter` — internal call to category-recipes / brand-engine for caption rewrites
- `delegate_to_designer` — `enqueue_design_generation` wrapper with brand-engine context

### Guardrails (enforced in code, not prompt)

1. **Denylist table check** — every DB tool wraps Supabase calls; if `from()` target matches denylist, throw before execution.
2. **Brand scoping** — `brand_id` is always injected from the agent's session, never from the model's tool arguments.
3. **No-delete invariant** — no tool exposes DELETE; agent has no delete capability at all.
4. **No live publishing** — `publish_post` / social-network calls are explicitly NOT in the tool catalog. Scheduling only writes to `content_ideas.scheduled_for`; the existing `content-autopilot` cron handles delivery exactly as today.
5. **Action ceiling** — middleware in the agent loop increments counters in a new `agent_action_log` row; if today's count > ceiling, tool returns `{ error: "daily_ceiling_reached" }` and the model is instructed to stop and surface that to the user.
6. **Approval gates** — for any tool whose mode is set to `confirm` in user settings, the tool's `execute` returns a structured `{ requires_approval: true, plan: ... }` message instead of running. The UI renders an inline approval card (Approve / Reject); on approve, the chat re-invokes with `approval_token`.
7. **Sensitive-topic refusal** — system prompt forbids discussing/changing billing, payouts, account ownership, or other users' data. Tool denylist is the real enforcement.

### Logging & undo

- New table `agent_actions` records every tool call with `id`, `user_id`, `brand_id`, `tool_name`, `input`, `output`, `status`, `is_reversible`, `reverse_payload`, `created_at`.
- For reversible writes (campaign/pillar/series/idea creation, schedule changes, caption edits), `reverse_payload` stores enough to undo (e.g. `{ table, row_id, prev_values }`).
- Undo executes the inverse op via a small `agent-undo` edge function; design-generation credits are not refundable, marked `is_reversible: false`.

---

## 2. External endpoint — `supabase/functions/strategist-agent-webhook/index.ts`

Single authenticated webhook so future WhatsApp/Telegram/Email/Granola adapters can plug in without re-implementing the agent.

- `POST /strategist-agent-webhook`
- Auth: per-user bearer token from new `agent_api_tokens` table (`user_id`, `token_hash`, `label`, `last_used_at`, `revoked_at`). Token generated and shown once in Agent Settings page.
- Body: `{ message: string, brand_id?: string, channel?: "whatsapp" | "telegram" | "email" | "api", external_thread_id?: string }`.
- Resolves user from token, picks default brand if not given, runs the same agent runtime, returns final assistant text + a structured `actions_taken[]` summary suitable for posting back into a chat channel.
- Same guardrails apply — token has no elevated privileges; it acts strictly as that user.
- Channel adapters (Twilio for WhatsApp, Telegram bot, Resend inbound for email) are **explicitly out of scope** for v1 per the user's choice — only the endpoint ships.

---

## 3. Database schema (one migration)

```text
agent_settings        one row per (user_id, brand_id)
  autonomy_enabled    bool default false
  tool_modes          jsonb  e.g. { create_campaign: "auto"|"confirm"|"off", ... }
  daily_tool_ceiling  int default 50
  daily_spend_ceiling int default 10   -- design generations / day
  persona_notes       text             -- custom instructions
  forbidden_topics    text[]
  updated_at          timestamptz

agent_actions         audit log (see §1)
agent_api_tokens      external endpoint auth (see §2)
agent_conversations   id, user_id, brand_id, channel, title, created_at, last_message_at
agent_messages        id, conversation_id, role, parts jsonb, tool_calls jsonb, created_at
```

- All tables: GRANT to `authenticated` + `service_role`, RLS scoped by `user_id = auth.uid()`.
- `agent_messages.parts` stores AI SDK `UIMessage.parts` so reloads restore tool-call rendering.

---

## 4. UI — Agent surface

### a) New page: `/agent` — Strategist Cockpit
Threaded chat (per `chat-agent-ui-contract`, threads + database persistence chosen because the agent runs long-lived, undoable sessions):
- Route: `/agent` (thread picker) and `/agent/:threadId` (active conversation).
- Left rail: thread list, "New conversation".
- Main: chat using AI SDK `useChat` against `strategist-agent`. Renders `message.parts` — text, tool calls (collapsed by default with status pill: Running / Done / Awaiting approval / Reversed), tool results.
- Inline **Approval cards** for `confirm`-mode actions: show planned op + Approve / Reject buttons.
- Inline **Undo button** on reversible completed actions.
- Composer stays focused (per chat contract), supports voice-style "Jarvis" feel via subtle status text ("Strategist is thinking…", "Querying trends…", "Drafting Tuesday's post…") driven by streamed tool-call parts.

### b) New page: `/agent/settings` — Agent Configuration
- **Autonomy master switch** (off by default).
- **Capability toggles** — grouped (Research, Drafting, Scheduling, Design generation, Edits): each tool = Auto / Confirm / Off.
- **Guardrail rules** — persona notes textarea, forbidden topics tag input, daily tool ceiling slider, daily design ceiling slider.
- **External access** — generate API token (shown once), list active tokens with last-used, revoke button. Endpoint URL + minimal usage docs.
- **Activity log** — paginated table of `agent_actions` with status, target, timestamp, one-click undo where reversible, filter by tool / day.

### c) Optional entry points (additive)
- Small "Open in Strategist Cockpit" link added to existing Hub `AgentChatDock` header; the dock itself keeps current behavior.
- FloatingNavBar gains a single "Agent" item (sparkle icon) — only rendered when `autonomy_enabled = true`, so unconfigured users see no change.

---

## 5. Safety / non-breakage checklist

- Existing `brand-strategist` edge function: **not modified**. The new agent is a separate function; the old chat dock keeps calling the old function.
- All new DB tables are new — no schema changes to existing tables.
- No existing edge function is altered except adding the optional `delegate_*` tools that internally call them with the user's JWT (read-only invocations of `trend-scout`, `holiday-feed`, etc., which already support that path).
- Feature flag `agent_settings.autonomy_enabled = false` by default → `/agent` page loads but shows an opt-in CTA; webhook returns 403 until token is generated; nav item hidden. Zero-impact for current users.
- If during implementation we discover the autonomous loop cannot be cleanly isolated from a current surface (e.g. nav conflicts, RLS gaps we can't fix without altering existing policies), we will stop and report instead of partially shipping.

---

## Technical notes

- AI SDK: `streamText` + `tool({ inputSchema, execute })`, `stopWhen: stepCountIs(50)`, `dynamicTool` not needed (catalog is fixed).
- Approval flow: tool returns a tagged result `{ kind: "approval_required", action_id, summary }`. UI sends a follow-up message `{ approve: action_id }` which the agent's pre-tool middleware honors.
- Action ceiling counter: cheap COUNT on `agent_actions WHERE user_id = ? AND created_at >= today` cached per request.
- Undo: `agent-undo` edge function takes `action_id`, reads `reverse_payload`, applies inverse, marks original row `status='reversed'`.
- External endpoint rate limit: noted as a gap (no platform primitive). Per-token soft cap via `agent_actions` ceiling is the only limit in v1; mentioned in the Agent Settings docs panel.

## Out of scope (v1)
- WhatsApp / Telegram / Email channel adapters (only the endpoint ships).
- Live social publishing.
- Cross-brand operations.
- Voice I/O (the "Jarvis" feel is visual/status-text only).
- Refunding design credits on undo.
