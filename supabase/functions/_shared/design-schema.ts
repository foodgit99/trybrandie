// Brandie Design Schema (BDS) v1 — the structured, editable design document.
//
// Principle: a Brandie design is DATA first and pixels second. This module owns
// the schema types, a strict validator/normaliser, and the deterministic
// renderer (schema -> SVG -> PNG). Nothing here talks to the database.
//
// The client mirror lives at src/lib/designSchema.ts (types + normalise +
// patch application). Keep both in sync when the schema version changes.

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

export type ElementType = "text" | "image" | "logo" | "shape" | "button" | "group";

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
  source: string; // asset key or absolute URL
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

// ---------------------------------------------------------------- fonts

export const FONT_FILES: Record<string, { url: string; weight: number }[]> = {
  Poppins: [
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf", weight: 400 },
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-SemiBold.ttf", weight: 600 },
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf", weight: 700 },
  ],
  "DM Serif Display": [
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf", weight: 400 },
  ],
  "Bebas Neue": [
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf", weight: 400 },
  ],
  "Space Mono": [
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/spacemono/SpaceMono-Regular.ttf", weight: 400 },
    { url: "https://raw.githubusercontent.com/google/fonts/main/ofl/spacemono/SpaceMono-Bold.ttf", weight: 700 },
  ],
};

export const ALLOWED_FONTS = Object.keys(FONT_FILES);

/** genome font_personality -> heading family (body stays Poppins for legibility) */
export function headingFontFor(personality?: string | null): string {
  switch ((personality || "").toLowerCase()) {
    case "editorial":
      return "DM Serif Display";
    case "street":
      return "Bebas Neue";
    case "futuristic":
      return "Space Mono";
    case "corporate":
    case "friendly":
    default:
      return "Poppins";
  }
}

// Average glyph width as a fraction of font size — used for wrapping/fitting.
const WIDTH_FACTOR: Record<string, number> = {
  Poppins: 0.55,
  "DM Serif Display": 0.48,
  "Bebas Neue": 0.42,
  "Space Mono": 0.6,
};

// ---------------------------------------------------------------- validation

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

/**
 * Repairs and clamps an untrusted schema (LLM output or a client patch) into a
 * renderable BDS v1 document. Never throws — unknown fields are dropped,
 * out-of-range values are clamped, unusable elements are removed.
 */
