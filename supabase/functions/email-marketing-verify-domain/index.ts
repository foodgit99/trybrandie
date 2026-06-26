// Verifies the configured marketing sender domain against Resend.
// Returns: { domain, status, records?, error? }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const domain = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";

    if (!resendKey) {
      return new Response(JSON.stringify({
        ok: false,
        domain,
        status: "missing_api_key",
        error: "RESEND_API_KEY is not configured. Add it in Settings → Secrets.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List domains and find ours.
    const listResp = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    const listData = await listResp.json().catch(() => ({}));
    if (!listResp.ok) {
      return new Response(JSON.stringify({
        ok: false,
        domain,
        status: "resend_error",
        error: listData?.message || `Resend ${listResp.status}`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const list = (listData?.data || []) as Array<{ id: string; name: string; status: string }>;
    const match = list.find(d => d.name.toLowerCase() === domain.toLowerCase());

    if (!match) {
      return new Response(JSON.stringify({
        ok: false,
        domain,
        status: "not_added",
        error: `Domain "${domain}" is not added in Resend. Add it at resend.com/domains, then set the MARKETING_EMAIL_DOMAIN secret to that domain.`,
        available: list.map(d => ({ name: d.name, status: d.status })),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch details for DNS records.
    const detailResp = await fetch(`https://api.resend.com/domains/${match.id}`, {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    const detail = await detailResp.json().catch(() => ({}));

    return new Response(JSON.stringify({
      ok: match.status === "verified",
      domain,
      status: match.status, // verified | pending | failed | not_started | temporary_failure
      records: detail?.records || [],
      id: match.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      status: "exception",
      error: (err as Error).message,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
