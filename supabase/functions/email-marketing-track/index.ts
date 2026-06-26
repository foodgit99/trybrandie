// Tracking endpoints:
//   GET /email-marketing-track/o/<send_id>.gif  -> 1x1 open pixel
//   GET /email-marketing-track/c/<slug>?s=<send_id>  -> click redirect
//   GET /email-marketing-track/u/<send_id>  -> one-click unsubscribe
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // parts: ['email-marketing-track', kind, id]
  const kind = parts[1];
  const idPart = parts[2] || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (kind === "o") {
      const sendId = idPart.replace(/\.gif$/i, "");
      if (sendId) {
        const { data: existing } = await supabase.from("email_sends").select("opened_at,open_count,broadcast_id").eq("id", sendId).maybeSingle();
        if (existing) {
          await supabase.from("email_sends").update({
            opened_at: existing.opened_at || new Date().toISOString(),
            open_count: (existing.open_count || 0) + 1,
          }).eq("id", sendId);
          if (existing.broadcast_id && !existing.opened_at) {
            await supabase.rpc("update_updated_at_column"); // no-op safety; increment below
            await supabase.from("email_broadcasts").update({
              opens_count: (await supabase.from("email_sends").select("id", { count: "exact", head: true }).eq("broadcast_id", existing.broadcast_id).not("opened_at", "is", null)).count || 0,
            }).eq("id", existing.broadcast_id);
          }
        }
      }
      return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
    }

    if (kind === "c") {
      const slug = idPart;
      const sendId = url.searchParams.get("s");
      const { data: link } = await supabase.from("email_links").select("url,broadcast_id,click_count").eq("slug", slug).maybeSingle();
      if (!link) return new Response("not found", { status: 404 });
      await supabase.from("email_links").update({ click_count: (link.click_count || 0) + 1 }).eq("slug", slug);
      if (sendId) {
        const { data: send } = await supabase.from("email_sends").select("clicked_at,click_count").eq("id", sendId).maybeSingle();
        if (send) {
          await supabase.from("email_sends").update({
            clicked_at: send.clicked_at || new Date().toISOString(),
            click_count: (send.click_count || 0) + 1,
          }).eq("id", sendId);
        }
      }
      await supabase.from("email_broadcasts").update({
        clicks_count: (await supabase.from("email_sends").select("id", { count: "exact", head: true }).eq("broadcast_id", link.broadcast_id).not("clicked_at", "is", null)).count || 0,
      }).eq("id", link.broadcast_id);
      return new Response(null, { status: 302, headers: { Location: link.url } });
    }

    if (kind === "u") {
      const sendId = idPart;
      const { data: send } = await supabase.from("email_sends").select("contact_id,brand_id,broadcast_id").eq("id", sendId).maybeSingle();
      if (send) {
        const { data: contact } = await supabase.from("marketing_contacts").select("email").eq("id", send.contact_id).maybeSingle();
        await supabase.from("marketing_contacts").update({ status: "unsubscribed" }).eq("id", send.contact_id);
        if (contact) {
          await supabase.from("marketing_suppression").upsert({
            brand_id: send.brand_id, email: contact.email, reason: "user_unsubscribed",
          }, { onConflict: "brand_id,email" });
        }
        await supabase.from("email_sends").update({ unsubscribed_at: new Date().toISOString() }).eq("id", sendId);
        await supabase.from("email_broadcasts").update({
          unsubs_count: (await supabase.from("email_sends").select("id", { count: "exact", head: true }).eq("broadcast_id", send.broadcast_id).not("unsubscribed_at", "is", null)).count || 0,
        }).eq("id", send.broadcast_id);
      }
      const html = `<!doctype html><html><body style="font-family:system-ui;padding:48px;max-width:480px;margin:auto;text-align:center"><h2>You're unsubscribed</h2><p>You won't receive marketing emails from us any more.</p></body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("not found", { status: 404 });
  } catch (err) {
    console.error("track", err);
    return new Response("error", { status: 500 });
  }
});
