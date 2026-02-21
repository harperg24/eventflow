// ============================================================
//  EventCreation.jsx  —  wired to Supabase
//  Replaces the standalone eventflow-mvp.jsx artifact
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, createEvent } from "../lib/supabase";

const steps = ["Details", "Venue", "Guests", "Budget", "Review"];

const eventTypes = [
  { id: "gig",       label: "Music Gig",    icon: "🎸" },
  { id: "ball",      label: "Ball / Formal", icon: "🥂" },
  { id: "party",     label: "Party",         icon: "🎉" },
  { id: "wedding",   label: "Wedding",       icon: "💍" },
  { id: "birthday",  label: "Birthday",      icon: "🎂" },
  { id: "corporate", label: "Corporate",     icon: "🏢" },
  { id: "festival",  label: "Festival",      icon: "🎪" },
  { id: "other",     label: "Other",         icon: "✨" },
];

const budgetCategories = [
  { id: "venue",         label: "Venue",          icon: "🏛️", color: "#f59e0b" },
  { id: "catering",      label: "Catering",        icon: "🍽️", color: "#10b981" },
  { id: "entertainment", label: "Entertainment",   icon: "🎵", color: "#8b5cf6" },
  { id: "decorations",   label: "Decorations",     icon: "🌸", color: "#ec4899" },
  { id: "photography",   label: "Photography",     icon: "📷", color: "#3b82f6" },
  { id: "misc",          label: "Miscellaneous",   icon: "📦", color: "#6b7280" },
];

