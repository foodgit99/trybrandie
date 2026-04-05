// Model fallback chain for AI gateway calls
// If primary model fails, automatically falls back to alternative models

export interface ModelFallbackConfig {
  primary: string;
  fallbacks: string[];
}

// Pre-defined fallback chains for different use cases
export const MODEL_CHAINS = {
  /** Strategic reasoning — high-fidelity tasks (briefs, genomes, copy) */
  reasoning: {
    primary: "google/gemini-3.1-pro-preview",
    fallbacks: ["google/gemini-2.5-pro", "openai/gpt-5-mini"],
  },
  /** Fast/lightweight tasks (extraction, classification, summarisation) */
  fast: {
    primary: "google/gemini-2.5-flash-lite",
    fallbacks: ["google/gemini-2.5-flash", "openai/gpt-5-nano"],
  },
  /** Chat/conversational */
  chat: {
    primary: "google/gemini-3-flash-preview",
    fallbacks: ["google/gemini-2.5-flash", "openai/gpt-5-mini"],
  },
  /** Image generation (Fast) */
  imageFast: {
    primary: "google/gemini-2.5-flash-image",
    fallbacks: ["google/gemini-3.1-flash-image-preview"],
  },
  /** Image generation (HD) */
  imageHD: {
    primary: "google/gemini-3-pro-image-preview",
    fallbacks: ["google/gemini-3.1-flash-image-preview"],
  },
} as const;

/**
 * Execute an AI gateway call with automatic model fallback.
 * Tries the primary model first, then each fallback on failure.
 * 
 * @param chain - The model fallback configuration
 * @param buildRequest - Function that takes a model name and returns the fetch options
 * @param gatewayUrl - The AI gateway URL
 * @param apiKey - The API key
 * @returns The successful Response object
 */
export async function callWithFallback(
  chain: ModelFallbackConfig,
  buildRequest: (model: string) => { body: string; headers?: Record<string, string> },
  gatewayUrl: string,
  apiKey: string,
): Promise<{ response: Response; modelUsed: string }> {
  const models = [chain.primary, ...chain.fallbacks];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const req = buildRequest(model);
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...req.headers,
        },
        body: req.body,
      });

      // Don't fallback on client errors (4xx) — those won't resolve with a different model
      if (response.ok || response.status === 402 || response.status === 400) {
        if (model !== chain.primary) {
          console.log(`[ModelFallback] Succeeded with fallback model: ${model} (primary: ${chain.primary})`);
        }
        return { response, modelUsed: model };
      }

      // Retry on 429 or 5xx with next model
      if (response.status === 429 || response.status >= 500) {
        console.warn(`[ModelFallback] ${model} failed with ${response.status}, trying next...`);
        lastError = new Error(`${model} returned ${response.status}`);
        continue;
      }

      // Other error — return as-is
      return { response, modelUsed: model };
    } catch (e) {
      console.warn(`[ModelFallback] ${model} threw error:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error("All models in fallback chain failed");
}
