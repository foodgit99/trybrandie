

# Plan: Complete Motion Video Pipeline with Audio

## Problem
1. The history page (`VideoProjectViewer`) still shows storyboard scenes, individual scene images, and a "Render Video (5 credits)" button — even for completed videos
2. The current pipeline only generates silent video clips via Veo — no voiceover, music, or sound design

## Solution

### Part 1: Fix VideoProjectViewer (History Page)
Remove the storyboard-first UI. When a video is rendered, show only the final video player. When still pending/rendering, show a progress indicator instead of editable storyboard.

**File: `src/components/VideoProjectViewer.tsx`**
- If `render_status === "rendered"` and `rendered_video_url` exists: show video player + download button only (no storyboard scenes, no "Render Video" button)
- If `render_status === "rendering"`: show progress spinner with "Rendering..." message
- If `render_status === "pending"` or `"failed"`: show a simplified status card (not the full storyboard editor)
- Remove the "Render Video (5 credits)" button entirely — rendering is now automatic from the studio flow
- Remove "Download Scenes" button — users only get the final video

### Part 2: Add Voiceover to Video Pipeline
Generate a voiceover narration for each scene using ElevenLabs TTS, integrated into the `video-render` edge function.

**New edge function: `supabase/functions/elevenlabs-tts/index.ts`**
- Accepts `{ text, voiceId }`, calls ElevenLabs TTS API
- Returns audio as binary MP3
- Requires `ELEVENLABS_API_KEY` secret

**File: `supabase/functions/video-render/index.ts`**
- Before Veo rendering, generate a voiceover script from scene descriptions using AI
- Call ElevenLabs TTS for each scene's narration text
- Upload audio files to storage alongside video files
- Store `audio_url` on each `video_scene` row

### Part 3: Add Background Music
Generate a brand-aligned background music track using ElevenLabs Music API.

**New edge function: `supabase/functions/elevenlabs-music/index.ts`**
- Accepts `{ prompt, duration }`, calls ElevenLabs Music API
- Returns audio as binary MP3

**Integration in `video-render`:**
- Generate a short music track matching the brand's vibe/mood
- Upload to storage and store URL on the `video_project`

### Part 4: Database Changes
- Add `audio_url` column to `video_scenes` table (text, nullable)
- Add `music_url` column to `video_projects` table (text, nullable)
- Add `voiceover_script` column to `video_scenes` table (text, nullable)

### Part 5: Video Player Enhancement
Update `VideoPreview.tsx` rendered state to play video with synced audio tracks (voiceover + music).

## Prerequisite
The `ELEVENLABS_API_KEY` secret must be configured. If not available, we'll need to prompt the user.

## Files Changed
1. `src/components/VideoProjectViewer.tsx` — simplified viewer, no storyboard
2. `src/components/VideoPreview.tsx` — enhanced player with audio
3. `supabase/functions/elevenlabs-tts/index.ts` — new TTS function
4. `supabase/functions/elevenlabs-music/index.ts` — new music function
5. `supabase/functions/video-render/index.ts` — integrate voiceover + music generation
6. Database migration — add audio columns

## Credit Cost
Remains 8 credits total (3 storyboard + 5 render). Audio generation is included in the render cost.

