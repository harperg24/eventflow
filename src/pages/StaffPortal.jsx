// ============================================================
//  StaffPortal.jsx  —  Employee-facing portal
//  Route: /staff/:token
// ============================================================
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ── NZ Timezone helpers ───────────────────────────────────────
const NZ_TZ = "Pacific/Auckland";
const fmt     = (d) => new Date(d).toLocaleDateString("en-NZ",  { timeZone:NZ_TZ, weekday:"short", day:"numeric", month:"short" });
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-NZ", { timeZone:NZ_TZ, hour:"2-digit", minute:"2-digit" }) : "--:--";

const nzDateStr = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const p = new Intl.DateTimeFormat("en-NZ", { timeZone:NZ_TZ, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(dt);
  return `${p.find(x=>x.type==="year").value}-${p.find(x=>x.type==="month").value}-${p.find(x=>x.type==="day").value}`;
};
const sameDay    = (a, b) => nzDateStr(a) === nzDateStr(b);
const nzMidnightUTC = (d) => new Date(`${nzDateStr(d)}T00:00:00+12:00`);
const weekStart  = (d) => {
  const local = new Date(`${nzDateStr(d)}T12:00:00+12:00`);
  const offset = local.getDay() === 0 ? -6 : 1 - local.getDay();
  local.setDate(local.getDate() + offset);
  return nzMidnightUTC(local);
};
const addDays    = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt; };
const hoursWorked = (e) => {
  if (!e.clock_out) return 0;
  return Math.max(0, (new Date(e.clock_out) - new Date(e.clock_in) - (e.break_minutes||0)*60000) / 3600000);
};
const countableEntry = (e) => !e.is_exception || e.approved === true;

const DAYS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Live running clock ────────────────────────────────────────
function LiveClock({ since }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(since)) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [since]);
  const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60;
  return <span>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

// ── Shift check: is now within ±5 min of a scheduled shift? ──
function findActiveShift(shifts) {
  const now = Date.now();
  const WINDOW = 5 * 60 * 1000; // 5 minutes in ms
  return shifts.find(s => {
    const start = new Date(s.start_time).getTime();
    const end   = new Date(s.end_time).getTime();
    return now >= start - WINDOW && now <= end + WINDOW;
  }) || null;
}

