import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addMonths,
  getPlan,
  grantSubscriptionPeriod,
} from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

async function sendAffiliateEmail(
  supabaseUrl: string,
  supabaseKey: string,
  type: string,
  to: string,
  data: Record<string, unknown>
) {
  try {
    const url = `${supabaseUrl}/functions/v1/send-email`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ type, to, data }),
    });
  } catch (err) {
    console.error("Failed to send affiliate email:", err);
  }
}

// Commission rates for the two-tier system
const RATES = {
  tier1_first: 0.20,
  tier1_recurring: 0.05,
  tier2_first: 0.05,
  tier2_recurring: 0.03,
};

const PAYOUT_THRESHOLD = 5000; // ₦5,000 minimum payout

const MILESTONES = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];

async function checkMilestones(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  affiliateId: string,
  previousEarned: number,
  newTotal: number,
  milestonesNotified: number[]
) {
  const crossed = MILESTONES.filter(
    (m) => previousEarned < m && newTotal >= m && !milestonesNotified.includes(m)
  );
  if (crossed.length === 0) return;

  // Update the notified list
  const updated = [...milestonesNotified, ...crossed];
  await supabase
    .from("affiliates")
    .update({ milestones_notified: updated })
    .eq("id", affiliateId);

  // Send email for the highest milestone crossed
  const highest = Math.max(...crossed);
  const { data: aff } = await supabase
    .from("affiliates")
    .select("user_id")
    .eq("id", affiliateId)
    .single();
  if (aff?.user_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(aff.user_id);
    const email = authUser?.user?.email;
    if (email) {
      await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_milestone", email, {
        milestone: highest,
        total_earned: newTotal,
      });
    }
  }
}

