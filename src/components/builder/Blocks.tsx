/* ============================================================
   Module 4 — canvas block renderer
   ------------------------------------------------------------
   Renders the document at real website scale. Everything a visitor
   would see comes from typed props; there is no HTML or CSS input.
   ============================================================ */
import type { BlockNode } from "@/lib/builder";
import { imageFor } from "@/lib/builder-db";
import { Icon } from "@/components/Icon";
import { readPath, topKey } from "@/lib/inline-edit";

export interface RenderCtx {
  selId: string | null;
  selEl: string | null;
  onSelect: (id: string) => void;
  onSelectEl: (id: string, el: string) => void;
  onOpenLink?: (node: BlockNode) => void;
  /** When given, text elements become editable in place. `path` is read by lib/inline-edit. */
  onEditText?: (id: string, path: string, value: string) => void;
}

const FLAG: Record<string, string> = {
  Italy: "🇮🇹", Germany: "🇩🇪", France: "🇫🇷", "United Kingdom": "🇬🇧", Spain: "🇪🇸",
  Netherlands: "🇳🇱", Poland: "🇵🇱", Ireland: "🇮🇪", Milan: "🇮🇹", Rome: "🇮🇹", Turin: "🇮🇹", Bologna: "🇮🇹"
};

const pad = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) && String(v ?? "").length ? n : d; };
const bgClass = (v: string) => (v === "soft" ? "wb-bg-soft" : v === "brand" ? "wb-bg-brand" : v === "dark" ? "wb-bg-dark" : "wb-bg-white");

type Bits = { node: BlockNode; ctx: RenderCtx };

/* An element is editable only when the text on screen IS the stored text at its path. That keeps
   the mapping honest: a derived label is never mapped to a field it does not come from. */
function EditableEl({ id, el, path, text, as, className, ctx }: {
  id: string; el: string; path: string; text: string; as: string; className: string; ctx: RenderCtx;
}) {
  const T = as as any;
  const commit = (node: HTMLElement) => {
    const v = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (v && v !== text) ctx.onEditText?.(id, path, v);
    else node.textContent = text; // empty or unchanged: show the stored value again
  };
  return (
    <T data-el={el} className={`wb-el wb-el-edit ${className}`} contentEditable suppressContentEditableWarning
      spellCheck={false} title="Click to edit"
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); ctx.onSelect(id); ctx.onSelectEl(id, topKey(path)); }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        // stop the wrapper's Enter/Space handler, or typing a space would select the block instead
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { e.currentTarget.textContent = text; e.currentTarget.blur(); }
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => commit(e.currentTarget)}>
      {text}
    </T>
  );
}

/** A piece of text. `path` names where it is stored (see lib/inline-edit); it defaults to `el`. */
function El({ node, el, children, ctx, as = "span", className = "", path }: {
  node: BlockNode; el: string; children: React.ReactNode; ctx: RenderCtx;
  as?: string; className?: string; path?: string;
}) {
  const at = path ?? el;
  if (ctx.onEditText && typeof children === "string" && readPath(node.props, at) === children) {
    return <EditableEl id={node.id} el={el} path={at} text={children} as={as} className={className} ctx={ctx} />;
  }
  const T = as as any;
  return (
    <T data-el={el} className={`wb-el ${className}`}
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); ctx.onSelect(node.id); ctx.onSelectEl(node.id, topKey(at)); }}>
      {children}
    </T>
  );
}

const linkText = (l: any): string => {
  if (!l) return "";
  if (l.kind === "page") return l.path || "Choose a page";
  if (l.kind === "asset") return l.path || "Choose an asset";
  return l.url || "Set a link";
};

/* ---------- generic style wrapper ---------- */
function Shell({ node, children, extra = "", inner = "" }: { node: BlockNode; children: React.ReactNode; extra?: string; inner?: string }) {
  const s = node.style ?? {};
  const bg = (s.bg ?? defaultBg[node.type] ?? "surface") as string;
  const align = (s.align ?? "left") as string;
  return (
    <section
      className={`wb-blk wb-${node.type} ${bgClass(bg)} wb-align-${align} ${extra}`}
      data-block-id={node.id}
      style={{ paddingTop: pad(s.padTop, defaultPad[node.type] ?? 48), paddingBottom: pad(s.padBottom, defaultPad[node.type] ?? 48) }}
    >
      <div className={`wb-wrap ${inner}`}>{children}</div>
    </section>
  );
}

