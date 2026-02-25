// ============================================================
//  Auth.jsx — Sign in / Sign up (magic link)
//  Styled to match Oneonetix brand aesthetic
// ============================================================
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { BRAND } from "./brand";
import { loadThemePrefs, getTheme, globalCSS, applyThemeToDOM } from "./theme";

const C = BRAND.colors;
const F = BRAND.fonts;

export default function Auth() {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [prefs,   setPrefs]   = useState(loadThemePrefs());

  useEffect(() => { applyThemeToDOM(prefs); }, [prefs]);
  const t = getTheme(prefs);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/home" },
      });
      if (error) throw error;
      setSent(true);
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.darkBg, display:"flex",
      fontFamily:F.body, color:C.darkText, overflow:"hidden" }}>
      <style>{globalCSS(t)}{`
        @keyframes authPulse {
          0%,100% { opacity:0.07; transform:scale(1); }
          50%      { opacity:0.13; transform:scale(1.06); }
        }
        @keyframes authSlideIn {
          from { opacity:0; transform:translateX(30px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .auth-right { animation: authSlideIn .45s ease both; }
        @media(max-width:900px) { .auth-left-panel { display:none!important; } }
      `}</style>

      {/* ── Left panel — bold brand statement ── */}
      <div className="auth-left-panel" style={{
        flex:1, position:"relative", overflow:"hidden",
        background:C.darkBgMid, display:"flex", flexDirection:"column",
        justifyContent:"space-between", padding:"52px 56px",
        borderRight:`1px solid ${C.darkBorder}`,
      }}>
        {/* Background glow */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:`radial-gradient(ellipse 70% 55% at 50% 40%, rgba(255,77,0,0.12) 0%, transparent 70%)` }}/>
        {/* Background grid */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          backgroundImage:`linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                           linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)`,
          backgroundSize:"60px 60px" }}/>
        {/* Big ghost text */}
        <div style={{ position:"absolute", bottom:"-2rem", right:"-1rem",
          fontFamily:F.display, fontSize:"22vw", color:"rgba(255,255,255,0.02)",
          lineHeight:1, pointerEvents:"none", userSelect:"none", whiteSpace:"nowrap" }}>
          ONX
        </div>

        {/* Logo */}
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontFamily:F.display, fontSize:"2.2rem", letterSpacing:"0.04em",
            lineHeight:1, color:C.darkText }}>
            ONE<span style={{ color:C.primary }}>O</span>NETIX
          </div>
        </div>

        {/* Hero text */}
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontFamily:F.condensed, fontSize:".78rem", fontWeight:700,
            letterSpacing:".22em", textTransform:"uppercase",
            color:C.primary, marginBottom:"1.2rem" }}>
            ⚡ Event Management Platform
          </div>
          <h2 style={{ fontFamily:F.display, fontSize:"clamp(3rem,5vw,5.5rem)",
            lineHeight:.95, letterSpacing:".01em", marginBottom:"1.5rem" }}>
            RUN YOUR<br/>
            <span style={{ color:C.primary }}>EVENT.</span><br/>
            OWN THE<br/>MOMENT.
          </h2>
          <p style={{ color:C.darkTextMuted, fontSize:"1rem", lineHeight:1.7,
            maxWidth:360, marginBottom:"2.5rem" }}>
            Guests, budget, schedule, staff, tickets — everything you need, in one place.
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              ["⚡","Virtual Queues & Real-time Management"],
              ["🎟️","Ticketing with Stripe Integration"],
              ["👥","Staff Scheduling & Timesheets"],
              ["🗺️","Site Maps & Operations Planning"],
            ].map(([icon,label])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:12,
                fontSize:".9rem", color:"rgba(245,240,232,0.75)" }}>
                <div style={{ width:28, height:28, borderRadius:"2px",
                  background:`rgba(255,77,0,0.12)`,
                  border:`1px solid rgba(255,77,0,0.25)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0, fontSize:13 }}>{icon}</div>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:"relative", zIndex:1, fontFamily:F.condensed,
          fontSize:".75rem", fontWeight:700, letterSpacing:".12em",
          textTransform:"uppercase", color:"rgba(255,255,255,0.2)" }}>
          {BRAND.copyright}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="auth-right" style={{
        width:"100%", maxWidth:520,
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"40px 48px", background:C.darkBg,
      }}>
        <div style={{ width:"100%", maxWidth:380 }}>

          {/* Mobile logo */}
          <div style={{ display:"none", marginBottom:40 }} className="mob-logo">
            <style>{`.mob-logo{display:none!important}@media(max-width:900px){.mob-logo{display:block!important}}`}</style>
            <div style={{ fontFamily:F.display, fontSize:"1.8rem", letterSpacing:"0.04em", color:C.darkText }}>
              ONE<span style={{ color:C.primary }}>O</span>NETIX
            </div>
          </div>

          {!sent ? (
            <>
              {/* Eyebrow */}
              <div style={{ fontFamily:F.condensed, fontSize:".72rem", fontWeight:700,
                letterSpacing:".2em", textTransform:"uppercase",
                color:C.primary, marginBottom:16 }}>
                Welcome back
              </div>

              <h1 style={{ fontFamily:F.display, fontSize:"3.5rem", lineHeight:.95,
                letterSpacing:".01em", color:C.darkText, marginBottom:12 }}>
                SIGN IN
              </h1>
              <p style={{ color:C.darkTextMuted, fontSize:".9rem", marginBottom:36, lineHeight:1.65 }}>
                Enter your email to receive a magic link — no password needed.
              </p>

              {error && (
                <div style={{ background:"rgba(239,68,68,0.08)", border:`1px solid rgba(239,68,68,0.25)`,
                  borderRadius:BRAND.radius, padding:"12px 16px",
                  color:"#fc8181", fontSize:13, marginBottom:20 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontFamily:F.condensed, fontSize:".72rem",
                  fontWeight:700, letterSpacing:".14em", textTransform:"uppercase",
                  color:C.darkTextMuted, marginBottom:8 }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  autoFocus
                  style={{
                    width:"100%", background:C.darkBgCard,
                    border:`1.5px solid ${C.darkBorder}`,
                    borderRadius:BRAND.radius,
                    padding:"14px 18px", color:C.darkText,
                    fontFamily:F.body, fontSize:15, outline:"none",
                    transition:"border-color .15s, box-shadow .15s",
                  }}
                  onFocus={e => { e.target.style.borderColor=C.primary; e.target.style.boxShadow=`0 0 0 3px rgba(255,77,0,0.12)`; }}
                  onBlur={e  => { e.target.style.borderColor=C.darkBorder; e.target.style.boxShadow="none"; }}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!email.trim() || loading}
                style={{
                  width:"100%", background:loading?"rgba(255,77,0,0.6)":C.primary,
                  border:"none", borderRadius:BRAND.radius,
                  padding:"15px", color:C.primaryText,
                  fontFamily:F.condensed, fontSize:".9rem", fontWeight:900,
                  letterSpacing:".1em", textTransform:"uppercase",
                  cursor: (!email.trim()||loading) ? "not-allowed" : "pointer",
                  transition:"background .15s, transform .1s",
                  opacity: (!email.trim()||loading) ? 0.5 : 1,
                }}
                onMouseEnter={e => { if(email.trim()&&!loading) e.target.style.background=C.primaryHover; }}
                onMouseLeave={e => { e.target.style.background=loading?"rgba(255,77,0,0.6)":C.primary; }}
              >
                {loading ? "Sending…" : "Send Magic Link →"}
              </button>

              <p style={{ marginTop:20, color:C.darkTextFaint, fontSize:12,
                textAlign:"center", lineHeight:1.6 }}>
                No account yet? Just enter your email — we'll create one automatically.
              </p>
            </>
          ) : (
            <div style={{ textAlign:"center" }}>
              <div style={{ width:72, height:72, borderRadius:BRAND.radius,
                background:`rgba(255,77,0,0.12)`, border:`2px solid ${C.primary}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:32, margin:"0 auto 28px" }}>✉️</div>
              <div style={{ fontFamily:F.condensed, fontSize:".72rem", fontWeight:700,
                letterSpacing:".2em", textTransform:"uppercase",
                color:C.primary, marginBottom:12 }}>Check your inbox</div>
              <h2 style={{ fontFamily:F.display, fontSize:"2.8rem", lineHeight:.95,
                letterSpacing:".01em", marginBottom:16 }}>
                LINK SENT
              </h2>
              <p style={{ color:C.darkTextMuted, fontSize:".9rem", lineHeight:1.7,
                maxWidth:300, margin:"0 auto 32px" }}>
                We sent a magic link to <strong style={{ color:C.darkText }}>{email}</strong>.
                Check your inbox and click the link to sign in.
              </p>
              <button onClick={()=>setSent(false)}
                style={{ background:"none", border:`1.5px solid ${C.darkBorder}`,
                  borderRadius:BRAND.radius, padding:"10px 22px",
                  fontFamily:F.condensed, fontSize:".8rem", fontWeight:700,
                  letterSpacing:".1em", textTransform:"uppercase",
                  color:C.darkTextMuted, cursor:"pointer" }}
                onMouseEnter={e => e.target.style.borderColor=C.primary}
                onMouseLeave={e => e.target.style.borderColor=C.darkBorder}>
                ← Try a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
