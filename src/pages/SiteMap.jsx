// ============================================================
//  SiteMap.jsx — Event Site Map Creator
//  Canvas-based drag/drop map editor with shapes, icons, text
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ── Colour palette for zones ──────────────────────────────────
const ZONE_COLORS = {
  stage:     { fill: "rgba(139,92,246,0.18)", stroke: "#8b5cf6", label: "Stage" },
  fob:       { fill: "rgba(249,115,22,0.15)", stroke: "#f97316", label: "F&B / Bar" },
  parking:   { fill: "rgba(107,114,128,0.15)", stroke: "#6b7280", label: "Parking" },
  firstaid:  { fill: "rgba(239,68,68,0.15)",  stroke: "#ef4444", label: "First Aid" },
  toilets:   { fill: "rgba(59,130,246,0.15)", stroke: "#3b82f6", label: "Toilets" },
  entry:     { fill: "rgba(16,185,129,0.18)", stroke: "#10b981", label: "Entry / Exit" },
  emergency: { fill: "rgba(220,38,38,0.2)",   stroke: "#dc2626", label: "Emergency" },
  staff:     { fill: "rgba(245,158,11,0.15)", stroke: "#f59e0b", label: "Staff Only" },
  camping:   { fill: "rgba(5,150,105,0.12)",  stroke: "#059669", label: "Camping" },
  general:   { fill: "rgba(91,91,214,0.08)",  stroke: "#5b5bd6", label: "General Area" },
  custom:    { fill: "rgba(156,163,175,0.15)", stroke: "#9ca3af", label: "Custom" },
};

// ── POI icons ─────────────────────────────────────────────────
const POI_TYPES = [
  { id: "stage",     emoji: "🎤", label: "Stage" },
  { id: "mainstage", emoji: "🎪", label: "Main Stage" },
  { id: "food",      emoji: "🍔", label: "Food" },
  { id: "bar",       emoji: "🍺", label: "Bar" },
  { id: "toilet",    emoji: "🚻", label: "Toilets" },
  { id: "firstaid",  emoji: "🏥", label: "First Aid" },
  { id: "parking",   emoji: "🅿️", label: "Parking" },
  { id: "exit",      emoji: "🚨", label: "Emergency Exit" },
  { id: "security",  emoji: "👮", label: "Security" },
  { id: "accessible",emoji: "♿", label: "Accessible" },
  { id: "bins",      emoji: "🗑️", label: "Bins" },
  { id: "water",     emoji: "💧", label: "Water" },
  { id: "tickets",   emoji: "🎟️", label: "Tickets" },
  { id: "info",      emoji: "ℹ️",  label: "Info" },
  { id: "camera",    emoji: "📷", label: "Camera / Media" },
  { id: "wifi",      emoji: "📶", label: "WiFi Zone" },
  { id: "generator", emoji: "⚡", label: "Generator" },
  { id: "tent",      emoji: "⛺", label: "Tent" },
  { id: "bus",       emoji: "🚌", label: "Bus / Shuttle" },
  { id: "vip",       emoji: "⭐", label: "VIP Area" },
];

const SHAPE_TYPES = ["rect", "circle", "triangle", "arrow", "text", "poi"];

