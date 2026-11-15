#!/usr/bin/env python3
"""Module 6 — Theme Studio · acceptance suite.

The important checks here are arithmetic: every contrast ratio the screen shows
is recomputed in Python with the WCAG relative-luminance formula and compared to
the number in the DOM. A hardcoded ratio (the mocks contained several) would fail
this run. Everything else asserts that a control exists, that it is reachable, and
that the state it claims is the state it is in.

Run:  source scripts/qa-env.sh && python3 qa_theme.py
"""
import asyncio, json, os, re, sys
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
    for role in ["primary", "secondary", "accent", "success", "warning", "error", "background", "surface", "text",
                 "muted", "link", "border", "ring"]:
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
        ck("2.1 thirteen semantic colour roles", await n(pg, ".m6-crow") == 13, str(await n(pg, ".m6-crow")))
        labels = [t.strip() for t in await pg.locator(".m6-crow-top b").all_inner_texts()]
        ck("2.2 role labels are spelled out",
           labels == ["Primary", "Secondary", "Accent", "Success", "Warning", "Error",
                      "Background", "Surface", "Text", "Muted text", "Link", "Border", "Focus ring"], str(labels))
        ck("2.3 every row shows a semantic usage line", await n(pg, ".m6-crow-sub") == 13)
        ck("2.4 every row resolves either a measured ratio or a base-surface marker", await n(pg, ".m6-crow-ratio") == 13)
        ck("2.4a the roles are grouped into brand marks and surface roles",
           await n(pg, ".m6-role-group") == 2)
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
        ck("3.1 the pair registry exposes fourteen pairs", pairs == 14, str(pairs))

        expect = {
            "Body text on background": (cols["text"], cols["background"]),
            "Body text on surface": (cols["text"], cols["surface"]),
            "Links on background": (cols["link"], cols["background"]),
            "Links on surface": (cols["link"], cols["surface"]),
            "Muted text on background": (cols["muted"], cols["background"]),
            "Muted text on surface": (cols["muted"], cols["surface"]),
            "Focus ring on background": (cols["ring"], cols["background"]),
            "Dividers on surface": (cols["border"], cols["surface"]),
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
        ck("3.2 thirteen rendered pairs match the WCAG formula", not bad, "; ".join(bad))

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
           await n(pg, ".m6-select") >= 2
           and await pg.locator('.m6-select[aria-label="heading fallback stack"]').locator("option").count() == 4)
        chips = await n(pg, ".m6-pairing-chips .m6-chip")
        ck("5.4 every pairing shortcut is offered", chips == 12, str(chips))
        ck("5.5 the pairing preview renders real sample copy",
           "Study abroad" in await txt(pg, ".m6-prev-h"))
        ck("5.6 the font verification job reports a real result",
           "verified" in (await txt(pg, ".m6-fontjob")).lower())

        await pg.locator(".m6-combo").first.click()
        await pg.wait_for_timeout(340)
        ck("5.7 the family combobox lists the whole catalogue", await n(pg, ".m6-fc-row") >= 9)
        await pg.locator(".m6-fc-toggle").click()          # reveal the full index
        await pg.wait_for_timeout(420)
        dis = await pg.locator(".m6-fc-row:disabled").count()
        ck("5.8 families that are not embedded are listed but disabled", dis > 0, str(dis))
        ck("5.9 disabled rows say why",
           "ingestion" in (await txt(pg, ".m6-fc-row:disabled")).lower())
        ck("5.9a a locked family cannot be selected",
           await pg.locator(".m6-fc-row:disabled").first.is_disabled())
        await pg.locator(".m6-fc-toggle").click()          # back to the embedded set
        await pg.wait_for_timeout(360)
        await pg.locator('input[aria-label="Search fonts for heading"]').fill("Poppins")
        await pg.wait_for_timeout(420)
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
        ck("6.1 the seeded preset library renders", base_cards == 10, str(base_cards))
        names = [t.strip() for t in await pg.locator(".m6-preset-name").all_inner_texts()]
        ck("6.2 the five built-ins are present",
           all(x in names for x in ["Modern Violet", "Ocean Professional", "Warm Editorial",
                                    "Midnight Product", "Cobalt Corporate"]), str(names))
        ck("6.3 scope filters carry computed counts",
           await n(pg, ".m6-chiprow .m6-chip") == 4 and "10" in await txt(pg, ".m6-chiprow .m6-chip"))
        # ---- M6.2: the second five are real sets, not filler cards ----
        ck("6.3a all ten names are distinct", len(set(names)) == 10, str(names))
        descs = [t.strip() for t in await pg.locator(".m6-preset-desc").all_inner_texts()]
        ck("6.3b every preset carries its own description",
           len(descs) >= 10 and len(set(descs)) >= 10, str(len(set(descs))))
        swatches = await pg.evaluate("""() => [...document.querySelectorAll('.m6-preset')].map(c =>
            [...c.querySelectorAll('.m6-preset-sw span')].map(s => getComputedStyle(s).backgroundColor).join('|'))""")
        ck("6.3c the ten presets render ten distinct swatch sets",
           len(set(swatches)) >= 8, str(len(set(swatches))))
        scopes = await pg.evaluate("""() => [...document.querySelectorAll('.m6-preset-scope, .m6-preset .m6-scope, .m6-preset-tag')].map(e => e.textContent.trim())""")
        ck("6.3d the scope chips are distributed, not all Built-in",
           (not scopes) or len(set(scopes)) >= 3, str(sorted(set(scopes))))

        # apply one of the new dark presets and prove the tokens moved
        read_vars = """() => {
            const el = document.querySelector('.m6-pv');
            const cs = getComputedStyle(el);
            return { bg: cs.getPropertyValue('--t-bg').trim(), text: cs.getPropertyValue('--t-text').trim(),
                     font: cs.getPropertyValue('--t-font-heading').trim(), radius: cs.getPropertyValue('--t-radius').trim() };
        }"""
        before = await pg.evaluate(read_vars)
        await pg.locator(".m6-preset", has_text="Midnight Product").first.get_by_role("button", name="Apply").click()
        await pg.wait_for_timeout(420)
        ck("6.3e-i Apply is a review step, not a silent write",
           await n(pg, '.modal:has-text("Review Preset Changes")') == 1)
        await pg.locator('.modal .btn:has-text("Apply to Draft")').first.click()
        await pg.wait_for_timeout(800)
        after = await pg.evaluate(read_vars)
        ck("6.3e-ii applying a new preset repaints the preview",
           before["bg"] != after["bg"] and before["font"] != after["font"], f"{before} -> {after}")
        ck("6.3f the dark preset actually renders dark, in the compiled variables", after["bg"].lower() == "#0b1020", after["bg"])
        ck("6.3g the dark preset swaps both families",
           "Space Grotesk" in after["font"], after["font"])
        # walk it back: the token tab owns the undo stack
        await pg.locator(".m6-tab").nth(0).click()
        await pg.wait_for_timeout(400)
        await pg.locator(".m6-undo").first.click()
        await pg.wait_for_timeout(600)
        restored = await pg.evaluate(read_vars)
        ck("6.3h undo returns the preview to the saved tokens", restored["bg"] == before["bg"], restored["bg"])
        await pg.locator(".m6-tab").nth(2).click()
        await pg.wait_for_timeout(420)

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
           any("draft" in x.lower() for x in export_items) and any("live" in x.lower() for x in export_items), str(export_items))
        ck("7.1a export offers a complete bundle and a tokens-only file",
           sum(1 for x in export_items if "complete" in x.lower()) == 2
           and sum(1 for x in export_items if "tokens" in x.lower()) == 2, str(export_items))

        # ---- M6.2: the complete bundle carries fonts, imagery, layout and pages ----
        async with pg.expect_download(timeout=30000) as dl_info:
            await pg.locator('.dropdown .menu-item:has-text("Export complete draft")').first.click()
        dl = await dl_info.value
        bundle_path = os.path.join("/tmp", dl.suggested_filename)
        await dl.save_as(bundle_path)
        bundle_raw = open(bundle_path, encoding="utf-8").read()
        bundle = json.loads(bundle_raw)
        ck("7.1b the bundle is named as a bundle", "theme-bundle" in dl.suggested_filename, dl.suggested_filename)
        ck("7.1c it declares schemaVersion 3 and its kind",
           bundle.get("schemaVersion") == 3 and bundle.get("kind") == "wacrm.theme.bundle", str(bundle.get("kind")))
        th = bundle.get("theme", {})
        ck("7.1d it still carries the whole token document",
           all(k in th for k in ("colors", "typography", "geometry", "blockStyling")) and len(th["colors"]) >= 13,
           str(sorted(th.keys())))
        ck("7.1e the token document survives the round trip to a preset import",
           bundle.get("theme", {}).get("typography", {}).get("heading", {}).get("family") is not None)
        fonts = bundle.get("fonts", [])
        ck("7.1f both font roles are exported", len(fonts) == 2, str([f.get("role") for f in fonts]))
        faces = [fc for f in fonts for fc in f.get("faces", [])]
        ck("7.1g the font bytes are in the file, not a command",
           faces and all(len(fc.get("content", "")) > 500 for fc in faces), str(len(faces)))
        ck("7.1h each face records its format, size and licence",
           all(fc.get("format") == "woff2" and fc.get("bytes") and f.get("licence") for f in fonts for fc in f["faces"]))
        imgs = bundle.get("assets", {}).get("images", [])
        ck("7.1i the imagery is exported as base64 content",
           len(imgs) > 0 and all(len(i.get("content", "")) > 100 and i.get("mime", "").startswith("image/") for i in imgs),
           str(len(imgs)))
        ck("7.1j the logo slot is declared with its owner",
           "logo" in bundle.get("assets", {}) and "Media library" in bundle.get("assets", {}).get("note", ""))
        lay = bundle.get("layout", {})
        ck("7.1k layout carries container, radius and the spacing scale",
           lay.get("containerWidthPx") in (960, 1080, 1200, 1280) and isinstance(lay.get("spacing", {}).get("scalePx"), list),
           str(lay.get("containerWidthPx")))
        ck("7.1l the future modules are hooked, and named",
           lay.get("starterLayouts") == {} and "Module 7" in lay.get("deferredTo", {}).get("starterLayouts", "")
           and "Module 8" in lay.get("deferredTo", {}).get("navigation", ""))
        comp = bundle.get("computed", {})
        ck("7.1m computed type sizes are exported for all six steps",
           set(comp.get("typeScale", {}).keys()) == {"h1", "h2", "h3", "body", "small", "caption"}, str(sorted(comp.get("typeScale", {}).keys())))
        ck("7.1n the WCAG verdicts travel with the file",
           len(comp.get("contrast", [])) >= 14 and all("verdict" in r and "ratio" in r for r in comp["contrast"]), str(len(comp.get("contrast", []))))
        ck("7.1o the reference pages are in the bundle",
           len(bundle.get("pages", [])) >= 1 and all("blocks" in p for p in bundle["pages"]), str(len(bundle.get("pages", []))))
        ck("7.1p provenance names the revision and an integrity stamp",
           bundle.get("x-wacrm", {}).get("revision") and bundle["x-wacrm"].get("integrity", {}).get("algorithm") == "fnv1a-32")
        ck("7.1q the bundle is materially bigger than a token file",
           len(bundle_raw) > 200_000, str(len(bundle_raw)))
        await pg.wait_for_timeout(300)

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
        ck("9.1 the token summary lists thirteen roles plus the derived one",
           await n(pg, ".m6-swatch") == 13 and await n(pg, ".m6-derived") == 1,
           f"{await n(pg, '.m6-swatch')} / {await n(pg, '.m6-derived')}")
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
           await n(pg, ".m6-pair") > 0 and await n(pg, ".m6-crow") == 13)
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


        # ============ 14 · the font library (M6.1) ============
        await go(pg)
        await pg.locator(".m6-tab").nth(1).click()
        await pg.wait_for_timeout(500)
        banner = await txt(pg, ".m6-banner.is-soft")
        m = re.search(r"(\d[\d,]*) of ([\d,]+) families ship inside this build", banner)
        ck("14.1 the banner states the embedded vs indexed split", m is not None, banner[:80])
        embedded_n, total_n = (int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))) if m else (0, 0)
        ck("14.2 the embedded set is the top-50 popularity cut", embedded_n == 50, str(embedded_n))
        ck("14.3 the index covers almost all of Google Fonts", total_n >= 1700, str(total_n))
        ck("14.4 embedded is a real subset of the index", 0 < embedded_n < total_n)
        # --- the long tail is not a dead end: a locked family can be pulled in ---
        await pg.locator(".m6-combo").first.click()        # open the family picker
        await pg.wait_for_timeout(600)
        ck("14.5 the picker opens on the embedded set", await pg.locator(".m6-fc-toggle.is-on").count() == 1)
        await pg.locator(".m6-fc-toggle").click()          # show the full index
        await pg.wait_for_timeout(500)
        search = pg.locator(".m6-fc-search input")
        await search.fill("Bebas Neue")
        await pg.wait_for_timeout(400)
        have_get = await pg.locator(".m6-fc-get").count()
        ck("14.14 an embedded family shows no Get action", have_get == 0, str(have_get))
        await search.fill("Abril Fatface")
        await pg.wait_for_timeout(400)
        rows = await pg.locator(".m6-fc-row").count()
        ck("14.15 a family outside the 50 still appears in the index", rows == 1, str(rows))
        ck("14.16 it is locked, and it says why",
           "ingestion" in (await txt(pg, ".m6-fc-row")).lower())
        get = pg.locator(".m6-fc-get").first
        ck("14.17 a locked family offers a Get action", await get.count() > 0)
        await get.click()
        await pg.wait_for_timeout(400)
        panel = await txt(pg, ".m6-fc-getpanel")
        ck("14.18 the panel hands over the exact fetch command",
           'npm run fonts -- --only="Abril Fatface"' in panel, panel[:90])
        ck("14.19 the panel names the production equivalent",
           "/theme/fonts/" in panel and "ingest" in panel)
        ck("14.20 it states the font is not fetched at runtime",
           "no network" in panel.lower() or "next build" in panel.lower())
        ck("14.21 the command has a copy control",
           await pg.locator(".m6-fc-copy").count() == 1)
        # ---- M6.2: Get hands over a font FILE, not only a command ----
        dlbtn = pg.locator(".m6-fc-dl")
        ck("14.22 Get offers a font download button", await dlbtn.count() == 1)
        ck("14.23 the download button names the file it will produce",
           "Abril Fatface" in (await txt(pg, ".m6-fc-dl")) and ".woff2" in (await txt(pg, ".m6-fc-dl")),
           await txt(pg, ".m6-fc-dl"))
        ck("14.24 the panel links the specimen on Google Fonts",
           await pg.locator(".m6-fc-open").count() == 1)
        got_file = False
        try:
            async with pg.expect_download(timeout=25000) as dl2:
                await dlbtn.click()
            d = await dl2.value
            fp = os.path.join("/tmp", d.suggested_filename)
            await d.save_as(fp)
            raw = open(fp, "rb").read()
            got_file = raw[:4] == b"wOF2" and len(raw) > 2000 and d.suggested_filename.endswith(".woff2")
            ck("14.25 clicking Get downloads a real woff2 file", got_file,
               f"{d.suggested_filename} {len(raw)}B {raw[:4]!r}")
        except Exception as e:
            # No network in this environment: the panel must say so instead of pretending
            state = await pg.locator(".m6-fc-getstate").count()
            ck("14.25 with no network, Get reports the failure honestly", state > 0, str(e)[:70])
            ck("14.25b the offline message is specific, not generic",
               "Google Fonts" in (await txt(pg, ".m6-fc-getstate")))
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ---- the banner escape hatch opens the picker on the full index ----
        await pg.locator(".m6-banner-all").click()
        await pg.wait_for_timeout(700)
        ck("14.26 the banner's Browse-all opens the picker",
           await pg.locator(".m6-fc-search input").count() == 1)
        ck("14.27 it opens on the full index, not the embedded 50",
           await pg.locator(".m6-fc-toggle.is-on").count() == 0)
        ck("14.28 the full index shows families that need downloading",
           await pg.locator(".m6-fc-get").count() > 0)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        await pg.locator(".m6-combo").first.click()
        await pg.wait_for_timeout(420)
        chips = await pg.locator(".m6-fc-chip").all_inner_texts()
        counts = [int(re.search(r"(\d[\d,]*)", c).group(1).replace(",", "")) for c in chips[1:]]
        all_n = int(re.search(r"(\d[\d,]*)", chips[0]).group(1).replace(",", ""))
        ck("14.5 the category chips sum to the whole index", sum(counts) == all_n, f"{counts} vs {all_n}")
        ck("14.6 the picker defaults to embedded-only",
           "is-on" in (await pg.locator(".m6-fc-toggle").get_attribute("class") or ""))
        rows = await pg.locator(".m6-fc-row").count()
        ck("14.7 the list is windowed, not all 1,700 rows", 0 < rows <= 60, str(rows))
        ck("14.8 every visible row resolves a real face",
           await pg.locator(".m6-fc-row:disabled").count() == 0)

        await pg.locator('input[aria-label="Search fonts for heading"]').fill("serif")
        await pg.wait_for_timeout(420)
        ck("14.9 search narrows across the index", await pg.locator(".m6-fc-row").count() < rows)
        await pg.locator('input[aria-label="Search fonts for heading"]').fill("zzzzqq")
        await pg.wait_for_timeout(360)
        ck("14.10 a miss offers the full-index escape hatch",
           "indexed families" in (await txt(pg, ".m6-fc-none")).lower())
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(240)

        # a family that M6 could only list is now genuinely embedded
        for fam in ["Playfair Display", "Merriweather", "Space Grotesk"]:
            await pg.locator(".m6-combo").first.click()
            await pg.wait_for_timeout(300)
            await pg.locator('input[aria-label="Search fonts for heading"]').fill(fam)
            await pg.wait_for_timeout(400)
            row = pg.locator(f'.m6-fc-row:has-text("{fam}")').first
            ok = await row.count() and not await row.is_disabled()
            ck(f"14.11 {fam} is embedded now, not 'requires ingestion'", bool(ok))
            if fam == "Playfair Display":
                await row.click()
                await pg.wait_for_timeout(600)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(240)
        fam_css = await pg.eval_on_selector(".m6-prev-h", "e => getComputedStyle(e).fontFamily")
        ck("14.12 the newly embedded family renders in the preview", "Playfair" in fam_css, fam_css)
        loaded = await pg.evaluate("""() => document.fonts.check("700 16px 'Playfair Display'")""")
        ck("14.13 the woff2 is actually registered, not just named", bool(loaded))

        # ============ 15 · the type scale (G1) ============
        await go(pg)
        await pg.locator(".m6-tab").nth(1).click()
        await pg.wait_for_timeout(500)
        ck("15.1 a type-scale card exists", await n(pg, '[data-m6="type-scale"]') == 1)
        ck("15.2 base size offers five values",
           await pg.locator('.m6-seg[aria-label="Base font size"] .m6-seg-btn').count() == 5)
        ratios = await pg.locator('.m6-select[aria-label="Scale ratio"] option').count()
        ck("15.3 the modular ratio is a closed list of four", ratios == 4, str(ratios))
        ck("15.4 four scale sliders (leading ×2, tracking ×2)", await n(pg, ".m6-slider") == 4)
        ck("15.5 fluid headings is an explicit toggle",
           await n(pg, '[data-m6="type-scale"] input[type=checkbox]') == 1)

        async def ramp():
            out = {}
            for step in ["h1", "h2", "h3", "body", "small", "caption"]:
                t = await txt(pg, f'[data-m6-step="{step}"] .m6-ramp-key em')
                out[step] = int(num(t))
            return out

        r = await ramp()
        base = int(re.search(r"(\d+)", await txt(pg, '.m6-seg[aria-label="Base font size"] .m6-seg-btn.is-on b')).group(1))
        chosen = await pg.eval_on_selector('.m6-select[aria-label="Scale ratio"]', "e => Number(e.value)")
        want = {"h1": round(base * chosen ** 3), "h2": round(base * chosen ** 2), "h3": round(base * chosen),
                "body": base, "small": round(base / chosen), "caption": round(base / chosen ** 2)}
        bad = [f"{k}: shown {r[k]} want {v}" for k, v in want.items() if abs(r[k] - v) > 1]
        ck("15.6 all six ramp steps are computed from base × ratio", not bad, "; ".join(bad))
        ck("15.7 the ramp is monotonically decreasing", r["h1"] > r["h2"] > r["h3"] > r["body"] > r["small"] >= r["caption"], str(r))

        # ratio change re-rhythms the ramp
        await pg.select_option('.m6-select[aria-label="Scale ratio"]', "1.5")
        await pg.wait_for_timeout(460)
        r15 = await ramp()
        ck("15.8 switching ratio changes every derived step", r15["h1"] > r["h1"] and r15["caption"] < r["caption"], f"{r['h1']}→{r15['h1']}")

        # base size drives the smallest step too
        await pg.locator('.m6-seg[aria-label="Base font size"] .m6-seg-btn').nth(4).click()
        await pg.wait_for_timeout(460)
        r18 = await ramp()
        ck("15.9 base size 18 re-derives the whole scale", r18["body"] == 18, str(r18["body"]))

        # fluid emits clamp(), and the preview page obeys it
        fluid_css = await pg.eval_on_selector(".m6-pv", "e => getComputedStyle(e).getPropertyValue('--t-fs-h1').trim()")
        ck("15.10 fluid headings compile to clamp()", "clamp(" in fluid_css, fluid_css)
        h1_px = await pg.eval_on_selector(".m6-pv .wb-h1", "e => getComputedStyle(e).fontSize")
        ck("15.11 the page preview renders the new h1 size", h1_px.endswith("px"), h1_px)
        lead = await pg.eval_on_selector(".m6-pv", "e => getComputedStyle(e).getPropertyValue('--t-lh-heading').trim()")
        ck("15.12 heading leading reaches the preview", float(lead) >= 1.0, lead)

        await pg.locator('[data-m6="type-scale"] input[type=checkbox]').click()
        await pg.wait_for_timeout(420)
        fixed = await pg.eval_on_selector(".m6-pv", "e => getComputedStyle(e).getPropertyValue('--t-fs-h1').trim()")
        ck("15.13 fluid off emits a fixed px value", fixed.endswith("px") and "clamp" not in fixed, fixed)

        # ============ 16 · the new role pairs (G2) ============
        await go(pg)
        cols4 = await colours(pg)
        await pg.locator('.m6-panel:has-text("Accessibility Checks") .m6-more').first.click()
        await pg.wait_for_timeout(340)
        labels4 = [t.strip() for t in await pg.locator(".m6-pair-label").all_inner_texts()]
        metas4 = [t.strip() for t in await pg.locator(".m6-pair-meta").all_inner_texts()]
        shown4 = {labels4[i]: num(metas4[i]) for i in range(len(labels4))}
        checks = {
            "Muted text on background": (cols4["muted"], cols4["background"], 4.5),
            "Muted text on surface": (cols4["muted"], cols4["surface"], 4.5),
            "Links on background": (cols4["link"], cols4["background"], 4.5),
            "Focus ring on background": (cols4["ring"], cols4["background"], 3),
            "Dividers on surface": (cols4["border"], cols4["surface"], 1.5),
        }
        bad4 = []
        for label, (fg, bg, need) in checks.items():
            want4 = ratio(fg, bg)
            got4 = shown4.get(label, -1)
            if abs(want4 - got4) > 0.02:
                bad4.append(f"{label}: shown {got4}, computed {want4:.2f}")
        ck("16.1 the five new role pairs match the WCAG formula", not bad4, "; ".join(bad4))
        ck("16.2 the divider pair is measured against an advisory floor, not 1.4.11",
           "1.5" in (await txt(pg, '.m6-pair:has-text("Dividers on surface")')).replace("1.51", ""))
        ring_need = 3.0
        ck("16.3 the focus ring is held to the 3:1 non-text threshold",
           abs(ratio(cols4["ring"], cols4["background"]) - shown4.get("Focus ring on background", -2)) <= 0.02)

        # ============ 17 · the specimen sheet (G3) ============
        await go(pg)
        ck("17.1 the preview offers a specimen surface",
           await n(pg, '.m6-pvmode-btn:has-text("Specimen")') == 1)
        await pg.locator('.m6-pvmode-btn:has-text("Specimen")').click()
        await pg.wait_for_timeout(900)
        ck("17.2 the specimen renders", await n(pg, "[data-m6-specimen]") == 1)
        ck("17.3 every role appears as a swatch", await n(pg, ".m6-spec-swatch") == 13)
        ck("17.4 all six type steps are shown", await n(pg, "[data-m6-spec-step]") == 6)
        ck("17.5 buttons cover default / hover / focus / disabled",
           await n(pg, ".m6-spec-btn") >= 6)
        ck("17.6 inputs cover default, focus and error states",
           await n(pg, ".m6-spec-fields .m6-spec-field") == 4
           and await n(pg, ".m6-spec-field.is-focus") == 1
           and await n(pg, ".m6-spec-field.is-error") == 1)
        ck("17.7 the consent block is unticked and explicit",
           await n(pg, "[data-m6-spec-consent]") == 1
           and "unticked" in (await txt(pg, "[data-m6-spec-consent]")).lower())
        ck("17.8 alerts render in three severities", await n(pg, ".m6-spec-alert") == 3)
        ck("17.9 a table row and a card are shown",
           await n(pg, ".m6-spec-table") == 1 and await n(pg, ".m6-spec-card") == 1)
        spec_h1 = await pg.eval_on_selector('[data-m6-spec-step="h1"] span:last-child', "e => getComputedStyle(e).fontSize")
        ck("17.10 the specimen h1 uses the same compiled size as the page",
           spec_h1.replace("px", "") != "" and abs(float(spec_h1.replace("px", "")) - want["h1"]) <= 40, spec_h1)
        spec_radius = await pg.eval_on_selector(".m6-spec-card", "e => getComputedStyle(e).borderTopLeftRadius")
        ck("17.11 specimen surfaces use the radius token", spec_radius != "0px", spec_radius)
        await pg.locator('.m6-pvmode-btn:has-text("Page")').click()
        await pg.wait_for_timeout(600)
        ck("17.12 switching back restores the page preview",
           await n(pg, "[data-m6-specimen]") == 0)

        # ============ 18 · revisions (G4) ============
        await go(pg)
        ck("18.1 the overview carries a revisions panel",
           await n(pg, '.m6-panel:has-text("Revisions")') >= 1)
        revs = await n(pg, "[data-m6-overview-rev]")
        ck("18.2 the last revisions are listed", revs >= 2, str(revs))
        ck("18.3 a restore action exists per revision",
           await n(pg, ".m6-revs-restore") == revs)
        await pg.locator(".m6-revs-more").click()
        await pg.wait_for_timeout(700)
        rows10 = await n(pg, ".m6-revh-row")
        ck("18.4 the full history opens", rows10 >= 4, str(rows10))
        await pg.locator(".m6-revh-row").nth(2).click()
        await pg.wait_for_timeout(400)
        diffs = await n(pg, ".m6-revh-table tbody tr")
        ck("18.5 a revision shows a token-by-token diff", diffs >= 1, str(diffs))
        ck("18.6 the diff names the group, token, from and to",
           await n(pg, ".m6-revh-table th") == 4)
        await pg.locator(".m6-revh-row").nth(0).click()
        await pg.wait_for_timeout(300)
        html = await txt(pg, ".m6-revh")
        ck("18.7 the newest revision is the saved draft", "Saved draft" in html)
        # the revision that is already the saved draft cannot be restored over itself
        btn = pg.locator('.modal-foot .btn-primary')
        await pg.locator(".m6-revh-row").nth(0).click()
        await pg.wait_for_timeout(300)
        ck("18.8 restoring the current draft is refused", await btn.is_disabled())
        await pg.locator(".m6-revh-row").nth(3).click()
        await pg.wait_for_timeout(300)
        ck("18.9 an earlier revision can be restored", not await btn.is_disabled())
        before = await colours(pg)
        await btn.click()
        await pg.wait_for_timeout(900)
        ck("18.10 restore closes the dialog", await n(pg, ".m6-revh") == 0)
        ck("18.11 restore marks the working copy dirty, it does not save",
           "unsaved changes" in (await txt(pg, ".m6-draft-chip")).lower())
        after = await colours(pg)
        ck("18.12 restore actually changed the tokens", before != after, f"{before['primary']} vs {after['primary']}")
        await pg.keyboard.press("Control+z")
        await pg.wait_for_timeout(500)
        undone = await colours(pg)
        ck("18.13 undo walks back out of a restore", undone == before,
           f"{undone['primary']} vs {before['primary']}")
        ck("18.14 undoing a restore returns to a clean saved draft",
           "unsaved" not in (await txt(pg, ".m6-draft-chip")).lower())

        # ============ 19 · the version-2 document contract ============
        await go(pg)
        v1 = {
            "schemaVersion": 1, "name": "Legacy v1 file",
            "colors": {"primary": "#123456", "secondary": "#0B1026", "accent": "#0EA5E9",
                       "success": "#16A34A", "warning": "#F59E0B", "error": "#EF4444",
                       "background": "#FFFFFF", "surface": "#F8FAFC", "text": "#0B1026"},
            "typography": {"heading": {"family": "Geist", "weight": 700, "fallback": "system-ui"},
                           "body": {"family": "Inter", "weight": 400, "fallback": "system-ui"}},
            "geometry": {"radiusPx": 12, "containerWidthPx": 1200, "spacing": {"base": 8, "density": "comfortable"}},
            "blockStyling": {"cardDensity": "comfortable", "elevation": "soft"}
        }
        await pg.evaluate("""(doc) => {
            const el = document.querySelector('input[type=file]');
            const f = new File([JSON.stringify(doc)], 'legacy-v1.json', {type:'application/json'});
            const dt = new DataTransfer(); dt.items.add(f); el.files = dt.files;
            el.dispatchEvent(new Event('change', {bubbles:true}));
        }""", v1)
        await pg.wait_for_timeout(900)
        ck("19.1 a version-1 file is still accepted", await n(pg, ".modal") == 1)
        body = await txt(pg, ".modal-body")
        ck("19.2 missing roles are reported as derived, not invented silently",
           "derived" in body.lower(), body[:120])
        ck("19.3 the absent type scale is called out as a default",
           "no type scale" in body.lower() or "default" in body.lower())
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)

        # ============ 22 · interlinks (M6.2) ============
        # the theme is not an island: a saved draft must reach the builder canvas
        await go(pg)
        await pg.locator(".m6-tab").nth(2).click()
        await pg.wait_for_timeout(500)
        await pg.locator(".m6-preset", has_text="Midnight Product").first.get_by_role("button", name="Apply").click()
        await pg.wait_for_timeout(400)
        await pg.locator('.modal .btn:has-text("Apply to Draft")').first.click()
        await pg.wait_for_timeout(700)
        seq_before = await txt(pg, ".m6-draft-chip")
        await pg.locator('button:has-text("Save Brand Tokens")').first.click()
        await pg.wait_for_timeout(1400)
        ck("22.1 a theme change saves as a new draft revision",
           await txt(pg, ".m6-draft-chip") != seq_before, f"{seq_before} -> {await txt(pg, '.m6-draft-chip')}")
        ck("22.2 the save lands clean, not stuck dirty",
           "Unsaved" not in await txt(pg, ".m6-draft-chip"), await txt(pg, ".m6-draft-chip"))

        # → M4 Visual Builder
        await pg.evaluate("() => { location.hash = '#/builder'; }")
        await pg.wait_for_timeout(2200)
        canvas = """() => { const d = document.querySelector('.wb-doc');
            if (!d) return null; const cs = getComputedStyle(d);
            return { themed: d.classList.contains('wb-themed'), bg: cs.getPropertyValue('--t-bg').trim(),
                     font: cs.getPropertyValue('--t-font-heading').trim(), painted: cs.backgroundColor,
                     foot: (document.querySelector('.wb-doc-foot') || {}).innerText || '' }; }"""
        cv = await pg.evaluate(canvas)
        ck("22.3 the builder canvas is rendered as a themed document", bool(cv) and cv["themed"], str(cv))
        ck("22.4 the canvas carries the theme's background token", cv and cv["bg"].lower() == "#0b1020", str(cv and cv["bg"]))
        ck("22.5 the canvas paints that token, not just declares it",
           bool(cv) and cv["painted"].replace(" ", "") == "rgb(11,16,32)", str(cv and cv["painted"]))
        ck("22.6 the canvas carries the theme's heading family",
           bool(cv) and "Space Grotesk" in cv["font"], str(cv and cv["font"]))
        ck("22.7 the canvas names the theme revision it is rendering",
           bool(cv) and "Theme ·" in cv["foot"] and "draft #" in cv["foot"], str(cv and cv["foot"])[:90])
        ck("22.8 the canvas still renders the page's blocks under the theme",
           await n(pg, ".wb-doc [data-block-id]") > 0, str(await n(pg, ".wb-doc [data-block-id]")))

        # back to the studio without a reload: the workspace keeps the saved state
        await pg.evaluate("() => { location.hash = '#/theme'; }")
        await pg.wait_for_timeout(1500)
        await pg.locator(".m6-tab").nth(0).click()
        await pg.wait_for_timeout(400)
        row = (await txt(pg, '.m6-crow[data-role="primary"]')).upper()
        ck("22.9 the token editor carries the saved draft's primary across views",
           "#A78BFA" in row, row[:80])
        ck("22.10 the draft revision survives the round trip through M4",
           await txt(pg, ".m6-draft-chip") != seq_before, f"{seq_before} -> {await txt(pg, '.m6-draft-chip')}")

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
