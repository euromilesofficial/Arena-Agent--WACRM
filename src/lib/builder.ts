/* ============================================================
   Module 4 — Visual Builder · document model
   ------------------------------------------------------------
   The registry is the single source of truth shared by the canvas,
   the inspector, the library, the validator and (later) the SSR
   renderer. Everything is typed props — there is deliberately no
   path from this file to raw HTML, CSS or JS.
   ============================================================ */

export type BlockType =
  | "hero" | "heading" | "text" | "list" | "table" | "quote"
  | "featureGrid" | "pricing" | "testimonials" | "faq"
  | "image" | "video" | "button" | "alert"
  | "container" | "columns" | "divider"
  | "form" | "ctaSection" | "footer";

export type BlockGroup = "Content" | "Media" | "Layout" | "Form";
/** The library's chip row — one chip per group, so the chip counts and the
    KPI counts can never disagree. Module 5 §20 fixes the four categories:
    Content 10 · Media 2 · Layout 5 · Form 3 = 20. */
export type LibChip = "All" | "Content" | "Media" | "Layout" | "Form";

export type FieldKind =
  | "text" | "textarea" | "select" | "toggle" | "link" | "media"
  | "items" | "spacing" | "segmented" | "color" | "number";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
  rows?: number;
  options?: { value: string; label: string }[];
  itemFields?: FieldDef[];
  itemLabel?: string;
  /** Style fields only: the theme value, shown while the block inherits it. */
  inherit?: string;
  preview?: (props: Record<string, any>) => string;
}

export interface BlockNode {
  id: string;
  type: BlockType;
  variant?: string;
  props: Record<string, any>;
  style: Record<string, any>;
  children?: BlockNode[];
}

export interface BlockDef {
  type: BlockType;
  label: string;
  /** palette label when the spec names a visible variant, e.g. "Rich Text" */
  paletteLabel?: string;
  group: BlockGroup;
  icon: string;
  hint: string;
  /** false → registered for the renderer but not offered in the palette */
  offered: boolean;
  variants?: { value: string; label: string }[];
  container?: boolean;
  content: FieldDef[];
  style: FieldDef[];
  defaults: () => BlockNode;
}

/* ---------------- theme tokens ---------------- */
export const THEME = {
  font: { heading: "'Inter Tight', Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
  color: {
    brand: "#6D4AFF", brandInk: "#4B22D6", brandSoft: "#F1EDFF", brandLine: "#D8CCFF",
    ink: "#101828", body: "#475467", muted: "#667085", line: "#E7E9EE", surface: "#FFFFFF", soft: "#F6F5FF", dark: "#101828"
  },
  space: [0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96],
  radius: [0, 4, 6, 8, 12, 16, 24, 32, 999],
  container: 1120
};

const padOpts = [
  { value: "0", label: "None" },
  { value: "24", label: "Tight" },
  { value: "48", label: "Balanced" },
  { value: "80", label: "Roomy" }
];

const bgOpts = [
  { value: "surface", label: "White" },
  { value: "soft", label: "Soft" },
  { value: "brand", label: "Brand" },
  { value: "dark", label: "Dark" }
];

const alignOpts = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" }
];

/** Style rows shared by most blocks — kept short on purpose. */
const coreStyle = (defaults: Record<string, string>): FieldDef[] => [
  { key: "padTop", label: "Top spacing", kind: "segmented", options: padOpts, inherit: defaults.padTop },
  { key: "padBottom", label: "Bottom spacing", kind: "segmented", options: padOpts, inherit: defaults.padBottom },
  { key: "bg", label: "Background", kind: "segmented", options: bgOpts, inherit: defaults.bg },
  { key: "align", label: "Alignment", kind: "segmented", options: alignOpts, inherit: defaults.align }
];

const LINK_HINT = "Pages, an external URL, or a downloadable asset";

