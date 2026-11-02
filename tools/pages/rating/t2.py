from playwright.sync_api import sync_playwright
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=b.new_page(viewport={'width':1440,'height':960})
    pg.goto('file://'+d+'rr/RopK_Rating.dc.html'); pg.wait_for_timeout(800)
    pg.click('button:has-text("Ustozlar") >> nth=0'); pg.wait_for_timeout(200)
    print(pg.evaluate("""(()=>{const b=document.querySelector('.rb-mon button');const c=getComputedStyle(b);return [b.outerHTML.slice(0,200),c.display,c.width,c.opacity,c.visibility,c.position]})()"""))
    b.close()
