

## Plan: Add Download Button to Autopilot Email

### Problem
The autopilot email shows the design as an embedded image, but there's no way for the user to download it directly from the email.

### Solution
Add a "Download Design" button in the `autopilot_design_ready` email template that links directly to the image URL. No need to attach the file to the email — the images are already publicly hosted in storage. A direct link is more reliable, avoids spam filters, and keeps email size small.

### Changes

**`supabase/functions/send-email/index.ts`** — Update the `autopilot_design_ready` HTML template:
- Add a second CTA button ("Download Design") below the image that links directly to `data.image_url`
- Style it distinctly from the existing "View in Design History" button (e.g., outline style)
- Both buttons sit side by side or stacked: "Download Design" (primary) + "View in Design History" (secondary)

### Why not attach the file?
- Increases email size significantly (images can be 1-5MB)
- More likely to trigger spam filters
- Adds latency (must fetch the image before sending)
- The image is already publicly accessible via URL — a link is simpler and more reliable

### File
- `supabase/functions/send-email/index.ts` (template update + redeploy)

