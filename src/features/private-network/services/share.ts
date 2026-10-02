/**
 * User-initiated sharing helpers. Nothing here posts on the user's behalf:
 * opening a share sheet or WhatsApp is NOT proof of posting. Earnings only follow
 * operator-verified proof.
 */
export function redirectUrl(token: string, base = import.meta.env.VITE_SUPABASE_URL as string) {
  return `${base}/functions/v1/private-network-redirect?t=${encodeURIComponent(token)}`;
}

export function shareText(caption: string | null | undefined, link: string) {
  const c = (caption ?? "").trim();
  return c ? `${c}\n\n${link}` : link;
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported" | "failed";

type NavLike = { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };

export function canShareFiles(nav: NavLike | undefined, file: File | null): boolean {
  if (!nav?.share || !nav.canShare || !file) return false;
  try { return nav.canShare({ files: [file] }); } catch { return false; }
}

/** Opens the OS share sheet. "shared" only means the sheet completed — not that a post went live. */
export async function nativeShare(nav: NavLike | undefined, data: { file: File | null; text: string }): Promise<ShareOutcome> {
  if (!nav?.share) return "unsupported";
  const payload: ShareData = canShareFiles(nav, data.file) ? { files: [data.file as File], text: data.text } : { text: data.text };
  try {
    await nav.share(payload);
    return "shared";
  } catch (e: any) {
    return e?.name === "AbortError" ? "cancelled" : "failed";
  }
}

export function fileNameFor(code: string, mediaType: "image" | "video", mime?: string) {
  const ext = mime?.includes("png") ? "png" : mime?.includes("webp") ? "webp" : mediaType === "video" ? (mime?.includes("quicktime") ? "mov" : "mp4") : "jpg";
  return `${code.toLowerCase()}.${ext}`;
}

export async function fetchAsFile(url: string, name: string): Promise<File> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the media file.");
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type || "application/octet-stream" });
}
