import { useState } from "react";
import { Link } from "react-router-dom";
import CNLayout from "../components/CNLayout";
import { RecordDialog, Section, StatusPill, TestBadge, fmtDate, type Field } from "../components/ui";
import { useCnList, useCnMutation } from "../api/db";
import { useNameMaps } from "../api/lookups";
import { TASK_STATUSES, type Row } from "../types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const GROUPS: { title: string; statuses: string[] }[] = [
  { title: "Needs Action", statuses: ["Ready", "Waiting on Human"] },
  { title: "In Progress", statuses: ["In Progress"] },
  { title: "Waiting", statuses: ["Waiting on AI", "Waiting on Creator", "Waiting on Business", "Backlog"] },
  { title: "Blocked", statuses: ["Blocked"] },
  { title: "Review", statuses: ["Review"] },
  { title: "Done Recently", statuses: ["Done"] },
];

export default function Work() {
  const { user } = useAuth();
  const tasks = useCnList("tasks", { order: "updated_at" });
  const m = useCnMutation("tasks");
  const names = useNameMaps();
  const [open, setOpen] = useState(false);
  const [blocking, setBlocking] = useState<Row | null>(null);
  const [mine, setMine] = useState(false);

  const fields: Field[] = [
    { name: "title", label: "What is required", required: true },
    { name: "why", label: "Why", type: "textarea" },
    { name: "context", label: "Relevant context", type: "textarea" },
    { name: "creator_id", label: "Creator", type: "select", options: names.creators.map((c) => ({ value: c.id, label: c.display_name })) },
    { name: "owner_type", label: "Owner type", type: "select", options: ["Human", "AI"], required: true },
    { name: "priority", label: "Priority", type: "select", options: ["Urgent", "High", "Normal", "Low"] },
    { name: "required_input", label: "Required input" },
    { name: "expected_output", label: "Expected output" },
    { name: "next_step", label: "Next step after this" },
    { name: "review_required", label: "Needs review when done", type: "boolean" },
    { name: "is_test", label: "Test record (excluded from KPIs)", type: "boolean" },
  ];

  const rows = (tasks.data ?? []).filter((t) => !mine || t.human_assignee === user?.id);
  const cutoff = Date.now() - 14 * 864e5;

  const setStatus = (t: Row, status: string) => {
    if (status === "Blocked") return setBlocking(t);
    m.update.mutate({ id: t.id, values: { status, completed_at: status === "Done" ? new Date().toISOString() : null } });
  };

  return (
    <CNLayout
      title="My Work"
      subtitle="Every task says what's needed, why, and what comes next."
      actions={
        <div className="flex gap-2">
          <Button variant={mine ? "default" : "outline"} className="min-h-11 rounded-xl" onClick={() => setMine((v) => !v)} aria-pressed={mine}>
            {mine ? "Assigned to me" : "All tasks"}
          </Button>
          <Button className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New task</Button>
        </div>
      }
    >
      {tasks.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : !rows.length ? (
        <EmptyState icon={ClipboardList} title="No tasks yet" description="Tasks appear when you create them or when a Next Best Action is turned into work." ctaLabel="Create a task" onCta={() => setOpen(true)} />
      ) : (
        GROUPS.map((g) => {
          const list = rows.filter((t) => g.statuses.includes(t.status) && (g.title !== "Done Recently" || new Date(t.completed_at ?? t.updated_at).getTime() > cutoff));
          return (
            <Section key={g.title} title={`${g.title} (${list.length})`}>
              {!list.length ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
                <ul className="space-y-2">
                  {list.map((t) => (
                    <li key={t.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{t.title} <span className="text-xs text-muted-foreground">{t.code}</span> <TestBadge isTest={t.is_test} /></p>
                          <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                            {t.why && <div><dt className="inline font-medium text-foreground">Why: </dt><dd className="inline">{t.why}</dd></div>}
                            {t.context && <div><dt className="inline font-medium text-foreground">Context: </dt><dd className="inline">{t.context}</dd></div>}
                            {t.required_input && <div><dt className="inline font-medium text-foreground">Needs: </dt><dd className="inline">{t.required_input}</dd></div>}
                            {t.expected_output && <div><dt className="inline font-medium text-foreground">Output: </dt><dd className="inline">{t.expected_output}</dd></div>}
                            {t.next_step && <div><dt className="inline font-medium text-foreground">Then: </dt><dd className="inline">{t.next_step}</dd></div>}
                            {t.blocker && <div><dt className="inline font-medium text-destructive">Blocker: </dt><dd className="inline">{t.blocker}</dd></div>}
                            {t.depends_on_task_id && <div><dt className="inline font-medium text-foreground">Depends on: </dt><dd className="inline">{rows.find((x) => x.id === t.depends_on_task_id)?.code ?? "another task"}</dd></div>}
                            {t.creator_id && <div><dt className="inline font-medium text-foreground">Creator: </dt><dd className="inline"><Link className="underline" to={`/creator-network/creators/${t.creator_id}`}>{names.creatorName(t.creator_id)}</Link></dd></div>}
                          </dl>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill value={t.owner_type === "AI" ? "AI" : "Human"} />
                          <StatusPill value={t.priority} />
                          <Select value={t.status} onValueChange={(v) => setStatus(t, v)}>
                            <SelectTrigger className="min-h-11 w-44" aria-label={`Status for ${t.title}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Updated {fmtDate(t.updated_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          );
        })
      )}
      <RecordDialog open={open} onOpenChange={setOpen} title="New task" fields={fields} initial={{ owner_type: "Human", priority: "Normal" }}
        submitting={m.insert.isPending}
        onSubmit={(v) => m.insert.mutateAsync({ ...v, human_assignee: v.owner_type === "Human" ? user?.id : null, record_source: v.is_test ? "test" : "human" })} />
      <RecordDialog open={!!blocking} onOpenChange={(o) => !o && setBlocking(null)} title="Mark as blocked" description="Describe what is blocking this task so someone can unblock it."
        fields={[{ name: "blocker", label: "Blocker", type: "textarea", required: true }]} submitLabel="Mark blocked"
        onSubmit={(v) => m.update.mutateAsync({ id: blocking!.id, values: { status: "Blocked", blocker: v.blocker } })} />
    </CNLayout>
  );
}
