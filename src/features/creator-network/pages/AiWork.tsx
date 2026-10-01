import { useState } from "react";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { StatusPill, TestBadge } from "../components/ui";
import { useCnList, friendlyError } from "../api/db";
import { useNameMaps } from "../api/lookups";
import { AI_RUN_STATUSES, type Row } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function AiWork() {
  const runs = useCnList("ai_runs");
  const names = useNameMaps();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [creator, setCreator] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);

  const run = async (agent: string) => {
    if (!creator) return toast.error("Pick a creator first");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("creator-network-ai", { body: { agent, entity_type: "creator", entity_id: creator } });
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["cn"] });
    if (error || data?.error) toast.error(friendlyError(data?.error ?? error));
    else toast.success("AI run finished — review the output");
  };

  const rows = (runs.data ?? []).filter((r) => status === "all" || r.status === status);
  return (
    <CNLayout title="AI Work" subtitle="Every AI run is human-triggered in V1. There are no autonomous background agents.">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={creator} onValueChange={setCreator}><SelectTrigger className="min-h-11 w-60" aria-label="Creator"><SelectValue placeholder="Choose creator…" /></SelectTrigger>
          <SelectContent>{names.creators.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent></Select>
        <Button className="min-h-11 rounded-xl" disabled={busy} onClick={() => run("creator_research_summary")}>{busy ? "Running…" : "Summarise research gaps"}</Button>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="min-h-11 w-44 ml-auto" aria-label="Status filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{AI_RUN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <EntityTable rows={rows} loading={runs.isLoading} error={runs.error} onRowClick={setSel}
        empty={{ title: "No AI runs yet", description: "Runs appear here when an operator triggers AI work." }}
        columns={[{ key: "agent", label: "Agent", render: (r) => <>{r.agent} <TestBadge isTest={r.is_test} /></> }, { key: "objective", label: "Objective", className: "max-w-xs" },
          { key: "entity", label: "Entity", render: (r) => r.entity_type === "creator" ? names.creatorName(r.entity_id) : r.entity_type ?? "—" },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> }, { key: "confidence", label: "Confidence" },
          { key: "started_at", label: "Started", render: (r) => r.started_at ? new Date(r.started_at).toLocaleString() : "—" },
          { key: "error", label: "Error", className: "text-xs text-destructive max-w-xs truncate" }]} />
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl rounded-2xl">
          {sel && (<>
            <DialogHeader><DialogTitle>{sel.agent}</DialogTitle><DialogDescription>{sel.objective} · {sel.status} · model {sel.model_used ?? "—"}</DialogDescription></DialogHeader>
            {[["Input", sel.input], ["Output", sel.output], ["Evidence", sel.evidence]].map(([k, v]) => (
              <div key={k as string}><h3 className="text-sm font-medium">{k as string}</h3><pre className="mt-1 whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{v ? JSON.stringify(v, null, 2) : "—"}</pre></div>
            ))}
            {sel.error && <p role="alert" className="text-sm text-destructive">{sel.error}</p>}
          </>)}
        </DialogContent>
      </Dialog>
    </CNLayout>
  );
}
