// ============================================================
//  supabase/functions/send-notifications/index.ts
//  Sends scheduled and custom event notifications via Gmail.
//  Called by a pg_cron job every minute, or manually by the host.
//  Deploy: supabase functions deploy send-notifications --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL         = Deno.env.get("APP_URL") || "http://localhost:5173";
const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const GMAIL_SECRET    = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const GMAIL_REFRESH   = Deno.env.get("GMAIL_REFRESH_TOKEN")!;
const GMAIL_SENDER    = Deno.env.get("GMAIL_SENDER")!;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Gmail OAuth helpers ──────────────────────────────────────
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
  return d.access_token;
}

async function sendEmail(to: string, subject: string, html: string, token: string) {
  const msg = [
    `From: Oneonetix <${GMAIL_SENDER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "", html,
  ].join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
}

// ── Shared email layout ──────────────────────────────────────
function notificationTemplate(subject: string, emoji: string, message: string, ctaLabel: string|null, ctaUrl: string|null, eventName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding-bottom:28px;">
          <a href="https://oneonetix.app" style="text-decoration:none;">
            <span style="font-family:'Arial Black',Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0.06em;color:#f5f0e8;">ONE</span><span style="font-family:'Arial Black',Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0.06em;color:#ff4d00;">O</span><span style="font-family:'Arial Black',Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0.06em;color:#f5f0e8;">NETIX</span>
          </a>
        </td></tr>
        <tr><td style="background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
          <div style="height:3px;background:#ff4d00;"></div>
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 36px;">
            <tr><td align="center" style="padding-bottom:8px;">
              <span style="font-size:32px;">${emoji || "⚡"}</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:6px;">
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#ff4d00;">${eventName}</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:20px;">
              <h1 style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#f5f0e8;margin:0;letter-spacing:0.02em;text-transform:uppercase;line-height:1.1;">${subject}</h1>
            </td></tr>
            <tr><td style="padding-bottom:24px;">
              <div style="padding:16px 20px;background:#1c1c1c;border-radius:3px;border-left:3px solid #ff4d00;">
                <p style="font-size:14px;color:#cccccc;margin:0;line-height:1.7;font-family:Arial,sans-serif;">${message}</p>
              </div>
            </td></tr>
            ${ctaLabel && ctaUrl ? `<tr><td align="center" style="padding-bottom:8px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="2%" fillcolor="#ff4d00"><w:anchorlock/><center style="color:#0a0a0a;font-family:Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;">${ctaLabel}</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <a href="${ctaUrl}" style="display:inline-block;background:#ff4d00;color:#0a0a0a;font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:900;padding:13px 32px;border-radius:3px;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;mso-hide:all;">${ctaLabel} &rarr;</a>
              <!--<![endif]-->
            </td></tr>` : ""}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 0 48px;">
          <p style="font-size:11px;color:#444444;margin:0;font-family:Arial,sans-serif;line-height:1.8;letter-spacing:0.05em;text-transform:uppercase;">
            POWERED BY <span style="color:#ff4d00;font-weight:700;">ONEONETIX</span>&nbsp;&#183;&nbsp;You received this because you are on the guest list.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}): string {
  const { emoji, heading, body, eventName, eventDate, ctaLabel, ctaUrl, footerNote } = opts;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#111111;font-family:'Arial',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:var(--accent, #ff4d00);width:28px;height:28px;border-radius:8px;text-align:center;vertical-align:middle;font-size:14px;color:#ffffff;font-weight:700;">✦</td>
            <td style="padding-left:9px;font-size:15px;font-weight:600;color:#1d1d1f;font-family:'Arial',Arial,sans-serif;letter-spacing:-0.01em;">Oneonetix</td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border:1.5px solid #e5e5ea;border-radius:18px;overflow:hidden;">
          <div style="height:4px;background:var(--accent, #ff4d00);border-radius:4px 4px 0 0;"></div>
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 36px;">
            <tr><td align="center" style="padding-bottom:12px;font-size:36px;">${emoji}</td></tr>
            <tr><td align="center" style="padding-bottom:8px;">
              <h1 style="font-family:'Arial',Arial,sans-serif;font-size:24px;font-weight:800;color:#1d1d1f;margin:0;letter-spacing:-0.03em;">${heading}</h1>
            </td></tr>
            <tr><td align="center" style="padding-bottom:6px;">
              <div style="font-size:18px;font-weight:700;color:var(--accent, #ff4d00);letter-spacing:-0.02em;">${eventName}</div>
            </td></tr>
            ${eventDate ? `<tr><td align="center" style="padding-bottom:20px;"><div style="font-size:14px;color:#6e6e73;">${eventDate}</div></td></tr>` : "<tr><td style=\"padding-bottom:12px;\"></td></tr>"}
            <tr><td align="center" style="padding-bottom:24px;">
              <p style="font-size:15px;color:#1d1d1f;margin:0;line-height:1.7;text-align:center;max-width:380px;">${body}</p>
            </td></tr>
            ${ctaLabel && ctaUrl ? `
            <tr><td align="center" style="padding:4px 0 20px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="20%" fillcolor="var(--accent, #ff4d00)"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">${ctaLabel}</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <a href="${ctaUrl}" style="display:inline-block;background:var(--accent, #ff4d00);color:#ffffff;font-family:'Arial',Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.01em;mso-hide:all;">${ctaLabel} &rarr;</a>
              <!--<![endif]-->
            </td></tr>` : ""}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <p style="font-size:11px;color:#8e8e93;margin:0;font-family:'Arial',Arial,sans-serif;line-height:1.6;">
            Powered by <span style="color:var(--accent, #ff4d00);font-weight:600;">Oneonetix</span>&nbsp;&middot;&nbsp;${footerNote || "You received this because you are on the guest list for this event."}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    // Can be called with { notificationId } to send a specific one,
    // or with no body to process all due notifications (cron mode).
    const specificId = body?.notificationId;

    // ── Fetch due notifications ────────────────────────────────
    let query = supabase
      .from("event_notifications")
      .select("*, events(name, date, time, invite_slug)")
      .eq("sent", false)
      .lte("send_at", new Date().toISOString());

    if (specificId) query = query.eq("id", specificId);

    const { data: notifications, error: nErr } = await query;
    if (nErr) throw nErr;
    if (!notifications?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No notifications due" }), { headers: cors });
    }

    const token = await getAccessToken();
    let sent = 0, failed = 0;

    for (const notif of notifications) {
      const event = notif.events;
      if (!event) continue;

      // Determine recipients
      let recipients: { email: string; name?: string }[] = [];

      if (notif.recipient_type === "all_guests") {
        const { data: guests } = await supabase
          .from("guests")
          .select("email, name")
          .eq("event_id", notif.event_id)
          .not("email", "is", null);
        recipients = (guests || []).filter(g => g.email);
      } else if (notif.recipient_type === "attending_guests") {
        const { data: guests } = await supabase
          .from("guests")
          .select("email, name")
          .eq("event_id", notif.event_id)
          .eq("status", "attending")
          .not("email", "is", null);
        recipients = (guests || []).filter(g => g.email);
      } else if (notif.recipient_type === "ticketholders") {
        const { data: orders } = await supabase
          .from("ticket_orders")
          .select("buyer_email, buyer_name")
          .eq("event_id", notif.event_id)
          .eq("status", "paid");
        recipients = (orders || []).map(o => ({ email: o.buyer_email, name: o.buyer_name })).filter(r => r.email);
      } else if (notif.recipient_type === "all") {
        // guests + ticketholders deduplicated
        const { data: guests } = await supabase.from("guests").select("email, name").eq("event_id", notif.event_id).not("email", "is", null);
        const { data: orders } = await supabase.from("ticket_orders").select("buyer_email, buyer_name").eq("event_id", notif.event_id).eq("status", "paid");
        const seen = new Set<string>();
        for (const g of guests || []) if (g.email && !seen.has(g.email)) { seen.add(g.email); recipients.push({ email: g.email, name: g.name }); }
        for (const o of orders || []) if (o.buyer_email && !seen.has(o.buyer_email)) { seen.add(o.buyer_email); recipients.push({ email: o.buyer_email, name: o.buyer_name }); }
      }

      if (!recipients.length) {
        await supabase.from("event_notifications").update({ sent: true, sent_at: new Date().toISOString(), sent_count: 0 }).eq("id", notif.id);
        continue;
      }

      // Build email
      const eventDate = event.date
        ? new Date(event.date).toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
        : undefined;

      let subject: string;
      let html: string;

      if (notif.notification_type === "event_reminder") {
        const hoursUntil = notif.hours_before;
        const timeStr = hoursUntil >= 24
          ? `${Math.round(hoursUntil / 24)} day${Math.round(hoursUntil / 24) !== 1 ? "s" : ""}`
          : `${hoursUntil} hour${hoursUntil !== 1 ? "s" : ""}`;
        subject = `Reminder: ${event.name} is in ${timeStr}`;
        const rsvpUrl = `${APP_URL}/e/${event.invite_slug}`;
        html = notificationTemplate({
          emoji: "⏰",
          heading: `${event.name} is coming up!`,
          body: `Just a reminder — the event is happening in <strong>${timeStr}</strong>. We can't wait to see you there!`,
          eventName: event.name,
          eventDate,
          ctaLabel: "View Event Details",
          ctaUrl: rsvpUrl,
        });
      } else {
        // Custom notification
        subject = notif.subject || `Message from ${event.name}`;
        html = notificationTemplate({
          emoji: notif.emoji || "📣",
          heading: notif.subject || "A message from your organiser",
          body: notif.message || "",
          eventName: event.name,
          eventDate,
          ctaLabel: notif.cta_label || undefined,
          ctaUrl: notif.cta_url || undefined,
        });
      }

      // Send to all recipients
      let thisSent = 0;
      for (const r of recipients) {
        try {
          // Personalise if we have a name
          const personalHtml = r.name
            ? html.replace("{{name}}", r.name.split(" ")[0])
            : html.replace("{{name}}", "");
          await sendEmail(r.email, subject, personalHtml, token);
          thisSent++;
        } catch (_) { failed++; }
      }

      // Mark sent
      await supabase.from("event_notifications").update({
        sent: true,
        sent_at: new Date().toISOString(),
        sent_count: thisSent,
      }).eq("id", notif.id);
      sent += thisSent;
    }

    return new Response(JSON.stringify({ sent, failed, notifications: notifications.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
