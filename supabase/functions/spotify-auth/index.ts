// ============================================================
//  supabase/functions/spotify-auth/index.ts
//  Handles Spotify OAuth callback and playlist export
//  Deploy: supabase functions deploy spotify-auth --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID")!;
const SPOTIFY_SECRET    = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
const APP_URL           = Deno.env.get("APP_URL") || "http://localhost:5173";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. EXCHANGE CODE FOR TOKENS ─────────────────────────
  if (action === "callback") {
    const code    = url.searchParams.get("code");
    const eventId = url.searchParams.get("state"); // we pass eventId as state
    if (!code || !eventId) return new Response("Missing code or state", { status: 400 });

    const redirectUri = `${APP_URL}/spotify-callback`;
    const body = new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_SECRET}`),
      },
      body,
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) return new Response(JSON.stringify(tokens), { status: 400, headers: cors });

    await supabase.from("spotify_tokens").upsert({
      event_id:      eventId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    Date.now() + tokens.expires_in * 1000,
    }, { onConflict: "event_id" });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // ── 2. GET / REFRESH TOKEN ───────────────────────────────
  if (action === "token") {
    const { eventId } = await req.json();
    const { data: row } = await supabase.from("spotify_tokens").select("*").eq("event_id", eventId).single();
    if (!row) return new Response(JSON.stringify({ error: "not_connected" }), { status: 200, headers: cors });

    // Refresh if expired (with 60s buffer)
    if (Date.now() > row.expires_at - 60_000) {
      const refreshRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_SECRET}`),
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
      });
      const refreshed = await refreshRes.json();
      if (!refreshRes.ok) return new Response(JSON.stringify({ error: "refresh_failed" }), { status: 200, headers: cors });

      await supabase.from("spotify_tokens").update({
        access_token: refreshed.access_token,
        expires_at:   Date.now() + refreshed.expires_in * 1000,
      }).eq("event_id", eventId);

      return new Response(JSON.stringify({ access_token: refreshed.access_token }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ access_token: row.access_token }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // ── 3. EXPORT PLAYLIST ───────────────────────────────────
  if (action === "export") {
    const { eventId, eventName, trackUris } = await req.json();
    if (!trackUris?.length) return new Response(JSON.stringify({ error: "No tracks to export" }), { status: 400, headers: cors });

    // Get token
    const { data: row } = await supabase.from("spotify_tokens").select("*").eq("event_id", eventId).single();
    if (!row) return new Response(JSON.stringify({ error: "not_connected" }), { status: 400, headers: cors });

    let accessToken = row.access_token;
    if (Date.now() > row.expires_at - 60_000) {
      const r = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_SECRET}`),
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
      });
      const refreshed = await r.json();
      accessToken = refreshed.access_token;
      await supabase.from("spotify_tokens").update({ access_token: accessToken, expires_at: Date.now() + refreshed.expires_in * 1000 }).eq("event_id", eventId);
    }

    // Get user ID
    const meRes  = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    const me     = await meRes.json();
    const userId = me.id;

    // Create playlist
    const plRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${eventName} — EventFlow`, description: "Created with EventFlow 🎵", public: false }),
    });
    const playlist = await plRes.json();

    // Add tracks in batches of 100
    for (let i = 0; i < trackUris.length; i += 100) {
      await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: trackUris.slice(i, i + 100) }),
      });
    }

    return new Response(JSON.stringify({ playlistUrl: playlist.external_urls.spotify, playlistId: playlist.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404 });
});
