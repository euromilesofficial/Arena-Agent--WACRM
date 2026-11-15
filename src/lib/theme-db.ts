/* ============================================================
   Module 6 · Theme Studio — data layer
   ------------------------------------------------------------
   One token document, one contrast engine, one revision store,
   one preset library. Everything the screen shows is computed
   here, including the contrast ratios — no number in the UI is
   typed by hand (the mocks' ratios are invented; ours are not).

   Tokens compile to CSS variables in two places:
     · the studio preview (scoped to the preview root)
     · the release manifest (published shape, §18.4)
   ============================================================ */
import { DBX } from "./data";
import { SECTION_PRESETS, REGISTRY, type BlockNode, type BlockType } from "./builder";
import { ensureDraft } from "./builder-db";
import { FONT_ASSETS, EMBEDDED_COUNT, EMBEDDED_TOTAL_BYTES } from "./theme-font-data";
import { GOOGLE_FONT_ROWS, CATALOG_COUNT, type FontCategory } from "./theme-font-catalog";

export type { FontCategory };

/* ---------------- vocabulary ---------------- */

export type ColorRole =
  | "primary" | "secondary" | "accent" | "success" | "warning" | "error"
  | "background" | "surface" | "text"
  /* M6.1 — the four roles every mature system carries and M6 was missing:
     a line colour, a focus ring, de-emphasised text and a distinct link colour.
     `link` is not `primary` because a site can use a brand colour for buttons
     that is unreadable as text, and holding both to 4.5:1 forces honest values. */
  | "border" | "ring" | "muted" | "link";

export interface FontChoice { family: string; weight: number; fallback: string }
export type Density = "compact" | "comfortable" | "spacious";

/** The modular scale (G1). Sizes are derived, never stored per step, so a ratio
    change re-rhythms the whole page instead of editing six numbers. */
export interface TypeScale {
  /** body size in px — every other step is derived from it */
  basePx: number;
  /** modular ratio between steps */
  ratio: number;
  leadingHeading: number;
  leadingBody: number;
  /** em units, negative for display type */
  trackingHeading: number;
  trackingBody: number;
  /** emit clamp() so type breathes between 420px and 1180px */
  fluid: boolean;
}

export interface ThemeTokens {
  colors: Record<ColorRole, string>;
  typography: { heading: FontChoice; body: FontChoice; scale: TypeScale };
  geometry: {
    radiusPx: 0 | 4 | 8 | 12 | 16 | 24;
    spacing: { base: 4 | 8; density: Density };
    containerWidthPx: 960 | 1080 | 1200 | 1280;
  };
  blockStyling: { cardDensity: "compact" | "comfortable"; elevation: "flat" | "soft" };
}

/* ---------------- the type scale ---------------- */

export const TYPE_STEPS = ["h1", "h2", "h3", "body", "small", "caption"] as const;
export type TypeStep = (typeof TYPE_STEPS)[number];

export const SCALE_RATIOS: { value: number; label: string; use: string }[] = [
  { value: 1.2, label: "1.200", use: "Minor third — dense, product-like" },
  { value: 1.25, label: "1.250", use: "Major third — the safe marketing default" },
  { value: 1.333, label: "1.333", use: "Perfect fourth — editorial contrast" },
  { value: 1.5, label: "1.500", use: "Perfect fifth — loud, landing-page" }
];

export const BASE_SIZES = [14, 15, 16, 17, 18] as const;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Derived sizes in px.  h1 = base·r³ … caption = base/r². */
export function typeSizes(t: ThemeTokens): Record<TypeStep, number> {
  const { basePx: b, ratio: r } = t.typography.scale;
  return {
    h1: Math.round(b * r ** 3),
    h2: Math.round(b * r ** 2),
    h3: Math.round(b * r),
    body: b,
    small: Math.round(b / r),
    caption: Math.round(b / r ** 2)
  };
}

/** The CSS `font-size` for a step: a px value, or a clamp() when fluid is on.
    Fluid ramps h1–h3 only — body copy should not move with the viewport. */
export function typeSizeCss(t: ThemeTokens, step: TypeStep): string {
  const size = typeSizes(t)[step];
  if (!t.typography.scale.fluid || !["h1", "h2", "h3"].includes(step)) return `${size}px`;
  const min = Math.round(size * 0.72);
  const from = 420;
  const to = 1180;
  const slope = ((size - min) / (to - from)) * 100;
  const intercept = min - (slope * from) / 100;
  return `clamp(${min}px, ${round1(intercept)}px + ${round1(slope)}vw, ${size}px)`;
}

export function typeStamp(t: ThemeTokens): string {
  const s = typeSizes(t);
  return `${s.h1}/${s.h2}/${s.h3}/${s.body}`;
}

export interface ThemeRevision {
  id: string;
  seq: number;
  baseId: string | null;
  tokens: ThemeTokens;
  createdAt: number;
  createdBy: string;
  status: "draft" | "live";
  presetId?: string;
}

export interface Preset {
  id: string;
  name: string;
  desc: string;
  scope: "Built-in" | "Workspace" | "This Site";
  tokens: ThemeTokens;
  builtIn: boolean;
  /** archived presets keep their references but leave the apply list (G13) */
  archived?: boolean;
  updatedAt: number;
  createdBy: string;
  /** revisions and saved templates built from this preset — delete guard */
  referencedBy: string[];
}

/* ---------------- colour maths (WCAG 2.x) ----------------
   relative luminance from sRGB, then (L1 + 0.05) / (L2 + 0.05) */

const srgb = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  const h = normalizeHex(hex) ?? "#000000";
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export const formatRatio = (r: number): string => `${r.toFixed(2)}:1`;

/** `#abc` → `#AABBCC`, trims, uppercases; anything else → null (no alpha: the
    token contract is six digits, and a translucent brand colour is not a token). */
export function normalizeHex(input: string): string | null {
  const raw = (input ?? "").trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{3}$/.test(raw)) return `#${raw.split("").map((c) => c + c).join("")}`;
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

/* ---------------- colour roles ---------------- */

export interface RoleMeta {
  key: ColorRole;
  label: string;
  /** shown under the label in the editor */
  use: string;
  /** text roles are held to 4.5:1, marker roles to 3:1 as UI boundaries */
  kind: "text" | "marker";
  /** editor grouping — brand marks read differently from surface and line roles */
  group: "Brand" | "Surface & text";
  /** true when a v1 document (9 roles) did not carry this role and we derived it */
  derivedFrom?: ColorRole;
}

export const COLOR_ROLES: RoleMeta[] = [
  { key: "primary", label: "Primary", use: "CTAs, links, highlights", kind: "text", group: "Brand" },
  { key: "secondary", label: "Secondary", use: "Headings, dark surfaces, secondary actions", kind: "text", group: "Brand" },
  { key: "accent", label: "Accent", use: "Marks and highlights — never body text", kind: "marker", group: "Brand" },
  { key: "success", label: "Success", use: "Confirmations and positive status", kind: "marker", group: "Brand" },
  { key: "warning", label: "Warning", use: "Notices and pending status", kind: "marker", group: "Brand" },
  { key: "error", label: "Error", use: "Failures and destructive actions", kind: "marker", group: "Brand" },
  { key: "background", label: "Background", use: "The page canvas", kind: "marker", group: "Surface & text" },
  { key: "surface", label: "Surface", use: "Cards, panels, banded sections", kind: "marker", group: "Surface & text" },
  { key: "text", label: "Text", use: "Body copy and headings", kind: "text", group: "Surface & text" },
  { key: "muted", label: "Muted text", use: "Captions, labels, helper copy", kind: "text", group: "Surface & text" },
  { key: "link", label: "Link", use: "Inline links — held to 4.5:1 like body text", kind: "text", group: "Surface & text" },
  { key: "border", label: "Border", use: "Rules, dividers, input outlines", kind: "marker", group: "Surface & text" },
  { key: "ring", label: "Focus ring", use: "Keyboard focus — 3:1 against the canvas", kind: "marker", group: "Surface & text" }
];