// ── Shared styles ─────────────────────────────────────────────
const S = {
  btn: { background:"var(--accent)", border:"none", color:"#fff", borderRadius:8, padding:"7px 14px",
         fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  ghost: { background:"none", border:"1.5px solid var(--border)", color:"var(--text2)",
           borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  inp: { width:"100%", boxSizing:"border-box", background:"var(--bg3)", border:"1.5px solid var(--border)",
         borderRadius:8, padding:"8px 11px", color:"var(--text)", fontSize:13, outline:"none", fontFamily:"inherit" },
};

// ── Utility ───────────────────────────────────────────────────
const newId = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Main component ────────────────────────────────────────────
export default function SiteMap({ eventId, event }) {
  const [maps, setMaps]         = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingMap, setEditingMap] = useState(null);

  // Load all maps for this event
  useEffect(() => {
    supabase.from("site_maps").select("*").eq("event_id", eventId).order("created_at")
      .then(({ data }) => { setMaps(data || []); setLoading(false); });
  }, [eventId]);

  const createMap = async (name) => {
    const row = { event_id: eventId, name, elements: [], canvas_bg: "#f8f8f0", width: 1200, height: 800 };
    const { data, error } = await supabase.from("site_maps").insert(row).select().single();
    if (error) { alert("Failed: " + error.message); return; }
    setMaps(m => [...m, data]);
    setActiveMapId(data.id);
    setShowEditor(true);
  };

  const saveMap = async (id, elements, meta) => {
    const { error } = await supabase.from("site_maps").update({ elements, ...meta }).eq("id", id);
    if (error) { alert("Save failed: " + error.message); return; }
    setMaps(m => m.map(x => x.id === id ? { ...x, elements, ...meta } : x));
  };

  const deleteMap = async (id) => {
    if (!window.confirm("Delete this site map?")) return;
    const { error } = await supabase.from("site_maps").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setMaps(m => m.filter(x => x.id !== id));
    if (activeMapId === id) { setActiveMapId(null); setShowEditor(false); }
  };

  const openMap = (map) => { setActiveMapId(map.id); setShowEditor(true); };

  const activeMap = maps.find(m => m.id === activeMapId);

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>Loading…</div>;

  if (showEditor && activeMap) {
    return (
      <CanvasEditor
        map={activeMap}
        onSave={(elements, meta) => saveMap(activeMap.id, elements, meta)}
        onBack={() => setShowEditor(false)}
      />
    );
  }

  return (
    <div className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.04em", marginBottom:4 }}>Site Maps</h1>
          <p style={{ color:"var(--text2)", fontSize:14, margin:0 }}>Design, annotate and manage your event layout</p>
        </div>
        <button onClick={() => setEditingMap({})} style={S.btn}>+ New Map</button>
      </div>

      {maps.length === 0 && (
        <div style={{ textAlign:"center", padding:"72px 20px", background:"var(--bg2)",
          border:"1.5px solid var(--border)", borderRadius:16 }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🗺️</div>
          <h3 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>No site maps yet</h3>
          <p style={{ color:"var(--text2)", fontSize:14, maxWidth:380, margin:"0 auto 24px", lineHeight:1.6 }}>
            Create a visual layout of your event — zones, stages, entrances, first aid, parking, and more.
          </p>
          <button onClick={() => setEditingMap({})} style={S.btn}>+ Create First Map</button>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {maps.map(m => (
          <div key={m.id} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)",
            borderRadius:14, overflow:"hidden", cursor:"pointer", transition:"border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
            {/* Mini preview */}
            <div onClick={() => openMap(m)}
              style={{ height:140, background: m.canvas_bg || "#f8f8f0", position:"relative",
                display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
              <MapThumbnail map={m} />
              <div style={{ position:"absolute", inset:0, background:"transparent" }} />
            </div>
            <div style={{ padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{m.name}</div>
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>
                  {(m.elements||[]).length} element{(m.elements||[]).length !== 1 ? "s" : ""} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("en-NZ")}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => openMap(m)} style={{ ...S.ghost, fontSize:12, padding:"5px 10px",
                  color:"var(--accent)", borderColor:"var(--accentBg)" }}>Open</button>
                <button onClick={() => deleteMap(m.id)}
                  style={{ ...S.ghost, fontSize:12, padding:"5px 8px", color:"#dc2626", borderColor:"rgba(220,38,38,0.2)" }}>✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New map modal */}
      {editingMap !== null && (
        <NewMapModal onCreate={createMap} onClose={() => setEditingMap(null)} />
      )}
    </div>
  );
}

// ── Thumbnail renderer ────────────────────────────────────────
function MapThumbnail({ map }) {
  const ref = useRef();
  const W = 280, H = 140;
  const mw = map.width || 1200, mh = map.height || 800;
  const scale = Math.min(W / mw, H / mh);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = map.canvas_bg || "#f8f8f0";
    ctx.fillRect(0, 0, W, H);
    const ox = (W - mw * scale) / 2, oy = (H - mh * scale) / 2;
    (map.elements || []).forEach(el => drawElement(ctx, el, scale, ox, oy));
  }, [map]);

  return <canvas ref={ref} width={W} height={H} style={{ display:"block" }} />;
}

// ── New map modal ─────────────────────────────────────────────
function NewMapModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  const [size, setSize]  = useState("medium");
  const SIZES = { small: [800,600], medium: [1200,800], large: [1800,1200], xl: [2400,1600] };

  const submit = () => {
    if (!name.trim()) return;
    const [w, h] = SIZES[size];
    onCreate(name.trim(), w, h);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center" }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:16,
        padding:"28px 28px", width:400, boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize:18, fontWeight:800, marginBottom:20 }}>New Site Map</h3>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase",
            letterSpacing:"0.07em", display:"block", marginBottom:6 }}>Map Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={S.inp} autoFocus
            placeholder="e.g. Main Venue Layout, Stage Area" onKeyDown={e => e.key==="Enter" && submit()} />
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase",
            letterSpacing:"0.07em", display:"block", marginBottom:8 }}>Canvas Size</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {Object.entries(SIZES).map(([key, [w, h]]) => (
              <button key={key} onClick={() => setSize(key)}
                style={{ background: size===key ? "var(--accentBg)" : "var(--bg3)",
                  border:`1.5px solid ${size===key ? "var(--accent)" : "var(--border)"}`,
                  borderRadius:9, padding:"10px", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", textTransform:"capitalize" }}>{key}</div>
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{w} × {h}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ ...S.ghost, flex:1 }}>Cancel</button>
          <button onClick={submit} disabled={!name.trim()}
            style={{ ...S.btn, flex:2, opacity: name.trim() ? 1 : 0.4 }}>Create Map</button>
        </div>
      </div>
    </div>
  );
}

// ── Canvas Editor ─────────────────────────────────────────────
function CanvasEditor({ map, onSave, onBack }) {
  const canvasRef      = useRef();
  const overlayRef     = useRef();
  const animRef        = useRef();
  const [elements, setElements] = useState(map.elements || []);
  const [tool, setTool]         = useState("select"); // select | rect | circle | triangle | arrow | text | poi
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom]         = useState(0.7);
  const [pan, setPan]           = useState({ x: 40, y: 40 });
  const [dragging, setDragging] = useState(null); // { id, startX, startY, origX, origY } | "pan" info
  const [resizing, setResizing] = useState(null);
  const [drawing, setDrawing]   = useState(null); // { x, y, w, h } while rubber-band drawing
  const [panStart, setPanStart] = useState(null);
  const [snapGrid, setSnapGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showPanel, setShowPanel] = useState(true);
  const [canvasBg, setCanvasBg] = useState(map.canvas_bg || "#f8f8f0");
  const [zoneType, setZoneType] = useState("general");
  const [poiType, setPoiType]   = useState("stage");
  const [dirty, setDirty]       = useState(false);
  const [saving, setSaving]     = useState(false);

  const CANVAS_W = map.width  || 1200;
  const CANVAS_H = map.height || 800;
  const GRID     = 20;

  const snap = useCallback((v) => snapGrid ? Math.round(v / GRID) * GRID : v, [snapGrid]);

  // ── Draw loop ────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = canvasBg;
    ctx.fillRect(pan.x * dpr, pan.y * dpr, CANVAS_W * zoom * dpr, CANVAS_H * zoom * dpr);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      const gs = GRID * zoom * dpr;
      for (let x = 0; x <= CANVAS_W; x += GRID) {
        ctx.beginPath();
        ctx.moveTo(pan.x * dpr + x * zoom * dpr, pan.y * dpr);
        ctx.lineTo(pan.x * dpr + x * zoom * dpr, pan.y * dpr + CANVAS_H * zoom * dpr);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_H; y += GRID) {
        ctx.beginPath();
        ctx.moveTo(pan.x * dpr, pan.y * dpr + y * zoom * dpr);
        ctx.lineTo(pan.x * dpr + CANVAS_W * zoom * dpr, pan.y * dpr + y * zoom * dpr);
        ctx.stroke();
      }
    }

    // Canvas border
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pan.x * dpr, pan.y * dpr, CANVAS_W * zoom * dpr, CANVAS_H * zoom * dpr);

    // Elements
    elements.forEach(el => {
      const selected = el.id === selectedId;
      drawElement(ctx, el, zoom, pan.x, pan.y, selected, dpr);
    });

    // Rubber-band drawing preview
    if (drawing && (tool === "rect" || tool === "circle" || tool === "triangle" || tool === "arrow")) {
      const { x, y, w, h } = drawing;
      ctx.save();
      ctx.translate((pan.x + x * zoom) * dpr, (pan.y + y * zoom) * dpr);
      ctx.scale(zoom * dpr, zoom * dpr);
      const zc = ZONE_COLORS[zoneType] || ZONE_COLORS.custom;
      ctx.fillStyle = zc.fill;
      ctx.strokeStyle = zc.stroke;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      if (tool === "rect") {
        ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.fill(); ctx.stroke();
      } else if (tool === "circle") {
        ctx.beginPath(); ctx.ellipse(w/2, h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }, [elements, selectedId, zoom, pan, drawing, tool, showGrid, canvasBg, zoneType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // ── Coordinate helpers ────────────────────────────────────────
  const toCanvas = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    };
  };

  const hitTest = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "poi" || el.type === "text") {
        if (Math.abs(x - el.x) < 24 && Math.abs(y - el.y) < 24) return el;
      } else {
        const r = Math.min(el.w || 0, el.h || 0);
        if (x >= el.x && x <= el.x + (el.w||0) && y >= el.y && y <= el.y + (el.h||0)) return el;
      }
    }
    return null;
  };

  const resizeHandles = (el) => {
    if (!el || el.type === "poi" || el.type === "text") return [];
    return [
      { pos:"br", x: el.x + (el.w||0), y: el.y + (el.h||0) },
      { pos:"tr", x: el.x + (el.w||0), y: el.y },
      { pos:"bl", x: el.x,              y: el.y + (el.h||0) },
    ];
  };

  const hitHandle = (x, y, el) => {
    const HANDLE = 10 / zoom;
    for (const h of resizeHandles(el)) {
      if (Math.abs(x - h.x) < HANDLE && Math.abs(y - h.y) < HANDLE) return h.pos;
    }
    return null;
  };

  // ── Pointer events ────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan
      setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
      canvasRef.current.style.cursor = "grabbing";
      return;
    }
    const { x, y } = toCanvas(e.clientX, e.clientY);

    if (tool === "select") {
      const sel = elements.find(el => el.id === selectedId);
      if (sel) {
        const h = hitHandle(x, y, sel);
        if (h) {
          setResizing({ id: sel.id, handle: h, origEl: { ...sel }, startX: x, startY: y });
          return;
        }
      }
      const hit = hitTest(x, y);
      if (hit) {
        setSelectedId(hit.id);
        setDragging({ id: hit.id, startX: x, startY: y, origX: hit.x, origY: hit.y });
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "text") {
      const label = window.prompt("Enter text:", "Label");
      if (!label) return;
      const el = { id: newId(), type: "text", x: snap(x), y: snap(y), text: label,
        fontSize: 14, fontWeight: "bold", color: "#1d1d1f", align: "left" };
      setElements(prev => [...prev, el]);
      setSelectedId(el.id);
      setDirty(true);
      return;
    }

    if (tool === "poi") {
      const pt = POI_TYPES.find(p => p.id === poiType) || POI_TYPES[0];
      const el = { id: newId(), type: "poi", poiType, emoji: pt.emoji, label: pt.label,
        x: snap(x), y: snap(y) };
      setElements(prev => [...prev, el]);
      setSelectedId(el.id);
      setDirty(true);
      return;
    }

    // Rubber-band shapes
    setDrawing({ x: snap(x), y: snap(y), w: 0, h: 0 });
  }, [tool, elements, selectedId, zoom, pan, snap, poiType]);

  const onPointerMove = useCallback((e) => {
    if (panStart) {
      setPan({ x: panStart.px + e.clientX - panStart.mx, y: panStart.py + e.clientY - panStart.my });
      return;
    }

    const { x, y } = toCanvas(e.clientX, e.clientY);

    if (dragging) {
      const dx = x - dragging.startX, dy = y - dragging.startY;
      setElements(prev => prev.map(el =>
        el.id === dragging.id ? { ...el, x: snap(dragging.origX + dx), y: snap(dragging.origY + dy) } : el
      ));
      setDirty(true);
      return;
    }

    if (resizing) {
      const { id, handle, origEl, startX, startY } = resizing;
      const dx = x - startX, dy = y - startY;
      setElements(prev => prev.map(el => {
        if (el.id !== id) return el;
        let { x: ex, y: ey, w, h } = origEl;
        if (handle === "br") { w = snap(Math.max(20, origEl.w + dx)); h = snap(Math.max(20, origEl.h + dy)); }
        if (handle === "tr") { w = snap(Math.max(20, origEl.w + dx)); ey = snap(origEl.y + dy); h = snap(Math.max(20, origEl.h - dy)); }
        if (handle === "bl") { ex = snap(origEl.x + dx); w = snap(Math.max(20, origEl.w - dx)); h = snap(Math.max(20, origEl.h + dy)); }
        return { ...el, x: ex, y: ey, w, h };
      }));
      setDirty(true);
      return;
    }

    if (drawing) {
      const sx = drawing.x, sy = drawing.y;
      setDrawing({ x: sx, y: sy, w: snap(x) - sx, h: snap(y) - sy });
    }
  }, [panStart, dragging, resizing, drawing, snap]);

  const onPointerUp = useCallback((e) => {
    if (panStart) { setPanStart(null); canvasRef.current.style.cursor = ""; return; }
    if (dragging) { setDragging(null); return; }
    if (resizing) { setResizing(null); return; }

    if (drawing) {
      const { x, y, w, h } = drawing;
      const aw = Math.abs(w), ah = Math.abs(h);
      if (aw > 10 && ah > 10) {
        const zc = ZONE_COLORS[zoneType] || ZONE_COLORS.custom;
        const el = {
          id: newId(), type: tool, zoneType,
          x: w < 0 ? x + w : x, y: h < 0 ? y + h : y,
          w: aw, h: ah,
          fill: zc.fill, stroke: zc.stroke,
          label: zc.label, showLabel: true, opacity: 1,
        };
        setElements(prev => [...prev, el]);
        setSelectedId(el.id);
        setDirty(true);
      }
      setDrawing(null);
    }
  }, [panStart, dragging, resizing, drawing, tool, zoneType]);

  // Wheel zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => clamp(z * delta, 0.15, 3));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null); setDirty(true);
      }
      if (e.key === "Escape") { setSelectedId(null); setTool("select"); }
      if (e.key === "v") setTool("select");
      if (e.key === "r") setTool("rect");
      if (e.key === "c") setTool("circle");
      if (e.key === "t") setTool("text");
      if (e.key === "p") setTool("poi");
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        // Simple undo — just reload from last save state
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    await onSave(elements, { canvas_bg: canvasBg });
    setSaving(false); setDirty(false);
  };

  // ── Export PNG ────────────────────────────────────────────────
  const exportPng = () => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = canvasBg; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    elements.forEach(el => drawElement(ctx, el, 1, 0, 0, false, 1));
    const link = document.createElement("a");
    link.download = `${map.name || "site-map"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const selected = elements.find(el => el.id === selectedId);

  const toolBtn = (t, icon, tip, key) => (
    <button title={`${tip} (${key})`} onClick={() => setTool(t)}
      style={{ width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center",
        background: tool===t ? "var(--accent)" : "var(--bg3)",
        border: `1.5px solid ${tool===t ? "var(--accent)" : "var(--border)"}`,
        borderRadius:9, cursor:"pointer", fontSize:16, transition:"all 0.12s",
        color: tool===t ? "#fff" : "var(--text2)" }}>
      {icon}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 120px)", minHeight:600 }}>
      {/* ── Top bar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", marginBottom:8,
        borderBottom:"1.5px solid var(--border)", flexShrink:0, flexWrap:"wrap" }}>
        <button onClick={onBack} style={{ ...S.ghost, fontSize:13 }}>← Maps</button>
        <div style={{ fontWeight:700, fontSize:15, color:"var(--text)", flex:1 }}>{map.name}</div>

        {/* Tools */}
        <div style={{ display:"flex", gap:5 }}>
          {toolBtn("select",   "↖",  "Select",   "V")}
          {toolBtn("rect",     "▭",  "Rectangle","R")}
          {toolBtn("circle",   "○",  "Ellipse",  "C")}
          {toolBtn("triangle", "△",  "Triangle", "G")}
          {toolBtn("arrow",    "→",  "Arrow",    "A")}
          {toolBtn("text",     "T",  "Text",     "T")}
          {toolBtn("poi",      "📍", "POI",      "P")}
        </div>

        {/* Zoom */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={() => setZoom(z => clamp(z/1.2, 0.15, 3))} style={{ ...S.ghost, padding:"5px 9px" }}>−</button>
          <span style={{ fontSize:12, color:"var(--text2)", minWidth:40, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => clamp(z*1.2, 0.15, 3))} style={{ ...S.ghost, padding:"5px 9px" }}>+</button>
          <button onClick={() => { setZoom(0.7); setPan({x:40,y:40}); }} style={{ ...S.ghost, fontSize:11, padding:"5px 9px" }}>⌂</button>
        </div>

        {/* Grid toggle */}
        <button onClick={() => setShowGrid(g => !g)}
          style={{ ...S.ghost, fontSize:12, padding:"5px 10px",
            color: showGrid ? "var(--accent)" : "var(--text3)",
            borderColor: showGrid ? "var(--accentBg)" : "var(--border)" }}>
          ⊞ Grid
        </button>
        <button onClick={() => setSnapGrid(s => !s)}
          style={{ ...S.ghost, fontSize:12, padding:"5px 10px",
            color: snapGrid ? "var(--accent)" : "var(--text3)",
            borderColor: snapGrid ? "var(--accentBg)" : "var(--border)" }}>
          🧲 Snap
        </button>

        <button onClick={exportPng} style={{ ...S.ghost, fontSize:12 }}>↓ PNG</button>
        <button onClick={handleSave} disabled={!dirty || saving}
          style={{ ...S.btn, fontSize:13, opacity: (!dirty || saving) ? 0.5 : 1 }}>
          {saving ? "Saving…" : dirty ? "Save ●" : "Saved ✓"}
        </button>
      </div>

      <div style={{ display:"flex", flex:1, gap:0, overflow:"hidden" }}>
        {/* ── Left sidebar: shape tools ── */}
        <div style={{ width:188, flexShrink:0, overflowY:"auto", padding:"12px 10px",
          borderRight:"1.5px solid var(--border)", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Zone type (for rect/circle/triangle) */}
          {(tool==="rect"||tool==="circle"||tool==="triangle") && (
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
                letterSpacing:"0.08em", marginBottom:8 }}>Zone Type</div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {Object.entries(ZONE_COLORS).map(([key, zc]) => (
                  <button key={key} onClick={() => setZoneType(key)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                      background: zoneType===key ? zc.fill : "none",
                      border: `1.5px solid ${zoneType===key ? zc.stroke : "var(--border)"}`,
                      borderRadius:7, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                    <div style={{ width:12, height:12, borderRadius:3, background:zc.stroke, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:"var(--text)", fontWeight: zoneType===key ? 700 : 400 }}>
                      {zc.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* POI picker */}
          {tool==="poi" && (
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
                letterSpacing:"0.08em", marginBottom:8 }}>POI Type</div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {POI_TYPES.map(pt => (
                  <button key={pt.id} onClick={() => setPoiType(pt.id)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                      background: poiType===pt.id ? "var(--accentBg)" : "none",
                      border: `1.5px solid ${poiType===pt.id ? "var(--accent)" : "var(--border)"}`,
                      borderRadius:7, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                    <span style={{ fontSize:16 }}>{pt.emoji}</span>
                    <span style={{ fontSize:12, color:"var(--text)", fontWeight: poiType===pt.id ? 700 : 400 }}>{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Canvas background */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:8 }}>Background</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["#f8f8f0","#ffffff","#1a1a2e","#0f2027","#e8f4f8","#f0f4e8"].map(c => (
                <button key={c} onClick={() => { setCanvasBg(c); setDirty(true); }}
                  title={c} style={{ width:24, height:24, borderRadius:6, background:c, cursor:"pointer",
                    border:`2px solid ${canvasBg===c ? "var(--accent)" : "var(--border)"}` }} />
              ))}
              <input type="color" value={canvasBg} onChange={e => { setCanvasBg(e.target.value); setDirty(true); }}
                style={{ width:24, height:24, borderRadius:6, border:"1.5px solid var(--border)",
                  cursor:"pointer", padding:0, background:"none" }} title="Custom colour" />
            </div>
          </div>

          {/* Legend */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase",
              letterSpacing:"0.08em", marginBottom:8 }}>Legend</div>
            {Object.values(ZONE_COLORS).filter(zc =>
              elements.some(el => el.fill === zc.fill)
            ).map(zc => (
              <div key={zc.label} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div style={{ width:12, height:12, borderRadius:2, background:zc.stroke, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"var(--text2)" }}>{zc.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas ── */}
        <div style={{ flex:1, overflow:"hidden", position:"relative", background:"var(--bg3)",
          backgroundImage:"radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize:"20px 20px", cursor: tool==="select" ? "default" : "crosshair" }}>
          <canvas ref={canvasRef}
            style={{ width:"100%", height:"100%", display:"block",
              cursor: panStart ? "grabbing" : tool==="select" ? "default" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          {/* Hint */}
          <div style={{ position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)",
            fontSize:11, color:"var(--text3)", background:"var(--bg2)", border:"1px solid var(--border)",
            borderRadius:20, padding:"4px 12px", pointerEvents:"none", whiteSpace:"nowrap" }}>
            {tool==="select" ? "Click to select · Drag to move · Alt+drag to pan · Scroll to zoom · Del to delete"
              : tool==="poi"  ? "Click to place POI"
              : tool==="text" ? "Click to add text"
              : "Click and drag to draw · Scroll to zoom"}
          </div>
        </div>

        {/* ── Right panel: properties ── */}
        {showPanel && selected && (
          <ElementPanel
            el={selected}
            onChange={(patch) => {
              setElements(prev => prev.map(el => el.id === selected.id ? { ...el, ...patch } : el));
              setDirty(true);
            }}
            onDelete={() => {
              setElements(prev => prev.filter(el => el.id !== selected.id));
              setSelectedId(null); setDirty(true);
            }}
            onDuplicate={() => {
              const clone = { ...selected, id: newId(), x: selected.x + 20, y: selected.y + 20 };
              setElements(prev => [...prev, clone]);
              setSelectedId(clone.id); setDirty(true);
            }}
            onMoveLayer={(dir) => {
              setElements(prev => {
                const idx = prev.findIndex(el => el.id === selected.id);
                if (idx < 0) return prev;
                const arr = [...prev];
                const [el] = arr.splice(idx, 1);
                arr.splice(dir === "up" ? Math.min(arr.length, idx+1) : Math.max(0, idx-1), 0, el);
                return arr;
              });
              setDirty(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Element properties panel ──────────────────────────────────
function ElementPanel({ el, onChange, onDelete, onDuplicate, onMoveLayer }) {
  const isZone = el.type === "rect" || el.type === "circle" || el.type === "triangle";
  const isPoi  = el.type === "poi";
  const isText = el.type === "text";

  return (
    <div style={{ width:220, flexShrink:0, overflowY:"auto", padding:"14px 12px",
      borderLeft:"1.5px solid var(--border)", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.08em" }}>
        Properties
      </div>

      {/* Position & size */}
      <div>
        <div style={{ fontSize:10, color:"var(--text3)", fontWeight:700, marginBottom:6,
          textTransform:"uppercase", letterSpacing:"0.06em" }}>Position</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {[["X", "x"], ["Y", "y"]].map(([l, k]) => (
            <div key={k}>
              <label style={{ fontSize:10, color:"var(--text3)", display:"block", marginBottom:3 }}>{l}</label>
              <input type="number" value={Math.round(el[k] || 0)}
                onChange={e => onChange({ [k]: parseInt(e.target.value) || 0 })}
                style={{ ...S.inp, padding:"5px 8px", fontSize:12 }} />
            </div>
          ))}
        </div>
      </div>

      {isZone && (
        <div>
          <div style={{ fontSize:10, color:"var(--text3)", fontWeight:700, marginBottom:6,
            textTransform:"uppercase", letterSpacing:"0.06em" }}>Size</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {[["W", "w"], ["H", "h"]].map(([l, k]) => (
              <div key={k}>
                <label style={{ fontSize:10, color:"var(--text3)", display:"block", marginBottom:3 }}>{l}</label>
                <input type="number" value={Math.round(el[k] || 0)}
                  onChange={e => onChange({ [k]: Math.max(10, parseInt(e.target.value) || 10) })}
                  style={{ ...S.inp, padding:"5px 8px", fontSize:12 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Label */}
      <div>
        <label style={{ fontSize:10, color:"var(--text3)", fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.06em", display:"block", marginBottom:6 }}>Label</label>
        <input value={el.label || ""} onChange={e => onChange({ label: e.target.value })}
          style={{ ...S.inp, fontSize:13 }} placeholder="Label text" />
        {!isText && (
          <label style={{ display:"flex", alignItems:"center", gap:7, marginTop:7, cursor:"pointer" }}>
            <input type="checkbox" checked={!!el.showLabel}
              onChange={e => onChange({ showLabel: e.target.checked })}
              style={{ accentColor:"var(--accent)", cursor:"pointer" }} />
            <span style={{ fontSize:12, color:"var(--text2)" }}>Show label</span>
          </label>
        )}
      </div>

      {/* Colour controls */}
      {isZone && (
        <div>
          <div style={{ fontSize:10, color:"var(--text3)", fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.06em", marginBottom:8 }}>Zone Type</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {Object.entries(ZONE_COLORS).map(([key, zc]) => (
              <button key={key} onClick={() => onChange({ zoneType:key, fill:zc.fill, stroke:zc.stroke, label:el.label||zc.label })}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px",
                  background: el.zoneType===key ? zc.fill : "none",
                  border:`1.5px solid ${el.zoneType===key ? zc.stroke : "var(--border)"}`,
                  borderRadius:6, cursor:"pointer", fontFamily:"inherit" }}>
                <div style={{ width:10, height:10, borderRadius:2, background:zc.stroke, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"var(--text)" }}>{zc.label}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop:10 }}>
            <label style={{ fontSize:10, color:"var(--text3)", display:"block", marginBottom:4 }}>Opacity</label>
            <input type="range" min="0.1" max="1" step="0.05"
              value={el.opacity ?? 1}
              onChange={e => onChange({ opacity: parseFloat(e.target.value) })}
              style={{ width:"100%", accentColor:"var(--accent)" }} />
          </div>
        </div>
      )}

      {isPoi && (
        <div>
          <div style={{ fontSize:10, color:"var(--text3)", fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.06em", marginBottom:8 }}>POI Type</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
            {POI_TYPES.map(pt => (
              <button key={pt.id} onClick={() => onChange({ poiType:pt.id, emoji:pt.emoji, label:pt.label })}
                style={{ padding:"5px", background: el.poiType===pt.id ? "var(--accentBg)" : "none",
                  border:`1.5px solid ${el.poiType===pt.id ? "var(--accent)" : "var(--border)"}`,
                  borderRadius:6, cursor:"pointer", fontFamily:"inherit", display:"flex",
                  alignItems:"center", gap:5 }}>
                <span style={{ fontSize:14 }}>{pt.emoji}</span>
                <span style={{ fontSize:10, color:"var(--text2)" }}>{pt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isText && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div>
            <label style={{ fontSize:10, color:"var(--text3)", display:"block", marginBottom:4 }}>Font size</label>
            <input type="number" min={8} max={120} value={el.fontSize || 14}
              onChange={e => onChange({ fontSize: parseInt(e.target.value) || 14 })}
              style={{ ...S.inp, padding:"5px 8px", fontSize:12 }} />
          </div>
          <div>
            <label style={{ fontSize:10, color:"var(--text3)", display:"block", marginBottom:4 }}>Colour</label>
            <input type="color" value={el.color || "#1d1d1f"}
              onChange={e => onChange({ color: e.target.value })}
              style={{ width:"100%", height:32, borderRadius:8, border:"1.5px solid var(--border)", cursor:"pointer", padding:2 }} />
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer" }}>
            <input type="checkbox" checked={el.fontWeight === "bold"}
              onChange={e => onChange({ fontWeight: e.target.checked ? "bold" : "normal" })}
              style={{ accentColor:"var(--accent)" }} />
            <span style={{ fontSize:12, color:"var(--text2)" }}>Bold</span>
          </label>
        </div>
      )}

      {/* Layer controls */}
      <div>
        <div style={{ fontSize:10, color:"var(--text3)", fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.06em", marginBottom:8 }}>Layer</div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => onMoveLayer("up")} style={{ ...S.ghost, flex:1, fontSize:12 }}>▲ Fwd</button>
          <button onClick={() => onMoveLayer("down")} style={{ ...S.ghost, flex:1, fontSize:12 }}>▼ Back</button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:"auto" }}>
        <button onClick={onDuplicate} style={{ ...S.ghost, fontSize:12 }}>⧉ Duplicate</button>
        <button onClick={onDelete}
          style={{ ...S.ghost, fontSize:12, color:"#dc2626", borderColor:"rgba(220,38,38,0.25)" }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ── Shared draw function (used by canvas + thumbnail) ─────────
function drawElement(ctx, el, zoom, ox, oy, selected = false, dpr = 1) {
  ctx.save();
  ctx.translate((ox + el.x * zoom) * dpr, (oy + el.y * zoom) * dpr);
  ctx.scale(zoom * dpr, zoom * dpr);

  if (el.type === "poi") {
    // Draw circle background
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "rgba(91,91,214,0.25)" : "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.strokeStyle = selected ? "var(--accent)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = selected ? 2 / zoom : 1 / zoom;
    ctx.stroke();
    // Emoji
    ctx.font = `${14 / zoom > 18 ? 18 : 14}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText(el.emoji || "📍", 0, 0);
    // Label below
    if (el.label) {
      ctx.font = `bold ${10}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillText(el.label, 0, 22);
    }
  } else if (el.type === "text") {
    ctx.font = `${el.fontWeight || "bold"} ${el.fontSize || 14}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = el.color || "#1d1d1f";
    ctx.textBaseline = "top";
    ctx.fillText(el.text || el.label || "", 0, 0);
    if (selected) {
      const m = ctx.measureText(el.text || el.label || "");
      ctx.strokeStyle = "var(--accent)"; ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([3/zoom, 3/zoom]);
      ctx.strokeRect(-2, -2, m.width + 4, (el.fontSize || 14) + 4);
      ctx.setLineDash([]);
    }
  } else {
    const w = el.w || 100, h = el.h || 60;
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.fillStyle   = el.fill   || "rgba(91,91,214,0.15)";
    ctx.strokeStyle = el.stroke || "#5b5bd6";
    ctx.lineWidth   = selected ? 2.5 / zoom : 1.5 / zoom;

    if (el.type === "rect") {
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (el.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(w/2, h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    } else if (el.type === "triangle") {
      ctx.beginPath();
      ctx.moveTo(w/2, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (el.type === "arrow") {
      const hw = 12, hl = 18;
      ctx.beginPath();
      ctx.moveTo(0, h/2 - 6); ctx.lineTo(w - hl, h/2 - 6);
      ctx.lineTo(w - hl, h/2 - hw); ctx.lineTo(w, h/2);
      ctx.lineTo(w - hl, h/2 + hw); ctx.lineTo(w - hl, h/2 + 6);
      ctx.lineTo(0, h/2 + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Label
    if (el.showLabel && el.label) {
      ctx.font = `bold ${Math.max(10, Math.min(16, h * 0.22))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = el.stroke || "#5b5bd6";
      ctx.fillText(el.label, w / 2, h / 2);
    }

    // Selection handles
    if (selected) {
      ctx.fillStyle = "var(--accent)";
      [[w, h], [w, 0], [0, h]].forEach(([hx, hy]) => {
        ctx.beginPath(); ctx.arc(hx, hy, 5 / zoom, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  ctx.restore();
}
