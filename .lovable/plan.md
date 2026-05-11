# Plan: Share image to WhatsApp from Cockpit

## Goal
When the user taps **Share to WhatsApp** on the *Today's Drop* card, attach the **generated image** to the WhatsApp share (Status, chat, etc.) — not just the caption text.

## Why the current behavior happens
`wa.me/?text=...` is a text-only deep link. WhatsApp exposes no public URL parameter for media. The only browser-level way to push an image into WhatsApp is the **Web Share API Level 2** (`navigator.share({ files })`), which opens the OS share sheet — from there the user picks WhatsApp → Status/Chat and the image arrives attached with the caption pre-filled.

## Implementation (single file: `src/pages/Cockpit.tsx`)

Replace the existing `handleShareWhatsApp` handler with a tiered strategy:

### Tier 1 — Native file share (mobile, modern browsers)
1. `fetch(imageUrl)` → `blob()` → wrap in `File` (`image/jpeg` or `image/png` based on URL).
2. Build payload: `{ files: [file], text: caption, title: "Today's Drop" }`.
3. If `navigator.canShare?.(payload)` is true → `await navigator.share(payload)`.
4. Result: native share sheet opens → user picks WhatsApp → image + caption attached.

### Tier 2 — Mobile without file share support
1. Trigger image download (anchor with `download` attr, or `window.open` for cross-origin).
2. Copy caption to clipboard.
3. Open `https://wa.me/?text=<caption>` so user can manually attach the just-downloaded image.
4. Toast: *"Image downloaded — attach it in WhatsApp."*

### Tier 3 — Desktop fallback
1. Same as Tier 2 but open `https://web.whatsapp.com/` instead of `wa.me`.
2. Toast guides user.

### Detection helpers
- `const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)`
- `const canShareFiles = !!navigator.canShare && navigator.canShare({ files: [new File([], "x.jpg", { type: "image/jpeg" })] })`
- All wrapped in try/catch (user-cancel on `navigator.share` throws `AbortError` — swallow silently).

### CORS note
The image lives on Supabase storage with public read. `fetch` will succeed and return a usable Blob (already verified pattern used elsewhere in the app for downloads). If a CORS edge case appears, fall through to Tier 2.

## Out of scope
- No backend changes
- No new edge functions
- No changes to image generation, captions, or any other Cockpit section
- No new dependencies

## Acceptance
- On a phone: tap **Share to WhatsApp** → native share sheet → pick WhatsApp Status → image is attached with caption pre-filled.
- On desktop: image downloads, caption copied, `web.whatsapp.com` opens with a toast explaining the step.
- Cancelling the share sheet does not show an error toast.
