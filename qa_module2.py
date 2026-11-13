"""Module 2 — Sites & Domains acceptance checks (v2 layout).

Runs against the shipped single file, no server:

    python3 qa_module2.py
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/sites"
results = []


def ck(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": str(detail)[:150]})


async def forced(pg, label):
    await pg.click('[aria-label="Prototype states"]')
    await pg.wait_for_timeout(240)
    await pg.evaluate(
        "l=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.includes(l)).click()", label)
    await pg.wait_for_timeout(950)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.on("console", lambda m: errs.append("console: " + m.text[:120]) if m.type == "error" else None)

        await pg.goto(URL)
        await pg.evaluate("()=>localStorage.clear()")
        await pg.reload()
        await pg.wait_for_timeout(150)
        ck("skeleton while loading", await pg.evaluate("()=>document.querySelectorAll('.sk').length") >= 6,
           await pg.evaluate("()=>document.querySelectorAll('.sk').length"))
        await pg.wait_for_timeout(2200)

        # ---------- shell ----------
        ck("route renders the screen", await pg.evaluate("()=>document.querySelector('.page-title')?.textContent") == "Sites & Domains")
        ck("5 summary cards", await pg.evaluate("()=>document.querySelectorAll('.d2-kpi').length") == 5)
        ck("attention banner present", await pg.evaluate("()=>/need attention/.test(document.body.innerText)"))
        ck("registry lists sites", await pg.evaluate("()=>document.querySelectorAll('.d2-row').length") == 3)
        ck("inspector open on load", await pg.evaluate("()=>!!document.querySelector('.d2-insp')"))
        ck("connected domains listed", await pg.evaluate("()=>document.querySelectorAll('.d2-conn-card').length") == 5)

        # ---------- filters ----------
        for label, n in (("Live", 2), ("Draft", 1), ("Needs Attention", 1), ("All", 3)):
            await pg.evaluate(f"()=>[...document.querySelectorAll('.d2-pill')].find(b=>b.textContent.includes('{label}')).click()")
            await pg.wait_for_timeout(320)
            ck(f"tab {label} → {n} rows", await pg.evaluate("()=>document.querySelectorAll('.d2-row').length") == n)
        await pg.fill(".d2-search input", "rewards")
        await pg.wait_for_timeout(380)
        ck("search filters", await pg.evaluate("()=>document.querySelectorAll('.d2-row').length") == 1)
        await pg.fill(".d2-search input", "zzzz")
        await pg.wait_for_timeout(380)
        ck("no-results state", await pg.evaluate("()=>!!document.querySelector('.d2-norec')"))
        await pg.evaluate("()=>[...document.querySelectorAll('.d2-norec button')].find(b=>/Clear/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(350)
        await pg.locator(".toolbar .select-btn").nth(1).click()
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.trim().startsWith('Verified')).click()")
        await pg.wait_for_timeout(420)
        ck("domain-status filter (verified primaries)", await pg.evaluate("()=>document.querySelectorAll('.d2-row').length") == 2)
        await pg.locator(".toolbar .select-btn").nth(1).click()
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.includes('All domains')).click()")
        await pg.wait_for_timeout(350)

        # ---------- sorting + views ----------
        await pg.evaluate("()=>[...document.querySelectorAll('.d2-th-btn')].find(b=>b.textContent.includes('Pages')).click()")
        await pg.wait_for_timeout(320)
        first = await pg.evaluate("()=>document.querySelector('.d2-row .d2-site-name').textContent")
        ck("sort by pages", first == "Partner Portal", first)
        await pg.click(".d2-view")
        await pg.wait_for_timeout(350)
        ck("grid view", await pg.evaluate("()=>document.querySelectorAll('.d2-card').length") == 3)
        await pg.click(".d2-view")
        await pg.wait_for_timeout(300)

        # ---------- inspector ----------
        await pg.evaluate("()=>[...document.querySelectorAll('.d2-row')][1].click()")
        await pg.wait_for_timeout(400)
        ck("row click switches inspector", await pg.evaluate("()=>document.querySelector('.d2-insp-name')?.textContent") == "EuroMiles Rewards")
        for tab in ("DNS Records", "SSL Certificate", "Overview"):
            await pg.evaluate(f"()=>[...document.querySelectorAll('.d2-tab')].find(b=>b.textContent.includes('{tab}')).click()")
            await pg.wait_for_timeout(300)
            ck(f"inspector tab {tab}", await pg.evaluate("()=>!!document.querySelector('.d2-tabbody')"))
        ck("stepper has 4 steps", await pg.evaluate("()=>document.querySelectorAll('.d2-step').length") == 4)

        # ---------- row menu ----------
        await pg.click(".d2-row .d2-more")
        await pg.wait_for_timeout(320)
        menu = await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].map(e=>e.textContent.trim())")
        for label in ("Open site", "Manage website", "Verify DNS", "SSL details", "Make primary", "Archive", "Delete"):
            ck(f"row menu has {label}", label in menu)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(280)

        # ---------- verify DNS flow ----------
        before = await pg.evaluate("()=>[...document.querySelectorAll('.d2-row')].map(r=>r.innerText.includes('Pending')).join()")
        await pg.evaluate("()=>[...document.querySelectorAll('.d2-pillbtn')][0].click()")   # first DNS pill
        await pg.wait_for_timeout(2600)
        ck("verify DNS resolves to a verdict",
           await pg.evaluate("()=>/Verified|Failed/.test(document.body.innerText)"), before)

        # ---------- connect domain wizard ----------
        await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')].find(b=>/Connect Domain/.test(b.textContent)).click()")
        await pg.wait_for_timeout(600)
        ck("connect-domain dialog opens", await pg.evaluate("()=>document.querySelector('.modal-title')?.textContent") == "Connect Domain")
        await pg.fill(".modal input.input", "bad host!!")
        await pg.evaluate("()=>[...document.querySelectorAll('.modal-foot button')].find(b=>/Connect domain/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(700)
        ck("hostname validation", await pg.evaluate("()=>/hostname/i.test(document.querySelector('.modal').innerText)"))
        await pg.fill(".modal input.input", "studio.euromiles.in")
        await pg.evaluate("()=>[...document.querySelectorAll('.modal-foot button')].find(b=>/Connect domain/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(1500)
        ck("records step shows expected values", await pg.evaluate("()=>document.querySelectorAll('.cd-records tbody tr').length") >= 2)
        await pg.evaluate("()=>[...document.querySelectorAll('.modal-foot button')].find(b=>/Verify DNS Now/i.test(b.textContent)).click()")
        await pg.wait_for_timeout(2800)
        ck("verification verdict is shown", await pg.evaluate("()=>!!document.querySelector('.cd-success')||!!document.querySelector('.modal .st-domain-error')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(500)

        # ---------- domain settings ----------
        await pg.click(".d2-row .d2-more")
        await pg.wait_for_timeout(300)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.trim()==='SSL details').click()")
        await pg.wait_for_timeout(600)
        ck("domain settings opens", await pg.evaluate("()=>document.querySelector('.modal-title')?.textContent") == "Domain settings")
        ck("hostname switches present", await pg.evaluate("()=>document.querySelectorAll('.st-switch').length") >= 3)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)

        # ---------- site lifecycle dialogs ----------
        for label, expect in (("Rename", "Rename website"), ("Archive", "Archive website"), ("Delete", "Delete website")):
            await pg.click(".d2-row .d2-more")
            await pg.wait_for_timeout(300)
            await pg.evaluate(f"()=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.trim()==='{label}').click()")
            await pg.wait_for_timeout(480)
            ck(f"{label} dialog", await pg.evaluate("()=>document.querySelector('.modal-title')?.textContent") == expect)
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(300)

        # ---------- forced states ----------
        await forced(pg, "Error")
        ck("error banner + retry", await pg.evaluate("()=>/service unavailable/i.test(document.body.innerText)"))
        await forced(pg, "Empty")
        ck("empty state", await pg.evaluate("()=>/No websites yet/i.test(document.body.innerText)"))
        ck("empty domains state", await pg.evaluate("()=>/No custom domains/i.test(document.body.innerText)"))
        ck("empty zeroes the counters", await pg.evaluate("()=>document.querySelector('.d2-kpi-value')?.textContent") == "0")
        await forced(pg, "Viewer")
        ck("viewer banner", await pg.evaluate("()=>/viewing as/i.test(document.body.innerText)"))
        ck("viewer disables writes", await pg.evaluate("()=>document.querySelectorAll('button:disabled').length") >= 6)
        await forced(pg, "Default")

        # ---------- layout ----------
        for w in (1280, 1440, 1600):
            p2 = await b.new_page(viewport={"width": w, "height": 900})
            await p2.goto(URL)
            await p2.wait_for_timeout(1700)
            over = await p2.evaluate("""()=>[...document.querySelectorAll('.app *')]
                .filter(el=>el.getBoundingClientRect().right>window.innerWidth+1.5).length""")
            scroll = await p2.evaluate("()=>document.documentElement.scrollWidth>window.innerWidth")
            ck(f"no horizontal overflow at {w}", over == 0 and not scroll, f"{over}/{scroll}")
            await p2.close()

        ck("no runtime errors", not errs, "; ".join(errs[:3]))
        await b.close()

    passed = sum(1 for r in results if r["ok"])
    for r in results:
        print(("OK   " if r["ok"] else "FAIL ") + r["check"] + (("  → " + r["detail"]) if r["detail"] else ""))
    print(f"\n{passed}/{len(results)} checks passed")
    sys.exit(0 if passed == len(results) else 1)


asyncio.run(main())
