// Timeout guard utility for wrapping async operations with explicit deadlines

/**
 * Wrap a promise with a timeout. If the promise doesn't resolve within
 * the specified duration, rejects with a TimeoutError.
 * 
 * @param promise - The promise to wrap
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param label - Human-readable label for error messages
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "Operation",
): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

// Default timeout values (in ms)
export const TIMEOUTS = {
  /** Individual AI/LLM call */
  AI_CALL: 30_000,
  /** Image generation call (can be slower) */
  IMAGE_GENERATION: 45_000,
  /** External API call (Firecrawl, etc.) */
  EXTERNAL_API: 20_000,
  /** Full design pipeline end-to-end */
  FULL_PIPELINE: 120_000,
  /** Lightweight extraction/classification */
  FAST_CALL: 15_000,
} as const;
