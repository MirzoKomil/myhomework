class Component extends DCLogic {
  constructor(p) {
    super(p);
    this.state = { sb: true, demo: 'ok', retried: false, filter: 'all', sel: '', reqs: this.seed(), chk: {}, dec: '', note: '', chip: '', err: '', busy: false, conflict: {}, toast: '' };
    this._t = null; this._c = {};
  }
  // Demo soat: Du 02.11.2026 01:43. So'rovlar — faqat Rus tili o'quvchilari (server: ROP o'z til yo'nalishi, school.js ~945).
  seed() {
    const S = (name, ini, teacher, dur, price, day, time, asst, tg) => ({ name, ini, teacher, dur, price, day, time, asst, tg });
    return [
      { id: 'r148', number: 148, kind: 'tariff', status: 'pending', mgr: 'Robiya Usmonova', created: 'bugun 00:52', s: S('Madina Rasulova', 'MR', 'Shahnoza Qodirova', 30, 450000, 1, '18:00', '', 'C41 | onlayn rus tili'),
        ch: { lessonDuration: 60, monthlyPrice: 790000 }, reason: 'Ota-onasi 60 daqiqalik tarifni xohlayapti, farqini shu oy toʻlaydi',
        clash: '2026-11-02 (Du) 18:00 — band' },
      { id: 'r147', number: 147, kind: 'teacher', status: 'pending', mgr: 'Kamola Shahobiddinova', created: 'kecha 18:20', s: S('Aziza Karimova', 'AK', 'Nodira Aliyeva', 30, 450000, 2, '17:30', 'Malika Tursunova', 'C38 | onlayn rus tili'),
        ch: { teacherId: 'Dilnoza Karimova', from: '2026-11-09', lessonTime: '19:00' }, reason: 'Oʻquvchi ishdan kech qaytadi, 19:00 dan keyin qulay; Nodira opada bu vaqt band' },
      { id: 'r146', number: 146, kind: 'tariff', status: 'pending', mgr: 'Gulchehra Mamadaliyeva', created: 'kecha 15:05', s: S('Sardor Yoqubov', 'SY', 'Dilnoza Karimova', 30, 450000, 1, '16:00', '', ''),
        ch: { monthlyPrice: 400000, effectiveFrom: '2026-12-01' }, reason: 'Ikki farzandi oʻqiydi — oilaviy chegirma (direktor bilan kelishilgan)' },
      { id: 'r145', number: 145, kind: 'tariff', status: 'approved', mgr: 'Robiya Usmonova', created: '31-oktyabr 11:40', s: S('Jasur Toshmatov', 'JT', 'Shahnoza Qodirova', 15, 300000, 2, '15:00', '', 'C35 | onlayn rus tili'),
        ch: { lessonDuration: 30, monthlyPrice: 450000 }, reason: '15 daqiqa kamlik qilyapti, 30 daqiqaga oʻtmoqchi', by: 'Islom Mominov', role: 'rop', at: 'kecha 12:10', dnote: '' },
      { id: 'r144', number: 144, kind: 'teacher', status: 'rejected', mgr: 'Hamidaxon Boymirzayeva', created: '30-oktyabr 17:05', s: S('Nilufar Abdullayeva', 'NA', 'Dilnoza Karimova', 60, 790000, 1, '19:00', '', 'C29 | onlayn rus tili'),
        ch: { teacherId: 'Shahnoza Qodirova', from: '2026-11-02', lessonTime: '18:00' }, reason: 'Oʻquvchi ayol ustoz bilan qolishni, lekin erta vaqtni soʻradi', by: 'Malika Yusupova', role: 'admin', at: '31-oktyabr 09:30', dnote: 'Ustoz band — boshqa vaqt taklif qiling' },
      { id: 'r143', number: 143, kind: 'tariff', status: 'returned', mgr: 'Kamola Shahobiddinova', created: '29-oktyabr 14:20', s: S('Bekzod Rahimov', 'BR', 'Shahnoza Qodirova', 30, 450000, 2, '20:00', '', ''),
        ch: { lessonDuration: 60 }, reason: 'Imtihonga tayyorlanadi, darsni uzaytirish kerak', by: 'Islom Mominov', role: 'rop', at: '29-oktyabr 16:02', dnote: 'Narxni yozing — 60 daqiqalik tarif narxi koʻrsatilmagan' },
      { id: 'r141', number: 141, kind: 'tariff', status: 'approved', mgr: 'Gulchehra Mamadaliyeva', created: '28-oktyabr 10:15', s: S('Malika Hasanova', 'MH', 'Nodira Aliyeva', 30, 450000, 1, '17:00', '', 'C33 | onlayn rus tili'),
        ch: { lessonTime: '17:30' }, reason: 'Maktabdan kech chiqadi — 30 daqiqa keyinga', by: 'Malika Yusupova', role: 'admin', at: '28-oktyabr 12:44', dnote: 'Ustoz bilan gaplashildi' }
    ];
  }
  focusSoon(sel) { setTimeout(() => { const el = document.querySelector(sel); if (el && el.focus) el.focus(); }, 30); }
  renderVals() {
    const s = this.state;
    const IC = {
      home: 'M3 10.5 12 4l9 6.5V20H3z', leads: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8z',
      cal: 'M3 9.5h18M8 3v3M16 3v3M5 4.5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2z', trial: 'M8.5 12l2.5 2.5 4.5-5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z',
      check: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', clock: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2', lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z', arch: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
      funnel: 'M3 4h18l-7 8v6l-4 2v-8z', rating: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z', plan: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 8a4 4 0 110 8 4 4 0 010-8z', debt: 'M2 6h20v13H2zM2 10h20',
      script: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h5', sms: 'M4 4h16v12H5l-1 4zM8 9h8M8 12h5', stu: 'M2 8l10-5 10 5-10 5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5', tg: 'M21 4L3 11l6 2 2 6 3-4 5 4z'
    };
    const I = (k, label, icon, o) => Object.assign({ item: true, grp: false, k, label, tip: label, icon: IC[icon], cur: 'false', badge: '', aria: '', pick: () => this.setState({ viaBadge: false }), pickBadge: () => {} }, o || {});
    const G = l => ({ grp: true, item: false, label: l });

    const mkNav = (unN, loading) => [
      I('home', 'Bosh sahifa', 'home'), I('leads', 'Lidlar', 'leads', { cur: 'page', badge: loading ? '…' : unN ? String(unN) : '', aria: unN + ' ta menejersiz ochiq lid — faqat ularni koʻrsatish', pickBadge: () => this.setState({ viaBadge: true, picked: {}, allNew: false, excl: {} }) }), I('cal', 'Dars jadvali', 'cal'), I('trial', 'Sinov nazorati', 'trial'),
      G('NAZORAT'), I('check', 'Tasdiqlar', 'check', { badge: '3', aria: '3 ta tasdiq kutilmoqda' }), I('sla', 'SLA', 'clock', { badge: '19', aria: '19 ta SLA harakat kerak', tip: 'SLA — javob muddati nazorati' }), I('lock', 'Qotgan lidlar qoidasi', 'lock', { tip: 'Qotgan lidlar qoidasi (sozlama)' }), I('arch', 'Arxiv', 'arch', { tip: 'Arxiv (tarix)' }),
      G('SOTUV'), I('funnel', 'Voronka', 'funnel', { tip: 'Voronka: statistika va menejerlar samaradorligi' }), I('rating', 'Reyting va bonus', 'rating'), I('plan', 'Sotuv rejasi', 'plan', { tip: 'Sotuv rejasi (koʻrish)' }), I('debt', 'Qarzdorlar', 'debt'), I('script', 'Skript va yoʻriqnoma', 'script'), I('sms', 'SMS yuborish', 'sms'),
      G('OʻQUVCHILAR'), I('stu', 'Oʻquvchilar', 'stu'), I('tg', 'Telegram guruh', 'tg')
    ];
    const MGR = { 'Robiya Usmonova': '#166534', 'Kamola Shahobiddinova': '#5B21B6', 'Gulchehra Mamadaliyeva': '#0E7490', 'Hamidaxon Boymirzayeva': '#C2410C', 'Islom Mominov': '#0B1220', 'Malika Yusupova': '#7A271A' };
    const ini = n => String(n).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    // schoolUI.js helperlari (num, shortName, pattern, sched, fmtDate) — 1:1
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : '—'; };
    const pattern = d => ([1, 3, 5].includes(Number(d)) ? 'Du·Ch·Ju' : [2, 4, 6].includes(Number(d)) ? 'Se·Pa·Sh' : '—');
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
    const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const sched = (day, time, dur) => pattern(day) + (time ? ' ' + time : '') + (dur && toMin(time) != null ? '–' + hm(toMin(time) + Number(dur)) : '');
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'], DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const fmtDate = d => { const [y, m, dd] = d.split('-').map(Number); const w = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); return DAY[(w + 6) % 7] + ', ' + dd + '-' + MON[m - 1]; };
    const KIND = { tariff: 'tarif', teacher: 'ustoz', payment: 'toʻlov' };
    const PILL = { pending: ['ap-pill ap-p-warn', 'Kutilmoqda'], approved: ['ap-pill ap-p-ok', 'Tasdiqlandi'], rejected: ['ap-pill ap-p-bad', 'Rad etildi'], returned: ['ap-pill ap-p-mute', 'Qaytarildi'] };
    const apSummary = r => { const ch = r.ch, st = r.s; if (r.kind === 'teacher') return shortName(st.teacher) + ' → ' + shortName(ch.teacherId); const p = [];
      if ('lessonDuration' in ch && +ch.lessonDuration !== +st.dur) p.push((st.dur || '—') + ' → ' + ch.lessonDuration + ' daq');
      if ('monthlyPrice' in ch) p.push((st.price ? num(st.price) : '—') + ' → ' + num(ch.monthlyPrice));
      if ('lessonTime' in ch && ch.lessonTime !== st.time) p.push((st.time || '—') + ' → ' + ch.lessonTime); return p.join(' · ') || 'tarif'; };
    const rowsOf = r => { const ch = r.ch, st = r.s;
      const curT = st.dur + ' daq' + (st.price ? ' · ' + num(st.price) + ' soʻm/oy' : '');
      const nd = 'lessonDuration' in ch ? ch.lessonDuration : st.dur, np = 'monthlyPrice' in ch ? ch.monthlyPrice : st.price;
      const newT = nd + ' daq' + (np ? ' · ' + num(np) + ' soʻm/oy' : '');
      const from = r.kind === 'teacher' ? ch.from : ch.effectiveFrom;
      return [['Tarif', curT, newT], ['Dars vaqti', sched(st.day, st.time, st.dur), sched(ch.lessonDay != null ? ch.lessonDay : st.day, ch.lessonTime || st.time, nd)], ['Ustoz', st.teacher, r.kind === 'teacher' ? ch.teacherId : st.teacher], ['Qachondan', '—', from ? fmtDate(from) : 'tasdiqlangan kundan']]; };
    const IMP = { cal: 'M3 9.5h18M8 3v3M16 3v3M5 4.5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2z', fin: 'M2 6h20v13H2zM2 10h20', pay: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', app: 'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2', asst: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2', tg: 'M21 4L3 11l6 2 2 6 3-4 5 4z', log: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z' };
    const impactOf = r => { const ch = r.ch, st = r.s, out = []; const tN = shortName(r.kind === 'teacher' ? ch.teacherId : st.teacher);
      const fr = r.kind === 'teacher' ? ch.from : ch.effectiveFrom; const from = fr ? fmtDate(fr) : 'tasdiqlangan kundan'; const nd = 'lessonDuration' in ch ? ch.lessonDuration : st.dur;
      const sc = r.kind === 'teacher' || 'lessonTime' in ch || 'lessonDay' in ch || ('lessonDuration' in ch && +ch.lessonDuration !== +st.dur);
      if (sc) out.push(['cal', tN + ' jadvali: ' + sched(ch.lessonDay != null ? ch.lessonDay : st.day, ch.lessonTime || st.time, nd) + ' band · sinov uchun yopiladi · ' + from]);
      if ('monthlyPrice' in ch) out.push(['fin', 'Moliya: yangi narx ' + num(ch.monthlyPrice) + ' soʻm/oy · qarz shu narxdan hisoblanadi']);
      if (r.kind === 'teacher') out.push(['pay', 'Maosh: ' + from + ' darslari ' + tN + 'ga, oldingilari ' + shortName(st.teacher) + 'ga']);
      else if ('lessonDuration' in ch) out.push(['pay', tN + ' maoshi: ' + from + ' darslar ' + nd + ' daqiqalik stavka boʻyicha']);
      if ('lessonDuration' in ch) out.push(['app', 'Ilova: dars davomiyligi ' + nd + ' daq · darslik progressi oʻzgarmaydi']);
      if (st.asst) out.push(['asst', 'Yordamchi ' + shortName(st.asst) + ': oʻzgarish yoʻq · oyiga 13 aloqa']);
      if (r.kind === 'teacher') out.push(['tg', 'Telegram guruh: yangi ustozni guruhga qoʻshish kerak']);
      out.push(['log', 'Tarixga: soʻrov, qaror, kim va qachon · ' + shortName(r.mgr) + 'ga xabar']);
      return out.map(x => ({ ic: IMP[x[0]], t: x[1] })); };
    // studentOps.checkRequest — bandlik (checkWeekly) + tarif + to'lovga ta'sir; ok=false bo'lsa tasdiqlash xato beradi
    const checksOf = r => { const ch = r.ch, st = r.s, out = []; let slot = null;
      if (r.kind === 'teacher' && ch.teacherId) slot = { t: ch.teacherId, day: ch.lessonDay != null ? ch.lessonDay : st.day, time: ch.lessonTime || st.time, dur: st.dur };
      else if (r.kind === 'tariff' && ('lessonDay' in ch || 'lessonTime' in ch || 'lessonDuration' in ch)) slot = { t: st.teacher, day: ch.lessonDay != null ? ch.lessonDay : st.day, time: ch.lessonTime || st.time, dur: 'lessonDuration' in ch ? ch.lessonDuration : st.dur };
      if (slot) { const label = slot.t + ' · ' + pattern(slot.day) + ' ' + slot.time + '–' + hm(toMin(slot.time) + +slot.dur); out.push(r.clash ? { level: 'bad', text: label + ': ' + r.clash } : { level: 'ok', text: label + ' boʻsh (4 hafta) · tekshirildi 01:43' }); }
      if ('lessonDuration' in ch || 'tariff' in ch || 'monthlyPrice' in ch) { const dur = 'lessonDuration' in ch ? +ch.lessonDuration : st.dur, price = 'monthlyPrice' in ch ? +ch.monthlyPrice : st.price, okDur = [15, 30, 60].includes(dur);
        out.push({ level: okDur && price > 0 ? 'ok' : 'warn', text: okDur ? 'Tarif: ' + dur + ' daq' + (price ? ' · ' + num(price) + ' soʻm/oy' : ' · narx kiritilmagan') : 'Davomiylik ' + dur + ' daq — standart tariflar 15 / 30 / 60 daq' });
        if ('monthlyPrice' in ch && +ch.monthlyPrice !== +st.price) { const from = ch.effectiveFrom || '2026-11-02'; out.push({ level: 'warn', text: from > '2026-11-02' ? 'Joriy oy toʻlovi oʻzgarmaydi — yangi narx ' + from + ' dan keyingi hisobga' : 'Joriy oy toʻlovi avtomatik qayta hisoblanmaydi — farqni Moliyada tekshiring' }); } }
      if (!out.length) out.push({ level: 'ok', text: 'Tekshiradigan jadval yoki tarif oʻzgarishi yoʻq' });
      return out; };
    const reqs = s.demo === 'empty' ? s.reqs.filter(r => r.status !== 'pending') : s.reqs;
    const counts = { all: reqs.length, pending: 0, approved: 0, rejected: 0, returned: 0 }; reqs.forEach(r => { counts[r.status]++; });
    const nav = mkNav(79, false).map(n => Object.assign({}, n, { cur: n.k === 'check' ? 'page' : 'false', pickBadge: () => {}, pick: () => { if (n.k === 'check' || !n.item) return; this.setState({ toast: n.label + ' sahifasi ochiladi' }); } }, n.k === 'check' ? { badge: counts.pending ? String(counts.pending) : '', aria: counts.pending + ' ta tasdiq kutilmoqda' } : {}));
    const toast = (t, ms) => { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), ms || 3000); };
    const loading = s.demo === 'load', loadErr = s.demo === 'err' && !s.retried, ready = !loading && !loadErr;
    const list = reqs.filter(r => s.filter === 'all' || r.status === s.filter);
    const selId = list.some(r => r.id === s.sel) ? s.sel : ((list.find(r => r.status === 'pending') || list[0] || {}).id || '');
    const r = list.find(x => x.id === selId) || null;
    // Server tekshiruvi: tanlanganda yuklanadi (GET /edit-requests/:id/check)
    const chkState = r && r.status === 'pending' ? (s.chk[r.id] || 'loading') : '';
    if (ready && r && r.status === 'pending' && !s.chk[r.id] && !this._c[r.id]) { this._c[r.id] = setTimeout(() => { this._c[r.id] = null; const c = Object.assign({}, this.state.chk); c[r.id] = this.state.demo === 'chkErr' && !this.state.chkRetried ? 'err' : 'ok'; this.setState({ chk: c }); }, 650); }
    const pick = id => { if (id === selId) return; this.setState({ sel: id, dec: '', note: '', chip: '', err: '' }); };
    const ord = list.map(x => x.id);
    const checks = r && r.status === 'pending' ? checksOf(r) : [];
    const blocked = !!(r && chkState === 'ok' && checks.some(c => c.level === 'bad'));
    const dec = blocked && s.dec === 'approve' ? '' : s.dec;
    const RS = r ? (r.kind === 'payment' ? ['Chek oʻqilmaydi', 'Summa mos emas', 'Boshqa oʻquvchiniki', 'Boshqa'] : r.kind === 'teacher' ? ['Vaqt mos emas', 'Ustoz band', 'Sabab yetarli emas', 'Boshqa'] : ['Narx notoʻgʻri', 'Vaqt mos emas', 'Sabab yetarli emas', 'Boshqa']) : [];
    const who = r ? shortName(r.mgr) : '';
    const hintOf = () => (dec === 'approve' ? 'Tasdiqlash · ' + who + 'ga xabar boradi' : dec === 'reject' ? 'Rad etish · soʻrov yopiladi, hech narsa oʻzgarmaydi' : dec === 'return' ? 'Qaytarish · ' + who + ' tuzatib qayta yuboradi' : 'Avval qarorni tanlang') + ' · Admin ham koʻryapti — kim birinchi qaror qilsa, ikkinchisida yopiladi';
    const decide = () => {
      if (s.busy || !r) return;
      if (!dec) { this.setState({ err: 'Avval qarorni tanlang' }); return; }
      if (dec !== 'approve' && s.note.trim().length < 3) { this.setState({ err: 'Sababni yozing — kamida 3 belgi (menejerga boradi)' }); this.focusSoon('#apNote'); toast('Sababni yozing'); return; }
      if (dec === 'approve' && blocked) { this.setState({ err: 'Boʻsh vaqt yoʻq — avval vaqtni oʻzgartiring' }); return; }
      clearTimeout(this._t); this.setState({ busy: true, err: '', toast: '' });
      setTimeout(() => {
        const st = this.state, id = r.id;
        if (st.demo === 'c409') {
          // decideRequest: status='pending' emas → 409 "So'rov allaqachon hal qilingan: <ism>"; ilova ro'yxatni qayta yuklaydi (ropApp.js decide)
          const reqs2 = st.reqs.map(x => x.id === id ? Object.assign({}, x, { status: 'approved', by: 'Malika Yusupova', role: 'admin', at: 'bugun 01:42', dnote: '' }) : x);
          const cf = Object.assign({}, st.conflict); cf[id] = 'Soʻrov allaqachon hal qilingan: Malika Yusupova (admin) · bugun 01:42 · tasdiqladi.';
          this.setState({ busy: false, reqs: reqs2, conflict: cf, sel: id, filter: st.filter === 'pending' ? 'all' : st.filter, dec: '', note: '', chip: '' });
          toast('Bu soʻrovni allaqachon boshqasi hal qildi', 4000); return;
        }
        const status = dec === 'approve' ? 'approved' : dec === 'reject' ? 'rejected' : 'returned';
        const reqs2 = st.reqs.map(x => x.id === id ? Object.assign({}, x, { status, by: 'Islom Mominov', role: 'rop', at: 'bugun 01:43', dnote: st.note.trim() }) : x);
        this.setState({ busy: false, reqs: reqs2, sel: '', dec: '', note: '', chip: '' });
        toast('Qaror saqlandi');
      }, 800);
    };
    let d = null;
    if (r) {
      const pending = r.status === 'pending';
      const rows = rowsOf(r).map(w => { const same = String(w[1]) === String(w[2]); return { l: w[0], a: w[1], b: w[2], ar: same ? '=' : '→', arL: same ? 'oʻzgarmaydi' : 'oʻzgaradi', cls: 'ap-dr' + (same ? ' ap-same' : ''), bc: same ? '' : 'ap-new' }; });
      const req = pending && dec && dec !== 'approve';
      d = { title: r.s.name + ' · ' + (r.kind === 'teacher' ? 'ustozni almashtirish' : r.kind === 'payment' ? 'toʻlov tuzatish' : 'tarif oʻzgarishi'), sub: 'yuborildi ' + r.created + ' · №' + r.number,
        pc: PILL[r.status][0], pl: PILL[r.status][1], conflict: s.conflict[r.id] || '',
        mName: r.mgr, mIni: ini(r.mgr), mAv: 'background:' + (MGR[r.mgr] || '#334155'), sName: r.s.name, sIni: r.s.ini, tg: r.s.tg, noTg: !r.s.tg,
        colA: pending ? 'Hozir' : 'Oldin', rows, reason: r.reason, pending, decided: !pending,
        chkLoading: chkState === 'loading', chkErr: chkState === 'err', chkOk: chkState === 'ok', blocked,
        checks: checks.map(c => ({ cls: 'ap-' + c.level, ic: { ok: '✓', warn: '!', bad: '✕' }[c.level], lv: { ok: 'Joyida', warn: 'Diqqat', bad: 'Toʻsiq' }[c.level], t: c.text })),
        impact: pending ? impactOf(r) : [],
        decs: [['approve', 'Tasdiqlash', blocked ? 'boʻsh vaqt yoʻq — avval vaqtni oʻzgartiring' : 'server boʻsh vaqtni qayta tekshiradi', 'ap-ok2'], ['reject', 'Rad etish', 'sabab majburiy · menejerga boradi', 'ap-no'], ['return', 'Qaytarish', 'menejer tuzatib qayta yuboradi', '']].map(o => ({ k: o[0], t: o[1], s: o[2], hid: 'aph_' + o[0], on: dec === o[0], dis: o[0] === 'approve' && blocked, cls: 'ap-dc' + (dec === o[0] ? ' ap-on ' + o[3] : '') + (o[0] === 'approve' && blocked ? ' ap-dis' : ''), pick: () => this.setState({ dec: o[0], err: '', chip: o[0] === 'approve' ? '' : s.chip }) })),
        showChips: req, chips: RS.map(t => ({ t, on: s.chip === t ? 'true' : 'false', pick: () => { if (t === 'Boshqa') { this.setState({ chip: t, note: '', err: '' }); this.focusSoon('#apNote'); return; } this.setState({ chip: t, note: t, err: '' }); } })),
        note: s.note, ph: dec && dec !== 'approve' ? 'Sabab (majburiy) — menejerga boradi' : 'Izoh (ixtiyoriy) — menejer va tarixda koʻrinadi', noteLab: dec && dec !== 'approve' ? 'Sabab (majburiy)' : 'Izoh (ixtiyoriy)',
        req: req ? 'true' : 'false', inv: s.err && req ? 'true' : 'false', taCls: 'ap-ta' + (s.err && req ? ' ap-terr' : ''), err: s.err,
        hint: hintOf(), saveDis: !dec || s.busy ? 'true' : 'false', saveLab: s.busy ? 'Saqlanmoqda...' : 'Qarorni saqlash',
        dBy: r.by ? r.by + (r.role === 'rop' ? ' (ROP' + (r.by === 'Islom Mominov' ? ', siz' : '') + ')' : ' (admin)') : '', dAt: r.at || '', dNote: r.dnote ? '“' + r.dnote + '”' : 'Izohsiz', dIni: r.by ? ini(r.by) : '', dAv: 'background:' + (MGR[r.by] || '#334155') };
    }
    const TABS = [['all', 'Hammasi'], ['pending', 'Kutilmoqda'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['returned', 'Qaytarilgan']].filter(t => t[0] !== 'returned' || counts.returned);
    return {
      nav, sbCls: s.sb ? 'sb' : 'sb sb-min', sbExp: s.sb ? 'true' : 'false', sbLab: s.sb ? 'Menyuni yigʻish' : 'Menyuni ochish', sbIcon: s.sb ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6', toggleSb: () => this.setState({ sb: !s.sb }),
      demo: [['ok', 'Oddiy', ''], ['load', 'Yuklanmoqda', ''], ['err', 'Xato', 'Roʻyxatni yuklab boʻlmadi'], ['chkErr', 'Tekshiruv xatosi', 'GET /edit-requests/:id/check xato'], ['c409', '409 · Admin oldin', 'Saqlashda admin allaqachon hal qilgan'], ['empty', 'Boʻsh', 'Kutilayotgan soʻrov yoʻq']].map(x => ({ t: x[1], tip: x[2] || x[1], on: s.demo === x[0] ? 'true' : 'false', pick: () => { Object.keys(this._c).forEach(k => clearTimeout(this._c[k])); this._c = {}; this.setState({ demo: x[0], retried: false, chkRetried: false, err: '', chk: {}, busy: false, conflict: {}, reqs: this.seed(), sel: '', dec: '', note: '', chip: '', filter: x[0] === 'empty' ? 'pending' : 'all' }); } })),
      loading, loadErr, ready, retry: () => this.setState({ retried: true }),
      tabs: TABS.map(t => ({ l: t[1], n: (t[0] === 'all' || t[0] === 'pending') && counts[t[0]] ? String(counts[t[0]]) : '', on: s.filter === t[0] ? 'true' : 'false', pick: () => this.setState({ filter: t[0], sel: '', dec: '', note: '', chip: '', err: '' }) })),
      inboxHead: list.length + ' ta soʻrov' + (s.filter === 'all' ? '' : ' · ' + TABS.find(t => t[0] === s.filter)[1].toLowerCase()),
      hasList: list.length > 0, noList: list.length === 0,
      emptyT: s.filter === 'pending' ? 'Kutilayotgan soʻrov yoʻq' : 'Soʻrov yoʻq', emptyS: s.filter === 'pending' ? 'Menejer tahrir soʻraganda shu yerda chiqadi' : 'Bu holatda soʻrov topilmadi', emptyAll: s.filter !== 'all' && reqs.length > 0, showAll: () => this.setState({ filter: 'all', sel: '' }),
      items: list.map(x => ({ id: x.id, cur: x.id === selId ? 'true' : 'false', pick: () => pick(x.id), ini: ini(x.mgr), avSt: 'background:' + (MGR[x.mgr] || '#334155'), t1: shortName(x.mgr) + ' · ' + KIND[x.kind], t2: x.s.name + ' · ' + apSummary(x), t3: x.created, pc: PILL[x.status][0], pl: PILL[x.status][1], blocked: x.status === 'pending' && !!x.clash && s.chk[x.id] === 'ok' })),
      listKey: e => { if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; e.preventDefault(); const i = ord.indexOf(selId), j = Math.max(0, Math.min(ord.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); if (ord[j]) { pick(ord[j]); this.focusSoon('[data-ap="' + ord[j] + '"]'); } },
      noSel: !r && list.length > 0, d,
      openCard: () => toast((r ? r.s.name : '') + ' — oʻquvchi kartasi ochiladi'),
      chkRetry: () => { const c = Object.assign({}, s.chk); delete c[r.id]; this.setState({ chk: c, chkRetried: true }); },
      noteIn: e => this.setState({ note: e.target.value, err: '', chip: s.chip === 'Boshqa' ? 'Boshqa' : (RS.indexOf(e.target.value) >= 0 ? e.target.value : '') }),
      cancel: () => this.setState({ dec: '', note: '', chip: '', err: '' }),
      save: decide,
      toast: s.toast
    };
  }
}
