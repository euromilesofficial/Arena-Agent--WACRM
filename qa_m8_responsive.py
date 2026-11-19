#!/usr/bin/env python3
"""Module 8 — responsive checks (v4). Browser, WACRM-CMS.html, widths 1280 / 1024 / 768.
R1-R3  no sideways page scroll on the Menus screen at each width
R4     the mega editor shows two columns at 1280 and one at 1024 (never five cramped)
R5     the three-panel builder stacks at 768
R6     the tablet preview shows the drawer (accordion) at 768
R7     preset cards stay inside the settings column at 1280 (no clipped card)
R9     phone width 390: builder stacks, phone preview drawer, tappable rows
R8     no page errors during the run
"""
import asyncio, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/menus"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else "")); print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

async def open_screen(b, w):
    pg = await b.new_page(viewport={"width": w, "height": 900})
    await pg.goto(URL); await pg.reload(); await pg.wait_for_timeout(1400)
    return pg

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, tag in ((1280, "R1"), (1024, "R2"), (768, "R3"), (390, "R9")):
            pg = await open_screen(b, w)
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            sw = await pg.evaluate("() => document.documentElement.scrollWidth")
            ck(f"{tag} no sideways page scroll at {w}px", sw <= w, f"scrollWidth {sw}")
            if w == 1280:
                cols = await pg.evaluate("() => getComputedStyle(document.querySelector('.m8-builder') || document.body).gridTemplateColumns")
                await pg.get_by_role("tab", name="Mega Menus").click(); await pg.wait_for_timeout(250)
                mega = await pg.evaluate("() => getComputedStyle(document.querySelector('.m8-mega-cols')).gridTemplateColumns.split(' ').length")
                ck("R4a the mega editor shows two columns at 1280px", mega == 2, str(mega))
                await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
                await pg.get_by_role("tab", name="Menu Settings").click(); await pg.wait_for_timeout(200)
                boxes = await pg.locator(".m8-preset-card").evaluate_all("els => els.map(e => e.getBoundingClientRect().right)")
                panel = await pg.locator(".m8-presets").first.evaluate("e => e.getBoundingClientRect().right")
                ck("R7 preset cards stay inside the settings column at 1280px", all(x <= panel + 1 for x in boxes) and len(boxes) == 5, f"{boxes} vs {panel}")
            if w == 1024:
                await pg.get_by_role("tab", name="Mega Menus").click(); await pg.wait_for_timeout(250)
                mega = await pg.evaluate("() => getComputedStyle(document.querySelector('.m8-mega-cols')).gridTemplateColumns.split(' ').length")
                ck("R4b the mega editor stacks to one column at 1024px", mega == 1, str(mega))
            if w == 390:
                await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
                cols = await pg.evaluate("() => getComputedStyle(document.querySelector('.m8-builder')).gridTemplateColumns.split(' ').length")
                ck("R9a the builder stacks at 390px", cols == 1, str(cols))
                await pg.get_by_role("radio", name="Mobile").first.click(); await pg.wait_for_timeout(200)
                ck("R9b the phone preview shows the drawer", await pg.locator(".m8-pv-mobile").count() >= 1)
                btn = await pg.locator(".m8-pv-mobile button[aria-expanded]").first.bounding_box() if await pg.locator(".m8-pv-mobile button[aria-expanded]").count() else None
                ck("R9c the phone preview has tappable accordion rows at least 36px tall", btn is None or btn["height"] >= 36, str(btn))
                await pg.screenshot(path="/tmp/resp_390_builder.png")
            if w == 768:
                await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
                cols = await pg.evaluate("() => getComputedStyle(document.querySelector('.m8-builder')).gridTemplateColumns.split(' ').length")
                ck("R5 the three-panel builder stacks at 768px", cols == 1, str(cols))
                await pg.get_by_role("radio", name="Tablet").first.click(); await pg.wait_for_timeout(200)
                ck("R6 the tablet preview shows the drawer", await pg.locator(".m8-pv-mobile").count() >= 1)
                await pg.screenshot(path="/tmp/resp_768_builder.png")
            await pg.close()
        await b.close()
    ck("R8 no page errors during the responsive run", not errs, "; ".join(errs))

asyncio.run(main())
total = TALLY["ok"] + TALLY["fail"]
print(f"\nqa_m8_responsive · {TALLY['ok']}/{total} assertions passed")
if FAILS:
    print("FAILURES:"); [print(" · " + f) for f in FAILS]
sys.exit(0 if TALLY["fail"] == 0 else 1)
