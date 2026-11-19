#!/usr/bin/env python3
"""Module 8 — drag and drop, and style controls (v4).

U  unit (Node, the real src/lib/menu-db.ts bundled with esbuild): drop before / after / inside,
   refusals (depth, mega placement, mega with children, own subtree, item limit), page drops,
   style defaults
B  browser (Playwright, WACRM-CMS.html): real HTML5 drags onto the top, middle and bottom of a row,
   a refused drop shows a toast, a page dragged from Add Items is placed, the five presets,
   hover effect, dropdown animation, mega surface and animation reach the preview
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
const M = require(process.argv[2]);
const link = (id) => ({ id, label: id, link: { kind: 'url', url: 'https://example.com' }, newTab: false, audience: 'everyone', behaviour: 'link', megaId: null, children: [], cssClass: '', rel: '' });
const dd = (id, kids) => ({ ...link(id), behaviour: 'dropdown', children: kids });
const mega = (id) => ({ ...link(id), behaviour: 'mega', megaId: 'mg' });
const ids = (xs) => xs.map(i => i.id);
const out = {};
const base = [dd('A', [link('A1')]), link('B'), mega('M')];
// before / after / inside
let r = M.moveNode(base, 'B', 'A', 'before'); out.before = r.items ? ids(r.items) : r.error;
r = M.moveNode(base, 'B', 'A', 'after'); out.after = r.items ? ids(r.items) : r.error;
r = M.moveNode(base, 'B', 'A', 'inside'); out.inside = r.items ? JSON.stringify(ids(r.items)) + ' A>' + JSON.stringify(ids(M.findItem(r.items, 'A').children)) + ' beh=' + M.findItem(r.items, 'A').behaviour : r.error;
// refusals
out.intoMega = (M.moveNode(base, 'B', 'M', 'inside') || {}).error ?? 'none';
const deep = dd('L0', [dd('L1', [dd('L2', [link('L3')])])]);
out.tooDeep = (M.moveNode([deep, link('X')], 'X', 'L2', 'inside') || {}).error ?? 'none';
out.intoSelf = (M.moveNode([dd('S', [link('S1')])], 'S', 'S1', 'before') || {}).error ?? 'none';
out.selfDrop = (M.moveNode(base, 'B', 'B', 'before') || {}).error ?? 'none';
out.megaBelowTop = (M.moveNode(base, 'M', 'A1', 'after') || {}).error ?? 'none';
const big = Array.from({ length: M.MENU_LIMITS.maxItems }, (_, i) => link('i' + i));
out.limit = (M.dropNode(big, link('extra'), 'i0', 'before') || {}).error ?? 'none';
// page drop from Add Items
const pageNode = M.blankLink('Study in France', { kind: 'page', pageId: 'p_france' });
r = M.dropNode(base, pageNode, 'B', 'after'); out.pageDrop = r.items ? ids(r.items).join(',') : r.error;
out.pageDropInside = (M.dropNode(base, pageNode, 'M', 'inside') || {}).error ?? 'none';
// style defaults
out.styleDefault = JSON.stringify(M.styleOf({}));
out.styleSet = JSON.stringify(M.styleOf({ style: { preset: 'pill' } }));
console.log(JSON.stringify(out));
"""

