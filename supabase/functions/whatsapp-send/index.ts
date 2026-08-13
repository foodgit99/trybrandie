// whatsapp-send — delivers a finished Brandie post to the user's WhatsApp DM.
//
// Called fire-and-forget by autopilot-notify (and by Settings "send test").
// Routes through the Lovable connector gateway to Twilio; no provider
// credentials ever live in app code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://trybrandie.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalise a saved number to E.164 (digits with a leading +). */
function toE164(raw: string, defaultCc = "234"): string | null {
  const cleaned = String(raw || "").trim();
  const hadPlus = cleaned.startsWith("+");
  let digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;
  if (!hadPlus) {
    // Local formats like 08138037420 / 8138037420 → prefix the country code.
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = defaultCc + digits.slice(1);
    else if (digits.length <= 10) digits = defaultCc + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));

    // ── Resolve the caller ────────────────────────────────
    // Service-role callers (autopilot) pass user_id explicitly.
    // Browser callers are resolved from their JWT and can never target
    // another user's number.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;

    if (token && token !== serviceRoleKey) {
      const { data: authData } = await supabase.auth.getUser(token);
      userId = authData?.user?.id ?? null;
      if (!userId) return json({ error: "unauthorized" }, 401);
    } else {
      userId = typeof body?.user_id === "string" ? body.user_id : null;
    }
    if (!userId) return json({ error: "missing user_id" }, 400);

    const title = String(body?.title || "Your post is ready").slice(0, 200);
    const caption = String(body?.body || "").slice(0, 1500);
    const imageUrl = typeof body?.image_url === "string" ? body.image_url : null;
    const linkPath = typeof body?.url === "string" ? body.url : null;
    const ideaId = typeof body?.idea_id === "string" ? body.idea_id : null;
    const isTest = body?.test === true;

    // ── Preferences ───────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_number, whatsapp_delivery_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    const enabled = (profile as any)?.whatsapp_delivery_enabled === true;
    if (!enabled && !isTest) return json({ ok: true, skipped: "delivery_disabled" });

    const to = toE164((profile as any)?.whatsapp_number || "");
    if (!to) return json({ error: "no_valid_whatsapp_number" }, 400);

    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    if (!from) return json({ error: "TWILIO_WHATSAPP_FROM is not configured" }, 500);
    if (!lovableKey || !twilioKey) return json({ error: "Twilio connection is not configured" }, 500);

    // ── Idempotency (one WhatsApp message per idea) ────────
    if (ideaId) {
      const { data: existing } = await supabase
        .from("whatsapp_deliveries")
        .select("id, status")
        .eq("idea_id", ideaId)
        .maybeSingle();
      if (existing && (existing as any).status === "sent") {
        return json({ ok: true, skipped: "already_sent" });
      }
    }

    const link = linkPath
      ? (linkPath.startsWith("http") ? linkPath : `${APP_BASE_URL}${linkPath}`)
      : null;

    const templateSid = Deno.env.get("TWILIO_WHATSAPP_TEMPLATE_SID");

    const buildForm = (withMedia: boolean) => {
      const body = [
        title,
        caption,
        !withMedia && imageUrl ? `Design: ${imageUrl}` : null,
        link ? `Open in Brandie: ${link}` : null,
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 1550);

      const f = new URLSearchParams({
        To: `whatsapp:${to}`,
        From: `whatsapp:${toE164(from) || from}`,
      });
      // Business-initiated messages outside the 24h window need an approved
      // template. When one is configured we send it; Twilio falls back to the
      // free-form body inside an open conversation window.
      if (templateSid) {
        f.set("ContentSid", templateSid);
        f.set("ContentVariables", JSON.stringify({ "1": title, "2": link || APP_BASE_URL }));
      } else {
        f.set("Body", body);
      }
      if (withMedia && imageUrl) f.set("MediaUrl", imageUrl);
      return f;
    };

    const send = (withMedia: boolean) =>
      fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": twilioKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: buildForm(withMedia),
      });

    let resp = await send(!!imageUrl);
    let text = await resp.text();

    // Trial Twilio accounts reject media params outright — retry text-only
    // with the image as a link so delivery still succeeds.
    if (!resp.ok && imageUrl && /disallowed parameters|trial account/i.test(text)) {
      console.warn("[whatsapp-send] media rejected by provider, retrying text-only");
      resp = await send(false);
      text = await resp.text();
    }

    let payload: any = null;
    try { payload = JSON.parse(text); } catch { /* keep raw text */ }


    if (!resp.ok) {
      console.error(`[whatsapp-send] gateway failed [${resp.status}]: ${text}`);
      if (!isTest) {
        await supabase.from("whatsapp_deliveries").upsert(
          {
            user_id: userId,
            idea_id: ideaId,
            to_number: to,
            status: "failed",
            error_text: `[${resp.status}] ${text}`.slice(0, 2000),
          } as any,
          ideaId ? { onConflict: "idea_id" } : undefined,
        );
      }
      const code = payload?.code;
      const hint =
        code === 572002 || code === 63007 || code === 21211
          ? `WhatsApp couldn't reach ${to}. On a trial WhatsApp sender the number must first opt in to the sandbox (send the join code from that phone), and it must be saved in full international format.`
          : code === 63016
            ? "WhatsApp needs an approved message template to start a conversation. Add a template SID to enable business-initiated messages."
            : payload?.message || "WhatsApp delivery failed.";
      return json(
        { error: "whatsapp_send_failed", status: resp.status, hint, to, details: payload ?? text },
        resp.status,
      );

    }

    const sid = payload?.sid ?? null;
    if (!isTest) {
      await supabase.from("whatsapp_deliveries").upsert(
        {
          user_id: userId,
          idea_id: ideaId,
          to_number: to,
          message_sid: sid,
          status: "sent",
          error_text: null,
        } as any,
        ideaId ? { onConflict: "idea_id" } : undefined,
      );
    }

    console.log(`[whatsapp-send] sent to ${to.slice(0, 5)}*** sid=${sid}`);
    return json({ ok: true, sid, status: payload?.status ?? "queued" });
  } catch (e) {
    console.error("[whatsapp-send] error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
