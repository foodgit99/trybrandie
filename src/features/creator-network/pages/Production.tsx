import { useState } from "react";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, Section, StatusPill, TestBadge, type Field } from "../components/ui";
import { useCnList, useCnMutation, signedAssetUrl, friendlyError } from "../api/db";
import { useNameMaps } from "../api/lookups";
import { checkEligibility } from "../services/licenceEligibility";
import { watermarkImage } from "../utils/watermark";
import { PRODUCTION_STAGES, REVIEW_DECISIONS, type Row } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

function JobPanel({ job, onClose }: { job: Row; onClose: () => void }) {
  const { user } = useAuth();
  const reviews = useCnList("production_reviews", { filter: { job_id: job.id } });
  const concept = useCnList("concepts", { filter: { id: job.concept_id } });
  const jm = useCnMutation("production_jobs");
  const rm = useCnMutation("production_reviews");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const con = concept.data?.[0];
  const idx = PRODUCTION_STAGES.indexOf(job.stage);

  const handoff = async () => {
    if (!job.brand_id) return toast.error("Static handoff needs a Brandie brand. For prospects, upload the preview asset manually.");
    setBusy(true);
    try {
      const { data: brand } = await (supabase as any).from("brands").select("*").eq("id", job.brand_id).maybeSingle();
      if (!brand) throw new Error("Brand not accessible to you");
      const brief = [`Creator Network speculative ad (${job.rights_mode.toLowerCase()}).`, con?.hook && `Hook: ${con.hook}`, con?.strategic_idea && `Idea: ${con.strategic_idea}`,
        con?.product_placement && `Product: ${con.product_placement}`, con?.cta && `CTA: ${con.cta}`,
        "Do not imply the creator personally used the product unless stated as verified."].filter(Boolean).join("\n");
      const { data, error } = await supabase.functions.invoke("design-enqueue", {
        body: { action: "generate", canvas_size: "1080x1080", messages: [{ role: "user", content: brief }], brand },
      });
      if (error || data?.error || !data?.job_id) throw new Error(error?.message || data?.error || "Could not start generation");
      await jm.update.mutateAsync({ id: job.id, values: { design_job_id: data.job_id, stage: "Scene Generation" } });
      toast.success("Sent to Brandie Design pipeline");
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };

  const uploadPreview = async (file: File) => {
    setBusy(true);
    try {
      const blob = file.type.startsWith("image/") ? await watermarkImage(file) : null;
      if (!blob) throw new Error("Video previews must be watermarked in the video pipeline; upload an image here.");
      const path = `previews/${job.id}/${Date.now()}.png`;
      const { error } = await supabase.storage.from("creator-network-assets").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      await jm.update.mutateAsync({ id: job.id, values: { preview_path: path, stage: "Watermark" } });
      trackEvent("creator_network_preview_ready", { job_id: job.id });
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };
  const uploadMaster = async (file: File) => {
    setBusy(true);
    try {
      const path = `masters/${job.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("creator-network-assets").upload(path, file);
      if (error) throw error;
      await jm.update.mutateAsync({ id: job.id, values: { clean_master_path: path } });
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{job.code} · {con?.concept_name ?? "Concept"}</DialogTitle>
          <DialogDescription>Rights: {job.rights_mode} · Cost {job.production_cost} · Regenerations {job.regeneration_count} · Human interventions {job.human_intervention_count}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-wrap gap-1" aria-label="Production stages">
          {PRODUCTION_STAGES.map((s, i) => (
            <li key={s} aria-current={s === job.stage ? "step" : undefined} className={`rounded-full border px-2 py-0.5 text-[11px] ${i < idx ? "bg-muted" : s === job.stage ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"}`}>{i < idx ? "✓ " : ""}{s}</li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={busy || idx >= PRODUCTION_STAGES.length - 1} onClick={() => jm.update.mutate({ id: job.id, values: { stage: PRODUCTION_STAGES[idx + 1] } })}>Advance to {PRODUCTION_STAGES[idx + 1] ?? "—"}</Button>
          <Button variant="outline" className="min-h-11" disabled={busy || !!job.design_job_id} onClick={handoff}>{job.design_job_id ? "Sent to Design" : "Send to Brandie Design"}</Button>
          <Button variant="outline" className="min-h-11" onClick={() => setReview(true)}>Record review</Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border border-input px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
            <Upload className="h-4 w-4" />Upload preview (auto-watermarked)
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadPreview(e.target.files[0])} />
          </label>
          {job.rights_mode === "Commercial" && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md border border-input px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
              <Upload className="h-4 w-4" />Upload clean master
              <input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadMaster(e.target.files[0])} />
            </label>
          )}
          {job.preview_path && <Button variant="ghost" className="min-h-11" onClick={async () => setPreviewUrl(await signedAssetUrl(job.preview_path))}>View preview</Button>}
        </div>
        {job.design_job_id && <p className="text-xs text-muted-foreground">Design job: {job.design_job_id}. The render appears in the brand's Brandie history; review it here once ready.</p>}
        {previewUrl && <img src={previewUrl} alt="Watermarked preview" className="max-h-80 rounded-xl border border-border" />}
        <Section title="Stage reviews" description="Every human decision becomes learning data.">
          <EntityTable rows={reviews.data} loading={reviews.isLoading} empty={{ title: "No reviews yet" }}
            columns={[{ key: "stage", label: "Stage" }, { key: "decision", label: "Decision", render: (r) => <StatusPill value={r.decision} /> },
              { key: "reason", label: "Reason" }, { key: "human_edit", label: "Human edit" }, { key: "reviewed_at", label: "When", render: (r) => new Date(r.reviewed_at).toLocaleString() }]} />
        </Section>
        <RecordDialog open={review} onOpenChange={setReview} title={`Review — ${job.stage}`}
          fields={[{ name: "decision", label: "Decision", type: "select", options: REVIEW_DECISIONS, required: true },
            { name: "ai_output", label: "AI output (summary)", type: "textarea" }, { name: "output_url", label: "Output URL" },
            { name: "human_edit", label: "Human edit", type: "textarea" }, { name: "reason", label: "Reason (required unless Approve)", type: "textarea" }]}
          onSubmit={async (v) => {
            if (v.decision !== "Approve" && !String(v.reason ?? "").trim()) { toast.error("A reason is required for Edit, Reject and Regenerate."); throw new Error("reason"); }
            await rm.insert.mutateAsync({ ...v, job_id: job.id, stage: job.stage, reviewer: user?.id, is_test: job.is_test });
            if (v.decision === "Regenerate") trackEvent("production_regenerated", { job_id: job.id });
          }} />
      </DialogContent>
    </Dialog>
  );
}

export default function Production() {
  const jobs = useCnList("production_jobs", { order: "updated_at" });
  const approved = useCnList("concepts", { filter: { status: "Approved" } });
  const licences = useCnList("licences");
  const names = useNameMaps();
  const jm = useCnMutation("production_jobs");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);
  const withJob = new Set((jobs.data ?? []).map((j) => j.concept_id));
  const fields: Field[] = [
    { name: "concept_id", label: "Approved concept", type: "select", required: true, options: (approved.data ?? []).filter((c) => !withJob.has(c.id)).map((c) => ({ value: c.id, label: `${c.code} · ${c.concept_name}` })) },
    { name: "rights_mode", label: "Rights mode", type: "select", options: ["Preview", "Commercial"], required: true, help: "Preview = private watermarked spec ad. Commercial requires a signed commercial licence." },
    { name: "usage", label: "Usage (commercial)", type: "select", options: ["paid", "organic", "creator_posted"] },
    { name: "platform", label: "Platform" }, { name: "territory", label: "Territory" },
    { name: "production_cost", label: "Estimated production cost (NGN)", type: "number" },
  ];

  return (
    <CNLayout title="Production" subtitle="Orchestration only — rendering runs on Brandie's existing Design and Video pipelines."
      actions={<Button className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Send concept to production</Button>}>
      <EntityTable rows={jobs.data} loading={jobs.isLoading} error={jobs.error} onRowClick={setSel}
        empty={{ title: "No production jobs", description: "Approve a concept on an opportunity first. Only approved concepts can enter production." }}
        columns={[{ key: "code", label: "ID" }, { key: "creator", label: "Creator", render: (r) => <>{names.creatorName(r.creator_id)} <TestBadge isTest={r.is_test} /></> },
          { key: "party", label: "Brand / prospect", render: (r) => names.partyName(r) }, { key: "stage", label: "Stage", render: (r) => <StatusPill value={r.blocked ? "Blocked" : r.stage} /> },
          { key: "rights_mode", label: "Rights" }, { key: "regeneration_count", label: "Regens" }, { key: "human_intervention_count", label: "Interventions" },
          { key: "preview", label: "Preview", render: (r) => r.preview_path ? "Ready" : "—" }, { key: "master", label: "Master", render: (r) => r.clean_master_path ? "Delivered" : "—" }]} />
      <RecordDialog open={open} onOpenChange={setOpen} title="Send approved concept to production" fields={fields} initial={{ rights_mode: "Preview", usage: "paid" }}
        onSubmit={async (v) => {
          const c = approved.data?.find((x) => x.id === v.concept_id)!;
          const lic = (licences.data ?? []).filter((l) => l.creator_id === c.creator_id);
          const chk = checkEligibility(lic as any, { mode: v.rights_mode, usage: v.usage, platform: v.platform ?? undefined, territory: v.territory ?? undefined, needsDigitalTwin: false });
          if (!chk.allowed) { toast.error(`Blocked by rights check: ${chk.reasons.join(" ")}`); throw new Error("rights"); }
          await jm.insert.mutateAsync({ opportunity_id: c.opportunity_id, concept_id: c.id, creator_id: c.creator_id, brand_id: c.brand_id, prospect_id: c.prospect_id,
            product_source: c.product_source, product_id: c.product_id, rights_mode: v.rights_mode, production_cost: v.production_cost ?? 0, is_test: c.is_test });
        }} />
      {sel && <JobPanel job={(jobs.data ?? []).find((j) => j.id === sel.id) ?? sel} onClose={() => setSel(null)} />}
    </CNLayout>
  );
}
