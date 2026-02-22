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
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#06060e;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2d9cc;">
  <div style="max-width:540px;margin:0 auto;padding:48px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:14px;color:#5a5a72;letter-spacing:0.05em;">✦ EventFlow</span>
    </div>
    <div style="background:#0a0a14;border:1px solid #1e1e2e;border-radius:18px;padding:36px;margin-bottom:20px;">
      <div style="font-size:32px;text-align:center;margin-bottom:20px;">📋</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#f0e8db;margin:0 0 8px;text-align:center;">Vendor Application</h1>
      <p style="font-size:15px;color:#c9a84c;text-align:center;margin:0 0 20px;">${eventName}${eventDate ? ` · ${eventDate}` : ""}</p>
      ${hostNote ? `<div style="background:#13131f;border-left:3px solid #c9a84c;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#8a8278;line-height:1.6;">${hostNote}</div>` : ""}
      <p style="font-size:14px;color:#8a8278;line-height:1.7;margin:0 0 24px;">
        You've been invited to apply as a vendor for this event. Please complete the form below with your business details — the organiser will review your application and get back to you.
      </p>
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${formUrl}" style="height:50px;v-text-anchor:middle;width:300px;" arcsize="20%" fillcolor="#c9a84c"><w:anchorlock/><center style="color:#080810;font-family:sans-serif;font-size:15px;font-weight:bold;">Complete Application</center></v:roundrect><![endif]-->
      <div style="text-align:center;">
        <a href="${formUrl}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#a8872e);color:#080810;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;">Complete Application &rarr;</a>
      </div>
    </div>
    <p style="text-align:center;font-size:12px;color:#3a3a52;line-height:1.7;">
      This link is unique to you · Powered by EventFlow
    </p>
  </div></body></html>`;
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
