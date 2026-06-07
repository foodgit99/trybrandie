import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PlanId = "free" | "entrepreneur" | "creator" | "agency";

export interface PlanFeatures {
  team?: boolean;
  client_folders?: boolean;
  white_label?: boolean;
  priority_rendering?: boolean;
}

export interface SubscriptionState {
  planId: PlanId;
  isSubscribed: boolean;
  status: "active" | "past_due" | "cancelled" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  monthlyCredits: number;
  brandLimit: number | null; // null = unlimited
  features: PlanFeatures;
  lastChargeReference: string | null;
}

export const FREE_FEATURES: PlanFeatures = {
  team: false,
  client_folders: false,
  white_label: false,
  priority_rendering: false,
};

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionState> => {
      const { data: sub } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!sub) {
        return {
          planId: "free",
          isSubscribed: false,
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          monthlyCredits: 0,
          brandLimit: 1,
          features: FREE_FEATURES,
          lastChargeReference: null,
        };
      }

      const { data: plan } = await supabase
        .from("subscription_plans" as any)
        .select("*")
        .eq("id", (sub as any).plan_id)
        .maybeSingle();

      const isActive = (sub as any).status === "active";
      return {
        planId: (sub as any).plan_id as PlanId,
        isSubscribed: isActive,
        status: (sub as any).status,
        currentPeriodEnd: (sub as any).current_period_end,
        cancelAtPeriodEnd: (sub as any).cancel_at_period_end,
        monthlyCredits: (plan as any)?.monthly_credits ?? 0,
        brandLimit: (plan as any)?.brand_limit ?? 1,
        features: ((plan as any)?.features as PlanFeatures) ?? FREE_FEATURES,
        lastChargeReference: (sub as any).last_charge_reference ?? null,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}
