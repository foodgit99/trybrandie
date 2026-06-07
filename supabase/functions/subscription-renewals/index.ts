// Daily cron: charges due renewals via stored authorization, expires & re-grants credits,
// sends reminders and dunning emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addMonths,
  expireSubscriptionCredits,
  getPlan,
  grantSubscriptionPeriod,
} from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMINDER_LEAD_DAYS = 3;
const MAX_FAILED_ATTEMPTS = 4; // T+0, T+1, T+3, T+7

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!PAYSTACK_SECRET_KEY) return new Response("Not configured", { status: 500 });

  const admin = createClient(supabaseUrl, supabaseKey);
  const now = new Date();
  const reminderHorizon = new Date(now.getTime() + REMINDER_LEAD_DAYS * 86400_000);

  const summary = { reminded: 0, charged: 0, failed: 0, cancelled: 0, expired_credits: 0 };

  // 1) Send reminders for upcoming renewals
  {
    const { data: upcoming } = await admin
      .from("subscriptions")
      .select("id, user_id, plan_id, current_period_end")
      .eq("status", "active")
      .eq("cancel_at_period_end", false)
      .gt("current_period_end", now.toISOString())
      .lt("current_period_end", reminderHorizon.toISOString());
    for (const sub of upcoming || []) {
      try {
        const { data: au } = await admin.auth.admin.getUserById(sub.user_id);
        const email = au?.user?.email;
        if (!email) continue;
        await sendEmail(supabaseUrl, supabaseKey, "subscription_renewal_reminder", email, {
          plan_id: sub.plan_id,
          renewal_date: sub.current_period_end,
        });
        summary.reminded++;
      } catch (e) {
        console.error("[renewals] reminder fail", e);
      }
    }
  }

  // 2) Process due renewals (period_end has passed)
  const { data: due } = await admin
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due"])
    .lt("current_period_end", now.toISOString());

  for (const sub of due || []) {
    // Cancel-at-period-end: just expire credits and mark cancelled
    if (sub.cancel_at_period_end) {
      await expireSubscriptionCredits(admin, {
        userId: sub.user_id,
        subscriptionId: sub.id,
      });
      await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", sub.id);
      await admin
        .from("profiles")
        .update({ subscription_tier: "free", priority_render_until: null })
        .eq("user_id", sub.user_id);
      summary.cancelled++;
      continue;
    }

    if (!sub.authorization_code) {
      // Cannot charge unattended → mark past_due
      await admin
        .from("subscriptions")
        .update({ status: "past_due", failed_attempts: (sub.failed_attempts || 0) + 1 })
        .eq("id", sub.id);
      summary.failed++;
      continue;
    }

    const plan = await getPlan(admin, sub.plan_id);
    if (!plan) continue;

    // Get user email
    const { data: au } = await admin.auth.admin.getUserById(sub.user_id);
    const email = au?.user?.email;
    if (!email) continue;

    const amountKobo = plan.price_naira * 100;
    const reference = `sub_${sub.id}_${Date.now()}`;

    // Pre-insert pending charge for idempotency
    const { error: insErr } = await admin.from("subscription_charges").insert({
      subscription_id: sub.id,
      user_id: sub.user_id,
      paystack_reference: reference,
      amount: plan.price_naira,
      status: "pending",
      charge_type: "renewal",
    });
    if (insErr) {
      console.error("[renewals] could not insert pending charge", insErr);
      continue;
    }

    // Attempt charge_authorization
    let chargeOk = false;
    let chargeBody: any = null;
    try {
      const res = await fetch("https://api.paystack.co/transaction/charge_authorization", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          authorization_code: sub.authorization_code,
          reference,
          currency: "NGN",
          metadata: {
            type: "subscription_renewal",
            plan_id: sub.plan_id,
            user_id: sub.user_id,
            subscription_id: sub.id,
          },
        }),
      });
      chargeBody = await res.json();
      chargeOk = chargeBody?.data?.status === "success";
    } catch (e) {
      console.error("[renewals] charge error", e);
    }

    if (chargeOk) {
      // Expire old, grant new period
      await expireSubscriptionCredits(admin, {
        userId: sub.user_id,
        subscriptionId: sub.id,
      });
      summary.expired_credits++;

      const newStart = now;
      const newEnd = addMonths(now, 1);
      await grantSubscriptionPeriod(admin, {
        subscriptionId: sub.id,
        userId: sub.user_id,
        plan,
        periodStart: newStart,
        periodEnd: newEnd,
      });

      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: newStart.toISOString(),
          current_period_end: newEnd.toISOString(),
          failed_attempts: 0,
          last_renewal_attempt_at: now.toISOString(),
          last_charge_reference: reference,
        })
        .eq("id", sub.id);

      await admin
        .from("subscription_charges")
        .update({ status: "success", raw_response: chargeBody })
        .eq("paystack_reference", reference);

      await admin
        .from("profiles")
        .update({
          subscription_tier: sub.plan_id,
          priority_render_until: plan.features?.priority_rendering ? newEnd.toISOString() : null,
        })
        .eq("user_id", sub.user_id);

      await sendEmail(supabaseUrl, supabaseKey, "subscription_renewed", email, {
        plan_id: sub.plan_id,
        credits: plan.monthly_credits,
        next_renewal: newEnd.toISOString(),
        amount: plan.price_naira,
      });
      summary.charged++;
    } else {
      const failedAttempts = (sub.failed_attempts || 0) + 1;
      const giveUp = failedAttempts >= MAX_FAILED_ATTEMPTS;
      await admin
        .from("subscriptions")
        .update({
          status: giveUp ? "cancelled" : "past_due",
          failed_attempts: failedAttempts,
          last_renewal_attempt_at: now.toISOString(),
        })
        .eq("id", sub.id);
      await admin
        .from("subscription_charges")
        .update({
          status: "failed",
          failure_reason: chargeBody?.data?.gateway_response || chargeBody?.message || "unknown",
          raw_response: chargeBody,
        })
        .eq("paystack_reference", reference);

      if (giveUp) {
        await expireSubscriptionCredits(admin, {
          userId: sub.user_id,
          subscriptionId: sub.id,
        });
        await admin
          .from("profiles")
          .update({ subscription_tier: "free", priority_render_until: null })
          .eq("user_id", sub.user_id);
        await sendEmail(supabaseUrl, supabaseKey, "subscription_cancelled_failed", email, {
          plan_id: sub.plan_id,
        });
        summary.cancelled++;
      } else {
        await sendEmail(supabaseUrl, supabaseKey, "subscription_charge_failed", email, {
          plan_id: sub.plan_id,
          attempt: failedAttempts,
        });
        summary.failed++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, ran_at: now.toISOString(), summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function sendEmail(
  supabaseUrl: string,
  supabaseKey: string,
  type: string,
  to: string,
  data: Record<string, unknown>
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ type, to, data }),
    });
  } catch (e) {
    console.error("[renewals] email", e);
  }
}
