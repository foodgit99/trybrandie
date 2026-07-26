import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { Loader2, Plus, Send, MessageSquare, ExternalLink, Check, Download, Copy, FileText, FileJson, Files, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STAGE_AGENTS, agentChannel, type StageAgentId } from "@/lib/stageAgents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportAgentTranscript, copyTranscriptToClipboard } from "@/lib/agentTranscript";

type Thread = { id: string; title: string | null; last_message_at: string | null };

const TOOL_LABELS: Record<string, string> = {
  get_brand_snapshot: "Reading your brand",
  get_blueprint: "Checking your blueprint",
  get_recent_designs: "Reviewing recent designs",
  query_holidays: "Scanning upcoming holidays",
  query_trends: "Pulling trend intel",
  create_campaign: "Creating a campaign",
  create_content_pillar: "Adding a content pillar",
  draft_content_idea: "Drafting a content idea",
  schedule_idea: "Scheduling an idea",
  update_idea_caption: "Rewriting a caption",
  enqueue_design_generation: "Queueing a design",
};
const humanTool = (t: string) => TOOL_LABELS[t] ?? t.replace(/_/g, " ");

export default function AgentChatPanel({
  agentId,
  brandId,
  userId,
}: {
  agentId: StageAgentId;
  brandId?: string;
  userId?: string;
}) {
  const agent = STAGE_AGENTS[agentId];
  const { toast } = useToast();
  const channel = agentChannel(agentId);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const freshThreadRef = useRef<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [invited, setInvited] = useState<StageAgentId[]>([]);
  const [showPanelPicker, setShowPanelPicker] = useState(false);
  const [roundtableBusy, setRoundtableBusy] = useState(false);
  const isRoundtable = invited.length > 0;
  const panelIds = useMemo(() => [agentId, ...invited], [agentId, invited]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  // Load thread list for this agent + brand.
  const loadThreads = async (selectNewest = true) => {
    if (!userId || !brandId) return;
    const { data } = await supabase
      .from("agent_conversations")
      .select("id,title,last_message_at")
      .eq("user_id", userId)
      .eq("brand_id", brandId)
      .eq("channel", channel)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(30);
    const rows = (data ?? []) as Thread[];
    setThreads(rows);
    if (selectNewest) {
      const next = rows[0]?.id ?? null;
      threadIdRef.current = next;
      setThreadId(next);
    }
  };

  useEffect(() => {
    setBooting(true);
    loadThreads().finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, brandId, agentId]);

  // Load messages for the active thread.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!threadId) {
        setInitialMessages([]);
        return;
      }
      // A thread we just created in this session already has its messages in
      // useChat state — re-hydrating from the DB would duplicate them.
      if (threadId === freshThreadRef.current) return;
      const { data } = await supabase
        .from("agent_messages")
        .select("id,role,parts,created_at")
        .eq("conversation_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setInitialMessages(
        (data ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: (Array.isArray(m.parts) ? m.parts : [])
            .filter((p: any) => p?.type === "text")
            .map((p: any) => p.text)
            .join(""),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stage-agent`;

  const { messages, append, isLoading, setMessages } = useChat({
    id: `${agentId}:${threadId ?? "new"}`,
    api: apiUrl,
    initialMessages,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        }
      : undefined,
    experimental_prepareRequestBody: ({ messages: ms }) => ({
      agent: agentId,
      messages: ms,
      brand_id: brandId,
      conversation_id: threadIdRef.current,
    }),
    onFinish: async (message) => {
      const tid = threadIdRef.current;
      if (tid && userId) {
        await supabase.from("agent_messages").insert({
          conversation_id: tid,
          user_id: userId,
          role: "assistant",
          parts: (message as any).parts ?? [{ type: "text", text: message.content }],
        });
        await supabase
          .from("agent_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", tid);
        loadThreads(false);
      }
      composerRef.current?.focus();
    },
    onError: (err) =>
      toast({
        title: `${agent.role} hit an error`,
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      }),
  });

  useEffect(() => {
    setMessages(initialMessages as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    composerRef.current?.focus();
  }, [threadId, agentId]);

  const ensureThread = async (firstText: string): Promise<string | null> => {
    if (threadIdRef.current) return threadIdRef.current;
    if (!userId || !brandId) return null;
    const { data, error } = await supabase
      .from("agent_conversations")
      .insert({
        user_id: userId,
        brand_id: brandId,
        channel,
        title: firstText.slice(0, 60),
        last_message_at: new Date().toISOString(),
      })
      .select("id,title,last_message_at")
      .single();
    if (error || !data) {
      toast({ title: "Couldn't start a conversation", description: error?.message, variant: "destructive" });
      return null;
    }
    threadIdRef.current = data.id;
    freshThreadRef.current = data.id;
    setThreadId(data.id);
    setThreads((prev) => [data as Thread, ...prev]);
    return data.id;
  };

  const runRoundtable = async (text: string) => {
    const tid = await ensureThread(text);
    if (!tid) return;
    setRoundtableBusy(true);
    const userMsg = { id: `u-${Date.now()}`, role: "user", content: text } as any;
    setMessages([...(messages as any[]), userMsg] as any);
    try {
      if (userId) {
        await supabase.from("agent_messages").insert({
          conversation_id: tid,
          user_id: userId,
          role: "user",
          parts: [{ type: "text", text }],
        });
      }
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-roundtable`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session?.access_token}`,
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
          },
          body: JSON.stringify({
            brand_id: brandId,
            conversation_id: tid,
            question: text,
            agents: panelIds,
            history: (messages as any[]).slice(-8).map((m: any) => ({
              role: m.role,
              text: m.content ?? "",
            })),
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Roundtable failed");

      const sections = (payload.turns ?? []).map(
        (t: any) => `### ${t.role}\n\n${t.text}`,
      );
      if (payload.synthesis) {
        sections.push(`### 🧭 Reconciled call\n\n${payload.synthesis}`);
      }
      const content = sections.join("\n\n---\n\n");
      setMessages([
        ...(messages as any[]),
        userMsg,
        { id: `rt-${Date.now()}`, role: "assistant", content },
      ] as any);
      if (userId) {
        await supabase.from("agent_messages").insert({
          conversation_id: tid,
          user_id: userId,
          role: "assistant",
          parts: [{ type: "text", text: content }],
        });
        await supabase
          .from("agent_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", tid);
        loadThreads(false);
      }
    } catch (e: any) {
      toast({ title: "Roundtable failed", description: e?.message, variant: "destructive" });
    } finally {
      setRoundtableBusy(false);
      composerRef.current?.focus();
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading || roundtableBusy) return;
    if (!brandId) {
      toast({ title: "Pick a brand first", variant: "destructive" });
      return;
    }
    setInput("");
    if (isRoundtable) {
      await runRoundtable(text);
      return;
    }
    const tid = await ensureThread(text);
    if (!tid) return;
    if (userId) {
      await supabase.from("agent_messages").insert({
        conversation_id: tid,
        user_id: userId,
        role: "user",
        parts: [{ type: "text", text }],
      });
    }
    await append({ role: "user", content: text });
  };

  const newThread = () => {
    threadIdRef.current = null;
    freshThreadRef.current = null;
    setThreadId(null);
    setInitialMessages([]);
    setMessages([]);
    composerRef.current?.focus();
  };

  const approveAction = async (actionId: string, retryText: string) => {
    setApproving(actionId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session?.access_token}`,
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({
          agent: agentId,
          brand_id: brandId,
          conversation_id: threadIdRef.current,
          approved_action_ids: [actionId],
          messages: [...messages, { role: "user", content: retryText }],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Approved", description: "The agent is carrying it out." });
      await append({ role: "user", content: retryText });
    } catch (e: any) {
      toast({ title: "Approval failed", description: e?.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const activeThread = threads.find((t) => t.id === threadId) ?? null;
  const hasSaved = Boolean(activeThread);

  const runExport = async (format: "md" | "txt" | "json", scope: "current" | "all") => {
    const list = scope === "all" ? threads : activeThread ? [activeThread] : [];
    if (list.length === 0) {
      toast({ title: "Nothing to export yet", description: "Send a message first." });
      return;
    }
    setExporting(true);
    try {
      const name = await exportAgentTranscript({
        agentRole: agent.role,
        brandId,
        threads: list,
        format,
      });
      toast({ title: "Transcript exported", description: name });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const runCopy = async () => {
    if (!activeThread) {
      toast({ title: "Nothing to copy yet", description: "Send a message first." });
      return;
    }
    setExporting(true);
    try {
      await copyTranscriptToClipboard({ agentRole: agent.role, brandId, threads: [activeThread] });
      toast({ title: "Transcript copied", description: "Markdown is on your clipboard." });
    } catch (e: any) {
      toast({ title: "Copy failed", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (!isLoading) return null;
    const last = [...messages].reverse().find((m: any) => m.role === "assistant") as any;
    const active = (last?.toolInvocations ?? []).find((t: any) => t.state !== "result");
    if (active) return `${humanTool(active.toolName)}…`;
    if (!last?.content?.trim()) return "Thinking…";
    return "Writing…";
  }, [messages, isLoading]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Threads */}
      <div className="px-4 py-2 border-b border-border/60 flex items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
        <Button size="sm" variant="outline" className="h-7 shrink-0 rounded-full text-[11px]" onClick={newThread}>
          <Plus className="h-3 w-3 mr-1" /> New
        </Button>
        {booting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                threadIdRef.current = t.id;
                freshThreadRef.current = null;
                setThreadId(t.id);
              }}
              className={cn(
                "shrink-0 max-w-[160px] truncate rounded-full border px-3 py-1 text-[11px] transition-colors",
                t.id === threadId
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-secondary/60",
              )}
              title={t.title ?? "Conversation"}
            >
              <MessageSquare className="h-3 w-3 mr-1 inline-block align-[-1px]" />
              {t.title ?? "Conversation"}
            </button>
          ))
        )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 rounded-full text-[11px]"
              disabled={exporting}
              title="Save or export this conversation"
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              <span className="ml-1 hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-[11px]">This conversation</DropdownMenuLabel>
            <DropdownMenuItem disabled={!hasSaved} onClick={() => runExport("md", "current")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Download Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasSaved} onClick={() => runExport("txt", "current")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Download plain text (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasSaved} onClick={() => runExport("json", "current")}>
              <FileJson className="h-3.5 w-3.5 mr-2" /> Download JSON (.json)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!hasSaved} onClick={runCopy}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Copy transcript
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px]">
              All conversations ({threads.length})
            </DropdownMenuLabel>
            <DropdownMenuItem disabled={threads.length === 0} onClick={() => runExport("md", "all")}>
              <Files className="h-3.5 w-3.5 mr-2" /> Knowledge pack (.md)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={threads.length === 0} onClick={() => runExport("json", "all")}>
              <FileJson className="h-3.5 w-3.5 mr-2" /> Full archive (.json)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant={isRoundtable ? "default" : "ghost"}
          className="h-7 shrink-0 rounded-full text-[11px]"
          onClick={() => setShowPanelPicker((v) => !v)}
          title="Invite other agents into this chat"
        >
          <Users className="h-3 w-3" />
          <span className="ml-1 hidden sm:inline">
            {isRoundtable ? `Roundtable · ${panelIds.length}` : "Roundtable"}
          </span>
        </Button>
      </div>

      {/* Roundtable panel picker */}
      {showPanelPicker && (
        <div className="px-4 py-2.5 border-b border-border/60 bg-muted/30 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Invite teammates to answer alongside your {agent.role}. Each one speaks in turn, reads
            the others, and a facilitator reconciles any conflicts into one call.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-foreground bg-foreground text-background px-2.5 py-1 text-[11px]">
              {agent.role} (host)
            </span>
            {Object.values(STAGE_AGENTS)
              .filter((a) => a.id !== agentId)
              .map((a) => {
                const on = invited.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() =>
                      setInvited((prev) =>
                        on ? prev.filter((x) => x !== a.id) : prev.length >= 3 ? prev : [...prev, a.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary/60",
                    )}
                  >
                    {on && <Check className="h-3 w-3 mr-1 inline-block align-[-1px]" />}
                    {a.role}
                  </button>
                );
              })}
          </div>
          {invited.length > 0 && (
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground flex-1">
                Roundtable is read-only — agents advise but won't schedule or change anything.
              </p>
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setInvited([])}>
                Clear
              </Button>
            </div>
          )}
        </div>
      )}


      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{agent.blurb}</p>
            <div className="space-y-1.5">
              {agent.quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border hover:bg-secondary/60 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
            {agent.link && (
              <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                <Link to={agent.link.to}>
                  {agent.link.label}
                  <ExternalLink className="h-3 w-3 ml-1.5" />
                </Link>
              </Button>
            )}
          </div>
        )}

        {messages.map((m: any, i: number) => (
          <div key={m.id ?? i} className="space-y-2">
            {m.role === "user" ? (
              <div className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm">
                {m.content}
              </div>
            ) : (
              <>
                {(m.toolInvocations ?? []).map((t: any) => {
                  const pending =
                    t.state === "result" &&
                    t.result?.requires_approval &&
                    t.result?.action_id;
                  return (
                    <div key={t.toolCallId} className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {t.state === "result" ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        <span>{humanTool(t.toolName)}</span>
                      </div>
                      {pending && (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-[11px] flex-1">
                            {t.result?.message ?? "Needs your approval."}
                          </p>
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            disabled={approving === t.result.action_id}
                            onClick={() =>
                              approveAction(t.result.action_id, "Approved — go ahead.")
                            }
                          >
                            {approving === t.result.action_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {m.content && (
                  <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {statusLabel && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {statusLabel}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={composerRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={`Message your ${agent.role}…`}
            className="resize-none min-h-[44px] max-h-32 rounded-2xl"
          />
          <Button
            size="icon"
            onClick={() => send()}
            disabled={isLoading || !input.trim()}
            className="rounded-2xl h-11 w-11 shrink-0"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
