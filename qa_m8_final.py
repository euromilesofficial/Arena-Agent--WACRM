#!/usr/bin/env python3
"""Module 8 — closing gaps (browser, Playwright, WACRM-CMS.html).

L1  Layouts owns the slot bindings: the header and footer menu selectors edit the placement draft
L2  an occupied header slot asks first ("Replace in Draft") and Cancel leaves it unchanged
L3  the header can't be unassigned
L4  the Layouts preview pins the layout revision and the live menu revisions, and shows the live menu's nav
L5  a menu-bound footer shows its groups read-only in the drawer and says where to edit them
L6  no page errors during the run
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

async def browser():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL + "#/layouts"); await pg.reload(); await pg.wait_for_timeout(1500)

        hdr = pg.get_by_label("Header menu for this layout")
        ftr = pg.get_by_label("Footer menu for this layout")
        ck("L1a the header menu selector is on the layout", await hdr.count() == 1, str(await hdr.count()))
        ck("L1b the footer menu selector is on the layout", await ftr.count() == 1, str(await ftr.count()))

        # L2: choosing another header menu asks first
        await hdr.select_option(label="Utility Menu"); await pg.wait_for_timeout(300)
        ck("L2a an occupied header slot asks before replacing", await pg.get_by_role("button", name="Replace in Draft").count() == 1)
        await pg.get_by_role("button", name="Cancel").last.click(); await pg.wait_for_timeout(200)
        ck("L2b Cancel keeps the header menu", await hdr.input_value() != "" and await pg.get_by_role("button", name="Replace in Draft").count() == 0)

        # L3: the header can't be unassigned (the select has no empty option)
        opts = await hdr.locator("option").all_text_contents()
        ck("L3 the header selector has no 'None' choice", "None" not in opts, str(opts))

        # L1c: a footer change saves to the placement draft (toast)
        await ftr.select_option(label="Utility Menu"); await pg.wait_for_timeout(300)
        await pg.get_by_role("button", name="Replace in Draft").click(); await pg.wait_for_timeout(3000)
        ck("L1c a footer change saves the placement draft", await ftr.input_value() == "menu_utility", await ftr.input_value())
        await ftr.select_option(label="Footer Navigation"); await pg.wait_for_timeout(400)
        if await pg.get_by_role("button", name="Replace in Draft").count():
            await pg.get_by_role("button", name="Replace in Draft").click(); await pg.wait_for_timeout(3000)

        # L4: preview pins revisions and shows the live menu nav
        prev = pg.get_by_role("button", name="Preview Layout")
        if await prev.count():
            await prev.first.click(); await pg.wait_for_timeout(400)
        pin = pg.locator(".m7-pv-pin")
        ck("L4a the preview shows the pinned layout revision", await pin.count() == 1 and "Pinned at open: layout rev" in (await pin.inner_text()))
        ck("L4b the preview names the header menu and its live revision", await pin.count() == 1 and "live rev" in (await pin.inner_text()))
        nav = await pg.locator(".m7-pv-header nav span").all_text_contents()
        ck("L4c the preview header shows the live menu's links", "Home" in nav and "Study Abroad" in nav, str(nav))
        ck("L4d the preview footer lists its groups", await pg.locator(".m7-pv-footer b").count() >= 1)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)

        # L5: footer drawer. A footer is menu-bound only after a publish compiles the footer menu into it.
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("tab", name="Menu Settings").click(); await pg.wait_for_timeout(200)
        await pg.get_by_label("Menu name").fill("Primary Navigation (live)"); await pg.wait_for_timeout(200)
        await pg.get_by_role("button", name="Save Draft").first.click(); await pg.wait_for_timeout(500)
        await pg.get_by_role("button", name="Publish Changes").first.click(); await pg.wait_for_timeout(400)
        await pg.get_by_role("dialog").get_by_role("button", name="Publish").first.click(); await pg.wait_for_timeout(900)
        await pg.get_by_role("tab", name="Manage Menus").click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
        await pg.evaluate("location.hash = '#/layouts'"); await pg.wait_for_timeout(1200)
        await pg.get_by_label("Edit Global Footer").first.click(); await pg.wait_for_timeout(400)
        ck("L5a the footer drawer says the columns come from the menu", await pg.get_by_text("Link columns come from the footer menu").count() == 1)
        ck("L5b no typed column inputs for a menu-bound footer", await pg.get_by_label("Column 2 title").count() == 0)
        ck("L5c the footer drawer shows its menu sync state", await pg.get_by_text("In sync with the live menu").count() >= 1 or await pg.get_by_text("Out of date").count() >= 1)

        ck("L6 no page errors during the run", not errs, "; ".join(errs[:3]))
        await b.close()

def main():
    try:
        asyncio.run(browser())
    except Exception as e:
        ck("L0 the browser run completes", False, str(e)[:300])
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m8_final · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:"); [print(" · " + f) for f in FAILS]
    sys.exit(0 if TALLY["fail"] == 0 else 1)

if __name__ == "__main__":
    main()
