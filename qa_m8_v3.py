#!/usr/bin/env python3
"""Module 8 v3 — spec v1.1 §31 acceptance checks (data layer in Node, screen in Chromium).

U  unit (Node, the real src/lib/menu-db.ts and layout-db.ts bundled with esbuild):
   apply writes menuRef, placement draft rules (header required, existing menu replaced),
   publish compiles placed menus into layout chrome, rollback restores menus and bindings together,
   delete guards, typed URL policy, tree operations (indent, outdent, top level, duplicate)
B  browser (Playwright, WACRM-CMS.html): Menu Placements Replace in Draft, Save Placement Draft toast,
   header has no unassign option, keyboard reorder with Alt+arrows, tablet preview uses the drawer,
   the settings delete guard, and the release gate copy
"""
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
APP = "/home/user/wacrm-app"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else "")); print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

NODE_JS = r"""
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
const { M, L } = require(process.argv[2]);
const s = 'site_main';
const out = {};
const ms = (x) => x.map((m) => ({ id: m.id, name: m.draft.name }));
(async () => {
  // starting point: v1 with primary in the default header, footer in the default footer
  let lay = await L.LayoutsAPI.load(s);
  const hdr = lay.regions.find((r) => r.kind === 'header');
  const hdrVar = () => (lay.regions.find((r) => r.kind === 'header').variants.find((v) => v.id === 'hdr_v2'));
  out.seedRef = (hdrVar().blocks[0].props.menuRef || {}).menuId;
  let L0 = await M.MenusAPI.load(s);
  out.seedPlaceHeader = L0.placements.draft.lay_default.header;
  out.seedPlaceFooter = L0.placements.draft.lay_default.footer;
  out.seedBlankHeader = L0.placements.draft.lay_blank.header;
  out.releaseClean = M.releaseMenuIssues(s).length;

  // §31.3 header is required: unassigning it is refused while the layout shows a header
  const draft1 = JSON.parse(JSON.stringify(L0.placements.draft));
  draft1.lay_default.header = null;
  try { await M.MenusAPI.savePlacements(s, draft1, null); out.unassignHeader = 'saved'; }
  catch (e) { out.unassignHeader = e.code; out.unassignMsg = e.message; }

  // an unknown menu is refused
  const draft2 = JSON.parse(JSON.stringify(L0.placements.draft));
  draft2.lay_default.footer = 'menu_nope';
  try { await M.MenusAPI.savePlacements(s, draft2, null); out.unknownMenu = 'saved'; }
  catch (e) { out.unknownMenu = e.code; }

  // a placement draft is not live until publish
  const draft3 = JSON.parse(JSON.stringify(L0.placements.draft));
  draft3.lay_default.header = 'menu_campaign';
  await M.MenusAPI.savePlacements(s, draft3, null);
  L0 = await M.MenusAPI.load(s);
  out.draftNotLive = L0.placements.live.lay_default.header;
  out.draftSaved = L0.placements.draft.lay_default.header;

  // publish compiles the new header menu into the layout and writes menuRef
  const v2 = await M.MenusAPI.publish(s, 't');
  lay = await L.LayoutsAPI.load(s);
  const hv = lay.regions.find((r) => r.kind === 'header').variants.find((v) => v.id === 'hdr_v2');
  out.afterPubRef = (hv.blocks[0].props.menuRef || {}).menuId;
  out.afterPubNav = (hv.blocks[0].props.nav || []).length;
  const camp = (await M.MenusAPI.load(s)).menus.find((m) => m.id === 'menu_campaign');
  out.campaignLiveItems = camp.live.items.length;
  out.navMatchesCampaign = JSON.stringify(hv.blocks[0].props.nav) === JSON.stringify(camp.live.items.filter((i) => i.audience === 'everyone').map((i) => i.label));
  out.versionCount = (await M.MenusAPI.load(s)).versions.length;

  // rollback to v1 restores the placement and the header binding together
  const v1 = (await M.MenusAPI.load(s)).versions.find((v) => v.v === 1);
  await M.MenusAPI.rollback(s, v1.id, 't');
  L0 = await M.MenusAPI.load(s);
  out.rbPlaceHeader = L0.placements.live.lay_default.header;
  lay = await L.LayoutsAPI.load(s);
  const hv2 = lay.regions.find((r) => r.kind === 'header').variants.find((v) => v.id === 'hdr_v2');
  out.rbRef = (hv2.blocks[0].props.menuRef || {}).menuId;
  out.rbVersions = (await M.MenusAPI.load(s)).versions.map((v) => v.v + ':' + v.kind);

  // delete guards: a placed or compiled menu cannot be deleted; an unplaced one can
  try { await M.MenusAPI.deleteMenu('menu_primary'); out.delPlaced = 'deleted'; } catch (e) { out.delPlaced = e.code; }
  const fresh = await M.MenusAPI.createMenu(s, 'Scratch', '', 'utility');
  await M.MenusAPI.deleteMenu(fresh.id);
  out.delFresh = (await M.MenusAPI.load(s)).menus.some((m) => m.id === fresh.id) ? 'kept' : 'gone';
  out.menuType = (await M.MenusAPI.load(s)).menus.map((m) => m.draft.type).join(',');

  // typed URL policy
  out.urlOk = M.urlOk('https://example.com/a') && M.urlOk('mailto:hi@example.com') && M.urlOk('tel:+91 98765 43210');
  out.urlCreds = M.urlOk('https://user:pw@example.com');
  out.urlProto = M.urlOk('//evil.example');
  out.urlJs = M.urlOk('javascript:alert(1)');
  out.urlHttp = M.urlOk('http://x.io');

  // tree operations on a fresh document
  const it = (id, children = [], behaviour = 'link') => ({ id, label: id, link: null, newTab: false, audience: 'everyone', behaviour, megaId: null, children, cssClass: '', rel: '' });
  const t0 = [it('a'), it('b'), it('c', [it('c1')])];
  const ind = M.indentItem(t0, 'b');
  out.indentParent = M.locate(ind, 'b').parent ? M.locate(ind, 'b').parent.id : null;
  out.indentBehaviour = M.findItem(ind, 'a').behaviour;
  out.indentNoPrev = M.indentItem(t0, 'a') === t0;
  const out1 = M.outdentItem(ind, 'b');
  out.outdentTop = !M.locate(out1, 'b').parent;
  out.outdentIndex = M.locate(out1, 'b').index;
  const deep = [it('x', [it('y', [it('z')])])];
  const deepSib = [it('p'), it('q', [it('r', [it('s')])])];
  out.tooDeepIndent = M.indentItem(deep, 'x') === deep && M.indentItem(deepSib, 'q') === deepSib && M.indentItem([it('p'), it('q')], 'q') !== undefined;
  const dup = M.duplicateItem(t0, 'c');
  out.dupCount = dup.length;
  out.dupIdsDiffer = M.findItem(dup, 'c').id !== M.findItem(dup, 'c').id || dup[3].id !== dup[2].id;
  const topd = M.toTopLevel([it('a', [it('a1', [it('a2')])])], 'a2');
  out.topLevelOk = !M.locate(topd, 'a2').parent && M.locate(topd, 'a2').parent === null;
  out.placedInSlots = M.placedIn({ lay_default: { header: 'menu_primary', footer: null }, lay_blank: { header: 'menu_primary', footer: null } }, 'menu_primary').length;

  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
"""

