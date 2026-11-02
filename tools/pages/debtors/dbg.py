from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960})
    pg.goto('file://'+d+'rr/RopK_Debtors.dc.html'); pg.wait_for_timeout(400)
    pg.click('[data-menu="s4"]'); pg.wait_for_timeout(150)
    print(pg.locator('.db-mn').count(), pg.evaluate('document.activeElement.outerHTML.slice(0,120)'))
    b.close()
