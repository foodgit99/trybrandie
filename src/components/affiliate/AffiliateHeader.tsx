import { motion } from "framer-motion";
import { DollarSign, Wallet, Clock, Users2, ArrowRight, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNgn, highestEarnedMilestone } from "@/lib/affiliateConfig";

interface Props {
  totalEarned: number;
  directEarnings: number;
  networkEarnings: number;
  pendingCommissions: number;
  availableBalance: number;
  onRequestPayout: () => void;
}

const AffiliateHeader = ({
  totalEarned,
  directEarnings,
  networkEarnings,
  pendingCommissions,
  availableBalance,
  onRequestPayout,
}: Props) => {
  const tier = highestEarnedMilestone(totalEarned);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-serif tracking-tight">Friends of Brandie</h1>
        {tier && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary px-2.5 py-1 border border-primary/20">
            <span>{tier.emoji}</span>
            <span>{tier.title} Affiliate</span>
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm -mt-2">
        Earn 20% first, 5% lifetime, plus network commissions.
      </p>

      {/* Hero earnings row */}
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-background p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Total earned
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="How earnings are calculated" className="inline-flex">
                      <Info className="h-3 w-3 text-muted-foreground/70 hover:text-foreground transition" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                    Calculated as a % of each referral's actual subscription.
                    <br />
                    Plans: Entrepreneur ₦18,500 · Creator ₦37,000 · Agency ₦92,500 / mo.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
            <p className="text-4xl sm:text-5xl font-serif tracking-tight">
              {formatNgn(totalEarned)}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{formatNgn(availableBalance)}</span> available to withdraw
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-xl gap-2"
            disabled={availableBalance <= 0}
            onClick={onRequestPayout}
          >
            Request payout <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Secondary stat chips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Direct", value: formatNgn(directEarnings), icon: DollarSign },
          { label: "Network", value: formatNgn(networkEarnings), icon: Users2 },
          { label: "Pending", value: formatNgn(pendingCommissions), icon: Clock },
          { label: "Available", value: formatNgn(availableBalance), icon: Wallet },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <s.icon className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-base font-serif tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default AffiliateHeader;
