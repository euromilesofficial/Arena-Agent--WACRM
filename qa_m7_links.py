#!/usr/bin/env python3
"""Module 7 — the interlinks and the revision drawer.

Four things that used to be missing or fake:
  · a revision history that restores what it says it restores
  · Module 3 naming the shell a page actually gets
  · Module 5 counting where a block is used in layouts and templates
  · Module 8's placeholder reading the header variant instead of inventing a menu
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

async def cold(pg, hash_):
    await pg.goto("about:blank")
    await pg.goto(URL + hash_)
    await pg.wait_for_timeout(1500)

async def open_history(pg):
    await pg.locator(".m7-insp-foot .btn:has-text('History')").click()
    await until(pg, "() => document.querySelectorAll('.m7-hist-row:not(.is-skel)').length > 0")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)

        # ---------------- A · revision history, layouts ----------------
        await cold(pg, "#/layouts")
        ck("A1 the inspector offers a history entry point", await n(pg, ".m7-insp-foot .btn:has-text('History')") == 1)
        await open_history(pg)
        rows = await n(pg, ".m7-hist-row")
        ck("A2 the drawer lists the revisions recorded for this layout", rows >= 2, str(rows))
        ck("A3 the dialog names the target and the count",
           "Default Website Layout" in await txt(pg, ".modal-sub") and "revision" in await txt(pg, ".modal-sub"))
        first = await txt(pg, ".m7-hist-row")
        ck("A4 the newest revision is marked as the current draft", "current draft" in first and "live draft" in first, first)
        ck("A5 the newest revision is not restorable over itself",
           await pg.locator(".m7-hist-row").first.locator(".btn:has-text('Restore')").count() == 0)
        meta = await txt(pg, ".m7-hist-meta")
        ck("A6 each row states who, when and what changed about the block count",
           "·" in meta and ("block" in meta))
        ck("A7 the drawer explains that restoring writes a new revision",
           "new revision" in await txt(pg, ".m7-hist-note"))

        older = pg.locator(".m7-hist-row").nth(1)
        ck("A8 an older revision offers Restore", await older.locator(".btn:has-text('Restore')").count() == 1)
        await older.locator(".btn:has-text('Restore')").click()
        await pg.wait_for_timeout(250)
        ck("A9 restore asks first and names the revision",
           "Restore r" in await txt(pg, ".m7-hist-confirm"))
        await pg.locator(".m7-hist-confirm .btn:has-text('Cancel')").first.click()
        await pg.wait_for_timeout(250)
        ck("A10 cancelling leaves history untouched", await n(pg, ".m7-hist-confirm") == 0)

        await pg.locator(".m7-hist-row").nth(1).locator(".btn:has-text('Restore')").click()
        await pg.wait_for_timeout(200)
        await pg.locator(".m7-hist-confirm .btn-primary").click()
        await until(pg, "() => !!document.querySelector('.toast')")
        toast = await txt(pg, ".toast")
        ck("A11 the restore reports itself with the revision it came from",
           "Restored" in toast and "r" in toast, toast[:90])
        ck("A12 the drawer closes after a successful restore", await n(pg, ".m7-hist") == 0)
        await pg.wait_for_timeout(900)
        await open_history(pg)
        after = await n(pg, ".m7-hist-row")
        ck("A13 the restore added a revision instead of editing one in place", after == rows + 1, f"{rows} → {after}")
        ck("A14 the new row says what it restored",
           "Restored the structure recorded at" in await txt(pg, ".m7-hist-row"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(250)

        # ---------------- B · revision history, templates ----------------
        await pg.get_by_role("tab", name="Page Templates").click()
        await pg.wait_for_timeout(500)
        await pg.locator(".m7-row").first.click()
        await pg.wait_for_timeout(400)
        ck("B1 templates have their own history entry point",
           await n(pg, ".m7-insp-foot .btn:has-text('History')") == 1)
        await open_history(pg)
        ck("B2 the template drawer opens on a template record and is honest when empty",
           await n(pg, ".m7-hist-row") >= 1 or await n(pg, ".m7-hist-empty") == 1,
           await txt(pg, ".modal-sub"))
        if await n(pg, ".m7-hist-empty"):
            ck("B3 an empty history explains itself instead of showing a blank panel",
               "No revisions recorded" in await txt(pg, ".m7-hist-empty"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(200)

        # ---------------- C · Module 3 names the shell ----------------
        await cold(pg, "#/pages")
        ck("C1 the page inspector shows a layout read-out", await n(pg, ".d3-layoutro") >= 1)
        ro = await txt(pg, ".d3-layoutro")
        ck("C2 it names the resolved layout, not the stored label",
           "Default Website Layout" in ro and ro.strip() != "Site default", ro[:80])
        ck("C3 it says whether the page follows the default or is pinned",
           "follows the website default" in ro or "pinned to this page" in ro, ro[:120])
        ck("C4 it reports the header variant and its link count",
           "Global Header" in ro and "nav links" in ro, ro[:140])
        await pg.locator(".d3-linkval").first.click()
        await pg.wait_for_timeout(1600)
        ck("C5 the variant name deep-links into Layouts & Templates",
           "#/layouts" in pg.url, pg.url)
        ck("C6 the deep link lands on the layout the page uses",
           "Default Website Layout" in await txt(pg, ".m7-crumbs"), await txt(pg, ".m7-crumbs"))

        # ---------------- D · Module 5 counts real usage ----------------
        await cold(pg, "#/library")
        chips = await n(pg, ".m5-m7use")
        ck("D1 every native block card carries a layout/template usage count", chips >= 15, str(chips))
        chip = await txt(pg, ".m5-m7use")
        ck("D2 the count is rendered as layouts · templates", "L" in chip and "T" in chip, chip)
        await pg.locator(".m5-card[data-kind='block']").first.locator(".btn:has-text('Preview')").click()
        await pg.wait_for_timeout(600)
        ck("D3 the inspector has a shell-usage section", await n(pg, ".m5-h4:has-text('Used in the shell')") == 1)
        shell = await pg.evaluate("""() => {
          const h = [...document.querySelectorAll('.m5-h4')].find(x => /Used in the shell/.test(x.textContent));
          return h && h.nextElementSibling ? h.nextElementSibling.innerText : '';
        }""")
        ck("D4 it names layouts, templates and chrome separately",
           ("master layout" in shell) and ("template" in shell), shell[:160])

        # ---------------- E · Module 8 reads the header variant ----------------
        await cold(pg, "#/menus")
        ck("E1 the placeholder shows the live navigation source", await n(pg, ".ph-nav") == 1)
        nav = await txt(pg, ".ph-nav")
        ck("E2 it names the layout and the header variant", "Default Website Layout" in nav and "Global Header" in nav, nav[:140])
        items = await pg.locator(".ph-nav-list li").all_inner_texts()
        ck("E3 it lists the real links from that variant", len(items) >= 3 and "Home" in " ".join(items), str(items))
        ck("E4 it says where the links are edited today", "Layouts & Templates" in nav or "Layouts &amp; Templates" in nav)
        await pg.get_by_role("button", name="Open layout").click()
        await pg.wait_for_timeout(1500)
        ck("E5 Open layout reaches Module 7", "#/layouts" in pg.url, pg.url)

        # ---------------- G · the canvas shows real content, not sketches ----------------
        await cold(pg, "#/layouts")
        await pg.get_by_role("tab", name="Page Templates").click()
        await pg.wait_for_timeout(800)
        await pg.select_option(".m7-zoom", "0")
        await pg.wait_for_timeout(300)
        ck("G1 the slot draws the builder's real blocks, not grey sketches",
           await n(pg, ".m7l-blocks .m7l-block .wb-el") >= 3, str(await n(pg, ".m7l-blocks .m7l-block .wb-el")))
        ck("G2 the sketch placeholders are gone", await n(pg, ".m7l-blocks .m7l-lines") == 0)
        hd = await txt(pg, ".m7l-blocks .wb-h1, .m7l-blocks .wb-h2")
        ck("G3 the template's own heading is readable copy", len(hd.strip()) > 3, hd[:80])
        await pg.select_option(".m7-zoom", "100")
        await pg.wait_for_timeout(300)
        box = await pg.evaluate("() => { const f=document.querySelector('.m7l-frame'); return f ? Math.round(f.getBoundingClientRect().width) : 0 }")
        ck("G4 100% is the device's true width (1440 px desktop), not a fit", box >= 1400, str(box))
        await pg.select_option(".m7-zoom", "0")
        await pg.wait_for_timeout(300)
        fit = await pg.evaluate("() => { const f=document.querySelector('.m7l-frame'); return f ? Math.round(f.getBoundingClientRect().width) : 0 }")
        ck("G5 Fit scales the frame into the stage", 0 < fit < 700, str(fit))

        # the Prebuilt browser draws each kit as a page, not as a list
        await pg.get_by_role("button", name="Prebuilt").first.click()
        await pg.wait_for_timeout(1200)
        await pg.locator(".m7-pre-row").first.click()
        await pg.wait_for_timeout(500)
        ck("G6 the kit is drawn as a page at its design width",
           await n(pg, ".m7-pre-render .m7-pre-scale .wb-el") >= 3)
        ck("G7 the drawn kit has visible copy", len((await txt(pg, ".m7-pre-render")).strip()) > 20)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ---------------- F · hygiene ----------------
        ck("F1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_links · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS:
            print(" ·", f)
        sys.exit(1)

asyncio.run(main())
