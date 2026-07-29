import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

const FREE_MONTHLY = 5;

interface Breakdown {
  free: number;
  bonus: number;
  reward: number;
  subscription: number;
  paid: number;
  total: number;
}

export function useCreditsBreakdown(): Breakdown | null {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-credits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: rewards } = useQuery({
    queryKey: ["reward-credits-detail", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_rewards")
        .select("remaining, reason")
        .eq("user_id", user!.id)
        .gt("remaining", 0)
        .gt("expires_at", new Date().toISOString());
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!profile) return null;

  const resetAt = new Date(profile.generations_reset_at);
  const now = new Date();
  const isCurrentMonth =
    now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
  const monthlyUsed = isCurrentMonth ? profile.generations_count : 0;
  const free = Math.max(0, FREE_MONTHLY - monthlyUsed);
  const bonus = (profile as any)?.bonus_credits ?? 0;
  const paid = (profile as any)?.paid_credits ?? 0;

  // Split rewards into "subscription" (monthly plan top-ups) and other reward credits.
  const subscription = (rewards || [])
    .filter((r: any) => /subscription|plan/i.test(r.reason || ""))
    .reduce((s: number, r: any) => s + r.remaining, 0);
  const otherReward = (rewards || [])
    .filter((r: any) => !/subscription|plan/i.test(r.reason || ""))
    .reduce((s: number, r: any) => s + r.remaining, 0);

  return {
    free,
    bonus,
    reward: otherReward,
    subscription,
    paid,
    total: free + bonus + otherReward + subscription + paid,
  };
}

interface Row {
  label: string;
  value: number;
  hint: string;
}

function BreakdownBody({ b }: { b: Breakdown }) {
  const navigate = useNavigate();
  const rows: Row[] = [
    { label: "Free monthly", value: b.free, hint: "Resets the 1st of every month" },
    { label: "Subscription", value: b.subscription, hint: "From your active plan" },
    { label: "Bonus", value: b.bonus, hint: "Referral & promo bonuses" },
    { label: "Rewards", value: b.reward, hint: "Granted by team" },
    { label: "Purchased", value: b.paid, hint: "Top-up credits, never expire" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between pb-2 border-b">
        <span className="text-sm font-medium">Credits balance</span>
        <span className="text-lg font-semibold">{b.total}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-medium">{r.label}</p>
              <p className="text-muted-foreground">{r.hint}</p>
            </div>
            <span className="font-mono tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="pt-2 border-t space-y-1">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Deducted in order: Free → Subscription → Bonus → Rewards → Purchased.
        </p>
        <button
          onClick={() => navigate("/plans")}
          className="text-xs text-primary hover:underline"
        >
          Buy more credits →
        </button>
      </div>
    </div>
  );
}

export default function CreditsBadge() {
  const b = useCreditsBreakdown();
  const total = b?.total ?? 0;
  const low = !!b && total < 3;

  const trigger = (
    <button
      type="button"
      className={
        "flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm transition-all " +
        (low
          ? "bg-brandie-coral/10 text-brandie-coral ring-1 ring-brandie-coral/30 hover:bg-brandie-coral/15"
          : "bg-secondary hover:bg-secondary/80")
      }
      aria-label="Credits breakdown"
    >
      <Sparkles
        className={
          "h-3 w-3 sm:h-3.5 sm:w-3.5 " + (low ? "text-brandie-coral" : "text-brandie-violet")
        }
      />
      <span className="font-medium">{total}</span>
      <span className={low ? "hidden sm:inline" : "text-muted-foreground hidden sm:inline"}>
        credits
      </span>
    </button>
  );


  if (!b) return trigger;

  return (
    <>
      {/* Desktop: hover */}
      <div className="hidden sm:block">
        <HoverCard openDelay={120}>
          <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
          <HoverCardContent align="end" className="w-72 rounded-xl">
            <BreakdownBody b={b} />
          </HoverCardContent>
        </HoverCard>
      </div>
      {/* Mobile: tap */}
      <div className="sm:hidden">
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-72 rounded-xl">
            <BreakdownBody b={b} />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
