// ============================================================
//  supabase/functions/create-checkout/index.ts
//  Deploy: supabase functions deploy create-checkout --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL       = Deno.env.get("APP_URL") || "http://localhost:5173";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Call Stripe REST API directly — no SDK, no bundler issues
async function stripePost(path: string, body: Record<string, unknown>) {
  const encoded = new URLSearchParams();
  const flatten = (obj: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && v !== undefined) {
        if (typeof v === "object" && !Array.isArray(v)) {
          flatten(v as Record<string, unknown>, key);
        } else if (Array.isArray(v)) {
          v.forEach((item, i) => {
            if (typeof item === "object") flatten(item as Record<string, unknown>, `${key}[${i}]`);
            else encoded.append(`${key}[${i}]`, String(item));
          });
        } else {
          encoded.append(key, String(v));
        }
      }
    }
  };
  flatten(body);

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encoded.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe error");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { eventId, tierId, quantity, buyerName, buyerEmail } = await req.json();

    if (!eventId || !tierId || !quantity || !buyerEmail || !buyerName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: cors });
    }

    const [{ data: event }, { data: tier }] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.from("ticket_tiers").select("*").eq("id", tierId).single(),
    ]);

    if (!event || !tier) {
      return new Response(JSON.stringify({ error: "Event or tier not found" }), { status: 404, headers: cors });
    }

    if (tier.capacity !== null && (tier.sold + quantity) > tier.capacity) {
      return new Response(JSON.stringify({ error: "Not enough tickets available" }), { status: 400, headers: cors });
    }

    const eventDate = event.date
      ? new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";

    const session = await stripePost("checkout/sessions", {
      "payment_method_types[0]": "card",
      mode: "payment",
      customer_email: buyerEmail,
      "line_items[0][price_data][currency]": "nzd",
      "line_items[0][price_data][unit_amount]": tier.price,
      "line_items[0][price_data][product_data][name]": `${tier.name} — ${event.name}`,
      "line_items[0][price_data][product_data][description]": [tier.description, eventDate].filter(Boolean).join(" · ") || "",
      "line_items[0][quantity]": quantity,
      "metadata[event_id]":    eventId,
      "metadata[tier_id]":     tierId,
      "metadata[quantity]":    String(quantity),
      "metadata[buyer_name]":  buyerName,
      "metadata[buyer_email]": buyerEmail,
      success_url: `${APP_URL}/tickets/${event.invite_slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/tickets/${event.invite_slug}`,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
});
