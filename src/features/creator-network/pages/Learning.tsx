import { useState } from "react";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, Section, Stat, StatusPill } from "../components/ui";
import { useCnList, useCnMutation } from "../api/db";
import { average, formatMoney, formatRatio, ratio, realOnly } from "../services/metrics";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Learning() {
  const C = realOnly(useCnList("creators").data);
  const V = realOnly(useCnList("validations").data);
  const L = realOnly(useCnList("licences").data);
  const J = realOnly(useCnList("production_jobs").data);
  const S = realOnly(useCnList("sales").data);
  const E = realOnly(useCnList("earnings").data);
  const exps = useCnList("experiments");
  const xm = useCnMutation("experiments");
  const [open, setOpen] = useState(false);

  const contacted = C.filter((c) => c.contact_status !== "Not Contacted").length;
  const interested = C.filter((c) => c.licensing_interest === "Interested").length;
  const licensedCreators = new Set(L.filter((l) => ["Signed", "Active"].includes(l.status) && !l.revoked).map((l) => l.creator_id)).size;
  const dt = V.filter((v) => v.validation_type === "digital_twin_test" && ["Passed", "Failed"].includes(v.status));
  const previews = J.filter((j) => j.preview_path).length;
  const sent = S.filter((s) => s.sent_at);
  const responded = sent.filter((s) => s.response_classification && s.response_classification !== "No Response");
  const paid = S.filter((s) => s.payment_status === "Paid");
  const revenue = paid.reduce((a, s) => a + Number(s.paid_amount ?? 0), 0);
  const royalties = E.reduce((a, e) => a + Number(e.payable_amount ?? 0), 0);
  const cost = J.reduce((a, j) => a + Number(j.production_cost ?? 0), 0);
  const regenRate = J.length ? J.reduce((a, j) => a + j.regeneration_count, 0) / J.length : null;
  const interventions = average(J.map((j) => j.human_intervention_count));

  return (
    <CNLayout title="Learning" subtitle="Metrics show only when there is real data behind them. Test records are excluded.">
      <Section title="Creator acquisition">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Outreach → interest" value={formatRatio(ratio(interested, contacted))} hint={`${interested}/${contacted}`} />
          <Stat label="Interest → licence" value={formatRatio(ratio(licensedCreators, interested))} hint={`${licensedCreators}/${interested}`} />
          <Stat label="Digital-twin pass" value={formatRatio(ratio(dt.filter((v) => v.status === "Passed").length, dt.length))} />
          <Stat label="Creator acquisition cost" value="No data yet" hint="Not tracked in V1" />
        </div>
      </Section>
      <Section title="Production">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Production cost / job" value={J.length ? formatMoney(cost / J.length) : "No data yet"} />
          <Stat label="Regenerations / job" value={regenRate === null ? "No data yet" : regenRate.toFixed(1)} />
          <Stat label="Human interventions / job" value={interventions === null ? "No data yet" : interventions.toFixed(1)} />
          <Stat label="Previews produced" value={J.length ? previews : "No data yet"} />
        </div>
      </Section>
      <Section title="Commercial">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Preview → response" value={formatRatio(ratio(responded.length, sent.length))} />
          <Stat label="Response → purchase" value={formatRatio(ratio(paid.length, responded.length))} />
          <Stat label="Gross margin" value={paid.length ? formatMoney(revenue - royalties - cost) : "No data yet"} />
          <Stat label="Creator earnings" value={E.length ? formatMoney(royalties) : "No data yet"} />
        </div>
      </Section>
      <Section title="Experiments" actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Hypothesis</Button>}>
        <EntityTable rows={exps.data} loading={exps.isLoading} empty={{ title: "No experiments yet", description: "Track hypotheses like “creators accept likeness licensing”." }}
          columns={[{ key: "hypothesis", label: "Hypothesis" }, { key: "metric_key", label: "Metric" }, { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> }, { key: "conclusion", label: "Conclusion" }]} />
      </Section>
      <RecordDialog open={open} onOpenChange={setOpen} title="New experiment"
        fields={[{ name: "hypothesis", label: "Hypothesis", type: "textarea", required: true }, { name: "metric_key", label: "Metric" }, { name: "success_criteria", label: "Success criteria" },
          { name: "status", label: "Status", type: "select", options: ["Planned", "Running", "Concluded", "Abandoned"] }, { name: "conclusion", label: "Conclusion", type: "textarea" }, { name: "is_test", label: "Test record", type: "boolean" }]}
        initial={{ status: "Planned" }} onSubmit={(v) => xm.insert.mutateAsync(v)} />
    </CNLayout>
  );
}
