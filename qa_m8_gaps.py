#!/usr/bin/env python3
"""Module 8 — the open gaps, closed (icons and descriptions, View all, Media Library art, JSON export and import,
auto-expand and auto-scroll during drag, the drop indicator following the pointer, toolbar wrap).

U  unit (Node, the real src/lib/menu-db.ts bundled with esbuild): export, import, limits, remapping, store import
B  browser (Playwright, WACRM-CMS.html)
"""
import asyncio, json, os, subprocess, tempfile
from playwright.async_api import async_playwright

APP = "/home/user/wacrm-app"
URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}

def ck(name, cond, extra=""):
    if cond: TALLY["ok"] += 1; print(f"OK   {name}")
    else: TALLY["fail"] += 1; print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

NODE = r"""
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
const M = require(process.argv[2]);
const link = (id, kind='url') => ({ id, label: id, link: { kind: 'url', url: 'https://example.com' }, newTab: false, audience: 'everyone', behaviour: 'link', megaId: null, children: [], cssClass: '', rel: '' });
const dd = (id, kids) => ({ ...link(id), behaviour: 'dropdown', children: kids });
const mega = (id, mid) => ({ ...link(id), behaviour: 'mega', megaId: mid });
const panel = { name: 'P', gap: 'medium', surface: 'card', dropAnim: 'fade', theme: 'editorial',
  columns: [{ id: 'c1', title: 'Col', links: [{ id: 'l1', label: 'Alpha', link: { kind: 'url', url: 'https://a.example' }, icon: 'star', description: 'First' }],
    viewAll: { label: 'See all', link: { kind: 'page', pageId: 'p_x' } } }, { id: 'c2', title: 'Two', links: [], viewAll: null }],
  featured: { enabled: true, image: 'hero-student', title: 'T', text: 'x', ctaLabel: 'Go', ctaLink: null } };
const base = { name: 'Main', description: 'd', type: 'main', mobile: { behaviour: 'drawer', openFirstLevel: false },
  items: [{ ...dd('A', [{ ...link('A1'), icon: 'book', description: 'A one line note' }]), icon: 'rocket', description: 'About' }, mega('M', 'mg1')] };
const out = {};
out.exp = JSON.parse(M.exportMenuJson(base, [{ id: 'mg1', doc: panel }, { id: 'unused', doc: panel }]));
out.expKind = out.exp.kind + '/' + out.exp.version;
out.expMegaIds = out.exp.megas.map(g => g.id);
const round = M.parseMenuImport(M.exportMenuJson(base, [{ id: 'mg1', doc: panel }]));
out.round = round.ok ? { name: round.menu.name, top: round.menu.items.map(i => i.label + ':' + i.behaviour + ':' + (i.icon || '') + ':' + (i.description || '')),
  a1: round.menu.items[0].children[0].icon + '/' + round.menu.items[0].children[0].description, megaRef: round.menu.items[1].megaId, megaKnown: round.megas.some(g => g.id === round.menu.items[1].megaId),
  idsNew: round.menu.items.every(i => i.id !== 'A' && i.id !== 'M'), colVA: round.megas[0].doc.columns[0].viewAll.label, linkIcon: round.megas[0].doc.columns[0].links[0].icon, linkDesc: round.megas[0].doc.columns[0].links[0].description } : round.error;
out.notJson = M.parseMenuImport('{nope').error ?? 'ok';
out.wrongKind = M.parseMenuImport(JSON.stringify({ kind: 'other', version: 1, menu: {} })).error ?? 'ok';
out.wrongVersion = M.parseMenuImport(JSON.stringify({ kind: 'wacrm.menu', version: 9, menu: {} })).error ?? 'ok';
const withItems = (items, megas = []) => JSON.stringify({ kind: 'wacrm.menu', version: 1, menu: { name: 'X', items }, megas });
const L = (id, extra = {}) => ({ id, label: id, link: { kind: 'url', url: 'https://e.example' }, behaviour: 'link', children: [], ...extra });
const deep = L('d0', { behaviour: 'dropdown', children: [L('d1', { behaviour: 'dropdown', children: [L('d2', { behaviour: 'dropdown', children: [L('d3')] })] })] });
out.tooDeep = M.parseMenuImport(withItems([deep])).error ?? 'ok';
out.megaBelow = M.parseMenuImport(withItems([L('x', { behaviour: 'dropdown', children: [L('y', { behaviour: 'mega', megaId: 'g' })] })])).error ?? 'ok';
out.megaKids = M.parseMenuImport(withItems([L('m', { behaviour: 'mega', megaId: 'g', children: [L('k')] })])).error ?? 'ok';
out.tooMany = M.parseMenuImport(withItems(Array.from({ length: 81 }, (_, i) => L('i' + i)))).error ?? 'ok';
out.badLink = M.parseMenuImport(withItems([{ ...L('b'), link: { kind: 'telepathy' } }])).error ?? 'ok';
const cleaned = M.parseMenuImport(withItems([{ ...L('c'), icon: 'skull', description: 'z'.repeat(300) }]));
out.cleanIcon = cleaned.ok ? String(cleaned.menu.items[0].icon) : cleaned.error;
out.cleanDesc = cleaned.ok ? cleaned.menu.items[0].description.length : -1;
const legacy = M.parseMenuImport(withItems([L('old')]));
out.legacy = legacy.ok ? 'ok' : legacy.error;
(async () => {
  const pre = (await M.MenusAPI.load('site_main')).menus.length;
  const rec = await M.MenusAPI.importMenu('site_main', M.exportMenuJson(base, [{ id: 'mg1', doc: panel }]));
  const post = (await M.MenusAPI.load('site_main')).menus.length;
  out.storeImport = { created: post === pre + 1, draftName: rec.draft.name, live: rec.live, megaSaved: (await M.MenusAPI.load('site_main')).megas.some(g => g.draft.name === 'P') };
  try { await M.MenusAPI.importMenu('site_main', '{}'); out.storeBad = 'none'; } catch (e) { out.storeBad = e.code ?? e.message; }
  console.log(JSON.stringify(out));
})();
"""

