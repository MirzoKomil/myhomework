from playwright.sync_api import sync_playwright
import sys
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append('c:'+m.text))
    pg.goto('file://'+d+'rr/'+sys.argv[1]); pg.wait_for_timeout(500); print(errs)
