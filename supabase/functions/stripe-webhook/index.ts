// ============================================================
//  supabase/functions/stripe-webhook/index.ts
//  Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const STRIPE_SECRET   = Deno.env.get("STRIPE_SECRET_KEY")!;
const WEBHOOK_SECRET  = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL         = Deno.env.get("APP_URL") || "https://oneonetix.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Stripe webhook signature verification (Deno built-in crypto) ─
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
    const timestamp = parts["t"];
    const signature = parts["v1"];
    const signed = `${timestamp}.${payload}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signed));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    return expected === signature;
  } catch {
    return false;
  }
}

// ── Gmail helpers ─────────────────────────────────────────────
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
  // Encode subject as RFC2047 quoted-printable to handle any special chars safely
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
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Gmail send failed");
  }
}

// ── Ticket email ──────────────────────────────────────────────
function ticketEmail(buyerName: string, eventName: string, eventDate: string, tickets: { number: string | number; tier: string; qrToken: string }[]): string {
  const firstName = buyerName ? buyerName.split(" ")[0] : "";
  const cards = tickets.map(t => `
    <tr><td style="padding-bottom:12px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
        <tr><td style="height:3px;background:#ff4d00;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-family:Arial Black,Arial,sans-serif;font-size:15px;font-weight:900;color:#f5f0e8;text-transform:uppercase;letter-spacing:0.04em;">${t.tier}</div>
                <div style="font-family:Arial,sans-serif;font-size:11px;color:#888888;margin-top:3px;letter-spacing:0.1em;text-transform:uppercase;">Ticket #${t.number}</div>
              </td>
              <td align="right">
                <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#ff4d00;border:1px solid rgba(255,77,0,0.4);border-radius:3px;padding:4px 10px;letter-spacing:0.1em;text-transform:uppercase;">VALID</span>
              </td>
            </tr>
          </table>
          <div style="text-align:center;background:#0a0a0a;border-radius:3px;padding:20px;margin-top:16px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=f5f0e8&bgcolor=0a0a0a&data=${encodeURIComponent(APP_URL + "/ticket/" + t.qrToken)}"
              width="180" height="180" style="display:block;margin:0 auto;" alt="QR Code" />
            <div style="font-family:Arial,sans-serif;font-size:10px;color:#444444;margin-top:10px;word-break:break-all;">${APP_URL}/ticket/${t.qrToken}</div>
          </div>
        </td></tr>
      </table>
    </td></tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:28px;">
          <a href="${APP_URL}" style="text-decoration:none;">
            <span style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0.06em;color:#f5f0e8;">ONE</span><span style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0.06em;color:#ff4d00;">O</span><span style="font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:0.06em;color:#f5f0e8;">NETIX</span>
          </a>
        </td></tr>

        <!-- Hero -->
        <tr><td style="background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-bottom:16px;">
          <div style="height:3px;background:#ff4d00;"></div>
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 36px;">
            <tr><td align="center" style="padding-bottom:8px;"><span style="font-size:36px;">🎟</span></td></tr>
            <tr><td align="center" style="padding-bottom:6px;">
              <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#ff4d00;">Your Tickets</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:6px;">
              <h1 style="font-family:Arial Black,Arial,sans-serif;font-size:28px;font-weight:900;color:#f5f0e8;margin:0;text-transform:uppercase;letter-spacing:0.02em;">YOU'RE GOING${firstName ? `, ${firstName.toUpperCase()}` : ""}!</h1>
            </td></tr>
            <tr><td align="center" style="padding-bottom:4px;">
              <div style="font-family:Arial Black,Arial,sans-serif;font-size:16px;font-weight:900;color:#f5f0e8;text-transform:uppercase;letter-spacing:0.04em;">${eventName}</div>
            </td></tr>
            ${eventDate ? `<tr><td align="center" style="padding-bottom:0;">
              <div style="font-family:Arial,sans-serif;font-size:12px;color:#888888;letter-spacing:0.08em;text-transform:uppercase;">${eventDate}</div>
            </td></tr>` : ""}
          </table>
        </td></tr>

        <tr><td style="padding-top:16px;"></td></tr>

        <!-- Ticket cards -->
        ${cards}

        <!-- Footer -->
        <tr><td align="center" style="padding:20px 0 40px;">
          <p style="font-family:Arial,sans-serif;font-size:11px;color:#444444;margin:0;line-height:1.8;letter-spacing:0.05em;text-transform:uppercase;">
            Present your QR code at the door &nbsp;·&nbsp; Keep this email safe<br>
            POWERED BY <span style="color:#ff4d00;font-weight:700;">ONEONETIX</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────
serve(async (req) => {
  const body      = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";

  if (!await verifyStripeSignature(body, sigHeader, WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type: string; data: { object: any } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta    = session.metadata;

    const eventId    = meta.event_id;
    const tierId     = meta.tier_id;
    const quantity   = parseInt(meta.quantity);
    const buyerName  = meta.buyer_name;
    const buyerEmail = meta.buyer_email;
    const totalAmount = session.amount_total || 0;

    try {
      // Idempotency: skip if order already created for this session
      const { data: existing } = await supabase
        .from("ticket_orders").select("id").eq("stripe_session_id", session.id).maybeSingle();
      if (existing) {
        console.log("Order already exists for session", session.id, "— skipping");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("ticket_orders")
        .insert({
          event_id: eventId, tier_id: tierId,
          buyer_name: buyerName, buyer_email: buyerEmail,
          quantity, total_amount: totalAmount,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
          status: "paid",
        })
        .select().single();

      if (orderErr) throw new Error(orderErr.message);

      // Fetch tier + event
      const [{ data: tier }, { data: ev }] = await Promise.all([
        supabase.from("ticket_tiers").select("name, sold").eq("id", tierId).single(),
        supabase.from("events").select("name, date").eq("id", eventId).single(),
      ]);

      // Create individual tickets — use max+1 counter, no RPC needed
      const { data: existingTickets } = await supabase
        .from("tickets").select("ticket_number").eq("event_id", eventId)
        .order("ticket_number", { ascending: false }).limit(1);
      const startNum = (existingTickets?.[0]?.ticket_number || 0) + 1;
      const ticketRows = Array.from({ length: quantity }, (_, i) => ({
        order_id: order.id, event_id: eventId, tier_id: tierId,
        ticket_number: startNum + i,
      }));
      const { data: createdTickets, error: ticketErr } = await supabase
        .from("tickets").insert(ticketRows).select();
      if (ticketErr) throw new Error("Ticket insert failed: " + ticketErr.message);

      // Increment sold count
      await supabase.from("ticket_tiers")
        .update({ sold: (tier?.sold || 0) + quantity })
        .eq("id", tierId);

      // Send email
      const eventDate = ev?.date
        ? new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : "";

      await sendGmail(
        buyerEmail,
        `Your tickets for ${ev?.name}`,
        ticketEmail(
          buyerName,
          ev?.name || "",
          eventDate,
          (createdTickets || []).map(t => ({ number: t.ticket_number, tier: tier?.name || "General Admission", qrToken: t.qr_token }))
        )
      );
    } catch (err: any) {
      console.error("Webhook error:", err.message);
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    await supabase.from("ticket_orders")
      .update({ status: "refunded" })
      .eq("stripe_payment_intent", charge.payment_intent);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
