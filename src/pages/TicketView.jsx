// ============================================================
//  src/pages/TicketView.jsx
//  Individual ticket page — /ticket/:qrToken
// ============================================================
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TicketView() {
  const { qrToken }       = useParams();
  const [ticket,  setTicket]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*, ticket_tiers(name), ticket_orders(buyer_name,buyer_email,quantity), events(name,date,venue)")
        .eq("qr_token", qrToken)
        .single();
      setTicket(data);
      setLoading(false);
    };
    load();
  }, [qrToken]);

  const qrUrl = window.location.href;
  const qrImgUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(qrUrl);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", color: "#3a3a52", fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
  );

  if (!ticket) return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", textAlign: "center", padding: 24 }}>
      <div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#ef4444" }}>Invalid Ticket</h1>
        <p style={{ color: "#5a5a72" }}>This ticket could not be found.</p>
      </div>
    </div>
  );

  const ev = ticket.events;
  const eventDate = ev?.date ? new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 380, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
          <span style={{ fontSize: 14, color: "#5a5a72", letterSpacing: "0.05em" }}>EventFlow</span>
        </div>

        {/* Ticket card */}
        <div style={{ background: "#0a0a14", border: `2px solid ${ticket.checked_in ? "#10b981" : "#1e1e2e"}`, borderRadius: 20, overflow: "hidden" }}>
          {/* Status banner */}
          {ticket.checked_in && (
            <div style={{ background: "rgba(16,185,129,0.15)", borderBottom: "1px solid rgba(16,185,129,0.2)", padding: "10px 20px", textAlign: "center", fontSize: 13, color: "#10b981", fontWeight: 600 }}>
              ✓ Checked in {ticket.checked_in_at ? new Date(ticket.checked_in_at).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
          )}

          {/* Header */}
          <div style={{ padding: "28px 28px 20px", borderBottom: "1px dashed #1e1e2e" }}>
            <div style={{ fontSize: 12, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Your Ticket</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#f0e8db", margin: "0 0 4px" }}>{ev?.name}</h1>
            {eventDate && <p style={{ fontSize: 13, color: "#c9a84c", margin: "0 0 4px" }}>{eventDate}</p>}
            {ev?.venue && <p style={{ fontSize: 13, color: "#5a5a72", margin: 0 }}>📍 {ev.venue}</p>}
          </div>

          {/* Details */}
          <div style={{ padding: "20px 28px", borderBottom: "1px dashed #1e1e2e", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "#3a3a52", marginBottom: 4 }}>TICKET TYPE</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{ticket.ticket_tiers?.name || "General Admission"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#3a3a52", marginBottom: 4 }}>TICKET NO.</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#c9a84c" }}>{ticket.ticket_number}</div>
            </div>
          </div>
          <div style={{ padding: "16px 28px", borderBottom: "1px dashed #1e1e2e" }}>
            <div style={{ fontSize: 11, color: "#3a3a52", marginBottom: 4 }}>HOLDER</div>
            <div style={{ fontSize: 14 }}>{ticket.ticket_orders?.buyer_name}</div>
          </div>

          {/* QR */}
          <div style={{ padding: "28px", textAlign: "center" }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-block", marginBottom: 12 }}>
              <img src={qrImgUrl} width="180" height="180" alt="Ticket QR" />
            </div>
            <div style={{ fontSize: 11, color: "#3a3a52" }}>Present this QR code at the door</div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#2e2e42", marginTop: 20 }}>
          Keep this page saved — it's your ticket
        </p>
      </div>
    </div>
  );
}
