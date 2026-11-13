/* ============================================================
   Mock database + simulated API layer
   Deterministic seeded generator, localStorage persistence, latency,
   failure injection and permission gates. Pure TypeScript, no DOM.
   ============================================================ */

export type SiteStatus = 'published' | 'draft' | 'archived';
export type ThemeKey = 'main' | 'rewards' | 'portal' | 'blank';

export type DnsState = 'verified' | 'pending' | 'failed';
export type SslState = 'active' | 'provisioning' | 'failed' | 'expiring';

export interface DnsRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  ttl: number;
  status: 'ok' | 'missing' | 'mismatch';
  /** shown to the user when status !== 'ok' */
  found?: string;
}

export interface Domain {
  id: string; siteId: string; hostname: string; primary: boolean;
  dns: DnsState; ssl: SslState;
  sslIssuer?: string; sslExpires?: string;
  addedAt: string; verifiedAt?: string; lastChecked: string;
  records: DnsRecord[];
  error?: string;
  forceHttps: boolean; redirectWww: boolean; hsts: boolean;
}

export interface Site {
  id: string; name: string; host: string; status: SiteStatus;
  dns: DnsState;
  ssl: SslState;
  pages: number; leads: number; theme: ThemeKey; locale: string; tz: string;
  release: string | null; releasedAt: string; share: number; thumb: string; template: string;
  archived?: boolean; archivedAt?: string; created?: string;
  storageMb?: number; team?: string;
}
/** Small illustrative histories for the five summary cards. Not analytics data. */
export const DOMAIN_TRENDS = {
  websites:  [2, 2, 2, 2, 3, 3, 3, 2, 3, 3, 3, 3],
  domains:   [3, 3, 4, 4, 4, 5, 4, 5, 5, 4, 5, 5],
  dns:       [2, 2, 2, 3, 3, 3, 2, 3, 3, 3, 2, 3],
  ssl:       [1, 1, 2, 2, 2, 3, 2, 3, 3, 2, 3, 3],
  pending:   [3, 3, 2, 2, 3, 2, 2, 2, 2, 3, 2, 2]
};

export interface PageRow {
  id: string; siteId: string; title: string; slug: string;
  views: number; leads: number; status: string; updated: string; author: string;
}
export interface Notif { id: string; kind: 'warn' | 'ok' | 'info'; title: string; body: string; time: string; unread: boolean; route: string }
export interface ActivityRow { id: string; kind: string; title: string; meta: string; tone: 'green' | 'violet' | 'blue' | 'amber' }
export interface FormStats { starts: number; submissions: number; completion: number; name: string; leads: number }
export interface Goal { id: string; name: string; value: number; target: number }
export interface Vitals { lcp: number; inp: number; cls: number; grade: string }
export interface Publishing { drafts: number; ready: number; live: string; liveSite: string; publishedAt: string | null }
export interface Banner { state: 'warning' | 'checking' | 'resolved'; dismissed: boolean; issue: string; site: string }
export interface Issue { id: string; kind: string; icon: string; label: string; sub: string; site: string; cta: string }
export interface Permissions { role: string; canCreate: boolean; canPublish: boolean; canManageDomain: boolean; canDelete: boolean }
export interface Org { id: string; name: string; legal: string; plan: string; role: string; initials: string; orgs: { id: string; name: string; initials: string; sites: number; current?: boolean }[] }
export interface User { name: string; initials: string; email: string; role: string }
export interface DB {
  version: number; org: Org; user: User; sites: Site[]; domains: Domain[]; pages: PageRow[];
  notifications: Notif[]; activity: ActivityRow[]; forms: FormStats; goals: Goal[]; vitals: Vitals;
  publishing: Publishing; banner: Banner; issues: Issue[]; permissions: Permissions; activityLog: unknown[];
}


const STORE_KEY = 'wacrm.cms.db.v1';

/* The reference dataset is pinned to a demo clock: the dashboard reports on the
   May 2025 window, so every derived label (axis ticks, release date, "last
   updated") stays consistent with the mock instead of drifting with the host
   clock. Swap DEMO_CLOCK for `new Date()` to run on live data. */
export const DEMO_CLOCK = { date: 'May 30, 2025', time: '10:24 AM' };

export type Gran = 'daily' | 'weekly' | 'monthly';
export interface Point {
  date: Date; label: string; iso: string; visitors: number; leads: number;
  w?: number; lw?: number; leadsRaw?: number; event?: string; bucket?: boolean;
}
export interface OverviewOpts { siteId?: string; days?: number; rangeLabel?: string; endOffset?: number }

