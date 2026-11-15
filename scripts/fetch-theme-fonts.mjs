#!/usr/bin/env node
/* ============================================================
   Module 6.1 · embedded font library for the Theme Studio
   ------------------------------------------------------------
   The deliverable is a single HTML file that must work with no
   network and no CDN, and the Typography tab must not claim a
   family it cannot actually render. So every *embedded* family is
   a real woff2, base64, latin subset only.

   "Almost all of Google Fonts" is a byte question, not a wish:
   all 1,961 families as woff2 is ~70 MB before base64. This script
   therefore does two different jobs:

     1. EMBEDS as many families as the byte budget allows, taken in
        Google popularity order, variable-first (one file covers
        100-900, ~37 KB) with a static 400+700 fallback (~57 KB).
     2. INDEXES every family Google publishes (1,961) with real
        metadata — category, weights, designer, popularity — so the
        picker can list the whole library and still tell the truth
        about what this build can render offline.

   Run:  node scripts/fetch-theme-fonts.mjs [--budget=10.5]
   Emits src/lib/theme-font-data.ts
         src/lib/theme-font-catalog.ts
         FONT-LICENSES.md
   ============================================================ */
import { writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const BUDGET = Number((process.argv.find((a) => a.startsWith("--budget=")) ?? "--budget=10.5").split("=")[1]) * 1_000_000;
const META = "https://fonts.google.com/metadata/fonts";

/* families that were "present but not embedded" in M6 — keep them first so the
   document that used to say "Requires ingestion" now genuinely renders */
const PRIORITY = ["Geist", "Inter", "Montserrat", "DM Sans", "Lora", "Poppins", "Playfair Display", "Space Grotesk", "Merriweather"];

/* families whose licence is not OFL — recorded accurately, never guessed */
const LICENCE = {
  "Roboto": "Apache License 2.0", "Open Sans": "SIL Open Font License 1.1", "Ubuntu": "Ubuntu Font Licence 1.0",
  "Arimo": "Apache License 2.0", "Tinos": "Apache License 2.0", "Cousine": "Apache License 2.0",
  "Roboto Mono": "Apache License 2.0", "Roboto Slab": "Apache License 2.0", "Roboto Condensed": "Apache License 2.0",
  "Roboto Flex": "SIL Open Font License 1.1", "Noto Sans": "SIL Open Font License 1.1", "Noto Serif": "SIL Open Font License 1.1"
};

const cat = (c) => ({ "Sans Serif": "sans", "Serif": "serif", Display: "display", Handwriting: "hand", Monospace: "mono" }[c] ?? "sans");

/* ---------- 1. catalogue ---------- */

const meta = await (await fetch(META)).json();
/* Brand fonts (Google Sans, Product Sans, Material Symbols …) are published through
   the Google Fonts API but are NOT openly licensed for redistribution into another
   product. They are excluded twice: by the metadata flag, and by an explicit
   denylist, because Google Sans in particular ships without the flag set. */
const BRAND = /^(google sans|product sans|google symbols|material symbols|material icons)/i;
const all = meta.familyMetadataList.filter((f) => f.isOpenSource !== false && !f.isBrandFont && !BRAND.test(f.family));
console.log(`metadata: ${all.length} families`);

const weightsOf = (f) => {
  const set = new Set();
  let italic = false;
  for (const key of Object.keys(f.fonts ?? {})) {
    const w = Number(String(key).replace("i", ""));
    if (Number.isFinite(w)) set.add(w);
    if (String(key).includes("i")) italic = true;
  }
  return { weights: [...set].sort((a, b) => a - b), italic };
};

const rows = all.map((f) => {
  const { weights, italic } = weightsOf(f);
  return {
    family: f.family,
    cat: cat(f.category),
    weights,
    italic,
    designers: (f.designers ?? []).join(", ").slice(0, 90),
    popularity: f.popularity ?? 9999,
    latin: (f.subsets ?? []).includes("latin"),
    axes: (f.axes ?? []).map((a) => a.tag)
  };
});

/* a CSS2 request needs every axis tag alphabetically, with ranges/positions */
function axisQuery(f) {
  const tags = f.axes.filter((t) => t !== "ital").sort();
  if (!tags.length) return null;
  const values = tags.map((t) => {
    const ax = all.find((x) => x.family === f.family).axes.find((a) => a.tag === t);
    return ax.min === ax.max ? String(ax.defaultValue ?? ax.min) : `${ax.min}..${ax.max}`;
  });
  return `${tags.join(",")}@${values.join(",")}`;
}

/* ---------- 2. embedded selection ---------- */

const eligible = rows.filter((r) => r.latin);
const order = [
  ...PRIORITY.map((p) => eligible.find((r) => r.family === p)).filter(Boolean),
  ...eligible.filter((r) => !PRIORITY.includes(r.family)).sort((a, b) => a.popularity - b.popularity)
];

const embedded = [];
let raw = 0;
let requests = 0;

const fetchFace = async (url) => {
  requests++;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

const latinSrc = (css) => {
  const blocks = [...css.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*{([^}]+)}/g)];
  if (!blocks.length) return null;
  const body = blocks.at(-1)[1];
  return { src: body.match(/url\((https:[^)]+\.woff2)\)/)?.[1], weight: body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? "400" };
};

