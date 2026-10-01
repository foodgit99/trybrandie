import { useState } from "react";
import CNLayout from "../components/CNLayout";
import { ConfirmDialog, RecordDialog, Section, StatusPill, TestBadge, type Field } from "../components/ui";
import EntityTable from "../components/EntityTable";
import { useCnList, useCnMutation, useOpportunityTransition } from "../api/db";
import { useNameMaps } from "../api/lookups";
import { checkClaims, type Claim } from "../services/claimGating";
import { OPPORTUNITY_STAGES, CREATOR_ROLES, CLAIM_TYPES, type Row } from "../types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

const IRREVERSIBLE = new Set(["Won", "Lost", "Fulfilled"]);

const CONCEPT_FIELDS: Field[] = [
  { name: "concept_name", label: "Concept name", required: true },
  { name: "format", label: "Format", type: "select", options: ["Static"], help: "V1 produces static image ads only." },
  { name: "hook", label: "Hook" }, { name: "strategic_idea", label: "Strategic idea", type: "textarea" },
  { name: "story_structure", label: "Story structure", type: "textarea" },
  { name: "creator_role", label: "Creator role", type: "select", options: CREATOR_ROLES, required: true },
  { name: "claims_text", label: "Claims (one per line, prefix with type)", type: "textarea",
    help: `Format: TYPE: claim. Types: ${CLAIM_TYPES.join(", ")}. Personal-experience claims stay locked unless verified (add [verified]).` },
  { name: "product_placement", label: "Product placement" }, { name: "cta", label: "CTA" }, { name: "platform", label: "Platform" },
  { name: "duration_seconds", label: "Duration (s)", type: "number" }, { name: "required_assets", label: "Required assets", type: "textarea" },
  { name: "production_complexity", label: "Complexity", type: "select", options: ["Low", "Medium", "High"] },
  { name: "creative_score", label: "Creative score (0–10)", type: "number" },
];

function parseClaims(text?: string | null): Claim[] {
  return String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^([A-Z_]+):\s*(.*)$/);
    const type = (m && (CLAIM_TYPES as readonly string[]).includes(m[1]) ? m[1] : "CREATIVE_OPINION") as Claim["type"];
    const body = m ? m[2] : l;
    return { type, text: body.replace(/\[verified\]/i, "").trim(), verified: /\[verified\]/i.test(body) };
  });
}

