import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, CreditCard, Sparkles } from "lucide-react";
import { SUBSCRIPTION_PLANS, formatNaira } from "@/lib/subscriptionPlans";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

const PAYG_PER_CREDIT = 250; // ₦5,000 / 20 credits

const LandingPricing = () => {
  const navigate = useNavigate();

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28 space-y-12">
      {/* Heading */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="text-center space-y-3"
      >
        <motion.h2
          variants={fadeUp}
          custom={0}
          className="text-3xl sm:text-5xl font-serif tracking-tight"
        >
          Pricing that grows with you.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          custom={1}
          className="text-muted-foreground max-w-xl mx-auto"
        >
          Subscribe monthly for credits + premium features, or top up pay-as-you-go anytime. Everyone gets 5 free credits each month.
        </motion.p>
      </motion.div>

      {/* Subscription tier preview */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={2}
        className="grid sm:grid-cols-3 gap-4"
      >
        {SUBSCRIPTION_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 bg-card space-y-4 ${
              plan.highlight
                ? "border-primary/60 shadow-md"
                : "border-border"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2.5 py-0.5">
                <Sparkles className="h-3 w-3" /> Most popular
              </span>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">{plan.name}</p>
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-serif tracking-tight">
                {formatNaira(plan.priceNaira)}
              </span>
              <span className="text-xs text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{plan.monthlyCredits} credits / month</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  {plan.brandLimit === null
                    ? "Unlimited brands"
                    : `${plan.brandLimit} brand`}
                </span>
              </li>
              {plan.id === "creator" && (
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>Team access</span>
                </li>
              )}
              {plan.id === "agency" && (
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>Client folders + white-label</span>
                </li>
              )}
            </ul>
          </div>
        ))}
      </motion.div>

      {/* PAYG mention */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={fadeUp}
        custom={3}
        className="rounded-2xl border border-border bg-secondary/30 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Prefer pay-as-you-go?</p>
            <p className="text-xs text-muted-foreground">
              Top up from ₦5,000 for 20 credits, just ₦{PAYG_PER_CREDIT}/credit. No subscription required.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="rounded-xl gap-2 self-start sm:self-auto"
          onClick={() => navigate("/pricing")}
        >
          Top up credits <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={fadeUp}
        custom={4}
        className="text-center pt-2"
      >
        <Button
          size="lg"
          className="rounded-xl gap-2 h-12 px-6 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-primary-foreground"
          onClick={() => navigate("/pricing")}
        >
          See full pricing & compare plans <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          5 free credits every month · cancel anytime
        </p>
      </motion.div>
    </section>
  );
};

export default LandingPricing;
