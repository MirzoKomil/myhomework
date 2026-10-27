// Domwork Teacher — ustoz va yordamchi ustoz uchun telefon ilovasi.
// CRM bilan bir xil server va API: /api/auth, /api/state, /api/school, /api/academic, /api/payroll.
// Sessiya CRM bilan umumiy (mh_token), shuning uchun "To'liq versiya" qayta login so'ramaydi.
(function () {
    'use strict';
    const root = document.getElementById('app');
    const TOKEN = 'mh_token', USER = 'mh_currentUser';
    const AV = ['tulki', 'mushuk', 'ayiq', 'boyqush', 'panda', 'quyon', 'sher', 'pingvin', 'kuchukcha', 'toshbaqa'];
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAY_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const CHANNELS = [['phone', 'Telefon'], ['zoom', 'Zoom'], ['meet', 'Google Meet'], ['tg_video', 'Telegram video'], ['tg_group', 'Guruh videodars'], ['tg_text', 'Yozishma']];
    const CH_LABEL = Object.fromEntries(CHANNELS);
    const RATE = 3846, CAP = 13;
    const cal = window.teacherAttendanceCalendar;

    // ── Yordamchilar ────────────────────────────────────────────────────────
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
    const pad = n => String(n).padStart(2, '0');
    const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
    function now() { // Asia/Tashkent
        const d = new Date(Date.now() + 5 * 3600000);
        const date = d.toISOString().slice(0, 10);
        return { date, month: date.slice(0, 7), day: d.getUTCDate(), wd: d.getUTCDay() || 7, min: d.getUTCHours() * 60 + d.getUTCMinutes(), hour: d.getUTCHours() };
    }
    const wdOf = date => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    const fmtDate = date => { const [, m, d] = date.split('-'); return `${+d}-${MON[+m - 1].slice(0, 3)}`; };
    const avatar = (s, cls = 'av s') => {
        if (s?.avatarUrl && /^(\/|https:)/.test(s.avatarUrl)) return `<img class="${cls}" src="${esc(s.avatarUrl)}" alt="">`;
        let h = 0; for (const ch of String(s?.id || s?.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return `<img class="${cls}" src="/images/student-avatars/${AV[h % AV.length]}.webp" alt="">`;
    };
    const first = name => String(name || '').trim().split(/\s+/)[0] || '';
    const short = name => { const p = String(name || '').trim().split(/\s+/); return p[1] ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };
    const ico = d => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const I = {
        home: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M8 14l3 3 5-6"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c1.9.6 3.1 2.6 3.5 5.5"/>',
        book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
        phone: '<path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2"/>',
        back: '<path d="M15 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 6l6 6-6 6"/>',
        ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>',
    };

    let toastTimer = null;
    function toast(msg) {
        document.querySelector('.toast')?.remove();
        const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
        document.body.appendChild(el); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 3200);
    }

    // ── API ─────────────────────────────────────────────────────────────────
    async function api(path, opts = {}) {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem(TOKEN);
        if (token) headers.Authorization = `Bearer ${token}`;
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 15000);
        let res;
        try { res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctl.signal }); }
        catch (e) { clearTimeout(t); const err = new Error(navigator.onLine === false ? "Internet yo'q" : "Server bilan ulanib bo'lmadi"); err.network = true; throw err; }
        clearTimeout(t);
        let data = {}; try { data = await res.json(); } catch { data = {}; }
        if (res.status === 401 && path !== '/api/auth/login') { logout(true); throw new Error('Qayta kiring'); }
        if (!res.ok) { const err = new Error(data.error || `Xato ${res.status}`); err.status = res.status; throw err; }
        return data;
    }

    // ── Holat ───────────────────────────────────────────────────────────────
    const S = { user: null, state: null, me: null, students: [], main: [], helped: [], tab: 'home', progress: {}, schedule: null, assist: null, salary: null, makeups: [], loading: false };
    const isAssistantOnly = () => S.me && (S.me.role === 'yordamchi' || (!S.main.length && S.helped.length));
    const hasHelped = () => S.helped.length > 0;

    async function loadAll() {
        const n = now();
        const state = await api('/api/state');
        S.state = state;
        S.me = (state.hrEmployees || [])[0] || null;
        const id = S.me?.id;
        S.students = (state.students || []).filter(s => !s.isStaffDemo);
        S.main = S.students.filter(s => s.teacherId === id && s.status !== 'inactive');
        S.helped = S.students.filter(s => s.assistantTeacherId === id && s.status !== 'inactive');
        const jobs = [
            api(`/api/school/schedule?from=${n.date}&to=${n.date}`).then(r => { S.schedule = r; }).catch(() => { S.schedule = null; }),
            api('/api/academic/students').then(r => { S.progress = Object.fromEntries((r.students || []).map(s => [s.id, s])); }).catch(() => {}),
            api('/api/payroll/me').then(r => { S.salary = r; }).catch(() => { S.salary = null; }),
            api('/api/school/makeups').then(r => { S.makeups = r.makeups || []; }).catch(() => { S.makeups = []; }),
        ];
        if (S.helped.length) jobs.push(api(`/api/school/assist/month?month=${n.month}`).then(r => { S.assist = r; }).catch(() => { S.assist = null; }));
        await Promise.all(jobs);
    }

    function attFor(studentId, month, duty = 'main') {
        const store = duty === 'assistant' ? S.state?.assistantAttendance : S.state?.mainAttendance;
        return ((store || {})[`${month}_${S.me?.id}`] || {})[studentId] || {};
    }
    function setAtt(studentId, date, value) {
        const month = date.slice(0, 7), key = `${month}_${S.me.id}`;
        S.state.mainAttendance ||= {}; S.state.mainAttendance[key] ||= {}; S.state.mainAttendance[key][studentId] ||= {};
        if (value === null) delete S.state.mainAttendance[key][studentId][+date.slice(8)];
        else S.state.mainAttendance[key][studentId][+date.slice(8)] = value;
    }
    function lessonDays(student, month) {
        return cal.cells(month, cal.weekdays(student, {}, 'main')).filter(c => c && c.scheduled);
    }
    function monthStats(student, month) {
        const n = now(), entries = attFor(student.id, month);
        const days = lessonDays(student, month);
        const past = days.filter(c => month < n.month || c.day <= n.day);
        let keldi = 0, kelmadi = 0, empty = [];
        for (const c of past) {
            const st = cal.status(entries[c.day]);
            if (st === 'present') keldi++; else if (st === 'absent') kelmadi++;
            else if (c.date < n.date || (c.date === n.date && n.min >= (toMin(student.lessonTime) ?? 0) + (Number(student.lessonDuration) || 30))) empty.push(c.date);
        }
        const approved = S.makeups.filter(m => m.student_id === student.id && String(m.missed_date).slice(0, 7) === month && m.status === 'approved').length;
        const review = S.makeups.filter(m => m.student_id === student.id && String(m.missed_date).slice(0, 7) === month && m.status === 'review').length;
        return { plan: days.length, keldi, kelmadi, empty, approved, review, counted: keldi + approved };
    }
    function adviceDays(day) {
        const d = Number(day);
        if ([1, 3, 5].includes(d)) return [2, 4, 6];
        if ([2, 4, 6].includes(d)) return [1, 3, 5];
        return [1, 2, 3, 4, 5, 6].filter(x => x !== d);
    }
    function patternLabel(day) {
        const d = Number(day);
        const p = [1, 3, 5].includes(d) ? [1, 3, 5] : [2, 4, 6].includes(d) ? [2, 4, 6] : d >= 1 && d <= 7 ? [d] : [];
        return p.map(x => DAY[x - 1]).join('·');
    }
    function contactsToday(studentId) {
        const n = now();
        const s = (S.assist?.students || []).find(x => x.studentId === studentId);
        return (s?.items || []).filter(i => i.day === n.date);
    }
    const assistStudent = id => (S.assist?.students || []).find(x => x.studentId === id) || { counted: 0, items: [] };

    // ── Ramka ───────────────────────────────────────────────────────────────
    function tabsFor() {
        if (isAssistantOnly()) return [['home', 'Bugun', I.home], ['aloqa', 'Aloqa', I.phone], ['students', "O'quvchilar", I.users], ['darslik', 'Darslik', I.book], ['profile', 'Profil', I.user]];
        return [['home', 'Bugun', I.home], ['davomat', 'Davomat', I.cal], ['students', "O'quvchilar", I.users], ['darslik', 'Darslik', I.book], ['profile', 'Profil', I.user]];
    }
    function nav() {
        const unmarked = isAssistantOnly() ? 0 : S.main.reduce((n, s) => n + monthStats(s, now().month).empty.length, 0);
        return `<nav class="tabs t5" aria-label="Asosiy menyu">${tabsFor().map(([id, label, ic]) =>
            `<button type="button" class="tab${S.tab === id ? ' on' : ''}" data-tab="${id}"${S.tab === id ? ' aria-current="page"' : ''}><span class="ic">${ico(ic)}</span>${label}${id === 'davomat' && unmarked ? `<span class="n">${unmarked}</span>` : ''}</button>`).join('')}</nav>`;
    }
    function render() {
        if (!S.user) return renderLogin();
        const views = { home: isAssistantOnly() ? renderAssistHome : renderHome, davomat: renderDavomat, aloqa: renderAloqa, students: renderStudents, darslik: renderDarslik, profile: renderProfile };
        const body = (views[S.tab] || renderHome)();
        root.innerHTML = `${navigator.onLine === false ? '<div class="offline" role="status">Internet yo\'q · oxirgi yuklangan ma\'lumot</div>' : ''}${body}${nav()}`;
        root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
        bind[S.tab]?.();
        window.scrollTo(0, 0);
    }
    function go(tab) { S.tab = tab; history.replaceState(null, '', `#${tab}`); render(); }
    const bind = {};
    function header(title, sub, right = '') {
        return `<div class="top"><div class="grow"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
    }

    // ── Kirish ──────────────────────────────────────────────────────────────
    function renderLogin(error = '') {
        root.innerHTML = `<div style="padding: 56px 24px 32px; display: flex; flex-direction: column; gap: 28px; min-height: 100vh; background: #FFFFFF">
          <div style="display: flex; flex-direction: column; gap: 14px">
            <div style="width: 60px; height: 60px; border-radius: 18px; background: #0065D6; display: flex; align-items: center; justify-content: center; color: #FFFFFF"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/><path d="M21 9v5"/></svg></div>
            <div><h1 style="margin: 0; font-size: 28px; font-weight: 800">Domwork Teacher</h1><p style="margin: 6px 0 0; font-size: 15px; color: #4B5563; line-height: 1.45">Ustoz va yordamchi ustoz ilovasi — darslar, davomat va aloqalar bir joyda.</p></div>
          </div>
          <form id="lf" style="display: flex; flex-direction: column; gap: 14px" novalidate>
            <div class="field"><label class="lbl" for="lg">Login (telefon raqam)</label><input id="lg" type="text" inputmode="tel" autocomplete="username" required></div>
            <div class="field"><label class="lbl" for="pw">Parol</label><div style="position: relative"><input id="pw" type="password" autocomplete="current-password" required style="width: 100%; padding-right: 96px"><button type="button" id="sh" style="position: absolute; right: 4px; top: 4px; height: 40px; border: 0; background: transparent; font: inherit; font-size: 13px; font-weight: 700; color: #0057B8; padding: 0 12px">ko'rsatish</button></div></div>
            ${error ? `<div class="note w" role="alert">${esc(error)}</div>` : ''}
            <button class="btn pri w" type="submit" id="lb" style="margin-top: 6px">Kirish</button>
            <p class="xs muted" style="margin: 0; text-align: center; line-height: 1.5">Parolni unutdingizmi? Administratorga murojaat qiling — u vaqtinchalik parol beradi.</p>
          </form>
          <p style="margin: auto 0 0; text-align: center; font-size: 12px; color: #4B5563">Domwork Teacher · 1.0</p>
        </div>`;
        const pw = root.querySelector('#pw');
        root.querySelector('#sh').onclick = e => { pw.type = pw.type === 'password' ? 'text' : 'password'; e.target.textContent = pw.type === 'password' ? "ko'rsatish" : 'yashirish'; };
        root.querySelector('#lf').onsubmit = async e => {
            e.preventDefault();
            const login = root.querySelector('#lg').value.trim(), password = pw.value;
            if (!login || !password) return renderLogin('Login va parolni kiriting');
            const btn = root.querySelector('#lb'); btn.disabled = true; btn.textContent = 'Kirilmoqda…';
            try {
                const r = await api('/api/auth/login', { method: 'POST', body: { email: login, password } });
                if (r.user?.role !== 'teacher') { renderLogin("Bu ilova ustoz va yordamchi ustozlar uchun. Boshqa rollar CRM'ning to'liq versiyasidan foydalanadi."); return; }
                localStorage.setItem(TOKEN, r.token); localStorage.setItem(USER, JSON.stringify(r.user));
                S.user = r.user; await boot();
            } catch (err) { renderLogin(err.message); }
        };
    }
    function logout(silent) {
        const token = localStorage.getItem(TOKEN);
        if (token && !silent) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        localStorage.removeItem(TOKEN); localStorage.removeItem(USER);
        S.user = null; S.state = null; renderLogin(silent ? 'Sessiya tugadi — qayta kiring' : '');
    }

    // ── Bugun (ustoz) ───────────────────────────────────────────────────────
    function todayItems() {
        const n = now();
        const view = (S.schedule?.views || [])[0];
        let items = view ? view.items.filter(i => ['lesson', 'trial', 'makeup'].includes(i.kind)) : null;
        if (!items) { // zaxira: o'quvchilar jadvalidan
            items = S.main.filter(s => !s.frozen && cal.weekdays(s, {}, 'main').includes(n.wd) && toMin(s.lessonTime) != null)
                .map(s => ({ kind: 'lesson', start: toMin(s.lessonTime), end: toMin(s.lessonTime) + (Number(s.lessonDuration) || 30), studentId: s.id, studentName: s.name }));
        }
        const helpedToday = S.main.length ? S.helped.filter(s => !s.frozen && adviceDays(s.lessonDayOfWeek).includes(n.wd)) : [];
        return { items: items.sort((a, b) => a.start - b.start), helpedToday };
    }
    function renderHome() {
        const n = now(), { items, helpedToday } = todayItems();
        const greet = n.hour < 11 ? 'Xayrli tong' : n.hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const next = items.find(i => i.kind === 'lesson' && i.end > n.min);
        const st = id => S.students.find(s => s.id === id);
        const unmarked = S.main.flatMap(s => monthStats(s, n.month).empty.map(d => ({ s, d }))).sort((a, b) => b.d.localeCompare(a.d));
        const rows = items.map(i => {
            const s = st(i.studentId);
            const mark = s ? cal.status(attFor(s.id, n.month)[n.day]) : 'empty';
            const past = n.min >= i.end;
            const right = i.kind === 'trial' ? '<span class="pill vio">Sinov</span>'
                : mark === 'present' ? '<span class="pill ok">✓ Keldi</span>' : mark === 'absent' ? '<span class="pill bad">Kelmadi</span>'
                : !s ? '' : past || n.min >= i.start ? `<button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${n.date}">Belgilash</button>`
                : `<span class="pill ${next === i ? 'info' : 'mute'}">${next === i ? `${i.start - n.min > 59 ? hm(i.start) : (i.start - n.min) + ' daq'}` : 'Kutilmoqda'}</span>`;
            return `<div class="li${s ? ' tap' : ''}"${s ? ` data-card="${esc(s.id)}"` : ''}><span class="time">${hm(i.start)}</span>${s ? avatar(s) : '<span class="av s"></span>'}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(short(i.studentName || (i.kind === 'trial' ? 'Sinov darsi' : '')))}</span><span class="small muted">${i.end - i.start} daq${i.kind === 'makeup' ? ' · qoplash' : ''}</span></div>${right}</div>`;
        }).join('');
        const helpRows = helpedToday.map(s => {
            const done = contactsToday(s.id).some(c => c.outcome === 'contacted');
            return `<div class="li"><span class="time">—</span>${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(short(s.name))}</span><span class="small muted">yordamchi · ${assistStudent(s.id).counted}/${CAP}</span></div>${done ? '<span class="pill ok">✓</span>' : `<button type="button" class="btn sm" data-contact="${esc(s.id)}">Aloqa</button>`}</div>`;
        }).join('');
        const cur = S.salary?.current;
        const total = cur ? (cur.total ?? cur.amount ?? null) : null;
        return `${header(`${greet}, ${esc(first(S.user.name))}`, `${DAY_FULL[n.wd - 1]}, ${n.day}-${MON[+n.month.slice(5) - 1]} · ${S.main.length} o'quvchi`)}
        <div class="body">
          ${next ? (() => { const s = st(next.studentId); const pr = S.progress[next.studentId]; return `<section class="hero" aria-label="Keyingi dars">
            <span class="eyebrow">Keyingi dars · ${hm(next.start)}${next.start > n.min ? ` · ${next.start - n.min < 60 ? (next.start - n.min) + ' daqiqadan keyin' : ''}` : ' · hozir'}</span>
            <div class="row">${s ? avatar(s, 'av') : ''}<div class="col"><span class="t">${esc(next.studentName || '')}</span><span class="s">${s ? patternLabel(s.lessonDayOfWeek) + ' · ' : ''}${next.end - next.start} daq${pr?.reached ? ` · ilovada ${pr.reached}/72` : ''}</span></div></div>
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; margin-top: 4px"><button type="button" class="btn pri" data-mark="${esc(next.studentId)}" data-date="${n.date}">Darsni belgilash</button><button type="button" class="btn" data-card="${esc(next.studentId)}">Karta</button></div>
          </section>`; })() : ''}
          ${unmarked.length ? `<section class="card"><div class="between"><h2>Bajarish kerak · ${unmarked.length}</h2><span class="xs muted">maoshga ta'sir qiladi</span></div><div class="list" style="margin-top: 6px">
            ${unmarked.slice(0, 4).map(({ s, d }) => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(short(s.name))} · ${fmtDate(d)} darsi</span><span class="small muted">belgilanmagan — maoshga o'tmaydi</span></div><button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${d}">Belgilash</button></div>`).join('')}
            ${unmarked.length > 4 ? `<button type="button" class="li" data-tab="davomat" style="border-left: 0; border-right: 0; border-bottom: 0; background: none; font: inherit; width: 100%; text-align: left; cursor: pointer"><span class="small muted" style="flex: 1">yana ${unmarked.length - 4} ta</span><b class="small" style="color: #0057B8">Davomat</b></button>` : ''}
          </div></section>` : ''}
          <section class="card"><div class="between"><h2>Bugun · ${items.filter(i => i.kind !== 'trial').length} dars${helpedToday.length ? ` · ${helpedToday.length} aloqa` : ''}</h2></div>
            <div class="list" style="margin-top: 6px">${rows || ''}${helpRows}${!rows && !helpRows ? '<div class="empty">Bugun dars yo\'q</div>' : ''}</div></section>
          ${total != null ? `<section class="card" style="display: flex; flex-direction: column; gap: 6px"><span class="lbl">Maosh · ${MON[+n.month.slice(5) - 1]} · hozirgacha</span><span class="big">${money(total)} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span><span class="xs muted">belgilangan davomat va aloqalar bo'yicha</span></section>` : ''}
          <a class="card" href="/index.html" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 12px"><div class="col" style="flex: 1"><b class="small">To'liq versiya</b><span class="xs muted">Jadval, sinov darslari, doska va boshqalar</span></div>${ico(I.ext)}</a>
        </div>`;
    }
    bind.home = () => bindCommon();
    function bindCommon() {
        root.querySelectorAll('[data-mark]').forEach(b => b.onclick = e => { e.stopPropagation(); openMark(b.dataset.mark, b.dataset.date); });
        root.querySelectorAll('[data-contact]').forEach(b => b.onclick = e => { e.stopPropagation(); openContact(b.dataset.contact); });
        root.querySelectorAll('[data-card]').forEach(b => b.onclick = () => openCard(b.dataset.card));
        root.querySelectorAll('.body [data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
    }

    // ── Darsni belgilash ────────────────────────────────────────────────────
    function sheet(html, onBind) {
        document.querySelector('.scrim')?.remove(); document.querySelector('.sheet')?.remove();
        const scrim = document.createElement('div'); scrim.className = 'scrim';
        const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.innerHTML = `<span class="grab" aria-hidden="true"></span>${html}`;
        const close = () => { scrim.remove(); el.remove(); window.removeEventListener('popstate', onPop); };
        const onPop = () => close();
        scrim.onclick = close; document.body.append(scrim, el);
        history.pushState({ sheet: 1 }, ''); window.addEventListener('popstate', onPop);
        el.querySelectorAll('[data-close]').forEach(b => b.onclick = () => history.back());
        onBind?.(el, () => history.back());
        return el;
    }
    function openMark(studentId, date) {
        const s = S.students.find(x => x.id === studentId); if (!s) return;
        const n = now(), month = date.slice(0, 7);
        const cur = cal.status(attFor(s.id, month)[+date.slice(8)]);
        const absent = lessonDays(s, month).filter(c => c.date < date && cal.status(attFor(s.id, month)[c.day]) === 'absent'
            && !S.makeups.some(m => m.student_id === s.id && String(m.missed_date).slice(0, 10) === c.date && m.status !== 'rejected'));
        sheet(`<div class="row">${avatar(s, 'av')}<div class="col" style="flex: 1; min-width: 0"><h2 style="margin: 0; font-size: 18px; font-weight: 800">${esc(s.name)}</h2><span class="small muted">${fmtDate(date)}, ${DAY[wdOf(date) - 1]} · ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq${date === n.date ? '' : ' · o\'tgan kun'}</span></div><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div>
            ${cur !== 'empty' ? `<div class="note">Hozir: <b>${cur === 'present' ? 'Keldi' : 'Kelmadi'}</b> — o'zgartirish mumkin.</div>` : ''}
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px"><button type="button" class="btn okb" data-v="1" style="min-height: 64px; font-size: 17px">Keldi</button><button type="button" class="btn no" data-v="0" style="min-height: 64px; font-size: 17px">Kelmadi</button></div>
            ${absent.length ? `<div class="field"><span class="lbl">Keldi · 2 dars (qo'shaloq) — qaysi qoldirilgan dars o'rniga?</span><div class="chips">${absent.map(c => `<button type="button" class="chip" data-missed="${c.date}">${fmtDate(c.date)}</button>`).join('')}</div></div>
            <button type="button" class="btn w" data-double disabled style="justify-content: space-between"><span>Keldi · 2 dars</span><span class="pill vio">×2</span></button>
            <span class="xs muted">Qo'shaloq dars kamida 2 × dars vaqti bo'lishi kerak. Admin tasdiqlagach maoshga qo'shiladi.</span>` : ''}
            ${cur !== 'empty' ? '<button type="button" class="btn w" data-v="clear">Belgini olib tashlash</button>' : ''}`,
        (el, close) => {
            let missed = null;
            const save = async present => {
                el.querySelectorAll('button').forEach(b => b.disabled = true);
                try {
                    await api('/api/state/teacher-attendance', { method: 'POST', body: { teacherId: S.me.id, studentId: s.id, date, present, attendanceType: 'main' } });
                    setAtt(s.id, date, present); close(); toast(present === null ? 'Belgi olib tashlandi' : present ? 'Keldi — saqlandi' : 'Kelmadi — saqlandi'); render();
                } catch (err) { toast(err.message); el.querySelectorAll('button').forEach(b => b.disabled = false); }
            };
            el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => save(b.dataset.v === 'clear' ? null : b.dataset.v === '1'));
            el.querySelectorAll('[data-missed]').forEach(b => b.onclick = () => { missed = b.dataset.missed; el.querySelectorAll('[data-missed]').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('[data-double]').disabled = false; });
            const dbl = el.querySelector('[data-double]');
            if (dbl) dbl.onclick = async () => {
                if (!missed) return;
                dbl.disabled = true;
                try {
                    const r = await api('/api/school/makeups/double', { method: 'POST', body: { studentId: s.id, missedDate: missed, heldDate: date } });
                    if (r.makeup) S.makeups.unshift(r.makeup);
                    await save(true); toast('Keldi · 2 dars — admin tasdig\'iga yuborildi');
                } catch (err) { toast(err.message); dbl.disabled = false; }
            };
        });
    }

    // ── Davomat (oylik kalendar) ────────────────────────────────────────────
    let davSel = null, davMonth = null, davDuty = 'main';
    function renderDavomat() {
        const n = now(); davMonth ||= n.month;
        if (davDuty === 'assistant') return renderAloqa(true);
        const list = S.main.filter(s => !s.frozen);
        if (!list.some(s => s.id === davSel)) davSel = (list.find(s => monthStats(s, davMonth).empty.length) || list[0])?.id;
        const s = list.find(x => x.id === davSel);
        const totals = list.reduce((a, x) => { const m = monthStats(x, davMonth); a.c += m.counted; a.p += m.plan; a.e += m.empty.length; a.r += m.review; return a; }, { c: 0, p: 0, e: 0, r: 0 });
        const [y, m] = davMonth.split('-').map(Number);
        const seg = hasHelped() ? `<div class="seg" role="tablist"><button type="button" class="on" role="tab" aria-selected="true">Asosiy · ${S.main.length}</button><button type="button" data-duty="assistant" role="tab" aria-selected="false">Yordamchi · ${S.helped.length}</button></div>` : '';
        let calHtml = '';
        if (s) {
            const ms = monthStats(s, davMonth), entries = attFor(s.id, davMonth);
            const cells = cal.cells(davMonth, cal.weekdays(s, {}, 'main'));
            const mk = S.makeups.filter(x => x.student_id === s.id);
            calHtml = `<section class="card" style="display: flex; flex-direction: column; gap: 12px">
              <div class="between"><div class="col" style="min-width: 0"><h2 class="nm">${esc(s.name)}</h2><span class="small muted">${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq</span></div><span class="pill ${ms.counted >= ms.plan * 0.8 ? 'ok' : 'warn'}">${ms.counted} / ${ms.plan}</span></div>
              <div class="cal">${DAY.map(d => `<span class="h">${d}</span>`).join('')}${cells.map(c => {
                if (!c) return '<span></span>';
                if (!c.scheduled) { const held = mk.find(x => String(x.held_date).slice(0, 10) === c.date); return held ? `<span class="d ${held.status === 'approved' ? 'q' : 'r'}">${c.day}<i>Q</i></span>` : `<span class="d o">${c.day}</span>`; }
                const st = cal.status(entries[c.day]); const future = c.date > n.date;
                const cls = st === 'present' ? 'p' : st === 'absent' ? 'a' : future ? 'l' : 'u';
                return `<button type="button" class="d ${cls}${c.date === n.date ? ' t' : ''}"${future ? ' disabled' : ` data-mark="${esc(s.id)}" data-date="${c.date}"`} aria-label="${c.day}-kun">${c.day}<i>${st === 'present' ? '✓' : st === 'absent' ? '−' : future ? '' : '?'}</i></button>`;
              }).join('')}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px 12px" class="xs muted"><span><b style="color: #05603A">✓</b> keldi</span><span><b style="color: #912018">−</b> kelmadi</span><span><b style="color: #93370D">?</b> belgilanmagan</span><span><b style="color: #53389E">Q</b> qoplash</span></div>
              <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><div class="kpi"><span>Hisobga o'tdi</span><b>${ms.counted} / ${ms.plan}</b><span>${ms.keldi} keldi + ${ms.approved} qoplash</span></div><div class="kpi"><span>Kelmadi</span><b>${ms.kelmadi}</b><span>${ms.review ? ms.review + ' tekshiruvda' : 'qoplash shu oy ichida'}</span></div></div>
              ${ms.empty.length ? `<button type="button" class="btn w pri" data-mark="${esc(s.id)}" data-date="${ms.empty[ms.empty.length - 1]}">${fmtDate(ms.empty[ms.empty.length - 1])}ni belgilash</button>` : ''}
            </section>`;
        }
        return `${header('Davomat', `${MON[m - 1][0].toUpperCase() + MON[m - 1].slice(1)} ${y}`, `<button type="button" class="icb" data-mon="-1" aria-label="Oldingi oy">${ico(I.back)}</button><button type="button" class="icb" data-mon="1" aria-label="Keyingi oy"${davMonth >= n.month ? ' disabled style="color: #98A2B3"' : ''}>${ico(I.chev)}</button>`)}
        <div class="body">${seg}
          <div class="kpis"><div class="kpi"><span>Hisobga o'tdi</span><b>${totals.c}/${totals.p}</b></div><div class="kpi"><span>Belgilanmagan</span><b>${totals.e}</b></div><div class="kpi"><span>Tekshiruvda</span><b>${totals.r}</b><span>qoplash</span></div></div>
          ${list.length ? `<div style="display: flex; gap: 10px; overflow-x: auto; padding: 2px 0" role="list">${list.map(x => { const e = monthStats(x, davMonth).empty.length; return `<button type="button" role="listitem" data-sel="${esc(x.id)}" style="display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; font: inherit; color: ${x.id === davSel ? '#0B1220' : '#374151'}; width: 62px; flex: none; cursor: pointer"><span style="position: relative">${avatar(x, 'av')}${e ? `<span style="position: absolute; top: -4px; right: -6px; background: #D92D20; color: #FFFFFF; font-size: 10px; font-weight: 800; border-radius: 999px; padding: 1px 5px">${e}</span>` : ''}</span><span class="xs" style="font-weight: ${x.id === davSel ? 800 : 700}; max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(first(x.name))}</span></button>`; }).join('')}</div>` : '<div class="empty">Asosiy o\'quvchilar yo\'q</div>'}
          ${calHtml}
        </div>`;
    }
    bind.davomat = () => {
        bindCommon();
        root.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { davSel = b.dataset.sel; render(); });
        root.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => { const [y, m] = davMonth.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.mon), 1)); const v = d.toISOString().slice(0, 7); if (v <= now().month) { davMonth = v; render(); } });
        root.querySelectorAll('[data-duty]').forEach(b => b.onclick = () => { davDuty = b.dataset.duty; render(); });
    };

    // ── Aloqa (yordamchi) ───────────────────────────────────────────────────
    function renderAloqa(inDavomat) {
        const n = now();
        const today = S.helped.filter(s => !s.frozen && adviceDays(s.lessonDayOfWeek).includes(n.wd));
        const others = S.helped.filter(s => !today.includes(s));
        const row = s => {
            const c = contactsToday(s.id); const ok = c.find(x => x.outcome === 'contacted'); const na = c.find(x => x.outcome === 'no_answer');
            const right = ok ? `<span class="pill ok">${esc(CH_LABEL[ok.channel] || '')}${ok.minutes ? ' · ' + ok.minutes + '′' : ''}</span>` : `<button type="button" class="btn sm${na ? '' : ' pri'}" data-contact="${esc(s.id)}">${na ? 'Qayta' : 'Belgilash'}</button>`;
            return `<div class="li tap" data-card="${esc(s.id)}">${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(short(s.name))}</span><span class="xs muted">${na && !ok ? 'javob bermadi · ' : ''}${assistStudent(s.id).counted}/${CAP} · ${patternLabel(s.lessonDayOfWeek)} darslari</span></div>${right}</div>`;
        };
        const done = today.filter(s => contactsToday(s.id).some(c => c.outcome === 'contacted')).length;
        const seg = inDavomat ? `<div class="seg" role="tablist"><button type="button" data-duty="main" role="tab" aria-selected="false">Asosiy · ${S.main.length}</button><button type="button" class="on" role="tab" aria-selected="true">Yordamchi · ${S.helped.length}</button></div>` : '';
        return `${header(inDavomat ? 'Davomat' : 'Aloqa', `${DAY_FULL[n.wd - 1]} · ${done} / ${today.length} bajarildi`)}
        <div class="body">${seg}
          <div class="kpis"><div class="kpi"><span>Oy</span><b>${S.assist?.counted ?? 0}</b><span>aloqa hisoblandi</span></div><div class="kpi"><span>Maosh</span><b>${money(S.assist?.amount ?? 0)}</b><span>× ${money(RATE)}</span></div><div class="kpi"><span>Javob bermadi</span><b>${S.assist?.noAnswer ?? 0}</b><span>hisoblanmaydi</span></div></div>
          <section class="card" style="padding: 4px 14px"><div class="list">${today.length ? today.map(row).join('') : '<div class="empty">Bugun tavsiya yo\'q</div>'}</div></section>
          ${others.length ? `<div class="sec">Boshqa o'quvchilar</div><section class="card" style="padding: 4px 14px"><div class="list">${others.map(row).join('')}</div></section>` : ''}
          <div class="note"><b>Qoidalar:</b> kamida 5 daqiqa · yozishma haftasiga 1 tagacha · "javob bermadi" hisoblanmaydi · bir kunda bitta · shu kuni belgilanadi · oyiga ${CAP} tagacha maoshga.</div>
        </div>`;
    }
    bind.aloqa = () => bindCommon();
    function openContact(studentId) {
        const s = S.students.find(x => x.id === studentId); if (!s) return;
        let channel = 'phone', minutes = 7;
        const st = assistStudent(s.id);
        sheet(`<div class="row">${avatar(s, 'av')}<div class="col" style="flex: 1; min-width: 0"><h2 style="margin: 0; font-size: 18px; font-weight: 800">${esc(s.name)}</h2><span class="small muted">bugun · bu oy ${st.counted} / ${CAP}</span></div><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div>
            <div class="field"><span class="lbl">Usul</span><div class="opt">${CHANNELS.map(([k, l]) => `<button type="button" data-ch="${k}" class="${k === channel ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            <div class="field" id="minw"><span class="lbl">Davomiylik</span><div class="step"><button type="button" class="btn" data-m="-1" aria-label="Kamaytirish">−</button><div style="flex: 1; text-align: center"><b style="font-size: 26px" id="mv">${minutes}</b> <span class="muted" style="font-weight: 700">daqiqa</span></div><button type="button" class="btn" data-m="1" aria-label="Ko'paytirish">+</button></div>
              <div class="chips">${[5, 10, 15, 20].map(v => `<button type="button" class="chip" data-set="${v}">${v} daq</button>`).join('')}</div></div>
            <div class="field"><label class="lbl" for="nt">Izoh (ixtiyoriy)</label><textarea id="nt" placeholder="Nima ustida ishladingiz"></textarea></div>
            <div class="note" id="hint"></div>
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px"><button type="button" class="btn pri" data-save>Saqlash</button><button type="button" class="btn" data-na>Javob bermadi</button></div>`,
        (el, close) => {
            const hint = () => {
                const txt = channel === 'tg_text';
                el.querySelector('#minw').style.display = txt ? 'none' : '';
                el.querySelector('#mv').textContent = minutes;
                el.querySelector('#hint').innerHTML = txt ? 'Yozishma haftasiga 1 tagacha hisoblanadi.' : minutes < 5 ? '<b>5 daqiqadan kam</b> — hisoblanmaydi.' : st.counted >= CAP ? `Oylik limit (${CAP}) to'lgan — maoshga qo'shilmaydi.` : `✓ hisoblanadi · ${st.counted + 1} / ${CAP} bo'ladi`;
            };
            el.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { channel = b.dataset.ch; el.querySelectorAll('[data-ch]').forEach(x => x.classList.toggle('on', x === b)); hint(); });
            el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { minutes = Math.max(1, Math.min(180, minutes + Number(b.dataset.m))); hint(); });
            el.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { minutes = Number(b.dataset.set); hint(); });
            hint();
            const send = async outcome => {
                el.querySelectorAll('button').forEach(b => b.disabled = true);
                try {
                    const n = now();
                    const r = await api('/api/school/assist/contacts', { method: 'POST', body: { studentId: s.id, outcome, channel, minutes, note: el.querySelector('#nt').value, at: hm(n.min) } });
                    S.assist = await api(`/api/school/assist/month?month=${n.month}`).catch(() => S.assist);
                    close(); toast(outcome === 'no_answer' ? 'Javob bermadi — yozildi' : 'Aloqa saqlandi'); render();
                    return r;
                } catch (err) { toast(err.message); el.querySelectorAll('button').forEach(b => b.disabled = false); }
            };
            el.querySelector('[data-save]').onclick = () => send('contacted');
            el.querySelector('[data-na]').onclick = () => send('no_answer');
        });
    }

    // ── Yordamchi Bugun ─────────────────────────────────────────────────────
    function renderAssistHome() {
        const n = now();
        const greet = n.hour < 11 ? 'Xayrli tong' : n.hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const today = S.helped.filter(s => !s.frozen && adviceDays(s.lessonDayOfWeek).includes(n.wd));
        const pending = today.filter(s => !contactsToday(s.id).some(c => c.outcome === 'contacted'));
        const nextS = pending[0];
        const active = S.helped.filter(s => !s.frozen).length;
        const counted = S.assist?.counted ?? 0, max = active * CAP;
        return `${header(`${greet}, ${esc(first(S.user.name))}`, `${DAY_FULL[n.wd - 1]} · ${S.helped.length} o'quvchi`)}
        <div class="body">
          <section class="card" style="display: flex; flex-direction: column; gap: 10px"><span class="lbl">Maosh · ${MON[+n.month.slice(5) - 1]} · hozirgacha</span>
            <span class="big">${money(S.assist?.amount ?? 0)} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span>
            <span class="small muted">${counted} aloqa × ${money(RATE)} so'm · har o'quvchi bilan oyiga ${CAP} tagacha</span>
            <div class="prog"><div class="bar g"><i style="width: ${max ? Math.min(100, Math.round(counted / max * 100)) : 0}%"></i></div><span class="xs muted" style="font-weight: 700">${counted} / ${max}</span></div>
            <div class="kpis"><div class="kpi"><span>Bugun</span><b>${today.length - pending.length} / ${today.length}</b><span>${pending.length} qoldi</span></div><div class="kpi"><span>Javob bermadi</span><b>${S.assist?.noAnswer ?? 0}</b><span>bu oy</span></div><div class="kpi"><span>Limitdan ortiq</span><b>${S.assist?.overCap ?? 0}</b><span>hisoblanmadi</span></div></div>
          </section>
          ${nextS ? `<section class="hero"><span class="eyebrow">Keyingi aloqa · tavsiya</span><div class="row">${avatar(nextS, 'av')}<div class="col"><span class="t">${esc(nextS.name)}</span><span class="s">darslari ${patternLabel(nextS.lessonDayOfWeek)} ${esc(nextS.lessonTime || '')} · ${assistStudent(nextS.id).counted}/${CAP}</span></div></div>
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; margin-top: 4px"><button type="button" class="btn pri" data-contact="${esc(nextS.id)}">Aloqani belgilash</button><button type="button" class="btn" data-card="${esc(nextS.id)}">Karta</button></div></section>` : today.length ? '<div class="note">Bugungi tavsiyalar bajarildi 👍</div>' : ''}
          <section class="card"><div class="between"><h2>Bugungi tavsiya · ${today.length}</h2><span class="xs muted">majburiy emas</span></div><div class="list" style="margin-top: 6px">${today.map(s => {
              const c = contactsToday(s.id); const ok = c.find(x => x.outcome === 'contacted');
              return `<div class="li tap" data-card="${esc(s.id)}">${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(short(s.name))}</span><span class="xs muted">${assistStudent(s.id).counted}/${CAP}${c.some(x => x.outcome === 'no_answer') && !ok ? ' · javob bermadi' : ''}</span></div>${ok ? `<span class="pill ok">${esc(CH_LABEL[ok.channel] || '')}</span>` : `<button type="button" class="btn sm pri" data-contact="${esc(s.id)}">Belgilash</button>`}</div>`;
          }).join('') || '<div class="empty">Bugun tavsiya yo\'q</div>'}</div></section>
          <a class="card" href="/index.html" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 12px"><div class="col" style="flex: 1"><b class="small">To'liq versiya</b><span class="xs muted">Tavsiya jadvali, oy hisobi va boshqalar</span></div>${ico(I.ext)}</a>
        </div>`;
    }

    // ── O'quvchilar ─────────────────────────────────────────────────────────
    let stuQ = '';
    function renderStudents() {
        const n = now();
        const q = stuQ.toLowerCase();
        const f = list => list.filter(s => !q || s.name.toLowerCase().includes(q) || String(s.id).includes(q));
        const row = (s, duty) => {
            const pr = S.progress[s.id];
            let right;
            if (duty === 'main') { const ms = monthStats(s, n.month); right = `<div class="col" style="align-items: flex-end; gap: 4px">${s.frozen ? '<span class="pill info">Muzlatilgan</span>' : pr?.flags?.length ? '<span class="pill warn">E\'tibor</span>' : '<span class="pill ok">Faol</span>'}<span class="xs muted" style="font-weight: 700">${ms.counted}/${ms.plan} dars</span></div>`; }
            else right = `<span class="pill info">${assistStudent(s.id).counted}/${CAP}</span>`;
            return `<div class="li tap" data-card="${esc(s.id)}">${avatar(s, 'av')}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(s.name)}</span><span class="small muted">${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')}${pr?.reached ? ` · ilovada ${pr.reached}/72` : ''}</span></div>${right}</div>`;
        };
        const mainL = f(S.main), helpL = f(S.helped);
        return `${header("O'quvchilar", "To'lov ma'lumotlari ko'rsatilmaydi")}
        <div class="body" style="gap: 12px">
          <div class="field"><label class="lbl" for="sq" style="position: absolute; width: 1px; height: 1px; overflow: hidden">Qidirish</label><input id="sq" type="search" placeholder="Ism yoki ID bo'yicha qidirish" value="${esc(stuQ)}"></div>
          ${S.main.length ? `<div class="sec">Asosiy · ${mainL.length}</div><div class="card" style="padding: 4px 14px"><div class="list">${mainL.map(s => row(s, 'main')).join('') || '<div class="empty">Topilmadi</div>'}</div></div>` : ''}
          ${S.helped.length ? `<div class="sec">Yordamchi sifatida · ${helpL.length}</div><div class="card" style="padding: 4px 14px"><div class="list">${helpL.map(s => row(s, 'assistant')).join('') || '<div class="empty">Topilmadi</div>'}</div></div>` : ''}
          ${!S.main.length && !S.helped.length ? '<div class="empty">Sizga hali o\'quvchi biriktirilmagan</div>' : ''}
        </div>`;
    }
    bind.students = () => {
        bindCommon();
        const inp = root.querySelector('#sq');
        inp.oninput = () => { stuQ = inp.value; const pos = inp.selectionStart; render(); const again = root.querySelector('#sq'); again.focus(); again.setSelectionRange(pos, pos); };
    };
    async function openCard(studentId) {
        const s = S.students.find(x => x.id === studentId); if (!s) return;
        const n = now(), isMain = s.teacherId === S.me?.id, pr = S.progress[s.id];
        const ms = isMain ? monthStats(s, n.month) : null, as = assistStudent(s.id);
        const el = sheet(`<div class="row">${avatar(s, 'av l')}<div class="col" style="flex: 1; min-width: 0"><h2 style="margin: 0; font-size: 20px; font-weight: 800">${esc(s.name)}</h2><span class="small muted">${esc(s.group || '')}${s.group ? ' · ' : ''}${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq</span></div><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div>
            ${s.phone ? `<a class="btn w" href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}">${ico(I.phone)}Qo'ng'iroq</a>` : ''}
            <div class="kpis"><div class="kpi"><span>Ilovada</span><b>${pr?.reached ?? '—'}/72</b><span>${pr?.expected ? 'reja ' + pr.expected : 'erishgan dars'}</span></div><div class="kpi"><span>1-urinish</span><b>${pr?.firstTryAvg != null ? Math.round(pr.firstTryAvg) + '%' : '—'}</b><span>o'rtacha</span></div><div class="kpi"><span>7 kun</span><b>${pr?.activeDays7 ?? '—'} kun</b><span>faol</span></div></div>
            ${isMain ? `<div class="card" style="display: flex; flex-direction: column; gap: 6px"><div class="between"><h3>Davomat · ${MON[+n.month.slice(5) - 1]}</h3><span class="pill ${ms.counted >= ms.plan * 0.8 ? 'ok' : 'warn'}">${ms.counted} / ${ms.plan}</span></div><span class="small muted">${ms.keldi} keldi · ${ms.kelmadi} kelmadi · ${ms.approved} qoplandi${ms.review ? ' · ' + ms.review + ' tekshiruvda' : ''}${ms.empty.length ? ' · ' + ms.empty.length + ' belgilanmagan' : ''}</span>${ms.empty.length ? `<button type="button" class="btn sm pri" data-mark2="${ms.empty[ms.empty.length - 1]}">${fmtDate(ms.empty[ms.empty.length - 1])}ni belgilash</button>` : ''}</div>` : ''}
            ${!isMain ? `<div class="card" style="display: flex; flex-direction: column; gap: 6px"><div class="between"><h3>Aloqalar · ${MON[+n.month.slice(5) - 1]}</h3><span class="pill info">${as.counted} / ${CAP}</span></div>${(as.items || []).slice(-5).reverse().map(i => `<div class="between small"><span>${fmtDate(i.day)} · ${i.outcome === 'no_answer' ? 'javob bermadi' : esc(CH_LABEL[i.channel] || '') + (i.minutes ? ' · ' + i.minutes + ' daq' : '')}</span><span class="pill ${i.status === 'counted' ? 'ok' : 'mute'}">${i.status === 'counted' ? 'hisoblandi' : 'hisoblanmadi'}</span></div>`).join('') || '<span class="small muted">Bu oy hali aloqa yo\'q</span>'}<button type="button" class="btn sm pri" data-contact2>Aloqani belgilash</button></div>` : ''}
            <div id="cardMore" class="small muted">Yuklanmoqda…</div>
            <a class="btn w" href="/index.html">${ico(I.ext)}To'liq kartani ochish</a>`,
        (sh, close) => {
            sh.querySelector('[data-mark2]')?.addEventListener('click', e => { const d = e.currentTarget.dataset.mark2; close(); setTimeout(() => openMark(s.id, d), 50); });
            sh.querySelector('[data-contact2]')?.addEventListener('click', () => { close(); setTimeout(() => openContact(s.id), 50); });
        });
        try {
            const d = await api(`/api/academic/students/${encodeURIComponent(s.id)}`);
            const more = el.querySelector('#cardMore'); if (!more) return;
            const done = (d.lessons || []).filter(l => (l.results || []).length).slice(-4).reverse();
            const avgFirst = l => { const v = (l.results || []).map(r => Number(r.firstPercent)).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
            const mistakes = done.flatMap(l => (l.results || []).flatMap(r => (r.mistakes || []).map(m => ({ ...m, no: l.no })))).slice(0, 2);
            more.outerHTML = `${done.length ? `<div class="card" style="padding: 12px 14px"><h3>Darslar bo'yicha · 1-urinish</h3><div class="list">${done.map(l => { const f = avgFirst(l); return `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${l.no}-dars · ${l.type === 'live' ? 'jonli' : 'video'}</b><span class="xs muted">${esc(l.name || '')}${l.seconds ? ' · ' + Math.round(l.seconds / 60) + ' daq' : ''}</span></div>${f != null ? `<span class="pill ${f < 60 ? 'warn' : 'mute'}">${f}%</span>` : ''}</div>`; }).join('')}</div></div>` : ''}
              ${mistakes.length ? `<div class="card" style="display: flex; flex-direction: column; gap: 6px"><h3>Oxirgi xatolar</h3>${mistakes.map(m => `<div class="note w" style="font-size: 13px">${m.no}-dars · <b>${esc(m.question || '')}</b>${m.yourAnswer ? ` · o'quvchi: "${esc(m.yourAnswer)}"` : ''}${m.correctAnswer ? ` · to'g'risi: "${esc(m.correctAnswer)}"` : ''}</div>`).join('')}</div>` : ''}`;
        } catch { const more = el.querySelector('#cardMore'); if (more) more.remove(); }
    }

    // ── Darslik ─────────────────────────────────────────────────────────────
    let hub = null, hubErr = '';
    function renderDarslik() {
        if (!hub && !hubErr) { api('/api/academic/hub').then(r => { hub = r; if (S.tab === 'darslik') render(); }).catch(e => { hubErr = e.message; if (S.tab === 'darslik') render(); }); }
        const lessons = hub?.syllabus || [];
        return `${header('Darslik', hub?.course ? `${esc(hub.course.name)} · ${lessons.length} dars` : "Dars materiallari")}
        <div class="body">
          ${hubErr ? `<div class="note w">Darslik yuklanmadi: ${esc(hubErr)} <button type="button" class="btn sm" data-retry>Qayta urinish</button></div>` : !hub ? '<div class="skel"></div><div class="skel"></div>' : `
          <div class="card" style="padding: 4px 14px"><div class="list">${lessons.map(l => {
            const exam = l.no % 12 === 0, live = l.type === 'live';
            return `<button type="button" class="li tap" data-lesson="${l.no}" style="border-left: 0; border-right: 0; border-bottom: 0; background: none; font: inherit; color: inherit; width: 100%; text-align: left"><span style="width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex: none; background: ${exam ? '#FEF0C7' : live ? '#EAF3FF' : '#EEF1F6'}; color: ${exam ? '#93370D' : live ? '#0057B8' : '#374151'}">${l.no}</span><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(l.name || `${l.no}-dars`)}</span><span class="xs muted">${live ? 'Jonli' : 'Video'}${l.topic ? ' · ' + esc(l.topic) : ''}${l.studentsHere ? ` · ${l.studentsHere} o'quvchi shu yerda` : ''}</span></div>${ico(I.chev)}</button>`;
          }).join('')}</div></div>`}
          <span class="xs muted" style="padding: 0 4px">Slaydlar, doska va kitob PDF — to'liq versiyada (kompyuter yoki yotiq ekran).</span>
        </div>`;
    }
    bind.darslik = () => {
        root.querySelector('[data-retry]')?.addEventListener('click', () => { hubErr = ''; render(); });
        root.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => openLesson(b.dataset.lesson));
    };
    async function openLesson(no) {
        const el = sheet(`<div class="between"><h2 style="margin: 0; font-size: 18px; font-weight: 800">${no}-dars</h2><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div><div id="lb" class="skel"></div>`);
        try {
            const d = await api(`/api/academic/lessons/${encodeURIComponent(no)}`);
            const l = d.lesson || {};
            const box = el.querySelector('#lb'); if (!box) return;
            const plan = l.plan || {};
            const vocab = l.vocabulary || [];
            const mats = [...(d.guides || []).map(g => ({ kind: g.kind === 'teacher_book' ? 'Ustoz kitobi' : 'Qo\'llanma', title: `${g.title} · ${g.page}-bet`, url: g.url })),
                ...(d.book ? [{ kind: 'Kitob', title: `${d.book.title || 'Kitob'}${d.book.page ? ' · ' + d.book.page + '-bet' : ''}`, url: d.book.url }] : []),
                ...(d.materials || []).map(m => ({ kind: m.kind, title: m.title || m.fileName, url: m.url }))].filter(m => m.url);
            box.outerHTML = `<div class="col" style="gap: 4px"><b style="font-size: 17px">${esc(l.name || '')}</b><span class="small muted">${l.type === 'live' ? 'Jonli dars' : 'Videodars'}${l.topic ? ' · ' + esc(l.topic) : ''}${d.classStats?.done != null ? ` · ${d.classStats.done} o'quvchi tugatdi` : ''}</span></div>
              ${plan.goal ? `<div class="note"><b>Maqsad:</b> ${esc(plan.goal)}</div>` : ''}
              ${(plan.blocks || []).map(b => `<div class="card" style="display: flex; flex-direction: column; gap: 6px"><span class="eyebrow" style="color: #0057B8">${esc(b.when || '')}</span><h3>${esc(b.title || '')}</h3>${(b.items || []).map(i => `<span class="small">· ${esc(i)}</span>`).join('')}${b.tip ? `<span class="xs muted">${esc(b.tip)}</span>` : ''}</div>`).join('')}
              ${vocab.length ? `<div class="card"><h3>So'zlar · ${vocab.length}</h3><div class="chips" style="margin-top: 6px">${vocab.slice(0, 24).map(v => `<span class="chip">${esc(v.word)} — ${esc(v.translation || '')}</span>`).join('')}</div></div>` : ''}
              ${mats.length ? `<div class="card" style="padding: 4px 14px"><div class="list">${mats.map(m => `<a class="li" href="${esc(m.url)}" target="_blank" rel="noopener" style="text-decoration: none; color: inherit"><span class="pill info" style="min-width: 54px; justify-content: center">${esc(m.kind || 'fayl')}</span><span class="small" style="flex: 1">${esc(m.title || '')}</span>${ico(I.ext)}</a>`).join('')}</div></div>` : ''}
              <a class="btn w pri" href="/index.html">${ico(I.ext)}Slaydlarni to'liq versiyada ochish</a>`;
        } catch (err) { const box = el.querySelector('#lb'); if (box) box.outerHTML = `<div class="note w">${esc(err.message)}</div>`; }
    }

    // ── Profil ──────────────────────────────────────────────────────────────
    function renderProfile() {
        const u = S.user;
        return `<div class="top" style="padding-top: 22px">${u.avatar && /^(\/|https:|data:image)/.test(u.avatar) ? `<img class="av l" src="${esc(u.avatar)}" alt="">` : `<span class="av l" style="display: flex; align-items: center; justify-content: center; font-weight: 800; color: #0057B8; font-size: 22px">${esc(first(u.name)[0] || '')}</span>`}<div class="grow"><h1>${esc(u.name)}</h1><div class="sub">${isAssistantOnly() ? 'Yordamchi ustoz' : 'Ustoz'}${S.me?.lang ? ' · ' + (S.me.lang === 'russian' || S.me.role === 'rus-oqituvchi' ? 'Rus tili' : 'Ingliz tili') : ''}</div><div class="xs muted" style="margin-top: 2px">${esc(u.email || '')}</div></div></div>
        <div class="body" style="gap: 12px">
          <div class="sec">Xavfsizlik</div>
          <div class="card" style="padding: 4px 14px"><div class="list">
            <button type="button" class="li tap" data-act="pwd" style="border-left: 0; border-right: 0; border-bottom: 0; background: none; font: inherit; color: inherit; width: 100%; text-align: left"><b class="small" style="flex: 1">Parolni o'zgartirish</b>${ico(I.chev)}</button>
            <button type="button" class="li tap" data-act="hist" style="border-left: 0; border-right: 0; border-bottom: 0; background: none; font: inherit; color: inherit; width: 100%; text-align: left"><b class="small" style="flex: 1">Kirishlar tarixi</b>${ico(I.chev)}</button>
          </div></div>
          <div class="card" style="padding: 4px 14px"><div class="list">
            <a class="li" href="/index.html" style="text-decoration: none; color: inherit"><div class="col" style="flex: 1"><b class="small">To'liq versiya</b><span class="xs muted">Profil, maosh, yo'riqnomalar, sozlamalar</span></div>${ico(I.ext)}</a>
            <button type="button" class="li tap" data-act="refresh" style="border-left: 0; border-right: 0; border-bottom: 0; background: none; font: inherit; color: inherit; width: 100%; text-align: left"><b class="small" style="flex: 1">Ma'lumotni yangilash</b></button>
            <button type="button" class="li tap" data-act="out" style="border-left: 0; border-right: 0; border-bottom: 0; background: none; font: inherit; color: #B42318; width: 100%; text-align: left"><b class="small" style="flex: 1">Chiqish</b></button>
          </div></div>
          <span class="xs muted" style="padding: 0 4px; text-align: center">Domwork Teacher · 1.0</span>
        </div>`;
    }
    bind.profile = () => {
        root.querySelector('[data-act="out"]').onclick = () => logout(false);
        root.querySelector('[data-act="refresh"]').onclick = async () => { toast('Yangilanmoqda…'); try { await loadAll(); render(); toast('Yangilandi'); } catch (e) { toast(e.message); } };
        root.querySelector('[data-act="pwd"]').onclick = openPassword;
        root.querySelector('[data-act="hist"]').onclick = openHistory;
    };
    function openPassword() {
        sheet(`<div class="between"><h2 style="margin: 0; font-size: 18px; font-weight: 800">Parolni o'zgartirish</h2><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div>
            <div class="field"><label class="lbl" for="p0">Joriy parol</label><input id="p0" type="password" autocomplete="current-password"></div>
            <div class="field"><label class="lbl" for="p1">Yangi parol</label><input id="p1" type="password" autocomplete="new-password"></div>
            <div class="field"><label class="lbl" for="p2">Yangi parolni takrorlang</label><input id="p2" type="password" autocomplete="new-password"></div>
            <div class="note" id="pr">Kamida 12 belgi, harf va raqam, eski paroldan farqli.</div>
            <label class="li" style="border: 0; padding: 0"><span class="small" style="flex: 1; font-weight: 700">Boshqa qurilmalardan chiqarish</span><input type="checkbox" id="lo" checked style="width: 22px; height: 22px; accent-color: #0065D6"></label>
            <button type="button" class="btn pri w" data-save>Parolni saqlash</button>`,
        (el, close) => {
            const v = id => el.querySelector(id).value;
            const check = () => { const p = v('#p1'); const ok = p.length >= 12 && /[A-Za-z]/.test(p) && /\d/.test(p); el.querySelector('#pr').className = 'note' + (p && !ok ? ' w' : ''); return ok; };
            el.querySelector('#p1').oninput = check;
            el.querySelector('[data-save]').onclick = async () => {
                if (!check()) return toast('Parol talablarga mos emas');
                if (v('#p1') !== v('#p2')) return toast('Yangi parollar mos emas');
                try { await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: v('#p0'), newPassword: v('#p1'), logoutOthers: el.querySelector('#lo').checked } }); close(); toast('Parol o\'zgartirildi'); }
                catch (err) { toast(err.message); }
            };
        });
    }
    async function openHistory() {
        const el = sheet(`<div class="between"><h2 style="margin: 0; font-size: 18px; font-weight: 800">Kirishlar tarixi</h2><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div><div id="hb" class="skel"></div>`);
        try {
            const r = await api('/api/auth/login-history');
            const rows = (r.events || []).slice(0, 15);
            el.querySelector('#hb').outerHTML = `<div class="list">${rows.map(e => `<div class="li"><div class="col" style="flex: 1"><b class="small">${esc(new Date(e.at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</b><span class="xs muted">${esc(String(e.userAgent || '').slice(0, 60))}${e.ip ? ' · ' + esc(e.ip) : ''}</span></div><span class="pill ${e.ok ? 'ok' : 'bad'}">${e.ok ? 'Kirdi' : 'Xato'}</span></div>`).join('') || '<div class="empty">Yozuv yo\'q</div>'}</div><span class="xs muted">5 marta noto'g'ri paroldan keyin kirish 15 daqiqaga bloklanadi.</span>`;
        } catch (err) { const b = el.querySelector('#hb'); if (b) b.outerHTML = `<div class="note w">${esc(err.message)}</div>`; }
    }

    // ── Ishga tushirish ─────────────────────────────────────────────────────
    async function boot() {
        root.innerHTML = '<div class="body" style="padding-top: 24px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
        try {
            await loadAll();
            if (!S.me) {
                root.innerHTML = `<div class="body" style="padding-top: 48px"><div class="note w"><b>Akkaunt HR profiliga biriktirilmagan.</b> Administratorga murojaat qiling: login HR'dagi xodim logini bilan bir xil bo'lishi kerak.</div><button type="button" class="btn w" id="out">Chiqish</button></div>`;
                root.querySelector('#out').onclick = () => logout(false);
                return;
            }
            const h = location.hash.slice(1);
            if (tabsFor().some(t => t[0] === h)) S.tab = h; else S.tab = 'home';
            render();
        } catch (err) {
            if (!S.user) return;
            root.innerHTML = `<div class="body" style="justify-content: center; align-items: center; text-align: center; gap: 12px; padding-top: 120px">
              <h2 style="margin: 0; font-size: 19px; font-weight: 800">Ma'lumot yuklanmadi</h2><p class="muted" style="margin: 0; font-size: 14px">${esc(err.message)}</p>
              <button type="button" class="btn pri" id="rt" style="min-width: 200px">Qayta urinish</button></div>`;
            root.querySelector('#rt').onclick = boot;
        }
    }
    window.addEventListener('online', () => { if (S.user && S.state) render(); });
    window.addEventListener('offline', () => { if (S.user && S.state) render(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && S.user && S.state && Date.now() - (S._loadedAt || 0) > 120000) loadAll().then(() => { S._loadedAt = Date.now(); if (!document.querySelector('.sheet')) render(); }).catch(() => {});
    });
    try { S.user = JSON.parse(localStorage.getItem(USER) || 'null'); } catch { S.user = null; }
    if (!localStorage.getItem(TOKEN) || S.user?.role !== 'teacher') { S.user = null; renderLogin(); }
    else boot().then(() => { S._loadedAt = Date.now(); });
    window.__dwt = S;
})();
