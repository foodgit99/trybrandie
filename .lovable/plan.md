

# Plan: Make Trend Intel Cards Interactive

## What Changes

Currently, trend cards are static display-only. We'll add an expandable detail view with actionable buttons so users can act on each trend.

## Implementation

### File: `src/pages/ContentHub.tsx`

1. **Add state** for the selected trend: `const [selectedTrend, setSelectedTrend] = useState<any>(null);`

2. **Make trend cards clickable** — add `onClick={() => setSelectedTrend(trend)}` and a cursor-pointer style to each card.

3. **Add a Trend Detail Dialog** that shows when `selectedTrend` is set:
   - Full trend title and complete summary (no truncation)
   - "Why this matters for your brand" section showing `relevance_to_brand`
   - All content angles listed as styled items (not truncated)
   - Three action buttons at the bottom:
     - **Generate Design** — navigates to `/studio?prompt={content_angle_text}` (uses the first content angle as a design prompt, prefixed with the trend title for context)
     - **Create Content Idea** — opens the existing Add Idea dialog, pre-filling the prompt field with the trend title + first content angle
     - **Ask Strategist** — navigates to `/studio?mode=plan&prompt=How can I leverage the trend "{trend.title}" for my brand?`

4. **Show all trends** — remove the `.slice(0, 4)` limit, or add a "Show all" toggle if there are more than 4 trends.

### No backend changes needed
All data (`summary`, `relevance_to_brand`, `content_angles`) is already stored in the `brand_trend_intel.trends_data` JSONB column. This is purely a frontend enhancement.

### UI Details
- Dialog uses the existing `Dialog` component already imported
- Consistent with existing design patterns (dark cards, primary accent color, compact typography)
- Content angles rendered as a numbered list for clarity
- Action buttons use existing navigation patterns (`navigate("/studio?...")`)

