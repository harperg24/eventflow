// ============================================================
//  src/pages/TicketScanner.jsx
//  Host-facing QR ticket scanner
//  Route: /scanner/:eventId  (add to App.jsx)
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import jsQR from "jsqr";

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  return new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

export default function TicketScanner() {
  const { eventId }   = useParams();
  const navigate      = useNavigate();
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const animRef       = useRef(null);
  const lastToken     = useRef(null);   // prevent double-scan
  const lastScanTime  = useRef(0);

  const [event,       setEvent]       = useState(null);
  const [scanning,    setScanning]    = useState(false);
  const [camError,    setCamError]    = useState(null);
  const [result,      setResult]      = useState(null);  // {status, name, tier, ticket_number, message}
  const [scanLog,     setScanLog]     = useState([]);    // recent scans
  const [stats,       setStats]       = useState({ total: 0, scanned: 0 });

  // Load event + stats
  useEffect(() => {
    const load = async () => {
      const { data: ev } = await supabase.from("events").select("name,date").eq("id", eventId).single();
      setEvent(ev);
      const { data: tix } = await supabase.from("tickets").select("id,checked_in").eq("event_id", eventId);
      if (tix) setStats({ total: tix.length, scanned: tix.filter(t => t.checked_in).length });
    };
    load();
  }, [eventId]);

  // Start camera
  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
      }
    } catch (e) {
      setCamError("Camera access denied. Please allow camera access and try again.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setScanning(false);
  }, []);

  // QR scan loop
  useEffect(() => {
    if (!scanning) return;
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    const video  = videoRef.current;

    const tick = () => {
      if (video?.readyState === video?.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const now = Date.now();
        if (now - lastScanTime.current > 2000) { // 2s debounce
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            const url = code.data;
            // Extract qr_token from URL: /ticket/:token
            const match = url.match(/\/ticket\/([a-f0-9]+)$/);
            if (match && match[1] !== lastToken.current) {
              lastToken.current = match[1];
              lastScanTime.current = now;
              handleScan(match[1]);
            }
          }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [scanning]);

  const handleScan = async (qrToken) => {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, ticket_tiers(name), events(name)")
      .eq("qr_token", qrToken)
      .eq("event_id", eventId)
      .single();

    if (!ticket) {
      setResult({ status: "invalid", message: "Ticket not found or belongs to a different event" });
      setTimeout(() => { setResult(null); lastToken.current = null; }, 4000);
      return;
    }

    if (ticket.checked_in) {
      setResult({
        status: "duplicate",
        name: ticket.ticket_orders?.buyer_name || "Guest",
        tier: ticket.ticket_tiers?.name,
        ticket_number: ticket.ticket_number,
        message: ticket.last_scanned_at ? `Already scanned ${timeAgo(ticket.last_scanned_at)}` : "Already checked in",
      });
      setTimeout(() => { setResult(null); lastToken.current = null; }, 4000);
      return;
    }

    // Valid — check in
    const now = new Date().toISOString();
    await supabase.from("tickets").update({
      checked_in: true,
      checked_in_at: now,
      last_scanned_at: now,
      scan_count: (ticket.scan_count || 0) + 1,
    }).eq("id", ticket.id);

    // Fetch buyer name from order
    const { data: order } = await supabase
      .from("ticket_orders").select("buyer_name").eq("id", ticket.order_id).single();

    const entry = {
      status: "valid",
      name: order?.buyer_name || "Guest",
      tier: ticket.ticket_tiers?.name || "General Admission",
      ticket_number: ticket.ticket_number,
      time: now,
    };

    setResult(entry);
    setScanLog(log => [entry, ...log.slice(0, 19)]); // keep last 20
    setStats(s => ({ ...s, scanned: s.scanned + 1 }));
    setTimeout(() => { setResult(null); lastToken.current = null; }, 3500);
  };

  const cfg = {
    valid:     { bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.4)",  color: "#10b981", icon: "✓" },
    duplicate: { bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.4)",  color: "#f59e0b", icon: "⚠" },
    invalid:   { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)",   color: "#ef4444", icon: "✕" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#06060e", fontFamily: "'DM Sans',sans-serif", color: "#e2d9cc" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#0a0a14", borderBottom: "1px solid #1e1e2e", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => { stopCamera(); navigate(-1); }}
          style={{ background: "none", border: "none", color: "#5a5a72", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ticket Scanner</div>
          {event && <div style={{ fontSize: 12, color: "#5a5a72" }}>{event.name}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{stats.scanned}</div>
          <div style={{ fontSize: 11, color: "#3a3a52" }}>of {stats.total} scanned</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#1a1a2e" }}>
        <div style={{ height: "100%", width: stats.total ? `${(stats.scanned/stats.total)*100}%` : "0%", background: "linear-gradient(90deg,#10b981,#059669)", transition: "width 0.4s" }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>

        {/* Camera viewfinder */}
        <div style={{ position: "relative", background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 16, overflow: "hidden", marginBottom: 16, aspectRatio: "4/3" }}>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: scanning ? "block" : "none" }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Scan overlay */}
          {scanning && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ width: 200, height: 200, position: "relative" }}>
                {/* Corner brackets */}
                {[["0,0","0,0"], ["auto,0","0,0"], ["0,auto","0,0"], ["auto,auto","0,0"]].map(([pos], i) => {
                  const top    = i < 2 ? 0 : "auto";
                  const bottom = i >= 2 ? 0 : "auto";
                  const left   = i % 2 === 0 ? 0 : "auto";
                  const right  = i % 2 === 1 ? 0 : "auto";
                  const br     = i === 0 ? "0 0 8px 0" : i === 1 ? "0 0 0 8px" : i === 2 ? "0 8px 0 0" : "8px 0 0 0";
                  return (
                    <div key={i} style={{ position: "absolute", top, bottom, left, right, width: 28, height: 28, border: "3px solid #c9a84c", borderRadius: br, borderTop: i >= 2 ? "none" : undefined, borderBottom: i < 2 ? "none" : undefined, borderLeft: i % 2 === 1 ? "none" : undefined, borderRight: i % 2 === 0 ? "none" : undefined }} />
                  );
                })}
                {/* Scan line */}
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: "rgba(201,168,76,0.6)", animation: "scanLine 2s ease-in-out infinite" }} />
              </div>
            </div>
          )}

          {/* Not scanning state */}
          {!scanning && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ fontSize: 48 }}>📷</div>
              <p style={{ color: "#5a5a72", fontSize: 14, textAlign: "center", margin: 0 }}>
                {camError || "Tap Start Scanner to begin"}
              </p>
              <button onClick={startCamera}
                style={{ background: "linear-gradient(135deg,#c9a84c,#a8872e)", color: "#080810", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                Start Scanner
              </button>
            </div>
          )}

          {/* Result overlay */}
          {result && (() => {
            const c = cfg[result.status];
            return (
              <div style={{ position: "absolute", inset: 0, background: c.bg, backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${c.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: c.color, background: "rgba(0,0,0,0.4)" }}>
                  {c.icon}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontFamily: "'Playfair Display',serif", marginBottom: 4 }}>
                    {result.status === "valid" ? "Valid Ticket" : result.status === "duplicate" ? "Already Scanned" : "Invalid Ticket"}
                  </div>
                  {result.name && <div style={{ fontSize: 16, color: "#e2d9cc", marginBottom: 2 }}>{result.name}</div>}
                  {result.tier && <div style={{ fontSize: 13, color: "#8a8278" }}>{result.tier} · {result.ticket_number}</div>}
                  {result.message && <div style={{ fontSize: 12, color: c.color, marginTop: 6, opacity: 0.8 }}>{result.message}</div>}
                </div>
              </div>
            );
          })()}
        </div>

        <style>{`
          @keyframes scanLine {
            0%   { top: 10%; opacity: 1; }
            50%  { top: 90%; opacity: 0.6; }
            100% { top: 10%; opacity: 1; }
          }
        `}</style>

        {/* Controls */}
        {scanning && (
          <button onClick={stopCamera}
            style={{ width: "100%", background: "none", border: "1px solid #1e1e2e", color: "#5a5a72", borderRadius: 10, padding: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginBottom: 16 }}>
            Stop Scanner
          </button>
        )}

        {/* Manual token entry */}
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontSize: 13, color: "#3a3a52", cursor: "pointer", userSelect: "none" }}>Manual entry</summary>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <input id="manual-token" placeholder="Paste ticket URL or token…"
              style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 8, padding: "9px 12px", color: "#e2d9cc", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
            <button onClick={() => {
              const val = document.getElementById("manual-token").value.trim();
              const match = val.match(/\/ticket\/([a-f0-9]+)/) || val.match(/^([a-f0-9]{32})$/);
              if (match) { handleScan(match[1]); document.getElementById("manual-token").value = ""; }
            }}
              style={{ background: "#c9a84c", color: "#080810", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              Check
            </button>
          </div>
        </details>

        {/* Scan log */}
        {scanLog.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "#3a3a52", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
              Recent Scans
            </div>
            <div style={{ background: "#0a0a14", border: "1px solid #1e1e2e", borderRadius: 12, overflow: "hidden" }}>
              {scanLog.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: i < scanLog.length - 1 ? "1px solid #0a0a14" : "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1.5px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#10b981", flexShrink: 0 }}>✓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.name}</div>
                    <div style={{ fontSize: 11, color: "#5a5a72" }}>{entry.tier} · {entry.ticket_number}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#3a3a52" }}>{timeAgo(entry.time)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
