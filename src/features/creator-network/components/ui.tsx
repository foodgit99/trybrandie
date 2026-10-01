import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleDashed, AlertTriangle, XCircle, Clock, Circle } from "lucide-react";

// ---------- Status pill: icon + text, never colour alone ----------
const TONE: Record<string, { cls: string; Icon: typeof Circle }> = {
  good: { cls: "bg-primary/10 text-foreground border-primary/30", Icon: CheckCircle2 },
  warn: { cls: "bg-accent/30 text-foreground border-accent", Icon: AlertTriangle },
  bad: { cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: XCircle },
  wait: { cls: "bg-muted text-muted-foreground border-border", Icon: Clock },
  neutral: { cls: "bg-muted text-foreground border-border", Icon: CircleDashed },
};
export function toneFor(s?: string | null): keyof typeof TONE {
  const v = (s ?? "").toLowerCase();
  if (/(passed|licensed|approved|won|completed|done|active|signed|clear|paid|verified|human-confirmed|ready$|fulfilled|accepted)/.test(v)) return "good";
  if (/(failed|rejected|lost|revoked|flagged|blocked|expired|not interested)/.test(v)) return "bad";
  if (/(waiting|queued|pending|running|draft|requested|review)/.test(v)) return "wait";
  if (/(needs|objection|concern|inferred|estimated|low)/.test(v)) return "warn";
  return "neutral";
}
export function StatusPill({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const t = TONE[toneFor(value)];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", t.cls, className)}>
      <t.Icon className="h-3 w-3" aria-hidden />
      {value}
    </span>
  );
}

export function TestBadge({ isTest }: { isTest?: boolean }) {
  return isTest ? <span className="rounded-md border border-dashed border-border px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Test</span> : null;
}

export function Section({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)} aria-label={title}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

// ---------- Generic record form ----------
export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "boolean" | "tags" | "date" | "datetime";
  options?: readonly string[] | { value: string; label: string }[];
  required?: boolean;
  help?: string;
  placeholder?: string;
};

function toForm(f: Field, v: any) {
  if (f.type === "tags") return Array.isArray(v) ? v.join(", ") : v ?? "";
  if (f.type === "boolean") return !!v;
  if (f.type === "date" && v) return String(v).slice(0, 10);
  if (f.type === "datetime" && v) return String(v).slice(0, 16);
  return v ?? "";
}
function fromForm(f: Field, v: any) {
  if (f.type === "tags") return String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (f.type === "number") return v === "" || v === null ? null : Number(v);
  if (f.type === "boolean") return !!v;
  if (v === "") return null;
  if (f.type === "datetime" && v) return new Date(v).toISOString();
  return v;
}

export function RecordDialog({
  open, onOpenChange, title, description, fields, initial, onSubmit, submitting, submitLabel = "Save",
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; fields: Field[];
  initial?: Record<string, any>; onSubmit: (values: Record<string, any>) => Promise<unknown> | void; submitting?: boolean; submitLabel?: string;
}) {
  const [state, setState] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      const s: Record<string, any> = {};
      fields.forEach((f) => (s[f.name] = toForm(f, initial?.[f.name])));
      setState(s);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && (state[f.name] === "" || state[f.name] === undefined || state[f.name] === null));
    if (missing) { setError(`${missing.label} is required.`); return; }
    const out: Record<string, any> = {};
    fields.forEach((f) => (out[f.name] = fromForm(f, state[f.name])));
    try { await onSubmit(out); onOpenChange(false); } catch { /* toast handled upstream */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          {fields.map((f) => {
            const id = `cnf-${f.name}`;
            const v = state[f.name];
            const set = (nv: any) => setState((s) => ({ ...s, [f.name]: nv }));
            const opts = (f.options ?? []).map((o: any) => (typeof o === "string" ? { value: o, label: o } : o));
            return (
              <div key={f.name} className="space-y-1.5">
                {f.type === "boolean" ? (
                  <div className="flex min-h-11 items-center justify-between gap-3">
                    <Label htmlFor={id}>{f.label}</Label>
                    <Switch id={id} checked={!!v} onCheckedChange={set} />
                  </div>
                ) : (
                  <>
                    <Label htmlFor={id}>{f.label}{f.required && <span aria-hidden> *</span>}</Label>
                    {f.type === "textarea" ? (
                      <Textarea id={id} value={v ?? ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} rows={3} />
                    ) : f.type === "select" ? (
                      <Select value={v || undefined} onValueChange={set}>
                        <SelectTrigger id={id} className="min-h-11"><SelectValue placeholder={f.placeholder ?? "Select…"} /></SelectTrigger>
                        <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input id={id} className="min-h-11" value={v ?? ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder}
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
                        step={f.type === "number" ? "any" : undefined} />
                    )}
                  </>
                )}
                {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
              </div>
            );
          })}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>{submitting ? "Saving…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
          <AlertDialogAction className={cn("min-h-11", destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
