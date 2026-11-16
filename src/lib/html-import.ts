/* ============================================================
   Module 7 · HTML / JSON import
   ------------------------------------------------------------
   Two importers, one contract: an uploaded file becomes *blocks*, or
   it is refused with a reason. Nothing from the file is executed.

   HTML is parsed with DOMParser and reduced to structure + copy:
   scripts, styles, iframes and inline handlers are gone before a
   single node is read. CSS is never applied, so what lands is the
   skeleton of the page — and the import report says so in as many
   words.

   JSON accepts four shapes: our own export, a bare block array, a
   `{ blocks: [...] }` wrapper, and a GrapesJS-style `{ pages: [...] }`
   whose components carry an `html` string (that string goes through
   the HTML importer, so there is one path, not two).
   ============================================================ */
import { REGISTRY, type BlockNode, type BlockType } from "./builder";

export const IMPORT_LIMITS = {
  /** bytes of upload we will read */
  maxBytes: 400_000,
  /** blocks a single import may produce */
  maxBlocks: 40,
  /** characters of copy kept per field */
  maxText: 400,
  /** templates in one JSON bundle */
  maxTemplates: 20
} as const;

export interface ImportNote { kind: "info" | "warn" | "drop"; text: string }

export interface ImportReport {
  source: "html" | "json" | "prebuilt";
  bytes: number;
  sections: number;
  blocks: number;
  dropped: number;
  mapped: { type: BlockType; count: number }[];
  notes: ImportNote[];
  /** brand hints read from the file's own CSS — never applied automatically */
  brand: { colors: string[]; fonts: string[] };
  templateName: string;
}

export interface HtmlImport {
  blocks: BlockNode[];
  report: ImportReport;
}

/* ---------------- sanitising ---------------- */

const DROP_SELECTOR = "script,style,noscript,iframe,object,embed,canvas,svg,link,meta,video,audio,source,form[action^='javascript']";

export function sanitizeHtml(html: string): { html: string; removed: number } {
  let removed = 0;
  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<(script|style|noscript|iframe|object|embed|canvas)\b[\s\S]*?<\/\1>/gi, () => { removed += 1; return ""; });
  out = out.replace(/\son[a-z]+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi, () => { removed += 1; return ""; });
  out = out.replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, () => { removed += 1; return 'href="#"'; });
  return { html: out, removed };
}

/* ---------------- helpers ---------------- */

const clean = (s: string | null | undefined): string =>
  (s ?? "").replace(/\s+/g, " ").replace(/[\u2018\u2019]/g, "'").trim();

const cut = (s: string, n: number = IMPORT_LIMITS.maxText): string => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

const block = (type: BlockType, props: Record<string, unknown>, extra: Partial<BlockNode> = {}): BlockNode => {
  const base = REGISTRY[type].defaults();
  return { ...base, ...extra, props: { ...(base.props as Record<string, unknown>), ...props } } as BlockNode;
};

const textOf = (el: Element | null | undefined): string => cut(clean(el?.textContent));

/* ---------------- the HTML extractor ---------------- */

interface Section {
  el: Element;
  heading: string;
  body: string;
  cta: string;
  items: { title: string; text: string }[];
  stats: { title: string; text: string }[];
  faq: { q: string; a: string }[];
  quotes: { quote: string; name: string; role: string }[];
  table: { head: string[]; rows: string[][] } | null;
  hasForm: boolean;
  hasImage: boolean;
  list: string[];
}

