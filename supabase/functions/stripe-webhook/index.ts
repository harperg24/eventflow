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
function ticketEmail(buyerName: string, eventName: string, eventDate: string, tickets: { number: string; tier: string; qrToken: string }[]): string {
  const cards = tickets.map(t => `
    <div style="background:#13131f;border:1px solid #1e1e2e;border-radius:14px;padding:20px 24px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <div style="font-size:16px;font-weight:600;color:#f0e8db;">${t.tier}</div>
          <div style="font-size:12px;color:#5a5a72;margin-top:2px;">Ticket ${t.number}</div>
        </div>
        <div style="font-size:12px;color:#c9a84c;font-weight:600;border:1px solid rgba(201,168,76,0.3);border-radius:6px;padding:4px 10px;">VALID</div>
      </div>
      <div style="text-align:center;background:#0a0a14;border-radius:10px;padding:16px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(APP_URL + '/ticket/' + t.qrToken)}"
          width="160" height="160" style="display:block;margin:0 auto;" />
        <div style="font-size:11px;color:#3a3a52;margin-top:8px;">${APP_URL}/ticket/${t.qrToken}</div>
      </div>
    </div>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#06060e;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2d9cc;">
  <div style="max-width:540px;margin:0 auto;padding:48px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:14px;color:#5a5a72;letter-spacing:0.05em;">✦ Oneonetix</span>
    </div>
    <div style="background:#0a0a14;border:1px solid #1e1e2e;border-radius:18px;padding:36px;text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;margin-bottom:16px;">🎟</div>
      <h1 style="font-family:Georgia,serif;font-size:24px;color:#f0e8db;margin:0 0 8px;">You're going${buyerName ? `, ${buyerName.split(" ")[0]}` : ""}!</h1>
      <h2 style="font-family:Georgia,serif;font-size:18px;color:#c9a84c;margin:0 0 6px;">${eventName}</h2>
      ${eventDate ? `<p style="font-size:13px;color:#5a5a72;margin:0;">${eventDate}</p>` : ""}
    </div>
    ${cards}
    <p style="text-align:center;font-size:12px;color:#3a3a52;margin-top:20px;">Present your QR code at the door · Keep this email safe</p>
  </div></body></html>`;
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

      // Create individual tickets
      const ticketRows = [];
      for (let i = 0; i < quantity; i++) {
        const { data: num } = await supabase.rpc("next_ticket_number", { p_event_id: eventId });
        ticketRows.push({ order_id: order.id, event_id: eventId, tier_id: tierId, ticket_number: num });
      }
      const { data: createdTickets } = await supabase.from("tickets").insert(ticketRows).select();

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
