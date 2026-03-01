import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "",
    credits: "10 generations/mo",
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
    price: "$16",
    period: "/mo",
    credits: "50 credits/mo",
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
    price: "$29",
    period: "/mo",
    credits: "150 credits/mo",
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
    price: "$75",
    period: "/mo",
    credits: "400 credits/mo",
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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 sm:px-8 py-4 sm:py-6 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl sm:text-2xl font-serif tracking-tight">Plans</h1>
      </header>

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
                  variant={tier.highlight ? "default" : "outline"}
                  disabled={tier.disabled}
                  onClick={() =>
                    toast({ title: "Coming soon", description: "Payments will be available soon." })
                  }
                >
                  {tier.cta}
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
