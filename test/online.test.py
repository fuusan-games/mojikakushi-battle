from playwright.sync_api import sync_playwright
U='http://127.0.0.1:18801/index.html?turbo'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    H=b.new_context(viewport={'width':390,'height':844}).new_page();C=b.new_context(viewport={'width':390,'height':844}).new_page()
    for pg,n in((H,'H'),(C,'C')):pg.on('pageerror',lambda e,n=n:errs.append(n+str(e)))
    H.goto(U);H.click('#goOnline');H.fill('#onName','ホスト');H.click('#mkRoom');H.wait_for_selector('#lobCode:not(:empty)',timeout=20000)
    code=H.inner_text('#lobCode');print('room',code,'qr',H.locator('#qr svg').count())
    C.goto(U);C.click('#goOnline');C.fill('#onName','ゲスト');C.fill('#onCode',code);C.click('#joinRoom')
    H.wait_for_function("document.getElementById('lobList').innerText.includes('ゲスト')",timeout=20000)
    H.select_option('#lobLv','3');H.click('#lobCpu');H.screenshot(path='test/shots/lobby.png');H.click('#lobStart')
    H.wait_for_selector('[data-t]');H.click('[data-t="0"]')
    H.wait_for_selector('#wIn');H.fill('#wIn','すいか');H.click('#wGo')
    C.wait_for_selector('#wIn',timeout=10000);C.fill('#wIn','メロンパン');C.click('#wGo')
    C.wait_for_selector('.bd',timeout=10000)
    leak=0
    for i in range(500):
        g=H.evaluate('JSON.parse(JSON.stringify(MK_DEBUG.G))')
        if g['phase']=='end':break
        if g['phase']=='battle' and ('すいか' in C.inner_text('#gameBody') and g['alive'][0]): leak+=1
        if g['phase']=='battle' and ('めろんはん' in H.inner_text('#gameBody') or 'メロンパン' in H.inner_text('#gameBody')) and g['alive'][1]: leak+=1
        for pg in (H,C):
            if pg.locator('#atkGo').count():
                ks=pg.locator('.k[data-k]:not([disabled])')
                if ks.count(): ks.nth((i*7)%ks.count()).click(); pg.click('#atkGo')
        H.wait_for_timeout(150)
        if i==5: C.screenshot(path='test/shots/online_client.png')
    C.wait_for_timeout(800)
    print('phase',g['phase'],'winner',g['players'][g['winner']]['name'] if g['winner']>=0 else None,'leaks',leak,'client sees end','勝ち' in C.inner_text('#gameBody'))
    C.screenshot(path='test/shots/online_client_end.png')
    H.click('#bAgain'); C.wait_for_timeout(1500); print('client round2 topic wait', 'お題' in C.inner_text('#gameBody'))
    b.close()
print('errors',errs)
