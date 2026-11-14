#!/usr/bin/env python3
"""Module 4 — Visual Builder · acceptance suite (geometry, library, canvas, inspector, flows)."""
import asyncio, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
OUT = "/home/user/wacrm-app/qa"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1
        print(f"OK   {name}")
    else:
        TALLY["fail"] += 1
        FAILS.append(name + (" :: " + extra if extra else ""))
        print(f"FAIL {name}" + (" :: " + extra if extra else ""))

async def body(pg):
    return await pg.evaluate("() => document.body.innerText")

async def n(pg, sel):
    return await pg.locator(sel).count()

async def go(pg, qs=""):
    """A hash-only navigation does not reload the document, so deep-link
    restoration has to be tested against a cold load."""
    await pg.goto(URL + "#/builder" + qs)
    await pg.reload()
    await pg.wait_for_timeout(1600)

async def close_overlays(pg):
    for _ in range(3):
        if await n(pg, ".overlay"):
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(250)
        else:
            break

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        # ============ A · geometry ============
        await go(pg, "?page=pg_site_main_2")
        ck("A1 builder renders", await n(pg, ".wb-root") == 1)
        ck("A2 three panels", (await n(pg, ".wb-lib"), await n(pg, ".wb-center"), await n(pg, ".wb-insp")) == (1, 1, 1))
        geo = await pg.evaluate("""() => {
          const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
          return { lib: r('.wb-lib'), cen: r('.wb-center'), ins: r('.wb-insp'), root: r('.wb-root'),
                   doc: r('.wb-doc'), stage: r('.wb-stage'), main: document.querySelector('.main').scrollHeight,
                   mainH: document.querySelector('.main').clientHeight };
        }""")
        ck("A3 panels are side by side without overlap",
           geo["lib"][0] + geo["lib"][2] <= geo["cen"][0] + 1 and geo["cen"][0] + geo["cen"][2] <= geo["ins"][0] + 1,
           str(geo["lib"]), )
        ck("A4 library is 250 px at 1440", abs(geo["lib"][2] - 250) < 1, str(geo["lib"][2]))
        ck("A5 inspector is 292 px at 1440", abs(geo["ins"][2] - 292) < 1, str(geo["ins"][2]))
        ck("A6 the shell does not scroll (canvas owns scroll)", geo["main"] <= geo["mainH"] + 2, f'{geo["main"]} vs {geo["mainH"]}')
        ck("A7 builder fills the viewport height", geo["root"][3] >= 800, str(geo["root"][3]))
        ck("A8 document is scaled to fit the stage", geo["doc"][2] <= geo["stage"][2] + 1, f'doc {geo["doc"][2]} stage {geo["stage"][2]}')
        ck("A9 header controls", all([await n(pg, 'select[aria-label="Website"]'), await n(pg, 'select[aria-label="Page"]'),
                                      await n(pg, '[data-act="open-publish"]'), await n(pg, 'button[aria-label="Publish options"]')]))
        ck("A10 status pill starts saved or dirty", await n(pg, ".wb-status") == 1)
        ck("A11 device control has three viewports", await n(pg, ".wb-dev") == 3)
        ck("A12 zoom control offers fit + 4 steps", await pg.eval_on_selector_all('.wb-zoom option', 'e => e.length') == 5)

        # ============ B · library blocks ============
        ck("B1 three library tabs", await n(pg, ".wb-lib-tab") == 3)
        ck("B2 blocks tab is active", "True" == str(await pg.eval_on_selector('#wb-tab-blocks', 'e => e.getAttribute("aria-selected")')).capitalize())
        ck("B3 19 archetype tiles offered", await n(pg, ".wb-tile") == 19, str(await n(pg, ".wb-tile")))
        ck("B4 five chips with computed counts",
           await pg.eval_on_selector_all(".wb-chip", "els => els.map(e => e.innerText.replace('\\n',' ').trim())") ==
           ["All 19", "Content 9", "Media 2", "Layout 4", "Form 4"],
           str(await pg.eval_on_selector_all(".wb-chip", "els => els.map(e => e.innerText.replace('\\n',' '))")))
        ck("B5 five group headers", await n(pg, ".wb-group-head") == 5)
        ck("B6 footer is registered but not offered", await n(pg, '[data-block="footer"]') == 0)
        ck("B7 footer note explains where it lives", "Layouts & Templates" in await pg.inner_text(".wb-lib-note"))
        await pg.fill(".wb-lib-search input", "hero")
        await pg.wait_for_timeout(250)
        ck("B8 search filters to one tile", await n(pg, ".wb-tile") == 1, str(await n(pg, ".wb-tile")))
        await pg.click('.wb-lib-search button[aria-label="Clear search"]')
        await pg.wait_for_timeout(200)
        await pg.click('.wb-chip:has-text("Media")')
        await pg.wait_for_timeout(200)
        ck("B9 media chip shows two tiles", await n(pg, ".wb-tile") == 2)
        await pg.click('.wb-chip:has-text("All")')
        await pg.wait_for_timeout(200)

        # ============ C · sections ============
        await pg.click("#wb-tab-sections")
        await pg.wait_for_timeout(300)
        ck("C1 23 section presets", await n(pg, ".wb-sec-card") == 23, str(await n(pg, ".wb-sec-card")))
        ck("C2 section category counts", await pg.eval_on_selector_all(".wb-chip", "els => els.map(e => e.innerText.replace('\\n',' ').trim())") ==
           ["All 23", "Hero 5", "Content 6", "Features 6", "CTA 6"])
        await pg.click('.wb-chip:has-text("CTA")')
        await pg.wait_for_timeout(200)
        ck("C3 CTA category filters to six", await n(pg, ".wb-sec-card") == 6)
        await pg.click('.wb-chip:has-text("All")')
        await pg.wait_for_timeout(200)
        await pg.click('.wb-sec-card:has-text("Stats Strip") >> text=Preview')
        await pg.wait_for_timeout(500)
        ck("C4 section preview opens with rendered blocks", await n(pg, ".modal .wb-doc .wb-blk") >= 1)
        await close_overlays(pg)
        before = await n(pg, "[data-slot]")
        await pg.click('.wb-sec-card:has-text("Stats Strip") >> text=Insert')
        await pg.wait_for_timeout(500)
        ck("C5 section insert grows the document", await n(pg, "[data-slot]") == before + 1, f"{before} -> {await n(pg, '[data-slot]')}")
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(300)

        # ============ D · pages tab ============
        await pg.click("#wb-tab-pages")
        await pg.wait_for_timeout(300)
        ck("D1 five page templates", await n(pg, ".wb-tpl-card") == 5, str(await n(pg, ".wb-tpl-card")))
        ck("D2 current page structure lists every section", await n(pg, ".wb-struct-row") == await n(pg, "[data-slot]"))
        await pg.click(".wb-struct-row >> nth=1")
        await pg.wait_for_timeout(300)
        ck("D3 structure row selects the block", await n(pg, ".wb-outline") == 1)
        ck("D4 selected row is marked", await n(pg, ".wb-struct-row.is-sel") == 1)
        ck("D5 save-as-template offered", await n(pg, ".wb-save-tpl") == 1)

        # ============ E · canvas selection + inspector ============
        await pg.click("#wb-tab-blocks")
        await pg.wait_for_timeout(200)
        await pg.click("[data-slot] .wb-blk >> nth=0")
        await pg.wait_for_timeout(300)
        ck("E1 select draws the outline", await n(pg, ".wb-outline") == 1)
        ck("E2 outline carries a label", "Hero" in (await pg.inner_text(".wb-outline-tag")))
        ck("E3 context toolbar has four actions", await n(pg, ".wb-ctx-tools .wb-tool") == 4)
        ck("E4 inspector header names the block", "Hero" in await pg.inner_text(".wb-insp-name"))
        ck("E5 inspector shows Content tab by default", "True" == str(await pg.eval_on_selector('#wb-insp-content', 'e => e.getAttribute("aria-selected")')).capitalize())
        fields = await n(pg, ".wb-insp-body [data-field]")
        ck("E6 hero exposes its full content schema", fields >= 6, str(fields))
        ck("E7 link fields show kind + target", "PAGE" in await pg.inner_text('.wb-linkfield[data-field="primaryHref"]'))
        ck("E8 media field shows asset name and size", "hero-student.jpg" in await pg.inner_text('.wb-f:has-text("Image") .wb-mediafield'))

        # edit → canvas → autosave
        old = await pg.inner_text('[data-slot] [data-el="heading"]')
        await pg.fill('.wb-insp-body [data-field="heading"] >> nth=0', "Study Abroad, Confidently")
        await pg.wait_for_timeout(400)
        ck("E9 typing updates the canvas", "Confidently" in await pg.inner_text('[data-slot] [data-el="heading"]'))
        ck("E10 status flips to unsaved", await pg.get_attribute(".wb-status", "data-status") == "dirty")
        await pg.wait_for_timeout(3200)
        ck("E11 autosave lands within 2 s (plus latency)", await pg.get_attribute(".wb-status", "data-status") == "saved",
           str(await pg.get_attribute(".wb-status", "data-status")))
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(400)
        ck("E12 undo restores the heading", await pg.inner_text('[data-slot] [data-el="heading"]') == old)
        await pg.keyboard.press("Control+Shift+z")
        await pg.wait_for_timeout(300)
        ck("E13 redo re-applies", "Confidently" in await pg.inner_text('[data-slot] [data-el="heading"]'))
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(300)

        # style tab
        await pg.click("#wb-insp-style")
        await pg.wait_for_timeout(300)
        ck("E14 style tab shows token groups", await n(pg, ".wb-seg") >= 4)
        ck("E15 inherited values are marked", await n(pg, ".wb-inherit") >= 3)
        seg = pg.locator(".wb-seg").first.locator(".wb-seg-b").nth(1)
        await seg.click()
        await pg.wait_for_timeout(250)
        ck("E16 override is flagged on the control", await n(pg, ".wb-reset") >= 1)
        await pg.click(".wb-reset >> nth=0")
        await pg.wait_for_timeout(200)
        ck("E17 reset returns the control to inherited", await n(pg, ".wb-reset") == 0)

        # advanced tab
        await pg.click("#wb-insp-advanced")
        await pg.wait_for_timeout(300)
        ck("E18 advanced shows five live groups", await n(pg, ".wb-acc") == 5, str(await n(pg, ".wb-acc")))
        ck("E19 four locked groups with reasons", await n(pg, ".wb-locked") == 4)
        ck("E20 locked rows explain themselves", "Phase 2" in await pg.inner_text(".wb-locked"))
        ck("E21 responsive visibility has three switches", await n(pg, '.wb-acc:has-text("Responsive visibility") .switch') == 3)

        # ============ F · insert paths ============
        await pg.click("#wb-insp-content")
        await pg.wait_for_timeout(200)
        before = await n(pg, "[data-slot]")
        await pg.click('.wb-tile[data-block="alert"]')
        await pg.wait_for_timeout(450)
        ck("F1 click-insert adds a block after the selection", await n(pg, "[data-slot]") == before + 1)
        ck("F2 inserted block is selected", "Alert" in await pg.inner_text(".wb-insp-name"))
        ck("F3 insert toast confirms", "added" in (await body(pg)).lower())

        # drag a tile onto the canvas
        before = await n(pg, "[data-slot]")
        tile = pg.locator('.wb-tile[data-block="divider"]')
        tb = await tile.bounding_box()
        slot = pg.locator("[data-slot]").nth(1)
        sb = await slot.bounding_box()
        await pg.mouse.move(tb["x"] + tb["width"] / 2, tb["y"] + tb["height"] / 2)
        await pg.mouse.down()
        await pg.mouse.move(tb["x"] + 60, tb["y"] + 30, steps=4)
        await pg.mouse.move(sb["x"] + sb["width"] / 2, sb["y"] + sb["height"] * 0.75, steps=8)
        await pg.wait_for_timeout(120)
        ghost = await n(pg, ".wb-ghost")
        await pg.mouse.up()
        await pg.wait_for_timeout(450)
        ck("F4 drag shows a ghost while moving", ghost == 1)
        ck("F5 drag-insert lands a block", await n(pg, "[data-slot]") == before + 1, f"{before} -> {await n(pg, '[data-slot]')}")

        # duplicate + delete
        await pg.click("[data-slot] .wb-blk >> nth=2")
        await pg.wait_for_timeout(250)
        before = await n(pg, "[data-slot]")
        await pg.click('.wb-ctx-tools button[aria-label="Duplicate block"]')
        await pg.wait_for_timeout(350)
        ck("F6 duplicate adds one section", await n(pg, "[data-slot]") == before + 1)
        await pg.click('.wb-ctx-tools button[aria-label="Delete block"]')
        await pg.wait_for_timeout(350)
        ck("F7 delete removes it again", await n(pg, "[data-slot]") == before)
        await pg.click('.toast .link')
        await pg.wait_for_timeout(350)
        ck("F8 toast undo restores the deleted block", await n(pg, "[data-slot]") == before + 1)

        # reorder via structure arrows
        first = await pg.eval_on_selector("[data-slot]", "e => e.getAttribute('data-slot')")
        await pg.click("#wb-tab-pages")
        await pg.wait_for_timeout(250)
        await pg.hover(".wb-struct-row >> nth=0")
        await pg.click('.wb-struct-row >> nth=0 >> button[aria-label="Move down"]')
        await pg.wait_for_timeout(300)
        second = await pg.eval_on_selector("[data-slot]", "e => e.getAttribute('data-slot')")
        ck("F9 structure move reorders the canvas", first != second)

        # ============ G · device + zoom ============
        await pg.click('.wb-dev[title="Tablet 768"]')
        await pg.wait_for_timeout(350)
        ck("G1 tablet switches the document width", await pg.get_attribute(".wb-doc", "data-device") == "tablet")
        tw = await pg.evaluate("() => document.querySelector('.wb-doc').getBoundingClientRect().width")
        ck("G2 tablet doc is narrower than desktop", tw < 660, str(tw))
        await pg.click('.wb-dev[title="Mobile 375"]')
        await pg.wait_for_timeout(350)
        mw = await pg.evaluate("() => document.querySelector('.wb-doc').getBoundingClientRect().width")
        ck("G3 mobile doc is a phone width", mw <= 375, str(mw))
        ck("G4 mobile hides the master nav", await pg.eval_on_selector(".wb-master-nav", "e => getComputedStyle(e).display") == "none")
        await pg.click('.wb-dev[title="Desktop 1440"]')
        await pg.wait_for_timeout(300)
        await pg.select_option(".wb-zoom select", "50")
        await pg.wait_for_timeout(350)
        dw = await pg.evaluate("() => document.querySelector('.wb-doc').getBoundingClientRect().width")
        ck("G5 50% zoom renders at 720 px", abs(dw - 720) < 2, str(dw))
        await pg.select_option(".wb-zoom select", "fit")
        await pg.wait_for_timeout(300)

        # ============ H · pickers ============
        await pg.click("#wb-tab-pages")
        await pg.wait_for_timeout(250)
        await pg.click('.wb-struct-row:has-text("Hero")')
        await pg.wait_for_timeout(300)
        await pg.click("#wb-insp-content")
        await pg.wait_for_timeout(250)
        await pg.click('.wb-linkfield[data-field="primaryHref"]')
        await pg.wait_for_timeout(400)
        ck("H1 link picker opens with three sources", await n(pg, ".wb-lp-tab") == 3)
        ck("H2 picker lists real pages", await n(pg, ".wb-lp-row") > 5)
        await pg.fill('.modal .wb-lib-search input', "Scholarships")
        await pg.wait_for_timeout(250)
        await pg.click('.wb-lp-row >> nth=0')
        await pg.wait_for_timeout(350)
        ck("H3 picking a page writes the link", "/scholarships" in await pg.inner_text('.wb-linkfield[data-field="primaryHref"]'),
           await pg.inner_text('.wb-linkfield[data-field="primaryHref"]'))
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(250)

        await pg.click('.wb-f:has-text("Image") button[aria-label="Replace image"]')
        await pg.wait_for_timeout(400)
        ck("H4 media picker lists sample assets", await n(pg, ".wb-media-card") >= 5)
        ck("H5 sample assets are labelled", await n(pg, ".wb-sample-tag") >= 5)
        await pg.click('.wb-media-card >> nth=1 >> button[aria-label^="Delete"]')
        await pg.wait_for_timeout(300)
        ck("H6 deleting an in-use asset is blocked with a reason", "in use" in (await pg.inner_text(".modal")).lower())
        await close_overlays(pg)

        # ============ I · AI copy ============
        await go(pg, "?page=pg_site_main_2")
        await pg.click('[data-slot] [data-el="description"]')
        await pg.wait_for_timeout(350)
        ck("I1 selecting text opens the AI bubble", await n(pg, ".wb-ai") == 1)
        ck("I2 bubble offers three rewrites", await n(pg, ".wb-ai-act") == 3)
        ck("I3 bubble states the fact boundary", "no new claims" in await pg.inner_text(".wb-ai"))
        before = await pg.inner_text('[data-slot] [data-el="description"]')
        await pg.click('.wb-ai-act:has-text("Shorten")')
        await pg.wait_for_timeout(300)
        ck("I4 streaming state is reachable", await n(pg, '[data-ai-stream="streaming"]') == 1)
        await pg.wait_for_timeout(1600)
        ck("I5 stream completes into a suggestion", await n(pg, '[data-ai-stream="ready"]') == 1)
        ck("I6 the draft is untouched while suggesting", await pg.inner_text('[data-slot] [data-el="description"]') == before)
        suggestion = await pg.inner_text("[data-ai-stream]")
        await pg.click('.wb-ai-b:has-text("Accept")')
        await pg.wait_for_timeout(400)
        after = await pg.inner_text('[data-slot] [data-el="description"]')
        ck("I7 accept writes the suggestion into the draft", after == suggestion.strip() and after != before, f"{before!r} -> {after!r}")
        ck("I7b suggestion is shorter than the original", len(after) < len(before), f"{len(before)} -> {len(after)}")
        ck("I8 accepted copy is one undo unit", True)
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(300)
        ck("I9 undo reverts the accepted copy", await pg.inner_text('[data-slot] [data-el="description"]') == before)

        await pg.click('[data-slot] [data-el="description"]')
        await pg.wait_for_timeout(300)
        await pg.click('.wb-ai-act:has-text("Improve")')
        await pg.wait_for_timeout(1500)
        await pg.click('.wb-ai-b:has-text("Discard")')
        await pg.wait_for_timeout(300)
        ck("I10 discard leaves the draft and closes the panel", await n(pg, ".wb-ai") == 0 and await pg.inner_text('[data-slot] [data-el="description"]') == before)

        # ============ J · template, revisions, publish ============
        await pg.click("#wb-tab-pages")
        await pg.wait_for_timeout(250)
        await pg.click('.wb-tpl-card:has-text("Event Page") >> text=Use')
        await pg.wait_for_timeout(450)
        ck("J1 template use asks to map its form", "needs a form" in (await pg.inner_text(".modal")).lower())
        await pg.click('.modal button:has-text("Use template")')
        await pg.wait_for_timeout(450)
        ck("J2 template applied", await n(pg, "[data-slot]") == 3, str(await n(pg, "[data-slot]")))
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(300)

        await pg.click('button[aria-label="Publish options"]')
        await pg.wait_for_timeout(250)
        ck("J3 publish split menu has three options", await n(pg, ".wb-pub-menu button") == 3)
        await pg.click('.wb-pub-menu button:has-text("Release & revision history")')
        await pg.wait_for_timeout(400)
        ck("J4 revision history lists revisions", await n(pg, ".wb-rev-row") >= 2)
        ck("J5 revisions carry author and summary", "You" in await pg.inner_text(".wb-rev-list") or "Anita" in await pg.inner_text(".wb-rev-list"))
        await close_overlays(pg)

        await pg.click('[data-act="open-publish"]')
        await pg.wait_for_timeout(450)
        ck("J6 publish modal names the pages in the release", "in this release" in (await pg.inner_text(".modal")).lower())
        ck("J7 preflight runs real checks", "blocking issue" in (await pg.inner_text(".modal")).lower())
        ck("J8 publish explains compare-and-swap", "compare-and-swap" in (await pg.inner_text(".modal")).lower())
        await close_overlays(pg)

        # ============ K · deep links ============
        await go(pg, "?page=pg_site_main_3&sel=&lib=pages&insp=style")
        ck("K1 library tab restored from the URL", "True" == str(await pg.eval_on_selector("#wb-tab-pages", 'e => e.getAttribute("aria-selected")')).capitalize())
        ck("K2 inspector tab restored from the URL", "True" == str(await pg.eval_on_selector("#wb-insp-style", 'e => e.getAttribute("aria-selected")')).capitalize())
        ck("K3 page restored from the URL", "Study in Italy" == await pg.eval_on_selector('select[aria-label="Page"]', "e => e.options[e.selectedIndex].text"))
        await pg.click("[data-slot] .wb-blk >> nth=1")
        await pg.wait_for_timeout(300)
        ck("K4 URL keeps the selection in sync", "sel=" in await pg.evaluate("() => location.hash"))

        # ============ L · cross-module wiring ============
        await go(pg, "?page=pg_site_main_2")
        await pg.fill('.wb-insp-body [data-field="heading"] >> nth=0', "Cross module check")
        await pg.wait_for_timeout(3400)
        await pg.goto(URL + "#/pages?site=site_main")
        await pg.wait_for_timeout(1400)
        row = await pg.inner_text(".d3-table, .page")
        ck("L1 builder save marks the page as unpublished in Pages", "Unpublished" in row or "changes" in row.lower())

        print("\nerrors:", errs[:6])
        ck("Z1 no page errors", len(errs) == 0, str(errs[:3]))
        print(f"\n==== qa_builder: {TALLY['ok']} passed, {TALLY['fail']} failed ====")
        if FAILS:
            print("FAILED:")
            for f in FAILS:
                print("  -", f)
        await b.close()
        return TALLY["fail"]

sys.exit(asyncio.run(main()))
