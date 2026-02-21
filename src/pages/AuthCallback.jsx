// ============================================================
//  src/pages/AuthCallback.jsx
//  Handles the redirect after a guest clicks their invite email.
//  Supabase appends a token to the URL — we exchange it for a
//  session, then forward the guest to their RSVP page.
//  Route: /auth/callback
// ============================================================
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Exchange the token in the URL for a session
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        // Token may already be used or expired
        setError("This invite link has expired or already been used.");
        return;
      }

      // Forward to the intended page — either the RSVP page or /events
      const next = searchParams.get("next") || "/events";
      navigate(next, { replace: true });
    };

    handleCallback();
  }, []);

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", flexDirection: "column", gap: 14, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 36 }}>🔗</div>
      <div style={{ fontSize: 18, color: "#e2d9cc" }}>Link expired</div>
      <div style={{ fontSize: 14, color: "#5a5a72", lineHeight: 1.7, maxWidth: 340 }}>{error}<br/>Ask the organiser to send a fresh invite.</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", color: "#c9a84c", fontSize: 14 }}>
      Taking you to your invite…
    </div>
  );
}
