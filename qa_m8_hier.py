#!/usr/bin/env python3
"""Module 8 — hierarchy drag and drop (v5). The drop depth follows the pointer's horizontal position.
U  unit (Node, real menu-db.ts): drop at parent level, child level, grandchild level; refusals
B  browser: a real pointer drag lands a top-level row at the child level and at the parent level; six mega themes, new animations and hover effects reach the preview
"""
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/menus"
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
const L = (id, kids = [], extra = {}) => ({ id, label: id, link: { kind: 'url', url: 'https://example.com' }, newTab: false, audience: 'everyone', behaviour: kids.length ? 'dropdown' : 'link', megaId: null, children: kids, cssClass: '', rel: '', ...extra });
const tree = () => [L('A', [L('A1', [L('A1a')])]), L('B'), L('C')];
const ids = (xs) => xs.map(i => i.id);
const out = {};
const run = (dragId, target, where, depth, t = tree()) => { const r = M.moveAtDepth(t, dragId, target, where, depth); return r.items ? r.items : r.error; };
let r = run('B', 'A1a', 'after', 2); out.p2 = typeof r === 'string' ? r : JSON.stringify(ids(M.findItem(r, 'A1').children));
r = run('B', 'A1a', 'after', 1); out.p1 = typeof r === 'string' ? r : JSON.stringify(ids(M.findItem(r, 'A').children));
r = run('B', 'A1a', 'after', 0); out.p0 = typeof r === 'string' ? r : JSON.stringify(ids(r));
r = run('B', 'A1', 'after', 2); out.child = typeof r === 'string' ? r : JSON.stringify(ids(M.findItem(r, 'A1').children)) + ' beh=' + M.findItem(r, 'A1').behaviour;
r = run('B', 'A1', 'after', 3); out.tooDeep = typeof r === 'string' ? r : 'accepted';
const deepX = L('X', [L('X1')]);
out.subtreeTooDeep = (M.moveAtDepth([...tree(), deepX], 'X', 'A1a', 'after', 2) || {}).error ?? 'accepted';
out.megaNested = (M.moveAtDepth([...tree(), L('M', [], { behaviour: 'mega', megaId: 'mg' })], 'M', 'A1', 'after', 1) || {}).error ?? 'accepted';
out.intoSelf = (M.moveAtDepth(tree(), 'A', 'A1a', 'after', 1) || {}).error ?? 'accepted';
out.sameRow = (M.moveAtDepth(tree(), 'B', 'B', 'after', 0) || {}).error ?? 'accepted';
console.log(JSON.stringify(out));
"""

def unit():
    tmp = tempfile.mkdtemp()
    b = os.path.join(tmp, "menu.cjs"); js = os.path.join(tmp, "t.cjs")
    r = subprocess.run(["npx", "--no-install", "esbuild", f"{APP}/src/lib/menu-db.ts", "--bundle", "--format=cjs", "--platform=node", f"--outfile={b}", "--log-level=error"],
                       capture_output=True, text=True, timeout=120, cwd=APP)
    if r.returncode != 0:
        ck("H0 the data layer bundles for Node", False, r.stderr[:200]); return
    open(js, "w").write(NODE_JS)
    r = subprocess.run(["node", js, b], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        ck("H0 the data layer runs in Node", False, r.stderr[:300]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    ck("H1 depth at the target's own level places the row beside it (A1a's list)", o["p2"] == '["A1a","B"]', o["p2"])
    ck("H2 depth one above places the row beside the parent (A's list)", o["p1"] == '["A1","B"]', o["p1"])
    ck("H3 depth zero places the row beside the top-level ancestor", o["p0"] == "A,B,C".replace(",", ",") or o["p0"] == "[\"A\",\"B\",\"C\"]", o["p0"])
    ck("H4 depth one below the target makes the target a dropdown with the row as its child", o["child"] == '["A1a","B"] beh=dropdown', o["child"])
    ck("H5 a depth past the grandchild level is refused", o["tooDeep"] != "accepted", o["tooDeep"])
    ck("H6 a row whose subtree would pass the third level is refused", "Maximum depth" in o["subtreeTooDeep"] or "level" in o["subtreeTooDeep"], o["subtreeTooDeep"])
    ck("H7 a mega item cannot move below the top level", o["megaNested"] != "accepted", o["megaNested"])
    ck("H8 a row cannot move into its own subtree", o["intoSelf"] != "accepted", o["intoSelf"])
    ck("H9 a row cannot be dropped on itself", o["sameRow"] != "accepted", o["sameRow"])

async def row_at(pg, label):
    return pg.locator(".m8-row", has=pg.locator(".m8-row-label", has_text=label)).first

async def drag_pointer(pg, src_label, dst_label, zone_y, depth):
    """A real pointer drag. The depth is set by the pointer's x, measured from the tree's left edge."""
    src = (await row_at(pg, src_label)).locator(".m8-grip")
    await src.scroll_into_view_if_needed(); await pg.wait_for_timeout(120)
    sb = await src.bounding_box()
    dst = await row_at(pg, dst_label)
    await dst.scroll_into_view_if_needed(); await pg.wait_for_timeout(120)
    db = await dst.bounding_box()
    tree_left = await pg.evaluate("() => { const t = document.querySelector('ul[role=tree]'); return t ? t.getBoundingClientRect().left : 0; }")
    x = tree_left + depth * 36 + 18
    y = db["y"] + db["height"] * zone_y
    await pg.mouse.move(sb["x"] + sb["width"] / 2, sb["y"] + sb["height"] / 2); await pg.mouse.down()
    await pg.mouse.move(x, y - 14, steps=6); await pg.mouse.move(x, y, steps=8)
    await pg.wait_for_timeout(120)
    await pg.mouse.up(); await pg.wait_for_timeout(400)

async def browser():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 1700})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL); await pg.reload(); await pg.wait_for_timeout(1400)

        # Services is a dropdown at the top level with children; Career counselling is its child.
        # H-B1: drag Contact to the lower part of "Career counselling" at child depth -> Contact becomes a child of Services.
        await drag_pointer(pg, "Contact", "Career counselling", 0.88, 1)
        services = pg.locator(".m8-node", has=pg.locator(":scope > .m8-row .m8-row-label", has_text="Services")).first
        nested = await services.locator(".m8-sub .m8-row-label", has_text="Contact").count()
        ck("HB1 a drop at the child depth nests the row under the same parent", nested >= 1)

        # H-B2: drag it back to the top level, beside Services (depth 0 next to the child row)
        await drag_pointer(pg, "Contact", "Career counselling", 0.88, 0)
        top = [n.strip() for n in await pg.locator("ul[role=tree]:not(.m8-sub) > .m8-node > .m8-row .m8-row-label").all_text_contents()]
        ck("HB2 a drop at the parent depth moves the row out to the top level beside its ancestor",
           "Contact" in top and top.index("Contact") == top.index("Services") + 1, str(top))
        # style: the six mega themes, the new drop animations and hover effects reach the preview
        await pg.locator(".m8-row.is-mega").first.click(); await pg.wait_for_timeout(150)
        await pg.get_by_role("tab", name="Mega Menu", exact=True).click(); await pg.wait_for_timeout(150)
        await pg.get_by_role("tab", name="Mega Menus").click(); await pg.wait_for_timeout(250)
        themes_ok = True
        for t in ["classic", "editorial", "dark", "minimal", "image", "brand"]:
            await pg.get_by_label("Panel theme").select_option(t); await pg.wait_for_timeout(80)
            themes_ok = themes_ok and await pg.get_by_label("Panel theme").input_value() == t
        ck("HS1 the six mega themes are selectable", themes_ok)
        await pg.get_by_label("Panel theme").select_option("dark")
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
        await pg.locator("#m8-preview .m8-pv-top > li.is-mega > button").first.click(); await pg.wait_for_timeout(250)
        ck("HS2 the dark theme reaches the panel preview", await pg.locator("#m8-preview .m8-mega-view.m8-theme-dark").count() == 1)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(120)
        await pg.get_by_role("tab", name="Menu Settings").click(); await pg.wait_for_timeout(200)
        await pg.get_by_label("Dropdown animation").select_option("stagger")
        await pg.get_by_label("Hover effect").select_option("sweep"); await pg.wait_for_timeout(120)
        nav_cls = await pg.locator("#m8-preview nav.m8-pv-bar").first.get_attribute("class")
        ck("HS3 the sweep hover effect reaches the navigation preview", "m8-hover-sweep" in (nav_cls or ""), str(nav_cls))
        await pg.locator("#m8-preview .m8-pv-top > li.is-mega > button").first.click(); await pg.wait_for_timeout(250)
        pcls = await pg.locator("#m8-preview .m8-pv-panel").first.get_attribute("class")
        ck("HS4 the stagger drop animation reaches the panel", "m8-anim-stagger" in (pcls or ""), str(pcls))
        ck("DX1 no page errors during the hierarchy drags", not errs, "; ".join(errs))
        await b.close()

def main():
    unit()
    try:
        asyncio.run(browser())
    except Exception as e:
        ck("HX0 the browser run completes", False, str(e)[:300])
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m8_hier · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:"); [print(" · " + f) for f in FAILS]
    sys.exit(0 if TALLY["fail"] == 0 else 1)

if __name__ == "__main__":
    main()