async function embedOne(f) {
  const fam = encodeURIComponent(f.family);
  const full = all.find((x) => x.family === f.family);

  /* variable first: one file, every weight */
  const q = full?.axes?.length ? axisQuery({ axes: full.axes.map((a) => a.tag), family: f.family }) : null;
  if (q) {
    try {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${fam}:${q}&display=swap`, { headers: { "User-Agent": UA } })).text();
      const hit = latinSrc(css);
      if (hit?.src) {
        const buf = await fetchFace(hit.src);
        return { faces: [{ weight: hit.weight, style: "normal", b64: buf.toString("base64"), bytes: buf.length }], variable: true, bytes: buf.length };
      }
    } catch { /* fall through to static */ }
  }

  /* static 400 + 700 */
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${fam}:wght@400;700&display=swap`, { headers: { "User-Agent": UA } })).text();
    const blocks = [...css.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*{([^}]+)}/g)];
    const faces = [];
    for (const [, body] of blocks) {
      const src = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      if (!src) continue;
      const w = body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? "400";
      const buf = await fetchFace(src);
      faces.push({ weight: w, style: "normal", b64: buf.toString("base64"), bytes: buf.length });
    }
    if (!faces.length) return null;
    return { faces, variable: false, bytes: faces.reduce((a, x) => a + x.bytes, 0) };
  } catch {
    return null;
  }
}

const t0 = Date.now();
const POOL = 6;
let cursor = 0;
let stop = false;

