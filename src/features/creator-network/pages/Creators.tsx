import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, StatusPill, TestBadge, type Field } from "../components/ui";
import { useCnList, useCnMutation } from "../api/db";
import { CREATOR_STATUSES, CONFIDENCE } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const VIEWS: Record<string, (c: any) => boolean> = {
  All: () => true,
  Priority: (c) => c.priority_tier === "P1",
  "Contact Pending": (c) => c.contact_status === "Not Contacted" || c.status === "Contact Pending",
  Contacted: (c) => c.status === "Contacted",
  Interested: (c) => c.licensing_interest === "Interested",
  "Needs Human": (c) => c.status === "Needs Human",
  "Validation Pending": (c) => c.status === "Validation Pending",
  "Ready for Licence": (c) => c.status === "Ready for Licence",
  Licensed: (c) => c.status === "Licensed",
  "Paused/Rejected": (c) => ["Paused", "Rejected"].includes(c.status),
};

export const CREATOR_FIELDS: Field[] = [
  { name: "display_name", label: "Display name", required: true },
  { name: "legal_name", label: "Legal name", help: "Only record once confirmed by the creator." },
  { name: "handle", label: "Primary handle" },
  { name: "primary_niche", label: "Primary niche" },
  { name: "secondary_niches", label: "Secondary niches", type: "tags", help: "Comma-separated" },
  { name: "location", label: "Location" },
  { name: "languages", label: "Languages", type: "tags" },
  { name: "persona", label: "Persona", type: "textarea" },
  { name: "content_formats", label: "Primary content formats", type: "tags" },
  { name: "status", label: "Status", type: "select", options: CREATOR_STATUSES },
  { name: "priority_tier", label: "Priority tier", type: "select", options: ["P1", "P2", "P3"] },
  { name: "evidence_confidence", label: "Evidence confidence", type: "select", options: CONFIDENCE },
  { name: "camera_presence", label: "Camera presence (0–10)", type: "number" },
  { name: "ai_likeness_suitability", label: "AI likeness suitability (0–10)", type: "number" },
  { name: "voice_suitability", label: "Voice suitability (0–10)", type: "number" },
  { name: "content_versatility", label: "Content versatility (0–10)", type: "number" },
  { name: "commercial_category_breadth", label: "Commercial category breadth (0–10)", type: "number" },
  { name: "recruitability", label: "Recruitability (0–10)", type: "number" },
  { name: "audience_commercial_relevance", label: "Audience commercial relevance (0–10)", type: "number" },
  { name: "licensing_interest", label: "Licensing interest", type: "select", options: ["Unknown", "Interested", "Not Interested", "Undecided"] },
  { name: "contact_status", label: "Contact status", type: "select", options: ["Not Contacted", "Contacted", "Responded", "No Response"] },
  { name: "next_action", label: "Next action (override)" },
  { name: "notes", label: "Internal notes", type: "textarea" },
  { name: "is_test", label: "Test record (excluded from KPIs)", type: "boolean" },
];

export default function Creators() {
  const nav = useNavigate();
  const creators = useCnList("creators", { order: "updated_at" });
  const m = useCnMutation("creators");
  const [view, setView] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => (creators.data ?? []).filter(VIEWS[view]).filter((c) =>
    !q || [c.display_name, c.handle, c.primary_niche, c.location, c.code].some((x) => String(x ?? "").toLowerCase().includes(q.toLowerCase()))), [creators.data, view, q]);

  return (
    <CNLayout title="Creator Command Center" subtitle="Creators are global to Brandie — one record per person."
      actions={<Button className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add creator</Button>}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Creator views">
        {Object.keys(VIEWS).map((v) => {
          const n = (creators.data ?? []).filter(VIEWS[v]).length;
          return (
            <Button key={v} role="tab" aria-selected={view === v} variant={view === v ? "default" : "outline"} className="min-h-11 rounded-xl" onClick={() => setView(v)}>
              {v} <span className="ml-1 text-xs opacity-70">{n}</span>
            </Button>
          );
        })}
      </div>
      <Input aria-label="Search creators" placeholder="Search name, handle, niche, location…" value={q} onChange={(e) => setQ(e.target.value)} className="min-h-11 max-w-md" />
      <EntityTable
        rows={rows} loading={creators.isLoading} error={creators.error}
        onRowClick={(r) => nav(`/creator-network/creators/${r.id}`)}
        empty={{ title: "No creators recorded", description: "Brandie's team adds creators manually after research. Nothing is invented.", ctaLabel: "Add the first creator", onCta: () => setOpen(true) }}
        columns={[
          { key: "code", label: "ID", className: "text-xs text-muted-foreground" },
          { key: "display_name", label: "Creator", render: (r) => <span className="font-medium">{r.display_name} <TestBadge isTest={r.is_test} /><span className="block text-xs text-muted-foreground">{r.handle ?? ""}</span></span> },
          { key: "primary_niche", label: "Niche" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
          { key: "licensing_interest", label: "Licensing", render: (r) => <StatusPill value={r.licensing_interest} /> },
          { key: "priority_tier", label: "Tier" },
          { key: "next_action", label: "Next action", className: "text-xs" },
        ]}
      />
      <RecordDialog open={open} onOpenChange={setOpen} title="Add creator" fields={CREATOR_FIELDS} initial={{ status: "Researched", licensing_interest: "Unknown", contact_status: "Not Contacted" }}
        submitting={m.insert.isPending}
        onSubmit={async (v) => {
          const row = await m.insert.mutateAsync({ ...v, record_source: v.is_test ? "test" : "human" });
          trackEvent("creator_network_creator_added", { creator_id: row.id });
          nav(`/creator-network/creators/${row.id}`);
        }} />
    </CNLayout>
  );
}
