

## Plan: Add sharing buttons to affiliate link section

### Change
Add WhatsApp and X/Twitter share buttons next to the existing Copy button in the affiliate link section of `AffiliateDashboard.tsx`.

### Implementation

**File: `src/pages/AffiliateDashboard.tsx`**

1. Import `Share2` from `lucide-react`
2. After the Copy button (line 279), add two share buttons:
   - **WhatsApp**: Opens `https://wa.me/?text=...` with a referral message + affiliate link
   - **X/Twitter**: Opens `https://twitter.com/intent/tweet?text=...` with the same
3. Wrap buttons in a flex row for clean layout

Minimal change — ~15 lines added to one file.

