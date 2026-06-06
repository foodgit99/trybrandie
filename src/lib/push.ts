import { getToken, onMessage } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { getMessagingIfSupported, VAPID_PUBLIC_KEY } from "./firebase";

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: "no-sw" | "no-notification" | "ios-not-installed" | "unsupported" };

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "unsupported" };
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "no-sw" };
  if (!("Notification" in window)) return { supported: false, reason: "no-notification" };

  // iOS web push requires the site to be added to Home Screen first.
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore - iOS Safari only
    (typeof navigator !== "undefined" && (navigator as any).standalone === true);
  if (isIOS && !isStandalone) return { supported: false, reason: "ios-not-installed" };

  return { supported: true };
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function registerMessagingSW(): Promise<ServiceWorkerRegistration> {
  // Reuse existing registration if already present.
  const existing = await navigator.serviceWorker.getRegistration("/firebase-cloud-messaging-push-scope");
  if (existing) return existing;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/firebase-cloud-messaging-push-scope",
  });
}

export async function enablePush(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const support = detectPushSupport();
  if (!support.supported) return { ok: false, error: support.reason };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "permission-denied" };

  const messaging = await getMessagingIfSupported();
  if (!messaging) return { ok: false, error: "messaging-unsupported" };

  let registration: ServiceWorkerRegistration;
  try {
    registration = await registerMessagingSW();
  } catch (e) {
    return { ok: false, error: `sw-register-failed: ${(e as Error).message}` };
  }

  let token: string | null = null;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (e) {
    return { ok: false, error: `get-token-failed: ${(e as Error).message}` };
  }
  if (!token) return { ok: false, error: "no-token" };

  // Register token with backend.
  const { error: invokeErr } = await supabase.functions.invoke("push-register", {
    body: {
      token,
      platform: navigator.platform || "web",
      user_agent: navigator.userAgent || "",
    },
  });
  if (invokeErr) return { ok: false, error: `register-failed: ${invokeErr.message}` };

  try { localStorage.setItem("brandie:push:token", token); } catch { /* ignore */ }

  // Foreground messages -> native browser notification (SW only fires for background).
  try {
    onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || (payload?.data as any)?.title || "Brandie";
      const body = payload?.notification?.body || (payload?.data as any)?.body || "";
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icons/icon-192.png" });
      }
    });
  } catch { /* ignore */ }

  return { ok: true, token };
}

export function hasLocalPushToken(): boolean {
  try { return !!localStorage.getItem("brandie:push:token"); } catch { return false; }
}
