/**
 * V1 match scoring. Each factor is 0–10. Licensing-model factors dominate;
 * raw reach is intentionally absent (distribution is a separate capability).
 */
export const MATCH_WEIGHTS = {
  likeness_suitability: 0.14,
  camera_presence: 0.1,
  category_relevance: 0.12,
  audience_overlap: 0.08,
  brand_personality_fit: 0.1,
  visual_compatibility: 0.06,
  product_demonstrability: 0.08,
  geographic_relevance: 0.06,
  price_audience_fit: 0.05,
  creator_credibility: 0.06,
  naturalness: 0.05,
  production_feasibility: 0.1,
} as const;
export type MatchFactor = keyof typeof MATCH_WEIGHTS;
export const SCORE_VERSION = "v1";

export interface MatchScoreResult {
  total: number | null;
  scoredFactors: number;
  confidence: "High" | "Medium" | "Low" | "Unknown";
}

/** Missing factors are excluded and re-normalised; confidence drops with coverage. */
export function scoreMatch(scores: Partial<Record<MatchFactor, number | null | undefined>>): MatchScoreResult {
  let wsum = 0;
  let acc = 0;
  let n = 0;
  for (const [k, w] of Object.entries(MATCH_WEIGHTS) as [MatchFactor, number][]) {
    const v = scores[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(10, v));
      acc += clamped * w;
      wsum += w;
      n++;
    }
  }
  if (n === 0) return { total: null, scoredFactors: 0, confidence: "Unknown" };
  const total = Math.round((acc / wsum) * 10 * 10) / 10; // 0–100, 1dp
  const coverage = n / Object.keys(MATCH_WEIGHTS).length;
  const confidence = coverage >= 0.8 ? "High" : coverage >= 0.5 ? "Medium" : "Low";
  return { total, scoredFactors: n, confidence };
}
