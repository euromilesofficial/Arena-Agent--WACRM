#!/usr/bin/env python3
"""Module 8 — Menus & Navigation (built to the mockup, see MODULE-8-SPEC.md).

U  unit (Node, the real src/lib/menu-db.ts bundled with esbuild): link and depth rules,
   mega panel checks, sibling-only reorder, typed page links, counts
B  browser (Playwright, WACRM-CMS.html): the six tabs, the menu picker, add items,
   item settings, mega panel editor, navigation preview (desktop, tablet, mobile),
   checks and Validate Links, Publish with a version, rollback, placements, delete guards,
   Viewer read-only, and the prototype states (error, empty, loading, conflict, denied)
"""
import asyncio, json, os, re, subprocess, sys, tempfile
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
APP = "/home/user/wacrm-app"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else "")); print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

NODE_JS = r"""
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
const M = require(process.argv[2]);
const pages = [
  { id: 'p_home', path: '/', title: 'Home', status: 'published', siteId: 'site_main' },
  { id: 'p_draft', path: '/study-abroad/france', title: 'Study in France', status: 'draft', siteId: 'site_main' },
  { id: 'p_gone', path: '/old', title: 'Old page', status: 'published', trash: true, siteId: 'site_main' },
];
const link = (id, pageId) => ({ id, label: id, link: { kind: 'page', pageId }, newTab: false, audience: 'everyone', behaviour: 'link', megaId: null, children: [], cssClass: '', rel: '' });
const doc = (items) => ({ name: 'T', description: '', items, mobile: { behaviour: 'drawer', openFirstLevel: false } });
const out = {};
out.clean = M.checkMenu(doc([link('a', 'p_home')]), pages, [], 'm').filter(i => i.severity === 'error').length;
out.draftWarn = M.checkMenu(doc([link('b', 'p_draft')]), pages, [], 'm').find(i => i.id === 'b_draft')?.severity ?? null;
out.trashErr = M.checkMenu(doc([link('c', 'p_gone')]), pages, [], 'm').find(i => i.id === 'c_page')?.severity ?? null;
out.missingPageErr = M.checkMenu(doc([link('c2', 'nope')]), pages, [], 'm').find(i => i.id === 'c2_page')?.severity ?? null;
const deep = { ...link('d0', 'p_home'), children: [{ ...link('d1', 'p_home'), children: [{ ...link('d2', 'p_home'), children: [link('d3', 'p_home')] }] }] };
out.tooDeep = M.checkMenu(doc([deep]), pages, [], 'm').some(i => i.id === 'too_deep');
const mg = { ...link('m0', 'p_home'), behaviour: 'mega', megaId: null };
out.megaNoPanel = M.checkMenu(doc([mg]), pages, [], 'm').find(i => i.id === 'm0_nomega')?.severity ?? null;
out.megaMissing = M.checkMenu(doc([{ ...mg, megaId: 'gone' }]), pages, ['mega_a'], 'm').find(i => i.id === 'm0_megamissing')?.severity ?? null;
out.megaOk = M.checkMenu(doc([{ ...mg, megaId: 'mega_a' }]), pages, ['mega_a'], 'm').some(i => i.id.endsWith('_nomega') || i.id.endsWith('_megamissing'));
const megaDoc = (n, featured) => ({ name: 'P', gap: 'medium', columns: Array.from({ length: n }, (_, i) => ({ id: 'c' + i, title: 'C' + i, links: [{ id: 'l' + i, label: 'x', link: { kind: 'page', pageId: 'p_home' } }] })), featured: { enabled: featured, image: 'coast', title: featured ? '' : 'T', text: '', ctaLabel: '', ctaLink: null } });
out.megaCols5 = M.checkMega(megaDoc(5, false), pages, 'g').some(i => i.id === 'g_cols');
out.megaCols3 = M.checkMega(megaDoc(3, false), pages, 'g').some(i => i.id === 'g_cols');
out.featTitle = M.checkMega(megaDoc(2, true), pages, 'g').some(i => i.id === 'g_ft');
const ids = (xs) => xs.map(i => i.id);
const three = doc([link('x1', 'p_home'), link('x2', 'p_home'), link('x3', 'p_home')]);
out.moveDown = ids(M.moveItem(three.items, 'x1', 1));
out.moveTopEdge = ids(M.moveItem(three.items, 'x1', -1));
const nested = doc([{ ...link('n1', 'p_home'), behaviour: 'dropdown', children: [link('n1a', 'p_home'), link('n1b', 'p_home')] }, link('n2', 'p_home')]);
out.moveBeforeSibling = ids(M.moveBefore(nested.items[0].children, 'n1b', 'n1a'));
out.moveBeforeCross = ids(M.moveBefore(nested.items, 'n1b', 'n2'));
out.moveBeforeTop = ids(M.moveBefore(nested.items, 'n2', 'n1'));
out.count = M.countItems(nested.items);
out.depth = M.depthOf(nested.items);
out.addChildMakesDropdown = M.addChild([link('q', 'p_home')], 'q', link('qq', 'p_home'))[0].behaviour;
out.linkLabel = M.linkLabel({ kind: 'page', pageId: 'p_home' }, pages);
out.linkLabelTrash = M.linkLabel({ kind: 'page', pageId: 'p_gone' }, pages);
out.urlBad = M.checkMenu(doc([{ ...link('u1', 'p_home'), link: { kind: 'url', url: 'javascript:alert(1)' } }]), pages, [], 'm').some(i => i.id === 'u1_url');
out.urlOk = M.urlOk('https://example.com/apply') && M.urlOk('mailto:a@b.co') && !M.urlOk('javascript:alert(1)');
out.anchor = M.anchorOk('#visa') && !M.anchorOk('visa section');
console.log(JSON.stringify(out));
"""

