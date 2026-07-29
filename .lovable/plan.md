# Brandie UI Facelift — subtle spectrum, sharper hierarchy

Goal: keep the current minimalist, warm-neutral, professional language exactly as it is, and add a thin layer of brand-spectrum accents, depth and emphasis so buttons and sections read instantly. Nothing is removed, no layout is rearranged, no copy or logic changes.

## 1. Extract the logo palette into tokens

From the logo: coral/orange, magenta/pink, violet, indigo/blue, teal. These become a controlled "spectrum" set in `src/index.css` (HSL, light + dark values):

```text
--brandie-coral    orange-red   (energy / primary CTA glow)
--brandie-magenta  pink         (highlights, active states)
--brandie-violet   purple       (AI / autonomous surfaces)
--brandie-indigo   blue         (informational, links)
--brandie-teal     teal         (success, healthy status)
--gradient-spectrum   coral → magenta → violet → indigo → teal
--gradient-brand-soft very low-opacity version for section washes
--glow-accent / --glow-soft / --glow-focus  (neon ring + shadow recipes)
--shadow-raised / --shadow-flat            (elevation scale)
```

Registered in `tailwind.config.ts` under `colors.brandie.*` plus `boxShadow.glow`, `boxShadow.raised` so components use semantic classes only — no hardcoded hex anywhere.

Rule of restraint: the neutral beige/charcoal base stays dominant. Spectrum colour appears on roughly one element per screen region — never as large filled blocks.

## 2. Button hierarchy (`src/components/ui/button.tsx`)

- **Primary (`default`)**: keeps charcoal fill, gains a faint spectrum-tinted glow shadow on hover and a 1px inner highlight — feels raised and clickable.
- **New `hero` variant**: spectrum gradient border/underglow for the single most important action on a page (Generate, Approve week, Publish).
- **Secondary / outline**: slightly stronger border contrast so they stop blending into cards; hover reveals a soft accent border.
- **Ghost**: intentionally quieter (lower opacity text) so destructive/utility actions recede.
- Adds `transition-all`, subtle `active:scale-[0.98]` press feedback, and a spectrum focus ring for keyboard users.

## 3. Section distinguishability (`src/components/ui/card.tsx` + global CSS)

- Cards get a marginally warmer surface, crisper border and `shadow-flat`; interactive cards get a hover lift with a faint accent border.
- New utility classes in `index.css`: `.section-surface`, `.section-accent-rail` (2px vertical spectrum rail for headline sections), `.glow-ring`, `.status-dot-{live,idle,warn}`.
- Section headers get a hairline divider + uppercase tracked eyebrow style so the eye can chunk the page.

## 4. Emphasis / de-emphasis pass on key surfaces

Applied only via className swaps to existing markup:

- **Cockpit**: hero/next-best-action card gets the spectrum rail and `hero` button; secondary tiles de-emphasised to quiet surfaces.
- **Blueprint**: today's day-card highlighted with accent ring; other days flattened. Approve = `hero`.
- **Engine**: agent/status chips use teal (healthy), coral (attention), violet (AI running) with soft glow dots instead of flat grey.
- **Nav (`NewFloatingNav`, `NewAppHeader`)**: active item gets a soft spectrum glow pill; inactive items muted. Credits badge picks up a subtle accent when low.
- **Brand Centre**: collapsed group headers get quiet styling; the "finish setting up" checklist gets the accent rail so it's the obvious next step.

## 5. Motion & polish

Small, tasteful only: 150–200ms colour/shadow transitions, a `pulse-glow` keyframe reserved for live/generating states, and `fade-in` reused for section entry. No parallax, no bouncing.

## Technical notes

- All values live as HSL CSS variables in `src/index.css` and are exposed through `tailwind.config.ts`; components reference semantic tokens (`bg-card`, `shadow-glow`, `text-brandie-teal`) only.
- Dark mode gets its own tuned spectrum values (higher chroma, lower lightness backgrounds) so glows read correctly on both themes.
- Accessibility: every accent/foreground pairing checked for AA contrast; glows are decorative shadows, never the sole state indicator.
- Files touched: `src/index.css`, `tailwind.config.ts`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, and className-only tweaks in `NewAppHeader.tsx`, `NewFloatingNav.tsx`, `pages/v2/Cockpit.tsx`, `pages/v2/Blueprint.tsx`, `pages/v2/Engine.tsx`, `pages/v2/BrandCentre.tsx`.
- No changes to edge functions, data model, or business logic.