export function normaliseSchema(input: any, opts?: { width?: number; height?: number }): DesignSchema {
  const raw = input && typeof input === "object" ? input : {};
  const width = num(raw?.canvas?.width ?? opts?.width, opts?.width ?? 1080, 256, 4096);
  const height = num(raw?.canvas?.height ?? opts?.height, opts?.height ?? 1080, 256, 4096);

  const bgRaw = raw?.background && typeof raw.background === "object" ? raw.background : {};
  const bgType = ["solid", "gradient", "image"].includes(bgRaw.type) ? bgRaw.type : "solid";
  const background: DesignBackground = {
    type: bgType,
    color: colour(bgRaw.color, "#FFFFFF"),
    ...(bgType === "gradient" ? { color2: colour(bgRaw.color2, "#000000"), angle: num(bgRaw.angle, 180, 0, 360) } : {}),
    ...(bgType === "image" ? { source: str(bgRaw.source) } : {}),
    ...(bgRaw.overlay && typeof bgRaw.overlay === "object"
      ? { overlay: { color: colour(bgRaw.overlay.color, "#000000"), opacity: num(bgRaw.overlay.opacity, 0.3, 0, 1) } }
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

  list.forEach((e: any, i: number) => {
    if (!e || typeof e !== "object") return;
    const type: ElementType = ["text", "image", "logo", "shape", "button"].includes(e.type) ? e.type : "text";
    let id = str(e.id) || `${type}_${i + 1}`;
    id = id.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40) || `el_${i + 1}`;
    while (seen.has(id)) id = `${id}_${i}`;
    seen.add(id);

    const role: ElementRole = [
      "headline", "subhead", "body", "cta", "product", "logo", "decor", "background",
    ].includes(e.role) ? e.role : type === "button" ? "cta" : type === "logo" ? "logo" : "decor";

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

    // button
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

// ------------------------------------------------------- contrast guard

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

function ratio(a: string, b: string): number | null {
  const ra = rgbOf(a), rb = rgbOf(b);
  if (!ra || !rb) return null;
  const la = luminance(ra), lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(a: string, b: string): string {
  const ra = rgbOf(a), rb = rgbOf(b);
  if (!ra) return b;
  if (!rb) return a;
  const m = ra.map((v, i) => Math.round((v + rb[i]) / 2));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Backdrop colour behind an element: topmost opaque shape under it, else page background. */
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
  if (bg.type === "gradient") return mix(bg.color || "#FFFFFF", bg.color2 || "#000000");
  return bg.color || "#FFFFFF";
}

/**
 * Guarantees readable copy: any text/button label that fails a 3:1 contrast
 * ratio against what sits behind it is flipped to white or near-black. Without
 * this, a model that omits `color` renders near-black text on a dark canvas
 * and the design looks blank.
 */
export function enforceContrast(schema: DesignSchema): DesignSchema {
  for (const el of schema.elements) {
    if (el.type === "text") {
      const t = el as TextElement;
      const back = backdropFor(schema, el);
      if (!back) continue;
      const r = ratio(t.color, back);
      if (r !== null && r < 3) {
        const white = ratio("#FFFFFF", back) ?? 0;
        const dark = ratio("#111111", back) ?? 0;
        t.color = white >= dark ? "#FFFFFF" : "#111111";
      }
    } else if (el.type === "button") {
      const b = el as ButtonElement;
      const fill = b.fill && b.fill !== "none" ? b.fill : backdropFor(schema, el);
      if (!fill) continue;
      const r = ratio(b.textColor, fill);
      if (r !== null && r < 3) {
        const white = ratio("#FFFFFF", fill) ?? 0;
        const dark = ratio("#111111", fill) ?? 0;
        b.textColor = white >= dark ? "#FFFFFF" : "#111111";
      }
      // A button whose fill matches the canvas behind it disappears.
      const back = backdropFor(schema, el);
      if (back && b.fill && b.fill !== "none") {
        const vs = ratio(b.fill, back);
        if (vs !== null && vs < 1.25) {
          const white = ratio("#FFFFFF", back) ?? 0;
          b.fill = white >= (ratio("#111111", back) ?? 0) ? "#FFFFFF" : "#111111";
          b.textColor = (ratio("#111111", b.fill) ?? 0) >= (ratio("#FFFFFF", b.fill) ?? 0)
            ? "#111111"
            : "#FFFFFF";
        }
      }
    }
  }
  return schema;
}


/** Bounding-box overlap report between text/cta elements — layout sanity check. */
export function overlapReport(schema: DesignSchema): string[] {
  const boxes = schema.elements.filter((e) => e.type === "text" || e.type === "button");
  const issues: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 8 && oy > 8) issues.push(`${a.id} overlaps ${b.id}`);
    }
  }
  return issues;
}

// ------------------------------------------------------------ patching

export interface SchemaPatchOp {
  op: "set" | "delete" | "duplicate" | "reorder";
  id: string;
  props?: Record<string, unknown>;
  z?: number;
}

/** Applies edit ops to a schema and re-normalises. Unknown ids are ignored. */
export function applyPatch(schema: DesignSchema, ops: SchemaPatchOp[]): DesignSchema {
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

// ------------------------------------------------------------ text fitting

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(
  text: string,
  fontSize: number,
  family: string,
  boxWidth: number,
  letterSpacing: number,
): string[] {
  const factor = WIDTH_FACTOR[family] ?? 0.55;
  const per = fontSize * factor + letterSpacing;
  const maxChars = Math.max(4, Math.floor(boxWidth / Math.max(1, per)));
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxChars) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word.length > maxChars ? word.slice(0, maxChars) : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

/** Shrink-to-fit: returns the largest size (>= minFontSize) fitting the box. */
export function fitText(el: TextElement, family: string): { fontSize: number; lines: string[] } {
  const content = el.uppercase ? el.content.toUpperCase() : el.content;
  const maxLines = el.maxLines ?? 4;
  const minSize = el.minFontSize ?? 14;
  const lh = el.lineHeight ?? 1.15;
  let size = el.fontSize;
  let lines = wrapText(content, size, family, el.w, el.letterSpacing ?? 0);
  while (size > minSize && (lines.length > maxLines || lines.length * size * lh > el.h)) {
    size = Math.max(minSize, size - 2);
    lines = wrapText(content, size, family, el.w, el.letterSpacing ?? 0);
  }
  if (lines.length > maxLines) lines = lines.slice(0, maxLines);
  return { fontSize: size, lines };
}

// ------------------------------------------------------------ SVG renderer

/**
 * Builds an SVG string for the schema. `resolved` maps asset keys / URLs to
 * data URIs (resvg cannot fetch remote hrefs), produced by inlineAssets().
 */
export function schemaToSvg(schema: DesignSchema, resolved: Record<string, string>): string {
  const { width, height } = schema.canvas;
  const headingFamily = schema.fonts?.heading || "Poppins";
  const bodyFamily = schema.fonts?.body || "Poppins";
  const defs: string[] = [];
  const body: string[] = [];

  const bg = schema.background;
  if (bg.type === "gradient") {
    const a = ((bg.angle ?? 180) * Math.PI) / 180;
    const x2 = (0.5 + Math.sin(a) / 2).toFixed(4);
    const y2 = (0.5 - Math.cos(a) / 2).toFixed(4);
    const x1 = (0.5 - Math.sin(a) / 2).toFixed(4);
    const y1 = (0.5 + Math.cos(a) / 2).toFixed(4);
    defs.push(
      `<linearGradient id="bgGrad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${bg.color}"/><stop offset="1" stop-color="${bg.color2}"/></linearGradient>`,
    );
    body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGrad)"/>`);
  } else if (bg.type === "image") {
    const href = resolved[bg.source || ""] || "";
    body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${bg.color || "#FFFFFF"}"/>`);
    if (href) {
      body.push(
        `<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" href="${href}"/>`,
      );
    }
  } else {
    body.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${bg.color || "#FFFFFF"}"/>`);
  }
  if (bg.overlay) {
    body.push(
      `<rect x="0" y="0" width="${width}" height="${height}" fill="${bg.overlay.color}" opacity="${bg.overlay.opacity}"/>`,
    );
  }

  const ordered = [...schema.elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  ordered.forEach((el, i) => {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const transform = el.rotation ? ` transform="rotate(${el.rotation} ${cx} ${cy})"` : "";
    const op = el.opacity !== undefined && el.opacity < 1 ? ` opacity="${el.opacity}"` : "";
    const open = `<g${transform}${op}>`;

    if (el.type === "shape") {
      const s = el as ShapeElement;
      const stroke = s.stroke && s.stroke !== "none" ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth || 1}"` : "";
      if (s.shape === "ellipse") {
        body.push(`${open}<ellipse cx="${cx}" cy="${cy}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${s.fill}"${stroke}/></g>`);
      } else if (s.shape === "line") {
        body.push(
          `${open}<line x1="${el.x}" y1="${cy}" x2="${el.x + el.w}" y2="${cy}" stroke="${s.fill}" stroke-width="${Math.max(1, s.strokeWidth || el.h)}"/></g>`,
        );
      } else {
        body.push(
          `${open}<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${Math.min(s.radius || 0, Math.min(el.w, el.h) / 2)}" fill="${s.fill}"${stroke}/></g>`,
        );
      }
      return;
    }

    if (el.type === "image" || el.type === "logo") {
      const im = el as ImageElement;
      const href = resolved[im.source] || (/^data:/.test(im.source) ? im.source : "");
      if (!href) return;
      const clipId = `clip_${i}`;
      const r = Math.min(im.radius || 0, Math.min(el.w, el.h) / 2);
      defs.push(
        `<clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${r}"/></clipPath>`,
      );
      const par = im.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice";
      body.push(
        `${open}<image x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="${par}" clip-path="url(#${clipId})" href="${href}"/></g>`,
      );
      return;
    }

    if (el.type === "button") {
      const b = el as ButtonElement;
      const r = Math.min(b.radius ?? 999, Math.min(el.w, el.h) / 2);
      const tx = b.align === "left" ? el.x + 24 : b.align === "right" ? el.x + el.w - 24 : cx;
      const anchor = b.align === "left" ? "start" : b.align === "right" ? "end" : "middle";
      body.push(
        `${open}<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${r}" fill="${b.fill}"/>` +
          `<text x="${tx}" y="${cy + b.fontSize * 0.35}" font-family="${headingFamily}" font-size="${b.fontSize}" font-weight="${b.weight || 700}" fill="${b.textColor}" text-anchor="${anchor}" letter-spacing="1">${esc(b.content.toUpperCase())}</text></g>`,
      );
      return;
    }

    const t = el as TextElement;
    const family = t.font === "body" ? bodyFamily : headingFamily;
    const { fontSize, lines } = fitText(t, family);
    const lh = (t.lineHeight ?? 1.15) * fontSize;
    const anchor = t.align === "center" ? "middle" : t.align === "right" ? "end" : "start";
    const tx = t.align === "center" ? cx : t.align === "right" ? el.x + el.w : el.x;
    const blockH = lines.length * lh;
    // Vertically centre the text block inside its box.
    let ty = el.y + (el.h - blockH) / 2 + fontSize * 0.82;
    if (ty < el.y + fontSize * 0.82) ty = el.y + fontSize * 0.82;
    const tspans = lines
      .map((ln, li) => `<tspan x="${tx}" y="${(ty + li * lh).toFixed(2)}">${esc(ln)}</tspan>`)
      .join("");
    body.push(
      `${open}<text font-family="${family}" font-size="${fontSize}" font-weight="${t.weight || 700}" fill="${t.color}" text-anchor="${anchor}"${t.letterSpacing ? ` letter-spacing="${t.letterSpacing}"` : ""}>${tspans}</text></g>`,
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
}

// ------------------------------------------------------------ asset inlining

async function fetchDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 8_000_000) return null;
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Resolves every asset key / URL referenced by the schema into a data URI. */
export async function inlineAssets(schema: DesignSchema): Promise<Record<string, string>> {
  const wanted = new Set<string>();
  if (schema.background.type === "image" && schema.background.source) wanted.add(schema.background.source);
  for (const el of schema.elements) {
    if (el.type === "image" || el.type === "logo") wanted.add((el as ImageElement).source);
  }
  const resolved: Record<string, string> = {};
  await Promise.all(
    [...wanted].map(async (key) => {
      if (/^data:/.test(key)) {
        resolved[key] = key;
        return;
      }
      const url = schema.assets?.[key] || (/^https?:\/\//.test(key) ? key : null);
      if (!url) return;
      const dataUri = await fetchDataUri(url);
      if (dataUri) resolved[key] = dataUri;
    }),
  );
  return resolved;
}

// ------------------------------------------------------------ PNG renderer

let wasmReady: Promise<void> | null = null;
const fontCache = new Map<string, Uint8Array>();
// deno-lint-ignore no-explicit-any
let ResvgCtor: any = null;

const RESVG_WASM = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

async function ensureResvg(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      const mod = await import("https://esm.sh/@resvg/resvg-wasm@2.6.2");
      // deno-lint-ignore no-explicit-any
      await (mod as any).initWasm(fetch(RESVG_WASM));
      // deno-lint-ignore no-explicit-any
      ResvgCtor = (mod as any).Resvg;
    })();
  }
  await wasmReady;
}

async function fontBuffers(families: string[]): Promise<Uint8Array[]> {
  const urls: string[] = [];
  for (const f of families) for (const spec of FONT_FILES[f] || []) urls.push(spec.url);
  const out: Uint8Array[] = [];
  await Promise.all(
    urls.map(async (url) => {
      const cached = fontCache.get(url);
      if (cached) {
        out.push(cached);
        return;
      }
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = new Uint8Array(await res.arrayBuffer());
      fontCache.set(url, buf);
      out.push(buf);
    }),
  );
  return out;
}

/** schema -> PNG bytes. Throws on renderer failure so callers can fall back. */
export async function renderSchemaToPng(schema: DesignSchema): Promise<Uint8Array> {
  const [resolved] = await Promise.all([inlineAssets(schema)]);
  const svg = schemaToSvg(schema, resolved);
  await ensureResvg();
  const families = [schema.fonts?.heading || "Poppins", schema.fonts?.body || "Poppins"];
  const buffers = await fontBuffers([...new Set(families)]);
  if (!buffers.length) throw new Error("no font buffers available");
  const resvg = new ResvgCtor(svg, {
    fitTo: { mode: "width", value: schema.canvas.width },
    font: {
      fontBuffers: buffers,
      loadSystemFonts: false,
      defaultFontFamily: schema.fonts?.body || "Poppins",
    },
  });
  return resvg.render().asPng();
}
