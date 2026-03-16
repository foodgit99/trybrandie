

# Homepage Enhancement Plan

## Changes to `src/pages/Index.tsx`

### 1. Today's Content section (after Hero, before Referral Banner)
- Query `content_ideas` where `scheduled_for = today's date` and `status IN ('suggested', 'scheduled')`
- Display as a clean card with today's date header, listing each idea's title and type badge
- Each idea row has a "Create in Studio" button that navigates to `/studio?prompt={encodeURIComponent(idea.prompt)}`
- If no content for today, show a friendly empty state with a link to the Content Hub

### 2. Recent Designs — "View All" toggle
- Add `showAllDesigns` state; when false, query limits to 6 (current behavior), when true fetch all designs
- Add a "View All" / "Show Less" button below the grid that toggles the state
- The button navigates to `/history` (the existing Design History page) instead of inline expanding — cleaner UX

### 3. Quick Actions section (last section)
- A grid of 4 action cards with icons:
  - **New Design** → `/studio`
  - **Content Hub** → `/content`
  - **Brand Centre** → `/brand`
  - **Design History** → `/history`
- Styled as compact rounded cards with icon + label, matching existing design language

### Section Order
1. Hero CTA
2. Today's Content (new)
3. Referral Banner
4. Recent Designs (with "View All" button)
5. Quick Actions (new)

### Technical Details
- New query: `content_ideas` filtered by `scheduled_for` matching today's ISO date string, joined with user's brand
- Uses existing `useBrand` hook to get brand_id for filtering
- "View All" button links to `/history` page rather than loading all designs inline (keeps homepage fast)
- Studio deep-link uses `?prompt=` param — need to verify studio reads this param (it already supports `?design=` for deep-linking)

