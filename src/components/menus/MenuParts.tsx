/* ============================================================
   Module 8 · shared parts — link picker, mega panel editor, navigation preview.
   Pure presentation over the menu-db types. No data access here.
   ============================================================ */
import { Icon } from "@/components/Icon";
import type { ThemeTokens } from "@/lib/theme-db";
import { stackFor } from "@/lib/theme-db";
import {
  MENU_LIMITS, anchorOk, linkLabel, newId, urlOk, type LinkRef, type MegaColumn, type MegaDoc, type MegaFeatured, type MegaLink,
  type MenuItem, type PageLike, type Gap, type MenuStyle, type Surface, type DropAnim, SURFACES, DROP_ANIMS, styleOf,
} from "@/lib/menu-db";

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 980, tablet: 640, mobile: 360 };
export const GAP_PX: Record<Gap, number> = { small: 12, medium: 20, large: 32 };
export const FEATURED_IMAGES = [
  { id: "study-uk", label: "Campus at dusk", a: "#7c3aed", b: "#c4b5fd" },
  { id: "coast", label: "Coastline", a: "#0e7490", b: "#a5f3fc" },
  { id: "city", label: "City skyline", a: "#334155", b: "#cbd5e1" },
];

/* ---------- link picker ---------- */
const pageOptions = (pages: PageLike[]) =>
  pages.filter((p) => !p.trash).sort((a, b) => a.path.localeCompare(b.path));

export function LinkEditor({ link, pages, onChange, disabled, idp, compact = false }: {
  link: LinkRef | null; pages: PageLike[]; onChange: (l: LinkRef | null) => void; disabled?: boolean; idp: string; compact?: boolean;
}) {
  const kind = link?.kind ?? "page";
  const list = pageOptions(pages);
  const kindChange = (k: "page" | "url" | "anchor") => {
    if (k === "page") onChange({ kind: "page", pageId: list[0]?.id ?? "" });
    else if (k === "url") onChange({ kind: "url", url: "https://" });
    else onChange({ kind: "anchor", anchor: "#" });
  };
  const bad = link?.kind === "url" && !urlOk(link.url) ? "Address must start with https://, mailto: or tel:." : link?.kind === "anchor" && !anchorOk(link.anchor) ? "Anchor must look like #section-name." : null;
  return (
    <div className={`m8-link${compact ? " is-compact" : ""}`}>
      <select aria-label={`Link type, ${idp}`} value={kind} disabled={disabled} onChange={(e) => kindChange(e.target.value as "page" | "url" | "anchor")}>
        <option value="page">Page</option>
        <option value="url">Web address</option>
        <option value="anchor">Anchor on page</option>
      </select>
      {kind === "page" && (
        <select aria-label={`Page, ${idp}`} value={link?.kind === "page" ? link.pageId : ""} disabled={disabled}
          onChange={(e) => onChange({ kind: "page", pageId: e.target.value })}>
          {link?.kind === "page" && !list.some((p) => p.id === link.pageId) && <option value={link.pageId}>{linkLabel(link, pages)}</option>}
          {list.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status === "draft" ? " (draft)" : ""} — {p.path}</option>)}
        </select>
      )}
      {kind === "url" && (
        <input aria-label={`Web address, ${idp}`} value={link?.kind === "url" ? link.url : ""} placeholder="https://" disabled={disabled}
          aria-invalid={!!bad} onChange={(e) => onChange({ kind: "url", url: e.target.value })} />
      )}
      {kind === "anchor" && (
        <input aria-label={`Anchor, ${idp}`} value={link?.kind === "anchor" ? link.anchor : ""} placeholder="#section" disabled={disabled}
          aria-invalid={!!bad} onChange={(e) => onChange({ kind: "anchor", anchor: e.target.value })} />
      )}
      {bad && <em className="m8-link-err" role="alert">{bad}</em>}
    </div>
  );
}

