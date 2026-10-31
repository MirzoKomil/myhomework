// Domwork Team — sotuv menejeri telefon ilovasi (2026-11, "Domwork Team — Sotuv ilovasi" dizayni).
// Faqat ko'rinish qatlami: ma'lumot va mantiq o'zgarmaydi. Har bir harakat mavjud, sinalgan funksiyalar
// orqali bajariladi (updateLeadInStorage, requestLeadStageChange, openConnectedSurveyModal, jadvalV3,
// openLeadFollowUpReminderModal, openLeadRecordingModal, inflowUI.openPayment …). Server ruxsatlari o'sha-o'sha.
// Faqat role=sales_manager va ekran ≤900px bo'lganda yoqiladi; kompyuter ko'rinishi o'zgarmaydi.
// Uslublar: css/sotuvApp.css.
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const DAY = 86400000;
    const g = name => (typeof window[name] === 'function' ? window[name] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isOn = () => user().role === 'sales_manager' && MQ.matches;
    const mid = () => user().linkedManagerId;
    const lang = () => user().linkedManagerLang || 'russian';
    const st = l => (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : (l.status || 'yangi-lidlar'));
    const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const mln = n => { const v = Math.round((Number(n) || 0) / 1e5) / 10; return String(v).replace('.', ',') + ' mln'; };
    const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
    const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
    const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const when = t => {
        const d = new Date(t), now = new Date();
        const diff = Math.round((new Date(d.toDateString()) - new Date(now.toDateString())) / DAY);
        const day = diff === 0 ? 'Bugun' : diff === -1 ? 'Kecha' : diff === 1 ? 'Ertaga' : `${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}`;
        return `${day} ${hm(t)}`;
    };
    const dur = ms => { ms = Math.abs(ms); const h = Math.floor(ms / 3600000); if (h >= 24) return Math.floor(h / 24) + ' kun'; if (h >= 1) return h + ' soat'; return Math.max(1, Math.round(ms / 60000)) + ' daq'; };
    const parseT = v => { if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; };

    // ---------- ikonkalar ----------
    const P = {
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        leads: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.6 2.8.7a2 2 0 011.7 2z"/>',
        tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l12-9"/>',
        sms: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
        back: '<path d="M15 18l-6-6 6-6"/>',
        close: '<path d="M18 6L6 18M6 6l12 12"/>',
        chev: '<path d="M9 6l6 6-6 6"/>',
        down: '<path d="M6 9l6 6 6-6"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        check: '<path d="M5 12l5 5L20 7"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        survey: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
        sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
        filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
        skip: '<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
        play: '<path d="M7 4l13 8-13 8z"/>',
        mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0M12 17v5"/>',
        students: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/>',
        debt: '<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M16 12.5h2M2 10h20"/>',
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
        script: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
        truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
        chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
        trial: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
        logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
        x: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
        nope: '<path d="M10.7 13.3a16 16 0 003.4 2.6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.6 2.8.7a2 2 0 011.7 2v3a2 2 0 01-2.2 2A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9M23 1L1 23"/>',
        plus: '<path d="M12 5v14M5 12h14"/>'
    };
    const ic = (n, s = 20, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

    // ---------- holat ----------
    const S = { screen: 'home', stage: 'yangi-lidlar', q: '', searchOpen: false, src: 'all', lead: null, tab: 'tarix', ratingPeriod: 'oylik', stack: [] };
    let root, nav, sheetEl, toastEl, inited = false, callPending = null, renderQueued = false, booted = false;

    // ---------- ma'lumot ----------
    const LEADS = () => {
        const all = g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : { english: [], russian: [] };
        const m = String(mid() || '');
        return (all[lang()] || []).filter(l => !l.deletedAt && (!m || String(l.managerId) === m));
    };
    const leadById = id => (g('getLeadById') ? getLeadById(lang(), id) : LEADS().find(l => l.id === id));
    const COLS = () => (typeof LEAD_COLUMNS !== 'undefined' ? LEAD_COLUMNS : []);
    const SHORT = {
        'yangi-lidlar': 'Yangi', 'boglanishga-urinilmoqda': 'Urinilmoqda', 'boglanildi': 'Bogʻlanildi', 'sinov-darsida': 'Sinovda',
        'qaror-jarayonida': 'Qaror', 'keyin-sotib-olmoqchi': 'Keyin oladi', 'tolov-jarayonida': 'Toʻlovda', 'tolov-yopildi': 'Yopildi',
        'muvaffaqiyatsiz-sotuv': 'Muvaffaqiyatsiz', 'sifatsiz-lidlar': 'Sifatsiz'
    };
    const PATH = typeof LEAD_MAIN_PATH !== 'undefined' ? LEAD_MAIN_PATH : ['yangi-lidlar', 'boglanishga-urinilmoqda', 'boglanildi', 'sinov-darsida', 'qaror-jarayonida', 'tolov-jarayonida', 'tolov-yopildi'];
    const colLabel = id => (COLS().find(c => c.id === id) || {}).label || SHORT[id] || id;
    const teacherName = id => {
        if (!id || !g('getItem')) return '';
        const t = (getItem(STORAGE_KEYS.teachers, []) || []).find(x => String(x.id) === String(id));
        return firstName(t?.name);
    };
    const hasSurvey = l => !!(window.leadWorkflow?.hasCombinedSurvey && leadWorkflow.hasCombinedSurvey(l));
    const surveyCount = l => {
        const s = l.connectedSurvey || {};
        let n = ['languageLevel', 'applicant', 'gender', 'learningGoal'].filter(k => typeof s[k] === 'string' && s[k].trim()).length;
        if (Number(s.age) >= 7) n++;
        if ((s.residenceType === 'uz' && s.region) || (s.residenceType === 'foreign' && s.country)) n++;
        n += (Array.isArray(l.infoProvidedSurvey) ? l.infoProvidedSurvey : []).filter(a => a.answer === 'yes').length;
        return Math.min(11, n);
    };
    const assignedAt = l => parseT(l.managerAssignedAt) || parseT(l.createdAt) || parseT(l.date);
    const trialAt = l => parseT(l.trialRequest?.scheduledAt) || parseT(l.trialLessonAt);
    const followUp = l => (g('getLeadNextFollowUp') ? getLeadNextFollowUp(l, Date.now()) : null);
    const srcLabel = l => (g('leadSourceName') ? leadSourceName(l.source) : l.source) || 'Organik';
    const kindLabel = l => (l.leadType === 'target' ? 'Target' : 'Organik');

    // Lid qatori uchun asosiy belgi: eng muhim keyingi narsa (kechikkan qo'ng'iroq, SLA, sinov vaqti…).
    function badge(l) {
        const s = st(l), now = Date.now();
        const f = followUp(l);
        if (f) return { text: (f.overdue ? 'Qoʻngʻiroq kechikdi · ' : 'Qoʻngʻiroq · ') + when(f.at).toLowerCase(), tone: f.overdue ? 'red' : 'amber', sort: f.overdue ? 0 : 2, t: f.at };
        if (s === 'yangi-lidlar') {
            const a = assignedAt(l);
            if (a) { const left = a + DAY - now; return left <= 0 ? { text: 'SLA oʻtdi · ' + dur(left), tone: 'red', sort: 1, t: a } : { text: dur(left) + ' qoldi', tone: left < 6 * 3600000 ? 'amber' : 'blue', sort: 3, t: a }; }
        }
        if (s === 'sinov-darsida') { const t = trialAt(l); if (t) return { text: 'Sinov · ' + when(t).toLowerCase(), tone: t < now ? 'amber' : 'green', sort: 2, t }; }
        if (s === 'keyin-sotib-olmoqchi') { const c = l.deferredPurchaseSurvey?.contactDate; if (c) return { text: 'Qoʻngʻiroq · ' + (g('formatDateShort') ? formatDateShort(c) : c), tone: 'gray', sort: 4, t: parseT(c) }; }
        if (s === 'tolov-jarayonida') { const p = l.paymentSurvey || {}; const v = p.debtAmount || p.amount || p.totalAmount; if (v) return { text: num(v) + ' kutilmoqda', tone: 'amber', sort: 3, t: 0 }; }
        if (s === 'tolov-yopildi') { const v = l.paymentClosedSurvey?.actualAmount || l.paymentClosedSurvey?.totalAmount || l.paymentSurvey?.totalAmount; return { text: (v ? num(v) + ' · ' : '') + (l.closedDate || l.paymentClosedSurvey?.closedDate ? formatShort(l.closedDate || l.paymentClosedSurvey.closedDate) : 'yopildi'), tone: 'green', sort: 5, t: -(parseT(l.closedDate) || 0) }; }
        if (s === 'muvaffaqiyatsiz-sotuv') return { text: l.failedSaleReason?.label || 'Sabab koʻrsatilmagan', tone: 'gray', sort: 6, t: 0 };
        if (s === 'sifatsiz-lidlar') return { text: l.sifatsizReason?.label || 'Sifatsiz', tone: 'gray', sort: 6, t: 0 };
        const since = parseT(l.slaStageEnteredAt) || parseT(l.statusChangedAt) || assignedAt(l);
        return { text: since ? dur(now - since) + ' shu bosqichda' : colLabel(s), tone: 'blue', sort: 4, t: since || 0 };
    }
    const formatShort = v => { const t = parseT(v); if (!t) return String(v || ''); const d = new Date(t); return `${d.getDate()}-${MON[d.getMonth()].slice(0, 3)}`; };
    function metaLine(l) {
        const s = st(l), parts = [];
        if (s === 'boglanishga-urinilmoqda') { const r = g('getLeadContactReason') ? getLeadContactReason(l) : ''; if (r) parts.push(typeof r === 'string' ? r : r.label || ''); }
        if (s === 'sinov-darsida') { const tn = teacherName(l.trialRequest?.teacherId || l.paymentOnboarding?.teacherId); if (tn) parts.push('Ustoz ' + tn); }
        if (s === 'boglanildi' && hasSurvey(l)) parts.push('Anketa ✓');
        parts.push(kindLabel(l));
        const src = srcLabel(l); if (src && src !== kindLabel(l)) parts.push(src);
        return parts.filter(Boolean).join(' · ');
    }
    const telOf = v => String(v || '').replace(/[^\d+]/g, '');

    // ---------- umumiy bo'laklar ----------
    const AV = [['#DCEBFF', '#0057B8'], ['#FEF0C7', '#93370D'], ['#ECFDF3', '#067647'], ['#F1E8FF', '#5B21B6'], ['#FFE4E8', '#9F1239'], ['#E0F2FE', '#075985']];
    const avColor = s => AV[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
    const avatar = (name, size = 42, cls = '') => { const [b, f] = avColor(name); return `<span class="sa-av ${cls}" style="width:${size}px;height:${size}px;background:${b};color:${f};font-size:${Math.round(size / 3)}px">${esc(initials(name))}</span>`; };
    const staffImg = (id, name, size = 44) => {
        const url = window.schoolUI?.staffAvatarOf ? window.schoolUI.staffAvatarOf(id) : '';
        return url ? `<img class="sa-av" src="${esc(url)}" alt="" style="width:${size}px;height:${size}px">` : avatar(name, size);
    };
    const pill = (text, tone) => `<span class="sa-pill sa-pill--${tone}">${esc(text)}</span>`;
    const callBtn = (l, primary) => {
        const ph = telOf(l.phone);
        if (!ph) return '';
        return `<a class="sa-call${primary ? ' is-primary' : ''}" href="tel:${esc(ph)}" data-sa-call="${esc(l.id)}" aria-label="${esc(l.name || 'Lid')}ga qoʻngʻiroq">${ic('phone', 20, 2.2)}</a>`;
    };
    const topBack = (title, sub, back = 'back', extra = '') => `<header class="sa-top sa-top--page"><button type="button" class="sa-icon-btn sa-ghost" data-sa-${back} aria-label="Orqaga">${ic('back', 22, 2.2)}</button><div class="sa-top-t"><h1>${esc(title)}</h1>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${extra}</header>`;
    const bell = () => {
        const n = g('getUnreadCount') ? getUnreadCount() : 0;
        return `<button type="button" class="sa-icon-btn" data-sa-notif aria-label="Bildirishnomalar${n ? ', ' + n + ' ta yangi' : ''}">${ic('bell')}${n ? `<span class="sa-dot-n">${n > 9 ? '9+' : n}</span>` : ''}</button>`;
    };
    const empty = (img, title, text, btn) => `<div class="sa-empty"><img src="images/empty/${img}.webp" alt="" width="104" height="104"><strong>${esc(title)}</strong><span>${esc(text)}</span>${btn || ''}</div>`;

    // ---------- ekranlar ----------
    function screenHome() {
        const u = user(), now = new Date();
        let d = null;
        try { d = g('computeManagerHome') ? computeManagerHome({ user: u, managerId: mid(), leads: getItem(STORAGE_KEYS.leads, {}), students: getItem(STORAGE_KEYS.students, []), now }) : null; } catch (e) { d = null; }
        const leads = LEADS();
        const pct = d && d.target > 0 ? Math.round(d.sales / d.target * 100) : null;
        const ring = pct == null ? 0 : Math.min(100, pct);
        const C = 226;
        const daysLeft = d ? Math.max(1, d.daysInMonth - now.getDate() + 1) : 1;
        const left = d && d.target > d.sales ? d.target - d.sales : 0;
        const trials = leads.filter(l => st(l) === 'sinov-darsida' && trialAt(l) && dayKey(trialAt(l)) === dayKey(now)).sort((a, b) => trialAt(a) - trialAt(b));
        const paying = leads.filter(l => st(l) === 'tolov-jarayonida');
        const payingSum = paying.reduce((a, l) => a + (Number(l.paymentSurvey?.debtAmount || l.paymentSurvey?.amount || 0) || 0), 0);
        const tasks = (d?.tasks || []).filter(t => t.kind === 'lead');
        const late = tasks.filter(t => t.late).length;
        const next = d?.next?.lead ? leadById(d.next.lead.id) || d.next.lead : null;
        let nextChip = '';
        if (d?.next) {
            if (d.next.reason === 'sla') nextChip = pill('SLA oʻtdi · ' + dur(d.next.ms), 'red-d');
            else if (d.next.reason === 'late') nextChip = pill('Kechikdi · ' + hm(d.next.at), 'red-d');
            else if (d.next.reason === 'today') nextChip = pill(hm(d.next.at) + ' · ' + dur(d.next.at - Date.now()) + ' qoldi', 'amber-d');
            else nextChip = pill('Yangi · ' + dur(d.next.ms) + ' qoldi', 'blue-d');
        }
        const queue = (d?.queue || []).filter(l => !next || l.id !== next.id).slice(0, 3).map(l => leadById(l.id) || l);
        const greet = now.getHours() < 12 ? 'Xayrli tong' : now.getHours() < 18 ? 'Xayrli kun' : 'Xayrli kech';
        return `
        <header class="sa-top">
          <button type="button" class="sa-me" data-sa-go="profile" aria-label="Profil">${staffImg(mid(), u.name, 46)}<i></i></button>
          <div class="sa-top-t"><span>${WD[now.getDay()]}, ${now.getDate()}-${MON[now.getMonth()]}</span><h1>${greet}, ${esc(firstName(u.name))}</h1></div>
          ${bell()}
        </header>
        <div class="sa-body sa-stagger">
          <button type="button" class="sa-card sa-plan" data-sa-nav="plan">
            <span class="sa-ring"><svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label="Reja ${pct ?? 0}% bajarildi"><circle cx="42" cy="42" r="36" fill="none" stroke="#E2E8F0" stroke-width="9"/><circle class="sa-ring-v" cx="42" cy="42" r="36" fill="none" stroke="#0065D6" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${Math.round(C - C * ring / 100)}" transform="rotate(-90 42 42)" style="--off:${Math.round(C - C * ring / 100)}"/></svg><b>${pct == null ? '—' : pct + '%'}</b><small>reja</small></span>
            <span class="sa-plan-t"><span class="sa-k">${MON[now.getMonth()][0].toUpperCase() + MON[now.getMonth()].slice(1)} rejasi</span>
              <span class="sa-plan-v"><strong>${mln(d?.sales || 0)}</strong>${d?.target ? `<em>/ ${mln(d.target)}</em>` : ''}</span>
              ${d?.target ? (left ? pill(`Kuniga ${num(Math.ceil(left / daysLeft))} kerak`, 'amber') : pill('Reja bajarildi', 'green')) : pill('Reja hali qoʻyilmagan', 'gray')}</span>
            <img class="sa-plan-img" src="images/kobalt-money.webp" alt="" width="58">
          </button>
          <div class="sa-tiles">
            <button type="button" class="sa-tile" data-sa-nav="leads"><span>Vazifalar</span><strong>${tasks.length}</strong><em class="${late ? 'is-red' : ''}">${late ? late + ' ta kechikkan' : 'bugun'}</em></button>
            <button type="button" class="sa-tile" data-sa-nav="jadval"><span>Sinov</span><strong>${trials.length}</strong><em class="is-green">${trials.find(l => trialAt(l) > Date.now()) ? hm(trials.find(l => trialAt(l) > Date.now()) && trialAt(trials.find(l => trialAt(l) > Date.now()))) + ' da' : 'bugun'}</em></button>
            <button type="button" class="sa-tile" data-sa-stagego="tolov-jarayonida"><span>Toʻlovda</span><strong>${paying.length}</strong><em class="is-blue">${payingSum ? mln(payingSum) : 'lid'}</em></button>
          </div>
          ${next ? `
          <section class="sa-next">
            <div class="sa-next-h"><span>KEYINGI QOʻNGʻIROQ · 1 / ${Math.max(1, d.queueCount)}</span>${nextChip}</div>
            <button type="button" class="sa-next-n" data-sa-lead="${esc(next.id)}"><strong>${esc(next.name || 'Lid')}</strong><span>${esc(colLabel(st(next)))} · ${esc(metaLine(next))}</span></button>
            <div class="sa-next-a">
              ${telOf(next.phone) ? `<a class="sa-btn sa-btn--primary sa-pulse" href="tel:${esc(telOf(next.phone))}" data-sa-call="${esc(next.id)}">${ic('phone', 18, 2.2)}Qoʻngʻiroq qilish</a>` : ''}
              <button type="button" class="sa-icon-btn sa-on-dark" data-sa-tg="${esc(next.id)}" aria-label="Telegramda yozish">${ic('tg')}</button>
              <button type="button" class="sa-icon-btn sa-on-dark" data-sa-lead="${esc(next.id)}" aria-label="Lid kartasini ochish">${ic('chev')}</button>
            </div>
          </section>` : `<section class="sa-card sa-calm">${ic('check', 22, 2.6)}<span><strong>Navbat boʻsh</strong><em>Hozircha kechikkan qoʻngʻiroq yoʻq</em></span></section>`}
          <section class="sa-sec">
            <div class="sa-sec-h"><h2>Bugungi sinovlar</h2><button type="button" class="sa-link" data-sa-nav="jadval">+ Sinov qoʻyish</button></div>
            ${trials.length ? `<div class="sa-trials">${trials.slice(0, 4).map(l => {
                const t = trialAt(l), a = l.trialRequest?.attended;
                const chip = a === true ? pill('Keldi', 'green') : a === false ? pill('Kelmadi', 'red') : t > Date.now() ? pill(dur(t - Date.now()) + ' qoldi', 'blue') : pill('Natija kerak', 'amber');
                return `<button type="button" class="sa-card sa-trial" data-sa-lead="${esc(l.id)}"><span class="sa-trial-h"><strong>${hm(t)}</strong>${chip}</span><strong>${esc(l.name || 'Lid')}</strong><em>${esc(teacherName(l.trialRequest?.teacherId) ? 'Ustoz ' + teacherName(l.trialRequest?.teacherId) : 'Ustoz biriktirilmoqda')}</em></button>`;
            }).join('')}</div>` : `<div class="sa-card sa-muted-card">Bugun sinov yoʻq. Jadvalda boʻsh vaqtlar bor.</div>`}
          </section>
          ${queue.length ? `<section class="sa-sec"><div class="sa-sec-h"><h2>Navbat <em>· yana ${Math.max(0, d.queueCount - 1)} ta</em></h2><button type="button" class="sa-link" data-sa-nav="leads">Hammasi</button></div>
            <div class="sa-card sa-list">${queue.map(l => { const b = badge(l); return `<div class="sa-row"><span class="sa-when sa-when--${b.tone}">${esc(b.text)}</span><button type="button" class="sa-row-t" data-sa-lead="${esc(l.id)}"><strong>${esc(l.name || 'Lid')}</strong><span>${esc(colLabel(st(l)))} · ${esc(kindLabel(l))}</span></button>${callBtn(l, false)}</div>`; }).join('')}</div></section>` : ''}
        </div>`;
    }

    function screenLeads() {
        const all = LEADS();
        const q = S.q.trim();
        const match = l => !q || (g('leadMatchesSearch') ? leadMatchesSearch(l, q) : String(l.name + ' ' + l.phone).toLowerCase().includes(q.toLowerCase()));
        const srcOk = l => S.src === 'all' || (S.src === 'target' ? l.leadType === 'target' : l.leadType !== 'target');
        const pool = all.filter(l => srcOk(l) && match(l));
        const ids = COLS().map(c => c.id);
        const counts = Object.fromEntries(ids.map(id => [id, pool.filter(l => st(l) === id).length]));
        const rows = (q ? pool : pool.filter(l => st(l) === S.stage)).map(l => ({ l, b: badge(l) }))
            .sort((a, b) => a.b.sort - b.b.sort || (a.b.t || 0) - (b.b.t || 0));
        const redCount = rows.filter(r => r.b.tone === 'red').length;
        return `
        <header class="sa-top sa-top--leads">
          <div class="sa-top-row"><h1>Lidlar <em>${all.length}</em></h1>
            <button type="button" class="sa-icon-btn${S.src !== 'all' ? ' has-dot' : ''}" data-sa-filter aria-label="Manba boʻyicha filtr">${ic('filter')}</button></div>
          <label class="sa-search">${ic('search', 18)}<span class="sa-sr">Lid qidirish</span><input type="search" id="saLeadSearch" placeholder="Ism, telefon yoki ID" value="${esc(S.q)}" autocomplete="off">${S.q ? `<button type="button" class="sa-icon-btn sa-ghost sa-sm" data-sa-clearq aria-label="Qidiruvni tozalash">${ic('close', 16, 2.4)}</button>` : ''}</label>
          ${q ? `<div class="sa-q-info">${rows.length ? `${rows.length} ta lid topildi` : 'Hech narsa topilmadi'}</div>` : `<div class="sa-chips" role="tablist" aria-label="Bosqichlar">${ids.map(id => `<button type="button" role="tab" aria-selected="${id === S.stage}" class="sa-chip${id === S.stage ? ' is-on' : ''}" data-sa-stage="${id}">${esc(SHORT[id] || colLabel(id))}<b>${counts[id] || 0}</b></button>`).join('')}</div>`}
        </header>
        ${q ? '' : `<div class="sa-hint"><span>${esc(colLabel(S.stage))}</span><span>${redCount ? `<b>${redCount} tasi</b> kechikkan` : ''}</span></div>`}
        <div class="sa-body sa-rows">
          ${rows.length ? rows.map(({ l, b }, i) => `
            <article class="sa-lrow" style="--i:${Math.min(i, 10)}">
              ${avatar(l.name, 42)}
              <button type="button" class="sa-row-t" data-sa-lead="${esc(l.id)}"><strong>${esc(l.name || 'Nomaʼlum')}</strong><span>${q ? esc(SHORT[st(l)] || '') + ' · ' : ''}${esc(metaLine(l))}</span>${pill(b.text, b.tone)}</button>
              ${callBtn(l, i === 0 && b.tone !== 'gray')}
            </article>`).join('') : empty('board', q ? 'Topilmadi' : `“${SHORT[S.stage] || colLabel(S.stage)}” bosqichi boʻsh`, q ? 'Ism yoki raqamni tekshirib koʻring' : S.stage === 'yangi-lidlar' ? 'Yangi lidlarni ROP biriktiradi — kelishi bilan bildirishnoma keladi' : 'Bu bosqichda hozircha lid yoʻq')}
          <p class="sa-foot">Lidlarni faqat ROP biriktiradi</p>
        </div>`;
    }

    function stepper(l) {
        const s = st(l);
        const at = s === 'keyin-sotib-olmoqchi' ? PATH.indexOf('qaror-jarayonida') : PATH.indexOf(s);
        const closed = s === 'muvaffaqiyatsiz-sotuv' || s === 'sifatsiz-lidlar';
        const nextId = at >= 0 && at < PATH.length - 1 ? PATH[at + 1] : null;
        return `<div class="sa-steps" role="img" aria-label="Bosqich: ${esc(colLabel(s))}"><div class="sa-steps-bar">${PATH.map((id, i) => `<span class="${closed ? 'is-closed' : i <= at ? 'is-done' : ''}"></span>`).join('')}</div>
          <div class="sa-steps-t"><b class="${closed ? 'is-red' : ''}">${esc(colLabel(s))}</b>${nextId && !closed ? `<span>keyingi: ${esc(colLabel(nextId))}</span>` : ''}</div></div>`;
    }

    function screenCard() {
        const l = leadById(S.lead);
        if (!l) return `${topBack('Lid', '')}<div class="sa-body">${empty('board', 'Lid topilmadi', 'U boshqa menejerga oʻtkazilgan yoki oʻchirilgan boʻlishi mumkin')}</div>`;
        const s = st(l), ph = telOf(l.phone), ph2 = telOf(l.phone2);
        const alerts = g('getLeadSlaCardAlerts') ? (getLeadSlaCardAlerts(l, lang()) || []) : [];
        const b = badge(l);
        const survey = hasSurvey(l), sc = surveyCount(l);
        const beforeConnected = PATH.indexOf(s) >= 0 && PATH.indexOf(s) < PATH.indexOf('boglanildi');
        const trialLocked = !survey && beforeConnected;
        const comments = (Array.isArray(l.comments) ? [...l.comments] : []).sort((a, c) => (parseT(c.createdAt) || 0) - (parseT(a.createdAt) || 0));
        const tabs = [['tarix', 'Tarix'], ['info', 'Maʼlumot'], ['rec', 'Yozuvlar']];
        return `
        ${topBack(SHORT[s] ? 'Lidlar · ' + SHORT[s] : 'Lid', '', 'back', '')}
        <div class="sa-body sa-card-page">
          <section class="sa-lead-hero">
            <div class="sa-lead-id">${avatar(l.name, 60)}<div><h2>${esc(l.name || 'Nomaʼlum')}</h2>${ph ? `<a class="sa-phone" href="tel:${esc(ph)}" data-sa-call="${esc(l.id)}">${esc(g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone) : l.phone)}</a>` : ''}${ph2 && ph2 !== ph ? `<a class="sa-phone sa-phone2" href="tel:${esc(ph2)}" data-sa-call="${esc(l.id)}">2-tel: ${esc(g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone2) : l.phone2)}</a>` : ''}
              <div class="sa-tags">${pill(kindLabel(l), 'blue')}${pill(lang() === 'russian' ? 'Rus tili' : 'Ingliz tili', 'gray')}${pill(b.text, b.tone)}</div></div></div>
            ${stepper(l)}
            <div class="sa-qa">
              ${ph ? `<a class="sa-qa-b is-primary" href="tel:${esc(ph)}" data-sa-call="${esc(l.id)}">${ic('phone', 20, 2.2)}Qoʻngʻiroq</a>` : `<span class="sa-qa-b is-off">${ic('phone')}Raqam yoʻq</span>`}
              <button type="button" class="sa-qa-b" data-sa-tg="${esc(l.id)}">${ic('tg')}Telegram</button>
              <button type="button" class="sa-qa-b" data-sa-sms="${esc(l.id)}">${ic('sms')}SMS</button>
              ${s === 'sinov-darsida' ? `<button type="button" class="sa-qa-b" data-sa-retrial="${esc(l.id)}">${ic('cal')}Qayta sinov</button>`
                : `<button type="button" class="sa-qa-b${trialLocked ? ' is-locked' : ''}" data-sa-move="sinov-darsida" title="${trialLocked ? 'Avval anketa toʻldiriladi' : ''}">${ic(trialLocked ? 'lock' : 'cal')}Sinov</button>`}
            </div>
          </section>
          ${alerts.length ? `<button type="button" class="sa-alert" data-sa-notify="${esc(l.id)}">${ic('clock', 18, 2.2)}<span>${esc(alerts[0].title || alerts[0].message || 'Muddat oʻtdi')}${alerts.length > 1 ? ` · yana ${alerts.length - 1}` : ''}</span><b>Koʻrib chiqish</b></button>` : ''}
          ${!survey && s !== 'muvaffaqiyatsiz-sotuv' && s !== 'sifatsiz-lidlar' && s !== 'tolov-yopildi' ? `<button type="button" class="sa-survey-cta" data-sa-survey="${esc(l.id)}"><span class="sa-ic-box">${ic('survey')}</span><span><strong>Anketa · ${sc} / 11</strong><em>Gaplashgach toʻldiring — “Bogʻlanildi” uchun shart</em></span>${ic('chev', 18, 2.4)}</button>` : ''}
          <div class="sa-seg" role="tablist" aria-label="Lid maʼlumotlari">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${S.tab === k}" class="${S.tab === k ? 'is-on' : ''}" data-sa-tab="${k}">${t}${k === 'tarix' && comments.length ? ` <b>${comments.length}</b>` : ''}</button>`).join('')}</div>
          <div class="sa-tabpane">${S.tab === 'tarix' ? tabHistory(l, comments) : S.tab === 'info' ? tabInfo(l) : `<div id="saRec" class="sa-rec">${recSkeleton()}</div>`}</div>
        </div>
        <div class="sa-bar"><button type="button" class="sa-btn sa-btn--outline" data-sa-stagesheet="${esc(l.id)}">Bosqichni oʻzgartirish${ic('down', 16, 2.4)}</button></div>`;
    }
    function tabHistory(l, comments) {
        const item = typeof window.renderLeadCommentItem === 'function' ? window.renderLeadCommentItem : null;
        return `
        <form class="sa-note" data-sa-noteform>
          <label class="sa-sr" for="saNote">Izoh</label>
          <textarea id="saNote" rows="2" maxlength="2000" placeholder="Izoh yozing…"></textarea>
          <div class="sa-note-a"><button type="button" class="sa-btn sa-btn--soft" data-sa-followup="${esc(l.id)}">${ic('clock', 16, 2.2)}Eslatma qoʻyish</button><button type="submit" class="sa-btn sa-btn--primary sa-btn--sm">Saqlash</button></div>
        </form>
        ${comments.length ? `<div class="sa-hist">${comments.map(c => item ? item(c) : `<div class="lead-comment-item"><div class="lead-comment-text">${esc(c.text)}</div></div>`).join('')}</div>` : `<p class="sa-muted">Hali izoh yoʻq</p>`}`;
    }
    function tabInfo(l) {
        const row = (k, v) => (v || v === 0) && String(v).trim() ? `<div class="sa-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : '';
        const cs = l.connectedSurvey || {};
        const ps = l.paymentSurvey || {};
        const po = l.paymentOnboarding || {};
        const tr = g('renderLeadTrialStatus') ? renderLeadTrialStatus(l) : '';
        const dp = g('renderDeferredPurchaseDates') ? renderDeferredPurchaseDates(l) : '';
        const mgr = g('getSalesManagers') ? (getSalesManagers().find(m => String(m.id) === String(l.managerId)) || {}).name : '';
        const info = (Array.isArray(l.infoProvidedSurvey) ? l.infoProvidedSurvey : []).filter(a => a.answer === 'yes').map(a => a.label).join(', ');
        return `
        <div class="sa-card sa-kvs">
          ${row('Kimning lidi', mgr)}${row('Telefon', l.phone && (g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone) : l.phone))}${row('2-telefon', l.phone2 && (g('formatPhoneDisplay') ? formatPhoneDisplay(l.phone2) : l.phone2))}
          ${row('Yoʻnalish', lang() === 'russian' ? 'Rus tili' : 'Ingliz tili')}${row('Manba', srcLabel(l))}${row('Lid turi', kindLabel(l))}
          ${row('Kelgan vaqti', assignedAt(l) ? when(assignedAt(l)) : l.date)}${row('ID', l.serialCode ? '#' + l.serialCode : '')}${row('Hudud', l.region)}
        </div>
        ${Object.keys(cs).length ? `<h3 class="sa-h3">Anketa</h3><div class="sa-card sa-kvs">${row('Kim uchun', cs.applicantLabel || cs.applicant)}${row('Yoshi', cs.age)}${row('Jinsi', cs.genderLabel || cs.gender)}${row('Til darajasi', cs.languageLevelLabel || cs.languageLevel)}${row('Maqsadi', cs.learningGoalLabel || cs.learningGoal)}${row('Yashash joyi', cs.residenceLabel || cs.regionLabel || cs.countryLabel)}${row('Tushuntirildi', info)}</div>` : ''}
        ${l.decisionSurvey?.reasonLabel ? `<h3 class="sa-h3">Qaror</h3><div class="sa-card sa-kvs">${row('Sabab', l.decisionSurvey.reasonLabel)}</div>` : ''}
        ${dp ? `<h3 class="sa-h3">Keyin sotib oladi</h3><div class="sa-card sa-raw">${l.deferredPurchaseSurvey?.reasonLabel ? `<div class="sa-kv"><span>Sabab</span><b>${esc(l.deferredPurchaseSurvey.otherReason || l.deferredPurchaseSurvey.reasonLabel)}</b></div>` : ''}${dp}</div>` : ''}
        ${tr ? `<h3 class="sa-h3">Sinov darsi</h3><div class="sa-card sa-raw">${tr}</div>` : ''}
        ${ps.paymentType || po.teacherId ? `<h3 class="sa-h3">Toʻlov va jadval</h3><div class="sa-card sa-kvs">${row('Toʻlov turi', ps.paymentTypeLabel || ps.paymentType)}${row('Tarif', ps.tariffLabel || ps.tariff)}${row('Summa', ps.amountLabel || (ps.amount ? num(ps.amount) : ''))}${row('Toʻlangan', ps.paidAmount ? num(ps.paidAmount) : '')}${row('Qarz', ps.debtAmount ? num(ps.debtAmount) : '')}${row('Keyingi toʻlov', ps.nextPaymentDateLabel || ps.nextPaymentDate)}${row('Ustoz', teacherName(po.teacherId))}${row('Dars vaqti', po.lessonTime)}${row('Telegram guruh', po.telegramGroupName)}</div>` : ''}
        ${l.failedSaleReason?.label ? `<h3 class="sa-h3">Muvaffaqiyatsiz</h3><div class="sa-card sa-kvs">${row('Sabab', l.failedSaleReason.label)}</div>` : ''}
        ${l.sifatsizReason?.label ? `<h3 class="sa-h3">Sifatsiz</h3><div class="sa-card sa-kvs">${row('Sabab', l.sifatsizReason.label)}</div>` : ''}`;
    }
    const recSkeleton = () => `<div class="sa-sk" style="height:56px"></div><div class="sa-sk" style="height:56px"></div>`;
    async function loadRecordings(id) {
        const box = document.getElementById('saRec');
        if (!box) return;
        let list = [];
        try { list = g('apiFetchCallRecordings') ? await apiFetchCallRecordings(lang(), id) : []; } catch (e) { box.innerHTML = `<div class="sa-err">${ic('x', 18)}<span>Yozuvlar yuklanmadi</span><button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-sa-recretry>Qayta urinish</button></div>`; return; }
        if (S.screen !== 'card' || S.lead !== id || S.tab !== 'rec') return;
        const arr = Array.isArray(list) ? list : (list?.recordings || []);
        box.innerHTML = `${arr.length ? arr.map(r => `<div class="sa-card sa-recrow"><div class="sa-rec-h"><strong>${esc(r.fileName || (r.source === 'beeline' ? 'Beeline yozuvi' : 'Yozuv'))}</strong><span>${r.createdAt ? esc(when(parseT(r.createdAt))) : ''}</span></div><audio controls preload="none" src="${esc(r.url)}"></audio></div>`).join('') : `<p class="sa-muted">Bu lid boʻyicha yozuv yoʻq</p>`}
          <button type="button" class="sa-btn sa-btn--outline" data-sa-recmanage="${esc(id)}">${ic('mic', 18)}Yozuv qoʻshish / boshqarish</button>`;
    }

    function screenPlan() {
        const now = new Date();
        const key = g('getMonthKey') ? getMonthKey(now) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const plan = g('getIndividualSalesPlan') ? getIndividualSalesPlan(mid(), key) : null;
        const target = Number(plan?.totalAmount) || 0;
        const sales = g('getManagerSalesForMonth') ? getManagerSalesForMonth(mid(), key) : 0;
        const deals = g('getManagerDealsCountForMonth') ? getManagerDealsCountForMonth(mid(), key) : (g('getManagerDealsCount') ? getManagerDealsCount(mid(), 'oylik') : 0);
        const pct = target ? Math.round(sales / target * 100) : 0;
        const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(1, daysIn - now.getDate() + 1);
        const due = target ? Math.round(target * now.getDate() / daysIn) : 0;
        const perDay = target > sales ? Math.ceil((target - sales) / daysLeft) : 0;
        // Kunlik tushum: reyting bilan bitta manba (getLeadStatsForRankings + _getLeadRankingAmount).
        const pool = g('getLeadStatsForRankings') ? getLeadStatsForRankings() : [];
        const owner = l => (window.staffStatus?.saleOwner ? staffStatus.saleOwner(l) : (l.saleManagerId || l.managerId));
        const days = [...Array(14)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i); return { d, k: dayKey(d), v: 0 }; });
        const paid = [];
        pool.filter(l => String(owner(l)) === String(mid())).forEach(l => {
            const s = st(l);
            const partial = s === 'tolov-jarayonida' && Number(l.paymentSurvey?.paidAmount) > 0;
            if (s !== 'tolov-yopildi' && !partial) return;
            const t = parseT(partial ? l.paymentSurvey?.lastPaymentDate : (l.paymentClosedSurvey?.closedDate || l.closedDate || l.createdAt));
            const v = g('_getLeadRankingAmount') ? _getLeadRankingAmount(l) : 0;
            if (!t) return;
            const day = days.find(x => x.k === dayKey(t)); if (day) day.v += v;
            paid.push({ t, v, name: leadById(l.id)?.name || '' });
        });
        const max = Math.max(1, ...days.map(x => x.v));
        const best = days.reduce((a, b) => (b.v > a.v ? b : a), days[0]);
        paid.sort((a, b) => b.t - a.t);
        const todaySales = days[13].v;
        const bonus = (typeof DAILY_BONUSES !== 'undefined' ? DAILY_BONUSES : []).map(b => g('getMergedBonus') ? getMergedBonus(b) : b);
        const gifts = (typeof MONTHLY_BONUSES !== 'undefined' ? MONTHLY_BONUSES : []).map(b => g('getMergedBonus') ? getMergedBonus(b) : b).filter(b => Number(b.threshold) > 0);
        const prize = id => (typeof PRIZE_IMAGES !== 'undefined' && PRIZE_IMAGES[id] ? `<img src="images/prizes/${PRIZE_IMAGES[id]}" alt="" width="48" height="48" loading="lazy">` : `<span class="sa-ic-box">${ic('trophy')}</span>`);
        return `
        <header class="sa-top"><div class="sa-top-t"><h1 class="sa-h1">Rejam</h1></div><span class="sa-badge">${MON[now.getMonth()][0].toUpperCase() + MON[now.getMonth()].slice(1)}</span></header>
        <div class="sa-body sa-stagger">
          <section class="sa-dark sa-plan-hero">
            <img class="sa-plan-hero-img" src="images/kobalt-money.webp" alt="" width="84">
            <span class="sa-k sa-k--light">SHAXSIY REJA</span>
            <div class="sa-big"><strong>${mln(sales)}</strong>${target ? `<em>/ ${mln(target)}</em>` : ''}</div>
            <span class="sa-dark-sub">${deals} ta toʻlov${deals ? ' · oʻrtacha chek ' + num(Math.round(sales / Math.max(1, deals))) : ''}</span>
            ${target ? `<div class="sa-pbar" role="img" aria-label="${pct}% bajarildi, bugungacha ${Math.min(100, Math.round(due / target * 100))}% kerak edi"><div style="--w:${Math.min(100, pct)}%"><i></i></div><span class="sa-pbar-m" style="left:${Math.min(100, Math.round(due / target * 100))}%"></span></div>
            <div class="sa-pbar-l"><b>${pct}%</b><span>${perDay ? `kuniga ${num(perDay)} kerak · ${daysLeft} kun` : 'reja bajarildi'}</span></div>` : `<div class="sa-dark-sub">Oylik rejani ROP yoki admin belgilaydi</div>`}
          </section>
          ${bonus.length ? `<section class="sa-card sa-pad"><div class="sa-sec-h"><h2>Bugungi bonus</h2><span class="sa-k">bugun ${mln(todaySales)}</span></div>
            <div class="sa-tiers">${bonus.map(b => { const ok = todaySales >= b.threshold; return `<div class="sa-tier${ok ? ' is-ok' : ''}"><strong>${esc(b.label)}</strong><span>${mln(b.threshold)}</span><em>${ok ? 'olindi' : mln(b.threshold - todaySales) + ' qoldi'}</em></div>`; }).join('')}</div></section>` : ''}
          <section class="sa-card sa-pad"><div class="sa-sec-h"><h2>Kunlik tushum</h2><span class="sa-k">soʻnggi 14 kun</span></div>
            <div class="sa-bars" role="img" aria-label="Soʻnggi 14 kundagi tushum">${days.map((x, i) => `<span style="--h:${Math.round(x.v / max * 100)}%;--i:${i}" class="${i === 13 ? 'is-today' : x === best && x.v ? 'is-best' : ''}"></span>`).join('')}</div>
            <div class="sa-bars-l"><span>${days[0].d.getDate()}-${MON[days[0].d.getMonth()].slice(0, 3)}</span>${best.v ? `<span>eng yaxshi: ${best.d.getDate()}-${MON[best.d.getMonth()].slice(0, 3)} · ${mln(best.v)}</span>` : ''}<span>Bugun</span></div></section>
          ${gifts.length ? `<section class="sa-sec"><div class="sa-sec-h"><h2>Oylik sovgʻalar</h2></div><div class="sa-gifts">${gifts.map(b => { const ok = sales >= b.threshold; return `<div class="sa-card sa-gift${ok ? ' is-ok' : ''}">${prize(b.id)}<strong>${esc(b.label)}</strong><span>${ok ? 'olindi' : mln(b.threshold - sales) + ' qoldi'}</span></div>`; }).join('')}</div></section>` : ''}
          <section class="sa-sec"><div class="sa-sec-h"><h2>Soʻnggi toʻlovlar</h2><button type="button" class="sa-link" data-sa-crm="sales:sales-plan">Batafsil</button></div>
            ${paid.length ? `<div class="sa-card sa-list">${paid.slice(0, 5).map(p => `<div class="sa-row"><span class="sa-ok">${ic('check', 18, 2.6)}</span><span class="sa-row-t"><strong>${esc(p.name || 'Toʻlov')}</strong><span>${esc(when(p.t))}</span></span><strong class="sa-num">${num(p.v)}</strong></div>`).join('')}</div>` : `<div class="sa-card sa-muted-card">Shu oy hali toʻlov yoʻq</div>`}
          </section>
        </div>`;
    }

    function screenRating() {
        const per = S.ratingPeriod;
        const ms = g('getActiveSalesManagers') ? getActiveSalesManagers(lang()) : [];
        const rows = ms.map(m => ({ id: m.id, name: m.name, sales: g('getManagerSalesForPeriod') ? getManagerSalesForPeriod(m.id, per) : 0, deals: g('getManagerDealsCount') ? getManagerDealsCount(m.id, per) : 0 }))
            .sort((a, b) => b.sales - a.sales);
        const meIdx = rows.findIndex(r => String(r.id) === String(mid()));
        const me = rows[meIdx];
        const pod = [rows[1], rows[0], rows[2]];
        const H = [70, 96, 52];
        const prizeTxt = per === 'haftalik' && typeof WEEKLY_BONUSES !== 'undefined' ? WEEKLY_BONUSES : null;
        const rankGift = per === 'oylik' && typeof RANK_BONUSES !== 'undefined' ? RANK_BONUSES : null;
        const gap = meIdx > 0 ? rows[0].sales - (me?.sales || 0) : 0;
        const segs = [['kunlik', 'Bugun'], ['haftalik', 'Hafta'], ['oylik', 'Oy']];
        return `
        <section class="sa-rate-hero">
          <div class="sa-rate-top"><button type="button" class="sa-icon-btn sa-on-blue" data-sa-back aria-label="Orqaga">${ic('back', 22, 2.2)}</button><h1>Reyting</h1>
            <div class="sa-rate-seg" role="tablist" aria-label="Davr">${segs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${per === k}" class="${per === k ? 'is-on' : ''}" data-sa-rper="${k}">${t}</button>`).join('')}</div></div>
          <div class="sa-pod">${pod.map((r, i) => r ? `<div class="sa-pod-c sa-pod-${i}">
              ${i === 1 ? `<img class="sa-pod-cup" src="images/prizes/trophy.png" alt="" width="54" height="54">` : ''}
              <span class="sa-pod-av">${staffImg(r.id, r.name, i === 1 ? 76 : 62)}<b>${i === 1 ? 1 : i === 0 ? 2 : 3}</b></span>
              <strong>${String(r.id) === String(mid()) ? 'Siz' : esc(firstName(r.name))}</strong><span>${mln(r.sales)}</span><i style="height:${H[i]}px"></i></div>` : '<div></div>').join('')}</div>
        </section>
        <div class="sa-body sa-stagger">
          ${me ? `<section class="sa-card sa-me-card"><div><strong>${meIdx === 0 ? 'Siz birinchisiz!' : `${meIdx + 1}-oʻrin · 1-oʻringacha ${num(gap)}`}</strong><span>${meIdx === 0 ? 'Oʻrningizni saqlang' : 'Har bir toʻlov sizni yaqinlashtiradi'}</span>
            <div class="sa-mini-bar"><i style="width:${rows[0]?.sales ? Math.round((me.sales / rows[0].sales) * 100) : 0}%"></i></div></div><button type="button" class="sa-btn sa-btn--primary sa-btn--sm" data-sa-nav="leads">Lidlarga</button></section>` : ''}
          ${prizeTxt || rankGift ? `<section class="sa-card sa-prize"><img src="images/prizes/${rankGift ? 'prize-cash.png' : 'prize-book.png'}" alt="" width="60" height="60"><div><span class="sa-k sa-k--amber">${rankGift ? 'OY SOVRINLARI' : 'HAFTA SOVRINLARI'}</span>${(rankGift || prizeTxt).slice(0, 3).map(b => `<span class="sa-prize-r"><b>${esc(b.label)}</b>${esc(b.prize || b.desc || '')}</span>`).join('')}</div></section>` : ''}
          ${rows.length > 3 ? `<ol class="sa-card sa-list sa-rank" start="4">${rows.slice(3).map((r, i) => `<li class="sa-row${String(r.id) === String(mid()) ? ' is-me' : ''}"><b class="sa-rank-n">${i + 4}</b>${staffImg(r.id, r.name, 36)}<span class="sa-row-t"><strong>${String(r.id) === String(mid()) ? 'Siz' : esc(firstName(r.name))}</strong><span>${r.deals} ta toʻlov</span></span><strong class="sa-num">${mln(r.sales)}</strong></li>`).join('')}</ol>` : ''}
          <button type="button" class="sa-link sa-center" data-sa-crm="sales:rating">Bonuslar va tarix</button>
        </div>`;
    }

    function screenMenu() {
        const u = user();
        const students = g('filterStudentsForSalesManager') ? filterStudentsForSalesManager(getItem(STORAGE_KEYS.students, []) || [], u) : [];
        const debt = students.filter(s => Number(s.debtAmount) > 0 && !s.isStaffDemo);
        const debtSum = debt.reduce((a, s) => a + Number(s.debtAmount || 0), 0);
        let place = '';
        try { const rows = getActiveSalesManagers(lang()).map(m => ({ id: m.id, s: getManagerSalesForPeriod(m.id, 'oylik') })).sort((a, b) => b.s - a.s); const i = rows.findIndex(r => String(r.id) === String(mid())); if (i >= 0) place = (i + 1) + '-oʻrin'; } catch (e) { /* reyting hisobi bo'lmasa — bo'sh */ }
        const tile = (go, icon, tone, title, sub, subTone = '') => `<button type="button" class="sa-tile2" ${go}><span class="sa-ic-box sa-tone-${tone}">${ic(icon)}</span><span><strong>${title}</strong><em class="${subTone}">${sub}</em></span></button>`;
        return `
        <header class="sa-top"><div class="sa-top-t"><h1 class="sa-h1">Menyu</h1></div>${bell()}</header>
        <div class="sa-body sa-stagger">
          <button type="button" class="sa-profile" data-sa-go="profile">${staffImg(mid(), u.name, 56)}<span><strong>${esc(u.name || '')}</strong><em>Sotuv menejeri · ${lang() === 'russian' ? 'Rus tili' : 'Ingliz tili'}</em>${place ? `<b>Reytingda ${place}</b>` : ''}</span>${ic('chev', 20, 2.2)}</button>
          <nav class="sa-grid" aria-label="Boʻlimlar">
            ${tile('data-sa-crm="students"', 'students', 'blue', 'Oʻquvchilarim', students.filter(s => !s.isStaffDemo).length + ' ta')}
            ${tile('data-sa-go="debtors"', 'debt', 'red', 'Qarzdorlar', debt.length ? `${debt.length} ta · ${mln(debtSum)}` : 'yoʻq', debt.length ? 'is-red' : '')}
            ${tile('data-sa-go="rating"', 'trophy', 'amber', 'Reyting', place || 'koʻrish')}
            ${tile('data-sa-crm="sales:scripts"', 'script', 'gray', 'Skriptlar', 'qoʻngʻiroq uchun')}
            ${tile('data-sa-crm="sales:book-roadmap"', 'truck', 'amber', 'Kitob yetkazish', 'kartalar')}
            ${tile('data-sa-crm="sales:sales-stats"', 'chart', 'green', 'Statistika', 'voronkam')}
            ${tile('data-sa-trials', 'trial', 'blue', 'Sinov darslari', 'tarix va holat')}
            ${tile('data-sa-crm="marketing"', 'sms', 'gray', 'SMS xabarlar', 'shablonlar')}
            ${tile('data-sa-crm="guides"', 'book', 'gray', 'Yoʻriqnomalar', 'qoidalar')}
          </nav>
          <div class="sa-card sa-list">
            <button type="button" class="sa-row sa-row-btn" data-sa-crm="profile">${ic('gear', 20)}<span class="sa-row-t"><strong>Sozlamalar</strong><span>Parol, bildirishnomalar, Telegram bot</span></span>${ic('chev', 18, 2.2)}</button>
            <button type="button" class="sa-row sa-row-btn" data-sa-install hidden>${ic('plus', 20)}<span class="sa-row-t"><strong>Ilovani oʻrnatish</strong><span>Bosh ekranga belgi qoʻshiladi</span></span>${ic('chev', 18, 2.2)}</button>
            <button type="button" class="sa-row sa-row-btn sa-danger" data-sa-logout>${ic('logout', 20)}<span class="sa-row-t"><strong>Chiqish</strong></span></button>
          </div>
        </div>`;
    }

    function screenDebtors() {
        const u = user();
        const students = g('filterStudentsForSalesManager') ? filterStudentsForSalesManager(getItem(STORAGE_KEYS.students, []) || [], u) : [];
        const today = new Date(new Date().toDateString()).getTime();
        const list = students.filter(s => !s.isStaffDemo && Number(s.debtAmount) > 0)
            .map(s => ({ s, due: parseT(s.paymentDueDate) })).sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
        const over = list.filter(x => x.due && x.due < today), soon = list.filter(x => !x.due || x.due >= today);
        const total = list.reduce((a, x) => a + Number(x.s.debtAmount || 0), 0);
        const card = ({ s, due }, overdue) => {
            const ph = telOf(s.phone);
            const daysTxt = due ? (overdue ? dur(today - due) + ' oʻtdi' : due === today ? 'bugun' : dur(due - today) + ' qoldi') : 'sana yoʻq';
            return `<article class="sa-card sa-debt${overdue ? ' is-over' : ''}">
              <div class="sa-debt-h">${avatar(s.name, 42)}<span class="sa-row-t"><strong>${esc(s.name || 'Oʻquvchi')}</strong><span>${due ? 'Kelishilgan sana · ' + esc(g('formatDateShort') ? formatDateShort(s.paymentDueDate) : s.paymentDueDate) : 'Sana kelishilmagan'}</span></span>
                <span class="sa-debt-v"><strong>${num(s.debtAmount)}</strong><em class="${overdue ? 'is-red' : 'is-amber'}">${daysTxt}</em></span></div>
              <div class="sa-debt-a">${ph ? `<a class="sa-btn sa-btn--primary sa-btn--sm" href="tel:${esc(ph)}">${ic('phone', 16, 2.2)}Qoʻngʻiroq</a><a class="sa-btn sa-btn--outline sa-btn--sm" href="sms:${esc(ph)}">${ic('sms', 16)}SMS</a>` : ''}${window.inflowUI?.openPayment ? `<button type="button" class="sa-btn sa-btn--outline sa-btn--sm" data-sa-pay="${esc(s.id)}">Toʻlov qabul</button>` : ''}</div>
            </article>`;
        };
        return `
        ${topBack('Qarzdorlar', '')}
        <div class="sa-body sa-stagger">
          <section class="sa-debt-sum"><div><span>Jami qarz</span><strong>${num(total)}</strong></div><div><span>${list.length} oʻquvchi</span><em>${over.length ? over.length + ' tasi muddati oʻtgan' : 'muddati oʻtgan yoʻq'}</em></div></section>
          ${over.length ? `<h3 class="sa-h3 is-red">MUDDATI OʻTGAN</h3>${over.map(x => card(x, true)).join('')}` : ''}
          ${soon.length ? `<h3 class="sa-h3">YAQIN KUNLARDA</h3>${soon.map(x => card(x, false)).join('')}` : ''}
          ${!list.length ? empty('students', 'Qarzdor yoʻq', 'Hamma oʻquvchilaringiz toʻlovni oʻz vaqtida qilgan') : ''}
          <button type="button" class="sa-link sa-center" data-sa-crm="sales:debtors">Toʻliq jadval va filtrlar</button>
        </div>`;
    }

    function screenProfile() {
        const u = user();
        return `
        ${topBack('Profil', '')}
        <div class="sa-body sa-stagger">
          <section class="sa-prof">${staffImg(mid(), u.name, 92)}<strong>${esc(u.name || '')}</strong><span>Sotuv menejeri · ${lang() === 'russian' ? 'Rus tili' : 'Ingliz tili'}${u.email ? ' · ' + esc(u.email) : ''}</span></section>
          <div class="sa-card sa-list">
            <button type="button" class="sa-row sa-row-btn" data-sa-crm="profile">${ic('gear', 20)}<span class="sa-row-t"><strong>Sozlamalar</strong><span>Parol, sessiyalar, bildirishnomalar, Telegram bot</span></span>${ic('chev', 18, 2.2)}</button>
            <button type="button" class="sa-row sa-row-btn" data-sa-install hidden>${ic('plus', 20)}<span class="sa-row-t"><strong>Ilovani oʻrnatish</strong><span>Bosh ekranga belgi qoʻshiladi</span></span>${ic('chev', 18, 2.2)}</button>
            <button type="button" class="sa-row sa-row-btn sa-danger" data-sa-logout>${ic('logout', 20)}<span class="sa-row-t"><strong>Chiqish</strong></span></button>
          </div>
        </div>`;
    }

    // ---------- pastki oynalar (sheet) ----------
    function openSheet(html, cls = '') {
        closeSheet(true);
        sheetEl = document.createElement('div');
        sheetEl.className = 'sa-sheet-wrap';
        sheetEl.innerHTML = `<button type="button" class="sa-dim" data-sa-sheetclose aria-label="Yopish"></button><section class="sa-sheet ${cls}" role="dialog" aria-modal="true" tabindex="-1"><span class="sa-handle" aria-hidden="true"></span>${html}</section>`;
        document.body.appendChild(sheetEl);
        sheetEl.addEventListener('click', onClick);
        sheetEl.querySelector('.sa-sheet')?.focus({ preventScroll: true });
    }
    function closeSheet(instant) {
        if (!sheetEl) return;
        const el = sheetEl; sheetEl = null;
        if (instant) { el.remove(); return; }
        el.classList.add('is-out');
        setTimeout(() => el.remove(), 220);
    }

    function openCallResult(id) {
        const l = leadById(id);
        if (!l) return;
        const s = st(l);
        const before = PATH.indexOf(s) >= 0 && PATH.indexOf(s) < PATH.indexOf('boglanildi');
        const locked = before && !hasSurvey(l);
        const opt = (k, icon, tone, title, sub, isLocked) => `<button type="button" class="sa-opt${isLocked ? ' is-locked' : ''}" data-sa-outcome="${k}">${ic(icon, 22, 2.2).replace('currentColor', `var(--sa-${tone})`)}<strong>${title}</strong>${sub ? `<em>${isLocked ? ic('lock', 12, 2.6) : ''}${sub}</em>` : ''}</button>`;
        openSheet(`
          <div class="sa-sh-h"><span class="sa-ic-box sa-tone-green">${ic('phone', 22, 2.2)}</span><div><h2>Qoʻngʻiroq qanday oʻtdi?</h2><span>${esc(l.name || 'Lid')}</span></div><button type="button" class="sa-link" data-sa-sheetclose>Keyin</button></div>
          <div class="sa-opts" data-sa-lead-id="${esc(id)}">
            ${opt('talked', 'sms', 'blue', 'Gaplashdik', before ? 'anketa ochiladi' : '')}
            ${opt('noanswer', 'nope', 'red', 'Javob bermadi', '')}
            ${opt('later', 'clock', 'amber', 'Keyin oladi', 'sana soʻraladi')}
            ${opt('trial', 'trial', 'green', 'Sinovga yozildi', locked ? 'anketadan keyin' : 'vaqt tanlanadi', locked)}
            ${opt('pay', 'debt', 'blue', 'Toʻlov qiladi', locked ? 'anketadan keyin' : 'toʻlov qadamlari', locked)}
            ${opt('fail', 'x', 'gray', 'Qiziqmaydi', 'sabab soʻraladi')}
          </div>
          <button type="button" class="sa-link" data-sa-outcome="junk">Notoʻgʻri raqam yoki boshqa til → Sifatsiz</button>
          <div class="sa-fld"><span id="saCrNoteL">Qisqa izoh</span>
            <div class="sa-qchips">${['Narxni soʻradi', 'Oila bilan maslahatlashadi', 'Kechqurun qulay', 'Ish uchun', 'Farzandi uchun'].map(t => `<button type="button" class="sa-qchip" data-sa-qchip>${t}</button>`).join('')}</div>
            <textarea id="saCrNote" rows="2" maxlength="2000" aria-labelledby="saCrNoteL" placeholder="Nima deb kelishdingiz?"></textarea></div>
          <p class="sa-sh-foot">Natijani tanlang — izoh lid tarixiga yoziladi</p>`, 'sa-sheet--call');
    }

    function addComment(id, text, type = 'manual', extra = {}) {
        if (!text || !g('updateLeadInStorage') || !g('createLeadComment')) return null;
        const u = user();
        return updateLeadInStorage(lang(), id, l => {
            const b = g('normalizeLeadExtras') ? normalizeLeadExtras(l) : l;
            return { ...b, comments: [...(b.comments || []), createLeadComment({ text, author: u.name, type, ...extra })] };
        });
    }
    function move(id, to) {
        if (!g('requestLeadStageChange')) return;
        closeSheet(true);
        toastEl?.remove();
        requestLeadStageChange(lang(), id, to);
    }
    function outcome(id, k) {
        const l = leadById(id);
        if (!l) return;
        const note = document.getElementById('saCrNote')?.value.trim();
        const s = st(l);
        if (note) addComment(id, note);
        if (k === 'talked') {
            const before = PATH.indexOf(s) >= 0 && PATH.indexOf(s) < PATH.indexOf('boglanildi');
            closeSheet();
            if (before) move(id, 'boglanildi');
            else toast(note ? 'Izoh saqlandi' : 'Qayd etildi', 'ok');
            render();
            return;
        }
        if (k === 'noanswer') {
            if (s === 'yangi-lidlar') { move(id, 'boglanishga-urinilmoqda'); return; }
            const r = (typeof LEAD_CONTACT_FAIL_REASONS !== 'undefined' ? LEAD_CONTACT_FAIL_REASONS : []).find(x => x.id === 'no-answer');
            addComment(id, r?.label || 'Javob bermadi', 'contact-fail', { reason: r?.label || 'Javob bermadi', reasonId: 'no-answer' });
            closeSheet();
            toast('“Javob bermadi” yozildi. Eslatma qoʻyasizmi?', 'ok', { label: 'Eslatma', fn: () => followUpFor(id) });
            render();
            return;
        }
        const map = { later: 'keyin-sotib-olmoqchi', trial: 'sinov-darsida', pay: 'tolov-jarayonida', fail: 'muvaffaqiyatsiz-sotuv', junk: 'sifatsiz-lidlar' };
        if (map[k]) move(id, map[k]);
    }
    const followUpFor = id => { const l = leadById(id); if (l && g('openLeadFollowUpReminderModal')) openLeadFollowUpReminderModal(lang(), id, l.name, user().name); };

    function openStageSheet(id) {
        const l = leadById(id);
        if (!l) return;
        const s = st(l);
        const survey = hasSurvey(l);
        const SUB = {
            'boglanishga-urinilmoqda': 'Bogʻlanib boʻlmadi — sabab soʻraladi',
            'boglanildi': survey ? 'Anketa toʻldirilgan' : 'Anketa ochiladi · 11 savol',
            'sinov-darsida': survey ? 'Jadvaldan boʻsh vaqt tanlanadi' : 'Avval anketa, keyin jadval',
            'qaror-jarayonida': 'Qaror sababi soʻraladi',
            'keyin-sotib-olmoqchi': 'Sabab, sotib olish va qoʻngʻiroq sanasi',
            'tolov-jarayonida': 'Tarif, jadval, toʻlov, guruh, login',
            'tolov-yopildi': 'Toʻlov yakuni kiritiladi'
        };
        const pathIds = PATH.concat(['keyin-sotib-olmoqchi']);
        const ordered = COLS().map(c => c.id).filter(id2 => pathIds.includes(id2));
        openSheet(`
          <div class="sa-sh-h"><div><h2>Bosqichni oʻzgartirish</h2><span>Hozir: ${esc(colLabel(s))}</span></div><button type="button" class="sa-icon-btn sa-ghost" data-sa-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <ol class="sa-stages">${ordered.map(id2 => {
              const cur = id2 === s;
              const locked = !survey && PATH.indexOf(id2) > PATH.indexOf('boglanildi');
              return `<li><button type="button" class="sa-stage${cur ? ' is-cur' : ''}${locked ? ' is-locked' : ''}" ${cur ? 'aria-current="true" disabled' : `data-sa-move="${id2}"`}><span class="sa-dot" style="background:${(COLS().find(c => c.id === id2) || {}).border || '#9DC4F5'}"></span><span class="sa-row-t"><strong>${esc(colLabel(id2))}</strong>${cur ? '<span>hozirgi</span>' : SUB[id2] ? `<span>${SUB[id2]}</span>` : ''}</span>${cur ? '' : ic(locked ? 'lock' : 'chev', 16, 2.4)}</button></li>`;
          }).join('')}</ol>
          <div class="sa-close-h">YOPISH · SABAB MAJBURIY</div>
          <div class="sa-close2">
            <button type="button" class="sa-btn sa-btn--danger" data-sa-move="muvaffaqiyatsiz-sotuv" ${s === 'muvaffaqiyatsiz-sotuv' ? 'disabled' : ''}>Muvaffaqiyatsiz<em>qiziqmadi, narx…</em></button>
            <button type="button" class="sa-btn sa-btn--outline" data-sa-move="sifatsiz-lidlar" ${s === 'sifatsiz-lidlar' ? 'disabled' : ''}>Sifatsiz<em>notoʻgʻri raqam…</em></button>
          </div>`, 'sa-sheet--stages');
    }

    function openFilterSheet() {
        const o = (k, t) => `<button type="button" class="sa-opt2${S.src === k ? ' is-on' : ''}" data-sa-src="${k}">${t}${S.src === k ? ic('check', 18, 2.6) : ''}</button>`;
        openSheet(`<div class="sa-sh-h"><div><h2>Filtr</h2><span>Lid turi boʻyicha</span></div><button type="button" class="sa-icon-btn sa-ghost" data-sa-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button></div>
          <div class="sa-opts2">${o('all', 'Hammasi')}${o('target', 'Target')}${o('organic', 'Organik')}</div>
          <button type="button" class="sa-link" data-sa-crm="sales:leads">Kengaytirilgan filtrlar (sana, manba)</button>`);
    }


    function notifList() {
        try { if (g('syncNotifications')) syncNotifications(); } catch (e) { /* oflayn */ }
        const all = g('getNotifications') ? (getNotifications() || []) : [];
        return all.slice().sort((a, b) => (parseT(b.time) || 0) - (parseT(a.time) || 0)).slice(0, 60);
    }
    function openNotifSheet() {
        const list = notifList();
        const unread = list.filter(n => !n.read).length;
        const today = dayKey(Date.now());
        const tone = n => (/debt|qarz/i.test(n.type || n.cat || '') ? 'red' : /sla|follow|eslatma/i.test(n.type || n.kind || '') ? 'amber' : /trial|sinov/i.test(n.type || '') ? 'green' : 'blue');
        const icon = n => ({ red: 'debt', amber: 'clock', green: 'trial', blue: 'bell' }[tone(n)]);
        let lastDay = '';
        const rows = list.map(n => {
            const t = parseT(n.time); const k = t ? (dayKey(t) === today ? 'BUGUN' : 'OLDINROQ') : 'OLDINROQ';
            const head = k !== lastDay ? `<h3 class="sa-h3">${k}</h3>` : ''; lastDay = k;
            return `${head}<button type="button" class="sa-notif${n.read ? '' : ' is-new'}" data-sa-nitem="${esc(n.id)}"><span class="sa-ic-box sa-tone-${tone(n)}">${ic(icon(n), 20)}</span><span class="sa-row-t"><strong>${esc(n.title || 'Bildirishnoma')}</strong><span>${esc(n.message || '')}</span></span><em>${t ? esc(g('formatNotifTime') ? formatNotifTime(t) : (dayKey(t) === today ? hm(t) : formatShort(t))) : ''}</em></button>`;
        }).join('');
        openSheet(`<div class="sa-sh-h"><div><h2>Bildirishnomalar</h2><span>${unread ? unread + ' ta yangi' : 'Hammasi oʻqilgan'}</span></div>${unread ? '<button type="button" class="sa-btn sa-btn--soft sa-btn--sm" data-sa-nread>Hammasi oʻqildi</button>' : `<button type="button" class="sa-icon-btn sa-ghost" data-sa-sheetclose aria-label="Yopish">${ic('close', 18, 2.4)}</button>`}</div>
          <div class="sa-notifs">${rows || '<p class="sa-muted">Hozircha bildirishnoma yoʻq</p>'}</div>`, 'sa-sheet--tall');
    }
    function openNotifItem(id) {
        const n = (g('getNotifications') ? getNotifications() : []).find(x => String(x.id) === String(id));
        if (g('markNotificationRead')) markNotificationRead(id);
        closeSheet(true);
        if (!n) return;
        if (n.leadId && (!n.leadLang || n.leadLang === lang())) { openLead(n.leadId); return; }
        if (n.section === 'debtors' || /debt/.test(n.type || '')) { go('debtors'); return; }
        if (n.tab) { openCrm(n.section ? `${n.tab}:${n.section}` : n.tab); return; }
        render(false);
    }

    // ---------- toast ----------
    function toast(msg, kind = 'ok', action) {
        toastEl?.remove();
        toastEl = document.createElement('div');
        toastEl.className = `sa-toast sa-toast--${kind}`;
        toastEl.setAttribute('role', 'status');
        toastEl.innerHTML = `<span class="sa-toast-i">${ic(kind === 'ok' ? 'check' : 'lock', 14, 3)}</span><span>${esc(msg)}</span>${action ? '<button type="button">' + esc(action.label) + '</button>' : ''}`;
        if (action) toastEl.querySelector('button').onclick = () => { toastEl?.remove(); action.fn(); };
        document.body.appendChild(toastEl);
        const el = toastEl;
        setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 260); }, action ? 5000 : 3200);
    }

    // ---------- navigatsiya ----------
    const TABS = [
        { id: 'home', label: 'Bosh', icon: 'home' },
        { id: 'leads', label: 'Lidlar', icon: 'leads' },
        { id: 'jadval', label: 'Jadval', icon: 'cal' },
        { id: 'plan', label: 'Rejam', icon: 'target' },
        { id: 'menu', label: 'Menyu', icon: 'menu' }
    ];
    const TAB_OF = { home: 'home', leads: 'leads', card: 'leads', plan: 'plan', rating: 'menu', menu: 'menu', debtors: 'menu', profile: 'menu', crm: null, jadval: 'jadval' };
    function buildNav() {
        nav = document.createElement('nav');
        nav.id = 'saNav';
        nav.className = 'sa-nav';
        nav.setAttribute('aria-label', 'Pastki menyu');
        document.body.appendChild(nav);
        nav.addEventListener('click', e => {
            const b = e.target.closest('[data-sa-tab-nav]');
            if (!b) return;
            const id = b.dataset.saTabNav;
            S.stack = [];
            if (id === 'jadval') openJadval();
            else go(id, { reset: true });
        });
        syncNav();
    }
    function syncNav() {
        if (!nav) return;
        const active = S.screen === 'crm' ? S.crmTab : TAB_OF[S.screen];
        const n = LEADS().filter(l => st(l) === 'yangi-lidlar').length;
        nav.innerHTML = TABS.map(t => `<button type="button" data-sa-tab-nav="${t.id}" class="${active === t.id ? 'is-on' : ''}" ${active === t.id ? 'aria-current="page"' : ''}><span class="sa-nav-i">${ic(t.icon, 22, active === t.id ? 2.2 : 1.9)}${t.id === 'leads' && n ? `<b>${n > 99 ? '99+' : n}</b>` : ''}</span>${t.label}</button>`).join('');
    }
    function go(screen, opts = {}) {
        if (opts.reset) S.stack = [];
        else if (S.screen !== screen) S.stack.push({ screen: S.screen, lead: S.lead, tab: S.tab });
        if (window.history?.pushState && !opts.fromPop) history.pushState({ sa: screen }, '');
        S.screen = screen;
        if (screen !== 'crm') showApp(true);
        render(true);
    }
    function back() {
        if (sheetEl) { closeSheet(); return true; }
        const prev = S.stack.pop();
        if (!prev) { if (S.screen !== 'home') { go('home', { reset: true, fromPop: true }); return true; } return false; }
        S.screen = prev.screen; S.lead = prev.lead; S.tab = prev.tab || 'tarix';
        if (S.screen === 'crm') { go('home', { reset: true, fromPop: true }); return true; }
        showApp(true);
        render(true);
        return true;
    }
    function openLead(id) { S.lead = id; S.tab = 'tarix'; go('card'); }
    function openJadval() {
        openJadval._busy = true;
        try { _openJadval(); } finally { openJadval._busy = false; }
    }
    function _openJadval() {
        S.crmTab = 'jadval';
        S.screen = 'crm';
        showApp(false);
        if (g('switchTab')) switchTab('timetable');
        syncNav();
    }
    function openCrm(spec) {
        const [tab, section] = String(spec).split(':');
        S.stack.push({ screen: S.screen, lead: S.lead, tab: S.tab });
        if (window.history?.pushState) history.pushState({ sa: 'crm' }, '');
        S.crmTab = TAB_OF[S.screen] === 'plan' ? 'plan' : TAB_OF[S.screen] === 'leads' ? 'leads' : 'menu';
        S.screen = 'crm';
        showApp(false);
        closeSheet(true);
        if (g('switchTab')) switchTab(tab, section ? { salesSection: section } : {});
        if (section && g('switchSalesSection')) switchSalesSection(section);
        document.body.classList.add('sa-crm-page');
        syncNav();
        window.scrollTo?.(0, 0);
    }
    function showApp(on) {
        document.body.classList.toggle('sa-app-hidden', !on);
        document.body.classList.toggle('sa-crm-page', !on);
        if (root) root.hidden = !on;
    }

    // ---------- chizish ----------
    function render(scrollTop) {
        if (!root || !isOn()) return;
        if (S.screen === 'crm') { syncNav(); return; }
        const html = S.screen === 'leads' ? screenLeads() : S.screen === 'card' ? screenCard() : S.screen === 'plan' ? screenPlan()
            : S.screen === 'rating' ? screenRating() : S.screen === 'menu' ? screenMenu() : S.screen === 'debtors' ? screenDebtors()
            : S.screen === 'profile' ? screenProfile() : screenHome();
        const focusSearch = document.activeElement?.id === 'saLeadSearch';
        const caret = focusSearch ? document.activeElement.selectionStart : 0;
        const prevScroll = root.querySelector('.sa-body')?.scrollTop || 0;
        root.dataset.screen = S.screen;
        root.innerHTML = html;
        const body = root.querySelector('.sa-body');
        if (body && !scrollTop) body.scrollTop = prevScroll;
        if (scrollTop) { root.classList.remove('sa-enter'); void root.offsetWidth; root.classList.add('sa-enter'); }
        if (focusSearch) { const i = document.getElementById('saLeadSearch'); if (i) { i.focus(); try { i.setSelectionRange(caret, caret); } catch (e) { /* type=search */ } } }
        if (S.screen === 'card' && S.tab === 'rec') loadRecordings(S.lead);
        if (deferredInstall) root.querySelectorAll('[data-sa-install]').forEach(b => { b.hidden = false; });
        syncNav();
    }
    function queueRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => { renderQueued = false; if (!sheetEl && !document.body.classList.contains('modal-open')) render(false); });
    }

    // ---------- hodisalar ----------
    function onClick(e) {
        const t = e.target.closest('[data-sa-lead],[data-sa-nav],[data-sa-go],[data-sa-back],[data-sa-stage],[data-sa-stagego],[data-sa-call],[data-sa-tg],[data-sa-sms],[data-sa-move],[data-sa-retrial],[data-sa-survey],[data-sa-tab],[data-sa-stagesheet],[data-sa-sheetclose],[data-sa-outcome],[data-sa-qchip],[data-sa-followup],[data-sa-notify],[data-sa-recmanage],[data-sa-recretry],[data-sa-crm],[data-sa-trials],[data-sa-notif],[data-sa-filter],[data-sa-src],[data-sa-clearq],[data-sa-rper],[data-sa-pay],[data-sa-logout],[data-sa-install],[data-sa-nread],[data-sa-nitem]');
        if (!t) return;
        const d = t.dataset;
        if ('saCall' in d) { callPending = { id: d.saCall, at: Date.now() }; return; } // tel: havolasi o'zi ochiladi
        e.preventDefault();
        if ('saLead' in d) return openLead(d.saLead);
        if ('saNav' in d) { if (d.saNav === 'jadval') return openJadval(); return go(d.saNav, { reset: true }); }
        if ('saGo' in d) return go(d.saGo);
        if ('saBack' in d) { if (!back()) go('home', { reset: true }); return; }
        if ('saStage' in d) { S.stage = d.saStage; render(true); const c = root.querySelector('.sa-chip.is-on'); c?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); return; }
        if ('saStagego' in d) { S.stage = d.saStagego; S.q = ''; return go('leads', { reset: true }); }
        if ('saTg' in d) { if (g('openLeadTelegramProfile')) openLeadTelegramProfile(lang(), d.saTg); return; }
        if ('saSms' in d) { if (g('openLeadSmsTemplateModal')) openLeadSmsTemplateModal(lang(), d.saSms); return; }
        if ('saMove' in d) { const id = S.lead || t.closest('[data-sa-lead-id]')?.dataset.saLeadId; if (id) move(id, d.saMove); return; }
        if ('saRetrial' in d) { if (g('openRescheduleTrialLessonModal')) openRescheduleTrialLessonModal(lang(), d.saRetrial); return; }
        if ('saSurvey' in d) {
            const l = leadById(d.saSurvey); if (!l) return;
            const s = st(l);
            if (PATH.indexOf(s) >= 0 && PATH.indexOf(s) < PATH.indexOf('boglanildi')) move(l.id, 'boglanildi');
            else if (g('openConnectedSurveyModal')) openConnectedSurveyModal(lang(), l.id, s, {});
            return;
        }
        if ('saTab' in d) { S.tab = d.saTab; render(false); return; }
        if ('saStagesheet' in d) return openStageSheet(d.saStagesheet);
        if ('saSheetclose' in d) return closeSheet();
        if ('saOutcome' in d) { const id = sheetEl?.querySelector('[data-sa-lead-id]')?.dataset.saLeadId; if (id) outcome(id, d.saOutcome); return; }
        if ('saQchip' in d) { const ta = document.getElementById('saCrNote'); t.classList.toggle('is-on'); if (ta) { const v = t.textContent.trim(); ta.value = ta.value.includes(v) ? ta.value.replace(v, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',') : (ta.value ? ta.value.replace(/[.\s]+$/, '') + ', ' : '') + v; } return; }
        if ('saFollowup' in d) return followUpFor(d.saFollowup);
        if ('saNotify' in d) { if (g('openLeadNotifyModal')) openLeadNotifyModal(lang(), d.saNotify); return; }
        if ('saRecmanage' in d) { if (g('openLeadRecordingModal')) openLeadRecordingModal(lang(), d.saRecmanage); return; }
        if ('saRecretry' in d) { loadRecordings(S.lead); return; }
        if ('saCrm' in d) return openCrm(d.saCrm);
        if ('saTrials' in d) { if (window.sotuvSinov?.open) { S.crmTab = 'menu'; S.stack.push({ screen: S.screen }); S.screen = 'crm'; showApp(false); window.sotuvSinov.open({ lang: lang(), from: 'trials', onClose: () => back() }); syncNav(); } return; }
        if ('saNotif' in d) return openNotifSheet();
        if ('saNread' in d) { if (g('markAllNotificationsRead')) markAllNotificationsRead(); openNotifSheet(); syncNav(); return; }
        if ('saNitem' in d) return openNotifItem(d.saNitem);
        if ('saFilter' in d) return openFilterSheet();
        if ('saSrc' in d) { S.src = d.saSrc; closeSheet(); render(true); return; }
        if ('saClearq' in d) { S.q = ''; render(true); return; }
        if ('saRper' in d) { S.ratingPeriod = d.saRper; render(false); return; }
        if ('saPay' in d) { window.inflowUI?.openPayment?.(d.saPay); return; }
        if ('saLogout' in d) { document.getElementById('profileLogoutBtn')?.click(); return; }
        if ('saInstall' in d) { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; render(false); } }
    }
    function onSubmit(e) {
        const f = e.target.closest('[data-sa-noteform]');
        if (!f) return;
        e.preventDefault();
        const ta = f.querySelector('textarea');
        const v = ta?.value.trim();
        if (!v) { ta?.focus(); return; }
        if (addComment(S.lead, v)) { toast('Izoh saqlandi', 'ok'); render(false); }
    }
    function onInput(e) {
        if (e.target.id !== 'saLeadSearch') return;
        S.q = e.target.value;
        clearTimeout(onInput._t);
        onInput._t = setTimeout(() => render(true), 160);
    }

    // Qo'ng'iroqdan qaytganda natija oynasi o'zi ochiladi (tel: ilovasi yopilib, CRM ko'ringanda).
    function onVisible() {
        if (document.visibilityState !== 'visible' || !callPending || !isOn()) return;
        const c = callPending; callPending = null;
        if (Date.now() - c.at < 4000 || Date.now() - c.at > 3 * 3600000) return;
        if (document.body.classList.contains('modal-open')) return;
        openCallResult(c.id);
    }

    // PWA: "Bosh ekranga qo'shish" taklifi (brauzer ruxsat bersa).
    let deferredInstall = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (isOn()) render(false); });

    // Mavjud renderlar ishlaganda (30 soniyalik so'rov, saqlash, modal yopilishi) ekranimiz ham yangilanadi.
    function hookRenders() {
        ['renderDashboard', 'renderLeads', 'renderSales', 'renderNotificationPanel'].forEach(name => {
            const orig = window[name];
            if (typeof orig !== 'function' || orig._sa) return;
            const w = function () { const r = orig.apply(this, arguments); if (isOn() && S.screen !== 'crm') queueRender(); return r; };
            w._sa = true;
            window[name] = w;
            try { if (name === 'renderLeads') renderLeads = w; else if (name === 'renderDashboard') renderDashboard = w; else if (name === 'renderSales') renderSales = w; else if (name === 'renderNotificationPanel') renderNotificationPanel = w; } catch (e) { /* global function binding */ }
        });
        document.getElementById('modalOverlay')?.addEventListener('crm:modal-closed', () => { if (isOn() && S.screen !== 'crm') setTimeout(() => render(false), 60); });
        window.addEventListener('school:changed', () => { if (isOn()) queueRender(); });
    }

    function enable() {
        document.body.classList.add('sa-on');
        if (!root) {
            root = document.createElement('main');
            root.id = 'saApp';
            root.className = 'sa-app';
            root.setAttribute('aria-live', 'polite');
            document.body.appendChild(root);
            root.addEventListener('click', onClick);
            root.addEventListener('submit', onSubmit);
            root.addEventListener('input', onInput);
        }
        if (!nav) buildNav();
        if (window.schoolUI?.loadStaffAvatars && !enable._av) { enable._av = true; Promise.resolve(window.schoolUI.loadStaffAvatars()).then(() => queueRender()).catch(() => {}); }
        showApp(S.screen !== 'crm');
        render(true);
    }
    function disable() {
        document.body.classList.remove('sa-on', 'sa-app-hidden', 'sa-crm-page');
        if (root) root.hidden = true;
    }
    function sync() { if (isOn()) enable(); else disable(); }

    function init() {
        if (inited) return;
        if (user().role !== 'sales_manager') return;
        inited = true;
        hookRenders();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        window.addEventListener('popstate', () => { if (isOn()) back(); });
        MQ.addEventListener?.('change', sync);
        // Jadval/sinov sahifalari (jadvalV3, sotuvSinov) CRM ichida ochiladi — ular ochiq turganda ilova qatlami yashiriladi.
        new MutationObserver(() => {
            if (!isOn()) return;
            const open = document.body.classList.contains('jv-page-open') || document.body.classList.contains('ss-page-open');
            if (open && !S.pageMode) { S.pageMode = true; if (S.screen !== 'crm') { document.body.classList.add('sa-app-hidden'); if (root) root.hidden = true; } }
            else if (!open && S.pageMode) { S.pageMode = false; if (S.screen !== 'crm') { showApp(true); render(false); } }
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        // switchTab boshqa joydan chaqirilsa (masalan sinov oynasi yopilib lidlarga qaytsa) — ilovaga qaytamiz.
        const orig = window.switchTab;
        if (typeof orig === 'function' && !orig._sa) {
            const w = function (tab, ctx) {
                const r = orig.apply(this, arguments);
                if (isOn() && !openCrm._busy && !openJadval._busy) {
                    const leadsTab = tab === 'leads' || (tab === 'sales' && (ctx?.salesSection || 'leads') === 'leads');
                    if (S.screen === 'crm' && tab === 'dashboard') { S.screen = 'home'; showApp(true); render(true); }
                    else if (S.screen === 'crm' && leadsTab) { S.screen = 'leads'; showApp(true); render(true); }
                    else if (S.screen !== 'crm' && !leadsTab && tab !== 'dashboard' && booted) {
                        // Mavjud oqim boshqa sahifaga o'tkazdi (masalan jadval) — o'sha sahifani ko'rsatamiz.
                        S.stack.push({ screen: S.screen, lead: S.lead, tab: S.tab });
                        S.crmTab = tab === 'timetable' ? 'jadval' : 'menu'; S.screen = 'crm'; showApp(false); syncNav();
                    }
                }
                return r;
            };
            w._sa = true;
            window.switchTab = w;
        }
        // Ma'lumot kelguncha skeleton; keyin birinchi chizish.
        const wait = (n = 0) => {
            const ready = g('getItem') && (getItem(STORAGE_KEYS.leads, null) || n > 40);
            if (ready) { sync(); setTimeout(() => { booted = true; }, 1500); return; }
            if (isOn() && !root) { enable(); root.innerHTML = `<div class="sa-body">${'<div class="sa-sk" style="height:96px"></div>'.repeat(4)}</div>`; }
            setTimeout(() => wait(n + 1), 150);
        };
        wait();
    }

    // openCrm ichidagi switchTab chaqiruvini o'zimiz ushlab qolmasligimiz uchun belgi.
    const _openCrm = openCrm;
    openCrm = function (spec) { openCrm._busy = true; try { _openCrm(spec); } finally { openCrm._busy = false; } };

    window.sotuvApp = { open: go, openLead, openCallResult, openStageSheet, back, render: () => render(false), state: S };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 60));
    else setTimeout(init, 60);
})();
