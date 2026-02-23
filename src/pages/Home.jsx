// ============================================================
//  Home.jsx  —  App homescreen with settings
//  Route: /home  (after auth, replaces /events as landing)
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const ACCENT_PRESETS = [
  { name: "Indigo",    value: "#4f46e5" },
  { name: "Blue",      value: "#2563eb" },
  { name: "Emerald",   value: "#059669" },
  { name: "Amber",     value: "#d97706" },
  { name: "Rose",      value: "#e11d48" },
  { name: "Violet",    value: "#7c3aed" },
  { name: "Slate",     value: "#475569" },
  { name: "Custom",    value: null },
];

function usePrefs() {
  const [prefs, setPrefs] = useState({ theme_accent:"#4f46e5", display_name:"", avatar_emoji:"◈" });
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase.from("user_preferences").select("*").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data) setPrefs(p => ({ ...p, ...data }));
          else setPrefs(p => ({ ...p, display_name: user.email?.split("@")[0] || "" }));
        });
    });
  }, []);

  const save = async (updates) => {
    if (!userId) return;
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    await supabase.from("user_preferences").upsert({ user_id: userId, ...newPrefs, updated_at: new Date().toISOString() });
    // Apply accent CSS variable globally
    document.documentElement.style.setProperty("--accent", newPrefs.theme_accent);
  };

  return { prefs, save };
}

export function useAccent() {
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("user_preferences").select("theme_accent").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data?.theme_accent) document.documentElement.style.setProperty("--accent", data.theme_accent);
        });
    });
  }, []);
}