export default function EventCreation() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [event, setEvent] = useState({
    name: "", type: "", date: "", time: "", description: "",
    venue: "", address: "", capacity: "",
    guests: [], guestInput: "",
    totalBudget: "",
    budgetSplit: { venue: "", catering: "", entertainment: "", decorations: "", photography: "", misc: "" },
  });

  const update = (field, value) => setEvent(prev => ({ ...prev, [field]: value }));

  const addGuest = () => {
    const email = event.guestInput.trim();
    if (email && !event.guests.includes(email)) {
      update("guests", [...event.guests, email]);
      update("guestInput", "");
    }
  };

  const removeGuest = (g) => update("guests", event.guests.filter(x => x !== g));

  const totalAllocated = Object.values(event.budgetSplit).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const budgetRemaining = (parseFloat(event.totalBudget) || 0) - totalAllocated;

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to create an event.");
      const newEvent = await createEvent(event, user.id);
      navigate(`/dashboard/${newEvent.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // ── Styles (same as standalone version) ──────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::selection { background: #d4a853; color: #0a0a0f; }
    .field-input { background: #13131a; border: 1px solid #2a2a35; border-radius: 10px; padding: 13px 16px; color: #e8e0d5; font-size: 15px; width: 100%; outline: none; transition: border-color 0.2s; font-family: 'DM Sans'; }
    .field-input:focus { border-color: #d4a853; box-shadow: 0 0 0 3px rgba(212,168,83,0.1); }
    .field-input::placeholder { color: #3a3a45; }
    .btn-primary { background: linear-gradient(135deg, #d4a853, #b8892f); color: #0a0a0f; border: none; padding: 14px 32px; border-radius: 10px; font-family: 'DM Sans'; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(212,168,83,0.3); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: transparent; color: #7a7268; border: 1px solid #2a2a35; padding: 14px 32px; border-radius: 10px; font-family: 'DM Sans'; font-size: 15px; cursor: pointer; transition: all 0.2s; }
    .btn-secondary:hover { color: #e8e0d5; border-color: #4a4a55; }
    .type-tile { background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 14px 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all 0.2s; }
    .type-tile:hover { border-color: #d4a853; background: rgba(212,168,83,0.08); transform: translateY(-2px); }
    .type-tile.selected { border-color: #d4a853; background: rgba(212,168,83,0.12); }
    .guest-tag { background: #1a1a24; border: 1px solid #2a2a35; border-radius: 20px; padding: 6px 12px 6px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .step-card { animation: slideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
    @keyframes slideIn { from { opacity:0; transform: translateY(18px); } to { opacity:1; transform: translateY(0); } }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #d4a853; border-radius: 2px; }
  `;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'DM Sans', sans-serif", color: "#e8e0d5", display: "flex", flexDirection: "column" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ padding: "28px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a24" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #d4a853, #b8892f)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✦</div>
          <span style={{ fontFamily: "'Playfair Display'", fontSize: 20 }}>EventFlow</span>
        </div>
        <button onClick={() => navigate("/events")} style={{ background: "none", border: "none", color: "#5a5a68", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 4 }} onMouseEnter={e=>e.currentTarget.style.color="#d4a853"} onMouseLeave={e=>e.currentTarget.style.color="#5a5a68"}>← My Events</button>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "32px 40px 0" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
            {steps.map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: i < currentStep ? "#d4a853" : i === currentStep ? "linear-gradient(135deg,#d4a853,#b8892f)" : "#1a1a24", border: i <= currentStep ? "none" : "1px solid #2a2a35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: i <= currentStep ? "#0a0a0f" : "#4a4a55", transition: "all 0.3s", boxShadow: i === currentStep ? "0 0 20px rgba(212,168,83,0.4)" : "none" }}>
                    {i < currentStep ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 11, color: i === currentStep ? "#d4a853" : i < currentStep ? "#7a7268" : "#3a3a45", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 500 }}>{step}</span>
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < currentStep ? "#d4a853" : "#1a1a24", margin: "0 8px", marginBottom: 22, transition: "background 0.4s" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, padding: "0 40px 40px", overflowY: "auto" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }} className="step-card" key={currentStep}>

          {/* Step 0: Details */}
          {currentStep === 0 && (
            <div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 34, fontWeight: 600, marginBottom: 6 }}>What's the occasion?</h1>
              <p style={{ color: "#5a5a68", fontSize: 15, marginBottom: 36, fontWeight: 300 }}>Let's start with the basics.</p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Event Name</label>
                <input className="field-input" placeholder="e.g. Summer Rooftop Gig" value={event.name} onChange={e => update("name", e.target.value)} />
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Event Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {eventTypes.map(t => (
                    <button key={t.id} className={`type-tile${event.type === t.id ? " selected" : ""}`} onClick={() => update("type", t.id)}>
                      <span style={{ fontSize: 24 }}>{t.icon}</span>
                      <span style={{ fontSize: 12, color: event.type === t.id ? "#d4a853" : "#7a7268", fontWeight: 500 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Date</label>
                  <input className="field-input" type="date" value={event.date} onChange={e => update("date", e.target.value)} style={{ colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Time</label>
                  <input className="field-input" type="time" value={event.time} onChange={e => update("time", e.target.value)} style={{ colorScheme: "dark" }} />
                </div>
              </div>
              <div style={{ marginBottom: 32 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Description</label>
                <textarea className="field-input" rows={3} placeholder="Give guests a taste of what to expect..." value={event.description} onChange={e => update("description", e.target.value)} style={{ resize: "vertical" }} />
              </div>
            </div>
          )}

          {/* Step 1: Venue */}
          {currentStep === 1 && (
            <div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 34, fontWeight: 600, marginBottom: 6 }}>Where's it happening?</h1>
              <p style={{ color: "#5a5a68", fontSize: 15, marginBottom: 36, fontWeight: 300 }}>Add your venue details.</p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Venue Name</label>
                <input className="field-input" placeholder="e.g. The Civic Theatre" value={event.venue} onChange={e => update("venue", e.target.value)} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Address</label>
                <input className="field-input" placeholder="Street address, city" value={event.address} onChange={e => update("address", e.target.value)} />
              </div>
              <div style={{ marginBottom: 32 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Guest Capacity</label>
                <input className="field-input" type="number" placeholder="e.g. 150" value={event.capacity} onChange={e => update("capacity", e.target.value)} style={{ maxWidth: 200 }} />
              </div>
            </div>
          )}

          {/* Step 2: Guests */}
          {currentStep === 2 && (
            <div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 34, fontWeight: 600, marginBottom: 6 }}>Who's invited?</h1>
              <p style={{ color: "#5a5a68", fontSize: 15, marginBottom: 36, fontWeight: 300 }}>Add guests now or send invites later.</p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Add by Email</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input className="field-input" placeholder="guest@email.com" value={event.guestInput} onChange={e => update("guestInput", e.target.value)} onKeyDown={e => e.key === "Enter" && addGuest()} style={{ flex: 1 }} />
                  <button className="btn-primary" onClick={addGuest} style={{ padding: "13px 20px" }}>Add +</button>
                </div>
              </div>
              {event.guests.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
                  {event.guests.map(g => (
                    <div key={g} className="guest-tag">
                      <span>{g}</span>
                      <button onClick={() => removeGuest(g)} style={{ background: "none", border: "none", color: "#4a4a55", cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Budget */}
          {currentStep === 3 && (
            <div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 34, fontWeight: 600, marginBottom: 6 }}>What's the budget?</h1>
              <p style={{ color: "#5a5a68", fontSize: 15, marginBottom: 36, fontWeight: 300 }}>Plan your spend across categories.</p>
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: "block", fontSize: 12, color: "#7a7268", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Total Budget (NZD)</label>
                <div style={{ position: "relative", maxWidth: 260 }}>
                  <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#d4a853", fontWeight: 500, fontSize: 16 }}>$</span>
                  <input className="field-input" type="number" placeholder="0.00" value={event.totalBudget} onChange={e => update("totalBudget", e.target.value)} style={{ paddingLeft: 30 }} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {budgetCategories.map(cat => {
                  const val = parseFloat(event.budgetSplit[cat.id]) || 0;
                  const pct = event.totalBudget ? Math.min((val / parseFloat(event.totalBudget)) * 100, 100) : 0;
                  return (
                    <div key={cat.id} style={{ background: "#13131a", border: "1px solid #1a1a24", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span>{cat.icon}</span>
                        <span style={{ flex: 1, fontSize: 14 }}>{cat.label}</span>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#5a5a68", fontSize: 13 }}>$</span>
                          <input className="field-input" type="number" placeholder="0" value={event.budgetSplit[cat.id]}
                            onChange={e => update("budgetSplit", { ...event.budgetSplit, [cat.id]: e.target.value })}
                            style={{ width: 110, padding: "7px 10px 7px 22px", fontSize: 13 }} />
                        </div>
                      </div>
                      <div style={{ height: 3, background: "#1a1a24", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: cat.color, borderRadius: 3, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 13, color: budgetRemaining < 0 ? "#ef4444" : "#5a5a68", marginTop: 12, textAlign: "right" }}>
                {event.totalBudget ? `$${budgetRemaining.toFixed(0)} unallocated` : ""}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 34, fontWeight: 600, marginBottom: 6 }}>
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>Looks</em> great.
              </h1>
              <p style={{ color: "#5a5a68", fontSize: 15, marginBottom: 36, fontWeight: 300 }}>Review before going live.</p>
              <div style={{ background: "linear-gradient(135deg,#1a1210,#13131a)", border: "1px solid #2a2a35", borderRadius: 16, overflow: "hidden", marginBottom: 28 }}>
                <div style={{ height: 4, background: "linear-gradient(90deg,#d4a853,#b8892f)" }} />
                <div style={{ padding: "24px 28px" }}>
                  <div style={{ fontFamily: "'Playfair Display'", fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{event.name || "Untitled"}</div>
                  <div style={{ fontSize: 13, color: "#d4a853", marginBottom: 20 }}>{eventTypes.find(t => t.id === event.type)?.label || "—"}</div>
                  {[
                    ["📅 Date", event.date || "—"],
                    ["⏰ Time", event.time || "—"],
                    ["📍 Venue", event.venue || "—"],
                    ["👥 Capacity", event.capacity ? `${event.capacity} guests` : "—"],
                    ["✉️ Invited", `${event.guests.length} guest${event.guests.length !== 1 ? "s" : ""}`],
                    ["💰 Budget", event.totalBudget ? `$${parseFloat(event.totalBudget).toLocaleString()} NZD` : "—"],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1a1a24", fontSize: 14 }}>
                      <span style={{ color: "#5a5a68" }}>{l}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "#ef4444" }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <button className="btn-secondary" onClick={() => setCurrentStep(s => s - 1)} style={{ visibility: currentStep === 0 ? "hidden" : "visible" }}>← Back</button>
            <div style={{ display: "flex", gap: 6 }}>
              {steps.map((_, i) => (
                <div key={i} style={{ width: i === currentStep ? 20 : 6, height: 6, borderRadius: 3, background: i === currentStep ? "#d4a853" : i < currentStep ? "#5a4a2f" : "#1a1a24", transition: "all 0.3s" }} />
              ))}
            </div>
            {currentStep < steps.length - 1
              ? <button className="btn-primary" onClick={() => setCurrentStep(s => s + 1)}>Continue →</button>
              : <button className="btn-primary" onClick={handleCreate} disabled={saving}
                  style={{ background: saving ? undefined : "linear-gradient(135deg,#10b981,#059669)", boxShadow: saving ? "none" : "0 8px 24px rgba(16,185,129,0.3)" }}>
                  {saving ? "Creating…" : "Create Event ✦"}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
