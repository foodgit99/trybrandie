## Goal
Replace the remaining "Lovable" references in the app's user-visible metadata with Brandie equivalents.

## Changes

**`index.html`**
1. Line 9: `<meta name="author" content="Lovable" />` → `<meta name="author" content="Brandie" />`
2. Line 49: `<meta name="twitter:site" content="@Lovable" />` → `<meta name="twitter:site" content="@trybrandie" />` (or another handle if you have one — confirm below if different)

**Comments only (no behavior change, optional)**
- `index.html` line 12 and `src/lib/ga.ts` line 2 mention "Lovable preview" inside code comments explaining the GA-disable logic. These aren't user-visible. Leaving them as-is since they describe real preview-host detection logic.

## Not included
- The **"Edit with Lovable" badge** on the published site is injected by the publish pipeline, not in source. Hiding it requires a Pro plan and a separate publish-settings toggle. Tell me if you want me to flip that too.
- `README.md` Lovable references are dev-only docs, not shipped to users — leaving untouched.

## Open question
Twitter handle: use `@trybrandie`, or do you have a different X/Twitter handle?
