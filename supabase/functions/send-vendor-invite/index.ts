// ============================================================
//  supabase/functions/send-vendor-invite/index.ts
//  Sends vendor form invite email
//  Deploy: supabase functions deploy send-vendor-invite --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL  = Deno.env.get("APP_URL") || "https://eventflow-isdd.vercel.app";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGmailToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Gmail token failed");
  return data.access_token;
}

function buildEmail(to: string, subject: string, html: string, from: string): string {
  const safeSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const msg = [`From: EventFlow <${from}>`, `To: ${to}`, `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
  return btoa(unescape(encodeURIComponent(msg))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendGmail(to: string, subject: string, html: string) {
  const token = await getGmailToken();
  const from  = Deno.env.get("GMAIL_SENDER")!;
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildEmail(to, subject, html, from) }),
  });
  if (!res.ok) throw new Error((await res.json()).error?.message || "Gmail send failed");
}

function inviteEmailHtml(vendorName: string, eventName: string, eventDate: string, formUrl: string, hostNote: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#5b5bd6;width:28px;height:28px;border-radius:8px;text-align:center;vertical-align:middle;font-size:14px;color:#ffffff;font-weight:700;">✦</td>
              <td style="padding-left:9px;font-size:15px;font-weight:600;color:#1d1d1f;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:-0.01em;">EventFlow</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border:1.5px solid #e5e5ea;border-radius:18px;overflow:hidden;">
          <div style="height:4px;background:#5b5bd6;border-radius:4px 4px 0 0;"></div>
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 36px;">
            <tr><td align="center" style="padding-bottom:16px;font-size:36px;">📋</td></tr>
            <tr><td align="center" style="padding-bottom:20px;">
              <h1 style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:800;color:#1d1d1f;margin:0 0 8px;letter-spacing:-0.03em;">Vendor Application</h1>
              <div style="font-size:16px;font-weight:700;color:#5b5bd6;letter-spacing:-0.01em;">${eventName}${eventDate ? ` · ${eventDate}` : ""}</div>
            </td></tr>
            ${hostNote ? `<tr><td style="padding:0 0 20px;"><div style="background:#f0f0ff;border:1.5px solid #c7c7f0;border-radius:12px;padding:14px 16px;font-size:14px;color:#6e6e73;line-height:1.6;">${hostNote}</div></td></tr>` : ""}
            <tr><td style="padding:0 0 24px;">
              <p style="font-size:14px;color:#6e6e73;line-height:1.7;margin:0;">
                Hi${vendorName ? ` ${vendorName}` : ""}! You've been invited to apply as a vendor. Click below to complete your application.
              </p>
            </td></tr>
            <tr><td align="center" style="padding:8px 0 20px;">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${formUrl}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="20%" fillcolor="#5b5bd6"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">Complete Application</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <a href="${formUrl}" style="display:inline-block;background:#5b5bd6;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:0.01em;mso-hide:all;">Complete Application &rarr;</a>
              <!--<![endif]-->
            </td></tr>
            <tr><td align="center" style="padding-top:4px;">
              <p style="font-size:12px;color:#8e8e93;margin:0;line-height:1.6;font-family:'Helvetica Neue',Arial,sans-serif;">
                Or copy this link:<br>
                <a href="${formUrl}" style="color:#5b5bd6;word-break:break-all;">${formUrl}</a>
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:24px;">
          <p style="font-size:11px;color:#8e8e93;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.6;">
            Powered by <span style="color:#5b5bd6;font-weight:600;">EventFlow</span>&nbsp;&middot;&nbsp;You received this vendor invitation from an EventFlow event organiser.
          </p>
        </td>
      </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { vendorId } = await req.json();
    if (!vendorId) return new Response(JSON.stringify({ error: "vendorId required" }), { status: 400, headers: cors });

    const { data: vendor } = await supabase
      .from("vendors").select("*, events(name, date)").eq("id", vendorId).single();

    if (!vendor) return new Response(JSON.stringify({ error: "Vendor not found" }), { status: 404, headers: cors });
    if (!vendor.email) return new Response(JSON.stringify({ error: "No email on vendor" }), { status: 400, headers: cors });

    const formUrl  = `${APP_URL}/vendor/${vendor.vendor_token}`;
    const eventDate = vendor.events?.date
      ? new Date(vendor.events.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";

    await sendGmail(
      vendor.email,
      `Vendor Application — ${vendor.events?.name}`,
      inviteEmailHtml(vendor.name || "there", vendor.events?.name || "the event", eventDate, formUrl, vendor.host_message || ""),
    );

    // Mark as invited
    await supabase.from("vendors").update({ invited_at: new Date().toISOString(), status: "invited" }).eq("id", vendorId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
});
