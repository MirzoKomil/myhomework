from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
o=d+'pages/plan/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+d+'rr/RopK_Plan.dc.html'); pg.wait_for_timeout(800)
    sh=lambda n: pg.screenshot(path=o+n+'.png')
    sh('1team')
    pg.evaluate("document.querySelector('main').scrollTop=900"); pg.wait_for_timeout(100); sh('2scroll')
    pg.evaluate("document.querySelector('main').scrollTop=0")
    pg.click('.pl-per:has-text("1–10")'); pg.wait_for_timeout(100); print(pg.inner_text('.pl-tier >> nth=1')[:200])
    print('ro', pg.evaluate("document.querySelector('#spManagers').readOnly"))
    pg.click('#plTabInd'); pg.wait_for_timeout(150); sh('3ind')
    pg.click('.pl-mrow[aria-label^="Kamola"]'); pg.wait_for_timeout(100); sh('4ks')
    pg.click('.pl-mrow[aria-label^="Robiya"]'); pg.wait_for_timeout(100); sh('5ru')
    pg.select_option('#plMgr','HB'); pg.select_option('#plMonth','2026-10'); pg.wait_for_timeout(100); sh('6oct')
    pg.select_option('#plMonth','2027-01'); pg.wait_for_timeout(100); sh('7carry')
    pg.select_option('#plMonth','2026-06'); pg.wait_for_timeout(100); print(pg.inner_text('.pl-empty')[:120])
    pg.keyboard.press('Tab')
    for t in ['Yuklanmoqda','Xato','Fakt yoʻq','Eski reja','Menejer yoʻq']:
        pg.click('.dmb:has-text("%s")'%t); pg.wait_for_timeout(150); sh('s_'+t[:3])
    pg.click('.dmb:has-text("Fakt yoʻq")'); pg.click('#plTabTeam'); pg.wait_for_timeout(100); pg.evaluate("document.querySelector('main').scrollTop=900"); sh('s_nofact_team')
    pg.click('.dmb:has-text("Xato")'); pg.click('.malert .btn2'); pg.wait_for_timeout(100); print('retry ok', pg.locator('.pl-tier').count())
    print('errors',errs)
    b.close()
