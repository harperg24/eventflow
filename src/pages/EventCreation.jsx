// ============================================================
//  EventCreation.jsx  —  New event wizard with feature selection
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, createEvent } from "../lib/supabase";
import { useAppTheme } from "./Home";
import { globalCSS } from "./theme";

const ALL_FEATURES = [
  { id:"guests",    label:"Guest Management",    desc:"Invites, RSVPs, reminders.",            icon:"◉", color:"#6366f1" },
  { id:"budget",    label:"Budget Tracker",       desc:"Expenses, categories, remaining.",      icon:"◎", color:"#22c55e" },
  { id:"playlist",  label:"Playlist",             desc:"Curated music + guest requests.",       icon:"♫", color:"#8b5cf6" },
  { id:"polls",     label:"Polls",                desc:"Vote on decisions with guests.",        icon:"◐", color:"#f59e0b" },
  { id:"vendors",   label:"Vendors",              desc:"Suppliers, caterers, photographers.",   icon:"◇", color:"#06b6d4" },
  { id:"collab",    label:"Collaborate",          desc:"Co-organisers with access roles.",      icon:"◈", color:"#ec4899" },
  { id:"checklist", label:"Checklist",            desc:"Tasks and to-dos with due dates.",      icon:"☑", color:"#10b981" },
  { id:"queue",         label:"Virtual Queue",       desc:"Online queue for stations & activities.", icon:"↕", color:"#8b5cf6" },
  { id:"operations",   label:"Operations",          desc:"Riders, inventory, incidents, H&S.",       icon:"⚙️", color:"#0ea5e9" },
  { id:"notifications", label:"Notifications",       desc:"Automated reminders & custom messages.",  icon:"🔔", color:"#5b5bd6" },
  { id:"tickets",       label:"Ticket Hub",          desc:"Sell tickets via Stripe.",                icon:"▣", color:"#f97316" },
  { id:"checkin",   label:"Check-in",             desc:"QR code scanning at the door.",         icon:"✓", color:"#4ade80" },
  { id:"staff",     label:"Staff & Timesheets",   desc:"Schedules, clock-in, payroll.",         icon:"⏱", color:"#60a5fa" },
];

const TYPE_PRESETS = {
  gig:       { label:"Music Gig",      icon:"♫", suggested:["guests","budget","playlist","vendors","checklist","operations","notifications","tickets","checkin","staff"] },
  ball:      { label:"Ball / Formal",  icon:"◇", suggested:["guests","budget","playlist","vendors","collab","checklist","notifications","queue","checkin"] },
  party:     { label:"Party",          icon:"◆", suggested:["guests","budget","playlist","polls","checklist"] },
  wedding:   { label:"Wedding",        icon:"◇", suggested:["guests","budget","playlist","polls","vendors","collab","checklist"] },
  birthday:  { label:"Birthday",       icon:"◆", suggested:["guests","budget","playlist","polls","checklist"] },
  corporate: { label:"Corporate",      icon:"▣", suggested:["guests","budget","vendors","collab","checklist","staff"] },
  festival:  { label:"Festival",       icon:"◈", suggested:["guests","budget","playlist","vendors","collab","checklist","operations","queue","tickets","checkin","staff"] },
  other:     { label:"Other",          icon:"◆", suggested:["guests","budget","checklist"] },
};

const BUDGET_CATS = [
  { id:"venue",         label:"Venue",         color:"#f59e0b" },
  { id:"catering",      label:"Catering",      color:"#10b981" },
  { id:"entertainment", label:"Entertainment", color:"#8b5cf6" },
  { id:"decorations",   label:"Decorations",   color:"#ec4899" },
  { id:"photography",   label:"Photography",   color:"#3b82f6" },
  { id:"misc",          label:"Miscellaneous", color:"#6b7280" },
];

