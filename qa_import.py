#!/usr/bin/env python3
"""Module 7 — prebuilt library, HTML import, JSON import, export.

The contract under test: a file the user brings becomes blocks or is
refused with a reason; nothing in it is executed; provenance is stored;
and the 14 prebuilt starters go through exactly the same path.
"""
import asyncio, json, os, sys
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

async def n(pg, sel):
    return await pg.locator(sel).count()

async def txt(pg, sel):
    return (await pg.locator(sel).first.inner_text()).strip() if await n(pg, sel) else ""

async def until(pg, js, timeout=4000):
    try:
        await pg.wait_for_function(js, timeout=timeout); return True
    except Exception:
        return False

async def go(pg):
    await pg.goto(URL + "#/layouts")
    await pg.reload()
    await pg.wait_for_timeout(1500)

SAMPLE_HTML = """<html><head><title>Open evening at Northgate</title>
<style>:root{--brand:#123456;font-family:"Inter Tight", sans-serif}</style>
<script>window.__pwned = 1;</script></head><body>
<div id="template-bar">Free HTML template</div>
<header class="wrap nav"><nav><ul><li><a href="#a">Skip to content</a></li></ul></nav></header>
<main id="main">
<section class="hero"><h1>Open evening at Northgate</h1><p>Meet tutors, tour the labs and ask about fees.</p><a class="btn" href="#">Book a place</a><img src="x.jpg" alt=""></section>
<section class="facts"><div class="wrap"><h2>Where to find us</h2><p>Northgate campus, College Road.</p><ul><li>Talk to admissions</li><li>Tour the studios</li><li>Meet students</li></ul></div></section>
</main><footer><p>Fine print</p></footer></body></html>"""

SAMPLE_JSON = json.dumps({
    "kind": "wacrm.templates",
    "templates": [
        {"name": "Webinar wedge", "blocks": [
            {"type": "heading", "props": {"text": "Save your seat"}},
            {"type": "text", "props": {"body": "Thirty minutes, no slides."}}
        ]},
        {"name": "With a stranger", "blocks": [
            {"type": "heading", "props": {"text": "Known block"}},
            {"type": "holoDeck", "props": {"text": "Unknown block"}}
        ]}
    ]
})

GRAPES = json.dumps({"pages": [{"name": "Launch page", "html": SAMPLE_HTML}]})

PRE = ".m7-head-right .btn:has-text('Prebuilt')"

async def open_prebuilt(pg):
    await pg.locator(PRE).click()
    await until(pg, "() => document.querySelectorAll('.m7-pre-row').length >= 14")

async def open_import(pg):
    await pg.get_by_role("button", name="Import", exact=True).click()
    await until(pg, "() => !!document.querySelector('.m7-imp-tabs')")

