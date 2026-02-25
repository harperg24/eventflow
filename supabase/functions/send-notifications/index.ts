// ============================================================
//  supabase/functions/send-notifications/index.ts
//  Sends scheduled and custom event notifications via Gmail.
//  Called by a pg_cron job every minute (with CRON_SECRET),
//  or manually by the host (with user Bearer token).
//  Deploy: supabase functions deploy send-notifications --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON   = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET     = Deno.env.get("CRON_SECRET") || "";
const APP_URL         = Deno.env.get("APP_URL") || "https://oneonetix.app";
const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const GMAIL_SECRET    = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const GMAIL_REFRESH   = Deno.env.get("GMAIL_REFRESH_TOKEN")!;
const GMAIL_SENDER    = Deno.env.get("GMAIL_SENDER")!;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function verifyRequest(req: Request): Promise<boolean> {
  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader === CRON_SECRET) return true;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const { data: { user }, error } = await createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  }).auth.getUser();
  return !error && !!user;
}

async function getAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID, client_secret: GMAIL_SECRET,
      refresh_token: GMAIL_REFRESH, grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("Gmail token refresh failed");
  return d.access_token;
}

async function sendEmail(to: string, subject: string, html: string, token: string) {
  const safeSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const msg = [
    `From: Oneonetix <${GMAIL_SENDER}>`, `To: ${to}`, `Subject: ${safeSubject}`,
    "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "", html,
  ].join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status}`);
}

function notificationTemplate(opts: {
  emoji: string; heading: string; body: string; eventName: string;
  eventDate?: string; ctaLabel?: string; ctaUrl?: string;
}): string {
  const { emoji, heading, body, eventName, eventDate, ctaLabel, ctaUrl } = opts;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:40px 16px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td align="center" style="padding-bottom:28px;">
      <a href="${APP_URL}" style="text-decoration:none;">
        <span style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;color:#f5f0e8;">ONE</span><span style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;color:#ff4d00;">O</span><span style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;color:#f5f0e8;">NETIX</span>
      </a>
    </td></tr>
    <tr><td style="background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
      <div style="height:3px;background:#ff4d00;"></div>
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 36px;">
        <tr><td align="center" style="padding-bottom:8px;"><span style="font-size:32px;">${emoji || "\u26a1"}</span></td></tr>
        <tr><td align="center" style="padding-bottom:6px;"><span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#ff4d00;">${eventName}</span></td></tr>
        <tr><td align="center" style="padding-bottom:${eventDate ? "6px" : "20px"};"><h1 style="font-family:Arial Black,Arial,sans-serif;font-size:24px;font-weight:900;color:#f5f0e8;margin:0;text-transform:uppercase;">${heading}</h1></td></tr>
        ${eventDate ? `<tr><td align="center" style="padding-bottom:20px;"><div style="font-size:12px;color:#888888;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">${eventDate}</div></td></tr>` : ""}
        <tr><td style="padding-bottom:24px;"><div style="padding:16px 20px;background:#1c1c1c;border-radius:3px;border-left:3px solid #ff4d00;"><p style="font-size:14px;color:#cccccc;margin:0;line-height:1.7;font-family:Arial,sans-serif;">${body}</p></div></td></tr>
        ${ctaLabel && ctaUrl ? `<tr><td align="center" style="padding-bottom:8px;"><a href="${ctaUrl}" style="display:inline-block;background:#ff4d00;color:#0a0a0a;font-family:Arial Black,Arial,sans-serif;font-size:12px;font-weight:900;padding:13px 32px;border-radius:3px;text-decoration:none;text-transform:uppercase;">${ctaLabel} &rarr;</a></td></tr>` : ""}
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 0 48px;"><p style="font-size:11px;color:#444444;margin:0;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.05em;">POWERED BY <span style="color:#ff4d00;font-weight:700;">ONEONETIX</span></p></td></tr>
  </table></td></tr></table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authorized = await verifyRequest(req);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const reqBody = await req.json().catch(() => ({}));
    const specificId = reqBody?.notificationId;

    let query = supabase
      .from("event_notifications")
      .select("*, events(name, date, time, invite_slug)")
      .eq("sent", false)
      .lte("send_at", new Date().toISOString());
    if (specificId) query = query.eq("id", specificId);

    const { data: notifications, error: nErr } = await query;
    if (nErr) throw nErr;
    if (!notifications?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No notifications due" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const gmailToken = await getAccessToken();
    let sent = 0, failed = 0;

    for (const notif of notifications) {
      const event = notif.events;
      if (!event) continue;

      let recipients: { email: string; name?: string }[] = [];

      if (["all_guests", "all"].includes(notif.recipient_type)) {
        const { data: g } = await supabase.from("guests").select("email, name")
          .eq("event_id", notif.event_id).not("email", "is", null);
        recipients.push(...(g || []).filter(x => x.email).map(x => ({ email: x.email, name: x.name })));
      }
      if (notif.recipient_type === "attending_guests") {
        const { data: g } = await supabase.from("guests").select("email, name")
          .eq("event_id", notif.event_id).eq("status", "attending").not("email", "is", null);
        recipients.push(...(g || []).filter(x => x.email).map(x => ({ email: x.email, name: x.name })));
      }
      if (["ticketholders", "all"].includes(notif.recipient_type)) {
        const { data: o } = await supabase.from("ticket_orders").select("buyer_email, buyer_name")
          .eq("event_id", notif.event_id).eq("status", "paid");
        recipients.push(...(o || []).filter(x => x.buyer_email).map(x => ({ email: x.buyer_email, name: x.buyer_name })));
      }

      const seen = new Set<string>();
      recipients = recipients.filter(r => r.email && !seen.has(r.email) && seen.add(r.email));

      if (!recipients.length) {
        await supabase.from("event_notifications")
          .update({ sent: true, sent_at: new Date().toISOString(), sent_count: 0 }).eq("id", notif.id);
        continue;
      }

      const eventDate = event.date
        ? new Date(event.date).toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
        : undefined;

      let subject: string;
      let html: string;

      if (notif.notification_type === "event_reminder") {
        const h = notif.hours_before || 24;
        const timeStr = h >= 24 ? `${Math.round(h/24)} day${Math.round(h/24)!==1?"s":""}` : `${h} hour${h!==1?"s":""}`;
        subject = `Reminder: ${event.name} is in ${timeStr}`;
        html = notificationTemplate({
          emoji: "\u23f0", heading: `${event.name} is coming up!`,
          body: `Just a reminder — the event is happening in <strong>${timeStr}</strong>. We can't wait to see you there!`,
          eventName: event.name, eventDate,
          ctaLabel: "View Event Details", ctaUrl: `${APP_URL}/e/${event.invite_slug}`,
        });
      } else {
        subject = notif.subject || `Message from ${event.name}`;
        html = notificationTemplate({
          emoji: notif.emoji || "\ud83d\udce3",
          heading: notif.subject || "A message from your organiser",
          body: notif.message || "",
          eventName: event.name, eventDate,
          ctaLabel: notif.cta_label || undefined,
          ctaUrl: notif.cta_url || undefined,
        });
      }

      let thisSent = 0;
      for (const r of recipients) {
        try {
          const personalHtml = html.replace("{{name}}", r.name ? r.name.split(" ")[0] : "there");
          await sendEmail(r.email, subject, personalHtml, gmailToken);
          thisSent++;
        } catch (e) { console.error(`Failed to send to ${r.email}:`, e); failed++; }
      }

      await supabase.from("event_notifications")
        .update({ sent: true, sent_at: new Date().toISOString(), sent_count: thisSent })
        .eq("id", notif.id);
      sent += thisSent;
    }

    return new Response(JSON.stringify({ sent, failed, total: notifications.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
