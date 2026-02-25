// ============================================================
//  src/components/EditEventModal.jsx
//  Edit key event details — drop this into your dashboard
// ============================================================
import { useState, useEffect, useRef, useCallback } from "react";

const ALL_FEATURES = [
  { id:"guests",        label:"Guest Management",   icon:"◉", color:"#6366f1" },
  { id:"budget",        label:"Budget Tracker",      icon:"◎", color:"#22c55e" },
  { id:"playlist",      label:"Playlist",            icon:"♫", color:"#8b5cf6" },
  { id:"polls",         label:"Polls",               icon:"◐", color:"#f59e0b" },
  { id:"vendors",       label:"Vendors",             icon:"◇", color:"#06b6d4" },
  { id:"collab",        label:"Collaborate",         icon:"◈", color:"#ec4899" },
  { id:"checklist",     label:"Checklist",           icon:"☑", color:"#10b981" },
  { id:"queue",         label:"Virtual Queue",       icon:"↕", color:"#8b5cf6" },
  { id:"operations",    label:"Operations",          icon:"⚙️", color:"#0ea5e9" },
  { id:"sitemap",       label:"Site Map",            icon:"🗺️", color:"#8b5cf6" },
  { id:"notifications", label:"Notifications",       icon:"🔔", color:"#ff4d00" },
  { id:"tickets",       label:"Ticket Hub",          icon:"▣", color:"#f97316" },
  { id:"checkin",       label:"Check-in",            icon:"✓", color:"#4ade80" },
  { id:"staff",         label:"Staff & Timesheets",  icon:"⏱", color:"#60a5fa" },
];
import { supabase } from "../lib/supabase";

const EVENT_TYPES = [
  { id: "gig",       label: "Music Gig",    icon: "🎸" },
  { id: "ball",      label: "Ball / Formal", icon: "🥂" },
  { id: "party",     label: "Party",         icon: "🎉" },
  { id: "wedding",   label: "Wedding",       icon: "💍" },
  { id: "birthday",  label: "Birthday",      icon: "🎂" },
  { id: "corporate", label: "Corporate",     icon: "🏢" },
  { id: "festival",  label: "Festival",      icon: "🎪" },
  { id: "other",     label: "Other",         icon: "✨" },
];

