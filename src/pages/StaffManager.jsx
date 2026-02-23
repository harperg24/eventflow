// ============================================================
//  StaffManager.jsx  —  Manager view for staff timesheets
//  Tabs: Schedule | Employees | Timesheets
//  Route: rendered inside Dashboard when activeNav === "staff"
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ── Helpers — NZ timezone (Pacific/Auckland) ─────────────────
const NZ_TZ = "Pacific/Auckland";
const fmt     = (d) => new Date(d).toLocaleDateString("en-NZ",  { timeZone:NZ_TZ, weekday:"short", day:"numeric", month:"short" });
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-NZ", { timeZone:NZ_TZ, hour:"2-digit", minute:"2-digit" }) : "--:--";

// "YYYY-MM-DD" in NZ local time — the only correct way to compare days
const nzDateStr = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const p = new Intl.DateTimeFormat("en-NZ", { timeZone:NZ_TZ, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(dt);
  return `${p.find(x=>x.type==="year").value}-${p.find(x=>x.type==="month").value}-${p.find(x=>x.type==="day").value}`;
};
const fmtDate  = nzDateStr; // alias for CSV export
const sameDay  = (a, b) => nzDateStr(a) === nzDateStr(b);

// UTC Date representing NZ midnight for the given date
const nzMidnightUTC = (d) => new Date(`${nzDateStr(d)}T00:00:00+12:00`);

// Monday of the NZ week containing d — returns a UTC Date
const weekStart = (d) => {
  const local = new Date(`${nzDateStr(d)}T12:00:00+12:00`); // NZ noon, DST-safe
  const offset = local.getDay() === 0 ? -6 : 1 - local.getDay();
  local.setDate(local.getDate() + offset);
  return nzMidnightUTC(local);
};
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt; };

const hoursWorked = (entry) => {
  if (!entry.clock_out) return 0;
  const ms = new Date(entry.clock_out) - new Date(entry.clock_in) - (entry.break_minutes||0)*60000;
  return Math.max(0, ms / 3600000);
};

// Entries only count toward pay if they are NOT exceptions, or ARE approved exceptions
const countableEntry = (e) => !e.is_exception || e.approved === true;
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function calcPay(entries, emp) {
  const totalHours = entries.filter(countableEntry).reduce((s, e) => s + hoursWorked(e), 0);
  const gross = totalHours * (emp.hourly_rate || 0);
  const taxAmt = gross * ((emp.tax_rate || 0) / 100);
  const net = Math.max(0, gross - taxAmt - (emp.deductions || 0));
  return { totalHours, gross, taxAmt, net };
}

