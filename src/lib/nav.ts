/* ============================================================
   Navigation model — the CMS tree, its capability specs, and the
   cross-product links that sit above it in the sidebar.
   ============================================================ */

export interface NavCap { 0: string; 1: string; 2: string }
export interface NavItem {
  id: string; label: string; icon: string; screen?: string;
  desc?: string; caps?: [string, string, string][]; badge?: string;
  chev?: boolean; external?: boolean;
}
export interface NavGroup { group: string; items: NavItem[] }

export const NAV_CRM: NavItem[] = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: '12', external: true },
  { id: 'crm-dashboard', label: 'Dashboard', icon: 'dashboard', external: true },
  { id: 'crm-sales', label: 'CRM & Sales', icon: 'users', external: true, chev: true },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone', external: true, chev: true },
  { id: 'automation', label: 'Automation & Bots', icon: 'zap', external: true, chev: true },
  { id: 'reports', label: 'Reports & Insights', icon: 'chart', external: true }
];

export const NAV_CMS: NavGroup[] = [
  {
    group: 'Build', items: [
      { id: 'overview', label: 'Overview', icon: 'home', screen: 'overview' },
      { id: 'sites', label: 'Sites & Domains', icon: 'globe', desc: 'Site registry, cloning, DNS, and TLS bindings for every website in the workspace.', caps: [['Site registry', 'Canonical list of websites with status, hostnames, and owning teams.', 'layers'], ['DNS verification', 'Job-backed record checks with copyable TXT and CNAME expectations.', 'server'], ['SSL lifecycle', 'Certificate states from provisioning to active, with remediation.', 'lock'], ['Cloning', 'Duplicate a site with remapped internal IDs and shared assets.', 'copy']] },
      { id: 'pages', label: 'Pages', icon: 'file', desc: 'Page tree, slugs, scheduling, and lifecycle across every website.', caps: [['Page tree', 'Nested navigation with drag ordering and per-locale variants.', 'sitemap'], ['Slug management', 'Canonical routes, aliases, and redirect creation on rename.', 'link'], ['Lifecycle', 'Draft → in review → published → archived.', 'refresh'], ['Bulk actions', 'Publish, unpublish, duplicate, and reassign page ownership.', 'columns']] },
      { id: 'builder', label: 'Visual Builder', icon: 'blocks', desc: 'Native block canvas with in-canvas AI editing and layout presets.', caps: [['Block canvas', 'Drag, nest, and reorder blocks with live responsive preview.', 'blocks'], ['In-canvas AI', 'Rewrite, translate, and restructure sections with reviewable diffs.', 'sparkles'], ['Layout presets', 'Approved compositions that keep brand consistency.', 'columns'], ['Autosave', 'Draft snapshots with per-block undo history.', 'refresh']] },
      { id: 'library', label: 'Block Library', icon: 'blocks', desc: 'Every reusable block available to editors, grouped by intent.', caps: [['Block catalogue', 'Searchable library of approved sections with previews.', 'blocks'], ['Variants', 'Per-block style variants inherited from the theme.', 'palette'], ['Usage', 'Where each block is live, with site and page counts.', 'link'], ['Governance', 'Lock or deprecate blocks across the workspace.', 'lock']] },
      { id: 'theme', label: 'Theme Studio', icon: 'palette', desc: 'Brand tokens, typography scales, and reusable JSON theme presets.', caps: [['Design tokens', 'Colour, spacing, radius, and shadow scales shared with the CRM.', 'palette'], ['Typography', 'Font pairing, fluid scale, and fallback stacks.', 'type'], ['Presets', 'Portable JSON themes importable across websites.', 'code'], ['Contrast audit', 'AA/AAA checks before a theme can be published.', 'shield']] },
      { id: 'layouts', label: 'Layouts & Templates', icon: 'layers', desc: 'Headers, footers, reusable blocks, and page templates.', caps: [['Headers & footers', 'Global chrome with sticky, transparent, and mega-menu variants.', 'columns'], ['Reusable blocks', 'Reference-based components with overrides.', 'blocks'], ['Templates', 'Starter page compositions per intent.', 'layers'], ['Preview matrix', 'Viewport and locale combinations side by side.', 'eye']] }
    ]
  },
  {
    group: 'Manage', items: [
      { id: 'menus', label: 'Menus & Navigation', icon: 'menu', desc: 'Navigation tree, mega-menu composition, and mobile output.', caps: [['Navigation tree', 'Ordered links with depth limits and permission gates.', 'sitemap'], ['Mega-menu', 'Column layouts with media and promotional slots.', 'columns'], ['Mobile output', 'Drawer and accordion behaviour configuration.', 'menu'], ['Link checks', 'Broken-link detection before publish.', 'alert']] },
      { id: 'media', label: 'Media Library', icon: 'image', desc: 'Assets, WebP processing, focal points, and usage tracking.', caps: [['Asset library', 'Searchable media with variants and crop previews.', 'image'], ['WebP pipeline', 'Automatic responsive formats with quality budgets.', 'zap'], ['Focal points', 'Art-directed crops per breakpoint.', 'cursor'], ['Usage graph', 'Where each asset is referenced before deletion.', 'link']] },
      { id: 'forms', label: 'Forms & Leads', icon: 'form', desc: 'Form builder, submissions, consent evidence, and lead handoff.', caps: [['Form builder', 'Field library, conditional logic, and spam controls.', 'form'], ['Submissions', 'Inbox with filters, notes, and assignment.', 'inbox'], ['Consent evidence', 'DPDP-ready proof stored with every submission.', 'shield'], ['CRM handoff', 'Create leads, companies, and deals on submit.', 'users']] },
      { id: 'publishing', label: 'Publishing & Releases', icon: 'upload', desc: 'Preflight, compare-and-swap publish, history, and rollback.', caps: [['Preflight', 'Automated checks before a release is allowed to land.', 'check'], ['CAS publish', 'Content-hash guarantee against silent overwrites.', 'shield'], ['History', 'Every release with author, diff, and timestamp.', 'clock'], ['Rollback', 'Restore a previous release with a confirmation trail.', 'refresh']] }
    ]
  },
  {
    group: 'Govern', items: [
      { id: 'seo', label: 'SEO & Redirects', icon: 'search', desc: 'Metadata, canonical routes, sitemaps, and 301 redirects.', caps: [['Metadata', 'Per-page titles, descriptions, and social cards.', 'search'], ['Canonicals', 'Duplicate-route control with automated suggestions.', 'link'], ['Redirects', '301 matrix with hit counts and loop detection.', 'refresh'], ['Search health', 'Index coverage and structured-data validation.', 'activity']] },
      { id: 'localization', label: 'Localization', icon: 'languages', desc: 'Languages, fallback rules, and localized content status.', caps: [['Locales', 'Language registry with regional variants.', 'languages'], ['Fallback rules', 'Deterministic resolution when a string is missing.', 'layers'], ['Coverage', 'Per-page translation completeness.', 'activity'], ['Review flow', 'Linguist assignment and approval states.', 'users']] },
      { id: 'security', label: 'Security & Audit', icon: 'shield', desc: 'Permissions, tenant isolation, and immutable audit history.', caps: [['Roles', 'Owner, Admin, Manager, Editor, Viewer scoping.', 'users'], ['Tenant isolation', 'Organization and site boundaries enforced server-side.', 'lock'], ['Audit history', 'Immutable actor/action/diff trail.', 'clock'], ['Session policy', 'Step-up auth for destructive operations.', 'key']] },
      { id: 'settings', label: 'CMS Settings', icon: 'settings', desc: 'Site-scoped and subsystem configuration.', caps: [['Site settings', 'Locale, timezone, and publishing defaults.', 'settings'], ['Integrations', 'CRM, analytics, and webhook connections.', 'link'], ['Domains', 'Primary hostname and alias management.', 'globe'], ['Feature flags', 'Progressive rollout of subsystem capabilities.', 'sliders']] }
    ]
  }
];

export const EXTRA_NAV: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: 'settings', chev: true },
  { id: 'platform', label: 'Platform', icon: 'sliders', chev: true }
];

export const ALL_CMS_ITEMS: NavItem[] = NAV_CMS.flatMap((g) => g.items);

/** The sidebar renders one flat tree under “Website CMS”, in this order. */
export const CMS_FLAT: NavItem[] = NAV_CMS.flatMap((g) => g.items);
export const findNav = (id: string): NavItem | undefined => ALL_CMS_ITEMS.find((i) => i.id === id);
