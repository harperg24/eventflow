// ============================================================
//  EventCreation.jsx  —  New event wizard with feature selection
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, createEvent } from "../lib/supabase";

// ── Feature definitions ──────────────────────────────────────
const ALL_FEATURES = [
  {
    id: "guests",
    label: "Guest Management",
    desc: "Invite guests, track RSVPs, send reminders.",
    icon: "◉",
    color: "#818cf8",
  },
  {
    id: "budget",
    label: "Budget Tracker",
    desc: "Set budgets per category and log expenses.",
    icon: "◎",
    color: "#22c55e",
  },
  {
    id: "playlist",
    label: "Playlist",
    desc: "Curate music and let guests request songs.",
    icon: "♫",
    color: "#a78bfa",
  },
  {
    id: "polls",
    label: "Polls",
    desc: "Create polls and gather guest preferences.",
    icon: "◐",
    color: "#f59e0b",
  },
  {
    id: "vendors",
    label: "Vendors",
    desc: "Manage suppliers, caterers, photographers.",
    icon: "◇",
    color: "#06b6d4",
  },
  {
    id: "collab",
    label: "Collaborate",
    desc: "Invite co-organisers with role-based access.",
    icon: "◈",
    color: "#f472b6",
  },
  {
    id: "checklist",
    label: "Checklist",
    desc: "Track tasks and to-dos with due dates.",
    icon: "☑",
    color: "#34d399",
  },
  {
    id: "tickets",
    label: "Ticket Hub",
    desc: "Sell tickets online with Stripe integration.",
    icon: "▣",
    color: "#fb923c",
  },
  {
    id: "checkin",
    label: "Check-in",
    desc: "Scan QR codes at the door for fast entry.",
    icon: "✓",
    color: "#4ade80",
  },
  {
    id: "staff",
    label: "Staff & Timesheets",
    desc: "Manage staff schedules, clock-in and payroll.",
    icon: "⏱",
    color: "#60a5fa",
  },
];

// Presets per event type — "suggested" are on by default, rest are off
const TYPE_PRESETS = {
  gig:       { label:"Music Gig",      icon:"♫", suggested:["guests","budget","playlist","vendors","checklist","tickets","checkin","staff"], description:"Live music event, ticketed or private." },
  ball:      { label:"Ball / Formal",  icon:"◇", suggested:["guests","budget","playlist","vendors","collab","checklist","checkin"], description:"Formal event with guest lists and seating." },
  party:     { label:"Party",          icon:"◆", suggested:["guests","budget","playlist","polls","checklist"], description:"Casual private or semi-private gathering." },
  wedding:   { label:"Wedding",        icon:"◇", suggested:["guests","budget","playlist","polls","vendors","collab","checklist"], description:"Wedding ceremony and/or reception." },
  birthday:  { label:"Birthday",       icon:"◆", suggested:["guests","budget","playlist","polls","checklist"], description:"Birthday celebration." },
  corporate: { label:"Corporate",      icon:"▣", suggested:["guests","budget","vendors","collab","checklist","staff"], description:"Professional event, conference or team function." },
  festival:  { label:"Festival",       icon:"◈", suggested:["guests","budget","playlist","vendors","collab","checklist","tickets","checkin","staff"], description:"Multi-act public or private festival." },
  other:     { label:"Other",          icon:"◆", suggested:["guests","budget","checklist"], description:"Custom event type." },
};

const EVENT_TYPES = Object.entries(TYPE_PRESETS).map(([id, v]) => ({ id, ...v }));

const budgetCategories = [
  { id:"venue",         label:"Venue",         color:"#f59e0b" },
  { id:"catering",      label:"Catering",      color:"#10b981" },
  { id:"entertainment", label:"Entertainment", color:"#8b5cf6" },
  { id:"decorations",   label:"Decorations",   color:"#ec4899" },
  { id:"photography",   label:"Photography",   color:"#3b82f6" },
  { id:"misc",          label:"Miscellaneous", color:"#6b7280" },
];

