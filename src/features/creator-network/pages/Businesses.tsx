import { useState } from "react";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, Section, TestBadge, type Field } from "../components/ui";
import { useCnList, useCnMutation } from "../api/db";
import { useBrandOptions, useNormalizedProducts } from "../api/lookups";
import { CONFIDENCE, type Row } from "../types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const PROSPECT_FIELDS: Field[] = [
  { name: "business_name", label: "Business name", required: true },
  { name: "category", label: "Category" }, { name: "subcategory", label: "Subcategory" }, { name: "location", label: "Location" },
  { name: "public_contact", label: "Public contact", help: "Only publicly listed business contact." },
  { name: "products_summary", label: "Products / services", type: "textarea" },
  { name: "target_customer", label: "Target customer", type: "textarea" },
  { name: "brand_positioning", label: "Brand positioning" }, { name: "visual_style", label: "Visual style" },
  { name: "content_formats", label: "Content formats", type: "tags" },
  { name: "observed_content_gap", label: "Observed content gap", type: "textarea" },
  { name: "commercial_activity", label: "Commercial activity" }, { name: "reachability", label: "Reachability" },
  { name: "purchase_ability_estimate", label: "Ability to purchase (estimate)" }, { name: "spec_ad_potential", label: "Spec-ad potential" },
  { name: "evidence_confidence", label: "Evidence confidence", type: "select", options: CONFIDENCE },
  { name: "next_action", label: "Next action" }, { name: "notes", label: "Notes", type: "textarea" },
  { name: "is_test", label: "Test record", type: "boolean" },
];

function ProductsPanel({ prospect }: { prospect: Row }) {
  const products = useNormalizedProducts({ prospect_id: prospect.id });
  const m = useCnMutation("prospect_products");
  const [open, setOpen] = useState(false);
  return (
    <Section title={`Products — ${prospect.business_name}`} actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add product</Button>}>
      <EntityTable rows={products.data as any} loading={products.isLoading} empty={{ title: "No products recorded" }}
        columns={[{ key: "name", label: "Product" }, { key: "category", label: "Category" }, { key: "price", label: "Price" }]} />
      <RecordDialog open={open} onOpenChange={setOpen} title="Add prospect product"
        fields={[{ name: "name", label: "Name", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "category", label: "Category" },
          { name: "price", label: "Price (NGN)", type: "number" }, { name: "image_url", label: "Public image URL" }, { name: "product_url", label: "Product URL" }]}
        onSubmit={(v) => m.insert.mutateAsync({ ...v, prospect_id: prospect.id, is_test: prospect.is_test })} />
    </Section>
  );
}

export default function Businesses() {
  const prospects = useCnList("prospects", { order: "updated_at" });
  const brands = useBrandOptions();
  const m = useCnMutation("prospects");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [convert, setConvert] = useState<Row | null>(null);

  return (
    <CNLayout title="Businesses" subtitle="Existing Brandie brands are reused as-is. Prospects are external businesses not yet on Brandie."
      actions={<Button className="min-h-11 rounded-xl" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add prospect</Button>}>
      <Section title="Prospects">
        <EntityTable rows={prospects.data} loading={prospects.isLoading} error={prospects.error} onRowClick={setSelected}
          empty={{ title: "No prospects yet", description: "Add businesses you've researched for speculative outreach.", ctaLabel: "Add prospect", onCta: () => setOpen(true) }}
          columns={[{ key: "code", label: "ID", className: "text-xs text-muted-foreground" },
            { key: "business_name", label: "Business", render: (r) => <span className="font-medium">{r.business_name} <TestBadge isTest={r.is_test} /></span> },
            { key: "category", label: "Category" }, { key: "location", label: "Location" }, { key: "spec_ad_potential", label: "Spec-ad potential" },
            { key: "converted", label: "Brandie customer", render: (r) => r.converted_brand_id ? brands.data?.find((b) => b.id === r.converted_brand_id)?.name ?? "Converted" : "—" },
            { key: "act", label: "", render: (r) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="min-h-11" onClick={(e) => { e.stopPropagation(); setEdit(r); setOpen(true); }}>Edit</Button>
                {!r.converted_brand_id && <Button size="sm" variant="ghost" className="min-h-11" onClick={(e) => { e.stopPropagation(); setConvert(r); }}>Link to brand</Button>}
              </div>) }]} />
      </Section>
      {selected && <ProductsPanel prospect={selected} />}
      <Section title="Brandie brands" description="Brand products are read from Brand Centre — never copied.">
        <EntityTable rows={brands.data as any} loading={brands.isLoading} empty={{ title: "No brands visible to you" }} columns={[{ key: "name", label: "Brand" }]} />
      </Section>
      <RecordDialog open={open} onOpenChange={setOpen} title={edit ? "Edit prospect" : "Add prospect"} fields={PROSPECT_FIELDS} initial={edit ?? {}}
        onSubmit={(v) => edit ? m.update.mutateAsync({ id: edit.id, values: v }) : m.insert.mutateAsync({ ...v, record_source: v.is_test ? "test" : "human" })} />
      <RecordDialog open={!!convert} onOpenChange={(o) => !o && setConvert(null)} title="Link prospect to Brandie brand" description="Use when this business became a Brandie customer. Brand data is not duplicated."
        fields={[{ name: "converted_brand_id", label: "Brand", type: "select", required: true, options: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })) }]}
        onSubmit={(v) => m.update.mutateAsync({ id: convert!.id, values: v })} />
    </CNLayout>
  );
}
