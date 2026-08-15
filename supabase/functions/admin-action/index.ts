import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPartnerLeads } from "../_shared/partner-leads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = [
  "profiles",
  "brands",
  "designs",
  "design_messages",
  "affiliates",
  "affiliate_referrals",
  "affiliate_commissions",
  "affiliate_payouts",
  "target_audiences",
  "referral_rewards",
  "brand_trend_preferences",
  "brand_inspiration",
  "design_folders",
  "design_folder_assignments",
  "user_roles",
  "email_campaigns",
  "email_campaign_logs",
  "email_sender_aliases",
  "credit_rewards",
  "partner_profiles",
  "partner_referral_links",
  "partner_leads",

];


async function sendAffiliateEmail(
  supabaseUrl: string,
  supabaseKey: string,
  type: string,
  to: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; queued?: boolean }> {
  const url = `${supabaseUrl}/functions/v1/send-email`;
  let lastError = "unknown_error";
  let queued = false;
  // Retry a couple of times: provider rate limits (429) and 5xx are transient
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ type, to, data }),
      });
      const text = await res.text();
      if (res.ok) return { ok: true };
      lastError = `${res.status}: ${text.slice(0, 400)}`;
      if (text.includes('"queued":true')) queued = true;
      console.error(`send-email failed (${type} -> ${to}):`, lastError);
      // Daily quota / permanent rejections are not worth retrying
      if (text.includes("daily_quota_exceeded") || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        break;
      }
    } catch (err) {
      lastError = String(err);
      console.error(`send-email threw (${type} -> ${to}):`, lastError);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return { ok: false, error: lastError, queued };
}


