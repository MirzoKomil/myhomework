// ROP va sotuv menejeri sidebari — dizayndagi bandlar ro'yxati (RopSinov, RopJadval, SotuvJadval, SotuvSinov…).
//   ROP:   Bosh sahifa · Sotuv bo'limi · Lidlar · Dars jadvali · Sinov darslari · O'quvchilar · Reyting · Sotuv rejasi · Sozlamalar
//   Sotuv: Bosh sahifa · Lidlar · Dars jadvali · O'quvchilar · Qarzdorlar · Sotuv rejasi · Reyting · Skriptlar · Sinov darslari · Sozlamalar
// Admin/boshliq sidebari (index.html .menu-item, js/app.js applyRoleBasedAccess) o'zgarmaydi: bu fayl faqat shu ikki rolda
// asl bandlarni yashirib, dizayndagilarni qo'yadi. Dizaynda yo'q, lekin kerakli bo'limlar (Marketing/SMS, Analitika, Mobil ilova,
// Yo'riqnomalar, Tasdiqlar, Telegram guruhlar, O'quvchini tekshirish) — sahifa ichidagi "Boshqa bo'limlar" qatoridan ochiladi.
(function () {
    'use strict';
    const SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const I = {
        home: '<path d="M3 10.5 12 4l9 6.5V20H3z"/>',
        sales: '<path d="M4 5h16v11H8l-4 4z"/>',
        leads: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
        cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
        trial: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
        students: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/>',
        rating: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
        plan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        debt: '<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M16 12.5h2M2 10h20"/>',
        script: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'
    };
    // key → { label, icon, go: [tab, ctx] | 'trial-sotuv' }
    const ITEMS = {
        home: { label: 'Bosh sahifa', icon: 'home', go: ['dashboard'] },
        sales: { label: 'Sotuv boʻlimi', icon: 'sales', go: ['sales', { salesSection: 'sales-stats' }] },
        leads: { label: 'Lidlar', icon: 'leads', go: ['sales', { salesSection: 'leads' }] },
        timetable: { label: 'Dars jadvali', icon: 'cal', go: ['timetable'] },
        trialRop: { label: 'Sinov darslari', icon: 'trial', go: ['trial-lessons'] },
        trialSotuv: { label: 'Sinov darslari', icon: 'trial', go: 'trial-sotuv' },
        students: { label: 'Oʻquvchilar', icon: 'students', go: ['students'] },
        rating: { label: 'Reyting', icon: 'rating', go: ['sales', { salesSection: 'rating' }] },
        plan: { label: 'Sotuv rejasi', icon: 'plan', go: ['sales', { salesSection: 'sales-plan' }] },
        debtors: { label: 'Qarzdorlar', icon: 'debt', go: ['sales', { salesSection: 'debtors' }] },
        scripts: { label: 'Skriptlar', icon: 'script', go: ['sales', { salesSection: 'scripts' }] }
    };
    const ORDER = {
        rop: ['home', 'sales', 'leads', 'timetable', 'trialRop', 'students', 'rating', 'plan'],
        sales_manager: ['home', 'leads', 'timetable', 'students', 'debtors', 'plan', 'rating', 'scripts', 'trialSotuv']
    };
    // Dizaynda sidebar'da yo'q, lekin ish uchun kerak bo'lgan bo'limlar (asl tab qoladi, faqat sahifa ichidan ochiladi).
    const MORE = {
        rop: [['marketing', 'Marketing boʻlimi'], ['teachers-section', 'Oʻquvchini tekshirish'], ['student-app', 'Mobil ilova'], ['guides', 'Yoʻriqnomalar']],
        sales_manager: [['sales', 'Statistika', { salesSection: 'sales-stats' }], ['sales', 'Kitob yetkazish', { salesSection: 'book-roadmap' }], ['marketing', 'SMS rassilka'],
            ['analitika', 'Analitika'], ['student-app', 'Mobil ilova'], ['guides', 'Yoʻriqnomalar']]
    };
    // ROP: Tasdiqlar va Telegram guruhlar — dizaynda "O'quvchilar" ichida (RopTasdiq, RopGuruhlar).
    // Ular O'quvchilar sahifasining ichki tablarida bor (index.html data-go-tab … data-go-roles="… rop") — takror qator chiqarilmaydi.
    const STUDENT_LINKS = {};

    const role = () => (typeof getCurrentUser === 'function' ? getCurrentUser()?.role : '') || '';
    const on = () => !!ORDER[role()];
    let current = null;

    function activeKey() {
        // Sinov qo'yish / holatlar sahifasi — "← Lidlar" ostidagi sahifa: dizaynda (SotuvSinov, SotuvHolatlar) faol band "Lidlar",
        // qaysi joydan ochilganidan qat'i nazar (BAHO7).
        if (document.body.classList.contains('ss-page-open') && role() === 'sales_manager') return 'leads';
        const tab = document.querySelector('.tab-content.active')?.id?.replace(/^tab-/, '') || '';
        const sec = typeof _tabContext !== 'undefined' ? _tabContext.salesSection : '';
        const keys = ORDER[role()] || [];
        if (tab === 'sales') {
            const k = keys.find(k => ITEMS[k].go[0] === 'sales' && ITEMS[k].go[1]?.salesSection === sec);
            return k || (keys.includes('sales') ? 'sales' : 'leads');
        }
        if (tab === 'school-approvals' || tab === 'school-groups') return 'students';
        return keys.find(k => Array.isArray(ITEMS[k].go) && ITEMS[k].go[0] === tab) || '';
    }
    function mark() {
        if (!on()) return;
        const k = activeKey();
        document.querySelectorAll('#sidebarMenu .rs-item').forEach(a => {
            const is = a.dataset.rs === k;
            a.classList.toggle('active', is);
            if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        decorate();
    }
    function go(key) {
        const it = ITEMS[key]; if (!it) return;
        if (it.go === 'trial-sotuv') {
            if (typeof switchTab === 'function' && !document.getElementById('tab-sales')?.classList.contains('active')) switchTab('sales', { salesSection: 'leads' });
            window.sotuvSinov?.open({ from: 'trials', onClose: () => mark() });
            mark();
            return;
        }
        const [tab, ctx] = it.go;
        window.sotuvSinov?.close?.({ silent: true }); window.jadvalV3?.close?.({ silent: true });
        if (tab === 'sales' && document.getElementById('tab-sales')?.classList.contains('active') && typeof switchSalesSection === 'function') switchSalesSection(ctx.salesSection);
        else switchTab(tab, ctx || {});
        mark();
    }

    function apply(user) {
        const r = user?.role;
        const menu = document.getElementById('sidebarMenu');
        if (!menu) return;
        document.body.classList.toggle('rs-rop', r === 'rop');
        document.body.classList.toggle('rs-sotuv', r === 'sales_manager');
        menu.querySelectorAll('.rs-item').forEach(x => x.remove());
        if (!ORDER[r]) { current = null; return; }
        current = r;
        // Asl bandlar va ularning "Boshqa" ajratgichi (js/app.js applyDesignSidebar) — bo'sh sarlavha qolmasin.
        // Ruxsat bo'yicha yashirilganmi — asl holat saqlanadi (teamApp.js pastki menyusi shunga qaraydi: dizayn uchun yashirilgan
        // band ruxsat yo'qligini bildirmaydi). Qayta chaqirilganda asl qiymat ustidan yozilmaydi.
        menu.querySelectorAll(':scope > .menu-item, :scope > .menu-group, :scope > .menu-sep').forEach(el => {
            // Boshqa kod (ruxsatlar) bandni qayta ko'rsatgan bo'lsa — yangi holat yoziladi, eski qiymat qotib qolmaydi.
            if (!el.dataset.rsHidden || el.style.display !== 'none') el.dataset.rsPrev = el.style.display === 'none' ? 'none' : '';
            el.style.display = 'none'; el.dataset.rsHidden = '1';
        });
        const frag = document.createDocumentFragment();
        for (const k of ORDER[r]) {
            const it = ITEMS[k];
            const a = document.createElement('a');
            a.href = '#'; a.className = 'menu-item rs-item'; a.dataset.rs = k;
            a.innerHTML = `${SVG(I[it.icon])}<span class="label">${it.label}</span>`;
            a.addEventListener('click', e => {
                e.preventDefault(); go(k);
                if (window.matchMedia('(max-width: 900px)').matches) document.getElementById('sidebarBackdrop')?.click();
            });
            frag.appendChild(a);
        }
        menu.prepend(frag);
        mark();
    }

    // Sahifa ichidagi "Boshqa bo'limlar" qatori: Sotuv bo'limi ichida (sotuvga Statistika/Kitob…; ROP'ga Marketing…)
    // va ROP O'quvchilar sahifasida (Tasdiqlar, Telegram guruhlar).
    function strip(id, links, where) {
        if (!where || !links?.length) return;
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('nav');
            el.id = id; el.className = 'rs-more'; el.setAttribute('aria-label', 'Boshqa boʻlimlar');
            where.prepend(el);
        }
        el.innerHTML = `<span class="rs-more-l">Boshqa boʻlimlar:</span>${links.map(([tab, label, ctx], i) => `<button type="button" class="rs-more-b" data-i="${i}">${label}</button>`).join('')}`;
        el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const [tab, , ctx] = links[Number(b.dataset.i)]; window.sotuvSinov?.close?.({ silent: true }); window.jadvalV3?.close?.({ silent: true }); if (tab === 'sales' && document.getElementById('tab-sales')?.classList.contains('active') && typeof switchSalesSection === 'function') switchSalesSection(ctx.salesSection); else switchTab(tab, ctx || {}); mark(); });
    }
    // Reyting (sidebar → "Reyting"): dizayn tilidagi sahifa — sarlavha "Reyting", ichki "Sotuv" tablar qatori va
    // "Boshqa bo'limlar" yashirin. ROP uchun "Sotuv menejerlari · Ustozlar" almashtirgichi: "Ustozlar" — Reyting dizayni
    // (js/reytingUI.js, /api/state/teacher-rating — server ROP'ga ruxsat beradi), faqat ROP tili.
    const RT = { view: 'sales' };
    function ratingView() {
        const r = role();
        const on = !!ORDER[r] && document.getElementById('tab-sales')?.classList.contains('active')
            && typeof _tabContext !== 'undefined' && _tabContext.salesSection === 'rating' && !document.body.classList.contains('ss-page-open');
        document.body.classList.toggle('rs-rating', on);
        const panel = document.querySelector('[data-sales-panel="rating"]');
        const head = document.querySelector('#tab-sales > .sales-pinned > .rd-page-head');
        if (!on || !panel) { document.getElementById('rsRatingTeachers')?.setAttribute('hidden', ''); panel?.classList.remove('rs-rt-teachers'); return; }
        const lang = (typeof getUserOwnLang === 'function' && getUserOwnLang()) || 'english';
        if (head) {
            head.querySelector('h1').textContent = 'Reyting';
            head.querySelector('p').textContent = `${RT.view === 'teachers' ? 'Ustozlar' : 'Sotuv menejerlari'} · ${lang === 'russian' ? 'Rus tili' : 'Ingliz tili'} yoʻnalishi`;
        }
        let bar = document.getElementById('rsRatingBar');
        if (r === 'rop') {
            if (!bar) {
                bar = document.createElement('div'); bar.id = 'rsRatingBar'; bar.className = 'sc-seg rs-rtbar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Reyting turi');
                bar.innerHTML = '<button type="button" data-rtv="sales">Sotuv menejerlari</button><button type="button" data-rtv="teachers">Ustozlar</button>';
                panel.prepend(bar);
                bar.querySelectorAll('[data-rtv]').forEach(b => b.onclick = () => { RT.view = b.dataset.rtv; ratingView(); });
            }
            bar.querySelectorAll('[data-rtv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rtv === RT.view)));
        } else bar?.remove();
        const teachers = r === 'rop' && RT.view === 'teachers';
        panel.classList.toggle('rs-rt-teachers', teachers);
        let box = document.getElementById('rsRatingTeachers');
        if (teachers) {
            if (!box) { box = document.createElement('div'); box.id = 'rsRatingTeachers'; bar.after(box); }
            box.hidden = false;
            if (!box.dataset.drawn && window.ReytingUI) { box.dataset.drawn = '1'; window.ReytingUI.render(box, { lang }); }
        } else if (box) box.hidden = true;
    }
    function decorate() {
        const r = role();
        if (!ORDER[r]) return;
        ratingView();
        strip('rsMoreSales', MORE[r], document.getElementById('tab-sales'));
        if (STUDENT_LINKS[r]) strip('rsMoreStudents', STUDENT_LINKS[r], document.getElementById('tab-students'));
    }

    // app.js funksiyalariga ulanish (global function declaration'lar — ustidan o'raladi, xatti-harakat o'zgarmaydi).
    function wrap(name, after) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__rs) return;
        const fn = function (...a) { const r = orig.apply(this, a); try { after(...a); } catch (e) { console.warn('[ropSotuvNav]', e.message); } return r; };
        fn.__rs = true;
        window[name] = fn;
    }
    // Sotuv rejasi: ROP va sotuv menejeri faqat ko'radi (30-okt direktor qarori; server ham PATCH salesPlan /
    // individualSalesPlans ni rad etadi). Reja kalkulyatori maydonlari faqat o'qish uchun, "Reja belgilash" yo'q.
    function lockPlan() {
        if (!on()) return;
        const panel = document.querySelector('[data-sales-panel="sales-plan"]'); if (!panel) return;
        panel.querySelectorAll('#spManagers, #spLeadsPerDay, #spDuration, #spLeadCost, #spAvgCheck, #spConvMin, #spConvMid, #spConvMax').forEach(i => { i.readOnly = true; i.setAttribute('aria-readonly', 'true'); i.title = 'Rejani admin belgilaydi'; });
        panel.querySelectorAll('#spIndSetPlanBtn, #spIndEditPlanBtn').forEach(b => b.remove());
        if (!panel.querySelector('.rs-ro')) panel.insertAdjacentHTML('afterbegin', '<p class="rs-ro" role="note">Sotuv rejasini admin belgilaydi — bu yerda faqat ko\'rish mumkin.</p>');
    }
    wrap('renderSalesPlan', lockPlan);
    wrap('renderSalesPlanIndividual', lockPlan);
    wrap('applyRoleBasedAccess', apply);
    wrap('switchTab', () => mark());
    wrap('switchSalesSection', () => mark());
    wrap('updateRdPageHead', () => { if (on()) ratingView(); });
    // Yuklanishda allaqachon qo'llangan bo'lsa.
    try { const u = typeof getCurrentUser === 'function' ? getCurrentUser() : null; if (u && document.querySelector('#sidebarMenu .menu-item[style*="display"]')) apply(u); } catch (_) { /* hali kirilmagan */ }

    window.ropSotuvNav = { apply, mark, ORDER, ITEMS };
})();