/* ---------- deterministic PRNG ---------- */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* ---------- seed database ---------- */

function seedDB(): DB {
  return {
    version: 1,
    org: {
      id: 'org_eurm_01',
      name: "euromilesofficial's Workspace",
      legal: 'EuroMiles Consultancy Pvt. Ltd.',
      plan: 'Business',
      role: 'Owner',
      initials: 'EU',
      orgs: [
        { id: 'org_eurm_01', name: "euromilesofficial's Workspace", initials: 'EU', sites: 3, current: true },
        { id: 'org_eurm_02', name: 'EuroMiles Rewards Sandbox', initials: 'ES', sites: 1 }
      ]
    },
    user: { name: 'Aarav Mehta', initials: 'AM', email: 'aarav@euromiles.in', role: 'Owner' },
    sites: [
      {
        id: 'site_main', name: 'EuroMiles Main', host: 'euromiles.in', status: 'published',
        dns: 'verified', ssl: 'active', pages: 48, leads: 18, theme: 'main',
        locale: 'en-IN', tz: 'Asia/Kolkata', release: 'v1.24', releasedAt: '2h ago',
        share: 0.615, thumb: 'colosseum', template: 'Education Lead-Gen',
        created: '12 Feb 2025', storageMb: 184, team: 'Growth'
      },
      {
        id: 'site_rewards', name: 'EuroMiles Rewards', host: 'rewards.euromiles.in', status: 'published',
        dns: 'verified', ssl: 'active', pages: 16, leads: 6, theme: 'rewards',
        locale: 'en-IN', tz: 'Asia/Kolkata', release: 'v1.18', releasedAt: 'Yesterday',
        share: 0.275, thumb: 'dome', template: 'Loyalty Hub',
        created: '3 Mar 2025', storageMb: 62, team: 'Retention'
      },
      {
        id: 'site_portal', name: 'Partner Portal', host: 'partners.euromiles.in', status: 'draft',
        dns: 'pending', ssl: 'provisioning', pages: 12, leads: 2, theme: 'portal',
        locale: 'en-IN', tz: 'Asia/Kolkata', release: null, releasedAt: 'Never published',
        share: 0.11, thumb: 'portrait', template: 'Partner Extranet',
        created: '28 Apr 2025', storageMb: 21, team: 'Partnerships'
      }
    ],
    domains: [
      {
        id: 'dom_main', siteId: 'site_main', hostname: 'euromiles.in', primary: true,
        dns: 'verified', ssl: 'active', sslIssuer: "Let's Encrypt R3", sslExpires: '14 Aug 2025',
        addedAt: '12 Feb 2025', verifiedAt: '12 Feb 2025', lastChecked: '9 min ago',
        forceHttps: true, redirectWww: true, hsts: true,
        records: [
          { type: 'A', name: 'euromiles.in', value: '76.76.21.21', ttl: 3600, status: 'ok' },
          { type: 'AAAA', name: 'euromiles.in', value: '2606:4700:3033::6815:5b1', ttl: 3600, status: 'ok' },
          { type: 'TXT', name: '_wacrm-verify.euromiles.in', value: 'wacrm-verify=8f31c2', ttl: 300, status: 'ok' }
        ]
      },
      {
        id: 'dom_main_www', siteId: 'site_main', hostname: 'www.euromiles.in', primary: false,
        dns: 'verified', ssl: 'active', sslIssuer: "Let's Encrypt R3", sslExpires: '14 Aug 2025',
        addedAt: '12 Feb 2025', verifiedAt: '12 Feb 2025', lastChecked: '9 min ago',
        forceHttps: true, redirectWww: false, hsts: true,
        records: [
          { type: 'CNAME', name: 'www.euromiles.in', value: 'euromiles.in', ttl: 3600, status: 'ok' }
        ]
      },
      {
        id: 'dom_rewards', siteId: 'site_rewards', hostname: 'rewards.euromiles.in', primary: true,
        dns: 'verified', ssl: 'active', sslIssuer: "Let's Encrypt R3", sslExpires: '2 Sep 2025',
        addedAt: '3 Mar 2025', verifiedAt: '3 Mar 2025', lastChecked: '11 min ago',
        forceHttps: true, redirectWww: false, hsts: false,
        records: [
          { type: 'CNAME', name: 'rewards.euromiles.in', value: 'cname.wacrm.site', ttl: 3600, status: 'ok' },
          { type: 'TXT', name: '_wacrm-verify.rewards.euromiles.in', value: 'wacrm-verify=4a90de', ttl: 300, status: 'ok' }
        ]
      },
      {
        id: 'dom_portal', siteId: 'site_portal', hostname: 'partners.euromiles.in', primary: true,
        dns: 'pending', ssl: 'provisioning',
        addedAt: '28 Apr 2025', lastChecked: '4 min ago',
        forceHttps: true, redirectWww: true, hsts: false,
        records: [
          { type: 'CNAME', name: 'partners.euromiles.in', value: 'cname.wacrm.site', ttl: 3600, status: 'missing', found: 'no record' },
          { type: 'TXT', name: '_wacrm-verify.partners.euromiles.in', value: 'wacrm-verify=1c7b55', ttl: 300, status: 'missing', found: 'no record' }
        ]
      },
      {
        id: 'dom_portal_alias', siteId: 'site_portal', hostname: 'partner.euromiles.in', primary: false,
        dns: 'pending', ssl: 'provisioning',
        addedAt: '28 Apr 2025', lastChecked: '4 min ago',
        forceHttps: true, redirectWww: true, hsts: false,
        records: [
          { type: 'CNAME', name: 'partner.euromiles.in', value: 'cname.wacrm.site', ttl: 3600, status: 'missing', found: 'no record' },
          { type: 'TXT', name: '_wacrm-verify.partner.euromiles.in', value: 'wacrm-verify=1c7b55', ttl: 300, status: 'missing', found: 'no record' }
        ]
      }
    ],
    pages: [
      { id: 'pg_1', siteId: 'site_main', title: 'Study in Italy', slug: '/study-in-italy', views: 2814, leads: 14, status: 'published', updated: '6h ago', author: 'John D.' },
      { id: 'pg_2', siteId: 'site_main', title: 'IMAT Medicine', slug: '/imat-medicine', views: 1620, leads: 8, status: 'published', updated: '2d ago', author: 'Anita N.' },
      { id: 'pg_3', siteId: 'site_main', title: 'Scholarship Guide', slug: '/scholarship-guide', views: 986, leads: 4, status: 'published', updated: '4d ago', author: 'Priya S.' },
      { id: 'pg_4', siteId: 'site_rewards', title: 'Referral Rewards', slug: '/rewards', views: 642, leads: 3, status: 'draft', updated: '1d ago', author: 'Anita N.' },
      { id: 'pg_5', siteId: 'site_rewards', title: 'Tier Benefits', slug: '/tiers', views: 388, leads: 2, status: 'published', updated: '3d ago', author: 'John D.' },
      { id: 'pg_6', siteId: 'site_portal', title: 'Partner Onboarding', slug: '/onboarding', views: 214, leads: 2, status: 'draft', updated: '5h ago', author: 'Aarav M.' },
      { id: 'pg_7', siteId: 'site_portal', title: 'Commission Schedule', slug: '/commission', views: 96, leads: 0, status: 'draft', updated: '8h ago', author: 'Priya S.' }
    ],
    notifications: [
      { id: 'n1', kind: 'warn', title: 'Partner Portal SSL is provisioning', body: 'Certificate for partners.euromiles.in has been requested from the CA.', time: '12m ago', unread: true, route: 'sites' },
      { id: 'n2', kind: 'ok', title: 'Release v1.24 published', body: 'EuroMiles Main · 48 pages live on euromiles.in.', time: '2h ago', unread: true, route: 'publishing' },
      { id: 'n3', kind: 'info', title: 'Campaign: Italy Intake tagged', body: 'Traffic from the campaign landing page is now attributed.', time: '5h ago', unread: true, route: 'overview' },
      { id: 'n4', kind: 'info', title: 'Anita N. edited Main Navigation', body: 'Menu structure updated for mobile output.', time: '4h ago', unread: false, route: 'menus' }
    ],
    activity: [
      { id: 'a1', kind: 'publish', title: 'v1.24 published', meta: 'EuroMiles Main · 2h ago', tone: 'green' },
      { id: 'a2', kind: 'edit', title: 'Edited menu: Main Navigation', meta: 'By Anita N. · 4h ago', tone: 'violet' },
      { id: 'a3', kind: 'page', title: 'Updated page: Study in Italy', meta: 'By John D. · 6h ago', tone: 'blue' },
      { id: 'a4', kind: 'rollback', title: 'Rollback to v1.23 (resolved issue)', meta: 'Partner Portal · Yesterday', tone: 'amber' }
    ],
    forms: { starts: 112, submissions: 26, completion: 26 / 112, name: 'Study Enquiry Form', leads: 26 },
    goals: [
      { id: 'g1', name: 'Qualified Leads', value: 26, target: 40 },
      { id: 'g2', name: 'Counselling Bookings', value: 8, target: 10 }
    ],
    vitals: { lcp: 2.1, inp: 92, cls: 0.03, grade: 'good' },
    publishing: { drafts: 4, ready: 2, live: 'v1.24', liveSite: 'EuroMiles Main', publishedAt: 'May 29, 2025' },
    banner: { state: 'warning', dismissed: false, issue: 'Partner Portal: DNS or SSL verification is incomplete.', site: 'site_portal' },
    issues: [
      { id: 'iss_ssl', kind: 'warn', icon: 'lock', label: 'SSL Pending', sub: 'partners.euromiles.in', site: 'site_portal', cta: 'Resolve' },
      { id: 'iss_link', kind: 'info', icon: 'link', label: '1 Broken Link', sub: 'Scholarship Guide', site: 'site_main', cta: 'Review' },
      { id: 'iss_pub', kind: 'amber', icon: 'upload', label: '2 Unpublished Changes', sub: 'Across 2 pages', site: 'site_main', cta: 'Preflight' }
    ],
    permissions: { role: 'Owner', canCreate: true, canPublish: true, canManageDomain: true, canDelete: true },
    activityLog: []
  };
}

