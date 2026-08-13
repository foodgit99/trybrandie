// Compact credit gate used by the structured design pilot.
// Mirrors the platform deduction order: free monthly → bonus → reward → paid.
// Deduction is deferred: check first, charge only after a successful render.

const FREE_MONTHLY = 5;

export interface CreditGate {
  ok: boolean;
  available: number;
  charge: () => Promise<void>;
}

// deno-lint-ignore no-explicit-any
export async function creditGate(adminClient: any, userId: string, cost: number): Promise<CreditGate> {
  if (cost <= 0) return { ok: true, available: Infinity, charge: async () => {} };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return { ok: false, available: 0, charge: async () => {} };

  const now = new Date();
  const resetAt = new Date(profile.generations_reset_at);
  const needsReset =
    now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

  const currentCount = needsReset ? 0 : profile.generations_count || 0;
  const freeRemaining = Math.max(0, FREE_MONTHLY - currentCount);
  const bonusCredits = profile.bonus_credits || 0;
  const paidCredits = profile.paid_credits || 0;

  const { data: rewardRows } = await adminClient
    .from("credit_rewards")
    .select("id, remaining")
    .eq("user_id", userId)
    .gt("remaining", 0)
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: true });
  const rewardCredits = (rewardRows || []).reduce((s: number, r: any) => s + r.remaining, 0);

  const available = freeRemaining + bonusCredits + rewardCredits + paidCredits;

  return {
    ok: cost <= available,
    available,
    charge: async () => {
      const { data: fresh } = await adminClient
        .from("credit_rewards")
        .select("id, remaining")
        .eq("user_id", userId)
        .gt("remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });

      let remaining = cost;
      const updates: Record<string, unknown> = {};
      if (needsReset) {
        updates.generations_reset_at = now.toISOString();
        updates.bonus_earned_count = 0;
        updates.bonus_earned_reset_at = now.toISOString();
      }

      const freeToUse = Math.min(remaining, freeRemaining);
      updates.generations_count = currentCount + freeToUse;
      remaining -= freeToUse;

      if (remaining > 0) {
        const bonusToUse = Math.min(remaining, bonusCredits);
        updates.bonus_credits = bonusCredits - bonusToUse;
        remaining -= bonusToUse;
      }

      if (remaining > 0) {
        for (const rw of fresh || []) {
          if (remaining <= 0) break;
          const toUse = Math.min(remaining, rw.remaining);
          await adminClient.from("credit_rewards").update({ remaining: rw.remaining - toUse }).eq("id", rw.id);
          remaining -= toUse;
        }
      }

      if (remaining > 0) updates.paid_credits = Math.max(0, paidCredits - remaining);

      await adminClient.from("profiles").update(updates).eq("user_id", userId);
    },
  };
}
