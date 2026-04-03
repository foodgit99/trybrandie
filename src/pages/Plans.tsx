import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

const tiers = [
  {
    name: "Free",
    price: "₦0",
    period: "",
    credits: "5 free credits/mo",
    plan_key: "free",
    features: [
      "1 brand",
      "Watermarked exports",
      "1080×1080 only",
      "Standard speed",
    ],
  },
  {
    name: "Entrepreneur",
    price: "₦12,500",
    period: "/mo",
    credits: "50 one-time credits",
    plan_key: "entrepreneur",
    features: [
      "1 brand",
      "No watermark",
      "PNG + JPG export",
      "Brand Centre access",
      "Design history",
    ],
  },
  {
    name: "Creator",
    price: "₦22,500",
    period: "/mo",
    credits: "150 one-time credits",
    plan_key: "creator",
    highlight: true,
    features: [
      "Multiple brands",
      "Team access (2–3 members)",
      "All export formats",
      "Carousel generation",
      "Version history",
    ],
  },
  {
    name: "Agency",
    price: "₦59,000",
    period: "/mo",
    credits: "400 one-time credits",
    plan_key: "agency",
    features: [
      "Unlimited brands",
      "Team access (5+ seats)",
      "White-label exports",
      "Priority rendering",
      "Early feature access",
    ],
  },
];

const Plans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>("free");
  const [paymentSuccess, setPaymentSuccess] = useState<{
    plan: string;
    amount: number;
    currency: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);

  // Verify Paystack callback
  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!reference || !user) return;

    setVerifying(true);
    supabase.functions
      .invoke("paystack-verify", { body: { reference } })
      .then(({ data, error }) => {
        if (error || !data?.verified) {
          toast({
            title: "Payment verification failed",
            description: "Please contact support if you were charged.",
            variant: "destructive",
          });
        } else {
          setPaymentSuccess({
            plan: data.plan,
            amount: data.amount,
            currency: data.currency,
          });
          setCurrentTier(data.plan);
          // Invalidate all profile caches so credit displays refresh
          queryClient.invalidateQueries({ queryKey: ["profile-studio"] });
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["header-profile"] });
        }
        // Clean URL params
        setSearchParams({}, { replace: true });
      })
      .finally(() => setVerifying(false));
  }, [searchParams, user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.subscription_tier) setCurrentTier(data.subscription_tier);
      });
  }, [user]);

  const handleUpgrade = async (planKey: string) => {
    if (!user?.email) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }

    setLoadingPlan(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: {
          plan: planKey,
          email: user.email,
          user_id: user.id,
          callback_url: "https://trybrandie.com/plans",
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
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <AnimatePresence mode="wait">
          {verifying ? (
            <motion.div
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your payment…</p>
            </motion.div>
          ) : paymentSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center py-16 gap-6 text-center"
            >
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">
                  Welcome to {tiers.find((t) => t.plan_key === paymentSuccess.plan)?.name || paymentSuccess.plan}!
                </h2>
                <p className="text-muted-foreground">
                  Payment of {paymentSuccess.currency} {paymentSuccess.amount.toLocaleString()} confirmed.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your plan has been upgraded. Enjoy your new credits and features.
                </p>
              </div>
              <Button
                className="rounded-xl gap-2 mt-4"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-10"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Choose your plan</h2>
                <p className="text-muted-foreground">Scale your brand as you grow.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {tiers.map((tier) => {
                  const isActive = currentTier === tier.plan_key;
                  return (
                    <div
                      key={tier.name}
                      className={`rounded-2xl border p-6 flex flex-col justify-between transition-shadow ${
                        isActive
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : tier.highlight
                          ? "border-primary shadow-lg ring-1 ring-primary/20"
                          : "border-border"
                      }`}
                    >
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-muted-foreground">{tier.name}</p>
                            {isActive && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-3xl font-serif tracking-tight mt-1">
                            {tier.price}
                            <span className="text-base font-sans text-muted-foreground">{tier.period}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{tier.credits}</p>
                        </div>

                        <ul className="space-y-2">
                          {tier.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button
                        className="mt-6 w-full rounded-xl"
                        variant={isActive ? "secondary" : tier.highlight ? "default" : "outline"}
                        disabled={isActive || loadingPlan === tier.plan_key}
                        onClick={() => handleUpgrade(tier.plan_key)}
                      >
                        {loadingPlan === tier.plan_key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isActive ? (
                          "Current Plan"
                        ) : (
                          "Upgrade"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Plans;
