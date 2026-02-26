// ============================================================
//  src/pages/TicketSuccess.jsx
//  Post-purchase confirmation — /tickets/:slug/success
// ============================================================
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, getTheme, globalCSS, applyThemeToDOM } from "./theme";

export default function TicketSuccess() {
  const { slug }              = useParams();
  const [params]              = useSearchParams();
  const sessionId             = params.get("session_id");
  const [order,    setOrder]  = useState(null);
  const [tickets,  setTickets]= useState([]);
  const [loading,  setLoading]= useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: ord } = await supabase
        .from("ticket_orders")
        .select("*, ticket_tiers(name), events(name,date,invite_slug)")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (ord) {
        setOrder(ord);
        if (ord.status === "paid") {
          const { data: tix } = await supabase
            .from("tickets").select("*").eq("order_id", ord.id);
          setTickets(tix || []);
        }
        setLoading(false);
        clearInterval(poll);
        return;
      }
      // After 20 attempts (~30s) show a fallback — Stripe confirmed payment,
      // webhook is just slow. Order will still arrive and email will send.
      if (attempts >= 20) {
        setTimedOut(true);
        setLoading(false);
        clearInterval(poll);
      }
    }, 1500);
    return () => clearInterval(poll);
  }, [sessionId]);

  const fmt = (cents) => "$" + (cents / 100).toFixed(2);

  const t = (() => { const p = loadThemePrefs(); applyThemeToDOM(p); return getTheme(p); })();

  const card = {
    background: "var(--bg2)", border: "1px solid var(--border)",
    borderRadius: "var(--radiusLg,4px)", borderTop: "3px solid var(--accent)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--fontBody,'Barlow',sans-serif)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{globalCSS(t)}</style>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <a href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "'Bebas Neue','Arial Black',Arial,sans-serif", fontSize: 22, letterSpacing: "0.06em", color: "var(--text)" }}>ONE</span><span style={{ fontFamily: "'Bebas Neue','Arial Black',Arial,sans-serif", fontSize: 22, letterSpacing: "0.06em", color: "var(--accent)" }}>O</span><span style={{ fontFamily: "'Bebas Neue','Arial Black',Arial,sans-serif", fontSize: 22, letterSpacing: "0.06em", color: "var(--text)" }}>NETIX</span>
          </a>
        </div>

        {loading ? (
          <div style={{ ...card, padding: "60px 32px", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
            <p style={{ color: "var(--text2)", margin: 0, fontFamily: "'Barlow Condensed',Arial,sans-serif", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>Confirming your order…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

        ) : order ? (
          <>
            <div style={{ ...card, padding: "36px 32px", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🎟</div>
              <div style={{ fontFamily: "'Barlow Condensed',Arial,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>Payment Confirmed</div>
              <h1 style={{ fontFamily: "'Bebas Neue','Arial Black',Arial,sans-serif", fontSize: "2.8rem", letterSpacing: "0.02em", lineHeight: 0.95, color: "var(--text)", margin: "0 0 10px" }}>YOU'RE IN!</h1>
              <p style={{ fontSize: 16, color: "var(--text)", margin: "0 0 4px", fontWeight: 600 }}>{order.events?.name}</p>
              <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>
                {order.events?.date ? new Date(order.events.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
              </p>
              <div style={{ background: "var(--bg3)", borderRadius: "var(--radius,3px)", padding: "14px 18px", fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>
                {order.quantity} ticket{order.quantity > 1 ? "s" : ""} sent to <strong style={{ color: "var(--text)" }}>{order.buyer_email}</strong>
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>Total charged: {fmt(order.total_amount)}</div>
            </div>

            {/* Individual ticket cards */}
            {tickets.length > 0 && tickets.map(t => (
              <div key={t.id} style={{ ...card, padding: "16px 20px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, background: "var(--accentBg)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius,3px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎫</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{order.ticket_tiers?.name || "Ticket"}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "'Barlow Condensed',Arial,sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>#{t.ticket_number}</div>
                </div>
                <a href={"/ticket/" + t.qr_token} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius,3px)", padding: "6px 14px", fontFamily: "'Barlow Condensed',Arial,sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  View →
                </a>
              </div>
            ))}

            {tickets.length === 0 && (
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--text3)", padding: "16px 0" }}>
                Check your email for QR code tickets — they may take a moment to arrive.
              </div>
            )}
          </>

        ) : timedOut ? (
          /* Webhook slow / delayed — payment IS confirmed by Stripe redirecting here */
          <div style={{ ...card, padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: "'Barlow Condensed',Arial,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>Payment Received</div>
            <h1 style={{ fontFamily: "'Bebas Neue','Arial Black',Arial,sans-serif", fontSize: "2.8rem", letterSpacing: "0.02em", lineHeight: 0.95, color: "var(--text)", margin: "0 0 16px" }}>YOU'RE IN!</h1>
            <p style={{ fontSize: 14, color: "var(--text2)", margin: "0 0 24px", lineHeight: 1.6 }}>
              Your payment was successful. Your tickets will arrive by email within a few minutes.
            </p>
            <div style={{ background: "var(--bg3)", borderRadius: "var(--radius,3px)", padding: "14px 18px", fontSize: 13, color: "var(--text2)" }}>
              If your tickets don't arrive, check your spam folder or contact the event organiser.
            </div>
          </div>

        ) : (
          /* No session_id in URL */
          <div style={{ ...card, padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎟</div>
            <h1 style={{ fontFamily: "'Bebas Neue','Arial Black',Arial,sans-serif", fontSize: "2.4rem", color: "var(--text)", margin: "0 0 12px" }}>NOTHING HERE</h1>
            <p style={{ color: "var(--text2)", fontSize: 14 }}>No order found. Check your email for your tickets.</p>
          </div>
        )}
      </div>
    </div>
  );
}
