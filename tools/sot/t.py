from playwright.sync_api import sync_playwright
import sys
d='/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
o=d+'sot/'
which=sys.argv[1:] or ['leads','call','stale']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def page(f):
        pg=b.new_page(viewport={'width':1440,'height':960}); pg.add_init_script("document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^=\"tel:\"]');if(a)e.preventDefault()},true)"); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto('file://'+d+'rr/'+f); pg.wait_for_timeout(500); return pg,errs
    sh=lambda pg,n: pg.screenshot(path=o+n+'.png')
    if 'leads' in which:
        pg,errs=page('SotKLeads.dc.html'); sh(pg,'L1')
        print('cards',pg.evaluate("document.querySelectorAll('[data-card]').length"), 'nav', pg.inner_text('nav')[:300].replace('\n','|'))
        pg.click('[data-card=try1] .nm'); pg.wait_for_timeout(100); sh(pg,'L2drw')
        pg.click('#dt_not'); pg.wait_for_timeout(100); sh(pg,'L3not')
        pg.click('[aria-label="Lid kartasini yopish"]'); pg.wait_for_timeout(100)
        # select + shift range
        pg.click('[data-card=try0] .tm'); pg.click('[data-card=try2] .tm', modifiers=['Shift']); pg.wait_for_timeout(100); sh(pg,'L4sel')
        pg.click('text=SMS yuborish'); pg.wait_for_timeout(100); sh(pg,'L5sms'); pg.click('[aria-labelledby=smsT] .btn2')
        pg.click('text=Bekor qilish'); pg.wait_for_timeout(100)
        # sifatsiz without call -> call-first
        pg.click('[data-mk=try1]'); pg.click('text=Boshqa bosqichga oʻtkazish'); pg.click('[data-sub] >> text=Sifatsiz lidlar'); pg.wait_for_timeout(100); sh(pg,'L6cf')
        pg.click('[data-sheet] .sk-bpri'); pg.wait_for_timeout(100)
        pg.click('[data-mk=try1]'); pg.click('text=Boshqa bosqichga oʻtkazish'); pg.click('[data-sub] >> text=Sifatsiz lidlar'); pg.wait_for_timeout(100); sh(pg,'L7junk')
        pg.click('[data-modal] button:has-text("Bekor qilish")')
        for t in ['Yuklanmoqda','Xato','Boʻsh']:
            pg.click('.sk-demo button:has-text("%s")'%t); pg.wait_for_timeout(100); sh(pg,'L_'+t[:3])
        print('leads errors',errs); pg.close()
    if 'call' in which:
        pg,errs=page('SotKL_Call.dc.html'); sh(pg,'C1')
        print('queue', pg.inner_text('.sk-q').replace('\n','|'))
        pg.click('[data-qcall]'); pg.wait_for_timeout(100); sh(pg,'C2res')
        pg.click('[data-out=noanswer]'); pg.click('[data-cr] button:has-text("Ertaga 10:00")'); pg.click('.sk-chips button:has-text("Kechqurun qulay")'); pg.wait_for_timeout(100); sh(pg,'C3noans')
        pg.click('[data-cr] .btnp'); pg.wait_for_timeout(200); sh(pg,'C4after')
        print('queue2', pg.inner_text('.sk-q').replace('\n','|'))
        # new lead talked -> anketa
        pg.click('[data-card=try7] .ph'); pg.wait_for_timeout(100); pg.click('[data-out=talked]'); pg.click('[data-cr] .btnp'); pg.wait_for_timeout(150); sh(pg,'C5anketa')
        pg.evaluate("document.querySelector('[data-cr],[data-modal]') && document.querySelector('[data-cr],[data-modal]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); pg.wait_for_timeout(100)
        pg.click('[data-card=try1] .ph'); pg.wait_for_timeout(100); sh(pg,'C6six')
        pg.click('[data-out=fail]'); pg.click('[data-cr] .btnp'); pg.wait_for_timeout(150); sh(pg,'C7fail')
        pg.evaluate("document.querySelector('[data-cr],[data-modal]') && document.querySelector('[data-cr],[data-modal]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        pg.click('.sk-demo button:has-text("Xato")'); pg.click('[data-qcall]'); pg.click('[data-out=later]'); pg.click('[data-cr] .btnp'); pg.wait_for_timeout(100); sh(pg,'C8err')
        pg.evaluate("document.querySelector('[data-cr],[data-modal]') && document.querySelector('[data-cr],[data-modal]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        for t in ['Yuklanmoqda','Boʻsh']:
            pg.click('.sk-demo button:has-text("%s")'%t); pg.wait_for_timeout(100); sh(pg,'C_'+t[:3])
        pg.click('.sk-demo button:has-text("Oddiy")'); pg.click('.sk-qskip'); pg.wait_for_timeout(100); print('skip', pg.inner_text('.sk-qn'))
        print('call errors',errs); pg.close()
    if 'stale' in which:
        pg,errs=page('SotKL_Stale.dc.html'); sh(pg,'S1')
        pg.click('.sk-dim', position={'x':100,'y':100}); pg.wait_for_timeout(100); sh(pg,'S2blocked'); pg.click('text=Lidlarga qaytish')
        pg.click('[data-lock=try1] .sk-block'); pg.wait_for_timeout(100); sh(pg,'S3cf'); pg.click('[data-sheet] .sk-bpri'); pg.wait_for_timeout(150); sh(pg,'S4called'); pg.click('[data-cr] .sk-link:has-text("Keyin")'); pg.wait_for_timeout(100)
        pg.click('[data-lock=try0] .sk-bred'); pg.wait_for_timeout(100); sh(pg,'S5sif'); pg.click('[data-sheet] .sk-bred'); pg.wait_for_timeout(100); sh(pg,'S6one')
        pg.click('[data-lock=try1] .sk-bghost'); pg.wait_for_timeout(100); sh(pg,'S7anketa')
        pg.click('text=Juda zarur ishim bor') if False else None
        pg.evaluate("document.querySelector('[data-cr],[data-modal]') && document.querySelector('[data-cr],[data-modal]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); pg.wait_for_timeout(100)
        pg.click('[data-lock=try1] .sk-bred'); pg.click('[data-sheet] .sk-bred'); pg.wait_for_timeout(200); sh(pg,'S8done'); pg.wait_for_timeout(1900); sh(pg,'S9closed')
        pg.click('.sk-demo button:has-text("Oddiy")'); pg.wait_for_timeout(100)
        pg.click('text=Juda zarur ishim bor'); pg.wait_for_timeout(100); sh(pg,'S10grace'); pg.click('text=Ha, ishim zarur'); pg.wait_for_timeout(1300); sh(pg,'S11pill')
        for t in ['Ogohlantirish','Imtiyozsiz','Yuklanmoqda','Xato','Boʻsh']:
            pg.click('.sk-demo button:has-text("%s")'%t); pg.wait_for_timeout(150); sh(pg,'S_'+t[:4])
        print('stale errors',errs); pg.close()
    b.close()
