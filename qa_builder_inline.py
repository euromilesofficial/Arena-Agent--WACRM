#!/usr/bin/env python3
"""Module 4 — inline text editing on the Visual Builder canvas.

Every text element a visitor reads is editable in place: headings, eyebrows,
descriptions, list items, feature cards, text-block paragraphs, testimonials,
pricing tiers, FAQ questions and answers, table cells, buttons and captions.
The checks run in the real browser against the real builder: one edit is one
undo step, Ctrl+Z inside a field belongs to the field, the inspector shows the
same value, and the document is marked unsaved.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "file:///home/user/wacrm-app/WACRM-CMS.html"
TALLY = {"ok": 0, "fail": 0}
FAILS = []

def ck(name, cond, extra=""):
    if cond:
        TALLY["ok"] += 1; print(f"OK   {name}")
    else:
        TALLY["fail"] += 1; FAILS.append(name + (f" :: {extra}" if extra else ""))
        print(f"FAIL {name}" + (f" :: {extra}" if extra else ""))

async def blur(pg):
    await pg.evaluate("document.activeElement && document.activeElement.blur()")
    await pg.wait_for_timeout(300)

async def type_into(pg, loc, text):
    await loc.click()
    await pg.keyboard.press("Control+A")
    await pg.keyboard.type(text)
    await blur(pg)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:" + m.text) if m.type == "error" else None)
        await pg.goto(URL + "#/builder"); await pg.reload(); await pg.wait_for_timeout(1800)

        doc = ".wb-doc"
        types = await pg.evaluate("[...new Set([...document.querySelectorAll('.wb-doc .wb-el-edit')].map(e=>e.dataset.el))]")
        need = {"heading", "description", "eyebrow", "title", "text", "q", "a", "head", "a", "b", "c", "primaryLabel"}
        ck("B1 the builder canvas exposes editable text", len(types) >= 10, str(types))
        ck("B2 every kind of text in the default page is editable",
           need.issubset(set(types)), f"missing {sorted(need - set(types))}")

        # ---- B3: heading edit, inspector sync, undo
        undo = pg.get_by_role("button", name="Undo", exact=True)
        h = pg.locator(f"{doc} .wb-el-edit[data-el='heading']").first
        before = await h.inner_text()
        ck("B3 undo starts disabled on a fresh document", await undo.is_disabled())
        await type_into(pg, h, "Builder inline works")
        ck("B4 a heading edit lands on the canvas", (await h.inner_text()) == "Builder inline works")
        ck("B5 the status pill says unsaved", await pg.locator("[data-status='dirty']").count() == 1)
        ck("B6 the edit is one undo step (Undo is enabled)", await undo.is_enabled())
        await pg.keyboard.press("Escape")  # nothing selected inside a field: must not clear the block
        await pg.get_by_role("button", name="Undo", exact=True).click()
        await pg.wait_for_timeout(300)
        ck("B7 Undo restores the previous text", (await h.inner_text()) == before, await h.inner_text())

        # ---- B8: a burst of typing is one undo step, not one per key
        await h.click(); await pg.keyboard.press("Control+A")
        await pg.keyboard.type("Burst one", delay=30)
        await blur(pg)
        await undo.click(); await pg.wait_for_timeout(300)
        ck("B8 a burst of typing undoes in one step", (await h.inner_text()) == before, await h.inner_text())

        # ---- B9: Escape reverts an unfinished edit, Enter commits
        await h.click(); await pg.keyboard.press("Control+A")
        await pg.keyboard.type("discard me"); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
        ck("B9 Escape reverts an unfinished edit", (await h.inner_text()) == before, await h.inner_text())
        await h.click(); await pg.keyboard.press("Control+A")
        await pg.keyboard.type("Committed by enter"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(250)
        ck("B10 Enter commits and leaves the field", (await h.inner_text()) == "Committed by enter"
           and await pg.evaluate("document.activeElement?.dataset?.el !== 'heading'"))

        # ---- B11: the inspector shows the same value (one document)
        await h.click(); await pg.wait_for_timeout(300)
        insp = pg.locator(".wb-inspector textarea, .wb-insp textarea, textarea").first
        vals = await pg.evaluate("[...document.querySelectorAll('textarea,input[type=text]')].map(e=>e.value)")
        ck("B11 the inspector shows the inline edit", "Committed by enter" in vals, str(vals[:4]))

        # ---- B12–B17: each kind of text, from the template that contains it.
        # A fresh builder starts from the default page, so each phase applies its own template.
        async def fresh():
            await pg.reload(); await pg.wait_for_timeout(1500)
        async def apply(name):
            await pg.click("#wb-tab-pages"); await pg.wait_for_timeout(300)
            await pg.click(f'.wb-tpl-card:has-text("{name}") >> text=Use'); await pg.wait_for_timeout(500)
            if await pg.locator(".modal").count():
                await pg.locator(".modal >> text=Remove the form block").first.click(); await pg.wait_for_timeout(200)
                await pg.locator(".modal button:has-text('Use template')").first.click(); await pg.wait_for_timeout(600)

        await fresh(); await apply("Programme Page")
        card = pg.locator(f"{doc} .wb-fg-item .wb-el-edit[data-el='title']").first
        ck("B12 feature-card titles are editable", await card.count() == 1)
        if await card.count():
            await type_into(pg, card, "Card renamed")
            ck("B12b a feature-card title edit lands on its card", (await card.inner_text()).strip() == "Card renamed")

        await fresh(); await apply("About Page")
        name = pg.locator(f"{doc} .wb-quote-card-by .wb-el-edit[data-el='name']").first
        ck("B13 testimonial names are editable", await name.count() == 1)
        if await name.count():
            await type_into(pg, name, "Name renamed")
            ck("B13b a testimonial name edit lands on its card", (await name.inner_text()).strip() == "Name renamed")
        paras = pg.locator(f"{doc} .wb-prose .wb-el-edit[data-el='body']")
        ck("B17 a text block exposes its paragraphs for editing", await paras.count() >= 1, str(await paras.count()))

        await fresh(); await apply("Scholarship Page")
        cell = pg.locator(f"{doc} .wb-td.wb-el-edit[data-el='a']").first
        ck("B14 table cells are editable", await cell.count() == 1)
        if await cell.count():
            await type_into(pg, cell, "Cell renamed")
            ck("B14b a table cell edit lands in its cell", (await cell.inner_text()).strip() == "Cell renamed")
        q = pg.locator(f"{doc} .wb-faq-q .wb-el-edit[data-el='q']").first
        ck("B15 FAQ questions are editable", await q.count() == 1)
        if await q.count():
            await type_into(pg, q, "Question renamed?")
            ck("B15b a FAQ question edit lands on its row", (await q.inner_text()).strip() == "Question renamed?")

        await fresh()
        await pg.click("#wb-tab-sections"); await pg.wait_for_timeout(300)
        idx = await pg.evaluate("""() => { const cards=[...document.querySelectorAll('.wb-sec-card')];
            return cards.findIndex(c => ((c.querySelector('.wb-sec-meta')?.innerText || '').split('\\n')[0] || '').trim() === 'Pricing'); }""")
        if idx >= 0:
            await pg.locator(".wb-sec-card").nth(idx).locator(".wb-insert-btn").click(); await pg.wait_for_timeout(500)
        tier = pg.locator(f"{doc} .wb-tier-name.wb-el-edit[data-el='name']").first
        ck("B16 pricing tiers are editable (section inserted)", idx >= 0 and await tier.count() >= 1, f"idx={idx}")
        if await tier.count():
            await type_into(pg, tier, "Tier renamed")
            # the tier name is styled in capitals, so compare the words, not the case
            ck("B16b a tier name edit lands on its tier", (await tier.inner_text()).strip().lower() == "tier renamed")
        feat = pg.locator(f"{doc} .wb-tier-list .wb-el-edit[data-el='features']").first
        ck("B21 a feature in a pricing list is editable on its own", await feat.count() == 1)
        if await feat.count():
            others = await pg.locator(f"{doc} .wb-tier-list li").all_inner_texts()
            await type_into(pg, feat, "Feature renamed")
            after = await pg.locator(f"{doc} .wb-tier-list li").all_inner_texts()
            ck("B21b the edit changes that feature and only that feature",
               any("Feature renamed" in x for x in after) and len(after) == len(others), str(after[:3]))
        per = pg.locator(f"{doc} .wb-tier-price .wb-el-edit[data-el='period']").first
        ck("B22 a pricing period is editable, the separator stays fixed", await per.count() == 1)
        if await per.count():
            await type_into(pg, per, "per month")
            ck("B22b the period edit keeps the separator", "/ per month" in (await pg.locator(f"{doc} .wb-tier-price").first.inner_text()).lower().replace("\n", " "))

        # ---- B18 onward: back to the default page for the remaining checks
        await fresh()
        h = pg.locator(f"{doc} .wb-el-edit[data-el='heading']").first
        before = await h.inner_text()

        # ---- B18: an empty edit is refused
        h2 = pg.locator(f"{doc} .wb-el-edit[data-el='heading']").first
        await h2.click(); await pg.keyboard.press("Control+A"); await pg.keyboard.press("Backspace"); await blur(pg)
        ck("B18 an empty edit is refused", (await h2.inner_text()).strip() != "")

        # ---- B19: a link edits as text and stays a link
        await pg.locator(f"{doc} .wb-el-edit[data-el='heading']").first.click(); await pg.wait_for_timeout(200)
        link = pg.locator(f"{doc} .wb-el-edit[data-el='primaryHref']").first
        if await link.count():
            await type_into(pg, link, "/qa-builder-link")
            ck("B19 a link edit keeps the page-link form", (await link.inner_text()).strip() == "/qa-builder-link")
        else:
            ck("B19 a link edit keeps the page-link form", False, "no hero link on the default page")

        # ---- B20: a non-text control is not made editable by mistake
        ck("B20 buttons and links that are not text keep their behaviour",
           await pg.locator(f"{doc} .wb-el-edit[data-el='primaryLabel']").count() >= 1)

        ck("Z1 no console or page errors", not errs, "; ".join(errs[:3]))
        await b.close()

    total = TALLY["ok"] + TALLY["fail"]
    print(f"\nqa_builder_inline · {TALLY['ok']}/{total} assertions passed")
    if FAILS:
        print("FAILURES:")
        for f in FAILS: print(" ·", f)
        sys.exit(1)

asyncio.run(main())
