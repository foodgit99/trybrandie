import { supabase } from "@/integrations/supabase/client";

export type TranscriptThread = {
  id: string;
  title: string | null;
  created_at?: string | null;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  role: string;
  parts: unknown;
  created_at: string;
};

const partsToText = (parts: unknown): string => {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p: any) => {
      if (!p) return "";
      if (p.type === "text" && typeof p.text === "string") return p.text;
      if (p.type === "tool-call" || p.toolName) {
        return `_[used tool: ${String(p.toolName ?? "tool").replace(/_/g, " ")}]_`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

export async function fetchThreadMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("agent_messages")
    .select("id,role,parts,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

export function buildTranscriptMarkdown(opts: {
  agentRole: string;
  brandName?: string;
  threads: { thread: TranscriptThread; messages: MessageRow[] }[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${opts.agentRole} — conversation log`);
  if (opts.brandName) lines.push(`**Brand:** ${opts.brandName}`);
  lines.push(`**Exported:** ${fmt(new Date().toISOString())}`);
  lines.push(`**Conversations:** ${opts.threads.length}`);
  lines.push("");

  for (const { thread, messages } of opts.threads) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${thread.title?.trim() || "Untitled conversation"}`);
    if (thread.last_message_at) lines.push(`_Last activity: ${fmt(thread.last_message_at)}_`);
    lines.push("");
    if (messages.length === 0) {
      lines.push("_No messages._");
      lines.push("");
      continue;
    }
    for (const m of messages) {
      const who = m.role === "user" ? "You" : opts.agentRole;
      const text = partsToText(m.parts).trim();
      if (!text) continue;
      lines.push(`### ${who} · ${fmt(m.created_at)}`);
      lines.push("");
      lines.push(text);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "transcript";

export function downloadTextFile(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportAgentTranscript(opts: {
  agentRole: string;
  brandId?: string;
  threads: TranscriptThread[];
  format: "md" | "txt" | "json";
}): Promise<string> {
  let brandName: string | undefined;
  if (opts.brandId) {
    const { data } = await supabase.from("brands").select("name").eq("id", opts.brandId).maybeSingle();
    brandName = (data as any)?.name ?? undefined;
  }

  const bundles = [] as { thread: TranscriptThread; messages: MessageRow[] }[];
  for (const thread of opts.threads) {
    bundles.push({ thread, messages: await fetchThreadMessages(thread.id) });
  }

  const base = `${slugify(opts.agentRole)}-${brandName ? slugify(brandName) + "-" : ""}${new Date()
    .toISOString()
    .slice(0, 10)}`;

  if (opts.format === "json") {
    const payload = {
      agent: opts.agentRole,
      brand: brandName ?? null,
      exported_at: new Date().toISOString(),
      conversations: bundles.map(({ thread, messages }) => ({
        id: thread.id,
        title: thread.title,
        last_message_at: thread.last_message_at,
        messages: messages.map((m) => ({
          role: m.role,
          created_at: m.created_at,
          text: partsToText(m.parts),
        })),
      })),
    };
    downloadTextFile(`${base}.json`, JSON.stringify(payload, null, 2), "application/json");
    return `${base}.json`;
  }

  const md = buildTranscriptMarkdown({ agentRole: opts.agentRole, brandName, threads: bundles });
  if (opts.format === "txt") {
    const plain = md.replace(/^#{1,6}\s*/gm, "").replace(/[*_`]/g, "");
    downloadTextFile(`${base}.txt`, plain, "text/plain");
    return `${base}.txt`;
  }
  downloadTextFile(`${base}.md`, md);
  return `${base}.md`;
}

export async function copyTranscriptToClipboard(opts: {
  agentRole: string;
  brandId?: string;
  threads: TranscriptThread[];
}): Promise<void> {
  let brandName: string | undefined;
  if (opts.brandId) {
    const { data } = await supabase.from("brands").select("name").eq("id", opts.brandId).maybeSingle();
    brandName = (data as any)?.name ?? undefined;
  }
  const bundles = [] as { thread: TranscriptThread; messages: MessageRow[] }[];
  for (const thread of opts.threads) {
    bundles.push({ thread, messages: await fetchThreadMessages(thread.id) });
  }
  await navigator.clipboard.writeText(
    buildTranscriptMarkdown({ agentRole: opts.agentRole, brandName, threads: bundles }),
  );
}
