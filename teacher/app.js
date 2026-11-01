// Domwork Teacher — ustoz va yordamchi ustoz uchun telefon ilovasi.
// CRM bilan bir xil server va API: /api/auth, /api/state, /api/school, /api/academic, /api/payroll, /api/trial-lessons.
// Sessiya CRM bilan umumiy (mh_token), shuning uchun "To'liq versiya" qayta login so'ramaydi.
// Maxfiylik: ustoz to'lov/tarif/sotuv summasini ko'rmaydi; yordamchi faqat o'z aloqa summalarini ko'radi.
(function () {
    'use strict';
    const root = document.getElementById('app');
    const TOKEN = 'mh_token', USER = 'mh_currentUser', OUTBOX = 'dwt_outbox', SEEN = 'dwt_notif_seen', READ_GUIDES = 'dwt_guides_read';
    const AV = ['tulki', 'mushuk', 'ayiq', 'boyqush', 'panda', 'quyon', 'sher', 'pingvin', 'kuchukcha', 'toshbaqa'];
    const DAY = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const DAY_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MON_S = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const CHANNELS = [['phone', 'Telefon'], ['zoom', 'Zoom'], ['meet', 'Google Meet'], ['tg_video', 'Telegram video'], ['tg_group', 'Guruh videodars'], ['tg_text', 'Yozishma']];
    const CH_LABEL = Object.fromEntries(CHANNELS);
    const RATE = 3077, CAP = 13; // zaxira — haqiqiy narx serverdan (rate)
    const cal = window.teacherAttendanceCalendar;
    // Sinov darsini rad etish/natija sabablari — server bilan bir xil ro'yxat (js/trialWorkflow.js).
    const REASONS = window.trialWorkflow?.REASONS || [];

    // ── Yordamchilar ────────────────────────────────────────────────────────
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[,  ]/g, ' ');
    const pad = n => String(n).padStart(2, '0');
    const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
    function now() { // Asia/Tashkent
        const d = new Date(Date.now() + 5 * 3600000);
        const date = d.toISOString().slice(0, 10);
        return { date, month: date.slice(0, 7), day: d.getUTCDate(), wd: d.getUTCDay() || 7, min: d.getUTCHours() * 60 + d.getUTCMinutes(), hour: d.getUTCHours() };
    }
    const wdOf = date => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    const weekStart = date => addDays(date, 1 - wdOf(date));
    const monthEnd = month => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
    const shiftMonth = (month, k) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };
    const monName = month => MON[+month.slice(5) - 1];
    const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : '';
    const fmtDate = date => { const [, m, d] = date.split('-'); return `${+d}-${MON[+m - 1].slice(0, 3)}`; };
    const dayChip = date => `${DAY[wdOf(date) - 1]} ${+date.slice(8)}`;
    const dayLong = date => `${fmtDate(date)}, ${DAY_FULL[wdOf(date) - 1]}`;
    const dayRel = date => { const n = now(); return date === n.date ? 'Bugun' : date === addDays(n.date, 1) ? 'Ertaga' : date === addDays(n.date, -1) ? 'Kecha' : `${DAY[wdOf(date) - 1]} ${fmtDate(date)}`; };
    const day10 = v => String(v || '').slice(0, 10);
    function tz(iso) { const t = Date.parse(iso); if (!Number.isFinite(t)) return null; const d = new Date(t + 5 * 3600000); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), t }; }
    function stamp(iso) { const x = tz(iso); if (!x) return ''; const n = now(); return `${x.date === n.date ? 'bugun' : x.date === addDays(n.date, -1) ? 'kecha' : fmtDate(x.date)} ${hm(x.min)}`; }
    function ago(iso) { const x = tz(iso); if (!x) return ''; const m = Math.round((Date.now() - x.t) / 60000); return m < 1 ? 'hozir' : m < 60 ? `${m} daqiqa oldin` : stamp(iso); }
    const avatar = (s, cls = 'av s') => {
        if (s?.avatarUrl && /^(\/|https:)/.test(s.avatarUrl)) return `<img class="${cls}" src="${esc(s.avatarUrl)}" alt="">`;
        let h = 0; for (const ch of String(s?.id || s?.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return `<img class="${cls}" src="/images/student-avatars/${AV[h % AV.length]}.webp" alt="">`;
    };
    const initials = (name, cls = 'av s') => `<span class="${cls}" style="display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #0057B8; font-size: 14px">${esc((String(name || '').trim()[0] || '').toUpperCase())}</span>`;
    const first = name => String(name || '').trim().split(/\s+/)[0] || '';
    const short = name => { const p = String(name || '').trim().split(/\s+/); return p[1] ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };
    const ico = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const I = {
        home: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M8 14l3 3 5-6"/>',
        cal0: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c1.9.6 3.1 2.6 3.5 5.5"/>',
        book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
        phone: '<path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2"/>',
        back: '<path d="M15 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 6l6 6-6 6"/>',
        ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>',
        bell: '<path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 003.4 0"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
        no: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
        wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 017 0M5 12.9a10 10 0 015.2-2.8M16.8 10.4A10 10 0 0119 12.9M1.4 9a15 15 0 014.4-2.6M10.7 5.1A15 15 0 0122.6 9"/><path d="M12 20h.01"/>',
        mobile: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
        monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
        doc: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
        send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
        grad: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/>',
        group: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
        shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    };
    const chev = `<span class="chev">${ico(I.chev, 18)}</span>`;

    let toastTimer = null;
    function toast(msg) {
        document.querySelector('.toast')?.remove();
        const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
        document.body.appendChild(el); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 3200);
    }
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* xotira yopiq */ } },
    };

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
    // Sahifa ma'lumoti: bir marta yuklanadi, kelgach ekran qayta chiziladi (oyna ochiq bo'lsa — yopilgach).
    const cache = {};
    function lazy(key, fn) {
        if (cache[key]) return cache[key];
        const e = cache[key] = { loading: true };
        fn().then(d => { e.data = d; }).catch(err => { e.err = err; }).finally(() => {
            e.loading = false;
            if (document.querySelector('.sheet')) S.dirty = true; else render();
        });
        return e;
    }
    const drop = prefix => Object.keys(cache).forEach(k => { if (k.startsWith(prefix)) delete cache[k]; });
    const errBox = (e, key) => `<div class="note w" role="alert">${esc(e.err?.message || 'Yuklanmadi')} <button type="button" class="btn sm" data-retry="${esc(key)}" style="margin-left: 6px">Qayta urinish</button></div>`;
    const skel = (n = 2) => '<div class="skel"></div>'.repeat(n);

    // Internet yo'qligida belgilangan davomat telefonda navbatga qo'yiladi va qaytishi bilan yuboriladi.
    const outbox = () => store.get(OUTBOX, []);
    async function flushOutbox() {
        const q = outbox(); if (!q.length || navigator.onLine === false) return;
        const left = [];
        for (const item of q) {
            try { await api('/api/state/teacher-attendance', { method: 'POST', body: item.body }); }
            catch (err) { if (err.network) left.push(item); else toast(`${item.label}: ${err.message}`); }
        }
        store.set(OUTBOX, left);
        if (left.length < q.length) { toast(`Navbatdagi ${q.length - left.length} ta belgi yuborildi`); if (!document.querySelector('.sheet')) render(); }
    }

    // ── Holat ───────────────────────────────────────────────────────────────
    const S = { user: null, state: null, me: null, students: [], main: [], helped: [], tab: 'home', pages: [], progress: {}, schedule: null, assist: null, assistPrev: null,
        salary: null, makeups: [], trials: null, inactive: null, requests: null, rating: null, loading: false, dirty: false };
    const isAssistantOnly = () => S.me && (S.me.role === 'yordamchi' || (!S.main.length && S.helped.length));
    const hasHelped = () => S.helped.length > 0;
    const stuOf = id => S.students.find(s => s.id === id);

    async function loadAll() {
        const n = now();
        const state = await api('/api/state');
        S.state = state;
        S.me = (state.hrEmployees || [])[0] || null;
        const id = S.me?.id;
        S.students = (state.students || []).filter(s => !s.isStaffDemo);
        S.main = S.students.filter(s => s.teacherId === id && s.status !== 'inactive');
        // 29-okt: yordamchi vazifasi faqat yordamchi lavozimida (asosiy ustoz yordamchi bo'la olmaydi).
        S.helped = S.me?.role === 'yordamchi' ? S.students.filter(s => s.assistantTeacherId === id && s.status !== 'inactive') : [];
        drop('');
        const jobs = [
            api(`/api/school/schedule?from=${n.date}&to=${n.date}`).then(r => { S.schedule = r; }).catch(() => { S.schedule = null; }),
            api('/api/academic/students').then(r => { S.progress = Object.fromEntries((r.students || []).map(s => [s.id, s])); }).catch(() => {}),
            api('/api/payroll/me').then(r => { S.salary = r; }).catch(() => { S.salary = null; }),
            api('/api/school/makeups').then(r => { S.makeups = r.makeups || []; }).catch(() => { S.makeups = []; }),
            api('/api/school/inactive').then(r => { S.inactive = r.students || []; }).catch(() => { S.inactive = null; }),
            api('/api/school/requests').then(r => { S.requests = r.requests || []; }).catch(() => { S.requests = null; }),
        ];
        if (S.main.length) jobs.push(api('/api/trial-lessons').then(r => { S.trials = r.lessons || []; }).catch(() => { S.trials = null; }));
        if (S.helped.length) {
            jobs.push(api(`/api/school/assist/month?month=${n.month}`).then(r => { S.assist = r; }).catch(() => { S.assist = null; }));
            jobs.push(api(`/api/school/assist/month?month=${shiftMonth(n.month, -1)}`).then(r => { S.assistPrev = r; }).catch(() => { S.assistPrev = null; }));
        }
        await Promise.all(jobs);
        // Reyting og'ir hisob — ekranni kutdirmaydi.
        if (S.main.length) api('/api/state/teacher-rating').then(r => { S.rating = r; if (S.tab === 'home' && !S.pages.length && !document.querySelector('.sheet')) render(); }).catch(() => { S.rating = null; });
        S._loadedAt = Date.now();
    }

    function attFor(studentId, month, duty = 'main') {
        const st = duty === 'assistant' ? S.state?.assistantAttendance : S.state?.mainAttendance;
        return ((st || {})[`${month}_${S.me?.id}`] || {})[studentId] || {};
    }
    function setAtt(studentId, date, value) {
        const month = date.slice(0, 7), key = `${month}_${S.me.id}`;
        S.state.mainAttendance ||= {}; S.state.mainAttendance[key] ||= {}; S.state.mainAttendance[key][studentId] ||= {};
        if (value === null) delete S.state.mainAttendance[key][studentId][+date.slice(8)];
        else S.state.mainAttendance[key][studentId][+date.slice(8)] = value;
    }
    const patternOf = s => cal.weekdays(s, {}, 'main');
    function lessonDays(student, month) {
        return cal.cells(month, patternOf(student)).filter(c => c && c.scheduled);
    }
    const markOf = (s, date) => cal.status(attFor(s.id, date.slice(0, 7))[+date.slice(8)]);
    const coveredBy = (s, date) => S.makeups.find(m => m.student_id === s.id && day10(m.missed_date) === date && m.status !== 'rejected');
    function monthStats(student, month) {
        const n = now(), entries = attFor(student.id, month);
        const days = lessonDays(student, month);
        const past = days.filter(c => month < n.month || c.day <= n.day);
        let keldi = 0, kelmadi = 0; const empty = [];
        for (const c of past) {
            const st = cal.status(entries[c.day]);
            if (st === 'present') keldi++; else if (st === 'absent') kelmadi++;
            else if (c.date < n.date || (c.date === n.date && n.min >= (toMin(student.lessonTime) ?? 0) + (Number(student.lessonDuration) || 30))) empty.push(c.date);
        }
        const mk = S.makeups.filter(m => m.student_id === student.id && day10(m.missed_date).slice(0, 7) === month);
        const approved = mk.filter(m => m.status === 'approved').length, review = mk.filter(m => m.status === 'review').length;
        return { plan: days.length, keldi, kelmadi, empty, approved, review, counted: Math.min(days.length, keldi + approved) };
    }
    // Shu oyda kelmagan va hali qoplanmagan (qoplash so'rovi yo'q yoki rad etilgan) darslar.
    function uncovered(s, month = now().month) {
        const n = now();
        return lessonDays(s, month).filter(c => c.date <= n.date && markOf(s, c.date) === 'absent' && !coveredBy(s, c.date)).map(c => c.date);
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
    const adviceLabel = day => adviceDays(day).map(x => DAY[x - 1]).join('·');
    const assistStudent = id => (S.assist?.students || []).find(x => x.studentId === id) || { counted: 0, noAnswer: 0, items: [] };
    const contactsOn = (studentId, date) => (assistStudent(studentId).items || []).filter(i => i.day === date);
    const contactsToday = studentId => contactsOn(studentId, now().date);
    const weekCount = studentId => { const ws = weekStart(now().date); return (assistStudent(studentId).items || []).filter(i => i.day >= ws && i.status === 'counted').length; };
    const flagKeys = id => (S.progress[id]?.flags || []).map(f => f.key);
    // Sinov darslari (lid → ustoz tasdig'i): pending → accepted → completed | rejected.
    const tReq = l => l.trialRequest || {};
    const tAt = l => tz(tReq(l).scheduledAt);
    function trialPhase(l) {
        const r = tReq(l), at = tAt(l), n = now();
        // Tasdiqlanmay vaqti o'tib ketgan sinov osilib qolmasin — natija yoziladi (server ruxsat beradi).
        if (r.state === 'pending') return at && (at.date < n.date || (at.date === n.date && at.min <= n.min)) ? 'result' : 'pending';
        if (r.state === 'accepted') return at && (at.date < n.date || (at.date === n.date && at.min + 30 <= n.min)) ? 'result' : 'upcoming';
        return 'past';
    }
    const trialManager = l => (l.comments || []).filter(c => c.type === 'trial-lesson').slice(-1)[0]?.author || '';
    function guideTags() {
        if (S.me?.role === 'yordamchi') return ['teacher_assistant'];
        return ['teacher_main'];
    }
    function myGuides() {
        const tags = guideTags();
        return (S.state?.guides || []).filter(g => (g.targetRoles || []).some(t => tags.includes(t)))
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }
    const guideIsNew = g => !store.get(READ_GUIDES, []).includes(g.id) && Date.now() - (Date.parse(g.createdAt) || 0) < 30 * 86400000;

    // ── Ramka va sahifalar ──────────────────────────────────────────────────
    function tabsFor() {
        if (isAssistantOnly()) return [['home', 'Bugun', I.home], ['aloqa', 'Aloqa', I.phone], ['students', "O'quvchilar", I.users], ['darslik', 'Darslik', I.book], ['profile', 'Profil', I.user]];
        return [['home', 'Bugun', I.home], ['davomat', 'Davomat', I.cal], ['students', "O'quvchilar", I.users], ['darslik', 'Darslik', I.book], ['profile', 'Profil', I.user]];
    }
    function nav() {
        const unmarked = isAssistantOnly() ? 0 : S.main.reduce((n, s) => n + monthStats(s, now().month).empty.length, 0);
        const cur = S.tab;
        return `<nav class="tabs t5" aria-label="Asosiy menyu">${tabsFor().map(([id, label, ic]) =>
            `<button type="button" class="tab${cur === id ? ' on' : ''}" data-tab="${id}"${cur === id ? ' aria-current="page"' : ''}><span class="ic">${ico(ic)}</span>${label}${id === 'davomat' && unmarked ? `<span class="n">${unmarked}</span>` : ''}</button>`).join('')}</nav>`;
    }
    const PAGES = {};
    const PAGE_TITLE = { jadval: 'Jadval', sinov: 'Sinov darslari', maosh: 'Maosh', reyting: 'Reyting', bildirish: 'Bildirishnomalar', yoriq: "Yo'riqnomalar", maqola: "Yo'riqnoma",
        sessiya: 'Sessiyalar', karta: "O'quvchi", sorov: "So'rov", yjadval: 'Tavsiya jadvali', ymaosh: 'Maosh', yoy: 'Yopilgan oy' };
    const TAB_LABEL = { home: 'Bugun', davomat: 'Davomat', aloqa: 'Aloqa', students: "O'quvchilar", darslik: 'Darslik', profile: 'Profil' };
    const top = () => S.pages[S.pages.length - 1] || null;
    const hashFor = () => '#' + [S.tab, ...S.pages.map(p => p.arg ? `${p.id}:${p.arg}` : p.id)].join('~');
    function push(id, arg = '') {
        if (!PAGES[id]) return;
        S.pages = [...S.pages, { id, arg: arg || '' }];
        history.pushState({ pages: S.pages, tab: S.tab }, '', hashFor());
        render();
    }
    let pendingTab = null;
    window.addEventListener('popstate', e => {
        const pages = e.state?.pages || [];
        const changed = JSON.stringify(pages) !== JSON.stringify(S.pages);
        S.pages = pages;
        if (pendingTab && !pages.length) { S.tab = pendingTab; pendingTab = null; history.replaceState({ pages: [], tab: S.tab }, '', hashFor()); render(); return; }
        if (changed && S.user && S.state) render();
    });
    function go(tab) {
        if (S.pages.length) { pendingTab = tab; history.go(-S.pages.length); return; }
        S.tab = tab; history.replaceState({ pages: [], tab }, '', hashFor()); render();
    }
    function render() {
        // v2 ishga tushgan bo'lsa, eski ilovaning kechikkan qayta chizishlari (reyting, lazy, online) v2 ramkasiga yo'naltiriladi.
        if (window.UstozV2?.active && S.user) return window.U.render();
        if (!S.user) return renderLogin();
        if (!S.state) return;
        const t = top(), pg = t && PAGES[t.id];
        const body = pg ? pg.render(t.arg) : ({ home: isAssistantOnly() ? renderAssistHome : renderHome, davomat: renderDavomat, aloqa: renderAloqa, students: renderStudents, darslik: renderDarslik, profile: renderProfile }[S.tab] || renderHome)();
        const y = window.scrollY, same = render._last === hashFor();
        root.innerHTML = `${offlineBar()}${body}${!pg || pg.nav ? nav() : ''}`;
        root.querySelectorAll('.tabs [data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
        root.querySelectorAll('[data-back]').forEach(b => b.onclick = () => history.back());
        root.querySelectorAll('[data-retry]').forEach(b => b.onclick = () => { drop(b.dataset.retry); render(); });
        bindCommon();
        if (pg) pg.bind?.(t.arg); else bind[S.tab]?.();
        window.scrollTo(0, same ? y : 0); render._last = hashFor();
    }
    const bind = {};
    function header(title, sub, right = '') {
        return `<div class="top"><div class="grow"><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
    }
    function pageHead(title, sub, right = '', lead = '') {
        const prev = S.pages[S.pages.length - 2];
        const label = prev ? PAGE_TITLE[prev.id] : TAB_LABEL[S.tab];
        return `<div style="padding: 8px 12px 0"><button type="button" class="back" data-back>${ico(I.back)}${esc(label)}</button></div>
          <div class="top" style="padding-top: 0">${lead}<div class="grow">${title}${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
    }
    const h1 = t => `<h1>${t}</h1>`;
    function offlineBar() {
        if (navigator.onLine !== false) return '';
        const at = S._loadedAt ? hm(tz(new Date(S._loadedAt).toISOString()).min) : '';
        return `<div class="offline" role="status" style="display: flex; align-items: center; gap: 10px">${ico(I.wifiOff, 18)}<span class="small" style="flex: 1"><b>Internet yo'q.</b> ${at ? at + ' dagi' : 'Oxirgi yuklangan'} ma'lumot ko'rsatilmoqda</span></div>`;
    }
    function bell() {
        const n = notifUnread();
        return `<button type="button" class="icb" data-push="bildirish" aria-label="Bildirishnomalar${n ? ', ' + n + ' ta yangi' : ''}">${ico(I.bell)}${n ? '<span class="dot"></span>' : ''}</button>`;
    }
    function bindCommon() {
        root.querySelectorAll('[data-mark]').forEach(b => b.onclick = e => { e.stopPropagation(); openMark(b.dataset.mark, b.dataset.date); });
        root.querySelectorAll('[data-contact]').forEach(b => b.onclick = e => { e.stopPropagation(); openContact(b.dataset.contact); });
        root.querySelectorAll('[data-card]').forEach(b => b.onclick = () => push('karta', b.dataset.card));
        root.querySelectorAll('[data-push]').forEach(b => b.onclick = e => { e.stopPropagation(); push(b.dataset.push, b.dataset.arg || ''); });
        root.querySelectorAll('.body [data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
        root.querySelectorAll('[data-held]').forEach(b => b.onclick = e => { e.stopPropagation(); markHeld(b.dataset.held, b); });
        root.querySelectorAll('[data-qoplash]').forEach(b => b.onclick = e => { e.stopPropagation(); openQoplash(b.dataset.qoplash || null, { date: b.dataset.date, time: b.dataset.time }); });
        root.querySelectorAll('[data-lesson]').forEach(b => b.onclick = e => { e.stopPropagation(); openLesson(b.dataset.lesson); });
    }

    // ── Kirish ──────────────────────────────────────────────────────────────
    function renderLogin(error = '') {
        // Domwork Team: kirish bitta — umumiy login sahifasi (/). U yerda ustoz rolini aniqlab, shu ilovaga qaytaradi.
        if (window.UstozV2) { location.replace(error ? '/?e=expired' : '/'); return; }
        root.innerHTML = `<div style="padding: 56px 24px 32px; display: flex; flex-direction: column; gap: 28px; min-height: 100vh; background: #FFFFFF">
          <div style="display: flex; flex-direction: column; gap: 14px">
            <div style="width: 60px; height: 60px; border-radius: 18px; background: #0065D6; display: flex; align-items: center; justify-content: center; color: #FFFFFF">${ico(I.grad, 32)}</div>
            <div><h1 style="margin: 0; font-size: 28px; font-weight: 800">Domwork Teacher</h1><p style="margin: 6px 0 0; font-size: 15px; color: #4B5563; line-height: 1.45">Ustoz va yordamchi ustoz ilovasi — darslar, davomat va aloqalar bir joyda.</p></div>
          </div>
          <form id="lf" style="display: flex; flex-direction: column; gap: 14px" novalidate>
            <div class="field"><label class="lbl" for="lg">Login (telefon raqam)</label><input id="lg" type="text" inputmode="tel" autocomplete="username" required></div>
            <div class="field"><label class="lbl" for="pw">Parol</label><div style="position: relative"><input id="pw" type="password" autocomplete="current-password" required style="width: 100%; padding-right: 96px"><button type="button" id="sh" style="position: absolute; right: 4px; top: 4px; height: 40px; border: 0; background: transparent; font: inherit; font-size: 13px; font-weight: 700; color: #0057B8; padding: 0 12px">ko'rsatish</button></div></div>
            ${error ? `<div class="note w" role="alert">${esc(error)}</div>` : ''}
            <button class="btn pri w" type="submit" id="lb" style="margin-top: 6px">Kirish</button>
            <p class="xs muted" style="margin: 0; text-align: center; line-height: 1.5">Parolni unutdingizmi? Administratorga murojaat qiling — u vaqtinchalik parol beradi.</p>
          </form>
          <p style="margin: auto 0 0; text-align: center; font-size: 12px; color: #4B5563">Domwork Teacher · 2.0</p>
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
        S.user = null; S.state = null; S.pages = []; renderLogin(silent ? 'Sessiya tugadi — qayta kiring' : '');
    }

    // ── Bugun (ustoz) ───────────────────────────────────────────────────────
    function todayItems() {
        const n = now();
        const view = (S.schedule?.views || [])[0];
        let items = view ? view.items.filter(i => ['lesson', 'trial', 'makeup'].includes(i.kind)) : null;
        if (!items) { // zaxira: o'quvchilar jadvalidan
            items = S.main.filter(s => !s.frozen && patternOf(s).includes(n.wd) && toMin(s.lessonTime) != null)
                .map(s => ({ kind: 'lesson', start: toMin(s.lessonTime), end: toMin(s.lessonTime) + (Number(s.lessonDuration) || 30), studentId: s.id, studentName: s.name }));
        }
        const helpedToday = S.main.length ? S.helped.filter(s => !s.frozen && adviceDays(s.lessonDayOfWeek).includes(n.wd)) : [];
        return { items: items.sort((a, b) => a.start - b.start), helpedToday };
    }
    const makeupOf = item => item.bookingId ? S.makeups.find(m => m.booking_id === item.bookingId) : null;
    function heldBtn(item) { // rejadagi qoplash darsi boshlangach — "O'tildi" (tekshiruvga)
        const m = makeupOf(item), n = now();
        if (!m || m.status !== 'planned' || n.min < item.start) return '';
        return `<button type="button" class="btn sm pri" data-held="${esc(m.id)}">O'tildi</button>`;
    }
    async function markHeld(id, btn) {
        btn.disabled = true;
        try { const r = await api(`/api/school/makeups/${encodeURIComponent(id)}/held`, { method: 'POST' }); const i = S.makeups.findIndex(m => m.id === id); if (i >= 0) S.makeups[i] = r.makeup || { ...S.makeups[i], status: 'review' }; toast("Qoplash o'tildi — admin tekshiradi"); render(); }
        catch (err) { toast(err.message); btn.disabled = false; }
    }
    function nextLessonDay() { // bugundan keyingi eng yaqin dars kuni (7 kun ichida)
        const n = now();
        for (let k = 1; k <= 7; k++) {
            const d = addDays(n.date, k), wd = wdOf(d);
            const list = S.main.filter(s => !s.frozen && patternOf(s).includes(wd) && toMin(s.lessonTime) != null).sort((a, b) => toMin(a.lessonTime) - toMin(b.lessonTime));
            if (list.length) return { date: d, list };
        }
        return null;
    }
    function renderHome() {
        const n = now(), { items, helpedToday } = todayItems();
        const greet = n.hour < 11 ? 'Xayrli tong' : n.hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const next = items.find(i => i.kind === 'lesson' && i.end > n.min);
        const unmarked = S.main.flatMap(s => monthStats(s, n.month).empty.map(d => ({ s, d }))).sort((a, b) => b.d.localeCompare(a.d));
        const unc = S.main.reduce((a, s) => a + uncovered(s).length, 0);
        const attention = S.main.filter(s => flagKeys(s.id).length || monthStats(s, n.month).kelmadi >= 3);
        const trials = (S.trials || []).filter(l => ['pending', 'result'].includes(trialPhase(l)));
        const todo = [
            ...unmarked.slice(0, 3).map(({ s, d }) => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(short(s.name))} · ${fmtDate(d)} darsi</span><span class="small muted">belgilanmagan — maoshga o'tmaydi</span></div><button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${d}">Belgilash</button></div>`),
            ...(unmarked.length > 3 ? [`<button type="button" class="li" data-tab="davomat"><span class="small muted" style="flex: 1">yana ${unmarked.length - 3} ta belgilanmagan</span><b class="small" style="color: #0057B8">Davomat</b></button>`] : []),
            ...trials.slice(0, 2).map(l => { const at = tAt(l), p = trialPhase(l); return `<div class="li"><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(short(l.name))} · ${p === 'pending' && at ? `${dayRel(at.date).toLowerCase()} ${hm(at.min)}` : 'sinov natijasi'}</span><span class="small muted">${p === 'pending' ? 'sinov darsi — tasdiqlang' : at ? `${dayRel(at.date).toLowerCase()} ${hm(at.min)} o'tdi` : ''}</span></div><button type="button" class="btn sm" data-push="sinov">${p === 'pending' ? 'Tasdiqlash' : 'Yozish'}</button></div>`; }),
            ...(unc ? [`<div class="li"><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${unc} dars qoplanmagan</span><span class="small muted">${monName(n.month)} · ${monthEnd(n.month).slice(8) - n.day} kun qoldi</span></div><button type="button" class="btn sm" data-qoplash="">Qoplash</button></div>`] : []),
            ...(attention.length ? [`<div class="li"><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${attention.length} o'quvchiga e'tibor kerak</span><span class="small muted ell" style="font-weight: 600">${esc(attention.slice(0, 3).map(s => first(s.name)).join(', '))}</span></div><button type="button" class="btn sm" data-tab="students">Ko'rish</button></div>`] : []),
        ];
        const rows = items.map(i => {
            const s = stuOf(i.studentId);
            const mark = s ? markOf(s, n.date) : 'empty';
            const past = n.min >= i.end;
            const mk = i.kind === 'makeup' ? makeupOf(i) : null;
            const right = i.kind === 'trial' ? '<span class="pill vio">Sinov</span>'
                : i.kind === 'makeup' ? (heldBtn(i) || `<span class="pill vio">${mk?.status === 'review' ? 'Tekshiruvda' : 'Qoplash'}</span>`)
                : mark === 'present' ? '<span class="pill ok">✓ Keldi</span>' : mark === 'absent' ? '<span class="pill bad">Kelmadi</span>'
                : !s ? '' : past || n.min >= i.start ? `<button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${n.date}">Belgilash</button>`
                : `<span class="pill ${next === i ? 'info' : 'mute'}">${next === i ? `${i.start - n.min > 59 ? hm(i.start) : (i.start - n.min) + ' daq'}` : 'Kutilmoqda'}</span>`;
            const name = i.kind === 'trial' ? 'Sinov darsi' : s?.name || i.studentName || '';
            const sub = i.kind === 'makeup' ? `qoplash${mk ? ` · ${fmtDate(day10(mk.missed_date))} o'rniga` : ''} · ${i.end - i.start} daq` : `${i.end - i.start} daq${next === i ? ' · keyingi' : ''}`;
            return `<div class="li${s ? ' tap' : ''}"${s ? ` data-card="${esc(s.id)}"` : ''}><span class="time">${hm(i.start)}</span>${s ? avatar(s) : `<span class="av s" style="display: inline-flex; align-items: center; justify-content: center; background: #F4EBFF; color: #53389E">${ico(I.users, 18)}</span>`}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(short(name))}</span><span class="small muted">${sub}</span></div>${right}</div>`;
        }).join('');
        const helpRows = helpedToday.map(s => {
            const done = contactsToday(s.id).some(c => c.outcome === 'contacted');
            return `<div class="li tap" data-card="${esc(s.id)}"><span class="time">${esc(s.lessonTime || '—')}</span>${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(short(s.name))}</span><span class="small muted">yordamchi · ${weekCount(s.id)}/3</span></div>${done ? '<span class="pill ok">✓</span>' : `<button type="button" class="btn sm" data-contact="${esc(s.id)}">Aloqa</button>`}</div>`;
        }).join('');
        const cur = S.salary?.current;
        const total = cur ? (cur.total ?? cur.amount ?? null) : null;
        const tot = S.main.reduce((a, s) => { const m = monthStats(s, n.month); a.c += m.counted; a.p += m.plan; a.r += m.review; return a; }, { c: 0, p: 0, r: 0 });
        const passed = S.main.reduce((a, s) => { const m = monthStats(s, n.month); a.k += m.keldi; a.d += m.keldi + m.kelmadi; return a; }, { k: 0, d: 0 });
        const mine = S.rating?.rows?.find(r => r.id === S.rating.selfId);
        const nd = !items.length && !helpedToday.length ? nextLessonDay() : null;
        const ob = outbox();
        return `<div class="top">${S.user.avatar && /^(\/|https:|data:image)/.test(S.user.avatar) ? `<img class="av" src="${esc(S.user.avatar)}" alt="">` : ''}<div class="grow"><h1>${greet}, ${esc(first(S.user.name))}</h1><div class="sub">${DAY_FULL[n.wd - 1]}, ${n.day}-${MON[+n.month.slice(5) - 1]} · ${nd || (!items.length && !helpedToday.length) ? "bugun dars yo'q" : S.main.length + " o'quvchi"}</div></div>${bell()}</div>
        <div class="body">
          ${ob.length ? `<section class="card" style="display: flex; flex-direction: column; gap: 10px"><div class="between"><h2>Yuborilmagan · ${ob.length}</h2><span class="pill warn">${ico(I.clock, 14)}navbatda</span></div><div class="list">${ob.map(o => `<div class="li">${o.body?.studentId && stuOf(o.body.studentId) ? avatar(stuOf(o.body.studentId)) : ''}<div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(o.label)}</b><span class="xs muted">telefonda saqlandi</span></div><span class="pill warn">kutilmoqda</span></div>`).join('')}</div><span class="xs muted">Internet qaytishi bilan avtomatik yuboriladi.</span></section>` : ''}
          ${next ? (() => { const s = stuOf(next.studentId); const pr = S.progress[next.studentId]; return `<section class="hero" aria-label="Keyingi dars">
            <span class="eyebrow">Keyingi dars · ${hm(next.start)}${next.start > n.min ? (next.start - n.min < 60 ? ` · ${next.start - n.min} daqiqadan keyin` : '') : ' · hozir'}</span>
            <div class="row">${s ? avatar(s, 'av') : ''}<div class="col"><span class="t">${esc(next.studentName || s?.name || '')}</span><span class="s">${s ? patternLabel(s.lessonDayOfWeek) + ' · ' : ''}${next.end - next.start} daq</span></div></div>
            ${pr?.reached || s?.group ? `<div class="chips">${pr?.reached ? `<span class="chip">ilovada ${pr.reached}/72</span>` : ''}${s?.group ? `<span class="chip">${esc(s.group)} guruh</span>` : ''}</div>` : ''}
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; margin-top: 4px"><button type="button" class="btn pri" data-mark="${esc(next.studentId)}" data-date="${n.date}">Darsni belgilash</button><button type="button" class="btn" data-card="${esc(next.studentId)}">Karta</button></div>
          </section>`; })() : ''}
          ${todo.length ? `<section class="card"><div class="between"><h2>Bajarish kerak · ${unmarked.length + trials.length + (unc ? 1 : 0) + (attention.length ? 1 : 0)}</h2><span class="xs muted">maoshga ta'sir qiladi</span></div><div class="list" style="margin-top: 6px">${todo.join('')}</div></section>` : ''}
          ${nd ? `<section class="card" style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 28px 16px">
              <span style="width: 64px; height: 64px; border-radius: 20px; background: #EAF3FF; color: #0057B8; display: flex; align-items: center; justify-content: center">${ico(I.cal0, 30)}</span>
              <h2 style="font-size: 18px">Bugun dars yo'q</h2>
              <span class="small muted">Keyingi dars: ${DAY_FULL[wdOf(nd.date) - 1]} ${+nd.date.slice(8)}-${MON[+nd.date.slice(5, 7) - 1]}, ${esc(nd.list[0].lessonTime)} · ${esc(nd.list[0].name)}</span>
              <button type="button" class="btn sm" data-push="jadval" data-arg="hafta" style="margin-top: 6px">Haftalik jadval</button></section>
            <section class="card" style="display: flex; flex-direction: column; gap: 4px"><h3>${nd.date === addDays(n.date, 1) ? 'Ertaga' : dayChip(nd.date) + ' kuni'} tayyorlanish</h3><div class="list">${nd.list.slice(0, 5).map(s => { const r = S.progress[s.id]?.reached; return r ? `<button type="button" class="li" data-lesson="${r}"><div class="col" style="flex: 1"><b class="small">${r}-dars · ${r % 2 ? 'video' : 'jonli'}</b><span class="xs muted">${esc(first(s.name))} · ${DAY[wdOf(nd.date) - 1]} ${esc(s.lessonTime)}</span></div>${chev}</button>` : `<div class="li"><div class="col" style="flex: 1"><b class="small">${esc(s.name)}</b><span class="xs muted">${DAY[wdOf(nd.date) - 1]} ${esc(s.lessonTime)} · ilova ma'lumoti yo'q</span></div></div>`; }).join('')}</div></section>
            <div class="note">${unmarked.length ? `${unmarked.length} ta dars belgilanmagan — Davomat bo'limida belgilang.` : "Belgilanmagan davomat yo'q."}</div>`
          : `<section class="card"><div class="between"><h2>Bugun · ${items.filter(i => i.kind !== 'trial').length + helpedToday.length} ta</h2><button type="button" class="small linkb" data-push="jadval">Jadval</button></div>
            <div class="list" style="margin-top: 6px">${rows}${helpRows}${!rows && !helpRows ? '<div class="empty">Bugun dars yo\'q</div>' : ''}</div></section>`}
          ${total != null ? `<button type="button" class="card" data-push="maosh" style="display: flex; flex-direction: column; gap: 8px; text-align: left; font: inherit; color: inherit; width: 100%; cursor: pointer">
              <div class="between" style="width: 100%"><span class="lbl">Maosh · ${monName(n.month)} · hozirgacha</span><span class="small" style="font-weight: 700; color: #0057B8">Batafsil</span></div>
              <span class="big">${money(total)} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span>
              ${cur.assistantTotal ? `<span class="small muted">asosiy ${money(cur.mainTotal)} + yordamchi ${money(cur.assistantTotal)}${tot.r ? ` · ${tot.r} qoplash tekshiruvda` : ''}</span>` : `<span class="small muted">belgilangan davomat bo'yicha${tot.r ? ` · ${tot.r} qoplash tekshiruvda` : ''}</span>`}
              ${tot.p ? `<div class="prog" style="width: 100%"><div class="bar g"><i style="width: ${Math.min(100, Math.round(tot.c / tot.p * 100))}%"></i></div><span class="xs muted" style="font-weight: 700">${tot.c} / ${tot.p} dars</span></div>` : ''}
            </button>` : ''}
          ${S.main.length ? `<div class="kpis" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
            <div class="kpi"><span>Davomat · ${monName(n.month)}</span><b>${passed.d ? Math.round(passed.k / passed.d * 100) + '%' : '—'}</b></div>
            <button type="button" class="kpi" data-push="reyting" style="text-align: left; font: inherit; color: inherit; cursor: pointer"><span>Reyting</span><b>${mine ? mine.rank + "-o'rin" : '—'}</b><span style="color: #0057B8; font-weight: 700">${mine ? mine.score + ' ball · ' : ''}jadval →</span></button>
          </div>` : ''}
        </div>`;
    }
    bind.home = () => {};

    // ── Darsni belgilash ────────────────────────────────────────────────────
    function sheet(html, onBind) {
        document.querySelector('.scrim')?.remove(); document.querySelector('.sheet')?.remove();
        const scrim = document.createElement('div'); scrim.className = 'scrim';
        const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.innerHTML = `<span class="grab" aria-hidden="true"></span>${html}`;
        const close = () => { scrim.remove(); el.remove(); window.removeEventListener('popstate', onPop); if (S.dirty) { S.dirty = false; setTimeout(render); } };
        const onPop = () => close();
        scrim.onclick = () => history.back(); document.body.append(scrim, el);
        history.pushState({ sheet: 1, pages: S.pages, tab: S.tab }, '', location.hash); window.addEventListener('popstate', onPop);
        el.querySelectorAll('[data-close]').forEach(b => b.onclick = () => history.back());
        onBind?.(el, () => history.back());
        return el;
    }
    // Oynani yopib, keyin boshqa ishni qilish (history.back asinxron).
    function closeThen(close, fn) { window.addEventListener('popstate', () => setTimeout(fn, 0), { once: true }); close(); }
    const sheetHead = (title, sub = '', lead = '') => `<div class="row">${lead}<div class="col" style="flex: 1; min-width: 0"><h2 style="margin: 0; font-size: 18px; font-weight: 800">${title}</h2>${sub ? `<span class="small muted">${sub}</span>` : ''}</div><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div>`;
    function openMark(studentId, date) {
        const s = stuOf(studentId); if (!s) return;
        const n = now(), month = date.slice(0, 7);
        const cur = markOf(s, date);
        const absent = lessonDays(s, month).filter(c => c.date < date && markOf(s, c.date) === 'absent' && !coveredBy(s, c.date));
        sheet(`${sheetHead(esc(s.name), `${fmtDate(date)}, ${DAY[wdOf(date) - 1]} · ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq${date === n.date ? '' : ' · o\'tgan kun'}`, avatar(s, 'av'))}
            ${cur !== 'empty' ? `<div class="note">Hozir: <b>${cur === 'present' ? 'Keldi' : 'Kelmadi'}</b> — o'zgartirish mumkin.</div>` : ''}
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px"><button type="button" class="btn okb" data-v="1" style="min-height: 64px; font-size: 17px">Keldi</button><button type="button" class="btn no" data-v="0" style="min-height: 64px; font-size: 17px">Kelmadi</button></div>
            ${absent.length ? `<div class="field"><span class="lbl">Keldi · 2 dars (qo'shaloq) — qaysi qoldirilgan dars o'rniga?</span><div class="chips">${absent.map(c => `<button type="button" class="chip" data-missed="${c.date}">${fmtDate(c.date)}</button>`).join('')}</div></div>
            <button type="button" class="btn w" data-double disabled style="justify-content: space-between"><span>Keldi · 2 dars</span><span class="pill vio">×2</span></button>
            <span class="xs muted">Qo'shaloq dars kamida 2 × dars vaqti bo'lishi kerak. Admin tasdiqlagach maoshga qo'shiladi.</span>` : ''}
            ${cur !== 'empty' ? '<button type="button" class="btn w" data-v="clear">Belgini olib tashlash</button>' : ''}`,
        (el, close) => {
            let missed = null;
            const label = present => `${first(s.name)} · ${fmtDate(date)} · ${present === null ? 'belgisiz' : present ? 'Keldi' : 'Kelmadi'}`;
            const save = async present => {
                el.querySelectorAll('button').forEach(b => b.disabled = true);
                const body = { teacherId: S.me.id, studentId: s.id, date, present, attendanceType: 'main' };
                try {
                    await api('/api/state/teacher-attendance', { method: 'POST', body });
                    setAtt(s.id, date, present); close(); toast(present === null ? 'Belgi olib tashlandi' : present ? 'Keldi — saqlandi' : 'Kelmadi — saqlandi'); render();
                } catch (err) {
                    if (err.network) {
                        store.set(OUTBOX, [...outbox().filter(o => !(o.body.studentId === s.id && o.body.date === date)), { body, label: label(present), at: Date.now() }]);
                        setAtt(s.id, date, present); close(); toast("Internet yo'q — telefonda saqlandi, keyin yuboriladi"); render();
                    } else { toast(err.message); el.querySelectorAll('button').forEach(b => b.disabled = false); }
                }
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
            const cells = cal.cells(davMonth, patternOf(s));
            const mk = S.makeups.filter(x => x.student_id === s.id);
            calHtml = `<section class="card" style="display: flex; flex-direction: column; gap: 12px">
              <div class="between"><div class="col" style="min-width: 0"><h2 class="nm">${esc(s.name)}</h2><span class="small muted">${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq</span></div><span class="pill ${ms.counted >= ms.plan * 0.8 ? 'ok' : 'warn'}">${ms.counted} / ${ms.plan}</span></div>
              <div class="cal">${DAY.map(d => `<span class="h">${d}</span>`).join('')}${cells.map(c => {
                if (!c) return '<span></span>';
                if (!c.scheduled) { const held = mk.find(x => day10(x.held_date) === c.date); return held ? `<span class="d ${held.status === 'approved' ? 'q' : 'r'}">${c.day}<i>Q</i></span>` : `<span class="d o">${c.day}</span>`; }
                const st = cal.status(entries[c.day]); const future = c.date > n.date;
                const cls = st === 'present' ? 'p' : st === 'absent' ? 'a' : future ? 'l' : 'u';
                return `<button type="button" class="d ${cls}${c.date === n.date ? ' t' : ''}"${future ? ' disabled' : ` data-mark="${esc(s.id)}" data-date="${c.date}"`} aria-label="${c.day}-kun">${c.day}<i>${st === 'present' ? '✓' : st === 'absent' ? '−' : future ? '' : '?'}</i></button>`;
              }).join('')}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px 12px" class="xs muted"><span><b style="color: #05603A">✓</b> keldi</span><span><b style="color: #912018">−</b> kelmadi</span><span><b style="color: #93370D">?</b> belgilanmagan</span><span><b style="color: #53389E">Q</b> qoplash</span></div>
              <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><div class="kpi"><span>Hisobga o'tdi</span><b>${ms.counted} / ${ms.plan}</b><span>${ms.keldi} keldi + ${ms.approved} qoplash</span></div><div class="kpi"><span>Kelmadi</span><b>${ms.kelmadi}</b><span>${ms.review ? ms.review + ' tekshiruvda' : 'qoplash shu oy ichida'}</span></div></div>
              ${ms.empty.length ? `<button type="button" class="btn w pri" data-mark="${esc(s.id)}" data-date="${ms.empty[ms.empty.length - 1]}">${fmtDate(ms.empty[ms.empty.length - 1])}ni belgilash</button>` : ''}
              ${davMonth === n.month && uncovered(s).length ? `<button type="button" class="btn w" data-qoplash="${esc(s.id)}">Qoplash qo'yish · ${uncovered(s).length} dars</button>` : ''}
            </section>`;
        }
        return `${header('Davomat', `${cap1(MON[m - 1])} ${y}`, `<button type="button" class="icb" data-mon="-1" aria-label="Oldingi oy">${ico(I.back)}</button><button type="button" class="icb" data-mon="1" aria-label="Keyingi oy"${davMonth >= n.month ? ' disabled style="color: #98A2B3"' : ''}>${ico(I.chev)}</button>`)}
        <div class="body">${seg}
          <div class="kpis"><div class="kpi"><span>Hisobga o'tdi</span><b>${totals.c}/${totals.p}</b></div><div class="kpi"><span>Belgilanmagan</span><b>${totals.e}</b></div><div class="kpi"><span>Tekshiruvda</span><b>${totals.r}</b><span>qoplash</span></div></div>
          ${list.length ? `<div style="display: flex; gap: 10px; overflow-x: auto; padding: 2px 0" role="list">${list.map(x => { const e = monthStats(x, davMonth).empty.length; return `<button type="button" role="listitem" data-sel="${esc(x.id)}" style="display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; font: inherit; color: ${x.id === davSel ? '#0B1220' : '#374151'}; width: 62px; flex: none; cursor: pointer"><span style="position: relative">${avatar(x, 'av')}${e ? `<span style="position: absolute; top: -4px; right: -6px; background: #D92D20; color: #FFFFFF; font-size: 10px; font-weight: 800; border-radius: 999px; padding: 1px 5px">${e}</span>` : ''}</span><span class="xs" style="font-weight: ${x.id === davSel ? 800 : 700}; max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${esc(first(x.name))}</span></button>`; }).join('')}</div>` : '<div class="empty">Asosiy o\'quvchilar yo\'q</div>'}
          ${calHtml}
        </div>`;
    }
    bind.davomat = () => {
        root.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { davSel = b.dataset.sel; render(); });
        root.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => { const v = shiftMonth(davMonth, Number(b.dataset.mon)); if (v <= now().month) { davMonth = v; render(); } });
        root.querySelectorAll('[data-duty]').forEach(b => b.onclick = () => { davDuty = b.dataset.duty; render(); });
    };

    // ── Jadval (ustoz): kun va hafta ────────────────────────────────────────
    let jadDate = null;
    const weekSched = ws => lazy('sched:' + ws, () => api(`/api/school/schedule?from=${ws}&to=${addDays(ws, 6)}`));
    const viewsBy = c => Object.fromEntries((c.data?.views || []).filter(v => !S.me || !v.teacherId || v.teacherId === S.me.id).map(v => [v.date, v]));
    function dayStrip(ws, sel, attr, offDay) {
        return `<div class="days" role="tablist" aria-label="Hafta kunlari">${Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map(d =>
            `<button type="button" role="tab" aria-selected="${d === sel}" data-${attr}="${d}" class="${d === sel ? 'on' : offDay(d) ? 'off' : ''}"><span class="xs" style="font-weight: 700">${DAY[wdOf(d) - 1]}</span><b>${+d.slice(8)}</b></button>`).join('')}</div>`;
    }
    const workLabel = v => !v ? '' : v.noHours ? 'Ish vaqti kiritilmagan' : v.work?.length ? 'Ish vaqti ' + v.work.map(w => `${hm(w.start)}–${hm(w.end)}`).join(', ') : 'Dam olish kuni';
    function lessonMark(i, date) {
        const s = stuOf(i.studentId), n = now();
        if (i.kind !== 'lesson' || !s) return null;
        const st = markOf(s, date);
        const past = date < n.date || (date === n.date && n.min >= i.end);
        return st === 'present' ? 'present' : st === 'absent' ? 'absent' : past ? 'unmarked' : 'planned';
    }
    function jadvalDay(v, date) {
        if (!v) return '';
        const n = now(), rows = [];
        const next = date === n.date ? v.items.find(i => i.kind === 'lesson' && i.end > n.min) : null;
        for (const i of v.items) rows.push(i);
        if (date >= n.date) for (const f of v.free || []) {
            const start = date === n.date ? Math.max(f.start, Math.ceil(n.min / 30) * 30) : f.start;
            if (f.end - start >= 15) rows.push({ kind: 'free', start, end: f.end, trial: (v.trialFree || []).some(t => t.start < f.end && start < t.end) });
        }
        rows.sort((a, b) => a.start - b.start || (a.kind === 'free') - (b.kind === 'free'));
        const trialsById = Object.fromEntries((S.trials || []).map(l => [l.id, l]));
        const html = rows.map(i => {
            const s = stuOf(i.studentId), dur = i.end - i.start;
            if (i.kind === 'free') return `<div class="li"><span class="time">${hm(i.start)}</span><button type="button" class="blk free" data-qfree="${date}|${hm(i.start)}"><span class="small"><b>Bo'sh</b>${i.trial ? ' · sinovga ochiq' : ''} · ${hm(i.start)}–${hm(i.end)}</span></button></div>`;
            if (i.kind === 'close' || i.kind === 'leave') return `<div class="li"><span class="time">${hm(i.start)}</span><div class="blk shut"><span class="small"><b>${i.kind === 'leave' ? "Ta'til" : 'Yopiq'}</b>${i.reason ? ' · ' + esc(i.reason) : ''} · admin tasdiqladi</span></div></div>`;
            if (i.kind === 'trial') { const l = trialsById[i.leadId]; return `<div class="li"><span class="time">${hm(i.start)}</span><button type="button" class="blk mk" data-push="sinov"><span class="av s" style="display: inline-flex; align-items: center; justify-content: center; background: #FFFFFF; color: #53389E">${ico(I.users, 18)}</span><div class="col"><b class="small">Sinov · ${esc(l ? short(l.name) : 'lid')}</b><span class="xs muted">${dur} daq · ${i.status === 'hold' ? 'menejer ushlab turibdi' : i.status === 'pending' || (l && tReq(l).state === 'pending') ? 'tasdiqlash kerak' : 'tasdiqlangan'}</span></div></button></div>`; }
            if (i.kind === 'makeup') { const m = makeupOf(i); return `<div class="li"><span class="time">${hm(i.start)}</span><div class="blk mk">${s ? avatar(s) : ''}<div class="col" style="flex: 1; min-width: 0"><b class="small ell">Qoplash · ${esc(short(s?.name || ''))}</b><span class="xs muted">${m ? fmtDate(day10(m.missed_date)) + ' darsi uchun · ' : ''}${dur} daq${m?.status === 'review' ? ' · tekshiruvda' : m?.status === 'approved' ? ' · tasdiqlandi' : ''}</span></div>${heldBtn(i)}</div></div>`; }
            if (i.kind === 'reserved') return `<div class="li"><span class="time">${hm(i.start)}</span><div class="blk" style="opacity: .75">${s ? avatar(s) : ''}<div class="col"><b class="small">${esc(s?.name || i.studentName || '')}</b><span class="xs muted">muzlatilgan · joyi saqlanadi</span></div></div></div>`;
            const mk = lessonMark(i, date);
            const cls = mk === 'unmarked' ? 'warn' : mk === 'absent' ? 'bad' : i === next ? 'next' : '';
            const sub = `${dur} daq${mk === 'present' ? " · o'tildi ✓" : mk === 'absent' ? ' · kelmadi' : mk === 'unmarked' ? ' · belgilanmagan' : i === next ? ' · keyingi dars' : ''}`;
            return `<div class="li"><span class="time">${hm(i.start)}</span><button type="button" class="blk ${cls}"${s ? ` data-card="${esc(s.id)}"` : ''}>${s ? avatar(s) : ''}<div class="col" style="min-width: 0"><b class="small ell">${esc(s?.name || i.studentName || '')}</b><span class="xs muted">${sub}</span></div></button></div>`;
        }).join('');
        return html || `<div class="empty">${v.work?.length || v.noHours ? 'Bu kunda dars yo\'q' : 'Dam olish kuni'}</div>`;
    }
    function weekChip(i, date) {
        const s = stuOf(i.studentId), n = now();
        const name = first(s?.name || i.studentName || '');
        if (i.kind === 'makeup') return `<span class="wk" style="background: #F4EBFF">${hm(i.start)} ${esc(name)} · qoplash</span>`;
        if (i.kind === 'trial') { const l = (S.trials || []).find(x => x.id === i.leadId); return `<span class="wk" style="background: #F4EBFF">${hm(i.start)} ${esc(l ? first(l.name) : 'Lid')} · sinov</span>`; }
        if (i.kind === 'close' || i.kind === 'leave') return `<span class="wk" style="background: repeating-linear-gradient(135deg, #F2F4F7 0 6px, #E4E7EC 6px 12px)">${hm(i.start)}–${hm(i.end)} ${i.kind === 'leave' ? "ta'til" : 'yopiq'}</span>`;
        if (i.kind === 'reserved') return `<span class="wk" style="color: #4B5563">${hm(i.start)} ${esc(name)} · muzlatilgan</span>`;
        const mk = lessonMark(i, date);
        const bg = mk === 'present' ? '#DCFAE6' : mk === 'absent' ? '#FEE4E2' : mk === 'unmarked' ? '#FEF0C7' : date === n.date && i.end > n.min && i.start <= n.min + 120 ? '#EAF3FF' : '#EEF1F6';
        return `<span class="wk" style="background: ${bg}">${hm(i.start)} ${esc(name)}${mk === 'absent' ? ' ✕' : ''}</span>`;
    }
    PAGES.jadval = {
        nav: true,
        render(arg) {
            const n = now(); jadDate ||= n.date;
            const mode = arg === 'hafta' ? 'hafta' : 'kun';
            const ws = weekStart(jadDate), we = addDays(ws, 6);
            const c = weekSched(ws), by = viewsBy(c);
            const v = by[jadDate];
            const seg = `<div class="seg" role="tablist"><button type="button" role="tab" data-jm="kun" class="${mode === 'kun' ? 'on' : ''}" aria-selected="${mode === 'kun'}">Kun</button><button type="button" role="tab" data-jm="hafta" class="${mode === 'hafta' ? 'on' : ''}" aria-selected="${mode === 'hafta'}">Hafta</button></div>`;
            const all = Object.values(by).flatMap(x => x.items.map(i => ({ ...i, date: x.date })));
            if (mode === 'hafta') {
                const cnt = k => all.filter(i => i.kind === k).length;
                return `${header('Jadval', `${fmtDate(ws)} – ${fmtDate(we)}${c.data ? ` · ${cnt('lesson')} dars · ${cnt('makeup')} qoplash · ${cnt('trial')} sinov` : ''}`)}
                <div class="body">${seg}
                  ${c.err ? errBox(c, 'sched:' + ws) : !c.data ? skel(3) : `<section class="card" style="padding: 4px 14px" aria-label="Hafta"><div class="list">${Array.from({ length: 7 }, (_, k) => addDays(ws, k)).map(d => {
                      const dv = by[d], items = (dv?.items || []).slice().sort((a, b) => a.start - b.start);
                      return `<button type="button" class="li" data-jd="${d}" style="align-items: flex-start"><b class="small" style="width: 48px; flex: none; padding-top: 6px${d === n.date ? '; color: #0057B8' : ''}">${dayChip(d)}</b>${items.length ? `<div style="flex: 1; display: flex; flex-wrap: wrap; gap: 6px">${items.map(i => weekChip(i, d)).join('')}</div>` : `<span class="xs muted" style="padding-top: 6px">${dv?.work?.length ? "dars yo'q" : 'dam olish'}</span>`}</button>`;
                  }).join('')}</div></section>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px 12px" class="xs muted"><span><b style="color: #05603A">■</b> keldi</span><span><b style="color: #912018">■</b> kelmadi</span><span><b style="color: #93370D">■</b> belgilanmagan</span><span><b style="color: #53389E">■</b> qoplash / sinov</span><span><b style="color: #98A2B3">■</b> rejada</span></div>`}
                  <div class="between"><button type="button" class="btn sm" data-wk="-7">${ico(I.back, 18)}Oldingi</button><button type="button" class="btn sm" data-wk="7">Keyingi${ico(I.chev, 18)}</button></div>
                  <span class="xs muted" style="padding: 0 4px">Kunni bosing — kun ko'rinishi ochiladi. Oy ko'rinishi — kompyuterda.</span>
                </div>`;
            }
            const weekTrials = (S.trials || []).map(l => ({ l, at: tAt(l) })).filter(x => x.at && x.at.date >= ws && x.at.date <= we && trialPhase(x.l) !== 'past');
            const tPill = l => ({ pending: '<span class="pill warn">tasdiq</span>', result: '<span class="pill info">natija</span>', upcoming: '<span class="pill ok">tasdiqlangan</span>' }[trialPhase(l)] || '');
            return `${header('Jadval', `${workLabel(v) || 'Ish vaqti'} · Asia/Tashkent`)}
            <div class="body">${seg}
              ${dayStrip(ws, jadDate, 'jd', d => !by[d]?.work?.length && !by[d]?.items?.length && c.data)}
              ${c.err ? errBox(c, 'sched:' + ws) : !c.data ? skel(2) : `<section class="card" aria-label="${DAY_FULL[wdOf(jadDate) - 1]} jadvali" style="padding: 8px 14px"><div class="list">${jadvalDay(v, jadDate)}</div></section>`}
              <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><button type="button" class="btn pri" data-qoplash="">Qoplash qo'yish</button><button type="button" class="btn" data-vaqt="${jadDate >= n.date ? jadDate : n.date}">Vaqt so'rovi</button></div>
              ${S.trials ? `<section class="card" style="padding: 4px 14px" aria-label="Shu haftadagi sinovlar"><div class="list">
                <div class="li"><div class="col" style="flex: 1"><b class="small">Shu haftadagi sinovlar · ${weekTrials.length}</b></div><button type="button" class="small linkb" data-push="sinov">Hammasi</button></div>
                ${weekTrials.slice(0, 4).map(({ l, at }) => `<button type="button" class="li" data-push="sinov"><div class="col" style="flex: 1; min-width: 0"><b class="small ell">${esc(l.name)} · ${dayChip(at.date)} ${hm(at.min)}</b></div>${tPill(l)}${chev}</button>`).join('')}
              </div></section>` : ''}
              <span class="xs muted" style="padding: 0 4px">Oy ko'rinishi va ish vaqtini sozlash — kompyuterda.</span>
              <span class="xs muted" style="padding: 0 4px">Yashil vaqtni sotuv bo'limi sinov darsi uchun band qilishi mumkin. Vaqtni yopish yoki ochish — admin tasdig'i bilan.</span>
            </div>`;
        },
        bind(arg) {
            root.querySelectorAll('[data-jm]').forEach(b => b.onclick = () => { const t = top(); t.arg = b.dataset.jm === 'hafta' ? 'hafta' : ''; history.replaceState({ pages: S.pages, tab: S.tab }, '', hashFor()); render(); });
            root.querySelectorAll('[data-jd]').forEach(b => b.onclick = () => { jadDate = b.dataset.jd; if (arg === 'hafta') { top().arg = ''; history.replaceState({ pages: S.pages, tab: S.tab }, '', hashFor()); } render(); });
            root.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { jadDate = addDays(weekStart(jadDate || now().date), Number(b.dataset.wk)); render(); });
            root.querySelectorAll('[data-vaqt]').forEach(b => b.onclick = () => openVaqt(b.dataset.vaqt));
            root.querySelectorAll('[data-qfree]').forEach(b => b.onclick = () => { const [date, time] = b.dataset.qfree.split('|'); openQoplash(null, { date, time }); });
        },
    };

    // ── Qoplash qo'yish (alohida kunda / qo'shaloq dars) ────────────────────
    function openQoplash(studentId, preset = {}) {
        const n = now(), month = n.month;
        let sid = studentId && stuOf(studentId) ? studentId : null, mode = 'sep', missed = null, day = null, time = null, held = null, views = null, busy = false;
        const cands = S.main.filter(s => !s.frozen && uncovered(s).length);
        if (!sid && cands.length === 1) sid = cands[0].id;
        sheet('<div id="qb" style="display: flex; flex-direction: column; gap: 14px"></div>', (el, close) => {
            const box = el.querySelector('#qb');
            api(`/api/school/schedule?from=${n.date}&to=${monthEnd(month)}`).then(r => { views = viewsBy({ data: r }); draw(); }).catch(() => { views = {}; draw(); });
            function slotsFor(s, d) {
                const v = views?.[d]; if (!v) return [];
                const dur = Number(s.lessonDuration) || 30, out = [];
                for (const f of v.makeupFree || v.free || []) for (let t = Math.ceil(f.start / 30) * 30; t + dur <= f.end; t += 30) if (d > n.date || t > n.min) out.push(t);
                return out;
            }
            function draw() {
                if (!sid) {
                    box.innerHTML = `${sheetHead("Qoplash qo'yish", `${monName(month)} · kelmagan va qoplanmagan darslar`)}
                      ${cands.length ? `<div class="list">${cands.map(s => `<button type="button" class="li" data-pick="${esc(s.id)}">${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(s.name)}</b><span class="xs muted">${patternLabel(s.lessonDayOfWeek)} · ${uncovered(s).length} dars qoplanmagan</span></div>${chev}</button>`).join('')}</div>`
                        : '<div class="empty">Shu oyda qoplanmagan dars yo\'q</div>'}
                      <span class="xs muted">Qoplash shu oy ichida bo'ladi. Admin tasdiqlagach maoshga qo'shiladi.</span>`;
                    box.querySelectorAll('[data-close]').forEach(b => b.onclick = () => history.back());
                    box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { sid = b.dataset.pick; draw(); });
                    return;
                }
                const s = stuOf(sid), dur = Number(s.lessonDuration) || 30, miss = uncovered(s);
                if (!miss.includes(missed)) missed = miss[miss.length - 1] || null;
                const pat = patternOf(s);
                const days = [];
                for (let d = addDays(n.date, -6) < `${month}-01` ? `${month}-01` : addDays(n.date, -6); d <= monthEnd(month); d = addDays(d, 1)) {
                    if (pat.includes(wdOf(d)) || (d < n.date && wdOf(d) === 7)) continue;
                    if (d < n.date) days.push(d); else if (views && slotsFor(s, d).length) days.push(d);
                }
                if (preset.date && days.includes(preset.date) && !day) { day = preset.date; time = preset.time ? toMin(preset.time) : null; }
                if (!days.includes(day)) day = days.find(d => d >= n.date) || days[days.length - 1] || null;
                const slots = day && day >= n.date ? slotsFor(s, day) : [];
                if (!slots.includes(time)) time = slots[0] ?? null;
                const presentDays = lessonDays(s, month).filter(c => c.date <= n.date && markOf(s, c.date) === 'present' && !S.makeups.some(m => m.student_id === s.id && m.kind === 'double' && day10(m.held_date) === c.date && m.status !== 'rejected')).map(c => c.date).reverse();
                if (!presentDays.includes(held)) held = presentDays[0] || null;
                const past = day && day < n.date;
                const radio = miss.length ? `<fieldset style="border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px"><legend class="lbl" style="margin-bottom: 8px">Qaysi dars o'rniga?</legend>${miss.slice().reverse().map(d => `<label class="rad${d === missed ? ' on' : ''}"><input type="radio" name="qd" value="${d}"${d === missed ? ' checked' : ''}><span class="col"><b class="small">${dayLong(d)}</b><span class="xs muted">kelmagan · hali qoplanmagan</span></span></label>`).join('')}</fieldset>` : '<div class="note">Bu o\'quvchida shu oyda qoplanmagan dars yo\'q.</div>';
                box.innerHTML = `${sheetHead(`Qoplash · ${esc(short(s.name))}`, `dars kunlari ${patternLabel(s.lessonDayOfWeek)} · ${dur} daq`, avatar(s, 'av'))}
                  <div class="seg" role="tablist"><button type="button" role="tab" data-qm="sep" class="${mode === 'sep' ? 'on' : ''}" aria-selected="${mode === 'sep'}">Alohida kunda</button><button type="button" role="tab" data-qm="dbl" class="${mode === 'dbl' ? 'on' : ''}" aria-selected="${mode === 'dbl'}">Qo'shaloq dars</button></div>
                  ${radio}
                  ${!miss.length ? '' : mode === 'sep' ? `
                    <div class="field"><span class="lbl">Kun · dars kuni emas, shu oy ichida</span>${!views ? '<div class="skel" style="height: 48px"></div>' : days.length ? `<div class="slots">${days.map(d => `<button type="button" class="btn sm${d === day ? ' pri' : ''}" data-day="${d}">${dayChip(d)}${d < n.date ? ' · o\'tdi' : ''}</button>`).join('')}</div>` : '<span class="small muted">Shu oyda bo\'sh kun qolmadi</span>'}</div>
                    ${day && !past ? `<div class="field"><span class="lbl">Bo'sh vaqt · ${dayChip(day)} · ${dur} daq sig'adi</span><div class="slots">${slots.slice(0, 8).map(t => `<button type="button" class="btn sm${t === time ? ' pri' : ''}" data-time="${t}">${hm(t)}</button>`).join('')}</div></div>
                      <div class="note">Vaqt jadvalingizda band bo'ladi va sotuvga yopiladi. Dars o'tgach "O'tildi" deysiz — admin tasdiqlagach maoshga qo'shiladi.</div>` : ''}
                    ${past ? '<div class="note w">Bu kun o\'tgan: qoplash darsini o\'sha kuni o\'tgan bo\'lsangiz, darhol tekshiruvga yuboriladi — admin tasdiqlaydi.</div>' : ''}
                    <div style="display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px"><button type="button" class="btn" data-close>Bekor</button><button type="button" class="btn pri" data-go${!missed || !day || (!past && time == null) || busy ? ' disabled' : ''}>${past ? 'Tekshiruvga yuborish' : "Rejaga qo'yish"}</button></div>`
                  : `<div class="field"><span class="lbl">Qaysi darsda ikki dars vaqtini o'tdingiz?</span>${presentDays.length ? `<div class="slots">${presentDays.slice(0, 6).map(d => `<button type="button" class="btn sm${d === held ? ' pri' : ''}" data-held2="${d}">${dayChip(d)}</button>`).join('')}</div>` : '<span class="small muted">Shu oyda "Keldi" belgilangan dars yo\'q. Keyingi darsda Davomat → "Keldi · 2 dars"ni tanlang.</span>'}</div>
                    <div class="note">Qo'shaloq dars kamida 2 × ${dur} = ${dur * 2} daqiqa bo'lishi kerak. Admin tasdiqlagach maoshga qo'shiladi.</div>
                    <div style="display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px"><button type="button" class="btn" data-close>Bekor</button><button type="button" class="btn pri" data-go${!missed || !held || busy ? ' disabled' : ''}>Keldi · 2 dars</button></div>`}`;
                box.querySelectorAll('[data-close]').forEach(b => b.onclick = () => history.back());
                box.querySelectorAll('[data-qm]').forEach(b => b.onclick = () => { mode = b.dataset.qm; draw(); });
                box.querySelectorAll('input[name="qd"]').forEach(b => b.onchange = () => { missed = b.value; draw(); });
                box.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { day = b.dataset.day; time = null; draw(); });
                box.querySelectorAll('[data-time]').forEach(b => b.onclick = () => { time = Number(b.dataset.time); draw(); });
                box.querySelectorAll('[data-held2]').forEach(b => b.onclick = () => { held = b.dataset.held2; draw(); });
                const goBtn = box.querySelector('[data-go]');
                if (goBtn) goBtn.onclick = async () => {
                    busy = true; goBtn.disabled = true;
                    try {
                        let r;
                        if (mode === 'dbl') r = await api('/api/school/makeups/double', { method: 'POST', body: { studentId: sid, missedDate: missed, heldDate: held } });
                        else if (past) r = await api('/api/school/makeups/separate', { method: 'POST', body: { studentId: sid, missedDate: missed, heldDate: day } });
                        else r = await api('/api/school/makeups/plan', { method: 'POST', body: { kind: 'makeup', teacherId: S.me.id, studentId: sid, missedDate: missed, date: day, time: hm(time), duration: dur } });
                        if (r.makeup) S.makeups.unshift(r.makeup);
                        drop('sched:'); close(); toast(mode === 'dbl' || past ? "Qoplash tekshiruvga yuborildi" : `Qoplash ${dayChip(day)} ${hm(time)} ga qo'yildi`); render();
                    } catch (err) { busy = false; toast(err.message); draw(); }
                };
            }
            draw();
        });
    }

    // ── Vaqt so'rovi (yopish / ochish / ta'til) ─────────────────────────────
    function openVaqt(date) {
        const n = now();
        let type = 'close', day = date && date >= n.date ? date : n.date, from = '17:00', to = '19:00', reason = 'Shifokor', views = null, busy = false;
        const REAS = ['Shifokor', 'Oilaviy', "O'qish", 'Boshqa'];
        const days = Array.from({ length: 8 }, (_, k) => addDays(n.date, k)).filter(d => wdOf(d) !== 7 || d === day);
        sheet('<div id="vb" style="display: flex; flex-direction: column; gap: 14px"></div>', (el, close) => {
            const box = el.querySelector('#vb');
            api(`/api/school/schedule?from=${n.date}&to=${addDays(n.date, 8)}`).then(r => { views = viewsBy({ data: r }); draw(); }).catch(() => { views = {}; draw(); });
            function hint() {
                const v = views?.[day]; if (!v) return '';
                const a = type === 'leave' ? 0 : toMin(from), b = type === 'leave' ? 1440 : toMin(to);
                if (a == null || b == null || b <= a) return '<div class="note w">Boshlanish tugashdan oldin bo\'lsin.</div>';
                if (type === 'open') return `<div class="note">${dayChip(day)} · ${hm(a)}–${hm(b)} ish vaqtingizga qo'shiladi va sinov uchun ochiladi. Admin tasdiqlagach kuchga kiradi.</div>`;
                const clash = v.items.filter(i => ['lesson', 'makeup', 'trial'].includes(i.kind) && i.start < b && a < i.end);
                const trialMin = (v.trialFree || []).reduce((m, f) => m + Math.max(0, Math.min(f.end, b) - Math.max(f.start, a)), 0);
                return `<div class="note w">${dayChip(day)} · ${type === 'leave' ? 'butun kun' : `${hm(a)}–${hm(b)}`} ${clash.length ? `da <b>${clash.length} ta dars bor</b> (${clash.map(i => `${esc(first(stuOf(i.studentId)?.name || (i.kind === 'trial' ? 'sinov' : '')))} ${hm(i.start)}`).join(', ')}) — admin hal qiladi` : "da darsingiz yo'q"}${trialMin >= 30 ? ` · ${Math.floor(trialMin / 30)} ta sinov oynasi yopiladi` : ''}. Admin tasdiqlagach kuchga kiradi.</div>`;
            }
            function draw() {
                const mine = (S.requests || []).filter(r => ['close', 'open', 'leave'].includes(r.type)).slice(0, 4);
                const label = r => { const p = r.payload || {}; return `${p.date ? dayChip(day10(p.date)) : ''}${p.from && r.type !== 'leave' ? ` · ${p.from}–${p.to}` : ''} ${r.type === 'close' ? 'yopish' : r.type === 'open' ? 'ochish' : "ta'til"}`; };
                const st = r => r.status === 'approved' ? '<span class="pill ok">Tasdiqlandi</span>' : r.status === 'rejected' ? '<span class="pill bad">Rad etildi</span>' : '<span class="pill warn">Kutilmoqda</span>';
                box.innerHTML = `${sheetHead("Vaqt so'rovi")}
                  <div class="seg" role="tablist">${[['close', 'Yopish'], ['open', 'Ochish'], ['leave', "Ta'til"]].map(([k, l]) => `<button type="button" role="tab" data-vt="${k}" class="${type === k ? 'on' : ''}" aria-selected="${type === k}">${l}</button>`).join('')}</div>
                  <div class="field"><span class="lbl">Kun</span><div class="slots">${days.map(d => `<button type="button" class="btn sm${d === day ? ' pri' : ''}" data-vd="${d}">${dayChip(d)}</button>`).join('')}</div></div>
                  ${type !== 'leave' ? `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><div class="field" style="min-width: 0"><label class="lbl" for="v1">Boshlanishi</label><input id="v1" type="time" step="900" value="${from}" style="width: 100%; min-width: 0"></div><div class="field" style="min-width: 0"><label class="lbl" for="v2">Tugashi</label><input id="v2" type="time" step="900" value="${to}" style="width: 100%; min-width: 0"></div></div>` : ''}
                  <div class="field"><span class="lbl">Sabab</span><div class="pick">${REAS.map(r => `<button type="button" data-vr="${esc(r)}" class="${r === reason ? 'on' : ''}">${esc(r)}</button>`).join('')}</div></div>
                  <div class="field"><label class="lbl" for="vz">Izoh${reason === 'Boshqa' ? '' : ' (ixtiyoriy)'}</label><input id="vz" type="text" maxlength="200" placeholder="${type === 'open' ? 'masalan: sinov uchun' : 'qisqacha'}"></div>
                  <div id="vh">${hint()}</div>
                  <button type="button" class="btn pri w" data-send${busy ? ' disabled' : ''}>So'rov yuborish</button>
                  ${mine.length ? `<div class="list">${mine.map(r => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${label(r)}</b><span class="xs muted ell" style="font-weight: 600">${esc(r.reason || '')}${r.decision_note ? ' · ' + esc(r.decision_note) : ''}</span></div>${st(r)}</div>`).join('')}</div>` : ''}`;
                box.querySelectorAll('[data-close]').forEach(b => b.onclick = () => history.back());
                box.querySelectorAll('[data-vt]').forEach(b => b.onclick = () => { type = b.dataset.vt; draw(); });
                box.querySelectorAll('[data-vd]').forEach(b => b.onclick = () => { day = b.dataset.vd; draw(); });
                box.querySelectorAll('[data-vr]').forEach(b => b.onclick = () => { reason = b.dataset.vr; const z = box.querySelector('#vz').value; draw(); box.querySelector('#vz').value = z; });
                const upd = () => { from = box.querySelector('#v1')?.value || from; to = box.querySelector('#v2')?.value || to; box.querySelector('#vh').innerHTML = hint(); };
                box.querySelector('#v1')?.addEventListener('change', upd); box.querySelector('#v2')?.addEventListener('change', upd);
                box.querySelector('[data-send]').onclick = async () => {
                    const note = box.querySelector('#vz').value.trim();
                    const text = reason === 'Boshqa' ? note : note ? `${reason}: ${note}` : reason;
                    if (text.length < 3) return toast('Sababni yozing');
                    if (type !== 'leave' && !(toMin(to) > toMin(from))) return toast('Vaqt oralig\'i noto\'g\'ri');
                    busy = true; box.querySelector('[data-send]').disabled = true;
                    try {
                        const r = await api('/api/school/requests', { method: 'POST', body: { type, date: day, ...(type === 'leave' ? {} : { from, to }), reason: text } });
                        if (r.request) S.requests = [r.request, ...(S.requests || [])];
                        close(); toast("So'rov adminga yuborildi");
                    } catch (err) { busy = false; toast(err.message); draw(); }
                };
            }
            draw();
        });
    }

    // ── Sinov darslari ──────────────────────────────────────────────────────
    let sinovTab = 'now';
    PAGES.sinov = {
        render() {
            const c = lazy('trials', () => api('/api/trial-lessons').then(r => { S.trials = r.lessons || []; return S.trials; }));
            const list = c.data || S.trials || [];
            const n = now();
            const cur = list.filter(l => trialPhase(l) !== 'past').sort((a, b) => ['pending', 'result', 'upcoming'].indexOf(trialPhase(a)) - ['pending', 'result', 'upcoming'].indexOf(trialPhase(b)) || String(tReq(a).scheduledAt).localeCompare(String(tReq(b).scheduledAt)));
            const past = list.filter(l => trialPhase(l) === 'past').sort((a, b) => String(tReq(b).scheduledAt).localeCompare(String(tReq(a).scheduledAt)));
            const when = l => { const at = tAt(l), r = tReq(l); const rel = at ? dayRel(at.date) : ''; return at ? `${/^(Bugun|Ertaga|Kecha)$/.test(rel) ? rel + ', ' : ''}${DAY[wdOf(at.date) - 1]} ${fmtDate(at.date)} · ${hm(at.min)}${r.daysCount > 1 ? ` · ${r.daysCount} kun` : ''}` : 'vaqti ko\'rsatilmagan'; };
            const card = l => {
                const p = trialPhase(l), r = tReq(l), mgr = trialManager(l), id = esc(l.id);
                if (p === 'pending') return `<section class="card" style="display: flex; flex-direction: column; gap: 12px">
                    <div class="between"><span class="pill warn">Tasdiqlash kerak</span><span class="xs muted">${esc(ago(r.requestedAt))}</span></div>
                    <div class="col"><h2>${esc(l.name)}</h2><span class="small muted">${when(l)}</span></div>
                    ${mgr ? `<div class="between small"><span class="muted">Sotuv menejeri</span><b>${esc(short(mgr))}</b></div>` : ''}
                    <div class="note">Tasdiqlamaguningizcha vaqt lidga yuborilmaydi. Rad etsangiz, menejer boshqa vaqt tanlaydi.</div>
                    <div style="display: grid; gap: 8px"><button type="button" class="btn pri" data-tact="accept" data-id="${id}">Tasdiqlash</button><button type="button" class="btn no" data-tact="reject" data-id="${id}">Vaqt to'g'ri kelmaydi</button></div></section>`;
                if (p === 'result') return `<section class="card" style="display: flex; flex-direction: column; gap: 12px">
                    <div class="between"><span class="pill info">Natija kerak</span><span class="xs muted">${tAt(l) ? `${dayRel(tAt(l).date).toLowerCase()} ${hm(tAt(l).min)} o'tdi` : ''}</span></div>
                    <div class="col"><h2>${esc(l.name)}</h2><span class="small muted">${when(l)}</span></div>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><button type="button" class="btn okb" data-tact="done" data-id="${id}">O'tkazildi</button><button type="button" class="btn" data-tact="noshow" data-id="${id}">Lid kelmadi</button></div>
                    <span class="xs muted">Natija yozilgach vaqt bo'shaydi va sotuv menejeriga boradi.</span></section>`;
                return `<section class="card" style="display: flex; flex-direction: column; gap: 6px"><div class="between"><span class="pill ok">Tasdiqlangan · yaqin</span><span class="xs muted">${r.acceptedAt ? 'siz tasdiqladingiz ' + fmtDate(tz(r.acceptedAt).date) : ''}</span></div>
                    <div class="col"><h2>${esc(l.name)}</h2><span class="small muted">${when(l)}${mgr ? ' · ' + esc(short(mgr)) : ''}</span></div></section>`;
            };
            const month = past.filter(l => tAt(l)?.date.slice(0, 7) === n.month);
            const done = month.filter(l => tReq(l).state === 'completed' && tReq(l).attended).length;
            const missed = month.filter(l => tReq(l).state === 'completed' && !tReq(l).attended).length;
            const rej = month.filter(l => tReq(l).state === 'rejected').length;
            return `${pageHead(h1('Sinov darslari'), "Sotuv bo'limi band qilgan vaqtlar")}
            <div class="body" style="padding-bottom: 24px">
              <div class="seg" role="tablist"><button type="button" role="tab" data-st="now" class="${sinovTab === 'now' ? 'on' : ''}" aria-selected="${sinovTab === 'now'}">Kutilmoqda · ${cur.length}</button><button type="button" role="tab" data-st="past" class="${sinovTab === 'past' ? 'on' : ''}" aria-selected="${sinovTab === 'past'}">O'tgan · ${past.length}</button></div>
              ${c.err && !list.length ? errBox(c, 'trials') : c.loading && !list.length ? skel(2) : sinovTab === 'now'
                ? (cur.map(card).join('') || '<div class="card empty">Kutilayotgan sinov darsi yo\'q</div>')
                : `<div class="kpis"><div class="kpi"><span>${cap1(monName(n.month))}</span><b>${month.length}</b><span>sinov</span></div><div class="kpi"><span>O'tkazildi</span><b>${done}</b><span>${missed} kelmadi</span></div><div class="kpi"><span>Rad etildi</span><b>${rej}</b><span>vaqt mos emas</span></div></div>
                   <div class="card" style="padding: 4px 14px"><div class="list">${past.map(l => { const r = tReq(l), at = tAt(l); return `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(l.name)}</b><span class="xs muted">${at ? fmtDate(at.date) : ''} · ${r.state === 'rejected' ? 'rad etildi' + (r.reasonLabel ? ' · ' + esc(r.reasonLabel) : '') : r.attended ? "O'tkazildi" : 'Lid kelmadi'}</span></div>${r.state === 'rejected' ? '<span class="pill mute">rad</span>' : r.attended ? '<span class="pill ok">o\'tdi</span>' : '<span class="pill bad">kelmadi</span>'}</div>`; }).join('') || '<div class="empty">O\'tgan sinov yo\'q</div>'}</div></div>`}
              <span class="xs muted" style="padding: 0 4px">Sotuv bo'limi lidni keyingi bosqichga o'tkazgach, sinov bu ro'yxatdan chiqadi. Sotuv natijasi va konversiya ustozga ko'rsatilmaydi.</span>
            </div>`;
        },
        bind() {
            root.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { sinovTab = b.dataset.st; render(); });
            root.querySelectorAll('[data-tact]').forEach(b => b.onclick = () => {
                const l = (S.trials || []).find(x => x.id === b.dataset.id); if (!l) return;
                const a = b.dataset.tact;
                if (a === 'reject') return openSinovRad(l, 'reject');
                if (a === 'noshow') return openSinovRad(l, 'noshow');
                trialSend(l, a === 'accept' ? { action: 'accept' } : { action: 'outcome', attended: true }, b);
            });
        },
    };
    async function trialSend(l, payload, btn) {
        if (btn) btn.disabled = true;
        try {
            const r = await api(`/api/trial-lessons/${encodeURIComponent(l.id)}`, { method: 'POST', body: { requestId: tReq(l).id, ...payload } });
            const i = (S.trials || []).findIndex(x => x.id === l.id); if (i >= 0 && r.lesson) S.trials[i] = r.lesson;
            if (cache.trials?.data) cache.trials.data = S.trials;
            toast(payload.action === 'accept' ? 'Sinov tasdiqlandi' : payload.action === 'reject' ? 'Menejerga yuborildi' : 'Natija yozildi'); render();
            return true;
        } catch (err) { toast(err.message); if (btn) btn.disabled = false; return false; }
    }
    function openSinovRad(l, mode) {
        const at = tAt(l), mgr = trialManager(l);
        const reasons = mode === 'reject' ? REASONS.filter(r => r.id !== 'attended-wants-other-teacher') : REASONS.filter(r => r.id !== 'teacher-late');
        let pick = mode === 'reject' ? (reasons.find(r => r.id === 'teacher-rescheduled') || reasons[0])?.id : 'student-missed';
        sheet(`${sheetHead(mode === 'reject' ? "Vaqt to'g'ri kelmaydi" : "Sinov o'tmadi", `${esc(l.name)}${at ? ` · ${dayChip(at.date)} · ${hm(at.min)}` : ''}`)}
            <div class="field"><span class="lbl">Sabab</span><div class="pick" style="flex-direction: column; align-items: stretch">${reasons.map(r => `<button type="button" data-rid="${r.id}" class="${r.id === pick ? 'on' : ''}" style="text-align: left; border-radius: 14px">${esc(r.label)}</button>`).join('')}</div></div>
            <div class="note">${mode === 'reject' ? `${mgr ? esc(short(mgr)) + 'ga' : 'Sotuv menejeriga'} boradi. U lid bilan kelishib, yangi vaqtni band qiladi — siz yana tasdiqlaysiz.` : 'Natija lid tarixiga yoziladi va sotuv menejeriga boradi.'}</div>
            <button type="button" class="btn pri w" data-send>Yuborish</button>`,
        (el, close) => {
            el.querySelectorAll('[data-rid]').forEach(b => b.onclick = () => { pick = b.dataset.rid; el.querySelectorAll('[data-rid]').forEach(x => x.classList.toggle('on', x === b)); });
            el.querySelector('[data-send]').onclick = async e => {
                const btn = e.currentTarget; btn.disabled = true;
                const payload = mode === 'reject' ? { action: 'reject', reasonId: pick } : { action: 'outcome', attended: pick === 'attended-wants-other-teacher', reasonId: pick };
                try {
                    const r = await api(`/api/trial-lessons/${encodeURIComponent(l.id)}`, { method: 'POST', body: { requestId: tReq(l).id, ...payload } });
                    const i = (S.trials || []).findIndex(x => x.id === l.id); if (i >= 0 && r.lesson) S.trials[i] = r.lesson;
                    if (cache.trials?.data) cache.trials.data = S.trials;
                    close(); toast(mode === 'reject' ? 'Menejerga yuborildi' : 'Natija yozildi'); render();
                } catch (err) { toast(err.message); btn.disabled = false; }
            };
        });
    }

    // ── Maosh (ustoz) ───────────────────────────────────────────────────────
    function payChart(hist, current, month) {
        const pts = [...hist.filter(h => h.start && h.start.slice(0, 7) < month).slice(0, 5).reverse().map(h => ({ m: h.start.slice(0, 7), v: h.amount })), ...(current != null ? [{ m: month, v: current, cur: true }] : [])];
        if (pts.length < 2) return '';
        const max = Math.max(...pts.map(p => p.v), 1);
        return `<section class="card" style="display: flex; flex-direction: column; gap: 10px"><div class="between"><h3>${pts.length} oy · mln so'm</h3><span class="xs muted">to'langan + joriy</span></div>
          <div style="display: flex; align-items: flex-end; gap: 8px; height: 100px">${pts.map(p => `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1"><span class="xs" style="font-weight: 700">${(p.v / 1e6).toFixed(2).replace('.', ',')}</span><span style="width: 100%; height: ${Math.max(4, Math.round(p.v / max * 60))}px; border-radius: 8px; background: ${p.cur ? '#0065D6' : '#CFE3FB'}"></span><span class="xs muted">${MON_S[+p.m.slice(5) - 1]}</span></div>`).join('')}</div></section>`;
    }
    const lastPaid = () => (S.salary?.history || []).find(h => h.paidAt || h.status === 'paid');
    function payStepper(month) {
        const nm = shiftMonth(month, 1);
        return `<section class="card"><h3>To'lov qachon</h3><div class="stepper" style="margin-top: 6px">
          <div class="st now"><i>1</i><div class="col"><b class="small">Oy yopiladi</b><span class="xs muted">1-${MON[+nm.slice(5) - 1]} 00:00 · avtomatik</span></div></div>
          <div class="st"><i>2</i><div class="col"><b class="small">Moliya hisoblaydi va tasdiqlaydi</b><span class="xs muted">belgilangan davomat va tasdiqlangan qoplashlar bo'yicha</span></div></div>
          <div class="st"><i>3</i><div class="col"><b class="small">To'lov</b><span class="xs muted">holati shu yerda ko'rinadi</span></div></div></div></section>`;
    }
    PAGES.maosh = {
        render() {
            if (isAssistantOnly()) return PAGES.ymaosh.render();
            const n = now(), sal = S.salary, cur = sal?.current;
            const rows = S.main.map(s => ({ s, m: monthStats(s, n.month) })).sort((a, b) => a.m.counted / (a.m.plan || 1) - b.m.counted / (b.m.plan || 1));
            const tot = rows.reduce((a, { m }) => { a.c += m.counted; a.p += m.plan; a.r += m.review; return a; }, { c: 0, p: 0, r: 0 });
            const unc = S.main.reduce((a, s) => a + uncovered(s).length, 0);
            const per = cur?.mainLessons > 0 && cur?.mainTotal ? cur.mainTotal / cur.mainLessons : null;
            const paid = lastPaid();
            const [showAll] = [top()?.arg === 'all'];
            return `${pageHead(h1(`Maosh · ${monName(n.month)}`), "Belgilangan davomat va aloqalar bo'yicha")}
            <div class="body" style="padding-bottom: 24px">
              ${!sal ? '<div class="note w">Maosh ma\'lumoti yuklanmadi.</div>' : !sal.linked ? '<div class="note w">Akkauntingiz HR profiliga biriktirilmagan — maosh ko\'rinmaydi. Administratorga murojaat qiling.</div>' : `
              <section class="card" style="display: flex; flex-direction: column; gap: 10px">
                <span class="lbl">Hisoblangan · hozirgacha</span>
                <span class="big">${cur ? money(cur.total) : '—'} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span>
                <div class="list">
                  <div class="li"><div class="col" style="flex: 1"><b class="small">Asosiy ustozlik</b><span class="xs muted">${tot.c} / ${tot.p} dars hisobga o'tdi</span></div><b>${money(cur?.mainTotal ?? cur?.total ?? 0)}</b></div>
                  ${cur?.assistantTotal || hasHelped() ? `<div class="li"><div class="col" style="flex: 1"><b class="small">Yordamchi ustozlik</b><span class="xs muted">${cur?.assistantLessons ?? S.assist?.counted ?? 0} aloqa × ${money(RATE)}</span></div><b>${money(cur?.assistantTotal ?? 0)}</b></div>` : ''}
                  ${cur?.adjustmentTotal ? `<div class="li"><div class="col" style="flex: 1"><b class="small">Tuzatishlar</b><span class="xs muted">moliya kiritgan</span></div><b>${money(cur.adjustmentTotal)}</b></div>` : ''}
                  ${tot.r ? `<div class="li"><div class="col" style="flex: 1"><b class="small">Qoplash · tekshiruvda</b><span class="xs muted">admin tasdiqlasa qo'shiladi</span></div><span class="pill warn">+${tot.r} dars</span></div>` : ''}
                </div>
              </section>`}
              <section class="card" style="display: flex; flex-direction: column; gap: 4px">
                <div class="between"><h3>O'quvchilar bo'yicha · darslar</h3><span class="xs muted">summa ko'rsatilmaydi</span></div>
                <div class="list">${(showAll ? rows : rows.slice(0, 4)).map(({ s, m }) => `<div class="li tap" data-card="${esc(s.id)}">${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><b class="small ell">${esc(s.name)}</b><span class="xs muted">${Number(s.lessonDuration) || 30} daq${m.review ? ` · +${m.review} qoplash` : ''}${m.kelmadi ? ` · ${m.kelmadi} kelmadi` : ''}</span></div><b class="small">${m.counted} / ${m.plan}</b></div>`).join('') || '<div class="empty">Asosiy o\'quvchi yo\'q</div>'}
                  ${!showAll && rows.length > 4 ? `<button type="button" class="li" data-all><span class="small muted" style="flex: 1">yana ${rows.length - 4} o'quvchi</span><b class="small" style="color: #0057B8">Hammasi</b></button>` : ''}</div>
              </section>
              ${payStepper(n.month)}
              ${unc ? `<div class="note w"><b>${unc} dars qoplanmagan${per ? ` · ≈${money(Math.round(unc * per / 100) * 100)} so'm` : ''}.</b> ${fmtDate(monthEnd(n.month))}gacha qoplasangiz maoshga qo'shiladi. <button type="button" class="linkb" data-qoplash="" style="min-height: 0; display: inline; padding: 6px 0">Qoplash qo'yish</button></div>` : ''}
              ${sal?.linked ? payChart(sal.history || [], cur?.total ?? null, n.month) : ''}
              ${paid ? `<div class="between small" style="padding: 0 4px"><span class="muted">${cap1(monName(paid.start.slice(0, 7)))}</span><b>${money(paid.amount)} so'm${paid.paidAt ? ' · to\'langan ' + fmtDate(tz(paid.paidAt).date) : ' · to\'langan'}</b></div>` : ''}
            </div>`;
        },
        bind() { root.querySelector('[data-all]')?.addEventListener('click', () => { top().arg = 'all'; render(); }); if (isAssistantOnly()) PAGES.ymaosh.bind?.(); },
    };

    // ── Reyting ─────────────────────────────────────────────────────────────
    PAGES.reyting = {
        render() {
            const c = lazy('rating', () => api('/api/state/teacher-rating').then(r => { S.rating = r; return r; }));
            const r = c.data || S.rating, n = now();
            const rows = r?.rows || [], mine = rows.find(x => x.id === r?.selfId);
            const lang = S.me?.lang === 'russian' || S.me?.role === 'rus-oqituvchi' ? 'Rus tili' : 'Ingliz tili';
            let hint = '';
            if (mine) {
                const above = rows[mine.rank - 2];
                const gain = mine.davomatPct < 90 ? Math.round((90 - mine.davomatPct) * (mine.learnPct == null ? 1 : 0.6)) : 0;
                hint = `${above ? `${mine.rank - 1}-o'ringacha ${Math.max(1, above.score - mine.score)} ball.` : "Siz birinchisiz."}${gain ? ` Davomatni 90% ga chiqarsangiz — +${gain} ball.` : ''}`;
            }
            const shown = rows.filter(x => x.rank <= 5 || x.id === r?.selfId);
            const rest = rows.filter(x => !shown.includes(x));
            return `${pageHead(h1('Ustozlar reytingi'), `${cap1(monName(n.month))} · ${lang}${rows.length ? ` · ${rows.length} ustoz` : ''}`)}
            <div class="body" style="padding-bottom: 24px">
              ${c.err && !r ? errBox(c, 'rating') : !r ? skel(2) : `
              ${mine ? `<section class="hero"><span class="eyebrow">Sizning o'rningiz</span><span class="t">${mine.rank}-o'rin · ${mine.score} ball</span><span class="s">${hint}</span></section>` : '<div class="note">Bu oy reytingda hali o\'rningiz yo\'q — darslar belgilangach paydo bo\'ladi.</div>'}
              <div class="card" style="padding: 4px 14px"><div class="list">${shown.map(x => `<div class="li"${x.id === r.selfId ? ' style="background: #EAF3FF; border-radius: 14px; padding-left: 8px; padding-right: 8px"' : ''}><b style="width: 22px">${x.rank}</b>${initials(x.name)}<div class="col" style="flex: 1; min-width: 0"><b class="small ell">${esc(x.name)}${x.id === r.selfId ? ' · siz' : ''}</b><span class="xs muted">davomat ${x.davomatPct}%${x.learnPct != null ? ` · o'zl. ${x.learnPct}%` : ''}</span></div><b>${x.score}</b></div>`).join('') || '<div class="empty">Reyting hali shakllanmagan</div>'}
                ${rest.length ? `<div class="li"><span class="small muted" style="flex: 1">yana ${rest.length} ustoz · ${Math.min(...rest.map(x => x.score))}–${Math.max(...rest.map(x => x.score))} ball</span></div>` : ''}</div></div>`}
              <div class="note"><b>Ball = davomat ${Math.round((r?.formula?.attendance ?? 0.6) * 100)}% + o'quvchilar o'zlashtirishi ${Math.round((r?.formula?.learning ?? 0.4) * 100)}%</b> (uy vazifasi, 1-urinish). Faqat "Keldi" belgilangan darslar hisoblanadi. Yordamchi aloqalari reytingga kirmaydi.</div>
            </div>`;
        },
    };

    // ── Bildirishnomalar (jadval, davomat, qoplash, so'rov va sinovlardan yig'iladi) ──
    function notifEvents() {
        const n = now(), ev = [], since = Date.now() - 7 * 86400000;
        const at = (date, min = 0) => Date.parse(`${date}T00:00:00Z`) + (min - 300) * 60000;
        if (isAssistantOnly() || hasHelped()) {
            for (const s of S.helped.filter(x => !x.frozen && adviceDays(x.lessonDayOfWeek).includes(n.wd))) {
                const c = contactsToday(s.id), ok = c.some(x => x.outcome === 'contacted'), na = c.find(x => x.outcome === 'no_answer');
                if (ok) continue;
                ev.push(na ? { cat: 'aloqa', tone: 'bad', ic: I.phone, title: 'Qayta urinish kerak', sub: `${esc(s.name)} · javob bermadi`, t: at(n.date, toMin(s.lessonTime) ?? 600), act: `<button type="button" class="btn sm pri" data-contact="${esc(s.id)}">Qayta</button>` }
                    : { cat: 'aloqa', tone: 'info', ic: I.phone, title: `Aloqa tavsiyasi${s.lessonTime ? ' · ' + esc(s.lessonTime) : ''}`, sub: `${esc(s.name)} · bu hafta ${weekCount(s.id)}/3`, t: at(n.date, (toMin(s.lessonTime) ?? 600) - 10), act: `<button type="button" class="btn sm pri" data-contact="${esc(s.id)}">Belgilash</button>` });
            }
        }
        for (const l of S.trials || []) {
            const p = trialPhase(l), r = tReq(l), a = tAt(l);
            if (p === 'pending') ev.push({ cat: 'sinov', tone: 'warn', ic: I.users, title: 'Sinov band qilindi — tasdiqlang', sub: `${esc(l.name)}${a ? ` · ${dayRel(a.date).toLowerCase()} ${hm(a.min)}` : ''}${trialManager(l) ? ' · ' + esc(short(trialManager(l))) : ''}`, t: Date.parse(r.requestedAt) || Date.now(), act: '<button type="button" class="btn sm pri" data-push="sinov">Tasdiqlash</button>' });
            if (p === 'result') ev.push({ cat: 'sinov', tone: 'info', ic: I.users, title: 'Sinov natijasini yozing', sub: `${esc(l.name)}${a ? ` · ${fmtDate(a.date)} ${hm(a.min)}` : ''}`, t: a ? a.t + 30 * 60000 : Date.now(), act: '<button type="button" class="btn sm pri" data-push="sinov">Yozish</button>' });
        }
        for (const s of S.main) for (const d of monthStats(s, n.month).empty)
            ev.push({ cat: 'dars', tone: 'bad', ic: I.cal, title: 'Davomat belgilanmagan', sub: `${esc(s.name)} · ${fmtDate(d)} · maoshga o'tmaydi`, t: at(d, (toMin(s.lessonTime) ?? 0) + (Number(s.lessonDuration) || 30)), act: `<button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${d}">Belgilash</button>` });
        for (const m of S.makeups) {
            const t = Date.parse(m.decided_at); if (!(t > since) || !['approved', 'rejected'].includes(m.status)) continue;
            ev.push({ cat: 'dars', tone: m.status === 'approved' ? 'ok' : 'bad', ic: m.status === 'approved' ? I.ok : I.no, title: `Qoplash ${m.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`, sub: `${esc(first(stuOf(m.student_id)?.name || ''))} · ${fmtDate(day10(m.missed_date))}${m.decided_by_name ? ' · ' + esc(m.decided_by_name) : ''}${m.decision_note ? ' · ' + esc(m.decision_note) : ''}`, t });
        }
        for (const r of S.requests || []) {
            const t = Date.parse(r.decided_at); if (!(t > since) || r.status === 'new') continue;
            const p = r.payload || {};
            const what = r.type === 'assist_late' ? `Kechikib belgilash ${r.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}` : `Vaqt so'rovi ${r.status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}`;
            const sub = r.type === 'assist_late' ? `${esc(first(stuOf(p.studentId)?.name || ''))} · ${p.day ? fmtDate(day10(p.day)) : ''}${r.status === 'approved' ? ' · +1 aloqa' : ''}` : `${p.date ? dayChip(day10(p.date)) + '-' + MON[+day10(p.date).slice(5, 7) - 1].slice(0, 3) : ''}${p.from && r.type !== 'leave' ? ` · ${p.from}–${p.to}` : ''} · ${esc(r.reason || '')}`;
            ev.push({ cat: r.type === 'assist_late' ? 'sorov' : 'sorov', tone: r.status === 'approved' ? 'ok' : 'bad', ic: r.status === 'approved' ? I.ok : I.no, title: what, sub: sub + (r.decision_note ? ' · ' + esc(r.decision_note) : ''), t });
        }
        for (const g of myGuides()) { const t = Date.parse(g.createdAt); if (t > Date.now() - 14 * 86400000) ev.push({ cat: 'sorov', tone: 'mute', ic: I.doc, title: "Yangi yo'riqnoma", sub: esc(g.title || ''), t, act: `<button type="button" class="btn sm" data-push="maqola" data-arg="${esc(g.id)}">O'qish</button>` }); }
        return ev.sort((a, b) => b.t - a.t);
    }
    const notifUnread = () => { const seen = store.get(SEEN, 0); return notifEvents().filter(e => e.t > seen).length; };
    const TONE = { warn: ['#FEF0C7', '#93370D'], bad: ['#FEE4E2', '#912018'], ok: ['#DCFAE6', '#05603A'], info: ['#EAF3FF', '#0057B8'], mute: ['#EEF1F6', '#374151'], vio: ['#F4EBFF', '#53389E'] };
    let notifCat = 'all';
    PAGES.bildirish = {
        render() {
            const seen = store.get(SEEN, 0), all = notifEvents(), n = now();
            const asst = isAssistantOnly();
            const cats = asst ? [['all', 'Hammasi'], ['aloqa', 'Aloqa'], ['sorov', "So'rov"]] : [['all', 'Hammasi'], ['dars', 'Darslar'], ['sinov', 'Sinov'], ['sorov', "So'rov"]];
            const ev = all.filter(e => notifCat === 'all' || e.cat === notifCat);
            const unread = all.filter(e => e.t > seen).length;
            const groups = [['Bugun', e => tz(new Date(e.t).toISOString()).date === n.date], ['Kecha', e => tz(new Date(e.t).toISOString()).date === addDays(n.date, -1)], ['Oldinroq', () => true]];
            const used = new Set();
            const html = groups.map(([label, f]) => {
                const list = ev.filter(e => !used.has(e) && f(e)); list.forEach(e => used.add(e));
                if (!list.length) return '';
                return `<div class="sec">${label}</div><div class="card" style="padding: 4px 14px"><div class="list">${list.slice(0, 20).map(e => { const [bg, fg] = TONE[e.tone] || TONE.mute; return `<div class="li" style="align-items: flex-start"><span class="evi" style="background: ${bg}; color: ${fg}">${ico(e.ic, 20)}</span><div class="col" style="flex: 1; gap: 2px"><b class="small">${e.title}</b><span class="small muted">${e.sub}</span><span class="xs muted">${esc(stamp(new Date(e.t).toISOString()))}</span>${e.act ? `<div style="margin-top: 6px">${e.act}</div>` : ''}</div>${e.t > seen ? '<span class="newdot" aria-label="yangi"></span>' : ''}</div>`; }).join('')}</div></div>`;
            }).join('');
            return `${pageHead(h1('Bildirishnomalar'), unread ? `${unread} ta yangi` : 'Yangi xabar yo\'q')}
            <div class="body" style="padding-bottom: 24px">
              <div class="between"><div class="pick">${cats.map(([k, l]) => `<button type="button" data-nc="${k}" class="${notifCat === k ? 'on' : ''}">${l}</button>`).join('')}</div>${unread ? '<button type="button" class="small linkb" data-seen style="min-height: 48px; white-space: nowrap">O\'qildi</button>' : ''}</div>
              ${html || `<section class="card" style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 28px 16px"><span class="evi" style="width: 64px; height: 64px; border-radius: 20px; background: #EAF3FF; color: #0057B8">${ico(I.bell, 30)}</span><h2 style="font-size: 18px">Hozircha xabar yo'q</h2><span class="small muted">Belgilanmagan dars, sinov, qoplash va so'rov javoblari shu yerda chiqadi.</span></section>`}
              <span class="xs muted" style="padding: 0 4px">Telefonga push-xabar hali ulanmagan — bu ro'yxat ilovani ochganingizda jadval, davomat, qoplash va so'rovlardan yig'iladi.</span>
            </div>`;
        },
        bind() {
            root.querySelectorAll('[data-nc]').forEach(b => b.onclick = () => { notifCat = b.dataset.nc; render(); });
            root.querySelector('[data-seen]')?.addEventListener('click', () => { store.set(SEEN, Date.now()); render(); });
        },
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
        return `${header(inDavomat ? 'Davomat' : 'Aloqa', `${DAY_FULL[n.wd - 1]} · ${done} / ${today.length} bajarildi`, inDavomat ? '' : `<button type="button" class="btn sm" data-push="yjadval">Jadval</button>`)}
        <div class="body">${seg}
          <div class="kpis"><div class="kpi"><span>Oy</span><b>${S.assist?.counted ?? 0}</b><span>aloqa hisoblandi</span></div><div class="kpi"><span>Maosh</span><b>${money(S.assist?.amount ?? 0)}</b><span>× ${money(RATE)}</span></div><div class="kpi"><span>Javob bermadi</span><b>${S.assist?.noAnswer ?? 0}</b><span>hisoblanmaydi</span></div></div>
          <section class="card" style="padding: 4px 14px"><div class="list">${today.length ? today.map(row).join('') : '<div class="empty">Bugun tavsiya yo\'q</div>'}</div></section>
          ${others.length ? `<div class="sec">Boshqa o'quvchilar</div><section class="card" style="padding: 4px 14px"><div class="list">${others.map(row).join('')}</div></section>` : ''}
          <div class="note"><b>Qoidalar:</b> kamida 5 daqiqa · yozishma haftasiga 1 tagacha · "javob bermadi" hisoblanmaydi · bir kunda bitta · shu kuni belgilanadi · oyiga ${CAP} tagacha maoshga.</div>
        </div>`;
    }
    bind.aloqa = () => {};
    function openContact(studentId) {
        const s = stuOf(studentId); if (!s) return;
        if (S.assist?.state?.locked_at && S.assist.month !== now().month) return toast('Oy yopilgan');
        let channel = 'phone', minutes = 7;
        const st = assistStudent(s.id);
        sheet(`${sheetHead(esc(s.name), `bugun · bu oy ${st.counted} / ${CAP}`, avatar(s, 'av'))}
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
    // Kechikib belgilash: o'tgan kun uchun faqat so'rov — admin tasdiqlasa hisobga o'tadi.
    function openLate(studentId) {
        const s = stuOf(studentId); if (!s) return;
        const n = now(), st = assistStudent(s.id);
        const counted = new Set((st.items || []).filter(i => i.status === 'counted').map(i => i.day));
        const pending = new Set((S.requests || []).filter(r => r.type === 'assist_late' && r.status === 'new' && r.payload?.studentId === s.id).map(r => day10(r.payload.day)));
        const days = Array.from({ length: 7 }, (_, k) => addDays(n.date, -1 - k)).filter(d => wdOf(d) !== 7 && !counted.has(d) && !pending.has(d) && !(d.slice(0, 7) < n.month && S.assistPrev?.state?.final_at));
        const locked = !!S.assist?.state?.final_at;
        let day = days.find(d => adviceDays(s.lessonDayOfWeek).includes(wdOf(d))) || days[0] || null, why = "Internet yo'q edi";
        const WHY = ["Internet yo'q edi", 'Ilova ishlamadi', 'Unutib qoldim', 'Boshqa'];
        sheet(`${sheetHead('Kechikib belgilash', `${esc(s.name)} · bu oy ${st.counted} / ${CAP}`, avatar(s, 'av'))}
            <div class="note w">Aloqa shu kuni belgilanadi. O'tgan kun uchun faqat so'rov — admin tasdiqlasa hisobga o'tadi. Oy yakuniy tasdiqlangach so'rov yuborib bo'lmaydi.</div>
            ${locked ? '<div class="note w"><b>Oy yakuniy tasdiqlangan</b> — so\'rov yuborib bo\'lmaydi.</div>' : `
            <div class="field"><span class="lbl">Qaysi kun?</span>${days.length ? `<div class="slots">${days.map(d => `<button type="button" class="btn sm${d === day ? ' pri' : ''}" data-ld="${d}">${dayChip(d)}</button>`).join('')}</div>` : '<span class="small muted">Oxirgi 7 kunda belgilanmagan kun yo\'q</span>'}</div>
            <div class="field"><span class="lbl">Usul va davomiylik</span><div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px"><select id="lc" aria-label="Usul" style="width: 100%; min-width: 0">${CHANNELS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><input id="lm" type="number" inputmode="numeric" min="1" max="180" value="8" aria-label="Daqiqa" style="width: 100%; min-width: 0"></div></div>
            <div class="field"><span class="lbl">Nega o'z vaqtida belgilanmadi?</span><div class="pick">${WHY.map(w => `<button type="button" data-lw="${esc(w)}" class="${w === why ? 'on' : ''}">${esc(w)}</button>`).join('')}</div></div>
            <div class="field"><label class="lbl" for="lz">Isbot yoki izoh</label><textarea id="lz" placeholder="Masalan: qo'ng'iroqlar tarixida 18:05, 8 daqiqa"></textarea></div>
            <button type="button" class="btn pri w" data-send${!day ? ' disabled' : ''}>Adminga yuborish</button>`}`,
        (el, close) => {
            el.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => { day = b.dataset.ld; el.querySelectorAll('[data-ld]').forEach(x => x.classList.toggle('pri', x === b)); });
            el.querySelectorAll('[data-lw]').forEach(b => b.onclick = () => { why = b.dataset.lw; el.querySelectorAll('[data-lw]').forEach(x => x.classList.toggle('on', x === b)); });
            el.querySelector('[data-send]')?.addEventListener('click', async e => {
                const note = el.querySelector('#lz').value.trim(), reason = why === 'Boshqa' ? note : note ? `${why}: ${note}` : why;
                if (reason.length < 5) return toast('Sababni yozing');
                const btn = e.currentTarget; btn.disabled = true;
                try {
                    const r = await api('/api/school/assist/late-requests', { method: 'POST', body: { studentId: s.id, day, channel: el.querySelector('#lc').value, minutes: Number(el.querySelector('#lm').value) || 0, reason } });
                    if (r.request) S.requests = [r.request, ...(S.requests || [])];
                    close(); toast("So'rov adminga yuborildi"); render();
                } catch (err) { toast(err.message); btn.disabled = false; }
            });
        });
    }

    // ── Yordamchi Bugun ─────────────────────────────────────────────────────
    function renderAssistHome() {
        const n = now();
        const greet = n.hour < 11 ? 'Xayrli tong' : n.hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const today = S.helped.filter(s => !s.frozen && adviceDays(s.lessonDayOfWeek).includes(n.wd)).sort((a, b) => (toMin(a.lessonTime) ?? 0) - (toMin(b.lessonTime) ?? 0));
        const pending = today.filter(s => !contactsToday(s.id).some(c => c.outcome === 'contacted'));
        const retry = pending.filter(s => contactsToday(s.id).some(c => c.outcome === 'no_answer'));
        const nextS = pending.find(s => !retry.includes(s)) || pending[0];
        const active = S.helped.filter(s => !s.frozen).length;
        const counted = S.assist?.counted ?? 0, max = active * CAP;
        const ws = weekStart(n.date);
        const weekPlan = S.helped.filter(s => !s.frozen).reduce((a, s) => a + adviceDays(s.lessonDayOfWeek).filter(d => d <= 6).length, 0);
        const weekDone = (S.assist?.students || []).reduce((a, s) => a + (s.items || []).filter(i => i.day >= ws && i.status === 'counted').length, 0);
        const prev = S.assistPrev, prevM = shiftMonth(n.month, -1);
        const pr = nextS ? S.progress[nextS.id] : null;
        const icon = c => c.channel === 'zoom' ? 'Z' : c.channel === 'tg_text' ? '✉' : c.channel === 'meet' ? 'M' : c.channel?.startsWith('tg') ? '▶' : '☎';
        return `<div class="top"><div class="grow"><h1>${greet}, ${esc(first(S.user.name))}</h1><div class="sub">${DAY_FULL[n.wd - 1]} · ${S.helped.length} o'quvchi</div></div>${bell()}</div>
        <div class="body">
          ${prev?.state?.locked_at && !prev.state.paid_at ? `<button type="button" class="card" data-push="yoy" data-arg="${prevM}" style="display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; color: inherit; width: 100%; cursor: pointer"><span class="evi" style="background: #FEF0C7; color: #93370D">${ico(I.cal0, 20)}</span><div class="col" style="flex: 1"><b class="small">${cap1(monName(prevM))} yopildi · ${money(prev.amount)} so'm</b><span class="xs muted">${prev.state.final_at ? 'yakuniy tasdiqlandi · to\'lov kutilmoqda' : prev.state.prelim_at ? `e'tiroz ${prev.state.objection_until ? fmtDate(day10(prev.state.objection_until)) + 'gacha' : 'muddati'}` : 'moliya tasdiqlaydi'}</span></div>${chev}</button>` : ''}
          <section class="card" style="display: flex; flex-direction: column; gap: 10px" aria-label="Maosh"><div class="between"><span class="lbl">Maosh · ${monName(n.month)} · hozirgacha</span><button type="button" class="small linkb" data-push="ymaosh" style="min-height: 40px">Batafsil</button></div>
            <span class="big">${money(S.assist?.amount ?? 0)} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span>
            <span class="small muted">${counted} aloqa × ${money(S.assist?.rate || RATE)} so'm · har o'quvchi bilan oyiga ${CAP} tagacha</span>
            <div class="prog"><div class="bar g"><i style="width: ${max ? Math.min(100, Math.round(counted / max * 100)) : 0}%"></i></div><span class="xs muted" style="font-weight: 700">${counted} / ${max}</span></div>
            <div class="kpis"><div class="kpi"><span>Bugun</span><b>${today.length - pending.length} / ${today.length}</b><span>${pending.length} qoldi</span></div><button type="button" class="kpi" data-push="yjadval" style="text-align: left; font: inherit; color: inherit; cursor: pointer"><span>Bu hafta</span><b>${weekDone} / ${weekPlan}</b><span style="color: #0057B8; font-weight: 700">jadval →</span></button><div class="kpi"><span>Qayta urinish</span><b>${retry.length}</b><span class="ell">${retry.length ? esc(retry.map(s => first(s.name)).join(', ')) : 'yo\'q'}</span></div></div>
          </section>
          ${nextS ? `<section class="hero" aria-label="Keyingi aloqa"><span class="eyebrow">Keyingi aloqa · tavsiya${nextS.lessonTime ? ' ' + esc(nextS.lessonTime) : ''}</span><div class="row">${avatar(nextS, 'av')}<div class="col"><span class="t">${esc(nextS.name)}</span><span class="s">darslari ${patternLabel(nextS.lessonDayOfWeek)} ${esc(nextS.lessonTime || '')}</span></div></div>
            <div class="chips">${pr?.reached ? `<span class="chip">Ilovada ${pr.reached}-dars</span>` : ''}${pr?.firstTryAvg != null ? `<span class="chip">1-urinish ${Math.round(pr.firstTryAvg)}%</span>` : ''}<span class="chip">bu hafta ${weekCount(nextS.id)}/3</span><span class="chip">${assistStudent(nextS.id).counted} / ${CAP}</span></div>
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; margin-top: 4px"><button type="button" class="btn pri" data-contact="${esc(nextS.id)}">Aloqani belgilash</button>${nextS.phone ? `<a class="btn" href="tel:${esc(String(nextS.phone).replace(/[^\d+]/g, ''))}">${ico(I.phone, 18)}Qo'ng'iroq</a>` : `<button type="button" class="btn" data-card="${esc(nextS.id)}">Karta</button>`}</div></section>` : today.length ? '<div class="note">Bugungi tavsiyalar bajarildi 👍</div>' : ''}
          <section class="card"><div class="between"><h2>Bugungi tavsiya · ${today.length}</h2><span class="xs muted">majburiy emas</span></div><div class="list" style="margin-top: 6px">${today.map(s => {
              const c = contactsToday(s.id); const ok = c.find(x => x.outcome === 'contacted'); const na = c.find(x => x.outcome === 'no_answer');
              return `<div class="li tap" data-card="${esc(s.id)}"><span class="time">${esc(s.lessonTime || '—')}</span>${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(short(s.name))}</span><span class="xs muted">${na && !ok ? 'javob bermadi · ' : ''}${weekCount(s.id)}/3 · ${assistStudent(s.id).counted}/${CAP}</span></div>${ok ? `<span class="pill ok">${icon(ok)}${ok.minutes ? ' ' + ok.minutes + '′' : ''}</span>` : `<button type="button" class="btn sm${na ? '' : ' pri'}" data-contact="${esc(s.id)}">${na ? 'Qayta' : 'Belgilash'}</button>`}</div>`;
          }).join('') || '<div class="empty">Bugun tavsiya yo\'q</div>'}</div></section>
          <div class="note"><b>Qoidalar:</b> kamida 5 daqiqa · yozishma haftasiga 1 tagacha · "javob bermadi" hisoblanmaydi · bir kunda bitta · shu kuni belgilanadi.</div>
        </div>`;
    }

    // ── Yordamchi: tavsiya jadvali ──────────────────────────────────────────
    let yjDate = null;
    PAGES.yjadval = {
        render() {
            const n = now(); yjDate ||= n.date;
            const ws = weekStart(yjDate), we = addDays(ws, 6);
            const adv = d => S.helped.filter(s => !s.frozen && wdOf(d) !== 7 && adviceDays(s.lessonDayOfWeek).includes(wdOf(d))).sort((a, b) => (toMin(a.lessonTime) ?? 0) - (toMin(b.lessonTime) ?? 0));
            const days = Array.from({ length: 7 }, (_, k) => addDays(ws, k));
            const plan = days.reduce((a, d) => a + adv(d).length, 0);
            const done = (S.assist?.students || []).reduce((a, s) => a + (s.items || []).filter(i => i.day >= ws && i.day <= we && i.status === 'counted').length, 0);
            const list = adv(yjDate);
            const rows = list.map(s => {
                const c = contactsOn(s.id, yjDate), ok = c.find(i => i.status === 'counted') || c.find(i => i.outcome === 'contacted'), na = c.find(i => i.outcome === 'no_answer');
                const cls = ok ? 'free' : na ? 'bad' : yjDate < n.date ? 'warn' : 'next';
                const sub = ok ? `${esc(CH_LABEL[ok.channel] || '')}${ok.minutes && ok.channel !== 'tg_text' ? ` · ${ok.minutes} daq` : ''} ${ok.status === 'counted' ? '✓' : '· hisoblanmadi'}` : na ? '✕ javob bermadi · qayta urinish' : yjDate < n.date ? 'belgilanmagan' : 'tavsiya · hali belgilanmagan';
                return `<div class="li"><span class="time">${esc(s.lessonTime || '—')}</span><button type="button" class="blk ${cls}" ${yjDate === n.date && !ok ? `data-contact="${esc(s.id)}"` : `data-card="${esc(s.id)}"`}>${avatar(s)}<div class="col" style="min-width: 0"><b class="small ell">${esc(s.name)}</b><span class="xs muted">${sub}</span></div></button></div>`;
            }).join('');
            return `${pageHead(h1('Tavsiya jadvali'), `${fmtDate(ws)} – ${fmtDate(we)} · ${plan} tavsiya · ${done} bajarildi`)}
            <div class="body" style="padding-bottom: 24px">
              ${dayStrip(ws, yjDate, 'yd', d => !adv(d).length)}
              <section class="card" style="padding: 8px 14px" aria-label="${DAY_FULL[wdOf(yjDate) - 1]} tavsiyalari"><div class="list">${rows || `<div class="empty">${wdOf(yjDate) === 7 ? 'Dam olish kuni' : "Bu kunga tavsiya yo'q"}</div>`}</div></section>
              <div style="display: flex; flex-wrap: wrap; gap: 6px 12px" class="xs muted"><span><b style="color: #05603A">■</b> bajarildi</span><span><b style="color: #912018">■</b> javob bermadi</span><span><b style="color: #0057B8">■</b> tavsiya</span><span><b style="color: #93370D">■</b> belgilanmagan</span></div>
              <div class="note">Tavsiya — asosiy darslar orasidagi kun va o'quvchiga qulay vaqt. Majburiy emas: boshqa vaqtda bog'lansangiz ham hisoblanadi. Ustozning dars jadvalini band qilmaydi.</div>
            </div>`;
        },
        bind() { root.querySelectorAll('[data-yd]').forEach(b => b.onclick = () => { yjDate = b.dataset.yd; render(); }); },
    };

    // ── Yordamchi: maosh va yopilgan oy ─────────────────────────────────────
    function assistRows(rep, fullList = true, pad = true) {
        const helpedIds = new Set(S.helped.filter(s => !s.frozen).map(s => s.id));
        const list = (rep?.students || []).slice().sort((a, b) => b.counted - a.counted);
        const act = list.filter(x => helpedIds.has(x.studentId)), off = list.filter(x => !helpedIds.has(x.studentId));
        if (pad) for (const s of S.helped.filter(x => !x.frozen && !list.some(y => y.studentId === x.id))) act.push({ studentId: s.id, counted: 0, amount: 0, items: [] });
        const row = x => { const s = stuOf(x.studentId); return `<div class="li${s ? ' tap' : ''}"${s ? ` data-card="${esc(s.id)}"` : ''}>${s ? avatar(s) : initials('?')}<div class="col" style="flex: 1; min-width: 0"><b class="small ell">${esc(s?.name || "O'quvchi")}</b><span class="xs muted">${x.counted} / ${CAP} aloqa${x.overCap ? ` · +${x.overCap} limitdan ortiq` : ''}</span></div><b class="small">${money(x.amount ?? x.counted * RATE)}</b></div>`; };
        const offRow = off.length ? `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">Faol emas · ${off.length}</b><span class="xs muted">${esc(off.map(x => `${first(stuOf(x.studentId)?.name || "o'quvchi")} ${x.counted}`).join(' · '))} · hisobda qoladi</span></div><b class="small">${money(off.reduce((a, x) => a + (x.amount ?? x.counted * RATE), 0))}</b></div>` : '';
        return { html: (fullList ? act : act.slice(0, 3)).map(row).join('') + (fullList ? offRow : ''), more: fullList ? 0 : act.length - 3 + (off.length ? 1 : 0), count: act.length + off.length };
    }
    PAGES.ymaosh = {
        render() {
            const n = now(), rep = S.assist, prevM = shiftMonth(n.month, -1), prev = S.assistPrev;
            const active = S.helped.filter(s => !s.frozen).length, counted = rep?.counted ?? 0, max = active * CAP;
            const rows = assistRows(rep);
            const paid = lastPaid();
            return `${pageHead(h1(`Maosh · ${monName(n.month)}`), "Belgilangan aloqalar bo'yicha · hozirgacha")}
            <div class="body" style="padding-bottom: 24px">
              ${!rep ? '<div class="note w">Aloqa hisobi yuklanmadi.</div>' : `
              <section class="card" style="display: flex; flex-direction: column; gap: 8px"><span class="lbl">Hisoblangan</span><span class="big">${money(rep.amount)} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span><span class="small muted">${counted} aloqa × ${money(rep.rate || RATE)} so'm</span>
                <div class="prog"><div class="bar g"><i style="width: ${max ? Math.min(100, Math.round(counted / max * 100)) : 0}%"></i></div><span class="xs muted" style="font-weight: 700">ko'pi bilan ${money(max * RATE)}</span></div>
                <span class="xs muted">${active} o'quvchi × ${CAP} aloqa = ${max} · javob bermadi ${rep.noAnswer || 0} · limitdan ortiq ${rep.overCap || 0}</span></section>
              <section class="card" style="padding: 12px 14px"><div class="between"><h3>O'quvchilar bo'yicha</h3><span class="xs muted">${rows.count} o'quvchi · ${counted} aloqa</span></div><div class="list">${rows.html || '<div class="empty">Bu oy hali aloqa yo\'q</div>'}</div></section>`}
              <section class="card"><h3>To'lov qachon</h3><div class="stepper" style="margin-top: 6px">
                <div class="st now"><i>1</i><div class="col"><b class="small">Oy yopiladi</b><span class="xs muted">1-${MON[+shiftMonth(n.month, 1).slice(5) - 1]} 00:00 · avtomatik</span></div></div>
                <div class="st"><i>2</i><div class="col"><b class="small">Moliya tasdiqlaydi</b><span class="xs muted">e'tiroz 4-${MON[+shiftMonth(n.month, 1).slice(5) - 1]}gacha</span></div></div>
                <div class="st"><i>3</i><div class="col"><b class="small">To'lov</b><span class="xs muted">5-${MON[+shiftMonth(n.month, 1).slice(5) - 1]}</span></div></div></div></section>
              ${prev?.state?.locked_at ? `<button type="button" class="li card" data-push="yoy" data-arg="${prevM}" style="padding: 12px 14px"><div class="col" style="flex: 1"><b class="small">${cap1(monName(prevM))} · yopilgan oy</b><span class="xs muted">${money(prev.amount)} so'm · ${prev.state.paid_at ? "to'langan" : prev.state.final_at ? 'yakuniy tasdiqlandi' : prev.state.prelim_at ? "e'tiroz muddati" : 'moliya tasdiqlaydi'}</span></div>${chev}</button>` : ''}
              ${paid ? `<div class="between small" style="padding: 0 4px"><span class="muted">${cap1(monName(paid.start.slice(0, 7)))}</span><b>${money(paid.amount)} so'm · to'langan${paid.paidAt ? ' ' + fmtDate(tz(paid.paidAt).date) : ''}</b></div>` : ''}
            </div>`;
        },
    };
    PAGES.yoy = {
        render(arg) {
            const n = now(), month = /^\d{4}-\d{2}$/.test(arg) ? arg : shiftMonth(n.month, -1);
            const c = month === shiftMonth(n.month, -1) && S.assistPrev ? { data: S.assistPrev } : lazy('assist:' + month, () => api(`/api/school/assist/month?month=${month}`));
            const rep = c.data, st = rep?.state, nm = shiftMonth(month, 1), M = MON[+nm.slice(5) - 1];
            const step = (done, cur, i, t, sub) => `<div class="st${done ? ' done' : cur ? ' now' : ''}"><i>${done ? '✓' : i}</i><div class="col"><b class="small">${t}</b><span class="xs muted">${sub}</span></div></div>`;
            const rows = rep ? assistRows(rep, top()?.arg2 === 'all', false) : null;
            const inObj = st?.prelim_at && !st.final_at;
            return `${pageHead(h1(`${cap1(monName(month))} · yopilgan`), `${DAY_FULL[n.wd - 1]}, ${n.day}-${monName(n.month)}`)}
            <div class="body" style="padding-bottom: 24px">
              <div class="seg" role="tablist"><button type="button" class="on" role="tab" aria-selected="true">${cap1(monName(month))} · yopilgan</button><button type="button" role="tab" aria-selected="false" data-back>${cap1(monName(n.month))} · joriy</button></div>
              ${c.err ? errBox(c, 'assist:' + month) : !rep ? skel(2) : !st?.locked_at ? '<div class="note">Bu oy hali yopilmagan.</div>' : `
              <div class="note w" style="display: flex; gap: 10px; align-items: flex-start">${ico(I.alert, 20)}<span><b>${cap1(monName(month))} yopildi — faqat ko'rish.</b> Aloqani qo'shish yoki tuzatish mumkin emas.${!st.final_at ? ` Xato bo'lsa, ${st.objection_until ? fmtDate(day10(st.objection_until)) + 'gacha' : "e'tiroz muddatida"} Moliyaga murojaat qiling.` : ''}</span></div>
              <section class="card" style="display: flex; flex-direction: column; gap: 8px"><span class="lbl">${cap1(monName(month))} maoshi · ${st.final_at ? 'yakuniy' : 'dastlabki'}</span><span class="big">${money(rep.amount)} <span style="font-size: 15px; font-weight: 700; color: #4B5563">so'm</span></span><span class="small muted">${rep.counted} aloqa × ${money(rep.rate || RATE)} so'm · ${rep.students?.length || 0} o'quvchi</span>
                <div class="kpis"><div class="kpi"><span>Javob bermadi</span><b>${rep.noAnswer || 0}</b><span>hisoblanmadi</span></div><div class="kpi"><span>Limitdan ortiq</span><b>${rep.overCap || 0}</b><span>${CAP} dan ortig'i</span></div><div class="kpi"><span>Admin tuzatdi</span><b>${rep.corrections ? '+' + rep.corrections : 0}</b><span>yozuv</span></div></div></section>
              <section class="card"><h3>To'lov holati</h3><div class="stepper" style="margin-top: 6px">
                ${step(true, false, 1, 'Oy yopildi', `${st.locked_at ? stamp(st.locked_at) : `1-${M} 00:00`} · avtomatik`)}
                ${step(!!st.prelim_at, !st.prelim_at, 2, 'Dastlabki tasdiq', st.prelim_at ? `${stamp(st.prelim_at)} · Moliya` : 'Moliya tekshiradi')}
                ${step(!!st.final_at, inObj, 3, "E'tiroz muddati", `${st.objection_until ? fmtDate(day10(st.objection_until)) + 'gacha' : `4-${M}gacha`} · keyin yakuniy`)}
                ${step(!!st.paid_at, !!st.final_at && !st.paid_at, 4, "To'lov", st.paid_at ? stamp(st.paid_at) : `5-${M}`)}</div></section>
              <section class="card" style="padding: 4px 14px"><div class="list">${rows.html}${rows.more > 0 ? `<button type="button" class="li" data-all><span class="small muted" style="flex: 1">yana ${rows.more} o'quvchi</span><b class="small" style="color: #0057B8">Hammasi</b></button>` : ''}</div></section>`}
            </div>`;
        },
        bind() { root.querySelector('[data-all]')?.addEventListener('click', () => { top().arg2 = 'all'; render(); }); },
    };

    // ── O'quvchilar ─────────────────────────────────────────────────────────
    let stuQ = '', stuSeg = 'active', stuFlag = 'all';
    function statusPill(s) {
        const n = now(), ms = monthStats(s, n.month), f = flagKeys(s.id);
        if (s.frozen) return '<span class="pill info">Muzlatilgan</span>';
        if (ms.kelmadi >= 3 || f.includes('idle')) return '<span class="pill bad">Kelmayapti</span>';
        if (f.includes('struggling')) return '<span class="pill warn">Qiynalyapti</span>';
        if (f.includes('behind')) return '<span class="pill warn">Orqada</span>';
        return '<span class="pill ok">Rejada</span>';
    }
    function renderInactive() {
        const list = S.inactive;
        if (list == null) return '<div class="note w">Faol bo\'lmagan o\'quvchilar yuklanmadi.</div>';
        const groups = [['frozen', 'Muzlatilgan', 'info'], ['moved', "Boshqa ustozga o'tgan", 'vio'], ['left', 'Chiqib ketgan', 'mute'], ['finished', 'Kursni tugatganlar', 'ok']];
        const asst = isAssistantOnly();
        const html = groups.map(([k, label, tone]) => {
            const g = list.filter(x => x.state === k); if (!g.length) return '';
            return `<div class="sec">${label} · ${g.length}</div>${g.map(x => {
                const s = stuOf(x.id), as = asst ? assistStudent(x.id) : null;
                const pill = k === 'frozen' ? `Muzlatilgan${x.from ? ' · ' + fmtDate(x.from) : ''}${x.to ? ' → ' + fmtDate(x.to) : ''}` : k === 'moved' ? `Boshqa ustozga o'tdi${x.from ? ' · ' + fmtDate(x.from) : ''}`
                    : k === 'finished' ? `Kursni tugatgan${x.course?.to ? ' · ' + fmtDate(x.course.to) : ''}` : `Chiqib ketgan${x.from ? ' · ' + fmtDate(x.from) : ''}`;
                return `<section class="card" style="display: flex; flex-direction: column; gap: 8px"><div class="row">${avatar(x, 'av')}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(x.name)}</span><span class="pill ${tone}" style="align-self: flex-start; margin-top: 4px">${pill}</span></div></div>
                  ${s && s.lessonTime && k !== 'moved' ? `<div class="between small"><span class="muted">Jadval</span><b style="text-align: right">${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime)}</b></div>` : ''}
                  ${as && as.counted ? `<div class="between small"><span class="muted">${cap1(monName(now().month))}</span><b style="text-align: right">${as.counted} / ${CAP} aloqa · maoshda qoladi</b></div>` : ''}
                  ${k === 'finished' || k === 'left' ? `<div class="between small"><span class="muted">O'tilgan</span><b style="text-align: right">${asst ? `${x.contacts?.total || 0} aloqa` : `${x.lessons || 0} dars siz bilan`}${!asst && x.reached != null ? ` · ilovada ${x.reached} / 72` : ''}</b></div>` : ''}
                  ${x.reason && k !== 'finished' ? `<div class="between small"><span class="muted">Sabab</span><b style="text-align: right">${esc(x.reason)}</b></div>` : ''}
                  ${k === 'frozen' && x.to ? `<div class="between small"><span class="muted">Qaytadi</span><b style="text-align: right">${fmtDate(addDays(x.to, 1))} · vaqti saqlangan</b></div>` : ''}</section>`;
            }).join('')}`;
        }).join('');
        return `${asst ? '' : '<div class="note">Bu o\'quvchilar bugungi darslar, davomat foizi, reyting va maoshga qo\'shilmaydi.</div>'}${html || '<div class="card empty">Faol bo\'lmagan o\'quvchi yo\'q</div>'}
          <span class="xs muted" style="padding: 0 4px">${asst ? "Muzlatilgan kunlarda aloqa belgilanmaydi. Chiqib ketgungacha qilingan aloqalar shu oy maoshiga hisoblanadi." : "Muzlatilgan o'quvchi qaytganda avtomatik \"Faol\"ga o'tadi. To'lov va sotuv ma'lumotlari ko'rsatilmaydi."}</span>`;
    }
    function renderStudents() {
        const n = now();
        const q = stuQ.toLowerCase();
        const f = list => list.filter(s => !q || s.name.toLowerCase().includes(q) || String(s.id).includes(q));
        const asst = isAssistantOnly();
        const inN = S.inactive?.length ?? 0;
        if (asst) {
            const near = S.helped.filter(s => assistStudent(s.id).counted >= CAP - 3);
            const list = f(stuSeg === 'near' ? near : S.helped);
            const tot = S.assist?.counted ?? 0, max = S.helped.filter(s => !s.frozen).length * CAP;
            return `${header("O'quvchilar", `${S.helped.length} o'quvchi · ${monName(n.month)} · ${tot} / ${max} aloqa`)}
            <div class="body" style="gap: 12px">
              ${stuSeg !== 'inactive' ? `<div class="field"><label class="lbl" for="sq" style="position: absolute; width: 1px; height: 1px; overflow: hidden">Qidirish</label><input id="sq" type="search" placeholder="O'quvchi qidirish" value="${esc(stuQ)}"></div>` : ''}
              <div class="seg" role="tablist"><button type="button" role="tab" data-sseg="active" class="${stuSeg === 'active' ? 'on' : ''}">Hammasi</button><button type="button" role="tab" data-sseg="near" class="${stuSeg === 'near' ? 'on' : ''}">Limitga yaqin · ${near.length}</button><button type="button" role="tab" data-sseg="inactive" class="${stuSeg === 'inactive' ? 'on' : ''}">Faol emas · ${inN}</button></div>
              ${stuSeg === 'inactive' ? renderInactive() : `<div class="card" style="padding: 4px 14px"><div class="list">${list.map(s => { const a = assistStudent(s.id); return `<div class="li tap" data-card="${esc(s.id)}" style="flex-direction: column; align-items: stretch; gap: 8px"><div class="row">${avatar(s)}<div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(s.name)}</span><span class="xs muted">${s.frozen ? 'muzlatilgan' : `tavsiya ${adviceLabel(s.lessonDayOfWeek)}${s.lessonTime ? ' · ' + esc(s.lessonTime) : ''}`}</span></div><div class="col" style="align-items: flex-end"><b class="small">${a.counted} / ${CAP}</b><span class="xs muted">hafta ${weekCount(s.id)}/3</span></div></div><div class="bar g"><i style="width: ${Math.min(100, Math.round(a.counted / CAP * 100))}%"></i></div></div>`; }).join('') || '<div class="empty">Topilmadi</div>'}</div></div>
              <span class="xs muted" style="padding: 0 4px">${CAP} tadan ortiq aloqa qilish mumkin, lekin maoshga qo'shilmaydi. Muzlatilgan kunlarda aloqa belgilanmaydi.</span>`}
            </div>`;
        }
        const has = (s, k) => k === 'att' ? (flagKeys(s.id).length > 0 || monthStats(s, n.month).kelmadi >= 3) : flagKeys(s.id).includes(k);
        const cnt = k => S.main.filter(s => has(s, k)).length;
        const row = (s, duty) => {
            const pr = S.progress[s.id];
            let right;
            if (duty === 'main') { const ms = monthStats(s, n.month); right = `<div class="col" style="align-items: flex-end; gap: 4px">${statusPill(s)}<span class="xs muted" style="font-weight: 700">${ms.counted}/${ms.plan}${ms.review ? ' · +' + ms.review : ' dars'}</span></div>`; }
            else right = `<span class="pill info">${assistStudent(s.id).counted}/${CAP}</span>`;
            return `<div class="li tap" data-card="${esc(s.id)}">${avatar(s, 'av')}<div class="col" style="flex: 1; min-width: 0"><span class="nm">${esc(s.name)}</span><span class="small muted">${duty === 'main' ? `${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')}${pr?.reached ? ` · ilovada ${pr.reached}/72` : ''}` : `tavsiya ${adviceLabel(s.lessonDayOfWeek)}`}</span></div>${right}</div>`;
        };
        const mainL = f(S.main).filter(s => stuFlag === 'all' || has(s, stuFlag)), helpL = f(S.helped);
        const avgFirst = (() => { const v = S.main.map(s => S.progress[s.id]?.firstTryAvg).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })();
        return `${header("O'quvchilar", stuSeg === 'inactive' ? "Faqat siz bilan bo'lgan davr ko'rinadi" : "To'lov ma'lumotlari ko'rsatilmaydi")}
        <div class="body" style="gap: 12px">
          ${stuSeg !== 'inactive' ? `<div class="field"><label class="lbl" for="sq" style="position: absolute; width: 1px; height: 1px; overflow: hidden">Qidirish</label><input id="sq" type="search" placeholder="Ism yoki ID bo'yicha qidirish" value="${esc(stuQ)}"></div>` : ''}
          <div class="seg" role="tablist"><button type="button" role="tab" data-sseg="active" class="${stuSeg !== 'inactive' ? 'on' : ''}">Faol · ${S.main.length}${S.helped.length ? ' + ' + S.helped.length : ''}</button><button type="button" role="tab" data-sseg="inactive" class="${stuSeg === 'inactive' ? 'on' : ''}">Faol emas · ${inN}</button></div>
          ${stuSeg === 'inactive' ? renderInactive() : `
          ${S.main.length ? `<div class="pick"><button type="button" data-sf="all" class="${stuFlag === 'all' ? 'on' : ''}">Hammasi</button><button type="button" data-sf="att" class="${stuFlag === 'att' ? 'on' : ''}">E'tibor kerak · ${cnt('att')}</button><button type="button" data-sf="struggling" class="${stuFlag === 'struggling' ? 'on' : ''}">Qiynalyapti · ${cnt('struggling')}</button><button type="button" data-sf="behind" class="${stuFlag === 'behind' ? 'on' : ''}">Orqada · ${cnt('behind')}</button></div>
          <div class="between" style="padding: 0 4px"><span class="sec" style="padding: 0">Asosiy · ${mainL.length}</span>${avgFirst != null ? `<span class="xs muted">1-urinish o'rtacha ${avgFirst}%</span>` : ''}</div><div class="card" style="padding: 4px 14px"><div class="list">${mainL.map(s => row(s, 'main')).join('') || '<div class="empty">Topilmadi</div>'}</div></div>` : ''}
          ${S.helped.length ? `<div class="sec">Yordamchi sifatida · ${helpL.length}</div><div class="card" style="padding: 4px 14px"><div class="list">${helpL.map(s => row(s, 'assistant')).join('') || '<div class="empty">Topilmadi</div>'}</div></div>` : ''}
          ${!S.main.length && !S.helped.length ? '<div class="empty">Sizga hali o\'quvchi biriktirilmagan</div>' : ''}`}
        </div>`;
    }
    bind.students = () => {
        root.querySelectorAll('[data-sseg]').forEach(b => b.onclick = () => { stuSeg = b.dataset.sseg; render(); });
        root.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { stuFlag = b.dataset.sf; render(); });
        const inp = root.querySelector('#sq');
        if (inp) inp.oninput = () => { stuQ = inp.value; const pos = inp.selectionStart; render(); const again = root.querySelector('#sq'); again.focus(); again.setSelectionRange(pos, pos); };
    };

    // ── O'quvchi kartasi: Umumiy · Davomat · O'zlashtirish ──────────────────
    let groupsCache = null;
    const groupOf = id => { if (!groupsCache) { groupsCache = lazy('groups', () => api('/api/school/my-groups')); } return (groupsCache.data?.groups || []).find(g => g.student_id === id) || null; };
    const detailOf = id => lazy('det:' + id, () => api(`/api/academic/students/${encodeURIComponent(id)}`));
    const avgFirst = l => { const v = (l.results || []).map(r => Number(r.firstPercent)).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    function coursePath(d, pr) {
        const per = Object.fromEntries((d?.lessons || []).map(l => [l.no, l]));
        const reached = pr?.reached || d?.student?.reached || 0;
        return `<div><div class="lbl" style="margin-bottom: 6px">Kurs yo'li · 72 dars</div><div class="path" aria-label="Kurs yo'li">${Array.from({ length: 72 }, (_, i) => {
            const no = i + 1, l = per[no], done = (l?.percent ?? 0) >= 100 || (no < reached && !l), cur = no === reached;
            const bg = cur ? '#0065D6' : done ? '#A6F4C5' : '#EEF1F6';
            const bd = no % 12 === 0 ? '2px solid #DC6803' : no % 2 === 0 ? '1px solid #7FB2F0' : '1px solid #E6EAF2';
            return `<span style="background: ${bg}; border: ${bd}" title="${no}-dars"></span>`;
        }).join('')}</div><div class="xs muted" style="margin-top: 6px">yashil — bajarilgan · ko'k — hozirgi · ramka — jonli dars · sariq — imtihon</div></div>`;
    }
    function lessonRows(d, n = 4) {
        const done = (d?.lessons || []).filter(l => (l.results || []).length).slice(-n).reverse();
        return done.map(l => { const f = avgFirst(l), upd = (l.results || []).map(r => r.updatedAt).filter(Boolean).sort().slice(-1)[0], st = l.steps || {};
            return `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${l.no}-dars · ${l.type === 'live' ? 'jonli' : 'video'}</b><span class="xs muted">${upd ? fmtDate(tz(upd).date) + ' · ' : ''}${st.homeworkTotal ? `vazifa ${st.homeworkDone}/${st.homeworkTotal}` : esc(l.name || '')}${l.seconds ? ' · ' + Math.round(l.seconds / 60) + ' daq' : ''}</span></div>${f != null ? `<span class="pill ${f < 60 ? 'warn' : 'mute'}">${f}%</span>` : ''}</div>`; }).join('');
    }
    function mistakesOf(d, k = 2) {
        const done = (d?.lessons || []).filter(l => (l.results || []).length).slice(-6).reverse();
        return done.flatMap(l => (l.results || []).flatMap(r => (r.mistakes || []).map(m => ({ ...m, no: l.no, part: r.title, attempts: r.attempts })))).slice(0, k);
    }
    const mistakeNote = m => `<div class="note w" style="font-size: 13px">${m.no}-dars${m.part ? ' · ' + esc(m.part) : ''}${m.attempts > 1 ? ` · ${m.attempts} urinish` : ''}<br><b>${esc(m.question || m.prompt || '')}</b>${m.yourAnswer ? ` O'quvchi: "${esc(m.yourAnswer)}"` : ''}${m.correctAnswer ? ` · to'g'risi: "${esc(m.correctAnswer)}"` : ''}</div>`;
    function examRows(d) {
        const ex = (d?.exams || []).filter(e => e.label || e.examId);
        return ex.length ? `<section class="card" style="display: flex; flex-direction: column; gap: 6px"><h3>Imtihonlar</h3>${ex.slice(0, 4).map(e => `<div class="between small"><span>${esc(e.label || e.examId)}</span><span class="pill ${e.passed ? 'ok' : 'warn'}">${e.passed ? "o'tdi" : 'o\'tmadi'}${e.scorePercent != null ? ' · ' + Math.round(e.scorePercent) + '%' : ''}</span></div>`).join('')}</section>` : '';
    }
    let cardTab = {};
    PAGES.karta = {
        render(id) {
            const s = stuOf(id);
            if (!s) return `${pageHead(h1("O'quvchi"), '')}<div class="body"><div class="note w">O'quvchi topilmadi yoki sizga biriktirilmagan.</div></div>`;
            return s.teacherId === S.me?.id ? renderMainCard(s) : renderAsstCard(s);
        },
        bind(id) {
            root.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { cardTab[id] = b.dataset.ct; render(); });
            root.querySelector('[data-late]')?.addEventListener('click', () => openLate(id));
            root.querySelector('[data-sorov]')?.addEventListener('click', () => push('sorov', id));
        },
    };
    function renderMainCard(s) {
        const n = now(), tab = cardTab[s.id] || 'gen', pr = S.progress[s.id], ms = monthStats(s, n.month), unc = uncovered(s);
        const g = groupOf(s.id);
        const seg = `<div class="seg" role="tablist">${[['gen', 'Umumiy'], ['dav', 'Davomat'], ['oz', "O'zlashtirish"]].map(([k, l]) => `<button type="button" role="tab" data-ct="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
        const lang = s.subject === 'russian' ? 'Rus tili' : 'Ingliz tili';
        const d = detailOf(s.id);
        if (tab === 'oz') {
            const det = d.data, classAvg = (() => { const v = S.main.map(x => S.progress[x.id]?.firstTryAvg).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })();
            const days14 = Array.from({ length: 14 }, (_, k) => addDays(n.date, k - 13)), tbd = det?.timeByDay || {};
            const mins = days14.map(x => Math.round((tbd[x] || 0) / 60)), maxM = Math.max(...mins, 1), min7 = mins.slice(-7).reduce((a, b) => a + b, 0);
            const rep = (det?.lessons || []).filter(l => (l.results || []).some(r => r.attempts >= 3)).slice(-1)[0];
            const lastEx = (det?.exams || [])[0];
            return `${pageHead(h1(esc(s.name)), `#${esc(s.id)} · ilovada ${pr?.reached ?? '—'}/72${rep ? ` · ${rep.no}-dars ${Math.max(...rep.results.map(r => r.attempts || 0))} marta takrorlandi` : ''}`, '', avatar(s, 'av'))}
            <div class="body" style="padding-bottom: 24px">${seg}
              <div class="kpis"><div class="kpi"><span>1-urinish</span><b>${pr?.firstTryAvg != null ? Math.round(pr.firstTryAvg) + '%' : '—'}</b><span>${classAvg != null ? "o'rtacha " + classAvg + '%' : 'o\'rtacha'}</span></div><div class="kpi"><span>Faol · 7 kun</span><b>${pr?.activeDays7 ?? '—'} kun</b><span>${det ? min7 + ' daq' : ''}</span></div><div class="kpi"><span>Imtihon</span><b>${lastEx ? (lastEx.scorePercent != null ? Math.round(lastEx.scorePercent) + '%' : lastEx.passed ? '✓' : '—') : '—'}</b><span>${lastEx ? esc(lastEx.label || '') : "hali yo'q"}</span></div></div>
              ${d.err ? errBox(d, 'det:' + s.id) : !det ? skel(2) : `
              <section class="card" style="padding: 12px 14px"><div class="between"><h3>Darslar bo'yicha</h3><span class="xs muted">1-urinish</span></div><div class="list" style="margin-top: 4px">${lessonRows(det, 5) || '<div class="empty">Ilovada hali natija yo\'q</div>'}</div></section>
              ${mistakesOf(det).length ? `<section class="card" style="display: flex; flex-direction: column; gap: 8px"><h3>Oxirgi xatolar</h3>${mistakesOf(det).map(mistakeNote).join('')}</section>` : ''}
              <section class="card" style="display: flex; flex-direction: column; gap: 8px"><div class="between"><h3>Ilovadagi faollik · 14 kun</h3><span class="xs muted">daqiqa/kun</span></div><div style="display: flex; align-items: flex-end; gap: 4px; height: 40px">${mins.map((m, k) => `<span style="flex: 1; height: ${Math.round(m / maxM * 40)}px; background: ${k === 13 ? '#0065D6' : '#CFE3FB'}; border-radius: 4px" title="${m} daq"></span>`).join('')}</div><div class="between xs muted"><span>${fmtDate(days14[0])}</span><span>bugun</span></div></section>
              ${examRows(det)}`}
            </div>`;
        }
        if (tab === 'dav') {
            const a = lazy(`att:${s.id}:${n.month}`, () => api(`/api/school/students/${encodeURIComponent(s.id)}/attendance?month=${n.month}`));
            const ct = s.assistantTeacherId ? lazy(`ct:${s.id}`, () => api(`/api/school/students/${encodeURIComponent(s.id)}/contacts`)) : null;
            const mks = a.data?.makeups || S.makeups.filter(m => m.student_id === s.id).map(m => ({ kind: m.kind, status: m.status, held: day10(m.held_date), missed: day10(m.missed_date) }));
            const lessonsList = (a.data?.lessonDays || lessonDays(s, n.month).map(c => c.date)).filter(x => x <= n.date || x === lessonDays(s, n.month).map(c => c.date).find(y => y > n.date));
            const items = [...lessonsList.map(x => ({ date: x, k: 'l' })), ...mks.filter(m => m.held && m.kind === 'separate').map(m => ({ date: m.held, k: 'm', m }))].sort((p, q) => q.date.localeCompare(p.date));
            const stName = { planned: 'rejada', review: 'tekshiruvda', approved: 'tasdiqlandi', rejected: 'rad etildi' };
            const covered = mks.filter(m => m.status === 'approved' || m.status === 'review').length;
            return `${pageHead(h1(esc(s.name)), `${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq`, '', avatar(s, 'av'))}
            <div class="body" style="padding-bottom: 24px">${seg}
              <div class="kpis"><div class="kpi"><span>Hisobga o'tdi</span><b>${ms.counted} / ${ms.plan}</b><span>${ms.keldi} + ${ms.approved} qoplash</span></div><div class="kpi"><span>Kelmadi</span><b>${ms.kelmadi}</b><span>${covered} qoplangan</span></div><div class="kpi"><span>Yordamchi</span><b>${ct?.data ? `${ct.data.counted} / ${ct.data.cap || CAP}` : s.assistantTeacherId ? '…' : '—'}</b><span>${s.assistantTeacherId ? 'aloqa' : "yo'q"}</span></div></div>
              <section class="card" style="padding: 12px 14px"><div class="between"><h3>${cap1(monName(n.month))} · darslar</h3><button type="button" class="small linkb" data-cal style="min-height: 40px">Kalendar</button></div><div class="list">${a.err ? errBox(a, `att:${s.id}:${n.month}`) : items.map(it => {
                  if (it.k === 'm') return `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${DAY[wdOf(it.date) - 1]} ${fmtDate(it.date)}</b><span class="xs muted">qoplash · ${fmtDate(it.m.missed)} o'rniga</span></div><span class="pill vio">${stName[it.m.status] || ''}</span></div>`;
                  const st = markOf(s, it.date), apiE = a.data?.entries?.[+it.date.slice(8)], mark = st !== 'empty' ? st : apiE ? (apiE.present ? 'present' : 'absent') : 'empty';
                  const isFut = it.date > n.date || (it.date === n.date && n.min < (toMin(s.lessonTime) ?? 0) + (Number(s.lessonDuration) || 30) && mark === 'empty');
                  const cov = mark === 'absent' ? mks.find(m => m.missed === it.date && m.status !== 'rejected') : null;
                  const sub = isFut ? `${it.date === n.date ? 'bugun ' : ''}${esc(s.lessonTime || '')}` : mark === 'absent' ? (cov ? `kelmadi · qoplash ${stName[cov.status]}` : 'kelmadi · qoplash mumkin') : mark === 'present' ? 'keldi' : 'belgilanmagan';
                  const right = isFut ? '<span class="pill mute">kutilmoqda</span>' : mark === 'present' ? '<span class="pill ok">keldi</span>' : mark === 'absent' ? '<span class="pill bad">kelmadi</span>' : `<button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${it.date}">Belgilash</button>`;
                  return `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${DAY[wdOf(it.date) - 1]} ${fmtDate(it.date)}</b><span class="xs muted">${sub}</span></div>${right}</div>`;
              }).join('') || '<div class="empty">Bu oy dars yo\'q</div>'}</div></section>
              ${ct ? `<section class="card" style="padding: 12px 14px"><div class="between"><h3>Yordamchi aloqalari</h3><span class="xs muted">faqat ko'rish</span></div><div class="list">${ct.err ? errBox(ct, 'ct:' + s.id) : !ct.data ? skel(1) : (ct.data.items || []).slice().reverse().slice(0, 8).map(i => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${DAY[wdOf(i.day) - 1]} ${fmtDate(i.day)}</b><span class="xs muted">${i.outcome === 'no_answer' ? 'javob bermadi' : esc(CH_LABEL[i.channel] || '') + (i.minutes && i.channel !== 'tg_text' ? ' · ' + i.minutes + ' daq' : '')}</span></div>${i.status === 'counted' ? '<span class="pill ok">✓</span>' : '<span class="pill mute">hisoblanmadi</span>'}</div>`).join('') || '<div class="empty">Bu oy aloqa yo\'q</div>'}</div></section>` : ''}
            </div>`;
        }
        const flags = (pr?.flags || []).map(f => f.label).filter(Boolean);
        const warn = [...flags, ...(ms.kelmadi >= 2 ? [`${monName(n.month)}da ${ms.kelmadi} dars qoldirgan`] : [])];
        const ct = s.assistantTeacherId ? lazy(`ct:${s.id}`, () => api(`/api/school/students/${encodeURIComponent(s.id)}/contacts`)) : null;
        const last = ct?.data?.items?.slice(-1)[0];
        return `${pageHead(`<h1>${esc(s.name)}</h1>`, `#${esc(s.id)} · ${lang}${s.startDate ? ' · ' + esc(String(s.startDate).slice(0, 10).split('-').reverse().slice(0, 2).join('.')) + ' dan' : ''}`, '', avatar(s, 'av l')).replace('</div></div>', `</div><div class="chips" style="margin-top: 6px">${statusPill(s)}${g?.name || s.group ? `<span class="pill info">${esc(g?.name || s.group)} guruh</span>` : ''}</div></div>`)}
        <div class="body" style="padding-bottom: 24px">
          ${g?.tg_link || s.phone ? `<div style="display: grid; grid-template-columns: repeat(${g?.tg_link && s.phone ? 2 : 1}, minmax(0, 1fr)); gap: 8px">${g?.tg_link && /^https:\/\//.test(g.tg_link) ? `<a class="btn" href="${esc(g.tg_link)}" target="_blank" rel="noopener">${ico(I.group, 18)}Guruh</a>` : ''}${s.phone ? `<a class="btn" href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}">${ico(I.phone, 18)}Qo'ng'iroq</a>` : ''}</div>` : ''}
          ${seg}
          ${warn.length ? `<div class="note w"><b>E'tibor:</b> ${esc(warn.join(' · '))}.</div>` : ''}
          <section class="card" style="display: flex; flex-direction: column; gap: 12px"><div class="between"><h2>O'zlashtirish</h2><span class="xs muted">ilova ma'lumoti</span></div>
            <div class="kpis"><div class="kpi"><span>Ilovada</span><b>${pr?.reached ?? '—'}/72</b><span>${pr?.expected ? 'reja ' + pr.expected : 'erishgan dars'}</span></div><div class="kpi"><span>1-urinish</span><b>${pr?.firstTryAvg != null ? Math.round(pr.firstTryAvg) + '%' : '—'}</b><span>o'rtacha</span></div><div class="kpi"><span>7 kun</span><b>${pr?.activeDays7 ?? '—'} kun</b><span>faol</span></div></div>
            ${d.data ? coursePath(d.data, pr) : d.err ? '' : '<div class="skel" style="height: 60px"></div>'}</section>
          <section class="card" style="display: flex; flex-direction: column; gap: 8px"><div class="between"><h3>Davomat · ${monName(n.month)}</h3><button type="button" class="small linkb" data-cal>Kalendar</button></div>
            <div class="prog"><div class="bar g"><i style="width: ${ms.plan ? Math.round(ms.counted / ms.plan * 100) : 0}%"></i></div><b class="small">${ms.counted} / ${ms.plan}</b></div>
            <span class="small muted">${ms.keldi} keldi · ${ms.kelmadi} kelmadi · ${ms.approved} qoplandi${ms.review ? ' · ' + ms.review + ' tekshiruvda' : ''}${ms.empty.length ? ' · ' + ms.empty.length + ' belgilanmagan' : ''}</span>
            ${ms.empty.length ? `<button type="button" class="btn sm pri" data-mark="${esc(s.id)}" data-date="${ms.empty[ms.empty.length - 1]}">${fmtDate(ms.empty[ms.empty.length - 1])}ni belgilash</button>` : ''}</section>
          ${ct ? `<section class="card" style="display: flex; flex-direction: column; gap: 8px"><div class="between"><h3>Yordamchi aloqalari</h3><span class="pill info">${ct.data ? `${ct.data.counted} / ${ct.data.cap || CAP}` : '…'}</span></div><span class="xs muted">${last ? `oxirgi: ${DAY[wdOf(last.day) - 1]} ${fmtDate(last.day)} · ${last.outcome === 'no_answer' ? 'javob bermadi' : esc(CH_LABEL[last.channel] || '')}` : ct.data ? "bu oy hali aloqa yo'q" : ''}</span></section>` : ''}
          <section class="card" style="display: flex; flex-direction: column; gap: 6px">
            <div class="between small"><span class="muted">Jadval</span><b>${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} · ${Number(s.lessonDuration) || 30} daq</b></div>
            ${s.phone ? `<div class="between small"><span class="muted">Telefon</span><b>${esc(s.phone)}</b></div>` : ''}
            ${unc.length ? `<button type="button" class="btn w sm pri" data-qoplash="${esc(s.id)}" style="margin-top: 6px">Qoplash qo'yish · ${unc.length} dars</button>` : ''}
            <button type="button" class="btn w sm" data-sorov>Adminga so'rov: jadvalni o'zgartirish</button>
          </section>
          <a class="btn w" href="/index.html?full=1">${ico(I.ext)}To'liq kartani ochish</a>
        </div>`;
    }
    function renderAsstCard(s) {
        const n = now(), pr = S.progress[s.id], as = assistStudent(s.id), d = detailOf(s.id), det = d.data;
        const a = lazy(`att:${s.id}:${n.month}`, () => api(`/api/school/students/${encodeURIComponent(s.id)}/attendance?month=${n.month}`));
        const flags = (pr?.flags || []).map(f => f.label).filter(Boolean);
        const late = (S.requests || []).filter(r => r.type === 'assist_late' && r.payload?.studentId === s.id).slice(0, 3);
        const entries = a.data?.entries || {}, mks = a.data?.makeups || [];
        const cells = cal.cells(n.month, patternOf(s));
        const plan = (a.data?.lessonDays || []).length, pres = Object.values(entries).filter(e => e.present).length, appr = mks.filter(m => m.status === 'approved').length;
        const mk = mistakesOf(det, 1)[0];
        const pill = flagKeys(s.id).includes('struggling') ? '<span class="pill warn">Qiynalyapti</span>' : flagKeys(s.id).includes('idle') ? '<span class="pill bad">Ilovaga kirmayapti</span>' : '';
        return `${pageHead(`<h1>${esc(s.name)}</h1>`, `${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')} darslari`, '', avatar(s, 'av l')).replace('</div></div>', `</div><div class="chips" style="margin-top: 6px"><span class="pill ${s.frozen ? 'info' : 'ok'}">${s.frozen ? 'Muzlatilgan' : 'Faol'}</span>${pill}</div></div>`)}
        <div class="body" style="padding-bottom: 24px">
          <div style="display: grid; grid-template-columns: ${s.phone ? '1.3fr 1fr' : '1fr'}; gap: 8px"><button type="button" class="btn pri" data-contact="${esc(s.id)}">Aloqani belgilash</button>${s.phone ? `<a class="btn" href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}">${ico(I.phone, 18)}Qo'ng'iroq</a>` : ''}</div>
          ${flags.length ? `<div class="note w"><b>${esc(flags[0])}.</b>${pr?.firstTryAvg != null ? ` 1-urinish o'rtacha ${Math.round(pr.firstTryAvg)}%.` : ''}${mk ? ` Ko'p xato: ${esc(mk.question || '')} — keyingi aloqada shu mavzuni og'zaki mashq qiling.` : ''}</div>` : ''}
          <section class="card" style="display: flex; flex-direction: column; gap: 8px">
            <div class="between"><h2>Aloqalar · ${monName(n.month)}</h2><span class="pill info">${as.counted} / ${CAP}</span></div>
            <div class="prog"><div class="bar g"><i style="width: ${Math.min(100, Math.round(as.counted / CAP * 100))}%"></i></div><span class="xs muted" style="font-weight: 700">hafta ${weekCount(s.id)}/3</span></div>
            <span class="xs muted">tavsiya ${adviceLabel(s.lessonDayOfWeek)}${s.lessonTime ? ' · ' + esc(s.lessonTime) : ''}</span>
            <div class="list">${(as.items || []).slice().reverse().slice(0, 6).map(i => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${DAY[wdOf(i.day) - 1]} ${fmtDate(i.day)}${i.day === n.date ? ' · bugun' : ''}</b><span class="xs muted">${i.outcome === 'no_answer' ? 'javob bermadi' : esc(CH_LABEL[i.channel] || '') + (i.minutes && i.channel !== 'tg_text' ? ' · ' + i.minutes + ' daq' : '')}</span></div><span class="pill ${i.status === 'counted' ? 'ok' : 'mute'}">${i.status === 'counted' ? 'hisoblandi' : 'hisoblanmadi'}</span></div>`).join('') || '<div class="empty" style="padding: 12px">Bu oy hali aloqa yo\'q</div>'}
              ${late.map(r => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">Kechikib · ${dayChip(day10(r.payload.day))}</b><span class="xs muted ell" style="font-weight: 600">${esc(r.reason || '')}</span></div><span class="pill ${r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn'}">${r.status === 'approved' ? 'tasdiqlandi' : r.status === 'rejected' ? 'rad etildi' : 'kutilmoqda'}</span></div>`).join('')}</div>
            <button type="button" class="small linkb" data-late style="min-height: 40px; align-self: flex-start">Kechikib belgilash so'rovi →</button>
          </section>
          <section class="card" style="display: flex; flex-direction: column; gap: 10px">
            <div class="between"><h3>Asosiy ustoz davomati</h3>${a.data ? `<span class="pill info">${pres + appr} / ${plan}${appr ? ' · +' + appr : ''}</span>` : ''}</div>
            ${a.err ? errBox(a, `att:${s.id}:${n.month}`) : !a.data ? skel(1) : `<div class="cal">${DAY.map(x => `<span class="h">${x}</span>`).join('')}${cells.map(c => {
                if (!c) return '<span></span>';
                const e = entries[c.day], heldMk = mks.find(m => m.held === c.date && m.status !== 'rejected');
                const cls = !c.scheduled ? (heldMk ? 'q' : 'o') : e ? (e.present ? 'p' : 'a') : c.date > n.date ? 'l' : 'o';
                return `<span class="d ${cls}${c.date === n.date ? ' t' : ''}" style="height: 34px">${c.day}</span>`;
            }).join('')}</div>`}
            <span class="xs muted">✓ keldi · − kelmadi · Q qoplash · faqat ko'rish — belgilashni asosiy ustoz qiladi</span>
          </section>
          <section class="card" style="display: flex; flex-direction: column; gap: 10px">
            <div class="between"><h3>O'zlashtirish</h3>${pr?.reached ? `<button type="button" class="small linkb" data-lesson="${pr.reached}" style="min-height: 40px">${pr.reached}-dars materiali</button>` : ''}</div>
            <div class="kpis"><div class="kpi"><span>Ilovada</span><b>${pr?.reached ?? '—'}/72</b><span>${pr?.expected ? 'reja ' + pr.expected : ''}</span></div><div class="kpi"><span>1-urinish</span><b>${pr?.firstTryAvg != null ? Math.round(pr.firstTryAvg) + '%' : '—'}</b><span>o'rtacha</span></div><div class="kpi"><span>7 kun</span><b>${pr?.activeDays7 ?? '—'} kun</b><span>faol</span></div></div>
            ${d.err ? errBox(d, 'det:' + s.id) : !det ? skel(1) : `${coursePath(det, pr)}<div class="list">${lessonRows(det, 3)}</div>${mk ? mistakeNote(mk) : ''}${(det.exams || []).slice(0, 1).map(e => `<div class="between small"><span>${esc(e.label || e.examId)}</span><span class="pill ${e.passed ? 'ok' : 'warn'}">${e.passed ? "o'tdi" : "o'tmadi"}${e.time ? ' · ' + fmtDate(tz(e.time).date) : ''}</span></div>`).join('')}`}
          </section>
          <span class="xs muted" style="padding: 0 4px">To'lov va sotuv ma'lumotlari yordamchi ustozga ko'rsatilmaydi.</span>
        </div>`;
    }
    // "Kalendar" tugmasi — Davomat bo'limida shu o'quvchini ochadi.
    document.addEventListener('click', e => { const b = e.target.closest?.('[data-cal]'); if (!b) return; const t = top(); if (t?.id === 'karta') { davSel = t.arg; davMonth = now().month; davDuty = 'main'; go('davomat'); } });

    // ── Adminga so'rov (o'quvchi bo'yicha) ──────────────────────────────────
    // POST /api/school/requests {type:'student', studentId, topic, reason} — faqat o'z o'quvchisi;
    // admin CRM'da ko'rib, qo'lda hal qiladi (jadval avtomatik o'zgarmaydi).
    const SQ_TOPICS = [['schedule', 'Dars vaqti yoki kunlari', 'masalan 16:30 → 18:00 yoki Du·Ch·Ju → Se·Pa·Sh'], ['freeze', 'Muzlatish', "o'quvchi vaqtincha to'xtatmoqchi"], ['teacher', 'Ustoz almashtirish', "o'quvchi yoki ota-ona so'radi"], ['other', 'Boshqa', 'admin hal qiladi']];
    const SQ_LBL = Object.fromEntries(SQ_TOPICS.map(t => [t[0], t[1]]));
    let sqTopic = 'schedule', sqBusy = false;
    PAGES.sorov = {
        render(id) {
            const s = stuOf(id);
            const mine = (S.requests || []).filter(r => r.type === 'student' && (r.payload?.studentId || (typeof r.payload === 'string' ? (() => { try { return JSON.parse(r.payload).studentId; } catch { return ''; } })() : '')) === id);
            const pay = r => typeof r.payload === 'string' ? (() => { try { return JSON.parse(r.payload); } catch { return {}; } })() : (r.payload || {});
            const st = r => r.status === 'approved' ? '<span class="pill ok">Hal qilindi</span>' : r.status === 'rejected' ? '<span class="pill bad">Rad etildi</span>' : '<span class="pill warn">Kutilmoqda</span>';
            return `${pageHead(h1("Adminga so'rov"), s ? `${esc(s.name)} · ${patternLabel(s.lessonDayOfWeek)} ${esc(s.lessonTime || '')}` : '')}
            <div class="body" style="padding-bottom: 24px">
              <fieldset style="border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px"><legend class="lbl" style="margin-bottom: 8px">Nima kerak?</legend>
                ${SQ_TOPICS.map(([k, l, d]) => `<label class="rad"><input type="radio" name="sq" value="${k}"${k === sqTopic ? ' checked' : ''}><span class="col"><b class="small">${l}</b><span class="xs muted">${esc(d)}</span></span></label>`).join('')}
              </fieldset>
              <div class="field"><label class="lbl" for="sqz">Izoh</label><textarea id="sqz" rows="3" maxlength="300" placeholder="qisqacha: nima va qachondan" style="width: 100%; min-width: 0; resize: vertical"></textarea></div>
              <button type="button" class="btn pri w" data-sqsend${sqBusy ? ' disabled' : ''}>Yuborish</button>
              <span class="xs muted" style="padding: 0 4px">Admin CRM'da ko'rib hal qiladi. O'z ish vaqtingizni yopish, ochish yoki ta'til uchun Jadval → "Vaqt so'rovi".</span>
              ${mine.length ? `<div class="card" style="padding: 4px 14px"><div class="list">${mine.map(r => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(SQ_LBL[pay(r).topic] || "So'rov")}</b><span class="xs muted ell" style="font-weight: 600">${esc(r.reason || '')}${r.decision_note ? ' · ' + esc(r.decision_note) : ''}</span></div>${st(r)}</div>`).join('')}</div></div>` : ''}
            </div>`;
        },
        bind(id) {
            root.querySelectorAll('input[name="sq"]').forEach(r => r.onchange = () => { sqTopic = r.value; });
            const btn = root.querySelector('[data-sqsend]');
            if (btn) btn.onclick = async () => {
                const note = root.querySelector('#sqz').value.trim();
                if (note.length < 3) return toast('Izohni yozing');
                sqBusy = true; btn.disabled = true;
                try {
                    const r = await api('/api/school/requests', { method: 'POST', body: { type: 'student', studentId: id, topic: sqTopic, reason: note } });
                    if (r.request) S.requests = [r.request, ...(S.requests || [])];
                    sqBusy = false; toast("So'rov adminga yuborildi"); render();
                } catch (err) { sqBusy = false; btn.disabled = false; toast(err.message); }
            };
        },
    };

    // ── Darslik ─────────────────────────────────────────────────────────────
    let hub = null, hubErr = '';
    function renderDarslik() {
        if (!hub && !hubErr) { api('/api/academic/hub').then(r => { hub = r; if (S.tab === 'darslik' && !S.pages.length) render(); }).catch(e => { hubErr = e.message; if (S.tab === 'darslik' && !S.pages.length) render(); }); }
        const lessons = hub?.syllabus || [];
        return `${header('Darslik', hub?.course ? `${esc(hub.course.name)} · ${lessons.length} dars` : "Dars materiallari")}
        <div class="body">
          ${hubErr ? `<div class="note w">Darslik yuklanmadi: ${esc(hubErr)} <button type="button" class="btn sm" data-hretry>Qayta urinish</button></div>` : !hub ? skel(2) : `
          <div class="card" style="padding: 4px 14px"><div class="list">${lessons.map(l => {
            const exam = l.no % 12 === 0, live = l.type === 'live';
            return `<button type="button" class="li tap" data-lesson="${l.no}"><span style="width: 36px; height: 36px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex: none; background: ${exam ? '#FEF0C7' : live ? '#EAF3FF' : '#EEF1F6'}; color: ${exam ? '#93370D' : live ? '#0057B8' : '#374151'}">${l.no}</span><div class="col" style="flex: 1; min-width: 0"><span class="nm" style="font-size: 14px">${esc(l.name || `${l.no}-dars`)}</span><span class="xs muted">${live ? 'Jonli' : 'Video'}${l.topic ? ' · ' + esc(l.topic) : ''}${l.studentsHere ? ` · ${l.studentsHere} o'quvchi shu yerda` : ''}</span></div>${ico(I.chev)}</button>`;
          }).join('')}</div></div>`}
          <span class="xs muted" style="padding: 0 4px">Slaydlar, doska va kitob PDF — to'liq versiyada (kompyuter yoki yotiq ekran).</span>
        </div>`;
    }
    bind.darslik = () => { root.querySelector('[data-hretry]')?.addEventListener('click', () => { hubErr = ''; render(); }); };
    async function openLesson(no) {
        const el = sheet(`<div class="between"><h2 style="margin: 0; font-size: 18px; font-weight: 800">${esc(no)}-dars</h2><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div><div id="lb" class="skel"></div>`);
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
              ${mats.length ? `<div class="card" style="padding: 4px 14px"><div class="list">${mats.map(m => `<a class="li" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="pill info" style="min-width: 54px; justify-content: center">${esc(m.kind || 'fayl')}</span><span class="small" style="flex: 1">${esc(m.title || '')}</span>${ico(I.ext)}</a>`).join('')}</div></div>` : ''}
              <a class="btn w pri" href="/index.html?full=1">${ico(I.ext)}Slaydlarni to'liq versiyada ochish</a>`;
        } catch (err) { const box = el.querySelector('#lb'); if (box) box.outerHTML = `<div class="note w">${esc(err.message)}</div>`; }
    }

    // ── Yo'riqnomalar ───────────────────────────────────────────────────────
    let guideQ = '', guideF = 'all';
    // Yo'riqnoma matni CRM muharriridan (HTML) — faqat xavfsiz teglar qoldiriladi.
    function safeHtml(html) {
        const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
        const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'SPAN', 'DIV']);
        const walk = node => {
            for (const ch of [...node.childNodes]) {
                if (ch.nodeType === 3) continue;
                if (ch.nodeType !== 1 || !OK.has(ch.tagName)) { if (ch.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(ch.tagName)) { walk(ch); ch.replaceWith(...ch.childNodes); } else ch.remove(); continue; }
                const href = ch.getAttribute('href');
                for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
                if (ch.tagName === 'A' && href && /^https:\/\//.test(href)) { ch.setAttribute('href', href); ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener'); }
                walk(ch);
            }
        };
        const body = doc.body.firstChild; walk(body);
        const out = body.innerHTML.trim();
        return /<\w/.test(out) ? out : out.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    }
    const readMin = g => { const words = String(g.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length; return Math.max(1, Math.round(words / 180)); };
    PAGES.yoriq = {
        render() {
            const all = myGuides(), q = guideQ.toLowerCase();
            const cats = [...new Set(all.map(g => g.subtitle).filter(Boolean))].slice(0, 3);
            const unread = all.filter(guideIsNew);
            const list = all.filter(g => (!q || `${g.title} ${g.subtitle}`.toLowerCase().includes(q)) && (guideF === 'all' || (guideF === 'new' ? guideIsNew(g) : g.subtitle === guideF)));
            return `${pageHead(h1("Yo'riqnomalar"), 'Lavozimingizga tegishli · yangilari tepada')}
            <div class="body" style="padding-bottom: 24px">
              <div class="field"><label class="lbl" for="yq" style="position: absolute; width: 1px; height: 1px; overflow: hidden">Qidirish</label><input id="yq" type="search" placeholder="Yo'riqnoma qidirish" value="${esc(guideQ)}"></div>
              <div class="pick"><button type="button" data-gf="all" class="${guideF === 'all' ? 'on' : ''}">Hammasi · ${all.length}</button><button type="button" data-gf="new" class="${guideF === 'new' ? 'on' : ''}">O'qilmagan · ${unread.length}</button>${cats.map(c => `<button type="button" data-gf="${esc(c)}" class="${guideF === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>
              <div class="card" style="padding: 4px 14px"><div class="list">${list.map(g => `<button type="button" class="li" data-push="maqola" data-arg="${esc(g.id)}"><div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(g.sticker ? g.sticker + ' ' : '')}${esc(g.title || 'Nomsiz')}</b><span class="xs muted">${g.subtitle ? esc(g.subtitle) + ' · ' : ''}${g.createdAt ? fmtDate(tz(g.createdAt).date) + ' · ' : ''}${guideIsNew(g) ? readMin(g) + ' daq' : "o'qilgan"}</span></div>${guideIsNew(g) ? '<span class="pill info">Yangi</span>' : ''}${chev}</button>`).join('') || `<div class="empty">${all.length ? 'Topilmadi' : "Sizga tegishli yo'riqnoma hali yo'q"}</div>`}</div></div>
              <span class="xs muted" style="padding: 0 4px">"O'qilgan" belgisi shu telefonda saqlanadi.</span>
            </div>`;
        },
        bind() {
            root.querySelectorAll('[data-gf]').forEach(b => b.onclick = () => { guideF = b.dataset.gf; render(); });
            const inp = root.querySelector('#yq');
            inp.oninput = () => { guideQ = inp.value; const pos = inp.selectionStart; render(); const again = root.querySelector('#yq'); again.focus(); again.setSelectionRange(pos, pos); };
        },
    };
    PAGES.maqola = {
        render(id) {
            const g = myGuides().find(x => x.id === id);
            if (!g) return `${pageHead(h1("Yo'riqnoma"), '')}<div class="body"><div class="note w">Yo'riqnoma topilmadi.</div></div>`;
            const wasNew = guideIsNew(g);
            const read = store.get(READ_GUIDES, []); if (!read.includes(g.id)) store.set(READ_GUIDES, [...read, g.id].slice(-200));
            return `${pageHead(`${wasNew ? `<span class="pill info">Yangi${g.subtitle ? ' · ' + esc(g.subtitle) : ''}</span>` : g.subtitle ? `<span class="pill mute">${esc(g.subtitle)}</span>` : ''}<h1 style="margin-top: 8px">${esc(g.sticker ? g.sticker + ' ' : '')}${esc(g.title || '')}</h1>`, `${g.createdAt ? fmtDate(tz(g.createdAt).date) + ' · ' : ''}${readMin(g)} daq o'qish`)}
            <div class="body article" style="padding-bottom: 24px; font-size: 14.5px; line-height: 1.55">${safeHtml(g.content)}</div>`;
        },
    };

    // ── Sessiyalar va kirishlar ─────────────────────────────────────────────
    function uaLabel(ua) {
        const u = String(ua || '');
        const app = /DomworkTeacher|Domwork Teacher/i.test(u) ? 'Domwork Teacher' : /Telegram/i.test(u) ? 'Telegram' : /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : u ? 'Brauzer' : "Noma'lum";
        const os = /Android/i.test(u) ? 'Android' : /iPhone|iPad|iOS/i.test(u) ? 'iOS' : /Windows/i.test(u) ? 'Windows' : /Mac OS|Macintosh/i.test(u) ? 'macOS' : /Linux/i.test(u) ? 'Linux' : '';
        return { label: os ? `${app} · ${os}` : app, mobile: /Android|iPhone|iPad|Mobile/i.test(u) };
    }
    PAGES.sessiya = {
        render() {
            const ss = lazy('sessions', () => api('/api/auth/sessions')), lh = lazy('loginHist', () => api('/api/auth/login-history'));
            const sessions = (ss.data?.sessions || []).slice().sort((a, b) => (b.isCurrent - a.isCurrent) || String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
            const ev = lh.data?.events || [];
            const fails = ev.filter(e => !e.ok);
            const lastFail = fails[0];
            return `${pageHead(h1('Sessiyalar'), 'Qurilmalar va kirishlar · 30 kun')}
            <div class="body" style="padding-bottom: 24px">
              ${fails.length ? `<div class="note w" style="display: flex; gap: 10px; align-items: flex-start">${ico(I.alert, 20)}<span><b>${esc(stamp(lastFail.at))} — ${fails.length} marta noto'g'ri parol${lastFail.ip ? ' (' + esc(lastFail.ip) + ')' : ''}.</b> Siz bo'lmasangiz, parolni o'zgartiring. ${lh.data.failLimit || 5} xatodan keyin kirish ${lh.data.lockMinutes || 15} daqiqaga bloklanadi.</span></div>` : ''}
              <div class="between" style="padding: 0 4px"><span class="sec" style="padding: 0">Faol sessiyalar${ss.data ? ' · ' + sessions.length : ''}</span></div>
              <div class="card" style="padding: 4px 14px"><div class="list">${ss.err ? errBox(ss, 'sessions') : !ss.data ? skel(1) : sessions.map(s => { const u = uaLabel(s.userAgent); return `<div class="li"><span class="evi" style="background: #EEF1F6">${ico(u.mobile ? I.mobile : I.monitor, 20)}</span><div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(u.label)}</b><span class="xs muted">${s.ip ? esc(s.ip) + ' · ' : ''}${s.isCurrent ? 'hozir' : esc(stamp(s.lastSeen || s.createdAt))}</span></div>${s.isCurrent ? '<span class="pill info">shu telefon</span>' : `<button type="button" class="btn sm no" data-kill="${esc(s.id)}">Chiqarish</button>`}</div>`; }).join('') || '<div class="empty">Sessiya yo\'q</div>'}</div></div>
              ${sessions.filter(s => !s.isCurrent).length ? '<button type="button" class="btn w no" data-killall>Boshqa hammasidan chiqish</button>' : ''}
              <div class="sec">Kirishlar tarixi</div>
              <div class="card" style="padding: 4px 14px"><div class="list">${lh.err ? errBox(lh, 'loginHist') : !lh.data ? skel(1) : ev.slice(0, 15).map(e => `<div class="li"><div class="col" style="flex: 1; min-width: 0"><b class="small">${esc(stamp(e.at))}</b><span class="xs muted">${esc(uaLabel(e.userAgent).label)}${e.ip ? ' · ' + esc(e.ip) : ''}</span></div><span class="pill ${e.ok ? 'ok' : 'bad'}">${e.ok ? 'Kirdi' : 'Xato'}</span></div>`).join('') || '<div class="empty">Yozuv yo\'q</div>'}</div></div>
              <button type="button" class="btn w" data-pwd>Parolni o'zgartirish</button>
            </div>`;
        },
        bind() {
            root.querySelector('[data-pwd]')?.addEventListener('click', openPassword);
            root.querySelectorAll('[data-kill]').forEach(b => b.onclick = async () => { b.disabled = true; try { await api(`/api/auth/sessions/${encodeURIComponent(b.dataset.kill)}`, { method: 'DELETE' }); drop('sessions'); toast('Qurilma chiqarildi'); render(); } catch (err) { toast(err.message); b.disabled = false; } });
            root.querySelector('[data-killall]')?.addEventListener('click', async e => { e.currentTarget.disabled = true; try { await api('/api/auth/sessions/others', { method: 'DELETE' }); drop('sessions'); toast('Boshqa qurilmalardan chiqildi'); render(); } catch (err) { toast(err.message); } });
        },
    };

    // ── Profil ──────────────────────────────────────────────────────────────
    function renderProfile() {
        const u = S.user, n = now(), asst = isAssistantOnly();
        const ss = lazy('sessions', () => api('/api/auth/sessions'));
        const newG = myGuides().filter(guideIsNew).length;
        const total = asst ? S.assist?.amount : S.salary?.current?.total;
        const phone = String(u.email || '').replace(/^998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');
        return `<div class="top" style="padding-top: 22px">${u.avatar && /^(\/|https:|data:image)/.test(u.avatar) ? `<img class="av l" src="${esc(u.avatar)}" alt="">` : `<span class="av l" style="display: flex; align-items: center; justify-content: center; font-weight: 800; color: #0057B8; font-size: 22px">${esc(first(u.name)[0] || '')}</span>`}<div class="grow"><h1>${esc(u.name)}</h1><div class="sub">${asst ? 'Yordamchi ustoz' : 'Ustoz'}${S.me?.lang || S.me?.role ? ' · ' + (S.me.lang === 'russian' || S.me.role === 'rus-oqituvchi' ? 'Rus tili' : 'Ingliz tili') : ''}</div><div class="xs muted" style="margin-top: 2px">${esc(phone)}</div></div></div>
        <div class="body" style="gap: 12px">
          ${asst ? `<button type="button" class="card" data-push="ymaosh" style="display: flex; flex-direction: column; gap: 4px; text-align: left; font: inherit; color: inherit; width: 100%; cursor: pointer"><div class="between" style="width: 100%"><span class="lbl">Maosh · ${monName(n.month)} · hozirgacha</span>${chev}</div><b style="font-size: 22px">${money(total)} so'm</b><span class="xs muted">${S.assist?.counted ?? 0} aloqa × ${money(RATE)} · oylar va to'lov holati</span></button>` : ''}
          <div class="sec">Xavfsizlik</div>
          <div class="card" style="padding: 4px 14px"><div class="list">
            <button type="button" class="li" data-act="pwd"><b class="small" style="flex: 1">Parolni o'zgartirish</b>${chev}</button>
            <button type="button" class="li" data-push="sessiya"><b class="small" style="flex: 1">Sessiyalar va kirishlar tarixi</b>${ss.data ? `<span class="pill mute">${ss.data.sessions?.length || 0} qurilma</span>` : ''}${chev}</button>
          </div></div>
          <div class="card" style="padding: 4px 14px"><div class="list">
            <button type="button" class="li" data-push="yoriq"><b class="small" style="flex: 1">Yo'riqnomalar</b>${newG ? `<span class="pill info">${newG} yangi</span>` : ''}${chev}</button>
            ${!asst ? `<button type="button" class="li" data-push="maosh"><b class="small" style="flex: 1">Mening maoshim</b>${total != null ? `<span class="small muted">${money(total)}</span>` : ''}${chev}</button>` : ''}
            ${!asst ? `<button type="button" class="li" data-push="reyting"><b class="small" style="flex: 1">Ustozlar reytingi</b>${chev}</button>` : ''}
            <button type="button" class="li" data-push="bildirish"><b class="small" style="flex: 1">Bildirishnomalar</b>${notifUnread() ? `<span class="pill info">${notifUnread()}</span>` : ''}${chev}</button>
          </div></div>
          <div class="card" style="padding: 4px 14px"><div class="list">
            <a class="li" href="/index.html?full=1"><div class="col" style="flex: 1"><b class="small">To'liq versiya</b><span class="xs muted">Profil, sozlamalar, slaydlar va doska</span></div>${ico(I.ext)}</a>
            <button type="button" class="li" data-act="refresh"><b class="small" style="flex: 1">Ma'lumotni yangilash</b></button>
            <button type="button" class="li" data-act="out" style="color: #B42318"><b class="small" style="flex: 1">Chiqish</b></button>
          </div></div>
          <span class="xs muted" style="padding: 0 4px; text-align: center">Domwork Teacher · 2.0</span>
        </div>`;
    }
    bind.profile = () => {
        root.querySelector('[data-act="out"]').onclick = () => logout(false);
        root.querySelector('[data-act="refresh"]').onclick = async () => { toast('Yangilanmoqda…'); try { await loadAll(); await flushOutbox(); render(); toast('Yangilandi'); } catch (e) { toast(e.message); } };
        root.querySelector('[data-act="pwd"]').onclick = openPassword;
    };
    function openPassword() {
        sheet(`<div class="between"><h2 style="margin: 0; font-size: 18px; font-weight: 800">Parolni o'zgartirish</h2><button type="button" class="icb" data-close aria-label="Yopish">${ico(I.x)}</button></div>
            <div class="field"><label class="lbl" for="p0">Joriy parol</label><input id="p0" type="password" autocomplete="current-password"></div>
            <div class="field"><label class="lbl" for="p1">Yangi parol</label><input id="p1" type="password" autocomplete="new-password"></div>
            <div class="field"><label class="lbl" for="p2">Yangi parolni takrorlang</label><input id="p2" type="password" autocomplete="new-password"></div>
            <div class="note" id="pr">Kamida 4 belgi, eski paroldan farqli.</div>
            <label class="li" style="border: 0; padding: 0"><span class="small" style="flex: 1; font-weight: 700">Boshqa qurilmalardan chiqarish</span><input type="checkbox" id="lo" checked style="width: 22px; height: 22px; accent-color: #0065D6"></label>
            <button type="button" class="btn pri w" data-save>Parolni saqlash</button>`,
        (el, close) => {
            const v = id => el.querySelector(id).value;
            const check = () => { const p = v('#p1'); const ok = p.length >= 4; el.querySelector('#pr').className = 'note' + (p && !ok ? ' w' : ''); return ok; };
            el.querySelector('#p1').oninput = check;
            el.querySelector('[data-save]').onclick = async () => {
                if (!check()) return toast('Parol talablarga mos emas');
                if (v('#p1') !== v('#p2')) return toast('Yangi parollar mos emas');
                try { await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: v('#p0'), newPassword: v('#p1'), logoutOthers: el.querySelector('#lo').checked } }); drop('sessions'); close(); toast('Parol o\'zgartirildi'); }
                catch (err) { toast(err.message); }
            };
        });
    }

    // ── Ishga tushirish ─────────────────────────────────────────────────────
    function errorScreen(err) {
        window.dwtCss?.('/teacher/app.css?v=2');
        const at = hm(now().min);
        root.innerHTML = `${offlineBar()}<div class="top"><div class="grow"><h1>Domwork Teacher</h1><div class="sub">Yuklanmadi</div></div></div>
          <div class="body" style="justify-content: center; align-items: center; text-align: center; gap: 12px; padding-top: 80px; padding-bottom: 140px">
            <span style="width: 72px; height: 72px; border-radius: 22px; background: #FEE4E2; color: #912018; display: flex; align-items: center; justify-content: center">${ico(err.network ? I.wifiOff : I.alert, 34)}</span>
            <h2 style="margin: 0; font-size: 19px; font-weight: 800">Ma'lumot yuklanmadi</h2>
            <p class="muted" style="margin: 0; font-size: 14px; line-height: 1.5; max-width: 280px">${err.network ? "Internet yoki server bilan aloqa yo'q." : 'Server javob bermadi.'}${outbox().length ? ' Belgilagan davomatingiz yo\'qolmaydi — telefonda saqlangan.' : ''}</p>
            <button type="button" class="btn pri" id="rt" style="min-width: 200px">${ico(I.refresh, 18)}Qayta urinish</button>
            <span class="xs muted">${err.status ? `Xato kodi: ${err.status} · ` : ''}${at}${err.status ? ' · muammo davom etsa, adminga shu kodni ayting' : ''}</span>
          </div>`;
        root.querySelector('#rt').onclick = boot;
    }
    function parseHash() {
        const parts = location.hash.slice(1).split('~').filter(Boolean);
        const tab = tabsFor().some(t => t[0] === parts[0]) ? parts[0] : 'home';
        const pages = parts.slice(1).map(p => { const i = p.indexOf(':'); return i < 0 ? { id: p, arg: '' } : { id: p.slice(0, i), arg: decodeURIComponent(p.slice(i + 1)) }; }).filter(p => PAGES[p.id]);
        return { tab, pages };
    }
    async function boot() {
        root.innerHTML = '<div class="body" style="padding-top: 24px"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
        try {
            await loadAll();
            if (!S.me) {
                root.innerHTML = `<div class="body" style="padding-top: 48px"><div class="note w"><b>Akkaunt HR profiliga biriktirilmagan.</b> Administratorga murojaat qiling: login HR'dagi xodim logini bilan bir xil bo'lishi kerak.</div><button type="button" class="btn w" id="out">Chiqish</button></div>`;
                root.querySelector('#out').onclick = () => logout(false);
                return;
            }
            // Ustoz ilovasi v2 (1-noyabr dizayni): asosiy ustoz ham, yordamchi ustoz ham — yangi ekranlar (teacher/v2/*, yordamchi: yordamchi.js).
            if (window.UstozV2) { (window.UstozV2.css || []).forEach(h => window.dwtCss?.(h)); window.UstozV2.start(); flushOutbox(); return; }
            window.dwtCss?.('/teacher/app.css?v=2');
            const h = parseHash();
            S.tab = h.tab; S.pages = [];
            history.replaceState({ pages: [], tab: S.tab }, '', '#' + S.tab);
            for (const p of h.pages) { S.pages = [...S.pages, p]; history.pushState({ pages: S.pages, tab: S.tab }, '', hashFor()); }
            render();
            flushOutbox();
        } catch (err) {
            if (!S.user) return;
            errorScreen(err);
        }
    }
    window.addEventListener('online', () => { if (S.user && S.state) { flushOutbox(); render(); } });
    window.addEventListener('offline', () => { if (S.user && S.state && !document.querySelector('.sheet')) render(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && S.user && S.state && Date.now() - (S._loadedAt || 0) > 120000) loadAll().then(() => { if (!document.querySelector('.sheet')) render(); }).catch(() => {});
    });
    try { S.user = JSON.parse(localStorage.getItem(USER) || 'null'); } catch { S.user = null; }
    // Umumiy yadro v2 uchun (teacher/v2/core.js): ma'lumot, API, davomat va sinov qoidalari — bitta manba.
    window.DWT = { S, api, lazy, drop, loadAll, now, esc, money, pad, hm, toMin, tz, stamp, ago, day10, wdOf, fmtDate, first, short, avatar, initials,
        attFor, setAtt, lessonDays, markOf, coveredBy, uncovered, monthStats, patternOf, patternLabel, trialPhase, tReq, tAt, trialManager, myGuides, guideIsNew,
        outbox, flushOutbox, store, logout, toast, OUTBOX, REASONS, cal, DAY, DAY_FULL, MON, MON_S, isAssistantOnly, stuOf, shiftMonth, CHANNELS, CAP };
    if (!localStorage.getItem(TOKEN) || S.user?.role !== 'teacher') { S.user = null; if (window.UstozV2) location.replace('/'); else renderLogin(); }
    else boot();
    window.__dwt = S;
})();