export default function EditEventModal({ event, onClose, onSave }) {
  const [form, setForm] = useState({
    name:         event.name         || "",
    type:         event.type         || "",
    date:         event.date         || "",
    time:         event.time?.slice(0, 5) || "",
    description:  event.description  || "",
    venue_name:   event.venue_name   || "",
    venue_address:event.venue_address|| "",
    capacity:     event.capacity     || "",
    total_budget: event.total_budget || "",
  });
  const [features, setFeatures] = useState(
    Array.isArray(event.enabled_features)
      ? event.enabled_features.filter(f => f !== "overview")
      : []
  );
  const toggleFeature = (id) =>
    setFeatures(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);

  // ── Address autocomplete ────────────────────────────────────
  const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [placeSuggs,    setPlaceSuggs]    = useState([]);
  const [showSuggs,     setShowSuggs]     = useState(false);
  const [mapCoords,     setMapCoords]     = useState(
    event.venue_address ? { label: event.venue_address } : null
  );
  const [placeLoading,  setPlaceLoading]  = useState(false);
  const suggestTimer = useRef(null);

  useEffect(() => {
    if (!MAPS_KEY || window.google?.maps) return;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    s.async = true;
    document.head.appendChild(s);
  }, [MAPS_KEY]);

  const fetchSuggs = useCallback((input) => {
    if (!input || input.length < 3 || !window.google?.maps?.places) {
      setPlaceSuggs([]); return;
    }
    setPlaceLoading(true);
    new window.google.maps.places.AutocompleteService().getPlacePredictions(
      { input, types: ["establishment", "geocode"] },
      (predictions, status) => {
        setPlaceLoading(false);
        if (status === "OK" && predictions) {
          setPlaceSuggs(predictions.slice(0, 5));
          setShowSuggs(true);
        } else setPlaceSuggs([]);
      }
    );
  }, []);

  const handleAddrChange = (val) => {
    update("venue_address", val);
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggs(val), 300);
  };

  const selectPlace = (p) => {
    update("venue_address", p.description);
    if (!form.venue_name) update("venue_name", p.structured_formatting?.main_text || "");
    setShowSuggs(false); setPlaceSuggs([]);
    if (window.google?.maps?.places) {
      new window.google.maps.places.PlacesService(document.createElement("div"))
        .getDetails({ placeId: p.place_id, fields: ["geometry"] }, (place, status) => {
          if (status === "OK" && place?.geometry?.location) {
            setMapCoords({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), label: p.description });
          }
        });
    } else {
      setMapCoords({ label: p.description });
    }
  };
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Event name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("events")
        .update({
          name:             form.name.trim(),
          type:             form.type,
          date:             form.date,
          time:             form.time,
          description:      form.description,
          venue_name:       form.venue_name,
          venue_address:    form.venue_address,
          capacity:         form.capacity ? parseInt(form.capacity) : null,
          total_budget:     form.total_budget ? parseFloat(form.total_budget) : 0,
          enabled_features: ["overview", ...features],
          updated_at:       new Date().toISOString(),
        })
        .eq("id", event.id)
        .select()
        .single();
      if (error) throw error;
      onSave(data); // bubble updated event up to Dashboard
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24, backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <style>{`
        .ef-field { background: #13131f; border: 1px solid #1e1e2e; border-radius: var(--radius,3px); padding: 11px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'Barlow', sans-serif; width: 100%; transition: border-color 0.2s; }
        .ef-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(255,77,0,0.08); }
        .ef-field::placeholder { color: #2e2e42; }
        .ef-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; }
        .ef-type-btn { background: #13131f; border: 1px solid #1e1e2e; border-radius: var(--radius,3px); padding: 10px 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: all 0.18s; }
        .ef-type-btn:hover { border-color: rgba(255,77,0,0.3); background: rgba(255,77,0,0.05); }
        .ef-type-btn.sel { border-color: var(--accent); background: rgba(255,77,0,0.1); }
        .ef-btn-gold { background: linear-gradient(135deg,var(--accent),#a8872e); color: #080810; border: none; padding: 12px 24px; border-radius: var(--radius,3px); font-family: 'Barlow',sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .ef-btn-gold:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,77,0,0.25); }
        .ef-btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
        .ef-btn-ghost { background: transparent; color: #5a5a72; border: 1px solid #1e1e2e; padding: 12px 24px; border-radius: var(--radius,3px); font-family: 'Barlow',sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .ef-btn-ghost:hover { color: #e2d9cc; border-color: #3a3a52; }
        @keyframes modalIn { from { opacity:0; transform: scale(0.96) translateY(12px); } to { opacity:1; transform: scale(1) translateY(0); } }
        .ef-modal { animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>

      <div
        className="ef-modal"
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius:"var(--radiusLg,4px)", width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", borderTop: "3px solid var(--accent)" }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "inherit, serif", fontFamily:"'Bebas Neue','Arial Black',Arial,sans-serif", fontSize:"2rem", letterSpacing:"0.02em", lineHeight:0.95, fontWeight:900, color: "var(--text)", marginBottom: 4 }}>Edit Event</h2>
            <p style={{ fontSize: 13, color: "var(--text2)", fontWeight: 300 }}>Changes save immediately to your dashboard.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--text)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>×</button>
        </div>

        <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Name */}
          <div>
            <label className="ef-label">Event Name</label>
            <input className="ef-field" value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Summer Rooftop Gig" />
          </div>

          {/* Type */}
          <div>
            <label className="ef-label">Event Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {EVENT_TYPES.map(t => (
                <button key={t.id} className={`ef-type-btn${form.type === t.id ? " sel" : ""}`} onClick={() => update("type", t.id)}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <span style={{ fontSize: 11, color: form.type === t.id ? "var(--accent)" : "var(--text2)", fontWeight: 500 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="ef-label">Date</label>
              <input className="ef-field" type="date" value={form.date} onChange={e => update("date", e.target.value)} style={{ colorScheme: "dark" }} />
            </div>
            <div>
              <label className="ef-label">Time</label>
              <input className="ef-field" type="time" value={form.time} onChange={e => update("time", e.target.value)} style={{ colorScheme: "dark" }} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="ef-label">Description</label>
            <textarea className="ef-field" rows={3} value={form.description} onChange={e => update("description", e.target.value)} placeholder="Give guests a taste of what to expect…" style={{ resize: "vertical" }} />
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1.5px solid var(--border)" }} />

          {/* Venue */}
          <div>
            <label className="ef-label">Venue Name</label>
            <input className="ef-field" value={form.venue_name} onChange={e => update("venue_name", e.target.value)} placeholder="e.g. The Civic Rooftop" />
          </div>

          <div style={{ position:"relative" }}>
            <label className="ef-label">
              Address
              {!MAPS_KEY && <span style={{ fontWeight:400, fontSize:10, color:"var(--text3)", marginLeft:6, textTransform:"none", letterSpacing:0 }}>(add VITE_GOOGLE_MAPS_API_KEY for autocomplete)</span>}
            </label>
            <div style={{ position:"relative" }}>
              <input className="ef-field" value={form.venue_address}
                onChange={e=>handleAddrChange(e.target.value)}
                onFocus={()=>{ if(placeSuggs.length) setShowSuggs(true); }}
                onBlur={()=>setTimeout(()=>setShowSuggs(false),180)}
                placeholder="Start typing an address…"
                autoComplete="off"
              />
              {placeLoading && (
                <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                  width:13, height:13, border:"2px solid var(--border)",
                  borderTopColor:"var(--accent)", borderRadius:"50%",
                  animation:"emSpin 0.7s linear infinite" }}/>
              )}
            </div>
            {showSuggs && placeSuggs.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:9999,
                background:"var(--bg2)", border:"1px solid var(--accentBorder)",
                borderRadius:"var(--radiusLg,4px)", overflow:"hidden",
                boxShadow:"0 8px 32px rgba(0,0,0,0.5)", marginTop:4 }}>
                {placeSuggs.map((p,i)=>(
                  <button key={p.place_id} onMouseDown={()=>selectPlace(p)}
                    style={{ display:"block", width:"100%", textAlign:"left",
                      padding:"10px 14px", background:"none", border:"none",
                      borderBottom: i<placeSuggs.length-1?"1px solid var(--border)":"none",
                      cursor:"pointer", fontFamily:"inherit" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <div style={{ fontSize:13, color:"var(--text)", fontWeight:600, marginBottom:2 }}>
                      {p.structured_formatting?.main_text || p.description}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text3)" }}>
                      {p.structured_formatting?.secondary_text || ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {mapCoords && MAPS_KEY && (
              <div style={{ marginTop:10, borderRadius:"var(--radiusLg,4px)", overflow:"hidden",
                border:"1px solid var(--accentBorder)" }}>
                <iframe title="map" width="100%" height="180" frameBorder="0"
                  style={{ display:"block" }} referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodeURIComponent(mapCoords.label)}&zoom=15`}/>
              </div>
            )}
            <style>{`@keyframes emSpin { to { transform:translateY(-50%) rotate(360deg); } }`}</style>
          </div>

          {/* Features */}
          <div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 4 }}>
              <label className="ef-label" style={{ marginBottom: 12, display:"block" }}>Active Features</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
                {ALL_FEATURES.map(f => {
                  const on = features.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFeature(f.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "9px 10px",
                        background: on ? `${f.color}14` : "var(--bg3)",
                        border: `1.5px solid ${on ? f.color + "50" : "var(--border)"}`,
                        borderRadius: "var(--radius,3px)",
                        cursor: "pointer", transition: "all 0.12s",
                        fontFamily: "inherit",
                      }}
                      title={f.label}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{f.icon}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        fontFamily: "'Barlow Condensed', Arial, sans-serif",
                        letterSpacing: "0.04em",
                        color: on ? f.color : "var(--text2)",
                        textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap",
                      }}>{f.label}</span>
                      {on && (
                        <span style={{ marginLeft:"auto", width:7, height:7, borderRadius:"50%",
                          background: f.color, flexShrink:0 }}/>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
                Tap to toggle — changes take effect immediately after saving.
              </div>
            </div>
          </div>

          {/* Capacity + Budget */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="ef-label">Capacity</label>
              <input className="ef-field" type="number" value={form.capacity} onChange={e => update("capacity", e.target.value)} placeholder="e.g. 150" />
            </div>
            <div>
              <label className="ef-label">Total Budget (NZD)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--accent)", fontWeight: 500, fontSize: 14, pointerEvents: "none" }}>$</span>
                <input className="ef-field" type="number" value={form.total_budget} onChange={e => update("total_budget", e.target.value)} placeholder="0.00" style={{ paddingLeft: 26 }} />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius:"var(--radius,3px)", padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button className="ef-btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button className="ef-btn-gold" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
