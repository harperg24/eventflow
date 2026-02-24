// ============================================================
//  EventSettings.jsx  —  Per-event settings tab in Dashboard
// ============================================================
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, getTheme } from "./theme";

const ALL_FEATURES = [
  { id:"guests",    label:"Guest Management", desc:"Invite guests, track RSVPs.",             icon:"◉", color:"#818cf8" },
  { id:"budget",    label:"Budget Tracker",   desc:"Track spending and budget allocations.",  icon:"◎", color:"#22c55e" },
  { id:"playlist",  label:"Playlist",         desc:"Music curation and guest song requests.", icon:"♫", color:"#a78bfa" },
  { id:"polls",     label:"Polls",            desc:"Guest voting and preference gathering.",  icon:"◐", color:"#f59e0b" },
  { id:"vendors",   label:"Vendors",          desc:"Manage suppliers and service providers.", icon:"◇", color:"#06b6d4" },
  { id:"collab",    label:"Collaborate",      desc:"Invite co-organisers with access roles.", icon:"◈", color:"#f472b6" },
  { id:"checklist", label:"Checklist",        desc:"Task management with due dates.",         icon:"☑", color:"#34d399" },
  { id:"queue",         label:"Virtual Queue",    desc:"Online queue for stations & activities.", icon:"↕",  color:"#8b5cf6" },
  { id:"operations",   label:"Operations",       desc:"Riders, inventory, incidents, H&S.",      icon:"⚙️", color:"#0ea5e9" },
  { id:"sitemap",     label:"Site Map",         desc:"Visual event layout with drag-and-drop.",  icon:"🗺️", color:"#8b5cf6" },
  { id:"notifications", label:"Notifications",   desc:"Automated reminders & custom guest messages.", icon:"🔔", color:"#5b50d6" },
  { id:"tickets",   label:"Ticket Hub",       desc:"Online ticketing with Stripe.",           icon:"▣", color:"#fb923c" },
  { id:"checkin",   label:"Check-in",         desc:"QR code scanning at the door.",           icon:"✓", color:"#4ade80" },
  { id:"staff",     label:"Staff & Timesheets",desc:"Schedules, clock-in, payroll.",          icon:"⏱", color:"#60a5fa" },
];

