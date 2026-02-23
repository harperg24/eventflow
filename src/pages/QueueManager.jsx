// ============================================================
//  QueueManager.jsx  —  Manager-facing queue control panel
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const COLOR_STATUS = {
  waiting: { bg:"rgba(99,102,241,0.08)", border:"rgba(99,102,241,0.2)", text:"#818cf8" },
  called:  { bg:"rgba(5,150,105,0.08)",  border:"rgba(5,150,105,0.25)",  text:"var(--success,#059669)" },
  done:    { bg:"var(--bg3)",            border:"var(--border)",          text:"var(--text3)" },
  left:    { bg:"var(--bg3)",            border:"var(--border)",          text:"var(--text3)" },
};

function StatusBadge({ status }) {
  const c = COLOR_STATUS[status] || COLOR_STATUS.waiting;
  const labels = { waiting:"Waiting", called:"Called!", done:"Done", left:"Left" };
  return (
    <span style={{ fontSize:11, padding:"2px 10px", borderRadius:20, fontWeight:700,
      background:c.bg, border:`1.5px solid ${c.border}`, color:c.text }}>
      {status === "called" ? "📣 " : ""}{labels[status] || status}
    </span>
  );
}

// ── Live elapsed timer for a called entry ─────────────────────
function ElapsedTimer({ since }) {
  const [secs, setSecs] = useState(() => Math.floor((Date.now() - new Date(since)) / 1000));
  useEffect(() => {
    const iv = setInterval(() => setSecs(Math.floor((Date.now() - new Date(since)) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [since]);
  const m = Math.floor(secs / 60), s = secs % 60;
  const isLate = secs > 120;
  return (
    <span style={{ fontSize:11, color: isLate ? "#f59e0b" : "var(--text3)", fontVariantNumeric:"tabular-nums" }}>
      {isLate ? "⚠ " : ""}{m > 0 ? `${m}m ` : ""}{String(s).padStart(2,"0")}s
    </span>
  );
}

// ── Queue create / edit modal ─────────────────────────────────
function QueueFormModal({ queue, onSave, onClose }) {
  const [form, setForm] = useState(queue || {
    name:"", description:"", max_per_person:1, auto_caller:1, max_joins_per_device:1
  });
  // Track whether custom number inputs are active
  const [customCaller,  setCustomCaller]  = useState(false);
  const [customDevice,  setCustomDevice]  = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const PRESET_CALLERS  = [0,1,2,3,5,8,10,15,20];
  const PRESET_DEVICES  = [1,2,3,5];

  const isCustomCaller = !PRESET_CALLERS.includes(form.auto_caller ?? 1);
  const isCustomDevice = !PRESET_DEVICES.includes(form.max_joins_per_device ?? 1) && (form.max_joins_per_device ?? 1) < 99;

  const S = {
    input: { width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)",
      borderRadius:8, padding:"9px 12px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"inherit" },
    label: { display:"block", fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:6 },
    note:  { fontSize:11, color:"var(--text3)", marginTop:8, lineHeight:1.6 },
    chips: { display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" },
    section: { fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em",
      color:"var(--text3)", marginBottom:12, paddingBottom:8, borderBottom:"1px solid var(--border)" },
  };

  const Chip = ({ val, current, onChange, label }) => {
    const active = current === val;
    return (
      <button type="button" onClick={() => onChange(val)}
        style={{ background: active ? "var(--accent)" : "var(--bg3)",
          border:`1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
          color: active ? "#fff" : "var(--text2)",
          borderRadius:8, padding:"6px 14px", fontSize:13, fontWeight:600,
          cursor:"pointer", transition:"all 0.12s", fontFamily:"inherit", flexShrink:0 }}>
        {label ?? (val === 99 ? "∞" : val === 0 ? "Off" : val)}
      </button>
    );
  };

  const autoCallerN   = form.auto_caller ?? 1;
  const maxJoinsN     = form.max_joins_per_device ?? 1;

  return (
    /* Overlay — scrollable, top-aligned so the card never gets cut off */
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
      overflowY:"auto", zIndex:500, backdropFilter:"blur(6px)",
      display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"32px 16px 48px" }}
      onClick={onClose}>

      {/* Card */}
      <div onClick={e => e.stopPropagation()}
        style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:18,
          width:"100%", maxWidth:500, boxShadow:"0 24px 60px rgba(0,0,0,0.45)",
          display:"flex", flexDirection:"column" }}>

        {/* ── Sticky header ── */}
        <div style={{ padding:"18px 22px", borderBottom:"1.5px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, background:"var(--bg2)", borderRadius:"18px 18px 0 0", zIndex:2 }}>
          <div style={{ fontSize:16, fontWeight:800, letterSpacing:"-0.02em" }}>
            {form.id ? "Edit Queue" : "New Queue"}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1.5px solid var(--border)",
            borderRadius:8, padding:"4px 10px", color:"var(--text2)", cursor:"pointer", fontSize:14, lineHeight:1.4 }}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding:"22px 22px 4px", display:"flex", flexDirection:"column", gap:22 }}>

          {/* Queue basics */}
          <div>
            <div style={S.section}>Queue Info</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={S.label}>Queue Name *</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} style={S.input}
                  placeholder="e.g. Gelato Station, Photo Booth, Bar" autoFocus />
              </div>
              <div>
                <label style={S.label}>Description <span style={{ fontWeight:400, color:"var(--text3)" }}>(shown to guests)</span></label>
                <textarea value={form.description||""} onChange={e=>set("description",e.target.value)}
                  rows={2} style={{ ...S.input, resize:"vertical" }}
                  placeholder="e.g. 1 free scoop per person" />
              </div>
              <div>
                <label style={S.label}>Max party size per entry</label>
                <div style={S.chips}>
                  {[1,2,3,4,5,6,8,10].map(n => <Chip key={n} val={n} current={form.max_per_person||1} onChange={v=>set("max_per_person",v)} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Auto-caller */}
          <div>
            <div style={S.section}>Auto-Caller</div>
            <label style={S.label}>How many people to keep called at once</label>
            <div style={S.chips}>
              {PRESET_CALLERS.map(n => (
                <Chip key={n} val={n} current={isCustomCaller ? -1 : autoCallerN}
                  onChange={v => { set("auto_caller", v); setCustomCaller(false); }}
                  label={n === 0 ? "Off (manual)" : n} />
              ))}
              {/* Custom chip */}
              <button type="button"
                onClick={() => setCustomCaller(true)}
                style={{ background: isCustomCaller ? "var(--accent)" : "var(--bg3)",
                  border:`1.5px solid ${isCustomCaller ? "var(--accent)" : "var(--border)"}`,
                  color: isCustomCaller ? "#fff" : "var(--text2)",
                  borderRadius:8, padding:"6px 14px", fontSize:13, fontWeight:600,
                  cursor:"pointer", transition:"all 0.12s", fontFamily:"inherit", flexShrink:0 }}>
                Custom
              </button>
            </div>
            {isCustomCaller && (
              <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
                <input type="number" min={0} max={200}
                  value={autoCallerN}
                  onChange={e => set("auto_caller", Math.max(0, parseInt(e.target.value)||0))}
                  style={{ ...S.input, width:100 }}
                  placeholder="e.g. 25" />
                <span style={{ fontSize:13, color:"var(--text3)" }}>simultaneous called slots</span>
              </div>
            )}
            <p style={S.note}>
              {autoCallerN === 0
                ? <><strong>Manual only</strong> — no one is auto-called. Use the "Call Now" button to call people yourself.</>
                : <>Serving someone auto-calls the next person, keeping exactly <strong>{autoCallerN}</strong> {autoCallerN===1?"person":"people"} called at once.
                  For a large event, try <strong>10–20</strong> so staff can work through a batch.</>
              }
            </p>
          </div>

          {/* Device limit */}
          <div>
            <div style={S.section}>Access Control</div>
            <label style={S.label}>Max served visits per device</label>
            <div style={S.chips}>
              {PRESET_DEVICES.map(n => (
                <Chip key={n} val={n} current={isCustomDevice ? -1 : maxJoinsN}
                  onChange={v => { set("max_joins_per_device", v); setCustomDevice(false); }} />
              ))}
              <Chip val={99} current={isCustomDevice ? -1 : maxJoinsN}
                onChange={v => { set("max_joins_per_device", v); setCustomDevice(false); }} />
              <button type="button"
                onClick={() => setCustomDevice(true)}
                style={{ background: isCustomDevice ? "var(--accent)" : "var(--bg3)",
                  border:`1.5px solid ${isCustomDevice ? "var(--accent)" : "var(--border)"}`,
                  color: isCustomDevice ? "#fff" : "var(--text2)",
                  borderRadius:8, padding:"6px 14px", fontSize:13, fontWeight:600,
                  cursor:"pointer", transition:"all 0.12s", fontFamily:"inherit", flexShrink:0 }}>
                Custom
              </button>
            </div>
            {isCustomDevice && (
              <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
                <input type="number" min={1} max={100}
                  value={maxJoinsN < 99 ? maxJoinsN : ""}
                  onChange={e => set("max_joins_per_device", Math.max(1, parseInt(e.target.value)||1))}
                  style={{ ...S.input, width:100 }}
                  placeholder="e.g. 4" />
                <span style={{ fontSize:13, color:"var(--text3)" }}>visits per device</span>
              </div>
            )}
            <p style={S.note}>
              {maxJoinsN >= 99
                ? <>Guests can join unlimited times. Leaving the queue <strong>never</strong> counts against this.</>
                : <>Each device can be <strong>served</strong> up to <strong>{maxJoinsN}</strong> {maxJoinsN===1?"time":"times"}.
                  Leaving the queue without being served <strong>does not</strong> count — only completed visits do.</>
              }
            </p>
          </div>

        </div>

        {/* ── Sticky footer with action buttons ── */}
        <div style={{ padding:"16px 22px", borderTop:"1.5px solid var(--border)", marginTop:8,
          display:"flex", gap:10, position:"sticky", bottom:0, background:"var(--bg2)",
          borderRadius:"0 0 18px 18px", zIndex:2 }}>
          <button onClick={onClose}
            style={{ flex:1, background:"none", border:"1.5px solid var(--border)",
              borderRadius:9, padding:"11px", fontSize:14, color:"var(--text2)", cursor:"pointer", fontFamily:"inherit" }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={!form.name?.trim()}
            style={{ flex:2, background:"var(--accent)", border:"none", borderRadius:9,
              padding:"11px", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit",
              opacity:!form.name?.trim() ? 0.4 : 1 }}>
            {form.id ? "Save Changes" : "Create Queue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function QueueManager({ eventId }) {
  const [queues,  setQueues]  = useState([]);
  const [entries, setEntries] = useState({}); // queueId → entries[]
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [active,  setActive]  = useState(null);
  const [busy,    setBusy]    = useState(false);

  // ── Load all queues + entries ──────────────────────────────
  const load = useCallback(async () => {
    const { data: qs } = await supabase.from("queues").select("*").eq("event_id", eventId).order("created_at");
    setQueues(qs || []);
    const all = {};
    await Promise.all((qs||[]).map(async q => {
      const { data: es } = await supabase.from("queue_entries").select("*").eq("queue_id", q.id).order("position");
      all[q.id] = es || [];
    }));
    setEntries(all);
    setLoading(false);
    if ((qs||[]).length > 0 && !active) setActive(qs[0].id);
  }, [eventId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // ── Realtime for active queue ──────────────────────────────
  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`qm_${active}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"queue_entries", filter:`queue_id=eq.${active}` },
        ({ eventType, new: row, old }) => {
          const r = row || old;
          setEntries(prev => {
            const list = prev[active] || [];
            if (eventType === "DELETE") return { ...prev, [active]: list.filter(e=>e.id!==r.id) };
            const updated = list.some(e=>e.id===r.id) ? list.map(e=>e.id===r.id?r:e) : [...list, r];
            return { ...prev, [active]: updated.sort((a,b)=>a.position-b.position) };
          });
        }
      )
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"queues", filter:`id=eq.${active}` },
        ({ new: row }) => setQueues(qs => qs.map(q => q.id===active ? row : q))
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [active]);

  // ── CRUD helpers ──────────────────────────────────────────
  const saveQueue = async (form) => {
    const row = {
      event_id:             eventId,
      name:                 form.name.trim(),
      description:          form.description?.trim() || null,
      max_per_person:       form.max_per_person    || 1,
      auto_caller:          form.auto_caller        || 1,
      max_joins_per_device: form.max_joins_per_device || 1,
    };
    if (form.id) {
      const { data } = await supabase.from("queues").update(row).eq("id", form.id).select().single();
      setQueues(qs => qs.map(q => q.id===form.id ? data : q));
    } else {
      const { data } = await supabase.from("queues").insert(row).select().single();
      setQueues(qs => [...qs, data]);
      setEntries(prev => ({ ...prev, [data.id]: [] }));
      setActive(data.id);
    }
    setModal(null);
  };

  const deleteQueue = async (id) => {
    if (!window.confirm("Delete this queue and all its entries?")) return;
    await supabase.from("queues").delete().eq("id", id);
    setQueues(qs => qs.filter(q => q.id!==id));
    setEntries(prev => { const n={...prev}; delete n[id]; return n; });
    if (active === id) setActive(queues.filter(q=>q.id!==id)[0]?.id || null);
  };

  const setQueueStatus = async (queueId, status) => {
    const { data } = await supabase.from("queues").update({ status }).eq("id", queueId).select().single();
    setQueues(qs => qs.map(q => q.id===queueId ? data : q));
  };

  // ── Core: fill called slots up to auto_caller count ────────
  // auto_caller=0 means manual-only — never auto-fill
  const fillSlots = async (queueId, autoCallerN) => {
    if (autoCallerN === 0) return; // manual mode
    // Always re-fetch fresh state so we don't race on stale local state
    const { data: fresh } = await supabase.from("queue_entries")
      .select("*").eq("queue_id", queueId).order("position");
    if (!fresh) return;

    const nowCalled  = fresh.filter(e => e.status === "called");
    const nowWaiting = fresh.filter(e => e.status === "waiting");
    const slotsNeeded = Math.max(0, autoCallerN - nowCalled.length);
    if (slotsNeeded === 0 || nowWaiting.length === 0) return;

    const toCall = nowWaiting.slice(0, slotsNeeded);
    await Promise.all(toCall.map(e =>
      supabase.from("queue_entries")
        .update({ status:"called", called_at: new Date().toISOString() })
        .eq("id", e.id)
    ));
  };

  // ── Serve: mark done → auto-fill empty slot ───────────────
  const handleServed = async (entryId) => {
    if (busy) return;
    setBusy(true);
    const q = queues.find(q => q.id === active);
    await supabase.from("queue_entries")
      .update({ status:"done", done_at: new Date().toISOString() })
      .eq("id", entryId);
    await fillSlots(active, q?.auto_caller || 1);
    setBusy(false);
  };

  // ── Skip a called person → mark left + fill ───────────────
  const handleSkip = async (entryId) => {
    if (busy) return;
    setBusy(true);
    const q = queues.find(q => q.id === active);
    await supabase.from("queue_entries").update({ status:"left" }).eq("id", entryId);
    await fillSlots(active, q?.auto_caller || 1);
    setBusy(false);
  };

  // ── Manual fill: in auto mode tops up all open slots; in manual mode calls 1 ──
  const handleFillNow = async () => {
    if (busy) return;
    setBusy(true);
    const q = queues.find(q => q.id === active);
    if ((q?.auto_caller ?? 1) === 0) {
      // Manual mode: call just the next 1 person
      await fillSlots(active, 1);
    } else {
      await fillSlots(active, q?.auto_caller || 1);
    }
    setBusy(false);
  };

  const removeWaiting = async (entryId) => {
    await supabase.from("queue_entries").update({ status:"left" }).eq("id", entryId);
  };

  const clearDone = async () => {
    if (!active || !window.confirm("Clear all served/left entries?")) return;
    await supabase.from("queue_entries").delete().eq("queue_id", active).in("status", ["done","left"]);
    setEntries(prev => ({ ...prev, [active]: (prev[active]||[]).filter(e=>!["done","left"].includes(e.status)) }));
  };

  const copyLink = (q) => {
    const url = `${window.location.origin}/queue/${q.id}`;
    navigator.clipboard.writeText(url);
    alert(`Queue link copied!\n${url}`);
  };

  // ── Derived state ──────────────────────────────────────────
  const activeQueue   = queues.find(q => q.id === active);
  const autoCallerN   = activeQueue?.auto_caller ?? 1;
  const maxPerDevice  = activeQueue?.max_joins_per_device || 1;
  const allEntries    = entries[active] || [];
  const waiting       = allEntries.filter(e => e.status === "waiting").sort((a,b)=>a.position-b.position);
  const called        = allEntries.filter(e => e.status === "called").sort((a,b)=>new Date(a.called_at)-new Date(b.called_at));
  const done          = allEntries.filter(e => ["done","left"].includes(e.status));
  const totalServed   = allEntries.filter(e => e.status === "done").length;
  // In manual mode (0) there are always "open slots" — button always enabled if there's someone waiting
  const openSlots     = autoCallerN === 0 ? (waiting.length > 0 ? 1 : 0) : Math.max(0, autoCallerN - called.length);
  const canFill       = openSlots > 0 && waiting.length > 0 && activeQueue?.status === "open";

  const btn = (label, onClick, opts={}) => (
    <button onClick={onClick} disabled={opts.disabled}
      style={{ background: opts.bg || "var(--accent)", border: opts.border || "none",
        color: opts.color || "#fff", borderRadius:9, padding: opts.pad || "8px 16px",
        fontSize: opts.fs || 13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        transition:"opacity 0.12s", opacity: opts.disabled ? 0.45 : 1,
        whiteSpace:"nowrap", ...opts.extra }}>
      {label}
    </button>
  );

  const ghost = (label, onClick, opts={}) =>
    btn(label, onClick, { bg:"none", border:"1.5px solid var(--border)", color:"var(--text2)",
      pad:"6px 12px", ...opts });

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--text3)", fontSize:14 }}>Loading queues…</div>;

  return (
    <div className="fade-up">

      {/* ── Page header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.04em", marginBottom:4 }}>Queue Manager</h1>
          <p style={{ color:"var(--text2)", fontSize:14 }}>
            {queues.length} queue{queues.length!==1?"s":""}{"  ·  "}virtual line system
          </p>
        </div>
        {btn("+ New Queue", () => setModal({}))}
      </div>

      {queues.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"var(--bg2)",
          border:"1.5px solid var(--border)", borderRadius:16 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🎟</div>
          <h2 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>No queues yet</h2>
          <p style={{ color:"var(--text2)", fontSize:14, marginBottom:24, maxWidth:360, margin:"0 auto 24px" }}>
            Create a virtual queue for gelato, photo booths, bars — anything with a line.
          </p>
          {btn("+ Create First Queue", () => setModal({}))}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"256px 1fr", gap:20, alignItems:"start" }}>

          {/* ── Left sidebar ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {queues.map(q => {
              const qe = entries[q.id] || [];
              const qWaiting = qe.filter(e=>e.status==="waiting").length;
              const qCalled  = qe.filter(e=>e.status==="called").length;
              const isActive = q.id === active;
              const dotColor = q.status==="open" ? "var(--success,#059669)" : q.status==="paused" ? "#f59e0b" : "var(--text3)";
              return (
                <div key={q.id} onClick={()=>setActive(q.id)}
                  style={{ background: isActive ? "var(--accentBg)" : "var(--bg2)",
                    border:`1.5px solid ${isActive?"var(--accent)":"var(--border)"}`,
                    borderRadius:12, padding:"14px 16px", cursor:"pointer",
                    boxShadow: isActive ? "0 0 0 3px var(--accentBg)" : "none",
                    transition:"all 0.15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{q.name}</div>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor,
                      display:"inline-block", marginTop:4, flexShrink:0 }}/>
                  </div>
                  <div style={{ fontSize:12, color:"var(--text2)", marginBottom:3 }}>
                    {qWaiting} waiting{qCalled>0?` · ${qCalled} called`:""}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text3)" }}>
                    📣 {(q.auto_caller ?? 1) === 0 ? "Manual" : `${q.auto_caller} simultaneous`}{" · "}
                    📱 {(q.max_joins_per_device||1)>=99?"∞":(q.max_joins_per_device||1)}×/device
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right panel ── */}
          {activeQueue && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* ── Queue header card ── */}
              <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:16, padding:"20px 22px" }}>

                {/* Top row: title + stats */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:16 }}>
                  <div style={{ flex:1 }}>
                    <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.03em", marginBottom:4 }}>{activeQueue.name}</h2>
                    {activeQueue.description && <p style={{ color:"var(--text2)", fontSize:13, margin:"0 0 10px" }}>{activeQueue.description}</p>}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <div style={{ display:"inline-flex", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
                        {["open","paused","closed"].map(s => (
                          <button key={s} onClick={()=>setQueueStatus(activeQueue.id, s)}
                            style={{ background:activeQueue.status===s?"var(--accent)":"none",
                              color:activeQueue.status===s?"#fff":"var(--text3)",
                              border:"none", padding:"5px 12px", fontSize:12, fontWeight:700,
                              cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
                            {s==="open"?"▶ Open":s==="paused"?"⏸ Pause":"⏹ Close"}
                          </button>
                        ))}
                      </div>
                      {ghost("🔗 Share", () => copyLink(activeQueue))}
                      {ghost("✎ Edit", () => setModal({...activeQueue}))}
                      {ghost("✕", () => deleteQueue(activeQueue.id),
                        { color:"var(--danger,#dc2626)", extra:{ borderColor:"rgba(220,38,38,0.2)" }})}
                    </div>
                  </div>

                  {/* Stats chips */}
                  <div style={{ display:"flex", gap:10 }}>
                    {[["Waiting",waiting.length,"#818cf8"],["Called",called.length,"var(--success,#059669)"],["Served",totalServed,"var(--accent)"]].map(([l,v,c])=>(
                      <div key={l} style={{ textAlign:"center", background:"var(--bg3)", border:"1.5px solid var(--border)",
                        borderRadius:10, padding:"10px 14px", minWidth:58 }}>
                        <div style={{ fontSize:20, fontWeight:800, color:c, letterSpacing:"-0.02em" }}>{v}</div>
                        <div style={{ fontSize:10, color:"var(--text3)", fontWeight:700, textTransform:"uppercase" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Auto-caller status bar ── */}
                <div style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:10,
                  padding:"12px 16px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>

                  {/* Slot visualiser */}
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--text2)" }}>
                      {autoCallerN === 0 ? "Manual mode" : `Called slots (${called.length}/${autoCallerN})`}
                    </div>
                    {autoCallerN > 0 && (
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                        {Array.from({length: Math.min(autoCallerN, 30)}, (_, i) => (
                          <div key={i} style={{ width:14, height:14, borderRadius:4,
                            background: i < called.length ? "var(--success,#059669)" : "var(--bg2)",
                            border:`1.5px solid ${i < called.length ? "rgba(5,150,105,0.4)" : "var(--border)"}`,
                            transition:"background 0.25s" }}/>
                        ))}
                        {autoCallerN > 30 && <span style={{ fontSize:11, color:"var(--text3)" }}>+{autoCallerN-30}</span>}
                      </div>
                    )}
                    {autoCallerN === 0 && (
                      <div style={{ fontSize:11, color:"var(--text3)" }}>Call people manually with the button →</div>
                    )}
                  </div>

                  <div style={{ width:1, height:32, background:"var(--border)", flexShrink:0 }}/>

                  <div style={{ flex:1 }}>
                    {autoCallerN === 0 ? (
                      <div style={{ fontSize:13, color:"var(--text2)" }}>
                        {waiting.length > 0
                          ? <>Next: <strong style={{ color:"var(--text)" }}>{waiting[0]?.guest_name}</strong></>
                          : "No one waiting"}
                      </div>
                    ) : canFill ? (
                      <div style={{ fontSize:13, color:"var(--text2)" }}>
                        <strong style={{ color:"var(--text)" }}>{openSlots}</strong> open slot{openSlots!==1?"s":""}{" — "}
                        <strong style={{ color:"var(--text)" }}>{waiting[0]?.guest_name}</strong>
                        {openSlots > 1 && waiting.length > 1 ? ` +${Math.min(openSlots, waiting.length)-1} more` : ""} will be called
                      </div>
                    ) : called.length >= autoCallerN ? (
                      <div style={{ fontSize:13, color:"var(--text3)" }}>All slots filled — serve someone to call the next person</div>
                    ) : (
                      <div style={{ fontSize:13, color:"var(--text3)" }}>
                        {waiting.length === 0 ? "No one waiting" : "Queue is not open"}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>
                      📱 Max {maxPerDevice>=99?"unlimited":maxPerDevice} visit{maxPerDevice!==1?"s":""}/device
                    </div>
                  </div>

                  {btn(
                    busy ? "…" : autoCallerN === 0
                      ? (waiting.length > 0 ? `📣 Call ${waiting[0]?.guest_name}` : "No one waiting")
                      : canFill ? `📣 Call ${Math.min(openSlots,waiting.length)} Now` : "Slots Full",
                    handleFillNow,
                    { disabled: (autoCallerN === 0 ? waiting.length === 0 : !canFill) || busy || activeQueue?.status !== "open",
                      bg: (autoCallerN === 0 ? waiting.length > 0 : canFill) && activeQueue?.status === "open"
                        ? "var(--success,#059669)" : "var(--bg3)",
                      color: (autoCallerN === 0 ? waiting.length > 0 : canFill) && activeQueue?.status === "open"
                        ? "#fff" : "var(--text3)",
                      border: (autoCallerN === 0 ? waiting.length > 0 : canFill) && activeQueue?.status === "open"
                        ? "none" : "1.5px solid var(--border)",
                      pad:"9px 20px" }
                  )}
                </div>
              </div>

              {/* ── Called list ── */}
              {called.length > 0 && (
                <div style={{ background:"var(--bg2)", border:"2px solid rgba(5,150,105,0.3)",
                  borderRadius:14, overflow:"hidden" }}>
                  <div style={{ padding:"12px 18px", borderBottom:"1.5px solid rgba(5,150,105,0.15)",
                    background:"rgba(5,150,105,0.04)",
                    display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:"var(--success,#059669)" }}>
                      📣 Currently Called
                    </div>
                    <div style={{ fontSize:12, color:"var(--text3)" }}>
                      Serving {called.length} / {autoCallerN} slots — hit Served when done, next person auto-calls
                    </div>
                  </div>
                  <div style={{ padding:"0 18px" }}>
                    {called.map((e, i) => (
                      <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12,
                        padding:"13px 0", borderBottom:i<called.length-1?"1px solid var(--border)":"none" }}>
                        <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0,
                          background:"rgba(5,150,105,0.1)", border:"1.5px solid rgba(5,150,105,0.3)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:14, fontWeight:800, color:"var(--success,#059669)" }}>
                          {e.position}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700 }}>
                            {e.guest_name}
                            {e.party_size>1 && <span style={{ color:"var(--accent)", marginLeft:6 }}>×{e.party_size}</span>}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2 }}>
                            {e.guest_email && <span style={{ fontSize:11, color:"var(--text3)" }}>{e.guest_email}</span>}
                            {e.called_at && <ElapsedTimer since={e.called_at} />}
                          </div>
                        </div>
                        {btn("✓ Served", () => handleServed(e.id), {
                          bg:"var(--success,#059669)", pad:"7px 16px", fs:12, disabled:busy })}
                        {ghost("Skip", () => handleSkip(e.id), { pad:"6px 12px", fs:12, extra:{ opacity:busy?0.4:1 }})}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Waiting list ── */}
              <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ padding:"12px 18px", borderBottom:"1.5px solid var(--border)",
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>Waiting List</div>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:12, color:"var(--text3)" }}>{waiting.length} in queue</span>
                    {done.length > 0 && ghost("Clear done", clearDone, { pad:"4px 10px", fs:11 })}
                  </div>
                </div>

                {waiting.length === 0 ? (
                  <div style={{ padding:"36px", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
                    {activeQueue.status==="open" ? "No one waiting — share the link!" : "Queue is not open."}
                  </div>
                ) : (
                  waiting.map((e, i) => {
                    // Highlight entries that would fill an open slot
                    const willBeCalled = i < openSlots && activeQueue.status === "open";
                    return (
                      <div key={e.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 18px",
                        borderBottom:i<waiting.length-1?"1px solid var(--border)":"none",
                        background: willBeCalled ? "rgba(5,150,105,0.02)" : "transparent",
                        transition:"background 0.2s" }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0,
                          background: willBeCalled ? "rgba(5,150,105,0.1)" : "var(--bg3)",
                          border:`1.5px solid ${willBeCalled?"rgba(5,150,105,0.3)":"var(--border)"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:12, fontWeight:800,
                          color: willBeCalled ? "var(--success,#059669)" : "var(--text3)" }}>
                          {e.position}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600 }}>
                            {e.guest_name}
                            {e.party_size>1 && <span style={{ color:"var(--accent)", fontWeight:700 }}> ×{e.party_size}</span>}
                          </div>
                          <div style={{ fontSize:11, color:"var(--text3)" }}>
                            {new Date(e.joined_at).toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"})}
                            {e.guest_email && ` · ${e.guest_email}`}
                          </div>
                        </div>
                        {willBeCalled && (
                          <span style={{ fontSize:11, color:"var(--success,#059669)", fontWeight:700,
                            background:"rgba(5,150,105,0.08)", padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
                            Filling slot…
                          </span>
                        )}
                        {!willBeCalled && i < autoCallerN * 2 && (
                          <span style={{ fontSize:11, color:"var(--text3)", whiteSpace:"nowrap" }}>
                            ~{Math.ceil((i - openSlots + 1) / autoCallerN * 2)}m
                          </span>
                        )}
                        <button onClick={()=>removeWaiting(e.id)}
                          style={{ background:"none", border:"none", color:"var(--text3)",
                            cursor:"pointer", fontSize:15, padding:"3px 5px" }}>✕</button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Done / left (collapsible) ── */}
              {done.length > 0 && (
                <details>
                  <summary style={{ cursor:"pointer", fontSize:13, color:"var(--text3)",
                    padding:"6px 2px", userSelect:"none", listStyle:"none" }}>
                    ▸ {done.length} served / left (expand)
                  </summary>
                  <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)",
                    borderRadius:12, marginTop:8, overflow:"hidden" }}>
                    {done.map((e,i) => (
                      <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 16px",
                        borderBottom:i<done.length-1?"1px solid var(--border)":"none", opacity:0.65 }}>
                        <div style={{ flex:1, fontSize:13 }}>
                          {e.guest_name}
                          {e.party_size>1 && <span style={{ color:"var(--text3)", marginLeft:6 }}>×{e.party_size}</span>}
                        </div>
                        <StatusBadge status={e.status}/>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <QueueFormModal queue={modal.id?modal:null} onSave={saveQueue} onClose={()=>setModal(null)} />
      )}
    </div>
  );
}
