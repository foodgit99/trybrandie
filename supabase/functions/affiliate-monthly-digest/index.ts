import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Calculate previous month range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Get all approved affiliates
    const { data: affiliates, error: affErr } = await supabase
      .from("affiliates")
      .select("id, user_id, affiliate_code, total_earned, total_paid, recruited_by")
      .eq("status", "approved");

    if (affErr) throw affErr;
    if (!affiliates || affiliates.length === 0) {
      return new Response(JSON.stringify({ message: "No approved affiliates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { affiliate_id: string; status: string; error?: string }[] = [];

    for (const aff of affiliates) {
      try {
        // 1. Commissions earned this month
        const { data: commissions } = await supabase
          .from("affiliate_commissions")
          .select("commission_amount, commission_type")
          .eq("affiliate_id", aff.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString());

        const monthlyEarnings = (commissions || []).reduce(
          (sum: number, c: any) => sum + Number(c.commission_amount), 0
        );

        const directEarnings = (commissions || []).reduce(
          (sum: number, c: any) => c.commission_type?.startsWith("tier1") ? sum + Number(c.commission_amount) : sum, 0
        );

        const networkEarnings = (commissions || []).reduce(
          (sum: number, c: any) => c.commission_type?.startsWith("tier2") ? sum + Number(c.commission_amount) : sum, 0
        );

        // 2. New referrals this month
        const { data: newReferrals } = await supabase
          .from("affiliate_referrals")
          .select("id")
          .eq("affiliate_id", aff.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString());

        const newReferralCount = newReferrals?.length || 0;

        // 3. Total referrals (lifetime)
        const { count: totalReferralCount } = await supabase
          .from("affiliate_referrals")
          .select("id", { count: "exact", head: true })
          .eq("affiliate_id", aff.id);

        // 4. Network growth (new recruits this month)
        const { data: newRecruits } = await supabase
          .from("affiliates")
          .select("id")
          .eq("recruited_by", aff.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString());

        const newRecruitCount = newRecruits?.length || 0;

        // 5. Total network size
        const { count: totalNetworkSize } = await supabase
          .from("affiliates")
          .select("id", { count: "exact", head: true })
          .eq("recruited_by", aff.id);

        // 6. Resolve email
        const { data: authUser } = await supabase.auth.admin.getUserById(aff.user_id);
        const email = authUser?.user?.email;
        if (!email) {
          results.push({ affiliate_id: aff.id, status: "skipped", error: "no email" });
          continue;
        }

        // Skip if no activity at all (don't spam inactive affiliates)
        if (monthlyEarnings === 0 && newReferralCount === 0 && newRecruitCount === 0) {
          results.push({ affiliate_id: aff.id, status: "skipped", error: "no activity" });
          continue;
        }

        // 7. Send digest email
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            type: "affiliate_monthly_digest",
            to: email,
            data: {
              month: monthLabel,
              monthly_earnings: monthlyEarnings,
              direct_earnings: directEarnings,
              network_earnings: networkEarnings,
              new_referrals: newReferralCount,
              total_referrals: totalReferralCount || 0,
              new_recruits: newRecruitCount,
              total_network: totalNetworkSize || 0,
              total_earned: Number(aff.total_earned),
              total_paid: Number(aff.total_paid),
              balance: Number(aff.total_earned) - Number(aff.total_paid),
            },
          }),
        });

        if (sendRes.ok) {
          results.push({ affiliate_id: aff.id, status: "sent" });
        } else {
          const err = await sendRes.text();
          results.push({ affiliate_id: aff.id, status: "failed", error: err });
        }
      } catch (innerErr) {
        results.push({ affiliate_id: aff.id, status: "error", error: String(innerErr) });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed" || r.status === "error").length;

    return new Response(
      JSON.stringify({ message: `Digest complete: ${sent} sent, ${skipped} skipped, ${failed} failed`, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("affiliate-monthly-digest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
