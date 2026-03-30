import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const plans = [
  {
    name: "Free",
    price: "₦0",
    period: "forever",
    description: "Try Brandie risk-free",
    credits: "10 credits/month",
    features: [
      "1 brand profile",
      "AI design generation",
      "Chat-based edits",
      "Content Hub access",
      "Watermarked exports",
    ],
    cta: "Get started free",
    highlight: false,
  },
  {
    name: "Entrepreneur",
    price: "₦25,000",
    period: "/month",
    description: "For solo business owners",
    credits: "50 credits/month",
    features: [
      "1 brand profile",
      "HD exports, no watermark",
      "Carousel creation",
      "Trend Lab access",
      "Audience Intelligence",
      "Design history",
    ],
    cta: "Start growing",
    highlight: false,
  },
  {
    name: "Creator",
    price: "₦45,000",
    period: "/month",
    description: "For creators & teams",
    credits: "150 credits/month",
    features: [
      "Multiple brand profiles",
      "Everything in Entrepreneur",
      "Priority rendering",
      "Content pillars & series",
      "Advanced genome learning",
      "Team collaboration",
    ],
    cta: "Go Creator",
    highlight: true,
  },
  {
    name: "Agency",
    price: "₦120,000",
    period: "/month",
    description: "For agencies & studios",
    credits: "400 credits/month",
    features: [
      "Unlimited brand profiles",
      "Everything in Creator",
      "Client folders",
      "White-label exports",
      "Priority support",
      "Bulk carousel generation",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

const LandingPricing = () => {
  const navigate = useNavigate();

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="text-center mb-16 space-y-3"
      >
        <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
          Simple, transparent pricing
        </motion.h2>
        <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-md mx-auto">
          Start free. Upgrade when you're ready. Every plan includes AI-powered design generation.
        </motion.p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            custom={i + 2}
            className={`relative rounded-2xl border p-6 flex flex-col ${
              plan.highlight
                ? "border-foreground bg-primary text-primary-foreground shadow-xl scale-[1.02]"
                : "border-border bg-card"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-medium px-3 py-1 rounded-full bg-foreground text-background">
                Most Popular
              </span>
            )}

            <div className="space-y-1 mb-4">
              <h3 className="text-lg font-serif">{plan.name}</h3>
              <p className={`text-xs ${plan.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                {plan.description}
              </p>
            </div>

            <div className="mb-1">
              <span className="text-3xl font-serif tracking-tight">{plan.price}</span>
              <span className={`text-sm ${plan.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                {plan.period}
              </span>
            </div>
            <p className={`text-xs mb-5 ${plan.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              {plan.credits}
            </p>

            <ul className="space-y-2.5 mb-6 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
                  <span className={plan.highlight ? "text-primary-foreground/90" : ""}>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={plan.highlight ? "secondary" : "outline"}
              className="w-full rounded-xl gap-2"
              onClick={() => navigate("/auth?mode=signup")}
            >
              {plan.highlight && <Zap className="h-3.5 w-3.5" />}
              {plan.cta}
            </Button>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default LandingPricing;
