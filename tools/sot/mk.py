import sys, re, shutil
S = '/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad/'
P = S + 'artifact-files/4ca862e0-d7fb-4492-a28b-ba71c68598aa/project/'
D = S + 'sot/'
SRC = open(P + 'RopKLeadsC.dc.html').read().split('\n')
rd = lambda f: open(D + f).read()
NAVT = open(S + 'pages/sot/nav.txt').read().rstrip('\n')
NAVJS = open(S + 'pages/sot/navjs.txt').read().rstrip('\n') + '\n' + open(S + 'pages/sot/mknav.txt').read().rstrip('\n')

def build(MODE, out, title):
    L = SRC[:]  # 0-indexed: line n -> L[n-1]
    ops = {}  # line -> replacement text (string, may be multi-line) ; None = delete
    def setl(n, txt): ops[n] = txt
    def sub(n, a, b, cnt=1):
        cur = ops.get(n, L[n - 1])
        assert cur.count(a) == cnt, (n, a[:60], cur.count(a))
        ops[n] = cur.replace(a, b)
    def dele(a, b):
        for n in range(a, b + 1): ops[n] = None
    # ---------- template ----------
    sub(5, 'ROP kompyuter — Lidlar (C v5)', title)
    sub(178, '</style>', rd('css.txt') + """.sk-demo{flex:none;display:flex;align-items:center;gap:2px;padding:3px;border:1.5px dashed #7C3AED;border-radius:12px;background:#FFFFFF}
.sk-demo>span{font-size:11px;font-weight:800;color:#5B21B6;padding:0 5px;letter-spacing:.04em}
.sk-demo button{height:28px;padding:0 8px;border-radius:8px;border:0;background:transparent;font-size:12px;font-weight:700;color:#3A4456;cursor:pointer;white-space:nowrap}
.sk-demo button[aria-pressed="true"]{background:#7C3AED;color:#FFFFFF}
</style>""")
    sub(182, ' M — menejer.', '')
    nav = NAVT
    if MODE == 'stale': nav = nav.replace('<nav aria-label="Asosiy menyu" class="{{ sbCls }}">', '<nav aria-label="Asosiy menyu" class="{{ sbCls }}" inert="{{ bgInert }}">')
    setl(184, nav); dele(185, 195)
    if MODE == 'stale': sub(197, 'position: relative">', 'position: relative" inert="{{ bgInert }}">')
    sub(199, 'width: 420px', 'width: ' + ('250px' if MODE == 'stale' else '300px'))
    DEMO = '<div class="sk-demo" role="group" aria-label="Dizayn holatlari (faqat kanvas uchun)"%s><span>HOLAT</span><sc-for list="{{ demo }}" as="d" hint-placeholder-count="5"><button type="button" aria-pressed="{{ d.on }}" onClick="{{ d.pick }}" title="{{ d.tip }}">{{ d.t }}</button></sc-for></div>'
    PILL = '<sc-if value="{{ pillOn }}" hint-placeholder-val="{{ false }}"><div class="sk-pill" role="status" aria-live="off" title="Bugungi 5 daqiqalik imtiyoz — tugagach qulf oynasi yana ochiladi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg><span id="skPillT">{{ pillT }}</span></div></sc-if>'
    if MODE == 'stale':
        sub(201, '<span style="position: relative; display: inline-flex"><button type="button" class="ic" onClick="{{ openKeys }}"', PILL + '\n      <span style="position: relative; display: inline-flex"><button type="button" class="ic" onClick="{{ openKeys }}"')
    if MODE != 'stale':
        sub(201, '<span style="position: relative; display: inline-flex"><button type="button" class="ic" onClick="{{ openKeys }}"', DEMO % '' + '\n      <span style="position: relative; display: inline-flex"><button type="button" class="ic" onClick="{{ openKeys }}"')
    sub(204, 'aria-label="Bildirishnomalar, 9 dan ortiq"', 'aria-label="Bildirishnomalar, 3 ta oʻqilmagan"')
    sub(204, '>9+</span>', '>3</span>')
    setl(205, '      <span style="display: flex; align-items: center; gap: 10px"><span aria-hidden="true" style="width: 36px; height: 36px; border-radius: 50%; background: #5B21B6; color: #FFFFFF; display: grid; place-items: center; font-size: 13px; font-weight: 800">KS</span><span style="display: flex; flex-direction: column; line-height: 1.2"><strong style="font-size: 14px">Kamola Shahobiddinova</strong><span style="font-size: 12px; color: #4B5563">Sotuv menejeri · Rus tili</span></span></span>')
    dele(216, 216)  # menejer filtri
    dele(229, 229)  # + Lid qo'shish (prod: addLeadBtn faqat FULL_ACCESS_ROLES, app.js:22290)
    extra232 = (rd('queue.html') if MODE == 'call' else '') + rd('warn.html')
    if extra232: setl(232, L[231] + '\n' + extra232.rstrip('\n'))
    dele(236, 236)  # "Hammasi biriktirildi"
    sub(246, '<sc-if value="{{ c.pickBtn }}" hint-placeholder-val="{{ false }}"><button type="button" class="pk" onClick="{{ c.pickAll }}" title="Ustundagi barcha menejersiz lidlarni belgilash">{{ c.pickBtn }}</button></sc-if>', '')
    sub(259, 'aria-keyshortcuts="Enter F2 Space Shift+Space M S"', 'aria-keyshortcuts="Enter F2 Space Shift+Space S"')
    PH = 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z'
    sub(274, 'href="{{ k.ph1h }}" title="Qoʻngʻiroq qilish"', 'href="{{ k.ph1h }}" onClick="{{ k.callTel }}" title="{{ k.telT }}"')
    sub(235, 'onScroll="{{ onBoardScroll }}">', 'onScroll="{{ onBoardScroll }}" data-picking="{{ picking }}">')
    ops[287] = None
    # bulk bar: ommaviy biriktirish yo'q
    setl(307, '        <strong style="font-size: 14px" aria-live="polite">{{ pickN }} ta lid tanlandi</strong>')
    setl(308, '        <button type="button" onClick="{{ bulkSms }}" aria-haspopup="dialog" style="height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid #3A4456; background: transparent; color: #FFFFFF; font-size: 13px; font-weight: 700; cursor: pointer">SMS yuborish</button>')
    setl(309, '        <span class="sk-df" title="Prodda sotuv menejeri kartani belgilay olmaydi (checkbox faqat admin/ROP — app.js renderLeadCard :20894) va ommaviy panel yashirin (:21480). Belgilash egasi qarori bilan saqlandi; ommaviy biriktirish va “Teng taqsimlash” olib tashlandi. Tanlanganlarga SMS — taklif." style="background: #1E1B4B; color: #DDD6FE; border-color: #7C3AED">Dizayn farqi</span>')
    dele(310, 311)
    dele(321, 321)  # menyu: Menejer biriktirish
    dele(329, 362)  # menejer tanlash popover + teng taqsimlash
    sub(403, '<a class="btn2" href="{{ dTelH }}"', '<a class="btn2" href="{{ dTelH }}" onClick="{{ dTelClick }}" title="{{ dTelT }}"')
    sub(406, '<h4 style="color: #B42318">SLA eslatmalari</h4>', '<h4 style="color: #B42318">Eslatmalar</h4>')
    setl(407, '          <div class="dsec"><h4>Kimning lidi</h4><div style="display: flex; align-items: center; gap: 10px"><span class="av" aria-hidden="true" style="{{ dMgrAv }}">{{ dMgrIni }}</span><div style="flex: 1"><strong style="font-size: 14px">{{ dMgr }}</strong><div style="font-size: 12px; color: #4B5563">Masʼul sotuv menejeri · siz. Lidni boshqa menejerga faqat ROP oʻtkazadi.</div></div></div></div>')
    sub(427, 'Menejerga yuborilgan — ROP kuzatadi', 'Ochilganda oʻqilgan hisoblanadi')
    sub(439, '</label></sc-for></div>', '</label></sc-for></div>\n        <span class="sk-muted" aria-live="polite" style="font-weight: 700">{{ smsSeg }}</span>')
    sub(927, "total: ql ? cols.reduce((a, c) => a + c.cards.length, 0) : totalAll, totalLab: ql ? 'Topildi' : 'Jami',", "total: ql ? cols.reduce((a, c) => a + c.cards.length, 0) : ALLCOLS.reduce((a, c) => a + c[3] + delta[c[0]], 0) + ' jami', totalLab: ql ? 'Topildi' : OPEN_ST.reduce((a, id) => a + ALLCOLS.find(c => c[0] === id)[3] + delta[id], 0) + ' ochiq ·',")
    dele(446, 460)  # lid qo'shish oynasi
    ins = rd('sheets.html').replace('__STALE_SHEETS__\n', rd('stale_sheets.html') if MODE == 'stale' else '')
    if MODE != 'leads': ins = rd('cr.html') + ins
    if MODE == 'stale': ins = rd('gate.html') + ins
    setl(469, ins.rstrip('\n') + '\n' + L[468])
    if MODE == 'stale': setl(481, '  ' + DEMO % ' style="position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 97; box-shadow: 0 6px 18px rgba(16,24,40,.12)"')  # qulf oynasi ustida ham bosiladi (faqat kanvas)
    else: dele(481, 481)
    # ---------- JS ----------
    setl(504, "    const MODE = '" + MODE + "';\n" + NAVJS + "\n    const vb = false;"); dele(505, 520)
    setl(521, "    const MGR = [{ id: 'Kamola', full: 'Kamola Shahobiddinova', sh: 'Kamola S.', load: 35, c: '#5B21B6' }];")
    setl(522, "    const MGR_OFF = [];"); setl(523, "    MGR.forEach(m => { m.tel = '+998 99 517 64 02'; });")
    setl(527, rd('seed.txt').rstrip('\n')); dele(528, 575)
    sub(577, "'Menejersiz 30 daqiqadan oshgan yangi lidlar (SLA)'", "'30 daqiqadan koʻp kutayotgan yangi lidlar'")
    sub(590, 'const T = 34,', 'const T = ALLCOLS[1][3],')
    sub(610, "cid === 'new' ? '' : 'Robiya'", "'Kamola'")
    sub(611, 'VIRT_NEW', '0')
    setl(614, "    const nav = mkNav().map(n => Object.assign({}, n, { cur: n.k === 'leads' ? 'page' : 'false', pick: () => { if (!n.item || n.k === 'leads') return; this.setState({ toast: { text: n.label, sub: 'Alohida sahifa ochiladi' + (n.k === 'book' ? ' (Lidlar sarlavhasidagi tab bilan bir xil)' : ''), kind: 'ok' } }); this.armToast(); } }));")
    setl(618, L[617] + '\n' + rd('common_js.txt').rstrip('\n'))
    sub(623, "const back = key => s.drw ?", "const back = key => gOpenNow ? '[data-gate]' : s.drw ?")
    sub(627, "const from = colOf(key); if (!from || from === to) return;", "const from = colOf(key); if (!from || from === to) return;\n      // prod: staleLeads.js wrapSifatsiz — Yangi/Urinilmoqda lidni 24 soat ichida qoʻngʻiroqsiz Sifatsizga oʻtkazib boʻlmaydi\n      if (to === 'junk' && (from === 'new' || from === 'try') && !recentCall(key)) { this.setState({ menu: '', sub: false, survey: null, sh: { t: 'cf', key } }); this.focusSoon('[data-sheet] .sk-bpri'); return; }")
    setl(637, "    // sotuv menejeri faqat oʻz eslatmalarini koʻradi (app.js getLeadSlaCardAlerts :19407); ochilganda oʻqilgan boʻladi\n    const alertsOf = (key, k) => { const a = []; if (k.late) { if (!(s.fuSet || {})[key]) a.push({ id: 'late', t: 'Qoʻngʻiroq muddati oʻtdi: ' + (k.next || ''), rop: false }); } else if (k.notif) a.push({ id: 'sla', t: 'Yangi lid ' + k.age + ' kutmoqda — tezroq qoʻngʻiroq qiling', rop: false }); return a.filter(x => !(s.ack || {})[key + ':' + x.id]); };")
    setl(638, "    const unreadOf = (key, k) => (s.readRop || {})[key] ? 0 : alertsOf(key, k).length;")
    setl(644, "    const watchOf = () => 0;")
    sub(656, "(isUn(x) && (x.k.m || 0) >= 30)", "((x.k.m || 0) >= 30)")
    sub(692, "filtered ? 'Filtr boʻyicha lid yoʻq' : 'Lidlar yoʻq'", "filtered ? 'Filtr boʻyicha lid yoʻq' : id === 'new' ? 'Yangi lidlarni ROP biriktiradi — kelishi bilan bildirishnoma keladi' : 'Lidlar yoʻq'")
    sub(711, " + ', ' + (m ? m.sh : 'menejersiz')", "")
    sub(712, "note: k.note && !m ? 'Menejeri ketgan' : '',", "note: '', telT: MODE === 'call' ? 'Qoʻngʻiroq qilish — urinish yoziladi, natija oynasi ochiladi' : 'Qoʻngʻiroq qilish', callTel: () => { if (MODE === 'call' && OPEN_ST.indexOf(id) >= 0) openCr(key, '[data-card="' + key + '"] .ph'); },")
    dele(727, 727)
    sub(741, "'Qotgan lid: 5-kun — qulflangan'", "'Qotgan lid: 5-kun — ilova shu lid hal boʻlguncha qulflanadi'")
    sub(741, "'3-kun: menejer ogohlantirildi'", "(k.sd >= 4 ? '4-kun: ertaga ilova shu lid bilan qulflanadi' : '3-kun: ogohlantirish — 5-kun ilova qulflanadi')")
    js855 = rd('warn_js.txt') + (rd('call_js.txt') if MODE != 'leads' else '') + (rd('stale_js.txt') if MODE == 'stale' else '')
    if js855: setl(855, js855.rstrip('\n') + '\n' + L[854])
    ret = rd('common_ret.txt') + rd('warn_ret.txt') + (rd('call_ret.txt') if MODE != 'leads' else '') + (rd('stale_ret.txt') if MODE == 'stale' else '') + ("      qShow: false,\n" if MODE == 'stale' else '')
    setl(861, L[860] + '\n' + ret.rstrip('\n'))
    sub(862, " reassignN: reassign ? '· ' + reassign + ' tasi boshqa menejerda — qayta biriktiriladi' : '',", "")
    sub(876, "aud: a.rop ? 'ROPʼga' : 'Menejerga'", "aud: 'Sizga'")
    sub(877, "aud: a.rop ? 'ROPʼga' : 'Menejerga'", "aud: 'Sizga'")
    sub(877, "canAck: a.rop, watch: !a.rop,", "canAck: false, watch: true,")
    sub(897, "smsTo: s.sms ? s.sms.n + ' — ' + s.sms.ph : '',", "smsTo: s.sms ? (s.sms.bulk ? s.sms.n + ': ' + s.sms.names + ' — har biriga oʻz ismi bilan' : s.sms.n + ' — ' + s.sms.ph) : '', bulkSms: () => { const nm = pickKeys.map(k => String(cardOf(k).n || '').split(' ')[0]); this.setState({ sms: { key: pickKeys[0], n: pickN + ' ta lid', ph: '', bulk: true, cnt: pickN, names: nm.slice(0, 3).join(', ') + (nm.length > 3 ? ' va yana ' + (nm.length - 3) : '') }, smsT: 0, smsErr: false }); this.focusSoon('[aria-labelledby=smsT] input'); },")
    sub(898, "s.sms ? String(s.sms.n || '') : ''", "s.sms ? (s.sms.bulk ? '{ism}' : String(s.sms.n || '')) : ''")
    sub(899, "this.setState({ smsBusy: false, sms: null, smsErr: false, toast: { text: 'SMS yuborildi', sub: sm ? sm.n + ' · ' + sm.ph : '', kind: 'ok' } });", "this.setState({ smsBusy: false, sms: null, smsErr: false, picked: sm && sm.bulk ? {} : this.state.picked, toast: { text: 'SMS yuborildi', sub: sm ? sm.n + (sm.ph ? ' · ' + sm.ph : '') : '', kind: 'ok' } });")
    dele(900, 905); dele(908, 915)
    sub(990, "['M', 'Menejer biriktirish'], ", "")
    dele(1028, 1035); dele(1037, 1048)
    if MODE == 'leads':
        demo = "      demo: [['ok', 'Oddiy'], ['load', 'Yuklanmoqda'], ['err', 'Xato'], ['empty', 'Boʻsh'], ['save', 'Saqlanmoqda']].map(d => ({ t: d[1], tip: '', on: s.demo === d[0] ? 'true' : 'false', pick: () => this.setState({ demo: d[0], drw: null, survey: null, sh: null }) }))"
    elif MODE == 'call':
        demo = "      demo: [['ok', 'Oddiy'], ['res', 'Natija oynasi'], ['load', 'Yuklanmoqda'], ['err', 'Xato'], ['empty', 'Boʻsh']].map(d => ({ t: d[1], tip: d[0] === 'res' ? 'Navbatdagi birinchi lid uchun natija oynasi' : d[0] === 'err' ? 'Saqlash xatosi (natija oynasida ham)' : '', on: (d[0] === 'res' ? !!s.cr : s.demo === d[0] && !s.cr) ? 'true' : 'false', pick: () => { if (d[0] === 'res') { this.setState({ demo: 'ok', qSkip: 0 }); setTimeout(() => { const r = this.renderVals(); r.qCall(); }, 20); return; } this.setState({ demo: d[0], cr: null, drw: null, survey: null, sh: null }); } }))"
    else:
        demo = "      demo: [['ok', 'Oddiy', 'Qulf: 5-kun lidlari bor (majburiy oyna)'], ['warn', 'Ogohlantirish', '3–4 kunlik lidlar bor, qulf yoʻq'], ['grace', 'Imtiyoz', '5 daqiqalik erkin rejim yoqilgan'], ['used', 'Imtiyozsiz', 'Bugungi imtiyoz ishlatilgan'], ['load', 'Yuklanmoqda', ''], ['err', 'Xato', 'Saqlash xatosi'], ['empty', 'Boʻsh', 'Qotgan lid yoʻq']].map(d => ({ t: d[1], tip: d[2], on: s.demo === d[0] ? 'true' : 'false', pick: () => { clearInterval(this._pi); this._pi = null; clearTimeout(this._gdT); this._gdT = null; const st = { demo: d[0], moved: {}, movedInfo: {}, calls: {}, coms: {}, gInit: null, gClosed: false, graceOn: false, graceUsed: d[0] === 'used', sh: null, survey: null, drw: null, flow: null, toast: null }; if (d[0] === 'grace') { st.graceOn = true; st.graceUsed = true; } this.setState(st); if (d[0] === 'grace') startGrace(); this.focusSoon(d[0] === 'ok' || d[0] === 'used' || d[0] === 'err' ? '[data-gate]' : '[data-card]'); } }))"
    setl(1067, demo)
    out_lines = []
    for i, line in enumerate(L, 1):
        if i in ops:
            if ops[i] is None: continue
            out_lines.append(ops[i])
        else: out_lines.append(line)
    t = '\n'.join(out_lines)
    js_start = t.index('class Component')
    head, js = t[:js_start], t[js_start:]
    js = js.replace('Islom M. (ROP)', 'Kamola S.').replace('Islom M.', 'Kamola S.')
    t = head + js
    for bad in ['Islom', 'menejersiz', 'Menejersiz', 'ROP tili']:
        if bad in t: print('WARN leftover', bad, t.count(bad))
    open(P + out, 'w').write(t)
    shutil.copy(P + out, S + 'rr/' + out)
    open(D + out + '.js', 'w').write(js.split('</script>')[0])
    print('wrote', out, len(t))

build('leads', 'SotKLeads.dc.html', 'Sotuv kompyuter — Lidlar')
build('call', 'SotKL_Call.dc.html', 'Sotuv kompyuter — Qoʻngʻiroq natijasi')
build('stale', 'SotKL_Stale.dc.html', 'Sotuv kompyuter — Qotgan lidlar')
