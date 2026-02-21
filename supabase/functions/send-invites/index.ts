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
    `From: EventFlow <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
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
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#06060e;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2d9cc;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;background:linear-gradient(135deg,#c9a84c,#a8872e);border-radius:7px;display:inline-block;line-height:28px;text-align:center;color:#080810;font-size:14px;">✦</div>
        <span style="font-size:15px;color:#5a5a72;letter-spacing:0.05em;">EventFlow</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background:#0a0a14;border:1px solid #1e1e2e;border-radius:18px;padding:40px 36px;text-align:center;">
      <div style="font-size:36px;margin-bottom:16px;">🎉</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:600;color:#f0e8db;margin:0 0 10px;">
        You're invited${guestName ? `, ${guestName.split(" ")[0]}` : ""}
      </h1>
      <p style="font-size:15px;color:#5a5a72;margin:0 0 6px;">to</p>
      <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#c9a84c;margin:0 0 8px;">${eventName}</h2>
      ${eventDate ? `<p style="font-size:14px;color:#5a5a72;margin:0 0 32px;">${eventDate}</p>` : `<div style="margin-bottom:32px;"></div>`}

      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${rsvpUrl}" style="height:50px;v-text-anchor:middle;width:200px;" arcsize="20%" fillcolor="#c9a84c">
        <w:anchorlock/>
        <center style="color:#080810;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">RSVP Now</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${rsvpUrl}"
        style="display:inline-block;background-color:#c9a84c;color:#080810;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;mso-hide:all;">
        RSVP Now &rarr;
      </a>
      <!--<![endif]-->

      <p style="font-size:12px;color:#3a3a52;margin:28px 0 0;line-height:1.7;">
        Or copy this link into your browser:<br>
        <span style="color:#5a5a72;word-break:break-all;">${rsvpUrl}</span>
      </p>
    </div>

    <p style="text-align:center;font-size:11px;color:#2e2e42;margin-top:28px;">
      Powered by EventFlow · You received this because you were added to the guest list.
    </p>
  </div>
</body>
</html>`;
}

// ── Main handler ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
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

        await sendGmail(guest.email, `You're invited to ${event.name} 🎉`, html, accessToken);

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