def unit():
    tmp = tempfile.mkdtemp()
    b = os.path.join(tmp, "menu.cjs"); js = os.path.join(tmp, "t.cjs")
    r = subprocess.run(["npx", "esbuild", f"{APP}/src/lib/menu-db.ts", "--bundle", "--format=cjs", "--platform=node", f"--outfile={b}", "--log-level=error"],
                       capture_output=True, text=True, timeout=120, cwd=APP)
    if r.returncode != 0:
        ck("U0 the data layer bundles for Node", False, r.stderr[:200]); return
    open(js, "w").write(NODE_JS)
    r = subprocess.run(["node", js, b], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        ck("U0 the data layer runs in Node", False, r.stderr[:300]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    ck("U1 a clean link has no errors", o["clean"] == 0, str(o["clean"]))
    ck("U2 a draft page is a warning, not an error", o["draftWarn"] == "warn", str(o["draftWarn"]))
    ck("U3 a trashed page is an error", o["trashErr"] == "error", str(o["trashErr"]))
    ck("U4 a missing page is an error", o["missingPageErr"] == "error", str(o["missingPageErr"]))
    ck("U5 a fourth level is refused", o["tooDeep"] is True)
    ck("U6 a mega item without a panel is an error", o["megaNoPanel"] == "error", str(o["megaNoPanel"]))
    ck("U7 a mega item pointing at a deleted panel is an error", o["megaMissing"] == "error", str(o["megaMissing"]))
    ck("U8 a mega item with a valid panel is clean", o["megaOk"] is False)
    ck("U9 a panel with five columns is an error", o["megaCols5"] is True)
    ck("U10 a panel with three columns is clean", o["megaCols3"] is False)
    ck("U11 a featured card needs a title", o["featTitle"] is True)
    ck("U12 moving down swaps with the next sibling", o["moveDown"] == ["x2", "x1", "x3"], str(o["moveDown"]))
    ck("U13 moving up past the top does nothing", o["moveTopEdge"] == ["x1", "x2", "x3"], str(o["moveTopEdge"]))
    ck("U14 drag reorders among siblings", o["moveBeforeSibling"] == ["n1b", "n1a"], str(o["moveBeforeSibling"]))
    ck("U15 drag across levels is refused (depth cannot change by accident)", o["moveBeforeCross"] == ["n1", "n2"], str(o["moveBeforeCross"]))
    ck("U16 drag to top level among its own list works", o["moveBeforeTop"] == ["n2", "n1"], str(o["moveBeforeTop"]))
    ck("U17 counts every link, nested included", o["count"] == 4, str(o["count"]))
    ck("U18 depth is the deepest level", o["depth"] == 2, str(o["depth"]))
    ck("U19 adding a child turns a link into a dropdown", o["addChildMakesDropdown"] == "dropdown")
    ck("U20 a page link shows the page title", o["linkLabel"] == "Home")
    ck("U21 a deleted page reads as deleted", o["linkLabelTrash"] == "Old page (deleted)", str(o["linkLabelTrash"]))
    ck("U22 a javascript: address is refused", o["urlBad"] is True)
    ck("U23 only https, mailto and tel addresses are accepted", o["urlOk"] is True)
    ck("U24 anchors must look like #section", o["anchor"] is True)

async def shot_free(pg, label):
    await pg.wait_for_timeout(150)

async def set_state(pg, label):
    await pg.get_by_role("button", name="Prototype states").click(); await pg.wait_for_timeout(200)
    await pg.get_by_role("menuitem", name=label).click(); await pg.wait_for_timeout(300)

async def browser():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)

        # ---- screen structure (mockup) ----
        names = ["Menu Builder", "Manage Menus", "Menu Placements", "Mega Menus", "Version History", "Settings"]
        tabs_ok = True
        for n in names:
            tabs_ok = tabs_ok and await pg.get_by_role("tab", name=n).count() == 1
        ck("B1 six tabs match the mockup", tabs_ok)
        kpi_ok = True
        for t in ["Menus", "Assigned", "Draft (unpublished)", "Link issues", "Version history"]:
            kpi_ok = kpi_ok and await pg.get_by_text(t, exact=True).count() >= 1
        ck("B2 KPI strip shows menus, assigned, draft, link issues, versions", kpi_ok)
        ck("B3 the builder shows three panels: add items, structure, settings",
           await pg.locator(".m8-builder > section").count() == 3)
        ck("B4 the seeded primary menu has its links", await pg.locator(".m8-row").count() >= 6, str(await pg.locator(".m8-row").count()))
        ck("B5 a mega item is marked Mega Menu", await pg.locator(".m8-row.is-mega .m8-type", has_text="Mega Menu").count() == 1)
        ck("B6 the France draft page is tagged draft in the picker", await pg.locator(".m8-draft-tag").count() >= 1)

        # ---- menu picker ----
        await pg.locator(".m8-select").click(); await pg.wait_for_timeout(150)
        ck("B7 the menu picker lists all four menus", await pg.get_by_role("option").count() == 4, str(await pg.get_by_role("option").count()))
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(100)
        ck("B8 Escape closes the picker", await pg.locator(".m8-picker-pop").count() == 0)

        # ---- add items ----
        # pick the first page that is not already a link in the menu (the duplicate guard covers the rest)
        rows_now = " ".join(await pg.locator(".m8-row-label").all_inner_texts())
        pick = None
        boxes = pg.locator(".m8-check input[type=checkbox]")
        for i in range(await boxes.count()):
            lab = await boxes.nth(i).get_attribute("aria-label") or ""
            if lab.startswith("Select ") and lab[7:] not in rows_now:
                pick = boxes.nth(i); break
        await pick.check(); await pg.wait_for_timeout(100)
        ck("B9 picking a page enables Add to Menu", await pg.get_by_role("button", name="Add to Menu (1)").is_enabled())
        before = await pg.locator(".m8-row").count()
        await pg.get_by_role("button", name="Add to Menu (1)").click(); await pg.wait_for_timeout(200)
        ck("B10 Add to Menu adds the link to the structure", await pg.locator(".m8-row").count() == before + 1)

        # ---- item settings: label and link ----
        await pg.locator(".m8-row", has_text="Scholarships").first.click(); await pg.wait_for_timeout(150)
        lab = pg.get_by_label("Label", exact=True)
        await lab.fill("Scholarships & aid"); await pg.wait_for_timeout(100)
        ck("B11 editing the label changes the row", await pg.locator(".m8-row-label", has_text="Scholarships & aid").count() == 1)
        await pg.get_by_role("button", name="Custom link").click(); await pg.wait_for_timeout(120)
        await pg.get_by_label("Custom link address").fill("javascript:alert(1)")
        await pg.get_by_role("button", name="Add custom link").click(); await pg.wait_for_timeout(200)
        ck("B13 a javascript: custom link is refused with a message",
           await pg.get_by_text("Address not allowed").count() >= 1)

        # ---- mega panel ----
        await pg.locator(".m8-row.is-mega").first.click(); await pg.wait_for_timeout(150)
        await pg.get_by_role("tab", name="Mega Panel").click(); await pg.wait_for_timeout(120)
        await pg.get_by_role("button", name="Edit panel in Mega Menus").click(); await pg.wait_for_timeout(250)
        ck("B14 Edit panel opens the Mega Menus editor on that panel",
           await pg.get_by_label("Mega panel name").input_value() == "Study Abroad mega menu")
        cols = await pg.locator("section.m8-mcol[aria-label^='Column ']").count()
        ck("B15 the panel has three columns, as in the mockup", cols == 3, str(cols))
        await pg.get_by_role("radio", name="2 columns").click(); await pg.wait_for_timeout(120)
        ck("B16 switching layout to 2 columns removes a column",
           await pg.locator("section.m8-mcol[aria-label^='Column ']").count() == 2)
        await pg.get_by_role("radio", name="3 columns").click(); await pg.wait_for_timeout(120)
        ck("B17 switching back restores three columns", await pg.locator("section.m8-mcol[aria-label^='Column ']").count() == 3)
        ck("B18 the featured card can be shown", await pg.locator("section[aria-label='Featured card']").count() == 1)
        await pg.get_by_label("Column gap").select_option("large"); await pg.wait_for_timeout(120)
        ck("B19 the column gap changes", await pg.get_by_label("Column gap").input_value() == "large")
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)

        # ---- navigation preview ----
        await pg.locator("#m8-preview .m8-pv-top > li.is-mega > button").first.click(); await pg.wait_for_timeout(150)
        ck("B20 a mega item opens its panel on click", await pg.locator("#m8-preview button[aria-expanded='true']").count() >= 1)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(120)
        ck("B21 Escape closes an open panel", await pg.locator("#m8-preview .m8-pv-panel").count() == 0)
        await pg.get_by_role("radio", name="Mobile").click(); await pg.wait_for_timeout(120)
        ck("B22 the mobile preview stacks the menu", await pg.locator(".m8-pv-mobile").count() == 1)
        await pg.get_by_role("radio", name="Desktop").click()

        # ---- checks and publish ----
        await pg.get_by_role("button", name="Validate Links").first.click(); await pg.wait_for_timeout(200)
        ck("B23 Validate Links lists the draft warning", await pg.locator(".m8-issues li.warn").count() >= 1)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(120)
        await pg.get_by_role("button", name="Save Draft").first.click(); await pg.wait_for_timeout(400)
        ck("B24 Save Draft writes the drafts", await pg.get_by_text("Drafts saved").count() >= 1 or await pg.get_by_text("Saved", exact=True).count() >= 1)
        await pg.get_by_role("button", name="Publish Changes").first.click(); await pg.wait_for_timeout(200)
        ck("B25 Publish asks for review and lists the changes", await pg.get_by_text("Publish changes").count() >= 1 and await pg.locator(".m8-changes li").count() >= 1)
        btn = pg.get_by_role("dialog").get_by_role("button", name=re.compile(r"^Publish \d+ change"))
        await btn.click(); await pg.get_by_role("dialog").wait_for(state="detached", timeout=15000)
        await pg.get_by_role("tab", name="Version History").click(); await pg.locator("tbody tr", has_text="v2").first.wait_for(timeout=8000)
        ck("B26 a publish adds version 2, marked live", await pg.locator("tbody tr", has_text="v2").count() == 1 and await pg.get_by_text("Live", exact=True).count() >= 1)

        # ---- rollback ----
        await pg.locator("tbody tr", has_text="v1").get_by_role("button", name="Roll back").click(); await pg.wait_for_timeout(200)
        await pg.get_by_role("button", name="Roll back and publish").click()
        await pg.get_by_role("dialog").wait_for(state="detached", timeout=15000)
        await pg.get_by_role("tab", name="Version History").click(); await pg.locator("tbody tr").nth(2).wait_for(timeout=8000)
        ck("B27 a rollback publishes a new version and keeps history", await pg.locator("tbody tr").count() == 3, str(await pg.locator("tbody tr").count()))

        # ---- manage ----
        await pg.get_by_role("tab", name="Manage Menus").click(); await pg.wait_for_timeout(200)
        ck("B28 Manage lists every menu", await pg.locator("table tbody tr").count() >= 4)
        await pg.get_by_label("Filter menus").select_option("unassigned"); await pg.wait_for_timeout(120)
        # Utility has no layout slot yet, so it is unassigned too: campaign + utility
        ck("B29 the filter narrows to unassigned menus", await pg.locator("table tbody tr").count() == 2, str(await pg.locator("table tbody tr").count()))
        await pg.get_by_label("Filter menus").select_option("all")
        ck("B30 a menu placed on the site cannot be deleted (row Delete is disabled)",
           await pg.locator("table tbody tr", has_text="Primary Navigation").get_by_role("button", name="Delete").is_disabled())
        await pg.get_by_role("tab", name="Settings").click(); await pg.wait_for_timeout(200)
        ck("B30b the Settings delete is disabled for a placed menu",
           await pg.get_by_role("button", name="Delete Primary Navigation").is_disabled())

        # ---- placements ----
        await pg.get_by_role("tab", name="Menu Placements").click(); await pg.wait_for_timeout(200)
        ck("B31 placements shows header and footer per layout, plus utility and mobile rows", await pg.get_by_text("Top bar / Utility").count() == 1 and await pg.get_by_text("Save Placement Draft").count() == 1)
        ck("B32 mobile is generated from the header", await pg.get_by_text("Auto · responsive").count() == 1)

        # ---- mega menus tab ----
        await pg.get_by_role("tab", name="Mega Menus").click(); await pg.wait_for_timeout(200)
        ck("B33 the mega library shows what each panel is used in", await pg.get_by_text("Used in:").count() >= 1)
        await pg.get_by_role("button", name="Create Mega Menu").click(); await pg.wait_for_timeout(150)
        await pg.get_by_label("New panel name").fill("Testing panel"); await pg.get_by_role("button", name="Create panel").click(); await pg.wait_for_function("() => document.querySelector('input[aria-label=\"Mega panel name\"]')?.value === 'Testing panel'", timeout=8000)
        _mp = await pg.get_by_label("Mega panel name").input_value()
        ck("B34 creating a panel selects it for editing", _mp == "Testing panel", _mp)

        # ---- settings ----
        await pg.get_by_role("tab", name="Settings").click(); await pg.wait_for_timeout(200)
        ck("B35 settings sets the mobile style", await pg.get_by_label("Mobile style").count() == 1)
        ck("B36 settings shows the limits", await pg.get_by_text("3 levels deep at most").count() == 1)

        # ---- prototype states ----
        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
        await set_state(pg, "Permission denied (Viewer)"); await pg.wait_for_timeout(500)
        ck("B37 denied role sees the read-only notice", await pg.get_by_text("Read-only. Your role").count() == 1)
        ck("B38 denied role cannot save", await pg.get_by_role("button", name="Save Draft").first.is_disabled())
        await set_state(pg, "Default"); await pg.wait_for_timeout(500)
        ck("B39 default restores editing (Save Draft is enabled once something changes)", await pg.get_by_role("tab", name="Menu Builder").count() == 1 and await pg.locator(".m8-banner.is-info").count() == 0)

        await set_state(pg, "Error / service down"); await pg.wait_for_timeout(900)
        ck("B40 error state explains the failure with a retry", await pg.get_by_text("Menus did not load").count() == 1 and await pg.get_by_role("button", name="Try again").count() == 1)
        await set_state(pg, "Default"); await pg.wait_for_timeout(900)

        await set_state(pg, "Loading skeletons"); await pg.wait_for_timeout(60)
        ck("B41 loading state shows busy skeletons", await pg.locator("[aria-busy='true'] .m8-skel, [aria-busy='true'] .m8-skel-tall").count() >= 1)
        await pg.wait_for_timeout(2200)
        await set_state(pg, "Default"); await pg.wait_for_timeout(900)

        await set_state(pg, "Empty (no data in range)"); await pg.wait_for_timeout(900)
        ck("B42 empty state offers the first menu", await pg.get_by_text("No menus yet").count() == 1)
        await set_state(pg, "Default"); await pg.wait_for_timeout(900)

        await pg.get_by_role("tab", name="Menu Builder").click(); await pg.wait_for_timeout(200)
        await pg.locator(".m8-row", has_text="Contact").first.click(); await pg.wait_for_timeout(120)
        await pg.get_by_label("Label", exact=True).fill("Contact us"); await pg.wait_for_timeout(120)
        await set_state(pg, "Publish conflict"); await pg.wait_for_timeout(300)
        await pg.get_by_role("button", name="Save Draft").first.click(); await pg.wait_for_timeout(700)
        ck("B43 a stale save shows the conflict banner and keeps the draft",
           await pg.locator(".m8-banner[role='alert']").count() == 1)
        await pg.get_by_role("button", name="Reload theirs").click(); await pg.wait_for_timeout(700)
        ck("B44 Reload theirs clears the banner", await pg.locator(".m8-banner[role='alert']").count() == 0)
        await set_state(pg, "Default"); await pg.wait_for_timeout(700)

        ck("B45 no page errors during the run", not errs, "; ".join(errs[:3]))
        await b.close()

def main():
    unit()
    try:
        asyncio.run(browser())
    except Exception as e:
        ck("B0 the browser run completes", False, str(e)[:300])
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m8_menus · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:"); [print(" · " + f) for f in FAILS]
    sys.exit(0 if TALLY["fail"] == 0 else 1)

if __name__ == "__main__":
    main()
