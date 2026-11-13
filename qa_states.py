"""Module 2 — state coverage audit.

Drives every state in MODULE-2-SPEC.md §6 against the built prototype
(WACRM-CMS.html, opened from file://). Deterministic: DNS failure is produced
by stubbing Math.random for one click, not by retrying until it happens.

    python3 qa_states.py
"""
import asyncio, sys

from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/sites"
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


async def state_menu(pg, label):
    await pg.click('[aria-label="Prototype states"]')
    await pg.wait_for_timeout(220)
    await pg.evaluate(
        "l=>[...document.querySelectorAll('.dropdown .menu-item')]"
        ".find(b=>b.textContent.includes(l)).click()", label)
    await pg.wait_for_timeout(900)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:140]))

        # 1 loading -----------------------------------------------------------
        await pg.goto(URL)
        await pg.evaluate("()=>localStorage.clear()")
        await pg.reload()
        await pg.wait_for_timeout(150)
        check("01 loading skeleton", await pg.evaluate("()=>document.querySelectorAll('.sk').length>=6"),
              await pg.evaluate("()=>document.querySelectorAll('.sk').length"))
        await pg.wait_for_timeout(2300)

        # 2 refreshing --------------------------------------------------------
        await pg.evaluate("()=>[...document.querySelectorAll('.d2-reg-foot button')]"
                          ".find(b=>/Refresh/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(150)
        check("02 refreshing indicator", await pg.evaluate("()=>/syncing/i.test(document.body.innerText)"))
        await pg.wait_for_timeout(1500)

        # 8 dns checking, then verdict ---------------------------------------
        await pg.evaluate("()=>document.querySelectorAll('.d2-pillbtn')[0].click()")
        await pg.wait_for_timeout(200)
        check("08 dns checking pill", await pg.evaluate("()=>!!document.querySelector('.pill.is-checking')"),
              await pg.evaluate("()=>document.querySelector('.pill.is-checking')?.innerText.trim()"))
        await pg.wait_for_timeout(2400)
        check("08b checking replaced by verdict",
              await pg.evaluate("()=>!document.querySelector('.pill.is-checking')"))

        # 9 dns failed (deterministic), 10 certificate held -------------------
        await pg.evaluate("()=>{window.__r=Math.random; Math.random=()=>0.01}")
        await pg.evaluate("()=>document.querySelectorAll('.d2-pillbtn')[0].click()")
        await pg.wait_for_timeout(2200)
        row = await pg.evaluate("()=>document.querySelector('.d2-row').innerText.replace(/\\s+/g,' ')")
        check("09 dns failed pill + cause", "Failed" in row and await pg.evaluate("()=>/NXDOMAIN/.test(document.body.innerText)"))
        steps = await pg.evaluate("()=>[...document.querySelectorAll('.d2-step')].map(s=>"
                                  "s.classList.contains('failed')?'failed':s.classList.contains('done')?'done':"
                                  "s.classList.contains('active')?'active':'pending')")
        check("10 certificate held (step 3 not done)", steps[:2] == ["failed", "failed"] and steps[2] == "pending", steps)
        await pg.evaluate("()=>{Math.random=()=>0.99}")
        await pg.evaluate("()=>document.querySelectorAll('.d2-pillbtn')[0].click()")
        await pg.wait_for_timeout(2400)
        check("09b failure clears on successful retry",
              await pg.evaluate("()=>!document.querySelector('.d2-row .pill.is-red')"))

        # 12 tls active / 11 offering provisioning ---------------------------
        check("12 tls active pill", await pg.evaluate("()=>[...document.querySelectorAll('.d2-row .pill')]"
                                                      ".some(p=>p.innerText.trim()==='Active')"))

        # 7 dns unverified seeded --------------------------------------------
        check("07 dns unverified seeded", await pg.evaluate("()=>[...document.querySelectorAll('.d2-row .pill')]"
                                                            ".some(p=>p.innerText.trim()==='Pending')"))

        # 14 no domains -------------------------------------------------------
        await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')]"
                          ".find(b=>/New Website/.test(b.textContent)).click()")
        await pg.wait_for_timeout(800)
        await pg.fill(".modal input.input", "Fresh Site")
        for _ in range(3):
            more = await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                                     ".find(b=>/Continue/i.test(b.textContent)); if(b){b.click();return true} return false}")
            if not more:
                break
            await pg.wait_for_timeout(520)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                          ".find(b=>/Create website/i.test(b.textContent)); if(b)b.click()}")
        await pg.wait_for_timeout(3000)
        await close_overlays(pg)
        await pg.wait_for_timeout(600)
        r = await pg.evaluate("""()=>{const r=[...document.querySelectorAll('.d2-row')]
            .find(r=>/Fresh Site/.test(r.innerText)); return r?r.innerText.replace(/\\s+/g,' '):''}""")
        check("14a no-domain row", "Not connected" in r and "No alias" in r, r[:60])
        await pg.evaluate("()=>{const r=[...document.querySelectorAll('.d2-row')]"
                          ".find(r=>/Fresh Site/.test(r.innerText)); if(r)r.click()}")
        await pg.wait_for_timeout(600)
        insp = await pg.evaluate("()=>document.querySelector('.d2-insp')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("14b no-domain inspector", "No hostname connected" in insp and "Not connected" in insp, insp[:70])
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('.d2-tab')]"
                          ".find(t=>/DNS/.test(t.textContent)); if(t)t.click()}")
        await pg.wait_for_timeout(350)
        check("14c DNS tab empty state", await pg.evaluate("()=>!!document.querySelector('.d2-tab-empty')"))

        # 15 delete dialog ----------------------------------------------------
        await pg.evaluate("()=>document.querySelectorAll('.d2-row')[0].querySelector('.d2-more').click()")
        await pg.wait_for_timeout(320)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')]"
                          ".find(b=>b.textContent.trim()==='Delete').click()")
        await pg.wait_for_timeout(600)
        dlg = await pg.evaluate("()=>document.querySelector('.modal')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("15a delete dialog typed confirmation", "to confirm" in dlg, dlg[:70])
        check("15b blocked state explains itself", "archived before deletion" in dlg)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                          ".find(b=>/Delete/i.test(b.textContent)); if(b)b.click()}")
        await pg.wait_for_timeout(700)
        check("15c native guard stays until typed",
              await pg.evaluate("()=>!!document.querySelector('.modal')"))
        await close_overlays(pg)

        # 5 no results --------------------------------------------------------
        await pg.fill(".d2-search input", "zzz")
        await pg.wait_for_timeout(420)
        check("05 no-results + clear", await pg.evaluate("()=>!!document.querySelector('.d2-norec')"))
        await pg.fill(".d2-search input", "")
        await pg.wait_for_timeout(420)

        # 3 error -------------------------------------------------------------
        await state_menu(pg, "Error")
        check("03 error strip + retry", await pg.evaluate(
            "()=>/unavailable/i.test(document.body.innerText) && !!document.querySelector('.d2-alert.is-error button')"))

        # 4 empty -------------------------------------------------------------
        await state_menu(pg, "Empty")
        check("04 empty workspace", await pg.evaluate(
            "()=>/No websites yet/i.test(document.body.innerText) && /No custom domains/i.test(document.body.innerText)"))

        # 6 viewer ------------------------------------------------------------
        await state_menu(pg, "Viewer")
        check("06 viewer read-only", await pg.evaluate(
            "()=>/viewing as/i.test(document.body.innerText) && document.querySelectorAll('button:disabled').length>=6"),
            await pg.evaluate("()=>document.querySelectorAll('button:disabled').length"))

        # 2b partial attention banner ----------------------------------------
        await state_menu(pg, "Default")
        await pg.wait_for_timeout(800)
        await close_overlays(pg)
        await pg.evaluate("()=>localStorage.clear()")
        await pg.reload()
        await pg.wait_for_timeout(2400)
        banner = await pg.evaluate("()=>document.querySelector('.d2-alert')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("02b partial-failure attention strip",
              bool(banner) and "need attention" in banner and " and " in banner and "more" in banner,
              banner[:90])

        # 13 tls failed on a freshly connected hostname ----------------------
        await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')]"
                          ".find(b=>/Connect Domain/.test(b.textContent)).click()")
        await pg.wait_for_timeout(800)
        await pg.fill(".modal input.input", "qa-state-check.com")
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                          ".find(b=>/Connect|Add|Continue/i.test(b.textContent)); if(b)b.click()}")
        await pg.wait_for_timeout(3200)
        await close_overlays(pg)
        await pg.wait_for_timeout(600)
        conn = await pg.evaluate("()=>[...document.querySelectorAll('.d2-conn-card')]"
                                 ".map(c=>c.innerText.replace(/\\s+/g,' ')).filter(t=>/qa-state-check/.test(t))[0] ?? ''")
        check("13 tls failed on new hostname", "Failed" in conn, conn[:70])

        # 16 success toast ----------------------------------------------------
        toast = await pg.evaluate("()=>document.querySelector('.toast')?.innerText.replace(/\\s+/g,' ') ?? ''")
        check("16 success toast", bool(toast), toast[:50])

        # responsive split: inspector vs drawer -------------------------------
        await pg.set_viewport_size({"width": 1440, "height": 900})
        await pg.wait_for_timeout(400)
        check("R1 ≥1200 keeps inspector, no drawer", await pg.evaluate(
            "()=>!!document.querySelector('.d2-insp') && !document.querySelector('.drawer')"))
        await pg.set_viewport_size({"width": 1100, "height": 900})
        await pg.wait_for_timeout(500)
        await close_overlays(pg)
        await pg.evaluate("()=>document.querySelectorAll('.d2-row')[0].click()")
        await pg.wait_for_timeout(500)
        st = await pg.evaluate("()=>[!!document.querySelector('.drawer'),"
                               " [...document.querySelectorAll('.d2-insp')].every(e=>!!e.closest('.drawer')),"
                               " document.querySelectorAll('.d2-row').length, window.innerWidth]")
        check("R2 <1200 opens drawer instead of inline inspector", st[0] and st[1], st)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)
        check("R3 escape closes drawer", await pg.evaluate("()=>!document.querySelector('.drawer')"))

        print("\nerrors:", errs or "none")
        passed = sum(1 for _, ok, _ in results if ok)
        print(f"{passed}/{len(results)} state checks passed")
        await b.close()
        sys.exit(0 if passed == len(results) and not errs else 1)


asyncio.run(main())
