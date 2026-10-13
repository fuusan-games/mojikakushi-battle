from playwright.sync_api import sync_playwright
U='http://127.0.0.1:18801/index.html?turbo&seed=3'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':390,'height':844}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto(U); pg.screenshot(path='test/shots/title.png')
    pg.click('#goLocal'); pg.evaluate("localStorage.clear()"); pg.click('#startLocal')
    pg.wait_for_selector('[data-t]'); pg.screenshot(path='test/shots/topic.png'); pg.click('[data-t="0"]')
    pg.fill('#wIn','パイナップル'); assert 'はいなつふる' in pg.inner_text('#wMsg'); pg.screenshot(path='test/shots/word.png'); pg.click('#wGo')
    pg.wait_for_selector('.bd'); pg.screenshot(path='test/shots/battle.png')
    for i in range(400):
        g=pg.evaluate('JSON.parse(JSON.stringify(MK_DEBUG.G))')
        if g['phase']=='end': break
        if pg.locator('#atkGo').count():
            ks=pg.locator('.k[data-k]:not([disabled])')
            if ks.count(): ks.nth(i%ks.count()).click(); pg.click('#atkGo')
        pg.wait_for_timeout(80)
        if i==6: pg.screenshot(path='test/shots/battle2.png')
    pg.wait_for_timeout(600); pg.screenshot(path='test/shots/end.png',full_page=True)
    print('phase',g['phase'],'winner',g['winner'],[x['name'] for x in g['players']])
    # pass-and-play: 2 humans + 1 cpu
    pg.goto(U); pg.click('#goLocal'); pg.click('#addHuman'); pg.click('#startLocal'); pg.click('[data-t="1"]')
    pg.click('#gateOk'); pg.fill('#wIn','ねこ'); pg.click('#wGo'); txt=pg.inner_text('#gameBody'); assert 'ねこ' not in txt, 'leak'
    pg.click('#gateOk'); pg.fill('#wIn','らいおん'); pg.click('#wGo'); pg.wait_for_selector('.bd')
    body=pg.inner_text('#gameBody'); print('leak in battle:', 'らいおん' in body or 'ねこ' in body)
    pg.screenshot(path='test/shots/pnp.png'); b.close()
print('errors',errs)
