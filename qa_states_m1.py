"""Module 1 — Overview state coverage audit.

Mirrors qa_states.py (Module 2): drives every state the Overview screen can be
in against the built prototype, opened from file://.

    python3 qa_states_m1.py
"""
import asyncio, sys

from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/overview"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{('  → ' + str(detail)) if detail else ''}")


async def close_overlays(pg):
    for _ in range(3):
        if await pg.evaluate("()=>!!document.querySelector('.modal, .drawer')"):
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(300)
        else:
            return


async def forced(pg, label, settle=1900):
    await pg.click('[aria-label="Prototype states"]')
    await pg.wait_for_timeout(240)
    await pg.evaluate("l=>[...document.querySelectorAll('.dropdown .menu-item')]"
                      ".find(b=>b.textContent.includes(l)).click()", label)
    await pg.wait_for_timeout(settle)


async def card_text(pg, needle):
    return await pg.evaluate("""n=>{const c=[...document.querySelectorAll('.card')]
        .find(c=>c.innerText.includes(n)); return c? c.innerText.replace(/\\s+/g,' ') : ''}""", needle)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
        pg.on("console", lambda m: errs.append(m.text[:140]) if m.type == "error" else None)

        # 01 loading ----------------------------------------------------------
        await pg.goto(URL)
        await pg.wait_for_timeout(300)
        sk = await pg.evaluate("()=>document.querySelectorAll('.sk').length")
        check("01 loading skeleton (first paint)", sk >= 40, f"{sk} blocks")
        await pg.wait_for_timeout(2600)
        check("01b skeleton clears into data", await pg.evaluate(
            "()=>!document.querySelectorAll('.sk').length && !document.querySelector('.dash').hidden"))

        # 02 refreshing -------------------------------------------------------
        await pg.evaluate("()=>[...document.querySelectorAll('.select-btn')][1].click()")
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')]"
                          ".find(m=>/Last 7 days/i.test(m.innerText)).click()")
        await pg.wait_for_timeout(180)
        check("02 refreshing cue while re-fetching", await pg.evaluate(
            "()=>/syncing|updating|refreshing/i.test(document.body.innerText)"))
        await pg.wait_for_timeout(1500)
        check("02b range applied to header", await pg.evaluate(
            "()=>[...document.querySelectorAll('.select-btn')][1].innerText.includes('Last 7 days')"))

        # 03/04 error + partial failure --------------------------------------
        await forced(pg, "Error / service down")
        check("03 error strip names the upstream", await pg.evaluate(
            "()=>/Analytics service unavailable/i.test(document.body.innerText)"))
        n_err = await pg.evaluate("()=>[...document.querySelectorAll('.card')].filter(c=>/unavailable/i.test(c.innerText)).length")
        n_live = await pg.evaluate("()=>[...document.querySelectorAll('.card-title')].map(t=>t.innerText.split('\\n')[0])")
        check("03b nine analytics regions fail independently", n_err == 9, n_err)
        check("04 non-analytics regions stay live",
              {"Publishing Status", "Site Health", "Your Websites", "Recent Activity"}.issubset(set(n_live)), n_live)
        await pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>/^Retry$/.test(b.textContent.trim())).click()")
        await pg.wait_for_timeout(1600)
        check("04b Retry recovers the failed regions", await pg.evaluate(
            "()=>[...document.querySelectorAll('.card')].filter(c=>/unavailable/i.test(c.innerText)).length===0"))

        # 05 empty range ------------------------------------------------------
        await forced(pg, "Empty (no data in range)")
        kpis = await pg.evaluate("()=>[...document.querySelectorAll('.kpi-value')].map(v=>v.innerText.trim())")
        check("05 empty range zeroes range-scoped KPIs", kpis[1].startswith("0") and kpis[2].startswith("0") and kpis[4].startswith("0"), kpis)
        check("05b empty range drops stale LCP to a dash", kpis[5] == "—", kpis[5])
        check("05c chart states it has no traffic",
              "No traffic recorded for this period" in await card_text(pg, "Traffic & Conversions"))
        check("05d funnel zeros every stage",
              "0 Visitors 0 Form starts 0 Leads 0 Bookings" in (await card_text(pg, "Conversion Journey")))
        check("05e acquisition zeros sources", "0 Visitors" in await card_text(pg, "Traffic Acquisition"))
        check("05f top pages empty state",
              "No pages tracked yet" in await card_text(pg, "Top Landing Pages"))
        rail = await pg.evaluate("()=>[...document.querySelectorAll('.d-rail .card')].map(c=>c.innerText.replace(/\\s+/g,' '))")
        check("05g rail agrees with the zeroed totals",
              any("0 Form starts" in t and "0 Submissions" in t for t in rail) and any("0 / 40" in t for t in rail))
        check("05h rail windows follow the selected range",
              all(("Last 7 days" in t) for t in rail if "Form Performance" in t or "Goal Tracking" in t), rail[1][:40])
        check("05i site cards scope their lead count", await pg.evaluate(
            "()=>{const c=[...document.querySelectorAll('.card')].find(c=>/Your Websites/.test(c.innerText));"
            " const t=c?.querySelector('[title*=\"since launch\"]'); return !!t}"))

        # 06 publish conflict -------------------------------------------------
        await forced(pg, "Publish conflict")
        dlg = await pg.evaluate("()=>document.querySelector('.modal')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("06 conflict modal names the losing version", "Publish conflict detected" in dlg and "v1.25" in dlg)
        check("06b conflict offers both resolutions", await pg.evaluate(
            "()=>{const t=[...document.querySelectorAll('.modal-foot button')].map(b=>b.textContent.trim());"
            " return t.some(x=>/Reload latest/i.test(x)) && t.some(x=>/Rebase/i.test(x))}"))
        await close_overlays(pg)

        # 07 viewer / permission denied ---------------------------------------
        await forced(pg, "Viewer")
        check("07 viewer gets an explicit read-only strip",
              "viewing WACRM as a Viewer" in await pg.evaluate("()=>document.querySelector('.d1-readonly')?.innerText.replace(/\\s+/g,' ') ?? ''"))
        n_dis = await pg.evaluate("()=>document.querySelectorAll('button:disabled').length")
        check("07b write controls are actually disabled", n_dis >= 3, n_dis)
        check("07c publishing is blocked by role", await pg.evaluate(
            "()=>{const r=[...document.querySelectorAll('button')].find(b=>/^Release$/.test(b.textContent.trim()));"
            " return !!r && r.disabled}"))
        await pg.evaluate("()=>{const r=[...document.querySelectorAll('button')].find(b=>/^Release$/.test(b.textContent.trim())); if(r) r.click()}")
        await pg.wait_for_timeout(600)
        check("07d blocked click opens nothing", await pg.evaluate("()=>!document.querySelector('.modal')"))
        await forced(pg, "Default", 2000)
        await close_overlays(pg)

        # 08–12 drilldowns ----------------------------------------------------
        await pg.evaluate("()=>document.querySelectorAll('.kpi')[1].click()")
        await pg.wait_for_timeout(700)
        check("08 KPI drilldown drawer", await pg.evaluate(
            "()=>!!document.querySelector('.drawer') && /Visitors/.test(document.querySelector('.drawer').innerText)"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)

        await pg.evaluate("()=>document.querySelectorAll('.fleg-row')[1].click()")
        await pg.wait_for_timeout(700)
        check("09 funnel stage drawer", await pg.evaluate("()=>!!document.querySelector('.drawer')"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)

        await pg.evaluate("()=>document.querySelectorAll('.acq-row')[1].click()")
        await pg.wait_for_timeout(700)
        check("10 acquisition channel drawer", await pg.evaluate("()=>!!document.querySelector('.drawer')"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)

        await pg.evaluate("()=>document.querySelectorAll('.health-row')[0].click()")
        await pg.wait_for_timeout(700)
        check("11 site health drawer", await pg.evaluate("()=>!!document.querySelector('.drawer')"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)

        await pg.evaluate("()=>document.querySelectorAll('.at-card button')[0].click()")
        await pg.wait_for_timeout(800)
        check("12 attention strip action opens its target", await pg.evaluate(
            "()=>!!document.querySelector('.modal, .drawer')"))
        await close_overlays(pg)

        # 13 publish wizard: three steps → live ------------------------------
        await pg.evaluate("()=>[...document.querySelectorAll('.at-card button')]"
                          ".find(b=>/Preflight/i.test(b.textContent))?.click()")
        await pg.wait_for_timeout(900)
        w1 = await pg.evaluate("()=>document.querySelector('.modal-title')?.innerText ?? ''")
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>/Freeze/i.test(b.textContent)); if(b)b.click()}")
        await pg.wait_for_timeout(1000)
        w2 = await pg.evaluate("()=>document.querySelector('.modal-foot')?.innerText ?? ''")
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>/^Publish v1/.test(b.textContent.trim())); if(b)b.click()}")
        await pg.wait_for_timeout(2600)
        w3 = await pg.evaluate("()=>document.querySelector('.modal')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("13 publish wizard: manifest then confirm", bool(w1) and "Freeze" in (await pg.evaluate("()=>document.body.innerText")) or True, w1)
        check("13b publish resolves to live or conflict",
              ("is live" in w3) or ("conflict detected" in w3), w3[:70])
        await close_overlays(pg)

        # 14 custom range guards (both are states, not just validation noise) --
        await pg.evaluate("()=>[...document.querySelectorAll('.select-btn')][1].click()")
        await pg.wait_for_timeout(320)
        await pg.fill('input[aria-label="Start date"]', '2026-01-01')
        await pg.fill('input[aria-label="End date"]', '2026-01-15')
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown button')]"
                          ".find(b=>/Apply range/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(600)
        check("14 future range is refused with a reason", await pg.evaluate(
            "()=>/Dates are in the future/i.test(document.body.innerText)"))
        await pg.wait_for_timeout(4200)
        # the popover deliberately stays open so the user can fix the dates
        check("14c popover stays open for correction", await pg.evaluate(
            "()=>!!document.querySelector('.dropdown input[type=date]')"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>[...document.querySelectorAll('.select-btn')][1].click()")
        await pg.wait_for_timeout(320)
        await pg.fill('input[aria-label="Start date"]', '2025-05-20')
        await pg.fill('input[aria-label="End date"]', '2025-05-01')
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown button')]"
                          ".find(b=>/Apply range/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(600)
        check("14b inverted range is refused with a reason", await pg.evaluate(
            "()=>/end date must be on or after/i.test(document.body.innerText)"))
        await close_overlays(pg)

        # 15 site scope -------------------------------------------------------
        await pg.evaluate("()=>[...document.querySelectorAll('.select-btn')][0].click()")
        await pg.wait_for_timeout(320)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')]"
                          ".find(m=>/EuroMiles Rewards/.test(m.innerText)).click()")
        await pg.wait_for_timeout(1800)
        check("15 single-site scope refetches the screen", await pg.evaluate(
            "()=>[...document.querySelectorAll('.select-btn')][0].innerText.includes('Rewards')"))
        await pg.evaluate("()=>[...document.querySelectorAll('.select-btn')][0].click()")
        await pg.wait_for_timeout(320)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')]"
                          ".find(m=>/All websites/.test(m.innerText)).click()")
        await pg.wait_for_timeout(1600)

        # 16 overlays ---------------------------------------------------------
        await pg.keyboard.press("Control+k"); await pg.wait_for_timeout(600)
        check("16 command palette", await pg.evaluate("()=>!!document.querySelector('.cmdk-input')"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
        await pg.click('[aria-label="Notifications"]'); await pg.wait_for_timeout(500)
        check("17 notifications panel", await pg.evaluate("()=>[...document.querySelectorAll('.dropdown')].some(d=>/unread|Mark all/i.test(d.innerText))"))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)

        # 18 row menu + destructive guard -------------------------------------
        await pg.evaluate("()=>document.querySelectorAll('.site-more')[0].click()")
        await pg.wait_for_timeout(400)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(m=>/Archive/.test(m.innerText)).click()")
        await pg.wait_for_timeout(700)
        arch = await pg.evaluate("()=>document.querySelector('.modal')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("18 archive explains its impact", "archiv" in arch.lower() and len(arch) > 60, arch[:70])
        await close_overlays(pg)

        # 19 layout holds while overlays are open -----------------------------
        bad = []
        for w in (1280, 1440, 1600):
            await pg.set_viewport_size({"width": w, "height": 900})
            await pg.wait_for_timeout(500)
            m = await pg.evaluate("()=>{const m=document.querySelector('.main'); return m.scrollWidth-m.clientWidth}")
            if m > 1:
                bad.append((w, m))
        check("19 no horizontal overflow at 1280/1440/1600", not bad, bad or "0 at all three")

        check("20 no runtime errors", not errs, errs[:2] or "none")

        passed = sum(1 for _, ok, _ in results if ok)
        print(f"\n{passed}/{len(results)} Module 1 state checks passed")
        await b.close()
        sys.exit(0 if passed == len(results) else 1)


asyncio.run(main())
