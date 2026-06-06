## Goal
Make Brandie installable on iOS/Android home screens and enable Firebase Cloud Messaging (FCM) web push for transactional moments (e.g. "Today's post is ready", low credits, autopilot done).

## Scope split

**Phase A — Installable (manifest only).** No app-shell service worker, no offline caching. Per Lovable's PWA rules, this avoids preview-breaking stale caches.

**Phase B — FCM web push.** Adds a dedicated `firebase-messaging-sw.js` (messaging-only, not an app-shell cache), a token-registration UI surface, an edge function to send notifications, and a `push_subscriptions` table. The two service workers don't conflict — FCM's worker has its own scope and file.

---

## Phase A — Installable

### Files
- `public/manifest.webmanifest` — `name: "Brandie"`, `short_name: "Brandie"`, `theme_color: #2B2D33` (charcoal), `background_color: #FAF8F5` (beige), `display: "standalone"`, `start_url: "/"`, `id: "/"`, `scope: "/"`, icon entries (192, 512, 512 maskable).
- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` — generated from the PNG you'll attach (square, ≥512).
- `index.html` — add `<link rel="manifest">`, `<meta name="theme-color" content="#2B2D33">`, `<link rel="apple-touch-icon" href="/icons/icon-192.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="Brandie">`.

No `vite-plugin-pwa`, no `sw.js`, no registration code. Lovable's cache headers handle freshness.

---

## Phase B — FCM Push Notifications

### Prereqs you'll provide
1. **Firebase project** with Cloud Messaging enabled.
2. **Web app config** (publishable — goes in code): `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`.
3. **VAPID public key** (publishable — in code).
4. **Firebase Admin service account JSON** (secret — stored as `FIREBASE_SERVICE_ACCOUNT_JSON` for the edge function to mint OAuth tokens and call FCM HTTP v1 API).

I'll request `FIREBASE_SERVICE_ACCOUNT_JSON` via the secrets tool once you confirm the Firebase project is set up.

### New files
- `public/firebase-messaging-sw.js` — minimal messaging worker. Initializes Firebase with the web config and handles `onBackgroundMessage` to render a notification. **No precaching, no app-shell behavior, no `caches.*` API.** Scope: `/firebase-cloud-messaging-push-scope`.
- `src/lib/firebase.ts` — initializes Firebase app + Messaging in the browser (lazy, only after user opts in).
- `src/lib/push.ts` — `enablePush()`: request `Notification.permission`, register the messaging SW at `/firebase-messaging-sw.js`, call `getToken({ vapidKey, serviceWorkerRegistration })`, POST token to edge function.
- `src/components/PushOptInCard.tsx` — small opt-in card with a CTA "Get post-ready alerts". Rendered on the Cockpit (`/cockpit`) for users who haven't subscribed and whose browser supports `Notification`. Dismissible.
- `supabase/functions/push-register/index.ts` — authenticated; upserts `(user_id, token, platform, user_agent)` into `push_subscriptions`.
- `supabase/functions/push-send/index.ts` — service-role; accepts `{ user_id, title, body, url }`, mints a Google OAuth token from `FIREBASE_SERVICE_ACCOUNT_JSON`, POSTs to FCM HTTP v1 for each token, prunes `404/UNREGISTERED` tokens.

### DB migration
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs" ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.push_subscriptions(user_id);
```

### Where push gets triggered (Phase B+ wiring)
Initially I'll only wire **one** trigger end-to-end to prove the pipeline:
- `content-autopilot` calls `push-send` after a daily post is ready → notification "Today's post is ready • Tap to review".

The other triggers (low credits, weekly briefing) are out of scope for this turn and can be added later by calling `push-send` from those functions.

---

## iOS caveat (worth flagging)
- iOS 16.4+ supports web push **only for apps installed to Home Screen first**. The opt-in card will detect iOS and instruct: "Add Brandie to your Home Screen, open it from the icon, then enable alerts." Android/desktop Chrome work without install.

## Out of scope
- Offline app shell / `vite-plugin-pwa` (per Lovable rules — adds preview risk without user-stated need).
- Topic subscriptions, rich images in notifications, in-app foreground toast bridge (can add later).
- Native iOS/Android via Capacitor.

## Order of execution (build mode)
1. Phase A (manifest, icons, head tags) — works immediately after you attach the PNG.
2. You confirm Firebase project + share web config & VAPID key in chat.
3. I request `FIREBASE_SERVICE_ACCOUNT_JSON` secret.
4. Phase B (table → edge functions → frontend SW + opt-in → autopilot trigger).