let seq = 0;
export const uid = (prefix = "b"): string => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ---------------- registry ---------------- */
export const REGISTRY: Record<BlockType, BlockDef> = {
  hero: {
    type: "hero", label: "Hero", group: "Layout", icon: "layers", offered: true,
    hint: "The opening statement of a page: eyebrow, headline, body, two actions and an optional image.",
    variants: [
      { value: "split", label: "Split" }, { value: "centered", label: "Centred" },
      { value: "overlay", label: "Image overlay" }, { value: "minimal", label: "Minimal" }
    ],
    content: [
      { key: "eyebrow", label: "Eyebrow text", kind: "text", placeholder: "STUDY ABROAD" },
      { key: "heading", label: "Heading", kind: "textarea", rows: 2 },
      { key: "description", label: "Description", kind: "textarea", rows: 3 },
      { key: "primaryLabel", label: "Primary button", kind: "text" },
      { key: "primaryHref", label: "Primary link", kind: "link", hint: LINK_HINT },
      { key: "secondaryLabel", label: "Secondary button", kind: "text" },
      { key: "secondaryHref", label: "Secondary link", kind: "link", hint: LINK_HINT },
      { key: "media", label: "Image", kind: "media" }
    ],
    style: [
      ...coreStyle({ padTop: "80", padBottom: "80", bg: "soft", align: "left" }),
      { key: "mediaSide", label: "Image side", kind: "segmented", options: [{ value: "right", label: "Right" }, { value: "left", label: "Left" }], inherit: "right" },
      { key: "height", label: "Height", kind: "segmented", options: [{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "tall", label: "Tall" }], inherit: "medium" }
    ],
    defaults: () => ({
      id: uid("hero"), type: "hero", variant: "split", style: {},
      props: {
        eyebrow: "STUDY ABROAD", heading: "Study Abroad with Confidence",
        description: "Expert guidance, top universities, scholarships, and end-to-end support.",
        primaryLabel: "Explore Programs", primaryHref: { kind: "page", id: "", path: "/programs" },
        secondaryLabel: "Talk to an Expert", secondaryHref: { kind: "external", url: "/contact" },
        media: "hero-student"
      }
    })
  },

  heading: {
    type: "heading", label: "Heading", group: "Content", icon: "type", offered: true,
    hint: "A section title with an optional eyebrow and sub-line.",
    content: [
      { key: "eyebrow", label: "Eyebrow", kind: "text" },
      { key: "text", label: "Heading", kind: "textarea", rows: 2 },
      { key: "sub", label: "Sub-line", kind: "text" },
      { key: "level", label: "Level", kind: "segmented", options: [{ value: "h2", label: "H2" }, { value: "h3", label: "H3" }] }
    ],
    style: [
      ...coreStyle({ padTop: "48", padBottom: "24", bg: "surface", align: "center" }),
      { key: "size", label: "Size", kind: "segmented", options: [{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }], inherit: "md" }
    ],
    defaults: () => ({
      id: uid("h"), type: "heading", style: {},
      props: { eyebrow: "", text: "Section heading", sub: "", level: "h2" }
    })
  },

  text: {
    type: "text", label: "Text", paletteLabel: "Text", group: "Content", icon: "type", offered: true,
    hint: "Body copy. The rich variant adds emphasis and bullet support.",
    variants: [{ value: "plain", label: "Plain" }, { value: "rich", label: "Rich Text" }],
    content: [
      { key: "body", label: "Body", kind: "textarea", rows: 5 },
      { key: "rich", label: "Rich text", kind: "toggle", hint: "Renders **bold** and bullet lines started with “- ”" }
    ],
    style: [
      ...coreStyle({ padTop: "16", padBottom: "16", bg: "surface", align: "left" }),
      { key: "measure", label: "Measure", kind: "segmented", options: [{ value: "narrow", label: "Narrow" }, { value: "wide", label: "Wide" }], inherit: "narrow" }
    ],
    defaults: () => ({ id: uid("t"), type: "text", variant: "plain", style: {}, props: { body: "Write something your visitors need to know.", rich: false } })
  },

  list: {
    type: "list", label: "List", group: "Content", icon: "list", offered: true,
    hint: "A short scannable list with dots, ticks or numbers.",
    content: [
      { key: "items", label: "Items", kind: "items", itemLabel: "Item", itemFields: [{ key: "text", label: "Text", kind: "text" }] },
      { key: "marker", label: "Marker", kind: "segmented", options: [{ value: "dot", label: "Dot" }, { value: "check", label: "Tick" }, { value: "number", label: "No." }] }
    ],
    style: coreStyle({ padTop: "16", padBottom: "16", bg: "surface", align: "left" }),
    defaults: () => ({
      id: uid("l"), type: "list", style: {}, props: { marker: "check", items: [{ text: "Free profile evaluation" }, { text: "University shortlisting" }, { text: "Visa documentation support" }] }
    })
  },

  table: {
    type: "table", label: "Table", group: "Content", icon: "sheet", offered: true,
    hint: "A comparison table — three columns, keyboard editable.",
    content: [
      { key: "headers", label: "Columns", kind: "segmented", options: [{ value: "2", label: "2" }, { value: "3", label: "3" }] },
      { key: "rows", label: "Rows", kind: "items", itemLabel: "Row", itemFields: [
        { key: "a", label: "Column 1", kind: "text" }, { key: "b", label: "Column 2", kind: "text" }, { key: "c", label: "Column 3", kind: "text" }
      ] }
    ],
    style: coreStyle({ padTop: "24", padBottom: "24", bg: "surface", align: "left" }),
    defaults: () => ({
      id: uid("tb"), type: "table", style: {},
      props: { headers: "3", head: ["Programme", "Intake", "Tuition"], rows: [{ a: "BSc Computer Science", b: "Sep 2026", c: "€ 12,400" }, { a: "MSc Data Science", b: "Jan 2027", c: "€ 15,900" }] }
    })
  },

  quote: {
    type: "quote", label: "Quote", group: "Content", icon: "quote", offered: true,
    hint: "A pull-quote with attribution.",
    content: [
      { key: "text", label: "Quote", kind: "textarea", rows: 3 },
      { key: "author", label: "Author", kind: "text" },
      { key: "role", label: "Role", kind: "text" }
    ],
    style: coreStyle({ padTop: "32", padBottom: "32", bg: "soft", align: "center" }),
    defaults: () => ({ id: uid("q"), type: "quote", style: {}, props: { text: "They handled the visa paperwork end to end. I only had to pack.", author: "Rhea K.", role: "MSc Data Science · Berlin" } })
  },

  featureGrid: {
    type: "featureGrid", label: "Feature Grid", group: "Content", icon: "columns", offered: true,
    hint: "2–4 items with icons, statistics or images. Powers stats strips and destination grids.",
    variants: [{ value: "icons", label: "Icons" }, { value: "stats", label: "Stats" }, { value: "media", label: "Media cards" }, { value: "steps", label: "Steps" }],
    content: [
      { key: "title", label: "Title", kind: "text" },
      { key: "subtitle", label: "Sub-line", kind: "text" },
      { key: "columns", label: "Columns", kind: "segmented", options: [{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }] },
      { key: "items", label: "Items", kind: "items", itemLabel: "Item", itemFields: [
        { key: "icon", label: "Icon", kind: "select", options: [
          { value: "book", label: "Book" }, { value: "users", label: "People" }, { value: "shield", label: "Shield" },
          { value: "target", label: "Target" }, { value: "globe", label: "Globe" }, { value: "rocket", label: "Rocket" }
        ] },
        { key: "title", label: "Title", kind: "text" },
        { key: "text", label: "Text", kind: "text" },
        { key: "media", label: "Image", kind: "media" }
      ] }
    ],
    style: coreStyle({ padTop: "48", padBottom: "48", bg: "surface", align: "center" }),
    defaults: () => ({
      id: uid("fg"), type: "featureGrid", variant: "icons", style: {},
      props: {
        title: "Why students choose us", subtitle: "", columns: "3",
        items: [
          { icon: "book", title: "University shortlisting", text: "Matched to your grades and budget.", media: "" },
          { icon: "shield", title: "Visa support", text: "Document review before you submit.", media: "" },
          { icon: "users", title: "On-ground help", text: "A counsellor in every destination.", media: "" }
        ]
      }
    })
  },

  pricing: {
    type: "pricing", label: "Pricing", group: "Content", icon: "coins", offered: true,
    hint: "Service packages with price, features and one call to action.",
    content: [
      { key: "title", label: "Title", kind: "text" },
      { key: "tiers", label: "Packages", kind: "items", itemLabel: "Package", itemFields: [
        { key: "name", label: "Name", kind: "text" }, { key: "price", label: "Price", kind: "text" },
        { key: "period", label: "Period", kind: "text" }, { key: "features", label: "Features", kind: "text", hint: "Comma separated" },
        { key: "cta", label: "Button", kind: "text" }
      ] }
    ],
    style: coreStyle({ padTop: "48", padBottom: "48", bg: "soft", align: "center" }),
    defaults: () => ({
      id: uid("pr"), type: "pricing", style: {},
      props: {
        title: "Counselling packages",
        tiers: [
          { name: "Guidance", price: "Free", period: "30 min", features: "Profile review, Course fit", cta: "Book a slot" },
          { name: "Full support", price: "₹ 49,000", period: "one time", features: "Shortlisting, Applications, Visa", cta: "Talk to us" }
        ]
      }
    })
  },

  testimonials: {
    type: "testimonials", label: "Testimonials", group: "Content", icon: "quote", offered: true,
    hint: "Student quotes with name, course and rating.",
    content: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Quotes", kind: "items", itemLabel: "Quote", itemFields: [
        { key: "quote", label: "Quote", kind: "textarea" }, { key: "name", label: "Name", kind: "text" },
        { key: "role", label: "Course / city", kind: "text" }, { key: "rating", label: "Rating", kind: "select", options: [
          { value: "5", label: "5 stars" }, { value: "4", label: "4 stars" }, { value: "3", label: "3 stars" }
        ] }
      ] }
    ],
    style: coreStyle({ padTop: "48", padBottom: "48", bg: "surface", align: "center" }),
    defaults: () => ({
      id: uid("ts"), type: "testimonials", style: {},
      props: {
        title: "Students who made it",
        items: [
          { quote: "The team mapped my grades to five universities and I got into three.", name: "Rhea Kulkarni", role: "MSc Data Science · Berlin", rating: "5" },
          { quote: "Visa documentation was the part I feared most. It took eleven days.", name: "Aditya Menon", role: "BSc Economics · Milan", rating: "5" }
        ]
      }
    })
  },

  faq: {
    type: "faq", label: "FAQ", group: "Content", icon: "help", offered: true,
    hint: "Questions and answers — the first is open on the page.",
    content: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Questions", kind: "items", itemLabel: "Question", itemFields: [
        { key: "q", label: "Question", kind: "text" }, { key: "a", label: "Answer", kind: "textarea" }
      ] }
    ],
    style: coreStyle({ padTop: "48", padBottom: "48", bg: "soft", align: "left" }),
    defaults: () => ({
      id: uid("fq"), type: "faq", style: {},
      props: {
        title: "Questions students ask",
        items: [
          { q: "Do you help with scholarships?", a: "Yes — we shortlist the ones you are eligible for and review your essay." },
          { q: "What documents do I need for a visa?", a: "Passport, admission letter, proof of funds and insurance. We check every page." }
        ]
      }
    })
  },

  image: {
    type: "image", label: "Image", group: "Media", icon: "image", offered: true,
    hint: "A single image with an optional caption and focal crop.",
    content: [
      { key: "media", label: "Image", kind: "media" },
      { key: "alt", label: "Alt text", kind: "text", hint: "Required before publish", placeholder: "Describe the image for screen readers" },
      { key: "caption", label: "Caption", kind: "text" }
    ],
    style: [
      ...coreStyle({ padTop: "24", padBottom: "24", bg: "surface", align: "center" }),
      { key: "ratio", label: "Ratio", kind: "segmented", options: [{ value: "16:9", label: "16:9" }, { value: "4:3", label: "4:3" }, { value: "1:1", label: "1:1" }], inherit: "16:9" },
      { key: "radius", label: "Corner", kind: "segmented", options: [{ value: "0", label: "Sharp" }, { value: "12", label: "Soft" }, { value: "24", label: "Round" }], inherit: "12" }
    ],
    defaults: () => ({ id: uid("im"), type: "image", style: {}, props: { media: "dest-italy", alt: "", caption: "" } })
  },

  video: {
    type: "video", label: "Video", group: "Media", icon: "play", offered: true,
    hint: "A poster frame with a play affordance. Embeds are allow-listed.",
    content: [
      { key: "media", label: "Poster", kind: "media" },
      { key: "url", label: "Video URL", kind: "text", placeholder: "https://…", hint: "YouTube and Vimeo only" },
      { key: "caption", label: "Caption", kind: "text" }
    ],
    style: coreStyle({ padTop: "32", padBottom: "32", bg: "surface", align: "center" }),
    defaults: () => ({ id: uid("vd"), type: "video", style: {}, props: { media: "dest-france", url: "", caption: "" } })
  },

  button: {
    type: "button", label: "Button", group: "Form", icon: "cursor", offered: true,
    hint: "A single call to action with a typed link.",
    content: [
      { key: "label", label: "Label", kind: "text" },
      { key: "href", label: "Link", kind: "link", hint: LINK_HINT },
      { key: "variant", label: "Style", kind: "segmented", options: [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "ghost", label: "Ghost" }] },
      { key: "size", label: "Size", kind: "segmented", options: [{ value: "md", label: "M" }, { value: "lg", label: "L" }] }
    ],
    style: coreStyle({ padTop: "16", padBottom: "16", bg: "surface", align: "left" }),
    defaults: () => ({ id: uid("bt"), type: "button", style: {}, props: { label: "Enquire now", href: { kind: "external", url: "/contact" }, variant: "primary", size: "md" } })
  },

  alert: {
    type: "alert", label: "Alert", group: "Content", icon: "alert", offered: true,
    hint: "An inline notice for deadlines and intake cut-offs.",
    content: [
      { key: "tone", label: "Tone", kind: "segmented", options: [{ value: "info", label: "Info" }, { value: "success", label: "Success" }, { value: "warn", label: "Warning" }, { value: "danger", label: "Danger" }] },
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea", rows: 2 }
    ],
    style: coreStyle({ padTop: "16", padBottom: "16", bg: "surface", align: "left" }),
    defaults: () => ({ id: uid("al"), type: "alert", style: {}, props: { tone: "warn", title: "Spring 2026 intake closes 15 Dec", text: "Applications submitted after the cut-off move to the autumn intake." } })
  },

  container: {
    type: "container", label: "Container", group: "Layout", icon: "layers", offered: true, container: true,
    hint: "A padded box that holds other blocks. One level of nesting.",
    content: [
      { key: "note", label: "Label", kind: "text", hint: "Visible to editors only", placeholder: "e.g. Intake banner group" }
    ],
    style: [
      ...coreStyle({ padTop: "24", padBottom: "24", bg: "surface", align: "left" }),
      { key: "radius", label: "Corner", kind: "segmented", options: [{ value: "0", label: "Sharp" }, { value: "16", label: "Soft" }, { value: "24", label: "Round" }], inherit: "16" }
    ],
    defaults: () => ({ id: uid("ct"), type: "container", style: {}, props: { note: "" }, children: [] })
  },

  columns: {
    type: "columns", label: "Columns", group: "Layout", icon: "columns", offered: true, container: true,
    hint: "Two or three side-by-side slots for other blocks.",
    content: [
      { key: "count", label: "Columns", kind: "segmented", options: [{ value: "2", label: "2" }, { value: "3", label: "3" }] },
      { key: "note", label: "Label", kind: "text" }
    ],
    style: coreStyle({ padTop: "24", padBottom: "24", bg: "surface", align: "left" }),
    defaults: () => ({ id: uid("cl"), type: "columns", style: {}, props: { count: "2", note: "" }, children: [] })
  },

  divider: {
    type: "divider", label: "Divider", group: "Layout", icon: "filter", offered: true,
    hint: "A rule, or pure breathing space between sections.",
    variants: [{ value: "line", label: "Divider" }, { value: "space", label: "Spacer" }],
    content: [
      { key: "kind", label: "Type", kind: "segmented", options: [{ value: "line", label: "Line" }, { value: "space", label: "Space" }] },
      { key: "height", label: "Space", kind: "segmented", options: [{ value: "16", label: "S" }, { value: "32", label: "M" }, { value: "64", label: "L" }] }
    ],
    style: coreStyle({ padTop: "0", padBottom: "0", bg: "surface", align: "center" }),
    defaults: () => ({ id: uid("dv"), type: "divider", variant: "line", style: {}, props: { kind: "line", height: "32" } })
  },

  form: {
    type: "form", label: "Form", group: "Form", icon: "form", offered: true,
    hint: "Embeds a published form from Forms & Leads. Fields are owned there, not here.",
    content: [
      { key: "formId", label: "Form", kind: "select", options: [] },
      { key: "title", label: "Title", kind: "text" },
      { key: "submitLabel", label: "Button", kind: "text" },
      { key: "note", label: "Note", kind: "text", hint: "Shown under the button" }
    ],
    style: [
      ...coreStyle({ padTop: "48", padBottom: "48", bg: "soft", align: "left" }),
      { key: "layout", label: "Layout", kind: "segmented", options: [{ value: "split", label: "Split" }, { value: "stacked", label: "Stacked" }], inherit: "split" }
    ],
    defaults: () => ({ id: uid("fm"), type: "form", style: {}, props: { formId: "", title: "Get a free profile evaluation", submitLabel: "Send enquiry", note: "We reply within one working day." } })
  },

  ctaSection: {
    type: "ctaSection", label: "CTA Section", group: "Form", icon: "megaphone", offered: true,
    hint: "A closing call to action with one or two buttons.",
    content: [
      { key: "title", label: "Title", kind: "text" },
      { key: "text", label: "Text", kind: "textarea", rows: 2 },
      { key: "primaryLabel", label: "Primary button", kind: "text" },
      { key: "primaryHref", label: "Primary link", kind: "link" },
      { key: "secondaryLabel", label: "Secondary button", kind: "text" }
    ],
    style: coreStyle({ padTop: "64", padBottom: "64", bg: "brand", align: "center" }),
    defaults: () => ({
      id: uid("cta"), type: "ctaSection", style: {},
      props: {
        title: "Ready to Study Abroad?", text: "Get expert guidance and start your journey today.",
        primaryLabel: "Talk to a counsellor", primaryHref: { kind: "external", url: "/contact" }, secondaryLabel: ""
      }
    })
  },

  footer: {
    type: "footer", label: "Footer", group: "Layout", icon: "sheet", offered: true,
    paletteLabel: "Footer (master layout)",
    hint: "Master-layout footer. Inserts into the page footer slot, not the page body.",
    content: [{ key: "note", label: "Note", kind: "text" }],
    style: coreStyle({ padTop: "48", padBottom: "32", bg: "dark", align: "left" }),
    defaults: () => ({ id: uid("ft"), type: "footer", style: {}, props: { note: "" } })
  }
};

