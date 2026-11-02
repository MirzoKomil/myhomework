// Domwork Team — HR menejer telefon ilovasi (2026-11, "Domwork Team — Sotuv ilovasi" kanvasi, "HR" sahifasi).
// Faqat role=hr va ekran ≤900px bo'lganda yoqiladi; kompyuter ko'rinishi (CRM → HR bo'limi) o'zgarmaydi.
// Ma'lumot manbalari mavjud API'lar: /api/hr/* (nomzodlar, bosqichlar — hrStages.js bitta manba),
// /api/staff-attendance/* (davomat, yuz tasdiqlash), state.hrEmployees (xodimlar; moliya maydonlari serverda kesilgan).
// Til: HR'da berilgan yo'nalish (english | russian | both). Server ham nomzodlarni shu bo'yicha cheklaydi.
// Uslublar: css/hrApp.css.
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const DAY = 86400000;
    const g = name => (typeof window[name] === 'function' ? window[name] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isOn = () => user().role === 'hr' && MQ.matches;
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
    const pad = n => String(n).padStart(2, '0');
    const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const WDS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
    const dayDiff = t => Math.round((new Date(new Date(t).toDateString()) - new Date(new Date().toDateString())) / DAY);
    const when = t => {
        const d = new Date(t), diff = dayDiff(t);
        const day = diff === 0 ? 'Bugun' : diff === -1 ? 'Kecha' : diff === 1 ? 'Ertaga' : `${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}`;
        return `${day} ${hm(t)}`;
    };
    const ago = t => {
        const ms = Date.now() - new Date(t).getTime(); const h = Math.floor(ms / 3600000);
        if (h >= 24) return Math.floor(h / 24) + ' kun'; if (h >= 1) return h + ' soat'; return Math.max(1, Math.round(ms / 60000)) + ' daq';
    };
    const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const AV = [['#DCEBFF', '#0057B8'], ['#FEF0C7', '#93370D'], ['#ECFDF3', '#067647'], ['#F1E8FF', '#5B21B6'], ['#FFE4E8', '#9F1239'], ['#E0F2FE', '#075985']];
    const avIdx = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % AV.length; };
    const ava = (name, size = 42) => { const [b, f] = AV[avIdx(name)]; return `<span class="hra-ava" aria-hidden="true" style="width:${size}px;height:${size}px;background:${b};color:${f};font-size:${Math.round(size / 3)}px">${esc(initials(name))}</span>`; };

    // ---------- ikonkalar ----------
    const P = {
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        cand: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        team: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>', down: '<path d="M6 9l6 6 6-6"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.6 2.8.7a2 2 0 011.7 2z"/>',
        tg: '<path d="M21.5 4.5L2.5 11.8l6.2 2.3 2.4 6.4 3.4-4.1 4.8 3.6z"/><path d="M8.7 14.1l12.8-9.6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
        office: '<path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
        video: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5L21.5 7v10l-6-3.5"/>',
        face: '<path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"/><circle cx="12" cy="11" r="3"/><path d="M8.5 17a4 4 0 017 0"/>',
        brief: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A1.5 1.5 0 019.5 4h5A1.5 1.5 0 0116 5.5V7M3 12.5h18"/>',
        note: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
        task: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
        out: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
        lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
        undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
        inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M3 13h5l1.5 3h5L16 13h5"/>',
        desk: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
        alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
    };
    const ic = (n, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

    // ---------- holat ----------
    const S = { screen: 'home', stage: 'kandidatlar', lang: 'all', q: '', cand: null, day: 0, roleF: 'all', stack: [] };
    const D = { meta: null, cands: [], att: null, emps: null, loaded: false, err: '' };
    let root, nav, sheetEl, toastEl, inited = false, callPending = null, undoTimer = null;

    const REJECT = ['rad-javobi', 'filtrdan-otmagan'];
    const CALL_STAGES = ['birinchi-filtr', 'qayta-aloqa', 'javob-bermadi'];
    const TONE = { 'kandidatlar': 'gray', 'birinchi-filtr': 'blue', 'javob-bermadi': 'amber', 'qayta-aloqa': 'amber', 'suhbat-belgilandi': 'purple', 'suhbatga-keldi': 'blue', 'test': 'blue', 'yakuniy-suhbat': 'purple', 'ishga-olindi': 'green', 'rad-javobi': 'gray', 'filtrdan-otmagan': 'gray' };
    const chip = (t, tone = 'gray') => `<span class="hra-chip hra-${tone}">${esc(t)}</span>`;

    const myLangs = () => { const l = user().linkedHrLangs; return Array.isArray(l) && l.length ? l : ['english', 'russian']; };
    const both = () => myLangs().length > 1;
    const vacOf = c => (D.meta?.vacancies || []).find(v => v.id === c.vacancyId);
    const langOf = c => vacOf(c)?.lang || null;
    const langLabel = l => l === 'english' ? 'Ingliz' : l === 'russian' ? 'Rus' : 'Umumiy';
    const fitsLang = c => S.lang === 'all' || langOf(c) === null || langOf(c) === S.lang;
    const stageLabel = id => (D.meta?.stages || []).find(s => s.id === id)?.label || id;
    const stages = () => D.meta?.stages || [];
    const visibleCands = () => D.cands.filter(fitsLang);
    const byStage = id => visibleCands().filter(c => c.stage === id);
    const attempts = c => (c.comments || []).filter(x => /^Javob bermadi/.test(x.text || '')).length;

    // ---------- ma'lumot ----------
    async function load(force) {
        try {
            if (!D.meta) D.meta = await apiFetch('/api/hr/meta');
            const r = await apiFetch('/api/hr/candidates', force ? { fresh: true } : {});
            D.cands = (r.candidates || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            D.err = '';
        } catch (e) { D.err = e.message || 'Maʼlumot yuklanmadi'; }
        D.loaded = true;
        loadAtt();
        render(false);
    }
    async function loadAtt() {
        try {
            const [daily, emps] = await Promise.all([
                apiFetch('/api/staff-attendance/daily?date=' + localDate(), { fresh: true }),
                apiFetch('/api/staff-attendance/employees', { fresh: true })]);
            D.att = daily; D.emps = emps || [];
        } catch (e) { D.att = D.att || { rows: [], summary: {}, error: e.message }; D.emps = D.emps || []; }
        if (['home', 'att', 'staff', 'emp'].includes(S.screen)) render(false);
    }
    async function patch(id, body, okMsg) {
        try {
            const r = await apiFetch('/api/hr/candidates/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) });
            const i = D.cands.findIndex(c => c.id === id);
            if (i >= 0 && r.candidate) D.cands[i] = r.candidate;
            if (okMsg) toast(okMsg);
            render(false);
            return r.candidate;
        } catch (e) { toast(e.message || 'Saqlab boʻlmadi', 'bad'); return null; }
    }
    const comment = (text) => ({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), text, author: user().name || 'HR', createdAt: new Date().toISOString() });
    const withComment = (c, text) => [...(c.comments || []), comment(text)];
    const mediaUrl = (id, kind) => '/api/hr/candidates/' + encodeURIComponent(id) + '/media/' + kind + '?token=' + encodeURIComponent(g('getToken') ? getToken() : '');
    const staff = () => (g('getItem') ? getItem(STORAGE_KEYS.hrEmployees, []) : []).filter(e => e.status !== 'inactive' && !e.offboardedAt);

    // ---------- umumiy bo'laklar ----------
    function top(title, { back = true, sub = '', right = '' } = {}) {
        return `<header class="hra-top">${back ? `<button type="button" class="hra-ibtn" data-h-back aria-label="Orqaga">${ic('back', 20, 2.2)}</button>` : ''}
            <div class="hra-top-t"><h1>${esc(title)}</h1>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${right}</header>`;
    }
    function langSeg() {
        if (!both()) return '';
        const o = [['russian', 'Rus tili'], ['english', 'Ingliz tili'], ['all', 'Ikkalasi']];
        return `<div class="hra-seg" role="tablist" aria-label="Til yoʻnalishi">${o.map(([id, l]) => `<button type="button" role="tab" aria-selected="${S.lang === id}" data-h-lang="${id}">${l}</button>`).join('')}</div>`;
    }
    function empty(icon, title, sub) { return `<div class="hra-empty"><span>${ic(icon, 28, 1.8)}</span><strong>${esc(title)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`; }
    function candRow(c, { triage = false, badge = '' } = {}) {
        const v = vacOf(c);
        const facts = [c.birthYear ? c.birthYear + '-yil' : '', c.address || '', c.hasLaptop ? 'noutbuk bor' : '', (c.media || []).includes('voice') ? 'ovoz' : ''].filter(Boolean).join(' · ');
        return `<article class="hra-card hra-crow">
            <button type="button" class="hra-crow-main" data-h-cand="${esc(c.id)}">${ava(c.fullName)}
                <span class="hra-crow-t"><strong>${esc(c.fullName || 'Nomzod')}</strong><small>${esc(v?.label || c.vacancyName || '')} · ${langLabel(langOf(c))}</small>${facts ? `<em>${esc(facts)}</em>` : ''}</span>
                ${badge || chip(ago(c.createdAt), 'gray')}</button>
            ${triage ? `<div class="hra-two"><button type="button" class="hra-btn hra-btn-danger" data-h-reject="${esc(c.id)}">${ic('x', 16, 2.6)}Oʻtmadi</button><button type="button" class="hra-btn hra-btn-primary" data-h-pass="${esc(c.id)}">${ic('check', 16, 2.6)}1-filtrdan oʻtdi</button></div>` : ''}
        </article>`;
    }

    // ---------- ekranlar ----------
    function scrHome() {
        const u = user(); const now = new Date();
        const ints = visibleCands().filter(c => c.interviewAt && c.stage === 'suhbat-belgilandi' && dayDiff(c.interviewAt) === 0).sort((a, b) => new Date(a.interviewAt) - new Date(b.interviewAt));
        const next = ints.find(c => new Date(c.interviewAt) > new Date(Date.now() - 30 * 60000)) || null;
        const faces = (D.emps || []).filter(e => e.face === 'pending');
        const calls = CALL_STAGES.reduce((a, s) => a + byStage(s).length, 0);
        const rejectAsk = byStage('javob-bermadi').filter(c => attempts(c) >= 3);
        const q = [
            ['cand', 'Yangi nomzodlar', byStage('kandidatlar').length, byStage('kandidatlar')[0] ? 'eng eskisi ' + ago(byStage('kandidatlar')[0].createdAt) + ' kutmoqda' : '', 'red', { stage: 'kandidatlar' }],
            ['phone', 'Qoʻngʻiroqlar', calls, `1-filtrdan oʻtgan ${byStage('birinchi-filtr').length} · qayta aloqa ${byStage('qayta-aloqa').length} · javob bermagan ${byStage('javob-bermadi').length}`, 'amber', { stage: 'birinchi-filtr' }],
            ['x', 'Rad etishni hal qiling', rejectAsk.length, rejectAsk[0] ? rejectAsk[0].fullName + ' · 3 marta javob bermadi' : '', 'red', { stage: 'javob-bermadi' }],
            ['note', 'Suhbat natijasi kiritilmagan', byStage('suhbatga-keldi').length, byStage('suhbatga-keldi').map(c => c.fullName).slice(0, 2).join(', '), 'amber', { stage: 'suhbatga-keldi' }],
            ['task', 'Test bosqichida', byStage('test').length, byStage('test').map(c => c.fullName).slice(0, 2).join(', '), 'blue', { stage: 'test' }],
            ['face', 'Yuz rasmini tasdiqlash', faces.length, faces.map(e => e.name).slice(0, 2).join(', '), 'blue', { screen: 'att' }],
        ].filter(x => x[2] > 0);
        const week = visibleCands().filter(c => Date.now() - new Date(c.createdAt) < 7 * DAY);
        const order = stages().map(s => s.id);
        const reached = id => week.filter(c => !REJECT.includes(c.stage) && order.indexOf(c.stage) >= order.indexOf(id)).length;
        const fun = [['Ariza', week.length], ['Suhbat', reached('suhbat-belgilandi')], ['Yakuniy', reached('yakuniy-suhbat')], ['Ishga', reached('ishga-olindi')]];
        const max = Math.max(1, week.length);
        return `${window.davomat ? davomat.homeCard() : ''}${langSeg()}
            ${next ? `<section class="hra-hero"><div class="hra-hero-h"><span>KEYINGI SUHBAT</span><span>Bugun ${ints.length} ta</span></div>
                <div class="hra-hero-p">${ava(next.fullName, 48)}<div><strong>${hm(next.interviewAt)} · ${esc(next.fullName)}</strong><small>${esc(vacOf(next)?.label || '')}${next.interviewLocation ? ' · ' + esc(next.interviewLocation) : ''}</small></div></div>
                <div class="hra-two"><button type="button" class="hra-btn hra-btn-primary" data-h-cand="${esc(next.id)}">${ic('user', 18, 2.3)}Kartani ochish</button><button type="button" class="hra-btn hra-btn-glass" data-h-nav="ints">${ic('cal', 18, 2.2)}Barcha suhbatlar</button></div></section>`
            : `<section class="hra-hero"><div class="hra-hero-h"><span>BUGUN</span><span>${WD[now.getDay()]}</span></div><div class="hra-hero-p"><div><strong>Bugun suhbat yoʻq</strong><small>“1-filtrdan oʻtdi”dagi nomzodlarni chaqiring</small></div></div></section>`}
            <section class="hra-card"><div class="hra-h2"><h2>Navbat</h2><span>eng muhimi tepada</span></div>
                ${q.length ? q.map(([icn, t, n, s, tone, go]) => `<button type="button" class="hra-qrow" data-h-go='${esc(JSON.stringify(go))}'><span class="hra-qi hra-${tone}">${ic(icn, 20)}</span><span class="hra-qt"><strong>${t}</strong>${s ? `<small>${esc(s)}</small>` : ''}</span><span class="hra-qn hra-${tone}">${n}</span>${ic('chev', 18)}</button>`).join('')
                : `<p class="hra-muted">Hamma ish bajarilgan. Yangi arizalar botdan avtomatik tushadi.</p>`}</section>
            <section class="hra-card"><div class="hra-h2"><h2>Bu hafta</h2><button type="button" class="hra-link" data-h-nav="vacs">Vakansiyalar</button></div>
                ${fun.map(([l, n], i) => `<div class="hra-fun"><span>${l}</span><span class="hra-bar"><i style="width:${Math.round(n / max * 100)}%;background:${['#B9D6FA', '#6AA8F2', '#0065D6', '#067647'][i]}"></i></span><strong>${n}</strong></div>`).join('')}</section>`;
    }

    function scrCands() {
        const list = byStage(S.stage).filter(c => !S.q || (c.fullName || '').toLowerCase().includes(S.q.toLowerCase()) || String(c.contactPhone || c.telegramPhone || '').includes(S.q));
        const chips = stages().map(s => { const n = byStage(s.id).length; return `<button type="button" class="hra-schip" aria-pressed="${S.stage === s.id}" data-h-stage="${s.id}">${esc(s.label)}<span>${n}</span></button>`; }).join('');
        const total = visibleCands().filter(c => !REJECT.includes(c.stage) && c.stage !== 'ishga-olindi').length;
        return `<div class="hra-tabhead">
                <div class="hra-th"><h1>Nomzodlar <small>${total}</small></h1></div>
                <label class="hra-search">${ic('search', 18)}<span class="hra-sr">Nomzod qidirish</span><input type="search" placeholder="Ism yoki telefon" value="${esc(S.q)}" data-h-q></label>
                ${langSeg()}
                <div class="hra-chips" role="group" aria-label="Bosqich">${chips}</div></div>
            <div class="hra-list">${list.length ? list.map(c => candRow(c, {
                triage: c.stage === 'kandidatlar',
                badge: c.stage === 'kandidatlar' ? chip(ago(c.createdAt), Date.now() - new Date(c.createdAt) > DAY ? 'red' : 'gray')
                    : c.interviewAt && ['suhbat-belgilandi', 'yakuniy-suhbat'].includes(c.stage) ? chip(when(c.interviewAt), 'purple')
                    : c.stage === 'javob-bermadi' ? chip(attempts(c) + '-urinish', attempts(c) >= 3 ? 'red' : 'amber')
                    : chip(stageLabel(c.stage), TONE[c.stage] || 'gray')
            })).join('') : empty('inbox', 'Bu bosqichda hozir hech kim yoʻq', S.q ? 'Qidiruvni oʻzgartiring' : 'Boshqa bosqich yoki tilni tanlang')}</div>`;
    }

    function scrCard() {
        const c = D.cands.find(x => x.id === S.cand);
        if (!c) return top('Nomzod') + `<div class="hra-body">${empty('inbox', 'Nomzod topilmadi', 'Boshqa til yoʻnalishida yoki oʻchirilgan')}</div>`;
        const v = vacOf(c); const labels = D.meta?.questionLabels || {};
        const ans = Object.entries(c.answers || {}).filter(([, val]) => val !== '' && val != null);
        const media = c.media || [];
        const phone = c.contactPhone || c.telegramPhone || '';
        const tgHref = c.telegramUsername ? 'https://t.me/' + encodeURIComponent(String(c.telegramUsername).replace(/^@/, '')) : '';
        const hist = [...(c.comments || [])].reverse();
        const order = stages().map(s => s.id).filter(id => !REJECT.includes(id));
        const nextId = order[order.indexOf(c.stage) + 1];
        const nextBtn = REJECT.includes(c.stage) ? `<button type="button" class="hra-btn hra-btn-primary" data-h-restore>${ic('undo', 18, 2.3)}Kandidatlarga qaytarish</button>`
            : c.stage === 'suhbat-belgilandi' ? `<button type="button" class="hra-btn hra-btn-primary" data-h-came>${ic('check', 18, 2.6)}Suhbatga keldi</button>`
            : c.stage === 'suhbatga-keldi' || c.stage === 'yakuniy-suhbat' ? `<button type="button" class="hra-btn hra-btn-primary" data-h-result>${ic('check', 18, 2.6)}Suhbat natijasi</button>`
            : CALL_STAGES.includes(c.stage) || c.stage === 'kandidatlar' ? `<button type="button" class="hra-btn hra-btn-primary" data-h-schedule>${ic('cal', 18, 2.3)}Suhbat belgilash</button>`
            : nextId ? `<button type="button" class="hra-btn hra-btn-primary" data-h-setstage="${nextId}">${esc(stageLabel(nextId))}</button>` : '';
        return top('Nomzod', { right: '' }) + `<div class="hra-body hra-pad-sticky">
            <section class="hra-person">${ava(c.fullName, 64)}<div><strong>${esc(c.fullName || 'Nomzod')}</strong><span>${esc(v?.label || c.vacancyName || '')}</span>
                <div class="hra-row-chips"><button type="button" class="hra-stagebtn" data-h-stagesheet aria-label="Bosqich: ${esc(stageLabel(c.stage))}. Oʻzgartirish"><span class="hra-chip hra-${TONE[c.stage] || 'gray'}">${esc(stageLabel(c.stage))}${c.interviewAt && c.stage === 'suhbat-belgilandi' ? ' · ' + esc(when(c.interviewAt)) : ''}${ic('down', 14, 2.4)}</span></button>${chip(langLabel(langOf(c)))}</div></div></section>
            <div class="hra-acts">
                ${phone ? `<a class="hra-act" href="tel:${esc(phone.replace(/[^\d+]/g, ''))}" data-h-call="${esc(c.id)}">${ic('phone', 20, 2.1)}Qoʻngʻiroq</a>` : `<span class="hra-act hra-act-off">${ic('phone', 20, 2.1)}Raqam yoʻq</span>`}
                ${tgHref ? `<a class="hra-act" href="${tgHref}" target="_blank" rel="noopener">${ic('tg', 20, 2.1)}Telegram</a>` : `<span class="hra-act hra-act-off">${ic('tg', 20, 2.1)}Telegram yoʻq</span>`}
                <button type="button" class="hra-act" data-h-schedule>${ic('cal', 20, 2.1)}Suhbat</button></div>
            <section class="hra-card hra-kv">
                ${c.telegramPhone ? `<div><span>Telegram raqami</span><b>${esc(c.telegramPhone)}</b></div>` : ''}
                ${c.contactPhone && c.contactPhone !== c.telegramPhone ? `<div><span>Aloqa raqami</span><b>${esc(c.contactPhone)}</b></div>` : ''}
                ${c.birthYear ? `<div><span>Tugʻilgan yili</span><b>${esc(c.birthYear)} (~${new Date().getFullYear() - Number(c.birthYear)} yosh)</b></div>` : ''}
                ${c.address ? `<div><span>Manzil</span><b>${esc(c.address)}</b></div>` : ''}
                <div class="hra-row-chips">${c.hasLaptop != null ? chip(c.hasLaptop ? 'Noutbuk bor' : 'Noutbuk yoʻq', c.hasLaptop ? 'green' : 'gray') : ''}${c.readyForOffice != null ? chip(c.readyForOffice ? 'Ofisga tayyor' : 'Ofisga tayyor emas', c.readyForOffice ? 'green' : 'gray') : ''}${c.utmSource ? chip('Manba: ' + c.utmSource) : ''}</div></section>
            ${media.length ? `<section class="hra-media">${media.includes('photo') ? `<img src="${mediaUrl(c.id, 'photo')}" alt="${esc(c.fullName)} rasmi" loading="lazy">` : ''}
                ${media.includes('voice') ? `<div><span>Ovozli xabar</span><audio controls preload="none" src="${mediaUrl(c.id, 'voice')}"></audio></div>` : ''}
                ${media.includes('video') ? `<div><span>Video</span><video controls preload="none" playsinline src="${mediaUrl(c.id, 'video')}"></video></div>` : ''}</section>` : ''}
            ${ans.length ? `<section class="hra-card"><div class="hra-h2"><h2>Anketa</h2>${chip(v?.label || '', 'blue')}</div>${ans.map(([k, val]) => `<div class="hra-qa"><span>${esc(labels[k] || k)}</span><b>${esc(typeof val === 'boolean' ? (val ? 'Ha' : 'Yoʻq') : val)}</b></div>`).join('')}</section>` : ''}
            <section class="hra-card"><div class="hra-h2"><h2>Tarix</h2></div>
                <form class="hra-cform" data-h-comment><label class="hra-sr" for="hraNote">Izoh</label><textarea id="hraNote" rows="2" placeholder="Izoh qoʻshish…"></textarea><button type="submit" class="hra-btn hra-btn-soft">Saqlash</button></form>
                ${hist.map(h => `<div class="hra-tl"><i class="${h.type === 'system' ? 'hra-tl-sys' : ''}"></i><div><strong>${esc(h.text)}</strong><small>${esc(h.author || '')} · ${esc(when(h.createdAt))}</small></div></div>`).join('')}
                <div class="hra-tl"><i class="hra-tl-sys"></i><div><strong>Botdan ariza keldi</strong><small>${esc(c.utmSource || '@Homework_HR_bot')} · ${esc(when(c.createdAt))}</small></div></div></section>
        </div>
        <div class="hra-sticky"><div class="hra-stk">${REJECT.includes(c.stage) ? '' : `<button type="button" class="hra-ibtn hra-ibtn-danger" data-h-reject="${esc(c.id)}" aria-label="Rad etish">${ic('x', 20, 2.5)}</button>`}${nextBtn}</div></div>`;
    }

    function scrInts() {
        const tabs = [['Bugun', 0], ['Ertaga', 1], ['Hafta', 7]];
        const INT_STAGES = ['suhbat-belgilandi', 'suhbatga-keldi', 'test', 'yakuniy-suhbat'];
        const list = visibleCands().filter(c => c.interviewAt && INT_STAGES.includes(c.stage)).filter(c => {
            const d = dayDiff(c.interviewAt); return S.day === 7 ? d >= 0 && d < 7 : d === S.day;
        }).sort((a, b) => new Date(a.interviewAt) - new Date(b.interviewAt));
        const cnt = d => visibleCands().filter(c => c.interviewAt && INT_STAGES.includes(c.stage) && (d === 7 ? dayDiff(c.interviewAt) >= 0 && dayDiff(c.interviewAt) < 7 : dayDiff(c.interviewAt) === d)).length;
        return `<div class="hra-tabhead"><div class="hra-th"><h1>Suhbatlar</h1></div>
                <div class="hra-seg" role="tablist" aria-label="Kun">${tabs.map(([l, d]) => `<button type="button" role="tab" aria-selected="${S.day === d}" data-h-day="${d}">${l} · ${cnt(d)}</button>`).join('')}</div></div>
            <div class="hra-list">${langSeg()}${list.length ? list.map(c => {
                const past = new Date(c.interviewAt) < new Date(); const pending = c.stage === 'suhbat-belgilandi';
                const online = /telegram|video|onlayn/i.test(c.interviewLocation || '');
                return `<div class="hra-slot"><div class="hra-slot-t"><strong>${hm(c.interviewAt)}</strong>${S.day === 7 ? `<small>${WDS[new Date(c.interviewAt).getDay()]}</small>` : ''}</div>
                    <article class="hra-card ${pending && past ? 'hra-now' : ''}"><button type="button" class="hra-crow-main" data-h-cand="${esc(c.id)}">${ava(c.fullName)}<span class="hra-crow-t"><strong>${esc(c.fullName)}</strong><small>${esc(vacOf(c)?.label || '')}</small></span>${pending ? '' : chip(stageLabel(c.stage), TONE[c.stage])}</button>
                    ${c.interviewLocation ? `<div class="hra-loc">${ic(online ? 'video' : 'office', 16)}${esc(c.interviewLocation)}</div>` : ''}
                    ${pending && past ? `<div class="hra-two"><button type="button" class="hra-btn hra-btn-green" data-h-came="${esc(c.id)}">${ic('check', 18, 2.6)}Keldi</button><button type="button" class="hra-btn hra-btn-danger" data-h-noshow="${esc(c.id)}">${ic('x', 18, 2.6)}Kelmadi</button></div>` : ''}</article></div>`;
            }).join('') : empty('cal', S.day === 0 ? 'Bugun suhbat yoʻq' : 'Suhbat belgilanmagan', '“1-filtrdan oʻtdi”dagi nomzodlarni chaqiring')}</div>`;
    }

    const ROLE_GROUP = r => /sotuv/.test(r) ? 'Sotuv' : /yordamchi/.test(r) ? 'Yordamchi' : /oqituvchi/.test(r) ? 'Oʻqituvchi' : r === 'rop' ? 'ROP' : 'Boshqa';
    const empLang = e => /ingliz/.test(e.role) ? 'english' : /rus/.test(e.role) ? 'russian' : e.lang === 'both' ? null : (e.lang || null);
    function scrStaff() {
        const all = staff().filter(e => S.lang === 'all' || empLang(e) === null || empLang(e) === S.lang);
        const groups = ['Sotuv', 'Oʻqituvchi', 'Yordamchi', 'ROP', 'Boshqa'];
        const list = all.filter(e => (S.roleF === 'all' || ROLE_GROUP(e.role) === S.roleF) && (!S.q || String(e.name || '').toLowerCase().includes(S.q.toLowerCase())));
        const att = new Map((D.att?.rows || []).map(r => [String(r.employeeId), r]));
        const roleName = r => (window.HR_ROLE_MAP && HR_ROLE_MAP[r]) || r;
        return `<div class="hra-tabhead"><div class="hra-th"><h1>Xodimlar <small>${all.length}</small></h1></div>
                <label class="hra-search">${ic('search', 18)}<span class="hra-sr">Xodim qidirish</span><input type="search" placeholder="Ism" value="${esc(S.q)}" data-h-q></label>
                ${langSeg()}
                <div class="hra-chips" role="group" aria-label="Lavozim"><button type="button" class="hra-schip" aria-pressed="${S.roleF === 'all'}" data-h-role="all">Barchasi<span>${all.length}</span></button>${groups.map(gname => { const n = all.filter(e => ROLE_GROUP(e.role) === gname).length; return n ? `<button type="button" class="hra-schip" aria-pressed="${S.roleF === gname}" data-h-role="${gname}">${gname}<span>${n}</span></button>` : ''; }).join('')}</div></div>
            <div class="hra-list"><section class="hra-card hra-plist">${list.length ? list.map(e => {
                const a = att.get(String(e.id)); const st = a ? ATT[a.status] : null;
                return `<button type="button" class="hra-prow" data-h-emp="${esc(e.id)}">${ava(e.name, 44)}<span class="hra-crow-t"><strong>${esc(e.name)}</strong><small>${esc(roleName(e.role))}${empLang(e) ? ' · ' + langLabel(empLang(e)) : ''}</small></span>${st && st[1] !== 'gray' ? chip(st[0] + (a.status === 'late' && a.lateMinutes ? ' ' + a.lateMinutes + ' daq' : ''), st[1]) : chip('Faol', 'green')}</button>`;
            }).join('') : empty('team', 'Xodim topilmadi')}</section></div>`;
    }
    const ATT = { on_time: ['Vaqtida', 'green'], late: ['Kechikdi', 'amber'], absent: ['Kelmadi', 'red'], waiting: ['Kutilmoqda', 'gray'], upcoming: ['Hali erta', 'gray'], off: ['Dam olish', 'gray'], before: ['Hisob boshlanmagan', 'gray'], not_ready: ['Yuz tasdiqlanmagan', 'gray'], extra: ['Dam kunida keldi', 'blue'], leave: ['Taʼtilda', 'blue'], excused: ['Sababli', 'blue'], present: ['Keldi (qoʻlda)', 'green'] };

    function scrEmp() {
        const e = staff().find(x => String(x.id) === String(S.emp));
        if (!e) return top('Xodim') + `<div class="hra-body">${empty('team', 'Xodim topilmadi')}</div>`;
        const a = (D.att?.rows || []).find(r => String(r.employeeId) === String(e.id));
        const se = (D.emps || []).find(x => String(x.id) === String(e.id));
        const roleName = (window.HR_ROLE_MAP && HR_ROLE_MAP[e.role]) || e.role;
        const DAYS = [['1', 'Du'], ['2', 'Se'], ['3', 'Ch'], ['4', 'Pa'], ['5', 'Ju'], ['6', 'Sh'], ['7', 'Ya']];
        const sched = se?.days ? DAYS.filter(([k]) => se.days[k]).map(([k, l]) => `${l} ${se.days[k].start}–${se.days[k].end}`).join(' · ') : '';
        return top('Xodim') + `<div class="hra-body">
            <section class="hra-person">${ava(e.name, 64)}<div><strong>${esc(e.name)}</strong><span>${esc(roleName)}${empLang(e) ? ' · ' + langLabel(empLang(e)) + ' tili' : ''}</span>
                <div class="hra-row-chips">${chip('Faol' + (e.startDate ? ' · ' + e.startDate : ''), 'green')}</div></div></section>
            <section class="hra-card"><div class="hra-h2"><h2>Bugungi davomat</h2></div>
                ${se?.isTeacher ? '<p class="hra-muted">Oʻqituvchi kamera bilan belgilanmaydi — darslari boʻyicha tekshiriladi.</p>'
                : a ? `<div class="hra-kv"><div><span>Holat</span><b>${chip((ATT[a.status] || [a.status])[0], (ATT[a.status] || [0, 'gray'])[1])}</b></div>${a.inClock ? `<div><span>Keldi</span><b>${esc(a.inClock)}</b></div>` : ''}${a.outClock ? `<div><span>Ketdi</span><b>${esc(a.outClock)}</b></div>` : ''}</div>
                    ${['late', 'absent'].includes(a.status) || a.overridden ? `<button type="button" class="hra-btn hra-btn-soft" data-h-fix="${esc(e.id)}">${ic('note', 18)}Sabab bilan tuzatish</button>` : ''}`
                : '<p class="hra-muted">Davomat kuzatilmaydi.</p>'}
                ${sched ? `<div class="hra-kv"><div><span>Grafik</span><b>${esc(sched)}</b></div></div>` : ''}</section>
            <section class="hra-card hra-kv"><div class="hra-h2"><h2>Maʼlumotlar</h2></div>
                ${e.phone ? `<div><span>Telefon</span><b><a href="tel:${esc(String(e.phone).replace(/[^\d+]/g, ''))}">${esc(e.phone)}</a></b></div>` : ''}
                ${e.login ? `<div><span>Login</span><b>${esc(e.login)}</b></div>` : ''}
                ${e.department ? `<div><span>Boʻlim</span><b>${esc(e.department)}</b></div>` : ''}</section>
            <div class="hra-note">${ic('lock', 18)}<span>Maosh va karta raqami — Moliyada. Ishdan boʻshatishni faqat direktor qiladi. Grafik va maʼlumotni tahrirlash — kompyuter versiyasida.</span></div>
        </div>`;
    }

    function scrAtt() {
        const a = D.att;
        if (!a) return top('Davomat', { sub: 'Yuklanmoqda…' }) + `<div class="hra-body">${'<div class="hra-sk"></div>'.repeat(3)}</div>`;
        const rows = a.rows || []; const sm = a.summary || {};
        const segs = [['on_time', '#079455'], ['late', '#F79009'], ['absent', '#D92D20'], ['waiting', '#98A2B3'], ['upcoming', '#CBD5E1']];
        const tot = Math.max(1, rows.filter(r => !['off', 'before', 'not_ready'].includes(r.status)).length);
        const present = (sm.on_time || 0) + (sm.late || 0) + (sm.present || 0);
        const R = 42, C = 2 * Math.PI * R; let acc = 0;
        const arcs = segs.map(([k, col]) => { const L = C * (sm[k] || 0) / tot; const s = L > 0 ? `<circle cx="54" cy="54" r="${R}" fill="none" stroke="${col}" stroke-width="14" stroke-dasharray="${Math.max(0, L - 2).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 54 54)"/>` : ''; acc += L; return s; }).join('');
        const faces = (D.emps || []).filter(e => e.face === 'pending');
        const order = { absent: 0, late: 1, waiting: 2, on_time: 3 };
        const list = [...rows].sort((x, y) => (order[x.status] ?? 5) - (order[y.status] ?? 5));
        return top('Davomat', { sub: `${WD[new Date().getDay()]} · kuzatiladigan ${rows.length} xodim` }) + `<div class="hra-body">
            ${a.error ? `<div class="hra-alert" role="alert">${ic('alert', 20)}<span>${esc(a.error)}</span></div>` : ''}
            <section class="hra-card"><div class="hra-donut"><div><svg width="108" height="108" viewBox="0 0 108 108" role="img" aria-label="Bugun ${present} xodim ofisda"><circle cx="54" cy="54" r="${R}" fill="none" stroke="#EEF2F7" stroke-width="14"/>${arcs}</svg><span aria-hidden="true"><strong>${present}/${tot}</strong><small>ofisda</small></span></div>
                <div class="hra-legend">${segs.map(([k, col]) => `<span><i style="background:${col}"></i>${ATT[k][0]}<b>${sm[k] || 0}</b></span>`).join('')}</div></div></section>
            ${faces.map(f => `<section class="hra-card hra-face"><div class="hra-h2"><h2>Yuz rasmini tasdiqlash</h2></div>
                <div class="hra-face-p"><img alt="${esc(f.name)} yuz rasmi" data-h-photo="${esc(f.facePhotoId || '')}"><div><strong>${esc(f.name)}</strong><small>${esc((window.HR_ROLE_MAP && HR_ROLE_MAP[f.role]) || f.role)}</small></div></div>
                <div class="hra-two"><button type="button" class="hra-btn hra-btn-ghost" data-h-face="${esc(f.id)}" data-h-decision="reject" data-h-pid="${esc(f.facePhotoId || '')}">Qayta olsin</button><button type="button" class="hra-btn hra-btn-primary" data-h-face="${esc(f.id)}" data-h-decision="approve" data-h-pid="${esc(f.facePhotoId || '')}">${ic('check', 16, 2.6)}Tasdiqlash</button></div></section>`).join('')}
            <section class="hra-card hra-plist">${list.length ? list.map(r => { const st = ATT[r.status] || [r.status, 'gray']; const fix = ['late', 'absent'].includes(r.status) || r.overridden;
                return `<button type="button" class="hra-prow" ${fix ? `data-h-fix="${esc(r.employeeId)}"` : `data-h-emp="${esc(r.employeeId)}"`}>${ava(r.name, 40)}<span class="hra-crow-t"><strong>${esc(r.name)}</strong><small>${r.inClock ? 'keldi ' + esc(r.inClock) : r.start ? 'grafik ' + esc(r.start) + ' dan' : ''}</small></span>${chip(st[0] + (r.status === 'late' && r.lateMinutes ? ' ' + r.lateMinutes + ' daq' : ''), st[1])}</button>`;
            }).join('') : empty('face', 'Kuzatiladigan xodim yoʻq', 'Grafikni kompyuter versiyasida belgilang')}</section>
            <p class="hra-muted hra-c">Oʻqituvchilar kamera bilan belgilanmaydi — darslar boʻyicha</p></div>`;
    }

    function scrVacs() {
        const vs = D.meta?.vacancies || []; const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
        return top('Vakansiyalar', { sub: `${vs.length} ta · @Homework_HR_bot` }) + `<div class="hra-body">${vs.filter(v => S.lang === 'all' || v.lang === null || v.lang === S.lang || !both() && (v.lang === null || myLangs().includes(v.lang))).map(v => {
            const mine = D.cands.filter(c => c.vacancyId === v.id);
            const m = mine.filter(c => new Date(c.createdAt) >= month).length; const nw = mine.filter(c => c.stage === 'kandidatlar').length;
            return `<button type="button" class="hra-card hra-vrow" data-h-vac="${esc(v.id)}"><span class="hra-qi hra-blue">${ic('brief', 20)}</span><span class="hra-crow-t"><strong>${esc(v.label)}</strong><small>${langLabel(v.lang)} · shu oy ${m} ariza</small></span>${nw ? chip('+' + nw + ' yangi', 'red') : ''}</button>`;
        }).join('')}</div>`;
    }

    function scrMenu() {
        const u = user();
        const row = (icn, t, attr) => `<button type="button" class="hra-mrow" ${attr}><span class="hra-qi hra-blue">${ic(icn, 18)}</span><span>${t}</span>${ic('chev', 18)}</button>`;
        return `<div class="hra-tabhead"><div class="hra-th"><h1>Menyu</h1></div></div><div class="hra-body">
            <section class="hra-card hra-person-s">${ava(u.name, 54)}<div><strong>${esc(u.name || '')}</strong><span>HR menejer · ${myLangs().map(langLabel).join(' va ')} tili</span></div></section>
            <section class="hra-card hra-mlist">${row('brief', 'Vakansiyalar', 'data-h-nav="vacs"')}${row('face', 'Davomat va yuz tasdiqlash', 'data-h-nav="att"')}${window.davomat?.menuInfo().tracked ? row('cal', 'Mening davomatim', 'data-dv-go="my"') : ''}${row('desk', 'Kompyuter versiyasi (HR boʻlimi)', 'data-h-crm')}</section>
            <section class="hra-card hra-mlist">${row('user', 'Profil, parol va bildirishnomalar', 'data-h-profile')}</section>
            <button type="button" class="hra-logout" data-h-logout>${ic('out', 18, 2.2)}Chiqish</button></div>`;
    }

    // ---------- chizish ----------
    const TABS = { home: 'home', cands: 'cands', ints: 'ints', staff: 'staff', menu: 'menu' };
    function render(anim) {
        if (!root || !isOn()) return;
        const keepScroll = root.querySelector('.hra-body, .hra-list')?.scrollTop || 0;
        let html;
        if (!D.loaded) html = `<div class="hra-body">${'<div class="hra-sk"></div>'.repeat(4)}</div>`;
        else if (S.screen === 'home') {
            const u = user(); const d = new Date();
            html = `<header class="hra-top hra-top-home"><button type="button" class="hra-me" data-h-nav="menu" aria-label="Profil va menyu">${esc(initials(u.name))}</button>
                <div class="hra-top-t"><span>${WD[d.getDay()]}, ${d.getDate()}-${MON[d.getMonth()]} · HR${both() ? '' : ' · ' + langLabel(myLangs()[0]) + ' tili'}</span><h1>Xayrli kun, ${esc(String(u.name || '').split(/\s+/)[0])}</h1></div></header>
                ${D.err ? `<div class="hra-body"><div class="hra-alert" role="alert">${ic('alert', 20)}<span>${esc(D.err)}</span><button type="button" class="hra-btn hra-btn-ghost" data-h-reload>Qayta urinish</button></div></div>` : `<div class="hra-body">${scrHome()}</div>`}`;
        }
        else if (S.screen === 'cands') html = scrCands();
        else if (S.screen === 'card') html = scrCard();
        else if (S.screen === 'ints') html = scrInts();
        else if (S.screen === 'staff') html = scrStaff();
        else if (S.screen === 'emp') html = scrEmp();
        else if (S.screen === 'att') html = scrAtt();
        else if (S.screen === 'vacs') html = scrVacs();
        else html = scrMenu();
        root.innerHTML = html;
        root.dataset.screen = S.screen;
        root.classList.toggle('hra-enter', !!anim);
        if (!anim) { const b = root.querySelector('.hra-body, .hra-list'); if (b) b.scrollTop = keepScroll; }
        root.querySelectorAll('img[data-h-photo]').forEach(hydratePhoto);
        syncNav();
    }
    async function hydratePhoto(img) {
        const id = img.dataset.hPhoto; if (!id) return;
        try { const r = await fetch('/api/staff-attendance/photos/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + getToken() } }); if (r.ok) img.src = URL.createObjectURL(await r.blob()); } catch (e) { /* rasm yo'q */ }
    }
    function buildNav() {
        nav = document.createElement('nav');
        nav.className = 'hra-nav'; nav.setAttribute('aria-label', 'Pastki menyu');
        nav.innerHTML = [['home', 'home', 'Bosh'], ['cands', 'cand', 'Nomzodlar'], ['ints', 'cal', 'Suhbatlar'], ['staff', 'team', 'Xodimlar'], ['menu', 'menu', 'Menyu']]
            .map(([id, icn, l]) => `<button type="button" data-h-nav="${id}"><span>${ic(icn, 20, 2)}</span>${l}</button>`).join('');
        nav.addEventListener('click', onClick);
        document.body.appendChild(nav);
    }
    function syncNav() {
        if (!nav) return;
        const tab = TABS[S.screen] || (S.screen === 'card' ? 'cands' : S.screen === 'emp' ? 'staff' : S.screen === 'att' || S.screen === 'vacs' ? 'menu' : 'home');
        nav.querySelectorAll('[data-h-nav]').forEach(b => { const on = b.dataset.hNav === tab; b.toggleAttribute('aria-current', on); if (on) b.setAttribute('aria-current', 'page'); });
        nav.hidden = !isOn() || S.screen === 'crm';
    }
    function go(screen, extra = {}) {
        const isTab = !!TABS[screen];
        if (isTab) S.stack = []; else S.stack.push({ screen: S.screen, cand: S.cand, emp: S.emp });
        Object.assign(S, extra, { screen });
        if (isTab && screen !== 'cands' && screen !== 'staff') S.q = '';
        try { history.pushState({ hra: 1 }, ''); } catch (e) { /* tarix yo'q */ }
        render(true);
    }
    function back() {
        if (sheetEl) { closeSheet(); return true; }
        const p = S.stack.pop(); if (!p) { if (S.screen !== 'home') { S.screen = 'home'; render(true); return true; } return false; }
        Object.assign(S, p); render(true); return true;
    }
    function toast(msg, kind = 'ok', undo) {
        toastEl?.remove(); clearTimeout(undoTimer);
        toastEl = document.createElement('div');
        toastEl.className = 'hra-toast hra-toast-' + kind; toastEl.setAttribute('role', 'status');
        toastEl.innerHTML = `<span>${kind === 'bad' ? ic('alert', 18) : ic('check', 18, 2.6)}</span><span>${esc(msg)}</span>${undo ? `<button type="button">${ic('undo', 16, 2.2)}Qaytarish</button>` : ''}`;
        if (undo) toastEl.querySelector('button').onclick = () => { toastEl?.remove(); undo(); };
        document.body.appendChild(toastEl);
        undoTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, undo ? 6000 : 3000);
    }

    // ---------- pastki oynalar ----------
    function openSheet(title, sub, body, onReady) {
        closeSheet(true);
        sheetEl = document.createElement('div');
        sheetEl.className = 'hra-sheet-wrap';
        sheetEl.innerHTML = `<div class="hra-dim" data-h-close></div><section class="hra-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><span class="hra-grab" aria-hidden="true"></span>
            <div class="hra-sheet-h"><div><h2>${esc(title)}</h2>${sub ? `<span>${esc(sub)}</span>` : ''}</div><button type="button" class="hra-ibtn hra-ibtn-round" data-h-close aria-label="Yopish">${ic('x', 18, 2.4)}</button></div>${body}</section>`;
        document.body.appendChild(sheetEl);
        sheetEl.addEventListener('click', e => { if (e.target.closest('[data-h-close]')) closeSheet(); });
        setTimeout(() => sheetEl?.querySelector('input:checked, button.hra-pick[aria-pressed="true"], textarea, input')?.focus({ preventScroll: true }), 60);
        if (onReady) onReady(sheetEl);
    }
    function closeSheet(quiet) { sheetEl?.remove(); sheetEl = null; if (!quiet) syncNav(); }
    const radios = (name, opts, sel) => `<div class="hra-radios" role="radiogroup" aria-label="${esc(name)}">${opts.map(([v, t, hint]) => `<label class="hra-radio"><input type="radio" name="${esc(name)}" value="${esc(v)}" ${v === sel ? 'checked' : ''}><span>${esc(t)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`).join('')}</div>`;
    const picks = (name, opts, sel) => `<div class="hra-picks" data-h-picks="${esc(name)}">${opts.map(([v, t]) => `<button type="button" class="hra-pick" aria-pressed="${v === sel}" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>`;
    const pickVal = (wrap, name) => wrap.querySelector(`[data-h-picks="${name}"] .hra-pick[aria-pressed="true"]`)?.dataset.v || '';
    function bindPicks(wrap) {
        wrap.addEventListener('click', e => { const b = e.target.closest('.hra-pick'); if (!b) return; b.parentElement.querySelectorAll('.hra-pick').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    }
    const curCand = () => D.cands.find(c => c.id === S.cand);

    function sheetStage(c) {
        const opts = stages().filter(s => !REJECT.includes(s.id)).map(s => [s.id, s.label, s.id === c.stage ? 'hozir' : s.id === 'ishga-olindi' ? 'tabrik' : '']);
        openSheet('Bosqichni oʻzgartirish', `${c.fullName} · ${vacOf(c)?.label || ''}`, `${radios('Bosqich', opts, c.stage)}
            <label class="hra-sr" for="hraStageNote">Izoh</label><textarea id="hraStageNote" rows="2" placeholder="Izoh (ixtiyoriy)"></textarea>
            <button type="button" class="hra-btn hra-btn-primary hra-btn-lg" data-ok>Saqlash</button>
            <button type="button" class="hra-link hra-link-danger" data-rej>Rad etish…</button>`, w => {
            w.querySelector('[data-ok]').onclick = async () => {
                const v = w.querySelector('input[name="Bosqich"]:checked')?.value; const note = w.querySelector('textarea').value.trim();
                if (!v || v === c.stage && !note) { closeSheet(); return; }
                closeSheet();
                const r = await patch(c.id, { stage: v, ...(note ? { comments: withComment(c, note) } : {}) }, 'Saqlandi');
                if (r && v === 'ishga-olindi') celebrate(r);
            };
            w.querySelector('[data-rej]').onclick = () => sheetReject(c);
        });
    }
    function sheetReject(c) {
        const ours = ['Talablarga mos emas', 'Til darajasi yetarli emas', 'Tajriba yetarli emas', 'Suhbatga kelmadi', 'Javob bermadi (3 marta)', 'Boshqa'];
        const theirs = ['Maosh mos emas', 'Boshqa ish topdi', 'Masofa', 'Ish vaqti mos emas', 'Boshqa'];
        openSheet('Rad etish', `${c.fullName} · ${vacOf(c)?.label || ''}`, `<span class="hra-lbl">Kim rad etdi</span>${picks('who', [['filtrdan-otmagan', 'Biz rad etdik'], ['rad-javobi', 'Nomzod rad etdi']], 'filtrdan-otmagan')}
            <span class="hra-lbl">Sabab *</span><div data-reasons>${picks('why', ours.map(x => [x, x]), '')}</div>
            <label class="hra-sr" for="hraRejNote">Izoh</label><textarea id="hraRejNote" rows="2" placeholder="Izoh (ixtiyoriy)"></textarea>
            <button type="button" class="hra-btn hra-btn-red hra-btn-lg" data-ok>Rad etish</button>`, w => {
            bindPicks(w);
            w.querySelector('[data-h-picks="who"]').addEventListener('click', () => setTimeout(() => {
                const who = pickVal(w, 'who'); w.querySelector('[data-reasons]').innerHTML = picks('why', (who === 'rad-javobi' ? theirs : ours).map(x => [x, x]), '');
            }));
            w.querySelector('[data-ok]').onclick = async () => {
                const who = pickVal(w, 'who'), why = pickVal(w, 'why'), note = w.querySelector('textarea').value.trim();
                if (!why) { toast('Sababni tanlang', 'bad'); return; }
                closeSheet();
                const prev = c.stage;
                const r = await patch(c.id, { stage: who, comments: withComment(c, `Rad etildi (${who === 'rad-javobi' ? 'nomzod rad etdi' : 'biz rad etdik'}): ${why}${note ? ' — ' + note : ''}`) });
                if (r) toast(`${c.fullName} — rad etildi`, 'ok', () => patch(c.id, { stage: prev }, 'Qaytarildi'));
                if (S.screen === 'card') back();
            };
        });
    }
    function slotsFor(dateStr, exceptId) {
        const busy = new Set(D.cands.filter(x => x.id !== exceptId && x.interviewAt && !REJECT.includes(x.stage) && localDate(new Date(x.interviewAt)) === dateStr).map(x => hm(x.interviewAt)));
        const out = []; const now = new Date();
        for (let m = 9 * 60; m <= 17 * 60 + 30; m += 30) {
            const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
            const past = dateStr === localDate(now) && m <= now.getHours() * 60 + now.getMinutes();
            out.push({ t, busy: busy.has(t), past });
        }
        return out;
    }
    function sheetSchedule(c) {
        const days = []; const d = new Date();
        while (days.length < 6) { if (d.getDay() !== 0) days.push(new Date(d)); d.setDate(d.getDate() + 1); }
        const dayLbl = x => dayDiff(x) === 0 ? 'Bugun' : dayDiff(x) === 1 ? 'Ertaga' : WDS[x.getDay()];
        const firstDay = localDate(days[0]);
        const slotHtml = ds => `<div class="hra-slots">${slotsFor(ds, c.id).filter(s => !s.past).map(s => `<button type="button" class="hra-pick" aria-pressed="false" data-v="${s.t}" ${s.busy ? 'disabled aria-label="' + s.t + ' band"' : ''}>${s.t}</button>`).join('') || '<p class="hra-muted">Bu kunga boʻsh vaqt qolmadi</p>'}</div>`;
        const resched = c.interviewAt && c.stage === 'suhbat-belgilandi';
        openSheet(resched ? 'Suhbatni koʻchirish' : 'Suhbat belgilash', `${c.fullName}${resched ? ' · hozir: ' + when(c.interviewAt) : ''}`, `
            <span class="hra-lbl">Kun</span><div class="hra-days">${days.map((x, i) => `<button type="button" class="hra-pick hra-day" aria-pressed="${i === 0}" data-day="${localDate(x)}"><strong>${dayLbl(x)}</strong><small>${x.getDate()}-${MON[x.getMonth()].slice(0, 3)}</small></button>`).join('')}</div>
            <span class="hra-lbl">Vaqt</span><div data-slots>${slotHtml(firstDay)}</div>
            <span class="hra-lbl">Turi</span>${picks('kind', [['1', '1-suhbat'], ['final', 'Yakuniy suhbat']], c.stage === 'yakuniy-suhbat' || c.stage === 'test' ? 'final' : '1')}
            <span class="hra-lbl">Qayerda</span>${picks('place', [['Ofisda', 'Ofisda'], ['Telegram video', 'Telegram video']], /telegram/i.test(c.interviewLocation || '') ? 'Telegram video' : 'Ofisda')}
            <button type="button" class="hra-btn hra-btn-primary hra-btn-lg" data-ok>Saqlash</button>
            ${resched ? '<button type="button" class="hra-link hra-link-danger" data-cancel>Suhbatni bekor qilish</button>' : ''}`, w => {
            let day = firstDay;
            w.querySelector('.hra-days').addEventListener('click', e => {
                const b = e.target.closest('.hra-day'); if (!b) return;
                w.querySelectorAll('.hra-day').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
                day = b.dataset.day; w.querySelector('[data-slots]').innerHTML = slotHtml(day);
            });
            w.addEventListener('click', e => { const b = e.target.closest('.hra-pick:not(.hra-day)'); if (!b || b.disabled) return; b.parentElement.querySelectorAll('.hra-pick').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
            w.querySelector('[data-ok]').onclick = async () => {
                const t = w.querySelector('[data-slots] .hra-pick[aria-pressed="true"]')?.dataset.v;
                if (!t) { toast('Vaqtni tanlang', 'bad'); return; }
                const [Y, M, Dd] = day.split('-').map(Number); const [h, m] = t.split(':').map(Number);
                const at = new Date(Y, M - 1, Dd, h, m).toISOString();
                const kind = pickVal(w, 'kind'), place = pickVal(w, 'place');
                closeSheet();
                await patch(c.id, { interviewAt: at, interviewLocation: place, stage: kind === 'final' ? 'yakuniy-suhbat' : 'suhbat-belgilandi' }, 'Suhbat saqlandi');
            };
            w.querySelector('[data-cancel]')?.addEventListener('click', async () => { closeSheet(); await patch(c.id, { interviewAt: null, stage: 'qayta-aloqa' }, 'Suhbat bekor qilindi'); });
        });
    }
    function sheetCallResult(c) {
        openSheet('Qoʻngʻiroq natijasi', `${c.fullName} · ${vacOf(c)?.label || ''}`, `${radios('Natija', [['invite', 'Gaplashdik — suhbatga chaqirdim', 'Vaqt tanlash'], ['later', 'Keyinroq qoʻngʻiroq qilish kerak', 'Qayta aloqa'], ['noans', 'Javob bermadi', (attempts(c) + 1) + '-urinish'], ['off', 'Raqam oʻchiq yoki notoʻgʻri', 'Javob bermadi +1']], 'invite')}
            <label class="hra-sr" for="hraCallNote">Izoh</label><textarea id="hraCallNote" rows="2" placeholder="Izoh: nima deb gaplashdingiz?"></textarea>
            <button type="button" class="hra-btn hra-btn-primary hra-btn-lg" data-ok>Davom etish</button>`, w => {
            w.querySelector('[data-ok]').onclick = async () => {
                const v = w.querySelector('input[name="Natija"]:checked')?.value; const note = w.querySelector('textarea').value.trim();
                closeSheet();
                if (v === 'invite') { if (note) await patch(c.id, { comments: withComment(c, note) }); sheetSchedule(curCand() || c); return; }
                if (v === 'later') { await patch(c.id, { stage: 'qayta-aloqa', comments: withComment(c, 'Qayta aloqa' + (note ? ': ' + note : '')) }, 'Qayta aloqaga oʻtdi'); return; }
                const n = attempts(c) + 1;
                const r = await patch(c.id, { stage: 'javob-bermadi', comments: withComment(c, `Javob bermadi (${n}-urinish)${v === 'off' ? ' — raqam oʻchiq' : ''}${note ? ': ' + note : ''}`) }, `${n}-urinish belgilandi`);
                if (r && n >= 3) setTimeout(() => sheetReject(r), 400);
            };
        });
    }
    function sheetResult(c) {
        openSheet('Suhbat natijasi', `${c.fullName} · ${stageLabel(c.stage)}`, `${radios('Natija', [['test', 'Test topshirigʻi beraman', 'Test'], ['final', 'Yakuniy suhbatga', 'Yakuniy suhbat'], ['hire', 'Ishga olamiz', 'Ishga olindi'], ['no', 'Mos emas', 'Rad etish']], c.stage === 'yakuniy-suhbat' ? 'hire' : 'test')}
            <span class="hra-lbl">Taassurot</span>${picks('mood', [['Kuchli', 'Kuchli'], ['Oʻrtacha', 'Oʻrtacha'], ['Zaif', 'Zaif']], 'Kuchli')}
            <label class="hra-sr" for="hraResNote">Izoh</label><textarea id="hraResNote" rows="2" placeholder="Izoh: topshiriq, muddat yoki qaror sababi"></textarea>
            <button type="button" class="hra-btn hra-btn-primary hra-btn-lg" data-ok>Saqlash</button>`, w => {
            bindPicks(w);
            w.querySelector('[data-ok]').onclick = async () => {
                const v = w.querySelector('input[name="Natija"]:checked')?.value, mood = pickVal(w, 'mood'), note = w.querySelector('textarea').value.trim();
                closeSheet();
                if (v === 'no') { sheetReject(c); return; }
                const stage = v === 'test' ? 'test' : v === 'final' ? 'yakuniy-suhbat' : 'ishga-olindi';
                const txt = `Suhbat natijasi: ${mood}${v === 'test' ? ' · test berildi' : ''}${note ? ' — ' + note : ''}`;
                const r = await patch(c.id, { stage, comments: withComment(c, txt) }, stage === 'ishga-olindi' ? '' : 'Saqlandi');
                if (r && stage === 'yakuniy-suhbat') sheetSchedule(r);
                if (r && stage === 'ishga-olindi') celebrate(r);
            };
        });
    }
    function sheetFix(empId) {
        const r = (D.att?.rows || []).find(x => String(x.employeeId) === String(empId)) || {};
        const name = r.name || staff().find(e => String(e.id) === String(empId))?.name || '';
        openSheet('Davomatni tuzatish', 'Sabab majburiy', `<div class="hra-fixwho">${ava(name, 40)}<div><strong>${esc(name)}</strong><small>${esc(r.inClock ? 'keldi ' + r.inClock : (ATT[r.status] || [''])[0])}</small></div></div>
            ${radios('Holat', [['excused', 'Sababli'], ['present', 'Keldi (vaqtida deb hisoblash)'], ['absent', 'Kelmadi'], ['leave', 'Taʼtil']], r.overridden ? r.status : 'excused')}
            <label class="hra-sr" for="hraFixNote">Sabab</label><textarea id="hraFixNote" rows="2" placeholder="Sabab: masalan, shifokorda edi">${esc(r.note || '')}</textarea>
            <div class="hra-note">${ic('lock', 18)}<span>Tuzatish tarixga yoziladi: kim, qachon, nima uchun.</span></div>
            <button type="button" class="hra-btn hra-btn-primary hra-btn-lg" data-ok>Saqlash</button>
            ${r.overridden ? '<button type="button" class="hra-link" data-undo>Oldingi tuzatishni bekor qilish</button>' : ''}`, w => {
            const send = async status => {
                const note = w.querySelector('textarea').value.trim();
                if (status && !note) { toast('Sababni yozing', 'bad'); return; }
                closeSheet();
                try { await apiFetch('/api/staff-attendance/override', { method: 'PUT', body: JSON.stringify({ employeeId: empId, date: localDate(), status, note }) }); toast('Saqlandi'); loadAtt(); }
                catch (e) { toast(e.message || 'Saqlab boʻlmadi', 'bad'); }
            };
            w.querySelector('[data-ok]').onclick = () => send(w.querySelector('input[name="Holat"]:checked')?.value);
            w.querySelector('[data-undo]')?.addEventListener('click', () => send(null));
        });
    }
    function celebrate(c) {
        const colors = ['#0065D6', '#F79009', '#079455', '#7A5AF8', '#EE46BC', '#FDB022'];
        const el = document.createElement('div'); el.className = 'hra-win'; el.setAttribute('role', 'status');
        el.innerHTML = `${Array.from({ length: 24 }, (_, i) => `<i class="hra-conf" style="left:${(i * 37) % 100}%;background:${colors[i % 6]};animation-delay:${(i % 8) * .2}s"></i>`).join('')}
            <div class="hra-win-b"><div class="hra-win-ava">${ava(c.fullName, 88)}<span>${ic('check', 20, 3)}</span></div><small>JAMOAGA YANGI AʼZO</small><h2>${esc(c.fullName)}<br>ishga qabul qilindi!</h2><p>${esc(vacOf(c)?.label || '')}</p>
            <div class="hra-note hra-note-dark">${ic('user', 18)}<span>Akkauntni admin CRM → HR → Xodimlar orqali ochadi (12 belgili parol, xodimning Telegramiga).</span></div>
            <button type="button" class="hra-btn hra-btn-primary hra-btn-lg">Davom etish</button></div>`;
        el.querySelector('button').onclick = () => el.remove();
        document.body.appendChild(el);
    }

    // ---------- hodisalar ----------
    function onClick(e) {
        const t = e.target.closest('[data-h-nav],[data-h-back],[data-h-lang],[data-h-stage],[data-h-cand],[data-h-pass],[data-h-reject],[data-h-go],[data-h-day],[data-h-role],[data-h-emp],[data-h-stagesheet],[data-h-schedule],[data-h-came],[data-h-noshow],[data-h-result],[data-h-setstage],[data-h-restore],[data-h-call],[data-h-fix],[data-h-face],[data-h-vac],[data-h-crm],[data-h-profile],[data-h-logout],[data-h-reload]');
        if (!t) return;
        const d = t.dataset;
        if ('hNav' in d) { go(d.hNav); return; }
        if ('hBack' in d) { history.back(); return; }
        if ('hLang' in d) { S.lang = d.hLang; render(false); return; }
        if ('hStage' in d) { S.stage = d.hStage; render(false); return; }
        if ('hDay' in d) { S.day = Number(d.hDay); render(false); return; }
        if ('hRole' in d) { S.roleF = d.hRole; render(false); return; }
        if ('hCand' in d) { go('card', { cand: d.hCand }); return; }
        if ('hEmp' in d) { go('emp', { emp: d.hEmp }); return; }
        if ('hGo' in d) { try { const o = JSON.parse(d.hGo); if (o.screen) go(o.screen); else go('cands', { stage: o.stage }); } catch (er) { /* */ } return; }
        if ('hVac' in d) { go('cands', { stage: 'kandidatlar', q: '' }); return; }
        if ('hReload' in d) { D.loaded = false; render(false); load(true); return; }
        if ('hPass' in d) {
            const c = D.cands.find(x => x.id === d.hPass); if (!c) return;
            patch(c.id, { stage: 'birinchi-filtr' }).then(r => { if (r) toast(`${c.fullName} — 1-filtrdan oʻtdi`, 'ok', () => patch(c.id, { stage: 'kandidatlar' }, 'Qaytarildi')); });
            return;
        }
        if ('hReject' in d) { const c = D.cands.find(x => x.id === d.hReject); if (c) sheetReject(c); return; }
        if ('hFix' in d) { sheetFix(d.hFix); return; }
        if ('hFace' in d) {
            apiFetch('/api/staff-attendance/employees/' + encodeURIComponent(d.hFace) + '/face/review', { method: 'POST', body: JSON.stringify({ decision: d.hDecision, photoId: d.hPid }) })
                .then(() => { toast(d.hDecision === 'approve' ? 'Yuz rasmi tasdiqlandi' : 'Xodimdan qayta olish soʻraldi'); loadAtt(); })
                .catch(er => toast(er.message || 'Saqlab boʻlmadi', 'bad'));
            return;
        }
        if ('hCrm' in d) { openCrm(); return; }
        if ('hProfile' in d) { openCrm('profile'); return; }
        if ('hLogout' in d) { document.getElementById('profileLogoutBtn')?.click(); return; }
        const c = curCand(); if (!c && !('hCame' in d && d.hCame) && !('hNoshow' in d)) return;
        if ('hCall' in d) { callPending = { id: d.hCall, at: Date.now() }; return; } // tel: havolasi o'zi ochiladi
        if ('hStagesheet' in d) { sheetStage(c); return; }
        if ('hSchedule' in d) { sheetSchedule(c); return; }
        if ('hResult' in d) { sheetResult(c); return; }
        if ('hSetstage' in d) { patch(c.id, { stage: d.hSetstage }, 'Saqlandi'); return; }
        if ('hRestore' in d) { patch(c.id, { stage: 'kandidatlar' }, 'Kandidatlarga qaytarildi'); return; }
        if ('hCame' in d) {
            const cc = d.hCame ? D.cands.find(x => x.id === d.hCame) : c; if (!cc) return;
            patch(cc.id, { stage: 'suhbatga-keldi' }).then(r => { if (r) sheetResult(r); });
            return;
        }
        if ('hNoshow' in d) {
            const cc = D.cands.find(x => x.id === d.hNoshow); if (!cc) return;
            patch(cc.id, { stage: 'qayta-aloqa', interviewAt: null, comments: withComment(cc, 'Suhbatga kelmadi') }, 'Qayta aloqaga oʻtdi');
        }
    }
    function onSubmit(e) {
        const f = e.target.closest('[data-h-comment]'); if (!f) return;
        e.preventDefault();
        const c = curCand(); const v = f.querySelector('textarea').value.trim(); if (!c || !v) return;
        patch(c.id, { comments: withComment(c, v) }, 'Izoh saqlandi');
    }
    let qTimer = null;
    function onInput(e) {
        const q = e.target.closest('[data-h-q]'); if (!q) return;
        clearTimeout(qTimer);
        qTimer = setTimeout(() => {
            S.q = q.value; const pos = q.selectionStart; render(false);
            const n = root.querySelector('[data-h-q]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* */ } }
        }, 220);
    }
    function onVisible() {
        if (document.visibilityState !== 'visible' || !isOn()) return;
        if (callPending && Date.now() - callPending.at > 4000) {
            const c = D.cands.find(x => x.id === callPending.id); callPending = null;
            if (c) setTimeout(() => sheetCallResult(c), 300);
        }
        if (Date.now() - (onVisible.at || 0) > 30000) { onVisible.at = Date.now(); load(true); }
    }

    // CRM sahifasini ochish (kompyuter versiyasi HR bo'limi yoki profil) — ilova qatlami vaqtincha yashiriladi.
    function openCrm(tab) {
        S.stack.push({ screen: S.screen, cand: S.cand, emp: S.emp });
        S.screen = 'crm';
        document.body.classList.add('hra-crm');
        if (root) root.hidden = true;
        syncNav();
        try { history.pushState({ hra: 1 }, ''); } catch (e) { /* */ }
        if (g('switchTab')) switchTab(tab === 'profile' ? 'profile' : 'hr');
        window.scrollTo?.(0, 0);
        const bar = document.createElement('button');
        bar.type = 'button'; bar.className = 'hra-backbar'; bar.innerHTML = `${ic('back', 18, 2.4)}HR ilovasiga qaytish`;
        bar.onclick = () => closeCrm();
        document.body.appendChild(bar);
    }
    function closeCrm() {
        document.querySelector('.hra-backbar')?.remove();
        document.body.classList.remove('hra-crm');
        if (root) root.hidden = false;
        const p = S.stack.pop(); Object.assign(S, p || { screen: 'menu' });
        render(true);
    }

    function enable() {
        document.body.classList.add('hra-on');
        if (!root) {
            root = document.createElement('main');
            root.id = 'hrApp'; root.className = 'hra-app';
            document.body.appendChild(root);
            root.addEventListener('click', onClick);
            root.addEventListener('submit', onSubmit);
            root.addEventListener('input', onInput);
        }
        root.hidden = S.screen === 'crm';
        if (!nav) buildNav();
        render(true);
    }
    function disable() {
        document.body.classList.remove('hra-on', 'hra-crm');
        closeSheet(true);
        document.querySelector('.hra-backbar')?.remove();
        if (root) root.hidden = true;
        if (nav) nav.hidden = true;
    }
    function sync() { if (isOn()) enable(); else disable(); }

    function init() {
        if (inited || user().role !== 'hr') return;
        inited = true;
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        window.addEventListener('popstate', () => {
            if (!isOn()) return;
            if (S.screen === 'crm') { closeCrm(); return; }
            if (!back() && S.screen === 'home') toast('Chiqish uchun yana bir marta “Orqaga” bosing', 'ok');
        });
        MQ.addEventListener?.('change', sync);
        sync();
        load(false);
        setInterval(() => { if (isOn() && document.visibilityState === 'visible' && !sheetEl) load(true); }, 60000);
    }

    window.hrApp = { go, back, render: () => render(false), state: S, data: D };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80));
    else setTimeout(init, 80);
})();
