/* ============================================================
   Module placeholder — every non-Overview destination keeps its
   route, breadcrumb and cross-links so navigation never breaks.
   ============================================================ */
import { Icon } from "../components/Icon";
import { Btn, Pill } from "../components/ui";
import { findNav } from "@/lib/nav";
import { useApp } from "@/lib/store";

export function Placeholder({ screen }: { screen: string }) {
  const app = useApp();
  const item = findNav(screen);
  const label = item?.label ?? (screen === "settings" ? "Settings" : screen === "platform" ? "Platform" : "Module");

  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{label}</h1>
        <p className="page-sub">{item?.desc ?? "Configuration for this area of the workspace."}</p>
      </div>
      <div className="toolbar">
        <Pill tone="violet">Next module</Pill>
        <Btn icon="arrowLeft" onClick={() => app.go("overview")}>Back to Overview</Btn>
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
