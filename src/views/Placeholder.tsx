/* ============================================================
   Module placeholder — every non-Overview destination keeps its
   route, breadcrumb and cross-links so navigation never breaks.
   ============================================================ */
import { Icon } from "../components/Icon";
import { Btn, Pill } from "../components/ui";
import { findNav } from "@/lib/nav";
import { useApp } from "@/lib/store";
import { headerNavFor } from "@/lib/layout-db";

export function Placeholder({ screen }: { screen: string }) {
  const app = useApp();
  const item = findNav(screen);
  const label = item?.label ?? (screen === "settings" ? "Settings" : screen === "platform" ? "Platform" : "Module");

  return (
    <div className="ph-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{label}</h1>
          <p className="page-sub">{item?.desc ?? "Configuration for this area of the workspace."}</p>
        </div>
        <div className="toolbar">
          <Pill tone="violet">Next module</Pill>
          <Btn icon="arrowLeft" onClick={() => app.go("overview")}>Back to Overview</Btn>
        </div>
      </div>

      <div className="ph-grid">
        {(item?.caps ?? [["Module settings", "Configuration for this area.", "settings"]]).map(([title, desc, icon]) => (
          <div key={title as string} className="card ph-card">
            <div className="mod-icon" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name={icon as string} size={16} /></div>
            <div>
              <div className="f12 w650">{title as string}</div>
              <div className="f11 muted mt4">{desc as string}</div>
            </div>
            <Pill tone="grey">planned</Pill>
          </div>
        ))}
      </div>

      {screen === "menus" && <NavSource app={app} />}

      <div className="notice mt12">
        <Icon name="sparkles" size={13} /> The Overview dashboard is fully interactive in this build. This module keeps its route,
        breadcrumb and cross-links; its screens land in the next iteration.
      </div>
      <div className="mt12">
        <Btn variant="primary" icon="home" onClick={() => app.go("overview")}>Open the dashboard</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Module 8 is not built, but the navigation it will own already
   exists — as the nav list inside the header variant every page
   renders. Showing the real source beats a mock-up of a future
   screen, and it deep-links to the one place the links can be
   edited today.
   ------------------------------------------------------------ */
function NavSource({ app }: { app: ReturnType<typeof useApp> }) {
  const nav = headerNavFor("Site default");
  return (
    <div className="card ph-nav" aria-label="Navigation source">
      <div className="ph-nav-head">
        <div className="mod-icon" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name="menu" size={16} /></div>
        <div className="grow">
          <div className="f12 w600">Where this menu comes from today</div>
          <div className="f11 muted mt2">
            {nav.layoutName} → {nav.variantName}
            {nav.visible ? ` · ${nav.items.length} links` : " · header hidden on this layout"}
          </div>
        </div>
        <Btn icon="arrowRight" onClick={() => app.go("layouts")}>Open layout</Btn>
      </div>
      {nav.visible && nav.items.length > 0 ? (
        <ol className="ph-nav-list">
          {nav.items.map((label, i) => (
            <li key={`${label}-${i}`}><span className="ph-nav-i">{i + 1}</span>{label}</li>
          ))}
        </ol>
      ) : (
        <p className="f11 muted mt8">
          {nav.visible ? "The header variant has no links yet." : `The header is hidden on this layout (${nav.hideReason ?? "no reason recorded"}).`}
        </p>
      )}
      <p className="ph-nav-note">
        <Icon name="info" size={11} />
        Order, labels and depth are edited in Layouts &amp; Templates → Global Header. When Module 8 ships it reads this list instead of owning a second copy.
      </p>
    </div>
  );
}