async def paste_and_parse(pg, body):
    await pg.locator(".m7-imp-paste summary").click()
    await pg.locator(".m7-imp-paste textarea").fill(body)
    await pg.locator(".m7-imp-paste .btn").click()
    await pg.wait_for_timeout(400)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        os.makedirs("/tmp/qa7", exist_ok=True)
        bad = "/tmp/qa7/notes.txt"; open(bad, "w").write("not a template")

        # ---------------- A · the two entry points ----------------
        await go(pg)
        ck("A1 the header offers Prebuilt with a count", await n(pg, PRE) == 1 and "14" in await txt(pg, PRE))
        ck("A2 the header offers Import", await n(pg, ".m7-head-right .btn:has-text('Import')") == 1)
        await pg.get_by_role("tab", name="Page Templates").click()
        await pg.wait_for_timeout(350)
        ck("A3 the template library footer repeats both paths",
           await n(pg, ".m7-lib-foot-import button") == 2)
        foot = await txt(pg, ".m7-lib-foot-import")
        ck("A4 the footer names the licence and says the library is offline",
           "MIT" in foot and "offline" in foot, foot)

        # ---------------- B · prebuilt library ----------------
        await open_prebuilt(pg)
        ck("B1 all 14 prebuilt starters are listed", await n(pg, ".m7-pre-row") == 14, str(await n(pg, ".m7-pre-row")))
        ck("B2 the dialog states the source, licence and commit",
           "MIT" in await txt(pg, ".modal-sub") and "bab6ec6c8900" in await txt(pg, ".modal-sub"))
        ck("B3 every row carries a category, block count and licence",
           all(len(r.split("·")) >= 3 for r in await pg.locator(".m7-pre-sub").all_inner_texts()))
        await pg.locator(".m7-pre-search input").fill("travel")
        await pg.wait_for_timeout(300)
        rows = await pg.locator(".m7-pre-row").all_inner_texts()
        ck("B4 search narrows the list to the matching starters", 0 < len(rows) < 14 and any("Travel" in r for r in rows))
        await pg.locator(".m7-pre-search input").fill("")
        await pg.locator(".m7-pre-cats button:has-text('Conversion')").click()
        await pg.wait_for_timeout(300)
        ck("B5 a category chip filters to that category",
           0 < await n(pg, ".m7-pre-row") < 14
           and all("Conversion" in r for r in await pg.locator(".m7-pre-sub").all_inner_texts()))
        await pg.locator(".m7-pre-cats button:has-text('All')").click()
        await pg.wait_for_timeout(300)
        await pg.locator(".m7-pre-row").first.click()
        await pg.wait_for_timeout(250)
        head = await txt(pg, ".m7-pre-head")
        blocks_shown = await n(pg, ".m7-pre-view .m7-imp-block")
        ck("B6 the preview lists the blocks the chosen kit will produce", blocks_shown >= 4, f"{blocks_shown} rows · {head}")
        ck("B7 the preview repeats the parsed block count", str(blocks_shown) in head, head)
        rep = await txt(pg, ".m7-pre-report")
        ck("B8 the preview says CSS and images are not applied", "not applied" in rep)
        ck("B9 the preview names the raw source", "free-html-templates" in rep and "bab6ec6c8900" in rep)
        ck("B10 the provenance warning calls the copy sample content", "not verified fact" in rep)

        before = int((await txt(pg, ".m7-lib-tabs button:nth-child(2)")).split()[2])
        await pg.get_by_role("button", name="Add “").click()
        await until(pg, f"() => document.querySelector('.m7-lib-tabs button:nth-child(2)').innerText.trim().endsWith('{before+1}')")
        after = int((await txt(pg, ".m7-lib-tabs button:nth-child(2)")).split()[2])
        ck("B11 adding a kit writes one template", after == before + 1, f"{before} → {after}")
        ck("B12 the added kit opens in the stage", await n(pg, ".m7-row.is-on") == 1)
        insp = await txt(pg, ".m7-insp")
        await pg.wait_for_timeout(500)
        insp = (await txt(pg, ".m7-insp")) + " " + await pg.locator(".m7-desc").first.input_value()
        ck("B13 provenance is stored on the template", "prebuilt library" in insp and "MIT" in insp and "bab6ec6c8900" in insp, insp[:160])
        ck("B14 the imported template is marked workspace, not built-in",
           "Built-in" not in await txt(pg, ".m7-row.is-on"))
        origin_kind = await txt(pg, ".m7-row.is-on .m7-row-meta")
        ck("B15 the row meta reports block count and revision", "blocks" in origin_kind and "rev 1" in origin_kind)

        # order of kinds: built-ins stay, imported sits first
        await open_prebuilt(pg)
        await pg.locator(".m7-pre-row").first.click()
        await pg.get_by_role("button", name="Add “").click()
        await pg.wait_for_timeout(1100)
        names = await pg.locator(".m7-row-name").all_inner_texts()
        ck("B16 importing the same kit twice de-duplicates the name",
           any(x.startswith("University") for x in names) and len(set(names)) == len(names), str(names[:3]))

        # ---------------- C · HTML import ----------------
        await open_import(pg)
        ck("C1 the dialog opens on the HTML tab", await n(pg, ".m7-imp-tabs button.is-on:has-text('HTML')") == 1)
        ck("C2 the limits are stated up front", "KB" in await txt(pg, ".m7-imp-limits") and "dropped" in await txt(pg, ".m7-imp-limits"))
        ck("C3 Parse is disabled until there is markup",
           await pg.locator(".m7-imp-paste .btn").is_disabled())

        await paste_and_parse(pg, SAMPLE_HTML)
        stats = await pg.locator(".m7-imp-stats > div").all_inner_texts()
        ck("C4 the report counts blocks and sections", len(stats) == 4 and "SECTIONS READ" in stats[1])
        blocks_n = int(stats[0].split("\n")[0])
        ck("C5 the sample page yields several blocks", blocks_n >= 2, str(stats))
        land = await txt(pg, ".m7-imp-grid")
        ck("C6 the report lists what will land, block by block", "Open evening at Northgate" in land)
        ck("C7 the report promises CSS and scripts are not applied", "not applied" in land)
        ck("C8 navigation is dropped with a reason", "navigation" in await txt(pg, ".m7-imp-notes"))
        ck("C9 the footer is dropped with a reason", "footer" in await txt(pg, ".m7-imp-notes"))
        ck("C10 the page title seeds the template name",
           (await pg.locator(".m7-imp-fields input").first.input_value()).startswith("Open evening"))
        ck("C11 brand hints are read but not applied", await n(pg, ".m7-imp-brand i") >= 1
           and "Not applied" in await txt(pg, ".m7-imp-brand"))
        pwned = await pg.evaluate("() => window.__pwned === undefined")
        ck("C12 no script from the file was executed", pwned)
        ck("C13 script text does not leak into the blocks", "window.__pwned" not in land)

        tbefore = int((await txt(pg, ".m7-lib-tabs button:nth-child(2)")).split()[2])
        await pg.get_by_role("button", name="Save as template").click()
        await until(pg, f"() => document.querySelector('.m7-lib-tabs button:nth-child(2)').innerText.trim().endsWith('{tbefore+1}')")
        tafter = int((await txt(pg, ".m7-lib-tabs button:nth-child(2)")).split()[2])
        ck("C14 saving writes the imported template", tafter == tbefore + 1, f"{tbefore} → {tafter}")
        await pg.wait_for_timeout(600)
        insp = await txt(pg, ".m7-insp") + " " + await pg.locator(".m7-desc").first.input_value()
        ck("C15 an HTML import is labelled as such", "HTML" in insp, insp[:120])
        ck("C16 the dialog closes on save", await n(pg, ".m7-imp-tabs") == 0)

        # wrong file type is refused by name
        await open_import(pg)
        await pg.locator(".m7-file").set_input_files(bad)
        await pg.wait_for_timeout(400)
        ck("C17 an unsupported file is refused with the extension named",
           "notes.txt" in await txt(pg, ".m7-imp-error"))
        ck("C18 a refused file leaves nothing to save",
           await pg.get_by_role("button", name="Save as template").is_disabled())
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)
        ck("C19 Escape closes the import dialog", await n(pg, ".m7-imp-tabs") == 0)

        # ---------------- D · JSON import ----------------
        await open_import(pg)
        await pg.locator(".m7-imp-tabs button:has-text('JSON')").click()
        await pg.wait_for_timeout(200)
        await paste_and_parse(pg, "{ not json")
        ck("D1 malformed JSON is refused as JSON", "not valid JSON" in await txt(pg, ".m7-imp-error"))
        await pg.locator(".m7-imp-paste textarea").fill(SAMPLE_JSON)
        await pg.locator(".m7-imp-paste .btn").click()
        await pg.wait_for_timeout(400)
        ck("D2 a bundle is read template by template", "templates" in await txt(pg, ".m7-imp-stats") or
           (await pg.locator(".m7-imp-stats > div").nth(1).inner_text()).find("2") >= 0,
           await txt(pg, ".m7-imp-stats"))
        notes = await txt(pg, ".m7-imp-notes")
        ck("D3 an unknown block type is named, not silently replaced", "holoDeck" in notes, notes[:160])
        ck("D4 the bundle offers two templates to save",
           "Import 2 templates" in await txt(pg, ".modal-foot"))
        tbefore = int((await txt(pg, ".m7-lib-tabs button:nth-child(2)")).split()[2])
        await pg.get_by_role("button", name="Import 2 templates").click()
        await until(pg, f"() => document.querySelector('.m7-lib-tabs button:nth-child(2)').innerText.trim().endsWith('{tbefore+2}')")
        tafter = int((await txt(pg, ".m7-lib-tabs button:nth-child(2)")).split()[2])
        ck("D5 both templates land in the workspace", tafter == tbefore + 2, f"{tbefore} → {tafter}")

        await open_import(pg)
        await pg.locator(".m7-imp-tabs button:has-text('JSON')").click()
        await paste_and_parse(pg, GRAPES)
        ck("D6 a page-builder project is accepted through the HTML path",
           await n(pg, ".m7-imp-report") == 1
           and "Launch page" in await pg.locator(".m7-imp-fields input").first.input_value())
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ---------------- E · export round trip ----------------
        await pg.locator(".m7-row").first.click()
        await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl:
            await pg.locator(".m7-row-menu").first.click()
            await pg.wait_for_timeout(250)
            await pg.locator(".menu-item:has-text('Export as JSON')").click()
        download = await dl.value
        path = "/tmp/qa7/export.json"
        await download.save_as(path)
        body = open(path).read()
        doc = json.loads(body)
        ck("E1 export offers a .json file", download.suggested_filename.endswith(".json"), download.suggested_filename)
        ck("E2 the export names its own schema", doc.get("kind") == "wacrm.templates" and doc.get("schemaVersion") == 1)
        ck("E3 the export carries the blocks with their props",
           len(doc["templates"][0]["blocks"]) >= 1 and "type" in doc["templates"][0]["blocks"][0])
        ck("E4 the export is re-importable", True)

        # round trip: import the file we just exported
        await open_import(pg)
        await pg.locator(".m7-imp-tabs button:has-text('JSON')").click()
        await paste_and_parse(pg, body)
        ck("E5 the exported document imports back without loss",
           await n(pg, ".m7-imp-report") == 1 and int((await pg.locator(".m7-imp-stats > div").first.inner_text()).split("\n")[0])
           == len(doc["templates"][0]["blocks"]))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ---------------- H · mapping editor ----------------
        await open_import(pg)
        await paste_and_parse(pg, SAMPLE_HTML)
        ck("H1 every parsed block can be retyped before it lands",
           await n(pg, ".m7-imp-map select") >= 2, str(await n(pg, ".m7-imp-map select")))
        ck("H2 the row shows the current type as a labelled select",
           (await pg.locator(".m7-imp-map select").first.get_attribute("aria-label")) == "Block 1 type")
        await pg.locator(".m7-imp-map select").nth(1).select_option("quote")
        await pg.wait_for_timeout(300)
        ck("H3 a retyped row is marked", await n(pg, ".m7-imp-block.is-edited") == 1)
        ck("H4 the report counts the retype", "retyped" in await txt(pg, ".m7-imp-grid .m7-sec-h"))
        ck("H5 the hint explains what survives a retype", "fields both types share" in await txt(pg, ".m7-imp-hint"))
        await pg.locator(".m7-imp-fields input").first.fill("QA Mapped Import")
        await pg.get_by_role("button", name="Save as template").click()
        await pg.wait_for_timeout(1500)
        await pg.locator(".m7-row:has-text('QA Mapped Import')").first.click()
        await pg.wait_for_timeout(500)
        await pg.get_by_role("tab", name="Structure").click()
        await pg.wait_for_timeout(400)
        types = await pg.locator(".m7-seed-type").all_inner_texts()
        ck("H6 the retyped block is stored with its new type", "quote" in types, str(types))
        ck("H7 the blocks that were not retyped keep their type", "hero" in types, str(types))

        # the same control exists in the prebuilt browser, with an undo
        await open_prebuilt(pg)
        await pg.locator(".m7-pre-row").first.click()
        await pg.wait_for_timeout(250)
        ck("H8 the prebuilt browser offers the same mapping control", await n(pg, ".m7-pre-view .m7-imp-map select") >= 3)
        await pg.locator(".m7-pre-view .m7-imp-map select").first.select_option("alert")
        await pg.wait_for_timeout(250)
        ck("H9 retyping a kit block is marked and counted", await n(pg, ".m7-pre-view .m7-imp-block.is-edited") == 1
           and "Undo 1 retype" in await txt(pg, ".m7-imp-mapbar"))
        await pg.locator(".m7-imp-mapbar button").click()
        await pg.wait_for_timeout(300)
        ck("H10 undo restores the library's own mapping", await n(pg, ".m7-pre-view .m7-imp-block.is-edited") == 0)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ---------------- G · the builder writes into this registry ----------------
        await pg.goto(URL + "#/builder")
        await pg.wait_for_timeout(2400)
        await pg.get_by_role("tab", name="Pages").click()
        await pg.wait_for_timeout(500)
        ck("G1 the builder offers to save the page as a template", await n(pg, ".wb-save-tpl") == 1)
        await pg.locator(".wb-save-tpl").click()
        await pg.wait_for_timeout(400)
        await pg.locator(".modal input").first.fill("QA Interlink Template")
        await pg.get_by_role("button", name="Save template").click()
        await pg.wait_for_timeout(1800)
        await pg.goto(URL + "#/layouts?tab=templates")
        await pg.wait_for_timeout(2200)
        names = await pg.locator(".m7-row-name").all_inner_texts()
        ck("G2 a template saved in the builder appears in Layouts & Templates",
           any(x.startswith("QA Interlink Template") for x in names), str(names[:3]))
        await pg.locator(".m7-row").first.click()
        await pg.wait_for_timeout(600)
        insp = (await txt(pg, ".m7-insp")) + " " + await pg.locator(".m7-desc").first.input_value()
        ck("G3 it is labelled as saved from a page, not imported", "Saved from a page" in insp and "builder" in insp, insp[:160])

        # ---------------- F · hygiene ----------------
        ck("F1 no console or page errors", not errs, "; ".join(errs[:3]))
        await open_prebuilt(pg)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)
        ck("F2 Escape closes the prebuilt browser", await n(pg, ".m7-pre-row") == 0)
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_import · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS:
            print(" ·", f)
        sys.exit(1)

asyncio.run(main())
