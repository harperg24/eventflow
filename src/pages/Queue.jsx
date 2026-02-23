// ============================================================
//  src/pages/Queue.jsx
//  Public queue page — /queue/:queueId
//  Guests join a queue and see their live position
// ============================================================
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadThemePrefs, getTheme, globalCSS, applyThemeToDOM } from "./theme";

// ── Shared style helpers ──────────────────────────────────────
const cardStyle = (extra={}) => ({
  background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:20,
  padding:"28px 24px", width:"100%", maxWidth:420, boxSizing:"border-box", ...extra
});

function Logo() {
  return (
    <div style={{ textAlign:"center", marginBottom:32, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
      <div style={{ width:28, height:28, background:"var(--accent)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#fff", fontWeight:700 }}>✦</div>
      <span style={{ fontSize:14, fontWeight:600, color:"var(--text2)", letterSpacing:"0.04em" }}>EventFlow</span>
    </div>
  );
}

// ── Position indicator ring ───────────────────────────────────
function PositionRing({ position, total }) {
  const pct = total > 1 ? Math.max(0, 1 - (position - 1) / (total - 1)) : 1;
  const size = 120;
  const r = 44, cx = size/2, cy = size/2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = position <= 3 ? "var(--success,#059669)" : position <= 10 ? "var(--accent)" : "#818cf8";
  return (
    <svg width={size} height={size} style={{ display:"block", margin:"0 auto 8px" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg3)" strokeWidth={8}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition:"stroke-dasharray 0.8s ease, stroke 0.4s" }}/>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize={28} fontWeight={800} fontFamily="inherit">{position}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text3)" fontSize={11} fontFamily="inherit">in queue</text>
    </svg>
  );
}

// ── Pulsing dot for "you're next!" ────────────────────────────
function PulsingDot({ color }) {
  return (
    <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:color,
      boxShadow:`0 0 0 3px ${color}40`, animation:"pulse 1.5s ease-in-out infinite", marginRight:6 }}/>
  );
}


// ── Device fingerprint ─────────────────────────────────────────
// Stable per-browser identifier stored in localStorage
function getDeviceFingerprint() {
  const key = "__ef_dfp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    // Generate a random stable ID for this browser
    fp = "dfp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, fp);
  }
  return fp;
}

