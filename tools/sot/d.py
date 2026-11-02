from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960}); pg.goto('file://'+d+'rr/SotKLeads.dc.html'); pg.wait_for_timeout(400)
    pg.click('[data-card=try1] .nm'); pg.wait_for_timeout(100); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    print(pg.evaluate("[...document.querySelectorAll('div[aria-hidden=true]')].map(e=>e.getAttribute('style')).slice(0,5)"))
    print(pg.evaluate("document.activeElement.outerHTML.slice(0,100)"))
