/* ============================================================
   Module 3 — Pages & Routes data model
   Types, seed tree, and pure helpers. The API surface lives in
   data.ts, which owns persistence; this file stays side-effect free.
   ============================================================ */

export type PageType = "standard" | "landing";
export type Lifecycle = "published" | "draft";

export interface PageIssue {
  id: string;
  kind: "seo" | "orphan" | "stale" | "link" | "home";
  label: string;
  detail: string;
  severity: "advisory" | "blocking";
}

export interface CmsPage {
  id: string;
  siteId: string;
  title: string;
  /** last path segment; empty for the homepage */
  slug: string;
  /** authoritative full route path, e.g. /study-abroad/study-in-italy */
  path: string;
  parentId: string | null;
  type: PageType;
  status: Lifecycle;
  /** draft differs from the live snapshot */
  hasChanges: boolean;
  isHome: boolean;
  locale: string;
  template: string;
  layout: string;
  order: number;
  blocks: number;
  views: number;
  leads: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updated: string;
  author: string;
  seo: { title: string; description: string };
  revision: number;
  /** present only while the page sits in the 30-day trash */
  trash: { at: string; by: string; until: string; daysLeft: number } | null;
  /** inbound references from other pages/menus (LinkRef resolver output) */
  inbound: number;
}

export interface PageQuery {
  siteId: string;
  tab: "all" | "published" | "drafts" | "trash";
  q?: string;
  type?: PageType | "all";
  status?: "all" | "published" | "draft" | "changes";
  author?: string | "all";
  /** registry filters that compose with the three selects */
  onlyIssues?: boolean;
  onlyLanding?: boolean;
  sort?: "title" | "path" | "type" | "status" | "updated";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PageCounts { all: number; published: number; drafts: number; trash: number; changes: number; issues: number }

export interface PageSummary {
  total: number; published: number; drafts: number; issues: number;
  /** rounded percentage; null when there is nothing to divide by */
  gauge: number | null;
  changes: number;
  countsAsOf: string;
}

export interface TreeNode {
  id: string; title: string; path: string; parentId: string | null;
  isHome: boolean; status: Lifecycle; hasChanges: boolean; depth: number;
  hasChildren: boolean; type: PageType;
}

/* ---------- helpers ---------- */

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RESERVED = ["api", "cms", "preview", "assets", "admin", "_next", "static"];

export function joinPath(parentPath: string | null, slug: string): string {
  if (!parentPath || parentPath === "/") return slug ? `/${slug}` : "/";
  return `/${[parentPath.replace(/^\/|\/$/g, ""), slug].filter(Boolean).join("/")}`;
}

export function validateSlug(slug: string, isHome: boolean): string | null {
  if (isHome) return null;
  if (!slug.trim()) return "Enter a URL slug.";
  if (!SLUG_RE.test(slug)) return "Use lowercase letters, numbers and hyphens only.";
  if (slug.length > 60) return "Keep the slug under 60 characters.";
  if (RESERVED.includes(slug)) return "This word is reserved by the platform.";
  return null;
}

export function pathOf(p: CmsPage): string {
  if (p.isHome) return "/";
  return p.path;
}

/** recompute full paths after a move, so children follow their parent */
export function rePath(all: CmsPage[]): CmsPage[] {
  const byId = new Map(all.map((p) => [p.id, { ...p }]));
  const walk = (p: CmsPage, seen = new Set<string>()): string => {
    if (p.isHome) return "/";
    if (seen.has(p.id)) return p.path;
    seen.add(p.id);
    const parent = p.parentId ? byId.get(p.parentId) : null;
    const parentPath = parent ? walk(parent, seen) : "/";
    p.path = joinPath(parentPath, p.slug);
    return p.path;
  };
  byId.forEach((p) => walk(p));
  return all.map((p) => byId.get(p.id)!);
}

export function descendants(all: CmsPage[], id: string): CmsPage[] {
  const out: CmsPage[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const p of all) if (p.parentId === cur) { out.push(p); stack.push(p.id); }
  }
  return out;
}

export function issuesFor(p: CmsPage): PageIssue[] {
  const out: PageIssue[] = [];
  if (p.trash) return out;
  if (!p.seo.title.trim()) out.push({ id: `${p.id}-seo`, kind: "seo", label: "Missing SEO title", detail: "Search results fall back to the page title, which is longer than 60 characters.", severity: "advisory" });
  if (p.status === "published" && p.hasChanges) {
    const days = p.updatedAt === "2025-05-19" ? 11 : 9;
    if (days > 7) out.push({ id: `${p.id}-stale`, kind: "stale", label: "Unpublished changes waiting", detail: `Edits have been sitting in draft for ${days} days. Review them in Publishing & Releases.`, severity: "advisory" });
  }
  if (p.inbound === 0 && !p.isHome && p.status === "published") {
    out.push({ id: `${p.id}-orphan`, kind: "orphan", label: "No internal links point here", detail: "Nothing in the published release links to this page — it is only reachable by direct URL.", severity: "advisory" });
  }
  return out;
}

