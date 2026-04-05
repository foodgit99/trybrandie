

# Add Selective Field Checkboxes to Website Import Confirmation

## Overview
Add checkboxes next to each detected brand field in the confirmation dialog so users can pick which fields to overwrite and which to keep unchanged. All fields start checked by default.

## Changes

### `src/pages/BrandCentre.tsx`

1. **New state** — `selectedFields: Record<string, boolean>` to track which fields the user wants to apply. Initialize all detected fields as `true` when `scannedBrand` is set.

2. **Helper** — When `scannedBrand` is set (in `handleWebsiteImport`), compute the initial selection map based on which fields have values (e.g., `{ name: true, tagline: true, colours: true, ... }`).

3. **Confirmation dialog UI** — Wrap each field row with a `Checkbox` from `src/components/ui/checkbox.tsx`. Clicking toggles `selectedFields[key]`. Unchecked fields are visually muted. Add a "Select all / Deselect all" toggle at the top.

4. **`applyWebsiteImport`** — Only include fields in the database update where `selectedFields[key]` is `true`. Same logic for audience insertion (gated by `selectedFields.audience`).

5. **Apply button** — Disable when zero fields are selected.

## Field keys
- `name`, `tagline`, `description`, `logo`, `colours` (groups primary/secondary/accent together), `typography` (groups primary/secondary), `vibe`, `tone_of_voice`, `personality`, `audience`

## UX
- All checkboxes default to checked
- "Select all" link at top for quick toggle
- Unchecked rows get `opacity-50` styling
- Button shows count: "Apply 7 of 10 fields"

