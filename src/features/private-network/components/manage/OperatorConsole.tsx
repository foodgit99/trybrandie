import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { StatusPill } from "../PNShell";
import { pnFrom, pnError, rpc, signedMedia, signedProof, usePnAction, usePnQuery } from "../../api";
import { formatNgn } from "../../services/profile";
import { platformLabel } from "../../types";
import { usePrivateNetwork } from "../../hooks/usePrivateNetwork";

const ask = (label: string) => window.prompt(label)?.trim() || null;
const list = (t: string, build: (q: any) => any = (q) => q) => async () => {
  const { data, error } = await build(pnFrom(t).select("*")).order("created_at", { ascending: false }).limit(200);
  if (error) throw error; return data ?? [];
};

function Publishers() {
  const [status, setStatus] = useState("pending");
  const q = usePnQuery<any[]>(["op-pubs", status], list("publishers", (x) => (status === "all" ? x : x.eq("status", status))));
  const act = usePnAction(({ id, d, r }: any) => rpc("review_publisher", { _id: id, _decision: d, _reason: r }), "Publisher updated");
  const release = usePnAction((id: string) => rpc("release_pending", { _publisher: id }).then((n: number) => toast.success(`Released ${formatNgn(n)}`)));
  return (
    <div className="space-y-2">
      <select aria-label="Filter" className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
        {["pending", "approved", "suspended", "rejected", "deleted", "all"].map((s) => <option key={s}>{s}</option>)}
      </select>
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No publishers in this state.</p>}
      {(q.data ?? []).map((p) => (
        <div key={p.id} className="rounded-xl border p-3 text-sm space-y-1">
          <div className="flex items-center justify-between"><strong>{p.display_name ?? "—"}</strong><span className="flex gap-1"><StatusPill>{p.status}</StatusPill>{p.is_test && <StatusPill>TEST</StatusPill>}</span></div>
          <p className="text-xs text-muted-foreground">{[p.occupation, p.location_city, p.location_state, p.location_country].filter(Boolean).join(" · ")} · {p.platforms.map(platformLabel).join(", ")} · ~{p.audience_size_estimate ?? "?"} audience (self-reported)</p>
          {p.creator_link_status !== "none" && <p className="text-xs">Creator link: {p.creator_link_code} ({p.creator_link_status})</p>}
          <div className="flex flex-wrap gap-2">
            {p.status !== "approved" && p.status !== "deleted" && <Button size="sm" onClick={() => act.mutate({ id: p.id, d: "approve" })}>Approve</Button>}
            {p.status === "approved" && <Button size="sm" variant="outline" onClick={() => { const r = ask("Suspension reason"); r && act.mutate({ id: p.id, d: "suspend", r }); }}>Suspend</Button>}
            {p.status === "pending" && <Button size="sm" variant="ghost" onClick={() => { const r = ask("Rejection reason"); r && act.mutate({ id: p.id, d: "reject", r }); }}>Reject</Button>}
            {p.creator_link_status === "pending" && <>
              <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, d: "link_verify" })}>Verify creator link</Button>
              <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: p.id, d: "link_reject" })}>Reject link</Button>
            </>}
            <Button size="sm" variant="ghost" onClick={() => release.mutate(p.id)}>Release pending earnings</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignReview() {
  const q = usePnQuery<any[]>(["op-camps"], list("campaigns", (x) => x.in("status", ["pending_review", "paused", "active"])));
  const domains = usePnQuery<any[]>(["op-domains"], list("allowed_domains"));
  const t = usePnAction(({ id, to, note }: any) => rpc("campaign_transition", { _id: id, _to: to, _note: note ?? null }), "Campaign updated");
  const fund = usePnAction(({ id, s, ref }: any) => rpc("record_funding", { _id: id, _status: s, _reference: ref }), "Funding recorded");
  const allow = usePnAction(({ b, h }: any) => rpc("allow_domain", { _brand: b, _host: h, _allow: true }), "Domain approved");
  const allowed = (c: any) => (domains.data ?? []).some((d) => d.brand_id === c.brand_id && d.host === c.landing_host);
  return (
    <div className="space-y-2">
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
      {(q.data ?? []).map((c) => (
        <div key={c.id} className="rounded-xl border p-3 text-sm space-y-1">
          <div className="flex items-center justify-between"><strong>{c.code} · {c.name}</strong><span className="flex gap-1"><StatusPill>{c.status}</StatusPill>{c.is_test && <StatusPill>TEST</StatusPill>}</span></div>
          <p className="text-xs text-muted-foreground">{c.landing_url} · fee {formatNgn(c.base_fee_ngn)} · budget {formatNgn(c.budget_ngn)} · funding {c.funding_status}{c.funding_reference && ` (${c.funding_reference})`}</p>
          <div className="flex flex-wrap gap-2">
            {!allowed(c) && <Button size="sm" variant="outline" onClick={() => allow.mutate({ b: c.brand_id, h: c.landing_host })}>Approve domain {c.landing_host}</Button>}
            {c.funding_status === "unfunded" && <Button size="sm" variant="outline" onClick={() => { const ref = ask("Payment reference received from advertiser"); ref && fund.mutate({ id: c.id, s: "funded_manual", ref }); }}>Record funding</Button>}
            {c.funding_status === "unfunded" && c.is_test && <Button size="sm" variant="outline" onClick={() => fund.mutate({ id: c.id, s: "test", ref: "TEST" })}>Mark TEST funded</Button>}
            {c.status === "pending_review" && <Button size="sm" onClick={() => t.mutate({ id: c.id, to: "active" })}>Activate</Button>}
            {c.status === "pending_review" && <Button size="sm" variant="ghost" onClick={() => { const n = ask("Reason"); n && t.mutate({ id: c.id, to: "rejected", note: n }); }}>Reject</Button>}
            {c.status === "active" && <Button size="sm" variant="ghost" onClick={() => t.mutate({ id: c.id, to: "paused" })}>Pause</Button>}
            {c.status === "paused" && <Button size="sm" onClick={() => t.mutate({ id: c.id, to: "active" })}>Resume</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Creatives() {
  const q = usePnQuery<any[]>(["op-creatives"], async () => {
    const rows = await list("creatives", (x) => x.eq("status", "pending"))();
    const media = await signedMedia(rows.map((r: any) => r.id)).catch(() => ({} as any));
    const eligibility = await Promise.all(rows.map((r: any) => rpc<string[]>("review_reasons", { _creative: r.id }).catch((e) => [String(e?.message ?? e)])));
    return rows.map((r: any, i: number) => ({ ...r, url: media[r.id]?.url ?? r.public_media_url, reasons: eligibility[i] }));
  });
  const [confirm, setConfirm] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const act = usePnAction(({ id, d, r, c, e }: any) => rpc("review_creative", { _id: id, _decision: d, _reason: r ?? null, _confirm_private_rights: !!c, _evidence: e ?? null }), "Creative reviewed");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No creatives waiting.</p>}
      {(q.data ?? []).map((c) => (
        <div key={c.id} className="rounded-xl border p-3 space-y-2 text-sm">
          <div className="aspect-video overflow-hidden rounded bg-muted">{c.url && (c.media_type === "video" ? <video src={c.url} controls className="h-full w-full object-contain" /> : <img src={c.url} alt="" className="h-full w-full object-contain" />)}</div>
          <p className="text-xs">{c.media_source} · {c.media_type}{c.is_test && " · TEST"} · rights {c.rights_platforms.join(", ") || "all campaign platforms"}{c.rights_expires_at && ` until ${new Date(c.rights_expires_at).toLocaleDateString()}`}</p>
          {c.rights_attestation && <p className="text-xs">Attestation: {c.rights_attestation}</p>}
          {c.reasons.length > 0 && <ul className="list-disc pl-5 text-xs text-destructive">{c.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>}
          {c.media_source === "creator_network" && (
            <>
              <label className="flex items-start gap-2 text-xs"><Checkbox checked={!!confirm[c.id]} onCheckedChange={(v) => setConfirm((o) => ({ ...o, [c.id]: !!v }))} />
                I confirm the creator agreement explicitly covers private redistribution by third-party publishers (not inferred from paid-ads or creator-posted permission).</label>
              <Input aria-label="Agreement evidence" placeholder="Agreement clause / document reference (required)" value={evidence[c.id] ?? ""}
                onChange={(e) => setEvidence((o) => ({ ...o, [c.id]: e.target.value }))} />
            </>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => act.mutate({ id: c.id, d: "approve", c: confirm[c.id], e: evidence[c.id] })}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => { const r = ask("Reason"); r && act.mutate({ id: c.id, d: "reject", r }); }}>Reject</Button>
          </div>
        </div>
      ))}
      <ApprovedCreatives />
    </div>
  );
}

function ApprovedCreatives() {
  const q = usePnQuery<any[]>(["op-creatives-approved"], list("creatives", (x) => x.eq("status", "approved")));
  const act = usePnAction(({ id, r }: any) => rpc("review_creative", { _id: id, _decision: "revoke", _reason: r }), "Creative revoked");
  if (!(q.data ?? []).length) return null;
  return (
    <div className="sm:col-span-2 space-y-1">
      <p className="text-xs font-semibold">Approved creatives</p>
      {(q.data ?? []).map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded border p-2 text-xs">
          <span>{c.id.slice(0, 8)} · {c.media_source} · {c.media_type}{c.is_test && " · TEST"}</span>
          <Button size="sm" variant="ghost" onClick={() => { const r = ask("Revocation reason"); r && act.mutate({ id: c.id, r }); }}>Revoke</Button>
        </div>
      ))}
    </div>
  );
}

function Proofs() {
  const q = usePnQuery<any[]>(["op-proofs"], list("placements", (x) => x.eq("status", "proof_submitted")));
  const act = usePnAction(({ id, d, r }: any) => rpc("review_proof", { _placement: id, _decision: d, _reason: r ?? null }), "Proof reviewed");
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  return (
    <div className="space-y-2">
      {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No proofs waiting.</p>}
      {(q.data ?? []).map((p) => (
        <div key={p.id} className="rounded-xl border p-3 text-sm space-y-2">
          <p className="text-xs">{platformLabel(p.platform)} · fee {formatNgn(p.snapshot_base_fee)} · shared via {p.share_method ?? "—"} · resubmissions {p.resubmission_count}{p.is_test && " · TEST"}</p>
          {p.proof_url && <a className="text-xs underline" href={p.proof_url} target="_blank" rel="noopener noreferrer nofollow">Open post link</a>}
          {p.proof_note && <p className="text-xs">Note: {p.proof_note}</p>}
          {p.proof_path && (urls[p.id] ? <img src={urls[p.id]!} alt="Proof screenshot" className="max-h-80 rounded border" /> :
            <Button size="sm" variant="outline" onClick={async () => { const u = await signedProof(p.id); if (!u) toast.error("Screenshot unavailable"); setUrls((o) => ({ ...o, [p.id]: u })); }}>View screenshot</Button>)}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => act.mutate({ id: p.id, d: "verify" })}>Verify & credit fee</Button>
            <Button size="sm" variant="outline" onClick={() => { const r = ask("What should they fix?"); r && act.mutate({ id: p.id, d: "reject", r }); }}>Reject (can resubmit)</Button>
            <Button size="sm" variant="ghost" onClick={() => { const r = ask("Final rejection reason"); r && act.mutate({ id: p.id, d: "reject_final", r }); }}>Reject final</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Finance() {
  const q = usePnQuery<any[]>(["op-payouts"], list("payouts", (x) => x.in("status", ["requested", "approved"])));
  const ledger = usePnQuery<any[]>(["op-ledger"], list("ledger"));
  const act = usePnAction(({ id, d, ref, r }: any) => rpc("review_payout", { _id: id, _decision: d, _reference: ref ?? null, _reason: r ?? null }), "Payout updated");
  const rev = usePnAction(({ id, r }: any) => rpc("reverse_entry", { _entry: id, _reason: r }), "Entry reversed");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Payout requests</p>
        <p className="text-xs text-muted-foreground">Send money outside Brandie (bank transfer), then record the settlement reference. Brandie does not move money automatically.</p>
        {(q.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">None open.</p>}
        {(q.data ?? []).map((p) => (
          <div key={p.id} className="rounded-xl border p-3 text-sm space-y-1">
            <p><strong>{formatNgn(p.amount)}</strong> · {p.status}{p.is_test && " · TEST"} · {p.payout_details?.bank_name} {p.payout_details?.account_number} {p.payout_details?.account_name}</p>
            <div className="flex gap-2">
              {p.status === "requested" && <Button size="sm" onClick={() => act.mutate({ id: p.id, d: "approve" })}>Approve</Button>}
              {p.status === "approved" && <Button size="sm" onClick={() => { const ref = ask("Bank transfer reference"); ref && act.mutate({ id: p.id, d: "paid", ref }); }}>Record paid</Button>}
              <Button size="sm" variant="ghost" onClick={() => { const r = ask("Reason"); r && act.mutate({ id: p.id, d: "reject", r }); }}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Ledger (append-only)</p>
        {(ledger.data ?? []).slice(0, 100).map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded border p-1.5 text-xs">
            <span>{new Date(e.created_at).toLocaleString()} · {e.entry_type} · {e.bucket}{e.is_test && " · TEST"} {e.note && `· ${e.note}`}</span>
            <span className="flex items-center gap-2">{formatNgn(e.amount)}
              {["base_fee", "action_bonus", "conversion_commission"].includes(e.entry_type) && <Button size="sm" variant="ghost" onClick={() => { const r = ask("Reversal reason"); r && rev.mutate({ id: e.id, r }); }}>Reverse</Button>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Brand-user-reported events never earn until finance checks them against the advertiser's records. */
function Reconciliation() {
  const q = usePnQuery<any[]>(["op-recon"], list("events", (x) => x.eq("outcome", "pending_reconciliation")));
  const act = usePnAction(({ id, ok, amt, note }: any) => rpc("reconcile_event", { _event: id, _approve: ok, _verified_amount: amt ?? null, _note: note }), "Event reconciled");
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Events awaiting reconciliation</p>
      <p className="text-xs text-muted-foreground">Reported by a brand user, not a trusted integration. Check against the advertiser's order/lead records before approving.</p>
      {(q.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">None waiting.</p>}
      {(q.data ?? []).map((e) => (
        <div key={e.id} className="rounded-xl border p-3 text-sm space-y-1">
          <p>{e.event_type} · ref {e.external_event_id}{e.amount != null && ` · reported ${formatNgn(e.amount)}`}{e.is_test && " · TEST"} · {new Date(e.created_at).toLocaleString()}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              const note = ask("Source reference you checked (order id, CRM record)"); if (!note) return;
              let amt: number | undefined;
              if (e.event_type === "conversion") { const v = ask(`Verified sale amount in ₦ (reported ${e.amount})`); if (!v) return; amt = Number(v); }
              act.mutate({ id: e.id, ok: true, amt, note });
            }}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => { const note = ask("Why is it rejected?"); note && act.mutate({ id: e.id, ok: false, note }); }}>Reject</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Server-to-server keys let an advertiser's own backend report trusted events. Shown once, stored hashed. */
function IntegrationKeys() {
  const pn = usePrivateNetwork();
  const q = usePnQuery<any[]>(["op-keys"], list("integration_keys"));
  const [brand, setBrand] = useState("");
  const [label, setLabel] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const create = usePnAction(() => rpc<{ key: string }>("create_integration_key", { _brand: brand, _label: label }).then((r) => { setShown(r.key); setLabel(""); }), "Key created");
  const revoke = usePnAction((id: string) => rpc("revoke_integration_key", { _id: id }), "Key revoked");
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Integration keys</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Brand" className="h-9 rounded-md border bg-background px-2 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Choose brand</option>
          {pn.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Input aria-label="Key label" className="h-9 w-48" placeholder="Label (e.g. Shop backend)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button size="sm" disabled={!brand || !label.trim() || create.isPending} onClick={() => create.mutate(undefined)}>Create key</Button>
      </div>
      {shown && (
        <div className="rounded-xl border p-3 text-xs space-y-1">
          <p className="font-semibold">Copy this key now — it will not be shown again.</p>
          <code className="break-all">{shown}</code>
          <div><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(shown); toast.success("Copied"); }}>Copy</Button> <Button size="sm" variant="ghost" onClick={() => setShown(null)}>Done</Button></div>
        </div>
      )}
      {(q.data ?? []).map((k) => (
        <div key={k.id} className="flex items-center justify-between rounded border p-1.5 text-xs">
          <span>{k.label} · …{k.key_hint} · {pn.brands.find((b) => b.id === k.brand_id)?.name ?? k.brand_id}{k.revoked_at && " · revoked"}</span>
          {!k.revoked_at && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}>Revoke</Button>}
        </div>
      ))}
    </div>
  );
}

function Metrics() {
  const [inc, setInc] = useState(false);
  const q = usePnQuery<any>(["op-metrics", inc], () => rpc("metrics", { _include_test: inc }));
  const d = q.data ?? {};
  const card = (l: string, v: any) => <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{l}</p><pre className="whitespace-pre-wrap text-xs">{typeof v === "object" ? JSON.stringify(v ?? {}, null, 1) : String(v ?? 0)}</pre></div>;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={inc} onCheckedChange={(v) => setInc(!!v)} />Include TEST records</label>
      {q.isError && <p className="text-xs text-destructive">{pnError(q.error)}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        {card("Publishers", d.publishers)}{card("Campaigns", d.campaigns)}{card("Posts", d.placements)}
        {card("Clicks", d.clicks)}{card("Qualified leads", d.leads)}{card("Conversions", d.conversions)}
        {card("Funded budget (₦)", d.budget)}{card("Ledger by bucket (₦)", d.ledger)}{card("Payouts (₦)", d.payouts)}
      </div>
    </div>
  );
}

function Audit() {
  const q = usePnQuery<any[]>(["op-audit"], list("activity_log"));
  return (
    <ul className="space-y-1">
      {(q.data ?? []).map((a) => (
        <li key={a.id} className="rounded border p-1.5 text-xs">{new Date(a.created_at).toLocaleString()} · {a.entity_type} · <strong>{a.action}</strong>{a.is_test && " · TEST"} · {JSON.stringify(a.details)}</li>
      ))}
    </ul>
  );
}

export default function OperatorConsole() {
  const pn = usePrivateNetwork();
  return (
    <Tabs defaultValue="publishers">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="publishers">Publishers</TabsTrigger>
        <TabsTrigger value="campaigns">Campaign review</TabsTrigger>
        <TabsTrigger value="creatives">Creatives</TabsTrigger>
        <TabsTrigger value="proofs">Proofs</TabsTrigger>
        {pn.hasRole("finance") && <TabsTrigger value="finance">Finance</TabsTrigger>}
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>
      <TabsContent value="publishers"><Publishers /></TabsContent>
      <TabsContent value="campaigns"><CampaignReview /></TabsContent>
      <TabsContent value="creatives"><Creatives /></TabsContent>
      <TabsContent value="proofs"><Proofs /></TabsContent>
      {pn.hasRole("finance") && <TabsContent value="finance"><div className="space-y-6"><Finance /><Reconciliation />{pn.hasRole() && <IntegrationKeys />}</div></TabsContent>}
      <TabsContent value="metrics"><Metrics /></TabsContent>
      <TabsContent value="audit"><Audit /></TabsContent>
    </Tabs>
  );
}
