(function () {
    'use strict';
    let selected = 'main', expanded = '', busy = false, lastError = '';
    const esc = value => escapeHtml(String(value ?? ''));
    function employeeField(checked = false) {
        return `<div class="form-group" id="employeeDualRoleWrap"><label class="teacher-dual-toggle">
            <input type="checkbox" role="switch" id="employeeDualRole" ${checked ? 'checked' : ''}>
            <span>Yordamchi ustoz sifatida ham ko‘rsatilsin</span></label></div>`;
    }
    function bindEmployee(roleId) {
        const role = document.getElementById(roleId), wrap = document.getElementById('employeeDualRoleWrap');
        if (!role || !wrap) return;
        const sync = () => { wrap.hidden = !teacherRoles.isMain({ role: role.value }); };
        role.addEventListener('change', sync); sync();
    }
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
        window.schoolUI.api('/attendance/absences?month=' + month).then(r => { ab = { month, list: r.absences || [], loading: false }; render(); })
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
    let nx = { key: '', lessons: {}, loading: false };
    function loadNext(ids, day) {
        const key = `${day}|${ids.join(',')}`;
        if (!ids.length || nx.loading || nx.key === key || typeof apiFetch !== 'function') return;
        nx.loading = true;
        apiFetch(`/api/academic/next-lessons?ids=${encodeURIComponent(ids.join(','))}`, { timeout: 30000 })
            .then(r => { nx = { key, lessons: r.lessons || {}, loading: false }; render(); })
            .catch(() => { nx = { key, lessons: {}, loading: false }; });
    }
    let showAll = false;
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dkey = v => (v ? String(v).slice(0, 10) : '');
    const ASSIST_FROM = '2026-10';
    const DAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    function render() {
        const root = document.getElementById('mainAttendanceContainer');
        if (!root) return;
        const id = getCurrentUser()?.linkedTeacherId;
        const employee = getItem(STORAGE_KEYS.hrEmployees, []).find(e => e.id === id);
        const isMain = teacherRoles.isMain(employee), all = getItem(STORAGE_KEYS.students, []);
        const hasAssistant = all.some(s => s.assistantTeacherId === id);
        if (!isMain || (!hasAssistant && selected === 'assistant')) selected = isMain ? 'main' : 'assistant';
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
        const students = all.filter(s => s[field] === id && !s.frozen && s.status !== 'inactive');
        const mainStudents = all.filter(s => s.teacherId === id && !s.frozen && s.status !== 'inactive');
        const helpedStudents = all.filter(s => s.assistantTeacherId === id && !s.frozen && s.status !== 'inactive');
        const store = getItem(selected === 'assistant' ? STORAGE_KEYS.assistantAttendance : STORAGE_KEYS.mainAttendance, {});
        const attendance = selected === 'main' ? withAbsences(store[`${month}_${id}`] || {}, month, id) : (store[`${month}_${id}`] || {});
        const ownTeacher = resolveTeacherWithVirtual(id) || {};
        const calendar = teacherAttendanceCalendar;
        if (!students.some(s => s.id === expanded)) expanded = '';
        const nowT = new Date(Date.now() + 5 * 3600000); // Asia/Tashkent
        const today = nowT.toISOString().slice(0, 10), thisMonth = today.slice(0, 7), todayDay = Number(today.slice(8));
        const nowMin = nowT.getUTCHours() * 60 + nowT.getUTCMinutes();
        const todayDow = nowT.getUTCDay() || 7;
        const past = c => month < thisMonth || (month === thisMonth && c.day <= todayDay);
        const expectedFor = s => calendar.cells(month, calendar.weekdays(s, ownTeacher, selected)).filter(c => c && c.scheduled && past(c)).length;
        const planFor = s => calendar.cells(month, calendar.weekdays(s, ownTeacher, selected)).filter(c => c && c.scheduled).length;
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        const U = window.schoolUI;
        const avatar = s => (U ? U.studentAvatar(s, 32) : '');
        const sched = s => `${U ? U.pattern(s.lessonDayOfWeek) : ''}${s.lessonTime ? ' ' + esc(s.lessonTime) : ''}${s.lessonDuration ? ' · ' + Number(s.lessonDuration) + ' daq' : ''}`;
        const myMk = mk.month === month ? mk.list.filter(m => m.teacher_id === id && ['planned', 'review', 'approved'].includes(m.status)) : [];
        const mkOn = (sid, date) => myMk.find(m => m.student_id === sid && dkey(m.held_date) === date);
        const mkFor = sid => myMk.filter(m => m.student_id === sid && dkey(m.held_date).slice(0, 7) === month);
        const coveredMissed = sid => new Set(myMk.filter(m => m.student_id === sid).map(m => dkey(m.missed_date)));
        // Hisobga o'tgan darslar — moliya bilan bir xil: 2026-10 dan dars kunidagi "Keldi" + tasdiqlangan qoplash.
        const countedFor = s => {
            const entries = attendance[s.id] || {};
            const cells = calendar.cells(month, calendar.weekdays(s, ownTeacher, 'main')).filter(Boolean);
            const strict = month >= '2026-10';
            const days = new Set(cells.filter(c => (!strict || c.scheduled) && calendar.status(entries[c.day]) === 'present').map(c => c.day));
            let n = days.size;
            if (strict) for (const m of mkFor(s.id).filter(m => m.status === 'approved')) {
                const d = Number(dkey(m.held_date).slice(8));
                if (m.kind === 'double') n++; else if (!days.has(d)) { days.add(d); n++; }
            }
            return Math.min(n, planFor(s));
        };

        // Bugun (asosiy ustozlik): dars bo'ldimi — Keldi / Kelmadi.
        // Qoplanmagan (kelmagan, qoplash yo'q) darslar — kalendar oynasi va bugungi "Keldi · 2 dars" uchun.
        const openMissedFor = sid => {
            const entries = attendance[sid] || {}, covered = coveredMissed(sid);
            return Object.entries(entries).filter(([, v]) => calendar.status(v) === 'absent')
                .map(([d]) => `${month}-${String(d).padStart(2, '0')}`).filter(d => !covered.has(d)).sort();
        };
        const dm = d => `${Number(d.slice(8))}-${MON3[Number(d.slice(5, 7)) - 1]}`;
        let todayHtml = '';
        if (selected === 'main' && month === thisMonth) {
            const list = students.filter(s => calendar.weekdays(s, ownTeacher, 'main').includes(todayDow))
                .sort((a, b) => (toMin(a.lessonTime) ?? 9999) - (toMin(b.lessonTime) ?? 9999));
            const adviceDays = s => ([1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [1, 3, 5]);
            const contactList = isMain ? helpedStudents.filter(s => s.lessonDayOfWeek != null && adviceDays(s).includes(todayDow)) : [];
            const contacts = contactList.length;
            if (contacts) loadAssist(month);
            loadNext(list.map(s => s.id), today);
            const next = list.find(s => (toMin(s.lessonTime) ?? -1) > nowMin && calendar.status((attendance[s.id] || {})[todayDay]) === 'empty');
            const unmarked = list.filter(s => { const st = toMin(s.lessonTime); return calendar.status((attendance[s.id] || {})[todayDay]) === 'empty' && st != null && nowMin >= st + (Number(s.lessonDuration) || 15); }).length;
            const canStart = !!window.LessonStart && isMain;
            const liveNo = sid => nx.lessons[sid]?.nextLive?.no || null;
            const startBtn = (s, label) => canStart ? `<button type="button" class="btn-primary-sm duty-start" data-duty-start="${esc(s.id)}"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>${label}</button>` : '';
            const repBy = new Map((as.month === month && as.rep ? as.rep.students || [] : []).map(x => [x.studentId, x]));
            const ws = U ? U.weekStart(today) : today;
            const rows = list.map(s => {
                const st = calendar.status((attendance[s.id] || {})[todayDay]);
                const start = toMin(s.lessonTime), started = start == null || nowMin >= start;
                const ended = start != null && nowMin >= start + (Number(s.lessonDuration) || 15);
                const live = st === 'present' ? (getItem(STORAGE_KEYS.liveGrades, {})[s.id] || []).find(g => g && g.date === today && g.teacherId === id) : null;
                const open = st === 'empty' && month >= '2026-10' ? openMissedFor(s.id) : [];
                const planned = myMk.filter(m => m.student_id === s.id && m.status === 'planned' && dkey(m.missed_date).slice(0, 7) === month && dkey(m.held_date) > today);
                const missTxt = open.length || planned.length ? ` · <b class="duty-mk-txt">${open.length ? `qoplanmagan: ${open.map(dm).join(', ')}` : ''}${open.length && planned.length ? ' · ' : ''}${planned.map(m => `${dm(dkey(m.missed_date))} → ${DAYS[(new Date(dkey(m.held_date) + 'T00:00:00Z').getUTCDay() || 7) - 1]} ${Number(dkey(m.held_date).slice(8))} rejada`).join(', ')}</b>` : '';
                const isNext = next && next.id === s.id;
                const no = liveNo(s.id);
                const sub = `${sched(s)}${(isNext || (started && !ended && st === 'empty')) && no ? ` · ${no}-dars, jonli` : ''}${missTxt}`;
                let action, ask = '';
                if (st === 'present') action = `<span class="teacher-duty-done">✓ Keldi${live?.lessonName ? ` · ${esc(live.lessonName)}` : ''}</span><button type="button" class="btn-ghost" data-duty-today="${esc(s.id)}">O‘zgartirish</button>`;
                else if (st === 'absent') action = `<span class="teacher-duty-miss">Kelmadi</span><button type="button" class="btn-ghost" data-duty-today="${esc(s.id)}">O‘zgartirish</button>`;
                else if (started) {
                    // "Dars bo'ldimi?" — Keldi / Keldi · 2 dars (qoplanmagan dars bo'lsa) / Kelmadi + avtomatik jonli dars.
                    action = ended ? '<span class="duty-pill duty-pill--warn">Belgilanmagan</span>' : `<span class="duty-pill duty-pill--now">Hozir</span>${startBtn(s, 'Darsni boshlash')}`;
                    ask = `<div class="duty-ask" role="group" aria-label="${esc(s.name)} — dars bo'ldimi?"><b>Dars bo‘ldimi?</b>
                        <button type="button" class="btn-primary-sm" data-duty-quick="1" data-sid="${esc(s.id)}">Keldi</button>
                        ${open.length ? `<button type="button" class="btn-ghost" data-duty-double="${esc(s.id)}" title="Qoplanmagan dars o'rniga: ${open.length === 1 ? dm(open[0]) : 'tanlaysiz'}">Keldi · 2 dars</button>` : ''}
                        <button type="button" class="btn-ghost" data-duty-quick="0" data-sid="${esc(s.id)}">Kelmadi</button>
                        ${no ? `<span class="duty-ask-note">Jonli dars avtomatik belgilanadi: ${no}-dars</span>` : ''}</div>`;
                } else action = isNext && canStart ? startBtn(s, 'Darsni boshlash') : '<span class="teacher-duty-wait">Kutilmoqda</span>';
                return { t: start ?? 9999, html: `<li class="${st === 'empty' && ended ? 'is-unmarked' : ''}${ask ? ' has-ask' : ''}${isNext ? ' is-next' : ''}"><b class="duty-time">${esc(s.lessonTime || '')}</b>${avatar(s)}<span><strong>${esc(s.name)}</strong><small>${sub}</small></span><span class="duty-acts">${action}</span>${ask}</li>` };
            });
            // Yordamchi aloqasi qatorlari (tavsiya — dars kuniga teskari kunlarda): "Aloqani belgilash" — yordamchi aloqa oynasi.
            for (const s of contactList) {
                const r = repBy.get(s.id), items = r?.items || [];
                const todayItems = items.filter(i => i.day === today);
                const done = todayItems.some(i => i.outcome !== 'no_answer'), na = !done && todayItems.some(i => i.outcome === 'no_answer');
                const wk = items.filter(i => i.day >= ws && i.status === 'counted').length;
                const tname = U?.teacherName ? U.teacherName(s.teacherId, true) : (teachers.find(t => t.id === s.teacherId)?.name || '—');
                const action = done ? '<span class="teacher-duty-done">✓ Aloqa belgilandi</span>'
                    : `${na ? '<span class="duty-pill duty-pill--warn">Javob bermadi</span>' : ''}<button type="button" class="btn-ghost" data-duty-contact="${esc(s.id)}">${na ? 'Qayta urinish' : 'Aloqani belgilash'}</button>`;
                rows.push({ t: toMin(s.lessonTime) ?? 9999, html: `<li class="is-contact"><b class="duty-time">${esc(s.lessonTime || '—')}</b>${avatar(s)}<span><strong>${esc(s.name)}</strong><small>yordamchi aloqasi · tavsiya · asosiy ustoz ${esc(tname)}${r || as.month === month ? ` · bu hafta ${wk}/3` : ''}</small></span><span class="duty-acts">${action}</span></li>` });
            }
            rows.sort((a, b) => a.t - b.t);
            if (rows.length) todayHtml = `<section class="teacher-duty-today" aria-label="Bugungi darslar"><h4>Bugun · ${list.length} dars${contacts ? ` + ${contacts} aloqa` : ''}
                <small>${next ? ` · Keyingi: ${esc(next.lessonTime)} · ${(d => d >= 60 ? Math.floor(d / 60) + ' soat ' + (d % 60 ? d % 60 + ' daqiqa' : '') : d + ' daqiqa')(toMin(next.lessonTime) - nowMin)}dan keyin` : ''}${unmarked ? ` · <b class="duty-bad">${unmarked} tasi belgilanmagan</b>` : ''}</small></h4>
                <ul>${rows.map(r => r.html).join('')}</ul></section>`;
        }

        // Oy ko'rsatkichlari (asosiy ustozlik).
        let kpiHtml = '';
        if (selected === 'main') {
            const plan = mainStudents.reduce((n, s) => n + planFor(s), 0);
            const expected = mainStudents.reduce((n, s) => n + expectedFor(s), 0);
            const counted = mainStudents.reduce((n, s) => n + countedFor(s), 0);
            const pct = expected ? Math.min(100, Math.round(counted / expected * 100)) : null;
            let kpi = null; try { kpi = mainStudents.length ? calculateKpiSalary(ownTeacher, month, getItem(STORAGE_KEYS.mainAttendance, {}), mainStudents) : null; } catch (e) { kpi = null; }
            const pay = kpi ? kpi.total : null;
            const review = myMk.filter(m => m.status === 'review').length;
            const [y, m] = month.split('-').map(Number);
            kpiHtml = `<div class="duty-kpis"><div><small>${MONTHS[m - 1]}</small><b>${month === thisMonth ? todayDay + ' kun o‘tdi' : month < thisMonth ? 'yopilgan oy' : 'kelgusi oy'}</b></div>
                <div><small>Hisobga o‘tdi</small><b>${counted} / ${plan}</b></div>
                <div><small>Davomat</small><b>${pct == null ? '—' : pct + '%'}</b></div>
                ${pay != null ? `<div><small>Maosh · asosiy ustozlik</small><b>${esc(formatMoney(pay))}</b></div>` : ''}
                <div><small>Tekshiruvda</small><b>${review} qoplash</b></div></div>
                <p class="duty-note">Belgilangan davomat bo‘yicha hisoblanadi. Oy yopilganda Moliya tasdiqlaydi.</p>`;
        }

        const oldAssist = selected === 'assistant' && month < ASSIST_FROM;
        const tabs = `<div class="teacher-duty-tabs${!(isMain && hasAssistant) ? ' is-single' : ''}" role="tablist" aria-label="Ustozlik davomati">
            ${isMain ? `<button role="tab" data-duty="main" aria-selected="${selected === 'main'}">Asosiy ustozlik <small>${mainStudents.length}</small></button>` : ''}
            ${(!isMain || hasAssistant) ? `<button role="tab" data-duty="assistant" aria-selected="${selected === 'assistant'}">Yordamchi ustozlik <small>${helpedStudents.length}</small></button>` : ''}</div>`;

        // Yordamchi ustozlik noyabrdan aloqalar bo'yicha — "Aloqalar" sahifasining o'zi shu yerda ochiladi.
        if (selected === 'assistant' && !oldAssist) {
            root.innerHTML = `${tabs}<div data-duty-contacts></div>`;
            const box = root.querySelector('[data-duty-contacts]'); box.dataset.month = month; box.dataset.embedded = '1';
            window.schoolTeacher?.renderContacts(box);
            root.querySelectorAll('[data-duty]').forEach(button => { button.onclick = () => { if (!busy) { selected = button.dataset.duty; lastError = ''; render(); } }; });
            return;
        }

        // "Yana N ta o'quvchi": dastlab 4 ta karta; ochiq (expanded) karta pastda bo'lsa — hammasi.
        const CARD_LIMIT = 4;
        const showAllCards = showAll || students.length <= CARD_LIMIT + 1 || students.findIndex(s => s.id === expanded) >= CARD_LIMIT;
        const legend = selected === 'main'
            ? '<span><i class="duty-present">✓</i>Keldi</span><span><i class="duty-absent">−</i>Kelmadi</span><span><i class="duty-planned"></i>Rejadagi kun</span><span><i class="duty-off"></i>Dars kuni emas</span><span><i class="duty-mk">Q</i>Qoplash darsi</span><span><i class="duty-mk is-review">Q</i>Tekshiruvda</span><span><i class="duty-mk">×2</i>Qo‘shaloq dars</span>'
            : '<span><i class="duty-planned"></i>Rejadagi kun</span><span><i class="duty-present">✓</i>Qatnashdi</span><span><i class="duty-absent">−</i>Kelmadi</span>';
        root.innerHTML = `${todayHtml}${kpiHtml}${tabs}<div class="teacher-duty-help"><p>${oldAssist ? 'Bu oy maoshi eski yordamchi davomati bo‘yicha.' : 'Dars kunini bosib davomat qo‘ying. Qayta bossangiz — o‘zgartirasiz yoki olib tashlaysiz.'}</p>
        <div class="teacher-duty-legend">${legend}</div></div>
        <div class="teacher-duty-students" role="tabpanel">${students.map((s, index) => {
            if (index >= CARD_LIMIT && !showAllCards) return '';
            const entries = attendance[s.id] || {}, panelId = `teacherDutyCalendar${index}`;
            const cells = calendar.cells(month, calendar.weekdays(s, ownTeacher, selected));
            const present = Object.values(entries).filter(v => calendar.status(v) === 'present').length;
            const absentDays = cells.filter(c => c && calendar.status(entries[c.day]) === 'absent').map(c => c.date);
            const sm = mkFor(s.id), covered = coveredMissed(s.id);
            const doubles = sm.filter(m => m.kind === 'double' && m.status === 'approved').length;
            const reviewN = sm.filter(m => m.status === 'review').length;
            const openMissed = absentDays.filter(d => !covered.has(d));
            const plan = planFor(s), counted = countedFor(s);
            return `<article class="teacher-duty-card">
            <button type="button" class="teacher-duty-student" data-duty-expand="${esc(s.id)}" aria-expanded="${expanded === s.id}" aria-controls="${panelId}">
                <span class="duty-who">${avatar(s)}<span><strong>${esc(s.name)}</strong><small>${selected === 'main' ? sched(s) : 'asosiy ustoz: ' + esc(teachers.find(t => t.id === s.teacherId)?.name || '—')}</small></span></span>
                <span class="teacher-duty-count"><b>${selected === 'main' ? counted : present}</b>/${selected === 'main' ? plan : expectedFor(s)} dars${reviewN ? ` <em class="duty-plus">+${reviewN}</em>` : ''} <span aria-hidden="true">${expanded === s.id ? '⌃' : '⌄'}</span></span>
            </button><div id="${panelId}" class="teacher-duty-calendar" ${expanded !== s.id ? 'hidden' : ''}>
            <div class="teacher-duty-weekdays" aria-hidden="true">${DAYS.map(day => `<span>${day}</span>`).join('')}</div>
            <div class="teacher-duty-days">${cells.map(cell => {
                if (!cell) return '<span aria-hidden="true"></span>';
                const state = calendar.status(entries[cell.day]);
                const m = selected === 'main' ? mkOn(s.id, cell.date) : null;
                const mark = state === 'present' ? (m?.kind === 'double' ? '×2' : '✓') : state === 'absent' ? '−' : m ? (m.kind === 'double' ? '×2' : 'Q') : '';
                const label = state === 'present' ? 'Keldi' : state === 'absent' ? 'Kelmadi' : m ? 'Qoplash darsi' : 'Belgilanmagan';
                const late = state === 'absent' && covered.has(cell.date);
                return `<button type="button" class="teacher-duty-day${cell.scheduled ? ' duty-scheduled' : ' duty-offday'}${m ? ' duty-has-mk' + (m.status === 'review' ? ' is-review' : '') : ''}${late ? ' is-covered' : ''}" data-duty-student="${esc(s.id)}" data-duty-day="${cell.day}" data-status="${state}" aria-label="${cell.date}: ${label}${cell.scheduled ? ', rejadagi kun' : ', dars kuni emas'}${m?.status === 'review' ? ', tekshiruvda' : ''}${late ? ', keyin qoplandi' : ''}" aria-pressed="${state === 'present'}"><time datetime="${cell.date}">${cell.day}</time><span aria-hidden="true">${mark}</span></button>`;
            }).join('')}</div>
            ${selected === 'main' ? `<div class="duty-stats"><span><b>${counted}</b> / ${plan} hisobga o‘tdi · ${present} keldi${doubles ? ` + ${doubles} qoplash` : ''}${reviewN ? ` · +${reviewN} tekshiruvda` : ''}</span>
              <span>Kelmadi <b>${absentDays.length}</b>${absentDays.length - openMissed.length ? ` · ${absentDays.length - openMissed.length} qoplandi` : ''}</span>
              ${openMissed.length && month === thisMonth ? `<span class="duty-bad">Qoplash mumkin <b>${openMissed.length}</b> · ${openMissed.map(d => Number(d.slice(8))).join(', ')}-sana</span>` : ''}</div>` : ''}
            </div></article>`;
        }).join('') || '<p class="teacher-duty-empty">Bu rolda faol o‘quvchilar biriktirilmagan.</p>'}
        ${!showAllCards && students.length > CARD_LIMIT ? `<button type="button" class="teacher-duty-more" data-duty-more><i aria-hidden="true">+${students.length - CARD_LIMIT}</i><span><b>Yana ${students.length - CARD_LIMIT} ta o‘quvchi</b><small>${esc(students.slice(CARD_LIMIT).map(s => String(s.name || '').split(' ')[0]).join(', '))}</small></span></button>` : ''}</div>
        ${selected === 'main' ? '<p class="duty-note"><b>Qoldirilgan darsni qoplash.</b> O‘quvchi kelmagan darsni shu oy ichida o‘tib bersangiz, admin tasdiqlagach maoshingizga hisoblanadi: dars kuni bo‘lmagan kunni bosib "Qoplash darsi o‘tildi"ni tanlang yoki keyingi darsda "Keldi · 2 dars"ni bosing. "Dars jadvali"da oldindan rejalashtirsa ham bo‘ladi. Oyiga rejadagi darslardan ortiq hisoblanmaydi.</p>' : ''}
        <p data-duty-error role="alert">${esc(lastError)}</p>`;
        root.querySelectorAll('[data-duty-today]').forEach(button => { button.onclick = () => {
            if (!expanded || expanded !== button.dataset.dutyToday) { expanded = button.dataset.dutyToday; render(); }
            document.getElementById('mainAttendanceContainer').querySelector(`[data-duty-student="${CSS.escape(button.dataset.dutyToday)}"][data-duty-day="${todayDay}"]`)?.click();
        }; });
        root.querySelectorAll('[data-duty]').forEach(button => { button.onclick = () => { if (!busy) { selected = button.dataset.duty; lastError = ''; render(); } }; });
        root.querySelectorAll('[data-duty-expand]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const opened = button.getAttribute('aria-expanded') !== 'true';
            expanded = opened ? button.dataset.dutyExpand : '';
            root.querySelectorAll('[data-duty-expand]').forEach(b => {
                const active = opened && b === button;
                b.setAttribute('aria-expanded', String(active));
                document.getElementById(b.getAttribute('aria-controls')).hidden = !active;
                b.querySelector('[aria-hidden]').textContent = active ? '⌃' : '⌄';
            });
        }; });
        const save = async (student, date, present, grade, role = selected) => {
            if (busy) return;
            busy = true; lastError = ''; monthInput.disabled = true;
            root.querySelectorAll('button').forEach(b => { b.disabled = true; });
            try { await saveTeacherAttendanceChange({ teacherId: id, studentId: student.id, date, present, attendanceType: role, grade }); }
            catch (err) { lastError = err.message; }
            finally { busy = false; monthInput.disabled = false; ab.stale = true; }
            render();
        };
        const grade = (student, date) => {
            const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === date && g.teacherId === id);
            _openLiveGradeModal(student.name, date, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                g => save(student, date, true, g), () => {}, previous);
        };
        root.querySelectorAll('[data-duty-quick]').forEach(button => { button.onclick = () => {
            const student = students.find(s => s.id === button.dataset.sid); if (!student) return;
            if (button.dataset.dutyQuick === '1') grade(student, today); else save(student, today, false);
        }; });
        // Qoplash (2026-10 dan maoshga faqat admin tasdig'i bilan): dars kuni bo'lmagan kunda — "Qoplash darsi",
        // dars kunida — "Keldi · 2 dars" (qo'shaloq). Qaysi qoldirilgan dars qoplanayotgani tanlanadi.
        const makeup = async (kind, student, date, missedDate) => {
            if (busy) return;
            busy = true; lastError = '';
            try { await window.schoolUI.post(`/makeups/${kind}`, { studentId: student.id, missedDate, heldDate: date }); mk.month = ''; window.schoolUI.toast('Qoplash tekshiruvga yuborildi'); }
            catch (err) { lastError = err.message; }
            finally { busy = false; }
            render();
        };
        root.querySelectorAll('[data-duty-student]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const role = selected, student = students.find(s => s.id === button.dataset.dutyStudent);
            const date = `${month}-${String(button.dataset.dutyDay).padStart(2, '0')}`;
            const status = button.dataset.status, offday = button.classList.contains('duty-offday');
            const missed = role === 'main' && month >= '2026-10' && date <= today && !button.classList.contains('duty-has-mk') ? openMissedFor(student.id).filter(d => d !== date) : [];
            const pick = missed.length ? `<label class="duty-pick">Qaysi qoldirilgan darsni qoplaysiz? <select id="dutyMissed">${missed.map(d => `<option value="${d}">${Number(d.slice(8))}-sana</option>`).join('')}</select></label>` : '';
            const mkButtons = !missed.length ? '' : offday
                ? '<button type="button" class="btn-primary-sm" id="dutyMkSep">Qoplash darsi o‘tildi</button>'
                : '<button type="button" class="btn-ghost" id="dutyMkDouble">Keldi · 2 dars</button>';
            const note = role === 'main' && offday && month >= '2026-10'
                ? 'Bu kun dars kuni emas. Maoshga faqat qoplash darsi sifatida, admin tasdig‘idan keyin o‘tadi.'
                : role === 'main' && offday ? 'Bu kun dars kuni emas.' : '';
            openModal(`${student.name} — ${date}`, `<p>${note ? note + ' ' : ''}Shu kundagi davomatni tanlang.</p>${pick}`,
                `<div class="teacher-duty-actions">${role === 'main' && offday && month >= '2026-10' ? '' : `<button type="button" class="btn-primary-sm" id="dutyPresent">${role === 'main' ? 'Keldi' : 'Qatnashdi'}</button>`}
                ${mkButtons}
                ${role === 'main' && offday && month >= '2026-10' ? '' : '<button type="button" class="btn-ghost" id="dutyAbsent">Kelmadi</button>'}
                ${status !== 'empty' ? '<button type="button" class="btn-ghost teacher-duty-remove" id="dutyRemove">Belgini olib tashlash</button>' : ''}
                <button type="button" class="btn-ghost" id="dutyCancel">Bekor qilish</button></div>`);
            const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
            const chosen = () => document.getElementById('dutyMissed')?.value;
            on('dutyPresent', () => { closeModal(); if (role === 'main') grade(student, date); else save(student, date, true); });
            on('dutyAbsent', () => { closeModal(); save(student, date, false); });
            on('dutyRemove', () => { closeModal(); save(student, date, null); });
            on('dutyMkSep', () => { const m = chosen(); closeModal(); makeup('separate', student, date, m); });
            on('dutyMkDouble', () => { const m = chosen(); closeModal();
                const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === date && g.teacherId === id);
                _openLiveGradeModal(student.name, date, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                    async g => { await save(student, date, true, g); if (!lastError) makeup('double', student, date, m); }, () => {}, previous); });
            on('dutyCancel', closeModal);
        }; });
        // Bugungi qator: "Darsni boshlash" (taqdimot), "Keldi · 2 dars" (qo'shaloq — mavjud /makeups/double), yordamchi aloqasi.
        root.querySelectorAll('[data-duty-start]').forEach(button => { button.onclick = () => {
            const student = students.find(s => s.id === button.dataset.dutyStart); if (!student || !window.LessonStart) return;
            window.LessonStart.start({ studentId: student.id, studentName: student.name, duration: Number(student.lessonDuration) || null })
                .catch(err => { lastError = err.message; render(); });
        }; });
        root.querySelectorAll('[data-duty-double]').forEach(button => { button.onclick = () => {
            if (busy) return;
            const student = students.find(s => s.id === button.dataset.dutyDouble); if (!student) return;
            const open = openMissedFor(student.id);
            if (open.length !== 1) {
                // Bir nechta qoplanmagan dars — kalendar oynasida qaysi biri qoplanishini tanlaydi ("Keldi · 2 dars" tugmasi o'sha yerda).
                if (expanded !== student.id) { expanded = student.id; render(); }
                document.getElementById('mainAttendanceContainer')?.querySelector(`[data-duty-student="${CSS.escape(student.id)}"][data-duty-day="${todayDay}"]`)?.click();
                return;
            }
            const previous = getItem(STORAGE_KEYS.liveGrades, {})[student.id]?.find(g => g.date === today && g.teacherId === id);
            _openLiveGradeModal(student.name, today, _getSpeakingLessonOptions(teacherRoles.language(employee)),
                async g => { await save(student, today, true, g); if (!lastError) makeup('double', student, today, open[0]); }, () => {}, previous);
        }; });
        root.querySelectorAll('[data-duty-contact]').forEach(button => { button.onclick = () => {
            const student = helpedStudents.find(s => s.id === button.dataset.dutyContact);
            if (student && window.schoolTeacher?.markDrawer) window.schoolTeacher.markDrawer(student, () => { as.stale = true; render(); });
        }; });
        root.querySelector('[data-duty-more]')?.addEventListener('click', () => { showAll = true; render(); });
        if (busy) root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    }
    window.teacherDutyUI = { employeeField, bindEmployee, bindAssignment, render };
}());
