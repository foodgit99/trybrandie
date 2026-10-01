import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CNLayout from "../components/CNLayout";
import EntityTable from "../components/EntityTable";
import { RecordDialog, Section, StatusPill, type Field } from "../components/ui";
import { useCnList, useCnMutation } from "../api/db";
import { useNameMaps, useNormalizedProducts } from "../api/lookups";
import { MATCH_WEIGHTS, SCORE_VERSION, scoreMatch, type MatchFactor } from "../services/matchScoring";
import { CONFIDENCE, humanize, type Row } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export default function Matches() {
  const [params] = useSearchParams();
  const names = useNameMaps();
  const matches = useCnList("matches", { order: "total_score" });
  const creators = useCnList("creators", { select: "id, display_name, primary_niche, location, status" });
  const m = useCnMutation("matches");
  const om = useCnMutation("opportunities");
  const [creatorF, setCreatorF] = useState(params.get("creator") ?? "all");
  const [partyF, setPartyF] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [conf, setConf] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [niche, setNiche] = useState("");
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<{ brand_id?: string; prospect_id?: string }>({});
  const [detail, setDetail] = useState<Row | null>(null);
  const products = useNormalizedProducts(owner);

  const cMap = new Map((creators.data ?? []).map((c) => [c.id, c]));
  const rows = useMemo(() => (matches.data ?? []).filter((r) =>
    (creatorF === "all" || r.creator_id === creatorF) &&
    (partyF === "all" || r.brand_id === partyF || r.prospect_id === partyF) &&
    (!minScore || Number(r.total_score ?? 0) >= Number(minScore)) &&
    (conf === "all" || r.confidence === conf) &&
    (statusF === "all" || cMap.get(r.creator_id)?.status === statusF) &&
    (!niche || String(cMap.get(r.creator_id)?.primary_niche ?? "").toLowerCase().includes(niche.toLowerCase()))
  ), [matches.data, creatorF, partyF, minScore, conf, statusF, niche, creators.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const partyOptions = [
    ...names.brands.map((b) => ({ value: `b:${b.id}`, label: `Brand · ${b.name}` })),
    ...names.prospects.map((p) => ({ value: `p:${p.id}`, label: `Prospect · ${p.business_name}` })),
  ];
  const fields: Field[] = [
    { name: "creator_id", label: "Creator", type: "select", required: true, options: names.creators.map((c) => ({ value: c.id, label: c.display_name })) },
    { name: "party", label: "Brand or prospect", type: "select", required: true, options: partyOptions },
    { name: "product_id", label: "Product", type: "select", options: (products.data ?? []).map((p) => ({ value: `${p.source}:${p.id}`, label: p.name })), help: "Pick the brand/prospect first, then reopen to load products." },
    ...(Object.keys(MATCH_WEIGHTS) as MatchFactor[]).map((k) => ({ name: k, label: `${humanize(k)} (0–10)`, type: "number" as const })),
    { name: "reasoning", label: "Reasoning", type: "textarea", required: true, help: "Scores are never shown without reasoning." },
    { name: "risks", label: "Risks", type: "textarea" },
  ];

  const save = async (v: Record<string, any>) => {
    const [kind, pid] = String(v.party).split(":");
    const scores: Record<string, number | null> = {};
    (Object.keys(MATCH_WEIGHTS) as MatchFactor[]).forEach((k) => (scores[k] = v[k]));
    const s = scoreMatch(scores);
    const [psrc, prodId] = v.product_id ? String(v.product_id).split(":") : [null, null];
    const row = await m.insert.mutateAsync({
      creator_id: v.creator_id, brand_id: kind === "b" ? pid : null, prospect_id: kind === "p" ? pid : null,
      product_source: psrc, product_id: prodId, scores, total_score: s.total, confidence: s.confidence,
      reasoning: v.reasoning, risks: v.risks, score_version: SCORE_VERSION,
    });
    trackEvent("creator_match_reviewed", { match_id: row.id });
  };

  return (
    <CNLayout title="Match Explorer" subtitle="Creator × brand/prospect × product. Licensing suitability outweighs follower count."
      actions={<Button className="min-h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New match</Button>}>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select value={creatorF} onValueChange={setCreatorF}><SelectTrigger className="min-h-11" aria-label="Creator filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All creators</SelectItem>{names.creators.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent></Select>
        <Select value={partyF} onValueChange={setPartyF}><SelectTrigger className="min-h-11" aria-label="Brand or prospect filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All brands/prospects</SelectItem>
            {names.brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            {names.prospects.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}</SelectContent></Select>
        <Input className="min-h-11" placeholder="Niche" aria-label="Niche filter" value={niche} onChange={(e) => setNiche(e.target.value)} />
        <Input className="min-h-11" type="number" placeholder="Min score" aria-label="Minimum score" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
        <Select value={conf} onValueChange={setConf}><SelectTrigger className="min-h-11" aria-label="Confidence filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Any confidence</SelectItem>{CONFIDENCE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Select value={statusF} onValueChange={setStatusF}><SelectTrigger className="min-h-11" aria-label="Creator status filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Any creator status</SelectItem>{["Licensed", "Ready for Licence", "Validation Passed", "Interested"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      </div>
      <EntityTable rows={rows} loading={matches.isLoading} error={matches.error} onRowClick={setDetail}
        empty={{ title: "No matches yet", description: "Create a match after reviewing a creator against a brand or prospect.", ctaLabel: "New match", onCta: () => setOpen(true) }}
        columns={[{ key: "code", label: "ID", className: "text-xs text-muted-foreground" },
          { key: "creator", label: "Creator", render: (r) => names.creatorName(r.creator_id) },
          { key: "party", label: "Brand / prospect", render: (r) => names.partyName(r) },
          { key: "total_score", label: "Score", render: (r) => r.total_score ?? "—" },
          { key: "confidence", label: "Confidence", render: (r) => <StatusPill value={r.confidence} /> },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} /> },
          { key: "reasoning", label: "Why", className: "max-w-xs truncate text-xs" }]} />

      <RecordDialog open={open} onOpenChange={(o) => { setOpen(o); }} title="New match" fields={fields}
        initial={{ creator_id: creatorF !== "all" ? creatorF : undefined }}
        onSubmit={save} />
      {(
        <Section title="Product source for new matches" description="Pick a brand or prospect first so its products appear in the New match form.">
          <Select onValueChange={(v) => { const [k, id] = v.split(":"); setOwner(k === "b" ? { brand_id: id } : { prospect_id: id }); }}>
            <SelectTrigger className="min-h-11 max-w-sm" aria-label="Load products for"><SelectValue placeholder="Load products for…" /></SelectTrigger>
            <SelectContent>{partyOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Section>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg rounded-2xl">
          {detail && (<>
            <DialogHeader>
              <DialogTitle>{detail.code} · {names.creatorName(detail.creator_id)} × {names.partyName(detail)}</DialogTitle>
              <DialogDescription>Score {detail.total_score ?? "—"} · {detail.confidence} confidence · {detail.score_version}</DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 text-sm">
              {(Object.keys(MATCH_WEIGHTS) as MatchFactor[]).map((k) => (
                <li key={k} className="flex justify-between gap-2"><span>{humanize(k)} <span className="text-xs text-muted-foreground">×{MATCH_WEIGHTS[k]}</span></span><span className="tabular-nums">{detail.scores?.[k] ?? "not scored"}</span></li>
              ))}
            </ul>
            <p className="text-sm"><strong>Reasoning:</strong> {detail.reasoning ?? "—"}</p>
            <p className="text-sm"><strong>Risks:</strong> {detail.risks ?? "—"}</p>
            <div className="flex flex-wrap gap-2">
              {["Reviewed", "Accepted", "Rejected"].map((s) => <Button key={s} variant="outline" className="min-h-11" onClick={() => m.update.mutate({ id: detail.id, values: { status: s } })}>{s}</Button>)}
              <Button className="min-h-11" onClick={async () => {
                await om.insert.mutateAsync({ creator_id: detail.creator_id, match_id: detail.id, brand_id: detail.brand_id, prospect_id: detail.prospect_id, product_source: detail.product_source, product_id: detail.product_id, opportunity_score: detail.total_score, is_test: detail.is_test });
                setDetail(null);
              }}>Create opportunity</Button>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </CNLayout>
  );
}
