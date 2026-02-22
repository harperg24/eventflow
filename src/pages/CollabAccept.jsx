// src/pages/CollabAccept.jsx  —  /collab/accept/:token
// Handles accepting a collaboration invite (works before or after sign-in)
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function CollabAccept() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [collab, setCollab] = useState(null);
  const [step,   setStep]   = useState("loading"); // loading | preview | done | invalid

  useEffect(() => {
    supabase.from("event_collaborators")
      .select("*, events(name,date,venue_name)")
      .eq("invite_token", token).single()
      .then(({ data }) => {
        if (!data) { setStep("invalid"); return; }
        if (data.status === "accepted") { setStep("done"); setCollab(data); return; }
        setCollab(data);
        setStep("preview");
      });
  }, [token]);

  const handleDecision = async (decision) => {
    const { data: { user } } = await supabase.auth.getUser();
    const updates = {
      status: decision,
      ...(decision === "accepted" ? {
        accepted_at: new Date().toISOString(),
        user_id: user?.id || null,
      } : {}),
    };
    await supabase.from("event_collaborators").update(updates).eq("invite_token", token);
    if (decision === "accepted") {
      navigate(user ? `/dashboard/${collab.event_id}` : "/login");
    } else {
      setStep("declined");
    }
  };

  const ROLE_LABELS = {
    admin:     { label: "Admin", desc: "Full access except transferring ownership", color: "#818cf8" },
    ticketing: { label: "Ticketing", desc: "Manage ticket tiers, orders and sales", color: "#c9a84c" },
    check_in:  { label: "Check-in", desc: "Scan tickets and manage guest arrivals", color: "#10b981" },
    view_only: { label: "View Only", desc: "Read-only access to all sections", color: "#5a5a72" },
  };

  const S = {
    page: { minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  };

  if (step === "loading") return <div style={S.page}><span style={{ color: "#3a3a52" }}>Loading…</span></div>;
  if (step === "invalid") return (
    <div style={{ ...S.page, textAlign: "center" }}>
      <div><div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#ef4444" }}>Invalid Link</h1>
      <p style={{ color: "#5a5a72" }}>This invitation link is not valid or has expired.</p></div>
    </div>
  );

  const ev = collab?.events;
  const role = ROLE_LABELS[collab?.role] || { label: collab?.role, desc: "", color: "#5a5a72" };

  if (step === "done" || step === "declined") return (
    <div style={{ ...S.page, textAlign: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{step === "done" ? "✅" : "👋"}</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>
          {step === "done" ? "You're already in!" : "Invitation Declined"}
        </h1>
        <p style={{ color: "#5a5a72", marginBottom: 24 }}>
          {step === "done" ? `You already have access to ${ev?.name}.` : "You've declined this collaboration invite."}
        </p>
        {step === "done" && <button onClick={() => navigate(`/dashboard/${collab.event_id}`)}
          style={{ background: "linear-gradient(135deg,#c9a84c,#a8872e)", border: "none", color: "#080810", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          Open Dashboard →
        </button>}
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 440, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
          <span style={{ fontSize: 14, color: "#5a5a72" }}>EventFlow</span>
        </div>

        <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.06),transparent)", borderBottom: "1px solid #1e1e2e", padding: "28px" }}>
            <div style={{ fontSize: 36, marginBottom: 14, textAlign: "center" }}>🤝</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, textAlign: "center", margin: "0 0 6px" }}>Collaboration Invite</h1>
            <p style={{ fontSize: 15, color: "#c9a84c", textAlign: "center", margin: 0 }}>{ev?.name}</p>
            {ev?.date && <p style={{ fontSize: 13, color: "#5a5a72", textAlign: "center", margin: "4px 0 0" }}>
              {new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>}
          </div>

          <div style={{ padding: "24px 28px" }}>
            <div style={{ background: "#13131f", border: `1px solid ${role.color}30`, borderRadius: 12, padding: "16px", marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Your role</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: role.color, marginBottom: 4 }}>{role.label}</div>
              <div style={{ fontSize: 13, color: "#5a5a72" }}>{role.desc}</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleDecision("declined")}
                style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#5a5a72", borderRadius: 10, padding: 13, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Decline
              </button>
              <button onClick={() => handleDecision("accepted")}
                style={{ flex: 2, background: "linear-gradient(135deg,#c9a84c,#a8872e)", border: "none", color: "#080810", borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Accept Invite →
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#3a3a52", textAlign: "center", marginTop: 12 }}>
              You'll be redirected to sign in if needed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