const COLOR_PALETTE = ["#818cf8","#10b981","#f59e0b","#ec4899","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];

// ── Employee Modal ────────────────────────────────────────────
function EmployeeModal({ emp, onSave, onClose }) {
  const [form, setForm] = useState(emp || { name:"", email:"", phone:"", role:"", hourly_rate:"", tax_rate:"", deductions:"", notes:"" });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400, padding:24, backdropFilter:"blur(8px)" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:20, width:"100%", maxWidth:520, padding:28, boxShadow:"0 32px 80px rgba(0,0,0,0.7)", maxHeight:"90vh", overflowY:"auto" }}>
        <h2 style={{ fontFamily:"inherit,serif", fontSize:20, margin:"0 0 20px" }}>{emp?.id ? "Edit Employee" : "Add Employee"}</h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          {[["name","Full Name *","text"],["role","Role / Position","text"],["email","Email","email"],["phone","Phone","tel"]].map(([k,l,t])=>(
            <div key={k}>
              <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{l}</label>
              <input type={t} value={form[k]||""} onChange={e=>set(k,e.target.value)}
                style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }} />
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
          {[["hourly_rate","Hourly Rate (NZD)"],["tax_rate","Tax Rate (%)"],["deductions","Deductions (NZD)"]].map(([k,l])=>(
            <div key={k}>
              <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{l}</label>
              <input type="number" min="0" step="0.01" value={form[k]||""} onChange={e=>set(k,e.target.value)}
                style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>Notes</label>
          <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} rows={2}
            style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif", resize:"vertical" }} />
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:"none", border:"1.5px solid var(--border)", color:"var(--text2)", borderRadius:10, padding:12, fontSize:13, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Cancel</button>
          <button onClick={()=>onSave(form)} disabled={!form.name?.trim()}
            style={{ flex:2, background:"var(--accent)", border:"none", color:"var(--bg)", borderRadius:10, padding:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", opacity:!form.name?.trim()?0.4:1 }}>
            {emp?.id ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shift Modal ───────────────────────────────────────────────
function ShiftModal({ shift, employees, onSave, onClose }) {
  const [form, setForm] = useState(shift || { employee_id:"", start_time:"", end_time:"", role:"", notes:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400, padding:24, backdropFilter:"blur(8px)" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:20, width:"100%", maxWidth:460, padding:28, boxShadow:"0 32px 80px rgba(0,0,0,0.7)" }}>
        <h2 style={{ fontFamily:"inherit,serif", fontSize:20, margin:"0 0 20px" }}>{shift?.id ? "Edit Shift" : "Add Shift"}</h2>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>Employee *</label>
          <select value={form.employee_id} onChange={e=>set("employee_id",e.target.value)}
            style={{ width:"100%", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color: form.employee_id ? "var(--text)":"var(--text3)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            <option value="">Select employee…</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name} {e.role ? `(${e.role})`:""}</option>)}
          </select>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          {[["start_time","Start"],["end_time","End"]].map(([k,l])=>(
            <div key={k}>
              <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{l}</label>
              <input type="datetime-local" value={form[k]?.slice?.(0,16)||""} onChange={e=>set(k,e.target.value)}
                style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>Role Override</label>
          <input value={form.role||""} onChange={e=>set("role",e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>Notes</label>
          <input value={form.notes||""} onChange={e=>set("notes",e.target.value)}
            style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"10px 13px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }} />
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:"none", border:"1.5px solid var(--border)", color:"var(--text2)", borderRadius:10, padding:12, fontSize:13, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Cancel</button>
          <button onClick={()=>onSave(form)} disabled={!form.employee_id||!form.start_time||!form.end_time}
            style={{ flex:2, background:"var(--accent)", border:"none", color:"var(--bg)", borderRadius:10, padding:12, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", opacity:(!form.employee_id||!form.start_time||!form.end_time)?0.4:1 }}>
            {shift?.id ? "Save Changes" : "Add Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Calendar ─────────────────────────────────────────
function ScheduleCalendar({ eventId, employees, shifts, onAddShift, onEditShift, onDeleteShift }) {
  const [view, setView]       = useState("week"); // week | day | month
  const [cursor, setCursor]   = useState(new Date());
  const [filterEmp, setFilterEmp] = useState("all");
  const [listView, setListView] = useState(false);

  const empColor = useCallback((empId) => {
    const idx = employees.findIndex(e=>e.id===empId);
    return COLOR_PALETTE[idx % COLOR_PALETTE.length] || "#818cf8";
  },[employees]);

  const visibleShifts = shifts.filter(s => filterEmp==="all" || s.employee_id===filterEmp);

  // Week view days
  const ws = weekStart(cursor);
  const weekDays = Array.from({length:7},(_,i)=>addDays(ws,i));

  // Month view
  const monthFirst = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthLast  = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0);
  const gridStart  = addDays(monthFirst, -(monthFirst.getDay()||7)+1);
  const monthCells = Array.from({length:35},(_,i)=>addDays(gridStart,i));

  const navigate = (dir) => {
    const d = new Date(cursor);
    if (view==="day")   d.setDate(d.getDate()+dir);
    if (view==="week")  d.setDate(d.getDate()+7*dir);
    if (view==="month") d.setMonth(d.getMonth()+dir);
    setCursor(d);
  };

  const shiftsOnDay = (day) => visibleShifts.filter(s=>sameDay(s.start_time, day));

  const ShiftChip = ({s}) => {
    const emp = employees.find(e=>e.id===s.employee_id);
    const col = empColor(s.employee_id);
    return (
      <div onClick={()=>onEditShift(s)} style={{ background:`${col}18`, border:`1px solid ${col}40`, borderRadius:6, padding:"3px 8px", fontSize:11, color:col, cursor:"pointer", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
        title={`${emp?.name} ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`}>
        {fmtTime(s.start_time)} {emp?.name?.split(" ")[0]}
      </div>
    );
  };

  const headerLabel = view==="day"
    ? new Date(cursor).toLocaleDateString("en-NZ",{weekday:"long",day:"numeric",month:"long",year:"numeric"})
    : view==="week"
    ? `${fmt(weekDays[0])} – ${fmt(weekDays[6])}`
    : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={()=>navigate(-1)} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14 }}>←</button>
          <button onClick={()=>setCursor(new Date())} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text2)", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:12 }}>Today</button>
          <button onClick={()=>navigate(1)} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14 }}>→</button>
        </div>
        <div style={{ flex:1, fontSize:15, fontWeight:600, color:"var(--text)" }}>{headerLabel}</div>
        {/* View toggles */}
        <div style={{ display:"flex", background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
          {["day","week","month"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ background:view===v?"var(--border)":"none", border:"none", color:view===v?"var(--text)":"var(--text2)", padding:"7px 14px", cursor:"pointer", fontSize:12, fontFamily:"'Plus Jakarta Sans',sans-serif", textTransform:"capitalize" }}>{v}</button>
          ))}
          <button onClick={()=>setListView(l=>!l)} style={{ background:listView?"var(--border)":"none", border:"none", borderLeft:"1.5px solid var(--border)", color:listView?"var(--text)":"var(--text2)", padding:"7px 12px", cursor:"pointer", fontSize:12, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>≡ List</button>
        </div>
        {/* Employee filter */}
        <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)}
          style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"7px 12px", color:"var(--text)", fontSize:12, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          <option value="all">All Staff</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button onClick={onAddShift} style={{ background:"var(--accent)", border:"none", color:"var(--bg)", borderRadius:9, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>+ Shift</button>
      </div>

      {/* List view */}
      {listView ? (
        <div className="card" style={{ overflow:"hidden" }}>
          {visibleShifts.length===0 && <div style={{ padding:40, textAlign:"center", color:"var(--text3)", fontSize:13 }}>No shifts scheduled.</div>}
          {[...visibleShifts].sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)).map((s,i)=>{
            const emp = employees.find(e=>e.id===s.employee_id);
            const col = empColor(s.employee_id);
            const dur = (new Date(s.end_time)-new Date(s.start_time))/3600000;
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 20px", borderBottom:i<visibleShifts.length-1?"1px solid var(--border)":"none" }}>
                <div style={{ width:4, height:36, borderRadius:99, background:col, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{emp?.name}</div>
                  <div style={{ fontSize:12, color:"var(--text2)" }}>{fmt(s.start_time)} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)} · {dur.toFixed(1)}h</div>
                </div>
                {s.role && <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, background:"var(--bg3)", color:"var(--text2)", border:"1.5px solid var(--border)" }}>{s.role}</span>}
                <button onClick={()=>onEditShift(s)} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:7, padding:"5px 10px", color:"var(--text2)", cursor:"pointer", fontSize:12, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>✎</button>
                <button onClick={()=>onDeleteShift(s.id)} style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>✕</button>
              </div>
            );
          })}
        </div>
      ) : view==="month" ? (
        /* Month grid */
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:4 }}>
            {DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, color:"var(--text3)", padding:"6px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1 }}>
            {monthCells.map((day,i)=>{
              const dayShifts = shiftsOnDay(day);
              const inMonth = day.getMonth()===cursor.getMonth();
              const isToday = sameDay(day, new Date());
              return (
                <div key={i} style={{ minHeight:90, background:isToday?"rgba(201,168,76,0.04)":"var(--bg2)", border:`1px solid ${isToday?"var(--accentBorder)":"var(--bg3)"}`, borderRadius:8, padding:"6px 8px", opacity:inMonth?1:0.3 }}>
                  <div style={{ fontSize:12, color:isToday?"var(--accent)":"var(--text2)", fontWeight:isToday?700:400, marginBottom:4 }}>{day.getDate()}</div>
                  {dayShifts.slice(0,3).map(s=><ShiftChip key={s.id} s={s}/>)}
                  {dayShifts.length>3 && <div style={{ fontSize:10, color:"var(--text3)" }}>+{dayShifts.length-3} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : view==="week" ? (
        /* Week grid */
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
            {weekDays.map((day,i)=>{
              const dayShifts = shiftsOnDay(day);
              const isToday = sameDay(day, new Date());
              return (
                <div key={i} style={{ minHeight:140, background:isToday?"rgba(201,168,76,0.04)":"var(--bg2)", border:`1px solid ${isToday?"var(--accentBorder)":"var(--bg3)"}`, borderRadius:12, padding:"10px 10px 8px", cursor:"pointer" }}
                  onClick={()=>{setCursor(day);setView("day");}}>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, color:"var(--text2)" }}>{DAYS[i]}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:isToday?"var(--accent)":"var(--text)" }}>{day.getDate()}</div>
                  </div>
                  {dayShifts.map(s=><ShiftChip key={s.id} s={s}/>)}
                  {dayShifts.length===0 && <div style={{ fontSize:10, color:"#2a2a3a", marginTop:8, textAlign:"center" }}>+</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Day view */
        <div>
          <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:14, padding:"20px" }}>
            {shiftsOnDay(cursor).length===0
              ? <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text3)", fontSize:13 }}>No shifts scheduled for this day. <button onClick={onAddShift} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>+ Add one</button></div>
              : [...shiftsOnDay(cursor)].sort((a,b)=>new Date(a.start_time)-new Date(b.start_time)).map((s,i)=>{
                  const emp = employees.find(e=>e.id===s.employee_id);
                  const col = empColor(s.employee_id);
                  const dur = ((new Date(s.end_time)-new Date(s.start_time))/3600000).toFixed(1);
                  return (
                    <div key={s.id} style={{ display:"flex", gap:14, alignItems:"center", padding:"12px 0", borderBottom:i<shiftsOnDay(cursor).length-1?"1px solid #1a1a28":"none" }}>
                      <div style={{ width:36, height:36, borderRadius:"50%", background:`${col}18`, border:`1.5px solid ${col}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:col, fontWeight:700, flexShrink:0 }}>
                        {(emp?.name||"?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:"var(--text)" }}>{emp?.name}</div>
                        <div style={{ fontSize:12, color:"var(--text2)" }}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)} · {dur}h{s.role?` · ${s.role}`:""}</div>
                      </div>
                      <button onClick={()=>onEditShift(s)} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:7, padding:"5px 10px", color:"var(--text2)", cursor:"pointer", fontSize:12, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>✎ Edit</button>
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Timesheet view for a single employee ─────────────────────
function EmployeeTimesheet({ emp, entries, onClose }) {
  const [weekCursor, setWeekCursor] = useState(weekStart(new Date()));
  const ws2 = weekStart(weekCursor);
  const we  = addDays(ws2, 7);
  const weekEntries = entries.filter(e => {
    const t = new Date(e.clock_in).getTime();
    return t >= ws2.getTime() && t < we.getTime();
  });
  const { totalHours, gross, taxAmt, net } = calcPay(weekEntries, emp);
  const weekDays2 = Array.from({length:7},(_,i)=>addDays(ws2,i));

  const exportCSV = () => {
    const rows = [["Employee","Date","Clock In","Clock Out","Break (min)","Hours","Gross Pay","Tax","Net Pay"]];
    weekEntries.forEach(e=>{
      const h = hoursWorked(e);
      const g = h*(emp.hourly_rate||0);
      const t = g*((emp.tax_rate||0)/100);
      rows.push([emp.name, fmtDate(e.clock_in), fmtTime(e.clock_in), fmtTime(e.clock_out), e.break_minutes||0, h.toFixed(2), g.toFixed(2), t.toFixed(2), (g-t-(emp.deductions||0)/7).toFixed(2)]);
    });
    rows.push(["TOTAL","","","","",totalHours.toFixed(2),gross.toFixed(2),taxAmt.toFixed(2),net.toFixed(2)]);
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download=`timesheet_${emp.name.replace(/\s+/g,"_")}_week_${fmtDate(ws2)}.csv`; a.click();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400, padding:24, backdropFilter:"blur(8px)" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:20, width:"100%", maxWidth:680, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ padding:"24px 28px", borderBottom:"1.5px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h2 style={{ fontFamily:"inherit,serif", fontSize:22, margin:"0 0 4px" }}>{emp.name}</h2>
            <div style={{ fontSize:13, color:"var(--text2)" }}>{emp.role} · ${(emp.hourly_rate||0).toFixed(2)}/hr · {emp.tax_rate||0}% tax</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:8, padding:"6px 12px", color:"var(--text2)", cursor:"pointer", fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>✕ Close</button>
        </div>

        {/* Week nav */}
        <div style={{ padding:"16px 28px", borderBottom:"1.5px solid var(--border)", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>setWeekCursor(addDays(weekCursor,-7))} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>←</button>
          <div style={{ flex:1, textAlign:"center", fontSize:14, fontWeight:600 }}>{fmt(ws2)} – {fmt(addDays(ws2,6))}</div>
          <button onClick={()=>setWeekCursor(addDays(weekCursor,7))} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>→</button>
          <button onClick={exportCSV} style={{ background:"none", border:"1px solid rgba(201,168,76,0.3)", color:"var(--accent)", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>⬇ Export CSV</button>
        </div>

        {/* Pay summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, padding:"20px 28px", borderBottom:"1.5px solid var(--border)" }}>
          {[["Hours Worked", `${totalHours.toFixed(2)}h`, "#818cf8"],["Gross Pay", `$${gross.toFixed(2)}`, "var(--accent)"],["Tax", `-$${taxAmt.toFixed(2)}`, "#ef4444"],["Net Pay", `$${net.toFixed(2)}`, "#10b981"]].map(([l,v,c])=>(
            <div key={l} style={{ background:"#0d0d1a", border:`1px solid ${c}25`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:11, color:"var(--text2)", marginBottom:6 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Daily breakdown */}
        <div style={{ padding:"20px 28px" }}>
          <div style={{ fontSize:11, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>Daily Breakdown</div>
          {weekDays2.map((day,di)=>{
            const dayEntries = weekEntries.filter(e=>sameDay(e.clock_in,day));
            const dayHrs = dayEntries.reduce((s,e)=>s+hoursWorked(e),0);
            return (
              <div key={di} style={{ display:"flex", alignItems:"flex-start", gap:16, padding:"10px 0", borderBottom:di<6?"1px solid #0d0d1a":"none" }}>
                <div style={{ width:44, flexShrink:0 }}>
                  <div style={{ fontSize:11, color:"var(--text2)" }}>{DAYS[di]}</div>
                  <div style={{ fontSize:16, fontWeight:600, color:sameDay(day,new Date())?"var(--accent)":"var(--text)" }}>{day.getDate()}</div>
                </div>
                <div style={{ flex:1 }}>
                  {dayEntries.length===0
                    ? <div style={{ fontSize:12, color:"#2a2a3a", paddingTop:4 }}>No entries</div>
                    : dayEntries.map((e,i)=>(
                      <div key={e.id} style={{ display:"flex", gap:12, alignItems:"center", fontSize:12, color:"var(--text2)", marginBottom:i<dayEntries.length-1?6:0 }}>
                        <span style={{ color:"#10b981" }}>▶ {fmtTime(e.clock_in)}</span>
                        <span>→</span>
                        <span style={{ color: e.clock_out?"#ef4444":"#f59e0b" }}>{e.clock_out ? `■ ${fmtTime(e.clock_out)}` : "● Still clocked in"}</span>
                        {e.break_minutes>0 && <span style={{ color:"var(--text2)" }}>({e.break_minutes}m break)</span>}
                        <span style={{ marginLeft:"auto", color:"var(--text)", fontWeight:600 }}>{hoursWorked(e).toFixed(2)}h</span>
                      </div>
                    ))
                  }
                </div>
                {dayHrs>0 && <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", flexShrink:0 }}>{dayHrs.toFixed(1)}h</div>}
              </div>
            );
          })}
        </div>

        {/* Pay details */}
        {emp.deductions>0 && (
          <div style={{ margin:"0 28px 20px", background:"#0d0d1a", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Pay Calculation</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"var(--text2)" }}>Gross ({totalHours.toFixed(2)}h × ${(emp.hourly_rate||0).toFixed(2)})</span><span>${gross.toFixed(2)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"var(--text2)" }}>Tax ({emp.tax_rate||0}%)</span><span style={{ color:"#ef4444" }}>−${taxAmt.toFixed(2)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"var(--text2)" }}>Deductions</span><span style={{ color:"#ef4444" }}>−${(emp.deductions||0).toFixed(2)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", borderTop:"1.5px solid var(--border)", paddingTop:8, fontWeight:700, fontSize:14 }}><span>Net Pay</span><span style={{ color:"#10b981" }}>${net.toFixed(2)}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main StaffManager component ───────────────────────────────
export default function StaffManager({ eventId }) {
  const [tab, setTab]           = useState("schedule"); // schedule | employees | timesheets
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts]     = useState([]);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);

  // Modals
  const [empModal, setEmpModal]         = useState(null); // null | {} | emp object
  const [shiftModal, setShiftModal]     = useState(null);
  const [timesheetEmp, setTimesheetEmp] = useState(null);
  const [tsWeekFilter, setTsWeekFilter] = useState(weekStart(new Date()));
  const [tsEmpFilter, setTsEmpFilter]   = useState("all");

  useEffect(()=>{
    const load = async () => {
      const [{ data: emps }, { data: sh }, { data: en }] = await Promise.all([
        supabase.from("employees").select("*").eq("event_id", eventId).order("name"),
        supabase.from("shifts").select("*").eq("event_id", eventId).order("start_time"),
        supabase.from("time_entries").select("*").eq("event_id", eventId).order("clock_in", { ascending: false }),
      ]);
      setEmployees(emps||[]); setShifts(sh||[]); setEntries(en||[]);
      setLoading(false);
    };
    load();
  },[eventId]);

  // ── Employee CRUD ──────────────────────────────────────────
  const saveEmployee = async (form) => {
    const row = { event_id:eventId, name:form.name, email:form.email||null, phone:form.phone||null, role:form.role||null, hourly_rate:parseFloat(form.hourly_rate)||0, tax_rate:parseFloat(form.tax_rate)||0, deductions:parseFloat(form.deductions)||0, notes:form.notes||null };
    if (form.id) {
      const { data } = await supabase.from("employees").update(row).eq("id",form.id).select().single();
      setEmployees(es=>es.map(e=>e.id===form.id?data:e));
    } else {
      const { data } = await supabase.from("employees").insert(row).select().single();
      setEmployees(es=>[...es,data]);
    }
    setEmpModal(null);
  };

  const deleteEmployee = async (id) => {
    if (!window.confirm("Delete this employee? All their shifts and time entries will also be removed.")) return;
    await supabase.from("employees").delete().eq("id",id);
    setEmployees(es=>es.filter(e=>e.id!==id));
    setShifts(ss=>ss.filter(s=>s.employee_id!==id));
    setEntries(en=>en.filter(e=>e.employee_id!==id));
  };

  // ── Shift CRUD ─────────────────────────────────────────────
  const saveShift = async (form) => {
    const row = { event_id:eventId, employee_id:form.employee_id, start_time:form.start_time, end_time:form.end_time, role:form.role||null, notes:form.notes||null };
    if (form.id) {
      const { data } = await supabase.from("shifts").update(row).eq("id",form.id).select().single();
      setShifts(ss=>ss.map(s=>s.id===form.id?data:s));
    } else {
      const { data } = await supabase.from("shifts").insert(row).select().single();
      setShifts(ss=>[...ss,data]);
    }
    setShiftModal(null);
  };

  const deleteShift = async (id) => {
    await supabase.from("shifts").delete().eq("id",id);
    setShifts(ss=>ss.filter(s=>s.id!==id));
  };

  // ── Exception approvals ───────────────────────────────────
  const handleApproveException = async (entryId, approved) => {
    const { data } = await supabase.from("time_entries")
      .update({ approved, approved_at: new Date().toISOString() })
      .eq("id", entryId).select().single();
    setEntries(es => es.map(e => e.id === entryId ? data : e));

    // If approved, also create a shift for this entry
    if (approved) {
      const entry = entries.find(e => e.id === entryId);
      if (entry) {
        const { data: newShift } = await supabase.from("shifts").insert({
          event_id:    eventId,
          employee_id: entry.employee_id,
          start_time:  entry.clock_in,
          end_time:    entry.clock_out || new Date().toISOString(),
          notes:       "Auto-created from approved exception",
        }).select().single();
        if (newShift) setShifts(ss => [...ss, newShift]);
      }
    }
  };

  // ── Copy portal link ───────────────────────────────────────
  const copyPortalLink = (emp) => {
    const url = `${window.location.origin}/staff/${emp.access_token}`;
    navigator.clipboard.writeText(url);
    alert(`Portal link copied!\n${url}`);
  };

  if (loading) return <div style={{ textAlign:"center", padding:60, color:"var(--text3)", fontSize:14 }}>Loading staff data…</div>;

  // ── Timesheets tab ─────────────────────────────────────────
  const tsWeekStart = weekStart(tsWeekFilter);
  const tsWeekEnd   = addDays(tsWeekStart, 7);
  const tsEntries   = entries.filter(e=>{
    const t = new Date(e.clock_in).getTime();
    return t >= tsWeekStart.getTime() && t < tsWeekEnd.getTime() && (tsEmpFilter==="all"||e.employee_id===tsEmpFilter);
  });

  return (
    <div className="fade-up">
      <style>{`
        .staff-tab { background:none; border:none; padding:8px 16px; font-size:13px; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; color:#5a5a72; border-bottom:2px solid transparent; transition:all 0.15s; }
        .staff-tab.active { color:#e2d9cc; border-bottom-color:var(--accent); }
        .staff-tab:hover:not(.active) { color:#8a8278; }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:4 }}>
        <div>
          <h1 style={{ fontFamily:"inherit", fontSize:28, fontWeight:700, marginBottom:4 }}>Staff</h1>
          <p style={{ color:"var(--text2)", fontSize:14 }}>{employees.length} employees · {shifts.filter(s=>sameDay(s.start_time,new Date())).length} shifts today</p>
        </div>
        {tab==="employees" && <button onClick={()=>setEmpModal({})} style={{ background:"var(--accent)", border:"none", color:"var(--bg)", borderRadius:9, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>+ Add Employee</button>}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1.5px solid var(--border)", marginBottom:24 }}>
        {[["schedule","📅 Schedule"],["employees","👤 Employees"],["timesheets","📋 Timesheets"]].map(([id,label])=>(
          <button key={id} className={`staff-tab${tab===id?" active":""}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab==="schedule" && (
        <ScheduleCalendar
          eventId={eventId} employees={employees} shifts={shifts}
          onAddShift={()=>setShiftModal({})}
          onEditShift={(s)=>setShiftModal(s)}
          onDeleteShift={deleteShift}
        />
      )}

      {/* ── EMPLOYEES TAB ── */}
      {tab==="employees" && (
        <div>
          {employees.length===0
            ? <div style={{ textAlign:"center", padding:"60px 20px", color:"var(--text3)", fontSize:14 }}>
                No employees yet. <button onClick={()=>setEmpModal({})} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Add your first employee →</button>
              </div>
            : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
                {employees.map((emp,i)=>{
                  const col = COLOR_PALETTE[i % COLOR_PALETTE.length];
                  const empEntries = entries.filter(e=>e.employee_id===emp.id);
                  const thisWeekEntries = empEntries.filter(e=>new Date(e.clock_in).getTime()>=weekStart(new Date()).getTime());
                  const { totalHours: wkHrs } = calcPay(thisWeekEntries, emp);
                  const clocked = empEntries.find(e=>!e.clock_out);
                  return (
                    <div key={emp.id} style={{ background:"var(--bg2)", border:`1px solid ${col}25`, borderRadius:16, padding:"18px 20px", position:"relative", overflow:"hidden" }}>
                      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${col},transparent)` }}/>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
                        <div style={{ width:40, height:40, borderRadius:"50%", background:`${col}18`, border:`1.5px solid ${col}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:col, fontWeight:700, flexShrink:0 }}>
                          {emp.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:"var(--text)", marginBottom:2 }}>{emp.name}</div>
                          <div style={{ fontSize:12, color:"var(--text2)" }}>{emp.role||"Staff"}</div>
                        </div>
                        {clocked && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:"rgba(16,185,129,0.12)", color:"#10b981", border:"1px solid rgba(16,185,129,0.25)" }}>● Clocked In</span>}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                        {[["Rate", `$${(emp.hourly_rate||0).toFixed(2)}/hr`],["Tax", `${emp.tax_rate||0}%`],["This Week", `${wkHrs.toFixed(1)}h`]].map(([l,v])=>(
                          <div key={l} style={{ background:"var(--bg3)", borderRadius:8, padding:"8px 10px" }}>
                            <div style={{ fontSize:10, color:"var(--text3)", marginBottom:3 }}>{l}</div>
                            <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {emp.email && <div style={{ fontSize:12, color:"var(--text2)", marginBottom:12, overflow:"hidden", textOverflow:"ellipsis" }}>✉ {emp.email}</div>}
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={()=>copyPortalLink(emp)} style={{ flex:1, background:"none", border:"1.5px solid var(--border)", color:"var(--text2)", borderRadius:8, padding:"7px 0", fontSize:12, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>🔗 Portal Link</button>
                        <button onClick={()=>setTimesheetEmp(emp)} style={{ flex:1, background:"none", border:"1.5px solid var(--border)", color:"var(--text2)", borderRadius:8, padding:"7px 0", fontSize:12, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>📋 Timesheet</button>
                        <button onClick={()=>setEmpModal({...emp})} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--text2)", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>✎</button>
                        <button onClick={()=>deleteEmployee(emp.id)} style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:16 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* ── TIMESHEETS TAB ── */}
      {tab==="timesheets" && (
        <div>
          {/* Controls */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
            <button onClick={()=>setTsWeekFilter(addDays(tsWeekFilter,-7))} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>←</button>
            <div style={{ fontSize:14, fontWeight:600 }}>{fmt(tsWeekStart)} – {fmt(addDays(tsWeekStart,6))}</div>
            <button onClick={()=>setTsWeekFilter(addDays(tsWeekFilter,7))} style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>→</button>
            <select value={tsEmpFilter} onChange={e=>setTsEmpFilter(e.target.value)}
              style={{ background:"var(--bg3)", border:"1.5px solid var(--border)", borderRadius:9, padding:"7px 12px", color:"var(--text)", fontSize:12, outline:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              <option value="all">All Employees</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* ── Exceptions panel ── */}
          {(() => {
            const pending = entries.filter(e => e.is_exception && e.approved === null && (tsEmpFilter==="all" || e.employee_id===tsEmpFilter));
            if (pending.length === 0) return null;
            return (
              <div style={{ background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:14, marginBottom:20, overflow:"hidden" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(245,158,11,0.1)", display:"flex", gap:10, alignItems:"center" }}>
                  <span style={{ fontSize:16 }}>⚠️</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f59e0b" }}>Unscheduled Clock-ins — Pending Approval ({pending.length})</div>
                    <div style={{ fontSize:12, color:"#8a7060" }}>These exceptions are excluded from timesheets until approved. Approving also adds a shift to the schedule.</div>
                  </div>
                </div>
                {pending.map((e, i) => {
                  const emp = employees.find(em => em.id === e.employee_id);
                  const hrs = hoursWorked(e);
                  return (
                    <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 20px", borderBottom: i < pending.length-1 ? "1px solid rgba(245,158,11,0.08)" : "none" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{emp?.name}</div>
                        <div style={{ fontSize:12, color:"#8a7060" }}>
                          {fmt(e.clock_in)} · {fmtTime(e.clock_in)} → {e.clock_out ? fmtTime(e.clock_out) : "still clocked in"}
                          {hrs > 0 && <span style={{ color:"var(--accent)" }}> · {hrs.toFixed(2)}h</span>}
                          {e.notes && <span style={{ color:"var(--text2)" }}> · "{e.notes}"</span>}
                        </div>
                      </div>
                      <button onClick={() => handleApproveException(e.id, false)}
                        style={{ background:"none", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                        ✗ Reject
                      </button>
                      <button onClick={() => handleApproveException(e.id, true)}
                        style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.3)", color:"#10b981", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                        ✓ Approve
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Summary table */}
          <div className="card" style={{ overflow:"hidden", marginBottom:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 90px 80px 80px 90px 36px", gap:0, padding:"10px 20px", borderBottom:"1px solid var(--border)", fontSize:11, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
              <div>Employee</div><div style={{ textAlign:"right" }}>Hours</div><div style={{ textAlign:"right" }}>Gross</div><div style={{ textAlign:"right" }}>Tax</div><div style={{ textAlign:"right" }}>Deductions</div><div style={{ textAlign:"right" }}>Net Pay</div><div/>
            </div>
            {(tsEmpFilter==="all"?employees:employees.filter(e=>e.id===tsEmpFilter)).map((emp,i)=>{
              const empEntries = tsEntries.filter(e=>e.employee_id===emp.id);
              const { totalHours, gross, taxAmt, net } = calcPay(empEntries, emp);
              const col = COLOR_PALETTE[employees.indexOf(emp) % COLOR_PALETTE.length];
              return (
                <div key={emp.id} style={{ display:"grid", gridTemplateColumns:"1fr 80px 90px 80px 80px 90px 36px", gap:0, padding:"13px 20px", borderBottom:i<employees.length-1?"1px solid var(--border)":"none", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:`${col}18`, border:`1px solid ${col}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:col, fontWeight:700 }}>{emp.name[0]}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{emp.name}</div>
                      <div style={{ fontSize:11, color:"var(--text2)" }}>{emp.role||"Staff"}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:13, color: totalHours>0?"#818cf8":"var(--text3)" }}>{totalHours.toFixed(2)}h</div>
                  <div style={{ textAlign:"right", fontSize:13, color: gross>0?"var(--accent)":"var(--text3)" }}>${gross.toFixed(2)}</div>
                  <div style={{ textAlign:"right", fontSize:13, color:"#ef4444" }}>${taxAmt.toFixed(2)}</div>
                  <div style={{ textAlign:"right", fontSize:13, color:"#ef4444" }}>${(emp.deductions||0).toFixed(2)}</div>
                  <div style={{ textAlign:"right", fontSize:14, fontWeight:700, color:"#10b981" }}>${net.toFixed(2)}</div>
                  <button onClick={()=>setTimesheetEmp(emp)} style={{ background:"none", border:"1.5px solid var(--border)", borderRadius:6, padding:"4px 8px", color:"var(--text2)", cursor:"pointer", fontSize:11, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>→</button>
                </div>
              );
            })}
            {/* Totals row */}
            {(() => {
              const all = tsEmpFilter==="all"?employees:employees.filter(e=>e.id===tsEmpFilter);
              const totH = all.reduce((s,emp)=>s+calcPay(tsEntries.filter(e=>e.employee_id===emp.id),emp).totalHours,0);
              const totG = all.reduce((s,emp)=>s+calcPay(tsEntries.filter(e=>e.employee_id===emp.id),emp).gross,0);
              const totT = all.reduce((s,emp)=>s+calcPay(tsEntries.filter(e=>e.employee_id===emp.id),emp).taxAmt,0);
              const totD = all.reduce((s,emp)=>s+(emp.deductions||0),0);
              const totN = all.reduce((s,emp)=>s+calcPay(tsEntries.filter(e=>e.employee_id===emp.id),emp).net,0);
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 90px 80px 80px 90px 36px", gap:0, padding:"12px 20px", background:"#0d0d1a", fontSize:12, fontWeight:700 }}>
                  <div style={{ color:"var(--text2)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em" }}>Totals</div>
                  <div style={{ textAlign:"right", color:"#818cf8" }}>{totH.toFixed(2)}h</div>
                  <div style={{ textAlign:"right", color:"var(--accent)" }}>${totG.toFixed(2)}</div>
                  <div style={{ textAlign:"right", color:"#ef4444" }}>${totT.toFixed(2)}</div>
                  <div style={{ textAlign:"right", color:"#ef4444" }}>${totD.toFixed(2)}</div>
                  <div style={{ textAlign:"right", color:"#10b981" }}>${totN.toFixed(2)}</div>
                  <div/>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {empModal !== null && <EmployeeModal emp={empModal.id?empModal:null} onSave={saveEmployee} onClose={()=>setEmpModal(null)} />}
      {shiftModal !== null && <ShiftModal shift={shiftModal.id?shiftModal:null} employees={employees} onSave={saveShift} onClose={()=>setShiftModal(null)} />}
      {timesheetEmp && <EmployeeTimesheet emp={timesheetEmp} entries={entries.filter(e=>e.employee_id===timesheetEmp.id)} onClose={()=>setTimesheetEmp(null)} />}
    </div>
  );
}
