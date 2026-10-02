import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { PNLayout, ErrorBox, StatusPill } from "../components/PNShell";
import { pnFrom, rpc, usePnAction, usePnQuery, pnError } from "../api";
import { usePrivateNetwork } from "../hooks/usePrivateNetwork";
import { formatNgn } from "../services/profile";
import type { Balance } from "../types";

const ENTRY_LABEL: Record<string, string> = {
  base_fee: "Verified post", action_bonus: "Qualified lead bonus", conversion_commission: "Sale commission",
  release: "Moved to available", payout: "Payout", reversal: "Reversed",
};

export default function Earnings() {
  const pn = usePrivateNetwork();
  const pid = pn.publisher?.id;
  const [amount, setAmount] = useState("");
  const bal = usePnQuery<Balance | null>(["balance", pid], () => rpc("balance", { _publisher: pid }), !!pid);
  const ledger = usePnQuery<any[]>(["ledger", pid], async () => {
    const { data, error } = await pnFrom("ledger").select("*").eq("publisher_id", pid).order("created_at", { ascending: false }).limit(200);
    if (error) throw error; return data ?? [];
  }, !!pid);
  const payouts = usePnQuery<any[]>(["payouts", pid], async () => {
    const { data, error } = await pnFrom("payouts").select("*").eq("publisher_id", pid).order("created_at", { ascending: false });
    if (error) throw error; return data ?? [];
  }, !!pid);
  const request = usePnAction((a: number) => rpc("request_payout", { _amount: a }), "Payout requested");

  if (!pid) return <PNLayout title="Earnings"><EmptyState title="No earnings yet" description="Create your publisher profile to start." /></PNLayout>;
  const b = bal.data ?? { pending: 0, available: 0, paid: 0, reversed: 0, requested: 0 };

  return (
    <PNLayout title="Earnings">
      {bal.isError && <ErrorBox message={pnError(bal.error)} onRetry={() => bal.refetch()} />}
      <div className="grid grid-cols-3 gap-2">
        {[["Pending", b.pending, "Verified, awaiting release"], ["Available", b.available, "Can be withdrawn"], ["Paid out", b.paid, "Settled to you"]].map(([l, v, h]) => (
          <div key={l as string} className="rounded-2xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-lg font-semibold">{formatNgn(v as number)}</p>
            <p className="text-[10px] text-muted-foreground">{h}</p>
          </div>
        ))}
      </div>
      {b.reversed > 0 && <p className="text-xs text-muted-foreground">Reversed so far: {formatNgn(b.reversed)}</p>}

      <section className="rounded-2xl border bg-card p-3 space-y-2" aria-labelledby="payout-h">
        <h2 id="payout-h" className="text-sm font-semibold">Request a payout</h2>
        <p className="text-xs text-muted-foreground">Payouts are reviewed and sent manually by Brandie to the account in your profile. One request at a time.</p>
        <div className="flex gap-2">
          <Label htmlFor="pn-amt" className="sr-only">Amount</Label>
          <Input id="pn-amt" inputMode="decimal" placeholder="Amount in ₦" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button disabled={request.isPending || !(Number(amount) > 0) || b.requested > 0} onClick={() => request.mutate(Number(amount), { onSuccess: () => setAmount("") })}>Request</Button>
        </div>
        {b.requested > 0 && <p className="text-xs">A payout of {formatNgn(b.requested)} is in progress.</p>}
      </section>

      <section aria-labelledby="po-h" className="space-y-2">
        <h2 id="po-h" className="text-sm font-semibold">Payouts</h2>
        {(payouts.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No payouts yet.</p>}
        {(payouts.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border p-2 text-sm">
            <span>{formatNgn(p.amount)} · {new Date(p.created_at).toLocaleDateString()}{p.reference && ` · ref ${p.reference}`}{p.reason && ` · ${p.reason}`}</span>
            <StatusPill tone={p.status === "paid" ? "good" : p.status === "rejected" ? "bad" : "info"}>{p.status}</StatusPill>
          </div>
        ))}
      </section>

      <section aria-labelledby="led-h" className="space-y-2">
        <h2 id="led-h" className="text-sm font-semibold">History</h2>
        {(ledger.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Earnings appear after a post is verified. Opening a share sheet does not earn.</p>}
        {(ledger.data ?? []).filter((e) => !(e.entry_type === "release" && e.amount < 0) && !(e.entry_type === "payout" && e.bucket === "available")).map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl border p-2 text-sm">
            <span>{ENTRY_LABEL[e.entry_type] ?? e.entry_type}<span className="text-xs text-muted-foreground"> · {e.bucket} · {new Date(e.created_at).toLocaleDateString()}</span></span>
            <span className="font-medium">{formatNgn(e.amount)}</span>
          </div>
        ))}
      </section>
    </PNLayout>
  );
}
