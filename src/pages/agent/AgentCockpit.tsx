import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Send, Plus, Settings, Loader2, CheckCircle2,
  AlertCircle, Undo2, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Conversation {
  id: string;
  title: string | null;
  last_message_at: string;
}

export default function AgentCockpit() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { brand } = useBrand(user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [autonomyEnabled, setAutonomyEnabled] = useState<boolean | null>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const pendingApprovalsRef = useRef<string[]>([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [tokenReady, setTokenReady] = useState<string | null>(null);

  useEffect(() => {
    getAccessToken().then((t) => setTokenReady(t));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setTokenReady(s?.access_token ?? null));
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !brand?.id) return;
    (async () => {
      const [{ data: convs }, { data: settings }] = await Promise.all([
        supabase.from("agent_conversations").select("id,title,last_message_at")
          .eq("user_id", user.id).eq("brand_id", brand.id)
          .order("last_message_at", { ascending: false }).limit(50),
        supabase.from("agent_settings").select("autonomy_enabled")
          .eq("user_id", user.id).eq("brand_id", brand.id).maybeSingle(),
      ]);
      setConversations(convs ?? []);
      setAutonomyEnabled(settings?.autonomy_enabled ?? false);
    })();
  }, [user, brand?.id]);

  useEffect(() => {
    if (!threadId || !user) { setInitialMessages([]); return; }
    setLoadingThread(true);
    supabase.from("agent_messages").select("id,role,parts,created_at")
      .eq("conversation_id", threadId).eq("user_id", user.id).order("created_at")
      .then(({ data }) => {
        const msgs = (data ?? []).map((m: any) => {
          const textPart = (m.parts ?? []).find((p: any) => p.type === "text");
          return {
            id: m.id,
            role: m.role,
            content: textPart?.text ?? "",
            parts: m.parts ?? [{ type: "text", text: textPart?.text ?? "" }],
          };
        });
        setInitialMessages(msgs);
        setLoadingThread(false);
      });
  }, [threadId, user]);

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strategist-agent`;

  const { messages, append, isLoading, error, setMessages } = useChat({
    id: threadId,
    api: apiUrl,
    initialMessages,
    headers: tokenReady ? {
      Authorization: `Bearer ${tokenReady}`,
      apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    } : undefined,
    body: {
      brand_id: brand?.id,
      conversation_id: threadId,
    },
    experimental_prepareRequestBody: ({ messages }) => ({
      messages,
      brand_id: brand?.id,
      conversation_id: threadId,
      approved_action_ids: pendingApprovalsRef.current,
    }),
    onFinish: async (message) => {
      if (!threadId || !user) return;
      await supabase.from("agent_messages").insert({
        conversation_id: threadId, user_id: user.id, role: "assistant",
        parts: (message as any).parts ?? [{ type: "text", text: message.content }],
      });
      await supabase.from("agent_conversations").update({
        last_message_at: new Date().toISOString(),
      }).eq("id", threadId);
      pendingApprovalsRef.current = [];
      composerRef.current?.focus();
    },
    onError: (err) => toast.error(err?.message || "Strategist hit an error"),
  });

  useEffect(() => { setMessages(initialMessages as any); }, [initialMessages, setMessages]);
  useEffect(() => { composerRef.current?.focus(); }, [threadId]);

  const handleNewThread = async () => {
    if (!user || !brand?.id) return;
    const { data } = await supabase.from("agent_conversations").insert({
      user_id: user.id, brand_id: brand.id, title: "New conversation",
    }).select("id").single();
    if (data?.id) {
      setConversations((prev) => [
        { id: data.id, title: "New conversation", last_message_at: new Date().toISOString() },
        ...prev,
      ]);
      navigate(`/agent/${data.id}`);
    }
  };

  const [input, setInput] = useState("");
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (!threadId) { await handleNewThread(); setInput(text); return; }
    if (user) {
      await supabase.from("agent_messages").insert({
        conversation_id: threadId, user_id: user.id, role: "user",
        parts: [{ type: "text", text }],
      });
    }
    setInput("");
    await append({ role: "user", content: text });
  };

  const approveAction = useCallback((actionId: string) => {
    pendingApprovalsRef.current = [...pendingApprovalsRef.current, actionId];
    toast.success("Approved. Send any message to resume the agent.");
  }, []);

  const undoAction = useCallback(async (actionId: string) => {
    const accessToken = await getAccessToken();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-undo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
      },
      body: JSON.stringify({ action_id: actionId }),
    });
    const data = await res.json();
    if (res.ok) toast.success("Undone");
    else toast.error(data.error ?? "Undo failed");
  }, []);

  if (autonomyEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-foreground text-background flex items-center justify-center">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold mb-2">Strategist Agent</h1>
            <p className="text-sm text-muted-foreground">
              Turn on autonomous mode to let the strategist plan, draft, and schedule on your behalf — with hard guardrails and full undo.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/agent/settings")}>
            <Settings className="w-4 h-4 mr-2" /> Configure & enable
          </Button>
          <div className="text-xs text-muted-foreground">
            <Link to="/hub" className="underline">Back to Hub</Link>
          </div>
        </div>
      </div>
    );
  }

  if (autonomyEnabled === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen flex bg-background pb-24 md:pb-0">
      <aside className="hidden md:flex md:w-72 border-r border-border flex-col max-h-screen">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-foreground" />
          <h1 className="font-semibold flex-1">Strategist</h1>
          <Button size="icon" variant="ghost" onClick={() => navigate("/agent/settings")}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-3">
          <Button className="w-full" onClick={handleNewThread}>
            <Plus className="w-4 h-4 mr-2" /> New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/agent/${c.id}`)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm truncate hover:bg-muted ${threadId === c.id ? "bg-muted font-medium" : ""}`}
              >
                {c.title || "Untitled"}
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No conversations yet</p>
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen max-h-screen">
        <header className="md:hidden p-4 border-b border-border flex items-center gap-3">
          <Link to="/hub"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-semibold flex-1">Strategist Agent</h1>
          <Button size="icon" variant="ghost" onClick={handleNewThread}><Plus className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => navigate("/agent/settings")}><Settings className="w-4 h-4" /></Button>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {!threadId && (
              <div className="text-center py-16 space-y-3">
                <Sparkles className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Pick a conversation or start a new one.</p>
              </div>
            )}
            {loadingThread && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
            {messages.map((m: any) => (
              <MessageBubble key={m.id} message={m} onApprove={approveAction} onUndo={undoAction} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Strategist is working…</span>
              </div>
            )}
            {error && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error.message}
              </div>
            )}
          </div>
        </ScrollArea>

        <footer className="border-t border-border p-4 bg-background">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={threadId ? "Tell the strategist what to do…" : "Start a new conversation to begin"}
              rows={1}
              className="resize-none min-h-[44px] max-h-32"
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}

function MessageBubble({ message, onApprove, onUndo }: {
  message: any;
  onApprove: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const isUser = message.role === "user";
  const parts = message.parts && Array.isArray(message.parts) && message.parts.length > 0
    ? message.parts
    : [{ type: "text", text: message.content ?? "" }];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? "bg-foreground text-background" : "bg-muted"}`}>
        {parts.map((part: any, idx: number) => {
          if (part.type === "text") {
            return (
              <div key={idx} className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          }
          if (part.type === "tool-invocation" || part.type?.startsWith("tool-")) {
            const ti = part.toolInvocation ?? part;
            const toolName = ti.toolName ?? part.type?.replace("tool-", "");
            const output = ti.result ?? ti.output;
            const requiresApproval = output?.requires_approval;
            return (
              <div key={idx} className="my-2 p-3 rounded-lg bg-background/60 border border-border text-xs space-y-2">
                <div className="flex items-center gap-2">
                  {output?.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                   requiresApproval ? <AlertCircle className="w-3 h-3 text-amber-600" /> :
                   <Loader2 className="w-3 h-3 animate-spin" />}
                  <span className="font-mono font-medium">{toolName}</span>
                  {output?.ok && <Badge variant="secondary" className="text-[10px]">done</Badge>}
                  {requiresApproval && <Badge className="text-[10px] bg-amber-100 text-amber-800">needs approval</Badge>}
                </div>
                {requiresApproval && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">{output.summary}</p>
                    <Button size="sm" onClick={() => onApprove(output.action_id)}>Approve & continue</Button>
                  </div>
                )}
                {output?.ok && output?.action_id && (
                  <Button size="sm" variant="ghost" onClick={() => onUndo(output.action_id)} className="h-6 px-2 text-[11px]">
                    <Undo2 className="w-3 h-3 mr-1" /> Undo
                  </Button>
                )}
                {output?.error && <p className="text-destructive">{output.message ?? output.error}</p>}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
