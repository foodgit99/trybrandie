const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KOBO_PER_UNIT = 500000; // ₦5,000 in kobo
const CREDITS_PER_UNIT = 20;
const MIN_CREDITS = 20;
const MAX_CREDITS = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credits, amount, email, user_id, callback_url } = await req.json();

    if (!credits || !amount || !email || !user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate credits are in valid increments
    if (credits % CREDITS_PER_UNIT !== 0 || credits < MIN_CREDITS || credits > MAX_CREDITS) {
      return new Response(JSON.stringify({ error: "Invalid credit amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const units = credits / CREDITS_PER_UNIT;
    const expectedAmount = units * 5000; // ₦ amount
    if (amount !== expectedAmount) {
      return new Response(JSON.stringify({ error: "Amount mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInKobo = units * KOBO_PER_UNIT;

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Payment not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeCallbackUrl = (!callback_url || callback_url.includes("lovable.app"))
      ? "https://trybrandie.com/plans"
      : callback_url;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
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
          user_id,
          credits,
          custom_fields: [
            { display_name: "Credits", variable_name: "credits", value: String(credits) },
          ],
        },
      }),
    });

    const data = await paystackRes.json();

    if (!data.status) {
      return new Response(JSON.stringify({ error: data.message || "Paystack error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ authorization_url: data.data.authorization_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