def unit():
    tmp = tempfile.mkdtemp()
    b = os.path.join(tmp, "menu.cjs"); js = os.path.join(tmp, "t.cjs")
    r = subprocess.run(["npx", "esbuild", f"{APP}/src/lib/menu-db.ts", "--bundle", "--format=cjs", "--platform=node", f"--outfile={b}", "--log-level=error"],
                       capture_output=True, text=True, timeout=120, cwd=APP)
    if r.returncode != 0:
        ck("U0 the data layer bundles for Node", False, r.stderr[:200]); return
    open(js, "w").write(NODE_JS)
    r = subprocess.run(["node", js, b], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        ck("U0 the data layer runs in Node", False, r.stderr[:300]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    ck("D1 drop before a row puts the item above it", o["before"] == ["B", "A", "M"], str(o["before"]))
    ck("D2 drop after a row puts the item below it", o["after"] == ["A", "B", "M"], str(o["after"]))
    ck("D3 drop inside nests the item under the target, which stays a dropdown", '["A1","B"]' in o["inside"] and "beh=dropdown" in o["inside"], o["inside"])
    ck("D4 a row cannot be dropped inside a mega item", o["intoMega"] != "none", o["intoMega"])
    ck("D5 a fourth level is refused with the depth message", "Maximum depth" in o["tooDeep"], o["tooDeep"])
    ck("D6 a row cannot move into its own subtree", o["intoSelf"] != "none", o["intoSelf"])
    ck("D7 a row cannot be dropped on itself", o["selfDrop"] != "none", o["selfDrop"])
    ck("D8 a mega item cannot move below the top level", "top-level" in o["megaBelowTop"], o["megaBelowTop"])
    ck("D9 the item limit is enforced on drop", "80 items" in o["limit"], o["limit"])
    ck("D10 a page dropped after a row is placed there", o["pageDrop"].startswith("A,B,") and o["pageDrop"].endswith(",M"), o["pageDrop"])
    ck("D11 a page cannot be dropped inside a mega item", o["pageDropInside"] != "none", o["pageDropInside"])
    ck("D12 style defaults to Classic, Fade, Underline", o["styleDefault"] == '{"preset":"classic","dropAnim":"fade","hoverFx":"underline"}', o["styleDefault"])
    ck("D13 a partial style keeps the other defaults", '"preset":"pill"' in o["styleSet"] and '"dropAnim":"fade"' in o["styleSet"], o["styleSet"])

async def row_box(pg, label):
    row = pg.locator(".m8-row", has=pg.locator(".m8-row-label", has_text=label)).first
    return row

async def drag_to_zone(pg, src_grip_label, dst_label, zone):
    """Drag a row by its grip onto the top, middle or bottom quarter of another row."""
    src = (await row_box(pg, src_grip_label)).locator(".m8-grip")
    dst = await row_box(pg, dst_label)
    box = await dst.bounding_box()
    y = {"before": 0.12, "inside": 0.5, "after": 0.88}[zone]
    await src.drag_to(dst, target_position={"x": 40, "y": box["height"] * y})
    await pg.wait_for_timeout(350)

async def browser():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 1700})  # tall enough that every row is on screen to drag
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)

        # --- drop before: move the last top-level row above the first ---
        top = pg.locator(".m8-tree > .m8-node > .m8-row .m8-row-label")
        names = await top.all_text_contents()
        last, first = names[-1].strip(), names[0].strip()
        await drag_to_zone(pg, last, first, "before")
        names2 = [n.strip() for n in await top.all_text_contents()]
        ck("DB1 dropping in the top quarter of a row places the item before it", names2[0] == last, str(names2[:3]))

        # --- drop after: move the first row to just below the second row ---
        top = pg.locator(".m8-tree > .m8-node > .m8-row .m8-row-label")
        names = [n.strip() for n in await top.all_text_contents()]
        mover, target = names[0], names[1]
        await drag_to_zone(pg, mover, target, "after")
        names3 = [n.strip() for n in await top.all_text_contents()]
        ck("DB2 dropping in the bottom quarter of a row places the item after it",
           names3.index(mover) == names3.index(target) + 1, str(names3[:4]))

        # --- drop inside: a plain link goes under a dropdown ---
        dropdown = pg.locator(".m8-row", has=pg.locator(".m8-type", has_text="Dropdown")).first
        dd_label = (await dropdown.locator(".m8-row-label").text_content() or "").strip()
        mover = names3[-1] if names3[-1] != dd_label else names3[-2]
        await drag_to_zone(pg, mover, dd_label, "inside")
        nested = pg.locator(".m8-sub .m8-node.depth-1 > .m8-row .m8-row-label", has_text=mover)
        ck("DB3 dropping in the middle of a row nests the item under it", await nested.count() >= 1, dd_label)

        # --- refused drop: onto a mega item's middle shows the reason as a toast ---
        mega_row = pg.locator(".m8-row.is-mega").first
        mega_label = (await mega_row.locator(".m8-row-label").text_content() or "").strip()
        src_label = names3[0] if names3[0] != mega_label else names3[1]
        before_count = await pg.locator(".m8-row").count()
        await drag_to_zone(pg, src_label, mega_label, "inside")
        toast_ok = await pg.get_by_text("Can't drop it here").count() >= 1
        ck("DB4 a refused drop shows the reason as a toast", toast_ok)
        ck("DB5 a refused drop changes nothing", await pg.locator(".m8-row").count() == before_count)

        # --- a page dragged from Add Items is placed with dropNode ---
        await pg.get_by_role("tab", name="Add Items").click() if await pg.get_by_role("tab", name="Add Items").count() else None
        pages_li = pg.locator("li.m8-pagedrag").first
        page_title = (await pages_li.locator("span").first.text_content() or "").strip()
        count_before = await pg.locator(".m8-row").count()
        dst = pg.locator(".m8-tree > .m8-node > .m8-row").first
        await pages_li.drag_to(dst, target_position={"x": 40, "y": 3})
        await pg.wait_for_timeout(350)
        ck("DB6 a page dragged from Add Items is added to the menu", await pg.locator(".m8-row").count() == count_before + 1)
        ck("DB7 the added page is named after the page", await pg.locator(".m8-row-label", has_text=page_title).count() >= 1, page_title)

        # --- the Alt+arrow keyboard fallback still works ---
        row = pg.locator(".m8-tree > .m8-node > .m8-row").nth(1)
        lbl_before = (await row.locator(".m8-row-label").text_content() or "").strip()
        await row.focus(); await pg.keyboard.press("Alt+ArrowUp"); await pg.wait_for_timeout(200)
        first_lbl = (await pg.locator(".m8-tree > .m8-node > .m8-row .m8-row-label").first.text_content() or "").strip()
        ck("DB8 Alt+ArrowUp still moves a row (keyboard fallback)", first_lbl == lbl_before, f"{first_lbl} vs {lbl_before}")

        # --- style controls: presets, hover, drop animation reach the preview ---
        await pg.get_by_role("tab", name="Menu Settings").click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("radio", name="Pill").first.click(); await pg.wait_for_timeout(150)
        nav_cls = await pg.locator("#m8-preview nav.m8-pv-bar").first.get_attribute("class") if await pg.locator("#m8-preview nav.m8-pv-bar").count() else ""
        ck("DS1 the Pill preset reaches the navigation preview", "m8-preset-pill" in (nav_cls or ""), str(nav_cls))
        await pg.get_by_label("Hover effect").select_option("lift"); await pg.wait_for_timeout(120)
        nav_cls = await pg.locator("#m8-preview nav.m8-pv-bar").first.get_attribute("class") if await pg.locator("#m8-preview nav.m8-pv-bar").count() else ""
        ck("DS2 the hover effect reaches the navigation preview", "m8-hover-lift" in (nav_cls or ""), str(nav_cls))
        await pg.get_by_label("Dropdown animation").select_option("slide"); await pg.wait_for_timeout(120)
        ck("DS3 the dropdown animation control keeps its value", await pg.get_by_label("Dropdown animation").input_value() == "slide")
        ck("DS4 the five preset cards are shown", await pg.get_by_role("radio", name="Classic").count() >= 1 and await pg.get_by_role("radio", name="Bold").count() >= 1)

        # --- mega panel surface and animation ---
        await pg.locator(".m8-row.is-mega").first.click(); await pg.wait_for_timeout(150)
        await pg.get_by_role("tab", name="Mega Menu", exact=True).click(); await pg.wait_for_timeout(150)
        await pg.get_by_role("button", name="Edit panel in Mega Menus").click(); await pg.wait_for_timeout(250)
        await pg.get_by_label("Panel surface").select_option("bordered"); await pg.wait_for_timeout(120)
        await pg.get_by_label("Panel animation").select_option("scale"); await pg.wait_for_timeout(120)
        ck("DS5 the mega surface control keeps its value", await pg.get_by_label("Panel surface").input_value() == "bordered")
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
        await pg.locator("#m8-preview .m8-pv-top > li.is-mega > button").first.click(); await pg.wait_for_timeout(200)
        panel_cls = await pg.locator("#m8-preview .m8-mega-view").first.get_attribute("class") if await pg.locator("#m8-preview .m8-mega-view").count() else ""
        ck("DS6 the mega surface reaches the panel preview", "m8-surface-bordered" in (panel_cls or ""), str(panel_cls))
        anim_cls = await pg.locator("#m8-preview .m8-pv-panel").first.get_attribute("class") if await pg.locator("#m8-preview .m8-pv-panel").count() else ""
        ck("DS7 the mega drop animation reaches the panel", "m8-anim-scale" in (anim_cls or ""), str(anim_cls))

        ck("DX1 no page errors during the drag and style run", not errs, "; ".join(errs))
        await b.close()

async def main_async():
    await browser()

def main():
    unit()
    try:
        asyncio.run(main_async())
    except Exception as e:
        ck("DX0 the browser run completes", False, str(e)[:300])
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m8_dnd · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:"); [print(" · " + f) for f in FAILS]
    sys.exit(0 if TALLY["fail"] == 0 else 1)

if __name__ == "__main__":
    main()
