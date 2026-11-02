import sys
from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
f=sys.argv[1]; pre=sys.argv[2]; acts=sys.argv[3:]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg=b.new_page(viewport={'width':1440,'height':960})
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+d+'rr/'+f); pg.wait_for_timeout(500)
    pg.screenshot(path=d+'pages/sot/shots/'+pre+'0.png')
    for i,a in enumerate(acts):
        kind,_,arg=a.partition(':')
        if kind=='click': pg.click(arg)
        elif kind=='demo': pg.click('.dmb >> text="'+arg+'"')
        elif kind=='key': pg.keyboard.press(arg)
        elif kind=='fill':
            sel,val=arg.split('=',1); pg.fill(sel,val)
        elif kind=='wait': pg.wait_for_timeout(int(arg))
        elif kind=='eval': print(pg.evaluate(arg))
        pg.wait_for_timeout(250)
        if kind not in ('wait','eval'): pg.screenshot(path=d+'pages/sot/shots/'+pre+str(i+1)+'.png')
    print('ERR',errs[:5])
    b.close()
