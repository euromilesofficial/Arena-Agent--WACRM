#!/usr/bin/env python3
"""Module 8 — links are real links, and publish checks for labels.

Unit (real code, bundled with esbuild and rendered to HTML):
  L1  a page link resolves to the page's path; a URL to its address; an anchor to itself
  L2  a trashed page or a bad URL resolves to no address (the link renders as text, preflight blocks it)
  L3  the live header renders real <a href> links, and a new-tab link gets target, rel and a screen-reader note
  L4  a javascript: address never reaches the page
  L5  a generic label ("Click here") is a warning
  L6  a label with no letters or numbers is an error
  L7  two links at the same level with the same label are a warning; the same label at another level is fine
  L8  a clear label raises none of these
Browser:
  LB1 the Menu Builder preview shows real links with addresses
  BX  no page errors
"""
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright

ROOT = "/home/user/wacrm-app"
URL = "file:///home/user/wacrm-app/WACRM-CMS.html#/menus"
TALLY = {"ok": 0, "fail": 0}
def ck(name, cond, extra=""):
    if cond: TALLY["ok"] += 1; print(f"OK   {name}")
    else: TALLY["fail"] += 1; print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

def unit():
    os.makedirs("/tmp/qlinks", exist_ok=True)
    r = subprocess.run(["node_modules/.bin/esbuild", "qa_m8_links_entry.tsx", "--bundle", "--platform=node", "--format=cjs",
                        "--outfile=/tmp/qlinks/t.cjs", "--log-level=error", "--loader:.tsx=tsx", "--jsx=automatic"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode: ck("L0 the unit bundle builds", False, r.stderr[:300]); return
    r = subprocess.run(["node", "/tmp/qlinks/t.cjs"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode: ck("L0 the unit bundle runs", False, r.stderr[:300]); return
    o = json.loads(r.stdout.strip().splitlines()[-1])
    ck("L1 page, URL and anchor links resolve", o["href_page"] == "/about" and o["href_url"] == "https://example.com" and o["href_none"] is None, str(o))
    ck("L2 trashed page and bad URL resolve to no address", o["href_trashed"] is None and o["href_badurl"] is None, str(o))
    ck("L3 live header renders real links with new-tab attributes and a screen-reader note",
       o["html_about"] and o["html_docs_target"] and o["html_newtab_note"] and o["html_gone_is_text"], str(o))
    ck("L4 a javascript: address never reaches the page", o["html_no_javascript"])
    ck("L5 a generic label is a warning", o["generic_warn"] == "warn", str(o["generic_warn"]))
    ck("L6 a label with no letters or numbers is an error", o["nowords_error"] == "error", str(o["nowords_error"]))
    ck("L7 duplicate label at one level is a warning; same label at another level is fine", o["samelabel_warn"] == "warn" and o["samelabel_other_level_ok"], str(o))
    ck("L8 a clear label raises none of these", o["good_menu_clean"])

async def browser():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 1000})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto(URL); await pg.reload(); await pg.wait_for_timeout(1500)
        mb = pg.get_by_role("tab", name="Menu Builder")
        if await mb.count(): await mb.first.click(); await pg.wait_for_timeout(300)
        n = await pg.evaluate("() => [...document.querySelectorAll('#m8-preview a[href]')].map(a => a.getAttribute('href')).filter(Boolean).length")
        ck("LB1 the Menu Builder preview shows real links with addresses", n >= 1, f"links={n}")
        ck("BX no page errors", not errs, "; ".join(errs))
        await br.close()

unit()
asyncio.run(browser())
print(f"\nqa_m8_links · {TALLY['ok']}/{TALLY['ok']+TALLY['fail']} assertions passed")
sys.exit(1 if TALLY["fail"] else 0)
