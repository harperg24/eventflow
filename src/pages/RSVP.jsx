// ============================================================
//  src/pages/RSVP.jsx  —  Public guest RSVP page
//  Route: /e/:slug
//
//  Flows:
//  A) Via invite link (?guest=id)  → identity pre-matched, fresh start
//  B) Via shared link (no ?guest)  → guest picker first, then RSVP
//  C) "Not on list"                → request form → awaiting approval
//
//  All listed guests: name+email+phone+dietary required on RSVP
//  Non-listed guests: submit request, host approves/rejects
// ============================================================
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, getTheme, globalCSS, applyThemeToDOM } from "./theme";

// ── Helpers ────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}
const TYPE_ICON = { gig:"🎸", ball:"🥂", party:"🎉", wedding:"💍", birthday:"🎂", corporate:"🏢", festival:"🎪", other:"✨" };

// ── CSS ────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); }
  ::selection { background: var(--accent); color: #fff; }
  ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: var(--border); }
  .rf { background: var(--bg3); border: 1.5px solid var(--border); border-radius: 10px; padding: 13px 16px; color: var(--text); font-size: 15px; width: 100%; outline: none; font-family: 'Plus Jakarta Sans',sans-serif; transition: border-color 0.2s; }
  .rf:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); }
  .rf::placeholder { color: var(--text3); }
  .rl { display: block; font-size: 12px; color: var(--text2); font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; }
  .sbtn { background: var(--accent); color: #fff; border: none; padding: 15px; border-radius: 12px; font-family: 'Plus Jakarta Sans',sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; width: 100%; transition: all 0.2s; }
  .sbtn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.88; }
  .sbtn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cbtn { flex: 1; padding: 16px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--bg3); cursor: pointer; font-family: 'Plus Jakarta Sans',sans-serif; font-size: 15px; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .cbtn.yes { color: #10b981; } .cbtn.yes:hover,.cbtn.yes.sel { border-color: #10b981; background: rgba(16,185,129,0.1); }
  .cbtn.no  { color: #ef4444; } .cbtn.no:hover, .cbtn.no.sel  { border-color: #ef4444; background: rgba(239,68,68,0.08); }
  .tab-btn { flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text2); font-family: 'Plus Jakarta Sans',sans-serif; font-size: 14px; cursor: pointer; transition: all 0.18s; }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
  .song-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; transition: background 0.15s; }
  .song-row:hover { background: var(--bg3); }
  .vbtn { background: var(--accentBg); border: 1px solid var(--accentBorder); border-radius: 8px; color: var(--accent); padding: 6px 14px; font-family: 'Plus Jakarta Sans',sans-serif; font-size: 12px; cursor: pointer; transition: all 0.15s; }
  .vbtn:hover { opacity: 0.85; }
  .vbadge { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; color: #10b981; padding: 6px 14px; font-family: 'Plus Jakarta Sans',sans-serif; font-size: 12px; }
  .poll-opt { width: 100%; padding: 13px 16px; background: var(--bg3); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-family: 'Plus Jakarta Sans',sans-serif; font-size: 14px; cursor: pointer; text-align: left; transition: all 0.18s; margin-bottom: 8px; position: relative; overflow: hidden; }
  .poll-opt:hover:not(:disabled) { border-color: var(--accentBorder); }
  .poll-opt.voted { border-color: var(--accent); background: var(--accentBg); cursor: default; }
  .poll-fill { position: absolute; top:0; left:0; bottom:0; background: var(--accentBg); transition: width 0.5s cubic-bezier(0.16,1,0.3,1); border-radius: 8px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .fu { animation: fadeUp 0.4s ease forwards; }
  @keyframes popIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
  .pi { animation: popIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
`;

// ── Field component ────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <style>{(() => { const p = loadThemePrefs(); applyThemeToDOM(p); return globalCSS(getTheme(p)); })()}</style>
      <label className="rl">{label}{required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}</label>
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function RSVP() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedGuestId = searchParams.get("guest");

  // Clear localStorage if arriving from a fresh invite link
  const storageKey = `ef_guest_${slug}`;
  const isFromInviteLink = !!preselectedGuestId;
  if (isFromInviteLink) {
    ["_token","_status","_name","_songvotes","_pollvotes"].forEach(k =>
      localStorage.removeItem(storageKey + k)
    );
  }

  // ── Data state ─────────────────────────────────────────
  const [event,     setEvent]     = useState(null);
  const [guestList, setGuestList] = useState([]);
  const [songs,     setSongs]     = useState([]);
  const [polls,     setPolls]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [removed,   setRemoved]   = useState(false);

  // ── Session state ──────────────────────────────────────
  const [guestToken,  setGuestToken]  = useState(() => isFromInviteLink ? null : localStorage.getItem(storageKey+"_token") || null);
  const [guestStatus, setGuestStatus] = useState(() => isFromInviteLink ? null : localStorage.getItem(storageKey+"_status") || null);
  const [guestName,   setGuestName]   = useState(() => isFromInviteLink ? "" : localStorage.getItem(storageKey+"_name") || "");
  const [selectedGuestId, setSelectedGuestId] = useState(preselectedGuestId || null);

  // ── Step: "picker" | "rsvp" | "details" | "done" | "request" | "requestDone" ──
  const [step, setStep] = useState(() => {
    if (isFromInviteLink) return "rsvp"; // validate after load
    if (guestStatus) return "done";
    return preselectedGuestId ? "rsvp" : "picker";
  });

  // ── RSVP form fields (required for all guests) ─────────
  const [rsvpChoice, setRsvpChoice] = useState(null);
  const [fName,      setFName]      = useState("");
  const [fEmail,     setFEmail]     = useState("");
  const [fPhone,     setFPhone]     = useState("");
  const [fDietary,   setFDietary]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState(null);

  // ── Request form fields (not-on-list flow) ─────────────
  const [rName,    setRName]    = useState("");
  const [rEmail,   setREmail]   = useState("");
  const [rPhone,   setRPhone]   = useState("");
  const [rMessage, setRMessage] = useState("");
  const [rSubmit,  setRSubmit]  = useState(false);
  const [rError,   setRError]   = useState(null);

  // ── Playlist / poll state ──────────────────────────────
  const [votedSongs, setVotedSongs] = useState([]);
  const [votedPolls, setVotedPolls] = useState([]);
  const [newSong,    setNewSong]    = useState({ title: "", artist: "" });
  const [songAdded,  setSongAdded]  = useState(false);
  const [spQuery,    setSpQuery]    = useState("");
  const [spResults,  setSpResults]  = useState([]);
  const [spSearching,setSpSearching]= useState(false);
  const [spToken,    setSpToken]    = useState(null);
  const [spPlaying,  setSpPlaying]  = useState(null);
  const [spAudio,    setSpAudio]    = useState(null);
  const [activeTab,  setActiveTab]  = useState("rsvp");

  // ── Load ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: ev, error } = await supabase
        .from("events").select("*").eq("invite_slug", slug).eq("is_published", true).single();
      if (error || !ev) { setNotFound(true); setLoading(false); return; }
      setEvent(ev);

      const [{ data: ss }, { data: ps }, { data: gl }] = await Promise.all([
        supabase.from("songs").select("*").eq("event_id", ev.id).eq("vetoed", false).order("votes", { ascending: false }),
        supabase.from("polls").select("*, poll_options(*)").eq("event_id", ev.id).eq("status", "open"),
        supabase.from("guests").select("id,name,email,phone,status,dietary,invite_token").eq("event_id", ev.id).order("name"),
      ]);
      setSongs(ss || []);
      setPolls(ps || []);
      setGuestList(gl || []);

      if (preselectedGuestId && gl) {
        const matched = gl.find(g => g.id === preselectedGuestId);
        if (matched) {
          setSelectedGuestId(matched.id);
          setGuestToken(matched.invite_token);
          // Load this guest's existing votes from DB so they persist across reloads
          const token = matched.invite_token;
          const [svRes, pvRes] = await Promise.all([
            supabase.from("song_votes").select("song_id").eq("voter_token", token),
            supabase.from("poll_votes").select("poll_option_id").eq("voter_token", token),
          ]);
          if (svRes.data) setVotedSongs(svRes.data.map((r) => r.song_id));
          if (pvRes.data) setVotedPolls(pvRes.data.map((r) => r.poll_option_id));
          setGuestName(matched.name || "");
          // Prefill all form fields from their existing data
          setFName(matched.name || "");
          setFEmail(matched.email || "");
          setFPhone(matched.phone || "");
          setFDietary(matched.dietary || "");
          if (matched.status !== "pending") {
            setGuestStatus(matched.status);
            setStep("done");
          } else {
            setStep("rsvp");
          }
        } else {
          setRemoved(true);
        }
      }

      setLoading(false);
    };
    load();
  }, [slug]);

  // ── Real-time ──────────────────────────────────────────
  useEffect(() => {
    if (!event) return;
    const s = supabase.channel(`rsvp_s_${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "songs", filter: `event_id=eq.${event.id}` }, () => {
        supabase.from("songs").select("*").eq("event_id", event.id).eq("vetoed", false).order("votes", { ascending: false }).then(({ data }) => data && setSongs(data));
      }).subscribe();
    const p = supabase.channel(`rsvp_p_${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_options" }, () => {
        supabase.from("polls").select("*, poll_options(*)").eq("event_id", event.id).eq("status", "open").then(({ data }) => data && setPolls(data));
      }).subscribe();
    return () => { supabase.removeChannel(s); supabase.removeChannel(p); };
  }, [event]);

  // ── Handlers ───────────────────────────────────────────

  const selectGuest = (g) => {
    setSelectedGuestId(g.id);
    setGuestToken(g.invite_token);
    setGuestName(g.name || "");
    setFName(g.name || "");
    setFEmail(g.email || "");
    setFPhone(g.phone || "");
    setFDietary(g.dietary || "");
    localStorage.setItem(storageKey + "_token", g.invite_token);
    localStorage.setItem(storageKey + "_name", g.name || "");
    // Load existing votes from DB so they persist across reloads
    Promise.all([
      supabase.from("song_votes").select("song_id").eq("voter_token", g.invite_token),
      supabase.from("poll_votes").select("poll_option_id").eq("voter_token", g.invite_token),
    ]).then(([svRes, pvRes]) => {
      if (svRes.data) setVotedSongs(svRes.data.map((r) => r.song_id));
      if (pvRes.data) setVotedPolls(pvRes.data.map((r) => r.poll_option_id));
    });
    setStep("rsvp");
  };

  const handleRSVP = async () => {
    // Validate required fields
    if (!fName.trim())  { setFormError("Please enter your name."); return; }
    if (!fEmail.trim()) { setFormError("Please enter your email."); return; }
    if (!rsvpChoice)    { setFormError("Please select attending or declined."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      let token = guestToken;
      if (token) {
        // Update existing guest row
        const { error } = await supabase.from("guests")
          .update({ status: rsvpChoice, name: fName.trim(), email: fEmail.trim(), phone: fPhone.trim() || null, dietary: fDietary.trim() || null })
          .eq("invite_token", token);
        if (error) throw error;
      } else {
        // Create new guest row (anonymous, not on list — shouldn't reach here but fallback)
        const { data: g, error } = await supabase.from("guests")
          .insert({ event_id: event.id, name: fName.trim(), email: fEmail.trim(), phone: fPhone.trim() || null, status: rsvpChoice, dietary: fDietary.trim() || null })
          .select().single();
        if (error) throw error;
        token = g.invite_token;
        setGuestToken(token);
        localStorage.setItem(storageKey + "_token", token);
      }
      setGuestStatus(rsvpChoice);
      setGuestName(fName.trim());
      localStorage.setItem(storageKey + "_status", rsvpChoice);
      localStorage.setItem(storageKey + "_name", fName.trim());
      setStep("done");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequest = async () => {
    if (!rName.trim())  { setRError("Name is required."); return; }
    if (!rEmail.trim()) { setRError("Email is required."); return; }
    setRSubmit(true); setRError(null);
    try {
      const { error } = await supabase.from("guest_requests").insert({
        event_id: event.id, name: rName.trim(), email: rEmail.trim(),
        phone: rPhone.trim() || null, message: rMessage.trim() || null,
      });
      if (error) throw error;
      setStep("requestDone");
    } catch (err) {
      setRError(err.message);
    } finally {
      setRSubmit(false);
    }
  };

  const handleVoteSong = async (songId) => {
    if (votedSongs.includes(songId) || !guestToken) return; // one vote per song per guest
    setSongs(ss => [...ss.map(s => s.id === songId ? { ...s, votes: s.votes + 1 } : s)].sort((a,b) => b.votes - a.votes));
    setVotedSongs(v => [...v, songId]);
    await supabase.rpc("cast_song_vote", { p_song_id: songId, p_voter_token: guestToken });
  };

  const [guestNowPlaying, setGuestNowPlaying] = useState(null);

  // Auto-advance when Spotify embed finishes
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== "https://open.spotify.com") return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "playback_update") {
          const { isPaused, position, duration } = data.payload || {};
          if (isPaused && duration > 0 && position >= duration - 0.5) {
            setGuestNowPlaying(current => {
              if (!current) return null;
              const idx = songs.findIndex(s => s.id === current.id);
              const next = songs[idx + 1];
              return next?.spotify_id ? next : null;
            });
          }
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [songs]);

  const playGuestSong = (song) => {
    if (!song.spotify_id) return;
    if (guestNowPlaying?.id === song.id) { setGuestNowPlaying(null); return; }
    setGuestNowPlaying(song);
  };

  const handleVotePoll = async (pollId, optionId) => {
    if (votedPolls.includes(pollId) || !guestToken) return;
    setPolls(ps => ps.map(p => p.id === pollId ? { ...p, poll_options: p.poll_options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o) } : p));
    setVotedPolls(v => [...v, pollId]);
    await supabase.rpc("cast_poll_vote", { p_option_id: optionId, p_voter_token: guestToken });
  };

  const handleAddSong = async () => {
    if (!newSong.title.trim() || !newSong.artist.trim()) return;
    await supabase.from("songs").insert({ event_id: event.id, title: newSong.title.trim(), artist: newSong.artist.trim(), added_by: guestName || "A guest" });
    setNewSong({ title: "", artist: "" });
    setSongAdded(true);
    setTimeout(() => setSongAdded(false), 3000);
  };

  // ── Spotify (guest search) ──────────────────────────────
  const searchSpotifyGuest = async (q) => {
    if (!q.trim()) { setSpResults([]); return; }
    setSpSearching(true);
    try {
      // Use the Spotify Web API with client credentials (public search, no auth needed for searches)
      // We'll proxy through a public token or use the event's token if available
      let token = spToken;
      if (!token) {
        const r = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `grant_type=client_credentials&client_id=${import.meta.env.VITE_SPOTIFY_CLIENT_ID}&client_secret=${import.meta.env.VITE_SPOTIFY_CLIENT_SECRET}`,
        });
        const d = await r.json();
        token = d.access_token;
        setSpToken(token);
      }
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=6`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSpResults(data.tracks?.items || []);
    } catch (e) { console.error(e); }
    finally { setSpSearching(false); }
  };

  const addSpotifySongGuest = async (track) => {
    const already = songs.some(s => s.spotify_id === track.id);
    if (already) return;
    await supabase.from("songs").insert({
      event_id:    event.id,
      title:       track.name,
      artist:      track.artists.map(a => a.name).join(", "),
      added_by:    guestName || "A guest",
      spotify_id:  track.id,
      spotify_uri: track.uri,
      preview_url: track.preview_url,
      artwork_url: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
      duration_ms: track.duration_ms,
    });
    setSpQuery("");
    setSpResults([]);
    setSongAdded(true);
    setTimeout(() => setSongAdded(false), 3000);
  };

  const toggleSpPreview = (track) => {
    if (spPlaying === track.id) {
      spAudio?.pause();
      setSpAudio(null);
      setSpPlaying(null);
      return;
    }
    spAudio?.pause();
    if (!track.preview_url) return;
    const audio = new Audio(track.preview_url);
    audio.volume = 0.6;
    audio.play();
    audio.onended = () => { setSpPlaying(null); setSpAudio(null); };
    setSpAudio(audio);
    setSpPlaying(track.id);
  };

  // ── Render helpers ─────────────────────────────────────
  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 24, height: 24, background: "var(--accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>✦</div>
      <span style={{ fontSize: 13, color: "var(--text2)", letterSpacing: "0.05em" }}>Oneonetix</span>
    </div>
  );

  // ── Special screens ────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14 }}>
      <style>{(() => { const p = loadThemePrefs(); applyThemeToDOM(p); return globalCSS(getTheme(p)); })()}</style>
      <style>{css}</style>Loading event…
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", flexDirection: "column", gap: 12, padding: 24, textAlign: "center" }}>
      <style>{(() => { const p = loadThemePrefs(); applyThemeToDOM(p); return globalCSS(getTheme(p)); })()}</style>
      <style>{css}</style>
      <div style={{ fontSize: 48 }}>✦</div>
      <div style={{ fontSize: 20, color: "var(--text)" }}>Event not found</div>
      <div style={{ fontSize: 14, color: "var(--text2)" }}>This invite link may have expired or been removed.</div>
    </div>
  );

  if (removed) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 24 }}>
      <style>{(() => { const p = loadThemePrefs(); applyThemeToDOM(p); return globalCSS(getTheme(p)); })()}</style>
      <style>{css}</style>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <div style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "40px 32px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontFamily: "inherit", fontSize: 26, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>You've been removed</h2>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, marginBottom: 20 }}>
            You are no longer on the guest list for <strong style={{ color: "var(--text)" }}>{event?.name}</strong>. This invite link is no longer valid.
          </p>
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#ef4444" }}>
            Contact the organiser if you think this is a mistake.
          </div>
        </div>
        <div style={{ marginTop: 24, fontSize: 12, color: "var(--border)" }}>Powered by <span style={{ color: "var(--accent)" }}>Oneonetix</span></div>
      </div>
    </div>
  );

  const meta = TYPE_ICON[event.type] || "✨";

  // ── Main page ──────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans',sans-serif", color: "var(--text)" }}>
      <style>{(() => { const p = loadThemePrefs(); applyThemeToDOM(p); return globalCSS(getTheme(p)); })()}</style>
      <style>{css}</style>

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--bg2)", borderBottom: "1.5px solid var(--border)" }}>
        
        <div style={{ maxWidth: 580, margin: "0 auto", padding: "52px 24px 44px" }}>
          <div style={{ marginBottom: 40 }}><Logo /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 36 }}>{meta}</span>
            <span style={{ fontSize: 12, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>{event.type}</span>
          </div>
          <h1 style={{ fontFamily: "inherit", fontSize: "clamp(32px,8vw,52px)", fontWeight: 600, lineHeight: 1.1, marginBottom: 20, color: "var(--text)" }}>{event.name}</h1>
          {event.description && <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.75, marginBottom: 28, fontWeight: 300 }}>{event.description}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            {[
              { icon: "📅", text: formatDate(event.date) },
              event.time && { icon: "⏰", text: formatTime(event.time) },
              event.venue_name && { icon: "📍", text: event.venue_name + (event.venue_address ? `, ${event.venue_address}` : "") },
              event.capacity && { icon: "👥", text: `Up to ${event.capacity} guests` },
            ].filter(Boolean).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text2)" }}>
                <span>{d.icon}</span><span>{d.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* Tab bar — only after attending confirmed */}
        {guestStatus === "attending" && (
          <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)", marginBottom: 32, marginTop: 8 }}>
            {[{ id:"rsvp", label:"Your RSVP" }, { id:"playlist", label:`Playlist (${songs.length})` }, { id:"polls", label:`Polls (${polls.length})` }].map(t => (
              <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
        )}

        {/* ── RSVP tab ── */}
        {(activeTab === "rsvp" || guestStatus !== "attending") && (
          <div style={{ paddingTop: guestStatus !== "attending" ? 40 : 0 }}>

            {/* STEP: picker — choose who you are */}
            {step === "picker" && (
              <div className="fu">
                <h2 style={{ fontFamily: "inherit", fontSize: 26, fontWeight: 600, marginBottom: 8 }}>Who are you?</h2>
                <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 20, fontWeight: 300 }}>Select your name from the guest list.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {guestList.map(g => {
                    const isPending = g.status === "pending";
                    return (
                      <button
                        key={g.id}
                        disabled={!isPending}
                        onClick={() => isPending && selectGuest(g)}
                        style={{
                          background: isPending ? "var(--bg3)" : "var(--bg2)",
                          border: `1.5px solid ${isPending ? "var(--border)" : "transparent"}`,
                          borderRadius: 12, padding: "14px 18px",
                          color: isPending ? "var(--text)" : "var(--text3)",
                          fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15,
                          cursor: isPending ? "pointer" : "not-allowed",
                          textAlign: "left", transition: "all 0.18s",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          opacity: isPending ? 1 : 0.45,
                        }}
                        onMouseEnter={e => { if (isPending) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accentBg)"; }}}
                        onMouseLeave={e => { if (isPending) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg3)"; }}}
                      >
                        <span>{g.name || <span style={{ color: "var(--text2)" }}>Guest</span>}</span>
                        {!isPending && (
                          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: g.status === "attending" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)", color: g.status === "attending" ? "#10b981" : "#ef4444" }}>
                            Already {g.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div style={{ borderTop: "1.5px solid var(--border)", paddingTop: 16, textAlign: "center" }}>
                  <button onClick={() => setStep("request")} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "color 0.15s" }} onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"} onMouseLeave={e => e.currentTarget.style.color = "var(--text2)"}>
                    I'm not on the list →
                  </button>
                </div>
              </div>
            )}

            {/* STEP: rsvp — attend or decline */}
            {step === "rsvp" && (
              <div className="fu">
                {/* Who they are banner */}
                {selectedGuestId && selectedGuestId !== "new" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, background: "var(--accentBg)", border: "1.5px solid var(--accentBorder)", borderRadius: 10, padding: "10px 16px" }}>
                    <span style={{ fontSize: 18 }}>👤</span>
                    <span style={{ fontSize: 14, color: "var(--accent)" }}>RSVPing as <strong>{fName || guestList.find(g => g.id === selectedGuestId)?.name || "Guest"}</strong></span>
                    {!isFromInviteLink && (
                      <button onClick={() => { setSelectedGuestId(null); setStep("picker"); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text2)", fontSize: 12, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Change</button>
                    )}
                  </div>
                )}
                <h2 style={{ fontFamily: "inherit", fontSize: 26, fontWeight: 600, marginBottom: 8 }}>Will you be there?</h2>
                <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24, fontWeight: 300 }}>Let the organiser know if you're coming.</p>
                <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
                  <button className={`cbtn yes${rsvpChoice === "attending" ? " sel" : ""}`} onClick={() => setRsvpChoice("attending")}><span style={{ fontSize: 28 }}>✓</span><span>Yes, I'm in!</span></button>
                  <button className={`cbtn no${rsvpChoice === "declined" ? " sel" : ""}`}  onClick={() => setRsvpChoice("declined")}><span style={{ fontSize: 28 }}>✗</span><span>Can't make it</span></button>
                </div>

                {/* Details fields — required for everyone */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                  <Field label="Full Name" required>
                    <input className="rf" placeholder="First and last name" value={fName} onChange={e => setFName(e.target.value)} />
                    {isFromInviteLink && fName && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Pre-filled from your invite — feel free to update</div>}
                  </Field>
                  <Field label="Email" required>
                    <input className="rf" type="email" placeholder="your@email.com" value={fEmail} onChange={e => setFEmail(e.target.value)} />
                  </Field>
                  <Field label="Phone" >
                    <input className="rf" type="tel" placeholder="+64 21 000 0000" value={fPhone} onChange={e => setFPhone(e.target.value)} />
                  </Field>
                  <Field label="Dietary Requirements">
                    <input className="rf" placeholder="e.g. Vegetarian, Gluten-free, None" value={fDietary} onChange={e => setFDietary(e.target.value)} />
                  </Field>
                </div>

                {formError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 14 }}>⚠ {formError}</div>}

                <div style={{ display: "flex", gap: 10 }}>
                  {!isFromInviteLink && <button onClick={() => setStep("picker")} style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", borderRadius: 12, padding: "14px", color: "var(--text2)", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, cursor: "pointer" }}>← Back</button>}
                  <button className="sbtn" style={{ flex: isFromInviteLink ? 1 : 2 }} onClick={handleRSVP} disabled={submitting || !rsvpChoice}>
                    {submitting ? "Submitting…" : rsvpChoice === "attending" ? "Confirm RSVP 🎉" : rsvpChoice === "declined" ? "Submit RSVP" : "Select attending or declined"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP: done */}
            {step === "done" && (
              <div className="pi" style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 52, marginBottom: 20 }}>{guestStatus === "attending" ? "🎉" : "😔"}</div>
                <h2 style={{ fontFamily: "inherit", fontSize: 28, fontWeight: 600, marginBottom: 10 }}>
                  {guestStatus === "attending" ? `You're in${guestName ? `, ${guestName.split(" ")[0]}` : ""}!` : "Thanks for letting us know."}
                </h2>
                <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, maxWidth: 340, margin: "0 auto 28px" }}>
                  {guestStatus === "attending" ? "We're excited to have you! Check out the playlist and polls." : "Sorry you can't make it. Change your mind? RSVP again below."}
                </p>
                {guestStatus === "attending"
                  ? <button className="sbtn" style={{ maxWidth: 240, margin: "0 auto" }} onClick={() => setActiveTab("playlist")}>View Playlist →</button>
                  : <button onClick={() => { setGuestStatus(null); setStep("rsvp"); localStorage.removeItem(storageKey+"_status"); }} style={{ background: "none", border: "1.5px solid var(--border)", borderRadius: 10, padding: "12px 24px", color: "var(--text2)", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, cursor: "pointer" }}>Change my RSVP</button>
                }
              </div>
            )}

            {/* STEP: request — not on list form */}
            {step === "request" && (
              <div className="fu">
                <button onClick={() => setStep("picker")} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  ← Back to guest list
                </button>
                <h2 style={{ fontFamily: "inherit", fontSize: 26, fontWeight: 600, marginBottom: 8 }}>Request to join</h2>
                <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24, fontWeight: 300 }}>
                  You're not on the guest list yet. Fill in your details and the organiser will review your request before you can RSVP.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                  <Field label="Full Name" required>
                    <input className="rf" placeholder="First and last name" value={rName} onChange={e => setRName(e.target.value)} />
                  </Field>
                  <Field label="Email" required>
                    <input className="rf" type="email" placeholder="your@email.com" value={rEmail} onChange={e => setREmail(e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <input className="rf" type="tel" placeholder="+64 21 000 0000" value={rPhone} onChange={e => setRPhone(e.target.value)} />
                  </Field>
                  <Field label="Message">
                    <textarea className="rf" rows={3} placeholder="Introduce yourself or explain your connection to the event…" value={rMessage} onChange={e => setRMessage(e.target.value)} style={{ resize: "vertical" }} />
                  </Field>
                </div>
                {rError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 14 }}>⚠ {rError}</div>}
                <button className="sbtn" onClick={handleRequest} disabled={rSubmit}>{rSubmit ? "Sending…" : "Send Request to Organiser"}</button>
              </div>
            )}

            {/* STEP: requestDone — awaiting approval */}
            {step === "requestDone" && (
              <div className="pi" style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 52, marginBottom: 20 }}>⏳</div>
                <h2 style={{ fontFamily: "inherit", fontSize: 26, fontWeight: 600, marginBottom: 10 }}>Request sent!</h2>
                <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, maxWidth: 360, margin: "0 auto" }}>
                  The organiser has been notified and will review your request. Once approved, you'll be able to RSVP. Check back soon!
                </p>
              </div>
            )}

          </div>
        )}

        {/* ── Playlist tab ── */}
        {activeTab === "playlist" && guestStatus === "attending" && (
          <div className="fu">
            <style>{`
              .sp-rf { background: var(--bg3); border: 1.5px solid var(--border); border-radius: 10px; padding: 11px 14px; color: var(--text); font-size: 14px; outline: none; font-family: 'Plus Jakarta Sans',sans-serif; width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
              .sp-rf:focus { border-color: #1db954; box-shadow: 0 0 0 3px rgba(29,185,84,0.1); }
              .sp-rf::placeholder { color: #2e2e42; }
              .sp-res { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; transition: background 0.15s; }
              .sp-res:hover { background: var(--bg3); }
              .sp-prev { width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(29,185,84,0.15); color: #1db954; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; }
              .sp-prev:hover, .sp-prev.on { background: rgba(29,185,84,0.3); }
              .sp-add-btn { background: rgba(29,185,84,0.12); border: 1px solid rgba(29,185,84,0.2); color: #1db954; border-radius: 7px; padding: 5px 11px; font-size: 12px; cursor: pointer; font-family: 'Plus Jakarta Sans',sans-serif; white-space: nowrap; transition: background 0.15s; }
              .sp-add-btn:hover { background: rgba(29,185,84,0.22); }
            `}</style>

            <h2 style={{ fontFamily: "inherit", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Playlist</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>
              Vote for your favourites · search Spotify to suggest a song
            </p>

            {/* Spotify search */}
            <div style={{ background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "16px", marginBottom: 22 }}>
              <div style={{ fontSize: 12, color: "#1db954", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.24-3.021-1.86-6.821-2.28-11.29-1.24-.418.1-.84-.16-.94-.579-.1-.421.16-.84.58-.941 4.9-1.12 9.1-.64 12.48 1.44.37.24.489.72.249 1.08zm1.47-3.27c-.301.47-.94.62-1.41.33-3.461-2.13-8.731-2.75-12.82-1.51-.511.16-1.05-.121-1.211-.63-.16-.51.121-1.05.631-1.21 4.671-1.42 10.47-.72 14.45 1.72.47.29.62.94.33 1.41l.031-.01zm.13-3.4c-4.15-2.461-11-2.69-14.96-1.49-.63.19-1.3-.16-1.49-.79-.19-.63.16-1.3.79-1.49 4.56-1.38 12.14-1.11 16.93 1.72.56.33.74 1.06.4 1.62-.33.56-1.06.74-1.62.4l-.05.03z"/></svg>
                Request a song from Spotify
              </div>
              <div style={{ position: "relative" }}>
                <input className="sp-rf" placeholder="Search songs or artists…"
                  value={spQuery}
                  onChange={e => { setSpQuery(e.target.value); searchSpotifyGuest(e.target.value); }} />
              </div>

              {/* Search results */}
              {(spSearching || spResults.length > 0) && (
                <div style={{ marginTop: 10 }}>
                  {spSearching && <div style={{ fontSize: 12, color: "var(--text3)", padding: "8px 12px" }}>Searching…</div>}
                  {spResults.map(track => {
                    const alreadyIn = songs.some(s => s.spotify_id === track.id);
                    const isOn      = spPlaying === track.id;
                    return (
                      <div key={track.id} className="sp-res">
                        {/* Art */}
                        <div style={{ width: 38, height: 38, borderRadius: 6, overflow: "hidden", background: "var(--border)", flexShrink: 0 }}>
                          {track.album?.images?.[2] && <img src={track.album.images[2].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artists.map(a => a.name).join(", ")}</div>
                        </div>
                        {/* Duration */}
                        <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>
                          {Math.floor(track.duration_ms/60000)}:{String(Math.floor((track.duration_ms%60000)/1000)).padStart(2,"0")}
                        </span>
                        {/* Preview */}
                        {track.preview_url && (
                          <button className={`sp-prev${isOn ? " on" : ""}`} onClick={() => toggleSpPreview(track)} title={isOn ? "Stop" : "Preview"}>
                            {isOn ? "■" : "▶"}
                          </button>
                        )}
                        {/* Add */}
                        {alreadyIn
                          ? <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>✓ On list</span>
                          : <button className="sp-add-btn" onClick={() => addSpotifySongGuest(track)}>+ Add</button>
                        }
                      </div>
                    );
                  })}
                </div>
              )}

              {songAdded && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(29,185,84,0.08)", border: "1px solid rgba(29,185,84,0.2)", borderRadius: 8, fontSize: 13, color: "#1db954", textAlign: "center" }}>
                  ✓ Song added to the list!
                </div>
              )}
            </div>

            {/* Spotify iframe player */}
            {guestNowPlaying?.spotify_id && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Now Playing</span>
                  <button onClick={() => setGuestNowPlaying(null)}
                    style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 16, cursor: "pointer", padding: 0 }}>×</button>
                </div>
                <iframe
                  src={`https://open.spotify.com/embed/track/${guestNowPlaying.spotify_id}?utm_source=generator&theme=0&autoplay=1`}
                  width="100%" height="80" frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{ borderRadius: 12, display: "block" }}
                />
              </div>
            )}

            {/* Song list */}
            {songs.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text3)", fontSize: 14 }}>No songs yet — be the first to suggest one!</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {songs.map((s, i) => {
                const isActive  = guestNowPlaying?.id === s.id;
                const voted     = votedSongs.includes(s.id);
                const mins      = s.duration_ms ? Math.floor(s.duration_ms/60000) : null;
                const secs      = s.duration_ms ? String(Math.floor((s.duration_ms%60000)/1000)).padStart(2,"0") : null;
                return (
                  <div key={s.id} className="song-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderRadius: 10, background: guestNowPlaying?.id === s.id ? "rgba(29,185,84,0.04)" : "transparent", transition: "background 0.15s" }}>
                    <div style={{ width: 22, textAlign: "center", fontSize: 12, color: i === 0 ? "var(--accent)" : "var(--text3)", fontWeight: 700, flexShrink: 0 }}>{i+1}</div>

                    {/* Artwork — click to play */}
                    <div onClick={() => playGuestSong(s)}
                      style={{ width: 42, height: 42, borderRadius: 7, overflow: "hidden", background: "var(--bg3)", flexShrink: 0, position: "relative", cursor: s.spotify_id ? "pointer" : "default" }}>
                      {s.artwork_url
                        ? <img src={s.artwork_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--text3)" }}>♪</div>
                      }
                      {guestNowPlaying?.id === s.id && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(29,185,84,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#1db954", fontSize: 13 }}>♫</span>
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.artist}</div>
                    </div>

                    {mins !== null && <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>{mins}:{secs}</span>}

                    {s.spotify_id && (
                      <button className={`sp-prev${guestNowPlaying?.id === s.id ? " on" : ""}`}
                        onClick={() => playGuestSong(s)}
                        title={guestNowPlaying?.id === s.id ? "Close player" : "Play in Spotify"}>
                        {guestNowPlaying?.id === s.id ? "■" : "▶"}
                      </button>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, minWidth: 20, textAlign: "right" }}>{s.votes}</span>
                      {voted
                        ? <span className="vbadge" title="You've already voted for this song">✓ Voted</span>
                        : <button className="vbtn" onClick={() => handleVoteSong(s.id)} title="Vote once per song">▲</button>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Polls tab ── */}
        {activeTab === "polls" && guestStatus === "attending" && (
          <div className="fu">
            <h2 style={{ fontFamily: "inherit", fontSize: 24, fontWeight: 600, marginBottom: 6 }}>Polls</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 28 }}>Your vote shapes the event.</p>
            {polls.length === 0 && <div style={{ textAlign: "center", padding: "32px", color: "var(--text3)", fontSize: 14 }}>No polls open right now.</div>}
            {polls.map(poll => {
              const opts  = poll.poll_options || [];
              const total = opts.reduce((s, o) => s + (o.votes || 0), 0);
              const voted = votedPolls.includes(poll.id);
              return (
                <div key={poll.id} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>{poll.question}</div>
                  {opts.map(opt => {
                    const pct = total ? Math.round((opt.votes / total) * 100) : 0;
                    return (
                      <button key={opt.id} className={`poll-opt${voted ? " voted" : ""}`} onClick={() => !voted && handleVotePoll(poll.id, opt.id)} disabled={voted}>
                        <div className="poll-fill" style={{ width: voted ? `${pct}%` : "0%" }} />
                        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{opt.label}</span>
                          {voted && <span style={{ fontSize: 12, color: "var(--accent)" }}>{pct}%</span>}
                        </div>
                      </button>
                    );
                  })}
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{total} vote{total !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px", borderTop: "1.5px solid var(--border)", fontSize: 12, color: "var(--text3)" }}>
        Powered by <span style={{ color: "var(--accent)" }}>Oneonetix</span>
      </div>
    </div>
  );
}
