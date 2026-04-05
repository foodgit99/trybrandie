// Shared input sanitisation utility for Brandie edge functions
// Strips prompt injection patterns and dangerous content from user-provided text

/**
 * Sanitise user-provided text before injecting into LLM context.
 * Removes common prompt injection patterns, HTML/script tags, and
 * truncates to a safe maximum length.
 */
export function sanitise(input: string, maxLength = 5000): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = input;

  // 1. Strip HTML/script tags
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // 2. Strip common prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?|context)/gi,
    /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
    /you\s+are\s+now\s+(a|an)\s+/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<<\/SYS>>/gi,
    /```system/gi,
    /\bDAN\s+mode\b/gi,
    /do\s+anything\s+now/gi,
    /jailbreak/gi,
    /bypass\s+(your\s+)?(safety|guard|filter|rules?)/gi,
    /pretend\s+(you\s+)?(are|have)\s+no\s+(rules?|restrictions?|limits?)/gi,
    /act\s+as\s+if\s+(you\s+)?(have|had)\s+no\s+(rules?|restrictions?)/gi,
  ];

  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, "[filtered]");
  }

  // 3. Collapse excessive whitespace
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");
  cleaned = cleaned.replace(/\s{10,}/g, "    ");

  // 4. Truncate to max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + "…[truncated]";
  }

  return cleaned.trim();
}

/**
 * Sanitise a scraped webpage content string with stricter limits.
 * Scraped content is higher-risk for injection since we don't control it.
 */
export function sanitiseScrapedContent(input: string, maxLength = 3000): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = sanitise(input, maxLength);

  // Additional patterns for scraped content
  // Strip markdown-embedded instructions
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  // Strip base64-encoded content (potential payload hiding)
  cleaned = cleaned.replace(/data:[a-zA-Z]+\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]{100,}/g, "[base64-removed]");

  return cleaned;
}

/**
 * Sanitise a URL input — basic validation and cleanup.
 */
export function sanitiseUrl(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (trimmed.length < 4 || trimmed.length > 2048) return null;

  // Must start with http/https or be a bare domain
  if (!/^https?:\/\//i.test(trimmed) && !/^[a-zA-Z0-9]/.test(trimmed)) return null;

  // Block javascript: and data: URIs
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;

  return trimmed;
}
