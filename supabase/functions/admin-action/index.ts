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
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify user and check admin role
    const userClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Check admin role using service role client
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

    const { operation, table, data, id, offset = 0, limit = 50, search } = await req.json();

    // Validate table name
    if (table && !ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Invalid table name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (operation) {
      case "stats": {
        // Get counts for dashboard
        const stats: Record<string, number> = {};
        for (const t of ["profiles", "brands", "designs", "affiliates"]) {
          const { count } = await adminClient
            .from(t)
            .select("*", { count: "exact", head: true });
          stats[t] = count || 0;
        }

        // Get total commissions
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

        // Add search if provided
        if (search && search.trim()) {
          // Search across common text fields
          const searchTerm = `%${search}%`;
          if (table === "profiles") {
            query = query.or(`full_name.ilike.${searchTerm},referral_code.ilike.${searchTerm}`);
          } else if (table === "brands") {
            query = query.or(`name.ilike.${searchTerm},tagline.ilike.${searchTerm}`);
          } else if (table === "designs") {
            query = query.or(`prompt.ilike.${searchTerm},title.ilike.${searchTerm}`);
          } else if (table === "affiliates") {
            query = query.or(`affiliate_code.ilike.${searchTerm},bank_name.ilike.${searchTerm}`);
          }
        }

        const { data: rows, count, error } = await query
          .range(offset, offset + limit - 1)
          .order("created_at", { ascending: false });

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
        const { error } = await adminClient
          .from(table)
          .update(data)
          .eq("id", id);

        if (error) throw error;

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
