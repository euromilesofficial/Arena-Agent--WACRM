/* ============================================================
   UI primitives — the shared vocabulary every screen uses
   ============================================================ */
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { prefersReducedMotion } from "@/lib/format";

export type Tone = "green" | "amber" | "red" | "violet" | "grey" | "blue";

export function Pill({ tone = "grey", children, dot, className, style }: {
  tone?: Tone; children: ReactNode; dot?: boolean; className?: string; style?: CSSProperties;
}) {
  return (
    <span className={`pill pill-${tone} ${className ?? ""}`} style={style}>
      {dot && <i className="pill-dot" />}
      {children}
    </span>
  );
}

type BtnVariant = "default" | "primary" | "danger" | "ghost" | "sm";
export function Btn({ variant = "default", icon, loading, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: string; loading?: boolean }) {
  const cls = ["btn", variant !== "default" ? `btn-${variant}` : "", className ?? ""].join(" ").trim();
  return (
    <button {...rest} className={cls} disabled={rest.disabled || loading}>
      {loading ? <span className="spinner" /> : icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={`spinner ${className ?? ""}`} />;
}

export function Skel({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`sk ${className ?? ""}`} style={style} aria-hidden />;
}

export function Tip({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  return <span className={`tip-wrap ${className ?? ""}`} data-tip={text}>{children }</span>;
}

/* ---------------- count up ---------------- */
export function CountUp({ value, decimals = 0, duration = 600, prefix = "", suffix = "" }: {
  value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const text = decimals ? shown.toFixed(decimals) : Math.round(shown).toLocaleString("en-US");
  return <>{prefix}{text}{suffix}</>;
}

/* ---------------- popover / dropdown ----------------
   Anchored, viewport-aware, keyboard-driven. The inline `right:auto` is
   load-bearing: the legacy `.dropdown` rule carries `right:0`, and a fixed box
   with both `left` and `right` set and no width stretches to full viewport. */
interface PopCtx { close: () => void }
export function Popover({ anchor, open, onClose, align = "right", role = "menu", children, className, labelledBy }: {
  anchor: HTMLElement | null; open: boolean; onClose: () => void; align?: "left" | "right";
  role?: "menu" | "listbox" | "dialog"; labelledBy?: string;
  children: ReactNode | ((c: PopCtx) => ReactNode); className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, origin: "top right", ready: false });

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const node = ref.current;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    let left = align === "left" ? r.left : r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    let origin = align === "left" ? "top left" : "top right";
    if (top + h > window.innerHeight - 8) { top = Math.max(8, r.top - h - 6); origin = origin.replace("top", "bottom"); }
    setPos({ left, top, origin, ready: true });
  }, [open, anchor, align]);

  // focus management: land on the first item, restore to the trigger on close
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const trigger = anchor;
    const first = node?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled]),[role="option"]:not([aria-disabled="true"]),input,button:not([disabled])');
    window.setTimeout(() => first?.focus({ preventScroll: true }), 20);
    return () => { trigger?.focus({ preventScroll: true }); };
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (anchor?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      const node = ref.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]),[role="option"]:not([aria-disabled="true"])'));
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1 + items.length) % items.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === "Tab") { onClose(); }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchor, onClose]);

  if (!open) return null;
  return createPortal(
    <div ref={ref} role={role} aria-labelledby={labelledBy}
      className={`dropdown ${align === "left" ? "left" : ""} ${className ?? ""}`}
      style={{
        position: "fixed", left: pos.left, right: "auto", top: pos.top,
        transformOrigin: pos.origin, opacity: 1, visibility: pos.ready ? "visible" : "hidden"
      }}>
      {typeof children === "function" ? children({ close: onClose }) : children}
    </div>,
    document.body
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>;
}

export function MenuItem({ icon, children, meta, selected, danger, disabled, onClick }: {
  icon?: string; children: ReactNode; meta?: ReactNode; selected?: boolean; danger?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button role="menuitem" type="button" tabIndex={-1} aria-disabled={disabled || undefined}
      className={`menu-item ${selected ? "selected" : ""} ${danger ? "danger" : ""}`} disabled={disabled} onClick={onClick}>
      {icon && <Icon name={icon} size={13} />}
      <span style={{ minWidth: 0 }}>{children}</span>
      {meta !== undefined ? <span className="mi-meta">{meta}</span> : selected ? <span className="check"><Icon name="check" size={13} /></span> : null}
    </button>
  );
}

