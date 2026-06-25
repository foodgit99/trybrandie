# Fix: "Copy caption" includes "**Caption:**" prefix

## Root cause
The LLM occasionally returns captions that begin with a label like `**Caption:**`, `Caption:`, or `### Caption`, and we save that verbatim to `designs.caption`. `/post` seeds `captionDraft` directly from `design.caption`, so the label shows up in the textarea and gets copied to the clipboard.

## Fix (frontend-only, low risk)
1. Add a tiny helper `stripCaptionLabel(text: string)` in `src/lib/utils.ts` that removes a leading caption label and surrounding whitespace/markdown, e.g. matches:
   - `**Caption:**`, `*Caption:*`, `Caption:`, `### Caption`, `Caption —`
   - case-insensitive, only at the very start, also trims a following blank line.
2. In `src/pages/v2/DailyPost.tsx`:
   - Apply `stripCaptionLabel` when seeding `captionDraft` from `design.caption` / sibling slide caption (around line 218–220).
   - Apply it again in `handleCopyCaption` and the WhatsApp share path as a safety net for older drafts already in state.
3. Backfill cleanup is not required — once the user edits or regenerates, the cleaned value is what gets copied. (Optional follow-up: also strip in `design-studio` before saving, but out of scope for this UI bug.)

## Verification
- Open `/post/<id>` where the stored caption begins with `**Caption:**` → textarea no longer shows the label.
- Click **Copy caption** → clipboard text starts directly with the first sentence.
- WhatsApp share path produces the same clean text.