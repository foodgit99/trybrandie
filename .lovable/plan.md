# Make v2 the main flow

Promote the `/v2/*` experience to the primary routes so every user lands in the new cockpit by default. Legacy stays reachable at `/legacy/*` as a safety net during rollout.

## Routing changes (`src/App.tsx`)

Rewire the router so the primary paths render v2 components, and drop the `v2_enabled` profile gate.

```text
Primary routes (NEW default = v2)
  /                  → V2Landing if signed-out, else V2Cockpit (or V2Onboarding if !onboarding_complete)
  /onboarding        → V2Onboarding
  /cockpit           → V2Cockpit
  /blueprint         → V2Blueprint
  /post/:dayId       → V2DailyPost
  /report            → V2Report
  /brand             → V2BrandCentre
  /settings          → V2Settings
  /studio            → DesignStudio          (kept — no v2 equivalent yet)
  /history           → DesignHistory         (kept)
  /content           → ContentHub            (kept)
  /plans             → Plans                 (kept)
  /affiliate, /affiliates, /affiliate/signup, /admin, /auth, /reset-password  (unchanged)

Legacy mirror (escape hatch)
  /legacy            → legacy Index/Landing
  /legacy/dashboard  → legacy Index
  /legacy/onboarding → legacy Onboarding   (ADD)
  /legacy/brand      → legacy BrandCentre
  /legacy/cockpit    → legacy Cockpit
  /legacy/settings   → legacy Settings
  /legacy/content, /legacy/studio, /legacy/history, /legacy/plans, /legacy/affiliate, /legacy/admin (already present)

Redirects (preserve old bookmarks)
  /dashboard         → /cockpit
  /v2                → /                   (and /v2/* → matching primary path, 301-style Navigate)
  /briefing          → /cockpit#week-blueprint  (unchanged)
```

Implementation notes:
- Collapse `LandingOrDashboard` to: signed-out → `<V2Landing/>`; signed-in + onboarding incomplete → `Navigate /onboarding`; else → `Navigate /cockpit`. Remove the `profiles.v2_enabled` lookup entirely (no DB read on home).
- `ProtectedRoute` / `OnboardingRoute` / `AuthRoute` stay as-is (they only check auth + onboarding_complete).
- Add small `<Navigate>` shims for each old `/v2/*` path so existing links keep working.
- `NewFloatingNav` becomes the only nav for v2 routes; confirm `FloatingNavBar` still hides itself on the new primary paths (it currently keys off path prefixes — verify and update its allow/deny list to match the new primary routes).

## Nav visibility (`src/components/FloatingNavBar.tsx` + `src/components/v2/NewFloatingNav.tsx`)

- `FloatingNavBar`: restrict to `/legacy/*`, `/studio`, `/history`, `/content`, `/plans`, `/affiliate*`, `/admin` (i.e. routes that still render legacy chrome).
- `NewFloatingNav`: render on `/`, `/onboarding`, `/cockpit`, `/blueprint`, `/post/*`, `/report`, `/brand`, `/settings`. Update its internal route table from `/v2/...` to the new primary paths.

## Internal links audit

Search and replace v2 deep links so they point at the new primary paths:
- `/v2/cockpit` → `/cockpit`
- `/v2/blueprint` → `/blueprint`
- `/v2/post/` → `/post/`
- `/v2/report` → `/report`
- `/v2/brand` → `/brand`
- `/v2/settings` → `/settings`
- `/v2/onboarding` → `/onboarding`
- `/v2` (landing) → `/`

Scope of grep: `src/pages/v2/**`, `src/components/v2/**`, plus any edge function that builds user-facing URLs (`monday-briefing`, `daily-execution-push`, `content-daily-reminder`, `send-email`). Update those edge functions to emit the new paths so emails/WhatsApp links land on v2.

## What does NOT change

- Database, RLS, edge function logic — untouched.
- The `profiles.v2_enabled` column stays in the schema (no migration); we just stop reading it. Can be dropped in a later cleanup pass.
- Studio, History, Content Hub, Plans, Affiliate, Admin keep their current implementations and URLs.
- Legacy components remain in `src/pages/*` so `/legacy/*` keeps working.

## Verification

1. Signed-out visit to `/` shows V2 Landing.
2. New signup → `/onboarding` renders V2Onboarding; completing it lands on `/cockpit`.
3. Existing user with `onboarding_complete=true` hitting `/` redirects to `/cockpit`.
4. `/v2/cockpit`, `/v2/blueprint`, etc. still resolve (via Navigate shims).
5. `/legacy/dashboard` still renders the old `Index` page.
6. `NewFloatingNav` appears on primary routes; `FloatingNavBar` only on legacy/utility routes (no double nav).
7. Monday briefing email + daily push links open the new primary URLs.