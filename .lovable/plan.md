## New Page: `Cockpit` (`/cockpit`)

A focused, single-screen command center that makes Amina feel like a systemized owner. Not another dashboard — a *ritual surface* that mirrors the PRD's "Monday Briefing → Approve → Execute" flow. Reuses existing data (content_ideas, brand, autopilot status, trends) so this is a pure UI/UX layer over current backend.

### Naming
- Page: **Cockpit** (one word, matches PRD: "the dashboard should feel like a cockpit, not an art studio").
- Route: `/cockpit`
- Nav: replaces "Home" slot in `FloatingNavBar` (Index stays at `/dashboard`).

---

### Screen Anatomy (mobile-first, top → bottom)

**1. The Briefing Header**
- Greeting: "Good morning, {first name}." (Instrument Serif, large)
- Status line: "Your Week 19 Blueprint is ready for review." + day badge
- Right: tiny credit chip + settings cog

**2. CEO Briefing Strip** (Pillar 6 — Performance Pulse)
- Horizontal scroll of 3 "signal" cards: Posts Approved · Designs Ready · Days Covered
- Numbers are the hero. Muted labels. No vanity metrics.

**3. This Week's Blueprint** (Pillars 3 + 4 — Strategy + Planning)
- A 7-day vertical timeline (mobile) / horizontal rail (desktop)
- Each day = a card with: day label, narrative arc tag (Teaser/Educate/Hard Sell/Urgency/Close), idea title, format chip (graphic/carousel), thumbnail when ready
- States: `pending` (skeleton + "AI is drafting"), `ready` (preview + Approve/Swap), `approved` (check + "Scheduled"), `posted`
- Top-right of section: **Approve All Week** primary button (the "Green Light")

**4. Trend Pulse** (Pillar 1)
- Compact card: "3 trends shaping your niche this week" → expandable list of localized hooks (Payday weekend, etc.) pulled from existing trend-scout data
- Each trend has "Use this" → injects into Idea Stack

**5. Idea Stack** (Pillar 2)
- Horizontal scroller of 5–7 angle cards (Storyteller, Problem/Solution, Social Proof, Authority, Urgency, Behind-the-Scenes, Testimonial)
- Tap → "Swap into Day X" sheet (the "Quick Pivot")

**6. Today's Drop** (Pillar 5 — Execution)
- Sticky bottom card on mobile when a post is due today
- Shows asset thumb + caption preview + two buttons: **Share to WhatsApp** (deep link `https://wa.me/?text=...`) and **Copy Caption**

---

### Visual / UX Direction

- **Cockpit feel, not art studio.** Reduced color, tons of whitespace, single accent (existing gold token), Instrument Serif for headers, DM Sans for body (already in `index.css`).
- **One primary action visible at all times** ("Approve All Week" or "Share Today's Post").
- **Calm motion**: framer-motion fade/slide on mount only — no looping animations.
- **Empty state**: if no plan exists, single CTA "Generate this week's blueprint" → triggers existing `brand-engine`/`autopilot-planner` flow.
- All colors via semantic tokens; no raw hex.

---

### Technical Notes

- New file: `src/pages/Cockpit.tsx`
- New components: `src/components/cockpit/BriefingHeader.tsx`, `SignalStrip.tsx`, `WeekBlueprint.tsx`, `DayCard.tsx`, `TrendPulseCard.tsx`, `IdeaStack.tsx`, `TodaysDrop.tsx`
- Data sources (read-only, existing):
  - `content_ideas` (week range, autopilot_status, design_id, content_format)
  - `designs` (preview thumbs)
  - `profiles` (credits, autopilot mode)
  - `brand` (name, palette)
  - `trend-recommend` edge fn for Trend Pulse
- Actions reuse existing handlers from `ContentHub.tsx` (approve, swap, regenerate) — extracted into a small hook `useWeekBlueprint` so both pages share logic.
- Add route in `src/App.tsx` under `ProtectedRoute`.
- Update `FloatingNavBar.tsx`: swap `/` Home item for `/cockpit` (label "Cockpit", icon `Gauge`).
- WhatsApp share = `wa.me` deep link with caption text; image download triggers existing design download util.

### Out of Scope
- No backend/schema changes. No new edge functions. No changes to autopilot logic.
- ContentHub stays as the power-user surface; Cockpit is the calm executive view.

### Acceptance
- Logged-in user lands on `/cockpit`, sees this week's plan, can Approve All in one tap, and share today's post to WhatsApp — all in under 60 seconds, mobile-first.
