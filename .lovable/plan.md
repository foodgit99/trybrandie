

# Plan: Add "Reuse" Action for Sent Campaigns

## What Changes

Currently, the Duplicate button silently creates a new draft in the campaign list. For sent campaigns, we'll add a dedicated **"Reuse as Template"** button that duplicates the campaign AND immediately opens the composer pre-filled with its content — so the admin can tweak and resend in one smooth flow.

## Implementation

### File: `src/pages/Admin.tsx`

1. **Add a "Reuse" button** on sent campaigns (next to the report icon) with a `RotateCcw` or `RefreshCw` icon and tooltip "Reuse as template"

2. **Create `handleReuse` function** that:
   - Pre-fills the composer form state (subject with "(Resend)" suffix, headline, body, CTA, segment filters) from the selected sent campaign
   - Sets `editingCampaign` to `null` (so it creates a new campaign on save, not editing the old one)
   - Switches view to `"compose"`

3. **Keep existing Duplicate button** as-is for quick silent cloning without opening the composer

This is a small, focused change — roughly 20 lines of new code in the single Admin.tsx file.

