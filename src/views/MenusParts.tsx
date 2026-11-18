/* Module 8 · small pieces used by the Menus screen: headings, KPIs, modals, tab strip, header/footer status. */
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Btn, Field, Modal, Pill } from "@/components/ui";
import type { SharedRegion } from "@/lib/layout-db";
import { LOC_LABEL, MenusAPI, type Audience, type Loc, type MenuItem, type MenuRec, type VersionRec } from "@/lib/menu-db";

export type Tab = "builder" | "manage" | "placements" | "mega" | "history" | "settings";
export type ModalState =
  | null
  | { kind: "create-menu" } | { kind: "create-mega" }
  | { kind: "delete-menu" } | { kind: "delete-mega"; megaId: string }
  | { kind: "changes" } | { kind: "validate" }
  | { kind: "apply"; loc: "header" | "footer" }
  | { kind: "rollback"; version: VersionRec };

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

export const menuChrome = (m: MenuRec, regions: SharedRegion[]): string => {
  if (!m.appliedTo) return "Not applied to header or footer";
  const r = regions.find((x) => x.id === m.appliedTo!.regionId);
  return r ? `Applied to ${m.appliedTo.variantName}` : "Variant removed";
};

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
        <p className="m8-desc">Create and manage website menus, build dropdowns and mega menus, assign them to the header or footer, and publish changes.</p>
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

export function ChromeLine({ menu, regions, usedIn }: { menu: MenuRec; regions: SharedRegion[]; usedIn: Loc | null }) {
  const st = MenusAPI.chromeStatus(menu, regions);
  const tone = st.state === "current" ? "green" : st.state === "stale" ? "amber" : st.state === "missing" ? "red" : "grey";
  const label =
    st.state === "none" ? (usedIn ? `Placed on ${LOC_LABEL[usedIn]}, not applied` : "Not placed")
      : st.state === "current" ? `In sync · ${st.variantName}`
      : st.state === "stale" ? `Out of date · ${st.variantName}`
      : `Missing · ${st.variantName}`;
  return <p><Pill tone={tone} dot>{label}</Pill> <span className="m8-hint">{st.detail}</span></p>;
}

export function ApplyList({ menu, loc, regions, busy, onApply }: {
  menu: MenuRec; loc: "header" | "footer"; regions: SharedRegion[]; busy: boolean; onApply: (variantId: string, regionId: string) => void;
}) {
  const targets = MenusAPI.chromeTargets(regions, loc);
  if (targets.length === 0) return <p className="m8-muted">There is no {loc} in the layouts yet.</p>;
  return (
    <ul className="m8-apply-list">
      {targets.map((t) => (
        <li key={t.variantId}>
          <div>
            <b>{t.name}</b>
            <span className="m8-hint">{t.note}</span>
            <small>Now shows: {loc === "header" ? (t.nav.join(" · ") || "nothing") : (t.groups.map((g) => g.title).join(" · ") || "nothing")}</small>
          </div>
          <Btn variant="primary" disabled={busy || menu.liveRev === 0} loading={busy} onClick={() => onApply(t.variantId, t.regionId)}>Apply</Btn>
        </li>
      ))}
    </ul>
  );
}

export function CreateMenuModal({ name, desc, setName, setDesc, onClose, onCreate }: {
  name: string; desc: string; setName: (s: string) => void; setDesc: (s: string) => void; onClose: () => void; onCreate: () => void;
}) {
  return (
    <Modal title="Create menu" sub="A menu is a tree of links. Place it in the header, the footer or a utility bar once it is ready." icon="menu" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!name.trim()} onClick={onCreate}>Create menu</Btn></>}>
      <Field label="Menu name"><input aria-label="New menu name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign navigation" autoFocus /></Field>
      <Field label="Description" hint="Shown in the menu list only"><input aria-label="New menu description" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
    </Modal>
  );
}

export function CreateMegaModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Create mega panel" sub="A panel with columns of links and an optional featured card." icon="columns" onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>Create panel</Btn></>}>
      <Field label="Panel name"><input aria-label="New panel name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Programs mega menu" autoFocus /></Field>
    </Modal>
  );
}