/* ---------- persistence ---------- */
let db: DB;
try {
  const raw = localStorage.getItem(STORE_KEY);
  db = raw ? (JSON.parse(raw) as DB) : seedDB();
} catch (e) { db = seedDB(); }
if (!db || !db.sites) db = seedDB();
if (!db.issues) db.issues = seedDB().issues;
if (!db.domains) db.domains = seedDB().domains;
if (db.publishing && !db.publishing.publishedAt) db.publishing.publishedAt = 'May 29, 2025';

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
}

/* ---------- date helpers ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtShort = (d: Date): string => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const fmtISO = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const TODAY = (() => { const d = new Date(2025, 4, 30); d.setHours(0, 0, 0, 0); return d; })();

/* ---------- series generation ---------- */
function buildSeries(siteId: string, days: number, endOffset = 0): Point[] {
  const seedBase = hash('ser|' + siteId + '|' + days);
  const rnd = mulberry32(seedBase);
  const pts = [];
  for (let i = 0; i < days; i++) {
    const t = i / Math.max(1, days - 1);
    // gentle S-curve growth + weekly rhythm + noise
    const trend = 0.72 + 0.52 * (t * t * (3 - 2 * t));
    const date = addDays(TODAY, -(days - 1 - i) - endOffset);
    const dow = date.getDay();
    const weekly = dow === 0 || dow === 6 ? 0.82 : 1;
    const noise = 0.90 + rnd() * 0.20;
    const bump = (i > days * 0.34 && i < days * 0.42) ? 1.16 : 1;      // release bump
    const bump2 = (i > days * 0.66 && i < days * 0.74) ? 1.24 : 1;     // campaign bump
    pts.push({
      date, label: fmtShort(date), iso: fmtISO(date),
      w: trend * weekly * noise * bump * bump2,
      lw: (0.35 + rnd() * 0.9) * (t > 0.4 ? 1.25 : 1),
      hits: []
    });
  }
  return pts as unknown as Point[];
}

