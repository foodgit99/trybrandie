import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid token" }, 401);

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Unauthorized" }, 403);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const operation = body.operation as string;

    const emailFor = async (uid: string | null | undefined): Promise<string | null> => {
      if (!uid) return null;
      try {
        const { data } = await admin.auth.admin.getUserById(uid);
        return data?.user?.email ?? null;
      } catch {
        return null;
      }
    };

    if (operation === "analytics") {
      const { data: affiliates } = await admin
        .from("affiliates")
        .select("id, user_id, affiliate_code, status, total_earned, total_paid, commission_rate, created_at");

      const counts_by_status: Record<string, number> = {};
      let total_earned_all = 0;
      let total_paid_all = 0;
      for (const a of affiliates || []) {
        counts_by_status[a.status] = (counts_by_status[a.status] || 0) + 1;
        total_earned_all += Number(a.total_earned || 0);
        total_paid_all += Number(a.total_paid || 0);
      }

      const { data: payouts } = await admin
        .from("affiliate_payouts")
        .select("amount, status, created_at");

      let pending_payout_owed = 0;
      let payouts_pending_count = 0;
      let payouts_paid_total = 0;
      for (const p of payouts || []) {
        const amt = Number(p.amount || 0);
        if (p.status === "requested" || p.status === "approved") {
          pending_payout_owed += amt;
          payouts_pending_count += 1;
        }
        if (p.status === "paid") payouts_paid_total += amt;
      }

      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const { data: commissions } = await admin
        .from("affiliate_commissions")
        .select("commission_amount, status, created_at, commission_type");

      let mtd_commissions = 0;
      let total_commissions_all_time = 0;
      let pending_commissions = 0;
      const byType: Record<string, number> = {};
      for (const c of commissions || []) {
        const amt = Number(c.commission_amount || 0);
        total_commissions_all_time += amt;
        if (new Date(c.created_at) >= monthStart) mtd_commissions += amt;
        if (c.status === "pending") pending_commissions += amt;
        byType[c.commission_type] = (byType[c.commission_type] || 0) + amt;
      }

      // Top 5 earners
      const sorted = [...(affiliates || [])].sort(
        (a, b) => Number(b.total_earned || 0) - Number(a.total_earned || 0)
      );
      const top = sorted.slice(0, 5);

      const { data: allRefs } = await admin
        .from("affiliate_referrals")
        .select("affiliate_id, status, payment_count");
      const refsByAff = new Map<string, { total: number; paying: number }>();
      for (const r of allRefs || []) {
        const entry = refsByAff.get(r.affiliate_id) || { total: 0, paying: 0 };
        entry.total += 1;
        if ((r.payment_count || 0) > 0) entry.paying += 1;
        refsByAff.set(r.affiliate_id, entry);
      }

      const top_earners = await Promise.all(
        top.map(async (a) => ({
          id: a.id,
          affiliate_code: a.affiliate_code,
          email: await emailFor(a.user_id),
          total_earned: Number(a.total_earned || 0),
          total_paid: Number(a.total_paid || 0),
          referrals: refsByAff.get(a.id)?.total || 0,
          paying_referrals: refsByAff.get(a.id)?.paying || 0,
        }))
      );

      const total_referrals = (allRefs || []).length;
      const paying_referrals = (allRefs || []).filter((r) => (r.payment_count || 0) > 0).length;
      const conversion_rate = total_referrals > 0 ? paying_referrals / total_referrals : 0;

      return json({
        totals: {
          affiliates: (affiliates || []).length,
          counts_by_status,
          total_earned_all,
          total_paid_all,
          outstanding_balance: total_earned_all - total_paid_all,
        },
        payouts: {
          pending_payout_owed,
          payouts_pending_count,
          payouts_paid_total,
        },
        commissions: {
          mtd: mtd_commissions,
          all_time: total_commissions_all_time,
          pending: pending_commissions,
          by_type: byType,
        },
        referrals: {
          total: total_referrals,
          paying: paying_referrals,
          conversion_rate,
        },
        top_earners,
      });
    }

    if (operation === "detail") {
      const affiliateId = body.affiliate_id as string | undefined;
      if (!affiliateId) return json({ error: "affiliate_id required" }, 400);

      const { data: aff, error: affErr } = await admin
        .from("affiliates")
        .select("*")
        .eq("id", affiliateId)
        .single();
      if (affErr || !aff) return json({ error: "Affiliate not found" }, 404);

      const email = await emailFor(aff.user_id);

      let recruiter: { affiliate_code: string; email: string | null } | null = null;
      if (aff.recruited_by) {
        const { data: rec } = await admin
          .from("affiliates")
          .select("affiliate_code, user_id")
          .eq("id", aff.recruited_by)
          .single();
        if (rec) {
          recruiter = {
            affiliate_code: rec.affiliate_code,
            email: await emailFor(rec.user_id),
          };
        }
      }

      const { data: referrals } = await admin
        .from("affiliate_referrals")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });

      const referralsWithEmail = await Promise.all(
        (referrals || []).map(async (r) => ({
          ...r,
          email: await emailFor(r.referred_user_id),
        }))
      );

      const { data: commissions } = await admin
        .from("affiliate_commissions")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });

      const { data: payouts } = await admin
        .from("affiliate_payouts")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });

      const referrals_count = (referrals || []).length;
      const paying_count = (referrals || []).filter((r) => (r.payment_count || 0) > 0).length;
      const pending_commission_total = (commissions || [])
        .filter((c) => c.status === "pending")
        .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
      const requested_payout_total = (payouts || [])
        .filter((p) => p.status === "requested" || p.status === "approved")
        .reduce((s, p) => s + Number(p.amount || 0), 0);

      return json({
        affiliate: aff,
        email,
        recruiter,
        referrals: referralsWithEmail,
        commissions: commissions || [],
        payouts: payouts || [],
        stats: {
          referrals_count,
          paying_count,
          conversion_rate: referrals_count > 0 ? paying_count / referrals_count : 0,
          pending_commission_total,
          requested_payout_total,
          outstanding_balance:
            Number(aff.total_earned || 0) - Number(aff.total_paid || 0),
        },
      });
    }

    return json({ error: "Unknown operation" }, 400);
  } catch (err) {
    console.error("admin-affiliate-insights error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
