// ============================================================
//  EventNotifications.jsx
//  Notifications tab — automated reminders + custom messages
// ============================================================
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const RECIPIENT_OPTIONS = [
  { value:"all_guests",       label:"All guests",       desc:"Everyone on the guest list" },
  { value:"attending_guests", label:"Attending guests", desc:"Only those who RSVP'd yes" },
  { value:"ticketholders",    label:"Ticket holders",   desc:"Anyone who bought a ticket" },
  { value:"all",              label:"Everyone",         desc:"Guests + ticket holders" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NZ", {
    weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit",
  });
}

function hoursToLabel(h) {
  if (!h) return "";
  if (h < 24) return `${h}h before`;
  if (h % 168 === 0) return `${h/168}w before`;
  if (h % 24  === 0) return `${h/24}d before`;
  return `${h}h before`;
}

function recipientLabel(v) {
  return RECIPIENT_OPTIONS.find(o => o.value === v)?.label || v;
}

function Pill({ notif }) {
  const now = new Date();
  if (notif.sent) return (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap",
      background:"rgba(5,150,105,0.08)", border:"1.5px solid rgba(5,150,105,0.25)", color:"#059669" }}>
      ✓ Sent · {notif.sent_count || 0}
    </span>
  );
  if (new Date(notif.send_at) < now) return (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap",
      background:"rgba(245,158,11,0.08)", border:"1.5px solid rgba(245,158,11,0.3)", color:"#d97706" }}>
      ⚠ Overdue
    </span>
  );
  return (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap",
      background:"rgba(91,91,214,0.08)", border:"1.5px solid rgba(91,91,214,0.25)", color:"var(--accent,#5b5bd6)" }}>
      Scheduled
    </span>
  );
}

