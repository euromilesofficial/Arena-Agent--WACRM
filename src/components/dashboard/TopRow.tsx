/* ============================================================
   Dashboard · top row — toolbar, attention banner, publishing status
   ============================================================ */
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { Btn, MenuItem, MenuLabel, Modal, Pill, Popover } from "../ui";
import { useApp, useDash } from "@/lib/store";
import { rangeLabel } from "@/lib/format";

/* The demo dataset ends on a fixed "today"; calendar presets are resolved
   against it so the window label and the plotted points always agree. */
const DEMO_TODAY = new Date(2025, 4, 30);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortOf = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
const daysBack = (d: Date) => Math.round((DEMO_TODAY.getTime() - d.getTime()) / 86400000);
const offsetOf = (d: Date) => Math.max(0, daysBack(d));

export function Toolbar() {
  const app = useApp();
  const d = useDash();
  const [open, setOpen] = useState<null | "site" | "range">(null);
  const [customFrom, setCustomFrom] = useState(isoOf(addDays(DEMO_TODAY, -13)));
  const [customTo, setCustomTo] = useState(isoOf(DEMO_TODAY));

  const applyCalendar = (kind: "this" | "last") => {
    if (kind === "this") {
      const days = DEMO_TODAY.getDate();
      app.setRange(days, 0, `${MONTH_NAMES[DEMO_TODAY.getMonth()]} 1 – ${shortOf(DEMO_TODAY)}`);
    } else {
      const firstOfThis = new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth(), 1);
      const lastMonthEnd = addDays(firstOfThis, -1);
      const days = lastMonthEnd.getDate();
      const start = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
      app.setRange(days, offsetOf(lastMonthEnd), `${shortOf(start)} – ${shortOf(lastMonthEnd)}`);
    }
    setOpen(null);
  };

  const applyCustom = () => {
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T00:00:00`);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      app.toast({ type: "warn", title: "Check the dates", sub: "The end date must be on or after the start date." });
      return;
    }
    if (daysBack(from) < 0 || daysBack(to) < 0) {
      app.toast({ type: "warn", title: "Dates are in the future", sub: `The demo dataset ends ${shortOf(DEMO_TODAY)}, 2025.` });
      return;
    }
    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    app.setRange(days, offsetOf(to), `${shortOf(from)} – ${shortOf(to)}`);
    setOpen(null);
  };
  const siteRef = useRef<HTMLButtonElement>(null);
  const rangeRef = useRef<HTMLButtonElement>(null);
  const anchor = open === "site" ? siteRef.current : open === "range" ? rangeRef.current : null;
  const siteLabel = app.siteId === "all" ? `All Websites (${d?.sites.length ?? 3})` : d?.sites.find((s) => s.id === app.siteId)?.name ?? "Website";

  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">Website CMS Dashboard</h1>
        <p className="page-sub">Manage websites, content, performance, and lead generation — all in one place.</p>
      </div>
      <div className="toolbar">
        <button className="select-btn" ref={siteRef} aria-haspopup="menu" aria-expanded={open === "site"}
          onClick={() => setOpen((o) => (o === "site" ? null : "site"))}>
          <Icon name="globe" size={14} /><span className="val">{siteLabel}</span><Icon name="chevDown" size={13} className="chev" />
        </button>
        <button className="select-btn" ref={rangeRef} aria-haspopup="menu" aria-expanded={open === "range"}
          onClick={() => setOpen((o) => (o === "range" ? null : "range"))}>
          <Icon name="calendar" size={14} /><span className="val">{app.rangeName}</span><Icon name="chevDown" size={13} className="chev" />
        </button>
        <Btn variant="primary" icon="plus" className="new-site-btn" disabled={!app.can("create")}
          title={!app.can("create") ? "Your role can browse but not create websites" : undefined}
          onClick={() => app.openModal({ kind: "wizard" })}>New Website</Btn>
      </div>

      <Popover anchor={anchor} open={open === "site"} onClose={() => setOpen(null)} className="w-260">
        <MenuLabel>Filter by website</MenuLabel>
        <MenuItem icon="layers" selected={app.siteId === "all"} meta={`${d?.sites.length ?? 3}`} onClick={() => { setOpen(null); app.setSite("all"); }}>All websites</MenuItem>
        <div className="menu-sep" />
        {(d?.sites ?? []).map((s) => (
          <MenuItem key={s.id} icon="globe" selected={app.siteId === s.id} meta={`${s.pages}p`} onClick={() => { setOpen(null); app.setSite(s.id); }}>
            <span className="truncate">{s.name}</span>
          </MenuItem>
        ))}
        <div className="menu-sep" />
        <MenuItem icon="plus" onClick={() => { setOpen(null); app.openModal({ kind: "wizard" }); }}>Add website</MenuItem>
      </Popover>

      <Popover anchor={anchor} open={open === "range"} onClose={() => setOpen(null)} className="w-300">
        <MenuLabel>Date range</MenuLabel>
        {[7, 14, 30, 90].map((n) => (
          <MenuItem key={n} icon="clock" selected={app.days === n && app.rangeEnd === 0}
            onClick={() => { setOpen(null); app.setDays(n); }}>{rangeLabel(n)}</MenuItem>
        ))}
        <div className="menu-sep" />
        <MenuItem icon="calendar" selected={app.rangeName.startsWith(MONTH_NAMES[DEMO_TODAY.getMonth()] + " 1")}
          onClick={() => applyCalendar("this")}>This month</MenuItem>
        <MenuItem icon="calendar" onClick={() => applyCalendar("last")}>Last month</MenuItem>
        <div className="menu-sep" />
        <MenuLabel>Custom range</MenuLabel>
        <div style={{ display: "flex", gap: 6, padding: "0 6px 6px" }}>
          <input className="input" type="date" aria-label="Start date" max={isoOf(DEMO_TODAY)} value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)} style={{ height: 30, fontSize: 11.5 }} />
          <input className="input" type="date" aria-label="End date" max={isoOf(DEMO_TODAY)} value={customTo}
            onChange={(e) => setCustomTo(e.target.value)} style={{ height: 30, fontSize: 11.5 }} />
        </div>
        <div style={{ padding: "0 6px 6px" }}>
          <Btn className="btn-sm" variant="primary" onClick={applyCustom} style={{ width: "100%", justifyContent: "center" }}>Apply range</Btn>
        </div>
        <div className="f11 muted" style={{ padding: "2px 8px 6px" }}>Operational health always shows live status.</div>
      </Popover>
    </div>
  );
}

export function Attention() {
  const app = useApp();
  const d = useDash();
  if (!d) return <div className="attention"><div className="attention-head"><div className="sk sk-line" style={{ width: 220 }} /></div></div>;

  const issues = d.issues.slice(0, 3);
  const dismissed = d.banner.dismissed;

  if (dismissed || !issues.length) {
    return (
      <div className="attention resolved" style={{ justifyContent: "center" }}>
        <div className="attention-head">
          <span className="a-ico"><Icon name="check" size={12} /></span>
          <span className="a-title">All systems clear</span>
          <span className="a-count">No DNS, SSL or publishing issues need your action.</span>
          <button className="link" onClick={() => { app.dismissBanner(); app.toast({ type: "success", title: "Banner restored", sub: "Re-ran DNS, SSL and publishing checks." }); }}>
            <Icon name="refresh" size={10} /> Re-run checks
          </button>
        </div>
        <div className="attention-items">
          {["DNS verified · 3/3", "SSL active · 3/3", "No unpublished drift"].map((t) => (
            <div key={t} className="at-card" style={{ borderColor: "var(--green-line)", animation: "none" }}>
              <span className="at-ico" style={{ background: "var(--green-soft)", color: "#0A7A46" }}><Icon name="check" size={10} /></span>
              <span className="at-body"><span className="at-label" style={{ fontWeight: 600 }}>{t}</span></span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const runIssue = (id: string) => {
    if (id === "iss_ssl") return app.openDrawer({ kind: "ssl", siteId: issues.find((i) => i.id === id)?.site ?? "site_portal" });
    if (id === "iss_link") return app.openDrawer({ kind: "broken-link" });
    return app.openModal({ kind: "preflight" });
  };

  return (
    <div className="attention">
      <div className="attention-head">
        <span className="a-ico"><Icon name="alert" size={12} /></span>
        <span className="a-title">Needs Attention</span>
        <span className="a-count"><b className="a-num">{issues.length} item{issues.length > 1 ? "s" : ""}</b> require{issues.length > 1 ? "" : "s"} your action</span>
        <button className="link" onClick={() => app.openDrawer({ kind: "issues" })}>View All Issues <Icon name="arrowRight" size={10} /></button>
      </div>
      <div className="attention-items">
        {issues.map((i, idx) => (
          <div key={i.id} className="at-card" style={{ animationDelay: `${idx * 45}ms` }}>
            <span className={`at-ico ${i.kind}`}><Icon name={i.icon || "alert"} size={10} /></span>
            <span className="at-body">
              <span className="at-label">{i.label}</span>
              <span className="at-sub">{i.sub}</span>
            </span>
            <Btn onClick={() => runIssue(i.id)}>{i.cta}</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Release history with rollback — the store has had `rollback()` since Module 1
 *  but nothing called it, so a rollback was impossible from the UI. */
function ReleaseHistory({ live, publishedAt, onClose }: { live: string; publishedAt: string; onClose: () => void }) {
  const app = useApp();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const m = /v?(\d+)\.(\d+)/.exec(live || "v1.24");
  const major = m ? m[1] : "1";
  const minor = m ? Number(m[2]) : 24;
  const releases = [0, 1, 2, 3].map((i) => {
    const v = `v${major}.${minor - i}`;
    return {
      version: v,
      when: i === 0 ? publishedAt.replace(/, \d{4}$/, "") : `${22 - i * 7} May`,
      author: i === 0 ? "Aarav M." : i === 1 ? "Anita N." : "John D.",
      state: i === 0 ? "live" : "superseded"
    };
  });

  return (
    <Modal title="Release history" sub="Every publish is an immutable manifest; rollback moves the pointer, it never rewrites history."
      icon="clock" onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <span className="grow" />
        {confirm && (
          <Btn variant="danger" loading={busy} onClick={async () => {
            setBusy(true);
            await app.rollback(confirm);
            setBusy(false);
            setConfirm(null);
            onClose();
          }}>Confirm rollback to {confirm}</Btn>
        )}
      </>}>
      {confirm && (
        <div className="card mb10" style={{ padding: "8px 10px", display: "flex", gap: 8, alignItems: "center", background: "var(--amber-soft, #FFF6E5)" }}>
          <Icon name="alert" size={13} />
          <span className="f12">Public traffic will serve <b>{confirm}</b> within ~30 seconds. The current release stays in history.</span>
        </div>
      )}
      <div className="dr-table">
        {releases.map((r) => (
          <div key={r.version} className="dr-row">
            <b className="mono f12" style={{ minWidth: 52 }}>{r.version}</b>
            <span className="grow f11 muted">{r.when} · {r.author}</span>
            {r.state === "live"
              ? <Pill tone="green" dot>live</Pill>
              : <Btn className="btn-sm" disabled={!app.can("delete") || !!confirm} onClick={() => setConfirm(r.version)}>Roll back</Btn>}
          </div>
        ))}
      </div>
      <p className="dr-p mt10">
        {app.can("delete")
          ? "Rollback requires step-up authentication in production; it is recorded in the audit trail with the actor and timestamp."
          : "Your role can view releases but not roll them back — an Owner or Admin must do it."}
      </p>
    </Modal>
  );
}

export function PublishingStatus() {
  const app = useApp();
  const d = useDash();
  const [history, setHistory] = useState(false);
  const p = d?.publishing;
  if (!p) return <div className="card"><div className="card-head"><div className="card-title"><Icon name="upload" size={14} /> Publishing Status</div></div></div>;

  return (
    <>
      <div className="card-head">
        <div><div className="card-title"><Icon name="upload" size={14} /> Publishing Status</div></div>
        <button className="link nowrap f11" onClick={() => setHistory(true)}>History <Icon name="arrowRight" size={10} /></button>
      </div>
      <div className="card-body" style={{ padding: "8px 10px 10px" }}>
        <div className="pub-strip">
          <button className="pub-seg" disabled={!app.can("publish")} title={!app.can("publish") ? "Your role can review but not publish" : undefined} onClick={() => app.openModal({ kind: "publish-queue", which: "drafts" })}>
            <span className="pc-ico violet"><Icon name="file" size={13} /></span>
            <span className="pc-txt"><b className="pc-val num">{p.drafts}</b><span className="pc-lab">Drafts</span></span>
          </button>
          <button className="pub-seg box" disabled={!app.can("publish")} title={!app.can("publish") ? "Your role can review but not publish" : undefined} onClick={() => app.openModal({ kind: "publish-queue", which: "ready" })}>
            <span className="pc-ico green"><Icon name="check" size={13} /></span>
            <span className="pc-txt"><b className="pc-val num">{p.ready}</b><span className="pc-lab">Ready to Publish</span></span>
          </button>
          <button className="pub-seg live" onClick={() => app.openDrawer({ kind: "health", which: "health-releases" })}>
            <span className="pc-ico green"><Icon name="rocket" size={13} /></span>
            <span className="pc-txt">
              <span className="pc-live">Live Release</span>
              <b className="pc-ver mono">{p.live || "—"}</b>
              <span className="pc-lab" title={`Published ${p.publishedAt ?? "—"}`}>Published {(p.publishedAt || "—").replace(/, \d{4}$/, "")}</span>
            </span>
          </button>
          <Btn className="btn-sm nowrap release-btn" disabled={!app.can("publish")} title={!app.can("publish") ? "Your role can review but not publish" : undefined} onClick={() => app.openModal({ kind: "preflight" })}>
            Release <Icon name="arrowRight" size={12} />
          </Btn>
        </div>
      </div>
      {history && <ReleaseHistory live={p.live ?? "v1.24"} publishedAt={p.publishedAt ?? "May 29, 2025"} onClose={() => setHistory(false)} />}
    </>
  );
}