const RANGE_TARGETS: Record<string, { visitors: number; leads: number; bookings: number; starts: number }> = {
  // visitors & derived targets per site for a 30-day window
  'all':      { visitors: 5420, leads: 26, bookings: 8, starts: 112 },
  'site_main':{ visitors: 3410, leads: 18, bookings: 6, starts: 78 },
  'site_rewards': { visitors: 1420, leads: 6, bookings: 2, starts: 26 },
  'site_portal':  { visitors: 590,  leads: 2, bookings: 0, starts: 8 }
};

function scaleRange(_base: number, days: number): number {
  // 90-day windows carry more than 3x because of history; 7-day less than 1/4
  const map: Record<number, number> = { 7: 0.26, 14: 0.5, 30: 1, 90: 2.78 };
  return map[days] !== undefined ? map[days] : days / 30;
}

function makeSeries(siteId: string, days: number, endOffset = 0): Point[] {
  const raw = buildSeries(siteId, days, endOffset);
  const target = RANGE_TARGETS[siteId] || RANGE_TARGETS.all;
  const f = scaleRange(target.visitors, days);
  const wSum = raw.reduce((s, p) => s + (p.w ?? 0), 0);
  const vTarget = Math.round(target.visitors * f);
  const lTarget = Math.max(1, Math.round(target.leads * f));
  const lSum = raw.reduce((s, p) => s + (p.lw ?? 0), 0);

  raw.forEach((p) => {
    p.visitors = Math.max(4, Math.round(((p.w ?? 0) / wSum) * vTarget));
    p.leadsRaw = ((p.lw ?? 0) / lSum) * lTarget;
  });
  // reconcile rounding so the month total matches the headline metric exactly
  const vDiff = vTarget - raw.reduce((s, q) => s + q.visitors, 0);
  const lastPt = raw[raw.length - 1];
  lastPt.visitors = Math.max(4, lastPt.visitors + vDiff);

  // distribute integer leads using largest remainder
  const leadsF = raw.map(p => p.leadsRaw ?? 0);
  let assigned = leadsF.map(v => Math.floor(v));
  let rem = lTarget - assigned.reduce((a, b) => a + b, 0);
  const order = leadsF.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) assigned[order[k % order.length][1]] += 1;
  raw.forEach((p, i) => { p.leads = assigned[i]; delete p.leadsRaw; });

  // annotations
  const annIdx = Math.round(days * 0.36), campIdx = Math.round(days * 0.68);
  if (raw[annIdx]) raw[annIdx].event = 'v1.23 released';
  if (raw[campIdx] && campIdx !== annIdx) raw[campIdx].event = 'Campaign: Italy Intake';

  return raw;
}

