from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
o=d+'pages/sla/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+d+'rr/RopK_Sla.dc.html'); pg.wait_for_timeout(800)
    sh=lambda n: pg.screenshot(path=o+n+'.png')
    cnt=lambda: pg.evaluate("document.querySelectorAll('[data-row]').length")
    print('rows',cnt(), pg.inner_text('.cnt >> nth=2'))
    sh('1def')
    pg.evaluate("document.querySelector('main').scrollTop=900"); pg.wait_for_timeout(100); sh('2scroll')
    pg.evaluate("document.querySelector('main').scrollTop=0")
    pg.click('[data-row=malika] .sl-nm'); pg.wait_for_timeout(100); sh('3drawer')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('[data-row=rustam] .btnp'); pg.wait_for_timeout(600); sh('4ack'); print('after ack',cnt(), pg.inner_text('.cnt >> nth=2'))
    pg.click('.sl-undo'); pg.wait_for_timeout(100); print('after undo',cnt())
    pg.click('[data-row=shohruh] button:has-text("Biriktirish")'); pg.wait_for_timeout(100); sh('5asg')
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    pg.click('[data-asg] .btnp'); pg.wait_for_timeout(100); sh('6asgd')
    pg.click('[data-row=javlon] button:has-text("ga yozish")'); pg.wait_for_timeout(100)
    pg.click('.sl-mr[aria-label^="Hamidaxon"]'); pg.wait_for_timeout(100); sh('7fm')
    pg.select_option('.sl-sel','qaror-jarayonida'); pg.wait_for_timeout(100); sh('8fs')
    pg.select_option('.sl-sel','tolov-jarayonida'); pg.wait_for_timeout(100); sh('9fempty')
    pg.click('.box >> text=Filtrni tozalash'); pg.wait_for_timeout(100); print('cleared',cnt())
    for i,t in enumerate(['Yuklanmoqda','Xato','Boʻsh','Saqlash xatosi']):
        pg.click('.dmb:has-text("%s")'%t); pg.wait_for_timeout(150); sh('s%d'%i)
        if t=='Saqlash xatosi':
            pg.click('[data-row=rustam] .btnp'); pg.wait_for_timeout(600); sh('s3b'); print('saveErr rows',cnt())
    print('errors',errs)
    b.close()
