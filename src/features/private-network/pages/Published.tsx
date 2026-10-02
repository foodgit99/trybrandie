import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { PNLayout, ErrorBox, StatusPill } from "../components/PNShell";
import ProofForm from "../components/ProofForm";
import PublishSheet, { type PublishTarget } from "../components/PublishSheet";
import { rpc, usePnAction, usePnQuery, pnError, signedMedia } from "../api";
import { PLACEMENT_STATUS_LABEL, platformLabel, type MyPlacement, type PlacementStatus } from "../types";
import { formatNgn } from "../services/profile";
import { redirectUrl, shareText } from "../services/share";

const FILTERS: Array<{ key: string; label: string; match: (s: PlacementStatus) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "todo", label: "Needs proof", match: (s) => s === "reserved" || s === "share_initiated" },
  { key: "review", label: "In review", match: (s) => s === "proof_submitted" },
  { key: "rejected", label: "Rejected", match: (s) => s === "rejected" },
  { key: "verified", label: "Verified", match: (s) => s === "verified" },
  { key: "cancelled", label: "Cancelled", match: (s) => s === "cancelled" },
];
const tone = (s: PlacementStatus) => (s === "verified" ? "good" : s === "rejected" ? "bad" : s === "cancelled" ? "muted" : s === "proof_submitted" ? "info" : "warn");

export default function Published() {
  const [filter, setFilter] = useState("all");
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [target, setTarget] = useState<PublishTarget | null>(null);
  const q = usePnQuery<MyPlacement[]>(["mine"], () => rpc("my_placements"));
  const cancel = usePnAction((id: string) => rpc("cancel_placement", { _placement: id }), "Cancelled — your reserved slot was released");
  const f = FILTERS.find((x) => x.key === filter)!;
  const rows = (q.data ?? []).filter((r) => f.match(r.status));

  const shareAgain = async (r: MyPlacement) => {
    try {
      const m = await signedMedia([r.creative_id]);
      setTarget({ creative_id: r.creative_id, campaign_code: r.campaign_code, campaign_name: r.campaign_name, brand_name: r.brand_name, caption: r.caption,
        media_type: r.media_type, mediaUrl: m[r.creative_id]?.url ?? null, platforms: [r.platform], base_fee_ngn: r.base_fee, action_bonus_ngn: r.action_bonus, commission_pct: r.commission_pct });
    } catch (e) { toast.error(pnError(e)); }
  };

  return (
    <PNLayout title="Published">
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-2xl bg-muted p-1" role="tablist">
          {FILTERS.map((x) => (
            <button key={x.key} role="tab" aria-selected={filter === x.key} onClick={() => setFilter(x.key)}
              className={`rounded-xl px-3 py-1.5 text-xs ${filter === x.key ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}>{x.label}</button>
          ))}
        </div>
      </div>
      {q.isLoading && <Skeleton className="h-28 w-full rounded-2xl" />}
      {q.isError && <ErrorBox message={pnError(q.error)} onRetry={() => q.refetch()} />}
      {!q.isLoading && rows.length === 0 && <EmptyState title="Nothing here yet" description="Campaigns you publish from the Feed show up here with their proof and earnings." />}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.brand_name} · {r.campaign_name}</p>
                <p className="text-xs text-muted-foreground">{platformLabel(r.platform)} · {r.media_type} · {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <StatusPill tone={tone(r.status)}>{PLACEMENT_STATUS_LABEL[r.status]}</StatusPill>
            </div>
            {r.reject_reason && <p className="rounded-lg bg-destructive/5 p-2 text-xs"><strong>Reason:</strong> {r.reject_reason}</p>}
            <dl className="grid grid-cols-4 gap-2 text-center text-xs">
              <div><dt className="text-muted-foreground">Clicks</dt><dd className="font-semibold">{r.clicks}</dd></div>
              <div><dt className="text-muted-foreground">Leads</dt><dd className="font-semibold">{r.leads}</dd></div>
              <div><dt className="text-muted-foreground">Sales</dt><dd className="font-semibold">{r.conversions}</dd></div>
              <div><dt className="text-muted-foreground">Earned</dt><dd className="font-semibold">{formatNgn(r.earned)}</dd></div>
            </dl>
            <p className="text-[11px] text-muted-foreground">
              Fee {formatNgn(r.base_fee)}{r.action_bonus > 0 && ` · lead bonus ${formatNgn(r.action_bonus)}`}{r.commission_pct > 0 && ` · ${r.commission_pct}% commission`}
              {r.share_initiated_at && ` · shared ${new Date(r.share_initiated_at).toLocaleString()} (${r.share_method})`}
              {r.proof_submitted_at && ` · proof ${new Date(r.proof_submitted_at).toLocaleString()}`}
              {r.verified_at && ` · verified ${new Date(r.verified_at).toLocaleString()}`}
            </p>
            {r.status !== "cancelled" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(shareText(r.caption, redirectUrl(r.token))).then(() => toast.success("Copied"), () => toast.error("Copy failed"))}>Copy caption + link</Button>
                {r.campaign_status === "active" && <Button size="sm" variant="outline" onClick={() => shareAgain(r)}>Share again</Button>}
                {["reserved", "share_initiated", "rejected"].includes(r.status) && (
                  <>
                    <Button size="sm" onClick={() => setProofFor(proofFor === r.id ? null : r.id)}>{r.status === "rejected" ? "Resubmit proof" : "Add proof"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>Cancel</Button>
                  </>
                )}
              </div>
            )}
            {proofFor === r.id && <ProofForm placementId={r.id} onDone={() => setProofFor(null)} />}
          </li>
        ))}
      </ul>
      <PublishSheet target={target} open={!!target} onOpenChange={(o) => !o && setTarget(null)} />
    </PNLayout>
  );
}
