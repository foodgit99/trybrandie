import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await verifyRes.json();

    if (!data.status || data.data?.status !== "success") {
      return new Response(
        JSON.stringify({ verified: false, message: data.data?.gateway_response || "Payment not successful" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = data.data.metadata;
    const user_id = metadata?.user_id;
    const credits = Number(metadata?.credits) || 0;
    const amount = data.data.amount / 100;
    const currency = data.data.currency;

    // Credits are deposited by paystack-webhook (authoritative, signature-verified).
    // This function only verifies status and sends confirmation email.
    if (user_id && credits > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Send payment confirmation email
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(user_id);
        const userEmail = userData?.user?.email;
        
        if (userEmail) {
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              type: "payment_confirmation",
              to: userEmail,
              data: { credits, amount, currency },
            }),
          });
          
          if (emailRes.ok) {
            console.log(`Payment confirmation email sent to ${userEmail}`);
          } else {
            const emailError = await emailRes.text();
            console.error("Failed to send payment confirmation email:", emailError);
          }
        }
      } catch (emailErr) {
        console.error("Error sending payment confirmation email:", emailErr);
      }
    } else {
      console.warn(`Missing metadata - user_id: ${user_id}, credits: ${credits}`);
    }

    return new Response(
      JSON.stringify({
        verified: true,
        credits,
        amount,
        currency,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
