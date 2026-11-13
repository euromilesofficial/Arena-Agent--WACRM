/* ============================================================
   Dashboard · Site health
   ============================================================ */
import { Icon } from "../Icon";
import { Pill } from "../ui";
import { useApp, useDash } from "@/lib/store";

export function SiteHealth() {
  const app = useApp();
  const d = useDash();
  const sites = d?.siteHealth ?? [];
  const dnsOk = sites.filter((s) => s.dns === "verified").length;
  const dnsPend = sites.filter((s) => s.dns === "pending").length;
  const sslOk = sites.filter((s) => s.ssl === "active").length;
  const sslPend = sites.filter((s) => s.ssl !== "active").length;
  const scope = app.siteId === "all" ? "All Websites" : d?.sites.find((x) => x.id === app.siteId)?.name ?? "This website";

  const Row = ({ icon, name, children, which }: { icon: string; name: string; children: React.ReactNode; which: string }) => (
    <button className="health-row" onClick={() => app.openDrawer({ kind: "health", which })}>
      <span className="health-ico"><Icon name={icon} size={11} /></span>
      <span className="health-name nowrap">{name}</span>
      <span className="health-val">{children}</span>
    </button>
  );

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title nowrap"><Icon name="shield" size={14} /> Site Health <span className="card-title-soft">({scope})</span></div>
        </div>
        <div className="right">
          <button className="link green nowrap" onClick={() => app.openDrawer({ kind: "health", which: "health-details" })}>View Details <Icon name="arrowRight" size={10} /></button>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 2 }}>
        <div className="health-list">
          <Row icon="server" name="DNS" which="health-dns">
            <Pill tone="green">{dnsOk} / {sites.length} verified</Pill>
            {dnsPend > 0 && <Pill tone="amber"><Icon name="alert" size={9} /> {dnsPend} pending</Pill>}
          </Row>
          <Row icon="lock" name="SSL" which="health-ssl">
            <Pill tone="green">{sslOk} active{sslPend ? `, ${sslPend} pending` : ""}</Pill>
          </Row>
          <Row icon="rocket" name="Releases" which="health-releases">
            <Pill tone="green"><Icon name="check" size={9} /> All sites healthy</Pill>
            <span className="f11 muted2 nowrap mono">v1.24 <span style={{ opacity: .7 }}>(May 29)</span></span>
          </Row>
          <Row icon="activity" name="Core Web Vitals" which="health-vitals">
            <Pill tone="green"><Icon name="check" size={9} /> Good</Pill>
            <span className="f11 muted2 num nowrap">LCP 2.1s · INP 92ms · CLS 0.03</span>
          </Row>
        </div>
      </div>
    </section>
  );
}
