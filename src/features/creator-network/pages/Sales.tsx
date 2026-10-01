import { useState } from "react";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, Section, StatusPill, TestBadge, fmtDate, type Field } from "../components/ui";
import { useCnList, useCnMutation, friendlyError } from "../api/db";
import { useNameMaps } from "../api/lookups";
import { formatMoney } from "../services/metrics";
import { RESPONSE_CLASSES, SALE_STATUSES, type Row } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export default function Sales() {
  const { user } = useAuth();
  const sales = useCnList("sales", { order: "updated_at" });
  const opps = useCnList("opportunities");
  const earnings = useCnList("earnings");
  const names = useNameMaps();
  const m = useCnMutation("sales");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);

  const fields: Field[] = [
    { name: "contact", label: "Contact (business)" },
    { name: "channel", label: "Channel", type: "select", options: ["Email", "WhatsApp", "Instagram DM", "Phone", "In Person", "Other"] },
    { name: "offer_price", label: "Offer price (NGN)", type: "number" },
    { name: "outreach_message", label: "Outreach message", type: "textarea", help: "AI may draft — a human always sends." },
    { name: "status", label: "Status", type: "select", options: SALE_STATUSES },
    { name: "sent_at", label: "Sent at", type: "datetime" },
    { name: "response", label: "Response", type: "textarea" },
    { name: "response_classification", label: "Response classification", type: "select", options: RESPONSE_CLASSES },
    { name: "follow_up_at", label: "Follow-up", type: "datetime" },
    { name: "payment_status", label: "Payment", type: "select", options: ["Unpaid", "Pending", "Paid", "Refunded"] },
    { name: "paid_amount", label: "Paid amount (NGN)", type: "number" },
    { name: "creator_royalty", label: "Creator royalty (NGN)", type: "number", help: "Recorded in the creator earnings ledger when paid. Never Brandie credits." },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const draft = async (s: Row) => {
    setDrafting(s.id);
    const { data, error } = await supabase.functions.invoke("creator-network-ai", { body: { agent: "outreach_drafter", entity_type: "sale", entity_id: s.id } });
    setDrafting(null);
    if (error || data?.error) return toast.error(friendlyError(data?.error ?? error));
    toast.success("Draft ready — review it before sending");
    setEdit({ ...s, outreach_message: data.output?.message ?? s.outreach_message });
  };

  return (
    <CNLayout title="Sales" subtitle="Human-controlled outreach. Nothing is sent automatically."
      actions={<Button className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New outreach</Button>}>
      <EntityTable rows={sales.data} loading={sales.isLoading} error={sales.error} onRowClick={setEdit}
        empty={{ title: "No outreach yet", description: "Create outreach once an opportunity has a preview ready." }}
        columns={[{ key: "code", label: "ID" }, { key: "party", label: "Business", render: (r) => <>{names.partyName(r)} <TestBadge isTest={r.is_test} /></> },
          { key: "creator", label: "Creator", render: (r) => names.creatorName(r.creator_id) }, { key: "channel", label: "Channel" },
          { key: "offer_price", label: "Offer", render: (r) => r.offer_price ? formatMoney(r.offer_price) : "—" },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
          { key: "response_classification", label: "Response", render: (r) => <StatusPill value={r.response_classification} /> },
          { key: "payment_status", label: "Payment", render: (r) => <StatusPill value={r.payment_status} /> },
          { key: "follow", label: "Follow-up", render: (r) => fmtDate(r.follow_up_at) },
          { key: "ai", label: "", render: (r) => <Button size="sm" variant="ghost" className="min-h-11" disabled={drafting === r.id} onClick={(e) => { e.stopPropagation(); draft(r); }}><Sparkles className="h-4 w-4 mr-1" />{drafting === r.id ? "Drafting…" : "AI draft"}</Button> }]} />
      <Section title="Creator earnings ledger" description="Separate from Brandie credits and affiliate commissions.">
        <EntityTable rows={earnings.data} loading={earnings.isLoading} empty={{ title: "No earnings yet", description: "Earnings are created when a sale is marked Paid." }}
          columns={[{ key: "creator", label: "Creator", render: (r) => names.creatorName(r.creator_id) }, { key: "earning_type", label: "Type" },
            { key: "payable_amount", label: "Payable", render: (r) => formatMoney(r.payable_amount) }, { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> }]} />
      </Section>
      <RecordDialog open={open} onOpenChange={setOpen} title="New outreach record"
        fields={[{ name: "opportunity_id", label: "Opportunity", type: "select", required: true, options: (opps.data ?? []).map((o) => ({ value: o.id, label: `${o.code} · ${names.creatorName(o.creator_id)} × ${names.partyName(o)}` })) }, ...fields.slice(0, 4)]}
        onSubmit={(v) => {
          const o = opps.data!.find((x) => x.id === v.opportunity_id)!;
          return m.insert.mutateAsync({ ...v, brand_id: o.brand_id, prospect_id: o.prospect_id, creator_id: o.creator_id, product_source: o.product_source, product_id: o.product_id, salesperson: user?.id, is_test: o.is_test });
        }} />
      <RecordDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Outreach ${edit?.code ?? ""}`} fields={fields} initial={edit ?? {}}
        onSubmit={async (v) => {
          const prev = edit!;
          await m.update.mutateAsync({ id: prev.id, values: v });
          if (v.sent_at && !prev.sent_at) trackEvent("spec_preview_sent", { sale_id: prev.id });
          if (v.response_classification && v.response_classification !== prev.response_classification) trackEvent("business_responded", { sale_id: prev.id, classification: v.response_classification });
          if (v.payment_status === "Paid" && prev.payment_status !== "Paid") trackEvent("creator_ad_purchased", { sale_id: prev.id });
        }} />
    </CNLayout>
  );
}
