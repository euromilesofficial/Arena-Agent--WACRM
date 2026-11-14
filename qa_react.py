import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    errs=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1.4)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)[:300]))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text[:300]) if m.type=='error' else None)
        await pg.goto('file:///home/user/wacrm-app/WACRM-CMS.html'); await pg.wait_for_timeout(2600)
        from PIL import Image
        import io
        png = await pg.screenshot()
        Image.open(io.BytesIO(png)).convert("RGB").save('/home/user/wacrm-app/qa/1440.webp', 'WEBP', quality=82, method=5)
        m = await pg.evaluate("()=>{const el=document.getElementById('root');const main=document.querySelector('.main');return {h:main.scrollHeight,c:main.clientHeight, overflow:(main.scrollHeight-main.clientHeight)}}")
        print('main', m)
        print('errors:', errs[:6] or 'none')
        await b.close()
asyncio.run(main())