function aggregate(series: Point[], mode: Gran): Point[] {
  if (mode === 'daily' || !mode) return series;
  const buckets = new Map<string, Point>();
  series.forEach(p => {
    const d = p.date;
    let key, label;
    if (mode === 'weekly') {
      const start = addDays(d, -((d.getDay() + 6) % 7));
      key = fmtISO(start); label = 'Wk ' + fmtShort(start);
    } else {
      key = d.getFullYear() + '-' + d.getMonth(); label = MONTHS[d.getMonth()];
    }
    if (!buckets.has(key)) buckets.set(key, { label, visitors: 0, leads: 0, iso: key, date: d, bucket: true });
    const b = buckets.get(key)!;
    b.visitors += p.visitors; b.leads += p.leads;
    if (p.event) b.event = p.event;
    b.iso = p.iso; b.date = p.date;
  });
  return Array.from(buckets.values());
}

/* ---------- computed overview ---------- */
function sum(a: Point[], k: 'visitors' | 'leads'): number { return a.reduce((s, x) => s + (x[k] || 0), 0); }

function overview(opts: OverviewOpts) {
  const siteId = opts.siteId || 'all';
  const days = opts.days || 30;
  const endOffset = Math.max(0, opts.endOffset || 0);
  const series = makeSeries(siteId, days, endOffset);
  const visitors = sum(series, 'visitors');
  const leads = sum(series, 'leads');
  const t = RANGE_TARGETS[siteId] || RANGE_TARGETS.all;
  const f = scaleRange(t.visitors, days);
  const bookings = Math.round(t.bookings * f);
  const starts = Math.round(t.starts * f);
  const leadRate = visitors ? (leads / visitors) * 100 : 0;

  const growth = { visitors: 28, leads: 36, leadRate: 0.03, bookings: 33, lcp: -0.4, sites: 0 };

    const mix = [
    { id: 'search', name: 'Search', detail: 'Google, Bing', pct: 56, color: '#16B364' },
    { id: 'social', name: 'Social', detail: 'Instagram, YouTube, etc.', pct: 22, color: '#6D4AFF' },
    { id: 'direct', name: 'Direct', detail: 'Typed URL, Bookmarks', pct: 14, color: '#2563EB' },
    { id: 'referral', name: 'Referral', detail: 'Other websites', pct: 8, color: '#1E40AF' }
  ].map(m => ({ ...m, visitors: Math.round(visitors * m.pct / 100) }));

  const pages = db.pages
    .filter(p => siteId === 'all' || p.siteId === siteId)
    .map(p => {
      const site = db.sites.find(s => s.id === p.siteId) as Site | undefined;
      return {
        ...p, siteName: site ? site.name : '', host: site ? site.host : '',
        conv: p.views ? (p.leads / p.views) * 100 : 0,
        live: p.status === 'published'
      };
    })
    .sort((a, b) => b.views - a.views);

  const siteHealth = db.sites.map(s => ({
    id: s.id, name: s.name, host: s.host,
    dns: s.dns, ssl: s.ssl, release: s.release, status: s.status,
    records: s.dns === 'pending'
      ? [{ type: 'TXT', name: '_wacrm-verify.' + s.host, value: 'wacrm-verify=' + hash(s.host).toString(36) }]
      : [{ type: 'A', name: s.host, value: '76.76.21.21' }]
  }));

  return {
    range: { days, label: opts.rangeLabel || ('Last ' + days + ' days') },
    siteId,
    series,
    totals: { visitors, leads, bookings, starts, leadRate, sites: db.sites.filter(s => !s.archived).length, lcp: 2.1 },
    growth,
    funnel: [
      { id: 'visitors', name: 'Visitors', value: visitors, pct: null },
      { id: 'starts', name: 'Form starts', value: starts, pct: visitors ? starts / visitors * 100 : 0 },
      { id: 'leads', name: 'Leads', value: leads, pct: starts ? leads / starts * 100 : 0 },
      { id: 'bookings', name: 'Bookings', value: bookings, pct: leads ? bookings / leads * 100 : 0 }
    ],
    acquisition: mix,
    pages,
    siteHealth,
    domains: db.domains || [],
    sites: db.sites.filter(s => !s.archived),
    archived: db.sites.filter(s => s.archived),
    activity: db.activity,
    forms: { ...db.forms, leads },
    goals: db.goals,
    vitals: db.vitals,
    publishing: db.publishing,
    banner: db.banner,
    issues: db.issues || [],
    notifications: db.notifications,
    org: db.org,
    user: db.user,
    permissions: db.permissions,
    updatedAt: new Date()
  };
}

