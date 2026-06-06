// Single source of truth for affiliate commission structure.
// Used by marketing page calculator, signup page, and dashboard.

export const AFFILIATE_RATES = {
  tier1FirstPct: 20,        // Direct referral, first payment
  tier1RecurringPct: 5,     // Direct referral, every payment after
  tier2FirstPct: 5,         // Recruited affiliate's first sale
  tier2RecurringPct: 3,     // Recruited affiliate's recurring sales
} as const;

export const MIN_PAYOUT_NGN = 5000;
export const PAYOUT_PROCESSING_DAYS = "3–5 business days";

export const MILESTONES = [
  { amount: 10000, emoji: "🎉", label: "₦10K", title: "Rising Star" },
  { amount: 25000, emoji: "⭐", label: "₦25K", title: "Trailblazer" },
  { amount: 50000, emoji: "🔥", label: "₦50K", title: "Powerhouse" },
  { amount: 100000, emoji: "💎", label: "₦100K", title: "Diamond" },
  { amount: 250000, emoji: "🏆", label: "₦250K", title: "Champion" },
  { amount: 500000, emoji: "💎", label: "₦500K", title: "Elite" },
  { amount: 1000000, emoji: "👑", label: "₦1M", title: "Legend" },
] as const;

export function highestEarnedMilestone(totalEarned: number) {
  const reached = [...MILESTONES].reverse().find((m) => totalEarned >= m.amount);
  return reached ?? null;
}

// Average revenue per referral per month, used by the calculator.
// Based on Brandie's mid-tier ($29 Creator ≈ ₦45,000/mo at indicative rate).
export const AVG_REFERRAL_MONTHLY_NGN = 45000;

export interface CalculatorInput {
  newReferralsPerMonth: number;
  recruitedAffiliates: number;
  recruitReferralsPerMonth: number; // avg referrals each recruit brings/month
  horizonMonths: number;
}

export interface CalculatorOutput {
  directEarnings: number;
  networkEarnings: number;
  total: number;
}

/**
 * Simple linear projection:
 *  , Each month you add N new direct referrals; they each pay first-month then recur.
 *  , Each recruited affiliate brings R direct referrals/month; you earn tier2 on those.
 */
export function projectEarnings(input: CalculatorInput): CalculatorOutput {
  const arpu = AVG_REFERRAL_MONTHLY_NGN;
  let direct = 0;
  let network = 0;

  for (let month = 1; month <= input.horizonMonths; month++) {
    // Direct: new referrals this month pay first-payment commission;
    // all previously acquired referrals pay recurring.
    const newDirect = input.newReferralsPerMonth;
    const cumulativeDirect = input.newReferralsPerMonth * month;
    const recurringDirect = cumulativeDirect, newDirect;

    direct += newDirect * arpu * (AFFILIATE_RATES.tier1FirstPct / 100);
    direct += recurringDirect * arpu * (AFFILIATE_RATES.tier1RecurringPct / 100);

    // Network: each recruit brings R direct referrals/month.
    const recruitNewReferrals = input.recruitedAffiliates * input.recruitReferralsPerMonth;
    const recruitCumulative = recruitNewReferrals * month;
    const recruitRecurring = recruitCumulative, recruitNewReferrals;

    network += recruitNewReferrals * arpu * (AFFILIATE_RATES.tier2FirstPct / 100);
    network += recruitRecurring * arpu * (AFFILIATE_RATES.tier2RecurringPct / 100);
  }

  return {
    directEarnings: Math.round(direct),
    networkEarnings: Math.round(network),
    total: Math.round(direct + network),
  };
}

export function formatNgn(n: number): string {
  return `₦${Math.round(n).toLocaleString()}`;
}
