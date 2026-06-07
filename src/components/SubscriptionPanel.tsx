import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2, Calendar, AlertCircle } from "lucide-react";
import { formatNaira, SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

interface Props {
  userId: string;
}

const SubscriptionPanel = ({ userId }: Props) => {
  const { data: sub, isLoading } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: charges } = useQuery({
    queryKey: ["subscription-charges", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_charges" as any)
        .select("id, amount, status, charge_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data || []) as any[];
    },
    enabled: !!userId,
  });

  const planMeta = SUBSCRIPTION_PLANS.find((p) => p.id === sub?.planId);

  const handleAction = async (action: "cancel" | "reactivate") => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("subscription-manage", {
        body: { action },
      });
      if (error) throw error;
      toast({
        title: action === "cancel" ? "Subscription will end at period end" : "Subscription reactivated",
      });
      qc.invalidateQueries({ queryKey: ["subscription", userId] });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading subscription…</span>
      </div>
    );
  }

  if (!sub?.isSubscribed) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Free plan</p>
              <p className="text-xs text-muted-foreground">
                5 free credits / month. Upgrade for more.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/plans")}>
            Upgrade
          </Button>
        </div>
      </div>
    );
  }

  const renewal = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium capitalize">{sub.planId} plan</p>
              <p className="text-xs text-muted-foreground">
                {sub.monthlyCredits} credits / month
                {planMeta ? ` • ${formatNaira(planMeta.priceNaira)} / month` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/plans")}>
            Change plan
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
          <Calendar className="h-3.5 w-3.5" />
          {sub.cancelAtPeriodEnd ? (
            <span>Ends on {renewal}</span>
          ) : (
            <span>Renews on {renewal}</span>
          )}
        </div>

        {sub.status === "past_due" && (
          <div className="flex items-center gap-2 text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Last renewal charge failed. We'll retry; update your card if needed.
          </div>
        )}

        <div className="flex justify-end">
          {sub.cancelAtPeriodEnd ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={busy}
              onClick={() => handleAction("reactivate")}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reactivate"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => handleAction("cancel")}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel at period end"}
            </Button>
          )}
        </div>
      </div>

      {!!charges?.length && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Recent charges
          </p>
          {charges.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString()} • {c.charge_type}
              </span>
              <span className="font-medium">
                {formatNaira(Number(c.amount))} ·{" "}
                <span
                  className={
                    c.status === "success"
                      ? "text-primary"
                      : c.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {c.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubscriptionPanel;
