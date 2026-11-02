// Domwork Team — ROP (sotuv bo'limi boshlig'i) telefon ilovasi (2026-11, "Domwork Team — ROP kabineti" dizayni).
// js/sotuvApp.js bilan bir xil qurilish: o'z ildizi (#raApp), pastki menyu, ekranlar steki, pastki oynalar, toast,
// render navbati. Faqat role=rop va ekran ≤900px bo'lganda yoqiladi; kompyuter ko'rinishi o'zgarmaydi.
// Ma'lumot va amallar — mavjud funksiyalar va server yo'llari orqali: computeRopHome, updateLeadInStorage,
// requestLeadStageChange, applyBulkLeadAssignment/planEvenLeadSplit, persistLeadChange, /api/school/edit-requests,
// /api/leads/stale-rule, /api/archive, /api/sms/send (apiSendSms), /api/school/schedule, sotuvSinov, jadvalV3.
// Umumiy ekranlar (Reyting, Qarzdorlar, O'quvchilar, Skriptlar, Profil, Jadval/Kim bo'sh) — mavjud CRM sahifalari.
// Uslublar: css/sotuvApp.css (umumiy .sa-* bo'laklar) + css/ropApp.css (body.ra-on, .ra-*).
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const DAY = 86400000, MIN = 60000, TZ = 5 * 3600000;
    const g = name => (typeof window[name] === 'function' ? window[name] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isOn = () => user().role === 'rop' && MQ.matches;
    const LANGS = () => { const l = user().linkedRopLang || 'english'; return l === 'both' ? ['english', 'russian'] : [l === 'russian' ? 'russian' : 'english']; };
    const langLabel = lg => (lg === 'russian' ? 'Rus tili' : 'Ingliz tili');
    const langsTxt = () => (LANGS().length > 1 ? 'Ingliz va rus' : langLabel(LANGS()[0]));
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : (l.status || 'yangi-lidlar'));
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const mln = n => { const v = Math.round((Number(n) || 0) / 1e5) / 10; return String(v).replace('.', ',') + ' mln'; };
    const mlnF = n => (String((Math.round((Number(n) || 0) / 1e5) / 10).toFixed(1)).replace('.', ',') + ' mln');
    const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : ''; };
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
    const p2 = n => String(n).padStart(2, '0');
    const hm = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
    const hmm = m => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
    const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const MONS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
    const parseT = v => { if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };
    const shortDate = t => { const d = new Date(t); return `${d.getDate()}-${MONS[d.getMonth()]}`; };
    const when = t => {
        const d = new Date(t), now = new Date();
        const diff = Math.round((new Date(d.toDateString()) - new Date(now.toDateString())) / DAY);
        return `${diff === 0 ? 'Bugun' : diff === -1 ? 'Kecha' : diff === 1 ? 'Ertaga' : shortDate(t)} ${hm(t)}`;
    };
    const dur = ms => { ms = Math.abs(ms); const h = Math.floor(ms / 3600000); if (h >= 48) return Math.floor(h / 24) + ' kun'; if (h >= 1) { const m = Math.floor((ms % 3600000) / MIN); return h + ' s' + (m ? ' ' + m + ' daq' : ''); } return Math.max(1, Math.round(ms / MIN)) + ' daq'; };
    const durLong = ms => { ms = Math.abs(ms); const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000); if (d) return `${d} kun${h ? ' ' + h + ' soat' : ''}`; if (h) return `${h} soat`; return Math.max(1, Math.round(ms / MIN)) + ' daq'; };
    const ruleTxt = m => (m >= 60 ? `${Math.round(m / 60)} soat` : `${m} daq`);
    const telOf = v => String(v || '').replace(/[^\d+]/g, '');
    // Toshkent sanasi (sinovlar uchun — trialUI bilan bir xil).
    const local = iso => { const ms = parseT(iso); if (!ms) return null; const d = new Date(ms + TZ); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), ms }; };
    const tToday = () => new Date(Date.now() + TZ).toISOString().slice(0, 10);
    const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const wdOf = d => { const x = new Date(d + 'T00:00:00Z').getUTCDay(); return x === 0 ? 7 : x; };
    const isoOf = (date, min) => new Date(Date.parse(date + 'T00:00:00Z') + min * MIN - TZ).toISOString();
    const nowMin = () => { const d = new Date(Date.now() + TZ); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
    const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* saqlab bo'lmasa ham ishlaydi */ } };
    // Ikki marta bosishdan himoya: bir xil yozuv amali 1,5 soniya ichida (yoki so'rov tugaguncha) qayta bajarilmaydi.
    const busyKeys = new Map();
    const once = (key, ms = 1500) => { const t = busyKeys.get(key); if (t && Date.now() - t < ms) return false; busyKeys.set(key, Date.now()); return true; };
    const release = key => busyKeys.delete(key);
    const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // ---------- ikonkalar ----------
    const P = {
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        leads: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        team: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.6 2.8.7a2 2 0 011.7 2z"/>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l12-9"/>',
        sms: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        smsl: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
        back: '<path d="M15 18l-6-6 6-6"/>',
        close: '<path d="M18 6L6 18M6 6l12 12"/>',
        chev: '<path d="M9 6l6 6-6 6"/>',
        down: '<path d="M6 9l6 6 6-6"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        check: '<path d="M5 12l5 5L20 7"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        approve: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
        userplus: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
        card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
        tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
        swap: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
        archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4"/>',
        funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        debt: '<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M16 12.5h2M2 10h20"/>',
        script: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        students: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
        logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        warn: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        x: '<path d="M18 6L6 18M6 6l12 12"/>',
        redo: '<path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8"/><path d="M3 3v5h5"/>',
        dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
        shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
        receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
        pause: '<path d="M9 5v14M15 5v14"/>',
        arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        minus: '<path d="M5 12h14"/>'
    };
    const ic = (n, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

    // ---------- holat ----------
    const S = { screen: 'home', stack: [], stage: 'yangi-lidlar', man: 'all', q: '', lead: null, leadLang: null, sel: new Set(), apTab: 'pending', ap: null, apId: null,
        trDay: 'today', teamPer: 'oylik', funPer: 'oylik', mgr: null, notifCat: 'all', arTab: 'lead', ar: null, sms: 'qaror', smsText: null, rules: null, staleDraft: null, staleLang: null, sched: {} };
    let root, nav, sheetEl, toastEl, overlayEl, inited = false, renderQueued = false, booted = false;

    // ---------- ma'lumot ----------
    const leadsAll = () => (g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : { english: [], russian: [] }) || {};
    const ALL = () => { const all = leadsAll(); return LANGS().flatMap(lg => (all[lg] || []).filter(l => l && !l.deletedAt).map(l => Object.assign({}, l, { _lang: lg }))); };
    const leadById = (id, lg) => {
        const all = leadsAll();
        for (const L of (lg ? [lg] : LANGS())) { const l = (all[L] || []).find(x => x && x.id === id); if (l) return Object.assign({}, l, { _lang: L }); }
        return null;
    };
    const COLS = () => (typeof LEAD_COLUMNS !== 'undefined' ? LEAD_COLUMNS : []);
    const SHORT = {
        'yangi-lidlar': 'Yangi', 'boglanishga-urinilmoqda': 'Urinilmoqda', 'boglanildi': 'Bogʻlanildi', 'sinov-darsida': 'Sinovda',
        'qaror-jarayonida': 'Qaror', 'keyin-sotib-olmoqchi': 'Keyin oladi', 'tolov-jarayonida': 'Toʻlovda', 'tolov-yopildi': 'Yopildi',
        'muvaffaqiyatsiz-sotuv': 'Muvaffaqiyatsiz', 'sifatsiz-lidlar': 'Sifatsiz'
    };
    const PATH = ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida', 'tolov-yopildi'];
    const OPEN = new Set(['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida']);
    const CLOSED = new Set(['tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']);
    const colLabel = id => (COLS().find(c => c.id === id) || {}).label || SHORT[id] || id;
    const hr = () => (g('getItem') ? getItem(STORAGE_KEYS.hrEmployees, []) : []) || [];
    const person = id => hr().find(e => String(e.id) === String(id)) || null;
    const allMgrs = () => (g('getSalesManagers') ? getSalesManagers() : []);
    const mgrName = id => (allMgrs().find(m => String(m.id) === String(id)) || person(id) || {}).name || '';
    // Faol menejerlar (HR) — ROP tili(lari) bo'yicha.
    const MGRS = lg => (lg ? [lg] : LANGS()).flatMap(L => (g('getActiveSalesManagers') ? getActiveSalesManagers(L) : []).map(m => Object.assign({}, m, { _lang: L })))
        .filter((m, i, a) => a.findIndex(x => String(x.id) === String(m.id)) === i);
    // Taqsimlash ro'yxati — mavjud ommaviy biriktirish bilan bir manba (getBulkLeadManagers).
    const assignMgrs = lg => { const b = g('getBulkLeadManagers') ? getBulkLeadManagers(lg) : []; return (b.length ? b : MGRS(lg)).map(m => Object.assign({}, m, { _lang: lg })); };
    const assignedAt = l => parseT(l.managerAssignedAt) || parseT(l.createdAt) || (g('parseLeadSlaTime') ? parseLeadSlaTime(l.date) : null);
    const createdAt = l => parseT(l.createdAt) || (g('parseLeadSlaTime') ? parseLeadSlaTime(l.date) : null);
    const comments = l => (Array.isArray(l.comments) ? l.comments : []).filter(Boolean);
    const callsOf = l => comments(l).filter(c => c.type === 'call-attempt' || c.type === 'contact-fail');
    const srcLabel = l => (g('leadSourceName') ? leadSourceName(l.source) : l.source) || 'Organik';
    const kindLabel = l => (l.leadType === 'target' ? 'Target' : 'Organik');
    const loadOf = (id, all) => (all || ALL()).filter(l => String(l.managerId) === String(id) && OPEN.has(st(l))).length;
    const planOf = id => { const t = g('getManagerPeriodTarget') ? getManagerPeriodTarget(id, 'oylik') : 0; const s = g('getManagerSalesForPeriod') ? getManagerSalesForPeriod(id, 'oylik') : 0; return { t, s, pct: t > 0 ? Math.round(s / t * 100) : null }; };
    const AV = [['#DCEBFF', '#0057B8'], ['#FEF0C7', '#93370D'], ['#ECFDF3', '#067647'], ['#F1E8FF', '#5B21B6'], ['#FFE4E8', '#9F1239'], ['#E0F2FE', '#075985']];
    const avColor = s => AV[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
    const avatar = (name, size = 42, cls = '') => { const [b, f] = avColor(name); return `<span class="sa-av ${cls}" style="width:${size}px;height:${size}px;background:${b};color:${f};font-size:${Math.round(size / 3)}px">${esc(initials(name))}</span>`; };
    const staffImg = (id, name, size = 44, cls = '') => {
        const url = window.schoolUI?.staffAvatarOf ? window.schoolUI.staffAvatarOf(id) : '';
        return url ? `<img class="sa-av ${cls}" src="${esc(url)}" alt="" style="width:${size}px;height:${size}px">` : avatar(name, size, cls);
    };
    const pill = (text, tone) => `<span class="sa-pill sa-pill--${tone}">${esc(text)}</span>`;
    const empty = (img, title, text, btn) => `<div class="sa-empty"><img src="images/empty/${img}.webp" alt="" width="104" height="104"><strong>${esc(title)}</strong><span>${esc(text)}</span>${btn || ''}</div>`;
    const mgrTg = id => { const ph = telOf(person(id)?.phone); return ph ? `https://t.me/${ph.startsWith('+') ? ph : '+' + ph}` : ''; };

    // Qotgan lidlar qoidasi (server: /api/leads/stale-rule) — staleLeads.js bilan bir xil hisob.
    const DEF_RULE = { warnDays: 3, lockDays: 5, callsPerDay: 30 };
    const ruleFor = lg => Object.assign({}, DEF_RULE, (S.rules || {})[lg === 'english' ? 'english' : 'russian'] || {});
    async function loadRules(force) {
        if (S.rules && !force) return S.rules;
        try { const r = g('apiFetch') ? await apiFetch('/api/leads/stale-rule', { fresh: true }) : null; if (r?.rules) S.rules = r.rules; } catch (e) { /* standart qoida */ }
        if (!S.rules) S.rules = { english: { ...DEF_RULE }, russian: { ...DEF_RULE } };
        return S.rules;
    }
    const AFTER = new Set(['boglanildi', 'malumot-berildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi']);
    const neverConnected = l => !(Array.isArray(l.stageHistory) && l.stageHistory.some(h => h && AFTER.has(h.to))) && !(l.connectedSurvey && Object.keys(l.connectedSurvey).length);
    const ageDays = l => { const t = assignedAt(l); return t ? Math.floor((Date.now() - t) / DAY) : 0; };
    function staleOf(l) {
        if (!l.managerId || st(l) !== 'boglanishga-urinilmoqda' || !neverConnected(l)) return null;
        const r = ruleFor(l._lang), d = ageDays(l);
        if (d >= r.lockDays) return { d, lock: true, r };
        if (d >= r.warnDays) return { d, lock: false, r };
        return null;
    }
    const forcedThisMonth = l => { const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        return st(l) === 'sifatsiz-lidlar' && comments(l).some(c => c.type === 'sifatsiz-lid' && /Telefonni olmadi/.test(c.text || '') && (parseT(c.createdAt) || 0) >= ms); };
    const callsToday = (leads, mid) => { const k = dayKey(Date.now()); return leads.filter(l => String(l.managerId) === String(mid)).reduce((a, l) => a + comments(l).filter(c => c.type === 'call-attempt' && parseT(c.createdAt) && dayKey(parseT(c.createdAt)) === k).length, 0); };

    // SLA eskalatsiyalari — computeRopHome (bitta manba).
    function ropHome() {
        try { return g('computeRopHome') ? computeRopHome({ user: user(), students: getItem(STORAGE_KEYS.students, []) || [], leads: leadsAll(), now: new Date() }) : null; } catch (e) { return null; }
    }
    const slaRule = l => (typeof LEAD_SLA_RULES !== 'undefined' ? LEAD_SLA_RULES[st(l)]?.rop : null);

    // Tasdiqlar (Sotuv tahrirlari) — schoolUI.api bilan, "Sotuv tahrirlari · tasdiq" sahifasidagi bir xil so'rovlar.
    const sApi = (p, o) => (window.schoolUI?.api ? window.schoolUI.api(p, o) : Promise.reject(new Error('Maktab moduli yuklanmagan')));
    async function loadApprovals(force) {
        if (S.ap?.loading) return S.ap.p;
        if (S.ap && !force && Date.now() - S.ap.at < 60000) return S.ap;
        const prev = S.ap;
        S.ap = { ...(prev || { list: [], counts: {} }), loading: true };
        S.ap.p = sApi('/edit-requests').then(r => { S.ap = { list: r?.requests || [], counts: r?.counts || {}, at: Date.now(), err: null }; window.refreshApprovalsBadge?.(r?.counts || {}); queueRender(); return S.ap; })
            .catch(e => { S.ap = { ...(prev || { list: [], counts: {} }), at: Date.now(), err: e }; queueRender(); return S.ap; });
        return S.ap.p;
    }
    const apOrder = (a, b) => (parseT(b.created_at) || 0) - (parseT(a.created_at) || 0);
    const pendingAp = () => (S.ap?.list || []).filter(r => r.status === 'pending');

    // Sinov darslari — trialUI bilan bir xil manba (lid → trialWorkflow.request / phase).
    const W = () => window.trialWorkflow;
    function trialRows() {
        if (!W()) return [];
        const out = [];
        for (const l of ALL()) {
            const inTrial = l.status === 'sinov-darsida';
            const req = inTrial ? W().request(l) : (l.trialRequest?.id ? l.trialRequest : null);
            if (!req && !inTrial) continue;
            const d = W().durationOf(l);
            const r = req || { teacherId: '', scheduledAt: l.trialLessonAt || '' };
            out.push({ lead: l, req: r, ph: W().isCancelled?.(l) ? 'cancelled' : W().phase(req || {}, { leadStatus: l.status, durationMin: d }), dur: d, at: local(r.scheduledAt) });
        }
        return out;
    }
    const needsTeacher = ph => ph === 'unassigned' || ph === 'rejected';
    async function schedFor(date, force) {
        const k = date;
        if (S.sched[k] && !force && (S.sched[k].loading || Date.now() - S.sched[k].at < 60000)) return S.sched[k].p;
        const lg = LANGS().length === 1 ? `&lang=${LANGS()[0]}` : '';
        const e = { loading: true, at: Date.now() };
        e.p = sApi(`/schedule?from=${date}&to=${date}${lg}`).then(r => { Object.assign(e, { loading: false, data: r, err: null, at: Date.now() }); queueRender(); return e; })
            .catch(err => { Object.assign(e, { loading: false, err, at: Date.now() }); queueRender(); return e; });
        S.sched[k] = e;
        return e.p;
    }

    // ---------- umumiy bo'laklar ----------
    const bell = () => {
        const n = g('getUnreadCount') ? getUnreadCount() : 0;
        return `<button type="button" class="sa-icon-btn" data-ra-go="notif" aria-label="Bildirishnomalar${n ? ', ' + n + ' ta yangi' : ''}">${ic('bell')}${n ? `<span class="sa-dot-n">${n > 9 ? '9+' : n}</span>` : ''}</button>`;
    };
    const topBack = (title, sub, extra = '') => `<header class="sa-top sa-top--page ra-top"><button type="button" class="sa-icon-btn sa-ghost" data-ra-back aria-label="Orqaga">${ic('back', 22, 2.2)}</button><div class="sa-top-t"><h1>${esc(title)}</h1>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${extra}</header>`;
    const crumb = (title, extra = '') => `<header class="sa-top sa-top--page sa-top--crumb ra-top"><button type="button" class="sa-icon-btn sa-ghost" data-ra-back aria-label="Orqaga">${ic('back', 22, 2.2)}</button><div class="sa-top-t"><h1>${esc(title)}</h1></div>${extra}</header>`;
    const bar = (pct, tone = 'blue', due = null) => `<span class="ra-bar" aria-hidden="true"><i class="ra-bar-${tone}" style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i>${due != null ? `<b style="left:${Math.min(100, due)}%"></b>` : ''}</span>`;
    const seg = (items, cur, attr, label) => `<div class="ra-seg" role="tablist" aria-label="${esc(label)}">${items.map(([k, t]) => `<button type="button" role="tab" aria-selected="${cur === k}" class="${cur === k ? 'is-on' : ''}" data-${attr}="${k}">${t}</button>`).join('')}</div>`;

    // =====================================================================================
    // EKRANLAR
    // =====================================================================================
    function teamToday(leads) {
        return MGRS().map(m => {
            const sales = g('getManagerSalesForPeriod') ? getManagerSalesForPeriod(m.id, 'kunlik') : 0;
            const deals = g('getManagerDealsCount') ? getManagerDealsCount(m.id, 'kunlik') : 0;
            const calls = callsToday(leads, m.id);
            const stale = leads.filter(l => String(l.managerId) === String(m.id) && staleOf(l)).length;
            return { ...m, sales, deals, calls, stale, goal: ruleFor(m._lang).callsPerDay };
        });
    }

    function screenHome() {
        const u = user(), now = new Date(), d = ropHome();
        const leads = ALL();
        const sales = d?.teamSales || 0, target = d?.teamTarget || 0;
        const pc = g('kbxPace') ? kbxPace(sales, target, now) : { daysLeft: 1, forecast: sales, perDay: 0 };
        const pct = target > 0 ? Math.round(sales / target * 100) : null;
        const C = 226;
        const deals = g('getManagerDealsCount') ? MGRS().reduce((a, m) => a + getManagerDealsCount(m.id, 'oylik'), 0) : 0;
        // Hozir hal qiling
        const un = leads.filter(l => !l.managerId && OPEN.has(st(l)));
        const oldestUn = un.reduce((m, l) => Math.min(m, createdAt(l) || Date.now()), Date.now());
        const sla = d?.open || [];
        const slaSoon = sla.map(a => a.time + DAY - Date.now()).filter(x => x > 0).sort((a, b) => a - b)[0];
        const apN = pendingAp().length;
        const t0 = tToday(), t1 = addDays(t0, 1);
        const noT = trialRows().filter(x => needsTeacher(x.ph) && x.at && x.at.date <= t1).sort((a, b) => a.at.ms - b.at.ms);
        const cats = [un.length, apN, sla.length, noT.length];
        const tile = (go, icon, tone, n, title, sub, subTone, hot) => `<button type="button" class="ra-act${hot ? ' is-hot' : ''}" ${go}><span class="ra-act-h"><span class="ra-act-i sa-tone-${tone}">${ic(icon, 18, 2.2)}</span><strong>${n}</strong></span><strong class="ra-act-t">${title}</strong><span class="ra-act-s${subTone ? ' is-' + subTone : ''}">${esc(sub)}</span></button>`;
        const team = teamToday(leads).sort((a, b) => b.sales - a.sales || b.calls - a.calls);
        const greet = now.getHours() < 12 ? 'Xayrli tong' : now.getHours() < 18 ? 'Xayrli kun' : 'Xayrli kech';
        return `
        <header class="sa-top">
          <button type="button" class="sa-me ra-me" data-ra-nav="menu" aria-label="Profil va menyu">${staffImg(u.linkedEmployeeId || u.id, u.name, 46)}<i></i></button>
          <div class="sa-top-t"><span>${WD[now.getDay()]}, ${now.getDate()}-${MON[now.getMonth()]} · <strong class="ra-role">ROP · ${esc(langsTxt())}</strong></span><h1>${greet}, ${esc(firstName(u.name))}</h1></div>
          ${bell()}
        </header>
        <div class="sa-body sa-stagger">
          ${window.davomat ? davomat.homeCard() : ''}
          <button type="button" class="ra-hero" data-ra-nav="team">
            <span class="ra-hero-r">
              <span class="ra-ring"><svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label="Jamoa rejasi ${pct ?? 0}% bajarildi"><circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="9"/><circle class="sa-ring-v" cx="42" cy="42" r="36" fill="none" stroke="#3B8BEE" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${Math.round(C - C * Math.min(100, pct || 0) / 100)}" transform="rotate(-90 42 42)" style="--off:${Math.round(C - C * Math.min(100, pct || 0) / 100)};--c:${C}"/></svg><span><strong>${pct == null ? '—' : pct + '%'}</strong><em>reja</em></span></span>
              <span class="ra-hero-t"><span class="ra-eyebrow">JAMOA REJASI · ${MON[now.getMonth()].toUpperCase()}</span>
                <span class="ra-hero-v"><strong>${mlnF(sales)}</strong>${target ? `<em>/ ${mln(target)}</em>` : '<em>reja belgilanmagan</em>'}</span>
                <span class="ra-hero-s">${deals} toʻlov${deals ? ' · oʻrtacha chek ' + num(Math.round(sales / deals)) : ''}</span></span>
            </span>
            <span class="ra-hero-tiles">
              <span><em>Kuniga kerak</em><strong>${target ? (pc.perDay ? mlnF(pc.perDay) : 'Bajarildi') : '—'}</strong></span>
              <span><em>Prognoz</em><strong class="is-gold">${mln(pc.forecast)}</strong></span>
              <span><em>Bugun bilan</em><strong>${pc.daysLeft} kun</strong></span>
            </span>
          </button>
          <section class="sa-sec" aria-label="Hozir hal qiling">
            <div class="sa-sec-h"><h2>Hozir hal qiling</h2>${cats.some(Boolean) ? `<span class="ra-sec-red">${cats.filter(Boolean).length} toifa · ${cats.reduce((a, b) => a + b, 0)} ta</span>` : '<span class="sa-sec-note">hammasi joyida</span>'}</div>
            <div class="ra-acts">
              ${tile('data-ra-go="distribute"', 'userplus', 'red', un.length, 'Biriktirilmagan lid', un.length ? `Eng eskisi ${dur(Date.now() - oldestUn)} kutyapti` : 'Hammasi biriktirilgan', un.length ? 'red' : '', un.length > 0)}
              ${tile('data-ra-go="approvals"', 'approve', 'blue', S.ap ? apN : '…', 'Tasdiq kutmoqda', S.ap?.err ? 'Yuklab boʻlmadi' : 'Toʻlov, tarif, ustoz', '')}
              ${tile('data-ra-go="sla"', 'clock', 'amber', sla.length, 'SLA oʻtgan lid', sla.length ? (slaSoon != null ? `1 tasi ${dur(slaSoon)}da adminga` : `${d.lateCount} tasi adminga ketdi`) : 'Kechikish yoʻq', sla.length ? 'amber' : '')}
              ${tile('data-ra-nav="trials"', 'cal', 'purple', noT.length, 'Sinov ustozsiz', noT[0] ? `${noT[0].at.date === t0 ? 'Bugun' : 'Ertaga'} ${hmm(noT[0].at.min)} · ${shortName(noT[0].lead.name)}` : 'Hammasiga ustoz bor', '')}
            </div>
          </section>
          <section class="sa-sec" aria-label="Jamoa bugun">
            <div class="sa-sec-h"><h2>Jamoa bugun</h2><button type="button" class="sa-link" data-ra-nav="team">Hammasi · ${team.length}</button></div>
            ${team.length ? `<div class="sa-card ra-list">${team.slice(0, 3).map(m => {
                const p = Math.min(100, Math.round(m.calls / Math.max(1, m.goal) * 100));
                const tone = m.stale ? 'amber' : 'blue';
                return `<button type="button" class="ra-mrow" data-ra-mgr="${esc(m.id)}"><span class="ra-av-dot">${staffImg(m.id, m.name, 40)}<i class="is-${m.calls ? 'green' : 'gray'}"></i></span>
                  <span class="ra-mrow-t"><span class="ra-mrow-h"><strong>${esc(firstName(m.name))}</strong><strong class="sa-num">${mlnF(m.sales)}</strong></span>${bar(p, tone)}<span class="ra-mrow-s">${m.calls} / ${m.goal} qoʻngʻiroq · ${m.deals} toʻlov${m.stale ? ` · ${m.stale} ta qotgan lid` : ''}</span></span></button>`;
            }).join('')}</div>` : '<div class="sa-card sa-muted-card">Bu yoʻnalishda faol sotuv menejeri yoʻq</div>'}
          </section>
        </div>`;
    }

    // ---------- Lidlar ----------
    const STAGE_HINT = {
        'yangi-lidlar': 'Biriktirilgan, hali qoʻngʻiroq yoʻq', 'boglanishga-urinilmoqda': 'Eng uzoq turganlar birinchi', 'boglanildi': 'Anketa toʻldirilgan',
        'sinov-darsida': 'Sinov vaqti boʻyicha', 'qaror-jarayonida': 'Kelishilgan qoʻngʻiroq boʻyicha', 'keyin-sotib-olmoqchi': 'Kelishilgan sana boʻyicha',
        'tolov-jarayonida': 'Kutilayotgan summa', 'tolov-yopildi': 'Shu oy', 'muvaffaqiyatsiz-sotuv': 'Sabab bilan · shu oy', 'sifatsiz-lidlar': 'Shu oy'
    };
    const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const closedAt = l => parseT(l.paymentClosedSurvey?.closedDate) || parseT(l.closedDate) || parseT(l.slaStageEnteredAt) || parseT(l.statusChangedAt) || parseT(l.updatedAt) || createdAt(l);
    function badge(l) {
        const s = st(l), now = Date.now();
        if (!l.managerId && OPEN.has(s)) { const a = createdAt(l); return { text: 'Biriktirilmagan' + (a ? ' · ' + dur(now - a) : ''), tone: 'red', sort: 0 }; }
        const f = g('getLeadNextFollowUp') ? getLeadNextFollowUp(l, now) : null;
        const sk = staleOf(l);
        if (sk) return { text: `${sk.d}-kun · ${sk.lock ? 'qulf' : sk.d === sk.r.lockDays - 1 ? 'ertaga qulf' : 'ogohlantirildi'}`, tone: sk.lock ? 'red' : 'amber', sort: sk.lock ? 0 : 1, t: -sk.d };
        if (f) return { text: (f.overdue ? 'Qoʻngʻiroq kechikdi · ' : '') + when(f.at), tone: f.overdue ? 'red' : 'blue', sort: f.overdue ? 0 : 2, t: f.at };
        if (s === 'yangi-lidlar') { const a = assignedAt(l); const calls = callsOf(l).length; return { text: dur(now - (a || now)) + (calls ? '' : ' · qoʻngʻiroq yoʻq'), tone: a && now - a > 30 * MIN && !calls ? 'red' : 'gray', sort: 1, t: a || 0 }; }
        if (s === 'sinov-darsida') { const r = W()?.request(l); const t = parseT(r?.scheduledAt || l.trialLessonAt); const ph = W() ? W().phase(r || {}, { leadStatus: l.status, durationMin: W().durationOf(l) }) : '';
            if (W()?.isCancelled?.(l)) return { text: 'Sinov bekor qilindi · qayta qoʻyish', tone: 'amber', sort: 1, t: t || 0 };
            if (needsTeacher(ph)) return { text: (t ? when(t) + ' · ' : '') + 'ustozsiz', tone: 'red', sort: 0, t: t || 0 };
            if (ph === 'result' || ph === 'overdue') return { text: 'Natija kiritilmagan', tone: 'red', sort: 0, t: t || 0 };
            if (t) return { text: when(t), tone: ph === 'pending' ? 'amber' : 'green', sort: 2, t }; }
        if (s === 'tolov-jarayonida') { const p = l.paymentSurvey || {}; const v = p.debtAmount || p.amount || p.totalAmount; if (v) return { text: num(v) + ' kutilmoqda', tone: 'amber', sort: 3, t: 0 }; }
        if (s === 'tolov-yopildi') { const v = l.paymentClosedSurvey?.actualAmount || l.paymentClosedSurvey?.totalAmount || l.paymentSurvey?.totalAmount; const t = closedAt(l); return { text: (v ? num(v) + ' · ' : '') + (t ? shortDate(t) : 'yopildi'), tone: 'green', sort: 5, t: -(t || 0) }; }
        if (s === 'muvaffaqiyatsiz-sotuv' || s === 'sifatsiz-lidlar') { const t = closedAt(l); return { text: t ? shortDate(t) : colLabel(s), tone: 'gray', sort: 6, t: -(t || 0) }; }
        const since = parseT(l.slaStageEnteredAt) || assignedAt(l);
        const r = slaRule(l);
        const late = r && since && Date.now() - since >= r.after * MIN;
        return { text: since ? durLong(Date.now() - since) + (late ? ' · SLA ' + ruleTxt(r.after) : '') : colLabel(s), tone: late ? 'red' : 'blue', sort: late ? 0 : 4, t: since || 0 };
    }
    function metaLine(l) {
        const s = st(l), parts = [];
        if (s === 'boglanishga-urinilmoqda' || s === 'yangi-lidlar') { const n = callsOf(l).length; if (n) parts.push(`${n} urinish${neverConnected(l) ? ' · hech javob bermagan' : ''}`); }
        if (s === 'sinov-darsida') { const r = W()?.request(l); const tn = person(r?.teacherId)?.name; parts.push(tn ? 'Ustoz ' + firstName(tn) : 'Ustoz yoʻq'); }
        if (s === 'boglanildi' && window.leadWorkflow?.hasCombinedSurvey?.(l)) parts.push('Anketa ✓');
        if (s === 'muvaffaqiyatsiz-sotuv' && l.failedSaleReason?.label) parts.push('Sabab: ' + l.failedSaleReason.label);
        if (s === 'sifatsiz-lidlar' && l.sifatsizReason?.label) parts.push('Sabab: ' + l.sifatsizReason.label);
        if (!parts.length || parts.length < 2) { parts.push(kindLabel(l)); const src = srcLabel(l); if (src && src !== kindLabel(l)) parts.push(src); }
        if (LANGS().length > 1) parts.push(l._lang === 'russian' ? 'RU' : 'EN');
        return parts.filter(Boolean).join(' · ');
    }
    function screenLeads() {
        const all = ALL();
        const un = all.filter(l => !l.managerId && OPEN.has(st(l)));
        const q = S.q.trim(), qd = q.replace(/^#/, '').toLowerCase();
        const match = l => !q || (g('leadMatchesSearch') ? leadMatchesSearch(l, q) : String(l.name + ' ' + l.phone).toLowerCase().includes(qd)) || (qd && String(l.serialCode || l.serialNumber || '').toLowerCase().includes(qd));
        const ms = monthStart();
        const inScope = l => !CLOSED.has(st(l)) || (closedAt(l) || 0) >= ms;
        const manOk = l => S.man === 'all' || (S.man === 'none' ? !l.managerId : String(l.managerId) === String(S.man));
        const pool = all.filter(l => manOk(l) && match(l) && (q || inScope(l)));
        const ids = COLS().map(c => c.id);
        const counts = Object.fromEntries(ids.map(id => [id, pool.filter(l => st(l) === id).length]));
        const rows = (q ? pool : pool.filter(l => st(l) === S.stage)).map(l => ({ l, b: badge(l) })).sort((a, b) => a.b.sort - b.b.sort || (a.b.t || 0) - (b.b.t || 0));
        const red = rows.filter(r => r.b.tone === 'red').length;
        const mans = MGRS();
        let hint = STAGE_HINT[S.stage] || '';
        if (S.stage === 'tolov-jarayonida') hint += ' · ' + mln(rows.reduce((a, r) => a + (Number(r.l.paymentSurvey?.debtAmount || r.l.paymentSurvey?.amount || 0) || 0), 0));
        if (S.stage === 'tolov-yopildi') hint += ' · ' + mln(rows.reduce((a, r) => a + (Number(r.l.paymentClosedSurvey?.actualAmount || r.l.paymentSurvey?.totalAmount || 0) || 0), 0));
        return `
        <header class="sa-top sa-top--leads">
          <div class="sa-top-row"><h1>Lidlar <em>${all.length}</em></h1>
            <button type="button" class="ra-dist-btn" data-ra-go="distribute">Taqsimlash${un.length ? `<b>${un.length > 99 ? '99+' : un.length}</b>` : ''}</button>
            <button type="button" class="sa-icon-btn ra-add" data-ra-leadadd aria-haspopup="dialog" aria-label="Lid qoʻshish">${ic('plus', 20, 2.6)}</button></div>
          <label class="sa-search">${ic('search', 18)}<span class="sa-sr">Lid qidirish</span><input type="search" id="raLeadSearch" placeholder="Ism, telefon yoki ID" value="${esc(S.q)}" autocomplete="off">${S.q ? `<button type="button" class="sa-icon-btn sa-ghost sa-sm" data-ra-clearq aria-label="Qidiruvni tozalash">${ic('close', 16, 2.4)}</button>` : ''}</label>
          <div class="sa-chips ra-mans" role="radiogroup" aria-label="Menejer">
            <button type="button" role="radio" aria-checked="${S.man === 'all'}" class="ra-man${S.man === 'all' ? ' is-on' : ''}" data-ra-man="all">Hammasi</button>
            ${un.length ? `<button type="button" role="radio" aria-checked="${S.man === 'none'}" class="ra-man${S.man === 'none' ? ' is-on' : ''}" data-ra-man="none">Biriktirilmagan</button>` : ''}
            ${mans.map(m => `<button type="button" role="radio" aria-checked="${String(S.man) === String(m.id)}" class="ra-man has-img${String(S.man) === String(m.id) ? ' is-on' : ''}" data-ra-man="${esc(m.id)}">${staffImg(m.id, m.name, 28)}${esc(firstName(m.name))}</button>`).join('')}
          </div>
          ${q ? `<div class="sa-q-info">${rows.length ? `${rows.length} ta lid topildi` : 'Hech narsa topilmadi'}</div>` : `<div class="sa-chips" role="tablist" aria-label="Bosqichlar">${ids.map(id => `<button type="button" role="tab" aria-selected="${id === S.stage}" class="sa-chip${id === S.stage ? ' is-on' : ''}" data-ra-stage="${id}">${esc(SHORT[id] || colLabel(id))}<b>${counts[id] || 0}</b></button>`).join('')}</div>`}
        </header>
        ${q ? '' : `<div class="sa-hint"><span>${rows.length ? esc(hint) : 'Bu menejerda shu bosqichda lid yoʻq'}</span><span>${red ? `<b>${red} tasi</b> kechikkan` : ''}</span></div>`}
        <div class="sa-body sa-rows">
          ${rows.length ? rows.map(({ l, b }, i) => `
            <button type="button" class="sa-lrow ra-lrow" style="--i:${Math.min(i, 10)}" data-ra-lead="${esc(l.id)}" data-ll="${l._lang}">
              <span class="sa-row-t"><strong>${esc(l.name || 'Nomaʼlum')}</strong><span>${q ? esc(SHORT[st(l)] || '') + ' · ' : ''}${esc(metaLine(l))}</span>${pill(b.text, b.tone)}</span>
              <span class="ra-lrow-m">${l.managerId ? staffImg(l.managerId, mgrName(l.managerId), 34) : `<span class="ra-noman">${ic('userplus', 16, 2.2)}</span>`}<em>${esc(l.managerId ? firstName(mgrName(l.managerId)) || 'Menejer' : 'yoʻq')}</em></span>
            </button>`).join('') : empty('board', q ? 'Topilmadi' : `“${SHORT[S.stage] || colLabel(S.stage)}” bosqichi boʻsh`, q ? 'Ism yoki raqamni tekshirib koʻring' : 'Bu bosqichda hozircha lid yoʻq')}
          <p class="sa-foot">Kartani oching → menejerni almashtirish yoki bosqichni tuzatish</p>
        </div>`;
    }

    // ---------- Lid kartasi ----------
    function stepper(l) {
        const s = st(l);
        const at = s === 'keyin-sotib-olmoqchi' ? PATH.indexOf('qaror-jarayonida') : PATH.indexOf(s);
        const closed = s === 'muvaffaqiyatsiz-sotuv' || s === 'sifatsiz-lidlar';
        const calls = callsOf(l).length;
        const right = s === 'boglanishga-urinilmoqda' || s === 'yangi-lidlar' ? `${calls} urinish${calls && neverConnected(l) ? ' · hech javob yoʻq' : ''}` : (at >= 0 && at < PATH.length - 1 && !closed ? 'keyingi: ' + colLabel(PATH[at + 1]) : '');
        return `<div class="sa-steps" role="img" aria-label="Bosqich: ${esc(colLabel(s))}"><div class="sa-steps-bar">${PATH.map((id, i) => `<span class="${closed ? 'is-closed' : i <= at ? 'is-done' : ''}"></span>`).join('')}</div>
          <div class="sa-steps-t"><b class="${closed ? 'is-red' : ''}">${esc(colLabel(s))}</b>${right ? `<span>${esc(right)}</span>` : ''}</div></div>`;
    }
    const relTime = html => html.replace(/<time class="lead-comment-time" datetime="([^"]*)">([^<]*)<\/time>/, (m, iso, txt) => { const t = parseT(iso.replace(/&amp;/g, '&')); return t ? `<time class="lead-comment-time" datetime="${iso}" title="${txt}">${esc(when(t))}</time>` : m; });
    function screenCard() {
        const l = leadById(S.lead, S.leadLang);
        if (!l) return `${crumb('Lid')}<div class="sa-body">${empty('board', 'Lid topilmadi', 'Oʻchirilgan yoki boshqa yoʻnalishga oʻtgan boʻlishi mumkin')}</div>`;
        const s = st(l), ph = telOf(l.phone);
        const mName = l.managerId ? mgrName(l.managerId) : '';
        const sk = staleOf(l);
        const b = badge(l);
        const alerts = g('getLeadSlaCardAlerts') ? (getLeadSlaCardAlerts(l, l._lang) || []).filter(a => a.audience === 'rop') : [];
        const cs = comments(l).sort((a, c) => (parseT(c.createdAt) || 0) - (parseT(a.createdAt) || 0));
        const item = typeof window.renderLeadCommentItem === 'function' ? window.renderLeadCommentItem : null;
        const tg = l.managerId ? mgrTg(l.managerId) : '';
        return `
        ${crumb('Lidlar · ' + (SHORT[s] || colLabel(s)), `<button type="button" class="sa-icon-btn sa-ghost" data-ra-cardmore="${esc(l.id)}" aria-label="Boshqa amallar" aria-haspopup="dialog">${ic('dots', 22, 2.4)}</button>`)}
        <div class="sa-body sa-card-page">
          <section class="sa-lead-hero">
            <div class="sa-lead-id">${avatar(l.name, 60)}<div><h2>${esc(l.name || 'Nomaʼlum')}</h2>${ph ? `<a class="sa-phone" href="tel:${esc(ph)}">${esc(g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone) : l.phone)}</a>` : ''}
              <div class="sa-tags">${pill(kindLabel(l), 'blue')}${pill(langLabel(l._lang), 'gray')}${sk ? pill(`${sk.d}-kun · ${sk.lock ? 'menejer qulflangan' : 'ogohlantirilgan'}`, sk.lock ? 'red' : 'amber') : b.tone === 'red' ? pill(b.text, 'red') : ''}</div></div></div>
            <div class="ra-mbox">${l.managerId ? staffImg(l.managerId, mName, 40) : `<span class="ra-noman ra-noman--l">${ic('userplus', 18, 2.2)}</span>`}
              <span class="ra-mbox-t"><em>Menejer</em><strong>${l.managerId ? esc(firstName(mName) || 'Menejer') + (parseT(l.managerAssignedAt) ? ` · ${new Date(parseT(l.managerAssignedAt)).getDate()}-${MON[new Date(parseT(l.managerAssignedAt)).getMonth()]} berildi` : '') : 'Biriktirilmagan'}</strong></span>
              <button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-reassign="${esc(l.id)}">${l.managerId ? 'Almashtirish' : 'Biriktirish'}</button></div>
            ${stepper(l)}
            <div class="sa-qa ra-qa3">
              ${ph ? `<a class="sa-qa-b" href="tel:${esc(ph)}">${ic('phone', 20, 2.2)}Oʻzim qoʻngʻiroq</a>` : `<span class="sa-qa-b is-off">${ic('phone')}Raqam yoʻq</span>`}
              ${tg ? `<a class="sa-qa-b" href="${esc(tg)}" target="_blank" rel="noopener">${ic('tg')}${esc(firstName(mName))}ga yozish</a>` : `<button type="button" class="sa-qa-b" data-ra-tglead="${esc(l.id)}">${ic('tg')}Telegram</button>`}
              <button type="button" class="sa-qa-b" data-ra-hist>${ic('redo')}Urinishlar · ${callsOf(l).length}</button>
            </div>
          </section>
          ${sk?.lock ? `<div class="ra-warnbox">${ic('warn', 20, 2.2)}<span><strong>${esc(firstName(mName))}ning ilovasi bu lid boʻyicha qulflangan.</strong> U qayta qoʻngʻiroq qilib, “Sifatsiz”ga oʻtkazishi kerak. Qulf faqat menejerga — siz istalgan amalni qila olasiz.</span></div>` : ''}
          ${alerts.length ? `<button type="button" class="sa-alert" data-ra-notify="${esc(l.id)}">${ic('clock', 18, 2.2)}<span>${esc(alerts[0].message || alerts[0].title || 'SLA oʻtdi')}</span><b>Koʻrildi</b></button>` : ''}
          <h3 class="sa-h3" id="raHist">Tarix · ${cs.length}</h3>
          ${cs.length ? `<div class="sa-hist">${cs.map(c => item ? relTime(item(c)) : `<div class="lead-comment-item"><div class="lead-comment-text">${esc(c.text)}</div></div>`).join('')}</div>` : '<p class="sa-muted">Hali izoh yoʻq</p>'}
        </div>
        <div class="sa-bar"><button type="button" class="sa-btn sa-btn--outline" data-ra-stagesheet="${esc(l.id)}">Bosqichni oʻzgartirish${ic('down', 16, 2.4)}</button></div>`;
    }

    // ---------- Taqsimlash ----------
    function screenDistribute() {
        const all = ALL(), now = Date.now(), k = dayKey(now);
        const un = all.filter(l => !l.managerId && OPEN.has(st(l))).sort((a, b) => (createdAt(a) || 0) - (createdAt(b) || 0));
        S.sel.forEach(id => { if (!un.some(l => l.id === id)) S.sel.delete(id); });
        const came = all.filter(l => createdAt(l) && dayKey(createdAt(l)) === k).length;
        const given = all.filter(l => l.managerId && parseT(l.managerAssignedAt) && dayKey(parseT(l.managerAssignedAt)) === k).length;
        const late = un.filter(l => now - (createdAt(l) || now) > 30 * MIN).length;
        const sel = un.filter(l => S.sel.has(l.id));
        const plan = evenPlan(sel.length ? sel : []);
        const per = {}; plan.forEach(p => { per[p.managerId] = (per[p.managerId] || 0) + 1; });
        const hintTo = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id, n]) => `${firstName(mgrName(id))} +${n}`).join(', ');
        const age = l => now - (createdAt(l) || now);
        return `
        <header class="sa-top sa-top--page ra-top ra-top--tall">
          <div class="ra-top-r"><button type="button" class="sa-icon-btn sa-ghost" data-ra-back aria-label="Orqaga">${ic('back', 22, 2.2)}</button><div class="sa-top-t"><h1>Taqsimlash</h1><span>${un.length} ta biriktirilmagan · ${esc(langsTxt())}</span></div>
            <button type="button" class="ra-addlead" data-ra-leadadd>${ic('plus', 16, 2.6)}Lid qoʻshish</button></div>
          <div class="ra-stats3"><span><em>Bugun keldi</em><strong>${came}</strong></span><span><em>Biriktirildi</em><strong>${given}</strong></span><span class="${late ? 'is-red' : ''}"><em>30 daqdan oshdi</em><strong>${late}</strong></span></div>
        </header>
        <div class="sa-body ra-dist">
          ${un.length ? `<div class="ra-selall"><label class="ra-chk"><input type="checkbox" data-ra-selall ${sel.length && sel.length === un.length ? 'checked' : ''}><span></span>Hammasini belgilash</label><span>${sel.length ? `${sel.length} ta tanlandi` : ''}</span></div>
          ${un.map((l, i) => { const a = age(l); const on = S.sel.has(l.id); return `<label class="ra-drow${on ? ' is-on' : ''}" style="--i:${Math.min(i, 10)}"><input type="checkbox" class="ra-chk-in" data-ra-pick="${esc(l.id)}" ${on ? 'checked' : ''}><span class="ra-chk-b" aria-hidden="true">${ic('check', 16, 3)}</span>
            <span class="sa-row-t"><strong>${esc(l.name || 'Nomaʼlum')}</strong><span>${esc([kindLabel(l), srcLabel(l) !== kindLabel(l) ? srcLabel(l) : '', LANGS().length > 1 ? langLabel(l._lang) : ''].filter(Boolean).join(' · '))}</span></span>
            ${pill(dur(a), a > 30 * MIN ? 'red' : a > 15 * MIN ? 'amber' : 'gray')}</label>`; }).join('')}`
            : empty('board', 'Hammasi biriktirilgan', 'Yangi lid kelishi bilan shu yerda chiqadi')}
        </div>
        ${un.length ? `<div class="sa-bar ra-dist-bar"><div class="ra-dist-btns"><button type="button" class="sa-btn sa-btn--outline" data-ra-even ${sel.length ? '' : 'disabled'}>${ic('shuffle', 18, 2.2)}Teng · ${sel.length} tasini</button><button type="button" class="sa-btn sa-btn--primary" data-ra-assignsheet ${sel.length ? '' : 'disabled'}>Menejerga berish · ${sel.length}</button></div>
          <p class="ra-bar-note">${sel.length ? `Teng: har lid eng kam ochiq lidi borga → hozir ${esc(hintTo || '—')}` : 'Lidlarni belgilang'}</p></div>` : ''}`;
    }
    // Teng taqsimlash — mavjud planEvenLeadSplit + leadLoadByManager (har til alohida).
    function evenPlan(leads) {
        const out = [];
        for (const lg of LANGS()) {
            const ls = leads.filter(l => l._lang === lg); if (!ls.length) continue;
            const ms = assignMgrs(lg).map(m => m.id);
            if (!ms.length) continue;
            const load = g('leadLoadByManager') ? leadLoadByManager((leadsAll()[lg] || []).filter(l => l && !l.deletedAt), ms) : {};
            const plan = g('planEvenLeadSplit') ? planEvenLeadSplit(ls.map(l => l.id), ms, load) : [];
            plan.forEach(p => out.push({ ...p, lang: lg }));
        }
        return out;
    }

    // ---------- SLA ----------
    function screenSla() {
        const d = ropHome();
        const list = (d?.open || []).map(a => { const l = leadById(a.leadId, a.leadLang); return l ? { a, l, left: a.time + DAY - Date.now() } : null; }).filter(Boolean).sort((x, y) => x.left - y.left);
        const gone = list.filter(x => x.left <= 0), soon = list.filter(x => x.left > 0 && x.left < 6 * 3600000), rest = list.filter(x => x.left >= 6 * 3600000);
        const R = typeof LEAD_SLA_RULES !== 'undefined' ? LEAD_SLA_RULES : {};
        const ruleLine = [['yangi-lidlar', 'Yangi lid'], ['boglanishga-urinilmoqda', 'Urinilmoqda'], ['boglanildi', 'Bogʻlanildi'], ['sinov-darsida', 'Sinovdan keyin'], ['qaror-jarayonida', 'Qaror'], ['tolov-jarayonida', 'Toʻlov']]
            .filter(([k]) => R[k]?.rop).map(([k, t]) => `${t} — ${ruleTxt(R[k].rop.after)}`).join(' · ');
        // Menejersiz lidni "ko'rib qo'yish" foydasiz — uni biriktirish kerak (Taqsimlash).
        const ackBtn = (a, l, small) => (!l.managerId
            ? `<button type="button" class="sa-btn ${small ? 'sa-btn--outline sa-btn--sm' : 'sa-btn--primary'}" data-ra-go="distribute">Biriktirish</button>`
            : `<button type="button" class="sa-btn ${small ? 'sa-btn--outline sa-btn--sm' : 'sa-btn--primary'}" data-ra-ack="${esc(a.leadId)}" data-ll="${a.leadLang}">Koʻrildi</button>`);
        const card = ({ a, l, left }, big) => {
            const m = mgrName(l.managerId), r = slaRule(l), since = Date.now() - (a.time - (r?.after || 0) * MIN);
            const tg = l.managerId ? mgrTg(l.managerId) : '';
            const sub = `${firstName(m) || 'Menejersiz'} · ${SHORT[st(l)] || colLabel(st(l))}`;
            const lt = left > 0 ? dur(left) : 'adminga ketdi';
            if (!big) return `<article class="sa-card ra-sla ra-sla--s">${staffImg(l.managerId, m, 40)}<span class="sa-row-t"><button type="button" class="ra-link-t" data-ra-lead="${esc(l.id)}" data-ll="${l._lang}"><strong>${esc(l.name)}</strong></button><span>${esc(sub)}</span><em class="is-red">${esc(durLong(since))} · qoida ${esc(ruleTxt(r?.after || 0))}</em></span>${ackBtn(a, l, true)}</article>`;
            return `<article class="sa-card ra-sla${left < 6 * 3600000 ? ' is-hot' : ''}"><div class="ra-sla-h">${staffImg(l.managerId, m, 40)}<span class="sa-row-t"><button type="button" class="ra-link-t" data-ra-lead="${esc(l.id)}" data-ll="${l._lang}"><strong>${esc(l.name)}</strong></button><span>${esc(sub)}</span></span>${pill(lt, left < 6 * 3600000 ? 'redsolid' : 'amber')}</div>
              <div class="ra-sla-p">${pill('Qoida: ' + ruleTxt(r?.after || 0), 'gray')}${pill('Turibdi: ' + durLong(since), 'red')}</div>
              <div class="ra-sla-a">${tg ? `<a class="sa-btn sa-btn--outline" href="${esc(tg)}" target="_blank" rel="noopener">${ic('tg', 16, 2.2)}${esc(firstName(m))}ga yozish</a>` : ''}${ackBtn(a, l, false)}</div></article>`;
        };
        return `
        ${topBack('SLA oʻtgan lidlar', `${list.length} ta · “Koʻrildi” bosilmasa 24 soatda adminga oʻtadi`)}
        <div class="sa-body sa-stagger">
          ${gone.length ? `<h3 class="sa-h3 is-red">ADMINGA OʻTGAN · ${gone.length}</h3>${gone.map(x => card(x, true)).join('')}` : ''}
          ${soon.length ? `<h3 class="sa-h3 is-red">ADMINGA OʻTISHIGA OZ QOLDI</h3>${soon.map(x => card(x, true)).join('')}` : ''}
          ${rest.length ? `<h3 class="sa-h3">BOSHQALAR · ADMINGACHA 6 SOATDAN KOʻP</h3>${rest.map((x, i) => card(x, i < 1)).join('')}` : ''}
          ${!list.length ? empty('board', 'SLA oʻtgan lid yoʻq', 'Barcha menejerlar oʻz vaqtida ishlayapti') : ''}
          <div class="ra-rules-card"><strong>Qachon sizga keladi</strong><span>${esc(ruleLine)}</span></div>
        </div>`;
    }
    function ackSla(id, lg) {
        const l = leadById(id, lg); if (!l) return;
        if (!once('ack:' + id)) return;
        root?.querySelectorAll(`[data-ra-ack="${CSS.escape(id)}"], [data-ra-notify="${CSS.escape(id)}"]`).forEach(b => { b.disabled = true; });
        const alerts = g('getLeadSlaCardAlerts') ? getLeadSlaCardAlerts(l, l._lang).filter(a => a.audience === 'rop') : [];
        const a = alerts[0];
        if (!a || !g('updateLeadInStorage')) { if (g('openLeadNotifyModal')) openLeadNotifyModal(l._lang, id); return; }
        // openLeadNotifyModal'dagi "Ko'rib chiqildi" bilan bir xil yozuv (slaRopAcknowledged[stageKey]).
        const saved = updateLeadInStorage(l._lang, id, x => ({ ...x, slaRopAcknowledged: { ...(x.slaRopAcknowledged || {}), [a.stageKey]: new Date().toISOString() } }));
        if (!saved) { toast('Saqlab boʻlmadi', 'warn'); return; }
        if (g('markLeadSlaAlertsRead')) markLeadSlaAlertsRead(alerts);
        if (g('renderNotificationPanel')) renderNotificationPanel();
        toast(`${l.name} — koʻrildi, adminga oʻtmaydi`, 'ok');
        render(false);
    }

    // ---------- Tasdiqlar ----------
    const KIND = { payment: ['TOʻLOV', 'green', 'card'], tariff: ['TARIF', 'blue', 'tag'], teacher: ['USTOZ ALMASHTIRISH', 'purple', 'swap'] };
    const DOW = ['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const studentOf = r => (window.schoolUI?.studentById ? window.schoolUI.studentById(r.student_id) : null) || {};
    const tName = id => (window.schoolUI?.teacherName ? window.schoolUI.teacherName(id) : person(id)?.name) || '—';
    const fmtD = v => { const t = parseT(v); return t ? `${new Date(t).getDate()}-${MON[new Date(t).getMonth()]}` : String(v || '—'); };
    const sched = (day, time) => [window.schoolUI?.pattern ? window.schoolUI.pattern(day) : DOW[Number(day)] || '', time].filter(Boolean).join(' ');
    function apRows(r) {
        const s = studentOf(r), ch = r.changes || {}, out = [];
        if (r.kind === 'teacher') {
            out.push(['Ustoz', shortName(tName(s.teacherId)), shortName(tName(ch.teacherId))]);
            if (ch.lessonTime || ch.lessonDay != null) out.push(['Dars vaqti', sched(s.lessonDayOfWeek, s.lessonTime), sched(ch.lessonDay ?? s.lessonDayOfWeek, ch.lessonTime || s.lessonTime)]);
            if (ch.from) out.push(['Qachondan', '', fmtD(ch.from)]);
        } else if (r.kind === 'tariff') {
            if ('monthlyPrice' in ch) out.push(['Narx', s.monthlyPrice ? num(s.monthlyPrice) : '—', num(ch.monthlyPrice)]);
            if ('lessonDuration' in ch) out.push(['Davomiylik', s.lessonDuration ? s.lessonDuration + ' daq' : '—', ch.lessonDuration + ' daq']);
            if ('tariff' in ch) out.push(['Tarif', s.tariff || '—', ch.tariff]);
            if ('lessonTime' in ch || 'lessonDay' in ch) out.push(['Dars vaqti', sched(s.lessonDayOfWeek, s.lessonTime), sched(ch.lessonDay ?? s.lessonDayOfWeek, ch.lessonTime || s.lessonTime)]);
            if (ch.effectiveFrom) out.push(['Qachondan', '', fmtD(ch.effectiveFrom)]);
        } else {
            const L = { amount: 'Summa', paidAmount: 'Toʻlangan', totalAmount: 'Jami', months: 'Davr', period: 'Davr', nextPaymentDate: 'Keyingi toʻlov', paymentDueDate: 'Keyingi toʻlov', method: 'Usul', date: 'Sana', summary: 'Izoh' };
            Object.keys(ch).filter(k => L[k] && ch[k] != null && typeof ch[k] !== 'object').forEach(k => {
                const v = ch[k]; const nv = /amount/i.test(k) ? num(v) : /date/i.test(k) ? fmtD(v) : k === 'months' ? v + ' oy' : String(v);
                const ov = s[k] != null && s[k] !== '' ? (/amount/i.test(k) ? num(s[k]) : /date/i.test(k) ? fmtD(s[k]) : String(s[k])) : '';
                out.push([L[k], ov, nv]);
            });
        }
        return out;
    }
    const apSummary = r => { const rows = apRows(r); const x = rows.find(x => x[1]) || rows[0]; return x ? { old: x[1], neu: rows.filter(y => y[2]).slice(0, 2).map(y => y[2]).join(' · ') } : { old: '', neu: REQ_TXT[r.kind] || '' }; };
    const REQ_TXT = { payment: 'toʻlov tuzatish', tariff: 'tarif oʻzgarishi', teacher: 'ustoz almashtirish' };
    const reqMgr = r => ({ id: (hr().find(e => e.name === r.requester_name) || {}).id || r.requested_by, name: r.requester_name || 'Menejer' });
    const ago = t => { const ms = Date.now() - (parseT(t) || Date.now()); return ms < DAY ? dur(ms) : shortDate(parseT(t)); };
    const receiptOf = r => { const ch = r.changes || {}; return ch.receiptUrl || ch.receipt || ch.fileUrl || ch.attachmentUrl || ''; };
    function screenApprovals() {
        if (!S.ap || (S.ap.loading && !S.ap.list?.length)) { loadApprovals(); return `${topBack('Tasdiqlar', 'Menejerlarning tahrir soʻrovlari')}<div class="sa-body">${'<div class="sa-sk" style="height:120px"></div>'.repeat(3)}</div>`; }
        const all = S.ap.list || [];
        const pend = all.filter(r => r.status === 'pending').sort(apOrder); // eng yangisi birinchi (Tasdiq ekrani bilan bir tartib)
        const done = all.filter(r => r.status !== 'pending').sort((a, b) => (parseT(b.decided_at) || 0) - (parseT(a.decided_at) || 0));
        const list = S.apTab === 'pending' ? pend : done;
        const me = user();
        const card = (r, i) => {
            const [kl, tone, icon] = KIND[r.kind] || ['SOʻROV', 'gray', 'approve'];
            const sm = apSummary(r), m = reqMgr(r), rc = receiptOf(r);
            return `<button type="button" class="ra-apc${i === 0 && S.apTab === 'pending' ? ' is-first' : ''}" style="--i:${Math.min(i, 8)}" data-ra-ap="${esc(r.id)}">
              <span class="ra-apc-h"><span class="ra-apc-i sa-tone-${tone}">${ic(icon, 20, 2.2)}</span><span class="ra-apc-t"><em class="is-${tone}">${kl}</em><strong>${esc(r.student_name || studentOf(r).name || 'Oʻquvchi')}</strong></span><span class="ra-apc-ago">${esc(ago(r.created_at))}</span></span>
              <span class="ra-diff">${sm.old ? `<del>${esc(sm.old)}</del>${ic('arrow', 16, 2.2)}` : ''}<span>${esc(sm.neu || REQ_TXT[r.kind] || '')}</span></span>
              <span class="ra-apc-f">${staffImg(m.id, m.name, 24)}<span>${esc(firstName(m.name))} soʻradi · ${rc ? 'chek ilova qilingan' : '“' + esc(String(r.reason || '').slice(0, 40)) + '”'}</span>${S.apTab === 'pending' ? '<b>Koʻrish ›</b>' : pill(r.status === 'approved' ? 'Tasdiqlandi' : r.status === 'rejected' ? 'Rad etildi' : 'Qaytarildi', r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gray')}</span>
            </button>`;
        };
        const recent = done.slice(0, 3).map(r => `<div class="ra-recent"><span class="ra-who ${r.decided_by_role === 'rop' && r.decided_by === me.id ? '' : 'is-admin'}">${r.decided_by === me.id || r.decided_by_name === me.name ? 'Siz' : r.decided_by_role === 'rop' ? 'ROP' : 'Admin'}</span><span><strong>${esc(r.student_name || '')}</strong> · ${esc(REQ_TXT[r.kind] || '')} ${r.status === 'approved' ? 'tasdiqlandi' : r.status === 'rejected' ? 'rad etildi' : esc(firstName(r.requester_name) + 'ga qaytarildi')}</span><em>${r.decided_at ? esc(hm(parseT(r.decided_at))) : ''}</em></div>`).join('');
        return `
        <header class="sa-top sa-top--page ra-top ra-top--tall">
          <div class="ra-top-r"><button type="button" class="sa-icon-btn sa-ghost" data-ra-back aria-label="Orqaga">${ic('back', 22, 2.2)}</button><div class="sa-top-t"><h1>Tasdiqlar</h1><span>Menejerlarning tahrir soʻrovlari</span></div></div>
          ${seg([['pending', `Kutmoqda · ${pend.length}`], ['done', `Hal qilingan · ${done.length}`]], S.apTab, 'ra-aptab', 'Holat')}
        </header>
        <div class="sa-body">
          ${S.ap.err ? `<div class="sa-err">${ic('x', 18)}<span>Soʻrovlarni yuklab boʻlmadi</span><button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-apreload>Qayta urinish</button></div>` : ''}
          ${S.apTab === 'pending' ? `<div class="ra-info">${ic('info', 18, 2.2)}<span>Admin ham koʻradi — kim birinchi hal qilsa, oʻsha qaror amal qiladi.</span></div>` : ''}
          ${list.length ? list.map(card).join('') : empty('board', S.apTab === 'pending' ? 'Kutilayotgan soʻrov yoʻq' : 'Hal qilingan soʻrov yoʻq', S.apTab === 'pending' ? 'Menejer tahrir soʻraganda shu yerda chiqadi' : '')}
          ${S.apTab === 'pending' && recent ? `<div class="sa-card ra-recents">${recent}</div>` : ''}
        </div>`;
    }
    function screenApproval() {
        const all = S.ap?.list || [];
        const r = all.find(x => x.id === S.apId);
        if (!r) return `${crumb('Tasdiqlar')}<div class="sa-body">${empty('board', 'Soʻrov topilmadi', 'Roʻyxatni yangilang')}</div>`;
        const pend = all.filter(x => x.status === 'pending').sort(apOrder);
        const s = studentOf(r), m = reqMgr(r), rc = receiptOf(r);
        const [kl, tone] = KIND[r.kind] || ['SOʻROV', 'gray'];
        const pending = r.status === 'pending';
        const rows = apRows(r);
        const chk = S.apChk?.[r.id];
        if (pending && !chk) loadCheck(r.id);
        const stPill = pending ? pill(kl, tone === 'purple' ? 'purple' : tone) : pill(r.status === 'approved' ? 'TASDIQLANGAN' : r.status === 'rejected' ? 'RAD ETILGAN' : 'QAYTARILGAN', r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gray');
        const idx = pend.findIndex(x => x.id === r.id);
        const dec = r.decided_by_name || '';
        const decWho = r.decided_by === user().id ? 'Siz' : (r.decided_by_role === 'admin' || r.decided_by_role === 'boshliq' ? 'Admin' : dec || 'ROP');
        return `
        ${crumb(pending ? `Tasdiqlar · ${idx + 1} / ${pend.length}` : 'Tasdiqlar · hal qilingan', `<span class="ra-kpill">${stPill}</span>`)}
        <div class="sa-body sa-stagger ra-apd">
          <section class="sa-card ra-stu">${avatar(r.student_name || s.name, 52, 'sa-tone-green')}<span><strong>${esc(r.student_name || s.name || 'Oʻquvchi')}</strong><em>${esc([s.subject === 'russian' ? 'Rus tili' : s.subject ? 'Ingliz tili' : '', s.teacherId ? 'Ustoz ' + firstName(tName(s.teacherId)) : '', s.startDate || s.joinDate ? fmtD(s.startDate || s.joinDate) + 'da oʻquvchi boʻldi' : ''].filter(Boolean).join(' · '))}</em></span></section>
          <section class="sa-card ra-chg"><h3>NIMA OʻZGARADI</h3>${rows.length ? rows.map(([k, a, b]) => `<div class="ra-chg-r"><span>${esc(k)}</span>${a ? `<del>${esc(a)}</del>` : '<i></i>'}<strong>${esc(b)}</strong></div>`).join('') : `<p class="sa-muted">${esc(REQ_TXT[r.kind] || '')}</p>`}</section>
          <div class="ra-two">
            ${rc ? `<a class="sa-card ra-rcpt" href="${esc(rc)}" target="_blank" rel="noopener">${ic('receipt', 22, 2)}<strong>Chek · ochish</strong></a>` : ''}
            <section class="sa-card ra-quote">${staffImg(m.id, m.name, 26)}<strong>${esc(firstName(m.name))} · ${esc(ago(r.created_at))}${/daq|s$|soat/.test(ago(r.created_at)) ? ' oldin' : ''}</strong><p>“${esc(r.reason || '')}”</p></section>
          </div>
          ${pending ? (chk?.err ? `<div class="sa-err">${ic('x', 18)}<span>Server tekshiruvi bajarilmadi — tasdiqlashda server baribir qayta tekshiradi</span></div>`
            : chk?.data ? `<section class="ra-impact${chk.data.ok === false ? ' is-bad' : ''}"><h3>TASDIQLANSA</h3>${(chk.data.checks || []).map(c => `<div class="ra-imp is-${c.level}"><i>${ic(c.level === 'ok' ? 'check' : c.level === 'bad' ? 'x' : 'info', 14, 3)}</i><span>${esc(c.text)}</span></div>`).join('')}</section>` : '<div class="sa-sk" style="height:110px"></div>')
            : `<section class="sa-card ra-decided">${avatar(decWho === 'Siz' ? user().name : dec || 'Admin', 40, 'ra-av-dark')}<span><strong>${esc(decWho)} ${r.decided_at ? esc(hm(parseT(r.decided_at))) + ' da ' : ''}${r.status === 'approved' ? 'tasdiqladi' : r.status === 'rejected' ? 'rad etdi' : 'qaytardi'}</strong><em>${esc(r.decision_note || (decWho === 'Siz' ? '' : 'sizdan harakat kerak emas'))}</em></span></section>`}
        </div>
        <div class="sa-bar ra-apbar">${pending
            ? `<button type="button" class="sa-btn ra-btn-ghost" data-ra-reject="return">Qaytarish</button><button type="button" class="sa-btn ra-btn-red" data-ra-reject="reject">Rad etish</button><button type="button" class="sa-btn ra-btn-green" data-ra-approve ${chk?.data?.ok === false ? 'disabled' : ''}>${ic('check', 18, 2.6)}Tasdiqlash</button>`
            : `<div class="ra-apbar-off"><button type="button" class="sa-btn" disabled>Qaytarish</button><button type="button" class="sa-btn" disabled>Rad etish</button><button type="button" class="sa-btn" disabled>Tasdiqlash</button></div><button type="button" class="sa-btn sa-btn--primary ra-apbar-main" data-ra-apnext>Kutayotgan soʻrovlarga · ${pend.length}</button>`}</div>`;
    }
    function loadCheck(id) {
        S.apChk = S.apChk || {};
        if (S.apChk[id]) return;
        S.apChk[id] = { loading: true };
        sApi(`/edit-requests/${encodeURIComponent(id)}/check`).then(d => { S.apChk[id] = { data: d }; }).catch(e => { S.apChk[id] = { err: e }; }).finally(() => queueRender());
    }
    async function decide(id, decision, note) {
        const r = (S.ap?.list || []).find(x => x.id === id); if (!r) return;
        try {
            const res = await sApi(`/edit-requests/${encodeURIComponent(id)}/decide`, { method: 'POST', body: { decision, note } });
            Object.assign(r, res?.request || { status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'returned' });
            closeSheet(true);
            window.schoolUI?.refreshCache?.();
            loadApprovals(true);
            if (decision === 'approve') showApproved(r);
            else { toast(decision === 'reject' ? 'Soʻrov rad etildi' : `${firstName(r.requester_name)}ga qaytarildi`, 'ok'); S.apTab = 'pending'; S.stack.pop(); S.screen = 'approvals'; render(true); }
        } catch (e) {
            if (e.status === 409) { // birinchi qaror boshqa tomonda — "hal qilingan" holati
                closeSheet(true);
                await loadApprovals(true);
                toast('Bu soʻrovni allaqachon boshqasi hal qildi', 'warn');
                render(true);
                return;
            }
            toast(e.message || 'Saqlab boʻlmadi', 'warn');
            const b = sheetEl?.querySelector('[data-ra-rjsave]') || root.querySelector('[data-ra-approve]'); if (b) b.disabled = false;
        }
    }
    function showApproved(r) {
        const pend = pendingAp().filter(x => x.id !== r.id).sort(apOrder);
        // Shu ko'rib chiqish seansida hal qilinganlar + qolganlar = jami; keyingisi — done + 1.
        S.apDone = (S.apDone || 0) + 1;
        const done = S.apDone, total = done + pend.length;
        if (!pend.length) S.apDone = 0;
        const next = pend[0];
        const T = { payment: 'Toʻlov tasdiqlandi', tariff: 'Tarif tasdiqlandi', teacher: 'Ustoz almashtirildi' }[r.kind] || 'Tasdiqlandi';
        const sm = apSummary(r);
        overlay(`<section class="ra-pop" role="dialog" aria-modal="true" aria-labelledby="raPopT">
            <span class="ra-okc ra-okc--dark">${ic('check', 30, 3)}</span>
            <div class="ra-pop-t"><h2 id="raPopT">${T}</h2><span>${esc(r.student_name || '')}${sm.neu ? ' · ' + esc(sm.neu) : ''}. ${esc(firstName(r.requester_name))}ga xabar ketdi.</span></div>
            ${next ? `<div class="ra-next"><em>KEYINGISI · ${done + 1} / ${total}</em><strong>${esc(next.student_name || '')} · ${esc((KIND[next.kind] || ['soʻrov'])[0].toLowerCase())}</strong>${bar(Math.round(done / total * 100), 'blue')}</div>` : ''}
            <div class="ra-pop-a">${next ? `<button type="button" class="sa-btn sa-btn--primary" data-ra-ovgo="ap:${esc(next.id)}">Keyingisini ochish</button>` : ''}<button type="button" class="sa-link" data-ra-ovgo="approvals">Roʻyxatga qaytish</button></div></section>`);
    }
    function openRejectSheet(kind) {
        const r = (S.ap?.list || []).find(x => x.id === S.apId); if (!r) return;
        const RS = r.kind === 'payment' ? ['Chek oʻqilmaydi', 'Summa mos emas', 'Boshqa oʻquvchiniki', 'Boshqa'] : r.kind === 'teacher' ? ['Vaqt mos emas', 'Ustoz band', 'Sabab yetarli emas', 'Boshqa'] : ['Narx notoʻgʻri', 'Vaqt mos emas', 'Sabab yetarli emas', 'Boshqa'];
        S.rj = { kind, reason: '' };
        openSheet(`<div class="sa-sh-h"><div><h2>Nima qilamiz?</h2></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <div class="ra-rjk" role="radiogroup" aria-label="Qaror">
            <button type="button" role="radio" class="ra-rjo" data-ra-rjk="return"><i></i><strong>Qaytarish</strong><em>Menejer tuzatib, qayta yuboradi</em></button>
            <button type="button" role="radio" class="ra-rjo" data-ra-rjk="reject"><i></i><strong>Rad etish</strong><em>Soʻrov yopiladi, hech narsa oʻzgarmaydi</em></button></div>
          <div class="sa-fld"><span>Sabab · <b class="is-red">majburiy</b></span><div class="sa-qchips">${RS.map(t => `<button type="button" class="sa-qchip ra-qchip" aria-pressed="false" data-ra-rjr="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <textarea id="raRjNote" rows="3" maxlength="480" aria-label="Izoh" placeholder="Menejerga izoh (“Boshqa”da majburiy)"></textarea></div>
          <button type="button" class="sa-btn sa-btn--primary sa-cr-save" data-ra-rjsave disabled>Sababni tanlang</button>
          <p class="sa-sh-foot" data-ra-rjfoot></p>`, 'ra-sheet');
        syncReject(kind);
    }
    function syncReject(kind) {
        const r = (S.ap?.list || []).find(x => x.id === S.apId); if (!r || !sheetEl) return;
        if (kind) S.rj.kind = kind;
        sheetEl.querySelectorAll('[data-ra-rjk]').forEach(b => { const on = b.dataset.raRjk === S.rj.kind; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
        sheetEl.querySelectorAll('[data-ra-rjr]').forEach(b => { const on = b.dataset.raRjr === S.rj.reason; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        const note = document.getElementById('raRjNote')?.value.trim() || '';
        const ok = S.rj.reason && (S.rj.reason !== 'Boshqa' || note.length >= 3);
        const sv = sheetEl.querySelector('[data-ra-rjsave]');
        const who = firstName(r.requester_name);
        sv.disabled = !ok;
        sv.className = `sa-btn ${S.rj.kind === 'reject' ? 'ra-btn-redsolid' : 'sa-btn--primary'} sa-cr-save`;
        sv.textContent = !S.rj.reason ? 'Sababni tanlang' : S.rj.reason === 'Boshqa' && !ok ? 'Izohni yozing' : S.rj.kind === 'reject' ? 'Rad etish' : `${who}ga qaytarish`;
        const f = sheetEl.querySelector('[data-ra-rjfoot]');
        if (f) f.textContent = S.rj.kind === 'reject' ? `${who} bildirishnoma oladi · soʻrov yopiladi` : `${who} bildirishnoma oladi · soʻrov “Qaytarilgan” boʻlib turadi`;
    }

    // ---------- Jadval (sinov nazorati) ----------
    function screenTrials() {
        const t0 = tToday(), day = S.trDay === 'today' ? t0 : addDays(t0, 1);
        schedFor(day);
        const rows = trialRows();
        const onDay = rows.filter(x => x.at && x.at.date === day);
        const tomorrowN = rows.filter(x => x.at && x.at.date === addDays(t0, 1)).length;
        const done = onDay.filter(x => ['done', 'sold'].includes(x.ph)).length, noshow = onDay.filter(x => x.ph === 'noshow').length, sold = onDay.filter(x => x.ph === 'sold').length;
        const now = Date.now();
        const inter = [];
        rows.forEach(x => {
            if (needsTeacher(x.ph) && x.at && x.at.date <= day && x.at.date >= t0) inter.push({ x, kind: 'teacher' });
            else if (x.ph === 'pending' && x.at?.date === day && (parseT(x.req.requestedAt) || now) < now - 45 * MIN) inter.push({ x, kind: 'wait' });
            else if (S.trDay === 'today' && (x.ph === 'result' || x.ph === 'overdue')) inter.push({ x, kind: 'result' });
            else if (S.trDay === 'today' && x.ph === 'done' && x.lead.status === 'sinov-darsida') inter.push({ x, kind: 'manager' });
        });
        inter.sort((a, b) => (a.x.at?.ms || 0) - (b.x.at?.ms || 0));
        const sd = S.sched[day]?.data;
        const breaks = (sd?.views || []).flatMap(v => (v.items || []).filter(i => i.kind === 'break').map(i => ({ ...i, teacherId: v.teacherId, t: (sd.teachers || []).find(t => t.id === v.teacherId)?.name || person(v.teacherId)?.name || 'Ustoz' })));
        const later = [
            ...onDay.filter(x => ['pending', 'accepted'].includes(x.ph) && !inter.some(i => i.x === x) && (S.trDay !== 'today' || x.at.min + x.dur > nowMin())).map(x => ({ min: x.at.min, x })),
            ...breaks.filter(b => S.trDay !== 'today' || b.end > nowMin()).map(b => ({ min: b.start, b }))
        ].sort((a, b) => a.min - b.min);
        const timeLbl = x => (x.at.date === day ? hmm(x.at.min) : x.at.date < t0 ? 'Kecha' : hmm(x.at.min));
        const iRow = ({ x, kind }) => {
            const mg = firstName(mgrName(x.lead.managerId)), tn = firstName(person(x.req.teacherId)?.name);
            const rem = x.lead.trialRopReminder && x.lead.trialRopReminder.requestId === x.req.id && now - (parseT(x.lead.trialRopReminder.at) || 0) < 2 * 3600000;
            const M = {
                teacher: ['ustozsiz', 'red', `${mg ? mg + ' qoʻydi' : 'Menejersiz'}${x.ph === 'rejected' ? ' · ' + (tn || 'ustoz') + ' rad etdi' : ''}`, `<button type="button" class="sa-btn sa-btn--primary sa-btn--sm" data-ra-tassign="${esc(x.lead.id)}" data-ll="${x.lead._lang}">Ustoz berish</button>`],
                wait: ['kutilmoqda', 'amber', `Ustoz ${tn} ${dur(now - (parseT(x.req.requestedAt) || now))} tasdiqlamadi`, rem ? pill('Eslatildi', 'blue') : `<button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-tremind="${esc(x.lead.id)}" data-ll="${x.lead._lang}">Eslatish</button>`],
                result: ['natija yoʻq', 'amber', `Ustoz ${tn} natijani yozmagan`, rem ? pill('Eslatildi', 'blue') : `<button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-tremind="${esc(x.lead.id)}" data-ll="${x.lead._lang}">Eslatish</button>`],
                manager: ['natija yoʻq', 'amber', `Keldi · ${mg || 'menejer'} natija kiritmagan`, mgrTg(x.lead.managerId) ? `<a class="sa-btn sa-btn--outline sa-btn--sm" href="${esc(mgrTg(x.lead.managerId))}" target="_blank" rel="noopener">Yozish</a>` : `<button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-lead="${esc(x.lead.id)}" data-ll="${x.lead._lang}">Ochish</button>`]
            }[kind];
            return `<article class="ra-tint is-${M[1]}"><span class="ra-tt"><strong>${x.at ? (x.at.date === day ? hmm(x.at.min) : x.at.date < t0 ? 'Kecha' : 'Ertaga') : '—'}</strong><em class="is-${M[1]}">${M[0]}</em></span><button type="button" class="sa-row-t ra-link-t" data-ra-lead="${esc(x.lead.id)}" data-ll="${x.lead._lang}"><strong>${esc(x.lead.name)}</strong><span>${esc(M[2])}</span></button>${M[3]}</article>`;
        };
        const lRow = r => r.b
            ? `<div class="ra-tl"><span class="ra-tt"><strong>${hmm(r.b.start)}</strong></span><span class="sa-row-t"><strong>Ustoz ${esc(firstName(r.b.t))} · tanaffus</strong><span>${hmm(r.b.start)}–${hmm(r.b.end)}${r.b.reason ? ' · sabab: ' + esc(r.b.reason) : ''}</span></span><span class="ra-brk">tanaffus</span></div>`
            : `<div class="ra-tl"><span class="ra-tt"><strong>${hmm(r.x.at.min)}</strong></span><button type="button" class="sa-row-t ra-link-t" data-ra-lead="${esc(r.x.lead.id)}" data-ll="${r.x.lead._lang}"><strong>${esc(r.x.lead.name)}</strong><span>Ustoz ${esc(firstName(person(r.x.req.teacherId)?.name) || '—')} · ${r.x.ph === 'accepted' ? 'tasdiqlandi' : 'tasdiq kutilmoqda'}</span></button><button type="button" class="sa-icon-btn" data-ra-tmore="${esc(r.x.lead.id)}" data-ll="${r.x.lead._lang}" aria-label="${esc(r.x.lead.name)} — amallar">${ic('dots', 20, 2.4)}</button></div>`;
        return `
        <header class="sa-top sa-top--leads ra-trtop">
          <div class="sa-top-row"><h1>Jadval</h1>${seg([['today', 'Bugun'], ['tomorrow', `Ertaga${tomorrowN ? ' · ' + tomorrowN : ''}`]], S.trDay, 'ra-trday', 'Kun')}</div>
          ${seg([['ctl', 'Nazorat'], ['trial', 'Sinov darsi'], ['lessons', 'Darslar']], 'ctl', 'ra-trseg', 'Boʻlim').replace('ra-seg', 'ra-seg ra-seg--3')}
          <div class="ra-stats4"><span><strong>${onDay.length}</strong><em>${S.trDay === 'today' ? 'Bugun' : 'Ertaga'}</em></span><span><strong>${done}</strong><em>Oʻtdi</em></span><span><strong>${noshow}</strong><em>Kelmadi</em></span><span class="is-green"><strong>${sold}</strong><em>Sotildi</em></span></div>
        </header>
        <div class="sa-body">
          ${inter.length ? `<h3 class="sa-h3 is-red">ARALASHING · ${inter.length}</h3>${inter.map(iRow).join('')}` : `<section class="sa-card sa-calm">${ic('check', 22, 2.6)}<span><strong>Aralashish kerak emas</strong><em>Hamma sinovga ustoz bor, natijalar yozilgan</em></span></section>`}
          <h3 class="sa-h3">${S.trDay === 'today' ? 'BUGUN KEYIN' : 'ERTAGA'}</h3>
          ${later.length ? `<div class="sa-card ra-list">${later.map(lRow).join('')}</div>` : `<div class="sa-card sa-muted-card">${S.sched[day]?.loading ? 'Yuklanmoqda…' : 'Rejada sinov yoʻq'}</div>`}
          ${S.sched[day]?.err ? '<p class="sa-foot">Ustoz tanaffuslarini yuklab boʻlmadi</p>' : ''}
          <button type="button" class="sa-link sa-center" data-ra-trialnew>+ Sinov qoʻyish (kim boʻsh — soat boʻyicha)</button>
        </div>`;
    }
    const trialOf = (id, lg) => trialRows().find(x => x.lead.id === id && (!lg || x.lead._lang === lg));
    // trialUI "Ustozga eslatish" bilan bir xil yozuv (trialRopReminder + izoh) — ustoz panelida "ROP eslatdi".
    function ropRemind(x) {
        if (!x || !g('updateLeadInStorage') || !once('remind:' + x.lead.id)) return;
        const me = user(), tn = person(x.req.teacherId)?.name || 'Ustoz', at = new Date().toISOString();
        const text = `ROP ${firstName(me.name)} ustozga eslatdi: ${tn} — sinov natijasini yozing (${x.lead.name}).`;
        const saved = updateLeadInStorage(x.lead._lang, x.lead.id, l => ({ ...l, trialRopReminder: { at, by: me.name || 'ROP', requestId: x.req.id, teacherId: x.req.teacherId },
            comments: [...(Array.isArray(l.comments) ? l.comments : []), createLeadComment({ type: 'trial-lesson', text, author: me.name || 'ROP' })] }));
        if (saved) toast(`${firstName(tn)}ga eslatma yuborildi`, 'ok'); else toast('Saqlab boʻlmadi', 'warn');
        render(false);
    }
    // trialUI "Admin ochsin" bilan bir xil yozuv (trialAdminOpen).
    function ropAdminOpen(x) {
        if (!x || !g('updateLeadInStorage') || !once('admin:' + x.lead.id)) return;
        sheetEl?.querySelectorAll('[data-ra-tadmin]').forEach(b => { b.disabled = true; });
        const me = user(), a = x.at, at = new Date().toISOString();
        const text = `ROP ${firstName(me.name)} adminga so'rov yubordi: ${a ? `${a.date.split('-').reverse().join('.')} ${hmm(a.min)}` : ''} vaqtini sinovga ochish (lid istagi, ochiq ustoz yo'q).`;
        const saved = updateLeadInStorage(x.lead._lang, x.lead.id, l => ({ ...l, trialAdminOpen: { at, by: me.name || 'ROP', date: a?.date || null, time: a ? hmm(a.min) : null, requestId: x.req.id || null },
            comments: [...(Array.isArray(l.comments) ? l.comments : []), createLeadComment({ type: 'trial-lesson', text, author: me.name || 'ROP' })] }));
        closeSheet();
        if (saved) toast('Adminga yuborildi · admin bildirishnomalarida chiqadi', 'ok'); else toast('Saqlab boʻlmadi', 'warn');
        render(false);
    }
    function teacherSpeed() {
        const by = {};
        trialRows().forEach(x => { const a = parseT(x.req.acceptedAt), q = parseT(x.req.requestedAt); if (a && q && a >= q && x.req.teacherId) (by[x.req.teacherId] = by[x.req.teacherId] || []).push(a - q); });
        const out = {}; Object.entries(by).forEach(([k, v]) => { v.sort((a, b) => a - b); out[k] = v[Math.floor(v.length / 2)]; });
        return out;
    }
    async function openTrialAssign(id, lg) {
        const x = trialOf(id, lg); if (!x) return;
        const base = x.at && Date.parse(isoOf(x.at.date, x.at.min)) > Date.now() ? x.at : null;
        const head = base ? `${base.date === tToday() ? 'Bugun' : base.date === addDays(tToday(), 1) ? 'Ertaga' : base.date.split('-').reverse().join('.')} ${hmm(base.min)} · kim boʻsh?` : 'Kim boʻsh?';
        const sub = `${x.lead.name} · ${x.dur} daq · ${firstName(mgrName(x.lead.managerId)) ? firstName(mgrName(x.lead.managerId)) + ' qoʻygan' : 'menejersiz'}`;
        S.ta = { id, lg: x.lead._lang, pick: '' };
        const draw = e => {
            if (!sheetEl || S.ta?.id !== id) return;
            const box = sheetEl.querySelector('[data-ra-tabody]'); if (!box) return;
            if (!base) { box.innerHTML = '<p class="sa-muted">Lid tanlagan vaqt oʻtib ketgan — “Boshqa vaqt kelishish”ni bosing.</p>'; return; }
            if (!e || e.loading) { box.innerHTML = '<div class="sa-sk" style="height:64px"></div>'.repeat(3); return; }
            if (e.err) { box.innerHTML = `<div class="sa-err">${ic('x', 18)}<span>Ustozlar jadvalini yuklab boʻlmadi</span></div>`; return; }
            const d = e.data || {}, a = base.min, b = base.min + x.dur;
            const speed = teacherSpeed();
            const teachers = (d.teachers || []).filter(t => ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'].includes(t.role));
            const list = teachers.map(t => {
                const v = (d.views || []).find(y => y.teacherId === t.id);
                let ok = true, why = '';
                if (!v || !(v.work || []).some(w => w.start <= a && b <= w.end)) { ok = false; why = 'ish vaqti emas'; }
                const clash = ok && (v.items || []).find(i => i.start < b && a < i.end && i.kind !== 'reserved');
                if (clash) { ok = false; why = `${hmm(clash.start)} da ${clash.kind === 'trial' ? 'boshqa sinov bor' : clash.kind === 'break' ? 'tanaffus' : 'darsi bor'} · band`; }
                if (ok && !(v.trialFree || []).some(f => f.start <= a && b <= f.end)) { ok = false; why = 'sinovga yopiq'; }
                if (x.ph === 'rejected' && String(t.id) === String(x.req.teacherId)) { ok = false; why = 'rad etgan'; }
                const trials = (v?.items || []).filter(i => i.kind === 'trial').length;
                return { t, ok, why, trials, sp: speed[t.id] };
            }).sort((p, q) => (q.ok - p.ok) || ((p.sp ?? 9e15) - (q.sp ?? 9e15)) || p.trials - q.trials);
            const fast = list.filter(r => r.ok && r.sp != null).sort((p, q) => p.sp - q.sp)[0];
            if (!S.ta.pick) S.ta.pick = (list.find(r => r.ok) || {}).t?.id || '';
            box.innerHTML = list.length ? list.map(r => `<button type="button" role="radio" aria-checked="${S.ta.pick === r.t.id}" class="ra-mopt${S.ta.pick === r.t.id ? ' is-on' : ''}${r.ok ? '' : ' is-off'}" ${r.ok ? `data-ra-tapick="${esc(r.t.id)}"` : 'disabled'}><i class="ra-radio"></i>${staffImg(r.t.id, r.t.name, 40)}<span class="sa-row-t"><strong>${esc(firstName(r.t.name))}${fast && fast.t.id === r.t.id ? ' <b class="ra-tagg">Tez tasdiqlaydi</b>' : ''}</strong><span>${r.ok ? `Boʻsh · ${base.date === tToday() ? 'bugun' : 'shu kuni'} ${r.trials} sinov${r.sp != null ? ` · oʻrtacha ${dur(r.sp)}da javob` : ''}` : esc(r.why)}</span></span></button>`).join('')
                : '<p class="sa-muted">Bu tilda faol ustoz topilmadi</p>';
            const sv = sheetEl.querySelector('[data-ra-tasave]'); const pt = list.find(r => r.t.id === S.ta.pick);
            if (sv) { sv.disabled = !pt; sv.textContent = pt ? `${firstName(pt.t.name)}ga biriktirish` : 'Boʻsh ustoz yoʻq'; }
        };
        S.ta.draw = draw;
        openSheet(`<div class="sa-sh-h"><div><h2>${esc(head)}</h2><span>${esc(sub)}</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <div class="ra-mopts" role="radiogroup" aria-label="Ustoz" data-ra-tabody></div>
          <button type="button" class="sa-btn sa-btn--primary sa-cr-save" data-ra-tasave disabled>Yuklanmoqda…</button>
          <p class="sa-sh-foot">Ustoz qabul qilmaguncha uning ilovasi kutadi · 45 daqda javob boʻlmasa sizga xabar keladi</p>
          <div class="ra-two-btn"><button type="button" class="sa-btn sa-btn--outline" data-ra-tresched="${esc(id)}" data-ll="${x.lead._lang}">Boshqa vaqt kelishish</button><button type="button" class="sa-btn sa-btn--outline" data-ra-tadmin="${esc(id)}" data-ll="${x.lead._lang}">Admin soat ochsin</button></div>`, 'ra-sheet');
        draw(null);
        if (base) draw(await schedFor(base.date));
    }
    // trialUI openAssign "Biriktirish" bilan bir xil yozuv (status, paymentOnboarding, trialRequest, izoh).
    function saveTrialAssign() {
        const ta = S.ta; if (!ta?.pick || !sheetEl || !once('tassign:' + ta.id)) return;
        S.ta = null;
        const x = trialOf(ta.id, ta.lg); if (!x || !x.at) return;
        const t = (S.sched[x.at.date]?.data?.teachers || []).find(y => y.id === ta.pick); if (!t) return;
        const me = user(), at = isoOf(x.at.date, x.at.min);
        const rev = globalThis.crypto?.randomUUID?.() || 'trial-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const days = Number(x.lead.paymentOnboarding?.trialDaysCount) || Number(x.req.daysCount) || 1;
        const rejectedBy = x.req.state === 'rejected' ? String(x.req.teacherId || '') : '';
        const DF = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
        const text = ['Ustoz biriktirildi (ROP):', ...(rejectedBy ? [`• Avvalgi ustoz rad etgan: ${x.req.reasonLabel || '—'}`] : []), `• O'qituvchi: ${t.name}`, `• Kuni: ${x.at.date.split('-').reverse().join('.')}, ${DF[wdOf(x.at.date) - 1]}, ${hmm(x.at.min)}`, `• Davomiyligi: ${days} kun`].join('\n');
        const saved = updateLeadInStorage(x.lead._lang, x.lead.id, l => ({ ...l, status: 'sinov-darsida',
            paymentOnboarding: { ...(l.paymentOnboarding || {}), teacherId: t.id, lessonDayOfWeek: wdOf(x.at.date), lessonTime: hmm(x.at.min), trialDaysCount: days, isTrial: true },
            trialLessonAt: at, trialScheduleRevision: rev,
            trialRequest: { id: rev, teacherId: t.id, scheduledAt: at, daysCount: days, state: 'pending', requestedAt: new Date().toISOString() },
            comments: [...(Array.isArray(l.comments) ? l.comments : []), createLeadComment({ type: 'trial-lesson', text, author: me.name || 'ROP' })] }));
        closeSheet();
        if (!saved) { toast('Saqlab boʻlmadi', 'warn'); return; }
        delete S.sched[x.at.date];
        toast(`${firstName(t.name)} biriktirildi — ustoz tasdigʻi kutilmoqda`, 'ok');
        render(false);
    }
    function openTrialMore(id, lg) {
        const x = trialOf(id, lg); if (!x) return;
        openSheet(`<div class="sa-sh-h"><div><h2>${esc(x.lead.name)}</h2><span>${x.at ? hmm(x.at.min) : ''} · Ustoz ${esc(firstName(person(x.req.teacherId)?.name) || '—')}</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <div class="sa-opts2"><button type="button" class="sa-opt2" data-ra-lead="${esc(id)}" data-ll="${x.lead._lang}">Lid kartasini ochish${ic('chev', 18, 2.4)}</button>
          <button type="button" class="sa-opt2" data-ra-tresched="${esc(id)}" data-ll="${x.lead._lang}">Boshqa vaqtga koʻchirish${ic('chev', 18, 2.4)}</button>
          <button type="button" class="sa-opt2" data-ra-tremind="${esc(id)}" data-ll="${x.lead._lang}">Ustozga eslatish${ic('chev', 18, 2.4)}</button>
          <button type="button" class="sa-opt2 ra-danger" data-ra-tcancel="${esc(id)}" data-ll="${x.lead._lang}">Sinovni bekor qilish${ic('chev', 18, 2.4)}</button></div>`, 'ra-sheet');
    }
    function openTrialCancel(id, lg) {
        const x = trialOf(id, lg); if (!x) return;
        S.tc = { id, lg: x.lead._lang, reason: '' };
        const rs = ['Lid oʻzi soʻradi', 'Ustoz qatnasha olmaydi', 'Notoʻgʻri qoʻyilgan', 'Boshqa (izoh bilan)'];
        const tn = firstName(person(x.req.teacherId)?.name), mg = firstName(mgrName(x.lead.managerId));
        openSheet(`<div class="sa-sh-h"><div><h2>Sinovni bekor qilasizmi?</h2><span>${esc(x.lead.name)} · ${x.at ? (x.at.date === tToday() ? 'bugun' : 'ertaga') + ' ' + hmm(x.at.min) : ''}${tn ? ' · Ustoz ' + esc(tn) : ''}${mg ? ' · ' + esc(mg) + ' qoʻygan' : ''}</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <button type="button" class="ra-info ra-info--btn" data-ra-tresched="${esc(id)}" data-ll="${x.lead._lang}">${ic('redo', 20, 2.2)}<span>Bekor qilish oʻrniga boshqa vaqtga koʻchirish (bugun yoki ertaga)</span>${ic('chev', 18, 2.4)}</button>
          <div class="sa-fld"><span>Sabab · <b class="is-red">majburiy</b></span><div class="sa-qchips">${rs.map(t => `<button type="button" class="sa-qchip ra-qchip" aria-pressed="false" data-ra-tcr="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
          <div class="sa-fld"><span>Izoh</span><textarea id="raTcNote" rows="2" maxlength="400" placeholder="Ixtiyoriy — “Boshqa”da majburiy"></textarea></div>
          <button type="button" class="sa-btn ra-btn-redsolid sa-cr-save" data-ra-tcsave disabled>Sinovni bekor qilish</button>
          <p class="sa-sh-foot">Sinov bekor qilinadi, ${x.at ? hmm(x.at.min) + ' soati' : 'vaqt'} boʻshaydi · lidga xabar yuborilmaydi${mg ? ` · ${esc(mg)} CRM’da koʻradi` : ''}</p>`, 'ra-sheet');
    }
    function syncTc() {
        if (!sheetEl || !S.tc) return;
        sheetEl.querySelectorAll('[data-ra-tcr]').forEach(b => { const on = b.dataset.raTcr === S.tc.reason; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        const note = document.getElementById('raTcNote')?.value.trim() || '';
        const sv = sheetEl.querySelector('[data-ra-tcsave]');
        if (sv) sv.disabled = !S.tc.reason || (/^Boshqa/.test(S.tc.reason) && note.length < 3);
    }
    // Bekor qilish: "Kim bo'sh?" orqali yaratilgan band (school_bookings) — POST /bookings/:id/cancel (ROP ruxsati bor).
    // Lid bosqichi O'ZGARMAYDI (bosqich o'zgarishi mijozga avtomatik SMS yuborardi). Ustoz bog'lanishi sotuvSinov'dagi
    // mavjud "ustozsiz" yo'li bilan olib tashlanadi (trialUnassigned + yangi trialScheduleRevision, teacherId yo'q) —
    // server (trialWorkflow.syncSchedule) joriy so'rovni trialHistory'ga arxivlaydi, jadvaldagi joy bo'shaydi.
    // trialCancelled — shu revision bekor qilinganini bildiradi (ROP nazoratida "ustozsiz" deb chiqmaydi).
    async function saveTrialCancel() {
        const tc = S.tc; const x = tc && trialOf(tc.id, tc.lg); if (!x || !sheetEl || !once('tcancel:' + tc.id, 15000)) return;
        const note = document.getElementById('raTcNote')?.value.trim() || '';
        const sv = sheetEl.querySelector('[data-ra-tcsave]'); if (sv) sv.disabled = true;
        try {
            const e = x.at ? await schedFor(x.at.date, true) : null;
            const ids = (e?.data?.views || []).flatMap(v => (v.items || []).filter(i => i.kind === 'trial' && i.leadId === x.lead.id && i.bookingId && ['hold', 'pending', 'confirmed'].includes(i.status)).map(i => i.bookingId));
            for (const b of ids) await sApi(`/bookings/${encodeURIComponent(b)}/cancel`, { method: 'POST', body: {} });
        } catch (err) { release('tcancel:' + tc.id); toast(err.message || 'Bandni bekor qilib boʻlmadi', 'warn'); if (sv) sv.disabled = false; return; }
        S.tc = null;
        const me = user(), now = new Date().toISOString();
        const reason = `${tc.reason}${note ? ' — ' + note : ''}`;
        const text = `Sinov darsi bekor qilindi (ROP ${firstName(me.name)}): ${reason}${x.at ? ` · ${x.at.date.split('-').reverse().join('.')} ${hmm(x.at.min)}` : ''}`;
        const rev = globalThis.crypto?.randomUUID?.() || 'trial-cancel-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const saved = updateLeadInStorage(x.lead._lang, x.lead.id, l => {
            const ob = { ...(l.paymentOnboarding || {}) }; delete ob.teacherId;
            const tl = l.trialLesson ? { ...l.trialLesson } : null; if (tl) delete tl.teacherId;
            return { ...l, paymentOnboarding: ob, ...(tl ? { trialLesson: tl } : {}), trialUnassigned: true, trialScheduleRevision: rev,
                trialCancelled: { rev, at: now, by: me.name || 'ROP', reason, requestId: x.req.id || null },
                comments: [...(Array.isArray(l.comments) ? l.comments : []), createLeadComment({ type: 'trial-lesson', text, author: me.name || 'ROP' })] };
        }, { skipAutoSms: true });
        release('tcancel:' + tc.id);
        closeSheet();
        if (x.at) delete S.sched[x.at.date];
        toast(saved ? 'Sinov bekor qilindi · vaqt boʻshadi' : 'Saqlab boʻlmadi', saved ? 'ok' : 'warn');
        render(false);
    }

    // ---------- Jamoa ----------
    const convOf = (leads, mid) => { const ms = monthStart(); const mine = leads.filter(l => (mid == null || String(l.managerId) === String(mid)) && (assignedAt(l) || 0) >= ms);
        const won = mine.filter(l => st(l) === 'tolov-yopildi').length; return mine.length ? Math.round(won / mine.length * 100) : null; };
    function teamRows(per) {
        const leads = ALL();
        const d = ropHome();
        return MGRS().map(m => {
            const sales = g('getManagerSalesForPeriod') ? getManagerSalesForPeriod(m.id, per) : 0;
            const target = g('getManagerPeriodTarget') ? getManagerPeriodTarget(m.id, per) : 0;
            const deals = g('getManagerDealsCount') ? getManagerDealsCount(m.id, per) : 0;
            const sla = (d?.open || []).filter(a => String(leadById(a.leadId, a.leadLang)?.managerId) === String(m.id)).length;
            const stale = leads.filter(l => String(l.managerId) === String(m.id) && staleOf(l)).length;
            return { ...m, sales, target, deals, pct: target > 0 ? Math.round(sales / target * 100) : null, conv: convOf(leads, m.id), sla, stale };
        }).sort((a, b) => b.sales - a.sales);
    }
    function screenTeam() {
        const per = S.teamPer, rows = teamRows(per), now = new Date();
        const sales = rows.reduce((a, r) => a + r.sales, 0), target = rows.reduce((a, r) => a + r.target, 0);
        const pct = target > 0 ? Math.round(sales / target * 100) : null;
        const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const due = per === 'oylik' && target > 0 ? Math.round(now.getDate() / days * 100) : per === 'haftalik' ? Math.round(((now.getDay() || 7)) / 7 * 100) : null;
        const MED = ['#FDB022', '#CBD5E1', '#E6A57E'];
        return `
        <header class="sa-top sa-top--leads">
          <div class="sa-top-row"><h1>Jamoa</h1>${seg([['kunlik', 'Bugun'], ['haftalik', 'Hafta'], ['oylik', 'Oy']], per, 'ra-tper', 'Davr')}</div>
          <div class="ra-tsum"><div class="ra-tsum-h"><span><strong>${mlnF(sales)}</strong><em>${target ? `/ ${mln(target)} · ${pct}%` : '· reja belgilanmagan'}</em></span><span class="ra-lockt">${ic('lock', 14, 2.4)}Reja — direktordan</span></div>
            ${bar(pct || 0, 'blue', due)}${due != null ? `<span class="ra-tsum-s">Qora chiziq — bugungacha boʻlishi kerak edi (${due}%)</span>` : ''}</div>
        </header>
        <div class="sa-body">
          ${rows.length ? rows.map((r, i) => {
              const bad = r.pct != null && r.pct < 30 && per === 'oylik' && now.getDate() > 7;
              const tone = r.pct == null ? 'blue' : r.pct >= 80 ? 'green' : bad ? 'red' : r.pct < 45 ? 'amber' : 'blue';
              const tail = r.stale ? `<b class="is-${bad ? 'red' : 'amber'}">${r.stale} qotgan lid</b>` : r.sla ? `<b class="is-amber">${r.sla} SLA ochiq</b>` : r.conv != null ? `konversiya ${r.conv}%` : '';
              return `<button type="button" class="ra-trow${bad ? ' is-bad' : ''}" style="--i:${Math.min(i, 10)}" data-ra-mgr="${esc(r.id)}"><span class="ra-rank"${i < 3 ? ` style="--m:${MED[i]}"` : ''}>${staffImg(r.id, r.name, 44, i < 3 ? 'is-medal' : '')}<b>${i + 1}</b></span>
                <span class="ra-mrow-t"><span class="ra-mrow-h"><strong>${esc(firstName(r.name))}</strong><strong class="sa-num">${mlnF(r.sales)}</strong></span>${bar(r.pct == null ? 0 : r.pct, tone)}<span class="ra-mrow-s${bad ? ' is-red' : ''}">${r.pct != null ? r.pct + '% · ' : ''}${r.deals} toʻlov${tail ? ' · ' : ''}${tail}</span></span></button>`;
          }).join('') : empty('students', 'Menejer yoʻq', 'Bu yoʻnalishda faol sotuv menejeri topilmadi')}
          <button type="button" class="sa-link sa-center" data-ra-go="funnel">Voronka va konversiya ›</button>
        </div>`;
    }
    function funnelOf(leads) {
        const reached = l => { const s = new Set([st(l)]); (Array.isArray(l.stageHistory) ? l.stageHistory : []).forEach(h => h?.to && s.add(h.to === 'malumot-berildi' ? 'boglanildi' : h.to)); return s; };
        const idx = l => Math.max(...[...reached(l)].map(x => PATH.indexOf(x === 'keyin-sotib-olmoqchi' ? 'qaror-jarayonida' : x)));
        const came = leads.length;
        const con = leads.filter(l => idx(l) >= 2 || (l.connectedSurvey && Object.keys(l.connectedSurvey).length)).length;
        const tr = leads.filter(l => idx(l) >= 3 || l.trialRequest || l.trialLessonAt).length;
        const att = leads.filter(l => l.trialRequest?.attended === true || (Array.isArray(l.trialHistory) && l.trialHistory.some(h => h?.attended)) || idx(l) >= 5).length;
        const won = leads.filter(l => st(l) === 'tolov-yopildi').length;
        return [['Lid', 'Lid keldi', came], ['Bogʻlanildi', 'Bogʻlanildi', con], ['Sinov qoʻyildi', 'Sinov qoʻyildi', tr], ['Sinovga keldi', 'Sinovga keldi', att], ['Toʻlov', 'Toʻlov yopildi', won]];
    }
    function screenManager() {
        const m = MGRS().find(x => String(x.id) === String(S.mgr)) || allMgrs().find(x => String(x.id) === String(S.mgr));
        if (!m) return `${crumb('Jamoa')}<div class="sa-body">${empty('students', 'Menejer topilmadi', '')}</div>`;
        const rows = teamRows('oylik'); const rank = rows.findIndex(r => String(r.id) === String(m.id)) + 1;
        const all = ALL(), mine = all.filter(l => String(l.managerId) === String(m.id));
        const now = new Date(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const p = planOf(m.id), deals = g('getManagerDealsCount') ? getManagerDealsCount(m.id, 'oylik') : 0;
        const due = p.t ? Math.round(p.t * now.getDate() / days) : 0, gap = p.s - due;
        const lang = m._lang || m.lang || LANGS()[0];
        const goal = ruleFor(lang).callsPerDay, calls = callsToday(all, m.id);
        const conv = convOf(all, m.id), teamConv = convOf(all.filter(l => l.managerId), null);
        const ms = monthStart();
        const fl = funnelOf(mine.filter(l => (assignedAt(l) || 0) >= ms));
        const maxF = Math.max(1, fl[0][2]);
        let worst = null; for (let i = 1; i < fl.length; i++) { const drop = fl[i - 1][2] ? 1 - fl[i][2] / fl[i - 1][2] : 0; if (!worst || drop > worst.drop) worst = { drop, a: fl[i - 1][0], b: fl[i][0] }; }
        const stale = mine.filter(staleOf), locked = stale.filter(l => staleOf(l).lock);
        const noCall = mine.filter(l => st(l) === 'yangi-lidlar' && !callsOf(l).length && Date.now() - (assignedAt(l) || Date.now()) > 30 * MIN);
        const forced = mine.filter(forcedThisMonth).length;
        const notes = [stale.length ? `${stale.length} ta qotgan lid${locked.length ? `, ${locked.length === 1 ? 'biri' : locked.length + ' tasi'} ${staleOf(locked[0]).d}-kunda qulfda` : ''}` : '',
            noCall.length ? `${noCall.length} ta yangi lidga ${dur(Date.now() - Math.min(...noCall.map(l => assignedAt(l) || Date.now())))} qoʻngʻiroq qilinmagan` : '',
            forced ? `Bu oy ${forced} lid majburan “Sifatsiz”ga oʻtkazildi` : ''].filter(Boolean);
        const tg = mgrTg(m.id), ph = telOf(person(m.id)?.phone);
        const SH = ['#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#0057B8'];
        return `
        ${crumb(`Jamoa · ${rank ? rank + '-oʻrin' : ''}`)}
        <div class="sa-body sa-stagger">
          <section class="ra-mhead">${staffImg(m.id, m.name, 64)}<span><h2>${esc(firstName(m.name) || m.name)}</h2><em>${esc(langLabel(lang))}${window.staffStatus && !window.staffStatus.isActive(m) ? ' · ishdan ketgan' : ''}</em></span></section>
          <div class="sa-qa ra-qa3">${ph ? `<a class="sa-qa-b is-primary" href="tel:${esc(ph)}">${ic('phone', 20, 2.2)}Qoʻngʻiroq</a>` : `<span class="sa-qa-b is-off">${ic('phone')}Raqam yoʻq</span>`}
            ${tg ? `<a class="sa-qa-b" href="${esc(tg)}" target="_blank" rel="noopener">${ic('tg')}Telegram</a>` : `<span class="sa-qa-b is-off">${ic('tg')}Telegram</span>`}
            <button type="button" class="sa-qa-b" data-ra-mleads="${esc(m.id)}">${ic('leads')}Lidlari · ${mine.filter(l => OPEN.has(st(l))).length}</button></div>
          <section class="sa-card ra-mplan"><div class="ra-mplan-h"><span>${cap(MON[now.getMonth()])} rejasi</span><span class="ra-lockt">${ic('lock', 14, 2.4)}faqat koʻrish</span></div>
            <div class="ra-hero-v ra-ink"><strong>${mlnF(p.s)}</strong><em>${p.t ? '/ ' + mln(p.t) + ' · ' : '· reja yoʻq · '}${deals} toʻlov</em></div>
            ${p.t ? `${bar(p.pct || 0, gap < 0 ? 'red' : 'blue', Math.round(due / p.t * 100))}<span class="ra-mplan-s is-${gap < 0 ? 'red' : 'green'}">Bugungacha ${mlnF(due)} boʻlishi kerak edi · ${mlnF(Math.abs(gap))} ${gap < 0 ? 'orqada' : 'oldinda'}</span>` : '<span class="ra-mplan-s">Rejani direktor belgilaydi</span>'}</section>
          <div class="ra-tiles3"><span class="sa-card"><em>Bugun qoʻngʻiroq</em><strong>${calls}<small> / ${goal}</small></strong></span><span class="sa-card"><em>Oy konversiya</em><strong>${conv == null ? '—' : conv + '%'}</strong></span><span class="sa-card"><em>Jamoada</em><strong>${teamConv == null ? '—' : teamConv + '%'}</strong></span></div>
          <section class="sa-card ra-fun"><h3>VORONKASI · ${MON[now.getMonth()].toUpperCase()}</h3>${fl.map(([k, , v], i) => `<div class="ra-fun-r"><span>${k}</span><i><b style="width:${v ? Math.max(4, v / maxF * 100) : 0}%;background:${SH[i]}"></b></i><strong>${v}</strong></div>`).join('')}
            ${worst && worst.drop > 0 ? `<p class="ra-fun-n">Eng katta yoʻqotish: ${esc(worst.a.toLowerCase())} → ${esc(worst.b.toLowerCase())} (${Math.round(worst.drop * 100)}% tushib qoladi)</p>` : ''}</section>
          ${notes.length ? `<section class="ra-attn"><strong>Eʼtibor bering</strong>${notes.map(n => `<span>· ${esc(n)}</span>`).join('')}</section>` : ''}
        </div>`;
    }
    function screenFunnel() {
        const now = new Date(), per = S.funPer;
        const from = per === 'oylik' ? monthStart() : per === 'haftalik' ? (() => { const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() || 7) - 1)); d.setHours(0, 0, 0, 0); return d.getTime(); })() : new Date(now.toDateString()).getTime();
        const leads = ALL().filter(l => (createdAt(l) || 0) >= from);
        const fl = funnelOf(leads);
        const won = fl[4][2], came = fl[0][2];
        const sales = MGRS().reduce((a, m) => a + (g('getManagerSalesForPeriod') ? getManagerSalesForPeriod(m.id, per) : 0), 0);
        const deals = MGRS().reduce((a, m) => a + (g('getManagerDealsCount') ? getManagerDealsCount(m.id, per) : 0), 0);
        const ratios = fl.map((f, i) => (i ? (fl[i - 1][2] ? Math.round(f[2] / fl[i - 1][2] * 100) : 0) : null));
        const low = ratios.reduce((m, r, i) => (r != null && (m < 0 || r < ratios[m]) ? i : m), -1);
        const unToday = ALL().filter(l => !l.managerId && OPEN.has(st(l))).length;
        const src = {}; leads.forEach(l => { const k = l.leadType === 'target' ? 'Target' : srcLabel(l) === 'Target' ? 'Target' : srcLabel(l); const o = src[k] || (src[k] = { n: 0, w: 0 }); o.n++; if (st(l) === 'tolov-yopildi') o.w++; });
        const srcRows = Object.entries(src).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
        const best = srcRows.reduce((m, [, o]) => Math.max(m, o.n ? o.w / o.n : 0), 0);
        const why = {}; leads.filter(l => st(l) === 'muvaffaqiyatsiz-sotuv').forEach(l => { const k = l.failedSaleReason?.label || 'Boshqa sabab'; why[k] = (why[k] || 0) + 1; });
        const whyN = Object.values(why).reduce((a, b) => a + b, 0);
        const SH = ['#BFDBFE', '#93C5FD', '#3B8BEE', '#0065D6', '#0B1220'];
        const lbl = per === 'oylik' ? `${cap(MON[now.getMonth()])} · 1–${now.getDate()}` : per === 'haftalik' ? 'Shu hafta' : 'Bugun';
        return `
        ${topBack('Voronka', `${lbl} · ${langsTxt()}`, `<button type="button" class="ra-perbtn" data-ra-funper>${per === 'oylik' ? 'Oy' : per === 'haftalik' ? 'Hafta' : 'Bugun'} ${ic('down', 14, 2.6)}</button>`)}
        <div class="sa-body sa-stagger">
          <div class="ra-fun2"><span class="ra-fun-dark"><em>Lid → toʻlov</em><strong>${came ? Math.round(won / came * 100) : 0}%</strong><small>${won} / ${came}</small></span><span class="sa-card"><em>Tushum</em><strong>${mlnF(sales)}</strong><small>${deals ? 'oʻrtacha chek ' + num(Math.round(sales / deals)) : 'toʻlov yoʻq'}</small></span></div>
          <section class="sa-card ra-fun ra-fun--big"><h3>BOSQICHMA-BOSQICH</h3>${fl.map(([, k, v], i) => `<div class="ra-fun-b"><span class="ra-fun-bh"><span>${k}${i === 0 ? (unToday ? ` · <em>+${unToday} biriktirilmagan</em>` : '') : ` · <em class="${i === low ? 'is-amber' : ''}">${ratios[i]}%${i === low ? ' ↓ eng past' : ''}</em>`}</span><strong>${v}</strong></span><i><b style="width:${v ? Math.max(3, v / Math.max(1, came) * 100) : 0}%;background:${SH[i]}"></b></i></div>`).join('')}</section>
          ${srcRows.length ? `<section class="sa-card ra-fun"><h3>MANBA BOʻYICHA</h3><table class="ra-tbl"><thead><tr><th scope="col">Manba</th><th scope="col">Lid</th><th scope="col">Toʻlov</th><th scope="col">Konv.</th></tr></thead><tbody>${srcRows.map(([k, o]) => `<tr><th scope="row">${esc(k)}</th><td>${o.n}</td><td>${o.w}</td><td class="${o.n && o.w / o.n === best && best > 0 ? 'is-green' : ''}"><b>${o.n ? Math.round(o.w / o.n * 100) : 0}%</b></td></tr>`).join('')}</tbody></table></section>` : ''}
          ${whyN ? `<section class="sa-card ra-fun"><h3>NEGA SOTILMADI · ${whyN}</h3><div class="ra-whys">${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span>${esc(k)} · ${n}</span>`).join('')}</div></section>` : ''}
        </div>`;
    }

    // ---------- Qotgan lidlar qoidasi ----------
    function screenStale() {
        if (!S.rules) { loadRules().then(() => queueRender()); return `${topBack('Qotgan lidlar qoidasi', langsTxt())}<div class="sa-body"><div class="sa-sk" style="height:220px"></div></div>`; }
        const lg = S.staleLang && LANGS().includes(S.staleLang) ? S.staleLang : LANGS()[0];
        S.staleDraft = S.staleDraft || {};
        const d = S.staleDraft[lg] || (S.staleDraft[lg] = { ...ruleFor(lg) });
        const step = (k, title, sub, unit, min, max) => `<div class="ra-step"><span><strong>${title}</strong><em>${sub}</em></span><span class="ra-stepper"><button type="button" data-ra-step="${k}:-1" aria-label="${title} — kamaytirish" ${d[k] <= min ? 'disabled' : ''}>${ic('minus', 18, 2.6)}</button><b aria-live="polite">${d[k]}${unit}</b><button type="button" data-ra-step="${k}:1" aria-label="${title} — oshirish" ${d[k] >= max ? 'disabled' : ''}>${ic('plus', 18, 2.6)}</button></span></div>`;
        const leads = ALL().filter(l => l._lang === lg);
        const by = {};
        for (const l of leads) { if (!l.managerId) continue; const o = by[l.managerId] || (by[l.managerId] = { w: 0, k: 0, f: 0 }); const s = staleOf(l); if (s) { if (s.lock) o.k++; else o.w++; } if (forcedThisMonth(l)) o.f++; }
        const mans = MGRS(lg).map(m => ({ m, o: by[m.id] || { w: 0, k: 0, f: 0 } })).sort((a, b) => (b.o.k - a.o.k) || (b.o.w - a.o.w) || (b.o.f - a.o.f));
        const changed = LANGS().some(L => S.staleDraft[L] && ['warnDays', 'lockDays', 'callsPerDay'].some(k => S.staleDraft[L][k] !== ruleFor(L)[k]));
        return `
        ${topBack('Qotgan lidlar qoidasi', `${langLabel(lg)} · faqat sotuv menejerlariga`)}
        <div class="sa-body sa-stagger ra-stale">
          ${LANGS().length > 1 ? seg([['english', 'Ingliz tili'], ['russian', 'Rus tili']], lg, 'ra-stlang', 'Til') : ''}
          <section class="sa-card ra-steps">${step('warnDays', 'Ogohlantirish', 'Hech javob bermagan lid — shu kuni “Sifatsiz”ga oʻtkazishni soʻraymiz', ' kun', 1, 60)}${step('lockDays', 'Majburiy qulf', 'Menejer ilovasi shu lidni hal qilmaguncha qulflanadi', ' kun', 2, 90)}${step('callsPerDay', 'Kunlik qoʻngʻiroq', 'Har bir menejer uchun kunlik meʼyor', '', 1, 300)}</section>
          <div class="ra-info">${ic('info', 18, 2.2)}<span>Qulf kuni ogohlantirishdan kamida 1 kun keyin. Qulfdan chiqish uchun menejer avval qayta qoʻngʻiroq qiladi.</span></div>
          <section class="sa-card ra-fun"><h3>HOZIR MENEJERLARDA</h3><table class="ra-tbl ra-tbl--st"><thead><tr><th scope="col">Menejer</th><th scope="col">Ogohl.</th><th scope="col">Qulf</th><th scope="col">Oy · majburan</th></tr></thead><tbody>${mans.map(({ m, o }) => `<tr><th scope="row"><span class="ra-tbl-m">${staffImg(m.id, m.name, 24)}${esc(firstName(m.name))}</span></th><td class="${o.w ? 'is-amber' : 'is-mut'}">${o.w}</td><td class="${o.k ? 'is-red' : 'is-mut'}">${o.k}</td><td>${o.f}</td></tr>`).join('') || '<tr><td colspan="4" class="is-mut">Menejer yoʻq</td></tr>'}</tbody></table></section>
        </div>
        <div class="sa-bar"><button type="button" class="sa-btn sa-btn--primary" data-ra-stsave ${changed ? '' : 'disabled'}>Saqlash</button></div>`;
    }
    async function saveStale() {
        const patch = {};
        for (const L of LANGS()) { const d = S.staleDraft?.[L]; if (!d) continue; if (d.lockDays <= d.warnDays) { toast('Qulf kuni ogohlantirishdan kamida 1 kun keyin boʻlsin', 'warn'); return; } patch[L] = { warnDays: d.warnDays, lockDays: d.lockDays, callsPerDay: d.callsPerDay }; }
        const b = root.querySelector('[data-ra-stsave]'); if (b) b.disabled = true;
        try {
            const r = await apiFetch('/api/leads/stale-rule', { method: 'PUT', body: JSON.stringify({ rules: patch }) });
            if (r?.rules) S.rules = r.rules;
            S.staleDraft = null; toast('Qoida saqlandi', 'ok'); render(false);
        } catch (e) { toast(e.message || 'Saqlab boʻlmadi', 'warn'); if (b) b.disabled = false; }
    }

    // ---------- Arxiv ----------
    const AR_TYPES = { lead: 'lead', student: 'student', other: 'bookRoadmap,script,bonus' };
    async function loadArchive(tab, force) {
        S.ar = S.ar || {};
        if (S.ar[tab] && !force && (S.ar[tab].loading || Date.now() - S.ar[tab].at < 60000)) return;
        S.ar[tab] = { ...(S.ar[tab] || {}), loading: true, at: Date.now() };
        try { const d = await apiFetch(`/api/archive?type=${AR_TYPES[tab]}&limit=50`, { fresh: true }); S.ar[tab] = { items: d.items || [], at: Date.now() }; S.arCounts = d.counts || S.arCounts; }
        catch (e) { S.ar[tab] = { items: [], err: e, at: Date.now() }; }
        queueRender();
    }
    function screenArchive() {
        const tab = S.arTab; loadArchive(tab);
        const c = S.arCounts || {}, e = S.ar?.[tab];
        const other = (c.bookRoadmap || 0) + (c.script || 0) + (c.bonus || 0);
        const me = user();
        return `
        <header class="sa-top sa-top--page ra-top ra-top--tall">
          <div class="ra-top-r"><button type="button" class="sa-icon-btn sa-ghost" data-ra-back aria-label="Orqaga">${ic('back', 22, 2.2)}</button><div class="sa-top-t"><h1>Arxiv</h1><span>Oʻchirilganlar yoʻqolmaydi · ${esc(langsTxt())}</span></div></div>
          ${seg([['lead', `Lidlar · ${c.lead || 0}`], ['student', `Oʻquvchilar · ${c.student || 0}`], ['other', `Boshqa · ${other}`]], tab, 'ra-artab', 'Tur').replace('ra-seg', 'ra-seg ra-seg--3')}
        </header>
        <div class="sa-body">
          ${!e || (e.loading && !e.items) ? '<div class="sa-sk" style="height:70px"></div>'.repeat(3)
            : e.err ? `<div class="sa-err">${ic('x', 18)}<span>Arxivni yuklab boʻlmadi</span><button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-arreload>Qayta urinish</button></div>`
            : e.items.length ? e.items.map((it, i) => `<article class="sa-card ra-arc" style="--i:${Math.min(i, 8)}"><span class="sa-row-t"><strong>${esc(it.title || '—')}</strong><span>Oʻchirdi: ${esc(it.deletedBy === me.name ? 'siz' : firstName(it.deletedBy) || 'tizim')} · ${it.deletedAt ? esc(shortDate(parseT(it.deletedAt))) : ''} · ${it.reason ? '“' + esc(it.reason) + '”' : 'sababsiz'}</span></span>${it.restorable !== false ? `<button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-ra-restore="${esc(it.id)}" data-type="${esc(it.type)}" data-eid="${esc(it.entityId || '')}" data-ll="${esc(it.lang || '')}">Tiklash</button>` : ''}</article>`).join('')
            : empty('board', 'Arxiv boʻsh', 'Oʻchirilgan yozuvlar shu yerda saqlanadi')}
          ${tab === 'lead' ? `<div class="ra-info">${ic('info', 18, 2.2)}<span>Tiklangan lid oʻchirgan menejerga emas, “biriktirilmagan”ga qaytadi — keyin taqsimlaysiz.</span></div>` : ''}
        </div>`;
    }
    async function restoreItem(b) {
        b.disabled = true;
        try {
            await apiFetch('/api/archive/' + encodeURIComponent(b.dataset.raRestore) + '/restore', { method: 'POST', body: '{}' });
            if (g('reloadStateFromApi')) await reloadStateFromApi().catch(() => {});
            if (b.dataset.type === 'lead' && b.dataset.eid) {
                // Tiklangan lid "biriktirilmagan"ga — ROP qayta taqsimlaydi (dizayn qoidasi).
                const lg = b.dataset.ll === 'russian' ? 'russian' : 'english';
                const l = leadById(b.dataset.eid, lg);
                if (l?.managerId && g('updateLeadInStorage')) updateLeadInStorage(lg, l.id, x => ({ ...x, managerId: '' }));
            }
            toast('Tiklandi', 'ok');
            loadArchive(S.arTab, true);
        } catch (e) { b.disabled = false; toast(e.message || 'Tiklab boʻlmadi', 'warn'); }
    }

    // ---------- SMS ----------
    function smsGroups() {
        const all = ALL();
        const ws = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() || 7) - 1)); d.setHours(0, 0, 0, 0); return d.getTime(); })();
        const ms = monthStart();
        return [
            { k: 'qaror', t: 'Qaror jarayonida', s: 'Hali toʻlov qilmaganlar', list: all.filter(l => st(l) === 'qaror-jarayonida') },
            { k: 'noshow', t: 'Sinovga kelmaganlar', s: 'Shu hafta', list: all.filter(l => { const r = l.trialRequest; return r?.state === 'completed' && r.attended === false && (parseT(r.completedAt) || 0) >= ws; }) },
            { k: 'price', t: 'Muvaffaqiyatsiz · narx sababli', s: 'Shu oy', list: all.filter(l => st(l) === 'muvaffaqiyatsiz-sotuv' && /narx/i.test(l.failedSaleReason?.label || '') && (closedAt(l) || 0) >= ms) }
        ].map(x => ({ ...x, list: x.list.filter(l => telOf(l.phone)) }));
    }
    function screenSms() {
        const gs = smsGroups(), cur = gs.find(x => x.k === S.sms) || gs[0];
        const lang = LANGS().length > 1 ? 'ingliz va rus' : LANGS()[0] === 'russian' ? 'rus' : 'ingliz';
        if (S.smsText == null) S.smsText = `Assalomu alaykum, {ism}! Domwork ${lang} tili kursiga joylar oz qoldi. Bugun yozilsangiz — birinchi dars sovgʻa.`;
        const len = S.smsText.replace(/\{ism\}/g, '').length;
        const uni = /[ʻʼ‘’]/.test(S.smsText) || /[^\x00-\x7F]/.test(S.smsText);
        const per = uni ? 70 : 160, parts = Math.max(1, Math.ceil((len + 8) / per));
        return `
        ${topBack('SMS yuborish', `Lidlar guruhiga · ${langsTxt()}`)}
        <div class="sa-body ra-sms">
          <span class="ra-lbl">Kimga</span>
          <div class="ra-mopts" role="radiogroup" aria-label="Kimga">${gs.map(x => `<button type="button" role="radio" aria-checked="${x.k === cur.k}" class="ra-mopt${x.k === cur.k ? ' is-on' : ''}" data-ra-smsg="${x.k}"><i class="ra-radio"></i><span class="sa-row-t"><strong>${x.t}</strong><span>${x.s}</span></span><b class="ra-cnt">${x.list.length}</b></button>`).join('')}</div>
          <label class="ra-lbl" for="raSmsText">Matn</label>
          <textarea id="raSmsText" class="ra-ta" rows="5" maxlength="900">${esc(S.smsText)}</textarea>
          <div class="ra-smsn"><span>{ism} — har kimning oʻz ismi qoʻyiladi</span><span>${len} belgi + ism · ${parts}${parts > 1 ? '–' + (parts + 1) : ''} SMS${uni ? ' (ʻ harfi bor)' : ''}</span></div>
        </div>
        <div class="sa-bar"><button type="button" class="sa-btn sa-btn--primary" data-ra-smssend ${cur.list.length && S.smsText.trim() ? '' : 'disabled'}>${cur.list.length} kishiga yuborish</button></div>`;
    }
    async function sendSms() {
        const cur = smsGroups().find(x => x.k === S.sms) || smsGroups()[0];
        const text = (S.smsText || '').trim();
        if (!cur.list.length || !text || !g('apiSendSms')) return;
        if (!confirm(`${cur.list.length} ta qabul qiluvchiga SMS yuborilsinmi?`)) return;
        const b = root.querySelector('[data-ra-smssend]'); if (b) { b.disabled = true; b.textContent = 'Yuborilmoqda…'; }
        const recipients = cur.list.map(l => { const r = { id: l.id, type: 'lead', name: l.name || '', phone: l.phone, teacherId: l.trialRequest?.teacherId || l.paymentOnboarding?.teacherId || '' };
            const msg = g('fillSmsPlaceholders') && g('_smsRecipientContext') ? fillSmsPlaceholders(text, _smsRecipientContext(r)) : text.split('{ism}').join(r.name);
            return { id: r.id, type: r.type, name: r.name, phone: r.phone, message: msg }; });
        try { const res = await apiSendSms(recipients, text, 'lidlar'); toast(`${res.sent || 0} ta yuborildi${res.failed ? `, ${res.failed} ta xato` : ''}`, res.failed ? 'warn' : 'ok'); }
        catch (e) { toast(e.message || 'Yuborib boʻlmadi', 'warn'); }
        render(false);
    }

    // ---------- Bildirishnomalar ----------
    function notifList() {
        try { if (g('syncNotifications')) syncNotifications(); } catch (e) { /* oflayn */ }
        return (g('getNotifications') ? (getNotifications() || []) : []).slice().sort((a, b) => (parseT(b.time) || 0) - (parseT(a.time) || 0)).slice(0, 80);
    }
    const nCat = n => (n.cat === 'tasdiq' || /edit_request|payment_edit/.test(n.etype || '') ? 'tasdiq' : n.cat === 'sinov' || n.cat === 'lid' || n.leadId || /sla/i.test(n.id || '') ? 'sinov' : 'jamoa');
    function screenNotif() {
        const list = notifList();
        const unread = list.filter(n => !n.read).length;
        const f = S.notifCat, shown = list.filter(n => f === 'all' || nCat(n) === f);
        const today = dayKey(Date.now()), yest = dayKey(Date.now() - DAY);
        const tone = n => (nCat(n) === 'tasdiq' ? 'green' : /trial|sinov/i.test(n.etype || n.cat || '') ? 'red' : n.tone === 'bad' || n.type === 'danger' ? 'red' : /sla|warn/i.test(n.id + n.type) ? 'amber' : 'blue');
        const icon = n => (nCat(n) === 'tasdiq' ? 'card' : /trial_break/.test(n.etype || '') ? 'pause' : nCat(n) === 'sinov' && /trial/.test(n.etype || '') ? 'cal' : /sla/i.test(n.id || '') ? 'clock' : /daily_plan/.test(n.etype || '') ? 'team' : 'bell');
        let last = '';
        const rows = shown.map(n => {
            const t = parseT(n.time); const k = t ? (dayKey(t) === today ? 'BUGUN' : dayKey(t) === yest ? 'KECHA' : 'OLDINROQ') : 'OLDINROQ';
            const h = k !== last ? `<h3 class="sa-h3">${k}</h3>` : ''; last = k;
            const act = nCat(n) === 'tasdiq' ? 'Koʻrish' : nCat(n) === 'sinov' && /trial/.test(n.etype || '') ? 'Sinovlarni ochish' : '';
            return `${h}<div class="ra-notif${n.read ? '' : ' is-new'}"><button type="button" class="ra-notif-b" data-ra-nitem="${esc(n.id)}"><span class="sa-ic-box sa-tone-${tone(n)}">${ic(icon(n), 20)}</span><span class="sa-row-t"><strong>${esc(n.title || 'Bildirishnoma')}${act ? '' : ' ›'}</strong><span>${esc(n.message || '')}</span></span><em>${t ? esc(dayKey(t) === today ? hm(t) : shortDate(t)) : ''}</em></button>${act ? `<button type="button" class="sa-btn sa-btn--primary sa-btn--sm ra-notif-a" data-ra-nitem="${esc(n.id)}">${act}</button>` : ''}</div>`;
        }).join('');
        return `
        ${topBack('Bildirishnomalar', '', unread ? '<button type="button" class="sa-btn sa-btn--soft sa-btn--sm" data-ra-nread>Hammasi oʻqildi</button>' : '')}
        <div class="ra-ncats sa-chips" role="tablist" aria-label="Toifa">${[['all', `Hammasi${unread ? ' · ' + unread + ' yangi' : ''}`], ['tasdiq', 'Tasdiq'], ['sinov', 'Sinov va lidlar'], ['jamoa', 'Jamoa']].map(([k, t]) => `<button type="button" role="tab" aria-selected="${f === k}" class="sa-chip ra-nchip${f === k ? ' is-on' : ''}" data-ra-ncat="${k}">${t}</button>`).join('')}</div>
        <div class="sa-body">${rows || empty('board', 'Bildirishnoma yoʻq', 'Yangi xabarlar shu yerda chiqadi')}</div>`;
    }
    function openNotifItem(id) {
        const n = (g('getNotifications') ? getNotifications() : []).find(x => String(x.id) === String(id));
        if (g('markNotificationRead')) markNotificationRead(id);
        if (!n) { render(false); return; }
        if (nCat(n) === 'tasdiq') return go('approvals');
        if (n.leadId) return openLead(n.leadId, n.leadLang);
        if (/trial|sinov/.test(n.etype || n.cat || '') || n.tab === 'timetable' || n.tab === 'trial-lessons') { S.trDay = 'today'; return go('trials', { reset: true }); }
        if (n.tab) return openCrm(n.section ? `${n.tab}:${n.section}` : n.tab);
        render(false);
    }

    // ---------- Menyu ----------
    // Davomat (RopMenu): Xodimlar davomati · Davomat so'rovlari (soni bilan) · Mening davomatim — js/davomatApp.js
    function davTiles() {
        const mi = window.davomat?.menuInfo(); if (!mi) return '';
        const t = (go, icon, tone, title, sub, badge) => `<button type="button" class="ra-mt" ${go}><span class="ra-mt-i sa-tone-${tone}">${ic(icon, 20, 2)}</span><span class="ra-mt-t"><strong>${title}</strong>${sub ? `<em>${sub}</em>` : ''}</span>${badge ? `<b class="ra-badge">${badge}</b>` : ''}</button>`;
        return (mi.approver ? t('data-dv-go="team"', 'students', 'green', 'Xodimlar davomati', '') + t('data-dv-go="approvals"', 'clock', 'blue', 'Davomat soʻrovlari', '', mi.pending) : '')
            + (mi.tracked ? t('data-dv-go="my"', 'check', 'gray', 'Mening davomatim', '') : '');
    }
    function screenMenu() {
        const u = user(), d = ropHome();
        const apN = pendingAp().length, slaN = d?.open?.length || 0;
        const t = (go, icon, tone, title, sub, badge) => `<button type="button" class="ra-mt" ${go}><span class="ra-mt-i sa-tone-${tone}">${ic(icon, 20, 2)}</span><span class="ra-mt-t"><strong>${title}</strong>${sub ? `<em>${sub}</em>` : ''}</span>${badge ? `<b class="ra-badge">${badge}</b>` : ''}</button>`;
        return `
        <header class="sa-top ra-menu-top">${staffImg(u.linkedEmployeeId || u.id, u.name, 52, 'ra-av-dark')}<div class="sa-top-t"><h1>${esc(u.name || '')}</h1><span>Sotuv boʻlimi boshligʻi · ${esc(langsTxt())}</span></div><button type="button" class="sa-icon-btn" data-ra-crm="profile" aria-label="Sozlamalar">${ic('gear')}</button></header>
        <div class="sa-body sa-stagger">
          <h3 class="sa-h3">NAZORAT</h3>
          <div class="ra-mgrid">${t('data-ra-go="approvals"', 'approve', 'blue', 'Toʻlov tasdiqlari', '', apN)}${davTiles()}${t('data-ra-go="sla"', 'clock', 'amber', 'SLA', '', slaN)}${t('data-ra-go="stale"', 'lock', 'red', 'Qotgan lidlar qoidasi', '')}${t('data-ra-go="archive"', 'archive', 'gray', 'Arxiv', '')}</div>
          <h3 class="sa-h3">SOTUV</h3>
          <div class="ra-mgrid">${t('data-ra-go="funnel"', 'funnel', 'blue', 'Voronka', '')}${t('data-ra-crm="sales:rating"', 'trophy', 'amber', 'Reyting va bonus', '')}${t('data-ra-crm="sales:sales-plan"', 'target', 'gray', 'Sotuv rejasi', 'faqat koʻrish')}${t('data-ra-crm="sales:debtors"', 'debt', 'red', 'Qarzdorlar', '')}${t('data-ra-crm="sales:scripts"', 'script', 'purple', 'Skript va yoʻriqnoma', '')}${t('data-ra-go="sms"', 'smsl', 'green', 'SMS yuborish', '')}</div>
          <h3 class="sa-h3">OʻQUVCHILAR</h3>
          <div class="ra-mgrid">${t('data-ra-crm="students"', 'students', 'blue', 'Oʻquvchilar', '')}${t('data-ra-crm="school-groups"', 'tg', 'sky', 'Telegram guruh', '')}</div>
          <button type="button" class="ra-logout" data-ra-logout>${ic('logout', 20, 2.2)}Chiqish</button>
        </div>`;
    }

    // =====================================================================================
    // Pastki oynalar
    // =====================================================================================
    function openSheet(html, cls = '') {
        const opener = sheetEl ? openSheet._opener : document.activeElement;
        closeSheet(true, true);
        openSheet._opener = opener;
        sheetEl = document.createElement('div');
        sheetEl.className = 'sa-sheet-wrap ra-sheet-wrap';
        armGuard();
        sheetEl.innerHTML = `<button type="button" class="sa-dim" data-ra-sheetclose aria-label="Yopish"></button><section class="sa-sheet ${cls}" role="dialog" aria-modal="true" tabindex="-1"><span class="sa-handle" aria-hidden="true"></span>${html}</section>`;
        document.body.appendChild(sheetEl);
        const h2 = sheetEl.querySelector('h2'); if (h2) { h2.id = 'raSheetT'; sheetEl.querySelector('.sa-sheet').setAttribute('aria-labelledby', 'raSheetT'); }
        sheetEl.addEventListener('click', onClick);
        sheetEl.addEventListener('input', onInput);
        sheetEl.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
            if (e.key !== 'Tab') return;
            const f = [...sheetEl.querySelectorAll('button:not([disabled]), a[href], textarea, input, select')].filter(x => x.offsetParent !== null && !x.classList.contains('sa-dim'));
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        sheetEl.querySelector('.sa-sheet')?.focus({ preventScroll: true });
    }
    function closeSheet(instant, fromPop) {
        if (!sheetEl) return;
        const el = sheetEl; sheetEl = null;
        if (!fromPop || !instant) { const o = openSheet._opener; openSheet._opener = null; if (o && o.isConnected && o.focus) setTimeout(() => o.focus({ preventScroll: true }), 0); }
        if (instant) { el.remove(); return; }
        el.classList.add('is-out');
        setTimeout(() => el.remove(), 220);
    }
    // Markazdagi tabrik oynalari va to'liq ekranli "Reja bajarildi".
    function overlay(html, cls = '') {
        const opener = overlayEl ? overlay._opener : (sheetEl ? openSheet._opener : document.activeElement);
        closeOverlay(true);
        overlay._opener = opener;
        overlayEl = document.createElement('div');
        overlayEl.className = 'ra-ov ' + cls;
        overlayEl.innerHTML = `<div class="ra-ov-dim" aria-hidden="true"></div>${html}`;
        document.body.appendChild(overlayEl);
        overlayEl.addEventListener('click', onClick);
        overlayEl.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); return; }
            if (e.key !== 'Tab') return;
            const f = [...overlayEl.querySelectorAll('button:not([disabled]), a[href]')].filter(x => x.offsetParent !== null);
            if (!f.length) { e.preventDefault(); return; }
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && (document.activeElement === first || !overlayEl.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (document.activeElement === last || !overlayEl.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
        });
        armGuard();
        setTimeout(() => overlayEl?.querySelector('[role="dialog"] button, [role="dialog"] a[href]')?.focus({ preventScroll: true }), 30);
    }
    // Yopilganda fokus ochuvchi tugmaga (u hali sahifada bo'lsa) yoki ilova sarlavhasiga qaytadi.
    function closeOverlay(keepOpener) {
        if (!overlayEl) return;
        overlayEl.remove(); overlayEl = null;
        if (keepOpener) return;
        const o = overlay._opener; overlay._opener = null;
        setTimeout(() => { const t = o && o.isConnected && o.offsetParent !== null ? o : root?.querySelector('h1, button'); if (t) { if (!t.matches('button, a, [tabindex]')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }, 0);
    }

    // Menejer tanlash (taqsimlash va almashtirish uchun bitta ro'yxat).
    function mgrOptions(lg, opts = {}) {
        const all = ALL(), k = dayKey(Date.now());
        const list = assignMgrs(lg).map(m => ({ m, load: loadOf(m.id, all), today: all.filter(l => String(l.managerId) === String(m.id) && parseT(l.managerAssignedAt) && dayKey(parseT(l.managerAssignedAt)) === k).length,
            plan: planOf(m.id).pct, stale: all.filter(l => String(l.managerId) === String(m.id) && staleOf(l)).length }))
            .filter(r => String(r.m.id) !== String(opts.exclude || '')).sort((a, b) => a.load - b.load);
        return list;
    }
    function mgrRow(r, on, showToday) {
        const least = r.least;
        return `<button type="button" role="radio" aria-checked="${on}" class="ra-mopt${on ? ' is-on' : ''}${r.stale ? ' is-warn' : ''}" data-ra-mpick="${esc(r.m.id)}"><i class="ra-radio"></i>${staffImg(r.m.id, r.m.name, 40)}
          <span class="sa-row-t"><strong>${esc(firstName(r.m.name))}${least ? ' <b class="ra-tagg">Eng kam yuklangan</b>' : r.stale ? ` <b class="ra-taga">${r.stale} qotgan lid</b>` : ''}</strong><span>${r.load} ochiq lid${showToday ? ` · bugun ${r.today} ta berildi` : ''}${r.plan != null ? ` · reja ${r.plan}%` : ''}</span></span></button>`;
    }
    function openAssignSheet() {
        const leads = ALL().filter(l => S.sel.has(l.id));
        if (!leads.length) return;
        const langs = [...new Set(leads.map(l => l._lang))];
        if (langs.length > 1) { toast('Bir tildagi lidlarni tanlang — menejerlar til boʻyicha', 'warn'); return; }
        const list = mgrOptions(langs[0]);
        if (!list.length) { toast('Bu yoʻnalishda faol sotuv menejeri yoʻq', 'warn'); return; }
        list[0].least = true;
        S.as = { pick: list[0].m.id, lg: langs[0], ids: leads.map(l => l.id) };
        const names = leads.slice(0, 3).map(l => shortName(l.name)).join(', ') + (leads.length > 3 ? ` va yana ${leads.length - 3}` : '');
        const sv = list[0].m;
        openSheet(`<div class="sa-sh-h"><div><h2>${leads.length} ta lidni kimga berasiz?</h2><span>${esc(names)}</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <div class="ra-mopts" role="radiogroup" aria-label="Menejer">${list.map(r => mgrRow(r, r.m.id === S.as.pick, true)).join('')}</div>
          <button type="button" class="sa-btn sa-btn--primary sa-cr-save" data-ra-assigngo>${esc(firstName(sv.name))}ga berish · ${leads.length} ta lid</button>
          <p class="sa-sh-foot" data-ra-asfoot>${esc(firstName(sv.name))}ga darhol bildirishnoma boradi · 30 daqiqada qoʻngʻiroq qilishi kerak</p>`, 'ra-sheet');
    }
    function doAssign(items) {
        if (!items.length || !once('assign')) return;
        document.querySelectorAll('[data-ra-assigngo], [data-ra-even]').forEach(b => { b.disabled = true; });
        const before = ALL().filter(l => !l.managerId && OPEN.has(st(l))).length;
        if (g('applyBulkLeadAssignment')) applyBulkLeadAssignment(items.map(x => ({ lang: x.lang, id: x.id, managerId: x.managerId })));
        else items.forEach(x => updateLeadInStorage(x.lang, x.id, l => ({ ...l, managerId: x.managerId })));
        closeSheet(true);
        const left = ALL().filter(l => !l.managerId && OPEN.has(st(l))).length;
        const done = Math.max(0, before - left);
        S.sel.clear();
        showAssigned(items, done || items.length, left);
    }
    function showAssigned(items, n, left) {
        const all = ALL();
        const per = {}; items.forEach(x => { per[x.managerId] = (per[x.managerId] || 0) + 1; });
        const ids = Object.keys(per);
        const one = ids.length === 1 ? ids[0] : null;
        const nm = one ? firstName(mgrName(one)) : '';
        const leads = items.map(x => all.find(l => l.id === x.id)).filter(Boolean).slice(0, 3);
        const B = [['#3B8BEE', -64, -40], ['#12B76A', 60, -46], ['#FDB022', -52, 40], ['#0065D6', 58, 36], ['#F04438', 4, -70]];
        overlay(`<section class="ra-pop" role="dialog" aria-modal="true" aria-labelledby="raPopT">
            <div class="ra-burst">${B.map(([c, x, y]) => `<span class="ra-b" style="--dx:${x}px;--dy:${y}px;background:${c}"></span>`).join('')}<span class="ra-okc">${ic('check', 34, 3)}</span></div>
            <div class="ra-pop-t"><h2 id="raPopT">${n} ta lid taqsimlandi</h2><span>${one ? `${esc(nm)}ga bildirishnoma ketdi.` : `${ids.length} menejerga bildirishnoma ketdi.`} 30 daqiqada qoʻngʻiroq qilmasa, sizga eslatamiz.</span></div>
            <div class="ra-flow" aria-label="Lidlar ${one ? esc(nm) + 'ga' : 'menejerlarga'} oʻtdi"><span class="ra-flys">${leads.map((l, i) => { const [b, f] = avColor(l.name); return `<span class="ra-fly" style="--fx:${-40 - i * 20}px;animation-delay:${i * 0.08}s;background:${b};color:${f}">${esc(initials(l.name))}</span>`; }).join('')}</span>${ic('arrow', 20, 2.2)}
              ${one ? `${staffImg(one, mgrName(one), 38)}<span class="sa-row-t"><strong>${esc(nm)} · +${per[one]}</strong><span>endi ${loadOf(one, all)} ochiq lid</span></span>` : `<span class="sa-row-t"><strong>${ids.map(id => `${esc(firstName(mgrName(id)))} +${per[id]}`).join(', ')}</strong><span>teng taqsimlandi</span></span>`}</div>
            ${left ? `<div class="ra-left"><b>${left}</b><span>ta lid hali biriktirilmagan</span></div>` : ''}
            <div class="ra-pop-a">${left ? `<button type="button" class="sa-btn sa-btn--primary" data-ra-ovgo="distribute">Qolgan ${left} tasini taqsimlash</button>` : ''}<button type="button" class="sa-link" data-ra-ovgo="home">Bosh sahifaga</button></div></section>`);
    }
    function openReassign(id, lg) {
        const l = leadById(id, lg); if (!l) return;
        const list = mgrOptions(l._lang, { exclude: l.managerId });
        if (!list.length) { toast('Boshqa faol menejer yoʻq', 'warn'); return; }
        list[0].least = true;
        S.rs = { id, lg: l._lang, pick: list[0].m.id, reason: '' };
        const cur = l.managerId ? mgrName(l.managerId) : '';
        openSheet(`<div class="sa-sh-h"><div><h2>${esc(firstName(l.name))}ni kimga berasiz?</h2><span>${esc(SHORT[st(l)] || colLabel(st(l)))} · ${callsOf(l).length} urinish · tarix saqlanadi</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          ${cur ? `<div class="ra-mopt is-cur">${staffImg(l.managerId, cur, 40)}<span class="sa-row-t"><strong>${esc(firstName(cur))}</strong><span>Hozirgi menejer</span></span>${pill('hozirgi', 'gray')}</div>` : ''}
          <div class="ra-mopts" role="radiogroup" aria-label="Menejer">${list.map(r => mgrRow(r, r.m.id === S.rs.pick, false)).join('')}</div>
          <div class="sa-fld"><span>Sabab · <em class="ra-opt">ixtiyoriy</em></span><div class="sa-qchips">${['Ulgurmayapti', 'Lid soʻradi', 'Boshqa'].map(t => `<button type="button" class="sa-qchip ra-qchip" aria-pressed="false" data-ra-rsr="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
          <button type="button" class="sa-btn sa-btn--primary sa-cr-save" data-ra-rsgo>${esc(firstName(list[0].m.name))}ga oʻtkazish</button>
          <p class="sa-sh-foot" data-ra-rsfoot>${cur && staleOf(l) ? `${esc(firstName(cur))}ning qulfi yechiladi · ` : ''}${esc(firstName(list[0].m.name))}da qotish hisobi bugundan boshlanadi (${ruleFor(l._lang).warnDays} / ${ruleFor(l._lang).lockDays} kun)</p>`, 'ra-sheet');
    }
    function doReassign() {
        const rs = S.rs; const l = rs && leadById(rs.id, rs.lg); if (!l || !rs.pick || !sheetEl || !once('reassign:' + rs.id)) return;
        S.rs = null;
        sheetEl.querySelectorAll('[data-ra-rsgo]').forEach(b => { b.disabled = true; });
        const me = user(), from = l.managerId ? mgrName(l.managerId) : 'biriktirilmagan', to = mgrName(rs.pick);
        const text = `ROP ${firstName(me.name)} lidni ${firstName(from) || from} → ${firstName(to)}ga oʻtkazdi${rs.reason ? ` · sabab: ${rs.reason}` : ''}`;
        // managerAssignedAt updateLeadInStorage'da yangilanadi — yangi menejerda qotish hisobi bugundan.
        const saved = updateLeadInStorage(l._lang, l.id, x => ({ ...x, managerId: rs.pick, comments: [...(Array.isArray(x.comments) ? x.comments : []), createLeadComment({ text, author: me.name || 'ROP', type: 'manual' })] }));
        closeSheet();
        if (!saved) { toast('Saqlab boʻlmadi', 'warn'); return; }
        if (g('renderLeads')) try { renderLeads(); } catch (e) { /* CRM sahifasi yopiq */ }
        toast(`${firstName(to)}ga oʻtkazildi`, 'ok');
        render(false);
    }
    // Lid kartasi "⋯": ROP uchun mavjud lid amallari (o'chirish ROP'ga berilmagan — "15-ish" qoidasi).
    function openCardMore(id, lg) {
        const l = leadById(id, lg); if (!l) return;
        const row = (attr, t) => `<button type="button" class="sa-opt2" ${attr}="${esc(id)}">${t}${ic('chev', 18, 2.4)}</button>`;
        openSheet(`<div class="sa-sh-h"><div><h2>${esc(l.name || 'Lid')}</h2><span>${esc(colLabel(st(l)))}</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <div class="sa-opts2">${row('data-ra-cm-sms', 'Mijozga SMS (shablon)')}${row('data-ra-cm-follow', 'Eslatma qoʻyish')}${row('data-ra-cm-rec', 'Qoʻngʻiroq yozuvlari')}${row('data-ra-cm-full', 'Toʻliq lid kartasi')}</div>`, 'ra-sheet');
    }
    function openStageSheet(id, lg) {
        const l = leadById(id, lg); if (!l) return;
        const s = st(l);
        const ordered = COLS().map(c => c.id).filter(x => PATH.includes(x) || x === 'keyin-sotib-olmoqchi');
        S.stageLead = { id, lg: l._lang };
        openSheet(`<div class="sa-sh-h"><div><h2>Bosqichni oʻzgartirish</h2><span>Hozir: ${esc(colLabel(s))}</span></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <ol class="sa-stages">${ordered.map(x => { const cur = x === s; return `<li><button type="button" class="sa-stage${cur ? ' is-cur' : ''}" ${cur ? 'aria-current="true" disabled' : `data-ra-move="${x}"`}><span class="sa-dot" style="background:${(COLS().find(c => c.id === x) || {}).border || '#9DC4F5'}"></span><span class="sa-row-t"><strong>${esc(colLabel(x))}</strong>${cur ? '<span>hozirgi</span>' : ''}</span>${cur ? '' : ic('chev', 16, 2.4)}</button></li>`; }).join('')}</ol>
          <div class="sa-close-h">YOPISH · SABAB MAJBURIY</div>
          <div class="sa-close2"><button type="button" class="sa-btn sa-btn--danger" data-ra-move="muvaffaqiyatsiz-sotuv" ${s === 'muvaffaqiyatsiz-sotuv' ? 'disabled' : ''}>Muvaffaqiyatsiz<em>qiziqmadi, narx…</em></button><button type="button" class="sa-btn sa-btn--outline" data-ra-move="sifatsiz-lidlar" ${s === 'sifatsiz-lidlar' ? 'disabled' : ''}>Sifatsiz<em>notoʻgʻri raqam…</em></button></div>`, 'sa-sheet--stages');
    }
    function openLeadAdd() {
        const langs = LANGS();
        S.la = { lang: langs[0], src: '', dupOk: '' };
        const mopts = lg => `<option value="">Biriktirmasdan</option>${mgrOptions(lg).map(r => `<option value="${esc(r.m.id)}">${esc(firstName(r.m.name))} · ${r.load} ochiq</option>`).join('')}`;
        openSheet(`<div class="sa-sh-h"><div><h2>Yangi lid</h2></div><button type="button" class="sa-icon-btn ra-x" data-ra-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <label class="ra-f"><span>Ism</span><input id="raLaName" class="ra-in" autocomplete="off" placeholder="Ism-familiya"></label>
          <label class="ra-f"><span>Telefon</span><span class="ra-in ra-in--ph" data-ra-phbox><b>+998</b><input id="raLaPhone" inputmode="tel" autocomplete="off" placeholder="90 123 45 67"></span></label>
          <div class="ra-dup" data-ra-dup hidden></div>
          <div class="ra-f"><span>Manba</span><div class="sa-qchips">${['Target', 'Organik', 'Tavsiya', 'Telegram bot', 'Qoʻngʻiroq'].map(t => `<button type="button" class="sa-qchip ra-qchip" aria-pressed="false" data-ra-lasrc="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
          <div class="ra-f2"><div class="ra-f"><span>Til</span>${langs.length > 1 ? `<select id="raLaLang" class="ra-in">${langs.map(L => `<option value="${L}">${langLabel(L)}</option>`).join('')}</select>` : `<span class="ra-in ra-in--lock">${ic('lock', 16, 2.4)}${langLabel(langs[0])}</span>`}</div>
            <label class="ra-f"><span>Darhol berish</span><select id="raLaMgr" class="ra-in">${mopts(langs[0])}</select></label></div>
          <p class="ra-err" data-ra-laerr hidden></p>
          <button type="button" class="sa-btn sa-btn--primary sa-cr-save" data-ra-lasave>Lidni qoʻshish</button>`, 'ra-sheet');
        S.la.mopts = mopts;
    }
    function saveLeadAdd() {
        const la = S.la; if (!la || !sheetEl) return;
        const name = document.getElementById('raLaName').value.trim();
        const raw = document.getElementById('raLaPhone').value.trim();
        const phone = raw ? (g('normalizeLeadPhoneInput') ? normalizeLeadPhoneInput(/^\+/.test(raw) ? raw : '+998' + raw.replace(/\D/g, '').replace(/^998/, '')) : raw) : '';
        const err = sheetEl.querySelector('[data-ra-laerr]');
        const fail = m => { err.hidden = false; err.textContent = m; };
        if (!name) return fail('Ismni kiriting');
        if (phone === null) return fail('Raqam notoʻgʻri: +998 va 9 ta raqam kerak');
        if (!la.src) return fail('Lid qayerdan kelganini tanlang');
        err.hidden = true;
        const lang = document.getElementById('raLaLang')?.value || la.lang;
        const dups = phone && g('findLeadPhoneDuplicates') ? findLeadPhoneDuplicates(phone) : [];
        if (dups.length && la.dupOk !== phone) {
            const key = phone.replace(/\D/g, '').slice(-9);
            const hit = ALL().find(l => String(l.phone || '').replace(/\D/g, '').slice(-9) === key);
            const d = dups[0], box = sheetEl.querySelector('[data-ra-dup]');
            box.hidden = false;
            box.innerHTML = `${ic('warn', 20, 2.2)}<span><strong>Bu raqam bazada bor:</strong> ${esc(shortName(d.name))} · ${esc(d.extra || d.kind)}</span>${hit ? `<button type="button" class="sa-link" data-ra-lead="${esc(hit.id)}" data-ll="${hit._lang}">Ochish</button>` : ''}`;
            sheetEl.querySelector('[data-ra-phbox]').classList.add('is-warn');
            la.dupOk = phone;
            sheetEl.querySelector('[data-ra-lasave]').textContent = 'Baribir yangi lid qilib qoʻshish';
            return;
        }
        if (!once('leadadd')) return; // dublikat ogohlantirishidan keyingi haqiqiy saqlash — bir marta
        const mgr = document.getElementById('raLaMgr').value || '';
        const me = user(), nowIso = new Date().toISOString();
        const leadType = la.src === 'Target' ? 'target' : 'organic';
        // openAddLeadModal bilan bir xil yozuv (STORAGE_KEYS.leads + persistLeadChange); server faqat ROP/admin'ga ruxsat beradi.
        const newLead = { id: 'l' + Date.now(), name, phone: phone || '', phone2: '', managerId: mgr, source: la.src === 'Target' ? 'Target (reklama)' : la.src, leadType, status: 'yangi-lidlar',
            comments: [], managerPhoto: null, attachments: [], createdAt: nowIso, slaStageEnteredAt: nowIso, managerAssignedAt: mgr ? nowIso : null, date: new Date().toLocaleDateString('uz-UZ') };
        const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
        leads[lang] = leads[lang] || [];
        leads[lang].push(newLead);
        setItem(STORAGE_KEYS.leads, leads);
        if (g('persistLeadChange')) persistLeadChange(lang, newLead).catch(e => toast(e.message || 'Serverga saqlanmadi', 'warn'));
        S.la = null;
        closeSheet();
        if (g('renderLeads')) try { renderLeads(); } catch (e) { /* yopiq */ }
        toast(`${name} — lid qoʻshildi${mgr ? ' · ' + firstName(mgrName(mgr)) + 'ga berildi' : ''}`, 'ok');
        render(false);
    }

    // Jamoa kunlik rejani bajardi — kuniga bir marta (localStorage).
    function checkWin() {
        if (!isOn() || S.screen !== 'home' || sheetEl || overlayEl || document.body.classList.contains('modal-open')) return;
        const ms = MGRS(); if (!ms.length || !g('getManagerPeriodTarget')) return;
        const target = ms.reduce((a, m) => a + getManagerPeriodTarget(m.id, 'kunlik'), 0);
        const sales = ms.reduce((a, m) => a + getManagerSalesForPeriod(m.id, 'kunlik'), 0);
        if (!(target > 0) || sales < target) return;
        const key = `dw_rop_win_${user().id || user().email || 'u'}_${dayKey(Date.now())}`;
        if (lsGet(key)) return;
        lsSet(key, '1');
        showWin(sales, target);
    }
    function showWin(sales, target) {
        const ms = MGRS().map(m => ({ m, n: getManagerDealsCount(m.id, 'kunlik') })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
        const deals = ms.reduce((a, x) => a + x.n, 0), now = new Date();
        const conf = reduceMotion() ? '' : [['8%', '#FDB022', .1], ['22%', '#FFFFFF', .5], ['37%', '#12B76A', .25], ['54%', '#F04438', .7], ['68%', '#FDB022', .15], ['82%', '#9DC4F5', .4], ['93%', '#FFFFFF', .9]].map(([l, c, d]) => `<span class="ra-c" aria-hidden="true" style="left:${l};background:${c};animation-delay:${d}s"></span>`).join('');
        const share = `https://t.me/share/url?url=${encodeURIComponent('https://myhomework.uz')}&text=${encodeURIComponent(`Jamoa bugungi rejani bajardi! ${mlnF(sales)} / ${mlnF(target)} · ${deals} toʻlov. ${ms.map(x => firstName(x.m.name) + ' +' + x.n).join(', ')} — barakalla!`)}`;
        overlay(`<section class="ra-win" role="dialog" aria-modal="true" aria-labelledby="raWinT">${conf}
            <span class="ra-win-d">${now.getDate()}-${MON[now.getMonth()].toUpperCase()} · ${hm(now)}</span>
            <img class="ra-win-img" src="images/prizes/trophy.png" alt="" width="120" height="120">
            <div class="ra-win-t"><h1 id="raWinT">Jamoa kunlik rejani bajardi!</h1><span>${mlnF(sales)} / ${mlnF(target)} · ${deals} toʻlov</span></div>
            <div class="ra-win-bar"><i></i></div>
            ${ms.length ? `<div class="ra-win-who"><span>BUGUN YOPGANLAR</span><div>${ms.slice(0, 4).map((x, i) => `<span>${staffImg(x.m.id, x.m.name, 46, i === 0 ? 'is-gold' : 'is-white')}<strong>${esc(firstName(x.m.name))}</strong><em>+${x.n}</em></span>`).join('')}</div></div>` : ''}
            <div class="ra-win-a"><a class="sa-btn ra-btn-white" href="${esc(share)}" target="_blank" rel="noopener">${ic('tg', 18, 2.2)}Jamoani guruhda tabriklash</a><button type="button" class="ra-win-x" data-ra-ovclose>Yopish</button></div></section>`, 'ra-ov--win');
    }

    // ---------- toast ----------
    function toast(msg, kind = 'ok', action) {
        toastEl?.remove();
        toastEl = document.createElement('div');
        toastEl.className = `sa-toast ra-toast sa-toast--${kind}`;
        toastEl.setAttribute('role', 'status');
        toastEl.innerHTML = `<span class="sa-toast-i">${ic(kind === 'ok' ? 'check' : kind === 'info' ? 'back' : 'warn', 14, 3)}</span><span>${esc(msg)}</span>${action ? '<button type="button">' + esc(action.label) + '</button>' : ''}`;
        if (action) toastEl.querySelector('button').onclick = () => { toastEl?.remove(); action.fn(); };
        document.body.appendChild(toastEl);
        const el = toastEl;
        setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 260); }, action ? 5000 : 3200);
    }

    // =====================================================================================
    // Navigatsiya
    // =====================================================================================
    const TABS = [
        { id: 'home', label: 'Bosh', icon: 'home' }, { id: 'leads', label: 'Lidlar', icon: 'leads' }, { id: 'trials', label: 'Jadval', icon: 'cal' },
        { id: 'team', label: 'Jamoa', icon: 'team' }, { id: 'menu', label: 'Menyu', icon: 'menu' }
    ];
    const TAB_OF = { home: 'home', notif: 'home', distribute: 'leads', leads: 'leads', card: 'leads', sla: 'home', approvals: 'menu', approval: 'menu', trials: 'trials', team: 'team', manager: 'team', funnel: 'team',
        menu: 'menu', stale: 'menu', archive: 'menu', sms: 'menu' };
    const FULL = new Set(['card', 'distribute', 'approval', 'stale', 'sms', 'notif', 'sla', 'approvals', 'archive', 'funnel', 'manager']);
    function buildNav() {
        nav = document.createElement('nav');
        nav.id = 'raNav';
        nav.className = 'sa-nav ra-nav';
        nav.setAttribute('aria-label', 'Pastki menyu');
        document.body.appendChild(nav);
        nav.addEventListener('click', e => {
            const b = e.target.closest('[data-ra-tab-nav]'); if (!b) return;
            S.stack = []; closeCrmPages(); go(b.dataset.raTabNav, { reset: true });
        });
        syncNav();
    }
    function syncNav() {
        if (!nav) return;
        const active = S.screen === 'crm' ? S.crmTab : TAB_OF[S.screen];
        const n = ALL().filter(l => !l.managerId && OPEN.has(st(l))).length;
        nav.innerHTML = TABS.map(t => `<button type="button" data-ra-tab-nav="${t.id}" class="${active === t.id ? 'is-on' : ''}" ${active === t.id ? 'aria-current="page"' : ''}${t.id === 'leads' && n ? ` aria-label="Lidlar, ${n} ta biriktirilmagan"` : ''}><span class="sa-nav-i">${ic(t.icon, 22, active === t.id ? 2.2 : 1.9)}${t.id === 'leads' && n ? `<b class="ra-nav-red">${n > 99 ? '99+' : n}</b>` : ''}</span>${t.label}</button>`).join('');
    }
    function closeCrmPages() {
        try { if (document.body.classList.contains('ss-page-open')) window.sotuvSinov?.close?.({ silent: true }); } catch (e) { /* yopiq */ }
        try { if (document.body.classList.contains('jv-page-open')) window.jadvalV3?.close?.({ silent: true }); } catch (e) { /* yopiq */ }
    }
    function go(screen, opts = {}) {
        closeOverlay();
        if (opts.reset) S.stack = [];
        else if (S.screen !== screen) S.stack.push({ screen: S.screen, lead: S.lead, leadLang: S.leadLang, apId: S.apId, mgr: S.mgr });
        if (opts.reset && screen !== 'home') S.stack = [{ screen: 'home' }];
        armGuard();
        S.screen = screen;
        if (screen === 'approvals' || screen === 'home' || screen === 'menu') loadApprovals();
        if (screen === 'stale' || screen === 'leads' || screen === 'home') loadRules().then(r => { if (r && !go._r) { go._r = 1; queueRender(); } });
        showApp(true);
        render(true);
    }
    function armGuard() { try { if (window.history?.pushState && !history.state?.raGuard) history.pushState({ raGuard: 1 }, ''); } catch (e) { /* tarix yo'q */ } }
    function back() {
        if (overlayEl) { closeOverlay(); return true; }
        if (sheetEl) { closeSheet(); return true; }
        const pageOpen = document.body.classList.contains('jv-page-open') || document.body.classList.contains('ss-page-open');
        if (pageOpen && S.screen !== 'crm') { closeCrmPages(); return true; }
        closeCrmPages();
        const prev = S.stack.pop();
        if (!prev) { if (S.screen !== 'home') { go('home', { reset: true }); return true; } return false; }
        Object.assign(S, { screen: prev.screen, lead: prev.lead, leadLang: prev.leadLang, apId: prev.apId, mgr: prev.mgr });
        if (S.screen === 'crm') { go('home', { reset: true }); return true; }
        showApp(true);
        render(true);
        return true;
    }
    function openLead(id, lg) { S.lead = id; S.leadLang = lg || null; closeSheet(true); go('card'); }
    function openCrm(spec) {
        openCrm._busy = true;
        try {
            const [tab, section] = String(spec).split(':');
            S.stack.push({ screen: S.screen, lead: S.lead, leadLang: S.leadLang, apId: S.apId, mgr: S.mgr });
            armGuard();
            S.crmTab = TAB_OF[S.screen] || 'menu';
            S.screen = 'crm';
            showApp(false);
            closeSheet(true);
            if (g('switchTab')) switchTab(tab, section ? { salesSection: section } : {});
            if (section && g('switchSalesSection')) switchSalesSection(section);
            syncNav();
            window.scrollTo?.(0, 0);
        } finally { openCrm._busy = false; }
    }
    function openTrialPage(opts) {
        if (!window.sotuvSinov?.open) { openCrm('timetable'); return; }
        S.stack.push({ screen: S.screen, lead: S.lead, leadLang: S.leadLang });
        armGuard();
        S.crmTab = 'trials'; S.screen = 'crm'; showApp(false); closeSheet(true);
        const ok = window.sotuvSinov.open({ from: 'trials', onClose: () => back(), ...opts });
        if (ok === false) { back(); toast('Sinov oynasini ochib boʻlmadi', 'warn'); }
        syncNav();
    }
    function showApp(on) {
        if (!on) document.body.classList.remove('ra-full');
        document.body.classList.toggle('ra-app-hidden', !on);
        document.body.classList.toggle('ra-crm-page', !on);
        if (root) root.hidden = !on;
    }

    // ---------- chizish ----------
    const SCREENS = { home: screenHome, leads: screenLeads, card: screenCard, distribute: screenDistribute, sla: screenSla, approvals: screenApprovals, approval: screenApproval,
        trials: screenTrials, team: screenTeam, manager: screenManager, funnel: screenFunnel, stale: screenStale, archive: screenArchive, sms: screenSms, notif: screenNotif, menu: screenMenu };
    function render(scrollTop) {
        if (!root || !isOn()) return;
        if (S.screen === 'crm') { document.body.classList.remove('ra-full'); syncNav(); return; }
        document.body.classList.toggle('ra-full', FULL.has(S.screen));
        let html;
        try { html = (SCREENS[S.screen] || screenHome)(); }
        catch (e) { console.error('[ropApp]', e); html = `<div class="sa-body">${empty('offline', 'Ekranni chizib boʻlmadi', e.message || '', '<button type="button" class="sa-btn sa-btn--primary" data-ra-nav="home">Bosh sahifa</button>')}</div>`; }
        const keep = {};
        root.querySelectorAll('textarea[id], input[id]').forEach(el => { if (el.id !== 'raLeadSearch' && el.value) keep[el.id] = el.value; });
        const focusId = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
        const focusSearch = document.activeElement?.id === 'raLeadSearch';
        const caret = focusSearch ? document.activeElement.selectionStart : 0;
        const prevScroll = root.querySelector('.sa-body')?.scrollTop || 0;
        root.dataset.screen = S.screen;
        root.innerHTML = html;
        const body = root.querySelector('.sa-body');
        if (body && !scrollTop) body.scrollTop = prevScroll;
        if (scrollTop) { root.classList.remove('sa-enter'); void root.offsetWidth; root.classList.add('sa-enter'); }
        Object.keys(keep).forEach(id => { const el = document.getElementById(id); if (el && !el.value) el.value = keep[id]; });
        if (focusId && focusId !== 'raLeadSearch') document.getElementById(focusId)?.focus({ preventScroll: true });
        if (focusSearch) { const i = document.getElementById('raLeadSearch'); if (i) { i.focus(); try { i.setSelectionRange(caret, caret); } catch (e) { /* type=search */ } } }
        syncNav();
        if (S.screen === 'home') setTimeout(checkWin, 600);
    }
    function queueRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => {
            renderQueued = false;
            const a = document.activeElement;
            const typing = a && root?.contains(a) && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName) && a.id !== 'raLeadSearch';
            if (typing) { setTimeout(queueRender, 4000); return; }
            if (!sheetEl && !overlayEl && !document.body.classList.contains('modal-open')) render(false);
            else if (sheetEl && S.ta?.draw) { const d = S.sched[(trialOf(S.ta.id, S.ta.lg)?.at || {}).date]; if (d && !d.loading) S.ta.draw(d); }
        });
    }

    // ---------- hodisalar ----------
    function onClick(e) {
        const t = e.target.closest('[data-ra-go],[data-ra-nav],[data-ra-back],[data-ra-lead],[data-ra-man],[data-ra-stage],[data-ra-clearq],[data-ra-leadadd],[data-ra-reassign],[data-ra-hist],[data-ra-tglead],[data-ra-notify],[data-ra-stagesheet],[data-ra-move],[data-ra-sheetclose],[data-ra-selall],[data-ra-pick],[data-ra-even],[data-ra-assignsheet],[data-ra-mpick],[data-ra-assigngo],[data-ra-rsr],[data-ra-rsgo],[data-ra-ack],[data-ra-aptab],[data-ra-ap],[data-ra-apreload],[data-ra-approve],[data-ra-reject],[data-ra-rjk],[data-ra-rjr],[data-ra-rjsave],[data-ra-apnext],[data-ra-ovgo],[data-ra-ovclose],[data-ra-trday],[data-ra-trseg],[data-ra-tassign],[data-ra-tapick],[data-ra-tasave],[data-ra-tremind],[data-ra-tadmin],[data-ra-tresched],[data-ra-tmore],[data-ra-tcancel],[data-ra-tcr],[data-ra-tcsave],[data-ra-trialnew],[data-ra-tper],[data-ra-mgr],[data-ra-mleads],[data-ra-funper],[data-ra-stlang],[data-ra-step],[data-ra-stsave],[data-ra-artab],[data-ra-arreload],[data-ra-restore],[data-ra-smsg],[data-ra-smssend],[data-ra-ncat],[data-ra-nread],[data-ra-nitem],[data-ra-crm],[data-ra-logout],[data-ra-lasrc],[data-ra-lasave],[data-ra-cardmore],[data-ra-cm-sms],[data-ra-cm-follow],[data-ra-cm-rec],[data-ra-cm-full]');
        if (!t) return;
        const d = t.dataset;
        if (t.tagName === 'A' && t.getAttribute('href')) return; // tel:, t.me — o'zi ochiladi
        if ('raPick' in d || 'raSelall' in d) {
            if ('raPick' in d) { if (t.checked) S.sel.add(d.raPick); else S.sel.delete(d.raPick); }
            else { const un = ALL().filter(l => !l.managerId && OPEN.has(st(l))); if (t.checked) un.forEach(l => S.sel.add(l.id)); else S.sel.clear(); }
            render(false); return;
        }
        e.preventDefault();
        if ('raSheetclose' in d) return closeSheet();
        if ('raOvclose' in d) { closeOverlay(); return; }
        if ('raOvgo' in d) { closeOverlay(); const v = d.raOvgo; if (v.startsWith('ap:')) { S.apId = v.slice(3); S.apChk = {}; S.screen = 'approval'; render(true); return; } if (v === 'approvals') { S.apTab = 'pending'; S.stack = [{ screen: 'home' }]; S.screen = 'approvals'; render(true); return; } return go(v, { reset: v === 'home' }); }
        if ('raGo' in d) { if (d.raGo === 'approvals') S.apTab = 'pending'; return go(d.raGo); }
        if ('raNav' in d) return go(d.raNav, { reset: true });
        if ('raBack' in d) { if (!back()) go('home', { reset: true }); return; }
        if ('raLead' in d) return openLead(d.raLead, d.ll);
        if ('raMan' in d) { S.man = d.raMan; render(true); return; }
        if ('raStage' in d) { S.stage = d.raStage; render(true); root.querySelector('.sa-chip.is-on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
        if ('raClearq' in d) { S.q = ''; render(true); return; }
        if ('raLeadadd' in d) return openLeadAdd();
        if ('raLasrc' in d) { S.la.src = d.raLasrc; sheetEl.querySelectorAll('[data-ra-lasrc]').forEach(b => { const on = b === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); return; }
        if ('raLasave' in d) return saveLeadAdd();
        if ('raReassign' in d) { const l = leadById(d.raReassign, S.leadLang); return openReassign(d.raReassign, l?._lang); }
        if ('raHist' in d) { document.getElementById('raHist')?.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
        if ('raTglead' in d) { const l = leadById(d.raTglead, S.leadLang); if (l && g('openLeadTelegramProfile')) openLeadTelegramProfile(l._lang, l.id); return; }
        if ('raNotify' in d) { const l = leadById(d.raNotify, S.leadLang); if (l) ackSla(l.id, l._lang); return; }
        if ('raStagesheet' in d) return openStageSheet(d.raStagesheet, S.leadLang);
        if ('raCardmore' in d) return openCardMore(d.raCardmore, S.leadLang);
        if ('raCmSms' in d || 'raCmFollow' in d || 'raCmRec' in d || 'raCmFull' in d) {
            const l = leadById(d.raCmSms || d.raCmFollow || d.raCmRec || d.raCmFull, S.leadLang); closeSheet(true); if (!l) return;
            if ('raCmSms' in d && g('openLeadSmsTemplateModal')) openLeadSmsTemplateModal(l._lang, l.id);
            else if ('raCmFollow' in d && g('openLeadFollowUpReminderModal')) openLeadFollowUpReminderModal(l._lang, l.id, l.name, user().name);
            else if ('raCmRec' in d && g('openLeadRecordingModal')) openLeadRecordingModal(l._lang, l.id);
            else if ('raCmFull' in d && g('openLeadOverview')) openLeadOverview(l._lang, l.id);
            return;
        }
        if ('raMove' in d) { const sl = S.stageLead; closeSheet(true); if (sl && g('requestLeadStageChange')) requestLeadStageChange(sl.lg, sl.id, d.raMove); return; }
        if ('raEven' in d) { const sel = ALL().filter(l => S.sel.has(l.id)); const plan = evenPlan(sel); if (!plan.length) { toast('Faol menejer topilmadi', 'warn'); return; } return doAssign(plan.map(p => ({ lang: p.lang, id: p.leadId, managerId: p.managerId }))); }
        if ('raAssignsheet' in d) return openAssignSheet();
        if ('raMpick' in d) {
            const st2 = S.rs && sheetEl?.querySelector('[data-ra-rsgo]') ? S.rs : S.as; if (!st2) return;
            st2.pick = d.raMpick;
            sheetEl.querySelectorAll('[data-ra-mpick]').forEach(b => { const on = b === t; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
            const nm = firstName(mgrName(d.raMpick));
            const go2 = sheetEl.querySelector('[data-ra-assigngo]'); if (go2) { go2.textContent = `${nm}ga berish · ${S.as.ids.length} ta lid`; sheetEl.querySelector('[data-ra-asfoot]').textContent = `${nm}ga darhol bildirishnoma boradi · 30 daqiqada qoʻngʻiroq qilishi kerak`; }
            const rs = sheetEl.querySelector('[data-ra-rsgo]'); if (rs) { rs.textContent = `${nm}ga oʻtkazish`; const f = sheetEl.querySelector('[data-ra-rsfoot]'); if (f) f.textContent = f.textContent.replace(/ · [^·]+da qotish/, ` · ${nm}da qotish`).replace(/^[^·]+da qotish/, `${nm}da qotish`); }
            return;
        }
        if ('raAssigngo' in d) { const as = S.as; if (!as) return; return doAssign(as.ids.map(id => ({ lang: as.lg, id, managerId: as.pick }))); }
        if ('raRsr' in d) { S.rs.reason = S.rs.reason === d.raRsr ? '' : d.raRsr; sheetEl.querySelectorAll('[data-ra-rsr]').forEach(b => { const on = b.dataset.raRsr === S.rs.reason; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); return; }
        if ('raRsgo' in d) return doReassign();
        if ('raAck' in d) return ackSla(d.raAck, d.ll);
        if ('raAptab' in d) { S.apTab = d.raAptab; render(true); return; }
        if ('raAp' in d) { S.apId = d.raAp; S.apDone = 0; return go('approval'); }
        if ('raApreload' in d) { loadApprovals(true); return; }
        if ('raApprove' in d) { t.disabled = true; return decide(S.apId, 'approve', ''); }
        if ('raReject' in d) return openRejectSheet(d.raReject);
        if ('raRjk' in d) return syncReject(d.raRjk);
        if ('raRjr' in d) { S.rj.reason = d.raRjr; syncReject(); if (d.raRjr === 'Boshqa') document.getElementById('raRjNote')?.focus(); return; }
        if ('raRjsave' in d) { const note = document.getElementById('raRjNote')?.value.trim() || ''; t.disabled = true; return decide(S.apId, S.rj.kind, [S.rj.reason === 'Boshqa' ? '' : S.rj.reason, note].filter(Boolean).join(' — ')); }
        if ('raApnext' in d) { S.apTab = 'pending'; S.stack.pop(); S.screen = 'approvals'; render(true); return; }
        if ('raTrday' in d) { S.trDay = d.raTrday; render(true); return; }
        if ('raTrseg' in d) { if (d.raTrseg === 'trial') return openTrialPage({ lang: LANGS()[0] }); if (d.raTrseg === 'lessons') return openCrm('timetable'); return; }
        if ('raTrialnew' in d) return openTrialPage({ lang: LANGS()[0] });
        if ('raTassign' in d) return openTrialAssign(d.raTassign, d.ll);
        if ('raTapick' in d) { S.ta.pick = d.raTapick; const e2 = S.sched[(trialOf(S.ta.id, S.ta.lg)?.at || {}).date]; if (e2) S.ta.draw(e2); return; }
        if ('raTasave' in d) return saveTrialAssign();
        if ('raTremind' in d) { closeSheet(true); return ropRemind(trialOf(d.raTremind, d.ll)); }
        if ('raTadmin' in d) return ropAdminOpen(trialOf(d.raTadmin, d.ll));
        if ('raTresched' in d) { const x = trialOf(d.raTresched, d.ll); return openTrialPage({ lang: x?.lead._lang || d.ll, leadId: d.raTresched, isReschedule: true }); }
        if ('raTmore' in d) return openTrialMore(d.raTmore, d.ll);
        if ('raTcancel' in d) return openTrialCancel(d.raTcancel, d.ll);
        if ('raTcr' in d) { S.tc.reason = d.raTcr; syncTc(); if (/^Boshqa/.test(d.raTcr)) document.getElementById('raTcNote')?.focus(); return; }
        if ('raTcsave' in d) return saveTrialCancel();
        if ('raTper' in d) { S.teamPer = d.raTper; render(true); return; }
        if ('raMgr' in d) { S.mgr = d.raMgr; return go('manager'); }
        if ('raMleads' in d) { S.man = d.raMleads; S.q = ''; return go('leads', { reset: true }); }
        if ('raFunper' in d) { S.funPer = S.funPer === 'oylik' ? 'haftalik' : S.funPer === 'haftalik' ? 'kunlik' : 'oylik'; render(true); return; }
        if ('raStlang' in d) { S.staleLang = d.raStlang; render(false); return; }
        if ('raStep' in d) {
            const [k, dv] = d.raStep.split(':'); const lg = S.staleLang && LANGS().includes(S.staleLang) ? S.staleLang : LANGS()[0];
            const dr = S.staleDraft[lg]; const LIM = { warnDays: [1, 60], lockDays: [2, 90], callsPerDay: [1, 300] }[k];
            dr[k] = Math.max(LIM[0], Math.min(LIM[1], dr[k] + Number(dv) * (k === 'callsPerDay' ? 5 : 1)));
            if (k === 'warnDays' && dr.lockDays <= dr.warnDays) dr.lockDays = dr.warnDays + 1;
            if (k === 'lockDays' && dr.lockDays <= dr.warnDays) dr.warnDays = Math.max(1, dr.lockDays - 1);
            render(false); return;
        }
        if ('raStsave' in d) return saveStale();
        if ('raArtab' in d) { S.arTab = d.raArtab; render(true); return; }
        if ('raArreload' in d) { loadArchive(S.arTab, true); return; }
        if ('raRestore' in d) return restoreItem(t);
        if ('raSmsg' in d) { S.sms = d.raSmsg; render(false); return; }
        if ('raSmssend' in d) return sendSms();
        if ('raNcat' in d) { S.notifCat = d.raNcat; render(true); return; }
        if ('raNread' in d) { if (g('markAllNotificationsRead')) markAllNotificationsRead(); render(false); return; }
        if ('raNitem' in d) return openNotifItem(d.raNitem);
        if ('raCrm' in d) return openCrm(d.raCrm);
        if ('raLogout' in d) { document.getElementById('profileLogoutBtn')?.click(); return; }
    }
    function onInput(e) {
        const id = e.target.id;
        if (id === 'raLeadSearch') { S.q = e.target.value; clearTimeout(onInput._t); onInput._t = setTimeout(() => render(true), 160); return; }
        if (id === 'raSmsText') { S.smsText = e.target.value; clearTimeout(onInput._s); onInput._s = setTimeout(() => { const n = root.querySelector('.ra-smsn'); if (n) render(false); }, 400); return; }
        if (id === 'raRjNote') return syncReject();
        if (id === 'raTcNote') return syncTc();
        if (id === 'raLaPhone' && S.la) { S.la.dupOk = ''; sheetEl?.querySelector('[data-ra-dup]')?.setAttribute('hidden', ''); sheetEl?.querySelector('[data-ra-phbox]')?.classList.remove('is-warn'); const b = sheetEl?.querySelector('[data-ra-lasave]'); if (b) b.textContent = 'Lidni qoʻshish'; return; }
        if (id === 'raLaLang' && S.la) { const s2 = document.getElementById('raLaMgr'); if (s2) s2.innerHTML = S.la.mopts(e.target.value); }
    }

    // Mavjud renderlar ishlaganda (30 soniyalik so'rov, saqlash, modal yopilishi) ekranimiz ham yangilanadi.
    function hookRenders() {
        ['renderDashboard', 'renderLeads', 'renderSales', 'renderNotificationPanel'].forEach(name => {
            const orig = window[name];
            if (typeof orig !== 'function' || orig._ra) return;
            const w = function () { const r = orig.apply(this, arguments); if (isOn() && S.screen !== 'crm') queueRender(); return r; };
            w._ra = true; if (orig._sa) w._sa = true;
            window[name] = w;
            try { if (name === 'renderLeads') renderLeads = w; else if (name === 'renderDashboard') renderDashboard = w; else if (name === 'renderSales') renderSales = w; else if (name === 'renderNotificationPanel') renderNotificationPanel = w; } catch (e) { /* global binding */ }
        });
        document.getElementById('modalOverlay')?.addEventListener('crm:modal-closed', () => { if (isOn() && S.screen !== 'crm') setTimeout(() => render(false), 60); });
        window.addEventListener('school:changed', () => { if (isOn()) { S.sched = {}; queueRender(); } });
    }

    function enable() {
        document.body.classList.add('ra-on');
        armGuard();
        if (!root) {
            root = document.createElement('main');
            root.id = 'raApp';
            root.className = 'sa-app ra-app';
            document.body.appendChild(root);
            root.addEventListener('click', onClick);
            root.addEventListener('input', onInput);
        }
        if (!nav) buildNav();
        if (window.schoolUI?.loadStaffAvatars && !enable._av) { enable._av = true; Promise.resolve(window.schoolUI.loadStaffAvatars()).then(() => queueRender()).catch(() => {}); }
        loadApprovals(); loadRules().then(() => queueRender());
        showApp(S.screen !== 'crm');
        render(true);
    }
    function disable() {
        document.body.classList.remove('ra-on', 'ra-app-hidden', 'ra-crm-page', 'ra-full');
        closeSheet(true, true); closeOverlay();
        if (root) root.hidden = true;
        try { if (history.state?.raGuard) history.back(); } catch (e) { /* tarix yo'q */ }
    }
    function sync() { if (isOn()) enable(); else disable(); }

    function init() {
        if (inited) return;
        if (user().role !== 'rop') return;
        inited = true;
        hookRenders();
        window.addEventListener('popstate', () => {
            if (!isOn()) return;
            let handled = false;
            const ov = document.getElementById('modalOverlay');
            if (ov && ov.style.display !== 'none' && g('closeModal')) { closeModal(); handled = true; }
            else if (overlayEl) { closeOverlay(); handled = true; }
            else if (sheetEl) { closeSheet(false, true); handled = true; }
            else handled = back();
            if (handled) armGuard();
            else if (S.screen === 'home') toast('Chiqish uchun yana bir marta “Orqaga” bosing', 'info');
        });
        MQ.addEventListener?.('change', sync);
        new MutationObserver(() => {
            if (!isOn()) return;
            const open = document.body.classList.contains('jv-page-open') || document.body.classList.contains('ss-page-open');
            if (open && !S.pageMode) { S.pageMode = true; if (S.screen !== 'crm') { document.body.classList.add('ra-app-hidden'); if (root) root.hidden = true; } }
            else if (!open && S.pageMode) { S.pageMode = false; if (S.screen !== 'crm') { showApp(true); render(false); } }
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        // switchTab boshqa joydan chaqirilsa (masalan CRM sahifasidan "Bosh sahifa") — ilovaga qaytamiz.
        const orig = window.switchTab;
        if (typeof orig === 'function' && !orig._ra) {
            const w = function (tab, ctx) {
                const r = orig.apply(this, arguments);
                if (isOn() && !openCrm._busy) {
                    if (S.screen === 'crm' && tab === 'dashboard') { S.screen = 'home'; showApp(true); render(true); }
                    else if (S.screen !== 'crm' && tab !== 'dashboard' && booted) {
                        S.stack.push({ screen: S.screen, lead: S.lead, leadLang: S.leadLang });
                        armGuard();
                        S.crmTab = tab === 'timetable' ? 'trials' : TAB_OF[S.screen] || 'menu'; S.screen = 'crm'; showApp(false); syncNav();
                    }
                }
                return r;
            };
            w._ra = true; if (orig._sa) w._sa = true; if (orig._team) w._team = true;
            window.switchTab = w;
        }
        setInterval(() => { if (isOn() && S.screen !== 'crm' && !document.hidden) { if (['home', 'approvals', 'menu'].includes(S.screen)) loadApprovals(); queueRender(); } }, 60000);
        const wait = (n = 0) => {
            const ready = g('getItem') && (getItem(STORAGE_KEYS.leads, null) || n > 40);
            if (ready) { sync(); setTimeout(() => { booted = true; }, 1500); return; }
            if (isOn() && !root) { enable(); root.innerHTML = `<div class="sa-body">${'<div class="sa-sk" style="height:96px"></div>'.repeat(4)}</div>`; }
            setTimeout(() => wait(n + 1), 150);
        };
        wait();
    }

    window.ropApp = { open: go, openLead, back, render: () => render(false), state: S, closeSheet: () => closeSheet(true) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 60));
    else setTimeout(init, 60);
})();
