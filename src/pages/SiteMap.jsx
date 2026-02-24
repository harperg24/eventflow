// ============================================================
//  SiteMap.jsx — Event Site Map Creator
//  Rotation · SVG cursor icons · Text formatting · Shortcuts
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

const ZONE_COLORS = {
  stage:     { fill:"rgba(139,92,246,0.18)",  stroke:"#8b5cf6", label:"Stage" },
  fob:       { fill:"rgba(249,115,22,0.15)",  stroke:"#f97316", label:"F&B / Bar" },
  parking:   { fill:"rgba(107,114,128,0.15)", stroke:"#6b7280", label:"Parking" },
  firstaid:  { fill:"rgba(239,68,68,0.15)",   stroke:"#ef4444", label:"First Aid" },
  toilets:   { fill:"rgba(59,130,246,0.15)",  stroke:"#3b82f6", label:"Toilets" },
  entry:     { fill:"rgba(16,185,129,0.18)",  stroke:"#10b981", label:"Entry / Exit" },
  emergency: { fill:"rgba(220,38,38,0.2)",    stroke:"#dc2626", label:"Emergency" },
  staff:     { fill:"rgba(245,158,11,0.15)",  stroke:"#f59e0b", label:"Staff Only" },
  camping:   { fill:"rgba(5,150,105,0.12)",   stroke:"#059669", label:"Camping" },
  general:   { fill:"rgba(91,91,214,0.08)",   stroke:"#5b5bd6", label:"General Area" },
  custom:    { fill:"rgba(156,163,175,0.15)", stroke:"#9ca3af", label:"Custom" },
};

const POI_TYPES = [
  { id:"stage",      emoji:"🎤", label:"Stage" },
  { id:"mainstage",  emoji:"🎪", label:"Main Stage" },
  { id:"food",       emoji:"🍔", label:"Food" },
  { id:"bar",        emoji:"🍺", label:"Bar" },
  { id:"toilet",     emoji:"🚻", label:"Toilets" },
  { id:"firstaid",   emoji:"🏥", label:"First Aid" },
  { id:"parking",    emoji:"🅿️", label:"Parking" },
  { id:"exit",       emoji:"🚨", label:"Emergency Exit" },
  { id:"security",   emoji:"👮", label:"Security" },
  { id:"accessible", emoji:"♿", label:"Accessible" },
  { id:"bins",       emoji:"🗑️", label:"Bins" },
  { id:"water",      emoji:"💧", label:"Water" },
  { id:"tickets",    emoji:"🎟️", label:"Tickets" },
  { id:"info",       emoji:"ℹ️",  label:"Info" },
  { id:"camera",     emoji:"📷", label:"Camera / Media" },
  { id:"wifi",       emoji:"📶", label:"WiFi Zone" },
  { id:"generator",  emoji:"⚡", label:"Generator" },
  { id:"tent",       emoji:"⛺", label:"Tent" },
  { id:"bus",        emoji:"🚌", label:"Bus / Shuttle" },
  { id:"vip",        emoji:"⭐", label:"VIP Area" },
];

const FONT_FAMILIES = [
  "Plus Jakarta Sans","Arial","Georgia","Courier New",
  "Times New Roman","Impact","Trebuchet MS","Verdana",
];

const S = {
  btn:   { background:"var(--accent)", border:"none", color:"#fff", borderRadius:8,
           padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  ghost: { background:"none", border:"1.5px solid var(--border)", color:"var(--text2)",
           borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600,
           cursor:"pointer", fontFamily:"inherit" },
  inp:   { width:"100%", boxSizing:"border-box", background:"var(--bg3)",
           border:"1.5px solid var(--border)", borderRadius:8, padding:"8px 11px",
           color:"var(--text)", fontSize:13, outline:"none", fontFamily:"inherit" },
  lbl:   { fontSize:10, color:"var(--text3)", fontWeight:700, textTransform:"uppercase",
           letterSpacing:"0.06em", display:"block", marginBottom:5 },
};

const newId   = () => Math.random().toString(36).slice(2, 10);
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const d2r     = (d) => (d * Math.PI) / 180;
const r2d     = (r) => (r * 180) / Math.PI;

// ── SVG tool icons ────────────────────────────────────────────
function IconSelect({ active }) {
  const c = active ? "#fff" : "currentColor";
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M4 2 L4 15 L8 11 L11 18 L13 17 L10 10 L15 10 Z"
        fill={c} stroke={c} strokeWidth="0.5" strokeLinejoin="round"/>
    </svg>
  );
}
const IconRect     = () => <svg width="17" height="13" viewBox="0 0 17 13"><rect x="1" y="1" width="15" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;
const IconCircle   = () => <svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="7" ry="7" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;
const IconTriangle = () => <svg width="17" height="15" viewBox="0 0 17 15"><path d="M8.5 1L16 14H1L8.5 1Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
const IconArrow    = () => <svg width="18" height="12" viewBox="0 0 18 12"><path d="M0 6h12M9 2l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconText     = () => <svg width="16" height="16" viewBox="0 0 16 16"><text x="1" y="14" fontSize="15" fontWeight="bold" fill="currentColor" fontFamily="Georgia,serif">T</text></svg>;
const IconPoi      = () => <span style={{fontSize:14,lineHeight:1}}>📍</span>;
const IconRotate   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg>;

const TOOL_ICON = { select: IconSelect, rect: IconRect, circle: IconCircle,
  triangle: IconTriangle, arrow: IconArrow, text: IconText, poi: IconPoi };

const SHORTCUTS = [
  { key:"V",           desc:"Select / move tool" },
  { key:"R",           desc:"Draw rectangle" },
  { key:"C",           desc:"Draw circle / ellipse" },
  { key:"G",           desc:"Draw triangle" },
  { key:"A",           desc:"Draw arrow" },
  { key:"T",           desc:"Place text" },
  { key:"P",           desc:"Place POI icon" },
  { key:"[ / ]",       desc:"Rotate selected −15° / +15°" },
  { key:"Del / ⌫",    desc:"Delete selected element" },
  { key:"Escape",      desc:"Deselect · back to select tool" },
  { key:"⌘/Ctrl + D", desc:"Duplicate selected" },
  { key:"⌘/Ctrl + S", desc:"Save map" },
  { key:"Scroll",      desc:"Zoom in / out" },
  { key:"Alt + drag",  desc:"Pan the canvas" },
  { key:"Middle btn",  desc:"Pan the canvas" },
  { key:"? or /",      desc:"Toggle this shortcuts panel" },
];

