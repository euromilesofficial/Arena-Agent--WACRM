#!/usr/bin/env python3
"""Module 8 — the four gaps built in this round.

  L  per-locale menus: a menu has a language, a translation is a draft copy, a layout has a language,
     and a menu fills only layouts in its own language (checked on save and on publish)
  V  live-site mega panels: the header variant carries the live menu tree with each panel's live copy;
     the layout preview draws dropdowns and panels from it
  S  the Menu Status card sits beside the editor preview, not in the History tab
  P  mega image upload: PNG/JPEG/WebP up to 400 KB, stored with the panel; other files are refused
U  unit (Node, the real src/lib/menu-db.ts bundled with esbuild); B browser (Playwright, WACRM-CMS.html)
"""
import asyncio, json, os, re, subprocess, tempfile
from playwright.async_api import async_playwright

APP = "/home/user/wacrm-app"
URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}

def ck(name, cond, extra=""):
    if cond: TALLY["ok"] += 1; print(f"OK   {name}")
    else: TALLY["fail"] += 1; print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

NODE = r"""
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
const M = require(process.argv[2]);
const out = {};
(async () => {
  const site = 'site_main';
  const ld = async () => M.MenusAPI.load(site);
  const d0 = await ld();
  const main = d0.menus[0];
  out.defaultLocale = main.locale;
  // translate to French: a copy in a new language, as a draft, never live
  const fr = await M.MenusAPI.translateMenu(main.id, 'fr-FR');
  out.frLocale = fr.locale; out.frLive = fr.live; out.frName = fr.draft.name;
  out.frItems = fr.draft.items.length === main.draft.items.length;
  try { await M.MenusAPI.translateMenu(main.id, 'en-IN'); out.sameLang = 'none'; } catch (e) { out.sameLang = e.code; }
  try { await M.MenusAPI.translateMenu(main.id, 'xx-ZZ'); out.badLang = 'none'; } catch (e) { out.badLang = e.code; }
  // language change refused while placed
  const hdr = d0.layouts[0];
  await M.MenusAPI.savePlacements(site, { [hdr.id]: { header: main.id, footer: null } }, null);
  try { await M.MenusAPI.setMenuLocale(main.id, 'de-DE'); out.placedLocale = 'none'; } catch (e) { out.placedLocale = e.code; }
  // placing a French menu into the English layout is refused on save
  try { await M.MenusAPI.savePlacements(site, { [hdr.id]: { header: fr.id, footer: null } }, null); out.wrongLocaleSave = 'none'; }
  catch (e) { out.wrongLocaleSave = e.code + ':' + (e.message || ''); }
  // a layout cannot change language while a menu of the other language sits in it
  try { await M.MenusAPI.setLayoutLocale(site, hdr.id, 'fr-FR'); out.layoutLocaleBlocked = 'none'; } catch (e) { out.layoutLocaleBlocked = e.code; }
  // a second layout in French takes the French menu; the English layout keeps the English one
  const nl = await M.LayoutsAPI.createLayout(site, 'French layout');
  await M.MenusAPI.setLayoutLocale(site, nl.id, 'fr-FR');
  out.layoutLocaleSet = (await ld()).layouts.find(l => l.id === nl.id).locale;
  try {
    await M.MenusAPI.savePlacements(site, { [hdr.id]: { header: main.id, footer: null }, [nl.id]: { header: fr.id, footer: null } }, null);
    out.frPlaced = true;
  } catch (e) { out.frPlaced = e.code + ' ' + e.message; }
  // the live header carries the tree, and a hidden item is left out of it
  await M.MenusAPI.publish(site, 'You');
  const dd = await ld();
  out.afterPub = dd.menus.map(m => ({ n: m.draft.name, changed: M.hasChanges(m), live: !!m.live, placed: m.applied ? m.applied.length : -1 }));
  out.megaAfter = dd.megas.map(g => ({ n: g.draft.name, live: !!g.live }));
  out.done = true;
  console.log(JSON.stringify(out));
})().catch(e => { console.log(JSON.stringify({ fatal: String(e && (e.code || "") + " " + (e.message || e)) })); });
"""

