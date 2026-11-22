#!/usr/bin/env python3
"""Module 8 — row drag as WordPress does it: the whole row is the handle (pointer drag, browser).

P1  press on the row label (not the grip) and drag: the row moves to the new place
P2  a floating copy follows the pointer during the drag and is removed on drop
P3  dragging right under a top-level row nests the row one level deeper
P4  a click without movement still selects the row and does not start a drag
P5  Escape cancels a drag: nothing moves
P6  the grip is decorative and not a drag source
P7  releasing the pointer outside the menu cancels the drag: nothing moves
BX  no page errors
"""
import asyncio
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/menus"
TALLY = {"ok": 0, "fail": 0}
def ck(name, cond, extra=""):
    if cond: TALLY["ok"] += 1; print(f"OK   {name}")
    else: TALLY["fail"] += 1; print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

ROWS_JS = """() => [...document.querySelectorAll('.m8-row[data-row-id]')].map(r => ({
  id: r.dataset.rowId, label: r.dataset.rowLabel, level: Number(r.dataset.rowLevel), mega: r.classList.contains('is-mega'),
  box: (() => { const b = r.getBoundingClientRect(); return {x: b.left, y: b.top, w: b.width, h: b.height}; })() }))"""

async def rows(pg):
    return await pg.evaluate(ROWS_JS)

async def drag(pg, src_box, dst_x, dst_y, steps=14, escape=False):
    sx, sy = src_box["x"] + 60, src_box["y"] + src_box["h"] / 2
    await pg.mouse.move(sx, sy)
    await pg.mouse.down()
    for i in range(1, steps + 1):
        await pg.mouse.move(sx + (dst_x - sx) * i / steps, sy + (dst_y - sy) * i / steps)
        await pg.wait_for_timeout(16)
    if escape:
        await pg.keyboard.press("Escape")
    await pg.mouse.up()
    await pg.wait_for_timeout(260)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 1000})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL); await pg.reload(); await pg.wait_for_timeout(1500)
        mb = pg.get_by_role("tab", name="Menu Builder")
        if await mb.count(): await mb.first.click(); await pg.wait_for_timeout(250)
        await pg.evaluate("() => { document.querySelector('.m8-row[data-row-id]')?.scrollIntoView({block:'center'}); }")
        await pg.wait_for_timeout(200)
        r0 = await rows(pg)
        top = [r for r in r0 if r["level"] == 0]
        ck("setup: the menu has at least three top-level rows", len(top) >= 3, str([r["label"] for r in top]))
        if len(top) < 3:
            await br.close(); return

        # P4 a click selects, no drag
        await pg.mouse.click(top[1]["box"]["x"] + 60, top[1]["box"]["y"] + top[1]["box"]["h"] / 2)
        await pg.wait_for_timeout(150)
        sel = await pg.evaluate("(id) => document.querySelector(`.m8-row[data-row-id=\"${id}\"]`).getAttribute('aria-selected')", top[1]["id"])
        ck("P4 a plain click selects the row and does not move it", sel == "true" and [r["id"] for r in await rows(pg)] == [r["id"] for r in r0], str(sel))

        # P2 + P1: drag the second top-level row above the first; a ghost exists mid-drag
        r = await rows(pg); top = [x for x in r if x["level"] == 0]
        src, dst = top[1], top[0]
        sx, sy = src["box"]["x"] + 60, src["box"]["y"] + src["box"]["h"] / 2
        await pg.mouse.move(sx, sy); await pg.mouse.down()
        for i in range(1, 15):
            await pg.mouse.move(sx, sy - (sy - (dst["box"]["y"] + 4)) * i / 14); await pg.wait_for_timeout(16)
        ghosts = await pg.locator(".m8-row-ghost").count()
        ck("P2 a floating copy follows the pointer during the drag", ghosts == 1, str(ghosts))
        await pg.mouse.up(); await pg.wait_for_timeout(260)
        r2 = await rows(pg)
        top2 = [x["id"] for x in r2 if x["level"] == 0]
        ck("P1 dragging a row by its label moves it to the new place", top2[0] == src["id"], str(top2[:3]))
        ck("P2b the floating copy is removed on drop", await pg.locator(".m8-row-ghost").count() == 0)

        # P3 drag right under the first top-level row to nest it
        r = await rows(pg); top = [x for x in r if x["level"] == 0]
        # A mega item may only sit at the top level (spec), so the row that nests must be a plain item.
        plain = [x for x in top if not x["mega"]]
        ck("setup: two plain top-level rows exist for the nesting test", len(plain) >= 2)
        target, mover = plain[0], plain[1]
        ghost_x = mover["box"]["x"] + 80
        # The copy's left edge must move one indent (36 px) right of the target row's left edge.
        # The cursor sits 60 px into the row, so the cursor goes to target.x + 40 + 60.
        await drag(pg, mover["box"], target["box"]["x"] + 100, target["box"]["y"] + target["box"]["h"] - 2)
        r3 = await rows(pg)
        moved = next((x for x in r3 if x["id"] == mover["id"]), None)
        ck("P3 dragging right beneath a top-level row nests it one level deeper", moved is not None and moved["level"] == 1, str(moved and moved["level"]))

        # P3b drag left (copy edge back past the parent's depth) returns the row to the top level
        r = await rows(pg)
        child = next((x for x in r if x["level"] == 1), None)
        if child:
            prev = next((x for x in r if x["level"] == 0 and x["box"]["y"] < child["box"]["y"]), None)
            await drag(pg, child["box"], child["box"]["x"] - 110, (prev or child)["box"]["y"] + 4)
        r3b = await rows(pg)
        back = next((x for x in r3b if x["id"] == mover["id"]), None)
        ck("P3b dragging left returns the row to the top level", back is not None and back["level"] == 0, str(back and back["level"]))

        # P5 Escape cancels
        r = await rows(pg)
        before = [x["id"] for x in r]
        top = [x for x in r if x["level"] == 0]
        await drag(pg, top[0]["box"], top[-1]["box"]["x"] + 60, top[-1]["box"]["y"] + top[-1]["box"]["h"] - 2, escape=True)
        after = [x["id"] for x in await rows(pg)]
        ck("P5 Escape cancels a drag and nothing moves", before == after)

        # P6 the grip is not a drag source
        grip_draggable = await pg.evaluate("() => [...document.querySelectorAll('.m8-grip')].some(g => g.closest('[draggable=true]'))")
        ck("P6 the grip is decorative (no native drag source)", grip_draggable is False)
        # P7 release outside the list cancels
        r = await rows(pg); before = [x["id"] for x in r]
        top = [x for x in r if x["level"] == 0]
        sx, sy = top[0]["box"]["x"] + 60, top[0]["box"]["y"] + top[0]["box"]["h"] / 2
        await pg.mouse.move(sx, sy); await pg.mouse.down()
        for i in range(1, 12):
            await pg.mouse.move(sx + 10 * i, sy + 6 * i); await pg.wait_for_timeout(16)
        await pg.mouse.move(2, 2); await pg.mouse.up(); await pg.wait_for_timeout(260)
        ck("P7 releasing outside the menu cancels the drag", [x["id"] for x in await rows(pg)] == before)
        ck("BX no page errors", not errs, "; ".join(errs))
        await br.close()

asyncio.run(main())
print(f"\nqa_m8_pointer · {TALLY['ok']}/{TALLY['ok']+TALLY['fail']} assertions passed")
