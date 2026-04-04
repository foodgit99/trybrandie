

# Plan: Remove All Video UI References

## Summary
Remove all video-related buttons, tabs, routes, and UI elements from the frontend while keeping the backend edge functions and database tables intact (for when you get the API key).

## Changes

### 1. `src/pages/Index.tsx` — Remove Video Studio quick action
- Remove the `Video` icon import from lucide-react
- Remove the "Video Studio" entry from the `quickActions` array (line 166)

### 2. `src/pages/DesignStudio.tsx` — Remove video mode entirely
- Remove imports: `VideoGuidedFlow`, `VideoPreview`
- Remove all video state variables (`isVideoMode`, `videoFlowComplete`, `videoLoading`, `videoScenes`, etc.)
- Remove `handleVideoGenerate`, video polling logic (`videoRenderPollRef`, `startVideoPolling`, `stopVideoPolling`)
- Remove the video mode conditional block (lines ~1240-1263) that renders `VideoGuidedFlow` and `VideoPreview`
- Remove "Video Studio" text from the header title conditional

### 3. `src/pages/DesignHistory.tsx` — Remove Videos tab
- Remove `VideoProjectViewer` import and component usage
- Remove video-related state (`selectedVideoProject`, `videoViewerOpen`)
- Remove `video_projects` query
- Remove the "Videos" `TabsTrigger` (line 285-287)
- Remove the entire "Videos" `TabsContent` block (lines 452-533)
- Remove unused imports (`Film`, `Clock`, `Target`)
- Remove the `initialTab` logic that checks for `?tab=videos`

### 4. `src/pages/ContentHub.tsx` — Remove video format option
- In `handleFormatAction`: remove the `if (format === "video")` branch — treat video ideas as graphics instead
- Remove the `🎬 Video` `SelectItem` from the content format dropdown (line 1366)
- In the calendar view: remove the video color mapping and video format icon/label references

### 5. No backend changes
Edge functions (`video-render`, `video-studio`) and database tables remain untouched for future use.

## Files Changed
1. `src/pages/Index.tsx`
2. `src/pages/DesignStudio.tsx`
3. `src/pages/DesignHistory.tsx`
4. `src/pages/ContentHub.tsx`

