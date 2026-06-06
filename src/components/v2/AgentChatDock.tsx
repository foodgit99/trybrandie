import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Sparkles, Loader2, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export type AgentContext = {
  scope: "funnel" | "strategy" | "campaign" | "content" | "hub";
  label: string;
  /** Free-form selection payload sent to the strategist as system context. */
  selection?: Record<string, any>;
};

const QUICK_PROMPTS: Record<AgentContext["scope"], string[]> = {
  hub: [
    "What should I focus on this week?",
    "Suggest a 3-day promo arc for my best seller.",
    "Where am I losing customers in my funnel?",
  ],
  funnel: [
    "Diagnose the weak stage of my funnel.",
    "Suggest 2 posts to fill the gap.",
    "Map my next 5 ideas to funnel stages.",
  ],
  strategy: [
    "Rewrite this week's strategic arc.",
    "Sharpen the hook for the educational post.",
    "Suggest a contrasting pillar to add.",
  ],
  campaign: [
    "Expand this campaign into a 5-post arc.",
    "Rewrite the CTAs to feel more urgent.",
    "Add a social-proof post mid-campaign.",
  ],
  content: [
    "Rewrite this caption tighter.",
    "Give me 3 hook variations.",
    "Turn this into a carousel outline.",
  ],
};

export default function AgentChatDock({
  brandId,
  context,
  defaultOpen = false,
}: {
  brandId?: string;
  context: AgentContext;
  defaultOpen?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");

    const contextPreamble = `You are advising on the user's ${context.scope.toUpperCase()} surface: "${context.label}". ${
      context.selection ? `Current selection: ${JSON.stringify(context.selection).slice(0, 800)}` : ""
    } Keep replies under 180 words, action-first, no fluff.`;

    const nextMessages: Msg[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setLoading(true);

    const abort = new AbortController();
    abortRef.current = abort;

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length, 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length, 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brand-strategist`;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast({ title: "Please sign in", variant: "destructive" });
        setLoading(false);
        return;
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: contextPreamble },
            ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          brand_id: brandId,
        }),
        signal: abort.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        if (resp.status === 402) toast({ title: "Out of credits", variant: "destructive" });
        else toast({ title: "Agent error", description: err.error || resp.statusText, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Network error", description: e?.message ?? "", variant: "destructive" });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-40 bottom-20 right-4 lg:bottom-6 lg:right-6",
          "h-14 w-14 rounded-full grid place-items-center shadow-xl",
          "bg-foreground text-background hover:scale-105 transition-transform",
          open && "opacity-0 pointer-events-none"
        )}
        aria-label="Open agent chat"
      >
        <Wand2 className="h-5 w-5" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className={cn(
              "fixed z-50 bg-background border border-border shadow-2xl flex flex-col",
              // Mobile: full-width bottom sheet
              "inset-x-0 bottom-0 rounded-t-3xl max-h-[80vh]",
              // Desktop: docked right
              "lg:inset-auto lg:right-6 lg:bottom-6 lg:top-24 lg:w-[400px] lg:rounded-3xl lg:max-h-none"
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="h-9 w-9 rounded-xl bg-foreground text-background grid place-items-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight">Brand Strategist</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  Working on: {context.label}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ask the strategist to plan, rewrite, sequence, or audit anything on this surface.
                  </p>
                  <div className="space-y-1.5">
                    {QUICK_PROMPTS[context.scope].map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border hover:bg-secondary/60 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-sm leading-relaxed",
                    m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[95%]"
                  )}
                >
                  {m.role === "user" ? (
                    <div className="rounded-2xl rounded-br-sm bg-foreground text-background px-3.5 py-2.5">
                      {m.content}
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
              {loading && messages[messages.length, 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={`Message strategist about ${context.label}…`}
                  className="resize-none min-h-[44px] max-h-32 rounded-2xl"
                />
                <Button
                  size="icon"
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="rounded-2xl h-11 w-11 shrink-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
