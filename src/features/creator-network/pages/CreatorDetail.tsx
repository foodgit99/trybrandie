import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { ConfirmDialog, RecordDialog, Section, StatusPill, TestBadge, fmtDate, type Field } from "../components/ui";
import { CREATOR_FIELDS } from "./Creators";
import { useCnList, useCnMutation, useCnOne, friendlyError } from "../api/db";
import { nextBestAction } from "../services/nextBestAction";
import { VALIDATION_TYPES, EVIDENCE_CLASSES, CONFIDENCE, humanize, type Row } from "../types";
import { useNameMaps } from "../api/lookups";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Pencil, Plus, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

const INTERVIEW_QUESTIONS: { type: (typeof VALIDATION_TYPES)[number]; q: string }[] = [
  { type: "licensing_interest", q: "Are you interested in licensing your likeness for brand content?" },
  { type: "likeness_licensing", q: "Do you consent to Brandie producing content using your likeness?" },
  { type: "voice_licensing", q: "Do you consent to voice reproduction?" },
  { type: "paid_ad_permission", q: "May content run as paid advertising?" },
  { type: "organic_ad_permission", q: "May content run organically on brand channels?" },
  { type: "creator_posted_permission", q: "Would you post content on your own channels?" },
  { type: "approval_requirements", q: "What must you approve before content goes live?" },
  { type: "restricted_industries", q: "Which industries should we never use your likeness for?" },
  { type: "restricted_brands", q: "Which brands should we never use your likeness for?" },
  { type: "geographic_usage_rights", q: "Which territories may content run in?" },
  { type: "licence_duration", q: "How long may a licence last?" },
  { type: "compensation_expectations", q: "What compensation model do you expect (fixed, royalty, hybrid)?" },
  { type: "rates", q: "What are your rates?" },
];

