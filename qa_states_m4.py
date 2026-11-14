#!/usr/bin/env python3
"""Module 4 — Visual Builder · state matrix (loading, empty, error, roles, conflict, AI, messaging)."""
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

async def fresh(pg, qs="?page=pg_site_main_2"):
    await pg.goto(URL + "#/builder" + qs)
    await pg.reload()
    await pg.wait_for_timeout(1500)

async def forced(pg, label):
    """Drive the shared Prototype-states menu — the same entry point Modules 1–3 use."""
    for _ in range(3):
        if await n(pg, ".overlay"):
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(220)
        else:
            break
    await pg.click('button[aria-label="Prototype states"]')
    await pg.wait_for_timeout(250)
    await pg.click(f'.dropdown button:has-text("{label}")')
    await pg.wait_for_timeout(950)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # ---------- 1 · loading ----------
        await pg.goto(URL + "#/builder?page=pg_site_main_2")
        await pg.wait_for_timeout(120)
        ck("1.1 skeleton paints before data", await n(pg, ".sk") > 0)
        await pg.wait_for_timeout(1600)
        ck("1.2 skeleton is replaced by the canvas", await n(pg, ".wb-doc") == 1)

        # ---------- 2 · empty page ----------
        await forced(pg, "Empty")
        ck("2.1 empty page shows the empty canvas state", await n(pg, '[data-empty-canvas="1"]') == 1)
        ck("2.2 empty state offers three ways in", await n(pg, '[data-empty-canvas="1"] .btn') == 3)
        ck("2.3 empty canvas is a drop target", await n(pg, '[data-empty-canvas="1"][data-slot-end="1"]') == 1)
        await pg.click('[data-empty-canvas="1"] .btn:has-text("Browse sections")')
        await pg.wait_for_timeout(300)
        ck("2.4 the empty-state CTA switches the library tab", "True" == str(await pg.eval_on_selector("#wb-tab-sections", 'e => e.getAttribute("aria-selected")')).capitalize())
        await forced(pg, "Default")

        # ---------- 3 · service down ----------
        await forced(pg, "Error")
        await pg.wait_for_timeout(400)
        ck("3.1 draft load failure is a blocking state", await n(pg, ".wb-canvas-state") >= 1)
        ck("3.2 the failure names itself", "draft could not be loaded" in await pg.inner_text(".wb-canvas-state"))
        ck("3.3 retry is offered", await n(pg, '.wb-canvas-state .btn') == 1)
        await forced(pg, "Default")
        await pg.wait_for_timeout(900)

        # ---------- 4 · viewer role ----------
        await forced(pg, "Permission denied")
        await pg.wait_for_timeout(500)
        ck("4.1 viewer sees the read-only bar", await n(pg, ".wb-readonly") == 1)
        ck("4.2 publish is disabled for a viewer", await pg.eval_on_selector('[data-act="open-publish"]', "e => e.disabled") is True)
        ck("4.3 content fields are disabled", await pg.eval_on_selector('.wb-insp-body [data-field]', "e => e.disabled") is True)
        await pg.click("#wb-tab-blocks")
        await pg.wait_for_timeout(250)
        ck("4.4 tiles still render for a viewer", await n(pg, ".wb-tile") == 20)
        await forced(pg, "Default")
        await pg.wait_for_timeout(600)

        # ---------- 5 · save conflict (CAS) ----------
        await forced(pg, "Publish conflict")
        await pg.fill('.wb-insp-body [data-field="heading"] >> nth=0', "Conflict copy")
        await pg.wait_for_timeout(3200)
        ck("5.1 a stale save opens the conflict dialog", "saved elsewhere" in (await pg.inner_text(".modal")).lower())
        ck("5.2 both resolutions are offered", "Reload theirs" in await pg.inner_text(".modal") and "Keep mine" in await pg.inner_text(".modal"))
        ck("5.3 the dialog promises no silent loss", "history" in (await pg.inner_text(".modal")).lower())
        await pg.click('.modal button:has-text("Keep mine")')
        await pg.wait_for_timeout(900)
        ck("5.4 keep-mine resolves the conflict", await n(pg, ".modal") == 0)
        ck("5.5 the draft survives", "Conflict copy" in await pg.inner_text('[data-slot] [data-el="heading"]'))
        ck("5.6 status returns to saved", await pg.get_attribute(".wb-status", "data-status") == "saved")
        await forced(pg, "Default")
        await pg.wait_for_timeout(600)

        # ---------- 6 · save failure ----------
        await pg.evaluate("() => { window.__wacrmBuilder.mode.fail = true; }")
        await pg.fill('.wb-insp-body [data-field="heading"] >> nth=0', "Will not save")
        await pg.wait_for_timeout(3200)
        ck("6.1 a failed save is visible, not silent", await pg.get_attribute(".wb-status", "data-status") == "failed")
        ck("6.2 the status pill offers retry", "Retry" in await pg.inner_text(".wb-status"))
        ck("6.3 leaving with unsaved work asks first", await n(pg, ".modal") == 1 and "not saved" in (await pg.inner_text(".modal")).lower())
        ck("6.4 retry is the primary action", "Retry save" in await pg.inner_text(".modal"))
        await pg.click('.modal button:has-text("Stay here")')
        await pg.wait_for_timeout(250)
        await pg.evaluate("() => { window.__wacrmBuilder.mode.fail = false; }")
        await pg.click(".wb-status")
        await pg.wait_for_timeout(900)
        ck("6.5 retry succeeds once the service is back", await pg.get_attribute(".wb-status", "data-status") == "saved",
           str(await pg.get_attribute(".wb-status", "data-status")))

        # ---------- 7 · AI states ----------
        await fresh(pg)
        await pg.click('[data-slot] [data-el="description"]')
        await pg.wait_for_timeout(300)
        await pg.evaluate("() => { window.__wacrmBuilder.mode.aiError = true; }")
        before = await pg.inner_text('[data-slot] [data-el="description"]')
        await pg.click('.wb-ai-act:has-text("Improve")')
        await pg.wait_for_timeout(1200)
        ck("7.1 assistant failure is reported in place", await n(pg, '[data-ai-stream="error"]') == 1)
        ck("7.2 the failure says nothing changed", "Nothing was changed" in await pg.inner_text(".wb-ai") or "no new claims" in await pg.inner_text(".wb-ai"))
        ck("7.3 the draft is untouched by a failure", await pg.inner_text('[data-slot] [data-el="description"]') == before)
        ck("7.4 accept is disabled after a failure", await pg.eval_on_selector(".wb-ai-b", "e => e.disabled") is True)
        await pg.click('.wb-ai-b:has-text("Discard")')
        await pg.wait_for_timeout(250)
        await pg.evaluate("() => { window.__wacrmBuilder.mode.aiError = false; }")
        await pg.click('[data-slot] [data-el="description"]')
        await pg.wait_for_timeout(250)
        await pg.click('.wb-ai-act:has-text("Make Punchier")')
        await pg.wait_for_timeout(250)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)
        ck("7.5 escape aborts a running suggestion", await n(pg, ".wb-ai") == 0)
        ck("7.6 aborting leaves the draft unchanged", await pg.inner_text('[data-slot] [data-el="description"]') == before)

        # ---------- 8 · empty library / no forms ----------
        await pg.evaluate("() => { window.__wacrmBuilder.mode.emptyLibrary = true; }")
        await pg.click("#wb-tab-sections")
        await pg.wait_for_timeout(200)
        await pg.click("#wb-tab-blocks")
        await pg.wait_for_timeout(350)
        ck("8.1 empty catalogue is explained", "No blocks available" in await pg.inner_text(".wb-lib-body"))
        await pg.click("[data-slot] .wb-blk >> nth=4")
        await pg.wait_for_timeout(300)
        if "Form" in await pg.inner_text(".wb-insp-name"):
            ck("8.2 form block with no forms explains the empty picker", "No forms yet" in await pg.inner_text(".wb-insp-body"))
        else:
            ck("8.2 form block with no forms explains the empty picker", False, await pg.inner_text(".wb-insp-name"))
        await pg.evaluate("() => { window.__wacrmBuilder.mode.emptyLibrary = false; }")

        # ---------- 9 · deleted page ----------
        await pg.goto(URL + "#/builder?page=pg_does_not_exist")
        await pg.reload()
        await pg.wait_for_timeout(1600)
        ck("9.1 a deleted page is a blocking state, not an empty editor", await n(pg, ".wb-blocked") == 1)
        ck("9.2 it offers a way back to Pages", "Back to Pages" in await pg.inner_text(".wb-blocked"))
        ck("9.3 it says drafts are not lost", "Nothing was lost" in await pg.inner_text(".wb-blocked"))

        # ---------- 10 · publish guards ----------
        await fresh(pg)
        await pg.fill('.wb-insp-body [data-field="heading"] >> nth=0', "Unsaved before publish")
        await pg.wait_for_timeout(300)
        await pg.click('[data-act="open-publish"]')
        await pg.wait_for_timeout(400)
        ck("10.1 publish is held while the page is dirty", "Save your changes before publishing" in await pg.inner_text(".modal"))
        ck("10.2 the primary action becomes Save first", "Save first" in await pg.inner_text(".modal"))
        await pg.click('.modal button:has-text("Save first")')
        await pg.wait_for_timeout(1400)
        ck("10.3 saving releases the publish button", await n(pg, '.modal [data-act="publish"]') == 1)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ---------- 11 · reduced motion ----------
        await pg.emulate_media(reduced_motion="reduce")
        await pg.reload()
        await pg.wait_for_timeout(1500)
        rm = await pg.evaluate("""() => {
          const e = document.querySelector('.wb-root') || document.body;
          return getComputedStyle(e).animationDuration;
        }""")
        try:
            rm_ok = float(rm.replace("s", "")) < 0.01
        except ValueError:
            rm_ok = rm in ("", "0s")
        ck("11.1 reduced motion is honoured", rm_ok, rm)
        await pg.emulate_media(reduced_motion="no-preference")

        # ---------- 12 · keyboard path ----------
        await fresh(pg)
        await pg.focus('[data-block="quote"]')
        before = await n(pg, "[data-slot]")
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(500)
        ck("12.1 a focused tile inserts with Enter", await n(pg, "[data-slot]") == before + 1)
        await pg.click("#wb-tab-pages")
        await pg.wait_for_timeout(250)
        await pg.focus(".wb-struct-row >> nth=2")
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(300)
        ck("12.2 structure rows are keyboard selectable", await n(pg, ".wb-struct-row.is-sel") == 1)
        await pg.focus(".wb-insp-body [data-field]")
        await pg.keyboard.type("x")
        await pg.wait_for_timeout(300)
        ck("12.3 inspector fields accept keyboard input", await pg.get_attribute(".wb-status", "data-status") in ("dirty", "saving", "saved"))
        await pg.click('[data-act="open-publish"]')
        await pg.wait_for_timeout(400)
        ck("12.4 the publish dialog opens from the header", await n(pg, ".modal") == 1)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(350)
        ck("12.5 escape closes the dialog without touching the selection", await n(pg, ".modal") == 0 and await n(pg, ".overlay") == 0)
        ck("12.6 the selection survives the dialog", await n(pg, ".wb-blk.is-sel") >= 1 or await n(pg, ".wb-struct-row.is-sel") >= 1)

        # ---------- 13 · toasts + empty search ----------
        await pg.fill(".wb-lib-search input", "zzzz")
        await pg.wait_for_timeout(300)
        ck("13.1 empty search explains itself", "No" in await pg.inner_text(".wb-lib-body"))
        await pg.fill(".wb-lib-search input", "")
        await pg.wait_for_timeout(200)

        print("\nerrors:", errs[:5])
        ck("Z1 no page errors", len(errs) == 0, str(errs[:2]))
        print(f"\n==== qa_states_m4: {TALLY['ok']} passed, {TALLY['fail']} failed ====")
        for f in FAILS:
            print("  -", f)
        await b.close()
        return TALLY["fail"]

sys.exit(asyncio.run(main()))
