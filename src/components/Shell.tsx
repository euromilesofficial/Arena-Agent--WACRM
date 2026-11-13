/* ============================================================
   App shell — sidebar, top bar, command palette, status bar
   ============================================================ */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Btn, Field, MenuItem, MenuLabel, Modal, Pill, Popover, Switch, Toasts } from "./ui";
import { useApp, type DemoState } from "@/lib/store";
import { NAV_CRM, NAV_CMS, CMS_FLAT, EXTRA_NAV, findNav } from "@/lib/nav";
import { downloadCSV, fmtInt } from "@/lib/format";
import { DEMO_CLOCK } from "@/lib/data";

const STATES: [DemoState, string][] = [
  ["default", "Default"],
  ["loading", "Loading skeletons"],
  ["empty", "Empty (no data in range)"],
  ["error", "Error / service down"],
  ["conflict", "Publish conflict"],
  ["denied", "Permission denied (Viewer)"]
];

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<null | "ws" | "bell" | "profile" | "states" | "help" | "quick" | "fresh">(null);
  const quickRef = useRef<HTMLButtonElement>(null);
  const freshRef = useRef<HTMLButtonElement>(null);
  const [notifTab, setNotifTab] = useState<"all" | "unread">("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [expSections, setExpSections] = useState({ kpis: true, series: true, pages: false, channels: false });
  const [expScope, setExpScope] = useState<"current" | "all">("current");
  const [expFormat, setExpFormat] = useState<"csv" | "json">("csv");
  const [pressed, setPressed] = useState<HTMLElement | null>(null);
  const wsRef = useRef<HTMLButtonElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  const data = app.data;
  const unread = data ? data.notifications.filter((n) => n.unread).length : 3;
  const current = findNav(app.screen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPalette(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [app]);

  const openMenu = (which: "ws" | "bell" | "profile" | "states" | "help" | "quick" | "fresh", el: HTMLElement | null) => {
    setMenu((m) => (m === which ? null : which));
    setPressed(el);
  };

  const go = (screen: string) => {
    app.go(screen);
    setMobileOpen(false);
  };

  const exportRows = (): (string | number)[][] => {
    const d = app.data;
    if (!d) return [];
    const scopeName = expScope === "all" ? "All websites" : d.sites.find((s) => s.id === app.siteId)?.name ?? d.sites[0]?.name ?? "";
    const out: (string | number)[][] = [];
    if (expSections.kpis) {
      out.push(["Metric", "Value"]);
      out.push(["Scope", scopeName], ["Range", d.range.label]);
      out.push(["Websites", d.totals.sites], ["Visitors", d.totals.visitors], ["Leads", d.totals.leads]);
      out.push(["Lead rate %", d.totals.leadRate.toFixed(2)], ["Bookings", d.totals.bookings], ["LCP (s)", d.totals.lcp.toFixed(1)]);
      out.push([]);
    }
    if (expSections.series) {
      out.push(["Date", "Visitors", "Leads"]);
      out.push(...d.series.map((p) => [p.iso, p.visitors, p.leads] as (string | number)[]));
      out.push([]);
    }
    if (expSections.pages) {
      out.push(["Page", "Site", "Views", "Leads", "Conversion %"]);
      out.push(...d.pages.map((p) => [p.title, p.siteName, p.views, p.leads, p.conv.toFixed(2)] as (string | number)[]));
      out.push([]);
    }
    if (expSections.channels) {
      out.push(["Channel", "Share %", "Visitors"]);
      out.push(...d.acquisition.map((a) => [a.name, a.pct, a.visitors] as (string | number)[]));
    }
    return out.filter((r, i, arr) => r.length > 0 || (i > 0 && i < arr.length - 1));
  };

  const downloadBlob = (name: string, text: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const runExport = () => {
    const d = app.data;
    if (!d) return;
    const rows = exportRows();
    const stamp = `${d.range.days}d`;
    if (expFormat === "csv") {
      downloadCSV(`wacrm-cms-report-${stamp}.csv`, rows);
    } else {
      downloadBlob(`wacrm-cms-report-${stamp}.json`, JSON.stringify(
        Object.fromEntries(rows.filter((r) => r.length) as [string, ...unknown[]][]), null, 2), "application/json");
    }
    setExportOpen(false);
    app.toast({ type: "success", title: "Report exported", sub: `${rows.length} rows · ${expFormat.toUpperCase()}` });
  };

  const exportReport = () => setExportOpen(true);

  return (
    <>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`} aria-label="Primary">
        <div className="brand">
          <div className="brand-mark"><Icon name="sitemap" size={17} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-word">WACRM</div>
            <div className="brand-sub">Website CMS</div>
          </div>
          <button className={`brand-collapse ${collapsed ? "flip" : ""}`} aria-label="Collapse sidebar" onClick={() => setCollapsed((c) => !c)}>
            <Icon name="chevLeft" size={15} />
          </button>
        </div>

        <button className="ws-card" ref={wsRef} aria-haspopup="menu" onClick={() => openMenu("ws", wsRef.current)}
          data-tip="Switch workspace" title="Switch workspace">
          <div className="ws-logo">{data?.org.initials ?? "EU"}</div>
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div className="ws-name truncate">{data?.org.name ?? "euromilesofficial's Workspace"}</div>
            <div className="ws-meta truncate">{data?.org.legal ?? "EuroMiles Consultancy Pvt. Ltd."}</div>
          </div>
          <span className="ws-chev"><Icon name="chevDown" size={13} /></span>
        </button>

        <nav className="nav">
          {NAV_CRM.map((n) => (
            <button key={n.id} className="nav-item" data-tip={n.label} title={n.label}
              onClick={() => app.toast({ type: "info", title: `${n.label} lives in the CRM product`, sub: "This prototype covers the Website CMS module set." })}>
              <span className="ico"><Icon name={n.icon} size={15} /></span>
              <span className="nav-txt">{n.label}</span>
              {n.badge ? <span className="nav-badge">{n.badge}</span> : n.chev ? <span className="nav-badge" style={{ background: "none", border: 0, color: "#5E6975" }}><Icon name="chevRight" size={12} /></span> : null}
            </button>
          ))}

          <div className="nav-group">
            <button className="nav-module" onClick={() => go("overview")} data-tip="Website CMS" title="Website CMS"
              aria-expanded="true">
              <span className="ico"><Icon name="globe" size={15} /></span>
              <span className="nav-txt">Website CMS</span>
              <span className="nav-mod-chev"><Icon name="chevDown" size={12} /></span>
            </button>
            <div className="nav-tree">
              {CMS_FLAT.map((it) => (
                <button key={it.id} className={`nav-item nav-child ${app.screen === it.id ? "active" : ""}`}
                  aria-current={app.screen === it.id ? "page" : undefined}
                  data-tip={it.label} title={it.label} onClick={() => go(it.id)}>
                  <span className="ico"><Icon name={it.icon} size={13} /></span>
                  <span className="nav-txt">{it.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="sidebar-foot">
          {EXTRA_NAV.map((n) => (
            <button key={n.id} className="nav-item" data-tip={n.label} style={{ marginBottom: 2 }}
              aria-current={app.screen === n.id ? "page" : undefined} onClick={() => go(n.id)}>
              <span className="ico"><Icon name={n.icon} size={15} /></span>
              <span className="nav-txt">{n.label}</span>
              <span className="nav-badge" style={{ background: "none", border: 0, color: "#5E6975" }}><Icon name="chevRight" size={12} /></span>
            </button>
          ))}
          <button className="quick-create" ref={quickRef}
            aria-haspopup="menu" aria-expanded={menu === "quick"}
            data-tip="Create something new" title="Create something new"
            onClick={() => openMenu("quick", quickRef.current)}>
            <span style={{ display: "grid", placeItems: "center" }}><Icon name="plus" size={15} /></span>
            <span className="label">Quick Create</span>
            <span className="kbd">⌘K</span>
          </button>
        </div>
      </aside>

      <div className="shell">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen((o) => !o)}>
            <Icon name="menu" size={16} />
          </button>
          <nav className="crumbs" aria-label="Breadcrumb">
            <button className="home" aria-label="Website CMS home" onClick={() => go("overview")}><Icon name="home" size={15} /></button>
            <span className="sep"><Icon name="chevRight" size={11} /></span>
            <button className="crumb-link" onClick={() => go("overview")}>Website CMS</button>
            <span className="sep"><Icon name="chevRight" size={11} /></span>
            <span className="current">{current?.label ?? "Overview"}</span>
          </nav>

          <button className="search-trigger" style={{ marginLeft: "auto" }} aria-label="Search — Command K" onClick={() => app.setPalette(true)}>
            <Icon name="search" size={14} />
            <span className="st-label">Search WACRM…</span>
            <span className="kbd on-light">⌘K</span>
          </button>

          <div className="top-actions">
            <button className="icon-btn" ref={stateRef} aria-label="Prototype states" data-tip="Prototype states" title="Prototype states" onClick={() => openMenu("states", stateRef.current)}>
              <Icon name="beaker" size={16} />
            </button>
            <button className="icon-btn" ref={helpRef} aria-label="Help and documentation" onClick={() => openMenu("help", helpRef.current)}>
              <Icon name="help" size={16} />
            </button>
            <button className="icon-btn" ref={bellRef} aria-label="Notifications" onClick={() => openMenu("bell", bellRef.current)}>
              <Icon name="bell" size={16} />
              {unread > 0 && <span className="dot">{unread}</span>}
            </button>
            <button className="avatar-btn" ref={profileRef} aria-label="Account menu" onClick={() => openMenu("profile", profileRef.current)}>
              <span className="avatar">{data?.user.initials ?? "AM"}</span>
              <Icon name="chevDown" size={12} />
            </button>
          </div>
        </header>

        <main className="main">{children}</main>

        <footer className="statusbar">
          {app.screen === "sites" ? (
            <>
              <span className="sb-item"><i className="live-dot" /> <span><b style={{ fontWeight: 650 }}>WACRM CMS</b> · Last synced {app.refreshing ? "now" : "2 min ago"}</span></span>
              <span className="grow" />
              <button className="sb-item" onClick={() => app.toast({ type: "info", title: "Opening docs", sub: "docs.wacrm.io/website-cms" })}><Icon name="book" size={12} /> Docs</button>
              <span className="sb-div" />
              <button className="sb-item" onClick={() => app.toast({ type: "success", title: "Support chat started", sub: "An agent will join shortly." })}><Icon name="lifebuoy" size={12} /> Support</button>
              <span className="sb-div" />
              <button className="sb-item" onClick={() => app.toast({ type: "success", title: "All systems operational", sub: "DNS, TLS and publishing are healthy." })}><Icon name="activity" size={12} /> Status <i className="live-dot" /></button>
              <span className="sb-div" />
              <button className="sb-item" onClick={() => app.toast({ type: "info", title: "Privacy notice", sub: "How workspace data is stored and retained." })}><Icon name="shield" size={12} /> Privacy</button>
            </>
          ) : (
            <>
          <span className="sb-item"><Icon name="info" size={12} /> <span>Data: <b style={{ fontWeight: 600 }}>{app.siteId === "all" ? "All websites" : data?.sites.find((s) => s.id === app.siteId)?.name ?? "Website"}</b></span></span>
          <span className="sb-div" />
          <button className="sb-item sb-hide-sm" ref={freshRef}
            aria-haspopup="dialog" aria-expanded={menu === "fresh"} title="Data freshness by source"
            onClick={() => openMenu("fresh", freshRef.current)}>
            Last updated: <b style={{ fontWeight: 650, marginLeft: 3 }}>{app.refreshing ? "syncing…" : `${DEMO_CLOCK.date} at ${DEMO_CLOCK.time}`}</b>
            <Icon name="info" size={11} />
          </button>
          <span className="sb-item"><i className="live-dot" /><Icon name="check" size={10} /><span>Live</span></span>
          <span className="grow" />
          <button className="sb-item" onClick={() => app.toast({ type: "info", title: "Opening docs", sub: "docs.wacrm.io/website-cms" })}><Icon name="book" size={12} /> Docs</button>
          <span className="sb-div" />
          <button className="sb-item" onClick={() => app.toast({ type: "success", title: "Support chat started", sub: "An agent will join shortly." })}><Icon name="lifebuoy" size={12} /> Support</button>
          <span className="sb-div" />
          <button className="sb-item" onClick={exportReport}><Icon name="download" size={12} /> <span className="sb-hide-xs">Export Report</span></button>
            </>
          )}
        </footer>
      </div>

      {/* ---------- popovers ---------- */}
      <Popover anchor={pressed} open={menu === "ws"} onClose={() => setMenu(null)} align="left" className="w-260">
        <MenuLabel>Workspaces</MenuLabel>
        {(data?.org.orgs ?? []).map((o) => (
          <MenuItem key={o.id} icon="blocks" selected={o.current} meta={`${o.sites} sites`}
            onClick={() => { setMenu(null); app.toast({ type: "info", title: `Switched to ${o.name}`, sub: "Tenant-scoped data reloaded." }); }}>
            {o.name}
          </MenuItem>
        ))}
        <div className="menu-div" />
        <MenuItem icon="settings" onClick={() => { setMenu(null); go("settings"); }}>Workspace settings</MenuItem>
        <MenuItem icon="users" onClick={() => { setMenu(null); app.toast({ type: "info", title: "Members", sub: "Invite teammates from Workspace settings." }); }}>Members &amp; roles</MenuItem>
      </Popover>

      <Popover anchor={pressed} open={menu === "bell"} onClose={() => setMenu(null)} className="w-340">
        <div className="pop-head">
          <span>Notifications</span>
          <button className="link" onClick={() => { app.markAllRead(); app.toast({ type: "info", title: "All notifications marked read" }); }}>Mark all read</button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 2px 6px" }}>
          {(["all", "unread"] as const).map((t) => (
            <button key={t} className="chip-btn" aria-pressed={notifTab === t}
              onClick={() => setNotifTab(t)}
              style={notifTab === t ? undefined : { background: "transparent", color: "var(--muted)", boxShadow: "none" }}>
              {t === "all" ? "All" : `Unread (${unread})`}
            </button>
          ))}
        </div>
        {(data?.notifications ?? []).filter((n) => notifTab === "all" || n.unread).map((n) => (
          <button key={n.id} className={`notif ${n.unread ? "unread" : ""}`} onClick={() => { setMenu(null); if (n.unread) app.markRead(n.id); app.toast({ type: "info", title: n.title, sub: n.body }); }}>
            <span className={`notif-ico ${n.kind}`}><Icon name={n.kind === "warn" ? "alert" : n.kind === "ok" ? "check" : "info"} size={12} /></span>
            <span style={{ minWidth: 0 }}>
              <span className="notif-title">{n.title}</span>
              <span className="notif-body">{n.body}</span>
              <span className="notif-time">{n.time}</span>
            </span>
          </button>
        ))}
        {(data?.notifications ?? []).filter((n) => notifTab === "all" || n.unread).length === 0 && (
          <div className="f11 muted" style={{ padding: "14px 8px", textAlign: "center" }}>You’re all caught up.</div>
        )}
        <div className="menu-sep" />
        <MenuItem icon="bell" onClick={() => { setMenu(null); app.openDrawer({ kind: "issues" }); }}>View all notifications</MenuItem>
      </Popover>

      <Popover anchor={pressed} open={menu === "profile"} onClose={() => setMenu(null)} className="w-240">
        <div className="pop-head" style={{ paddingBottom: 8 }}>
          <div>
            <div className="w700 f12">{data?.user.name ?? "Aarav Mehta"}</div>
            <div className="f11 muted">{data?.user.email ?? "aarav@euromiles.in"}</div>
          </div>
        </div>
        <div className="menu-div" />
        <MenuItem icon="shield" meta={app.role} onClick={() => { setMenu(null); app.toast({ type: "info", title: "Role", sub: `${app.role} — switch roles from the prototype menu.` }); }}>Your role</MenuItem>
        <MenuItem icon="settings" onClick={() => { setMenu(null); go("settings"); }}>Account settings</MenuItem>
        <MenuItem icon="key" onClick={() => { setMenu(null); app.toast({ type: "info", title: "Sessions", sub: "2 active sessions · step-up auth on destructive actions." }); }}>Security</MenuItem>
        <div className="menu-div" />
        <MenuItem icon="x" danger onClick={() => { setMenu(null); app.toast({ type: "info", title: "Signed out (demo)", sub: "Reload to restore the seeded session." }); }}>Sign out</MenuItem>
      </Popover>

      <Popover anchor={pressed} open={menu === "states"} onClose={() => setMenu(null)} align="left" className="w-280">
        <MenuLabel>Prototype states</MenuLabel>
        {STATES.map(([id, label]) => (
          <MenuItem key={id} selected={app.demo === id} onClick={() => { setMenu(null); app.applyForcedState(id); }}>{label}</MenuItem>
        ))}
      </Popover>

      <Popover anchor={pressed} open={menu === "help"} onClose={() => setMenu(null)} className="w-260">
        <MenuLabel>Help</MenuLabel>
        <MenuItem icon="book" onClick={() => { setMenu(null); app.toast({ type: "info", title: "Opening docs", sub: "docs.wacrm.io/website-cms" }); }}>Documentation</MenuItem>
        <MenuItem icon="play" onClick={() => { setMenu(null); app.toast({ type: "info", title: "Video tutorials", sub: "6 short walkthroughs · opens in a new tab." }); }}>Video tutorials</MenuItem>
        <MenuItem icon="sparkles" onClick={() => { setMenu(null); app.toast({ type: "info", title: "Product updates", sub: "v2.4 — module 1 dashboard, compare-and-swap publishing." }); }}>Product updates</MenuItem>
        <div className="menu-sep" />
        <MenuItem icon="lifebuoy" onClick={() => { setMenu(null); app.toast({ type: "success", title: "Support chat started" }); }}>Chat with support</MenuItem>
        <MenuItem icon="alert" onClick={() => { setMenu(null); app.toast({ type: "warn", title: "Report an issue", sub: "Screenshot and console log attached automatically." }); }}>Report an issue</MenuItem>
        <MenuItem icon="key" onClick={() => { setMenu(null); app.setPalette(true); }}>Keyboard shortcuts</MenuItem>
      </Popover>


      {/* ---------- quick create ---------- */}
      <Popover anchor={pressed} open={menu === "quick"} onClose={() => setMenu(null)} align="left" className="w-260">
        <MenuLabel>Create new</MenuLabel>
        <MenuItem icon="globe" onClick={() => { setMenu(null); app.openModal({ kind: "wizard" }); }}>New website</MenuItem>
        <MenuItem icon="file" onClick={() => { setMenu(null); app.go("pages"); app.toast({ type: "info", title: "New page", sub: "Page composer arrives with Module 3." }); }}>New page</MenuItem>
        <MenuItem icon="form" onClick={() => { setMenu(null); app.go("forms"); app.toast({ type: "info", title: "New form", sub: "Form builder arrives with Module 10." }); }}>New form</MenuItem>
        <MenuItem icon="menu" onClick={() => { setMenu(null); app.go("menus"); app.toast({ type: "info", title: "New menu", sub: "Navigation editor arrives with Module 8." }); }}>New menu</MenuItem>
        <MenuItem icon="image" onClick={() => { setMenu(null); app.go("media"); app.toast({ type: "info", title: "Upload media", sub: "Media library arrives with Module 9." }); }}>Upload media</MenuItem>
        <div className="menu-sep" />
        <MenuItem icon="search" meta="⌘K" onClick={() => { setMenu(null); app.setPalette(true); }}>Search everything</MenuItem>
      </Popover>

      {/* ---------- data freshness ---------- */}
      <Popover anchor={pressed} open={menu === "fresh"} onClose={() => setMenu(null)} className="w-300" role="dialog">
        <MenuLabel>Data freshness</MenuLabel>
        <div style={{ padding: "2px 6px 6px" }}>
          {([
            ["Analytics", app.error ? "Unavailable" : app.refreshing ? "Syncing…" : "Current", app.error ? "red" : app.refreshing ? "amber" : "green"],
            ["Publishing state", "Current", "green"],
            ["Core Web Vitals", "26 min ago · within SLA", "amber"],
            ["Search index", "Current", "green"]
          ] as [string, string, "green" | "amber" | "red"][]).map(([name, state, tone]) => (
            <div key={name} className="dr-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px" }}>
              <span className="f12 grow">{name}</span>
              <Pill tone={tone}>{state}</Pill>
            </div>
          ))}
          <div className="f11 muted mt6">Cached responses are served for up to 30 s; a source older than 15 min is marked stale instead of failing.</div>
        </div>
      </Popover>

      {/* ---------- export ---------- */}
      {exportOpen && (
        <Modal title="Export report" sub="Choose what to include, then download." icon="download" width="narrow" onClose={() => setExportOpen(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Btn>
            <span className="grow" />
            <Btn variant="primary" icon="download" onClick={runExport}>Export {expFormat.toUpperCase()}</Btn>
          </>}>
          <Field label="Scope">
            <div style={{ display: "flex", gap: 6 }}>
              <button className="chip-btn" aria-pressed={expScope === "current"} onClick={() => setExpScope("current")}>
                {app.siteId === "all" ? "All websites" : app.data?.sites.find((s) => s.id === app.siteId)?.name ?? "This website"}
              </button>
              <button className="chip-btn" aria-pressed={expScope === "all"} onClick={() => setExpScope("all")}>Every website</button>
            </div>
          </Field>
          <Field label="Include">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
              <Switch checked={expSections.kpis} onChange={(v) => setExpSections((x) => ({ ...x, kpis: v }))} label="KPI summary" />
              <Switch checked={expSections.series} onChange={(v) => setExpSections((x) => ({ ...x, series: v }))} label="Traffic & leads by day" />
              <Switch checked={expSections.pages} onChange={(v) => setExpSections((x) => ({ ...x, pages: v }))} label="Top landing pages" />
              <Switch checked={expSections.channels} onChange={(v) => setExpSections((x) => ({ ...x, channels: v }))} label="Acquisition channels" />
            </div>
          </Field>
          <Field label="Format">
            <div style={{ display: "flex", gap: 6 }}>
              <button className="chip-btn" aria-pressed={expFormat === "csv"} onClick={() => setExpFormat("csv")}>CSV</button>
              <button className="chip-btn" aria-pressed={expFormat === "json"} onClick={() => setExpFormat("json")}>JSON</button>
            </div>
          </Field>
          <p className="dr-p mt10">{app.data?.range.label ?? "Last 30 days"} · timezone Asia/Kolkata · every number matches the dashboard exactly.</p>
        </Modal>
      )}

      <CommandPalette onExport={() => setExportOpen(true)} />
      <Toasts items={app.toasts} onDismiss={app.dismissToast} />
    </>
  );
}

/* ---------------- command palette ---------------- */
function CommandPalette({ onExport }: { onExport: () => void }) {
  const app = useApp();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (app.palette) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [app.palette]);

  const d = app.data;
  const items: { group: string; label: string; icon: string; run: () => void; meta?: string }[] = [
    ...NAV_CMS.flatMap((g) => g.items.map((i) => ({
      group: "Navigate", label: i.label, icon: i.icon, meta: g.group, run: () => app.go(i.id)
    }))),
    { group: "Actions", label: "New website", icon: "plus", run: () => app.openModal({ kind: "wizard" }) },
    { group: "Actions", label: "Publish a release", icon: "upload", run: () => app.openModal({ kind: "preflight" }) },
    { group: "Actions", label: "Run DNS verification", icon: "refresh", run: () => d && app.verifyDomain(d.sites.find((s) => s.dns === "pending")?.id ?? d.sites[0].id) },
    { group: "Actions", label: "Export report", icon: "download", run: onExport },
    ...(d?.pages ?? []).map((p) => ({ group: "Pages", label: p.title, icon: "file", meta: p.slug, run: () => app.openDrawer({ kind: "page", id: p.id }) })),
    ...(d?.notifications ?? []).map((n) => ({ group: "Issues", label: n.title, icon: n.kind === "warn" ? "alert" : "bell", meta: n.time, run: () => app.openDrawer({ kind: "health", which: "health-details" }) }))
  ];
  const filtered = q.trim()
    ? items.filter((i) => `${i.label} ${i.group} ${i.meta ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : items.filter((i) => i.group === "Navigate" || i.group === "Actions");
  const shown = filtered.slice(0, 12);

  if (!app.palette) return null;
  const close = () => app.setPalette(false);
  const runItem = (i: number) => {
    const it = shown[i];
    if (!it) return;
    close();
    window.setTimeout(it.run, 80);
  };

  return (
    <div className="cmdk-layer" onClick={close}>
      <div className="cmdk" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Icon name="search" size={15} />
          <input className="cmdk-input" ref={inputRef} value={q} placeholder="Search pages, actions, modules…" aria-label="Command palette"
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(shown.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") { e.preventDefault(); runItem(idx); }
              if (e.key === "Escape") close();
            }} />
          <span className="kbd on-light">ESC</span>
        </div>
        <div className="cmdk-list">
          {shown.length === 0 && <div className="cmdk-empty">No matches for “{q}”</div>}
          {shown.map((it, i) => {
            const showGroup = i === 0 || shown[i - 1].group !== it.group;
            return (
              <div key={`${it.group}-${it.label}-${i}`}>
                {showGroup && <div className="cmdk-group-label">{it.group}</div>}
                <button className={`cmdk-item ${i === idx ? "active" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => runItem(i)}>
                  <span className="ci-ico"><Icon name={it.icon} size={13} /></span>
                  <span className="ci-title grow">{it.label}</span>
                  {it.meta && <span className="ci-type">{it.meta}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <span className="hint"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="hint"><span className="kbd">↵</span> open</span>
          <span style={{ marginLeft: "auto" }}><Pill tone="violet">{fmtInt(shown.length)} results</Pill></span>
          <Btn variant="ghost" onClick={close} style={{ height: 24 }}>Close</Btn>
        </div>
      </div>
    </div>
  );
}