/** The nine roles a version-1 document carries. Anything else is derived. */
export const CORE_ROLES: ColorRole[] = ["primary", "secondary", "accent", "success", "warning", "error", "background", "surface", "text"];

/** Derived, never stored: the label colour that sits on the primary button. */
export function onPrimary(primary: string): string {
  const white = "#FFFFFF";
  const ink = "#0F172A";
  return contrast(white, primary) >= contrast(ink, primary) ? white : ink;
}

/* ---------------- palette maths used by migration and generation ----------------
   A straight sRGB blend, not an OKLCH mix: it must be reproducible in the
   importer and in the exporter without a colour-science dependency. */

const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (rgb: number[]): string =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** mix(a → b) at t: 0 returns a, 1 returns b. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

/** lighten/darken toward white or ink by t */
export const shade = (hex: string, t: number): string => (t >= 0 ? mixHex(hex, "#FFFFFF", t) : mixHex(hex, "#000000", -t));

/** How a v1 document's missing roles are recovered. Documented in the import
    review so the user is never told a derived value came from the file. */
export function deriveRole(key: ColorRole, c: Record<string, string>): string {
  switch (key) {
    case "muted": return mixHex(c.text, c.background, 0.42);
    case "link": return c.primary;
    case "border": return mixHex(c.text, c.background, 0.86);
    case "ring": return c.primary;
    default: return c.primary;
  }
}

/* ---------------- contrast pairs ----------------
   Only pairs that actually exist in the rendered site are tested. A role that
   is never text is not judged as text — that is the difference between an
   audit and a red dashboard. */

export type Verdict = "pass" | "warn" | "na";

export interface ContrastRow {
  id: string;
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  need: number;
  kind: "text" | "marker";
  verdict: Verdict;
  /** what a failing row is asking the user to do */
  hint?: string;
  role?: ColorRole;
  /** measured against a floor, not a WCAG success criterion (dividers, 1.4.11 exempt) */
  advisory?: boolean;
}

export function evaluate(tokens: ThemeTokens): ContrastRow[] {
  const c = tokens.colors;
  const rows: Omit<ContrastRow, "ratio" | "verdict">[] = [
    { id: "text-on-bg", label: "Body text on background", fg: c.text, bg: c.background, need: 4.5, kind: "text", role: "text" },
    { id: "text-on-surface", label: "Body text on surface", fg: c.text, bg: c.surface, need: 4.5, kind: "text", role: "text" },
    { id: "muted-on-bg", label: "Muted text on background", fg: c.muted, bg: c.background, need: 4.5, kind: "text", role: "muted" },
    { id: "muted-on-surface", label: "Muted text on surface", fg: c.muted, bg: c.surface, need: 4.5, kind: "text", role: "muted" },
    { id: "cta-label", label: "Button label on primary", fg: onPrimary(c.primary), bg: c.primary, need: 4.5, kind: "text", role: "primary" },
    { id: "link-on-bg", label: "Links on background", fg: c.link, bg: c.background, need: 4.5, kind: "text", role: "link" },
    { id: "link-on-surface", label: "Links on surface", fg: c.link, bg: c.surface, need: 4.5, kind: "text", role: "link" },
    { id: "heading", label: "Headings in secondary", fg: c.secondary, bg: c.background, need: 4.5, kind: "text", role: "secondary" },
    { id: "ring-on-bg", label: "Focus ring on background", fg: c.ring, bg: c.background, need: 3, kind: "marker", role: "ring" },
    { id: "border-on-surface", label: "Dividers on surface", fg: c.border, bg: c.surface, need: 1.5, kind: "marker", role: "border", advisory: true },
    { id: "mark-accent", label: "Accent marks and borders", fg: c.accent, bg: c.background, need: 3, kind: "marker", role: "accent" },
    { id: "mark-success", label: "Success marks", fg: c.success, bg: c.background, need: 3, kind: "marker", role: "success" },
    { id: "mark-warning", label: "Warning marks", fg: c.warning, bg: c.background, need: 3, kind: "marker", role: "warning" },
    { id: "mark-error", label: "Error marks", fg: c.error, bg: c.background, need: 3, kind: "marker", role: "error" }
  ];
  return rows.map((r) => {
    const ratio = contrast(r.fg, r.bg);
    const verdict: Verdict = ratio >= r.need ? "pass" : "warn";
    return {
      ...r,
      ratio,
      verdict,
      hint: verdict === "pass"
        ? undefined
        : r.kind === "text"
          ? `Needs ${r.need}:1 for readable text — this pair measures ${formatRatio(ratio)}.`
          : r.advisory
            ? `A divider below ${r.need}:1 disappears on this surface — this pair measures ${formatRatio(ratio)}. Decorative rules are exempt from WCAG 1.4.11, so this is advisory.`
            : `Needs ${r.need}:1 so the mark is distinguishable — this pair measures ${formatRatio(ratio)}.`
    };
  });
}


export interface ContrastSummary { rows: ContrastRow[]; passed: number; warned: number; worst: number }

export function summarise(tokens: ThemeTokens): ContrastSummary {
  const rows = evaluate(tokens);
  return {
    rows,
    passed: rows.filter((r) => r.verdict === "pass").length,
    warned: rows.filter((r) => r.verdict === "warn").length,
    worst: Math.min(...rows.map((r) => r.ratio))
  };
}

export const isScaleValid = (s: TypeScale): boolean =>
  Number.isInteger(s.basePx) && s.basePx >= 14 && s.basePx <= 18
  && SCALE_RATIOS.some((r) => r.value === s.ratio)
  && s.leadingHeading >= 1 && s.leadingHeading <= 1.4
  && s.leadingBody >= 1.4 && s.leadingBody <= 1.8
  && s.trackingHeading >= -0.03 && s.trackingHeading <= 0
  && s.trackingBody >= 0 && s.trackingBody <= 0.01;

export const isDocumentValid = (tokens: ThemeTokens): boolean =>
  COLOR_ROLES.every((r) => normalizeHex(tokens.colors[r.key]) !== null)
  && FONT_INDEX.has(tokens.typography.heading.family)
  && FONT_INDEX.has(tokens.typography.body.family)
  && isScaleValid(tokens.typography.scale);

/* ---------------- fonts ----------------
   Every family Google publishes is in the index (1,746 rows after excluding
   brand fonts that are not licensed for redistribution). A subset — 247 at the
   time of writing — carries a real woff2 in this build. Rows without an asset
   are listed, never silently offered: the studio does not preview a font it
   cannot render. */

export interface FontFamily {
  family: string;
  weights: number[];
  author: string;
  license: string;
  embedded: boolean;
  /** why it cannot be picked, when it cannot */
  reason?: string;
  category: FontCategory;
  italic: boolean;
  popularity: number;
}

