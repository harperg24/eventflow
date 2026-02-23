// ============================================================
//  Home.jsx  —  App homescreen + settings
//  Route: /home
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, saveThemePrefs, getTheme, globalCSS, ACCENTS, applyThemeToDOM } from "./theme";

// Hook that other pages can import to apply the saved theme on mount
export function useAppTheme() {
  const [prefs, setPrefs] = useState(loadThemePrefs);
  useEffect(() => { applyThemeToDOM(prefs); }, [prefs]);
  const update = (updates) => {
    const next = { ...prefs, ...updates };
    setPrefs(next);
    saveThemePrefs(next);
  };
  return [prefs, update, getTheme(prefs)];
}

const TYPE_ICONS = {
  gig:"♫", ball:"◇", party:"◆", wedding:"◇", birthday:"◆", corporate:"▣", festival:"◈", other:"◆",
};

function daysUntil(ds) {
  const d = Math.ceil((new Date(ds) - new Date()) / 86400000);
  if (d < 0)  return { label:"Past",      cls:"muted" };
  if (d === 0) return { label:"Today",    cls:"success" };
  if (d === 1) return { label:"Tomorrow", cls:"warning" };
  if (d <= 7)  return { label:`${d}d`,    cls:"warning" };
  return { label:`${d}d`,               cls:"muted" };
}

