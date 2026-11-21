import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MegaPanelView } from "@/components/menus/MenuParts";
import type { MenuTree, MenuTreeNode } from "@/lib/layout-db";
import type { MenuStyle } from "@/lib/menu-db";
import type { ThemeTokens } from "@/lib/theme-db";
import { styleOf } from "@/lib/menu-db";

/**
 * The live header's navigation, drawn from the menu tree stored on the header variant.
 * Dropdowns open on hover or focus and on click, and mega panels reuse the editor's panel view,
 * so the layout preview and the live site show the same menu.
 */
export function ChromeNav({ tree, tokens, menuStyle, label }: { tree: MenuTree; tokens: ThemeTokens; menuStyle?: MenuStyle; label: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const st = styleOf({ style: menuStyle });
  return (
    <nav aria-label={label} className={`m8-chrome m8-preset-${st.preset} m8-hover-${st.hoverFx}`}>
      <ul className="m8-chrome-top">
        {tree.items.map((n) => (
          <Item key={n.id} node={n} tokens={tokens} open={openId === n.id}
            onOpen={(v) => setOpenId(v ? n.id : null)} />
        ))}
      </ul>
    </nav>
  );
}

function Item({ node, tokens, open, onOpen }: { node: MenuTreeNode; tokens: ThemeTokens; open: boolean; onOpen: (v: boolean) => void }) {
  const hasSub = node.behaviour !== "link" && (node.children.length > 0 || node.behaviour === "mega");
  if (!hasSub) {
    return <li><span className="m8-chrome-link">{node.label || "Untitled"}</span></li>;
  }
  return (
    <li className="m8-chrome-has" onMouseEnter={() => onOpen(true)} onMouseLeave={() => onOpen(false)}>
      <button type="button" className="m8-chrome-link" aria-expanded={open} aria-haspopup="true"
        onClick={() => onOpen(!open)} onKeyDown={(e) => { if (e.key === "Escape") onOpen(false); }}>
        {node.icon && <Icon name={node.icon} size={12} />}{node.label || "Untitled"} <Icon name={open ? "chevUp" : "chevDown"} size={11} />
      </button>
      {open && node.behaviour === "mega" && node.mega && (
        <div className="m8-chrome-panel"><MegaPanelView mega={node.mega} pages={[]} tokens={tokens} /></div>
      )}
      {open && node.behaviour !== "mega" && node.children.length > 0 && (
        <ul className="m8-chrome-drop">
          {node.children.map((c) => (
            <li key={c.id}><span className="m8-chrome-link">{c.icon && <Icon name={c.icon} size={11} />}{c.label}</span>
              {c.description && <small className="m8-link-desc">{c.description}</small>}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