export default function CreatorDetail() {
  const { creatorId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const creator = useCnOne("creators", creatorId);
  const f = { creator_id: creatorId };
  const validations = useCnList("validations", { filter: f, order: "validation_type", ascending: true });
  const audience = useCnList("audience_profiles", { filter: f });
  const interviews = useCnList("interviews", { filter: f });
  const licences = useCnList("licences", { filter: f });
  const findings = useCnList("findings", { filter: f });
  const safety = useCnList("brand_safety_reviews", { filter: f });
  const matches = useCnList("matches", { filter: f, order: "total_score" });
  const concepts = useCnList("concepts", { filter: f });
  const jobs = useCnList("production_jobs", { filter: f });
  const sales = useCnList("sales", { filter: f });
  const tasks = useCnList("tasks", { filter: f });
  const activity = useCnList("activity_log", { filter: { entity_id: creatorId }, limit: 100 });
  const names = useNameMaps();

  const cm = useCnMutation("creators");
  const vm = useCnMutation("validations");
  const am = useCnMutation("audience_profiles");
  const im = useCnMutation("interviews");
  const lm = useCnMutation("licences");
  const fm = useCnMutation("findings");
  const sm = useCnMutation("brand_safety_reviews");
  const tm = useCnMutation("tasks");

  const [dlg, setDlg] = useState<null | "edit" | "validation" | "audience" | "licence" | "finding" | "safety" | "revoke">(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [interview, setInterview] = useState<Row | null>(null);
  const [answers, setAnswers] = useState<Record<string, { response: string; status: string }>>({});
  const [summary, setSummary] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (creator.isLoading) return <CNLayout title="Creator"><Skeleton className="h-64 rounded-2xl" /></CNLayout>;
  const c = creator.data;
  if (!c) return <CNLayout title="Creator not found"><p className="text-sm text-muted-foreground">This creator doesn't exist or you no longer have access. <Link className="underline" to="/creator-network/creators">Back to creators</Link></p></CNLayout>;

  const jobConceptIds = new Set((jobs.data ?? []).map((j) => j.concept_id));
  const nba = nextBestAction({
    creator: c as any,
    validations: (validations.data ?? []) as any,
    licences: (licences.data ?? []) as any,
    matchesCount: (matches.data ?? []).length,
    approvedConceptWithoutJob: (concepts.data ?? []).some((x) => x.status === "Approved" && !jobConceptIds.has(x.id)),
    previewReadyWithoutOutreach: (jobs.data ?? []).some((j) => j.preview_path && !(sales.data ?? []).some((s) => s.production_job_id === j.id && s.sent_at)),
  });

  const createNbaTask = () =>
    tm.insert.mutate({ title: nba.label, why: nba.why, creator_id: c.id, owner_type: "Human", human_assignee: user?.id, status: "Ready", is_test: c.is_test, record_source: c.is_test ? "test" : "system" });

  const openInterview = async () => {
    const draft = (interviews.data ?? []).find((i) => i.status === "Draft");
    const row = draft ?? (await im.insert.mutateAsync({ creator_id: c.id, interviewer: user?.id, is_test: c.is_test }));
    const prev: Record<string, any> = {};
    (row.responses ?? []).forEach((r: any) => (prev[r.validation_type] = { response: r.response, status: r.status }));
    setAnswers(prev);
    setSummary(row.summary ?? "");
    setInterview(row);
  };
  const responsesPayload = () =>
    INTERVIEW_QUESTIONS.map((q) => ({ validation_type: q.type, question: q.q, response: answers[q.type]?.response ?? "", status: answers[q.type]?.status ?? "Passed" }));
  const saveDraft = async () => {
    await im.update.mutateAsync({ id: interview!.id, values: { responses: responsesPayload(), summary } });
  };
  const submitInterview = async () => {
    setSubmitting(true);
    const interest = answers.licensing_interest?.response ? (answers.licensing_interest.status === "Failed" ? "Not Interested" : "Interested") : undefined;
    const { error } = await (supabase as any).rpc("creator_network_submit_interview", {
      _interview_id: interview!.id,
      _responses: responsesPayload(),
      _summary: summary || null,
      _creator_updates: { ...(interest ? { licensing_interest: interest } : {}), contact_status: "Responded" },
      _next_action: null,
    });
    setSubmitting(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Interview submitted — validations updated");
    trackEvent("creator_interview_submitted", { creator_id: c.id });
    setInterview(null);
    qc.invalidateQueries({ queryKey: ["cn"] });
  };

  const valFields: Field[] = [
    { name: "validation_type", label: "Validation", type: "select", options: VALIDATION_TYPES.map((v) => ({ value: v, label: humanize(v) })), required: true },
    { name: "owner_type", label: "Owner", type: "select", options: ["Human", "AI"] },
    { name: "status", label: "Status", type: "select", options: ["Pending", "Requested", "Passed", "Failed", "Not Applicable"] },
    { name: "question", label: "Question" },
    { name: "response", label: "Response", type: "textarea" },
    { name: "evidence", label: "Evidence", type: "textarea" },
    { name: "evidence_classification", label: "Classification", type: "select", options: EVIDENCE_CLASSES, help: "Use Human-confirmed only when a person obtained it directly." },
    { name: "score", label: "Score (0–10)", type: "number" },
    { name: "follow_up", label: "Follow-up" },
  ];
  const audFields: Field[] = [
    { name: "age_range", label: "Age range" }, { name: "gender_composition", label: "Gender composition" },
    { name: "geography", label: "Geography" }, { name: "cities_regions", label: "Cities / regions", type: "tags" },
    { name: "interests", label: "Interests", type: "tags" }, { name: "lifestyle", label: "Lifestyle" },
    { name: "purchasing_categories", label: "Purchasing categories", type: "tags" }, { name: "affluence_segment", label: "Price / affluence segment" },
    { name: "audience_description", label: "Description", type: "textarea" }, { name: "evidence_type", label: "Evidence type" },
    { name: "confidence", label: "Confidence", type: "select", options: CONFIDENCE },
    { name: "evidence_classification", label: "Classification", type: "select", options: EVIDENCE_CLASSES, required: true, help: "Inferred demographics must stay Inferred." },
    { name: "source", label: "Source" }, { name: "date_observed", label: "Date observed", type: "date" },
  ];
  const licFields: Field[] = [
    { name: "licence_scope", label: "Scope", type: "select", options: ["Preview", "Commercial"], required: true, help: "Preview rights never imply commercial usage." },
    { name: "status", label: "Status", type: "select", options: ["Draft", "Negotiating", "Signed", "Active", "Expired"] },
    { name: "likeness_permission", label: "Likeness", type: "boolean" },
    { name: "voice_permission", label: "Voice", type: "boolean" },
    { name: "digital_twin_permission", label: "Digital twin", type: "boolean" },
    { name: "organic_social_permission", label: "Organic social", type: "boolean" },
    { name: "paid_advertising_permission", label: "Paid advertising", type: "boolean" },
    { name: "creator_posted_permission", label: "Creator-posted", type: "boolean" },
    { name: "platforms", label: "Platforms", type: "tags" }, { name: "territories", label: "Territories", type: "tags" },
    { name: "starts_at", label: "Start", type: "date" }, { name: "expires_at", label: "Expiry", type: "date" },
    { name: "restricted_categories", label: "Restricted categories", type: "tags" }, { name: "restricted_brands", label: "Restricted brands", type: "tags" },
    { name: "creator_approval_required", label: "Creator approval required", type: "boolean" },
    { name: "approval_requirements", label: "Approval requirements", type: "textarea" },
    { name: "compensation_model", label: "Compensation", type: "select", options: ["Fixed", "Royalty", "Hybrid"] },
    { name: "fixed_fee", label: "Fixed fee (NGN)", type: "number" }, { name: "royalty_rate", label: "Royalty rate (%)", type: "number" },
    { name: "agreement_path", label: "Agreement file path (private bucket)" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  const findingFields: Field[] = [
    { name: "finding", label: "Finding", type: "textarea", required: true },
    { name: "data_type", label: "Data type" },
    { name: "evidence_classification", label: "Classification", type: "select", options: EVIDENCE_CLASSES, required: true },
    { name: "confidence", label: "Confidence", type: "select", options: CONFIDENCE },
    { name: "source_url", label: "Source URL" }, { name: "source_name", label: "Source name" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  const safetyFields: Field[] = [
    { name: "public_issue", label: "Public issue requiring human review", type: "textarea", help: "Describe only public content. Never infer private beliefs, protected traits or character." },
    { name: "evidence", label: "Evidence (links to public content)", type: "textarea" },
    { name: "human_decision", label: "Decision", type: "select", options: ["Clear", "Needs Review", "Flagged"], required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const urls: string[] = Array.isArray(c.public_urls) ? c.public_urls : [];

  return (
    <CNLayout title={c.display_name} subtitle={`${c.code} · ${c.primary_niche ?? "Niche not set"} · ${c.location ?? "Location not set"}`}
      actions={<Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setDlg("edit")}><Pencil className="h-4 w-4 mr-1" />Edit</Button>}>
      <section aria-label="Next best action" className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" />Next best action</p>
        <p className="mt-1 font-serif text-2xl">{nba.label}</p>
        <p className="text-sm text-muted-foreground">{nba.why}</p>
        {nba.key !== "none" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {nba.key === "licensing_interview" || nba.key === "confirm_interest" ? (
              <Button className="min-h-11 rounded-xl" onClick={openInterview}>Open interview <ArrowRight className="h-4 w-4 ml-1" /></Button>
            ) : nba.key === "contact" ? (
              <Button className="min-h-11 rounded-xl" onClick={() => { cm.update.mutate({ id: c.id, values: { contact_status: "Contacted", status: "Contacted" } }); trackEvent("creator_contacted", { creator_id: c.id }); }}>Mark contacted</Button>
            ) : nba.key === "sign_licence" ? (
              <Button className="min-h-11 rounded-xl" onClick={() => setDlg("licence")}>Record licence</Button>
            ) : nba.key === "brand_safety" ? (
              <Button className="min-h-11 rounded-xl" onClick={() => setDlg("safety")}>Record review</Button>
            ) : nba.key === "review_matches" || nba.key === "find_matches" ? (
              <Button asChild className="min-h-11 rounded-xl"><Link to={`/creator-network/matches?creator=${c.id}`}>Open matches</Link></Button>
            ) : null}
            <Button variant="outline" className="min-h-11 rounded-xl" onClick={createNbaTask}>Turn into task</Button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 text-xs">
        <StatusPill value={c.status} /><StatusPill value={`Licensing: ${c.licensing_interest}`} /><StatusPill value={`Contact: ${c.contact_status}`} />
        <StatusPill value={`Brand safety: ${c.brand_safety_status}`} /><TestBadge isTest={c.is_test} />
      </div>

      <Tabs defaultValue="identity">
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList className="inline-flex w-max rounded-2xl">
            {["identity", "audience", "validation", "interviews", "rights", "evidence", "safety", "matches", "tasks", "activity"].map((t) => (
              <TabsTrigger key={t} value={t} className="min-h-10 rounded-xl capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="identity">
          <Section title="Identity & scores" description="Licensing-model factors are weighted above raw reach.">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {[["Legal name", c.legal_name], ["Handle", c.handle], ["Languages", (c.languages ?? []).join(", ")], ["Formats", (c.content_formats ?? []).join(", ")],
                ["Secondary niches", (c.secondary_niches ?? []).join(", ")], ["Persona", c.persona], ["Camera presence", c.camera_presence], ["AI likeness", c.ai_likeness_suitability],
                ["Voice", c.voice_suitability], ["Versatility", c.content_versatility], ["Category breadth", c.commercial_category_breadth], ["Recruitability", c.recruitability],
                ["Audience relevance", c.audience_commercial_relevance], ["Evidence confidence", c.evidence_confidence], ["Notes", c.notes]].map(([k, v]) => (
                <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v === null || v === undefined || v === "" ? "—" : String(v)}</dd></div>
              ))}
            </dl>
            {urls.length > 0 && <ul className="mt-3 text-sm">{urls.map((u) => <li key={u}><a className="underline" href={u} target="_blank" rel="noreferrer">{u}</a></li>)}</ul>}
            <p className="mt-3 text-xs text-muted-foreground">Contact details are stored privately and only visible to Creator Network operators.</p>
          </Section>
        </TabsContent>

        <TabsContent value="audience">
          <Section title="Audience profiles" actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => { setEditRow(null); setDlg("audience"); }}><Plus className="h-4 w-4 mr-1" />Add</Button>}>
            <EntityTable rows={audience.data} loading={audience.isLoading} empty={{ title: "No audience evidence yet" }}
              columns={[{ key: "geography", label: "Geography" }, { key: "age_range", label: "Age" }, { key: "affluence_segment", label: "Segment" },
                { key: "evidence_classification", label: "Classification", render: (r) => <StatusPill value={r.evidence_classification} /> }, { key: "source", label: "Source" }]} />
          </Section>
        </TabsContent>

        <TabsContent value="validation">
          <Section title="Validations" actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => { setEditRow(null); setDlg("validation"); }}><Plus className="h-4 w-4 mr-1" />Add</Button>}>
            <EntityTable rows={validations.data} loading={validations.isLoading} empty={{ title: "No validations yet", description: "Submit an interview or add a validation." }}
              onRowClick={(r) => { setEditRow(r); setDlg("validation"); }}
              columns={[{ key: "validation_type", label: "Type", render: (r) => humanize(r.validation_type) }, { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
                { key: "response", label: "Response", className: "max-w-xs truncate" }, { key: "evidence_classification", label: "Classification", render: (r) => <StatusPill value={r.evidence_classification} /> },
                { key: "owner_type", label: "Owner" }]} />
          </Section>
        </TabsContent>

        <TabsContent value="interviews">
          <Section title="Interviews" description="Draft freely. Submitting updates validations and the creator record in one step." actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={openInterview}>Open interview</Button>}>
            <EntityTable rows={interviews.data} loading={interviews.isLoading} empty={{ title: "No interviews yet" }}
              columns={[{ key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> }, { key: "summary", label: "Summary" }, { key: "submitted_at", label: "Submitted", render: (r) => fmtDate(r.submitted_at) }]} />
          </Section>
        </TabsContent>

        <TabsContent value="rights">
          <Section title="Rights & licences" actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => { setEditRow(null); setDlg("licence"); }}><Plus className="h-4 w-4 mr-1" />Add licence</Button>}>
            <EntityTable rows={licences.data} loading={licences.isLoading} empty={{ title: "No licences recorded", description: "Commercial production is blocked until a signed commercial licence exists." }}
              onRowClick={(r) => { setEditRow(r); setDlg("licence"); }}
              columns={[{ key: "licence_scope", label: "Scope" }, { key: "status", label: "Status", render: (r) => <StatusPill value={r.revoked ? "Revoked" : r.status} /> },
                { key: "perms", label: "Permissions", render: (r) => ["likeness", "voice", "digital_twin", "organic_social", "paid_advertising", "creator_posted"].filter((p) => r[`${p}_permission`]).map(humanize).join(", ") || "None" },
                { key: "expires_at", label: "Expires", render: (r) => fmtDate(r.expires_at) },
                { key: "rev", label: "", render: (r) => !r.revoked && <Button size="sm" variant="ghost" className="min-h-11 text-destructive" onClick={(e) => { e.stopPropagation(); setEditRow(r); setDlg("revoke"); }}>Revoke</Button> }]} />
          </Section>
        </TabsContent>

        <TabsContent value="evidence">
          <Section title="Evidence" description="Supersede findings from the Evidence page — never overwrite." actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => setDlg("finding")}><Plus className="h-4 w-4 mr-1" />Add finding</Button>}>
            <EntityTable rows={findings.data} loading={findings.isLoading} empty={{ title: "No findings yet" }}
              columns={[{ key: "finding", label: "Finding", className: "max-w-sm" }, { key: "evidence_classification", label: "Class", render: (r) => <StatusPill value={r.evidence_classification} /> },
                { key: "confidence", label: "Confidence" }, { key: "is_current", label: "State", render: (r) => <StatusPill value={r.is_current ? "Current" : "Superseded"} /> }]} />
          </Section>
        </TabsContent>

        <TabsContent value="safety">
          <Section title="Brand safety (public content only)" actions={<Button size="sm" className="min-h-11 rounded-xl" onClick={() => setDlg("safety")}><Plus className="h-4 w-4 mr-1" />Record review</Button>}>
            <EntityTable rows={safety.data} loading={safety.isLoading} empty={{ title: "Not reviewed yet" }}
              columns={[{ key: "reviewed_at", label: "Date", render: (r) => fmtDate(r.reviewed_at) }, { key: "human_decision", label: "Decision", render: (r) => <StatusPill value={r.human_decision} /> },
                { key: "public_issue", label: "Issue" }, { key: "notes", label: "Notes" }]} />
          </Section>
        </TabsContent>

        <TabsContent value="matches">
          <Section title="Matches">
            <EntityTable rows={matches.data} loading={matches.isLoading} empty={{ title: "No matches yet" }}
              columns={[{ key: "code", label: "ID" }, { key: "party", label: "Brand / prospect", render: (r) => names.partyName(r) }, { key: "total_score", label: "Score" },
                { key: "confidence", label: "Confidence" }, { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> }]} />
          </Section>
        </TabsContent>

        <TabsContent value="tasks">
          <Section title="Tasks">
            <EntityTable rows={tasks.data} loading={tasks.isLoading} empty={{ title: "No tasks for this creator" }}
              columns={[{ key: "code", label: "ID" }, { key: "title", label: "Task" }, { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> }, { key: "owner_type", label: "Owner" }]} />
          </Section>
        </TabsContent>

        <TabsContent value="activity">
          <Section title="Activity">
            <EntityTable rows={activity.data} loading={activity.isLoading} empty={{ title: "No activity yet" }}
              columns={[{ key: "created_at", label: "When", render: (r) => new Date(r.created_at).toLocaleString() }, { key: "action", label: "Action", render: (r) => humanize(r.action) },
                { key: "transition", label: "Change", render: (r) => r.previous_state || r.new_state ? `${r.previous_state ?? "—"} → ${r.new_state ?? "—"}` : "—" }, { key: "actor_type", label: "Actor" }, { key: "reason", label: "Reason" }]} />
          </Section>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RecordDialog open={dlg === "edit"} onOpenChange={(o) => !o && setDlg(null)} title="Edit creator" fields={CREATOR_FIELDS} initial={c}
        onSubmit={(v) => cm.update.mutateAsync({ id: c.id, values: v })} />
      <RecordDialog open={dlg === "validation"} onOpenChange={(o) => !o && setDlg(null)} title={editRow ? "Update validation" : "Add validation"} fields={valFields} initial={editRow ?? { owner_type: "Human", status: "Pending", evidence_classification: "Unknown" }}
        onSubmit={(v) => editRow ? vm.update.mutateAsync({ id: editRow.id, values: v }) : vm.insert.mutateAsync({ ...v, creator_id: c.id, human_owner: user?.id, is_test: c.is_test })} />
      <RecordDialog open={dlg === "audience"} onOpenChange={(o) => !o && setDlg(null)} title="Add audience evidence" fields={audFields} initial={{ evidence_classification: "Inferred" }}
        onSubmit={(v) => am.insert.mutateAsync({ ...v, creator_id: c.id, is_test: c.is_test })} />
      <RecordDialog open={dlg === "licence"} onOpenChange={(o) => !o && setDlg(null)} title={editRow ? "Update licence" : "Record licence"} fields={licFields}
        initial={editRow ?? { licence_scope: "Commercial", status: "Draft", creator_approval_required: true }}
        onSubmit={async (v) => {
          const r = editRow ? await lm.update.mutateAsync({ id: editRow.id, values: v }) : await lm.insert.mutateAsync({ ...v, creator_id: c.id, is_test: c.is_test });
          if (["Signed", "Active"].includes(r.status)) trackEvent("creator_licence_signed", { creator_id: c.id, licence_id: r.id });
        }} />
      <RecordDialog open={dlg === "revoke"} onOpenChange={(o) => !o && setDlg(null)} title="Revoke licence" description="Revoking stops all future use under this licence. This is recorded in the activity log."
        fields={[{ name: "revocation_reason", label: "Reason", type: "textarea", required: true }]} submitLabel="Revoke licence"
        onSubmit={(v) => lm.update.mutateAsync({ id: editRow!.id, values: { revoked: true, status: "Revoked", revoked_at: new Date().toISOString(), revocation_reason: v.revocation_reason } })} />
      <RecordDialog open={dlg === "finding"} onOpenChange={(o) => !o && setDlg(null)} title="Add finding" fields={findingFields} initial={{ evidence_classification: "Unknown" }}
        onSubmit={(v) => fm.insert.mutateAsync({ ...v, related_entity_type: "creator", creator_id: c.id, research_agent: "human", retrieved_at: new Date().toISOString(), created_by: user?.id, is_test: c.is_test })} />
      <RecordDialog open={dlg === "safety"} onOpenChange={(o) => !o && setDlg(null)} title="Brand safety review" fields={safetyFields}
        onSubmit={async (v) => {
          await sm.insert.mutateAsync({ ...v, creator_id: c.id, reviewed: true, reviewed_at: new Date().toISOString(), reviewer: user?.id, is_test: c.is_test });
          await cm.update.mutateAsync({ id: c.id, values: { brand_safety_status: v.human_decision } });
        }} />

      <Dialog open={!!interview} onOpenChange={(o) => !o && setInterview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Licensing interview — {c.display_name}</DialogTitle>
            <DialogDescription>Record only what the creator actually told you. Answers become Human-confirmed validations on submit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {INTERVIEW_QUESTIONS.map((q) => (
              <div key={q.type} className="space-y-1.5">
                <Label htmlFor={`iq-${q.type}`}>{q.q}</Label>
                <div className="flex gap-2">
                  <Textarea id={`iq-${q.type}`} rows={2} value={answers[q.type]?.response ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.type]: { status: a[q.type]?.status ?? "Passed", response: e.target.value } }))} />
                  <Select value={answers[q.type]?.status ?? "Passed"} onValueChange={(s) => setAnswers((a) => ({ ...a, [q.type]: { response: a[q.type]?.response ?? "", status: s } }))}>
                    <SelectTrigger className="min-h-11 w-36" aria-label="Outcome"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Passed", "Failed", "Requested", "Not Applicable"].map((s) => <SelectItem key={s} value={s}>{s === "Passed" ? "Yes / OK" : s === "Failed" ? "No" : s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <div className="space-y-1.5"><Label htmlFor="iq-summary">Summary</Label><Textarea id="iq-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="min-h-11" onClick={saveDraft}>Save draft</Button>
            <Button className="min-h-11" disabled={submitting} onClick={() => setConfirmSubmit(true)}>{submitting ? "Submitting…" : "Submit interview"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirmSubmit} onOpenChange={setConfirmSubmit} title="Submit interview?" confirmLabel="Submit"
        description="Submitted interviews can't be edited. Answers will update the creator's validations and status in one step."
        onConfirm={submitInterview} />
    </CNLayout>
  );
}