function readSection(el: Element): Section {
  const heading = textOf(el.querySelector("h1,h2,h3"));
  const body = textOf(el.querySelector("p"));
  const ctaEl = el.querySelector("button, a[class*='btn'], a[class*='button'], a[role='button'], input[type='submit']");
  const cta = cut(clean(ctaEl?.getAttribute("value") ?? ctaEl?.textContent));

  /* cards: direct grandchildren carrying a heading and a line of copy */
  const items: { title: string; text: string }[] = [];
  const cardHosts = Array.from(el.querySelectorAll(":scope > div, :scope > ul, :scope > article")).slice(0, 3);
  for (const host of cardHosts) {
    for (const card of Array.from(host.children).slice(0, 6)) {
      const h = card.querySelector("h2,h3,h4,b,strong");
      const p = card.querySelector("p,span");
      const title = textOf(h);
      if (!title || title.length < 2) continue;
      items.push({ title, text: textOf(p) });
    }
  }

  /* a stats strip is `b` + `span` pairs, or number-first cards */
  const stats: { title: string; text: string }[] = [];
  for (const pair of Array.from(el.querySelectorAll("b")).slice(0, 6)) {
    const next = pair.nextElementSibling;
    const num = textOf(pair);
    if (!num || !next) continue;
    const label = textOf(next);
    if (!label) continue;
    stats.push({ title: num, text: label });
  }

  const faq: { q: string; a: string }[] = [];
  for (const d of Array.from(el.querySelectorAll("details")).slice(0, 6)) {
    faq.push({ q: textOf(d.querySelector("summary")), a: textOf(d.querySelector("p")) });
  }
  if (!faq.length) {
    const subheads = Array.from(el.querySelectorAll("h3,h4")).slice(0, 6);
    for (const h of subheads) {
      const a = h.nextElementSibling;
      if (a && /^(P|DIV)$/.test(a.tagName)) faq.push({ q: textOf(h), a: textOf(a) });
    }
  }

  const quotes: { quote: string; name: string; role: string }[] = [];
  for (const q of Array.from(el.querySelectorAll("blockquote, figure")).slice(0, 4)) {
    const quote = textOf(q.querySelector("blockquote") ?? q);
    if (!quote) continue;
    const cite = q.querySelector("cite, figcaption, footer");
    const parts = clean(cite?.textContent).split(/[,·—–]/);
    quotes.push({ quote, name: cut(parts[0] ?? ""), role: cut(parts.slice(1).join(" · ")) });
  }

  let table: Section["table"] = null;
  const t = el.querySelector("table");
  if (t) {
    const head = Array.from(t.querySelectorAll("thead th")).map((th) => textOf(th)).filter(Boolean);
    const rows = Array.from(t.querySelectorAll("tbody tr")).slice(0, 6).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => textOf(td)));
    if (rows.length) table = { head, rows };
  }

  const list = Array.from(el.querySelectorAll("main ul li, :scope ul li"))
    .map((li) => textOf(li))
    .filter((s) => s.length > 1 && s.length < 120)
    .slice(0, 8);

  return {
    el,
    heading,
    body,
    cta,
    items,
    stats,
    faq: faq.filter((f) => f.q && f.a),
    quotes,
    table,
    hasForm: !!el.querySelector("form"),
    hasImage: !!el.querySelector("img"),
    list
  };
}

