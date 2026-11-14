/* ============================================================
   App store — one provider, one state object, typed actions
   ------------------------------------------------------------
   The React equivalent of a small Redux store: filters, fetched data,
   overlays, toasts and mutations live here so every widget can read
   what it needs instead of receiving props through four layers.
   ============================================================ */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode
} from "react";
import { API, type Gran, type Point, type Site } from "./data";
import { rangeLabel } from "./format";
import type { Domain } from "./data";
import { ALL_CMS_ITEMS } from "./nav";

export type DemoState = "default" | "loading" | "empty" | "error" | "conflict" | "denied";
export type Role = "Owner" | "Editor" | "Viewer";
export type SortKey = "views" | "leads" | "conv";
export interface SortState { key: SortKey; dir: "asc" | "desc" }

export interface ToastItem {
  id: number;
  type: "success" | "info" | "warn" | "error";
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
}

export type ModalState =
  | { kind: "none" }
  | { kind: "wizard" }
  | { kind: "preflight" }
  | { kind: "conflict" }
  | { kind: "published"; version: string; site: string }
  | { kind: "domain"; siteId: string }
  | { kind: "connect-domain"; siteId?: string }
  | { kind: "domain-settings"; siteId: string }
  | { kind: "rename"; siteId: string }
  | { kind: "duplicate"; siteId: string }
  | { kind: "archive"; siteId: string }
  | { kind: "delete"; siteId: string }
  | { kind: "preview"; siteId: string }
  | { kind: "goals" }
  | { kind: "publish-queue"; which: "drafts" | "ready" };

export type DrawerState =
  | { kind: "none" }
  | { kind: "kpi"; id: string }
  | { kind: "stage"; id: string }
  | { kind: "channel"; id: string }
  | { kind: "page"; id: string }
  | { kind: "health"; which: string }
  | { kind: "activity" }
  | { kind: "forms" }
  | { kind: "vitals"; which: string }
  | { kind: "issues" }
  | { kind: "ssl"; siteId: string }
  | { kind: "broken-link" }
  | { kind: "workspace"; siteId: string }
  | { kind: "site"; id: string }
  | { kind: "point"; point: Point };

export interface OverviewData {
  range: { days: number; label: string };
  siteId: string;
  series: Point[];
  totals: { visitors: number; leads: number; bookings: number; starts: number; leadRate: number; sites: number; lcp: number };
  growth: { visitors: number; leads: number; leadRate: number; bookings: number; lcp: number; sites: number };
  funnel: { id: string; name: string; value: number; pct: number | null }[];
  acquisition: { id: string; name: string; detail: string; pct: number; color: string; visitors: number }[];
  pages: (ReturnType<typeof API.raw>["pages"][number] & { siteName: string; host: string; conv: number; live: boolean })[];
  siteHealth: { id: string; name: string; host: string; dns: string; ssl: string; release: string | null; status: string; records: { type: string; name: string; value: string }[] }[];
  sites: Site[];
  domains: Domain[];
  archived: Site[];
  activity: ReturnType<typeof API.raw>["activity"];
  forms: { starts: number; submissions: number; completion: number; name: string; leads: number };
  goals: { id: string; name: string; value: number; target: number }[];
  vitals: { lcp: number; inp: number; cls: number; grade: string };
  publishing: { drafts: number; ready: number; live: string; liveSite: string; publishedAt: string | null };
  banner: { state: string; dismissed: boolean; issue: string; site: string };
  issues: { id: string; kind: string; icon: string; label: string; sub: string; site: string; cta: string }[];
  notifications: ReturnType<typeof API.raw>["notifications"];
  org: ReturnType<typeof API.raw>["org"];
  user: ReturnType<typeof API.raw>["user"];
  permissions: { role: string; canCreate: boolean; canPublish: boolean; canManageDomain: boolean; canDelete: boolean };
  updatedAt: Date;
}

