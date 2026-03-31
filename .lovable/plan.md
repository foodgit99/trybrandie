

# Plan: Add Google Veo Video Rendering to Brandie

## Overview
Integrate Google's Veo 3.1 video generation API to render actual MP4 videos from the existing storyboard pipeline. Currently, Brandie generates static scene frames — this adds real video output.

## Architecture

The Veo API is async (long-running operations), so we need a two-phase flow:

```text
User generates storyboard (existing)
       ↓
User clicks "Render Video"
       ↓
Edge function submits scene prompts to Veo API
       ↓
Polls for completion (up to ~5 min per scene)
       ↓
Stitches scene video URLs → stores in Supabase Storage
       ↓
UI shows rendered video player
```

## Prerequisites

A **Google AI API Key** with Veo access enabled is required. This is separate from the Lovable AI key — it's a direct Google Generative AI key. We'll securely store it as a Supabase secret (`GOOGLE_AI_API_KEY`).

## Changes

### 1. Add `GOOGLE_AI_API_KEY` secret
Prompt you to provide your Google AI API key (from Google AI Studio with Veo access enabled).

### 2. New edge function: `supabase/functions/video-render/index.ts`
Handles the Veo rendering pipeline:
- Accepts a `video_project_id` and optional scene indices
- For each scene, calls `POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning` with the scene's visual description + brand context
- Polls `GET https://generativelanguage.googleapis.com/v1beta/{operation_name}` until done
- Downloads the generated video, uploads to Supabase Storage (`designs/video-renders/`)
- Updates `video_scenes` with `video_url` column
- Optionally concatenates all scene clips into a final video URL
- Costs 5 additional credits (on top of the 3 for storyboard)

### 3. Database migration
- Add `video_url text` column to `video_scenes` table
- Add `rendered_video_url text` and `render_status text DEFAULT 'pending'` columns to `video_projects` table

### 4. Update `VideoPreview.tsx`
- When `video_url` exists on a scene, render a `<video>` element instead of `<img>`
- Add a "Render Video" button that triggers the render pipeline
- Show render progress status (submitting → rendering → downloading → complete)

### 5. Update `VideoProjectViewer.tsx`
- Show rendered video player when `rendered_video_url` is available
- Add download button for the final rendered video

### 6. Update `DesignStudio.tsx`
- After storyboard generation completes, show a "Render Video" CTA
- Handle render status polling via Supabase realtime or interval

### 7. Update `supabase/config.toml`
- Add `[functions.video-render]` with `verify_jwt = false`

## Technical Details

**Veo API call pattern:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning
Headers: x-goog-api-key: {GOOGLE_AI_API_KEY}
Body: {
  instances: [{ prompt: "scene visual description..." }],
  parameters: { aspectRatio: "9:16", durationSeconds: 5, sampleCount: 1 }
}
→ Returns { name: "operations/xxx" }

Poll: GET https://generativelanguage.googleapis.com/v1beta/{name}?key={API_KEY}
→ When done=true, extract video data from response
```

**Scenes are rendered sequentially** to avoid rate limits (each takes ~2-5 min). Total render time for a 6-scene video: ~10-20 minutes. The UI will poll for status updates.

**Credit cost:** 5 credits for video render (separate from the 3 for storyboard generation), totalling 8 credits for a complete video project.