/* ---------------- modal + drawer ---------------- */
function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [active, onClose]);
}

/** Focus containment for dialogs: focus in on mount, trap Tab, restore on close. */
function useDialogFocus(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const restore = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const first = node?.querySelector<HTMLElement>(sel);
    window.setTimeout(() => (first ?? node)?.focus({ preventScroll: true }), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(sel)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restore?.focus?.({ preventScroll: true });
    };
  }, [active]);
  return ref;
}

export function Modal({ title, sub, icon, footer, width, onClose, children }: {
  title: ReactNode; sub?: ReactNode; icon?: string; footer?: ReactNode;
  width?: "narrow" | "wide"; onClose: () => void; children: ReactNode;
}) {
  useEscape(true, onClose);
  const panelRef = useDialogFocus(true);
  return createPortal(
    <>
      <div className="overlay" style={{ zIndex: 200 }} onClick={onClose} />
      <div ref={panelRef} className={`modal ${width ?? ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <div className="modal-head">
          {icon && <div className="kpi-ico violet" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name={icon} size={17} /></div>}
          <div className="grow">
            <div className="modal-title">{title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

export function Drawer({ title, sub, icon, footer, onClose, children }: {
  title: ReactNode; sub?: ReactNode; icon?: string; footer?: ReactNode; onClose: () => void; children: ReactNode;
}) {
  useEscape(true, onClose);
  const panelRef = useDialogFocus(true);
  return createPortal(
    <>
      <div className="overlay" style={{ zIndex: 200 }} onClick={onClose} />
      <div ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <div className="drawer-head">
          {icon && <div className="kpi-ico violet" style={{ width: 28, height: 28 }}><Icon name={icon} size={15} /></div>}
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.02em" }}>{title}</div>
            {sub && <div className="f11 muted truncate">{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

/* ---------------- toasts ---------------- */
const TONE_ICON: Record<string, string> = { success: "check", info: "info", warn: "alert", error: "x" };
export function Toasts({ items, onDismiss }: { items: { id: number; type: string; title: string; sub?: string; action?: { label: string; onClick: () => void } }[]; onDismiss: (id: number) => void }) {
  return createPortal(
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={`toast t-${t.type}`} role="status">
          <div className="t-ico"><Icon name={TONE_ICON[t.type] ?? "check"} size={13} /></div>
          <div className="grow">
            <div className="t-title">{t.title}</div>
            {t.sub && <div className="t-sub">{t.sub}</div>}
            {t.action && (
              <button className="link" style={{ marginTop: 5, color: "#B9A5FF" }}
                onClick={() => { t.action?.onClick(); onDismiss(t.id); }}>
                {t.action.label} <Icon name="arrowRight" size={11} />
              </button>
            )}
          </div>
          <button className="t-x" aria-label="Dismiss" onClick={() => onDismiss(t.id)}><Icon name="x" size={12} /></button>
          <i className="t-bar" />
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ---------------- misc blocks ---------------- */
export function EmptyState({ icon, title, desc, action }: { icon: string; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="mod-icon" style={{ margin: "0 auto 10px", width: 38, height: 38, borderRadius: 11 }}><Icon name={icon} size={18} /></div>
      <div className="w700 f13">{title}</div>
      <div className="f12 muted mt4">{desc}</div>
      {action && <div className="mt12">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "We couldn’t load your dashboard", desc, onRetry }: { title?: string; desc: string; onRetry: () => void }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 12, borderColor: "#F6C9C4", background: "linear-gradient(100deg,#FEF1F0,#fff)" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEE4E2", color: "#B42318", display: "grid", placeItems: "center" }}>
        <Icon name="alert" size={18} />
      </div>
      <div className="grow">
        <div className="w700 f13" style={{ color: "#912018" }}>{title}</div>
        <div className="f12 muted">{desc}</div>
      </div>
      <Btn onClick={onRetry} icon="refresh">Retry</Btn>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="hint err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

/** Small helper for one-off async button states. */
export function useAsync<T>() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try { return await fn(); } finally { setBusy(false); }
  }, []);
  return { busy, run };
}