export const GROUP_ORDER: BlockGroup[] = ["Content", "Media", "Layout", "Form"];

export const CHIPS: { id: LibChip; label: string; groups: BlockGroup[] }[] = [
  { id: "All", label: "All", groups: GROUP_ORDER },
  { id: "Content", label: "Content", groups: ["Content"] },
  { id: "Media", label: "Media", groups: ["Media"] },
  { id: "Layout", label: "Layout", groups: ["Layout"] },
  { id: "Form", label: "Form", groups: ["Form"] }
];

export const ARCHETYPES: BlockDef[] = GROUP_ORDER.flatMap((g) =>
  Object.values(REGISTRY).filter((d) => d.group === g && d.offered)
);
export const ARCHETYPE_COUNT = ARCHETYPES.length;              // 19 offered
export const REGISTERED_COUNT = Object.keys(REGISTRY).length;  // 20 registered (Footer is renderer-only)

export const chipCount = (chip: LibChip): number => {
  const c = CHIPS.find((x) => x.id === chip);
  return c ? ARCHETYPES.filter((d) => c.groups.includes(d.group)).length : 0;
};

export const labelOf = (node: BlockNode): string => {
  const def = REGISTRY[node.type];
  const v = def.variants?.find((x) => x.value === node.variant);
  return v ? `${def.label} · ${v.label}` : def.label;
};

