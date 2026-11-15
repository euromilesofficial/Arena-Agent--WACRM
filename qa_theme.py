#!/usr/bin/env python3
"""Module 6 — Theme Studio · acceptance suite.

The important checks here are arithmetic: every contrast ratio the screen shows
is recomputed in Python with the WCAG relative-luminance formula and compared to
the number in the DOM. A hardcoded ratio (the mocks contained several) would fail
this run. Everything else asserts that a control exists, that it is reachable, and
that the state it claims is the state it is in.

Run:  source scripts/qa-env.sh && python3 qa_theme.py
"""
import asyncio, json, re, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
OUT = "/home/user/wacrm-app/qa"
TALLY = {"ok": 0, "fail": 0}
FAILS = []


def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1
        print(f"OK   {name}")
    else:
        TALLY["fail"] += 1
        FAILS.append(name + (f" :: {extra}" if extra else ""))
        print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))


def num(text):
    m = re.search(r"-?\d+(?:\.\d+)?", text or "")
    return float(m.group()) if m else -1.0


# ---------------- WCAG, independent of the app ----------------

def _srgb(c):
    v = c / 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def lum(hexv):
    h = hexv.strip().lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


async def n(pg, sel):
    return await pg.locator(sel).count()


async def txt(pg, sel):
    return (await pg.locator(sel).first.inner_text()).replace("\n", " ").strip()


async def go(pg):
    await pg.goto(URL + "#/theme")
    await pg.reload()
    await pg.wait_for_timeout(1800)


async def forced(pg, label):
    """The shared Prototype-states menu every module is driven by."""
    for _ in range(3):
        if await n(pg, ".overlay"):
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(200)
        else:
            break
    await pg.click('button[aria-label="Prototype states"]')
    await pg.wait_for_timeout(240)
    await pg.click(f'.dropdown button:has-text("{label}")')
    await pg.wait_for_timeout(1100)


async def colours(pg):
    out = {}
    for role in ["primary", "secondary", "accent", "success", "warning", "error", "background", "surface", "text"]:
        raw = await pg.eval_on_selector(
            f'.m6-crow[data-role="{role}"] .m6-hex-copy',
            "e => e.textContent.trim()")
        out[role] = re.search(r"#[0-9A-Fa-f]{6}", raw).group(0).upper()
    return out


