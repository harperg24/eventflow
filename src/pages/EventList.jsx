// ============================================================
//  EventList.jsx  —  All events page
//  Route: /events
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const TYPE_ICONS = {
  gig:"♫", ball:"◇", party:"◆", wedding:"◇", birthday:"◆",
  corporate:"▣", festival:"◈", other:"◆",
};

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff < 0)   return { label:"Past",      color:"#6b6a7a" };
  if (diff === 0) return { label:"Today",     color:"#22c55e" };
  if (diff === 1) return { label:"Tomorrow",  color:"#f59e0b" };
  return { label:`${diff}d`,             color:"#6b6a7a" };
}

export default function EventList() {
  const navigate = useNavigate();
  const [events,        setEvents]        = useState([]);
  const [collabEvents,  setCollabEvents]  = useState([]);
  const [pendingInvites,setPendingInvites] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [user,          setUser]          = useState(null);
  const [deleting,      setDeleting]      = useState(null);
  const [filter,        setFilter]        = useState("all"); // all | upcoming | past
  const [accent, setAccent] = useState("#4f46e5");

  useEffect(() => {
    const a = document.documentElement.style.getPropertyValue("--accent");
    if (a) setAccent(a.trim());
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setUser(user);

      const [{ data }, { data: collabsById }, { data: collabsByEmail }, { data: pendingById }, { data: pendingByEmail }] = await Promise.all([
        supabase.from("events").select("*").eq("organiser_id", user.id).order("date", { ascending: true }),
        supabase.from("event_collaborators").select("*, events(*)").eq("user_id", user.id).eq("status","accepted"),
        supabase.from("event_collaborators").select("*, events(*)").eq("email", user.email).eq("status","accepted"),
        supabase.from("event_collaborators").select("*, events(*)").eq("user_id", user.id).eq("status","pending"),
        supabase.from("event_collaborators").select("*, events(*)").eq("email", user.email).eq("status","pending"),
      ]);
      setEvents(data || []);

      const seen = new Set();
      const merged = [...(collabsById||[]), ...(collabsByEmail||[])]
        .filter(c => c.events && !seen.has(c.events.id) && seen.add(c.events.id))
        .map(c => ({ ...c.events, _role: c.role }));
      setCollabEvents(merged.filter(e => !(data||[]).find(o => o.id === e.id)));

      const pendingSeen = new Set();
      const pendingMerged = [...(pendingById||[]), ...(pendingByEmail||[])]
        .filter(c => c.events && !pendingSeen.has(c.id) && pendingSeen.add(c.id));
      setPendingInvites(pendingMerged);

      // Lazy stamp user_id on accepted rows
      const unstamped = [...(collabsByEmail||[])].filter(c => !c.user_id);
      if (unstamped.length > 0) {
        for (const c of unstamped) {
          await supabase.from("event_collaborators").update({ user_id: user.id }).eq("id", c.id);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    setDeleting(id);
    await supabase.from("events").delete().eq("id", id);
    setEvents(ev => ev.filter(e => e.id !== id));
    setDeleting(null);
  };

  const now = new Date();
  const filtered = events.filter(e => {
    if (filter === "upcoming") return new Date(e.date) >= now;
    if (filter === "past")     return new Date(e.date) < now;
    return true;
  });

  const S = {
    page:  { minHeight:"100vh", background:"#0f0f11", color:"#f0eff4", fontFamily:"'Inter','Helvetica Neue',sans-serif", fontSize:14, padding:"40px 48px" },
    card:  { background:"#16161a", border:"1px solid #222228", borderRadius:12 },
    btn:   { background:accent, border:"none", color:"#fff", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    ghost: { background:"none", border:"1px solid #222228", color:"#9998a8", borderRadius:8, padding:"9px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  };

  if (loading) return (
    <div style={{...S.page, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{ color:"#6b6a7a" }}>Loading…</div>
    </div>
  );

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`input:focus, select:focus { outline: none; border-color: ${accent} !important; }`}</style>

      <div style={{ maxWidth:800, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
          <div>
            <button onClick={() => navigate("/home")} style={{ background:"none", border:"none", color:"#6b6a7a", fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:8, padding:0 }}>← Home</button>
            <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em", margin:0 }}>All Events</h1>
          </div>
          <button style={S.btn} onClick={() => navigate("/create")}>+ New Event</button>
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div style={{ marginBottom:24 }}>
            {pendingInvites.map(inv => (
              <div key={inv.id} style={{ ...S.card, padding:"14px 18px", marginBottom:8, display:"flex", alignItems:"center", gap:14, borderColor:`${accent}30` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:accent, flexShrink:0 }}/>
                <div style={{ flex:1, fontSize:13 }}>
                  You've been invited to collaborate on <strong>{inv.events?.name}</strong> as {inv.role?.replace("_"," ")}
                </div>
                <button onClick={() => navigate(`/collab/accept/${inv.token}`)}
                  style={{ ...S.btn, padding:"7px 14px", fontSize:12 }}>View Invite</button>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20, background:"#131316", padding:4, borderRadius:10, width:"fit-content" }}>
          {[["all","All"],["upcoming","Upcoming"],["past","Past"]].map(([id,label]) => (
            <button key={id} onClick={() => setFilter(id)}
              style={{ background:filter===id?"#1c1c22":"none", border:"none", color:filter===id?"#f0eff4":"#6b6a7a", borderRadius:7, padding:"6px 14px", fontSize:12, fontWeight:filter===id?600:400, cursor:"pointer", fontFamily:"inherit", transition:"all 0.1s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* My events */}
        {filtered.length === 0 && collabEvents.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#6b6a7a" }}>
            <div style={{ fontSize:32, marginBottom:12, color:`${accent}60` }}>◆</div>
            <div style={{ fontSize:15, fontWeight:600, color:"#f0eff4", marginBottom:8 }}>No events {filter !== "all" ? `(${filter})` : "yet"}</div>
            {filter === "all" && <button style={S.btn} onClick={() => navigate("/create")}>Create your first event</button>}
          </div>
        ) : (
          <>
            {filtered.length > 0 && (
              <div style={{ marginBottom:32 }}>
                {collabEvents.length > 0 && <div style={{ fontSize:12, color:"#6b6a7a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>My Events</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {filtered.map(ev => {
                    const { label, color } = daysUntil(ev.date);
                    const icon = TYPE_ICONS[ev.type] || "◆";
                    const isPast = new Date(ev.date) < now;
                    return (
                      <div key={ev.id}
                        style={{ ...S.card, padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"border-color 0.12s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = accent + "50"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "#222228"}
                        onClick={() => navigate(`/dashboard/${ev.id}`)}>
                        <div style={{ width:40, height:40, borderRadius:10, background:isPast?"#1c1c20":`${accent}12`, border:`1px solid ${isPast?"#222228":accent+"30"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:isPast?"#6b6a7a":accent, flexShrink:0 }}>
                          {icon}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:"#6b6a7a" }}>
                            {new Date(ev.date).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}
                            {ev.venue_name && <span> · {ev.venue_name}</span>}
                            {ev.type && <span style={{ marginLeft:8, textTransform:"capitalize" }}>· {ev.type}</span>}
                          </div>
                        </div>
                        <div style={{ color, fontSize:12, fontWeight:500, flexShrink:0 }}>{label}</div>
                        <button onClick={e => { e.stopPropagation(); handleDelete(ev.id); }} disabled={deleting===ev.id}
                          style={{ background:"none", border:"none", color:"#3a3a45", cursor:"pointer", fontSize:14, padding:"4px 8px", borderRadius:6, transition:"color 0.1s" }}
                          onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                          onMouseLeave={e => e.currentTarget.style.color="#3a3a45"}>
                          {deleting===ev.id ? "…" : "✕"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collab events */}
            {collabEvents.length > 0 && (
              <div>
                <div style={{ fontSize:12, color:"#6b6a7a", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>Collaborating</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {collabEvents.map(ev => {
                    const { label, color } = daysUntil(ev.date);
                    return (
                      <div key={ev.id}
                        style={{ ...S.card, padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"border-color 0.12s", borderColor:`${accent}20` }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = accent + "50"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = `${accent}20`}
                        onClick={() => navigate(`/dashboard/${ev.id}`)}>
                        <div style={{ width:40, height:40, borderRadius:10, background:`${accent}10`, border:`1px solid ${accent}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:accent }}>
                          {TYPE_ICONS[ev.type]||"◆"}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>{ev.name}</div>
                          <div style={{ fontSize:12, color:"#6b6a7a" }}>
                            {new Date(ev.date).toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"})}
                          </div>
                        </div>
                        <span style={{ fontSize:11, padding:"3px 8px", borderRadius:20, background:`${accent}12`, color:accent, border:`1px solid ${accent}25`, fontWeight:600 }}>{ev._role?.replace("_"," ")}</span>
                        <div style={{ color, fontSize:12, fontWeight:500 }}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
