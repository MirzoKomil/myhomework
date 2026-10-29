(function () {
    'use strict';
    let selected = 'main', expanded = '', busy = false, lastError = '';
    const esc = value => escapeHtml(String(value ?? ''));
    // 29-okt: "Yordamchi ustoz sifatida ham" (ikkilamchi rol) o'chirildi — yordamchi alohida lavozim.
    function employeeField() { return ''; }
    function bindEmployee() {}
    function bindAssignment(main, assistant) {
        if (!main || !assistant) return;
        const sync = () => {
            for (const option of assistant.options) option.disabled = !!option.value && option.value === main.value;
            if (teacherRoles.conflict(main.value, assistant.value)) assistant.value = '';
        };
        if (!main.dataset.dualRoleBound) { main.addEventListener('change', sync); main.dataset.dualRoleBound = '1'; }
        assistant.addEventListener('change', sync); sync();
    }
    // Qoplash darslari (school_makeups) — kalendarda "Q" / "×2" belgisi va "Tekshiruvda" soni uchun.
    let mk = { month: '', list: [], loading: false };
    function loadMakeups(month) {
        if (mk.loading || mk.month === month || !window.schoolUI) return;
        mk.loading = true;
        window.schoolUI.api('/makeups').then(r => { mk = { month, list: r.makeups || [], loading: false }; globalThis.__schoolMakeups = mk.list; render(); })
            .catch(() => { mk = { month, list: [], loading: false }; });
    }
    // "Kelmadi" belgilari (server: school_absences) — main_attendance faqat "Keldi"ni saqlaydi.
    let ab = { month: '', list: [], loading: false };
    function loadAbsences(month) {
        if (ab.loading || (ab.month === month && !ab.stale) || !window.schoolUI) return;
        ab.loading = true;
        window.schoolUI.api('/attendance/absences?month=' + month).then(r => { ab = { month, list: r.absences || [], loading: false }; globalThis.__schoolAbsences = { month, list: ab.list }; render(); })
            .catch(() => { ab = { month, list: ab.month === month ? ab.list : [], loading: false }; });
    }
    function withAbsences(block, month, teacherId) {
        if (ab.month !== month || !ab.list.length) return block;
        const out = { ...block };
        for (const a of ab.list) {
            if (a.teacherId !== teacherId) continue;
            const day = Number(String(a.day).slice(8, 10)), cur = { ...(out[a.studentId] || {}) };
            if (cur[day] !== 1 && cur[day] !== true) { cur[day] = 0; out[a.studentId] = cur; }
        }
        return out;
    }
    // Yordamchi aloqalari (bugungi "Aloqani belgilash" qatorlari, "bu hafta n/3") va navbatdagi jonli dars raqami
    // ("Jonli dars avtomatik belgilanadi: N-dars" — server davomatda xuddi shu darsni tanlaydi).
    let as = { month: '', rep: null, loading: false };
    function loadAssist(month) {
        if (as.loading || (as.month === month && !as.stale) || !window.schoolUI) return;
        as.loading = true;
        window.schoolUI.api('/assist/month?month=' + month).then(r => { as = { month, rep: r, loading: false }; render(); })
            .catch(() => { as = { month, rep: as.month === month ? as.rep : null, loading: false }; });
    }
    let py = { data: null, loading: false, at: 0 };
    function loadPay() {
        if (py.loading || (py.data && Date.now() - py.at < 30000) || !window.UstozHome?.myPay) return;
        py.loading = true;
        window.UstozHome.myPay().then(d => { py = { data: d, loading: false, at: Date.now() }; render(); })
            .catch(() => { py = { data: py.data, loading: false, at: Date.now() }; });
    }
    let nx = { key: '', lessons: {}, loading: false };
    function loadNext(ids, day) {
        const key = `${day}|${ids.join(',')}`;
        if (!ids.length || nx.loading || nx.key === key || typeof apiFetch !== 'function') return;
        nx.loading = true;
        apiFetch(`/api/academic/next-lessons?ids=${encodeURIComponent(ids.join(','))}`, { timeout: 30000 })
            .then(r => { nx = { key, lessons: r.lessons || {}, loading: false }; render(); })
            .catch(() => { nx = { key, lessons: {}, loading: false }; });
    }
    // Oy hisobi — bitta manba: js/attendanceRules.js (UstozDavomat "Oktyabr" kartasi, UstozBosh maosh kartasi
    // va server reytingi — server/services/teacherRating.js — shu funksiyani ishlatadi).
    function monthTotals(args) { return window.AttendanceRules.monthTotals(args); }
    let showAll = false, autoOpened = false;
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dkey = v => (v ? String(v).slice(0, 10) : '');
    const ASSIST_FROM = '2026-10';
    const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    // UstozDavomat dizayni: yuqorida "Bugun" + oy hisobi (ikki ustun), pastda "O'quvchilarim davomati" (segment, oy, akkordeon).
    const SVG = {
        up: '<svg class="udv-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
        prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
        next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
        play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
        phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
        undo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'
    };
    const shiftMonth = (m, d) => { const [y, mo] = m.split('-').map(Number), t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };
    const joinVa = a => (a.length > 1 ? `${a.slice(0, -1).join(', ')} va ${a[a.length - 1]}` : a.join(''));
    function render() {
        const root = document.getElementById('mainAttendanceContainer');
        if (!root) return;
        const id = getCurrentUser()?.linkedTeacherId;
        const employee = getItem(STORAGE_KEYS.hrEmployees, []).find(e => e.id === id);
        const isMain = teacherRoles.isMain(employee), all = getItem(STORAGE_KEYS.students, []);
        const hasAssistant = all.some(s => s.assistantTeacherId === id);
        if (!isMain || (!hasAssistant && selected === 'assistant')) selected = isMain ? 'main' : 'assistant';
        if (asstOnly !== !isMain) { asstOnly = !isMain; if (typeof updateRdPageHead === 'function') updateRdPageHead(); }
        const monthInput = document.getElementById('mainAttMonth');
        if (!monthInput.value) monthInput.value = getMonthKey(new Date());
        monthInput.setAttribute('aria-label', 'Davomat oyi');
        monthInput.onchange = () => { if (!busy) { lastError = ''; render(); } };
        root.closest('.card')?.classList.add('teacher-owned-attendance');
        root.closest('#tpAttendance')?.classList.add('teacher-owned-panel');
        document.getElementById('demoStudentSelect')?.closest('.card')?.classList.add('teacher-duty-hidden');
        for (const controlId of ['mainAttTeacher','mainAttPattern','mainAttDuration','mainAttSubjectTabs']) {
            const control = document.getElementById(controlId); if (control) { control.hidden = true; control.classList.add('teacher-duty-hidden'); }
        }
        document.getElementById('mainAttSummary').innerHTML = '';
        document.getElementById('mainAttTitle').textContent = 'Davomat';
        if (!id || !employee) { root.innerHTML = '<p role="alert">Ustoz akkaunti HR profiliga biriktirilmagan. Administratorga murojaat qiling.</p>'; return; }
        const month = monthInput.value;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
        loadMakeups(month);
        loadAbsences(month);
        const field = selected === 'assistant' ? 'assistantTeacherId' : 'teacherId';
        const isActive = s => window.AttendanceRules.isActiveStudent(s);
        const students = all.filter(s => s[field] === id && isActive(s));
        const mainStudents = all.filter(s => s.teacherId === id && isActive(s));
        const helpedStudents = all.filter(s => s.assistantTeacherId === id && isActive(s));
        const mainStore = getItem(STORAGE_KEYS.mainAttendance, {});
        const mainAtt = withAbsences(mainStore[`${month}_${id}`] || {}, month, id);
        const attendance = selected === 'main' ? mainAtt : (getItem(STORAGE_KEYS.assistantAttendance, {})[`${month}_${id}`] || {});
        const ownTeacher = resolveTeacherWithVirtual(id) || {};
        const calendar = teacherAttendanceCalendar;
        if (!students.some(s => s.id === expanded)) expanded = '';
        // Dizayndagidek: sahifa ochilganda birinchi o'quvchining kalendari ochiq turadi (bir marta).
        if (!autoOpened && selected === 'main' && students.length) { autoOpened = true; if (!expanded) expanded = students[0].id; }
        const nowT = new Date(Date.now() + 5 * 3600000); // Asia/Tashkent
        const today = nowT.toISOString().slice(0, 10), thisMonth = today.slice(0, 7), todayDay = Number(today.slice(8));
        const nowMin = nowT.getUTCHours() * 60 + nowT.getUTCMinutes();
        const todayDow = nowT.getUTCDay() || 7;
        const past = c => month < thisMonth || (month === thisMonth && c.day <= todayDay);
        const expectedFor = (s, role = selected) => calendar.cells(month, calendar.weekdays(s, ownTeacher, role)).filter(c => c && c.scheduled && past(c)).length;
        const planFor = (s, role = 'main') => calendar.cells(month, calendar.weekdays(s, ownTeacher, role)).filter(c => c && c.scheduled).length;
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        const U = window.schoolUI;
        const avatar = (s, n = 36) => (U ? U.studentAvatar(s, n) : '');
        const sched = s => `${U ? U.pattern(s.lessonDayOfWeek) : ''}${s.lessonTime ? ' ' + esc(s.lessonTime) : ''}${s.lessonDuration ? ' · ' + Number(s.lessonDuration) + ' daq' : ''}`;
        const myMk = mk.month === month ? mk.list.filter(m => m.teacher_id === id && ['planned', 'review', 'approved'].includes(m.status)) : [];
        const mkOn = (sid, date) => myMk.find(m => m.student_id === sid && dkey(m.held_date) === date);
        const mkFor = sid => myMk.filter(m => m.student_id === sid && dkey(m.held_date).slice(0, 7) === month);
        const coveredMissed = sid => new Set(myMk.filter(m => m.student_id === sid).map(m => dkey(m.missed_date)));
        // Hisobga o'tgan darslar — moliya bilan bir xil: 2026-10 dan dars kunidagi "Keldi" + tasdiqlangan qoplash.
        const countedFor = s => monthTotals({ id, month, students: [s], mainAtt, makeups: mk.month === month ? mk.list : [], teacher: ownTeacher, todayKey: today }).counted;
        // Qoplanmagan (kelmagan, qoplash yo'q) darslar — kalendar oynasi va bugungi "Keldi · 2 dars" uchun.
        const openMissedFor = sid => {
            const entries = mainAtt[sid] || {}, covered = coveredMissed(sid);
            return Object.entries(entries).filter(([, v]) => calendar.status(v) === 'absent')
                .map(([d]) => `${month}-${String(d).padStart(2, '0')}`).filter(d => !covered.has(d)).sort();
        };
        const dm = d => `${Number(d.slice(8))}-${MON3[Number(d.slice(5, 7)) - 1]}`;
        const [yy, mm] = month.split('-').map(Number), MN = MONTHS[mm - 1];
        const canStart = !!window.LessonStart && isMain;
        const startBtn = (s, label) => canStart ? `<button type="button" class="udv-btn is-pri" data-duty-start="${esc(s.id)}">${SVG.play}${label}</button>` : '';
        const monthPicker = `<div class="udv-mon" role="group" aria-label="Oy"><button type="button" data-udv-mon="-1" aria-label="Oldingi oy">${SVG.prev}</button><span>${esc(MN)} ${yy}</span><button type="button" data-udv-mon="1" aria-label="Keyingi oy"${month >= thisMonth ? ' disabled' : ''}>${SVG.next}</button></div>`;
        const bindMonth = () => root.querySelectorAll('[data-udv-mon]').forEach(b => { b.onclick = () => {
            if (busy || b.disabled) return;
            monthInput.value = shiftMonth(month, Number(b.dataset.udvMon)); lastError = ''; expanded = ''; showAll = false; render();
        }; });

        // ── Bugun (asosiy ustozlik): dars bo'ldimi — Keldi / Keldi · 2 dars / Kelmadi; yordamchi aloqasi ──
        let todayHtml = '';
        if (isMain && month === thisMonth) {
            const list = mainStudents.filter(s => calendar.weekdays(s, ownTeacher, 'main').includes(todayDow))
                .sort((a, b) => (toMin(a.lessonTime) ?? 9999) - (toMin(b.lessonTime) ?? 9999));
            const adviceDays = s => ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]);
            const contactList = helpedStudents.filter(s => s.lessonDayOfWeek != null && adviceDays(s).includes(todayDow));
            const contacts = contactList.length;
            if (contacts) loadAssist(month);
            loadNext(list.map(s => s.id), today);
            const next = list.find(s => (toMin(s.lessonTime) ?? -1) > nowMin && calendar.status((mainAtt[s.id] || {})[todayDay]) === 'empty');
            const unmarked = list.filter(s => { const st = toMin(s.lessonTime); return calendar.status((mainAtt[s.id] || {})[todayDay]) === 'empty' && st != null && nowMin >= st + (Number(s.lessonDuration) || 15); }).length;
            const liveNo = sid => nx.lessons[sid]?.nextLive?.no || null;
            const repBy = new Map((as.month === month && as.rep ? as.rep.students || [] : []).map(x => [x.studentId, x]));
            const ws = U ? U.weekStart(today) : today;
            const rows = list.map(s => {
                const st = calendar.status((mainAtt[s.id] || {})[todayDay]);
                const start = toMin(s.lessonTime), started = start == null || nowMin >= start;
                const ended = start != null && nowMin >= start + (Number(s.lessonDuration) || 15);
                const live = st === 'present' ? (getItem(STORAGE_KEYS.liveGrades, {})[s.id] || []).find(g => g && g.date === today && g.teacherId === id) : null;
                const open = st === 'empty' && month >= '2026-10' ? openMissedFor(s.id).filter(d => d < today) : [];
                const planned = myMk.filter(m => m.student_id === s.id && m.status === 'planned' && dkey(m.missed_date).slice(0, 7) === month && dkey(m.held_date) > today);
                const missTxt = open.length || planned.length ? ` · <span class="udv-mk-txt">${open.length ? `qoplanmagan: ${open.map(dm).join(', ')}` : ''}${open.length && planned.length ? ' · ' : ''}${planned.map(m => `${dm(dkey(m.missed_date))} → ${DAYS[(new Date(dkey(m.held_date) + 'T00:00:00Z').getUTCDay() || 7) - 1]} ${Number(dkey(m.held_date).slice(8))} rejada`).join(', ')}</span>` : '';
                const isNext = next && next.id === s.id;
                const no = liveNo(s.id);
                const sub = `${s.lessonDuration ? Number(s.lessonDuration) + ' daq · ' : ''}asosiy${st === 'empty' && ended ? ' · dars tugagan' : ''}${(isNext || (started && !ended && st === 'empty')) && no ? ` · ${no}-dars, jonli` : ''}${missTxt}`;
                let action, ask = '';
                if (st === 'present') action = `<span class="udv-pill is-ok">Keldi${live?.lessonName ? ` · ${esc(live.lessonName)}` : ''}</span><button type="button" class="udv-btn" data-duty-today="${esc(s.id)}">O‘zgartirish</button>`;
                else if (st === 'absent') action = `<span class="udv-pill is-bad">Kelmadi</span><button type="button" class="udv-btn" data-duty-today="${esc(s.id)}">O‘zgartirish</button>`;
                else if (started) {
                    action = ended ? '<span class="udv-pill is-warn">Belgilanmagan</span>' : `<span class="udv-pill is-info"><span class="udv-live"></span>Hozir</span>${startBtn(s, 'Darsni boshlash')}`;
                    ask = `<div class="udv-mark" role="group" aria-label="${esc(s.name)} davomatini belgilash"><span class="udv-ml">Dars bo‘ldimi?</span><span class="udv-opt">
                        <button type="button" class="udv-ob is-pri" data-duty-quick="1" data-sid="${esc(s.id)}">Keldi</button>
                        ${open.length ? `<button type="button" class="udv-ob" data-duty-double="${esc(s.id)}" title="Qoplanmagan dars o'rniga: ${open.length === 1 ? dm(open[0]) : 'tanlaysiz'}">Keldi · 2 dars</button>` : ''}
                        <button type="button" class="udv-ob" data-duty-quick="0" data-sid="${esc(s.id)}">Kelmadi</button></span>
                        ${no ? `<span class="udv-mt udv-auto">Jonli dars avtomatik belgilanadi: ${no}-dars</span>` : ''}</div>`;
                } else action = isNext && canStart ? startBtn(s, 'Darsni boshlash') : '<span class="udv-pill is-mute">Kutilmoqda</span>';
                const tm = st === 'present' ? ' is-done' : st === 'absent' ? ' is-bad' : st === 'empty' && ended ? ' is-warn' : '';
                return { t: start ?? 9999, html: `<div class="udv-ls${ask ? ' has-mark' : ''}${isNext ? ' is-next' : ''}"><span class="udv-tm${tm}">${esc(s.lessonTime || '—')}</span><div class="udv-inf"><div class="udv-nm">${esc(s.name)}</div><div class="udv-mt">${sub}</div></div><div class="udv-acts">${action}</div>${ask}</div>` };
            });
            // Yordamchi aloqasi qatorlari (tavsiya — dars kuniga teskari kunlarda): "Aloqani belgilash" — yordamchi aloqa oynasi.
            for (const s of contactList) {
                const r = repBy.get(s.id), items = r?.items || [];
                const todayItems = items.filter(i => i.day === today);
                const done = todayItems.some(i => i.outcome !== 'no_answer'), na = !done && todayItems.some(i => i.outcome === 'no_answer');
                const wk = items.filter(i => i.day >= ws && i.status === 'counted').length;
                const tname = U?.teacherName ? U.teacherName(s.teacherId, true) : (teachers.find(t => t.id === s.teacherId)?.name || '—');
                const call = window.schoolTeacher?.callStudent ? `<button type="button" class="udv-clb" data-duty-call="${esc(s.id)}" title="Qo'ng'iroq qilish — Telegram guruh orqali" aria-label="${esc(s.name)}ga qo'ng'iroq qilish">${SVG.phone}</button>` : '';
                const action = done ? '<span class="udv-pill is-ok">Aloqa belgilandi</span>'
                    : `${na ? '<span class="udv-pill is-warn">Javob bermadi</span>' : ''}${call}<button type="button" class="udv-btn" data-duty-contact="${esc(s.id)}">${na ? 'Qayta urinish' : 'Aloqani belgilash'}</button>`;
                rows.push({ t: toMin(s.lessonTime) ?? 9999, html: `<div class="udv-ls is-contact"><span class="udv-tm">${esc(s.lessonTime || '—')}</span><div class="udv-inf"><div class="udv-nm">${esc(s.name)}</div><div class="udv-mt">yordamchi aloqasi · tavsiya · asosiy ustoz ${esc(tname)}${r || as.month === month ? ` · bu hafta ${wk}/3` : ''}</div></div><div class="udv-acts">${action}</div></div>` });
            }
            rows.sort((a, b) => a.t - b.t);
            const left = next ? toMin(next.lessonTime) - nowMin : 0;
            const leftTxt = left >= 60 ? `${Math.floor(left / 60)} soat${left % 60 ? ' ' + (left % 60) + ' daqiqa' : ''}` : `${left} daqiqa`;
            todayHtml = `<section class="udv-card udv-today" aria-labelledby="udvTodayTitle"><div class="udv-ch"><h2 class="udv-ct" id="udvTodayTitle">Bugun · ${list.length} dars${contacts ? ` + ${contacts} aloqa` : ''}</h2>
                <div class="udv-row">${next ? `<span class="udv-pill is-info"><span class="udv-live"></span>Keyingi: ${esc(next.lessonTime)} · ${leftTxt}dan keyin</span>` : ''}${unmarked ? `<span class="udv-pill is-warn">${unmarked} tasi belgilanmagan</span>` : ''}</div></div>
                ${rows.length ? rows.map(r => r.html).join('') : `<p class="udv-empty">Bugun (${esc(DAYS[todayDow - 1])}) darsingiz yo‘q.</p>`}</section>`;
        }

        // ── Oy hisobi (asosiy ustozlik) ──
        let sumHtml = '';
        if (isMain) {
            const T = monthTotals({ id, month, students: mainStudents, mainAtt, makeups: mk.month === month ? mk.list : [], teacher: ownTeacher, todayKey: today });
            const { plan, counted, pct } = T;
            // Sidebar "Akademik bo'lim" soni shu raqam bilan bir xil (js/staffNavBadges.js).
            if (month === thisMonth && ab.month === month && mk.month === month) window.dispatchEvent(new CustomEvent('ustoz:month-unmarked', { detail: { month, n: T.unmarked } }));
            // Maosh — server payroll (/api/payroll/me), Bosh sahifa va "Mening maoshim" bilan bitta manba. Faqat joriy oy.
            if (month === thisMonth) loadPay();
            const pay = month === thisMonth && py.data?.linked && py.data.current ? Number(py.data.current.mainTotal ?? py.data.current.total) || 0 : null;
            const review = myMk.filter(m => m.status === 'review').length;
            sumHtml = `<section class="udv-card udv-sum" aria-label="${esc(MN)} hisobi">
                <div class="udv-sr"><span class="udv-ct">${esc(MN)}</span><span class="udv-mt">${month === thisMonth ? todayDay + ' kun o‘tdi' : month < thisMonth ? 'yopilgan oy' : 'kelgusi oy'}</span></div>
                <div><div class="udv-sr"><span class="udv-sl">Hisobga o‘tdi</span><span class="udv-sv">${counted} / ${plan}</span></div><div class="udv-trk" role="img" aria-label="${counted} / ${plan}"><span style="width:${plan ? Math.min(100, Math.round(counted / plan * 100)) : 0}%"></span></div></div>
                <div class="udv-sr"><span class="udv-sl">Davomat</span><span class="udv-sv">${pct == null ? '—' : pct + '%'}</span></div>
                ${pay != null ? `<div class="udv-sr"><span class="udv-sl">Maosh · asosiy ustozlik</span><span class="udv-sv is-ok udv-nw">${esc(formatMoney(pay))}</span></div>` : ''}
                <div class="udv-sr"><span class="udv-sl">Tekshiruvda</span><span class="udv-sv is-teal udv-sv--sm">${review} qoplash</span></div>
                <p class="udv-small">Belgilangan davomat bo‘yicha hisoblanadi. Oy yopilganda Moliya tasdiqlaydi.</p></section>`;
        }

        const oldAssist = selected === 'assistant' && month < ASSIST_FROM;
        const seg = isMain && hasAssistant ? `<div class="udv-seg" role="group" aria-label="Davomat turi">
            <button type="button" data-duty="main" aria-pressed="${selected === 'main'}">Asosiy ustozlik <b>${mainStudents.length}</b></button>
            <button type="button" data-duty="assistant" aria-pressed="${selected === 'assistant'}">Yordamchi ustozlik <b>${helpedStudents.length}</b></button></div>` : '';
        const top = isMain ? `<div class="udv-top${todayHtml ? '' : ' is-solo'}">${todayHtml}${sumHtml}</div>` : '';
        const myHead = `<div class="udv-ch"><h2 class="udv-ct" id="udvMyTitle">O‘quvchilarim davomati</h2><div class="udv-row">${seg}${monthPicker}</div></div>`;
        const bindSeg = () => root.querySelectorAll('[data-duty]').forEach(button => { button.onclick = () => { if (!busy && selected !== button.dataset.duty) { selected = button.dataset.duty; lastError = ''; expanded = ''; showAll = false; render(); } }; });

        // Yordamchi ustozlik oktyabrdan aloqalar bo'yicha — "Aloqalar" sahifasining o'zi shu yerda ochiladi.
        if (selected === 'assistant' && !oldAssist) {
            root.innerHTML = isMain
                ? `<div class="udv">${top}<section class="udv-card udv-my" aria-labelledby="udvMyTitle">${myHead}<div class="udv-contacts" data-duty-contacts></div></section></div>`
                // YordamchiDavomat dizaynida oy tanlagich yo'q (yopilgan oylar — Bosh sahifadagi oy almashtirgichda);
                // faqat boshqa oy ochiq qolgan bo'lsa, joriy oyga qaytish uchun ko'rinadi.
                : `<div class="udv udv--asst">${month !== thisMonth ? `<div class="udv-bar">${monthPicker}</div>` : ''}<div data-duty-contacts></div></div>`;
            const box = root.querySelector('[data-duty-contacts]'); box.dataset.month = month; box.dataset.embedded = '1';
            window.schoolTeacher?.renderContacts(box);
            bindSeg(); bindMonth(); bindToday();
            return;
        }

        // "Yana N ta o'quvchi": dastlab 4 ta; ochiq (expanded) o'quvchi pastda bo'lsa — hammasi.
        const CARD_LIMIT = 4;
        const showAllCards = showAll || students.length <= CARD_LIMIT + 1 || students.findIndex(s => s.id === expanded) >= CARD_LIMIT;
        const legend = selected === 'main'
            ? '<span><i class="lg-ok"></i>Keldi</span><span><i class="lg-no"></i>Kelmadi</span><span><i class="lg-pl"></i>Rejadagi kun</span><span><i class="lg-x"></i>Dars kuni emas</span><span><i class="lg-q"></i>Qoplash darsi</span><span><i class="lg-q is-rev"></i>Tekshiruvda</span><span><b>×2</b> Qo‘shaloq dars</span><span><i class="lg-no"></i>• keyin qoplandi</span>'
            : '<span><i class="lg-pl"></i>Rejadagi kun</span><span><i class="lg-ok"></i>Qatnashdi</span><span><i class="lg-no"></i>Kelmadi</span>';
        const rowsHtml = students.map((s, index) => {
            if (index >= CARD_LIMIT && !showAllCards) return '';
            const entries = attendance[s.id] || {}, panelId = `teacherDutyCalendar${index}`;
            const cells = calendar.cells(month, calendar.weekdays(s, ownTeacher, selected));
            const present = Object.values(entries).filter(v => calendar.status(v) === 'present').length;
            const absentDays = cells.filter(c => c && calendar.status(entries[c.day]) === 'absent').map(c => c.date);
            const sm = selected === 'main' ? mkFor(s.id) : [], covered = selected === 'main' ? coveredMissed(s.id) : new Set();
            const approvedMk = sm.filter(m => m.status === 'approved');
            const reviewMk = sm.filter(m => m.status === 'review'), reviewN = reviewMk.length;
            const openMissed = absentDays.filter(d => !covered.has(d));
            const coveredAbs = absentDays.filter(d => covered.has(d));
            const reviewMissed = new Set(reviewMk.map(m => dkey(m.missed_date)));
            const plan = selected === 'main' ? planFor(s) : expectedFor(s);
            const counted = selected === 'main' ? countedFor(s) : present;
            const exp = expectedFor(s);
            const bad = exp >= 3 && counted / exp < 0.6;
            const open = expanded === s.id;
            const head = `<button type="button" class="udv-acc" data-duty-expand="${esc(s.id)}" aria-expanded="${open}" aria-controls="${panelId}">
                <span class="udv-avw">${avatar(s, 36)}</span><span class="udv-who"><span class="udv-nm">${esc(s.name)}</span><span class="udv-mt">${selected === 'main' ? sched(s) : 'asosiy ustoz: ' + esc(teachers.find(t => t.id === s.teacherId)?.name || '—')}</span></span>
                <span class="udv-cnts"><span class="udv-cnt${bad ? ' is-bad' : ''}">${counted} / ${plan} dars${reviewN ? ` <small>+${reviewN}</small>` : ''}</span><span class="udv-trk${bad ? ' is-bad' : ''}"><span style="width:${plan ? Math.min(100, Math.round(counted / plan * 100)) : 0}%"></span></span>${SVG.up}</span></button>`;
            const grid = cells.map(cell => {
                if (!cell) return '<span class="udv-d is-e" aria-hidden="true"></span>';
                const state = calendar.status(entries[cell.day]);
                const m = selected === 'main' ? mkOn(s.id, cell.date) : null;
                const label = state === 'present' ? 'Keldi' : state === 'absent' ? 'Kelmadi' : m ? 'Qoplash darsi' : 'Belgilanmagan';
                const late = state === 'absent' && covered.has(cell.date);
                const cls = state === 'present' ? ' is-ok' : state === 'absent' ? ' is-no' : m ? ' is-q' + (m.status === 'review' ? ' is-rev' : '')
                    : !cell.scheduled ? ' is-x' : cell.date > today ? ' is-pl' : '';
                return `<button type="button" class="udv-d${cls}${cell.scheduled ? ' duty-scheduled' : ' duty-offday'}${m ? ' duty-has-mk' + (m.status === 'review' ? ' is-review' : '') : ''}${late ? ' is-cv' : ''}${cell.date === today ? ' is-td' : ''}" data-duty-student="${esc(s.id)}" data-duty-day="${cell.day}" data-status="${state}" aria-label="${cell.day}-${MON3[mm - 1]}: ${label}${cell.scheduled ? '' : ', dars kuni emas'}${m?.status === 'review' ? ', tekshiruvda' : ''}${late ? ', keyin qoplandi' : ''}${cell.date === today ? ', bugun' : ''}" aria-pressed="${state === 'present'}"><time datetime="${cell.date}">${cell.day}</time>${m?.kind === 'double' ? '<sup>×2</sup>' : ''}</button>`;
            }).join('');
            const mon = MON3[mm - 1];
            const csum = selected !== 'main' ? '' : `<div class="udv-csum">
                <div class="udv-cs"><span class="udv-sl">Hisobga o‘tdi</span><span class="udv-sv is-ok">${counted} <small>/ ${plan} · ${present} keldi${approvedMk.length ? ` + ${approvedMk.length} qoplash` : ''}${reviewN ? ` · +${reviewN} tekshiruvda` : ''}</small></span></div>
                <div class="udv-cs"><span class="udv-sl">Kelmadi</span><span class="udv-sv is-bad">${absentDays.length} <small>${coveredAbs.length ? `· ${[coveredAbs.filter(d => !reviewMissed.has(d)).length ? coveredAbs.filter(d => !reviewMissed.has(d)).length + ' qoplandi' : '', coveredAbs.filter(d => reviewMissed.has(d)).length ? coveredAbs.filter(d => reviewMissed.has(d)).length + ' tekshiruvda' : ''].filter(Boolean).join(' + ')}` : ''}</small></span></div>
                <div class="udv-cs"><span class="udv-sl">Qoplash mumkin</span><span class="udv-sv is-teal">${month === thisMonth ? openMissed.length : '—'} <small>${month === thisMonth && openMissed.length ? '· ' + joinVa(openMissed.map(d => Number(d.slice(8)))) + '-' + mon : month !== thisMonth ? 'faqat shu oy ichida' : ''}</small></span></div>
                <div class="udv-cs"><span class="udv-sl">Tekshiruvda</span><span class="udv-sv is-teal">${reviewN} <small>${reviewN ? 'qoplash · ' + joinVa(reviewMk.map(m => Number(dkey(m.held_date).slice(8)))) + '-' + mon : ''}</small></span></div></div>`;
            return `${head}<div id="${panelId}" class="udv-cal" ${open ? '' : 'hidden'}><div class="udv-calw"><div class="udv-cg" role="group" aria-label="${esc(s.name)}, ${esc(MN.toLowerCase())} ${yy}">${DAYS.map(d => `<span class="udv-h">${d}</span>`).join('')}${grid}</div>${csum}</div></div>`;
        }).join('');
        const more = !showAllCards && students.length > CARD_LIMIT ? `<button type="button" class="udv-acc udv-more" data-duty-more><span class="udv-av">+${students.length - CARD_LIMIT}</span><span class="udv-who"><span class="udv-nm">Yana ${students.length - CARD_LIMIT} ta o‘quvchi</span><span class="udv-mt">${esc(students.slice(CARD_LIMIT).map(s => String(s.name || '').split(' ')[0]).join(', '))}</span></span></button>` : '';
        const myCard = `<section class="udv-card udv-my" aria-labelledby="udvMyTitle">${myHead}
            <div class="udv-help"><span>${oldAssist ? 'Bu oy maoshi eski yordamchi davomati bo‘yicha.' : 'Dars kunini bosib davomat qo‘ying. Qayta bossangiz — o‘zgartirasiz yoki olib tashlaysiz.'}</span><div class="udv-leg">${legend}</div></div>
            <div class="udv-list" role="region" aria-label="O'quvchilar">${rowsHtml || '<p class="udv-empty">Bu rolda faol o‘quvchilar biriktirilmagan.</p>'}${more}</div></section>`;
        const note = selected === 'main' ? `<div class="udv-note">${SVG.undo}<div><b>Qoldirilgan darsni qoplash.</b> O‘quvchi kelmagan darsni shu oy ichida o‘tib bersangiz, maoshingizga hisoblanadi: dars kuni bo‘lmagan kunni bosib <b>"Qoplash darsi"</b> qo‘ying yoki keyingi darsda <b>"Keldi · 2 dars"</b> ni tanlang (qo‘shaloq dars). Qoplash admin tasdig‘idan keyin o‘tadi. Oyiga rejadagi darslardan ortiq hisoblanmaydi.</div></div>` : '';
        root.innerHTML = `<div class="udv">${top}${myCard}${note}<p class="udv-err" data-duty-error role="alert">${esc(lastError)}</p></div>`;
        bindSeg(); bindMonth(); bindToday();
        root.querySelectorAll('[data-duty-expand]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const opened = button.getAttribute('aria-expanded') !== 'true';
            expanded = opened ? button.dataset.dutyExpand : '';
            root.querySelectorAll('[data-duty-expand]').forEach(b => {
                const active = opened && b === button;
                b.setAttribute('aria-expanded', String(active));
                document.getElementById(b.getAttribute('aria-controls')).hidden = !active;
            });
        }; });
        root.querySelectorAll('[data-duty-student]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const role = selected, student = students.find(s => s.id === button.dataset.dutyStudent);
            const date = `${month}-${String(button.dataset.dutyDay).padStart(2, '0')}`;
            const status = button.dataset.status, offday = button.classList.contains('duty-offday');
            const missed = role === 'main' && month >= '2026-10' && month >= today.slice(0, 7) && date <= today && !button.classList.contains('duty-has-mk') ? openMissedFor(student.id).filter(d => d < date) : []; // qoplash faqat qoldirilgan darsdan keyin
            // Kun oynasi — dizayndagi oyna uslubi (Oynalar · .dlg → schoolUI.openDialog / .oqm-*), sarlavhada o'zbekcha sana.
            const UI = window.schoolUI;
            const dayOf = d => (UI?.DAY_FULL && UI.wd ? UI.DAY_FULL[UI.wd(d) - 1] : '');
            const dLabel = d => `${Number(d.slice(8))}-${MON3[Number(d.slice(5, 7)) - 1]}`, title = `${dLabel(date)}${dayOf(date) ? ', ' + dayOf(date) : ''}`;
            const STATE = { present: ['Keldi', 'is-ok'], absent: ['Kelmadi', 'is-no'], empty: ['Belgilanmagan', 'is-mute'] }[status] || ['Belgilanmagan', 'is-mute'];
            const pick = missed.length ? `<div class="oqm-fl">Qaysi qoldirilgan dars o'rniga?</div>${missed.map((d, i) => `<label class="oqm-opt"><input type="radio" name="dutyMissed" value="${d}"${i === 0 ? ' checked' : ''}><span class="oqm-radio" aria-hidden="true"></span><span class="oqm-tx"><span class="oqm-nm">${dLabel(d)}${dayOf(d) ? ', ' + esc(dayOf(d)) : ''}</span><span class="oqm-mt">kelmagan · hali qoplanmagan</span></span><span class="oqm-pill is-teal">Qoplash mumkin</span></label>`).join('')}` : '';
            const mkButtons = !missed.length ? '' : offday
                ? '<button type="button" class="oqm-btn is-pri" id="dutyMkSep">Qoplash darsi o‘tildi</button>'
                : '<button type="button" class="oqm-btn" id="dutyMkDouble">Keldi · 2 dars</button>';
            // Kelajak sanaga va yopilgan (o'tgan) oyga ustoz davomat qo'ymaydi — server ham rad etadi (recordTeacherAttendance).
            const futureDay = date > today, closedMonth = month < today.slice(0, 7);
            const note = closedMonth ? 'Oy yopilgan — davomatni endi admin orqali tuzatish mumkin.' : futureDay ? 'Bu kun hali kelmagan — davomat dars kuni qo‘yiladi.'
                : role === 'main' && offday && month >= '2026-10'
                ? 'Bu kun dars kuni emas. Maoshga faqat qoplash darsi sifatida, admin tasdig‘idan keyin o‘tadi.'
                : role === 'main' && offday ? 'Bu kun dars kuni emas.' : '';
            const noMark = (role === 'main' && offday && month >= '2026-10') || futureDay || closedMonth;
            const body = `<div class="oqm-box udv-dlg-st">Hozirgi holat: <span class="oqm-pill ${STATE[1]}">${STATE[0]}</span>${status !== 'empty' && !closedMonth ? '<button type="button" class="oqm-link" id="dutyRemove">Belgini olib tashlash</button>' : ''}</div>${pick}<div class="oqm-rule">${note ? esc(note) + ' ' : ''}${futureDay || closedMonth ? '' : noMark && !missed.length ? 'Bu oyda qoplanmagan dars yo‘q.' : 'Shu kundagi davomatni tanlang.'}</div>`;
            const foot = `<button type="button" class="oqm-btn" id="dutyCancel" data-close>Bekor</button>
                ${noMark ? '' : '<button type="button" class="oqm-btn" id="dutyAbsent">Kelmadi</button>'}
                ${mkButtons}
                ${noMark ? '' : `<button type="button" class="oqm-btn is-pri" id="dutyPresent">${role === 'main' ? 'Keldi' : 'Qatnashdi'}</button>`}`;
            const close = () => (UI?.closeDrawer ? UI.closeDrawer() : closeModal());
            const dlg = UI?.openDialog ? UI.openDialog({ title, sub: `${esc(student.name)} · ${sched(student)}`, body, foot }) : null;
            if (!dlg) openModal(`${student.name} — ${title}`, body, `<div class="teacher-duty-actions">${foot}</div>`);
            const scope = dlg || document;
            const on = (id, fn) => { const el = scope.querySelector('#' + id); if (el) el.onclick = fn; };
            const chosen = () => scope.querySelector('input[name="dutyMissed"]:checked')?.value;
            on('dutyPresent', () => { close(); if (role === 'main') grade(student, date); else save(student, date, true, undefined, role); });
            on('dutyAbsent', () => { close(); save(student, date, false, undefined, role); });
            on('dutyRemove', () => { close(); save(student, date, null, undefined, role); });
            on('dutyMkSep', () => { const m = chosen(); close(); makeup('separate', student, date, m); });
            on('dutyMkDouble', () => { const m = chosen(); close();
                const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === date && g.teacherId === id);
                _openLiveGradeModal(student.name, date, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                    async g => { await save(student, date, true, g, 'main'); if (!lastError) makeup('double', student, date, m); }, () => {}, previous); });
            on('dutyCancel', close);
        }; });
        root.querySelector('[data-duty-more]')?.addEventListener('click', () => { showAll = true; render(); });
        if (busy) root.querySelectorAll('button').forEach(button => { button.disabled = true; });

        function save(student, date, present, grade, role = selected) {
            if (busy) return Promise.resolve();
            busy = true; lastError = ''; monthInput.disabled = true;
            root.querySelectorAll('button').forEach(b => { b.disabled = true; });
            return saveTeacherAttendanceChange({ teacherId: id, studentId: student.id, date, present, attendanceType: role, grade })
                .catch(err => { lastError = err.message; })
                .finally(() => { busy = false; monthInput.disabled = false; ab.stale = true; globalThis.__schoolAbsences = null; render(); });
        }
        function grade(student, date) {
            const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === date && g.teacherId === id);
            _openLiveGradeModal(student.name, date, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                g => save(student, date, true, g, 'main'), () => {}, previous);
        }
        // Qoplash (2026-10 dan maoshga faqat admin tasdig'i bilan): dars kuni bo'lmagan kunda — "Qoplash darsi",
        // dars kunida — "Keldi · 2 dars" (qo'shaloq). Qaysi qoldirilgan dars qoplanayotgani tanlanadi.
        async function makeup(kind, student, date, missedDate) {
            if (busy) return;
            busy = true; lastError = '';
            try { await window.schoolUI.post(`/makeups/${kind}`, { studentId: student.id, missedDate, heldDate: date }); mk.month = ''; window.schoolUI.toast('Qoplash tekshiruvga yuborildi'); }
            catch (err) { lastError = err.message; }
            finally { busy = false; }
            render();
        }
        // Bugungi qatorlar (doim asosiy ustozlik): O'zgartirish, Keldi/Kelmadi, "Darsni boshlash", "Keldi · 2 dars", yordamchi aloqasi.
        function bindToday() {
            const goDay = sid => {
                if (selected !== 'main' || expanded !== sid) { selected = 'main'; expanded = sid; showAll = true; render(); }
                document.getElementById('mainAttendanceContainer')?.querySelector(`[data-duty-student="${CSS.escape(sid)}"][data-duty-day="${todayDay}"]`)?.click();
            };
            root.querySelectorAll('[data-duty-today]').forEach(button => { button.onclick = () => goDay(button.dataset.dutyToday); });
            root.querySelectorAll('[data-duty-quick]').forEach(button => { button.onclick = () => {
                const student = mainStudents.find(s => s.id === button.dataset.sid); if (!student) return;
                if (button.dataset.dutyQuick === '1') grade(student, today); else save(student, today, false, undefined, 'main');
            }; });
            root.querySelectorAll('[data-duty-start]').forEach(button => { button.onclick = () => {
                const student = mainStudents.find(s => s.id === button.dataset.dutyStart); if (!student || !window.LessonStart) return;
                window.LessonStart.start({ studentId: student.id, studentName: student.name, duration: Number(student.lessonDuration) || null })
                    .catch(err => { lastError = err.message; render(); });
            }; });
            root.querySelectorAll('[data-duty-double]').forEach(button => { button.onclick = () => {
                if (busy) return;
                const student = mainStudents.find(s => s.id === button.dataset.dutyDouble); if (!student) return;
                const open = openMissedFor(student.id).filter(d => d < today); // qoldirilgan darsdan keyin
                // Bir nechta qoplanmagan dars — kalendar oynasida qaysi biri qoplanishini tanlaydi ("Keldi · 2 dars" tugmasi o'sha yerda).
                if (open.length !== 1) return goDay(student.id);
                const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === today && g.teacherId === id);
                _openLiveGradeModal(student.name, today, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                    async g => { await save(student, today, true, g, 'main'); if (!lastError) makeup('double', student, today, open[0]); }, () => {}, previous);
            }; });
            root.querySelectorAll('[data-duty-contact]').forEach(button => { button.onclick = () => {
                const student = helpedStudents.find(s => s.id === button.dataset.dutyContact);
                if (student && window.schoolTeacher?.markDrawer) window.schoolTeacher.markDrawer(student, () => { as.stale = true; render(); });
            }; });
            root.querySelectorAll('[data-duty-call]').forEach(button => { button.onclick = () => {
                const student = helpedStudents.find(s => s.id === button.dataset.dutyCall);
                if (student) window.schoolTeacher.callStudent(student, () => { as.stale = true; render(); });
            }; });
        }
    }
    // Yordamchi ustoz (asosiy o'quvchisi yo'q) Davomati — sarlavha izohi dizayndagidek (YordamchiDavomat).
    let asstOnly = false;
    window.rdPageSub = (tab, section) => (tab === 'teachers-section' && section === 'Davomat' && asstOnly
        ? 'Yordamchi ustoz · Davomat · har o‘quvchi bilan haftasiga 3 ta aloqa, kamida 5 daqiqa' : null);
    // UstozBosh (js/ustozHome.js) uchun: "Kelmadi" ro'yxatini davomat blokiga qo'shish va oy hisobi.
    function mergeAbsences(block, list, teacherId) {
        const out = { ...block };
        for (const a of list || []) {
            if (a.teacherId !== teacherId) continue;
            const day = Number(String(a.day).slice(8, 10)), cur = { ...(out[a.studentId] || {}) };
            if (cur[day] !== 1 && cur[day] !== true) { cur[day] = 0; out[a.studentId] = cur; }
        }
        return out;
    }
    // Boshqa sahifadan (O'quvchini tekshirish → "Davomat kalendari") aniq o'quvchining kalendarini ochish.
    function focus(studentId) {
        selected = 'main'; expanded = String(studentId || ''); showAll = true; autoOpened = true; lastError = '';
        const mi = document.getElementById('mainAttMonth');
        if (mi && !busy) mi.value = getMonthKey(new Date());
    }
    function revealFocused() {
        if (!expanded) return;
        const b = document.querySelector(`#mainAttendanceContainer [data-duty-expand="${CSS.escape(expanded)}"]`);
        b?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    window.teacherDutyUI = { employeeField, bindEmployee, bindAssignment, render, monthTotals, mergeAbsences, focus, revealFocused };
}());
