// Google Analytics 4 client helpers.
// gtag is bootstrapped in index.html and disabled on Lovable preview/localhost.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    __GA_ID__?: string;
    __GA_DISABLED__?: boolean;
  }
}

function enabled(): boolean {
  return typeof window !== "undefined" && !window.__GA_DISABLED__ && typeof window.gtag === "function";
}

export function gaPageView(path: string, title?: string): void {
  if (!enabled()) return;
  window.gtag!("event", "page_view", {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: title ?? document.title,
  });
}

export function gaEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!enabled()) return;
  window.gtag!("event", name, params);
}

export function gaSetUserId(userId: string | null | undefined): void {
  if (!enabled() || !window.__GA_ID__) return;
  window.gtag!("config", window.__GA_ID__, { user_id: userId ?? undefined });
}