/* ---------------- section presets (23 configurations) ---------------- */
export type SectionCategory = "Hero" | "Content" | "Features" | "CTA" | "Forms";

export interface SectionPreset {
  id: string;
  name: string;
  category: SectionCategory;
  desc: string;
  build: () => BlockNode[];
}

const hero = (over: Partial<Record<string, any>>, style: Record<string, any> = {}, variant = "split"): BlockNode => ({
  ...REGISTRY.hero.defaults(), variant, style, props: { ...REGISTRY.hero.defaults().props, ...over }
});
const heading = (over: Record<string, any>, style: Record<string, any> = {}): BlockNode => ({
  ...REGISTRY.heading.defaults(), style, props: { ...REGISTRY.heading.defaults().props, ...over }
});
const features = (variant: string, over: Record<string, any>, style: Record<string, any> = {}): BlockNode => ({
  ...REGISTRY.featureGrid.defaults(), variant, style,
  props: { ...REGISTRY.featureGrid.defaults().props, ...over }
});

const stat = (title: string, text: string, icon = "book") => ({ icon, title, text, media: "" });
const dest = (title: string, text: string, media: string) => ({ icon: "globe", title, text, media });

export const SECTION_PRESETS: SectionPreset[] = [
  /* Hero — 5 */
  { id: "sec-hero-split", name: "Hero – Study Abroad", category: "Hero", desc: "Split hero with image and two actions",
    build: () => [hero({})] },
  { id: "sec-hero-centred", name: "Hero – Centred", category: "Hero", desc: "Centred statement, no image",
    build: () => [hero({ media: "", eyebrow: "ADMISSIONS OPEN", heading: "Your degree, one conversation away", description: "Book a free 30-minute profile review with a counsellor who has placed students in your field.", secondaryLabel: "" }, { align: "center", bg: "soft", padTop: "96", padBottom: "96" }, "centered")] },
  { id: "sec-hero-overlay", name: "Hero – Image Overlay", category: "Hero", desc: "Photograph with text over it",
    build: () => [hero({ eyebrow: "STUDY IN EUROPE", heading: "Two years. One continent. Endless classrooms.", description: "Public universities in Germany, Italy, France and the UK — mapped to your budget.", media: "dest-italy" }, { bg: "dark" }, "overlay")] },
  { id: "sec-hero-minimal", name: "Hero – Minimal", category: "Hero", desc: "Eyebrow, headline and one button",
    build: () => [hero({ eyebrow: "EUROMILES", heading: "Guidance that ends with an admit letter", description: "", secondaryLabel: "", media: "" }, { align: "left", padTop: "64", padBottom: "64", bg: "surface" }, "minimal")] },
  { id: "sec-hero-image", name: "Hero – Image Left", category: "Hero", desc: "Image on the left, copy on the right",
    build: () => [hero({ eyebrow: "SCHOLARSHIPS", heading: "Funded places most students never apply for", description: "We track 240 scholarships with deadlines you can actually meet.", media: "dest-germany" }, { mediaSide: "left" })] },

  /* Content — 6 */
  { id: "sec-content-heading", name: "Section Intro", category: "Content", desc: "Eyebrow, heading and sub-line",
    build: () => [heading({ eyebrow: "STUDY DESTINATIONS", text: "Explore Top Study Destinations", sub: "World-class education opportunities in leading countries." }, { align: "center" })] },
  { id: "sec-content-richtext", name: "Rich Text", category: "Content", desc: "Body copy with a nested list",
    build: () => [
      REGISTRY.text.defaults(),
      { ...REGISTRY.list.defaults(), props: { marker: "check", items: [{ text: "Blocked account guidance" }, { text: "Accommodation shortlist" }, { text: "Pre-departure briefing" }] } }
    ] },
  { id: "sec-content-quote", name: "Pull Quote", category: "Content", desc: "A single quote with attribution",
    build: () => [REGISTRY.quote.defaults()] },
  { id: "sec-content-table", name: "Comparison Table", category: "Content", desc: "Programme, intake and tuition",
    build: () => [REGISTRY.table.defaults()] },
  { id: "sec-content-faq", name: "FAQ", category: "Content", desc: "Questions with answers",
    build: () => [REGISTRY.faq.defaults()] },
  { id: "sec-content-testimonials", name: "Testimonials", category: "Content", desc: "Two student quotes",
    build: () => [REGISTRY.testimonials.defaults()] },

  /* Features — 6 */
  { id: "sec-feat-stats", name: "Stats Strip", category: "Features", desc: "Four proof points in a row",
    build: () => [features("stats", { title: "", subtitle: "", columns: "4", items: [
      stat("500+", "Partner Universities"), stat("15,000+", "Students Guided", "users"),
      stat("98%", "Visa Success Rate", "shield"), stat("End-to-End", "Application Support", "target")
    ] }, { padTop: "32", padBottom: "32", bg: "surface" })] },
  { id: "sec-feat-destinations", name: "Destinations Grid", category: "Features", desc: "Four country cards",
    build: () => [features("media", { title: "Explore Top Study Destinations", subtitle: "World-class education opportunities in leading countries.", columns: "4", items: [
      dest("Italy", "Top universities, affordable living, and rich culture.", "dest-italy"),
      dest("Germany", "Tuition-free options and strong career opportunities.", "dest-germany"),
      dest("France", "Renowned programs and global career prospects.", "dest-france"),
      dest("United Kingdom", "World-leading universities and post-study work options.", "dest-uk")
    ] })] },
  { id: "sec-feat-icons", name: "Feature Icons", category: "Features", desc: "Three benefits with icons",
    build: () => [features("icons", { title: "Why students choose us", columns: "3" })] },
  { id: "sec-feat-steps", name: "Process Steps", category: "Features", desc: "Numbered application journey",
    build: () => [features("steps", { title: "How the application works", columns: "3", items: [
      stat("Profile review", "We look at grades, budget and timeline first.", "users"),
      stat("Shortlist", "Six to eight universities, ranked by admit chance.", "book"),
      stat("Apply", "One calendar, one checklist, no missed deadlines.", "target")
    ] }, { bg: "soft" })] },
  { id: "sec-feat-pricing", name: "Pricing", category: "Features", desc: "Two counselling packages",
    build: () => [REGISTRY.pricing.defaults()] },
  { id: "sec-feat-video", name: "Video Feature", category: "Features", desc: "Poster frame with a play button",
    build: () => [REGISTRY.video.defaults()] },

  /* CTA — 6 */
  { id: "sec-cta-banner", name: "CTA Banner", category: "CTA", desc: "Full-width closing call to action",
    build: () => [REGISTRY.ctaSection.defaults()] },
  { id: "sec-cta-form", name: "Lead Form", category: "Forms", desc: "Enquiry form with a photo",
    build: () => [REGISTRY.form.defaults()] },
  { id: "sec-cta-buttons", name: "Button Pair", category: "CTA", desc: "Two side-by-side actions",
    build: () => [
      { ...REGISTRY.button.defaults(), props: { ...REGISTRY.button.defaults().props, label: "Book a counselling call" } },
      { ...REGISTRY.button.defaults(), props: { label: "Download the brochure", href: { kind: "asset", id: "as_brochure", path: "study-abroad-2026.pdf" }, variant: "secondary" } }
    ] },
  { id: "sec-cta-alert", name: "Deadline Alert", category: "CTA", desc: "A dated intake notice",
    build: () => [REGISTRY.alert.defaults()] },
  { id: "sec-cta-split", name: "Split CTA with Form", category: "Forms", desc: "Copy on the left, form on the right",
    build: () => [
      { ...REGISTRY.heading.defaults(), props: { eyebrow: "NEXT STEPS", text: "Talk to a counsellor this week", sub: "Thirty minutes, no cost, no obligation.", level: "h2" }, style: { align: "left" } },
      REGISTRY.form.defaults()
    ] },
  { id: "sec-cta-container", name: "Boxed CTA", category: "CTA", desc: "A contained card with a button",
    build: () => [{
      ...REGISTRY.container.defaults(), style: { bg: "soft", align: "center", padTop: "48", padBottom: "48" }, children: [
        { ...REGISTRY.heading.defaults(), props: { eyebrow: "", text: "Ready when you are", sub: "", level: "h3" } },
        { ...REGISTRY.button.defaults(), props: { label: "Start my application", href: { kind: "external", url: "/contact" }, variant: "primary", size: "lg" }, style: { align: "center" } }
      ]
    }] }
];

