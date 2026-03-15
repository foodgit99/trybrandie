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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];
    const dateFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // Query content ideas scheduled for today
    const { data: ideas, error: ideasError } = await supabase
      .from("content_ideas")
      .select(`
        id, title, user_id,
        content_pillars ( name ),
        post_series ( name )
      `)
      .eq("scheduled_for", today)
      .in("status", ["suggested", "scheduled"]);

    if (ideasError) {
      console.error("Error fetching ideas:", ideasError);
      return new Response(JSON.stringify({ error: ideasError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ideas || ideas.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No ideas scheduled for today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group ideas by user_id
    const grouped: Record<string, Array<{ title: string; pillar?: string; series?: string }>> = {};
    for (const idea of ideas) {
      if (!grouped[idea.user_id]) grouped[idea.user_id] = [];
      grouped[idea.user_id].push({
        title: idea.title,
        pillar: (idea as any).content_pillars?.name,
        series: (idea as any).post_series?.name,
      });
    }

    const userIds = Object.keys(grouped);

    // Fetch profiles for names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const profileMap: Record<string, string> = {};
    for (const p of profiles || []) {
      profileMap[p.user_id] = p.full_name || "";
    }

    // Fetch emails from auth.users via admin API
    let emailsSent = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError || !userData?.user?.email) {
          errors.push(`No email for user ${userId}`);
          continue;
        }

        const email = userData.user.email;
        const name = profileMap[userId] || "";
        const userIdeas = grouped[userId];

        // Call send-email function
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "daily_content_reminder",
            to: email,
            data: {
              name,
              date: dateFormatted,
              ideas: userIdeas,
            },
          }),
        });

        if (sendRes.ok) {
          emailsSent++;
        } else {
          const err = await sendRes.text();
          errors.push(`Failed for ${userId}: ${err}`);
        }
      } catch (e) {
        errors.push(`Error for ${userId}: ${e.message}`);
      }
    }

    console.log(`Daily reminder: sent ${emailsSent}/${userIds.length} emails`);
    if (errors.length) console.error("Errors:", errors);

    return new Response(
      JSON.stringify({ sent: emailsSent, total_users: userIds.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("content-daily-reminder error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
