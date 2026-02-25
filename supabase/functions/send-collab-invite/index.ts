// supabase/functions/send-collab-invite/index.ts
// Deploy: supabase functions deploy send-collab-invite --no-verify-jwt
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL  = Deno.env.get("APP_URL") || "https://oneonetix.app";
const cors     = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function getGmailToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: Deno.env.get("GMAIL_CLIENT_ID")!, client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!, refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!, grant_type: "refresh_token" }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error("Gmail token failed");
  return d.access_token;
}

function buildEmail(to: string, subject: string, html: string): string {
  const from = Deno.env.get("GMAIL_SENDER")!;
  const safe = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const msg  = [`From: Oneonetix <${from}>`, `To: ${to}`, `Subject: ${safe}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
  return btoa(unescape(encodeURIComponent(msg))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full access except transferring ownership",
  ticketing: "Ticketing — manage tickets, tiers and sales",
  check_in: "Check-in — scan tickets and manage guest check-in",
  view_only: "View Only — read-only access to all sections",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { collabId } = await req.json();
    const { data: collab } = await supabase
      .from("event_collaborators").select("*, events(name,date)").eq("id", collabId).single();
    if (!collab) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });

    const acceptUrl = `${APP_URL}/collab/accept/${collab.invite_token}`;
    const eventDate = collab.events?.date
      ? new Date(collab.events.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";

    const html = `<!DOCTYPE html>
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
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#ff4d00;">Collaboration Invite</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:20px;">
              <h1 style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#f5f0e8;margin:0;letter-spacing:0.02em;text-transform:uppercase;line-height:1.1;">YOU'VE BEEN<br>INVITED</h1>
            </td></tr>
            <tr><td style="padding-bottom:20px;">
              <div style="padding:16px 20px;background:#1c1c1c;border-radius:3px;border-left:3px solid #ff4d00;">
                <div style="font-size:10px;color:#888888;letter-spacing:0.16em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:6px;">Event</div>
                <div style="font-family:'Arial Black',Arial,sans-serif;font-size:16px;font-weight:900;color:#f5f0e8;text-transform:uppercase;letter-spacing:0.02em;">${collab.events?.name}</div>
                ${eventDate ? `<div style="font-size:11px;color:#888888;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">${eventDate}</div>` : ""}
              </div>
            </td></tr>
            <tr><td style="padding-bottom:24px;">
              <div style="padding:14px 18px;background:#1a1a1a;border-radius:3px;border:1px solid rgba(255,255,255,0.07);">
                <div style="font-size:10px;color:#888888;letter-spacing:0.16em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:5px;">Your Role</div>
                <div style="font-family:'Arial Black',Arial,sans-serif;font-size:14px;font-weight:900;color:#ff4d00;text-transform:uppercase;letter-spacing:0.04em;">${collab.role.charAt(0).toUpperCase() + collab.role.slice(1).replace("_"," ")}</div>
                <div style="font-size:12px;color:#666666;margin-top:3px;font-family:Arial,sans-serif;">${ROLE_LABELS[collab.role] || ""}</div>
              </div>
            </td></tr>
            <tr><td align="center" style="padding-bottom:8px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${acceptUrl}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="2%" fillcolor="#ff4d00"><w:anchorlock/><center style="color:#0a0a0a;font-family:Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;">Accept Invitation</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <a href="${acceptUrl}" style="display:inline-block;background:#ff4d00;color:#0a0a0a;font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:900;padding:13px 32px;border-radius:3px;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;mso-hide:all;">ACCEPT INVITATION &rarr;</a>
              <!--<![endif]-->
            </td></tr>
            <tr><td align="center">
              <p style="font-size:11px;color:#555555;margin:0;line-height:1.7;font-family:Arial,sans-serif;">
                Or copy this link:<br>
                <a href="${acceptUrl}" style="color:#ff4d00;word-break:break-all;">${acceptUrl}</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 0 48px;">
          <p style="font-size:11px;color:#444444;margin:0;font-family:Arial,sans-serif;line-height:1.8;letter-spacing:0.05em;text-transform:uppercase;">
            POWERED BY <span style="color:#ff4d00;font-weight:700;">ONEONETIX</span>&nbsp;&#183;&nbsp;You can decline from within the app after signing in.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const token = await getGmailToken();
    await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: buildEmail(collab.email, `Collaboration invite — ${collab.events?.name}`, html) }),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
