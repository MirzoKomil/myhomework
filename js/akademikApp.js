// Jamoa — Akademik rahbar (role=akademik) telefon kabineti (2026-11, "Akademik" kanvasi: A01–A21).
// Faqat role=akademik va ekran ≤900px bo'lganda yoqiladi; kompyuter ko'rinishi o'zgarmaydi.
// Ma'lumot: /api/academic/head/* va /api/academic/problems* (AKADEMIK-API kelishuvi), o'tkazish —
// /api/school/students/:id/teacher, bildirishnomalar — mavjud staffNotify paneli (js/notifications.js).
// Sinov vaqtlarini ochish/yopish — mavjud Dars jadvali v3 (js/jadvalV3.js) orqali.
// Uslublar: css/akademikApp.css (aka- prefiksi).
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const DAY = 86400000;
    const g = name => (typeof window[name] === 'function' ? window[name] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isOn = () => user().role === 'akademik' && MQ.matches;
    // Maket: ikki so'z — bosh harflar (MS), bitta so'z — ilk ikki harf (GU).
    const initials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return '?'; return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toLocaleUpperCase('uz'); };
    const first = n => String(n || '').trim().split(/\s+/)[0] || '';
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || ''); };
    const pad = n => String(n).padStart(2, '0');
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const pct = v => Math.max(0, Math.min(100, Math.round(num(v))));
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const money = n => Math.round(num(n)).toLocaleString('ru-RU').replace(/ |,/g, ' ') + ' soʻm';
    const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
    const tgHref = p => { const d = String(p || '').replace(/\D/g, ''); return d ? 'https://t.me/+' + (d.length === 9 ? '998' + d : d) : ''; };

    // ---------- sana/vaqt ----------
    // 'YYYY-MM-DD' — mahalliy sana; ISO — vaqt bilan.
    const toDate = v => { if (!v) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, m - 1, d); } const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
    const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dayDiff = v => { const d = toDate(v); if (!d) return 0; return Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / DAY); };
    const hm = v => { const d = toDate(v); return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
    const dShort = v => { const d = toDate(v); return d ? `${d.getDate()}-${MON3[d.getMonth()]}` : ''; };
    const dLong = v => { const d = toDate(v); return d ? `${d.getDate()}-${MON[d.getMonth()]}` : ''; };
    const dtShort = v => `${dShort(v)} ${hm(v)}`;
    const dtComma = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dShort(v) : `${dShort(v)}, ${hm(v)}`);
    const relDT = v => { const k = dayDiff(v); return k === 0 ? `Bugun ${hm(v)}` : k === -1 ? `Kecha ${hm(v)}` : k === 1 ? `Ertaga ${hm(v)}` : dtComma(v); };
    const overdueTxt = v => { const ms = Date.now() - (toDate(v)?.getTime() || Date.now()); const h = Math.floor(ms / 3600000); return h >= 24 ? `${Math.floor(h / 24)} kun oʻtdi` : `${Math.max(1, h)} soat oʻtdi`; };
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    // Ustozni o'tgan sanadan almashtirish chegarasi — o'tgan oyning 1-sanasi (server studentOps.backdateMin).
    const backMinA = () => { const t = new Date(); return localDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)); };
    const atTime = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
    const greet = () => { const h = new Date().getHours(); return h < 11 ? 'Xayrli tong' : h < 17 ? 'Xayrli kun' : 'Xayrli kech'; };

    // ---------- ikonkalar (dizayndagi chiziqlar) ----------
    const P = {
        back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
        send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', check: '<path d="M20 6L9 17l-5-5"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        team: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        cap: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
        trend: '<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
        face: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><circle cx="12" cy="11" r="3"/><path d="M8 17a4.5 4.5 0 018 0"/>',
        archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
        bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>',
        note: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    };
    const ic = (n, s = 18, w = 2.2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

    // ---------- lug'atlar ----------
    const STAGES = [['logged', 'Qayd etildi', 'grey'], ['assigned', 'Masʼul tayinlandi', 'purple'], ['in_progress', 'Hal qilinmoqda', 'blue'], ['closed', 'Yopildi', 'green']];
    const stageOf = k => STAGES.find(s => s[0] === k) || STAGES[0];
    const TYPES = [['teacher', 'Ustoz'], ['app', 'Mobil ilova'], ['schedule', 'Jadval'], ['payment', 'Toʻlov / ketish'], ['other', 'Boshqa']];
    const SOURCES = [['student', 'Oʻquvchi'], ['teacher', 'Ustoz'], ['assistant', 'Yordamchi ustoz'], ['sales', 'Sotuv menejeri'], ['self', 'Oʻzim aniqladim']];
    const SRC_LOW = { student: 'oʻquvchi', teacher: 'ustoz', assistant: 'yordamchi ustoz', sales: 'sotuv menejeri', self: 'oʻzi' };
    const SRC_CHIP = { student: 'Oʻquvchi xabar berdi', teacher: 'Ustoz xabar berdi', assistant: 'Yordamchi xabar berdi', sales: 'Sotuv xabar berdi', self: 'Oʻzim aniqladim' };
    const RESULTS = [['solved', 'Hal qilindi', 'Oʻquvchi rozi, dars joyiga tushdi'], ['teacher_changed', 'Ustoz almashtirildi', 'Oʻquvchini oʻtkazish oynasi ochiladi'], ['unsolved', 'Hal boʻlmadi', 'Oʻquvchi ketdi yoki muzlatdi']];
    const RISK = [['all', 'Hammasi'], ['noapp', 'Appga kirmayapti'], ['absent', 'Darsga kelmayapti'], ['behind', 'Orqada']];
    const TONE_BAR = { red: '#D92D20', amber: '#F79009', blue: '#0065D6', green: '#079455' };

    // ---------- holat ----------
    const S = { screen: 'home', stack: [], ptab: 'open', pq: '', later: false, mtab: 'pending', mAll: false, rtab: 'all', rAll: false, rTeacher: '', stab: 'all', sTeacher: '', sq: '', ttab: 'teachers', ltab: 'pending', ntab: 'all', silentAll: false, pid: null, sid: null, tid: null, aid: null, draft: null };
    const C = new Map(); // url -> { d, e, p, at }
    let root, nav, sheetEl, toastEl, toastTimer, inited = false, qTimer = null;

    // ---------- ma'lumot ----------
    function need(url, force) {
        let c = C.get(url);
        if (!c) { c = { at: 0 }; C.set(url, c); }
        const stale = Date.now() - c.at > 60000;
        if (!c.p && (force || (!c.d && !c.e) || stale)) {
            c.p = apiFetch(url, { fresh: true })
                .then(d => { c.d = d || {}; c.e = null; }, e => { if (!c.d) c.e = e; })
                .finally(() => { c.p = null; c.at = Date.now(); if (root) render(false); emit(); });
        }
        return c;
    }
    const peek = url => C.get(url)?.d || null;
    // Kompyuter kabineti (js/akademikDesk.js) shu keshni ishlatadi: maʼlumot kelganda yoki eskirganda qayta chizadi.
    const listeners = new Set(), sheetHooks = new Set();
    let emitQ = false;
    function emit() { if (emitQ || !listeners.size) return; emitQ = true; Promise.resolve().then(() => { emitQ = false; listeners.forEach(fn => { try { fn(); } catch (e) { console.error('[akademikApp] listener', e); } }); }); }
    function invalidate(...prefixes) { for (const k of [...C.keys()]) if (prefixes.some(p => k.startsWith(p))) C.get(k).at = 0; emit(); }
    const API = {
        me: '/api/academic/head/me', ov: '/api/academic/head/overview',
        problems: (st, q) => `/api/academic/problems?status=${st}${q ? '&q=' + encodeURIComponent(q) : ''}`,
        problem: id => '/api/academic/problems/' + encodeURIComponent(id),
        makeups: st => '/api/academic/head/makeups?status=' + st,
        risk: r => '/api/academic/head/risk?reason=' + r,
        student: id => '/api/academic/head/students/' + encodeURIComponent(id),
        transfer: id => `/api/academic/head/students/${encodeURIComponent(id)}/transfer-options`,
        teachers: '/api/academic/head/teachers', teacher: id => '/api/academic/head/teachers/' + encodeURIComponent(id),
        assistants: '/api/academic/head/assistants', assistant: id => '/api/academic/head/assistants/' + encodeURIComponent(id),
        late: st => '/api/academic/head/late-contacts?status=' + st,
    };
    async function send(url, method, body) { return apiFetch(url, { method, body: JSON.stringify(body || {}) }); }

    // Til: /me → langs ['rus'|'english'] (server), zaxira — foydalanuvchi maydonlari.
    const LONG = l => (l === 'rus' || l === 'russian' ? 'russian' : l === 'english' ? 'english' : null);
    function myLangs() {
        const m = peek(API.me);
        const raw = (m && Array.isArray(m.langs) && m.langs.length ? m.langs : [user().linkedAcademicLang || user().linkedHrLang || user().lang].filter(Boolean));
        const out = [...new Set(raw.flatMap(l => (l === 'both' ? ['russian', 'english'] : [LONG(l)])).filter(Boolean))];
        return out;
    }
    const langLabel = l => (LONG(l) === 'russian' ? 'Rus tili' : LONG(l) === 'english' ? 'Ingliz tili' : '');
    const myLangLabel = () => { const L = myLangs(); return L.length === 1 ? langLabel(L[0]) : L.length ? 'Rus va ingliz tili' : ''; };
    const ownLang = () => { const L = myLangs(); return L.length === 1 ? L[0] : ''; };
    const myName = () => peek(API.me)?.name || user().name || '';
    const isMe = n => !!n && !!myName() && String(n).trim() === String(myName()).trim();

    // Muammo maydonlari: ro'yxatda camelCase, kartada jadval ustunlari ham kelishi mumkin.
    const f = (o, ...keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return null; };
    const normP = p => p && ({
        id: f(p, 'id'), stage: f(p, 'stage') || 'logged', title: f(p, 'title') || '', details: f(p, 'details') || '', type: f(p, 'type'), source: f(p, 'source'),
        studentId: f(p, 'studentId', 'student_id'), studentName: f(p, 'studentName', 'student_name') || '', teacherId: f(p, 'teacherId', 'teacher_id'), teacherName: f(p, 'teacherName', 'teacher_name') || '',
        ownerId: f(p, 'ownerId', 'owner_id'), ownerName: f(p, 'ownerName', 'owner_name'), dueAt: f(p, 'dueAt', 'due_at'), result: f(p, 'result'), resultNote: f(p, 'resultNote', 'result_note'),
        followupAt: f(p, 'followupAt', 'followup_at'), createdAt: f(p, 'createdAt', 'created_at'), createdByName: f(p, 'createdByName', 'created_by_name'), closedAt: f(p, 'closedAt', 'closed_at'),
        remindCount: num(f(p, 'remindCount', 'remind_count')), lang: f(p, 'lang'), studentPhone: f(p, 'studentPhone', 'student_phone'), teacherPhone: f(p, 'teacherPhone', 'teacher_phone'),
        overdue: p.overdue != null ? !!p.overdue : (f(p, 'stage') !== 'closed' && !!f(p, 'dueAt', 'due_at') && toDate(f(p, 'dueAt', 'due_at')) < new Date()),
    });

    // ---------- bo'laklar ----------
    const AV = { blue: ['#EAF3FF', '#0057B8'], red: ['#FEF3F2', '#B42318'], amber: ['#FEF0C7', '#93370D'], dark: ['#0B1220', '#FFFFFF'], grey: ['#E6EAF2', '#3A4456'], white: ['#FFFFFF', '#0057B8'] };
    const ava = (name, size = 40, tone = 'blue') => { const [b, c] = AV[tone] || AV.blue; return `<span class="aka-av" aria-hidden="true" style="width:${size}px;height:${size}px;background:${b};color:${c};font-size:${size >= 52 ? 17 : size >= 40 ? 14 : 13}px">${esc(initials(name))}</span>`; };
    const chip = (t, tone = 'grey') => `<span class="aka-chip t-${tone}">${esc(t)}</span>`;
    const bar = (w, tone) => `<span class="aka-bar" aria-hidden="true"><i style="width:${pct(w)}%;background:${TONE_BAR[tone] || tone}"></i></span>`;
    function top(title, { sub = '', back = true, right = '' } = {}) {
        return `<header class="aka-top">${back ? `<button type="button" class="aka-ib" data-a-back aria-label="Orqaga">${ic('back', 20, 2.2)}</button>` : ''}
            <div class="aka-tt">${sub ? `<span>${esc(sub)}</span>` : ''}<h1>${esc(title)}</h1></div>${right}</header>`;
    }
    const tabs = (attr, list, cur, label, wrap = false) => `<div class="aka-tabs aka-s1${wrap ? ' aka-wrap' : ''}" role="tablist" aria-label="${esc(label)}">${list.map(([k, t]) => `<button type="button" role="tab" class="aka-tab" aria-selected="${k === cur}" data-a-${attr}="${esc(k)}">${esc(t)}</button>`).join('')}</div>`;
    const sk = (n = 3, h = 88) => `<div class="aka-body">${Array.from({ length: n }, () => `<div class="aka-sk" style="height:${h}px"></div>`).join('')}</div>`;
    const skIn = (n = 3, h = 72) => Array.from({ length: n }, () => `<div class="aka-sk" style="height:${h}px"></div>`).join('');
    function errBox(e, key) {
        return `<div class="aka-err" role="alert"><span>${ic('alert', 20)}</span><div><strong>Maʼlumot yuklanmadi</strong><small>${esc(e?.message || 'Internet aloqasini tekshiring')}</small></div>
            <button type="button" class="aka-btn aka-btn--out aka-btn--sm" data-a-retry="${esc(key)}">Qayta urinish</button></div>`;
    }
    const emptyBox = (icon, title, sub = '') => `<div class="aka-empty"><span>${ic(icon, 26, 1.9)}</span><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    // url yuklanmagan bo'lsa — skelet; xato — "Qayta urinish"; aks holda fn(data).
    function withData(url, fn, skel) {
        const c = need(url);
        if (c.d) return fn(c.d);
        if (c.e) return errBox(c.e, url);
        return skel != null ? skel : skIn(3);
    }
    const note = (text, icon = 'bot') => `<p class="aka-note">${ic(icon, 16, 2)}<span>${esc(text)}</span></p>`;
    const kv = (label, val, { link = '', tone = '' } = {}) => link
        ? `<button type="button" class="aka-kv aka-kv--a" ${link}><span>${esc(label)}</span><strong>${esc(val)}</strong></button>`
        : `<div class="aka-kv"><span>${esc(label)}</span><strong${tone ? ` class="c-${tone}"` : ''}>${esc(val)}</strong></div>`;
    const navRow = (title, sub, attr) => `<button type="button" class="aka-nrow" ${attr}><span><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${ic('chev', 18, 2.2)}</button>`;
    const moreRow = (text, attr) => `<button type="button" class="aka-more aka-s3" ${attr}><strong>${esc(text)}</strong>${ic('chev', 18, 2.2)}</button>`;
    const bbar = html => `<div class="aka-bbar">${html}</div>`;
    const bell = () => {
        const n = unread();
        return `<button type="button" class="aka-bell" data-a-go="notifs" aria-label="Bildirishnomalar${n ? ', ' + n + ' ta yangi' : ''}">${ic('bell', 20, 2)}${n ? `<b>${n > 99 ? '99+' : n}</b>` : ''}</button>`;
    };
    function unread() {
        if (g('getUnreadCount') && window.staffNotify) { try { return getUnreadCount(); } catch (e) { /* */ } }
        return num(peek(API.ov)?.unreadNotifications);
    }
    // Davomat (js/davomatApp.js, Face ID): menuInfo() — {tracked, approver, pending}. Bandlar shu boʻyicha koʻrinadi; bosish — davomat.open() (data-dv-go).
    const dvInfo = () => { try { return window.davomat?.menuInfo?.() || null; } catch (e) { return null; } };
    let dvAsked = false;
    function dvEnsure() { if (window.davomat && !window.davomat.state?.() && !dvAsked) { dvAsked = true; Promise.resolve(window.davomat.refresh?.()).then(() => render(false), () => {}); } }
    const dvAcademic = () => dvInfo()?.approver === 'academic';
    const scoreTone = s => (num(s) >= 80 ? 'green' : num(s) >= 65 ? 'amber' : 'red');
    const pctTone = (v, good = 80, mid = 60) => (num(v) >= good ? '' : num(v) >= mid ? 'amber' : 'red');

    // =====================================================================================
    // A01 · Bosh
    // =====================================================================================
    function scrHome() {
        const u = user(); const d = new Date();
        const head = `<header class="aka-top aka-top--home"><button type="button" class="aka-me" data-a-go="menu" aria-label="Profil va menyu">${esc(initials(u.name || myName()))}<span aria-hidden="true"></span></button>
            <div class="aka-tt"><span>${WD[d.getDay()]}, ${d.getDate()}-${MON[d.getMonth()]} · <b>Akademik${myLangLabel() ? ' · ' + esc(myLangLabel()) : ''}</b></span><h1>${greet()}, ${esc(first(u.name || myName()))}</h1></div>${bell()}</header>`;
        const c = need(API.ov);
        if (!c.d) return head + (c.e ? `<div class="aka-body">${errBox(c.e, API.ov)}</div>` : `<div class="aka-body"><div class="aka-sk" style="height:184px;border-radius:24px"></div><div class="aka-sk" style="height:44px"></div>${skIn(2, 120)}</div>`);
        const o = c.d, st = o.students || {}, t = o.tiles || {};
        const total = num(st.total), onPlan = num(st.onPlan), behind = st.behind != null ? num(st.behind) : Math.max(0, total - onPlan);
        const ratio = total ? onPlan / total : 0, off = Math.round(226 * (1 - ratio));
        const hero = `<button type="button" class="aka-hero aka-s1" data-a-go="risk" data-a-rtab="behind" aria-label="Oʻquvchilar progressi, batafsil">
            <svg class="aka-hex" aria-hidden="true" width="100%" height="100%"><defs><pattern id="akaHex" width="48" height="41.6" patternUnits="userSpaceOnUse"><path d="M12 0h24l12 20.8-12 20.8H12L0 20.8z" fill="none" stroke="#FFFFFF" stroke-width="1.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#akaHex)"/></svg>
            <span class="aka-hero-r"><span class="aka-ring"><svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label="Oʻquvchilarning ${Math.round(ratio * 100)} foizi rejadagi darsda"><circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="9"/><circle class="aka-ring-v" cx="42" cy="42" r="36" fill="none" stroke="#3B8BEE" stroke-width="9" stroke-linecap="round" stroke-dasharray="226" style="stroke-dashoffset:${off}" transform="rotate(-90 42 42)"/></svg>
                <span><strong>${Math.round(ratio * 100)}%</strong><small>rejada</small></span></span>
              <span class="aka-hero-t"><em>REJADA OʻQIYAPTI · ${MON[d.getMonth()].toUpperCase().replace("'", 'ʻ')}</em><span><strong>${onPlan}</strong><small>/ ${total} oʻquvchi</small></span><small>${behind} tasi darsdan orqada · ${num(o.teachersTotal)} ustoz</small></span></span>
            <span class="aka-sub3"><span><small>Darsga keldi</small><strong>${pct(o.attendancePct)}%</strong></span><span><small>Ketdi (oyda)</small><strong class="c-yel">${num(st.left30)} ta</strong></span><span><small>Muzlatilgan</small><strong>${num(st.frozen)} ta</strong></span></span></button>`;
        const nt = t.nextUnacceptedTrial;
        const tiles = [
            { k: 'overdue', n: num(t.overdueProblems), icon: 'alert', tone: 'red', title: 'Muammo muddati oʻtdi', sub: num(t.overdueProblems) ? `Eng eskisi ${num(t.oldestOverdueDays)} kun${num(t.oldestOverdueReminds) ? ` · bot ${num(t.oldestOverdueReminds)} marta eslatdi` : ''}` : 'Muddati oʻtgan yoʻq', subTone: num(t.overdueProblems) ? 'red' : '', go: 'data-a-go="problems" data-a-ptab="open"' },
            { k: 'makeups', n: num(t.makeupsPending), icon: 'phone', tone: 'blue', title: 'Qoplashni tekshirish', sub: 'Oʻquvchiga qoʻngʻiroq', go: 'data-a-go="makeups"' },
            { k: 'risk', n: num(t.risk), icon: 'trend', tone: 'amber', title: 'Ketish xavfi', sub: num(t.riskNoApp) ? `${num(t.riskNoApp)} tasi appga kirmayapti` : 'Xavf roʻyxati', subTone: num(t.riskNoApp) ? 'amber' : '', go: 'data-a-go="risk" data-a-rtab="all"' },
            { k: 'trial', n: num(t.trialsUnaccepted), icon: 'cal', tone: 'purple', title: 'Sinov qabul qilinmagan', sub: nt ? `${relDT(nt.time).replace(/ 00:00$/, '')} · ${first(nt.teacher)}` : 'Hammasi qabul qilingan', go: 'data-a-crm="teachers-section:trial"' },
        ];
        const cats = tiles.filter(x => x.n > 0), sum = cats.reduce((a, x) => a + x.n, 0);
        const tileHtml = x => `<button type="button" class="aka-tile4${x.k === 'overdue' && x.n ? ' is-hot aka-pulse' : ''}" ${x.go}><span class="aka-tile4-h"><span class="aka-qi t-${x.tone}">${ic(x.icon, 18)}</span><strong>${x.n}</strong></span><strong>${esc(x.title)}</strong><small class="${x.subTone ? 'c-' + x.subTone : ''}">${esc(x.sub)}</small></button>`;
        const att = (o.teachersAttention || []).slice(0, 3);
        const attRow = (r) => { const tone = r.tone === 'red' ? 'red' : r.tone === 'blue' ? 'blue' : 'amber';
            return `<button type="button" class="aka-arow" data-a-teacher="${esc(r.id)}">${ava(first(r.name), 40, tone === 'blue' ? 'blue' : tone)}<span class="aka-arow-t"><span><strong>${esc(first(r.name))}</strong>${r.reason ? chip(r.reason, tone) : ''}</span>${bar(r.onPlanPct, tone)}<small>${num(r.students)} oʻquvchi · ${pct(r.onPlanPct)}% rejada oʻqiyapti</small></span></button>`; };
        dvEnsure();
        return head + `<div class="aka-body aka-body--home">${window.davomat ? window.davomat.homeCard() : ''}${hero}
            <button type="button" class="aka-btn aka-btn--line aka-s2" data-a-go="pnew">${ic('plus', 18, 2.4)}Muammo yozish</button>
            <section class="aka-sec aka-s2"><div class="aka-sh"><h2>Hozir hal qiling</h2><span class="${sum ? 'c-red' : 'c-green'}">${sum ? `${cats.length} toifa · ${sum} ta` : 'Hammasi hal qilingan'}</span></div>
                <div class="aka-grid2">${tiles.map(tileHtml).join('')}</div></section>
            <section class="aka-sec aka-s3"><div class="aka-sh"><h2>Ustozlar · avval eʼtibor kerak</h2><button type="button" class="aka-link" data-a-go="teachers" data-a-ttab="teachers">Hammasi · ${num(o.teachersTotal)}</button></div>
                <div class="aka-card aka-list">${att.length ? att.map(attRow).join('') : emptyBox('check', 'Hamma ustoz reja boʻyicha', 'Eʼtibor kerak boʻlgan ustoz yoʻq')}</div></section></div>`;
    }

    // =====================================================================================
    // A02 · Muammolar roʻyxati
    // =====================================================================================
    function probCard(p, pulse) {
        const [, sl, stone] = stageOf(p.stage);
        let due = '';
        if (p.stage === 'closed') due = p.closedAt ? `<span class="aka-due t-green">${ic('check', 12, 2.6)}Yopildi ${esc(dShort(p.closedAt))}</span>` : '';
        else if (p.overdue) due = `<span class="aka-due t-solid">${ic('clock', 12, 2.6)}${esc(overdueTxt(p.dueAt))}</span>`;
        else if (p.dueAt) due = `<span class="aka-due t-${dayDiff(p.dueAt) === 0 ? 'amber' : 'grey'}">${ic('clock', 12, 2.6)}${esc(dayDiff(p.dueAt) === 0 ? 'Bugun ' + hm(p.dueAt) : relDT(p.dueAt))}</span>`;
        const owner = p.ownerName ? `<small class="aka-own">Masʼul: ${esc(isMe(p.ownerName) ? 'Siz' : first(p.ownerName))}</small>` : `<small class="aka-own c-amber">Masʼul: tayinlanmagan</small>`;
        return `<button type="button" class="aka-pc${p.overdue ? ' is-late' : ''}${pulse ? ' aka-pulse' : ''}" data-a-problem="${esc(p.id)}">
            <span class="aka-pc-h">${chip(sl, stone)}${due}</span><strong>${esc(p.title)}</strong>
            <span class="aka-pc-f"><small>${esc([shortName(p.studentName), p.teacherName ? 'ustoz ' + first(p.teacherName) : '', p.source ? 'xabar: ' + (SRC_LOW[p.source] || p.source) : ''].filter(Boolean).join(' · '))}</small>${p.stage === 'closed' ? '' : owner}</span></button>`;
    }
    function scrProblems() {
        const url = API.problems(S.ptab, S.pq.trim());
        const counts = (need(url).d || peek(API.problems('open')) || {}).counts || {};
        const head = top('Muammolar', { sub: myLangLabel(), right: `<button type="button" class="aka-ib aka-ib--pri" data-a-go="pnew" aria-label="Muammo yozish">${ic('plus', 20, 2.4)}</button>` });
        const body = withData(url, d => {
            const items = (d.items || []).map(normP);
            if (!items.length) return emptyBox(S.ptab === 'closed' ? 'archive' : 'check', S.pq ? 'Hech narsa topilmadi' : S.ptab === 'closed' ? 'Yopilgan muammo yoʻq' : 'Ochiq muammo yoʻq', S.pq ? 'Qidiruvni oʻzgartiring' : S.ptab === 'closed' ? '' : 'Yangi muammo “+” orqali yoziladi');
            if (S.ptab === 'closed') return `<section class="aka-sec aka-s2">${items.map(p => probCard(p)).join('')}</section>`;
            const over = items.filter(p => p.overdue), today = items.filter(p => !p.overdue && p.dueAt && dayDiff(p.dueAt) <= 0), later = items.filter(p => !p.overdue && !(p.dueAt && dayDiff(p.dueAt) <= 0));
            return `${over.length ? `<section class="aka-sec aka-s2"><h2 class="aka-h3 c-red">Muddati oʻtgan · ${over.length}</h2>${over.map((p, i) => probCard(p, i === 0)).join('')}</section>` : ''}
                ${today.length ? `<section class="aka-sec aka-s3"><h2 class="aka-h3">Bugun · ${today.length}</h2>${today.map(p => probCard(p)).join('')}</section>` : ''}
                ${later.length ? (S.later || (!over.length && !today.length) ? `<section class="aka-sec aka-s3"><h2 class="aka-h3">Keyingi kunlar · ${later.length}</h2>${later.map(p => probCard(p)).join('')}</section>` : moreRow(`Keyingi kunlar · ${later.length}`, 'data-a-later')) : ''}`;
        }, skIn(3, 104));
        return head + `<div class="aka-body">
            <label class="aka-search aka-s1">${ic('search', 18)}<span class="aka-sr">Qidirish</span><input id="akaQ" type="search" placeholder="Oʻquvchi, ustoz yoki muammo" value="${esc(S.pq)}" data-a-q autocomplete="off"></label>
            ${tabs('ptab', [['open', `Ochiq${counts.open != null ? ' · ' + counts.open : ''}`], ['mine', `Mening${counts.mine != null ? ' · ' + counts.mine : ''}`], ['closed', 'Yopilgan']], S.ptab, 'Holat')}
            ${body}</div>`;
    }

    // =====================================================================================
    // A03 · Muammo yozish
    // =====================================================================================
    function localStudents() {
        const langs = myLangs();
        let list = [];
        try { list = (g('getItem') ? getItem(STORAGE_KEYS.students, []) : []) || []; } catch (e) { list = []; }
        let teachers = [];
        try { teachers = [...(getItem(STORAGE_KEYS.teachers, []) || []), ...(getItem(STORAGE_KEYS.hrEmployees, []) || [])]; } catch (e) { /* */ }
        const tName = id => teachers.find(t => String(t.id) === String(id))?.name || '';
        const out = list.filter(s => !s.isStaffDemo && s.status !== 'inactive' && (!langs.length || langs.includes(LONG(s.subject) || 'english')))
            .map(s => ({ id: s.id, name: s.name || '', teacherId: s.teacherId || null, teacherName: s.teacherName || tName(s.teacherId), lessonNo: s.currentLesson || s.lessonNo || null,
                schedule: s.lessonDayOfWeek != null && s.lessonTime ? `${[1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? 'toq' : [2, 4, 6].includes(Number(s.lessonDayOfWeek)) ? 'juft' : WD[Number(s.lessonDayOfWeek) % 7]} kunlar ${s.lessonTime}` : '' }));
        // Zaxira: xavf roʻyxatidagi oʻquvchilar (server).
        for (const r of peek(API.risk('all'))?.items || []) if (!out.some(x => String(x.id) === String(r.id))) out.push({ id: r.id, name: r.name, teacherName: r.teacherName, lessonNo: r.lessonNo, schedule: '' });
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }
    function staffList() {
        try { return (getItem(STORAGE_KEYS.hrEmployees, []) || []).filter(e => e.status !== 'inactive' && !e.offboardedAt && e.name); } catch (e) { return []; }
    }
    function dueOptions() {
        const now = new Date(), out = [];
        if (now.getHours() < 19 || (now.getHours() === 19 && now.getMinutes() < 30)) out.push(['today', `Bugun · 20:00`, atTime(now, 20)]);
        const t1 = atTime(addDays(now, 1), 18); out.push(['tomorrow', `Ertaga · ${dShort(t1)} 18:00`, t1]);
        const t3 = atTime(addDays(now, 3), 18); out.push(['d3', `3 kun · ${dShort(t3)}`, t3]);
        out.push(['custom', 'Sana tanlash', null]);
        return out;
    }
    const chips = (name, opts, sel) => `<div class="aka-chips">${opts.map(([v, t, , dis]) => `<label class="aka-ch${dis ? ' is-off' : ''}"><input type="radio" name="${esc(name)}" value="${esc(v)}"${v === sel ? ' checked' : ''}${dis ? ' disabled' : ''}>${ic('check', 14, 2.8)}${esc(t)}</label>`).join('')}</div>`;
    const fs = (legend, req, inner, cls = '') => `<fieldset class="aka-fs ${cls}"><legend><span class="aka-lbl">${esc(legend)}${req ? ' <i>*</i>' : ''}</span></legend>${inner}</fieldset>`;
    function newDraft(extra = {}) {
        return { studentId: null, studentName: '', teacherId: null, teacherName: '', studentMeta: '', type: 'teacher', source: 'student', title: '', details: '', owner: 'self', ownerStaff: null, due: 'tomorrow', dueCustom: '', ...extra };
    }
    function scrNew() {
        const D = S.draft || (S.draft = newDraft());
        const owners = [['self', 'Siz']];
        if (D.teacherId && D.teacherName) owners.push(['teacher', `${first(D.teacherName)} (ustoz)`]);
        if (staffList().length) owners.push(['staff', D.ownerStaff ? D.ownerStaff.name : 'Boshqa xodim…']);
        owners.push(['later', 'Keyinroq']);
        const dues = dueOptions();
        if (!dues.some(x => x[0] === D.due)) D.due = 'tomorrow';
        const student = D.studentId
            ? `<button type="button" class="aka-pick" data-a-spick>${ava(D.studentName, 40)}<span class="aka-pick-t"><strong>${esc(D.studentName)}</strong><small>${esc([D.teacherName ? 'Ustoz: ' + first(D.teacherName) : '', D.studentMeta].filter(Boolean).join(' · '))}</small></span><em>Oʻzgartirish</em></button>`
            : `<button type="button" class="aka-pick aka-pick--empty" data-a-spick><span class="aka-qi t-blue">${ic('search', 18)}</span><span class="aka-pick-t"><strong>Oʻquvchini tanlang</strong><small>Ism boʻyicha qidiring</small></span><em>Tanlash</em></button>`;
        return top('Muammo yozish', { sub: 'Yangi karta' }) + `<form class="aka-body aka-body--bar aka-form" data-a-newform novalidate>
            <div class="aka-fld aka-s1"><span class="aka-lbl">Oʻquvchi <i>*</i></span>${student}<small class="aka-hint">Ustoz oʻquvchidan avtomatik olinadi</small></div>
            <div class="aka-fgroup aka-s2">
              ${fs('Muammo turi', true, chips('type', TYPES, D.type))}
              ${fs('Kim xabar berdi', true, chips('source', SOURCES, D.source))}
              <label class="aka-fld"><span class="aka-lbl">Qisqa sarlavha <i>*</i></span><input id="akaNTitle" class="aka-inp" type="text" maxlength="140" value="${esc(D.title)}" data-a-draft="title" placeholder="Masalan: ustoz darsga kech kiryapti" required></label>
              <label class="aka-fld"><span class="aka-lbl">Tafsilot</span><textarea id="akaNDetails" class="aka-ta" rows="3" maxlength="2000" data-a-draft="details" placeholder="Kim, qachon, nima dedi…">${esc(D.details)}</textarea></label>
              ${fs('Masʼul', false, chips('owner', owners, D.owner))}
              ${fs('Muddat', true, chips('due', dues, D.due) + (D.due === 'custom' ? `<label class="aka-fld"><span class="aka-sr">Sana va vaqt</span><input id="akaNDue" class="aka-inp" type="datetime-local" value="${esc(D.dueCustom)}" data-a-draft="dueCustom" min="${localDate()}T00:00"></label>` : ''))}
              ${note('Masʼul tanlanmasa karta «Qayd etildi»da qoladi. Muddat oʻtsa karta qizarib, bot sizga va masʼulga Telegramda eslatadi.')}
            </div></form>
            ${bbar(`<button type="button" class="aka-btn aka-btn--ghost aka-btn--fit" data-a-back>Bekor qilish</button><button type="button" class="aka-btn aka-btn--pri" data-a-newsave>Kartani ochish</button>`)}`;
    }
    function draftDue(D) {
        if (D.due === 'custom') { const d = D.dueCustom ? new Date(D.dueCustom) : null; return d && !Number.isNaN(d.getTime()) ? d : null; }
        return (dueOptions().find(x => x[0] === D.due) || [])[2] || null;
    }
    async function saveNew(btn) {
        const D = S.draft; if (!D) return;
        if (!D.studentId) { toast('Oʻquvchini tanlang', 'bad'); return; }
        if (!D.title.trim()) { toast('Qisqa sarlavha yozing', 'bad'); root.querySelector('#akaNTitle')?.focus(); return; }
        const due = draftDue(D);
        if (!due) { toast('Muddatni tanlang', 'bad'); return; }
        if (due < new Date()) { toast('Muddat oʻtgan vaqt boʻlmasin', 'bad'); return; }
        const ownerId = D.owner === 'self' ? 'self' : D.owner === 'teacher' ? D.teacherId : D.owner === 'staff' ? (D.ownerStaff?.id || null) : null;
        btn.disabled = true;
        try {
            const r = await send('/api/academic/problems', 'POST', { studentId: D.studentId, type: D.type, source: D.source, title: D.title.trim(), details: D.details.trim(), ownerId, dueAt: due.toISOString() });
            invalidate('/api/academic/problems', API.ov, '/api/academic/head/students/' + D.studentId);
            S.draft = null;
            const id = r?.item?.id ?? r?.id;
            toast('Muammo kartasi ochildi', 'win');
            if (id != null) { S.stack.pop(); go('problem', { pid: id }); } else back();
        } catch (e) { btn.disabled = false; toast(e.message || 'Saqlab boʻlmadi', 'bad'); }
    }
    function sheetStudentPick() {
        const all = localStudents();
        const draw = q => { const s = q.trim().toLowerCase(); const list = all.filter(x => !s || x.name.toLowerCase().includes(s) || String(x.teacherName || '').toLowerCase().includes(s)).slice(0, 60);
            return list.length ? list.map(x => `<button type="button" class="aka-srow" data-sid="${esc(x.id)}">${ava(x.name, 36)}<span><strong>${esc(x.name)}</strong><small>${esc([x.teacherName ? 'Ustoz: ' + first(x.teacherName) : '', x.lessonNo ? x.lessonNo + '-dars' : '', x.schedule].filter(Boolean).join(' · '))}</small></span></button>`).join('')
                : `<p class="aka-muted">${all.length ? 'Topilmadi' : 'Oʻquvchilar roʻyxati hali yuklanmagan. Oʻquvchi kartasidan “Muammo yozish”ni bosing.'}</p>`; };
        openSheet('Oʻquvchini tanlash', myLangLabel(), `<label class="aka-search">${ic('search', 18)}<span class="aka-sr">Qidirish</span><input type="search" placeholder="Ism yoki ustoz" data-sq autocomplete="off"></label><div class="aka-slist" data-sl>${draw('')}</div>`, w => {
            const inp = w.querySelector('[data-sq]'), box = w.querySelector('[data-sl]');
            inp.addEventListener('input', () => { box.innerHTML = draw(inp.value); });
            box.addEventListener('click', e => {
                const b = e.target.closest('[data-sid]'); if (!b) return;
                const x = all.find(s => String(s.id) === b.dataset.sid); if (!x) return;
                Object.assign(S.draft, { studentId: x.id, studentName: x.name, teacherId: x.teacherId || null, teacherName: x.teacherName || '', studentMeta: [x.lessonNo ? x.lessonNo + '-dars' : '', x.schedule].filter(Boolean).join(' · ') });
                if (S.draft.owner === 'teacher' && !x.teacherId) S.draft.owner = 'self';
                closeSheet(); render(false);
            });
            setTimeout(() => inp.focus(), 80);
        });
    }
    function sheetStaffPick() {
        const all = staffList();
        openSheet('Masʼul xodim', 'Kimga topshiriladi', `<div class="aka-slist">${all.map(e => `<button type="button" class="aka-srow" data-eid="${esc(e.id)}">${ava(e.name, 36)}<span><strong>${esc(e.name)}</strong><small>${esc((window.HR_ROLE_MAP && HR_ROLE_MAP[e.role]) || e.role || '')}</small></span></button>`).join('')}</div>`, w => {
            w.querySelector('.aka-slist').addEventListener('click', e => {
                const b = e.target.closest('[data-eid]'); if (!b) return;
                const x = all.find(s => String(s.id) === b.dataset.eid);
                if (S.screen === 'pnew' && S.draft) { S.draft.owner = 'staff'; S.draft.ownerStaff = { id: x.id, name: x.name }; closeSheet(); render(false); }
                else if (sheetStaffPick.onPick) { const fn = sheetStaffPick.onPick; sheetStaffPick.onPick = null; closeSheet(); fn(x); }
            });
        });
    }

    // =====================================================================================
    // A04 · Muammo kartasi (A05 yopish, muddatni surish)
    // =====================================================================================
    const EV_IC = { created: ['plus', 'grey'], assigned: ['team', 'purple'], stage: ['clock', 'blue'], comment: ['note', 'blue'], call: ['phone', 'blue'], postponed: ['clock', 'amber'], reminded: ['alert', 'red'], closed: ['check', 'green'] };
    const EV_T = { created: 'Qayd etildi', assigned: 'Masʼul tayinlandi', stage: 'Bosqich oʻzgardi', comment: 'Izoh', call: 'Qoʻngʻiroq', postponed: 'Muddat surildi', reminded: 'Bot eslatdi', closed: 'Yopildi' };
    function scrProblem() {
        const url = API.problem(S.pid);
        const c = need(url);
        const p0 = c.d ? normP(c.d.item || c.d) : null;
        const head = top(`Muammo #${S.pid}`, { sub: p0 ? langLabel(p0.lang) || myLangLabel() : myLangLabel() });
        if (!c.d) return head + `<div class="aka-body">${c.e ? errBox(c.e, url) : skIn(1, 180) + skIn(1, 52) + skIn(1, 220)}</div>`;
        const p = p0, events = (c.d.events || []).slice().sort((a, b) => new Date(f(b, 'at', 'created_at')) - new Date(f(a, 'at', 'created_at')));
        const idx = STAGES.findIndex(s => s[0] === p.stage), closed = p.stage === 'closed';
        const steps = STAGES.map(([k, l], i) => {
            const done = i < idx || closed, cur = i === idx && !closed, nextBtn = !closed && i === idx + 1 && k !== 'closed';
            const dot = done ? `<span class="aka-st-d is-done">${ic('check', 14, 3)}</span>` : cur ? `<span class="aka-st-d is-cur"><i></i></span>` : `<span class="aka-st-d"></span>`;
            const line = i < 3 ? `<span class="aka-st-l${done ? ' is-done' : ''}" aria-hidden="true"></span>` : '';
            const inner = `${line}${dot}${esc(l)}`;
            return `<li class="${cur ? 'is-cur' : done ? 'is-done' : ''}"${cur ? ' aria-current="step"' : ''}>${nextBtn ? `<button type="button" class="aka-st-b" data-a-stage="${k}" aria-label="Bosqichni “${esc(l)}”ga oʻtkazish">${inner}</button>` : inner}</li>`;
        }).join('');
        const owner = p.ownerName ? (isMe(p.ownerName) ? 'Siz' : p.ownerName) : '';
        const dueTxt = p.dueAt ? (p.overdue ? `<span class="c-red">${esc(dtShort(p.dueAt))} · ${esc(overdueTxt(p.dueAt))}</span>` : esc(relDT(p.dueAt))) : '—';
        const ev = events.map((e, i) => {
            const kind = f(e, 'kind') || 'comment', [icn, tone] = EV_IC[kind] || EV_IC.comment, text = f(e, 'text'), actor = f(e, 'actorName', 'actor_name'), at = f(e, 'at', 'created_at');
            const title = kind === 'reminded' ? (text && /^bot/i.test(text) ? text.split(' · ')[0] : 'Bot eslatdi') : (text || EV_T[kind] || kind);
            const sub = [relDT(at), kind === 'reminded' ? (text && /^bot/i.test(text) ? text.split(' · ').slice(1).join(' · ') : text || '') : actor ? (isMe(actor) ? 'Siz' : actor) : ''].filter(Boolean).join(' · ');
            return `<li>${i < events.length - 1 ? '<span class="aka-tl-l" aria-hidden="true"></span>' : ''}<span class="aka-tl-i t-${tone}">${ic(icn, 16)}</span><span class="aka-tl-t"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span></li>`;
        }).join('');
        const resultRow = closed ? `${kv('Natija', (RESULTS.find(r => r[0] === p.result) || [, p.result || '—'])[1])}${p.resultNote ? kv('Izoh', p.resultNote) : ''}${p.followupAt ? kv('Qayta tekshirish', dLong(p.followupAt)) : ''}` : '';
        return head + `<div class="aka-body${closed ? '' : ' aka-body--bar'}">
            <section class="aka-card aka-pd aka-s1"><div class="aka-pd-h"><span class="aka-row6">${chip((TYPES.find(t => t[0] === p.type) || [, 'Boshqa'])[1])}${p.source ? chip(SRC_CHIP[p.source] || p.source) : ''}</span><h2>${esc(p.title)}</h2>${p.details ? `<p>${esc(p.details)}</p>` : ''}</div>
                <ol class="aka-steps" aria-label="Bosqichlar">${steps}</ol></section>
            <section class="aka-two aka-s2">${p.studentPhone ? `<a class="aka-btn aka-btn--dark aka-btn--13" href="${esc(telHref(p.studentPhone))}">${ic('phone', 18)}Oʻquvchiga qoʻngʻiroq</a>` : `<span class="aka-btn aka-btn--off aka-btn--13">${ic('phone', 18)}Raqam yoʻq</span>`}
                ${p.teacherPhone ? `<a class="aka-btn aka-btn--line2 aka-btn--13" href="${esc(telHref(p.teacherPhone))}">${ic('phone', 18)}Ustozga qoʻngʻiroq</a>` : `<span class="aka-btn aka-btn--off aka-btn--13">${ic('phone', 18)}Ustoz raqami yoʻq</span>`}</section>
            <section class="aka-card aka-dl aka-s2"><dl>
                <div><dt>Oʻquvchi</dt><dd>${p.studentId ? `<button type="button" class="aka-a" data-a-student="${esc(p.studentId)}">${esc(p.studentName)}</button>` : esc(p.studentName || '—')}</dd></div>
                <div><dt>Ustoz</dt><dd>${p.teacherId ? `<button type="button" class="aka-a" data-a-teacher="${esc(p.teacherId)}">${esc(first(p.teacherName))}</button>` : esc(first(p.teacherName) || '—')}</dd></div>
                <div><dt>Masʼul</dt><dd>${closed ? esc(owner || '—') : `<button type="button" class="aka-a${owner ? ' aka-a--ink' : ''}" data-a-owner>${esc(owner || 'Tayinlash')}</button>`}</dd></div>
                <div><dt>Muddat</dt><dd>${dueTxt}</dd></div>
                <div><dt>Ochildi</dt><dd>${esc(p.createdAt ? dtComma(p.createdAt) : '—')}</dd></div></dl>${resultRow ? `<div class="aka-kvs">${resultRow}</div>` : ''}</section>
            ${!closed && p.studentId ? `<button type="button" class="aka-btn aka-btn--line2 aka-btn--48 aka-s2" data-a-transfer="${esc(p.studentId)}">${ic('team', 18)}Boshqa ustozga oʻtkazish</button>` : ''}
            <section class="aka-sec aka-s3"><h2 class="aka-h2 aka-px">Tarix</h2><ol class="aka-tl">${ev || `<li><span class="aka-tl-i t-grey">${ic('plus', 16)}</span><span class="aka-tl-t"><strong>Qayd etildi</strong><small>${esc(p.createdAt ? dtComma(p.createdAt) : '')}${p.createdByName ? ' · ' + esc(isMe(p.createdByName) ? 'Siz' : p.createdByName) : ''}</small></span></li>`}</ol>
                ${closed ? '' : `<form class="aka-cmt" data-a-cmt><label class="aka-sr" for="akaCmt">Izoh</label><input id="akaCmt" type="text" maxlength="1000" placeholder="Izoh yoki qoʻngʻiroq natijasi…" autocomplete="off"><button type="submit" class="aka-cmt-b" aria-label="Yuborish">${ic('send', 18)}</button></form>`}</section></div>
            ${closed ? '' : bbar(`<div class="aka-bbar-col"><div class="aka-row8"><button type="button" class="aka-btn aka-btn--ghost" data-a-postpone>Muddatni surish…</button><button type="button" class="aka-btn aka-btn--green" data-a-close>${ic('check', 18, 2.6)}Muammoni yopish</button></div><small>Muddat surilsa sabab majburiy · tarixga yoziladi</small></div>`)}`;
    }
    const curProblem = () => { const d = peek(API.problem(S.pid)); return d ? normP(d.item || d) : null; };
    async function patchProblem(body, okMsg) {
        try { await send(API.problem(S.pid), 'PATCH', body); invalidate('/api/academic/problems', API.ov); need(API.problem(S.pid), true); toast(okMsg, 'ok'); return true; }
        catch (e) { toast(e.message || 'Saqlab boʻlmadi', 'bad'); return false; }
    }
    function sheetOwner() {
        const p = curProblem(); if (!p) return;
        const opts = [['self', 'Siz']]; if (p.teacherId) opts.push(['teacher', `${first(p.teacherName)} (ustoz)`]); if (staffList().length) opts.push(['staff', 'Boshqa xodim…']);
        openSheet('Masʼulni tayinlash', `#${p.id} · ${p.title}`, `${chips('own', opts, 'self')}<button type="button" class="aka-btn aka-btn--pri aka-btn--54" data-ok>Saqlash</button>`, w => {
            w.querySelector('[data-ok]').onclick = async ev => {
                const v = w.querySelector('input[name="own"]:checked')?.value;
                if (v === 'staff') { sheetStaffPick.onPick = x => patchProblem({ ownerId: x.id, stage: p.stage === 'logged' ? 'assigned' : undefined }, `Masʼul: ${x.name}`); sheetStaffPick(); return; }
                ev.target.disabled = true;
                const ok = await patchProblem({ ownerId: v === 'self' ? 'self' : p.teacherId, stage: p.stage === 'logged' ? 'assigned' : undefined }, 'Masʼul tayinlandi');
                if (ok) closeSheet(); else ev.target.disabled = false;
            };
        });
    }
    function sheetPostpone() {
        const p = curProblem(); if (!p) return;
        const dues = dueOptions();
        openSheet('Muddatni surish', `#${p.id} · hozir: ${p.dueAt ? dtShort(p.dueAt) : '—'}`, `${fs('Yangi muddat', true, chips('pdue', dues, 'tomorrow') + `<label class="aka-fld" data-cust hidden><span class="aka-sr">Sana va vaqt</span><input class="aka-inp" type="datetime-local" data-dt min="${localDate()}T00:00"></label>`)}
            <label class="aka-fld"><span class="aka-lbl">Sabab <i>*</i></span><input class="aka-inp" type="text" maxlength="300" data-why placeholder="Nega surilyapti?"></label>
            ${note('Sabab tarixga yoziladi. Yangi muddat oʻtsa bot yana eslatadi.', 'clock')}
            <button type="button" class="aka-btn aka-btn--pri aka-btn--54" data-ok>Muddatni surish</button>`, w => {
            w.addEventListener('change', () => { w.querySelector('[data-cust]').hidden = w.querySelector('input[name="pdue"]:checked')?.value !== 'custom'; });
            w.querySelector('[data-ok]').onclick = async ev => {
                const v = w.querySelector('input[name="pdue"]:checked')?.value, why = w.querySelector('[data-why]').value.trim();
                const due = v === 'custom' ? (w.querySelector('[data-dt]').value ? new Date(w.querySelector('[data-dt]').value) : null) : (dues.find(x => x[0] === v) || [])[2];
                if (!due || Number.isNaN(due.getTime()) || due < new Date()) { toast('Kelajakdagi muddatni tanlang', 'bad'); return; }
                if (why.length < 3) { toast('Sababni yozing (kamida 3 belgi)', 'bad'); w.querySelector('[data-why]').focus(); return; }
                ev.target.disabled = true;
                if (await patchProblem({ dueAt: due.toISOString(), reason: why }, `Muddat ${dtShort(due)} ga surildi`)) closeSheet(); else ev.target.disabled = false;
            };
        });
    }
    const rcards = (name, opts, sel) => `<div class="aka-rcs" role="radiogroup">${opts.map(([v, t, h, dis]) => `<label class="aka-rc${dis ? ' is-off' : ''}"><input type="radio" name="${esc(name)}" value="${esc(v)}"${v === sel ? ' checked' : ''}${dis ? ' disabled' : ''}><span><strong>${esc(t)}</strong>${h ? `<small>${esc(h)}</small>` : ''}</span></label>`).join('')}</div>`;
    function sheetClose() {
        const p = curProblem(); if (!p) return;
        const fu = addDays(new Date(), 7);
        openSheet('Muammoni yopish', `#${p.id} · ${shortName(p.studentName)}${p.teacherName ? ' · ustoz ' + first(p.teacherName) : ''}`, `${fs('Natija', true, rcards('res', RESULTS, 'solved'))}
            <label class="aka-fld"><span class="aka-lbl">Nima qilindi <i>*</i></span><textarea class="aka-ta" rows="3" maxlength="2000" data-note placeholder="Qisqacha: kim bilan gaplashildi, nima kelishildi"></textarea></label>
            <label class="aka-sw"><span><strong>7 kundan keyin tekshirish</strong><small>${esc(dLong(fu))} bot sizga eslatadi: oʻquvchiga qoʻngʻiroq</small></span><input type="checkbox" role="switch" checked data-fu></label>
            <button type="button" class="aka-btn aka-btn--green aka-btn--54" data-ok>${ic('check', 18, 2.6)}Muammoni yopish</button>`, w => {
            w.querySelector('[data-ok]').onclick = async ev => {
                const result = w.querySelector('input[name="res"]:checked')?.value, n = w.querySelector('[data-note]').value.trim();
                if (!n) { toast('Nima qilinganini yozing', 'bad'); w.querySelector('[data-note]').focus(); return; }
                ev.target.disabled = true;
                try {
                    await send(API.problem(S.pid) + '/close', 'POST', { result, note: n, followup: w.querySelector('[data-fu]').checked });
                    invalidate('/api/academic/problems', API.ov, '/api/academic/head/');
                    need(API.problem(S.pid), true);
                    closeSheet();
                    if (result === 'teacher_changed' && p.studentId) { toast('Muammo yopildi · endi yangi ustozni tanlang', 'win'); sheetTransfer(p.studentId); }
                    else toast(result === 'solved' ? 'Muammo hal qilindi — barakalla!' : 'Muammo yopildi', 'win', result === 'solved');
                } catch (e) { ev.target.disabled = false; toast(e.message || 'Yopib boʻlmadi', 'bad'); }
            };
        });
    }

    // =====================================================================================
    // A06 · Qoplash tekshiruvi (A07 natija)
    // =====================================================================================
    function scrMakeups() {
        const url = API.makeups(S.mtab);
        const counts = (need(url).d || peek(API.makeups('pending')) || {}).counts || {};
        const cnt = k => (counts[k] != null ? ' · ' + counts[k] : '');
        const body = withData(url, d => {
            const items = d.items || [];
            if (!items.length) return emptyBox(S.mtab === 'pending' ? 'check' : 'archive', S.mtab === 'pending' ? 'Tekshiriladigan qoplash yoʻq' : 'Roʻyxat boʻsh', S.mtab === 'pending' ? 'Ustoz yangi qoplash kiritsa shu yerda chiqadi' : '');
            const shown = S.mAll ? items : items.slice(0, 5);
            const row = m => {
                const dl = S.mtab === 'pending' && m.deadline ? dayDiff(m.deadline) : null;
                const dchip = S.mtab === 'pending' ? (m.canReject === false ? chip('Rad etish muddati oʻtdi', 'grey') : dl != null && dl <= 6 ? chip(`${dShort(m.deadline)} gacha`, 'red') : '') : S.mtab === 'held' ? chip('Oʻtildi', 'green') : chip('Rad etildi', 'red');
                const main = `${ava(m.studentName, 40)}<span class="aka-mu-t"><span class="aka-row6"><strong>${esc(shortName(m.studentName))}</strong>${dchip}</span><small class="aka-ink2">${esc([m.heldAt ? dtComma(m.heldAt) : '', m.lessonNo ? m.lessonNo + '-dars' : ''].filter(Boolean).join(' · '))}</small><small>${esc(['ustoz ' + first(m.teacherName), m.enteredAt ? 'kiritildi ' + dShort(m.enteredAt) : ''].filter(Boolean).join(' · '))}</small></span>`;
                return `<li class="aka-mu">${S.mtab === 'pending' ? `<button type="button" class="aka-mu-m" data-a-makeup="${esc(m.id)}" aria-label="${esc(shortName(m.studentName))}: natijani kiritish">${main}</button>` : `<span class="aka-mu-m">${main}</span>`}
                    ${m.studentPhone ? `<a class="aka-call" href="${esc(telHref(m.studentPhone))}" aria-label="${esc(shortName(m.studentName))}ga qoʻngʻiroq">${ic('phone', 20)}</a>` : `<span class="aka-call is-off" role="link" aria-disabled="true" title="Telefon kiritilmagan" aria-label="${esc(shortName(m.studentName))}: telefon kiritilmagan">${ic('phone', 20)}</span>`}</li>`;
            };
            return `<section class="aka-card aka-list aka-s2"><ul>${shown.map(row).join('')}</ul></section>${!S.mAll && items.length > 5 ? moreRow(`Yana ${items.length - 5} ta`, 'data-a-mall') : ''}`;
        }, skIn(4, 72));
        return top('Qoplash tekshiruvi', { sub: myLangLabel() }) + `<div class="aka-body">
            <p class="aka-info aka-s1">Qoplash ustoz kiritgan zahoti maoshga kiradi. Oʻquvchiga qoʻngʻiroq qilib tekshiring: dars boʻlmagan boʻlsa, keyingi oyning 4-sanasigacha rad etish mumkin.</p>
            ${tabs('mtab', [['pending', 'Kutmoqda' + cnt('pending')], ['held', 'Tekshirildi'], ['not_held', 'Dars boʻlmagan']], S.mtab, 'Holat')}${body}</div>`;
    }
    function sheetMakeup(id, pre = '') {
        const m = (peek(API.makeups(S.mtab))?.items || []).find(x => String(x.id) === String(id)); if (!m) return;
        const opts = [['held', 'Dars oʻtildi', 'Tekshirildi, maoshda qoladi'], ['not_held', 'Dars boʻlmagan', m.canReject === false ? 'Rad etish muddati oʻtgan (keyingi oyning 4-sanasi)' : 'Qoplash rad etiladi va maoshdan chiqadi · ustozga xabar boradi', m.canReject === false], ['no_answer', 'Javob bermadi', 'Navbatda qoladi, keyinroq qayta qoʻngʻiroq']];
        openSheet('Qoʻngʻiroq natijasi', [shortName(m.studentName), 'ustoz ' + first(m.teacherName), m.heldAt ? dtComma(m.heldAt) : '', m.lessonNo ? m.lessonNo + '-dars' : ''].filter(Boolean).join(' · '), `${fs('Oʻquvchi nima dedi?', true, rcards('mr', opts, pre))}
            <label class="aka-fld"><span class="aka-lbl">Izoh</span><small class="aka-hint aka-hint--up">«Dars boʻlmagan» tanlanganda majburiy</small><textarea class="aka-ta" rows="2" maxlength="1000" data-note placeholder="Oʻquvchi nima dedi"></textarea></label>
            <label class="aka-sw"><span><strong>Muammo kartasini ochish</strong><small>Ustoz ${esc(first(m.teacherName))} boʻyicha, izoh bilan</small></span><input type="checkbox" role="switch" data-op${pre === 'not_held' ? ' checked' : ''}></label>
            <button type="button" class="aka-btn aka-btn--pri aka-btn--54" data-ok>Saqlash</button>`, w => {
            w.addEventListener('change', e => { if (e.target.name === 'mr') w.querySelector('[data-op]').checked = e.target.value === 'not_held'; });
            w.querySelector('[data-ok]').onclick = async ev => {
                const result = w.querySelector('input[name="mr"]:checked')?.value, n = w.querySelector('[data-note]').value.trim();
                if (!result) { toast('Natijani tanlang', 'bad'); return; }
                if (result === 'not_held' && !n) { toast('Izoh yozing — ustoz koʻradi', 'bad'); w.querySelector('[data-note]').focus(); return; }
                ev.target.disabled = true;
                try {
                    await send(`/api/academic/head/makeups/${encodeURIComponent(m.id)}/check`, 'POST', { result, note: n, openProblem: w.querySelector('[data-op]').checked });
                    invalidate('/api/academic/head/makeups', API.ov, '/api/academic/problems');
                    closeSheet(); need(API.makeups(S.mtab), true);
                    toast(result === 'held' ? 'Tekshirildi · maoshda qoladi' : result === 'not_held' ? 'Qoplash rad etildi · ustozga xabar ketdi' : 'Navbatda qoldi — keyinroq qayta qoʻngʻiroq qiling', result === 'no_answer' ? 'ok' : 'win');
                } catch (e) { ev.target.disabled = false; toast(e.message || 'Saqlab boʻlmadi', 'bad'); }
            };
        });
    }

    // =====================================================================================
    // A08 · Xavfdagi oʻquvchilar
    // =====================================================================================
    function riskTone(r) {
        const n = num((String(r.reasonText || '').match(/\d+/) || [0])[0]);
        return (r.reason === 'noapp' && n >= 5) || (r.reason === 'absent' && n >= 3) || (r.reason === 'behind' && n >= 8) ? 'red' : 'amber';
    }
    // Oʻquvchilar — toʻliq roʻyxat (ustoz ilovasi "Oʻquvchilarim" namunasi): qidiruv, xavf sabablari, ustoz filtri, avatar.
    const studentsUrl = () => `/api/academic/students?lang=${ownLang() || myLangs()[0] || 'english'}`;
    function scrStudents() {
        const url = studentsUrl(), risk = need(API.risk('all')).d || {}, riskBy = new Map((risk.items || []).map(r => [String(r.id), r])), counts = risk.counts || {};
        const local = new Map((typeof getItem === 'function' ? getItem(STORAGE_KEYS.students, []) : []).map(s => [String(s.id), s]));
        const hr = new Map((typeof getItem === 'function' ? getItem(STORAGE_KEYS.hrEmployees, []) : []).map(e => [String(e.id), e]));
        let total = 0;
        const body = withData(url, d => {
            const all = (d.students || []).map(s => { const l = local.get(String(s.id)) || {}, r = riskBy.get(String(s.id)); return { ...s, avatarUrl: l.avatarUrl, teacher: first(hr.get(String(s.teacherId || l.teacherId))?.name || r?.teacherName || ''), phone: l.phone || '', risk: r }; }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
            total = all.length;
            const items = all.filter(s => (S.stab === 'all' || s.risk?.reason === S.stab) && (!S.sTeacher || s.teacher === S.sTeacher));
            const teachers = [...new Set(all.map(s => s.teacher).filter(Boolean))].sort();
            const tag = s => { if (s.frozen) return chip('Muzlatilgan', 'grey'); if (s.risk) return chip(s.risk.reasonText || 'Xavf', riskTone(s.risk)); const b = num(s.expected) - num(s.reached); return b > 3 ? chip('Orqada', 'amber') : b < 0 ? chip('Oldinda', 'blue') : chip('Rejada', 'green'); };
            const row = s => `<button type="button" class="aka-rrow" data-a-student="${esc(s.id)}" data-q="${esc(`${s.name} ${s.phone} ${s.id} ${s.teacher}`.toLowerCase())}">${window.schoolUI?.studentAvatar ? window.schoolUI.studentAvatar(s, 44) : ava(s.name, 44)}<span class="aka-arow-t"><span><strong>${esc(s.name)}</strong></span><span class="aka-stag">${tag(s)}</span><small>${esc([s.teacher && 'ustoz ' + s.teacher, `${num(s.reached)} / 72`].filter(Boolean).join(' · '))}</small></span></button>`;
            return `<label class="aka-fld aka-s1"><span class="aka-sr">Ustoz</span><select class="aka-inp" data-a-steach><option value="">Ustoz: hammasi</option>${teachers.map(t => `<option value="${esc(t)}"${t === S.sTeacher ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
                ${items.length ? `<section class="aka-card aka-list aka-s2" data-a-slist>${items.map(row).join('')}</section>` : emptyBox('check', 'Oʻquvchi topilmadi', 'Filtrni oʻzgartiring')}`;
        }, skIn(6, 64));
        const cnt = k => (counts[k] != null ? ' · ' + counts[k] : '');
        return top('Oʻquvchilar', { back: false, sub: [myLangLabel(), total ? total + ' ta' : ''].filter(Boolean).join(' · ') }) + `<div class="aka-body">
            <label class="aka-search aka-s1">${ic('search', 18)}<span class="aka-sr">Qidirish</span><input type="search" data-a-sq placeholder="Ism, telefon yoki ustoz" autocomplete="off"></label>
            <div class="aka-tabs aka-scroll aka-s1" role="tablist" aria-label="Filtr">${RISK.map(([k, t]) => `<button type="button" role="tab" class="aka-tab" aria-selected="${k === S.stab}" data-a-stab="${k}">${esc(k === 'all' ? t : t + cnt(k))}</button>`).join('')}</div>
            ${body}</div>`;
    }

    function scrRisk() {
        const url = API.risk(S.rtab);
        const counts = (need(url).d || peek(API.risk('all')) || {}).counts || {};
        const body = withData(url, d => {
            let items = d.items || [];
            if (S.rTeacher) items = items.filter(r => first(r.teacherName) === first(S.rTeacher));
            if (!items.length) return emptyBox('check', 'Xavfdagi oʻquvchi yoʻq', S.rTeacher ? `Ustoz ${first(S.rTeacher)} oʻquvchilarida xavf yoʻq` : 'Hamma oʻquvchi reja boʻyicha');
            const shown = S.rAll ? items : items.slice(0, 5);
            const row = r => { const tone = riskTone(r), total = num(r.totalLessons) || 72;
                return `<button type="button" class="aka-rrow" data-a-student="${esc(r.id)}">${ava(r.name, 40, tone)}<span class="aka-arow-t"><span><strong>${esc(shortName(r.name))}</strong>${chip(r.reasonText || '', tone)}</span>${bar(num(r.lessonNo) / total * 100, r.reason === 'behind' ? 'red' : tone)}<small>${esc(`${num(r.lessonNo)}/${total}-dars · ustoz ${first(r.teacherName)}`)}</small></span></button>`; };
            return `<section class="aka-card aka-list aka-s2">${shown.map(row).join('')}</section>${!S.rAll && items.length > 5 ? moreRow(`Yana ${items.length - 5} ta`, 'data-a-rall') : ''}`;
        }, skIn(4, 72));
        const cnt = k => (counts[k] != null ? ' · ' + counts[k] : '');
        return top('Xavfdagi oʻquvchilar', { sub: [myLangLabel(), S.rTeacher ? 'ustoz ' + first(S.rTeacher) : 'ketish ehtimoli bor'].filter(Boolean).join(' · ') }) + `<div class="aka-body">
            <span id="akaRkL" class="aka-cap aka-s1">ASOSIY SABAB</span>
            <div class="aka-tabs aka-wrap aka-s1" role="tablist" aria-labelledby="akaRkL">${RISK.map(([k, t]) => `<button type="button" role="tab" class="aka-tab" aria-selected="${k === S.rtab}" data-a-rtab="${k}">${esc(t + cnt(k))}</button>`).join('')}</div>
            ${body}<p class="aka-foot">Roʻyxat avtomatik: 3+ kun appga kirmasa, 2+ dars qoldirsa yoki rejadan 6+ dars orqada qolsa. Har birida bitta asosiy sabab koʻrsatiladi.</p></div>`;
    }

    // =====================================================================================
    // A09 · Oʻquvchi kartasi (A10 almashtirish)
    // =====================================================================================
    const minTxt = m => { m = Math.round(num(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} s${r ? ' ' + r + ' daq' : ''}` : `${r} daq`; };
    function scrStudent() {
        const url = API.student(S.sid), c = need(url);
        if (!c.d) return top('Oʻquvchi', { sub: myLangLabel() }) + `<div class="aka-body">${c.e ? errBox(c.e, url) : skIn(1, 150) + skIn(2, 120)}</div>`;
        const s = c.d, a = s.activity || {}, total = num(s.totalLessons) || 72, lesson = num(s.lessonNo), plan = num(s.planLessonNo);
        const behind = Math.max(0, plan - lesson);
        const tone = behind >= 6 ? 'red' : behind > 3 ? 'amber' : 'blue';
        const lessons = s.lessons || [], came = lessons.filter(l => l.status === 'came').length, held = lessons.filter(l => l.status !== 'next').length;
        const pr = s.problems || {}, th = s.teacherHistory || [];
        const tile = (l, v, t = '') => `<div class="aka-tile aka-tile--sm"><span>${esc(l)}</span><strong class="${t ? 'c-' + t : ''}">${esc(v)}</strong></div>`;
        const head = top(s.name || 'Oʻquvchi', { sub: `Oʻquvchi${myLangLabel() ? ' · ' + myLangLabel() : ''}`, right: s.phone ? `<a class="aka-ib aka-ib--dark" href="${esc(telHref(s.phone))}" aria-label="Qoʻngʻiroq">${ic('phone', 18)}</a>` : '' });
        // Ustoz ilovasidagi o'quvchi kartasi boshi: avatar, ID va jadval, tezkor tugmalar.
        const loc = (typeof getItem === 'function' ? getItem(STORAGE_KEYS.students, []) : []).find(x => String(x.id) === String(s.id)) || {};
        const av = window.schoolUI?.studentAvatar ? window.schoolUI.studentAvatar({ ...loc, id: s.id, name: s.name }, 64) : ava(s.name, 64);
        const tg = loc.telegramGroupLink || '';
        const qa = (icon, label, attr) => `<${attr.startsWith('href') ? 'a' : 'button type="button"'} class="aka-qa" ${attr}>${ic(icon, 20)}<span>${esc(label)}</span></${attr.startsWith('href') ? 'a' : 'button'}>`;
        const hero = `<section class="aka-shero aka-s1">${av}<span><strong>${esc(s.name || '')}</strong><small>${esc(s.schedule || '')}</small></span></section>
            <div class="aka-qas aka-s1">${s.phone ? qa('phone', 'Qoʻngʻiroq', `href="${esc(telHref(s.phone))}"`) : ''}${tg ? qa('send', 'Dars guruhi', `href="${esc(tg)}" target="_blank" rel="noopener"`) : ''}${qa('check', 'Davomat', 'data-a-crm="teachers-section:attendance"')}</div>`;
        return head + `<div class="aka-body aka-body--bar">
            ${hero}
            <section class="aka-card aka-s1"><div class="aka-sb"><span class="aka-sm">Ustoz ${s.teacher?.id ? `<button type="button" class="aka-a aka-a--b" data-a-teacher="${esc(s.teacher.id)}">${esc(first(s.teacher.name))}</button>` : `<b>${esc(first(s.teacher?.name) || '—')}</b>`}${s.schedule ? ' · ' + esc(s.schedule) : ''}</span>${s.risk?.reasonText ? chip(s.risk.reasonText, 'red') : ''}</div>
                <div class="aka-prog"><div class="aka-sb aka-sb--base"><strong class="aka-big">${lesson} <small>/ ${total}-dars</small></strong><span class="${behind ? 'c-' + (tone === 'blue' ? 'amber' : tone) : 'c-green'} aka-b13">${behind ? `Rejadan ${behind} dars orqada` : 'Reja boʻyicha'}</span></div>
                    <div class="aka-pbar" aria-hidden="true"><i style="width:${pct(lesson / total * 100)}%;background:${TONE_BAR[tone]}"></i>${plan ? `<b style="left:${pct(plan / total * 100)}%"></b>` : ''}</div>
                    ${plan ? `<small class="aka-hint">Chiziq — reja boʻyicha bugun ${plan}-darsda boʻlishi kerak edi</small>` : ''}</div></section>
            <section class="aka-sec aka-s2"><h2 class="aka-h2 aka-px">Appdagi faollik · 30 kun</h2><div class="aka-grid2">
                ${tile('Vazifa bajarish', a.completionPct != null ? pct(a.completionPct) + '%' : '—', a.completionPct != null ? pctTone(a.completionPct, 75, 50) || '' : '')}${tile('Haftasiga vaqt', a.weeklyMinutes != null ? minTxt(a.weeklyMinutes) : '—')}${tile('Koʻp xato', a.topMistake || '—')}${tile('Darsga kelish', a.attendancePct != null ? pct(a.attendancePct) + '%' : '—', a.attendancePct != null ? pctTone(a.attendancePct, 85, 60) : '')}</div></section>
            <section class="aka-card aka-s2"><div class="aka-sb"><h2 class="aka-h2">Darslar · oxirgi 4 hafta</h2><span class="aka-b13 aka-ink2">${came} / ${held} keldi</span></div>
                ${lessons.length ? `<ol class="aka-days" aria-label="Dars kunlari">${lessons.map(l => { const d = toDate(l.date); return `<li class="is-${esc(l.status)}" aria-label="${esc(dShort(l.date))}: ${l.status === 'came' ? 'keldi' : l.status === 'missed' ? 'kelmadi' : l.status === 'unmarked' ? 'belgilanmagan' : 'keyingi'}">${d ? d.getDate() : ''}</li>`; }).join('')}</ol>` : '<p class="aka-muted">Oxirgi 4 haftada dars yoʻq</p>'}
                <small class="aka-hint">Qoplash darslari ham shu yerda oddiy dars kabi koʻrinadi</small></section>
            <section class="aka-card aka-list aka-s3">${navRow('Muammolar', num(pr.open) || num(pr.closed) ? [num(pr.open) ? `${num(pr.open)} ta ochiq` : 'ochigʻi yoʻq', num(pr.closed) ? `${num(pr.closed)} ta yopilgan` : ''].filter(Boolean).reverse().join(' · ') : 'Hali yozilmagan', `data-a-sprob="${esc(s.name || '')}" data-a-sprobopen="${num(pr.open) ? 1 : 0}"`)}
                ${navRow('Ustozlar tarixi', th.length ? th.map(t => `${first(t.name)} · ${dLong(t.from)}dan`).slice(-1)[0] + (th.length > 1 ? ` · jami ${th.length}` : '') : '—', 'data-a-thist')}</section></div>
            ${bbar(`<button type="button" class="aka-btn aka-btn--out" data-a-transfer="${esc(s.id)}">${ic('team', 18)}Ustozni almashtirish</button><button type="button" class="aka-btn aka-btn--pri aka-btn--14" data-a-newfor="student">${ic('plus', 18, 2.6)}Muammo yozish</button>`)}`;
    }
    function sheetTeacherHistory() {
        const s = peek(API.student(S.sid)); if (!s) return;
        const th = (s.teacherHistory || []).slice().reverse();
        openSheet('Ustozlar tarixi', s.name, `<div class="aka-card aka-list">${th.length ? th.map((t, i) => `<div class="aka-srow aka-srow--static">${ava(t.name, 36)}<span><strong>${esc(t.name)}</strong><small>${esc(dLong(t.from))}dan${i === 0 ? ' · hozirgi' : ''}</small></span></div>`).join('') : '<p class="aka-muted">Tarix yoʻq</p>'}</div>
            ${note('Oʻtilgan darslar, oylik va tekshiruvdagi qoplashlar eski ustozda qoladi.', 'bot')}`);
    }
    async function sheetTransfer(studentId) {
        const s = peek(API.student(studentId));
        openSheet('Ustozni almashtirish', s ? `${shortName(s.name)} · hozir ustoz ${first(s.teacher?.name)}${s.schedule ? ' · ' + s.schedule : ''}` : 'Yuklanmoqda…', `<div data-tb>${skIn(3, 60)}</div>`);
        const wrap = sheetEl;
        let opt, st = s;
        try { [opt, st] = await Promise.all([apiFetch(API.transfer(studentId), { fresh: true }), s ? Promise.resolve(s) : apiFetch(API.student(studentId))]); }
        catch (e) { if (sheetEl === wrap) wrap.querySelector('[data-tb]').innerHTML = errBox(e, API.transfer(studentId)); return; }
        if (sheetEl !== wrap) return;
        const slot = opt.slot || st?.schedule || '';
        const curId = String(st?.teacher?.id || '');
        const ts = (opt.teachers || []).filter(t => String(t.id) !== curId).sort((a, b) => (b.free - a.free) || (num(b.onPlanPct) - num(a.onPlanPct)));
        const firstFree = ts.find(t => t.free);
        const nextL = (st?.lessons || []).find(l => l.status === 'next');
        const today0 = new Date(new Date().toDateString());
        let nextD = nextL ? toDate(nextL.date) : null;
        if (!nextD || nextD < today0) nextD = addDays(today0, 1);
        wrap.querySelector('.aka-sheet-h span').textContent = `${shortName(st?.name)} · hozir ustoz ${first(st?.teacher?.name)}${slot ? ' · ' + slot : ''}`;
        const rows = ts.map(t => t.free
            ? `<label class="aka-rc aka-rc--t"><input type="radio" name="tt" value="${esc(t.id)}"${firstFree && t.id === firstFree.id ? ' checked' : ''}>${ava(first(t.name), 36, 'blue')}<span><strong>${esc(first(t.name))}</strong><small>${esc([`${num(t.students)} oʻquvchi`, `${pct(t.onPlanPct)}% rejada`, num(t.openProblems) ? `${num(t.openProblems)} ochiq muammo` : ''].filter(Boolean).join(' · '))}</small></span>${chip('Boʻsh', 'green')}</label>`
            : `<label class="aka-rc aka-rc--t is-off"><input type="radio" name="tt" value="${esc(t.id)}" disabled>${ava(first(t.name), 36, 'grey')}<span><strong>${esc(first(t.name))}</strong><small>Bu vaqtda darsi bor</small></span>${chip('Band')}</label>`).join('');
        wrap.querySelector('[data-tb]').outerHTML = `${fs(`Yangi ustoz${slot ? ' · ' + slot + ' da' : ''}`, true, ts.length ? `<div class="aka-rcs">${rows}</div>` : '<p class="aka-muted">Bu tilda boshqa ustoz yoʻq</p>')}
            ${fs('Qachondan', true, chips('from', [['next', `Keyingi darsdan · ${dShort(nextD)}`], ['custom', 'Sana tanlash']], 'next') + `<label class="aka-fld" data-cust hidden><span class="aka-sr">Sana</span><input class="aka-inp" type="date" data-d min="${backMinA()}" value="${localDate(nextD)}"></label>`)}
            <label class="aka-fld"><span class="aka-lbl">Sabab <i>*</i></span><input class="aka-inp" type="text" maxlength="300" data-why placeholder="Masalan: oʻquvchi iltimosi"></label>
            ${note(`Bot ikkala ustozga xabar beradi. Tanlangan sanagacha oʻtilgan darslar eski ustozda qoladi; oʻtgan sana tanlansa — oʻsha kundan beri darslar va davomat yangi ustozga oʻtadi. Tekshiruvdagi qoplashlar ham ${first(st?.teacher?.name) || 'eski ustoz'}da qoladi.`)}
            <button type="button" class="aka-btn aka-btn--pri aka-btn--54" data-ok${firstFree ? '' : ' disabled'}>${firstFree ? esc(first(firstFree.name)) + 'ga oʻtkazish' : 'Boʻsh ustoz yoʻq'}</button>`;
        const okB = wrap.querySelector('[data-ok]');
        wrap.addEventListener('change', e => {
            if (e.target.name === 'from') wrap.querySelector('[data-cust]').hidden = e.target.value !== 'custom';
            if (e.target.name === 'tt') { const t = ts.find(x => String(x.id) === e.target.value); okB.textContent = `${first(t?.name)}ga oʻtkazish`; okB.disabled = false; }
        });
        okB.onclick = async () => {
            const tid = wrap.querySelector('input[name="tt"]:checked')?.value, why = wrap.querySelector('[data-why]').value.trim();
            const from = wrap.querySelector('input[name="from"]:checked')?.value === 'custom' ? wrap.querySelector('[data-d]').value : localDate(nextD);
            if (!tid) { toast('Yangi ustozni tanlang', 'bad'); return; }
            if (!from || from < backMinA()) { toast(`Sana ${backMinA()} dan oldin boʻlmasin`, 'bad'); return; }
            if (why.length < 3) { toast('Sababni yozing (kamida 3 belgi)', 'bad'); wrap.querySelector('[data-why]').focus(); return; }
            okB.disabled = true;
            try {
                await send(`/api/school/students/${encodeURIComponent(studentId)}/teacher`, 'POST', { teacherId: tid, effectiveFrom: from, from, reason: why });
                invalidate('/api/academic/head/', '/api/academic/problems');
                closeSheet();
                const t = ts.find(x => String(x.id) === String(tid));
                toast(`${shortName(st?.name)} → ${first(t?.name)} · ${dShort(from)} dan · ikkala ustozga xabar ketdi`, 'win');
                render(false);
            } catch (e) { okB.disabled = false; toast(e.message || 'Oʻtkazib boʻlmadi', 'bad'); }
        };
    }

    // =====================================================================================
    // A11 / A15 · Ustozlar va Yordamchilar
    // =====================================================================================
    function scrTeachers() {
        const T = need(API.teachers), A = need(API.assistants);
        const tItems = T.d?.items || [], aItems = A.d?.items || [];
        const studentsSum = tItems.reduce((a, t) => a + num(t.students), 0);
        const tabsHtml = tabs('ttab', [['teachers', `Ustozlar${T.d ? ` · ${tItems.length} · ${studentsSum} oʻquvchi` : ''}`], ['assistants', `Yordamchilar${A.d ? ' · ' + aItems.length : ''}`]], S.ttab, 'Turi');
        const sub = [myLangLabel(), MON[new Date().getMonth()]].filter(Boolean).join(' · ');
        let body;
        if (S.ttab === 'teachers') {
            body = withData(API.teachers, d => {
                const sm = d.summary || {}, items = d.items || [];
                return `<section class="aka-dark3 aka-s1"><div><small>Darsni vaqtida</small><strong>${pct(sm.onTimePct)}%</strong></div><div><small>Rejadagi tanaffus</small><strong>${num(sm.breaksPlanned)} ustoz</strong></div><div><small>Sinov rad · 30 kun</small><strong class="${num(sm.trialRejects30) ? 'c-yel' : ''}">${num(sm.trialRejects30)} ta</strong></div></section>
                    <section class="aka-sec aka-s2"><div class="aka-sh"><h2>Reyting</h2><button type="button" class="aka-link" data-a-howscore>Ball qanday hisoblanadi?</button></div>
                    <div class="aka-card aka-list">${items.length ? items.map((t, i) => `<button type="button" class="aka-trow" data-a-teacher="${esc(t.id)}" aria-label="${num(t.rank) || i + 1}-oʻrin, ${esc(first(t.name))}, ${num(t.score)} ball"><span class="aka-rank">${num(t.rank) || i + 1}</span>${ava(first(t.name), 40)}<span class="aka-trow-t"><span class="aka-row6"><strong>${esc(first(t.name))}</strong>${t.flag?.text ? chip(t.flag.text, t.flag.tone || 'amber') : ''}</span><small>${num(t.students)} oʻquvchi · ${pct(t.onPlanPct)}% rejada · vaqtida ${pct(t.onTimePct)}%</small></span><span class="aka-score t-${scoreTone(t.score)}" aria-hidden="true">${num(t.score)}</span></button>`).join('') : emptyBox('team', 'Ustoz topilmadi', 'Bu tilda faol ustoz yoʻq')}</div></section>`;
            }, `<div class="aka-sk" style="height:76px"></div>${skIn(5, 62)}`);
        } else {
            body = withData(API.assistants, d => {
                const sm = d.summary || {}, items = d.items || [];
                return `<section class="aka-dark3 aka-s1"><div><small>7 kunda aloqa</small><strong>${num(sm.contacted7)} / ${num(sm.total)}</strong></div><div><small>5+ kun aloqasiz</small><strong class="${num(sm.silent5) ? 'c-yel' : ''}">${num(sm.silent5)}</strong></div>${dvAcademic() ? `<button type="button" data-dv-go="approvals"><small>Davomat</small><strong>Soʻrovlar${num(dvInfo().pending) ? ' · ' + num(dvInfo().pending) : ''} ›</strong></button>` : `<div><small>Yordamchilar</small><strong>${items.length}</strong></div>`}</section>
                    <section class="aka-card aka-list aka-s2">${items.length ? items.map(a => { const r = num(a.students) ? num(a.contacted7) / num(a.students) * 100 : 0;
                        const desc = [`${num(a.students)} oʻquvchi`, `7 kunda ${num(a.contacted7)} tasi bilan aloqa`, `${num(a.silent5)} tasi 5+ kun aloqasiz`, a.note || ''].filter(Boolean).join(' · ');
                        return `<button type="button" class="aka-arow aka-arow--12" data-a-assistant="${esc(a.id)}" aria-label="${esc(first(a.name))}: ${esc(desc)}${a.attendance?.text ? ', ' + esc(a.attendance.text) : ''}">${ava(first(a.name), 42)}<span class="aka-arow-t"><span><strong>${esc(first(a.name))}</strong>${a.attendance?.text ? chip(a.attendance.text, a.attendance.tone || 'grey') : ''}</span>${bar(r, r >= 75 ? 'blue' : 'amber')}<small>${esc(desc)}</small></span></button>`; }).join('') : emptyBox('team', 'Yordamchi ustoz yoʻq')}</section>
                    <p class="aka-foot">Aloqa sanaladi: qoʻngʻiroq kamida 5 daqiqa (kuniga 1 ta), yozishma haftasiga 1 ta. Maqsad — har oʻquvchi bilan haftasiga 3 aloqa; chiziq kamida 1 aloqa boʻlganlarni koʻrsatadi.</p>`;
            }, `<div class="aka-sk" style="height:76px"></div>${skIn(3, 80)}`);
        }
        return top('Ustozlar', { sub }) + `<div class="aka-body">${tabsHtml}${body}</div>`;
    }

    // =====================================================================================
    // A12 · Ustoz kartasi
    // =====================================================================================
    function scrTeacher() {
        const url = API.teacher(S.tid), c = need(url);
        if (!c.d) return top('Ustoz', { sub: myLangLabel() }) + `<div class="aka-body">${c.e ? errBox(c.e, url) : skIn(1, 72) + skIn(1, 200) + skIn(2, 140)}</div>`;
        const t = c.d, tr = t.trials30 || {}, mk = t.makeups30 || {}, sal = t.salary || {}, pr = t.problems || {};
        const now = new Date(), prevMon = MON[(now.getMonth() + 11) % 12];
        // Ish haqi oyi — server salary.month ('YYYY-MM'); toʻlov 5-, rad etish oynasi 4-sanagacha — undan keyingi oyda.
        const salM = /^\d{4}-(\d{2})/.exec(String(sal.month || '')), salIdx = salM ? Number(salM[1]) - 1 : (now.getMonth() + 11) % 12, salMon = MON[salIdx], afterMon = MON[(salIdx + 1) % 12];
        const onPlanPct = num(t.studentsCount) ? num(t.onPlanCount) / num(t.studentsCount) * 100 : 0;
        const tile = (l, v, s, tone) => `<div class="aka-tile"><span>${esc(l)}</span><strong class="${tone ? 'c-' + tone : ''}">${esc(v)}</strong><small>${esc(s)}</small></div>`;
        const head = top(first(t.name) || 'Ustoz', { sub: ['Ustoz', myLangLabel(), t.rank ? t.rank + '-oʻrin' : ''].filter(Boolean).join(' · '), right: t.phone ? `<a class="aka-ib aka-ib--dark" href="${esc(telHref(t.phone))}" aria-label="${esc(first(t.name))}ga qoʻngʻiroq">${ic('phone', 18)}</a>` : '' });
        const tg = tgHref(t.phone);
        return head + `<div class="aka-body aka-body--bar">
            ${t.lock ? `<section class="aka-lock aka-s1"><span class="aka-qi t-red">${ic('lock', 18)}</span><span><strong>Appi qulfda</strong><small>${esc(t.lock.reason || '')}</small></span></section>` : ''}
            <section class="aka-sec aka-s1"><div class="aka-sb aka-sb--base aka-px"><h2 class="aka-h2">Reyting · ${num(t.score)} ball</h2><span class="aka-b12">${t.prevScore != null ? `${prevMon}da ${num(t.prevScore)} · ` : ''}davomat 60% + oʻzlashtirish 40%</span></div>
                <div class="aka-grid2">${tile('Davomat · 60%', pct(t.attendancePct) + '%', 'oʻquvchilar darsga kelishi', pctTone(t.attendancePct, 85, 60))}${tile('Oʻzlashtirish · 40%', pct(t.masteryPct) + '%', 'birinchi urinish natijasi', pctTone(t.masteryPct, 70, 45))}${tile('Rejada oʻqiyapti', pct(onPlanPct) + '%', `${num(t.studentsCount)} dan ${num(t.onPlanCount)} tasi`, pctTone(onPlanPct, 75, 60))}${tile('Ketgan oʻquvchi', String(num(t.left30)), 'oxirgi 30 kun', num(t.left30) ? 'red' : '')}</div></section>
            <section class="aka-card aka-kvbox aka-s2"><h2>Sinov darslari · 30 kun</h2>${kv('Qabul qildi', String(num(tr.accepted)))}${num(tr.rejected) ? kv('Rad etdi · sabablari', `${num(tr.rejected)} ›`, { link: 'data-a-rejects' }) : kv('Rad etdi', '0')}${kv('Oʻquvchi boʻldi', String(num(tr.converted)))}</section>
            <section class="aka-card aka-kvbox aka-s2"><h2>Vaqtlar va qoplash</h2>${kv('Darsni vaqtida boshlash', `${pct(t.onTimePct)}%${num(t.lateLessons30) ? ` · 30 kunda ${num(t.lateLessons30)} dars kech` : ''}`)}${kv('Sinov vaqtlari', 'Dars jadvalida ›', { link: 'data-a-crm="timetable"' })}${kv('Qoplash · 30 kun', `${num(mk.total)} ta${num(mk.inReview) ? ` · ${num(mk.inReview)} tasi tekshiruvda` : ''} ›`, { link: 'data-a-go="makeups"' })}</section>
            <section class="aka-card aka-kvbox aka-s3"><div class="aka-sb aka-mt10"><h2>Ish haqi · ${esc(salMon)}</h2>${chip('Faqat koʻrish')}</div>${kv('Oʻtilgan darslar', sal.lessons == null ? '—' : `${num(sal.lessons)}${num(sal.makeups) ? ` + ${num(sal.makeups)} qoplash` : ''}`)}${kv('Hisoblangan', sal.amount == null ? '—' : money(sal.amount))}${kv('Holat', sal.status === 'paid' ? 'Toʻlangan' : sal.status === 'unpaid' ? `Admin tekshiryapti · 5-${afterMon} toʻlanadi` : sal.status && sal.status !== 'unknown' ? sal.status : 'Hisob hali yoʻq')}${kv('Eslatma', `Qoplash rad etilsa 4-${afterMon}gacha oʻzgarishi mumkin`)}</section>
            <section class="aka-card aka-list aka-s3">${navRow(`Oʻquvchilari · ${num(t.studentsCount)}`, num(t.riskStudents) ? `${num(t.riskStudents)} tasi xavf roʻyxatida` : 'Xavf roʻyxatida yoʻq', `data-a-triskof="${esc(t.name || '')}"`)}${navRow('Muammolar', num(pr.open) ? `${num(pr.open)} ochiq${num(pr.overdue) ? ` · ${num(pr.overdue)} tasi muddati oʻtgan` : ''}` : 'Ochiq muammo yoʻq', `data-a-tprob="${esc(t.name || '')}"`)}</section></div>
            ${bbar(`${tg ? `<a class="aka-btn aka-btn--out" href="${esc(tg)}" target="_blank" rel="noopener">${ic('send', 18)}Telegramda yozish</a>` : `<span class="aka-btn aka-btn--off">${ic('send', 18)}Telegram yoʻq</span>`}<button type="button" class="aka-btn aka-btn--pri aka-btn--14" data-a-newfor="teacher">${ic('plus', 18, 2.6)}Muammo yozish</button>`)}`;
    }
    function sheetRejects() {
        const t = peek(API.teacher(S.tid)); if (!t) return;
        const rs = t.trials30?.rejectReasons || [];
        openSheet('Sinovni rad etish sabablari', `${first(t.name)} · oxirgi 30 kun`, `<div class="aka-card aka-list">${rs.length ? rs.map(r => `<div class="aka-kv"><span>${esc(typeof r === 'string' ? r : r.reason || r.text || '')}</span><strong>${esc(typeof r === 'object' && r.at ? dShort(r.at) : '')}</strong></div>`).join('') : '<p class="aka-muted">Sabab yozilmagan</p>'}</div>`);
    }

    // =====================================================================================
    // A16 · Yordamchi kartasi
    // =====================================================================================
    function scrAssistant() {
        const url = API.assistant(S.aid), c = need(url);
        if (!c.d) return top('Yordamchi ustoz', { sub: myLangLabel() }) + `<div class="aka-body">${c.e ? errBox(c.e, url) : skIn(2, 110) + skIn(1, 240)}</div>`;
        const a = c.d, l7 = a.last7 || {}, sil = (a.silent || []).slice().sort((x, y) => num(y.days) - num(x.days)), sal = a.salary || {}, at = a.attendance || {};
        const now = new Date(), mon = MON[now.getMonth()];
        const tile = (l, v, s, tone) => `<div class="aka-tile"><span>${esc(l)}</span><strong class="${tone ? 'c-' + tone : ''}">${esc(v)}</strong><small>${esc(s)}</small></div>`;
        const shown = S.silentAll ? sil : sil.slice(0, 4);
        const contactedTone = num(a.students) && num(l7.contacted) / num(a.students) >= 0.75 ? '' : 'amber';
        const head = top(a.name || 'Yordamchi', { sub: ['Yordamchi ustoz', myLangLabel(), `${num(a.students)} oʻquvchi`].filter(Boolean).join(' · '), right: a.phone ? `<a class="aka-ib aka-ib--dark" href="${esc(telHref(a.phone))}" aria-label="${esc(first(a.name))}ga qoʻngʻiroq">${ic('phone', 18)}</a>` : '' });
        const tg = tgHref(a.phone);
        return head + `<div class="aka-body aka-body--bar">
            <section class="aka-sec aka-s1"><h2 class="aka-h2 aka-px">Soʻnggi 7 kun</h2><div class="aka-grid2">
                ${tile('Kamida 1 aloqa', `${num(l7.contacted)} / ${num(a.students)}`, `oʻrtacha ${String(l7.avgPerStudent ?? 0).replace('.', ',')} · maqsad 3`, contactedTone)}${tile('5+ kun aloqasiz', String(sil.length), sil.length ? 'pastda roʻyxat' : 'hammasi bilan aloqa bor', sil.length ? 'red' : '')}${tile('Qoʻngʻiroqlar', String(num(l7.calls)), `oʻrtacha ${num(l7.avgCallMin)} daqiqa`)}${tile('Yozishmalar', String(num(l7.messages)), 'haftasiga 1 tadan')}</div></section>
            <section class="aka-card aka-kvbox aka-s2"><div class="aka-sb aka-mt10"><h2>Aloqasiz qolganlar</h2><span class="aka-b12">eng uzogʻi birinchi</span></div>
                ${shown.length ? shown.map(x => `<button type="button" class="aka-srow aka-srow--56" data-a-student="${esc(x.studentId)}">${ava(x.name, 36)}<span><strong>${esc(shortName(x.name))}</strong><small>ustoz ${esc(first(x.teacherName))}</small></span>${chip(`${num(x.days)} kun aloqasiz`, num(x.days) >= 6 ? 'red' : 'amber')}</button>`).join('') : '<p class="aka-muted aka-pad">Hamma oʻquvchi bilan 5 kun ichida aloqa boʻlgan</p>'}
                ${!S.silentAll && sil.length > 4 ? `<button type="button" class="aka-kv aka-kv--a aka-kv--top" data-a-silentall><strong class="c-blue">Yana ${sil.length - 4} ta</strong>${ic('chev', 18)}</button>` : ''}</section>
            <section class="aka-card aka-kvbox aka-s3"><h2>Davomat va tasdiqlar</h2>${kv('Bugun', at.today || '—')}${dvAcademic() ? kv(`Davomat · ${mon}dan (yuz + GPS)`, `${at.monthText || 'Koʻrish'} ›`, { link: 'data-dv-go="team"' }) + kv('Davomat soʻrovlari', num(dvInfo().pending) ? `${num(dvInfo().pending)} ta ›` : 'Yoʻq ›', { link: 'data-dv-go="approvals"' }) : kv(`Davomat · ${mon}dan (yuz + GPS)`, at.monthText || '—')}${kv('Kechikkan aloqalar', num(a.lateContactsPending) ? `${num(a.lateContactsPending)} ta kutmoqda ›` : 'Yoʻq ›', { link: 'data-a-go="late"' })}</section>
            <section class="aka-card aka-kvbox aka-s3"><div class="aka-sb aka-mt10"><h2>Maosh · ${mon} (joriy)</h2>${chip('Faqat koʻrish')}</div>${kv('Sanalgan aloqalar', `${num(sal.counted)} · ${mon}ning ${now.getDate()} kunida`)}${kv('Hozircha', '≈ ' + money(sal.amount))}${kv('Hisob', '40 000 soʻm × aloqa ÷ 13, oʻquvchi boʻyicha')}${kv('Toʻlov', `Oy tugagach tekshiriladi · ${sal.payDate ? dLong(sal.payDate) : '5-' + MON[(now.getMonth() + 1) % 12]}`)}</section></div>
            ${bbar(`${tg ? `<a class="aka-btn aka-btn--out" href="${esc(tg)}" target="_blank" rel="noopener">${ic('send', 18)}Telegramda yozish</a>` : `<span class="aka-btn aka-btn--off">${ic('send', 18)}Telegram yoʻq</span>`}<button type="button" class="aka-btn aka-btn--pri aka-btn--14" data-a-newfor="assistant">${ic('plus', 18, 2.6)}Muammo yozish</button>`)}`;
    }

    // =====================================================================================
    // A19 · Kechikkan aloqalar
    // =====================================================================================
    function scrLate() {
        const url = API.late(S.ltab), pend = need(API.late('pending'));
        const n = pend.d ? (pend.d.items || []).length : null;
        const body = withData(url, d => {
            const items = d.items || [];
            if (!items.length) return emptyBox(S.ltab === 'pending' ? 'check' : 'archive', S.ltab === 'pending' ? 'Tasdiq kutayotgan aloqa yoʻq' : 'Tarix boʻsh', S.ltab === 'pending' ? 'Yordamchi kechikkan aloqa kiritsa shu yerda chiqadi' : '');
            return `<section class="aka-sec aka-s2">${items.map(x => {
                const rc = x.ruleCheck || {};
                const stChip = x.status === 'approved' ? chip('Tasdiqlandi', 'green') : x.status === 'rejected' ? chip('Rad etildi', 'red') : '';
                return `<article class="aka-card aka-late"><div class="aka-late-h">${ava(x.studentName, 40)}<span><strong>${esc(shortName(x.studentName))}</strong><small>${esc(['ustoz ' + first(x.teacherName), 'yordamchi ' + first(x.assistantName)].join(' · '))}</small></span>${stChip}</div>
                    <div class="aka-late-b"><strong>${esc(`${x.at ? dtComma(x.at) : ''} · ${x.kind === 'call' ? `qoʻngʻiroq ${num(x.minutes)} daqiqa` : 'yozishma'}`)}</strong>${x.reason ? `<span>«${esc(x.reason)}»</span>` : ''}${rc.text ? `<em class="c-${rc.ok ? 'green' : 'red'}">${rc.ok ? '✓' : '✕'} ${esc(rc.text)}</em>` : ''}<small>Kiritildi ${esc(x.enteredAt ? relDT(x.enteredAt).replace(/^B/, 'b').replace(/^K/, 'k') : '')}${(x.decidedBy || x.decidedByName) ? ' · hal qildi: ' + esc(x.decidedBy === 'Siz' || isMe(x.decidedByName) ? 'Siz' : (x.decidedByName || x.decidedBy)) : ''}${x.decisionNote ? ' · «' + esc(x.decisionNote) + '»' : ''}</small></div>
                    ${S.ltab === 'pending' ? `<div class="aka-two"><button type="button" class="aka-btn aka-btn--ghost aka-btn--48" data-a-lrej="${esc(x.id)}">Rad etish</button><button type="button" class="aka-btn aka-btn--green aka-btn--48" data-a-lok="${esc(x.id)}">${ic('check', 16, 2.8)}Tasdiqlash</button></div>` : ''}</article>`;
            }).join('')}</section>`;
        }, skIn(2, 190));
        return top('Kechikkan aloqalar', { sub: 'Yordamchilar · faqat shu oy' }) + `<div class="aka-body">
            ${tabs('ltab', [['pending', `Kutmoqda${n != null ? ' · ' + n : ''}`], ['history', 'Tarix']], S.ltab, 'Holat')}${body}
            ${note('Tasdiqlansa aloqa sanaladi: «aloqasiz» hisobi va yordamchi maoshi darhol yangilanadi. Rad etishda sabab majburiy. Admin ham tasdiqlay oladi — kim birinchi hal qilsa, shu qoladi.')}</div>`;
    }
    async function decideLate(id, approve, reason, btn) {
        if (btn) btn.disabled = true;
        try {
            await send(`/api/academic/head/late-contacts/${encodeURIComponent(id)}/decide`, 'POST', { approve, reason: reason || '' });
            toast(approve ? 'Tasdiqlandi · aloqa sanaldi' : 'Rad etildi · yordamchiga xabar ketdi', approve ? 'win' : 'ok');
        } catch (e) {
            if (e.status === 409) toast('Allaqachon hal qilingan', 'ok'); else { toast(e.message || 'Saqlab boʻlmadi', 'bad'); if (btn) btn.disabled = false; return false; }
        }
        invalidate('/api/academic/head/late-contacts', '/api/academic/head/assistant');
        need(API.late(S.ltab), true);
        return true;
    }
    function sheetLateReject(id) {
        const x = (peek(API.late('pending'))?.items || []).find(i => String(i.id) === String(id));
        openSheet('Rad etish', x ? `${shortName(x.studentName)} · yordamchi ${first(x.assistantName)}` : '', `<label class="aka-fld"><span class="aka-lbl">Sabab <i>*</i></span><textarea class="aka-ta" rows="3" maxlength="500" data-why placeholder="Yordamchi koʻradi"></textarea></label>
            <button type="button" class="aka-btn aka-btn--red aka-btn--54" data-ok>Rad etish</button>`, w => {
            w.querySelector('[data-ok]').onclick = async ev => {
                const why = w.querySelector('[data-why]').value.trim();
                if (!why) { toast('Sababni yozing', 'bad'); w.querySelector('[data-why]').focus(); return; }
                if (await decideLate(id, false, why, ev.target)) closeSheet();
            };
        });
    }

    // =====================================================================================
    // A17 · Menyu
    // =====================================================================================
    function scrMenu() {
        const u = user(), o = peek(API.ov) || need(API.ov).d || {}, t = o.tiles || {};
        const lateN = (need(API.late('pending')).d?.items || []).length;
        const badge = n => (n ? `<b class="aka-badge">${n > 99 ? '99+' : n}</b>` : '');
        const row = (icon, tone, title, right, attr) => `<button type="button" class="aka-mrow" ${attr}><span class="aka-qi t-${tone}">${ic(icon, 18)}</span><strong>${esc(title)}</strong>${right}</button>`;
        const meta = s => `<span class="aka-mmeta">${esc(s)}</span>`;
        // DAVOMAT — davomatApp (Face ID): akademik rahbar yordamchilarning tasdiqlovchisi; oʻz davomati — kuzatilsa.
        dvEnsure();
        const mi = dvInfo() || {};
        const dav = (mi.approver === 'academic' ? row('face', 'green', 'Yordamchilar davomati', '', 'data-dv-go="team"') + row('clock', 'amber', 'Davomat soʻrovlari', badge(num(mi.pending)), 'data-dv-go="approvals"') : '')
            + (mi.tracked ? row('clock', 'grey', 'Mening davomatim', '', 'data-dv-go="my"') : '');
        // Jarimalar (js/jarimaApp.js): oʻzi va ustozlari — ROP menyusidagidek.
        const fines = window.jarima && window.jarima.counts?.() ? window.jarima.menuItems().map(x => row(x.go === 'issue' ? 'alert' : x.go === 'washok' ? 'check' : 'note', x.go === 'issue' ? 'red' : 'amber', x.title, badge(num(x.badge)), `data-jr-go="${esc(x.go)}"`)).join('') : '';
        return `<div class="aka-body aka-body--menu">
            <button type="button" class="aka-card aka-prof aka-s1" data-a-profile>${ava(u.name || myName(), 52, 'dark')}<span><strong>${esc(u.name || myName())}</strong><small>Akademik rahbar${myLangLabel() ? ' · ' + esc(myLangLabel()) : ''}</small></span>${ic('chev', 18)}</button>
            <div class="aka-mgroups aka-s2">
              <section class="aka-mg"><h2 class="aka-cap">NAZORAT</h2><div class="aka-mgrid">${row('cal', 'purple', 'Sinov darslari', badge(num(t.trialsUnaccepted)), 'data-a-crm="teachers-section:trial"')}${row('check', 'green', 'Oʻquvchini tekshirish', '', 'data-a-crm="teachers-section:cabinet"')}${row('clock', 'blue', 'Qoplash tekshiruvi', badge(num(t.makeupsPending)), 'data-a-go="makeups"')}${row('alert', 'amber', 'Xavfdagi oʻquvchilar', meta(String(num(t.risk))), 'data-a-go="risk"')}${row('clock', 'blue', 'Kechikkan aloqalar', badge(lateN), 'data-a-go="late"')}${row('cap', 'purple', 'Sinov vaqtlari', meta('Dars jadvali'), 'data-a-crm="timetable"')}</div></section>
              <section class="aka-mg"><h2 class="aka-cap">DAVOMAT</h2><div class="aka-mgrid">${row('check', 'green', 'Ustozlar davomati', '', 'data-a-crm="teachers-section:attendance"')}${dav}</div></section>
              <section class="aka-mg"><h2 class="aka-cap">BOSHQA</h2><div class="aka-mgrid">${row('note', 'blue', 'Darslik', '', 'data-a-crm="teachers-section:textbook"')}${row('archive', 'grey', 'Arxiv · yopilgan muammolar', '', 'data-a-go="problems" data-a-ptab="closed"')}${fines}${row('bell', 'grey', 'Bildirishnoma sozlamalari', '', 'data-a-crm="profile:notifications"')}${row('gear', 'grey', 'Parolni oʻzgartirish', '', 'data-a-crm="profile:security"')}</div></section>
            </div></div>`;
    }

    // =====================================================================================
    // A20 · Bildirishnomalar (mavjud staffNotify manbasi)
    // =====================================================================================
    const NCAT = { acad_problem_overdue: 'problems', acad_teacher_locked: 'teachers', acad_trial_rejected: 'teachers', acad_break: 'teachers', acad_makeup_new: 'teachers', acad_late_contact: 'assistants', acad_risk_new: 'students' };
    const NLOOK = { acad_problem_overdue: ['alert', 'red'], acad_teacher_locked: ['lock', 'purple'], acad_trial_rejected: ['cal', 'amber'], acad_break: ['cal', 'grey'], acad_makeup_new: ['plus', 'blue'], acad_late_contact: ['clock', 'blue'], acad_risk_new: ['alert', 'amber'] };
    const NGO = { acad_problem_overdue: ['problems', { ptab: 'open' }], acad_teacher_locked: ['teachers', { ttab: 'teachers' }], acad_trial_rejected: ['teachers', { ttab: 'teachers' }], acad_break: ['teachers', { ttab: 'teachers' }], acad_makeup_new: ['makeups', { mtab: 'pending' }], acad_late_contact: ['late', { ltab: 'pending' }], acad_risk_new: ['risk', { rtab: 'all' }] };
    const nCat = n => NCAT[n.etype] || (/davomat|attendance|face/i.test(String(n.etype || n.cat || '')) ? 'assistants' : 'other');
    const nTime = n => { const t = Number(n.time) || Date.parse(n.time || ''); return Number.isFinite(t) ? t : 0; };
    function notifList() {
        try { if (g('syncNotifications')) syncNotifications(); } catch (e) { /* oflayn */ }
        return (g('getNotifications') ? (getNotifications() || []) : []).slice().sort((a, b) => nTime(b) - nTime(a)).slice(0, 100);
    }
    function scrNotifs() {
        const list = notifList(), un = list.filter(n => !n.read).length;
        const shown = list.filter(n => S.ntab === 'all' || nCat(n) === S.ntab);
        const today = new Date().toDateString(), yest = addDays(new Date(), -1).toDateString();
        const groups = [];
        for (const n of shown) { const t = nTime(n), k = t && new Date(t).toDateString() === today ? 'BUGUN' : t && new Date(t).toDateString() === yest ? 'KECHA' : 'OLDINROQ'; let gr = groups.find(x => x.k === k); if (!gr) groups.push(gr = { k, items: [] }); gr.items.push(n); }
        const item = n => { const [icn, tone] = NLOOK[n.etype] || (n.type === 'danger' ? ['alert', 'red'] : n.type === 'warning' ? ['clock', 'amber'] : ['bell', 'blue']); const t = nTime(n);
            return `<button type="button" class="aka-nrw${n.read ? '' : ' is-new'}" data-a-nitem="${esc(n.id)}"><span class="aka-qi aka-qi--40 t-${tone}">${ic(icn, 18)}</span><span class="aka-nrw-t"><strong>${esc(n.title || 'Bildirishnoma')}</strong>${n.message ? `<small>${esc(n.message)}</small>` : ''}</span><span class="aka-nrw-r"><small>${t ? esc(new Date(t).toDateString() === today ? hm(t) : dShort(t)) : ''}</small>${n.read ? '<i class="is-read"></i>' : '<i aria-label="Oʻqilmagan"></i>'}</span></button>`; };
        const err = window.staffNotify?.error?.();
        return top('Bildirishnomalar', { sub: un ? `${un} ta yangi` : 'Hammasi oʻqilgan', right: un ? '<button type="button" class="aka-txtbtn" data-a-nread>Hammasi oʻqildi</button>' : '' }) + `<div class="aka-body">
            <div class="aka-tabs aka-scroll aka-s1" role="tablist" aria-label="Turi">${[['all', 'Hammasi'], ['problems', 'Muammolar'], ['teachers', 'Ustozlar'], ['assistants', 'Yordamchilar'], ['students', 'Oʻquvchilar']].map(([k, l]) => `<button type="button" role="tab" class="aka-tab" aria-selected="${S.ntab === k}" data-a-ntab="${k}">${l}</button>`).join('')}</div>
            ${err ? `<div class="aka-err" role="alert"><span>${ic('alert', 20)}</span><div><strong>Server bildirishnomalari yuklanmadi</strong><small>${esc(err.message || '')}</small></div><button type="button" class="aka-btn aka-btn--out aka-btn--sm" data-a-nretry>Qayta urinish</button></div>` : ''}
            ${groups.length ? groups.map((gr, i) => `<section class="aka-sec aka-s${Math.min(3, i + 2)}"><h2 class="aka-cap">${gr.k}</h2><div class="aka-card aka-list">${gr.items.map(item).join('')}</div></section>`).join('') : emptyBox('bell', 'Bildirishnoma yoʻq', 'Yangi voqealar shu yerda chiqadi')}
            ${note('Bildirishnomalar Telegram bot orqali ham keladi. Qaysilari kelishini Menyu → Bildirishnoma sozlamalarida tanlaysiz.', 'bell')}</div>`;
    }
    function openNotif(id) {
        const n = (g('getNotifications') ? getNotifications() : []).find(x => String(x.id) === String(id));
        if (g('markNotificationRead')) { try { markNotificationRead(id); } catch (e) { /* */ } }
        if (!n) { render(false); return; }
        const tgt = NGO[n.etype];
        if (tgt) { go(tgt[0], tgt[1]); return; }
        if (n.tab) { openCrm(n.section ? `${n.tab}:${n.section}` : n.tab); return; }
        render(false);
    }

    // =====================================================================================
    // Chizish, navigatsiya
    // =====================================================================================
    const SCR = { home: scrHome, problems: scrProblems, pnew: scrNew, problem: scrProblem, makeups: scrMakeups, risk: scrRisk, students: scrStudents, student: scrStudent, teachers: scrTeachers, teacher: scrTeacher, assistant: scrAssistant, late: scrLate, menu: scrMenu, notifs: scrNotifs };
    const TABS = ['home', 'students', 'teachers', 'problems', 'menu'];
    const TAB_OF = { home: 'home', notifs: 'home', pnew: 'problems', problems: 'problems', problem: 'problems', risk: 'menu', students: 'students', student: 'students', teachers: 'teachers', teacher: 'teachers', assistant: 'teachers', makeups: 'teachers', late: 'teachers', menu: 'menu' };
    const NONAV = new Set(['pnew', 'problem', 'student', 'teacher', 'assistant', 'late', 'notifs']);
    function render(anim) {
        if (!root || !isOn()) return;
        if (S.screen === 'crm') { syncNav(); return; }
        const keep = {};
        if (!anim) root.querySelectorAll('input[id], textarea[id]').forEach(el => { if (el.value && el.type !== 'radio' && el.type !== 'checkbox') keep[el.id] = el.value; });
        const act = document.activeElement, focusId = act && root.contains(act) ? act.id : '', caret = focusId && typeof act.selectionStart === 'number' ? act.selectionStart : null;
        const prevScroll = root.querySelector('.aka-body')?.scrollTop || 0;
        let html;
        try { html = (SCR[S.screen] || scrHome)(); }
        catch (e) { console.error('[akademikApp]', e); html = top('Xatolik') + `<div class="aka-body">${emptyBox('alert', 'Ekranni chizib boʻlmadi', e.message || '')}<button type="button" class="aka-btn aka-btn--pri" data-a-nav="home">Bosh sahifa</button></div>`; }
        root.dataset.screen = S.screen;
        root.innerHTML = html;
        root.classList.toggle('aka-enter', !!anim);
        const body = root.querySelector('.aka-body');
        if (body) body.scrollTop = anim ? 0 : prevScroll;
        Object.keys(keep).forEach(id => { const el = root.querySelector('#' + id); if (el && !el.value) el.value = keep[id]; });
        if (focusId) { const el = root.querySelector('#' + focusId); if (el) { el.focus({ preventScroll: true }); if (caret != null) { try { el.setSelectionRange(caret, caret); } catch (e) { /* search */ } } } }
        document.body.classList.toggle('aka-nonav', NONAV.has(S.screen));
        syncNav();
    }
    function buildNav() {
        nav = document.createElement('nav');
        nav.className = 'aka-nav'; nav.setAttribute('aria-label', 'Pastki menyu');
        nav.addEventListener('click', e => { const b = e.target.closest('[data-a-nav]'); if (!b) return; closeSheet(true); go(b.dataset.aNav); });
        document.body.appendChild(nav);
    }
    function syncNav() {
        if (!nav) return;
        const active = S.screen === 'crm' ? null : TAB_OF[S.screen] || 'home';
        const open = num(peek(API.problems('open'))?.counts?.open);
        const items = [['home', 'home', 'Bosh'], ['students', 'cap', 'Oʻquvchilar'], ['teachers', 'team', 'Ustozlar'], ['problems', 'alert', 'Muammolar'], ['menu', 'menu', 'Menyu']];
        nav.innerHTML = items.map(([id, icn, l]) => `<button type="button" data-a-nav="${id}"${active === id ? ' aria-current="page"' : ''}${id === 'problems' && open ? ` aria-label="Muammolar, ${open} ta ochiq"` : ''}><span>${ic(icn, 20, active === id ? 2.2 : 1.9)}${id === 'problems' && open ? `<b>${open > 99 ? '99+' : open}</b>` : ''}</span>${l}</button>`).join('');
        nav.hidden = !isOn() || S.screen === 'crm' || NONAV.has(S.screen);
    }
    function go(screen, extra = {}) {
        const isTab = TABS.includes(screen);
        if (isTab) { S.stack = screen === 'home' ? [] : [{ screen: 'home' }]; }
        else S.stack.push(snap());
        Object.assign(S, extra, { screen });
        if (screen === 'pnew' && !extra.draft) S.draft = S.draft && extra.keepDraft ? S.draft : newDraft();
        if (screen === 'risk' && !('rTeacher' in extra)) S.rTeacher = '';
        if (screen === 'problems' && !('pq' in extra) && isTab) S.pq = '';
        S.later = false; S.mAll = false; S.rAll = false; S.silentAll = false;
        try { history.pushState({ aka: 1 }, ''); } catch (e) { /* tarix yo'q */ }
        render(true);
    }
    const snap = () => ({ screen: S.screen, pid: S.pid, sid: S.sid, tid: S.tid, aid: S.aid, ptab: S.ptab, pq: S.pq, rtab: S.rtab, rTeacher: S.rTeacher, ttab: S.ttab, mtab: S.mtab, ltab: S.ltab });
    function back() {
        if (sheetEl) { closeSheet(); return true; }
        const p = S.stack.pop();
        if (!p) { if (S.screen !== 'home') { S.screen = 'home'; render(true); return true; } return false; }
        if (S.screen === 'pnew') S.draft = null;
        Object.assign(S, p); render(true); return true;
    }
    function toast(msg, kind = 'ok', confetti = false) {
        toastEl?.remove(); clearTimeout(toastTimer);
        toastEl = document.createElement('div');
        toastEl.className = `aka-toast aka-toast--${kind}`; toastEl.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
        const colors = ['#0065D6', '#F79009', '#079455', '#7A5AF8', '#EE46BC', '#FDB022'];
        toastEl.innerHTML = `${confetti ? Array.from({ length: 14 }, (_, i) => `<i class="aka-conf" style="left:${8 + (i * 61) % 84}%;background:${colors[i % 6]};animation-delay:${(i % 5) * 0.06}s"></i>`).join('') : ''}<span>${kind === 'bad' ? ic('alert', 18) : ic('check', 18, 2.8)}</span><span>${esc(msg)}</span>`;
        document.body.appendChild(toastEl);
        toastTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, kind === 'bad' ? 4500 : 3200);
    }

    // ---------- pastki oyna ----------
    function openSheet(title, sub, body, onReady) {
        closeSheet(true);
        const opener = document.activeElement;
        sheetEl = document.createElement('div');
        sheetEl.className = 'aka-sheet-wrap';
        sheetEl.innerHTML = `<div class="aka-dim" data-a-x></div><section class="aka-sheet" role="dialog" aria-modal="true" aria-labelledby="akaShT"><span class="aka-grab" aria-hidden="true"></span>
            <div class="aka-sheet-h"><div><h2 id="akaShT">${esc(title)}</h2>${sub ? `<span>${esc(sub)}</span>` : '<span></span>'}</div><button type="button" class="aka-ib" data-a-x aria-label="Bekor qilish">${ic('x', 18, 2.2)}</button></div>${body}</section>`;
        document.body.appendChild(sheetEl);
        sheetEl._opener = opener;
        sheetEl.addEventListener('click', e => { if (e.target.closest('[data-a-x]')) closeSheet(); });
        sheetEl.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); return; }
            if (e.key !== 'Tab') return;
            const f = [...sheetEl.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
            if (!f.length) return; const a = f[0], z = f[f.length - 1];
            if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        });
        setTimeout(() => sheetEl?.querySelector('.aka-sheet-h .aka-ib')?.focus({ preventScroll: true }), 60);
        if (onReady) onReady(sheetEl);
    }
    function closeSheet(quiet) {
        if (!sheetEl) return;
        const op = sheetEl._opener; sheetEl.remove(); sheetEl = null;
        if (!quiet && op && document.body.contains(op)) { try { op.focus({ preventScroll: true }); } catch (e) { /* */ } }
        sheetHooks.forEach(fn => { try { fn(); } catch (e) { /* */ } });
    }
    function sheetHowScore() {
        openSheet('Ball qanday hisoblanadi?', 'Server formulasi — hamma joyda bir xil', `<div class="aka-card aka-kvbox">${kv('Davomat', '60%')}${kv('Oʻzlashtirish (birinchi urinish)', '40%')}${kv('Darsni vaqtida boshlash', 'reytingga kirmaydi')}</div>
            ${note('Davomat — oʻquvchilarning darsga kelishi. Oʻzlashtirish — uy vazifalarining birinchi urinishdagi natijasi. Darsni vaqtida boshlash alohida koʻrsatiladi.', 'trend')}`);
    }

    // ---------- CRM (kompyuter versiyasi sahifalari) ----------
    function openCrm(spec) {
        const [tab, section] = String(spec || '').split(':');
        S.stack.push(snap());
        S.screen = 'crm';
        closeSheet(true);
        document.body.classList.add('aka-crm');
        if (root) root.hidden = true;
        syncNav();
        try { history.pushState({ aka: 1 }, ''); } catch (e) { /* */ }
        if (g('switchTab')) {
            try {
                if (tab === 'hr') switchTab('hr', { hrSection: section || 'xodimlar' });
                else if (tab === 'teachers-section') switchTab(tab, { teachersSection: section || 'attendance' });
                else switchTab(tab || 'profile');
                if (tab === 'profile' && section && g('switchProfileSection')) switchProfileSection(section);
            } catch (e) { console.error('[akademikApp] openCrm', e); }
        }
        window.scrollTo?.(0, 0);
        document.querySelector('.aka-backbar')?.remove();
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'aka-backbar'; b.innerHTML = `${ic('back', 18, 2.4)}Akademik kabinetga qaytish`;
        b.onclick = () => closeCrm();
        document.body.appendChild(b);
    }
    function closeCrm() {
        document.querySelector('.aka-backbar')?.remove();
        document.body.classList.remove('aka-crm');
        try { window.jadvalV3?.close?.({ silent: true }); } catch (e) { /* */ }
        if (root) root.hidden = false;
        const p = S.stack.pop(); Object.assign(S, p || { screen: 'menu' });
        render(true);
    }
    // Telefonda sidebar (Menyu) dagi kabinet bandi bosilsa: umumiy sahifa rejimidan chiqib, kabinet ekraniga.
    const DESK_TO_SCREEN = { home: ['home'], problems: ['problems', { ptab: 'open' }], archive: ['problems', { ptab: 'closed' }], teachers: ['teachers', { ttab: 'teachers' }], makeups: ['makeups', { mtab: 'pending' }], risk: ['risk', { rtab: 'all' }], late: ['late', { ltab: 'pending' }] };
    function openScreen(key) {
        const tgt = DESK_TO_SCREEN[key];
        if (!tgt || !isOn()) return false;
        if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarToggle')?.click();
        if (S.screen === 'crm') {
            document.querySelector('.aka-backbar')?.remove();
            document.body.classList.remove('aka-crm');
            try { window.jadvalV3?.close?.({ silent: true }); } catch (e) { /* */ }
            if (root) root.hidden = false;
        }
        S.screen = 'home';
        go(tgt[0], { ...(tgt[1] || {}) });
        return true;
    }
    // Davomat: mavjud xodimlar davomati ekranlari (HR → Davomat), o'z davomati — kamera oynasi.
    // Davomat sahifalari — js/davomatApp.js (davomat.open). Zaxira (davomat yuklanmagan): eski oʻz davomati oynasi.
    function openAttendance(kind) {
        const page = kind === 'me' ? 'my' : kind === 'requests' ? 'approvals' : 'team';
        if (window.davomat?.open && (page === 'my' ? dvInfo()?.tracked : dvAcademic())) { window.davomat.open(page); return; }
        if (page === 'my' && window.staffAttendanceUI?.openCheckSheet) { window.staffAttendanceUI.openCheckSheet(); return; }
        toast('Davomat maʼlumoti hali yuklanmadi', 'bad');
    }

    // ---------- hodisalar ----------
    function onClick(e) {
        const t = e.target.closest('[data-a-back],[data-a-go],[data-a-nav],[data-a-retry],[data-a-ptab],[data-a-later],[data-a-problem],[data-a-mtab],[data-a-makeup],[data-a-mall],[data-a-rtab],[data-a-rall],[data-a-stab],[data-a-student],[data-a-teacher],[data-a-assistant],[data-a-ttab],[data-a-howscore],[data-a-ltab],[data-a-lok],[data-a-lrej],[data-a-ntab],[data-a-nread],[data-a-nitem],[data-a-nretry],[data-a-crm],[data-a-att],[data-a-profile],[data-a-spick],[data-a-newsave],[data-a-stage],[data-a-owner],[data-a-postpone],[data-a-close],[data-a-transfer],[data-a-thist],[data-a-sprob],[data-a-newfor],[data-a-rejects],[data-a-triskof],[data-a-tprob],[data-a-silentall]');
        if (!t || (t.tagName === 'A' && t.getAttribute('href'))) return;
        const d = t.dataset;
        if ('aBack' in d) { history.back(); return; }
        if ('aGo' in d) {
            const ex = {};
            if (d.aPtab) ex.ptab = d.aPtab; if (d.aRtab) ex.rtab = d.aRtab; if (d.aTtab) ex.ttab = d.aTtab;
            go(d.aGo, ex); return;
        }
        if ('aNav' in d) { go(d.aNav); return; }
        if ('aRetry' in d) { const c = C.get(d.aRetry); if (c) { c.e = null; c.at = 0; } need(d.aRetry, true); render(false); return; }
        if ('aPtab' in d) { S.ptab = d.aPtab; S.later = false; render(false); return; }
        if ('aLater' in d) { S.later = true; render(false); return; }
        if ('aProblem' in d) { go('problem', { pid: d.aProblem }); return; }
        if ('aMtab' in d) { S.mtab = d.aMtab; S.mAll = false; render(false); return; }
        if ('aMakeup' in d) { sheetMakeup(d.aMakeup); return; }
        if ('aMall' in d) { S.mAll = true; render(false); return; }
        if ('aStab' in d) { S.stab = d.aStab; render(false); return; }
        if ('aRtab' in d) { S.rtab = d.aRtab; S.rAll = false; render(false); return; }
        if ('aRall' in d) { S.rAll = true; render(false); return; }
        if ('aStudent' in d) { go('student', { sid: d.aStudent }); return; }
        if ('aTeacher' in d) { go('teacher', { tid: d.aTeacher }); return; }
        if ('aAssistant' in d) { go('assistant', { aid: d.aAssistant }); return; }
        if ('aTtab' in d) { S.ttab = d.aTtab; render(false); return; }
        if ('aHowscore' in d) { sheetHowScore(); return; }
        if ('aLtab' in d) { S.ltab = d.aLtab; render(false); return; }
        if ('aLok' in d) { decideLate(d.aLok, true, '', t); return; }
        if ('aLrej' in d) { sheetLateReject(d.aLrej); return; }
        if ('aNtab' in d) { S.ntab = d.aNtab; render(false); return; }
        if ('aNread' in d) { if (g('markAllNotificationsRead')) { try { markAllNotificationsRead(); } catch (er) { /* */ } } toast('Hammasi oʻqildi'); render(false); return; }
        if ('aNitem' in d) { openNotif(d.aNitem); return; }
        if ('aNretry' in d) { window.staffNotify?.refresh?.()?.then?.(() => render(false)); return; }
        if ('aCrm' in d) { openCrm(d.aCrm); return; }
        if ('aAtt' in d) { openAttendance(d.aAtt); return; }
        if ('aProfile' in d) { openCrm('profile'); return; }
        if ('aSpick' in d) { sheetStudentPick(); return; }
        if ('aNewsave' in d) { saveNew(t); return; }
        if ('aStage' in d) { patchProblem({ stage: d.aStage }, `Bosqich: ${stageOf(d.aStage)[1]}`); return; }
        if ('aOwner' in d) { sheetOwner(); return; }
        if ('aPostpone' in d) { sheetPostpone(); return; }
        if ('aClose' in d) { sheetClose(); return; }
        if ('aTransfer' in d) { sheetTransfer(d.aTransfer); return; }
        if ('aThist' in d) { sheetTeacherHistory(); return; }
        if ('aSprob' in d) { go('problems', { pq: d.aSprob, ptab: d.aSprobopen === '1' ? 'open' : 'closed' }); return; }
        if ('aTprob' in d) { go('problems', { pq: first(d.aTprob), ptab: 'open' }); return; }
        if ('aTriskof' in d) { go('risk', { rtab: 'all', rTeacher: d.aTriskof }); return; }
        if ('aRejects' in d) { sheetRejects(); return; }
        if ('aSilentall' in d) { S.silentAll = true; render(false); return; }
        if ('aNewfor' in d) {
            let draft = newDraft();
            if (d.aNewfor === 'student') { const s = peek(API.student(S.sid)); if (s) draft = newDraft({ studentId: s.id, studentName: s.name, teacherId: s.teacher?.id || null, teacherName: s.teacher?.name || '', studentMeta: [s.lessonNo ? s.lessonNo + '-dars' : '', s.schedule || ''].filter(Boolean).join(' · ') }); }
            if (d.aNewfor === 'teacher') draft = newDraft({ type: 'teacher', source: 'self' });
            if (d.aNewfor === 'assistant') draft = newDraft({ source: 'assistant' });
            go('pnew', { draft }); S.draft = draft; return;
        }
    }
    function onChange(e) {
        const el = e.target;
        if (el.matches('[data-a-steach]')) { S.sTeacher = el.value; render(false); return; }
        if (S.screen === 'pnew' && S.draft && el.type === 'radio') {
            const D = S.draft;
            if (el.name === 'owner' && el.value === 'staff') { sheetStaffPick(); return; }
            if (['type', 'source', 'owner', 'due'].includes(el.name)) { D[el.name] = el.value; if (el.name === 'due') render(false); }
        }
    }
    function onInput(e) {
        const el = e.target;
        if (el.matches('[data-a-draft]') && S.draft) { S.draft[el.dataset.aDraft] = el.value; return; }
        if (el.matches('[data-a-sq]')) { const q = el.value.trim().toLowerCase(); root.querySelectorAll('[data-a-slist] [data-q]').forEach(b => { b.hidden = !!q && !b.dataset.q.includes(q); }); return; }
        if (el.matches('[data-a-q]')) {
            clearTimeout(qTimer);
            qTimer = setTimeout(() => { S.pq = el.value; S.later = true; render(false); }, 300);
        }
    }
    async function onSubmit(e) {
        const fm = e.target.closest('[data-a-cmt]'), nf = e.target.closest('[data-a-newform]');
        if (nf) { e.preventDefault(); return; }
        if (!fm) return;
        e.preventDefault();
        const inp = fm.querySelector('input'), v = inp.value.trim(); if (!v) return;
        const btn = fm.querySelector('button'); btn.disabled = true;
        try {
            await send(API.problem(S.pid) + '/events', 'POST', { kind: 'comment', text: v });
            inp.value = '';
            need(API.problem(S.pid), true);
            toast('Izoh saqlandi');
        } catch (er) { toast(er.message || 'Saqlab boʻlmadi', 'bad'); }
        btn.disabled = false;
    }
    function onVisible() {
        if (document.visibilityState !== 'visible' || !isOn()) return;
        if (Date.now() - (onVisible.at || 0) > 30000) { onVisible.at = Date.now(); refresh(); }
    }
    function refresh() {
        for (const c of C.values()) c.at = 0;
        if (S.screen !== 'crm') render(false);
        need(API.problems('open')); need(API.ov);
    }

    function enable() {
        document.body.classList.add('aka-on');
        if (!root) {
            root = document.createElement('main');
            root.id = 'akademikApp'; root.className = 'aka-app';
            document.body.appendChild(root);
            root.addEventListener('click', onClick);
            root.addEventListener('change', onChange);
            root.addEventListener('input', onInput);
            root.addEventListener('submit', onSubmit);
        }
        root.hidden = S.screen === 'crm';
        if (!nav) buildNav();
        render(true);
    }
    function disable() {
        document.body.classList.remove('aka-on', 'aka-crm', 'aka-nonav');
        closeSheet(true);
        document.querySelector('.aka-backbar')?.remove();
        if (root) root.hidden = true;
        if (nav) nav.hidden = true;
    }
    function sync() { if (isOn()) enable(); else disable(); }

    function init() {
        if (inited || user().role !== 'akademik') return;
        inited = true;
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        window.addEventListener('popstate', () => {
            if (!isOn()) return;
            if (S.screen === 'crm') { closeCrm(); return; }
            if (!back() && S.screen === 'home') toast('Chiqish uchun yana bir marta “Orqaga” bosing');
        });
        window.addEventListener('staff:feed', () => { if (isOn() && ['home', 'notifs'].includes(S.screen) && !sheetEl) render(false); });
        MQ.addEventListener?.('change', sync);
        need(API.me); need(API.problems('open'));
        sync();
        setInterval(() => { if (isOn() && document.visibilityState === 'visible' && !sheetEl) refresh(); }, 60000);
    }

    // Kompyuter kabineti uchun umumiy toʻplam: oynalar telefondagi bilan bir xil boʻlishi uchun shu yerdagi funksiyalar ishlatiladi.
    const kit = {
        API, need, peek, invalidate, send, on: fn => { listeners.add(fn); return () => listeners.delete(fn); }, onSheetClose: fn => { sheetHooks.add(fn); return () => sheetHooks.delete(fn); },
        esc, ic, ava, chip, chips, fs, note, emptyBox, errBox, initials, first, shortName, num, pct, money, telHref, tgHref,
        toDate, localDate, dayDiff, hm, dShort, dLong, dtShort, dtComma, relDT, overdueTxt, addDays, greet, MON, WD,
        STAGES, stageOf, TYPES, SOURCES, SRC_LOW, SRC_CHIP, RESULTS, RISK, EV_T, normP, f, isMe, myName, scoreTone, riskTone, minTxt,
        dueOptions, newDraft, localStudents, staffList, openSheet, closeSheet, toast, patchProblem, decideLate,
        dlg: { owner: sheetOwner, postpone: sheetPostpone, close: sheetClose, makeup: sheetMakeup, transfer: sheetTransfer, lateReject: sheetLateReject, teacherHistory: sheetTeacherHistory },
        notifs: { list: notifList, NLOOK, NGO, open: id => { if (g('markNotificationRead')) { try { markNotificationRead(id); } catch (e) { /* */ } } } },
    };
    window.akademikApp = { init, go, back, openScreen, openAttendance, render: () => render(false), state: S, ownLang, langs: myLangs, kit, _test: { normP, riskTone, dueOptions, cache: C } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80));
    else setTimeout(init, 80);
})();
