// ============================================================
//  EventList.jsx  —  All events
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAppTheme } from "./Home";

const TYPE_ICONS = { gig:"♫", ball:"◇", party:"◆", wedding:"◇", birthday:"◆", corporate:"▣", festival:"◈", other:"◆" };

function daysUntil(ds) {
  const d = Math.ceil((new Date(ds) - new Date()) / 86400000);
  if (d < 0)  return { label:"Past",      color:"var(--text3)" };
  if (d === 0) return { label:"Today",    color:"var(--success)" };
  if (d === 1) return { label:"Tomorrow", color:"var(--warning)" };
  if (d <= 7)  return { label:`${d}d`,    color:"var(--warning)" };
  return { label:`${d}d`, color:"var(--text3)" };
}

import { globalCSS } from "./theme";

export default function EventList() {
  const navigate = useNavigate();
  const [prefs, , t] = useAppTheme();
  const [events,        setEvents]        = useState([]);
  const [collabEvents,  setCollabEvents]  = useState([]);
  const [pendingInvites,setPendingInvites] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState("all");
  const [deleting,      setDeleting]      = useState(null);
  const [search,        setSearch]        = useState("");
  const [user,          setUser]          = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setUser(user);
      const [{ data }, { data: cById }, { data: cByEmail }, { data: pById }, { data: pByEmail }] = await Promise.all([
        supabase.from("events").select("*").eq("organiser_id", user.id).order("date", { ascending: true }),
        supabase.from("event_collaborators").select("*, events(*)").eq("user_id", user.id).eq("status","accepted"),
        supabase.from("event_collaborators").select("*, events(*)").eq("email", user.email).eq("status","accepted"),
        supabase.from("event_collaborators").select("*, events(*)").eq("user_id", user.id).eq("status","pending"),
        supabase.from("event_collaborators").select("*, events(*)").eq("email", user.email).eq("status","pending"),
      ]);
      setEvents(data||[]);
      const seen = new Set();
      setCollabEvents([...(cById||[]),...(cByEmail||[])].filter(c=>c.events&&!seen.has(c.events.id)&&seen.add(c.events.id)).map(c=>({...c.events,_role:c.role})).filter(e=>!(data||[]).find(o=>o.id===e.id)));
      const ps = new Set();
      setPendingInvites([...(pById||[]),...(pByEmail||[])].filter(c=>c.events&&!ps.has(c.id)&&ps.add(c.id)));
      setLoading(false);
    };
    load();
  }, []);

  const now = new Date();
  const filtered = events.filter(e => {
    const matchFilter = filter==="upcoming" ? new Date(e.date)>=now : filter==="past" ? new Date(e.date)<now : true;
    const matchSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.venue_name?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (loading) return <div style={{ minHeight:"100vh", background:t.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:t.font }}><style>{globalCSS(t)}</style><div style={{ color:t.text3 }}>Loading…</div></div>;

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:t.font }}>
      <style>{globalCSS(t)}</style>

      {/* Top nav */}
      <div style={{ background:t.bg2, borderBottom:`1.5px solid ${t.border}`, padding:"0 40px", display:"flex", alignItems:"center", height:60, gap:16, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={()=>navigate("/home")} style={{ background:"none",border:"none",color:t.text2,fontSize:14,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6, padding:"8px 0" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Home
        </button>
        <div style={{ width:1, height:20, background:t.border }}/>
        <span style={{ fontSize:16, fontWeight:700, color:t.text, letterSpacing:"-0.02em" }}>All Events</span>
        <div style={{ flex:1 }}/>
        <button className="ef-btn" onClick={()=>navigate("/create")}>+ New Event</button>
      </div>

      <div style={{ maxWidth:820, margin:"0 auto", padding:"36px 40px" }}>

        {/* Pending invites */}
        {pendingInvites.map(inv => (
          <div key={inv.id} className="ef-card" style={{ padding:"14px 18px", marginBottom:12, display:"flex", alignItems:"center", gap:14, borderColor:"var(--accentBorder)", background:"var(--accentBg)" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent)", flexShrink:0 }}/>
            <div style={{ flex:1, fontSize:14 }}>Invited to collaborate on <strong>{inv.events?.name}</strong> as <strong>{inv.role?.replace("_"," ")}</strong></div>
            <button className="ef-btn ef-btn-sm" onClick={()=>navigate(`/collab/accept/${inv.token}`)}>View →</button>
          </div>
        ))}

        {/* Search + filter */}
        <div style={{ display:"flex", gap:12, marginBottom:28, alignItems:"center" }}>
          <div style={{ flex:1, position:"relative" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.text3} strokeWidth="2" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ef-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events…" style={{ paddingLeft:38 }}/>
          </div>
          <div style={{ display:"flex", background:t.bg3, border:`1.5px solid ${t.border}`, borderRadius:9, overflow:"hidden" }}>
            {[["all","All"],["upcoming","Upcoming"],["past","Past"]].map(([id,label])=>(
              <button key={id} onClick={()=>setFilter(id)}
                style={{ background:filter===id?t.accent:"none", color:filter===id?"#fff":t.text2, border:"none", padding:"8px 16px", fontSize:13, fontWeight:filter===id?600:500, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>{label}</button>
            ))}
          </div>
        </div>

        {/* My events */}
        {filtered.length > 0 && (
          <div style={{ marginBottom:32 }}>
            {collabEvents.length > 0 && <div className="ef-section-label" style={{ marginBottom:12 }}>My Events ({filtered.length})</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {filtered.map(ev => {
                const { label, color } = daysUntil(ev.date);
                return (
                  <div key={ev.id} className="ef-card ef-card-hover"
                    style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                    onClick={()=>navigate(`/dashboard/${ev.id}`)}>
                    <div style={{ width:44, height:44, borderRadius:11, background:"var(--accentBg)", border:"1.5px solid var(--accentBorder)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"var(--accent)", flexShrink:0, fontWeight:700 }}>
                      {TYPE_ICONS[ev.type]||"◆"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:t.text, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.name}</div>
                      <div style={{ fontSize:13, color:t.text2 }}>
                        {new Date(ev.date).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}
                        {ev.venue_name&&<span> · {ev.venue_name}</span>}
                        {ev.type&&<span style={{ textTransform:"capitalize" }}> · {ev.type}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color, flexShrink:0 }}>{label}</span>
                    <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete this event?")){ supabase.from("events").delete().eq("id",ev.id); setEvents(es=>es.filter(x=>x.id!==ev.id)); }}}
                      style={{ background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:16,padding:"4px 6px",borderRadius:6,transition:"color 0.1s" }}
                      onMouseEnter={e=>e.currentTarget.style.color="#dc2626"}
                      onMouseLeave={e=>e.currentTarget.style.color=t.text3}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collab */}
        {collabEvents.length > 0 && (
          <div>
            <div className="ef-section-label" style={{ marginBottom:12 }}>Collaborating</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {collabEvents.filter(ev=>!search||ev.name?.toLowerCase().includes(search.toLowerCase())).map(ev=>{
                const { label, color } = daysUntil(ev.date);
                return (
                  <div key={ev.id} className="ef-card ef-card-hover"
                    style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", borderColor:"var(--accentBorder)" }}
                    onClick={()=>navigate(`/dashboard/${ev.id}`)}>
                    <div style={{ width:44, height:44, borderRadius:11, background:"var(--accentBg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"var(--accent)", flexShrink:0 }}>
                      {TYPE_ICONS[ev.type]||"◆"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:t.text, marginBottom:3 }}>{ev.name}</div>
                      <div style={{ fontSize:13, color:t.text2 }}>{new Date(ev.date).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}</div>
                    </div>
                    <span className="ef-badge ef-badge-accent">{ev._role?.replace("_"," ")}</span>
                    <span style={{ fontSize:13, fontWeight:600, color, flexShrink:0 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filtered.length === 0 && collabEvents.length === 0 && (
          <div style={{ textAlign:"center", padding:"64px 20px" }}>
            <div style={{ fontSize:40, color:t.text3, marginBottom:16 }}>◆</div>
            <div style={{ fontSize:18, fontWeight:700, color:t.text, marginBottom:10 }}>No events found</div>
            {filter==="all" && !search && <button className="ef-btn ef-btn-lg" onClick={()=>navigate("/create")}>Create your first event</button>}
          </div>
        )}
      </div>
    </div>
  );
}
