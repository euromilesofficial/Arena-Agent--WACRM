#!/usr/bin/env python3
"""Module 8 — swap a submenu item with its main menu item, and swap a row with the next row.

U  unit (Node, the real src/lib/menu-db.ts bundled with esbuild)
B  browser (Playwright, WACRM-CMS.html): the row menu offers both swaps and the parent swap works
"""
import asyncio, json, os, subprocess, tempfile, sys
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
const link = (id) => ({ id, label: id, link: { kind: 'url', url: 'https://example.com' }, newTab: false, audience: 'everyone', behaviour: 'link', megaId: null, children: [], cssClass: '', rel: '' });
const dd = (id, kids) => ({ ...link(id), behaviour: 'dropdown', children: kids });
const mega = (id) => ({ ...link(id), behaviour: 'mega', megaId: 'mg' });
const ids = (xs) => xs.map(i => i.id);
const base = [dd('A', [link('A1'), link('A2')]), link('B'), mega('M')];
const out = {};
let r = M.swapWithParent(base, 'A1');
out.parent = r.items ? { top: ids(r.items), a1kids: ids(M.findItem(r.items, 'A1').children), akids: ids(M.findItem(r.items, 'A').children), a1beh: M.findItem(r.items, 'A1').behaviour } : r;
out.parentTop = M.swapWithParent(base, 'B').error ?? 'none';
out.parentDeep = (() => { const t = [dd('P', [dd('Q', [link('R')]), dd('S', [link('T')])])]; const x = M.swapWithParent(t, 'Q'); return x.items ? 'ok' : x.error; })();
r = M.swapWithNext(base, 'A'); out.next = r.items ? ids(r.items) : r;
out.nextLast = M.swapWithNext(base, 'M').error ?? 'none';
r = M.swapWithNext(base, 'A1'); out.nextChild = r.items ? ids(M.findItem(r.items, 'A').children) : r;
console.log(JSON.stringify(out));
"""

def unit():
    tmp = tempfile.mkdtemp()
    b = os.path.join(tmp, "menu.cjs"); js = os.path.join(tmp, "t.cjs")
    r = subprocess.run(["npx", "--no-install", "esbuild", f"{APP}/src/lib/menu-db.ts", "--bundle", "--format=cjs", "--platform=node", f"--outfile={b}", "--log-level=error"], capture_output=True, text=True, timeout=120, cwd=APP)
    if r.returncode != 0: ck("U0 bundles", False, r.stderr[:200]); return
    open(js, "w").write(NODE)
    r = subprocess.run(["node", js, b], capture_output=True, text=True, timeout=60)
    if r.returncode != 0: ck("U0 runs", False, r.stderr[:300]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    p = o["parent"]
    ck("W1 the submenu item takes its main item's place at the top", p["top"] == ["A1", "B", "M"], str(p))
    ck("W2 the old main item becomes the submenu item's first child", p["a1kids"] == ["A"], str(p))
    ck("W3 the old main item keeps its other children", p["akids"] == ["A2"], str(p))
    ck("W4 the promoted item is a dropdown while it has children", p["a1beh"] == "dropdown", str(p))
    ck("W5 a top-level item has no main item to swap with", "submenu" in o["parentTop"].lower() or "main" in o["parentTop"].lower(), o["parentTop"])
    ck("W6 a swap that would exceed three levels is refused", o["parentDeep"] != "ok", o["parentDeep"])
    ck("W7 a row swaps with the row below it", o["next"] == ["B", "A", "M"], str(o["next"]))
    ck("W8 the last row has nothing to swap with", "no item below" in o["nextLast"].lower(), o["nextLast"])
    ck("W9 a child row swaps inside its own list", o["nextChild"] == ["A2", "A1"], str(o["nextChild"]))

async def browser():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 1700})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)
        child = pg.locator(".m8-sub .m8-node.depth-1 > .m8-row").first
        if await child.count() == 0:
            ck("S0 the seed menu has a submenu item to test", False); await br.close(); return
        lbl = (await child.locator(".m8-row-label").text_content() or "").strip()
        await child.locator("button[aria-label^='More actions for']").click(); await pg.wait_for_timeout(150)
        item = pg.get_by_role("menuitem", name="Swap with Main Menu Item")
        ck("S1 the row menu offers Swap with Main Menu Item", await item.count() == 1)
        await item.click(); await pg.wait_for_timeout(300)
        top = [n.strip() for n in await pg.locator(".m8-tree > .m8-node > .m8-row .m8-row-label").all_text_contents()]
        ck("S2 the submenu item is now a main item after the swap", lbl in top, f"{lbl} not in {top[:5]}")
        ck("S3 no page errors during the swap", not errs, str(errs))
        await br.close()

if __name__ == "__main__":
    unit()
    asyncio.run(browser())
    print(f"\nqa_m8_swap · {TALLY['ok']}/{TALLY['ok']+TALLY['fail']} assertions passed")
