// ============================================================
//  supabase/functions/vendor-decision/index.ts
//  Sends approval or decline email to vendor
//  Deploy: supabase functions deploy vendor-decision --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
  const msg = [`From: Oneonetix <${from}>`, `To: ${to}`, `Subject: ${safeSubject}`,
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

function approvedEmailHtml(vendorName: string, eventName: string, eventDate: string, eventVenue: string, message: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#06060e;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2d9cc;">
  <div style="max-width:540px;margin:0 auto;padding:48px 24px;">
    <div style="text-align:center;margin-bottom:32px;"><span style="font-size:14px;color:#5a5a72;letter-spacing:0.05em;">✦ Oneonetix</span></div>
    <div style="background:#0a0a14;border:1px solid rgba(16,185,129,0.3);border-radius:18px;padding:36px;margin-bottom:20px;">
      <div style="font-size:32px;text-align:center;margin-bottom:16px;">✅</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#10b981;margin:0 0 6px;text-align:center;">You're confirmed!</h1>
      <p style="font-size:15px;color:#c9a84c;text-align:center;margin:0 0 24px;">${eventName}</p>
      <div style="background:#13131f;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
        ${eventDate ? `<div style="display:flex;gap:12px;margin-bottom:10px;"><span style="color:#5a5a72;font-size:13px;width:60px;flex-shrink:0;">Date</span><span style="font-size:13px;color:#e2d9cc;">${eventDate}</span></div>` : ""}
        ${eventVenue ? `<div style="display:flex;gap:12px;"><span style="color:#5a5a72;font-size:13px;width:60px;flex-shrink:0;">Venue</span><span style="font-size:13px;color:#e2d9cc;">${eventVenue}</span></div>` : ""}
      </div>
      ${message ? `<div style="background:#0d150e;border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:16px;font-size:14px;color:#8a8278;line-height:1.6;">${message}</div>` : ""}
      <p style="font-size:13px;color:#5a5a72;text-align:center;margin:0;">The organiser will be in touch with further details.</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#3a3a52;">Powered by Oneonetix</p>
  </div></body></html>`;
}

function declinedEmailHtml(vendorName: string, eventName: string, message: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#06060e;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2d9cc;">
  <div style="max-width:540px;margin:0 auto;padding:48px 24px;">
    <div style="text-align:center;margin-bottom:32px;"><span style="font-size:14px;color:#5a5a72;letter-spacing:0.05em;">✦ Oneonetix</span></div>
    <div style="background:#0a0a14;border:1px solid #1e1e2e;border-radius:18px;padding:36px;margin-bottom:20px;">
      <div style="font-size:32px;text-align:center;margin-bottom:16px;">📬</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#f0e8db;margin:0 0 6px;text-align:center;">Application Update</h1>
      <p style="font-size:15px;color:#c9a84c;text-align:center;margin:0 0 20px;">${eventName}</p>
      <p style="font-size:14px;color:#8a8278;line-height:1.7;margin:0 0 20px;">
        Thank you for your application. Unfortunately we're unable to proceed with your vendor application for this event.
      </p>
      ${message ? `<div style="background:#13131f;border-left:3px solid #3a3a52;border-radius:0 8px 8px 0;padding:14px 16px;font-size:14px;color:#8a8278;line-height:1.6;">${message}</div>` : ""}
    </div>
    <p style="text-align:center;font-size:12px;color:#3a3a52;">Powered by Oneonetix</p>
  </div></body></html>`;
}

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


    const { vendorId, decision, message } = await req.json();
    // decision: "confirmed" | "declined"

    const { data: vendor } = await supabase
      .from("vendors").select("*, events(name, date, venue_name)").eq("id", vendorId).single();

    if (!vendor?.email) return new Response(JSON.stringify({ error: "No email" }), { status: 400, headers: cors });

    const ev = vendor.events;
    const eventDate = ev?.date
      ? new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";

    const subject = decision === "confirmed"
      ? `Vendor Confirmed — ${ev?.name}`
      : `Application Update — ${ev?.name}`;

    const html = decision === "confirmed"
      ? approvedEmailHtml(vendor.name, ev?.name || "", eventDate, ev?.venue_name || "", message || "")
      : declinedEmailHtml(vendor.name, ev?.name || "", message || "");

    await sendGmail(vendor.email, subject, html);

    await supabase.from("vendors").update({
      status: decision,
      host_message: message || null,
      decision_sent_at: new Date().toISOString(),
    }).eq("id", vendorId);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
});
