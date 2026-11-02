// ROP kompyuter kabineti (B yondashuv, dizayn "ROP · Kompyuter (B)": RK00 Navigatsiya, RK01 Bosh sahifa).
// FAQAT role = rop va ekran > 900px: body.rop-desk-v2. Sotuv menejeri, admin va boshqa rollar o'zgarmaydi
// (ropSotuvNav.js va Lidlar kodi umumiy — har bir o'zgarish ropDesk.isRop() bilan to'silgan).
// Sahifalar, kanban ustunlari, Dars jadvali v3 va Sinov darslari o'zgarmaydi: sidebar faqat mavjud sahifalarni
// guruhlab ochadi. Yangi ROP sahifalari (SLA, Qotgan qoida, Arxiv, Voronka …) js/ropDesk/pages-*.js da —
// ular window.ropDesk.registerPage(key, { open() }) bilan ulanadi; ro'yxatdan o'tmagan bo'lsa mavjud joy ochiladi.
// Uslublar: css/ropDesk.css (body.rop-desk-v2 ostida).
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const g = n => (typeof window[n] === 'function' ? window[n] : null);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isRop = () => user().role === 'rop' && !MQ.matches;
    const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* saqlab bo'lmasa ham ishlaydi */ } } };
    const DAY = 86400000, HOUR = 3600000;

    const RD = window.ropDesk = window.ropDesk || {};
    RD.pages = RD.pages || {};
    RD.isRop = isRop;
    let activePage = null;
    // B qismi sahifalari: ropDesk.registerPage('sla', { open: () => …, close?: () => … }) — sidebar shu sahifani ochadi.
    // Sahifa ochilganda ropDesk.setActive('sla'), yopilganda ropDesk.setActive(null) chaqiradi (faol band).
    RD.registerPage = (key, def) => { RD.pages[key] = def || {}; mark(); };
    RD.setActive = key => { activePage = key || null; mark(); };

    const SVG = (d, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const IC = {
        home: 'M3 10.5 12 4l9 6.5V20H3z', leads: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 110 8 4 4 0 010-8z',
        cal: 'M3 9.5h18M8 3v3M16 3v3M5 4.5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2z', trial: 'M8.5 12l2.5 2.5 4.5-5M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z',
        check: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', clock: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2', lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z', arch: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
        funnel: 'M3 4h18l-7 8v6l-4 2v-8z', rating: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z', plan: 'M12 3a9 9 0 110 18 9 9 0 010-18zM12 8a4 4 0 110 8 4 4 0 010-8z', debt: 'M2 6h20v13H2zM2 10h20',
        script: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h5', sms: 'M4 4h16v12H5l-1 4zM8 9h8M8 12h5', stu: 'M2 8l10-5 10 5-10 5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5', tg: 'M21 4L3 11l6 2 2 6 3-4 5 4z',
        more: 'M5 12h.01M12 12h.01M19 12h.01', chevL: 'M15 6l-6 6 6 6', chevR: 'M9 6l6 6-6 6', chevD: 'M6 9l6 6 6-6'
    };

    // ---------- yo'nalish (navigatsiya) ----------
    const closeOverlays = () => { window.sotuvSinov?.close?.({ silent: true }); window.jadvalV3?.close?.({ silent: true }); };
    const page = key => { const p = RD.pages[key]; if (p && typeof p.open === 'function') { closeOverlays(); p.open(); activePage = key; mark(); return true; } return false; };
    const tab = (t, ctx) => {
        closeOverlays(); activePage = null;
        if (t === 'sales' && ctx?.salesSection && document.getElementById('tab-sales')?.classList.contains('active') && g('switchSalesSection')) switchSalesSection(ctx.salesSection);
        else switchTab(t, ctx || {});
        mark();
    };
    // B qismi (js/ropDesk/pages-common.js): window.ropDeskPages.open(key) — check, sla, lock, arch, funnel, rating,
    // plan, debt, script, sms, stu, tg. Bo'lmasa (B fayllari yuklanmagan) — quyidagi mavjud joylar ochiladi.
    const B_KEYS = new Set(['check', 'sla', 'lock', 'arch', 'funnel', 'rating', 'plan', 'debt', 'script', 'sms', 'stu', 'tg']);
    const viaB = k => { if (!B_KEYS.has(k) || typeof window.ropDeskPages?.open !== 'function') return false; activePage = null; let ok = false; try { ok = window.ropDeskPages.open(k) !== false; } catch (e) { console.warn('[ropDesk] ropDeskPages.open', e.message); } if (ok) mark(); return ok; };
    const go = k => viaB(k) || GO[k]?.();
    const GO = {
        home: () => tab('dashboard'),
        leads: () => { RD.leads?.clearBadgeFilter?.({ silent: true }); tab('sales', { salesSection: 'leads' }); },
        cal: () => tab('timetable'),
        trial: () => tab('trial-lessons'),
        check: () => page('approvals') || tab('school-approvals'),
        sla: () => page('sla') || (tab('dashboard'), setTimeout(() => document.querySelector('#ropHome .rpx-escs, #ropHome .ahx-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150)),
        lock: () => page('stale') || window.staleLeads?.openRuleModal?.(),
        arch: () => page('archive') || (tab('profile'), g('switchProfileSection') && switchProfileSection('archive'), mark()),
        funnel: () => page('funnel') || tab('sales', { salesSection: 'sales-stats' }),
        rating: () => page('rating') || tab('sales', { salesSection: 'rating' }),
        plan: () => page('plan') || tab('sales', { salesSection: 'sales-plan' }),
        debt: () => page('debtors') || tab('sales', { salesSection: 'debtors' }),
        script: () => page('scripts') || tab('sales', { salesSection: 'scripts' }),
        sms: () => page('sms') || (typeof _tabContext !== 'undefined' && (_tabContext.marketingSection = 'sms'), tab('marketing'), g('switchMarketingSection') && switchMarketingSection('sms'), mark()),
        stu: () => tab('students'),
        tg: () => page('groups') || tab('school-groups'),
        'm-check': () => tab('teachers-section'),
        'm-app': () => tab('student-app'),
        'm-target': () => { if (typeof _tabContext !== 'undefined') _tabContext.marketingSection = 'target'; tab('marketing'); g('switchMarketingSection') && switchMarketingSection('target'); mark(); }
    };
    const NAV = [
        ['home', 'Bosh sahifa', 'home'], ['leads', 'Lidlar', 'leads'], ['cal', 'Dars jadvali', 'cal'], ['trial', 'Sinov nazorati', 'trial'],
        ['NAZORAT'], ['check', 'Tasdiqlar', 'check'], ['sla', 'SLA', 'clock', 'SLA — javob muddati nazorati'], ['lock', 'Qotgan lidlar qoidasi', 'lock', 'Qotgan lidlar qoidasi (sozlama)'], ['arch', 'Arxiv', 'arch', 'Arxiv (tarix)'],
        ['SOTUV'], ['funnel', 'Voronka', 'funnel', 'Voronka: statistika va menejerlar samaradorligi'], ['rating', 'Reyting va bonus', 'rating'], ['plan', 'Sotuv rejasi', 'plan', 'Sotuv rejasi (koʻrish)'], ['debt', 'Qarzdorlar', 'debt'], ['script', 'Skript va yoʻriqnoma', 'script'], ['sms', 'SMS yuborish', 'sms'],
        ['OʻQUVCHILAR'], ['stu', 'Oʻquvchilar', 'stu'], ['tg', 'Telegram guruh', 'tg']
    ];
    const MORE = [['m-check', 'Oʻquvchini tekshirish'], ['m-app', 'Mobil ilova'], ['m-target', 'Target lidlar (Marketing)']];

    function activeKey() {
        if (activePage) return activePage === 'approvals' ? 'check' : activePage === 'stale' ? 'lock' : activePage === 'archive' ? 'arch' : activePage === 'debtors' ? 'debt' : activePage === 'scripts' ? 'script' : activePage === 'groups' ? 'tg' : activePage;
        // Sinov qo'yish / Dars jadvali v3 ustidagi sahifa — "Dars jadvali".
        if (document.body.classList.contains('ss-page-open') || document.body.classList.contains('jv3-open')) return 'cal';
        try { const bk = window.ropDeskPages?.activeKey?.(); if (bk) return bk; } catch (e) { /* B qismi yo'q */ }
        const t = document.querySelector('.tab-content.active')?.id?.replace(/^tab-/, '') || '';
        const c = typeof _tabContext !== 'undefined' ? _tabContext : {};
        const S = { leads: 'leads', 'book-roadmap': 'leads', 'sales-stats': 'funnel', rating: 'rating', 'sales-plan': 'plan', debtors: 'debt', scripts: 'script' };
        if (t === 'sales') return S[c.salesSection] || 'leads';
        if (t === 'marketing') return c.marketingSection === 'sms' ? 'sms' : 'm-target';
        if (t === 'profile') return typeof _profileSection !== 'undefined' && _profileSection === 'archive' ? 'arch' : '';
        return { dashboard: 'home', timetable: 'cal', 'trial-lessons': 'trial', 'school-approvals': 'check', 'school-groups': 'tg', students: 'stu', guides: 'script', 'teachers-section': 'm-check', 'student-app': 'm-app' }[t] || '';
    }

    // ---------- badge'lar (faqat harakat talab qiladiganlar) ----------
    const leadsLang = () => {
        const u = user(), l = u.linkedRopLang || 'english';
        if (l !== 'both') return l === 'russian' ? 'russian' : 'english';
        return typeof _leadsLangFilter !== 'undefined' && _leadsLangFilter === 'russian' ? 'russian' : 'english';
    };
    const CLOSED = new Set(['tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']);
    // Menejersiz ochiq lidlar — joriy til (Bosh sahifadagi "Taqsimlash" va Lidlar badge'i bitta hisob).
    function unassignedCount() {
        if (!g('getItem')) return 0;
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) || {};
        return (all[leadsLang()] || []).filter(l => !l.deletedAt && !l.managerId && !CLOSED.has(g('normalizeLeadStatus') ? normalizeLeadStatus(l.status) : l.status)).length;
    }
    RD.unassignedCount = unassignedCount;
    RD.leadsLang = leadsLang;
    // SLA: adminga ketgan (24 soat+) va 6 soat ichida ketadiganlar — ikkalasida ham "Ko'rildi"/biriktirish kerak.
    function slaUrgent() {
        if (!g('computeRopHome')) return { urgent: 0, total: 0 };
        try {
            const d = computeRopHome({ user: user(), students: getItem(STORAGE_KEYS.students, []) || [], leads: getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) || {}, now: new Date() });
            const now = Date.now();
            return { urgent: d.open.filter(a => now - a.time >= DAY - 6 * HOUR).length, total: d.open.length, late: d.lateCount };
        } catch (e) { return { urgent: 0, total: 0 }; }
    }
    RD.slaUrgent = slaUrgent;
    const fmtN = n => (n > 99 ? '99+' : String(n));

    // ---------- sidebar ----------
    const grpState = () => { try { return JSON.parse(ls.get('rk_nav_grp') || '{}') || {}; } catch (e) { return {}; } };
    function buildNav(menu) {
        menu.querySelectorAll('.rk-nav').forEach(x => x.remove());
        const shut = grpState();
        const wrap = document.createElement('div');
        wrap.className = 'rk-nav';
        let html = '', grp = '';
        for (const it of NAV) {
            if (it.length === 1) {
                grp = it[0];
                html += `<button type="button" class="rk-grp" data-rk-grp="${esc(grp)}" aria-expanded="${!shut[grp]}"><span>${esc(grp)}</span><i class="rk-grp-dot" hidden></i>${SVG(IC.chevD, 12)}</button>`;
                continue;
            }
            const [k, label, icon, tip] = it;
            const badge = k === 'leads' ? `<button type="button" class="rk-cnt" data-rk-badge="leads" hidden></button>`
                : k === 'check' ? `<button type="button" class="rk-cnt" data-rk-badge="check" data-approvals-n hidden></button>`
                    : k === 'sla' ? `<button type="button" class="rk-cnt" data-rk-badge="sla" hidden></button>` : '';
            html += `<div class="rk-nr"${grp ? ` data-rk-in="${esc(grp)}"` : ''}${grp && shut[grp] ? ' hidden' : ''}><a href="#" class="menu-item rk-mi" data-rk="${k}" title="${esc(tip || label)}">${SVG(IC[icon])}<span class="label rk-lbl">${esc(label)}</span></a>${badge}</div>`;
        }
        html += `<span class="rk-fill" aria-hidden="true"></span>
            <div class="rk-nr"><button type="button" class="menu-item rk-mi rk-more-t" aria-expanded="${ls.get('rk_nav_more') === '1'}" title="Boshqa boʻlimlar: Oʻquvchini tekshirish, Mobil ilova, Target lidlar">${SVG(IC.more)}<span class="label rk-lbl">Boshqa boʻlimlar</span></button></div>
            <div class="rk-more-l"${ls.get('rk_nav_more') === '1' ? '' : ' hidden'}>${MORE.map(([k, l]) => `<a href="#" class="menu-item rk-mi rk-mi--sub" data-rk="${k}"><span class="label rk-lbl">${esc(l)}</span></a>`).join('')}</div>`;
        wrap.innerHTML = html;
        menu.prepend(wrap);
        wrap.addEventListener('click', e => {
            const a = e.target.closest('[data-rk]');
            if (a) {
                e.preventDefault();
                go(a.dataset.rk);
                return;
            }
            const b = e.target.closest('[data-rk-badge]');
            if (b) {
                e.preventDefault();
                const k = b.dataset.rkBadge;
                if (k === 'leads') { closeOverlays(); activePage = null; RD.leads?.openUnassigned?.(); mark(); }
                else go(k);
                return;
            }
            const gb = e.target.closest('[data-rk-grp]');
            if (gb) {
                const s = grpState(), key = gb.dataset.rkGrp;
                s[key] = !s[key]; ls.set('rk_nav_grp', JSON.stringify(s));
                gb.setAttribute('aria-expanded', String(!s[key]));
                wrap.querySelectorAll(`[data-rk-in="${key}"]`).forEach(r => { r.hidden = !!s[key]; });
                badges();
                return;
            }
            const mt = e.target.closest('.rk-more-t');
            if (mt) {
                const open = mt.getAttribute('aria-expanded') !== 'true';
                mt.setAttribute('aria-expanded', String(open)); ls.set('rk_nav_more', open ? '1' : '0');
                wrap.querySelector('.rk-more-l').hidden = !open;
            }
        });
        collapseBtn();
        badges();
        if (g('refreshApprovalsBadge')) refreshApprovalsBadge();
    }
    function badges() {
        const wrap = document.querySelector('#sidebarMenu .rk-nav'); if (!wrap) return;
        const set = (k, n, aria) => {
            const b = wrap.querySelector(`[data-rk-badge="${k}"]`); if (!b) return;
            b.hidden = !n; b.textContent = n ? fmtN(n) : ''; b.title = n ? aria : ''; b.setAttribute('aria-label', n ? aria : '');
        };
        const un = unassignedCount();
        set('leads', un, `${un} ta menejersiz ochiq lid — faqat ularni koʻrsatish`);
        const s = slaUrgent();
        set('sla', s.urgent, `${s.urgent} ta SLA harakat kerak${s.late ? `: ${s.late} tasi adminga ketdi` : ''} — koʻrsatish`);
        const ap = wrap.querySelector('[data-rk-badge="check"]');
        if (ap && !ap.hidden && ap.textContent) { const n = Number(ap.textContent) || 0; ap.title = `${n} ta tasdiq kutilmoqda — ochish`; ap.setAttribute('aria-label', ap.title); if (n > 99) ap.textContent = '99+'; }
        // Yig'iq guruh sarlavhasida — faqat qizil nuqta (yig'indi emas).
        wrap.querySelectorAll('[data-rk-grp]').forEach(gb => {
            const key = gb.dataset.rkGrp, shut = gb.getAttribute('aria-expanded') === 'false';
            const any = [...wrap.querySelectorAll(`[data-rk-in="${key}"] .rk-cnt`)].some(b => !b.hidden);
            gb.querySelector('.rk-grp-dot').hidden = !(shut && any);
        });
    }
    RD.refreshBadges = badges;
    function collapseBtn() {
        const brand = document.querySelector('#sidebar .sidebar-brand'); if (!brand) return;
        let b = brand.querySelector('.rk-sb-toggle');
        if (!b) {
            b = document.createElement('button'); b.type = 'button'; b.className = 'rk-sb-toggle';
            b.addEventListener('click', () => { const min = !document.body.classList.contains('rk-sb-min'); ls.set('rk_sb_min', min ? '1' : '0'); syncCollapse(); });
            brand.appendChild(b);
        }
        syncCollapse();
    }
    function syncCollapse() {
        const min = isRop() && ls.get('rk_sb_min') === '1';
        document.body.classList.toggle('rk-sb-min', min);
        const b = document.querySelector('#sidebar .rk-sb-toggle'); if (!b) return;
        const lab = min ? 'Menyuni ochish' : 'Menyuni yigʻish';
        b.innerHTML = SVG(min ? IC.chevR : IC.chevL, 16); b.title = lab; b.setAttribute('aria-label', lab); b.setAttribute('aria-expanded', String(!min));
        document.querySelectorAll('#sidebarMenu .rk-mi').forEach(a => { if (min) a.setAttribute('aria-label', a.querySelector('.rk-lbl')?.textContent || ''); else a.removeAttribute('aria-label'); });
    }
    function mark() {
        if (!isRop()) return;
        const k = activeKey();
        document.querySelectorAll('#sidebarMenu .rk-mi[data-rk]').forEach(a => {
            const on = a.dataset.rk === k;
            a.classList.toggle('active', on);
            if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        // "Boshqa bo'limlar" ichidagi band faol bo'lsa — ro'yxat ochiq turadi.
        if (k.startsWith('m-')) { const l = document.querySelector('#sidebarMenu .rk-more-l'); if (l) l.hidden = false; document.querySelector('#sidebarMenu .rk-more-t')?.setAttribute('aria-expanded', 'true'); }
        document.body.classList.toggle('rk-sales-lead', k === 'leads' && document.getElementById('tab-sales')?.classList.contains('active'));
        badges();
        header();
    }
    RD.mark = mark;
    RD.buildNav = buildNav;

    // ---------- yuqori panel ----------
    const KEYS = [['/', 'Qidiruvga oʻtish'], ['Tab', 'Kartalar orasida — har karta bitta qadam'], ['↑ ↓', 'Ustun ichida kartadan kartaga'], ['← →', 'Qoʻshni ustunga'], ['Enter', 'Lid kartasini ochish'], ['F2', 'Karta ichidagi tugmalarga kirish'], ['Space', 'Kartani belgilash'], ['Shift + Space / Shift + bosish', 'Oraliqni belgilash'], ['M', 'Menejer biriktirish'], ['S', 'Amallar menyusi'], ['Esc', 'Oyna yoki menyuni yopish']];
    function header() {
        const hd = document.querySelector('.top-header'); if (!hd) return;
        const input = document.getElementById('globalSearch');
        if (input && isRop()) {
            if (!input.dataset.rkPh) { input.dataset.rkPh = input.placeholder; }
            input.placeholder = 'Lid: ism, telefon yoki #ID';
            const box = input.closest('.search-box');
            if (box && !box.querySelector('.rk-kbd')) box.insertAdjacentHTML('beforeend', '<span class="rk-kbd" aria-hidden="true" title="Qidiruvga oʻtish">/</span>');
        } else if (input?.dataset.rkPh) input.placeholder = input.dataset.rkPh;
        const actions = hd.querySelector('.header-actions');
        if (actions && isRop() && !actions.querySelector('.rk-keys')) {
            const w = document.createElement('span'); w.className = 'rk-keys';
            w.innerHTML = `<button type="button" class="icon-btn rk-keys-b" aria-haspopup="dialog" aria-expanded="false" aria-label="Klaviatura yorliqlari" title="Klaviatura yorliqlari">⌨</button>
                <div class="rk-dd rk-keys-dd" role="dialog" aria-label="Klaviatura yorliqlari" hidden><span class="rk-dh">Klaviatura yorliqlari</span>${KEYS.map(([k, t]) => `<div class="rk-key-r"><span class="rk-kbd">${esc(k)}</span>${esc(t)}</div>`).join('')}</div>`;
            const b = w.querySelector('button'), dd = w.querySelector('.rk-keys-dd');
            b.addEventListener('click', e => { e.stopPropagation(); dd.hidden = !dd.hidden; b.setAttribute('aria-expanded', String(!dd.hidden)); });
            document.addEventListener('click', e => { if (!w.contains(e.target)) { dd.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !dd.hidden) { dd.hidden = true; b.setAttribute('aria-expanded', 'false'); b.focus(); } });
            actions.querySelector('.notif-wrap')?.before(w);
        }
        const meta = document.getElementById('userMeta');
        const span = meta?.querySelector('span');
        if (span && isRop()) {
            const l = user().linkedRopLang;
            span.textContent = `ROP · ${l === 'both' ? 'Ingliz va rus' : l === 'russian' ? 'Rus tili' : 'Ingliz tili'}`;
        }
    }
    // "/" — qidiruvga o'tish (matn maydonida emas).
    document.addEventListener('keydown', e => {
        if (!isRop() || e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        const i = document.getElementById('globalSearch'); if (!i || i.disabled) return;
        e.preventDefault(); i.focus();
    });

    // ---------- Bosh sahifa (RK01) qo'shimchalari ----------
    // renderRopHome o'zgarmaydi; ROPda unga "Tasdiq kutmoqda" / "Sinov ustozsiz" plitalari va
    // Menejerlar jadvaliga "Bugun / Oy" almashtirgichi qo'shiladi. Ma'lumot — mavjud manbalar.
    const W = () => window.trialWorkflow;
    const TZ = 5 * HOUR;
    const tLocal = iso => { const ms = Date.parse(iso || ''); if (!Number.isFinite(ms)) return null; const d = new Date(ms + TZ); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), ms }; };
    const tToday = () => new Date(Date.now() + TZ).toISOString().slice(0, 10);
    const MONS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
    function trialsNoTeacher() {
        if (!W() || !g('getItem')) return [];
        const u = user(), lang = u.linkedRopLang || 'english', langs = lang === 'both' ? ['english', 'russian'] : [lang];
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) || {};
        const out = [];
        for (const lg of langs) for (const l of all[lg] || []) {
            if (l.deletedAt || l.status !== 'sinov-darsida') continue;
            const req = W().request(l);
            const ph = W().isCancelled?.(l) ? 'cancelled' : W().phase(req || {}, { leadStatus: l.status, durationMin: W().durationOf(l) });
            if (ph !== 'unassigned' && ph !== 'rejected') continue;
            const at = tLocal((req || {}).scheduledAt || l.trialLessonAt);
            if (at) out.push({ lead: l, at });
        }
        return out.sort((a, b) => a.at.ms - b.at.ms);
    }
    let apCount = null, apAt = 0;
    function loadApprovalsCount(el) {
        if (Date.now() - apAt < 60000 && apCount != null) return;
        apAt = Date.now();
        const api = window.schoolUI?.api;
        const p = api ? api('/edit-requests?status=pending') : (g('apiFetch') ? apiFetch('/api/school/edit-requests?status=pending') : null);
        p?.then(r => { apCount = Number(r?.counts?.pending ?? (r?.requests || []).filter(x => x.status === 'pending').length) || 0; window.refreshApprovalsBadge?.(r?.counts || { pending: apCount }); paintTiles(el); })
            .catch(() => { apCount = null; paintTiles(el, true); });
    }
    function paintTiles(root, apErr) {
        const box = root?.querySelector('.rk-tiles'); if (!box) return;
        const tr = trialsNoTeacher();
        const t0 = tToday();
        const when = x => `${x.at.date === t0 ? 'bugun' : `${Number(x.at.date.slice(8))}-${MONS[Number(x.at.date.slice(5, 7)) - 1]}`} ${String(Math.floor(x.at.min / 60)).padStart(2, '0')}:${String(x.at.min % 60).padStart(2, '0')}`;
        box.innerHTML = `<button type="button" class="card rk-tile" data-rk-go="check"><span class="rk-tile-i rk-tone-blue">${SVG(IC.check, 22)}</span><span class="rk-tile-t"><strong>Tasdiq kutmoqda</strong><span>${apErr ? 'Yuklab boʻlmadi — qayta urinib koʻring' : 'Toʻlov, tarif, ustoz almashtirish → Oʻquvchilar · Sotuv tahrirlari'}</span></span><strong class="rk-tile-n">${apCount == null ? (apErr ? '—' : '…') : apCount}</strong></button>
            <button type="button" class="card rk-tile" data-rk-go="trial"><span class="rk-tile-i rk-tone-purple">${SVG(IC.cal, 22)}</span><span class="rk-tile-t"><strong>Sinov ustozsiz</strong><span>${tr.length ? esc(tr.slice(0, 2).map(when).join(' · ')) + ' → Sinov darslari · nazorat' : 'Hammasiga ustoz biriktirilgan'}</span></span><strong class="rk-tile-n">${tr.length}</strong></button>`;
        box.querySelectorAll('[data-rk-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.rkGo)));
    }
    // Menejerlar · Bugun: holat (bugungi davomat), qo'ng'iroq / maqsad, sotuv, qotgan lid, ochiq SLA.
    function dayRows(langs) {
        const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) || {};
        const list = langs.flatMap(lg => (all[lg] || []).filter(l => !l.deletedAt).map(l => ({ ...l, _lang: lg })));
        const today = new Date(); const dk = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; const k0 = dk(today);
        const st = window.staleLeads;
        const sla = (() => { try { const now = Date.now(); return getLeadSlaNotificationsForCurrentUser().filter(a => a.audience === 'rop' && langs.includes(a.leadLang)).filter(a => { const lead = list.find(l => l.id === a.leadId); return lead && !parseLeadSlaTime(lead.slaRopAcknowledged?.[a.stageKey]) && now >= a.time; }).map(a => list.find(l => l.id === a.leadId)?.managerId); } catch (e) { return []; } })();
        const rules = st?.rules ? st.rules() : null;
        const AFTER = new Set(['boglanildi', 'malumot-berildi', 'sinov-darsida', 'qaror-jarayonida', 'keyin-sotib-olmoqchi', 'tolov-jarayonida', 'tolov-yopildi']);
        const isStale = l => { if (!l.managerId || normalizeLeadStatus(l.status) !== 'boglanishga-urinilmoqda') return false; if ((Array.isArray(l.stageHistory) && l.stageHistory.some(h => h && AFTER.has(h.to))) || (l.connectedSurvey && Object.keys(l.connectedSurvey).length)) return false; const r = rules?.[l._lang] || { warnDays: 3 }; const t = Date.parse(l.managerAssignedAt || l.createdAt || ''); return Number.isFinite(t) && Math.floor((Date.now() - t) / DAY) >= r.warnDays; };
        return langs.flatMap(lg => getActiveSalesManagers(lg).map(m => ({ m, lg }))).map(({ m, lg }) => {
            const mine = list.filter(l => String(l.managerId) === String(m.id));
            // Bitta qo'ng'iroq = bitta urinish ("Javob bermadi" natijasi alohida sanalmaydi — staleLeads.attempts).
            const calls = mine.reduce((a, l) => a + (window.staleLeads?.attempts ? window.staleLeads.attempts(l).map(c => c.t) : (Array.isArray(l.comments) ? l.comments : []).filter(c => c && c.type === 'call-attempt').map(c => Date.parse(c.createdAt))).filter(t => Number.isFinite(t) && dk(new Date(t)) === k0).length, 0);
            return { m, calls, goal: (rules?.[lg]?.callsPerDay) || 30, deals: g('getManagerDealsCount') ? getManagerDealsCount(m.id, 'kunlik') : 0, stale: mine.filter(isStale).length, sla: sla.filter(id => String(id) === String(m.id)).length, att: attOf(m) };
        }).sort((a, b) => b.deals - a.deals || b.calls - a.calls);
    }
    // Bugungi kelish holati: davomat moduli (window.davomat) bo'lsa undan; bo'lmasa "—".
    function attOf(m) {
        try {
            const a = window.davomat?.statusOf?.(m.id);
            if (a && a.text) return { text: a.text, tone: a.tone || 'ok' };
        } catch (e) { /* holat noma'lum */ }
        return null;
    }
    function managersPeriod(root) {
        const sec = root.querySelector('.rpx-mgrs'); if (!sec) return;
        const head = sec.querySelector('.ahx-card-h'); const h3 = head?.querySelector('h3');
        const per = ls.get('rk_home_per') === 'month' ? 'month' : 'day';
        const now = new Date(), MON = typeof UZ_MONTHS_GEN !== 'undefined' ? UZ_MONTHS_GEN : MONS;
        if (h3) h3.textContent = 'Menejerlar';
        if (head && !head.querySelector('.rk-seg')) {
            const seg = document.createElement('div'); seg.className = 'rk-seg'; seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'Davr');
            seg.innerHTML = `<button type="button" role="radio" data-per="day">Bugun</button><button type="button" role="radio" data-per="month">${esc(String(MON[now.getMonth()] || '').replace(/^./, c => c.toUpperCase()))}</button>`;
            head.querySelector('.ahx-link')?.before(seg);
            seg.addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (!b) return; ls.set('rk_home_per', b.dataset.per); managersPeriod(root); });
        }
        head?.querySelectorAll('[data-per]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.per === per)));
        const month = sec.querySelector('.ahx-tbl-wrap:not(.rk-day)');
        let day = sec.querySelector('.rk-day');
        if (per === 'month') { if (month) month.hidden = false; if (day) day.hidden = true; return; }
        if (month) month.hidden = true;
        const u = user(), lang = u.linkedRopLang || 'english', langs = lang === 'both' ? ['english', 'russian'] : [lang];
        const rows = dayRows(langs);
        if (!day) { day = document.createElement('div'); day.className = 'ahx-tbl-wrap rk-day'; sec.appendChild(day); }
        day.hidden = false;
        day.innerHTML = rows.length ? `<table class="ahx-tbl rk-day-t"><thead><tr><th scope="col">Menejer</th><th scope="col">Holat</th><th scope="col">Qoʻngʻiroq · maqsad ${rows[0].goal}</th><th scope="col">Sotuv</th><th scope="col">Qotgan lid</th><th scope="col">Ochiq SLA</th></tr></thead>
            <tbody>${rows.map(r => { const p = Math.min(100, Math.round(r.calls / Math.max(1, r.goal) * 100)); return `<tr><th scope="row">${esc(r.m.name || '')}</th>
              <td>${r.att ? `<span class="rk-pill rk-pill--${esc(r.att.tone)}">${esc(r.att.text)}</span>` : '<span class="rk-mut">—</span>'}</td>
              <td><span class="rk-calls">${r.calls} / ${r.goal}</span><span class="rk-bar" aria-hidden="true"><i style="width:${p}%"></i></span></td>
              <td>${r.deals}</td><td>${r.stale ? `<span class="rk-pill rk-pill--${r.stale >= 3 ? 'bad' : 'warn'}">${r.stale} ta</span>` : '<span class="rk-mut">—</span>'}</td>
              <td>${r.sla ? `<span class="rk-pill rk-pill--bad">${r.sla} ta</span>` : '<span class="rk-mut">—</span>'}</td></tr>`; }).join('')}</tbody></table>` : '<p class="dashboard-empty">Menejerlar topilmadi</p>';
    }
    function enhanceHome() {
        if (!isRop()) return;
        const root = document.getElementById('ropHome'); if (!root) return;
        if (!root.querySelector('.rk-tiles')) {
            const tiles = document.createElement('div'); tiles.className = 'rk-tiles';
            root.querySelector('.kbx-top')?.after(tiles);
        }
        paintTiles(root);
        loadApprovalsCount(root);
        managersPeriod(root);
        // "Yana N ta — Lidlarda" → SLA sahifasi (B qismi bo'lsa).
        root.querySelectorAll('.ahx-link[data-rpx-go="leads"]').forEach(a => { if (/^Yana/.test(a.textContent) && (RD.pages.sla || window.ropDeskPages)) { const c = a.cloneNode(true); c.textContent = a.textContent.replace('Lidlarda', 'SLA'); c.removeAttribute('data-rpx-go'); c.addEventListener('click', () => go('sla')); a.replaceWith(c); } });
    }
    RD.enhanceHome = enhanceHome;

    // ---------- app.js funksiyalariga ulanish (o'raladi, xatti-harakat o'zgarmaydi) ----------
    function wrap(name, after) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__rk) return;
        const fn = function (...a) { const r = orig.apply(this, a); try { after(...a); } catch (e) { console.warn('[ropDesk]', name, e.message); } return r; };
        fn.__rk = true;
        window[name] = fn;
    }
    function apply() {
        const on = isRop();
        document.body.classList.toggle('rop-desk-v2', on);
        if (!on) { document.body.classList.remove('rk-sb-min', 'rk-sales-lead'); document.querySelectorAll('#sidebarMenu .rk-nav').forEach(x => x.remove()); }
        syncCollapse();
    }
    RD.apply = apply;
    wrap('switchTab', () => mark());
    wrap('switchSalesSection', () => mark());
    wrap('switchProfileSection', () => mark());
    wrap('switchMarketingSection', () => mark());
    wrap('renderDashboard', () => enhanceHome());
    wrap('syncHeaderAvatar', () => header());
    MQ.addEventListener?.('change', () => { apply(); window.ropSotuvNav?.apply?.(user()); });
    setInterval(() => { if (isRop() && document.visibilityState === 'visible') badges(); }, 60000);
    apply();
})();
