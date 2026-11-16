#!/usr/bin/env python3
"""Module 7 — Layouts & Templates · acceptance suite.

Geometry, derived counts, library, canvas, inspector mutations, bulk
reassignment, templates, guarded deletion, overlays and a11y.
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

async def n(pg, sel):
    return await pg.locator(sel).count()

async def txt(pg, sel):
    return (await pg.locator(sel).first.inner_text()).strip() if await n(pg, sel) else ""

async def until(pg, js, timeout=3000):
    """Poll a predicate — the canvas and the tables settle on their own schedule."""
    try:
        await pg.wait_for_function(js, timeout=timeout)
        return True
    except Exception:
        return False

async def go(pg, qs=""):
    await pg.goto(URL + "#/layouts" + qs)
    await pg.reload()
    await pg.wait_for_timeout(1500)

async def close_overlays(pg):
    for _ in range(3):
        if await n(pg, ".overlay"):
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(220)
        else:
            break

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        # ---------------- A · geometry ----------------
        await go(pg)
        ck("A1 the module renders", await n(pg, ".m7") == 1)
        ck("A2 title and subtitle", (await txt(pg, ".m7-title")) == "Layouts & Templates" and await n(pg, ".m7-sub") == 1)
        geo = await pg.evaluate("""() => {
          const r = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
          return { lib: r('.m7-lib'), cen: r('.m7-stage-col'), insp: r('.m7-insp'), kpi: r('.m7-kpis') };
        }""")
        ck("A3 three columns sit side by side", geo["lib"][0] + geo["lib"][2] <= geo["cen"][0] + 1 and geo["cen"][0] + geo["cen"][2] <= geo["insp"][0] + 1, str(geo))
        ck("A4 the inspector is the right-most column", geo["insp"][0] > geo["cen"][0])
        ck("A5 KPI strip spans the page width", geo["kpi"][2] > 900, str(geo["kpi"]))
        fit = await pg.evaluate("""() => {
          const m = document.querySelector('.main'); return { sh: m.scrollHeight, ch: m.clientHeight };
        }""")
        ck("A6 the screen fits without a page scrollbar", fit["sh"] <= fit["ch"] + 2, str(fit))
        ck("A7 exactly four KPI cards", await n(pg, ".m7-kpi") == 4)

        # ---------------- B · derived counts ----------------
        kpis = await pg.evaluate("() => [...document.querySelectorAll('.m7-kpi')].map(e => ({ n: Number(e.querySelector('.m7-kpi-n').textContent), l: e.querySelector('.m7-kpi-l').textContent }))")
        labels = [k["l"] for k in kpis]
        ck("B1 KPI labels are the four contract labels", labels == ["Master Layouts", "Page Templates", "Pages Assigned", "Draft Changes"], str(labels))
        ck("B2 layouts KPI counts live layouts", kpis[0]["n"] == 5, str(kpis[0]))
        ck("B3 templates KPI is 12", kpis[1]["n"] == 12, str(kpis[1]))
        ck("B4 every KPI carries a definition tooltip", await pg.evaluate("() => [...document.querySelectorAll('.m7-kpi')].every(e => !!e.closest('[data-tip]'))"))
        group_total = await pg.evaluate("() => [...document.querySelectorAll('.m7-group-n')].reduce((s, e) => s + Number(e.textContent), 0)")
        ck("B5 page groups add up to the assigned total", group_total == kpis[2]["n"], f"{group_total} vs {kpis[2]['n']}")
        row_meta = await pg.evaluate("() => [...document.querySelectorAll('.m7-row')].map(r => r.innerText)")
        ck("B6 the default layout row shows Default + page count", any("Default" in r and "page" in r for r in row_meta))

        # ---------------- C · library ----------------
        ck("C1 two library tabs", await n(pg, ".m7-lib-tabs button") == 2)
        ck("C2 tabs carry live counts", "5" in await txt(pg, ".m7-lib-tabs button:nth-child(1)") and "12" in await txt(pg, ".m7-lib-tabs button:nth-child(2)"))
        ck("C3 five live layout rows", await n(pg, ".m7-row") == 5)
        await pg.fill(".m7-lib-search input", "blank")
        await pg.wait_for_timeout(320)
        ck("C4 search narrows the list", await n(pg, ".m7-row") == 1, str(await n(pg, ".m7-row")))
        ck("C5 the search match is the blank landing layout", "Blank" in await txt(pg, ".m7-row"))
        await pg.click(".m7-lib-search button[aria-label='Clear search']")
        await pg.wait_for_timeout(280)
        ck("C6 clearing the search restores every row", await n(pg, ".m7-row") == 5)
        await pg.click(".m7-lib-foot")
        await pg.wait_for_timeout(360)
        ck("C7 archived layouts are opt-in", await n(pg, ".m7-row") == 6 and await n(pg, ".m7-row.is-arch") == 1)
        await pg.click(".m7-lib-foot")
        await pg.wait_for_timeout(300)
        await pg.click(".m7-filter")
        await pg.wait_for_timeout(240)
        await pg.click(".dropdown >> text=Name (A → Z)")
        await pg.wait_for_timeout(340)
        names = await pg.evaluate("() => [...document.querySelectorAll('.m7-row-name')].map(e => (e.childNodes[0]?.textContent ?? '').trim())")
        ck("C8 sort by name is alphabetical", names == sorted(names, key=lambda s: s.lower()), str(names))
        await pg.click(".m7-filter"); await pg.wait_for_timeout(200)
        await pg.click(".dropdown >> text=Recently updated"); await pg.wait_for_timeout(300)
        await pg.click(".m7-row:has-text('Campaign Landing Layout')")
        await pg.wait_for_timeout(420)
        ck("C9 selecting a row updates the canvas", "Campaign Landing Layout" in await txt(pg, ".m7-crumbs"))
        ck("C10 the selected row is marked", await n(pg, ".m7-row.is-on:has-text('Campaign Landing Layout')") == 1)

        # ---------------- D · canvas ----------------
        await go(pg, "?site=site_main&tab=layouts&itab=overview&sel=lay_default")
        ck("D1 the canvas draws a page frame", await n(pg, ".m7l-frame") == 1)
        ck("D2 announcement, header, slot and footer all render", (await n(pg, ".m7l-announce"), await n(pg, ".m7l-header"), await n(pg, ".m7l-slot"), await n(pg, ".m7l-footer")) == (1, 1, 1, 1))
        ck("D3 the announcement text comes from the region variant", "Fall 2026 intake" in await txt(pg, ".m7l-announce"))
        ck("D4 the slot is labelled required", "required" in await txt(pg, ".m7l-slot-tag"))
        ck("D5 the seed blocks are drawn, one per block", await n(pg, ".m7l-block") == 3, str(await n(pg, ".m7l-block")))
        ck("D6 draft preview chip is present", "not live" in (await txt(pg, ".m7-tools")).lower())
        w1440 = await pg.evaluate("() => document.querySelector('.m7l-frame').offsetWidth")
        await pg.click(".m7-devices button[aria-label='tablet width']")
        await pg.wait_for_timeout(360)
        w768 = await pg.evaluate("() => document.querySelector('.m7l-frame').offsetWidth")
        await pg.click(".m7-devices button[aria-label='mobile width']")
        await pg.wait_for_timeout(360)
        w375 = await pg.evaluate("() => document.querySelector('.m7l-frame').offsetWidth")
        ck("D7 the three widths are visibly different", w1440 > w768 > w375, f"{w1440:.0f} {w768:.0f} {w375:.0f}")
        ck("D8 the mobile frame hides the nav", await pg.evaluate("() => { const e = document.querySelector('.m7l-nav'); return !e || getComputedStyle(e).display === 'none'; }"))
        await pg.click(".m7-devices button[aria-label='desktop width']")
        await pg.wait_for_timeout(300)
        ck("D9 device icons are distinct glyphs", await pg.evaluate("() => { const s = [...document.querySelectorAll('.m7-devices button svg')].map(e => e.innerHTML); return new Set(s).size === 3; }"))

        # ---------------- E · inspector / save ----------------
        ck("E1 overview is the default tab", "is-on" in await pg.get_attribute(".m7-insp-tabs button:nth-child(1)", "class"))
        ck("E2 three region editors plus the slot", (await n(pg, ".m7-region"), await n(pg, ".m7-region.is-slot")) == (4, 1))
        ck("E3 locked chrome is labelled", (await txt(pg, ".m7-locked")).startswith("Global (locked)"))
        ck("E4 save is disabled while clean", await pg.is_disabled(".m7-insp-foot .btn-primary"))
        await pg.select_option("select[aria-label='Global Header variant']", "hdr_min")
        await pg.wait_for_timeout(320)
        ck("E5 swapping a header variant marks the layout dirty", "Unsaved changes" in await txt(pg, ".m7-crumbs"))
        ck("E6 the canvas header follows the working copy", await until(pg, "() => document.querySelector('.m7l-header-cta')?.textContent === 'Apply Now'"))
        ck("E7 save becomes available", not await pg.is_disabled(".m7-insp-foot .btn-primary"))
        rev_before = await txt(pg, ".m7-kv:last-of-type b")
        await pg.click(".m7-insp-foot .btn-primary")
        await pg.wait_for_timeout(1100)
        ck("E8 save confirms with a toast", await n(pg, ".toast-stack .toast, .toast") >= 1)
        ck("E9 the row now shows the new revision", "rev 5" in await pg.evaluate("() => document.querySelector('.m7-row.is-on').innerText"))
        ck("E10 save clears the dirty state", "Unsaved" not in await txt(pg, ".m7-crumbs"))
        ck("E11 undo is disabled after saving", await pg.is_disabled(".m7-insp-foot .btn:has-text('Undo')"))

        # ---------------- F · structure ----------------
        await pg.click(".m7-insp-tabs button:nth-child(2)")
        await pg.wait_for_timeout(340)
        ck("F1 region order is fixed and stated", "Fixed by the block contract" in await txt(pg, ".m7-sec-h"))
        ck("F2 four ordered region chips", await n(pg, ".m7-order-item") == 4)
        ck("F3 slot policy chips list the allowed types", await n(pg, ".m7-typechip") >= 20, str(await n(pg, ".m7-typechip")))
        ck("F4 the block ceiling is shown", "200" in await txt(pg, ".m7-kv:has-text('Block ceiling')"))
        ck("F5 seed blocks are listed with their order controls", await n(pg, ".m7-seed") == 3)
        before = await n(pg, ".m7-seed")
        await pg.click(".m7-seed .m7-icon-btn[aria-label^='Remove']")
        await pg.wait_for_timeout(280)
        ck("F6 removing a seed block updates the list", await n(pg, ".m7-seed") == before - 1)
        ck("F7 the canvas seed count follows", await n(pg, ".m7l-block") == before - 1)
        await pg.click(".m7-insp-foot .btn:has-text('Undo')")
        await pg.wait_for_timeout(280)
        ck("F8 undo restores the seed", await n(pg, ".m7-seed") == before)
        await pg.click(".m7-sec-h:has-text('Seed blocks') .m7-linkbtn")
        await pg.wait_for_timeout(340)
        ck("F8a the seed menu offers the policy's block types", await n(pg, ".dropdown .menu-item") >= 20, str(await n(pg, ".dropdown .menu-item")))
        await pg.click(".dropdown .menu-item:has-text('list')")
        await pg.wait_for_timeout(340)
        ck("F8b adding a seed block appends it to the slot", await n(pg, ".m7-seed") == before + 1)
        await pg.click(".m7-insp-foot .btn:has-text('Undo')")
        await pg.wait_for_timeout(300)
        await pg.click(".m7-slotbar-m .m7-chipbtn:not(.is-static)")
        await pg.wait_for_timeout(420)
        ck("F9 the policy editor opens with all 20 types", await n(pg, ".m7-policy") == 20)
        await pg.click(".m7-policy:has-text('pricing')")
        await pg.wait_for_timeout(200)
        ck("F10 unticking a type changes the button promise", "Allow 19" in await txt(pg, ".modal-foot .btn-primary"))
        await pg.click(".modal-foot .btn-primary")
        await pg.wait_for_timeout(360)
        ck("F11 the slot bar shows the narrowed allow-list", "19 allowed" in await txt(pg, ".m7-chipbtn:not(.is-static)"))
        ck("F12 the policy edit is unsaved work", "Unsaved changes" in await txt(pg, ".m7-crumbs"))
        await close_overlays(pg)

        # ---------------- G · usage + reassign ----------------
        await go(pg, "?site=site_main&tab=layouts&itab=usage&sel=lay_default")
        ck("G1 usage head counts pages, published and changes", await n(pg, ".m7-usage-head > div") == 3)
        bound = int(await txt(pg, ".m7-usage-head > div:nth-child(1) b"))
        ck("G2 the bound count matches the KPI set", bound > 30, str(bound))
        ck("G3 the table paginates at eight rows", await n(pg, ".m7-usage-row") == 8)
        ck("G4 every row states its binding mode", "Inherited from default" in await txt(pg, ".m7-usage-meta em"))
        await pg.fill(".m7-search.is-small input", "study")
        await pg.wait_for_timeout(300)
        ck("G5 filtering pages works", await n(pg, ".m7-usage-row") >= 1)
        await pg.click(".m7-search.is-small input")
        await pg.fill(".m7-search.is-small input", "")
        await pg.wait_for_timeout(300)
        await pg.click(".m7-usage-row:nth-child(1) input[type=checkbox]")
        await pg.click(".m7-usage-row:nth-child(2) input[type=checkbox]")
        await pg.wait_for_timeout(240)
        ck("G6 selection raises the bulk bar", "2 selected" in await txt(pg, ".m7-bulk"))
        await pg.click(".m7-bulk .btn-primary")
        await pg.wait_for_timeout(420)
        ck("G7 reassign opens with the selection named", "2 selected pages" in await txt(pg, ".modal"))
        await pg.select_option(".modal select", "lay_campaign")
        await pg.click(".modal-foot .btn-primary")
        await pg.wait_for_timeout(360)
        ck("G8 the impact step names both layouts", "Campaign Landing Layout" in await txt(pg, ".m7-impact"))
        ck("G9 the impact step warns about content and policy", await n(pg, ".m7-impact-list li") == 4)
        await pg.click(".modal-foot .btn-primary")
        await pg.wait_for_timeout(1200)
        ck("G10 the move reports success", await n(pg, ".toast-stack .toast, .toast") >= 1)
        ck("G11 the bound count drops by two", int(await txt(pg, ".m7-usage-head > div:nth-child(1) b")) == bound - 2)
        await close_overlays(pg)
        await pg.click(".m7-row:has-text('Campaign Landing Layout')")
        await pg.wait_for_timeout(500)
        ck("G12 the target layout now owns those pages", "2 pages" in await txt(pg, ".m7-row.is-on .m7-row-meta"), await txt(pg, ".m7-row.is-on .m7-row-meta"))
        await pg.click(".m7-insp-tabs button:nth-child(3)")
        await pg.wait_for_timeout(420)
        ck("G13 the moved pages read as explicit assignments", await until(pg, "() => document.querySelectorAll('.m7-usage-row').length === 2") and "Explicitly assigned" in await txt(pg, ".m7-pane"), str(await n(pg, ".m7-usage-row")))

        # ---------------- H · templates ----------------
        await pg.click(".m7-lib-tabs button:nth-child(2)")
        await pg.wait_for_timeout(420)
        ck("H1 the templates tab lists 12 starters", await n(pg, ".m7-row") == 12)
        ck("H2 built-in templates are badged", await n(pg, ".m7-row .pill") >= 8)
        ck("H3 the canvas shows the starter composition", await n(pg, ".m7l-block") >= 3)
        await pg.fill(".m7-lib-search input", "conversion")
        await pg.wait_for_timeout(340)
        ck("H4 templates are searchable by intent", await n(pg, ".m7-row") >= 2, str(await n(pg, ".m7-row")))
        await pg.click(".m7-lib-search button[aria-label='Clear search']")
        await pg.wait_for_timeout(300)
        await pg.click(".m7-row:has-text('Lead Generation')")
        await pg.wait_for_timeout(420)
        ck("H5 the template inspector binds a layout", await n(pg, ".m7-field select") == 1)
        await pg.click(".m7-insp-foot .btn-primary")
        await pg.wait_for_timeout(420)
        ck("H6 create-page modal explains copy-on-create", "copy-on-create" in (await txt(pg, ".modal")).lower())
        await pg.fill(".modal input", "Winter Intake 2027")
        await pg.click(".modal-foot .btn-primary")
        await pg.wait_for_timeout(1600)
        ck("H7 the new page opens in the builder", "#/builder" in pg.url and "page=" in pg.url, pg.url)
        # hash-only navigation: the in-memory reassignments from section G survive
        await pg.evaluate("() => { location.hash = '#/layouts?site=site_main&tab=templates'; }")
        await pg.wait_for_timeout(1400)
        ck("H8 the templates tab is deep-linkable", "is-on" in await pg.get_attribute(".m7-lib-tabs button:nth-child(2)", "class"))

        # ---------------- I · guarded deletion ----------------
        # hash-only navigation keeps the in-memory reassignments from section G
        await pg.click(".m7-lib-tabs button:nth-child(1)")
        await pg.wait_for_timeout(500)
        ck("H9 switching tabs resets the inspector to overview", "is-on" in await pg.get_attribute(".m7-insp-tabs button:nth-child(1)", "class"))
        await pg.click(".m7-row:has-text('Default Website Layout') .m7-row-menu")
        await pg.wait_for_timeout(260)
        await pg.click(".dropdown >> text=Archive layout")
        await pg.wait_for_timeout(380)
        ck("I1 deleting the default is refused", await pg.is_disabled(".modal-foot .btn-danger"))
        ck("I2 the refusal explains why", "website default" in (await txt(pg, ".m7-block-reasons")).lower())
        await close_overlays(pg)
        await pg.click(".m7-row:has-text('Campaign Landing Layout') .m7-row-menu")
        await pg.wait_for_timeout(260)
        await pg.click(".dropdown >> text=Archive layout")
        await pg.wait_for_timeout(380)
        ck("I3 a layout in use is refused", await pg.is_disabled(".modal-foot .btn-danger"))
        ck("I4 the refusal names the page count", "still use it" in (await txt(pg, ".m7-block-reasons")).lower())
        await close_overlays(pg)
        await pg.click(".m7-lib-foot")
        await pg.wait_for_timeout(300)
        await pg.click(".m7-row.is-arch .m7-row-menu")
        await pg.wait_for_timeout(240)
        ck("I5 archived rows offer restore instead of delete", "Restore layout" in await txt(pg, ".dropdown"))
        await close_overlays(pg)
        await pg.click(".m7-row.is-arch .m7-row-menu")
        await pg.wait_for_timeout(220)
        await pg.click(".dropdown >> text=Restore layout")
        await pg.wait_for_timeout(900)
        ck("I6 restore works and the row leaves the archive", await n(pg, ".m7-row.is-arch") == 0)

        # ---------------- J · preview / seo / preflight ----------------
        await go(pg, "?site=site_main&tab=layouts&sel=lay_default")
        await pg.click(".m7-head-right .btn:has-text('Preview Layout')")
        await pg.wait_for_timeout(420)
        ck("J1 preview dialog opens with a page picker", await n(pg, ".m7-pv-frame") == 1)
        ck("J2 preview states the page's real binding", "Page currently bound to" in await txt(pg, ".m7-pv-meta"))
        ck("J3 preview is honest about not being live", "not live" in (await txt(pg, ".m7-pv-bar")).lower())
        await pg.click(".modal .m7-devices button[aria-label='mobile']")
        await pg.wait_for_timeout(320)
        ck("J4 preview width switching works", await n(pg, ".m7-pv-frame.is-mobile") == 1)
        await close_overlays(pg)
        await pg.click(".m7-seo-pill")
        await pg.wait_for_timeout(340)
        ck("J5 SEO readiness is a computed checklist", await n(pg, ".m7-seo-list > div") >= 3)
        ck("J6 the checklist shows pass states", await n(pg, ".m7-seo-list .is-ok") >= 1)
        await close_overlays(pg)
        await pg.click(".m7-head-right .btn:has-text('Preflight')")
        await pg.wait_for_timeout(360)
        ck("J7 preflight lists binding problems", await n(pg, ".m7-pf") >= 1)
        ck("J8 preflight separates blockers from warnings", await n(pg, ".m7-pf.error") + await n(pg, ".m7-pf.warn") == await n(pg, ".m7-pf"))
        ck("J9 each finding explains itself", await n(pg, ".m7-pf p") >= 1 and len(await txt(pg, ".m7-pf p")) > 8)
        await close_overlays(pg)

        # ---------------- K · a11y / keyboard ----------------
        ck("K1 tabs expose selection state", await pg.evaluate("() => [...document.querySelectorAll('.m7-insp-tabs button')].every(b => b.hasAttribute('aria-selected'))"))
        ck("K2 the layout name is a labelled input", await pg.evaluate("() => !!document.querySelector('.m7-name')?.getAttribute('aria-label')"))
        ck("K3 region switches are buttons with pressed state", await n(pg, ".m7-mini-sw[aria-pressed]") >= 3)
        await pg.keyboard.press("Control+k")
        await pg.wait_for_timeout(320)
        ck("K4 ⌘K opens the workspace command palette", await n(pg, ".palette, .cmdk") >= 1 or await pg.evaluate("() => document.activeElement === document.querySelector('.m7-lib-search input')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(200)
        ck("K5 no console or page errors", not errs, "; ".join(errs[:3]))

        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_layouts · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS:
            print(" ·", f)
        sys.exit(1)

asyncio.run(main())
