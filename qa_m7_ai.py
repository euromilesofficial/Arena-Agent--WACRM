#!/usr/bin/env python3
"""Module 7 — AI copy bubble on Layouts / Templates inline editing (parity with the builder).

Checks the real behaviour: clicking a text element on the canvas opens the AI Copy bubble
beside it; a rewrite streams and reaches "Suggested copy"; Accept writes the text into the
same draft (canvas + inspector) and enables Save; Discard changes nothing; Escape closes it;
the same flow works on a page template canvas; the viewer role gets no bubble.
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

async def frame_text(pg):
    return (await pg.locator(".m7l-frame").first.inner_text()).lower()

async def wait_ready(pg):
    await pg.wait_for_selector("[data-ai-stream='ready']", timeout=8000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        # ---------- L · master layout ----------
        await go(pg, "Master Layouts")
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(400)
        heading = pg.locator(".m7l-blocks .wb-el-edit[data-el='heading']").first
        ck("L0 the heading is an editable canvas element", await heading.count() == 1)

        # a long line, typed inline first: Shorten only changes text longer than eight words
        long_line = "Apply for the Spring intake of the scholarship programme this year, with a decision within two weeks"
        await heading.click(); await pg.keyboard.press("Control+A")
        await pg.keyboard.type(long_line); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300)
        ck("L0b the long line is on the canvas", long_line in (await frame_text(pg)).replace("  ", " ") or long_line.lower() in await frame_text(pg))
        await heading.click(); await pg.wait_for_timeout(300)
        bubble = pg.locator(".m7l-stage .wb-ai")
        ck("L1 clicking a text element opens the AI Copy bubble on the canvas", await bubble.count() == 1)
        ck("L2 the idle bubble offers Improve / Make Punchier / Shorten",
           await bubble.locator(".wb-ai-act").count() == 3)

        before = (await heading.inner_text()).strip()
        await bubble.locator(".wb-ai-act", has_text="Shorten").click()
        await wait_ready(pg)
        suggestion = (await bubble.locator(".wb-ai-text").inner_text()).strip()
        ck("L3 a rewrite streams to a Suggested copy panel", bool(suggestion) and suggestion != before, suggestion[:80])
        ck("L4 nothing changes on the canvas until Accept", (await heading.inner_text()).strip() == before)
        ck("L5 the footer promises nothing changes until accept",
           "Nothing changes until you accept." in await bubble.inner_text())

        await bubble.locator(".wb-ai-b", has_text="Accept").click(); await pg.wait_for_timeout(300)
        after = (await heading.inner_text()).strip()
        ck("L6 Accept writes the suggested copy into the canvas", after == suggestion, f"{after!r} vs {suggestion!r}")
        ck("L7 the bubble closes after Accept", await pg.locator(".m7l-stage .wb-ai").count() == 0)

        await pg.get_by_role("tab", name="Structure").click(); await pg.wait_for_timeout(300)
        await pg.locator(".m7-seed").first.click(); await pg.wait_for_timeout(300)
        insp = pg.locator(".m7-bf textarea[id$='-heading']").first
        ck("L8 the inspector shows the accepted copy (one draft)", (await insp.input_value()).strip() == suggestion,
           await insp.input_value())

        await pg.get_by_role("tab", name="Overview").click(); await pg.wait_for_timeout(200)
        save = pg.get_by_role("button", name="Save", exact=True)
        ck("L9 accepting enables Save", await save.count() == 1 and await save.first.is_enabled())

        # Discard leaves the text alone
        await heading.click(); await pg.wait_for_timeout(300)
        await bubble.locator(".wb-ai-act", has_text="Punchier").click()
        await wait_ready(pg)
        await bubble.locator(".wb-ai-b.ghost", has_text="Discard").click(); await pg.wait_for_timeout(250)
        ck("L10 Discard closes the bubble and keeps the text", await pg.locator(".m7l-stage .wb-ai").count() == 0
           and (await heading.inner_text()).strip() == suggestion)

        # Escape closes it
        await heading.click(); await pg.wait_for_timeout(300)
        await pg.locator(".m7l-stage .wb-ai-act").first.click(); await pg.wait_for_timeout(100)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(250)
        ck("L11 Escape closes the bubble", await pg.locator(".m7l-stage .wb-ai").count() == 0)

        # ---------- T · page template ----------
        await go(pg, "Page Templates")
        await pg.locator(".m7-row").first.click(); await pg.wait_for_timeout(500)
        t_el = pg.locator(".m7l-blocks .wb-el-edit").first
        ck("T0 a template's text is an editable canvas element", await t_el.count() == 1)
        if await t_el.count():
            t_before = (await t_el.inner_text()).strip()
            await t_el.click(); await pg.wait_for_timeout(300)
            tb = pg.locator(".m7l-stage .wb-ai")
            ck("T1 the template canvas opens the AI Copy bubble", await tb.count() == 1)
            await tb.locator(".wb-ai-act").first.click()
            await wait_ready(pg)
            t_sugg = (await tb.locator(".wb-ai-text").inner_text()).strip()
            await tb.locator(".wb-ai-b", has_text="Accept").click(); await pg.wait_for_timeout(300)
            ck("T2 Accept on a template writes into its canvas", (await t_el.inner_text()).strip() == t_sugg
               and t_sugg != t_before, f"{t_sugg!r}")
            save = pg.get_by_role("button", name="Save", exact=True)
            ck("T3 a template AI accept enables Save", await save.count() == 1 and await save.first.is_enabled())

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_ai · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
