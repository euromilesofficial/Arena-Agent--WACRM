import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { Icon } from "../components/Icon";
import { Btn, EmptyState, MenuItem, MenuLabel, Pill, Popover, Skel } from "../components/ui";
import { THUMB_IMG } from "../lib/thumbs";
import { DOMAIN_TRENDS, type Site } from "../lib/data";
import { DomainDetails, DNS_LABEL, SSL_LABEL, siteAliases, sitePrimary, type DetailsTab } from "../components/sites/DomainDetails";

/* ------------------------------------------------------------------ types */

type Tab = "all" | "live" | "draft" | "attention";
type SortKey = "name" | "domain" | "dns" | "ssl" | "release" | "pages" | "leads" | "updated";

const RANK = { failed: 0, pending: 1, provisioning: 1, expiring: 2, verified: 3, active: 3 } as Record<string, number>;

/* ------------------------------------------------------------- small bits */

function Spark({ data, tone }: { data: number[]; tone: "green" | "red" }) {
  const w = 74, h = 26;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [i * (w / (data.length - 1)), h - 2 - ((v - min) / span) * (h - 5)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const c = tone === "green" ? "#16B364" : "#E5484D";
  return (
    <svg className="d2-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={area} fill={c} opacity=".08" />
      <path d={line} fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({ icon, tone, value, label, delta, dir, series }: {
  icon: string; tone: "green" | "red" | "violet"; value: string; label: string;
  delta: string; dir: "up" | "down"; series: number[];
}) {
  return (
    <div className="d2-kpi">
      <span className={`d2-kpi-ico ${tone}`}><Icon name={icon} size={15} /></span>
      <span className="d2-kpi-body">
        <b className="d2-kpi-value">{value}</b>
        <span className="d2-kpi-label">{label}</span>
        <span className={`d2-kpi-delta ${dir}`}><Icon name={dir === "up" ? "arrowUpRight" : "arrowRight"} size={9} /> {delta}</span>
      </span>
      <Spark data={series} tone={tone === "red" ? "red" : "green"} />
    </div>
  );
}

function SortHead({ label, k, cls, sort, onSort }: { label: string; k: SortKey; cls?: string; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  return (
    <th className={`d2-th ${cls ?? ""} ${active ? "sorted " + sort.dir : ""}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className="d2-th-btn" onClick={() => onSort(k)}>
        {label}
        <Icon name="chevDown" size={9} className="d2-sort-ico" />
      </button>
    </th>
  );
}

/* ------------------------------------------------------------------- page */

export function Sites() {
  const app = useApp();
  const data = app.data;

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | "verified" | "pending" | "failed">("all");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [inspTab, setInspTab] = useState<DetailsTab>("overview");
  const [siteOpen, setSiteOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width:1200px)").matches);

  const siteBtn = useRef<HTMLButtonElement | null>(null);
  const domainBtn = useRef<HTMLButtonElement | null>(null);
  const menuBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width:1200px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const loading = app.loading;
  const error = app.error && !/analytics/i.test(app.error) ? app.error : null;
  const denied = app.role === "Viewer";

  const demoEmpty = app.demo === "empty";
  const sites = useMemo(() => (demoEmpty ? [] : (data?.sites ?? []).filter((s) => !s.archived)), [data, demoEmpty]);
  const domains = useMemo(() => (demoEmpty ? [] : data?.domains ?? []), [data, demoEmpty]);

  const scopedSites = useMemo(() => (scope === "all" ? sites : sites.filter((s) => s.id === scope)), [sites, scope]);
  const scopedDomains = useMemo(() => (scope === "all" ? domains : domains.filter((d) => d.siteId === scope)), [domains, scope]);

  const attention = useMemo(() => scopedDomains.filter((d) => d.dns !== "verified" || d.ssl !== "active"), [scopedDomains]);
  const counts = useMemo(() => ({
    all: scopedSites.length,
    live: scopedSites.filter((s) => s.status === "published").length,
    draft: scopedSites.filter((s) => s.status === "draft").length,
    attention: scopedSites.filter((s) => {
      const d = sitePrimary(scopedDomains, s.id);
      return !!d && (d.dns !== "verified" || d.ssl !== "active");
    }).length
  }), [scopedSites, scopedDomains]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = scopedSites.filter((s) => {
      const primary = sitePrimary(scopedDomains, s.id);
      if (tab === "live" && s.status !== "published") return false;
      if (tab === "draft" && s.status !== "draft") return false;
      if (tab === "attention" && (!primary || (primary.dns === "verified" && primary.ssl === "active"))) return false;
      if (domainFilter !== "all" && primary?.dns !== domainFilter) return false;
      if (!term) return true;
      const hosts = scopedDomains.filter((d) => d.siteId === s.id).map((d) => d.hostname).join(" ");
      return `${s.name} ${s.host} ${s.template} ${hosts}`.toLowerCase().includes(term);
    });
    const val = (s: Site) => {
      const p = sitePrimary(scopedDomains, s.id);
      switch (sort.key) {
        case "domain": return (p?.hostname ?? "").toLowerCase();
        case "dns": return RANK[p?.dns ?? "pending"] ?? 0;
        case "ssl": return RANK[p?.ssl ?? "provisioning"] ?? 0;
        case "release": return s.release ?? "";
        case "pages": return s.pages;
        case "leads": return s.leads;
        case "updated": return s.releasedAt === "Never published" ? 0 : 1;
        default: return s.name.toLowerCase();
      }
    };
    list = [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? r : -r;
    });
    return list;
  }, [scopedSites, scopedDomains, tab, q, domainFilter, sort]);

  const activeSiteId = selected && sites.some((s) => s.id === selected) ? selected : attention[0]?.siteId ?? sites[0]?.id ?? null;

  const selectSite = (id: string) => {
    if (id !== selected) setInspTab("overview");
    setSelected(id);
    setChecked((c) => (c.length > 1 && c.includes(id) ? c : [id]));
    if (!wide) app.openDrawer({ kind: "site", id });
  };

  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));

  const copy = (text: string, label: string) => {
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).catch(() => {});
    app.toast({ type: "success", title: `${label} copied`, sub: text });
  };

  const hostOf = (id: string) => sitePrimary(scopedDomains, id)?.hostname ?? sites.find((s) => s.id === id)?.host ?? id;

  /* ------------------------------------------------------------ menu body */
  const menuSite = sites.find((s) => s.id === menuFor) ?? null;
  const menuPrimary = menuSite ? sitePrimary(domains, menuSite.id) : undefined;

  return (
    <>
      <div className="page-head d2-head">
        <div>
          <h1 className="page-title">Sites &amp; Domains</h1>
          <p className="page-sub">Manage websites, primary domains, DNS verification, SSL lifecycle, and live release routing across your workspace.</p>
        </div>
        <div className="toolbar">
          <button className="select-btn" ref={siteBtn} aria-haspopup="menu" aria-expanded={siteOpen} onClick={() => setSiteOpen((o) => !o)}>
            <Icon name="globe" size={13} />
            <span className="val">{scope === "all" ? "All websites" : sites.find((s) => s.id === scope)?.name ?? "All websites"}</span>
            <Icon name="chevDown" size={12} className="chev" />
          </button>
          <button className="select-btn" ref={domainBtn} aria-haspopup="menu" aria-expanded={domainOpen} onClick={() => setDomainOpen((o) => !o)}>
            <Icon name="link" size={13} />
            <span className="val">{domainFilter === "all" ? "All domains" : domainFilter === "verified" ? "Verified" : domainFilter === "pending" ? "Pending" : "Failed"}</span>
            <Icon name="chevDown" size={12} className="chev" />
          </button>
          <Btn icon="link" disabled={!app.can("domain")} onClick={() => app.openModal({ kind: "connect-domain", siteId: activeSiteId ?? undefined })}>Connect Domain</Btn>
          <Btn variant="primary" icon="plus" disabled={!app.can("create")} onClick={() => app.openModal({ kind: "wizard" })}>New Website</Btn>
        </div>
      </div>

      <Popover anchor={siteBtn.current} open={siteOpen} onClose={() => setSiteOpen(false)} className="w-240">
        <MenuLabel>Website scope</MenuLabel>
        <MenuItem icon="globe" selected={scope === "all"} meta={String(sites.length)} onClick={() => { setScope("all"); setSiteOpen(false); }}>All websites</MenuItem>
        {sites.map((s) => (
          <MenuItem key={s.id} icon="layers" selected={scope === s.id} onClick={() => { setScope(s.id); setSiteOpen(false); }}>{s.name}</MenuItem>
        ))}
      </Popover>

      <Popover anchor={domainBtn.current} open={domainOpen} onClose={() => setDomainOpen(false)} className="w-240">
        <MenuLabel>Domain status</MenuLabel>
        {([["all", "All domains"], ["verified", "Verified"], ["pending", "Pending"], ["failed", "Failed"]] as [typeof domainFilter, string][]).map(([id, label]) => (
          <MenuItem key={id} icon={id === "failed" ? "alert" : "server"} selected={domainFilter === id}
            meta={id === "all" ? String(scopedDomains.length) : String(scopedDomains.filter((d) => d.dns === id).length)}
            onClick={() => { setDomainFilter(id); setDomainOpen(false); }}>{label}</MenuItem>
        ))}
      </Popover>

      {attention.length > 0 && (
        <div className="d2-alert" role="status">
          <Icon name="alert" size={13} />
          <span className="grow truncate">
            {attention.length} {attention.length === 1 ? "domain needs" : "domains need"} attention —{" "}
            {sites.find((s) => s.id === attention[0].siteId)?.name}{" "}
            {attention[0].dns !== "verified" ? "DNS" : "SSL"} {attention[0].dns !== "verified" ? DNS_LABEL[attention[0].dns].toLowerCase() : SSL_LABEL[attention[0].ssl].toLowerCase()}
            {" "}({attention[0].hostname})
            {attention.length > 1 && ` and ${attention.length - 1} more`}
          </span>
          <button className="d2-alert-cta" onClick={() => {
            const target = attention[0];
            selectSite(target.siteId);
            app.toast({ type: "info", title: "Reviewing domain", sub: target.hostname });
          }}>Review &amp; Fix <Icon name="arrowRight" size={10} /></button>
        </div>
      )}

      {error && (
        <div className="d2-alert is-error" role="alert">
          <Icon name="alert" size={13} />
          <span className="grow truncate">{error}</span>
          <Btn className="btn-sm" onClick={app.reload}>Retry</Btn>
        </div>
      )}

      {denied && (
        <div className="d2-alert is-viewer" role="status">
          <Icon name="lock" size={13} />
          <span className="grow truncate">You are viewing as <b>Viewer</b> — domains, DNS and certificates are read-only for this role.</span>
        </div>
      )}

      <div className="d2-kpis">
        <Kpi icon="globe" tone="green" value={String(scopedSites.length)} label="Websites" delta="+1 this month" dir="up" series={DOMAIN_TRENDS.websites} />
        <Kpi icon="layers" tone="green" value={String(scopedDomains.length)} label="Connected Domains" delta="+25%" dir="up" series={DOMAIN_TRENDS.domains} />
        <Kpi icon="shield" tone="green" value={`${scopedDomains.filter((d) => d.dns === "verified").length}/${scopedDomains.length}`} label="Verified DNS" delta="+40%" dir="up" series={DOMAIN_TRENDS.dns} />
        <Kpi icon="lock" tone="green" value={String(scopedDomains.filter((d) => d.ssl === "active").length)} label="SSL Active" delta="+50%" dir="up" series={DOMAIN_TRENDS.ssl} />
        <Kpi icon="alert" tone="red" value={String(attention.length)} label="Pending / Failed" delta="−33%" dir="down" series={DOMAIN_TRENDS.pending} />
      </div>

      <div className="d2-grid">
        <div className="d2-col">
          <section className="card d2-registry">
            <div className="d2-reg-head">
              <span className="d2-reg-ico"><Icon name="blocks" size={13} /></span>
              <span className="d2-reg-title">Site Registry</span>
              <span className="grow" />
              <div className="d2-search">
                <Icon name="search" size={13} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search websites or domains…" aria-label="Search websites or domains" />
                {q && <button className="d2-search-x" aria-label="Clear search" onClick={() => setQ("")}><Icon name="x" size={11} /></button>}
              </div>
              <button className="d2-view" aria-label={view === "table" ? "Switch to grid view" : "Switch to table view"}
                title={view === "table" ? "Grid view" : "Table view"} onClick={() => setView((v) => (v === "table" ? "grid" : "table"))}>
                <Icon name={view === "table" ? "columns" : "menu"} size={14} />
              </button>
            </div>

            <div className="d2-tabrow">
              {([["all", "All", counts.all], ["live", "Live", counts.live], ["draft", "Draft", counts.draft], ["attention", "Needs Attention", counts.attention]] as [Tab, string, number][])
                .map(([id, label, n]) => (
                  <button key={id} className={`d2-pill ${tab === id ? "is-on" : ""} ${id === "attention" ? "is-warn" : ""}`}
                    aria-pressed={tab === id} onClick={() => setTab(id)}>
                    {label} <span className="d2-pill-n">{n}</span>
                  </button>
                ))}
              {checked.length > 0 && (
                <span className="d2-bulk">
                  {checked.length} selected
                  <button className="link f11" onClick={() => setChecked([])}>Clear</button>
                </span>
              )}
            </div>

            {loading ? (
              <RegistrySkeleton />
            ) : !sites.length || app.demo === "empty" ? (
              <EmptyState icon="globe" title="No websites yet" desc="Create your first website to connect a domain, verify DNS and issue a certificate."
                action={<Btn variant="primary" icon="plus" onClick={() => app.openModal({ kind: "wizard" })}>Create Your First Website</Btn>} />
            ) : !rows.length ? (
              <div className="d2-norec">
                <Icon name="search" size={16} />
                <div>
                  <div className="w650 f13">No websites match your filters</div>
                  <div className="f12 muted">Try a different search term or reset the filters.</div>
                </div>
                <Btn className="btn-sm" onClick={() => { setQ(""); setTab("all"); setDomainFilter("all"); }}>Clear Filters</Btn>
              </div>
            ) : view === "table" ? (
              <div className="d2-tblwrap">
                <table className="d2-tbl">
                  <thead>
                    <tr>
                      <th className="d2-th d2-th-check">
                        <input type="checkbox" aria-label="Select all on this page"
                          checked={rows.length > 0 && rows.every((r) => checked.includes(r.id))}
                          onChange={(e) => setChecked(e.target.checked ? rows.map((r) => r.id) : [])} />
                      </th>
                      <SortHead label="Website" k="name" cls="d2-c-name" sort={sort} onSort={onSort} />
                      <SortHead label="Primary Domain" k="domain" cls="d2-c-domain" sort={sort} onSort={onSort} />
                      <th className="d2-th d2-c-add">Additional Domains</th>
                      <SortHead label="DNS" k="dns" cls="d2-c-dns" sort={sort} onSort={onSort} />
                      <SortHead label="SSL" k="ssl" cls="d2-c-ssl" sort={sort} onSort={onSort} />
                      <SortHead label="Live Release" k="release" cls="d2-c-rel" sort={sort} onSort={onSort} />
                      <SortHead label="Pages" k="pages" cls="d2-c-pages" sort={sort} onSort={onSort} />
                      <SortHead label="Leads" k="leads" cls="d2-c-leads" sort={sort} onSort={onSort} />
                      <SortHead label="Last Updated" k="updated" cls="d2-c-upd" sort={sort} onSort={onSort} />
                      <th className="d2-th d2-th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => {
                      const primary = sitePrimary(scopedDomains, s.id);
                      const aliases = siteAliases(scopedDomains, s.id);
                      const isActive = s.id === activeSiteId;
                      return (
                        <tr key={s.id} className={`d2-row ${isActive ? "is-active" : ""} ${checked.includes(s.id) ? "is-checked" : ""}`}
                          onClick={() => selectSite(s.id)} tabIndex={0} aria-selected={isActive}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSite(s.id); } }}>
                          <td className="d2-td-check" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Select ${s.name}`} checked={checked.includes(s.id)}
                              onChange={(e) => setChecked((c) => e.target.checked ? [...new Set([...c, s.id])] : c.filter((x) => x !== s.id))} />
                          </td>
                          <td>
                            <div className="d2-site">
                              <span className="d2-thumb"><img src={THUMB_IMG[s.thumb] ?? THUMB_IMG.main} alt="" /></span>
                              <span className="d2-site-txt">
                                <span className="d2-site-name">{s.name}</span>
                                <span className={`d2-life ${s.status === "published" ? "live" : "draft"}`}>{s.status === "published" ? "Live" : "Draft"}</span>
                              </span>
                            </div>
                          </td>
                          <td>
                            {primary ? (
                              <button className="d2-domain" onClick={(e) => { e.stopPropagation(); copy(primary.hostname, "Hostname"); }} title={`Copy ${primary.hostname}`}>
                                <span className="truncate mono">{primary.hostname}</span>
                                <Icon name="external" size={10} />
                              </button>
                            ) : (
                              <button className="d2-domain is-empty" disabled={denied}
                                onClick={(e) => { e.stopPropagation(); app.openModal({ kind: "connect-domain", siteId: s.id }); }}
                                title="Connect a hostname to this website">
                                <span className="truncate">Not connected</span>
                                <Icon name="plus" size={10} />
                              </button>
                            )}
                          </td>
                          <td className="d2-c-add">
                            {aliases.length
                              ? <Pill tone="violet">+{aliases.length} alias</Pill>
                              : <span className="d2-muted">No alias</span>}
                          </td>
                          <td>
                            {primary
                              ? <button className="d2-pillbtn" disabled={denied || verifying === primary.id} title="Re-verify DNS"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVerifying(primary.id);
                                  void app.verifyRecord(s.id, primary.id).then(() => setVerifying(null));
                                }}>
                                {verifying === primary.id
                                  ? <Pill tone="amber" dot className="is-checking">Checking…</Pill>
                                  : <Pill tone={primary.dns === "verified" ? "green" : primary.dns === "failed" ? "red" : "amber"} dot>{DNS_LABEL[primary.dns]}</Pill>}
                              </button>
                              : <span className="d2-muted">—</span>}
                          </td>
                          <td>
                            {primary
                              ? <button className="d2-pillbtn" disabled={denied} title="Certificate details"
                                onClick={(e) => { e.stopPropagation(); selectSite(s.id); setInspTab("ssl"); }}>
                                <Pill tone={primary.ssl === "active" ? "green" : primary.ssl === "failed" ? "red" : "amber"} dot>{SSL_LABEL[primary.ssl]}</Pill>
                              </button>
                              : <span className="d2-muted">—</span>}
                          </td>
                          <td className="d2-c-rel">
                            <span className={`d2-release ${s.release ? "" : "is-draft"}`}>{s.release ?? "Draft"}</span>
                          </td>
                          <td className="d2-num d2-c-pages">{s.pages}</td>
                          <td className="d2-num d2-c-leads">{s.leads}</td>
                          <td className="d2-when" title={s.releasedAt}>{s.releasedAt === "Never published" ? "Not live" : s.releasedAt}</td>
                          <td className="d2-td-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="d2-more" aria-label={`Actions for ${s.name}`} aria-haspopup="menu"
                              onClick={(e) => { menuBtn.current = e.currentTarget; setMenuFor(s.id); }}>
                              <Icon name="more" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="d2-cards">
                {rows.map((s) => {
                  const primary = sitePrimary(scopedDomains, s.id);
                  return (
                    <article key={s.id} className={`d2-card ${s.id === activeSiteId ? "is-active" : ""}`} onClick={() => selectSite(s.id)}>
                      <div className="d2-card-thumb"><img src={THUMB_IMG[s.thumb] ?? THUMB_IMG.main} alt="" /></div>
                      <div className="d2-card-body">
                        <div className="d2-card-top">
                          <b className="truncate">{s.name}</b>
                          <span className={`d2-life ${s.status === "published" ? "live" : "draft"}`}>{s.status === "published" ? "Live" : "Draft"}</span>
                        </div>
                        <div className="d2-card-host mono truncate">{primary?.hostname ?? "Not connected"}</div>
                        <div className="d2-card-pills">
                          {primary ? <Pill tone={primary.dns === "verified" ? "green" : "amber"} dot>{DNS_LABEL[primary.dns]}</Pill> : <Pill tone="grey">No domain</Pill>}
                          {primary && <Pill tone={primary.ssl === "active" ? "green" : "amber"} dot>{SSL_LABEL[primary.ssl]}</Pill>}
                          <span className={`d2-release ${s.release ? "" : "is-draft"}`}>{s.release ?? "Draft"}</span>
                        </div>
                        <div className="d2-card-meta">{s.pages} pages · {s.leads} leads · {s.releasedAt === "Never published" ? "Not live" : s.releasedAt}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="d2-reg-foot">
              <span>Showing {rows.length} of {scopedSites.length} websites</span>
              <span className="d2-dot" />
              <span>{scopedDomains.length} hostnames</span>
              <span className="grow" />
              {app.refreshing ? <span className="d2-syncing"><Skel style={{ width: 10, height: 10, borderRadius: 5 }} /> syncing…</span>
                : <span>Synced just now</span>}
              <button className="link f11" onClick={app.reload}>Refresh</button>
            </div>
          </section>

          <section className="card d2-connected">
            <div className="d2-conn-head">
              <span className="d2-reg-ico is-green"><Icon name="globe" size={13} /></span>
              <div>
                <div className="d2-reg-title">Connected Domains</div>
                <div className="d2-conn-sub">All domains and aliases linked to websites in your workspace.</div>
              </div>
              <span className="grow" />
              <Pill tone="green">Primary {scopedDomains.filter((d) => d.primary).length}</Pill>
              <Pill tone="grey">Alias {scopedDomains.filter((d) => !d.primary).length}</Pill>
              <Pill tone="amber">Pending {attention.length}</Pill>
            </div>
            {!scopedDomains.length && (
              <div className="d2-norec d2-conn-empty">
                <Icon name="link" size={15} />
                <div style={{ minWidth: 0 }}>
                  <div className="w650 f13">No custom domains connected</div>
                  <div className="f12 muted">Connect a domain to start serving a website.</div>
                </div>
                <Btn className="btn-sm" icon="plus" onClick={() => app.openModal({ kind: "connect-domain" })}>Connect Domain</Btn>
              </div>
            )}
            <div className="d2-conn-grid">
              {scopedDomains.map((d) => {
                const owner = sites.find((s) => s.id === d.siteId);
                const broken = d.dns === "failed" || d.ssl === "failed";
                const pending = d.dns !== "verified" || d.ssl !== "active";
                return (
                  <article key={d.id} className="d2-conn-card" onClick={() => selectSite(d.siteId)}>
                    <span className="d2-conn-ico"><Icon name="globe" size={12} /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="d2-conn-host">
                        <span className="mono truncate">{d.hostname}</span>
                        {broken ? <Pill tone="red">Failed</Pill>
                          : pending ? <Pill tone="amber">Pending</Pill>
                            : d.primary ? <Pill tone="green">Primary</Pill> : <Pill tone="grey">Alias</Pill>}
                      </span>
                      <span className="d2-conn-site truncate">{owner?.name ?? "—"}</span>
                    </span>
                    <button className="st-copy" aria-label={`Copy ${d.hostname}`} title="Copy hostname"
                      onClick={(e) => { e.stopPropagation(); copy(d.hostname, "Hostname"); }}><Icon name="external" size={11} /></button>
                    <button className="d2-more" aria-label={`Actions for ${d.hostname}`}
                      onClick={(e) => { e.stopPropagation(); menuBtn.current = e.currentTarget; setMenuFor(d.siteId); }}><Icon name="more" size={13} /></button>
                  </article>
                );
              })}

            </div>
          </section>
        </div>

        <aside className="d2-side">
          {wide && (activeSiteId ? <DomainDetails siteId={activeSiteId} tab={inspTab} onTabChange={setInspTab} /> : <div className="card d2-panel-empty">Select a website to see its domains.</div>)}
        </aside>
      </div>

      <Popover anchor={menuBtn.current} open={!!menuSite} onClose={() => setMenuFor(null)} className="w-220">
        {menuSite && (
          <>
            <MenuLabel>{menuSite.name}</MenuLabel>
            <MenuItem icon="external" onClick={() => { setMenuFor(null); app.toast({ type: "info", title: "Opening live site", sub: hostOf(menuSite.id) }); }}>Open site</MenuItem>
            <MenuItem icon="settings" onClick={() => { setMenuFor(null); selectSite(menuSite.id); }}>Manage website</MenuItem>
            <MenuItem icon="refresh" disabled={!menuPrimary || denied} onClick={() => { setMenuFor(null); if (menuPrimary) void app.verifyRecord(menuSite.id, menuPrimary.id); }}>Verify DNS</MenuItem>
            <MenuItem icon="lock" disabled={!menuPrimary} onClick={() => { setMenuFor(null); app.openModal({ kind: "domain-settings", siteId: menuSite.id }); }}>SSL details</MenuItem>
            <MenuItem icon="target" disabled={!menuPrimary || menuPrimary.primary} onClick={() => { setMenuFor(null); app.openModal({ kind: "domain-settings", siteId: menuSite.id }); }}>Make primary</MenuItem>
            <MenuItem icon="copy" onClick={() => { setMenuFor(null); copy(hostOf(menuSite.id), "Hostname"); }}>Copy hostname</MenuItem>
            <div className="menu-sep" />
            <MenuItem icon="eye" onClick={() => { setMenuFor(null); app.openModal({ kind: "preview", siteId: menuSite.id }); }}>Preview website</MenuItem>
            <MenuItem icon="pencil" onClick={() => { setMenuFor(null); app.openModal({ kind: "rename", siteId: menuSite.id }); }}>Rename</MenuItem>
            <MenuItem icon="layers" onClick={() => { setMenuFor(null); app.openModal({ kind: "duplicate", siteId: menuSite.id }); }}>Duplicate</MenuItem>
            <MenuItem icon="archive" disabled={!app.can("delete")} onClick={() => { setMenuFor(null); app.openModal({ kind: "archive", siteId: menuSite.id }); }}>Archive</MenuItem>
            <MenuItem icon="trash" danger disabled={!app.can("delete")} onClick={() => { setMenuFor(null); app.openModal({ kind: "delete", siteId: menuSite.id }); }}>Delete</MenuItem>
          </>
        )}
      </Popover>
    </>
  );
}

function RegistrySkeleton() {
  return (
    <div className="d2-skel" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="d2-skel-row">
          <Skel style={{ width: 26, height: 26, borderRadius: 6 }} />
          <Skel style={{ width: 44, height: 30, borderRadius: 6 }} />
          <Skel style={{ width: 130, height: 10 }} />
          <Skel style={{ width: 96, height: 10 }} />
          <Skel style={{ width: 54, height: 16, borderRadius: 999 }} />
          <Skel style={{ width: 48, height: 16, borderRadius: 999 }} />
          <Skel style={{ width: 60, height: 10 }} />
        </div>
      ))}
    </div>
  );
}