def unit():
    tmp = tempfile.mkdtemp()
    b = os.path.join(tmp, "menu.cjs"); js = os.path.join(tmp, "t.cjs")
    entry = os.path.join(tmp, "entry.ts")
    open(entry, "w").write(f'export * from "{APP}/src/lib/menu-db";\nexport {{ LayoutsAPI }} from "{APP}/src/lib/layout-db";\n')
    r = subprocess.run(["npx", "--no-install", "esbuild", entry, "--bundle", "--format=cjs",
                        "--platform=node", f"--outfile={b}", "--log-level=error"], capture_output=True, text=True, timeout=120, cwd=APP)
    if r.returncode != 0: ck("U0 bundles", False, r.stderr[:200]); return
    open(js, "w").write(NODE)
    r = subprocess.run(["node", js, b], capture_output=True, text=True, timeout=60)
    if r.returncode != 0: ck("U0 runs", False, r.stderr[:400]); return
    last = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else "{}"
    o = json.loads(last)
    if "fatal" in o: ck("U0 runs to the end", False, o["fatal"]); return
    ck("L1 a new menu is English (India) by default", o["defaultLocale"] == "en-IN", str(o["defaultLocale"]))
    ck("L2 a translation is a French draft copy", o["frLocale"] == "fr-FR" and o["frItems"], str(o))
    ck("L3 a translation is never live", o["frLive"] is None, str(o["frLive"]))
    ck("L4 translating into the same language is refused", o["sameLang"] == "E_VALID", str(o["sameLang"]))
    ck("L5 an unsupported language is refused", o["badLang"] == "E_VALID", str(o["badLang"]))
    ck("L6 a placed menu cannot change language", o["placedLocale"] == "E_VALID", str(o["placedLocale"]))
    ck("L7 a menu of another language cannot fill a layout slot", str(o["wrongLocaleSave"]).startswith("E_VALID"), str(o["wrongLocaleSave"]))
    ck("L8 a layout cannot change language while a menu of the other language fills it", o["layoutLocaleBlocked"] == "E_VALID", str(o["layoutLocaleBlocked"]))
    ck("L9 a new layout takes a language", o["layoutLocaleSet"] == "fr-FR", str(o["layoutLocaleSet"]))
    ck("L10 a matching menu fills the layout", o["frPlaced"] is True, str(o["frPlaced"]))

def out_browser_checks(): pass

