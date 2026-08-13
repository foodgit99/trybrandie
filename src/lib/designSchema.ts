// Brandie Design Schema (BDS) v1 — client mirror.
//
// This is the browser-side twin of supabase/functions/_shared/design-schema.ts.
// It owns the same types, the same normaliser and the same patch semantics so
// the studio canvas can preview and edit a design document without a round
// trip. The server remains the source of truth for the final PNG render.
// Keep both files in sync when BDS_VERSION changes.

export const BDS_VERSION = 1;

export type ElementRole =
  | "headline"
  | "subhead"
  | "body"
  | "cta"
  | "product"
  | "logo"
  | "decor"
  | "background";

export type ElementType = "text" | "image" | "logo" | "shape" | "button";

export interface BaseElement {
  id: string;
  type: ElementType;
  role: ElementRole;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
  z?: number;
  locked?: boolean;
}

export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  font?: "heading" | "body";
  fontSize: number;
  weight?: number;
  color: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  maxLines?: number;
  minFontSize?: number;
}

export interface ImageElement extends BaseElement {
  type: "image" | "logo";
  source: string;
  fit?: "cover" | "contain";
  radius?: number;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape?: "rect" | "ellipse" | "line";
  fill?: string;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface ButtonElement extends BaseElement {
  type: "button";
  content: string;
  fill: string;
  textColor: string;
  fontSize: number;
  weight?: number;
  radius?: number;
  align?: "left" | "center" | "right";
}

export type DesignElement = TextElement | ImageElement | ShapeElement | ButtonElement;

export interface DesignBackground {
  type: "solid" | "gradient" | "image";
  color?: string;
  color2?: string;
  angle?: number;
  source?: string;
  overlay?: { color: string; opacity: number };
}

export interface DesignSchema {
  schema_version: number;
  canvas: { width: number; height: number };
  background: DesignBackground;
  fonts?: { heading?: string; body?: string };
  assets?: Record<string, string>;
  elements: DesignElement[];
  meta?: Record<string, unknown>;
}

export const ALLOWED_FONTS = ["Poppins", "DM Serif Display", "Bebas Neue", "Space Mono"];

/** CSS font stack for a BDS font family (Google fonts loaded by the page). */
export function fontStack(family?: string): string {
  switch (family) {
    case "DM Serif Display":
      return `'DM Serif Display', Georgia, serif`;
    case "Bebas Neue":
      return `'Bebas Neue', Impact, sans-serif`;
    case "Space Mono":
      return `'Space Mono', ui-monospace, monospace`;
    default:
      return `'Poppins', system-ui, sans-serif`;
  }
}

export function headingFontFor(personality?: string | null): string {
  switch ((personality || "").toLowerCase()) {
    case "editorial":
      return "DM Serif Display";
    case "street":
      return "Bebas Neue";
    case "futuristic":
      return "Space Mono";
    default:
      return "Poppins";
  }
}

/** Resolve an element source (asset key or absolute URL) to a URL. */
export function resolveAsset(schema: DesignSchema, source?: string): string | null {
  if (!source) return null;
  if (/^https?:\/\//.test(source) || source.startsWith("data:")) return source;
  return schema.assets?.[source] || null;
}

// ---------------------------------------------------------------- normalise

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function colour(v: unknown, fallback: string): string {
  if (typeof v === "string") {
    const s = v.trim();
    if (HEX.test(s)) return s;
    if (/^(rgba?|hsla?)\(/.test(s)) return s;
    if (s === "transparent" || s === "none") return "none";
  }
  return fallback;
}

function num(v: unknown, fallback: number, min?: number, max?: number): number {
  let n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) n = fallback;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return Math.round(n * 100) / 100;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Repairs and clamps an untrusted schema into a renderable BDS v1 document. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseSchema(input: any, opts?: { width?: number; height?: number }): DesignSchema {
  const raw = input && typeof input === "object" ? input : {};
  const width = num(raw?.canvas?.width ?? opts?.width, opts?.width ?? 1080, 256, 4096);
  const height = num(raw?.canvas?.height ?? opts?.height, opts?.height ?? 1080, 256, 4096);

  const bgRaw = raw?.background && typeof raw.background === "object" ? raw.background : {};
  const bgType: DesignBackground["type"] = ["solid", "gradient", "image"].includes(bgRaw.type)
    ? bgRaw.type
    : "solid";
  const background: DesignBackground = {
    type: bgType,
    color: colour(bgRaw.color, "#FFFFFF"),
    ...(bgType === "gradient"
      ? { color2: colour(bgRaw.color2, "#000000"), angle: num(bgRaw.angle, 180, 0, 360) }
      : {}),
    ...(bgType === "image" ? { source: str(bgRaw.source) } : {}),
    ...(bgRaw.overlay && typeof bgRaw.overlay === "object"
      ? {
          overlay: {
            color: colour(bgRaw.overlay.color, "#000000"),
            opacity: num(bgRaw.overlay.opacity, 0.3, 0, 1),
          },
        }
      : {}),
  };

  const headingFont = ALLOWED_FONTS.includes(str(raw?.fonts?.heading)) ? str(raw.fonts.heading) : "Poppins";
  const bodyFont = ALLOWED_FONTS.includes(str(raw?.fonts?.body)) ? str(raw.fonts.body) : "Poppins";

  const assets: Record<string, string> = {};
  if (raw?.assets && typeof raw.assets === "object") {
    for (const [k, v] of Object.entries(raw.assets)) {
      if (typeof v === "string" && /^https?:\/\//.test(v)) assets[k] = v;
    }
  }

  const seen = new Set<string>();
  const elements: DesignElement[] = [];
  const list = Array.isArray(raw?.elements) ? raw.elements : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list.forEach((e: any, i: number) => {
    if (!e || typeof e !== "object") return;
    const type: ElementType = ["text", "image", "logo", "shape", "button"].includes(e.type) ? e.type : "text";
    let id = str(e.id) || `${type}_${i + 1}`;
    id = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || `el_${i + 1}`;
    while (seen.has(id)) id = `${id}_${i}`;
    seen.add(id);

    const role: ElementRole = [
      "headline",
      "subhead",
      "body",
      "cta",
      "product",
      "logo",
      "decor",
      "background",
    ].includes(e.role)
      ? e.role
      : type === "button"
        ? "cta"
        : type === "logo"
          ? "logo"
          : "decor";

    const base: BaseElement = {
      id,
      type,
      role,
      x: num(e.x ?? e.position?.x, 0, -width, width * 2),
      y: num(e.y ?? e.position?.y, 0, -height, height * 2),
      w: num(e.w ?? e.width ?? e.size?.width, Math.round(width * 0.5), 8, width * 2),
      h: num(e.h ?? e.height ?? e.size?.height, Math.round(height * 0.15), 8, height * 2),
      rotation: num(e.rotation, 0, -180, 180),
      opacity: num(e.opacity, 1, 0, 1),
      z: num(e.z ?? e.zIndex ?? i + 1, i + 1, 0, 999),
      ...(e.locked === true ? { locked: true } : {}),
    };

    if (type === "text") {
      const content = str(e.content ?? e.text).slice(0, 400);
      if (!content.trim()) return;
      elements.push({
        ...base,
        type: "text",
        content,
        font: e.font === "body" ? "body" : "heading",
        fontSize: num(e.fontSize, Math.round(height * 0.06), 8, Math.round(height * 0.5)),
        weight: [400, 500, 600, 700].includes(Number(e.weight)) ? Number(e.weight) : 700,
        color: colour(e.color, "#111111"),
        align: ["left", "center", "right"].includes(e.align) ? e.align : "left",
        lineHeight: num(e.lineHeight, 1.15, 0.8, 2.2),
        letterSpacing: num(e.letterSpacing, 0, -5, 20),
        uppercase: e.uppercase === true,
        maxLines: num(e.maxLines, 4, 1, 12),
        minFontSize: num(e.minFontSize, 14, 8, 400),
      } as TextElement);
      return;
    }

    if (type === "image" || type === "logo") {
      const source = str(e.source ?? e.src ?? e.url);
      if (!source) return;
      elements.push({
        ...base,
        type,
        source,
        fit: e.fit === "contain" || type === "logo" ? "contain" : "cover",
        radius: num(e.radius, 0, 0, 999),
      } as ImageElement);
      return;
    }

    if (type === "shape") {
      elements.push({
        ...base,
        type: "shape",
        shape: ["rect", "ellipse", "line"].includes(e.shape) ? e.shape : "rect",
        fill: colour(e.fill, "#000000"),
        radius: num(e.radius, 0, 0, 999),
        stroke: e.stroke ? colour(e.stroke, "none") : "none",
        strokeWidth: num(e.strokeWidth, 0, 0, 40),
      } as ShapeElement);
      return;
    }

    const label = str(e.content ?? e.text ?? e.label).slice(0, 60);
    if (!label.trim()) return;
    elements.push({
      ...base,
      type: "button",
      content: label,
      fill: colour(e.fill, "#111111"),
      textColor: colour(e.textColor, "#FFFFFF"),
      fontSize: num(e.fontSize, Math.round(height * 0.032), 8, 200),
      weight: [400, 500, 600, 700].includes(Number(e.weight)) ? Number(e.weight) : 700,
      radius: num(e.radius, 999, 0, 999),
      align: ["left", "center", "right"].includes(e.align) ? e.align : "center",
    } as ButtonElement);
  });

  elements.sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  const out: DesignSchema = {
    schema_version: BDS_VERSION,
    canvas: { width, height },
    background,
    fonts: { heading: headingFont, body: bodyFont },
    assets,
    elements,
    ...(raw?.meta && typeof raw.meta === "object" ? { meta: raw.meta } : {}),
  };

  enforceContrast(out);
  return out;
}

// ---------------------------------------------------------------- contrast

function rgbOf(hex?: string): [number, number, number] | null {
  if (!hex || typeof hex !== "string" || !HEX.test(hex.trim())) return null;
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a?: string, b?: string): number | null {
  const ra = rgbOf(a), rb = rgbOf(b);
  if (!ra || !rb) return null;
  const la = luminance(ra), lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a?: string, b?: string): string {
  const ra = rgbOf(a), rb = rgbOf(b);
  if (!ra) return b || "#FFFFFF";
  if (!rb) return a || "#FFFFFF";
  const m = ra.map((v, i) => Math.round((v + rb[i]) / 2));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function backdropFor(schema: DesignSchema, el: DesignElement): string | null {
  const under = schema.elements
    .filter((o) => o.id !== el.id && o.type === "shape")
    .filter((o) => (o.z ?? 0) <= (el.z ?? 0) && (o.opacity ?? 1) >= 0.6)
    .filter((o) => {
      const ox = Math.min(o.x + o.w, el.x + el.w) - Math.max(o.x, el.x);
      const oy = Math.min(o.y + o.h, el.y + el.h) - Math.max(o.y, el.y);
      return ox > el.w * 0.5 && oy > el.h * 0.5;
    })
    .sort((a, b) => (b.z ?? 0) - (a.z ?? 0))[0] as ShapeElement | undefined;
  if (under && under.fill && under.fill !== "none") return under.fill;

  const bg = schema.background;
  if (bg.type === "image") return bg.overlay ? bg.overlay.color : null;
  if (bg.type === "gradient") return mix(bg.color, bg.color2);
  return bg.color || "#FFFFFF";
}

/** Flips unreadable text/button colours (mirrors the server guard). */
export function enforceContrast(schema: DesignSchema): DesignSchema {
  for (const el of schema.elements) {
    if (el.type === "text") {
      const t = el as TextElement;
      const back = backdropFor(schema, el);
      if (!back) continue;
      const r = ratio(t.color, back);
      if (r !== null && r < 3) {
        t.color = (ratio("#FFFFFF", back) ?? 0) >= (ratio("#111111", back) ?? 0) ? "#FFFFFF" : "#111111";
      }
    } else if (el.type === "button") {
      const b = el as ButtonElement;
      const fill = b.fill && b.fill !== "none" ? b.fill : backdropFor(schema, el);
      if (fill) {
        const r = ratio(b.textColor, fill);
        if (r !== null && r < 3) {
          b.textColor = (ratio("#FFFFFF", fill) ?? 0) >= (ratio("#111111", fill) ?? 0) ? "#FFFFFF" : "#111111";
        }
      }
      const back = backdropFor(schema, el);
      if (back && b.fill && b.fill !== "none") {
        const vs = ratio(b.fill, back);
        if (vs !== null && vs < 1.25) {
          b.fill = (ratio("#FFFFFF", back) ?? 0) >= (ratio("#111111", back) ?? 0) ? "#FFFFFF" : "#111111";
          b.textColor = (ratio("#111111", b.fill) ?? 0) >= (ratio("#FFFFFF", b.fill) ?? 0) ? "#111111" : "#FFFFFF";
        }
      }
    }
  }
  return schema;
}


/** Bounding-box overlap report between text/cta elements. */
export function overlapReport(schema: DesignSchema): string[] {
  const boxes = schema.elements.filter((e) => e.type === "text" || e.type === "button");
  const issues: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 8 && oy > 8) issues.push(`${a.id} overlaps ${b.id}`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------- patching

export interface SchemaPatchOp {
  op: "set" | "delete" | "duplicate" | "reorder";
  id: string;
  props?: Record<string, unknown>;
  z?: number;
}

/** Applies edit ops to a schema and re-normalises. Unknown ids are ignored. */
export function applyPatch(schema: DesignSchema, ops: SchemaPatchOp[]): DesignSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const next: any = JSON.parse(JSON.stringify(schema));
  for (const op of ops || []) {
    if (!op || typeof op !== "object") continue;
    if (op.id === "canvas" && op.op === "set" && op.props) {
      Object.assign(next.canvas, op.props);
      continue;
    }
    if (op.id === "background" && op.op === "set" && op.props) {
      Object.assign(next.background, op.props);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idx = next.elements.findIndex((e: any) => e.id === op.id);
    if (idx < 0) continue;
    if (op.op === "set" && op.props) {
      Object.assign(next.elements[idx], op.props);
    } else if (op.op === "delete") {
      next.elements.splice(idx, 1);
    } else if (op.op === "duplicate") {
      const copy = JSON.parse(JSON.stringify(next.elements[idx]));
      copy.id = `${copy.id}_copy`;
      copy.x += 24;
      copy.y += 24;
      copy.z = (copy.z ?? 1) + 1;
      next.elements.push(copy);
    } else if (op.op === "reorder" && typeof op.z === "number") {
      next.elements[idx].z = op.z;
    }
  }
  return normaliseSchema(next, { width: next.canvas?.width, height: next.canvas?.height });
}

/** Convenience: set props on a single element. */
export function setElementProps(
  schema: DesignSchema,
  id: string,
  props: Record<string, unknown>,
): DesignSchema {
  return applyPatch(schema, [{ op: "set", id, props }]);
}

export const CANVAS_SIZES: { value: string; label: string }[] = [
  { value: "1080x1080", label: "Square 1:1" },
  { value: "1080x1350", label: "Portrait 4:5" },
  { value: "1080x1920", label: "Story 9:16" },
  { value: "1200x628", label: "Landscape" },
];

export function sizeOf(canvasSize: string): { w: number; h: number } {
  const [w, h] = canvasSize.split("x").map((n) => parseInt(n, 10));
  return { w: w || 1080, h: h || 1080 };
}
