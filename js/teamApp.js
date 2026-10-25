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
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
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
            { id: 'plan', label: 'Rejam', icon: 'target', tab: 'sales', sales: 'sales-plan' }
        ],
        rop: [
            { id: 'home', label: 'Bosh', icon: 'home', tab: 'dashboard' },
            { id: 'leads', label: 'Lidlar', icon: 'leads', tab: 'sales', sales: 'leads' },
            { id: 'rating', label: 'Reyting', icon: 'trophy', tab: 'sales', sales: 'rating' },
            { id: 'students', label: 'Oʻquvchilar', icon: 'students', tab: 'students' }
        ],
        teacher: [
            { id: 'home', label: 'Bosh', icon: 'home', tab: 'dashboard' },
            { id: 'academic', label: 'Akademik', icon: 'check', tab: 'teachers-section' },
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
        const navSales = navItems().some(i => i.sales === sales && i.id !== 'sales');
        if (document.body.classList.contains('team-on-navpage') !== navSales) document.body.classList.toggle('team-on-navpage', navSales);
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
        if (more) more.classList.toggle('active', sidebarOpen);
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
        buildSalesSubLinks(items);
        syncBottomNav();
    }

    // Telefonda: Sotuvning pastki panelda yo'q bo'limlari Menyu (sidebar) ichida ro'yxat bo'lib turadi.
    function buildSalesSubLinks(items) {
        const salesItem = document.querySelector('#sidebarMenu .menu-item[data-tab="sales"]');
        if (!salesItem || document.getElementById('teamSalesSub')) return;
        if (salesItem.style.display === 'none') return;
        const inNav = new Set(items.filter(i => i.sales).map(i => i.sales));
        const subs = [...document.querySelectorAll('#salesSectionNav .section-nav-item')]
            .filter(b => !inNav.has(b.dataset.salesSection) && b.style.display !== 'none' && !b.hidden);
        if (!subs.length) return;
        const box = document.createElement('div');
        box.id = 'teamSalesSub';
        box.className = 'team-sales-sub';
        box.innerHTML = subs.map(b => `<a href="#" data-team-sales="${b.dataset.salesSection}">${b.textContent.trim()}</a>`).join('');
        salesItem.after(box);
        box.addEventListener('click', e => {
            const a = e.target.closest('[data-team-sales]');
            if (!a) return;
            e.preventDefault();
            document.getElementById('sidebarToggle')?.click();
            switchTab('sales', { salesSection: a.dataset.teamSales });
            switchSalesSection(a.dataset.teamSales);
            schedule();
        });
    }

    // Menyu (sidebar) tepasida profil qatori — telefonda yuqori panelda avatar yo'q.
    function buildDrawerProfile() {
        const side = document.getElementById('sidebar');
        const brand = side?.querySelector('.sidebar-brand');
        if (!brand || document.getElementById('teamDrawerProfile')) return;
        const u = currentUser() || {};
        const roles = { admin: 'Administrator', boshliq: 'Rahbar', rop: 'ROP', sales_manager: 'Sotuv menejeri', teacher: 'Ustoz', targetolog: 'Targetolog' };
        const initials = String(u.name || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
        const el = document.createElement('button');
        el.type = 'button';
        el.id = 'teamDrawerProfile';
        el.className = 'team-drawer-profile';
        el.innerHTML = `<span class="team-drawer-ava">${initials}</span><span><b></b><small>${roles[u.role] || ''} · Profil</small></span>`;
        el.querySelector('b').textContent = u.name || '';
        brand.after(el);
        el.addEventListener('click', () => {
            document.getElementById('sidebarToggle')?.click();
            document.getElementById('userAvatar')?.click();
        });
    }

    // Qidiruv: telefonda faqat ikonka, bosilganda header ichida ochiladi.
    function buildSearchToggle() {
        // Lid qidiruvi faqat Sotuv bo'limiga kirishi bor rollarda.
        const salesItem = document.querySelector('#sidebarMenu .menu-item[data-tab="sales"]');
        if (salesItem && salesItem.style.display === 'none') {
            document.body.classList.add('team-no-lead-search');
            return;
        }
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
        sales: 'Sotuv', marketing: 'Marketing', students: 'Oʻquvchilar', finance: 'Moliya', hr: 'HR boʻlimi',
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
        const SALES_TITLES = { leads: 'Lidlar', 'book-roadmap': 'Kitob yetkazish', rating: 'Reyting', 'sales-stats': 'Statistika', scripts: 'Skriptlar', 'sales-plan': 'Sotuv rejasi', debtors: 'Qarzdorlar' };
        // Bosh sahifada salomlashuv bor — yuqorida logo turadi.
        const title = (_activeTab === 'sales' && SALES_TITLES[activeSales()]) || TITLES[_activeTab] || (_activeTab === 'dashboard' ? 'Bosh sahifa' : '');
        const html = title ? `<h1>${title}</h1>` : '<img src="images/myhomework-logo.png" alt="Homework">';
        if (el._sig !== html) { el._sig = html; el.innerHTML = html; }
    }

    // Kanban kompyuterda o'ngga davom etsa, chetida soya ko'rinadi.
    function markOverflow(board) {
        if (!board) return;
        const more = board.scrollWidth - board.clientWidth - board.scrollLeft > 8;
        const less = board.scrollLeft > 8;
        const host = board.parentElement;
        if (host.classList.contains('team-more-right') !== more) host.classList.toggle('team-more-right', more);
        if (host.classList.contains('team-more-left') !== less) host.classList.toggle('team-more-left', less);
        if (!host.querySelector(':scope > .team-scroll-btn')) {
            [['prev', -1, 'M15 18l-6-6 6-6', 'Oldingi ustunlar'], ['next', 1, 'M9 18l6-6-6-6', 'Keyingi ustunlar']].forEach(([cls, dir, d, label]) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `team-scroll-btn team-scroll-btn--${cls}`;
                btn.setAttribute('aria-label', label);
                btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
                btn.addEventListener('click', () => board.scrollBy({ left: dir * 280, behavior: 'smooth' }));
                host.appendChild(btn);
            });
        }
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

    // Oy tanlagich (type=month): "Oktabr 2026" — brauzer tilidan qat'i nazar.
    const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    function enhanceMonths(root) {
        root.querySelectorAll('input[type="month"]:not([data-team-date])').forEach(input => {
            input.dataset.teamDate = '1';
            const wrap = document.createElement('span');
            wrap.className = 'team-date team-month';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);
            const face = document.createElement('span');
            face.className = 'team-date-face';
            face.setAttribute('aria-hidden', 'true');
            wrap.appendChild(face);
            const paint = () => {
                const m = /^(\d{4})-(\d{2})$/.exec(input.value || '');
                face.textContent = m ? `${UZ_MONTHS[Number(m[2]) - 1]} ${m[1]}` : 'Oyni tanlang';
                wrap.classList.toggle('is-empty', !m);
            };
            input.addEventListener('input', paint);
            input.addEventListener('change', paint);
            wrap.addEventListener('click', () => { try { input.showPicker?.(); } catch { /* ruxsat yo'q */ } });
            // Dastur qiymatni JS orqali o'zgartirsa ham yuz yangilansin
            const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            Object.defineProperty(input, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); paint(); } });
            paint();
        });
    }

    // Texnik xato matni o'rniga tushunarli holat + "Qayta urinish".
    function enhanceErrors(root) {
        root.querySelectorAll('.tab-content.active div, .tab-content.active p, .tab-content.active span').forEach(el => {
            if (el.dataset.teamErr || el.children.length) return;
            const t = el.textContent.trim();
            if (!/^Yuklashda xatolik/i.test(t)) return;
            el.dataset.teamErr = '1';
            el.title = t;
            el.classList.add('team-err');
            el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span><b>Maʼlumot yuklanmadi</b><small>Internet yoki server bilan bogʻliq. Birozdan soʻng qayta urinib koʻring.</small></span><button type="button" class="mhx-btn">Qayta urinish</button>';
            el.querySelector('button').addEventListener('click', () => { if (typeof switchTab === 'function') switchTab(_activeTab); });
        });
    }

    // Telefonda jadval qatorlari kartaga aylanadi: har katakka ustun nomi yoziladi.
    const CARD_TABLES = '.trial-table, .dbx-table, .sdp-table, .cf-tx-table, .ahx-tbl, #tab-teachers-section table.table, #tab-analitika table.table';
    function enhanceTables(root) {
        root.querySelectorAll(CARD_TABLES).forEach(table => {
            const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim().replace(/\s+/g, ' '));
            if (!heads.length) return;
            const sig = heads.join('|') + ':' + table.tBodies[0]?.rows.length;
            if (table._teamSig === sig) return;
            table._teamSig = sig;
            table.classList.add('team-cards');
            table.querySelectorAll('tbody tr').forEach(tr => {
                [...tr.children].forEach((cell, i) => {
                    if (cell.colSpan > 1) { tr.classList.add('team-row-full'); return; }
                    if (heads[i] && !cell.dataset.label) cell.dataset.label = heads[i];
                });
            });
        });
    }

    // O'quvchi kartochkasi telefonda: bo'sh ("—") qatorlar yashiriladi.
    function enhanceStudentRows(root) {
        root.querySelectorAll('.students-table tr[data-student-row] > td, .students-table tr[data-student-row] > td *').forEach(el => {
            if (el.children.length && el.tagName !== 'TD') return;
            const t = el.textContent.replace(/\s+/g, ' ').trim();
            const empty = !t || /^[—–-]+$/.test(t) || /^(ustoz yoʻq|ustoz yo'q)$/i.test(t) || /^Darslar: ?—/.test(t);
            if (el.classList.contains('team-empty') !== empty) el.classList.toggle('team-empty', empty);
        });
    }

    // Telefonda sahifa ichidagi sarlavha yuqori paneldagi bilan bir xil bo'lsa — yashiriladi.
    function hideDuplicateHeading() {
        const title = document.querySelector('.team-title h1')?.textContent.trim().toLowerCase();
        const page = document.querySelector('.tab-content.active');
        if (!title || !page) return;
        page.querySelectorAll('h1, h2').forEach(h => {
            const dup = h.textContent.trim().toLowerCase() === title && !h.closest('.rd-page-head, .card, .modal');
            if (h.classList.contains('team-dup') !== dup) h.classList.toggle('team-dup', dup);
        });
        // Har qanday o'lchamda: faol ichki tab nomini takrorlovchi sarlavha yashiriladi.
        const norm = t => t.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
        const tab = [...page.querySelectorAll('.section-nav-item.active')].find(b => b.offsetParent);
        const tabText = tab ? norm(tab.textContent) : '';
        page.querySelectorAll('h1, h2').forEach(h => {
            const dup = !!tabText && norm(h.textContent) === tabText && !h.closest('.rd-page-head, .modal, .card-header');
            if (h.classList.contains('team-dup-tab') !== dup) h.classList.toggle('team-dup-tab', dup);
        });
    }

    // Sotuv rejasi (jamoa): telefonda parametrlar yig'iladi, natijalar birinchi ko'rinadi.
    function enhancePlanParams(root) {
        root.querySelectorAll('.sp-params-card:not([data-team-coll])').forEach(card => {
            card.dataset.teamColl = '1';
            const head = card.querySelector('.card-header');
            if (!head) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'team-coll-btn';
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = '<span>Parametrlarni oʻzgartirish</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
            head.appendChild(btn);
            btn.addEventListener('click', () => {
                const open = !card.classList.contains('is-open');
                card.classList.toggle('is-open', open);
                btn.setAttribute('aria-expanded', String(open));
            });
        });
    }

    // Til tanlovi (davomat, jadval) foydalanuvchining o'z yo'nalishidan boshlanadi — bir marta.
    function syncOwnLangTabs(root) {
        const own = typeof getUserOwnLang === 'function' ? getUserOwnLang() : null;
        if (!own) return;
        root.querySelectorAll('#mainAttSubjectTabs, #asstAttSubjectTabs, #ttSubjectTabs').forEach(box => {
            if (box.dataset.teamUserPicked) return;
            if (!box.dataset.teamWatch) {
                box.dataset.teamWatch = '1';
                box.addEventListener('click', e => { if (e.isTrusted) box.dataset.teamUserPicked = '1'; });
            }
            // Tugma bog'langandan keyingina bosamiz (aks holda bosish behuda ketadi)
            const btn = box.querySelector(`.subject-tab[data-subject="${own}"]:not(.active)`);
            if (btn && btn.dataset.bound) btn.click();
        });
    }

    // O'zbekcha tutuq belgilari bir xil ko'rinsin: o' g' → oʻ gʻ, boshqa ' → ʼ (faqat ko'rinadigan matn).
    const APOS_SKIP = 'input, textarea, script, style, [contenteditable], .chat, [class*="chat-"], code, pre';
    function normalizeApostrophes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (/[A-Za-zʻʼ][’'‘`]/.test(n.nodeValue) && !n.parentElement?.closest(APOS_SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        const list = [];
        while (walker.nextNode()) list.push(walker.currentNode);
        list.forEach(n => {
            const v = n.nodeValue.replace(/([oOgG])['’‘`]/g, '$1ʻ').replace(/([A-Za-zʻ])['’`](?=[A-Za-z])/g, '$1ʼ');
            if (v !== n.nodeValue) n.nodeValue = v;
        });
        // Qidiruv maydonlaridagi izoh matni (placeholder) ham bir xil yoziladi.
        root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
            const p = el.getAttribute('placeholder');
            if (!/[A-Za-z][’'‘`]/.test(p)) return;
            const v = p.replace(/([oOgG])['’‘`]/g, '$1ʻ').replace(/([A-Za-zʻ])['’`](?=[A-Za-z])/g, '$1ʼ');
            if (v !== p) el.setAttribute('placeholder', v);
        });
    }

    // Aktiv ichki tab gorizontal panelda ko'rinmay qolmasin.
    function revealActiveSubtab(root) {
        root.querySelectorAll('.section-nav').forEach(nav => {
            const a = nav.querySelector('.section-nav-item.active');
            nav.classList.toggle('team-scrolls', nav.scrollWidth > nav.clientWidth + 4);
            const atEnd = () => nav.classList.toggle('team-nav-end', nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4);
            if (!nav._teamEnd) { nav._teamEnd = true; nav.addEventListener('scroll', atEnd, { passive: true }); }
            atEnd();
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
            enhanceMonths(document);
            enhanceErrors(document);
            enhanceTables(document);
            enhanceStudentRows(document);
            enhancePlanParams(document);
            syncOwnLangTabs(document);
            const area = document.querySelector('.main-area');
            if (area) normalizeApostrophes(area);
            const sb = document.getElementById('sidebar');
            if (sb) normalizeApostrophes(sb);
            hideDuplicateHeading();
            revealActiveSubtab(document);
            syncBottomNav();
        });
    }

    function init() {
        const user = currentUser();
        if (user?.role) document.body.dataset.role = user.role;
        buildDrawerProfile();
        // Sidebar ruxsatlari applyRoleBasedAccess'dan keyin aniq bo'ladi.
        const tryNav = (n = 0) => {
            const ready = document.querySelector('#sidebarMenu .menu-item[style*="display: none"]') || n > 20;
            if (ready || ['admin', 'boshliq'].includes(user?.role)) { buildSearchToggle(); buildBottomNav(); }
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
        // Akademik: sahifa darajasidagi til tanlovi ichki davomat tanlovini ham boshqaradi (bitta joy).
        document.addEventListener('click', e => {
            const pageLang = e.target.closest('[data-teachers-lang]');
            if (!pageLang) return;
            setTimeout(() => {
                document.querySelectorAll('#mainAttSubjectTabs, #asstAttSubjectTabs').forEach(box => {
                    box.querySelector(`.subject-tab[data-subject="${pageLang.dataset.teachersLang}"]:not(.active)`)?.click();
                });
            }, 0);
        });
        schedule();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
    else setTimeout(init, 0);
})();
