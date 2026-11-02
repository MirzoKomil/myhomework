from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
o=d+'pages/trials/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+d+'rr/RopK_Trials.dc.html'); pg.wait_for_timeout(800)
    sh=lambda n: pg.screenshot(path=o+n+'.png')
    sh('1def')
    pg.evaluate("document.querySelector('main').scrollTop=600"); pg.wait_for_timeout(100); sh('2scroll')
    # remind sardor
    pg.click('[data-att=sardor] button:has-text("Ustozga eslatish")'); pg.wait_for_timeout(100); sh('3remind')
    # assign aziza
    pg.click('[data-att=aziza] button:has-text("Ustoz biriktirish")'); pg.wait_for_timeout(700); sh('4assign')
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    pg.click('.tn-df .btnp'); pg.wait_for_timeout(900); sh('5assigned')
    # bekzod agree
    pg.click('[data-att=bekzod] button:has-text("kelishish")'); pg.wait_for_timeout(100); sh('6agree')
    pg.click('[data-agree] .btnp'); pg.wait_for_timeout(200)
    # kamila admin
    pg.click('[data-att=kamila] button:has-text("Admin ochsin")'); pg.wait_for_timeout(100); sh('7ask')
    pg.click('[data-ask] .btnp'); pg.wait_for_timeout(200); sh('8asked')
    # otabek rejected -> assign with time chips
    pg.click('[data-att=otabek] button:has-text("Ustoz biriktirish")'); pg.wait_for_timeout(700)
    pg.click('.tn-chip >> nth=1'); pg.wait_for_timeout(100); sh('9rej')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    pg.click('button[aria-label^="Oldingi oy"]'); pg.wait_for_timeout(100); sh('10oct')
    for i,t in enumerate(['Yuklanmoqda','Xato','Hammasi joyida','Vaqt xatosi','Jadval xatosi','Saqlash xatosi']):
        pg.click('.dmb:has-text("%s")'%t); pg.wait_for_timeout(150); sh('s%d'%i)
        if t=='Xato': pg.click('text=Qayta urinish'); pg.wait_for_timeout(100); sh('s1b')
        if t=='Jadval xatosi':
            pg.click('[data-att=aziza] button:has-text("Ustoz biriktirish")'); pg.wait_for_timeout(600); sh('s4b')
            pg.click('.tn-drw >> text=Qayta urinish'); pg.wait_for_timeout(800); sh('s4c'); pg.keyboard.press('Escape')
        if t=='Saqlash xatosi':
            pg.click('[data-att=aziza] button:has-text("Ustoz biriktirish")'); pg.wait_for_timeout(600); pg.click('.tn-df .btnp'); pg.wait_for_timeout(900); sh('s5b')
    print('errors',errs)
    b.close()
