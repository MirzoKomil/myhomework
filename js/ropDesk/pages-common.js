// ROP kompyuter kabineti (B) — Lidlar'dan tashqari sahifalar uchun umumiy qism.
// Faqat role=rop va ekran >900px (telefon — js/ropApp.js) bo'lganda ishlaydi; boshqa rollar (sotuv menejeri, admin…)
// va ular ko'radigan umumiy sahifalar (renderSalesPlan, renderRating, renderDebtorsTable, renderSms…) o'zgarmaydi.
// Mavjud funksiyalar o'chirilmaydi: sahifalar asl render funksiyalari ustidan bezatiladi (wrap) yoki ROP uchun
// yangi tab-bo'limda chiziladi (SLA, Qotgan lidlar qoidasi, SMS yuborish, Arxiv).
//
// Sidebar (js/ropDesk/shell.js) uchun kontrakt: window.ropDeskPages.open(key) — key: check, sla, lock, arch, funnel,
// rating, plan, debt, script, sms, stu, tg. ropDeskPages.activeKey() — hozir ochiq bandning kaliti ('' — boshqa sahifa).
(function () {
    'use strict';
    const MQ = window.matchMedia('(max-width: 900px)');
    const g = n => (typeof window[n] === 'function' ? window[n] : null);
    const user = () => (g('getCurrentUser') ? getCurrentUser() : null) || {};
    const isRopDesk = () => user().role === 'rop' && !MQ.matches;
    // Sotuv menejeri kompyuter kabineti (dizayn "Sotuv · Kompyuter", SotK*): role = sales_manager, ekran > 900px.
    const isSotDesk = () => user().role === 'sales_manager' && !MQ.matches;
    const isDesk = () => isRopDesk() || isSotDesk();
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // ROP faqat o'z tilida ishlaydi (server ropScope ham shu bo'yicha cheklaydi).
    const lang = () => { const u = user(); if (u.role === 'rop' && u.linkedRopLang === 'both') return typeof _leadsLangFilter !== 'undefined' && _leadsLangFilter === 'english' ? 'english' : 'russian'; const l = (u.role === 'sales_manager' ? u.linkedManagerLang : u.linkedRopLang) || 'russian'; return l === 'english' ? 'english' : 'russian'; };
    const langLabel = (lg = lang()) => (lg === 'english' ? 'Ingliz tili' : 'Rus tili');

    // Sidebar kaliti → mavjud marshrut. [tab, ctx] — switchTab; rdp-* — shu fayl yaratgan ROP bo'limi.
    const ROUTES_ROP = {
        check: ['school-approvals'], sla: ['rdp-sla'], lock: ['rdp-stale'], arch: ['rdp-archive'],
        funnel: ['sales', { salesSection: 'sales-stats' }], rating: ['sales', { salesSection: 'rating' }],
        plan: ['sales', { salesSection: 'sales-plan' }], debt: ['sales', { salesSection: 'debtors' }],
        script: ['sales', { salesSection: 'scripts' }], sms: ['rdp-sms'], stu: ['students'], tg: ['school-groups']
    };
    // Sotuv menejeri (window.sotDeskPages): debt, plan, rating, script, funnel (Statistika), sms, stu, book.
    // SMS — o'z bo'limi (tab-rdp-sms, ROP bilan bitta konteyner; chizuvchi rolga qarab tanlanadi).
    const ROUTES_SOT = {
        debt: ['sales', { salesSection: 'debtors' }], plan: ['sales', { salesSection: 'sales-plan' }], rating: ['sales', { salesSection: 'rating' }],
        script: ['sales', { salesSection: 'scripts' }], funnel: ['sales', { salesSection: 'sales-stats' }], sms: ['rdp-sms'],
        stu: ['students'], book: ['sales', { salesSection: 'book-roadmap' }]
    };
    const ROUTES = ROUTES_ROP; // eski nom (pages-*.js)
    const routes = () => (isSotDesk() ? ROUTES_SOT : ROUTES_ROP);
    const OWN_TABS = ['rdp-sla', 'rdp-stale', 'rdp-sms', 'rdp-archive'];
    const PAGES = {}; // ROP: key → { tab, section?, title, sub?, head?, render?(host), after?() }
    const SOT_PAGES = {}; // sotuv menejeri: xuddi shu shakl (registerSot)
    const pages = () => (isSotDesk() ? SOT_PAGES : PAGES);

    function activeKey() {
        const tab = document.querySelector('.tab-content.active')?.id?.replace(/^tab-/, '') || '';
        const sec = typeof _tabContext !== 'undefined' ? _tabContext.salesSection : '';
        if (document.body.classList.contains('ss-page-open')) return '';
        for (const [k, [t, ctx]] of Object.entries(routes())) {
            if (t !== tab) continue;
            if (t === 'sales' && ctx?.salesSection !== sec) continue;
            return k;
        }
        return '';
    }
    // ROP Lidlarga kirmasdan Reyting/Rejani ochsa til inglizligicha qolib, sahifalar bo'sh chiqardi.
    function syncRopLang() {
        const u = user();
        if (u.role !== 'rop' || typeof _leadsLangFilter === 'undefined') return;
        if (u.linkedRopLang === 'russian' || u.linkedRopLang === 'english') { _leadsLangFilter = u.linkedRopLang; return; }
        if (u.linkedRopLang === 'both' && _leadsLangFilter !== 'russian' && g('getItem')) {
            const all = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
            if (!(all.english || []).length && (all.russian || []).length) _leadsLangFilter = 'russian';
        }
    }
    function open(key) {
        const r = routes()[key]; if (!r) return false;
        syncRopLang();
        const [tab, ctx] = r;
        window.sotuvSinov?.close?.({ silent: true }); window.jadvalV3?.close?.({ silent: true });
        if (tab === 'sales' && document.getElementById('tab-sales')?.classList.contains('active') && g('switchSalesSection')) switchSalesSection(ctx.salesSection);
        else if (g('switchTab')) switchTab(tab, ctx || {});
        return true;
    }

    // ---- ROP bo'limlari (tab-rdp-*) — asosiy kontent maydonida, boshqa tab-content'lar yonida ----
    function ensureTabs() {
        const anchor = document.getElementById('tab-sales');
        if (!anchor) return false;
        for (const id of OWN_TABS) {
            if (document.getElementById('tab-' + id)) continue;
            const s = document.createElement('section');
            s.id = 'tab-' + id; s.className = 'tab-content rdp-tab';
            s.innerHTML = `<div class="rdp-root" id="${id}Root"></div>`;
            anchor.parentNode.appendChild(s);
        }
        return true;
    }

    // ---- sarlavha (dizayn: H1 + "Rus tili" chipi + izoh + o'ng slot) ----
    function headHtml({ title, sub = '', right = '', chipRight = false }) {
        const chip = `<span class="rdp-chip">${esc(langLabel())}</span>`;
        return `<div class="rdp-head${chipRight ? ' rdp-head--chipr' : ''}"><div class="rdp-head-t"><h1>${esc(title)}${chipRight ? '' : chip}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
            <div class="rdp-head-r">${right}${chipRight ? chip : ''}</div></div>`;
    }
    // Sotuv bo'limi ichidagi sahifalar: asl "Sotuv" sarlavhasi va ichki tablar ROPda yashiriladi (CSS), o'rniga sahifa sarlavhasi.
    function salesHead(page) {
        const tab = document.getElementById('tab-sales'); if (!tab) return null;
        let h = document.getElementById('rdpSalesHead');
        if (!h) {
            h = document.createElement('div'); h.id = 'rdpSalesHead';
            const body = tab.querySelector(':scope > .sales-body');
            if (body) tab.insertBefore(h, body); else tab.prepend(h);
        }
        h.innerHTML = headHtml(typeof page.head === 'function' ? page.head() : page.head);
        return h;
    }

    let syncing = false;
    function sync() {
        if (syncing) return;
        syncing = true;
        try {
            const on = isDesk();
            document.body.classList.toggle('rop-desk-v2', isRopDesk());
            document.body.classList.toggle('sot-desk-v2', isSotDesk());
            const key = on ? activeKey() : '';
            const page = key && pages()[key];
            if (page) document.body.dataset.rdp = key; else delete document.body.dataset.rdp;
            if (!page) return;
            if (page.tab === 'sales' && page.head) salesHead(page);
            if (page.render && page.tab === routes()[key][0]) {
                const host = document.getElementById(routes()[key][0] + 'Root');
                if (host && host.dataset.rdpDrawn !== String(syncSeq)) { host.dataset.rdpDrawn = String(syncSeq); page.render(host); }
            }
            page.after?.();
        } catch (e) { console.warn('[ropDeskPages]', e); } finally { syncing = false; }
    }
    let syncSeq = 0;
    function wrap(name, after) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__rdp) return false;
        const fn = function (...a) { const r = orig.apply(this, a); try { after(...a); } catch (e) { console.warn('[ropDeskPages]', name, e); } return r; };
        fn.__rdp = true;
        window[name] = fn;
        return true;
    }
    // Tab almashganda ROP bo'limi har safar qayta chiziladi (yangi ma'lumot bilan).
    function onSwitch() { syncSeq++; sync(); }

    function boot() {
        ensureTabs();
        wrap('switchTab', onSwitch);
        wrap('switchSalesSection', onSwitch);
        wrap('applyRoleBasedAccess', () => sync());
        MQ.addEventListener?.('change', () => sync());
        sync();
    }

    // Kichik umumiy yordamchilar (pages-*.js uchun).
    const U = {
        esc, lang, langLabel, user, isRopDesk, isSotDesk, isDesk, g,
        num: n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
        initials: n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?',
        shortName: n => { const p = String(n || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') : ''; },
        firstName: n => String(n || '').trim().split(/\s+/)[0] || '',
        ts: v => { if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const t = Date.parse(v || ''); return Number.isFinite(t) ? t : 0; },
        avColor: id => { const AV = ['#7C3AED', '#C2410C', '#0F766E', '#166534', '#BE185D', '#1D4ED8']; let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV[h % AV.length]; },
        av(id, name, size = 32) { return `<span class="rdp-av" style="width:${size}px;height:${size}px;background:${U.avColor(id || name)};font-size:${Math.round(size * 0.36)}px" aria-hidden="true">${esc(U.initials(name))}</span>`; },
        leads: () => { const all = g('getItem') ? getItem(STORAGE_KEYS.leads, { english: [], russian: [] }) : {}; return (all[lang()] || []).filter(l => l && !l.deletedAt); },
        managers: () => (g('getActiveSalesManagers') ? getActiveSalesManagers(lang()) : (g('getSalesManagers') ? getSalesManagers() : [])),
        toast: (m, ms) => (g('showMiniToast') ? showMiniToast(m, ms) : null),
        headHtml, salesHead, wrap, sync
    };

    window.ropDeskPages = { ROUTES, ROUTES_SOT, PAGES, SOT_PAGES, open, activeKey, isRopDesk, isSotDesk, isDesk, sync, U, register: (key, def) => { PAGES[key] = def; }, registerSot: (key, def) => { SOT_PAGES[key] = def; } };
    // Sotuv menejeri sidebari (js/ropDesk/shell.js) uchun kontrakt — bir xil funksiyalar, rolga qarab marshrut.
    window.sotDeskPages = { open: k => (isSotDesk() ? open(k) : false), activeKey: () => (isSotDesk() ? activeKey() : ''), register: (key, def) => { SOT_PAGES[key] = def; }, PAGES: SOT_PAGES, ROUTES: ROUTES_SOT, U };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
