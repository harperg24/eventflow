// ============================================================
//  EventCreation.jsx  —  wired to Supabase
//  Replaces the standalone eventflow-mvp.jsx artifact
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, createEvent } from "../lib/supabase";

// Steps are built dynamically based on event category (see below)

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
  const [currentStep,    setCurrentStep]    = useState(0);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState(null);
  const [eventCategory,  setEventCategory]  = useState(null); // null | 'private' | 'ticketed' | 'hybrid'
  const [ticketTiers,    setTicketTiers]    = useState([{ name: "General Admission", description: "", price: "", capacity: "" }]);

  // Build steps based on category
  const steps = eventCategory === "ticketed"
    ? ["Details", "Venue", "Tickets", "Budget", "Review"]
    : eventCategory === "hybrid"
    ? ["Details", "Venue", "Guests", "Tickets", "Budget", "Review"]
    : ["Details", "Venue", "Guests", "Budget", "Review"];

  const addTier    = () => setTicketTiers(t => [...t, { name: "", description: "", price: "", capacity: "" }]);
  const removeTier = (i) => setTicketTiers(t => t.filter((_, idx) => idx !== i));
  const updateTier = (i, field, val) => setTicketTiers(t => t.map((tier, idx) => idx === i ? { ...tier, [field]: val } : tier));

  const [event, setEvent] = useState({
    name: "", type: "", date: "", time: "", description: "", ticket_message: "",
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
      const newEvent = await createEvent({ ...event, type: eventCategory || "private" }, user.id);

      // Save ticket tiers if ticketed or hybrid
      if (eventCategory === "ticketed" || eventCategory === "hybrid") {
        const validTiers = ticketTiers.filter(t => t.name.trim() && t.price);
        if (validTiers.length > 0) {
          await supabase.from("ticket_tiers").insert(
            validTiers.map((t, i) => ({
              event_id:    newEvent.id,
              name:        t.name.trim(),
              description: t.description.trim() || null,
              price:       Math.round(parseFloat(t.price) * 100), // convert to cents
              capacity:    t.capacity ? parseInt(t.capacity) : null,
              sort_order:  i,
            }))
          );
        }
      }

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

      {/* ── Category picker — shown before steps ── */}
      {!eventCategory && (
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "60px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: "#e8e0d5", marginBottom: 8 }}>What kind of event?</h1>
            <p style={{ color: "#7a7268", fontSize: 15 }}>This shapes which features are available to you</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { id: "private",  icon: "🎉", label: "Private",  sub: "Guest list, invites, RSVP. Free event — no ticketing." },
              { id: "ticketed", icon: "🎟", label: "Ticketed",  sub: "Public ticket sales with Stripe. No guest list." },
              { id: "hybrid",   icon: "✨", label: "Hybrid",    sub: "Both — sell tickets publicly and manage a guest list." },
            ].map(c => (
              <div key={c.id} onClick={() => setEventCategory(c.id)}
                style={{ background: "#0d0d1a", border: "1px solid #2a2a35", borderRadius: 16, padding: "28px 20px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#d4a853"; e.currentTarget.style.transform="translateY(-3px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#2a2a35"; e.currentTarget.style.transform="translateY(0)"; }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>{c.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#e8e0d5", marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: 13, color: "#5a5a72", lineHeight: 1.5 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step content — only shown after category is chosen */}
      {eventCategory && (
      <div>
      <div style={{ flex: 1, padding: "0 40px 40px", overflowY: "auto" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }} className="step-card" key={currentStep}>

          {/* Step 0: Details */}
          {steps[currentStep] === "Details" && (
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
          {steps[currentStep] === "Venue" && (
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

          {/* Tickets step — for ticketed and hybrid */}
          {steps[currentStep] === "Tickets" && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 6 }}>Ticket Tiers</h2>
              <p style={{ color: "#7a7268", fontSize: 14, marginBottom: 28 }}>Set up your ticket types, prices, and availability</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
                {ticketTiers.map((tier, i) => (
                  <div key={i} style={{ background: "#0d0d1a", border: "1px solid #2a2a35", borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontSize: 13, color: "#7a7268", fontWeight: 500 }}>Tier {i + 1}</span>
                      {ticketTiers.length > 1 && (
                        <button onClick={() => removeTier(i)} style={{ background: "none", border: "none", color: "#3a3a45", cursor: "pointer", fontSize: 18 }}>×</button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a7268", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Tier Name *</div>
                        <input className="field-input" placeholder="e.g. General Admission"
                          value={tier.name} onChange={e => updateTier(i, "name", e.target.value)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a7268", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Price (NZD) *</div>
                        <input className="field-input" placeholder="e.g. 25.00" type="number" min="0" step="0.01"
                          value={tier.price} onChange={e => updateTier(i, "price", e.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a7268", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Description</div>
                        <input className="field-input" placeholder="What's included?"
                          value={tier.description} onChange={e => updateTier(i, "description", e.target.value)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#7a7268", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Capacity (blank = unlimited)</div>
                        <input className="field-input" placeholder="e.g. 100" type="number" min="1"
                          value={tier.capacity} onChange={e => updateTier(i, "capacity", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addTier}
                style={{ width: "100%", background: "none", border: "1px dashed #2a2a35", color: "#7a7268", borderRadius: 12, padding: "13px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#d4a853"; e.currentTarget.style.color="#d4a853"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#2a2a35"; e.currentTarget.style.color="#7a7268"; }}>
                + Add Another Tier
              </button>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: "#7a7268", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Message on Ticket Page (optional)</div>
                <textarea className="field-input" placeholder="A message shown to buyers on the ticket page…" rows={3}
                  value={event.ticket_message} onChange={e => update("ticket_message", e.target.value)}
                  style={{ resize: "vertical" }} />
              </div>
            </div>
          )}

          {/* Step 2: Guests */}
          {steps[currentStep] === "Guests" && (
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
          {steps[currentStep] === "Budget" && (
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
          {steps[currentStep] === "Review" && (
            <div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 34, fontWeight: 600, marginBottom: 6 }}>
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>Looks</em> great.
              </h1>
              {/* Event type badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.25)", borderRadius: 8, padding: "6px 14px", marginBottom: 20 }}>
                <span style={{ fontSize: 14 }}>{eventCategory === "private" ? "🎉" : eventCategory === "ticketed" ? "🎟" : "✨"}</span>
                <span style={{ fontSize: 13, color: "#d4a853", fontWeight: 500, textTransform: "capitalize" }}>{eventCategory} Event</span>
              </div>
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
      )}
    </div>
  );
}
