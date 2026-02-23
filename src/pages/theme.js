// ============================================================
//  theme.js  —  EventFlow unified design system
//  Import this in every page: import { getTheme, ThemeStyles } from "./theme"
// ============================================================

export const ACCENTS = [
  { name: "Indigo",   value: "#4f46e5" },
  { name: "Blue",     value: "#2563eb" },
  { name: "Violet",   value: "#7c3aed" },
  { name: "Emerald",  value: "#059669" },
  { name: "Rose",     value: "#e11d48" },
  { name: "Amber",    value: "#d97706" },
  { name: "Slate",    value: "#475569" },
];

// Read stored theme from localStorage
export function loadThemePrefs() {
  try {
    const raw = localStorage.getItem("ef_theme");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mode: "light", accent: "#4f46e5", legacyDark: false };
}

export function saveThemePrefs(prefs) {
  localStorage.setItem("ef_theme", JSON.stringify(prefs));
  applyThemeToDOM(prefs);
}

export function applyThemeToDOM(prefs) {
  const root = document.documentElement;
  const t = getTheme(prefs);
  root.style.setProperty("--bg",        t.bg);
  root.style.setProperty("--bg2",       t.bg2);
  root.style.setProperty("--bg3",       t.bg3);
  root.style.setProperty("--border",    t.border);
  root.style.setProperty("--text",      t.text);
  root.style.setProperty("--text2",     t.text2);
  root.style.setProperty("--text3",     t.text3);
  root.style.setProperty("--accent",    t.accent);
  root.style.setProperty("--accentBg",  t.accentBg);
  root.style.setProperty("--accentBorder", t.accentBorder);
  root.style.setProperty("--shadow",    t.shadow);
  root.style.setProperty("--shadowLg",  t.shadowLg);
  root.style.setProperty("--radius",    t.radius);
  root.style.setProperty("--sidebar",   t.sidebar);
  root.style.setProperty("--success",   "#059669");
  root.style.setProperty("--danger",    "#dc2626");
  root.style.setProperty("--warning",   "#d97706");
  if (prefs.mode === "dark" && !prefs.legacyDark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (prefs.legacyDark) {
    document.documentElement.setAttribute("data-theme", "legacy");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
  }
}

export function getTheme(prefs) {
  const accent = prefs.accent || "#4f46e5";
  const a = hexToRgb(accent);
  const accentRgb = a ? `${a.r},${a.g},${a.b}` : "79,70,229";

  if (prefs.legacyDark) {
    // Legacy: the old gold/dark game look
    return {
      bg: "#06060e", bg2: "#0a0a14", bg3: "#13131f",
      border: "#1e1e2e", text: "#e2d9cc", text2: "#8a8278", text3: "#5a5a72",
      accent: "#c9a84c", accentBg: "rgba(201,168,76,0.1)", accentBorder: "rgba(201,168,76,0.25)",
      shadow: "0 1px 3px rgba(0,0,0,0.4)", shadowLg: "0 8px 32px rgba(0,0,0,0.6)",
      radius: "12px", sidebar: "#08080f",
      font: "'DM Sans', sans-serif", fontDisplay: "'Playfair Display', serif",
    };
  }

  if (prefs.mode === "dark") {
    return {
      bg: "#111118", bg2: "#18181f", bg3: "#222230",
      border: "#2a2a38", text: "#f1f0f7", text2: "#a8a6bc", text3: "#6b6980",
      accent, accentBg: `rgba(${accentRgb},0.12)`, accentBorder: `rgba(${accentRgb},0.28)`,
      shadow: "0 1px 3px rgba(0,0,0,0.35)", shadowLg: "0 12px 40px rgba(0,0,0,0.5)",
      radius: "10px", sidebar: "#0e0e15",
      font: "'Plus Jakarta Sans', sans-serif", fontDisplay: "'Plus Jakarta Sans', sans-serif",
    };
  }

  // Light (default)
  return {
    bg: "#fafaf8", bg2: "#ffffff", bg3: "#f4f3ef",
    border: "#e8e6e0", text: "#1a1916", text2: "#6b6860", text3: "#9b9890",
    accent, accentBg: `rgba(${accentRgb},0.08)`, accentBorder: `rgba(${accentRgb},0.2)`,
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", 
    shadowLg: "0 10px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
    radius: "10px", sidebar: "#ffffff",
    font: "'Plus Jakarta Sans', sans-serif", fontDisplay: "'Plus Jakarta Sans', sans-serif",
  };
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
}

// React hook — use inside any component
export function useTheme() {
  const [prefs, setPrefs] = window.__React_useStateHook || (() => {
    throw new Error("useTheme must be called inside a React component");
  })();
  return prefs;
}

// Shared global CSS that should be injected once on every page
export function globalCSS(t) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: ${t.bg}; --bg2: ${t.bg2}; --bg3: ${t.bg3};
      --border: ${t.border}; --text: ${t.text}; --text2: ${t.text2}; --text3: ${t.text3};
      --accent: ${t.accent}; --accentBg: ${t.accentBg}; --accentBorder: ${t.accentBorder};
      --shadow: ${t.shadow}; --shadowLg: ${t.shadowLg}; --radius: ${t.radius};
      --sidebar: ${t.sidebar}; --success: #059669; --danger: #dc2626; --warning: #d97706;
    }
    html, body { background: var(--bg); color: var(--text); font-family: ${t.font}; font-size: 15px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    
    /* Inputs */
    .ef-input {
      width: 100%; background: var(--bg2); border: 1.5px solid var(--border);
      border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px;
      font-family: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .ef-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accentBg); }
    .ef-input::placeholder { color: var(--text3); }
    
    /* Buttons */
    .ef-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      background: var(--accent); color: #fff; border: none; border-radius: 8px;
      padding: 10px 18px; font-size: 14px; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: opacity 0.15s, transform 0.1s; line-height: 1; white-space: nowrap;
    }
    .ef-btn:hover:not(:disabled) { opacity: 0.88; }
    .ef-btn:active:not(:disabled) { transform: scale(0.98); }
    .ef-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .ef-btn-sm { padding: 7px 13px; font-size: 13px; }
    .ef-btn-lg { padding: 13px 24px; font-size: 15px; }
    .ef-btn-ghost { background: transparent; color: var(--text2); border: 1.5px solid var(--border); }
    .ef-btn-ghost:hover:not(:disabled) { background: var(--bg3); border-color: var(--text3); color: var(--text); opacity: 1; }
    .ef-btn-danger { background: var(--danger); }

    /* Cards */
    .ef-card { background: var(--bg2); border: 1.5px solid var(--border); border-radius: var(--radius); }
    .ef-card-hover { transition: box-shadow 0.15s, border-color 0.15s; }
    .ef-card-hover:hover { box-shadow: var(--shadowLg); border-color: var(--accentBorder); }

    /* Badge */
    .ef-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
      border-radius: 20px; font-size: 12px; font-weight: 600; line-height: 1.4; }
    .ef-badge-accent { background: var(--accentBg); color: var(--accent); border: 1px solid var(--accentBorder); }
    .ef-badge-success { background: rgba(5,150,105,0.1); color: #059669; border: 1px solid rgba(5,150,105,0.2); }
    .ef-badge-warning { background: rgba(217,119,6,0.1); color: #d97706; border: 1px solid rgba(217,119,6,0.2); }
    .ef-badge-danger  { background: rgba(220,38,38,0.1);  color: #dc2626; border: 1px solid rgba(220,38,38,0.2); }
    .ef-badge-muted   { background: var(--bg3); color: var(--text3); border: 1px solid var(--border); }

    /* Dividers & spacing helpers */
    .ef-divider { border: none; border-top: 1.5px solid var(--border); margin: 20px 0; }
    .ef-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin-bottom: 10px; }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
    
    /* Nav item */
    .ef-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px;
      border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--text2); border: none;
      background: none; cursor: pointer; transition: all 0.12s; font-family: inherit; text-align: left;
    }
    .ef-nav-item:hover { background: var(--bg3); color: var(--text); }
    .ef-nav-item.active { background: var(--accentBg); color: var(--accent); font-weight: 600; }
    .ef-nav-item .nav-icon { width: 32px; height: 32px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
    .ef-nav-item.active .nav-icon { background: var(--accentBg); }

    /* Tables */
    .ef-table { width: 100%; border-collapse: collapse; }
    .ef-table th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text3); padding: 10px 16px; text-align: left; border-bottom: 1.5px solid var(--border); background: var(--bg3); }
    .ef-table td { padding: 13px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
    .ef-table tr:last-child td { border-bottom: none; }
    .ef-table tr:hover td { background: var(--bg3); }

    /* Form row */
    .ef-form-row { margin-bottom: 18px; }
    .ef-label { display: block; font-size: 13px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }

    /* Sidebar layout */
    .ef-layout { display: flex; min-height: 100vh; }
    .ef-sidebar { width: 240px; min-width: 240px; background: var(--sidebar); border-right: 1.5px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 30; overflow-y: auto; }
    .ef-main { margin-left: 240px; flex: 1; min-height: 100vh; background: var(--bg); }
    .ef-content { padding: 36px 44px; max-width: 960px; }

    /* Fade in */
    @keyframes efFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .ef-fade-up { animation: efFadeUp 0.25s ease both; }

    /* Toggle switch */
    .ef-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
    .ef-toggle input { opacity: 0; width: 0; height: 0; }
    .ef-toggle-slider { position: absolute; inset: 0; background: var(--border); border-radius: 99px; cursor: pointer; transition: 0.2s; }
    .ef-toggle input:checked + .ef-toggle-slider { background: var(--accent); }
    .ef-toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
    .ef-toggle input:checked + .ef-toggle-slider::before { transform: translateX(18px); }

    /* Responsive */
    @media (max-width: 768px) {
      .ef-sidebar { width: 100%; position: relative; height: auto; border-right: none; border-bottom: 1.5px solid var(--border); flex-direction: row; overflow-x: auto; }
      .ef-main { margin-left: 0; }
      .ef-content { padding: 20px 16px; }
    }
  `;
}
