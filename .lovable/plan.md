

# Chat Image Upload and Design Priority

## Overview
Add the ability for users to attach images through the Design Studio chat. The AI will prioritize these attached images and follow user instructions strictly when generating designs.

## Changes

### 1. Frontend: Image Upload in Chat Input
- Add a paperclip/image button next to the text input in `src/pages/DesignStudio.tsx`
- When clicked, open a file picker (accept images: PNG, JPG, WEBP)
- Upload the selected file to the existing `brand-inspiration` storage bucket under the user's folder
- Show a thumbnail preview of the attached image above the input bar before sending
- Allow removing the attachment before sending
- When sent, include the image URL in the message payload and display it in the chat bubble

### 2. Message Type Update
- Extend the `Message` type to include an optional `attachedImageUrl` field for user-uploaded images (separate from the AI-generated `imageUrl`)
- User messages with attachments render a small thumbnail in the chat bubble

### 3. Edge Function: Accept and Prioritize User Images
- Accept an optional `user_image_url` field in the request body
- When present, pass the user's image as an `image_url` content part to both the Copywriter (brief generation) and the Renderer (image generation) calls
- Update the system prompt to include a critical rule: "The user has attached a reference image. You MUST incorporate this image into the design exactly as instructed. Follow the user's instructions about this image strictly and precisely."
- The user image takes priority alongside the logo -- both are passed as image references

### 4. Prompt Engineering Update
- Add to the CRITICAL RULES in the brand context: "If the user attaches an image, treat it as the primary visual reference. Follow their instructions about it literally."
- In the image generation prompt, explicitly state: "The user has provided a reference image (attached). Incorporate it into the design as the user describes."

## Technical Details

**Files to modify:**
- `src/pages/DesignStudio.tsx` -- add upload button, preview state, send image URL with request
- `supabase/functions/design-studio/index.ts` -- accept `user_image_url`, pass to AI models with priority instructions

**Storage:** Uses existing `brand-inspiration` bucket (public, already configured)

**No database changes needed.**

