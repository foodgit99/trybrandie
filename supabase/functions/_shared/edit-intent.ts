// Deterministic edit-intent routing for the Blueprint composer.
// Replaces an LLM classification call: keyword rules decide whether a user's
// instruction touches wording (text), appearance (visual), or the idea itself
// (strategy). Unmatched instructions fall back to "text", matching the previous
// AI-fallback behaviour.

export type EditKind = "text" | "visual" | "strategy";

const STRATEGY_RE =
  /\b(swap|replace|different (?:idea|post|angle|concept|topic)|new (?:idea|post|angle|concept|topic)|another idea|change (?:the )?(?:idea|topic|angle|format|audience|category|pillar|goal|campaign)|instead of this post|make it a (?:carousel|video|reel|single post)|carousel|reel|series|target (?:a )?(?:different|new) audience|reposition|rethink|start over|scrap)\b/i;

const VISUAL_RE =
  /\b(colou?r\w*|palette|hex|font|typeface|typography|layout|composition|background|bg|image|photo|picture|visual|graphic|design|style|aesthetic|crop|frame|margin|padding|spacing|contrast|brighter|darker|lighter|bolder look|logo placement|product shot|template|gradient|shadow|texture|dark mode|light mode|portrait|square|story size)\b/i;

const TEXT_RE =
  /\b(caption|copy|headline|subheadline|sub[- ]?head|wording|word it|text|rewrite|reword|rephrase|shorter|longer|tighten|punchier|tone|grammar|typo|spelling|cta|call to action|hashtag\w*|emoji\w*|say|mention|add the price|title)\b/i;

/**
 * Classify an instruction and derive a title/prompt from it.
 * Precedence: strategy > visual > text. Strategy wins because "make it a
 * carousel with brighter colours" needs the full cascade, not a recolour.
 */
export function classifyEditIntent(instruction: string): {
  kind: EditKind;
  rewritten_title: string;
  rewritten_prompt: string;
} {
  const raw = String(instruction ?? "").trim();
  const kind: EditKind = STRATEGY_RE.test(raw)
    ? "strategy"
    : VISUAL_RE.test(raw)
      ? "visual"
      : TEXT_RE.test(raw)
        ? "text"
        : "text";

  return {
    kind,
    rewritten_title: toTitle(raw),
    rewritten_prompt: raw.slice(0, 1000),
  };
}

function toTitle(instruction: string): string {
  // First sentence/clause, stripped of leading command verbs, capped at 60 chars.
  const firstClause = instruction.split(/[.\n!?]/)[0].trim();
  const cleaned = firstClause
    .replace(/^(please\s+)?(can you\s+)?(kindly\s+)?/i, "")
    .replace(/^(make|change|swap|turn|update|edit|rewrite|set|use|add|remove)\s+(it|this|the post|the design)?\s*/i, "")
    .trim();
  const base = cleaned || firstClause || instruction;
  const title = base.charAt(0).toUpperCase() + base.slice(1);
  return title.slice(0, 60);
}
