import asyncio
from playwright.async_api import async_playwright
OUT='/tmp/qa-shots'
import os
os.makedirs(OUT, exist_ok=True)
async def main():
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1.4)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)[:200]))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text[:200]) if m.type=='error' else None)
        await pg.goto('file:///home/user/wacrm-app/WACRM-CMS.html'); await pg.wait_for_timeout(2400)

        tally = {'ok': 0, 'fail': 0}

        async def step(name, fn, wait=700, shot=True):
            try:
                await fn(); await pg.wait_for_timeout(wait)
                if shot: await pg.screenshot(path=f'{OUT}/r-{name}.webp', type='webp', quality=80)
                tally['ok'] += 1
                print('OK  ', name)
            except Exception as e:
                tally['fail'] += 1
                print('FAIL', name, type(e).__name__, str(e)[:140])

        await step('01-kpi', lambda: pg.click('.kpi >> nth=2'), 900)
        await step('02-kpi-close', lambda: pg.keyboard.press('Escape'))
        await step('03-stage', lambda: pg.click('.fleg-row >> nth=1'), 800)
        await step('04-stage-close', lambda: pg.keyboard.press('Escape'))
        await step('05-channel', lambda: pg.click('.acq-row >> nth=1'), 800)
        await step('06-ch-close', lambda: pg.keyboard.press('Escape'))
        await step('07-health', lambda: pg.click('.health-row >> nth=0'), 800)
        await step('08-health-close', lambda: pg.keyboard.press('Escape'))
        await step('09-ssl', lambda: pg.click('.at-card >> nth=0 >> button'), 700)
        await step('10-link', lambda: pg.keyboard.press('Escape'), 300)
        await step('11-link-open', lambda: pg.click('.at-card >> nth=1 >> button'), 700)
        await step('12-link-close', lambda: pg.keyboard.press('Escape'))
        await step('13-preflight', lambda: pg.click('.at-card >> nth=2 >> button'), 700)
        # 14-15: publish wizard (step 1 → freeze manifest → publish). A 34 % conflict
        # is a valid outcome too, so both branches are accepted and screenshotted.
        ok14 = await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                                 ".find(b=>/Freeze/i.test(b.textContent)); if(b){b.click();return b.textContent.trim()} return ''}")
        await pg.wait_for_timeout(900)
        print(('OK   14-freeze  → ' + ok14) if ok14 else 'FAIL 14-freeze  → no manifest control'); tally['ok' if ok14 else 'fail'] += 1
        ok15 = await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                                 ".find(b=>/^Publish v1\\./.test(b.textContent.trim())); if(b){b.click();return b.textContent.trim()} return ''}")
        await pg.wait_for_timeout(2600)
        print(('OK   15-publish  → ' + ok15) if ok15 else 'FAIL 15-publish  → no publish control'); tally['ok' if ok15 else 'fail'] += 1
        if await pg.locator('text=is live').count():
            await pg.screenshot(path=f'{OUT}/r-15-published.webp', type='webp', quality=80); print('OK   15b-published')
            await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                              ".find(b=>/Done/i.test(b.textContent)); if(b)b.click()}")
        elif await pg.locator('text=Publish conflict detected').count():
            await pg.screenshot(path=f'{OUT}/r-15-conflict.webp', type='webp', quality=80); print('OK   15b-conflict')
            await pg.evaluate("()=>{const b=[...document.querySelectorAll('.modal-foot button')]"
                              ".find(b=>/Rebase/i.test(b.textContent)); if(b)b.click()}")
            await pg.wait_for_timeout(600)
        else:
            print('FAIL 15b-result  → neither live nor conflict')
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(400)
        await step('16-site-menu', lambda: pg.click('.site-card >> nth=0 >> .site-more'), 500)
        await step('17-rename', lambda: pg.click('text=Rename'), 600)
        await step('18-rename-cancel', lambda: pg.keyboard.press('Escape'))
        await step('19-wizard', lambda: pg.click('text=New Website'), 700)
        await step('20-wizard-fill', lambda: pg.fill('input.input', 'EuroMiles Test'), 300)
        await step('21-wizard-next', lambda: pg.click('text=Continue'), 500)
        await step('22-wizard-next2', lambda: pg.click('text=Continue'), 500)
        await step('23-wizard-next3', lambda: pg.click('text=Continue'), 500)
        await step('24-wizard-create', lambda: pg.click('text=Create website'), 2600)
        await step('25-close-drawer', lambda: pg.keyboard.press('Escape'))
        await step('26-palette', lambda: pg.keyboard.press('Control+k'), 600)
        await step('27-palette-type', lambda: pg.fill('.cmdk-input', 'pages'), 400)
        await step('28-palette-esc', lambda: pg.keyboard.press('Escape'))
        await step('29-states', lambda: pg.click('[aria-label="Prototype states"]'), 400)
        await step('30-empty', lambda: pg.click('text=Empty (no data in range)'), 1800)
        await step('31-states2', lambda: pg.click('[aria-label="Prototype states"]'), 400)
        await step('32-default', lambda: pg.click('text=Default'), 1800)
        await step('33-notifs', lambda: pg.click('[aria-label="Notifications"]'), 500)
        await step('34-notifs-esc', lambda: pg.keyboard.press('Escape'))
        await step('35-site-filter', lambda: pg.click('.select-btn >> nth=0'), 400)
        await step('36-single-site', lambda: pg.click('.menu-item:has-text("EuroMiles Rewards")'), 1600)
        await step('37-route-pages', lambda: pg.click('.nav-item:has-text("Pages")'), 900)
        await step('38-back-overview', lambda: pg.click('.nav-item:has-text("Overview")'), 1600)

        print('errors:', errs[:8] or 'none')
        print(f"steps: {tally['ok']} ok / {tally['fail']} failed")
        await b.close()
asyncio.run(main())
