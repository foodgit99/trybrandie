import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_MONTHLY = 5;
const LOW_CREDIT_THRESHOLD = 10;
const INACTIVE_DAYS = 7;

interface LeadRow {
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
  credit_grant_id?: string | null;
  granted_credits?: number;
  credited_at?: string | null;

  status: string;
}

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

function computeStatus(args: {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const action = body?.action as string;

    // ---- Public: referral link click tracking ----
    if (action === "track_click") {
      const code = String(body?.code || "").toLowerCase().trim();
      if (!code) {
        return new Response(JSON.stringify({ ok: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: link } = await admin
        .from("partner_referral_links")
        .select("id, click_count")
        .eq("code", code)
        .eq("active", true)
        .maybeSingle();
      if (link) {
        await admin
          .from("partner_referral_links")
          .update({ click_count: Number(link.click_count || 0) + 1 })
          .eq("id", link.id);
      }
      return new Response(JSON.stringify({ ok: true, matched: !!link }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Authenticated partner actions ----
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: partner } = await admin
      .from("partner_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!partner || partner.status !== "active") {
      return new Response(JSON.stringify({ error: "not_a_partner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: link } = await admin
      .from("partner_referral_links")
      .select("code, click_count, active")
      .eq("partner_id", partner.id)
      .eq("label", "Primary")
      .maybeSingle();

    // Build the partner's lead set (only whitelisted fields ever leave this function)
    const { data: leadRows } = await admin
      .from("partner_leads")
      .select("user_id, source, attributed_at, credit_grant_id, credits_granted, credited_at")
      .eq("partner_id", partner.id)
      .order("attributed_at", { ascending: false });

    const leadIds = (leadRows || []).map((l) => l.user_id);
    const leads: LeadRow[] = [];

    if (leadIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select(
          "user_id, full_name, subscription_tier, generations_count, generations_reset_at, bonus_credits, paid_credits, created_at"
        )
        .in("user_id", leadIds);

      const { data: rewards } = await admin
        .from("credit_rewards")
        .select("user_id, remaining, expires_at")
        .in("user_id", leadIds)
        .gt("remaining", 0)
        .gt("expires_at", new Date().toISOString());

      const { data: designs } = await admin
        .from("designs")
        .select("user_id, created_at")
        .in("user_id", leadIds);

      const { data: payments } = await admin
        .from("payment_transactions")
        .select("user_id, amount, status, created_at")
        .in("user_id", leadIds)
        .eq("status", "success");

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const rewardMap = new Map<string, any[]>();
      (rewards || []).forEach((r) => {
        rewardMap.set(r.user_id, [...(rewardMap.get(r.user_id) || []), r]);
      });
      const designCount = new Map<string, number>();
      const lastDesign = new Map<string, string>();
      (designs || []).forEach((d) => {
        designCount.set(d.user_id, (designCount.get(d.user_id) || 0) + 1);
        const prev = lastDesign.get(d.user_id);
        if (!prev || new Date(d.created_at) > new Date(prev)) lastDesign.set(d.user_id, d.created_at);
      });
      const paidMap = new Map<string, number>();
      (payments || []).forEach((p) => {
        paidMap.set(p.user_id, (paidMap.get(p.user_id) || 0) + Number(p.amount || 0));
      });

      for (const lr of leadRows || []) {
        const profile = profileMap.get(lr.user_id);
        if (!profile) continue;
        const credits = computeCredits(profile, rewardMap.get(lr.user_id) || []);
        const designs = designCount.get(lr.user_id) || 0;
        const lastActive = lastDesign.get(lr.user_id) || null;
        const plan = profile.subscription_tier || "free";
        const revenue = paidMap.get(lr.user_id) || 0;

        let email: string | null = null;
        const { data: au } = await admin.auth.admin.getUserById(lr.user_id);
        email = au?.user?.email || null;
        const lastSignIn = au?.user?.last_sign_in_at || null;
        const effectiveLastActive =
          lastActive && lastSignIn
            ? new Date(lastActive) > new Date(lastSignIn)
              ? lastActive
              : lastSignIn
            : lastActive || lastSignIn;

        leads.push({
          user_id: lr.user_id,
          full_name: profile.full_name,
          email,
          plan,
          credits,
          designs,
          last_active: effectiveLastActive,
          joined: profile.created_at,
          source: lr.source,
          attributed_at: lr.attributed_at,
          credit_grant_id: lr.credit_grant_id || null,
          granted_credits: lr.credits_granted || 0,
          credited_at: lr.credited_at || null,

          status: computeStatus({
            plan,
            credits,
            designs,
            joined: profile.created_at,
            lastActive: effectiveLastActive,
            everPaid: revenue > 0,
          }),
        });
      }
    }

    if (action === "overview") {
      const now = Date.now();
      const weekAgo = now - 7 * 86400000;
      const activated = leads.filter((l) => l.designs >= 1).length;
      const paying = leads.filter((l) => l.status === "paid" || l.status === "churned").length;
      const creditsDistributed = leads.reduce((s, l) => s + l.credits, 0);
      const newThisWeek = leads.filter((l) => new Date(l.attributed_at).getTime() >= weekAgo).length;
      const activatedThisWeek = leads.filter(
        (l) => l.designs >= 1 && new Date(l.attributed_at).getTime() >= weekAgo
      ).length;
      const paidThisWeek = leads.filter(
        (l) => l.status === "paid" && new Date(l.attributed_at).getTime() >= weekAgo
      ).length;

      const statusCounts: Record<string, number> = {};
      leads.forEach((l) => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });

      return new Response(
        JSON.stringify({
          partner: {
            id: partner.id,
            name: partner.name,
            partner_type: partner.partner_type,
            slug: partner.slug,
            status: partner.status,
            logo_url: partner.logo_url,
            commission_first_pct: partner.commission_first_pct,
            commission_recurring_pct: partner.commission_recurring_pct,
          },
          link: {
            code: link?.code || partner.slug,
            active: link?.active ?? true,
            clicks: link?.click_count ?? 0,
          },
          metrics: {
            leads: leads.length,
            activated,
            paying,
            conversion: leads.length > 0 ? (paying / leads.length) * 100 : 0,
            credits_distributed: creditsDistributed,
            week: { new_leads: newThisWeek, activated: activatedThisWeek, paid: paidThisWeek },
            statuses: statusCounts,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "alias") {
      // Read the partner's sending identity with the service role so the panel
      // never depends on client-side row visibility rules.
      const { data: aliasRow } = await admin
        .from("email_sender_aliases")
        .select(
          "id, handle, from_name, reply_to, status, review_note, reply_to_verified_at, created_at"
        )
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({ alias: aliasRow ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "credit_grants") {
      const { data: grants } = await admin
        .from("partner_credit_grants")
        .select("*")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ grants: grants ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "credit_grant_request") {
      const perSignup = Math.round(Number(body?.credits_per_signup));
      const budget = Math.round(Number(body?.total_budget_credits));
      const endsAt = body?.ends_at ? new Date(String(body.ends_at)) : null;
      const noteText = String(body?.request_note || "").slice(0, 1000);

      if (!Number.isFinite(perSignup) || perSignup < 1 || perSignup > 50) {
        return new Response(JSON.stringify({ error: "credits_per_signup must be between 1 and 50" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isFinite(budget) || budget < perSignup) {
        return new Response(JSON.stringify({ error: "total_budget_credits must be at least the credits per signup" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!endsAt || isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
        return new Response(JSON.stringify({ error: "ends_at must be a future date" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await admin
        .from("partner_credit_grants")
        .select("id, status")
        .eq("partner_id", partner.id)
        .in("status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({
            error:
              existing.status === "pending"
                ? "You already have a request waiting for review."
                : "You already have a live credits campaign.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: created, error: insErr } = await admin
        .from("partner_credit_grants")
        .insert({
          partner_id: partner.id,
          requested_by: userId,
          credits_per_signup: perSignup,
          total_budget_credits: budget,
          ends_at: endsAt.toISOString(),
          request_note: noteText || null,
          status: "pending",
        })
        .select("*")
        .single();
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ grant: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "leads") {

      return new Response(JSON.stringify({ leads }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "lead_detail") {
      const targetId = String(body?.user_id || "");
      const lead = leads.find((l) => l.user_id === targetId);
      if (!lead) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Lightweight activity timeline — counts and dates only, never content
      const timeline: Array<{ at: string; label: string }> = [
        { at: lead.joined, label: "Signed up" },
      ];

      const { data: brands } = await admin
        .from("brands")
        .select("created_at")
        .eq("user_id", targetId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (brands && brands[0]) timeline.push({ at: brands[0].created_at, label: "Set up Brand Centre" });

      const { data: designRows } = await admin
        .from("designs")
        .select("created_at")
        .eq("user_id", targetId)
        .order("created_at", { ascending: true });
      if (designRows && designRows[0]) timeline.push({ at: designRows[0].created_at, label: "Created first design" });
      if (designRows && designRows.length >= 3) {
        timeline.push({ at: designRows[2].created_at, label: "Created 3 designs" });
      }

      const { data: pay } = await admin
        .from("payment_transactions")
        .select("created_at, amount")
        .eq("user_id", targetId)
        .eq("status", "success")
        .order("created_at", { ascending: true });
      (pay || []).forEach((p) => timeline.push({ at: p.created_at, label: "Purchased credits or plan" }));

      if (lead.credits <= LOW_CREDIT_THRESHOLD) {
        timeline.push({ at: new Date().toISOString(), label: `Credits at ${lead.credits}` });
      }

      timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      return new Response(JSON.stringify({ lead, timeline }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid_action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("partner-portal error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
