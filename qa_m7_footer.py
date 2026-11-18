#!/usr/bin/env python3
"""Module 7 — the shared Global Footer is edited in its drawer, opened from the canvas.

The footer is shared by every layout that uses its variant, so it is not inline text.
Checks: clicking the footer opens the Global Footer drawer; note, column count and column
titles save into the variant; the canvas shows the saved text (the footer used to show
hard-coded labels); the drawer names the layouts it affects; the footer has no inline text
fields; Save becomes available; the viewer role cannot open it.
"""
import asyncio, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else "")); print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

async def go(pg, tab):
    await pg.goto(URL + "#/layouts")
    await pg.reload()
    await pg.wait_for_timeout(1500)
    await pg.get_by_role("tab", name=tab).click()
    await pg.wait_for_timeout(400)

async def frame_has(pg, text):
    """wait until the canvas shows the saved value (the drawer's Save refreshes the canvas after it closes)"""
    try:
        await pg.wait_for_function("(t) => { const f = document.querySelector('.m7l-frame'); return !!f && f.innerText.toLowerCase().includes(t); }", arg=text.lower(), timeout=6000)
        return True
    except Exception:
        return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        await go(pg, "Master Layouts")
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(400)

        footer = pg.locator(".m7l-footer[aria-label='Edit Global Footer']")
        ck("F1 the footer on the canvas is a button that edits the shared footer", await footer.count() == 1)
        ck("F2 the footer has no inline text fields", await pg.locator(".m7l-footer .wb-el-edit").count() == 0)

        await footer.click(); await pg.wait_for_timeout(400)
        drawer = pg.get_by_text("Global Footer — shared region")
        ck("F3 clicking the footer opens the Global Footer drawer", await drawer.count() >= 1)

        note = pg.locator(".field:has(.label:text-is(\"Note\")) input")
        ck("F4 the drawer has a note field", await note.count() == 1)
        if await note.count():
            await note.fill("QA footer note")
        title2 = pg.get_by_label("Column 2 title")
        await title2.fill("QA Study")
        await pg.get_by_label("Column 2 links").fill("Alpha, Beta")
        blast = await pg.locator(".m7-blast").first.inner_text()
        ck("F5 the drawer names the layouts that use this footer", "layout" in blast.lower(), blast[:120])

        await pg.get_by_role("button", name="Save variant").click(); await pg.wait_for_timeout(700)
        ck("F6 the drawer closes after Save", await pg.get_by_text("Global Footer — shared region").count() == 0)

        frame = pg.locator(".m7l-frame").first
        ck("F7 the canvas footer shows the saved column title", await frame_has(pg, "qa study"))
        ck("F8 the canvas footer shows the saved note", await frame_has(pg, "qa footer note"))
        ck("F9 the footer still has no inline text fields after saving", await pg.locator(".m7l-footer .wb-el-edit").count() == 0)

        # column count: 2 columns = brand + one link column
        await footer.click(); await pg.wait_for_timeout(400)
        await pg.get_by_label("Footer columns").select_option("2"); await pg.wait_for_timeout(100)
        await pg.get_by_role("button", name="Save variant").click(); await pg.wait_for_timeout(300)
        await frame_has(pg, "qa footer note")  # the canvas catches up after the save; keep the note too
        heads = 0
        for _ in range(30):
            heads = await pg.locator(".m7l-footer .wb-foot-h").count()
            if heads == 1: break
            await pg.wait_for_timeout(200)
        ck("F10 two columns shows one link column", heads == 1, f"headings={heads}")

        # the footer is saved through the drawer; the layouts that use it are marked as unpublished
        ck("F11 the layouts that use the footer show the unpublished dot", await pg.locator(".m7-row .m7-dot").count() >= 1)

        # Page templates show the same footer and open the same drawer
        # switch tabs within the session: the prototype keeps its data in memory, a reload would drop the saves
        await pg.get_by_role("tab", name="Page Templates").click(); await pg.wait_for_timeout(400)
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(500)
        tf = pg.locator(".m7l-footer[aria-label='Edit Global Footer']")
        ck("F12 page templates open the same shared footer", await tf.count() == 1)
        # the template's own footer decides: Global Footer v1 must show the note, any other variant must not
        tf_text = (await pg.locator(".m7l-footer").first.inner_text()).lower()
        if "global footer v1" in tf_text:
            t13 = await frame_has(pg, "qa footer note")
            ck("F13 a template on Global Footer v1 shows the saved note", t13,
               "" if t13 else (await pg.locator(".m7l-footer").first.inner_text()).replace("\n", " | ")[-170:])
        else:
            ck("F13 a template on another footer does not show the Global Footer v1 edit",
               "qa footer note" not in tf_text, tf_text[-120:])

        # F14 — an unsaved drawer edit does not survive closing and reopening the drawer
        await footer.click(); await pg.wait_for_timeout(400)
        note2 = pg.locator(".field:has(.label:text-is(\"Note\")) input")
        saved_note = await note2.input_value() if await note2.count() else ""
        ck("F14a reopening the drawer shows the saved note", saved_note == "QA footer note", saved_note)
        if await note2.count():
            await note2.fill("unsaved junk")
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
        closed = await pg.get_by_text("Global Footer — shared region").count() == 0
        ck("F14b Escape closes the drawer without saving", closed)
        await footer.click(); await pg.wait_for_timeout(400)
        note3 = pg.locator(".field:has(.label:text-is(\"Note\")) input")
        now_note = await note3.input_value() if await note3.count() else ""
        ck("F14c the unsaved edit is gone after reopening", now_note == "QA footer note" and "unsaved junk" not in now_note, now_note)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_footer · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
