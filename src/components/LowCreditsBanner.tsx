import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FREE_MONTHLY = 5;
const THRESHOLD = 3;
const HIDDEN_ROUTES = ["/auth", "/onboarding", "/reset-password", "/plans"];

const LowCreditsBanner = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const { data: credits } = useQuery({
    queryKey: ["low-credits-check", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits, paid_credits")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      const resetAt = new Date(data.generations_reset_at);
      const now = new Date();
      const isCurrentMonth = now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
      const monthlyUsed = isCurrentMonth ? data.generations_count : 0;
      const freeRemaining = Math.max(0, FREE_MONTHLY - monthlyUsed);
      return freeRemaining + (data.bonus_credits ?? 0) + (data.paid_credits ?? 0);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (
    dismissed ||
    !user ||
    credits === undefined ||
    credits >= THRESHOLD ||
    HIDDEN_ROUTES.includes(location.pathname)
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 backdrop-blur-md px-4 py-3 shadow-lg">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <p className="flex-1 text-sm">
          <span className="font-medium">
            {credits === 0 ? "No credits left" : `Only ${credits} credit${credits === 1 ? "" : "s"} left`}
          </span>
          <span className="text-muted-foreground"> — top up to keep designing.</span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 px-2.5"
          onClick={() => navigate("/plans")}
        >
          Buy
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 hover:bg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default LowCreditsBanner;