function NotifCard({ notif, onEdit, onDelete, onSendNow, sending }) {
  const isReminder = notif.notification_type === "event_reminder";
  const title = isReminder
    ? `Event Reminder${notif.hours_before ? ` — ${hoursToLabel(notif.hours_before)}` : ""}`
    : (notif.subject || "Custom notification");

  return (
    <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:14,
      padding:"16px 18px", display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ width:44, height:44, borderRadius:12, background:"var(--bg3)",
        flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
        {isReminder ? "⏰" : (notif.emoji || "📣")}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:4,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {title}
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, color:"var(--text3)" }}>👥 {recipientLabel(notif.recipient_type)}</span>
          <span style={{ fontSize:12, color:"var(--text3)" }}>📅 {fmtDate(notif.send_at)}</span>
          {!isReminder && notif.message && (
            <span style={{ fontSize:11, color:"var(--text3)", fontStyle:"italic",
              maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              "{notif.message.replace(/<[^>]+>/g,"").slice(0,80)}{notif.message.length>80?"…":""}"
            </span>
          )}
        </div>
      </div>
      <Pill notif={notif} />
      {!notif.sent && (
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          <button onMouseDown={() => onSendNow(notif)} disabled={sending === notif.id}
            style={{ background:"none", border:"1.5px solid rgba(5,150,105,0.3)", color:"#059669",
              borderRadius:8, padding:"5px 11px", fontSize:12, fontWeight:600,
              cursor:sending===notif.id?"wait":"pointer", fontFamily:"inherit",
              opacity:sending===notif.id?0.5:1, whiteSpace:"nowrap" }}>
            {sending === notif.id ? "Sending…" : "Send now"}
          </button>
          <button onMouseDown={() => onEdit(notif)}
            style={{ background:"none", border:"1.5px solid var(--border)", color:"var(--text2)",
              borderRadius:8, padding:"5px 11px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            Edit
          </button>
          <button onMouseDown={() => onDelete(notif.id)}
            style={{ background:"none", border:"1.5px solid rgba(220,38,38,0.2)", color:"#dc2626",
              borderRadius:8, padding:"5px 9px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            ✕
          </button>
        </div>
      )}
      {notif.sent && (
        <button onMouseDown={() => onDelete(notif.id)}
          style={{ background:"none", border:"1.5px solid rgba(220,38,38,0.2)", color:"#dc2626",
            borderRadius:8, padding:"5px 9px", fontSize:12, cursor:"pointer",
            fontFamily:"inherit", flexShrink:0 }}>
          ✕
        </button>
      )}
    </div>
  );
}

const QUICK_REMINDERS = [
  { hours:1,   icon:"⚡", label:"1 hour" },
  { hours:24,  icon:"📅", label:"1 day" },
  { hours:48,  icon:"📆", label:"2 days" },
  { hours:168, icon:"🗓", label:"1 week" },
];

function QuickReminderStrip({ event, existingHours, onAdd }) {
  const existing = new Set(existingHours);
  if (!event?.date) return null;
  return (
    <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:14,
      padding:"18px 20px", marginBottom:20 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:4 }}>
        ⚡ Quick-add automated reminders
      </div>
      <div style={{ fontSize:12, color:"var(--text3)", marginBottom:14 }}>
        One click to schedule a reminder email to all guests before the event.
        You can customise recipients and timing with + New Notification.
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {QUICK_REMINDERS.map(r => {
          const added = existing.has(r.hours);
          return (
            <button key={r.hours} onMouseDown={() => !added && onAdd(r.hours)} disabled={added}
              style={{ background: added ? "rgba(5,150,105,0.08)" : "var(--bg3)",
                border: `1.5px solid ${added ? "rgba(5,150,105,0.3)" : "var(--border)"}`,
                color: added ? "#059669" : "var(--text)",
                borderRadius:10, padding:"9px 16px", fontSize:13, fontWeight:600,
                cursor: added ? "default" : "pointer", fontFamily:"inherit",
                transition:"all 0.15s", display:"flex", alignItems:"center", gap:6 }}>
              {added ? "✓" : r.icon} {r.label} before
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function EventNotifications({ eventId, event, onOpenModal, refreshKey }) {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [showSent, setShowSent] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("event_notifications")
      .select("*")
      .eq("event_id", eventId)
      .order("send_at");
    setNotifs(data || []);
    setLoading(false);
  };

  // refreshKey increments when modal saves, triggering a reload
  useEffect(() => { load(); }, [eventId, refreshKey]); // eslint-disable-line

  // Auto-expand sent history when there's nothing scheduled (so sent items are visible)
  useEffect(() => {
    const scheduled = notifs.filter(n => !n.sent);
    const sent      = notifs.filter(n => n.sent);
    if (sent.length > 0 && scheduled.length === 0) setShowSent(true);
  }, [notifs]);

  const quickAdd = async (hours) => {
    if (!event?.date) return;
    const eventDt = new Date(`${event.date}T${event.time || "12:00"}`);
    const send_at = new Date(eventDt.getTime() - hours * 3600000).toISOString();
    await supabase.from("event_notifications").insert({
      event_id:          eventId,
      notification_type: "event_reminder",
      recipient_type:    "all_guests",
      hours_before:      hours,
      send_at,
    });
    await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    await supabase.from("event_notifications").delete().eq("id", id);
    setNotifs(n => n.filter(x => x.id !== id));
  };

  const handleSendNow = async (notif) => {
    const lbl = notif.notification_type === "event_reminder"
      ? "Event Reminder" : (notif.subject || "Custom message");
    if (!window.confirm(`Send "${lbl}" now to ${recipientLabel(notif.recipient_type)}?`)) return;
    setSending(notif.id);
    await supabase.from("event_notifications")
      .update({ send_at: new Date().toISOString(), sent: false })
      .eq("id", notif.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notifications`, {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${session?.access_token}` },
        body: JSON.stringify({ notificationId: notif.id }),
      });
    } catch (_) {}
    await load();
    setSending(null);
  };

  const scheduled = notifs.filter(n => !n.sent);
  const sent      = notifs.filter(n => n.sent);
  const existingReminderHours = scheduled
    .filter(n => n.notification_type === "event_reminder" && n.hours_before)
    .map(n => n.hours_before);

  if (loading) return (
    <div style={{ padding:60, textAlign:"center", color:"var(--text3)", fontSize:14 }}>
      Loading…
    </div>
  );

  return (
    <div className="fade-up">

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.04em", marginBottom:4 }}>
            Notifications
          </h1>
          <p style={{ color:"var(--text2)", fontSize:14, margin:0 }}>
            Schedule automated reminders and custom messages for your guests
          </p>
        </div>
        <button onMouseDown={() => onOpenModal(null)}
          style={{ background:"var(--accent)", border:"none", color:"#fff", borderRadius:10,
            padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer",
            fontFamily:"inherit", flexShrink:0, marginTop:4 }}>
          + New Notification
        </button>
      </div>

      {/* No-date warning */}
      {!event?.date && (
        <div style={{ background:"rgba(245,158,11,0.06)", border:"1.5px solid rgba(245,158,11,0.3)",
          borderRadius:12, padding:"14px 18px", marginBottom:20, fontSize:13,
          color:"#92400e", display:"flex", gap:10, alignItems:"flex-start" }}>
          <span style={{ fontSize:20, flexShrink:0 }}>⚠</span>
          <div>
            <strong>No event date set.</strong>{" "}
            Add a date in Settings to enable automated reminders — they'll be
            calculated relative to your event's start time.
          </div>
        </div>
      )}

      {/* Quick-add strip */}
      <QuickReminderStrip
        event={event}
        existingHours={existingReminderHours}
        onAdd={quickAdd}
      />

      {/* Empty state */}
      {notifs.length === 0 && (
        <div style={{ textAlign:"center", padding:"72px 20px", background:"var(--bg2)",
          border:"1.5px solid var(--border)", borderRadius:16 }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🔔</div>
          <h2 style={{ fontSize:20, fontWeight:800, marginBottom:8, letterSpacing:"-0.02em" }}>
            No notifications yet
          </h2>
          <p style={{ color:"var(--text2)", fontSize:14, maxWidth:380, margin:"0 auto 24px", lineHeight:1.6 }}>
            Keep guests in the loop with automated reminders before the event,
            or send custom announcements whenever you need.
          </p>
          <button onMouseDown={() => onOpenModal(null)}
            style={{ background:"var(--accent)", border:"none", color:"#fff", borderRadius:10,
              padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            + Create First Notification
          </button>
        </div>
      )}

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em",
            color:"var(--text3)", marginBottom:12 }}>
            Scheduled &amp; upcoming ({scheduled.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {scheduled.map(n => (
              <NotifCard key={n.id} notif={n}
                onEdit={onOpenModal} onDelete={handleDelete}
                onSendNow={handleSendNow} sending={sending} />
            ))}
          </div>
        </div>
      )}

      {/* Sent history */}
      {sent.length > 0 && (
        <div>
          <button onMouseDown={() => setShowSent(s => !s)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 0",
              fontSize:13, color:"var(--text3)", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6, marginBottom: showSent ? 12 : 0 }}>
            <span style={{ transition:"transform 0.2s", display:"inline-block",
              transform: showSent ? "rotate(90deg)" : "rotate(0deg)", fontSize:10 }}>▶</span>
            {sent.length} sent notification{sent.length !== 1 ? "s" : ""}
          </button>
          {showSent && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {sent.map(n => (
                <div key={n.id} style={{ opacity:0.65 }}>
                  <NotifCard notif={n}
                    onEdit={onOpenModal} onDelete={handleDelete}
                    onSendNow={handleSendNow} sending={sending} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