function ConceptsPanel({ opp }: { opp: Row }) {
  const concepts = useCnList("concepts", { filter: { opportunity_id: opp.id } });
  const m = useCnMutation("concepts");
  const [open, setOpen] = useState(false);
  const [approve, setApprove] = useState<Row | null>(null);

  const setStatus = (c: Row, status: string) => {
    if (status === "Approved") {
      const chk = checkClaims(c.claims);
      if (!chk.ok) return toast.error(chk.reason!);
      return setApprove(c);
    }
    m.update.mutate({ id: c.id, values: { status } });
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between"><h3 className="font-medium">Creative concepts</h3>
        <Button size="sm" className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Concept</Button></div>
      <EntityTable rows={concepts.data} loading={concepts.isLoading} empty={{ title: "No concepts yet", description: "Only one concept can be Selected/Approved per opportunity." }}
        columns={[{ key: "code", label: "ID" }, { key: "concept_name", label: "Concept" }, { key: "creator_role", label: "Role" },
          { key: "claims", label: "Claims", render: (r) => { const chk = checkClaims(r.claims); return chk.ok ? `${(r.claims ?? []).length}` : <StatusPill value="Unverified claim" />; } },
          { key: "status", label: "Status", render: (r) => (
            <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
              <SelectTrigger className="min-h-11 w-40" aria-label={`Status for ${r.concept_name}`}><SelectValue /></SelectTrigger>
              <SelectContent>{["Draft", "Selected", "Approved", "Rejected", "Needs Revision"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>) }]} />
      <RecordDialog open={open} onOpenChange={setOpen} title="New concept" fields={CONCEPT_FIELDS}
        onSubmit={(v) => {
          const { claims_text, ...rest } = v;
          return m.insert.mutateAsync({ ...rest, claims: parseClaims(claims_text), opportunity_id: opp.id, creator_id: opp.creator_id, brand_id: opp.brand_id, prospect_id: opp.prospect_id, product_source: opp.product_source, product_id: opp.product_id, is_test: opp.is_test });
        }} />
      <RecordDialog open={!!approve} onOpenChange={(o) => !o && setApprove(null)} title="Approve concept" description="Approval is a human decision and unlocks production handoff."
        fields={[{ name: "approval_notes", label: "Approval notes", type: "textarea" }]} submitLabel="Approve"
        onSubmit={async (v) => { await m.update.mutateAsync({ id: approve!.id, values: { status: "Approved", approval_notes: v.approval_notes } }); trackEvent("concept_approved", { concept_id: approve!.id }); }} />
    </div>
  );
}

export default function Opportunities() {
  const opps = useCnList("opportunities", { order: "updated_at" });
  const names = useNameMaps();
  const matches = useCnList("matches").data ?? [];
  const m = useCnMutation("opportunities");
  const [open, setOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [move, setMove] = useState<{ row: Row; stage: string } | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const transition = useOpportunityTransition();

  const requestMove = (row: Row, stage: string) => {
    if (stage === row.stage) return;
    setMove({ row, stage });
  };
  const doMove = (extra: Record<string, any> = {}) => {
    if (!move) return;
    return transition.mutateAsync({ id: move.row.id, to: move.stage, reason: extra.lost_reason }).finally(() => setMove(null));
  };

  const fields: Field[] = [
    { name: "creator_id", label: "Creator", type: "select", required: true, options: names.creators.map((c) => ({ value: c.id, label: c.display_name })) },
    { name: "party", label: "Brand or prospect", type: "select", required: true, options: [...names.brands.map((b) => ({ value: `b:${b.id}`, label: `Brand · ${b.name}` })), ...names.prospects.map((p) => ({ value: `p:${p.id}`, label: `Prospect · ${p.business_name}` }))] },
    { name: "campaign_objective", label: "Campaign objective" }, { name: "recommended_format", label: "Recommended format" },
    { name: "creative_angle", label: "Creative angle", type: "textarea" }, { name: "priority", label: "Priority", type: "select", options: ["High", "Normal", "Low"] },
    { name: "estimated_production_cost", label: "Est. production cost (NGN)", type: "number" }, { name: "proposed_selling_price", label: "Proposed price (NGN)", type: "number" },
    { name: "creator_royalty_estimate", label: "Creator royalty estimate (NGN)", type: "number" }, { name: "match_id", label: "Match (required to validate)", type: "select", options: matches.map((x) => ({ value: x.id, label: `${x.code} · ${x.confidence ?? "?"}` })) },
    { name: "next_action", label: "Next action" },
    { name: "is_test", label: "Test record", type: "boolean" },
  ];

  const list = opps.data ?? [];
  const card = (o: Row) => (
    <li key={o.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
      <button type="button" className="w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDetail(o)}>
        <p className="text-xs text-muted-foreground">{o.code} <TestBadge isTest={o.is_test} /></p>
        <p className="font-medium text-sm">{names.creatorName(o.creator_id)} × {names.partyName(o)}</p>
        {o.next_action && <p className="text-xs text-muted-foreground">Next: {o.next_action}</p>}
        {o.blocker && <p className="text-xs text-destructive">Blocked: {o.blocker}</p>}
      </button>
      <Select value={o.stage} onValueChange={(v) => requestMove(o, v)}>
        <SelectTrigger className="min-h-11" aria-label={`Move ${o.code}`}><SelectValue /></SelectTrigger>
        <SelectContent>{OPPORTUNITY_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
    </li>
  );

  return (
    <CNLayout title="Opportunity Pipeline" subtitle="All 13 stages. Moves go one step at a time and are blocked until the required work is done. Every move is logged."
      actions={<Button className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New opportunity</Button>}>
      {/* Mobile: stage-filtered list */}
      <div className="lg:hidden space-y-3">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="min-h-11" aria-label="Stage"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All stages ({list.length})</SelectItem>
            {OPPORTUNITY_STAGES.map((s) => <SelectItem key={s} value={s}>{s} ({list.filter((o) => o.stage === s).length})</SelectItem>)}</SelectContent>
        </Select>
        <ul className="space-y-2">{list.filter((o) => stageFilter === "all" || o.stage === stageFilter).map(card)}</ul>
        {!list.length && <p className="text-sm text-muted-foreground">No opportunities yet. Create one from a match.</p>}
      </div>
      {/* Desktop: horizontal kanban */}
      <div className="hidden lg:block overflow-x-auto pb-2" role="region" aria-label="Opportunity kanban" tabIndex={0}>
        <div className="flex gap-3 w-max">
          {OPPORTUNITY_STAGES.map((s) => {
            const col = list.filter((o) => o.stage === s);
            return (
              <section key={s} aria-label={s} className="w-64 shrink-0 rounded-2xl border border-border bg-muted/40 p-2">
                <h2 className="px-1 pb-2 text-sm font-medium flex justify-between">{s}<span className="text-muted-foreground">{col.length}</span></h2>
                <ul className="space-y-2">{col.map(card)}</ul>
                {!col.length && <p className="px-1 text-xs text-muted-foreground">Empty</p>}
              </section>
            );
          })}
        </div>
      </div>

      <RecordDialog open={open} onOpenChange={setOpen} title="New opportunity" fields={fields}
        onSubmit={(v) => { const { party, ...rest } = v; const [k, id] = String(party).split(":"); const mt = matches.find((x) => x.id === v.match_id); return m.insert.mutateAsync({ ...rest, product_source: mt?.product_source ?? null, product_id: mt?.product_id ?? null, brand_id: k === "b" ? id : null, prospect_id: k === "p" ? id : null, record_source: v.is_test ? "test" : "human" }); }} />

      <RecordDialog open={!!move && move.stage === "Lost"} onOpenChange={(o) => !o && setMove(null)} title="Mark opportunity lost"
        description="Lost is a terminal stage. A reason is required for learning." fields={[{ name: "lost_reason", label: "Lost reason", type: "textarea", required: true }]}
        submitLabel="Mark lost" onSubmit={(v) => doMove({ lost_reason: v.lost_reason })} />
      <ConfirmDialog open={!!move && move.stage !== "Lost" && IRREVERSIBLE.has(move.stage)} onOpenChange={(o) => !o && setMove(null)}
        title={`Move to ${move?.stage}?`} description="This is a terminal stage and is recorded in the activity log." confirmLabel={`Move to ${move?.stage}`}
        onConfirm={() => doMove()} />
      <ConfirmDialog open={!!move && !IRREVERSIBLE.has(move.stage)} onOpenChange={(o) => !o && setMove(null)}
        title={`Move ${move?.row.code} to ${move?.stage}?`} description={`From ${move?.row.stage}. Required steps are checked before the move is saved.`} confirmLabel="Move" onConfirm={() => doMove()} />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl rounded-2xl">
          {detail && (<>
            <DialogHeader>
              <DialogTitle>{detail.code} · {names.creatorName(detail.creator_id)} × {names.partyName(detail)}</DialogTitle>
              <DialogDescription>Stage: {detail.stage} · Price {detail.proposed_selling_price ?? "—"} · Royalty est. {detail.creator_royalty_estimate ?? "—"}</DialogDescription>
            </DialogHeader>
            <Section title="Strategy"><p className="text-sm">{detail.creative_angle ?? "No creative angle yet."}</p></Section>
            <ConceptsPanel opp={detail} />
          </>)}
        </DialogContent>
      </Dialog>
    </CNLayout>
  );
}
