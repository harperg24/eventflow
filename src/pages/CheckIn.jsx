// ============================================================
//  src/pages/CheckIn.jsx
//  /checkin/:guestId       — individual QR, auto check-in
//  /checkin/event/:eventId — event QR, guest picks themselves
// ============================================================
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const page = { minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 };
const card = { background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 20, padding: "36px 32px", maxWidth: 400, width: "100%", textAlign: "center" };
const field = { width: "100%", boxSizing: "border-box", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 9, padding: "11px 14px", color: "#e2d9cc", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 10 };
const btnGreen = { width: "100%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: 9, padding: 12, fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 };
const btnGhost = { width: "100%", background: "none", border: "1px solid #1e1e2e", color: "#5a5a72", borderRadius: 9, padding: 11, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: 8 };

function Logo() {
  return (
    <div style={{ marginBottom: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
      <span style={{ fontSize: 14, color: "#5a5a72", letterSpacing: "0.05em" }}>EventFlow</span>
    </div>
  );
}

// ── Individual guest QR ──────────────────────────────────────
export function GuestCheckIn() {
  const { guestId } = useParams();
  const [status, setStatus] = useState("loading");
  const [guest,  setGuest]  = useState(null);
  const [event,  setEvent]  = useState(null);

  useEffect(() => {
    const run = async () => {
      const { data: g, error } = await supabase
        .from("guests").select("*, events(name, date)").eq("id", guestId).single();
      if (error || !g) { setStatus("error"); return; }
      setGuest(g); setEvent(g.events);
      if (g.checked_in) { setStatus("already"); return; }
      const { error: upErr } = await supabase.from("guests")
        .update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("id", guestId);
      setStatus(upErr ? "error" : "success");
    };
    run();
  }, [guestId]);

  const cfgMap = {
    loading: { icon: "⏳", title: "Checking you in…",   color: "#5a5a72" },
    success: { icon: "🎉", title: `Welcome, ${guest?.name?.split(" ")[0] || "Guest"}!`, color: "#10b981" },
    already: { icon: "✓",  title: "Already checked in", color: "#c9a84c" },
    error:   { icon: "⚠",  title: "Something went wrong", color: "#ef4444" },
  };
  const cfg = cfgMap[status] || cfgMap.loading;

  return (
    <div style={page}>
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <Logo />
        <div style={card}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>{cfg.icon}</div>
          {event && <div style={{ fontSize: 12, color: "#5a5a72", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{event.name}</div>}
          <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 26, fontWeight: 700, color: cfg.color, margin: "0 0 12px" }}>{cfg.title}</h1>
          {status === "success" && <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>You're on the list. Enjoy the event!</p>}
          {status === "already" && <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>Your ticket was already scanned earlier.</p>}
          {status === "error"   && <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>This QR code is invalid or the guest was not found.</p>}
        </div>
        {event?.date && <p style={{ marginTop: 20, fontSize: 12, color: "#2e2e42" }}>{new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>}
      </div>
    </div>
  );
}

// ── Event-wide QR ────────────────────────────────────────────
export function EventCheckIn() {
  const { eventId } = useParams();
  const [event,    setEvent]    = useState(null);
  const [guests,   setGuests]   = useState([]);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [status,   setStatus]   = useState("idle");

  useEffect(() => {
    const load = async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).single();
      setEvent(ev);
      const { data: gs } = await supabase.from("guests")
        .select("id,name,email,status,checked_in").eq("event_id", eventId)
        .eq("status", "attending").order("name");
      setGuests(gs || []);
    };
    load();
  }, [eventId]);

  const filtered = guests.filter(g => {
    const q = search.toLowerCase();
    return !q || (g.name || "").toLowerCase().includes(q) || (g.email || "").toLowerCase().includes(q);
  });

  const handleCheckIn = async () => {
    if (!selected) return;
    setStatus("loading");
    if (selected.checked_in) { setStatus("already"); return; }
    const { error } = await supabase.from("guests")
      .update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("id", selected.id);
    if (error) { setStatus("error"); return; }
    setGuests(gs => gs.map(g => g.id === selected.id ? { ...g, checked_in: true } : g));
    setStatus("success");
  };

  if (status === "success" || status === "already") {
    return (
      <div style={page}>
        <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
          <Logo />
          <div style={card}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>{status === "success" ? "🎉" : "✓"}</div>
            {event && <div style={{ fontSize: 12, color: "#5a5a72", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{event.name}</div>}
            <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 26, fontWeight: 700, color: status === "success" ? "#10b981" : "#c9a84c", margin: "0 0 12px" }}>
              {status === "success" ? `Welcome, ${selected?.name?.split(" ")[0]}!` : "Already checked in"}
            </h1>
            <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>
              {status === "success" ? "You're on the list. Enjoy the event!" : "Your ticket was already scanned earlier."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <Logo />
        <div style={card}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
          {event && <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 22, fontWeight: 700, color: "#f0e8db", margin: "0 0 4px" }}>{event.name}</h1>}
          <p style={{ fontSize: 14, color: "#5a5a72", margin: "0 0 24px" }}>Find your name to check in</p>

          {!selected ? (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search your name or email…"
                style={{ ...field, textAlign: "left" }} autoFocus />
              <div style={{ maxHeight: 300, overflowY: "auto", textAlign: "left" }}>
                {filtered.length === 0 && search && (
                  <div style={{ padding: 16, color: "#3a3a52", fontSize: 13, textAlign: "center" }}>No guests found.</div>
                )}
                {filtered.map(g => (
                  <div key={g.id} onClick={() => setSelected(g)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 9, cursor: "pointer", transition: "background 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: g.checked_in ? "rgba(16,185,129,0.15)" : "#13131f", border: `1.5px solid ${g.checked_in ? "#10b981" : "#1e1e2e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#e2d9cc", flexShrink: 0 }}>
                      {(g.name || g.email || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: g.checked_in ? "#5a8a72" : "#e2d9cc", fontWeight: 500 }}>{g.name || g.email}</div>
                      {g.email && g.name && <div style={{ fontSize: 11, color: "#3a3a52", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.email}</div>}
                    </div>
                    {g.checked_in && <span style={{ fontSize: 11, color: "#10b981", flexShrink: 0 }}>✓ In</span>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 12, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#e2d9cc", marginBottom: 2 }}>{selected.name || selected.email}</div>
                {selected.email && selected.name && <div style={{ fontSize: 12, color: "#5a5a72" }}>{selected.email}</div>}
              </div>
              <p style={{ fontSize: 14, color: "#5a5a72", marginBottom: 20 }}>Is this you?</p>
              <button onClick={handleCheckIn} disabled={status === "loading"} style={btnGreen}>
                {status === "loading" ? "Checking in…" : "✓ Yes, check me in"}
              </button>
              <button onClick={() => setSelected(null)} style={btnGhost}>← That's not me</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuestCheckIn;
