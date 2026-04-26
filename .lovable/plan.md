## Plan: Audience Intelligence banner on Content Hub

Add a slim, on-brand banner near the top of `/content` that surfaces which **Target Audience (JTBD profiles)** are currently shaping AI suggestions, plus a one-click jump to edit them in the Brand Centre.

### Why this matters
The `brand-engine` edge function fetches up to **3 audience profiles** per brand (`limit(3)`, no explicit order — Postgres natural order) and injects each one's `jtbd_profile` into pillar / series / campaign / weekly-idea generation. Today this dependency is invisible — users can't see why suggestions feel a certain way or which audience is missing.

### What gets built

**New component**: `src/components/content/AudienceContextBanner.tsx`

Visual structure (matches the warm neutral palette + collapsible card style already used on `/content`):
- **Left**: Small `Users` icon (lucide) in a soft gold-tinted circle.
- **Middle**:
  - **Headline**: "Suggestions tuned for {N} audience{s}" — or "No audience set yet" empty state.
  - **Sub-line**: Up to 3 audience labels rendered as small badges (e.g. `Primary Audience`, `Returning Buyers`). If a profile has no `jtbd_profile` generated yet, badge gets a muted "draft" indicator.
  - If >3 exist, append "+N more" badge.
- **Right**: Ghost button **"Edit audience →"** linking to `/brand?tab=audience` (BrandCentre already supports tab params; if not, deep-link to `/brand` and rely on the Audience section being visible).

**States**
1. **Loading** — skeleton row matching banner height.
2. **No brand / no audiences** — softer banner: "Add a target audience so suggestions speak to the right people." CTA: "Set up audience".
3. **Audiences exist, none generated** — "Audience drafts saved — generate the JTBD profile to power smarter suggestions." CTA: "Finish setup".
4. **Healthy state** — list active audiences as described above.

**Data fetch**
- New `useQuery(['content-hub-audiences', brand.id])` hook inside the banner reading from `target_audiences` (`id, label, jtbd_profile`) for the current brand, `limit(4)` so we can show "+N more".
- Reuses existing `useBrand()` for brand context; no new edge function.

### Where it goes
Insert the banner in `src/pages/ContentHub.tsx` directly under the page header (above "Upcoming Events"), so it's the first piece of context the user sees on the page.

### Out of scope
- Switching the active audience from the banner (current engine uses all up to 3 — no "active" concept exists).
- Editing JTBD answers inline. Banner is a pointer, edits stay in Brand Centre.
- Schema changes — purely a read-only UI surface.

### Verification after build
- Banner renders on `/content` for users with 0, 1, 2, 3, and 4+ audiences.
- "Edit audience" link lands on Brand Centre Audience section.
- No layout shift on mobile (390px viewport tested).
- Skeleton appears during initial load, no flash of empty state.
