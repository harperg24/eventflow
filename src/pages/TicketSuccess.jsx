// ============================================================
//  src/pages/TicketSuccess.jsx
//  Post-purchase confirmation — /tickets/:slug/success
// ============================================================
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, getTheme, globalCSS, applyThemeToDOM } from "./theme";

export default function TicketSuccess() {
  const { slug }          = useParams();
  const [params]          = useSearchParams();
  const sessionId         = params.get("session_id");
  const [order,  setOrder]  = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    // Poll briefly to give webhook time to process
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: ord } = await supabase
        .from("ticket_orders").select("*, ticket_tiers(name), events(name,date)")
        .eq("stripe_session_id", sessionId).single();
      if (ord?.status === "paid") {
        setOrder(ord);
        const { data: tix } = await supabase
          .from("tickets").select("*").eq("order_id", ord.id);
        setTickets(tix || []);
        setLoading(false);
        clearInterval(poll);
      }
      if (attempts > 10) { setLoading(false); clearInterval(poll); }
    }, 1500);
    return () => clearInterval(poll);
  }, [sessionId]);

  const fmt = (cents) => "$" + (cents / 100).toFixed(2);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{(() => { const p = loadThemePrefs(); applyThemeToDOM(p); return globalCSS(getTheme(p)); })()}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 520, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "var(--accent)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>✦</div>
          <span style={{ fontSize: 14, color: "var(--text2)", letterSpacing: "0.05em" }}>Oneonetix</span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ color: "var(--text2)" }}>Confirming your order…</p>
          </div>
        ) : order ? (
          <>
            <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20, padding: "40px 32px", textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text)", margin: "0 0 8px" }}>You're in!</h1>
              <p style={{ fontSize: 15, color: "var(--accent)", margin: "0 0 4px", fontWeight: 500 }}>{order.events?.name}</p>
              <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
                {order.events?.date ? new Date(order.events.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" }) : ""}
              </p>
              <div style={{ margin: "24px 0", height: "1.5px", background: "var(--border)" }} />
              <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>
                Your {order.quantity} ticket{order.quantity > 1 ? "s" : ""} have been emailed to <strong style={{ color: "var(--text)" }}>{order.buyer_email}</strong>
              </p>
            </div>

            {/* Ticket previews */}
            {tickets.map(t => (
              <div key={t.id} style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "18px 22px", marginBottom: 10, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, background: "var(--accentBg)", border: "1.5px solid var(--accentBorder)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎟</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{order.ticket_tiers?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>Ticket {t.ticket_number}</div>
                </div>
                <a href={"/ticket/" + t.qr_token}
                  style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", border: "1.5px solid var(--accentBorder)", borderRadius: 7, padding: "5px 12px" }}>
                  View →
                </a>
              </div>
            ))}

            <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", marginTop: 16 }}>
              Check your email for QR code tickets · Total charged: {fmt(order.total_amount)}
            </p>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "60px", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>Payment received!</h1>
            <p style={{ color: "var(--text2)", fontSize: 14 }}>Your tickets will be emailed to you shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
