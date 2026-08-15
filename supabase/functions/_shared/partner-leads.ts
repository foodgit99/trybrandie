// Shared partner lead resolver. Only whitelisted, non-sensitive fields are ever produced here.
// Used by partner-portal, partner-campaign-send and partner-automation-tick.

const FREE_MONTHLY = 5;
export const LOW_CREDIT_THRESHOLD = 10;
const INACTIVE_DAYS = 7;

export interface PartnerLeadRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  credits: number;
  designs: number;
  last_active: string | null;
  joined: string;
  source: string;
  attributed_at: string;
  status: string;
  ever_paid: boolean;
  first_design_at: string | null;
  first_paid_at: string | null;
}

// deno-lint-ignore no-explicit-any
function computeCredits(profile: any, rewards: any[]): number {
  const resetAt = profile?.generations_reset_at ? new Date(profile.generations_reset_at) : new Date();
  const now = new Date();
  const sameMonth = now.getMonth() === resetAt.getMonth() && now.getFullYear() === resetAt.getFullYear();
  const used = sameMonth ? Number(profile?.generations_count || 0) : 0;
  const free = Math.max(0, FREE_MONTHLY - used);
  const bonus = Number(profile?.bonus_credits || 0);
  const paid = Number(profile?.paid_credits || 0);
  const reward = (rewards || []).reduce((s, r) => s + Number(r.remaining || 0), 0);
  return free + bonus + paid + reward;
}

export function computeLeadStatus(args: {
  plan: string;
  credits: number;
  designs: number;
  joined: string;
  lastActive: string | null;
  everPaid: boolean;
}): string {
  const { plan, credits, designs, joined, lastActive, everPaid } = args;
  const now = Date.now();
  const daysSinceJoin = (now - new Date(joined).getTime()) / 86400000;
  const daysSinceActive = lastActive ? (now - new Date(lastActive).getTime()) / 86400000 : daysSinceJoin;
  const isPaid = (plan && plan !== "free") || everPaid;

  if (isPaid && daysSinceActive > 30) return "churned";
  if (isPaid) return "paid";
  if (daysSinceActive > INACTIVE_DAYS) return "inactive";
  if (credits <= 0) return "exhausted";
  if (credits <= LOW_CREDIT_THRESHOLD) return "low_credits";
  if (designs >= 3) return "active";
  if (designs >= 1) return "activated";
  if (daysSinceJoin <= 3) return "new";
  return "inactive";
}

// deno-lint-ignore no-explicit-any
export async function buildPartnerLeads(admin: any, partnerId: string): Promise<PartnerLeadRow[]> {
  const { data: leadRows } = await admin
    .from("partner_leads")
    .select("user_id, source, attributed_at")
    .eq("partner_id", partnerId)
    .order("attributed_at", { ascending: false });

  const leadIds = (leadRows || []).map((l: any) => l.user_id);
  if (leadIds.length === 0) return [];

  const [{ data: profiles }, { data: rewards }, { data: designs }, { data: payments }] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "user_id, full_name, subscription_tier, generations_count, generations_reset_at, bonus_credits, paid_credits, created_at"
      )
      .in("user_id", leadIds),
    admin
      .from("credit_rewards")
      .select("user_id, remaining, expires_at")
      .in("user_id", leadIds)
      .gt("remaining", 0)
      .gt("expires_at", new Date().toISOString()),
    admin.from("designs").select("user_id, created_at").in("user_id", leadIds),
    admin
      .from("payment_transactions")
      .select("user_id, amount, status, created_at")
      .in("user_id", leadIds)
      .eq("status", "success"),
  ]);

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  const rewardMap = new Map<string, any[]>();
  (rewards || []).forEach((r: any) => rewardMap.set(r.user_id, [...(rewardMap.get(r.user_id) || []), r]));

  const designCount = new Map<string, number>();
  const lastDesign = new Map<string, string>();
  const firstDesign = new Map<string, string>();
  (designs || []).forEach((d: any) => {
    designCount.set(d.user_id, (designCount.get(d.user_id) || 0) + 1);
    const prev = lastDesign.get(d.user_id);
    if (!prev || new Date(d.created_at) > new Date(prev)) lastDesign.set(d.user_id, d.created_at);
    const first = firstDesign.get(d.user_id);
    if (!first || new Date(d.created_at) < new Date(first)) firstDesign.set(d.user_id, d.created_at);
  });

  const paidMap = new Map<string, number>();
  const firstPaid = new Map<string, string>();
  (payments || []).forEach((p: any) => {
    paidMap.set(p.user_id, (paidMap.get(p.user_id) || 0) + Number(p.amount || 0));
    const first = firstPaid.get(p.user_id);
    if (!first || new Date(p.created_at) < new Date(first)) firstPaid.set(p.user_id, p.created_at);
  });

  const out: PartnerLeadRow[] = [];
  for (const lr of leadRows || []) {
    const profile = profileMap.get(lr.user_id);
    if (!profile) continue;

    const credits = computeCredits(profile, rewardMap.get(lr.user_id) || []);
    const designTotal = designCount.get(lr.user_id) || 0;
    const lastActiveDesign = lastDesign.get(lr.user_id) || null;
    const plan = profile.subscription_tier || "free";
    const revenue = paidMap.get(lr.user_id) || 0;

    const { data: au } = await admin.auth.admin.getUserById(lr.user_id);
    const email = au?.user?.email || null;
    const lastSignIn = au?.user?.last_sign_in_at || null;
    const lastActive =
      lastActiveDesign && lastSignIn
        ? new Date(lastActiveDesign) > new Date(lastSignIn)
          ? lastActiveDesign
          : lastSignIn
        : lastActiveDesign || lastSignIn;

    out.push({
      user_id: lr.user_id,
      full_name: profile.full_name,
      email,
      plan,
      credits,
      designs: designTotal,
      last_active: lastActive,
      joined: profile.created_at,
      source: lr.source,
      attributed_at: lr.attributed_at,
      ever_paid: revenue > 0,
      first_design_at: firstDesign.get(lr.user_id) || null,
      first_paid_at: firstPaid.get(lr.user_id) || null,
      status: computeLeadStatus({
        plan,
        credits,
        designs: designTotal,
        joined: profile.created_at,
        lastActive,
        everPaid: revenue > 0,
      }),
    });
  }

  return out;
}
