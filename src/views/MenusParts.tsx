/* Module 8 · shared pieces for the Menus screen: headings, KPIs, tabs, placement status, dialogs. */
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Field, Modal, Pill } from "@/components/ui";
import type { LayoutDraft, SharedRegion } from "@/lib/layout-db";
import { LOC_LABEL, MENU_TYPE_LABEL, MenusAPI, type Audience, type MenuRec, type MenuType, type Slot, type VersionRec, type MenuItem } from "@/lib/menu-db";

export type Tab = "builder" | "manage" | "placements" | "mega" | "history" | "settings";
export type ModalState =
  | null
  | { kind: "create-menu" } | { kind: "create-mega" }
  | { kind: "delete-menu" } | { kind: "delete-mega"; megaId: string }
  | { kind: "changes" } | { kind: "validate" }
  | { kind: "rollback"; version: VersionRec }
  | { kind: "remove-item"; itemId: string }
  | { kind: "unsaved"; next: string }
  | { kind: "dup-link"; pageIds: string[] }
  | { kind: "replace"; layoutId: string; slot: Slot; to: string };

export const AUD_LABEL: Record<Audience, string> = { everyone: "Everyone", members: "Members only", hidden: "Hidden" };

export const ago = (iso: string | null) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};
export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export const depthOfId = (items: MenuItem[], id: string, d = 0): number => {
  for (const it of items) {
    if (it.id === id) return d;
    const c = depthOfId(it.children, id, d + 1);
    if (c >= 0) return c;
  }
  return -1;
};

/** "Header · Default Website Layout" style labels for a menu's placements */
export const placeLabel = (layouts: LayoutDraft[], p: { layoutId: string; slot: Slot }) =>
  `${LOC_LABEL[p.slot]} · ${layouts.find((l) => l.id === p.layoutId)?.name ?? "Layout"}`;

export function renderTabs(tab: Tab, setTab: (t: Tab) => void): ReactNode {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: "builder", label: "Menu Builder", icon: "menu" },
    { id: "manage", label: "Manage Menus", icon: "list" },
    { id: "placements", label: "Menu Placements", icon: "target" },
    { id: "mega", label: "Mega Menus", icon: "columns" },
    { id: "history", label: "Version History", icon: "clock" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  return items.map((t) => (
    <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => setTab(t.id)}>
      <Icon name={t.icon} size={14} />{t.label}
    </button>
  ));
}

export function Head({ siteName }: { siteName: string }) {
  return (
    <div className="m8-head">
      <div>
        <h1 className="m8-title">Menus &amp; Navigation</h1>
        <p className="m8-desc">Build accessible navigation menus and responsive mega menus. Assign each menu to a layout slot, then publish.</p>
      </div>
      <div className="m8-head-r">
        <span className="m8-lbl">Website</span>
        <span className="m8-site"><Icon name="globe" size={13} /> {siteName}</span>
      </div>
    </div>
  );
}

export function Kpi({ icon, n, label, tone, onClick }: { icon: string; n: number; label: string; tone: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="m8-kpi-ic"><Icon name={icon} size={16} /></span>
      <span><b>{n}</b><small>{label}</small></span>
    </>
  );
  return onClick
    ? <button type="button" className={`m8-kpi tone-${tone}`} onClick={onClick}>{inner}</button>
    : <div className={`m8-kpi tone-${tone}`}>{inner}</div>;
}

export function Accordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="m8-acc">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? "chevDown" : "chevRight"} size={12} /> {title}
      </button>
      {open && <div className="m8-acc-body">{children}</div>}
    </div>
  );
}

/** Per placed slot: whether the layout shows the live menu (compiled on publish). */
export function ChromeList({ menu, regions, layouts, placed }: {
  menu: MenuRec; regions: SharedRegion[]; layouts: LayoutDraft[]; placed: { layoutId: string; slot: Slot }[];
}) {
  if (placed.length === 0) return <p className="m8-muted">Not placed in any layout yet. Assign it in Menu Placements.</p>;
  const st = MenusAPI.chromeStatus(menu, regions);
  return (
    <ul className="m8-chrome">
      {placed.map((p) => {
        const s = st.find((x) => x.layoutId === p.layoutId && x.slot === p.slot);
        const tone = !s ? "amber" : s.state === "current" ? "green" : s.state === "stale" ? "amber" : "red";
        const label = !s ? "Compiles on publish" : s.state === "current" ? "In sync" : s.state === "stale" ? "Out of date" : "Missing";
        return (
          <li key={`${p.layoutId}-${p.slot}`}>
            <span>{placeLabel(layouts, p)}</span>
            <Pill tone={tone} dot>{label}</Pill>
            {s && s.state !== "current" && <small>{s.detail}</small>}
          </li>
        );
      })}
    </ul>
  );
}

export function CreateMenuModal({ name, desc, type, setName, setDesc, setType, onClose, onCreate }: {
  name: string; desc: string; type: MenuType;
  setName: (s: string) => void; setDesc: (s: string) => void; setType: (t: MenuType) => void;
  onClose: () => void; onCreate: () => void;
}) {
  return (
    <Modal title="Create New Menu" sub="A menu is a tree of links. Assign it to a layout slot once it is ready." icon="menu" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!name.trim()} onClick={onCreate}>Create Menu</Btn></>}>
      <Field label="Menu Name *"><input aria-label="New menu name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Footer Navigation" autoFocus /></Field>
      <Field label="Menu Type">
        <select aria-label="Menu type" value={type} onChange={(e) => setType(e.target.value as MenuType)}>
          {(Object.keys(MENU_TYPE_LABEL) as MenuType[]).map((t) => <option key={t} value={t}>{MENU_TYPE_LABEL[t]}</option>)}
        </select>
      </Field>
      <Field label="Description" hint="Shown in the menu list only"><input aria-label="New menu description" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
    </Modal>
  );
}

export function CreateMegaModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Create Mega Menu" sub="A panel with columns of links and an optional featured card." icon="columns" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>Create panel</Btn></>}>
      <Field label="Panel name"><input aria-label="New panel name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Programs mega menu" autoFocus /></Field>
    </Modal>
  );
}
