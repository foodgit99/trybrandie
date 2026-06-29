import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 7);
  return e;
}

export type AutopilotStatus = {
  enabled: boolean;
  mode: "manual" | "assisted" | "autonomous" | null;
  deliveryTime: string | null;
  timezone: string | null;
  thisWeekIdeas: number;
  thisWeekApprovedAndReady: number;
  paused: boolean; // enabled but nothing the autopilot can act on this week
  reason: "ok" | "disabled" | "no_ideas" | "no_approved";
};


export function useAutopilotStatus(brandId: string | null | undefined) {
  return useQuery({
    queryKey: ["autopilot-status", brandId],
    enabled: !!brandId,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AutopilotStatus> => {
      const { data: settings } = await supabase
        .from("autopilot_settings")
        .select("enabled, mode, delivery_time, timezone")
        .eq("brand_id", brandId!)
        .maybeSingle();

      const enabled = !!settings?.enabled;
      const mode = (settings?.mode as AutopilotStatus["mode"]) ?? null;

      const weekStart = startOfWeek().toISOString().slice(0, 10);
      const weekEndExclusive = endOfWeek().toISOString().slice(0, 10);

      // All autopilot ideas this week
      const { count: totalCount } = await supabase
        .from("content_ideas")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId!)
        .eq("autopilot", true)
        .not("blueprint_id", "is", null)
        .gte("scheduled_for", weekStart)
        .lt("scheduled_for", weekEndExclusive);

      // Approved & still pending generation (status in suggested/scheduled, approval_status approved)
      const { count: approvedCount } = await supabase
        .from("content_ideas")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId!)
        .eq("autopilot", true)
        .not("blueprint_id", "is", null)
        .eq("approval_status", "approved")
        .in("status", ["suggested", "scheduled"])
        .gte("scheduled_for", weekStart)
        .lt("scheduled_for", weekEndExclusive);

      const thisWeekIdeas = totalCount ?? 0;
      const thisWeekApprovedAndReady = approvedCount ?? 0;

      let reason: AutopilotStatus["reason"] = "ok";
      let paused = false;
      if (!enabled) {
        reason = "disabled";
      } else if (thisWeekIdeas === 0) {
        reason = "no_ideas";
        paused = true;
      } else if (thisWeekApprovedAndReady === 0) {
        reason = "no_approved";
        paused = true;
      }

      return {
        enabled,
        mode,
        deliveryTime: settings?.delivery_time ?? null,
        timezone: settings?.timezone ?? null,
        thisWeekIdeas,
        thisWeekApprovedAndReady,
        paused,
        reason,
      };

    },
  });
}
