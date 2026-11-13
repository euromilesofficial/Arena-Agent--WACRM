/* ============================================================
   Overview screen — Module 01
   ============================================================ */
import { Btn, Skel } from "../components/ui";
import { Icon } from "../components/Icon";
import { Attention, PublishingStatus, Toolbar } from "../components/dashboard/TopRow";
import { Kpis } from "../components/dashboard/Kpis";
import { TrafficChart } from "../components/dashboard/TrafficChart";
import { Funnel } from "../components/dashboard/Funnel";
import { TopPages } from "../components/dashboard/TopPages";
import { Acquisition } from "../components/dashboard/Acquisition";
import { SiteHealth } from "../components/dashboard/SiteHealth";
import { Websites } from "../components/dashboard/Websites";
import { FormPerformance, GoalTracking, PerfSnapshot, RecentActivity } from "../components/dashboard/Side";
import { useApp } from "@/lib/store";

/**
 * Per-region failure. Analytics can be down while content, publishing and
 * domains keep working — the spec asks for exactly this, so a single failed
 * upstream never blanks the whole dashboard.
 */
function RegionError({ label }: { label: string }) {
  const app = useApp();
  return (
    <section className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 92, padding: 10 }}>
      <div style={{ textAlign: "center", maxWidth: 240 }}>
        <div className="kpi-ico" style={{ background: "var(--red-soft, #FDECEC)", color: "#B42318", width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", margin: "0 auto 8px" }}>
          <Icon name="alert" size={15} />
        </div>
        <div className="w650 f12">{label} unavailable</div>
        <div className="f11 muted mt4">Content, publishing and domains are unaffected.</div>
        <Btn className="btn-sm mt8" onClick={app.reload}>Retry</Btn>
      </div>
    </section>
  );
}

export function Overview() {
  const app = useApp();
  const analyticsDown = !!app.error;

  return (
    <>
      <Toolbar />

      {app.error && (
        <div className="card mb10" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, padding: "8px 12px" }}>
          <Icon name="alert" size={14} />
          <span className="f12 grow">{app.error} — analytics regions below show their own state; everything else stays live.</span>
          <Btn className="btn-sm" onClick={app.reload}>Retry</Btn>
        </div>
      )}

      {app.role === "Viewer" && (
        <div className="card mb10 d1-readonly" role="status">
          <Icon name="eye" size={14} />
          <span className="f12 grow">You are viewing WACRM as a <b>Viewer</b>. Publishing, creating and deleting are disabled; every metric and drilldown still works.</span>
        </div>
      )}

      {app.loading && (!app.data || app.demo === "loading") && <DashSkeleton />}

      <div className="dash" hidden={app.loading && (!app.data || app.demo === "loading")}>
        <div className="d-top">
          <Attention />
          <section className="card">
            <PublishingStatus />
          </section>
        </div>

        {analyticsDown ? <RegionError label="KPI metrics" /> : <Kpis />}

        <div className="d-chart">
          {analyticsDown ? <RegionError label="Traffic chart" /> : <TrafficChart />}
          {analyticsDown ? <RegionError label="Conversion journey" /> : <Funnel />}
        </div>

        <div className="d-panels">
          {analyticsDown ? <RegionError label="Top landing pages" /> : <TopPages />}
          {analyticsDown ? <RegionError label="Traffic acquisition" /> : <Acquisition />}
          <SiteHealth />
        </div>

        <Websites />

        <aside className="d-rail">
          <RecentActivity />
          {analyticsDown ? <RegionError label="Form performance" /> : <FormPerformance />}
          {analyticsDown ? <RegionError label="Goals" /> : <GoalTracking />}
          {analyticsDown ? <RegionError label="Web vitals" /> : <PerfSnapshot />}
        </aside>
      </div>

    </>
  );
}

/** Content-shaped skeleton: same grid, same row heights, shimmering blocks. */
function DashSkeleton() {
  const bar = (w: number | string, h: number, r = 6) => <Skel style={{ width: w, height: h, borderRadius: r }} />;
  return (
    <div className="dash dash-sk" aria-hidden>
      <div className="d-top">
        <section className="card" style={{ padding: 10, gap: 8 }}>
          {bar(220, 12)}
          <div className="sk-row">{bar("33%", 46, 9)}{bar("33%", 46, 9)}{bar("33%", 46, 9)}</div>
        </section>
        <section className="card" style={{ padding: 10, gap: 8 }}>
          {bar(140, 12)}
          <div className="sk-row">{bar("28%", 46, 9)}{bar("36%", 46, 9)}{bar("36%", 46, 9)}</div>
        </section>
      </div>
      <div className="kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi sk-card">
            <Skel style={{ width: 26, height: 26, borderRadius: 8 }} />
            <div className="sk-stack">{bar(48, 14)}{bar(60, 8)}{bar(40, 8)}</div>
          </div>
        ))}
      </div>
      <div className="d-chart">
        <section className="card" style={{ padding: 10, gap: 8 }}>{bar(160, 12)}<Skel style={{ flex: 1, borderRadius: 8 }} /></section>
        <section className="card" style={{ padding: 10, gap: 8 }}>{bar(140, 12)}<Skel style={{ flex: 1, borderRadius: 8 }} /></section>
      </div>
      <div className="d-panels">
        {[0, 1, 2].map((i) => (
          <section key={i} className="card" style={{ padding: 10, gap: 8 }}>{bar(120, 12)}<Skel style={{ flex: 1, borderRadius: 8 }} /></section>
        ))}
      </div>
      <section className="card d-sites" style={{ padding: 10, gap: 8 }}>
        {bar(130, 12)}
        <div className="sk-row">{bar("33%", 80, 10)}{bar("33%", 80, 10)}{bar("33%", 80, 10)}</div>
      </section>
      <aside className="d-rail">
        {[0, 1, 2, 3].map((i) => (
          <section key={i} className="card" style={{ padding: 10, gap: 8 }}>{bar(110, 12)}<Skel style={{ flex: 1, borderRadius: 8 }} /></section>
        ))}
      </aside>
    </div>
  );
}