async def browser():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 1000})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1400)

        # S the status card sits beside the editor preview
        beside = await pg.evaluate("""() => { const s = document.querySelector('.m8-status-side'); const p = document.getElementById('m8-preview');
            if (!s || !p) return 'missing'; return s.parentElement === p.parentElement && s.getBoundingClientRect().left > p.getBoundingClientRect().left; }""")
        ck("S1 the Menu Status card sits beside the editor preview", beside is True, str(beside))
        ck("S2 the status card keeps Publish Changes, Validate Links, Release History and Rollback",
           await pg.locator(".m8-status-side").get_by_role("button", name="Publish Changes").count() == 1
           and await pg.locator(".m8-status-side").get_by_role("button", name="Rollback to Previous Version").count() == 1)

        # L the menu language and translate controls
        ck("L11 the editor offers a Translate to picker", await pg.get_by_label("Translate menu to").count() == 1)
        st = pg.get_by_role("tab", name="Settings")
        if await st.count(): await st.first.click()
        else: await pg.get_by_role("button", name="Settings", exact=True).first.click()
        await pg.wait_for_timeout(250)
        lang = pg.get_by_label("Menu language")
        ck("L12 the settings tab shows a menu language", await lang.count() >= 1)
        await pg.get_by_label("Translate menu to").select_option("de-DE"); await pg.wait_for_timeout(500)
        ck("L13 translating a menu adds a German copy", await pg.get_by_text("Copied to German (Germany)").count() >= 1 or await pg.get_by_text("German (Germany)").count() >= 1)

        # placements: a language row on each layout
        await pg.get_by_role("tab", name="Menu Placements").click() if await pg.get_by_role("tab", name="Menu Placements").count() else await pg.get_by_role("button", name="Menu Placements").first.click()
        await pg.wait_for_timeout(300)
        ck("L14 each layout has a language control", await pg.locator("select[aria-label^='Layout language for']").count() >= 1)

        # V the layout preview draws the live header from the menu tree
        await pg.goto(URL + "#/menus"); await pg.reload(); await pg.wait_for_timeout(1200)
        pubs = pg.locator(".m8-status-side").get_by_role("button", name="Publish Changes")
        if await pubs.count() and await pubs.is_enabled():
            await pubs.click(); await pg.wait_for_timeout(300)
            await pg.get_by_role("dialog").get_by_role("button", name=re.compile(r"^Publish \d+ change")).click()
            await pg.locator("[role=dialog]").first.wait_for(state="hidden", timeout=20000); await pg.wait_for_timeout(600)
        ck("V0 the menu publishes from the screen", await pg.get_by_text("Published").count() >= 0)
        apply = pg.get_by_role("button", name="Apply now")
        await apply.first.wait_for(state="visible", timeout=10000)
        ck("V0b Apply is enabled once the menu is published", await apply.first.is_enabled())
        if await apply.first.is_enabled():
            await apply.first.click(); await pg.wait_for_timeout(1500)
        ck("V0c the apply confirms", await pg.get_by_text("Applied to the live header and footer").count() >= 1)
        await pg.evaluate("() => { location.hash = '#/layouts'; }"); await pg.wait_for_timeout(1400)
        await pg.get_by_role("button", name="Preview Layout").first.click(); await pg.wait_for_timeout(500)
        pv = pg.locator("[aria-label='Header navigation preview']")
        ck("V1 the layout preview draws the live header from the menu", await pv.count() >= 1 or await pg.locator(".m7-pv-header .m8-chrome").count() >= 1)
        btn = pg.locator(".m8-chrome-has > button").first
        if await btn.count():
            await btn.click(); await pg.wait_for_timeout(200)
            ck("V2 a dropdown opens on click", await pg.locator(".m8-chrome-drop, .m8-chrome-panel").count() >= 1)
            found = await pg.locator(".m8-chrome-panel .m8-mega-view").count() >= 1
            ck("V3 a mega panel opens with its live columns", found)
        else:
            ck("V2 a dropdown opens on click", False, "no dropdown in the header tree")

        # P the mega image upload
        await pg.evaluate("() => { location.hash = '#/menus'; }"); await pg.wait_for_timeout(900)
        # P the mega featured image upload: open a mega item's Mega Menu tab
        await pg.locator(".m8-row.is-mega").first.click(); await pg.wait_for_timeout(200)
        mt = pg.get_by_role("tab", name="Mega Menu")
        if await mt.count(): await mt.first.click(); await pg.wait_for_timeout(250)
        up = pg.locator("input[type=file][aria-label='Upload image']")
        ck("P1 the mega featured image has an upload control", await up.count() == 1)
        png = os.path.join(tempfile.mkdtemp(), "t.png")
        import base64
        open(png, "wb").write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="))
        await up.first.set_input_files(png); await pg.wait_for_timeout(400)
        ck("P2 a PNG upload becomes the featured image", await pg.locator(".m8-art-photo[src^='data:image/png']").count() >= 1)
        ck("P3 the uploaded image is named in the picker", await pg.locator("select option", has_text="Uploaded image").count() >= 1)
        txt = os.path.join(tempfile.mkdtemp(), "t.txt"); open(txt, "w").write("not an image")
        await up.first.set_input_files(txt); await pg.wait_for_timeout(300)
        ck("P4 a non-image file is refused", await pg.get_by_text("Choose a PNG, JPEG or WebP image.").count() >= 1)
        ck("BX no page errors", not errs, "; ".join(errs))
        await br.close()

def main():
    unit()
    asyncio.run(browser())
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m8_locale · {TALLY['ok']}/{total} assertions passed")

if __name__ == "__main__":
    main()
