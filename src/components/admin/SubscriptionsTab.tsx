import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNaira } from "@/lib/subscriptionPlans";
import { CreditCard, TrendingUp, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  past_due: "destructive",
  cancelled: "outline",
  pending: "secondary",
};

export default function SubscriptionsTab() {
  const { data: subs, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: charges } = useQuery({
    queryKey: ["admin-subscription-charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_charges" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const planMap = new Map((plans || []).map((p) => [p.id, p]));
  const active = (subs || []).filter((s) => s.status === "active");
  const pastDue = (subs || []).filter((s) => s.status === "past_due");
  const mrrKobo = active.reduce((sum, s) => {
    const plan: any = planMap.get(s.plan_id);
    return sum + (plan?.price_naira ?? 0);
  }, 0);
  const planCounts = active.reduce<Record<string, number>>((acc, s) => {
    acc[s.plan_id] = (acc[s.plan_id] ?? 0) + 1;
    return acc;
  }, {});
  const successfulCharges = (charges || []).filter((c) => c.status === "success");
  const last30dRevenue = successfulCharges.reduce((sum, c) => sum + (c.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Active subscribers" value={active.length} icon={Users} />
        <StatCard title="MRR" value={formatNaira(mrrKobo)} icon={TrendingUp} />
        <StatCard title="Past due" value={pastDue.length} icon={AlertCircle} />
        <StatCard title="Revenue (last 30 charges)" value={formatNaira(last30dRevenue)} icon={CreditCard} />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Plan distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(plans || []).map((p: any) => (
              <div key={p.id} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{p.name}</p>
                <p className="text-2xl font-semibold">{planCounts[p.id] ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatNaira(p.price_naira)}/mo</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">All subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (subs || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period end</TableHead>
                    <TableHead>Cancels?</TableHead>
                    <TableHead>Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subs || []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}…</TableCell>
                      <TableCell>{(planMap.get(s.plan_id) as any)?.name ?? s.plan_id}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[s.status] ?? "secondary"} className="rounded-md">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.current_period_end ? format(new Date(s.current_period_end), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>{s.cancel_at_period_end ? "Yes" : "No"}</TableCell>
                      <TableCell>{s.failed_attempts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Recent charges</CardTitle>
        </CardHeader>
        <CardContent>
          {(charges || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No charges recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(charges || []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{c.user_id.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{c.paystack_reference.slice(0, 12)}…</TableCell>
                      <TableCell className="text-xs">{c.charge_type}</TableCell>
                      <TableCell>{formatNaira(c.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === "success" ? "default" : c.status === "failed" ? "destructive" : "secondary"}
                          className="rounded-md"
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number | string; icon: React.ElementType }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-semibold truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
