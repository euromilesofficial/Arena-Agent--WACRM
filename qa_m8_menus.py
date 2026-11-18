#!/usr/bin/env python3
"""Module 8 — Menus & Navigation.

A  unit (Node, the real src/lib/menu-db.ts): link checks, tree rules, depth cap,
   compare-and-swap conflict, save refused on errors, apply writes the header/footer
   variant and reports what it left out
U  UI (Playwright): the screen, the editing rules, the link checks on the canvas,
   Save and Discard, apply, mobile output, preview, create and delete
"""
import asyncio, json, os, subprocess, sys, tempfile
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
// Node has no localStorage; the data layer only reads it at import time.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
const M = require(process.argv[2]);
const pages = [
  { path: '/', title: 'Home', status: 'published', trash: null, siteId: 'site_main' },
  { path: '/scholarships', title: 'Scholarships', status: 'published', trash: null, siteId: 'site_main' },
  { path: '/old', title: 'Old', status: 'published', trash: { at: 'x' }, siteId: 'site_main' },
  { path: '/draft-page', title: 'Draft', status: 'draft', trash: null, siteId: 'site_main' },
];
const it = (id, label, kind, target, extra = {}) => ({ id, label, kind, target, newTab: false, audience: 'everyone', mega: false, children: [], ...extra });
const menu = (items, location = 'header') => ({ id: 'm', siteId: 'site_main', name: 'T', location, items, rev: 1, mobile: { behaviour: 'drawer', openFirstLevel: false }, appliedTo: null, updatedAt: '', updatedBy: '' });
const ids = (issues) => issues.map(i => i.id);
(async () => {
  const out = {};
  out.clean = M.checkMenu(menu([it('a', 'Home', 'page', '/'), it('b', 'Scholarships', 'page', '/scholarships')]), pages);
  out.missing = M.checkMenu(menu([it('a', 'Gone', 'page', '/nope')]), pages);
  out.trashed = M.checkMenu(menu([it('a', 'Old', 'page', '/old')]), pages);
  out.draft = M.checkMenu(menu([it('a', 'Draft', 'page', '/draft-page')]), pages);
  out.jsUrl = M.checkMenu(menu([it('a', 'Bad', 'url', 'javascript:alert(1)')]), pages);
  out.httpUrl = M.checkMenu(menu([it('a', 'Plain', 'url', 'http://example.com')]), pages);
  out.goodUrl = M.checkMenu(menu([it('a', 'Ok', 'url', 'https://example.com/apply')]), pages);
  out.anchorBad = M.checkMenu(menu([it('a', 'Top', 'anchor', 'pricing')]), pages);
  out.anchorOk = M.checkMenu(menu([it('a', 'Top', 'anchor', '#pricing')]), pages);
  out.noLabel = M.checkMenu(menu([it('a', '   ', 'page', '/')]), pages);
  out.dup = M.checkMenu(menu([it('a', 'One', 'page', '/scholarships'), it('b', 'Two', 'page', '/scholarships')]), pages);
  out.hiddenParent = M.checkMenu(menu([it('a', 'P', 'page', '/', { audience: 'hidden', children: [it('c', 'C', 'page', '/scholarships')] })]), pages);
  out.megaNoCols = M.checkMenu(menu([it('a', 'M', 'page', '/', { mega: true })]), pages);
  out.megaTooMany = M.checkMenu(menu([it('a', 'M', 'page', '/', { mega: true, children: [1,2,3,4,5].map(i => it('c'+i, 'C'+i, 'page', '/scholarships')) })]), pages);
  out.empty = M.checkMenu(menu([]), pages);

  // tree rules
  let t = [it('a', 'A', 'page', '/')];
  t = M.addChild(t, 'a', it('b', 'B', 'page', '/'));
  t = M.addChild(t, 'b', it('c', 'C', 'page', '/'));
  const tooDeep = M.addChild(t, 'c', it('d', 'D', 'page', '/'));
  out.depthCapHolds = JSON.stringify(tooDeep) === JSON.stringify(t);
  out.depth3 = M.depthOf(t);
  out.moved = M.moveItem([it('a','A','page','/'), it('b','B','page','/')], 'b', -1).map(x => x.id).join(',');
  out.moveEdge = M.moveItem([it('a','A','page','/')], 'a', -1).map(x => x.id).join(',');
  out.removed = M.removeItem(t, 'b').length;

  // API: validation, conflict, create, apply
  const { MenusAPI } = M;
  const { DBX } = require(process.argv[3]);
  const load = await MenusAPI.load('site_main');
  const primary = load.menus.find(m => m.id === 'menu_primary');
  out.seedCount = load.menus.length;
  out.seedWarnings = M.checkMenu(primary, load.pages).filter(i => i.severity === 'warn').map(i => i.id);
  out.seedErrors = M.checkMenu(primary, load.pages).filter(i => i.severity === 'error').length;

  const bad = JSON.parse(JSON.stringify(primary)); bad.items[0].label = '';
  try { await MenusAPI.save(bad, primary.rev); out.saveBad = 'saved'; } catch (e) { out.saveBad = e.code; }
  try { await MenusAPI.save(primary, primary.rev + 5); out.conflict = 'saved'; } catch (e) { out.conflict = e.code; }

  const edited = JSON.parse(JSON.stringify(primary)); edited.items[0].label = 'Start';
  const saved = await MenusAPI.save(edited, primary.rev);
  out.savedRev = saved.rev;
  try { await MenusAPI.save(edited, primary.rev); out.staleSave = 'saved'; } catch (e) { out.staleSave = e.code; }

  try { await MenusAPI.create('site_main', 'primary navigation', 'custom'); out.dupName = 'created'; } catch (e) { out.dupName = e.code; }
  const created = await MenusAPI.create('site_main', 'QA menu', 'custom');
  out.created = created.name;
  await MenusAPI.remove(created.id);
  out.removedCustom = (await MenusAPI.load('site_main')).menus.some(m => m.id === created.id) ? 'still there' : 'gone';

  const regions = [{ id: 'reg_header', kind: 'header', name: 'H', locked: true, variants: [{ id: 'hv', name: 'Default header', note: '', rev: 1, updatedAt: '', blocks: [{ id: 'h', type: 'container', style: {}, props: { nav: ['Home'] } }] }] }];
  let written = null;
  const origSave = null;
  try {
    const r = await MenusAPI.apply(saved, 'reg_header', 'hv', regions);
    out.applyWritten = r.written; out.applyOmitted = r.omitted;
  } catch (e) { out.applyError = e.message; }
  out.afterApply = (await MenusAPI.load('site_main')).menus.find(m => m.id === 'menu_primary').appliedTo ? 'applied' : 'not applied';
  console.log(JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
"""

def unit():
    tmp = tempfile.mkdtemp()
    b1 = os.path.join(tmp, "menu.cjs"); b2 = os.path.join(tmp, "data.cjs")
    for src, dst in [("src/lib/menu-db.ts", b1), ("src/lib/data.ts", b2)]:
        r = subprocess.run(["npx", "esbuild", src, "--bundle", "--format=cjs", "--platform=node", f"--outfile={dst}", "--log-level=error"],
                           cwd=APP, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            ck(f"A0 {src} bundles", False, r.stderr[:200]); return
    js = os.path.join(tmp, "t.cjs"); open(js, "w").write(NODE_JS)
    r = subprocess.run(["node", js, b1, b2], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        ck("A0 the module runs in Node", False, (r.stderr or r.stdout)[:400]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])

    ck("A1 a link to an existing page is clean", o["clean"] == [], str(o["clean"]))
    ck("A2 a link to a missing page is an error", sev(o["missing"], "page_missing") == "error", str(o["missing"]))
    ck("A3 a link to a trashed page is an error", "page_missing" in ids_of(o["trashed"]), str(o["trashed"]))
    ck("A4 a link to a draft is a warning, not an error", sev(o["draft"], "page_draft") == "warn", str(o["draft"]))
    ck("A5 a javascript: address is refused", "url_bad" in ids_of(o["jsUrl"]) and sev(o["jsUrl"], "url_bad") == "error", str(o["jsUrl"]))
    ck("A6 a plain http address is a warning", sev(o["httpUrl"], "url_http") == "warn", str(o["httpUrl"]))
    ck("A7 an https address is clean", o["goodUrl"] == [], str(o["goodUrl"]))
    ck("A8 an anchor must start with #", "anchor_bad" in ids_of(o["anchorBad"]) and o["anchorOk"] == [], f'{o["anchorBad"]} / {o["anchorOk"]}')
    ck("A9 an empty label is an error", "label_empty" in ids_of(o["noLabel"]) and sev(o["noLabel"], "label_empty") == "error", str(o["noLabel"]))
    ck("A10 the same target twice is a warning", sev(o["dup"], "dup_target") == "warn", str(o["dup"]))
    ck("A11 children of a hidden item are flagged", "hidden_parent" in ids_of(o["hiddenParent"]), str(o["hiddenParent"]))
    ck("A12 a mega menu with no columns is a warning", sev(o["megaNoCols"], "mega_empty") == "warn", str(o["megaNoCols"]))
    ck("A13 more than four columns is an error", sev(o["megaTooMany"], "mega_cols") == "error", str(o["megaTooMany"]))
    ck("A14 an empty menu is a warning", sev(o["empty"], "empty") == "warn", str(o["empty"]))
    ck("A15 the depth cap refuses a fourth level", o["depthCapHolds"] and o["depth3"] == 3, f'{o["depthCapHolds"]} {o["depth3"]}')
    ck("A16 moving an item swaps it with its sibling", o["moved"] == "b,a", o["moved"])
    ck("A17 moving the first item up changes nothing", o["moveEdge"] == "a", o["moveEdge"])
    ck("A18 removing an item removes its subtree too", o["removed"] == 1, str(o["removed"]))
    ck("A19 the seed has two menus, the primary and the footer", o["seedCount"] == 2)
    ck("A20 the seed warns about the draft France link and the Study Abroad duplicate, nothing else", sorted(o["seedWarnings"]) == ["dup_target", "page_draft"], str(o["seedWarnings"]))
    ck("A21 the seed has no errors", o["seedErrors"] == 0, str(o["seedErrors"]))
    ck("A22 Save refuses a menu with an error", o["saveBad"] == "E_VALID", str(o["saveBad"]))
    ck("A23 a stale revision is refused as a conflict", o["conflict"] == "E_CONFLICT", str(o["conflict"]))
    ck("A24 a clean save bumps the revision", o["savedRev"] == 2, str(o["savedRev"]))
    ck("A25 saving the same revision twice is refused", o["staleSave"] == "E_CONFLICT", str(o["staleSave"]))
    ck("A26 a duplicate menu name is refused", o["dupName"] == "E_VALID", str(o["dupName"]))
    ck("A27 a created menu can be deleted", o["removedCustom"] == "gone", str(o["removedCustom"]))
    ck("A28 applying writes the four visible top-level labels to the header", o.get("applyWritten") == 4, str(o.get("applyWritten")))
    ck("A29 applying says what the header cannot show", any("dropdowns" in x or "mega" in x for x in o.get("applyOmitted", [])), str(o.get("applyOmitted")))
    ck("A30 apply marks the menu as applied", o["afterApply"] == "applied", o["afterApply"])

def ids_of(issues): return [i["id"] for i in issues]
def sev(issues, id_): return next((i["severity"] for i in issues if i["id"] == id_), None)

async def ui():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 950})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1600)

        ck("U1 the Menus screen renders", await pg.locator(".m8-wrap").count() == 1)
        ck("U2 the menu list shows both menus", await pg.locator(".m8-menu").count() == 2)
        ck("U3 the primary menu opens first", "Primary navigation" in await pg.locator(".m8-name").input_value())
        ck("U4 the seed draft shows a warning for the draft link", await pg.locator(".m8-issues li.is-warn").count() >= 1)
        ck("U5 a clean menu has Save disabled", await pg.get_by_role("button", name="Save", exact=True).is_disabled())

        # editing
        before = await pg.locator(".m8-row").count()
        await pg.get_by_role("button", name="Add top link").click(); await pg.wait_for_timeout(250)
        ck("U6 Add top link adds a row", await pg.locator(".m8-row").count() == before + 1)
        ck("U7 a new row takes focus", (await pg.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')") or "").startswith("Label for"))
        ck("U8 the new row is unsaved", "Unsaved changes" in await pg.locator(".m8-state").inner_text())
        ck("U9 a new link with a valid default page leaves Save enabled", not await pg.get_by_role("button", name="Save", exact=True).is_disabled())

        # a broken address blocks Save
        LAST = ".m8-rows.d0 > li.m8-row-wrap:last-child > .m8-row"
        await pg.locator(LAST + " select.m8-kind").select_option("url"); await pg.wait_for_timeout(200)
        ck("U10 an empty web address blocks Save", await pg.get_by_role("button", name="Save", exact=True).is_disabled())
        ck("U11 the banner names the blocking problem", "block saving" in await pg.locator(".m8-banner").first.inner_text())
        await pg.locator(LAST + " input.m8-target-in").fill("javascript:alert(1)"); await pg.wait_for_timeout(200)
        ck("U12 a javascript: address is refused by the editor", await pg.get_by_role("button", name="Save", exact=True).is_disabled())
        ck("U13 the row names the refused address", "not a valid address" in await pg.locator(".m8-issues").inner_text())
        await pg.locator(LAST + " input.m8-target-in").fill("https://apply.example.com/start"); await pg.wait_for_timeout(200)
        ck("U14 a valid https address unblocks Save", not await pg.get_by_role("button", name="Save", exact=True).is_disabled())

        await pg.get_by_role("button", name="Discard").click(); await pg.wait_for_timeout(250)
        ck("U15 Discard restores the saved menu", await pg.locator(".m8-row").count() == before)
        ck("U16 Discard clears the unsaved state", "Saved" in await pg.locator(".m8-state").inner_text())

        # tree controls
        await pg.get_by_role("button", name="Add a link under Scholarships").click(); await pg.wait_for_timeout(250)
        ck("U17 Add a link under adds a child row", await pg.locator(".m8-rows.d1 .m8-row").count() >= 1)
        ck("U18 a depth-2 row cannot take a fourth level", await pg.locator(".m8-rows.d2 .m8-acts button[aria-label^='Add a link under']").count() >= 1 and await pg.locator(".m8-rows.d2 .m8-acts button[aria-label^='Add a link under']:not([disabled])").count() == 0)
        ck("U19 the mega toggle appears on top-level rows only", await pg.locator(".m8-rows.d1 .m8-mega").count() == 0 and await pg.locator(".m8-mega").count() >= 1)
        await pg.get_by_role("button", name="Discard").click(); await pg.wait_for_timeout(250)

        await pg.get_by_role("button", name="Move Contact Us up").click(); await pg.wait_for_timeout(200)
        order = await pg.locator(".m8-rows.d0 > li > .m8-row .m8-label").evaluate_all("els => els.map(e => e.value)")
        ck("U20 moving Contact Us up puts it before Scholarships", order[-2:] == ["Contact Us", "Scholarships"], str(order))
        await pg.get_by_role("button", name="Discard").click(); await pg.wait_for_timeout(250)

        await pg.get_by_role("button", name="Remove Scholarships").click(); await pg.wait_for_timeout(200)
        ck("U21 Remove deletes the link", await pg.locator(".m8-row").count() == before - 1)
        await pg.get_by_role("button", name="Discard").click(); await pg.wait_for_timeout(250)

        # link checks → focus
        await pg.get_by_role("button", name="Show").first.click(); await pg.wait_for_timeout(300)
        ck("U22 Show brings the flagged row into view and focuses it", await pg.evaluate("!!document.querySelector('.m8-row[data-focus=\"1\"]')"))

        # mobile output and preview
        await pg.get_by_label("Mobile behaviour").select_option("accordion"); await pg.wait_for_timeout(200)
        ck("U23 the mobile preview follows the behaviour", "Mobile · accordion" in await pg.locator(".m8-prev-mobile").inner_text())
        await pg.get_by_role("button", name="Study Abroad", exact=True).first.click(); await pg.wait_for_timeout(200)
        ck("U24 a mega item opens its panel in the preview", await pg.locator(".m8-prev-panel.is-mega").count() == 1)
        await pg.get_by_label("Mobile behaviour").select_option("drawer"); await pg.wait_for_timeout(150)
        ck("U24b switching the mobile behaviour back leaves no unsaved change", await pg.get_by_role("button", name="Discard").is_disabled())

        # save an edit, then apply the header
        await pg.get_by_label("Label for Home").fill("Home page"); await pg.wait_for_timeout(200)
        await pg.get_by_role("button", name="Save", exact=True).click(); await pg.wait_for_timeout(900)
        ck("U25 a clean edit saves and bumps the revision", "revision 2" in await pg.locator(".m8-state").inner_text(), await pg.locator(".m8-state").inner_text())
        ck("U26 Apply shows the header target and what is live now", "Global Header" in await pg.locator(".m8-target").first.inner_text())
        ck("U27 the header target reports a difference before apply", "Differs from this menu" in await pg.locator(".m8-target").first.inner_text())
        apply_btn = pg.locator(".m8-target").first.get_by_role("button", name="Apply")
        await apply_btn.click()
        try:
            await pg.wait_for_function("(document.querySelector('.m8-target') || {innerText:''}).innerText.includes('In sync with this menu')", timeout=6000)
        except Exception:
            pass
        ck("U28 after apply the header is in sync", "In sync with this menu" in await pg.locator(".m8-target").first.inner_text())
        toasts = await pg.locator(".toast").all_inner_texts()
        ck("U29 the apply toast says what was left out", any("Left out" in t and "applied to" in t for t in toasts), " | ".join(toasts)[:200])
        ck("U30 the applied menu cannot be deleted", await pg.locator(".m8-danger button").first.is_disabled())

        # create and delete a custom menu
        await pg.get_by_role("button", name="New menu").first.click(); await pg.wait_for_timeout(300)
        await pg.get_by_label("Menu name").fill("QA sidebar"); await pg.wait_for_timeout(100)
        await pg.get_by_role("button", name="Create menu").click(); await pg.wait_for_timeout(700)
        ck("U31 creating a menu selects it", "QA sidebar" in await pg.locator(".m8-name").input_value())
        await pg.locator(".m8-danger button").first.click(); await pg.wait_for_timeout(600)
        try:
            await pg.wait_for_function("document.querySelectorAll('.m8-menu').length === 2", timeout=5000)
        except Exception:
            pass
        n32 = await pg.locator(".m8-menu").count()
        ck("U32 a custom menu can be deleted", n32 == 2, f"menus={n32} name={await pg.locator('.m8-name').input_value()}")

        # the Layouts link still works
        await pg.get_by_role("button", name="Open in Layouts").first.click(); await pg.wait_for_timeout(900)
        ck("U33 Open in Layouts reaches Module 7", "#/layouts" in pg.url, pg.url)

        # ---------------- S · prototype states, from the states menu ----------------
        await pg.evaluate("location.hash = '#/menus'"); await pg.wait_for_timeout(900)
        async def state(label):
            await pg.get_by_role("button", name="Prototype states").click(); await pg.wait_for_timeout(200)
            await pg.get_by_role("menuitem", name=label).click(); await pg.wait_for_timeout(250)

        await state("Error / service down"); await pg.wait_for_timeout(900)
        ck("S1 the error state says the menus did not load, with a retry", await pg.get_by_text("Menus did not load").count() == 1 and await pg.get_by_role("button", name="Try again").count() == 1)

        await state("Empty (no data in range)"); await pg.wait_for_timeout(900)
        ck("S2 the empty state offers the first menu", await pg.get_by_text("No menus yet").count() == 1 and await pg.get_by_role("button", name="New menu").count() >= 1)

        await state("Loading skeletons"); await pg.wait_for_timeout(120)
        ck("S3 the loading state is shown while data arrives", await pg.locator(".m8-wrap[aria-busy='true']").count() == 1)
        await pg.wait_for_timeout(2200)

        await state("Default"); await pg.wait_for_timeout(900)
        ck("S4 default returns the two seeded menus", await pg.locator(".m8-menu").count() == 2)

        await pg.get_by_label("Label for Home page").fill("Home (conflict test)"); await pg.wait_for_timeout(150)
        await state("Publish conflict"); await pg.wait_for_timeout(300)
        await pg.get_by_role("button", name="Save", exact=True).click(); await pg.wait_for_timeout(900)
        ck("S5 a save that loses the race shows the conflict with the draft kept", await pg.locator(".m8-banner[role='alert']").count() == 1 and "Home (conflict test)" in await pg.get_by_label("Label for Home (conflict test)").input_value())
        await pg.get_by_role("button", name="Reload theirs").click(); await pg.wait_for_timeout(900)
        ck("S6 Reload theirs discards the draft and clears the banner", await pg.locator(".m8-banner[role='alert']").count() == 0 and await pg.get_by_label("Label for Home page").count() == 1)

        await state("Permission denied (Viewer)"); await pg.wait_for_timeout(900)
        ck("S7 a denied role sees the read-only banner", await pg.locator(".m8-banner.is-info").count() == 1)
        ck("S8 the editor fields are disabled for a denied role", await pg.evaluate("(() => { const f = document.querySelector('.m8-fs'); return !!f && f.disabled; })()"))
        ck("S9 the menu list stays selectable for a denied role", await pg.locator(".m8-menu").first.is_enabled())
        await state("Default"); await pg.wait_for_timeout(900)
        ck("S10 default returns the editor to normal", await pg.evaluate("(() => { const f = document.querySelector('.m8-fs'); return !!f && !f.disabled; })()"))

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

async def main():
    unit()
    await ui()
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m8_menus · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
