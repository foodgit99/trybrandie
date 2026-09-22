// Tiny read-through cache for one-shot AI jobs whose answer only changes when the
// input changes (audience suggestions, competitor discovery, brand analysis).
// Backed by the existing `research_cache` table so no new schema is needed.

async function hash(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns the cached result for `key`, or null. `category` groups cache entries
 * (e.g. "audience_suggest"); `key` should be the exact prompt input.
 */
export async function readAiCache<T>(supabase: any, category: string, key: string): Promise<T | null> {
  try {
    const query_hash = await hash(key);
    const { data } = await supabase
      .from("research_cache")
      .select("result")
      .eq("category_id", category)
      .eq("query_hash", query_hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!data?.result) return null;
    return JSON.parse(data.result) as T;
  } catch (e) {
    console.log(`[ai-cache] read failed (${category}):`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Stores a result for `key`. `ttlDays` defaults to 7. */
export async function writeAiCache(
  supabase: any,
  category: string,
  key: string,
  result: unknown,
  ttlDays = 7,
): Promise<void> {
  try {
    const query_hash = await hash(key);
    await supabase.from("research_cache").upsert(
      {
        category_id: category,
        query_hash,
        query_preview: `${category}:${key.slice(0, 80)}`,
        result: JSON.stringify(result),
        expires_at: new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
      },
      { onConflict: "category_id,query_hash" },
    );
  } catch (e) {
    console.log(`[ai-cache] write failed (${category}):`, e instanceof Error ? e.message : e);
  }
}