function sectionToBlocks(s: Section, isFirst: boolean, budget: number): BlockNode[] {
  const out: BlockNode[] = [];
  const push = (b: BlockNode) => { if (out.length < budget) out.push(b); };

  /* hero: the opening statement — a heading, and something to the side */
  if (isFirst && s.heading && (s.body || s.cta || s.hasImage)) {
    push(block("hero", {
      eyebrow: "",
      heading: s.heading,
      description: s.body,
      primaryLabel: s.cta || "Get started",
      primaryHref: { kind: "external", url: "#" },
      secondaryLabel: "",
      secondaryHref: { kind: "external", url: "#" },
      media: ""
    }, { variant: "split" }));
    if (s.stats.length >= 2) {
      push(block("featureGrid", {
        title: "", subtitle: "", columns: String(Math.min(4, s.stats.length)),
        items: s.stats.slice(0, 4).map((x) => ({ icon: "", title: x.title, text: x.text, media: "" }))
      }, { variant: "stats" }));
    }
    return out;
  }

  if (s.table) {
    push(block("table", {
      headers: String(Math.max(2, Math.min(3, s.table.head.length || s.table.rows[0]?.length || 3))),
      head: s.table.head.length ? s.table.head.slice(0, 3) : ["Column 1", "Column 2", "Column 3"],
      rows: s.table.rows.map((r) => ({ a: r[0] ?? "", b: r[1] ?? "", c: r[2] ?? "" })).slice(0, 6)
    }));
    return out;
  }

  if (s.faq.length >= 2) {
    if (s.heading) push(block("heading", { text: s.heading, sub: s.body, eyebrow: "", level: "h2" }));
    push(block("faq", { title: s.heading || "Questions", items: s.faq.slice(0, 5).map((f) => ({ q: f.q, a: f.a })) }));
    return out;
  }

  if (s.quotes.length >= 1 && s.quotes.length > s.items.length) {
    push(block("testimonials", {
      title: s.heading || "",
      items: s.quotes.slice(0, 3).map((q) => ({ quote: q.quote, name: q.name, role: q.role, rating: "5" }))
    }));
    return out;
  }

  if (s.items.length >= 2) {
    if (s.heading) push(block("heading", { text: s.heading, sub: s.body, eyebrow: "", level: "h2" }));
    push(block("featureGrid", {
      title: "", subtitle: "", columns: String(Math.min(4, Math.max(2, s.items.length))),
      items: s.items.slice(0, 6).map((i) => ({ icon: "", title: i.title, text: i.text, media: "" }))
    }, { variant: s.items.length >= 3 ? "icons" : "icons" }));
    return out;
  }

  if (s.stats.length >= 2) {
    push(block("featureGrid", {
      title: s.heading || "", subtitle: s.body, columns: String(Math.min(4, s.stats.length)),
      items: s.stats.slice(0, 4).map((x) => ({ icon: "", title: x.title, text: x.text, media: "" }))
    }, { variant: "stats" }));
    return out;
  }

  if (s.hasForm && s.heading) {
    push(block("heading", { text: s.heading, sub: s.body, eyebrow: "", level: "h2" }));
    push(block("form", { title: s.heading, formId: "", submitLabel: s.cta || "Submit", note: "Imported form — connect it to a CRM form before publishing." }));
    return out;
  }

  if (s.list.length >= 3 && !s.heading) {
    push(block("list", { marker: "check", items: s.list.map((t) => ({ text: t })) }));
    return out;
  }

  if (s.heading && s.cta && !s.body) {
    push(block("ctaSection", { title: s.heading, text: "", primaryLabel: s.cta, primaryHref: { kind: "external", url: "#" }, secondaryLabel: "" }));
    return out;
  }

  if (s.heading) {
    push(block("heading", { text: s.heading, sub: s.body ? "" : "", eyebrow: "", level: "h2" }));
    if (s.body) push(block("text", { body: s.body, rich: false }));
    return out;
  }

  if (s.list.length) {
    push(block("list", { marker: "check", items: s.list.map((t) => ({ text: t })) }));
    return out;
  }

  if (s.hasImage) {
    push(block("image", { media: "", alt: cut(clean(s.el.querySelector("img")?.getAttribute("alt"))) }));
    return out;
  }

  if (s.body) push(block("text", { body: s.body, rich: false }));
  return out;
}

