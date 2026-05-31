// M6: Deterministic PRNG seeded per design job.
// Same job_id + same inputs → same genome mutation + category bias outcomes,
// which makes the pipeline reproducible for debugging and A/B comparison.

/** Mulberry32 — fast 32-bit seeded PRNG, good enough for non-crypto branching. */
export function createSeededRng(seedSource: string | number): () => number {
  let seed = typeof seedSource === "number" ? seedSource >>> 0 : hashString(String(seedSource));
  return function next(): number {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

/** Pick a random element from a non-empty array using the supplied rng. */
export function rngPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