/* ---------- seed ---------- */

const AUTHORS = ["John D.", "Anita N.", "Priya S.", "Aarav M.", "Vikram K."];
const STAMPS = ["18m ago", "2h ago", "5h ago", "6h ago", "Yesterday", "2d ago", "4d ago", "6d ago", "May 20, 2025", "May 18, 2025"];
const ISO = ["2025-05-30", "2025-05-30", "2025-05-30", "2025-05-29", "2025-05-28", "2025-05-26", "2025-05-24", "2025-05-22", "2025-05-19", "2025-05-12"];

interface SeedNode { title: string; slug: string; type?: PageType; children?: SeedNode[] }

const MAIN_TREE: SeedNode[] = [
  { title: "Home", slug: "" },
  {
    title: "Study Abroad", slug: "study-abroad", children: [
      { title: "Study in Italy", slug: "italy" },
      { title: "Study in Germany", slug: "germany" },
      { title: "Study in France", slug: "france" }
    ]
  },
  {
    title: "Scholarships", slug: "scholarships", children: [
      { title: "Available Scholarships", slug: "available" },
      { title: "How to Apply", slug: "how-to-apply" }
    ]
  },
  {
    title: "About Us", slug: "about-us", children: [
      { title: "Our Story", slug: "our-story" },
      { title: "Team", slug: "team" }
    ]
  },
  {
    title: "Resources", slug: "resources", children: [
      { title: "Blogs", slug: "blogs" },
      { title: "Events", slug: "events" },
      { title: "Downloads", slug: "downloads" }
    ]
  },
  { title: "Contact Us", slug: "contact-us" },
  {
    title: "Destinations", slug: "destinations", children: [
      { title: "Spain", slug: "spain" }, { title: "Netherlands", slug: "netherlands" },
      { title: "Poland", slug: "poland" }, { title: "Ireland", slug: "ireland" }
    ]
  },
  {
    title: "Services", slug: "services", children: [
      { title: "Career Counselling", slug: "career-counselling" },
      { title: "Visa Assistance", slug: "visa-assistance" },
      { title: "Accommodation", slug: "accommodation" },
      { title: "Test Preparation", slug: "test-preparation" }
    ]
  },
  {
    title: "Universities", slug: "universities", children: [
      { title: "Medicine", slug: "medicine" }, { title: "Engineering", slug: "engineering" },
      { title: "Business", slug: "business" }, { title: "Arts & Design", slug: "arts-design" },
      { title: "Law", slug: "law" }
    ]
  },
  {
    title: "Intakes", slug: "intakes", children: [
      { title: "Fall 2025", slug: "fall-2025" }, { title: "Spring 2026", slug: "spring-2026" }
    ]
  },
  {
    title: "Guides", slug: "guides", children: [
      { title: "Country Guides", slug: "country-guides" },
      { title: "Fee Calculator", slug: "fee-calculator" },
      { title: "Application Checklist", slug: "application-checklist" }
    ]
  },
  {
    title: "Legal", slug: "legal", children: [
      { title: "Privacy Policy", slug: "privacy" }, { title: "Terms of Service", slug: "terms" },
      { title: "Cookie Policy", slug: "cookies" }
    ]
  },
  { title: "Italy Intake 2026", slug: "italy-intake", type: "landing" },
  { title: "Free Counselling", slug: "free-counselling", type: "landing" },
  { title: "Referral Program", slug: "referral-programme", type: "landing" },
  { title: "Student Stories", slug: "student-stories" },
  { title: "Careers", slug: "careers" },
  { title: "Press Kit", slug: "press-kit" },
  { title: "FAQs", slug: "faqs" }
];

const REWARDS_TREE: SeedNode[] = [
  { title: "Home", slug: "" },
  { title: "Referral Rewards", slug: "rewards" },
  { title: "Tier Benefits", slug: "tiers" },
  { title: "How It Works", slug: "how-it-works" },
  { title: "Redeem Points", slug: "redeem" },
  { title: "Leaderboard", slug: "leaderboard" },
  { title: "Terms", slug: "terms" },
  { title: "FAQs", slug: "faqs" },
  { title: "Join Programme", slug: "join", type: "landing" },
  { title: "Partner Offers", slug: "offers" },
  { title: "Contact", slug: "contact" },
  { title: "Press Kit", slug: "press" },
  { title: "Privacy", slug: "privacy" },
  { title: "Cookies", slug: "cookies" },
  { title: "Careers", slug: "careers" },
  { title: "Blog", slug: "blog" }
];

