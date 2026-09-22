# Token cost audit — cuts that don't touch output quality

Findings below come from reading the backend functions directly. Every item is a place where we pay for tokens that never change what the user sees.

## What I confirmed

- **Nothing caps output length.** A search for output limits across all backend functions returns zero results, so every text call can ramble as long as the model likes and we pay for all of it.
- **Chat agents resend the whole conversation.** `stage-agent/index.ts:136` and `strategist-agent/index.ts:117` pass the client's full message list straight to the model with no trimming; `strategist-agent-webhook` does the same. The Studio already has a deterministic trimming routine we can reuse.
- **The full tool manual rides along on every chat turn.** `_shared/agent-tools.ts` is 16 KB of tool definitions sent on every message, for every agent, whether it uses a tool or not.
- **Context is pretty-printed into prompts.** `JSON.stringify(x, null, 2)` in `competitor-digest:93`, `competitor-discover:86`, `brand-scraper:126`, `video-studio:271,294` — the indentation alone is paid-for whitespace, and whole rows go in with no field filtering or row caps.
- **Agent brand context loads everything.** `_shared/brand-context.ts` selects all brand columns plus products, gallery, 12 designs, 15 ideas, competitors and trends, then writes it all into the prompt.
- **One design triggers several premium calls.** `design-studio` makes separate top-tier reasoning calls at lines 1953 (brief), 3127 (art direction) and 3676 (carousel arc), each restating brand context that the previous call already digested.
- **Autopilot renders two images per post.** `content-autopilot/index.ts:564` asks for `candidate_count: 2`, so every daily post pays for two full renders and keeps one.
- **The copy doctrine (4.8 KB) is prepended at ~8 call sites**, including short caption jobs that don't need the full ideation guidance.
- **Repeat one-shot jobs aren't cached.** `audience-suggest`, `audience-intelligence` and `competitor-discover` re-bill identical inputs, unlike the holiday feed and category recipes which already cache.

## The changes

1. **Cap output length on every text call.** Per-task ceilings (short JSON ~600, captions ~400, planners ~2000, briefs ~1500). Outputs today are well inside these, so nothing gets truncated — we just stop paying for runaway generations.
2. **Trim conversation history server-side.** Keep the first user brief plus the last ~8 turns and a short digest of the rest, reusing the Studio's existing compression approach, in `stage-agent`, `strategist-agent` and `strategist-agent-webhook`.
3. **Send only the tools an agent can actually use.** Filter the tool list per agent persona and shorten descriptions to one line each.
4. **Compact every JSON block injected into prompts.** Drop pretty-printing, whitelist the fields the model needs, and cap list lengths (competitors, posts, scraped page content, prior video stages).
5. **Slim the agent brand context.** Select named brand columns instead of everything, cut recent designs from 12 to 6 and ideas from 15 to 10, and trim long free-text fields.
6. **Stop re-sending brand context after the brief exists.** The art-direction and carousel calls receive the brief's condensed output plus the genome instead of the full brand block again.
7. **Two doctrine sizes.** Keep the full doctrine for planning/ideation agents; use a condensed version for caption and short-copy calls where the long version adds no new rule.
8. **Cache the repeatable one-shot jobs** (audience suggestions, audience intelligence, competitor discovery) in the existing cache table, keyed by a hash of their inputs, with a sensible expiry.
9. **Render the second autopilot image only when needed.** Render one, score it, and render the alternative only if the score falls below the existing quality threshold. This keeps the quality gate while halving image cost on the posts that already pass.

## Deliberately not changed

Creative writing, strategy planning, art direction, image rendering, trend and competitor research, logo generation and email generation stay on their current models. No prompt rule, doctrine constraint or quality gate is removed — only duplicated context, whitespace, unused tool text and uncapped generation.

## Technical notes

- Files touched: `design-studio/index.ts`, `content-autopilot/index.ts`, `stage-agent/index.ts`, `strategist-agent/index.ts`, `strategist-agent-webhook/index.ts`, `agent-roundtable/index.ts`, `competitor-digest/index.ts`, `competitor-discover/index.ts`, `brand-scraper/index.ts`, `video-studio/index.ts`, `audience-suggest/index.ts`, `audience-intelligence/index.ts`, `_shared/agent-tools.ts`, `_shared/brand-context.ts`, `_shared/ogilvy-copy-doctrine.ts`.
- New shared helper for history trimming and a `OGILVY_COPY_DOCTRINE_SHORT` export; no database schema or UI changes.
- Verification: type-check the changed functions, deploy them, then generate one single design, one carousel, one Strategist chat turn and one autopilot post, and compare the AI Gateway request logs (token counts per call) before/after while checking the outputs read the same.
