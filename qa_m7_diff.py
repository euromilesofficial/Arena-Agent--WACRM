#!/usr/bin/env python3
"""Module 7 — revision diff. The history drawer shows what changed, not only a count.

U  unit: src/lib/revision-diff.ts (bundled with esbuild, run in Node)
R  UI:   a saved header-variant change appears in the drawer's Changes list, and the
         first recorded revision says there is nothing to compare with
"""
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else "")); print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

UNIT_JS = r"""
const d = require(process.argv[2]);
const out = {};
const blk = (id, type, props) => ({ id, type, style: {}, props });
out.same = d.diffStructures({ a: 1, b: [blk('x','text',{t:'a'})] }, { a: 1, b: [blk('x','text',{t:'a'})] }).length;
out.changed = d.diffStructures({ name: 'A' }, { name: 'B' });
out.added = d.diffStructures({ slot: { seed: [] } }, { slot: { seed: [blk('h1','heading',{text:'Hi'})] } });
out.removed = d.diffStructures({ slot: { seed: [blk('h1','heading',{text:'Hi'}), blk('t1','text',{body:'x'})] } }, { slot: { seed: [blk('t1','text',{body:'x'})] } });
out.propChange = d.diffStructures({ slot: { seed: [blk('h1','heading',{text:'Hi'})] } }, { slot: { seed: [blk('h1','heading',{text:'Hello'})] } });
out.reorder = d.diffStructures({ slot: { seed: [blk('a','text',{}), blk('b','text',{})] } }, { slot: { seed: [blk('b','text',{}), blk('a','text',{})] } });
out.summary = d.diffSummary(d.diffStructures({ name: 'A' }, { name: 'B' }));
out.longLen = d.diffStructures({ desc: 'x'.repeat(300) }, { desc: 'y' }).map(l => l.before.length)[0];
out.firstRec = d.diffStructures({}, { name: 'A' }).length;
console.log(JSON.stringify(out));
"""

def unit():
    tmp = tempfile.mkdtemp()
    bundle = os.path.join(tmp, "rd.cjs")
    r = subprocess.run(["npx", "esbuild", "src/lib/revision-diff.ts", "--bundle", "--format=cjs", f"--outfile={bundle}", "--log-level=error"],
                       cwd="/home/user/wacrm-app", capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        ck("U0 the diff module bundles", False, r.stderr[:200]); return
    js = os.path.join(tmp, "t.cjs"); open(js, "w").write(UNIT_JS)
    r = subprocess.run(["node", js, bundle], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        ck("U0 the diff module runs in Node", False, r.stderr[:300]); return
    o = json.loads(r.stdout)
    ck("U1 identical structures produce no lines", o["same"] == 0)
    ck("U2 a changed scalar reports before and after", len(o["changed"]) == 1 and o["changed"][0]["path"] == "name" and o["changed"][0]["before"] == "A" and o["changed"][0]["after"] == "B", str(o["changed"]))
    ck("U3 an added block is named by type and id", len(o["added"]) == 1 and o["added"][0]["kind"] == "added" and "heading (h1)" in o["added"][0]["path"], str(o["added"]))
    ck("U4 a removed block is named by type and id", len(o["removed"]) == 1 and o["removed"][0]["kind"] == "removed" and "heading (h1)" in o["removed"][0]["path"], str(o["removed"]))
    ck("U5 a changed prop is reported at its block", len(o["propChange"]) == 1 and "heading (h1)" in o["propChange"][0]["path"] and o["propChange"][0]["after"] == "Hello", str(o["propChange"]))
    ck("U6 a reorder of the same blocks is not reported as add or remove", o["reorder"] == [], str(o["reorder"]))
    ck("U7 the summary counts each kind", o["summary"] == "1 changed", o["summary"])
    ck("U8 long values are shortened to one line", o["longLen"] <= 70, str(o["longLen"]))
    ck("U9 a first recorded structure lists every field as added", o["firstRec"] >= 1)

async def ui():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        await pg.goto(URL + "#/layouts"); await pg.reload(); await pg.wait_for_timeout(1500)

        # make a real saved change to the layout's header variant
        await pg.select_option("select[aria-label='Global Header variant']", "hdr_min")
        await pg.wait_for_timeout(320)
        await pg.click(".m7-insp-foot .btn-primary"); await pg.wait_for_timeout(1100)

        await pg.locator(".m7-insp-foot .btn:has-text('History')").click()
        await pg.wait_for_selector(".m7-hist-row:not(.is-skel)", timeout=8000)
        rows = pg.locator(".m7-hist-row:not(.is-skel)")
        ck("R1 the drawer lists the saved revisions", await rows.count() >= 2, str(await rows.count()))

        await rows.first.get_by_role("button", name="Changes").click(); await pg.wait_for_timeout(300)
        diff = pg.locator("[data-testid='rev-diff']")
        ck("R2 Changes opens a diff on the newest row", await diff.count() == 1)
        head = (await diff.first.locator(".m7-hist-diff-h").inner_text()) if await diff.count() else ""
        ck("R3 the diff names the revisions it compares", head.startswith("Changes from r"), head)
        body = (await diff.first.inner_text()) if await diff.count() else ""
        ck("R4 the diff names the header variant that changed", "variantId" in body or "header" in body, body[:200])
        await rows.first.get_by_role("button", name="Hide changes").click(); await pg.wait_for_timeout(200)
        ck("R5 Hide changes removes the diff", await pg.locator("[data-testid='rev-diff']").count() == 0)

        await rows.nth(await rows.count() - 1).get_by_role("button", name="Changes").click(); await pg.wait_for_timeout(300)
        oldest = (await pg.locator("[data-testid='rev-diff']").first.inner_text()) if await pg.locator("[data-testid='rev-diff']").count() else ""
        ck("R6 the oldest row says it has nothing to compare with", "nothing to compare" in oldest or "First recorded" in oldest, oldest[:160])

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

async def main():
    unit()
    await ui()
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_diff · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
