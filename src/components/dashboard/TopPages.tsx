/* ============================================================
   Dashboard · Top landing pages
   ============================================================ */
import { Icon } from "../Icon";
import { PageThumb } from "../charts";
import { EmptyState } from "../ui";
import { useApp, useDash } from "@/lib/store";
import { fmtInt } from "@/lib/format";
import type { SortKey } from "@/lib/store";

/** Landing pages use real previews where we have them. */
const PAGE_IMG: Record<string, string> = {
  "Study in Italy": "main",
  "IMAT Medicine": "page_medicine",
  "Scholarship Guide": "page_campus",
  "Referral Rewards": "rewards",
  "Tier Benefits": "rewards",
  "Partner Onboarding": "portal",
  "Commission Schedule": "portal"
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "leads", label: "Leads" },
  { key: "conv", label: "Conv." }
];

export function TopPages() {
  const app = useApp();
  const d = useDash();
  const rows = (d?.pages ?? []).slice(0, 3);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Icon name="file" size={13} /> Top Landing Pages</div>
          <div className="card-sub">Pages driving the most leads.</div>
        </div>
        <div className="right">
          <button className="link nowrap" onClick={() => app.go("pages")}>View Pages <Icon name="arrowRight" size={10} /></button>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 2 }}>
        {!rows.length ? (
          <EmptyState icon="file" title="No pages tracked yet" desc="Publish your first page to collect landing-page analytics."
            action={<button className="btn btn-sm" disabled={!app.can("create")} onClick={() => app.openModal({ kind: "wizard" })}><Icon name="plus" size={12} /> Create a page</button>} />
        ) : (
          <>
            <table className="tbl">
              <colgroup>
                <col className="col-rank" /><col className="col-name" /><col className="col-views" />
                <col className="col-leads" /><col className="col-conv" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Landing page</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} title={c.key === "conv" ? "Conversion rate (leads ÷ views)" : c.label} className={`sortable ${app.sort.key === c.key ? "sorted" : ""} ${app.sort.key === c.key && app.sort.dir === "desc" ? "desc" : ""}`}
                      onClick={() => app.setSort({ key: c.key, dir: app.sort.key === c.key && app.sort.dir === "desc" ? "asc" : "desc" })}>
                      {c.label} <span className="th-in"><svg className="sort-ico" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M6 13l6 6 6-6" /></svg></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.id}>
                    <td><span className="rank">{i + 1}</span></td>
                    <td>
                      <div className="page-cell">
                        <span className="page-thumb"><PageThumb seed={p.title} img={PAGE_IMG[p.title]} /></span>
                        <span style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                          <span className="page-name truncate" title={p.title} style={{ cursor: "pointer" }} onClick={() => app.openDrawer({ kind: "page", id: p.id })}>{p.title}</span>
                        </span>
                      </div>
                    </td>
                    <td className="num">{fmtInt(p.views)}</td>
                    <td className="num">{p.leads}</td>
                    <td className="num"><span className="conv-pill">{p.conv.toFixed(2)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

          </>
        )}
      </div>
    </section>
  );
}
