// ============================================================
//  src/pages/Auth.jsx  —  Sign up / Sign in with magic link
// ============================================================
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/home" },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", color: "#e8e0d5", padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .field { background: #13131a; border: 1px solid #2a2a35; border-radius: 10px; padding: 14px 16px; color: #e8e0d5; font-size: 15px; width: 100%; outline: none; transition: border-color 0.2s; font-family: 'DM Sans'; }
        .field:focus { border-color: #d4a853; box-shadow: 0 0 0 3px rgba(212,168,83,0.1); }
        .field::placeholder { color: #3a3a45; }
        .btn { background: linear-gradient(135deg, #d4a853, #b8892f); color: #0a0a0f; border: none; padding: 14px; border-radius: 10px; font-family: 'DM Sans'; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; width: 100%; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(212,168,83,0.3); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #d4a853, #b8892f)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✦</div>
          <span style={{ fontFamily: "'Playfair Display'", fontSize: 24, color: "#e8e0d5" }}>EventFlow</span>
        </div>

        <div style={{ background: "#0f0f1a", border: "1px solid #1e1e2e", borderRadius: 16, padding: "36px 32px" }}>
          {!sent ? (
            <>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 26, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>
                Welcome
              </h1>
              <p style={{ color: "#5a5a68", fontSize: 14, textAlign: "center", marginBottom: 32, fontWeight: 300, lineHeight: 1.6 }}>
                Enter your email and we'll send you a magic link to sign in — no password needed.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Email Address</label>
                <input
                  className="field"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  autoFocus
                />
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ef4444" }}>
                  ⚠ {error}
                </div>
              )}

              <button className="btn" onClick={handleSubmit} disabled={loading || !email.trim()}>
                {loading ? "Sending…" : "Send Magic Link →"}
              </button>

              <p style={{ fontSize: 12, color: "#3a3a45", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
                New here? Just enter your email — an account will be created automatically.
              </p>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
              <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 22, marginBottom: 12 }}>Check your inbox</h2>
              <p style={{ color: "#5a5a68", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                We've sent a magic link to <strong style={{ color: "#d4a853" }}>{email}</strong>.<br />
                Click it to sign in and start planning your event.
              </p>
              <button onClick={() => { setSent(false); setEmail(""); }} style={{ background: "none", border: "none", color: "#5a5a68", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
