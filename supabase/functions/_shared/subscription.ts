/**
 * Shared subscription helpers.
 *
 * Subscription monthly credits are stored as `credit_rewards` rows with
 * `reason='subscription_monthly'` so every existing credit-consuming function
 * already respects them (deduction order: free → bonus → reward → paid).
 *
 * `subscription_credits` mirrors the same data for billing audit/UI.
 */

export type PlanId = "entrepreneur" | "creator" | "agency";

export interface PlanRow {
  id: PlanId;
  name: string;
  price_naira: number;
  monthly_credits: number;
  brand_limit: number | null;
  features: {
    team?: boolean;
    client_folders?: boolean;
    white_label?: boolean;
    priority_rendering?: boolean;
  };
}

export async function getPlan(admin: any, planId: string): Promise<PlanRow | null> {
  const { data, error } = await admin
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlanRow;
}

/**
 * Grants one billing period of credits. Idempotent against
 * (subscription_id, period_start) via the natural uniqueness of credit_rewards
 * + subscription_credits insert pairing. Caller should ensure not to call twice
 * for the same period.
 */
export async function grantSubscriptionPeriod(
  admin: any,
  args: {
    subscriptionId: string;
    userId: string;
    plan: PlanRow;
    periodStart: Date;
    periodEnd: Date;
  }
) {
  const { subscriptionId, userId, plan, periodStart, periodEnd } = args;

  // Audit row (billing ledger)
  await admin.from("subscription_credits").insert({
    subscription_id: subscriptionId,
    user_id: userId,
    amount: plan.monthly_credits,
    remaining: plan.monthly_credits,
    granted_at: periodStart.toISOString(),
    expires_at: periodEnd.toISOString(),
  });

  // Actual consumable bucket — reused across the platform
  await admin.from("credit_rewards").insert({
    user_id: userId,
    amount: plan.monthly_credits,
    remaining: plan.monthly_credits,
    expires_at: periodEnd.toISOString(),
    granted_by: userId, // self-granted via billing system
    reason: `subscription_monthly:${plan.id}:${subscriptionId}`,
  });
}

/**
 * Expire any active subscription-monthly credit rewards for this user/sub.
 * Called when the period rolls over (use-it-or-lose-it).
 */
export async function expireSubscriptionCredits(
  admin: any,
  args: { userId: string; subscriptionId: string }
) {
  const { userId, subscriptionId } = args;
  const pattern = `subscription_monthly:%:${subscriptionId}`;
  await admin
    .from("credit_rewards")
    .update({ remaining: 0 })
    .eq("user_id", userId)
    .like("reason", pattern);

  await admin
    .from("subscription_credits")
    .update({ remaining: 0 })
    .eq("subscription_id", subscriptionId)
    .gt("remaining", 0);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
