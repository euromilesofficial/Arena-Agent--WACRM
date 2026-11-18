#!/usr/bin/env python3
"""Module 7 — batch import: a ZIP of HTML files.

Z  unit (Node, the real reader in src/lib/zip-import.ts):
   stored and deflate entries, directories and metadata skipped, non-HTML skipped,
   zip-slip names refused, encrypted entries refused, damaged and non-ZIP input refused,
   archive size limit enforced
U  UI: upload a ZIP in the Import dialog → one report for every file, a skipped list with
   reasons, Import N templates lands them, and no script in any file ever runs
"""
import asyncio, io, json, os, struct, subprocess, sys, tempfile, zipfile
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

HTML_A = "<section><h1>Study abroad guide</h1><p>Plan your admission in six steps.</p></section>"
HTML_B = "<section><h2>Visa help</h2><script>window.__pwned_zip = 1</script><p>Documents, interviews and timelines.</p></section>"
HTML_C = "<section><h1>Scholarships</h1><p>We shortlist the ones you qualify for.</p></section>"

def build(tmp):
    d = {}
    p = os.path.join(tmp, "batch.zip")
    with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("guide.html", HTML_A)
        z.writestr("visa.html", HTML_B)
        z.writestr("pages/scholar.htm", HTML_C)
        z.writestr("notes.txt", "not a page")
        z.writestr("__MACOSX/._guide.html", "metadata")
        z.writestr("../evil.html", "<h1>escape</h1>")
    d["batch"] = p

    p = os.path.join(tmp, "stored.zip")
    with zipfile.ZipFile(p, "w", zipfile.ZIP_STORED) as z:
        z.writestr("only.html", HTML_A)
    d["stored"] = p

    # encrypted: flip the general-purpose "encrypted" bit on one entry (no decryption is attempted)
    p = os.path.join(tmp, "enc.zip")
    with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("locked.html", HTML_A)
        z.writestr("open.html", HTML_C)
    raw = bytearray(open(p, "rb").read())
    i = raw.find(b"PK\x03\x04"); raw[i + 6] |= 1
    c = raw.find(b"PK\x01\x02"); raw[c + 8] |= 1
    open(p, "wb").write(raw)
    d["enc"] = p

    p = os.path.join(tmp, "notzip.zip"); open(p, "wb").write(b"hello, this is not an archive" * 10)
    d["notzip"] = p

    p = os.path.join(tmp, "big.zip"); open(p, "wb").write(b"\0" * 2_100_000)
    d["big"] = p
    return d

NODE_JS = r"""
const fs = require('fs');
const z = require(process.argv[2]);
(async () => {
  const out = {};
  for (const [k, path] of Object.entries(JSON.parse(process.argv[3]))) {
    const buf = fs.readFileSync(path);
    try {
      const r = await z.readZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      out[k] = { files: r.files.map(f => ({ name: f.name, text: Buffer.from(f.bytes).toString('utf8') })), skipped: r.skipped };
    } catch (e) { out[k] = { error: String(e.message || e) }; }
  }
  console.log(JSON.stringify(out));
})();
"""