export default function StaffPortal() {
  const { token } = useParams();
  const [emp,     setEmp]     = useState(null);
  const [event,   setEvent]   = useState(null);
  const [entries, setEntries] = useState([]);
  const [shifts,  setShifts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [tab,     setTab]     = useState("clock");

  // Clock-in state
  const [noteInput,    setNoteInput]    = useState("");
  const [clockingIn,   setClockingIn]   = useState(false);
  const [clockingOut,  setClockingOut]  = useState(false);
  const [exWarning,    setExWarning]    = useState(false); // exception warning modal

  // Break modal
  const [breakModal, setBreakModal] = useState(false);
  const [breakMins,  setBreakMins]  = useState(30);

  // Timesheet
  const [tsWeek, setTsWeek] = useState(weekStart(new Date()));

  // Schedule calendar
  const [calView,   setCalView]   = useState("week");
  const [calCursor, setCalCursor] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      const { data: empData } = await supabase
        .from("employees")
        .select("*, events(name, date, venue_name)")
        .eq("access_token", token)
        .single();
      if (!empData) { setInvalid(true); setLoading(false); return; }
      setEmp(empData);
      setEvent(empData.events);
      const [{ data: en }, { data: sh }] = await Promise.all([
        supabase.from("time_entries").select("*").eq("employee_id", empData.id).order("clock_in", { ascending: false }),
        supabase.from("shifts").select("*").eq("employee_id", empData.id).order("start_time"),
      ]);
      setEntries(en || []);
      setShifts(sh  || []);
      setLoading(false);
    };
    load();
  }, [token]);

  // ── Active (open) entry ───────────────────────────────────
  const activeEntry = entries.find(e => !e.clock_out) || null;

  // ── Clock-in logic ────────────────────────────────────────
  const doClockIn = async (isException) => {
    setClockingIn(true);
    const { data } = await supabase.from("time_entries")
      .insert({
        event_id:     emp.event_id,
        employee_id:  emp.id,
        clock_in:     new Date().toISOString(),
        notes:        noteInput || null,
        is_exception: isException,
        approved:     isException ? null : true, // exceptions start as pending
      })
      .select().single();
    setEntries(es => [data, ...es]);
    setNoteInput("");
    setClockingIn(false);
    setExWarning(false);
  };

  const handleClockInPress = () => {
    const matchingShift = findActiveShift(shifts);
    if (!matchingShift) {
      // No shift found — show warning
      setExWarning(true);
    } else {
      doClockIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setClockingOut(true);
    const { data } = await supabase.from("time_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", activeEntry.id)
      .select().single();
    setEntries(es => es.map(e => e.id === activeEntry.id ? data : e));
    setClockingOut(false);
  };

  const handleAddBreak = async () => {
    if (!activeEntry) return;
    const newBreak = (activeEntry.break_minutes || 0) + parseInt(breakMins || 0);
    const { data } = await supabase.from("time_entries")
      .update({ break_minutes: newBreak })
      .eq("id", activeEntry.id)
      .select().single();
    setEntries(es => es.map(e => e.id === activeEntry.id ? data : e));
    setBreakModal(false);
  };

  // ── Timesheet ─────────────────────────────────────────────
  const wsDate   = weekStart(tsWeek);
  const weekEnd  = addDays(wsDate, 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wsDate, i));

  // KEY FIX: compare using timestamp numbers, not Date objects directly
  const weekEntries = entries.filter(e => {
    const t = new Date(e.clock_in).getTime();
    return t >= wsDate.getTime() && t < weekEnd.getTime();
  });

  const countable  = weekEntries.filter(countableEntry);
  const totalHrs   = countable.reduce((s, e) => s + hoursWorked(e), 0);
  const gross      = totalHrs * (emp?.hourly_rate || 0);
  const tax        = gross * ((emp?.tax_rate || 0) / 100);
  const net        = Math.max(0, gross - tax - (emp?.deductions || 0));
  const exceptionEntries = weekEntries.filter(e => e.is_exception);

  // ── Schedule calendar ─────────────────────────────────────
  const calWs      = weekStart(calCursor);
  const calWeekDays = Array.from({ length: 7 }, (_, i) => addDays(calWs, i));
  const monthFirst  = new Date(`${nzDateStr(calCursor).slice(0,7)}-01T12:00:00+12:00`);
  const gridStart   = addDays(monthFirst, -(monthFirst.getDay() || 7) + 1);
  const monthCells  = Array.from({ length: 35 }, (_, i) => addDays(gridStart, i));
  const shiftsOnDay = (day) => shifts.filter(s => sameDay(s.start_time, day));

  const navCal = (dir) => {
    const d = new Date(calCursor);
    if (calView === "day")   d.setDate(d.getDate() + dir);
    if (calView === "week")  d.setDate(d.getDate() + 7 * dir);
    if (calView === "month") d.setMonth(d.getMonth() + dir);
    setCalCursor(d);
  };
  const calLabel = calView === "day"
    ? new Date(calCursor).toLocaleDateString("en-NZ", { timeZone:NZ_TZ, weekday:"long", day:"numeric", month:"long" })
    : calView === "week"
    ? `${fmt(calWeekDays[0])} – ${fmt(calWeekDays[6])}`
    : new Date(calCursor).toLocaleDateString("en-NZ", { timeZone:NZ_TZ, month:"long", year:"numeric" });

  // ── Next upcoming shift ───────────────────────────────────
  const nextShift = [...shifts]
    .filter(s => new Date(s.start_time) > new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];

  const S = {
    page:  { minHeight:"100vh", background:"#06060e", fontFamily:"'DM Sans',sans-serif", color:"#e2d9cc" },
    card:  { background:"#0a0a14", border:"1px solid #1e1e2e", borderRadius:16, padding:"20px" },
    label: { display:"block", fontSize:11, color:"#5a5a72", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 },
    navBtn: { background:"#13131f", border:"1px solid #1e1e2e", color:"#e2d9cc", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  };

  if (loading) return (
    <div style={{...S.page, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
      <span style={{ color:"#3a3a52" }}>Loading…</span>
    </div>
  );

  if (invalid) return (
    <div style={{...S.page, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
      <div>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", color:"#ef4444", marginBottom:8 }}>Invalid Link</h1>
        <p style={{ color:"#5a5a72" }}>This staff portal link is not valid or has expired.</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{ background:"#0a0a14", borderBottom:"1px solid #1e1e2e", padding:"14px 20px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#c9a84c,#a8872e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#080810", fontWeight:700, flexShrink:0 }}>
          {(emp.name||"?")[0].toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700 }}>{emp.name}</div>
          <div style={{ fontSize:12, color:"#5a5a72" }}>{emp.role||"Staff"} · {event?.name}</div>
        </div>
        {activeEntry && (
          <div style={{ fontSize:12, color:"#10b981", background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:20, padding:"4px 10px", flexShrink:0, fontVariantNumeric:"tabular-nums" }}>
            ● <LiveClock since={activeEntry.clock_in}/>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:"1px solid #1e1e2e", background:"#0a0a14" }}>
        {[["clock","🕐 Clock"],["timesheet","📋 Timesheet"],["schedule","📅 Schedule"]].map(([id,label]) => (
          <button key={id}
            style={{ background:"none", border:"none", padding:"11px 18px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", color:tab===id?"#e2d9cc":"#5a5a72", borderBottom:`2px solid ${tab===id?"#c9a84c":"transparent"}`, transition:"all 0.15s" }}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"24px 16px" }}>

        {/* ─────────────── CLOCK TAB ─────────────── */}
        {tab === "clock" && (
          <div>
            {/* Main clock card */}
            <div style={{...S.card, textAlign:"center", padding:"36px 20px", marginBottom:14}}>
              {activeEntry ? (
                <>
                  <div style={{ fontSize:13, color:activeEntry.is_exception?"#f59e0b":"#10b981", marginBottom:8 }}>
                    {activeEntry.is_exception ? "⚠ Clocked in (unscheduled — pending approval)" : "● Clocked in"}
                  </div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:48, fontWeight:700, color:activeEntry.is_exception?"#f59e0b":"#10b981", marginBottom:4, fontVariantNumeric:"tabular-nums" }}>
                    <LiveClock since={activeEntry.clock_in}/>
                  </div>
                  <div style={{ fontSize:13, color:"#5a5a72", marginBottom:24 }}>
                    Since {fmtTime(activeEntry.clock_in)}
                    {activeEntry.break_minutes > 0 && ` · ${activeEntry.break_minutes}m break logged`}
                  </div>
                  <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                    <button onClick={() => setBreakModal(true)}
                      style={{ background:"none", border:"1px solid rgba(245,158,11,0.3)", color:"#f59e0b", borderRadius:12, padding:"12px 18px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                      ☕ Log Break
                    </button>
                    <button onClick={handleClockOut} disabled={clockingOut}
                      style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", color:"white", borderRadius:12, padding:"12px 28px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 20px rgba(239,68,68,0.3)", opacity:clockingOut?0.6:1 }}>
                      ■ Clock Out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:13, color:"#5a5a72", marginBottom:6 }}>Not clocked in</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, color:"#e2d9cc", marginBottom:20, fontVariantNumeric:"tabular-nums" }}>
                    {new Date().toLocaleTimeString("en-NZ", { timeZone:NZ_TZ, hour:"2-digit", minute:"2-digit" })}
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                      placeholder="Note (optional)…"
                      style={{ width:"100%", maxWidth:300, boxSizing:"border-box", background:"#13131f", border:"1px solid #1e1e2e", borderRadius:9, padding:"10px 14px", color:"#e2d9cc", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", textAlign:"center" }}/>
                  </div>
                  <button onClick={handleClockInPress} disabled={clockingIn}
                    style={{ background:"linear-gradient(135deg,#10b981,#059669)", border:"none", color:"white", borderRadius:12, padding:"14px 40px", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 24px rgba(16,185,129,0.3)", opacity:clockingIn?0.6:1 }}>
                    ▶ Clock In
                  </button>
                </>
              )}
            </div>

            {/* Next shift */}
            {nextShift && (
              <div style={{...S.card, marginBottom:14, display:"flex", gap:14, alignItems:"center"}}>
                <div style={{ width:4, height:44, borderRadius:99, background:"#818cf8", flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:11, color:"#5a5a72", marginBottom:3 }}>Next Shift</div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{fmt(nextShift.start_time)}</div>
                  <div style={{ fontSize:12, color:"#5a5a72" }}>{fmtTime(nextShift.start_time)} – {fmtTime(nextShift.end_time)}{nextShift.role ? ` · ${nextShift.role}` : ""}</div>
                </div>
              </div>
            )}

            {/* Recent entries */}
            <div style={S.card}>
              <div style={{ fontSize:11, color:"#3a3a52", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Recent Entries</div>
              {entries.slice(0, 6).length === 0
                ? <div style={{ textAlign:"center", padding:"20px 0", color:"#3a3a52", fontSize:13 }}>No entries yet.</div>
                : entries.slice(0, 6).map((e, i) => (
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i < Math.min(entries.length, 6)-1 ? "1px solid #0d0d1a" : "none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, color:"#8a8278" }}>{fmt(e.clock_in)}</span>
                        {e.is_exception && (
                          <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:e.approved===true?"rgba(16,185,129,0.12)":e.approved===false?"rgba(239,68,68,0.12)":"rgba(245,158,11,0.12)", color:e.approved===true?"#10b981":e.approved===false?"#ef4444":"#f59e0b", border:`1px solid ${e.approved===true?"rgba(16,185,129,0.25)":e.approved===false?"rgba(239,68,68,0.25)":"rgba(245,158,11,0.25)"}` }}>
                            {e.approved===true ? "✓ Approved" : e.approved===false ? "✗ Rejected" : "⚠ Pending"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:"#5a5a72" }}>
                        <span style={{ color:"#10b981" }}>▶ {fmtTime(e.clock_in)}</span>
                        {" → "}
                        <span style={{ color: e.clock_out ? "#5a5a72" : "#f59e0b" }}>{e.clock_out ? `■ ${fmtTime(e.clock_out)}` : "● Active"}</span>
                        {e.break_minutes > 0 && <span style={{ color:"#3a3a52" }}> · {e.break_minutes}m break</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color: e.is_exception && e.approved !== true ? "#3a3a52" : "#818cf8" }}>
                      {hoursWorked(e).toFixed(2)}h
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ─────────────── TIMESHEET TAB ─────────────── */}
        {tab === "timesheet" && (
          <div>
            {/* Week nav */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <button style={S.navBtn} onClick={() => setTsWeek(addDays(tsWeek, -7))}>←</button>
              <div style={{ flex:1, textAlign:"center", fontSize:14, fontWeight:600 }}>{fmt(wsDate)} – {fmt(addDays(wsDate, 6))}</div>
              <button style={S.navBtn} onClick={() => setTsWeek(addDays(tsWeek, 7))}>→</button>
            </div>

            {/* Exception notice */}
            {exceptionEntries.length > 0 && (
              <div style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:14, fontSize:13, color:"#f59e0b" }}>
                ⚠ {exceptionEntries.filter(e=>e.approved===null).length} unscheduled {exceptionEntries.filter(e=>e.approved===null).length===1?"entry is":"entries are"} pending manager approval and excluded from totals.
              </div>
            )}

            {/* Pay summary */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[["⏱ Hours",`${totalHrs.toFixed(2)}h`,"#818cf8"],["💰 Gross",`$${gross.toFixed(2)}`,"#c9a84c"],["🧾 Tax",`−$${tax.toFixed(2)}`,"#ef4444"],["✅ Net Pay",`$${net.toFixed(2)}`,"#10b981"]].map(([l,v,c]) => (
                <div key={l} style={{ background:"#0a0a14", border:`1px solid ${c}20`, borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ fontSize:12, color:"#5a5a72", marginBottom:6 }}>{l}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Daily rows */}
            <div style={S.card}>
              {weekDays.map((day, di) => {
                const dayEntries = weekEntries.filter(e => sameDay(e.clock_in, day));
                const dayHrs = dayEntries.filter(countableEntry).reduce((s, e) => s + hoursWorked(e), 0);
                const isToday = sameDay(day, new Date());
                return (
                  <div key={di} style={{ display:"flex", gap:14, padding:"12px 0", borderBottom: di < 6 ? "1px solid #0d0d1a" : "none" }}>
                    <div style={{ width:40, flexShrink:0, textAlign:"center" }}>
                      <div style={{ fontSize:11, color:"#5a5a72" }}>{DAYS[di]}</div>
                      <div style={{ fontSize:18, fontWeight:700, color:isToday?"#c9a84c":"#e2d9cc" }}>{new Date(day).toLocaleDateString("en-NZ",{timeZone:NZ_TZ,day:"numeric"})}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      {dayEntries.length === 0
                        ? <div style={{ fontSize:12, color:"#2a2a3a", paddingTop:6 }}>—</div>
                        : dayEntries.map((e, i) => (
                          <div key={e.id} style={{ fontSize:12, marginBottom: i < dayEntries.length-1 ? 5 : 0, display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ color:"#10b981" }}>▶{fmtTime(e.clock_in)}</span>
                            {" → "}
                            <span style={{ color: e.clock_out ? "#5a5a72" : "#f59e0b" }}>{e.clock_out ? `■${fmtTime(e.clock_out)}` : "●active"}</span>
                            {e.break_minutes > 0 && <span style={{ color:"#3a3a52" }}>{e.break_minutes}m brk</span>}
                            {e.is_exception && (
                              <span style={{ fontSize:10, padding:"1px 5px", borderRadius:8, background:e.approved===true?"rgba(16,185,129,0.1)":"rgba(245,158,11,0.1)", color:e.approved===true?"#10b981":"#f59e0b" }}>
                                {e.approved===true?"✓":"⚠"}
                              </span>
                            )}
                          </div>
                        ))
                      }
                    </div>
                    {dayHrs > 0 && <div style={{ fontSize:14, fontWeight:600, color:"#818cf8", flexShrink:0, paddingTop:6 }}>{dayHrs.toFixed(1)}h</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────── SCHEDULE TAB ─────────────── */}
        {tab === "schedule" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, flexWrap:"wrap" }}>
              <button style={S.navBtn} onClick={() => navCal(-1)}>←</button>
              <button onClick={() => setCalCursor(new Date())} style={{...S.navBtn, fontSize:12, color:"#5a5a72"}}>Today</button>
              <button style={S.navBtn} onClick={() => navCal(1)}>→</button>
              <div style={{ flex:1, fontSize:14, fontWeight:600 }}>{calLabel}</div>
              <div style={{ display:"flex", background:"#0a0a14", border:"1px solid #1e1e2e", borderRadius:8, overflow:"hidden" }}>
                {["day","week","month"].map(v => (
                  <button key={v} onClick={() => setCalView(v)}
                    style={{ background:calView===v?"#1e1e2e":"none", border:"none", color:calView===v?"#e2d9cc":"#5a5a72", padding:"7px 12px", cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif", textTransform:"capitalize" }}>{v}</button>
                ))}
              </div>
            </div>

            {calView === "month" ? (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:4 }}>
                  {DAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:11, color:"#3a3a52", padding:"6px 0" }}>{d}</div>)}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                  {monthCells.map((day, i) => {
                    const ds = shiftsOnDay(day);
                    const inMonth = nzDateStr(day).slice(0,7) === nzDateStr(calCursor).slice(0,7);
                    const isToday = sameDay(day, new Date());
                    return (
                      <div key={i} style={{ minHeight:72, background:isToday?"rgba(201,168,76,0.04)":"#0a0a14", border:`1px solid ${isToday?"rgba(201,168,76,0.2)":"#1a1a28"}`, borderRadius:8, padding:"5px 6px", opacity:inMonth?1:0.35 }}>
                        <div style={{ fontSize:11, color:isToday?"#c9a84c":"#5a5a72", fontWeight:isToday?700:400, marginBottom:3 }}>
                          {new Date(day).toLocaleDateString("en-NZ",{timeZone:NZ_TZ,day:"numeric"})}
                        </div>
                        {ds.map(s => (
                          <div key={s.id} style={{ background:"rgba(129,140,248,0.12)", borderRadius:4, padding:"2px 5px", fontSize:10, color:"#818cf8", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {fmtTime(s.start_time)} {s.role || "Shift"}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : calView === "week" ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
                {calWeekDays.map((day, i) => {
                  const ds = shiftsOnDay(day);
                  const isToday = sameDay(day, new Date());
                  return (
                    <div key={i} style={{ minHeight:120, background:isToday?"rgba(201,168,76,0.04)":"#0a0a14", border:`1px solid ${isToday?"rgba(201,168,76,0.25)":"#1a1a28"}`, borderRadius:12, padding:"10px 8px", cursor:"pointer" }}
                      onClick={() => { setCalCursor(day); setCalView("day"); }}>
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:11, color:"#5a5a72" }}>{DAYS[i]}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:isToday?"#c9a84c":"#e2d9cc" }}>{new Date(day).toLocaleDateString("en-NZ",{timeZone:NZ_TZ,day:"numeric"})}</div>
                      </div>
                      {ds.map(s => (
                        <div key={s.id} style={{ background:"rgba(129,140,248,0.1)", border:"1px solid rgba(129,140,248,0.25)", borderRadius:5, padding:"3px 6px", fontSize:10, color:"#818cf8", marginBottom:2 }}>
                          {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                        </div>
                      ))}
                      {ds.length === 0 && <div style={{ fontSize:10, color:"#2a2a3a", textAlign:"center", marginTop:8 }}>—</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={S.card}>
                {shiftsOnDay(calCursor).length === 0
                  ? <div style={{ textAlign:"center", padding:"30px 0", color:"#3a3a52", fontSize:13 }}>No shifts scheduled for this day.</div>
                  : shiftsOnDay(calCursor).map((s, i) => {
                      const dur = ((new Date(s.end_time) - new Date(s.start_time)) / 3600000).toFixed(1);
                      return (
                        <div key={s.id} style={{ padding:"14px 0", borderBottom: i < shiftsOnDay(calCursor).length-1 ? "1px solid #0d0d1a" : "none" }}>
                          <div style={{ fontSize:15, fontWeight:600, color:"#818cf8", marginBottom:4 }}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</div>
                          <div style={{ fontSize:13, color:"#5a5a72" }}>{dur}h{s.role ? ` · ${s.role}` : ""}{s.notes ? ` · ${s.notes}` : ""}</div>
                        </div>
                      );
                    })
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Exception warning modal ── */}
      {exWarning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:24, backdropFilter:"blur(8px)" }}
          onClick={() => setExWarning(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#0a0a14", border:"1px solid rgba(245,158,11,0.3)", borderRadius:20, width:"100%", maxWidth:400, padding:28, boxShadow:"0 24px 60px rgba(0,0,0,0.7)" }}>
            <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>⚠️</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, textAlign:"center", margin:"0 0 10px", color:"#f59e0b" }}>No Shift Scheduled</h3>
            <p style={{ fontSize:14, color:"#8a8278", textAlign:"center", lineHeight:1.7, marginBottom:24 }}>
              You don't have a scheduled shift right now. If you clock in, this will be logged as an <strong style={{color:"#f59e0b"}}>exception</strong> and will need manager approval before counting toward your timesheet.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setExWarning(false)}
                style={{ flex:1, background:"none", border:"1px solid #1e1e2e", color:"#5a5a72", borderRadius:10, padding:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>
                Cancel
              </button>
              <button onClick={() => doClockIn(true)}
                style={{ flex:2, background:"linear-gradient(135deg,#f59e0b,#d97706)", border:"none", color:"#080810", borderRadius:10, padding:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>
                Clock In Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Break modal ── */}
      {breakModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:24 }}
          onClick={() => setBreakModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#0a0a14", border:"1px solid #1e1e2e", borderRadius:20, width:"100%", maxWidth:340, padding:28 }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, margin:"0 0 16px" }}>Log Break</h3>
            <label style={S.label}>Break duration (minutes)</label>
            <input type="number" value={breakMins} onChange={e => setBreakMins(e.target.value)} min={1} max={480}
              style={{ width:"100%", boxSizing:"border-box", background:"#13131f", border:"1px solid #1e1e2e", borderRadius:9, padding:"12px 14px", color:"#e2d9cc", fontSize:16, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:20, textAlign:"center" }}/>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setBreakModal(false)} style={{ flex:1, background:"none", border:"1px solid #1e1e2e", color:"#5a5a72", borderRadius:10, padding:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
              <button onClick={handleAddBreak} style={{ flex:2, background:"linear-gradient(135deg,#f59e0b,#d97706)", border:"none", color:"#080810", borderRadius:10, padding:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Add Break</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