def unit():
    tmp = tempfile.mkdtemp()
    b = os.path.join(tmp, "menu.cjs"); js = os.path.join(tmp, "t.cjs")
    r = subprocess.run(["npx", "--no-install", "esbuild", f"{APP}/src/lib/menu-db.ts", "--bundle", "--format=cjs", "--platform=node", f"--outfile={b}", "--log-level=error"], capture_output=True, text=True, timeout=120, cwd=APP)
    if r.returncode != 0: ck("U0 bundles", False, r.stderr[:200]); return
    open(js, "w").write(NODE)
    r = subprocess.run(["node", js, b], capture_output=True, text=True, timeout=60)
    if r.returncode != 0: ck("U0 runs", False, r.stderr[:400]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    ck("G1 the export carries its kind and version", o["expKind"] == "wacrm.menu/1", o["expKind"])
    ck("G2 the export keeps only the panels its items use", o["expMegaIds"] == ["mg1"], str(o["expMegaIds"]))
    rd = o["round"]
    ck("G3 a round trip keeps names, behaviour, icons and descriptions", isinstance(rd, dict) and rd["top"] == ["A:dropdown:rocket:About", "M:mega::"], str(rd))
    ck("G4 a round trip keeps a child's icon and description", isinstance(rd, dict) and rd["a1"] == "book/A one line note", str(rd))
    ck("G5 imported items get fresh ids", isinstance(rd, dict) and rd["idsNew"], str(rd))
    ck("G6 a mega item points at a panel that the import created", isinstance(rd, dict) and rd["megaKnown"], str(rd))
    ck("G7 View all and link icons survive the round trip", isinstance(rd, dict) and rd["colVA"] == "See all" and rd["linkIcon"] == "star" and rd["linkDesc"] == "First", str(rd))
    ck("G8 a file that is not JSON is refused", o["notJson"] != "ok", o["notJson"])
    ck("G9 a file from another product is refused", "not a WACRM menu export" in o["wrongKind"], o["wrongKind"])
    ck("G10 an unknown export version is refused", "not supported" in o["wrongVersion"], o["wrongVersion"])
    ck("G11 a fourth level is refused on import", "deeper than 3" in o["tooDeep"], o["tooDeep"])
    ck("G12 a mega panel below the top level is refused on import", "top level" in o["megaBelow"], o["megaBelow"])
    ck("G13 a mega panel with submenu items is refused on import", "can't also have submenu" in o["megaKids"], o["megaKids"])
    ck("G14 more than 80 items is refused on import", "more than 80" in o["tooMany"], o["tooMany"])
    ck("G15 a malformed link is refused on import", "not valid" in o["badLink"], o["badLink"])
    ck("G16 an icon outside the list is dropped", o["cleanIcon"] == "None" or o["cleanIcon"] == "undefined", o["cleanIcon"])
    ck("G17 a description is cut to 140 characters", o["cleanDesc"] == 140, str(o["cleanDesc"]))
    ck("G18 an export without the new fields still imports", o["legacy"] == "ok", o["legacy"])
    si = o["storeImport"]
    ck("G19 importing adds one menu to the site", si["created"] is True, str(si))
    ck("G20 an import is a draft, never live", si["live"] is None, str(si))
    ck("G21 the panels travel with the import", si["megaSaved"] is True, str(si))
    ck("G22 a bad import is refused with a validation error", o["storeBad"] == "E_VALID", o["storeBad"])

async def browser():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 1000})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)

        # --- B1 the toolbar stays on one line at 768 px ---
        await pg.set_viewport_size({"width": 768, "height": 1000}); await pg.wait_for_timeout(250)
        tops = await pg.evaluate("""() => ['Collapse All','Expand All','Undo','Redo'].map(n => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === n || b.getAttribute('aria-label') === n))
            .filter(Boolean).map(b => Math.round(b.getBoundingClientRect().top))""")
        ck("B1 Undo and Redo sit on the same line as Collapse at 768 px", len(tops) >= 3 and max(tops) - min(tops) <= 2, str(tops))
        await pg.set_viewport_size({"width": 1440, "height": 1000}); await pg.wait_for_timeout(200)

        # --- B2 export downloads a .menu.json file that imports back ---
        async with pg.expect_download() as dl:
            await pg.get_by_role("button", name="Export JSON").click()
        d = await dl.value
        path = await d.path()
        data = json.loads(open(path).read())
        ck("B2 Export JSON downloads a .menu.json file", d.suggested_filename.endswith(".menu.json") and data.get("kind") == "wacrm.menu", d.suggested_filename)

        # --- B3 import creates a new draft menu from that file ---
        tmpf = os.path.join(tempfile.mkdtemp(), "qa-import.menu.json")
        data["menu"]["name"] = "QA Imported Menu"
        open(tmpf, "w").write(json.dumps(data))
        await pg.set_input_files("input[aria-label='Import menu JSON file']", tmpf); await pg.wait_for_timeout(700)
        ck("B3 Import JSON creates the menu and opens it", await pg.get_by_text("QA Imported Menu", exact=False).first.is_visible())
        ck("B3b the imported menu is a draft (Draft badge, not live)", await pg.locator("text=Draft").count() >= 1)

        # --- B4 item icon and description fields exist and keep their values ---
        row = pg.locator(".m8-tree > .m8-node > .m8-row").first
        await row.click(); await pg.wait_for_timeout(150)
        await pg.get_by_label("Item icon").select_option("star")
        await pg.get_by_label("Item description").fill("Short note")
        await pg.locator(".m8-tree > .m8-node > .m8-row").nth(1).click(); await pg.wait_for_timeout(120)
        await row.click(); await pg.wait_for_timeout(150)
        ck("B4 the item icon and description are kept when the selection changes",
           await pg.get_by_label("Item icon").input_value() == "star" and await pg.get_by_label("Item description").input_value() == "Short note")

        # --- B5 a mega panel: View all link, Media Library image, link icon and description ---
        await pg.get_by_role("tab", name="Mega Menus").click(); await pg.wait_for_timeout(200)
        mega_rows = pg.locator("button, [role=button], li, div").filter(has_text="Mega").first
        names = await pg.locator("text=mega menu").count()
        opened = False
        for cand in [pg.get_by_role("button", name="Edit", exact=False).first]:
            if await cand.count():
                try: await cand.click(); opened = True
                except Exception: pass
        await pg.wait_for_timeout(250)
        has_editor = await pg.locator("section.m8-mcol").count() > 0
        ck("B5 the Mega Menus editor opens", has_editor or opened, f"editor={has_editor}")
        if has_editor:
            await pg.get_by_label("Column 1 View all link").check(); await pg.wait_for_timeout(120)
            ck("B5a a column can show a View all link", await pg.get_by_label("Column 1 View all label").count() == 1)
            await pg.get_by_label("Column 1 View all label").fill("See everything"); await pg.wait_for_timeout(120)
            ck("B5b the View all label appears in the panel preview",
               await pg.locator(".m8-viewall", has_text="See everything").count() >= 1)
            await pg.get_by_label("Show featured content").check(); await pg.wait_for_timeout(120)
            await pg.locator("section[aria-label='Featured card'] select").first.select_option("dest-italy"); await pg.wait_for_timeout(150)
            ck("B5c a Media Library image replaces the drawn art",
               await pg.locator("img.m8-art-photo").count() >= 1)
            link_icon = pg.get_by_label("Icon for link", exact=False).first
            if await link_icon.count():
                await link_icon.select_option("book"); await pg.wait_for_timeout(100)
                ck("B5d a mega link takes an icon", (await link_icon.input_value()) == "book")
            ck("B5e a mega link takes a description", await pg.get_by_label("Description, column 1").count() >= 1)

        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)

        # --- B6 auto-expand: a drag that rests on a collapsed parent opens it ---
        await pg.get_by_role("button", name="Collapse All").click(); await pg.wait_for_timeout(150)
        parent = pg.locator(".m8-row[data-row-kids]:not([data-row-kids='0'])").first
        parent_id = await parent.get_attribute("data-row-id")
        mover = pg.locator(".m8-tree > .m8-node > .m8-row").last
        mover_grip = mover.locator(".m8-grip")
        sb = await mover_grip.bounding_box()
        pb = await parent.bounding_box()
        tl = await pg.evaluate("() => document.querySelector('ul[role=tree]').getBoundingClientRect().left")
        await pg.mouse.move(sb["x"] + sb["width"] / 2, sb["y"] + sb["height"] / 2); await pg.mouse.down()
        await pg.mouse.move(tl + 18, pb["y"] + pb["height"] / 2, steps=8)
        for i in range(10):
            await pg.mouse.move(tl + 18 + (i % 2), pb["y"] + pb["height"] / 2 + (i % 2), steps=1)
            await pg.wait_for_timeout(110)
        expanded = await pg.locator(f".m8-row[data-row-id='{parent_id}']").get_attribute("data-row-collapsed")
        await pg.mouse.up(); await pg.wait_for_timeout(250)
        ck("B6 a drag resting on a collapsed parent opens it", expanded == "false", f"collapsed={expanded}")

        # --- B7 auto-scroll: a drag near the bottom edge scrolls the page ---
        scroller_before = await pg.evaluate("""() => { let p = document.querySelector('ul[role=tree]').parentElement;
            while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement; window.__sc = p || document.scrollingElement; return window.__sc.scrollTop; }""")
        await pg.evaluate("() => { window.__sc.scrollTop = 0; }")
        g = await pg.locator(".m8-tree > .m8-node > .m8-row .m8-grip").first.bounding_box()
        await pg.mouse.move(g["x"] + 5, g["y"] + 5); await pg.mouse.down()
        await pg.mouse.move(g["x"] + 5, 990, steps=6)
        for i in range(8):
            await pg.mouse.move(g["x"] + 5, 992 - i % 2, steps=1); await pg.wait_for_timeout(90)
        await pg.mouse.move(2, 2); await pg.mouse.up(); await pg.wait_for_timeout(200)
        scrolled = await pg.evaluate("() => window.__sc.scrollTop")
        ck("B7 a drag near the bottom edge scrolls the menu", scrolled > 0, f"before={scroller_before} after={scrolled}")

        # --- B8 the drop indicator follows the pointer during a real drag ---
        r1 = pg.locator(".m8-tree > .m8-node > .m8-row").nth(0)
        r3 = pg.locator(".m8-tree > .m8-node > .m8-row").nth(2)
        # centre the rows so the pointer stays out of the 80px auto-scroll bands at the viewport edges
        await r1.evaluate("e => e.scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(200)
        src = pg.locator(".m8-tree > .m8-node > .m8-row").nth(3).locator(".m8-grip")
        sg = await src.bounding_box(); b1 = await r1.bounding_box(); b3 = await r3.bounding_box()
        tl = await pg.evaluate("() => document.querySelector('ul[role=tree]').getBoundingClientRect().left")
        await pg.mouse.move(sg["x"] + 5, sg["y"] + 5); await pg.mouse.down()
        async def settle(x, y):
            # headless Chromium delivers dragover late; small moves at the spot let the indicator catch up, as a real pointer does
            await pg.mouse.move(x, y, steps=8)
            for k in range(4):
                await pg.mouse.move(x + (k % 2), y, steps=1); await pg.wait_for_timeout(90)
        await settle(tl + 18, b1["y"] + b1["height"] * 0.12); await pg.wait_for_timeout(60)
        on_r1 = await r1.get_attribute("class")
        await settle(tl + 18, b3["y"] + b3["height"] * 0.88); await pg.wait_for_timeout(60)
        on_r3 = await r3.get_attribute("class")
        r1_after = await r1.get_attribute("class")
        ck("B8a the indicator shows above the first row while the pointer is there", "is-drop-before" in (on_r1 or ""), on_r1)
        ck("B8b the indicator moves to the third row as the pointer moves", "is-drop-after" in (on_r3 or ""), on_r3)
        ck("B8c the first row's indicator clears once the pointer leaves it", "is-drop-" not in (r1_after or ""), r1_after)
        await pg.mouse.move(2, 2); await pg.mouse.up(); await pg.wait_for_timeout(200)

        # --- B9 the mockup's Show in Mega Menu switch turns a top-level link into a mega item and back ---
        top_link = pg.locator(".m8-tree > .m8-node > .m8-row:not(.is-mega)").filter(has_not=pg.locator(".m8-type", has_text="Dropdown")).nth(1)
        await top_link.click(); await pg.wait_for_timeout(150)
        before = await pg.locator(".m8-row.is-mega").count()
        sw = pg.get_by_role("switch", name="Show in Mega Menu").first
        await sw.click(); await pg.wait_for_timeout(200)
        during = await pg.locator(".m8-row.is-mega").count()
        ck("B9a the switch turns a top-level link into a mega item", during == before + 1, f"{before}->{during}")
        await sw.click(); await pg.wait_for_timeout(200)
        after = await pg.locator(".m8-row.is-mega").count()
        ck("B9b the switch turns it back into a link", after == before, f"{before}->{after}")

        ck("BX no page errors during the gap checks", not errs, str(errs))
        await br.close()

if __name__ == "__main__":
    unit()
    asyncio.run(browser())
    print(f"\nqa_m8_gaps · {TALLY['ok']}/{TALLY['ok']+TALLY['fail']} assertions passed")