const PORTAL_TREE: SeedNode[] = [
  { title: "Home", slug: "" },
  { title: "Partner Onboarding", slug: "onboarding" },
  { title: "Commission Schedule", slug: "commission" },
  { title: "Resources", slug: "resources" },
  { title: "Brand Assets", slug: "brand-assets" },
  { title: "Marketing Kit", slug: "marketing-kit" },
  { title: "Support", slug: "support" },
  { title: "FAQs", slug: "faqs" },
  { title: "Apply", slug: "apply", type: "landing" },
  { title: "Terms", slug: "terms" },
  { title: "Privacy", slug: "privacy" },
  { title: "Status", slug: "status" }
];

function build(siteId: string, tree: SeedNode[], seedBase: number, opts: {
  publishedTo?: number; draftTitles?: string[]; changesTitles?: string[]; noSeo?: string[];
}): CmsPage[] {
  const out: CmsPage[] = [];
  let n = seedBase;
  let order = 0;

  const walk = (nodes: SeedNode[], parent: CmsPage | null, depth: number) => {
    nodes.forEach((node, i) => {
      n += 1;
      order += 1;
      const isHome = depth === 0 && i === 0 && parent === null;
      const path = isHome ? "/" : joinPath(parent?.path ?? "/", node.slug);
      const draft = (opts.draftTitles ?? []).includes(node.title);
      const page: CmsPage = {
        id: `pg_${siteId}_${n}`,
        siteId,
        title: node.title,
        slug: isHome ? "" : node.slug,
        path,
        parentId: parent?.id ?? null,
        type: node.type ?? "standard",
        status: draft ? "draft" : "published",
        hasChanges: false,
        isHome,
        locale: "en",
        template: isHome ? "Home – v2" : node.type === "landing" ? "Landing – Full bleed" : depth === 0 ? "Section – Standard" : "Page – Standard",
        layout: isHome ? "Site default" : node.type === "landing" ? "Blank landing" : "Site default",
        order,
        blocks: isHome ? 9 : 3 + ((n * 3) % 8),
        views: isHome ? 4320 : 60 + ((n * 137) % 2900),
        leads: isHome ? 26 : (n * 7) % 19,
        createdAt: "Apr 10, 2025",
        createdBy: AUTHORS[n % AUTHORS.length],
        updatedAt: ISO[n % ISO.length],
        updated: STAMPS[n % STAMPS.length],
        author: AUTHORS[n % AUTHORS.length],
        seo: {
          title: (opts.noSeo ?? []).includes(node.title) ? "" : `${node.title} · EuroMiles`,
          description: `${node.title} — guidance, fees and next steps for students applying through EuroMiles.`
        },
        revision: 2 + (n % 11),
        trash: null,
        inbound: node.title === "Downloads" || node.title === "Cookie Policy" ? 0 : 1 + (n % 6)
      };
      if ((opts.changesTitles ?? []).includes(node.title)) page.hasChanges = true;
      out.push(page);
      if (node.children?.length) walk(node.children, page, depth + 1);
    });
  };
  walk(tree, null, 0);
  return out;
}

export function seedCmsPages(): CmsPage[] {
  const main = build("site_main", MAIN_TREE, 0, {
    draftTitles: ["How to Apply", "Study in France", "Downloads", "Fee Calculator", "Application Checklist", "FAQs"],
    changesTitles: ["Study Abroad", "Available Scholarships", "Home"],
    noSeo: ["Downloads", "Cookie Policy"]
  });
  const rewards = build("site_rewards", REWARDS_TREE, 100, {
    draftTitles: ["Redeem Points", "Press Kit", "Careers"],
    changesTitles: ["Referral Rewards"]
  });
  const portal = build("site_portal", PORTAL_TREE, 200, {
    draftTitles: ["Commission Schedule", "Marketing Kit"],
    changesTitles: ["Partner Onboarding"]
  });
  // two pages already sit in the 30-day trash so the Trash tab is never a lie
  const trashed = ["Careers", "Press Kit"];
  main.forEach((p) => {
    const i = trashed.indexOf(p.title);
    if (i === -1) return;
    p.status = "draft";
    p.trash = { at: "Jun 18, 2025", by: i === 0 ? "Anita N." : "John D.", until: "Jul 18, 2025", daysLeft: i === 0 ? 19 : 25 };
  });
  return [...main, ...rewards, ...portal];
}
