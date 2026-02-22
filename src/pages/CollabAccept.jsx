// src/pages/CollabAccept.jsx  —  /collab/accept/:token
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function CollabAccept() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const [collab, setCollab] = useState(null);
  const [step,   setStep]   = useState("loading");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from("event_collaborators")
        .select("*, events(name,date,venue_name)")
        .eq("invite_token", token)
        .single();

      if (!data) { setStep("invalid"); return; }
      setCollab(data);

      // Already accepted — go straight to dashboard
      if (data.status === "accepted") {
        setStep("done");
        return;
      }

      // Check if user is signed in
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Signed in — stamp user_id and mark accepted immediately
        await supabase.from("event_collaborators").update({
          status:      "accepted",
          accepted_at: new Date().toISOString(),
          user_id:     user.id,
        }).eq("invite_token", token);
        setStep("accepted_redirect");
        setTimeout(() => navigate(`/dashboard/${data.event_id}`), 1500);
      } else {
        // Not signed in — show preview, store token in sessionStorage
        sessionStorage.setItem("pendingCollabToken", token);
        setStep("preview");
      }
    };
    init();
  }, [token]);

  // After login, complete acceptance if token stored
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const pendingToken = sessionStorage.getItem("pendingCollabToken");
      if (session?.user && pendingToken) {
        sessionStorage.removeItem("pendingCollabToken");
        await supabase.from("event_collaborators").update({
          status:      "accepted",
          accepted_at: new Date().toISOString(),
          user_id:     session.user.id,
        }).eq("invite_token", pendingToken);
        // Find the event and redirect
        const { data } = await supabase
          .from("event_collaborators").select("event_id").eq("invite_token", pendingToken).single();
        if (data) navigate(`/dashboard/${data.event_id}`);
        else navigate("/events");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleDecline = async () => {
    await supabase.from("event_collaborators").update({ status: "declined" }).eq("invite_token", token);
    setStep("declined");
  };

  const handleAccept = () => {
    // Will be completed after sign-in via onAuthStateChange above
    navigate("/login");
  };

  const ROLE_LABELS = {
    admin:     { label: "Admin",     desc: "Full access except transferring ownership", color: "#818cf8" },
    ticketing: { label: "Ticketing", desc: "Manage ticket tiers, orders and sales",     color: "#c9a84c" },
    check_in:  { label: "Check-in",  desc: "Scan tickets and manage guest arrivals",    color: "#10b981" },
    view_only: { label: "View Only", desc: "Read-only access to all sections",          color: "#5a5a72" },
  };

  const S = { page: { minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } };

  if (step === "loading") return <div style={S.page}><span style={{ color: "#3a3a52" }}>Loading…</span></div>;

  if (step === "accepted_redirect") return (
    <div style={{ ...S.page, textAlign: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div><div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>You're in!</h1>
      <p style={{ color: "#5a5a72" }}>Taking you to the event dashboard…</p></div>
    </div>
  );

  if (step === "invalid") return (
    <div style={{ ...S.page, textAlign: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div><div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <h1 style={{ fontFamily: "'Playfair Display',serif", color: "#ef4444" }}>Invalid Link</h1>
      <p style={{ color: "#5a5a72" }}>This invitation link is not valid or has expired.</p></div>
    </div>
  );

  if (step === "done" || step === "declined") return (
    <div style={{ ...S.page, textAlign: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{step === "done" ? "✅" : "👋"}</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>
          {step === "done" ? "You're already in!" : "Invitation Declined"}
        </h1>
        <p style={{ color: "#5a5a72", marginBottom: 24 }}>
          {step === "done" ? `You already have access to ${collab?.events?.name}.` : "You've declined this collaboration invite."}
        </p>
        {step === "done" && <button onClick={() => navigate(`/dashboard/${collab.event_id}`)}
          style={{ background: "linear-gradient(135deg,#c9a84c,#a8872e)", border: "none", color: "#080810", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          Open Dashboard →
        </button>}
      </div>
    </div>
  );

  const ev   = collab?.events;
  const role = ROLE_LABELS[collab?.role] || { label: collab?.role, desc: "", color: "#5a5a72" };

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 440, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#c9a84c,#a8872e)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#080810" }}>✦</div>
          <span style={{ fontSize: 14, color: "#5a5a72" }}>EventFlow</span>
        </div>

        <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.06),transparent)", borderBottom: "1px solid #1e1e2e", padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🤝</div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, margin: "0 0 6px" }}>Collaboration Invite</h1>
            <p style={{ fontSize: 15, color: "#c9a84c", margin: 0 }}>{ev?.name}</p>
            {ev?.date && <p style={{ fontSize: 13, color: "#5a5a72", margin: "4px 0 0" }}>
              {new Date(ev.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>}
          </div>

          <div style={{ padding: "24px 28px" }}>
            <div style={{ background: "#13131f", border: `1px solid ${role.color}40`, borderRadius: 12, padding: "16px", marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#5a5a72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Your role</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: role.color, marginBottom: 4 }}>{role.label}</div>
              <div style={{ fontSize: 13, color: "#5a5a72" }}>{role.desc}</div>
            </div>

            <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#8a8278" }}>
              You'll need to sign in or create an account to accept this invite.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleDecline}
                style={{ flex: 1, background: "none", border: "1px solid #1e1e2e", color: "#5a5a72", borderRadius: 10, padding: 13, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Decline
              </button>
              <button onClick={handleAccept}
                style={{ flex: 2, background: "linear-gradient(135deg,#c9a84c,#a8872e)", border: "none", color: "#080810", borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Accept → Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
