#!/usr/bin/env python3
"""Module 4 — AI mode · acceptance suite (composer, page build, section, rewrite, states)."""
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

async def n(pg, sel):
    return await pg.locator(sel).count()

async def go(pg, qs="?page=pg_site_main_2"):
    await pg.goto(URL + "#/builder" + qs)
    await pg.reload()
    await pg.wait_for_timeout(1700)

async def forced(pg, label):
    for _ in range(3):
        if await n(pg, ".overlay"):
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(220)
        else:
            break
    await pg.click('button[aria-label="Prototype states"]')
    await pg.wait_for_timeout(250)
    await pg.click(f'.dropdown button:has-text("{label}")')
    await pg.wait_for_timeout(1000)

async def shot(pg, name):
    """Screenshots are WebP on disk — png is only the intermediate the browser writes."""
    png = f"/tmp/{name}.png"
    await pg.screenshot(path=png)
    from PIL import Image
    Image.open(png).save(f"{OUT}/{name}.webp", "WEBP", quality=82, method=6)
    import os
    os.remove(png)

async def blocks(pg):
    return await n(pg, ".wb-doc [data-block-id]")

async def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))

        # ---------- 1 · entry points ----------
        await go(pg)
        ck("1.1 a non-empty page shows the AI Copy button in the toolbar", await n(pg, "[data-ai-open]") == 1)
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(300)
        ck("1.2 the button opens the composer", await n(pg, '[data-ai-panel="page"]') == 1)
        ck("1.3 the composer opens idle", await pg.get_attribute('[data-ai-panel]', "data-ai-stage") == "idle")
        ck("1.4 it names the provider, not a generic 'AI'", "Gemini" in (await pg.inner_text(".wb-aip-prov")))
        ck("1.5 it shows the workspace AI budget", "34 / 200" in (await pg.inner_text(".wb-aip-budget")))
        ck("1.6 Generate is disabled with an empty prompt",
           await pg.is_disabled('.wb-aip button:has-text("Generate")'))
        ck("1.7 three tasks are offered", await n(pg, ".wb-aip-mode") == 3)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(250)
        ck("1.8 Escape closes it and leaves the page alone", await n(pg, "[data-ai-panel]") == 0)
        await shot(pg, "ai-01-toolbar")

        # ---------- 2 · prompt composer behaviour ----------
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(280)
        ck("2.1 the composer takes a prompt", await n(pg, ".wb-aip-input textarea") == 1)
        await pg.click('.wb-aip-chip:has-text("Scholarships")')
        await pg.wait_for_timeout(180)
        val = await pg.input_value(".wb-aip-input textarea")
        ck("2.2 a suggestion fills the prompt", val.startswith("Scholarships page"), val)
        ck("2.3 the character count tracks it", "/240" in (await pg.inner_text(".wb-aip-count")))
        ck("2.4 Generate is enabled once there is a prompt",
           not await pg.is_disabled('.wb-aip button:has-text("Generate")'))
        ck("2.5 the footer states what it will not do", "no invented stats" in (await pg.inner_text(".wb-aip-hint")).lower())
        await shot(pg, "ai-02-prompt")

        # ---------- 3 · generating a page ----------
        before = await blocks(pg)
        await pg.click('.wb-aip button:has-text("Generate")')
        await pg.wait_for_timeout(420)
        ck("3.1 generating shows a running state", await pg.get_attribute('[data-ai-panel]', "data-ai-stage") == "running")
        ck("3.2 a spinner marks the live step", await n(pg, ".wb-aip-spin") >= 1)
        ck("3.3 the page is untouched while it runs", await blocks(pg) == before)
        await shot(pg, "ai-03-running")
        await pg.wait_for_timeout(2400)
        ck("3.4 the plan lands row by row", await n(pg, "[data-plan-row]") == 4)
        ck("3.5 the plan is honest about draft copy", "draft copy you can edit" in (await pg.inner_text(".wb-aip-summary")))
        ck("3.6 the plan says it fits the page", "fits this page" in (await pg.inner_text(".wb-aip-summary")))
        ck("3.7 the primary action counts the sections",
           "Insert 4 sections" in (await pg.inner_text(".wb-aip-foot button:has-text(\"Insert\")")))
        await shot(pg, "ai-04-ready")

        # ---------- 4 · inserting ----------
        await pg.click('.wb-aip button:has-text("Insert 4 sections")')
        await pg.wait_for_timeout(700)
        after = await blocks(pg)
        ck("4.1 inserting grows the page", after > before, f"{before} -> {after}")
        ck("4.2 the composer closes on insert", await n(pg, "[data-ai-panel]") == 0)
        txt = await pg.inner_text("body")
        ck("4.3 the toast names what happened", "Page generated" in txt or "added below your page" in txt)
        ck("4.4 the toast is explicit about editable draft copy", "draft copy, editable" in txt)
        await shot(pg, "ai-05-inserted")

        # ---------- 5 · undo ----------
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(600)
        ck("5.1 one undo takes the whole generation back", await blocks(pg) == before, f"{after} -> {await blocks(pg)}")

        # ---------- 6 · section mode ----------
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(250)
        await pg.click('.wb-aip-mode:has-text("Add a section")')
        await pg.wait_for_timeout(200)
        ck("6.1 the task chips switch mode", await pg.get_attribute('[data-ai-panel]', "data-ai-panel") == "section")
        await pg.fill(".wb-aip-input textarea", "Questions parents always ask")
        await pg.click('.wb-aip button:has-text("Generate")')
        await pg.wait_for_timeout(1500)
        ck("6.2 a section plan is a single row", await n(pg, "[data-plan-row]") == 1)
        sec_before = await blocks(pg)
        await pg.click('.wb-aip button:has-text("Insert section")')
        await pg.wait_for_timeout(600)
        ck("6.3 the section is inserted", await blocks(pg) > sec_before)
        ck("6.4 the toast says section, not page", "Section generated" in (await pg.inner_text("body")))
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(500)

        # ---------- 7 · rewrite copy needs a selection ----------
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(250)
        await pg.click('.wb-aip-mode:has-text("Rewrite copy")')
        await pg.wait_for_timeout(200)
        ck("7.1 rewrite mode without a selection warns instead of guessing",
           await n(pg, '[data-ai-warn="no-selection"]') == 1)
        ck("7.2 and Generate stays disabled",
           await pg.is_disabled('.wb-aip button:has-text("Generate")'))
        await shot(pg, "ai-06-no-selection")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(250)

        # ---------- 8 · rewrite on a real element ----------
        el = pg.locator(".wb-doc [data-el=\"heading\"]").first
        ck("8.1 the canvas exposes editable text elements", await pg.locator(".wb-doc [data-el]").count() > 0)
        if await pg.locator(".wb-doc [data-el]").count():
            await el.click()
            await pg.wait_for_timeout(350)
            await pg.click("[data-ai-open]")
            await pg.wait_for_timeout(300)
            ck("8.2 only one AI surface is on screen",
               await n(pg, ".wb-ai") == 0 and await n(pg, "[data-ai-panel]") == 1)
            ck("8.3 opening from a selection lands in rewrite mode",
               await pg.get_attribute('[data-ai-panel]', "data-ai-panel") == "copy")
            ph = await pg.get_attribute(".wb-aip-input textarea", "placeholder") or ""
            ck("8.4 the panel echoes the original line", "Rewrite “" in ph and len(ph) > 20, ph)
            await pg.fill(".wb-aip-input textarea", "Make it shorter")
            await pg.click('.wb-aip button:has-text("Generate")')
            await pg.wait_for_timeout(2200)
            quoted = await pg.inner_text(".wb-aip-quote p")
            src = await pg.inner_text(".wb-aip-quote s")
            ck("8.5 the rewrite streams into the panel", len(quoted.strip()) > 0 and quoted.strip() != "…")
            ck("8.6 it is never longer than the source", len(quoted.strip()) <= len(src) + 2, f"{len(src)} -> {len(quoted.strip())}")
            ck("8.7 a no-op rewrite says so instead of inventing a change",
               await n(pg, '[data-ai-noop="1"]') == 1)
            ck("8.8 nothing is committed before the accept",
               await pg.get_attribute('[data-ai-panel]', "data-ai-stage") == "ready")
            await shot(pg, "ai-07-rewrite")
            await pg.click('.wb-aip button:has-text("Replace copy")')
            await pg.wait_for_timeout(500)
            ck("8.9 accepting closes the panel", await n(pg, "[data-ai-panel]") == 0)
            ck("8.10 the toast offers the undo", "⌘Z to undo" in (await pg.inner_text("body")))
            await pg.keyboard.press("Control+z")
            await pg.wait_for_timeout(400)

        # ---------- 9 · error state ----------
        await pg.evaluate("() => { window.__wacrmBuilder.mode.aiError = true; }")
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(250)
        await pg.fill(".wb-aip-input textarea", "A landing page for a university fair")
        await pg.click('.wb-aip button:has-text("Generate")')
        await pg.wait_for_timeout(900)
        ck("9.1 a provider failure surfaces in the panel", await n(pg, '[data-ai-error="1"]') == 1)
        ck("9.2 the failure says the page was not touched", "Nothing was added" in (await pg.inner_text('[data-ai-error="1"]')))
        ck("9.3 retry is offered instead of insert", await n(pg, '.wb-aip button:has-text("Try again")') == 1)
        await shot(pg, "ai-08-error")
        await pg.click('.wb-aip button:has-text("Try again")')
        await pg.wait_for_timeout(700)
        ck("9.4 trying again keeps failing honestly while the provider is down",
           await n(pg, '[data-ai-error="1"]') == 1)
        await pg.evaluate("() => { window.__wacrmBuilder.mode.aiError = false; }")
        await pg.click('.wb-aip button:has-text("Try again")')
        await pg.wait_for_timeout(3600)
        ck("9.5 recovery reaches a usable plan", await n(pg, "[data-plan-row]") >= 4,
           str(await n(pg, "[data-plan-row]")))
        ck("9.6 the plan respects intent precedence (a 'university fair' plans as a programme page)",
           await n(pg, '[data-plan-row="pricing"]') == 1)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(250)

        # ---------- 10 · no provider ----------
        await pg.evaluate("() => { window.__wacrmBuilder.mode.noAiProvider = true; }")
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(250)
        await pg.fill(".wb-aip-input textarea", "Contact page")
        await pg.click('.wb-aip button:has-text("Generate")')
        await pg.wait_for_timeout(800)
        ck("10.1 an unconnected provider is named, not faked",
           "No AI provider" in (await pg.inner_text('[data-ai-error="1"]')))
        await pg.evaluate("() => { window.__wacrmBuilder.mode.noAiProvider = false; }")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(200)

        # ---------- 11 · quota ----------
        await pg.evaluate("() => { window.__wacrmBuilder.mode.aiQuota = true; }")
        await pg.click("[data-ai-open]")
        await pg.wait_for_timeout(250)
        await pg.fill(".wb-aip-input textarea", "Fees page")
        await pg.click('.wb-aip button:has-text("Generate")')
        await pg.wait_for_timeout(800)
        ck("11.1 an exhausted budget says when it resets",
           "midnight UTC" in (await pg.inner_text('[data-ai-error="1"]')))
        await pg.evaluate("() => { window.__wacrmBuilder.mode.aiQuota = false; }")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(200)

        # ---------- 12 · empty page generation ----------
        await forced(pg, "Empty")
        ck("12.1 the empty canvas offers AI first", await n(pg, '[data-empty-ai="1"]') == 1)
        ck("12.2 the manual routes are still there", await n(pg, '[data-empty-canvas="1"] .btn') == 3)
        await shot(pg, "ai-09-empty")
        await pg.click('[data-empty-ai="1"]')
        await pg.wait_for_timeout(320)
        ck("12.3 it opens the composer on Build a page", await pg.get_attribute('[data-ai-panel]', "data-ai-panel") == "page")
        await pg.fill(".wb-aip-input textarea", "A landing page to book a free counselling call")
        await pg.click('.wb-aip button:has-text("Generate")')
        await pg.wait_for_timeout(2600)
        ck("12.4 booking intent plans a booking page", await n(pg, '[data-plan-row="form"]') == 1)
        ck("12.5 the summary fits all rows before the limit", "fits this page" in (await pg.inner_text(".wb-aip-summary")))
        await shot(pg, "ai-10-empty-ready")
        await pg.click('.wb-aip button:has-text("Insert")')
        await pg.wait_for_timeout(800)
        ck("12.6 a blank page becomes a real page", await n(pg, ".wb-doc") == 1 and await blocks(pg) >= 4)
        ck("12.7 the empty state is gone", await n(pg, '[data-empty-canvas="1"]') == 0)
        ck("12.8 the generated form is wired to a saved form, not an empty shell",
           await n(pg, '.wb-doc [data-block-id] :text("No form attached")') == 0)
        ck("12.9 the first block carries the topic the editor typed",
           "COUNSELLING" in (await pg.inner_text(".wb-doc")).upper())
        await shot(pg, "ai-11-empty-built")
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(600)
        ck("12.10 undo returns the page to empty", await n(pg, '[data-empty-canvas="1"]') == 1)
        await shot(pg, "ai-12-empty-undone")

        # ---------- 13 · viewer ----------
        await forced(pg, "Default")
        ck("13.1 no page errors during the suite", not errs, "; ".join(errs[:2]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\n{'-'*54}\nAI MODE  {TALLY['ok']}/{total} checks passed")
    for f in FAILS:
        print("  · " + f)
    return 0 if TALLY["fail"] == 0 else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
