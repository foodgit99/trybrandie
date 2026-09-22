// Server-side conversation trimming for the agent runtimes.
// The client sends the whole thread on every turn; we resend only the opening
// brief, a one-line digest of the middle, and the most recent turns. Agents keep
// their working memory (recent turns + original ask) without paying for the
// entire transcript each message.

const KEEP_RECENT_DEFAULT = 8;

function textOf(m: any): string {
  if (typeof m?.content === "string") return m.content;
  const parts = m?.parts ?? m?.content;
  if (Array.isArray(parts)) {
    return parts
      .map((p: any) => (typeof p === "string" ? p : p?.text ?? ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/**
 * Trim a UI/core message array. Returns a new array — the input is untouched.
 * Keeps: first user message, a digest of the dropped middle, last N messages.
 */
export function trimHistory<T extends { role?: string }>(
  messages: T[],
  keepRecent: number = KEEP_RECENT_DEFAULT,
): T[] {
  if (!Array.isArray(messages)) return [];
  // The tail must not begin mid tool-call chain; keep a generous window.
  if (messages.length <= keepRecent + 2) return messages.slice();

  const recent = messages.slice(-keepRecent);
  const dropped = messages.slice(0, messages.length - keepRecent);
  const firstUser = dropped.find((m) => m.role === "user");
  const middle = dropped.filter((m) => m !== firstUser);

  const topics = middle
    .filter((m) => m.role === "user")
    .map((m) => textOf(m).replace(/\s+/g, " ").trim().slice(0, 80))
    .filter(Boolean)
    .slice(-6);

  const out: T[] = [];
  if (firstUser) out.push(firstUser);
  if (topics.length) {
    out.push({
      role: "user",
      content: `[earlier in this conversation we covered: ${topics.join(" | ")}]`,
    } as unknown as T);
  }
  return [...out, ...recent];
}