export const SECTION_CATEGORIES: ("All" | SectionCategory)[] = ["All", "Hero", "Content", "Features", "CTA", "Forms"];
export const sectionCount = (cat: string): number =>
  cat === "All" ? SECTION_PRESETS.length : SECTION_PRESETS.filter((s) => s.category === cat).length;

/* ---------------- page templates (5) ---------------- */
export interface PageTemplate {
  id: string;
  name: string;
  intent: string;
  desc: string;
  sections: number;
  build: () => BlockNode[];
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: "tpl-program", name: "Programme Page", intent: "Standard page", desc: "Hero, proof, destinations, enquiry form.", sections: 4,
    build: () => [
      hero({ eyebrow: "STUDY IN ITALY", heading: "Study in Italy", description: "Public universities, tuition under €4,000, and a two-year post-study stay.", media: "dest-italy" }),
      features("stats", { title: "", subtitle: "", columns: "4", items: [stat("€ 4,000", "Average tuition"), stat("2 yrs", "Post-study stay", "clock"), stat("38", "Partner universities", "building"), stat("Nov–Jun", "Intake window", "calendar")] }),
      features("media", { title: "Where our students study", subtitle: "Eight cities, one counsellor each.", columns: "4", items: [dest("Milan", "Politecnico and Bocconi.", "dest-italy"), dest("Rome", "Sapienza and LUISS.", "dest-italy"), dest("Turin", "Engineering and design.", "dest-italy"), dest("Bologna", "Europe's oldest university.", "dest-italy")] }),
      REGISTRY.form.defaults()
    ] },
  { id: "tpl-landing", name: "Intake Landing", intent: "Landing page", desc: "Single-goal page with a form above the fold.", sections: 3,
    build: () => [
      hero({ eyebrow: "SPRING 2026", heading: "Apply for the Spring intake", description: "Fifteen universities still accepting applications. Cut-off 15 December.", media: "dest-germany", secondaryLabel: "See eligibility" }),
      features("steps", { title: "Three steps to an offer letter", columns: "3" }),
      REGISTRY.form.defaults()
    ] },
  { id: "tpl-scholarship", name: "Scholarship Page", intent: "Standard page", desc: "Eligibility, table of awards, FAQ.", sections: 4,
    build: () => [
      hero({ eyebrow: "FUNDING", heading: "Scholarships you are eligible for", description: "240 awards tracked, filtered to your grades and nationality.", media: "dest-uk" }),
      REGISTRY.table.defaults(),
      REGISTRY.faq.defaults(),
      REGISTRY.ctaSection.defaults()
    ] },
  { id: "tpl-about", name: "About Page", intent: "Standard page", desc: "Story, team proof, testimonial.", sections: 4,
    build: () => [
      heading({ eyebrow: "ABOUT", text: "We have done this visa queue before", sub: "EuroMiles has guided 15,000 students since 2011." }),
      REGISTRY.text.defaults(),
      REGISTRY.testimonials.defaults(),
      REGISTRY.quote.defaults()
    ] },
  { id: "tpl-event", name: "Event Page", intent: "Landing page", desc: "Date, venue, agenda, registration.", sections: 3,
    build: () => [
      hero({ eyebrow: "27 FEB 2026 · NEW DELHI", heading: "EuroMiles Study Abroad Fair", description: "Meet 40 universities in one hall. Free entry, registration required.", media: "dest-france" }),
      { ...REGISTRY.list.defaults(), props: { marker: "number", items: [{ text: "10:00 — Doors and document checks" }, { text: "11:30 — University desks open" }, { text: "15:00 — Visa briefing" }, { text: "17:30 — Close" }] } },
      REGISTRY.form.defaults()
    ] }
];

