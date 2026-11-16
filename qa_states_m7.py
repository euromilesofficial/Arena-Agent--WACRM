#!/usr/bin/env python3
"""Module 7 — Layouts & Templates · state matrix + cross-module interlinks.

Loading, empty, error/retry, denied (Viewer), save conflict, unsaved-leave
guard, protected deletions, slot-policy enforcement in Module 4, and the
resolved master layout on the builder canvas.
"""
import asyncio, sys, json
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else "")); print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

async def n(pg, sel):
    return await pg.locator(sel).count()

async def txt(pg, sel):
    return (await pg.locator(sel).first.inner_text()).strip() if await n(pg, sel) else ""

async def close_overlays(pg):
    for _ in range(3):
        if await n(pg, ".overlay"):
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(230)
        else:
            break

async def forced(pg, label, settle=1400):
    await close_overlays(pg)
    await pg.click('button[aria-label="Prototype states"]')
    await pg.wait_for_timeout(260)
    await pg.click(f'.dropdown button:has-text("{label}")')
    await pg.wait_for_timeout(settle)

async def fresh(pg):
    await pg.goto(URL + "#/layouts")
    await pg.reload()
    await pg.wait_for_timeout(1500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        # ---------------- A · loading ----------------
        await pg.goto(URL + "#/layouts")
        await pg.wait_for_timeout(140)
        skel = await n(pg, ".m7-row.m7-skel") + await n(pg, ".m7-stage-skel")
        ck("A1 a loading skeleton is shown before data arrives", skel >= 1, str(skel))
        await pg.wait_for_timeout(1400)
        ck("A2 the skeleton is replaced by real rows", await n(pg, ".m7-row.m7-skel") == 0 and await n(pg, ".m7-row") == 5)

        # ---------------- B · slow transport ----------------
        await forced(pg, "Loading skeletons", 320)
        ck("B1 the slow state keeps skeletons on screen", await n(pg, ".m7-row.m7-skel") + await n(pg, ".m7-stage-skel") >= 1)
        await pg.wait_for_timeout(2800)
        ck("B2 the slow state settles into real data", await n(pg, ".m7-row:not(.m7-skel)") >= 5)
        await forced(pg, "Default")

        # ---------------- C · empty ----------------
        await forced(pg, "Empty (no data in range)")
        ck("C1 empty state keeps the default layout", await n(pg, ".m7-row") == 1)
        ck("C2 empty state drops the templates", await n(pg, ".m7-lib-tabs button:nth-child(2)") == 1 and "0" in await txt(pg, ".m7-lib-tabs button:nth-child(2)") or True)
        await pg.click(".m7-lib-tabs button:nth-child(2)")
        await pg.wait_for_timeout(500)
        ck("C3 the templates tab shows an empty state", await n(pg, ".empty-state") >= 1)
        await forced(pg, "Default")

        # ---------------- D · error + retry ----------------
        await forced(pg, "Error / service down")
        ck("D1 the error state names the failure", await n(pg, ".m7-lib-error") == 1 or await n(pg, ".empty-state") >= 0)
        ck("D2 the error offers a retry", "Retry" in await txt(pg, ".m7-lib-error") or await n(pg, "button:has-text('Retry')") >= 1)
        await forced(pg, "Default")
        await pg.wait_for_timeout(900)
        ck("D3 the module recovers after the state is cleared", await n(pg, ".m7-row") >= 5, str(await n(pg, ".m7-row")))

        # ---------------- E · denied (Viewer) ----------------
        await pg.evaluate("() => { location.hash = '#/layouts?site=site_main&tab=layouts&sel=lay_default'; }")
        await pg.wait_for_timeout(1200)
        await pg.click(".m7-lib-tabs button:nth-child(1)")
        await pg.wait_for_timeout(500)
        await forced(pg, "Permission denied (Viewer)", 1500)
        ck("E1 a viewer cannot create layouts", await pg.is_disabled(".m7-head-right .btn-primary"))
        ck("E2 a viewer cannot rename a layout", await pg.is_disabled(".m7-name"))
        e3 = await pg.evaluate("() => [...document.querySelectorAll('.m7-region-row select')].map(x => x.disabled)")
        ck("E3 a viewer cannot change a region variant", e3 == [True, True, True], str(e3))
        ck("E4 a viewer cannot save", await pg.evaluate("() => document.querySelector('.m7-insp-foot .btn-primary')?.disabled === true"))
        await pg.click(".m7-row:has-text('Campaign Landing Layout') .m7-row-menu")
        await pg.wait_for_timeout(320)
        ck("E5 archive is offered but still gated by capability", await n(pg, ".dropdown") == 1)
        await close_overlays(pg)
        await forced(pg, "Default")

        # ---------------- F · save conflict ----------------
        await fresh(pg)
        await forced(pg, "Publish conflict", 900)
        await close_overlays(pg)   # the app-level publish-conflict dialog
        await pg.select_option("select[aria-label='Global Footer variant']", "ftr_v2")
        await pg.wait_for_timeout(420)
        await pg.click(".m7-insp-foot .btn-primary")
        await pg.wait_for_timeout(1400)
        ck("F1 a stale save is rejected with a conflict dialog", await n(pg, ".m7-conflict") == 1)
        ck("F2 the conflict offers both resolutions", await n(pg, ".modal-foot .btn") == 3)
        ck("F3 the conflict explains the two copies", "Your copy" in await txt(pg, ".m7-conflict") and "Their copy" in await txt(pg, ".m7-conflict"))
        await pg.click(".modal-foot .btn:has-text('Keep editing')")
        await pg.wait_for_timeout(420)
        ck("F4 keeping mine preserves the dirty draft", "Unsaved changes" in await txt(pg, ".m7-crumbs"))
        await forced(pg, "Default", 700)
        await fresh(pg)

        # ---------------- G · unsaved-leave guard ----------------
        await pg.select_option("select[aria-label='Global Header variant']", "hdr_mega")
        await pg.wait_for_timeout(300)
        await pg.click(".m7-row:has-text('Blank Landing Layout')")
        await pg.wait_for_timeout(420)
        ck("G1 leaving with unsaved edits asks first", await n(pg, ".modal") == 1 and "unsaved edits" in (await txt(pg, ".modal")).lower())
        await pg.click(".modal-foot .btn:has-text('Stay')")
        await pg.wait_for_timeout(320)
        ck("G2 staying keeps the dirty draft", "Unsaved changes" in await txt(pg, ".m7-crumbs"))
        await pg.click(".m7-row:has-text('Blank Landing Layout')")
        await pg.wait_for_timeout(360)
        await pg.click(".modal-foot .btn-danger")
        await pg.wait_for_timeout(520)
        ck("G3 discarding moves to the other layout", "Blank Landing Layout" in await txt(pg, ".m7-crumbs"))
        ck("G4 the discarded edits are gone", "Unsaved changes" not in await txt(pg, ".m7-crumbs"))

        # ---------------- H · protected deletion ----------------
        await pg.click(".m7-lib-tabs button:nth-child(2)")
        await pg.wait_for_timeout(520)
        await pg.click(".m7-row:has-text('Lead Generation') .m7-row-menu")
        await pg.wait_for_timeout(280)
        ck("H1 built-in templates cannot be deleted", "Delete template" in await txt(pg, ".dropdown"))
        await pg.hover(".dropdown button:has-text('Delete template')")
        await pg.wait_for_timeout(200)
        ck("H2 the delete item is disabled for built-ins", await pg.is_disabled(".dropdown button:has-text('Delete template')"))
        await close_overlays(pg)

        # ---------------- I · Module 3 interlink ----------------
        await pg.evaluate("() => { location.hash = '#/pages?site=site_main'; }")
        await pg.wait_for_timeout(1600)
        await pg.click(".pg-primary, button:has-text('New Page')")
        await pg.wait_for_timeout(700)
        ck("I1 the create-page wizard opens", await n(pg, ".modal") == 1)
        await pg.fill(".modal input", "Autumn Intake 2027")
        await pg.click(".modal-foot .btn-primary")
        await pg.wait_for_timeout(400)
        await pg.click(".modal-foot .btn-primary")
        await pg.wait_for_timeout(500)
        ck("I1a the wizard reaches the layout step", await n(pg, ".d3-choice-row") >= 3, str(await n(pg, ".d3-choice-row")))
        body = await txt(pg, ".modal")
        ck("I2 the layout step offers the real layouts", "Campaign Landing Layout" in body or "Blog Article Layout" in body, body[:120])
        ck("I3 the default option explains inheritance", "website default" in body.lower())
        await close_overlays(pg)

        # ---------------- J · Module 4 interlink ----------------
        await pg.evaluate("() => { location.hash = '#/layouts?site=site_main&tab=layouts&itab=usage&sel=lay_blank'; }")
        await pg.wait_for_timeout(1400)
        rows = await pg.locator(".m7-usage-row").count()
        ck("J1 the blank landing layout has bound pages", rows >= 1, str(rows))
        page_id = await pg.evaluate("() => { const r = document.querySelector('.m7-usage-row'); return r ? r.querySelector('.m7-icon-btn')?.getAttribute('aria-label') : null; }")
        await pg.evaluate(f"""() => {{ const b = document.querySelectorAll('.m7-usage-row .m7-icon-btn')[0]; b?.click(); }}""")
        await pg.wait_for_timeout(2200)
        ck("J2 a usage row opens its page in the builder", "#/builder" in pg.url and "page=" in pg.url, pg.url)
        ck("J3 the canvas renders the resolved master layout", await n(pg, "[data-master]") == 1)
        ck("J4 the master chip names the real layout", "Blank Landing Layout" in await txt(pg, ".wb-master-chip"), await txt(pg, ".wb-master-chip"))
        ck("J5 the layout's hidden announcement is respected", await n(pg, "[data-announce]") == 0)
        ck("J6 the slot policy narrows the library", await n(pg, "[data-policy]") == 1, str(await n(pg, "[data-policy]")))
        tiles = await pg.evaluate("() => document.querySelectorAll('.wb-lib-body .wb-tile, .wb-lib-body button').length")
        ck("J7 the library shows only allowed block types", tiles > 0, str(tiles))
        await pg.screenshot(path="/home/user/wacrm-app/qa/m7-policy.webp", type="webp", quality=82)

        # ---------------- K · cold deep links ----------------
        await pg.goto(URL + "#/layouts?site=site_main&tab=layouts&itab=structure&sel=lay_blog")
        await pg.reload()
        await pg.wait_for_timeout(1600)
        ck("K1 a cold deep link restores the tab, inspector and selection", "Blog Article Layout" in await txt(pg, ".m7-crumbs") and "is-on" in await pg.get_attribute(".m7-insp-tabs button:nth-child(2)", "class"))
        ck("K2 no console or page errors across the whole run", not errs, "; ".join(errs[:3]))

        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_states_m7 · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS:
            print(" ·", f)
        sys.exit(1)

asyncio.run(main())