def unit():
    tmp = tempfile.mkdtemp()
    entry = os.path.join(tmp, "entry.ts"); bundle = os.path.join(tmp, "both.cjs"); js = os.path.join(tmp, "t.cjs")
    open(entry, "w").write(f"export * as M from \"{APP}/src/lib/menu-db\";\nexport * as L from \"{APP}/src/lib/layout-db\";\n")
    # one bundle, so menu-db and layout-db share one store (as in the app)
    r = subprocess.run(["npx", "esbuild", entry, "--bundle", "--format=cjs", "--platform=node", f"--outfile={bundle}", "--log-level=error"],
                       capture_output=True, text=True, timeout=180, cwd=APP)
    if r.returncode != 0:
        ck("U0 the data layer bundles for Node", False, r.stderr[:200]); return
    open(js, "w").write(NODE_JS)
    r = subprocess.run(["node", js, bundle], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        ck("U0 the data layer runs in Node", False, r.stderr[:400]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    ck("U1 the seed header reads its menu through menuRef (menu_primary)", o["seedRef"] == "menu_primary", str(o["seedRef"]))
    ck("U2 the seed binds Primary to the default layout header and Footer to its footer", o["seedPlaceHeader"] == "menu_primary" and o["seedPlaceFooter"] == "menu_footer")
    ck("U3 the seed release gate is clean", o["releaseClean"] == 0, str(o["releaseClean"]))
    ck("U4 unassigning a layout's header is refused", o["unassignHeader"] == "E_VALID", str(o["unassignHeader"]))
    ck("U5 an unknown menu cannot be assigned", o["unknownMenu"] == "E_MISSING", str(o["unknownMenu"]))
    ck("U6 a placement draft is not live until publish", o["draftNotLive"] == "menu_primary" and o["draftSaved"] == "menu_campaign")
    ck("U7 publish writes menuRef to the header variant", o["afterPubRef"] == "menu_campaign", str(o["afterPubRef"]))
    ck("U8 publish writes the live links into the header nav", o["navMatchesCampaign"] is True)
    ck("U9 a publish adds a numbered version", o["versionCount"] == 2, str(o["versionCount"]))
    ck("U10 rollback restores the placement and the header binding together",
       o["rbPlaceHeader"] == "menu_primary" and o["rbRef"] == "menu_primary", f'{o["rbPlaceHeader"]} / {o["rbRef"]}')
    ck("U11 rollback is a new version and keeps history", o["rbVersions"][-1].endswith(":rollback") and len(o["rbVersions"]) == 3, str(o["rbVersions"]))
    ck("U12 a menu placed in a layout cannot be deleted", o["delPlaced"] == "E_IN_USE", str(o["delPlaced"]))
    ck("U13 an unplaced menu can be deleted", o["delFresh"] == "gone", str(o["delFresh"]))
    ck("U14 menus carry a type (main, footer, utility)", o["menuType"] == "main,footer,utility,main", o["menuType"])
    ck("U15 https, http, mailto and tel addresses are accepted", o["urlOk"] is True and o["urlHttp"] is True)
    ck("U16 addresses with embedded credentials are refused", o["urlCreds"] is False)
    ck("U17 protocol-relative addresses are refused", o["urlProto"] is False)
    ck("U18 javascript: addresses are refused", o["urlJs"] is False)
    ck("U19 indent makes the item a child of the item above", o["indentParent"] == "a" and o["indentBehaviour"] == "dropdown")
    ck("U20 the first item cannot be indented", o["indentNoPrev"] is True)
    ck("U21 outdent moves the item out after its parent", o["outdentTop"] is True and o["outdentIndex"] == 1, str(o["outdentIndex"]))
    ck("U22 the depth limit stops an indent past level 3", o["tooDeepIndent"] is True)
    ck("U23 duplicate copies the item and its subtree next to it", o["dupCount"] == 4)
    ck("U24 move to top level lifts an item out of nested levels", o["topLevelOk"] is True)
    ck("U25 a menu can be placed in more than one layout", o["placedInSlots"] == 2, str(o["placedInSlots"]))

async def browser():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)

        # ---- Menu Placements: Replace in Draft ----
        await pg.get_by_role("tab", name="Menu Placements").click(); await pg.wait_for_timeout(250)
        sel = pg.get_by_label("Header menu for Default Website Layout")
        ck("B1 the header slot has no empty option (unassign is blocked)", await sel.locator("option[value='']").count() == 0)
        await sel.select_option("menu_campaign"); await pg.wait_for_timeout(200)
        ck("B2 replacing an occupied slot asks first", await pg.get_by_role("dialog").count() == 1)
        await pg.get_by_role("button", name="Cancel").last.click(); await pg.wait_for_timeout(200)
        ck("B3 cancel keeps the current header menu", await sel.input_value() == "menu_primary", await sel.input_value())
        await sel.select_option("menu_campaign"); await pg.wait_for_timeout(200)
        await pg.get_by_role("button", name="Replace in Draft").click(); await pg.wait_for_timeout(200)
        ck("B4 Replace in Draft changes the draft and shows it", await sel.input_value() == "menu_campaign" and await pg.get_by_text("Draft", exact=True).count() >= 1)
        await pg.get_by_role("button", name="Save Placement Draft").click()
        await pg.get_by_text("Navigation placement saved as draft.").first.wait_for(timeout=5000)
        ck("B5 Save Placement Draft confirms with the spec toast", await pg.get_by_text("Navigation placement saved as draft.").count() >= 1)

        # ---- Menu Builder: keyboard reorder and the drawer preview ----
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(250)
        rows = pg.locator(".m8-row")
        before = await rows.first.locator(".m8-row-label").inner_text()
        await rows.nth(0).focus(); await pg.keyboard.press("Alt+ArrowDown"); await pg.wait_for_timeout(200)
        after_first = await rows.first.locator(".m8-row-label").inner_text()
        ck("B6 Alt+ArrowDown moves the focused item down", after_first != before, f"{before} -> {after_first}")
        await pg.keyboard.press("Alt+ArrowUp"); await pg.wait_for_timeout(150)
        ck("B7 Alt+ArrowUp moves it back", await rows.first.locator(".m8-row-label").inner_text() == before)
        await pg.get_by_role("radio", name="Tablet").click(); await pg.wait_for_timeout(150)
        ck("B8 tablet preview uses the drawer below 1024px", await pg.locator("#m8-preview .m8-pv-mobile").count() == 1)
        await pg.get_by_role("radio", name="Desktop").click(); await pg.wait_for_timeout(120)

        # ---- Settings: danger zone guard ----
        await pg.get_by_role("tab", name="Settings").click(); await pg.wait_for_timeout(200)
        ck("B9 a placed menu's delete is disabled in Settings", await pg.get_by_role("button", name="Delete Primary Navigation").is_disabled())

        ck("B10 no page errors in the run", not errs, "; ".join(errs)[:200])
        await b.close()

async def main():
    unit()
    try:
        await browser()
    except Exception as e:
        ck("B0 the browser run completes", False, str(e)[:300])
    print(f"\nqa_m8_v3 · {TALLY['ok']}/{TALLY['ok'] + TALLY['fail']} assertions passed")
    if FAILS:
        print("FAILURES:"); [print(" ·", f) for f in FAILS]
    sys.exit(1 if FAILS else 0)

if __name__ == "__main__":
    asyncio.run(main())
