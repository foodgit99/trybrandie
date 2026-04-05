import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === "charge.success") {
      const { metadata, reference, amount } = event.data;
      const user_id = metadata?.user_id;
      const credits = Number(metadata?.credits) || 0;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Deposit paid credits additively
      if (user_id && credits > 0) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("paid_credits")
          .eq("user_id", user_id)
          .single();

        const currentPaid = (currentProfile as any)?.paid_credits || 0;

        await supabase
          .from("profiles")
          .update({
            paid_credits: currentPaid + credits,
          })
          .eq("user_id", user_id);
      }

      // Track affiliate commission
      if (user_id && amount) {
        const { data: referral } = await supabase
          .from("affiliate_referrals")
          .select("id, affiliate_id")
          .eq("referred_user_id", user_id)
          .limit(1)
          .single();

        if (referral) {
          const paymentAmount = amount / 100;
          const { data: affiliate } = await supabase
            .from("affiliates")
            .select("commission_rate, user_id")
            .eq("id", referral.affiliate_id)
            .single();

          const rate = affiliate?.commission_rate ?? 0.20;
          const commissionAmount = paymentAmount * rate;

          await supabase.from("affiliate_commissions").insert({
            affiliate_id: referral.affiliate_id,
            referral_id: referral.id,
            payment_reference: reference,
            payment_amount: paymentAmount,
            commission_amount: commissionAmount,
            status: "pending",
          });

          await supabase.rpc("increment_affiliate_earned", {
            p_affiliate_id: referral.affiliate_id,
            p_amount: commissionAmount,
          });

          await supabase
            .from("affiliate_referrals")
            .update({ status: "converted" })
            .eq("id", referral.id);

          if (affiliate?.user_id) {
            const { data: authUser } = await supabase.auth.admin.getUserById(affiliate.user_id);
            const affiliateEmail = authUser?.user?.email;
            if (affiliateEmail) {
              await sendAffiliateEmail(supabaseUrl, supabaseKey, "affiliate_commission_earned", affiliateEmail, {
                commission_amount: commissionAmount,
                payment_amount: paymentAmount,
              });
            }
          }

          if (affiliate?.user_id) {
            const { data: authUser } = await supabase.auth.admin.getUserById(affiliate.user_id);
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
