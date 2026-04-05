import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
];

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
