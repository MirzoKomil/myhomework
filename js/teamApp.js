// Domwork Team — telefon/ilova qatlami (2026-10).
// Ma'lumot va mantiqqa tegmaydi: faqat navigatsiya va ko'rinishni
// telefon ilovasiga moslaydi. Uslublar: css/teamApp.css.
//  • body[data-role] — rolga qarab CSS sozlash uchun
//  • Pastki tab-bar (≤900px), rolga qarab 4 ta bo'lim + "Menyu"
//  • Qidiruv telefonda ikonka orqali ochiladi
//  • Lidlar kanbani telefonda: bosqich chiplari + surish (scroll-snap)
//  • Sana maydonlari kk.oo.yyyy ko'rinishida
//  • Ichki tablar kesilib qolmasligi uchun aktiv tab ko'rinadigan joyga suriladi
(function () {
    'use strict';
    const MOBILE = window.matchMedia('(max-width: 900px)');
    const ICONS = {
        home: '<path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>',
        leads: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
        students: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
        calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
        sales: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
        close: '<path d="M18 6L6 18M6 6l12 12"/>'
    };
    const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

    // Har bir rol uchun pastki panel. `sales` = Sotuv bo'limining ichki tabi.
    const NAV = {
        sales_manager: [
            { id: 'home', label: 'Bosh', icon: 'home', tab: 'dashboard' },
            { id: 'leads', label: 'Lidlar', icon: 'leads', tab: 'sales', sales: 'leads' },
            { id: 'rating', label: 'Reyting', icon: 'trophy', tab: 'sales', sales: 'rating' },
            { id: 'students', label: 'Oʻquvchilar', icon: 'students', tab: 'students' }
        ],
        rop: [
            { id: 'home', label: 'Bosh', icon: 'home', tab: 'dashboard' },
            { id: 'leads', label: 'Lidlar', icon: 'leads', tab: 'sales', sales: 'leads' },
            { id: 'rating', label: 'Reyting', icon: 'trophy', tab: 'sales', sales: 'rating' },
            { id: 'students', label: 'Oʻquvchilar', icon: 'students', tab: 'students' }
        ],
        teacher: [
            { id: 'home', label: 'Bosh', icon: 'home', tab: 'dashboard' },
            { id: 'academic', label: 'Davomat', icon: 'check', tab: 'teachers-section' },
            { id: 'students', label: 'Oʻquvchilar', icon: 'students', tab: 'students' },
            { id: 'timetable', label: 'Jadval', icon: 'calendar', tab: 'timetable' }
        ],
        _default: [
            { id: 'home', label: 'Bosh', icon: 'home', tab: 'dashboard' },
            { id: 'sales', label: 'Sotuv', icon: 'sales', tab: 'sales', sales: 'leads' },
            { id: 'students', label: 'Oʻquvchilar', icon: 'students', tab: 'students' },
            { id: 'timetable', label: 'Jadval', icon: 'calendar', tab: 'timetable' }
        ]
    };

    function currentUser() {
        try { return typeof getCurrentUser === 'function' ? getCurrentUser() : JSON.parse(localStorage.getItem('mh_currentUser') || 'null'); }
        catch { return null; }
    }
    function tabAllowed(tab) {
        const item = document.querySelector(`#sidebarMenu [data-tab="${tab}"]`);
        return !item || item.style.display !== 'none';
    }

    let _activeTab = 'dashboard';
    function navItems() {
        const role = currentUser()?.role;
        return (NAV[role] || NAV._default).filter(i => tabAllowed(i.tab));
    }
    function activeSales() {
        return document.querySelector('#salesSectionNav .section-nav-item.active')?.dataset.salesSection || 'leads';
    }
    function syncBottomNav() {
        const bar = document.getElementById('teamBottomNav');
        if (!bar) return;
        const sales = activeSales();
        const sidebarOpen = document.body.classList.contains('sidebar-open');
        let matched = false;
        bar.querySelectorAll('[data-tn]').forEach(btn => {
            const item = navItems().find(i => i.id === btn.dataset.tn);
            const on = !sidebarOpen && !!item && item.tab === _activeTab && (!item.sales || item.sales === sales
                || (item.id === 'sales' && _activeTab === 'sales'));
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-current', on ? 'page' : 'false');
            if (on) matched = true;
        });
        const more = bar.querySelector('[data-tn-more]');
        if (more) more.classList.toggle('active', sidebarOpen || !matched);
    }
    function buildBottomNav() {
        if (document.getElementById('teamBottomNav')) return;
        const items = navItems();
        if (!items.length) return;
        const bar = document.createElement('nav');
        bar.id = 'teamBottomNav';
        bar.className = 'team-bottom-nav';
        bar.setAttribute('aria-label', 'Asosiy boʻlimlar');
        bar.innerHTML = items.map(i => `<button type="button" data-tn="${i.id}">${svg(i.icon)}<span>${i.label}</span></button>`).join('')
            + `<button type="button" data-tn-more>${svg('menu')}<span>Menyu</span></button>`;
        bar.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.hasAttribute('data-tn-more')) { document.getElementById('sidebarToggle')?.click(); return; }
            const item = items.find(i => i.id === btn.dataset.tn);
            if (!item || typeof switchTab !== 'function') return;
            if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarToggle')?.click();
            switchTab(item.tab, item.sales ? { salesSection: item.sales } : {});
            if (item.sales && typeof switchSalesSection === 'function') switchSalesSection(item.sales);
            document.querySelector('.content-layout, .main-content')?.scrollTo?.({ top: 0 });
            syncBottomNav();
        });
        document.body.appendChild(bar);
        document.body.classList.add('has-team-nav');
        // Pastki panelda bor bo'limlar Sotuvning yuqori tablarida takrorlanmasin.
        items.filter(i => i.sales && i.id !== 'sales').forEach(i => document.body.classList.add('team-nav-' + i.sales));
        syncBottomNav();
    }

    // Qidiruv: telefonda faqat ikonka, bosilganda header ichida ochiladi.
    function buildSearchToggle() {
        const header = document.querySelector('.top-header');
        const actions = header?.querySelector('.header-actions');
        if (!header || !actions || document.getElementById('teamSearchToggle')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'teamSearchToggle';
        btn.className = 'icon-btn team-search-toggle';
        btn.setAttribute('aria-label', 'Lid qidirish');
        btn.innerHTML = svg('search');
        actions.prepend(btn);
        btn.addEventListener('click', () => {
            const open = header.classList.toggle('team-search-open');
            btn.innerHTML = svg(open ? 'close' : 'search');
            btn.setAttribute('aria-label', open ? 'Qidiruvni yopish' : 'Lid qidirish');
            const input = document.getElementById('globalSearch');
            if (open && input) { input.removeAttribute('readonly'); input.focus(); }
        });
    }

    // Telefonda yuqori panel chap tomonida: logo (Bosh sahifa) yoki bo'lim nomi.
    const TITLES = {
        sales: 'Sotuv', marketing: 'Marketing', students: 'Oʻquvchilar', finance: 'Moliya', hr: 'Xodimlar',
        analitika: 'Analitika', 'teachers-section': 'Akademik boʻlim', timetable: 'Dars jadvali',
        'trial-lessons': 'Sinov darslari', guides: 'Yoʻriqnomalar', 'student-app': 'Mobil ilova', profile: 'Profil'
    };
    function syncTitle() {
        const header = document.querySelector('.top-header');
        if (!header) return;
        let el = header.querySelector('.team-title');
        if (!el) {
            el = document.createElement('div');
            el.className = 'team-title';
            header.querySelector('.lead-search-box')?.before(el);
        }
        const title = TITLES[_activeTab] || (_activeTab === 'dashboard' ? 'Bosh sahifa' : '');
        const html = title ? `<h1>${title}</h1>` : '<img src="images/myhomework-logo.png" alt="Homework">';
        if (el._sig !== html) { el._sig = html; el.innerHTML = html; }
    }

    // Kanban kompyuterda o'ngga davom etsa, chetida soya ko'rinadi.
    function markOverflow(board) {
        if (!board) return;
        const more = board.scrollWidth - board.clientWidth - board.scrollLeft > 8;
        board.parentElement.classList.toggle('team-more-right', more);
        if (!board._teamOv) {
            board._teamOv = true;
            board.addEventListener('scroll', () => markOverflow(board), { passive: true });
        }
    }

    // Lidlar kanbani telefonda: bosqich chiplari, har bir ustun ekran kengligida.
    function enhanceBoard(board) {
        if (!board) return;
        const cols = [...board.querySelectorAll(':scope > .lead-column')];
        let strip = board.parentElement.querySelector(':scope > .team-stage-strip');
        if (!cols.length) { strip?.remove(); return; }
        if (!strip) {
            strip = document.createElement('div');
            strip.className = 'team-stage-strip';
            strip.setAttribute('role', 'tablist');
            strip.setAttribute('aria-label', 'Bosqichlar');
            board.parentElement.insertBefore(strip, board);
            strip.addEventListener('click', e => {
                const chip = e.target.closest('[data-stage]');
                const col = chip && board.querySelectorAll(':scope > .lead-column')[Number(chip.dataset.stage)];
                if (col) board.scrollTo({ left: board.scrollLeft + col.getBoundingClientRect().left - board.getBoundingClientRect().left, behavior: 'smooth' });
            });
            board.addEventListener('scroll', () => markActiveStage(board, strip), { passive: true });
        }
        const html = cols.map((c, i) => {
            const titleEl = c.querySelector('.lead-column-title');
            const title = titleEl?.textContent.trim() || '';
            const count = c.querySelector('.lead-column-count')?.textContent.trim() || '0';
            const accent = c.style.getPropertyValue('--col-accent') || titleEl?.style.color || 'var(--primary)';
            return `<button type="button" role="tab" data-stage="${i}" data-status="${c.dataset.status || ''}" style="--chip-accent:${accent}"><span>${title}</span><b>${count}</b></button>`;
        }).join('');
        // Faqat o'zgarganda qayta chiziladi (MutationObserver aylanib qolmasin).
        if (strip._sig !== html) {
            strip._sig = html;
            strip.innerHTML = html;
            markActiveStage(board, strip);
        }
    }
    function markActiveStage(board, strip) {
        const cols = [...board.querySelectorAll(':scope > .lead-column')];
        const base = board.getBoundingClientRect().left + 24;
        let active = 0;
        cols.forEach((c, i) => { if (c.getBoundingClientRect().left <= base) active = i; });
        strip.querySelectorAll('[data-stage]').forEach(chip => {
            const on = Number(chip.dataset.stage) === active;
            chip.classList.toggle('active', on);
            chip.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on && MOBILE.matches) {
                const left = strip.scrollLeft + chip.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - chip.clientWidth) / 2;
                strip.scrollTo({ left, behavior: 'smooth' });
            }
        });
    }

    // Kartochkada: telefon raqami bosilsa qo'ng'iroq, 0 ta izoh xira.
    function enhanceCards(root) {
        root.querySelectorAll('.lead-card-contact:not([data-tel]) > span').forEach(span => {
            const wrap = span.parentElement;
            wrap.dataset.tel = '1';
            const digits = span.textContent.replace(/[^\d+]/g, '');
            if (digits.length < 9) return;
            const a = document.createElement('a');
            a.href = 'tel:' + digits;
            a.className = 'lead-card-tel';
            a.textContent = span.textContent;
            a.addEventListener('click', e => e.stopPropagation());
            span.replaceWith(a);
            // Telefonda kartaning pastida aniq "Qo'ng'iroq" tugmasi (birinchi raqamga).
            const card = wrap.closest('.lead-card');
            const actions = card?.querySelector('.lead-card-actions');
            if (actions && !actions.querySelector('.lead-card-call')) {
                const call = document.createElement('a');
                call.href = 'tel:' + digits;
                call.className = 'lead-card-call';
                call.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>Qoʻngʻiroq';
                call.addEventListener('click', e => e.stopPropagation());
                actions.appendChild(call);
            }
        });
        root.querySelectorAll('.lead-card-action[data-lead-comments], .lead-card-action--rec').forEach(btn => {
            const s = btn.querySelector('span');
            const zero = !s || s.textContent.trim() === '0' || s.textContent.trim() === '';
            if (btn.classList.contains('is-zero') !== zero) btn.classList.toggle('is-zero', zero);
        });
        const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
        root.querySelectorAll('.lead-card-time:not([data-team-d])').forEach(el => {
            const m = el.textContent.trim().match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
            el.dataset.teamD = '1';
            if (!m) return;
            el.title = el.textContent.trim();
            el.textContent = `${Number(m[3])}-${MON[Number(m[2]) - 1]}${Number(m[1]) !== new Date().getFullYear() ? ' ' + m[1] : ''}${m[4]}`;
        });
    }

    // Sana maydonlari: brauzer formatidan qat'i nazar kk.oo.yyyy ko'rsatiladi.
    function enhanceDates(root) {
        root.querySelectorAll('input[type="date"]:not([data-team-date])').forEach(input => {
            input.dataset.teamDate = '1';
            const wrap = document.createElement('span');
            wrap.className = 'team-date';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);
            const face = document.createElement('span');
            face.className = 'team-date-face';
            face.setAttribute('aria-hidden', 'true');
            wrap.appendChild(face);
            const paint = () => {
                const v = input.value;
                face.textContent = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('.') : 'kk.oo.yyyy';
                wrap.classList.toggle('is-empty', !v);
            };
            input.addEventListener('input', paint);
            input.addEventListener('change', paint);
            wrap.addEventListener('click', () => { try { input.showPicker?.(); } catch { /* ruxsat yo'q */ } });
            paint();
        });
    }

    // Aktiv ichki tab gorizontal panelda ko'rinmay qolmasin.
    function revealActiveSubtab(root) {
        root.querySelectorAll('.section-nav').forEach(nav => {
            const a = nav.querySelector('.section-nav-item.active');
            nav.classList.toggle('team-scrolls', nav.scrollWidth > nav.clientWidth + 4);
            // Aktiv tab ko'rinmay qolgan bo'lsagina suriladi, chapda 16px joy qoldirib.
            if (a && nav.scrollWidth > nav.clientWidth && nav._teamFor !== a) {
                nav._teamFor = a;
                const nr = nav.getBoundingClientRect(), ar = a.getBoundingClientRect();
                if (ar.left < nr.left || ar.right > nr.right - 28) {
                    nav.scrollTo({ left: Math.max(0, nav.scrollLeft + ar.left - nr.left - 16), behavior: 'smooth' });
                }
            }
        });
    }

    let _pending = false;
    function schedule() {
        if (_pending) return;
        _pending = true;
        requestAnimationFrame(() => {
            _pending = false;
            const board = document.getElementById('leadsKanban');
            ['leadsKanban', 'bookRoadmapKanban', 'hrVacBoard', 'shopDeliveryKanban'].forEach(id => enhanceBoard(document.getElementById(id)));
            markOverflow(board);
            syncTitle();
            enhanceCards(document);
            enhanceDates(document);
            revealActiveSubtab(document);
            syncBottomNav();
        });
    }

    function init() {
        const user = currentUser();
        if (user?.role) document.body.dataset.role = user.role;
        buildSearchToggle();
        // Sidebar ruxsatlari applyRoleBasedAccess'dan keyin aniq bo'ladi.
        const tryNav = (n = 0) => {
            const ready = document.querySelector('#sidebarMenu .menu-item[style*="display: none"]') || n > 20;
            if (ready || ['admin', 'boshliq'].includes(user?.role)) buildBottomNav();
            else setTimeout(() => tryNav(n + 1), 150);
        };
        tryNav();
        if (typeof window.switchTab === 'function' && !window.switchTab._team) {
            const orig = window.switchTab;
            window.switchTab = function (tab, ctx) {
                _activeTab = tab === 'leads' ? 'sales' : tab;
                const r = orig.apply(this, arguments);
                schedule();
                return r;
            };
            window.switchTab._team = true;
        }
        const active = document.querySelector('#sidebarMenu .menu-item.active');
        if (active?.dataset.tab) _activeTab = active.dataset.tab;
        new MutationObserver(schedule).observe(document.querySelector('.main-area') || document.body, { childList: true, subtree: true });
        new MutationObserver(syncBottomNav).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('click', e => { if (e.target.closest('.section-nav-item')) schedule(); });
        schedule();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
    else setTimeout(init, 0);
})();
