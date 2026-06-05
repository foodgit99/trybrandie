# New Content Hub (clean v2 flow)

## Root cause of the current pain
- `FloatingNavBar` (legacy pill) uses `allowedPrefixes = ["/legacy", "/content", …]`. Because `"/content-hub".startsWith("/content")` is true, the legacy pill renders on top of `NewFloatingNav` on the current ContentHubV2 page.
- ContentHubV2 itself is mostly fine, but its top-bar "Studio / Engine / Calendar" buttons and its sub-tab navigation will be re-checked so the new page hits **only** v2 routes (`/cockpit`, `/blueprint`, `/engine`, `/studio`, `/post/:id`, `/brand`, `/report`, `/hub`).

## 1. Create the new hub

**File:** `src/pages/v2/Hub.tsx` (new) — route `/hub`.

Same data model as ContentHubV2 (`content_ideas`, `campaigns`, `weekly_blueprints`, `autopilot_settings`) — that data **is** the new flow's output. What changes:

- Wrapper uses `NewAppHeader` + `AgentChatDock` (no legacy chrome).
- Top action strip → `Cockpit`, `Blueprint`, `Engine`, `Studio` (all v2 routes, no `/content`, no `/history`, no `/legacy/*`).
- Tabs: **Today · This Week · Funnels · Campaigns** — rebuilt around the V2 cockpit/blueprint vocabulary:
  - **Today** — items where `scheduled_for = today`, deep-link to `/post/:id`, plus a "View today in Cockpit" link to `/cockpit`.
  - **This Week** — pulls the most recent `weekly_blueprints` row + its scheduled ideas (the StrategyTab logic, cleaned up); "Open Blueprint" → `/blueprint`.
  - **Funnels** — same 4-stage bucketing as today's V2 hub, but each row opens `/post/:id` directly (no in-page `?item=` focus mode tied to legacy edit affordances).
  - **Campaigns** — campaign cards; click → opens the campaign's first idea via `/post/:id` (no `/content` fallback).
- Empty states route to `/studio` or open the agent dock — never `/content`.
- `SEO` `path="/hub"`.

## 2. Wire it into the new-flow nav

**`src/components/v2/NewFloatingNav.tsx`**
- Change Content item: `{ to: "/hub", label: "Content", icon: LayoutGrid }`.
- Replace `"/content-hub"` in `primaryPrefixes` with `"/hub"`.

**`src/components/v2/NewAppHeader.tsx`** — change the Content Hub dropdown entry from `navigate("/content-hub")` to `navigate("/hub")`.

**`src/components/v2/StageLogsSheet.tsx`** — repoint the four `"/content-hub*"` actions to `"/hub*"` (preserving `?tab=…` params, mapped to the new tab ids).

**`src/pages/v2/Cockpit.tsx`** — the two `/content-hub` links become `/hub` (and `/hub?tab=content&item=…` → `/post/:id` directly so the new hub stays clean).

## 3. Unhook legacy from the v2 surface

**`src/App.tsx`**
- Add `<Route path="/hub" element={<ProtectedRoute><V2Hub /></ProtectedRoute>} />`.
- Keep `/content-hub` route mounted (ContentHubV2 stays reachable as requested).
- Keep `/content` and `/legacy/content` both pointing at legacy `ContentHub` (unchanged).

**`src/components/FloatingNavBar.tsx` (legacy pill)** — tighten so it never bleeds onto v2:
- Replace the `startsWith("/content")` match with an exact-prefix test that excludes `/content-hub` and `/hub`. Concretely: drop `"/content"` from `allowedPrefixes` (the legacy pill only needs to appear on legacy + utility routes; `/content` is reached from legacy nav and already has the legacy chrome via its own page). If we want it on `/content` specifically, special-case it: `pathname === "/content" || pathname.startsWith("/content/")`.

**Confirm `src/pages/ContentHub.tsx` is untouched** — no edits in this loop. ("Revert to original" = leave it as-is; this loop only removes new-flow code paths that point at it.)

## 4. QA checklist
- Visit `/hub` on mobile: only the new bottom-tab nav renders (no legacy pill).
- Visit `/content-hub`: NewFloatingNav still renders; legacy pill no longer overlays.
- Visit `/content` (legacy): legacy pill renders, NewFloatingNav does not.
- Cockpit "Open Content Hub" → `/hub`; StageLogsSheet CTAs → `/hub?tab=…`.
- No button on `/hub`, `NewAppHeader`, `NewFloatingNav`, `Cockpit`, `Blueprint`, `Engine`, `Studio` resolves to `/content`, `/history`, or `/legacy/*`.

## Files
- **Create:** `src/pages/v2/Hub.tsx`
- **Edit:** `src/App.tsx`, `src/components/v2/NewFloatingNav.tsx`, `src/components/v2/NewAppHeader.tsx`, `src/components/v2/StageLogsSheet.tsx`, `src/pages/v2/Cockpit.tsx`, `src/components/FloatingNavBar.tsx`
- **Untouched:** `src/pages/ContentHub.tsx`, `src/pages/v2/ContentHubV2.tsx`
