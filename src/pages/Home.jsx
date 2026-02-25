// ============================================================
//  Home.jsx — App homescreen + settings
//  Oneonetix brand aesthetic — dark, bold, angular
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, saveThemePrefs, getTheme, globalCSS, ACCENTS, applyThemeToDOM } from "./theme";
import { BRAND } from "./brand";
const F = BRAND.fonts;
const C = BRAND.colors;

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
  if (d < 0)   return { label:"Past",      cls:"muted" };
  if (d === 0) return { label:"Today",     cls:"success" };
  if (d === 1) return { label:"Tomorrow",  cls:"warning" };
  if (d <= 7)  return { label:`${d}d`,     cls:"warning" };
  return       { label:`${d}d`,            cls:"muted" };
}

function NavItem({ icon, label, active, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:10, width:"100%",
      padding:"9px 12px", borderRadius:BRAND.radius,
      fontFamily:F.condensed, fontSize:"13px", fontWeight:700,
      letterSpacing:".08em", textTransform:"uppercase",
      color: danger ? "var(--danger)" : active ? "var(--accent)" : "var(--text2)",
      background: active ? "var(--accentBg)" : "none",
      border:"none", cursor:"pointer", transition:"all .12s", textAlign:"left",
    }}
    onMouseEnter={e => { if(!active&&!danger) e.currentTarget.style.background="var(--bg3)"; if(!active&&!danger) e.currentTarget.style.color="var(--text)"; }}
    onMouseLeave={e => { if(!active&&!danger) e.currentTarget.style.background="none"; if(!active&&!danger) e.currentTarget.style.color="var(--text2)"; }}>
      <span style={{ width:28, height:28, borderRadius:BRAND.radius,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:14, flexShrink:0,
        background: active ? "var(--accentBg)" : "transparent" }}>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, sub, t }) {
  return (
    <div style={{ background:t.bg2, border:`1px solid ${t.border}`, borderRadius:BRAND.radiusLg,
      padding:"20px 22px", position:"relative", overflow:"hidden" }}>
      <div style={{ fontFamily:F.display, fontSize:"3rem", lineHeight:1,
        color:t.text, marginBottom:4 }}>{value}</div>
      <div style={{ fontFamily:F.condensed, fontSize:".72rem", fontWeight:700,
        letterSpacing:".14em", textTransform:"uppercase", color:t.accent, marginBottom:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:t.text3 }}>{sub}</div>}
      <div style={{ position:"absolute", bottom:"-8px", right:"-4px",
        fontFamily:F.display, fontSize:"5rem", color:"rgba(255,255,255,0.025)",
        lineHeight:1, pointerEvents:"none", userSelect:"none" }}>{value}</div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [prefs, updatePrefs, t] = useAppTheme();
  const [tab,          setTab]          = useState("home");
  const [user,         setUser]         = useState(null);
  const [events,       setEvents]       = useState([]);
  const [collabEvents, setCollabEvents] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [displayName,  setDisplayName]  = useState("");
  const [savingName,   setSavingName]   = useState(false);
  const [nameDirty,    setNameDirty]    = useState(false);
  const [customHex,    setCustomHex]    = useState(prefs.accent);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setUser(user);
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
      const mergedC = [...(cById||[]),...(cByEmail||[])]
        .filter(c => c.events && !seen.has(c.events.id) && seen.add(c.events.id))
        .map(c => ({ ...c.events, _role: c.role }));
      setCollabEvents(mergedC.filter(e => !(owned||[]).find(o => o.id === e.id)));
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
    updatePrefs({ accent: hex }); setCustomHex(hex);
    if (user) supabase.from("user_preferences").upsert({ user_id: user.id, theme_accent: hex, updated_at: new Date().toISOString() });
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past     = events.filter(e => new Date(e.date) < now);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = prefs.display_name || user?.email?.split("@")[0] || "there";

  const icons = {
    home:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    events:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    new:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    settings: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    out:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  };

  const Divider = () => <div style={{ height:1, background:t.border, margin:"6px 0" }}/>;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.darkBg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", fontFamily:F.body }}>
      <style>{globalCSS(t)}</style>
      <div style={{ fontFamily:F.display, fontSize:"2rem", letterSpacing:".04em",
        color:C.darkText, marginBottom:16 }}>
        ONE<span style={{ color:C.primary }}>O</span>NETIX
      </div>
      <div style={{ fontFamily:F.condensed, fontSize:".75rem", fontWeight:700,
        letterSpacing:".2em", textTransform:"uppercase", color:C.darkTextMuted }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:F.body, background:t.bg }}>
      <style>{globalCSS(t)}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width:240, minWidth:240, background:t.sidebar,
        borderRight:`1px solid ${t.border}`,
        display:"flex", flexDirection:"column",
        position:"fixed", top:0, left:0, bottom:0, zIndex:30, overflowY:"auto" }}>

        {/* Logo */}
        <div style={{ padding:"22px 20px 18px", borderBottom:`1px solid ${t.border}` }}>
          <div style={{ fontFamily:F.display, fontSize:"1.55rem", letterSpacing:".04em",
            lineHeight:1, color:t.text }}>
            ONE<span style={{ color:t.accent }}>O</span>NETIX
          </div>
          <div style={{ fontFamily:F.condensed, fontSize:".6rem", fontWeight:700,
            letterSpacing:".18em", textTransform:"uppercase", color:t.text3, marginTop:4 }}>
            {BRAND.taglineShort}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding:"14px 10px", flex:1 }}>
          <div style={{ fontFamily:F.condensed, fontSize:".62rem", fontWeight:700,
            letterSpacing:".18em", textTransform:"uppercase",
            color:t.text3, paddingLeft:4, marginBottom:6 }}>Navigation</div>
          <NavItem icon={icons.home}   label="Home"       active={tab==="home"}     onClick={()=>setTab("home")} />
          <NavItem icon={icons.events} label="All Events" active={false}            onClick={()=>navigate("/events")} />
          <NavItem icon={icons.new}    label="New Event"  active={false}            onClick={()=>navigate("/create")} />
        </nav>

        {/* Bottom */}
        <div style={{ padding:"10px 10px 14px", borderTop:`1px solid ${t.border}` }}>
          <NavItem icon={icons.settings} label="Settings" active={tab==="settings"} onClick={()=>setTab("settings")} />
          <NavItem icon={icons.out}      label="Sign Out" onClick={handleSignOut}   danger />
          {/* User chip */}
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 10px",
            marginTop:8, background:t.bg3, borderRadius:BRAND.radius,
            border:`1px solid ${t.border}` }}>
            <div style={{ width:28, height:28, borderRadius:BRAND.radius,
              background:`rgba(255,77,0,0.12)`, border:`1px solid rgba(255,77,0,0.25)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:F.display, fontSize:"1rem", color:t.accent, flexShrink:0 }}>
              {name[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:F.condensed, fontSize:"12px", fontWeight:700,
                letterSpacing:".04em", textTransform:"uppercase",
                color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
              <div style={{ fontSize:10, color:t.text3, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft:240, flex:1, minHeight:"100vh", background:t.bg }}>
        <div style={{ padding:"40px 48px", maxWidth:960 }} className="fade-up">

          {/* ── HOME TAB ── */}
          {tab === "home" && (
            <div style={{ maxWidth:740 }}>

              {/* Header */}
              <div style={{ marginBottom:40 }}>
                <div style={{ fontFamily:F.condensed, fontSize:".72rem", fontWeight:700,
                  letterSpacing:".2em", textTransform:"uppercase",
                  color:t.accent, marginBottom:10 }}>Dashboard</div>
                <h1 style={{ fontFamily:F.display, fontSize:"clamp(2.5rem,5vw,4rem)",
                  lineHeight:.95, letterSpacing:".01em", color:t.text, marginBottom:10 }}>
                  {greeting.toUpperCase()},<br/>
                  <span style={{ color:t.accent }}>{name.toUpperCase()}</span>
                </h1>
                <p style={{ color:t.text2, fontSize:"1rem", fontFamily:F.body, lineHeight:1.65 }}>
                  {upcoming.length === 0
                    ? "No upcoming events — create one to get started."
                    : `You have ${upcoming.length} upcoming event${upcoming.length!==1?"s":""}.`}
                </p>
              </div>

              {/* Stats */}
              {events.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:40 }}>
                  <StatCard label="Total Events"   value={events.length}   sub={`${past.length} past`}       t={t}/>
                  <StatCard label="Upcoming"       value={upcoming.length} sub="in the future"               t={t}/>
                  <StatCard label="Collaborations" value={collabEvents.length} sub="events shared with you"  t={t}/>
                </div>
              )}

              {/* Quick actions */}
              <div style={{ display:"flex", gap:10, marginBottom:40 }}>
                <button onClick={()=>navigate("/create")} style={{
                  background:t.accent, border:"none", borderRadius:BRAND.radius,
                  padding:"12px 24px", color:C.primaryText,
                  fontFamily:F.condensed, fontSize:".85rem", fontWeight:900,
                  letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer",
                  transition:"background .15s",
                }}
                onMouseEnter={e=>e.target.style.background=C.primaryHover}
                onMouseLeave={e=>e.target.style.background=t.accent}>
                  + New Event
                </button>
                <button onClick={()=>navigate("/events")} style={{
                  background:"transparent", border:`1.5px solid ${t.border}`,
                  borderRadius:BRAND.radius, padding:"12px 24px", color:t.text2,
                  fontFamily:F.condensed, fontSize:".85rem", fontWeight:700,
                  letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer",
                  transition:"border-color .15s, color .15s",
                }}
                onMouseEnter={e=>{e.target.style.borderColor=t.text2;e.target.style.color=t.text;}}
                onMouseLeave={e=>{e.target.style.borderColor=t.border;e.target.style.color=t.text2;}}>
                  All Events →
                </button>
              </div>

              {/* Upcoming events */}
              {upcoming.length > 0 && (
                <div style={{ marginBottom:36 }}>
                  <SectionLabel label="Upcoming Events" accent={t.accent}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {upcoming.slice(0,5).map(ev=>(
                      <EventRow key={ev.id} ev={ev} t={t} onClick={()=>navigate(`/dashboard/${ev.id}`)}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Collab events */}
              {collabEvents.length > 0 && (
                <div style={{ marginBottom:36 }}>
                  <SectionLabel label="Shared With Me" accent={t.accent}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {collabEvents.map(ev=>(
                      <EventRow key={ev.id} ev={ev} role={ev._role} t={t} onClick={()=>navigate(`/dashboard/${ev.id}`)}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Past events */}
              {past.length > 0 && (
                <div>
                  <SectionLabel label="Past Events" accent={t.text3}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, opacity:.6 }}>
                    {past.slice(-3).reverse().map(ev=>(
                      <EventRow key={ev.id} ev={ev} t={t} onClick={()=>navigate(`/dashboard/${ev.id}`)}/>
                    ))}
                  </div>
                </div>
              )}

              {events.length === 0 && (
                <div style={{ textAlign:"center", padding:"72px 20px",
                  background:t.bg2, border:`1px solid ${t.border}`,
                  borderRadius:BRAND.radiusLg }}>
                  <div style={{ fontFamily:F.display, fontSize:"4rem",
                    color:"rgba(255,255,255,0.05)", marginBottom:16 }}>EVENT</div>
                  <h3 style={{ fontFamily:F.display, fontSize:"2rem",
                    letterSpacing:".02em", marginBottom:8, color:t.text }}>
                    NO EVENTS YET
                  </h3>
                  <p style={{ color:t.text2, fontSize:".9rem", maxWidth:360,
                    margin:"0 auto 28px", lineHeight:1.7 }}>
                    Create your first event to start managing guests, staff, budget and more.
                  </p>
                  <button onClick={()=>navigate("/create")} style={{
                    background:t.accent, border:"none", borderRadius:BRAND.radius,
                    padding:"13px 28px", color:C.primaryText,
                    fontFamily:F.condensed, fontSize:".85rem", fontWeight:900,
                    letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer",
                  }}>+ Create First Event</button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === "settings" && (
            <div style={{ maxWidth:620 }}>
              <div style={{ fontFamily:F.condensed, fontSize:".72rem", fontWeight:700,
                letterSpacing:".2em", textTransform:"uppercase", color:t.accent, marginBottom:10 }}>Account</div>
              <h1 style={{ fontFamily:F.display, fontSize:"3rem", lineHeight:.95,
                letterSpacing:".01em", color:t.text, marginBottom:32 }}>SETTINGS</h1>

              {/* Profile */}
              <SettingsBlock title="Profile" t={t}>
                <div style={{ marginBottom:16 }}>
                  <FormLabel label="Display Name" t={t}/>
                  <div style={{ display:"flex", gap:10 }}>
                    <input value={displayName}
                      onChange={e=>{setDisplayName(e.target.value);setNameDirty(true);}}
                      style={{ flex:1, background:t.bg3, border:`1.5px solid ${t.border}`,
                        borderRadius:BRAND.radius, padding:"11px 14px",
                        color:t.text, fontFamily:F.body, fontSize:14, outline:"none" }}
                      onFocus={e=>{e.target.style.borderColor=t.accent;}}
                      onBlur={e=>{e.target.style.borderColor=t.border;}}/>
                    <button onClick={saveName} disabled={!nameDirty||savingName}
                      style={{ background:nameDirty?t.accent:t.bg3,
                        border:`1.5px solid ${nameDirty?t.accent:t.border}`,
                        borderRadius:BRAND.radius, padding:"11px 18px",
                        color:nameDirty?C.primaryText:t.text3,
                        fontFamily:F.condensed, fontSize:".75rem", fontWeight:900,
                        letterSpacing:".1em", textTransform:"uppercase",
                        cursor:nameDirty?"pointer":"not-allowed", opacity:nameDirty?1:0.5,
                        transition:"all .15s" }}>
                      {savingName ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <div>
                  <FormLabel label="Email" t={t}/>
                  <div style={{ padding:"11px 14px", background:t.bg3,
                    border:`1px solid ${t.border}`, borderRadius:BRAND.radius,
                    fontSize:14, color:t.text3, fontFamily:F.body }}>{user?.email}</div>
                </div>
              </SettingsBlock>

              {/* Appearance */}
              <SettingsBlock title="Appearance" t={t}>
                <FormLabel label="Accent Colour" t={t}/>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  {ACCENTS.map(a=>(
                    <button key={a.value} onClick={()=>handleAccent(a.value)} title={a.name}
                      style={{ width:32, height:32, borderRadius:BRAND.radius, background:a.value,
                        border:`2.5px solid ${prefs.accent===a.value?"#fff":"transparent"}`,
                        outline:`2px solid ${prefs.accent===a.value?a.value:"transparent"}`,
                        cursor:"pointer", transition:"transform .1s", flexShrink:0 }}
                      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>
                  ))}
                  <input type="color" value={customHex}
                    onChange={e=>setCustomHex(e.target.value)}
                    onBlur={()=>handleAccent(customHex)}
                    title="Custom"
                    style={{ width:32, height:32, borderRadius:BRAND.radius, padding:2,
                      border:`1.5px solid ${t.border}`, background:t.bg2, cursor:"pointer" }}/>
                </div>

                <FormLabel label="Theme Mode" t={t}/>
                <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                  {[{id:"dark",label:"Dark",icon:"🌙"},{id:"light",label:"Light",icon:"☀"}].map(m=>(
                    <button key={m.id} onClick={()=>updatePrefs({mode:m.id})}
                      style={{ flex:1, padding:"12px", cursor:"pointer", fontFamily:"inherit",
                        background:prefs.mode===m.id?t.accentBg:t.bg3,
                        border:`1.5px solid ${prefs.mode===m.id?t.accentBorder:t.border}`,
                        borderRadius:BRAND.radius,
                        color:prefs.mode===m.id?t.accent:t.text2,
                        fontFamily:F.condensed, fontSize:".8rem", fontWeight:700,
                        letterSpacing:".08em", textTransform:"uppercase",
                        transition:"all .15s" }}>
                      <div style={{ fontSize:20, marginBottom:4 }}>{m.icon}</div>
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Preview */}
                <div style={{ padding:"14px 16px", background:t.bg3,
                  border:`1px solid ${t.border}`, borderRadius:BRAND.radius }}>
                  <div style={{ fontFamily:F.condensed, fontSize:".6rem", fontWeight:700,
                    letterSpacing:".16em", textTransform:"uppercase",
                    color:t.text3, marginBottom:10 }}>Preview</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                    <button style={{ background:t.accent, border:"none", borderRadius:BRAND.radius,
                      padding:"7px 14px", color:C.primaryText, fontFamily:F.condensed,
                      fontSize:".72rem", fontWeight:900, letterSpacing:".1em",
                      textTransform:"uppercase", cursor:"pointer" }}>Primary</button>
                    <button style={{ background:"transparent", border:`1.5px solid ${t.border}`,
                      borderRadius:BRAND.radius, padding:"7px 14px", color:t.text2,
                      fontFamily:F.condensed, fontSize:".72rem", fontWeight:700,
                      letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer" }}>Ghost</button>
                    {[["accent",t.accent,"rgba(255,77,0,0.12)"],["success",C.success,"rgba(34,197,94,0.1)"],
                      ["warning",C.warning,"rgba(245,158,11,0.1)"],["danger",C.danger,"rgba(239,68,68,0.1)"]].map(([l,col,bg])=>(
                      <span key={l} style={{ padding:"3px 9px", borderRadius:"2px",
                        background:bg, color:col, border:`1px solid ${col}33`,
                        fontFamily:F.condensed, fontSize:".65rem", fontWeight:700,
                        letterSpacing:".1em", textTransform:"uppercase" }}>{l}</span>
                    ))}
                  </div>
                </div>
              </SettingsBlock>

              {/* Account / sign out */}
              <SettingsBlock title="Account" t={t} danger>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontFamily:F.condensed, fontSize:".8rem", fontWeight:700,
                      letterSpacing:".06em", textTransform:"uppercase",
                      color:t.text, marginBottom:3 }}>Sign out</div>
                    <div style={{ fontSize:13, color:t.text2 }}>Sign out of your {BRAND.name} account.</div>
                  </div>
                  <button onClick={handleSignOut}
                    style={{ background:"transparent", border:`1.5px solid var(--danger)`,
                      borderRadius:BRAND.radius, padding:"8px 16px", color:"var(--danger)",
                      fontFamily:F.condensed, fontSize:".72rem", fontWeight:900,
                      letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer",
                      opacity:.8, transition:"opacity .15s" }}
                    onMouseEnter={e=>e.target.style.opacity=1}
                    onMouseLeave={e=>e.target.style.opacity=.8}>
                    Sign Out
                  </button>
                </div>
              </SettingsBlock>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ label, accent }) {
  return (
    <div style={{ fontFamily:BRAND.fonts.condensed, fontSize:".7rem", fontWeight:700,
      letterSpacing:".2em", textTransform:"uppercase",
      color:accent, marginBottom:10,
      display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ height:1, width:16, background:accent, opacity:.6 }}/>
      {label}
    </div>
  );
}

function FormLabel({ label, t }) {
  return (
    <div style={{ fontFamily:BRAND.fonts.condensed, fontSize:".68rem", fontWeight:700,
      letterSpacing:".14em", textTransform:"uppercase",
      color:t.text2, marginBottom:7 }}>{label}</div>
  );
}

function SettingsBlock({ title, children, t, danger }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontFamily:BRAND.fonts.condensed, fontSize:".68rem", fontWeight:700,
        letterSpacing:".18em", textTransform:"uppercase",
        color: danger ? "var(--danger)" : t.text3, marginBottom:10 }}>{title}</div>
      <div style={{ background:t.bg2, border:`1px solid ${danger?"rgba(239,68,68,0.2)":t.border}`,
        borderRadius:BRAND.radiusLg, padding:"22px 24px" }}>
        {children}
      </div>
    </div>
  );
}

function EventRow({ ev, role, t, onClick }) {
  const { label, cls } = daysUntil(ev.date);
  const clsColor = { success:"var(--success)", warning:"var(--warning)", muted:t.text3 };
  return (
    <div onClick={onClick}
      style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:14,
        cursor:"pointer", background:t.bg2, border:`1px solid ${t.border}`,
        borderRadius:BRAND.radius, transition:"background .15s, border-color .15s" }}
      onMouseEnter={e=>{e.currentTarget.style.background=t.bg3;e.currentTarget.style.borderColor=t.accentBorder;}}
      onMouseLeave={e=>{e.currentTarget.style.background=t.bg2;e.currentTarget.style.borderColor=t.border;}}>
      <div style={{ width:36, height:36, borderRadius:BRAND.radius,
        background:`rgba(255,77,0,0.1)`, border:`1px solid rgba(255,77,0,0.2)`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:BRAND.fonts.display, fontSize:"1.1rem", color:t.accent,
        flexShrink:0 }}>
        {TYPE_ICONS[ev.type]||"◆"}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:BRAND.fonts.condensed, fontSize:"13px", fontWeight:700,
          letterSpacing:".04em", textTransform:"uppercase",
          color:t.text, marginBottom:3,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.name}</div>
        <div style={{ fontSize:12, color:t.text2 }}>
          {new Date(ev.date).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}
          {ev.venue_name && ` · ${ev.venue_name}`}
        </div>
      </div>
      {role && (
        <span style={{ padding:"3px 8px", borderRadius:"2px",
          background:t.accentBg, color:t.accent, border:`1px solid ${t.accentBorder}`,
          fontFamily:BRAND.fonts.condensed, fontSize:".62rem", fontWeight:700,
          letterSpacing:".1em", textTransform:"uppercase", flexShrink:0 }}>
          {role.replace("_"," ")}
        </span>
      )}
      <span style={{ fontFamily:BRAND.fonts.condensed, fontSize:".7rem", fontWeight:700,
        letterSpacing:".08em", color:clsColor[cls]||t.text3, flexShrink:0 }}>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke={t.text3} strokeWidth="2.5" style={{ flexShrink:0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}