/* ---------- API surface ---------- */
const FAIL = { fail: false, empty: false };
const latency = (min = 320, max = 620): Promise<void> => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

export const API = {
  latency,
  mode: FAIL,
  raw: () => db,
  getOverview: async (opts: OverviewOpts) => {
    await latency();
    if (FAIL.fail) throw new Error('Analytics service unavailable (502)');
    const data = overview(opts);
    if (FAIL.empty) {
      data.series = [];
      data.pages = [];
      data.totals = { ...data.totals, visitors: 0, leads: 0, bookings: 0, starts: 0, leadRate: 0 };
      data.funnel = data.funnel.map(x => ({ ...x, value: 0, pct: 0 }));
      data.acquisition = data.acquisition.map(a => ({ ...a, visitors: 0 }));
    }
    return data;
  },
  getSeries: async (opts: { siteId: string; days: number; mode: Gran }) => { await latency(120, 260); return aggregate(makeSeries(opts.siteId, opts.days), opts.mode); },
  getSite: (id: string) => db.sites.find(s => s.id === id),
  createSite: async ({ name, host, locale, tz, template }: { name: string; host: string; locale: string; tz: string; template?: string }) => {
    await latency(600, 900);
    if (db.sites.some(s => s.host.toLowerCase() === host.toLowerCase())) {
      const e = Object.assign(new Error('That hostname is already connected to another website.'), { field: 'host' }); throw e;
    }
    const id = 'site_' + Math.random().toString(36).slice(2, 8);
    const site = {
      id, name, host, status: 'draft' as SiteStatus, dns: 'pending' as const, ssl: 'provisioning' as const,
      pages: 0, leads: 0, theme: 'blank' as ThemeKey, locale, tz, release: null, releasedAt: 'Never published',
      share: 0, thumb: 'blank', template: template || 'Blank site', created: new Date().toISOString()
    };
    db.sites.push(site);
    db.activity.unshift({ id: 'a' + Date.now(), kind: 'create', title: 'Created website: ' + name, meta: 'By you · just now', tone: 'violet' });
    db.banner = { ...db.banner, state: 'warning', dismissed: false, site: id, issue: name + ': connect a domain to finish DNS verification.' };
    persist();
    return site;
  },
  duplicateSite: async (id: string) => {
    await latency(500, 800);
    const src = db.sites.find(s => s.id === id)!;
    if (!src) throw new Error('Website not found');
    const copy = { ...src, id: 'site_' + Math.random().toString(36).slice(2, 8), name: src.name + ' (copy)', host: 'copy-' + src.host, status: 'draft' as SiteStatus, release: null, releasedAt: 'Never published' };
    db.sites.push(copy);
    db.activity.unshift({ id: 'a' + Date.now(), kind: 'create', title: 'Duplicated website: ' + src.name, meta: 'By you · just now', tone: 'violet' });
    persist();
    return copy;
  },
  renameSite: async (id: string, name: string) => {
    await latency(320, 520);
    if (!name.trim()) { const e = Object.assign(new Error('A website name is required.'), { field: 'name' }); throw e; }
    const s = db.sites.find(x => x.id === id)!;
    s.name = name.trim();
    db.activity.unshift({ id: 'a' + Date.now(), kind: 'edit', title: 'Renamed website to ' + s.name, meta: 'By you · just now', tone: 'blue' });
    persist(); return s;
  },
  setSiteStatus: async (id: string, status: SiteStatus) => {
    await latency(300, 480);
    const s = db.sites.find(x => x.id === id)!;
    if (!s) throw new Error('Website not found');
    s.status = status; persist(); return s;
  },
  archiveSite: async (id: string) => {
    await latency(420, 700);
    const s = db.sites.find(x => x.id === id)!;
    s.archived = true; s.archivedAt = new Date().toISOString();
    db.activity.unshift({ id: 'a' + Date.now(), kind: 'archive', title: 'Archived website: ' + s.name, meta: 'By you · just now', tone: 'amber' });
    persist(); return s;
  },
  restoreSite: async (id: string) => {
    await latency(360, 560);
    const s = db.sites.find(x => x.id === id)!;
    s.archived = false; delete s.archivedAt; persist(); return s;
  },
  deleteSite: async (id: string) => {
    await latency(600, 900);
    const s = db.sites.find(x => x.id === id)!;
    if (s.status === 'published' && !s.archived) {
      const e = new Error('A published website cannot be deleted. Archive it first, or unpublish via Publishing & Releases.');
      throw e;
    }
    db.sites = db.sites.filter(x => x.id !== id);
    db.pages = db.pages.filter(p => p.siteId !== id);
    persist(); return true;
  },
  verifyDomain: async (id: string) => {
    await latency(1200, 1700);
    const s = db.sites.find(x => x.id === id)!;
    if (!s) throw new Error('Website not found');
    s.dns = 'verified';
    if (db.banner.site === id) db.banner = { ...db.banner, state: 'resolved', issue: s.name + ': domain verified.' };
    db.activity.unshift({ id: 'a' + Date.now(), kind: 'publish', title: 'DNS verified for ' + s.name, meta: 'Verification job · just now', tone: 'green' });
    persist(); return s;
  },
  provisionSsl: async (id: string) => {
    await latency(900, 1400);
    const s = db.sites.find(x => x.id === id)!;
    s.ssl = 'active'; persist(); return s;
  },
  /* ---------------- domains (Module 2) ---------------- */
  listDomains: (siteId?: string) => {
    const rows = db.domains || [];
    return siteId ? rows.filter(d => d.siteId === siteId) : rows;
  },
  addDomain: async (siteId: string, hostname: string) => {
    await latency(420, 760);
    const host = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
      throw Object.assign(new Error('That does not look like a hostname.'), { code: 'VALIDATION_FAILED' });
    }
    if ((db.domains || []).some(d => d.hostname === host)) {
      throw Object.assign(new Error(`${host} is already attached to another website.`), { code: 'CONFLICT' });
    }
    const site = db.sites.find(s => s.id === siteId);
    const domain: Domain = {
      id: 'dom_' + Math.random().toString(36).slice(2, 8),
      siteId, hostname: host, primary: !(db.domains || []).some(d => d.siteId === siteId),
      dns: 'pending', ssl: 'failed',
      addedAt: new Date(2025, 4, 30).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      lastChecked: 'just now',
      forceHttps: true, redirectWww: true, hsts: false,
      records: [
        { type: 'CNAME', name: host, value: 'cname.wacrm.site', ttl: 3600, status: 'missing', found: 'no record' },
        { type: 'TXT', name: '_wacrm-verify.' + host, value: 'wacrm-verify=' + hash(host).toString(36).slice(0, 6), ttl: 300, status: 'missing', found: 'no record' }
      ]
    };
    db.domains = [...(db.domains || []), domain];
    if (site && domain.primary) { site.host = host; site.dns = 'pending'; site.ssl = 'failed'; }
    persist();
    return domain;
  },
  removeDomain: async (siteId: string, domainId: string) => {
    await latency(320, 560);
    const dom = (db.domains || []).find(d => d.id === domainId);
    if (!dom) throw Object.assign(new Error('Domain not found.'), { code: 'NOT_FOUND' });
    const siblings = (db.domains || []).filter(d => d.siteId === siteId && d.id !== domainId);
    if (dom.primary && siblings.length) {
      throw Object.assign(new Error('Make another domain primary before removing this one.'), { code: 'CONFLICT' });
    }
    db.domains = (db.domains || []).filter(d => d.id !== domainId);
    persist();
    return true;
  },
  setDomainOption: async (domainId: string, key: 'forceHttps' | 'redirectWww' | 'hsts', value: boolean) => {
    await latency(240, 460);
    const dom = (db.domains || []).find(d => d.id === domainId);
    if (!dom) throw Object.assign(new Error('Domain not found.'), { code: 'NOT_FOUND' });
    if (dom.dns !== 'verified' && (key === 'forceHttps' || key === 'hsts')) {
      throw Object.assign(new Error('Verify DNS before enforcing transport security.'), { code: 'PRECONDITION_FAILED' });
    }
    db.domains = (db.domains || []).map(d => d.id === domainId ? { ...d, [key]: value } : d);
    persist();
    return true;
  },
  setPrimaryDomain: async (siteId: string, domainId: string) => {
    await latency(280, 520);
    const dom = (db.domains || []).find(d => d.id === domainId);
    if (!dom) throw Object.assign(new Error('Domain not found.'), { code: 'NOT_FOUND' });
    if (dom.dns !== 'verified') {
      throw Object.assign(new Error('Verify DNS before making this domain primary.'), { code: 'PRECONDITION_FAILED' });
    }
    db.domains = (db.domains || []).map(d => d.siteId === siteId ? { ...d, primary: d.id === domainId } : d);
    const site = db.sites.find(s => s.id === siteId);
    if (site) site.host = dom.hostname;
    persist();
    return true;
  },
  verifyDomainRecord: async (siteId: string, domainId: string) => {
    await latency(900, 1500);
    if (Math.random() < 0.18) {
      db.domains = (db.domains || []).map(d => d.id === domainId ? {
        ...d, dns: 'failed' as const, lastChecked: 'just now',
        error: 'Resolver returned NXDOMAIN for the CNAME record — publish it and verify again.'
      } : d);
      persist();
      throw Object.assign(new Error('DNS check failed: NXDOMAIN on cname.'), { code: 'VERIFY_FAILED' });
    }
    db.domains = (db.domains || []).map(d => d.id === domainId ? {
      ...d, dns: 'verified' as const, ssl: d.ssl === 'active' ? d.ssl : ('provisioning' as const),
      verifiedAt: 'just now', lastChecked: 'just now', error: undefined,
      records: d.records.map(r => ({ ...r, status: 'ok' as const, found: undefined }))
    } : d);
    const site = db.sites.find(s => s.id === siteId);
    if (site) { site.dns = 'verified'; if (site.ssl !== 'active') site.ssl = 'provisioning'; }
    persist();
    return true;
  },
  provisionSslRecord: async (siteId: string, domainId: string) => {
    await latency(1100, 1800);
    db.domains = (db.domains || []).map(d => d.id === domainId ? {
      ...d, ssl: 'active', sslIssuer: "Let's Encrypt R3", sslExpires: '28 Aug 2025', lastChecked: 'just now'
    } : d);
    const site = db.sites.find(s => s.id === siteId);
    if (site) site.ssl = 'active';
    persist();
    return true;
  },
  resolveIssue: (id: string) => { db.issues = (db.issues || []).filter(i => i.id !== id); persist(); return db.issues; },
  dismissBanner: () => { db.banner = { ...db.banner, dismissed: true }; persist(); },
  restoreBanner: () => { db.banner = { ...db.banner, dismissed: false, state: db.sites.some(s => s.dns === 'pending') ? 'warning' : 'resolved' }; persist(); },
  setBannerState: (state: Banner['state']) => { db.banner = { ...db.banner, state, dismissed: false }; persist(); },
  markAllRead: () => { db.notifications = db.notifications.map(n => ({ ...n, unread: false })); persist(); },
  readNotification: (id: string) => { db.notifications = db.notifications.map(n => n.id === id ? { ...n, unread: false } : n); persist(); },
  publishRelease: async () => {
    await latency(900, 1300);
    if (Math.random() < 0.34) {
      const e = new Error('Conflict: release v1.25 was created by Anita N. while you were editing.');
      throw Object.assign(e, { code: 'CONFLICT' as const });
    }
    db.publishing = { ...db.publishing, live: 'v1.25', publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), drafts: Math.max(0, db.publishing.drafts - 2) };
    db.activity.unshift({ id: 'a' + Date.now(), kind: 'publish', title: 'v1.25 published', meta: 'EuroMiles Main · just now', tone: 'green' });
    persist(); return db.publishing;
  },
  reset: () => { db = seedDB(); persist(); return db; }
};


export const DB_UTIL = { hash, fmtShort, fmtISO, addDays, TODAY, mulberry32 };
