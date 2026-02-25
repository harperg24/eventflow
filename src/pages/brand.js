// ============================================================
//  brand.js — Oneonetix single source of branding truth
//
//  TO REBRAND THE ENTIRE APP:
//    1. Edit ONLY this file
//    2. Colours, fonts, name, and logo all propagate
//       automatically via theme.js and CSS variables
//    3. No other file needs touching
// ============================================================

export const BRAND = {

  // ── Identity ─────────────────────────────────────────────
  name:         "Oneonetix",
  tagline:      "Event Management, Unleashed",
  taglineShort: "Run better events.",
  copyright:    `© ${new Date().getFullYear()} Oneonetix`,
  domain:       "oneonetix.app",

  // ── Logo ─────────────────────────────────────────────────
  // logoType: "text"  → renders name in display font with optional accent split
  // logoType: "image" → renders <img src={logoSrc}>
  // logoType: "svg"   → paste raw SVG markup into logoSvg
  logoType: "text",
  logoSrc:  null,   // e.g. "/logo.png"
  logoSvg:  null,   // raw SVG string

  // For "text" logos: wrap these character indices in the accent colour
  // "Oneonetix" → index 3 = "o", giving ONE[O]NETIX
  logoAccentRange: [3, 4],

  // ── Colours ──────────────────────────────────────────────
  // Edit here → all buttons, accents, backgrounds update everywhere
  colors: {
    primary:       "#ff4d00",   // main CTA / accent
    primaryHover:  "#ffd000",   // hover on primary
    primaryText:   "#0a0a0a",   // text ON primary (dark on orange)

    // Dark theme (default)
    darkBg:        "#0a0a0a",
    darkBgMid:     "#111111",
    darkBgCard:    "#1c1c1c",
    darkBorder:    "rgba(255,255,255,0.07)",
    darkText:      "#f5f0e8",
    darkTextMuted: "#888888",
    darkTextFaint: "#555555",

    // Light theme (optional)
    lightBg:        "#fafaf8",
    lightBgMid:     "#ffffff",
    lightBgCard:    "#f4f3ef",
    lightBorder:    "#e8e6e0",
    lightText:      "#1a1916",
    lightTextMuted: "#6b6860",
    lightTextFaint: "#9b9890",

    // Semantic — unchanged by theme
    success: "#22c55e",
    danger:  "#ef4444",
    warning: "#f59e0b",
    info:    "#3b82f6",
  },

  // ── Typography ───────────────────────────────────────────
  fonts: {
    display:   "'Bebas Neue', sans-serif",        // big headings
    condensed: "'Barlow Condensed', sans-serif",  // labels, buttons, caps
    body:      "'Barlow', sans-serif",            // all body text
    mono:      "'Courier New', monospace",
  },
  googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;700;900&display=swap",

  // ── Shape ────────────────────────────────────────────────
  // "sharp" = angular, matches the website (2–4px)
  // "round" = softer SaaS look (8–12px)
  radiusStyle: "sharp",
  get radius()   { return this.radiusStyle === "sharp" ? "3px"  : "10px"; },
  get radiusLg() { return this.radiusStyle === "sharp" ? "4px"  : "14px"; },
  get radiusXl() { return this.radiusStyle === "sharp" ? "6px"  : "20px"; },

  // ── Storage ──────────────────────────────────────────────
  storageKey: "onx_theme",   // localStorage key for user theme prefs
};

// ── Convenience re-exports ───────────────────────────────────
export const APP_NAME = BRAND.name;
export const COLORS   = BRAND.colors;
export const FONTS    = BRAND.fonts;