async function resolveSegment(
  adminClient: ReturnType<typeof createClient>,
  filters: Record<string, unknown>
): Promise<Array<{ user_id: string; email: string }>> {
  // Build profiles query
  let query = adminClient.from("profiles").select("user_id");

  // Filter by subscription tier
  const tiers = filters.tier as string[] | undefined;
  if (tiers && tiers.length > 0) {
    query = query.in("subscription_tier", tiers);
  }

  // Filter by signup date
  if (filters.signed_up_after) {
    query = query.gte("created_at", filters.signed_up_after as string);
  }
  if (filters.signed_up_before) {
    query = query.lte("created_at", filters.signed_up_before as string);
  }

  const { data: profiles, error } = await query;
  if (error) throw error;
  if (!profiles || profiles.length === 0) return [];

  let userIds = profiles.map((p) => p.user_id);

  // Filter by has_brand
  if (filters.has_brand === true) {
    const { data: brands } = await adminClient
      .from("brands")
      .select("user_id")
      .in("user_id", userIds);
    const brandUserIds = new Set((brands || []).map((b) => b.user_id));
    userIds = userIds.filter((id) => brandUserIds.has(id));
  }

  // Filter by min_designs
  const minDesigns = filters.min_designs as number | undefined;
  if (minDesigns && minDesigns > 0) {
    const { data: designs } = await adminClient
      .from("designs")
      .select("user_id")
      .in("user_id", userIds);
    const designCounts = new Map<string, number>();
    (designs || []).forEach((d) => {
      designCounts.set(d.user_id, (designCounts.get(d.user_id) || 0) + 1);
    });
    userIds = userIds.filter((id) => (designCounts.get(id) || 0) >= minDesigns);
  }

  // Filter by has_referrals
  if (filters.has_referrals === true) {
    const { data: rewards } = await adminClient
      .from("referral_rewards")
      .select("referrer_user_id")
      .in("referrer_user_id", userIds);
    const referrerIds = new Set((rewards || []).map((r) => r.referrer_user_id));
    userIds = userIds.filter((id) => referrerIds.has(id));
  }

  if (userIds.length === 0) return [];

  // Resolve emails from auth
  const results: Array<{ user_id: string; email: string }> = [];
  for (const uid of userIds) {
    const { data: authUser } = await adminClient.auth.admin.getUserById(uid);
    if (authUser?.user?.email) {
      results.push({ user_id: uid, email: authUser.user.email });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { operation, table, data, id, offset = 0, limit = 50, search, broadcast } = await req.json();

    if (table && !ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Invalid table name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (operation) {
      case "segment_count": {
        const filters = data?.segment_filters || {};
        const users = await resolveSegment(adminClient, filters);
        return new Response(JSON.stringify({ count: users.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_campaign": {
        const campaignId = data?.campaign_id;
        if (!campaignId) {
          return new Response(JSON.stringify({ error: "campaign_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch campaign
        const { data: campaign, error: campErr } = await adminClient
          .from("email_campaigns")
          .select("*")
          .eq("id", campaignId)
          .single();

        if (campErr || !campaign) {
          return new Response(JSON.stringify({ error: "Campaign not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update status to sending
        await adminClient.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

        // Resolve segment
        const recipients = await resolveSegment(adminClient, campaign.segment_filters || {});

        // Update recipient count
        await adminClient.from("email_campaigns").update({ recipient_count: recipients.length }).eq("id", campaignId);

        let sent = 0;
        let failed = 0;

        for (const recipient of recipients) {
          try {
            const emailUrl = `${supabaseUrl}/functions/v1/send-email`;
            const res = await fetch(emailUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                type: "campaign",
                to: recipient.email,
                data: {
                  subject_line: campaign.subject,
                  headline: campaign.headline || campaign.subject,
                  message: campaign.body,
                  cta_text: campaign.cta_text,
                  cta_url: campaign.cta_url,
                  sender_name: campaign.sender_name || "Brandie",
                },
              }),
            });

            if (res.ok) {
              sent++;
              await adminClient.from("email_campaign_logs").insert({
                campaign_id: campaignId,
                user_id: recipient.user_id,
                email: recipient.email,
                status: "sent",
              });
            } else {
              const errBody = await res.text();
              failed++;
              await adminClient.from("email_campaign_logs").insert({
                campaign_id: campaignId,
                user_id: recipient.user_id,
                email: recipient.email,
                status: "failed",
                error: errBody,
              });
            }
          } catch (err) {
            failed++;
            await adminClient.from("email_campaign_logs").insert({
              campaign_id: campaignId,
              user_id: recipient.user_id,
              email: recipient.email,
              status: "failed",
              error: err.message,
            });
          }
        }

        // Update campaign with final counts
        await adminClient
          .from("email_campaigns")
          .update({ status: "sent", sent_count: sent, failed_count: failed })
          .eq("id", campaignId);

        return new Response(JSON.stringify({ sent, failed, total: recipients.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "broadcast": {
        if (broadcast?.countOnly) {
          const { count } = await adminClient
            .from("affiliates")
            .select("*", { count: "exact", head: true })
            .eq("status", "approved");
          return new Response(JSON.stringify({ count: count || 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { subject_line, headline, message, cta_text, cta_url } = broadcast || {};
        if (!subject_line || !message) {
          return new Response(JSON.stringify({ error: "subject_line and message are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: affiliates, error: affErr } = await adminClient
          .from("affiliates")
          .select("user_id")
          .eq("status", "approved");

        if (affErr) throw affErr;

        let sent = 0;
        let failed = 0;
        const total = affiliates?.length || 0;

        for (const aff of affiliates || []) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(aff.user_id);
          const email = authUser?.user?.email;
          if (email) {
            try {
              await sendAffiliateEmail(supabaseUrl, serviceRoleKey, "affiliate_broadcast", email, {
                subject_line,
                headline,
                message,
                cta_text,
                cta_url,
              });
              sent++;
            } catch {
              failed++;
            }
          } else {
            failed++;
          }
        }

        return new Response(JSON.stringify({ sent, failed, total }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "stats": {
        const stats: Record<string, number> = {};
        for (const t of ["profiles", "brands", "designs", "affiliates"]) {
          const { count } = await adminClient
            .from(t)
            .select("*", { count: "exact", head: true });
          stats[t] = count || 0;
        }

        const { data: commData } = await adminClient
          .from("affiliate_commissions")
          .select("commission_amount");
        stats.totalRevenue = commData?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

        return new Response(JSON.stringify({ stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        let query = adminClient.from(table).select("*", { count: "exact" });

        if (search && search.trim()) {
          const searchTerm = `%${search}%`;
          if (table === "profiles") {
            query = query.or(`full_name.ilike.${searchTerm},referral_code.ilike.${searchTerm}`);
          } else if (table === "brands") {
            query = query.or(`name.ilike.${searchTerm},tagline.ilike.${searchTerm}`);
          } else if (table === "designs") {
            query = query.or(`prompt.ilike.${searchTerm},title.ilike.${searchTerm}`);
          } else if (table === "affiliates") {
            query = query.or(`affiliate_code.ilike.${searchTerm},bank_name.ilike.${searchTerm}`);
          } else if (table === "email_campaigns") {
            query = query.or(`subject.ilike.${searchTerm},headline.ilike.${searchTerm}`);
          } else if (table === "email_sender_aliases") {
            query = query.or(`handle.ilike.${searchTerm},reply_to.ilike.${searchTerm},from_name.ilike.${searchTerm}`);
          }

        }

        const orderCol = table === "email_campaign_logs" ? "sent_at" : "created_at";
        const { data: rows, count, error } = await query
          .range(offset, offset + limit - 1)
          .order(orderCol, { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ rows, count }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get": {
        const { data: row, error } = await adminClient
          .from(table)
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ row }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        let oldStatus: string | null = null;
        let affiliateUserId: string | null = null;
        let affiliateCode: string | null = null;
        let payoutAmount: number | null = null;

        if (
          (table === "affiliates" || table === "affiliate_payouts") &&
          data?.status
        ) {
          const { data: oldRecord } = await adminClient
            .from(table)
            .select("*")
            .eq("id", id)
            .single();

          if (oldRecord) {
            oldStatus = oldRecord.status;

            if (table === "affiliates") {
              affiliateUserId = oldRecord.user_id;
              affiliateCode = oldRecord.affiliate_code;
            } else if (table === "affiliate_payouts") {
              payoutAmount = oldRecord.amount;
              const { data: affiliate } = await adminClient
                .from("affiliates")
                .select("user_id")
                .eq("id", oldRecord.affiliate_id)
                .single();
              affiliateUserId = affiliate?.user_id || null;
            }
          }
        }

        const { error } = await adminClient
          .from(table)
          .update(data)
          .eq("id", id);

        if (error) throw error;

        if (affiliateUserId && data?.status && data.status !== oldStatus) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(affiliateUserId);
          const email = authUser?.user?.email;

          if (email) {
            if (table === "affiliates") {
              if (data.status === "approved") {
                await sendAffiliateEmail(supabaseUrl, serviceRoleKey, "affiliate_approved", email, {
                  affiliate_code: affiliateCode,
                });
              } else if (data.status === "rejected" || data.status === "suspended") {
                await sendAffiliateEmail(supabaseUrl, serviceRoleKey, "affiliate_rejected", email, {});
              }
            } else if (table === "affiliate_payouts") {
              if (data.status === "paid" || data.status === "rejected") {
                await sendAffiliateEmail(supabaseUrl, serviceRoleKey, "affiliate_payout_processed", email, {
                  amount: payoutAmount,
                  status: data.status,
                });
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { error } = await adminClient.from(table).delete().eq("id", id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_user_email": {
        const { user_id: targetUserId } = data || {};
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "user_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId);
        return new Response(JSON.stringify({ email: authUser?.user?.email || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "insert": {
        const { data: row, error } = await adminClient
          .from(table)
          .insert(data)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ row }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "grant_reward": {
        const { user_id: targetUserId, amount: rewardAmount, reason: rewardReason, expires_in_days, expires_at: customExpiresAt } = data || {};
        if (!targetUserId || !rewardAmount || rewardAmount < 1) {
          return new Response(JSON.stringify({ error: "user_id and amount (>= 1) are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let expiresAt: Date;
        if (customExpiresAt) {
          expiresAt = new Date(customExpiresAt);
        } else {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 30));
        }

        const { data: reward, error: rewardErr } = await adminClient
          .from("credit_rewards")
          .insert({
            user_id: targetUserId,
            amount: rewardAmount,
            remaining: rewardAmount,
            reason: rewardReason || "",
            granted_by: userId,
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (rewardErr) throw rewardErr;

        return new Response(JSON.stringify({ reward }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "bulk_grant_reward": {
        const {
          recipients,
          user_ids: providedUserIds,
          tiers,
          amount: bulkAmount,
          reason: bulkReason,
          expires_in_days: bulkDays,
          expires_at: bulkExpiresAt,
        } = data || {};

        if (!bulkAmount || bulkAmount < 1) {
          return new Response(JSON.stringify({ error: "amount (>= 1) is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let recipientIds: string[] = [];

        if (recipients === "specific") {
          if (!Array.isArray(providedUserIds) || providedUserIds.length === 0) {
            return new Response(JSON.stringify({ error: "user_ids array required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          recipientIds = providedUserIds;
        } else if (recipients === "tier") {
          if (!Array.isArray(tiers) || tiers.length === 0) {
            return new Response(JSON.stringify({ error: "tiers array required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data: tierProfiles, error: tpErr } = await adminClient
            .from("profiles")
            .select("user_id")
            .in("subscription_tier", tiers);
          if (tpErr) throw tpErr;
          recipientIds = (tierProfiles || []).map((p) => p.user_id);
        } else if (recipients === "all") {
          const { data: allProfiles, error: apErr } = await adminClient
            .from("profiles")
            .select("user_id");
          if (apErr) throw apErr;
          recipientIds = (allProfiles || []).map((p) => p.user_id);
        } else {
          return new Response(JSON.stringify({ error: "invalid recipients mode" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (recipientIds.length === 0) {
          return new Response(JSON.stringify({ granted: 0, user_count: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let expiresAt: Date;
        if (bulkExpiresAt) {
          expiresAt = new Date(bulkExpiresAt);
        } else {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (bulkDays || 30));
        }

        const rows = recipientIds.map((uid) => ({
          user_id: uid,
          amount: bulkAmount,
          remaining: bulkAmount,
          reason: bulkReason || "",
          granted_by: userId,
          expires_at: expiresAt.toISOString(),
        }));

        // Insert in batches of 500 to stay safe
        let inserted = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error: insErr, count } = await adminClient
            .from("credit_rewards")
            .insert(batch, { count: "exact" });
          if (insErr) throw insErr;
          inserted += count || batch.length;
        }

        return new Response(
          JSON.stringify({ granted: inserted, user_count: recipientIds.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update_reward": {
        const { id: rewardId, amount: newAmount, reason: newReason, expires_at: newExpiresAt } = data || {};
        if (!rewardId) {
          return new Response(JSON.stringify({ error: "id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: existing, error: exErr } = await adminClient
          .from("credit_rewards")
          .select("*")
          .eq("id", rewardId)
          .single();
        if (exErr) throw exErr;

        const update: Record<string, unknown> = {};
        if (typeof newReason === "string") update.reason = newReason;
        if (newExpiresAt) update.expires_at = new Date(newExpiresAt).toISOString();

        if (typeof newAmount === "number" && newAmount >= 1) {
          const consumed = (existing.amount || 0) - (existing.remaining || 0);
          const newRemaining = Math.max(0, newAmount - consumed);
          update.amount = newAmount;
          update.remaining = newRemaining;
        }

        const { data: updated, error: updErr } = await adminClient
          .from("credit_rewards")
          .update(update)
          .eq("id", rewardId)
          .select()
          .single();
        if (updErr) throw updErr;

        return new Response(JSON.stringify({ reward: updated }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reward_stats": {
        const nowIso = new Date().toISOString();
        const { data: allRewards, error: rsErr } = await adminClient
          .from("credit_rewards")
          .select("amount, remaining, expires_at, user_id");
        if (rsErr) throw rsErr;

        const rewards = allRewards || [];
        let totalGranted = 0;
        let outstanding = 0;
        let expiredUnused = 0;
        const activeRecipients = new Set<string>();

        for (const r of rewards) {
          totalGranted += r.amount || 0;
          const isExpired = new Date(r.expires_at) <= new Date(nowIso);
          if (!isExpired && (r.remaining || 0) > 0) {
            outstanding += r.remaining || 0;
            activeRecipients.add(r.user_id);
          }
          if (isExpired) {
            expiredUnused += r.remaining || 0;
          }
        }

        return new Response(
          JSON.stringify({
            stats: {
              totalRewards: rewards.length,
              totalGranted,
              outstanding,
              expiredUnused,
              activeRecipients: activeRecipients.size,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "search_users": {
        const { query: searchQuery, limit: searchLimit = 20 } = data || {};
        if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim().length < 2) {
          return new Response(JSON.stringify({ users: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const term = `%${searchQuery.trim()}%`;
        const { data: profileMatches, error: pmErr } = await adminClient
          .from("profiles")
          .select("user_id, full_name, referral_code, subscription_tier")
          .or(`full_name.ilike.${term},referral_code.ilike.${term}`)
          .limit(searchLimit);
        if (pmErr) throw pmErr;

        const results: Array<{
          user_id: string;
          full_name: string | null;
          email: string | null;
          subscription_tier: string;
        }> = [];

        for (const p of profileMatches || []) {
          const { data: au } = await adminClient.auth.admin.getUserById(p.user_id);
          results.push({
            user_id: p.user_id,
            full_name: p.full_name,
            email: au?.user?.email || null,
            subscription_tier: p.subscription_tier,
          });
        }

        // Also search by email — list a page and filter
        if (searchQuery.includes("@") || results.length < searchLimit) {
          try {
            const { data: page } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
            const emailMatches = (page?.users || []).filter((u) =>
              u.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            for (const u of emailMatches) {
              if (results.find((r) => r.user_id === u.id)) continue;
              const { data: prof } = await adminClient
                .from("profiles")
                .select("full_name, subscription_tier")
                .eq("user_id", u.id)
                .maybeSingle();
              results.push({
                user_id: u.id,
                full_name: prof?.full_name || null,
                email: u.email || null,
                subscription_tier: prof?.subscription_tier || "free",
              });
              if (results.length >= searchLimit) break;
            }
          } catch (_e) {
            // ignore
          }
        }

        return new Response(JSON.stringify({ users: results.slice(0, searchLimit) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ---------- Partner module ----------
      case "promote_to_partner": {
        const {
          user_id,
          name,
          partner_type = "marketing_partner",
          slug,
          contact_person,
          contact_email,
          contact_phone,
          organization,
          commission_first_pct = 0,
          commission_recurring_pct = 0,
          status = "active",
          start_date,
          end_date,
          notes,
        } = data || {};

        if (!user_id || !name || !slug) {
          return new Response(JSON.stringify({ error: "user_id, name and slug are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const cleanSlug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
        if (cleanSlug.length < 3) {
          return new Response(JSON.stringify({ error: "slug must be at least 3 characters" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Upgrade or create the affiliate record so the tier stays a single source of truth
        const { data: existingAff } = await adminClient
          .from("affiliates")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        let affiliateId = existingAff?.id as string | undefined;
        if (affiliateId) {
          await adminClient
            .from("affiliates")
            .update({ tier: "marketing_partner", status: "approved" })
            .eq("id", affiliateId);
        } else {
          const { data: newAff, error: affErr } = await adminClient
            .from("affiliates")
            .insert({
              user_id,
              tier: "marketing_partner",
              status: "approved",
              affiliate_code: cleanSlug,
              agreed_terms: true,
              agreed_disclosure: true,
            })
            .select("id")
            .single();
          if (affErr) throw affErr;
          affiliateId = newAff.id;
        }

        const { data: partner, error: partnerErr } = await adminClient
          .from("partner_profiles")
          .upsert(
            {
              user_id,
              affiliate_id: affiliateId,
              name,
              partner_type,
              slug: cleanSlug,
              contact_person: contact_person || null,
              contact_email: contact_email || null,
              contact_phone: contact_phone || null,
              organization: organization || null,
              commission_first_pct: Number(commission_first_pct) || 0,
              commission_recurring_pct: Number(commission_recurring_pct) || 0,
              status,
              ...(start_date ? { start_date } : {}),
              end_date: end_date || null,
              notes: notes || null,
            },
            { onConflict: "user_id" }
          )
          .select("*")
          .single();
        if (partnerErr) throw partnerErr;

        // Ensure a primary referral link exists
        const { data: existingLink } = await adminClient
          .from("partner_referral_links")
          .select("id, code")
          .eq("partner_id", partner.id)
          .eq("label", "Primary")
          .maybeSingle();

        if (!existingLink) {
          await adminClient.from("partner_referral_links").insert({
            partner_id: partner.id,
            code: cleanSlug,
            label: "Primary",
          });
        } else if (existingLink.code !== cleanSlug) {
          await adminClient
            .from("partner_referral_links")
            .update({ code: cleanSlug })
            .eq("id", existingLink.id);
        }

        // Notify the new partner
        let notifyEmail = (contact_email as string) || "";
        if (!notifyEmail) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(user_id);
          notifyEmail = authUser?.user?.email || "";
        }
        let notified = false;
        let notifyError: string | undefined;
        let notifyQueued = false;
        if (notifyEmail) {
          const sent = await sendAffiliateEmail(supabaseUrl, serviceRoleKey, "partner_promoted", notifyEmail, {
            partner_name: name,
            slug: cleanSlug,
            commission_first_pct: Number(commission_first_pct) || 0,
            commission_recurring_pct: Number(commission_recurring_pct) || 0,
          });
          notified = sent.ok;
          notifyError = sent.error;
          notifyQueued = !!sent.queued;
        } else {
          notifyError = "no_email_on_file";
        }

        return new Response(
          JSON.stringify({ partner, notified, notify_email: notifyEmail || null, notify_error: notifyError, notify_queued: notifyQueued }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "resend_partner_welcome": {
        const { partner_id } = data || {};
        if (!partner_id) {
          return new Response(JSON.stringify({ error: "partner_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: p, error: pErr } = await adminClient
          .from("partner_profiles")
          .select("user_id, name, slug, contact_email, commission_first_pct, commission_recurring_pct")
          .eq("id", partner_id)
          .single();
        if (pErr) throw pErr;

        let email = (p.contact_email as string) || "";
        if (!email) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(p.user_id as string);
          email = authUser?.user?.email || "";
        }
        if (!email) {
          return new Response(JSON.stringify({ notified: false, notify_error: "no_email_on_file" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const sent = await sendAffiliateEmail(supabaseUrl, serviceRoleKey, "partner_promoted", email, {
          partner_name: p.name,
          slug: p.slug,
          commission_first_pct: Number(p.commission_first_pct) || 0,
          commission_recurring_pct: Number(p.commission_recurring_pct) || 0,
        });

        return new Response(
          JSON.stringify({ notified: sent.ok, notify_email: email, notify_error: sent.error, notify_queued: !!sent.queued }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }


      case "partner_list": {
        const { data: partners, error: pErr } = await adminClient
          .from("partner_profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;

        const enriched: Array<Record<string, unknown>> = [];
        for (const p of partners || []) {
          const { data: leads } = await adminClient
            .from("partner_leads")
            .select("user_id")
            .eq("partner_id", p.id);
          const leadIds = (leads || []).map((l) => l.user_id);

          let paid = 0;
          let revenue = 0;
          if (leadIds.length > 0) {
            const { data: profs } = await adminClient
              .from("profiles")
              .select("user_id, subscription_tier")
              .in("user_id", leadIds);
            paid = (profs || []).filter((pr) => pr.subscription_tier && pr.subscription_tier !== "free").length;

            const { data: txs } = await adminClient
              .from("payment_transactions")
              .select("amount, status, user_id")
              .in("user_id", leadIds)
              .eq("status", "success");
            revenue = (txs || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          }

          const { data: link } = await adminClient
            .from("partner_referral_links")
            .select("code, click_count, active")
            .eq("partner_id", p.id)
            .eq("label", "Primary")
            .maybeSingle();

          const { data: au } = await adminClient.auth.admin.getUserById(p.user_id);

          enriched.push({
            ...p,
            email: au?.user?.email || p.contact_email || null,
            leads: leadIds.length,
            paid,
            revenue,
            link_code: link?.code || p.slug,
            link_active: link?.active ?? true,
            clicks: link?.click_count ?? 0,
          });
        }

        return new Response(JSON.stringify({ partners: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "partner_detail": {
        const { partner_id } = data || {};
        if (!partner_id) {
          return new Response(JSON.stringify({ error: "partner_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: partner, error: detErr } = await adminClient
          .from("partner_profiles")
          .select("*")
          .eq("id", partner_id)
          .maybeSingle();
        if (detErr) throw detErr;
        if (!partner) {
          return new Response(JSON.stringify({ error: "Partner not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const [
          leads,
          { data: links },
          { data: campaigns },
          { data: automations },
          { data: sends },
          { data: runs },
          { data: au2 },
        ] = await Promise.all([
          buildPartnerLeads(adminClient, partner_id),
          adminClient
            .from("partner_referral_links")
            .select("code, label, active, click_count, created_at")
            .eq("partner_id", partner_id),
          adminClient
            .from("partner_campaigns")
            .select(
              "id, name, subject, status, recipients_count, delivered_count, opened_count, clicked_count, scheduled_for, sent_at, created_at",
            )
            .eq("partner_id", partner_id)
            .order("created_at", { ascending: false })
            .limit(25),
          adminClient
            .from("partner_automations")
            .select("id, name, subject, trigger, active, delay_hours, sent_count, last_run_at, created_at")
            .eq("partner_id", partner_id)
            .order("created_at", { ascending: false }),
          adminClient
            .from("partner_campaign_sends")
            .select("id, email, status, sent_at, opened_at, clicked_at, created_at")
            .eq("partner_id", partner_id)
            .order("created_at", { ascending: false })
            .limit(20),
          adminClient
            .from("partner_automation_runs")
            .select("id, email, status, created_at, automation_id")
            .eq("partner_id", partner_id)
            .order("created_at", { ascending: false })
            .limit(20),
          adminClient.auth.admin.getUserById(partner.user_id),
        ]);

        const leadIds = leads.map((l) => l.user_id);
        let revenue = 0;
        let transactions: Array<Record<string, unknown>> = [];
        if (leadIds.length > 0) {
          const { data: txs } = await adminClient
            .from("payment_transactions")
            .select("id, amount, status, created_at, user_id")
            .in("user_id", leadIds)
            .eq("status", "success")
            .order("created_at", { ascending: false })
            .limit(20);
          transactions = txs || [];
          revenue = (txs || []).reduce((s, t) => s + Number(t.amount || 0), 0);
        }

        const statuses: Record<string, number> = {};
        for (const l of leads) statuses[l.status] = (statuses[l.status] || 0) + 1;

        const weekAgo = Date.now() - 7 * 86400000;
        const metrics = {
          leads: leads.length,
          activated: leads.filter((l) => l.first_design_at).length,
          paying: leads.filter((l) => l.ever_paid || (l.plan && l.plan !== "free")).length,
          revenue,
          clicks: (links || []).reduce((s, l) => s + Number(l.click_count || 0), 0),
          emails_sent: (campaigns || []).reduce((s, c) => s + Number(c.delivered_count || 0), 0) +
            (automations || []).reduce((s, a) => s + Number(a.sent_count || 0), 0),
          new_leads_week: leads.filter((l) => new Date(l.attributed_at).getTime() > weekAgo).length,
          statuses,
        };

        // Affiliate programme requests from this partner + their attributed leads
        const affiliateUserIds = Array.from(new Set([partner.user_id, ...leadIds].filter(Boolean)));
        let affiliateRequests: Array<Record<string, unknown>> = [];
        if (affiliateUserIds.length > 0) {
          const { data: affRows } = await adminClient
            .from("affiliates")
            .select(
              "id, user_id, affiliate_code, status, tier, primary_channel, channel_handle, channel_url, audience_size, niche, regions, promo_plan, why_join, whatsapp_number, location, created_at, application_submitted_at",
            )
            .in("user_id", affiliateUserIds)
            .order("created_at", { ascending: false });

          affiliateRequests = await Promise.all(
            (affRows || []).map(async (row) => {
              const { data: au } = await adminClient.auth.admin.getUserById(row.user_id as string);
              const lead = leads.find((l) => l.user_id === row.user_id);
              return {
                ...row,
                email: au?.user?.email || null,
                full_name: lead?.full_name || au?.user?.user_metadata?.full_name || null,
                relation: row.user_id === partner.user_id ? "partner" : "lead",
              };
            }),
          );
        }

        return new Response(
          JSON.stringify({
            partner: { ...partner, email: au2?.user?.email || partner.contact_email || null },
            links: links || [],
            metrics,
            leads,
            campaigns: campaigns || [],
            automations: automations || [],
            sends: sends || [],
            runs: runs || [],
            transactions,
            affiliate_requests: affiliateRequests,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "partner_affiliate_decision": {
        const { partner_id, affiliate_id, decision, note } = data || {};
        if (!partner_id || !affiliate_id || !["approved", "rejected"].includes(decision)) {
          return new Response(
            JSON.stringify({ error: "partner_id, affiliate_id and decision (approved|rejected) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { data: partnerRow } = await adminClient
          .from("partner_profiles")
          .select("id, user_id, name")
          .eq("id", partner_id)
          .maybeSingle();
        if (!partnerRow) {
          return new Response(JSON.stringify({ error: "Partner not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: affRow } = await adminClient
          .from("affiliates")
          .select("id, user_id, affiliate_code, status")
          .eq("id", affiliate_id)
          .maybeSingle();
        if (!affRow) {
          return new Response(JSON.stringify({ error: "Affiliate request not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Scope guard: must belong to the partner or one of their attributed leads
        let inScope = affRow.user_id === partnerRow.user_id;
        if (!inScope) {
          const { data: leadRow } = await adminClient
            .from("partner_leads")
            .select("user_id")
            .eq("partner_id", partner_id)
            .eq("user_id", affRow.user_id)
            .maybeSingle();
          inScope = !!leadRow;
        }
        if (!inScope) {
          return new Response(JSON.stringify({ error: "This request does not belong to this partner" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updErr } = await adminClient
          .from("affiliates")
          .update({ status: decision })
          .eq("id", affiliate_id);
        if (updErr) throw updErr;

        const { data: affUser } = await adminClient.auth.admin.getUserById(affRow.user_id as string);
        const email = affUser?.user?.email || null;
        let notified = false;
        let notifyError: string | undefined;

        if (email) {
          const res = await sendAffiliateEmail(
            supabaseUrl,
            serviceRoleKey,
            decision === "approved" ? "partner_affiliate_approved" : "partner_affiliate_rejected",
            email,
            {
              name: affUser?.user?.user_metadata?.full_name || "",
              affiliate_code: affRow.affiliate_code,
              partner_name: partnerRow.name,
              note: note || "",
            },
          );
          notified = res.ok;
          notifyError = res.error;
        } else {
          notifyError = "no_email_on_file";
        }

        return new Response(JSON.stringify({ success: true, notified, notify_email: email, notify_error: notifyError }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }


      case "partner_set_slug": {

        const { partner_id, slug: newSlug, active } = data || {};
        if (!partner_id) {
          return new Response(JSON.stringify({ error: "partner_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (newSlug) {
          const clean = String(newSlug).toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
          await adminClient.from("partner_profiles").update({ slug: clean }).eq("id", partner_id);
          await adminClient
            .from("partner_referral_links")
            .update({ code: clean })
            .eq("partner_id", partner_id)
            .eq("label", "Primary");
        }
        if (typeof active === "boolean") {
          await adminClient
            .from("partner_referral_links")
            .update({ active })
            .eq("partner_id", partner_id)
            .eq("label", "Primary");
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "partner_attribute_user": {
        const { partner_id, user_id: leadUserId } = data || {};
        if (!partner_id || !leadUserId) {
          return new Response(JSON.stringify({ error: "partner_id and user_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: attErr } = await adminClient
          .from("partner_leads")
          .upsert(
            { partner_id, user_id: leadUserId, source: "manual" },
            { onConflict: "user_id" }
          );
        if (attErr) throw attErr;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "alias_list": {
        const { data: aliases, error: aliasErr } = await adminClient
          .from("email_sender_aliases")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (aliasErr) throw aliasErr;

        const brandIds = Array.from(new Set((aliases || []).map((a) => a.brand_id).filter(Boolean)));
        const partnerIds = Array.from(new Set((aliases || []).map((a) => a.partner_id).filter(Boolean)));

        const [{ data: brandRows }, { data: partnerRows }] = await Promise.all([
          brandIds.length
            ? adminClient.from("brands").select("id, name").in("id", brandIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
          partnerIds.length
            ? adminClient.from("partner_profiles").select("id, name, slug").in("id", partnerIds)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
        ]);

        const brandMap = new Map((brandRows || []).map((b) => [b.id, b.name]));
        const partnerMap = new Map((partnerRows || []).map((p) => [p.id, p]));

        const enriched = await Promise.all(
          (aliases || []).map(async (a) => {
            let email: string | null = null;
            let fullName: string | null = null;
            if (a.user_id) {
              const { data: au } = await adminClient.auth.admin.getUserById(a.user_id as string);
              email = au?.user?.email || null;
              fullName = (au?.user?.user_metadata?.full_name as string) || null;
            }
            const partner = a.partner_id ? partnerMap.get(a.partner_id as string) : null;
            return {
              ...a,
              owner_type: a.partner_id ? "partner" : "brand",
              owner_name: partner ? partner.name : brandMap.get(a.brand_id as string) || null,
              partner_slug: partner?.slug || null,
              requester_email: email,
              requester_name: fullName,
            };
          }),
        );

        return new Response(JSON.stringify({ aliases: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "alias_decision": {
        const { alias_id, decision, note } = data || {};
        if (!alias_id || !["approved", "rejected", "revoked"].includes(decision)) {
          return new Response(
            JSON.stringify({ error: "alias_id and decision (approved|rejected|revoked) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { data: alias, error: findErr } = await adminClient
          .from("email_sender_aliases")
          .select("*")
          .eq("id", alias_id)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!alias) {
          return new Response(JSON.stringify({ error: "Alias not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: aliasUpdErr } = await adminClient
          .from("email_sender_aliases")
          .update({
            status: decision,
            review_note: note || null,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", alias_id);
        if (aliasUpdErr) throw aliasUpdErr;

        // Notify the requester
        let notified = false;
        let notifyError: string | undefined;
        let notifyEmail: string | null = alias.reply_to || null;
        if (alias.user_id) {
          const { data: au } = await adminClient.auth.admin.getUserById(alias.user_id as string);
          notifyEmail = au?.user?.email || notifyEmail;
        }

        if (!notifyEmail) {
          notifyError = "no_email_on_file";
        } else if (decision === "approved" || decision === "rejected") {
          const domain = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";
          const res = await sendAffiliateEmail(
            supabaseUrl,
            serviceRoleKey,
            decision === "approved" ? "alias_approved" : "alias_rejected",
            notifyEmail,
            {
              handle: alias.handle,
              address: `${alias.handle}@${domain}`,
              from_name: alias.from_name,
              owner_type: alias.partner_id ? "partner" : "brand",
              note: note || "",
            },
          );
          notified = res.ok;
          if (!res.ok) notifyError = res.error;
        }

        return new Response(
          JSON.stringify({ ok: true, notified, notify_email: notifyEmail, notify_error: notifyError }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:


        return new Response(JSON.stringify({ error: "Invalid operation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Admin action error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
