import sys
from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for f,o in zip(sys.argv[1::2],sys.argv[2::2]):
        pg=b.new_page(viewport={'width':1440,'height':960}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto('file://'+d+'rr/'+f); pg.wait_for_timeout(1200); pg.screenshot(path=o); print(f,errs[:3]); pg.close()
    b.close()