/* ---------------- the seeded page ---------------- */
/** The Study Abroad page exactly as the approved mock frames it. */
export const seedStudyAbroad = (): BlockNode[] => [
  hero({}),
  features("stats", { title: "", subtitle: "", columns: "4", items: [
    stat("500+", "Partner Universities", "book"), stat("15,000+", "Students Guided", "users"),
    stat("98%", "Visa Success Rate", "shield"), stat("End-to-End", "Application Support", "target")
  ] }, { padTop: "32", padBottom: "32", bg: "surface" }),
  features("media", {
    title: "Explore Top Study Destinations", subtitle: "World-class education opportunities in leading countries.", columns: "4",
    items: [
      dest("Italy", "Top universities, affordable living, and rich culture.", "dest-italy"),
      dest("Germany", "Tuition-free options and strong career opportunities.", "dest-germany"),
      dest("France", "Renowned programs and global career prospects.", "dest-france"),
      dest("United Kingdom", "World-leading universities and post-study work options.", "dest-uk")
    ]
  }),
  REGISTRY.testimonials.defaults(),
  REGISTRY.form.defaults(),
  REGISTRY.ctaSection.defaults()
];

/* ---------------- tree operations (immutable) ---------------- */
export const walk = (nodes: BlockNode[]): BlockNode[] =>
  nodes.flatMap((n) => [n, ...walk(n.children ?? [])]);