const defaultPad: Record<string, number> = {
  hero: 80, heading: 48, text: 16, list: 16, table: 24, quote: 32, featureGrid: 48, pricing: 48,
  testimonials: 48, faq: 48, image: 24, video: 32, button: 16, alert: 16, container: 24, columns: 24,
  divider: 0, form: 48, ctaSection: 64, footer: 48
};
const defaultBg: Record<string, string> = {
  hero: "soft", heading: "surface", quote: "soft", featureGrid: "surface", pricing: "soft", faq: "soft",
  form: "soft", ctaSection: "brand", footer: "dark", container: "surface", columns: "surface"
};

/* ---------- blocks ---------- */
function Hero({ node, ctx }: Bits) {
  const p = node.props;
  const s = node.style ?? {};
  const variant = node.variant ?? "split";
  const img = p.media ? imageFor(p.media) : "";
  const tall = s.height === "tall" ? "wb-hero-tall" : s.height === "short" ? "wb-hero-short" : "";
  const flipped = s.mediaSide === "left" ? "wb-hero-flip" : "";

  if (variant === "overlay" && img) {
    return (
      <Shell node={node} extra={`wb-hero-overlay ${tall}`}>
        <div className="wb-hero-ov-media" style={{ backgroundImage: `url(${img})` }} />
        <div className="wb-hero-ov-body">
          <El node={node} el="eyebrow" className="wb-eyebrow wb-eyebrow-light" ctx={ctx}>{p.eyebrow}</El>
          <El node={node} el="heading" as="h1" className="wb-h1 wb-ink-light" ctx={ctx}>{p.heading}</El>
          {p.description && <El node={node} el="description" as="p" className="wb-lead wb-lead-light" ctx={ctx}>{p.description}</El>}
          <HeroButtons node={node} ctx={ctx} />
        </div>
      </Shell>
    );
  }

  const centered = variant === "centered" || variant === "minimal" || !img;
  return (
    <Shell node={node} extra={`${tall} ${centered ? "wb-hero-centred" : ""} ${flipped}`}>
      <div className={`wb-hero-grid ${centered ? "is-centred" : ""}`}>
        <div className="wb-hero-copy">
          {p.eyebrow && <El node={node} el="eyebrow" className="wb-eyebrow" ctx={ctx}>{p.eyebrow}</El>}
          <El node={node} el="heading" as="h1" className={`wb-h1 ${centered ? "wb-h1-centred" : ""}`} ctx={ctx}>{p.heading}</El>
          {p.description && <El node={node} el="description" as="p" className="wb-lead" ctx={ctx}>{p.description}</El>}
          <HeroButtons node={node} ctx={ctx} />
        </div>
        {img && !centered && (
          <div className="wb-hero-media"><img src={img} alt={p.heading ?? ""} draggable={false} /></div>
        )}
      </div>
    </Shell>
  );
}

function HeroButtons({ node, ctx }: Bits) {
  const p = node.props;
  const anchor = (key: string, defEl: string) => {
    // a link is edited as the text it shows (a /page path or a URL); the commit turns it back into a link
    if (ctx.onEditText) {
      return <EditableEl id={node.id} el={key} path={key} text={linkText(p[key])} as="span" className="" ctx={ctx} />;
    }
    return (
      <span className="wb-el" data-el={defEl} onClick={(e) => { e.stopPropagation(); ctx.onSelectEl(node.id, defEl); }}
        role="presentation">{linkText(p[key])}</span>
    );
  };
  return (
    <div className={`wb-hero-actions ${ctx.selId === node.id ? "is-sel" : ""}`}>
      {p.primaryLabel && (
        <span className="wb-btn wb-btn-primary" role="button" tabIndex={-1}>
          <El node={node} el="primaryLabel" ctx={ctx}>{p.primaryLabel}</El>
          <Icon name="arrowRight" size={16} />
          <i className="wb-el-link" aria-hidden>{anchor("primaryHref", "primaryHref")}</i>
        </span>
      )}
      {p.secondaryLabel && (
        <span className="wb-btn wb-btn-secondary" role="button" tabIndex={-1}>
          <El node={node} el="secondaryLabel" ctx={ctx}>{p.secondaryLabel}</El>
          <i className="wb-el-link" aria-hidden>{anchor("secondaryHref", "secondaryHref")}</i>
        </span>
      )}
    </div>
  );
}

