

# Plan: Use Veo 3.1 Audio + Simplify VideoProjectViewer

## Context
Veo 3.1 (`veo-3.1-generate-preview`) already generates video with built-in audio — sound effects, ambient music, and even dialogue/voiceover when prompted. No separate TTS or music service is needed. We just need to enhance the prompts and clean up the UI.

## Changes

### 1. `supabase/functions/video-render/index.ts` — Enhance prompts for audio
- Add audio direction to the brand directive: instruct Veo to include voiceover narration, background music matching brand mood, and sound effects
- For each scene's enriched prompt, append audio instructions: "Include professional voiceover narrating the scene. Add brand-appropriate background music that is [brand vibe]. Include subtle sound effects."
- This requires no API changes — Veo 3.1 handles audio natively

### 2. `src/components/VideoProjectViewer.tsx` — Simplify to video-first viewer
- **Remove** the storyboard `VideoPreview` component entirely from this dialog
- **Remove** "Render Video (5 credits)" button — rendering is now automatic from studio
- **Remove** "Download Scenes" button — users only get the final video
- When `render_status === "rendered"` and `rendered_video_url` exists: show video player + download + delete buttons only
- When `render_status === "rendering"`: show a spinner with "Rendering your video…" message
- When `render_status === "pending"` or `"failed"`: show a status card with appropriate message
- Keep: intent badges, strategy summary, caption/hashtags, delete button

### 3. No database changes needed
Veo embeds audio directly in the MP4 — no separate audio columns required.

### 4. No new edge functions needed
ElevenLabs integration is not required. Veo handles everything.

## Files Changed
1. `supabase/functions/video-render/index.ts` — add audio instructions to prompts
2. `src/components/VideoProjectViewer.tsx` — remove storyboard UI, show only final video

