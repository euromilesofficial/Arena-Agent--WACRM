/* ============================================================
   Global Footer — the link columns, shared by the builder's
   footer block, the Module 7 layout frame and the region drawer.
   Column 1 is always the brand; `groups` are the link columns
   that follow it. Stored on the footer variant's block props, so
   Save writes them with the variant (one revision for all layouts).
   ============================================================ */

export interface FooterGroup { title: string; links: string[] }

/* The footer as it has always been drawn. A variant without `groups` renders exactly this. */
export const DEFAULT_FOOTER_GROUPS: FooterGroup[] = [
  { title: "Company", links: ["About us", "Careers", "Press"] },
  { title: "Study", links: ["Destinations", "Scholarships", "Intakes"] },
  { title: "Support", links: ["Contact", "Eligibility", "Help centre"] }
];

/** Number of columns including the brand column; 1..4, default 2 (the builder's default). */
export function footerCols(p: { columns?: unknown }): number {
  return Math.max(1, Math.min(4, Number(p.columns ?? 2)));
}

/** The stored link columns, or the default when the variant has none (or a malformed list). */
export function footerGroups(p: { groups?: unknown }): FooterGroup[] {
  const g = p.groups;
  if (!Array.isArray(g)) return DEFAULT_FOOTER_GROUPS;
  const ok = g.every((x) => x && typeof x === "object" && typeof (x as FooterGroup).title === "string" && Array.isArray((x as FooterGroup).links));
  return ok ? (g as FooterGroup[]) : DEFAULT_FOOTER_GROUPS;
}
