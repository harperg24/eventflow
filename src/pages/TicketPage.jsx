// ============================================================
//  src/pages/TicketPage.jsx
//  Public ticket purchase page — /tickets/:slug
// ============================================================
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTIONS_URL    = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co") + "/create-checkout";

export default function TicketPage() {
  const { slug }     = useParams();
  const navigate     = useNavigate();
  const [event,      setEvent]      = useState(null);
  const [tiers,      setTiers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [quantity,   setQuantity]   = useState(1);
  const [step,       setStep]       = useState("browse"); // browse | details | processing
  const [buyerName,  setBuyerName]  = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [error,      setError]      = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data: ev } = await supabase
        .from("events").select("*")
        .eq("invite_slug", slug)
        .in("type", ["ticketed", "hybrid"])
        .eq("published", true)
        .single();

      if (!ev) { setNotFound(true); setLoading(false); return; }
      setEvent(ev);

      const { data: ts } = await supabase
        .from("ticket_tiers").select("*")
        .eq("event_id", ev.id)
        .order("sort_order");
      setTiers(ts || []);
      setLoading(false);
    };
    load();
  }, [slug]);

  const handlePurchase = async () => {
    if (!buyerName.trim() || !buyerEmail.trim()) { setError("Please fill in your name and email."); return; }
    if (!buyerEmail.includes("@")) { setError("Please enter a valid email address."); return; }
    setStep("processing");
    setError(null);
    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON },
        body: JSON.stringify({
          eventId:    event.id,
          tierId:     selectedTier.id,
          quantity,
          buyerName:  buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url; // redirect to Stripe
    } catch (e) {
      setError(e.message);
      setStep("details");
    }
  };

  const available = (tier) => tier.capacity === null ? Infinity : tier.capacity - tier.sold;
  const fmt = (cents) => "$" + (cents / 100).toFixed(2);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#3a3a52", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎟</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#e2d9cc", marginBottom: 8 }}>Event not found</h1>
        <p style={{ color: "#5a5a72", fontSize: 14 }}>This event may not exist or tickets are not available.</p>
      </div>
    </div>
  );

  const eventDate = event.date
    ? new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg,#0d0d1f 0%, #06060e 100%)", borderBottom: "1px solid #1a1a2e", padding: "60px 24px 48px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
            <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
            <span style={{ fontSize: 13, color: "#5a5a72", letterSpacing: "0.06em" }}>EventFlow</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(28px,5vw,44px)", fontWeight: 700, color: "#f0e8db", margin: "0 0 12px", lineHeight: 1.2 }}>
            {event.name}
          </h1>
          {eventDate && <p style={{ fontSize: 16, color: "#c9a84c", marginBottom: 8, fontWeight: 500 }}>{eventDate}</p>}
          {event.venue && <p style={{ fontSize: 14, color: "#5a5a72", marginBottom: 0 }}>📍 {event.venue}</p>}
          {event.ticket_message && (
            <p style={{ fontSize: 14, color: "#8a8278", lineHeight: 1.7, marginTop: 20, maxWidth: 480, margin: "20px auto 0", padding: "16px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid #1a1a2e" }}>
              {event.ticket_message}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>

        {step === "browse" && (
          <>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 20 }}>Select Tickets</h2>
            {tiers.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px", color: "#3a3a52", fontSize: 14 }}>No ticket tiers available yet.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tiers.map(tier => {
                const avail  = available(tier);
                const isSoldOut = avail <= 0;
                const isSelected = selectedTier?.id === tier.id;
                return (
                  <div key={tier.id}
                    onClick={() => !isSoldOut && setSelectedTier(tier)}
                    style={{ background: isSelected ? "rgba(201,168,76,0.07)" : "#0a0a14", border: `1.5px solid ${isSelected ? "rgba(201,168,76,0.4)" : "#1e1e2e"}`, borderRadius: 14, padding: "20px 22px", cursor: isSoldOut ? "not-allowed" : "pointer", opacity: isSoldOut ? 0.5 : 1, transition: "all 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isSelected ? "#c9a84c" : "#2e2e42"}`, background: isSelected ? "#c9a84c" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                            {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#080810" }} />}
                          </div>
                          <span style={{ fontSize: 16, fontWeight: 600, color: "#f0e8db" }}>{tier.name}</span>
                          {isSoldOut && <span style={{ fontSize: 11, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 5, padding: "2px 8px" }}>Sold Out</span>}
                        </div>
                        {tier.description && <p style={{ fontSize: 13, color: "#5a5a72", margin: "0 0 0 28px", lineHeight: 1.5 }}>{tier.description}</p>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#c9a84c", fontFamily: "'Playfair Display',serif" }}>{fmt(tier.price)}</div>
                        {tier.capacity !== null && (
                          <div style={{ fontSize: 11, color: "#3a3a52", marginTop: 2 }}>
                            {isSoldOut ? "Sold out" : `${avail} left`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity selector */}
                    {isSelected && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1e1e2e", display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 13, color: "#8a8278" }}>Quantity</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#13131f", borderRadius: 8, padding: "4px 6px" }}>
                          <button onClick={e => { e.stopPropagation(); setQuantity(q => Math.max(1, q - 1)); }}
                            style={{ width: 28, height: 28, border: "none", background: "none", color: "#e2d9cc", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{quantity}</span>
                          <button onClick={e => { e.stopPropagation(); setQuantity(q => Math.min(avail, q + 1)); }}
                            style={{ width: 28, height: 28, border: "none", background: "none", color: "#e2d9cc", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        </div>
                        <span style={{ fontSize: 13, color: "#5a5a72", marginLeft: "auto" }}>
                          Total: <strong style={{ color: "#c9a84c" }}>{fmt(tier.price * quantity)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedTier && (
              <button onClick={() => setStep("details")}
                style={{ width: "100%", marginTop: 20, background: "linear-gradient(135deg,#c9a84c,#a8872e)", color: "#080810", border: "none", borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.02em" }}>
                Continue → {quantity} × {selectedTier.name} · {fmt(selectedTier.price * quantity)}
              </button>
            )}
          </>
        )}

        {step === "details" && (
          <div style={{ maxWidth: 440, margin: "0 auto" }}>
            <button onClick={() => setStep("browse")} style={{ background: "none", border: "none", color: "#5a5a72", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif", marginBottom: 20, padding: 0 }}>← Back</button>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 24 }}>Your Details</h2>

            {/* Order summary */}
            <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                <span style={{ color: "#8a8278" }}>{quantity} × {selectedTier.name}</span>
                <span style={{ color: "#c9a84c", fontWeight: 600 }}>{fmt(selectedTier.price * quantity)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#5a5a72" }}>{event.name} {eventDate ? `· ${eventDate}` : ""}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Full Name</div>
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
                  placeholder="Your name"
                  style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 9, padding: "11px 14px", color: "#e2d9cc", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email Address</div>
                <input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)}
                  type="email" placeholder="your@email.com"
                  style={{ width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 9, padding: "11px 14px", color: "#e2d9cc", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
              </div>
            </div>

            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</div>}

            <button onClick={handlePurchase}
              style={{ width: "100%", background: "linear-gradient(135deg,#c9a84c,#a8872e)", color: "#080810", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Pay {fmt(selectedTier.price * quantity)} with Stripe →
            </button>
            <p style={{ fontSize: 11, color: "#3a3a52", textAlign: "center", marginTop: 12 }}>
              Secured by Stripe · Your ticket will be emailed to you
            </p>
          </div>
        )}

        {step === "processing" && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ color: "#5a5a72", fontSize: 14 }}>Redirecting to secure payment…</p>
          </div>
        )}
      </div>
    </div>
  );
}