export const findNode = (nodes: BlockNode[], id: string): BlockNode | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = n.children ? findNode(n.children, id) : null;
    if (hit) return hit;
  }
  return null;
};

export const findPath = (nodes: BlockNode[], id: string): BlockNode[] | null => {
  for (const n of nodes) {
    if (n.id === id) return [n];
    const sub = n.children ? findPath(n.children, id) : null;
    if (sub) return [n, ...sub];
  }
  return null;
};

export const depthOf = (nodes: BlockNode[], id: string): number => {
  const p = findPath(nodes, id);
  return p ? p.length - 1 : 0;
};

export const countBlocks = (nodes: BlockNode[]): number => nodes.length;

export const mapTree = (nodes: BlockNode[], fn: (n: BlockNode) => BlockNode | null): BlockNode[] =>
  nodes.map(fn).filter((n): n is BlockNode => !!n).map((n) => (n.children ? { ...n, children: mapTree(n.children, fn) } : n));

export function insertNode(nodes: BlockNode[], node: BlockNode, target: { parentId: string | null; index: number }): BlockNode[] {
  if (!target.parentId) {
    const out = [...nodes];
    out.splice(Math.max(0, Math.min(target.index, out.length)), 0, node);
    return out;
  }
  return nodes.map((n) => {
    if (n.id === target.parentId) {
      const kids = [...(n.children ?? [])];
      kids.splice(Math.max(0, Math.min(target.index, kids.length)), 0, node);
      return { ...n, children: kids };
    }
    return n.children ? { ...n, children: insertNode(n.children, node, target) } : n;
  });
}

