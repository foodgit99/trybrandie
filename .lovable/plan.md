## Goal

When a user has a brand set up but **zero audience profiles** in Audience Intelligence, surface a polished, personalised popup that explains *why* it matters for their specific business and routes them to create one — without becoming repetitive or annoying.

---

## 1. Detection logic

A new global component `<AudiencePromptManager />` mounted inside the authenticated app shell will:

1. Read the active brand via `useBrand()`.
2. Skip entirely if any of these are true:
   - No brand exists yet, or `brand.onboarding_complete === false` (don't interrupt onboarding).
   - Current route is a utility/auth route (`/auth`, `/onboarding`, `/plans`, `/reset-password`, `/affiliate*`, `/admin`).
   - User is currently inside a long-running flow (Design Studio generating, Cockpit lock action in progress) — detected via existing `DesignGenerationContext` and a simple body-attribute check.
3. Otherwise, query `target_audiences` for `brand_id`:
   - If `count === 0` → eligible to prompt.
   - If `count > 0` → never show again for that brand (clear any localStorage flag).

---

## 2. Pacing & frequency rules

State stored in `localStorage` under key `brandie:audience-prompt:v1:{userId}:{brandId}` as JSON:

```ts
{
  shownCount: number,
  lastShownAt: number,   // epoch ms
  lastAction: "dismissed" | "later" | "never" | null,
  firstEligibleAt: number,
  sessionTimeMs: number  // accumulated time on eligible pages
}
```

Rules:

| Condition | Behaviour |
|---|---|
| Brand created < 24h ago | Don't show yet — let them explore. Mark `firstEligibleAt = brand.created_at + 24h`. |
| Brand ≥ 24h old, first eligible session | Wait until **45 s of accumulated active time** on Home / Cockpit / Content Hub / Design Studio in the current session before opening. |
| User clicks **"Maybe later"** | Suppress for **3 days**. |
| User clicks **"Don't show again"** | Suppress permanently (`lastAction = "never"`). |
| User closes (X / Esc / overlay) | Treat as "dismissed", suppress for **5 days**. |
| Hard lifetime cap | Max **3 appearances** per brand. After that, only the small `AudienceContextBanner` inline nudge keeps showing on /content. |
| Already shown this session | Never re-open in same session. |
| User navigates to `/brand?section=audience` | Suppress for 2 days (they're already there). |

The 45 s accumulator pauses when the tab is hidden (uses `document.visibilityState`).

---

## 3. Personalised copy

Pulled from Brand Centre (`brands` row):

- `name` → addressed by name: *"{brand.name} is missing its sharpest weapon."*
- `description` / `tagline` → woven into subtext when present.
- `vibe` / `personality_traits` → optional tone hint for the secondary line.

A small helper `buildAudienceCopy(brand)` returns `{ heading, subheading, bullets[] }`. Fallback copy used if brand fields are sparse.

**Example outputs:**

> **Heading:** "{brand.name}, who exactly are you talking to?"
> **Sub:** "Your brand voice is set — but every post is still going out to *everyone*. The brands that win are the ones that write to *one* specific human. Tell us who buys from {brand.name} and we'll rewrite every suggestion to speak straight to them."

Three benefit bullets reused from the existing `AudienceContextBanner` rationale (sharper targeting, persuasive copy, higher conversion) but rewritten in second person.

---

## 4. Component design

`src/components/audience/AudiencePromptDialog.tsx` — presentational
- shadcn `Dialog`, `max-h-[85vh] overflow-y-auto`, warm-neutral styling consistent with brand palette.
- Hero icon (Users + Sparkles), gradient accent.
- Primary CTA: **"Create my audience profile"** → `navigate("/brand?section=audience&startAudience=1#audience")`.
- Secondary: **"Maybe later"**.
- Footer link (small, muted): **"Don't show this again"**.

`src/components/audience/AudiencePromptManager.tsx` — logic
- Owns the eligibility query, the session timer, the localStorage state, and renders the dialog.
- Mounted once inside `App.tsx` under the auth-protected layout so it's available across `/`, `/cockpit`, `/content`, `/design`, etc.

`src/lib/audiencePromptCopy.ts` — pure helper that builds the personalised strings from a `Brand` object.

---

## 5. Wiring

- `src/App.tsx`: mount `<AudiencePromptManager />` inside the authenticated route tree (after `<ScrollToTop />`).
- No changes to existing `AudienceContextBanner` — it keeps acting as the always-visible inline nudge on /content. The popup is the bigger, one-time-ish escalation.

---

## 6. Technical notes

- Uses `@tanstack/react-query` with `enabled: !!brandId` and a 5-minute staleTime so we don't re-poll on every nav.
- Session timer implemented with `setInterval(1000)` only while a) tab is visible, b) route is in the eligible set, c) the prompt hasn't already fired this session.
- All localStorage reads/writes wrapped in try/catch (private-mode safe).
- No backend / schema changes required — `target_audiences` already exists with proper RLS, and brand fields are already fetched by `useBrand()`.

---

## Files

**New**
- `src/components/audience/AudiencePromptDialog.tsx`
- `src/components/audience/AudiencePromptManager.tsx`
- `src/lib/audiencePromptCopy.ts`

**Edited**
- `src/App.tsx` (mount the manager inside protected layout)

No edge function, no DB migration.
