import ReactMarkdown from "react-markdown";
import { Loader2, Check, X, AlertTriangle, Circle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type LiveTurnStatus = "waiting" | "thinking" | "done" | "failed";

export type LiveTurn = {
  id: string;
  role: string;
  status: LiveTurnStatus;
  text?: string;
};

export type RoundtableLive = {
  question: string;
  turns: LiveTurn[];
  synthesis?: string;
  synthesisStatus: "idle" | "thinking" | "done";
};

/** Words that reliably signal an agent is pushing back on a teammate. */
const DISSENT = /\b(disagree|push back|pushing back|i'd challenge|challenge that|not convinced|however|but i|instead of|too early|risky|wrong|caution|careful|overrat|contrary|rather than)\b/i;

/** The "My call:" line each agent is instructed to end on. */
export function splitCall(text?: string): { body: string; call?: string } {
  if (!text) return { body: "" };
  const match = text.match(/(^|\n)\s*(?:\*\*)?My call:?(?:\*\*)?\s*(.+)$/is);
  if (!match) return { body: text.trim() };
  return {
    body: text.slice(0, match.index).trim(),
    call: match[2].replace(/\*\*/g, "").trim(),
  };
}

/** Pulls the facilitator's "Where they conflict" block out of the synthesis. */
export function extractConflicts(synthesis?: string): string | null {
  if (!synthesis) return null;
  const m = synthesis.match(/\*\*Where they conflict\*\*([\s\S]*?)(?=\n\s*\*\*|$)/i);
  const block = m?.[1]?.replace(/^\s*[—-]\s*/, "").trim();
  return block && block.length > 3 ? block : null;
}

const STATUS_META: Record<LiveTurnStatus, { icon: any; className: string; label: string }> = {
  waiting: { icon: Circle, className: "text-muted-foreground/50", label: "Waiting" },
  thinking: { icon: Loader2, className: "text-primary animate-spin", label: "Thinking" },
  done: { icon: Check, className: "text-emerald-500", label: "Weighed in" },
  failed: { icon: X, className: "text-destructive", label: "Couldn't answer" },
};

export default function RoundtableLivePanel({
  live,
  onClose,
  className,
}: {
  live: RoundtableLive;
  onClose?: () => void;
  className?: string;
}) {
  const conflicts = extractConflicts(live.synthesis);
  const dissenters = live.turns.filter((t) => t.status === "done" && DISSENT.test(t.text ?? ""));

  return (
    <aside
      className={cn(
        "flex flex-col min-h-0 border-l border-border bg-muted/20",
        className,
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-border/60">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Live takes
          </p>
          <p className="text-xs mt-0.5 line-clamp-2">{live.question}</p>
        </div>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={onClose}
            aria-label="Close live takes panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {live.turns.map((t) => {
          const meta = STATUS_META[t.status];
          const Icon = meta.icon;
          const { body, call } = splitCall(t.text);
          const dissents = t.status === "done" && DISSENT.test(t.text ?? "");
          return (
            <div
              key={t.id}
              className={cn(
                "rounded-xl border bg-background px-3 py-2.5 transition-colors",
                t.status === "thinking" ? "border-primary/50" : "border-border",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.className)} />
                <span className="text-xs font-medium flex-1 truncate">{t.role}</span>
                {dissents && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px]">
                    <AlertTriangle className="h-2.5 w-2.5" /> Pushes back
                  </span>
                )}
              </div>

              {t.status !== "done" && t.status !== "failed" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">{meta.label}…</p>
              )}

              {body && (
                <div className="mt-1.5 prose prose-sm max-w-none dark:prose-invert text-[11px] leading-relaxed [&_p]:my-1 [&_ul]:my-1">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </div>
              )}

              {call && (
                <p className="mt-1.5 rounded-lg bg-secondary/60 px-2 py-1.5 text-[11px]">
                  <span className="font-medium">My call:</span> {call}
                </p>
              )}
            </div>
          );
        })}

        {live.synthesisStatus !== "idle" && (
          <div className="rounded-xl border border-border bg-background px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-xs font-medium flex-1">Contradictions</span>
              {live.synthesisStatus === "thinking" && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            {live.synthesisStatus === "thinking" ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Reconciling {live.turns.length} viewpoints…
              </p>
            ) : conflicts ? (
              <div className="mt-1.5 prose prose-sm max-w-none dark:prose-invert text-[11px] leading-relaxed [&_p]:my-1 [&_ul]:my-1">
                <ReactMarkdown>{conflicts}</ReactMarkdown>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {dissenters.length
                  ? `${dissenters.map((d) => d.role).join(", ")} pushed back, but the facilitator found no hard conflict.`
                  : "The panel is aligned — no conflicting positions."}
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
