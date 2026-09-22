// Token budget helpers.
// Every gateway text call used to run with no output ceiling, and several prompts
// injected pretty-printed JSON blobs (indentation is billed whitespace).
// These caps sit comfortably above observed output sizes, so nothing truncates —
// they only stop runaway generations.

export const MAX_TOKENS = {
  /** Small structured/tool JSON: classification, extraction, preference tags. */
  shortJson: 700,
  /** Captions and short copy blocks. */
  caption: 500,
  /** Design copy / creative-director layout schemas. */
  brief: 1600,
  /** Weekly planners, carousel arcs, multi-idea generations. */
  planner: 2200,
  /** Conversational replies (chat + agents). */
  chat: 1800,
  /** Long research / digest synthesis. */
  research: 2600,
} as const;

/** Compact JSON for prompts: no indentation, hard character ceiling. */
export function compactJson(value: unknown, maxChars = 6000): string {
  let s: string;
  try {
    s = JSON.stringify(value) ?? "null";
  } catch {
    s = String(value);
  }
  return s.length > maxChars ? `${s.slice(0, maxChars)}…[truncated]` : s;
}

/** Clamp a free-text field before it enters a prompt. */
export function clampText(value: unknown, maxChars = 600): string {
  const s = String(value ?? "").trim();
  return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s;
}

/** Keep only the fields a model actually needs from a row. */
export function pickFields<T extends Record<string, any>>(row: T, fields: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const v = row?.[f];
    if (v !== undefined && v !== null && v !== "") out[f] = typeof v === "string" ? clampText(v, 400) : v;
  }
  return out;
}