export default function Home() {
  const navigate = useNavigate();
  const { prefs, save } = usePrefs();
  const [tab, setTab] = useState("home"); // home | settings
  const [events, setEvents] = useState([]);
  const [collabEvents, setCollabEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [customAccent, setCustomAccent] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", prefs.theme_accent);
  }, [prefs.theme_accent]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setUser(user);
      setNameInput(prefs.display_name || user.email?.split("@")[0] || "");

      const [{ data: owned }, { data: collabsById }, { data: collabsByEmail }] = await Promise.all([
        supabase.from("events").select("*").eq("organiser_id", user.id).order("date", { ascending: true }),
        supabase.from("event_collaborators").select("*, events(*)").eq("user_id", user.id).eq("status", "accepted"),
        supabase.from("event_collaborators").select("*, events(*)").eq("email", user.email).eq("status", "accepted"),
      ]);
      setEvents(owned || []);

      const seen = new Set();
      const merged = [...(collabsById||[]), ...(collabsByEmail||[])]
        .filter(c => c.events && !seen.has(c.events.id) && seen.add(c.events.id))
        .map(c => ({ ...c.events, _role: c.role }));
      setCollabEvents(merged.filter(e => !(owned||[]).find(o => o.id === e.id)));
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => { setNameInput(prefs.display_name || ""); }, [prefs.display_name]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate("/");
  };

  const upcoming = events.filter(e => new Date(e.date) >= new Date()).slice(0, 3);
  const past     = events.filter(e => new Date(e.date) < new Date());
  const allCollab = collabEvents;

  // ── Style tokens ─────────────────────────────────────────
  const accent = prefs.theme_accent;
  const S = {
    page:    { minHeight:"100vh", background:"#0f0f11", color:"#f0eff4", fontFamily:"'Inter','Helvetica Neue',sans-serif", fontSize:14 },
    sidebar: { width:220, background:"#0a0a0c", borderRight:"1px solid #1c1c20", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:20 },
    main:    { marginLeft:220, padding:"40px 48px", minHeight:"100vh" },
    card:    { background:"#16161a", border:"1px solid #222228", borderRadius:12 },
    btn:     { background:accent, border:"none", color:"#fff", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"opacity 0.15s" },
    btnGhost:{ background:"none", border:"1px solid #222228", color:"#9998a8", borderRadius:8, padding:"9px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    label:   { display:"block", fontSize:11, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 },
    input:   { width:"100%", boxSizing:"border-box", background:"#1c1c20", border:"1px solid #2a2a30", borderRadius:8, padding:"10px 13px", color:"#f0eff4", fontSize:13, outline:"none", fontFamily:"inherit", transition:"border-color 0.15s" },
  };

  const EventCard = ({ ev, role }) => {
    const d = new Date(ev.date);
    const isPast = d < new Date();
    const daysLeft = Math.ceil((d - new Date()) / 86400000);
    return (
      <div onClick={() => navigate(`/dashboard/${ev.id}`)}
        style={{ ...S.card, padding:"18px 20px", cursor:"pointer", display:"flex", gap:16, alignItems:"center", transition:"border-color 0.15s", borderColor:"#222228" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = accent + "60"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "#222228"}>
        <div style={{ width:44, height:44, borderRadius:10, background: isPast ? "#1c1c20" : `${accent}15`, border:`1px solid ${isPast ? "#222228" : accent + "30"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {ev.type === "wedding" ? "◇" : ev.type === "corporate" ? "▣" : ev.type === "festival" ? "◈" : ev.type === "gig" ? "♫" : "◆"}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>{ev.name}</div>
          <div style={{ fontSize:12, color:"#6b6a7a" }}>
            {d.toLocaleDateString("en-NZ", { day:"numeric", month:"short", year:"numeric" })}
            {ev.venue_name && ` · ${ev.venue_name}`}
          </div>
        </div>
        <div style={{ flexShrink:0, textAlign:"right" }}>
          {role && <div style={{ fontSize:11, color: accent, background:`${accent}15`, border:`1px solid ${accent}30`, borderRadius:20, padding:"2px 8px", marginBottom:4 }}>{role.replace("_"," ")}</div>}
          <div style={{ fontSize:11, color: isPast ? "#6b6a7a" : daysLeft <= 1 ? "#22c55e" : daysLeft <= 7 ? "#f59e0b" : "#6b6a7a" }}>
            {isPast ? "Past" : daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d away`}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div style={{...S.page, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{ color:"#6b6a7a", fontSize:13 }}>Loading…</div>
    </div>
  );

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        * { box-sizing: border-box; }
        :root { --accent: ${accent}; }
        .home-nav-btn { background:none; border:none; width:100%; display:flex; align-items:center; gap:10px; padding:9px 16px; border-radius:8px; font-size:13px; font-family:inherit; color:#9998a8; cursor:pointer; transition:all 0.12s; text-align:left; }
        .home-nav-btn:hover { background:#1c1c20; color:#f0eff4; }
        .home-nav-btn.active { background:${accent}18; color:${accent}; font-weight:600; }
        input:focus { border-color: ${accent} !important; }
        .hover-card:hover { border-color: ${accent}60 !important; }
      `}</style>

      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={{ padding:"24px 20px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`${accent}20`, border:`1px solid ${accent}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:accent, fontWeight:700 }}>E</div>
            <span style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.02em" }}>EventFlow</span>
          </div>

          <button onClick={() => setTab("home")} className={`home-nav-btn${tab==="home"?" active":""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </button>
          <button onClick={() => navigate("/events")} className="home-nav-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            All Events
          </button>
          <button onClick={() => { navigate("/create"); }} className="home-nav-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            New Event
          </button>
        </div>

        <div style={{ flex:1 }}/>

        <div style={{ padding:"16px 20px", borderTop:"1px solid #1c1c20" }}>
          <button onClick={() => setTab("settings")} className={`home-nav-btn${tab==="settings"?" active":""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M19.07 4.93A10 10 0 1 1 4.93 19.07"/></svg>
            Settings
          </button>
          <button onClick={handleSignOut} disabled={signingOut} className="home-nav-btn" style={{ color:"#ef4444", opacity:signingOut?0.5:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12, padding:"10px 8px" }}>
            <div style={{ width:28, height:28, borderRadius:6, background:`${accent}20`, border:`1px solid ${accent}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:accent, fontWeight:700, flexShrink:0 }}>
              {(prefs.display_name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prefs.display_name || user?.email?.split("@")[0]}</div>
              <div style={{ fontSize:11, color:"#6b6a7a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>

        {/* ── HOME TAB ── */}
        {tab === "home" && (
          <div style={{ maxWidth:760 }}>
            <div style={{ marginBottom:36 }}>
              <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em", marginBottom:6 }}>
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {prefs.display_name || user?.email?.split("@")[0]} 👋
              </h1>
              <p style={{ color:"#6b6a7a", fontSize:14 }}>
                {events.length === 0 ? "You have no events yet. Create your first one below." : `You have ${upcoming.length} upcoming event${upcoming.length !== 1 ? "s" : ""}.`}
              </p>
            </div>

            {/* Quick stats */}
            {events.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:36 }}>
                {[
                  ["Total Events", events.length, "◆"],
                  ["Upcoming",     upcoming.length, "◈"],
                  ["Collaborating",allCollab.length, "◉"],
                ].map(([label, val, icon]) => (
                  <div key={label} style={{...S.card, padding:"20px 22px"}}>
                    <div style={{ fontSize:20, color: accent, marginBottom:8, fontWeight:300 }}>{icon}</div>
                    <div style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em", marginBottom:4 }}>{val}</div>
                    <div style={{ fontSize:12, color:"#6b6a7a" }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming events */}
            {upcoming.length > 0 && (
              <div style={{ marginBottom:32 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <h2 style={{ fontSize:15, fontWeight:600, letterSpacing:"-0.01em" }}>Upcoming</h2>
                  <button onClick={() => navigate("/events")} style={{ background:"none", border:"none", color: accent, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>View all →</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
              </div>
            )}

            {/* Collaborating */}
            {allCollab.length > 0 && (
              <div style={{ marginBottom:32 }}>
                <h2 style={{ fontSize:15, fontWeight:600, letterSpacing:"-0.01em", marginBottom:14 }}>Collaborating On</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {allCollab.map(ev => <EventCard key={ev.id} ev={ev} role={ev._role} />)}
                </div>
              </div>
            )}

            {/* Empty state */}
            {events.length === 0 && allCollab.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ width:64, height:64, borderRadius:16, background:`${accent}12`, border:`1px solid ${accent}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 20px", color:accent }}>◆</div>
                <div style={{ fontSize:18, fontWeight:600, marginBottom:8, letterSpacing:"-0.02em" }}>No events yet</div>
                <div style={{ color:"#6b6a7a", marginBottom:24, fontSize:14 }}>Create your first event to get started.</div>
                <button style={S.btn} onClick={() => navigate("/create")}>Create Event</button>
              </div>
            )}

            {events.length > 0 && (
              <button style={S.btn} onClick={() => navigate("/create")}>+ New Event</button>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <div style={{ maxWidth:600 }}>
            <div style={{ marginBottom:32 }}>
              <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:6 }}>Settings</h1>
              <p style={{ color:"#6b6a7a", fontSize:14 }}>Manage your account and application preferences.</p>
            </div>

            {/* Profile */}
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:13, fontWeight:600, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Profile</h2>
              <div style={{...S.card, padding:"20px 22px"}}>
                <div style={{ marginBottom:16 }}>
                  <label style={S.label}>Display Name</label>
                  <div style={{ display:"flex", gap:10 }}>
                    <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your name" style={{...S.input, flex:1}}/>
                    <button onClick={async () => { setSavingName(true); await save({ display_name: nameInput }); setSavingName(false); }} style={{...S.btn, whiteSpace:"nowrap", opacity:savingName?0.6:1}} disabled={savingName}>
                      {savingName ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={S.label}>Email</label>
                  <div style={{ fontSize:13, color:"#6b6a7a", padding:"10px 0" }}>{user?.email}</div>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:13, fontWeight:600, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Appearance</h2>
              <div style={{...S.card, padding:"20px 22px"}}>
                <label style={S.label}>Accent Colour</label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                  {ACCENT_PRESETS.filter(p => p.value).map(p => (
                    <button key={p.value} onClick={() => save({ theme_accent: p.value })}
                      title={p.name}
                      style={{ width:32, height:32, borderRadius:8, background:p.value, border:`2px solid ${prefs.theme_accent===p.value ? "#fff" : "transparent"}`, cursor:"pointer", transition:"transform 0.1s", outline:"none" }}
                      onMouseEnter={e => e.currentTarget.style.transform="scale(1.15)"}
                      onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
                    />
                  ))}
                </div>
                <label style={S.label}>Custom Hex Colour</label>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <input type="color" value={prefs.theme_accent} onChange={e => save({ theme_accent: e.target.value })}
                    style={{ width:36, height:36, padding:0, border:"1px solid #2a2a30", borderRadius:6, background:"none", cursor:"pointer" }}/>
                  <input value={prefs.theme_accent} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setCustomAccent(e.target.value); }}
                    onBlur={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) save({ theme_accent: e.target.value }); }}
                    placeholder="#4f46e5" style={{...S.input, flex:1, fontFamily:"'Courier New',monospace", fontSize:12}}/>
                </div>

                <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid #1c1c20" }}>
                  <label style={S.label}>Preview</label>
                  <div style={{ display:"flex", gap:10 }}>
                    <button style={{ ...S.btn, fontSize:12, padding:"8px 14px" }}>Primary Button</button>
                    <div style={{ padding:"8px 14px", background:`${prefs.theme_accent}15`, border:`1px solid ${prefs.theme_accent}30`, borderRadius:8, color:prefs.theme_accent, fontSize:12, fontWeight:600 }}>Badge Style</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications placeholder */}
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:13, fontWeight:600, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Notifications</h2>
              <div style={{...S.card, padding:"20px 22px"}}>
                {[["Event reminders", "Get notified before your events"],["RSVP updates","When guests respond to invites"],["Collaboration requests","When someone invites you to collaborate"]].map(([title, desc]) => (
                  <div key={title} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1c1c20" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{title}</div>
                      <div style={{ fontSize:12, color:"#6b6a7a" }}>{desc}</div>
                    </div>
                    <div style={{ width:36, height:20, borderRadius:10, background:"#2a2a30", cursor:"not-allowed", opacity:0.5, position:"relative" }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", background:"#6b6a7a", position:"absolute", top:3, left:3 }}/>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize:12, color:"#6b6a7a", marginTop:12 }}>Email notifications coming soon.</div>
              </div>
            </div>

            {/* Danger zone */}
            <div>
              <h2 style={{ fontSize:13, fontWeight:600, color:"#ef444460", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Account</h2>
              <div style={{...S.card, padding:"20px 22px", borderColor:"#2a1a1a"}}>
                <button onClick={handleSignOut} style={{ background:"none", border:"1px solid #3a2020", color:"#ef4444", borderRadius:8, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Sign out of EventFlow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
