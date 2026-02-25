// ============================================================
//  Auth.jsx  —  Sign in / Sign up (magic link)
// ============================================================
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, getTheme, globalCSS, applyThemeToDOM } from "./theme";

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
    <div style={{ minHeight:"100vh", background:t.bg, display:"flex", fontFamily:t.font }}>
      <style>{globalCSS(t)}</style>

      {/* Left panel — decorative */}
      <div style={{ flex:1, background:`linear-gradient(145deg, ${t.accent} 0%, ${t.accent}dd 60%, ${t.accent}99 100%)`, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"52px 56px", minHeight:"100vh" }}
        className="auth-left">
        <style>{`.auth-left { display: flex; } @media(max-width:768px){.auth-left{display:none!important}}`}</style>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, background:"rgba(255,255,255,0.25)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <span style={{ fontSize:20, fontWeight:800, color:"white", letterSpacing:"-0.03em" }}>Oneonetix</span>
        </div>

        <div>
          <div style={{ fontSize:40, fontWeight:800, color:"white", letterSpacing:"-0.04em", lineHeight:1.15, marginBottom:16 }}>
            Plan unforgettable events.
          </div>
          <p style={{ color:"rgba(255,255,255,0.75)", fontSize:17, lineHeight:1.7, maxWidth:340, marginBottom:40 }}>
            Guests, budget, schedule, staff, tickets — everything you need, in one place.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {["Guest management & RSVPs","Budget tracking & vendors","Staff scheduling & timesheets","Ticketing with Stripe"].map(item => (
              <div key={item} style={{ display:"flex", alignItems:"center", gap:10, color:"rgba(255,255,255,0.85)", fontSize:15 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>© 2025 Oneonetix</p>
      </div>

      {/* Right panel — form */}
      <div style={{ width:"100%", maxWidth:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 40px", background:t.bg }}>
        <div style={{ width:"100%", maxWidth:380 }} className="ef-fade-up">

          {/* Mobile logo */}
          <div style={{ display:"none", alignItems:"center", gap:10, marginBottom:40, justifyContent:"center" }}>
            <style>{`@media(max-width:768px){.mob-logo{display:flex!important}}`}</style>
            <div className="mob-logo" style={{ display:"none", alignItems:"center", gap:10, marginBottom:40, justifyContent:"center", width:"100%" }}>
              <div style={{ width:32, height:32, background:t.accent, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style={{ fontSize:18, fontWeight:800, color:t.text, letterSpacing:"-0.03em" }}>Oneonetix</span>
            </div>
          </div>

          {!sent ? (
            <>
              <h1 style={{ fontSize:28, fontWeight:800, color:t.text, letterSpacing:"-0.04em", marginBottom:8 }}>Welcome back</h1>
              <p style={{ color:t.text2, fontSize:15, marginBottom:36, lineHeight:1.6 }}>
                Enter your email to receive a magic link — no password needed.
              </p>

              <div className="ef-form-row">
                <label className="ef-label">Email address</label>
                <input
                  className="ef-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  autoFocus
                  style={{ fontSize:15, padding:"12px 14px" }}
                />
              </div>

              {error && (
                <div style={{ background:"rgba(220,38,38,0.08)", border:"1.5px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"11px 14px", marginBottom:16, fontSize:13, color:"#dc2626", display:"flex", gap:8, alignItems:"center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button
                className="ef-btn ef-btn-lg"
                style={{ width:"100%", fontSize:15, padding:"13px" }}
                onClick={handleSubmit}
                disabled={loading || !email.trim()}
              >
                {loading ? "Sending…" : "Continue with email →"}
              </button>

              <p style={{ fontSize:13, color:t.text3, textAlign:"center", marginTop:20, lineHeight:1.7 }}>
                No account? One will be created automatically.
              </p>
            </>
          ) : (
            <div style={{ textAlign:"center" }} className="ef-fade-up">
              <div style={{ width:64, height:64, background:t.accentBg, border:`2px solid ${t.accentBorder}`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:28 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h2 style={{ fontSize:24, fontWeight:800, color:t.text, letterSpacing:"-0.03em", marginBottom:10 }}>Check your inbox</h2>
              <p style={{ color:t.text2, fontSize:15, lineHeight:1.7, marginBottom:28 }}>
                We sent a magic link to <strong style={{ color:t.accent }}>{email}</strong>.<br/>
                Click it to sign in and start planning.
              </p>
              <button onClick={() => { setSent(false); setEmail(""); }}
                style={{ background:"none", border:"none", color:t.text3, fontSize:14, cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}>
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
