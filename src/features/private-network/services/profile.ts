import type { Publisher } from "../types";

/** Fields that count towards profile completeness (optional school/workplace/affiliations excluded). */
export const COMPLETENESS_FIELDS: Array<keyof Publisher> = [
  "display_name", "occupation", "location_country", "age_bracket", "languages", "interests",
  "communities", "industries", "platforms", "audience_size_estimate", "audience_geographies", "audience_age_brackets",
];

const filled = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : typeof v === "number" ? Number.isFinite(v) : typeof v === "string" ? v.trim().length > 0 : v != null;

export function profileCompleteness(p: Partial<Publisher> | null | undefined): { percent: number; missing: string[] } {
  if (!p) return { percent: 0, missing: COMPLETENESS_FIELDS.map(String) };
  const missing = COMPLETENESS_FIELDS.filter((k) => !filled(p[k])).map(String);
  return { percent: Math.round(((COMPLETENESS_FIELDS.length - missing.length) / COMPLETENESS_FIELDS.length) * 100), missing };
}

/** "a, b ,, c" → ["a","b","c"], deduped case-insensitively, capped. */
export function parseList(s: string, max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(",")) {
    const v = raw.trim().slice(0, 80);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export const formatNgn = (n: number | null | undefined) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