export function removeNode(nodes: BlockNode[], id: string): BlockNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}

export function replaceNode(nodes: BlockNode[], id: string, patch: (n: BlockNode) => BlockNode): BlockNode[] {
  return nodes.map((n) => {
    if (n.id === id) return patch(n);
    return n.children ? { ...n, children: replaceNode(n.children, id, patch) } : n;
  });
}

export function moveNode(nodes: BlockNode[], id: string, target: { parentId: string | null; index: number }): BlockNode[] {
  const node = findNode(nodes, id);
  if (!node) return nodes;
  /* refuse to drop a container inside its own subtree */
  if (target.parentId && findNode(node.children ?? [], target.parentId)) return nodes;
  const without = removeNode(nodes, id);
  let index = target.index;
  if (!target.parentId) {
    const from = nodes.findIndex((n) => n.id === id);
    if (from > -1 && from < index) index -= 1;
  }
  return insertNode(without, node, { ...target, index });
}

const cloneWithNewIds = (n: BlockNode): BlockNode => ({
  ...n,
  id: uid(n.type),
  children: n.children?.map(cloneWithNewIds)
});

export function duplicateNode(nodes: BlockNode[], id: string): BlockNode[] {
  const node = findNode(nodes, id);
  if (!node) return nodes;
  const copy = cloneWithNewIds(node);
  if (!findPath(nodes, id)) return nodes;
  /* insert as a sibling immediately after the original */
  const parentId = pathParent(nodes, id);
  const siblings = parentId ? findNode(nodes, parentId)?.children ?? [] : nodes;
  const idx = siblings.findIndex((n) => n.id === id);
  return insertNode(nodes, copy, { parentId, index: idx + 1 });
}

function pathParent(nodes: BlockNode[], id: string, parent: string | null = null): string | null {
  for (const n of nodes) {
    if (n.id === id) return parent;
    const hit = n.children ? pathParent(n.children, id, n.id) : null;
    if (hit) return hit;
  }
  return null;
}

/** Can `parent` accept `child`? Sections hold blocks; containers hold blocks one level deep. */
export function canNest(parentType: BlockType | null, child: BlockNode, nodes: BlockNode[], parentId: string | null): string | null {
  if (!parentType) {
    if (child.type === "footer") return "The footer lives in Layouts & Templates.";
    return null;
  }
  const def = REGISTRY[parentType];
  if (!def.container) return `${def.label} cannot hold other blocks.`;
  if (child.type === "footer") return "The footer lives in Layouts & Templates.";
  if (child.type === "hero") return "A hero belongs at the top level.";
  if (REGISTRY[child.type].container && parentId) {
    const d = depthOf(nodes, parentId);
    if (d >= 1) return "Layout blocks nest one level deep.";
  }
  return null;
}

/* ---------------- validation (preflight) ---------------- */
export interface DocIssue { blockId: string; label: string; message: string; severity: "blocking" | "advisory" }

export function docIssues(nodes: BlockNode[], pages: { id: string; path: string }[], assets: { id: string }[]): DocIssue[] {
  const out: DocIssue[] = [];
  for (const n of walk(nodes)) {
    const def = REGISTRY[n.type];
    if (n.type === "image" || n.type === "video") {
      if (!n.props.media) out.push({ blockId: n.id, label: def.label, message: "has no image selected", severity: "blocking" });
      if (n.type === "image" && !String(n.props.alt ?? "").trim())
        out.push({ blockId: n.id, label: def.label, message: "has no alt text — screen readers get nothing", severity: "blocking" });
      if (n.props.media && !assets.some((a) => a.id === n.props.media))
        out.push({ blockId: n.id, label: def.label, message: "references an asset that no longer exists", severity: "blocking" });
    }
    if (n.type === "hero") {
      if (!String(n.props.heading ?? "").trim()) out.push({ blockId: n.id, label: def.label, message: "has an empty heading", severity: "blocking" });
      for (const key of ["primaryHref", "secondaryHref"]) {
        const link = n.props[key];
        if (link?.kind === "page" && link.id && !pages.some((p) => p.id === link.id))
          out.push({ blockId: n.id, label: def.label, message: `links to a page that was deleted (${link.path ?? link.id})`, severity: "blocking" });
      }
    }
    if (n.type === "form" && !n.props.formId)
      out.push({ blockId: n.id, label: def.label, message: "has no form attached", severity: "blocking" });
    if (n.type === "button" && !n.props.label)
      out.push({ blockId: n.id, label: def.label, message: "has no label", severity: "advisory" });
  }
  return out;
}

/* ---------------- small helpers used by the canvas ---------------- */
export const spacing = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const blockTitle = (n: BlockNode): string => {
  const p = n.props;
  const text = p.heading ?? p.title ?? p.text ?? p.label ?? p.body ?? "";
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > 46 ? `${s.slice(0, 46)}…` : s;
};