export default function EventCreation() {
  const navigate = useNavigate();
  const [step,      setStep]      = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);
  const [accent,    setAccent]    = useState("#4f46e5");

  // Step 0: type, Step 1: features, Step 2: details, Step 3: venue, Step 4: tickets (if enabled), Step 5: budget, Step 6: review
  const [eventType,    setEventType]    = useState(null);   // id string
  const [features,     setFeatures]     = useState([]);     // array of enabled feature ids
  const [eventCategory,setEventCategory] = useState("private");
  const [ticketTiers,  setTicketTiers]  = useState([{ name:"General Admission", description:"", price:"", capacity:"" }]);
  const [event, setEvent] = useState({
    name:"", type:"", date:"", time:"", description:"", ticket_message:"",
    venue:"", address:"", capacity:"",
    guests:[], guestInput:"",
    totalBudget:"",
    budgetSplit:{ venue:"", catering:"", entertainment:"", decorations:"", photography:"", misc:"" },
  });

  useEffect(() => {
    const a = document.documentElement.style.getPropertyValue("--accent");
    if (a) setAccent(a.trim());
  }, []);

  const update = (k, v) => setEvent(p => ({ ...p, [k]: v }));

  // When type chosen, pre-select suggested features
  const handleTypeSelect = (typeId) => {
    setEventType(typeId);
    setFeatures(TYPE_PRESETS[typeId]?.suggested || []);
    update("type", typeId);
  };

  const toggleFeature = (id) => {
    setFeatures(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  };

  const addTier    = () => setTicketTiers(t => [...t, { name:"", description:"", price:"", capacity:"" }]);
  const removeTier = (i) => setTicketTiers(t => t.filter((_,idx)=>idx!==i));
  const updateTier = (i, field, val) => setTicketTiers(t => t.map((tier,idx)=>idx===i?{...tier,[field]:val}:tier));

  const addGuest = () => {
    const email = event.guestInput.trim();
    if (email && !event.guests.includes(email)) { update("guests", [...event.guests, email]); update("guestInput",""); }
  };

  const hasTickets = features.includes("tickets");
  const hasGuests  = features.includes("guests");
  const hasBudget  = features.includes("budget");

  // Dynamic steps
  const steps = [
    "Event Type",
    "Features",
    "Details",
    "Venue",
    ...(hasGuests ? ["Guests"] : []),
    ...(hasTickets ? ["Tickets"] : []),
    ...(hasBudget ? ["Budget"] : []),
    "Review",
  ];
  const totalSteps = steps.length;

  const handleCreate = async () => {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required.");
      const cat = hasTickets ? (hasGuests ? "hybrid" : "ticketed") : "private";
      const newEvent = await createEvent({ ...event, ticketing: cat }, user.id, user.email);

      // Update enabled_features
      await supabase.from("events").update({ enabled_features: ["overview", ...features] }).eq("id", newEvent.id);

      // Create ticket tiers if any
      if (hasTickets) {
        const tierRows = ticketTiers.filter(t=>t.name).map((t,i)=>({
          event_id: newEvent.id, name:t.name, description:t.description||null,
          price:parseFloat(t.price)||0, capacity:parseInt(t.capacity)||null, sort_order:i,
        }));
        if (tierRows.length) await supabase.from("ticket_tiers").insert(tierRows);
      }
      navigate(`/dashboard/${newEvent.id}`);
    } catch(e) { setError(e.message); setSaving(false); }
  };

  const S = {
    page:   { minHeight:"100vh", background:"#0f0f11", color:"#f0eff4", fontFamily:"'Inter','Helvetica Neue',sans-serif", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 20px" },
    box:    { width:"100%", maxWidth:680, background:"#16161a", border:"1px solid #222228", borderRadius:16, overflow:"hidden" },
    body:   { padding:"36px 40px" },
    label:  { display:"block", fontSize:11, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 },
    input:  { width:"100%", boxSizing:"border-box", background:"#1c1c20", border:"1px solid #2a2a30", borderRadius:8, padding:"11px 13px", color:"#f0eff4", fontSize:13, outline:"none", fontFamily:"inherit", transition:"border-color 0.15s" },
    btn:    { background:accent, border:"none", color:"#fff", borderRadius:8, padding:"11px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"opacity 0.15s" },
    ghost:  { background:"none", border:"1px solid #222228", color:"#9998a8", borderRadius:8, padding:"11px 22px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  };

  const canNext = () => {
    if (step === 0) return !!eventType;
    if (step === 1) return features.length > 0;
    if (step === 2) return !!event.name && !!event.date;
    return true;
  };

  const nextStep = () => { if (step < totalSteps-1) setStep(s=>s+1); };
  const prevStep = () => { if (step > 0) setStep(s=>s-1); };

  const currentStepName = steps[step] || "";

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`input:focus, select:focus, textarea:focus { border-color: ${accent} !important; outline: none; } * { box-sizing: border-box; }`}</style>

      <div style={S.box}>
        {/* Header */}
        <div style={{ padding:"24px 40px 0", borderBottom:"1px solid #1c1c20", marginBottom:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <button onClick={() => navigate("/home")} style={{ background:"none", border:"none", color:"#6b6a7a", fontSize:13, cursor:"pointer", fontFamily:"inherit", padding:0 }}>← Back</button>
            <span style={{ fontSize:12, color:"#6b6a7a" }}>Step {step+1} of {totalSteps}</span>
          </div>
          {/* Progress bar */}
          <div style={{ height:2, background:"#1c1c20", borderRadius:99, marginBottom:24, overflow:"hidden" }}>
            <div style={{ height:"100%", background:accent, borderRadius:99, width:`${((step+1)/totalSteps)*100}%`, transition:"width 0.3s ease" }}/>
          </div>
          {/* Step labels */}
          <div style={{ display:"flex", gap:0, marginBottom:0, overflowX:"auto", paddingBottom:0 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ flex:1, textAlign:"center", paddingBottom:14, borderBottom:`2px solid ${i===step?accent:"transparent"}`, fontSize:11, color:i===step?"#f0eff4":i<step?accent+"80":"#6b6a7a", fontWeight:i===step?600:400, whiteSpace:"nowrap", cursor:i<step?"pointer":"default", transition:"all 0.15s" }}
                onClick={() => i < step && setStep(i)}>
                {s}
              </div>
            ))}
          </div>
        </div>

        <div style={S.body}>
          <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.03em", marginTop:0, marginBottom:6 }}>{currentStepName}</h2>

          {/* ── STEP 0: Event Type ── */}
          {step === 0 && (
            <div>
              <p style={{ color:"#6b6a7a", fontSize:13, marginBottom:24 }}>What kind of event are you organising?</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.id} onClick={() => handleTypeSelect(t.id)}
                    style={{ background:eventType===t.id?`${accent}15`:"#1c1c20", border:`1px solid ${eventType===t.id?accent+"50":"#2a2a30"}`, borderRadius:12, padding:"18px 12px", cursor:"pointer", textAlign:"center", fontFamily:"inherit", transition:"all 0.15s" }}>
                    <div style={{ fontSize:22, marginBottom:8, color:eventType===t.id?accent:"#6b6a7a" }}>{t.icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:eventType===t.id?"#f0eff4":"#9998a8" }}>{t.label}</div>
                  </button>
                ))}
              </div>
              {eventType && (
                <div style={{ marginTop:16, padding:"12px 16px", background:`${accent}08`, border:`1px solid ${accent}20`, borderRadius:10, fontSize:13, color:"#9998a8" }}>
                  {TYPE_PRESETS[eventType]?.description}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Feature Selection ── */}
          {step === 1 && (
            <div>
              <p style={{ color:"#6b6a7a", fontSize:13, marginBottom:20 }}>
                We've pre-selected features for a <strong style={{color:"#f0eff4"}}>{TYPE_PRESETS[eventType]?.label}</strong>. Toggle what you need — you can always change this later in event settings.
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {ALL_FEATURES.map(f => {
                  const on = features.includes(f.id);
                  const isSuggested = TYPE_PRESETS[eventType]?.suggested?.includes(f.id);
                  return (
                    <div key={f.id} onClick={() => toggleFeature(f.id)}
                      style={{ background:on?`${f.color}10`:"#1c1c20", border:`1px solid ${on?f.color+"40":"#2a2a30"}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start", transition:"all 0.15s", position:"relative" }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:on?`${f.color}20`:"#2a2a30", border:`1px solid ${on?f.color+"40":"transparent"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:on?f.color:"#6b6a7a", flexShrink:0, transition:"all 0.15s" }}>
                        {f.icon}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:on?"#f0eff4":"#9998a8" }}>{f.label}</span>
                          {isSuggested && <span style={{ fontSize:10, padding:"1px 5px", borderRadius:4, background:`${accent}20`, color:accent, fontWeight:600 }}>Suggested</span>}
                        </div>
                        <div style={{ fontSize:11, color:"#6b6a7a", lineHeight:1.5 }}>{f.desc}</div>
                      </div>
                      <div style={{ width:18, height:18, borderRadius:"50%", background:on?accent:"transparent", border:`2px solid ${on?accent:"#3a3a45"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                        {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:16, fontSize:12, color:"#6b6a7a" }}>{features.length} feature{features.length!==1?"s":""} selected</div>
            </div>
          )}

          {/* ── STEP 2: Details ── */}
          {step === 2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <label style={S.label}>Event Name *</label>
                <input value={event.name} onChange={e=>update("name",e.target.value)} placeholder="e.g. Summer Festival 2025" style={S.input}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div>
                  <label style={S.label}>Date *</label>
                  <input type="date" value={event.date} onChange={e=>update("date",e.target.value)} style={S.input}/>
                </div>
                <div>
                  <label style={S.label}>Time</label>
                  <input type="time" value={event.time} onChange={e=>update("time",e.target.value)} style={S.input}/>
                </div>
              </div>
              <div>
                <label style={S.label}>Description</label>
                <textarea value={event.description} onChange={e=>update("description",e.target.value)} rows={3} placeholder="A short description of your event…" style={{...S.input, resize:"vertical"}}/>
              </div>
            </div>
          )}

          {/* ── STEP 3: Venue ── */}
          {step === 3 && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <label style={S.label}>Venue Name</label>
                <input value={event.venue} onChange={e=>update("venue",e.target.value)} placeholder="e.g. Town Hall, Spark Arena" style={S.input}/>
              </div>
              <div>
                <label style={S.label}>Address</label>
                <input value={event.address} onChange={e=>update("address",e.target.value)} placeholder="Full address" style={S.input}/>
              </div>
              <div>
                <label style={S.label}>Capacity</label>
                <input type="number" value={event.capacity} onChange={e=>update("capacity",e.target.value)} placeholder="Max attendees" style={S.input}/>
              </div>
            </div>
          )}

          {/* ── OPTIONAL: Guests ── */}
          {steps[step] === "Guests" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <p style={{ color:"#6b6a7a", fontSize:13, margin:0 }}>Add initial guest emails — you can add more from the dashboard.</p>
              <div style={{ display:"flex", gap:10 }}>
                <input value={event.guestInput} onChange={e=>update("guestInput",e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addGuest()}
                  placeholder="guest@email.com" style={{...S.input,flex:1}}/>
                <button onClick={addGuest} style={S.btn}>Add</button>
              </div>
              {event.guests.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {event.guests.map(g => (
                    <div key={g} style={{ display:"flex", alignItems:"center", gap:6, background:"#1c1c20", border:"1px solid #2a2a30", borderRadius:20, padding:"5px 10px 5px 12px", fontSize:12 }}>
                      {g}
                      <button onClick={()=>update("guests",event.guests.filter(x=>x!==g))} style={{ background:"none",border:"none",color:"#6b6a7a",cursor:"pointer",padding:0,fontSize:12,lineHeight:1 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── OPTIONAL: Tickets ── */}
          {steps[step] === "Tickets" && (
            <div>
              <p style={{ color:"#6b6a7a", fontSize:13, marginBottom:20 }}>Set up ticket tiers for your event. You can refine these in Ticket Hub after creation.</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {ticketTiers.map((tier, i) => (
                  <div key={i} style={{ background:"#1c1c20", border:"1px solid #2a2a30", borderRadius:12, padding:"16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>Tier {i+1}</span>
                      {ticketTiers.length > 1 && <button onClick={()=>removeTier(i)} style={{ background:"none",border:"none",color:"#6b6a7a",cursor:"pointer",fontSize:13,fontFamily:"inherit" }}>Remove</button>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                      <div>
                        <label style={S.label}>Name</label>
                        <input value={tier.name} onChange={e=>updateTier(i,"name",e.target.value)} placeholder="General Admission" style={S.input}/>
                      </div>
                      <div>
                        <label style={S.label}>Price (NZD)</label>
                        <input type="number" value={tier.price} onChange={e=>updateTier(i,"price",e.target.value)} placeholder="0.00" style={S.input}/>
                      </div>
                      <div>
                        <label style={S.label}>Capacity</label>
                        <input type="number" value={tier.capacity} onChange={e=>updateTier(i,"capacity",e.target.value)} placeholder="Unlimited" style={S.input}/>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addTier} style={{ ...S.ghost, fontSize:12 }}>+ Add Tier</button>
              </div>
            </div>
          )}

          {/* ── OPTIONAL: Budget ── */}
          {steps[step] === "Budget" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <label style={S.label}>Total Budget (NZD)</label>
                <input type="number" value={event.totalBudget} onChange={e=>update("totalBudget",e.target.value)} placeholder="10000" style={S.input}/>
              </div>
              <div>
                <label style={S.label}>Allocate by Category</label>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {budgetCategories.map(cat => (
                    <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:13, color:"#9998a8" }}>{cat.label}</span>
                      <input type="number" value={event.budgetSplit[cat.id]} onChange={e=>update("budgetSplit",{...event.budgetSplit,[cat.id]:e.target.value})}
                        placeholder="0" style={{...S.input, width:120, textAlign:"right"}}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── FINAL: Review ── */}
          {steps[step] === "Review" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:"#1c1c20", borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:11, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Event Details</div>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{event.name || <span style={{color:"#6b6a7a"}}>Unnamed Event</span>}</div>
                <div style={{ fontSize:13, color:"#9998a8" }}>
                  {TYPE_PRESETS[eventType]?.label}
                  {event.date && ` · ${new Date(event.date).toLocaleDateString("en-NZ",{day:"numeric",month:"long",year:"numeric"})}`}
                  {event.time && ` at ${event.time}`}
                </div>
                {event.venue && <div style={{ fontSize:13, color:"#9998a8", marginTop:4 }}>{event.venue}{event.address && `, ${event.address}`}</div>}
              </div>
              <div style={{ background:"#1c1c20", borderRadius:12, padding:"16px 18px" }}>
                <div style={{ fontSize:11, color:"#6b6a7a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Enabled Features</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {["overview",...features].map(fid => {
                    const f = ALL_FEATURES.find(x=>x.id===fid) || { label:"Overview", icon:"◈", color:accent };
                    return (
                      <span key={fid} style={{ fontSize:12, padding:"3px 10px", borderRadius:20, background:`${f.color}12`, color:f.color, border:`1px solid ${f.color}30`, fontWeight:500 }}>
                        {f.icon} {f.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              {error && <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"12px 14px", fontSize:13, color:"#ef4444" }}>{error}</div>}
            </div>
          )}

          {/* ── Navigation ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:32, paddingTop:24, borderTop:"1px solid #1c1c20" }}>
            <button onClick={prevStep} style={{ ...S.ghost, opacity:step===0?0.3:1 }} disabled={step===0}>← Back</button>
            {steps[step] === "Review"
              ? <button onClick={handleCreate} disabled={saving || !event.name || !event.date}
                  style={{ ...S.btn, opacity:(saving||!event.name||!event.date)?0.5:1, minWidth:120 }}>
                  {saving ? "Creating…" : "Create Event →"}
                </button>
              : <button onClick={nextStep} disabled={!canNext()} style={{ ...S.btn, opacity:!canNext()?0.4:1 }}>Continue →</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
