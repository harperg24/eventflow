// ============================================================
//  src/pages/CheckIn.jsx
//  Shown when a guest's QR code is scanned at the door
//  Add route: <Route path="/checkin/:guestId" element={<CheckIn />} />
// ============================================================
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function CheckIn() {
  const { guestId } = useParams();
  const [status, setStatus] = useState("loading"); // loading | success | already | error
  const [guest,  setGuest]  = useState(null);
  const [event,  setEvent]  = useState(null);

  useEffect(() => {
    const run = async () => {
      // Fetch guest
      const { data: g, error: gErr } = await supabase
        .from("guests").select("*, events(name, date)").eq("id", guestId).single();

      if (gErr || !g) { setStatus("error"); return; }
      setGuest(g);
      setEvent(g.events);

      if (g.checked_in) { setStatus("already"); return; }

      // Mark checked in
      const { error } = await supabase.from("guests")
        .update({ checked_in: true, checked_in_at: new Date().toISOString() })
        .eq("id", guestId);

      setStatus(error ? "error" : "success");
    };
    run();
  }, [guestId]);

  const icons = { loading: "⏳", success: "🎉", already: "✓", error: "⚠" };
  const titles = {
    loading: "Checking in…",
    success: `Welcome, ${guest?.name?.split(" ")[0] || "Guest"}!`,
    already: `${guest?.name?.split(" ")[0] || "Guest"} is already checked in`,
    error:   "Something went wrong",
  };
  const colours = { loading: "#5a5a72", success: "#10b981", already: "#c9a84c", error: "#ef4444" };

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>

        {/* Logo */}
        <div style={{ marginBottom: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
          <span style={{ fontSize: 14, color: "#5a5a72", letterSpacing: "0.05em" }}>EventFlow</span>
        </div>

        <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 20, padding: "40px 32px" }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>{icons[status]}</div>

          {event && (
            <div style={{ fontSize: 12, color: "#5a5a72", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {event.name}
            </div>
          )}

          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: colours[status], margin: "0 0 12px" }}>
            {titles[status]}
          </h1>

          {status === "success" && (
            <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>
              You're on the list. Enjoy the event!
            </p>
          )}
          {status === "already" && (
            <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>
              This guest was already checked in earlier.
            </p>
          )}
          {status === "error" && (
            <p style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, margin: 0 }}>
              This QR code is invalid or the guest was not found.
            </p>
          )}
        </div>

        {event?.date && (
          <p style={{ marginTop: 20, fontSize: 12, color: "#2e2e42" }}>
            {new Date(event.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
      </div>
    </div>
  );
}
