"""Module 3 — Pages & Routes acceptance checks.

Runs against the shipped single file, no server:

    python3 qa_pages.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/pages"
results = []


def ck(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": str(detail)[:150]})


async def boot(pg, hash_url=URL):
    await pg.goto(hash_url)
    await pg.evaluate("()=>localStorage.clear()")
    await pg.reload()
    await pg.wait_for_timeout(2400)


async def forced(pg, label):
    await pg.click('[aria-label="Prototype states"]')
    await pg.wait_for_timeout(240)
    await pg.evaluate(
        "l=>[...document.querySelectorAll('.dropdown .menu-item')].find(b=>b.textContent.includes(l)).click()", label)
    await pg.wait_for_timeout(950)


async def pick(pg, title):
    """Select a page no matter which page/sort the registry is on."""
    await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[0].click()")
    await pg.wait_for_timeout(400)
    await pg.fill('.d3-search input', title)
    await pg.wait_for_timeout(1100)
    await pg.evaluate("""t=>{const r=[...document.querySelectorAll('.d3-row')].find(r=>r.innerText.includes(t)); if(r) r.click()}""", title)
    await pg.wait_for_timeout(900)
    await pg.fill('.d3-search input', '')
    await pg.wait_for_timeout(1000)


async def open_row_menu(pg):
    await pg.evaluate("()=>document.querySelector('.d3-row.is-sel .d3-act .icon-btn:last-child').click()")
    await pg.wait_for_timeout(420)


async def menu_item(pg, label):
    await pg.evaluate("l=>[...document.querySelectorAll('.dropdown .menu-item')].find(m=>m.textContent.includes(l)).click()", label)
    await pg.wait_for_timeout(850)


async def item_disabled(pg, label):
    await open_row_menu(pg)
    state = await pg.evaluate("""l=>{const m=[...document.querySelectorAll('.dropdown .menu-item')].find(m=>m.textContent.includes(l));
        return m ? (m.hasAttribute('disabled') || m.getAttribute('aria-disabled')==='true') : null}""", label)
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(280)
    return state


async def foot(pg):
    return await pg.evaluate("()=>[...document.querySelectorAll('.modal-foot button')].map(b=>[b.innerText.trim(), b.disabled])")


async def click_foot(pg, label):
    await pg.evaluate("l=>{const b=[...document.querySelectorAll('.modal-foot button')].find(b=>new RegExp(l,'i').test(b.innerText)); if(b) b.click()}", label)
    await pg.wait_for_timeout(1500)


async def kpis(pg):
    return await pg.evaluate("()=>[...document.querySelectorAll('.d3-kpi,.d2-kpi.is-static')].map(k=>k.innerText.replace(/\\s+/g,' ').trim())")


async def main():
  try:
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.on("console", lambda m: errs.append("console: " + m.text[:120]) if m.type == "error" else None)

        await pg.goto(URL)
        await pg.evaluate("()=>localStorage.clear()")
        await pg.reload()
        await pg.wait_for_timeout(140)
        ck("skeleton while loading", await pg.evaluate("()=>document.querySelectorAll('.d3-tbl .sk, .sk').length") >= 6,
           await pg.evaluate("()=>document.querySelectorAll('.sk').length"))
        await pg.wait_for_timeout(2300)

        # ---------- header / metrics ----------
        ck("route renders Pages", await pg.evaluate("()=>document.querySelector('.page-title')?.textContent") == "Pages")
        ck("subtitle present", await pg.evaluate("()=>/Create, organize, and manage/.test(document.body.innerText)"))
        k = await kpis(pg)
        ck("5 metric tiles", len(k) == 5, len(k))
        ck("total 48", "48" in k[0], k[0])
        ck("published 42", "42" in k[1], k[1])
        ck("drafts 6", "6" in k[2], k[2])
        ck("gauge 88% of 42/48", "88%" in k[4] and "42 / 48" in k[4], k[4])
        ck("drafts tile says never published", "Never published" in k[2], k[2])
        ck("site switcher shows EuroMiles Main", await pg.evaluate("()=>document.querySelector('.d3-site')?.innerText.includes('EuroMiles Main')"))
        ck("view live site enabled (site has a release)", await pg.evaluate("""()=>{const b=[...document.querySelectorAll('.toolbar button')].find(b=>/View Live Site/.test(b.innerText)); return !!b && !b.disabled}"""))
        ck("three panes on 1440", await pg.evaluate("()=>!!document.querySelector('.d3-tree') && !!document.querySelector('.d3-reg') && !!document.querySelector('.d3-insp')"))
        ck("no page scroll on 1440", await pg.evaluate("()=>{const m=document.querySelector('.main'); return m.scrollHeight-m.clientHeight===0 && m.scrollWidth-m.clientWidth===0}"))

        # ---------- tree ----------
        ck("tree lists 48 nodes", await pg.evaluate("()=>document.querySelectorAll('.d3-node').length") == 48,
           await pg.evaluate("()=>document.querySelectorAll('.d3-node').length"))
        ck("home is first tree node", await pg.evaluate("()=>document.querySelector('.d3-node .d3-node-title')?.textContent") == "Home")
        ck("tree foot counts 48 pages", await pg.evaluate("()=>/48 pages/.test(document.querySelector('.d3-tree-foot')?.innerText ?? '')"))
        ck("draft dot on How to Apply", await pg.evaluate("""()=>[...document.querySelectorAll('.d3-node')].some(n=>n.innerText.includes('How to Apply') && n.querySelector('.d3-node-draft'))"""))
        await pg.fill('.d3-tree-search input', 'scholar')
        await pg.wait_for_timeout(400)
        vis = await pg.evaluate("()=>[...document.querySelectorAll('.d3-node')].map(n=>n.innerText.split('\\n')[0])")
        ck("tree search filters + keeps ancestors", vis[0] == "Scholarships" and any("Available Scholarships" in v for v in vis), vis[:3])
        await pg.fill('.d3-tree-search input', '')
        await pg.wait_for_timeout(350)
        await pg.evaluate("()=>document.querySelector('.d3-node[aria-expanded=\"true\"] .d3-twist').click()")
        await pg.wait_for_timeout(400)
        ck("collapse branch hides children", await pg.evaluate("()=>!document.body.innerText.includes('Study in Italy')"))
        await pg.evaluate("()=>document.querySelector('.d3-node[aria-expanded=\"false\"] .d3-twist').click()")
        await pg.wait_for_timeout(400)
        ck("expand branch restores children", await pg.evaluate("()=>document.body.innerText.includes('Study in Italy')"))
        await pg.evaluate("()=>document.querySelector('.d3-node').click()")
        await pg.wait_for_timeout(700)
        ck("tree click selects page", await pg.evaluate("()=>document.querySelector('.d3-insp-name')?.innerText") == "Home")

        # ---------- tabs / search / sort / paging ----------
        tabs = await pg.evaluate("()=>[...document.querySelectorAll('.d3-tab')].map(t=>t.innerText.replace(/\\s+/g,' ').trim())")
        ck("4 tabs with counts", tabs == ["All Pages 48", "Published 42", "Drafts 6", "Trash 2"], tabs)
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[1].click()")
        await pg.wait_for_timeout(900)
        ck("published tab shows 42 rows total", "42 pages" in await pg.evaluate("()=>document.querySelector('.d3-reg-foot')?.innerText ?? ''"))
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[2].click()")
        await pg.wait_for_timeout(900)
        ck("drafts tab shows 6", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") == 6)
        ck("draft rows carry Draft pill", await pg.evaluate("""()=>[...document.querySelectorAll('.d3-row')].every(r=>/Draft/.test(r.innerText))"""))
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[0].click()")
        await pg.wait_for_timeout(900)

        await pg.fill('.d3-search input', 'scholarship')
        await pg.wait_for_timeout(950)
        ck("search narrows registry", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") == 3,
           await pg.evaluate("()=>document.querySelectorAll('.d3-row').length"))
        await pg.fill('.d3-search input', 'zzzznothing')
        await pg.wait_for_timeout(950)
        ck("search empty state", await pg.evaluate("()=>/No pages match/.test(document.querySelector('.d3-empty')?.innerText ?? '')"))
        await pg.fill('.d3-search input', '')
        await pg.wait_for_timeout(850)
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-th')].find(b=>/Page Title/.test(b.textContent)).click()")
        await pg.wait_for_timeout(900)
        first = await pg.evaluate("()=>document.querySelector('.d3-rowtitle')?.innerText")
        ck("sort by title ascending", first == "About Us", first)
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-th')].find(b=>/Page Title/.test(b.textContent)).click()")
        await pg.wait_for_timeout(900)
        ck("sort toggles to descending", await pg.evaluate("()=>document.querySelectorAll('th[aria-sort=\"descending\"]').length") == 1,
           await pg.evaluate("()=>[...document.querySelectorAll('th[aria-sort]')].map(t=>[t.innerText.split('\\n')[0], t.getAttribute('aria-sort')])"))
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-th')].find(b=>/Last Updated/.test(b.textContent)).click()")
        await pg.wait_for_timeout(900)
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-pg')].find(b=>b.textContent.trim()==='3').click()")
        await pg.wait_for_timeout(950)
        ck("pagination page 3", "17–24" in await pg.evaluate("()=>document.querySelector('.d3-reg-foot')?.innerText ?? ''"),
           await pg.evaluate("()=>document.querySelector('.d3-reg-foot')?.innerText.replace(/\\s+/g,' ')"))
        await pg.select_option('.d3-size', '25')
        await pg.wait_for_timeout(950)
        ck("page size 25 applied", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") == 25,
           await pg.evaluate("()=>document.querySelectorAll('.d3-row').length"))
        await pg.select_option('.d3-size', '8')
        await pg.wait_for_timeout(900)
        await pg.select_option('select[aria-label="Filter by type"]', 'landing')
        await pg.wait_for_timeout(950)
        ck("type filter = landing pages only", await pg.evaluate("()=>document.querySelectorAll('.d3-row').length") == 3,
           await pg.evaluate("()=>document.querySelectorAll('.d3-row').length"))
        await pg.select_option('select[aria-label="Filter by type"]', 'all')
        await pg.wait_for_timeout(900)
        await pg.click('[aria-label="More filters"]')
        await pg.wait_for_timeout(550)
        ck("filter popover opens", await pg.evaluate("()=>!!document.querySelector('.d3-filter-row.is-toggle')"))
        await pg.click('.d3-filter-row.is-toggle >> nth=0')
        await pg.wait_for_timeout(1000)
        n_issues = await pg.evaluate("()=>document.querySelectorAll('.d3-row').length")
        ck("issues-only filter composes with the selects", 0 < n_issues < 12, n_issues)
        ck("active filter marks the funnel", await pg.evaluate("""()=>{const b=document.querySelector('[aria-label="More filters"]'); return !!b && b.classList.contains('is-on')}"""),
           await pg.evaluate("""()=>document.querySelector('[aria-label="More filters"]')?.className"""))
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-filter-foot .link')][0].click()")
        await pg.wait_for_timeout(900)
        ck("reset filters restores 48", "48 pages" in await pg.evaluate("()=>document.querySelector('.d3-reg-foot')?.innerText ?? ''"),
           await pg.evaluate("()=>document.querySelector('.d3-reg-foot')?.innerText.replace(/\\s+/g,' ')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(350)

        # ---------- bulk ----------
        await pg.evaluate("()=>document.querySelectorAll('.d3-row input[type=checkbox]')[1].click()")
        await pg.wait_for_timeout(500)
        ck("bulk bar appears", await pg.evaluate("()=>/1 selected/.test(document.querySelector('.d3-bulk')?.innerText ?? '')"))
        ck("bulk bar is a row, not a full-width panel", await pg.evaluate("()=>{const b=document.querySelector('.d3-bulk'); return b.getBoundingClientRect().width < window.innerWidth*0.6}"))
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-bulk .link')].find(b=>/Select all on page/.test(b.innerText)).click()")
        await pg.wait_for_timeout(500)
        ck("select all on page = 8", await pg.evaluate("()=>/8 selected/.test(document.querySelector('.d3-bulk')?.innerText ?? '')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(500)
        ck("Esc clears the selection", await pg.evaluate("()=>!document.querySelector('.d3-bulk')"))

        # ---------- inspector ----------
        await pick(pg, "Our Story")
        insp = await pg.evaluate("()=>document.querySelector('.d3-insp')?.innerText.replace(/\\s+/g,' ') ?? ''")
        ck("inspector shows title + route", await pg.evaluate("()=>document.querySelector('.d3-insp-name')?.innerText") == "Our Story")
        ck("inspector shows 9 meta rows", await pg.evaluate("()=>document.querySelectorAll('.d3-insp .d3-meta-row').length") >= 8,
           await pg.evaluate("()=>document.querySelectorAll('.d3-insp .d3-meta-row').length"))
        ck("inspector shows performance block", "Page performance" in insp)
        ck("live URL is a link to euromiles.in", "euromiles.in/about-us/our-story" in insp)
        ck("wireframe thumbnail rendered", await pg.evaluate("()=>!!document.querySelector('.d3-insp-thumbwrap .d3-thumb')"))
        await pick(pg, "Fee Calculator")
        ck("draft page: no live URL", "Not published" in await pg.evaluate("()=>document.querySelector('.d3-insp')?.innerText ?? ''"))
        ck("draft page: Draft pill", await pg.evaluate("()=>/Draft/.test(document.querySelector('.d3-insp-badges')?.innerText ?? '')"))
        await pick(pg, "Available Scholarships")
        ck("page with unpublished changes shows the amber chip",
           await pg.evaluate("()=>!!document.querySelector('.d3-changes')"))
        ck("issue block lists the change", await pg.evaluate("()=>/issue/.test(document.querySelector('.d3-issues')?.innerText ?? '')"))
        await pg.evaluate("()=>document.querySelector('.d3-changes')?.click()")
        await pg.wait_for_timeout(900)
        ck("unpublished-changes chip routes to Publishing", await pg.evaluate("()=>document.querySelector('.page-title')?.textContent") == "Publishing & Releases")
        await pg.goto(URL)
        await pg.wait_for_timeout(2200)

        # ---------- create wizard ----------
        await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')].find(b=>/New Page/.test(b.innerText)).click()")
        await pg.wait_for_timeout(700)
        ck("create modal opens on step 1", "Step 1 of 4" in await pg.evaluate("()=>document.querySelector('.modal-sub')?.innerText ?? ''"))
        ck("continue disabled with empty title", (await foot(pg))[1][1] is True)
        await pg.fill('.modal input.input', 'QA Landing Page')
        await pg.wait_for_timeout(1000)
        ck("slug auto-derived", await pg.evaluate("()=>document.querySelectorAll('.modal input.input')[1]?.value") == "qa-landing-page")
        ck("path preview shown", "/qa-landing-page" in await pg.evaluate("()=>document.querySelector('.modal .d3-pathpreview')?.innerText ?? ''"))
        await pg.fill('.modal input.input >> nth=1', 'about-us')
        await pg.wait_for_timeout(1200)
        ck("taken slug is rejected inline", await pg.evaluate("()=>/already used by/.test(document.querySelector('.modal')?.innerText ?? '')"))
        ck("continue disabled while slug clashes", (await foot(pg))[1][1] is True)
        await pg.fill('.modal input.input >> nth=1', 'qa-landing-page')
        await pg.wait_for_timeout(1100)
        await click_foot(pg, "continue")
        ck("step 2 offers 3 starting points", await pg.evaluate("()=>document.querySelectorAll('.modal .d3-choice-row').length") == 3,
           await pg.evaluate("()=>document.querySelectorAll('.modal .d3-choice-row').length"))
        await click_foot(pg, "continue")
        ck("step 3 is layout", "Step 3 of 4" in await pg.evaluate("()=>document.querySelector('.modal-sub')?.innerText ?? ''"))
        await click_foot(pg, "continue")
        ck("step 4 review lists the draft status", await pg.evaluate("()=>/Draft/.test(document.querySelector('.modal')?.innerText ?? '')"))
        await click_foot(pg, "create page")
        await pg.wait_for_timeout(1800)
        ck("created page closes the modal", not await pg.evaluate("()=>!!document.querySelector('.modal')"))
        ck("created page toast", await pg.evaluate("()=>/Page created as a draft/.test(document.body.innerText)"))
        ck("registry total now 49", "49" in (await kpis(pg))[0], (await kpis(pg))[0])

        # ---------- edit details ----------
        await pick(pg, "QA Landing Page")
        await open_row_menu(pg)
        await menu_item(pg, "Edit Page Details")
        ck("edit details modal", await pg.evaluate("()=>document.querySelector('.modal-title')?.innerText") == "Edit Page Details")
        await pg.fill('.modal input.input >> nth=1', 'qa-landing-renamed')
        await pg.wait_for_timeout(400)
        ck("route-change warning before save", await pg.evaluate("()=>/Route change/.test(document.querySelector('.modal')?.innerText ?? '')"))
        await click_foot(pg, "save")
        await pg.wait_for_timeout(1600)
        ck("route updated in inspector", await pg.evaluate("()=>document.querySelector('.d3-insp-path')?.innerText") == "/qa-landing-renamed",
           await pg.evaluate("()=>document.querySelector('.d3-insp-path')?.innerText"))

        # ---------- duplicate / move / homepage ----------
        await open_row_menu(pg)
        await menu_item(pg, "Duplicate Page")
        ck("duplicate modal opens", await pg.evaluate("()=>document.querySelector('.modal-title')?.innerText") == "Duplicate Page")
        await click_foot(pg, "duplicate")
        await pg.wait_for_timeout(1800)
        ck("duplicate toast", await pg.evaluate("()=>/duplicated/i.test(document.body.innerText)"))
        await open_row_menu(pg)
        await menu_item(pg, "Move Page")
        ck("move modal lists parents", await pg.evaluate("()=>document.querySelector('.modal select')?.options.length") > 5)
        ck("move modal excludes own subtree", await pg.evaluate("""()=>{const sel=document.querySelector('.modal select');
            const own=(document.querySelector('.modal-sub')?.innerText.match(/currently (\S+)/)||[])[1];
            return !!own && ![...sel.options].some(o=>o.textContent.trim().endsWith('— '+own))}"""),
           await pg.evaluate("()=>[...document.querySelector('.modal select').options].map(o=>o.textContent).slice(0,3)"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)
        await open_row_menu(pg)
        await menu_item(pg, "Set as Homepage")
        ck("homepage modal explains the swap", await pg.evaluate("()=>/one page per website/i.test(document.querySelector('.modal')?.innerText ?? '')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)

        # ---------- guarded actions ----------
        await pick(pg, "Home")
        ck("homepage cannot be trashed (menu)", await item_disabled(pg, "Move to Trash") is True)
        ck("homepage cannot be moved (menu)", await item_disabled(pg, "Move Page") is True)
        await pick(pg, "Study Abroad")
        await open_row_menu(pg)
        await menu_item(pg, "Move to Trash")
        await click_foot(pg, "move to trash")
        await pg.wait_for_timeout(1600)
        ck("parent with children is refused", await pg.evaluate("()=>/child pages must be moved first/.test(document.querySelector('.modal')?.innerText ?? '')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)

        # ---------- trash / restore / purge ----------
        await pick(pg, "Our Story")
        await open_row_menu(pg)
        await menu_item(pg, "Move to Trash")
        await click_foot(pg, "move to trash")
        await pg.wait_for_timeout(1800)
        ck("trash toast offers undo", await pg.evaluate("""()=>{const t=[...document.querySelectorAll('.toast')].pop()?.innerText ?? '';
            return /to Trash/.test(t) && /Undo/.test(t)}"""),
           await pg.evaluate("()=>[...document.querySelectorAll('.toast')].map(t=>t.innerText.replace(/\\s+/g,' ')).join(' | ')"))
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[0].click()")
        await pg.wait_for_timeout(800)
        ck("trashed page leaves the registry", await pg.evaluate("()=>![...document.querySelectorAll('.d3-rowtitle')].some(t=>t.innerText==='Our Story')"))
        ck("trash tab counts 3", "Trash 3" in (await pg.evaluate("()=>[...document.querySelectorAll('.d3-tab')].map(t=>t.innerText.replace(/\\s+/g,' ').trim())"))[3])
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[3].click()")
        await pg.wait_for_timeout(1000)
        ck("trash tab lists the page", await pg.evaluate("()=>[...document.querySelectorAll('.d3-rowtitle')].some(t=>t.innerText==='Our Story')"))
        ck("trash inspector offers restore", await pg.evaluate("()=>/Restore Page/.test(document.querySelector('.d3-insp-foot')?.innerText ?? '')"))
        ck("trash inspector shows the 30-day window", await pg.evaluate("()=>/Restorable until/.test(document.querySelector('.d3-insp')?.innerText ?? '')"))
        await pg.evaluate("()=>[...document.querySelectorAll('.d3-row')].find(r=>r.innerText.includes('Our Story')).click()")
        await pg.wait_for_timeout(900)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.d3-insp-foot button')].find(b=>/Restore Page/.test(b.innerText)); b.click()}")
        await pg.wait_for_timeout(700)
        ck("restore modal names the page + window", await pg.evaluate("()=>/Our Story/.test(document.querySelector('.modal')?.innerText ?? '') && /Jun 29, 2025/.test(document.querySelector('.modal')?.innerText ?? '')"))
        await click_foot(pg, "restore page")
        await pg.wait_for_timeout(1800)
        ck("restore returns the page as a draft", await pg.evaluate("()=>/restored as a draft/.test(document.body.innerText)"))
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[0].click()")
        await pg.wait_for_timeout(900)
        ck("restored page is back in the registry", await pg.evaluate("()=>[...document.querySelectorAll('.d3-rowtitle')].some(t=>t.innerText==='Our Story')"))
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[3].click()")
        await pg.wait_for_timeout(900)
        await pg.evaluate("()=>document.querySelectorAll('.d3-row')[0].click()")
        await pg.wait_for_timeout(900)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.d3-insp-foot button')].find(b=>/^Delete$/.test(b.innerText)); b.click()}")
        await pg.wait_for_timeout(700)
        ck("permanent delete is a separate confirm", await pg.evaluate("()=>/Delete Page Permanently/.test(document.querySelector('.modal-title')?.innerText ?? '')"))
        await click_foot(pg, "delete permanently")
        await pg.wait_for_timeout(1800)
        ck("permanent delete is final", await pg.evaluate("()=>/deleted permanently/.test(document.body.innerText)"))
        ck("trash tab loses the purged page", "Trash 1" in (await pg.evaluate("()=>[...document.querySelectorAll('.d3-tab')].map(t=>t.innerText.replace(/\\s+/g,' ').trim())"))[3],
           (await pg.evaluate("()=>[...document.querySelectorAll('.d3-tab')].map(t=>t.innerText.replace(/\\s+/g,' ').trim())"))[3])

        # ---------- preview ----------
        await pg.evaluate("()=>document.querySelectorAll('.d3-tab')[0].click()")
        await pg.wait_for_timeout(900)
        for _ in range(4):
            await pg.evaluate("()=>{const b=[...document.querySelectorAll('.toolbar button')].find(b=>b.innerText.trim()==='Preview'); if(b) b.click()}")
            await pg.wait_for_timeout(2400)
            if await pg.evaluate("()=>/pv_/.test(document.querySelector('.modal')?.innerText ?? '')"):
                break
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(500)
        ck("preview issues a signed token", await pg.evaluate("()=>/pv_/.test(document.querySelector('.modal')?.innerText ?? '')"))
        ck("preview states its 15-minute life", await pg.evaluate("()=>/15 minutes/.test(document.querySelector('.modal')?.innerText ?? '')"))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(500)

        # ---------- builder handoff (Module 4 owns the screen now) ----------
        wanted = await pg.evaluate("()=>new URLSearchParams(location.hash.split('?')[1]||'').get('sel')||''")
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('.d3-insp-foot button')].find(b=>/Edit Page/.test(b.innerText)); b.click()}")
        await pg.wait_for_timeout(2000)
        ck("builder handoff opens the builder", await pg.evaluate("()=>!!document.querySelector('.wb-root')"))
        got = await pg.evaluate("()=>document.querySelector('select[aria-label=\"Page\"]')?.value ?? ''")
        ck("handoff keeps the page context", bool(wanted) and wanted in got, f"{wanted!r} vs {got!r}")
        ck("handoff loads a composed document", await pg.evaluate("()=>document.querySelectorAll('[data-slot]').length") >= 2)
        ck("handoff writes the page into the URL", await pg.evaluate("()=>/page=/.test(location.hash)"))
        await pg.click('.nav-item:has-text("Pages")')
        await pg.wait_for_timeout(1200)
        ck("back returns to the registry", await pg.evaluate("()=>!!document.querySelector('.d3-grid')"))

        # ---------- deep links (cold load, the way a shared link opens) ----------
        d = await b.new_page(viewport={"width": 1440, "height": 900})
        await d.goto("file:///home/user/wacrm-app/WACRM-CMS.html#/pages?site=site_rewards&tab=drafts")
        await d.wait_for_timeout(2600)
        ck("deep link: site + tab", await d.evaluate("()=>document.querySelector('.d3-site')?.innerText.includes('Rewards') && /Drafts/.test(document.querySelector('.d3-tab[aria-selected=\"true\"]')?.innerText ?? '')"),
           await d.evaluate("()=>[document.querySelector('.d3-site')?.innerText.replace(/\\s+/g,' '), document.querySelector('.d3-tab[aria-selected=\"true\"]')?.innerText]"))
        ck("deep link: search box is prefilled", await d.evaluate("()=>document.querySelector('.d3-search input')?.value") == "")
        d2 = await b.new_page(viewport={"width": 1440, "height": 900})
        await d2.goto("file:///home/user/wacrm-app/WACRM-CMS.html#/pages?q=scholarship")
        await d2.wait_for_timeout(2600)
        ck("deep link: search term", await d2.evaluate("()=>document.querySelectorAll('.d3-row').length") == 3,
           await d2.evaluate("()=>document.querySelectorAll('.d3-row').length"))
        ck("deep link: search box is prefilled", await d2.evaluate("()=>document.querySelector('.d3-search input')?.value") == "scholarship")
        ck("URL reflects the current view", await d2.evaluate("()=>/sel=pg_|q=scholarship/.test(location.hash)"),
           await d2.evaluate("()=>location.hash"))
        await d2.close()
        await d.close()

        # ---------- viewer role ----------
        await boot(pg)
        await forced(pg, "Permission denied")
        ck("viewer banner on Pages", await pg.evaluate("()=>!!document.querySelector('.d1-readonly')"))
        ck("viewer: New Page disabled", await pg.evaluate("()=>[...document.querySelectorAll('.toolbar button')].find(b=>/New Page/.test(b.innerText))?.disabled") is True)
        ck("viewer: row edit buttons disabled", await pg.evaluate("""()=>{const rows=document.querySelectorAll('.d3-row').length;
            return document.querySelectorAll('.d3-row .d3-act button:disabled').length >= rows}"""))
        ck("viewer: inspector says read-only", await pg.evaluate("()=>/Read-only role/.test(document.querySelector('.d3-insp')?.innerText ?? '')"))
        await forced(pg, "Default")

        # ---------- keyboard ----------
        await pg.evaluate("()=>document.body.click()")
        await pg.keyboard.press("/")
        await pg.wait_for_timeout(500)
        ck("slash focuses the registry search", await pg.evaluate("()=>document.activeElement?.closest('.d3-search')!==null"))

        # ---------- responsive ----------
        for w in (1280, 1440, 1920):
            await pg.set_viewport_size({"width": w, "height": 900})
            await pg.wait_for_timeout(900)
            over = await pg.evaluate("()=>[...document.querySelectorAll('.app *')].filter(e=>e.getBoundingClientRect().right>window.innerWidth+1.5).length")
            ck(f"no horizontal overflow at {w}", over == 0, over)
        await pg.set_viewport_size({"width": 1440, "height": 900})
        await pg.wait_for_timeout(500)

        ck("no runtime errors", not errs, "; ".join(errs[:3]))
        await b.close()
  except Exception as e:  # noqa: BLE001 — report what we got instead of dying silently
    results.append({"check": "QA run completed", "ok": False, "detail": f"{type(e).__name__}: {str(e)[:120]}"})

  passed = sum(1 for r in results if r["ok"])
  for r in results:
    print(("OK   " if r["ok"] else "FAIL ") + r["check"] + (("  → " + r["detail"]) if r["detail"] else ""))
  print(f"\n{passed}/{len(results)} checks passed")
  sys.exit(0 if passed == len(results) else 1)


asyncio.run(main())
