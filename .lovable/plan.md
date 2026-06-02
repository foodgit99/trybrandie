## Goal

Make `/post/:dayId` use the **exact same generation pipeline as /studio** — `DesignGenerationContext.startGeneration()` — and delete the parallel path that DailyPost currently uses.

## What both paths do today

Both /studio and /post already call the same edge function chain: `design-enqueue` → `design-studio` (background worker). The divergence is on top of that:

- **/studio (canonical)**: uses `useDesignGeneration().startGeneration(params)` from `src/contexts/DesignGenerationContext.tsx`. The context sends a full `{ messages, brand, audience, trend, canvas_size, ... }` payload, subscribes via Realtime to `design_jobs`, drives a progress timer, auto-inserts a `designs` row on success, writes `design_messages`, and processes referrals.
- **/post (bespoke)**: `DailyPost.handleGenerate` calls `supabase.functions.invoke("design-enqueue", { body: { prompt, title, idea_id, ... } })` directly, then runs its own `setInterval` poll of `design_jobs`. To make this work, a side branch was added to `design-studio` (lines ~3421-3456) that detects `idea_id` and writes the `designs` row + sets `content_ideas.design_id` server-side. There's also a `messages` synthesis guard (~line 654) added because /post wasn't sending `messages`.

## Changes

### 1. `src/pages/v2/DailyPost.tsx` — use the context

- Import and call `useDesignGeneration()`.
- Replace `handleGenerate` so it calls `startGeneration({...})` with the same shape /studio uses:
  - `action: "generate"`, `canvas_size: "1080x1080"`
  - `messages: [{ role: "user", content: idea.prompt || idea.title }]`
  - `full_messages: [{ role: "user", content: idea.prompt || idea.title }]`
  - `brand`, `user_id`, `brand_id: brand.id`, `title: idea.title`
  - `audience_id` / `trend` left undefined (same defaults as a fresh studio session)
- Delete:
  - local `activeJobId` state + the `useEffect` that polls `design_jobs` every 4s
  - the manual `await supabase.functions.invoke("design-enqueue", ...)`
- Drive UI state from the context: `status === "generating"` shows `GenerationLoader`; on `status === "complete"` consume `result.design_id`, run a single client-side update to `content_ideas` setting `design_id`, `status="scheduled"`, `approval_status="approved"`, then `refetchIdea()` and `clearResult()`.
- Keep the "Generate now" button + loader visuals unchanged.

### 2. `supabase/functions/design-studio/index.ts` — delete the /post-only branch

- Remove the `idea_id` link-back block (≈lines 3421-3456) that inserts a `designs` row and updates `content_ideas.design_id` from the worker. With the context flow, the client owns that write (the same way /studio does via `DesignGenerationContext`).
- Remove the `messages`-from-`prompt` synthesis guard I added earlier (≈line 654). The context always sends `messages`, so the guard is no longer needed and was only there to prop up the bespoke /post call shape.
- The `design_jobs.result` payload reverts to whatever `runFullHandler` returned (no `design_id` injection from the worker).

### 3. No changes to

- `design-enqueue` (already shared).
- `DesignGenerationProvider` (already wraps `/post` in `App.tsx` line 136).
- `GenerationLoader` (already used by both pages).

## Risk / verification

- /studio behaviour is untouched — same context, same edge function, same payload shape.
- /post becomes a thin caller of the context with one extra post-success DB write to link `content_ideas.design_id`. That mirrors how /studio's auto-save links `designs` → `design_messages`.
- Autopilot path is unaffected (it calls `design-studio` directly with its own body and doesn't rely on the `idea_id` branch).
