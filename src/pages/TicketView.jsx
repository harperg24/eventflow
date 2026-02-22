// ============================================================
//  src/pages/TicketView.jsx  —  /ticket/:qrToken
// ============================================================
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TicketView() {
  const { qrToken }       = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(false);
  const ticketRef = useRef(null);

  useEffect(() => {
    supabase
      .from("tickets")
      .select("*, ticket_tiers(name), events(name,date,venue_name)")
      .eq("qr_token", qrToken)
      .single()
      .then(({ data }) => { setTicket(data); setLoading(false); });
  }, [qrToken]);

  // Download ticket as PNG using html2canvas approach (no dependency — use CSS print)
  const handleSaveImage = async () => {
    // Open a print-friendly version in a new tab
    window.print();
  };

  // Add to Apple Wallet — generate a PKPass via a public third-party API isn't
  // available without a backend cert. Instead we provide a well-formatted download.
  const handleAddToWallet = () => {
    // Show instructions for now — full PKPass requires Apple Developer cert
    alert("To add to Apple Wallet:\n1. Take a screenshot of this page\n2. Or save the ticket image\n3. In iOS Photos, tap Share → Add to Wallet (if supported)\n\nFor Android: The QR code works with any QR scanner — no wallet needed.");
  };

  const handleDownloadQR = () => {
    const url = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + encodeURIComponent(window.location.href);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${ticket?.ticket_number || "eventflow"}.png`;
    a.click();
  };

  const qrImgUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(window.location.href);
  const ev = ticket?.events;
  const eventDate = ev?.date
    ? new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

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

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "32px 16px 48px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .ticket-card { border: 2px solid #000 !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Logo */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
        <span style={{ fontSize: 14, color: "#5a5a72", letterSpacing: "0.05em" }}>EventFlow</span>
      </div>

      {/* Ticket card */}
      <div ref={ticketRef} className="ticket-card" style={{ maxWidth: 380, width: "100%", background: "#0a0a14", border: `2px solid ${ticket.checked_in ? "#10b981" : "#1e1e2e"}`, borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>

        {/* Checked in banner */}
        {ticket.checked_in && (
          <div style={{ background: "rgba(16,185,129,0.15)", borderBottom: "1px solid rgba(16,185,129,0.2)", padding: "10px 20px", textAlign: "center", fontSize: 13, color: "#10b981", fontWeight: 600 }}>
            ✓ Checked in {ticket.checked_in_at ? new Date(ticket.checked_in_at).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        )}

        {/* Event info */}
        <div style={{ padding: "28px 28px 20px", borderBottom: "1px dashed #1e1e2e" }}>
          <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Your Ticket</div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#f0e8db", margin: "0 0 4px" }}>{ev?.name}</h1>
          {eventDate && <p style={{ fontSize: 13, color: "#c9a84c", margin: "0 0 4px" }}>{eventDate}</p>}
          {ev?.venue_name && <p style={{ fontSize: 12, color: "#5a5a72", margin: 0 }}>📍 {ev.venue_name}</p>}
        </div>

        {/* Ticket details */}
        <div style={{ padding: "18px 28px", borderBottom: "1px dashed #1e1e2e", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: "#3a3a52", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{ticket.ticket_tiers?.name || "General Admission"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#3a3a52", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ticket</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#c9a84c" }}>{ticket.ticket_number}</div>
          </div>
        </div>

        {/* QR code */}
        <div style={{ padding: "28px", textAlign: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-block", marginBottom: 10 }}>
            <img src={qrImgUrl} width="180" height="180" alt="Ticket QR code" />
          </div>
          <div style={{ fontSize: 10, color: "#3a3a52" }}>Present at the door · {ticket.ticket_number}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="no-print" style={{ maxWidth: 380, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Download QR */}
        <button onClick={handleDownloadQR}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 12, padding: "14px", color: "#e2d9cc", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor="#c9a84c"}
          onMouseLeave={e => e.currentTarget.style.borderColor="#1e1e2e"}>
          <span style={{ fontSize: 18 }}>⬇</span> Download QR Code
        </button>

        {/* Save / Print */}
        <button onClick={handleSaveImage}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 12, padding: "14px", color: "#e2d9cc", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor="#c9a84c"}
          onMouseLeave={e => e.currentTarget.style.borderColor="#1e1e2e"}>
          <span style={{ fontSize: 18 }}>🖨</span> Print / Save as PDF
        </button>

        {/* Wallet */}
        <button onClick={handleAddToWallet}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#000", border: "1px solid #333", borderRadius: 12, padding: "14px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          <span style={{ fontSize: 18 }}>🍎</span> Add to Wallet
        </button>

        <p style={{ textAlign: "center", fontSize: 11, color: "#2e2e42", marginTop: 4 }}>
          Keep this page bookmarked — it's your ticket
        </p>
      </div>
    </div>
  );
}
