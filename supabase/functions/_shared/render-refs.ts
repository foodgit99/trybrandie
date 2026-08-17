// Reference image collection + normalisation for gpt-image-2 /v1/images/edits.
// Downloads brand logo, inspiration examples, user-provided images, and prior
// renders, validates them, and returns them as Blobs ready to attach to a
// multipart FormData body.

export type RefRole = "logo" | "inspiration" | "user" | "product" | "previous";

export interface CollectedRef {
  role: RefRole;
  blob: Blob;
  contentType: string;
  sizeKB: number;
  label: string; // human-readable, used in the prompt legend (e.g. "Reference 1 = brand logo")
}

// 1x1 fully transparent PNG. Used as a placeholder when no other reference
// images are available so we can still hit /v1/images/edits (the endpoint
// requires at least one `image[]` part). gpt-image-2 treats this as an empty
// canvas reference; the prompt + output `size` drive the actual render.
const BLANK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8//8/AwAI/AL+XJ8MyAAAAABJRU5ErkJggg==";

const MAX_REF_BYTES = 4 * 1024 * 1024; // 4MB per ref (gpt-image-2 cap is ~25MB; we stay well below)
const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const FETCH_TIMEOUT_MS = 8000;

export function buildBlankCanvasBlob(): Blob {
  const bin = Uint8Array.from(atob(BLANK_PNG_BASE64), (c) => c.charCodeAt(0));
  return new Blob([bin], { type: "image/png" });
}

/**
 * Fetch a single reference image and validate it. Returns null on any failure
 * (network error, timeout, wrong content-type, oversized, empty body).
 */
export async function fetchAndNormalizeRef(
  url: string,
  role: RefRole,
  label: string,
): Promise<CollectedRef | null> {
  if (!url || typeof url !== "string") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      console.log(`[render-refs] ${role} fetch failed: ${resp.status} ${url}`);
      return null;
    }
    let contentType = (resp.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength === 0) {
      console.log(`[render-refs] ${role} empty body: ${url}`);
      return null;
    }
    if (buf.byteLength > MAX_REF_BYTES) {
      console.log(`[render-refs] ${role} oversized (${buf.byteLength} bytes): ${url}`);
      return null;
    }
    // Some CDNs return application/octet-stream; sniff PNG/JPEG/WEBP magic bytes.
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      const sniffed = sniffImageType(buf);
      if (!sniffed) {
        console.log(`[render-refs] ${role} unsupported content-type "${contentType}" and unknown magic: ${url}`);
        return null;
      }
      contentType = sniffed;
    }
    const blob = new Blob([buf], { type: contentType });
    return {
      role,
      blob,
      contentType,
      sizeKB: Math.round(buf.byteLength / 1024),
      label,
    };
  } catch (e) {
    console.log(`[render-refs] ${role} error ${url}:`, e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sniffImageType(buf: Uint8Array): string | null {
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export interface CollectRefsInput {
  logoUrl?: string | null;
  inspirationUrls?: string[];
  userImageUrl?: string | null;
  productImageUrls?: string[];
  previousImageUrl?: string | null;
  /** Max total refs to attach. */
  maxRefs?: number;

}

/**
 * Download all available references in parallel, then return an ordered,
 * deduplicated, capped list. Order matters because the prompt references them
 * by index ("Reference 1 = brand logo …").
 *
 * Priority order:
 *  1. Brand logo  (pixel-exact, must always come first when present)
 *  2. Previous render (for edits — preserves layout)
 *  3. User-uploaded image (hero subject)
 *  4. Gallery photos #1-#3 (real brand assets to feature literally)
 *  5. Product photos #1, #2 (attached even alongside a user image, as
 *     supporting references — real product pixels always beat invented ones)
 */
export async function collectRenderRefs(input: CollectRefsInput): Promise<{
  refs: CollectedRef[];
  skipped: { role: RefRole; url: string }[];
}> {
  const maxRefs = input.maxRefs ?? 7;
  const candidates: { url: string; role: RefRole; label: string }[] = [];

  if (input.logoUrl) {
    candidates.push({ url: input.logoUrl, role: "logo", label: "brand logo (use EXACTLY as provided, do not redraw or recolor)" });
  }
  if (input.previousImageUrl) {
    candidates.push({ url: input.previousImageUrl, role: "previous", label: "previous design (preserve overall layout, apply requested change only)" });
  }
  if (input.userImageUrl) {
    candidates.push({ url: input.userImageUrl, role: "user", label: "user-provided image (use as the primary subject of the design)" });
  }
  for (const insp of (input.inspirationUrls || []).slice(0, 3)) {
    candidates.push({ url: insp, role: "inspiration", label: "brand gallery photo (REAL brand asset — MUST appear in the composition, either with its pixels unchanged or adapted into the scene; never replaced by a generated look-alike, never redrawn or restyled)" });
  }
  for (const prod of (input.productImageUrls || []).slice(0, 2)) {
    candidates.push({ url: prod, role: "product", label: "real product/service photo (MUST appear in the composition — as the hero when the brief allows, otherwise integrated into the scene; keep its actual shape, colours and materials, never substitute a generated product)" });
  }

  // Fetch all in parallel.
  const results = await Promise.all(
    candidates.map((c) =>
      fetchAndNormalizeRef(c.url, c.role, c.label).then((r) => ({ ...c, result: r })),
    ),
  );

  const refs: CollectedRef[] = [];
  const skipped: { role: RefRole; url: string }[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    if (r.result && refs.length < maxRefs) {
      refs.push(r.result);
    } else if (!r.result) {
      skipped.push({ role: r.role, url: r.url });
    }
  }

  return { refs, skipped };
}


/**
 * Build a prompt legend that tells the model what each numbered reference is.
 * Returns an empty string when only the blank canvas is attached.
 */
export function buildRefLegend(refs: CollectedRef[]): string {
  if (refs.length === 0) return "";
  const lines = refs.map((r, i) => `Reference ${i + 1} = ${r.label}.`);
  return [
    "ATTACHED REFERENCE IMAGES (the actual pixel data is provided to you — use them, do not describe them):",
    ...lines,
    "REFERENCE USE RULES (mandatory):",
    "1. The LOGO reference must appear in the final design EXACTLY as supplied — no redraw, recolor or restyle.",
    "2. Every GALLERY and PRODUCT reference supplied is a real brand asset and MUST be used in the design in one of exactly two ways: (A) AS-IS — placed in the composition with its pixels unchanged, crop and scale only; or (B) ADAPTED IN — when the post's content does not allow it as a standalone hero, integrated into the scene (in-context placement, mockup, framed panel, collage tile, held/worn in situ) while the actual subject stays recognisably the same pixels.",
    "3. NEVER generate a look-alike replacement for a supplied gallery or product photo, and never redraw, restyle, recolor or illustrate it.",
    "4. Generate original imagery ONLY for elements no supplied reference covers (backgrounds, textures, abstract shapes, typography).",
    "5. The user/product reference is the hero subject whenever the brief allows one.",
  ].join("\n");

}