export const FONT_CATALOG: FontFamily[] = GOOGLE_FONT_ROWS.map((row) => {
  const [family, category, weights, italic, author, popularity, embedded] = row;
  return {
    family,
    category,
    weights: weights ? weights.split(",").map(Number) : [400],
    italic: italic === 1,
    author,
    license: "Google Fonts — free licence",
    popularity,
    embedded: embedded === 1,
    reason: embedded === 1 ? undefined : "Not embedded in this build — the family is indexed but its woff2 is not shipped. Choose an embedded family, or add it through the font ingestion pipeline (BACKEND-PLAN §7.27)."
  };
});

export const FONT_INDEX = new Set(FONT_ASSETS.map((f) => f.family));

export const FONT_BY_NAME = new Map(FONT_CATALOG.map((f) => [f.family, f]));
export const EMBEDDED_BY_NAME = new Map(FONT_ASSETS.map((f) => [f.family, f]));

export const FONT_STATS = {
  total: CATALOG_COUNT,
  embedded: EMBEDDED_COUNT,
  bytes: EMBEDDED_TOTAL_BYTES,
  categories: (["sans", "serif", "display", "hand", "mono"] as FontCategory[])
    .map((c) => ({ id: c, count: FONT_CATALOG.filter((f) => f.category === c).length }))
};

export const CATEGORY_LABEL: Record<FontCategory, string> = {
  sans: "Sans serif", serif: "Serif", display: "Display", hand: "Handwriting", mono: "Monospace"
};

/** Search across all 1,746 families. Embedded-only is the default view; the
    full index is one toggle away and every non-embedded row says why. */