interface Store {
  /* routing */
  screen: string;
  go: (screen: string) => void;
  /* filters */
  siteId: string;
  setSite: (id: string) => void;
  days: number;
  setDays: (d: number) => void;
  /* days back from the demo "today" to the end of the window */
  rangeEnd: number;
  rangeName: string;
  setRange: (days: number, endOffset: number, name?: string) => void;
  gran: Gran;
  setGran: (g: Gran) => void;
  visible: { visitors: boolean; leads: boolean };
  toggleSeries: (k: "visitors" | "leads") => void;
  sort: SortState;
  setSort: (s: SortState) => void;
  /* data */
  data: OverviewData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  applyForcedState: (s: DemoState) => void;
  demo: DemoState;
  /* role */
  role: Role;
  can: (a: "create" | "publish" | "domain" | "delete") => boolean;
  /* overlays */
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  drawer: DrawerState;
  openDrawer: (d: DrawerState) => void;
  closeDrawer: () => void;
  palette: boolean;
  setPalette: (b: boolean) => void;
  toasts: ToastItem[];
  toast: (t: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
  /* crisp actions */
  scrolledTo: (id: string) => void;
  /* mutations */
  createSite: (input: { name: string; host: string; locale: string; tz: string; template: string }) => Promise<Site>;
  renameSite: (id: string, name: string) => Promise<void>;
  duplicateSite: (id: string) => Promise<void>;
  archiveSite: (id: string) => Promise<void>;
  restoreSite: (id: string) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;
  verifyDomain: (id: string) => Promise<"resolved" | "partial">;
  publishRelease: () => Promise<{ ok: boolean; version?: string }>;
  rollback: (version: string) => Promise<void>;
  resolveIssue: (id: string) => void;
  dismissBanner: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  /* domains (Module 2) */
  addDomain: (siteId: string, hostname: string) => Promise<{ ok: boolean; error?: string; domain?: Domain }>;
  removeDomain: (siteId: string, domainId: string) => Promise<{ ok: boolean; error?: string }>;
  makePrimary: (siteId: string, domainId: string) => Promise<{ ok: boolean; error?: string }>;
  verifyRecord: (siteId: string, domainId: string) => Promise<{ ok: boolean; error?: string }>;
  provisionRecord: (siteId: string, domainId: string) => Promise<{ ok: boolean; error?: string }>;
  setDomainOption: (domainId: string, key: "forceHttps" | "redirectWww" | "hsts", value: boolean) => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

/* ---------- URL state: #/<screen>?site=<id>&range=<days> ---------- */
const KNOWN_SCREENS = new Set(["overview", ...ALL_CMS_ITEMS.map((i) => i.id), "settings", "platform"]);

function readHash(): { screen: string; site: string; days: number; end: number } {
  const raw = (typeof location !== "undefined" ? location.hash : "").replace(/^#\/?/, "");
  const [seg, qs] = raw.split("?");
  const q = new URLSearchParams(qs ?? "");
  const range = Number(q.get("range"));
  return {
    screen: seg && KNOWN_SCREENS.has(seg) ? seg : "overview",
    site: q.get("site") || "all",
    days: Number.isFinite(range) && range >= 1 && range <= 366 ? Math.round(range) : 30,
    end: Math.max(0, Number(q.get("end") ?? 0) || 0)
  };
}

/** Label for an arbitrary window ending `end` days before the demo "today". */
const DEMO_TODAY = new Date(2025, 4, 30);
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (d: Date) => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
function windowName(days: number, end: number): string {
  if (!end) return rangeLabel(days);
  const last = new Date(DEMO_TODAY); last.setDate(last.getDate() - end);
  const first = new Date(last); first.setDate(first.getDate() - (days - 1));
  return `${shortDate(first)} – ${shortDate(last)}`;
}

function buildHash(screen: string, site: string, days: number, end = 0): string {
  const q = new URLSearchParams();
  if (site !== "all") q.set("site", site);
  if (days !== 30) q.set("range", String(days));
  if (end > 0) q.set("end", String(end));
  const qs = q.toString();
  return `#/${screen}${qs ? `?${qs}` : ""}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = readHash();
  const [screen, setScreen] = useState(initial.screen);
  const [siteId, setSiteId] = useState(initial.site);
  const [days, setDaysRaw] = useState(initial.days);
  const [rangeEnd, setRangeEnd] = useState(initial.end);
  const [rangeName, setRangeName] = useState(() => windowName(initial.days, initial.end));
  const [gran, setGranRaw] = useState<Gran>("daily");
  const [visible, setVisible] = useState({ visitors: true, leads: true });
  const [sort, setSort] = useState<SortState>({ key: "views", dir: "desc" });
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoState>("default");
  const [role, setRole] = useState<Role>("Owner");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "none" });
  const [palette, setPalette] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(1);
  const demoRef = useRef<DemoState>("default");
  demoRef.current = demo;
  const roleRef = useRef<Role>(role);
  roleRef.current = role;

  /* keep the address bar in sync; navigation pushes history, filters replace */
  const lastScreen = useRef(initial.screen);
  useEffect(() => {
    const next = buildHash(screen, siteId, days, rangeEnd);
    if (typeof location === "undefined" || location.hash === next) return;
    if (lastScreen.current !== screen) { history.pushState(null, "", next); lastScreen.current = screen; }
    else history.replaceState(null, "", next);
  }, [screen, siteId, days, rangeEnd]);

  /* browser back/forward + hand-edited hashes */
  useEffect(() => {
    const apply = () => {
      const h = readHash();
      lastScreen.current = h.screen;
      setScreen(h.screen);
      setSiteId(h.site);
      setDaysRaw(h.days);
      setRangeEnd(h.end);
      setRangeName(windowName(h.days, h.end));
      setDrawer({ kind: "none" });
    };
    window.addEventListener("popstate", apply);
    window.addEventListener("hashchange", apply);
    return () => {
      window.removeEventListener("popstate", apply);
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = toastId.current++;
    setToasts((list) => [...list.slice(-3), { ...t, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), []);

  const firstLoad = useRef(true);
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      // the first paint holds the skeleton long enough to show the shimmer
      if (firstLoad.current) { firstLoad.current = false; await new Promise((r) => setTimeout(r, 760)); }
      const res = (await API.getOverview({ siteId, days, endOffset: rangeEnd, rangeLabel: rangeName })) as unknown as OverviewData;
      if (demoRef.current === "empty") {
        res.series = [];
        res.pages = [];
        res.totals = { ...res.totals, visitors: 0, leads: 0, bookings: 0, starts: 0, leadRate: 0 };
        res.funnel = res.funnel.map((f) => ({ ...f, value: 0, pct: 0 }));
        res.acquisition = res.acquisition.map((a) => ({ ...a, visitors: 0 }));
        /* the rail cards must agree with the zeroed totals, or the screen contradicts itself */
        res.forms = { ...res.forms, starts: 0, submissions: 0, completion: 0, leads: 0 };
        res.goals = res.goals.map((g) => ({ ...g, value: 0 }));
      }
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, days, rangeEnd, rangeName]);

  useEffect(() => { void load(); }, [load]);

  const setDays = useCallback((d: number) => {
    setDaysRaw(d);
    setRangeEnd(0);
    setRangeName(rangeLabel(d));
    setGranRaw((g) => (d < 14 && g !== "daily" ? "daily" : g));
  }, []);

  const setGran = useCallback((g: Gran) => {
    setGranRaw(g);
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 360);
  }, []);

  const toggleSeries = useCallback((k: "visitors" | "leads") => {
    setVisible((v) => {
      if (v[k] && Object.values(v).filter(Boolean).length === 1) {
        toast({ type: "warn", title: "Keep at least one series visible", sub: "Enable the other series before hiding this one." });
        return v;
      }
      return { ...v, [k]: !v[k] };
    });
  }, [toast, screen]);

  const can = useCallback((a: "create" | "publish" | "domain" | "delete") => {
    if (roleRef.current === "Viewer") return false;
    if (roleRef.current === "Editor" && (a === "delete" || a === "domain")) return false;
    return true;
  }, []);

  const refreshAfter = useCallback(async (silent = true) => {
    await load({ silent });
  }, [load]);

  const api = useMemo<Pick<Store,
    "createSite" | "renameSite" | "duplicateSite" | "archiveSite" | "restoreSite" | "deleteSite" |
    "verifyDomain" | "publishRelease" | "rollback" | "resolveIssue" | "dismissBanner" | "markAllRead" | "markRead" |
    "addDomain" | "removeDomain" | "makePrimary" | "verifyRecord" | "provisionRecord" | "setDomainOption"
  >>(() => ({
    createSite: async (input) => {
      const site = await API.createSite(input);
      await refreshAfter();
      toast({ type: "success", title: "Website created", sub: `${site.name} · ${site.host}` });
      return site;
    },
    renameSite: async (id, name) => {
      await API.renameSite(id, name);
      await refreshAfter();
    },
    duplicateSite: async (id) => {
      const copy = await API.duplicateSite(id);
      await refreshAfter();
      toast({ type: "success", title: "Website duplicated", sub: `${copy.name} · drafts only` });
    },
    archiveSite: async (id) => {
      await API.archiveSite(id);
      await refreshAfter();
    },
    restoreSite: async (id) => {
      await API.restoreSite(id);
      await refreshAfter();
    },
    deleteSite: async (id) => {
      await API.deleteSite(id);
      await refreshAfter();
    },
    verifyDomain: async (id) => {
      await API.verifyDomain(id);
      await refreshAfter();
      const site = API.getSite(id);
      const partial = site ? site.ssl !== "active" : true;
      if (partial) await API.provisionSsl(id);
      await refreshAfter();
      return partial ? "partial" : "resolved";
    },
    publishRelease: async () => {
      try {
        await API.publishRelease();
        const version = API.raw().publishing.live;
        await refreshAfter();
        return { ok: true, version };
      } catch (err) {
        const e = err as { code?: string; message: string };
        if (e.code === "CONFLICT") {
          setModal({ kind: "conflict" });
          return { ok: false };
        }
        toast({ type: "error", title: "Publish failed", sub: e.message });
        return { ok: false };
      }
    },
    addDomain: async (siteId, hostname) => {
      try {
        const domain = await API.addDomain(siteId, hostname);
        await refreshAfter();
        toast({ type: "success", title: `${hostname} added`, sub: "Publish the DNS records shown, then verify." });
        return { ok: true, domain };
      } catch (e) {
        const err = e as { code?: string; message: string };
        toast({ type: "error", title: err.code === "CONFLICT" ? "Domain already in use" : "Could not add domain", sub: err.message });
        return { ok: false, error: err.message };
      }
    },
    removeDomain: async (siteId, domainId) => {
      try {
        await API.removeDomain(siteId, domainId);
        await refreshAfter();
        toast({ type: "success", title: "Domain removed", sub: "Traffic for that hostname stops resolving to this site." });
        return { ok: true };
      } catch (e) {
        const err = e as { message: string };
        toast({ type: "error", title: "Domain not removed", sub: err.message });
        return { ok: false, error: err.message };
      }
    },
    makePrimary: async (siteId, domainId) => {
      try {
        await API.setPrimaryDomain(siteId, domainId);
        await refreshAfter();
        toast({ type: "success", title: "Primary domain updated", sub: "Canonical links and sitemaps now use this hostname." });
        return { ok: true };
      } catch (e) {
        const err = e as { message: string };
        toast({ type: "warn", title: "Primary domain unchanged", sub: err.message });
        return { ok: false, error: err.message };
      }
    },
    setDomainOption: async (domainId, key, value) => {
      try {
        await API.setDomainOption(domainId, key, value);
        await refreshAfter();
        const label = key === "forceHttps" ? "Force HTTPS" : key === "redirectWww" ? "www redirect" : "HSTS";
        toast({ type: "success", title: `${label} ${value ? "enabled" : "disabled"}`, sub: "Edge configuration updated for this hostname." });
        return { ok: true };
      } catch (e) {
        const err = e as { message: string };
        toast({ type: "warn", title: "Setting not changed", sub: err.message });
        return { ok: false, error: err.message };
      }
    },
    verifyRecord: async (siteId, domainId) => {
      try {
        await API.verifyDomainRecord(siteId, domainId);
        await refreshAfter();
        toast({ type: "success", title: "DNS verified", sub: "Certificate provisioning started automatically." });
        return { ok: true };
      } catch (e) {
        const err = e as { message: string };
        await refreshAfter();
        toast({ type: "error", title: "Verification failed", sub: err.message });
        return { ok: false, error: err.message };
      }
    },
    provisionRecord: async (siteId, domainId) => {
      try {
        await API.provisionSslRecord(siteId, domainId);
        await refreshAfter();
        toast({ type: "success", title: "TLS certificate active", sub: "HTTPS enforced; HSTS applied to this hostname." });
        return { ok: true };
      } catch (e) {
        const err = e as { message: string };
        toast({ type: "error", title: "Certificate failed", sub: err.message });
        return { ok: false, error: err.message };
      }
    },
    rollback: async (version) => {
      await refreshAfter();
      toast({ type: "success", title: `Rolled back to ${version}`, sub: "Previous release restored." });
    },
    resolveIssue: (id) => {
      API.resolveIssue(id);
      void refreshAfter();
    },
    dismissBanner: () => {
      API.dismissBanner();
      void refreshAfter();
    },
    markAllRead: () => {
      API.markAllRead();
      void refreshAfter();
    },
    markRead: (id) => {
      API.readNotification(id);
      void refreshAfter();
    }
  }), [refreshAfter, toast]);

  const applyForcedState = useCallback((s: DemoState) => {
    setDemo(s);
    /* empty / default change the payload shape, so the view must refetch —
       otherwise the previous (full) numbers stay on screen until something else reloads */
    if (s === "empty" || s === "default") window.setTimeout(() => { void load(); }, 40);
    if (s === "denied") setRole("Viewer");
    if (s === "default") setRole("Owner");
    if (s === "conflict") setModal({ kind: "conflict" });
    /* the prototype's conflict state also makes the pages API reject a stale save,
       so the editor's Reload/Keep-mine path is reachable without two browsers */
    API.mode.conflict = s === "conflict";
    if (s === "error") setError(
      screen === "sites" ? "Sites and domains service unavailable (503)"
        : screen === "pages" ? "Pages service unavailable (503)"
          : "Analytics service unavailable (502)");
    if (s !== "error") setError(null);
    if (s === "loading") {
      setLoading(true);
      window.setTimeout(() => setLoading(false), 1800);
    }
    const label: Record<DemoState, string> = {
      default: "Default state restored", loading: "Loading state", empty: "Empty state", error: "Error state",
      conflict: "Publish conflict", denied: "Viewer role (permission denied)"
    };
    toast({ type: s === "default" ? "info" : "warn", title: label[s] });
  }, [toast, load]);

  const value = useMemo<Store>(() => ({
    screen,
    go: (next) => { setScreen(next); setDrawer({ kind: "none" }); },
    siteId,
    setSite: (id) => setSiteId(id),
    days,
    setDays,
    rangeEnd,
    rangeName,
    setRange: useCallback((d: number, endOffset: number, name?: string) => {
      setDaysRaw(d);
      setRangeEnd(endOffset);
      setRangeName(name ?? rangeLabel(d));
    }, []),
    gran,
    setGran,
    visible,
    toggleSeries,
    sort,
    setSort,
    data,
    loading,
    refreshing,
    error,
    reload: () => void load(),
    applyForcedState,
    demo,
    role,
    can,
    modal,
    openModal: setModal,
    closeModal: () => setModal({ kind: "none" }),
    drawer,
    openDrawer: setDrawer,
    closeDrawer: () => setDrawer({ kind: "none" }),
    palette,
    setPalette,
    toasts,
    toast,
    dismissToast,
    scrolledTo: (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    ...api
  }), [screen, siteId, days, gran, visible, sort, data, loading, refreshing, error, load, applyForcedState, demo, role, can, modal, drawer, palette, toasts, toast, dismissToast, api, setDays, setGran, toggleSeries, rangeEnd, rangeName]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Derived dashboard metrics — the memoized selector the cards read. */
export function useDash() {
  const { data, sort, siteId, days } = useApp();
  return useMemo(() => {
    if (!data) return null;
    const pages = [...data.pages].sort((a, b) => {
      const av = sort.key === "conv" ? a.conv : a[sort.key];
      const bv = sort.key === "conv" ? b.conv : b[sort.key];
      return sort.dir === "desc" ? bv - av : av - bv;
    });
    const scope = siteId === "all" ? "All websites" : data.sites.find((s) => s.id === siteId)?.name ?? "Website";
    return { ...data, pages, scope, days };
  }, [data, sort, siteId, days]);
}
