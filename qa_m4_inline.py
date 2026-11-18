#!/usr/bin/env python3
"""Module 4 — inline editing: sync, keyboard undo, save, containers.

Complements qa_builder_inline.py (which covers each text kind and the undo button):
  S1  canvas edit appears in the inspector (same document)
  S2  inspector edit appears on the canvas (the reverse direction)
  U1  Ctrl+Z on the canvas, with no field focused, undoes the last edit
  P1  Save persists an inline edit across a tab switch in the same session
  D1  a button label edits in place and does not navigate
  C1  text inside a container (Boxed CTA section) is editable on the canvas, and the edit lands and shows in the inspector
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

async def blur(pg):
    await pg.evaluate("document.activeElement && document.activeElement.blur()")
    await pg.wait_for_timeout(300)

async def heading(pg):
    return pg.locator(".wb-doc .wb-el-edit[data-el='heading']").first

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        await pg.goto(URL + "#/builder"); await pg.reload(); await pg.wait_for_timeout(1800)

        h = await heading(pg)
        before = (await h.inner_text()).strip()

        # S1 — canvas edit shows in the inspector
        await h.click(); await pg.keyboard.press("Control+A")
        await pg.keyboard.type("QA sync one"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
        await h.click(); await pg.wait_for_timeout(300)
        field = pg.locator("[data-field='heading']").first
        ck("S1 the inspector shows the canvas edit", await field.count() == 1 and (await field.input_value()) == "QA sync one",
           (await field.input_value()) if await field.count() else "no heading field in inspector")

        # S2 — inspector edit shows on the canvas
        await field.fill("QA from inspector"); await pg.wait_for_timeout(400)
        ck("S2 the inspector edit reaches the canvas", (await (await heading(pg)).inner_text()).strip() == "QA from inspector",
           (await (await heading(pg)).inner_text()).strip())

        # U1 — Ctrl+Z with no field focused undoes the last edit
        await blur(pg)
        await pg.locator(".wb-doc").first.click(position={"x": 4, "y": 4}); await pg.wait_for_timeout(200)
        await blur(pg)
        await pg.keyboard.press("Control+z"); await pg.wait_for_timeout(400)
        after_undo = (await (await heading(pg)).inner_text()).strip()
        ck("U1 Ctrl+Z on the canvas undoes the last edit", after_undo == "QA sync one", after_undo)

        # P1 — Save persists across a tab switch within the session
        h = await heading(pg)
        await h.click(); await pg.keyboard.press("Control+A")
        await pg.keyboard.type("QA saved copy"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
        await pg.keyboard.press("Control+s")
        saved = False
        for _ in range(25):
            if await pg.locator("[data-status='saved']").count() == 1: saved = True; break
            await pg.wait_for_timeout(200)
        ck("P1a the draft reports saved after Save", saved)
        await pg.evaluate("location.hash = '#/pages'"); await pg.wait_for_timeout(700)
        await pg.evaluate("location.hash = '#/builder'"); await pg.wait_for_timeout(900)
        ck("P1b the saved edit is still on the canvas after leaving and returning",
           (await (await heading(pg)).inner_text()).strip() == "QA saved copy",
           (await (await heading(pg)).inner_text()).strip())

        # C1 — text inside a container (the Boxed CTA section is a container that holds blocks)
        await pg.click("#wb-tab-sections"); await pg.wait_for_timeout(300)
        idx = await pg.evaluate("""() => [...document.querySelectorAll('.wb-sec-card')].findIndex(c => (c.innerText || '').split('\\n').some(l => l.trim() === 'Boxed CTA'))""")
        if idx >= 0:
            await pg.locator(".wb-sec-card").nth(idx).locator(".wb-insert-btn").click(); await pg.wait_for_timeout(600)
        cont = pg.locator(".wb-doc .wb-container").first
        ck("C0 the Boxed CTA section inserts a container", idx >= 0 and await cont.count() == 1, f"idx={idx}")
        inner = pg.locator(".wb-doc .wb-container-box .wb-el-edit").first
        ck("C1a text inside the container is editable on the canvas", await inner.count() >= 1, str(await inner.count()))
        if await inner.count():
            await inner.click(); await pg.keyboard.press("Control+A")
            await pg.keyboard.type("Inside container"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
            got = (await pg.locator(".wb-doc .wb-container-box .wb-el-edit").first.inner_text()).strip()
            ck("C1b the edit lands inside the container", got == "Inside container", got)
            await pg.locator(".wb-doc .wb-container-box .wb-el-edit").first.click(); await pg.wait_for_timeout(300)
            ck("C1c the inspector shows the container child's edit", (await pg.locator("[data-field]").count()) > 0 and
               "Inside container" in await pg.evaluate("[...document.querySelectorAll('textarea,input')].map(e=>e.value).join('|')"))

        # D1 — a button label edits on the canvas, and clicking the button still does not navigate
        btn = pg.locator(".wb-doc .wb-el-edit[data-el='primaryLabel']").first
        ck("D0 a button label is editable on the canvas", await btn.count() == 1)
        if await btn.count():
            def route(h): return (h.split("?")[0], dict(q.split("=") for q in h.split("?")[1].split("&")).get("page") if "?" in h else None)
            start_route = route(await pg.evaluate("location.hash"))
            await btn.click(); await pg.keyboard.press("Control+A")
            await pg.keyboard.type("Start here"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
            got = (await pg.locator(".wb-doc .wb-el-edit[data-el='primaryLabel']").first.inner_text()).strip()
            ck("D1 the button label edit lands on the canvas", got == "Start here", got)
            # selecting the block rewrites sel= in the hash, so compare the route and the page only
            ck("D2 editing the label does not navigate away", route(await pg.evaluate("location.hash")) == start_route,
               str(route(await pg.evaluate("location.hash"))))

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m4_inline · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