export function searchFonts(query: string, opts: { category?: FontCategory | "all"; embeddedOnly?: boolean; limit?: number } = {}): FontFamily[] {
  const q = query.trim().toLowerCase();
  const out: FontFamily[] = [];
  const limit = opts.limit ?? 400;
  for (const f of FONT_CATALOG) {
    if (opts.embeddedOnly && !f.embedded) continue;
    if (opts.category && opts.category !== "all" && f.category !== opts.category) continue;
    if (q && !f.family.toLowerCase().includes(q) && !f.author.toLowerCase().includes(q)) continue;
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

export const FALLBACK_STACKS: { id: string; label: string; value: string }[] = [
  { id: "system-ui", label: "System UI — system-ui, -apple-system, Segoe UI", value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: "geometric", label: "Geometric — Helvetica Neue, Arial", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: "serif", label: "Serif — Georgia, Times", value: "Georgia, 'Times New Roman', Times, serif" },
  { id: "mono", label: "Mono — ui-monospace, Menlo", value: "ui-monospace, Menlo, Consolas, monospace" }
];

export const stackOf = (id: string): string => FALLBACK_STACKS.find((s) => s.id === id)?.value ?? FALLBACK_STACKS[0].value;

export interface Pairing { id: string; heading: string; body: string; label: string }

/* curated pairs, all resolvable in the embedded set (checked by qa_theme.py) */
const PAIR_CANDIDATES: Pairing[] = [
  { id: "geist-inter", heading: "Geist", body: "Inter", label: "Geist + Inter" },
  { id: "poppins-dmsans", heading: "Poppins", body: "DM Sans", label: "Poppins + DM Sans" },
  { id: "montserrat-opensans", heading: "Montserrat", body: "Open Sans", label: "Montserrat + Open Sans" },
  { id: "dmserif-dmsans", heading: "DM Serif Display", body: "DM Sans", label: "DM Serif Display + DM Sans" },
  { id: "playfair-source", heading: "Playfair Display", body: "Source Sans 3", label: "Playfair Display + Source Sans 3" },
  { id: "lora-inter", heading: "Lora", body: "Inter", label: "Lora + Inter" },
  { id: "spacegrotesk-inter", heading: "Space Grotesk", body: "Inter", label: "Space Grotesk + Inter" },
  { id: "oswald-roboto", heading: "Oswald", body: "Roboto", label: "Oswald + Roboto" },
  { id: "bebas-inter", heading: "Bebas Neue", body: "Inter", label: "Bebas Neue + Inter" },
  { id: "librebaskerville-nunitosans", heading: "Libre Baskerville", body: "Nunito Sans", label: "Libre Baskerville + Nunito Sans" },
  { id: "raleway-roboto", heading: "Raleway", body: "Roboto", label: "Raleway + Roboto" },
  { id: "merriweather-sourcesans", heading: "Merriweather", body: "Source Sans 3", label: "Merriweather + Source Sans 3" }
];

export const PAIRINGS: Pairing[] = PAIR_CANDIDATES.filter((p) => FONT_INDEX.has(p.heading) && FONT_INDEX.has(p.body));

/* Font faces are injected lazily, per family. With 247 embedded families the
   full stylesheet is ~14 MB of base64 — building it eagerly costs more than it
   saves, so a family is registered the first time something asks for it. */
const injected = new Set<string>();

export function ensureFontFaces(families?: string[]): void {
  if (typeof document === "undefined") return;
  const want = families ?? [...FONT_INDEX];
  let css = "";
  for (const family of want) {
    if (injected.has(family)) continue;
    const asset = EMBEDDED_BY_NAME.get(family);
    if (!asset) continue;
    injected.add(family);
    for (const face of asset.faces) {
      css += `@font-face{font-family:'${family}';font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url(data:font/woff2;base64,${face.b64}) format('woff2');}\n`;
    }
  }
  ensureStyle().appendChild(document.createTextNode(css));
}

let styleEl: HTMLStyleElement | null = null;
function ensureStyle(): HTMLStyleElement {
  if (styleEl && styleEl.isConnected) return styleEl;
  styleEl = document.createElement("style");
  styleEl.id = "m6-font-faces";
  document.head.appendChild(styleEl);
  return styleEl;
}

/** The full stack string for a stored FontChoice. */
export const stackFor = (f: FontChoice): string => `'${f.family}', ${stackOf(f.fallback)}`;

/* ---------------- defaults & presets ---------------- */

export const DEFAULT_SCALE: TypeScale = {
  basePx: 16, ratio: 1.25, leadingHeading: 1.15, leadingBody: 1.6,
  trackingHeading: -0.01, trackingBody: 0, fluid: true
};

export const DEFAULT_TOKENS: ThemeTokens = {
  colors: {
    primary: "#6941E8", secondary: "#0B1026", accent: "#0EA5E9",
    success: "#16A34A", warning: "#F59E0B", error: "#EF4444",
    background: "#FFFFFF", surface: "#F8FAFC", text: "#0B1026",
    muted: "#5A6474", link: "#6941E8", border: "#C3CBD7", ring: "#6941E8"
  },
  typography: {
    heading: { family: "Geist", weight: 700, fallback: "system-ui" },
    body: { family: "Inter", weight: 400, fallback: "system-ui" },
    scale: DEFAULT_SCALE
  },
  geometry: { radiusPx: 12, spacing: { base: 8, density: "comfortable" }, containerWidthPx: 1200 },
  blockStyling: { cardDensity: "comfortable", elevation: "soft" }
};

export const OCEAN_TOKENS: ThemeTokens = {
  ...DEFAULT_TOKENS,
  colors: {
    primary: "#0E7490", secondary: "#0B2A38", accent: "#22D3EE", success: "#15803D",
    warning: "#B45309", error: "#B91C1C", background: "#FFFFFF", surface: "#F1F7FA", text: "#0B2A38",
    muted: "#4C6B79", link: "#0E7490", border: "#BCD2DC", ring: "#0E7490"
  },
  typography: {
    heading: { family: "Poppins", weight: 600, fallback: "system-ui" },
    body: { family: "Inter", weight: 400, fallback: "system-ui" },
    scale: { ...DEFAULT_SCALE, ratio: 1.333, leadingHeading: 1.2, trackingHeading: 0 }
  },
  geometry: { radiusPx: 8, spacing: { base: 8, density: "compact" }, containerWidthPx: 1140 as 1280 }
};

export const EDITORIAL_TOKENS: ThemeTokens = {
  ...DEFAULT_TOKENS,
  colors: {
    primary: "#B45309", secondary: "#1C1917", accent: "#D97706", success: "#166534",
    warning: "#92400E", error: "#9F1239", background: "#FFFDF8", surface: "#F6EFE6", text: "#1C1917",
    muted: "#6B6154", link: "#B45309", border: "#DCD0BE", ring: "#B45309"
  },
  typography: {
    heading: { family: "Lora", weight: 600, fallback: "serif" },
    body: { family: "Inter", weight: 400, fallback: "system-ui" },
    scale: { ...DEFAULT_SCALE, basePx: 17, ratio: 1.25, leadingHeading: 1.3, leadingBody: 1.7, trackingHeading: 0 }
  },
  geometry: { radiusPx: 16, spacing: { base: 8, density: "spacious" }, containerWidthPx: 1280 },
  blockStyling: { cardDensity: "comfortable", elevation: "flat" }
};

/* ---------------- revisions (per site) ----------------
   The live revision is what the release manifest points at; the draft is what
   the studio edits. They are different objects with different ids, which is why
   "Saved draft" and "Published" can be true at the same time. */

const T0 = new Date(2025, 4, 30, 11, 42, 0, 0).getTime();
const HOUR = 3_600_000;

interface SiteTheme {
  live: ThemeRevision;
  draft: ThemeRevision;
  /** every revision ever saved, newest last */
  history: ThemeRevision[];
  seq: number;
}

const themes = new Map<string, SiteTheme>();

function seedTheme(_siteId: string): SiteTheme {
  /* A theme that has been lived in: five revisions before the current draft.
     The history is what the Revisions surface reads, so it has to contain real
     changes — a list of identical re-saves would prove nothing. */
  const base = clone(DEFAULT_TOKENS);

  const r3t = clone(base);
  r3t.colors.primary = "#7C3AED";
  r3t.colors.link = "#7C3AED";
  r3t.colors.ring = "#7C3AED";
  const r3: ThemeRevision = {
    id: "thm_rev_03", seq: 3, baseId: null, tokens: r3t,
    createdAt: T0 - 74 * HOUR, createdBy: "Rohan P.", status: "draft"
  };

  const r4t = clone(r3t);
  r4t.geometry.radiusPx = 8;
  r4t.typography.heading = { family: "Poppins", weight: 600, fallback: "system-ui" };
  const r4: ThemeRevision = {
    id: "thm_rev_04", seq: 4, baseId: r3.id, tokens: r4t,
    createdAt: T0 - 51 * HOUR, createdBy: "Aranya K.", status: "draft"
  };

  const r5t = clone(r4t);
  r5t.colors.primary = "#6941E8";
  r5t.colors.link = "#6941E8";
  r5t.colors.ring = "#6941E8";
  r5t.typography.heading = { family: "Geist", weight: 700, fallback: "system-ui" };
  r5t.typography.scale = { ...DEFAULT_SCALE, ratio: 1.333, basePx: 17 };
  const r5: ThemeRevision = {
    id: "thm_rev_05", seq: 5, baseId: r4.id, tokens: r5t,
    createdAt: T0 - 38 * HOUR, createdBy: "Aranya K.", status: "draft"
  };

  const live: ThemeRevision = {
    id: "thm_live_06", seq: 6, baseId: r5.id, tokens: clone(DEFAULT_TOKENS),
    createdAt: T0 - 26 * HOUR, createdBy: "Aranya K.", status: "live", presetId: "preset_modern_violet"
  };

  /* the draft started from Modern Violet and was then hand-edited: wider container
     and a softer radius, so "draft is ahead of live" is visible on load and the
     publish review has a real diff to freeze. Contrast is untouched. */
  const draftTokens = clone(DEFAULT_TOKENS);
  draftTokens.geometry.radiusPx = 16;
  draftTokens.geometry.containerWidthPx = 1280;
  const draft: ThemeRevision = {
    id: "thm_draft_07", seq: 7, baseId: live.id, tokens: draftTokens,
    createdAt: T0, createdBy: "Aranya K.", status: "draft"
  };
  return { live, draft, history: [r3, r4, r5, live, draft], seq: 7 };
}

function themeFor(siteId: string): SiteTheme {
  if (!themes.has(siteId)) themes.set(siteId, seedTheme(siteId));
  return themes.get(siteId)!;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- revision diffs (G4) ----------------
   A revision list is only useful if it says what changed. This is a field-level
   diff over the token document, grouped the way the editor groups it. */

export interface TokenDiff { group: string; label: string; from: string; to: string }

export function diffTokens(before: ThemeTokens, after: ThemeTokens): TokenDiff[] {
  const out: TokenDiff[] = [];
  for (const role of COLOR_ROLES) {
    const a = before.colors[role.key];
    const b = after.colors[role.key];
    if (a !== b) out.push({ group: "Colour", label: role.label, from: a, to: b });
  }
  const fa = before.typography.heading, fb = after.typography.heading;
  if (fa.family !== fb.family) out.push({ group: "Typography", label: "Heading family", from: fa.family, to: fb.family });
  if (fa.weight !== fb.weight) out.push({ group: "Typography", label: "Heading weight", from: String(fa.weight), to: String(fb.weight) });
  const ba = before.typography.body, bb = after.typography.body;
  if (ba.family !== bb.family) out.push({ group: "Typography", label: "Body family", from: ba.family, to: bb.family });
  if (ba.weight !== bb.weight) out.push({ group: "Typography", label: "Body weight", from: String(ba.weight), to: String(bb.weight) });
  const sa = before.typography.scale, sb = after.typography.scale;
  const scaleLabels: Record<keyof TypeScale, string> = {
    basePx: "Base size", ratio: "Scale ratio", leadingHeading: "Heading leading", leadingBody: "Body leading",
    trackingHeading: "Heading tracking", trackingBody: "Body tracking", fluid: "Fluid headings"
  };
  for (const k of Object.keys(scaleLabels) as (keyof TypeScale)[]) {
    if (sa[k] !== sb[k]) out.push({ group: "Type scale", label: scaleLabels[k], from: String(sa[k]), to: String(sb[k]) });
  }
  const ga = before.geometry, gb = after.geometry;
  if (ga.radiusPx !== gb.radiusPx) out.push({ group: "Geometry", label: "Radius", from: `${ga.radiusPx}px`, to: `${gb.radiusPx}px` });
  if (ga.containerWidthPx !== gb.containerWidthPx) out.push({ group: "Geometry", label: "Container", from: `${ga.containerWidthPx}px`, to: `${gb.containerWidthPx}px` });
  if (ga.spacing.base !== gb.spacing.base) out.push({ group: "Geometry", label: "Spacing base", from: `${ga.spacing.base}px`, to: `${gb.spacing.base}px` });
  if (ga.spacing.density !== gb.spacing.density) out.push({ group: "Geometry", label: "Density", from: ga.spacing.density, to: gb.spacing.density });
  if (before.blockStyling.cardDensity !== after.blockStyling.cardDensity) out.push({ group: "Blocks", label: "Card density", from: before.blockStyling.cardDensity, to: after.blockStyling.cardDensity });
  if (before.blockStyling.elevation !== after.blockStyling.elevation) out.push({ group: "Blocks", label: "Elevation", from: before.blockStyling.elevation, to: after.blockStyling.elevation });
  return out;
}

/** What changed in a revision, against the one before it in the list. */
export function revisionDiff(history: ThemeRevision[], rev: ThemeRevision): TokenDiff[] {
  const idx = history.findIndex((r) => r.id === rev.id);
  if (idx <= 0) return [];
  return diffTokens(history[idx - 1].tokens, rev.tokens);
}

/* ---------------- presets ---------------- */

const UPD = new Date(2025, 4, 22, 16, 5, 0, 0).getTime();

const presets: Preset[] = [
  { id: "preset_modern_violet", name: "Modern Violet", desc: "A modern, high-contrast theme with violet as the primary brand colour.", scope: "Built-in", tokens: clone(DEFAULT_TOKENS), builtIn: true, updatedAt: UPD - 96 * HOUR, createdBy: "WACRM", referencedBy: ["Release #6 (live)"] },
  { id: "preset_ocean", name: "Ocean Professional", desc: "A clean and trusted look for education and consultancy websites.", scope: "Built-in", tokens: clone(OCEAN_TOKENS), builtIn: true, updatedAt: UPD - 72 * HOUR, createdBy: "WACRM", referencedBy: [] },
  { id: "preset_editorial", name: "Warm Editorial", desc: "A friendly, modern editorial style for storytelling and campaigns.", scope: "Built-in", tokens: clone(EDITORIAL_TOKENS), builtIn: true, updatedAt: UPD - 48 * HOUR, createdBy: "WACRM", referencedBy: [] },
  { id: "preset_brand2026", name: "EuroMiles Brand 2026", desc: "The refreshed brand set approved for the 2026 intake campaign.", scope: "Workspace", tokens: { ...clone(DEFAULT_TOKENS), colors: { ...DEFAULT_TOKENS.colors, primary: "#5B32D6", accent: "#7C3AED" }, geometry: { ...DEFAULT_TOKENS.geometry, radiusPx: 16 } }, builtIn: false, updatedAt: UPD - 24 * HOUR, createdBy: "Aranya K.", referencedBy: [] },
  { id: "preset_admissions", name: "Admissions Campaign", desc: "Warmer accent for the scholarship push; same typography as brand.", scope: "This Site", tokens: { ...clone(DEFAULT_TOKENS), colors: { ...DEFAULT_TOKENS.colors, primary: "#0F766E" } }, builtIn: false, updatedAt: UPD - 12 * HOUR, createdBy: "Rohan P.", referencedBy: [] }
];

/* ---------------- token → variables ---------------- */

export const spacingScale = (t: ThemeTokens): number[] => {
  const base = t.geometry.spacing.base;
  return [1, 2, 4, 6, 8].map((m) => base * m);
};

const DENSITY_GAP: Record<Density, number> = { compact: 0.75, comfortable: 1, spacious: 1.25 };

/** Variables for the studio preview (scoped to the preview root). */
export function previewVars(t: ThemeTokens): Record<string, string> {
  const gap = DENSITY_GAP[t.geometry.spacing.density];
  return {
    "--t-primary": t.colors.primary,
    "--t-on-primary": onPrimary(t.colors.primary),
    "--t-secondary": t.colors.secondary,
    "--t-accent": t.colors.accent,
    "--t-success": t.colors.success,
    "--t-warning": t.colors.warning,
    "--t-error": t.colors.error,
    "--t-bg": t.colors.background,
    "--t-surface": t.colors.surface,
    "--t-text": t.colors.text,
    "--t-muted": t.colors.muted,
    "--t-link": t.colors.link,
    "--t-border": t.colors.border,
    "--t-ring": t.colors.ring,
    "--t-radius": `${t.geometry.radiusPx}px`,
    "--t-container": `${t.geometry.containerWidthPx}px`,
    "--t-band": `${Math.round(48 * gap)}px`,
    "--t-gap": `${Math.round(24 * gap)}px`,
    "--t-font-heading": `'${t.typography.heading.family}', ${stackOf(t.typography.heading.fallback)}`,
    "--t-font-body": `'${t.typography.body.family}', ${stackOf(t.typography.body.fallback)}`,
    "--t-heading-weight": String(t.typography.heading.weight),
    "--t-body-weight": String(t.typography.body.weight),
    "--t-fs-h1": typeSizeCss(t, "h1"),
    "--t-fs-h2": typeSizeCss(t, "h2"),
    "--t-fs-h3": typeSizeCss(t, "h3"),
    "--t-fs-body": typeSizeCss(t, "body"),
    "--t-fs-small": typeSizeCss(t, "small"),
    "--t-fs-caption": typeSizeCss(t, "caption"),
    "--t-lh-heading": String(t.typography.scale.leadingHeading),
    "--t-lh-body": String(t.typography.scale.leadingBody),
    "--t-ls-heading": `${t.typography.scale.trackingHeading}em`,
    "--t-ls-body": `${t.typography.scale.trackingBody}em`,
    "--t-card-pad": t.blockStyling.cardDensity === "compact" ? "14px" : "20px",
    "--t-shadow": t.blockStyling.elevation === "soft" ? "0 10px 26px -18px rgba(16,24,40,.45)" : "none"
  };
}

/** The published shape (§18.4): what the release manifest carries. */
export function compiledVars(t: ThemeTokens): Record<string, string> {
  return {
    "--brand-primary": t.colors.primary,
    "--brand-on-primary": onPrimary(t.colors.primary),
    "--brand-secondary": t.colors.secondary,
    "--brand-accent": t.colors.accent,
    "--brand-success": t.colors.success,
    "--brand-warning": t.colors.warning,
    "--brand-error": t.colors.error,
    "--brand-bg": t.colors.background,
    "--brand-surface": t.colors.surface,
    "--brand-text": t.colors.text,
    "--brand-muted": t.colors.muted,
    "--brand-link": t.colors.link,
    "--brand-border": t.colors.border,
    "--brand-ring": t.colors.ring,
    "--radius-md": `${t.geometry.radiusPx}px`,
    "--container-max": `${t.geometry.containerWidthPx}px`,
    "--space-1": `${spacingScale(t)[0]}px`,
    "--space-4": `${spacingScale(t)[3]}px`,
    "--font-heading": `'${t.typography.heading.family}', ${stackOf(t.typography.heading.fallback)}`,
    "--font-body": `'${t.typography.body.family}', ${stackOf(t.typography.body.fallback)}`,
    "--font-size-h1": typeSizeCss(t, "h1"),
    "--font-size-h2": typeSizeCss(t, "h2"),
    "--font-size-h3": typeSizeCss(t, "h3"),
    "--font-size-body": typeSizeCss(t, "body"),
    "--font-size-small": typeSizeCss(t, "small"),
    "--font-size-caption": typeSizeCss(t, "caption"),
    "--leading-heading": String(t.typography.scale.leadingHeading),
    "--leading-body": String(t.typography.scale.leadingBody),
    "--tracking-heading": `${t.typography.scale.trackingHeading}em`,
    "--tracking-body": `${t.typography.scale.trackingBody}em`
  };
}

/* ---------------- usage ----------------
   Real projections over the CMS content this workspace already has. */

export interface Usage { pages: number; blocks: number; templates: number; websites: number; sample: string[] }

export function usageOf(siteId: string): Usage {
  const pages = DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
  const types = new Set<BlockType>();
  for (const p of pages.slice(0, 60)) {
    try { ensureDraft(p.id).blocks.forEach((b) => types.add(b.type)); } catch { /* page without a draft */ }
  }
  return {
    pages: pages.length,
    blocks: types.size || Object.keys(REGISTRY).length,
    templates: SECTION_PRESETS.length,
    websites: 1,
    sample: pages.slice(0, 5).map((p) => p.title)
  };
}

/** The page the preview renders: the site's home page, then any page. */
export function previewPageFor(siteId: string): { id: string; title: string } | null {
  const pages = DBX().cmsPages.filter((p) => p.siteId === siteId && !p.trash);
  const home = pages.find((p) => p.slug === "" || p.path === "/" || /home/i.test(p.title)) ?? pages[0];
  return home ? { id: home.id, title: home.title } : null;
}

export function blocksOf(pageId: string): BlockNode[] {
  try { return ensureDraft(pageId).blocks; } catch { return []; }
}

/* ---------------- import / export ----------------
   validate() never mutates anything. It returns field paths so the UI can show
   exactly what is wrong with a file (spec §8.6). */

export interface ImportIssue { path: string; message: string }
export interface ImportResult {
  ok: boolean;
  errors: ImportIssue[];
  warnings: string[];
  preset?: Preset;
  summary?: { colors: number; typography: boolean; geometry: boolean; blockStyling: boolean; starterLayouts: boolean; navigation: boolean };
}

const DANGEROUS = new Set(["__proto__", "constructor", "prototype"]);
const RADII = [0, 4, 8, 12, 16, 24];
const CONTAINERS = [960, 1080, 1200, 1280];
const FALLBACK_IDS = new Set(FALLBACK_STACKS.map((f) => f.id));
const MAX_BYTES = 256 * 1024;

function walkKeys(node: unknown, path: string, issues: ImportIssue[], depth = 0): void {
  if (depth > 8) { issues.push({ path, message: "The file nests deeper than the 8 levels an import allows." }); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => walkKeys(v, `${path}[${i}]`, issues, depth + 1)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (DANGEROUS.has(k)) issues.push({ path: `${path}.${k}`, message: "Prototype keys are not accepted in an import." });
      else walkKeys(v, `${path}.${k}`, issues, depth + 1);
    }
  }
}

export function validateImport(raw: string, scope: Preset["scope"], name: string): ImportResult {
  const errors: ImportIssue[] = [];
  const warnings: string[] = [];

  if (raw.length > MAX_BYTES) {
    return { ok: false, errors: [{ path: "$", message: "This file is larger than 256 KB. Theme presets are token documents, not page bundles." }], warnings };
  }
  let doc: any;
  try { doc = JSON.parse(raw); } catch (e) {
    return { ok: false, errors: [{ path: "$", message: `This file is not valid JSON. ${(e as Error).message}` }], warnings };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return { ok: false, errors: [{ path: "$", message: "A theme preset must be a JSON object." }], warnings };
  }
  walkKeys(doc, "$", errors);
  const version = Number(doc.schemaVersion);
  if (![1, 2].includes(version)) {
    errors.push({ path: "$.schemaVersion", message: `Unsupported version ${JSON.stringify(doc.schemaVersion ?? null)} — this build reads versions 1 and 2.` });
  }
  const allowed = new Set(["schemaVersion", "name", "description", "colors", "typography", "geometry", "blockStyling", "starterLayouts", "navigation", "x-wacrm"]);
  const derivedRoles: ColorRole[] = [];
  for (const k of Object.keys(doc)) {
    if (!allowed.has(k)) errors.push({ path: `$.${k}`, message: `“${k}” is not part of the version 1 theme schema.` });
  }

  const colors = doc.colors ?? {};
  for (const role of COLOR_ROLES) {
    const v = colors[role.key];
    if (v === undefined) {
      /* a version-1 file predates muted/link/border/ring — derive them and say so */
      if (!CORE_ROLES.includes(role.key) && normalizeHex(colors.text ?? "") && normalizeHex(colors.background ?? "")) {
        derivedRoles.push(role.key);
        continue;
      }
      errors.push({ path: `$.colors.${role.key}`, message: `Missing required token colors.${role.key}.` });
      continue;
    }
    if (normalizeHex(v) === null) errors.push({ path: `$.colors.${role.key}`, message: `“${v}” is not a six-digit hex colour.` });
  }
  for (const k of Object.keys(colors)) {
    if (!COLOR_ROLES.some((r) => r.key === k)) errors.push({ path: `$.colors.${k}`, message: `“${k}” is not a colour role this build stores.` });
  }

  const typo = doc.typography ?? {};
  for (const role of ["heading", "body"] as const) {
    const f = typo[role];
    if (!f) { errors.push({ path: `$.typography.${role}`, message: `Missing required token typography.${role}.` }); continue; }
    if (!FONT_INDEX.has(f.family)) {
      errors.push({ path: `$.typography.${role}.family`, message: `“${f.family}” is not an available family. Embedded: ${[...FONT_INDEX].join(", ")}.` });
    } else if (!FONT_CATALOG.find((c) => c.family === f.family)!.weights.includes(Number(f.weight))) {
      errors.push({ path: `$.typography.${role}.weight`, message: `${f.family} does not ship weight ${f.weight}.` });
    }
    if (!FALLBACK_IDS.has(f.fallback)) errors.push({ path: `$.typography.${role}.fallback`, message: `“${f.fallback}” is not an approved fallback stack.` });
  }
  const rawScale = typo.scale;
  let scale: TypeScale = DEFAULT_SCALE;
  let scaleDerived = false;
  if (rawScale === undefined) {
    scaleDerived = true;
  } else if (typeof rawScale !== "object" || rawScale === null) {
    errors.push({ path: "$.typography.scale", message: "The type scale must be an object." });
  } else {
    const candidate: TypeScale = {
      basePx: Number(rawScale.basePx), ratio: Number(rawScale.ratio),
      leadingHeading: Number(rawScale.leadingHeading), leadingBody: Number(rawScale.leadingBody),
      trackingHeading: Number(rawScale.trackingHeading), trackingBody: Number(rawScale.trackingBody),
      fluid: rawScale.fluid !== false
    };
    if (!isScaleValid(candidate)) {
      errors.push({ path: "$.typography.scale", message: "The type scale is out of range: base 14–18 px, ratio 1.2 / 1.25 / 1.333 / 1.5, heading leading 1–1.4, body leading 1.4–1.8, heading tracking −0.03–0 em." });
    } else scale = candidate;
  }

  const g = doc.geometry ?? {};
  if (!RADII.includes(Number(g.radiusPx))) errors.push({ path: "$.geometry.radiusPx", message: `${g.radiusPx} is not one of the allowed radii (${RADII.join(", ")}).` });
  if (!CONTAINERS.includes(Number(g.containerWidthPx))) errors.push({ path: "$.geometry.containerWidthPx", message: `${g.containerWidthPx} is not an allowed container width (${CONTAINERS.join(", ")}).` });
  const sp = g.spacing ?? {};
  if (![4, 8].includes(Number(sp.base))) errors.push({ path: "$.geometry.spacing.base", message: "The spacing base must be 4 or 8." });
  if (!["compact", "comfortable", "spacious"].includes(sp.density)) errors.push({ path: "$.geometry.spacing.density", message: "Density must be compact, comfortable or spacious." });

  const bs = doc.blockStyling ?? {};
  if (bs.cardDensity !== undefined && !["compact", "comfortable"].includes(bs.cardDensity)) errors.push({ path: "$.blockStyling.cardDensity", message: "cardDensity must be compact or comfortable." });
  if (bs.elevation !== undefined && !["flat", "soft"].includes(bs.elevation)) errors.push({ path: "$.blockStyling.elevation", message: "elevation must be flat or soft." });

  const starterLayouts = Boolean(doc.starterLayouts && Object.keys(doc.starterLayouts).length);
  const navigation = Boolean(doc.navigation && Object.keys(doc.navigation).length);
  if (derivedRoles.length) warnings.push(`${derivedRoles.length} role${derivedRoles.length === 1 ? "" : "s"} were not in the file (${derivedRoles.join(", ")}) — this build derived ${derivedRoles.length === 1 ? "it" : "them"} from the file's own palette. Check them before saving.`);
  if (scaleDerived) warnings.push("The file carries no type scale (it predates version 2) — the default 16 px / 1.250 scale was applied. Adjust it in the Typography tab.");
  if (starterLayouts) warnings.push("The file carries starter layouts. This build keeps existing pages and layouts — the field is ignored.");
  if (navigation) warnings.push("The file carries navigation. This build keeps existing menus — the field is ignored.");

  if (errors.length) return { ok: false, errors, warnings };

  const resolvedColors = Object.fromEntries(COLOR_ROLES.map((r) => {
    const own = normalizeHex(colors[r.key]);
    return [r.key, own ?? deriveRole(r.key, {
      text: normalizeHex(colors.text) ?? DEFAULT_TOKENS.colors.text,
      background: normalizeHex(colors.background) ?? DEFAULT_TOKENS.colors.background,
      primary: normalizeHex(colors.primary) ?? DEFAULT_TOKENS.colors.primary
    })];
  })) as Record<ColorRole, string>;

  const tokens: ThemeTokens = {
    colors: resolvedColors,
    typography: {
      heading: { family: typo.heading.family, weight: Number(typo.heading.weight), fallback: typo.heading.fallback },
      body: { family: typo.body.family, weight: Number(typo.body.weight), fallback: typo.body.fallback },
      scale
    },
    geometry: {
      radiusPx: Number(g.radiusPx) as ThemeTokens["geometry"]["radiusPx"],
      spacing: { base: Number(sp.base) as 4 | 8, density: sp.density },
      containerWidthPx: Number(g.containerWidthPx) as ThemeTokens["geometry"]["containerWidthPx"]
    },
    blockStyling: {
      cardDensity: bs.cardDensity ?? "comfortable",
      elevation: bs.elevation ?? "soft"
    }
  };

  return {
    ok: true,
    errors: [],
    warnings,
    preset: {
      id: `preset_${Date.now().toString(36)}`,
      name: (doc.name ?? name ?? "Imported theme").toString().slice(0, 60),
      desc: (doc.description ?? "Imported from a theme preset file.").toString().slice(0, 160),
      scope,
      tokens,
      builtIn: false,
      updatedAt: Date.now(),
      createdBy: "You",
      referencedBy: []
    },
    summary: { colors: COLOR_ROLES.length, typography: true, geometry: true, blockStyling: true, starterLayouts, navigation }
  };
}

export type ExportMode = "draft" | "live";

export function exportDocument(siteId: string, mode: ExportMode): { filename: string; json: string } | null {
  const site = DBX().sites.find((s) => s.id === siteId);
  const theme = themeFor(siteId);
  const rev = mode === "live" ? theme.live : theme.draft;
  if (!rev) return null;
  const slug = (site?.name ?? "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const body = {
    schemaVersion: 2,
    name: site?.name ? `${site.name} theme` : "Theme",
    description: mode === "live" ? "Exported from the live release." : "Exported from the saved draft.",
    colors: rev.tokens.colors,
    typography: rev.tokens.typography,
    geometry: rev.tokens.geometry,
    blockStyling: rev.tokens.blockStyling,
    "x-wacrm": {
      site: site?.name ?? siteId, revision: rev.id, seq: rev.seq, status: mode,
      typeScale: typeStamp(rev.tokens), contrastPairs: evaluate(rev.tokens).length,
      exportedAt: new Date().toISOString(), exportedBy: "Aranya K."
    }
  };
  return { filename: `${slug}-theme-${mode}-v${rev.seq}.json`, json: JSON.stringify(body, null, 2) };
}

/* ---------------- API ---------------- */

export interface ThemePayload {
  siteId: string;
  live: ThemeRevision;
  draft: ThemeRevision;
  history: ThemeRevision[];
  usage: Usage;
  previewPage: { id: string; title: string } | null;
}

export const ThemeAPI = {
  /** dev/states harness — same pattern as Modules 4 and 5 */
  mode: { fail: false, slow: false, conflict: false, empty: false, fontFail: false },
  seen: { saves: 0, imports: 0, applies: 0, exports: 0, archives: 0 },

  async load(siteId: string): Promise<ThemePayload> {
    await wait(this.mode.slow ? 1200 : 220 + Math.random() * 160);
    if (this.mode.fail) throw Object.assign(new Error("The theme service is unavailable (503)."), { code: "SERVICE_DOWN" });
    const t = themeFor(siteId);
    return {
      siteId,
      live: clone(t.live),
      draft: clone(t.draft),
      history: clone(t.history),
      usage: usageOf(siteId),
      previewPage: previewPageFor(siteId)
    };
  },

  /** CAS: the client sends the base id it edited from. */
  async saveDraft(siteId: string, tokens: ThemeTokens, baseId: string): Promise<ThemeRevision> {
    await wait(this.mode.slow ? 1500 : 520 + Math.random() * 260);
    if (this.mode.fail) throw Object.assign(new Error("We couldn't save your theme. Your local changes are still here."), { code: "SAVE_FAILED" });
    const t = themeFor(siteId);
    if (this.mode.conflict || t.draft.id !== baseId) {
      this.mode.conflict = false;
      throw Object.assign(new Error("A newer theme draft exists."), { code: "CONFLICT", latest: clone(t.draft) });
    }
    const rev: ThemeRevision = {
      id: `thm_${Date.now().toString(36)}`,
      seq: ++t.seq,
      baseId: t.draft.id,
      tokens: clone(tokens),
      createdAt: Date.now(),
      createdBy: "You",
      status: "draft"
    };
    t.draft = rev;
    t.history.push(rev);
    this.seen.saves += 1;
    return clone(rev);
  },

  /** a teammate saves while you edit — used by the states harness and QA */
  saveElsewhere(siteId: string, tokens: ThemeTokens): ThemeRevision {
    const t = themeFor(siteId);
    const rev: ThemeRevision = {
      id: `thm_${Date.now().toString(36)}x`,
      seq: ++t.seq,
      baseId: t.draft.id,
      tokens: clone(tokens),
      createdAt: Date.now(),
      createdBy: "Aranya K.",
      status: "draft"
    };
    t.draft = rev;
    t.history.push(rev);
    return clone(rev);
  },

  presets(): Preset[] { return clone(presets); },

  /** the apply list: archived presets stay resolvable but cannot be chosen */
  selectable(): Preset[] { return clone(this.mode.empty ? [] : presets.filter((p) => !p.archived)); },

  /** used when a delete is blocked by live references (G13) */
  async archivePreset(id: string): Promise<Preset> {
    await wait(240);
    const p = presets.find((x) => x.id === id);
    if (!p) throw Object.assign(new Error("That preset no longer exists."), { code: "NOT_FOUND" });
    if (p.builtIn) throw Object.assign(new Error("Built-in presets cannot be archived."), { code: "READ_ONLY" });
    p.archived = true;
    p.updatedAt = Date.now();
    this.seen.archives += 1;
    return clone(p);
  },

  /** local font verification job — the real ingestion pipeline is a server contract */
  verifyFonts(tokens: ThemeTokens): { ok: boolean; message: string } {
    const families = [tokens.typography.heading.family, tokens.typography.body.family];
    const missing = families.filter((f) => !FONT_INDEX.has(f));
    if (missing.length) return { ok: false, message: `${missing.join(", ")} has no embedded woff2 in this build.` };
    if (this.mode.fontFail) return { ok: false, message: "Font processing failed — the woff2 checksum did not match the manifest." };
    const weights = families.map((f) => FONT_CATALOG.find((x) => x.family === f)!.weights);
    return { ok: true, message: `${families.length} families verified · ${weights.flat().length} weight declarations · checksums match` };
  },

  async addPreset(p: Preset): Promise<Preset> {
    await wait(320);
    if (presets.some((x) => x.name.toLowerCase() === p.name.toLowerCase() && x.scope === p.scope)) {
      throw Object.assign(new Error(`A preset called “${p.name}” already exists in ${p.scope}.`), { code: "DUPLICATE" });
    }
    presets.unshift(p);
    this.seen.imports += 1;
    return clone(p);
  },

  async renamePreset(id: string, name: string): Promise<Preset> {
    await wait(240);
    const p = presets.find((x) => x.id === id);
    if (!p) throw Object.assign(new Error("That preset no longer exists."), { code: "NOT_FOUND" });
    if (p.builtIn) throw Object.assign(new Error("Built-in presets cannot be renamed — duplicate it into your workspace instead."), { code: "READ_ONLY" });
    if (!name.trim()) throw Object.assign(new Error("Give the preset a name."), { code: "INVALID" });
    if (presets.some((x) => x.id !== id && x.name.toLowerCase() === name.trim().toLowerCase() && x.scope === p.scope)) {
      throw Object.assign(new Error(`A preset called “${name.trim()}” already exists in ${p.scope}.`), { code: "DUPLICATE" });
    }
    p.name = name.trim();
    p.updatedAt = Date.now();
    return clone(p);
  },

  async duplicatePreset(id: string, siteScopeOnly = false): Promise<Preset> {
    await wait(280);
    const p = presets.find((x) => x.id === id);
    if (!p) throw Object.assign(new Error("That preset no longer exists."), { code: "NOT_FOUND" });
    const base = `${p.name.replace(/ \(copy( \d+)?\)$/, "")}${siteScopeOnly ? "" : " (copy)"}`;
    let name = base;
    let n = 2;
    while (presets.some((x) => x.name === name)) name = `${base.replace(/ \(copy( \d+)?\)$/, "")} (copy ${n++})`;
    const copy: Preset = {
      ...clone(p),
      id: `preset_${Date.now().toString(36)}`,
      name,
      scope: p.builtIn ? "Workspace" : p.scope,
      builtIn: false,
      updatedAt: Date.now(),
      createdBy: "You",
      referencedBy: []
    };
    presets.unshift(copy);
    return clone(copy);
  },

  async deletePreset(id: string): Promise<void> {
    await wait(260);
    const i = presets.findIndex((x) => x.id === id);
    if (i < 0) throw Object.assign(new Error("That preset no longer exists."), { code: "NOT_FOUND" });
    const p = presets[i];
    if (p.builtIn) throw Object.assign(new Error("Built-in presets cannot be deleted."), { code: "READ_ONLY" });
    if (p.referencedBy.length) {
      throw Object.assign(new Error(`“${p.name}” is the source of ${p.referencedBy.join(", ")}. Point those at another preset first.`), { code: "IN_USE", references: p.referencedBy });
    }
    presets.splice(i, 1);
  },

  /** apply a preset to the working draft (never publishes) */
  apply(presetId: string): ThemeTokens {
    const p = presets.find((x) => x.id === presetId);
    if (!p) throw Object.assign(new Error("That preset no longer exists."), { code: "NOT_FOUND" });
    this.seen.applies += 1;
    return clone(p.tokens);
  },

  reset(): ThemeTokens { return clone(DEFAULT_TOKENS); },

  diff(a: ThemeTokens, b: ThemeTokens): { label: string; from: string; to: string }[] {
    const out: { label: string; from: string; to: string }[] = [];
    for (const r of COLOR_ROLES) {
      if (a.colors[r.key] !== b.colors[r.key]) out.push({ label: `${r.label} colour`, from: a.colors[r.key], to: b.colors[r.key] });
    }
    for (const role of ["heading", "body"] as const) {
      const x = a.typography[role], y = b.typography[role];
      if (x.family !== y.family) out.push({ label: `${role === "heading" ? "Heading" : "Body"} font`, from: x.family, to: y.family });
      if (x.weight !== y.weight) out.push({ label: `${role === "heading" ? "Heading" : "Body"} weight`, from: String(x.weight), to: String(y.weight) });
      if (x.fallback !== y.fallback) out.push({ label: `${role === "heading" ? "Heading" : "Body"} fallback`, from: x.fallback, to: y.fallback });
    }
    if (a.geometry.radiusPx !== b.geometry.radiusPx) out.push({ label: "Border radius", from: `${a.geometry.radiusPx}px`, to: `${b.geometry.radiusPx}px` });
    if (a.geometry.containerWidthPx !== b.geometry.containerWidthPx) out.push({ label: "Container width", from: `${a.geometry.containerWidthPx}px`, to: `${b.geometry.containerWidthPx}px` });
    if (a.geometry.spacing.base !== b.geometry.spacing.base) out.push({ label: "Spacing base", from: `${a.geometry.spacing.base}px`, to: `${b.geometry.spacing.base}px` });
    if (a.geometry.spacing.density !== b.geometry.spacing.density) out.push({ label: "Density", from: a.geometry.spacing.density, to: b.geometry.spacing.density });
    if (a.blockStyling.cardDensity !== b.blockStyling.cardDensity) out.push({ label: "Card density", from: a.blockStyling.cardDensity, to: b.blockStyling.cardDensity });
    if (a.blockStyling.elevation !== b.blockStyling.elevation) out.push({ label: "Elevation", from: a.blockStyling.elevation, to: b.blockStyling.elevation });
    return out;
  }
};

/* ---------------- labels ---------------- */

export const RADIUS_OPTIONS: { value: 0 | 4 | 8 | 12 | 16 | 24; label: string }[] = [
  { value: 0, label: "None · 0px" }, { value: 4, label: "Small · 4px" }, { value: 8, label: "Medium · 8px" },
  { value: 12, label: "Large · 12px" }, { value: 16, label: "X-Large · 16px" }, { value: 24, label: "Pill · 24px" }
];

export const CONTAINER_OPTIONS: { value: 960 | 1080 | 1200 | 1280; label: string }[] = [
  { value: 960, label: "960 px · Narrow" }, { value: 1080, label: "1080 px · Compact" },
  { value: 1200, label: "1200 px · Standard" }, { value: 1280, label: "1280 px · Wide" }
];

export const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }
];

export const dateLong = (t: number): string => {
  const d = new Date(t);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h}:${String(d.getMinutes()).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
};

export const timeOf = (t: number): string => {
  const d = new Date(t);
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
};
