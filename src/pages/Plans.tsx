import SEO from "@/components/SEO";
import { gaEvent } from "@/lib/ga";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, ArrowRight, Zap, CreditCard, Sparkles } from "lucide-react";
import NewAppHeader from "@/components/v2/NewAppHeader";
import SubscriptionTiers from "@/components/SubscriptionTiers";
import { supabase } from "@/integrations/supabase/client";

const FREE_MONTHLY = 5;

const PRICE_PER_UNIT = 5000; // ₦5,000
const CREDITS_PER_UNIT = 20;
const MIN_UNITS = 1;
const MAX_UNITS = 10;
const DEFAULT_UNITS = 2;

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString()}`;

const Plans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    credits: number;
    amount: number;
    currency: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits, paid_credits")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getCreditsRemaining = () => {
    if (!profile) return FREE_MONTHLY;
    const resetAt = new Date(profile.generations_reset_at);
    const now = new Date();
    const isCurrentMonth = now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
    const monthlyUsed = isCurrentMonth ? profile.generations_count : 0;
    const freeRemaining = Math.max(0, FREE_MONTHLY, monthlyUsed);
    return freeRemaining + (profile.bonus_credits ?? 0) + (profile.paid_credits ?? 0);
  };

  const creditsRemaining = getCreditsRemaining();

  const credits = units * CREDITS_PER_UNIT;
  const price = units * PRICE_PER_UNIT;

  // Verify Paystack callback (with polling fallback in case webhook is delayed)
  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!reference || !user) return;

    setVerifying(true);
    let cancelled = false;
    const maxAttempts = 10;
    const intervalMs = 2000;

    (async () => {
      let lastData: any = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt++) {
        const { data, error } = await supabase.functions.invoke("paystack-verify", {
          body: { reference },
        });
        lastData = data;
        lastError = error;
        if (data?.verified && (data.credited || data.already_credited)) break;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }
      if (cancelled) return;

      if (lastError || !lastData?.verified) {
        toast({
          title: "Payment verification failed",
          description: "Please contact support if you were charged.",
          variant: "destructive",
        });
      } else if (!lastData.credited && !lastData.already_credited) {
        toast({
          title: "Payment received, credits are syncing",
          description: "Refresh in a moment. Contact support if it doesn't appear.",
        });
      } else {
        setPaymentSuccess({
          credits: lastData.credits,
          amount: lastData.amount,
          currency: lastData.currency,
        });
        if (!lastData.already_credited) {
          gaEvent("purchase", {
            transaction_id: reference,
            value: Number(lastData.amount) || undefined,
            currency: lastData.currency || "NGN",
            items: [{ item_id: "credits", item_name: "Brandie credits", quantity: lastData.credits }],
          });
        }
        queryClient.invalidateQueries({ queryKey: ["profile-studio"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["header-profile"] });
      }
      setSearchParams({}, { replace: true });
      setVerifying(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, user]);

  const handleBuyCredits = async () => {
    if (!user?.email) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: {
          credits,
          amount: price,
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Plans & Credits, Brandie" description="Top up credits and manage your Brandie plan." path="/plans" noindex />
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
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
                  Credits added!
                </h2>
                <p className="text-muted-foreground">
                  {paymentSuccess.credits} credits deposited to your account.
                </p>
                <p className="text-sm text-muted-foreground">
                  Payment of {paymentSuccess.currency} {paymentSuccess.amount.toLocaleString()} confirmed.
                </p>
              </div>
              <Button
                className="rounded-xl gap-2 mt-4"
                onClick={() => navigate("/design-studio")}
              >
                Start Designing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              {/* Current Balance */}
              <div className="flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-secondary/60 border border-border">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Current balance:</span>
                <span className="text-lg font-serif font-medium">{creditsRemaining} credits</span>
              </div>

              {/* Subscription tiers */}
              <SubscriptionTiers callbackPath="/plans" />

              {/* Divider */}
              <div className="flex items-center gap-4 max-w-md mx-auto">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Or top up anytime
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Header */}
              <div className="text-center space-y-2 max-w-md mx-auto">
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Buy Credits</h2>
                <p className="text-muted-foreground text-sm">
                  Power your designs. ₦5,000 per 20 credits. Never expires.
                </p>
              </div>

              {/* Credit Card */}
              <div className="max-w-lg mx-auto rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-8 shadow-sm">
                {/* Icon + Title */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Credit Pack</p>
                    <p className="text-xs text-muted-foreground">Choose your amount</p>
                  </div>
                </div>

                {/* Big numbers */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl sm:text-5xl font-serif tracking-tight">{credits}</p>
                    <p className="text-sm text-muted-foreground mt-1">credits</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl sm:text-5xl font-serif tracking-tight text-primary">
                      {formatNaira(price)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">one-time</p>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-3">
                  <Slider
                    value={[units]}
                    onValueChange={(v) => setUnits(v[0])}
                    min={MIN_UNITS}
                    max={MAX_UNITS}
                    step={1}
                    className="w-full [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary [&_[role=slider]]:shadow-md [&_.relative]:h-2.5 [&_[data-orientation=horizontal]>.absolute]:bg-gradient-to-r [&_[data-orientation=horizontal]>.absolute]:from-primary [&_[data-orientation=horizontal]>.absolute]:to-accent"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>20 credits</span>
                    <span>200 credits</span>
                  </div>
                </div>

                {/* Breakdown */}
                <p className="text-center text-sm text-muted-foreground">
                  {units} × ₦5,000, <span className="font-medium text-foreground">{formatNaira(price)}</span>
                </p>

                {/* CTA Button */}
                <Button
                  className="w-full h-12 rounded-xl text-base font-medium gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-primary-foreground"
                  onClick={handleBuyCredits}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Buy {credits} Credits, {formatNaira(price)}
                    </>
                  )}
                </Button>
              </div>

              {/* Footer note */}
              <p className="text-center text-xs text-muted-foreground">
                All users get 5 free credits every month. Buy more anytime, credits never expire.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Plans;