async function checkPayoutThreshold(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  affiliateId: string,
  previousEarned: number,
  newTotal: number
) {
  if (previousEarned < PAYOUT_THRESHOLD && newTotal >= PAYOUT_THRESHOLD) {
    const { data: aff } = await supabase
      .from("affiliates")
      .select("user_id")
      .eq("id", affiliateId)
      .single();
    if (aff?.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(aff.user_id);
      const email = authUser?.user?.email;
      if (email) {
        await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_payout_threshold", email, {
          total_earned: newTotal,
        });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response("Not configured", { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    const valid = await verifySignature(body, signature, PAYSTACK_SECRET_KEY);
    if (!valid) {
      console.warn(`[paystack-webhook] invalid signature; sig_present=${!!signature} body_len=${body.length}`);
      return new Response("Invalid signature", { status: 401 });
    }
    console.log(`[paystack-webhook] signature OK`);

    const event = JSON.parse(body);

    if (event.event === "charge.success") {
      const { metadata, reference, amount, currency } = event.data;
      const user_id = metadata?.user_id;
      const credits = Number(metadata?.credits) || 0;
      const isSubscription = metadata?.type === "subscription" || metadata?.type === "subscription_renewal";
      const planId = metadata?.plan_id as string | undefined;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // ---- Subscription branch (initial + renewals) ----
      if (isSubscription && user_id && planId) {
        const { data: existingCharge } = await supabase
          .from("subscription_charges")
          .select("id")
          .eq("paystack_reference", reference)
          .maybeSingle();
        if (existingCharge) {
          // Already processed by either verify or renewal job
          return new Response(JSON.stringify({ received: true, already_processed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const plan = await getPlan(supabase, planId);
        if (!plan) {
          return new Response(JSON.stringify({ received: true, error: "plan_missing" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const now = new Date();
        const periodEnd = addMonths(now, 1);
        const authorizationCode = event.data.authorization?.authorization_code || null;

        const { data: existing } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        let subscriptionId: string;
        if (existing) {
          subscriptionId = existing.id;
          await supabase
            .from("subscriptions")
            .update({
              plan_id: planId,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              cancel_at_period_end: false,
              authorization_code: authorizationCode,
              last_charge_reference: reference,
              failed_attempts: 0,
            })
            .eq("id", subscriptionId);
        } else {
          const { data: inserted } = await supabase
            .from("subscriptions")
            .insert({
              user_id,
              plan_id: planId,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              authorization_code: authorizationCode,
              last_charge_reference: reference,
            })
            .select("id")
            .single();
          subscriptionId = inserted!.id;
        }

        const { error: chErr } = await supabase.from("subscription_charges").insert({
          subscription_id: subscriptionId,
          user_id,
          paystack_reference: reference,
          amount: (amount || 0) / 100,
          status: "success",
          charge_type: metadata?.type === "subscription_renewal" ? "renewal" : "initial",
          raw_response: event.data,
        });
        if (chErr && (chErr as any).code === "23505") {
          return new Response(JSON.stringify({ received: true, already_processed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await grantSubscriptionPeriod(supabase, {
          subscriptionId,
          userId: user_id,
          plan,
          periodStart: now,
          periodEnd,
        });

        await supabase
          .from("profiles")
          .update({
            subscription_tier: planId,
            priority_render_until: plan.features?.priority_rendering ? periodEnd.toISOString() : null,
          })
          .eq("user_id", user_id);

        console.log(`[paystack-webhook] subscription credited user=${user_id} plan=${planId}`);

        // Fire activation/renewal email (non-blocking)
        try {
          const isRenewal = metadata?.type === "subscription_renewal";
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              type: isRenewal ? "subscription_renewed" : "subscription_activated",
              to: `__resolve_user__:${user_id}`,
              data: isRenewal
                ? {
                    plan_id: planId,
                    credits: plan.monthly_credits,
                    next_renewal: periodEnd.toISOString(),
                    amount: plan.price_naira,
                  }
                : { plan_id: planId, period_end: periodEnd.toISOString() },
            }),
          });
        } catch (e) {
          console.error("[paystack-webhook] subscription email failed", e);
        }
        return new Response(JSON.stringify({ received: true, subscription: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ---- PAYG branch (unchanged below) ----
      console.log(`[paystack-webhook] charge.success ref=${reference} user=${user_id} credits=${credits}`);

      // Idempotent crediting via unique payment_transactions.reference
      let didCredit = false;
      if (user_id && credits > 0 && reference) {
        const { error: insErr } = await supabase
          .from("payment_transactions")
          .insert({
            reference,
            user_id,
            credits,
            amount: (amount || 0) / 100,
            currency: currency || "NGN",
            status: "credited",
            credited_via: "webhook",
            raw_event: event,
          });

        if (insErr) {
          if ((insErr as any).code === "23505") {
            console.log(`[paystack-webhook] ref=${reference} already credited; skipping`);
          } else {
            console.error(`[paystack-webhook] ledger insert failed:`, insErr);
          }
        } else {
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("paid_credits")
            .eq("user_id", user_id)
            .single();
          const currentPaid = (currentProfile as any)?.paid_credits || 0;
          await supabase
            .from("profiles")
            .update({ paid_credits: currentPaid + credits })
            .eq("user_id", user_id);
          didCredit = true;
          console.log(`[paystack-webhook] credited ${credits} to user=${user_id} (was ${currentPaid})`);
        }
      }

      // Skip affiliate processing if this reference was already processed
      if (!didCredit) {
        return new Response(JSON.stringify({ received: true, already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Track affiliate commission (two-tier)
      if (user_id && amount) {
        const { data: referral } = await supabase
          .from("affiliate_referrals")
          .select("id, affiliate_id, payment_count")
          .eq("referred_user_id", user_id)
          .limit(1)
          .single();

        if (referral) {
          const paymentAmount = amount / 100;
          const isFirstPayment = (referral.payment_count ?? 0) === 0;

          // --- Tier 1: Direct affiliate ---
          const { data: tier1Affiliate } = await supabase
            .from("affiliates")
            .select("id, commission_rate, user_id, recruited_by, total_earned, milestones_notified")
            .eq("id", referral.affiliate_id)
            .single();

          if (tier1Affiliate) {
            const tier1Rate = isFirstPayment ? RATES.tier1_first : RATES.tier1_recurring;
            const tier1Commission = paymentAmount * tier1Rate;
            const tier1Type = isFirstPayment ? "tier1_first" : "tier1_recurring";
            const tier1PreviousEarned = tier1Affiliate.total_earned || 0;

            await supabase.from("affiliate_commissions").insert({
              affiliate_id: tier1Affiliate.id,
              referral_id: referral.id,
              payment_reference: reference,
              payment_amount: paymentAmount,
              commission_amount: tier1Commission,
              commission_type: tier1Type,
              status: "pending",
            });

            await supabase.rpc("increment_affiliate_earned", {
              p_affiliate_id: tier1Affiliate.id,
              p_amount: tier1Commission,
            });

            // --- Tier 2: Recruiting affiliate ---
            if (tier1Affiliate.recruited_by) {
              const { data: tier2Affiliate } = await supabase
                .from("affiliates")
                .select("id, user_id, total_earned, milestones_notified")
                .eq("id", tier1Affiliate.recruited_by)
                .single();

              if (tier2Affiliate) {
                const tier2Rate = isFirstPayment ? RATES.tier2_first : RATES.tier2_recurring;
                const tier2Commission = paymentAmount * tier2Rate;
                const tier2Type = isFirstPayment ? "tier2_first" : "tier2_recurring";
                const tier2PreviousEarned = tier2Affiliate.total_earned || 0;

                await supabase.from("affiliate_commissions").insert({
                  affiliate_id: tier2Affiliate.id,
                  referral_id: referral.id,
                  payment_reference: reference,
                  payment_amount: paymentAmount,
                  commission_amount: tier2Commission,
                  commission_type: tier2Type,
                  status: "pending",
                });

                await supabase.rpc("increment_affiliate_earned", {
                  p_affiliate_id: tier2Affiliate.id,
                  p_amount: tier2Commission,
                });

                // Send tier 2 commission email with type context
                if (tier2Affiliate.user_id) {
                  const { data: t2Auth } = await supabase.auth.admin.getUserById(tier2Affiliate.user_id);
                  const t2Email = t2Auth?.user?.email;
                  if (t2Email) {
                    await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_commission_earned", t2Email, {
                      commission_amount: tier2Commission,
                      payment_amount: paymentAmount,
                      commission_type: tier2Type,
                    });
                  }
                }

                // Check payout threshold for Tier 2
                await checkPayoutThreshold(
                  supabase, supabaseUrl, supabaseKey,
                  tier2Affiliate.id, tier2PreviousEarned,
                  tier2PreviousEarned + tier2Commission
                );

                // Check milestones for Tier 2
                await checkMilestones(
                  supabase, supabaseUrl, supabaseKey,
                  tier2Affiliate.id, tier2PreviousEarned,
                  tier2PreviousEarned + tier2Commission,
                  tier2Affiliate.milestones_notified || []
                );

                // Send network referral notification on first payment
                if (isFirstPayment && tier2Affiliate.user_id) {
                  const { data: t2Auth } = await supabase.auth.admin.getUserById(tier2Affiliate.user_id);
                  const t2Email = t2Auth?.user?.email;
                  // Get the tier 1 affiliate's name for context
                  const { data: t1Auth } = await supabase.auth.admin.getUserById(tier1Affiliate.user_id);
                  const t1Name = t1Auth?.user?.user_metadata?.full_name || t1Auth?.user?.email || "An affiliate";
                  const { data: referredUser } = await supabase.auth.admin.getUserById(user_id);
                  const customerEmail = referredUser?.user?.email || "A new customer";
                  if (t2Email) {
                    await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_network_referral", t2Email, {
                      affiliate_name: t1Name,
                      customer_email: customerEmail,
                    });
                  }
                }
              }
            }

            // Update referral status & increment payment count
            await supabase
              .from("affiliate_referrals")
              .update({
                status: "converted",
                payment_count: (referral.payment_count ?? 0) + 1,
              })
              .eq("id", referral.id);

            // Send tier 1 commission email with type context
            if (tier1Affiliate.user_id) {
              const { data: authUser } = await supabase.auth.admin.getUserById(tier1Affiliate.user_id);
              const affiliateEmail = authUser?.user?.email;
              if (affiliateEmail) {
                await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_commission_earned", affiliateEmail, {
                  commission_amount: tier1Commission,
                  payment_amount: paymentAmount,
                  commission_type: tier1Type,
                });
              }
            }

            // Check payout threshold for Tier 1
            await checkPayoutThreshold(
              supabase, supabaseUrl, supabaseKey,
              tier1Affiliate.id, tier1PreviousEarned,
              tier1PreviousEarned + tier1Commission
            );

            // Check milestones for Tier 1
            await checkMilestones(
              supabase, supabaseUrl, supabaseKey,
              tier1Affiliate.id, tier1PreviousEarned,
              tier1PreviousEarned + tier1Commission,
              tier1Affiliate.milestones_notified || []
            );

            // Send new referral notification (first payment only)
            if (isFirstPayment && tier1Affiliate.user_id) {
              const { data: authUser } = await supabase.auth.admin.getUserById(tier1Affiliate.user_id);
              const affiliateEmail = authUser?.user?.email;
              const { data: referredUser } = await supabase.auth.admin.getUserById(user_id);
              const referredEmail = referredUser?.user?.email || "A new user";
              if (affiliateEmail) {
                await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_new_referral", affiliateEmail, {
                  referred_email: referredEmail,
                });
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
