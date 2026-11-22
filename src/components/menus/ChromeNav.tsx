import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MegaPanelView, MenuLink } from "@/components/menus/MenuParts";
import type { MenuTree, MenuTreeNode } from "@/lib/layout-db";
import { hrefOf, styleOf, type MenuStyle, type PageLike } from "@/lib/menu-db";
import type { ThemeTokens } from "@/lib/theme-db";

/**
 * The live header's navigation, drawn from the menu tree stored on the header variant.
 * Links are real anchors: each typed link is resolved against the page paths stored with the tree.
 * Dropdowns open on hover or focus and on click, and mega panels reuse the editor's panel view,
 * so the layout preview and the live site show the same menu.
 */
export function ChromeNav({ tree, tokens, menuStyle, label }: { tree: MenuTree; tokens: ThemeTokens; menuStyle?: MenuStyle; label: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const st = styleOf({ style: menuStyle });
  const pages = (tree.pages ?? []) as PageLike[];
  return (
    <nav aria-label={label} className={`m8-chrome m8-preset-${st.preset} m8-hover-${st.hoverFx}`}>
      <ul className="m8-chrome-top">
        {tree.items.map((n) => (
          <Item key={n.id} node={n} tokens={tokens} pages={pages} open={openId === n.id}
            onOpen={(v) => setOpenId(v ? n.id : null)} />
        ))}
      </ul>
    </nav>
  );
}

function Item({ node, tokens, pages, open, onOpen }: { node: MenuTreeNode; tokens: ThemeTokens; pages: PageLike[]; open: boolean; onOpen: (v: boolean) => void }) {
  const hasSub = node.behaviour !== "link" && (node.children.length > 0 || node.behaviour === "mega");
  if (!hasSub) {
    return (
      <li>
        <MenuLink className="m8-chrome-link" href={hrefOf(node.link, pages)} newTab={node.newTab}>{node.icon && <Icon name={node.icon} size={12} />}{node.label || "Untitled"}</MenuLink>
      </li>
    );
  }
  return (
    <li className="m8-chrome-has" onMouseEnter={() => onOpen(true)} onMouseLeave={() => onOpen(false)}>
      <button type="button" className="m8-chrome-link" aria-expanded={open} aria-haspopup="true"
        onClick={() => onOpen(!open)} onKeyDown={(e) => { if (e.key === "Escape") onOpen(false); }}>
        {node.icon && <Icon name={node.icon} size={12} />}{node.label || "Untitled"} <Icon name={open ? "chevUp" : "chevDown"} size={11} />
      </button>
      {open && node.behaviour === "mega" && node.mega && (
        <div className="m8-chrome-panel"><MegaPanelView mega={node.mega} pages={pages} tokens={tokens} /></div>
      )}
      {open && node.behaviour !== "mega" && node.children.length > 0 && (
        <ul className="m8-chrome-drop">
          {node.children.map((c) => (
            <li key={c.id}>
              <MenuLink className="m8-chrome-link" href={hrefOf(c.link, pages)} newTab={c.newTab}>{c.icon && <Icon name={c.icon} size={11} />}{c.label}</MenuLink>
              {c.description && <small className="m8-link-desc">{c.description}</small>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
