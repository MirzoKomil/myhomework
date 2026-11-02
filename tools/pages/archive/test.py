from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
o=d+'pages/archive/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+d+'rr/RopK_Archive.dc.html'); pg.wait_for_timeout(800)
    sh=lambda n: pg.screenshot(path=o+n+'.png')
    cnt=lambda: pg.evaluate("document.querySelectorAll('[data-row]').length")
    print('rows',cnt()); sh('1def')
    pg.click('[data-row="a-stu-sev"] .ax-nm'); pg.wait_for_timeout(100); sh('2detail')
    pg.click('[data-drestore]'); pg.wait_for_timeout(100); sh('3cf')
    pg.click('[data-yes]'); pg.wait_for_timeout(200); sh('3busy'); pg.wait_for_timeout(700); sh('4done'); print('after restore rows',cnt())
    pg.click('[data-row="lead:7f21"] .btnp'); pg.wait_for_timeout(100); pg.keyboard.press('Escape'); pg.wait_for_timeout(100); print('cf closed', pg.query_selector('[data-cf]') is None)
    pg.click('[data-row="lead:7f21"] .btnp'); pg.wait_for_timeout(100); pg.click('[data-yes]'); pg.wait_for_timeout(900); sh('5lead'); print('toast', pg.inner_text('.ax-toast'))
    pg.click('button:has-text("Yana yuklash")'); pg.wait_for_timeout(100); print('more rows',cnt())
    pg.click('[data-row="a-lead-bob"] .btnp'); pg.wait_for_timeout(100); pg.click('[data-yes]'); pg.wait_for_timeout(900); sh('6conflict')
    pg.click('[data-cf] .btn2'); pg.wait_for_timeout(100)
    pg.click('[data-type=lead]'); pg.wait_for_timeout(100); sh('7leads')
    pg.select_option('[data-st]','restored'); pg.wait_for_timeout(100); sh('8restored'); print('restored rows',cnt())
    pg.click('[data-row="a-lead-mal"] .ax-nm'); pg.wait_for_timeout(100); sh('8b')
    pg.fill('[data-q]','zzz'); pg.wait_for_timeout(100); sh('9fempty')
    pg.click('.ax-empty .btn2'); pg.wait_for_timeout(100); print('cleared rows',cnt())
    pg.click('[data-type=locked]'); pg.wait_for_timeout(100); sh('10locked')
    for t in ['Yuklanmoqda','Xato','Boʻsh','Tiklash xatosi']:
        pg.click('.dmb:has-text("%s")'%t); pg.wait_for_timeout(150)
        if t=='Tiklash xatosi':
            pg.click('[data-row="a-book-2"] .btnp'); pg.wait_for_timeout(100); pg.click('[data-yes]'); pg.wait_for_timeout(900)
        sh('s_'+t.split()[0].replace('ʻ',''))
    print('errors',errs)
    b.close()
