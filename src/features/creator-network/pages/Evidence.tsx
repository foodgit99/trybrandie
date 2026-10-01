import { useState } from "react";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, StatusPill, TestBadge, fmtDate } from "../components/ui";
import { useCnList, friendlyError } from "../api/db";
import { useNameMaps } from "../api/lookups";
import { CONFIDENCE, EVIDENCE_CLASSES, type Row } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Evidence() {
  const [showAll, setShowAll] = useState(false);
  const findings = useCnList("findings", { filter: showAll ? {} : { is_current: true } });
  const names = useNameMaps();
  const qc = useQueryClient();
  const [sup, setSup] = useState<Row | null>(null);

  return (
    <CNLayout title="Evidence" subtitle="Provenance for every claim. New evidence supersedes — it never overwrites."
      actions={<Button variant="outline" className="min-h-11 rounded-xl" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>{showAll ? "Showing history" : "Current only"}</Button>}>
      <EntityTable rows={findings.data} loading={findings.isLoading} error={findings.error}
        empty={{ title: "No findings yet", description: "Add findings from a creator's Evidence tab." }}
        columns={[{ key: "finding", label: "Finding", className: "max-w-sm", render: (r) => <>{r.finding} <TestBadge isTest={r.is_test} /></> },
          { key: "entity", label: "About", render: (r) => r.creator_id ? names.creatorName(r.creator_id) : names.partyName(r) },
          { key: "evidence_classification", label: "Classification", render: (r) => <StatusPill value={r.evidence_classification} /> },
          { key: "confidence", label: "Confidence" },
          { key: "source", label: "Source", render: (r) => r.source_url ? <a className="underline" href={r.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{r.source_name ?? "Link"}</a> : r.source_name ?? "—" },
          { key: "research_agent", label: "Agent" }, { key: "retrieved_at", label: "Retrieved", render: (r) => fmtDate(r.retrieved_at ?? r.created_at) },
          { key: "is_current", label: "State", render: (r) => <StatusPill value={r.is_current ? "Current" : "Superseded"} /> },
          { key: "act", label: "", render: (r) => r.is_current && <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setSup(r)}>Supersede</Button> }]} />
      <RecordDialog open={!!sup} onOpenChange={(o) => !o && setSup(null)} title="Supersede finding"
        description={`The original stays in history, marked superseded. Original: “${sup?.finding ?? ""}”`}
        fields={[{ name: "finding", label: "New finding", type: "textarea", required: true },
          { name: "classification", label: "Classification", type: "select", options: EVIDENCE_CLASSES, required: true },
          { name: "confidence", label: "Confidence", type: "select", options: CONFIDENCE },
          { name: "source_url", label: "Source URL" }, { name: "source_name", label: "Source name" }, { name: "notes", label: "Why it changed", type: "textarea" }]}
        submitLabel="Supersede"
        onSubmit={async (v) => {
          const { error } = await (supabase as any).rpc("creator_network_supersede_finding", {
            _old_id: sup!.id, _finding: v.finding, _classification: v.classification, _confidence: v.confidence, _source_url: v.source_url, _source_name: v.source_name, _notes: v.notes,
          });
          if (error) { toast.error(friendlyError(error)); throw error; }
          toast.success("Finding superseded");
          qc.invalidateQueries({ queryKey: ["cn"] });
        }} />
    </CNLayout>
  );
}