export default function EventCreation() {
  const navigate = useNavigate();
  const [prefs, , t] = useAppTheme();
  const [step,       setStep]       = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [eventType,  setEventType]  = useState(null);
  const [features,   setFeatures]   = useState([]);
  const [ticketTiers,setTicketTiers]= useState([{ name:"General Admission", description:"", price:"", capacity:"" }]);
  const [event, setEvent] = useState({
    name:"", type:"", date:"", time:"", description:"",
    venue:"", address:"", capacity:"",
    guests:[], guestInput:"",
    totalBudget:"",
    budgetSplit:{ venue:"", catering:"", entertainment:"", decorations:"", photography:"", misc:"" },
  });

  const update = (k,v) => setEvent(p=>({...p,[k]:v}));
  const handleTypeSelect = (id) => { setEventType(id); setFeatures(TYPE_PRESETS[id]?.suggested||[]); update("type",id); };
  const toggleFeature = (id) => setFeatures(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);

  const hasTickets = features.includes("tickets");
  const hasGuests  = features.includes("guests");
  const hasBudget  = features.includes("budget");

  const steps = ["Event Type","Features","Details","Venue",...(hasGuests?["Guests"]:[]),(hasTickets?["Tickets"]:[]),...(hasBudget?["Budget"]:[]),"Review"].flat();
  const pct = Math.round(((step+1)/steps.length)*100);

  const canNext = () => {
    if (step===0) return !!eventType;
    if (step===1) return features.length>0;
    if (step===2) return !!event.name && !!event.date;
    return true;
  };

  const handleCreate = async () => {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required.");
      const cat = hasTickets ? (hasGuests?"hybrid":"ticketed") : "private";
      const newEvent = await createEvent({ ...event, ticketing:cat }, user.id, user.email);
      await supabase.from("events").update({ enabled_features:["overview",...features] }).eq("id",newEvent.id);
      if (hasTickets) {
        const rows = ticketTiers.filter(t=>t.name).map((t,i)=>({ event_id:newEvent.id, name:t.name, description:t.description||null, price:parseFloat(t.price)||0, capacity:parseInt(t.capacity)||null, sort_order:i }));
        if (rows.length) await supabase.from("ticket_tiers").insert(rows);
      }
      navigate(`/dashboard/${newEvent.id}`);
    } catch(e) { setError(e.message); setSaving(false); }
  };

  const StepLabel = ({i,label}) => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
      <div style={{ width:28, height:28, borderRadius:"50%", background: i<step?"var(--accent)":i===step?"var(--accent)":"var(--bg3)", border:`2px solid ${i<=step?"var(--accent)":"var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:i<=step?"#fff":"var(--text3)", transition:"all 0.2s", flexShrink:0 }}>
        {i<step ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : i+1}
      </div>
      <span style={{ fontSize:11, fontWeight:i===step?600:400, color:i===step?"var(--accent)":i<step?"var(--text2)":"var(--text3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:60, textAlign:"center" }}>{label}</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:t.font }}>
      <style>{globalCSS(t)}</style>

      {/* Top bar */}
      <div style={{ background:t.bg2, borderBottom:`1.5px solid ${t.border}`, padding:"0 32px", height:56, display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={()=>navigate("/home")} style={{ background:"none",border:"none",color:t.text2,cursor:"pointer",fontFamily:"inherit",fontSize:14,display:"flex",alignItems:"center",gap:6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Cancel
        </button>
        <div style={{ flex:1, textAlign:"center", fontSize:15, fontWeight:700, color:t.text, letterSpacing:"-0.02em" }}>Create Event</div>
        <div style={{ fontSize:13, color:t.text3 }}>Step {step+1} of {steps.length}</div>
      </div>

      {/* Progress + step dots */}
      <div style={{ background:t.bg2, borderBottom:`1.5px solid ${t.border}`, padding:"16px 32px" }}>
        <div style={{ maxWidth:700, margin:"0 auto" }}>
          <div style={{ position:"relative", marginBottom:16 }}>
            <div style={{ height:3, background:t.bg3, borderRadius:99 }}/>
            <div style={{ height:3, background:"var(--accent)", borderRadius:99, width:`${pct}%`, position:"absolute", top:0, left:0, transition:"width 0.35s ease" }}/>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {steps.map((s,i) => <StepLabel key={i} i={i} label={s}/>)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:700, margin:"0 auto", padding:"40px 32px" }} className="ef-fade-up">
        <h2 style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.04em", color:t.text, marginBottom:6 }}>{steps[step]}</h2>

        {/* STEP 0 — type */}
        {step===0 && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:28 }}>What kind of event are you planning?</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {Object.entries(TYPE_PRESETS).map(([id,tp]) => (
                <button key={id} onClick={()=>handleTypeSelect(id)}
                  style={{ background:eventType===id?"var(--accentBg)":t.bg2, border:`2px solid ${eventType===id?"var(--accent)":t.border}`, borderRadius:12, padding:"20px 12px", cursor:"pointer", textAlign:"center", fontFamily:"inherit", transition:"all 0.15s" }}
                  onMouseEnter={e=>{if(eventType!==id){e.currentTarget.style.borderColor="var(--accentBorder)";}}}
                  onMouseLeave={e=>{if(eventType!==id){e.currentTarget.style.borderColor=t.border;}}}>
                  <div style={{ fontSize:26, marginBottom:10, color:eventType===id?"var(--accent)":t.text3 }}>{tp.icon}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:eventType===id?"var(--accent)":t.text2 }}>{tp.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — features */}
        {step===1 && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:24 }}>
              Pre-selected for a <strong style={{ color:t.text }}>{TYPE_PRESETS[eventType]?.label}</strong>. Toggle what you need — change anytime in settings.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {ALL_FEATURES.map(f => {
                const on = features.includes(f.id);
                const suggested = TYPE_PRESETS[eventType]?.suggested?.includes(f.id);
                return (
                  <div key={f.id} onClick={()=>toggleFeature(f.id)}
                    style={{ background:on?`${f.color}0e`:t.bg2, border:`2px solid ${on?f.color+"40":t.border}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start", transition:"all 0.15s" }}
                    onMouseEnter={e=>{if(!on)e.currentTarget.style.borderColor=f.color+"30";}}
                    onMouseLeave={e=>{if(!on)e.currentTarget.style.borderColor=t.border;}}>
                    <div style={{ width:34, height:34, borderRadius:9, background:on?`${f.color}18`:t.bg3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, color:on?f.color:t.text3, flexShrink:0, transition:"all 0.15s" }}>{f.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:on?t.text:t.text2 }}>{f.label}</span>
                        {suggested && <span style={{ fontSize:10, padding:"1px 6px", borderRadius:4, background:"var(--accentBg)", color:"var(--accent)", fontWeight:700 }}>Suggested</span>}
                      </div>
                      <div style={{ fontSize:12, color:t.text3, lineHeight:1.5 }}>{f.desc}</div>
                    </div>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:on?"var(--accent)":"transparent", border:`2px solid ${on?"var(--accent)":t.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:13, color:t.text3 }}>{features.length} feature{features.length!==1?"s":""} selected</div>
          </div>
        )}

        {/* STEP 2 — details */}
        {step===2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            <p style={{ color:t.text2, fontSize:15, marginBottom:28 }}>Tell us about your event.</p>
            <div className="ef-form-row">
              <label className="ef-label">Event Name *</label>
              <input className="ef-input" value={event.name} onChange={e=>update("name",e.target.value)} placeholder="e.g. Summer Festival 2025" style={{ fontSize:16, padding:"12px 14px" }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div className="ef-form-row">
                <label className="ef-label">Date *</label>
                <input type="date" className="ef-input" value={event.date} onChange={e=>update("date",e.target.value)}/>
              </div>
              <div className="ef-form-row">
                <label className="ef-label">Start Time</label>
                <input type="time" className="ef-input" value={event.time} onChange={e=>update("time",e.target.value)}/>
              </div>
            </div>
            <div className="ef-form-row">
              <label className="ef-label">Description</label>
              <textarea className="ef-input" value={event.description} onChange={e=>update("description",e.target.value)} rows={3} placeholder="A short description of your event…" style={{ resize:"vertical" }}/>
            </div>
          </div>
        )}

        {/* STEP 3 — venue */}
        {step===3 && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:28 }}>Where is it taking place?</p>
            <div className="ef-form-row"><label className="ef-label">Venue Name</label><input className="ef-input" value={event.venue} onChange={e=>update("venue",e.target.value)} placeholder="e.g. Spark Arena"/></div>
            <div className="ef-form-row"><label className="ef-label">Address</label><input className="ef-input" value={event.address} onChange={e=>update("address",e.target.value)} placeholder="Full street address"/></div>
            <div className="ef-form-row"><label className="ef-label">Capacity</label><input type="number" className="ef-input" value={event.capacity} onChange={e=>update("capacity",e.target.value)} placeholder="Maximum attendees"/></div>
          </div>
        )}

        {/* OPTIONAL: Guests */}
        {steps[step]==="Guests" && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:28 }}>Add initial guests — add more from the dashboard later.</p>
            <div className="ef-form-row">
              <label className="ef-label">Guest Email</label>
              <div style={{ display:"flex", gap:10 }}>
                <input className="ef-input" value={event.guestInput} onChange={e=>update("guestInput",e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){const em=event.guestInput.trim();if(em&&!event.guests.includes(em)){update("guests",[...event.guests,em]);update("guestInput","");}}}} placeholder="guest@email.com" style={{ flex:1 }}/>
                <button className="ef-btn" onClick={()=>{const em=event.guestInput.trim();if(em&&!event.guests.includes(em)){update("guests",[...event.guests,em]);update("guestInput","");}}}>Add</button>
              </div>
            </div>
            {event.guests.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{event.guests.map(g=><div key={g} style={{ display:"flex",alignItems:"center",gap:6,background:t.bg3,border:`1.5px solid ${t.border}`,borderRadius:20,padding:"5px 12px",fontSize:13 }}>{g}<button onClick={()=>update("guests",event.guests.filter(x=>x!==g))} style={{ background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:14,lineHeight:1,padding:0 }}>×</button></div>)}</div>}
          </div>
        )}

        {/* OPTIONAL: Tickets */}
        {steps[step]==="Tickets" && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:24 }}>Set up ticket tiers — refine these in Ticket Hub after creation.</p>
            {ticketTiers.map((tier,i)=>(
              <div key={i} className="ef-card" style={{ padding:"18px 20px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:t.text }}>Tier {i+1}</span>
                  {ticketTiers.length>1 && <button onClick={()=>setTicketTiers(ts=>ts.filter((_,j)=>j!==i))} style={{ background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:13,fontFamily:"inherit" }}>Remove</button>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12 }}>
                  {[["name","Tier Name","text","General Admission"],["price","Price (NZD)","number","0.00"],["capacity","Capacity","number","Unlimited"]].map(([k,l,type,ph])=>(
                    <div key={k}><label className="ef-label">{l}</label><input type={type} className="ef-input" value={tier[k]} onChange={e=>setTicketTiers(ts=>ts.map((t,j)=>j===i?{...t,[k]:e.target.value}:t))} placeholder={ph}/></div>
                  ))}
                </div>
              </div>
            ))}
            <button className="ef-btn ef-btn-ghost" style={{ width:"100%", marginTop:4 }} onClick={()=>setTicketTiers(ts=>[...ts,{name:"",description:"",price:"",capacity:""}])}>+ Add Tier</button>
          </div>
        )}

        {/* OPTIONAL: Budget */}
        {steps[step]==="Budget" && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:24 }}>Set your overall budget and allocate by category.</p>
            <div className="ef-form-row"><label className="ef-label">Total Budget (NZD)</label><input type="number" className="ef-input" value={event.totalBudget} onChange={e=>update("totalBudget",e.target.value)} placeholder="10,000" style={{ fontSize:18, padding:"12px 14px" }}/></div>
            <div className="ef-form-row">
              <label className="ef-label">Allocate by Category</label>
              {BUDGET_CATS.map(cat=>(
                <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:14, color:t.text2 }}>{cat.label}</span>
                  <input type="number" className="ef-input" value={event.budgetSplit[cat.id]} onChange={e=>update("budgetSplit",{...event.budgetSplit,[cat.id]:e.target.value})} placeholder="0" style={{ width:120, textAlign:"right" }}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REVIEW */}
        {steps[step]==="Review" && (
          <div>
            <p style={{ color:t.text2, fontSize:15, marginBottom:28 }}>Everything look right? You can change any of this later.</p>
            <div className="ef-card" style={{ padding:"20px 22px", marginBottom:14 }}>
              <div className="ef-section-label">Event</div>
              <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", color:t.text, marginBottom:4 }}>{event.name||<span style={{color:t.text3}}>Untitled</span>}</div>
              <div style={{ fontSize:14, color:t.text2 }}>
                {TYPE_PRESETS[eventType]?.label}
                {event.date && ` · ${new Date(event.date).toLocaleDateString("en-NZ",{day:"numeric",month:"long",year:"numeric"})}`}
                {event.time && ` at ${event.time}`}
              </div>
              {(event.venue||event.address) && <div style={{ fontSize:14, color:t.text3, marginTop:4 }}>{[event.venue,event.address].filter(Boolean).join(", ")}</div>}
            </div>
            <div className="ef-card" style={{ padding:"20px 22px" }}>
              <div className="ef-section-label">Features ({features.length})</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:10 }}>
                {features.map(fid=>{const f=ALL_FEATURES.find(x=>x.id===fid)||{label:fid,icon:"◆",color:"#6b7280"};return(
                  <span key={fid} style={{ fontSize:13, padding:"4px 12px", borderRadius:20, background:`${f.color}10`, color:f.color, border:`1px solid ${f.color}25`, fontWeight:600 }}>{f.icon} {f.label}</span>
                );})}
              </div>
            </div>
            {error && <div style={{ marginTop:14, background:"rgba(220,38,38,0.08)", border:"1.5px solid rgba(220,38,38,0.2)", borderRadius:9, padding:"12px 14px", fontSize:14, color:"#dc2626" }}>{error}</div>}
          </div>
        )}

        {/* Nav buttons */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:36, paddingTop:28, borderTop:`1.5px solid ${t.border}` }}>
          <button className="ef-btn ef-btn-ghost" onClick={()=>setStep(s=>s-1)} disabled={step===0} style={{ opacity:step===0?0:1 }}>← Back</button>
          {steps[step]==="Review"
            ? <button className="ef-btn ef-btn-lg" onClick={handleCreate} disabled={saving||!event.name||!event.date} style={{ opacity:(saving||!event.name||!event.date)?0.5:1, minWidth:140 }}>{saving?"Creating…":"Create Event →"}</button>
            : <button className="ef-btn ef-btn-lg" onClick={()=>setStep(s=>s+1)} disabled={!canNext()} style={{ opacity:!canNext()?0.4:1 }}>Continue →</button>
          }
        </div>
      </div>
    </div>
  );
}