def unit(files):
    tmp = tempfile.mkdtemp()
    bundle = os.path.join(tmp, "zip.cjs")
    r = subprocess.run(["npx", "esbuild", "src/lib/zip-import.ts", "--bundle", "--format=cjs", f"--outfile={bundle}", "--log-level=error"],
                       cwd=APP, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        ck("Z0 the reader bundles", False, r.stderr[:200]); return
    js = os.path.join(tmp, "t.cjs"); open(js, "w").write(NODE_JS)
    r = subprocess.run(["node", js, bundle, json.dumps(files)], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        ck("Z0 the reader runs in Node", False, r.stderr[:300]); return
    o = json.loads(r.stdout)

    b = o["batch"]
    names = sorted(f["name"] for f in b.get("files", []))
    ck("Z1 every HTML file is read from a deflate archive", names == ["guide.html", "scholar.htm", "visa.html"], str(names))
    ck("Z2 file contents come through intact", any(f["name"] == "guide.html" and "Study abroad guide" in f["text"] for f in b.get("files", [])))
    skipped = {s["name"]: s["reason"] for s in b.get("skipped", [])}
    ck("Z3 a path that climbs out of the archive is refused", "evil.html" not in names and any("climbs out" in r for r in skipped.values()), str(skipped))
    ck("Z4 a non-HTML file is named and skipped", skipped.get("notes.txt") == "not an HTML file", str(skipped))
    ck("Z5 archive metadata is ignored, not reported", not any("._guide" in k for k in skipped))
    ck("Z6 a stored (uncompressed) entry is read", [f["name"] for f in o["stored"].get("files", [])] == ["only.html"], str(o["stored"]))
    enc = o["enc"]
    ck("Z7 an encrypted entry is refused with a reason", any(s["reason"].startswith("encrypted") for s in enc.get("skipped", [])), str(enc.get("skipped")))
    ck("Z8 the unencrypted sibling in the same archive is still read", [f["name"] for f in enc.get("files", [])] == ["open.html"], str(enc.get("files")))
    ck("Z9 a file that is not an archive is refused", "not a ZIP archive" in o["notzip"].get("error", ""), str(o["notzip"]))
    ck("Z10 an archive over the size limit is refused before parsing", "limit is 2 MB" in o["big"].get("error", ""), str(o["big"]))

async def ui(files):
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        await pg.goto(URL + "#/layouts"); await pg.reload(); await pg.wait_for_timeout(1500)

        async def open_import():
            await pg.get_by_role("button", name="Import", exact=True).click()
            await pg.wait_for_selector(".m7-imp-tabs", timeout=5000)

        await open_import()
        ck("U1 the import dialog offers a ZIP tab", await pg.locator(".m7-imp-tabs button:has-text('ZIP of HTML')").count() == 1)
        await pg.locator(".m7-imp-tabs button:has-text('ZIP of HTML')").click(); await pg.wait_for_timeout(200)
        ck("U2 the ZIP tab accepts .zip files", "zip" in (await pg.locator(".m7-file").get_attribute("accept") or ""))

        await pg.locator(".m7-file").set_input_files(files["batch"]); await pg.wait_for_timeout(700)
        stats = await pg.locator(".m7-imp-stats").text_content() if await pg.locator(".m7-imp-stats").count() else ""
        files_n = await pg.evaluate("() => { const d = [...document.querySelectorAll('.m7-imp-stats > div')].find(e => /html files/i.test(e.innerText)); return d ? d.querySelector('b').innerText : null; }")
        ck("U3 one report covers all three HTML files", files_n == "3", f"stats={stats!r} files={files_n!r}")
        notes = await pg.locator(".m7-imp-notes").text_content() if await pg.locator(".m7-imp-notes").count() else ""
        ck("U4 skipped entries are named with their reason", "notes.txt" in notes and "not an HTML file" in notes and "climbs out" in notes, notes[:200])
        ck("U5 the save button names the batch", await pg.locator(".modal-foot .btn-primary").first.inner_text() == "Import 3 templates",
           await pg.locator(".modal-foot .btn-primary").first.inner_text())

        before = int((await pg.locator(".m7-lib-tabs button:nth-child(2)").inner_text()).split()[2])
        await pg.get_by_role("button", name="Import 3 templates").click()
        await pg.wait_for_timeout(1200)
        after = int((await pg.locator(".m7-lib-tabs button:nth-child(2)").inner_text()).split()[2])
        ck("U6 all three templates land in the workspace", after == before + 3, f"{before} -> {after}")
        ran = await pg.evaluate("typeof window.__pwned_zip")
        ck("U7 no script inside any uploaded file ran", ran == "undefined", ran)

        await open_import()
        await pg.locator(".m7-imp-tabs button:has-text('ZIP of HTML')").click(); await pg.wait_for_timeout(200)
        await pg.locator(".m7-file").set_input_files(files["notzip"]); await pg.wait_for_timeout(500)
        err = await pg.locator(".m7-imp-error").inner_text() if await pg.locator(".m7-imp-error").count() else ""
        ck("U8 a corrupt ZIP is refused with a plain reason", "not a ZIP archive" in err, err[:120])
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(250)

        await open_import()
        await pg.locator(".m7-imp-tabs button:has-text('ZIP of HTML')").click(); await pg.wait_for_timeout(200)
        await pg.locator(".m7-file").set_input_files(files["enc"]); await pg.wait_for_timeout(600)
        notes2 = await pg.locator(".m7-imp-notes").text_content() if await pg.locator(".m7-imp-notes").count() else ""
        ck("U9 an encrypted entry is listed as dropped, the rest still imports", "locked.html" in notes2 and "encrypted" in notes2 and "Save as template" in await pg.locator(".modal-foot").inner_text(), notes2[:160])
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(250)

        ck("Z-ui no console or page errors", not errs, "; ".join(errs[:3]))
        await br.close()

async def main():
    tmp = tempfile.mkdtemp()
    files = build(tmp)
    unit(files)
    await ui(files)
    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_m7_zip · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
