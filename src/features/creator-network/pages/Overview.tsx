import CNLayout from "../components/CNLayout";
import { Section, Stat } from "../components/ui";
import { useCnList } from "../api/db";
import { realOnly, formatMoney } from "../services/metrics";
import { Skeleton } from "@/components/ui/skeleton";

export default function Overview() {
  const creators = useCnList("creators", { select: "id, status, licensing_interest, contact_status, is_test" });
  const opps = useCnList("opportunities", { select: "id, stage, is_test" });
  const sales = useCnList("sales", { select: "id, status, sent_at, paid_amount, payment_status, creator_royalty, is_test" });
  const earnings = useCnList("earnings", { select: "id, payable_amount, is_test" });
  const jobs = useCnList("production_jobs", { select: "id, production_cost, is_test" });
  const tasks = useCnList("tasks", { select: "id, status, owner_type, is_test" });
  const runs = useCnList("ai_runs", { select: "id, status, is_test" });

  const loading = [creators, opps, sales, tasks, runs].some((q) => q.isLoading);
  const C = realOnly(creators.data);
  const O = realOnly(opps.data);
  const S = realOnly(sales.data);
  const T = realOnly(tasks.data);
  const cnt = <T,>(arr: T[], fn: (x: T) => boolean) => arr.filter(fn).length;
  const atLeast = (s: string, order: string[]) => (x: any) => order.indexOf(x.status) >= order.indexOf(s);
  const cOrder = ["Researched", "Qualified", "Contact Pending", "Contacted", "Interested", "Needs Human", "Validation Pending", "Validation Passed", "Ready for Licence", "Licensed"];

  const revenue = S.filter((s) => s.payment_status === "Paid").reduce((a, s) => a + Number(s.paid_amount ?? 0), 0);
  const royalties = realOnly(earnings.data).reduce((a, e) => a + Number(e.payable_amount ?? 0), 0);
  const cost = realOnly(jobs.data).reduce((a, j) => a + Number(j.production_cost ?? 0), 0);
  const paidCount = cnt(S, (s) => s.payment_status === "Paid");

  if (loading)
    return <CNLayout title="Overview"><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></CNLayout>;

  return (
    <CNLayout title="Overview" subtitle="Live counts from real records. Test records are excluded.">
      <Section title="Attention" description="Work that needs a person">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Human tasks open" value={cnt(T, (t) => t.owner_type === "Human" && t.status !== "Done")} />
          <Stat label="Blocked" value={cnt(T, (t) => t.status === "Blocked")} />
          <Stat label="In review" value={cnt(T, (t) => t.status === "Review")} />
          <Stat label="Failed AI work" value={cnt(realOnly(runs.data), (r) => r.status === "Failed")} />
        </div>
      </Section>
      <Section title="Creator pipeline">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Stat label="Researched" value={C.length} />
          <Stat label="Qualified" value={cnt(C, atLeast("Qualified", cOrder))} />
          <Stat label="Contacted" value={cnt(C, (c) => c.contact_status !== "Not Contacted")} />
          <Stat label="Interested" value={cnt(C, (c) => c.licensing_interest === "Interested")} />
          <Stat label="Validation passed" value={cnt(C, atLeast("Validation Passed", cOrder))} />
          <Stat label="Licensed" value={cnt(C, (c) => c.status === "Licensed")} />
        </div>
      </Section>
      <Section title="Opportunity pipeline">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Stat label="Active" value={cnt(O, (o) => !["Won", "Lost", "Fulfilled"].includes(o.stage))} />
          <Stat label="Ready for production" value={cnt(O, (o) => o.stage === "Ready for Production")} />
          <Stat label="Production" value={cnt(O, (o) => ["Producing", "QA"].includes(o.stage))} />
          <Stat label="Ready for outreach" value={cnt(O, (o) => o.stage === "Ready for Outreach")} />
          <Stat label="Engaged" value={cnt(O, (o) => ["Engaged", "Checkout"].includes(o.stage))} />
          <Stat label="Won" value={cnt(O, (o) => ["Won", "Fulfilled"].includes(o.stage))} />
        </div>
      </Section>
      <Section title="Commercial">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Previews sent" value={cnt(S, (s) => !!s.sent_at)} />
          <Stat label="Sales won" value={cnt(S, (s) => s.status === "Won")} />
          <Stat label="Revenue" value={paidCount ? formatMoney(revenue) : "No data yet"} />
          <Stat label="Creator royalties" value={realOnly(earnings.data).length ? formatMoney(royalties) : "No data yet"} />
          <Stat label="Gross margin" value={paidCount ? formatMoney(revenue - royalties - cost) : "No data yet"} hint="Revenue − royalties − production cost" />
        </div>
      </Section>
    </CNLayout>
  );
}
