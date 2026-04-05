import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, Zap, CreditCard } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const PRICE_PER_UNIT = 5000;
const CREDITS_PER_UNIT = 20;

const formatNaira = (amount: number) => `₦${amount.toLocaleString()}`;

const features = [
  "No watermark on paid credits",
  "All export formats (PNG, JPG)",
  "Brand Centre access",
  "Design history & versions",
  "5 free credits every month",
];

const LandingPricing = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState(2);
  const credits = units * CREDITS_PER_UNIT;
  const price = units * PRICE_PER_UNIT;

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="text-center mb-12 space-y-3"
      >
        <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
          Simple, flexible pricing
        </motion.h2>
        <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-md mx-auto">
          Start free. Buy credits when you need them. No subscriptions, no commitments.
        </motion.p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={2}
        className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-8 shadow-sm max-w-md mx-auto"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Credit Pack</p>
            <p className="text-xs text-muted-foreground">₦5,000 per 20 credits</p>
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
            min={1}
            max={10}
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
          {units} × ₦5,000 — <span className="font-medium text-foreground">{formatNaira(price)}</span>
        </p>

        {/* CTA */}
        <Button
          className="w-full h-12 rounded-xl text-base font-medium gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-primary-foreground"
          onClick={() => navigate("/auth?mode=signup")}
        >
          <Zap className="h-4 w-4" />
          Get started free
        </Button>
      </motion.div>

      {/* Features */}
      <motion.ul
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={fadeUp}
        custom={3}
        className="mt-10 grid sm:grid-cols-2 gap-3 max-w-md mx-auto"
      >
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </motion.ul>
    </section>
  );
};

export default LandingPricing;