function FeatureGrid({ node, ctx }: Bits) {
  const p = node.props;
  const v = node.variant ?? "icons";
  const cols = Number(p.columns ?? 3);
  const items: any[] = Array.isArray(p.items) ? p.items : [];
  const isDark = (node.style?.bg ?? "surface") === "brand" || (node.style?.bg ?? "") === "dark";
  return (
    <Shell node={node}>
      {(p.title || p.subtitle) && v !== "stats" && (
        <div className="wb-sec-head">
          {p.title && <El node={node} el="title" as="h2" className="wb-h2" ctx={ctx}>{p.title}</El>}
          {p.subtitle && <El node={node} el="subtitle" as="p" className="wb-sub" ctx={ctx}>{p.subtitle}</El>}
        </div>
      )}
      <div className={`wb-grid wb-grid-${cols} ${isDark ? "on-dark" : ""} wb-fg-${v}`}>
        {items.map((it, i) => (
          <div className="wb-fg-item" key={i}>
            {v !== "media" && <div className="wb-fg-ico"><Icon name={it.icon || (v === "stats" ? "book" : "book")} size={v === "stats" ? 17 : 20} /></div>}
            {v === "media" && (
              <div className="wb-fg-media">
                {it.media ? <img src={imageFor(it.media)} alt={it.title ?? ""} draggable={false} />
                  : <span className="wb-fg-nomedia"><Icon name="image" size={18} /></span>}
                <span className="wb-fg-go"><Icon name="arrowUpRight" size={14} /></span>
              </div>
            )}
            <div className="wb-fg-text">
              {v === "stats" && <El node={node} el="title" path={`items.${i}.title`} as="div" className="wb-fg-stat" ctx={ctx}>{it.title}</El>}
              {v === "steps" && <div className="wb-step-no">Step {i + 1}</div>}
              {v === "media" && (
                <div className="wb-fg-meta"><span className="wb-fg-flag">{FLAG[String(it.title)] ?? "•"}</span><El node={node} el="title" path={`items.${i}.title`} as="span" className="wb-fg-country" ctx={ctx}>{it.title}</El><Icon name="arrowRight" size={13} /></div>
              )}
              {v === "stats" && <El node={node} el="text" path={`items.${i}.text`} as="div" className="wb-fg-title" ctx={ctx}>{it.text}</El>}
              {v !== "stats" && v !== "media" && <El node={node} el="title" path={`items.${i}.title`} as="div" className="wb-fg-title" ctx={ctx}>{it.title}</El>}
              {v !== "stats" && it.text && <El node={node} el="text" path={`items.${i}.text`} as="p" className="wb-fg-desc" ctx={ctx}>{it.text}</El>}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function TextBlock({ node, ctx }: Bits) {
  const body: string = node.props.body ?? "";
  const lines = body.split("\n");
  return (
    <Shell node={node} inner={node.style?.measure === "wide" ? "" : "wb-narrow"}>
      <div className={`wb-prose ${node.props.rich ? "is-rich" : ""}`}>
        {lines.map((ln, i) => {
          if (node.props.rich && ln.trim().startsWith("- "))
            return <p className="wb-li" key={i}><span className="wb-li-dot"><Icon name="check" size={12} /></span><El node={node} el="body" path={`body#${i}`} ctx={ctx}>{ln.slice(2)}</El></p>;
          return <p key={i}><El node={node} el="body" path={`body#${i}`} ctx={ctx}>{ln}</El></p>;
        })}
      </div>
    </Shell>
  );
}

function ListBlock({ node, ctx }: Bits) {
  const items: any[] = node.props.items ?? [];
  return (
    <Shell node={node} inner="wb-narrow">
      <ul className={`wb-list wb-list-${node.props.marker ?? "dot"}`}>
        {items.map((it, i) => (
          <li key={i}>
            <span className="wb-list-mark">{node.props.marker === "number" ? i + 1 : <Icon name="check" size={12} />}</span>
            <El node={node} el="items" path={`items.${i}.text`} ctx={ctx}>{it.text}</El>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function TableBlock({ node, ctx }: Bits) {
  const rows: any[] = node.props.rows ?? [];
  const head: string[] = node.props.head ?? ["Column 1", "Column 2", "Column 3"];
  const cols = Number(node.props.headers ?? 3);
  return (
    <Shell node={node}>
      <div className="wb-table">
        <div className="wb-tr wb-th">
          {head.slice(0, cols).map((h, i) => <El node={node} el="head" path={`head.${i}`} as="div" className="wb-td" key={i} ctx={ctx}>{h}</El>)}
        </div>
        {rows.map((r, i) => (
          <div className="wb-tr" key={i}>
            <El node={node} el="a" path={`rows.${i}.a`} as="div" className="wb-td" ctx={ctx}>{r.a}</El>
            {cols > 1 && <El node={node} el="b" path={`rows.${i}.b`} as="div" className="wb-td" ctx={ctx}>{r.b}</El>}
            {cols > 2 && <El node={node} el="c" path={`rows.${i}.c`} as="div" className="wb-td" ctx={ctx}>{r.c}</El>}
          </div>
        ))}
        {!rows.length && <div className="wb-tr"><div className="wb-td wb-empty">No rows yet — add one in the inspector.</div></div>}
      </div>
    </Shell>
  );
}

function Quote({ node, ctx }: Bits) {
  return (
    <Shell node={node}>
      <blockquote className="wb-quote">
        <span className="wb-quote-mark">“</span>
        <El node={node} el="text" as="p" className="wb-quote-text" ctx={ctx}>{node.props.text}</El>
        <footer className="wb-quote-by">
          <El node={node} el="author" as="span" className="wb-quote-name" ctx={ctx}>{node.props.author}</El>
          {node.props.role && <El node={node} el="role" as="span" className="wb-quote-role" ctx={ctx}>{node.props.role}</El>}
        </footer>
      </blockquote>
    </Shell>
  );
}

function ImageBlock({ node, ctx }: Bits) {
  const ratio = node.props.ratio ?? node.style?.ratio ?? "16:9";
  const src = node.props.media ? imageFor(node.props.media) : "";
  return (
    <Shell node={node}>
      <figure className="wb-figure">
        {src ? <img src={src} alt={node.props.alt ?? ""} style={{ aspectRatio: ratio.replace(":", "/"), borderRadius: pad(node.style?.radius, 12) }} draggable={false} />
          : <div className="wb-img-missing" style={{ aspectRatio: ratio.replace(":", "/") }}><Icon name="image" size={20} /><span>No image selected</span></div>}
        {node.props.caption && <figcaption><El node={node} el="caption" ctx={ctx}>{node.props.caption}</El></figcaption>}
        {!node.props.alt && <span className="wb-img-warn"><Icon name="alert" size={11} /> Missing alt text</span>}
      </figure>
    </Shell>
  );
}

function VideoBlock({ node, ctx }: Bits) {
  const src = node.props.media ? imageFor(node.props.media) : "";
  return (
    <Shell node={node}>
      <div className="wb-video">
        {src ? <img src={src} alt="" draggable={false} /> : <div className="wb-img-missing" />}
        <span className="wb-video-play"><Icon name="play" size={22} /></span>
        {!node.props.url && <span className="wb-video-note">No video URL yet</span>}
      </div>
      {node.props.caption && <El node={node} el="caption" as="div" className="wb-caption" ctx={ctx}>{node.props.caption}</El>}
    </Shell>
  );
}

function ButtonBlock({ node, ctx }: Bits) {
  const v = node.props.variant ?? "primary";
  return (
    <Shell node={node}>
      <span className={`wb-btn wb-btn-${v} ${node.props.size === "lg" ? "wb-btn-lg" : ""}`} role="button" tabIndex={-1}>
        <El node={node} el="label" ctx={ctx}>{node.props.label}</El>
        <Icon name="arrowRight" size={15} />
      </span>
    </Shell>
  );
}

function AlertBlock({ node, ctx }: Bits) {
  const tone = node.props.tone ?? "info";
  return (
    <Shell node={node}>
      <div className={`wb-alert wb-alert-${tone}`}>
        <span className="wb-alert-ico"><Icon name={tone === "danger" || tone === "warn" ? "alert" : tone === "success" ? "check" : "info"} size={16} /></span>
        <div>
          <El node={node} el="title" as="div" className="wb-alert-title" ctx={ctx}>{node.props.title}</El>
          {node.props.text && <p className="wb-alert-text"><El node={node} el="text" ctx={ctx}>{node.props.text}</El></p>}
        </div>
      </div>
    </Shell>
  );
}

function Pricing({ node, ctx }: Bits) {
  const tiers: any[] = node.props.tiers ?? [];
  return (
    <Shell node={node}>
      {node.props.title && <div className="wb-sec-head"><El node={node} el="title" as="h2" className="wb-h2" ctx={ctx}>{node.props.title}</El></div>}
      <div className={`wb-grid wb-grid-${Math.min(3, Math.max(2, tiers.length))} wb-pricing`}>
        {tiers.map((t, i) => (
          <div className={`wb-tier ${i === 0 ? "is-featured" : ""}`} key={i}>
            <El node={node} el="name" path={`tiers.${i}.name`} as="div" className="wb-tier-name" ctx={ctx}>{t.name}</El>
            <div className="wb-tier-price"><El node={node} el="price" path={`tiers.${i}.price`} ctx={ctx}>{t.price}</El><span>{t.period ? " / " : ""}{t.period ? <El node={node} el="period" path={`tiers.${i}.period`} ctx={ctx}>{t.period}</El> : null}</span></div>
            <ul className="wb-tier-list">
              {String(t.features ?? "").split(",").map((f, k) => [f, k] as const).filter(([f]) => f.trim()).map(([f, k]) => (
                <li key={k}><Icon name="check" size={13} /> <El node={node} el="features" path={`tiers.${i}.features@${k}`} as="span" ctx={ctx}>{f.trim()}</El></li>
              ))}
            </ul>
            <span className={`wb-btn ${i === 0 ? "wb-btn-primary" : "wb-btn-secondary"} wb-btn-full`}><El node={node} el="cta" path={`tiers.${i}.cta`} ctx={ctx}>{t.cta}</El></span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Testimonials({ node, ctx }: Bits) {
  const items: any[] = node.props.items ?? [];
  return (
    <Shell node={node}>
      {node.props.title && <div className="wb-sec-head"><El node={node} el="title" as="h2" className="wb-h2" ctx={ctx}>{node.props.title}</El></div>}
      <div className={`wb-grid wb-grid-${Math.min(3, Math.max(1, items.length))}`}>
        {items.map((t, i) => (
          <div className="wb-quote-card" key={i}>
            <div className="wb-stars" aria-label={`${t.rating} out of 5`}>
              {Array.from({ length: Number(t.rating ?? 5) }).map((_, k) => <Icon key={k} name="star" size={12} />)}
            </div>
            <El node={node} el="quote" path={`items.${i}.quote`} as="p" className="wb-quote-card-text" ctx={ctx}>{t.quote}</El>
            <div className="wb-quote-card-by">
              <span className="wb-avatar">{(t.name ?? "?").slice(0, 1)}</span>
              <span>
                <El node={node} el="name" path={`items.${i}.name`} as="b" ctx={ctx}>{t.name}</El>
                <El node={node} el="role" path={`items.${i}.role`} as="i" ctx={ctx}>{t.role}</El>
              </span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Faq({ node, ctx }: Bits) {
  const items: any[] = node.props.items ?? [];
  return (
    <Shell node={node} inner="wb-narrow">
      {node.props.title && <El node={node} el="title" as="h2" className="wb-h2 wb-faq-title" ctx={ctx}>{node.props.title}</El>}
      <div className="wb-faq">
        {items.map((f, i) => (
          <div className={`wb-faq-row ${i === 0 ? "is-open" : ""}`} key={i}>
            <div className="wb-faq-q"><El node={node} el="q" path={`items.${i}.q`} ctx={ctx}>{f.q}</El><Icon name="chevDown" size={14} /></div>
            {i === 0 && <El node={node} el="a" path={`items.${i}.a`} as="p" className="wb-faq-a" ctx={ctx}>{f.a}</El>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function ContainerBlock({ node, ctx }: Bits) {
  const kids = node.children ?? [];
  return (
    <Shell node={node} extra="wb-container" inner="wb-container-in">
      <div className="wb-container-box" style={{ borderRadius: pad(node.style?.radius, 16) }}>
        {kids.length ? kids.map((k) => <Node key={k.id} node={k} ctx={ctx} />) : (
          <div className="wb-drop-empty" data-empty-slot={node.id}><Icon name="plus" size={14} /> Drop a block here</div>
        )}
      </div>
    </Shell>
  );
}

function ColumnsBlock({ node, ctx }: Bits) {
  const kids = node.children ?? [];
  const n = Number(node.props.count ?? 2);
  const buckets: BlockNode[][] = Array.from({ length: n }, () => []);
  kids.forEach((k, i) => buckets[i % n].push(k));
  return (
    <Shell node={node} extra="wb-columns">
      <div className={`wb-colgrid wb-grid-${n}`}>
        {buckets.map((b, i) => (
          <div className="wb-col" key={i} data-empty-slot={`${node.id}:${i}`}>
            {b.length ? b.map((k) => <Node key={k.id} node={k} ctx={ctx} />) : <div className="wb-drop-empty"><Icon name="plus" size={14} /> Column {i + 1}</div>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function DividerBlock({ node }: Bits) {
  if ((node.props.kind ?? node.variant) === "space") {
    return <div className="wb-blk wb-divider" data-block-id={node.id}><div className="wb-space" style={{ height: pad(node.props.height, 32) }}><span className="wb-space-tag">Spacer · {pad(node.props.height, 32)}px</span></div></div>;
  }
  return (
    <section className="wb-blk wb-divider" data-block-id={node.id} style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="wb-wrap"><hr className="wb-hr" /></div>
    </section>
  );
}

function FormBlock({ node, ctx }: Bits) {
  const form = node.props.formId;
  const fields = form ? ["Full name", "Email address", "Phone number", "Target country"] : [];
  return (
    <Shell node={node} extra="wb-form-blk">
      <div className="wb-form-card">
        <div className="wb-form-copy">
          {node.props.title && <El node={node} el="title" as="h2" className="wb-h3" ctx={ctx}>{node.props.title}</El>}
          <p className="wb-sub">Fields come from Forms &amp; Leads — this block only embeds the published form.</p>
        </div>
        {form ? (
          <div className="wb-form-fields">
            {fields.map((f) => <label className="wb-fld" key={f}><span>{f}</span><i /></label>)}
            <label className="wb-fld wb-fld-tall"><span>Message</span><i /></label>
            <span className="wb-btn wb-btn-primary wb-btn-full"><El node={node} el="submitLabel" ctx={ctx}>{node.props.submitLabel}</El></span>
            {node.props.note && <El node={node} el="note" as="div" className="wb-form-note" ctx={ctx}>{node.props.note}</El>}
          </div>
        ) : (
          <div className="wb-form-empty">
            <Icon name="form" size={18} />
            <b>No form attached</b>
            <span>Pick a form in the inspector, or create one in Forms &amp; Leads.</span>
          </div>
        )}
      </div>
    </Shell>
  );
}

function CtaSection({ node, ctx }: Bits) {
  return (
    <Shell node={node} extra="wb-cta">
      <div className="wb-cta-body">
        {node.props.title && <El node={node} el="title" as="h2" className="wb-h2" ctx={ctx}>{node.props.title}</El>}
        {node.props.text && <El node={node} el="text" as="p" className="wb-cta-text" ctx={ctx}>{node.props.text}</El>}
        <div className="wb-hero-actions wb-centre">
          {node.props.primaryLabel && <span className="wb-btn wb-btn-primary wb-btn-lg"><El node={node} el="primaryLabel" ctx={ctx}>{node.props.primaryLabel}</El><Icon name="arrowRight" size={16} /></span>}
          {node.props.secondaryLabel && <span className="wb-btn wb-btn-ghost-light"><El node={node} el="secondaryLabel" ctx={ctx}>{node.props.secondaryLabel}</El></span>}
        </div>
      </div>
    </Shell>
  );
}

function FooterBlock({ node }: Bits) {
  /* Props come from the Global Footer variant (columns, note). With no props the footer
     is the original four-part footer, so the builder's own footer does not change. */
  const p = node.props as { columns?: number; note?: string; social?: boolean };
  const cols = Math.max(1, Math.min(4, Number(p.columns ?? 2)));
  const groups: [string, string[]][] = [
    ["Company", ["About us", "Careers", "Press"]],
    ["Study", ["Destinations", "Scholarships", "Intakes"]],
    ["Support", ["Contact", "Eligibility", "Help centre"]],
    ["Legal", ["Privacy", "Terms", "DPDP notice"]]
  ];
  const copy = `© 2026 EuroMiles Consultancy Pvt. Ltd.${p.note ? ` · ${p.note}` : ""}`;
  return (
    <section className="wb-blk wb-footer wb-bg-dark" data-block-id={node.id}>
      <div className="wb-wrap">
        {cols > 1 && (
          <div className="wb-foot-grid" style={{ gridTemplateColumns: `1.4fr ${Array.from({ length: cols - 1 }).map(() => "1fr").join(" ")}` }}>
            <div>
              <div className="wb-foot-brand">EuroMiles<span>.in</span></div>
              <p className="wb-foot-note">Study abroad guidance since 2011.</p>
            </div>
            {groups.slice(0, cols - 1).map(([h, links]) => (
              <div key={h}>
                <div className="wb-foot-h">{h}</div>
                {links.map((l) => <div className="wb-foot-l" key={l}>{l}</div>)}
              </div>
            ))}
          </div>
        )}
        {cols === 1 && <div className="wb-foot-brand" style={{ paddingBottom: 10 }}>EuroMiles<span>.in</span></div>}
        <div className="wb-foot-copy">{copy}</div>
      </div>
    </section>
  );
}

/* ---------- dispatcher ---------- */
export function Node({ node, ctx }: { node: BlockNode; ctx: RenderCtx }) {
  switch (node.type) {
    case "hero": return <Hero node={node} ctx={ctx} />;
    case "heading": {
      const p = node.props;
      return (
        <Shell node={node}>
          <div className="wb-sec-head">
            {p.eyebrow && <El node={node} el="eyebrow" className="wb-eyebrow" ctx={ctx}>{p.eyebrow}</El>}
            {p.text && <El node={node} el="text" as={p.level === "h3" ? "h3" : "h2"} className={p.level === "h3" ? "wb-h3" : "wb-h2"} ctx={ctx}>{p.text}</El>}
            {p.sub && <El node={node} el="sub" as="p" className="wb-sub" ctx={ctx}>{p.sub}</El>}
          </div>
        </Shell>
      );
    }
    case "text": return <TextBlock node={node} ctx={ctx} />;
    case "list": return <ListBlock node={node} ctx={ctx} />;
    case "table": return <TableBlock node={node} ctx={ctx} />;
    case "quote": return <Quote node={node} ctx={ctx} />;
    case "featureGrid": return <FeatureGrid node={node} ctx={ctx} />;
    case "pricing": return <Pricing node={node} ctx={ctx} />;
    case "testimonials": return <Testimonials node={node} ctx={ctx} />;
    case "faq": return <Faq node={node} ctx={ctx} />;
    case "image": return <ImageBlock node={node} ctx={ctx} />;
    case "video": return <VideoBlock node={node} ctx={ctx} />;
    case "button": return <ButtonBlock node={node} ctx={ctx} />;
    case "alert": return <AlertBlock node={node} ctx={ctx} />;
    case "container": return <ContainerBlock node={node} ctx={ctx} />;
    case "columns": return <ColumnsBlock node={node} ctx={ctx} />;
    case "divider": return <DividerBlock node={node} ctx={ctx} />;
    case "form": return <FormBlock node={node} ctx={ctx} />;
    case "ctaSection": return <CtaSection node={node} ctx={ctx} />;
    case "footer": return <FooterBlock node={node} ctx={ctx} />;
    default: return null;
  }
}
