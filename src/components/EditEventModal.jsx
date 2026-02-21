// ============================================================
//  src/components/EditEventModal.jsx
//  Edit key event details — drop this into your dashboard
// ============================================================
import { useState } from "react";
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
          name:          form.name.trim(),
          type:          form.type,
          date:          form.date,
          time:          form.time,
          description:   form.description,
          venue_name:    form.venue_name,
          venue_address: form.venue_address,
          capacity:      form.capacity ? parseInt(form.capacity) : null,
          total_budget:  form.total_budget ? parseFloat(form.total_budget) : 0,
          updated_at:    new Date().toISOString(),
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
        .ef-field { background: #13131f; border: 1px solid #1e1e2e; border-radius: 9px; padding: 11px 14px; color: #e2d9cc; font-size: 14px; outline: none; font-family: 'DM Sans', sans-serif; width: 100%; transition: border-color 0.2s; }
        .ef-field:focus { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,0.08); }
        .ef-field::placeholder { color: #2e2e42; }
        .ef-label { display: block; font-size: 11px; color: #5a5a72; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; }
        .ef-type-btn { background: #13131f; border: 1px solid #1e1e2e; border-radius: 10px; padding: 10px 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: all 0.18s; }
        .ef-type-btn:hover { border-color: rgba(201,168,76,0.3); background: rgba(201,168,76,0.05); }
        .ef-type-btn.sel { border-color: #c9a84c; background: rgba(201,168,76,0.1); }
        .ef-btn-gold { background: linear-gradient(135deg,#c9a84c,#a8872e); color: #080810; border: none; padding: 12px 24px; border-radius: 9px; font-family: 'DM Sans',sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .ef-btn-gold:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(201,168,76,0.25); }
        .ef-btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
        .ef-btn-ghost { background: transparent; color: #5a5a72; border: 1px solid #1e1e2e; padding: 12px 24px; border-radius: 9px; font-family: 'DM Sans',sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .ef-btn-ghost:hover { color: #e2d9cc; border-color: #3a3a52; }
        @keyframes modalIn { from { opacity:0; transform: scale(0.96) translateY(12px); } to { opacity:1; transform: scale(1) translateY(0); } }
        .ef-modal { animation: modalIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>

      <div
        className="ef-modal"
        onClick={e => e.stopPropagation()}
        style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 18, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#e2d9cc", marginBottom: 4 }}>Edit Event</h2>
            <p style={{ fontSize: 13, color: "#5a5a72", fontWeight: 300 }}>Changes save immediately to your dashboard.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#3a3a52", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4, transition: "color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#e2d9cc"} onMouseLeave={e=>e.currentTarget.style.color="#3a3a52"}>×</button>
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
                  <span style={{ fontSize: 11, color: form.type === t.id ? "#c9a84c" : "#5a5a72", fontWeight: 500 }}>{t.label}</span>
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
          <div style={{ borderTop: "1px solid #141420" }} />

          {/* Venue */}
          <div>
            <label className="ef-label">Venue Name</label>
            <input className="ef-field" value={form.venue_name} onChange={e => update("venue_name", e.target.value)} placeholder="e.g. The Civic Rooftop" />
          </div>

          <div>
            <label className="ef-label">Address</label>
            <input className="ef-field" value={form.venue_address} onChange={e => update("venue_address", e.target.value)} placeholder="Street address, city" />
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
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#c9a84c", fontWeight: 500, fontSize: 14, pointerEvents: "none" }}>$</span>
                <input className="ef-field" type="number" value={form.total_budget} onChange={e => update("total_budget", e.target.value)} placeholder="0.00" style={{ paddingLeft: 26 }} />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
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
