/* Firebase Cloud Messaging service worker.
 * NOTE: This worker is messaging-only. It does NOT cache the app shell.
 * It is safe to keep alongside any future app-shell strategy.
 */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBSIg4O1KVySYIAQ5LNfmfBTXyFsNzlcJw",
  authDomain: "brandie-c2914.firebaseapp.com",
  projectId: "brandie-c2914",
  storageBucket: "brandie-c2914.firebasestorage.app",
  messagingSenderId: "1036344414574",
  appId: "1:1036344414574:web:ec12f872b6d27164b0317f",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Brandie";
  const body = payload?.notification?.body || payload?.data?.body || "";
  const url = payload?.data?.url || "/";
  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
    tag: payload?.data?.tag || "brandie-default",
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        try {
          await c.focus();
          if ("navigate" in c) await c.navigate(target);
          return;
        } catch (_) { /* try next */ }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
