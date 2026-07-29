# First-run guided walkthrough (Brand Centre)

A short, skippable tour that runs once per brand, steps through only the sections that are still empty, and highlights the single next best action at each stop.

## How it behaves

1. You land on `/brand` for the first time after onboarding. A small welcome card appears: "Let's finish your brand memory, 4 quick steps" with **Start tour** and **Not now**.
2. Starting the tour scrolls to the first incomplete section, dims the rest of the page, outlines that section, and shows a coach mark with:
   - what the section is for, in one sentence
   - why it matters to output quality
   - a primary button that takes the action (opens the editor at the right anchor with `?brand=` preserved)
   - **Next** / **Skip step** / **Skip tour**
3. Only incomplete sections are included. Completed ones are skipped automatically, so a mostly-set-up brand may see one or two steps.
4. Step order follows impact: Description → Colours → Fonts → Audience profile → Products/Services → Gallery.
5. If you click the primary action, the tour pauses and remembers its position. When you return to `/brand` (with the tour still unfinished), it resumes at the next incomplete step and shows a "Nice, X left" confirmation on the step you just completed.
6. Final step is a completion card: "Your brand memory is ready" with a CTA to the Blueprint.
7. The tour never auto-runs again once completed or dismissed. A **Replay setup tour** link stays available in the Brand Centre header menu.

## Highlighting

Overlay-based, no new dependency: a fixed dim layer plus a highlighted "cutout" positioned over the target section using its bounding box, with the coach-mark popover anchored below or above depending on space. Keyboard: Esc skips, Enter advances. Reduced-motion respected; overlay is aria-labelled and focus is moved to the coach mark.

## Technical notes

- New `src/components/v2/GuidedTour.tsx`: generic overlay + coach-mark renderer driven by a step array (`targetId`, `title`, `body`, `actionLabel`, `actionHref`).
- New `src/hooks/useFirstRunTour.ts`: computes the step list from existing completeness signals already used by the "Finish setting up" banner (`brand.description`, palette, typography, `target_audiences`, `brand_products`, plus gallery entries), and persists state per brand in `localStorage` (`brandie-tour:<brandId>` = `pending | active:<stepId> | done | dismissed`).
- `src/pages/v2/BrandCentre.tsx`: add stable `id` attributes to the Identity, Palette, Typography, Audience, Offer, and Gallery blocks; mount `GuidedTour`; keep the existing checklist banner (it becomes the always-on fallback once the tour is dismissed) and add the **Replay setup tour** entry.
- Action links reuse `brandHref` so the active brand id and section anchors survive navigation; the existing editor state memory keeps your place when you come back.
- No backend or schema changes; all tour state is client-side.
