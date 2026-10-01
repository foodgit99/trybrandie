/** Denominator-safe ratio. Returns null (→ "No data yet") instead of a misleading 0%. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function formatRatio(r: number | null): string {
  return r === null ? "No data yet" : `${Math.round(r * 1000) / 10}%`;
}

export function formatMoney(v: number | null | undefined, currency = "NGN"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "No data yet";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

/** Exclude test records from any KPI aggregation. */
export function realOnly<T extends { is_test?: boolean | null }>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter((r) => !r.is_test);
}

export function average(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