// ═════════════════════════════════════════════════════════════
//  Gallery
// ═════════════════════════════════════════════════════════════
export default function SiteMap({ eventId }) {
  const [maps,        setMaps]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showEditor,  setShowEditor]  = useState(false);
  const [activeMapId, setActiveMapId] = useState(null);
  const [newMapOpen,  setNewMapOpen]  = useState(false);

  useEffect(() => {
    supabase.from("site_maps").select("*").eq("event_id", eventId).order("created_at")
      .then(({ data }) => { setMaps(data || []); setLoading(false); });
  }, [eventId]);

  const createMap = async (name, w, h) => {
    const { data, error } = await supabase.from("site_maps")
      .insert({ event_id:eventId, name, elements:[], canvas_bg:"#f8f8f0", width:w, height:h })
      .select().single();
    if (error) { alert("Failed: " + error.message); return; }
    setMaps(m => [...m, data]);
    setActiveMapId(data.id);
    setShowEditor(true);
    setNewMapOpen(false);
  };

  const saveMap = async (id, elements, meta) => {
    const { error } = await supabase.from("site_maps").update({ elements, ...meta }).eq("id", id);
    if (error) { alert("Save failed: " + error.message); return; }
    setMaps(m => m.map(x => x.id === id ? { ...x, elements, ...meta } : x));
  };

  const deleteMap = async (id) => {
    if (!window.confirm("Delete this site map?")) return;
    await supabase.from("site_maps").delete().eq("id", id);
    setMaps(m => m.filter(x => x.id !== id));
    if (activeMapId === id) { setActiveMapId(null); setShowEditor(false); }
  };

  const activeMap = maps.find(m => m.id === activeMapId);
  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>Loading…</div>;

  if (showEditor && activeMap)
    return <CanvasEditor map={activeMap}
      onSave={(el, meta) => saveMap(activeMap.id, el, meta)}
      onBack={() => setShowEditor(false)} />;

  return (
    <div className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.04em", marginBottom:4 }}>Site Maps</h1>
          <p style={{ color:"var(--text2)", fontSize:14, margin:0 }}>Design and manage your event layout</p>
        </div>
        <button onClick={() => setNewMapOpen(true)} style={S.btn}>+ New Map</button>
      </div>

      {maps.length === 0 && (
        <div style={{ textAlign:"center", padding:"72px 20px", background:"var(--bg2)",
          border:"1.5px solid var(--border)", borderRadius:16 }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🗺️</div>
          <h3 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>No site maps yet</h3>
          <p style={{ color:"var(--text2)", fontSize:14, maxWidth:380, margin:"0 auto 24px", lineHeight:1.6 }}>
            Draw zones, drop POI markers, add text labels — build a complete visual layout of your event.
          </p>
          <button onClick={() => setNewMapOpen(true)} style={S.btn}>+ Create First Map</button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {maps.map(m => (
          <div key={m.id} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)",
            borderRadius:14, overflow:"hidden", transition:"border-color 0.15s", cursor:"pointer" }}
            onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
            <div onClick={() => { setActiveMapId(m.id); setShowEditor(true); }}
              style={{ height:140, background:m.canvas_bg||"#f8f8f0" }}>
              <MapThumbnail map={m} />
            </div>
            <div style={{ padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{m.name}</div>
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>
                  {(m.elements||[]).length} element{(m.elements||[]).length!==1?"s":""} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("en-NZ")}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => { setActiveMapId(m.id); setShowEditor(true); }}
                  style={{ ...S.ghost, fontSize:12, padding:"5px 10px",
                    color:"var(--accent)", borderColor:"var(--accentBg)" }}>Open</button>
                <button onClick={() => deleteMap(m.id)}
                  style={{ ...S.ghost, fontSize:12, padding:"5px 8px",
                    color:"#dc2626", borderColor:"rgba(220,38,38,0.2)" }}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {newMapOpen && <NewMapModal onCreate={createMap} onClose={() => setNewMapOpen(false)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Thumbnail
// ═════════════════════════════════════════════════════════════
function MapThumbnail({ map }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const W = c.width, H = c.height;
    const mw = map.width||1200, mh = map.height||800;
    const scale = Math.min(W/mw, H/mh);
    const ox = (W - mw*scale)/2, oy = (H - mh*scale)/2;
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = map.canvas_bg||"#f8f8f0"; ctx.fillRect(0,0,W,H);
    (map.elements||[]).forEach(el => drawElement(ctx, el, scale, ox, oy, false, 1));
  }, [map]);
  return <canvas ref={ref} width={280} height={140}
    style={{ display:"block", width:"100%", height:"100%" }} />;
}

// ═════════════════════════════════════════════════════════════
//  New map modal — presets + fully custom W×H
// ═════════════════════════════════════════════════════════════
function NewMapModal({ onCreate, onClose }) {
  const [name,   setName]   = useState("");
  const [preset, setPreset] = useState("medium");
  const [cw,     setCw]     = useState("1200");
  const [ch,     setCh]     = useState("800");

  const PRESETS = {
    small:  [800,  600,  "Small",  "800 × 600"],
    medium: [1200, 800,  "Medium", "1200 × 800"],
    large:  [1800, 1200, "Large",  "1800 × 1200"],
    xl:     [2400, 1600, "XL",     "2400 × 1600"],
    custom: [null, null, "Custom", "Set your own"],
  };

  const go = () => {
    if (!name.trim()) return;
    const [pw, ph] = PRESETS[preset];
    const w = preset==="custom" ? Math.max(200, parseInt(cw)||1200) : pw;
    const h = preset==="custom" ? Math.max(200, parseInt(ch)||800)  : ph;
    onCreate(name.trim(), w, h);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center" }}
      onMouseDown={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:16,
        padding:28, width:440, boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>New Site Map</h3>

        <div style={{ marginBottom:16 }}>
          <label style={S.lbl}>Map Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={S.inp} autoFocus
            placeholder="e.g. Main Venue Layout"
            onKeyDown={e => e.key==="Enter" && go()} />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={S.lbl}>Canvas Size</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {Object.entries(PRESETS).map(([key,[,,label,desc]]) => (
              <button key={key} onClick={() => setPreset(key)}
                style={{ background:preset===key?"var(--accentBg)":"var(--bg3)",
                  border:`1.5px solid ${preset===key?"var(--accent)":"var(--border)"}`,
                  borderRadius:9, padding:"10px 12px", cursor:"pointer",
                  fontFamily:"inherit", textAlign:"left" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{label}</div>
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{desc}</div>
              </button>
            ))}
          </div>

          {preset==="custom" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
              <div>
                <label style={{ ...S.lbl, marginBottom:4 }}>Width (px)</label>
                <input type="number" min={200} max={8000} value={cw}
                  onChange={e => setCw(e.target.value)} style={S.inp} />
              </div>
              <div>
                <label style={{ ...S.lbl, marginBottom:4 }}>Height (px)</label>
                <input type="number" min={200} max={8000} value={ch}
                  onChange={e => setCh(e.target.value)} style={S.inp} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ ...S.ghost, flex:1 }}>Cancel</button>
          <button onClick={go} disabled={!name.trim()}
            style={{ ...S.btn, flex:2, opacity:name.trim()?1:0.4 }}>Create Map →</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Shortcuts overlay
// ═════════════════════════════════════════════════════════════
function ShortcutsModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center" }}
      onMouseDown={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:16,
        padding:28, width:400, maxHeight:"80vh", overflowY:"auto",
        boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:17, fontWeight:800 }}>⌨️ Keyboard Shortcuts</h3>
          <button onClick={onClose} style={{ ...S.ghost, padding:"4px 10px" }}>✕</button>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <tbody>
            {SHORTCUTS.map(({ key, desc }) => (
              <tr key={key} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"8px 0", width:"44%" }}>
                  <code style={{ background:"var(--bg3)", border:"1px solid var(--border)",
                    borderRadius:5, padding:"3px 7px", fontSize:11,
                    fontFamily:"monospace", color:"var(--accent)", fontWeight:700 }}>
                    {key}
                  </code>
                </td>
                <td style={{ padding:"8px 0", fontSize:13, color:"var(--text2)" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop:14, padding:"10px 13px", background:"var(--bg3)",
          borderRadius:10, fontSize:12, color:"var(--text3)", lineHeight:1.65 }}>
          <strong style={{ color:"var(--text2)" }}>Rotation:</strong> Drag the{" "}
          <span style={{ color:"var(--accent)", fontWeight:700 }}>↻</span> handle that
          appears above a selected shape, or use <code style={{ fontFamily:"monospace",
            background:"var(--bg2)", padding:"1px 4px", borderRadius:3 }}>[ ]</code> for 15° steps.
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Canvas Editor
// ═════════════════════════════════════════════════════════════
function CanvasEditor({ map, onSave, onBack }) {
  const canvasRef    = useRef();
  const [elements,   setElements]   = useState(map.elements || []);
  const [tool,       setTool]       = useState("select");
  const [selectedId, setSelectedId] = useState(null);
  const [zoom,       setZoom]       = useState(0.7);
  const [pan,        setPan]        = useState({ x:40, y:40 });
  const [dragging,   setDragging]   = useState(null);
  const [resizing,   setResizing]   = useState(null);
  const [rotating,   setRotating]   = useState(null);
  const [drawing,    setDrawing]    = useState(null);
  const [panStart,   setPanStart]   = useState(null);
  const [snapGrid,   setSnapGrid]   = useState(true);
  const [showGrid,   setShowGrid]   = useState(true);
  const [canvasBg,   setCanvasBg]   = useState(map.canvas_bg || "#f8f8f0");
  const [zoneType,   setZoneType]   = useState("general");
  const [poiType,    setPoiType]    = useState("stage");
  const [dirty,      setDirty]      = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [showKeys,   setShowKeys]   = useState(false);

  const CW = map.width  || 1200;
  const CH = map.height || 800;
  const GRID = 20;
  const snap = useCallback(v => snapGrid ? Math.round(v/GRID)*GRID : v, [snapGrid]);

  // ── Draw loop ──────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx  = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // bg fill
    ctx.fillStyle = canvasBg;
    ctx.fillRect(pan.x*dpr, pan.y*dpr, CW*zoom*dpr, CH*zoom*dpr);

    // grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(0,0,0,0.055)"; ctx.lineWidth = 1;
      for (let x=0; x<=CW; x+=GRID) {
        ctx.beginPath();
        ctx.moveTo((pan.x+x*zoom)*dpr, pan.y*dpr);
        ctx.lineTo((pan.x+x*zoom)*dpr, (pan.y+CH*zoom)*dpr);
        ctx.stroke();
      }
      for (let y=0; y<=CH; y+=GRID) {
        ctx.beginPath();
        ctx.moveTo(pan.x*dpr, (pan.y+y*zoom)*dpr);
        ctx.lineTo((pan.x+CW*zoom)*dpr, (pan.y+y*zoom)*dpr);
        ctx.stroke();
      }
    }

    // border
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 2;
    ctx.strokeRect(pan.x*dpr, pan.y*dpr, CW*zoom*dpr, CH*zoom*dpr);

    // elements
    elements.forEach(el => drawElement(ctx, el, zoom, pan.x, pan.y, el.id===selectedId, dpr));

    // rubber-band preview
    if (drawing && ["rect","circle","triangle","arrow"].includes(tool)) {
      const { x, y, w, h } = drawing;
      ctx.save();
      ctx.translate((pan.x+x*zoom)*dpr, (pan.y+y*zoom)*dpr);
      ctx.scale(zoom*dpr, zoom*dpr);
      const zc = ZONE_COLORS[zoneType]||ZONE_COLORS.custom;
      ctx.fillStyle=zc.fill; ctx.strokeStyle=zc.stroke;
      ctx.lineWidth=2/zoom; ctx.setLineDash([6/zoom,4/zoom]);
      ctx.beginPath();
      if (tool==="rect") ctx.rect(0,0,w,h);
      else if (tool==="circle") ctx.ellipse(w/2,h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }

    // rotation handle for selected shape
    const sel = elements.find(el => el.id===selectedId);
    if (sel && tool==="select" && !["poi","text"].includes(sel.type)) {
      const rot = d2r(sel.rotation||0);
      const cx  = pan.x + (sel.x+(sel.w||0)/2)*zoom;
      const cy  = pan.y + sel.y*zoom;
      // endpoint of the stem (30px above centre-top, rotated)
      const hx  = cx + Math.sin(-rot)*0 - Math.cos(rot+Math.PI/2)*30;
      const hy  = cy - 30;
      ctx.save();
      ctx.strokeStyle = "#5b5bd6"; ctx.lineWidth = 1.5;
      ctx.setLineDash([4,3]);
      ctx.beginPath();
      ctx.moveTo(cx*dpr, cy*dpr);
      ctx.lineTo(cx*dpr, (cy-30)*dpr);
      ctx.stroke(); ctx.setLineDash([]);
      // circle handle
      ctx.beginPath();
      ctx.arc(cx*dpr, (cy-30)*dpr, 8*dpr, 0, Math.PI*2);
      ctx.fillStyle="#5b5bd6"; ctx.fill();
      ctx.font=`bold ${10*dpr}px sans-serif`;
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("↻", cx*dpr, (cy-30)*dpr);
      ctx.restore();
    }
  }, [elements, selectedId, zoom, pan, drawing, tool, showGrid, canvasBg, zoneType]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio||1;
    const r   = c.getBoundingClientRect();
    c.width=r.width*dpr; c.height=r.height*dpr; draw();
  }, [draw]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ro = new ResizeObserver(() => {
      const dpr=window.devicePixelRatio||1; const r=c.getBoundingClientRect();
      c.width=r.width*dpr; c.height=r.height*dpr; draw();
    });
    ro.observe(c); return () => ro.disconnect();
  }, [draw]);

  // ── Helpers ────────────────────────────────────────────────
  const toCanvas = (cx, cy) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x:(cx-r.left-pan.x)/zoom, y:(cy-r.top-pan.y)/zoom };
  };

  const hitTest = (x, y) => {
    for (let i=elements.length-1; i>=0; i--) {
      const el = elements[i];
      if (el.type==="poi"||el.type==="text") {
        if (Math.abs(x-el.x)<26 && Math.abs(y-el.y)<26) return el;
      } else {
        // rotate point into local space to test AABB
        const ecx=el.x+(el.w||0)/2, ecy=el.y+(el.h||0)/2;
        const r=-d2r(el.rotation||0);
        const lx=Math.cos(r)*(x-ecx)-Math.sin(r)*(y-ecy)+ecx;
        const ly=Math.sin(r)*(x-ecx)+Math.cos(r)*(y-ecy)+ecy;
        if (lx>=el.x&&lx<=el.x+(el.w||0)&&ly>=el.y&&ly<=el.y+(el.h||0)) return el;
      }
    }
    return null;
  };

  // resize corner hit in world space (rotated corners)
  const rotCorners = (el) => {
    if (!el||el.type==="poi"||el.type==="text") return [];
    const cx=el.x+(el.w||0)/2, cy=el.y+(el.h||0)/2;
    const rot=d2r(el.rotation||0);
    const rot2d=(px,py)=>({
      x: cx+Math.cos(rot)*(px-cx)-Math.sin(rot)*(py-cy),
      y: cy+Math.sin(rot)*(px-cx)+Math.cos(rot)*(py-cy),
    });
    return [
      { pos:"br", ...rot2d(el.x+(el.w||0), el.y+(el.h||0)) },
      { pos:"tr", ...rot2d(el.x+(el.w||0), el.y) },
      { pos:"bl", ...rot2d(el.x,            el.y+(el.h||0)) },
    ];
  };

  const hitCorner = (x, y, el) => {
    const PAD = 10/zoom;
    for (const h of rotCorners(el))
      if (Math.abs(x-h.x)<PAD && Math.abs(y-h.y)<PAD) return h.pos;
    return null;
  };

  // rotation handle is in screen (not canvas) coords — 30px above top-centre
  const hitRotHandle = (clientX, clientY, el) => {
    if (!el||el.type==="poi"||el.type==="text") return false;
    const r  = canvasRef.current.getBoundingClientRect();
    const sx = pan.x + (el.x+(el.w||0)/2)*zoom;
    const sy = pan.y + el.y*zoom - 30;
    const dx = clientX-r.left-sx, dy=clientY-r.top-sy;
    return Math.sqrt(dx*dx+dy*dy) < 12;
  };

  // ── Pointer down ───────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button===1||(e.button===0&&e.altKey)) {
      setPanStart({ mx:e.clientX, my:e.clientY, px:pan.x, py:pan.y });
      return;
    }
    const { x, y } = toCanvas(e.clientX, e.clientY);

    if (tool==="select") {
      const sel = elements.find(el => el.id===selectedId);
      if (sel && hitRotHandle(e.clientX, e.clientY, sel)) {
        const cx=sel.x+(sel.w||0)/2, cy=sel.y+(sel.h||0)/2;
        setRotating({ id:sel.id, cx, cy, startAngle:Math.atan2(y-cy,x-cx), orig:sel.rotation||0 });
        return;
      }
      if (sel) {
        const h = hitCorner(x, y, sel);
        if (h) { setResizing({ id:sel.id, handle:h, origEl:{...sel}, sx:x, sy:y }); return; }
      }
      const hit = hitTest(x, y);
      if (hit) { setSelectedId(hit.id); setDragging({ id:hit.id, sx:x, sy:y, ox:hit.x, oy:hit.y }); }
      else setSelectedId(null);
      return;
    }

    if (tool==="text") {
      const label = window.prompt("Enter text:", "Label");
      if (!label) return;
      const el = { id:newId(), type:"text", x:snap(x), y:snap(y), text:label,
        fontSize:20, fontWeight:"normal", fontStyle:"normal",
        textDecoration:"none", fontFamily:"Plus Jakarta Sans",
        color:"#1d1d1f", rotation:0 };
      setElements(p=>[...p,el]); setSelectedId(el.id); setDirty(true); return;
    }

    if (tool==="poi") {
      const pt = POI_TYPES.find(p=>p.id===poiType)||POI_TYPES[0];
      const el = { id:newId(), type:"poi", poiType, emoji:pt.emoji, label:pt.label,
        x:snap(x), y:snap(y), rotation:0 };
      setElements(p=>[...p,el]); setSelectedId(el.id); setDirty(true); return;
    }

    setDrawing({ x:snap(x), y:snap(y), w:0, h:0 });
  }, [tool, elements, selectedId, zoom, pan, snap, poiType]);

  // ── Pointer move ───────────────────────────────────────────
  const onPointerMove = useCallback((e) => {
    if (panStart) { setPan({ x:panStart.px+e.clientX-panStart.mx, y:panStart.py+e.clientY-panStart.my }); return; }
    const { x, y } = toCanvas(e.clientX, e.clientY);

    if (rotating) {
      const { id, cx, cy, startAngle, orig } = rotating;
      const angle = Math.atan2(y-cy, x-cx);
      let deg = orig + r2d(angle-startAngle);
      if (snapGrid) deg = Math.round(deg/15)*15;
      setElements(p=>p.map(el=>el.id===id?{...el,rotation:((deg%360)+360)%360}:el));
      setDirty(true); return;
    }
    if (dragging) {
      const { id, sx, sy, ox, oy } = dragging;
      setElements(p=>p.map(el=>el.id===id?{...el,x:snap(ox+x-sx),y:snap(oy+y-sy)}:el));
      setDirty(true); return;
    }
    if (resizing) {
      const { id, handle, origEl, sx, sy } = resizing;
      const dx=x-sx, dy=y-sy;
      setElements(p=>p.map(el=>{
        if (el.id!==id) return el;
        let {x:ex,y:ey,w,h}=origEl;
        if (handle==="br"){w=snap(Math.max(20,origEl.w+dx));h=snap(Math.max(20,origEl.h+dy));}
        if (handle==="tr"){w=snap(Math.max(20,origEl.w+dx));ey=snap(origEl.y+dy);h=snap(Math.max(20,origEl.h-dy));}
        if (handle==="bl"){ex=snap(origEl.x+dx);w=snap(Math.max(20,origEl.w-dx));h=snap(Math.max(20,origEl.h+dy));}
        return {...el,x:ex,y:ey,w,h};
      }));
      setDirty(true); return;
    }
    if (drawing) setDrawing(d=>({ ...d, w:snap(x)-d.x, h:snap(y)-d.y }));
  }, [panStart, rotating, dragging, resizing, drawing, snap]);

  // ── Pointer up ─────────────────────────────────────────────
  const onPointerUp = useCallback(() => {
    if (panStart)  { setPanStart(null);  return; }
    if (rotating)  { setRotating(null);  return; }
    if (dragging)  { setDragging(null);  return; }
    if (resizing)  { setResizing(null);  return; }
    if (drawing) {
      const { x, y, w, h } = drawing;
      const aw=Math.abs(w), ah=Math.abs(h);
      if (aw>10&&ah>10) {
        const zc=ZONE_COLORS[zoneType]||ZONE_COLORS.custom;
        const el={ id:newId(), type:tool, zoneType,
          x:w<0?x+w:x, y:h<0?y+h:y, w:aw, h:ah,
          fill:zc.fill, stroke:zc.stroke, label:zc.label, showLabel:true, opacity:1, rotation:0 };
        setElements(p=>[...p,el]); setSelectedId(el.id); setDirty(true);
      }
      setDrawing(null);
    }
  }, [panStart, rotating, dragging, resizing, drawing, tool, zoneType]);

  // ── Scroll zoom ────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z=>clamp(z*(e.deltaY>0?0.9:1.1),0.1,4));
  }, []);
  useEffect(() => {
    const c=canvasRef.current; if(!c) return;
    c.addEventListener("wheel",onWheel,{passive:false});
    return ()=>c.removeEventListener("wheel",onWheel);
  }, [onWheel]);

  // ── Keyboard ───────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      const tag=e.target.tagName;
      if (tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT") return;
      if ((e.key==="Delete"||e.key==="Backspace")&&selectedId) {
        setElements(p=>p.filter(el=>el.id!==selectedId));
        setSelectedId(null); setDirty(true); return;
      }
      if (e.key==="Escape") { setSelectedId(null); setTool("select"); return; }
      if (e.key==="?"||e.key==="/") { setShowKeys(s=>!s); return; }
      const km = { v:"select",r:"rect",c:"circle",g:"triangle",a:"arrow",t:"text",p:"poi" };
      if (km[e.key.toLowerCase()]) { setTool(km[e.key.toLowerCase()]); return; }
      if ((e.key==="["||e.key==="]")&&selectedId) {
        const d=e.key==="["?-15:15;
        setElements(p=>p.map(el=>el.id===selectedId?{...el,rotation:(((el.rotation||0)+d)%360+360)%360}:el));
        setDirty(true); return;
      }
      if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="d"&&selectedId) {
        e.preventDefault();
        setElements(p=>{
          const o=p.find(el=>el.id===selectedId); if(!o) return p;
          return [...p,{...o,id:newId(),x:o.x+20,y:o.y+20}];
        });
        setDirty(true); return;
      }
      if ((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s") {
        e.preventDefault(); doSave();
      }
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  }, [selectedId]);

  const doSave = async () => {
    setSaving(true);
    await onSave(elements, { canvas_bg:canvasBg });
    setSaving(false); setDirty(false);
  };

  const exportPng = () => {
    const c=document.createElement("canvas"); c.width=CW; c.height=CH;
    const ctx=c.getContext("2d");
    ctx.fillStyle=canvasBg; ctx.fillRect(0,0,CW,CH);
    elements.forEach(el=>drawElement(ctx,el,1,0,0,false,1));
    const a=document.createElement("a"); a.download=`${map.name||"map"}.png`;
    a.href=c.toDataURL("image/png"); a.click();
  };

  const selected = elements.find(el=>el.id===selectedId);
  const cur = panStart?"grabbing":rotating?"crosshair":tool==="select"?"default":"crosshair";

  // ── Tool button ────────────────────────────────────────────
  const TBtn = ({ t, tip, shortcut }) => {
    const Icon = TOOL_ICON[t];
    const active = tool===t;
    return (
      <button title={`${tip} (${shortcut})`} onClick={() => setTool(t)}
        style={{ width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center",
          background:active?"var(--accent)":"transparent",
          border:`1.5px solid ${active?"var(--accent)":"transparent"}`,
          borderRadius:9, cursor:"pointer", transition:"all 0.12s",
          color:active?"#fff":"var(--text2)",
          boxShadow:active?"0 2px 10px rgba(91,91,214,0.35)":"none" }}>
        {Icon ? <Icon active={active}/> : t}
      </button>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", minHeight:600 }}>

      {/* ── Toolbar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", marginBottom:8,
        borderBottom:"1.5px solid var(--border)", flexShrink:0, flexWrap:"wrap" }}>
        <button onClick={onBack} style={{ ...S.ghost, fontSize:13 }}>← Maps</button>
        <div style={{ fontWeight:700, fontSize:15, color:"var(--text)", flex:1, minWidth:60 }}>{map.name}</div>

        {/* Tools group */}
        <div style={{ display:"flex", gap:2, background:"var(--bg3)", borderRadius:11,
          padding:3, border:"1.5px solid var(--border)" }}>
          <TBtn t="select"   tip="Select / Move"  shortcut="V" />
          <TBtn t="rect"     tip="Rectangle"       shortcut="R" />
          <TBtn t="circle"   tip="Ellipse"         shortcut="C" />
          <TBtn t="triangle" tip="Triangle"        shortcut="G" />
          <TBtn t="arrow"    tip="Arrow"           shortcut="A" />
          <TBtn t="text"     tip="Text"            shortcut="T" />
          <TBtn t="poi"      tip="POI Marker"      shortcut="P" />
        </div>

        {/* Zoom */}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <button onClick={() => setZoom(z=>clamp(z/1.2,0.1,4))} style={{ ...S.ghost, padding:"5px 9px" }}>−</button>
          <span style={{ fontSize:12, color:"var(--text2)", minWidth:44, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z=>clamp(z*1.2,0.1,4))} style={{ ...S.ghost, padding:"5px 9px" }}>+</button>
          <button onClick={() => { setZoom(0.7); setPan({x:40,y:40}); }}
            style={{ ...S.ghost, fontSize:11, padding:"5px 9px" }} title="Reset view">⌂</button>
        </div>

        <button onClick={() => setShowGrid(g=>!g)}
          style={{ ...S.ghost, fontSize:12, padding:"5px 10px",
            color:showGrid?"var(--accent)":"var(--text3)",
            borderColor:showGrid?"var(--accentBg)":"var(--border)" }}>⊞ Grid</button>
        <button onClick={() => setSnapGrid(s=>!s)}
          style={{ ...S.ghost, fontSize:12, padding:"5px 10px",
            color:snapGrid?"var(--accent)":"var(--text3)",
            borderColor:snapGrid?"var(--accentBg)":"var(--border)" }}>🧲 Snap</button>
        <button onClick={exportPng} style={{ ...S.ghost, fontSize:12 }}>↓ PNG</button>
        <button onClick={() => setShowKeys(true)}
          style={{ ...S.ghost, fontSize:12, padding:"5px 10px" }}
          title="Keyboard shortcuts (?)">⌨️</button>
        <button onClick={doSave} disabled={!dirty||saving}
          style={{ ...S.btn, fontSize:13, opacity:(!dirty||saving)?0.5:1, minWidth:90 }}>
          {saving?"Saving…":dirty?"● Save":"✓ Saved"}
        </button>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── Left sidebar ── */}
        <div style={{ width:192, flexShrink:0, overflowY:"auto", padding:"12px 10px",
          borderRight:"1.5px solid var(--border)", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Zone type */}
          {["rect","circle","triangle","arrow"].includes(tool) && (
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
                letterSpacing:"0.08em", marginBottom:8 }}>Zone Type</div>
              {Object.entries(ZONE_COLORS).map(([key,zc]) => (
                <button key={key} onClick={() => setZoneType(key)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 9px",
                    width:"100%", marginBottom:4,
                    background:zoneType===key?zc.fill:"none",
                    border:`1.5px solid ${zoneType===key?zc.stroke:"var(--border)"}`,
                    borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>
                  <div style={{ width:11,height:11,borderRadius:3,background:zc.stroke,flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:"var(--text)", fontWeight:zoneType===key?700:400 }}>{zc.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* POI picker */}
          {tool==="poi" && (
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
                letterSpacing:"0.08em", marginBottom:8 }}>POI Type</div>
              {POI_TYPES.map(pt => (
                <button key={pt.id} onClick={() => setPoiType(pt.id)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 9px",
                    width:"100%", marginBottom:3,
                    background:poiType===pt.id?"var(--accentBg)":"none",
                    border:`1.5px solid ${poiType===pt.id?"var(--accent)":"var(--border)"}`,
                    borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>
                  <span style={{ fontSize:14 }}>{pt.emoji}</span>
                  <span style={{ fontSize:12, color:"var(--text)", fontWeight:poiType===pt.id?700:400 }}>{pt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Select-tool tips when nothing selected */}
          {tool==="select" && !selected && (
            <div style={{ fontSize:11, color:"var(--text3)", lineHeight:1.75 }}>
              <div style={{ fontWeight:700, color:"var(--text2)", marginBottom:8, fontSize:12 }}>
                Select tool
              </div>
              {[["↖ Drag","Move element"],["↻ Handle","Rotate"],["● Corners","Resize"],
                ["[ ]","Rotate 15°"],["Del","Delete"],["⌘D","Duplicate"]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", gap:7, marginBottom:5, alignItems:"center" }}>
                  <code style={{ fontSize:10, background:"var(--bg3)", border:"1px solid var(--border)",
                    borderRadius:4, padding:"1px 5px", fontFamily:"monospace",
                    color:"var(--accent)", minWidth:36, textAlign:"center", flexShrink:0 }}>{k}</code>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Canvas background */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:8 }}>Background</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {["#f8f8f0","#ffffff","#1a1a2e","#0f2027","#e8f4f8","#f0f4e8"].map(c=>(
                <button key={c} onClick={()=>{setCanvasBg(c);setDirty(true);}}
                  style={{ width:24,height:24,borderRadius:6,background:c,cursor:"pointer",
                    border:`2px solid ${canvasBg===c?"var(--accent)":"var(--border)"}` }}/>
              ))}
              <input type="color" value={canvasBg}
                onChange={e=>{setCanvasBg(e.target.value);setDirty(true);}}
                style={{ width:24,height:24,borderRadius:6,border:"1.5px solid var(--border)",
                  cursor:"pointer",padding:0 }} title="Custom colour"/>
            </div>
          </div>

          {/* Legend */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:8 }}>Legend</div>
            {Object.values(ZONE_COLORS).filter(zc=>elements.some(el=>el.fill===zc.fill)).map(zc=>(
              <div key={zc.label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                <div style={{ width:12,height:12,borderRadius:2,background:zc.stroke,flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"var(--text2)" }}>{zc.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas ── */}
        <div style={{ flex:1, overflow:"hidden", position:"relative",
          background:"var(--bg3)",
          backgroundImage:"radial-gradient(circle,rgba(0,0,0,0.05) 1px,transparent 1px)",
          backgroundSize:"20px 20px" }}>
          <canvas ref={canvasRef}
            style={{ width:"100%", height:"100%", display:"block", cursor:cur }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          <div style={{ position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)",
            fontSize:11, color:"var(--text3)", background:"var(--bg2)",
            border:"1px solid var(--border)", borderRadius:20,
            padding:"4px 14px", pointerEvents:"none", whiteSpace:"nowrap" }}>
            {rotating?"Drag to rotate · release to finish"
              :tool==="select"?"Click to select · Alt+drag to pan · Scroll to zoom"
              :tool==="poi"?"Click to place POI"
              :tool==="text"?"Click to place text"
              :"Drag to draw shape · Scroll to zoom"}
          </div>
        </div>

        {/* ── Properties panel ── */}
        {selected && (
          <ElementPanel el={selected}
            onChange={patch=>{setElements(p=>p.map(el=>el.id===selected.id?{...el,...patch}:el));setDirty(true);}}
            onDelete={()=>{setElements(p=>p.filter(el=>el.id!==selected.id));setSelectedId(null);setDirty(true);}}
            onDuplicate={()=>{
              const cl={...selected,id:newId(),x:selected.x+20,y:selected.y+20};
              setElements(p=>[...p,cl]); setSelectedId(cl.id); setDirty(true);
            }}
            onLayer={dir=>{
              setElements(p=>{
                const i=p.findIndex(el=>el.id===selected.id); if(i<0) return p;
                const a=[...p]; const [el]=a.splice(i,1);
                a.splice(dir==="up"?Math.min(a.length,i+1):Math.max(0,i-1),0,el); return a;
              }); setDirty(true);
            }}
          />
        )}
      </div>

      {showKeys && <ShortcutsModal onClose={()=>setShowKeys(false)}/>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Properties panel
// ═════════════════════════════════════════════════════════════
function ElementPanel({ el, onChange, onDelete, onDuplicate, onLayer }) {
  const isZone = ["rect","circle","triangle","arrow"].includes(el.type);
  const isPoi  = el.type==="poi";
  const isText = el.type==="text";

  const Sec = ({ title, children }) => (
    <div>
      <div style={{ fontSize:10, color:"var(--text3)", fontWeight:800, textTransform:"uppercase",
        letterSpacing:"0.07em", marginBottom:8, paddingBottom:5,
        borderBottom:"1px solid var(--border)" }}>{title}</div>
      {children}
    </div>
  );

  const NumInput = ({ label, field, min, max, step=1 }) => (
    <div>
      <label style={S.lbl}>{label}</label>
      <input type="number" min={min} max={max} step={step}
        value={Math.round(el[field]??0)}
        onChange={e=>onChange({[field]:parseFloat(e.target.value)||0})}
        style={{...S.inp,padding:"5px 8px",fontSize:12}}/>
    </div>
  );

  const rot = ((el.rotation||0)%360+360)%360;

  return (
    <div style={{ width:232, flexShrink:0, overflowY:"auto", padding:"14px 13px",
      borderLeft:"1.5px solid var(--border)", display:"flex", flexDirection:"column", gap:16 }}>

      <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)",
        textTransform:"uppercase", letterSpacing:"0.08em" }}>Properties</div>

      {/* Position */}
      <Sec title="Position">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          <NumInput label="X" field="x"/>
          <NumInput label="Y" field="y"/>
        </div>
      </Sec>

      {/* Size */}
      {isZone && (
        <Sec title="Size">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            <NumInput label="Width"  field="w" min={10}/>
            <NumInput label="Height" field="h" min={10}/>
          </div>
        </Sec>
      )}

      {/* Rotation — every element */}
      <Sec title="Rotation">
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
          <input type="range" min={0} max={360} step={1} value={rot}
            onChange={e=>onChange({rotation:parseInt(e.target.value)})}
            style={{ flex:1, accentColor:"var(--accent)" }}/>
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            <input type="number" min={0} max={360} value={rot}
              onChange={e=>onChange({rotation:((parseInt(e.target.value)||0)%360+360)%360})}
              style={{...S.inp,width:54,padding:"5px 7px",fontSize:12,textAlign:"center"}}/>
            <span style={{ fontSize:11, color:"var(--text3)" }}>°</span>
          </div>
        </div>
        {/* Quick-snap buttons */}
        <div style={{ display:"flex", gap:4 }}>
          {[0,45,90,135,180,270].map(deg=>(
            <button key={deg} onClick={()=>onChange({rotation:deg})}
              style={{ flex:1, ...S.ghost, padding:"4px 2px", fontSize:10,
                background:rot===deg?"var(--accentBg)":"none",
                borderColor:rot===deg?"var(--accent)":"var(--border)" }}>
              {deg}°
            </button>
          ))}
        </div>
      </Sec>

      {/* Label (non-text) */}
      {!isText && (
        <Sec title="Label">
          <input value={el.label||""} onChange={e=>onChange({label:e.target.value})}
            style={{...S.inp,fontSize:13}} placeholder="Zone label"/>
          <label style={{ display:"flex",alignItems:"center",gap:7,marginTop:7,cursor:"pointer" }}>
            <input type="checkbox" checked={!!el.showLabel}
              onChange={e=>onChange({showLabel:e.target.checked})}
              style={{ accentColor:"var(--accent)",cursor:"pointer" }}/>
            <span style={{ fontSize:12, color:"var(--text2)" }}>Show label on map</span>
          </label>
        </Sec>
      )}

      {/* ── Text formatting ── */}
      {isText && (
        <Sec title="Text">
          {/* Content */}
          <div style={{ marginBottom:10 }}>
            <label style={S.lbl}>Content</label>
            <input value={el.text||""} onChange={e=>onChange({text:e.target.value})} style={S.inp}/>
          </div>

          {/* Font family */}
          <div style={{ marginBottom:10 }}>
            <label style={S.lbl}>Font</label>
            <select value={el.fontFamily||"Plus Jakarta Sans"}
              onChange={e=>onChange({fontFamily:e.target.value})}
              style={{...S.inp,cursor:"pointer"}}>
              {FONT_FAMILIES.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Size — slider + numeric */}
          <div style={{ marginBottom:10 }}>
            <label style={S.lbl}>Size — {el.fontSize||20}px</label>
            <div style={{ display:"flex", gap:7, alignItems:"center" }}>
              <input type="range" min={8} max={160} step={1} value={el.fontSize||20}
                onChange={e=>onChange({fontSize:parseInt(e.target.value)})}
                style={{ flex:1, accentColor:"var(--accent)" }}/>
              <input type="number" min={8} max={300} value={el.fontSize||20}
                onChange={e=>onChange({fontSize:parseInt(e.target.value)||20})}
                style={{...S.inp,width:54,padding:"5px 7px",fontSize:12,textAlign:"center"}}/>
            </div>
          </div>

          {/* Bold / Italic / Underline */}
          <div style={{ marginBottom:10 }}>
            <label style={S.lbl}>Formatting</label>
            <div style={{ display:"flex", gap:6 }}>
              {[
                { field:"fontWeight",    on:"bold",      off:"normal",    icon:"B",
                  btnFont:"bold 15px Georgia,serif" },
                { field:"fontStyle",     on:"italic",    off:"normal",    icon:"I",
                  btnFont:"italic 15px Georgia,serif" },
                { field:"textDecoration",on:"underline", off:"none",      icon:"U",
                  underline:true },
              ].map(({ field, on, off, icon, btnFont, underline })=>{
                const active = el[field]===on;
                return (
                  <button key={field} onClick={()=>onChange({[field]:active?off:on})}
                    style={{ width:38, height:38, display:"flex", alignItems:"center",
                      justifyContent:"center", borderRadius:8, cursor:"pointer",
                      fontFamily: btnFont?undefined:"inherit",
                      font: btnFont||undefined,
                      fontSize: btnFont?undefined:15,
                      background:active?"var(--accent)":"var(--bg3)",
                      border:`1.5px solid ${active?"var(--accent)":"var(--border)"}`,
                      color:active?"#fff":"var(--text2)",
                      position:"relative" }}>
                    <span style={ underline?{ textDecoration:"underline", fontWeight:"bold",
                      fontFamily:"Georgia,serif", fontSize:14 }:{} }>{icon}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text colour */}
          <div>
            <label style={S.lbl}>Colour</label>
            <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
              <input type="color" value={el.color||"#1d1d1f"}
                onChange={e=>onChange({color:e.target.value})}
                style={{ width:34, height:34, borderRadius:8,
                  border:"1.5px solid var(--border)", cursor:"pointer", padding:2 }}/>
              {["#1d1d1f","#ffffff","#dc2626","#2563eb","#059669","#f59e0b","#8b5cf6","#ec4899"].map(c=>(
                <button key={c} onClick={()=>onChange({color:c})}
                  style={{ width:22, height:22, borderRadius:5, background:c,
                    border:`2px solid ${el.color===c?"var(--accent)":"transparent"}`,
                    cursor:"pointer" }}/>
              ))}
            </div>
          </div>
        </Sec>
      )}

      {/* Zone type & opacity */}
      {isZone && (
        <Sec title="Zone Type">
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:10 }}>
            {Object.entries(ZONE_COLORS).map(([key,zc])=>(
              <button key={key} onClick={()=>onChange({zoneType:key,fill:zc.fill,stroke:zc.stroke,label:el.label||zc.label})}
                style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 8px",
                  background:el.zoneType===key?zc.fill:"none",
                  border:`1.5px solid ${el.zoneType===key?zc.stroke:"var(--border)"}`,
                  borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ width:10,height:10,borderRadius:2,background:zc.stroke,flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"var(--text)" }}>{zc.label}</span>
              </button>
            ))}
          </div>
          <label style={S.lbl}>Opacity — {Math.round((el.opacity??1)*100)}%</label>
          <input type="range" min={0.05} max={1} step={0.05} value={el.opacity??1}
            onChange={e=>onChange({opacity:parseFloat(e.target.value)})}
            style={{ width:"100%", accentColor:"var(--accent)" }}/>
        </Sec>
      )}

      {/* POI type */}
      {isPoi && (
        <Sec title="POI Type">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
            {POI_TYPES.map(pt=>(
              <button key={pt.id} onClick={()=>onChange({poiType:pt.id,emoji:pt.emoji,label:pt.label})}
                style={{ padding:"5px 6px", display:"flex", alignItems:"center", gap:5,
                  background:el.poiType===pt.id?"var(--accentBg)":"none",
                  border:`1.5px solid ${el.poiType===pt.id?"var(--accent)":"var(--border)"}`,
                  borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ fontSize:13 }}>{pt.emoji}</span>
                <span style={{ fontSize:10, color:"var(--text2)" }}>{pt.label}</span>
              </button>
            ))}
          </div>
        </Sec>
      )}

      {/* Layer */}
      <Sec title="Layer Order">
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={()=>onLayer("up")}   style={{...S.ghost,flex:1,fontSize:12}}>▲ Forward</button>
          <button onClick={()=>onLayer("down")} style={{...S.ghost,flex:1,fontSize:12}}>▼ Back</button>
        </div>
      </Sec>

      {/* Actions */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, paddingTop:2 }}>
        <button onClick={onDuplicate} style={{...S.ghost,fontSize:12}}>⧉ Duplicate</button>
        <button onClick={onDelete}
          style={{...S.ghost,fontSize:12,color:"#dc2626",borderColor:"rgba(220,38,38,0.2)"}}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  drawElement — shared by editor canvas + thumbnail
// ═════════════════════════════════════════════════════════════
function drawElement(ctx, el, zoom, ox, oy, selected=false, dpr=1) {
  ctx.save();

  // Apply rotation around element's visual centre
  if (el.rotation) {
    let rcx, rcy;
    if (el.type==="poi"||el.type==="text") {
      rcx=(ox+el.x*zoom)*dpr; rcy=(oy+el.y*zoom)*dpr;
    } else {
      rcx=(ox+(el.x+(el.w||0)/2)*zoom)*dpr;
      rcy=(oy+(el.y+(el.h||0)/2)*zoom)*dpr;
    }
    ctx.translate(rcx,rcy);
    ctx.rotate(d2r(el.rotation));
    ctx.translate(-rcx,-rcy);
  }

  ctx.translate((ox+el.x*zoom)*dpr, (oy+el.y*zoom)*dpr);
  ctx.scale(zoom*dpr, zoom*dpr);

  if (el.type==="poi") {
    ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2);
    ctx.fillStyle=selected?"rgba(91,91,214,0.25)":"rgba(255,255,255,0.92)"; ctx.fill();
    ctx.strokeStyle=selected?"#5b5bd6":"rgba(0,0,0,0.14)";
    ctx.lineWidth=selected?2.5/zoom:1/zoom; ctx.stroke();
    ctx.font="14px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(el.emoji||"📍",0,0);
    if (el.label) {
      ctx.font=`bold 10px "Plus Jakarta Sans",sans-serif`;
      ctx.textAlign="center"; ctx.fillStyle="rgba(0,0,0,0.7)";
      ctx.fillText(el.label,0,23);
    }

  } else if (el.type==="text") {
    const fw=el.fontWeight||"normal";
    const fi=el.fontStyle||"normal";
    const ff=el.fontFamily||"Plus Jakarta Sans";
    const fs=el.fontSize||20;
    ctx.font=`${fi} ${fw} ${fs}px "${ff}",sans-serif`;
    ctx.fillStyle=el.color||"#1d1d1f";
    ctx.textBaseline="top";
    const txt=el.text||el.label||"";
    ctx.fillText(txt,0,0);
    // underline
    if (el.textDecoration==="underline") {
      const m=ctx.measureText(txt);
      ctx.strokeStyle=el.color||"#1d1d1f";
      ctx.lineWidth=Math.max(1,fs*0.07);
      ctx.beginPath(); ctx.moveTo(0,fs+2); ctx.lineTo(m.width,fs+2); ctx.stroke();
    }
    // selection
    if (selected) {
      const m=ctx.measureText(txt);
      ctx.strokeStyle="#5b5bd6"; ctx.lineWidth=1.5/zoom;
      ctx.setLineDash([4/zoom,3/zoom]);
      ctx.strokeRect(-3,-3,m.width+6,fs+6); ctx.setLineDash([]);
    }

  } else {
    const w=el.w||100, h=el.h||60;
    ctx.globalAlpha=el.opacity??1;
    ctx.fillStyle=el.fill||"rgba(91,91,214,0.15)";
    ctx.strokeStyle=el.stroke||"#5b5bd6";
    ctx.lineWidth=selected?2.5/zoom:1.5/zoom;

    if (el.type==="rect") {
      const r=6;
      ctx.beginPath();
      ctx.moveTo(r,0);ctx.lineTo(w-r,0);ctx.quadraticCurveTo(w,0,w,r);
      ctx.lineTo(w,h-r);ctx.quadraticCurveTo(w,h,w-r,h);
      ctx.lineTo(r,h);ctx.quadraticCurveTo(0,h,0,h-r);
      ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (el.type==="circle") {
      ctx.beginPath();
      ctx.ellipse(w/2,h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    } else if (el.type==="triangle") {
      ctx.beginPath();
      ctx.moveTo(w/2,0); ctx.lineTo(w,h); ctx.lineTo(0,h);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (el.type==="arrow") {
      const hw=12, hl=18;
      ctx.beginPath();
      ctx.moveTo(0,h/2-6); ctx.lineTo(w-hl,h/2-6);
      ctx.lineTo(w-hl,h/2-hw); ctx.lineTo(w,h/2);
      ctx.lineTo(w-hl,h/2+hw); ctx.lineTo(w-hl,h/2+6);
      ctx.lineTo(0,h/2+6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    ctx.globalAlpha=1;
    if (el.showLabel&&el.label) {
      ctx.font=`bold ${Math.max(9,Math.min(16,h*0.22))}px "Plus Jakarta Sans",sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle=el.stroke||"#5b5bd6";
      ctx.fillText(el.label,w/2,h/2);
    }
    if (selected) {
      ctx.fillStyle="#5b5bd6";
      [[w,h],[w,0],[0,h]].forEach(([hx,hy])=>{
        ctx.beginPath(); ctx.arc(hx,hy,5/zoom,0,Math.PI*2); ctx.fill();
      });
    }
  }

  ctx.restore();
}
