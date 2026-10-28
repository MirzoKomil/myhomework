// Admin nazorat sahifalari (dizayn: Main.dc.html "Admin · Davomat", AdminQoplash, AdminSorovlar,
// AdminAloqalar, AdminAloqaTuzatish). Hamma amal serverda (/api/school, /api/state/teacher-attendance).
//  • Akademik → Davomat (admin, boshliq; ROP — o'z tilida): ustoz bo'yicha oylik jadval, KPI,
//    "qaysi ustozda nechta belgilanmagan dars kuni bor", davomati past, qoplash nazorati;
//  • Qoplash darslari: oy, KPI, filtrlar, summa, dalil, rad etish sabablari;
//  • Ustozlar so'rovlari: tablar, ta'sir (qaysi darslarga), taklif qilingan qoplashlar, o'quvchi bo'yicha so'rovlar;
//  • Yordamchi aloqalari: haftalik ro'yxat, qatordan tuzatish, kechikib belgilash so'rovlari, oy bosqichlari.
// Maosh hisoblanmaydi — faqat mavjud hisob (calculateKpiSalary, /assist/month) ko'rsatiladi.
(function () {
    'use strict';
    const U = () => window.schoolUI;
    const esc = s => U().esc(s);
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON_T = MON.map(m => m[0].toUpperCase() + m.slice(1));
    const MON_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAY_F = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const RATES = { 15: 75000, 30: 150000, 60: 300000 };
    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const isFull = () => ['admin', 'boshliq'].includes(role());
    const canManage = () => ['admin', 'boshliq', 'rop'].includes(role());
    const getC = (k, d) => (typeof getItem === 'function' && typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS[k] ? getItem(STORAGE_KEYS[k], d) : d);
    const pad = n => String(n).padStart(2, '0');
    const today = () => U().today();
    const nowMin = () => U().nowMin();
    const monthDays = m => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).getUTCDate(); };
    const dateOf = (m, d) => `${m}-${pad(d)}`;
    const wdOf = d => U().wd(d);
    const addMonth = (m, n) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7); };
    const monthName = m => MON_T[Number(m.slice(5)) - 1];
    const monthGen = m => MON[Number(m.slice(5)) - 1];
    const monthLabel = m => `${monthName(m)} ${m.slice(0, 4)}`;
    const dS = d => (d ? `${Number(d.slice(8))}-${MON_S[Number(d.slice(5, 7)) - 1]}` : '—');
    const dW = d => (d ? `${dS(d)}, ${DAY[wdOf(d) - 1]}` : '—');
    const dWF = d => (d ? `${DAY[wdOf(d) - 1]} ${dS(d)}` : '—');
    const money = n => U().num(n);
    const hm = m => U().hm(m);
    const tMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const dkey = v => (v ? String(v).slice(0, 10) : '');
    const toast = (m, ms) => U().toast(m, ms);
    const staffById = id => getC('hrEmployees', []).find(e => e.id === id) || null;
    const tAv = (id, n = 32) => U().staffAvatar(staffById(id) || { id }, n);
    const sAv = (s, n = 32) => U().studentAvatar(s || {}, n);
    const studentById = id => U().studentById(id);
    const tName = (id, short) => U().teacherName(id, short);
    const daysWord = s => `${U().pattern(s.lessonDayOfWeek)}${s.lessonTime ? ' ' + s.lessonTime : ''}`;
    const pill = (cls, t) => `<span class="sc-pill sc-pill--${cls}">${t}</span>`;
    const dot = cls => `<i class="an-dot an-dot--${cls}" aria-hidden="true"></i>`;
    const ICON = {
        info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
        dl: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
        back: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>'
    };

    function anDrawer(o) { const box = U().openDrawer(o); box.classList.add('an-drw'); return box; }
    // ── Umumiy ma'lumot: qoplashlar va "Kelmadi" belgilari (oy bo'yicha kesh) ──
    const mkCache = { key: '', list: [] };
    async function loadMakeups(month, lang, force) {
        const key = `${month}|${lang || ''}`;
        if (!force && mkCache.key === key) return mkCache.list;
        const r = await U().api(`/makeups?month=${month}${lang ? '&lang=' + lang : ''}`);
        mkCache.key = key; mkCache.list = r.makeups || [];
        // calculateKpiSalary (storage.js) tasdiqlangan qoplashlarni shu yerdan oladi — moliya bilan bir xil.
        globalThis.__schoolMakeups = mkCache.list;
        return mkCache.list;
    }
    const abCache = { key: '', list: [] };
    async function loadAbsences(month, force) {
        if (!force && abCache.key === month) return abCache.list;
        const r = await U().api(`/attendance/absences?month=${month}`);
        abCache.key = month; abCache.list = r.absences || [];
        return abCache.list;
    }
    function teacherObj(id) {
        return getC('teachers', []).find(t => t.id === id) || (typeof resolveTeacherWithVirtual === 'function' ? resolveTeacherWithVirtual(id) : null) || { id, name: tName(id) };
    }
    function teachersFor(lang) {
        const list = typeof filterTeachersByTypeAndSubject === 'function' ? filterTeachersByTypeAndSubject('asosiy', lang) : U().teachersForSubject(lang);
        return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    const studentsOf = (tid, lang) => getC('students', []).filter(s => s.teacherId === tid && (!lang || (s.subject || 'english') === lang)
        && !s.frozen && s.status !== 'inactive' && !s.isStaffDemo);
    function kpiFor(t, month, list) {
        try { return typeof calculateKpiSalary === 'function' && list.length ? calculateKpiSalary(t, month, getC('mainAttendance', {}), list) : null; } catch (e) { return null; }
    }
    // Bitta darsning maoshdagi qiymati (ko'rsatish uchun): o'quvchi tarifi / oyning rejadagi darslari.
    function lessonRate(s, t, kpi, plan) {
        const dur = Number(s?.lessonDuration) || Number(kpi?.duration) || 15;
        let base = null;
        try { base = typeof getMonthlyBaseSalary === 'function' ? getMonthlyBaseSalary(dur, t || {}) : RATES[dur]; } catch (e) { base = RATES[dur]; }
        const per = kpi?.expected || plan;
        return base && per ? Math.round(base / per / 100) * 100 : null;
    }

    // O'quvchining oyi: har kun holati, reja, hisobga o'tgan (moliya qoidasi: dars kunidagi "Keldi" + tasdiqlangan qoplash).
    function studentMonth(s, t, month, ctx) {
        const days = monthDays(month), td = today(), nm = nowMin();
        const cal = window.teacherAttendanceCalendar;
        const wds = cal ? cal.weekdays(s, t, 'main') : ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [1, 3, 5] : [2, 4, 6]);
        const start = dkey(s.startDate || s.joinDate);
        const entries = (ctx.att[`${month}_${t.id}`] || {})[s.id] || {};
        const st = tMin(s.lessonTime), dur = Number(s.lessonDuration) || 15;
        const mine = ctx.mks.filter(m => m.student_id === s.id && m.teacher_id === t.id && ['planned', 'review', 'approved'].includes(m.status));
        const heldOn = new Map(mine.filter(m => m.held_date).map(m => [dkey(m.held_date), m]));
        const covered = new Set(mine.map(m => dkey(m.missed_date)));
        const cells = [], present = new Set(), unmarked = [], absent = [];
        let plan = 0, passed = 0;
        for (let d = 1; d <= days; d++) {
            const date = dateOf(month, d);
            const sched = wds.includes(wdOf(date)) && (!start || date >= start);
            const v = entries[d], isP = v === 1 || v === true;
            const isA = !isP && (v === 0 || v === false || ctx.abs.has(`${t.id}|${s.id}|${date}`));
            const ended = date < td || (date === td && st != null && nm >= st + dur);
            if (sched) { plan++; if (ended) passed++; }
            if (isP && sched) present.add(d);
            if (isA) absent.push(date);
            const mk = heldOn.get(date) || null;
            const state = isP ? 'present' : isA ? 'absent' : mk && mk.kind === 'separate' ? 'mk' : sched ? (ended ? 'unmarked' : 'planned') : 'off';
            if (state === 'unmarked') unmarked.push(date);
            cells.push({ d, date, sched, state, mk, covered: isA && covered.has(date), ended });
        }
        let counted = present.size;
        for (const m of mine.filter(m => m.status === 'approved' && dkey(m.held_date).slice(0, 7) === month)) {
            const hd = Number(dkey(m.held_date).slice(8));
            if (m.kind === 'double') counted++; else if (!present.has(hd)) { present.add(hd); counted++; }
        }
        counted = Math.min(counted, plan);
        const review = mine.filter(m => m.status === 'review' && dkey(m.held_date).slice(0, 7) === month);
        const openMissed = absent.filter(d => !covered.has(d));
        return { s, cells, plan, passed, counted, unmarked, absent, openMissed, review, mine };
    }
    function buildCtx(month, mks, abs) {
        return { att: getC('mainAttendance', {}), mks, abs: new Set(abs.map(a => `${a.teacherId}|${a.studentId}|${a.day}`)) };
    }

    // ── Akademik → Davomat (admin) ──────────────────────────────────────────
    const D = { teacherId: '', month: '', half: -1, duty: 'main', pat: 'all', dur: 'all', view: 'grid', lowAll: false, asst: {} };
    function curLang() {
        const b = document.querySelector('#teachersLangTabs [data-teachers-lang].active');
        if (b) return b.dataset.teachersLang === 'russian' ? 'russian' : 'english';
        return (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
    }
    function davRoot() {
        const panel = document.getElementById('tpAttendance');
        if (!panel) return null;
        const wrap = panel.firstElementChild || panel;
        // Eski jadval kartasi va izoh yashiriladi; "Namuna o'quvchi" kartasi qoladi.
        [...wrap.children].forEach(el => { if (el.id !== 'anDavRoot' && !el.classList.contains('team-demo-card')) { el.style.display = 'none'; el.dataset.anHidden = '1'; } });
        let root = document.getElementById('anDavRoot');
        if (!root) { root = document.createElement('div'); root.id = 'anDavRoot'; root.className = 'sc-root an-root'; wrap.prepend(root); }
        return root;
    }
    let davSeq = 0;
    async function renderDavomat() {
        const root = davRoot();
        if (!root || !U()) return;
        const seq = ++davSeq;
        if (typeof _populateDemoStudentSelect === 'function') { try { _populateDemoStudentSelect(); } catch (e) { /* namuna tanlovi ixtiyoriy */ } }
        const lang = curLang();
        D.month ||= today().slice(0, 7);
        if (D.view === 'makeups') return renderMakeups(root, { lang, month: D.month, back: () => { D.view = 'grid'; renderDavomat(); } });
        if (!root.firstChild) root.innerHTML = '<div class="sc-skel"></div>';
        let mks = [], abs = [];
        try {
            await U().loadStaffAvatars();
            [mks, abs] = await Promise.all([loadMakeups(D.month, lang).catch(() => []), loadAbsences(D.month).catch(() => [])]);
        } catch (e) { /* jadval baribir chiziladi */ }
        if (seq !== davSeq) return;
        const teachers = teachersFor(lang);
        if (!teachers.some(t => t.id === D.teacherId)) D.teacherId = teachers[0]?.id || '';
        const ctx = buildCtx(D.month, mks, abs);
        const month = D.month, td = today();
        // Barcha ustozlar bo'yicha (shu til): belgilanmagan dars kunlari va o'quvchi ko'rsatkichlari.
        const all = teachers.map(t => {
            const tObj = teacherObj(t.id);
            const rows = studentsOf(t.id, lang).map(s => studentMonth(s, tObj, month, ctx));
            return { t, tObj, rows, unmarked: rows.reduce((n, r) => n + r.unmarked.length, 0) };
        });
        const cur = all.find(x => x.t.id === D.teacherId) || { t: { id: '' }, tObj: {}, rows: [], unmarked: 0 };
        const asstIds = [...new Set(cur.rows.map(r => r.s.assistantTeacherId).filter(Boolean))];
        let asstPay = null;
        if (canManage() && D.teacherId && getC('students', []).some(s => s.assistantTeacherId === D.teacherId)) {
            const key = `${D.teacherId}|${month}`;
            if (!(key in D.asst)) D.asst[key] = await U().api(`/assist/month?assistantId=${encodeURIComponent(D.teacherId)}&month=${month}`).then(r => r.amount).catch(() => null);
            asstPay = D.asst[key];
        }
        if (seq !== davSeq) return;
        if (D.duty === 'assistant') await loadContacts(cur.rows.map(r => r.s), month);
        if (seq !== davSeq) return;
        root.innerHTML = davomatHtml({ lang, teachers, all, cur, mks, month, td, asstPay, asstIds });
        bindDavomat(root, { all, cur, mks, ctx, lang });
    }

    function davomatHtml({ lang, teachers, all, cur, mks, month, td, asstPay }) {
        const t = cur.t, rowsAll = cur.rows;
        const kpi = kpiFor(cur.tObj, month, rowsAll.map(r => r.s));
        const plan = rowsAll.reduce((n, r) => n + r.plan, 0), counted = rowsAll.reduce((n, r) => n + r.counted, 0), passed = rowsAll.reduce((n, r) => n + r.passed, 0);
        const reviewN = rowsAll.reduce((n, r) => n + r.review.length, 0);
        const reviewSum = rowsAll.reduce((n, r) => n + r.review.reduce((a, m) => a + (lessonRate(r.s, cur.tObj, kpi, r.plan) || 0), 0), 0);
        const pct = passed ? Math.min(100, Math.round(counted / passed * 100)) : null;
        const mwf = rowsAll.filter(r => [1, 3, 5].includes(Number(r.s.lessonDayOfWeek))).length;
        const perStudent = new Map((kpi?.perStudent || []).map(p => [p.id, p]));
        const rows = rowsAll.filter(r => (D.pat === 'all' || (D.pat === 'mwf') === [1, 3, 5].includes(Number(r.s.lessonDayOfWeek)))
            && (D.dur === 'all' || Number(r.s.lessonDuration) === Number(D.dur)));
        const days = monthDays(month);
        if (D.half < 0) D.half = month === td.slice(0, 7) && Number(td.slice(8)) > 15 ? 1 : 0;
        const from = D.half ? 16 : 1, to = D.half ? days : 15;
        const unmarkedMine = cur.unmarked;
        const showMoney = canManage();
        const teacherOpts = teachers.map(x => { const a = all.find(y => y.t.id === x.id); return `<option value="${esc(x.id)}"${x.id === t.id ? ' selected' : ''}>${esc(x.name)} · ${a.rows.length} o'quvchi${a.unmarked ? ` · ${a.unmarked} belgilanmagan` : ''}</option>`; }).join('');
        const head = Array.from({ length: to - from + 1 }, (_, i) => from + i).map(d => { const date = dateOf(month, d); const isT = date === td;
            return `<th class="an-dh${isT ? ' is-today' : ''}" scope="col"><b>${d}</b><small>${isT ? 'Bugun' : DAY[wdOf(date) - 1]}</small></th>`; }).join('');
        const assistantView = D.duty === 'assistant';
        const bodyRows = rows.map(r => {
            const s = r.s, ps = perStudent.get(s.id), rate = lessonRate(s, cur.tObj, kpi, r.plan);
            const cells = r.cells.filter(c => c.d >= from && c.d <= to).map(c => assistantView ? contactCell(s, c) : cellHtml(r, c, td)).join('');
            const low = r.passed >= 3 && r.counted / r.passed < 0.6;
            const right = assistantView ? contactTotals(s)
                : `<td class="an-num${low ? ' is-bad' : ''}"><b>${r.counted} / ${r.plan}</b>${r.review.length ? `<small class="an-plus">+${r.review.length}</small>` : ''}</td>
                   ${showMoney ? `<td class="an-num"><b>${ps ? money(ps.earned) : '—'}</b>${r.review.length && rate ? `<small class="an-plus">+${money(rate * r.review.length)}</small>` : ''}</td>` : ''}`;
            return `<tr><th scope="row" class="an-stu"><button type="button" class="an-sbtn" data-st="${esc(s.id)}">${sAv(s, 28)}<span><b>${esc(s.name)}</b><small>${esc(s.phone ? (typeof formatPhoneDisplay === 'function' ? formatPhoneDisplay(s.phone) : s.phone) : '')}</small></span></button></th>
                <td class="an-sch"><b>${esc(daysWord(s))}</b><small>${Number(s.lessonDuration) || 15} daq</small></td>${cells}${right}</tr>`;
        }).join('');
        const unmarkedTxt = unmarkedMine ? pill('warn', `${unmarkedMine} ta dars belgilanmagan`) : rowsAll.length ? pill('ok', 'hammasi belgilangan') : '';
        const curMonth = month === td.slice(0, 7);
        const left = curMonth ? days - Number(td.slice(8)) : 0;
        return `
        <div class="sc-note an-info">${ICON.info}<span>Dars kunlari o'quvchining jadvaliga qarab avtomatik ajratiladi. <b>Har bir o'quvchi alohida hisoblanadi:</b> ustoz har o'quvchidan oyiga tarifigacha oladi (60 daq — 300 000, 30 daq — 150 000, 15 daq — 75 000 so'm), faqat o'quvchi kelgan darslar uchun.</span></div>
        <section class="sc-card an-filters">
          <div class="an-frow">
            <label class="an-fd an-fd--t"><span>Ustoz</span><span class="an-tsel">${t.id ? tAv(t.id, 30) : ''}<select data-f="teacher" aria-label="Ustoz">${teacherOpts || '<option value="">— Ustoz yo\'q —</option>'}</select></span></label>
            <label class="an-fd"><span>Jadval</span><select data-f="pat"><option value="all">Barcha kunlar</option><option value="mwf"${D.pat === 'mwf' ? ' selected' : ''}>Du · Ch · Ju</option><option value="tts"${D.pat === 'tts' ? ' selected' : ''}>Se · Pa · Sh</option></select></label>
            <label class="an-fd"><span>Davomiylik</span><select data-f="dur"><option value="all">Barchasi</option>${[60, 30, 15].map(d => `<option value="${d}"${String(D.dur) === String(d) ? ' selected' : ''}>${d} daq — ${money(RATES[d])}/oy</option>`).join('')}</select></label>
            <div class="an-fd"><span>Oy</span><div class="an-mnav"><button type="button" class="sc-btn sc-btn--sm" data-mon="-1" aria-label="Oldingi oy">‹</button><b>${monthLabel(month)}</b><button type="button" class="sc-btn sc-btn--sm" data-mon="1" aria-label="Keyingi oy"${curMonth ? ' disabled' : ''}>›</button></div></div>
            ${isFull() && t.id ? '<details class="an-set"><summary>Hisob sozlamasi</summary><div class="an-setb"><label>Ustoz qolipi <select data-set="pattern"><option value="mwf">Dush, Chor, Jum</option><option value="tts">Sesh, Pay, Shan</option></select></label><label>Asosiy davomiylik <select data-set="duration"><option value="15">15 daq — 75 000/oy</option><option value="30">30 daq — 150 000/oy</option><option value="60">60 daq — 300 000/oy</option></select></label><small>Eski sozlama: o\'quvchida dars kuni bo\'lmasa shu qolip ishlatiladi.</small></div></details>' : ''}
          </div>
          <div class="an-kpis">
            <div><small>O'quvchilar</small><b>${rowsAll.length}</b><span>${mwf} tasi Du·Ch·Ju, ${rowsAll.length - mwf} tasi Se·Pa·Sh</span></div>
            <div><small>Hisobga o'tdi · shu oy</small><b>${counted} <em>/ ${plan}${reviewN ? ` · +${reviewN} tekshiruvda` : ''}</em></b><span class="an-bar" role="img" aria-label="${plan ? Math.round(counted / plan * 100) : 0}%"><i style="width:${plan ? Math.min(100, counted / plan * 100) : 0}%"></i></span></div>
            <div><small>Davomat (KPI)</small><b>${pct == null ? '—' : pct + '%'}</b><span>O'tgan ${passed} darsdan ${counted} tasi hisobga o'tdi</span></div>
            ${showMoney ? `<div><small>Maosh · hozirgacha</small><b class="an-ok">${kpi ? money(kpi.total + (asstPay || 0)) + " so'm" : '—'}</b><span>${kpi ? `asosiy ${money(kpi.total)}${asstPay ? ` + yordamchi ${money(asstPay)}` : ''}` : ''}${reviewSum ? ` · +${money(reviewSum)} tekshiruvda` : ''}</span></div>` : ''}
          </div>
        </section>
        <section class="sc-card an-gridcard">
          <header class="an-gh"><div class="sc-row sc-wrap"><h2>${monthName(month)} davomati</h2>${assistantView ? pill('info', 'faqat ko\'rish') : unmarkedTxt}</div>
            <div class="sc-row sc-wrap"><div class="sc-seg" role="group" aria-label="Davomat turi"><button type="button" data-duty="main" aria-pressed="${!assistantView}">Asosiy ustoz</button><button type="button" data-duty="assistant" aria-pressed="${assistantView}">Yordamchi (ko'rish)</button></div>
            <div class="sc-seg" role="group" aria-label="Oy yarmi"><button type="button" data-half="0" aria-pressed="${!D.half}">1–15</button><button type="button" data-half="1" aria-pressed="${!!D.half}">16–${days}</button></div>
            <button type="button" class="sc-btn sc-btn--sm" data-excel>${ICON.dl} Excel</button></div></header>
          <div class="an-scroll"><table class="an-grid${assistantView ? ' is-asst' : ''}"><thead><tr><th scope="col" class="an-stu">O'quvchi</th><th scope="col">Jadval</th>${head}${assistantView ? '<th scope="col" class="an-num">Aloqa / 13</th>' : `<th scope="col" class="an-num">Keldi / reja</th>${showMoney ? '<th scope="col" class="an-num">Maosh, so\'m</th>' : ''}`}</tr></thead>
            <tbody>${bodyRows || `<tr><td colspan="${to - from + 5}" class="sc-mt an-empty">${t.id ? 'Filtr bo\'yicha o\'quvchi yo\'q' : 'Bu tilda asosiy ustoz yo\'q'}</td></tr>`}</tbody></table></div>
          <div class="an-legend">${assistantView
            ? `<span><i class="an-c an-c--ok">●</i>Hisoblangan aloqa</span><span><i class="an-c an-c--bad">✕</i>Javob bermadi</span><span><i class="an-c an-c--mute">·</i>Hisoblanmadi (qisqa, takror)</span><span><i class="an-c an-c--off"></i>Aloqa yo'q</span>`
            : `<span><i class="an-c an-c--ok">✓</i>Keldi</span><span><i class="an-c an-c--bad">−</i>Kelmadi</span><span><i class="an-c an-c--plan">${Math.min(28, days)}</i>Rejadagi dars</span><span><i class="an-c an-c--warn">!</i>Vaqti o'tdi, belgilanmagan</span><span><i class="an-c an-c--off"></i>Dars kuni emas</span><span><i class="an-c an-c--mk">Q</i>Qoplash darsi</span><span><i class="an-c an-c--mk is-review">Q</i>Qoplash · tekshiruvda</span><span><i class="an-c an-c--ok">✓<sub>2</sub></i>Qo'shaloq dars (2 ta)</span><span><i class="an-c an-c--bad is-covered">−</i>Kelmadi, keyin qoplandi</span>`}</div>
        </section>
        <div class="an-sep"><span>Barcha ustozlar bo'yicha · ${monthGen(month)}</span></div>
        <div class="an-two">${unmarkedPanel(all, month, curMonth, left)}${lowPanel(all)}</div>
        ${isFull() ? makeupPanel(mks, lang) : ''}`;
    }
    function cellHtml(r, c, td) {
        const editable = canManage() && c.date <= td;
        const m = c.mk;
        let cls = 'off', txt = '', label = 'Dars kuni emas';
        if (c.state === 'present') { const dbl = r.mine.some(x => x.kind === 'double' && dkey(x.held_date) === c.date && x.status !== 'planned'); cls = 'ok' + (c.sched ? '' : ' is-extra'); txt = dbl ? '✓<sub>2</sub>' : '✓'; label = dbl ? 'Keldi · 2 dars' : 'Keldi'; }
        else if (c.state === 'absent') { cls = 'bad' + (c.covered ? ' is-covered' : ''); txt = '−'; label = c.covered ? 'Kelmadi, keyin qoplandi' : 'Kelmadi'; }
        else if (c.state === 'mk') { cls = 'mk' + (m.status === 'review' ? ' is-review' : m.status === 'planned' ? ' is-plan' : ''); txt = 'Q'; label = m.status === 'review' ? 'Qoplash · tekshiruvda' : m.status === 'planned' ? 'Qoplash rejada' : 'Qoplash darsi'; }
        else if (c.state === 'unmarked') { cls = 'warn'; txt = '!'; label = 'Vaqti o\'tdi, belgilanmagan'; }
        else if (c.state === 'planned') { cls = 'plan'; txt = String(c.d); label = 'Rejadagi dars'; }
        const click = editable && (c.state !== 'off' || (isFull() && r.openMissed.length)) && c.state !== 'planned';
        const today = c.date === td ? ' is-today' : '';
        return click ? `<td class="an-td${today}"><button type="button" class="an-c an-c--${cls}" data-cell="${esc(r.s.id)}" data-date="${c.date}" aria-label="${esc(r.s.name)}, ${dW(c.date)}: ${label}">${txt}</button></td>`
            : `<td class="an-td${today}"><span class="an-c an-c--${cls}" title="${label}">${txt}</span></td>`;
    }

    // Yordamchi (ko'rish): o'quvchi bo'yicha aloqalar (shu oy).
    const contactCache = new Map();
    async function loadContacts(list, month) {
        await Promise.all(list.filter(s => s.assistantTeacherId && !contactCache.has(`${s.id}|${month}`)).map(s =>
            U().api(`/students/${encodeURIComponent(s.id)}/contacts?month=${month}`).then(r => contactCache.set(`${s.id}|${month}`, r)).catch(() => contactCache.set(`${s.id}|${month}`, null))));
    }
    function contactCell(s, c) {
        const r = contactCache.get(`${s.id}|${c.date.slice(0, 7)}`);
        const items = (r?.items || []).filter(i => i.day === c.date);
        const ok = items.find(i => i.status === 'counted'), na = items.find(i => i.status === 'no_answer');
        const tip = items.map(i => `${(U().CHN?.[i.channel] || ['', i.channel])[1]}${i.minutes ? ' · ' + i.minutes + ' daq' : ''}${i.status !== 'counted' ? ' · hisoblanmadi' : ''}`).join('; ');
        const cls = ok ? 'ok' : na ? 'bad' : items.length ? 'mute' : 'off';
        return `<td class="an-td${c.date === today() ? ' is-today' : ''}"><span class="an-c an-c--${cls}" title="${esc(tip || (s.assistantTeacherId ? 'Aloqa yo\'q' : 'Yordamchi biriktirilmagan'))}">${ok ? '●' : na ? '✕' : items.length ? '·' : ''}</span></td>`;
    }
    function contactTotals(s) {
        const r = contactCache.get(`${s.id}|${D.month}`);
        return `<td class="an-num">${s.assistantTeacherId ? `<b>${r ? r.counted : '—'} / 13</b><small>${esc(tName(s.assistantTeacherId, true))}</small>` : '<small>yordamchi yo\'q</small>'}</td>`;
    }

    function unmarkedPanel(all, month, curMonth, left) {
        const list = all.filter(x => x.unmarked).sort((a, b) => b.unmarked - a.unmarked);
        const total = list.reduce((n, x) => n + x.unmarked, 0);
        const last = monthDays(month);
        return `<section class="sc-card an-panel"><header class="sc-ch"><h2>Belgilanmay qolgan dars kunlari</h2>${total ? pill('warn', total) : pill('ok', '0')}</header>
          <p class="an-pnote">${curMonth ? `Ustozlar ${monthGen(month)} davomatini <b>${last}-${monthGen(month)}gacha</b> o'zlari kiritadi${left ? ` · ${left} kun qoldi` : ' · bugun oxirgi kun'}.` : `${monthName(month)} tugagan.`} Faqat o'quvchining haqiqiy dars kunlari sanaladi (vaqti o'tgan, "Keldi" ham "Kelmadi" ham qo'yilmagan).</p>
          ${list.length ? `<ul class="an-list">${list.map(x => {
            const top = x.rows.filter(r => r.unmarked.length).sort((a, b) => b.unmarked.length - a.unmarked.length);
            const oldest = top.flatMap(r => r.unmarked).sort()[0];
            return `<li>${tAv(x.t.id, 36)}<span class="sc-grow"><b>${esc(x.t.name)}</b><small>${x.unmarked} dars kuni · ${top.length} o'quvchi · eng eskisi ${dS(oldest)}</small><small class="an-who">${top.slice(0, 4).map(r => `${esc(U().shortName(r.s.name))} (${r.unmarked.length})`).join(', ')}${top.length > 4 ? ` va yana ${top.length - 4}` : ''}</small></span>
              <span class="an-cnt">${x.unmarked}</span><span class="an-acts">${x.t.id !== D.teacherId ? `<button type="button" class="sc-btn sc-btn--sm" data-see="${esc(x.t.id)}">Ko'rish</button>` : ''}<button type="button" class="sc-btn sc-btn--sm" data-remind="${esc(x.t.id)}">Eslatish</button></span></li>`;
          }).join('')}</ul>` : '<p class="sc-mt sc-pad">Hamma ustozlar o\'tgan darslarni belgilagan.</p>'}</section>`;
    }
    function lowPanel(all) {
        const rows = all.flatMap(x => x.rows.map(r => ({ ...r, t: x.t }))).filter(r => r.passed >= 3 && r.counted / r.passed < 0.7)
            .sort((a, b) => a.counted / a.passed - b.counted / b.passed);
        const shown = D.lowAll ? rows : rows.slice(0, 5);
        return `<section class="sc-card an-panel"><header class="sc-ch"><h2>Davomati past</h2>${rows.length > 5 ? `<button type="button" class="sc-link" data-lowall>${D.lowAll ? 'Qisqartirish' : `Barchasi · ${rows.length}`}</button>` : ''}</header>
          ${shown.length ? `<ul class="an-list">${shown.map(r => { const p = Math.round(r.counted / r.passed * 100);
            return `<li>${sAv(r.s, 36)}<span class="sc-grow"><button type="button" class="sc-link" data-st="${esc(r.s.id)}">${esc(r.s.name)}</button><small>${esc(r.t.name)} · o'tgan ${r.passed} darsdan ${r.counted} tasi</small></span>${pill(p < 50 ? 'bad' : 'warn', p + '%')}</li>`; }).join('')}</ul>`
            : '<p class="sc-mt sc-pad">70% dan past davomatli o\'quvchi yo\'q.</p>'}</section>`;
    }
    function makeupPanel(mks, lang) {
        const mine = mks.filter(m => (studentById(m.student_id)?.subject || 'english') === lang);
        const review = mine.filter(m => m.status === 'review');
        const recent = mine.filter(m => m.status === 'approved').slice(0, Math.max(0, 3 - review.length));
        const list = [...review.slice(0, 4), ...recent];
        return `<section class="sc-card an-panel"><header class="sc-ch"><h2>Qoplash darslari · nazorat</h2>${review.length ? pill('warn', `${review.length} tekshiruvda`) : pill('ok', 'tekshiruv yo\'q')}</header>
          ${list.length ? `<ul class="an-list">${list.map(m => { const s = studentById(m.student_id) || { id: m.student_id, name: m.student_id };
            return `<li>${sAv(s, 36)}<span class="sc-grow"><b>${esc(s.name)}</b><small>${dS(dkey(m.missed_date))} o'rniga ${m.kind === 'double' ? 'qo\'shaloq · ' : ''}${dS(dkey(m.held_date))} · ${esc(tName(m.teacher_id, true))}</small></span>
              ${m.status === 'review' ? `<span class="an-acts"><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-mkyes="${esc(m.id)}">Tasdiqlash</button><button type="button" class="sc-btn sc-btn--sm" data-mkno="${esc(m.id)}">Rad etish</button></span>` : pill('ok', 'Tasdiqlandi')}</li>`; }).join('')}</ul>`
            : '<p class="sc-mt sc-pad">Bu oy qoplash darsi yo\'q.</p>'}
          <footer class="an-pfoot"><button type="button" class="sc-link" data-allmk>Barcha qoplash darslari · ${mine.length}</button></footer></section>`;
    }

    function bindDavomat(root, { all, cur, mks, ctx, lang }) {
        const rerender = () => renderDavomat();
        root.querySelector('[data-f="teacher"]')?.addEventListener('change', e => { D.teacherId = e.target.value; rerender(); });
        root.querySelector('[data-f="pat"]')?.addEventListener('change', e => { D.pat = e.target.value; rerender(); });
        root.querySelector('[data-f="dur"]')?.addEventListener('change', e => { D.dur = e.target.value; rerender(); });
        root.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => { D.month = addMonth(D.month, Number(b.dataset.mon)); D.half = -1; rerender(); });
        root.querySelectorAll('[data-duty]').forEach(b => b.onclick = () => { D.duty = b.dataset.duty; rerender(); });
        root.querySelectorAll('[data-half]').forEach(b => b.onclick = () => { D.half = Number(b.dataset.half); rerender(); });
        root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
        root.querySelectorAll('[data-see]').forEach(b => b.onclick = () => { D.teacherId = b.dataset.see; rerender(); root.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); });
        root.querySelectorAll('[data-remind]').forEach(b => b.onclick = () => remindDrawer(all.find(x => x.t.id === b.dataset.remind)));
        root.querySelector('[data-lowall]')?.addEventListener('click', () => { D.lowAll = !D.lowAll; rerender(); });
        root.querySelector('[data-allmk]')?.addEventListener('click', () => { D.view = 'makeups'; rerender(); });
        root.querySelectorAll('[data-mkyes]').forEach(b => b.onclick = () => decideMakeup(b.dataset.mkyes, 'approve', '', b).then(ok => ok && rerender()));
        root.querySelectorAll('[data-mkno]').forEach(b => b.onclick = () => rejectDrawer(mks.find(m => m.id === b.dataset.mkno), rerender));
        root.querySelector('[data-excel]')?.addEventListener('click', () => exportCsv(cur));
        // Eski "Hisob sozlamasi" (ustoz qolipi va davomiylik) — app.js dagi syncTeacherSettings orqali.
        const ps = root.querySelector('[data-set="pattern"]'), ds = root.querySelector('[data-set="duration"]');
        if (ps && ds && typeof syncTeacherSettings === 'function') syncTeacherSettings(D.teacherId, ps, ds, rerender);
        root.querySelectorAll('[data-cell]').forEach(b => b.onclick = e => {
            const r = cur.rows.find(x => x.s.id === b.dataset.cell);
            if (r) cellPopover(b, r, cur.tObj, b.dataset.date, rerender);
        });
    }

    // Katak bosilganda: Keldi / Keldi · 2 dars / Kelmadi / Qoplash darsi o'tildi / belgini olib tashlash.
    let _pop = null;
    function closePop() { if (!_pop) return; document.removeEventListener('mousedown', _pop.out, true); document.removeEventListener('keydown', _pop.key, true); _pop.el.remove(); const f = _pop.focus; _pop = null; f?.focus?.(); }
    function cellPopover(anchor, r, t, date, done) {
        closePop();
        const s = r.s, c = r.cells.find(x => x.date === date);
        const missed = isFull() && date.slice(0, 7) >= '2026-10' && !(c.mk) ? r.openMissed.filter(d => d !== date) : [];
        const pick = missed.length ? `<label class="an-pick">Qaysi qoldirilgan dars o'rniga? <select data-missed>${missed.map(d => `<option value="${d}">${dW(d)}</option>`).join('')}</select></label>` : '';
        const btns = [];
        if (c.sched) {
            btns.push(`<button type="button" class="sc-btn sc-btn--sm${c.state === 'present' ? '' : ' sc-btn--pri'}" data-a="present">Keldi</button>`);
            if (missed.length) btns.push('<button type="button" class="sc-btn sc-btn--sm" data-a="double">Keldi · 2 dars</button>');
            btns.push('<button type="button" class="sc-btn sc-btn--sm" data-a="absent">Kelmadi</button>');
        } else if (missed.length && c.state === 'off') btns.push('<button type="button" class="sc-btn sc-btn--sm sc-btn--pri" data-a="separate">Qoplash darsi o\'tildi</button>');
        if (c.state === 'present' || c.state === 'absent') btns.push('<button type="button" class="sc-btn sc-btn--sm an-rm" data-a="remove">Belgini olib tashlash</button>');
        const planned = r.mine.filter(m => m.status === 'planned' && m.held_date);
        const info = [
            c.mk ? `Qoplash: ${dS(dkey(c.mk.missed_date))} o'rniga · ${c.mk.status === 'review' ? 'tekshiruvda' : c.mk.status === 'approved' ? 'tasdiqlangan' : 'rejada'}` : '',
            r.openMissed.length ? `qoplanmagan: ${r.openMissed.map(dS).join(', ')}` : '',
            planned.length ? planned.map(m => `${dS(dkey(m.missed_date))} → ${dWF(dkey(m.held_date))}${m.start_min != null ? ' ' + hm(Number(m.start_min)) : ''} rejada`).join(' · ') : '',
            !c.sched ? 'Bu kun dars kuni emas — maoshga faqat qoplash sifatida, tasdiq bilan o\'tadi.' : ''
        ].filter(Boolean).join(' · ');
        const el = document.createElement('div');
        el.className = 'an-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `${s.name} davomati`);
        el.innerHTML = `<b>${esc(s.name)}</b><small>${DAY_F[wdOf(date) - 1]}, ${dS(date)}${s.lessonTime ? ' · ' + esc(s.lessonTime) : ''} · ${Number(s.lessonDuration) || 15} daq</small>
            ${pick}<div class="an-pbtn">${btns.join('') || '<span class="sc-mt">Bu katakda amal yo\'q</span>'}</div>${info ? `<p>${esc(info)}</p>` : ''}<p class="an-perr" role="alert" hidden></p>`;
        document.body.appendChild(el);
        const rect = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
        let left = rect.left + rect.width / 2 - w / 2 + window.scrollX, top = rect.top + window.scrollY - h - 8;
        if (rect.top - h - 8 < 0) top = rect.bottom + window.scrollY + 8;
        left = Math.max(8 + window.scrollX, Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 8));
        el.style.left = left + 'px'; el.style.top = top + 'px';
        const out = e => { if (!el.contains(e.target) && e.target !== anchor) closePop(); };
        const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } };
        document.addEventListener('mousedown', out, true); document.addEventListener('keydown', key, true);
        _pop = { el, out, key, focus: anchor };
        el.querySelector('button')?.focus();
        const err = el.querySelector('.an-perr');
        el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
            const a = b.dataset.a, m = el.querySelector('[data-missed]')?.value;
            el.querySelectorAll('button').forEach(x => { x.disabled = true; });
            try {
                if (a === 'present' || a === 'double') await setAttendance(t.id, s.id, date, true);
                if (a === 'absent') await setAttendance(t.id, s.id, date, false);
                if (a === 'remove') await setAttendance(t.id, s.id, date, null);
                if (a === 'double' || a === 'separate') { await U().post(`/makeups/${a}`, { studentId: s.id, missedDate: m, heldDate: date }); mkCache.key = ''; toast('Qoplash kiritildi va tasdiqlandi'); }
                closePop(); done();
            } catch (e) { err.hidden = false; err.textContent = e.message; el.querySelectorAll('button').forEach(x => { x.disabled = false; }); }
        });
    }
    async function setAttendance(teacherId, studentId, date, present) {
        if (typeof saveTeacherAttendanceChange !== 'function') throw new Error('Davomatni saqlab bo\'lmadi');
        await saveTeacherAttendanceChange({ teacherId, studentId, date, present, attendanceType: 'main', grade: null });
        abCache.key = '';
    }

    function remindDrawer(x) {
        if (!x) return;
        const e = staffById(x.t.id) || {};
        const month = D.month, last = monthDays(month);
        const top = x.rows.filter(r => r.unmarked.length).sort((a, b) => b.unmarked.length - a.unmarked.length);
        const first = String(x.t.name || '').split(/\s+/)[0];
        const text = `Assalomu alaykum, ${first}! ${monthName(month)} davomatida ${x.unmarked} ta dars kuni belgilanmagan:\n${top.map(r => `• ${r.s.name}: ${r.unmarked.map(d => Number(d.slice(8))).join(', ')}-${monthGen(month)}`).join('\n')}\nIltimos, ${last}-${monthGen(month)}gacha CRM → Akademik bo'lim → Davomat bo'limida o'quvchining dars kunlariga "Keldi" yoki "Kelmadi" qo'ying. Rahmat!`;
        const digits = String(e.phone || e.login || '').replace(/\D/g, '');
        const tg = digits.length >= 9 ? `https://t.me/+${digits.length === 9 ? '998' + digits : digits}` : '';
        const box = anDrawer({ title: `Eslatish · ${x.t.name}`, sub: `${x.unmarked} ta belgilanmagan dars kuni · ${monthName(month)}`,
            body: `${U().field('Eslatma matni', `<textarea name="txt" rows="10">${esc(text)}</textarea>`, 'Matnni nusxalab ustozga Telegram\'da yuboring')}
                ${tg ? '' : '<div class="sc-note sc-note--warn">Ustozning telefon raqami HR profilida yo\'q — matnni nusxalab o\'zingiz yuboring.</div>'}`,
            foot: `<button type="button" class="sc-btn" data-close>Yopish</button><span class="sc-row"><button type="button" class="sc-btn" data-copy>Nusxalash</button>${tg ? '<button type="button" class="sc-btn sc-btn--pri" data-tg>Telegram\'da ochish</button>' : ''}</span>` });
        const copy = async () => { const v = box.querySelector('[name=txt]').value; try { await navigator.clipboard.writeText(v); toast('Matn nusxalandi'); } catch (err) { box.querySelector('[name=txt]').select(); toast('Matnni belgilab nusxalang'); } };
        box.querySelector('[data-copy]').onclick = copy;
        box.querySelector('[data-tg]')?.addEventListener('click', async () => { await copy(); window.open(tg, '_blank', 'noopener'); });
    }

    function exportCsv(cur) {
        const month = D.month, days = monthDays(month);
        const mark = c => ({ present: 'Keldi', absent: 'Kelmadi', mk: 'Qoplash', unmarked: 'Belgilanmagan', planned: 'Reja', off: '' }[c.state] || '');
        const kpi = kpiFor(cur.tObj, month, cur.rows.map(r => r.s));
        const per = new Map((kpi?.perStudent || []).map(p => [p.id, p]));
        const head = ['O\'quvchi', 'Telefon', 'Jadval', 'Davomiylik', ...Array.from({ length: days }, (_, i) => String(i + 1)), 'Hisobga o\'tdi', 'Reja', ...(canManage() ? ['Maosh'] : [])];
        const lines = [head, ...cur.rows.map(r => [r.s.name, r.s.phone || '', daysWord(r.s), `${r.s.lessonDuration || ''} daq`, ...r.cells.map(mark), r.counted, r.plan, ...(canManage() ? [per.get(r.s.id)?.earned ?? ''] : [])])];
        const csv = '﻿' + lines.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `davomat-${String(cur.t.name || 'ustoz').replace(/\s+/g, '-')}-${month}.csv`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    // ── Qoplash darslari ─────────────────────────────────────────────────────
    const M = { month: '', filter: 'all', sel: '' };
    const MK_ST = { planned: ['Rejada', 'info'], review: ['Tekshiruvda', 'warn'], approved: ['Tasdiqlandi', 'ok'], rejected: ['Rad etildi', 'bad'], cancelled: ['Bekor', 'mute'] };
    const REJECT = ['Dars juda qisqa', 'O\'quvchi tasdiqlamadi', 'Oylik chegaradan oshdi', 'Boshqa'];
    async function decideMakeup(id, decision, note, btn) {
        if (btn) U().busy(btn, true);
        try { await U().post(`/makeups/${id}/decide`, { decision, note }); mkCache.key = ''; toast(decision === 'approve' ? 'Tasdiqlandi — maoshga qo\'shiladi' : 'Rad etildi'); return true; }
        catch (e) { if (btn) U().busy(btn, false); toast(e.message, 4000); return false; }
    }
    function rejectDrawer(m, done) {
        if (!m) return;
        const s = studentById(m.student_id) || { name: m.student_id };
        const box = anDrawer({ title: `Rad etish · ${s.name}`, sub: `${dS(dkey(m.missed_date))} o'rniga ${dS(dkey(m.held_date))} · ${esc(tName(m.teacher_id))}`,
            body: `${rejectFields()}<div class="sc-note">Rad etilsa dars maoshga qo'shilmaydi, qoldirilgan dars yana "qoplash mumkin" bo'ladi va ustoz o'z ro'yxatida sababni ko'radi.</div>`,
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--dg" data-save>Rad etish</button>' });
        bindReject(box);
        box.querySelector('[data-save]').onclick = async e => {
            const note = rejectNote(box);
            if (!note) return U().errBox(box, 'Sababni tanlang');
            if (await decideMakeup(m.id, 'reject', note, e.target)) { U().closeDrawer(); done(); }
        };
    }
    const rejectFields = () => `<p class="an-cap">Rad etilsa — sabab (ustozga boradi)</p><div class="an-chips" role="radiogroup">${REJECT.map((r, i) => `<label class="sc-chip"><input type="radio" name="rr" value="${esc(r)}"${i === 3 ? ' data-other' : ''}><span>${esc(r)}</span></label>`).join('')}</div>
        <textarea name="rnote" rows="2" class="sc-mtop" placeholder="Izoh (ixtiyoriy)…" aria-label="Izoh"></textarea>`;
    function bindReject(box) { box.querySelectorAll('[name=rr]').forEach(i => i.onchange = () => { box.querySelector('[name=rnote]').placeholder = i.dataset.other !== undefined ? 'Sababni yozing (majburiy)…' : 'Izoh (ixtiyoriy)…'; }); }
    function rejectNote(box) {
        const r = box.querySelector('[name=rr]:checked'), n = box.querySelector('[name=rnote]').value.trim();
        if (!r) return n.length >= 3 ? n : '';
        if (r.dataset.other !== undefined) return n.length >= 3 ? n : '';
        return n ? `${r.value} — ${n}` : r.value;
    }
    async function renderMakeups(root, opts = {}) {
        if (!root) return;
        root.classList.add('an-page');
        M.month = opts.month || M.month || today().slice(0, 7);
        root.innerHTML = '<div class="sc-skel"></div>';
        let list;
        try { await U().loadStaffAvatars(); list = await loadMakeups(M.month, opts.lang || '', true); await loadAbsences(M.month).catch(() => []); }
        catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        if (opts.lang) list = list.filter(m => (studentById(m.student_id)?.subject || 'english') === opts.lang);
        const ctx = buildCtx(M.month, mkCache.list, abCache.key === M.month ? abCache.list : []);
        const td = today(), month = M.month;
        const by = st => list.filter(m => m.status === st);
        const kpis = new Map();
        const info = m => {
            const s = studentById(m.student_id) || { id: m.student_id, name: m.student_id };
            const t = teacherObj(m.teacher_id);
            if (!kpis.has(m.teacher_id)) kpis.set(m.teacher_id, kpiFor(t, month, studentsOf(m.teacher_id, s.subject || 'english')));
            const sm = studentMonth(s, t, month, ctx);
            return { s, t, sm, rate: lessonRate(s, t, kpis.get(m.teacher_id), sm.plan) };
        };
        const infos = new Map(list.map(m => [m.id, info(m)]));
        const reviewSum = by('review').reduce((n, m) => n + (infos.get(m.id).rate || 0), 0);
        const next = by('planned').filter(m => dkey(m.held_date) >= td).sort((a, b) => (dkey(a.held_date) + pad(a.start_min || 0)).localeCompare(dkey(b.held_date) + pad(b.start_min || 0)));
        const nextTxt = next.slice(0, 2).map(m => dkey(m.held_date) === td ? `bugun${m.start_min != null ? ' ' + hm(Number(m.start_min)) : ''}` : `${DAY[wdOf(dkey(m.held_date)) - 1]} ${Number(dkey(m.held_date).slice(8))}`).join(' · ');
        const shown = list.filter(m => M.filter === 'all' || m.status === M.filter);
        if (!shown.some(m => m.id === M.sel)) M.sel = (shown.find(m => m.status === 'review') || shown[0])?.id || '';
        const tabs = [['all', 'Hammasi', list.length], ['review', 'Tekshiruvda', by('review').length], ['planned', 'Rejada', by('planned').length], ['approved', 'Tasdiqlangan', by('approved').length], ['rejected', 'Rad etilgan', by('rejected').length]];
        const curMonth = month === td.slice(0, 7);
        root.innerHTML = `${opts.back ? `<button type="button" class="an-back" data-back>${ICON.back} Akademik · Davomat</button>` : ''}
          <div class="sc-head"><div><h1>Qoplash darslari · ${monthGen(month)}</h1><p class="sc-sub">Ustozlar qoldirilgan darslarni qoplaydi · siz tasdiqlaganingizdan keyin maoshga qo'shiladi</p></div>
            <div class="an-mnav an-mnav--big"><button type="button" class="sc-btn sc-btn--sm" data-mon="-1" aria-label="Oldingi oy">‹</button><b>${monthLabel(month)}</b><button type="button" class="sc-btn sc-btn--sm" data-mon="1" aria-label="Keyingi oy"${curMonth ? ' disabled' : ''}>›</button></div></div>
          <div class="an-k5">
            <div class="sc-kpi"><small>Jami</small><b>${list.length}</b><span>${new Set(list.map(m => m.teacher_id)).size} ustoz</span></div>
            <div class="sc-kpi"><small>${dot('warn')}Tekshiruvda</small><b>${by('review').length}</b><span>${reviewSum ? `+${money(reviewSum)} so'm kutmoqda` : 'kutilayotgan yo\'q'}</span></div>
            <div class="sc-kpi"><small>${dot('ok')}Tasdiqlangan</small><b>${by('approved').length}</b><span>maoshga qo'shildi</span></div>
            <div class="sc-kpi"><small>${dot('info')}Rejada</small><b>${by('planned').length}</b><span>${nextTxt || '—'}</span></div>
            <div class="sc-kpi"><small>${dot('bad')}Rad etilgan</small><b>${by('rejected').length}</b><span>sabab bilan</span></div>
          </div>
          <div class="an-lay">
            <section class="sc-card"><header class="an-ch2"><h2>Barcha qoplash darslari</h2><div class="sc-seg" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" data-mf="${k}" aria-pressed="${M.filter === k}">${l} ${n}</button>`).join('')}</div></header>
              <div class="an-scroll"><table class="sc-table an-mk"><thead><tr><th>O'quvchi · ustoz</th><th>Qoldirilgan</th><th>Qoplangan · dalil</th><th class="r">Summa</th><th>Holat</th></tr></thead><tbody>
              ${shown.map(m => { const x = infos.get(m.id), ev = evidence(m), [stl, stc] = MK_ST[m.status] || [m.status, 'mute'];
                return `<tr class="an-mkr${m.id === M.sel ? ' sel' : ''}" data-mk="${esc(m.id)}" tabindex="0" aria-selected="${m.id === M.sel}"><td><span class="an-who2">${sAv(x.s, 34)}<span><b>${esc(x.s.name)}</b><small>${esc(tName(m.teacher_id))}</small></span></span></td>
                  <td>${dW(dkey(m.missed_date))}</td><td><span class="an-held"><span>${heldTxt(m, x.s)}</span><small>${timeTxt(m, x.s)}</small><small class="an-ev">${dot(ev[0])}${esc(ev[1])}</small></span></td>
                  <td class="r">${m.status === 'rejected' || m.status === 'cancelled' ? '—' : x.rate ? money(x.rate) : '—'}</td><td>${pill(stc, stl)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="sc-mt">Qoplash darsi yo\'q</td></tr>'}
              </tbody></table></div></section>
            <section class="sc-card an-detail" data-detail></section>
          </div>`;
        const detail = root.querySelector('[data-detail]');
        const show = id => { M.sel = id; root.querySelectorAll('[data-mk]').forEach(r => { r.classList.toggle('sel', r.dataset.mk === id); r.setAttribute('aria-selected', String(r.dataset.mk === id)); }); makeupDetail(detail, list.find(m => m.id === id), infos.get(id), () => renderMakeups(root, opts)); };
        root.querySelectorAll('[data-mk]').forEach(r => { r.onclick = () => show(r.dataset.mk); r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(r.dataset.mk); } }; });
        root.querySelectorAll('[data-mf]').forEach(b => b.onclick = () => { M.filter = b.dataset.mf; renderMakeups(root, opts); });
        root.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => { M.month = addMonth(M.month, Number(b.dataset.mon)); if (opts.back) D.month = M.month; renderMakeups(root, { ...opts, month: M.month }); });
        root.querySelector('[data-back]')?.addEventListener('click', () => opts.back());
        if (M.sel) show(M.sel); else detail.innerHTML = '<p class="sc-mt sc-pad">Qoplash darsini tanlang</p>';
    }
    function heldTxt(m, s) {
        const hd = dkey(m.held_date);
        if (!hd) return '—';
        return `${hd === today() ? 'bugun' : dW(hd)} · ${m.kind === 'double' ? 'qo\'shaloq' : 'alohida'}`;
    }
    function timeTxt(m, s) {
        const dur = Number(s?.lessonDuration) || 30;
        if (m.kind === 'double') { const st = tMin(s?.lessonTime); return st != null ? `${hm(st)}–${hm(st + 2 * dur)} · 2 × ${dur} daq` : `2 × ${dur} daq`; }
        if (m.start_min != null) return `${hm(Number(m.start_min))} · ${(Number(m.end_min) - Number(m.start_min)) || dur} daq`;
        return `${dur} daq`;
    }
    // Dalil: ilovada "Darsni boshlash" vaqti hali yozilmaydi — davomat belgisi va jonli dars nomi ko'rsatiladi.
    function evidence(m) {
        if (m.status === 'cancelled') return ['bad', 'bekor qilingan'];
        const hd = dkey(m.held_date);
        if (m.status === 'planned' || !hd || hd > today()) return ['plan', 'hali o\'tmagan'];
        const g = (getC('liveGrades', {})[m.student_id] || []).find(x => x && x.date === hd && (!x.teacherId || x.teacherId === m.teacher_id));
        const v = ((getC('mainAttendance', {})[`${hd.slice(0, 7)}_${m.teacher_id}`] || {})[m.student_id] || {})[Number(hd.slice(8))];
        const tone = m.status === 'rejected' ? 'bad' : 'ok';
        if (g?.lessonName) return [tone, `Davomatda "Keldi" · ${g.lessonName}`];
        if (v === 1 || v === true) return [tone, 'Davomatda "Keldi"'];
        return [m.status === 'rejected' ? 'bad' : 'warn', m.kind === 'double' ? 'Ustoz belgisi: "Keldi · 2 dars"' : 'Ustoz belgisi: "Qoplash darsi o\'tildi"'];
    }
    function makeupDetail(el, m, x, done) {
        if (!m || !el) return;
        const [stl, stc] = MK_ST[m.status] || [m.status, 'mute'];
        const hd = dkey(m.held_date), s = x.s;
        const onLessonDay = hd && (window.teacherAttendanceCalendar ? window.teacherAttendanceCalendar.weekdays(s, x.t, 'main') : []).includes(wdOf(hd));
        const sm = x.sm, after = Math.min(sm.counted + (m.status === 'approved' ? 0 : 1), 99);
        const over = sm.counted >= sm.plan && m.status !== 'approved';
        const ev = evidence(m);
        const review = m.status === 'review' && isFull();
        el.innerHTML = `<header class="sc-ch"><h2>${esc(s.name)} · qoplash</h2>${pill(stc, stl)}</header>
          <div class="sc-pad"><dl class="an-kv">
            <dt>Ustoz</dt><dd>${esc(tName(m.teacher_id))}</dd>
            <dt>Qoldirilgan</dt><dd>${dW(dkey(m.missed_date))} · kelmadi</dd>
            <dt>Qoplangan</dt><dd>${hd ? `${dW(hd)} · ${timeTxt(m, s)}${m.kind === 'double' ? ' (qo\'shaloq)' : onLessonDay ? ' (dars kuni)' : ' (dars kuni emas)'}` : '—'}</dd>
            <dt>Dalil</dt><dd>${dot(ev[0])}${esc(ev[1])}</dd>
            <dt>Oylik chegara</dt><dd>${sm.counted} / ${sm.plan} · ${over ? '<span class="an-bad">ortiqcha — hisoblanmaydi</span>' : 'ortiqcha emas'}</dd>
            ${x.rate && m.status !== 'rejected' && m.status !== 'cancelled' ? `<dt>Maoshga</dt><dd class="an-ok">${m.status === 'approved' ? '' : '+'}${money(x.rate)} so'm${m.status === 'approved' ? ' · qo\'shilgan' : ''}</dd>` : ''}
            ${m.decided_at ? `<dt>Qaror</dt><dd>${esc(m.decided_by_name || '')} · ${esc(U().whenTxt(m.decided_at))}${m.decision_note ? ` — ${esc(m.decision_note)}` : ''}</dd>` : ''}
          </dl>
          ${review ? `<div class="an-dec"><button type="button" class="sc-btn sc-btn--pri" data-yes>Tasdiqlash</button><button type="button" class="sc-btn" data-no>Rad etish</button></div>
            <div class="an-rej">${rejectFields()}</div>
            <div class="sc-note an-mtop">Rad etilsa dars maoshga qo'shilmaydi, qoldirilgan dars yana "qoplash mumkin" bo'ladi va ustoz o'z ro'yxatida sababni ko'radi.</div>`
            : m.status === 'planned' ? '<div class="sc-note an-mtop">Ustoz darsni o\'tgach "O\'tildi" bosadi — keyin shu yerda tasdiqlaysiz.</div>' : ''}
          ${m.status !== 'approved' && sm.plan ? `<p class="sc-mt an-mtop">Tasdiqlansa: ${esc(s.name)} — ${after > sm.plan ? sm.plan : after} / ${sm.plan} dars hisobga o'tadi.</p>` : ''}
          </div>`;
        if (!review) return;
        bindReject(el);
        el.querySelector('[data-yes]').onclick = async e => { if (await decideMakeup(m.id, 'approve', '', e.target)) done(); };
        el.querySelector('[data-no]').onclick = async e => {
            const note = rejectNote(el);
            if (!note) { el.querySelector('.an-rej')?.scrollIntoView({ block: 'nearest' }); return toast('Rad etish sababini tanlang yoki yozing'); }
            if (await decideMakeup(m.id, 'reject', note, e.target)) done();
        };
    }

    // ── Ustozlar so'rovlari ──────────────────────────────────────────────────
    const R = { tab: 'new', sel: '' };
    const RQ_T = { leave: 'ta\'til', close: 'vaqtni yopish', open: 'qo\'shimcha ochish', student: 'o\'quvchi bo\'yicha' };
    const TOPIC = { freeze: 'muzlatish', teacher: 'ustozni almashtirish', schedule: 'jadvalni o\'zgartirish', other: 'o\'quvchi bo\'yicha' };
    const typeLabel = r => (r.type === 'student' ? TOPIC[r.payload?.topic] || TOPIC.other : RQ_T[r.type] || r.type);
    function whenRange(p) {
        const range = !p.from || (p.from === '00:00' && (p.to === '24:00' || !p.to)) ? 'butun kun' : `${p.from}–${p.to || ''}`;
        if (p.date) return { when: `${dWF(p.date)}`, long: `${Number(p.date.slice(8))}-${MON[Number(p.date.slice(5, 7)) - 1]}, ${DAY_F[wdOf(p.date) - 1]}`, range };
        if (p.weekday) return { when: `har ${DAY_F[p.weekday - 1].toLowerCase()}`, long: `har ${DAY_F[p.weekday - 1].toLowerCase()}`, range };
        return { when: '', long: '', range };
    }
    function reqSummary(r) {
        const p = r.payload || {};
        if (r.type === 'student') return `${esc(p.studentName || studentById(p.studentId)?.name || '')} · "${esc(r.reason)}"`;
        const w = whenRange(p);
        return `${esc(r.type === 'leave' ? w.long : w.when)} · ${esc(w.range)} · "${esc(r.reason)}"`;
    }
    const sentAt = iso => { const t = new Date(iso); return `${U().whenTxt(iso)} ${t.toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })}`; };
    async function renderRequests(root) {
        if (!root) return;
        root.classList.add('an-page');
        root.innerHTML = '<div class="sc-skel"></div>';
        let all;
        try { await U().loadStaffAvatars(); all = (await U().api('/requests')).requests.filter(r => r.type !== 'assist_late'); }
        catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const map = { new: 'new', approved: 'approved', rejected: 'rejected' };
        const list = all.filter(r => r.status === map[R.tab]);
        const n = all.filter(r => r.status === 'new').length;
        if (!list.some(r => r.id === R.sel)) R.sel = list[0]?.id || '';
        root.innerHTML = `<div class="sc-head"><div><h1>Ustozlar so'rovlari</h1><p class="sc-sub">Vaqt, ta'til va o'quvchi bo'yicha so'rovlar · tasdiqlansa jadval hammada darhol yangilanadi</p></div>
            <div class="sc-seg" role="tablist">${[['new', `Yangi${n ? ' ' + n : ''}`], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan']].map(([k, l]) => `<button type="button" role="tab" data-rt="${k}" aria-pressed="${R.tab === k}">${l}</button>`).join('')}</div></div>
          <div class="an-rlay"><section class="sc-card an-rlist">${list.map(r => `<button type="button" class="an-ri${r.id === R.sel ? ' sel' : ''}" data-rq="${esc(r.id)}">${tAv(r.teacher_id, 36)}<span class="sc-grow"><b>${esc(r.requester_name || tName(r.teacher_id))} · ${esc(typeLabel(r))}</b><small>${reqSummary(r)}</small></span>${r.status === 'new' ? pill('warn', 'Yangi') : r.status === 'approved' ? pill('ok', 'Tasdiqlandi') : pill('bad', 'Rad etildi')}</button>`).join('') || '<p class="sc-mt sc-pad">So\'rov yo\'q</p>'}</section>
          <section class="sc-card an-rdet" data-detail>${list.length ? '<div class="sc-skel"></div>' : '<p class="sc-mt sc-pad">So\'rovni tanlang</p>'}</section></div>`;
        root.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { R.tab = b.dataset.rt; R.sel = ''; renderRequests(root); });
        const det = root.querySelector('[data-detail]');
        const open = id => { R.sel = id; root.querySelectorAll('[data-rq]').forEach(b => b.classList.toggle('sel', b.dataset.rq === id)); requestDetail(det, list.find(r => r.id === id), () => renderRequests(root)); };
        root.querySelectorAll('[data-rq]').forEach(b => b.onclick = () => { open(b.dataset.rq); if (window.matchMedia?.('(max-width: 900px)').matches) det.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
        if (R.sel) open(R.sel);
    }
    let rqSeq = 0;
    async function requestDetail(el, r, done) {
        if (!r) return;
        const seq = ++rqSeq;
        el.innerHTML = '<div class="sc-skel"></div>';
        let imp = null;
        try { imp = (await U().api(`/requests/${encodeURIComponent(r.id)}/impact`)).impact; } catch (e) { imp = { error: e.message, lessons: [] }; }
        if (seq !== rqSeq) return;
        const p = r.payload || {}, w = whenRange(p), isNew = r.status === 'new';
        const lessons = imp?.lessons || [];
        const sug = lessons.filter(l => l.suggestion);
        const title = `${esc(r.requester_name || tName(r.teacher_id))} · ${esc(typeLabel(r))}${p.date ? ` · ${Number(p.date.slice(8))}-${MON[Number(p.date.slice(5, 7)) - 1]}` : p.weekday ? ' · ' + esc(w.when) : ''}`;
        let impactHtml = '';
        if (r.type === 'leave' || r.type === 'close') {
            const dayTxt = imp?.date ? (imp.weekly ? `Eng yaqin sana — ${dWF(imp.date)} (har hafta takrorlanadi).` : '') : '';
            impactHtml = `<div class="sc-note sc-note--warn"><b>Ta'sir:</b> ${dayTxt} ${lessons.length ? `shu ${r.type === 'leave' ? 'kuni' : 'oraliqda'} ${lessons.length} ta dars bor. Tasdiqlansa ular "qoplash kerak" bo'ladi, ustozning shu ${r.type === 'leave' ? 'kungi' : 'oraliqdagi'} vaqti sotuv uchun yopiladi.` : `shu ${r.type === 'leave' ? 'kuni' : 'oraliqda'} dars yo'q. Tasdiqlansa vaqt sotuv (sinov) uchun yopiladi.`}${imp?.error ? ` <i>(${esc(imp.error)})</i>` : ''}</div>
              ${lessons.length ? `<table class="sc-table an-imp"><thead><tr><th>Vaqt</th><th>O'quvchi</th><th>Taklif</th></tr></thead><tbody>${lessons.map((l, i) => `<tr><td>${esc(l.time)}</td><td><button type="button" class="sc-link" data-st="${esc(l.studentId)}">${esc(l.studentName)}</button> · ${l.duration} daq${l.kind === 'makeup' ? ' · qoplash' : ''}</td>
                <td>${l.planned ? pill('info', `Rejada: ${dWF(l.planned.date)}${l.planned.time ? ' ' + l.planned.time : ''}`) : l.suggestion ? (isNew ? `<label class="an-sug"><input type="checkbox" data-sug="${i}" checked><span>${dWF(l.suggestion.date)} ${esc(l.suggestion.time)} · bo'sh</span></label>` : `<span class="sc-mt">${dWF(l.suggestion.date)} ${esc(l.suggestion.time)} bo'sh edi</span>`) : '<span class="sc-mt">shu oy ichida bo\'sh vaqt topilmadi</span>'}</td></tr>`).join('')}</tbody></table>` : ''}`;
        } else if (r.type === 'open') {
            impactHtml = `<div class="sc-note"><b>Ta'sir:</b> ${esc(w.when)} ${esc(w.range)} ustozning jadvalida qo'shimcha ochiladi — sinov va qoplash uchun bo'sh vaqt sifatida ko'rinadi.</div>`;
        } else if (r.type === 'student') {
            const st = imp?.student;
            impactHtml = `<div class="sc-note"><b>O'quvchi:</b> ${st ? `${esc(st.name)} · ${esc(st.days)} ${esc(st.time || '')}${st.duration ? ' · ' + st.duration + ' daq' : ''}` : esc(p.studentName || '')}. ${lessons.length ? `Yaqin 14 kunda ${lessons.length} ta darsi bor${p.topic === 'freeze' ? ' — muzlatilsa ular bo\'shaydi' : ''}.` : 'Yaqin 14 kunda darsi yo\'q.'}</div>
              <blockquote class="sc-quote">${esc(r.reason)}</blockquote>
              <div class="sc-row sc-wrap"><button type="button" class="sc-btn" data-card>Kartani ochish</button><span class="sc-mt">${p.topic === 'freeze' ? 'Muzlatish' : p.topic === 'teacher' ? 'Ustozni almashtirish' : p.topic === 'schedule' ? 'Jadvalni o\'zgartirish' : 'Amal'} kartadagi tegishli tugma orqali bajariladi, keyin so'rovni "Bajarildi" deb yoping.</span></div>`;
        }
        const decisions = r.type === 'leave' || r.type === 'close'
            ? [...(sug.length ? [['approve_mk', 'Tasdiqlash + qoplashlarni taklif qilish']] : []), ['approve', 'Faqat tasdiqlash'], ['reject', 'Rad etish']]
            : r.type === 'student' ? [['approve', 'Bajarildi · yopish'], ['reject', 'Rad etish']] : [['approve', 'Tasdiqlash'], ['reject', 'Rad etish']];
        el.innerHTML = `<header class="sc-ch"><h2>${title}</h2><span class="sc-mt">yuborildi ${esc(sentAt(r.created_at))}${r.type === 'leave' ? ' · HR davomati alohida belgilanadi' : ''}</span></header>
          <div class="sc-pad an-rbody">${impactHtml}
          ${isNew ? `<p class="an-cap">Qaror</p><div class="an-decs" role="radiogroup">${decisions.map(([k, l], i) => `<label class="an-decb"><input type="radio" name="dec" value="${k}"${i === 0 ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
            <textarea name="note" rows="2" placeholder="Izoh (rad etishda majburiy — ustozga boradi)" aria-label="Izoh"></textarea>
            <div class="sc-note" data-hint></div>`
            : `<div class="sc-note ${r.status === 'approved' ? 'sc-note--ok' : 'sc-note--bad'}">${r.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'} · ${esc(r.decided_by_name || '')}${r.decided_at ? ' · ' + esc(sentAt(r.decided_at)) : ''}${r.decision_note ? ` — ${esc(r.decision_note)}` : ''}</div>`}
          </div>
          ${isNew ? '<footer class="sc-df"><span></span><span class="sc-row"><button type="button" class="sc-btn" data-cancel>Bekor</button><button type="button" class="sc-btn sc-btn--pri" data-save>Qarorni saqlash</button></span></footer>' : ''}`;
        el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => U().openStudent(b.dataset.st));
        el.querySelector('[data-card]')?.addEventListener('click', () => U().openStudent(p.studentId));
        if (!isNew) return;
        const hint = el.querySelector('[data-hint]');
        const HINT = { approve_mk: 'Belgilangan qoplash vaqtlari ustozning jadvalida "rejada" bo\'lib ko\'rinadi (sotuvga yopiladi). Ustoz darsni o\'tgach tekshiruvga yuboradi, siz tasdiqlagach maoshga qo\'shiladi.',
            approve: r.type === 'student' ? 'So\'rov yopiladi. Amalni (muzlatish, ustoz, jadval) kartada bajaring — tarixga yoziladi.' : 'Jadval darhol yangilanadi. Darslar qoplash uchun ochiq qoladi — ustoz o\'zi rejalashtiradi.',
            reject: 'Sabab majburiy — ustoz "Sinovlar va so\'rovlar" bo\'limida ko\'radi.' };
        const sync = () => { const v = el.querySelector('[name=dec]:checked')?.value; hint.textContent = HINT[v] || ''; el.querySelectorAll('[data-sug]').forEach(c => { c.disabled = v !== 'approve_mk'; }); };
        el.querySelectorAll('[name=dec]').forEach(i => i.onchange = sync); sync();
        el.querySelector('[data-cancel]').onclick = () => { el.querySelector('[name=dec]').checked = true; el.querySelector('[name=note]').value = ''; el.querySelectorAll('[data-sug]').forEach(c => { c.checked = true; }); sync(); };
        el.querySelector('[data-save]').onclick = async e => {
            const v = el.querySelector('[name=dec]:checked')?.value, note = el.querySelector('[name=note]').value.trim();
            if (v === 'reject' && note.length < 3) { el.querySelector('[name=note]').focus(); return toast('Rad etish sababini yozing'); }
            const makeups = v === 'approve_mk' ? [...el.querySelectorAll('[data-sug]:checked')].map(c => lessons[Number(c.dataset.sug)]).filter(l => l?.suggestion)
                .map(l => ({ studentId: l.studentId, date: l.suggestion.date, time: l.suggestion.time, duration: l.duration })) : [];
            U().busy(e.target, true);
            try {
                const res = await U().post(`/requests/${r.id}/decide`, { decision: v === 'reject' ? 'reject' : 'approve', note, makeups });
                toast(v === 'reject' ? 'Rad etildi' : res.makeups?.length ? `Tasdiqlandi · ${res.makeups.length} ta qoplash rejaga qo'yildi` : 'Tasdiqlandi', 3500);
                R.sel = ''; done();
            } catch (err) { U().busy(e.target, false); toast(err.message, 5000); }
        };
    }

    // ── Yordamchi aloqalari (admin) ──────────────────────────────────────────
    const A = { aid: '', month: '', week: '', all: false };
    const RATE = 3846, CAP = 13;
    function assistantList() {
        const st = getC('students', []).filter(s => s.status !== 'inactive' && !s.isStaffDemo && !s.frozen);
        const ids = new Set([...getC('hrEmployees', []).filter(e => e.role === 'yordamchi' && (e.status || 'active') !== 'inactive').map(e => e.id), ...st.map(s => s.assistantTeacherId).filter(Boolean)]);
        return [...ids].map(id => ({ id, name: tName(id), n: st.filter(s => s.assistantTeacherId === id).length, main: staffById(id)?.role !== 'yordamchi' }))
            .filter(a => a.name !== '—').sort((a, b) => a.main - b.main || b.n - a.n || a.name.localeCompare(b.name));
    }
    // assist.js countMonth bilan bir xil qoidalar (oldindan ko'rish uchun; yakuniy hisob serverda).
    function countLocal(items) {
        const by = new Map();
        const rows = [...items].sort((a, b) => a.day.localeCompare(b.day) || (a.at ?? 0) - (b.at ?? 0));
        for (const c of rows) {
            if (!by.has(c.studentId)) by.set(c.studentId, { counted: 0, days: new Set(), tw: new Set(), list: [] });
            const s = by.get(c.studentId);
            let st = 'counted';
            if (c.outcome === 'no_answer') st = 'no_answer';
            else if (c.channel !== 'tg_text' && Number(c.minutes) < 5) st = 'short';
            else if (s.days.has(c.day)) st = 'same_day';
            else if (c.channel === 'tg_text' && s.tw.has(U().weekStart(c.day))) st = 'extra_text';
            else if (s.counted >= CAP) st = 'over_cap';
            if (st === 'counted') { s.counted++; s.days.add(c.day); if (c.channel === 'tg_text') s.tw.add(U().weekStart(c.day)); }
            s.list.push({ ...c, status: st });
        }
        return by;
    }
    async function renderAssist(root) {
        if (!root) return;
        root.classList.add('an-page');
        await U().loadStaffAvatars();
        const list = assistantList();
        A.month ||= today().slice(0, 7);
        if (!list.some(a => a.id === A.aid)) A.aid = list[0]?.id || '';
        const month = A.month, td = today(), curMonth = month === td.slice(0, 7);
        const lastDay = dateOf(month, monthDays(month));
        if (!A.week || A.week.slice(0, 7) > month || U().addDays(A.week, 6) < month + '-01') A.week = U().weekStart(curMonth ? td : lastDay);
        root.innerHTML = '<div class="sc-skel"></div>';
        let rep = null, reqs = [], reps = [];
        try {
            [reps, reqs] = await Promise.all([
                Promise.all(list.map(a => U().api(`/assist/month?assistantId=${encodeURIComponent(a.id)}&month=${month}`).catch(() => null))),
                U().api('/requests?status=new').then(r => r.requests.filter(x => x.type === 'assist_late'))
            ]);
            rep = reps[list.findIndex(a => a.id === A.aid)] || null;
        } catch (e) { root.innerHTML = `<div class="sc-err">${esc(e.message)}</div>`; return; }
        const a = list.find(x => x.id === A.aid);
        const st = rep?.state || {};
        const final = !!st.final_at;
        const items = (rep?.students || []).flatMap(s => s.items.map(i => ({ ...i, studentId: s.studentId })));
        const wEnd = U().addDays(A.week, 6);
        const shown = items.filter(i => A.all || (i.day >= A.week && i.day <= wEnd)).sort((x, y) => x.day.localeCompare(y.day) || (x.at ?? 0) - (y.at ?? 0));
        const myStudents = getC('students', []).filter(s => s.assistantTeacherId === A.aid && s.status !== 'inactive' && !s.isStaffDemo && !s.frozen);
        const weekCounted = items.filter(i => i.day >= A.week && i.day <= wEnd && i.status === 'counted').length;
        const myReqs = reqs.filter(r => r.teacher_id === A.aid), otherReqs = reqs.length - myReqs.length;
        const ended = !curMonth && month < td.slice(0, 7);
        const daysToEnd = curMonth ? monthDays(month) - Number(td.slice(8)) + 1 : 0;
        const stepIdx = !ended ? 0 : !st.prelim_at ? 1 : !final ? 2 : !st.paid_at ? 3 : 4;
        const objection = st.objection_until ? dS(String(st.objection_until).slice(0, 10)) : `4-${MON[Number(addMonth(month, 1).slice(5)) - 1]}`;
        const steps = [['Oy davom etmoqda', curMonth ? `${daysToEnd} kun qoldi` : ''], ['Yopildi', 'dastlabki tasdiq kutilmoqda'], ['Dastlabki tasdiq', `e'tiroz ${objection}gacha`], ['Yakuniy tasdiq', `to'lov 5-${MON[Number(addMonth(month, 1).slice(5)) - 1]}`], ['To\'langan', '']];
        const stepBtn = !isFull() ? '' : !ended ? `<button type="button" class="sc-btn sc-btn--pri" disabled>Oyni yopish · ${daysToEnd} kundan keyin</button>`
            : !st.prelim_at ? '<button type="button" class="sc-btn sc-btn--pri" data-step="prelim">Dastlabki tasdiq</button>'
            : !final ? '<button type="button" class="sc-btn sc-btn--pri" data-step="final">Yakuniy tasdiq</button>'
            : !st.paid_at ? '<button type="button" class="sc-btn sc-btn--pri" data-step="paid">To\'landi</button>' : pill('ok', 'To\'langan');
        const totals = list.map((x, i) => reps[i] ? `${esc(U().shortName(x.name))}${x.main ? ' (yordamchi)' : ''}: ${reps[i].counted} aloqa · ${money(reps[i].amount)} so'm` : '').filter(Boolean).join(' · ');
        const chn = i => i.outcome === 'no_answer' ? '✕ Javob bermadi' : `${(U().CHN[i.channel] || ['', i.channel])[0]} ${(U().CHN[i.channel] || ['', i.channel])[1]}`;
        const hisob = i => i.status === 'counted' ? pill('ok', 'hisoblandi') : `<span class="sc-pill sc-pill--mute" title="${esc(U().CST[i.status] || '')}">hisoblanmaydi${U().CST[i.status] ? ' · ' + esc(U().CST[i.status]) : ''}</span>`;
        root.innerHTML = `<div class="sc-head"><div><h1>Yordamchi aloqalari</h1><p class="sc-sub">Admin${a ? ' · ' + esc(a.name) : ''} · o'tgan kunlarni faqat admin tuzatadi (sabab bilan) · oy yopilganda Moliya tasdiqlaydi</p></div>
            <div class="sc-row sc-wrap"><div class="sc-seg" role="tablist" aria-label="Yordamchi">${list.map(x => `<button type="button" role="tab" data-aid="${esc(x.id)}" aria-pressed="${x.id === A.aid}">${esc(U().shortName(x.name))} · ${x.n}</button>`).join('')}</div>
            <div class="an-mnav"><button type="button" class="sc-btn sc-btn--sm" data-mon="-1" aria-label="Oldingi oy">‹</button><b>${monthLabel(month)}</b><button type="button" class="sc-btn sc-btn--sm" data-mon="1" aria-label="Keyingi oy"${curMonth ? ' disabled' : ''}>›</button></div></div></div>
          ${rep ? `<div class="sc-kpis an-k4">
            <div class="sc-kpi"><small>${monthName(month)}</small><b>${rep.counted} / ${myStudents.length * CAP}</b><span>hisoblangan aloqa</span></div>
            <div class="sc-kpi"><small>Maosh</small><b>${money(rep.amount)}</b><span>${rep.counted} × ${money(RATE)} so'm</span></div>
            <div class="sc-kpi"><small>${curMonth && A.week === U().weekStart(td) ? 'Bu hafta' : 'Hafta'}</small><b>${weekCounted} / ${myStudents.length * 3}</b><span>tavsiya bo'yicha</span></div>
            <div class="sc-kpi"><small>So'rovlar</small><b>${myReqs.length}</b><span>kechikib belgilash${otherReqs ? ` · boshqalarda ${otherReqs}` : ''}</span></div></div>` : ''}
          ${myReqs.length ? `<section class="sc-card"><header class="sc-ch"><h2>So'rov · kechikib belgilash</h2>${pill('warn', `${myReqs.length} kutilmoqda`)}</header>
            ${myReqs.map(r => { const s = studentById(r.payload?.studentId) || { name: '' }, pp = r.payload || {};
              return `<div class="an-lrq">${sAv(s, 36)}<span class="sc-grow"><b>${esc(s.name)} · ${dWF(pp.day)}</b><small>${esc(U().shortName(r.requester_name))}: "${esc(r.reason)}"${pp.channel ? ` — ${esc((U().CHN[pp.channel] || ['', pp.channel])[1].toLowerCase())}${pp.minutes ? ', ' + esc(pp.minutes) + ' daq' : ''}` : ''}</small></span>
                ${isFull() && !final ? `<span class="an-acts"><button type="button" class="sc-btn sc-btn--sm" data-lno="${esc(r.id)}">Rad etish</button><button type="button" class="sc-btn sc-btn--pri sc-btn--sm" data-lyes="${esc(r.id)}">Tasdiqlash · hisoblanadi</button></span>` : ''}</div>`; }).join('')}</section>` : ''}
          ${rep ? `<section class="sc-card"><header class="sc-ch"><h2>${A.all ? `${monthName(month)} · barcha aloqalar` : `${curMonth && A.week === U().weekStart(td) ? 'Bu hafta' : `${dS(A.week)} – ${dS(wEnd)}`} · barcha aloqalar`}</h2>
              <div class="sc-row sc-wrap">${A.all ? '' : '<button type="button" class="sc-btn sc-btn--sm" data-wk="-1" aria-label="Oldingi hafta">‹</button><button type="button" class="sc-btn sc-btn--sm" data-wk="1" aria-label="Keyingi hafta">›</button>'}
              <button type="button" class="sc-btn sc-btn--sm" data-all aria-pressed="${A.all}">${A.all ? 'Haftalik' : 'Butun oy'}</button>
              ${isFull() && !final ? '<button type="button" class="sc-btn sc-btn--sm" data-bulk>O\'tgan kunlarni kiritish</button><button type="button" class="sc-btn sc-btn--sm" data-add>+ Aloqa qo\'shish</button>' : ''}</div></header>
            <p class="an-hint">Tuzatish → usul, daqiqa yoki sanani o'zgartirish · tarixga yoziladi · yordamchi o'z ro'yxatida ko'radi</p>
            <div class="an-scroll"><table class="sc-table an-al"><thead><tr><th>Vaqt</th><th>O'quvchi</th><th>Usul</th><th class="r">Daqiqa</th><th>Hisob</th><th></th></tr></thead><tbody>
            ${shown.map(i => { const s = studentById(i.studentId) || { id: i.studentId, name: i.studentId };
              return `<tr><td>${dWF(i.day)}${i.at != null ? ' · ' + hm(i.at) : ''}</td><td><span class="an-who2">${sAv(s, 28)}<b>${esc(s.name)}</b></span></td><td>${esc(chn(i))}${i.corrected ? ' <span class="sc-pill sc-pill--info">tuzatilgan</span>' : ''}</td>
                <td class="r">${i.outcome === 'no_answer' ? '—' : esc(i.minutes)}</td><td>${hisob(i)}</td><td class="r">${isFull() && !final ? `<button type="button" class="sc-btn sc-btn--sm" data-fix="${esc(i.id)}">Tuzatish</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="6" class="sc-mt">${A.all ? 'Bu oy' : 'Bu haftada'} aloqa yo'q</td></tr>`}
            </tbody></table></div>
            <details class="an-sum"><summary>O'quvchilar bo'yicha · ${rep.students.length}</summary><div class="an-scroll"><table class="sc-table"><thead><tr><th>O'quvchi</th><th class="r">Hisoblangan</th><th class="r">Summa</th><th>Izoh</th></tr></thead><tbody>${rep.students.map(s => `<tr><td>${sAv(studentById(s.studentId), 26)} ${esc(studentById(s.studentId)?.name || s.studentId)}</td><td class="r"><b>${s.counted}</b> / ${CAP}</td><td class="r">${money(s.amount)}</td><td class="sc-mt">${[s.noAnswer && `${s.noAnswer} javob bermadi`, s.overCap && `${s.overCap} ta limitdan ortiq`, s.short && `${s.short} ta 5 daqiqadan qisqa`].filter(Boolean).join(' · ') || '—'}</td></tr>`).join('')}</tbody>
              <tfoot><tr><td>Jami</td><td class="r">${rep.counted}</td><td class="r">${money(rep.amount)}</td><td></td></tr></tfoot></table></div></details></section>
          <section class="sc-card"><header class="sc-ch"><h2>${monthName(month)}ni yopish</h2><span class="sc-mt">${ended ? `${monthGen(month)} tugagan` : `${dS(lastDay)} 23:59 dan keyin`}</span></header>
            <ol class="an-steps">${steps.map(([l, sub], i) => `<li class="${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}"><b>${l}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</li>`).join('')}</ol>
            <div class="an-close"><p class="sc-mt">${totals || '—'}. Yakuniy tasdiqdan keyin o'zgartirish faqat Moliya orqali.</p>${stepBtn}</div></section>`
            : '<p class="sc-mt">Yordamchi ustoz yo\'q</p>'}`;
        const re = () => renderAssist(root);
        root.querySelectorAll('[data-aid]').forEach(b => b.onclick = () => { A.aid = b.dataset.aid; re(); });
        root.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => { A.month = addMonth(A.month, Number(b.dataset.mon)); A.week = ''; re(); });
        root.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { const n = U().addDays(A.week, 7 * Number(b.dataset.wk)); if (n.slice(0, 7) <= month && U().addDays(n, 6) >= month + '-01') { A.week = n; re(); } });
        root.querySelector('[data-all]')?.addEventListener('click', () => { A.all = !A.all; re(); });
        root.querySelectorAll('[data-step]').forEach(b => b.onclick = async () => { U().busy(b, true); try { await U().post(`/assist/months/${month}/${b.dataset.step}`); toast('Saqlandi'); re(); } catch (e) { U().busy(b, false); toast(e.message, 4000); } });
        root.querySelector('[data-bulk]')?.addEventListener('click', () => U().bulkDrawer(A.aid, month, rep, re));
        root.querySelector('[data-add]')?.addEventListener('click', () => U().correctionDrawer({ teacher_id: A.aid, payload: {} }, re));
        root.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => fixDrawer({ item: items.find(i => i.id === b.dataset.fix), items, rep, assistant: a, month, reps, list }, re));
        root.querySelectorAll('[data-lyes]').forEach(b => b.onclick = () => { const r = myReqs.find(x => x.id === b.dataset.lyes); const pp = r.payload || {};
            const ex = items.filter(i => i.studentId === pp.studentId && i.day === pp.day).sort((x, y) => (x.status === 'counted') - (y.status === 'counted'))[0];
            fixDrawer({ item: ex || null, req: r, items, rep, assistant: a, month, reps, list }, re); });
        root.querySelectorAll('[data-lno]').forEach(b => b.onclick = () => lateReject(myReqs.find(x => x.id === b.dataset.lno), re));
    }
    function lateReject(r, done) {
        if (!r) return;
        const box = anDrawer({ title: 'So\'rovni rad etish', sub: `${esc(r.requester_name)} · ${esc(studentById(r.payload?.studentId)?.name || '')} · ${dWF(r.payload?.day)}`,
            body: U().field('Sabab (yordamchiga boradi)', '<textarea name="note" rows="3"></textarea>'),
            foot: '<button type="button" class="sc-btn" data-close>Bekor</button><button type="button" class="sc-btn sc-btn--dg" data-save>Rad etish</button>' });
        box.querySelector('[data-save]').onclick = async e => {
            const note = box.querySelector('[name=note]').value.trim();
            if (note.length < 3) return U().errBox(box, 'Sababni yozing');
            U().busy(e.target, true);
            try { await U().post(`/requests/${r.id}/decide`, { decision: 'reject', note }); toast('Rad etildi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
    }
    // Aloqani tuzatish (AdminAloqaTuzatish): hozirgi yozuv → yangi qiymat, sabab, "Saqlansa" oldindan ko'rish.
    function fixDrawer({ item, req, items, rep, assistant, month }, done) {
        const pp = req?.payload || {};
        const sid = item?.studentId || pp.studentId;
        const s = studentById(sid) || { id: sid, name: sid };
        const day = item?.day || pp.day;
        const CH = Object.entries(U().CHN).map(([k, v]) => [k, `${v[0]} ${v[1]}`]);
        const init = { ch: req ? (pp.channel || 'phone') : item?.outcome === 'no_answer' ? 'no_answer' : item?.channel || 'phone', at: req ? (pp.at || '') : item?.at != null ? hm(item.at) : '',
            min: req ? (pp.minutes || '') : item?.minutes || '', day: req ? pp.day : item?.day };
        const now = item ? `<div class="sc-g2"><div class="an-ro"><span>Usul</span><b>${item.outcome === 'no_answer' ? '✕ Javob bermadi' : esc(CH.find(c => c[0] === item.channel)?.[1] || item.channel)}</b></div><div class="an-ro"><span>Vaqt · daqiqa</span><b>${item.at != null ? hm(item.at) : '—'} · ${item.outcome === 'no_answer' ? '—' : esc(item.minutes) + ' daq'}</b></div></div>` : '<p class="sc-mt">Shu kunda yozuv yo\'q — yangi aloqa qo\'shiladi.</p>';
        const box = anDrawer({ title: `Aloqani tuzatish · ${s.name}`, sub: `${dWF(day)} · yordamchi ${esc(U().shortName(assistant?.name || tName(rep?.assistantId)))} · o'tgan kun — faqat admin`, body: `
            <div class="sc-sec"><h3>Hozirgi yozuv</h3>${now}</div>
            <div class="sc-sec"><h3>Yangi qiymat</h3><div class="sc-g2">
              ${U().field(`Usul${item ? ` <em class="an-was">edi: ${item.outcome === 'no_answer' ? 'javob bermadi' : esc((U().CHN[item.channel] || ['', item.channel])[1].toLowerCase())}</em>` : ''}`, `<select name="ch">${[...CH, ['no_answer', '✕ Javob bermadi']].map(([k, l]) => `<option value="${k}"${k === init.ch ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
              ${U().field('Vaqt', `<input type="time" name="at" value="${esc(init.at)}">`)}
              ${U().field('Davomiylik, daqiqa', `<input name="min" inputmode="numeric" value="${esc(init.min)}">`)}
              ${U().field('Sana', `<input type="date" name="day" value="${esc(init.day)}" min="${month}-01" max="${today() < dateOf(month, monthDays(month)) ? today() : dateOf(month, monthDays(month))}">`)}
              ${U().field('Asos', `<select name="basis">${['Qo\'ng\'iroqlar tarixi skrinshoti', 'Telegram yozishma skrinshoti', 'O\'quvchi (ota-ona) tasdiqladi', 'Yordamchining izohi', 'Boshqa'].map(x => `<option>${esc(x)}</option>`).join('')}</select>`)}
            </div></div>
            <div class="sc-sec"><h3>Sabab (majburiy)</h3><textarea name="reason" rows="2" aria-label="Sabab">${esc(req?.reason || '')}</textarea></div>
            <div class="sc-sec"><h3>Saqlansa</h3><ul class="sc-imp" data-prev></ul></div>`,
            foot: `<span class="sc-mt">${req ? `So'rovdan ochildi · ${esc(U().shortName(req.requester_name))} ${esc(sentAt(req.created_at))}` : item ? '' : ''}</span>
              <span class="sc-row">${req ? '<button type="button" class="sc-btn" data-rej>Rad etish</button>' : item ? '<button type="button" class="sc-btn an-rm" data-del>O\'chirish</button><button type="button" class="sc-btn" data-close>Bekor</button>' : '<button type="button" class="sc-btn" data-close>Bekor</button>'}
              <button type="button" class="sc-btn sc-btn--pri" data-save>${req ? 'Tasdiqlash va saqlash' : 'Saqlash'}</button></span>` });
        const v = n => box.querySelector(`[name=${n}]`).value.trim();
        const minEl = box.querySelector('[name=min]');
        const preview = () => {
            const ch = v('ch'), no = ch === 'no_answer';
            minEl.disabled = no;
            const nextItem = { id: '__new', studentId: sid, day: v('day') || day, at: tMin(v('at')), channel: no ? 'phone' : ch, minutes: no ? 0 : Number(v('min')) || 0, outcome: no ? 'no_answer' : 'contacted' };
            const base = items.filter(i => i.studentId === sid);
            const before = countLocal(base).get(sid) || { counted: 0, list: [] };
            const after = countLocal([...base.filter(i => !item || i.id !== item.id), nextItem]).get(sid) || { counted: 0, list: [] };
            const ws = U().weekStart(nextItem.day), we = U().addDays(ws, 6);
            const wk = x => x.list.filter(i => i.day >= ws && i.day <= we && i.status === 'counted').length;
            const st = after.list.find(i => i.id === '__new')?.status;
            const tot = rep.counted - before.counted + after.counted;
            box.querySelector('[data-prev]').innerHTML = U().impact([
                ['◷', `${esc(U().shortName(s.name))}: hafta ${wk(before)} → ${wk(after)} / 3 · ${monthGen(month)} ${before.counted} → ${after.counted} / ${CAP}`],
                ['₪', `${esc(U().shortName(assistant?.name || ''))}: ${rep.counted} → ${tot} aloqa · ${money(rep.amount)} → ${money(tot * RATE)} so'm`],
                ['i', st === 'counted' ? 'Yangi yozuv hisoblanadi' : `Yangi yozuv hisoblanmaydi${U().CST[st] ? ' — ' + U().CST[st] : st === 'no_answer' ? ' — javob bermadi' : ''}`],
                ['≡', 'O\'zgarishlar tarixiga yoziladi · yordamchi o\'z ro\'yxatida ko\'radi'],
                ['⊘', `${monthName(month)} yakuniy tasdiqlangandan keyin tuzatish faqat Moliya orqali`]
            ]);
        };
        box.querySelectorAll('select,input').forEach(i => { i.oninput = preview; i.onchange = preview; });
        preview();
        const reason = () => { const r = v('reason'); return r.length >= 5 ? `${r} (asos: ${v('basis')})` : ''; };
        box.querySelector('[data-save]').onclick = async e => {
            const rs = reason();
            if (!rs) return U().errBox(box, 'Sababni yozing (kamida 5 belgi)');
            const ch = v('ch'), no = ch === 'no_answer';
            if (!no && (Number(v('min')) || 0) < 1 && ch !== 'tg_text') return U().errBox(box, 'Davomiylikni daqiqada kiriting');
            const body = { channel: no ? 'phone' : ch, outcome: no ? 'no_answer' : 'contacted', minutes: no ? 0 : Number(v('min')) || 0, at: v('at') || undefined, day: v('day'), reason: rs, requestId: req?.id };
            if (item) body.editId = item.id; else Object.assign(body, { studentId: sid, assistantId: rep.assistantId });
            U().busy(e.target, true);
            try { await U().post('/assist/corrections', body); toast(req ? 'So\'rov tasdiqlandi — aloqa saqlandi' : 'Aloqa tuzatildi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        };
        box.querySelector('[data-del]')?.addEventListener('click', async e => {
            const rs = reason();
            if (!rs) return U().errBox(box, 'O\'chirish sababini yozing (kamida 5 belgi)');
            if (!confirm('Bu aloqa yozuvi o\'chirilsinmi? (tarixda qoladi)')) return;
            U().busy(e.target, true);
            try { await U().post('/assist/corrections', { removeId: item.id, reason: rs }); toast('Aloqa o\'chirildi'); U().closeDrawer(); done(); }
            catch (err) { U().busy(e.target, false); U().errBox(box, err.message); }
        });
        box.querySelector('[data-rej]')?.addEventListener('click', () => { U().closeDrawer(); lateReject(req, done); });
    }

    window.adminNazorat = { renderDavomat, renderMakeups, renderRequests, renderAssist, state: { D, M, R, A } };
})();
