import { supabase } from "@/integrations/supabase/client";
import { gaEvent } from "@/lib/ga";

export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  context?: { userId?: string | null; brandId?: string | null }
): Promise<void> {
  // Mirror to Google Analytics (no-op on preview/localhost).
  try {
    gaEvent(eventName, properties);
  } catch {
    /* analytics must never throw */
  }
  try {
    let userId = context?.userId ?? null;
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    }
    if (!userId) return;
    await supabase.from("product_events" as any).insert({
      user_id: userId,
      brand_id: context?.brandId ?? null,
      event_name: eventName,
      properties: properties as any,
    });
  } catch {
    /* analytics must never throw */
  }
}
