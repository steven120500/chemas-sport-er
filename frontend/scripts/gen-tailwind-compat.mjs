// Genera src/tailwind-compat.css
// ---------------------------------------------------------------
// El sitio usa Tailwind 2.2.19 por CDN (index.html), que NO trae:
//   - paletas de v3 (zinc, emerald, amber, slate, orange, …)
//   - colores con opacidad "/NN" (bg-black/50, text-white/80, …)
//   - valores arbitrarios (text-[10px], tracking-[0.2em], rounded-[24px], bg-[#111], …)
// Este script recorre los .jsx, encuentra esas clases y genera el CSS
// equivalente. SOLO estético (colores, tamaños de letra, tracking,
// radios, ancho de borde): no genera anchos/altos/posiciones para no
// alterar el layout.
//
// Uso:  npm run compat:css   (desde frontend/)
// ---------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "tailwind-compat.css");

/* Paleta Tailwind v3 */
const P = {
  slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
  gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827", 950: "#030712" },
  zinc: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#09090b" },
  neutral: { 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717", 950: "#0a0a0a" },
  stone: { 50: "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4", 300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c", 800: "#292524", 900: "#1c1917", 950: "#0c0a09" },
  red: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d", 950: "#450a0a" },
  orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12", 950: "#431407" },
  amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
  yellow: { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207", 800: "#854d0e", 900: "#713f12", 950: "#422006" },
  lime: { 50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264", 400: "#a3e635", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 800: "#3f6212", 900: "#365314", 950: "#1a2e05" },
  green: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d", 950: "#052e16" },
  emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
  teal: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e" },
  cyan: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63", 950: "#083344" },
  sky: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e", 950: "#082f49" },
  blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
  indigo: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b" },
  violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
  purple: { 50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8", 900: "#581c87", 950: "#3b0764" },
  fuchsia: { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75", 950: "#4a044e" },
  pink: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843", 950: "#500724" },
  rose: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
};
// Nombres que el CDN v2 YA trae (sin opacidad): no los regeneramos para no alterar lo que hoy se ve.
const V2_NATIVE = new Set(["gray", "red", "yellow", "green", "blue", "indigo", "purple", "pink"]);
// En v2 "green" es emerald, "yellow" es amber y "purple" es violet: con /NN usamos esos valores para no cambiar el tono.
const V2_ALIAS = { green: "emerald", yellow: "amber", purple: "violet" };

const BREAKPOINTS = { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" };
const STATES = {
  hover: (s) => `${s}:hover`,
  focus: (s) => `${s}:focus`,
  "focus-within": (s) => `${s}:focus-within`,
  "focus-visible": (s) => `${s}:focus-visible`,
  active: (s) => `${s}:active`,
  disabled: (s) => `${s}:disabled`,
  placeholder: (s) => `${s}::placeholder`,
  "group-hover": (s) => `.group:hover ${s}`,
};

const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const withAlpha = (hex, pct) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${pct / 100})`;
};
const esc = (cls) => cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");

function resolveColor(name, shade, opacity) {
  if (name === "black" || name === "white" || name === "transparent") {
    if (opacity == null) return null; // ya existe en v2
    if (name === "transparent") return "transparent";
    return withAlpha(name === "black" ? "#000000" : "#ffffff", opacity);
  }
  if (!P[name] || !shade) return null;
  if (V2_NATIVE.has(name) && opacity == null) return null;
  const pal = P[V2_ALIAS[name] && opacity != null ? V2_ALIAS[name] : name];
  const hex = pal[shade];
  if (!hex) return null;
  return opacity != null ? withAlpha(hex, opacity) : hex;
}

// Devuelve las declaraciones CSS (o null) para una utilidad base (sin variantes)
function declFor(util) {
  let m;

  // Colores arbitrarios: bg-[#111], text-[#0f2d5c], border-[#222]
  if ((m = util.match(/^(bg|text|border|ring|from|via|to)-\[(#[0-9a-fA-F]{3,8})\]$/))) {
    return colorDecl(m[1], m[2]);
  }

  // Colores de paleta / con opacidad
  if ((m = util.match(/^(bg|text|border|border-[trblxy]|ring|divide|placeholder|from|via|to|outline|decoration|accent|caret|fill|stroke)-([a-z]+)(?:-(\d{2,3}))?(?:\/(\d{1,3}))?$/))) {
    const [, prop, name, shade, op] = m;
    const color = resolveColor(name, shade, op != null ? Number(op) : null);
    if (!color) return null;
    return colorDecl(prop, color);
  }

  // Tamaños de letra arbitrarios: text-[10px], text-[0.7rem]
  if ((m = util.match(/^text-\[(\d*\.?\d+(px|rem|em))\]$/))) return `font-size: ${m[1]};`;
  // Tracking arbitrario: tracking-[0.2em]
  if ((m = util.match(/^tracking-\[(-?\d*\.?\d+(em|px|rem))\]$/))) return `letter-spacing: ${m[1]};`;
  // Interlineado arbitrario: leading-[1.1]
  if ((m = util.match(/^leading-\[(\d*\.?\d+(px|rem|em)?)\]$/))) return `line-height: ${m[1]};`;
  // Radios arbitrarios: rounded-[24px], rounded-t-[20px]
  if ((m = util.match(/^rounded(?:-(t|b|l|r|tl|tr|bl|br))?-\[(\d*\.?\d+(px|rem|em|%))\]$/))) {
    const v = m[2];
    const map = {
      undefined: [`border-radius: ${v};`],
      t: [`border-top-left-radius: ${v};`, `border-top-right-radius: ${v};`],
      b: [`border-bottom-left-radius: ${v};`, `border-bottom-right-radius: ${v};`],
      l: [`border-top-left-radius: ${v};`, `border-bottom-left-radius: ${v};`],
      r: [`border-top-right-radius: ${v};`, `border-bottom-right-radius: ${v};`],
      tl: [`border-top-left-radius: ${v};`],
      tr: [`border-top-right-radius: ${v};`],
      bl: [`border-bottom-left-radius: ${v};`],
      br: [`border-bottom-right-radius: ${v};`],
    };
    return map[m[1]].join(" ");
  }
  // Ancho de borde arbitrario: border-[3px], border-b-[2px]
  if ((m = util.match(/^border(?:-(t|b|l|r|x|y))?-\[(\d+px)\]$/))) {
    const v = m[2];
    const side = { undefined: ["border-width"], t: ["border-top-width"], b: ["border-bottom-width"], l: ["border-left-width"], r: ["border-right-width"], x: ["border-left-width", "border-right-width"], y: ["border-top-width", "border-bottom-width"] }[m[1]];
    return side.map((p) => `${p}: ${v};`).join(" ");
  }
  return null;
}

function colorDecl(prop, color) {
  switch (prop) {
    case "bg": return `background-color: ${color};`;
    case "text": return `color: ${color};`;
    case "border": return `border-color: ${color};`;
    case "border-t": return `border-top-color: ${color};`;
    case "border-b": return `border-bottom-color: ${color};`;
    case "border-l": return `border-left-color: ${color};`;
    case "border-r": return `border-right-color: ${color};`;
    case "border-x": return `border-left-color: ${color}; border-right-color: ${color};`;
    case "border-y": return `border-top-color: ${color}; border-bottom-color: ${color};`;
    case "ring": return `--tw-ring-color: ${color};`;
    case "divide": return { divide: `border-color: ${color};` };
    case "placeholder": return { placeholder: `color: ${color};` };
    case "from": return `--tw-gradient-from: ${color}; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(255, 255, 255, 0));`;
    case "via": return `--tw-gradient-stops: var(--tw-gradient-from), ${color}, var(--tw-gradient-to, rgba(255, 255, 255, 0));`;
    case "to": return `--tw-gradient-to: ${color};`;
    case "outline": return `outline-color: ${color};`;
    case "decoration": return `text-decoration-color: ${color};`;
    case "accent": return `accent-color: ${color};`;
    case "caret": return `caret-color: ${color};`;
    case "fill": return `fill: ${color};`;
    case "stroke": return `stroke: ${color};`;
    default: return null;
  }
}

/* ---------- Recolectar clases de todos los .jsx ---------- */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.(jsx|js)$/.test(d.name) ? [p] : [];
  });
}

const classes = new Set();
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, "utf8");
  // Partimos todo el archivo por espacios/comillas/llaves: atrapa clases dentro de
  // strings, templates y ternarios. Los falsos positivos no generan reglas.
  for (const t of src.split(/[\s"'`{}()<>,;=]+/)) {
    if (t && /^[a-z0-9:\-\[\]#./%]+$/i.test(t) && t.includes("-")) classes.add(t);
  }
}

/* ---------- Generar CSS ---------- */
const base = [];
const media = Object.fromEntries(Object.keys(BREAKPOINTS).map((k) => [k, []]));

for (const cls of [...classes].sort()) {
  const parts = cls.split(":");
  const util = parts.pop();
  const variants = parts;
  const decl = declFor(util);
  if (!decl) continue;

  let bp = null;
  const states = [];
  let ok = true;
  for (const v of variants) {
    if (BREAKPOINTS[v] && !bp) bp = v;
    else if (STATES[v]) states.push(v);
    else { ok = false; break; }
  }
  if (!ok) continue;

  let sel = `.${esc(cls)}`;
  let body = decl;
  if (typeof decl === "object" && decl.divide) { sel = `${sel} > :not([hidden]) ~ :not([hidden])`; body = decl.divide; }
  if (typeof decl === "object" && decl.placeholder) { sel = `${sel}::placeholder`; body = decl.placeholder; }
  for (const s of states) sel = STATES[s](sel);

  const rule = `${sel} { ${body} }`;
  (bp ? media[bp] : base).push(rule);
}

let css = `/* ⚠️ ARCHIVO GENERADO por scripts/gen-tailwind-compat.mjs — no editar a mano.
   Regenerar con: npm run compat:css (desde frontend/)
   Agrega las clases de Tailwind v3 que el CDN 2.2.19 no trae (solo estéticas). */\n\n`;
css += base.join("\n") + "\n";
for (const [bp, rules] of Object.entries(media)) {
  if (rules.length) css += `\n@media (min-width: ${BREAKPOINTS[bp]}) {\n  ${rules.join("\n  ")}\n}\n`;
}
fs.writeFileSync(OUT, css);
console.log(`tailwind-compat.css: ${base.length + Object.values(media).flat().length} reglas`);
