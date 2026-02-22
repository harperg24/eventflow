// ============================================================
//  src/pages/SpotifyCallback.jsx
//  Add route: <Route path="/spotify-callback" element={<SpotifyCallback />} />
// ============================================================
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function SpotifyCallback() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const [status, setStatus] = useState("Connecting to Spotify…");

  useEffect(() => {
    const code    = params.get("code");
    const eventId = params.get("state");
    const error   = params.get("error");

    if (error) { setStatus("Spotify connection cancelled."); setTimeout(() => navigate(`/dashboard/${eventId}`), 2000); return; }
    if (!code || !eventId) { setStatus("Invalid callback."); return; }

    const { data: { session } } = supabase.auth.getSession().then(async ({ data: { session } }) => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/spotify-auth?action=callback&code=${code}&state=${eventId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: SUPABASE_ANON } }
      );
      if (res.ok) {
        setStatus("Spotify connected! Redirecting…");
        setTimeout(() => navigate(`/dashboard/${eventId}?tab=playlist`), 1200);
      } else {
        setStatus("Connection failed. Please try again.");
      }
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🎵</div>
        <p style={{ color: "#e2d9cc", fontSize: 16 }}>{status}</p>
      </div>
    </div>
  );
}