/* ---------- mega panel editor (Mega Menus tab) ---------- */
export function MegaEditor({ doc, onChange, pages, disabled, idp }: {
  doc: MegaDoc; onChange: (d: MegaDoc) => void; pages: PageLike[]; disabled?: boolean; idp: string;
}) {
  const cols = doc.columns.length;
  const setCols = (next: MegaColumn[]) => onChange({ ...doc, columns: next });
  const setLayout = (n: number) => {
    if (n === cols) return;
    if (n > cols) setCols([...doc.columns, ...Array.from({ length: n - cols }, (_, i) => ({ id: newId("mc"), title: `Column ${cols + i + 1}`, links: [] }))]);
    else setCols(doc.columns.slice(0, n));
  };
  const updCol = (id: string, fn: (c: MegaColumn) => MegaColumn) => setCols(doc.columns.map((c) => (c.id === id ? fn(c) : c)));
  const updLink = (colId: string, linkId: string, fn: (l: MegaLink) => MegaLink) =>
    updCol(colId, (c) => ({ ...c, links: c.links.map((l) => (l.id === linkId ? fn(l) : l)) }));
  const setFeat = (f: Partial<MegaFeatured>) => onChange({ ...doc, featured: { ...doc.featured, ...f } });
  return (
    <div className="m8-mega-editor">
      <div className="m8-mega-bar">
        <div className="m8-field">
          <span className="m8-lbl" id={`${idp}-layout`}>Layout</span>
          <div className="m8-seg" role="radiogroup" aria-labelledby={`${idp}-layout`}>
            {[2, 3, 4].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={cols === n} disabled={disabled}
                className={cols === n ? "is-on" : ""} onClick={() => setLayout(n)}>{n} columns</button>
            ))}
          </div>
        </div>
        <label className="m8-field">
          <span className="m8-lbl">Column gap</span>
          <select value={doc.gap} disabled={disabled} onChange={(e) => onChange({ ...doc, gap: e.target.value as Gap })}>
            <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
          </select>
        </label>
        <label className="m8-field">
          <span className="m8-lbl">Panel surface</span>
          <select aria-label="Panel surface" value={doc.surface ?? "card"} disabled={disabled} onChange={(e) => onChange({ ...doc, surface: e.target.value as Surface })}>
            {SURFACES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="m8-field">
          <span className="m8-lbl">Panel animation</span>
          <select aria-label="Panel animation" value={doc.dropAnim ?? "fade"} disabled={disabled} onChange={(e) => onChange({ ...doc, dropAnim: e.target.value as DropAnim })}>
            {DROP_ANIMS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="m8-toggle">
          <input type="checkbox" checked={doc.featured.enabled} disabled={disabled} onChange={(e) => setFeat({ enabled: e.target.checked })} />
          <span>Show featured content</span>
        </label>
      </div>
      <div className="m8-mega-grid m8-mega-cols" style={{ gap: GAP_PX[doc.gap], gridTemplateColumns: `repeat(${cols + (doc.featured.enabled ? 1 : 0)}, minmax(0, 1fr))` }}>
        {doc.columns.map((c, i) => (
          <section className="m8-mcol" key={c.id} aria-label={`Column ${i + 1}`}>
            <header>
              <Icon name="grip" size={13} />
              <input aria-label={`Column ${i + 1} heading`} value={c.title} disabled={disabled}
                onChange={(e) => updCol(c.id, (x) => ({ ...x, title: e.target.value }))} />
              <button type="button" className="m8-icon" aria-label={`Delete column ${i + 1}`} disabled={disabled || cols <= MENU_LIMITS.minColumns}
                onClick={() => setCols(doc.columns.filter((x) => x.id !== c.id))}><Icon name="trash" size={13} /></button>
            </header>
            <ul>
              {c.links.map((l) => (
                <li key={l.id}>
                  <input aria-label={`Link label, column ${i + 1}`} value={l.label} disabled={disabled}
                    onChange={(e) => updLink(c.id, l.id, (x) => ({ ...x, label: e.target.value }))} />
                  <LinkEditor compact idp={`column ${i + 1} link`} link={l.link} pages={pages} disabled={disabled}
                    onChange={(lk) => updLink(c.id, l.id, (x) => ({ ...x, link: lk }))} />
                  <button type="button" className="m8-icon" aria-label={`Remove link ${l.label || "untitled"}`} disabled={disabled}
                    onClick={() => updCol(c.id, (x) => ({ ...x, links: x.links.filter((y) => y.id !== l.id) }))}><Icon name="x" size={12} /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="m8-add" disabled={disabled || c.links.length >= MENU_LIMITS.maxLinksPerColumn}
              onClick={() => updCol(c.id, (x) => ({ ...x, links: [...x.links, { id: newId("ml"), label: "New link", link: pages[0] ? { kind: "page", pageId: pages[0].id } : null }] }))}>
              <Icon name="plus" size={12} /> Add link
            </button>
          </section>
        ))}
        {doc.featured.enabled && (
          <section className="m8-mcol m8-feat-edit" aria-label="Featured card">
            <header><b>Featured</b></header>
            <label className="m8-field"><span className="m8-lbl">Image</span>
              <select value={doc.featured.image} disabled={disabled} onChange={(e) => setFeat({ image: e.target.value })}>
                {FEATURED_IMAGES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <FeaturedArt image={doc.featured.image} />
            <label className="m8-field"><span className="m8-lbl">Title</span>
              <input aria-label="Featured title" value={doc.featured.title} disabled={disabled} onChange={(e) => setFeat({ title: e.target.value })} />
            </label>
            <label className="m8-field"><span className="m8-lbl">Text</span>
              <textarea aria-label="Featured text" value={doc.featured.text} disabled={disabled} rows={2} onChange={(e) => setFeat({ text: e.target.value })} />
            </label>
            <label className="m8-field"><span className="m8-lbl">Button label</span>
              <input aria-label="Featured button label" value={doc.featured.ctaLabel} disabled={disabled} onChange={(e) => setFeat({ ctaLabel: e.target.value })} />
            </label>
            <div className="m8-field"><span className="m8-lbl">Button link</span>
              <LinkEditor compact idp="featured button" link={doc.featured.ctaLink} pages={pages} disabled={disabled} onChange={(l) => setFeat({ ctaLink: l })} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------- artwork (the featured card's image; drawn, not fetched) ---------- */
export function FeaturedArt({ image }: { image: string }) {
  const f = FEATURED_IMAGES.find((x) => x.id === image) ?? FEATURED_IMAGES[0];
  return (
    <svg className="m8-art" viewBox="0 0 320 150" role="img" aria-label={f.label} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`g-${f.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={f.a} /><stop offset="1" stopColor={f.b} /></linearGradient></defs>
      <rect width="320" height="150" fill={`url(#g-${f.id})`} />
      <g fill="rgba(255,255,255,.85)">
        <rect x="70" y="60" width="180" height="70" rx="3" /><polygon points="60,62 160,22 260,62" />
        <rect x="112" y="92" width="18" height="38" fill="rgba(0,0,0,.25)" /><rect x="150" y="92" width="18" height="38" fill="rgba(0,0,0,.25)" /><rect x="188" y="92" width="18" height="38" fill="rgba(0,0,0,.25)" />
      </g>
    </svg>
  );
}

/* ---------- navigation preview ---------- */
export function NavPreview({ items, megaOf, pages, tokens, device, brand, mobileBehaviour, openFirstLevel, openId, onOpen, label, menuStyle }: {
  items: MenuItem[]; megaOf: (id: string | null) => MegaDoc | undefined; pages: PageLike[]; tokens: ThemeTokens; device: Device;
  brand: string; mobileBehaviour: "drawer" | "accordion"; openFirstLevel: boolean; openId: string | null; onOpen: (id: string | null) => void; label: string; menuStyle?: MenuStyle;
}) {
  const st = styleOf({ style: menuStyle });
  const style = {
    "--m8-primary": tokens.colors.primary, "--m8-text": tokens.colors.text, "--m8-surface": tokens.colors.surface, "--m8-bg": tokens.colors.background,
    fontFamily: stackFor(tokens.typography.body), width: DEVICE_WIDTH[device] > 980 ? "100%" : DEVICE_WIDTH[device],
  } as React.CSSProperties;
  const visible = items.filter((i) => i.audience !== "hidden");
  /* below 1024px the header becomes the drawer and accordion (tablet and phone) */
  if (device !== "desktop") {
    return (
      <div className="m8-pv m8-pv-mobile" style={style} aria-label={label}>
        <div className="m8-pv-bar"><b>{brand}</b><span aria-hidden="true" className="m8-burger">☰</span></div>
        <ul className="m8-pv-stack">
          {visible.map((it, idx) => {
            const expandable = it.behaviour !== "link" && (it.children.length > 0 || it.behaviour === "mega");
            const isOpen = expandable && (openId === it.id || (openFirstLevel && openId === null && idx === 0));
            return (
              <li key={it.id}>
                {expandable ? (
                  <button type="button" aria-expanded={isOpen} aria-controls={`pv-${it.id}`} onClick={() => onOpen(openId === it.id ? null : it.id)}>
                    {it.label || "Untitled"} <Icon name={isOpen ? "chevUp" : "chevDown"} size={12} />
                  </button>
                ) : <span>{it.label || "Untitled"}</span>}
                {expandable && isOpen && <div id={`pv-${it.id}`} className={`m8-pv-sub ${mobileBehaviour}`}>
                  {it.behaviour === "mega" && megaOf(it.megaId) ? megaOf(it.megaId)!.columns.map((c) => (
                    <div key={c.id}><b>{c.title}</b>{c.links.map((l) => <span key={l.id}>{l.label}</span>)}</div>
                  )) : it.children.map((c) => <span key={c.id}>{c.label}</span>)}
                </div>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  const openMega = (id: string) => onOpen(openId === id ? null : id);
  return (
    <div className="m8-pv" style={style} aria-label={label}>
      <nav className={`m8-pv-bar m8-preset-${st.preset} m8-hover-${st.hoverFx}`} aria-label="Navigation preview">
        <b className="m8-pv-brand">{brand}</b>
        <ul className="m8-pv-top">
          {visible.map((it) => {
            const hasPanel = it.behaviour === "mega" || (it.behaviour === "dropdown" && it.children.length > 0);
            const isOpen = hasPanel && openId === it.id;
            return (
              <li key={it.id} className={it.behaviour === "mega" ? "is-mega" : ""}>
                {hasPanel ? (
                  <button type="button" aria-expanded={isOpen} aria-controls={`pvp-${it.id}`} onClick={() => openMega(it.id)}
                    onKeyDown={(e) => { if (e.key === "Escape") onOpen(null); }}>
                    {it.label || "Untitled"} <Icon name="chevDown" size={11} />
                  </button>
                ) : <span>{it.label || "Untitled"}</span>}
                {isOpen && (
                  <div id={`pvp-${it.id}`} className={`m8-pv-panel m8-anim-${megaOf(it.megaId)?.dropAnim ?? st.dropAnim}`} role="region" aria-label={`${it.label} menu`} onKeyDown={(e) => { if (e.key === "Escape") onOpen(null); }}>
                    {it.behaviour === "mega" && megaOf(it.megaId) ? <MegaPanelView mega={megaOf(it.megaId)!} pages={pages} tokens={tokens} />
                      : <ul className="m8-pv-drop">{it.children.map((c) => <li key={c.id}>{c.label}</li>)}</ul>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** the read-only rendering of a mega panel, as visitors see it */
export function MegaPanelView({ mega, pages, tokens }: { mega: MegaDoc; pages: PageLike[]; tokens: ThemeTokens }) {
  const cols = mega.columns.length + (mega.featured.enabled ? 1 : 0);
  return (
    <div className={`m8-mega-view m8-surface-${mega.surface ?? "card"}`} style={{ gap: GAP_PX[mega.gap], gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, color: tokens.colors.text }}>
      {mega.columns.map((c) => (
        <div key={c.id}>
          <b>{c.title || "Untitled"}</b>
          <ul>{c.links.map((l) => <li key={l.id}>{l.label}{l.link && l.link.kind === "page" && pages.find((p) => p.id === (l.link as { pageId: string }).pageId)?.status === "draft" ? <em> draft</em> : null}</li>)}</ul>
        </div>
      ))}
      {mega.featured.enabled && (
        <div className="m8-feat-view">
          <FeaturedArt image={mega.featured.image} />
          <b>{mega.featured.title}</b>
          <p>{mega.featured.text}</p>
          {mega.featured.ctaLabel && <span className="m8-cta" style={{ background: tokens.colors.primary }}>{mega.featured.ctaLabel} →</span>}
        </div>
      )}
    </div>
  );
}