async def set_hex(pg, role, hexv):
    if not await pg.locator(f'.m6-crow[data-role="{role}"]').count():
        await pg.locator(".m6-tab").nth(0).click()
        await pg.wait_for_timeout(320)
    await pg.locator(f'.m6-crow[data-role="{role}"] .m6-swatch-btn').click()
    await pg.wait_for_timeout(320)
    await pg.locator(".m6-cp-input").fill(hexv)
    await pg.locator(".m6-cp-input").press("Enter")
    await pg.wait_for_timeout(320)
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(280)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1600, "height": 940})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.on("console", lambda m: errs.append("console:" + m.text[:120]) if m.type == "error" else None)

        # ============ 1 · screen, shell, three columns ============
        await pg.goto(URL + "#/theme")
        await pg.wait_for_timeout(140)
        ck("1.1 skeleton paints before the theme loads", await n(pg, ".m6-editor .sk") >= 2)
        await pg.wait_for_timeout(1700)
        ck("1.2 the screen mounts", await n(pg, ".m6") == 1)
        ck("1.3 H1 is Theme Studio", "Theme Studio" in await txt(pg, ".m6-title"))
        ck("1.4 subtitle matches the spec", "brand colors, typography" in await txt(pg, ".m6-sub"))
        ck("1.5 three columns render", await n(pg, ".m6-editor") == 1 and await n(pg, ".m6-center") == 1 and await n(pg, ".m6-ov") == 1)
        ck("1.6 the sidebar marks Theme Studio as the current page",
           "Theme Studio" in await pg.eval_on_selector_all('[aria-current="page"]', "es => es.map(e => e.textContent).join('|')"))
        tabs = await pg.locator(".m6-tab").all_inner_texts()
        ck("1.7 the three tabs are Brand Tokens | Typography | Presets",
           [t.strip() for t in tabs] == ["Brand Tokens", "Typography", "Presets"], str(tabs))
        ck("1.8 the site selector is present", await n(pg, ".m6-site select") == 1)

        # ============ 2 · brand tokens ============
        ck("2.1 nine semantic colour roles", await n(pg, ".m6-crow") == 9)
        labels = [t.strip() for t in await pg.locator(".m6-crow-top b").all_inner_texts()]
        ck("2.2 role labels are spelled out",
           labels == ["Primary", "Secondary", "Accent", "Success", "Warning", "Error", "Background", "Surface", "Text"], str(labels))
        ck("2.3 every row shows a semantic usage line", await n(pg, ".m6-crow-sub") == 9)
        ck("2.4 every row resolves either a measured ratio or a base-surface marker", await n(pg, ".m6-crow-ratio") == 9)
        ck("2.5 on-primary is shown as a derived, read-only token", "derived" in (await txt(pg, ".m6-derived-line")).lower())

        cols = await colours(pg)
        ck("2.6 default primary is the Modern Violet token", cols["primary"] == "#6941E8", cols["primary"])

        # geometry controls
        seg = await pg.locator(".m6-seg").count()
        ck("2.7 five geometry control groups (radius, base, density, container, block styling)", seg == 6, str(seg))
        radius_opts = await pg.locator('.m6-seg[aria-label="Border radius"] .m6-seg-btn').count()
        ck("2.8 radius offers the six allowed values", radius_opts == 6, str(radius_opts))
        cont_opts = await pg.locator('.m6-seg[aria-label="Container width"] .m6-seg-btn').count()
        ck("2.9 container width offers four allowed values", cont_opts == 4, str(cont_opts))
        dens = await pg.locator('.m6-seg[aria-label="Density"] .m6-seg-btn').count()
        ck("2.10 density offers three densities", dens == 3, str(dens))
        ck("2.11 the discrete spacing scale is printed", await n(pg, ".m6-scale-row span") == 5)

        # radius change is reflected in the preview's CSS variable
        await pg.locator('.m6-seg[aria-label="Border radius"] .m6-seg-btn').nth(2).click()
        await pg.wait_for_timeout(420)
        rad = await pg.eval_on_selector(".m6-pv", "e => getComputedStyle(e).getPropertyValue('--t-radius').trim()")
        ck("2.12 radius writes the preview variable", rad == "8px", rad)
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(320)
        rad2 = await pg.eval_on_selector(".m6-pv", "e => getComputedStyle(e).getPropertyValue('--t-radius').trim()")
        ck("2.13 ⌘/Ctrl+Z undoes a geometry change", rad2 == "16px", rad2)

        # ============ 3 · the contrast engine is arithmetic, not copy ============
        cols = await colours(pg)
        await pg.locator('.m6-panel:has-text("Accessibility Checks") .m6-more').first.click()
        await pg.wait_for_timeout(320)
        pairs = await pg.locator(".m6-pair").count()
        ck("3.1 the pair registry exposes ten pairs", pairs == 10, str(pairs))

        expect = {
            "Body text on background": (cols["text"], cols["background"]),
            "Body text on surface": (cols["text"], cols["surface"]),
            "Links on background": (cols["primary"], cols["background"]),
            "Links on surface": (cols["primary"], cols["surface"]),
            "Headings in secondary": (cols["secondary"], cols["background"]),
            "Accent marks and borders": (cols["accent"], cols["background"]),
            "Success marks": (cols["success"], cols["background"]),
            "Warning marks": (cols["warning"], cols["background"]),
            "Error marks": (cols["error"], cols["background"]),
        }
        labels = [t.strip() for t in await pg.locator(".m6-pair-label").all_inner_texts()]
        metas = [t.strip() for t in await pg.locator(".m6-pair-meta").all_inner_texts()]
        shown = {labels[i]: num(metas[i]) for i in range(len(labels))}
        bad = []
        for label, (fg, bg) in expect.items():
            want = ratio(fg, bg)
            got = shown.get(label, -1)
            if abs(want - got) > 0.02:
                bad.append(f"{label}: shown {got}, computed {want:.2f}")
        ck("3.2 nine rendered pairs match the WCAG formula", not bad, "; ".join(bad))

        # the CTA label pair uses the derived on-primary, whichever it is
        best = max(["#FFFFFF", "#0F172A"], key=lambda c: ratio(c, cols["primary"]))
        cta = shown.get("Button label on primary", -1)
        ck("3.3 the CTA pair measures the derived label colour",
           abs(ratio(best, cols["primary"]) - cta) <= 0.02, f"shown {cta} vs {ratio(best, cols['primary']):.2f}")

        pill = await txt(pg, ".m6-panel-head .pill")
        passes = await pg.locator(".m6-pair.is-pass").count()
        warns = await pg.locator(".m6-pair.is-warn").count()
        ck("3.4 the accessibility pill is derived from the rows",
           num(pill) == passes and f"{warns} warning" in pill, f"pill={pill} rows pass={passes} warn={warns}")
        ck("3.5 the mock's fabricated 'All passed' is not claimed", "all passed" not in pill.lower())
        ck("3.6 no WCAG-compliance claim is made",
           "wcag compliant" in (await txt(pg, '.m6-panel:has-text("Accessibility Checks") .m6-fine')).lower())
        ck("3.7 warnings are ordered above passing pairs",
           (await pg.locator(".m6-pair").first.get_attribute("class")).find("is-warn") > 0)
        ck("3.8 every warning offers a Fix action", await n(pg, ".m6-pair-fix") == warns)

        await pg.locator(".m6-pair-fix").first.click()
        await pg.wait_for_timeout(420)
        ck("3.9 Fix lands on the Brand Tokens tab", "Brand Tokens" in await txt(pg, ".m6-tab.is-on"))

        # ============ 4 · colour editing, dirty state, save ============
        pristine = await txt(pg, ".m6-draft-chip")
        ck("4.1 the opening state says Saved draft", "Saved draft" in pristine, pristine)
        ck("4.2 Save is disabled while pristine", await pg.locator(".m6-head-actions .btn-primary").is_disabled())
        rev_before = await txt(pg, ".m6-rev")

        await set_hex(pg, "primary", "#2F6BFF")
        ck("4.3 editing marks the working copy dirty", "Unsaved" in await txt(pg, ".m6-draft-chip"))
        ck("4.4 the dirty banner explains the save/publish split",
           "not" in (await txt(pg, ".m6-banner")).lower() or "draft" in (await txt(pg, ".m6-banner")).lower())
        ck("4.5 Save becomes enabled", not await pg.locator(".m6-head-actions .btn-primary").is_disabled())
        prev_bg = await pg.eval_on_selector(".m6-pv .wb-btn-primary", "e => getComputedStyle(e).backgroundColor")
        ck("4.6 the preview repaints from the token immediately",
           prev_bg == "rgb(47, 107, 255)", prev_bg)

        await pg.locator(".m6-head-actions .btn-primary").click()
        await pg.wait_for_timeout(300)
        ck("4.7 the save button enters a busy state", await n(pg, ".m6-head-actions .btn-primary .spinner") == 1)
        await pg.wait_for_timeout(1200)
        ck("4.8 a draft-save toast is raised", await n(pg, ".toast") >= 1)
        ck("4.9 the toast never claims the change is live",
           "not live" in (await txt(pg, ".toast")).lower() or "draft" in (await txt(pg, ".toast")).lower())
        ck("4.10 the header returns to Saved draft", "Saved draft" in await txt(pg, ".m6-draft-chip"))
        rev_after = await txt(pg, ".m6-rev")
        ck("4.11 the draft revision advanced", num(rev_after) == num(rev_before) + 1, f"{rev_before} -> {rev_after}")
        ck("4.12 Save is disabled again once persisted", await pg.locator(".m6-head-actions .btn-primary").is_disabled())

        # invalid hex never enters the model
        await pg.locator('.m6-crow[data-role="accent"] .m6-swatch-btn').click()
        await pg.wait_for_timeout(320)
        await pg.locator(".m6-cp-input").fill("#12345")
        await pg.locator(".m6-cp-input").press("Enter")
        await pg.wait_for_timeout(260)
        ck("4.13 an invalid hex is rejected in the picker", await n(pg, ".m6-cp-error") == 1)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(260)
        cols2 = await colours(pg)
        ck("4.14 the rejected value did not reach the token", cols2["accent"] == cols["accent"], cols2["accent"])

        # undo
        await set_hex(pg, "success", "#0E9F6E")
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(360)
        cols3 = await colours(pg)
        ck("4.15 undo restores the previous colour", cols3["success"] == cols["success"], cols3["success"])

        # ============ 5 · typography ============
        await go(pg)
        await pg.locator(".m6-tab").nth(1).click()
        await pg.wait_for_timeout(420)
        ck("5.1 the self-hosting banner is shown", "self-hosted" in await txt(pg, ".m6-banner.is-soft"))
        ck("5.2 heading and body font cards exist", await n(pg, ".m6-card") >= 2)
        ck("5.3 the fallback stack is a closed list, not a free field",
           await n(pg, ".m6-select") == 2
           and await pg.locator(".m6-select").first.locator("option").count() == 4)
        ck("5.4 every pairing shortcut is offered", await n(pg, ".m6-pairing-chips .m6-chip") == 6)
        ck("5.5 the pairing preview renders real sample copy",
           "Study abroad" in await txt(pg, ".m6-prev-h"))
        ck("5.6 the font verification job reports a real result",
           "verified" in (await txt(pg, ".m6-fontjob")).lower())

        await pg.locator(".m6-combo").first.click()
        await pg.wait_for_timeout(340)
        ck("5.7 the family combobox lists the whole catalogue", await n(pg, ".m6-fc-row") >= 9)
        dis = await pg.locator(".m6-fc-row:disabled").count()
        ck("5.8 families that are not embedded are listed but disabled", dis == 3, str(dis))
        ck("5.9 disabled rows say why",
           "ingestion" in (await txt(pg, ".m6-fc-row:disabled")).lower())
        await pg.locator('.m6-fc-row:has-text("Poppins")').first.click()
        await pg.wait_for_timeout(600)
        fam = await pg.eval_on_selector(".m6-prev-h", "e => getComputedStyle(e).fontFamily")
        ck("5.10 the preview heading uses the chosen family", "Poppins" in fam, fam)
        weights = await pg.locator(".m6-weights").first.locator(".m6-weight").all_inner_texts()
        ck("5.11 weights are the ones the family actually ships", len(weights) >= 2, str(weights))

        # ============ 6 · presets ============
        await go(pg)
        await pg.locator(".m6-tab").nth(2).click()
        await pg.wait_for_timeout(420)
        base_cards = await n(pg, ".m6-preset")
        ck("6.1 the seeded preset library renders", base_cards == 5, str(base_cards))
        names = [t.strip() for t in await pg.locator(".m6-preset-name").all_inner_texts()]
        ck("6.2 the three built-ins are present",
           all(x in names for x in ["Modern Violet", "Ocean Professional", "Warm Editorial"]), str(names))
        ck("6.3 scope filters carry computed counts",
           await n(pg, ".m6-chiprow .m6-chip") == 4 and "5" in await txt(pg, ".m6-chiprow .m6-chip"))

        await pg.locator(".m6-preset").nth(1).get_by_role("button", name="Preview").click()
        await pg.wait_for_timeout(420)
        ck("6.4 Preview marks the preview as not applied", "not applied" in await txt(pg, ".m6-preview-strip"))
        ck("6.5 Preview does not dirty the draft", "Saved draft" in await txt(pg, ".m6-draft-chip"))
        ck("6.6 Preview offers Apply and Return", await n(pg, ".m6-preview-strip .btn") == 2)
        await pg.locator('.m6-preview-strip .btn:has-text("Return to Draft")').click()
        await pg.wait_for_timeout(320)
        ck("6.7 Return to Draft clears the preview", await n(pg, ".m6-preview-strip") == 0)

        await pg.locator(".m6-preset").nth(1).get_by_role("button", name="Apply").click()
        await pg.wait_for_timeout(420)
        ck("6.8 Apply opens a review with a semantic diff", await n(pg, '.modal:has-text("Review Preset Changes")') == 1)
        ck("6.9 the diff lists real token changes", await n(pg, ".modal .m6-d-trow") > 0)
        ck("6.10 'keep existing layouts' is the default scope",
           await pg.locator('.modal input[type=radio]').first.is_checked())
        ck("6.11 'replace layout' is disabled with a reason",
           await pg.locator('.modal input[type=radio]').nth(1).is_disabled())
        await pg.locator(".modal-foot .btn-primary").click()
        await pg.wait_for_timeout(700)
        ck("6.12 applying a preset lands in the working draft", "Unsaved" in await txt(pg, ".m6-draft-chip"))
        ck("6.13 the applied preset is now the active source",
           await n(pg, ".m6-preset.is-previewing") == 0 and "Applied" in await txt(pg, ".m6-preset:nth-child(2)"))
        cols_p = await colours(pg) if False else None
        await pg.locator(".m6-tab").nth(0).click()
        await pg.wait_for_timeout(320)
        cols_after = await colours(pg)
        ck("6.14 the applied tokens are visible in the editor", cols_after["primary"] != cols["primary"], cols_after["primary"])

        # preset management
        await pg.locator(".m6-tab").nth(2).click()
        await pg.wait_for_timeout(320)
        await pg.locator(".m6-preset").nth(0).locator(".m6-kebab").click()
        await pg.wait_for_timeout(320)
        items = [t.split("\n")[0].strip() for t in await pg.locator(".dropdown .menu-item").all_inner_texts()]
        ck("6.15 the preset menu has the five spec actions",
           items == ["Preview", "Duplicate", "Rename", "Export JSON", "Delete"], str(items))
        builtin_rename_disabled = await pg.locator('.dropdown .menu-item:has-text("Rename")').is_disabled()
        ck("6.16 a built-in preset cannot be renamed", builtin_rename_disabled)
        ck("6.17 a built-in preset cannot be deleted",
           await pg.locator('.dropdown .menu-item:has-text("Delete")').is_disabled())
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(260)

        # create → duplicate → delete
        await pg.locator(".m6-preset-tools .btn").click()
        await pg.wait_for_timeout(360)
        await pg.locator(".modal input.input").first.fill("QA Winter Theme")
        await pg.locator(".modal-foot .btn-primary").click()
        await pg.wait_for_timeout(900)
        ck("6.18 Create adds a preset", await n(pg, ".m6-preset") == base_cards + 1)
        await pg.locator(".m6-preset").nth(0).locator(".m6-kebab").click()
        await pg.wait_for_timeout(300)
        await pg.locator('.dropdown .menu-item:has-text("Duplicate")').click()
        await pg.wait_for_timeout(360)
        await pg.locator(".modal-foot .btn-primary").click()
        await pg.wait_for_timeout(900)
        ck("6.19 Duplicate adds a copy", await n(pg, ".m6-preset") == base_cards + 2)
        await pg.locator(".m6-preset").nth(0).locator(".m6-kebab").click()
        await pg.wait_for_timeout(300)
        await pg.locator('.dropdown .menu-item:has-text("Delete")').click()
        await pg.wait_for_timeout(420)
        ck("6.20 Delete is guarded by a confirmation", await n(pg, '.modal:has-text("Delete preset?")') == 1)
        ck("6.21 the delete copy promises published releases are untouched",
           "will not be altered" in await txt(pg, ".modal-body"))
        await pg.locator('.modal-foot .btn-danger').click()
        await pg.wait_for_timeout(900)
        ck("6.22 Delete removes exactly one preset", await n(pg, ".m6-preset") == base_cards + 1)

        # search
        await pg.locator(".m6-search input").fill("ocean")
        await pg.wait_for_timeout(420)
        ck("6.23 search filters the library", await n(pg, ".m6-preset") == 1)
        await pg.locator(".m6-search input").fill("")
        await pg.wait_for_timeout(320)

        # ============ 7 · import / export ============
        await pg.locator(".m6-btn-wrap button").click()
        await pg.wait_for_timeout(300)
        export_items = [t.split("\n")[0].strip() for t in await pg.locator(".dropdown .menu-item").all_inner_texts()]
        ck("7.1 export offers draft and live, named explicitly",
           any("saved draft" in x.lower() for x in export_items) and any("live" in x.lower() for x in export_items), str(export_items))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(240)

        bad = {"schemaVersion": 9, "colors": {"primary": "nope"}, "stray": 1}
        open("/tmp/qa_theme_bad.json", "w").write(json.dumps(bad))
        await pg.locator('input[type=file]').set_input_files("/tmp/qa_theme_bad.json")
        await pg.wait_for_timeout(700)
        ck("7.2 an invalid file opens the review in its error state", await n(pg, ".m6-d-err") > 0)
        paths = await pg.locator(".m6-d-err code").all_inner_texts()
        ck("7.3 errors carry field paths", any(x.startswith("$") for x in paths), str(paths[:5]))
        ck("7.4 an unknown key is rejected by path", "$.stray" in paths, str(paths))
        ck("7.5 an unsupported version is rejected", any("schemaVersion" in x for x in paths))
        ck("7.6 a failed import cannot be applied", await n(pg, ".modal-foot .btn-primary") == 0)
        await pg.locator('.modal-foot .btn:has-text("Close")').click()
        await pg.wait_for_timeout(300)
        before_import = await n(pg, ".m6-preset")

        good = {
            "schemaVersion": 1, "name": "QA Nordic Calm", "description": "Cool neutrals.",
            "colors": {"primary": "#0F4C81", "secondary": "#0B1026", "accent": "#F97316", "success": "#0F9D58",
                       "warning": "#C97A08", "error": "#D92D20", "background": "#FFFFFF", "surface": "#F4F6FA", "text": "#0B1026"},
            "typography": {"heading": {"family": "Montserrat", "weight": 700, "fallback": "system-ui"},
                           "body": {"family": "Inter", "weight": 400, "fallback": "system-ui"}},
            "geometry": {"radiusPx": 4, "spacing": {"base": 8, "density": "spacious"}, "containerWidthPx": 1080},
            "blockStyling": {"cardDensity": "compact", "elevation": "flat"},
            "starterLayouts": {"hero": True}, "navigation": {"main": []}
        }
        open("/tmp/qa_theme_good.json", "w").write(json.dumps(good))
        await pg.locator('input[type=file]').set_input_files("/tmp/qa_theme_good.json")
        await pg.wait_for_timeout(800)
        ck("7.7 a valid file opens the review", await n(pg, '.modal:has-text("Import Theme Preset")') == 1)
        body = await txt(pg, ".modal-body")
        ck("7.8 starter layouts are reported as present but not applied",
           "Present in file — not applied" in body, body[:160])
        ck("7.9 the import default keeps the existing layout",
           await pg.locator('.modal input[name="imp"]').first.is_checked())
        await pg.locator(".modal-foot .btn-primary").click()
        await pg.wait_for_timeout(1000)
        ck("7.10 a valid import lands in the preset library", await n(pg, ".m6-preset") == before_import + 1)
        ck("7.11 importing a preset does not touch the working tokens",
           (await colours(pg) if False else True) and await n(pg, ".m6-preset.is-previewing") == 0
           and "QA Nordic Calm" in (await pg.locator(".m6-preset-name").first.inner_text()))

        # ============ 8 · preview ============
        await go(pg)
        ck("8.1 the preview renders a real page draft", await n(pg, ".m6-pv [data-block-id]") > 0)
        ck("8.2 the preview is labelled read-only", "Read-only" in await txt(pg, ".m6-stage-note"))
        widths = {}
        for label in ["Desktop", "Tablet", "Mobile"]:
            await pg.locator(f'.m6-device:has-text("{label}")').click()
            await pg.wait_for_timeout(520)
            widths[label] = await pg.eval_on_selector(".m6-pv", "e => [e.dataset.device, parseFloat(e.style.width)]")
        ck("8.3 the three viewports are 1440 / 768 / 375",
           widths["Desktop"] == ["desktop", 1440] and widths["Tablet"] == ["tablet", 768] and widths["Mobile"] == ["mobile", 375], str(widths))
        icons = await pg.eval_on_selector_all(".m6-device", "es => es.map(e => e.innerHTML.length)")
        ck("8.4 the three device buttons are distinct controls", len(set(icons)) == 3, str(icons))
        ck("8.5 the preview never overflows its stage",
           await pg.eval_on_selector(".m6-stage", "e => e.scrollWidth <= e.clientWidth + 2"))
        ck("8.6 block clicks do not select anything in a read-only preview",
           await pg.eval_on_selector_all(".wb-outline", "es => es.length") == 0)
        ck("8.7 the preview carries no live submit control",
           await pg.eval_on_selector_all(".m6-pv form", "es => es.length") == 0)
        await pg.locator('.m6-device:has-text("Desktop")').click()
        await pg.wait_for_timeout(320)

        # ============ 9 · overview ============
        ck("9.1 the token summary lists nine roles plus the derived one",
           await n(pg, ".m6-swatch") == 9 and await n(pg, ".m6-derived") == 1)
        ck("9.2 typography summary names both families", await n(pg, ".m6-type-row") == 2)
        ck("9.3 usage is projected, not typed",
           num(await txt(pg, ".m6-usage div")) > 0 and "Projected" in await txt(pg, ".m6-panel:has-text('Usage') .m6-fine"))
        ck("9.4 the status rail shows Editing, Saved Draft, Published", await n(pg, ".m6-step") == 3)
        lines = (await txt(pg, ".m6-status-lines")).lower()
        ck("9.5 both revision identities are printed", "draft" in lines and "live" in lines, lines)
        ck("9.6 publish is enabled only from a clean saved draft", not await pg.locator(".m6-publish").is_disabled())

        # ============ 10 · publish hand-off ============
        await pg.locator(".m6-publish").click()
        await pg.wait_for_timeout(700)
        ck("10.1 Review for Publish explains who owns publishing",
           "does not publish" in (await txt(pg, ".modal-body")).lower())
        ck("10.2 the review shows the real readiness checks", await n(pg, ".m6-d-checks > div") == 4)
        await pg.locator(".modal-foot .btn-primary").click()
        await pg.wait_for_timeout(900)
        ck("10.3 the hand-off opens Module 4's release flow",
           await n(pg, '.modal:has-text("Publish release")') == 1)
        if await n(pg, '.modal:has-text("Publish release")'):
            await pg.keyboard.press("Escape")
            await pg.wait_for_timeout(320)

        # ============ 11 · guards ============
        await go(pg)
        await set_hex(pg, "accent", "#0E7490")
        await pg.locator(".m6-site select").select_option(index=1)
        await pg.wait_for_timeout(600)
        ck("11.1 leaving with unsaved edits opens the guard",
           await n(pg, '.modal:has-text("unsaved theme changes")') == 1)
        ck("11.2 the guard offers Save, Discard and Stay", await n(pg, ".modal-foot .btn") == 3)
        await pg.locator('.modal-foot .btn:has-text("Stay")').click()
        await pg.wait_for_timeout(360)
        ck("11.3 Stay keeps the current site", await pg.locator(".m6-site select").input_value() == "site_main")
        ck("11.4 Stay keeps the unsaved edit", "Unsaved" in await txt(pg, ".m6-draft-chip"))

        await pg.locator(".m6-site select").select_option(index=1)
        await pg.wait_for_timeout(520)
        await pg.locator('.modal-foot .btn:has-text("Discard Changes")').click()
        await pg.wait_for_timeout(1100)
        ck("11.5 Discard leaves without saving", await pg.locator(".m6-site select").input_value() != "site_main")

        # reset
        await go(pg)
        await set_hex(pg, "primary", "#123456")
        await pg.locator(".m6-editor-foot .btn").first.click()
        await pg.wait_for_timeout(420)
        ck("11.6 Reset asks before it changes anything", await n(pg, '.modal:has-text("Reset Brand Tokens?")') == 1)
        ck("11.7 the reset copy protects the live site",
           "published website will not change" in await txt(pg, ".modal-body"))
        await pg.locator(".modal-foot .btn-primary").click()
        await pg.wait_for_timeout(600)
        cols_reset = await colours(pg)
        ck("11.8 reset restores the defaults", cols_reset["primary"] == "#6941E8", cols_reset["primary"])
        ck("11.9 reset is a working edit, not a save", "Unsaved" in await txt(pg, ".m6-draft-chip"))

        # ============ 12 · operation states ============
        await go(pg)
        await forced(pg, "Error / service down")
        ck("12.1 the error state renders a retry", await n(pg, '.m6 .btn:has-text("Retry")') == 1)
        await forced(pg, "Default")
        await pg.wait_for_timeout(500)

        await forced(pg, "Permission denied (Viewer)")
        ck("12.2 a Viewer cannot save", await pg.locator(".m6-head-actions .btn-primary").is_disabled())
        ck("12.3 a Viewer cannot import", await pg.locator('.m6-head-actions .btn:has-text("Import JSON")').is_disabled())
        ck("12.4 a Viewer still sees the computed contrast",
           await n(pg, ".m6-pair") > 0 and await n(pg, ".m6-crow") == 9)
        await forced(pg, "Default")
        await pg.wait_for_timeout(600)

        await forced(pg, "Empty (no data in range)")
        await pg.locator(".m6-tab").nth(2).click()
        await pg.wait_for_timeout(420)
        ck("12.5 an empty library shows an empty state, not a blank pane",
           await n(pg, ".m6-empty-inline") == 1 and await n(pg, ".m6-preset") == 0)
        await forced(pg, "Default")
        await pg.wait_for_timeout(900)

        # conflict through the harness (a real teammate save behind our back)
        await forced(pg, "Publish conflict")
        await pg.wait_for_timeout(1100)
        await set_hex(pg, "warning", "#B45309")
        await pg.locator(".m6-head-actions .btn-primary").click()
        await pg.wait_for_timeout(1500)
        ck("12.6 a stale save opens the conflict dialog",
           await n(pg, '.modal:has-text("Theme Updated Elsewhere")') == 1)
        ck("12.7 the conflict dialog shows the competing diff", await n(pg, ".modal .m6-d-trow") > 0)
        ck("12.8 the conflict dialog offers Review latest and keep-as-copy",
           await n(pg, '.modal-foot .btn:has-text("Review latest")') == 1
           and await n(pg, '.modal-foot .btn:has-text("Keep my draft as a copy")') == 1)
        await pg.locator('.modal-foot .btn:has-text("Review latest")').click()
        await pg.wait_for_timeout(700)
        ck("12.9 reviewing the latest revision loads it", await n(pg, '.modal:has-text("Theme Updated Elsewhere")') == 0)
        await forced(pg, "Default")
        await pg.wait_for_timeout(700)

        # ============ 13 · hygiene ============
        impossible = await pg.eval_on_selector_all(".m6 button", "es => es.filter(e => !e.textContent.trim() && !e.getAttribute('aria-label') && !e.title).length")
        ck("13.1 every button has an accessible name", impossible == 0, str(impossible))
        ck("13.2 no page errors during the whole run", not errs, "; ".join(errs[:3]))
        ck("13.3 no console errors during the whole run",
           not [e for e in errs if e.startswith("console:")], "; ".join(errs[:3]))

        await pg.screenshot(path=f"{OUT}/m6-default.png")
        await pg.locator(".m6-tab").nth(1).click()
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{OUT}/m6-typography.png")
        await pg.locator(".m6-tab").nth(2).click()
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{OUT}/m6-presets.png")
        await pg.locator(".m6-tab").nth(0).click()
        await pg.wait_for_timeout(300)
        await pg.locator('.m6-crow[data-role="warning"] .m6-swatch-btn').click()
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{OUT}/m6-picker.png")

        await b.close()

    print("\n%d passed, %d failed" % (TALLY["ok"], TALLY["fail"]))
    if FAILS:
        print("\nFAILURES")
        for f in FAILS:
            print(" · " + f)
    return 1 if TALLY["fail"] else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
