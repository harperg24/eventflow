// ============================================================
//  src/pages/EventList.jsx
//  Home screen — shows all the user's events, create new, delete, sign out
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const EVENT_TYPE_META = {
  gig:       { icon: "🎸", label: "Music Gig" },
  ball:      { icon: "🥂", label: "Ball / Formal" },
  party:     { icon: "🎉", label: "Party" },
  wedding:   { icon: "💍", label: "Wedding" },
  birthday:  { icon: "🎂", label: "Birthday" },
  corporate: { icon: "🏢", label: "Corporate" },
  festival:  { icon: "🎪", label: "Festival" },
  other:     { icon: "✨", label: "Other" },
};

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (diff < 0)  return { label: "Past",       color: "#3a3a52" };
  if (diff === 0) return { label: "Today",     color: "#10b981" };
  if (diff === 1) return { label: "Tomorrow",  color: "#f59e0b" };
  return { label: `${diff}d away`, color: "#c9a84c" };
}

export default function EventList() {
  const navigate = useNavigate();
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [user,    setUser]    = useState(null);
  const [deleting, setDeleting] = useState(null); // id of event pending delete confirm
  const [signingOut, setSigningOut] = useState(false);

  // ── Load user + events ──────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organiser_id", user.id)
        .order("date", { ascending: true });

      if (!error) setEvents(data || []);
      setLoading(false);
    };
    load();
  }, []);

  // ── Delete event ────────────────────────────────────────
  const handleDelete = async (id) => {
    setEvents(ev => ev.filter(e => e.id !== id));
    setDeleting(null);
    await supabase.from("events").delete().eq("id", id);
  };

  // ── Sign out ─────────────────────────────────────────────
  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    // App.jsx auth listener will redirect to /login automatically
  };

  // ── Partition events ─────────────────────────────────────
  const upcoming = events.filter(e => new Date(e.date) >= new Date());
  const past     = events.filter(e => new Date(e.date) <  new Date());

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080810", fontFamily: "'DM Sans', sans-serif", color: "#e2d9cc" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #c9a84c; color: #080810; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #2a2a38; border-radius: 2px; }

        .event-card {
          background: #0f0f1a;
          border: 1px solid #1e1e2e;
          border-radius: 16px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .event-card:hover {
          border-color: rgba(201,168,76,0.3);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        }
        .event-card.past {
          opacity: 0.55;
        }
        .event-card.past:hover {
          opacity: 0.8;
        }
        .delete-btn {
          position: absolute;
          top: 14px; right: 14px;
          background: transparent;
          border: none;
          color: #2e2e42;
          font-size: 18px;
          cursor: pointer;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 6px;
          transition: all 0.15s;
          z-index: 2;
        }
        .event-card:hover .delete-btn { color: #4a4a60; }
        .delete-btn:hover { background: rgba(239,68,68,0.12) !important; color: #ef4444 !important; }

        .btn-gold {
          background: linear-gradient(135deg, #c9a84c, #a8872e);
          color: #080810; border: none;
          padding: 12px 24px; border-radius: 10px;
          font-family: 'DM Sans'; font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
        }
        .btn-gold:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(201,168,76,0.3); }

        .btn-ghost {
          background: transparent; color: #5a5a72;
          border: 1px solid #1e1e2e;
          padding: 10px 18px; border-radius: 10px;
          font-family: 'DM Sans'; font-size: 14px;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
        }
        .btn-ghost:hover { color: #e2d9cc; border-color: #3a3a52; }
        .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
        .stagger-1 { animation-delay: 0.05s; opacity: 0; }
        .stagger-2 { animation-delay: 0.10s; opacity: 0; }
        .stagger-3 { animation-delay: 0.15s; opacity: 0; }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; padding: 24px;
          backdrop-filter: blur(4px);
        }
        .modal {
          background: #0f0f1a; border: 1px solid #2a2a38;
          border-radius: 16px; padding: 32px;
          max-width: 400px; width: 100%;
          animation: fadeUp 0.2s ease forwards;
        }

        .section-label {
          font-size: 11px; color: #3a3a52;
          letter-spacing: 0.08em; text-transform: uppercase;
          margin-bottom: 16px; padding-bottom: 10px;
          border-bottom: 1px solid #141420;
        }

        .empty-state {
          border: 1px dashed #1e1e2e; border-radius: 16px;
          padding: 56px 32px; text-align: center;
          animation: fadeUp 0.4s ease forwards;
        }
      `}</style>

      {/* ── Top nav ── */}
      <header style={{ borderBottom: "1px solid #141420", padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg, #c9a84c, #a8872e)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✦</div>
          <span style={{ fontFamily: "'Playfair Display'", fontSize: 20 }}>EventFlow</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user && (
            <span style={{ fontSize: 13, color: "#3a3a52" }}>{user.email}</span>
          )}
          <button
            className="btn-ghost"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{ padding: "8px 16px", fontSize: 13 }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "52px 24px" }}>

        {/* Page heading */}
        <div className="fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48 }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display'", fontSize: 36, fontWeight: 700, lineHeight: 1.15, marginBottom: 8 }}>
              Your Events
            </h1>
            <p style={{ color: "#5a5a72", fontSize: 15, fontWeight: 300 }}>
              {loading ? "Loading…" : events.length === 0 ? "Nothing planned yet — create your first event." : `${upcoming.length} upcoming · ${past.length} past`}
            </p>
          </div>
          <button className="btn-gold fade-up stagger-1" onClick={() => navigate("/create")}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Event
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: "#0f0f1a", border: "1px solid #1e1e2e", borderRadius: 16, padding: 24, height: 180, opacity: 0.4 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 22, marginBottom: 10 }}>Nothing here yet</h2>
            <p style={{ color: "#5a5a72", fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
              Create your first event and start bringing people together.
            </p>
            <button className="btn-gold" onClick={() => navigate("/create")} style={{ margin: "0 auto" }}>
              + Create your first event
            </button>
          </div>
        )}

        {/* Upcoming events */}
        {!loading && upcoming.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <div className="section-label">Upcoming</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {upcoming.map((event, i) => {
                const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.other;
                const countdown = daysUntil(event.date);
                return (
                  <div
                    key={event.id}
                    className={`event-card fade-up`}
                    style={{ animationDelay: `${i * 0.06}s`, opacity: 0 }}
                    onClick={() => navigate(`/dashboard/${event.id}`)}
                  >
                    {/* Accent line */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #c9a84c, #a8872e)" }} />

                    {/* Delete button */}
                    <button
                      className="delete-btn"
                      onClick={e => { e.stopPropagation(); setDeleting(event.id); }}
                      title="Delete event"
                    >×</button>

                    {/* Icon + type */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 42, height: 42, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                        {meta.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#c9a84c", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 500 }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: countdown.color, marginTop: 2, fontWeight: 500 }}>{countdown.label}</div>
                      </div>
                    </div>

                    {/* Event name */}
                    <div>
                      <div style={{ fontFamily: "'Playfair Display'", fontSize: 19, fontWeight: 700, lineHeight: 1.25, marginBottom: 6, paddingRight: 24 }}>
                        {event.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#5a5a72" }}>
                        {new Date(event.date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        {event.time && ` · ${event.time.slice(0,5)}`}
                      </div>
                    </div>

                    {/* Venue + capacity */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12, color: "#3a3a52", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
                        {event.venue_name || "No venue set"}
                      </div>
                      {event.capacity && (
                        <div style={{ fontSize: 11, color: "#3a3a52", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 20, padding: "3px 10px" }}>
                          {event.capacity} cap
                        </div>
                      )}
                    </div>

                    {/* Budget pill */}
                    {event.total_budget > 0 && (
                      <div style={{ fontSize: 12, color: "#5a5a72" }}>
                        💰 <span style={{ color: "#c9a84c" }}>${Number(event.total_budget).toLocaleString()}</span> budget
                      </div>
                    )}

                    {/* Open arrow */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: "auto" }}>
                      <div style={{ fontSize: 12, color: "#3a3a52", display: "flex", alignItems: "center", gap: 4 }}>
                        Open dashboard <span style={{ fontSize: 14 }}>→</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Create new tile */}
              <div
                onClick={() => navigate("/create")}
                style={{
                  border: "1px dashed #1e1e2e", borderRadius: 16, padding: 24,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 10, cursor: "pointer", minHeight: 200, transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)"; e.currentTarget.style.background = "rgba(201,168,76,0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e2e"; e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 40, height: 40, border: "1px dashed #2a2a38", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#3a3a52" }}>+</div>
                <span style={{ fontSize: 13, color: "#3a3a52" }}>New event</span>
              </div>
            </div>
          </div>
        )}

        {/* Past events */}
        {!loading && past.length > 0 && (
          <div>
            <div className="section-label">Past</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {past.map((event, i) => {
                const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.other;
                return (
                  <div
                    key={event.id}
                    className="event-card past"
                    style={{ animationDelay: `${i * 0.06}s` }}
                    onClick={() => navigate(`/dashboard/${event.id}`)}
                  >
                    <button className="delete-btn" onClick={e => { e.stopPropagation(); setDeleting(event.id); }} title="Delete event">×</button>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, background: "#13131f", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{meta.icon}</div>
                      <div style={{ fontSize: 11, color: "#3a3a52", textTransform: "uppercase", letterSpacing: "0.05em" }}>{meta.label}</div>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display'", fontSize: 18, fontWeight: 700, paddingRight: 24 }}>{event.name}</div>
                    <div style={{ fontSize: 12, color: "#3a3a52" }}>
                      {new Date(event.date).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🗑️</div>
            <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 20, marginBottom: 10 }}>Delete this event?</h2>
            <p style={{ color: "#5a5a72", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              This will permanently delete the event and all its data — guests, budget, playlist, polls, and vendors. This can't be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-ghost"
                onClick={() => setDeleting(null)}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleting)}
                style={{ flex: 1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 10, padding: "10px", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.25)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
              >
                Delete event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
