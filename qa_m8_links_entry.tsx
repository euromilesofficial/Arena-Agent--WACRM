// Test entry for qa_m8_links.py. Bundled by esbuild; renders real components to HTML and runs the real checks.
import { renderToStaticMarkup } from "react-dom/server";
import { ChromeNav } from "@/components/menus/ChromeNav";
import { hrefOf, checkMenu, checkMega, blankItem, type MenuItem, type MegaDoc } from "@/lib/menu-db";
import { themeFor } from "@/lib/theme-db";

const pages = [
  { id: "p_about", path: "/about", title: "About", status: "published" as const },
  { id: "p_old", path: "/old", title: "Old", status: "published" as const, trash: true },
];
const tokens = themeFor("site_main") ?? (themeFor as any)("x");
const item = (over: Partial<MenuItem>): MenuItem => ({ ...blankItem("Item"), ...over } as MenuItem);

const tree = {
  pages: pages.map((p) => ({ ...p, trash: !!p.trash })),
  items: [
    { id: "a", label: "About us", link: { kind: "page" as const, pageId: "p_about" }, newTab: false, behaviour: "link" as const, children: [], mega: null },
    { id: "b", label: "Docs", link: { kind: "url" as const, url: "https://example.com/docs" }, newTab: true, behaviour: "link" as const, children: [], mega: null },
    { id: "c", label: "Gone", link: { kind: "page" as const, pageId: "p_old" }, newTab: false, behaviour: "link" as const, children: [], mega: null },
    { id: "d", label: "Company", link: null, newTab: false, behaviour: "dropdown" as const, mega: null,
      children: [{ id: "d1", label: "Careers", link: { kind: "anchor" as const, anchor: "#careers" }, newTab: false, behaviour: "link" as const, children: [], mega: null }] },
  ],
};

const html = renderToStaticMarkup(<ChromeNav tree={tree as any} tokens={tokens as any} label="Header" />);

const doc = (items: MenuItem[]) => ({ name: "Main", items, style: undefined } as any);
const issues = (items: MenuItem[]) => checkMenu(doc(items), pages as any, []).map((i) => i.id);
const sev = (items: MenuItem[], id: string) => checkMenu(doc(items), pages as any, []).find((i) => i.id.endsWith(id))?.severity ?? null;

const out = {
  href_page: hrefOf({ kind: "page", pageId: "p_about" }, pages as any),
  href_url: hrefOf({ kind: "url", url: "https://example.com" }, pages as any),
  href_trashed: hrefOf({ kind: "page", pageId: "p_old" }, pages as any),
  href_none: hrefOf(null, pages as any),
  href_badurl: hrefOf({ kind: "url", url: "javascript:alert(1)" }, pages as any),
  html_about: html.includes('href="/about"'),
  html_docs_target: html.includes('href="https://example.com/docs" target="_blank" rel="noopener noreferrer"'),
  html_newtab_note: html.includes("(opens in new tab)"),
  html_gone_is_text: !html.includes('href="/old"') && html.includes("Gone"),
  html_no_javascript: !html.includes("javascript:"),
  generic_warn: sev([item({ id: "g1", label: "Click here", link: { kind: "url", url: "https://e.com" } })], "_generic"),
  nowords_error: sev([item({ id: "n1", label: "—", link: { kind: "url", url: "https://e.com" } })], "_nowords"),
  samelabel_warn: sev([
    item({ id: "s1", label: "Team", link: { kind: "url", url: "https://e.com/a" } }),
    item({ id: "s2", label: "team", link: { kind: "url", url: "https://e.com/b" } }),
  ], "s2_samelabel"),
  samelabel_other_level_ok: !issues([
    item({ id: "t1", label: "Team", link: { kind: "url", url: "https://e.com/a" }, children: [item({ id: "t3", label: "Team", link: { kind: "url", url: "https://e.com/c" } })] }),
  ]).some((x) => x.endsWith("_samelabel")),
  good_menu_clean: !issues([item({ id: "ok", label: "Contact us", link: { kind: "url", url: "https://e.com" } })]).some((x) => /_(generic|nowords|samelabel)$/.test(x)),
};
console.log(JSON.stringify(out));
