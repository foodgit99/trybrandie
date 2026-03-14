

# Add Download Button to Generated Logo

## Change
Add a download icon button at the top-right corner of the generated logo image container in `LogoDesignerDialog.tsx`.

## Implementation

**File: `src/components/LogoDesignerDialog.tsx`**

1. Add `Download` to the lucide-react import (line 8)
2. Replace the image container (lines 299-305) to use `relative` positioning and add a download button:
   - Wrap the existing container in `relative`
   - Add a small icon button at `absolute top-2 right-2` with a `Download` icon
   - On click, create a temporary `<a>` element with `download` attribute, set `href` to the base64 image data, trigger click, and remove — this downloads the logo as a PNG file named `logo.png`

The download function will convert the base64 data URL directly into a downloadable file — no additional network requests needed since the image is already in memory as base64.