export default function Queue() {
  const { queueId } = useParams();
  const [queue,    setQueue]    = useState(null);
  const [entries,  setEntries]  = useState([]);
  const [myEntry,  setMyEntry]  = useState(null); // loaded from localStorage
  const [step,     setStep]     = useState("loading"); // loading|join|waiting|called|done|closed|invalid
  const [form,     setForm]     = useState({ name:"", email:"", party_size:1 });
  const [joining,  setJoining]  = useState(false);
  const [error,    setError]    = useState(null);
  const subRef = useRef(null);

  // ── Load queue + restore session ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      const p = loadThemePrefs(); applyThemeToDOM(p);

      const { data: q } = await supabase.from("queues").select("*").eq("id", queueId).single();
      if (!q) { setStep("invalid"); return; }
      setQueue(q);

      const { data: ents } = await supabase.from("queue_entries")
        .select("*").eq("queue_id", queueId)
        .in("status", ["waiting","called"])
        .order("position");
      setEntries(ents || []);

      // Restore from localStorage
      const saved = localStorage.getItem(`queue_entry_${queueId}`);
      if (saved) {
        const token = JSON.parse(saved).token;
        const { data: me } = await supabase.from("queue_entries")
          .select("*").eq("guest_token", token).single();
        if (me && (me.status === "waiting" || me.status === "called")) {
          setMyEntry(me);
          setStep(me.status === "called" ? "called" : "waiting");
          return;
        }
      }

      if (q.status === "closed") { setStep("closed"); return; }
      setStep(q.status === "paused" ? "paused" : "join");
    };
    init();
  }, [queueId]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!queueId) return;
    const ch = supabase.channel(`queue_${queueId}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"queue_entries", filter:`queue_id=eq.${queueId}` },
        (payload) => {
          const row = payload.new || payload.old;
          if (payload.eventType === "INSERT") {
            setEntries(es => [...es.filter(e=>e.id!==row.id), ...(["waiting","called"].includes(row.status)?[row]:[])].sort((a,b)=>a.position-b.position));
          } else if (payload.eventType === "UPDATE") {
            setEntries(es => (["waiting","called"].includes(row.status)
              ? es.map(e=>e.id===row.id?row:e)
              : es.filter(e=>e.id!==row.id)
            ).sort((a,b)=>a.position-b.position));
            // If this is our entry
            if (myEntry && row.id === myEntry.id) {
              setMyEntry(row);
              if (row.status === "called") setStep("called");
              else if (row.status === "done" || row.status === "left") setStep("done");
            }
          }
        }
      )
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"queues", filter:`id=eq.${queueId}` },
        (payload) => {
          setQueue(payload.new);
          if (payload.new.status === "closed" && !myEntry) setStep("closed");
          if (payload.new.status === "paused" && step === "join") setStep("paused");
          if (payload.new.status === "open" && step === "paused") setStep("join");
        }
      )
      .subscribe();
    subRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [queueId, myEntry?.id, step]);

  // ── Join queue ─────────────────────────────────────────────
  const handleJoin = async () => {
    if (!form.name.trim()) { setError("Please enter your name"); return; }
    setJoining(true); setError(null);

    const fp = getDeviceFingerprint();
    const maxJoins = queue?.max_joins_per_device || 1;

    // Check how many times this device has already joined (any status)
    if (maxJoins < 99) {
      const { data: existing } = await supabase
        .from("queue_entries")
        .select("id, status")
        .eq("queue_id", queueId)
        .eq("device_fingerprint", fp);

      const activeJoins = (existing || []).filter(e => ["waiting","called"].includes(e.status));
      const totalJoins  = (existing || []).length;

      if (activeJoins.length > 0) {
        setError("You are already in this queue.");
        setJoining(false); return;
      }
      if (totalJoins >= maxJoins) {
        setError(
          maxJoins === 1
            ? "You have already been served — this queue allows 1 visit per device."
            : `This queue only allows ${maxJoins} visits per device and you have used all of them.`
        );
        setJoining(false); return;
      }
    }

    const { data, error: err } = await supabase.from("queue_entries").insert({
      queue_id:           queueId,
      event_id:           queue.event_id,
      guest_name:         form.name.trim(),
      guest_email:        form.email.trim() || null,
      party_size:         parseInt(form.party_size) || 1,
      device_fingerprint: fp,
    }).select().single();

    if (err) { setError(err.message); setJoining(false); return; }

    localStorage.setItem(`queue_entry_${queueId}`, JSON.stringify({ token: data.guest_token }));
    setMyEntry(data);
    setEntries(es => [...es, data].sort((a,b)=>a.position-b.position));
    setStep("waiting");
    setJoining(false);
  };

  const handleLeave = async () => {
    if (!myEntry) return;
    if (!window.confirm("Leave the queue? You'll lose your spot.")) return;
    await supabase.from("queue_entries").update({ status:"left" }).eq("id", myEntry.id);
    localStorage.removeItem(`queue_entry_${queueId}`);
    setMyEntry(null);
    setStep("join");
  };

  // ── My position ────────────────────────────────────────────
  const waitingEntries = entries.filter(e => e.status === "waiting");
  const myPosition     = myEntry ? waitingEntries.findIndex(e => e.id === myEntry.id) + 1 : null;
  const ahead          = myPosition ? myPosition - 1 : 0;
  const totalWaiting   = waitingEntries.length;

  // ── Estimated wait (2 min per person ahead) ────────────────
  const estWaitMins = Math.max(0, ahead * 2);
  const estWait     = estWaitMins < 2 ? "Almost your turn!" :
                      estWaitMins < 60 ? `~${estWaitMins} min wait` :
                      `~${Math.round(estWaitMins/60)}h wait`;

  // ── Render ──────────────────────────────────────────────────
  const p = loadThemePrefs();
  const t = getTheme(p);

  const btn = (label, onClick, variant="primary", disabled=false) => (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%", background: variant==="primary"?"var(--accent)":variant==="danger"?"var(--danger,#dc2626)":"none",
      border: variant==="ghost"?"1.5px solid var(--border)":"none",
      color: variant==="ghost"?"var(--text2)":"#fff",
      borderRadius:12, padding:"13px", fontSize:15, fontWeight:700, cursor:"pointer",
      fontFamily:"inherit", transition:"opacity 0.15s", opacity:disabled?0.6:1,
    }}>{label}</button>
  );

  const input = (props) => (
    <input {...props} style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)",
      border:"1.5px solid var(--border)", borderRadius:9, padding:"11px 14px",
      color:"var(--text)", fontSize:14, outline:"none", fontFamily:"inherit",
      transition:"border-color 0.15s", ...props.style }}/>
  );

  if (step === "loading") return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <style>{globalCSS(t)}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ color:"var(--text3)", fontSize:14 }}>Loading queue…</div>
    </div>
  );

  if (step === "invalid") return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Plus Jakarta Sans',sans-serif", padding:24 }}>
      <style>{globalCSS(t)}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
        <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", marginBottom:8 }}>Queue Not Found</h1>
        <p style={{ color:"var(--text2)", fontSize:14 }}>This queue link is invalid or has been removed.</p>
      </div>
    </div>
  );

  const pageWrap = (children) => (
    <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"'Plus Jakarta Sans',sans-serif", color:"var(--text)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <style>{globalCSS(t)}</style>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} } @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      {children}
    </div>
  );

  // ── Closed ──────────────────────────────────────────────────
  if (step === "closed") return pageWrap(
    <div style={cardStyle({ textAlign:"center" })}>
      <Logo/>
      <div style={{ fontSize:44, marginBottom:16 }}>🔒</div>
      <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", marginBottom:8 }}>{queue?.name}</h1>
      <p style={{ color:"var(--text2)", fontSize:14 }}>This queue is currently closed.</p>
    </div>
  );

  // ── Paused ──────────────────────────────────────────────────
  if (step === "paused") return pageWrap(
    <div style={cardStyle({ textAlign:"center" })}>
      <Logo/>
      <div style={{ fontSize:44, marginBottom:16, animation:"bounce 2s infinite" }}>⏸</div>
      <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", marginBottom:8 }}>{queue?.name}</h1>
      <p style={{ color:"var(--text2)", fontSize:14 }}>Queue is temporarily paused. Check back shortly!</p>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────
  if (step === "done") return pageWrap(
    <div style={cardStyle({ textAlign:"center" })}>
      <Logo/>
      <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
      <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em", marginBottom:8 }}>All done!</h1>
      <p style={{ color:"var(--text2)", fontSize:15 }}>Enjoy the rest of your evening!</p>
      {queue?.name && <p style={{ color:"var(--text3)", fontSize:13, marginTop:4 }}>{queue.name}</p>}
    </div>
  );

  // ── Called ──────────────────────────────────────────────────
  if (step === "called") return pageWrap(
    <div style={cardStyle({ textAlign:"center", border:"2px solid var(--success,#059669)" })}>
      <Logo/>
      <div style={{ fontSize:56, marginBottom:16, animation:"bounce 1s infinite" }}>🎉</div>
      <div style={{ fontSize:12, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", color:"var(--success,#059669)", marginBottom:6 }}>
        <PulsingDot color="var(--success,#059669)"/>It's your turn!
      </div>
      <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:"-0.04em", marginBottom:8 }}>
        {myEntry?.guest_name ? `${myEntry.guest_name.split(" ")[0]}, come on up!` : "Come on up!"}
      </h1>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:24 }}>
        Head to the {queue?.name} now — you've been called!
        {myEntry?.party_size > 1 && <span style={{ display:"block", marginTop:4, color:"var(--accent)", fontWeight:600 }}>Party of {myEntry.party_size}</span>}
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {btn("✓ Mark as Received", async () => {
          await supabase.from("queue_entries").update({ status:"done", done_at:new Date().toISOString() }).eq("id", myEntry.id);
          localStorage.removeItem(`queue_entry_${queueId}`);
          setStep("done");
        }, "primary")}
      </div>
    </div>
  );

  // ── Waiting ─────────────────────────────────────────────────
  if (step === "waiting") return pageWrap(
    <div style={{ width:"100%", maxWidth:420 }}>
      <Logo/>

      {/* Position card */}
      <div style={{ ...cardStyle(), textAlign:"center", marginBottom:14,
        ...(myPosition === 1 ? { border:"2px solid var(--accent)", boxShadow:"0 0 0 4px var(--accentBg)" } : {}) }}>
        {myPosition === 1 ? (
          <>
            <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", color:"var(--accent)", marginBottom:8 }}>
              <PulsingDot color="var(--accent)"/>You're next!
            </div>
            <div style={{ fontSize:48, marginBottom:8, animation:"bounce 1.2s infinite" }}>🎯</div>
            <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", marginBottom:4 }}>You're first in line!</h2>
            <p style={{ color:"var(--text2)", fontSize:13 }}>Get ready — the staff will call you any moment.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--text3)", marginBottom:16 }}>Your position</div>
            <PositionRing position={myPosition || 1} total={totalWaiting}/>
            <div style={{ fontSize:14, fontWeight:600, color:"var(--text2)", marginBottom:4 }}>{estWait}</div>
            <div style={{ fontSize:12, color:"var(--text3)" }}>
              {ahead === 0 ? "You're next!" : `${ahead} ${ahead===1?"person":"people"} ahead of you`}
              {myEntry?.party_size > 1 && <span style={{ color:"var(--accent)", fontWeight:600 }}> · Party of {myEntry.party_size}</span>}
            </div>
          </>
        )}
      </div>

      {/* Queue info */}
      <div style={{ ...cardStyle({ padding:"18px 20px" }), marginBottom:14 }}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{queue?.name}</div>
        {queue?.description && <div style={{ fontSize:13, color:"var(--text2)", marginBottom:10 }}>{queue.description}</div>}
        <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--text3)" }}>
          <span>👥 {totalWaiting} waiting</span>
          <span>🎟 1 per person</span>
        </div>
      </div>

      {/* Live queue preview (first 5) */}
      {totalWaiting > 1 && (
        <div style={{ ...cardStyle({ padding:"16px 20px" }), marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text3)", marginBottom:12 }}>Queue</div>
          {waitingEntries.slice(0, 5).map((e, i) => {
            const isMe = myEntry && e.id === myEntry.id;
            return (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0",
                borderBottom:i < Math.min(waitingEntries.length, 5)-1?"1px solid var(--border)":"none" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:isMe?"var(--accentBg)":"var(--bg3)",
                  border:`1.5px solid ${isMe?"var(--accent)":"var(--border)"}`, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:12, fontWeight:700, color:isMe?"var(--accent)":"var(--text3)", flexShrink:0 }}>
                  {i + 1}
                </div>
                <div style={{ flex:1, fontSize:13, fontWeight:isMe?700:400, color:isMe?"var(--text)":"var(--text2)" }}>
                  {isMe ? `${e.guest_name} (you)` : e.guest_name}
                  {e.party_size > 1 && <span style={{ fontSize:11, color:"var(--text3)", marginLeft:6 }}>×{e.party_size}</span>}
                </div>
              </div>
            );
          })}
          {totalWaiting > 5 && (
            <div style={{ fontSize:12, color:"var(--text3)", textAlign:"center", paddingTop:10 }}>
              +{totalWaiting - 5} more in queue
            </div>
          )}
        </div>
      )}

      {/* Leave button */}
      <button onClick={handleLeave} style={{ width:"100%", background:"none", border:"1.5px solid var(--border)",
        borderRadius:12, padding:"11px", fontSize:13, color:"var(--text3)", cursor:"pointer", fontFamily:"inherit" }}>
        Leave Queue
      </button>
    </div>
  );

  // ── Join form ────────────────────────────────────────────────
  return pageWrap(
    <div style={{ width:"100%", maxWidth:420 }}>
      <Logo/>
      <div style={cardStyle()}>
        {/* Header */}
        <div style={{ marginBottom:24, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🎟</div>
          <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", marginBottom:6 }}>{queue?.name}</h1>
          {queue?.description && <p style={{ color:"var(--text2)", fontSize:14, lineHeight:1.5, margin:0 }}>{queue.description}</p>}
          {totalWaiting > 0 && (
            <div style={{ marginTop:12, display:"inline-flex", alignItems:"center", gap:6, background:"var(--bg3)",
              border:"1.5px solid var(--border)", borderRadius:20, padding:"5px 14px", fontSize:12, color:"var(--text2)" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"var(--success,#059669)", display:"inline-block" }}/>
              {totalWaiting} {totalWaiting===1?"person":"people"} in queue · ~{Math.max(2, totalWaiting * 2)} min wait
            </div>
          )}
          {totalWaiting === 0 && queue?.status === "open" && (
            <div style={{ marginTop:12, display:"inline-flex", alignItems:"center", gap:6, background:"rgba(5,150,105,0.08)",
              border:"1.5px solid rgba(5,150,105,0.2)", borderRadius:20, padding:"5px 14px", fontSize:12, color:"var(--success,#059669)", fontWeight:600 }}>
              <PulsingDot color="var(--success,#059669)"/>No wait — join now!
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:7 }}>Your Name *</label>
            {input({ placeholder:"e.g. Alex Smith", value:form.name, onChange:e=>setForm(f=>({...f,name:e.target.value})),
              onKeyDown:e=>e.key==="Enter"&&handleJoin() })}
          </div>
          <div>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:7 }}>Email (optional — for notifications)</label>
            {input({ type:"email", placeholder:"your@email.com", value:form.email, onChange:e=>setForm(f=>({...f,email:e.target.value})) })}
          </div>
          {queue?.max_per_person > 1 && (
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text2)", marginBottom:7 }}>Party Size</label>
              <select value={form.party_size} onChange={e=>setForm(f=>({...f,party_size:parseInt(e.target.value)}))}
                style={{ width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)",
                  borderRadius:9, padding:"11px 14px", color:"var(--text)", fontSize:14, outline:"none", fontFamily:"inherit" }}>
                {Array.from({length:queue.max_per_person},(_,i)=>i+1).map(n=>(
                  <option key={n} value={n}>{n} {n===1?"person":"people"}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div style={{ background:"rgba(220,38,38,0.08)", border:"1.5px solid rgba(220,38,38,0.2)", borderRadius:9,
              padding:"10px 14px", fontSize:13, color:"var(--danger,#dc2626)" }}>
              {error}
            </div>
          )}

          <button onClick={handleJoin} disabled={joining} style={{ background:"var(--accent)", border:"none", color:"#fff",
            borderRadius:12, padding:"14px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            transition:"opacity 0.15s", opacity:joining?0.6:1, marginTop:4 }}>
            {joining ? "Joining…" : "Join Queue →"}
          </button>

          <p style={{ fontSize:11, color:"var(--text3)", textAlign:"center", margin:0, lineHeight:1.5 }}>
            Keep this page open to see your position update in real time.
          </p>
        </div>
      </div>
    </div>
  );
}
