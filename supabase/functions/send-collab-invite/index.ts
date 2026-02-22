// supabase/functions/send-collab-invite/index.ts
// Deploy: supabase functions deploy send-collab-invite --no-verify-jwt
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL  = Deno.env.get("APP_URL") || "https://eventflow-isdd.vercel.app";
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
  const msg  = [`From: EventFlow <${from}>`, `To: ${to}`, `Subject: ${safe}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
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

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#06060e;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2d9cc;">
    <div style="max-width:540px;margin:0 auto;padding:48px 24px;">
      <div style="text-align:center;margin-bottom:32px;"><span style="font-size:14px;color:#5a5a72;">✦ EventFlow</span></div>
      <div style="background:#0a0a14;border:1px solid #1e1e2e;border-radius:18px;padding:36px;margin-bottom:20px;">
        <div style="font-size:32px;text-align:center;margin-bottom:16px;">🤝</div>
        <h1 style="font-family:Georgia,serif;font-size:22px;color:#f0e8db;margin:0 0 6px;text-align:center;">You've been invited to collaborate</h1>
        <p style="font-size:15px;color:#c9a84c;text-align:center;margin:0 0 20px;">${collab.events?.name}${eventDate ? ` · ${eventDate}` : ""}</p>
        <div style="background:#13131f;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
          <div style="font-size:11px;color:#5a5a72;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Your role</div>
          <div style="font-size:14px;color:#c9a84c;font-weight:600;margin-bottom:2px;">${collab.role.charAt(0).toUpperCase() + collab.role.slice(1)}</div>
          <div style="font-size:12px;color:#5a5a72;">${ROLE_LABELS[collab.role] || ""}</div>
        </div>
        <div style="text-align:center;">
          <a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#a8872e);color:#080810;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;">Accept Invitation &rarr;</a>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:#3a3a52;">You can decline from within the app after signing in · Powered by EventFlow</p>
    </div></body></html>`;

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
