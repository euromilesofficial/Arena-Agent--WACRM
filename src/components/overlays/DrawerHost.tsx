/* ============================================================
   Drawer host — every drilldown in the dashboard
   ============================================================ */
import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { Btn, Drawer, Pill } from "../ui";
import { Sparkline } from "../charts";
import { useApp, useDash } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import { KPIS } from "../dashboard/Kpis";
import { SiteDrawer } from "../sites/SiteDrawer";

const FRAME: Record<string, { title: string; icon: string; sub: string }> = {
  visitors: { title: "Visitors", icon: "users", sub: "Unique visitors in range" },
  leads: { title: "Leads", icon: "target", sub: "CRM lead records created" },
  leadRate: { title: "Visitor-to-lead rate", icon: "filter", sub: "Leads ÷ visitors" },
  bookings: { title: "Bookings", icon: "calendar", sub: "Attributed counselling bookings" },
  lcp: { title: "Largest Contentful Paint", icon: "activity", sub: "75th percentile field data" },
  websites: { title: "Websites", icon: "layers", sub: "Live sites in this workspace" }
};

export function DrawerHost() {
  const app = useApp();
  const d = useDash();
  const [working, setWorking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [linkFixed, setLinkFixed] = useState(false);
  const state = app.drawer;

  useEffect(() => { setVerified(false); setLinkFixed(false); }, [state.kind]);

  if (state.kind === "none" || !d) return null;
  const close = app.closeDrawer;

  if (state.kind === "site") return <SiteDrawer siteId={state.id} onClose={close} />;

  if (state.kind === "kpi") {
    const k = KPIS.find((x) => x.id === state.id)!;
    const frame = FRAME[state.id] ?? { title: k.label, icon: k.icon, sub: "Rolling total for the selected range" };
    const value = () => {
      switch (state.id) {
        case "websites": return `${d.totals.sites}`;
        case "visitors": return fmtInt(d.totals.visitors);
        case "leads": return fmtInt(d.totals.leads);
        case "leadRate": return `${d.totals.leadRate.toFixed(2)}%`;
        case "bookings": return `${d.totals.bookings}`;
        default: return `${d.totals.lcp}s`;
      }
    };
    return (
      <Drawer title={frame.title} sub={frame.sub} icon={frame.icon} onClose={close}
        footer={<>
          <Btn onClick={() => { app.setPalette(true); close(); }} icon="search">Find related</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={() => { app.toast({ type: "success", title: "Added to report", sub: `${frame.title} · ${d.range.label}` }); close(); }}>Add to report</Btn>
        </>}>
        <div className="dr-kpi">
          <div className="dr-kpi-val num">{value()}</div>
          <div className="f11 muted">{d.range.label} · {d.scope}</div>
        </div>
        <div className="dr-spark"><Sparkline values={d.series.map((p) => (state.id === "leads" ? p.leads : p.visitors))} w={300} h={54} /></div>
        <div className="dr-section">Definition</div>
        <p className="dr-p">{k.def}</p>
        <div className="dr-section">By website</div>
        <div className="dr-table">
          {d.siteHealth.map((s) => (
            <div key={s.id} className="dr-row">
              <Icon name="globe" size={12} />
              <span className="grow truncate">{s.name}</span>
              <span className="f11 muted2">{state.id === "websites" ? "live" : fmtInt(Math.round((d.totals.visitors / d.siteHealth.length) * (s.status === "published" ? 1 : 0.5)))}</span>
            </div>
          ))}
        </div>
        <div className="dr-section">Notes</div>
        <p className="dr-p">{state.id === "leadRate"
          ? "Rate comparisons use percentage points, not percent change, so 0.48% → 0.51% reads as +0.03 pp."
          : "Figures are reconciled against the source system; totals match the headline metric exactly."}</p>
      </Drawer>
    );
  }

  if (state.kind === "stage") {
    const idx = d.funnel.findIndex((f) => f.id === state.id);
    const stage = d.funnel[idx];
    const prev = idx > 0 ? d.funnel[idx - 1] : null;
    return (
      <Drawer title={stage.name} sub={`Stage ${idx + 1} of ${d.funnel.length} · ${d.range.label}`} icon="filter" onClose={close}
        footer={<Btn variant="primary" onClick={() => { app.toast({ type: "info", title: "Opening cohort", sub: `${stage.name} · ${d.range.label}` }); close(); }}>Inspect cohort</Btn>}>
        <div className="dr-kpi">
          <div className="dr-kpi-val num">{fmtInt(stage.value)}</div>
          <div className="f11 muted">{prev ? `${(stage.pct ?? 0).toFixed(2)}% of ${prev.name.toLowerCase()}` : "Entry stage — all traffic"}</div>
        </div>
        <div className="dr-bars">
          {d.funnel.map((f, i) => (
            <div key={f.id} className="dr-bar-row">
              <span className="f11 truncate" style={{ width: 84 }}>{f.name}</span>
              <span className="dr-bar-track">
                <i style={{ width: `${Math.max(3, (f.value / (d.funnel[0].value || 1)) * 100)}%`, background: i === idx ? "#6D4AFF" : "#C9BFFF" }} />
              </span>
              <span className="f11 num" style={{ width: 52, textAlign: "right" }}>{fmtInt(f.value)}</span>
            </div>
          ))}
        </div>
        {prev && (
          <>
            <div className="dr-section">Drop-off from {prev.name}</div>
            <p className="dr-p">{fmtInt(prev.value - stage.value)} visitors did not continue. {stage.id === "starts" ? "Most exits happen on the enquiry form header." : stage.id === "leads" ? "Abandonment clusters around the phone field." : "Booking slots without counsellor availability are the main gap."}</p>
          </>
        )}
        <div className="dr-section">Top pages at this stage</div>
        <div className="dr-table">
          {d.pages.slice(0, 3).map((p) => (
            <div key={p.id} className="dr-row"><Icon name="file" size={12} /><span className="grow truncate">{p.title}</span><span className="f11 muted2">{p.leads} leads</span></div>
          ))}
        </div>
      </Drawer>
    );
  }

  if (state.kind === "channel") {
    const ch = d.acquisition.find((a) => a.id === state.id)!;
    return (
      <Drawer title={`${ch.name} traffic`} sub={ch.detail} icon="chart" onClose={close}
        footer={<Btn variant="primary" onClick={() => { app.setSite("all"); close(); app.toast({ type: "info", title: `Filtered view prepared for ${ch.name}` }); }}>Segment this source</Btn>}>
        <div className="dr-kpi">
          <div className="dr-kpi-val num">{fmtInt(ch.visitors)}</div>
          <div className="f11 muted">{ch.pct}% of {fmtInt(d.totals.visitors)} visitors</div>
        </div>
        <div className="dr-grid2">
          <div className="dr-stat"><span className="f11 muted">Leads</span><b className="num">{Math.round((d.totals.leads * ch.pct) / 100)}</b></div>
          <div className="dr-stat"><span className="f11 muted">Conv. rate</span><b className="num">{((d.totals.leads / (ch.visitors || 1)) * 100).toFixed(2)}%</b></div>
          <div className="dr-stat"><span className="f11 muted">Bounce</span><b className="num">{[38, 52, 44, 61][["search", "social", "direct", "referral"].indexOf(ch.id)] ?? 45}%</b></div>
          <div className="dr-stat"><span className="f11 muted">Pages / session</span><b className="num">{(2.1 + ch.pct / 40).toFixed(1)}</b></div>
        </div>
        <div className="dr-section">Landing pages</div>
        <div className="dr-table">
          {d.pages.slice(0, 4).map((p) => (
            <div key={p.id} className="dr-row"><Icon name="file" size={12} /><span className="grow truncate">{p.title}</span><span className="f11 muted2">{fmtInt(Math.round(p.views * (ch.pct / 100)))}</span></div>
          ))}
        </div>
        {ch.id === "direct" && <p className="dr-p mt10">Direct includes typed URLs and bookmarks. Unattributed sessions are never folded into Direct.</p>}
      </Drawer>
    );
  }

  if (state.kind === "page") {
    const p = d.pages.find((x) => x.id === state.id);
    if (!p) return null;
    return (
      <Drawer title={p.title} sub={`${p.host}${p.slug} · ${p.status}`} icon="file" onClose={close}
        footer={<>
          <Btn onClick={() => { app.toast({ type: "info", title: "Opening visual builder", sub: p.title }); close(); }} icon="blocks">Open in builder</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={() => { app.toast({ type: "success", title: "Preview opened", sub: p.slug }); close(); }}>Preview live</Btn>
        </>}>
        <div className="dr-grid2">
          <div className="dr-stat"><span className="f11 muted">Views</span><b className="num">{fmtInt(p.views)}</b></div>
          <div className="dr-stat"><span className="f11 muted">Leads</span><b className="num">{p.leads}</b></div>
          <div className="dr-stat"><span className="f11 muted">Conv. rate</span><b className="num">{p.conv.toFixed(2)}%</b></div>
          <div className="dr-stat"><span className="f11 muted">Updated</span><b>{p.updated}</b></div>
        </div>
        <div className="dr-section">Metadata</div>
        <div className="dr-table">
          <div className="dr-row"><span className="f11 muted" style={{ width: 92 }}>Slug</span><span className="mono f12">{p.slug}</span></div>
          <div className="dr-row"><span className="f11 muted" style={{ width: 92 }}>Author</span><span className="f12">{p.author}</span></div>
          <div className="dr-row"><span className="f11 muted" style={{ width: 92 }}>Website</span><span className="f12">{p.siteName}</span></div>
          <div className="dr-row"><span className="f11 muted" style={{ width: 92 }}>Status</span><Pill tone={p.live ? "green" : "amber"}>{p.status}</Pill></div>
        </div>
        <div className="dr-section">Recent changes</div>
        <div className="dr-table">
          {["Hero copy edited", "Meta description updated", "Internal links re-checked"].map((t, i) => (
            <div key={t} className="dr-row"><Icon name="pencil" size={12} /><span className="grow">{t}</span><span className="f11 muted2">{i + 1}d ago</span></div>
          ))}
        </div>
      </Drawer>
    );
  }

  if (state.kind === "health") {
    const titles: Record<string, string> = {
      "health-details": "Site health", "health-dns": "DNS verification", "health-ssl": "SSL lifecycle",
      "health-releases": "Release integrity", "health-vitals": "Core Web Vitals"
    };
    return (
      <Drawer title={titles[state.which] ?? "Site health"} sub={`${d.siteHealth.length} websites · live status`} icon="shield" onClose={close}
        footer={<>
          <Btn loading={working} icon="refresh" onClick={() => { setWorking(true); window.setTimeout(() => { setWorking(false); app.toast({ type: "success", title: "Checks complete", sub: "2 verified · 1 pending" }); }, 1200); }}>Re-run checks</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={close}>Done</Btn>
        </>}>
        <div className="dr-table">
          {d.siteHealth.map((s) => (
            <div key={s.id} className="dr-row" style={{ padding: "9px 6px" }}>
              <Icon name="globe" size={13} />
              <span style={{ minWidth: 0 }}>
                <span className="f12 w650 truncate" style={{ display: "block" }}>{s.name}</span>
                <span className="f11 muted mono">{s.host}</span>
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <Pill tone={s.dns === "verified" ? "green" : "amber"}>DNS {s.dns}</Pill>
                <Pill tone={s.ssl === "active" ? "green" : "amber"}>SSL {s.ssl}</Pill>
              </span>
            </div>
          ))}
        </div>
        <div className="dr-section">Expected records</div>
        <div className="dr-table">
          {d.siteHealth.flatMap((s) => s.records).slice(0, 4).map((r, i) => (
            <div key={i} className="dr-row"><span className="pill pill-grey mono">{r.type}</span><span className="grow truncate f11">{r.name}</span><span className="f11 muted mono truncate" style={{ maxWidth: 120 }}>{r.value}</span></div>
          ))}
        </div>
      </Drawer>
    );
  }

  if (state.kind === "activity") {
    return (
      <Drawer title="Recent activity" sub="Audit trail · newest first" icon="clock" onClose={close}>
        <div className="feed">
          {d.activity.map((a) => (
            <div key={a.id} className="feed-item">
              <span className="feed-dot" style={{ background: "#F2EEFF", color: "#5A36EF" }}><Icon name="rocket" size={11} /></span>
              <span style={{ minWidth: 0 }}>
                <span className="feed-title" style={{ display: "block" }}>{a.title}</span>
                <span className="feed-meta">{a.meta}</span>
              </span>
            </div>
          ))}
        </div>
      </Drawer>
    );
  }

  if (state.kind === "forms") {
    const f = d.forms;
    return (
      <Drawer title={f.name} sub="Form analytics · last 30 days" icon="form" onClose={close}
        footer={<Btn variant="primary" onClick={() => { app.toast({ type: "success", title: "Opening submissions inbox" }); close(); }}>Open submissions</Btn>}>
        <div className="dr-grid2">
          <div className="dr-stat"><span className="f11 muted">Starts</span><b className="num">{f.starts}</b></div>
          <div className="dr-stat"><span className="f11 muted">Submissions</span><b className="num">{f.submissions}</b></div>
          <div className="dr-stat"><span className="f11 muted">Completion</span><b className="num">{Math.round(f.completion * 100)}%</b></div>
          <div className="dr-stat"><span className="f11 muted">Leads created</span><b className="num">{f.leads}</b></div>
        </div>
        <div className="dr-section">Fields by completion</div>
        <div className="dr-bars">
          {[["Full name", 100], ["Email", 96], ["Phone", 71], ["Preferred intake", 58], ["Message", 34]].map(([label, pct]) => (
            <div key={label as string} className="dr-bar-row">
              <span className="f11 truncate" style={{ width: 110 }}>{label}</span>
              <span className="dr-bar-track"><i style={{ width: `${pct}%`, background: "#16B364" }} /></span>
              <span className="f11 num" style={{ width: 40, textAlign: "right" }}>{pct}%</span>
            </div>
          ))}
        </div>
        <p className="dr-p mt10">The phone field is the largest drop-off point — consider making it optional before the first submission.</p>
      </Drawer>
    );
  }

  if (state.kind === "vitals") {
    const map: Record<string, [string, string, string]> = {
      lcp: ["Largest Contentful Paint", `${d.vitals.lcp}s`, "Good ≤ 2.5s. The hero image on the homepage is the LCP element."],
      inp: ["Interaction to Next Paint", `${d.vitals.inp}ms`, "Good ≤ 200ms. Form validation runs on the main thread."],
      cls: ["Cumulative Layout Shift", `${d.vitals.cls.toFixed(2)}`, "Good ≤ 0.10. Webfont swaps cause the remaining shift."]
    };
    const [name, val, note] = map[state.which] ?? map.lcp;
    return (
      <Drawer title={name} sub="Core Web Vitals · 75th percentile" icon="gauge" onClose={close}>
        <div className="dr-kpi"><div className="dr-kpi-val num">{val}</div><div className="f11 muted">All websites · field data</div></div>
        <p className="dr-p">{note}</p>
        <div className="dr-section">By URL</div>
        <div className="dr-table">
          {["/study-in-italy", "/imat-medicine", "/scholarship-guide", "/"].map((u, i) => (
            <div key={u} className="dr-row"><Icon name="file" size={12} /><span className="grow mono f11">{u}</span><span className="f11 muted2">{[2.0, 2.3, 1.9, 2.4][i]}{state.which === "inp" ? "ms" : state.which === "cls" ? "" : "s"}</span></div>
          ))}
        </div>
      </Drawer>
    );
  }

  if (state.kind === "issues") {
    return (
      <Drawer title="All issues" sub={`${d.issues.length} open · 2 websites affected`} icon="alert" onClose={close}
        footer={<Btn icon="refresh" onClick={() => { app.toast({ type: "info", title: "Re-running all checks", sub: "DNS, SSL, links and publishing drift." }); close(); }}>Re-run all checks</Btn>}>
        <div className="dr-table">
          {d.issues.map((i) => (
            <div key={i.id} className="dr-row" style={{ padding: "9px 6px", alignItems: "center" }}>
              <span className={`at-ico ${i.kind}`}><Icon name={i.icon} size={11} /></span>
              <span style={{ minWidth: 0 }}>
                <span className="f12 w650" style={{ display: "block" }}>{i.label}</span>
                <span className="f11 muted">{i.sub}</span>
              </span>
              <Btn className="btn-sm" style={{ marginLeft: "auto" }} onClick={() => {
                if (i.id === "iss_ssl") app.openDrawer({ kind: "ssl", siteId: i.site });
                else if (i.id === "iss_link") app.openDrawer({ kind: "broken-link" });
                else app.openModal({ kind: "preflight" });
              }}>{i.cta}</Btn>
            </div>
          ))}
        </div>
      </Drawer>
    );
  }

  if (state.kind === "ssl") {
    const steps = ["TXT record published", "Certificate requested", "Challenge validated", "Certificate installed"];
    const doneCount = verified ? 4 : 1;
    return (
      <Drawer title="Fix SSL for Partner Portal" sub="partners.euromiles.in" icon="lock" onClose={close}
        footer={<>
          <Btn onClick={() => { app.dismissBanner(); close(); }}>Remind me later</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={working} onClick={async () => {
            setWorking(true);
            await app.verifyDomain(state.siteId);
            setWorking(false);
            setVerified(true);
            app.resolveIssue("iss_ssl");
            app.toast({ type: "success", title: "SSL active", sub: "Certificate installed for partners.euromiles.in" });
          }}>{verified ? "Verified" : "Retry provisioning"}</Btn>
        </>}>
        <div className="dr-section" style={{ marginTop: 0 }}>Progress</div>
        <div className="dr-steps">
          {steps.map((s, i) => (
            <div key={s} className={`dr-step ${i < doneCount ? "on" : ""}`}>
              <span className="dr-step-ico">{i < doneCount ? <Icon name="check" size={11} /> : i + 1}</span>
              <span className="grow f12">{s}</span>
              {i >= doneCount && <span className="f11 muted2">pending</span>}
            </div>
          ))}
        </div>
        <div className="dr-section">DNS records</div>
        <div className="dr-table">
          <div className="dr-row"><span className="pill pill-grey mono">TXT</span><span className="grow mono f11">_wacrm-verify.partners.euromiles.in</span></div>
          <div className="dr-row"><span className="pill pill-grey mono">A</span><span className="grow mono f11">partners.euromiles.in → 76.76.21.21</span></div>
        </div>
        <p className="dr-p mt10">Propagation usually completes in under two minutes. Provisioning retries automatically every 30 seconds.</p>
      </Drawer>
    );
  }

  if (state.kind === "broken-link") {
    const links = [
      { from: "/scholarship-guide", to: "/scholarships-2024", target: "Page not found (404)" },
      { from: "/study-in-italy", to: "https://old.euromiles.in/apply", target: "External host unreachable" }
    ];
    return (
      <Drawer title="Broken links" sub="1 issue · crawled 2h ago" icon="link" onClose={close}
        footer={<>
          <Btn icon="refresh" onClick={() => { setLinkFixed(false); app.toast({ type: "info", title: "Re-scanning", sub: "Crawling 48 pages…" }); }}>Re-scan</Btn>
          <span className="grow" />
          <Btn variant="primary" loading={working} onClick={() => {
            setWorking(true);
            window.setTimeout(() => { setWorking(false); setLinkFixed(true); app.resolveIssue("iss_link"); app.toast({ type: "success", title: "Redirect created", sub: "/scholarships-2024 → /scholarship-guide (301)" }); }, 1100);
          }}>{linkFixed ? "Fixed" : "Fix all"}</Btn>
        </>}>
        <div className="dr-table">
          {links.map((l) => (
            <div key={l.to} className="dr-row" style={{ alignItems: "flex-start" }}>
              <Icon name="alert" size={12} />
              <span style={{ minWidth: 0 }}>
                <span className="f12 w650 mono" style={{ display: "block" }}>{l.to}</span>
                <span className="f11 muted">linked from {l.from} · {l.target}</span>
              </span>
              {linkFixed && <Pill tone="green" style={{ marginLeft: "auto" }}>fixed</Pill>}
            </div>
          ))}
        </div>
        <p className="dr-p mt10">Fixing creates a 301 redirect and updates the anchor in the source page. Internal links are validated before the redirect is saved.</p>
      </Drawer>
    );
  }

  if (state.kind === "workspace") {
    const s = d.sites.find((x) => x.id === state.siteId);
    if (!s) return null;
    return (
      <Drawer title={s.name} sub={`${s.host} · ${s.template}`} icon="sliders" onClose={close}
        footer={<>
          <Btn onClick={() => app.openModal({ kind: "domain", siteId: s.id })} icon="globe">Domain</Btn>
          <span className="grow" />
          <Btn variant="primary" onClick={() => { app.setSite(s.id); close(); }}>Scope dashboard here</Btn>
        </>}>
        <div className="dr-grid2">
          <div className="dr-stat"><span className="f11 muted">Status</span><b style={{ textTransform: "capitalize" }}>{s.status}</b></div>
          <div className="dr-stat"><span className="f11 muted">Release</span><b className="mono">{s.release ?? "—"}</b></div>
          <div className="dr-stat"><span className="f11 muted">Pages</span><b className="num">{s.pages}</b></div>
          <div className="dr-stat"><span className="f11 muted">Leads</span><b className="num">{s.leads}</b></div>
        </div>
        <div className="dr-section">Quick actions</div>
        <div className="dr-table">
          <button className="dr-row" style={{ width: "100%" }} onClick={() => app.openModal({ kind: "preview", siteId: s.id })}>
            <Icon name="eye" size={12} /><span className="grow" style={{ textAlign: "left" }}>Preview site</span><Icon name="chevRight" size={11} />
          </button>
          <button className="dr-row" style={{ width: "100%" }} onClick={() => void app.duplicateSite(s.id)}>
            <Icon name="copy" size={12} /><span className="grow" style={{ textAlign: "left" }}>Duplicate website</span><Icon name="chevRight" size={11} />
          </button>
          <button className="dr-row" style={{ width: "100%" }} onClick={() => app.openModal({ kind: "rename", siteId: s.id })}>
            <Icon name="pencil" size={12} /><span className="grow" style={{ textAlign: "left" }}>Rename</span><Icon name="chevRight" size={11} />
          </button>
          <button className="dr-row" style={{ width: "100%" }} onClick={() => app.openModal({ kind: "archive", siteId: s.id })}>
            <Icon name="archive" size={12} /><span className="grow" style={{ textAlign: "left" }}>Archive</span><Icon name="chevRight" size={11} />
          </button>
        </div>
      </Drawer>
    );
  }

  if (state.kind === "point") {
    const p = state.point;
    return (
      <Drawer title={p.label} sub="Traffic point detail" icon="activity" onClose={close}>
        <div className="dr-grid2">
          <div className="dr-stat"><span className="f11 muted">Visitors</span><b className="num">{fmtInt(p.visitors)}</b></div>
          <div className="dr-stat"><span className="f11 muted">Leads</span><b className="num">{p.leads}</b></div>
        </div>
        {p.event && <p className="dr-p mt10">Annotated event: <b>{p.event}</b></p>}
        <div className="dr-section">Sessions</div>
        <div className="dr-table">
          {["Organic search", "Direct", "Social"].map((src, i) => (
            <div key={src} className="dr-row"><Icon name="search" size={12} /><span className="grow">{src}</span><span className="f11 muted2">{fmtInt(Math.round(p.visitors * [0.56, 0.14, 0.22][i]))}</span></div>
          ))}
        </div>
      </Drawer>
    );
  }

  return null;
}
