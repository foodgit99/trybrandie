import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

const tiers = [
  {
    name: "Free",
    price: "₦0",
    period: "",
    credits: "10 generations/mo",
    plan_key: "free",
    cta: "Current Plan",
    disabled: true,
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
    credits: "50 credits/mo",
    plan_key: "entrepreneur",
    cta: "Upgrade",
    disabled: false,
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
    credits: "150 credits/mo",
    plan_key: "creator",
    cta: "Upgrade",
    disabled: false,
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
    credits: "400 credits/mo",
    plan_key: "agency",
    cta: "Upgrade",
    disabled: false,
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
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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
          callback_url: window.location.origin + "/plans",
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
        <motion.div
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
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-6 flex flex-col justify-between transition-shadow ${
                  tier.highlight
                    ? "border-primary shadow-lg ring-1 ring-primary/20"
                    : "border-border"
                }`}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{tier.name}</p>
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
                  variant={currentTier === tier.plan_key ? "secondary" : tier.highlight ? "default" : "outline"}
                  disabled={currentTier === tier.plan_key || loadingPlan === tier.plan_key}
                  onClick={() => handleUpgrade(tier.plan_key)}
                >
                  {loadingPlan === tier.plan_key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : currentTier === tier.plan_key ? (
                    "Current Plan"
                  ) : (
                    "Upgrade"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Plans;
