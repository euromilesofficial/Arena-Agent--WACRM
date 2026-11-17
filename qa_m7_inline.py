#!/usr/bin/env python3
"""Module 7 — inline editing on the canvas. Text is edited where the visitor sees it.

Checks the real behaviour: a click edits in place, typing keeps spaces, Enter commits,
Escape reverts, a hero link edits as text and stays a link, the inspector shows the same
value (one draft), Save is enabled, and the template canvas works the same way.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else ""))
        print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

async def go(pg, tab):
    await pg.goto(URL + "#/layouts")
    await pg.reload()
    await pg.wait_for_timeout(1500)
    await pg.get_by_role("tab", name=tab).click()
    await pg.wait_for_timeout(400)

async def blur(pg):
    # blur the focused field directly; clicking the header would hit its Prebuilt button
    await pg.evaluate("document.activeElement && document.activeElement.blur()")
    await pg.wait_for_timeout(250)

async def frame_text(pg):
    return (await pg.locator(".m7l-frame").first.inner_text()).lower()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        # ---------------- I · master layout, inline ----------------
        await go(pg, "Master Layouts")
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(400)
        heading = pg.locator(".m7l-blocks .wb-el-edit[data-el='heading']").first
        ck("I1 the hero heading on the canvas is editable in place", await heading.count() == 1)

        # I2: click, replace text, click away → commit
        await heading.click()
        await pg.keyboard.press("Control+A")
        await pg.keyboard.type("Inline edit works now")
        await blur(pg)
        ck("I2 typing on the canvas and clicking away commits to the canvas", "inline edit works now" in await frame_text(pg))

        # I3: the inspector shows the same value, because it is one draft
        await pg.get_by_role("tab", name="Structure").click(); await pg.wait_for_timeout(300)
        await pg.locator(".m7-seed").first.click(); await pg.wait_for_timeout(300)
        insp = pg.locator(".m7-bf textarea[id$='-heading']").first
        ck("I3 the inspector shows the inline edit (same draft)", (await insp.input_value()) == "Inline edit works now", await insp.input_value())

        # I4: spaces typed inline are kept (the block-select key handler must not swallow them)
        await pg.get_by_role("tab", name="Overview").click(); await pg.wait_for_timeout(200)
        await heading.click()
        await pg.keyboard.press("Control+A")
        await pg.keyboard.type("two  words here")
        await pg.keyboard.press("Enter")  # commit
        await pg.wait_for_timeout(300)
        ck("I4 spaces are kept while typing, and Enter commits", "two  words here" in await frame_text(pg) or "two words here" in await frame_text(pg),
           (await frame_text(pg))[:120])
        ck("I5 Enter leaves the field (it is no longer focused)", await pg.evaluate("document.activeElement?.getAttribute('data-el') !== 'heading'"))

        # I6: Escape reverts an unsaved change
        await heading.click()
        await pg.keyboard.press("Control+A")
        await pg.keyboard.type("should be discarded")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(250)
        ck("I6 Escape reverts to the stored text", "should be discarded" not in await frame_text(pg)
           and "two words here" in (await frame_text(pg)).replace("  ", " "))

        # I7: an empty edit does not blank the heading
        await heading.click()
        await pg.keyboard.press("Control+A"); await pg.keyboard.press("Backspace")
        await blur(pg)
        ck("I7 an empty edit is refused and the heading keeps its text", "two words here" in (await frame_text(pg)).replace("  ", " "))

        # I8: a hero link edits as text and stays a link
        # the AI Copy bubble opened by the heading sits beside it; dismiss it (Escape) before the next element
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        link = pg.locator(".m7l-blocks .wb-el-edit[data-el='primaryHref']").first
        ck("I8 the hero link target is editable on the canvas", await link.count() == 1)
        if await link.count():
            await link.click(); await pg.keyboard.press("Control+A")
            await pg.keyboard.type("/qa-programs"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
            await pg.get_by_role("tab", name="Structure").click(); await pg.wait_for_timeout(300)
            await pg.locator(".m7-seed").first.click(); await pg.wait_for_timeout(300)
            href = pg.locator(".m7-bf input[id$='-primaryHref']").first
            ck("I9 the link keeps its kind (a /path is a page link)", (await href.input_value()) == "/qa-programs", await href.input_value())

        # I10: Save is enabled and writes the draft
        await pg.get_by_role("tab", name="Overview").click(); await pg.wait_for_timeout(200)
        save = pg.get_by_role("button", name="Save", exact=True)
        ck("I10 an inline edit enables Save", await save.count() == 1 and await save.first.is_enabled())
        if await save.count() and await save.first.is_enabled():
            await save.first.click(); await pg.wait_for_timeout(900)
        # the prototype keeps its data in memory for the session, so "survives" means a round trip
        # through another screen tab within the same session, not a page reload
        await pg.get_by_role("tab", name="Page Templates").click(); await pg.wait_for_timeout(300)
        await pg.get_by_role("tab", name="Master Layouts").click(); await pg.wait_for_timeout(300)
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(400)
        ck("I11 the saved heading survives leaving and returning to the screen", "two words here" in (await frame_text(pg)).replace("  ", " "))

        # ---------------- T · page template, inline ----------------
        await go(pg, "Page Templates")
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(500)
        t_heading = pg.locator(".m7l-blocks .wb-el-edit").first
        ck("T1 a page template's text is editable on the canvas", await t_heading.count() == 1)
        if await t_heading.count():
            await t_heading.click(); await pg.keyboard.press("Control+A")
            await pg.keyboard.type("Template inline edit")
            await blur(pg)
            ck("T2 a template edit reaches its canvas", "template inline edit" in await frame_text(pg))
            save = pg.get_by_role("button", name="Save", exact=True)
            ck("T3 a template edit enables Save", await save.count() == 1 and await save.first.is_enabled())

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_inline · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
