/**
 * Shared helper for querying and consuming reward credits.
 * Deduction order across the platform: Free Monthly → Bonus → Reward → Paid
 */

/**
 * Get total active (non-expired, remaining > 0) reward credits for a user.
 */
export async function getActiveRewardCredits(
  adminClient: any,
  userId: string
): Promise<number> {
  const { data, error } = await adminClient
    .from("credit_rewards")
    .select("remaining")
    .eq("user_id", userId)
    .gt("remaining", 0)
    .gt("expires_at", new Date().toISOString());

  if (error || !data) return 0;
  return data.reduce((sum: number, r: any) => sum + r.remaining, 0);
}

/**
 * Consume reward credits for a user, using soonest-expiring first.
 * Returns the number of credits actually consumed.
 */
export async function consumeRewardCredits(
  adminClient: any,
  userId: string,
  amount: number
): Promise<number> {
  if (amount <= 0) return 0;

  const { data: rewards, error } = await adminClient
    .from("credit_rewards")
    .select("id, remaining")
    .eq("user_id", userId)
    .gt("remaining", 0)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });

  if (error || !rewards || rewards.length === 0) return 0;

  let consumed = 0;
  for (const reward of rewards) {
    if (consumed >= amount) break;
    const toUse = Math.min(amount - consumed, reward.remaining);
    await adminClient
      .from("credit_rewards")
      .update({ remaining: reward.remaining - toUse })
      .eq("id", reward.id);
    consumed += toUse;
  }

  return consumed;
}
