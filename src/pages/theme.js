// ============================================================
//  theme.js — Oneonetix design system
//
//  All values flow from brand.js.
//  To rebrand: edit brand.js only. Never edit this file for
//  brand reasons — only for structural/layout reasons.
// ============================================================
import { BRAND } from "./brand";

const C = BRAND.colors;
const F = BRAND.fonts;

// ── Theme presets shown in settings UI ──────────────────────
export const ACCENTS = [
  { name: "Orange (Default)", value: C.primary },
  { name: "Indigo",  value: "#4f46e5" },
  { name: "Blue",    value: "#2563eb" },
  { name: "Violet",  value: "#7c3aed" },
  { name: "Emerald", value: "#059669" },
  { name: "Rose",    value: "#e11d48" },
  { name: "Amber",   value: "#d97706" },
];

// ── Load / save ──────────────────────────────────────────────
export function loadThemePrefs() {
  try {
    const raw = localStorage.getItem(BRAND.storageKey);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Default: dark mode to match the Oneonetix brand aesthetic
  return { mode: "dark", accent: C.primary };
}

export function saveThemePrefs(prefs) {
  localStorage.setItem(BRAND.storageKey, JSON.stringify(prefs));
  applyThemeToDOM(prefs);
}

// ── Apply CSS variables to document root ────────────────────
export function applyThemeToDOM(prefs) {
  const t = getTheme(prefs);
  const root = document.documentElement;
  const vars = {
    "--bg": t.bg, "--bg2": t.bg2, "--bg3": t.bg3,
    "--border": t.border,
    "--text": t.text, "--text2": t.text2, "--text3": t.text3,
    "--accent": t.accent,
    "--accentBg": t.accentBg, "--accentBorder": t.accentBorder,
    "--accentText": t.accentText,
    "--shadow": t.shadow, "--shadowLg": t.shadowLg,
    "--radius": t.radius, "--radiusLg": t.radiusLg, "--radiusXl": t.radiusXl,
    "--sidebar": t.sidebar,
    "--fontBody": t.font,
    "--fontDisplay": t.fontDisplay,
    "--fontCondensed": t.fontCondensed,
    "--success": C.success, "--danger": C.danger,
    "--warning": C.warning, "--info": C.info,
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", prefs.mode === "light" ? "light" : "dark");
}

// ── Build a full token object for a given prefs ──────────────
export function getTheme(prefs = {}) {
  const accent = prefs.accent || C.primary;
  const isLight = prefs.mode === "light";
  const a = hexToRgb(accent);
  const ar = a ? `${a.r},${a.g},${a.b}` : "255,77,0";

  const shared = {
    accent,
    accentBg:      `rgba(${ar},0.12)`,
    accentBorder:  `rgba(${ar},0.3)`,
    accentText:    C.primaryText,
    radius:        BRAND.radius,
    radiusLg:      BRAND.radiusLg,
    radiusXl:      BRAND.radiusXl,
    font:          F.body,
    fontDisplay:   F.display,
    fontCondensed: F.condensed,
  };

  if (isLight) {
    return {
      ...shared,
      bg: C.lightBg, bg2: C.lightBgMid, bg3: C.lightBgCard,
      border: C.lightBorder,
      text: C.lightText, text2: C.lightTextMuted, text3: C.lightTextFaint,
      sidebar: C.lightBgMid,
      shadow:  "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      shadowLg:"0 10px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
    };
  }

  // Dark (default)
  return {
    ...shared,
    bg: C.darkBg, bg2: C.darkBgMid, bg3: C.darkBgCard,
    border: C.darkBorder,
    text: C.darkText, text2: C.darkTextMuted, text3: C.darkTextFaint,
    sidebar: C.darkBg,
    shadow:  "0 1px 3px rgba(0,0,0,0.5)",
    shadowLg:"0 12px 40px rgba(0,0,0,0.6)",
  };
}

// ── Logo renderer (use in any component) ────────────────────
// Returns a React element — import and use as <BrandLogo size={22}/>
export function BrandLogo({ size = 20, color = "currentColor", style = {} }) {
  const { logoType, logoSrc, logoSvg, logoAccentRange, name } = BRAND;
  const s = { fontFamily: F.display, fontSize: size, letterSpacing: "0.04em", lineHeight: 1, ...style };

  if (logoType === "image" && logoSrc)
    return <img src={logoSrc} alt={name} style={{ height: size, ...style }} />;

  if (logoType === "svg" && logoSvg)
    return <span style={style} dangerouslySetInnerHTML={{ __html: logoSvg }} />;

  // Text logo with optional accent split
  if (logoAccentRange) {
    const [s1, e1] = logoAccentRange;
    return (
      <span style={s}>
        {name.slice(0, s1)}
        <span style={{ color: C.primary }}>{name.slice(s1, e1)}</span>
        {name.slice(e1)}
      </span>
    );
  }
  return <span style={{ ...s, color }}>{name}</span>;
}

// ── Global CSS ────────────────────────────────────────────────
// Inject once per page. Contains all shared utility classes.
// Class names use "onx-" prefix. Legacy "ef-" aliases included
// so existing components don't break during migration.
export function globalCSS(t) {
  return `
    @import url('${BRAND.googleFontsUrl}');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:${t.bg};--bg2:${t.bg2};--bg3:${t.bg3};
      --border:${t.border};
      --text:${t.text};--text2:${t.text2};--text3:${t.text3};
      --accent:${t.accent};--accentBg:${t.accentBg};
      --accentBorder:${t.accentBorder};--accentText:${t.accentText};
      --shadow:${t.shadow};--shadowLg:${t.shadowLg};
      --radius:${t.radius};--radiusLg:${t.radiusLg};--radiusXl:${t.radiusXl};
      --sidebar:${t.sidebar};
      --success:${C.success};--danger:${C.danger};
      --warning:${C.warning};--info:${C.info};
    }
    html,body{
      background:var(--bg);color:var(--text);
      font-family:${t.font};font-size:15px;line-height:1.6;
      -webkit-font-smoothing:antialiased;
    }

    /* ── Inputs ── */
    .onx-input{width:100%;background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius);padding:12px 16px;color:var(--text);font-size:15px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;}
    .onx-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accentBg);}
    .onx-input::placeholder{color:var(--text3);}

    /* ── Buttons ── */
    .onx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--accent);color:var(--accentText);border:none;border-radius:var(--radius);padding:11px 22px;font-family:${t.fontCondensed};font-size:.85rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .15s,transform .1s;line-height:1;white-space:nowrap;text-decoration:none;}
    .onx-btn:hover:not(:disabled){background:${C.primaryHover};color:${C.primaryText};}
    .onx-btn:active:not(:disabled){transform:scale(.98);}
    .onx-btn:disabled{opacity:.45;cursor:not-allowed;}
    .onx-btn-sm{padding:7px 14px;font-size:.75rem;}
    .onx-btn-lg{padding:14px 28px;font-size:1rem;}
    .onx-btn-ghost{background:transparent;color:var(--text);border:1.5px solid var(--border);}
    .onx-btn-ghost:hover:not(:disabled){border-color:var(--text2);background:var(--bg3);}
    .onx-btn-danger{background:var(--danger);color:#fff;}
    .onx-btn-danger:hover:not(:disabled){background:#c53030;}

    /* ── Cards ── */
    .onx-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radiusLg);}
    .onx-card-hover{transition:background .2s,border-color .2s;}
    .onx-card-hover:hover{background:var(--bg3);border-color:var(--accentBorder);}

    /* ── Badges ── */
    .onx-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:2px;font-family:${t.fontCondensed};font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
    .onx-badge-accent{background:var(--accentBg);color:var(--accent);border:1px solid var(--accentBorder);}
    .onx-badge-success{background:rgba(34,197,94,.1);color:${C.success};border:1px solid rgba(34,197,94,.2);}
    .onx-badge-warning{background:rgba(245,158,11,.1);color:${C.warning};border:1px solid rgba(245,158,11,.2);}
    .onx-badge-danger{background:rgba(239,68,68,.1);color:${C.danger};border:1px solid rgba(239,68,68,.2);}
    .onx-badge-muted{background:var(--bg3);color:var(--text3);border:1px solid var(--border);}

    /* ── Typography ── */
    .onx-display{font-family:${t.fontDisplay};line-height:.95;letter-spacing:.01em;}
    .onx-label{font-family:${t.fontCondensed};font-size:.75rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);}
    .onx-section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-bottom:10px;}
    .onx-divider{border:none;border-top:1px solid var(--border);margin:20px 0;}

    /* ── Nav ── */
    .onx-nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:var(--radius);font-size:13px;font-weight:600;color:var(--text2);border:none;background:none;cursor:pointer;transition:all .12s;font-family:inherit;text-align:left;}
    .onx-nav-item:hover{background:var(--bg3);color:var(--text);}
    .onx-nav-item.active{background:var(--accentBg);color:var(--accent);}
    .onx-nav-item .nav-icon{width:32px;height:32px;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
    .onx-nav-item.active .nav-icon{background:var(--accentBg);}

    /* ── Tables ── */
    .onx-table{width:100%;border-collapse:collapse;}
    .onx-table th{font-family:${t.fontCondensed};font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);padding:10px 16px;text-align:left;border-bottom:1px solid var(--border);background:var(--bg3);}
    .onx-table td{padding:12px 16px;border-bottom:1px solid var(--border);font-size:14px;}
    .onx-table tr:last-child td{border-bottom:none;}
    .onx-table tr:hover td{background:var(--bg3);}

    /* ── Layout ── */
    .onx-layout{display:flex;min-height:100vh;}
    .onx-sidebar{width:240px;min-width:240px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:30;overflow-y:auto;}
    .onx-main{margin-left:240px;flex:1;min-height:100vh;background:var(--bg);}
    .onx-content{padding:36px 44px;max-width:960px;}
    .onx-form-row{margin-bottom:18px;}
    .onx-form-label{display:block;font-size:11px;font-weight:700;font-family:${t.fontCondensed};letter-spacing:.1em;text-transform:uppercase;color:var(--text2);margin-bottom:7px;}

    /* ── Toggle ── */
    .onx-toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
    .onx-toggle input{opacity:0;width:0;height:0;}
    .onx-toggle-slider{position:absolute;inset:0;background:var(--border);border-radius:99px;cursor:pointer;transition:.2s;}
    .onx-toggle input:checked+.onx-toggle-slider{background:var(--accent);}
    .onx-toggle-slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;bottom:3px;background:white;border-radius:50%;transition:.2s;}
    .onx-toggle input:checked+.onx-toggle-slider::before{transform:translateX(18px);}

    /* ── Scrollbar ── */
    ::-webkit-scrollbar{width:5px;height:5px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px;}

    /* ── Animations ── */
    @keyframes onxFadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
    .fade-up{animation:onxFadeUp .28s ease both;}

    /* ── Responsive ── */
    @media(max-width:768px){
      .onx-sidebar{width:100%;position:relative;height:auto;border-right:none;border-bottom:1px solid var(--border);flex-direction:row;overflow-x:auto;}
      .onx-main{margin-left:0;}
      .onx-content{padding:20px 16px;}
    }

    /* ── Legacy ef- aliases (keep existing components working) ── */
    .ef-fade-up{animation:onxFadeUp .28s ease both;}
    .ef-form-row{margin-bottom:18px;}
    .ef-label{display:block;font-size:13px;font-weight:600;color:var(--text2);margin-bottom:6px;}
    .ef-section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-bottom:10px;}
    .ef-divider{border:none;border-top:1px solid var(--border);margin:20px 0;}
    .ef-input{width:100%;background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius);padding:10px 14px;color:var(--text);font-size:14px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;}
    .ef-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accentBg);}
    .ef-input::placeholder{color:var(--text3);}
    .ef-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--accent);color:var(--accentText);border:none;border-radius:var(--radius);padding:10px 18px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:background .15s,transform .1s;line-height:1;white-space:nowrap;}
    .ef-btn:hover:not(:disabled){background:${C.primaryHover};color:${C.primaryText};}
    .ef-btn:active:not(:disabled){transform:scale(.98);}
    .ef-btn:disabled{opacity:.45;cursor:not-allowed;}
    .ef-btn-ghost{background:transparent;color:var(--text2);border:1.5px solid var(--border);}
    .ef-btn-ghost:hover:not(:disabled){background:var(--bg3);border-color:var(--text3);color:var(--text);}
    .ef-btn-danger{background:var(--danger);color:#fff;}
    .ef-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radiusLg);}
    .ef-card-hover{transition:background .2s,border-color .2s;}
    .ef-card-hover:hover{background:var(--bg3);border-color:var(--accentBorder);}
    .ef-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:2px;font-size:12px;font-weight:600;line-height:1.4;}
    .ef-badge-accent{background:var(--accentBg);color:var(--accent);border:1px solid var(--accentBorder);}
    .ef-badge-success{background:rgba(34,197,94,.1);color:${C.success};border:1px solid rgba(34,197,94,.2);}
    .ef-badge-warning{background:rgba(245,158,11,.1);color:${C.warning};border:1px solid rgba(245,158,11,.2);}
    .ef-badge-danger{background:rgba(239,68,68,.1);color:${C.danger};border:1px solid rgba(239,68,68,.2);}
    .ef-badge-muted{background:var(--bg3);color:var(--text3);border:1px solid var(--border);}
    .ef-table{width:100%;border-collapse:collapse;}
    .ef-table th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);padding:10px 16px;text-align:left;border-bottom:1px solid var(--border);background:var(--bg3);}
    .ef-table td{padding:13px 16px;border-bottom:1px solid var(--border);font-size:14px;}
    .ef-table tr:last-child td{border-bottom:none;}
    .ef-table tr:hover td{background:var(--bg3);}
    .ef-layout{display:flex;min-height:100vh;}
    .ef-sidebar{width:240px;min-width:240px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:30;overflow-y:auto;}
    .ef-main{margin-left:240px;flex:1;min-height:100vh;background:var(--bg);}
    .ef-content{padding:36px 44px;max-width:960px;}
    .ef-toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
    .ef-toggle input{opacity:0;width:0;height:0;}
    .ef-toggle-slider{position:absolute;inset:0;background:var(--border);border-radius:99px;cursor:pointer;transition:.2s;}
    .ef-toggle input:checked+.ef-toggle-slider{background:var(--accent);}
    .ef-toggle-slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;bottom:3px;background:white;border-radius:50%;transition:.2s;}
    .ef-toggle input:checked+.ef-toggle-slider::before{transform:translateX(18px);}
  `;
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r:parseInt(r[1],16), g:parseInt(r[2],16), b:parseInt(r[3],16) } : null;
}
