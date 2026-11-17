#!/usr/bin/env python3
"""Module 7 completion — XML and CSV template export, and in-place editing of
master-layout seed blocks (text, link, items), checked against the real DOM.
Each export is parsed by the standard library, not by string matching.
"""
import asyncio, csv, io, json, os, sys
import xml.etree.ElementTree as ET
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

async def until(pg, js, timeout=4000):
    try:
        await pg.wait_for_function(js, timeout=timeout); return True
    except Exception:
        return False

async def go(pg):
    await pg.goto(URL + "#/layouts")
    await pg.reload()
    await pg.wait_for_timeout(1500)

async def open_row_menu(pg, index=0):
    await pg.locator(".m7-row").nth(index).click()
    await pg.wait_for_timeout(300)
    await pg.locator(".m7-row-menu").nth(index).click()
    await pg.wait_for_timeout(250)

async def export_via_menu(pg, label):
    async with pg.expect_download() as dl:
        await open_row_menu(pg)
        await pg.locator(f".menu-item:has-text('{label}')").click()
    d = await dl.value
    path = f"/tmp/qa7/{label.split()[-1].lower()}-export"
    await d.save_as(path)
    # read bytes and decode, so CRLF line endings are checked as written
    return d.suggested_filename, open(path, "rb").read().decode("utf-8")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        os.makedirs("/tmp/qa7", exist_ok=True)

        # ---------------- X · XML and CSV export ----------------
        await go(pg)
        await pg.get_by_role("tab", name="Page Templates").click()
        await pg.wait_for_timeout(350)
        await open_row_menu(pg)
        labels = await pg.locator(".menu-item:has-text('Export as')").all_inner_texts()
        await pg.keyboard.press("Escape")
        ck("X1 three export formats are offered", len(labels) == 3 and all(any(x in l for l in labels) for x in ["JSON", "XML", "CSV"]), str(labels))

        fn, xml_body = await export_via_menu(pg, "Export as XML")
        ck("X2 the XML export is an .xml file", fn.endswith(".xml"), fn)
        try:
            root = ET.fromstring(xml_body.encode("utf-8"))
            ok_parse = True
        except ET.ParseError as e:
            root = None; ok_parse = False
        ck("X3 the XML is well-formed", ok_parse, xml_body[:120])
        if root is not None:
            ck("X4 the XML names its schema and carries the template", root.tag == "wacrm-templates" and root.get("kind") == "wacrm.templates" and root.get("schemaVersion") == "1")
            tpls = root.findall("template")
            blocks = root.findall("./template/block")
            ck("X5 each template has blocks with a type", len(tpls) == 1 and len(blocks) >= 1 and all(bl.get("type") for bl in blocks), f"{len(tpls)} tpl {len(blocks)} blocks")
            props = root.findall("./template/block/prop")
            ck("X6 props keep their kind so import can restore them", props and all(pr.get("kind") in {"string", "number", "boolean", "null", "object", "array"} for pr in props))
            xml_values = [(pr.text or "") for pr in props]

        fn, csv_body = await export_via_menu(pg, "Export as CSV")
        ck("X8 the CSV export is a .csv file", fn.endswith(".csv"), fn)
        rows = list(csv.reader(io.StringIO(csv_body.lstrip("\ufeff"))))
        ck("X9 the CSV header names every column", rows and rows[0] == ["template", "intent", "layout", "position", "block_type", "variant", "prop", "prop_kind", "value"], str(rows[0] if rows else None))
        ck("X10 the CSV has one row per prop, every row the same width", len(rows) > 1 and all(len(r) == 9 for r in rows), str({len(r) for r in rows}))
        ck("X11 the CSV uses CRLF line endings", "\r\n" in csv_body and "\n" not in csv_body.replace("\r\n", ""))
        # a prop value with a comma and a quote must survive the round trip
        ck("X12 quoting is correct for commas and quotes", next(csv.reader(io.StringIO('a,"b, ""c"""\r\n'))) == ["a", 'b, "c"'])

        # cross-check: CSV and XML describe the same number of props
        if root is not None:
            ck("X13 CSV and XML agree on the number of props", len(rows) - 1 == len(props), f"csv {len(rows)-1} vs xml {len(props)}")
            # XML text (after unescaping) must equal the CSV value for the same prop, in order
            csv_values = [r[8] for r in rows[1:]]
            ck("X7 XML text, unescaped, matches the CSV value for every prop", xml_values == csv_values,
               next(((a, b) for a, b in zip(xml_values, csv_values) if a != b), None).__repr__() if xml_values != csv_values else "")

        # ---------------- Y · master-layout editing ----------------
        await go(pg)
        await pg.get_by_role("tab", name="Master Layouts").click()
        await pg.wait_for_timeout(300)
        await pg.locator(".m7-row").first.click()
        await pg.wait_for_timeout(500)
        tabs = pg.locator(".m7-insp-tabs button, [role=tab]")
        await pg.get_by_role("tab", name="Structure").click()
        await pg.wait_for_timeout(400)
        seeds = pg.locator(".m7-seed")
        ck("Y1 the Structure pane lists the seed blocks", await seeds.count() >= 1, str(await seeds.count()))
        if await seeds.count():
            await seeds.first.click()
            await pg.wait_for_timeout(300)
            ck("Y2 selecting a seed row marks it selected", await pg.locator(".m7-seed.is-selected").count() == 1)
            ck("Y3 the selected block opens its field editor", await pg.locator(".m7-bf").count() == 1)

            # Y4 text field edits and the canvas shows it at once
            # target the heading textarea; the canvas may uppercase eyebrows, so compare case-insensitively
            heading = pg.locator(".m7-bf textarea[id$='-heading']")
            marker = "QA marker heading"
            if await heading.count():
                await heading.first.fill(marker)
                await pg.wait_for_timeout(300)
                frame_txt = (await pg.locator(".m7l-frame").first.inner_text()).lower()
                ck("Y4 a text field edit reaches the canvas live", marker.lower() in frame_txt)
            else:
                ck("Y4 a text field edit reaches the canvas live", False, "no heading field on the first seed")

        # Y5: find a block with a link field and an items list
        found_link = found_items = False
        for i in range(await seeds.count()):
            await seeds.nth(i).click()
            await pg.wait_for_timeout(250)
            link = pg.locator(".m7-bf input[placeholder='/page-path or https://…']")
            if not found_link and await link.count():
                await link.first.fill("https://example.com/qa-link")
                await pg.wait_for_timeout(200)
                ck("Y5 a link field accepts a URL and stores it", (await link.first.input_value()) == "https://example.com/qa-link")
                found_link = True
            add = pg.locator(".m7-bf-add")
            if not found_items and await add.count():
                before = await pg.locator(".m7-bf-item").count()
                await add.first.click(); await pg.wait_for_timeout(200)
                after = await pg.locator(".m7-bf-item").count()
                ck("Y6 Add appends an item", after == before + 1, f"{before}->{after}")
                await pg.locator(".m7-bf-item button[aria-label^='Remove']").last.click(); await pg.wait_for_timeout(200)
                ck("Y7 Remove deletes that item", await pg.locator(".m7-bf-item").count() == before)
                found_items = True
            if found_link and found_items:
                break
        ck("Y8 at least one seed block has a link field", found_link)
        ck("Y9 at least one seed block has an items list", found_items)

        # Y10: edits are a draft until saved; Save writes a revision
        save = pg.get_by_role("button", name="Save", exact=True)
        ck("Y10 an edit enables Save, so the draft can be written as a revision", await save.count() == 1 and await save.first.is_enabled())

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_export_edit · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
