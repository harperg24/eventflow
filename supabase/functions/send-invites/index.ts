// ============================================================
//  supabase/functions/send-invites/index.ts
//  Sends invites via Gmail API directly — no Supabase SMTP,
//  no rate limits beyond Gmail's own (500/day free).
//  Deploy: supabase functions deploy send-invites --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL           = Deno.env.get("APP_URL") || "http://localhost:5173";
const GMAIL_CLIENT_ID   = Deno.env.get("GMAIL_CLIENT_ID")!;
const GMAIL_SECRET      = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const GMAIL_REFRESH     = Deno.env.get("GMAIL_REFRESH_TOKEN")!;
const GMAIL_SENDER      = Deno.env.get("GMAIL_SENDER")!; // your@gmail.com

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Get a fresh Gmail access token ──────────────────────────
async function getGmailAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     GMAIL_CLIENT_ID,
      client_secret: GMAIL_SECRET,
      refresh_token: GMAIL_REFRESH,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get Gmail token: " + JSON.stringify(data));
  return data.access_token;
}

// ── Build a base64url-encoded RFC 2822 email ─────────────────
function buildEmail(to: string, subject: string, html: string, from: string): string {
  const msg = [
    `From: Oneonetix <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── Send via Gmail API ───────────────────────────────────────
async function sendGmail(to: string, subject: string, html: string, accessToken: string) {
  const raw = buildEmail(to, subject, html, GMAIL_SENDER);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Gmail send failed");
  }
}

// ── Email template ───────────────────────────────────────────
function inviteTemplate(guestName: string, eventName: string, eventDate: string, rsvpUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
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
            <tr><td align="center" style="padding-bottom:10px;">
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#ff4d00;">You're Invited</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:6px;">
              <h1 style="font-family:'Arial Black',Arial,sans-serif;font-size:30px;font-weight:900;color:#f5f0e8;margin:0;letter-spacing:0.02em;text-transform:uppercase;line-height:1.05;">${guestName ? guestName.split(" ")[0].toUpperCase() : "GUEST"}</h1>
            </td></tr>
            <tr><td align="center" style="padding-bottom:24px;">
              <p style="font-size:12px;color:#888888;margin:8px 0 12px;font-family:Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">You have been invited to</p>
              <div style="padding:16px 20px;background:#1c1c1c;border-radius:3px;border-left:3px solid #ff4d00;">
                <div style="font-family:'Arial Black',Arial,sans-serif;font-size:18px;font-weight:900;color:#f5f0e8;letter-spacing:0.03em;text-transform:uppercase;">${eventName}</div>
                ${eventDate ? `<div style="font-size:11px;color:#888888;margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;font-family:Arial,sans-serif;">${eventDate}</div>` : ""}
              </div>
            </td></tr>
            <tr><td align="center" style="padding-bottom:8px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${rsvpUrl}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="2%" fillcolor="#ff4d00"><w:anchorlock/><center style="color:#0a0a0a;font-family:Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;">RSVP Now</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <a href="${rsvpUrl}" style="display:inline-block;background:#ff4d00;color:#0a0a0a;font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:900;padding:13px 32px;border-radius:3px;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;mso-hide:all;">RSVP NOW &rarr;</a>
              <!--<![endif]-->
            </td></tr>
            <tr><td align="center">
              <p style="font-size:11px;color:#555555;margin:0;line-height:1.7;font-family:Arial,sans-serif;">
                Or copy this link:<br>
                <a href="${rsvpUrl}" style="color:#ff4d00;word-break:break-all;">${rsvpUrl}</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 0 48px;">
          <p style="font-size:11px;color:#444444;margin:0;font-family:Arial,sans-serif;line-height:1.8;letter-spacing:0.05em;text-transform:uppercase;">
            POWERED BY <span style="color:#ff4d00;font-weight:700;">ONEONETIX</span>&nbsp;&#183;&nbsp;You received this because you were added to the guest list.
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

  try {
  // Verify caller is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  }
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  }


    const { eventId, guestIds } = await req.json();
    if (!eventId) return new Response(JSON.stringify({ error: "eventId required" }), { status: 400, headers: cors });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch event
    const { data: event, error: evErr } = await supabase
      .from("events").select("*").eq("id", eventId).single();
    if (evErr || !event) return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: cors });

    // Fetch guests
    const { data: guests, error: gErr } = await supabase
      .from("guests").select("*").in("id", guestIds).not("email", "is", null);
    if (gErr) return new Response(JSON.stringify({ error: gErr.message }), { status: 500, headers: cors });
    if (!guests?.length) return new Response(JSON.stringify({ sent: 0, message: "No guests found." }), { status: 200, headers: cors });

    // Get Gmail token once for all sends
    const accessToken = await getGmailAccessToken();

    // Format event date nicely
    const eventDate = event.date
      ? new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";

    let sent = 0;
    const failed: string[] = [];

    for (const guest of guests) {
      try {
        const rsvpUrl = `${APP_URL}/e/${event.invite_slug}?guest=${guest.id}`;
        const html    = inviteTemplate(guest.name, event.name, eventDate, rsvpUrl);

        await sendGmail(guest.email, `You're invited to ${event.name}`, html, accessToken);

        await supabase.from("guests")
          .update({ invited_at: new Date().toISOString() })
          .eq("id", guest.id);

        sent++;
      } catch (e: any) {
        failed.push(`${guest.email}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: guests.length }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
});