/** Read the file's own palette and type stack — reported, never applied. */
function readBrandHints(html: string): { colors: string[]; fonts: string[] } {
  const colors = new Set<string>();
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) colors.add(`#${m[1].toUpperCase()}`);
  for (const m of html.matchAll(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi)) {
    const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    colors.add(`#${hex.toUpperCase()}`);
  }
  const fonts = new Set<string>();
  for (const m of html.matchAll(/font-family\s*:\s*([^;"'}]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (first && !/^(inherit|initial|sans-serif|serif|system-ui)$/i.test(first)) fonts.add(first);
  }
  return { colors: Array.from(colors).slice(0, 4), fonts: Array.from(fonts).slice(0, 3) };
}

export function importHtml(input: string, opts: { name?: string } = {}): HtmlImport {
  const bytes = new Blob([input]).size;
  const notes: ImportNote[] = [];
  if (bytes > IMPORT_LIMITS.maxBytes) {
    throw Object.assign(new Error(`That file is ${Math.round(bytes / 1024)} KB. The limit is ${Math.round(IMPORT_LIMITS.maxBytes / 1024)} KB.`), { code: "E_SIZE" });
  }

  const brand = readBrandHints(input);
  const { html: safe, removed } = sanitizeHtml(input);
  if (removed) notes.push({ kind: "info", text: `${removed} executable or presentational attribute${removed === 1 ? "" : "s"} (scripts, styles, inline handlers) were removed before parsing — they are never run.` });

  const doc = new DOMParser().parseFromString(safe, "text/html");
  doc.querySelectorAll(DROP_SELECTOR).forEach((el) => el.remove());
  const title = clean(doc.querySelector("title")?.textContent) || opts.name || "Imported page";

  /* chrome is not content: nav belongs to Menus & Navigation (Module 8) */
  let dropped = removed;
  let chrome = 0;
  doc.querySelectorAll("nav, header, [role='navigation'], .skip, #template-bar").forEach((el) => { el.remove(); dropped += 1; chrome += 1; });
  if (chrome) notes.push({ kind: "drop", text: `${chrome} navigation element${chrome === 1 ? "" : "s"} dropped — menus and the global header are Global Regions here, so they are not repeated inside a template.` });
  const footerEl = doc.querySelector("footer");
  if (footerEl) { footerEl.remove(); dropped += 1; notes.push({ kind: "drop", text: "The page footer was dropped — footers are Global Regions owned by this module, not template content." }); }

  const candidates = Array.from(doc.querySelectorAll("main > section, main > div, body > section, body > div, main > article, body > article"))
    .filter((el) => (el.textContent ?? "").trim().length > 24);

  const blocks: BlockNode[] = [];
  let sections = 0;
  for (const el of candidates) {
    if (blocks.length >= IMPORT_LIMITS.maxBlocks) break;
    sections += 1;
    const budget = Math.min(2, IMPORT_LIMITS.maxBlocks - blocks.length);
    const produced = sectionToBlocks(readSection(el), blocks.length === 0, budget);
    if (!produced.length) { dropped += 1; continue; }
    blocks.push(...produced);
  }

  if (!blocks.length) {
    /* a document with no sections at all: fall back to the body as one flow */
    const bodyText = cut(clean(doc.body?.textContent));
    if (!bodyText) throw Object.assign(new Error("No readable content was found in that file."), { code: "E_EMPTY" });
    blocks.push(block("text", { body: bodyText, rich: false }));
    notes.push({ kind: "warn", text: "No section structure was found, so the whole page became a single text block. Import a page with <section> elements for a better result." });
  }

  if (sections > blocks.length) {
    notes.push({ kind: "info", text: `${sections} sections were read; ${blocks.length} blocks were produced and ${dropped} element${dropped === 1 ? "" : "s"} were dropped.` });
  }
  notes.push({ kind: "info", text: "Only structure and copy come across. The file's CSS, fonts, images and JavaScript are not applied — restyle the blocks with the site theme." });
  if (brand.colors.length || brand.fonts.length) {
    notes.push({ kind: "info", text: `Brand hints found in the file's own CSS: ${[...brand.colors, ...brand.fonts].join(", ")}. Nothing was applied — the Theme Studio owns those tokens.` });
  }

  const mapped = new Map<BlockType, number>();
  blocks.forEach((b) => mapped.set(b.type, (mapped.get(b.type) ?? 0) + 1));

  return {
    blocks,
    report: {
      source: "html", bytes, sections, blocks: blocks.length, dropped,
      mapped: Array.from(mapped).map(([type, count]) => ({ type, count })),
      notes, brand, templateName: cut(title, 60)
    }
  };
}

/* ---------------- JSON ---------------- */

export interface JsonTemplate { name: string; blocks: BlockNode[]; layoutName?: string }

const isBlock = (v: unknown): v is BlockNode => {
  const o = v as { type?: unknown };
  return !!o && typeof o === "object" && typeof o.type === "string" && o.type in REGISTRY;
};

function coerceBlocks(list: unknown[], notes: ImportNote[]): BlockNode[] {
  const out: BlockNode[] = [];
  for (const raw of list.slice(0, IMPORT_LIMITS.maxBlocks)) {
    if (!isBlock(raw)) {
      const t = (raw as { type?: string })?.type;
      notes.push({ kind: "drop", text: `A block of type “${String(t ?? "unknown")}” was skipped — this build has no such block.` });
      continue;
    }
    const def = REGISTRY[raw.type].defaults();
    const props = { ...(def.props as Record<string, unknown>), ...((raw.props as Record<string, unknown>) ?? {}) };
    out.push({ ...def, ...raw, props, id: def.id });
  }
  return out;
}

export function importJson(text: string): { templates: JsonTemplate[]; report: ImportReport } {
  const bytes = new Blob([text]).size;
  if (bytes > IMPORT_LIMITS.maxBytes) {
    throw Object.assign(new Error(`That file is ${Math.round(bytes / 1024)} KB. The limit is ${Math.round(IMPORT_LIMITS.maxBytes / 1024)} KB.`), { code: "E_SIZE" });
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw Object.assign(new Error(`That is not valid JSON: ${(e as Error).message}`), { code: "E_JSON" });
  }

  const notes: ImportNote[] = [];
  const templates: JsonTemplate[] = [];
  const d = doc as Record<string, unknown>;

  const takeArray = (arr: unknown[], name: string, layoutName?: string) => {
    const blocks = coerceBlocks(arr, notes);
    if (blocks.length) templates.push({ name: cut(name, 60), blocks, layoutName });
    return blocks;
  };

  if (Array.isArray(doc)) {
    takeArray(doc, "Imported blocks");
  } else if (d && typeof d === "object" && Array.isArray((d as { templates?: unknown[] }).templates)) {
    for (const t of ((d as { templates: unknown[] }).templates).slice(0, IMPORT_LIMITS.maxTemplates)) {
      const o = t as { name?: string; blocks?: unknown[]; layoutId?: string; layout?: string };
      if (Array.isArray(o.blocks)) takeArray(o.blocks, o.name || "Imported template", o.layout);
    }
    notes.push({ kind: "info", text: `Read ${templates.length} template${templates.length === 1 ? "" : "s"} from a WACRM bundle.` });
  } else if (d && typeof d === "object" && Array.isArray((d as { blocks?: unknown[] }).blocks)) {
    takeArray((d as { blocks: unknown[] }).blocks, String((d as { name?: string }).name ?? "Imported template"));
  } else if (d && typeof d === "object" && Array.isArray((d as { pages?: unknown[] }).pages)) {
    /* GrapesJS-style: pages carry an HTML string */
    for (const p of ((d as { pages: unknown[] }).pages).slice(0, 6)) {
      const o = p as { name?: string; html?: string; component?: unknown };
      const html = typeof o.html === "string" ? o.html : JSON.stringify(o.component ?? "");
      if (html.length < 40) continue;
      const inner = importHtml(html, { name: o.name });
      if (inner.blocks.length) templates.push({ name: cut(o.name || inner.report.templateName, 60), blocks: inner.blocks });
    }
    notes.push({ kind: "info", text: "Read a page-builder project: each page's HTML was converted with the same extractor a file upload uses." });
  } else if (d && typeof d === "object" && Array.isArray((d as { data?: { blocks?: unknown[] } }).data?.blocks)) {
    takeArray((d as { data: { blocks: unknown[] } }).data.blocks, "Imported template");
  }

  if (!templates.length) {
    throw Object.assign(new Error("No blocks were found. Expected a WACRM export, a `blocks` array, or a page-builder project with `pages`."), { code: "E_SHAPE" });
  }

  const blocks = templates.reduce((s, t) => s + t.blocks.length, 0);
  const mapped = new Map<BlockType, number>();
  templates.forEach((t) => t.blocks.forEach((b) => mapped.set(b.type, (mapped.get(b.type) ?? 0) + 1)));
  notes.push({ kind: "info", text: "Unknown block types are skipped by name in this report, never silently replaced." });

  return {
    templates,
    report: {
      source: "json", bytes, sections: templates.length, blocks, dropped: 0,
      mapped: Array.from(mapped).map(([type, count]) => ({ type, count })),
      notes, brand: { colors: [], fonts: [] },
      templateName: templates[0].name
    }
  };
}

/* ---------------- export (the round trip) ---------------- */

export const EXPORT_KIND = "wacrm.templates";

export function exportTemplatesJson(docs: { name: string; intent?: string; layoutName?: string; blocks: BlockNode[] }[], meta: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: EXPORT_KIND,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...meta,
    templates: docs.map((d) => ({
      name: d.name,
      intent: d.intent ?? "Custom",
      layout: d.layoutName ?? null,
      blocks: d.blocks.map((b) => ({ type: b.type, variant: b.variant ?? null, props: b.props }))
    }))
  }, null, 2);
}

export function downloadJson(filename: string, body: string): void {
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
