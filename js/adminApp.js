// Jamoa — Admin / direktor (role=admin|boshliq) telefon kabineti (2026-11-11, "Admin — telefon ilovasi" kanvasi).
// Faqat ekran ≤900px bo'lganda yoqiladi; kompyuter ko'rinishi o'zgarmaydi.
// Pastki menyu (direktor qarori): Bosh · Dars jadvali · Sotuv · Moliya · Menyu. O'quvchilar — Menyu ichida.
// Yangi chizilmagan joylar mavjud dizaynlardan: Dars jadvali — js/jadvalV3.js, o'quvchi kartasi — schoolUI.openStudent,
// qolgan bo'limlar — mavjud sahifalar (switchTab) "Admin kabinetga qaytish" chizig'i bilan.
// Ma'lumot: mahalliy kesh (getItem) + computeAdminHome (kompyuter bosh sahifasi bilan bir xil hisob),
// /api/finance/overview, /api/finance/cashbook, /api/payroll/preview, /api/school/edit-requests.
// Uslublar: css/adminApp.css (adm- prefiksi).
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const g = n => (typeof window[n] === 'function' ? window[n] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isAdmin = () => ['admin', 'boshliq'].includes(user().role);
    const isOn = () => isAdmin() && MQ.matches;
    const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const fmt = n => String(Math.round(num(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const mln = n => String(Math.round(num(n) / 1e5) / 10).replace('.', ',') + ' mln';
    const pct1 = v => (Math.round(num(v) * 10) / 10).toString().replace('.', ',') + '%';
    const initials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return w.length ? (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toLocaleUpperCase('uz') : '?'; };
    const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    // Toshkent sanasi (qurilma vaqt zonasidan qat'i nazar).
    const tk = () => new Date(Date.now() + 5 * 3600000);
    const todayKey = () => tk().toISOString().slice(0, 10);
    const greet = () => { const h = tk().getUTCHours(); return h < 11 ? 'Xayrli tong' : h < 17 ? 'Xayrli kun' : 'Xayrli kech'; };
    const LANG = { english: 'Ingliz', russian: 'Rus' };
    const langOf = s => (s?.subject === 'russian' ? 'russian' : 'english');

    const P = {
        home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        trend: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
        card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
        bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
        check: '<path d="M20 6L9 17l-5-5"/>', alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
        exit: '<path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>', book: '<path d="M4 5a2 2 0 012-2h14v16H6a2 2 0 00-2 2zM8 7h8"/>',
        box: '<path d="M3 7h18v13H3zM3 7l2-4h14l2 4M10 12h4"/>', meg: '<path d="M3 11l15-6v14L3 13zM7 13v5"/>', chart: '<path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3"/>', phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
        in: '<path d="M12 5v14M5 12l7 7 7-7"/>', out: '<path d="M12 19V5M5 12l7-7 7 7"/>', snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>'
    };
    const ic = (n, s = 18, w = 2.1) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

    // ---------- holat ----------
    const S = { screen: 'home', stack: [], lang: 'all', sec: 'faol', q: '', ftab: 'kassa' };
    let root = null, nav = null, inited = false, toastEl = null, qTimer = null;
    const C = new Map(); // url -> { v, at, p, e }
    function need(url, force) {
        const c = C.get(url) || {};
        if (c.p || (!force && c.at && Date.now() - c.at < 60000)) return c.v;
        const fetcher = g('apiFetch');
        if (!fetcher) return c.v;
        c.p = fetcher(url).then(v => { c.v = v; c.e = null; }).catch(e => { c.e = e; }).finally(() => { c.p = null; c.at = Date.now(); C.set(url, c); if (isOn() && S.screen !== 'crm') render(false); });
        C.set(url, c);
        return c.v;
    }
    const peek = url => C.get(url)?.v;
    const errOf = url => C.get(url)?.e;

    // ---------- ma'lumot ----------
    const AR = () => window.AttendanceRules || {};
    const students = () => (g('getItem') ? getItem(STORAGE_KEYS.students, []) : []).filter(s => s && !String(s.id || '').startsWith('demo_'));
    const teachers = () => (g('getItem') ? getItem(STORAGE_KEYS.teachers, []) : []);
    const leadsAll = () => (g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : { english: [], russian: [] });
    const inLang = l => S.lang === 'all' || l === S.lang;
    function scopedLeads() { const L = leadsAll(); return { english: inLang('english') ? L.english || [] : [], russian: inLang('russian') ? L.russian || [] : [] }; }
    const isActive = s => (AR().isActiveStudent ? AR().isActiveStudent(s) : !s.frozen);
    const isDebtor = s => (AR().isDebtor ? AR().isDebtor(s) : isActive(s) && num(s.debtAmount) > 0);
    const stateNow = s => (AR().studentStateNow ? AR().studentStateNow(s) : isActive(s) ? 'active' : 'left');
    function home() {
        if (!g('computeAdminHome')) return null;
        let h;
        try { h = computeAdminHome({ students: students().filter(s => inLang(langOf(s))), leads: scopedLeads() }); } catch (e) { console.warn('[adminApp] computeAdminHome', e.message); return null; }
        // Menejerlar (sotuv, reja) — tanlangan til bo'yicha qayta yig'iladi (computeAdminHome hammasini beradi).
        if (S.lang !== 'all') {
            const rows = h.mgrRows.filter(m => (m.lang === 'russian' ? 'russian' : 'english') === S.lang);
            h = { ...h, mgrRows: rows, revenue: rows.reduce((n, m) => n + m.sales, 0), target: rows.reduce((n, m) => n + (m.target || 0), 0), dealsMonth: rows.reduce((n, m) => n + m.deals, 0) };
        }
        return h;
    }
    const monthStart = () => todayKey().slice(0, 8) + '01';
    const finUrl = () => `/api/finance/overview?start=${monthStart()}&end=${todayKey()}&scope=${S.lang}`;
    const cashUrl = () => `/api/finance/cashbook?start=${todayKey()}&end=${todayKey()}&scope=${S.lang}`;
    const APPROVALS = '/api/school/edit-requests?status=pending';
    const payUrl = lang => `/api/payroll/preview?start=${monthStart()}&end=${todayKey()}&language=${lang}`;
    const teacherName = id => teachers().find(t => String(t.id) === String(id))?.name || '';
    const shortName = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || ''); };

    // ---------- bo'laklar ----------
    const top = (title, sub, opts = {}) => `<header class="adm-top">${opts.back ? `<button type="button" class="adm-ib" data-m-back aria-label="Orqaga">${ic('back', 20, 2.3)}</button>` : ''}
        <div class="adm-top-t">${sub ? `<span>${esc(sub)}</span>` : ''}<h1>${esc(title)}</h1></div>${opts.right || ''}</header>`;
    const seg = (items, cur, attr) => `<div class="adm-seg" role="group">${items.map(([k, l]) => `<button type="button" aria-pressed="${k === cur}" ${attr}="${k}">${esc(l)}</button>`).join('')}</div>`;
    const langSeg = () => seg([['all', 'Hammasi'], ['english', 'Ingliz'], ['russian', 'Rus']], S.lang, 'data-m-lang');
    const kpi = (t, v, s, tone, attrs = '') => `<button type="button" class="adm-kpi"${attrs}><span>${esc(t)}</span><b class="${tone ? 'is-' + tone : ''}">${v}</b><small>${esc(s)}</small></button>`;
    const sk = n => Array.from({ length: n }, () => '<div class="adm-sk"></div>').join('');
    const empty = (t, s) => `<div class="adm-empty"><b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</div>`;
    const errBox = (url, t) => `<div class="adm-empty is-err"><b>${esc(t || 'Maʼlumotni olib boʻlmadi')}</b><span>${esc(errOf(url)?.message || '')}</span><button type="button" class="adm-btn" data-m-retry="${esc(url)}">Qayta urinish</button></div>`;
    const tag = (t, tone) => `<span class="adm-tag is-${tone}">${esc(t)}</span>`;
    const label = t => `<div class="adm-label">${esc(t)}</div>`;

    // ---------- ekranlar ----------
    function scrHome() {
        const h = home(), fin = need(finUrl()), ap = need(APPROVALS);
        const d = tk(), date = `${WD[d.getUTCDay()]}, ${d.getUTCDate()}-${MON[d.getUTCMonth()]}`;
        const first = String(user().name || '').trim().split(/\s+/)[0] || '';
        const bell = num(document.getElementById('notifBadge')?.textContent);
        const right = `<button type="button" class="adm-ib" data-m-notif aria-label="Bildirishnomalar${bell ? `, ${bell} ta yangi` : ''}">${ic('bell', 20)}${bell ? `<i>${bell > 99 ? '99+' : bell}</i>` : ''}</button>`;
        const rev = h ? num(h.revenue) : null; // sotuv (kompyuter bosh sahifasi bilan bir xil manba)
        const cash = fin?.pnl ? num(fin.pnl.revenue) : null;
        const target = h ? num(h.target) : 0;
        const p = rev != null && target > 0 ? Math.min(100, Math.round(rev / target * 100)) : null;
        const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), left = end - d.getUTCDate();
        const hero = `<button type="button" class="adm-hero" data-m-go="finance"><span>${esc(MON[d.getUTCMonth()][0].toUpperCase() + MON[d.getUTCMonth()].slice(1))} sotuvi</span>
            <b>${rev == null ? '…' : fmt(rev) + ' soʻm'}</b>
            ${p != null ? `<i class="adm-bar"><i style="width:${p}%"></i></i><small>Reja: ${mln(target)} · ${p}% · ${left} kun qoldi</small>` : `<small>${target ? 'Reja: ' + mln(target) : 'Reja kiritilmagan'} · ${left} kun qoldi</small>`}${cash != null ? `<small>Kassaga tushum: ${mln(cash)} soʻm</small>` : ''}</button>`;
        const st = students().filter(s => inLang(langOf(s)));
        const act = st.filter(isActive), en = act.filter(s => langOf(s) === 'english').length, ru = act.length - en;
        const debt = act.filter(isDebtor);
        const conv = h && h.leadsMonth ? h.cohortClosed / h.leadsMonth * 100 : 0;
        const mon = MON[d.getUTCMonth()];
        const kpis = `<div class="adm-grid2">
            ${kpi('Faol oʻquvchilar', fmt(act.length), S.lang === 'all' ? `Ingliz ${en} · Rus ${ru}` : LANG[S.lang], '', ' data-m-stu="faol"')}
            ${kpi('Qarzdorlar', fmt(debt.length), mln(debt.reduce((n, s) => n + num(s.debtAmount), 0)) + ' soʻm', 'red', ' data-m-stu="qarzdorlar"')}
            ${kpi(mon[0].toUpperCase() + mon.slice(1) + ' konversiyasi', h ? pct1(conv) : '—', h ? `${h.cohortClosed} / ${h.leadsMonth} shu oy lidlaridan` : '', 'green', ' data-m-go="sales"')}
            ${kpi('Bugun kelgan lidlar', h ? fmt(h.leadsToday) : '—', h ? `kecha ${h.leadsYesterday}` : '', '', ' data-m-crm="sales:leads"')}</div>`;
        const trials = (scopedLeads().english.concat(scopedLeads().russian)).filter(l => l && !l.deletedAt && (g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : l.status) === 'sinov-darsida');
        const rows = [
            ['Tasdiq kutmoqda', 'oʻquvchi maʼlumotini oʻzgartirish soʻrovlari', ap ? num(ap.counts?.pending) : null, 'amber', 'check', 'data-m-crm="school-approvals"'],
            ['Sinov darslari', 'sinov bosqichidagi lidlar', trials.length, 'purple', 'cal', 'data-m-go="jadval"'],
            ['Qarz muddati oʻtdi', h ? `${mln(h.overdueSum)} soʻm` : '', h ? h.overdueCount : null, 'red', 'alert', 'data-m-stu="qarzdorlar"'],
            ['Javobsiz lidlar', '24 soatdan oshgan yangi lidlar', h ? h.unanswered : null, 'blue', 'clock', 'data-m-crm="sales:leads"'],
            ['Menejersiz lidlar', 'taqsimlanmagan', h ? h.unassigned : null, 'blue', 'users', 'data-m-crm="sales:leads"']
        ];
        const alerts = `<div class="adm-list">${rows.map(([t, s, n, tone, icn, attr]) => `<button type="button" class="adm-row" ${attr}>
            <span class="adm-ico is-${tone}">${ic(icn, 18)}</span><span class="adm-row-t"><b>${esc(t)}</b><small>${esc(s)}</small></span>
            <b class="adm-n is-${n ? tone : 'mut'}">${n == null ? '…' : n}</b></button>`).join('')}</div>`;
        return top(`${greet()}, ${first}`, date, { right }) + `<div class="adm-body">${langSeg()}${hero}${kpis}${label('DIQQAT TALAB QILADI')}${alerts}</div>`;
    }

    const SECS = [['faol', 'Faol'], ['qarzdorlar', 'Qarzdorlar'], ['muzlatilgan', 'Muzlatilgan'], ['tark-etgan', 'Tark etgan'], ['tamomlaganlar', 'Tamomlagan'], ['tasdiqlar', 'Tasdiqlar']];
    function scrStudents() {
        const all = students().filter(s => inLang(langOf(s)));
        const by = {
            faol: all.filter(isActive), qarzdorlar: all.filter(isDebtor),
            muzlatilgan: all.filter(s => stateNow(s) === 'frozen')
        };
        const ap = need(APPROVALS);
        const cnt = k => (by[k] ? ` · ${by[k].length}` : k === 'tasdiqlar' && ap ? ` · ${num(ap.counts?.pending)}` : '');
        const chips = `<div class="adm-chips">${SECS.map(([k, l]) => `<button type="button" class="adm-chip${S.sec === k ? ' is-on' : ''}" data-m-sec="${k}">${esc(l + cnt(k))}</button>`).join('')}</div>`;
        const q = S.q.trim().toLowerCase();
        let list = (by[S.sec] || []).filter(s => !q || [s.name, s.phone, s.id].some(v => String(v || '').toLowerCase().includes(q)));
        if (S.sec === 'qarzdorlar') list.sort((a, b) => num(b.debtAmount) - num(a.debtAmount));
        else list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uz'));
        const today = todayKey();
        const row = (s, i) => {
            const debt = num(s.debtAmount), due = String(s.paymentDueDate || '').slice(0, 10);
            const t = stateNow(s) === 'frozen' ? tag('Muzlatilgan', 'blue') : debt > 0 ? (due && due < today ? tag('Muddati oʻtgan', 'red') : due ? tag('Muddat ' + due.slice(8) + '.' + due.slice(5, 7), 'amber') : tag('Qarz', 'red')) : tag('Toʻlagan', 'green');
            const meta = [LANG[langOf(s)], shortName(teacherName(s.teacherId)), s.lessonTime].filter(Boolean).join(' · ');
            return `<button type="button" class="adm-row adm-stu" data-m-student="${esc(s.id)}">
                <span class="adm-av av${i % 4}" aria-hidden="true">${esc(initials(s.name))}</span>
                <span class="adm-row-t"><b class="is-link">${esc(s.name || '—')}</b><small>${esc(meta || '—')}</small></span>
                <span class="adm-row-r">${t}<b class="${debt > 0 ? 'is-red' : ''}">${debt > 0 ? fmt(debt) : '0'}</b></span></button>`;
        };
        const body = by[S.sec]
            ? (list.length ? `<div class="adm-list">${list.slice(0, 300).map(row).join('')}</div>${list.length > 300 ? `<p class="adm-note">Birinchi 300 ta koʻrsatildi — qidiruvdan foydalaning.</p>` : ''}` : empty(q ? 'Topilmadi' : 'Bu boʻlimda oʻquvchi yoʻq'))
            : `<div class="adm-list"><button type="button" class="adm-row" data-m-crm="${S.sec === 'tasdiqlar' ? 'school-approvals' : 'students:' + S.sec}"><span class="adm-ico is-blue">${ic(S.sec === 'tasdiqlar' ? 'check' : 'box', 18)}</span><span class="adm-row-t"><b>${esc(SECS.find(x => x[0] === S.sec)[1])} roʻyxatini ochish</b><small>kartalar, sabab, qayta tiklash</small></span>${ic('chev', 18)}</button></div>`;
        const right = `<button type="button" class="adm-btn adm-btn--pri" data-m-add>${ic('plus', 18, 2.4)}Qoʻshish</button>`;
        return top('Oʻquvchilar', `${all.length} ta · ${S.lang === 'all' ? 'ikkala til' : LANG[S.lang]}`, { right, back: S.stack.length > 0 })
            + `<div class="adm-body"><label class="adm-search">${ic('search', 18)}<input id="admQ" type="search" aria-label="Oʻquvchi qidirish" placeholder="Ism, telefon yoki ID" value="${esc(S.q)}" data-m-q autocomplete="off"></label>${langSeg()}${chips}${body}</div>`;
    }

    function scrSales() {
        const h = home();
        if (!h) return top('Sotuv') + `<div class="adm-body">${sk(4)}</div>`;
        const conv = h.leadsMonth ? h.cohortClosed / h.leadsMonth * 100 : 0;
        const kpis = `<div class="adm-grid2">
            ${kpi('Shu oy lidlar', fmt(h.leadsMonth), `bugun ${h.leadsToday} · kecha ${h.leadsYesterday}`)}
            ${kpi('Sotuvlar', fmt(h.dealsMonth), mln(h.revenue) + ' soʻm')}
            ${kpi('Lid konversiyasi', pct1(conv), 'shu oy lidlaridan', 'green')}
            ${kpi('Reja', h.target ? Math.round(h.revenue / h.target * 100) + '%' : '—', h.target ? mln(h.target) + ' soʻm' : 'kiritilmagan')}</div>`;
        const max = Math.max(1, ...h.funnel.map(f => f.count));
        const funnel = `<div class="adm-card adm-funnel">${h.funnel.map(f => `<button type="button" data-m-crm="sales:leads"><span><b>${esc(f.label || f.title || f.id)}</b><b>${fmt(f.count)}</b></span><i class="adm-bar is-light"><i style="width:${Math.max(3, Math.round(f.count / max * 100))}%"></i></i></button>`).join('')}</div>`;
        const mgr = h.mgrRows.length ? `<div class="adm-list">${h.mgrRows.slice(0, 12).map((m, i) => `<button type="button" class="adm-row" data-m-crm="sales:rating"><b class="adm-rank">${i + 1}</b>
            <span class="adm-row-t"><b>${esc(m.name)}</b><small>${m.deals} sotuv${m.pct != null ? ` · reja ${m.pct}%` : ''} · ${LANG[m.lang] || ''}</small></span><b>${mln(m.sales)}</b></button>`).join('')}</div>` : empty('Menejer yoʻq');
        const links = `<div class="adm-grid2">${kpi('Lidlar', ic('chev', 16), 'kanban', '', ' data-m-crm="sales:leads"')}${kpi('Reyting', ic('chev', 16), 'menejerlar', '', ' data-m-crm="sales:rating"')}</div>`;
        return top('Sotuv', `${MON[tk().getUTCMonth()][0].toUpperCase() + MON[tk().getUTCMonth()].slice(1)} · ${S.lang === 'all' ? 'ikkala til' : LANG[S.lang]}`)
            + `<div class="adm-body">${langSeg()}${kpis}${label('VORONKA')}${funnel}${label('MENEJERLAR · SHU OY')}${mgr}${links}</div>`;
    }

    function scrFinance() {
        const fin = need(finUrl()), cb = need(cashUrl());
        const sum = fin?.pnl ? `<div class="adm-card adm-tri"><span><small>Kirim</small><b class="is-green">${mln(fin.pnl.revenue)}</b></span><span><small>Chiqim</small><b class="is-red">${mln(num(fin.pnl.revenue) - num(fin.pnl.net_profit))}</b></span><span><small>Foyda</small><b>${mln(fin.pnl.net_profit)}</b></span></div>`
            : errOf(finUrl()) ? errBox(finUrl()) : sk(1);
        const tabs = `<div class="adm-chips">${[['kassa', 'Kassa'], ['maosh', 'Maoshlar']].map(([k, l]) => `<button type="button" class="adm-chip${S.ftab === k ? ' is-on' : ''}" data-m-ftab="${k}">${l}</button>`).join('')}
            <button type="button" class="adm-chip" data-m-crm="finance:tolovlar">Toʻlovlar</button><button type="button" class="adm-chip" data-m-stu="qarzdorlar">Qarzdorlar</button><button type="button" class="adm-chip" data-m-crm="finance:maoshlar">Jarimalar</button></div>`;
        let body;
        if (S.ftab === 'kassa') {
            const entries = (cb?.days || []).flatMap(d => d.entries || []);
            body = label(`BUGUNGI KASSA${cb ? ` · +${mln(cb.inflow)} / −${mln(cb.outflow)}` : ''}`) + (cb ? (entries.length ? `<div class="adm-list">${entries.slice(0, 60).map(e => {
                const inn = num(e.sign) > 0;
                return `<div class="adm-row"><span class="adm-ico is-${inn ? 'green' : 'red'}">${ic(inn ? 'in' : 'out', 18)}</span><span class="adm-row-t"><b>${esc(e.name || e.note || e.categoryLabel || e.category || '—')}</b><small>${esc([e.transferLeg ? 'Oʻtkazma' : e.type === 'receipt' ? (inn ? 'Toʻlov' : 'Bekor qilingan toʻlov') : inn ? 'Kirim' : 'Chiqim', e.managerName, (fin?.accounts || []).find(a => a.id === e.account)?.name].filter(Boolean).join(' · '))}</small></span><b class="is-${inn ? 'green' : 'red'}">${inn ? '+' : '−'}${fmt(Math.abs(num(e.amount)))}</b></div>`;
            }).join('')}</div>` : empty('Bugun kassa harakati yoʻq')) : errOf(cashUrl()) ? errBox(cashUrl()) : sk(3));
        } else {
            const langs = S.lang === 'all' ? ['english', 'russian'] : [S.lang];
            const res = langs.map(l => need(payUrl(l)));
            const rows = res.filter(Boolean).flatMap((r, i) => (r.rows || []).map(x => ({ ...x, _lang: langs[i] })));
            const loading = res.some(r => !r) && !langs.some(l => errOf(payUrl(l)));
            body = label('MAOSHLAR · OY BOSHIDAN BUGUNGACHA (qoʻlga)') + (loading ? sk(3) : rows.length ? `<div class="adm-list">${rows.slice(0, 80).map(r => {
                const amt = r.langTakeHome ?? r.takeHome ?? r.total;
                const paid = r.status === 'paid' || r.paid;
                return `<div class="adm-row"><span class="adm-row-t"><b>${esc(r.name || r.employeeName || '—')}</b><small>${esc([r.roleLabel || r.role, LANG[r._lang]].filter(Boolean).join(' · '))}${num(r.fineDeducted) ? ` · jarima −${fmt(r.fineDeducted)}` : ''}</small></span><span class="adm-row-r"><b>${fmt(amt)}</b>${tag(paid ? 'Berildi' : 'Qoʻlga', paid ? 'green' : 'blue')}</span></div>`;
            }).join('')}</div>` : langs.some(l => errOf(payUrl(l))) ? errBox(payUrl(langs.find(l => errOf(payUrl(l))) || langs[0]), 'Maoshlarni olib boʻlmadi') : empty('Maosh hisoblari yoʻq'));
        }
        const right = `<button type="button" class="adm-btn adm-btn--pri" data-m-crm="finance:tolovlar">Toʻlov qabul</button>`;
        return top('Moliya', `${MON[tk().getUTCMonth()][0].toUpperCase() + MON[tk().getUTCMonth()].slice(1)} ${tk().getUTCFullYear()}`, { right })
            + `<div class="adm-body">${langSeg()}${sum}${tabs}${body}</div>`;
    }

    function scrMenu() {
        const u = user(), ap = peek(APPROVALS);
        const act = students().filter(isActive).length;
        const t = (k, l, s, tone, icn, attr, hot) => `<button type="button" class="adm-tile" ${attr}><span class="adm-ico is-${tone}">${ic(icn, 17)}</span><b>${esc(l)}</b><small class="${hot ? 'is-red' : ''}">${esc(s)}</small></button>`;
        const grp = (title, items) => label(title) + `<div class="adm-grid3">${items.join('')}</div>`;
        return `<div class="adm-body adm-body--menu"><h1 class="adm-h1">Menyu</h1>
            <button type="button" class="adm-me" data-m-crm="profile"><span class="adm-av av0" aria-hidden="true">${esc(initials(u.name))}</span><span class="adm-row-t"><b>${esc(u.name || '')}</b><small>${u.role === 'boshliq' ? 'Boshliq' : 'Direktor · Admin'}</small></span>${ic('chev', 20)}</button>
            ${grp('OʻQUV', [t('stu', 'Oʻquvchilar', `${act} faol`, 'blue', 'users', 'data-m-go="students"'), t('jad', 'Dars jadvali', 'sinov, darslar', 'blue', 'cal', 'data-m-go="jadval"'), t('akd', 'Akademik boʻlim', 'ustoz, davomat', 'purple', 'book', 'data-m-crm="teachers-section"'),
                t('ap', 'Tasdiqlar', ap ? `${num(ap.counts?.pending)} ta` : '—', 'amber', 'check', 'data-m-crm="school-approvals"', ap && num(ap.counts?.pending)), t('left', 'Tark etganlar', 'sabab bilan', 'gray', 'box', 'data-m-crm="students:tark-etgan"'), t('fin', 'Tamomlaganlar', 'kursni tugatgan', 'green', 'check', 'data-m-crm="students:tamomlaganlar"')])}
            ${grp('SOTUV VA MARKETING', [t('l', 'Lidlar', 'kanban', 'blue', 'users', 'data-m-crm="sales:leads"'), t('mk', 'Marketing', 'target, SMS', 'amber', 'meg', 'data-m-crm="marketing"'), t('an', 'Analitika', 'oylik hisobot', 'green', 'chart', 'data-m-crm="analitika"')])}
            ${grp('JAMOA', [t('hr', 'HR · Xodimlar', 'kabinetga kirish', 'blue', 'key', 'data-m-crm="hr:xodimlar"'), t('fn', 'Moliya', 'kassa, maosh', 'green', 'card', 'data-m-go="finance"'), t('jr', 'Jarimalar', 'qoida, yuvish', 'red', 'alert', 'data-m-crm="finance:maoshlar"')])}
            ${grp('TIZIM', [t('mob', 'Mobil ilova', 'darslar, doʻkon', 'blue', 'phone', 'data-m-crm="student-app"'), t('set', 'Sozlamalar', 'parol, sessiya', 'gray', 'gear', 'data-m-crm="profile"'), t('out', 'Chiqish', 'akkauntdan', 'red', 'exit', 'data-m-logout')])}
            <button type="button" class="adm-link" data-m-desk>Kompyuter koʻrinishi (eski menyu)</button></div>`;
    }

    // ---------- chizish, navigatsiya ----------
    const SCR = { home: scrHome, students: scrStudents, sales: scrSales, finance: scrFinance, menu: scrMenu };
    const TAB_OF = { home: 'home', students: 'menu', sales: 'sales', finance: 'finance', menu: 'menu', jadval: 'jadval' };
    function render(anim) {
        if (!root || !isOn()) return;
        if (S.screen === 'crm' || S.screen === 'jadval') { syncNav(); return; }
        const act = document.activeElement, focusId = act && root.contains(act) ? act.id : '', caret = focusId && typeof act.selectionStart === 'number' ? act.selectionStart : null;
        const prev = root.querySelector('.adm-body')?.scrollTop || 0;
        let html;
        try { html = (SCR[S.screen] || scrHome)(); } catch (e) { console.error('[adminApp]', e); html = top('Xatolik') + `<div class="adm-body">${empty('Ekranni chizib boʻlmadi', e.message)}</div>`; }
        root.innerHTML = html;
        root.classList.toggle('adm-enter', !!anim);
        const body = root.querySelector('.adm-body'); if (body) body.scrollTop = anim ? 0 : prev;
        if (focusId) { const el = root.querySelector('#' + focusId); if (el) { el.focus({ preventScroll: true }); if (caret != null) { try { el.setSelectionRange(caret, caret); } catch (er) { /* */ } } } }
        syncNav();
    }
    function buildNav() {
        nav = document.createElement('nav');
        nav.className = 'adm-nav'; nav.setAttribute('aria-label', 'Pastki menyu');
        nav.addEventListener('click', e => { const b = e.target.closest('[data-m-nav]'); if (b) tabTo(b.dataset.mNav); });
        document.body.appendChild(nav);
    }
    function syncNav() {
        if (!nav) return;
        const active = S.screen === 'crm' ? S.crmTab || null : TAB_OF[S.screen] || 'home';
        const items = [['home', 'home', 'Bosh'], ['jadval', 'cal', 'Dars jadvali'], ['sales', 'trend', 'Sotuv'], ['finance', 'card', 'Moliya'], ['menu', 'menu', 'Menyu']];
        nav.innerHTML = items.map(([id, icn, l]) => `<button type="button" data-m-nav="${id}"${active === id ? ' aria-current="page"' : ''}>${ic(icn, 21, active === id ? 2.3 : 1.9)}<span>${l}</span></button>`).join('');
        nav.hidden = !isOn();
    }
    function leaveCrm() {
        if (S.screen !== 'crm' && S.screen !== 'jadval') return;
        document.querySelector('.adm-backbar')?.remove();
        document.body.classList.remove('adm-crm');
        try { window.jadvalV3?.close?.({ silent: true }); } catch (e) { /* */ }
        if (root) root.hidden = false;
    }
    function tabTo(screen) {
        leaveCrm();
        S.stack = [];
        S.tabbed = true;
        if (screen === 'jadval') { openCrm('timetable', { asTab: 'jadval' }); return; }
        S.screen = screen;
        try { history.replaceState({ adm: 1 }, ''); } catch (e) { /* */ }
        render(true);
    }
    function go(screen, extra = {}) {
        if (screen === 'jadval') { tabTo('jadval'); return; }
        leaveCrm();
        S.stack.push({ screen: S.screen });
        Object.assign(S, extra, { screen });
        try { history.pushState({ adm: 1 }, ''); } catch (e) { /* */ }
        render(true);
    }
    function back() {
        if (S.screen === 'crm' || S.screen === 'jadval') { closeCrm(); return true; }
        const p = S.stack.pop();
        if (!p) { if (S.screen !== 'home') { S.screen = 'home'; render(true); return true; } return false; }
        Object.assign(S, p); render(true); return true;
    }
    // Mavjud (kompyuter) sahifalar: "Admin kabinetga qaytish" chizig'i bilan; pastki menyu ko'rinib turadi.
    function openCrm(spec, opts = {}) {
        const [tab, section] = String(spec || '').split(':');
        if (S.screen !== 'crm' && S.screen !== 'jadval') S.stack.push({ screen: S.screen });
        S.screen = opts.asTab === 'jadval' ? 'jadval' : 'crm';
        S.crmTab = opts.asTab || null;
        document.body.classList.add('adm-crm');
        if (root) root.hidden = true;
        syncNav();
        try { if (opts.asTab) history.replaceState({ adm: 1 }, ''); else history.pushState({ adm: 1 }, ''); } catch (e) { /* */ }
        if (g('switchTab')) {
            try {
                if (tab === 'hr') switchTab('hr', { hrSection: section || 'xodimlar' });
                else if (tab === 'sales') switchTab('sales', { salesSection: section || 'leads' });
                else if (tab === 'students') { switchTab('students'); if (section && g('switchStudentsSection')) switchStudentsSection(section); }
                else if (tab === 'finance') switchTab('finance', { financeSection: section || 'umumiy' });
                else if (tab === 'teachers-section') switchTab(tab, { teachersSection: section || 'attendance' });
                else switchTab(tab || 'dashboard');
            } catch (e) { console.error('[adminApp] openCrm', e); }
        }
        window.scrollTo?.(0, 0);
        document.querySelector('.adm-backbar')?.remove();
        if (S.screen === 'crm') {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'adm-backbar'; b.innerHTML = `${ic('back', 18, 2.4)}Admin kabinetga qaytish`;
            b.onclick = () => history.back();
            document.body.appendChild(b);
        }
    }
    function closeCrm() {
        const wasJadval = S.screen === 'jadval';
        leaveCrm();
        const p = S.stack.pop();
        S.screen = (p && p.screen) || (wasJadval ? 'home' : 'menu');
        S.crmTab = null;
        render(true);
    }
    function toast(msg, bad) {
        toastEl?.remove();
        toastEl = document.createElement('div');
        toastEl.className = 'adm-toast' + (bad ? ' is-bad' : ''); toastEl.setAttribute('role', bad ? 'alert' : 'status'); toastEl.textContent = msg;
        document.body.appendChild(toastEl);
        setTimeout(() => { toastEl?.remove(); toastEl = null; }, 3200);
    }

    // ---------- hodisalar ----------
    function onClick(e) {
        const t = e.target.closest('[data-m-back],[data-m-go],[data-m-crm],[data-m-stu],[data-m-sec],[data-m-lang],[data-m-student],[data-m-ftab],[data-m-retry],[data-m-add],[data-m-notif],[data-m-logout],[data-m-desk]');
        if (!t) return;
        const d = t.dataset;
        if ('mBack' in d) { history.back(); return; }
        if ('mGo' in d) { go(d.mGo); return; }
        if ('mCrm' in d) { openCrm(d.mCrm); return; }
        if ('mStu' in d) { go('students', { sec: d.mStu, q: '' }); return; }
        if ('mSec' in d) { S.sec = d.mSec; render(false); return; }
        if ('mLang' in d) { S.lang = d.mLang; render(false); return; }
        if ('mFtab' in d) { S.ftab = d.mFtab; render(false); return; }
        if ('mStudent' in d) { openCrm('students'); const ui = window.schoolUI; if (ui?.openStudent) setTimeout(() => ui.openStudent(d.mStudent), 60); return; }
        if ('mRetry' in d) { const c = C.get(d.mRetry); if (c) { c.at = 0; c.e = null; } need(d.mRetry, true); render(false); return; }
        if ('mAdd' in d) { openCrm('students'); setTimeout(() => document.getElementById('addStudentBtn')?.click(), 250); return; }
        if ('mNotif' in d) { openCrm('dashboard'); setTimeout(() => document.getElementById('notifToggle')?.click(), 200); return; }
        if ('mLogout' in d) { if (g('askLogout')) askLogout(); else if (g('doLogout')) doLogout(); return; }
        if ('mDesk' in d) { openCrm('dashboard'); return; }
    }
    function onInput(e) {
        const el = e.target;
        if (!el.matches('[data-m-q]')) return;
        clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = el.value; render(false); }, 180);
    }

    function enable() {
        document.body.classList.add('adm-on');
        if (!root) {
            root = document.createElement('main');
            root.id = 'adminApp'; root.className = 'adm-app';
            document.body.appendChild(root);
            root.addEventListener('click', onClick);
            root.addEventListener('input', onInput);
        }
        root.hidden = S.screen === 'crm' || S.screen === 'jadval';
        if (!nav) buildNav();
        render(true);
    }
    function disable() {
        document.body.classList.remove('adm-on', 'adm-crm');
        document.querySelector('.adm-backbar')?.remove();
        if (root) root.hidden = true;
        if (nav) nav.hidden = true;
    }
    function sync() { document.body.classList.toggle('adm-desk', isAdmin() && !MQ.matches); if (isOn()) enable(); else disable(); }
    function init() {
        if (inited || !isAdmin()) return;
        inited = true;
        window.addEventListener('popstate', () => { if (isOn() && !back() && S.screen === 'home') toast('Chiqish uchun yana bir marta “Orqaga” bosing'); });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isOn()) { for (const c of C.values()) c.at = 0; render(false); } });
        MQ.addEventListener?.('change', sync);
        // Kesh (holat) kech yuklansa ham ekran yangilansin.
        let tries = 0; const wait = setInterval(() => { tries++; if (isOn() && S.screen !== 'crm' && S.screen !== 'jadval' && document.activeElement?.id !== 'admQ') render(false); if (tries > 10) clearInterval(wait); }, 1500);
        sync();
    }
    window.adminApp = { init, go, back, openCrm, render: () => render(false), state: S, _test: { home, scrHome, scrStudents, scrSales, scrFinance, scrMenu, isOn } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 120));
    else setTimeout(init, 120);
})();
