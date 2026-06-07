import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_PLANS, formatNaira, type SubscriptionPlan } from "@/lib/subscriptionPlans";
import { Check, Loader2, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  callbackPath: string; // /plans or /pricing
}

const SubscriptionTiers = ({ callbackPath }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: sub } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user?.email) {
      navigate(`/auth?mode=signup&next=${encodeURIComponent(callbackPath)}`);
      return;
    }
    setLoadingPlan(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-subscribe", {
        body: {
          plan_id: plan.id,
          email: user.email,
          user_id: user.id,
          callback_url: `https://trybrandie.com${callbackPath}`,
        },
      });
      if (error || !data?.authorization_url) {
        throw new Error(error?.message || data?.error || "Could not start checkout");
      }
      window.location.href = data.authorization_url;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-4xl font-serif tracking-tight">
          Subscribe and save on every credit.
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Pick a plan, pay monthly, your credits refill automatically.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = sub?.isSubscribed && sub.planId === plan.id;
          const isLoading = loadingPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-2xl border bg-card p-6 sm:p-7 flex flex-col gap-5 shadow-sm",
                plan.highlight ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wider font-medium flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Most popular
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-serif tracking-tight">
                    {formatNaira(plan.priceNaira)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>

              <div className="flex items-center gap-2 text-sm rounded-xl bg-secondary/60 px-3 py-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">{plan.monthlyCredits} credits</span>
                <span className="text-muted-foreground">every month</span>
              </div>

              <ul className="space-y-2 text-sm flex-1">
                {plan.features.map((f) => (
                  <li key={f.label} className={cn("flex items-start gap-2", !f.included && "text-muted-foreground/60")}>
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        f.included ? "text-primary" : "text-muted-foreground/40"
                      )}
                    />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => (isCurrent ? navigate("/settings") : handleSubscribe(plan))}
                disabled={isLoading || isCurrent}
                className={cn(
                  "w-full h-11 rounded-xl gap-2 font-medium",
                  plan.highlight && !isCurrent
                    ? "bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
                    : ""
                )}
                variant={plan.highlight ? "default" : isCurrent ? "secondary" : "outline"}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  "Current plan"
                ) : sub?.isSubscribed ? (
                  `Switch to ${plan.name}`
                ) : user ? (
                  `Start ${plan.name}`
                ) : (
                  `Sign up & start ${plan.name}`
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Monthly credits expire on renewal. Pay-as-you-go credits below never expire.
      </p>
    </div>
  );
};

export default SubscriptionTiers;
