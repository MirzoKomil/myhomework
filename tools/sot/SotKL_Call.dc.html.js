class Component extends DCLogic {
  constructor(p) {
    super(p);
    this.state = { viaBadge: false, picked: {}, man: '', toast: null, done: {}, last: null, menu: '', menuXY: null, sub: false, sb: true, shut: {}, rfOpen: false, rf: {}, trialF: 'all', dd: '', q: '', drag: '', over: '', allNew: false, extra: 0, conf: false, dmode: 'range', date: 'Joriy oy', mgrF: 0, srcF: 0, colsOn: null, colsDraft: null, risk: '', kin: '', ph: {}, mp: '', mpXY: null, mq: '', moved: {}, assigned: {}, split: null, demo: 'ok', saving: '', survey: null, svr: '', mpView: 'list', excl: {}, loadAdd: {}, movedInfo: {}, loaded: {}, drw: null, sms: null, smsT: 0, add: false, addDup: true, lastMgr: '', sl: 0, scW: 0, svStep: 0, svf: {}, ack: {}, flow: null, addName: '', svTried: false, svErr: false, addTried: false, addErr: false, addPh: '+998 90 112 45 07', addPh2: '', smsErr: false, readRop: {}, coms: {}, comTxt: '', comTried: false, fu: false, fuSet: {} };
    this._t = null;
    try { const tf = localStorage.getItem('mh_trial_attendance_filter_v1'); if (['not-attended', 'all', 'attended'].indexOf(tf) >= 0) this.state.trialF = tf; } catch (er) {}
  }
  focusSoon(sel) { setTimeout(() => { const el = document.querySelector(sel); if (el && el.focus) el.focus(); }, 30); }
  armToast() { clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null, tp: false }), 10000); }
  rel(e, w, h) {
    const t = e && e.currentTarget; const root = t && t.closest ? t.closest('[data-root]') : null;
    if (!t || !root || !t.getBoundingClientRect) return { x: 300, y: 300 };
    const r = t.getBoundingClientRect(), R = root.getBoundingClientRect();
    let x = r.right - R.left - w, y = r.bottom - R.top + 4;
    if (x < 8) x = 8; if (y + h > R.height - 8) y = Math.max(8, r.top - R.top - h - 4);
    return { x, y };
  }
  renderVals() {
    const s = this.state;
    const MODE = 'call';
    const IC = {
      home: 'M3 10.5 12 4l9 6.5V20H3z', leads: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8z',
      cal: 'M3 9.5h18M8 3v3M16 3v3M5 4.5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2z', trial: 'M8.5 12l2.5 2.5 4.5-5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z',
      check: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', clock: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2', lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z', arch: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
      funnel: 'M3 4h18l-7 8v6l-4 2v-8z', rating: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z', plan: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 8a4 4 0 110 8 4 4 0 010-8z', debt: 'M2 6h20v13H2zM2 10h20',
      script: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h5', sms: 'M4 4h16v12H5l-1 4zM8 9h8M8 12h5', stu: 'M2 8l10-5 10 5-10 5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5', tg: 'M21 4L3 11l6 2 2 6 3-4 5 4z', book: 'M1 6h13v10H1zM14 9h4l3 3v4h-7zM5 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z'
    };
    const I = (k, label, icon, o) => Object.assign({ item: true, grp: false, k, label, tip: label, icon: IC[icon], cur: 'false', badge: '', aria: '', pick: () => this.setState({ viaBadge: false }), pickBadge: () => {} }, o || {});
    const G = l => ({ grp: true, item: false, label: l });
    const mkNav = (badges) => { const B = badges || {}; return [
      I('home', 'Bosh sahifa', 'home'), I('leads', 'Lidlar', 'leads', { badge: B.leads || '', aria: B.leads ? B.leads + ' ta lid qoʻngʻiroq kutmoqda' : '' }), I('cal', 'Dars jadvali', 'cal'), I('trial', 'Sinov darslari', 'trial'),
      I('stu', 'Oʻquvchilar', 'stu'), I('debt', 'Qarzdorlar', 'debt', { badge: B.debt || '', aria: B.debt ? B.debt + ' ta muddati oʻtgan qarz' : '' }), I('plan', 'Sotuv rejasi', 'plan'), I('rating', 'Reyting', 'rating'), I('script', 'Skriptlar', 'script', { tip: 'Skriptlar va yoʻriqnomalar' }),
      G('Boshqa'), I('funnel', 'Statistika', 'funnel', { tip: 'Statistika: mening voronkam' }), I('sms', 'SMS', 'sms', { tip: 'SMS rassilka (faqat oʻz lid va oʻquvchilarim)' }), I('book', 'Kitob yetkazish', 'book')
    ]; };
    const vb = false;
    const MGR = [{ id: 'Kamola', full: 'Kamola Shahobiddinova', sh: 'Kamola S.', load: 35, c: '#5B21B6' }];
    const MGR_OFF = [];
    MGR.forEach(m => { m.tel = '+998 99 517 64 02'; });
    const MG = {}; MGR.forEach(m => MG[m.id] = m);
    const avSt = m => 'background:' + m.c + ';color:#FFFFFF';
    // [id, nom, rang, jami]
    // Kamola Shahobiddinova (KS) — faqat oʻz lidlari (prod: filterLeadsByManager app.js:19862, server/routes/leads.js:285). Bu oy jami 53 ta.
    const ALLCOLS = [
      ['new', 'Yangi lidlar', '#2563EB', 0], ['try', 'Urinilmoqda', '#7C3AED', 12], ['con', 'Bogʻlanildi', '#0891B2', 5],
      ['trial', 'Sinov darsida', '#16A34A', 3], ['dec', 'Qaror jarayonida', '#EA580C', 4], ['defer', 'Keyin sotib olmoqchi', '#4F46E5', 3],
      ['pay', 'Toʻlov jarayonida', '#D97706', 0], ['paid', 'Toʻlov yopildi', '#059669', 13], ['fail', 'Muvaffaqiyatsiz sotuv', '#DC2626', 9], ['junk', 'Sifatsiz lidlar', '#64748B', 4]
    ];
    const DEF_ON = { new: 1, try: 1, con: 1, trial: 1, dec: 1, defer: 1, pay: 1, paid: 1 };
    const colsOn = s.colsOn || DEF_ON;
    const ql = s.q.trim().toLowerCase();
    const COLS = ALLCOLS.filter(c => colsOn[c[0]] || (ql && (c[0] === 'fail' || c[0] === 'junk')));
    const L = (n, time, age, lvl, src, phones, mgr, o) => Object.assign({ n, time, age, lvl, src, phones: (phones || []).map(p => { const d = String(p).replace(/\D/g, ''); return d.indexOf('998') === 0 ? p : '+' + d; }), mgr, stale: '', notif: 0, com: 0, rec: 0 }, o || {});
    // sd — menejerga berilganidan beri kun (staleLeads ageDays)
    // SotK_Funnel ALLOC.KS / SotKHome FUN bilan bir xil: 0/12/5/3/4/3/0 = 27 ochiq; 13/9/4 yopilgan → 53
    const CARDS = {
      new: [],
      try: [
        L('Rustam Toshev', '29-okt', '4 kun', 'late', 'Organik', ['+998 93 220 18 64'], 'Kamola', { stale: 'ogoh.', sk: 'warn', sd: 4, reason: 'Ishda — kechqurun 18:00 dan keyin', rk: 'later', notif: 1, com: 3, rec: 1, next: 'kecha 18:00', late: true }),
        L('Shahnoza Aliyeva', '29-okt', '4 kun', 'late', 'Target', ['+998 90 112 45 07'], 'Kamola', { stale: 'ogoh.', sk: 'warn', sd: 4, reason: 'Javob bermadi', rk: 'no', com: 4, rec: 2 }),
        L('Zilola Hamidova', '31-okt', '2 kun', 'warn', 'Target', ['+998 94 310 72 09'], 'Kamola', { sd: 2, reason: 'Javob bermadi', rk: 'no', com: 1 }),
        L('Jahongir Sobirov', '31-okt', '2 kun', 'warn', 'Target', ['+998 99 318 52 04'], 'Kamola', { sd: 2, reason: 'Band boʻldi', rk: 'busy', com: 2 }),
        L('Zarina Qosimova', '31-okt', '2 kun', 'warn', 'Target', ['+998 94 120 77 35'], 'Kamola', { sd: 2, reason: 'Band boʻldi', rk: 'busy', com: 1, next: 'ertaga 11:00' }),
        L('Feruza Mirzayeva', 'Kecha 09:10', '1 kun', 'warn', 'Organik', ['+998 91 233 08 71'], 'Kamola', { sd: 1, reason: 'Telefoni oʻchiq', rk: 'off', com: 1 }),
        L('Asror Nurmatov', 'Kecha 10:30', '1 kun', 'warn', 'Organik', ['+998 90 507 13 26'], 'Kamola', { sd: 1, reason: 'Keyinroq gaplashishni soʻradi', rk: 'later', com: 1, next: 'ertaga 10:00' }),
        L('Shoira Nazarova', 'Kecha 13:40', '12 soat', 'ok', 'Target', ['+998 97 402 66 19'], 'Kamola', { sd: 0, reason: 'Javob bermadi', rk: 'no', com: 1 }),
        L('Otabek Yoʻldoshev', 'Kecha 16:05', '9 soat', 'ok', 'Organik', ['+998 93 744 10 58'], 'Kamola', { sd: 0, reason: 'Telefoni oʻchiq', rk: 'off', com: 1 }),
        L('Gulnoza Ahmedova', 'Kecha 19:20', '6 soat', 'ok', 'Target', ['+998 90 615 27 43'], 'Kamola', { sd: 0, reason: 'Javob bermadi', rk: 'no', com: 1 }),
        L('Dilshoda Ergasheva', 'Kecha 21:15', '4 soat', 'ok', 'Target', ['+998 99 260 41 75'], 'Kamola', { sd: 0, reason: 'Band boʻldi', rk: 'busy', com: 1 }),
        L('Behruz Sattorov', '00:40', '1 soat', 'ok', 'Organik', ['+998 91 588 03 62'], 'Kamola', { sd: 0, reason: 'Javob bermadi', rk: 'no', com: 1 })
      ],
      con: [
        L('Nilufar Saidova', 'Kecha 15:10', '10 soat', 'ok', 'Organik', ['+998 95 310 62 48'], 'Kamola', { com: 3, rec: 1, next: 'ertaga 16:30' }),
        L('Sardor Rahimov', 'Kecha 19:30', '6 soat', 'ok', 'Target', ['+998 88 471 20 93'], 'Kamola', { com: 2 }),
        L('Kamron Ergashev', '31-okt', '1 kun', 'warn', 'Target', ['+998 90 455 21 08'], 'Kamola', { com: 2, rec: 1 }),
        L('Madina Yusupova', '31-okt', '1 kun', 'warn', 'Organik', ['+998 97 515 38 02'], 'Kamola', { com: 2 }),
        L('Nodir Saidov', '30-okt', '2 kun', 'warn', 'Target', ['+998 93 660 47 11'], 'Kamola', { com: 3, rec: 1, next: 'ertaga 12:00' })
      ],
      trial: [
        L('Ozoda Rahimova', '31-okt', '1 kun', 'warn', 'Target', ['+998 90 284 63 70'], 'Kamola', { trial: 'Tasdiqlandi', thint: 'Bugun 19:00 · Dilnoza Karimova · Zoom', tone: 'info', ta: 'pending', com: 2, rec: 1 }),
        L('Sardor Komilov', 'Kecha 12:00', '13 soat', 'ok', 'Organik', ['+998 99 731 08 24'], 'Kamola', { trial: 'Tasdiqlandi', thint: 'Bugun 20:00 · Shahnoza Qodirova · Zoom', tone: 'info', ta: 'pending', com: 2 }),
        L('Ulugʻbek Rasulov', '30-okt', '2 kun', 'warn', 'Target', ['+998 93 118 40 52'], 'Kamola', { trial: 'Muddati oʻtdi · natija kerak', tone: 'bad', ta: 'over', com: 1 })
      ],
      dec: [
        L('Gulbahor Yusupova', '30-okt', '2 kun', 'warn', 'Target', ['+998 91 640 22 17'], 'Kamola', { com: 4, rec: 1, next: 'bugun 11:00' }),
        L('Doston Halimov', '29-okt', '3 kun', 'late', 'Target', ['+998 90 935 61 48'], 'Kamola', { com: 4, rec: 2, next: 'bugun 15:30' }),
        L('Mohira Tojiyeva', '30-okt', '2 kun', 'warn', 'Target', ['+998 97 640 33 18'], 'Kamola', { com: 3, next: 'ertaga 15:00' }),
        L('Aziza Yoqubova', '31-okt', '1 kun', 'warn', 'Organik', ['+998 95 402 19 63'], 'Kamola', { com: 2 })
      ],
      defer: [
        L('Laylo Karimova', '24-okt', '', '', 'Organik', ['+998 90 731 52 60'], 'Kamola', { defer: true, dp: '20.11.2026', dc: '15.11.2026', com: 3 }),
        L('Bekzod Umarov', '26-okt', '', '', 'Target', ['+998 93 507 81 44'], 'Kamola', { defer: true, dp: '01.12.2026', dc: '25.11.2026', com: 2 }),
        L('Malika Tursunova', '27-okt', '', '', 'Target', ['+998 94 718 26 30'], 'Kamola', { defer: true, dp: '10.12.2026', dc: '05.12.2026', com: 2 })
      ],
      pay: [],
      paid: [L('Temur Nazarov', '30-okt', '', '', 'Target', ['+998 90 990 31 45'], 'Kamola', { serial: 'RU041', com: 6, rec: 3 })],
      fail: [L('Bahrom Ergashev', '22-okt', '', '', 'Target', ['+998 93 270 66 41'], 'Kamola', { com: 3, rec: 1 })],
      junk: []
    };
    // Faqat SotKL_Stale: Shahnoza va Rustam 5-kunga yetgan (qulf). Asosiy bordlarda ≤4 kun — faqat ogohlantirish.
    if (MODE === 'stale' && s.demo !== 'warn') CARDS.try.slice(0, 2).forEach(k => Object.assign(k, { sd: 5, age: '5 kun', stale: 'qulf', sk: 'lock' }));
    const EMPTY = s.demo === 'empty' && MODE !== 'stale';
    if (EMPTY) { Object.keys(CARDS).forEach(k => { CARDS[k] = []; }); ALLCOLS.forEach(c => { c[3] = 0; }); }
    const SUM = { con: 'oʻrtacha 7 soat', trial: 'bugun 2 ta sinov · 19:00, 20:00', defer: 'xabarlashish 15-noy', paid: 'joriy oy' };
    const RISK = {
      new: [['late30', '30+ daq', 'color:#B42318;background:#FEF3F2', '30 daqiqadan koʻp kutayotgan yangi lidlar']],
      try: [['lock', 'qulf', 'color:#B42318;background:#FEF3F2', 'Qulf yoki ertaga qulf'], ['warn', 'Ogoh. 1', 'color:#93370D;background:#FEF0C7', '3-kun ogohlantirilgan']],
      dec: [['late', 'Kechikdi · 1', 'color:#B42318;background:#FEF3F2', 'Qoʻngʻiroq muddati oʻtgan']]
    };
    const SRC = { Target: '#2563EB', Organik: '#12B76A' };
    const LVL = { ok: ['color:#067647;background:#ECFDF3', '#12B76A'], warn: ['color:#93370D;background:#FEF0C7', '#F79009'], late: ['color:#B42318;background:#FEF3F2', '#F04438'] };
    const TONE = { warn: 'color:#93370D;background:#FEF0C7', info: 'color:#0057B8;background:#EAF3FF', ok: 'color:#067647;background:#ECFDF3', bad: 'color:#B42318;background:#FEF3F2', mute: 'color:#3A4456;background:#F1F5F9' };
    const FAIL_BOG = [['no-pickup-6', 'Telefonini koʻtarmadi (6+ urinishdan soʻng)'], ['wrong-number', 'Notoʻgʻri raqam ekan'], ['no-response-6', 'Javob bermadi (6+ urinishdan soʻng)'], ['stopped-answering', 'Telefonini olmay qoʻydi'], ['price-expensive', 'Narx qimmat'], ['parents-refused', 'Ota-onasi ruxsat bermadi'], ['family-refused', 'Uydagi boshqalar ruxsat bermadi'], ['time-mismatch', 'Vaqti mos emas'], ['chose-online', 'Boshqa onlayn maktabni tanladi'], ['chose-offline', 'Oflayn oʻquv markazni tanladi']];
    const FAIL_SIN = [['no-result', 'Kutilgan natijani koʻrmadi'], ['teacher-mismatch', 'Oʻqituvchi mos kelmadi'], ['format-disliked', 'Format yoqmadi'], ['schedule-changed', 'Oʻqish vaqti rejalarini oʻzgartirib oldi'], ['later', 'Keyinroq oʻqimoqchiligini aytdi'], ['wants-offline', 'Oflayn oʻqimoqchi'], ['needs-cefr-prep', 'CEFR sertifikatiga tayyorlov kerak'], ['stopped-answering', 'Telefonini olmay qoʻydi']];
    const FAIL_QT = [['no-money', 'Pul yoʻq / kechiktirdi'], ['debt-unpaid', 'Qarzdorlik yopilmadi'], ['installment-refused', 'Nasiya savdoni rad etildi'], ['stopped-answering', 'Telefonini olmay qoʻydi']];
    const JUNK = [['no-answer', 'Telefonni olmadi (bir marta ham bogʻlanilmadi)'], ['wrong-phone', 'Notoʻgʻri telefon raqami (mavjud emas)'], ['duplicate', 'Dublikat lid (bir odam bir necha marta qolgan)'], ['fake', 'Hazil yoki soxta murojaat'], ['spam', 'Spam / Bot'], ['wrong-service', 'Notoʻgʻri xizmat boʻyicha murojaat'], ['age-mismatch', 'Yosh talablarga umuman mos kelmaydi'], ['under-21', '21 yoshdan kichik arizachi']];
    const RF = [['no', 'Javob bermadi'], ['busy', 'Band boʻldi'], ['off', 'Telefoni oʻchiq'], ['later', 'Keyinroq gaplashishni soʻradi']];
    const rfSel = Object.keys(s.rf).filter(k => s.rf[k]);
    const RFN = (() => { const T = ALLCOLS[1][3], base = RF.map(r => [r[0], CARDS.try.filter(k => k.rk === r[0]).length]), sum = base.reduce((a, b) => a + b[1], 0) || 1; const raw = base.map(b => [b[0], b[1] * T / sum]); const o = {}; let left = T; raw.forEach(r => { o[r[0]] = Math.floor(r[1]); left -= o[r[0]]; }); raw.slice().sort((a, b) => (b[1] % 1) - (a[1] % 1)).forEach(r => { if (left > 0) { o[r[0]]++; left--; } }); return o; })();
    const picked = s.picked, done = s.done;
    const pickKeys = Object.keys(picked);
    const loading = s.demo === 'load';
    const srcName = ['', 'Target', 'Organik'][s.srcF];
    const mgrName = s.mgrF > 1 ? MGR[s.mgrF - 2].id : '';
    // ko'chirilgan lidlar
    const BOARD = {};
    ALLCOLS.forEach(c => BOARD[c[0]] = (CARDS[c[0]] || []).map((k, i) => ({ k, key: c[0] + i })));
    (s.added || []).slice().reverse().forEach((a, i) => BOARD.new.unshift({ k: L(a.n, '01:43', '1 daq', 'ok', a.src, [a.ph, a.ph2].filter(Boolean), a.mgr ? (MGR.find(m => m.full === a.mgr) || {}).id || '' : '', { m: 0, fresh: true, hasSurvey: false, serial: '' }), key: a.id }));
    const addedComs = {}; (s.added || []).forEach((a, i) => { if (a.note) addedComs[a.id] = [{ h: 'Hozir · Kamola S.', t: a.note }]; });
    const COMS = Object.assign({}, addedComs); Object.keys(s.coms || {}).forEach(k => { COMS[k] = s.coms[k].concat(addedComs[k] || []); });
    Object.keys(s.moved).forEach(key => { const to = s.moved[key]; Object.keys(BOARD).forEach(cid => { const ix = BOARD[cid].findIndex(x => x.key === key); if (ix >= 0) { const it = BOARD[cid].splice(ix, 1)[0]; if (cid !== to) it.k = Object.assign({}, it.k, { rk: to === 'try' ? (((s.movedInfo || {})[key] || {}).rk || '') : '' }); BOARD[to].unshift(it); } }); });
    const isUn = x => { const a = s.assigned[x.key]; return a !== undefined ? !a : !x.k.mgr; };
    const OPEN_ST = ['new', 'try', 'con', 'trial', 'dec', 'defer', 'pay'];
    const delta = {}; ALLCOLS.forEach(c => delta[c[0]] = 0); delta.new += (s.added || []).length;
    const RFL = Object.assign({}, RFN); Object.keys(s.moved).forEach(key => { const from = key.replace(/g?\d+$/, ''); const to = s.moved[key]; if (from === to) return; if (from === 'try' && !/g\d+$/.test(key)) { const k0 = (CARDS.try[+key.replace(/\D/g, '')] || {}); if (k0.rk && RFL[k0.rk] > 0) RFL[k0.rk]--; } if (to === 'try') { const r = ((s.movedInfo || {})[key] || {}).rk; if (r) RFL[r] = (RFL[r] || 0) + 1; } });
    Object.keys(s.moved).forEach(key => { const from = key.replace(/g?\d+$/, ''); const to = s.moved[key]; if (from !== to) { delta[from]--; delta[to]++; } });
    // "Yana N ta" bosilganda qoʻshimcha kartalar (namuna)
    const POOL = ['Aziza Karimova', 'Sherzod Aliev', 'Madina Yusupova', 'Doniyor Rasulov', 'Kamila Ergasheva', 'Jasur Tursunov', 'Nodira Saidova', 'Sardorbek Qosimov'];
    Object.keys(s.loaded || {}).forEach(cid => { for (let i = 0; i < s.loaded[cid]; i++) { const gm = cid === 'new' ? Math.max(1, 29 - Math.floor(i * 29 / 88)) : 3 + i; BOARD[cid].push({ k: L(POOL[i % POOL.length] + (i >= POOL.length ? ' ' + (i + 1) : ''), cid === 'new' ? '01:' + String(42 - gm).padStart(2, '0') : '29-okt', cid === 'new' ? gm + ' daq' : gm + ' kun', cid === 'new' ? 'ok' : (gm >= 3 ? 'late' : 'warn'), i % 3 ? 'Target' : 'Organik', ['+998 9' + (i % 10) + ' ' + String(100 + i * 7).slice(-3) + ' 2' + (i % 10) + ' ' + String(10 + i).slice(-2)], 'Kamola', { m: gm, gen: true, hasSurvey: cid !== 'try' }), key: cid + 'g' + i }); const lf = (s.loadF || {})[cid]; if (lf) { const g = BOARD[cid][BOARD[cid].length - 1].k; if (lf.src) g.src = lf.src; if (lf.mgr) g.mgr = lf.mgr === '-' ? '' : lf.mgr; if (cid === 'trial') { g.ta = lf.ta || 'pending'; g.trial = lf.ta === 'came' ? 'Qatnashdi' : 'Tasdiqlandi'; g.tone = lf.ta === 'came' ? 'ok' : 'info'; } if (lf.rk) { g.rk = lf.rk; const rr = RF.find(r => r[0] === lf.rk); g.reason = rr ? rr[1] : ''; } } } });
    const virtLeft = Math.max(0, 0 - (s.extra || 0) - ((s.loaded || {}).new || 0));
    const newUn = virtLeft + BOARD.new.filter(isUn).length;
    const unN = OPEN_ST.reduce((a, cid) => a + BOARD[cid].filter(isUn).length, 0) + virtLeft;
    const nav = mkNav().map(n => Object.assign({}, n, { cur: n.k === 'leads' ? 'page' : 'false', pick: () => { if (!n.item || n.k === 'leads') return; this.setState({ toast: { text: n.label, sub: 'Alohida sahifa ochiladi' + (n.k === 'book' ? ' (Lidlar sarlavhasidagi tab bilan bir xil)' : ''), kind: 'ok' } }); this.armToast(); } }));
    const orderKeys = [];
    const colOf = key => { let f = ''; Object.keys(BOARD).forEach(cid => { if (BOARD[cid].some(x => x.key === key)) f = cid; }); return f; };
    const cardOf = key => { let f = {}; Object.keys(BOARD).forEach(cid => { const x = BOARD[cid].find(y => y.key === key); if (x) f = x.k; }); return f; };
    const NAME = {}; ALLCOLS.forEach(c => NAME[c[0]] = c[1]);
    // --- Sotuv: qoʻngʻiroq dalili (staleLeads.js callsOf/hasRecentCall/logCall) ---
    let gOpenNow = false;
    const agoL = t => { const m = String(t || '').match(/^(Bugun|Kecha|(\d{1,2})-okt) (\d{1,2}):(\d{2})$/); if (!m) return 99999; const mins = +m[3] * 60 + +m[4]; const d = m[1] === 'Bugun' ? 0 : m[1] === 'Kecha' ? 1 : 2 + (31 - +m[2]); return d * 1440 + 103 - mins; };
    // eng yangisi birinchi; "call-attempt" / "contact-fail" izohlari
    // ism boʻyicha; SotKHome navbati bilan bir xil oxirgi qoʻngʻiroq vaqtlari
    const CSEED = { 'Rustam Toshev': ['Kecha 17:58', '30-okt 12:10', '29-okt 18:30'], 'Shahnoza Aliyeva': ['31-okt 10:20', '30-okt 16:00', '29-okt 14:10', '29-okt 11:05'], 'Zilola Hamidova': ['31-okt 15:40'], 'Jahongir Sobirov': ['Kecha 10:40', '31-okt 11:30'], 'Feruza Mirzayeva': ['Kecha 11:00'], 'Asror Nurmatov': ['Kecha 12:15'], 'Zarina Qosimova': ['Kecha 14:20'], 'Shoira Nazarova': ['Kecha 15:00'], 'Otabek Yoʻldoshev': ['Kecha 17:30'], 'Gulnoza Ahmedova': ['Kecha 20:10'], 'Dilshoda Ergasheva': ['Kecha 22:30'], 'Behruz Sattorov': ['Bugun 00:55'], 'Gulbahor Yusupova': ['31-okt 12:40'], 'Doston Halimov': ['30-okt 17:00'] };
    const callsOfK = key => ((s.calls || {})[key] ? ['Bugun 01:43'] : []).concat(EMPTY ? [] : (CSEED[cardOf(key).n] || []));
    const callN = key => callsOfK(key).length;
    const recentCall = key => callsOfK(key).some(t => agoL(t) <= 1440);
    // prod: ketma-ket bosishlar (2 daqiqa ichida) bitta urinish
    const logCall = (key, extra) => { const st = Object.assign({}, extra || {}); if (!(s.calls || {})[key]) { const c = Object.assign({}, s.calls || {}); c[key] = 1; st.calls = c; const cm = Object.assign({}, st.coms || s.coms || {}); cm[key] = [{ h: 'Hozir · Kamola S. · Qoʻngʻiroq', t: 'Qoʻngʻiroq qilindi' }].concat(cm[key] || []); st.coms = cm; } return st; };
    const openDrw = (key, tab) => { const r = Object.assign({}, s.readRop || {}); if (tab === 'not') r[key] = true; this.setState({ drw: { key, tab: tab || 'main' }, menu: '', mp: '', fu: false, comTried: false, readRop: r }); this.focusSoon('.drw [role=tab][aria-selected=true]'); };
    const trap = (e, onEsc) => { if (!e) return; const box = e.currentTarget; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onEsc(); return; } if (e.key !== 'Tab') return; e.stopPropagation(); const f = Array.prototype.slice.call(box.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')).filter(x => !x.disabled && x.offsetParent !== null && x.getAttribute('tabindex') !== '-1'); if (!f.length) return; e.preventDefault(); const ix = f.indexOf(document.activeElement); (e.shiftKey ? (f[ix - 1] || f[f.length - 1]) : (f[ix + 1] || f[0])).focus(); };
    const ini = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
    const AVC = [['#DCEBFF', '#0057B8'], ['#FEF0C7', '#93370D'], ['#ECFDF3', '#067647'], ['#F1E8FF', '#5B21B6'], ['#FFE4E8', '#9F1239'], ['#E0F2FE', '#075985']];
    const avcOf = key => { let h = 0; String(key).split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); const c = AVC[h % AVC.length]; return 'background:' + c[0] + ';color:' + c[1]; };
    const shK = s.sh ? s.sh.key : ''; const shC = shK ? cardOf(shK) : {};
    const closeSh = () => { const k = shK; this.setState({ sh: null }); this.focusSoon(gOpenNow ? (k ? '[data-lock="' + k + '"] button' : '[data-gate]') : k ? back(k) : '[data-card]'); };
    const surveyKind = (from, to) => to === 'con' ? 'con' : to === 'defer' ? 'dates' : (to === 'try' ? (from === 'new' ? 'reason' : '') : (to === 'new' ? '' : 'survey'));
    const seedSv = key => { if (!key) return null; const orig = key.replace(/g?\d+$/, ''); const k0 = cardOf(key); if (k0.noSurvey || k0.gen || ['con', 'trial', 'dec', 'defer', 'pay', 'paid', 'fail'].indexOf(orig) < 0) return null; const hh = key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0; const fn = String(k0.n || '').split(' ')[0]; const sn = String(k0.n || '').split(' ')[1] || ''; const fem = /a$/i.test(fn) || /(ova|eva)$/i.test(sn); return { res: 'uz', reg: ['toshkent-sh', 'andijon', 'fargona', 'namangan', 'samarqand', 'buxoro'][hh % 6] || 'andijon', lvl: ['zero', 'beginner', 'beginner', 'intermediate'][hh % 4], goal: hh % 5 === 0 ? ['speaking', 'cefr'][hh % 2] : ['career', 'speaking', 'cefr', 'career', 'ielts'][hh % 5], own: hh % 5 === 0 ? 'parent' : 'self', sex: fem ? 'female' : 'male', age: String(hh % 5 === 0 ? 9 + hh % 7 : 17 + hh % 16), info: { platform: 'yes', price: 'yes', format: 'yes', terms: 'yes', trial: 'yes' } }; };
    const hasSurvey = key => { const mi = (s.movedInfo || {})[key] || {}; if (mi.survey) return true; const k0 = cardOf(key); const orig = key.replace(/g?\d+$/, ''); if (k0.noSurvey) return false; return ['con', 'trial', 'dec', 'pay', 'paid', 'fail'].indexOf(orig) >= 0; };
    const needsCon = (from, to, key) => !hasSurvey(key) && (['dec', 'pay'].indexOf(to) >= 0 || ((from === 'new' || from === 'try') && ['trial', 'paid', 'fail'].indexOf(to) >= 0));
    const back = key => gOpenNow ? '[data-gate]' : s.drw ? '.drw .dsec .btn2[aria-haspopup=dialog], .drw [role=tab][aria-selected=true]' : '[data-card="' + key + '"]';
    const isOpenK = key => OPEN_ST.indexOf(colOf(key)) >= 0;
    const errToast = (sub, retry) => { this.setState({ menu: '', mp: '', sub: false, toast: { text: 'Saqlanmadi', sub: sub || 'Server bilan aloqa yoʻq — oʻzgarish kiritilmadi', kind: 'err', retry } }); this.armToast(); };
    const requestMove = (key, to) => {
      const from = colOf(key); if (!from || from === to) return;
      // prod: staleLeads.js wrapSifatsiz — Yangi/Urinilmoqda lidni 24 soat ichida qoʻngʻiroqsiz Sifatsizga oʻtkazib boʻlmaydi
      if (to === 'junk' && (from === 'new' || from === 'try') && !recentCall(key)) { this.setState({ menu: '', sub: false, survey: null, sh: { t: 'cf', key } }); this.focusSoon('[data-sheet] .sk-bpri'); return; }
      const kind = surveyKind(from, to);
      if (s.demo === 'err' && !kind && !(to === 'trial' || to === 'pay' || to === 'paid')) { errToast('Server bilan aloqa yoʻq — lid joyida qoldi', { move: [key, to] }); return; }
      const steps = needsCon(from, to, key) ? 2 : 1; const isFlow = to === 'trial' || to === 'pay' || to === 'paid';
      if (isFlow && steps === 1) { this.setState({ menu: '', sub: false, flow: { key, from, to } }); this.focusSoon('[data-modal] button'); return; }
      if (kind) { this.setState({ menu: '', sub: false, survey: { key, from, to, kind, steps, rf: to === 'fail' && steps > 1 }, svStep: 0, svf: Object.assign({ res: 'uz', reg: '' }, kind === 'dates' ? {} : seedSv(key) || {}, kind === 'dates' ? ((s.svPrevD || {})[key] || {}).svf || {} : (s.svPrev || {})[key] || {}), svr: kind === 'dates' ? ((s.svPrevD || {})[key] || {}).svr || '' : '' }); this.focusSoon('[data-modal] input'); return; }
      const m = Object.assign({}, s.moved); m[key] = to;
      this.setState({ menu: '', sub: false, moved: m, saving: key, toast: { text: (cardOf(key).n || 'Lid') + ' → ' + NAME[to], sub: 'Bosqich oʻzgardi', kind: 'ok', undo: { moved: s.moved } } });
      setTimeout(() => this.setState({ saving: '' }), 800); this.armToast();
    };
    // sotuv menejeri faqat oʻz eslatmalarini koʻradi (app.js getLeadSlaCardAlerts :19407); ochilganda oʻqilgan boʻladi
    const alertsOf = (key, k) => { const a = []; if (k.late) { if (!(s.fuSet || {})[key]) a.push({ id: 'late', t: 'Qoʻngʻiroq muddati oʻtdi: ' + (k.next || ''), rop: false }); } else if (k.notif) a.push({ id: 'sla', t: 'Yangi lid ' + k.age + ' kutmoqda — tezroq qoʻngʻiroq qiling', rop: false }); return a.filter(x => !(s.ack || {})[key + ':' + x.id]); };
    const unreadOf = (key, k) => (s.readRop || {})[key] ? 0 : alertsOf(key, k).length;
    const histPlan = (key, k) => { const orig = String(key || '').replace(/g?\d+$/, ''); const p = []; if (orig === 'try' && (k.reason || k.rk)) p.push('cf'); if (seedSv(key)) { p.push('an'); p.push('info'); } if (orig === 'trial') { p.push('trial'); if (['Tasdiqlandi', 'Natija kutilmoqda', 'Qatnashdi', 'Qatnashmadi'].indexOf(k.trial) >= 0) p.push('tacc'); if (k.trial === 'Rad etildi') p.push('trej'); if (k.trial === 'Qatnashdi' || k.trial === 'Qatnashmadi') p.push('tres'); } if (orig === 'dec') p.push('dec'); if (orig === 'defer') p.push('def'); if (orig === 'fail') p.push('fail'); if (orig === 'paid') { p.push('pay'); p.push('onb'); } return p; };
    const seedN = (key, k) => { const p = histPlan(key, k); const n = Math.max(k.com || 0, p.length + (k.next ? 1 : 0)); return k.gen && !(k.com) ? 0 : n; };
    const recAll = (key, k, who) => ((s.recAdd || {})[key] || []).concat([{ h: 'Kecha 18:38 · Qoʻlda yuklangan · ' + (who || '') + ' · 3:42' }, { h: '31-okt 12:01 · Qoʻlda yuklangan · ' + (who || '') + ' · 6:10' }, { h: '30-okt 09:20 · Qoʻlda yuklangan · ' + (who || '') + ' · 2:05' }, { h: '29-okt 16:02 · Qoʻlda yuklangan · ' + (who || '') + ' · 1:15' }].slice(0, k.rec || 0).map((r, i) => Object.assign({ id: key + 'r' + i }, r))).filter(r => !((s.recDel || {})[r.id]));
    const recN = (key, k) => recAll(key, k, '').length;
    const comN = (key, k) => seedN(key, k) + (COMS[key] || []).length;
    const watchOf = () => 0;
    const cols = COLS.map((c, ci) => {
      const id = c[0], color = c[2];
      const unList0 = BOARD[id].filter(isUn);
      let list = BOARD[id].filter(x => !(vb && !isUn(x)) && (!ql || (x.k.n + ' ' + x.k.phones.join(' ') + ' ' + (x.k.serial || '')).toLowerCase().indexOf(ql) >= 0));
      if (s.mgrF === 1) list = list.filter(isUn);
      if (mgrName) list = list.filter(x => (s.assigned[x.key] !== undefined ? s.assigned[x.key] : x.k.mgr) === mgrName);
      if (srcName) list = list.filter(x => x.k.src === srcName);
      if (id === 'try' && rfSel.length) list = list.filter(x => rfSel.indexOf(x.k.rk) >= 0);
      const preAtt = list;
      if (id === 'trial' && s.trialF !== 'all') list = list.filter(x => s.trialF === 'attended' ? x.k.ta === 'came' : x.k.ta !== 'came');
      const preRisk = list;
      const riskOf = (x, rk) => { const mv = !!s.moved[x.key]; if (mv) return false; return rk === 'lock' ? x.k.sk === 'lock' : rk === 'warn' ? x.k.sk === 'warn' : rk === 'late30' ? ((x.k.m || 0) >= 30) : (!!x.k.late && !(s.fuSet || {})[x.key] && !(s.ack || {})[x.key + ':late']); };
      const riskOn = s.risk && s.risk.indexOf(id + ':') === 0;
      if (riskOn) { const rk = s.risk.split(':')[1]; list = list.filter(x => riskOf(x, rk)); }
      const nonColFilter = !!srcName || s.mgrF > 1 || (id === 'try' && rfSel.length > 0) || (id === 'trial' && s.trialF !== 'all') || !!ql || !!riskOn;
      const visUn = list.filter(isUn);
      const unassigned = nonColFilter ? visUn.length : (id === 'new' ? newUn : unList0.length);
      const base = c[3] + delta[id];
      const total = vb ? (id === 'new' ? newUn : unList0.length) : base;
      const shut = vb ? total === 0 : (ql ? list.length === 0 : !!s.shut[id]);
      const hideCol = vb && total === 0;
      const filtered = !!ql || !!srcName || s.mgrF > 0 || (id === 'try' && rfSel.length > 0) || (id === 'trial' && s.trialF !== 'all') || (s.risk && s.risk.indexOf(id + ':') === 0);
      const origLen = BOARD[id].filter(x => !x.k.gen).length;
      const exact = !!ql || !!riskOn;
      const sc = arr => exact ? arr.length : Math.min(total, Math.max(arr.length, Math.round(arr.filter(x => !x.k.gen).length * total / Math.max(1, origLen))));
      const segAll = sc(preAtt), segCame = sc(preAtt.filter(x => x.k.ta === 'came'));
      const onlyRf = id === 'try' && rfSel.length && !exact && !srcName && !s.mgrF;
      const matched0 = vb ? total : !filtered ? total : onlyRf ? rfSel.reduce((a, r) => a + (RFL[r] || 0), 0) : (id === 'trial' && s.trialF !== 'all' && !exact) ? (s.trialF === 'attended' ? segCame : segAll - segCame) : sc(list);
      const matched = Math.max(matched0, list.length);
      const rest = vb ? (id === 'new' ? Math.max(0, total - list.length) : 0) : Math.max(0, matched - list.length);
      if (!shut && !loading) list.forEach(x => orderKeys.push([x.key, ci]));
      return {
        t: c[1], n: filtered && !vb ? matched + ' / ' + total : total, nT: filtered && !vb ? 'Filtrga mos: ' + matched + ' ta, jami ' + total + ' ta' : total + ' ta lid', open: !shut, closed: shut && !hideCol, hideCol,
        loadMore: () => { const ld = Object.assign({}, s.loaded); ld[id] = (ld[id] || 0) + Math.min(40, rest); const lf = Object.assign({}, s.loadF || {}); lf[id] = filtered ? { src: srcName || '', mgr: s.mgrF === 1 ? '-' : (mgrName || ''), ta: id === 'trial' && s.trialF === 'attended' ? 'came' : '', rk: id === 'try' && rfSel.length ? rfSel[0] : '' } : null; this.setState({ loaded: ld, loadF: lf }); }, loading, ready: !loading,
        leave: () => { if (s.over === id) this.setState({ over: '' }); },
        drop: e => { if (e && e.preventDefault) e.preventDefault(); const key = s.drag; if (!key) return; this.setState({ drag: '', over: '' }); requestMove(key, id); },
        toggleCol: () => { const n = Object.assign({}, s.shut); n[id] = !shut; this.setState({ shut: n }); },
        openLab: c[1] + ' ustunini ochish (' + total + ' ta lid)', closeLab: c[1] + ' ustunini yigʻish',
        miniSt: 'flex:none;width:52px;height:100%;max-height:560px;border:0;border-top:3px solid ' + color + ';border-radius:16px;background:' + (s.drag && s.over === id ? '#EAF3FF;outline:2px dashed #0065D6;outline-offset:-2px' : '#F1F5F9') + ';display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 0;cursor:pointer',
        colSt: 'border-top-color:' + color, cls: 'col' + (s.drag && s.over === id ? ' drop' : ''),
        over: e => { if (e && e.preventDefault) e.preventDefault(); if (s.over !== id) this.setState({ over: id }); },
        dotSt: 'flex:none;width:9px;height:9px;border-radius:50%;background:' + color,
        nSt: 'flex:none;font-size:12px;font-weight:800;border-radius:999px;padding:2px 8px;color:#0B1220;background:#FFFFFF;box-shadow:inset 0 0 0 1px #E2E8F0;font-variant-numeric:tabular-nums;white-space:nowrap',
        sum: vb || loading ? '' : (id === 'new' ? ((BOARD.new.find(x => !x.k.fresh) || BOARD.new[0]) ? 'eskisi ' + (BOARD.new.find(x => !x.k.fresh) || BOARD.new[0]).k.age : '') : (SUM[id] || '')), slaInfo: false,
        risks: loading ? [] : (RISK[id] || []).filter(r => !vb || r[0] === 'late30').map(r => { const cnt = preRisk.filter(x => riskOf(x, r[0])).length; return { cnt, lock: r[0] === 'lock', t: r[0] === 'lock' ? String(cnt) : r[0] === 'late30' ? '30+ daq · ' + cnt : r[0] === 'warn' ? 'Ogoh. ' + cnt : 'Kechikdi · ' + cnt, st: r[2], tip: r[3] + ': ' + cnt + ' ta — bosib filtrlash', on: s.risk === id + ':' + r[0] ? 'true' : 'false', pick: () => this.setState({ risk: s.risk === id + ':' + r[0] ? '' : id + ':' + r[0] }) }; }).filter(r => r.cnt > 0 || r.on === 'true'),
        trialSeg: id !== 'trial' ? [] : (() => { const all = segAll; const came = segCame; return [['not-attended', 'Kelmagan', all - came], ['all', 'Hamma', all], ['attended', 'Kelgan', came]].map(g => ({ t: g[1], n: String(g[2]), lab: g[1] + ': ' + g[2] + ' ta', on: s.trialF === g[0] ? 'true' : 'false', pick: () => { try { localStorage.setItem('mh_trial_attendance_filter_v1', g[0]); } catch (er) {} this.setState({ trialF: g[0] }); } })); })(),
        isTry: id === 'try' && !vb && !loading, isTrial: id === 'trial' && !vb && !loading,
        empty: !loading && list.length === 0 && rest === 0, emptyT: ql ? 'Bu ustunda topilmadi' : filtered ? 'Filtr boʻyicha lid yoʻq' : id === 'new' ? 'Yangi lidlarni ROP biriktiradi — kelishi bilan bildirishnoma keladi' : 'Lidlar yoʻq', emptyClr: !!riskOn, clrRisk: () => this.setState({ risk: '' }),
        more: loading ? '' : rest > 40 ? 'Yana 40 ta yuklash · ' + rest + ' ta qoldi' + (filtered && !vb ? ' (filtr)' : '') : rest > 0 ? 'Yana ' + rest + ' ta lid' + (filtered && !vb ? ' (filtr)' : '') : '',
        pickBtn: unassigned && !loading ? 'Biriktirilmagan' + (nonColFilter ? ' (filtr)' : '') + ': ' + unassigned : '',
        pickAll: () => { const n = Object.assign({}, picked); (nonColFilter ? visUn : unList0).forEach(x => { n[x.key] = 1; }); this.setState({ picked: n, allNew: id === 'new' && !nonColFilter ? true : s.allNew, excl: id === 'new' ? {} : s.excl, conf: false, lastPick: null }); },
        cards: loading ? [] : list.map(({ k: k0, key }) => {
          const mv = s.moved[key] && s.moved[key] !== key.replace(/g?\d+$/, '');
          const mi = (s.movedInfo || {})[key] || {};
          const k1 = (s.fuSet || {})[key] ? Object.assign({}, k0, { late: false }) : k0;
          const k = mv ? Object.assign({}, k1, { age: ['new', 'try', 'con', 'trial', 'dec', 'pay'].indexOf(id) >= 0 ? '1 daq' : '', lvl: 'ok', stale: '', sk: '', reason: id === 'try' ? (mi.reason || '') : '', next: ['paid', 'fail', 'junk'].indexOf(id) >= 0 || k1.late ? '' : k1.next, late: false, trial: id === 'trial' ? 'Tasdiq kutilmoqda' : '', tone: 'mute', ta: 'pending', att: false, defer: id === 'defer', dp: mi.dp ? mi.dp.split('-').reverse().join('.') : '15.11.2026', dc: mi.dc ? mi.dc.split('-').reverse().join('.') : '12.11.2026', serial: id === 'paid' || id === 'pay' ? 'RU0' + (50 + key.length) : k0.serial }) : k1;
          const lv = LVL[k.lvl];
          const stripe = lv ? lv[1] : '#CBD5E1';
          const mid = s.assigned[key] !== undefined ? s.assigned[key] : k.mgr; const m = MG[mid];
          const inside = s.kin === key;
          const tog = (shift) => { const n = Object.assign({}, picked); const ex = Object.assign({}, s.excl || {}); if (shift && s.lastPick && s.lastPick.col === id) { const ids = list.map(x => x.key); const a = ids.indexOf(s.lastPick.key), b = ids.indexOf(key); if (a >= 0 && b >= 0) { const lo = Math.min(a, b), hi = Math.max(a, b); for (let i = lo; i <= hi; i++) { n[ids[i]] = 1; delete ex[ids[i]]; } } } else { const implied = s.allNew && id === 'new' && !ex[key] && isUn({ k: k0, key }); if (n[key] || implied) { delete n[key]; if (s.allNew && id === 'new') ex[key] = 1; } else { n[key] = 1; delete ex[key]; } } this.setState({ picked: n, excl: ex, lastPick: { key, col: id }, conf: false }); };
          const openD = tab => { const r = Object.assign({}, s.readRop || {}); if (tab === 'not') r[key] = true; this.setState({ drw: { key, tab }, menu: '', mp: '', readRop: r, fu: false, comTried: false }); this.focusSoon('.drw [role=tab][aria-selected=true]'); };
          const kOpenMenu = (e) => { const xy = this.rel(e, 236, 170); this.setState({ menu: key, menuXY: xy, sub: false, mp: '', dd: '' }); this.focusSoon('[data-menu] [role=menuitem]'); };
          const kOpenMgr = (e) => { const xy = this.rel(e, 280, 260); this.setState({ mp: key, mpXY: { x: Math.max(8, xy.x + 160), y: xy.y }, menu: '', mq: '', mpView: 'list' }); this.focusSoon('[data-menu] input'); };
          return {
            key, col: ci, n: k.n, nameT: 'Lid kartasini ochish: ' + k.n, time: k.time, src: k.src, srcDot: 'background:' + (SRC[k.src] || '#2563EB'),
            aria: k.n + ', ' + c[1] + (k.age ? ', ' + k.age : '') + (k.sk === 'lock' ? ', qulflangan' : k.sk === 'warn' ? ', ogohlantirilgan' : '') + (k.late ? ', qoʻngʻiroq muddati oʻtdi' : '') + (unreadOf(key, k, mid) ? ', ' + unreadOf(key, k, mid) + ' ta bildirishnoma' : ''),
            note: '', telT: MODE === 'call' ? 'Qoʻngʻiroq qilish — urinish yoziladi, natija oynasi ochiladi' : 'Qoʻngʻiroq qilish', callTel: () => { if (MODE === 'call' && OPEN_ST.indexOf(id) >= 0) openCr(key, '[data-card= + key + ] .ph'); },
            on: !!picked[key] || (s.allNew && id === 'new' && isUn({ k: k0, key }) && !(s.excl || {})[key]), lab: k.n + ' — belgilash',
            ti: inside ? '0' : '-1',
            toggle: e => tog(!!(e && e.shiftKey)),
            openCard: () => openD('main'), openCom: () => openD('com'), openRec: () => openD('rec'), openNotif: () => openD('not'),
            blur: e => { if (!inside) return; const rt = e && e.relatedTarget; const me = e && e.currentTarget; if (!rt || !me || !me.contains(rt)) this.setState({ kin: '' }); },
            cardClick: e => { const t = e && e.target; if (t && t.closest && t.closest('button,a,input,label,select,[role=menu]')) return; tog(!!(e && e.shiftKey)); },
            cls: 'card' + (s.drag === key ? ' drag' : '') + (inside ? ' kin' : '') + ((picked[key] || (s.allNew && id === 'new' && isUn({ k: k0, key }) && !(s.excl || {})[key])) ? ' sel' : ''),
            key2: e => {
              if (!e) return; const K = e.key; const self = e.currentTarget === e.target;
              if (K === 'Escape' && inside) { this.setState({ kin: '' }); this.focusSoon('[data-card="' + key + '"]'); return; }
              if (!self) return;
              if (K === 'Enter') { e.preventDefault(); openD('main'); }
              else if (K === 'F2') { e.preventDefault(); this.setState({ kin: key }); this.focusSoon('[data-card="' + key + '"] .nm'); }
              else if (K === ' ') { e.preventDefault(); tog(!!e.shiftKey); }
              else if (K === 's' || K === 'S' || K === 'ContextMenu') { e.preventDefault(); kOpenMenu(e); }
              else if (K === 'ArrowDown' || K === 'ArrowUp' || K === 'ArrowLeft' || K === 'ArrowRight') {
                e.preventDefault(); const all = Array.prototype.slice.call(document.querySelectorAll('[data-card]'));
                const me = all.indexOf(e.currentTarget); if (me < 0) return;
                let tgt = null;
                if (K === 'ArrowDown') tgt = all[me + 1] && all[me + 1].dataset.col === String(ci) ? all[me + 1] : null;
                if (K === 'ArrowUp') tgt = all[me - 1] && all[me - 1].dataset.col === String(ci) ? all[me - 1] : null;
                if (K === 'ArrowRight') tgt = all.find(x => Number(x.dataset.col) > ci) || null;
                if (K === 'ArrowLeft') { const prev = all.filter(x => Number(x.dataset.col) < ci); tgt = prev.length ? all.find(x => x.dataset.col === prev[prev.length - 1].dataset.col) : null; }
                if (tgt) { tgt.focus(); if (tgt.scrollIntoView) tgt.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
              }
            },
            age: k.age, ageT: 'Shu bosqichda kutmoqda' + ' (<1 kun yashil, 1–3 kun sariq, 3+ qizil)', ageSt: lv ? lv[0] : '',
            stale: k.stale || '', staleT: k.sk === 'lock' ? (k.stale === 'qulf' ? 'Qotgan lid: 5-kun — ilova shu lid hal boʻlguncha qulflanadi' : 'Qotgan lid: 4-kun — ertaga qulflanadi') : (k.sd >= 4 ? '4-kun: ertaga ilova shu lid bilan qulflanadi' : '3-kun: ogohlantirish — 5-kun ilova qulflanadi'),
            staleSt: k.sk === 'lock' ? 'color:#FFFFFF;background:#D92D20' : 'color:#93370D;background:#FEF0C7',
            serial: k.serial || '', reason: k.reason || '',
            trial: k.trial || '', trialSt: TONE[k.tone || 'mute'], att: !!k.att,
            hasR4: !!(k.reason || k.trial || (!(['paid', 'fail', 'junk'].indexOf(id) >= 0) && (k.next || (s.fuSet || {})[key]))), trialT: k.thint || '',
            notifTxt: unreadOf(key, k, mid) ? String(unreadOf(key, k, mid)) : watchOf(key, k, mid) ? String(watchOf(key, k, mid)) : '', notifLab: watchOf(key, k, mid) && !unreadOf(key, k, mid) ? watchOf(key, k, mid) + ' ta menejer eslatmasi — kuzatuvda' : unreadOf(key, k, mid) ? unreadOf(key, k, mid) + ' ta oʻqilmagan bildirishnoma' : 'Bildirishnomalar tarixi',
            bellCls: 'fb' + (unreadOf(key, k, mid) || watchOf(key, k, mid) ? '' : ' z'), bellSt: unreadOf(key, k, mid) ? 'color:#FFFFFF;background:#D92D20' : watchOf(key, k, mid) ? 'color:#B42318;background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #FDA29B' : '',
            ds: () => this.setState({ drag: key, menu: '', mp: '' }),
            menuOpen: s.menu === key ? 'true' : 'false', toggleMenu: e => { if (s.menu === key) this.setState({ menu: '' }); else kOpenMenu(e); },
            openMgr: e => { if (s.mp === key) this.setState({ mp: '' }); else kOpenMgr(e); },
            ph1: k.phones[0] || 'Raqam yoʻq', ph1h: k.phones[0] ? 'tel:' + k.phones[0].replace(/\s/g, '') : '',
            ph2: k.phones[1] || '', ph2h: k.phones[1] ? 'tel:' + k.phones[1].replace(/\s/g, '') : '', ph2Lab: k.phones[1] ? 'Ikkinchi raqam: ' + k.phones[1] : '',
            phOpen: !!(k.phones[1] && s.ph[key]), phExp: s.ph[key] ? 'true' : 'false', togglePh: () => { const p = Object.assign({}, s.ph); p[key] = !p[key]; this.setState({ ph: p }); },
            copy: () => { try { navigator.clipboard && navigator.clipboard.writeText(k.phones.join(', ')); } catch (er) {} this.setState({ toast: { text: 'Raqam nusxalandi', sub: k.phones.join(' · '), kind: 'ok' } }); this.armToast(); },
            copyLab: k.n + ' raqamidan nusxa olish',
            next: ['paid', 'fail', 'junk'].indexOf(id) >= 0 ? '' : (s.fuSet || {})[key] ? 'Qoʻngʻiroq · ' + (s.fuSet || {})[key] : (s.fuDone || {})[key] ? '' : k.next ? (k.late ? 'Qoʻngʻiroq vaqti oʻtdi · ' : 'Qoʻngʻiroq · ') + k.next : '', nextT: ['paid', 'fail', 'junk'].indexOf(id) >= 0 ? '' : (s.fuSet || {})[key] ? 'Keyingi qoʻngʻiroq: ' + s.fuSet[key] : k.next ? (k.late ? 'Qoʻngʻiroq vaqti oʻtdi: ' : 'Keyingi qoʻngʻiroq: ') + k.next : '',
            nextSt: k.late && !(s.fuSet || {})[key] ? 'color:#B42318;background:#FEF3F2' : 'color:#0057B8;background:#EAF3FF',
            defer: !!k.defer, dp: k.dp || '', dc: k.dc || '',
            mgr: m ? m.sh : 'Biriktirish', mgrT: m ? 'Menejer: ' + m.full + ' — oʻzgartirish (M)' : (k.note ? k.note + ' — menejer biriktirish (M)' : 'Menejer biriktirish (M)'),
            mgrIni: m ? m.full.split(' ').map(w => w[0]).join('') : '+',
            mgrDot: m ? avSt(m) : 'border:1.5px dashed #94A3B8;color:#0057B8;box-sizing:border-box',
            mgrSt: m ? 'padding-left:3px' : 'padding-left:3px;color:#0057B8;background:#EAF3FF',
            com: comN(key, k) || '', comLab: 'Izohlar: ' + comN(key, k) + ' ta', comCls: 'fb' + (comN(key, k) ? '' : ' z'),
            rec: recN(key, k) || '', recLab: 'Zapis: ' + recN(key, k) + ' ta yozuv', recCls: 'fb' + (recN(key, k) ? '' : ' z'), recSt: recN(key, k) ? 'color:#067647;background:#ECFDF3' : '',
            saving: s.saving === key || (s.demo === 'save' && key === 'try2'),
            st: 'border-left-color:' + stripe + ';' + ((picked[key] || (s.allNew && id === 'new' && isUn({ k: k0, key }) && !(s.excl || {})[key])) ? 'border-color:#0065D6;border-left-color:#0065D6;box-shadow:0 0 0 2px #93C5FD' : '')
          };
        })
      };
    });
    const tryAll = CARDS.try;
    const newPicked = pickKeys.filter(k => k.indexOf('new') === 0).length;
    const exclN = Object.keys(s.excl || {}).length;
    const allNewEff = s.allNew && (newUn - exclN) > 0;
    const pickN = allNewEff ? (newUn - exclN) + (pickKeys.length - newPicked) : pickKeys.length;
    const reassign = pickKeys.filter(k => { const x = cardOf(k); const a = s.assigned[k]; const prev = a !== undefined ? a : x.mgr; return !!prev && prev !== s.man; }).length;
    const commit = (text, sub, who) => {
      const virt0 = allNewEff ? virtLeft : 0;
      if (s.demo === 'err') { this.setState({ toast: { text: 'Biriktirib boʻlmadi', sub: 'Server javob bermadi — tanlov saqlanib qoldi', kind: 'err', retry: { bulk: who ? 'assign' : 'split', split: s.split } }, conf: pickN > 30 }); this.armToast(); return; }
      const a = Object.assign({}, s.assigned); const la = Object.assign({}, s.loadAdd || {});
      const keysAll = pickKeys.slice(); if (allNewEff) BOARD.new.forEach(x => { if (isUn(x) && !(s.excl || {})[x.key] && keysAll.indexOf(x.key) < 0) keysAll.push(x.key); });
      let same = 0; keysAll.forEach((k, i) => { const w = who ? who : (planSeq[i] || 'Kamola'); const prev = s.assigned[k] !== undefined ? s.assigned[k] : cardOf(k).mgr; if (prev === w) { same++; return; } const op = isOpenK(k); if (prev && MG[prev] && op) la[prev] = (la[prev] || 0) - 1; a[k] = w; if (op) la[w] = (la[w] || 0) + 1; });
      if (same && same === keysAll.length && !virt0) { this.setState({ picked: {}, excl: {}, allNew: false, conf: false, split: null, toast: { text: 'Oʻzgarish yoʻq', sub: 'Tanlangan lidlar allaqachon shu menejerda', kind: 'ok' } }); this.armToast(); return; }
      if (same) sub = sub + ' · ' + same + ' tasi allaqachon shu menejerda edi';
      const virt = allNewEff ? virtLeft : 0;
      for (let i = 0; i < virt; i++) { const w = who ? who : (planSeq[keysAll.length + i] || 'Kamola'); la[w] = (la[w] || 0) + 1; }
      this.setState({ assigned: a, loadAdd: la, lastMgr: who || s.lastMgr, picked: {}, excl: {}, toast: { text, sub, kind: 'ok', undo: { assigned: s.assigned, extra: s.extra || 0, loadAdd: s.loadAdd } }, extra: (s.extra || 0) + virt, allNew: false, conf: false, split: null });
      this.armToast();
    };
    const totalAll = vb ? unN : COLS.reduce((a, c) => a + c[3] + delta[c[0]], 0);
    const colW = cols.map(c => c.open ? 266 : c.closed ? 62 : 0);
    const viewW = s.scW || (1440 - (s.sb ? 248 : 76) - 48);
    let accX = 0, hl = 0, hr = 0; colW.forEach(w => { if (!w) return; if (accX + w <= (s.sl || 0) + 4) hl++; else if (accX + w > (s.sl || 0) + viewW + 4) hr++; accX += w; });
    const hiddenRight = hr, hiddenLeft = hl;
    const mpCard = s.mp ? cardOf(s.mp) : {};
    const curMp = s.mp ? (s.assigned[s.mp] !== undefined ? s.assigned[s.mp] : mpCard.mgr) : '';
    const splitSel = s.split ? MGR.filter(m => s.split[m.id]) : [];
    // prod: planEvenLeadSplit — har lid oʻsha paytda eng kam yuklamali menejerga
    const planCounts = {}; splitSel.forEach(m => planCounts[m.id] = m.load - pickKeys.filter(k => (s.assigned[k] !== undefined ? s.assigned[k] : cardOf(k).mgr) === m.id).length);
    const planSeq = [];
    for (let i = 0; i < pickN && splitSel.length; i++) { let best = null; splitSel.forEach(m => { if (best === null || planCounts[m.id] < planCounts[best]) best = m.id; }); planCounts[best]++; planSeq.push(best); }
    const plusOf = id => planSeq.filter(x => x === id).length;
    const sortedSel = splitSel.slice().sort((a, b) => plusOf(b.id) - plusOf(a.id));
    const anyFilter = vb || !!ql || s.mgrF > 0 || s.srcF > 0 || s.date !== 'Joriy oy' || !!s.colsOn || rfSel.length > 0 || s.trialF !== 'all' || !!s.risk;
    const toast = s.toast;
    const normPh = v => { const raw = String(v || '').trim(); if (!raw) return ''; const d = raw.replace(/\D/g, ''); if (d.length === 9) return '+998' + d; if (d.length === 10 && d[0] === '0') return '+998' + d.slice(1); if (d.length === 12 && d.indexOf('998') === 0) return '+' + d; if (d.indexOf('998') === 0) return ''; if (d.length === 11 && d[0] === '8' && raw[0] !== '+') return '+7' + d.slice(1); if (d.length >= 10 && d.length <= 15) return '+' + d; return ''; };
    const showPh = p => { const raw = String(p || '').trim(); let d = raw.replace(/\D/g, ''); if (d.length === 9) d = '998' + d; if (d.length !== 12 || d.indexOf('998') !== 0) return raw.indexOf('+') === 0 ? '+' + raw.replace(/\D/g, '') : raw; return '+' + d.slice(0, 3) + ' ' + d.slice(3, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8, 10) + ' ' + d.slice(10, 12); };
    const fmtPh = v => showPh(normPh(v));
    const phOk = v => { const raw = String(v || '').trim(); if (!raw) return false; const d = raw.replace(/\D/g, ''); if (d.length === 9) return true; if (d.length === 10 && d[0] === '0') return true; if (d.length === 12 && d.indexOf('998') === 0) return true; if (d.indexOf('998') === 0) return false; if (d.length === 11 && d[0] === '8' && raw[0] !== '+') return true; return d.length >= 10 && d.length <= 15; };
    const dupOf = v => { const t = String(v || '').replace(/\D/g, '').slice(-9); return t === '901124507' ? 'lead' : t === '901234567' ? 'stu' : ''; };
    const NOCON = ['no-pickup-6', 'wrong-number', 'no-response-6'];
    const svIsCon = !!(s.survey && ((s.survey.steps > 1 && (s.survey.rf ? s.svStep === 1 : s.svStep === 0)) || s.survey.kind === 'con'));
    const svf = s.svf || {};
    const ageOk = /^\d+$/.test(String(svf.age || '')) && +svf.age >= 7 && +svf.age <= 70;
    const INFO = [['platform', 'Platforma', 'Platforma tushuntirildimi?'], ['price', 'Narx', 'Narx aytildimi?'], ['format', 'Format', 'Format (online ekani) aytildimi?'], ['terms', 'Shartlar', 'Natija, kafolat va muddat, shartnoma haqida aytildimi?'], ['trial', 'Sinov', 'Sinov darsi taklif qilindimi?']];
    const LVLS = [['zero', '0 dan boshlamoqchi'], ['beginner', 'Boshlangʻich darajada biladi'], ['intermediate', 'Oʻrta darajada biladi'], ['advanced', 'Yuqori darajada biladi']];
    const UZR = [['toshkent-sh', 'Toshkent shahri'], ['andijon', 'Andijon viloyati'], ['buxoro', 'Buxoro viloyati'], ['fargona', 'Fargʻona viloyati'], ['jizzax', 'Jizzax viloyati'], ['xorazm', 'Xorazm viloyati'], ['namangan', 'Namangan viloyati'], ['navoiy', 'Navoiy viloyati'], ['qashqadaryo', 'Qashqadaryo viloyati'], ['samarqand', 'Samarqand viloyati'], ['sirdaryo', 'Sirdaryo viloyati'], ['surxondaryo', 'Surxondaryo viloyati'], ['toshkent-v', 'Toshkent viloyati'], ['qoraqalpogiston', 'Qoraqalpogʻiston Respublikasi']];
    const FOR = [['ru', 'Rossiya'], ['kz', 'Qozogʻiston'], ['kg', 'Qirgʻiziston'], ['tj', 'Tojikiston'], ['tm', 'Turkmaniston'], ['tr', 'Turkiya'], ['ae', 'BAA'], ['us', 'AQSh'], ['de', 'Germaniya'], ['kr', 'Koreya'], ['cn', 'Xitoy'], ['other', 'Boshqa davlat']];
    const GOALS = [['ielts', 'IELTS'], ['cefr', 'CEFR'], ['speaking', 'Erkin gaplashish'], ['career', 'Ish va karyera'], ['work-abroad', 'Xorijda ishlash'], ['study-abroad', 'Xorijda oʻqish'], ['university', 'Universitet / Magistratura'], ['travel', 'Sayohat'], ['business', 'Biznes'], ['freelance', 'Freelancer / IT'], ['media', 'Film va kitoblar'], ['school', 'Maktab / Universitet darslari'], ['parenting', 'Farzand tarbiyasi'], ['self-growth', 'Oʻzini rivojlantirish'], ['other', 'Boshqa']];
    const infoOk = INFO.every(i => (svf.info || {})[i[0]] === 'yes');
    const svConOk = !!(svf.lvl && ageOk && svf.sex && svf.goal && svf.own && svf.res && svf.reg && infoOk);
    const tr = !!s.svTried;
    const conFirst = !tr || !svIsCon ? '' : !svf.lvl ? 'lvl' : !svf.own ? 'own' : !ageOk ? 'age' : !svf.sex ? 'sex' : !(svf.res && svf.reg) ? 'reg' : !svf.goal ? 'goal' : !infoOk ? 'info' : '';
    const svDefOther = s.survey && s.survey.kind === 'dates' && s.svr === 'other';
    const dP = svf.dp || '', dC = svf.dc || '';
    const dateErr = s.survey && s.survey.kind === 'dates' ? (!s.svTried || !s.svr || (s.svr === 'other' && !(svf.other || '').trim()) ? '' : !dP ? 'Qachon sotib olmoqchi: sanani tanlang' : !dC ? 'Qachon xabarlashishga kelishildi: sanani tanlang' : '') : '';
    const svNeedR = !!(s.survey && !svIsCon && (s.survey.kind === 'reason' || s.survey.kind === 'resched' || s.survey.kind === 'dates' || ['dec', 'fail', 'junk'].indexOf(s.survey.to) >= 0));
    const svBlocked = svIsCon ? !svConOk : ((svNeedR && !s.svr) || !!dateErr || (s.survey && s.survey.kind === 'dates' && (!dP || !dC)) || (svDefOther && !(svf.other || '').trim()));
    const flowAfter = s.survey && (s.survey.to === 'trial' || s.survey.to === 'pay' || s.survey.to === 'paid');
    const isResched = !!(s.survey && s.survey.kind === 'resched');
    const menuCardKey = s.menu;
    const menuCard = menuCardKey ? cardOf(menuCardKey) : {};
    const menuXY = s.menuXY || { x: 300, y: 300 };
    const anyPop = !!(s.menu || s.mp || s.dd || s.rfOpen);
    const anketaTxt = f => 'Bogʻlanildi — anketa:\n• Til darajasi: ' + ({ zero: '0 dan boshlamoqchi', beginner: 'Boshlangʻich darajada biladi', intermediate: 'Oʻrta darajada biladi', advanced: 'Yuqori darajada biladi' }[f.lvl] || '') + '\n• Ariza: ' + (f.own === 'parent' ? 'Ota-onasi qoldirgan' : 'Oʻzi qoldirgan') + '\n• Yoshi: ' + (f.age || '') + '\n• Jinsi: ' + (f.sex === 'male' ? 'Erkak' : 'Ayol') + '\n• Hudud: ' + ((UZR.concat(FOR).find(o => o[0] === f.reg) || [])[1] || '') + '\n• Maqsad: ' + ((GOALS.find(o => o[0] === f.goal) || [])[1] || '');
    const infoTxt = () => 'Maʼlumot berildi — tekshiruv:\n' + INFO.map(i => '• ' + i[2] + ' Ha').join('\n');
    const agoOf = t => { const T = String(t || '').trim(); let m; const NOWM = 103; if ((m = T.match(/^(?:Bugun |bugun )?(\d{1,2}):(\d{2})$/))) return NOWM - (+m[1] * 60 + +m[2]); if ((m = T.match(/^[Kk]echa (\d{1,2}):(\d{2})$/))) return NOWM + 1440 - (+m[1] * 60 + +m[2]); if (/^[Kk]echa$/.test(T)) return NOWM + 1440 - 600; if ((m = T.match(/^(\d{1,2})-okt/))) return (33 - +m[1]) * 1440 + NOWM - 540; if ((m = T.match(/^(\d{1,2})-noy/))) return (2 - +m[1]) * 1440 + NOWM - 540; return 600; };
    const labOf = ago => { const tod = 103 - Math.round(ago); const d = tod >= 0 ? 0 : Math.ceil(-tod / 1440); const mm = tod + d * 1440; const hh = String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0'); if (d === 0) return 'Bugun ' + hh; if (d === 1) return 'Kecha ' + hh; const day = 2 - d; return (day >= 1 ? day + '-noy ' : (31 + day) + '-okt ') + hh; };
    const absD = t => { const m = String(t || '').match(/^(kecha|bugun|ertaga) (\d{1,2}:\d{2})$/i); if (!m) return t; const d = { kecha: '01', bugun: '02', ertaga: '03' }[m[1].toLowerCase()]; return d + '.11.2026 ' + m[2]; };
    const work = (ago, j) => { j = j || 0; const tod = ((103 - Math.round(ago)) % 1440 + 1440) % 1440; if (tod >= 540 && tod <= 1200) return ago; const adj = tod < 540 ? ago - (540 - tod) - 7 - j : ago + (tod - 1190) + j; return adj > 0 ? adj : ago; };
    const entryAgo = (a, jj) => { const m = String(a || '').match(/^(\d+) (kun|soat|daq)/); if (!m) return 0; if (m[2] === 'kun') { return (+m[1] + 1) * 1440 + 103 - (600 + (jj || 0) * 17); return +m[1] * 1440 + 300; } return m[2] === 'soat' ? +m[1] * 60 - 12 + ((jj || 0) % 25) : +m[1]; };
    const seedComs = (key, k, who) => { const n = seedN(key, k); if (!n) return []; const plan = histPlan(key, k); const orig0 = String(key).replace(/g?\d+$/, ''); const rl = k.reason || ((RF.find(r => r[0] === k.rk) || [])[1]) || ''; const sv0 = seedSv(key); const past = ['Qatnashdi', 'Muddati oʻtdi · natija kerak', 'Qatnashmadi', 'Natija kutilmoqda'].indexOf(k.trial) >= 0;
      const FT = orig0 === 'paid' ? ['Birinchi darsga eslatildi', 'Kitob manzili tasdiqlandi'] : orig0 === 'fail' ? ['Chegirma boʻlsa qaytishini aytdi', 'Narxni boshqa kurslar bilan solishtirgan'] : orig0 === 'new' ? ['Kechqurun bogʻlanish qulay ekan', 'Instagramdan yozgan, raqam qoldirgan'] : orig0 === 'trial' ? ['Darsdan oldin eslatildi', 'Dars vaqtini tasdiqladi'] : ['Qayta qoʻngʻiroq qilishni soʻradi', 'Narxni yana bir bor soʻradi', 'Ota-onasi bilan maslahatlashib javob beradi', 'Kechqurun qoʻngʻiroq qilish kerak', 'Dars vaqtlarini soʻradi'];
      const TX = { cf: () => ['Bogʻlanish sababi', 'Qoʻngʻiroq qilindi, lekin: ' + rl], an: () => ['Anketa', anketaTxt(sv0)], info: () => ['Maʼlumot', infoTxt()], trial: () => k.trial === 'Ustoz biriktirilmagan' ? ['Sinov darsi', 'Sinov darsi adminga yuborildi — "Ustoz biriktirilmagan":\n• Lid istagi: 03.11.2026, Seshanba, 18:00\n• Davomiyligi: 1 kun · 30 daq\n• Shu vaqtda sinovga ochiq ustoz yoʻq — admin/ROP ustoz biriktiradi'] : ['Sinov darsi', 'Sinov darsi belgilandi:\n• Oʻqituvchi: Dilnoza Karimova\n• Kuni: ' + (past ? '{LESSON}' : '03.11.2026, Seshanba, 18:00') + '\n• Davomiyligi: 1 kun'], tacc: () => ['Ustoz — sinov darsi', 'Sinov darsi soʻrovi ustoz tomonidan tasdiqlandi.', 'Dilnoza Karimova'], trej: () => ['Ustoz — sinov darsi', 'Sinov darsi soʻrovi ustoz tomonidan rad etildi.\nSabab: Shu vaqtda bandman\nUstoz taklif qilgan vaqtlar: 03.11 19:00\nIzoh: Kechroq vaqt qulay', 'Dilnoza Karimova'], tres: () => ['Ustoz — sinov darsi', k.trial === 'Qatnashdi' ? 'Sinov darsi: qatnashdi.\nMenejer uchun izoh: Darsda faol boʻldi, guruhga tayyor' : 'Sinov darsi: qatnashmadi.\nSabab: Oʻquvchi vaqtida qatnashmadi', 'Dilnoza Karimova'], dec: () => ['Qaror', 'Qaror jarayonida — sabab:\n• Narxni solishtiryapti'], def: () => ['', 'Keyin sotib olmoqchi:\n• Sabab: Puli hozir yoʻqligi sababli\n• Sotib olish sanasi: ' + (k.dp || '') + '\n• Xabarlashish sanasi: ' + (k.dc || '')], fail: () => ['', 'Muvaffaqiyatsiz sotuv: ' + (k.reason || 'Narx qimmat')], pay: () => ['Toʻlov', 'Toʻlov jarayonida — toʻlov:\n• Toʻlov turi: Toʻliq toʻlov\n• Tarif: 30 daqiqalik\n• Summa: 1,200,000'], onb: () => ['Oʻquvchi', 'Toʻlov jarayonida — oʻquvchi:\n• Oʻquvchiga aylansinmi: Ha\n• Platforma ulab berildi: Ha\n• Shartnoma: Toʻliq toʻlov boʻyicha shartnoma tuzildi (№ 041)\n— Kitob yetkazib berish:\n• Oʻquvchi: ' + k.n + '\n• Kurs darajasi: Boshlangʻich\n• Manzil: Toshkent sh., Chilonzor 9\n• Oʻqituvchi: Dilnoza Karimova\n• Dars jadvali: Dushanba, 18:00\n• Telegram guruh havolasi: t.me/+ru12group\n• Yordamchi: Sevinch Olimova\n• Ilk dars sanasi: 2026-11-04'] };
      const ANCH = { try: 'cf', con: 'an', trial: 'trial', dec: 'dec', defer: 'def', fail: 'fail', paid: 'onb' }[orig0];
      const slots = []; plan.forEach(p => { if (p === 'info') { slots[slots.length - 1].push(TX.info()); return; } slots.push([TX[p]()]); });
      const ai = ANCH ? plan.filter(p => p !== 'info').indexOf(ANCH) : -1;
      const post = []; const nFill = n - plan.length - (k.next ? 1 : 0); for (let i = 0; i < nFill; i++) post.push([['', FT[i % FT.length]]]); if (k.next) post.push([['Bogʻlanish eslatmasi', 'Bogʻlanish uchun eslatma: ' + absD(k.next)]]);
      const jit = String(key).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 29;
      const arr = agoOf(k.time); const ent0 = entryAgo(k.age, jit); const ent = ent0 && ent0 < arr - 20 ? ent0 : Math.max(4, arr - 6); const due = k.late ? agoOf(k.next) : -1; const U = due > 0 ? due + 15 + jit : ent > 420 ? 330 - jit : 2;
      const pre = ai >= 0 ? slots.slice(0, ai) : slots; const anc = ai >= 0 ? [slots[ai]] : []; const rest = ai >= 0 ? slots.slice(ai + 1).concat(post) : post;
      const tm = []; pre.forEach((_, i) => tm.push(work(arr - 5 - (arr - 5 - ent) * (i + 0.5) / Math.max(1, pre.length) - jit, jit))); anc.forEach(() => tm.push(ent)); rest.forEach((_, i) => tm.push(work(ent - (ent - U) * (i + 1) / (rest.length + (k.next ? 0 : 0.6)), jit)));
      for (let i = 1; i < tm.length; i++) if (tm[i] > tm[i - 1] - 5) tm[i] = Math.max(1, tm[i - 1] - 5);
      const all = pre.concat(anc, rest); const ia = all.findIndex(sl => sl[0][0] === 'Ustoz — sinov darsi' && /tasdiqlandi/.test(sl[0][1])); const ir = all.findIndex(sl => sl[0][0] === 'Ustoz — sinov darsi' && /qatnash/.test(sl[0][1])); const it0 = all.findIndex(sl => sl[0][0] === 'Sinov darsi'); const lo = ia >= 0 ? tm[ia] : it0 >= 0 ? tm[it0] : 0, hi = ir >= 0 ? tm[ir] : 2; let lAgo = Math.round((lo + hi) / 2); const lw = work(lAgo, 0); if (lw < lo && lw > hi) lAgo = lw; const absOf = ago => { const tod = 103 - Math.round(ago); const d = tod >= 0 ? 0 : Math.ceil(-tod / 1440); const mm = Math.round((tod + d * 1440) / 30) * 30; const day = 2 - d; const dd = day >= 1 ? String(day).padStart(2, '0') + '.11.2026' : (31 + day) + '.10.2026'; return dd + ', ' + ['Dushanba', 'Yakshanba', 'Shanba', 'Juma', 'Payshanba', 'Chorshanba', 'Seshanba'][d % 7] + ', ' + String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0'); }; const out = []; all.forEach((sl, i) => sl.forEach(it => out.push({ h: labOf(tm[i]) + ' · ' + (it[2] || who) + (it[0] ? ' · ' + it[0] : ''), t: it[1].replace('{LESSON}', absOf(lAgo)) }))); return out.reverse(); };
    // --- Qotgan lidlar hisobi (staleLeads.js DEFAULT warn 3 / lock 5, compute) ---
    const RULE = { warnDays: 3, lockDays: 5 };
    const NOSTALE = s.demo === 'empty';
    // "Urinilmoqda"da turibdi va hech qachon "Bogʻlanildi"ga chiqmagan; kun — menejerga berilgan sanadan (sd)
    const stl = NOSTALE || loading ? [] : BOARD.try.filter(x => !hasSurvey(x.key) && (x.k.sd || 0) >= RULE.warnDays).sort((a, b) => (b.k.sd || 0) - (a.k.sd || 0));
    const lockL = stl.filter(x => x.k.sd >= RULE.lockDays), warnL = stl.filter(x => x.k.sd < RULE.lockDays);
    // --- Qoʻngʻiroq navbati (mobil sotuvApp.js callQueue :201 + computeManagerHome app.js:8500) ---
    const fmtDur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? h + ' soat' + (mm ? ' ' + mm + ' daq' : '') : mm + ' daq'; };
    const dueOf = x => { const fs = (s.fuSet || {})[x.key]; const nx = fs || ((s.fuDone || {})[x.key] ? '' : x.k.next); if (!nx) return null; const m = String(nx).match(/^(kecha|bugun) (\d{1,2}):(\d{2})$/i); if (!m) return null; const at = (m[1].toLowerCase() === 'kecha' ? -1440 : 0) + (+m[2]) * 60 + +m[3]; return { late: at < 103 ? 1 : 0, at, lab: m[2].padStart(2, '0') + ':' + m[3] }; };
    const qAll = []; if (!loading) OPEN_ST.forEach(cid => BOARD[cid].forEach(x => { if (!x.k.gen) qAll.push({ x, cid }); }));
    const qTasks = qAll.map(o => Object.assign({}, o, { d: dueOf(o.x) })).filter(o => o.d).sort((a, b) => (b.d.late - a.d.late) || (a.d.at - b.d.at));
    const qSeen = {}; qTasks.forEach(o => { qSeen[o.x.key] = 1; });
    const lastAt = key => { const c = callsOfK(key); return c.length ? -Math.min.apply(null, c.map(agoL)) : -Infinity; };
    const qExtra = qAll.filter(o => !qSeen[o.x.key] && (o.cid === 'try' || o.cid === 'new') && o.x.k.phones.length).sort((a, b) => (lastAt(a.x.key) - lastAt(b.x.key)) || (agoOf(b.x.k.time) - agoOf(a.x.k.time)));
    const qList = qTasks.concat(qExtra);
    const qIdx = qList.length ? (s.qSkip || 0) % qList.length : 0; const qCur = qList[qIdx] || null;
    const qChip0 = !qCur ? null : qCur.d ? (qCur.d.late ? ['Kechikdi · ' + qCur.d.lab, 'color:#FFFFFF;background:#D92D20'] : [qCur.d.lab + ' · ' + fmtDur(qCur.d.at - 103) + ' qoldi', 'color:#7A2E0E;background:#FEC84B']) : qCur.cid === 'try' ? [(qCur.x.k.sd || 0) + ' kun · ' + callN(qCur.x.key) + ' urinish', 'color:#E2E8F0;background:#334155'] : null;
    const qUpL = qList.length > 1 ? qList.slice(qIdx + 1).concat(qList.slice(0, qIdx)) : [];
    // --- Qoʻngʻiroq natijasi (mobil openCallResult :643, outcome :686) ---
    const openCr = (key, from, extra) => { const st = logCall(key, Object.assign({ cr: { key, pick: '', note: '', chips: {}, fu: '', from: from || '' }, menu: '', sub: false }, extra || {})); this.setState(st); this.focusSoon('[data-cr] [role=radio]'); };
    const crS = s.cr || null; const crK = crS ? crS.key : ''; const crC = crK ? cardOf(crK) : {}; const crCol = crK ? colOf(crK) : '';
    const crBefore = crCol === 'new' || crCol === 'try'; const crLocked = crBefore && !hasSurvey(crK);
    const setCr = p => this.setState({ cr: Object.assign({}, crS, p) });
    const OIC = { talked: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', noanswer: 'M12 3a9 9 0 110 18 9 9 0 010-18zM5.6 5.6l12.8 12.8', later: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2', trial: 'M8.5 12l2.5 2.5 4.5-5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z', pay: 'M2 6h20v13H2zM2 10h20', fail: 'M6 6l12 12M18 6L6 18' };
    const OUTS = [['talked', 'Gaplashdik', crBefore ? 'anketa ochiladi' : '', '#0057B8;background:#EAF3FF'], ['noanswer', 'Javob bermadi', 'urinishlar: ' + (crK ? callN(crK) : 0), '#B42318;background:#FEF3F2'], ['later', 'Keyin oladi', 'sana soʻraladi', '#B54708;background:#FFFAEB'], ['trial', 'Sinovga yozildi', crLocked ? 'anketadan keyin' : 'vaqt tanlanadi', '#067647;background:#ECFDF3', crLocked], ['pay', 'Toʻlov qiladi', crLocked ? 'anketadan keyin' : 'toʻlov qadamlari', '#0057B8;background:#EAF3FF', crLocked], ['fail', 'Qiziqmaydi', 'sabab soʻraladi', '#3A4456;background:#F1F5F9']];
    const CRL = { talked: crBefore ? 'Saqlash va anketaga oʻtish' : 'Saqlash', noanswer: 'Saqlash', later: 'Saqlash va sanani tanlash', trial: 'Saqlash va vaqt tanlash', pay: 'Saqlash va toʻlovga oʻtish', fail: 'Saqlash va sabab' };
    const fuLab = v => { const d0 = v.slice(0, 10); return (d0 === '2026-11-02' ? 'bugun ' : d0 === '2026-11-03' ? 'ertaga ' : (+v.slice(8, 10)) + '-' + ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][+v.slice(5, 7) - 1] + ' ') + v.slice(11, 16); };
    const crLater = () => { const from = crS && crS.from; const k = crK; this.setState({ cr: null }); if (k) this.focusSoon(from || back(k)); };
    const doOut = k => {
      if (!crS) return; if (s.demo === 'err') { setCr({ err: true }); return; }
      const key = crK, note = (crS.note || '').trim(), fu = crS.fu || '';
      const coms = Object.assign({}, s.coms || {}); const addC = (t, h) => { coms[key] = [{ h: 'Hozir · Kamola S.' + (h ? ' · ' + h : ''), t }].concat(coms[key] || []); };
      // Izoh — qoʻngʻiroq haqidagi fakt: keyingi oyna bekor qilinsa ham tarixda qoladi (prod: ataylab)
      if (note) addC(note);
      const st = { cr: null, coms };
      const applyFu = () => { if (!fu) return ''; const lbl = fuLab(fu); const f2 = Object.assign({}, s.fuSet || {}); f2[key] = lbl; const ac = Object.assign({}, s.ack || {}); ac[key + ':late'] = '01:43'; st.fuSet = f2; st.ack = ac; addC('Bogʻlanish uchun eslatma: ' + fu.slice(8, 10) + '.' + fu.slice(5, 7) + '.' + fu.slice(0, 4) + ' ' + fu.slice(11, 16), 'Bogʻlanish eslatmasi'); return lbl; };
      const back0 = crS.from || back(key);
      if (k === 'talked' && !crBefore) { if (!note) addC('Qoʻngʻiroq: gaplashildi'); const l = applyFu(); st.toast = { text: 'Tarixga yozildi', sub: (crC.n || '') + (l ? ' · keyingi qoʻngʻiroq: ' + l : ''), kind: 'ok' }; this.setState(st); this.armToast(); this.focusSoon(back0); return; }
      if (k === 'noanswer' && crCol !== 'new') { addC('Qoʻngʻiroq qilindi, lekin: Javob bermadi', 'Bogʻlanish sababi'); const l = applyFu(); st.toast = { text: '“Javob bermadi” yozildi · ' + callN(key) + '-urinish', sub: l ? 'Keyingi qoʻngʻiroq: ' + l : 'Eslatma qoʻyilmadi — lid kartasidagi “Bogʻlanish eslatmasi”dan qoʻyish mumkin', kind: 'ok' }; this.setState(st); this.armToast(); this.focusSoon(back0); return; }
      const MAPO = { talked: 'con', noanswer: 'try', later: 'defer', trial: 'trial', pay: 'pay', fail: 'fail', junk: 'junk' };
      this.setState(st); requestMove(key, MAPO[k]);
    };
    const TRYT = Object.keys(RFL).reduce((a, r) => a + RFL[r], 0);
    const dk = s.drw ? s.drw.key : ''; const dc = dk ? cardOf(dk) : {}; const dcol = dk ? colOf(dk) : ''; const dMid = dk ? (s.assigned[dk] !== undefined ? s.assigned[dk] : dc.mgr) : ''; const dM = MG[dMid];
    const PATH = ['new', 'try', 'con', 'trial', 'dec', 'pay', 'paid']; const pIx = PATH.indexOf(dcol === 'defer' ? 'dec' : dcol);
    const dAlerts0 = dk && dc.notif && !(s.ack || {})[dk] ? (dc.late ? ['Qoʻngʻiroq muddati oʻtdi: ' + (dc.next || '')] : []).concat(dc.sk === 'lock' ? ['Qotgan lid: ' + dc.stale] : []).concat(dc.notif && !dc.late && dc.sk !== 'lock' ? ['Menejersiz ' + dc.age + ' kutmoqda — SLA'] : []) : [];
    const dTab = s.drw ? s.drw.tab : 'main';
    const dAlertsL = dk ? alertsOf(dk, dc, dMid) : [];
    return {
      shOpen: !!s.sh, shCf: !!(s.sh && s.sh.t === 'cf'), shSif: !!(s.sh && s.sh.t === 'sif'), shBlocked: !!(s.sh && s.sh.t === 'blocked'), shGrace: !!(s.sh && s.sh.t === 'grace'),
      shName: shC.n || '', shIni: ini(shC.n), shAvSt: shK ? avcOf(shK) : '', shTel: (shC.phones || [])[0] || 'Telefon raqami yoʻq', shTelT: 'Qoʻngʻiroq: ' + ((shC.phones || [])[0] || ''), shTelH: 'tel:' + String((shC.phones || [])[0] || '').replace(/\s/g, ''), shDays: shK && shC.sd ? shC.sd + ' kun' : '',
      shClose: () => closeSh(), shKey: e => trap(e, closeSh),
      shCallNow: () => { const key = shK; if (!key) return; const st = logCall(key, { sh: null }); if (MODE !== 'leads') { openCr(key, gOpenNow ? '[data-lock="' + key + '"] a' : back(key), { sh: null }); return; } st.toast = { text: 'Qoʻngʻiroq qayd etildi', sub: (shC.n || '') + ' · endi “Sifatsiz”ga oʻtkazish mumkin', kind: 'ok' }; this.setState(st); this.armToast(); this.focusSoon(gOpenNow ? '[data-lock="' + key + '"] button' : back(key)); },
      picking: pickN > 0 ? '1' : false,
      dTelT: MODE === 'call' ? 'Qoʻngʻiroq qilish — urinish yoziladi, natija oynasi ochiladi' : 'Qoʻngʻiroq qilish', dTelClick: () => { if (MODE === 'call' && dk && OPEN_ST.indexOf(dcol) >= 0) openCr(dk, '.drw a[href^="tel:"]'); },
      smsSeg: (() => { if (!s.sms) return ''; const T = ['Assalomu alaykum, {name}! Homework rus tili kursi boʻyicha siz bilan bogʻlanmoqchi edik.', 'Assalomu alaykum, {name}! Sizga qulay vaqtda Homework kursi haqida batafsil maʼlumot beramiz.', 'Assalomu alaykum, {name}! Homework rus tili kursiga yozilish boʻyicha savollaringiz boʻlsa, mamnuniyat bilan javob beramiz.'][s.smsT || 0].replace('{name}', s.sms.bulk ? 'Shahnoza' : String(s.sms.n || '')); const uni = /[^\x00-\x7F]/.test(T); const len = T.length; const per = uni ? (len > 70 ? 67 : 70) : (len > 160 ? 153 : 160); const seg = Math.ceil(len / per); const n = s.sms.bulk ? (s.sms.cnt || 1) : 1; return 'Matn: ' + len + ' belgi · ' + seg + ' SMS' + (uni ? ' (ʻ va ʼ belgilari sababli Unicode — 70 belgidan)' : '') + (n > 1 ? ' · jami ' + n + ' qabul qiluvchi × ' + seg + ' = ' + (n * seg) + ' SMS' : ''); })(),
      wShow: !loading && !NOSTALE && stl.length > 0,
      wT: stl.length + ' ta lid ' + RULE.warnDays + ' kundan beri olmayapti',
      wS: lockL.length ? 'Baʼzilarini hoziroq “Sifatsiz”ga oʻtkazish shart' : Math.max(1, RULE.lockDays - (warnL[0] ? warnL[0].k.sd : RULE.lockDays)) + ' kundan keyin “Sifatsiz”ga oʻtkazish shart',
      wGo: () => { const f = lockL[0] || warnL[0]; if (!f) return; this.setState({ shut: Object.assign({}, s.shut, { try: false }), risk: '' }); this.focusSoon('[data-card="' + f.key + '"]'); },
      qShow: true, qLoading: loading, qCalm: !loading && !qList.length, qHas: !loading && !!qCur, qMany: qList.length > 1,
      qPos: qList.length ? (qIdx + 1) + ' / ' + qList.length : '', qChip: qChip0 ? qChip0[0] : '', qChipSt: qChip0 ? qChip0[1] : '',
      qName: qCur ? qCur.x.k.n : '', qMeta: qCur ? [NAME[qCur.cid], callsOfK(qCur.x.key)[0] ? 'oxirgi qoʻngʻiroq: ' + callsOfK(qCur.x.key)[0].toLowerCase() : (qCur.cid === 'try' ? 'hali qoʻngʻiroq yoʻq' : ''), qCur.x.k.src].filter(Boolean).join(' · ') : '',
      qTelH: qCur ? 'tel:' + String(qCur.x.k.phones[0] || '').replace(/\s/g, '') : '', qTelT: qCur ? 'Qoʻngʻiroq: ' + (qCur.x.k.phones[0] || '') + ' — natija oynasi ochiladi' : '',
      qOpen: () => { if (qCur) openDrw(qCur.x.key, 'main'); }, qCall: () => { if (qCur) openCr(qCur.x.key, '[data-qcall]'); }, qSkipGo: () => this.setState({ qSkip: (s.qSkip || 0) + 1 }),
      qUp: qUpL.slice(0, 3).map((o, i) => ({ t: (i === 0 ? 'Keyin: ' : '') + String(o.x.k.n).split(' ')[0], tip: o.x.k.n + ' · ' + NAME[o.cid], go: () => openDrw(o.x.key, 'main') })), qMore: qUpL.length > 3 ? '+' + (qUpL.length - 3) : '',
      crOpen: !!crS, crSub: crS ? (crC.n || '') + ' · ' + (NAME[crCol] || '') + ((crC.phones || [])[0] ? ' · ' + crC.phones[0] : '') : '',
      crN: crK ? callN(crK) : 0, crPrev: crK ? (callsOfK(crK)[1] ? 'oldingisi: ' + callsOfK(crK)[1] : 'birinchi qoʻngʻiroq') : '',
      crOpts: OUTS.map((o, i) => ({ k: o[0], t: o[1], sub: o[2], lk: !!o[4], ic: OIC[o[0]], icSt: 'color:' + o[3], on: crS && crS.pick === o[0] ? 'true' : 'false', ti: (crS && crS.pick ? crS.pick === o[0] : i === 0) ? '0' : '-1', cls: 'sk-opt' + (o[4] ? ' sk-lk' : ''), pick: () => { setCr({ pick: o[0], need: false, err: false }); this.focusSoon('[data-out="' + o[0] + '"]'); } })),
      crRadKey: e => { if (!e || !crS) return; const ks = OUTS.map(o => o[0]); const cur = (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.out) || crS.pick || ks[0]; const i = ks.indexOf(cur); let n = -1; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % ks.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + ks.length - 1) % ks.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = ks.length - 1; if (n < 0) return; e.preventDefault(); setCr({ pick: ks[n], need: false }); this.focusSoon('[data-out="' + ks[n] + '"]'); },
      crSix: crK && crCol === 'try' && callN(crK) >= 6 ? 'Bu lidga ' + callN(crK) + ' marta qoʻngʻiroq qilingan. “Qiziqmaydi” → “Telefonini koʻtarmadi (6+ urinishdan soʻng)” sababini tanlash mumkin.' : '',
      crChips: ['Narxni soʻradi', 'Oila bilan maslahatlashadi', 'Kechqurun qulay', 'Ish uchun', 'Farzandi uchun'].map(t => { const on = !!crS && (crS.note || '').indexOf(t) >= 0; return { t, on: on ? 'true' : 'false', tog: () => { const v = crS.note || ''; const nv = on ? v.replace(t, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : (v ? v.replace(/[.\s]+$/, '') + ', ' : '') + t; setCr({ note: nv }); } }; }),
      crNote: crS ? crS.note || '' : '', crNoteIn: e => setCr({ note: e && e.target ? e.target.value : '' }),
      crFuShow: !!crS && ((crS.pick === 'noanswer' && crCol !== 'new') || (crS.pick === 'talked' && !crBefore)),
      crFuQuick: [['1 soatdan keyin', '2026-11-02T02:43'], ['Bugun 18:00', '2026-11-02T18:00'], ['Ertaga 10:00', '2026-11-03T10:00']].map(q => ({ t: q[0], on: crS && crS.fu === q[1] ? 'true' : 'false', pick: () => setCr({ fu: crS.fu === q[1] ? '' : q[1] }) })),
      crFuV: crS ? crS.fu || '' : '', crFuIn: e => setCr({ fu: e && e.target ? e.target.value : '' }), crFuErr: !!(crS && crS.fu && crS.fu <= '2026-11-02T01:43'), crFuInv: crS && crS.fu && crS.fu <= '2026-11-02T01:43' ? 'true' : 'false',
      crErr: !!(crS && crS.err), crRetry: () => { this.setState({ demo: 'ok', cr: Object.assign({}, crS, { err: false }) }); setTimeout(() => { const r = this.renderVals(); r.crSave(); }, 30); },
      crNeed: !!(crS && crS.need), crDis: crS && crS.pick ? 'false' : 'true', crSaveSt: crS && crS.pick ? '' : 'background:#CBD5E1;color:#4B5563;cursor:not-allowed', crBtn: crS && crS.pick ? CRL[crS.pick] : 'Natijani tanlang',
      crLater, crKey: e => trap(e, crLater), crJunk: () => doOut('junk'),
      crSave: () => { if (!crS) return; if (!crS.pick) { setCr({ need: true }); this.focusSoon('[data-cr] [role=radio]'); return; } if (crS.fu && crS.fu <= '2026-11-02T01:43') { this.focusSoon('#crFu'); return; } doOut(crS.pick); },
      dCallBtn: OPEN_ST.indexOf(dcol) >= 0, dCall: () => openCr(dk, '#drwCall'),
      notVb: !vb, loadingAll: s.demo === 'load', notLoading: s.demo !== 'load',
      vbNote: vb && cols.some(c => c.hideCol) ? cols.filter(c => c.hideCol).length + ' ta bosqichda menejersiz lid yoʻq' : '',
      hiddenLeft: hiddenLeft ? hiddenLeft + ' ustun chapda' : '', hiddenLeftN: hiddenLeft ? hiddenLeft + ' ustun' : '', hiddenRightN: hiddenRight ? hiddenRight + ' ustun' : '', scrollLeftB: () => { const el = document.getElementById('leadsPanel'); if (el) el.scrollBy({ left: -520, behavior: 'smooth' }); },
      onBoardScroll: e => { const el = e && e.currentTarget; if (!el) return; const sl = Math.round(el.scrollLeft / 20) * 20; if (sl !== s.sl || el.clientWidth !== s.scW) { const keep = el.scrollLeft; this.setState({ sl, scW: el.clientWidth }); setTimeout(() => { const n = document.getElementById('leadsPanel'); if (n && Math.abs(n.scrollLeft - keep) > 2) n.scrollLeft = keep; }, 0); } },
      drwOpen: !!s.drw, closeDrw: () => { const k = dk; this.setState({ drw: null }); if (k) this.focusSoon('[data-card="' + k + '"]'); },
      dName: dc.n || '', dSub: 'Rus tili · ' + (dc.src || '') + ' · ' + comN(dk, dc) + ' ta izoh', dStage: NAME[dcol] || '', dStageSt: 'display:inline-block;font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;background:#EAF3FF;color:#0057B8',
      dTabs: [['main', 'Umumiy', ''], ['com', 'Izohlar', comN(dk, dc) || ''], ['rec', 'Zapis', s.demo === 'err' && !s.recRetry ? '' : (recN(dk, dc) || '')], ['not', 'Bildirishnomalar', dk ? (unreadOf(dk, dc, dMid) || '') : '']].map(t => ({ id: 'dt_' + t[0], ti: dTab === t[0] ? '0' : '-1', t: t[1], n: t[2] ? String(t[2]) : '', on: dTab === t[0] ? 'true' : 'false', pick: () => { const r = Object.assign({}, s.readRop || {}); if (t[0] === 'not') r[dk] = true; this.setState({ drw: { key: dk, tab: t[0] }, readRop: r }); } })),
      dTabId: 'dt_' + dTab,
      dTabKey: e => { if (!e) return; const T = ['main', 'com', 'rec', 'not']; const i = T.indexOf(dTab); let n = -1; if (e.key === 'ArrowRight') n = (i + 1) % 4; else if (e.key === 'ArrowLeft') n = (i + 3) % 4; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 3; if (n < 0) return; e.preventDefault(); this.setState({ drw: { key: dk, tab: T[n] } }); this.focusSoon('#dt_' + T[n]); },
      dChangeLab: dM ? 'Menejerni almashtirish' : 'Menejer biriktirish',
      dTabMain: dTab === 'main', dTabCom: dTab === 'com', dTabRec: dTab === 'rec', dTabNot: dTab === 'not',
      dTel: (dc.phones || [''])[0], dTelH: 'tel:' + ((dc.phones || [''])[0] || '').replace(/\s/g, ''), dTels: (dc.phones || []).join(' · '),
      dStages: ALLCOLS.map(c => ({ id: c[0], t: c[1] + (c[0] === dcol ? ' · joriy' : ''), cur: c[0] === dcol })), dStageSel: e => { const v = e && e.target ? e.target.value : ''; if (e && e.target) e.target.value = ''; if (v) { this.setState({ origin: '#drwStage' }); requestMove(dk, v); } },
      dSteps: PATH.map((p, i) => i <= pIx ? 'on' : ''), dStepLab: pIx >= 0 ? (pIx + 1) + '-bosqich / 7 · ' + (NAME[dcol] || '') : (NAME[dcol] || '') + ' (voronkadan tashqari)',
      dAlerts: dAlertsL.length ? dAlertsL.map(a => ({ t: a.t, aud: 'Sizga' })) : '', dNoAlert: !dAlertsL.length,
      dAlertsN: dAlertsL.map(a => ({ t: a.t, aud: 'Sizga', audSt: a.rop ? 'color:#5B21B6;background:#F1E8FF' : 'color:#3A4456;background:#F1F5F9', canAck: false, watch: true, st: a.rop ? 'border-color:#FDA29B;background:#FFFBFA' : '', ack: () => { if (s.demo === 'err') { errToast(); return; } const ac = Object.assign({}, s.ack || {}); ac[dk + ':' + a.id] = '01:43'; const h = Object.assign({}, s.ackH || {}); h[dk] = (h[dk] || []).concat([{ h: 'Koʻrib chiqildi · 01:43 · Kamola S.', t: a.t }]); this.setState({ ack: ac, ackH: h }); } })), dGoNotif: () => { const r = Object.assign({}, s.readRop || {}); r[dk] = true; this.setState({ drw: { key: dk, tab: 'not' }, readRop: r }); }, dAck: () => { if (s.demo === 'err') { errToast(); return; } const a = Object.assign({}, s.ack || {}); a[dk] = '01:42'; this.setState({ ack: a, drw: { key: dk, tab: 'not' } }); },
      dAckHist: dk ? ((s.ackH || {})[dk] || []) : [],
      dMgr: dM ? dM.full : 'Menejer biriktirilmagan', dMgrIni: dM ? dM.full.split(' ').map(w => w[0]).join('') : '+', dMgrAv: 'width:40px;height:40px;font-size:13px;' + (dM ? avSt(dM) : 'border:1.5px dashed #94A3B8;color:#0057B8'),
      dChangeMgr: () => { this.setState({ mp: dk, mpXY: { x: 1100, y: 330 }, mq: '', mpView: 'list' }); this.focusSoon('[data-menu] input'); },
      dSrc: dc.src || '', dTime: dc.time || '', dId: dc.serial ? '#' + dc.serial : '', dHasId: !!dc.serial, dRegion: (() => { const p = (s.svPrev || {})[dk] || seedSv(dk); if (!p || !p.reg) return 'Anketa toʻldirilmagan'; const r = UZR.concat(FOR).find(o => o[0] === p.reg); return r ? (p.res === 'foreign' ? 'Davlat: ' : '') + r[1] : 'Anketa toʻldirilmagan'; })(), dComEmpty: !comN(dk, dc),
      dLastCom: (() => { const A = (COMS[dk] || []).concat(dk ? seedComs(dk, dc, dM ? dM.sh : 'Kamola S.') : []); return A.length ? A[0].h + ': ' + A[0].t : 'Hozircha izoh yoʻq'; })(),
      dIsTrial: dcol === 'trial', dTrialInfo: dc.trial ? 'Holati: ' + dc.trial + (dc.thint ? ' — ' + dc.thint : '') : 'Holati: Tasdiq kutilmoqda',
      dResched: () => { if (dc.trial === 'Rad etildi') { this.setState({ origin: '.drw .dsec [aria-haspopup=dialog]', flow: { key: dk, from: 'trial', to: 'trial', resched: true } }); return; } this.setState({ origin: '.drw .dsec [aria-haspopup=dialog]', survey: { key: dk, from: 'trial', to: 'trial', kind: 'resched', steps: 1 }, svStep: 0, svr: '', svf: {} }); this.focusSoon('[data-modal] input'); },
      openBooks: () => { this.setState({ toast: { text: 'Kitob yetkazish', sub: 'Alohida sahifa — hozirgi koʻrinishi saqlanadi', kind: 'ok' } }); this.armToast(); },
      ...(A => ({ dComs: s.comAll === dk ? A : A.slice(0, 3), dComMore: s.comAll !== dk && A.length > 3 ? 'Yana ' + (A.length - 3) + ' ta oldingi izoh' : '', dComMoreGo: () => this.setState({ comAll: dk }) }))((COMS[dk] || []).concat(dk ? seedComs(dk, dc, dM ? dM.sh : 'Kamola S.') : [])),
      dComIn: e => this.setState({ comTxt: e && e.target ? e.target.value : '' }), dComErr: s.comTried && !(s.comTxt || '').trim(), dComInv: s.comTried && !(s.comTxt || '').trim() ? 'true' : 'false', dComCls: 'fld' + (s.comTried && !(s.comTxt || '').trim() ? ' ferr' : ''),
      dComSave: () => { if (!(s.comTxt || '').trim()) { this.setState({ comTried: true }); this.focusSoon('.drw textarea'); return; } if (s.demo === 'err') { errToast('Izoh saqlanmadi — matn saqlanib qoldi'); return; } const c0 = Object.assign({}, s.coms || {}); c0[dk] = [{ h: 'Hozir · Kamola S.', t: s.comTxt.trim() }].concat(c0[dk] || []); const f2 = Object.assign({}, s.fuSet || {}); const fuOver = (s.fuSet || {})[dk] ? false : !!(dc.late && !(s.ack || {})[dk + ':late'] && !(s.fuDone || {})[dk]); const hadFu = fuOver; const ac = Object.assign({}, s.ack || {}); if (fuOver) ac[dk + ':late'] = '01:43'; const fd = Object.assign({}, s.fuDone || {}); if (hadFu) fd[dk] = true; this.setState({ coms: c0, comTxt: '', comTried: false, fuSet: f2, ack: ac, fuDone: fd, toast: hadFu ? { text: 'Izoh saqlandi', sub: 'Muddati oʻtgan eslatma yopildi', kind: 'ok' } : { text: 'Izoh saqlandi', kind: 'ok' } }); this.armToast(); },
      dFu: !!s.fu, dFuExp: s.fu ? 'true' : 'false', dFuToggle: () => { this.setState({ fu: !s.fu }); if (!s.fu) this.focusSoon('.drw input[type=datetime-local]'); },
      dFuHint: ['paid', 'fail', 'junk'].indexOf(dcol) >= 0 ? 'Yopilgan bosqich — eslatma saqlanadi, lekin kartada koʻrinmaydi.' : 'Belgilangan vaqtda menejerga eslatma keladi, kartada “Qoʻngʻiroq · …” chiqadi. Belgilangan vaqtdan keyin izoh yozilsa, eslatma yopiladi.', dFuV: s.fuV || '2026-11-03T10:00', dFuIn: e => this.setState({ fuV: e && e.target ? e.target.value : '' }), dFuErr: !!(s.fuV && s.fuV <= '2026-11-02T01:43'), dFuInv: s.fuV && s.fuV <= '2026-11-02T01:43' ? 'true' : 'false',
      dFuSave: () => { const v = s.fuV || '2026-11-03T10:00'; if (v <= '2026-11-02T01:43') { this.focusSoon('.drw input[type=datetime-local]'); return; } if (s.demo === 'err') { errToast('Eslatma saqlanmadi'); return; } const dk0 = v.slice(0, 10); const lbl = (dk0 === '2026-11-02' ? 'bugun ' : dk0 === '2026-11-03' ? 'ertaga ' : dk0 === '2026-11-01' ? 'kecha ' : (+v.slice(8, 10)) + '-' + ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][+v.slice(5, 7) - 1] + ' ') + v.slice(11, 16); const f2 = Object.assign({}, s.fuSet || {}); f2[dk] = lbl; const ac = Object.assign({}, s.ack || {}); ac[dk + ':late'] = '01:43'; const h = Object.assign({}, s.ackH || {}); if (dc.late) h[dk] = (h[dk] || []).concat([{ h: 'Yangi eslatma qoʻyildi · ' + lbl, t: 'Qoʻngʻiroq muddati oʻtgani yopildi' }]); const c0 = Object.assign({}, s.coms || {}); c0[dk] = [{ h: 'Hozir · Kamola S. · Bogʻlanish eslatmasi', t: 'Bogʻlanish uchun eslatma: ' + v.slice(8, 10) + '.' + v.slice(5, 7) + '.' + v.slice(0, 4) + ' ' + v.slice(11, 16) }].concat(c0[dk] || []); this.setState({ coms: c0, fu: false, fuSet: f2, ack: ac, ackH: h, toast: { text: 'Eslatma saqlandi', sub: (dc.n || '') + ' · ' + lbl, kind: 'ok' } }); this.armToast(); },
      dRecs: s.demo === 'load' || (s.demo === 'err' && !s.recRetry) ? [] : recAll(dk, dc, dM ? dM.sh : '').map(r => ({ h: r.h, conf: s.recConf === r.id, del: () => this.setState({ recConf: r.id }), delNo: () => this.setState({ recConf: '', recDelErr: '' }), delErr: s.recDelErr === r.id ? 'Yozuv oʻchirilmadi — server javob bermadi. Qayta urinib koʻring.' : '', delBusy: s.recDelBusy === r.id ? 'true' : 'false', delLab: s.recDelBusy === r.id ? 'Oʻchirilmoqda...' : 'Oʻchirish', delYes: () => { if (s.recDelBusy) return; this.setState({ recDelBusy: r.id }); setTimeout(() => { if (this.state.demo === 'err') { this.setState({ recDelBusy: '', recDelErr: r.id }); return; } const d = Object.assign({}, this.state.recDel || {}); d[r.id] = true; this.setState({ recDel: d, recConf: '', recDelBusy: '', recDelErr: '', toast: { text: 'Yozuv oʻchirildi', sub: r.h, kind: 'ok' } }); this.armToast(); }, 600); } })), dNoRec: s.demo !== 'load' && !(s.demo === 'err' && !s.recRetry) && !recN(dk, dc), dRecLoad: s.demo === 'load', dRecErr: s.demo === 'err' && !s.recRetry, recRetryGo: () => this.setState({ recRetry: true }),
      recUpLab: s.recUp ? 'Yuklanmoqda...' : '+ Yozuv yuklash', recUpA: s.recUp ? 'true' : 'false', recUpErr: s.recUpErr || '',
      recUpload: () => { if (s.recUp) return; this.setState({ recUp: true, recUpErr: '' }); setTimeout(() => { if (this.state.demo === 'err') { this.setState({ recUp: false, recUpErr: 'Yuklashda xatolik: server javob bermadi' }); return; } const a = Object.assign({}, this.state.recAdd || {}); a[dk] = [{ id: dk + 'u' + Date.now(), h: 'Hozir · Qoʻlda yuklangan · Kamola S.' }].concat(a[dk] || []); this.setState({ recUp: false, recAdd: a, toast: { text: 'Yozuv yuklandi', sub: 'qongiroq_0211.mp3', kind: 'ok' } }); this.armToast(); }, 800); },
      menuSms: () => { const k = s.menu || dk; const c0 = cardOf(k); if (!(c0.phones || [])[0]) { this.setState({ menu: '', sub: false, toast: { text: 'Lidning telefon raqami topilmadi', sub: c0.n || '', kind: 'err' } }); this.armToast(); return; } this.setState({ menu: '', sub: false, sms: { key: k, n: c0.n, ph: (c0.phones || [''])[0] }, smsT: 0, smsErr: false }); this.focusSoon('[aria-labelledby=smsT] input'); },
      menuTg: () => { const k = s.menu || dk; const c0 = cardOf(k); this.setState({ menu: '', sub: false, toast: { text: 'Telegram ochilmoqda…', sub: (c0.n || '') + ' · ' + ((c0.phones || [''])[0] || 'raqam yoʻq'), kind: 'ok' } }); this.armToast(); },
      smsOpen: !!s.sms, smsTo: s.sms ? (s.sms.bulk ? s.sms.n + ': ' + s.sms.names + ' — har biriga oʻz ismi bilan' : s.sms.n + ' — ' + s.sms.ph) : '', bulkSms: () => { const nm = pickKeys.map(k => String(cardOf(k).n || '').split(' ')[0]); this.setState({ sms: { key: pickKeys[0], n: pickN + ' ta lid', ph: '', bulk: true, cnt: pickN, names: nm.slice(0, 3).join(', ') + (nm.length > 3 ? ' va yana ' + (nm.length - 3) : '') }, smsT: 0, smsErr: false }); this.focusSoon('[aria-labelledby=smsT] input'); }, closeSms: () => { this.setState({ sms: null, smsErr: false }); this.focusSoon(s.drw ? '#drwSms' : s.sms ? '[data-card="' + s.sms.key + '"]' : '#addLeadBtn'); },
      smsTpl: ['Assalomu alaykum, {name}! Homework rus tili kursi boʻyicha siz bilan bogʻlanmoqchi edik.', 'Assalomu alaykum, {name}! Sizga qulay vaqtda Homework kursi haqida batafsil maʼlumot beramiz.', 'Assalomu alaykum, {name}! Homework rus tili kursiga yozilish boʻyicha savollaringiz boʻlsa, mamnuniyat bilan javob beramiz.'].map(t => t.replace('{name}', s.sms ? (s.sms.bulk ? '{ism}' : String(s.sms.n || '')) : '')).map((t, i) => ({ t, on: s.smsT === i, pick: () => this.setState({ smsT: i }) })),
      smsBusyA: s.smsBusy ? 'true' : 'false', smsBusySt: s.smsBusy ? 'opacity:.7;cursor:progress' : '', smsBtnL: s.smsBusy ? 'Yuborilmoqda...' : (s.smsErr ? 'Qayta yuborish' : 'SMS yuborish'), sendSms: () => { if (s.smsBusy) return; const sm = s.sms; this.setState({ smsBusy: true, smsErr: false }); setTimeout(() => { if (this.state.demo === 'err') { this.setState({ smsBusy: false, smsErr: true }); return; } this.focusSoon(this.state.drw ? '#drwSms' : sm ? '[data-card="' + sm.key + '"]' : 'body'); this.setState({ smsBusy: false, sms: null, smsErr: false, picked: sm && sm.bulk ? {} : this.state.picked, toast: { text: 'SMS yuborildi', sub: sm ? sm.n + (sm.ph ? ' · ' + sm.ph : '') : '', kind: 'ok' } }); this.armToast(); }, 700); },
      smsSrvErr: !!s.smsErr, 
      svSrvErr: !!s.svErr, svRetry: () => { this.setState({ demo: 'ok', svErr: false }); setTimeout(() => { const r = this.renderVals(); r.svSave(); }, 30); },
      svSteps: s.survey && s.survey.steps > 1 && !(s.survey.rf && s.svStep === 0 && NOCON.indexOf(s.svr) >= 0) ? [0, 1].map(i => i <= s.svStep ? 'on' : '') : '',
      svBtn: s.survey && s.survey.rf ? (s.svStep === 0 && NOCON.indexOf(s.svr) < 0 ? 'Keyingi · anketa' : 'Saqlash va oʻtkazish') : isResched ? 'Davom etish' : flowAfter ? (s.survey.to === 'trial' ? 'Dars jadvalini ochish' : 'Oʻquvchiga aylantirishni boshlash') : s.survey && s.survey.steps > 1 && s.svStep === 0 ? 'Keyingi' : flowAfter ? (s.survey.to === 'trial' ? 'Dars jadvalini ochish' : 'Oʻquvchiga aylantirishni boshlash') : 'Saqlash va oʻtkazish',
      svRLab: 'Sabab', svRHead: !s.survey || svIsCon ? '' : s.survey.kind === 'reason' ? 'Qoʻngʻiroq qilindi, lekin:' : s.survey.to === 'fail' ? (s.survey.from === 'trial' ? 'Sinov darsidan keyin' : ['dec', 'defer', 'pay', 'paid'].indexOf(s.survey.from) >= 0 ? 'Qaror jarayonida va Toʻlov jarayonida bosqichida' : 'Bogʻlanildi bosqichida') : '',
      flowOpen: !!s.flow, flowTitle: s.flow ? (s.flow.resched ? 'Qayta sinov darsi' : s.flow.to === 'trial' ? 'Sinov darsini qoʻyish' : 'Oʻquvchiga aylantirish · ' + (cardOf(s.flow.key).n || '')) : '',
      flowSub: s.flow ? (cardOf(s.flow.key).n || '') + (s.flow.resched ? ' · qayta qoʻyish' : ' · ' + NAME[s.flow.from] + ' → ' + NAME[s.flow.to]) : '',
      flowNote: s.flow && s.flow.resched ? 'Saqlangach avvalgi sinov tarixga oʻtadi. “← Lidlar” bosilsa hech narsa oʻzgarmaydi.' : 'Lid faqat shu oqim saqlangandan keyin koʻchadi. “← Lidlar” bosilsa lid joyida qoladi.',
      flowBody: s.flow ? (s.flow.resched ? 'Dars jadvali v3 — qayta qoʻyish rejimi (G2 → G1), oʻzgarmaydi' : s.flow.to === 'trial' ? 'Dars jadvali v3 — hozirgi koʻrinishda, oʻzgarmaydi (G1–G1d)' : 'Tarif va jadval → Toʻlov → Telegram guruh → Oʻquvchi maʼlumotlari' + (s.flow.to === 'paid' ? ' → Toʻlov yopildi' : '') + ' (I1–I5)') : '',
      flowDoneT: s.flow ? (s.flow.to === 'trial' ? 'Sinovni qoʻyish (demo)' : 'Oqimni yakunlash (demo)') : '',
      flowCancel: () => { const k = s.flow && s.flow.key; this.setState({ flow: null, origin: '' }); if (k) this.focusSoon(s.drw && s.origin ? s.origin : back(k)); },
      flowDone: () => { const fl = s.flow; if (!fl) return; if (s.demo === 'err') { this.setState({ flow: null }); errToast('Saqlanmadi — lid joyida qoldi', { move: [fl.key, fl.to] }); return; } if (fl.resched) { this.setState({ flow: null, saving: fl.key, toast: { text: (cardOf(fl.key).n || 'Lid') + ' — sinov qayta qoʻyildi', sub: 'Avvalgisi tarixga oʻtdi · holati: Tasdiq kutilmoqda', kind: 'ok' } }); setTimeout(() => this.setState({ saving: '' }), 800); this.armToast(); this.focusSoon(back(fl.key)); return; } const m = Object.assign({}, s.moved); m[fl.key] = fl.to; this.setState({ flow: null, moved: m, saving: fl.key, toast: { text: (cardOf(fl.key).n || 'Lid') + ' → ' + NAME[fl.to], sub: fl.to === 'trial' ? 'Sinov bron qilindi · holati: Tasdiq kutilmoqda' : 'Oʻquvchiga aylantirildi', kind: 'ok' } }); setTimeout(() => this.setState({ saving: '' }), 800); this.armToast(); this.focusSoon(back(fl.key)); },
      _retryMove: (k, to) => requestMove(k, to),
      nav, cols, viaBadge: vb, unN, total: ql ? cols.reduce((a, c) => a + c.cards.length, 0) : ALLCOLS.reduce((a, c) => a + c[3] + delta[c[0]], 0) + ' jami', totalLab: ql ? 'Topildi' : OPEN_ST.reduce((a, id) => a + ALLCOLS.find(c => c[0] === id)[3] + delta[id], 0) + ' ochiq ·', noCols: COLS.length === 0,
      allDone: vb && unN === 0,
      qHidden: ql ? Math.max(0, ALLCOLS.reduce((a, c) => a + BOARD[c[0]].filter(x => (x.k.n + ' ' + x.k.phones.join(' ') + ' ' + (x.k.serial || '')).toLowerCase().indexOf(ql) >= 0).length, 0) - cols.reduce((a, c) => a + c.cards.length, 0)) : 0,
      resetKeepQ: () => this.setState({ viaBadge: false, mgrF: 0, srcF: 0, colsOn: null, rf: {}, trialF: 'all', risk: '' }),
      svOpen: !!s.survey,
      svFromTo: s.survey ? isResched ? (cardOf(s.survey.key).n || '') + ' · qayta qoʻyish' : (s.survey.rf && s.svStep === 1 ? 'Sabab: ' + ((FAIL_BOG.find(r => r[0] === s.svr) || [0, ''])[1]) + ' · ' : '') + (s.survey.steps > 1 && !(s.survey.rf && s.svStep === 0 && NOCON.indexOf(s.svr) >= 0) ? (s.svStep + 1) + '/2 · ' : '') + NAME[s.survey.from] + ' → ' + NAME[s.survey.to] : '',
      svTitle: s.survey ? (isResched ? 'Avvalgi sinov darsi bilan nima yuz berdi?' + ' ' : svIsCon ? 'Bogʻlanildi anketasi' : s.survey.kind === 'reason' ? 'Lid bilan nima uchun bogʻlana olmadingiz?' : s.survey.kind === 'dates' ? 'Keyin sotib olmoqchi' : s.survey.to === 'trial' ? 'Sinov darsini qoʻyish' : s.survey.to === 'dec' ? 'Mijoz nega oʻylab koʻryapti?' : s.survey.to === 'fail' ? 'Muvaffaqiyatsiz sotuv sababi' : s.survey.to === 'junk' ? 'Sifatsiz lid' : NAME[s.survey.to] + ' — soʻrovnoma') + ' · ' + (cardOf(s.survey.key).n || '') : '',
      svHint: s.survey ? (s.survey.rf && s.svStep === 0 ? 'Lid bilan umuman gaplashilmagan boʻlsa (javob bermadi, koʻtarmadi, notoʻgʻri raqam) Bogʻlanildi anketasi soʻralmaydi. Boshqa sabablarda keyingi qadamda anketa toʻldiriladi.' : isResched ? 'Avvalgi sinov tarixga oʻtadi; lid “Sinov darsida” qoladi. Sabab tanlangach Dars jadvali qayta qoʻyish rejimida ochiladi.' : s.survey.steps > 1 && s.svStep === 0 ? 'Lid “Bogʻlanildi” bosqichini oʻtkazib yubormoqda — avval anketa toʻldiriladi. Barcha * maydonlar majburiy.' : svIsCon ? 'Barcha * maydonlar majburiy. Bekor qilinsa lid joyida qoladi.' : s.survey.kind === 'reason' ? 'Sabab tanlanmasa lid koʻchmaydi.' : s.survey.kind === 'dates' ? 'Nega kechiktirdi va qachon? Sanalar kartada koʻrinadi, eslatma keladi.' : s.survey.to === 'trial' ? 'Keyingi qadam — Dars jadvali (v3). Lid sinov bron qilingandan keyingina “Sinov darsida”ga oʻtadi.' : (s.survey.to === 'pay' || s.survey.to === 'paid') ? 'Keyingi qadam — “Oʻquvchiga aylantirish”. Lid oqim yakunlangandan keyingina koʻchadi.' : 'Bekor qilinsa lid joyida qoladi.') : '',
      svReasons: (() => { const sv = s.survey; if (!sv || svIsCon) return ''; const L2 = sv.kind === 'resched' ? [['teacher-late', 'Ustoz vaqtida oʻtmadi'], ['student-missed', 'Oʻquvchi vaqtida qatnashmadi'], ['student-rescheduled', 'Oʻquvchi boshqa vaqtga koʻchirdi'], ['teacher-rescheduled', 'Ustoz boshqa vaqtga koʻchirdi'], ['attended-wants-other-teacher', 'Qatnashdi, boshqa ustozni ham koʻrmoqchi']] : sv.kind === 'reason' ? RF : sv.kind === 'dates' ? [['money', 'Puli hozir yoʻqligi sababli'], ['travel', 'Safarda ekanligi sababli'], ['busy', 'Ayni vaqtda ishi koʻpligi sababli'], ['edu', 'Boshqa taʼlim bilan bandligi sababli'], ['other', 'Boshqa']] : sv.to === 'dec' ? [['price', 'Narxni solishtiryapti'], ['parents', 'Ota-ona bilan maslahat'], ['time', 'Vaqti mos emas'], ['sched', 'Ish jadvali noaniq'], ['other', 'Boshqa']] : sv.to === 'fail' ? (sv.from === 'trial' ? FAIL_SIN : ['dec', 'defer', 'pay', 'paid'].indexOf(sv.from) >= 0 ? FAIL_QT : FAIL_BOG) : sv.to === 'junk' ? JUNK : null; if (!L2) return ''; return L2.map(r => ({ t: r[1], on: s.svr === r[0], pick: () => this.setState({ svr: r[0] }) })); })(),
      svFields: s.survey && !svIsCon ? (s.survey.kind === 'dates' ? [{ t: 'Qachon sotib olmoqchi? *', type: 'date', v: dP, ph: '', on: e => this.setState({ svf: Object.assign({}, svf, { dp: e && e.target ? e.target.value : '' }) }) }, { t: 'Qachon xabarlashishga kelishib olindi? *', type: 'date', v: dC, ph: '', on: e => this.setState({ svf: Object.assign({}, svf, { dc: e && e.target ? e.target.value : '' }) }) }] : s.survey.to === 'trial' ? [] : s.survey.to === 'dec' ? [] : []) : '',
      svDis: s.svSaving ? 'true' : 'false',
      svAgeErr: conFirst === 'age' ? (svf.age ? 'Yosh 7 dan 70 gacha boʻlishi kerak' : 'Yoshni kiriting') : '', svAgeInv: conFirst === 'age' ? 'true' : 'false', svAgeCls: 'fld' + (conFirst === 'age' ? ' ferr' : ''),
      svConErr: '',
      svOther: !!svDefOther, svOtherV: svf.other || '', svOtherIn: e => this.setState({ svf: Object.assign({}, svf, { other: e && e.target ? e.target.value : '' }) }),
      svDateErr: dateErr,
      svRErr: !!(s.svTried && svNeedR && !s.svr), svRErrT: !s.survey ? '' : s.survey.kind === 'dates' ? 'Kursni sotib olishni nega kechiktirganini tanlang' : (s.survey.kind === 'reason' || s.survey.kind === 'resched') ? 'Bitta variant tanlang' : (s.survey.to === 'fail' || s.survey.to === 'junk') ? 'Bitta sabab tanlang' : 'Sababni tanlang', svRInv: s.svTried && svNeedR && !s.svr ? 'true' : 'false',
      svOtherErr: !!(s.svTried && svDefOther && !(svf.other || '').trim()), svOtherInv: s.svTried && svDefOther && !(svf.other || '').trim() ? 'true' : 'false', svOtherCls: 'fld' + (s.svTried && svDefOther && !(svf.other || '').trim() ? ' ferr' : ''),
      svOwn: [['self', 'Oʻzi qoldirgan'], ['parent', 'Ota-onasi qoldirgan']].map(o => ({ t: o[1], on: svf.own === o[0], pick: () => this.setState({ svf: Object.assign({}, svf, { own: o[0] }) }) })),
      svRes: [['uz', 'Oʻzbekiston'], ['foreign', 'Boshqa davlat']].map(o => ({ t: o[1], on: svf.res === o[0], pick: () => this.setState({ svf: Object.assign({}, svf, { res: o[0], reg: '' }) }) })),
      svRegOpts: (svf.res === 'foreign' ? FOR : UZR).map(o => ({ id: o[0], t: o[1], sel: svf.reg === o[0] })), svRegLab: svf.res === 'foreign' ? 'Davlat' : 'Viloyat', svRegPh: svf.res === 'foreign' ? 'Davlatni tanlang…' : svf.res ? 'Viloyatni tanlang…' : 'Avval yuqorida tanlang',
      svReg: e => this.setState({ svf: Object.assign({}, svf, { reg: e && e.target ? e.target.value : '' }) }), svRegV: svf.reg || '',
      svGoalOpts: GOALS.map(o => ({ id: o[0], t: o[1], sel: svf.goal === o[0] })),
      svInfo: INFO.map(i => { const v = (svf.info || {})[i[0]] || ''; const set = val => () => { const inf = Object.assign({}, svf.info || {}); inf[i[0]] = val; this.setState({ svf: Object.assign({}, svf, { info: inf }) }); }; return { t: i[1], full: i[2], nm: 'info_' + i[0], yes: v === 'yes', no: v === 'no', bad: conFirst === 'info' && v !== 'yes', rowSt: 'display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:10px;border:1px solid ' + (conFirst === 'info' && v !== 'yes' ? '#FDA29B;background:#FEF3F2' : '#E2E8F0;background:#FFFFFF'), pickY: set('yes'), pickN: set('no') }; }),
      erLvl: conFirst === 'lvl', ivLvl: conFirst === 'lvl' ? 'true' : 'false', clsLvl: 'seg2 lvl4' + (conFirst === 'lvl' ? ' bad' : ''),
      erSex: conFirst === 'sex', ivSex: conFirst === 'sex' ? 'true' : 'false', clsSex: 'seg2' + (conFirst === 'sex' ? ' bad' : ''),
      erOwn: conFirst === 'own', ivOwn: conFirst === 'own' ? 'true' : 'false', clsOwn: 'seg2' + (conFirst === 'own' ? ' bad' : ''),
      erReg: conFirst === 'reg' ? (svf.res ? (svf.res === 'foreign' ? 'Davlatni tanlang' : 'Viloyatni tanlang') : 'Hududni tanlang') : '', ivReg: conFirst === 'reg' ? 'true' : 'false', clsReg: 'fld' + (conFirst === 'reg' && svf.res ? ' ferr' : ''),
      erGoal: conFirst === 'goal', ivGoal: conFirst === 'goal' ? 'true' : 'false', clsGoal: 'fld' + (conFirst === 'goal' ? ' ferr' : ''),
      erInfo: conFirst === 'info', erInfoT: (() => { const q = INFO.find(i => !(svf.info || {})[i[0]]); return q ? '«' + q[2] + '» savoliga javob bering' : 'Barcha bandlar uchun «Ha» javobi kerak. Bogʻlanildi ustuniga koʻchirish mumkin emas.'; })(), ivInfo: conFirst === 'info' ? 'true' : 'false', clsInfo: 'seg2' + (conFirst === 'info' ? ' bad' : ''),
      svCon: svIsCon, svBack: !!(s.survey && s.survey.steps > 1 && s.svStep === 1), svBackGo: () => this.setState({ svStep: 0 }),
      svLvl: LVLS.map(o => ({ t: o[1], on: svf.lvl === o[0], pick: () => this.setState({ svf: Object.assign({}, svf, { lvl: o[0] }) }) })),
      svSex: [['female', 'Ayol'], ['male', 'Erkak']].map(o => ({ t: o[1], on: svf.sex === o[0], pick: () => this.setState({ svf: Object.assign({}, svf, { sex: o[0] }) }) })),
      svAge: e => this.setState({ svf: Object.assign({}, svf, { age: e && e.target ? e.target.value : '' }) }), svAgeV: svf.age || '',
      svGoal: e => this.setState({ svf: Object.assign({}, svf, { goal: e && e.target ? e.target.value : '' }) }), svGoalV: svf.goal || '',
      svSaveSt: 'height:40px;padding:0 18px;border-radius:12px;border:0;font-size:14px;font-weight:800;cursor:pointer;' + 'background:#0065D6;color:#FFFFFF',
      svCancel: () => { const k = s.survey && s.survey.key; this.setState({ survey: null, svTried: false, svErr: false, origin: '' }); if (k) this.focusSoon(s.drw && s.origin ? s.origin : back(k)); },
      svSave: () => { const sv = s.survey; if (!sv) return; let comsNow = s.coms || {}; const lab = (arr, id) => (arr.find(o => o[0] === id) || [])[1] || ''; const addC = (key, arr) => { const c = Object.assign({}, comsNow); c[key] = arr.concat(c[key] || []); comsNow = c; this.setState({ coms: c }); }; const H = t => 'Hozir · Kamola S.' + (t ? ' · ' + t : ''); if (svBlocked) { this.setState({ svTried: true }); const first = svIsCon ? (!svf.lvl ? '#f_lvl input' : !svf.own ? '#f_own input' : !ageOk ? '#f_age' : !svf.sex ? '#f_sex input' : !(svf.res && svf.reg) ? '#f_reg input, #f_reg select' : !svf.goal ? '#f_goal' : '#f_info input') : '[data-modal] [aria-invalid=true] input, [data-modal] input'; this.focusSoon(first); return; } if (svIsCon && !(sv.rf && s.svStep === 0)) { const svP = Object.assign({}, s.svPrev || {}); svP[sv.key] = svf; this.setState({ svPrev: svP }); addC(sv.key, [{ h: H('Maʼlumot'), t: 'Maʼlumot berildi — tekshiruv:\n' + INFO.map(i => '• ' + i[2] + ' Ha').join('\n') }, { h: H('Anketa'), t: 'Bogʻlanildi — anketa:\n• Til darajasi: ' + ({ zero: '0 dan boshlamoqchi', beginner: 'Boshlangʻich darajada biladi', intermediate: 'Oʻrta darajada biladi', advanced: 'Yuqori darajada biladi' }[svf.lvl] || '') + '\n• Ariza: ' + lab([['self', 'Oʻzi qoldirgan'], ['parent', 'Ota-onasi qoldirgan']], svf.own) + '\n• Yoshi: ' + svf.age + '\n• Jinsi: ' + lab([['female', 'Ayol'], ['male', 'Erkak']], svf.sex) + '\n• Hudud: ' + lab(UZR.concat(FOR), svf.reg) + '\n• Maqsad: ' + lab(GOALS, svf.goal) }]); } if (sv.kind === 'dates') { const pd = Object.assign({}, s.svPrevD || {}); pd[sv.key] = { svr: s.svr, svf }; this.setState({ svPrevD: pd }); } if (sv.rf && s.svStep === 0 && NOCON.indexOf(s.svr) < 0) { this.setState({ svStep: 1, svTried: false, svf: Object.assign({ res: 'uz', reg: '' }, seedSv(sv.key) || {}, (s.svPrev || {})[sv.key] || {}) }); this.focusSoon('[data-modal] input'); return; } if (!sv.rf && sv.steps > 1 && s.svStep === 0) { if (s.demo === 'err') { this.setState({ svErr: true }); return; } const mi0 = Object.assign({}, s.movedInfo || {}); mi0[sv.key] = Object.assign({}, mi0[sv.key] || {}, { survey: true }); if (flowAfter) { this.setState({ movedInfo: mi0, svErr: false, survey: null, flow: { key: sv.key, from: sv.from, to: sv.to } }); this.focusSoon('[data-modal] button'); return; } this.setState({ movedInfo: mi0, svErr: false, svStep: 1, svr: '', svTried: false }); this.focusSoon('[data-modal] input'); return; } if (flowAfter) { this.setState({ survey: null, flow: { key: sv.key, from: sv.from, to: sv.to, resched: isResched } }); this.focusSoon('[data-modal] button'); return; } if (s.demo === 'err') { this.setState({ svErr: true }); return; } const RL = {}; RF.forEach(r => RL[r[0]] = r[1]); { const DEFR = [['money', 'Puli hozir yoʻqligi sababli'], ['travel', 'Safarda ekanligi sababli'], ['busy', 'Ayni vaqtda ishi koʻpligi sababli'], ['edu', 'Boshqa taʼlim bilan bandligi sababli'], ['other', 'Boshqa']]; const DECR = [['price', 'Narxni solishtiryapti'], ['parents', 'Ota-ona bilan maslahat'], ['time', 'Vaqti mos emas'], ['sched', 'Ish jadvali noaniq'], ['other', 'Boshqa']]; const rl = lab(sv.kind === 'reason' ? RF : sv.to === 'dec' ? DECR : sv.to === 'fail' ? (sv.from === 'trial' ? FAIL_SIN : ['dec', 'defer', 'pay', 'paid'].indexOf(sv.from) >= 0 ? FAIL_QT : FAIL_BOG) : sv.to === 'junk' ? JUNK : [], s.svr); const dd = v => (v || '').split('-').reverse().join('.'); const t = sv.kind === 'dates' ? 'Keyin sotib olmoqchi:\n• Sabab: ' + lab(DEFR, s.svr) + (s.svr === 'other' && svf.other ? ': ' + svf.other.trim() : '') + '\n• Sotib olish sanasi: ' + dd(svf.dp) + '\n• Xabarlashish sanasi: ' + dd(svf.dc) : sv.to === 'try' && sv.kind === 'reason' ? 'Qoʻngʻiroq qilindi, lekin: ' + rl : sv.to === 'dec' && rl ? 'Qaror jarayonida — sabab:\n• ' + rl : sv.to === 'fail' && rl ? 'Muvaffaqiyatsiz sotuv: ' + rl : sv.to === 'junk' && rl ? 'Sifatsiz lid: ' + rl : ''; if (t) addC(sv.key, [{ h: H(sv.to === 'try' && sv.kind === 'reason' ? 'Bogʻlanish sababi' : sv.to === 'dec' ? 'Qaror' : ''), t }]); } const m = Object.assign({}, s.moved); m[sv.key] = sv.to; const mi = Object.assign({}, s.movedInfo || {}); mi[sv.key] = Object.assign({}, mi[sv.key] || {}, { dp: svf.dp, dc: svf.dc, reason2: true, reason: sv.to === 'try' ? (RL[s.svr] || '') : '', rk: sv.to === 'try' && sv.kind === 'reason' ? s.svr : '', survey: !!((mi[sv.key] || {}).survey) || sv.to === 'con' || (sv.steps > 1 && !(sv.rf && NOCON.indexOf(s.svr) >= 0)) }); this.setState({ survey: null, svTried: false, svErr: false, moved: m, movedInfo: mi, saving: sv.key, toast: { text: (cardOf(sv.key).n || 'Lid') + ' → ' + NAME[sv.to], sub: sv.to === 'trial' ? 'Dars jadvali ochiladi · holati: Tasdiq kutilmoqda' : (sv.to === 'pay' || sv.to === 'paid') ? 'Oʻquvchiga aylantirish qadamlari ochiladi' : (sv.kind === 'dates' || sv.to === 'con' || (sv.steps > 1 && !(sv.rf && NOCON.indexOf(s.svr) >= 0))) ? 'Soʻrovnoma saqlandi' : 'Sabab saqlandi', kind: 'ok' } }); setTimeout(() => this.setState({ saving: '' }), 800); this.armToast(); this.focusSoon(s.drw ? '#drwStage' : back(sv.key)); },
      modalKey: e => {
        if (!e) return; const box = e.currentTarget;
        const items = Array.prototype.slice.call(box.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.offsetParent !== null && x.getAttribute('tabindex') !== '-1');
        if (!items.length) return;
        const ix = items.indexOf(document.activeElement);
        if (e.key === 'Tab') { e.preventDefault(); const n = e.shiftKey ? (items[ix - 1] || items[items.length - 1]) : (items[ix + 1] || items[0]); n.focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (s.sms || s.survey || s.add || s.split || s.flow) { const k = (s.survey && s.survey.key) || (s.flow && s.flow.key); this.setState({ split: null, survey: null, sms: null, add: false, flow: null }); this.focusSoon(s.drw ? (s.origin || '.drw [role=tab][aria-selected=true]') : k ? '[data-card="' + k + '"]' : '[data-split-btn]'); this.setState({ origin: '' }); return; } this.setState({ drw: null }); if (dk) this.focusSoon('[data-card="' + dk + '"]'); }
      },
      fMan: { t: vb ? 'Biriktirilmagan · barcha vaqt · ochiq bosqichlar' : s.mgrF === 0 ? 'Barcha menejerlar' : s.mgrF === 1 ? 'Biriktirilmagan' : MGR[s.mgrF - 2].sh, cls: 'fbox' + (vb ? ' vb' : s.mgrF ? ' act' : '') },
      fCol: { t: vb ? 'Ochiq bosqichlar' : s.colsOn ? 'Ustunlar: ' + COLS.length + ' ta' : 'Ustunlar', cls: 'fbox' + (vb ? ' vb' : s.colsOn ? ' act' : '') },
      fDate: { t: vb ? 'Barcha vaqt' : s.date, cls: 'fbox' + (vb ? ' vb' : s.date !== 'Joriy oy' ? ' act' : '') },
      fSrc: { t: s.srcF ? ['', 'Faqat Target', 'Faqat Organik'][s.srcF] : 'Manba: hammasi', cls: 'fbox' + (s.srcF ? ' act' : '') },
      anyFilter, resetAll: () => this.setState({ viaBadge: false, picked: {}, allNew: false, excl: {}, q: '', mgrF: 0, srcF: 0, date: 'Joriy oy', colsOn: null, rf: {}, trialF: 'all', risk: '' }),
      sbCls: s.sb ? 'sb' : 'sb sb-min', sbExp: s.sb ? 'true' : 'false', sbLab: s.sb ? 'Menyuni yigʻish' : 'Menyuni ochish', sbIcon: s.sb ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6',
      toggleSb: () => this.setState({ sb: !s.sb }),
      skipToBoard: () => this.focusSoon('[data-card]'),
      q: s.q, setQ: e => { this.setState({ q: e && e.target ? e.target.value : '' }); setTimeout(() => { const c = document.querySelector('[data-card]'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, 40); }, clearQ: () => this.setState({ q: '' }),
      qN: cols.reduce((a, c) => a + c.cards.length, 0),
      isError: s.demo === 'err', retry: () => this.setState({ demo: 'ok' }),
      boardSt: 'flex:1;min-height:0;position:relative;display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;align-items:stretch;padding:12px 24px ' + (pickN ? '84px' : '16px'),
      hiddenRight: hiddenRight ? hiddenRight + ' ustun oʻngda' : '', scrollRight: () => { const el = document.getElementById('leadsPanel'); if (el) el.scrollBy({ left: 520, behavior: 'smooth' }); },
      ddMan: s.dd === 'man', ddManExp: s.dd === 'man' ? 'true' : 'false', openMan: () => { this.setState({ dd: s.dd === 'man' ? '' : 'man', menu: '', mp: '' }); this.focusSoon('[data-pop] [role=menuitemradio]'); },
      ddSrc: s.dd === 'src', ddSrcExp: s.dd === 'src' ? 'true' : 'false', openSrc: () => { this.setState({ dd: s.dd === 'src' ? '' : 'src', menu: '', mp: '' }); this.focusSoon('[data-pop] [role=menuitemradio]'); },
      ddCol: s.dd === 'col', ddColExp: s.dd === 'col' ? 'true' : 'false', openCol: () => { this.setState({ dd: s.dd === 'col' ? '' : 'col', colsDraft: Object.assign({}, colsOn), menu: '', mp: '' }); this.focusSoon('[data-pop] input'); },
      ddDate: s.dd === 'date', ddDateExp: s.dd === 'date' ? 'true' : 'false', openDate: () => { this.setState({ dd: s.dd === 'date' ? '' : 'date', menu: '', mp: '' }); this.focusSoon('[data-pop] [role=radio]'); },
      ddKeys: s.dd === 'keys', ddKeysExp: s.dd === 'keys' ? 'true' : 'false', openKeys: () => this.setState({ dd: s.dd === 'keys' ? '' : 'keys' }),
      keysList: [['/', 'Qidiruvga oʻtish'], ['Tab', 'Kartalar orasida — har karta bitta qadam'], ['↑ ↓', 'Ustun ichida kartadan kartaga'], ['← →', 'Qoʻshni ustunga'], ['Enter', 'Lid kartasini ochish'], ['F2', 'Karta ichidagi tugmalarga kirish'], ['Space', 'Kartani belgilash'], ['Shift + Space / Shift + bosish', 'Oraliqni belgilash'], ['Boʻsh joyni bosish', 'Kartani belgilash'], ['S', 'Amallar menyusi / bosqichga oʻtkazish'], ['Esc', 'Yopish / kartadan chiqish']].map(h => ({ k: h[0], t: h[1] })),
      closeDd: () => this.setState({ dd: '' }),
      manOpts: [['Barcha menejerlar', ''], ['Biriktirilmagan', unN]].concat(MGR.map(m => [m.full, m.load])).map((o, i) => ({ t: o[0], n: o[1], on: (vb ? i === 1 : s.mgrF === i) ? 'true' : 'false', pick: () => this.setState({ mgrF: i, dd: '', viaBadge: false }) })),
      srcOpts: ['Hammasi', 'Faqat Target', 'Faqat Organik'].map((t, i) => ({ t, on: s.srcF === i ? 'true' : 'false', pick: () => this.setState({ srcF: i, dd: '' }) })),
      colOpts: ALLCOLS.map(c => ({ t: c[1], n: c[3], on: !!(s.colsDraft || colsOn)[c[0]], toggle: () => { const d = Object.assign({}, s.colsDraft || colsOn); if (d[c[0]]) delete d[c[0]]; else d[c[0]] = 1; this.setState({ colsDraft: d }); } })),
      applyCols: () => { const d = s.colsDraft || colsOn; const same = Object.keys(d).length === 8 && Object.keys(DEF_ON).every(k => d[k]); this.setState({ colsOn: same ? null : d, dd: '' }); },
      datePre: ['Bugun', 'Kecha', 'Shu hafta', 'Joriy oy', 'Oʻtgan oy', 'Barcha vaqt'].map(t => ({ t, on: t === (vb ? 'Barcha vaqt' : s.date) ? 'true' : 'false', pick: () => this.setState({ date: t }) })),
      dateModes: [['range', 'Sanadan sanagacha'], ['one', 'Bitta sana']].map(m => ({ t: m[1], on: s.dmode === m[0] ? 'true' : 'false', pick: () => this.setState({ dmode: m[0] }), st: 'flex:1;height:30px;border:0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;' + (s.dmode === m[0] ? 'background:#FFFFFF;color:#0B1220;box-shadow:0 1px 2px rgba(16,24,40,.1)' : 'background:transparent;color:#4B5563') })),
      dateRange: s.dmode === 'range', dateL1: s.dmode === 'range' ? 'Dan' : 'Sana',
      popKey: e => { if (!e) return; const box = e.currentTarget; const items = Array.prototype.slice.call(box.querySelectorAll('button,input')); if (!items.length) return; const ix = items.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); (items[ix + 1] || items[0]).focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); (items[ix - 1] || items[items.length - 1]).focus(); } else if (e.key === 'Tab') { e.preventDefault(); const d0 = s.dd; this.setState({ dd: '', rfOpen: false }); this.focusSoon(d0 ? '[data-dd="' + d0 + '"]' : '.col [aria-haspopup=dialog][aria-expanded]'); } },
      dragEnd: () => this.setState({ drag: '', over: '' }),
      clearChip: () => this.setState({ viaBadge: false }),
      rfOpen: s.rfOpen, rfExp: s.rfOpen ? 'true' : 'false', toggleRf: () => { this.setState({ rfOpen: !s.rfOpen }); this.focusSoon('.rp input'); },
      rfLabel: rfSel.length ? rfSel.length + ' ta tanlandi' : 'Barchasi',
      rfShown: (rfSel.length ? rfSel.reduce((a, r) => a + (RFL[r] || 0), 0) : TRYT) + ' / ' + TRYT,
      rfList: [{ t: 'Barchasi', n: TRYT, on: !rfSel.length, toggle: () => this.setState({ rf: {} }) }].concat(RF.map(r => ({ t: r[1], n: RFL[r[0]] || 0, on: !!s.rf[r[0]], toggle: () => { const n = Object.assign({}, s.rf); n[r[0]] = !n[r[0]]; this.setState({ rf: n }); } }))),
      bdSt: 'position:absolute;inset:0;z-index:' + (s.drw && s.mp ? 86 : 35), anyPop, closeAll: () => this.setState({ menu: '', mp: '', dd: '', rfOpen: false, sub: false }),
      menuOpen: !!s.menu, menuLab: 'Amallar: ' + (menuCard.n || ''), menuPos: 'left:' + menuXY.x + 'px;top:' + menuXY.y + 'px',
      subOpen: s.sub, subExp: s.sub ? 'true' : 'false', subSt: s.sub ? 'background:#F1F5F9' : '',
      subPos: 'top:40px;' + (menuXY.x + 236 + 240 > 1440 ? 'right:calc(100% + 4px)' : 'left:calc(100% + 4px)'),
      toggleSub: () => { this.setState({ sub: !s.sub }); if (!s.sub) this.focusSoon('[data-sub] [role=menuitem]'); },
      menuMgr: () => { const k = s.menu; this.setState({ menu: '', mp: k, mpXY: { x: menuXY.x, y: menuXY.y }, mq: '' }); this.focusSoon('[data-menu] input'); },
      stages: ALLCOLS.map(c => { const from = (menuCardKey && colOf(menuCardKey)) || ''; const kd = surveyKind(from, c[0]); return { t: c[1], cls: c[0] === 'fail' || c[0] === 'junk' ? 'dg' : '', cur: c[0] === from ? 'true' : 'false', note: c[0] === from ? 'hozir' : (() => { const base = c[0] === 'con' ? 'anketa' : c[0] === 'trial' ? 'jadval' : (c[0] === 'pay' || c[0] === 'paid') ? 'oʻquvchiga aylantirish' : kd === 'dates' ? 'sanalar' : (kd === 'reason' || ['dec', 'fail', 'junk'].indexOf(c[0]) >= 0) ? 'sabab' : ''; return menuCardKey && needsCon(from, c[0], menuCardKey) ? (c[0] === 'fail' && (from === 'new' || from === 'try') ? 'sabab (+ anketa)' : 'anketa + ' + base) : base; })(), pick: () => { const key = s.menu; if (!key || c[0] === from) return; requestMove(key, c[0]); } }; }),
      menuKey: e => {
        if (!e) return; const box = e.currentTarget; const sub = box.querySelector('[data-sub]');
        const inSub = sub && sub.contains(document.activeElement);
        const scope = inSub ? sub : box;
        const items = Array.prototype.slice.call(scope.querySelectorAll('[role^=menuitem], input, [role=option], button')).filter((x, i, arr) => arr.indexOf(x) === i && x.getAttribute('aria-disabled') !== 'true' && (inSub ? true : !(sub && sub.contains(x))));
        if (!items.length) return;
        const ix = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); (items[ix + 1] || items[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (items[ix - 1] || items[items.length - 1]).focus(); }
        else if (e.key === 'Home') { e.preventDefault(); items[0] && items[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); items[items.length - 1] && items[items.length - 1].focus(); }
        else if (e.key === 'ArrowRight' && !inSub && document.activeElement && document.activeElement.getAttribute('aria-haspopup') === 'menu') { e.preventDefault(); this.setState({ sub: true }); this.focusSoon('[data-sub] [role=menuitem]'); }
        else if (e.key === 'ArrowLeft' && inSub) { e.preventDefault(); this.setState({ sub: false }); this.focusSoon('[data-menu] [aria-haspopup=menu]'); }
        else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); const k = s.menu || s.mp; this.setState({ menu: '', mp: '', sub: false }); if (k) this.focusSoon(back(k)); }
      },
      hasPick: pickN > 0, pickN, allNewChip: allNewEff ? 'Yangi: hammasi ' + newUn + (exclN ? ' · −' + exclN : '') : '', allNewOff: () => this.setState({ allNew: false, excl: {}, picked: Object.assign({}, ...Object.keys(picked).filter(k => k.indexOf('new') !== 0).map(k => ({ [k]: 1 }))) }), conf: s.conf, man: s.man,
      clearPick: () => this.setState({ picked: {}, allNew: false, excl: {}, conf: false }),
      toast: !!toast, toastText: toast ? toast.text : '', toastSub: toast ? toast.sub : '',
      toastCls: 'up' + (s.tp ? ' paused' : ''),
      toastSt: 'position:absolute;right:' + (s.drw ? '544px' : '24px') + ';bottom:' + (pickN ? '92px' : '24px') + ';z-index:95;width:420px;background:#0B1220;color:#FFFFFF;border-radius:16px;box-shadow:0 20px 50px rgba(11,18,32,.35);overflow:hidden',
      toastIc: toast && toast.kind === 'err' ? '!' : '✓', toastIcSt: 'flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:16px;color:#FFFFFF;background:' + (toast && toast.kind === 'err' ? '#D92D20' : '#12B76A'),
      toastBarSt: 'height:3px;background:' + (toast && toast.kind === 'err' ? '#F04438' : '#12B76A'),
      toastActShow: !(toast && toast.kind === 'err' && !toast.retry) && !(toast && !toast.undo && toast.kind !== 'err'),
      toastActT: toast && toast.kind === 'err' ? 'Qayta urinish' : toast && toast.undo ? 'Qaytarish' : 'Yaxshi',
      toastAct: () => { const t = s.toast; clearTimeout(this._t); if (!t) return; if (t.kind === 'err') { this.setState({ toast: null, demo: 'ok' }); if (t.retry && t.retry.move) setTimeout(() => { const r = this.renderVals(); r._retryMove && r._retryMove(t.retry.move[0], t.retry.move[1]); }, 30); if (t.retry && t.retry.bulk) { if (t.retry.split) this.setState({ split: t.retry.split }); setTimeout(() => { const r = this.renderVals(); if (t.retry.bulk === 'assign') r.assign(); else r.doSplit(); }, 30); } return; } if (t.undo) { const u = t.undo; const st = { toast: null }; if (u.extra !== undefined) st.extra = u.extra; if (u.loadAdd !== undefined) st.loadAdd = u.loadAdd; if (u.moved) st.moved = u.moved; if (u.assigned) st.assigned = u.assigned; this.setState(st); return; } this.setState({ toast: null }); },
      toastRole: s.toast && s.toast.kind === 'err' ? 'alert' : 'status', toastLive: s.toast && s.toast.kind === 'err' ? 'assertive' : 'polite',
      pauseToast: () => { clearTimeout(this._t); this.setState({ tp: true }); },
      resumeToast: () => { this.setState({ tp: false }); this.armToast(); },
      closeToast: () => { clearTimeout(this._t); this.setState({ toast: null }); },
      rootKey: e => {
        if (!e) return; const tag = (e.target && e.target.tagName) || '';
        if (e.key === '/' && tag !== 'INPUT' && tag !== 'SELECT') { e.preventDefault(); this.focusSoon('#leadSearch'); }
        else if (e.key === 'Escape') { if (s.menu || s.mp || s.dd || s.rfOpen) { this.setState({ menu: '', mp: '', sub: false, dd: '', rfOpen: false }); return; } if (s.sms || s.survey || s.add || s.split || s.flow) { this.setState({ split: null, sms: null, add: false, survey: null, flow: null }); return; } if (s.drw) { this.setState({ drw: null }); this.focusSoon('[data-card="' + dk + '"]'); } }
      },
      demo: [['ok', 'Oddiy'], ['res', 'Natija oynasi'], ['load', 'Yuklanmoqda'], ['err', 'Xato'], ['empty', 'Boʻsh']].map(d => ({ t: d[1], tip: d[0] === 'res' ? 'Navbatdagi birinchi lid uchun natija oynasi' : d[0] === 'err' ? 'Saqlash xatosi (natija oynasida ham)' : '', on: (d[0] === 'res' ? !!s.cr : s.demo === d[0] && !s.cr) ? 'true' : 'false', pick: () => { if (d[0] === 'res') { this.setState({ demo: 'ok', qSkip: 0 }); setTimeout(() => { const r = this.renderVals(); r.qCall(); }, 20); return; } this.setState({ demo: d[0], cr: null, drw: null, survey: null, sh: null }); } }))
    };
  }
}
