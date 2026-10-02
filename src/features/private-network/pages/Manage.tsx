import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { PNLayout, StatusPill, ErrorBox } from "../components/PNShell";
import { CampaignForm, CampaignStats, CreativeManager } from "../components/manage/CampaignEditor";
import OperatorConsole from "../components/manage/OperatorConsole";
import { pnFrom, pnError, rpc, usePnAction, usePnQuery } from "../api";
import { usePrivateNetwork } from "../hooks/usePrivateNetwork";

const tone = (s: string) => (s === "active" ? "good" : s === "rejected" ? "bad" : s === "pending_review" ? "info" : "muted") as any;

function Campaigns() {
  const pn = usePrivateNetwork();
  const [brandId, setBrandId] = useState<string>("");
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [isTest, setIsTest] = useState(false);
  useEffect(() => { if (!brandId && pn.brands[0]) setBrandId(pn.brands[0].id); }, [pn.brands]);
  const list = usePnQuery<any[]>(["campaigns", brandId], async () => {
    let q = pnFrom("campaigns").select("*").order("created_at", { ascending: false });
    if (brandId) q = q.eq("brand_id", brandId);
    const { data, error } = await q; if (error) throw error; return data ?? [];
  }, !!brandId || pn.isOperator);
  const cur = selected && selected !== "new" ? (list.data ?? []).find((c) => c.id === selected) : undefined;
  const transition = usePnAction(({ id, to, note }: { id: string; to: string; note?: string }) => rpc("campaign_transition", { _id: id, _to: to, _note: note ?? null }), "Campaign updated");

  if (pn.brands.length === 0 && !pn.isOperator)
    return <EmptyState title="No brand to manage" description="Campaigns belong to a Brandie brand. Create a brand first." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-2">
        <label className="text-xs font-medium" htmlFor="pn-brand">Brand</label>
        <select id="pn-brand" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={brandId} onChange={(e) => { setBrandId(e.target.value); setSelected(null); }}>
          {pn.isOperator && <option value="">All brands (operator)</option>}
          {pn.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button className="w-full" disabled={!brandId} onClick={() => setSelected("new")}>New campaign</Button>
        {list.isError && <ErrorBox message={pnError(list.error)} onRetry={() => list.refetch()} />}
        <ul className="space-y-1">
          {(list.data ?? []).map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)} className={`w-full rounded-xl border p-2 text-left text-sm ${selected === c.id ? "border-primary" : ""}`}>
                <span className="block truncate font-medium">{c.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">{c.code} <StatusPill tone={tone(c.status)}>{c.status.replace("_", " ")}</StatusPill>{c.is_test && <StatusPill>TEST</StatusPill>}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="space-y-4">
        {selected === "new" && (
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold">New campaign</h2>
            {pn.isOperator && <label className="flex items-center gap-2 text-xs"><Checkbox checked={isTest} onCheckedChange={(v) => setIsTest(!!v)} />TEST campaign (excluded from metrics; test funding only)</label>}
            <CampaignForm brandId={brandId} isTest={isTest} onSaved={(id) => { list.refetch(); setSelected(id); }} />
          </div>
        )}
        {cur && (
          <>
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{cur.name} <span className="text-xs text-muted-foreground">{cur.code}</span></h2>
                <div className="flex flex-wrap gap-2">
                  {["draft", "rejected"].includes(cur.status) && <Button size="sm" onClick={() => transition.mutate({ id: cur.id, to: "pending_review" })}>Submit for review</Button>}
                  {cur.status === "active" && <Button size="sm" variant="outline" onClick={() => transition.mutate({ id: cur.id, to: "paused" })}>Pause</Button>}
                  {cur.status === "paused" && <Button size="sm" onClick={() => transition.mutate({ id: cur.id, to: "active" })}>Resume</Button>}
                  {["active", "paused", "pending_review", "draft"].includes(cur.status) && <Button size="sm" variant="ghost" onClick={() => transition.mutate({ id: cur.id, to: "ended" })}>End</Button>}
                </div>
              </div>
              {cur.review_note && <p className="rounded-lg bg-muted p-2 text-xs">Reviewer: {cur.review_note}</p>}
              <CampaignStats campaign={cur} />
            </div>
            <div className="rounded-2xl border bg-card p-4 space-y-3"><h3 className="text-sm font-semibold">Creatives</h3><CreativeManager campaign={cur} /></div>
            <div className="rounded-2xl border bg-card p-4"><h3 className="mb-2 text-sm font-semibold">Details and terms</h3><CampaignForm brandId={cur.brand_id} campaign={cur} onSaved={() => list.refetch()} /></div>
          </>
        )}
        {!selected && <EmptyState title="Pick or create a campaign" description="Campaigns run only after Brandie records funding, approves the landing domain and creatives, and activates them." />}
      </section>
    </div>
  );
}

export default function Manage() {
  const pn = usePrivateNetwork();
  return (
    <PNLayout title="Manage Private Network" wide>
      <Tabs defaultValue="campaigns">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          {pn.isOperator && <TabsTrigger value="ops">Operations</TabsTrigger>}
        </TabsList>
        <TabsContent value="campaigns"><Campaigns /></TabsContent>
        {pn.isOperator && <TabsContent value="ops"><OperatorConsole /></TabsContent>}
      </Tabs>
    </PNLayout>
  );
}