export default function EventSettings({ eventId, event, setEvent }) {
  const [features, setFeatures]   = useState([]);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [editField, setEditField] = useState(null);
  const [form, setForm]           = useState({});
  const __tp = loadThemePrefs(); const __t = getTheme(__tp);
  const [accent, setAccent]       = useState(__t.accent);
  const [danger, setDanger]       = useState(false);

  useEffect(() => {
    const a = document.documentElement.style.getPropertyValue("--accent");
    if (a) setAccent(a.trim());
    if (event?.enabled_features) setFeatures(event.enabled_features.filter(f => f !== "overview"));
    setForm({
      name:        event?.name || "",
      date:        event?.date || "",
      time:        event?.time || "",
      venue_name:  event?.venue_name || "",
      venue_address: event?.venue_address || "",
      capacity:    event?.capacity || "",
      description: event?.description || "",
      type:        event?.type || "",
    });
  }, [event]);

  const toggleFeature = (id) => setFeatures(f => f.includes(id) ? f.filter(x=>x!==id) : [...f, id]);

  const saveFeatures = async () => {
    setSaving(true);
    await supabase.from("events").update({ enabled_features: ["overview", ...features] }).eq("id", eventId);
    setEvent(ev => ({ ...ev, enabled_features: ["overview", ...features] }));
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveDetails = async (field, value) => {
    await supabase.from("events").update({ [field]: value }).eq("id", eventId);
    setEvent(ev => ({ ...ev, [field]: value }));
    setEditField(null);
  };

  const S = {
    card:   { background:"var(--bg2)", border:"1px solid #222228", borderRadius:12, overflow:"hidden" },
    label:  { display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 },
    input:  { width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1px solid #2a2a30", borderRadius:8, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"inherit" },
    btn:    { background:accent, border:"none", color:"#fff", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    ghost:  { background:"none", border:"1px solid #222228", color:"var(--text2)", borderRadius:8, padding:"9px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    row:    { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", borderBottom:"1px solid #1c1c20" },
  };

  const EditableRow = ({ label, fieldKey, type="text", value }) => {
    const [val, setVal] = useState(value || "");
    const isEditing = editField === fieldKey;
    return (
      <div style={S.row}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:"var(--text2)", marginBottom:3 }}>{label}</div>
          {isEditing
            ? (type === "textarea"
                ? <textarea value={val} onChange={e=>setVal(e.target.value)} rows={3} style={{...S.input, marginTop:4, resize:"vertical"}}/>
                : <input type={type} value={val} onChange={e=>setVal(e.target.value)} style={{...S.input, marginTop:4}}/>)
            : <div style={{ fontSize:13, color: val ? "var(--text)" : "var(--text2)" }}>{val || "—"}</div>
          }
        </div>
        <div style={{ marginLeft:16, flexShrink:0, display:"flex", gap:8 }}>
          {isEditing ? (
            <>
              <button onClick={() => saveDetails(fieldKey, val)} style={{...S.btn, fontSize:12, padding:"7px 14px"}}>Save</button>
              <button onClick={() => setEditField(null)} style={{...S.ghost, fontSize:12, padding:"7px 14px"}}>Cancel</button>
            </>
          ) : (
            <button onClick={() => { setVal(value||""); setEditField(fieldKey); }} style={{...S.ghost, fontSize:12, padding:"7px 12px"}}>Edit</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily:"'Inter','Helvetica Neue',sans-serif", color:"var(--text)" }}>
      <style>{`input:focus, select:focus, textarea:focus { border-color: ${accent} !important; outline: none; } * { box-sizing: border-box; }`}</style>
      <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.03em", marginBottom:6 }}>Event Settings</h1>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:28 }}>Manage features, details, and preferences for this event.</p>

      {/* ── Event Details ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:12, color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>Event Details</div>
        <div style={S.card}>
          <EditableRow label="Event Name"   fieldKey="name"          value={event?.name} />
          <EditableRow label="Date"         fieldKey="date"          value={event?.date} type="date" />
          <EditableRow label="End Date"     fieldKey="end_date"      value={event?.end_date} type="date" />
          <EditableRow label="Start Time"   fieldKey="time"          value={event?.time} type="time" />
          <EditableRow label="End Time"     fieldKey="end_time"      value={event?.end_time} type="time" />
          <EditableRow label="Venue"        fieldKey="venue_name"    value={event?.venue_name} />
          <EditableRow label="Address"      fieldKey="venue_address" value={event?.venue_address} />
          <EditableRow label="Capacity"     fieldKey="capacity"      value={event?.capacity} type="number" />
          <EditableRow label="Description"  fieldKey="description"   value={event?.description} type="textarea" />
        </div>
      </div>

      {/* ── Feature Toggles ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:12, color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>Features</div>
          <button onClick={saveFeatures} disabled={saving} style={{ ...S.btn, fontSize:12, padding:"7px 14px", opacity:saving?0.6:1 }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {ALL_FEATURES.map(f => {
            const on = features.includes(f.id);
            return (
              <div key={f.id} onClick={() => toggleFeature(f.id)}
                style={{ background:on?`${f.color}08`:"var(--bg3)", border:`1px solid ${on?f.color+"35":"var(--border)"}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all 0.15s" }}>
                <div style={{ width:30, height:30, borderRadius:8, background:on?`${f.color}18`:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:on?f.color:"var(--text2)", flexShrink:0 }}>
                  {f.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:on?"var(--text)":"var(--text2)", marginBottom:2 }}>{f.label}</div>
                  <div style={{ fontSize:11, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.desc}</div>
                </div>
                <div style={{ width:18, height:18, borderRadius:"50%", background:on?accent:"transparent", border:`2px solid ${on?accent:"#3a3a45"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                  {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:10, fontSize:12, color:"var(--text2)" }}>
          Overview is always enabled. {features.length} additional feature{features.length!==1?"s":""} active.
        </div>
      </div>

      {/* ── Invite Link ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:12, color:"var(--text2)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>Share & Invite</div>
        <div style={{ ...S.card, padding:"16px 18px" }}>
          <div style={{ fontSize:13, color:"var(--text2)", marginBottom:10 }}>RSVP link for guests:</div>
          <div style={{ display:"flex", gap:10 }}>
            <input readOnly value={event?.invite_slug ? `${window.location.origin}/rsvp/${event.invite_slug}` : "—"}
              style={{...S.input, flex:1, color:"var(--text2)", fontSize:12, fontFamily:"'Courier New',monospace"}}/>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rsvp/${event?.invite_slug}`)}
              style={{...S.ghost, fontSize:12, padding:"9px 14px", whiteSpace:"nowrap"}}>Copy Link</button>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div>
        <div style={{ fontSize:12, color:"#ef444460", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>Danger Zone</div>
        <div style={{ background:"#1a1010", border:"1px solid #3a2020", borderRadius:12, padding:"18px" }}>
          {!danger ? (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>Delete this event</div>
                <div style={{ fontSize:12, color:"var(--text2)" }}>This permanently removes the event and all associated data.</div>
              </div>
              <button onClick={() => setDanger(true)} style={{ background:"none", border:"1px solid #5a2020", color:"#ef4444", borderRadius:8, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Delete Event</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:13, color:"#ef4444", fontWeight:600, marginBottom:12 }}>Are you absolutely sure? This cannot be undone.</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setDanger(false)} style={S.ghost}>Cancel</button>
                <button onClick={async () => {
                  await supabase.from("events").delete().eq("id", eventId);
                  window.location.href = "/events";
                }} style={{ ...S.btn, background:"#ef4444" }}>Yes, Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
