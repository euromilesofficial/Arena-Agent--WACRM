"""Module 3 — state coverage for Pages & Routes.

Every non-happy path the screen can be in, reached the way a user reaches it:

    python3 qa_states_m3.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = "file:///home/user/wacrm-app/WACRM-CMS.html"
URL = BASE + "#/pages"
results = []


def ck(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": str(detail)[:150]})


async def forced(pg, label):
    await pg.click('[aria-label="Prototype states"]')
    await pg.wait_for_timeout(240)
    await pg.evaluate(
        "l=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.includes(l)).click()", label)
    await pg.wait_for_timeout(1000)


async def close_modal(pg):
    if await pg.evaluate("()=>!!document.querySelector('.modal')"):
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>/Cancel/i.test(b.innerText)); if(b) b.click()}")
        await pg.wait_for_timeout(500)
    if await pg.evaluate("()=>!!document.querySelector('.modal')"):
        await pg.evaluate("()=>document.querySelector('.modal .modal-x, .modal [aria-label=Close]')?.click()")
        await pg.wait_for_timeout(400)


async def boot(pg, url=URL):
    await pg.goto(url)
    await pg.evaluate("()=>localStorage.clear()")
    await pg.reload()


async def main():
  try:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.on("console", lambda m: errs.append("console: " + m.text[:120]) if m.type == "error" else None)

        # ---------- 1 · loading ----------
        await boot(pg)
        await pg.wait_for_timeout(130)
        ck("loading · registry skeleton rows", await pg.evaluate("()=>document.querySelectorAll('.d3-tbl .sk').length") >= 6,
           await pg.evaluate("()=>document.querySelectorAll('.d3-tbl .sk').length"))
        ck("loading · tree skeleton", await pg.evaluate("()=>document.querySelectorAll('.d3-tree-body .sk').length") >= 3,
           await pg.evaluate("()=>document.querySelectorAll('.d3-tree-body .sk').length"))
        ck("loading · inspector skeleton", await pg.evaluate("()=>!!document.querySelector('.d3-insp .sk')"))
        ck("loading · tab counts show a placeholder", await pg.evaluate("()=>/·/.test(document.querySelector('.d3-tabs')?.innerText ?? '')"))
        await pg.wait_for_timeout(2400)
        ck("loading · skeletons clear when data lands", await pg.evaluate("()=>document.querySelectorAll('.d3-grid .sk').length") == 0,
           await pg.evaluate("()=>document.querySelectorAll('.d3-grid .sk').length"))
        ck("loading · sorts settle into real rows", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") == 8)

        # ---------- 2 · empty workspace ----------
        await forced(pg, "Empty")
        ck("empty · registry empty state", await pg.evaluate("()=>/No pages yet/.test(document.querySelector('.d3-empty')?.innerText ?? '')"),
           await pg.evaluate("()=>document.querySelector('.d3-empty')?.innerText.replace(/\\s+/g,' ').slice(0,60)"))
        ck("empty · tree empty state", await pg.evaluate("()=>/No pages yet/.test(document.querySelector('.d3-tree-empty')?.innerText ?? '')"))
        ck("empty · KPI totals are 0", await pg.evaluate("()=>document.querySelector('.d3-kpi-val')?.innerText") == "0")
        ck("empty · gauge falls back to an em dash", await pg.evaluate("()=>document.querySelector('.d3-gauge-val')?.innerText") == "—",
           await pg.evaluate("()=>document.querySelector('.d3-gauge-val')?.innerText"))
        ck("empty · inspector explains why it is blank", await pg.evaluate("()=>document.querySelector('.d3-insp')?.innerText.length") > 0)
        ck("empty · create CTA offered", await pg.evaluate("()=>/Create First Page/.test(document.body.innerText)"))
        await forced(pg, "Default")
        await pg.wait_for_timeout(1200)
        ck("empty · recovers to 48 pages", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") == 8)

        # ---------- 3 · service down ----------
        await forced(pg, "Error")
        ck("error · banner names the service", await pg.evaluate("()=>/Pages service unavailable \\(503\\)/.test(document.querySelector('.d2-alert')?.innerText ?? '')"),
           await pg.evaluate("()=>document.querySelector('.d2-alert')?.innerText.replace(/\\s+/g,' ')"))
        ck("error · banner keeps the last good state on screen", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") > 0)
        ck("error · Retry offered", await pg.evaluate("()=>/Retry/.test(document.querySelector('.d2-alert')?.innerText ?? '')"))
        await forced(pg, "Default")
        await pg.wait_for_timeout(1200)
        ck("error · banner clears after recovery", await pg.evaluate("()=>!document.querySelector('.d2-alert')"))

        # ---------- 4 · publish conflict (stale save) ----------
        await forced(pg, "Publish conflict")
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(500)
        await pg.evaluate("()=>document.querySelector('.d3-row.is-sel .d3-act .icon-btn:last-child').click()")
        await pg.wait_for_timeout(400)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(m=>m.textContent.includes('Edit Page Details')).click()")
        await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>/Save/i.test(b.innerText)); b.click()}")
        await pg.wait_for_timeout(1600)
        ck("conflict · stale save surfaces a conflict banner", await pg.evaluate("()=>/saved this page while you were editing/.test(document.querySelector('.modal')?.innerText ?? '')"),
           await pg.evaluate("()=>document.querySelector('.modal .d3-alert')?.innerText.replace(/\\s+/g,' ').slice(0,80)"))
        ck("conflict · Reload theirs offered", await pg.evaluate("()=>/Reload theirs/.test(document.querySelector('.modal')?.innerText ?? '')"))
        ck("conflict · Keep mine offered", await pg.evaluate("()=>/Keep mine/.test(document.querySelector('.modal')?.innerText ?? '')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)
        await forced(pg, "Default")
        await pg.wait_for_timeout(1000)

        # ---------- 5 · viewer role ----------
        await forced(pg, "Permission denied")
        ck("viewer · read-only banner", await pg.evaluate("()=>/Reader can view/.test(document.querySelector('.d1-readonly')?.innerText ?? 'Viewer') || !!document.querySelector('.d1-readonly')"))
        ck("viewer · New Page disabled", await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')].find(b=>/New Page/.test(b.innerText))?.disabled") is True)
        ck("viewer · inspector primary action disabled", await pg.evaluate("()=>[...document.querySelectorAll('.d3-insp-foot button')].every(b=>b.disabled)"))
        ck("viewer · tree still navigable", await pg.evaluate("()=>document.querySelectorAll('.d3-node').length") > 10)
        await forced(pg, "Default")
        await pg.wait_for_timeout(1200)

        # ---------- 6 · empty trash (site with nothing deleted) ----------
        await pg.click('.d3-site')
        await pg.wait_for_timeout(500)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(m=>/Rewards/.test(m.textContent)).click()")
        await pg.wait_for_timeout(1600)
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[3].click()")
        await pg.wait_for_timeout(1300)
        ck("trash · empty trash state", await pg.evaluate("()=>/The trash is empty/.test(document.querySelector('.d3-empty')?.innerText ?? '')"),
           await pg.evaluate("()=>document.querySelector('.d3-empty')?.innerText.replace(/\\s+/g,' ').slice(0,60)"))
        ck("trash · empty state explains the 30-day window", await pg.evaluate("()=>/30 days/.test(document.querySelector('.d3-empty')?.innerText ?? '')"))
        await pg.click('.d3-site')
        await pg.wait_for_timeout(500)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(m=>/EuroMiles Main/.test(m.textContent)).click()")
        await pg.wait_for_timeout(1600)

        # ---------- 7 · selected page vanished (stale inspector) ----------
        await pg.goto(BASE + "#/pages?sel=pg_does_not_exist")
        await pg.wait_for_timeout(2600)
        stale = await pg.evaluate("()=>document.querySelector('.d3-insp')?.innerText.replace(/\\s+/g,' ') ?? ''")
        ck("stale · inspector reports the page is gone", "no longer available" in stale.lower(), stale[:90])
        ck("stale · refresh action offered", await pg.evaluate("()=>[...document.querySelectorAll('.d3-insp button')].some(b=>/Refresh/i.test(b.innerText))"),
           await pg.evaluate("()=>[...document.querySelectorAll('.d3-insp button')].map(b=>b.innerText)"))
        await pg.goto(URL)
        await pg.wait_for_timeout(2400)

        # ---------- 8 · bulk trash with a blocked page ----------
        await pg.fill('.d3-search input', 'Study')
        await pg.wait_for_timeout(1300)
        await pg.evaluate("""()=>{const rows=[...document.querySelectorAll('.d3-row')];
            rows.find(r=>/Study Abroad/.test(r.innerText)).querySelector('input[type=checkbox]').click();
            rows.find(r=>/Study in Italy/.test(r.innerText)).querySelector('input[type=checkbox]').click()}""")
        await pg.wait_for_timeout(600)
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-bulk .btn')].find(b=>/Move to Trash/.test(b.innerText)).click()")
        await pg.wait_for_timeout(800)
        ck("bulk · confirm lists every selected page", await pg.evaluate("()=>document.querySelectorAll('.modal .d3-trashrow').length") == 2,
           await pg.evaluate("()=>document.querySelectorAll('.modal .d3-trashrow').length"))
        ck("bulk · warns about per-page failures", await pg.evaluate("()=>/partial failures/.test(document.querySelector('.modal-sub')?.innerText ?? '')"),
           await pg.evaluate("()=>document.querySelectorAll('.modal .d3-trashrow').length"))
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>/Move to Trash/i.test(b.innerText)); b.click()}")
        await pg.wait_for_timeout(3400)
        failText = await pg.evaluate("()=>document.querySelector('.modal')?.innerText.replace(/\\s+/g,' ') ?? ''")
        ck("bulk · blocked pages are reported one by one", "child pages must be moved first" in failText, failText[:90])
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(500)

        # ---------- 9 · modal busy + Esc ----------
        before_esc = await pg.evaluate("()=>document.querySelector('.d3-kpi-val')?.innerText")
        await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')].find(b=>/New Page/.test(b.innerText)).click()")
        await pg.wait_for_timeout(700)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(500)
        ck("modal · Esc closes without side effects", not await pg.evaluate("()=>!!document.querySelector('.modal')"))
        ck("modal · registry untouched after Esc", before_esc == await pg.evaluate("()=>document.querySelector('.d3-kpi-val')?.innerText"),
           await pg.evaluate("()=>document.querySelector('.d3-kpi-val')?.innerText"))

        # ---------- 10 · undo from the toast ----------
        await close_modal(pg)
        await pg.fill('.d3-search input', 'Poland')
        await pg.wait_for_timeout(1200)
        await pg.evaluate("()=>{const r=[...document.querySelectorAll('.d3-row')].find(r=>r.innerText.includes('Poland')); if(r) r.click()}")
        await pg.wait_for_timeout(900)
        await pg.evaluate("""()=>{const r=[...document.querySelectorAll('.d3-row')].find(r=>r.innerText.includes('Poland')) ?? document.querySelector('.d3-row.is-sel');
            r.querySelector('.d3-act .icon-btn:last-child').click()}""")
        await pg.wait_for_timeout(500)
        await pg.evaluate("()=>[...document.querySelectorAll('.dropdown .menu-item')].find(m=>/Move to Trash/.test(m.textContent)).click()")
        await pg.wait_for_timeout(700)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>/Move to Trash/i.test(b.innerText)); b.click()}")
        await pg.wait_for_timeout(2200)
        ck("undo · toast carries an Undo action", await pg.evaluate("()=>[...document.querySelectorAll('.toast')].some(t=>/Undo/.test(t.innerText))"))
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('.toast')].find(t=>/Undo/.test(t.innerText)); t.querySelector('.link').click()}")
        await pg.wait_for_timeout(2400)
        ck("undo · restores the page", await pg.evaluate("()=>[...document.querySelectorAll('.toast')].some(t=>/Restored/.test(t.innerText))"),
           await pg.evaluate("()=>[...document.querySelectorAll('.toast')].map(t=>t.innerText.replace(/\\s+/g,' ')).join(' | ')"))
        await pg.fill('.d3-search input', '')
        await pg.wait_for_timeout(1200)

        # ---------- 11 · pagination edges ----------
        await pg.select_option('.d3-size', '25')
        await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-pg')].filter(b=>/^\\d+$/.test(b.innerText.trim())).pop().click()")
        await pg.wait_for_timeout(1000)
        ck("paging · last page shows the remainder", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") <= 25,
           await pg.evaluate("()=>document.querySelector('.d3-reg-foot')?.innerText.replace(/\\s+/g,' ').slice(0,28)"))
        ck("paging · next is disabled on the last page", await pg.evaluate("()=>[...document.querySelectorAll('.d3-pager button')].pop()?.disabled") is True)
        await pg.select_option('.d3-size', '8')
        await pg.wait_for_timeout(900)
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-pg')].find(b=>b.innerText.trim()==='1').click()")
        await pg.wait_for_timeout(900)

        # ---------- 12 · tree states ----------
        await pg.fill('.d3-tree-search input', 'zzzz')
        await pg.wait_for_timeout(600)
        ck("tree · no-match state", await pg.evaluate("()=>/No page/.test(document.querySelector('.d3-tree-empty')?.innerText ?? '') && /match/i.test(document.querySelector('.d3-tree-empty')?.innerText ?? '')"),
           await pg.evaluate("()=>document.querySelector('.d3-tree-empty')?.innerText.replace(/\\s+/g,' ').slice(0,60)"))
        await pg.fill('.d3-tree-search input', '')
        await pg.wait_for_timeout(500)

        # ---------- 13 · inspector during a fast switch ----------
        await pg.evaluate("""()=>{const n=[...document.querySelectorAll('.d3-node')];
            n[6].click(); n[9].click(); n[12].click();}""")
        await pg.wait_for_timeout(1600)
        ck("inspector · newest selection wins a fast switch", await pg.evaluate("""()=>{
            const name=document.querySelector('.d3-insp-name')?.innerText;
            const node=document.querySelector('.d3-node.is-sel .d3-node-title')?.innerText;
            return !!name && name===node}"""),
           await pg.evaluate("()=>[document.querySelector('.d3-insp-name')?.innerText, document.querySelector('.d3-node.is-sel .d3-node-title')?.innerText]"))

        ck("no runtime errors", not errs, "; ".join(errs[:3]))
        await b.close()
  except Exception as e:  # noqa: BLE001
    results.append({"check": "state run completed", "ok": False, "detail": f"{type(e).__name__}: {str(e)[:120]}"})

  passed = sum(1 for r in results if r["ok"])
  for r in results:
    print(("OK   " if r["ok"] else "FAIL ") + r["check"] + (("  → " + r["detail"]) if r["detail"] else ""))
  print(f"\n{passed}/{len(results)} state checks passed")
  sys.exit(0 if passed == len(results) else 1)


asyncio.run(main())
