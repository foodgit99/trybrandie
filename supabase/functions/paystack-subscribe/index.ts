// Initialize a Paystack transaction for a subscription plan (initial purchase OR upgrade).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_PLANS = new Set(["entrepreneur", "creator", "agency"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { plan_id, email, user_id, callback_url } = await req.json();

    if (!plan_id || !email || !user_id) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!VALID_PLANS.has(plan_id)) {
      return json({ error: "Invalid plan" }, 400);
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payment not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("id, price_naira, name")
      .eq("id", plan_id)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) return json({ error: "Plan unavailable" }, 400);

    const amountInKobo = plan.price_naira * 100;
    const safeCallbackUrl = (!callback_url || callback_url.includes("lovable.app"))
      ? "https://trybrandie.com/plans"
      : callback_url;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: "NGN",
        callback_url: safeCallbackUrl,
        metadata: {
          type: "subscription",
          plan_id,
          user_id,
          custom_fields: [
            { display_name: "Plan", variable_name: "plan", value: plan.name },
          ],
        },
      }),
    });
    const data = await res.json();
    if (!data.status) return json({ error: data.message || "Paystack error" }, 400);

    return json({ authorization_url: data.data.authorization_url });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