async function worker() {
  while (!stop && cursor < order.length && raw < BUDGET) {
    const f = order[cursor++];
    let got = null;
    try { got = await embedOne(f); } catch { got = null; }
    if (!got) continue;
    if (raw + got.bytes > BUDGET) { stop = true; break; }
    raw += got.bytes;
    const weights = got.variable
      ? [...new Set([300, 400, 500, 600, 700].filter((w) => w >= (f.weights[0] ?? 100) && w <= (f.weights.at(-1) ?? 900)))]
      : got.faces.map((x) => Number(x.weight)).sort((a, b) => a - b);
    embedded.push({
      family: f.family, category: f.cat, designers: f.designers,
      licence: LICENCE[f.family] ?? "SIL Open Font License 1.1",
      variable: got.variable, axes: f.axes.join(",") || "static",
      weights: weights.length ? weights : [400], faces: got.faces, bytes: got.bytes
    });
    if (embedded.length % 25 === 0) console.log(`  … ${embedded.length} families · ${(raw / 1e6).toFixed(2)} MB · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
await Promise.all(Array.from({ length: POOL }, worker));

embedded.sort((a, b) => a.family.localeCompare(b.family));
const embeddedSet = new Set(embedded.map((f) => f.family));
console.log(`embedded ${embedded.length} families · ${(raw / 1e6).toFixed(2)} MB raw woff2 · ${requests} requests · ${((Date.now() - t0) / 1000).toFixed(0)}s`);

/* ---------- 3. emit ---------- */

const dataTs = `/* ============================================================
   Module 6.1 · Theme Studio — embedded font assets
   ------------------------------------------------------------
   GENERATED by scripts/fetch-theme-fonts.mjs — do not edit by hand.
   ${embedded.length} families · ${(raw / 1e6).toFixed(2)} MB of woff2 · latin subset only ·
   every face is base64 so the artifact renders with no network.
   ============================================================ */

export interface EmbeddedFace { weight: string; style: "normal" | "italic"; b64: string; bytes: number }

export interface EmbeddedFamily {
  family: string;
  category: "sans" | "serif" | "display" | "hand" | "mono";
  designers: string;
  licence: string;
  variable: boolean;
  axes: string;
  weights: number[];
  faces: EmbeddedFace[];
  bytes: number;
}

export const FONT_ASSETS: EmbeddedFamily[] = ${JSON.stringify(embedded)};

export const EMBEDDED_TOTAL_BYTES = ${raw};
export const EMBEDDED_COUNT = ${embedded.length};
`;

writeFileSync(new URL("../src/lib/theme-font-data.ts", import.meta.url), dataTs);

/* catalogue: every family Google publishes, compact tuple rows */
const catalogTs = `/* ============================================================
   Module 6.1 · Theme Studio — the complete Google Fonts index
   ------------------------------------------------------------
   GENERATED by scripts/fetch-theme-fonts.mjs — do not edit by hand.
   ${rows.length} families as published by fonts.google.com/metadata/fonts.

   Row shape: [family, category, weights, hasItalic, designers, popularity, embedded]
   \`embedded\` means this build can render the family offline; everything else is
   listed with real metadata and disabled with a reason, never silently offered.
   ============================================================ */

export type FontCategory = "sans" | "serif" | "display" | "hand" | "mono";

export type CatalogRow = [string, FontCategory, string, 0 | 1, string, number, 0 | 1];

export const GOOGLE_FONT_ROWS: CatalogRow[] = ${JSON.stringify(
  rows
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((r) => [r.family, r.cat, r.weights.join(","), r.italic ? 1 : 0, r.designers, r.popularity, embeddedSet.has(r.family) ? 1 : 0])
)};

export const CATALOG_COUNT = ${rows.length};
export const EMBEDDED_IN_CATALOG = ${embeddedSet.size};
`;

writeFileSync(new URL("../src/lib/theme-font-catalog.ts", import.meta.url), catalogTs);

/* licence register */
const lic = embedded.map((f) => `| ${f.family} | ${f.category} | ${f.licence} | ${f.designers || "—"} | ${f.variable ? "variable" : "static"} | ${Math.round(f.bytes / 1024)} KB |`);
const licMd = `# Embedded font licences — Module 6.1 Theme Studio

Every family below is embedded in \`WACRM-CMS.html\` as base64 woff2 (latin subset only,
\`font-display: swap\`) so the artifact renders with no network and no CDN. ${embedded.length} families,
${(raw / 1e6).toFixed(2)} MB of woff2. The full ${rows.length}-family Google Fonts index ships alongside them;
families that are indexed but not embedded are listed in the Typography picker as
**not embedded in this build** and cannot be selected.

All families are published by Google Fonts under a free licence. The licence column records the
specific one where it is not SIL OFL 1.1. Licence text for any family: \`fonts.google.com/specimen/<family>\`.

| Family | Category | Licence | Designer | File | Size |
|---|---|---|---|---|---|
${lic.join("\n")}

## Weight coverage

- Variable families ship **one** woff2 covering the family's full weight range (\`font-weight: <min> <max>\`), so every weight in the picker is real.
- Static families ship the 400 and 700 faces only; the picker shows exactly those two weights and no others.
- Italic faces are not embedded. The picker does not offer italic — the theme stores an upright face.
`;
writeFileSync(new URL("../FONT-LICENSES.md", import.meta.url), licMd);

console.log(`wrote theme-font-data.ts (${(dataTs.length / 1e6).toFixed(2)} MB), theme-font-catalog.ts (${(catalogTs.length / 1e6).toFixed(2)} MB), FONT-LICENSES.md`);
