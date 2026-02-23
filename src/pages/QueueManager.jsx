// ============================================================
//  QueueManager.jsx
//  Manager-facing queue control panel — embedded in Dashboard
//  as activeNav === "queue"
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

function QueueFormModal({ queue, onSave, onClose }) {
  const [form, setForm] = useState(queue || { name:"", description:"", max_per_person:1 });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inputStyle = { width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)",
    borderRadius:8, padding:"9px 12px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"inherit" };
  const labelStyle = { display:"block", fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:6 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center",
      justifyContent:"center", zIndex:500, padding:24, backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)",
        borderRadius:18, width:"100%", maxWidth:460, boxShadow:"0 24px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1.5px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:16, fontWeight:800, letterSpacing:"-0.02em" }}>{form.id ? "Edit Queue" : "Create Queue"}</div>
          <button onClick={onClose} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:8,
            padding:"5px 10px", color:"var(--text2)", cursor:"pointer", fontSize:13 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={labelStyle}>Queue Name *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} style={inputStyle}
              placeholder="e.g. Gelato Station, Photo Booth, Bar Queue" />
          </div>
          <div>
            <label style={labelStyle}>Description (shown to guests)</label>
            <textarea value={form.description||""} onChange={e=>set("description",e.target.value)}
              rows={2} style={{ ...inputStyle, resize:"vertical" }}
              placeholder="e.g. Complimentary gelato — 1 scoop per person" />
          </div>
          <div>
            <label style={labelStyle}>Max per person</label>
            <select value={form.max_per_person||1} onChange={e=>set("max_per_person",parseInt(e.target.value))}
              style={inputStyle}>
              {[1,2,3,4,5,6,8,10].map(n=><option key={n} value={n}>{n} {n===1?"person":"people"}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:10, paddingTop:4 }}>
            <button onClick={onClose} style={{ flex:1, background:"none", border:"1.5px solid var(--border)",
              borderRadius:9, padding:"10px", fontSize:14, color:"var(--text2)", cursor:"pointer" }}>Cancel</button>
            <button onClick={()=>onSave(form)} style={{ flex:2, background:"var(--accent)", border:"none",
              borderRadius:9, padding:"10px", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer" }}>
              {form.id ? "Save Changes" : "Create Queue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QueueManager({ eventId }) {
  const [queues,  setQueues]  = useState([]);
  const [entries, setEntries] = useState({}); // queueId → entries[]
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);   // null | queue obj (for create/edit)
  const [active,  setActive]  = useState(null);   // currently selected queue id
  const [calling, setCalling] = useState(false);
  const subRefs = useRef({});

  // ── Load ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: qs } = await supabase.from("queues").select("*").eq("event_id", eventId).order("created_at");
    setQueues(qs || []);

    const all = {};
    await Promise.all((qs||[]).map(async q => {
      const { data: es } = await supabase.from("queue_entries").select("*").eq("queue_id", q.id)
        .order("position");
      all[q.id] = es || [];
    }));
    setEntries(all);
    setLoading(false);
    if ((qs||[]).length > 0 && !active) setActive(qs[0].id);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime for active queue ─────────────────────────────
  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`qm_${active}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"queue_entries", filter:`queue_id=eq.${active}` },
        (payload) => {
          const row = payload.new || payload.old;
          setEntries(prev => {
            const list = prev[active] || [];
            if (payload.eventType === "DELETE") return { ...prev, [active]: list.filter(e=>e.id!==row.id) };
            const updated = list.some(e=>e.id===row.id)
              ? list.map(e=>e.id===row.id?row:e)
              : [...list, row];
            return { ...prev, [active]: updated.sort((a,b)=>a.position-b.position) };
          });
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [active]);

  // ── CRUD ────────────────────────────────────────────────────
  const saveQueue = async (form) => {
    const row = { event_id:eventId, name:form.name.trim(), description:form.description?.trim()||null, max_per_person:form.max_per_person||1 };
    if (form.id) {
      const { data } = await supabase.from("queues").update(row).eq("id",form.id).select().single();
      setQueues(qs => qs.map(q=>q.id===form.id?data:q));
    } else {
      const { data } = await supabase.from("queues").insert(row).select().single();
      setQueues(qs => [...qs, data]);
      setEntries(prev => ({ ...prev, [data.id]: [] }));
      setActive(data.id);
    }
    setModal(null);
  };

  const deleteQueue = async (id) => {
    if (!window.confirm("Delete this queue? All entries will be removed.")) return;
    await supabase.from("queues").delete().eq("id", id);
    setQueues(qs => qs.filter(q=>q.id!==id));
    setEntries(prev => { const next={...prev}; delete next[id]; return next; });
    if (active === id) setActive(queues.filter(q=>q.id!==id)[0]?.id || null);
  };

  const setStatus = async (queueId, status) => {
    const { data } = await supabase.from("queues").update({ status }).eq("id", queueId).select().single();
    setQueues(qs => qs.map(q=>q.id===queueId?data:q));
  };

  // ── Call next person ────────────────────────────────────────
  const callNext = async () => {
    if (!active || calling) return;
    const qEntries = entries[active] || [];
    const waiting = qEntries.filter(e => e.status === "waiting").sort((a,b)=>a.position-b.position);
    if (waiting.length === 0) return;
    // First un-call any currently called entry (mark done if they haven't responded)
    const prevCalled = qEntries.filter(e => e.status === "called");
    for (const e of prevCalled) {
      await supabase.from("queue_entries").update({ status:"done", done_at:new Date().toISOString() }).eq("id", e.id);
    }
    const next = waiting[0];
    setCalling(true);
    await supabase.from("queue_entries").update({ status:"called", called_at:new Date().toISOString() }).eq("id", next.id);
    setCalling(false);
  };

  const markDone = async (entryId) => {
    await supabase.from("queue_entries").update({ status:"done", done_at:new Date().toISOString() }).eq("id", entryId);
  };

  const removeEntry = async (entryId) => {
    await supabase.from("queue_entries").update({ status:"left" }).eq("id", entryId);
  };

  const clearDone = async () => {
    if (!active) return;
    if (!window.confirm("Clear all done/left entries from this queue?")) return;
    await supabase.from("queue_entries").delete().eq("queue_id", active).in("status", ["done","left"]);
    setEntries(prev => ({ ...prev, [active]: (prev[active]||[]).filter(e=>!["done","left"].includes(e.status)) }));
  };

  const getQueueUrl = (q) => `${window.location.origin}/queue/${q.id}`;
  const copyQueueUrl = (q) => {
    navigator.clipboard.writeText(getQueueUrl(q));
    alert(`Queue link copied!\n${getQueueUrl(q)}`);
  };

  // ── Computed ────────────────────────────────────────────────
  const activeQueue   = queues.find(q => q.id === active);
  const activeEntries = entries[active] || [];
  const waiting  = activeEntries.filter(e => e.status === "waiting").sort((a,b)=>a.position-b.position);
  const called   = activeEntries.filter(e => e.status === "called");
  const done     = activeEntries.filter(e => e.status === "done");
  const totalServed = done.length;

  const btnStyle = (color="#fff", bg="var(--accent)", extra={}) => ({
    background:bg, border:"none", color, borderRadius:9, padding:"9px 16px",
    fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
    transition:"opacity 0.15s", ...extra
  });
  const ghostBtn = (extra={}) => ({
    background:"none", border:"1.5px solid var(--border)", color:"var(--text2)",
    borderRadius:9, padding:"7px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit", ...extra
  });

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--text3)", fontSize:14 }}>Loading queues…</div>;

  return (
    <div className="fade-up">
      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.04em", marginBottom:4 }}>Queue Manager</h1>
          <p style={{ color:"var(--text2)", fontSize:14 }}>{queues.length} queue{queues.length!==1?"s"} · virtual line system</p>
        </div>
        <button onClick={()=>setModal({})} style={btnStyle()}>+ New Queue</button>
      </div>

      {queues.length === 0 ? (
        <div style={{ textAlign:"center", padding:"80px 20px", background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:16 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🎟</div>
          <h2 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>No queues yet</h2>
          <p style={{ color:"var(--text2)", fontSize:14, marginBottom:24 }}>
            Create a virtual queue for gelato, photo booths, bars, or any station at your event.
          </p>
          <button onClick={()=>setModal({})} style={btnStyle()}>+ Create First Queue</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20, alignItems:"start" }}>

          {/* ── Queue list sidebar ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {queues.map(q => {
              const qEntries = entries[q.id] || [];
              const qWaiting = qEntries.filter(e=>e.status==="waiting").length;
              const qCalled  = qEntries.filter(e=>e.status==="called").length;
              const isActive = q.id === active;
              const statusColor = q.status === "open" ? "var(--success,#059669)" : q.status === "paused" ? "#f59e0b" : "var(--text3)";
              return (
                <div key={q.id}
                  onClick={()=>setActive(q.id)}
                  style={{ background: isActive ? "var(--accentBg)" : "var(--bg2)",
                    border: `1.5px solid ${isActive?"var(--accent)":"var(--border)"}`,
                    borderRadius:12, padding:"14px 16px", cursor:"pointer",
                    boxShadow: isActive?"0 0 0 3px var(--accentBg)":"none",
                    transition:"all 0.15s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{q.name}</div>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:statusColor, display:"inline-block", marginTop:4, flexShrink:0 }}/>
                  </div>
                  <div style={{ fontSize:12, color:"var(--text2)" }}>
                    {qWaiting} waiting{qCalled > 0 ? ` · ${qCalled} called` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Active queue panel ── */}
          {activeQueue && (
            <div>
              {/* Queue header */}
              <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:16, padding:"20px 22px", marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                  <div>
                    <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.03em", marginBottom:4 }}>{activeQueue.name}</h2>
                    {activeQueue.description && <p style={{ color:"var(--text2)", fontSize:13, margin:"0 0 8px" }}>{activeQueue.description}</p>}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {/* Status toggle */}
                      <div style={{ display:"inline-flex", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
                        {["open","paused","closed"].map(s => (
                          <button key={s} onClick={()=>setStatus(activeQueue.id, s)}
                            style={{ background:activeQueue.status===s?"var(--accent)":"none", color:activeQueue.status===s?"#fff":"var(--text3)",
                              border:"none", padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                              textTransform:"capitalize", transition:"all 0.15s" }}>
                            {s==="open"?"▶ Open":s==="paused"?"⏸ Pause":"⏹ Close"}
                          </button>
                        ))}
                      </div>
                      <button onClick={()=>copyQueueUrl(activeQueue)} style={ghostBtn()}>🔗 Share Link</button>
                      <button onClick={()=>setModal({...activeQueue})} style={ghostBtn()}>✎ Edit</button>
                      <button onClick={()=>deleteQueue(activeQueue.id)} style={ghostBtn({ color:"var(--danger,#dc2626)", borderColor:"rgba(220,38,38,0.2)" })}>✕</button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"flex", gap:12 }}>
                    {[["Waiting", waiting.length, "#818cf8"],["Called", called.length, "var(--success,#059669)"],["Served", totalServed, "var(--accent)"]].map(([l,v,c]) => (
                      <div key={l} style={{ textAlign:"center", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:10, padding:"10px 16px", minWidth:60 }}>
                        <div style={{ fontSize:22, fontWeight:800, color:c, letterSpacing:"-0.03em" }}>{v}</div>
                        <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Call next button — big prominent CTA */}
                <div style={{ marginTop:16, paddingTop:16, borderTop:"1.5px solid var(--border)" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <button onClick={callNext} disabled={calling || waiting.length === 0 || activeQueue.status !== "open"}
                      style={{ ...btnStyle(), fontSize:15, padding:"12px 28px",
                        background: waiting.length > 0 && activeQueue.status === "open" ? "var(--success,#059669)" : "var(--bg3)",
                        color: waiting.length > 0 && activeQueue.status === "open" ? "#fff" : "var(--text3)",
                        border: waiting.length > 0 && activeQueue.status === "open" ? "none" : "1.5px solid var(--border)",
                        opacity: calling ? 0.6 : 1, minWidth:160 }}>
                      {calling ? "Calling…" : `📣 Call Next ${waiting.length > 0 ? `(#${waiting[0]?.position})` : ""}`}
                    </button>
                    {waiting.length === 0 && <span style={{ fontSize:13, color:"var(--text3)" }}>Queue is empty</span>}
                    {waiting.length > 0 && <span style={{ fontSize:13, color:"var(--text2)" }}>
                      Next: <strong style={{ color:"var(--text)" }}>{waiting[0]?.guest_name}</strong>
                      {waiting[0]?.party_size > 1 && <span style={{ color:"var(--accent)" }}> ×{waiting[0].party_size}</span>}
                    </span>}
                    {done.length > 0 && <button onClick={clearDone} style={ghostBtn({ marginLeft:"auto", fontSize:11 })}>Clear done</button>}
                  </div>
                </div>
              </div>

              {/* Called now banner */}
              {called.length > 0 && (
                <div style={{ background:"rgba(5,150,105,0.06)", border:"1.5px solid rgba(5,150,105,0.3)", borderRadius:14, padding:"16px 18px", marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--success,#059669)", marginBottom:10 }}>
                    📣 Currently Called
                  </div>
                  {called.map(e => (
                    <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:15, fontWeight:700 }}>{e.guest_name}</span>
                        {e.party_size > 1 && <span style={{ color:"var(--accent)", marginLeft:8, fontWeight:600 }}>×{e.party_size}</span>}
                        {e.called_at && <span style={{ fontSize:12, color:"var(--text3)", marginLeft:10 }}>
                          called {Math.floor((Date.now()-new Date(e.called_at))/60000)}m ago
                        </span>}
                      </div>
                      <button onClick={()=>markDone(e.id)} style={btnStyle("#fff","var(--success,#059669)",{ padding:"6px 14px", fontSize:12 })}>
                        ✓ Served
                      </button>
                      <button onClick={()=>removeEntry(e.id)} style={ghostBtn({ padding:"5px 10px", fontSize:12 })}>Skip</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Waiting list */}
              <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
                <div style={{ padding:"14px 18px", borderBottom:"1.5px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>Waiting List</div>
                  <div style={{ fontSize:12, color:"var(--text3)" }}>{waiting.length} in queue</div>
                </div>

                {waiting.length === 0 ? (
                  <div style={{ padding:"32px", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
                    {activeQueue.status === "open" ? "No one in queue yet — share the link!" : "Queue is not open."}
                  </div>
                ) : (
                  waiting.map((e, i) => (
                    <div key={e.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 18px",
                      borderBottom:i<waiting.length-1?"1px solid var(--border)":"none",
                      background: i===0 ? "rgba(5,150,105,0.03)" : "transparent" }}>
                      {/* Position badge */}
                      <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0,
                        background: i===0?"rgba(5,150,105,0.1)":"var(--bg3)",
                        border:`1.5px solid ${i===0?"rgba(5,150,105,0.3)":"var(--border)"}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:13, fontWeight:800, color:i===0?"var(--success,#059669)":"var(--text3)" }}>
                        {e.position}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600 }}>{e.guest_name}
                          {e.party_size > 1 && <span style={{ color:"var(--accent)", fontWeight:700 }}> ×{e.party_size}</span>}
                        </div>
                        <div style={{ fontSize:11, color:"var(--text3)" }}>
                          Joined {new Date(e.joined_at).toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" })}
                          {e.guest_email && ` · ${e.guest_email}`}
                        </div>
                      </div>
                      {i === 0 && <span style={{ fontSize:11, color:"var(--success,#059669)", fontWeight:700, background:"rgba(5,150,105,0.08)", padding:"3px 10px", borderRadius:20 }}>Next up</span>}
                      <button onClick={()=>removeEntry(e.id)}
                        style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:16, padding:"4px 6px" }}>✕</button>
                    </div>
                  ))
                )}
              </div>

              {/* Done / left entries (collapsible) */}
              {done.length > 0 && (
                <details style={{ marginTop:12 }}>
                  <summary style={{ cursor:"pointer", fontSize:13, color:"var(--text3)", padding:"8px 0", userSelect:"none" }}>
                    {done.length} served / left (click to expand)
                  </summary>
                  <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:12, marginTop:8, overflow:"hidden" }}>
                    {done.map((e,i) => (
                      <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px",
                        borderBottom:i<done.length-1?"1px solid var(--border)":"none", opacity:0.7 }}>
                        <div style={{ flex:1 }}>
                          <span style={{ fontSize:13 }}>{e.guest_name}</span>
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

      {modal !== null && <QueueFormModal queue={modal.id?modal:null} onSave={saveQueue} onClose={()=>setModal(null)}/>}
    </div>
  );
}