function NavItem({ icon, label, active, onClick, danger }) {
  return (
    <button className={`ef-nav-item${active?" active":""}`} onClick={onClick}
      style={{ color: danger ? "var(--danger)" : undefined }}>
      <span className="nav-icon">{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, sub, t }) {
  return (
    <div className="ef-card" style={{ padding:"20px 22px" }}>
      <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.04em", color:t.text, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:14, fontWeight:600, color:t.text2, marginBottom:2 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:t.text3 }}>{sub}</div>}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [prefs, updatePrefs, t] = useAppTheme();
  const [tab,   setTab]   = useState("home");
  const [user,  setUser]  = useState(null);
  const [events,      setEvents]      = useState([]);
  const [collabEvents,setCollabEvents] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [savingName,  setSavingName]  = useState(false);
  const [nameDirty,   setNameDirty]   = useState(false);
  const [customHex,   setCustomHex]   = useState(prefs.accent);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setUser(user);

      // Load user prefs from Supabase too (sync across devices)
      const { data: up } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).single();
      if (up) {
        const merged = { ...prefs, accent: up.theme_accent || prefs.accent, display_name: up.display_name || "" };
        updatePrefs(merged);
        setDisplayName(up.display_name || user.email?.split("@")[0] || "");
      } else {
        setDisplayName(user.email?.split("@")[0] || "");
      }

      const [{ data: owned }, { data: cById }, { data: cByEmail }] = await Promise.all([
        supabase.from("events").select("*").eq("organiser_id", user.id).order("date", { ascending: true }),
        supabase.from("event_collaborators").select("*, events(*)").eq("user_id", user.id).eq("status","accepted"),
        supabase.from("event_collaborators").select("*, events(*)").eq("email", user.email).eq("status","accepted"),
      ]);
      setEvents(owned || []);
      const seen = new Set();
      const merged = [...(cById||[]),...(cByEmail||[])]
        .filter(c => c.events && !seen.has(c.events.id) && seen.add(c.events.id))
        .map(c => ({ ...c.events, _role: c.role }));
      setCollabEvents(merged.filter(e => !(owned||[]).find(o => o.id === e.id)));
      setLoading(false);
    };
    load();
  }, []);

  const saveName = async () => {
    if (!user) return;
    setSavingName(true);
    await supabase.from("user_preferences").upsert({ user_id: user.id, display_name: displayName, theme_accent: prefs.accent, updated_at: new Date().toISOString() });
    updatePrefs({ display_name: displayName });
    setSavingName(false); setNameDirty(false);
  };

  const handleAccent = (hex) => {
    updatePrefs({ accent: hex });
    setCustomHex(hex);
    if (user) supabase.from("user_preferences").upsert({ user_id: user.id, theme_accent: hex, updated_at: new Date().toISOString() });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past     = events.filter(e => new Date(e.date) < now);

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = prefs.display_name || user?.email?.split("@")[0] || "there";

  // ── Sidebar SVG icons
  const icons = {
    home:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    events:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    new:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    out:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:t.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:t.font }}>
      <style>{globalCSS(t)}</style>
      <div style={{ color:t.text3, fontSize:14 }}>Loading…</div>
    </div>
  );

  return (
    <div className="ef-layout" style={{ fontFamily:t.font }}>
      <style>{globalCSS(t)}</style>

      {/* ── Sidebar ── */}
      <aside className="ef-sidebar">
        {/* Brand */}
        <div style={{ padding:"24px 20px 20px", borderBottom:`1.5px solid ${t.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, background:t.accent, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span style={{ fontSize:16, fontWeight:800, letterSpacing:"-0.03em", color:t.text }}>EventFlow</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding:"16px 12px", flex:1 }}>
          <div className="ef-section-label" style={{ paddingLeft:4, marginBottom:8 }}>Navigation</div>
          <NavItem icon={icons.home}   label="Home"       active={tab==="home"}     onClick={()=>setTab("home")} />
          <NavItem icon={icons.events} label="All Events" active={false}            onClick={()=>navigate("/events")} />
          <NavItem icon={icons.new}    label="New Event"  active={false}            onClick={()=>navigate("/create")} />
        </nav>

        {/* Bottom */}
        <div style={{ padding:"12px 12px 16px", borderTop:`1.5px solid ${t.border}` }}>
          <NavItem icon={icons.settings} label="Settings"  active={tab==="settings"} onClick={()=>setTab("settings")} />
          <NavItem icon={icons.out}      label="Sign Out"  onClick={handleSignOut}   danger />
          {/* User chip */}
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 8px", marginTop:8, background:t.bg3, borderRadius:9 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:t.accentBg, border:`1.5px solid ${t.accentBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:t.accent, flexShrink:0 }}>
              {name[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
              <div style={{ fontSize:11, color:t.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="ef-main">
        <div className="ef-content ef-fade-up">

          {/* ────── HOME TAB ────── */}
          {tab === "home" && (
            <div style={{ maxWidth:740 }}>
              <div style={{ marginBottom:40 }}>
                <h1 style={{ fontSize:32, fontWeight:800, letterSpacing:"-0.04em", color:t.text, marginBottom:6 }}>
                  {greeting}, {name} 👋
                </h1>
                <p style={{ color:t.text2, fontSize:16 }}>
                  {upcoming.length === 0 ? "No upcoming events — create one to get started." : `You have ${upcoming.length} upcoming event${upcoming.length!==1?"s":""}.`}
                </p>
              </div>

              {/* Stats */}
              {events.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:40 }}>
                  <StatCard label="Total Events"   value={events.length}       sub={`${past.length} past`}       t={t}/>
                  <StatCard label="Upcoming"        value={upcoming.length}     sub="next 90 days"                 t={t}/>
                  <StatCard label="Collaborating"   value={collabEvents.length} sub="as co-organiser"              t={t}/>
                </div>
              )}

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div style={{ marginBottom:36 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                    <h2 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em", color:t.text }}>Upcoming</h2>
                    <button onClick={()=>navigate("/events")} style={{ background:"none",border:"none",color:t.accent,fontSize:14,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>View all →</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {upcoming.slice(0,5).map(ev => <EventRow key={ev.id} ev={ev} t={t} onClick={()=>navigate(`/dashboard/${ev.id}`)}/>)}
                  </div>
                </div>
              )}

              {/* Collab */}
              {collabEvents.length > 0 && (
                <div style={{ marginBottom:36 }}>
                  <h2 style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em", color:t.text, marginBottom:16 }}>Collaborating</h2>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {collabEvents.map(ev => <EventRow key={ev.id} ev={ev} role={ev._role} t={t} onClick={()=>navigate(`/dashboard/${ev.id}`)}/>)}
                  </div>
                </div>
              )}

              {events.length === 0 && collabEvents.length === 0 && (
                <div style={{ textAlign:"center", padding:"64px 24px" }}>
                  <div style={{ width:72, height:72, background:t.accentBg, border:`2px solid ${t.accentBorder}`, borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <h3 style={{ fontSize:22, fontWeight:700, color:t.text, letterSpacing:"-0.03em", marginBottom:10 }}>No events yet</h3>
                  <p style={{ color:t.text2, marginBottom:28, fontSize:16 }}>Create your first event and start planning.</p>
                  <button className="ef-btn ef-btn-lg" onClick={()=>navigate("/create")}>Create Event</button>
                </div>
              )}

              {events.length > 0 && (
                <button className="ef-btn" onClick={()=>navigate("/create")}>+ New Event</button>
              )}
            </div>
          )}

          {/* ────── SETTINGS TAB ────── */}
          {tab === "settings" && (
            <div style={{ maxWidth:600 }}>
              <div style={{ marginBottom:36 }}>
                <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:"-0.04em", color:t.text, marginBottom:8 }}>Settings</h1>
                <p style={{ color:t.text2, fontSize:15 }}>Manage your account and appearance preferences.</p>
              </div>

              {/* Profile */}
              <SettingsSection title="Profile">
                <div className="ef-form-row">
                  <label className="ef-label">Display Name</label>
                  <div style={{ display:"flex", gap:10 }}>
                    <input className="ef-input" value={displayName} onChange={e=>{setDisplayName(e.target.value);setNameDirty(true);}} placeholder="Your name"/>
                    {nameDirty && <button className="ef-btn" onClick={saveName} disabled={savingName} style={{ flexShrink:0 }}>{savingName?"Saving…":"Save"}</button>}
                  </div>
                </div>
                <div>
                  <label className="ef-label">Email</label>
                  <div style={{ fontSize:14, color:t.text2, padding:"4px 0" }}>{user?.email}</div>
                </div>
              </SettingsSection>

              {/* Appearance */}
              <SettingsSection title="Appearance">
                {/* Accent */}
                <div className="ef-form-row">
                  <label className="ef-label">Accent Colour</label>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                    {ACCENTS.map(a => (
                      <button key={a.value} onClick={()=>handleAccent(a.value)} title={a.name}
                        style={{ width:36, height:36, borderRadius:10, background:a.value, border:`3px solid ${prefs.accent===a.value?"#fff":"transparent"}`, outline:`2px solid ${prefs.accent===a.value?a.value:"transparent"}`, cursor:"pointer", transition:"transform 0.1s", flexShrink:0 }}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>
                    ))}
                    <input type="color" value={customHex} onChange={e=>{setCustomHex(e.target.value);}} onBlur={()=>handleAccent(customHex)}
                      title="Custom colour"
                      style={{ width:36, height:36, borderRadius:10, padding:2, border:`1.5px solid ${t.border}`, background:t.bg2, cursor:"pointer" }}/>
                  </div>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ flex:1, height:10, borderRadius:99, background:`linear-gradient(to right, ${ACCENTS.map(a=>a.value).join(",")})` }}/>
                    <span style={{ fontSize:12, color:t.text3, fontFamily:"monospace" }}>{prefs.accent}</span>
                  </div>
                </div>

                {/* Mode */}
                <div className="ef-form-row">
                  <label className="ef-label" style={{ marginBottom:14 }}>Theme Mode</label>
                  <div style={{ display:"flex", gap:10 }}>
                    {[
                      { id:"light",   label:"Light",   icon:"☀" },
                      { id:"dark",    label:"Dark",    icon:"🌙" },
                    ].map(m => (
                      <button key={m.id} onClick={()=>updatePrefs({ mode:m.id, legacyDark:false })}
                        style={{ flex:1, padding:"14px 12px", background: prefs.mode===m.id&&!prefs.legacyDark ? t.accentBg : t.bg3, border:`1.5px solid ${prefs.mode===m.id&&!prefs.legacyDark ? t.accentBorder : t.border}`, borderRadius:10, cursor:"pointer", fontFamily:"inherit", color:prefs.mode===m.id&&!prefs.legacyDark?t.accent:t.text2, fontSize:15, fontWeight:600, transition:"all 0.15s" }}>
                        <div style={{ fontSize:22, marginBottom:6 }}>{m.icon}</div>
                        {m.label}
                      </button>
                    ))}
                    <button onClick={()=>updatePrefs({ mode:"dark", legacyDark:true })}
                      style={{ flex:1, padding:"14px 12px", background: prefs.legacyDark ? t.accentBg : t.bg3, border:`1.5px solid ${prefs.legacyDark ? t.accentBorder : t.border}`, borderRadius:10, cursor:"pointer", fontFamily:"inherit", color:prefs.legacyDark?t.accent:t.text2, fontSize:15, fontWeight:600, transition:"all 0.15s" }}>
                      <div style={{ fontSize:22, marginBottom:6 }}>🎮</div>
                      Classic
                    </button>
                  </div>
                  <div style={{ fontSize:12, color:t.text3, marginTop:10 }}>
                    "Classic" restores the original gold-on-dark EventFlow look.
                  </div>
                </div>

                {/* Preview swatch */}
                <div style={{ background:t.bg3, border:`1.5px solid ${t.border}`, borderRadius:10, padding:"16px 18px" }}>
                  <div style={{ fontSize:12, color:t.text3, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700 }}>Preview</div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                    <button className="ef-btn ef-btn-sm">Primary</button>
                    <button className="ef-btn ef-btn-sm ef-btn-ghost">Ghost</button>
                    <span className="ef-badge ef-badge-accent">Badge</span>
                    <span className="ef-badge ef-badge-success">Success</span>
                    <span className="ef-badge ef-badge-warning">Warning</span>
                    <span className="ef-badge ef-badge-danger">Danger</span>
                  </div>
                </div>
              </SettingsSection>

              {/* Notifications */}
              <SettingsSection title="Notifications">
                {[["Event reminders","Get notified before upcoming events"],["RSVP updates","When guests respond to invitations"],["Collaboration requests","When invited to co-organise"]].map(([title,desc]) => (
                  <div key={title} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:14, marginBottom:14, borderBottom:`1px solid ${t.border}` }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:t.text, marginBottom:3 }}>{title}</div>
                      <div style={{ fontSize:13, color:t.text2 }}>{desc}</div>
                    </div>
                    <label className="ef-toggle" style={{ opacity:0.4, cursor:"not-allowed" }}>
                      <input type="checkbox" disabled/>
                      <span className="ef-toggle-slider"/>
                    </label>
                  </div>
                ))}
                <div style={{ fontSize:13, color:t.text3 }}>Email notifications coming soon.</div>
              </SettingsSection>

              {/* Danger */}
              <SettingsSection title="Account" danger>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:t.text, marginBottom:3 }}>Sign out</div>
                    <div style={{ fontSize:13, color:t.text2 }}>Sign out of your EventFlow account.</div>
                  </div>
                  <button className="ef-btn ef-btn-ghost ef-btn-sm" style={{ color:"var(--danger)", borderColor:"var(--danger)", opacity:0.7 }} onClick={handleSignOut}>Sign Out</button>
                </div>
              </SettingsSection>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SettingsSection({ title, children, danger }) {
  const prefs = loadThemePrefs();
  const t = getTheme(prefs);
  return (
    <div style={{ marginBottom:28 }}>
      <div className="ef-section-label" style={{ color: danger ? "var(--danger)" : undefined, marginBottom:12 }}>{title}</div>
      <div className="ef-card" style={{ padding:"22px 24px", borderColor: danger ? "rgba(220,38,38,0.2)" : undefined }}>
        {children}
      </div>
    </div>
  );
}

function EventRow({ ev, role, t, onClick }) {
  const { label, cls } = daysUntil(ev.date);
  const badgeColors = { success:"var(--success)", warning:"var(--warning)", muted:t.text3 };
  return (
    <div className="ef-card ef-card-hover"
      style={{ padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
      onClick={onClick}>
      <div style={{ width:42, height:42, borderRadius:10, background:t.accentBg, border:`1.5px solid ${t.accentBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, color:t.accent, flexShrink:0, fontWeight:700 }}>
        {TYPE_ICONS[ev.type]||"◆"}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:700, color:t.text, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.name}</div>
        <div style={{ fontSize:13, color:t.text2 }}>
          {new Date(ev.date).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}
          {ev.venue_name && ` · ${ev.venue_name}`}
        </div>
      </div>
      {role && <span className="ef-badge ef-badge-accent" style={{ flexShrink:0 }}>{role.replace("_"," ")}</span>}
      <span style={{ fontSize:13, fontWeight:600, color:badgeColors[cls]||t.text3, flexShrink:0 }}>{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="2" style={{ flexShrink:0 }}><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  );
}
