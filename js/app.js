// Myhomework.uz — Admin Panel

const TAB_TITLES = {
    dashboard: 'Bosh sahifa',
    timetable: 'Dars jadvali',
    'main-attendance': 'Asosiy ustozlar davomati',
    'assistant-attendance': 'Yordamchi ustoz davomati',
    'teacher-cabinet': 'Ustozlarga kabinet',
    salary: 'Ustozlar maoshi',
    students: "O'quvchilar",
    payments: "To'lovlar",
    sales: "Sotuv bo'limi",
    marketing: "Marketing bo'limi",
    settings: 'Sozlamalar',
    profile: 'Profil',
    placeholder: 'Bo\'lim',
    'student-app': 'O\'quvchi ilovasi',
    'hr-employees': 'Xodimlar',
    'analytics-overview': 'Umumiy ko\'rsatkichlar',
    'analytics-sales': 'Sotuv analitikasi',
    'analytics-teachers': 'Ustozlar samaradorligi'
};

const SALES_SECTIONS = {
    leads: 'Lidlar',
    'book-roadmap': 'Kitob yetkazish',
    rating: 'Reyting',
    'sales-stats': 'Statistika',
    scripts: 'Scrikptlar'
};

const PLACEHOLDER_TITLES = {
    curriculum: "O'quv rejasi",
    'book-roadmap': 'Kitob yetkazish',
    rating: 'Reyting',
    'sales-stats': 'Statistika',
    scripts: 'Scrikptlar',
    'sales-salary': 'Sotuv menejerlari maoshi',
    'other-salary': 'Boshqa maoshlar',
    'hr-employees': "Xodimlar ro'yxati",
    'hr-guides': "Yo'riqnomalar",
    'hr-contracts': 'Shartnomalar',
    'mobile-videos': 'Videodarslar',
    settings: 'Sozlamalar'
};

let _tabContext = { subject: null, placeholder: null, salesSection: 'leads' };
let _profileSection = 'edit';
let _profileUser = null;
let _profileEditing = {};

const ROLE_LABELS = { admin: 'Administrator', teacher: 'Ustoz' };

const PROFILE_NOTIF_KEY = 'mh_profile_notif_prefs';

function getUserInitials(name) {
    return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function syncHeaderAvatar(user) {
    const el = document.getElementById('userAvatar');
    if (!el || !user) return;
    if (user.avatar) {
        el.innerHTML = '';
        const img = document.createElement('img');
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px';
        img.onerror = () => {
            el.textContent = getUserInitials(user.name);
        };
        img.src = user.avatar;
        el.appendChild(img);
    } else {
        el.textContent = getUserInitials(user.name);
    }
}

function initUserUI(currentUser) {
    syncHeaderAvatar(currentUser);
    document.getElementById('welcomeName').textContent = `Xush kelibsiz, ${currentUser.name.split(' ')[0]}!`;

    const headerDateEl = document.getElementById('headerDate');
    if (headerDateEl) {
        headerDateEl.textContent = new Date().toLocaleDateString('uz-UZ', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    document.getElementById('userAvatar').addEventListener('click', () => {
        switchTab('profile');
    });

    applyRoleBasedAccess(currentUser);
}

// To'liq ruxsatli rollar (sidebar cheklovsiz)
const FULL_ACCESS_ROLES = new Set(['admin', 'rop', 'boshliq']);

// Cheklangan rollar uchun ruxsat etilgan tab ro'yxati
const ROLE_TABS = {
    sales_manager: ['dashboard', 'sales', 'students', 'timetable', 'analytics-overview', 'analytics-sales'],
    teacher:       ['dashboard', 'students', 'timetable', 'main-attendance'],
    employee:      ['student-app']
};

function applyRoleBasedAccess(user) {
    const role = user.role;
    const sidebar = document.getElementById('sidebarMenu');
    if (!sidebar) return;

    if (FULL_ACCESS_ROLES.has(role)) {
        // Admin / ROP / Boshliq — hamma narsa ko'rinadi, dashboard qoladi
        sidebar.querySelectorAll('.menu-item, .menu-sub-item, .menu-group').forEach(el => {
            el.style.display = '';
        });
        return;
    }

    const allowed = ROLE_TABS[role] ?? ROLE_TABS.employee;
    const allowedSet = new Set(allowed);

    // Barcha elementlarni yashir (Sozlamalar guruhi bundan mustasno)
    sidebar.querySelectorAll('.menu-item, .menu-sub-item, .menu-group').forEach(el => {
        if (el.id === 'settingsLangGroup' || el.closest('#settingsLangGroup')) return;
        el.style.display = 'none';
    });

    // Ruxsat etilgan to'g'ridan-to'g'ri .menu-item larni ko'rsat
    sidebar.querySelectorAll('.menu-item').forEach(el => {
        if (allowedSet.has(el.dataset.tab)) el.style.display = '';
    });

    // Ruxsat etilgan .menu-sub-item va ularning guruhlarini ko'rsat
    sidebar.querySelectorAll('.menu-sub-item').forEach(el => {
        if (el.classList.contains('lang-sidebar-btn')) return; // Sozlamalar har doim ko'rinadi
        if (!allowedSet.has(el.dataset.tab)) return;
        el.style.display = '';
        const group = el.closest('.menu-group');
        if (group) {
            group.style.display = '';
            group.classList.add('open');
            const toggle = group.querySelector('.menu-group-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }
    });

    // Boshlang'ich tab (rol bo'yicha)
    if (role === 'sales_manager') {
        setTimeout(() => switchTab('sales'), 50);
    } else if (role === 'teacher') {
        setTimeout(() => switchTab('timetable'), 50);
    } else {
        // employee yoki noma'lum rol — mobil ilovaga o'tkazish
        setTimeout(() => switchTab('student-app'), 50);
    }
}

async function bootApp() {
    const currentUser = getCurrentUser();
    if (!currentUser || !getToken()) {
        window.location.href = 'login.html';
        return;
    }

    try {
        await initStorage();
    } catch (err) {
        if (err.status === 401) {
            setCurrentUser(null);
            window.location.href = 'login.html';
            return;
        }
        const main = document.querySelector('.content-main') || document.body;
        main.innerHTML = `<div class="card" style="margin:40px;text-align:center;padding:40px">
            <h2>Server bilan ulanish yo'q</h2>
            <p class="text-muted">Terminalda <code>npm install</code> va <code>npm run dev</code> buyruqlarini ishga tushiring.</p>
            <p class="text-muted">${err.message}</p>
            <a href="login.html" class="btn-primary-sm" style="display:inline-block;margin-top:16px;text-decoration:none">Login sahifasi</a>
        </div>`;
        return;
    }

    // O'qituvchi uchun bog'liq teacher ID ni aniqlash
    if (currentUser.role === 'teacher' && !currentUser.linkedTeacherId) {
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        const linked = teachers.find(t =>
            t.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
        );
        if (linked) {
            currentUser.linkedTeacherId = linked.id;
            setCurrentUser(currentUser);
        }
    }

    // Sotuv menejeri uchun bog'liq manager ID va til yo'nalishini aniqlash
    if (currentUser.role === 'sales_manager' && (!currentUser.linkedManagerId || !currentUser.linkedManagerLang)) {
        const managers = getItem(STORAGE_KEYS.salesManagers, []);
        const linked = managers.find(m =>
            m.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
        );
        if (linked) {
            currentUser.linkedManagerId = linked.id;
            currentUser.linkedManagerLang = linked.lang || 'english';
            setCurrentUser(currentUser);
        }
    }

    setUiLang(getUiLang());
    initUserUI(currentUser);
    renderDashboard();
    renderCalendarWidget();
    startLeadsPolling();

    // Xodim shaxsiy hujjatlarini to'ldirishi haqida eslatma
    if (currentUser.role !== 'admin') {
        const emps = getHrEmployees() || [];
        const emp = emps.find(e => e.login === currentUser.email || e.phone === currentUser.phone);
        if (emp && (!emp.cardNumber || !emp.passportSeries || !emp.pinfl || !emp.address)) {
            showProfileDocsBanner();
        }
    }
}

function showProfileDocsBanner() {
    if (document.getElementById('profileDocsBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'profileDocsBanner';
    banner.className = 'profile-docs-toast';
    banner.innerHTML = `
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Shaxsiy hujjatlaringizni to'ldiring: plastik karta, passport, JSHSHIR, manzil</span>
        <button type="button" id="profileDocsBannerGoBtn">To'ldirish</button>
        <button type="button" id="profileDocsBannerClose" aria-label="Yopish">&times;</button>`;
    document.body.appendChild(banner);
    document.getElementById('profileDocsBannerClose').onclick = () => banner.remove();
    document.getElementById('profileDocsBannerGoBtn').onclick = () => {
        banner.remove();
        // Profile sahifasiga o'tish
        const profileItem = document.querySelector('[data-tab="profile"]');
        if (profileItem) profileItem.click();
        setTimeout(() => {
            const docsCard = document.querySelector('[data-profile-edit="documents"]');
            if (docsCard) docsCard.click();
        }, 400);
    };
}

let _leadsPollTimer = null;

function startLeadsPolling() {
    if (_leadsPollTimer) return;
    _leadsPollTimer = setInterval(async () => {
        try {
            const prev = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
            const prevCount = prev.english.length + prev.russian.length;
            const leads = await refreshLeadsFromApi();
            const newCount = leads.english.length + leads.russian.length;
            if (newCount > prevCount) {
                if (typeof syncNotifications === 'function') syncNotifications();
                if (document.getElementById('tab-sales')?.classList.contains('active')) renderSales();
                if (document.getElementById('tab-dashboard')?.classList.contains('active')) renderDashboard();
                if (typeof renderNotificationPanel === 'function') renderNotificationPanel();
            }
        } catch {
            /* polling xatosini jim o'tkazamiz */
        }
    }, 30000);
}

function isMenuItemActive(el, tab, ctx) {
    if (el.dataset.tab !== tab) return false;
    if (tab === 'placeholder') return el.dataset.placeholder === ctx.placeholder;
    if (el.dataset.subject) return el.dataset.subject === (ctx.subject || '');
    if (ctx.subject && ['leads', 'students', 'timetable'].includes(tab)) return false;
    return true;
}

function updateSidebarActiveState(tab, ctx) {
    document.querySelectorAll('.menu-item, .menu-sub-item').forEach(el => {
        el.classList.toggle('active', isMenuItemActive(el, tab, ctx));
    });
    document.querySelectorAll('.menu-group').forEach(group => {
        if (group.querySelector('.menu-sub-item.active')) group.classList.add('open');
    });
}

function switchTab(tab, ctx = {}) {
    if (tab === 'leads') {
        tab = 'sales';
        ctx.salesSection = ctx.salesSection || 'leads';
    }

    _tabContext = {
        subject: ctx.subject || null,
        placeholder: ctx.placeholder || null,
        salesSection: tab === 'sales' ? (ctx.salesSection || 'leads') : (ctx.salesSection || null)
    };

    updateSidebarActiveState(tab, _tabContext);

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.classList.add('active');
    document.getElementById('rightPanel').classList.toggle('hidden', tab !== 'dashboard');
    if (tab === 'profile') _profileEditing = {};
    renderTab(tab);
}

function switchSalesSection(section) {
    _tabContext.salesSection = section;
    document.querySelectorAll('.section-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.salesSection === section);
    });
    document.querySelectorAll('.sales-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.salesPanel === section);
    });
    const leadsFiltersBar = document.getElementById('leadsFiltersBar');
    const addLeadBtn = document.getElementById('addLeadBtn');
    const bookRoadmapFiltersBar = document.getElementById('bookRoadmapFiltersBar');
    const addBookRoadmapHeaderBtn = document.getElementById('addBookRoadmapHeaderBtn');
    if (leadsFiltersBar) leadsFiltersBar.hidden = section !== 'leads';
    if (addLeadBtn) addLeadBtn.hidden = section !== 'leads';
    if (bookRoadmapFiltersBar) bookRoadmapFiltersBar.hidden = section !== 'book-roadmap';
    if (addBookRoadmapHeaderBtn) addBookRoadmapHeaderBtn.hidden = section !== 'book-roadmap';
    syncLeadsLangTabs();
    if (section === 'leads') renderLeads();
    if (section === 'book-roadmap') renderBookRoadmap();
}

function syncLeadsLangTabs() {
    document.querySelectorAll('[data-lead-lang-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.leadLangFilter === _leadsLangFilter);
    });
}

function initSidebarMenu() {
    document.querySelectorAll('.menu-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.menu-group');
            const isOpen = group.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (btn.dataset.openTab) switchTab(btn.dataset.openTab);
        });
    });

    document.querySelectorAll('.menu-item, .menu-sub-item').forEach(item => {
        if (item.classList.contains('lang-sidebar-btn')) return;
        item.addEventListener('click', e => {
            e.preventDefault();
            const tab = item.dataset.tab;
            if (!tab) return;
            switchTab(tab, {
                subject: item.dataset.subject || null,
                placeholder: item.dataset.placeholder || null,
                salesSection: tab === 'sales' ? 'leads' : null
            });
        });
    });

    document.querySelectorAll('[data-sales-section]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!document.getElementById('tab-sales')?.classList.contains('active')) {
                switchTab('sales', { salesSection: btn.dataset.salesSection });
            } else {
                switchSalesSection(btn.dataset.salesSection);
            }
        });
    });

    // Sozlamalar sidebar — til tugmalari
    function updateSidebarLangActive(lang) {
        document.querySelectorAll('.lang-sidebar-btn').forEach(b => {
            b.classList.toggle('menu-sub-item--active', b.dataset.lang === lang);
        });
    }

    document.querySelectorAll('.lang-sidebar-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const lang = btn.dataset.lang;
            setUiLang(lang);
            updateSidebarLangActive(lang);
            showMiniToast(`✓ ${LANG_LABELS[lang] || lang} tili tanlandi`);
        });
    });

    updateSidebarLangActive(localStorage.getItem('mh_ui_lang') || 'uz');
}

initSidebarMenu();

function initMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggle = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');
    const mq = window.matchMedia('(max-width: 900px)');

    function closeSidebar() {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('visible');
        document.body.classList.remove('sidebar-open');
        toggle?.setAttribute('aria-expanded', 'false');
        backdrop?.setAttribute('aria-hidden', 'true');
    }

    function openSidebar() {
        sidebar?.classList.add('open');
        backdrop?.classList.add('visible');
        document.body.classList.add('sidebar-open');
        toggle?.setAttribute('aria-expanded', 'true');
        backdrop?.setAttribute('aria-hidden', 'false');
    }

    toggle?.addEventListener('click', () => {
        if (sidebar?.classList.contains('open')) closeSidebar();
        else openSidebar();
    });

    closeBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeSidebar();
    });

    window.addEventListener('resize', () => {
        if (!mq.matches) closeSidebar();
    });

    document.querySelectorAll('.menu-item, .menu-sub-item').forEach(item => {
        if (item.classList.contains('lang-sidebar-btn')) return;
        item.addEventListener('click', () => {
            if (mq.matches) closeSidebar();
        });
    });
}

initMobileSidebar();

document.querySelectorAll('[data-goto]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        switchTab(link.dataset.goto, {
            subject: link.dataset.subject || null
        });
    });
});

function renderTab(tab) {
    switch (tab) {
        case 'dashboard': renderDashboard(); break;
        case 'timetable': renderTimetable(); break;
        case 'main-attendance': renderMainAttendance(); break;
        case 'assistant-attendance': renderAssistantAttendance(); break;
        case 'teacher-cabinet': renderTeacherCabinet(); break;
        case 'salary': renderSalary(); break;
        case 'students': renderStudents(); break;
        case 'payments': renderPayments(); break;
        case 'sales': renderSales(); break;
        case 'marketing': break;
        case 'settings': break;
        case 'analytics-overview':
        case 'analytics-sales':
        case 'analytics-teachers': break;
        case 'profile': renderProfile(); break;
        case 'placeholder': renderPlaceholder(); break;
        case 'student-app': renderStudentApp(); break;
        case 'hr-employees': renderHrEmployees(); break;
    }
    if (typeof renderNotificationPanel === 'function') renderNotificationPanel();
}

function renderPlaceholder() {
    const key = _tabContext.placeholder || 'curriculum';
    const title = PLACEHOLDER_TITLES[key] || 'Bo\'lim';
    document.getElementById('placeholderTitle').textContent = title;
    document.getElementById('placeholderHeading').textContent = title;
}

function renderStudentApp() {
    const frame = document.getElementById('studentAppFrame');
    if (!frame) return;
    frame.src = `/student/?v=${Date.now()}`;
}

// --- Profile ---
function getProfileNotifPrefs() {
    try {
        const raw = localStorage.getItem(PROFILE_NOTIF_KEY);
        return raw ? JSON.parse(raw) : { email: true, leads: true, payments: true, homework: false };
    } catch {
        return { email: true, leads: true, payments: true, homework: false };
    }
}

function saveProfileNotifPrefs(prefs) {
    localStorage.setItem(PROFILE_NOTIF_KEY, JSON.stringify(prefs));
}

function calcProfileCompletion(user) {
    const checks = [
        { key: 'account', label: 'Akkaunt yaratildi', weight: 10, done: true },
        { key: 'photo', label: 'Rasm yuklash', weight: 10, done: !!user.avatar },
        { key: 'personal', label: 'Shaxsiy ma\'lumotlar', weight: 20, done: !!(user.name && user.email) },
        { key: 'phone', label: 'Telefon raqami', weight: 15, done: !!user.phone },
        { key: 'location', label: 'Manzil', weight: 20, done: !!user.location },
        { key: 'bio', label: 'Bio', weight: 15, done: !!user.bio },
        { key: 'notif', label: 'Bildirishnomalar', weight: 10, done: true }
    ];
    const total = checks.reduce((s, c) => s + (c.done ? c.weight : 0), 0);
    return { checks, total };
}

const LANG_KEY = 'mh_ui_lang';
const LANG_LABELS = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

function showMiniToast(msg, durationMs = 2000) {
    let el = document.getElementById('miniToast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'miniToast';
        el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f8fafc;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:500;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none;transition:opacity .2s';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, durationMs);
}

function getUiLang() {
    return localStorage.getItem(LANG_KEY) || 'uz';
}

function setUiLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang === 'ru' ? 'ru' : lang === 'en' ? 'en' : 'uz';
}

function renderSettings() {
    const current = getUiLang();
    const container = document.getElementById('langOptions');
    const msg = document.getElementById('langSavedMsg');
    if (!container) return;

    container.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('lang-btn--active', btn.dataset.lang === current);
    });

    if (container.dataset.bound) return;
    container.dataset.bound = '1';

    container.addEventListener('click', e => {
        const btn = e.target.closest('.lang-btn');
        if (!btn) return;
        const lang = btn.dataset.lang;
        setUiLang(lang);
        container.querySelectorAll('.lang-btn').forEach(b => {
            b.classList.toggle('lang-btn--active', b.dataset.lang === lang);
        });
        if (msg) {
            msg.textContent = `✓ ${LANG_LABELS[lang] || lang} tili tanlandi`;
            msg.classList.add('lang-saved-msg--visible');
            clearTimeout(msg._t);
            msg._t = setTimeout(() => msg.classList.remove('lang-saved-msg--visible'), 2500);
        }
    });
}

function renderProfileSalarySection(user) {
    const emps = getHrEmployees() || [];
    const emp = emps.find(e => e.login === user.email || e.phone === user.phone) || {};

    // Karta raqami formatlash
    const rawCard = (emp.cardNumber || '').replace(/\s/g, '');
    const maskedCard = rawCard.length >= 4
        ? '**** **** **** ' + rawCard.slice(-4)
        : '•••• •••• •••• ••••';
    const displayCard = rawCard.length >= 4
        ? (rawCard.match(/.{1,4}/g)?.join(' ') || rawCard)
        : null;

    // Ismning bosh harflari avatar uchun
    const initials = user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const cardName = (emp.firstName && emp.lastName)
        ? `${emp.firstName} ${emp.lastName}`.toUpperCase()
        : user.name.toUpperCase();

    // Salary ma'lumotlari (HR dan)
    const salary = emp.salary || null;
    const salaryAmount = salary?.current || 0;
    const fmtUZS = n => n.toLocaleString('uz-UZ') + ' so\'m';

    // Oxirgi 6 oy tarixi
    const now = new Date();
    const history = salary?.history || [];
    const months = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Des'];
    const last6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const record = history.find(h => h.month === key);
        return { label: months[d.getMonth()], key, amount: record?.amount || 0, status: record?.status || 'pending', paidAt: record?.paidAt || null };
    });
    const maxAmount = Math.max(...last6.map(m => m.amount), salaryAmount, 1);

    const chartBars = last6.map((m, i) => {
        const h = Math.round((m.amount / maxAmount) * 100);
        const isLast = i === 5;
        return `<div class="sal-chart-bar-wrap" title="${m.label}: ${fmtUZS(m.amount)}">
            <div class="sal-chart-bar${isLast ? ' sal-chart-bar--current' : ''}" style="height:${h || 4}%"></div>
            <span class="sal-chart-label">${m.label}</span>
        </div>`;
    }).join('');

    const historyRows = last6.slice().reverse().map(m => `
        <div class="sal-history-row">
            <div class="sal-history-dot sal-history-dot--${m.status}"></div>
            <div class="sal-history-info">
                <span class="sal-history-month">${m.label} ${m.key?.slice(0,4) || ''}</span>
                <span class="sal-history-status">${m.status === 'paid' ? 'To\'langan' : m.status === 'pending' ? 'Kutilmoqda' : 'Bekor'}</span>
            </div>
            <span class="sal-history-amount">${m.amount ? fmtUZS(m.amount) : '—'}</span>
        </div>`).join('');

    return `
    <div class="sal-page">
        <div class="sal-header">
            <div>
                <h1 class="sal-header-title">Mening maoshim</h1>
                <p class="sal-header-sub">Xush kelibsiz, ${escapeHtml(user.name.split(' ')[0])} 👋</p>
            </div>
        </div>

        <div class="sal-grid">

            <!-- Chap ustun: statistika -->
            <div class="sal-col sal-col--left">

                <div class="sal-stats-row">
                    <div class="sal-stat-card sal-stat-card--earn">
                        <div class="sal-stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        </div>
                        <div>
                            <div class="sal-stat-label">Joriy maosh</div>
                            <div class="sal-stat-value">${salaryAmount ? fmtUZS(salaryAmount) : '—'}</div>
                        </div>
                    </div>
                    <div class="sal-stat-card sal-stat-card--total">
                        <div class="sal-stat-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                        </div>
                        <div>
                            <div class="sal-stat-label">Yil davomida</div>
                            <div class="sal-stat-value">${fmtUZS(history.filter(h=>h.status==='paid').reduce((s,h)=>s+h.amount,0))}</div>
                        </div>
                    </div>
                </div>

                <div class="sal-chart-card">
                    <div class="sal-chart-header">
                        <h3>Maosh statistikasi</h3>
                        <span class="sal-chart-period">Oxirgi 6 oy</span>
                    </div>
                    <div class="sal-chart">
                        ${chartBars}
                    </div>
                </div>

                <div class="sal-history-card">
                    <div class="sal-chart-header">
                        <h3>To'lov tarixi</h3>
                    </div>
                    <div class="sal-history-list">
                        ${historyRows || '<p class="text-muted" style="padding:16px;text-align:center;font-size:13px">To\'lov tarixi yo\'q</p>'}
                    </div>
                </div>

            </div>

            <!-- O'rta ustun: karta -->
            <div class="sal-col sal-col--mid">

                <div class="sal-section-title">Mening kartam</div>

                <div class="sal-card-3d">
                    <div class="sal-card-inner">
                        <!-- Old yuz -->
                        <div class="sal-card-face sal-card-front">
                            <div class="sal-card-top-row">
                                <div class="sal-card-chip">
                                    <div class="sal-chip-lines"></div>
                                </div>
                                <svg class="sal-card-wave" viewBox="0 0 40 30" fill="none">
                                    <path d="M5 15 Q10 5 15 15 Q20 25 25 15 Q30 5 35 15" stroke="rgba(255,255,255,0.5)" stroke-width="2" fill="none"/>
                                </svg>
                            </div>
                            <div class="sal-card-number">${displayCard ? escapeHtml(displayCard) : '•••• •••• •••• ••••'}</div>
                            <div class="sal-card-bottom-row">
                                <div>
                                    <div class="sal-card-field-label">Karta egasi</div>
                                    <div class="sal-card-field-val">${escapeHtml(cardName.slice(0,22))}</div>
                                </div>
                                <div>
                                    <div class="sal-card-field-label">Muddati</div>
                                    <div class="sal-card-field-val">••/••</div>
                                </div>
                                <svg class="sal-card-logo" viewBox="0 0 50 30" fill="none">
                                    <circle cx="18" cy="15" r="13" fill="rgba(255,255,255,0.25)"/>
                                    <circle cx="32" cy="15" r="13" fill="rgba(255,255,255,0.15)"/>
                                </svg>
                            </div>
                            <div class="sal-card-shimmer"></div>
                        </div>
                    </div>
                </div>

                <!-- Karta ma'lumotlari -->
                <div class="sal-card-info-card">
                    <div class="sal-card-info-header">
                        <h3>Karta ma'lumotlari</h3>
                        ${emp.cardNumber ? '' : `<span class="sal-card-info-warn">To'ldirilmagan</span>`}
                    </div>
                    <div class="sal-card-info-grid">
                        <div class="sal-card-info-item">
                            <label>Karta raqami</label>
                            <span>${emp.cardNumber ? escapeHtml(maskedCard) : '<span class="text-muted">Kiritilmagan</span>'}</span>
                        </div>
                        <div class="sal-card-info-item">
                            <label>Karta egasi</label>
                            <span>${escapeHtml(cardName)}</span>
                        </div>
                        <div class="sal-card-info-item">
                            <label>Passport seriyasi</label>
                            <span>${emp.passportSeries ? escapeHtml(emp.passportSeries) : '<span class="text-muted">Kiritilmagan</span>'}</span>
                        </div>
                        <div class="sal-card-info-item">
                            <label>JSHSHIR (PINFL)</label>
                            <span>${emp.pinfl ? escapeHtml(emp.pinfl) : '<span class="text-muted">Kiritilmagan</span>'}</span>
                        </div>
                    </div>
                    ${!emp.cardNumber ? `<button type="button" class="btn-primary-sm" style="margin-top:12px;width:100%" data-profile-section-go="edit">Ma'lumotlarni to'ldirish</button>` : ''}
                </div>

            </div>

            <!-- O'ng ustun: profil + umumiy -->
            <div class="sal-col sal-col--right">

                <div class="sal-profile-card">
                    <div class="sal-profile-avatar" id="salProfileAvatar">
                        ${user.avatar
                            ? `<img id="salProfileAvatarImg" alt="${escapeHtml(user.name)}">`
                            : `<span>${escapeHtml(initials)}</span>`}
                    </div>
                    <div class="sal-profile-info">
                        <div class="sal-profile-name">${escapeHtml(user.name)}</div>
                        <div class="sal-profile-role">${ROLE_LABELS[user.role] || user.role}</div>
                    </div>
                    <svg class="sal-profile-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                <div class="sal-balance-card">
                    <div class="sal-balance-label">Yillik jami maosh</div>
                    <div class="sal-balance-amount">${fmtUZS(history.filter(h=>h.status==='paid').reduce((s,h)=>s+h.amount,0))}</div>
                    ${salaryAmount ? `<div class="sal-balance-sub">Joriy: ${fmtUZS(salaryAmount)} / oy</div>` : ''}
                </div>

                <div class="sal-notice-card">
                    <div class="sal-notice-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div>
                        <div class="sal-notice-title">Maosh ma'lumotlari</div>
                        <div class="sal-notice-text">Maosh miqdori va to'lov tarixi admin tomonidan kiritiladi. Savollar bo'lsa HR bilan bog'laning.</div>
                    </div>
                </div>

            </div>

        </div>
    </div>`;
}

function renderProfileCompletionWidget(user) {
    const { checks, total } = calcProfileCompletion(user);
    const circumference = 2 * Math.PI * 38;
    const offset = circumference - (total / 100) * circumference;
    const listHtml = checks.map(c => `
        <li class="${c.done ? 'done' : ''}">
            <span class="profile-check-icon ${c.done ? 'done' : 'todo'}">${c.done ? '✓' : '○'}</span>
            <span>${c.label}</span>
            <span class="check-pct">${c.done ? c.weight + '%' : '+' + c.weight + '%'}</span>
        </li>`).join('');
    return `
        <aside class="profile-completion-card">
            <h3>Profilni to'ldiring</h3>
            <div class="profile-ring">
                <div class="ring-chart">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#F0F2F8" stroke-width="10"/>
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#7B61FF" stroke-width="10"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
                    </svg>
                    <div class="ring-value">${total}%</div>
                </div>
            </div>
            <ul class="profile-checklist">${listHtml}</ul>
        </aside>`;
}

function profileCardHeader(title, fieldKey) {
    const editing = _profileEditing[fieldKey];
    if (editing) {
        return `<div class="profile-card-header">
            <h3>${title}</h3>
            <button type="button" class="profile-edit-btn" data-profile-cancel="${fieldKey}">Bekor qilish</button>
        </div>`;
    }
    return `<div class="profile-card-header">
        <h3>${title}</h3>
        <button type="button" class="profile-edit-btn" data-profile-edit="${fieldKey}">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Tahrirlash
        </button>
    </div>`;
}

function renderProfileEditSection(user) {
    const personalEditing = _profileEditing.personal;
    const locationEditing = _profileEditing.location;
    const bioEditing = _profileEditing.bio;
    const docsEditing = _profileEditing.documents;

    // Avatar placeholder — src ni keyinroq DOM API orqali o'rnatamiz (escaping muammosidan himoya)
    const avatarContent = user.avatar
        ? `<img id="profileAvatarImg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : getUserInitials(user.name);

    const personalBody = personalEditing ? `
        <div class="profile-field-form">
            <div class="form-group" style="flex:1;min-width:180px">
                <label>Ism familiya</label>
                <input type="text" id="profileName" class="form-control" value="${escapeHtml(user.name)}">
            </div>
            <div class="form-group" style="flex:1;min-width:180px">
                <label>Email</label>
                <input type="email" id="profileEmail" class="form-control" value="${escapeHtml(user.email)}">
            </div>
            <div class="form-group" style="flex:1;min-width:180px">
                <label>Telefon</label>
                <input type="tel" id="profilePhone" class="form-control" value="${escapeHtml(user.phone || '')}" placeholder="+998 90 123 45 67">
            </div>
            <div class="profile-save-row" style="width:100%">
                <button type="button" class="btn-primary-sm" data-profile-save="personal">Saqlash</button>
            </div>
        </div>` : `
        <div class="profile-info-grid">
            <div class="profile-info-item"><label>Ism familiya</label><span>${escapeHtml(user.name)}</span></div>
            <div class="profile-info-item"><label>Email</label><span>${escapeHtml(user.email)}</span></div>
            <div class="profile-info-item"><label>Telefon</label><span>${user.phone ? escapeHtml(user.phone) : '<span class="text-muted">Kiritilmagan</span>'}</span></div>
        </div>
        <div class="profile-info-grid" style="margin-top:16px">
            <div class="profile-info-item"><label>Rol</label><span class="role-badge">${ROLE_LABELS[user.role] || user.role}</span></div>
            <div class="profile-info-item"><label>Ro'yxatdan o'tgan</label><span>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('uz-UZ') : '—'}</span></div>
        </div>`;

    const locationBody = locationEditing ? `
        <div class="profile-field-form">
            <div class="form-group" style="flex:1">
                <label>Shahar / viloyat</label>
                <input type="text" id="profileLocation" class="form-control" value="${escapeHtml(user.location || '')}" placeholder="Masalan: Toshkent">
            </div>
            <div class="profile-save-row">
                <button type="button" class="btn-primary-sm" data-profile-save="location">Saqlash</button>
            </div>
        </div>` : `
        <p style="font-size:15px;font-weight:600;color:var(--text)">${user.location ? escapeHtml(user.location) : '<span class="text-muted">Manzil kiritilmagan</span>'}</p>`;

    const bioBody = bioEditing ? `
        <div class="profile-field-form" style="flex-direction:column">
            <div class="form-group" style="width:100%">
                <label>Bio</label>
                <textarea id="profileBio" class="form-control" placeholder="O'zingiz haqingizda qisqacha yozing...">${escapeHtml(user.bio || '')}</textarea>
            </div>
            <div class="profile-save-row">
                <button type="button" class="btn-primary-sm" data-profile-save="bio">Saqlash</button>
            </div>
        </div>` : `
        <p style="font-size:14px;line-height:1.7;color:var(--text-muted)">${user.bio ? escapeHtml(user.bio).replace(/\n/g, '<br>') : 'Bio hali yozilmagan. O\'zingiz haqingizda qisqacha ma\'lumot qo\'shing.'}</p>`;

    // Shaxsiy hujjatlar (admin bo'lmagan xodimlar uchun)
    const empRecord = user.role !== 'admin' ? (() => {
        const emps = getHrEmployees() || [];
        return emps.find(e => e.login === user.email || e.phone === user.phone || e.id === user.hrId) || null;
    })() : null;

    const docsCard = empRecord ? (() => {
        const incomplete = !empRecord.cardNumber || !empRecord.passportSeries || !empRecord.pinfl || !empRecord.address;
        if (docsEditing) {
            return `<div class="profile-card">
                ${profileCardHeader('Shaxsiy hujjatlar', 'documents')}
                <div class="profile-field-form" style="flex-direction:column;gap:10px">
                    <div class="form-group" style="width:100%">
                        <label>Plastik karta raqami</label>
                        <input type="text" id="docCardNumber" class="form-control" value="${escapeHtml(empRecord.cardNumber || '')}" placeholder="0000 0000 0000 0000" maxlength="19">
                    </div>
                    <div style="display:flex;gap:10px">
                        <div class="form-group" style="flex:1">
                            <label>Passport seriyasi</label>
                            <input type="text" id="docPassportSeries" class="form-control" value="${escapeHtml(empRecord.passportSeries || '')}" placeholder="AA1234567" maxlength="9">
                        </div>
                        <div class="form-group" style="flex:1">
                            <label>JSHSHIR (PINFL)</label>
                            <input type="text" id="docPinfl" class="form-control" value="${escapeHtml(empRecord.pinfl || '')}" placeholder="14 xonali raqam" maxlength="14">
                        </div>
                    </div>
                    <div class="form-group" style="width:100%">
                        <label>Yashash manzili</label>
                        <input type="text" id="docAddress" class="form-control" value="${escapeHtml(empRecord.address || '')}" placeholder="Viloyat, tuman, ko'cha, uy">
                    </div>
                    <div class="profile-save-row" style="width:100%">
                        <button type="button" class="btn-danger-sm" data-profile-cancel="documents">Bekor qilish</button>
                        <button type="button" class="btn-primary-sm" data-profile-save="documents">Saqlash</button>
                    </div>
                </div>
            </div>`;
        }
        const val = v => v ? `<span>${escapeHtml(v)}</span>` : `<span class="text-muted">Kiritilmagan</span>`;
        return `<div class="profile-card">
            ${profileCardHeader('Shaxsiy hujjatlar', 'documents')}
            ${incomplete ? `<div class="profile-docs-banner"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Ba'zi ma'lumotlar to'ldirilmagan</div>` : ''}
            <div class="profile-info-grid">
                <div class="profile-info-item"><label>Plastik karta</label>${val(empRecord.cardNumber)}</div>
                <div class="profile-info-item"><label>Passport seriyasi</label>${val(empRecord.passportSeries)}</div>
                <div class="profile-info-item"><label>JSHSHIR (PINFL)</label>${val(empRecord.pinfl)}</div>
                <div class="profile-info-item profile-info-item--full"><label>Yashash manzili</label>${val(empRecord.address)}</div>
            </div>
        </div>`;
    })() : '';

    return `
        <div class="profile-header-bar">
            <h1>Profilni tahrirlash</h1>
            <p>Shaxsiy ma'lumotlaringizni yangilang va profilingizni to'ldiring</p>
        </div>
        <div class="profile-grid">
            <div class="profile-cards">
                <div class="profile-card">
                    <div class="profile-avatar-section">
                        <div class="profile-avatar-large" id="profileAvatarPreview">${avatarContent}</div>
                        <div class="profile-avatar-actions">
                            <h4>Yangi rasm yuklash</h4>
                            <input type="file" id="profileAvatarInput" accept="image/jpeg,image/png,image/webp" hidden>
                            <button type="button" class="btn-primary-sm" id="profileAvatarBtn">Rasm tanlash</button>
                            ${user.avatar ? '<button type="button" class="btn-danger-sm" id="profileAvatarRemove" style="margin-left:8px">O\'chirish</button>' : ''}
                            <p>Kamida 400×400 px tavsiya etiladi. JPG, PNG yoki WebP formatlari qabul qilinadi.</p>
                        </div>
                    </div>
                </div>
                <div class="profile-card">
                    ${profileCardHeader('Shaxsiy ma\'lumotlar', 'personal')}
                    ${personalBody}
                </div>
                <div class="profile-card">
                    ${profileCardHeader('Manzil', 'location')}
                    ${locationBody}
                </div>
                <div class="profile-card">
                    ${profileCardHeader('Bio', 'bio')}
                    ${bioBody}
                </div>
                ${docsCard}
            </div>
            ${renderProfileCompletionWidget(user)}
        </div>`;
}

function renderProfileSecuritySection() {
    return `
        <div class="profile-header-bar">
            <h1>Parolni o'zgartirish</h1>
            <p>Hisobingiz xavfsizligi uchun vaqti-vaqti bilan parolni yangilang</p>
        </div>
        <div class="profile-cards" style="max-width:520px">
            <div class="profile-card">
                <div class="form-group">
                    <label>Joriy parol</label>
                    <input type="password" id="profileCurrentPwd" class="form-control" autocomplete="current-password">
                </div>
                <div class="form-group">
                    <label>Yangi parol</label>
                    <input type="password" id="profileNewPwd" class="form-control" autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label>Yangi parolni tasdiqlang</label>
                    <input type="password" id="profileConfirmPwd" class="form-control" autocomplete="new-password">
                </div>
                <button type="button" class="btn-primary-sm" id="profileChangePwdBtn">Parolni yangilash</button>
            </div>
        </div>`;
}

function renderProfileNotificationsSection() {
    const prefs = getProfileNotifPrefs();
    const rows = [
        { key: 'email', title: 'Email bildirishnomalar', desc: 'Muhim yangiliklar email orqali yuboriladi' },
        { key: 'leads', title: 'Yangi lidlar', desc: 'Yangi organik lid kelganda xabar berish' },
        { key: 'payments', title: "To'lovlar", desc: "To'lov va qarzdorlik haqida ogohlantirish" },
        { key: 'homework', title: 'Uy vazifalari', desc: "O'quvchilar uy vazifasi topshirganda" }
    ];
    const rowsHtml = rows.map(r => `
        <div class="profile-toggle-row">
            <div class="profile-toggle-info">
                <h4>${r.title}</h4>
                <p>${r.desc}</p>
            </div>
            <label class="profile-toggle">
                <input type="checkbox" data-notif-pref="${r.key}" ${prefs[r.key] ? 'checked' : ''}>
                <span class="profile-toggle-slider"></span>
            </label>
        </div>`).join('');
    return `
        <div class="profile-header-bar">
            <h1>Bildirishnomalar</h1>
            <p>Qaysi hodisalar haqida xabar olishni tanlang</p>
        </div>
        <div class="profile-cards" style="max-width:560px">
            <div class="profile-card">${rowsHtml}</div>
        </div>`;
}

function parseSessionDevice(ua) {
    if (!ua) return { label: 'Noma\'lum qurilma', icon: '💻' };
    const s = ua.toLowerCase();
    const isMobile = /iphone|android.*mobile|mobile/i.test(ua);
    const isTablet = /ipad|android(?!.*mobile)/i.test(ua);
    let os = 'Noma\'lum OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/iphone/i.test(ua)) os = 'iPhone';
    else if (/ipad/i.test(ua)) os = 'iPad';
    else if (/mac os x|macos/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/linux/i.test(ua)) os = 'Linux';
    let browser = 'Brauzer';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/opr\//i.test(ua)) browser = 'Opera';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';
    const icon = isMobile || isTablet ? '📱' : '💻';
    return { label: `${browser} — ${os}`, icon };
}

function renderProfileSessionsSection() {
    return `
        <div class="profile-header-bar">
            <h1>Faol sessiyalar</h1>
            <p>Hisobingizga ulangan qurilmalar</p>
        </div>
        <div id="sessionsListWrap">
            <div class="profile-cards" style="max-width:600px">
                <div class="profile-card" style="text-align:center;padding:24px;color:#888">Yuklanmoqda...</div>
            </div>
        </div>`;
}

async function loadAndRenderSessions() {
    const wrap = document.getElementById('sessionsListWrap');
    if (!wrap) return;
    try {
        const { sessions } = await apiGetSessions();
        if (!sessions.length) {
            wrap.innerHTML = '<div class="profile-cards" style="max-width:600px"><div class="profile-card" style="padding:24px;color:#888">Faol sessiyalar topilmadi</div></div>';
            return;
        }
        const othersCount = sessions.filter(s => !s.isCurrent).length;
        wrap.innerHTML = `
            <div class="profile-cards" style="max-width:600px">
                ${sessions.map(s => {
                    const dev = parseSessionDevice(s.userAgent);
                    const lastSeen = s.lastSeen ? new Date(s.lastSeen).toLocaleString('uz-UZ') : '—';
                    const created = s.createdAt ? new Date(s.createdAt).toLocaleString('uz-UZ') : '—';
                    return `
                    <div class="profile-card profile-session-card" data-session-id="${escapeHtml(s.id)}">
                        <div class="profile-session-item">
                            <div class="profile-session-icon">${dev.icon}</div>
                            <div class="profile-session-info">
                                <strong>${escapeHtml(dev.label)}</strong>
                                <span>Kirdi: ${created}</span>
                                <span>Oxirgi faollik: ${lastSeen}</span>
                                ${s.ip ? `<span>IP: ${escapeHtml(s.ip)}</span>` : ''}
                            </div>
                            ${s.isCurrent
                                ? '<span class="profile-session-badge">Joriy</span>'
                                : `<button type="button" class="btn-danger-sm session-terminate-btn" data-session-id="${escapeHtml(s.id)}">Tugatish</button>`
                            }
                        </div>
                    </div>`;
                }).join('')}
                ${othersCount > 1 ? `
                <div style="margin-top:8px">
                    <button type="button" class="btn-danger-sm" id="terminateAllOthersBtn">Boshqa barcha sessiyalarni tugatish (${othersCount} ta)</button>
                </div>` : ''}
            </div>`;

        wrap.querySelectorAll('.session-terminate-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = '...';
                try {
                    await apiDeleteSession(btn.dataset.sessionId);
                    btn.closest('.profile-session-card').remove();
                    showNotification('Muvaffaqiyatli', 'Sessiya tugatildi', 'success');
                    const remaining = wrap.querySelectorAll('.session-terminate-btn').length;
                    if (remaining <= 1) {
                        const allBtn = document.getElementById('terminateAllOthersBtn');
                        if (allBtn) allBtn.remove();
                    }
                } catch (err) {
                    showNotification('Xatolik', err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Tugatish';
                }
            });
        });

        const allBtn = document.getElementById('terminateAllOthersBtn');
        if (allBtn) {
            allBtn.addEventListener('click', async () => {
                allBtn.disabled = true;
                try {
                    await apiDeleteOtherSessions();
                    showNotification('Muvaffaqiyatli', 'Boshqa sessiyalar tugatildi', 'success');
                    await loadAndRenderSessions();
                } catch (err) {
                    showNotification('Xatolik', err.message, 'error');
                    allBtn.disabled = false;
                }
            });
        }
    } catch (err) {
        wrap.innerHTML = `<div class="profile-cards" style="max-width:600px"><div class="profile-card" style="padding:24px;color:var(--danger)">${escapeHtml(err.message)}</div></div>`;
    }
}

function bindProfileEvents() {
    const body = document.getElementById('profileBody');
    if (!body) return;

    // Avatar img src ni DOM API orqali o'rnatamiz (innerHTML escaping muammosidan himoya)
    const _u = _profileUser || getCurrentUser();
    const avatarImg = document.getElementById('profileAvatarImg');
    if (avatarImg && _u?.avatar) {
        avatarImg.onerror = () => {
            const preview = document.getElementById('profileAvatarPreview');
            if (preview) preview.innerHTML = getUserInitials(_u.name);
            apiUpdateProfile({ avatar: '' }).catch(() => {});
        };
        avatarImg.src = _u.avatar;
    }
    const salAvatarImg = document.getElementById('salProfileAvatarImg');
    if (salAvatarImg && _u?.avatar) {
        salAvatarImg.onerror = () => {
            const wrap = document.getElementById('salProfileAvatar');
            if (wrap) wrap.innerHTML = `<span>${getUserInitials(_u.name)}</span>`;
        };
        salAvatarImg.src = _u.avatar;
    }

    body.querySelectorAll('[data-profile-section-go]').forEach(btn => {
        btn.addEventListener('click', () => switchProfileSection(btn.dataset.profileSectionGo));
    });

    body.querySelectorAll('[data-profile-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
            _profileEditing[btn.dataset.profileEdit] = true;
            renderProfileBody();
        });
    });

    body.querySelectorAll('[data-profile-cancel]').forEach(btn => {
        btn.addEventListener('click', () => {
            delete _profileEditing[btn.dataset.profileCancel];
            renderProfileBody();
        });
    });

    body.querySelectorAll('[data-profile-save]').forEach(btn => {
        btn.addEventListener('click', () => saveProfileField(btn.dataset.profileSave));
    });

    const avatarBtn = document.getElementById('profileAvatarBtn');
    const avatarInput = document.getElementById('profileAvatarInput');
    if (avatarBtn && avatarInput) {
        avatarBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', handleProfileAvatarUpload);
    }

    const removeBtn = document.getElementById('profileAvatarRemove');
    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            try {
                _profileUser = await apiUpdateProfile({ avatar: '' });
                setCurrentUser(_profileUser);
                syncHeaderAvatar(_profileUser);
                renderProfileBody();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    body.querySelectorAll('[data-notif-pref]').forEach(input => {
        input.addEventListener('change', () => {
            const prefs = getProfileNotifPrefs();
            prefs[input.dataset.notifPref] = input.checked;
            saveProfileNotifPrefs(prefs);
        });
    });

    const pwdBtn = document.getElementById('profileChangePwdBtn');
    if (pwdBtn) {
        pwdBtn.addEventListener('click', handleProfilePasswordChange);
    }

    // Karta raqami avtomatik formatlash: xxxx xxxx xxxx xxxx
    const cardInput = document.getElementById('docCardNumber');
    if (cardInput) {
        cardInput.addEventListener('input', () => {
            let v = cardInput.value.replace(/\D/g, '').slice(0, 16);
            cardInput.value = v.match(/.{1,4}/g)?.join(' ') || v;
        });
    }
}

async function saveProfileField(field) {
    const user = _profileUser || getCurrentUser();
    const payload = {};
    if (field === 'personal') {
        payload.name = document.getElementById('profileName')?.value.trim();
        payload.email = document.getElementById('profileEmail')?.value.trim();
        payload.phone = document.getElementById('profilePhone')?.value.trim();
        if (!payload.name || !payload.email) {
            alert('Ism va email to\'ldirilishi shart');
            return;
        }
    } else if (field === 'location') {
        payload.location = document.getElementById('profileLocation')?.value.trim();
    } else if (field === 'bio') {
        payload.bio = document.getElementById('profileBio')?.value.trim();
    } else if (field === 'documents') {
        const user2 = _profileUser || getCurrentUser();
        const emps = getHrEmployees() || [];
        const idx = emps.findIndex(e => e.login === user2.email || e.phone === user2.phone || e.id === user2.hrId);
        if (idx === -1) { alert('Xodim topilmadi'); return; }
        emps[idx] = {
            ...emps[idx],
            cardNumber: document.getElementById('docCardNumber')?.value.trim() || emps[idx].cardNumber,
            passportSeries: document.getElementById('docPassportSeries')?.value.trim() || emps[idx].passportSeries,
            pinfl: document.getElementById('docPinfl')?.value.trim() || emps[idx].pinfl,
            address: document.getElementById('docAddress')?.value.trim() || emps[idx].address
        };
        saveHrEmployees(emps);
        delete _profileEditing[field];
        renderProfileBody();
        return;
    }
    try {
        _profileUser = await apiUpdateProfile(payload);
        setCurrentUser(_profileUser);
        syncHeaderAvatar(_profileUser);
        document.getElementById('welcomeName').textContent = `Xush kelibsiz, ${_profileUser.name.split(' ')[0]}!`;
        delete _profileEditing[field];
        renderProfileBody();
    } catch (err) {
        alert(err.message);
    }
}

function compressAvatarImage(file, maxSize = 400, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) return reject(new Error('Faqat rasm fayllari qabul qilinadi'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Faylni o\'qishda xatolik'));
        reader.onload = e => {
            const img = new Image();
            img.onerror = () => reject(new Error('Rasm formatini o\'qib bo\'lmadi'));
            img.onload = () => {
                const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
                const w = Math.round(img.width * ratio);
                const h = Math.round(img.height * ratio);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleProfileAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
        showNotification('Xatolik', 'Rasm hajmi 20 MB dan oshmasligi kerak', 'error');
        return;
    }
    e.target.value = '';
    let dataUrl;
    try {
        dataUrl = await compressAvatarImage(file);
    } catch (err) {
        showNotification('Xatolik', err.message || 'Rasm o\'qishda xatolik', 'error');
        return;
    }

    // Darhol preview ko'rsatamiz (server javobini kutmasdan)
    const preview = document.getElementById('profileAvatarPreview');
    if (preview) {
        preview.innerHTML = '';
        const previewImg = document.createElement('img');
        previewImg.alt = '';
        previewImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
        previewImg.src = dataUrl;
        preview.appendChild(previewImg);
    }

    try {
        const result = await apiUploadAvatar(dataUrl);
        const user = result?.user;
        if (!user) throw new Error('Server javobida foydalanuvchi ma\'lumoti yo\'q');

        // Agar server avatarini qaytarmasa — lokal data URL ishlatamiz
        if (!user.avatar) user.avatar = dataUrl;

        _profileUser = user;
        setCurrentUser(user);
        syncHeaderAvatar(user);
        renderProfileBody();
        showNotification('Muvaffaqiyatli', 'Profil rasmi yangilandi', 'success');
    } catch (err) {
        // Server xatoligi bo'lsa ham, lokal data URL ni saqlaymiz (offline fallback)
        const currentUser = getCurrentUser();
        if (currentUser) {
            currentUser.avatar = dataUrl;
            setCurrentUser(currentUser);
            syncHeaderAvatar(currentUser);
            if (_profileUser) {
                _profileUser.avatar = dataUrl;
                renderProfileBody();
            }
        }
        showNotification('Xatolik', err.message || 'Server bilan ulanishda xatolik', 'error');
    }
}

async function handleProfilePasswordChange() {
    const current = document.getElementById('profileCurrentPwd')?.value;
    const next = document.getElementById('profileNewPwd')?.value;
    const confirm = document.getElementById('profileConfirmPwd')?.value;
    if (!current || !next) {
        alert('Barcha maydonlarni to\'ldiring');
        return;
    }
    if (next !== confirm) {
        alert('Yangi parollar mos kelmadi');
        return;
    }
    if (next.length < 6) {
        alert('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
        return;
    }
    try {
        await apiChangePassword(current, next);
        alert('Parol muvaffaqiyatli yangilandi');
        document.getElementById('profileCurrentPwd').value = '';
        document.getElementById('profileNewPwd').value = '';
        document.getElementById('profileConfirmPwd').value = '';
    } catch (err) {
        alert(err.message);
    }
}

function renderProfileBody() {
    const body = document.getElementById('profileBody');
    if (!body) return;
    const user = _profileUser || getCurrentUser();
    if (!user) return;

    let html = '';
    switch (_profileSection) {
        case 'edit': html = renderProfileEditSection(user); break;
        case 'salary': html = renderProfileSalarySection(user); break;
        case 'security': html = renderProfileSecuritySection(); break;
        case 'notifications': html = renderProfileNotificationsSection(); break;
        case 'sessions': html = renderProfileSessionsSection(); break;
        default: html = renderProfileEditSection(user);
    }
    body.innerHTML = html;
    bindProfileEvents();
    if (_profileSection === 'sessions') loadAndRenderSessions();
}

function switchProfileSection(section) {
    _profileSection = section;
    _profileEditing = {};
    document.querySelectorAll('[data-profile-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.profileSection === section);
    });
    renderProfileBody();
}

async function renderProfile() {
    try {
        _profileUser = await apiMe();
    } catch {
        _profileUser = getCurrentUser();
    }
    switchProfileSection(_profileSection);
}

function initProfileNav() {
    document.querySelectorAll('[data-profile-section]').forEach(btn => {
        btn.addEventListener('click', () => switchProfileSection(btn.dataset.profileSection));
    });
    const logoutBtn = document.getElementById('profileLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Tizimdan chiqasizmi?')) {
                await apiLogout();
                window.location.href = 'login.html';
            }
        });
    }
}

initProfileNav();

// --- Modal ---
function openModal(title, bodyHtml, footerHtml, options = {}) {
    const overlay = document.getElementById('modalOverlay');
    const modal = overlay?.querySelector('.modal');
    if (modal) modal.classList.toggle('modal--wide', !!options.wide);
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    const modal = overlay?.querySelector('.modal');
    if (modal) modal.classList.remove('modal--wide');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('modal-open');
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
});

// --- Dashboard ---
function renderDashboard() {
    const students = getItem(STORAGE_KEYS.students, []);
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    const organicLeads = [...(leads.english || []), ...(leads.russian || [])].filter(l => (l.leadType || 'organic') === 'organic').length;
    document.getElementById('statStudents').textContent = students.length;
    document.getElementById('statTeachers').textContent = teachers.length;
    document.getElementById('statLeads').textContent = organicLeads;

    renderTeacherCards(teachers, students);
    renderMiniSchedule();
    renderCalendarWidget();
    renderHwProgress(students);
}

function renderTeacherCards(teachers, students) {
    const colors = ['purple', 'yellow', 'pink'];
    const emojis = ['👩‍🏫', '👨‍🏫', '📚'];
    const container = document.getElementById('teacherCourseCards');
    if (!container) return;

    container.innerHTML = teachers.slice(0, 3).map((t, i) => {
        const count = students.filter(s => s.teacherId === t.id).length;
        const pct = count > 0 ? Math.min(100, count * 20) : 0;
        return `<div class="course-card">
            <div class="course-card-top ${colors[i % 3]}">${emojis[i % 3]}</div>
            <div class="course-card-body">
                <h4>${t.name}</h4>
                <p>${t.type === 'asosiy' ? 'Asosiy ustoz' : 'Yordamchi ustoz'}</p>
                <div class="course-meta"><span>👨‍🎓 ${count} o'quvchi</span></div>
                <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
                <div class="progress-text"><span>To'ldirilgan: ${pct}%</span><span>${count} ta</span></div>
            </div>
        </div>`;
    }).join('');
}

function renderMiniSchedule() {
    const container = document.getElementById('miniSchedule');
    if (!container) return;

    const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
    const times = ['08:00', '10:00', '12:00', '14:00'];
    const today = new Date().getDay();
    const events = [
        { day: 1, time: 0, label: 'Ingliz tili', color: 'yellow' },
        { day: 2, time: 1, label: 'Rus tili', color: 'blue' },
        { day: 3, time: 2, label: 'Matematika', color: 'green' },
        { day: 5, time: 3, label: 'Ingliz tili', color: 'pink' },
        { day: 1, time: 2, label: 'Grammatika', color: 'blue' }
    ];

    let html = '<div class="schedule-grid">';
    html += '<div></div>';
    days.forEach((d, i) => {
        html += `<div class="day-header ${i === today ? 'today' : ''}">${d}</div>`;
    });

    times.forEach((time, ti) => {
        html += `<div class="time-label">${time}</div>`;
        for (let di = 0; di < 7; di++) {
            const ev = events.find(e => e.day === di && e.time === ti);
            if (ev) {
                html += `<div class="schedule-event ${ev.color}">${ev.label}</div>`;
            } else {
                html += '<div class="schedule-event empty"></div>';
            }
        }
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderCalendarWidget() {
    const container = document.getElementById('calWeek');
    const title = document.getElementById('calMonthTitle');
    if (!container) return;

    const now = new Date();
    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    if (title) title.textContent = monthNames[now.getMonth()] + ' ' + now.getFullYear();

    const dayNames = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    let html = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const isToday = d.toDateString() === now.toDateString();
        html += `<div class="cal-day ${isToday ? 'active' : ''}">
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-num">${String(d.getDate()).padStart(2, '0')}</div>
        </div>`;
    }
    container.innerHTML = html;

    const pct = Math.min(99, 40 + getItem(STORAGE_KEYS.students, []).length * 8);
    const ring = document.getElementById('growthPct');
    if (ring) ring.textContent = pct + '%';
}

function renderHwProgress(students) {
    const container = document.getElementById('hwProgress');
    if (!container) return;

    const tasks = [
        { title: 'Davomat to\'ldirish', desc: 'Oylik davomat jadvali', pct: students.length > 0 ? 66 : 33 },
        { title: 'To\'lovlarni kiritish', desc: 'Platforma va kitob to\'lovlari', pct: 99 },
        { title: 'Timetable yangilash', desc: 'Haftalik dars jadvali', pct: 45 }
    ];

    container.innerHTML = tasks.map(t => {
        const filled = Math.round(t.pct / 33);
        const segs = [0, 1, 2].map(i => {
            if (i < filled) return '<div class="hw-seg filled"></div>';
            if (i === filled && t.pct % 33 > 0) return '<div class="hw-seg partial"></div>';
            return '<div class="hw-seg"></div>';
        }).join('');
        return `<div class="hw-item"><h5>${t.title}</h5><p>${t.desc}</p><div class="hw-segments">${segs}</div><div class="hw-pct">${t.pct}%</div></div>`;
    }).join('');
}

// --- Timetable (haftalik jadval) ---
let _ttFilters = { lang: 'english', pattern: 'mwf', teacherId: 'all', dayOfWeek: null };

function getLessonSlotSpan(duration) {
    const d = Number(duration) || 15;
    if (d >= 60) return 4;
    if (d >= 30) return 2;
    return 1;
}

function getTimetableCellClass(entry) {
    if (entry.source === 'trial') return 'tt-cell tt-cell--trial';
    if (entry.source === 'lead') return 'tt-cell tt-cell--lead';
    const d = Number(entry.duration) || 15;
    if (d >= 60) return 'tt-cell tt-cell--d60';
    if (d >= 30) return 'tt-cell tt-cell--d30';
    return 'tt-cell tt-cell--d15';
}

function isTimetableStudentCell(cell) {
    return !!cell.dataset.student
        && !cell.classList.contains('tt-cell--free')
        && !cell.classList.contains('tt-cell--lead')
        && !cell.classList.contains('tt-cell--trial');
}

function markWeeklySlotBusy(busy, dayOfWeek, time, duration, meta) {
    const slots = generateTimeSlots();
    const startIdx = slots.indexOf(time);
    if (startIdx < 0) return;
    const span = getLessonSlotSpan(duration);
    for (let i = 0; i < span; i++) {
        const t = slots[startIdx + i];
        if (!t) break;
        busy.set(weeklyLessonSlotKey(dayOfWeek, t), {
            ...meta,
            isStart: i === 0,
            span,
            startTime: time
        });
    }
}

function canFitWeeklyLesson(busy, dayOfWeek, time, duration) {
    const slots = generateTimeSlots();
    const startIdx = slots.indexOf(time);
    if (startIdx < 0) return false;
    const span = getLessonSlotSpan(duration);
    for (let i = 0; i < span; i++) {
        const t = slots[startIdx + i];
        if (!t || busy.has(weeklyLessonSlotKey(dayOfWeek, t))) return false;
    }
    return true;
}

function isWeeklySlotContinuation(busy, dayOfWeek, time) {
    const slots = generateTimeSlots();
    const idx = slots.indexOf(time);
    if (idx <= 0) return false;
    const prev = busy.get(weeklyLessonSlotKey(dayOfWeek, slots[idx - 1]));
    if (!prev || !prev.isStart) return false;
    const span = getLessonSlotSpan(prev.duration);
    const startIdx = slots.indexOf(prev.startTime);
    return idx > startIdx && idx < startIdx + span;
}

function getLeadLessonDuration(lead, teacher) {
    const tariff = lead?.paymentSurvey?.tariff;
    if (tariff) return parseInt(tariff, 10) || 15;
    return teacher?.lessonDuration || 15;
}

function getTimetableFilters() {
    const patternEl = document.getElementById('ttPattern');
    const teacherEl = document.getElementById('ttTeacher');
    const dayEl = document.getElementById('ttDay');
    return {
        lang: getSelectedSubject('ttSubjectTabs'),
        pattern: patternEl?.value || _ttFilters.pattern || 'mwf',
        teacherId: teacherEl?.value || _ttFilters.teacherId || 'all',
        dayOfWeek: dayEl?.value ? parseInt(dayEl.value, 10) : (_ttFilters.dayOfWeek || null)
    };
}

function initTimetableControls() {
    const patternEl = document.getElementById('ttPattern');
    const teacherEl = document.getElementById('ttTeacher');
    const dayEl = document.getElementById('ttDay');
    const btnEdit = document.getElementById('btnEditTeacherSchedule');

    if (!teacherEl) return;

    initSubjectTabs('ttSubjectTabs', () => {
        _ttFilters = getTimetableFilters();
        initTimetableControls();
        renderTimetable();
    });

    const filters = getTimetableFilters();
    const pattern = filters.pattern;

    let teachers = getItem(STORAGE_KEYS.teachers, []).filter(t => t.type === 'asosiy');
    if (filters.lang) {
        teachers = teachers.filter(t => (t.subject || 'english') === filters.lang);
    }

    const currentUser = getCurrentUser();
    const isTeacherRole = currentUser?.role === 'teacher';
    const linkedTeacherId = currentUser?.linkedTeacherId;

    const savedTeacher = isTeacherRole && linkedTeacherId ? linkedTeacherId : teacherEl.value;
    if (isTeacherRole) {
        // O'qituvchi faqat o'zining jadvalini ko'radi — filtrni yashir
        teacherEl.innerHTML = teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        const teacherWrap = teacherEl.closest('.form-group') || teacherEl.parentElement;
        if (teacherWrap) teacherWrap.style.display = 'none';
    } else {
        teacherEl.innerHTML = '<option value="all">Barcha ustozlar</option>' +
            teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        const teacherWrap = teacherEl.closest('.form-group') || teacherEl.parentElement;
        if (teacherWrap) teacherWrap.style.display = '';
    }
    if (savedTeacher && [...teacherEl.options].some(o => o.value === savedTeacher)) {
        teacherEl.value = savedTeacher;
    }

    if (dayEl) {
        dayEl.hidden = true;
    }

    if (!teacherEl.dataset.bound) {
        teacherEl.dataset.bound = '1';
        [patternEl, teacherEl, dayEl].filter(Boolean).forEach(el => {
            el.addEventListener('change', () => {
                _ttFilters = getTimetableFilters();
                if (el === patternEl || el === teacherEl) initTimetableControls();
                renderTimetable();
            });
        });
        if (btnEdit) {
            btnEdit.addEventListener('click', () => {
                openTeacherWorkScheduleModal(teacherEl.value === 'all' ? null : teacherEl.value);
            });
        }
    }
}

function collectWeeklyScheduleEntries(filters) {
    const patternDays = SCHEDULE_PATTERNS[filters.pattern]?.days || [];
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const students = getItem(STORAGE_KEYS.students, []);
    const entries = [];

    students.forEach(s => {
        if (s.lessonDayOfWeek == null || !s.lessonTime) return;
        const teacher = teachers.find(t => t.id === s.teacherId);
        if (!teacher) return;
        if (filters.lang && (s.subject || 'english') !== filters.lang) return;
        if (filters.teacherId !== 'all' && s.teacherId !== filters.teacherId) return;
        const daysList = [1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [1, 3, 5] : [2, 4, 6].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [Number(s.lessonDayOfWeek)];
        daysList.forEach(dow => {
            entries.push({
                studentId: s.id,
                studentName: s.name,
                teacherId: s.teacherId,
                teacherName: teacher.name,
                dayOfWeek: dow,
                time: s.lessonTime,
                duration: s.lessonDuration || teacher.lessonDuration || 15,
                source: s.source === 'lead' ? 'lead' : 'student'
            });
        });
    });

    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    [...(leads.english || []), ...(leads.russian || [])].forEach(lead => {
        const ob = lead.paymentOnboarding;
        if (!ob || ob.lessonDayOfWeek == null || !ob.lessonTime) return;
        const teacher = teachers.find(t => t.id === ob.teacherId);
        if (!teacher) return;
        const lang = lead._lang || lead.language || 'english';
        if (filters.lang && lang !== filters.lang) return;
        if (filters.teacherId !== 'all' && ob.teacherId !== filters.teacherId) return;
        const duration = getLeadLessonDuration(lead, teacher);
        let daysList = [1, 3, 5].includes(Number(ob.lessonDayOfWeek)) ? [1, 3, 5] : [2, 4, 6].includes(Number(ob.lessonDayOfWeek)) ? [2, 4, 6] : [Number(ob.lessonDayOfWeek)];
        if (ob.isTrial && ob.trialDaysCount) {
            const idx = daysList.indexOf(Number(ob.lessonDayOfWeek));
            if (idx >= 0) {
                const reordered = daysList.slice(idx).concat(daysList.slice(0, idx));
                daysList = reordered.slice(0, ob.trialDaysCount);
            }
        }
        daysList.forEach(dow => {
            entries.push({
                studentId: lead.serialCode || lead.id?.slice(0, 6) || 'LID',
                studentName: lead.name,
                teacherId: ob.teacherId,
                teacherName: teacher.name,
                dayOfWeek: dow,
                time: ob.lessonTime,
                duration,
                source: ob.isTrial ? 'trial' : 'lead'
            });
        });
    });

    return entries;
}

function buildScheduleCellMap(entries) {
    const map = new Map();
    const covered = new Set();
    const times = generateTimeSlots();

    entries.forEach(entry => {
        const key = `${entry.teacherId || 'all'}_${entry.dayOfWeek}_${entry.time}`;
        map.set(key, entry);
        const startIdx = times.indexOf(entry.time);
        const span = getLessonSlotSpan(entry.duration);
        for (let i = 1; i < span; i++) {
            covered.add(`${entry.teacherId || 'all'}_${entry.dayOfWeek}_${times[startIdx + i]}`);
        }
    });

    return { map, covered };
}

function renderTimetableTeacherGrid(teacher, entries) {
    const days = [1, 2, 3, 4, 5, 6];
    const times = generateTimeSlots();
    const { map, covered } = buildScheduleCellMap(entries.filter(e => e.teacherId === teacher.id));
    const workSlots = teacher.workSlots ? new Set(teacher.workSlots) : null;

    let html = `<table class="table tt-week-table"><thead><tr><th class="tt-time-col">Vaqt</th>`;
    days.forEach(dow => {
        const isSunday = dow === 7;
        html += `<th${isSunday ? ' style="color:#DC2626"' : ''}>${escapeHtml(DAYS_UZ[dow - 1] || '')}</th>`;
    });
    html += '</tr></thead><tbody>';

    times.forEach(time => {
        html += `<tr><td class="tt-time-col">${time}</td>`;
        days.forEach(dow => {
            const cellKey = `${teacher.id}_${dow}_${time}`;
            if (covered.has(cellKey)) return;
            const entry = map.get(cellKey);
            if (entry) {
                const span = getLessonSlotSpan(entry.duration);
                const cls = getTimetableCellClass(entry);
                html += `<td class="${cls}" rowspan="${span}" data-tt-cell data-teacher="${teacher.id}" data-dow="${dow}" data-time="${time}" data-student="${escapeHtml(entry.studentId)}" title="${escapeHtml(entry.studentName)}">
                    <span class="tt-cell-id">${escapeHtml(entry.studentId)}</span>
                    <span class="tt-cell-name">${escapeHtml(entry.studentName)}</span>
                </td>`;
            } else {
                const key = `${dow}_${time}`;
                const isOff = workSlots && !workSlots.has(key);
                const isSunday = dow === 7;
                if (isOff) {
                    html += `<td class="tt-cell tt-cell--off" data-tt-cell data-teacher="${teacher.id}" data-dow="${dow}" data-time="${time}" title="Ishlashi belgilanmagan"></td>`;
                } else {
                    html += `<td class="tt-cell tt-cell--free${isSunday ? ' tt-cell--sunday' : ''}" data-tt-cell data-teacher="${teacher.id}" data-dow="${dow}" data-time="${time}" title="Bo'sh — bosing"></td>`;
                }
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

function renderTimetableAllTeachersWeek(teachers, entries) {
    let html = '';
    teachers.forEach((teacher, index) => {
        if (index > 0) html += '<div class="tt-teacher-divider"></div>';
        html += `<div class="tt-teacher-block">
            <h4 class="tt-teacher-block-title">${escapeHtml(teacher.name)}</h4>`;
        html += renderTimetableTeacherGrid(teacher, entries);
        html += '</div>';
    });
    return html;
}

function openTimetableAssignModal(teacherId, dayOfWeek, time) {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const busy = getTeacherBusyWeeklySlots(teacherId);
    const duration = teacher.lessonDuration || 15;
    if (!canFitWeeklyLesson(busy, dayOfWeek, time, duration)) {
        alert('Bu vaqt band yoki dars davomiyligi uchun yetarli bo\'sh slot yo\'q');
        return;
    }

    const students = getStudentsForTeacher(teacher);
    const unscheduled = students.filter(s => s.lessonDayOfWeek == null || !s.lessonTime);
    const allStudents = students;

    openModal(
        'Darsga o\'quvchi biriktirish',
        `<div class="form-group">
            <label>O'quvchi</label>
            <select id="ttAssignStudent" class="form-select">
                <option value="">— Tanlang —</option>
                ${allStudents.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.id})${s.lessonTime ? ' — jadvalda' : ''}</option>`).join('')}
            </select>
            ${unscheduled.length === 0 ? '<p class="text-muted" style="margin-top:8px;font-size:12px">Barcha o\'quvchilar jadvalda. Mavjud o\'quvchini tanlasangiz, eski slot almashtiriladi.</p>' : ''}
        </div>
        <div class="form-group">
            <label>Dars davomiyligi (daqiqa)</label>
            <select id="ttAssignDuration" class="form-select">
                <option value="15" ${duration === 15 ? 'selected' : ''}>15 daqiqa</option>
                <option value="30" ${duration === 30 ? 'selected' : ''}>30 daqiqa</option>
                <option value="60" ${duration === 60 ? 'selected' : ''}>60 daqiqa</option>
            </select>
        </div>
        <p class="text-muted" style="font-size:12px">${escapeHtml(DAYS_UZ[dayOfWeek - 1] || '')}, ${time} — ${escapeHtml(teacher.name)}</p>`,
        `<button type="button" class="btn-danger-sm" id="ttAssignCancel">Bekor</button>
         <button type="button" class="btn-primary-sm" id="ttAssignSave">Saqlash</button>`
    );

    document.getElementById('ttAssignCancel').onclick = closeModal;
    document.getElementById('ttAssignSave').onclick = () => {
        const studentId = document.getElementById('ttAssignStudent').value;
        const dur = parseInt(document.getElementById('ttAssignDuration').value, 10) || 15;
        if (!studentId) { alert('O\'quvchini tanlang'); return; }

        if (!canFitWeeklyLesson(getTeacherBusyWeeklySlots(teacherId, studentId), dayOfWeek, time, dur)) {
            alert('Tanlangan davomiylik uchun yetarli bo\'sh vaqt yo\'q');
            return;
        }

        const studentsList = getItem(STORAGE_KEYS.students, []);
        studentsList.forEach(s => {
            if (s.id === studentId) {
                s.lessonDayOfWeek = dayOfWeek;
                s.lessonTime = time;
                s.lessonDuration = dur;
            }
        });
        setItem(STORAGE_KEYS.students, studentsList);
        closeModal();
        renderTimetable();
    };
}

function openTimetableEditModal(teacherId, dayOfWeek, time, studentId) {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const teacher = teachers.find(t => t.id === teacherId);
    const students = getItem(STORAGE_KEYS.students, []);
    const student = students.find(s => s.id === studentId);

    openModal(
        'Dars jadvali',
        `<p><strong>${escapeHtml(student?.name || studentId)}</strong> (${escapeHtml(studentId)})</p>
         <p class="text-muted">${escapeHtml(DAYS_UZ[dayOfWeek - 1] || '')}, ${time} — ${escapeHtml(teacher?.name || '')}</p>`,
        `<button type="button" class="btn-danger-sm" id="ttEditRemove">Olib tashlash</button>
         <button type="button" class="btn-primary-sm" id="ttEditClose">Yopish</button>`
    );

    document.getElementById('ttEditClose').onclick = closeModal;
    document.getElementById('ttEditRemove').onclick = () => {
        if (!student) { closeModal(); return; }
        updateStudent(student.id, { lessonDayOfWeek: null, lessonTime: '', lessonDuration: 15 });
        closeModal();
        renderTimetable();
    };
}

function wireTimetableCells() {
    document.querySelectorAll('#timetableContainer [data-tt-cell]').forEach(cell => {
        cell.addEventListener('click', () => {
            const teacherId = cell.dataset.teacher;
            const dayOfWeek = parseInt(cell.dataset.dow, 10);
            const time = cell.dataset.time;
            const studentId = cell.dataset.student;
            if (cell.classList.contains('tt-cell--free')) {
                openTimetableAssignModal(teacherId, dayOfWeek, time);
            } else if (isTimetableStudentCell(cell)) {
                openTimetableEditModal(teacherId, dayOfWeek, time, studentId);
            }
        });
    });
}

function renderTimetable() {
    initTimetableControls();
    const filters = getTimetableFilters();
    _ttFilters = filters;

    const titleEl = document.getElementById('timetablePageTitle');
    const patternLabel = SCHEDULE_PATTERNS[filters.pattern]?.label || '';
    if (titleEl) {
        titleEl.textContent = `Dars jadvali — ${SUBJECTS[filters.lang]?.label || filters.lang || 'Ingliz tili'}`;
    }

    let teachers = getItem(STORAGE_KEYS.teachers, []).filter(t => t.type === 'asosiy');
    if (filters.lang) teachers = teachers.filter(t => (t.subject || 'english') === filters.lang);

    const entries = collectWeeklyScheduleEntries(filters);
    const container = document.getElementById('timetableContainer');
    if (!container) return;

    if (!teachers.length) {
        container.innerHTML = '<p class="text-muted" style="padding:24px">Tanlangan filtrlarga mos ustoz topilmadi.</p>';
        return;
    }

    let html = '';
    if (filters.teacherId !== 'all') {
        const teacher = teachers.find(t => t.id === filters.teacherId);
        if (!teacher) {
            container.innerHTML = '<p class="text-muted" style="padding:24px">Ustoz topilmadi.</p>';
            return;
        }
        html = `<div class="tt-grid-header"><strong>${escapeHtml(teacher.name)}</strong> · ${escapeHtml(patternLabel)}</div>`;
        html += renderTimetableTeacherGrid(teacher, entries, filters.pattern);
    } else {
        html = `<div class="tt-grid-header"><strong>Barcha ustozlar</strong> · ${escapeHtml(patternLabel)}</div>`;
        html += renderTimetableAllTeachersWeek(teachers, entries, filters.pattern);
    }

    container.innerHTML = html;
    wireTimetableCells();
}

function promoteStudentFromOnboarding(lang, onboarding, lead) {
    if (onboarding.becomeStudent !== 'yes') return;
    const students = getItem(STORAGE_KEYS.students, []);
    const existing = students.find(s =>
        s.name === onboarding.studentFullName && s.teacherId === onboarding.teacherId
    );
    if (existing) {
        updateStudent(existing.id, {
            lessonDayOfWeek: onboarding.lessonDayOfWeek,
            lessonTime: onboarding.lessonTime,
            lessonDuration: onboarding.lessonDuration || 15,
            assistantTeacherId: onboarding.assistantTeacherId || null,
            source: 'lead'
        });
        return existing.id;
    }
    const leadSurvey = lead?.paymentSurvey;
    const duration = leadSurvey?.tariff ? parseInt(leadSurvey.tariff, 10) : 15;
    const id = 's' + Date.now();
    students.push({
        id,
        name: onboarding.studentFullName,
        phone: lead?.phone || '',
        group: onboarding.courseLevelLabel || '',
        subject: lang === 'russian' ? 'russian' : 'english',
        teacherId: onboarding.teacherId,
        assistantTeacherId: onboarding.assistantTeacherId || null,
        lessonDayOfWeek: onboarding.lessonDayOfWeek,
        lessonTime: onboarding.lessonTime,
        lessonDuration: duration,
        source: 'lead'
    });
    setItem(STORAGE_KEYS.students, students);
    return id;
}

function renderKpiSummary(containerId, kpi, teacherName) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let breakdown = '';
    if (kpi.perStudent && kpi.perStudent.length) {
        breakdown = `<div class="kpi-breakdown">
            <div class="kpi-breakdown-title">Har bir o'quvchi bo'yicha (max ${formatMoney(kpi.monthlyBase)} / oy)</div>
            ${kpi.perStudent.map(ps => `
                <div class="kpi-breakdown-row">
                    <span>${ps.name} — <strong>${ps.lessons}</strong>/${kpi.expected} dars</span>
                    <span>${formatMoney(ps.earned)}</span>
                </div>
            `).join('')}
        </div>`;
    }
    el.innerHTML = `
        <div class="kpi-stat"><div class="kpi-num">${kpi.studentCount}</div><div class="kpi-lbl">O'quvchilar</div></div>
        <div class="kpi-stat"><div class="kpi-num">${kpi.expected}</div><div class="kpi-lbl">Reja (har o'quvchi)</div></div>
        <div class="kpi-stat"><div class="kpi-num">${kpi.completed}</div><div class="kpi-lbl">Jami o'tilgan darslar</div></div>
        <div class="kpi-stat"><div class="kpi-num">${formatMoney(Math.round(kpi.perLesson))}</div><div class="kpi-lbl">1 dars narxi</div></div>
        <div class="kpi-stat"><div class="kpi-num">${kpi.kpiPercent}%</div><div class="kpi-lbl">KPI</div></div>
        <div class="kpi-stat"><div class="kpi-num" style="color:var(--success)">${formatMoney(kpi.total)}</div><div class="kpi-lbl">${teacherName || 'Jami'} maoshi</div></div>
        ${breakdown}
    `;
}

function syncTeacherSettings(teacherId, patternSel, durationSel, rerender) {
    const teacher = getItem(STORAGE_KEYS.teachers, []).find(t => t.id === teacherId);
    if (!teacher) return null;
    if (patternSel) {
        patternSel.value = teacher.schedulePattern || 'mwf';
        patternSel.onchange = () => {
            updateTeacher(teacherId, { schedulePattern: patternSel.value });
            rerender();
        };
    }
    if (durationSel) {
        durationSel.value = String(teacher.lessonDuration || 15);
        durationSel.onchange = () => {
            updateTeacher(teacherId, { lessonDuration: parseInt(durationSel.value) });
            rerender();
        };
    }
    return teacher;
}

// --- Fan filtri (Ingliz / Rus) ---
function getSelectedSubject(tabsId) {
    const active = document.querySelector(`#${tabsId} .subject-tab.active`);
    return active?.dataset.subject || 'english';
}

function initSubjectTabs(tabsId, onChange) {
    document.querySelectorAll(`#${tabsId} .subject-tab`).forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            document.querySelectorAll(`#${tabsId} .subject-tab`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange();
        });
    });
}

function updateAttSectionTitle(titleId, subject) {
    const el = document.getElementById(titleId);
    if (el) el.textContent = `${SUBJECTS[subject]?.label || subject} — oylik davomat`;
}

// --- Asosiy ustozlar davomati (o'quvchi davomati) ---
function initMainAttControls() {
    initSubjectTabs('mainAttSubjectTabs', renderMainAttendance);
    const subject = getSelectedSubject('mainAttSubjectTabs');
    const teachers = filterTeachersByTypeAndSubject('asosiy', subject);
    const sel = document.getElementById('mainAttTeacher');
    const month = document.getElementById('mainAttMonth');
    if (!month.value) month.value = getMonthKey(new Date());

    const currentUser = getCurrentUser();
    const isTeacherRole = currentUser?.role === 'teacher';
    const linkedTeacherId = currentUser?.linkedTeacherId;

    const prev = isTeacherRole && linkedTeacherId ? linkedTeacherId : sel.value;
    sel.innerHTML = teachers.length
        ? teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
        : '<option value="">— Ustoz yo\'q —</option>';
    if (prev && teachers.some(t => t.id === prev)) sel.value = prev;
    else if (teachers.length) sel.value = teachers[0].id;

    const selWrap = sel.closest('.form-group') || sel.parentElement;
    if (selWrap) selWrap.style.display = isTeacherRole ? 'none' : '';

    sel.onchange = renderMainAttendance;
    month.onchange = renderMainAttendance;
    updateAttSectionTitle('mainAttTitle', subject);
}

function renderMainAttendance() {
    initMainAttControls();
    const subject = getSelectedSubject('mainAttSubjectTabs');
    const teacherId = document.getElementById('mainAttTeacher').value;
    if (!teacherId) {
        document.getElementById('mainAttendanceContainer').innerHTML =
            `<p class="text-muted">${getSubjectLabel(subject)} bo'yicha asosiy ustozlar yo'q.</p>`;
        document.getElementById('mainAttSummary').innerHTML = '';
        return;
    }
    const monthVal = document.getElementById('mainAttMonth').value;
    const patternSel = document.getElementById('mainAttPattern');
    const durationSel = document.getElementById('mainAttDuration');
    const teacher = syncTeacherSettings(teacherId, patternSel, durationSel, renderMainAttendance);
    if (!teacher) return;

    const [year, month] = monthVal.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const pattern = teacher.schedulePattern || 'mwf';
    const lessonDays = getLessonDaysInMonth(year, month, pattern);
    const students = getItem(STORAGE_KEYS.students, []).filter(s =>
        s.teacherId === teacherId && (s.subject || 'english') === subject
    );
    const attendance = getItem(STORAGE_KEYS.mainAttendance, {});
    const attKey = `${monthVal}_${teacherId}`;
    if (!attendance[attKey]) attendance[attKey] = {};

    let html = '<table class="table attendance-table"><thead><tr>';
    html += '<th class="sticky-col">№</th><th class="sticky-col-2">O\'quvchi</th><th>Telefon</th><th>Darslar</th>';
    for (let d = 1; d <= days; d++) {
        const isLesson = isLessonDay(year, month, d, pattern);
        html += `<th class="att-day ${isLesson ? 'lesson-day-col' : ''}" title="${isLesson ? 'Dars kuni' : ''}">${d}</th>`;
    }
    html += '</tr></thead><tbody>';

    if (!students.length) {
        html += `<tr><td colspan="${days + 4}" class="text-muted">${getSubjectLabel(subject)} — bu ustozga biriktirilgan o'quvchilar yo'q.</td></tr>`;
    }

    students.forEach((s, i) => {
        if (!attendance[attKey][s.id]) attendance[attKey][s.id] = {};
        html += `<tr><td class="sticky-col">${i + 1}</td><td class="sticky-col-2">${s.name}</td><td>${s.phone || '—'}</td><td class="lesson-count" data-student="${s.id}">0</td>`;
        for (let d = 1; d <= days; d++) {
            const marked = attendance[attKey][s.id][d];
            const isLesson = isLessonDay(year, month, d, pattern);
            const disabled = !isLesson ? 'disabled' : '';
            html += `<td class="att-cell ${isLesson ? 'lesson-day-col' : ''} ${marked ? 'att-present' : ''}">
                <input type="checkbox" class="att-check" data-att-key="${attKey}" data-student="${s.id}" data-day="${d}" ${marked ? 'checked' : ''} ${disabled}>
            </td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table>';
    setItem(STORAGE_KEYS.mainAttendance, attendance);
    document.getElementById('mainAttendanceContainer').innerHTML = html;

    const kpi = calculateKpiSalary(teacher, monthVal, attendance, students);
    renderKpiSummary('mainAttSummary', kpi, teacher.name);

    document.querySelectorAll('.att-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const att = getItem(STORAGE_KEYS.mainAttendance, {});
            const k = cb.dataset.attKey;
            const sid = cb.dataset.student;
            const day = cb.dataset.day;
            if (!att[k]) att[k] = {};
            if (!att[k][sid]) att[k][sid] = {};
            if (cb.checked) att[k][sid][day] = 1;
            else delete att[k][sid][day];
            setItem(STORAGE_KEYS.mainAttendance, att);
            renderMainAttendance();
        });
    });

    document.querySelectorAll('.lesson-count').forEach(cell => {
        const sid = cell.dataset.student;
        const att = getItem(STORAGE_KEYS.mainAttendance, {})[attKey]?.[sid] || {};
        const count = lessonDays.filter(d => att[d]).length;
        cell.textContent = count;
    });
}

// --- Yordamchi ustoz davomati ---
function initAsstAttControls() {
    initSubjectTabs('asstAttSubjectTabs', renderAssistantAttendance);
    const subject = getSelectedSubject('asstAttSubjectTabs');
    const teachers = filterTeachersByTypeAndSubject('yordamchi', subject);
    const sel = document.getElementById('asstAttTeacher');
    const month = document.getElementById('asstAttMonth');
    if (!month.value) month.value = getMonthKey(new Date());

    const prev = sel.value;
    sel.innerHTML = teachers.length
        ? teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
        : '<option value="">— Ustoz yo\'q —</option>';
    if (prev && teachers.some(t => t.id === prev)) sel.value = prev;
    else if (teachers.length) sel.value = teachers[0].id;

    sel.onchange = renderAssistantAttendance;
    month.onchange = renderAssistantAttendance;
    updateAttSectionTitle('asstAttTitle', subject);
}

function renderAssistantAttendance() {
    initAsstAttControls();
    const subject = getSelectedSubject('asstAttSubjectTabs');
    const teacherId = document.getElementById('asstAttTeacher').value;
    if (!teacherId) {
        document.getElementById('assistantAttendanceContainer').innerHTML =
            `<p class="text-muted">${getSubjectLabel(subject)} bo'yicha yordamchi ustozlar yo'q. "Ustoz qo'shish" tugmasini bosing.</p>`;
        document.getElementById('asstAttSummary').innerHTML = '';
        return;
    }

    const monthVal = document.getElementById('asstAttMonth').value;
    const patternSel = document.getElementById('asstAttPattern');
    const durationSel = document.getElementById('asstAttDuration');
    const teacher = syncTeacherSettings(teacherId, patternSel, durationSel, renderAssistantAttendance);
    if (!teacher) return;

    const [year, month] = monthVal.split('-').map(Number);
    const days = getDaysInMonth(year, month);
    const pattern = teacher.schedulePattern || 'mwf';
    const lessonDays = getLessonDaysInMonth(year, month, pattern);
    const students = getItem(STORAGE_KEYS.students, []).filter(s =>
        s.assistantTeacherId === teacherId && (s.subject || 'english') === subject
    );
    const attendance = getItem(STORAGE_KEYS.assistantAttendance, {});
    const attKey = `${monthVal}_${teacherId}`;
    if (!attendance[attKey]) attendance[attKey] = {};

    let html = '<table class="table attendance-table"><thead><tr>';
    html += '<th class="sticky-col">№</th><th class="sticky-col-2">O\'quvchi</th><th>Telefon</th><th>Darslar</th>';
    for (let d = 1; d <= days; d++) {
        const isLesson = isLessonDay(year, month, d, pattern);
        html += `<th class="att-day ${isLesson ? 'lesson-day-col' : ''}">${d}</th>`;
    }
    html += '</tr></thead><tbody>';

    if (!students.length) {
        html += `<tr><td colspan="${days + 4}" class="text-muted">${getSubjectLabel(subject)} — bu yordamchi ustozga biriktirilgan o'quvchilar yo'q.</td></tr>`;
    }

    students.forEach((s, i) => {
        if (!attendance[attKey][s.id]) attendance[attKey][s.id] = {};
        html += `<tr><td class="sticky-col">${i + 1}</td><td class="sticky-col-2">${s.name}</td><td>${s.phone || '—'}</td><td class="asst-lesson-count" data-student="${s.id}">0</td>`;
        for (let d = 1; d <= days; d++) {
            const marked = attendance[attKey][s.id][d];
            const isLesson = isLessonDay(year, month, d, pattern);
            html += `<td class="att-cell ${isLesson ? 'lesson-day-col' : ''} ${marked ? 'att-present' : ''}">
                <input type="checkbox" class="asst-att-check" data-att-key="${attKey}" data-student="${s.id}" data-day="${d}" ${marked ? 'checked' : ''} ${!isLesson ? 'disabled' : ''}>
            </td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table>';
    setItem(STORAGE_KEYS.assistantAttendance, attendance);
    document.getElementById('assistantAttendanceContainer').innerHTML = html;

    const kpi = calculateKpiSalary(teacher, monthVal, attendance, students);
    renderKpiSummary('asstAttSummary', kpi, teacher.name);

    document.querySelectorAll('.asst-att-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const att = getItem(STORAGE_KEYS.assistantAttendance, {});
            const k = cb.dataset.attKey;
            const sid = cb.dataset.student;
            const day = cb.dataset.day;
            if (!att[k]) att[k] = {};
            if (!att[k][sid]) att[k][sid] = {};
            if (cb.checked) att[k][sid][day] = 1;
            else delete att[k][sid][day];
            setItem(STORAGE_KEYS.assistantAttendance, att);
            renderAssistantAttendance();
        });
    });

    document.querySelectorAll('.asst-lesson-count').forEach(cell => {
        const sid = cell.dataset.student;
        const att = getItem(STORAGE_KEYS.assistantAttendance, {})[attKey]?.[sid] || {};
        cell.textContent = lessonDays.filter(d => att[d]).length;
    });
}

document.getElementById('addAsstTeacher').addEventListener('click', () => {
    const currentSubject = getSelectedSubject('asstAttSubjectTabs');
    openModal("Yordamchi ustoz qo'shish",
        `<div class="form-group"><label>Ism familiya</label><input id="mAsstName" class="form-control"></div>
         <div class="form-group"><label>Telefon</label><input id="mAsstPhone" class="form-control"></div>
         <div class="form-group"><label>Fan</label>
            <select id="mAsstSubject" class="form-select">
                <option value="english" ${currentSubject === 'english' ? 'selected' : ''}>🇬🇧 Ingliz tili</option>
                <option value="russian" ${currentSubject === 'russian' ? 'selected' : ''}>🇷🇺 Rus tili</option>
            </select>
         </div>
         <div class="form-group"><label>Dars kunlari</label>
            <select id="mAsstPattern" class="form-select">
                <option value="mwf">Dushanba, Chorshanba, Juma</option>
                <option value="tts">Seshanba, Payshanba, Shanba</option>
            </select>
         </div>
         <div class="form-group"><label>Dars davomiyligi</label>
            <select id="mAsstDuration" class="form-select">
                <option value="15">15 daqiqa (75,000/oy)</option>
                <option value="30">30 daqiqa (150,000/oy)</option>
                <option value="60">60 daqiqa (300,000/oy)</option>
            </select>
         </div>`,
        `<button class="btn-primary-sm" id="saveAsstTeacher">Saqlash</button>`
    );
    document.getElementById('saveAsstTeacher').onclick = () => {
        const name = document.getElementById('mAsstName').value.trim();
        if (!name) return;
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        teachers.push({
            id: 't' + Date.now(),
            name,
            type: 'yordamchi',
            subject: document.getElementById('mAsstSubject').value,
            phone: document.getElementById('mAsstPhone').value.trim(),
            schedulePattern: document.getElementById('mAsstPattern').value,
            lessonDuration: parseInt(document.getElementById('mAsstDuration').value)
        });
        setItem(STORAGE_KEYS.teachers, teachers);
        closeModal();
        const subj = document.getElementById('mAsstSubject').value;
        document.querySelectorAll('#asstAttSubjectTabs .subject-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.subject === subj);
        });
        renderAssistantAttendance();
    };
});

// --- Ustozlarga kabinet ---
function renderTeacherCabinet() {
    const currentUser = getCurrentUser();
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const sel = document.getElementById('cabinetTeacher');
    if (!sel) return;

    const selWrap = sel.closest('.form-group') || sel.parentElement;

    if (currentUser?.role === 'teacher') {
        // O'qituvchi faqat o'zini ko'radi
        const tid = currentUser.linkedTeacherId;
        if (selWrap) selWrap.style.display = 'none';
        if (tid) {
            renderTeacherCabinetContent(tid);
        } else {
            document.getElementById('teacherCabinetContent').innerHTML =
                '<p class="text-muted" style="padding:24px">Siz hali ustoz sifatida tizimga biriktirilmadingiz. Admin bilan bog\'laning.</p>';
        }
        return;
    }

    // Admin / boshqa rollar: barcha ustozlar
    if (selWrap) selWrap.style.display = '';
    sel.innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    sel.onchange = () => renderTeacherCabinetContent(sel.value);
    if (teachers.length) renderTeacherCabinetContent(sel.value || teachers[0].id);
}

function renderTeacherCabinetContent(teacherId) {
    const teacher = getItem(STORAGE_KEYS.teachers, []).find(t => t.id === teacherId);
    const students = getItem(STORAGE_KEYS.students, []).filter(s => s.teacherId === teacherId || s.assistantTeacherId === teacherId);
    const timetable = getItem(STORAGE_KEYS.timetable, {});
    const today = new Date().toISOString().split('T')[0];
    const todayProbniy = Object.entries(timetable).filter(([k, v]) => k.startsWith(today) && v.teacherId === teacherId);
    const monthVal = getMonthKey(new Date());
    const isAsosiy = teacher?.type === 'asosiy';
    const attStore = isAsosiy ? getItem(STORAGE_KEYS.mainAttendance, {}) : getItem(STORAGE_KEYS.assistantAttendance, {});
    const kpi = teacher ? calculateKpiSalary(teacher, monthVal, attStore) : null;

    let html = `<div class="grid-2">
        <div class="mini-card"><strong>Ustoz:</strong> ${teacher?.name || '—'}<br><small>${teacher?.type === 'asosiy' ? 'Asosiy' : 'Yordamchi'}</small></div>
        <div class="mini-card"><strong>O'quvchilar:</strong> ${students.length} ta</div>
    </div>`;

    if (kpi) {
        html += `<div class="kpi-summary" style="margin-top:16px">
            <div class="kpi-stat"><div class="kpi-num">${kpi.expected}</div><div class="kpi-lbl">Oy rejasi</div></div>
            <div class="kpi-stat"><div class="kpi-num">${kpi.completed}</div><div class="kpi-lbl">O'tilgan</div></div>
            <div class="kpi-stat"><div class="kpi-num">${formatMoney(kpi.total)}</div><div class="kpi-lbl">Bu oy maoshi</div></div>
        </div>
        <div class="kpi-progress-wrap"><div class="kpi-progress-bar" style="width:${kpi.kpiPercent}%"></div></div>`;
    }

    html += `<h4 style="margin:20px 0 10px">Bugungi probniy darslar <span class="badge badge-probniy">bepul</span></h4>`;
    if (todayProbniy.length === 0) {
        html += '<p class="text-muted">Bugun probniy darslar yo\'q.</p>';
    } else {
        html += '<table class="table"><thead><tr><th>Vaqt</th><th>O\'quvchi</th><th>Status</th></tr></thead><tbody>';
        const allStudents = getItem(STORAGE_KEYS.students, []);
        todayProbniy.forEach(([key, entry]) => {
            const time = key.split('_')[1];
            const student = allStudents.find(s => s.id === entry.studentId);
            html += `<tr><td>${time}</td><td>${student?.name || '—'}</td><td>${entry.completed ? '<span class="badge badge-probniy">O\'tdi</span>' : '<span class="badge">Kutilmoqda</span>'}</td></tr>`;
        });
        html += '</tbody></table>';
    }

    html += `<h4 style="margin:20px 0 10px">Mening o'quvchilarim</h4>
    <table class="table"><thead><tr><th>Ism</th><th>Telefon</th><th>Guruh</th></tr></thead><tbody>`;
    students.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.phone || '—'}</td><td>${s.group || '—'}</td></tr>`;
    });
    if (!students.length) html += '<tr><td colspan="3" class="text-muted">O\'quvchilar yo\'q</td></tr>';
    html += '</tbody></table>';

    document.getElementById('teacherCabinetContent').innerHTML = html;
}

// --- Maosh hisob-kitobi ---
function renderSalary() {
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const sel = document.getElementById('salaryTeacher');
    const month = document.getElementById('salaryMonth');
    if (!month.value) month.value = getMonthKey(new Date());

    sel.innerHTML = '<option value="all">Barcha ustozlar</option>' +
        teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    sel.onchange = renderSalaryContent;
    month.onchange = renderSalaryContent;
    renderSalaryContent();
}

function renderSalaryContent() {
    const teacherId = document.getElementById('salaryTeacher').value;
    const monthVal = document.getElementById('salaryMonth').value;
    const [year, month] = monthVal.split('-').map(Number);
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const filteredTeachers = teacherId === 'all' ? teachers : teachers.filter(t => t.id === teacherId);
    const mainAtt = getItem(STORAGE_KEYS.mainAttendance, {});
    const asstAtt = getItem(STORAGE_KEYS.assistantAttendance, {});

    const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
    document.getElementById('salaryMonthInfo').innerHTML = `
        <div class="kpi-stat"><div class="kpi-num">${monthNames[month - 1]} ${year}</div><div class="kpi-lbl">Hisobot oyi</div></div>
        <div class="kpi-stat"><div class="kpi-num" style="font-size:14px">Davomat asosida</div><div class="kpi-lbl">Timetable (probniy) hisobga olinmaydi</div></div>
    `;

    let html = '<table class="table"><thead><tr>';
    html += '<th>Ustoz</th><th>Turi</th><th>O\'quvchilar</th><th>Reja</th><th>Jami darslar</th><th>1 dars</th><th>KPI</th><th>Maosh</th>';
    html += '</tr></thead><tbody>';

    let grandTotal = 0;

    filteredTeachers.forEach(teacher => {
        const attStore = teacher.type === 'yordamchi' ? asstAtt : mainAtt;
        const kpi = calculateKpiSalary(teacher, monthVal, attStore);
        grandTotal += kpi.total;
        const durLabel = kpi.duration + ' daq';
        html += `<tr>
            <td><strong>${teacher.name}</strong><br><small>${getSubjectLabel(teacher.subject || 'english')}</small></td>
            <td>${teacher.type === 'asosiy' ? 'Asosiy' : 'Yordamchi'}</td>
            <td>${kpi.studentCount} ta</td>
            <td>${kpi.expected} dars<br><small>${formatMoney(kpi.monthlyBase)}/o'quvchi</small></td>
            <td><strong>${kpi.completed}</strong></td>
            <td>${formatMoney(Math.round(kpi.perLesson))}</td>
            <td><span class="badge ${kpi.kpiPercent >= 100 ? 'badge-success' : ''}">${kpi.kpiPercent}%</span></td>
            <td><strong>${formatMoney(kpi.total)}</strong></td>
        </tr>`;
    });

    if (!filteredTeachers.length) {
        html += '<tr><td colspan="8" class="text-muted">Ustozlar topilmadi</td></tr>';
    }

    html += '</tbody></table>';
    html += `<div class="salary-total"><strong>Umumiy jami: ${formatMoney(grandTotal)}</strong></div>`;

    if (filteredTeachers.length === 1) {
        const kpi = calculateKpiSalary(filteredTeachers[0], monthVal,
            filteredTeachers[0].type === 'yordamchi' ? asstAtt : mainAtt);
        html += `<div class="card" style="margin-top:16px;padding:16px">
            <p class="text-muted" style="margin-bottom:12px"><strong>Hisoblash:</strong> Har o'quvchi uchun ${formatMoney(kpi.monthlyBase)} ÷ ${kpi.expected} dars = ${formatMoney(Math.round(kpi.perLesson))} / dars</p>`;
        if (kpi.perStudent.length) {
            kpi.perStudent.forEach(ps => {
                html += `<p class="text-muted">${ps.name}: ${ps.lessons} dars × ${formatMoney(Math.round(kpi.perLesson))} = <strong>${formatMoney(ps.earned)}</strong></p>`;
            });
        } else {
            html += `<p class="text-muted">O'quvchilar yo'q</p>`;
        }
        html += `<p style="margin-top:12px;font-weight:700">Jami: ${formatMoney(kpi.total)} (max mumkin: ${formatMoney(kpi.maxPossible)})</p>
            <div class="kpi-progress-wrap"><div class="kpi-progress-bar" style="width:${kpi.kpiPercent}%"></div></div>
        </div>`;
    }

    document.getElementById('salaryContent').innerHTML = html;
}

// --- O'quvchilar ---
function renderStudents() {
    const subject = _tabContext.subject;
    const currentUser = getCurrentUser();
    const titleEl = document.getElementById('studentsPageTitle');
    if (titleEl) {
        titleEl.textContent = subject
            ? `O'quvchilar — ${SUBJECTS[subject]?.label || subject}`
            : "O'quvchilar ma'lumotlari";
    }

    let students = getItem(STORAGE_KEYS.students, []);
    if (subject) {
        students = students.filter(s => (s.subject || 'english') === subject);
    }
    // O'qituvchi faqat o'z o'quvchilarini ko'radi
    if (currentUser?.role === 'teacher' && currentUser?.linkedTeacherId) {
        const tid = currentUser.linkedTeacherId;
        students = students.filter(s => s.teacherId === tid || s.assistantTeacherId === tid);
    }
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const tbody = document.getElementById('studentsBody');
    tbody.innerHTML = students.map((s, i) => {
        const teacher = teachers.find(t => t.id === s.teacherId);
        const asst = teachers.find(t => t.id === s.assistantTeacherId);
        return `<tr>
            <td>${i + 1}</td>
            <td>${s.name}</td>
            <td>${s.phone || '—'}</td>
            <td>${getSubjectLabel(s.subject || 'english')}</td>
            <td>${s.group || '—'}</td>
            <td>${teacher?.name || '—'}${asst ? '<br><small>Yordamchi: ' + asst.name + '</small>' : ''}</td>
            <td><button class="btn-danger-sm" data-delete-student="${s.id}">O'chirish</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-muted">O\'quvchilar yo\'q</td></tr>';

    document.querySelectorAll('[data-delete-student]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('O\'chirishni tasdiqlaysizmi?')) return;
            const id = btn.dataset.deleteStudent;
            setItem(STORAGE_KEYS.students, getItem(STORAGE_KEYS.students, []).filter(s => s.id !== id));
            renderStudents();
        });
    });
}

function fillStudentTeacherOptions(subject) {
    const asosiy = filterTeachersByTypeAndSubject('asosiy', subject);
    const yordamchi = filterTeachersByTypeAndSubject('yordamchi', subject);
    const tSel = document.getElementById('mStTeacher');
    const aSel = document.getElementById('mStAsstTeacher');
    if (tSel) {
        tSel.innerHTML = asosiy.length
            ? asosiy.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
            : '<option value="">— Ustoz yo\'q —</option>';
    }
    if (aSel) {
        aSel.innerHTML = '<option value="">— Tanlanmagan —</option>' +
            yordamchi.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
}

document.getElementById('addStudentBtn').addEventListener('click', () => {
    openModal("O'quvchi qo'shish",
        `<div class="form-group"><label>Ism familiya</label><input id="mStName" class="form-control"></div>
         <div class="form-group"><label>Telefon</label><input id="mStPhone" class="form-control"></div>
         <div class="form-group"><label>Fan</label>
            <select id="mStSubject" class="form-select">
                <option value="english">🇬🇧 Ingliz tili</option>
                <option value="russian">🇷🇺 Rus tili</option>
            </select>
         </div>
         <div class="form-group"><label>Guruh</label><input id="mStGroup" class="form-control"></div>
         <div class="form-group"><label>Asosiy ustoz</label>
            <select id="mStTeacher" class="form-select"></select>
         </div>
         <div class="form-group"><label>Yordamchi ustoz (ixtiyoriy)</label>
            <select id="mStAsstTeacher" class="form-select"></select>
         </div>`,
        `<button class="btn-primary-sm" id="saveStudent">Saqlash</button>`
    );
    fillStudentTeacherOptions('english');
    document.getElementById('mStSubject').addEventListener('change', e => {
        fillStudentTeacherOptions(e.target.value);
    });
    document.getElementById('saveStudent').onclick = () => {
        const name = document.getElementById('mStName').value.trim();
        if (!name) return;
        const teacherId = document.getElementById('mStTeacher').value;
        if (!teacherId) { alert('Asosiy ustozni tanlang.'); return; }
        const students = getItem(STORAGE_KEYS.students, []);
        const asstId = document.getElementById('mStAsstTeacher').value;
        const subject = document.getElementById('mStSubject').value;
        students.push({
            id: 's' + Date.now(),
            name,
            phone: document.getElementById('mStPhone').value.trim(),
            group: document.getElementById('mStGroup').value.trim(),
            subject,
            teacherId,
            assistantTeacherId: asstId || null
        });
        setItem(STORAGE_KEYS.students, students);
        closeModal();
        renderStudents();
    };
});

// --- To'lovlar ---
function renderPayments() {
    const payments = getItem(STORAGE_KEYS.payments, []);
    const students = getItem(STORAGE_KEYS.students, []);
    const tbody = document.getElementById('paymentsBody');

    tbody.innerHTML = payments.map(p => {
        const student = students.find(s => s.id === p.studentId);
        return `<tr>
            <td>${student?.name || '—'}</td>
            <td>${formatMoney(p.platform || 0)}</td>
            <td>${formatMoney(p.book || 0)}</td>
            <td>${formatMoney(p.paid || 0)}</td>
            <td><span class="badge ${p.debt > 0 ? 'badge-danger' : 'badge-success'}">${formatMoney(p.debt || 0)}</span></td>
            <td>${p.date || '—'}</td>
            <td><button class="btn-danger-sm" data-delete-payment="${p.id}">O'chirish</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-muted">To\'lovlar yo\'q</td></tr>';

    document.querySelectorAll('[data-delete-payment]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.deletePayment;
            setItem(STORAGE_KEYS.payments, getItem(STORAGE_KEYS.payments, []).filter(p => p.id !== id));
            renderPayments();
        });
    });
}

document.getElementById('addPaymentBtn').addEventListener('click', () => {
    const students = getItem(STORAGE_KEYS.students, []);
    if (!students.length) { alert('Avval o\'quvchi qo\'shing.'); return; }
    openModal("To'lov qo'shish",
        `<div class="form-group"><label>O'quvchi</label>
            <select id="mPayStudent" class="form-select">${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
         </div>
         <div class="form-group"><label>Platforma to'lovi (so'm)</label><input type="number" id="mPayPlatform" class="form-control" value="0"></div>
         <div class="form-group"><label>Kitob to'lovi (so'm)</label><input type="number" id="mPayBook" class="form-control" value="0"></div>
         <div class="form-group"><label>To'langan (so'm)</label><input type="number" id="mPayPaid" class="form-control" value="0"></div>
         <div class="form-group"><label>Sana</label><input type="date" id="mPayDate" class="form-control" value="${new Date().toISOString().split('T')[0]}"></div>`,
        `<button class="btn-primary-sm" id="savePayment">Saqlash</button>`
    );
    document.getElementById('savePayment').onclick = () => {
        const platform = parseInt(document.getElementById('mPayPlatform').value) || 0;
        const book = parseInt(document.getElementById('mPayBook').value) || 0;
        const paid = parseInt(document.getElementById('mPayPaid').value) || 0;
        const total = platform + book;
        const payments = getItem(STORAGE_KEYS.payments, []);
        payments.push({
            id: 'p' + Date.now(),
            studentId: document.getElementById('mPayStudent').value,
            platform, book, paid,
            debt: Math.max(0, total - paid),
            date: document.getElementById('mPayDate').value
        });
        setItem(STORAGE_KEYS.payments, payments);
        closeModal();
        renderPayments();
    };
});

// --- Sotuv bo'limi ---
function renderSales() {
    syncLeadsLangTabs();
    switchSalesSection(_tabContext.salesSection || 'leads');
}

const LEAD_COLUMNS_HIDDEN_BY_DEFAULT = new Set(['muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar']);
const LEADS_COLUMN_VISIBILITY_KEY = 'mh_leads_column_visibility';
const LEADS_LANG_FILTER_KEY = 'mh_leads_lang_filter';

const LEAD_CONTACT_FAIL_REASONS = [
    { id: 'no-answer', label: 'Javob bermadi' },
    { id: 'busy', label: 'Band bo\'ldi' },
    { id: 'phone-off', label: 'Telefoni o\'chiq' },
    { id: 'call-later', label: 'Keyinroq gaplashishni so\'radi' }
];

const FAILED_SALE_REASON_GROUPS = [
    {
        id: 'boglanildi',
        label: 'Bog\'lanildi bosqichida',
        reasons: [
            { id: 'no-pickup-6', label: 'Telefonini ko\'tarmadi (6+ urinishdan so\'ng)' },
            { id: 'wrong-number', label: 'Noto\'g\'ri raqam ekan' },
            { id: 'no-response-6', label: 'Javob bermadi (6+ urinishdan so\'ng)' },
        ]
    },
    {
        id: 'malumot-berildi',
        label: 'Ma\'lumot berildi dan keyin',
        reasons: [
            { id: 'price-expensive', label: 'Narx qimmat' },
            { id: 'parents-refused', label: 'Ota-onasi ruxsat bermadi' },
            { id: 'family-refused', label: 'Uydagi boshqalar ruxsat bermadi' },
            { id: 'time-mismatch', label: 'Vaqti mos emas' },
            { id: 'chose-online', label: 'Boshqa onlayn maktabni tanladi' },
            { id: 'chose-offline', label: 'Oflayn o\'quv markazni tanladi' },
        ]
    },
    {
        id: 'sinov-darsidan',
        label: 'Sinov darsidan keyin',
        reasons: [
            { id: 'no-result', label: 'Kutilgan natijani ko\'rmadi' },
            { id: 'teacher-mismatch', label: 'O\'qituvchi mos kelmadi' },
            { id: 'format-disliked', label: 'Format yoqmadi' },
            { id: 'schedule-changed', label: 'O\'qish vaqti rejalarini o\'zgartirib oldi' },
            { id: 'later', label: 'Keyinroq o\'qimoqchiligini aytdi' },
        ]
    },
    {
        id: 'qaror-tolov',
        label: 'Qaror jarayonida va To\'lov jarayonida bosqichida',
        reasons: [
            { id: 'no-money', label: 'Pul yo\'q / kechiktirdi' },
            { id: 'debt-unpaid', label: 'Qarzdorlik yopilmadi' },
            { id: 'installment-refused', label: 'Nasiya savdoni rad etildi' },
        ]
    },
];

function needsFailedSalePrompt(fromStatus, toStatus) {
    return toStatus === 'muvaffaqiyatsiz-sotuv';
}

// Qaysi ustundan ko'chirilsa — shu guruhning savollari ko'rsatiladi
const FAILED_SALE_FROM_COLUMN_MAP = {
    'yangi-lidlar':            ['boglanildi'],
    'boglanishga-urinilmoqda': ['boglanildi'],
    'boglanildi':              ['boglanildi'],
    'malumot-berildi':         ['malumot-berildi'],
    'sinov-darsida':           ['sinov-darsidan'],
    'qaror-jarayonida':        ['qaror-tolov'],
    'tolov-jarayonida':        ['qaror-tolov'],
    'tolov-yopildi':           ['qaror-tolov'],
};

const SIFATSIZ_LID_REASONS = [
    { id: 'wrong-phone',    label: 'Noto\'g\'ri telefon raqami (mavjud emas)' },
    { id: 'duplicate',      label: 'Dublikat lid (bir odam bir necha marta qolgan)' },
    { id: 'fake',           label: 'Hazil yoki soxta murojaat' },
    { id: 'spam',           label: 'Spam / Bot' },
    { id: 'wrong-service',  label: 'Noto\'g\'ri xizmat bo\'yicha murojaat' },
    { id: 'age-mismatch',   label: 'Yosh talablarga umuman mos kelmaydi' },
];

function needsSifatsizLidPrompt(fromStatus, toStatus) {
    return toStatus === 'sifatsiz-lidlar';
}

function openSifatsizLidFlow(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const reasonOptions = SIFATSIZ_LID_REASONS.map(r => `
        <label class="lead-reason-option">
            <input type="radio" name="sifatsizReason" value="${r.id}" data-reason-radio>
            <span>${escapeHtml(r.label)}</span>
        </label>`).join('');

    openModal(
        'Sifatsiz lid',
        `<p class="lead-reason-subtitle">Ushbu lidni nima uchun sifatsiz deb hisoblaysiz?</p>
         <div class="lead-reason-list">${reasonOptions}</div>`,
        `<button type="button" class="btn-danger-sm" id="cancelSifatsiz">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmSifatsiz">Saqlash va ko'chirish</button>`
    );

    document.getElementById('cancelSifatsiz').onclick = () => { closeModal(); renderLeads(); };

    document.getElementById('confirmSifatsiz').onclick = () => {
        const modalBody = document.getElementById('modalBody');
        const selected = modalBody?.querySelector('[data-reason-radio]:checked');
        if (!selected) { alert('Bitta sabab tanlang'); return; }

        const reason = SIFATSIZ_LID_REASONS.find(r => r.id === selected.value);
        if (!reason) return;

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        updateLeadInStorage(lang, leadId, l => ({
            ...normalizeLeadExtras(l),
            status: 'sifatsiz-lidlar',
            sifatsizReason: { reasonId: reason.id, label: reason.label },
            comments: [...normalizeLeadExtras(l).comments, createLeadComment({
                type: 'sifatsiz-lid',
                text: `Sifatsiz lid: ${reason.label}`,
                reason: reason.label,
                author
            })]
        }));
        closeModal();
        renderLeads();
    };
}

function openMuvaffaqiyatsizSotuvFlow(lang, leadId, fromStatus) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const allowedGroupIds = FAILED_SALE_FROM_COLUMN_MAP[fromStatus] || null;
    const groups = allowedGroupIds
        ? FAILED_SALE_REASON_GROUPS.filter(g => allowedGroupIds.includes(g.id))
        : FAILED_SALE_REASON_GROUPS;

    const colLabel = LEAD_COLUMNS.find(c => c.id === fromStatus)?.label || '';
    const subtitle = colLabel
        ? `"${colLabel}" bosqichidan ko'chirilmoqda. Sabab nima?`
        : 'Nima sababdan sotuv amalga oshmadi?';

    const groupsHtml = groups.map(g => `
        <div class="failed-sale-group">
            <p class="failed-sale-group-label">${escapeHtml(g.label)}:</p>
            <div class="lead-reason-list">
                ${g.reasons.map(r => `
                <label class="lead-reason-option">
                    <input type="radio" name="failedSaleReason" value="${r.id}" data-reason-radio data-group="${g.id}">
                    <span>${escapeHtml(r.label)}</span>
                </label>`).join('')}
            </div>
        </div>`).join('');

    openModal(
        'Muvaffaqiyatsiz sotuv sababi',
        `<p class="lead-reason-subtitle">${escapeHtml(subtitle)}</p>${groupsHtml}`,
        `<button type="button" class="btn-danger-sm" id="cancelFailedSale">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmFailedSale">Saqlash va ko\'chirish</button>`
    );

    document.getElementById('cancelFailedSale').onclick = () => { closeModal(); renderLeads(); };

    document.getElementById('confirmFailedSale').onclick = () => {
        const modalBody = document.getElementById('modalBody');
        const selected = modalBody?.querySelector('[data-reason-radio]:checked');
        if (!selected) { alert('Bitta sabab tanlang'); return; }

        const groupId = selected.dataset.group;
        const group = FAILED_SALE_REASON_GROUPS.find(g => g.id === groupId);
        const reason = group?.reasons.find(r => r.id === selected.value);
        if (!reason) return;

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const updated = updateLeadInStorage(lang, leadId, l => ({
            ...normalizeLeadExtras(l),
            status: 'muvaffaqiyatsiz-sotuv',
            failedSaleReason: { groupId, reasonId: reason.id, label: reason.label },
            comments: [...normalizeLeadExtras(l).comments, createLeadComment({
                type: 'failed-sale',
                text: `Muvaffaqiyatsiz sotuv: ${reason.label}`,
                reason: reason.label,
                author
            })]
        }));
        if (!updated) { alert('Lid topilmadi'); return; }
        closeModal();
        renderLeads();
    };
}

function needsContactFailPrompt(fromStatus, toStatus) {
    return fromStatus === 'yangi-lidlar' && toStatus === 'boglanishga-urinilmoqda';
}

function moveLeadToStatus(lang, leadId, toStatus, extra = {}) {
    updateLeadInStorage(lang, leadId, l => ({ ...l, status: toStatus, ...extra }));
    renderLeads();
}

function openContactFailModal(lang, leadId, toStatus, options = {}) {
    const { chainTo = null } = options;
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const reasonOptions = LEAD_CONTACT_FAIL_REASONS.map(r => `
        <label class="lead-reason-option">
            <input type="radio" name="contactFailReason" value="${r.id}" data-reason-radio>
            <span>${escapeHtml(r.label)}</span>
        </label>`).join('');

    openModal(
        'Lid bilan nima uchun bog\'lana olmadingiz?',
        `<p class="lead-reason-subtitle">Qo'ng'iroq qilindi, lekin:</p>
         <div class="lead-reason-list">${reasonOptions}</div>`,
        `<button type="button" class="btn-danger-sm" id="cancelContactFail">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmContactFail">${chainTo ? 'Keyingi bosqich' : "Saqlash va ko'chirish"}</button>`
    );

    document.getElementById('cancelContactFail').onclick = () => {
        closeModal();
        renderLeads();
    };

    const confirmBtn = document.getElementById('confirmContactFail');
    if (!confirmBtn) return;

    confirmBtn.onclick = () => {
        const modalBody = document.getElementById('modalBody');
        const selected = modalBody?.querySelector('[data-reason-radio]:checked');
        if (!selected) {
            alert('Bitta variant tanlang');
            return;
        }
        const reason = LEAD_CONTACT_FAIL_REASONS.find(r => r.id === selected.value);
        if (!reason) return;

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const updated = updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            const next = {
                ...base,
                comments: [...base.comments, createLeadComment({
                    type: 'contact-fail',
                    text: `Qo'ng'iroq qilindi, lekin: ${reason.label}`,
                    reason: reason.label,
                    author
                })]
            };
            if (!chainTo) {
                next.status = toStatus;
            }
            return next;
        });

        if (!updated) {
            alert('Lid topilmadi');
            return;
        }

        closeModal();
        if (chainTo === 'tolov-yopildi') {
            const current = getLeadById(lang, leadId);
            openTolovYopildiFlow(lang, leadId, current?.status);
            return;
        }
        renderLeads();
    };
}

const LEAD_LANGUAGE_LEVELS = [
    { id: 'zero', label: '0 dan boshlamoqchi' },
    { id: 'beginner', label: 'Boshlang\'ich darajada biladi' },
    { id: 'intermediate', label: 'O\'rta darajada biladi' },
    { id: 'advanced', label: 'Yuqori darajada biladi' }
];

const LEAD_APPLICANTS = [
    { id: 'self', label: 'O\'zi qoldirgan' },
    { id: 'parent', label: 'Ota-onasi qoldirgan' }
];

const LEAD_GENDERS = [
    { id: 'female', label: 'Ayol' },
    { id: 'male', label: 'Erkak' }
];

const LEAD_UZ_REGIONS = [
    { id: 'toshkent-sh', label: 'Toshkent shahri' },
    { id: 'andijon', label: 'Andijon viloyati' },
    { id: 'buxoro', label: 'Buxoro viloyati' },
    { id: 'fargona', label: 'Farg\'ona viloyati' },
    { id: 'jizzax', label: 'Jizzax viloyati' },
    { id: 'xorazm', label: 'Xorazm viloyati' },
    { id: 'namangan', label: 'Namangan viloyati' },
    { id: 'navoiy', label: 'Navoiy viloyati' },
    { id: 'qashqadaryo', label: 'Qashqadaryo viloyati' },
    { id: 'samarqand', label: 'Samarqand viloyati' },
    { id: 'sirdaryo', label: 'Sirdaryo viloyati' },
    { id: 'surxondaryo', label: 'Surxondaryo viloyati' },
    { id: 'toshkent-v', label: 'Toshkent viloyati' },
    { id: 'qoraqalpogiston', label: 'Qoraqalpog\'iston Respublikasi' }
];

const LEAD_FOREIGN_COUNTRIES = [
    { id: 'ru', label: 'Rossiya' },
    { id: 'kz', label: 'Qozog\'iston' },
    { id: 'kg', label: 'Qirg\'iziston' },
    { id: 'tj', label: 'Tojikiston' },
    { id: 'tm', label: 'Turkmaniston' },
    { id: 'tr', label: 'Turkiya' },
    { id: 'ae', label: 'BAA' },
    { id: 'us', label: 'AQSh' },
    { id: 'de', label: 'Germaniya' },
    { id: 'kr', label: 'Koreya' },
    { id: 'cn', label: 'Xitoy' },
    { id: 'other', label: 'Boshqa davlat' }
];

const LEAD_LEARNING_GOALS = [
    { id: 'ielts', label: 'IELTS' },
    { id: 'cefr', label: 'CEFR' },
    { id: 'speaking', label: 'Erkin gaplashish' },
    { id: 'career', label: 'Ish va karyera' },
    { id: 'work-abroad', label: 'Xorijda ishlash' },
    { id: 'study-abroad', label: 'Xorijda o\'qish' },
    { id: 'university', label: 'Universitet / Magistratura' },
    { id: 'travel', label: 'Sayohat' },
    { id: 'business', label: 'Biznes' },
    { id: 'freelance', label: 'Freelancer / IT' },
    { id: 'media', label: 'Film va kitoblar' },
    { id: 'school', label: 'Maktab / Universitet darslari' },
    { id: 'parenting', label: 'Farzand tarbiyasi' },
    { id: 'self-growth', label: 'O\'zini rivojlantirish' },
    { id: 'other', label: 'Boshqa' }
];

function needsConnectedSurveyPrompt(toStatus) {
    return toStatus === 'boglanildi';
}

function needsInfoProvidedPrompt(fromStatus, toStatus) {
    return toStatus === 'malumot-berildi';
}

function needsConnectedSurveyBeforeInfo(fromStatus, lead) {
    if (fromStatus === 'boglanildi') return false;
    return !lead?.connectedSurvey;
}

function openMalumotBerildiFlow(lang, leadId, fromStatus) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    if (needsConnectedSurveyBeforeInfo(fromStatus, lead)) {
        openConnectedSurveyModal(lang, leadId, 'malumot-berildi', { chainTo: 'malumot-berildi' });
        return;
    }

    openInfoProvidedModal(lang, leadId);
}

function needsDecisionPrompt(fromStatus, toStatus) {
    return toStatus === 'qaror-jarayonida';
}

function needsConnectedSurveyBeforeDecision(fromStatus, lead) {
    if (fromStatus === 'boglanildi' || fromStatus === 'malumot-berildi') return false;
    return !lead?.connectedSurvey;
}

function needsInfoProvidedBeforeDecision(fromStatus, lead) {
    if (fromStatus === 'malumot-berildi') return false;
    return !lead?.infoProvidedSurvey;
}

function openQarorJarayonidaFlow(lang, leadId, fromStatus) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    const from = fromStatus || normalizeLeadStatus(lead.status);

    if (needsConnectedSurveyBeforeDecision(from, lead)) {
        openConnectedSurveyModal(lang, leadId, 'qaror-jarayonida', { chainTo: 'qaror-jarayonida' });
        return;
    }
    if (needsInfoProvidedBeforeDecision(from, lead)) {
        openInfoProvidedModal(lang, leadId, { chainTo: 'qaror-jarayonida' });
        return;
    }
    openDecisionProcessModal(lang, leadId);
}

function needsPaymentPrompt(fromStatus, toStatus) {
    return toStatus === 'tolov-jarayonida';
}

function getLeadColumnIndex(status) {
    const id = normalizeLeadStatus(status);
    const idx = LEAD_COLUMNS.findIndex(c => c.id === id);
    return idx >= 0 ? idx : 0;
}

// ── Tashlab ketilgan ustunlar so'rovnomasi (cascade) ─────────────────────────
// Qoidalar:
//  - Faqat oldinga harakatda ishlaydi (fromIdx < toIdx)
//  - boglanildi / malumot-berildi oraliqda qolsa — ularning so'rovnomalari chiqadi
//  - qaror-jarayonida so'rovnomasi bu cascade orqali CHIQMAYDI —
//    faqat lid TO'G'RIDAN-TO'G'RI qaror-jarayonida ustuniga ko'chirilganda chiqadi
// Foydalanish: startMvCascade → continueMvCascade (har bir so'rovnoma tasdiqlanganida)
//              → dispatchLeadTargetFlow (hammasi tugagach manzilga yo'naltiradi)

const SURVEY_CASCADE_TARGETS = new Set([
    'sinov-darsida', 'tolov-yopildi', 'muvaffaqiyatsiz-sotuv', 'sifatsiz-lidlar'
]);

let _mvCascade = null; // { lang, leadId, fromStatus, finalStatus }

function getSkippedSurveySteps(fromStatus, toStatus, lead) {
    const fromIdx = getLeadColumnIndex(fromStatus);
    const toIdx   = getLeadColumnIndex(toStatus);
    if (toIdx <= fromIdx) return [];
    const steps = [];
    for (const col of LEAD_COLUMNS) {
        const idx = getLeadColumnIndex(col.id);
        if (idx <= fromIdx || idx >= toIdx) continue;
        if (col.id === 'boglanildi'     && !lead?.connectedSurvey)    steps.push('connected');
        else if (col.id === 'malumot-berildi' && !lead?.infoProvidedSurvey) steps.push('info');
    }
    return steps;
}

function startMvCascade(lang, leadId, fromStatus, finalStatus) {
    _mvCascade = { lang, leadId, fromStatus, finalStatus };
    continueMvCascade();
}

function continueMvCascade() {
    if (!_mvCascade) return;
    const { lang, leadId, fromStatus, finalStatus } = _mvCascade;
    const lead = getLeadById(lang, leadId);
    if (!lead) { _mvCascade = null; return; }

    const steps = getSkippedSurveySteps(fromStatus, finalStatus, lead);
    if (!steps.length) {
        _mvCascade = null;
        dispatchLeadTargetFlow(lang, leadId, fromStatus, finalStatus);
        return;
    }
    const next = steps[0];
    if (next === 'connected') {
        openConnectedSurveyModal(lang, leadId, finalStatus, { chainTo: '__cascade__' });
    } else if (next === 'info') {
        openInfoProvidedModal(lang, leadId, { chainTo: '__cascade__' });
    } else if (next === 'decision') {
        openDecisionProcessModal(lang, leadId, { chainTo: '__cascade__' });
    }
}

function dispatchLeadTargetFlow(lang, leadId, fromStatus, toStatus) {
    if (toStatus === 'sinov-darsida') { openTrialLessonFlow(lang, leadId, fromStatus); return; }
    if (toStatus === 'tolov-yopildi') { openPaymentClosedModal(lang, leadId); return; }
    if (needsFailedSalePrompt(fromStatus, toStatus)) { openMuvaffaqiyatsizSotuvFlow(lang, leadId, fromStatus); return; }
    if (needsSifatsizLidPrompt(fromStatus, toStatus)) { openSifatsizLidFlow(lang, leadId); return; }
    moveLeadToStatus(lang, leadId, toStatus);
}

function getPendingSurveyStepsBeforePayment(fromStatus) {
    const fromIdx = getLeadColumnIndex(fromStatus);
    const paymentIdx = getLeadColumnIndex('tolov-jarayonida');
    const steps = [];

    for (const col of LEAD_COLUMNS) {
        const idx = getLeadColumnIndex(col.id);
        if (idx <= fromIdx || idx >= paymentIdx) continue;
        if (col.id === 'sinov-darsida') continue;
        if (col.id === 'boglanildi') steps.push('connected');
        else if (col.id === 'malumot-berildi') steps.push('info');
        else if (col.id === 'qaror-jarayonida') steps.push('decision');
    }
    return steps;
}

function getNextSurveyStepBeforePayment(fromStatus, lead) {
    for (const step of getPendingSurveyStepsBeforePayment(fromStatus)) {
        if (step === 'connected' && lead.connectedSurvey) continue;
        if (step === 'info' && lead.infoProvidedSurvey) continue;
        if (step === 'decision' && lead.decisionSurvey) continue;
        return step;
    }
    return 'payment';
}

function needsTrialLessonPrompt(fromStatus, toStatus) {
    return toStatus === 'sinov-darsida';
}

function openTrialLessonFlow(lang, leadId, fromStatus) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    const teachers = filterTeachersByTypeAndSubject('asosiy', lead.subject || 'english');
    const teacherOptions = `<option value="">— Tanlang —</option>` +
        teachers.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');

    openModal(`Sinov darsi — ${escapeHtml(lead.name)}`,
        `<div class="form-group">
            <label>O'qituvchi</label>
            <select id="onboardTeacherId" class="form-control">${teacherOptions}</select>
        </div>
        <div class="form-group">
            <label>Sinov darsi kunlari soni</label>
            <select id="trialDaysCount" class="form-control">
                <option value="1">1 kun</option>
                <option value="2">2 kun</option>
                <option value="3">3 kun</option>
            </select>
        </div>
        <div id="onboardScheduleBlock" style="display:none;margin-top:16px;">
            <p class="lead-survey-sub">Bo'sh jadvallar</p>
            <div id="onboardSchedulePicker" class="onboard-schedule-container" tabindex="0"></div>
            <p id="onboardScheduleSelected" class="onboard-schedule-selected"></p>
        </div>`,
        `<button type="button" class="btn-danger-sm" id="cancelTrialFlow">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmTrialFlow">Saqlash</button>`
    );

    document.getElementById('cancelTrialFlow').onclick = () => { closeModal(); renderLeads(); };

    const modalBody = document.getElementById('modalBody');
    wireTeacherSchedulePicker(modalBody, { lead });

    document.getElementById('confirmTrialFlow').onclick = () => {
        const teacherId = document.getElementById('onboardTeacherId').value;
        const count = parseInt(document.getElementById('trialDaysCount').value, 10);
        const day = modalBody.dataset.onboardScheduleDay;
        const time = modalBody.dataset.onboardScheduleTime;

        if (!teacherId || !day || !time) {
            alert("O'qituvchi, kun va vaqt tanlang!");
            return;
        }

        const onboarding = lead.paymentOnboarding || {};
        onboarding.teacherId = teacherId;
        onboarding.lessonDayOfWeek = parseInt(day, 10);
        onboarding.lessonTime = time;
        onboarding.trialDaysCount = count;
        onboarding.isTrial = true;

        updateLeadInStorage(lang, leadId, l => ({
            ...l,
            status: 'sinov-darsida',
            paymentOnboarding: onboarding
        }));

        closeModal();
        renderLeads();
    };
}

function openTolovJarayonidaFlow(lang, leadId, fromStatus) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    const from = normalizeLeadStatus(fromStatus || lead.status);
    const next = getNextSurveyStepBeforePayment(from, lead);

    if (next === 'connected') {
        openConnectedSurveyModal(lang, leadId, 'tolov-jarayonida', { chainTo: 'tolov-jarayonida' });
        return;
    }
    if (next === 'info') {
        openInfoProvidedModal(lang, leadId, { chainTo: 'tolov-jarayonida' });
        return;
    }
    if (next === 'decision') {
        openDecisionProcessModal(lang, leadId, { chainTo: 'tolov-jarayonida' });
        return;
    }
    beginTolovJarayonidaPaymentFlow(lang, leadId);
}

const LEAD_SERIAL_COUNTER_KEY = 'mh_leadSerialCounter';

function parseLeadSerialCode(code) {
    const m = String(code || '').match(/^([A-Z]{2})(\d{3})$/);
    if (!m) return null;
    return { letters: m[1], num: parseInt(m[2], 10) };
}

function incrementLeadSerialLetters(letters) {
    let a = letters.charCodeAt(0) - 65;
    let b = letters.charCodeAt(1) - 65;
    b += 1;
    if (b > 25) {
        b = 0;
        a += 1;
    }
    if (a > 25) {
        a = 0;
        b = 0;
    }
    return String.fromCharCode(65 + a) + String.fromCharCode(65 + b);
}

function formatLeadSerialCode(letters, num) {
    return letters + String(num).padStart(3, '0');
}

function compareLeadSerialCodes(a, b) {
    const pa = parseLeadSerialCode(a);
    const pb = parseLeadSerialCode(b);
    if (!pa || !pb) return 0;
    if (pa.letters !== pb.letters) return pa.letters.localeCompare(pb.letters);
    return pa.num - pb.num;
}

function getMaxExistingLeadSerial() {
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    let max = null;
    [...(leads.english || []), ...(leads.russian || [])].forEach(lead => {
        if (!lead.serialCode) return;
        if (!max || compareLeadSerialCodes(lead.serialCode, max) > 0) max = lead.serialCode;
    });
    return max;
}

function syncLeadSerialCounterFromExisting() {
    const max = getMaxExistingLeadSerial();
    if (!max) return;
    try {
        const stored = localStorage.getItem(LEAD_SERIAL_COUNTER_KEY);
        if (!stored || compareLeadSerialCodes(max, stored) > 0) {
            localStorage.setItem(LEAD_SERIAL_COUNTER_KEY, max);
        }
    } catch { /* ignore */ }
}

function generateNextLeadSerial() {
    syncLeadSerialCounterFromExisting();
    let letters = 'AA';
    let num = 0;
    try {
        const parsed = parseLeadSerialCode(localStorage.getItem(LEAD_SERIAL_COUNTER_KEY));
        if (parsed) {
            letters = parsed.letters;
            num = parsed.num;
        }
    } catch { /* ignore */ }

    num += 1;
    if (num > 999) {
        num = 1;
        letters = incrementLeadSerialLetters(letters);
    }
    const code = formatLeadSerialCode(letters, num);
    try {
        localStorage.setItem(LEAD_SERIAL_COUNTER_KEY, code);
    } catch { /* ignore */ }
    return code;
}

function backfillMissingLeadSerials() {
    syncLeadSerialCounterFromExisting();
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    let changed = false;
    ['english', 'russian'].forEach(lang => {
        (leads[lang] || []).forEach((lead, idx) => {
            if (normalizeLeadStatus(lead.status) === 'tolov-jarayonida' && !lead.serialCode) {
                leads[lang][idx] = { ...lead, serialCode: generateNextLeadSerial() };
                changed = true;
            }
        });
    });
    if (changed) setItem(STORAGE_KEYS.leads, leads);
}

function leadHasTeacherSchedule(lead) {
    const onboarding = lead?.paymentOnboarding;
    return Boolean(
        onboarding?.teacherId
        && onboarding.lessonDayOfWeek != null
        && onboarding.lessonTime
    );
}

function ensureLeadPaymentStatus(lang, leadId, scheduleData = null) {
    updateLeadInStorage(lang, leadId, l => {
        const next = {
            ...l,
            status: 'tolov-jarayonida',
            serialCode: l.serialCode || generateNextLeadSerial()
        };
        if (scheduleData) {
            next.paymentOnboarding = { ...(l.paymentOnboarding || {}), ...scheduleData };
        }
        return next;
    });
    renderLeads();
}

function beginTolovJarayonidaPaymentFlow(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    if (!leadHasTeacherSchedule(lead)) {
        openPaymentTeacherScheduleModal(lang, leadId);
        return;
    }
    openPaymentProcessModal(lang, leadId);
}

const PAYMENT_CLOSED_SKIP_COLUMNS = new Set([
    'qaror-jarayonida',
    'sinov-darsida',
    'tolov-jarayonida'
]);

function leadHasContactFailSurvey(lead) {
    return Array.isArray(lead?.comments)
        && lead.comments.some(c => c.type === 'contact-fail');
}

function getPendingSurveyStepsBeforePaymentClosed(fromStatus) {
    const fromIdx = getLeadColumnIndex(fromStatus);
    const closedIdx = getLeadColumnIndex('tolov-yopildi');
    const steps = [];

    for (const col of LEAD_COLUMNS) {
        const idx = getLeadColumnIndex(col.id);
        if (idx <= fromIdx || idx >= closedIdx) continue;
        if (PAYMENT_CLOSED_SKIP_COLUMNS.has(col.id)) continue;
        if (col.id === 'boglanishga-urinilmoqda') steps.push('contact-fail');
        else if (col.id === 'boglanildi') steps.push('connected');
        else if (col.id === 'malumot-berildi') steps.push('info');
    }
    return steps;
}

function getNextSurveyStepBeforePaymentClosed(fromStatus, lead) {
    for (const step of getPendingSurveyStepsBeforePaymentClosed(fromStatus)) {
        if (step === 'contact-fail' && leadHasContactFailSurvey(lead)) continue;
        if (step === 'connected' && lead.connectedSurvey) continue;
        if (step === 'info' && lead.infoProvidedSurvey) continue;
        return step;
    }
    return 'payment-closed';
}

function openTolovYopildiFlow(lang, leadId, fromStatus) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    const from = normalizeLeadStatus(fromStatus || lead.status);
    const next = getNextSurveyStepBeforePaymentClosed(from, lead);

    if (next === 'contact-fail') {
        openContactFailModal(lang, leadId, 'boglanishga-urinilmoqda', { chainTo: 'tolov-yopildi' });
        return;
    }
    if (next === 'connected') {
        openConnectedSurveyModal(lang, leadId, 'tolov-yopildi', { chainTo: 'tolov-yopildi' });
        return;
    }
    if (next === 'info') {
        openInfoProvidedModal(lang, leadId, { chainTo: 'tolov-yopildi' });
        return;
    }
    openPaymentClosedModal(lang, leadId);
}

function renderSurveyRadioGroup(name, options) {
    return `<div class="lead-survey-options">${options.map(o => `
        <label class="lead-reason-option">
            <input type="radio" name="${name}" value="${escapeHtml(o.id)}" data-survey-field="${name}">
            <span>${escapeHtml(o.label)}</span>
        </label>`).join('')}</div>`;
}

function renderSurveyCarousel(name, options) {
    const items = options.map(o => `
        <label class="lead-carousel-item">
            <input type="radio" name="${name}" value="${escapeHtml(o.id)}" data-survey-field="${name}">
            <span>${escapeHtml(o.label)}</span>
        </label>`).join('');
    return `<div class="lead-carousel" data-carousel="${name}">
        <button type="button" class="lead-carousel-nav lead-carousel-prev" aria-label="Oldingi">‹</button>
        <div class="lead-carousel-viewport">
            <div class="lead-carousel-track">${items}</div>
        </div>
        <button type="button" class="lead-carousel-nav lead-carousel-next" aria-label="Keyingi">›</button>
    </div>`;
}

function initSurveyCarousels(root) {
    root.querySelectorAll('.lead-carousel').forEach(carousel => {
        const viewport = carousel.querySelector('.lead-carousel-viewport');
        const item = carousel.querySelector('.lead-carousel-item');
        const step = () => (item ? item.offsetWidth + 10 : 150);
        carousel.querySelector('.lead-carousel-prev')?.addEventListener('click', () => {
            viewport.scrollBy({ left: -step(), behavior: 'smooth' });
        });
        carousel.querySelector('.lead-carousel-next')?.addEventListener('click', () => {
            viewport.scrollBy({ left: step(), behavior: 'smooth' });
        });
        carousel.querySelectorAll('.lead-carousel-item input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                carousel.querySelectorAll('.lead-carousel-item').forEach(el => el.classList.remove('is-selected'));
                radio.closest('.lead-carousel-item')?.classList.add('is-selected');
            });
        });
    });
}

function getSurveyOptionLabel(options, id) {
    return options.find(o => o.id === id)?.label || '';
}

function collectConnectedSurveyData(modalBody) {
    const getRadio = name => modalBody.querySelector(`[data-survey-field="${name}"]:checked`);

    const languageLevel = getRadio('languageLevel');
    const applicant = getRadio('applicant');
    const gender = getRadio('gender');
    const learningGoal = getRadio('learningGoal');
    const ageInput = modalBody.querySelector('#leadSurveyAge');
    const residenceType = getRadio('residenceType');

    if (!languageLevel) return { error: 'Til darajasini tanlang' };
    if (!applicant) return { error: 'Ariza kim tomonidan qoldirilganini tanlang' };
    if (!ageInput) return { error: 'Yoshni tanlang' };
    if (!gender) return { error: 'Jinsini tanlang' };
    if (!residenceType) return { error: 'Hudud turini tanlang' };
    if (!learningGoal) return { error: 'O\'rganish maqsadini tanlang' };

    let residenceLabel = '';
    const survey = {
        languageLevel: languageLevel.value,
        languageLevelLabel: getSurveyOptionLabel(LEAD_LANGUAGE_LEVELS, languageLevel.value),
        applicant: applicant.value,
        applicantLabel: getSurveyOptionLabel(LEAD_APPLICANTS, applicant.value),
        age: Number(ageInput.value),
        gender: gender.value,
        genderLabel: getSurveyOptionLabel(LEAD_GENDERS, gender.value),
        residenceType: residenceType.value,
        learningGoal: learningGoal.value,
        learningGoalLabel: getSurveyOptionLabel(LEAD_LEARNING_GOALS, learningGoal.value)
    };

    if (residenceType.value === 'uz') {
        const region = getRadio('uzRegion');
        if (!region) return { error: 'Viloyatni tanlang' };
        survey.region = region.value;
        survey.regionLabel = getSurveyOptionLabel(LEAD_UZ_REGIONS, region.value);
        residenceLabel = survey.regionLabel;
    } else {
        const country = getRadio('foreignCountry');
        if (!country) return { error: 'Davlatni tanlang' };
        survey.country = country.value;
        survey.countryLabel = getSurveyOptionLabel(LEAD_FOREIGN_COUNTRIES, country.value);
        residenceLabel = survey.countryLabel;
    }

    survey.residenceLabel = residenceLabel;
    return { data: survey };
}

function formatConnectedSurveyComment(survey) {
    return [
        'Bog\'lanildi — anketa:',
        `• Til darajasi: ${survey.languageLevelLabel}`,
        `• Ariza: ${survey.applicantLabel}`,
        `• Yoshi: ${survey.age}`,
        `• Jinsi: ${survey.genderLabel}`,
        `• Hudud: ${survey.residenceLabel}`,
        `• Maqsad: ${survey.learningGoalLabel}`
    ].join('\n');
}

function openConnectedSurveyModal(lang, leadId, toStatus, options = {}) {
    const { chainTo = null } = options;
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const bodyHtml = `<div class="lead-survey">
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Til darajasi</h4>
            ${renderSurveyRadioGroup('languageLevel', LEAD_LANGUAGE_LEVELS)}
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">O'qish uchun arizani kim qoldirgan</h4>
            ${renderSurveyRadioGroup('applicant', LEAD_APPLICANTS)}
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Yoshi</h4>
            <div class="lead-age-slider">
                <div class="lead-age-slider-head">
                    <span class="lead-age-slider-label">Yosh</span>
                    <output id="leadSurveyAgeValue" class="lead-age-value" for="leadSurveyAge">20</output>
                </div>
                <input type="range" id="leadSurveyAge" class="lead-age-range" min="7" max="70" value="20" step="1">
                <div class="lead-age-marks"><span>7</span><span>70</span></div>
            </div>
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Jinsi</h4>
            ${renderSurveyRadioGroup('gender', LEAD_GENDERS)}
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Qaysi hududda istiqomat qiladi</h4>
            <div class="lead-survey-options lead-survey-options--compact">
                <label class="lead-reason-option">
                    <input type="radio" name="residenceType" value="uz" data-survey-field="residenceType" checked>
                    <span>O'zbekiston hududi</span>
                </label>
                <label class="lead-reason-option">
                    <input type="radio" name="residenceType" value="foreign" data-survey-field="residenceType">
                    <span>Boshqa davlat</span>
                </label>
            </div>
            <div id="surveyRegionBlock" class="lead-survey-carousel-block">
                ${renderSurveyCarousel('uzRegion', LEAD_UZ_REGIONS)}
            </div>
            <div id="surveyCountryBlock" class="lead-survey-carousel-block" hidden>
                <p class="lead-survey-sub">Davlatlar</p>
                ${renderSurveyCarousel('foreignCountry', LEAD_FOREIGN_COUNTRIES)}
            </div>
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">O'rganish maqsadi</h4>
            ${renderSurveyCarousel('learningGoal', LEAD_LEARNING_GOALS)}
        </section>
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — ${chainTo ? "Bog'lanildi (anketa)" : "Bog'lanildi"}`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelConnectedSurvey">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmConnectedSurvey">${chainTo ? 'Keyingi bosqich' : "Saqlash va ko'chirish"}</button>`,
        { wide: true }
    );

    const modalBody = document.getElementById('modalBody');
    const ageInput = modalBody.querySelector('#leadSurveyAge');
    const ageOutput = modalBody.querySelector('#leadSurveyAgeValue');
    const syncAgeSlider = () => {
        if (!ageInput) return;
        const min = Number(ageInput.min) || 7;
        const max = Number(ageInput.max) || 70;
        const val = Number(ageInput.value);
        const pct = ((val - min) / (max - min)) * 100;
        ageInput.style.setProperty('--age-pct', `${pct}%`);
        if (ageOutput) ageOutput.textContent = String(val);
    };
    ageInput?.addEventListener('input', syncAgeSlider);
    syncAgeSlider();

    modalBody.querySelectorAll('[data-survey-field="residenceType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const isUz = modalBody.querySelector('[data-survey-field="residenceType"][value="uz"]')?.checked;
            const regionBlock = modalBody.querySelector('#surveyRegionBlock');
            const countryBlock = modalBody.querySelector('#surveyCountryBlock');
            if (regionBlock) regionBlock.hidden = !isUz;
            if (countryBlock) countryBlock.hidden = isUz;
        });
    });

    initSurveyCarousels(modalBody);

    document.getElementById('cancelConnectedSurvey').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmConnectedSurvey').onclick = () => {
        const result = collectConnectedSurveyData(modalBody);
        if (result.error) {
            alert(result.error);
            return;
        }

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const survey = result.data;
        const commentText = formatConnectedSurveyComment(survey);

        const updated = updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            const next = {
                ...base,
                connectedSurvey: survey,
                comments: [...base.comments, createLeadComment({
                    type: 'connected-survey',
                    text: commentText,
                    author
                })]
            };
            if (!chainTo) {
                next.status = toStatus;
            }
            return next;
        });

        if (!updated) {
            alert('Lid topilmadi');
            return;
        }

        closeModal();
        if (chainTo === '__cascade__') { continueMvCascade(); return; }
        if (chainTo === 'malumot-berildi') {
            openInfoProvidedModal(lang, leadId);
            return;
        }
        if (chainTo === 'qaror-jarayonida') {
            openQarorJarayonidaFlow(lang, leadId);
            return;
        }
        if (chainTo === 'tolov-jarayonida') {
            const current = getLeadById(lang, leadId);
            openTolovJarayonidaFlow(lang, leadId, current?.status);
            return;
        }
        if (chainTo === 'tolov-yopildi') {
            const current = getLeadById(lang, leadId);
            openTolovYopildiFlow(lang, leadId, current?.status);
            return;
        }
        renderLeads();
    };
}

const LEAD_INFO_PROVIDED_QUESTIONS = [
    { id: 'platform', label: 'Platforma tushuntirildimi?' },
    { id: 'price', label: 'Narx aytildimi?' },
    { id: 'format', label: 'Format (online ekani) aytildimi?' },
    { id: 'terms', label: 'Natija, kafolat va muddat, shartnoma haqida aytildimi?' },
    { id: 'trial', label: 'Sinov darsi taklif qilindimi?' }
];

function renderInfoProvidedQuestions() {
    return LEAD_INFO_PROVIDED_QUESTIONS.map(q => `
        <div class="lead-info-question">
            <p class="lead-info-question-text">${escapeHtml(q.label)}</p>
            <div class="lead-info-yesno">
                <label class="lead-reason-option lead-reason-option--inline">
                    <input type="radio" name="info_${q.id}" value="yes" data-info-field="${q.id}">
                    <span>Ha</span>
                </label>
                <label class="lead-reason-option lead-reason-option--inline">
                    <input type="radio" name="info_${q.id}" value="no" data-info-field="${q.id}">
                    <span>Yo'q</span>
                </label>
            </div>
        </div>`).join('');
}

function collectInfoProvidedData(modalBody) {
    const answers = {};

    for (const q of LEAD_INFO_PROVIDED_QUESTIONS) {
        const selected = modalBody.querySelector(`[data-info-field="${q.id}"]:checked`);
        if (!selected) {
            return { error: `"${q.label}" savoliga javob bering` };
        }
        answers[q.id] = selected.value;
    }

    const hasNo = LEAD_INFO_PROVIDED_QUESTIONS.some(q => answers[q.id] === 'no');
    if (hasNo) {
        return {
            error: 'Barcha bandlar uchun «Ha» javobi kerak. Ma\'lumot berildi ustuniga ko\'chirish mumkin emas.'
        };
    }

    return {
        data: LEAD_INFO_PROVIDED_QUESTIONS.map(q => ({
            id: q.id,
            label: q.label,
            answer: answers[q.id],
            answerLabel: 'Ha'
        }))
    };
}

function formatInfoProvidedComment(answers) {
    const lines = answers.map(a => `• ${a.label} Ha`);
    return ['Ma\'lumot berildi — tekshiruv:', ...lines].join('\n');
}

function openInfoProvidedModal(lang, leadId, options = {}) {
    const { chainTo = null } = options;
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const bodyHtml = `<div class="lead-survey lead-survey--info">
        ${renderInfoProvidedQuestions()}
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — Ma'lumot berildi`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelInfoProvided">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmInfoProvided">${chainTo ? 'Keyingi bosqich' : "Saqlash va ko'chirish"}</button>`,
        { wide: true }
    );

    document.getElementById('cancelInfoProvided').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmInfoProvided').onclick = () => {
        const modalBody = document.getElementById('modalBody');
        const result = collectInfoProvidedData(modalBody);
        if (result.error) {
            alert(result.error);
            return;
        }

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const answers = result.data;
        const commentText = formatInfoProvidedComment(answers);

        const updated = updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            const next = {
                ...base,
                infoProvidedSurvey: answers,
                comments: [...base.comments, createLeadComment({
                    type: 'info-provided',
                    text: commentText,
                    author
                })]
            };
            if (!chainTo) {
                next.status = 'malumot-berildi';
            }
            return next;
        });

        if (!updated) {
            alert('Lid topilmadi');
            return;
        }

        closeModal();
        if (chainTo === '__cascade__') { continueMvCascade(); return; }
        if (chainTo === 'qaror-jarayonida') {
            openDecisionProcessModal(lang, leadId);
            return;
        }
        if (chainTo === 'tolov-jarayonida') {
            const current = getLeadById(lang, leadId);
            openTolovJarayonidaFlow(lang, leadId, current?.status);
            return;
        }
        if (chainTo === 'tolov-yopildi') {
            const current = getLeadById(lang, leadId);
            openTolovYopildiFlow(lang, leadId, current?.status);
            return;
        }
        renderLeads();
    };
}

const LEAD_DECISION_REASONS = [
    { id: 'price-compare', label: 'Narxni solishtiryapti' },
    { id: 'parents', label: 'Ota-ona bilan maslahat' },
    { id: 'time', label: 'Vaqti mos emas' },
    { id: 'schedule', label: 'Ish jadvali noaniq' },
    { id: 'other', label: 'Boshqa' }
];

function openDecisionProcessModal(lang, leadId, options = {}) {
    const { chainTo = null } = options;
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const optionsHtml = LEAD_DECISION_REASONS.map(r => `
        <label class="lead-reason-option">
            <input type="radio" name="decisionReason" value="${r.id}" data-decision-radio>
            <span>${escapeHtml(r.label)}</span>
        </label>`).join('');

    openModal(
        `${escapeHtml(lead.name)} — Qaror jarayonida`,
        `<h4 class="lead-survey-title" style="margin:0 0 8px">Mijoz nega o'ylab ko'ryapti</h4>
         <p class="lead-reason-subtitle">Sababini ko'rsating:</p>
         <div class="lead-reason-list">${optionsHtml}</div>`,
        `<button type="button" class="btn-danger-sm" id="cancelDecisionProcess">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmDecisionProcess">${chainTo ? 'Keyingi bosqich' : "Saqlash va ko'chirish"}</button>`
    );

    document.getElementById('cancelDecisionProcess').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmDecisionProcess').onclick = () => {
        const modalBody = document.getElementById('modalBody');
        const selected = modalBody?.querySelector('[data-decision-radio]:checked');
        if (!selected) {
            alert('Sababni tanlang');
            return;
        }
        const reason = LEAD_DECISION_REASONS.find(r => r.id === selected.value);
        if (!reason) return;

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const commentText = `Qaror jarayonida — sabab:\n• ${reason.label}`;

        const updated = updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            const next = {
                ...base,
                decisionSurvey: { reason: reason.id, reasonLabel: reason.label },
                comments: [...base.comments, createLeadComment({
                    type: 'decision-process',
                    text: commentText,
                    reason: reason.label,
                    author
                })]
            };
            if (!chainTo) {
                next.status = 'qaror-jarayonida';
            }
            return next;
        });

        if (!updated) {
            alert('Lid topilmadi');
            return;
        }

        closeModal();
        if (chainTo === '__cascade__') { continueMvCascade(); return; }
        if (chainTo === 'tolov-jarayonida') {
            openPaymentTeacherScheduleModal(lang, leadId);
            return;
        }
        renderLeads();
    };
}

const LEAD_PAYMENT_TYPES = [
    { id: 'full', label: 'To\'liq to\'lov' },
    { id: 'partial', label: 'Qisman to\'lov' },
    { id: 'debtor', label: 'Qarzdor (keyin to\'laydi)' },
    { id: 'installment', label: 'Nasiya (hamkor orqali)' }
];

const LEAD_INSTALLMENT_PARTNERS = [
    { id: 'paylater', label: 'Paylater' },
    { id: 'uzum', label: 'Uzum Nasiya' },
    { id: 'other', label: 'Boshqa' }
];

const LEAD_TARIFFS = [
    { id: '15', label: '15 daqiqalik' },
    { id: '30', label: '30 daqiqalik' },
    { id: '60', label: '60 daqiqalik' }
];

const LEAD_TARIFF_AMOUNTS = {
    '15': [
        { id: '1497000', label: '1,497,000' },
        { id: '1200000', label: '1,200,000' }
    ],
    '30': [
        { id: '1999000', label: '1,999,000' },
        { id: '1499000', label: '1,499,000' }
    ],
    '60': [
        { id: '5999000', label: '5,999,000' },
        { id: '4500000', label: '4,500,000' },
        { id: '3000000-month', label: '3,000,000 (individual oyiga)' },
        { id: '2000000-month-discount', label: '2,000,000 (individual oyiga chegirma bilan)' }
    ]
};

function renderPaymentRadioGroup(name, options) {
    return `<div class="lead-survey-options">${options.map(o => `
        <label class="lead-reason-option">
            <input type="radio" name="${name}" value="${escapeHtml(o.id)}" data-payment-field="${name}">
            <span>${escapeHtml(o.label)}</span>
        </label>`).join('')}</div>`;
}

function renderPaymentAmountOptions(tariffId) {
    const amounts = LEAD_TARIFF_AMOUNTS[tariffId];
    if (!amounts?.length) {
        return '<p class="text-muted lead-empty-hint">Avval tarifni tanlang</p>';
    }
    return amounts.map(a => `
        <label class="lead-reason-option">
            <input type="radio" name="paymentAmount" value="${escapeHtml(a.id)}" data-payment-field="amount">
            <span>${escapeHtml(a.label)}</span>
        </label>`).join('');
}

function parsePaymentAmountNumber(amountId) {
    const match = String(amountId || '').match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
}

function parseMoneyInput(val) {
    const n = Number(String(val || '').replace(/\s/g, '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
}

function formatUzMoney(n) {
    return Number(n).toLocaleString('uz-UZ');
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function addDaysIsoDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function formatUzDate(iso) {
    if (!iso) return '';
    const [y, m, day] = iso.split('-');
    if (!y || !m || !day) return iso;
    return `${day}.${m}.${y}`;
}

function initPaymentSurveyForm(modalBody) {
    const partnerBlock = modalBody.querySelector('#installmentPartnerBlock');
    const partialBlock = modalBody.querySelector('#partialPaymentBlock');
    const amountContainer = modalBody.querySelector('#paymentAmountOptions');
    const paidInput = modalBody.querySelector('#paymentPaidAmount');
    const debtOutput = modalBody.querySelector('#paymentDebtAmount');
    const lastPaymentInput = modalBody.querySelector('#paymentLastPaymentDate');
    const nextPaymentInput = modalBody.querySelector('#paymentNextPaymentDate');

    const syncPartnerVisibility = () => {
        const installment = modalBody.querySelector('[data-payment-field="paymentType"][value="installment"]')?.checked;
        if (!partnerBlock) return;
        partnerBlock.hidden = !installment;
        partnerBlock.style.display = installment ? '' : 'none';
        if (!installment) {
            partnerBlock.querySelectorAll('[data-payment-field="installmentPartner"]').forEach(r => {
                r.checked = false;
            });
        }
    };

    const syncPartialVisibility = () => {
        const isPartial = modalBody.querySelector('[data-payment-field="paymentType"][value="partial"]')?.checked;
        if (!partialBlock) return;
        partialBlock.hidden = !isPartial;
        partialBlock.style.display = isPartial ? '' : 'none';
        if (!isPartial && paidInput) {
            paidInput.value = '';
            if (debtOutput) debtOutput.textContent = '—';
            if (lastPaymentInput) lastPaymentInput.value = '';
            if (nextPaymentInput) nextPaymentInput.value = '';
        } else {
            if (lastPaymentInput && !lastPaymentInput.value) {
                lastPaymentInput.value = todayIsoDate();
            }
            if (nextPaymentInput && !nextPaymentInput.value) {
                nextPaymentInput.value = addDaysIsoDate(10);
            }
            syncPartialDebt();
        }
    };

    const syncPartialDebt = () => {
        if (!debtOutput) return;
        const isPartial = modalBody.querySelector('[data-payment-field="paymentType"][value="partial"]')?.checked;
        if (!isPartial) {
            debtOutput.textContent = '—';
            return;
        }
        const total = getSelectedPaymentTotal(modalBody);
        const paid = parseMoneyInput(paidInput?.value);
        if (total == null) {
            debtOutput.textContent = 'Avval summani tanlang';
            return;
        }
        if (!paidInput?.value?.trim()) {
            debtOutput.textContent = '—';
            return;
        }
        if (!Number.isFinite(paid)) {
            debtOutput.textContent = 'Noto\'g\'ri summa';
            return;
        }
        const debt = Math.max(0, total - paid);
        debtOutput.textContent = `${formatUzMoney(debt)} so'm`;
    };

    const syncAmountOptions = () => {
        const tariff = modalBody.querySelector('[data-payment-field="tariff"]:checked');
        if (!amountContainer) return;
        amountContainer.innerHTML = tariff
            ? renderPaymentAmountOptions(tariff.value)
            : '<p class="text-muted lead-empty-hint">Avval tarifni tanlang</p>';
        amountContainer.querySelectorAll('[data-payment-field="amount"]').forEach(radio => {
            radio.addEventListener('change', syncPartialDebt);
        });
        syncPartialDebt();
    };

    modalBody.querySelectorAll('[data-payment-field="paymentType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            syncPartnerVisibility();
            syncPartialVisibility();
        });
    });
    modalBody.querySelectorAll('[data-payment-field="tariff"]').forEach(radio => {
        radio.addEventListener('change', syncAmountOptions);
    });
    paidInput?.addEventListener('input', syncPartialDebt);

    syncPartnerVisibility();
    syncPartialVisibility();
}

function getSelectedPaymentTotal(modalBody) {
    const amount = modalBody.querySelector('[data-payment-field="amount"]:checked');
    if (!amount) return null;
    return parsePaymentAmountNumber(amount.value);
}

function collectPaymentSurveyData(modalBody) {
    const getRadio = name => modalBody.querySelector(`[data-payment-field="${name}"]:checked`);

    const paymentType = getRadio('paymentType');
    const tariff = getRadio('tariff');
    const amount = getRadio('amount');

    if (!paymentType) return { error: 'To\'lov turini tanlang' };
    if (!tariff) return { error: 'Tarifni tanlang' };
    if (!amount) return { error: 'Summani tanlang' };

    let installmentPartner = null;
    let installmentPartnerLabel = '';

    if (paymentType.value === 'installment') {
        installmentPartner = getRadio('installmentPartner');
        if (!installmentPartner) return { error: 'Nasiya hamkorini tanlang' };
        installmentPartnerLabel = getSurveyOptionLabel(LEAD_INSTALLMENT_PARTNERS, installmentPartner.value);
    }

    const tariffLabel = getSurveyOptionLabel(LEAD_TARIFFS, tariff.value);
    const amountLabel = LEAD_TARIFF_AMOUNTS[tariff.value]?.find(a => a.id === amount.value)?.label || amount.value;
    const paymentTypeLabel = getSurveyOptionLabel(LEAD_PAYMENT_TYPES, paymentType.value);
    const totalAmount = parsePaymentAmountNumber(amount.value);

    let paidAmount = null;
    let paidAmountLabel = '';
    let debtAmount = null;
    let debtAmountLabel = '';
    let lastPaymentDate = null;
    let nextPaymentDate = null;

    if (paymentType.value === 'partial') {
        const paidRaw = modalBody.querySelector('#paymentPaidAmount')?.value?.trim();
        if (!paidRaw) return { error: 'Qancha to\'laganini kiriting' };
        const paid = parseMoneyInput(paidRaw);
        if (!Number.isFinite(paid) || paid <= 0) {
            return { error: 'To\'langan summa noto\'g\'ri' };
        }
        if (paid > totalAmount) {
            return { error: 'To\'langan summa umumiy summadan katta bo\'lmasligi kerak' };
        }
        paidAmount = paid;
        paidAmountLabel = formatUzMoney(paid);
        debtAmount = totalAmount - paid;
        debtAmountLabel = formatUzMoney(debtAmount);

        lastPaymentDate = modalBody.querySelector('#paymentLastPaymentDate')?.value || '';
        nextPaymentDate = modalBody.querySelector('#paymentNextPaymentDate')?.value || '';
        if (!lastPaymentDate) return { error: 'Oxirgi to\'lov sanasini kiriting' };
        if (!nextPaymentDate) return { error: 'Keyingi to\'lov sanasini kiriting' };
    }

    return {
        data: {
            paymentType: paymentType.value,
            paymentTypeLabel,
            installmentPartner: installmentPartner?.value || null,
            installmentPartnerLabel,
            tariff: tariff.value,
            tariffLabel,
            amount: amount.value,
            amountLabel,
            totalAmount,
            paidAmount,
            paidAmountLabel,
            debtAmount,
            debtAmountLabel,
            lastPaymentDate,
            lastPaymentDateLabel: lastPaymentDate ? formatUzDate(lastPaymentDate) : '',
            nextPaymentDate,
            nextPaymentDateLabel: nextPaymentDate ? formatUzDate(nextPaymentDate) : ''
        }
    };
}

function formatPaymentSurveyComment(survey) {
    const lines = [
        `• To'lov turi: ${survey.paymentTypeLabel}`,
        `• Tarif: ${survey.tariffLabel}`,
        `• Summa: ${survey.amountLabel}`
    ];
    if (survey.installmentPartnerLabel) {
        lines.splice(1, 0, `• Nasiya hamkori: ${survey.installmentPartnerLabel}`);
    }
    if (survey.paymentType === 'partial' && survey.paidAmountLabel) {
        lines.push(`• To'langan: ${survey.paidAmountLabel} so'm`);
        lines.push(`• Qarzdorlik: ${survey.debtAmountLabel} so'm`);
        if (survey.lastPaymentDateLabel) {
            lines.push(`• Qachon to'ladi: ${survey.lastPaymentDateLabel}`);
        }
        if (survey.nextPaymentDateLabel) {
            lines.push(`• Keyingi to'lov: ${survey.nextPaymentDateLabel}`);
        }
    }
    return ['To\'lov jarayonida — to\'lov:', ...lines].join('\n');
}

const LEAD_COURSE_LEVELS = [
    { id: 'zero', label: '0 dan' },
    { id: 'beginner', label: 'Boshlang\'ich' },
    { id: 'intermediate', label: 'O\'rta' },
    { id: 'advanced', label: 'Yuqori' }
];

const LEAD_CONTRACT_TYPES = [
    { id: 'partial', label: 'Qisman to\'lov bo\'yicha shartnoma tuzildi' },
    { id: 'full', label: 'To\'liq to\'lov bo\'yicha shartnoma tuzildi' }
];

function renderSurveyYesNo(name, label) {
    return `<div class="lead-info-question">
        <p class="lead-info-question-text">${escapeHtml(label)}</p>
        <div class="lead-info-yesno">
            <label class="lead-reason-option lead-reason-option--inline">
                <input type="radio" name="${name}" value="yes" data-onboard-field="${name}">
                <span>Ha</span>
            </label>
            <label class="lead-reason-option lead-reason-option--inline">
                <input type="radio" name="${name}" value="no" data-onboard-field="${name}">
                <span>Yo'q</span>
            </label>
        </div>
    </div>`;
}

function renderOnboardTeacherOptions(teachers, emptyLabel) {
    const opts = `<option value="">${escapeHtml(emptyLabel)}</option>` +
        teachers.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
    return opts;
}

function getTeacherLessonDays(teacher) {
    const pattern = SCHEDULE_PATTERNS[teacher?.schedulePattern || 'mwf'] || SCHEDULE_PATTERNS.mwf;
    return pattern.days;
}

function weeklyLessonSlotKey(dayOfWeek, time) {
    return `${dayOfWeek}_${time}`;
}

function parseTimetableSlotKey(key) {
    const match = String(key).match(/^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})_(.+)$/);
    if (!match) return null;
    const [, dateStr, time, teacherId] = match;
    const date = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return { dateStr, time, teacherId, dayOfWeek: date.getDay() };
}

function getTeacherBusyWeeklySlots(teacherId, excludeStudentId = null) {
    const busy = new Map();
    const students = getItem(STORAGE_KEYS.students, []);
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    students.forEach(s => {
        if (s.teacherId !== teacherId || s.lessonDayOfWeek == null || !s.lessonTime) return;
        if (excludeStudentId && s.id === excludeStudentId) return;
        const teacher = teachers.find(t => t.id === teacherId);
        const duration = s.lessonDuration || teacher?.lessonDuration || 15;
        const daysList = [1, 3, 5].includes(Number(s.lessonDayOfWeek)) ? [1, 3, 5] : [2, 4, 6].includes(Number(s.lessonDayOfWeek)) ? [2, 4, 6] : [Number(s.lessonDayOfWeek)];
        daysList.forEach(dow => {
            markWeeklySlotBusy(busy, dow, s.lessonTime, duration, {
                label: s.name || 'O\'quvchi',
                studentId: s.id,
                source: 'student',
                duration
            });
        });
    });

    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    [...(leads.english || []), ...(leads.russian || [])].forEach(lead => {
        const onboarding = lead.paymentOnboarding;
        if (!onboarding || onboarding.teacherId !== teacherId) return;
        if (onboarding.lessonDayOfWeek == null || !onboarding.lessonTime) return;
        const teacher = teachers.find(t => t.id === teacherId);
        const duration = getLeadLessonDuration(lead, teacher);
        let daysList = [1, 3, 5].includes(Number(onboarding.lessonDayOfWeek)) ? [1, 3, 5] : [2, 4, 6].includes(Number(onboarding.lessonDayOfWeek)) ? [2, 4, 6] : [Number(onboarding.lessonDayOfWeek)];
        if (onboarding.isTrial && onboarding.trialDaysCount) {
            const idx = daysList.indexOf(Number(onboarding.lessonDayOfWeek));
            if (idx >= 0) {
                const reordered = daysList.slice(idx).concat(daysList.slice(0, idx));
                daysList = reordered.slice(0, onboarding.trialDaysCount);
            }
        }
        daysList.forEach(dow => {
            markWeeklySlotBusy(busy, dow, onboarding.lessonTime, duration, {
                label: lead.name || 'Lid',
                studentId: lead.serialCode || 'LID',
                source: onboarding.isTrial ? 'trial' : 'lead',
                duration
            });
        });
    });

    const studentNames = Object.fromEntries(students.map(s => [s.id, s.name || '']));
    const timetable = getItem(STORAGE_KEYS.timetable, {});
    Object.entries(timetable).forEach(([key, entry]) => {
        if (!entry?.studentId) return;
        const parsed = parseTimetableSlotKey(key);
        if (!parsed || parsed.teacherId !== teacherId) return;
        if (!parsed.dayOfWeek) return;
        const teacher = teachers.find(t => t.id === teacherId);
        const duration = teacher?.lessonDuration || 15;
        const label = studentNames[entry.studentId] || 'Probniy dars';
        markWeeklySlotBusy(busy, parsed.dayOfWeek, parsed.time, duration, {
            label,
            studentId: entry.studentId,
            source: 'timetable',
            duration
        });
    });

    return busy;
}

function getOnboardScheduleTimeSlots(teacher) {
    const duration = teacher?.lessonDuration || 15;
    const step = duration >= 60 ? 4 : duration >= 30 ? 2 : 1;
    return generateTimeSlots().filter((_, i) => i % step === 0);
}

function renderOnboardTeacherSchedulePicker(modalBody, teacherId, options = {}) {
    const container = modalBody.querySelector('#onboardSchedulePicker');
    const selectedEl = modalBody.querySelector('#onboardScheduleSelected');
    if (!container) return;

    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) {
        container.innerHTML = '<p class="text-muted lead-empty-hint">O\'qituvchi topilmadi</p>';
        return;
    }

    const { lead = null } = options;
    const lessonDuration = options.lessonDuration || getLeadLessonDuration(lead, teacher);
    const lessonDays = getTeacherLessonDays(teacher);
    const busyMap = getTeacherBusyWeeklySlots(teacherId);
    const times = generateTimeSlots();
    const patternLabel = SCHEDULE_PATTERNS[teacher.schedulePattern || 'mwf']?.label || '';

    let html = `<p class="lead-survey-sub">${escapeHtml(teacher.name)} — ${escapeHtml(patternLabel)} · ${lessonDuration} daqiqa</p>`;
    html += `<div class="onboard-schedule-legend">
        <span class="onboard-schedule-legend-item onboard-schedule-legend-item--free">Bo'sh</span>
        <span class="onboard-schedule-legend-item onboard-schedule-legend-item--busy">Band</span>
        <span class="onboard-schedule-legend-item onboard-schedule-legend-item--picked">Tanlangan</span>
    </div>`;
    html += `<div class="onboard-schedule-grid" style="--osd-cols:${lessonDays.length}">`;
    html += '<div class="onboard-schedule-corner"></div>';
    lessonDays.forEach(dow => {
        html += `<div class="onboard-schedule-day">${escapeHtml(DAYS_UZ[dow - 1] || '')}</div>`;
    });

    times.forEach(time => {
        html += `<div class="onboard-schedule-time">${time}</div>`;
        lessonDays.forEach(dow => {
            const key = weeklyLessonSlotKey(dow, time);
            const busy = busyMap.get(key);
            if (busy) {
                const display = busy.studentId || busy.label || 'Band';
                const title = busy.label ? `Band: ${busy.label}` : 'Band';
                html += `<div class="onboard-schedule-cell onboard-schedule-cell--busy" title="${escapeHtml(title)}">${escapeHtml(display)}</div>`;
            } else if (!canFitWeeklyLesson(busyMap, dow, time, lessonDuration)) {
                html += `<div class="onboard-schedule-cell onboard-schedule-cell--busy" title="Yetarli bo'sh vaqt yo'q">—</div>`;
            } else {
                html += `<div class="onboard-schedule-cell onboard-schedule-cell--free" data-onboard-schedule-slot data-day="${dow}" data-time="${time}" tabindex="0" role="button" title="Bo'sh vaqt">Bo'sh</div>`;
            }
        });
    });
    html += '</div>';
    container.innerHTML = html;

    const pickCell = cell => {
        container.querySelectorAll('.onboard-schedule-cell--picked').forEach(c => {
            c.classList.remove('onboard-schedule-cell--picked');
            c.classList.add('onboard-schedule-cell--free');
            c.textContent = 'Bo\'sh';
        });
        cell.classList.remove('onboard-schedule-cell--free');
        cell.classList.add('onboard-schedule-cell--picked');
        cell.textContent = 'Tanlandi';
        const dow = parseInt(cell.dataset.day, 10);
        const time = cell.dataset.time;
        modalBody.dataset.onboardScheduleDay = String(dow);
        modalBody.dataset.onboardScheduleTime = time;
        if (selectedEl) {
            selectedEl.textContent = `Tanlangan: ${DAYS_UZ[dow - 1] || ''}, ${time}`;
        }
    };

    container.querySelectorAll('[data-onboard-schedule-slot]').forEach(cell => {
        const activate = () => pickCell(cell);
        cell.addEventListener('click', activate);
        cell.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });
    });

    const savedDay = modalBody.dataset.onboardScheduleDay;
    const savedTime = modalBody.dataset.onboardScheduleTime;
    if (savedDay && savedTime) {
        const savedCell = container.querySelector(`[data-day="${savedDay}"][data-time="${savedTime}"]`);
        if (savedCell) pickCell(savedCell);
        else if (selectedEl) selectedEl.textContent = '';
    } else if (selectedEl) {
        selectedEl.textContent = '';
    }
}

function wireTeacherSchedulePicker(modalBody, options = {}) {
    const { lead = null } = options;
    const existing = lead?.paymentOnboarding;
    if (existing?.teacherId) {
        const teacherSel = modalBody.querySelector('#onboardTeacherId');
        if (teacherSel) teacherSel.value = existing.teacherId;
    }
    if (existing?.lessonDayOfWeek != null && existing.lessonTime) {
        modalBody.dataset.onboardScheduleDay = String(existing.lessonDayOfWeek);
        modalBody.dataset.onboardScheduleTime = existing.lessonTime;
    }

    const teacherSel = modalBody.querySelector('#onboardTeacherId');
    const scheduleBlock = modalBody.querySelector('#onboardScheduleBlock');
    const syncTeacherSchedule = () => {
        const teacherId = teacherSel?.value || '';
        if (!teacherId || !scheduleBlock) {
            if (scheduleBlock) {
                scheduleBlock.hidden = true;
                scheduleBlock.style.display = 'none';
            }
            delete modalBody.dataset.onboardScheduleDay;
            delete modalBody.dataset.onboardScheduleTime;
            const selectedEl = modalBody.querySelector('#onboardScheduleSelected');
            if (selectedEl) selectedEl.textContent = '';
            return;
        }
        scheduleBlock.hidden = false;
        scheduleBlock.style.display = '';
        const teachers = getItem(STORAGE_KEYS.teachers, []);
        const teacher = teachers.find(t => t.id === teacherId);
        const lessonDuration = getLeadLessonDuration(lead, teacher);
        renderOnboardTeacherSchedulePicker(modalBody, teacherId, { lead, lessonDuration });
    };

    teacherSel?.addEventListener('change', () => {
        delete modalBody.dataset.onboardScheduleDay;
        delete modalBody.dataset.onboardScheduleTime;
        syncTeacherSchedule();
    });
    syncTeacherSchedule();
}

function collectTeacherScheduleData(modalBody) {
    const teacherId = modalBody.querySelector('#onboardTeacherId')?.value?.trim() || '';
    if (!teacherId) return { error: 'Asosiy ustozni tanlang' };

    const lessonDayOfWeekRaw = modalBody.dataset.onboardScheduleDay;
    const lessonTime = modalBody.dataset.onboardScheduleTime || '';
    if (!lessonDayOfWeekRaw || !lessonTime) {
        return { error: 'Dars kunini va soatini jadvaldan tanlang' };
    }

    const lessonDayOfWeek = parseInt(lessonDayOfWeekRaw, 10);
    const lessonDayLabel = DAYS_UZ[lessonDayOfWeek - 1] || '';
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const teacher = teachers.find(t => t.id === teacherId);
    const teacherName = teacher?.name || '';
    const duration = teacher?.lessonDuration || 15;
    const busy = getTeacherBusyWeeklySlots(teacherId);
    if (!canFitWeeklyLesson(busy, lessonDayOfWeek, lessonTime, duration)) {
        return { error: 'Tanlangan vaqt band yoki dars davomiyligi uchun yetarli bo\'sh slot yo\'q' };
    }

    return {
        data: {
            teacherId,
            teacherName,
            lessonDayOfWeek,
            lessonDayLabel,
            lessonTime,
            lessonScheduleLabel: `${lessonDayLabel}, ${lessonTime}`
        }
    };
}

function renderTeacherScheduleSection(asosiyTeachers) {
    return `<section class="lead-survey-section">
        <div class="lead-survey-field">
            <label for="onboardTeacherId">Asosiy ustoz</label>
            <select id="onboardTeacherId" class="form-select">
                ${renderOnboardTeacherOptions(asosiyTeachers, "Asosiy ustozni tanlang")}
            </select>
        </div>
        <div id="onboardScheduleBlock" class="lead-survey-field" hidden>
            <span class="lead-survey-label">Dars kunlari va soati</span>
            <p class="lead-survey-hint">O'qituvchining band va bo'sh vaqtlarini ko'rib, bo'sh slotdan tanlang.</p>
            <div id="onboardSchedulePicker" class="onboard-schedule-picker"></div>
            <output id="onboardScheduleSelected" class="onboard-schedule-selected" for="onboardSchedulePicker"></output>
        </div>
    </section>`;
}

function openPaymentTeacherScheduleModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    if (leadHasTeacherSchedule(lead)) {
        ensureLeadPaymentStatus(lang, leadId);
        openPaymentProcessModal(lang, leadId);
        return;
    }

    const subject = lang === 'russian' ? 'russian' : 'english';
    const asosiyTeachers = filterTeachersByTypeAndSubject('asosiy', subject);

    const bodyHtml = `<div class="lead-survey lead-survey--schedule">
        ${renderTeacherScheduleSection(asosiyTeachers)}
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — Dars jadvali`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelPaymentTeacherSchedule">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmPaymentTeacherSchedule">Keyingi bosqich</button>`,
        { wide: true }
    );

    const modalBody = document.getElementById('modalBody');
    wireTeacherSchedulePicker(modalBody, { lead });

    document.getElementById('cancelPaymentTeacherSchedule').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmPaymentTeacherSchedule').onclick = () => {
        const result = collectTeacherScheduleData(modalBody);
        if (result.error) {
            alert(result.error);
            return;
        }

        ensureLeadPaymentStatus(lang, leadId, result.data);
        closeModal();
        openPaymentProcessModal(lang, leadId);
    };
}

function initPaymentOnboardingForm(modalBody, options = {}) {
    const { lead = null } = options;
    wireTeacherSchedulePicker(modalBody, { lead });

    const contractNumberBlock = modalBody.querySelector('#onboardContractNumberBlock');
    const syncContractNumber = () => {
        const selected = modalBody.querySelector('[data-onboard-field="contractType"]:checked');
        if (!contractNumberBlock) return;
        const show = !!selected;
        contractNumberBlock.hidden = !show;
        contractNumberBlock.style.display = show ? '' : 'none';
        if (!show) {
            const input = modalBody.querySelector('#onboardContractNumber');
            if (input) input.value = '';
        }
    };
    modalBody.querySelectorAll('[data-onboard-field="contractType"]').forEach(radio => {
        radio.addEventListener('change', syncContractNumber);
    });
    syncContractNumber();
}

function collectPaymentOnboardingData(modalBody) {
    const getRadio = name => modalBody.querySelector(`[data-onboard-field="${name}"]:checked`);
    const getVal = id => modalBody.querySelector(`#${id}`)?.value?.trim() || '';

    const becomeStudent = getRadio('becomeStudent');
    const platformConnected = getRadio('platformConnected');
    const contractType = getRadio('contractType');

    if (!becomeStudent) return { error: '«O\'quvchiga aylansinmi?» savoliga javob bering' };
    if (!platformConnected) return { error: '«Platforma ulab berildimi?» savoliga javob bering' };
    if (!contractType) return { error: 'Shartnoma turini tanlang' };

    const contractNumber = getVal('onboardContractNumber');
    if (!contractNumber) return { error: 'Shartnoma raqamini kiriting' };

    const studentFirstName = getVal('onboardStudentFirstName');
    const studentLastName = getVal('onboardStudentLastName');
    if (!studentFirstName) return { error: 'O\'quvchi ismi kiritilishi shart' };
    if (!studentLastName) return { error: 'O\'quvchi familiyasi kiritilishi shart' };
    const studentFullName = `${studentFirstName} ${studentLastName}`.trim();

    const genderRadio = getRadio('gender');
    if (!genderRadio) return { error: 'Jinsi tanlanishi shart' };

    const courseLevel = getRadio('courseLevel');
    if (!courseLevel) return { error: 'Kurs darajasini tanlang' };

    const bookAddress = getVal('onboardBookAddress');
    if (!bookAddress) return { error: 'Kitob yetkazib berish manzilini kiriting' };

    const teacherId = getVal('onboardTeacherId');
    if (!teacherId) return { error: 'O\'qituvchini tanlang' };

    const lessonDayOfWeekRaw = modalBody.dataset.onboardScheduleDay;
    const lessonTime = modalBody.dataset.onboardScheduleTime || '';
    if (!lessonDayOfWeekRaw || !lessonTime) {
        return { error: 'Dars kunini va soatini jadvaldan tanlang' };
    }
    const lessonDayOfWeek = parseInt(lessonDayOfWeekRaw, 10);
    const lessonDayLabel = DAYS_UZ[lessonDayOfWeek - 1] || '';

    const firstLessonDate = getVal('onboardFirstLessonDate');
    if (!firstLessonDate) return { error: 'Ilk dars boshlash sanasini belgilang' };

    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const assistantTeacherId = getVal('onboardAssistantTeacherId');
    const contractLabel = getSurveyOptionLabel(LEAD_CONTRACT_TYPES, contractType.value);
    const courseLevelLabel = getSurveyOptionLabel(LEAD_COURSE_LEVELS, courseLevel.value);
    const teacherName = teachers.find(t => t.id === teacherId)?.name || '';
    const assistantName = assistantTeacherId
        ? (teachers.find(t => t.id === assistantTeacherId)?.name || '')
        : '';

    return {
        data: {
            becomeStudent: becomeStudent.value,
            becomeStudentLabel: becomeStudent.value === 'yes' ? 'Ha' : 'Yo\'q',
            platformConnected: platformConnected.value,
            platformConnectedLabel: platformConnected.value === 'yes' ? 'Ha' : 'Yo\'q',
            contractType: contractType.value,
            contractTypeLabel: contractLabel,
            contractNumber,
            studentFullName,
            studentFirstName,
            studentLastName,
            gender: genderRadio.value,
            genderLabel: genderRadio.value === 'erkak' ? 'Erkak' : 'Ayol',
            courseLevel: courseLevel.value,
            courseLevelLabel,
            bookAddress,
            teacherId,
            teacherName,
            assistantTeacherId: assistantTeacherId || null,
            assistantTeacherName: assistantName,
            lessonDayOfWeek,
            lessonDayLabel,
            lessonTime,
            lessonScheduleLabel: `${lessonDayLabel}, ${lessonTime}`,
            firstLessonDate
        }
    };
}

function formatPaymentOnboardingComment(data) {
    const lines = [
        `• O'quvchiga aylansinmi: ${data.becomeStudentLabel}`,
        `• Platforma ulab berildi: ${data.platformConnectedLabel}`,
        `• Shartnoma: ${data.contractTypeLabel} (№ ${data.contractNumber})`,
        '— Kitob yetkazib berish:',
        `• O'quvchi: ${data.studentFullName}`,
        `• Kurs darajasi: ${data.courseLevelLabel}`,
        `• Manzil: ${data.bookAddress}`,
        `• O'qituvchi: ${data.teacherName}`,
        `• Dars jadvali: ${data.lessonScheduleLabel}`,
        `• Yordamchi: ${data.assistantTeacherName || '—'}`,
        `• Ilk dars sanasi: ${data.firstLessonDate}`
    ];
    return ['To\'lov jarayonida — o\'quvchi:', ...lines].join('\n');
}

function openPaymentOnboardingModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const subject = lang === 'russian' ? 'russian' : 'english';
    const asosiyTeachers = filterTeachersByTypeAndSubject('asosiy', subject);
    const yordamchiTeachers = filterTeachersByTypeAndSubject('yordamchi', subject);
    const defaultName = lead.name || '';

    const bodyHtml = `<div class="lead-survey lead-survey--onboard">
        ${renderSurveyYesNo('becomeStudent', "O'quvchiga aylansinmi?")}
        ${renderSurveyYesNo('platformConnected', "O'quvchiga platforma ulab berildimi?")}
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">O'quvchi bilan shartnoma tuzildimi?</h4>
            ${renderPaymentRadioGroup('contractType', LEAD_CONTRACT_TYPES).replace(/data-payment-field/g, 'data-onboard-field')}
            <div id="onboardContractNumberBlock" class="lead-survey-field lead-contract-number-block" hidden>
                <label for="onboardContractNumber">Shartnoma raqami</label>
                <input type="text" id="onboardContractNumber" class="form-control" placeholder="Shartnoma raqamini kiriting">
            </div>
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Kitob yetkazib berish bo'yicha</h4>
            <div style="display:flex;gap:10px">
                <div class="lead-survey-field" style="flex:1">
                    <label for="onboardStudentFirstName">Ism <span style="color:var(--danger)">*</span></label>
                    <input type="text" id="onboardStudentFirstName" class="form-control" value="${escapeHtml(defaultName.split(' ')[0] || '')}" placeholder="Ism">
                </div>
                <div class="lead-survey-field" style="flex:1">
                    <label for="onboardStudentLastName">Familiya <span style="color:var(--danger)">*</span></label>
                    <input type="text" id="onboardStudentLastName" class="form-control" value="${escapeHtml(defaultName.split(' ').slice(1).join(' ') || '')}" placeholder="Familiya">
                </div>
            </div>
            <div class="lead-survey-field">
                <label>Jinsi <span style="color:var(--danger)">*</span></label>
                <div class="lead-survey-options" style="flex-direction:row;gap:10px">
                    <label class="lead-reason-option lead-reason-option--inline">
                        <input type="radio" name="onboardGender" value="erkak" data-onboard-field="gender">
                        <span>Erkak</span>
                    </label>
                    <label class="lead-reason-option lead-reason-option--inline">
                        <input type="radio" name="onboardGender" value="ayol" data-onboard-field="gender">
                        <span>Ayol</span>
                    </label>
                </div>
            </div>
            <div class="lead-survey-field">
                <span class="lead-survey-label">Kurs darajasi</span>
                <div class="lead-survey-options lead-survey-options--compact lead-survey-options--levels">
                    ${LEAD_COURSE_LEVELS.map(l => `
                        <label class="lead-reason-option">
                            <input type="radio" name="courseLevel" value="${escapeHtml(l.id)}" data-onboard-field="courseLevel">
                            <span>${escapeHtml(l.label)}</span>
                        </label>`).join('')}
                </div>
            </div>
            <div class="lead-survey-field">
                <label for="onboardBookAddress">Kitob yetkazib berilishdagi aniq manzil</label>
                <textarea id="onboardBookAddress" class="form-control" rows="2" placeholder="Manzil"></textarea>
            </div>
        </section>
        <section class="lead-survey-section">
            ${renderTeacherScheduleSection(asosiyTeachers)}
            <div class="lead-survey-field">
                <label for="onboardAssistantTeacherId">Yordamchi o'qituvchi</label>
                <select id="onboardAssistantTeacherId" class="form-select">
                    ${renderOnboardTeacherOptions(yordamchiTeachers, 'Yordamchi o\'qituvchi biriktirilsin')}
                </select>
            </div>
            <div class="lead-survey-field">
                <label for="onboardFirstLessonDate">Ilk dars boshlash sanasi</label>
                <input type="date" id="onboardFirstLessonDate" class="form-control">
            </div>
        </section>
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — O'quvchi ma'lumotlari`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelPaymentOnboarding">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmPaymentOnboarding">Saqlash va ko'chirish</button>`,
        { wide: true }
    );

    const modalBody = document.getElementById('modalBody');
    initPaymentOnboardingForm(modalBody, { lead });

    document.getElementById('cancelPaymentOnboarding').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmPaymentOnboarding').onclick = () => {
        const result = collectPaymentOnboardingData(modalBody);
        if (result.error) {
            alert(result.error);
            return;
        }

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const onboarding = result.data;
        const commentText = formatPaymentOnboardingComment(onboarding);

        const updated = updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            return {
                ...base,
                status: 'tolov-jarayonida',
                serialCode: base.serialCode || generateNextLeadSerial(),
                paymentOnboarding: { ...(base.paymentOnboarding || {}), ...onboarding },
                comments: [...base.comments, createLeadComment({
                    type: 'payment-onboarding',
                    text: commentText,
                    author
                })]
            };
        });

        if (!updated) {
            alert('Lid topilmadi');
            return;
        }

        const leadAfter = getLeadById(lang, leadId);
        promoteStudentFromOnboarding(lang, onboarding, leadAfter);

        closeModal();
        renderLeads();
        if (document.getElementById('tab-timetable')?.classList.contains('active')) renderTimetable();
    };
}

function openPaymentProcessModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    if (!leadHasTeacherSchedule(lead)) {
        openPaymentTeacherScheduleModal(lang, leadId);
        return;
    }

    if (lead.paymentSurvey) {
        openPaymentOnboardingModal(lang, leadId);
        return;
    }

    const bodyHtml = `<div class="lead-survey">
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">To'lov turi</h4>
            ${renderPaymentRadioGroup('paymentType', LEAD_PAYMENT_TYPES)}
        </section>
        <section id="installmentPartnerBlock" class="lead-survey-section" hidden>
            <h4 class="lead-survey-title">Nasiya hamkori</h4>
            ${renderPaymentRadioGroup('installmentPartner', LEAD_INSTALLMENT_PARTNERS)}
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Tarif</h4>
            ${renderPaymentRadioGroup('tariff', LEAD_TARIFFS)}
        </section>
        <section class="lead-survey-section">
            <h4 class="lead-survey-title">Summa</h4>
            <div id="paymentAmountOptions" class="lead-survey-options">
                <p class="text-muted lead-empty-hint">Avval tarifni tanlang</p>
            </div>
        </section>
        <section id="partialPaymentBlock" class="lead-survey-section" hidden>
            <h4 class="lead-survey-title">Qisman to'lov tafsilotlari</h4>
            <div class="lead-survey-field">
                <label for="paymentPaidAmount">Qancha to'ladi</label>
                <input type="text" id="paymentPaidAmount" class="form-control" inputmode="numeric" placeholder="Masalan: 500 000">
            </div>
            <div class="lead-survey-field">
                <span class="lead-survey-label">Qarzdorligi</span>
                <output id="paymentDebtAmount" class="lead-payment-debt" for="paymentPaidAmount">—</output>
                <p class="lead-survey-hint">Tarif summasidan to'langan summa ayiriladi</p>
            </div>
            <div class="lead-survey-field">
                <label for="paymentLastPaymentDate">Qachon to'ladi</label>
                <input type="date" id="paymentLastPaymentDate" class="form-control">
            </div>
            <div class="lead-survey-field">
                <label for="paymentNextPaymentDate">Keyingi to'lovni qachon amalga oshiradi</label>
                <input type="date" id="paymentNextPaymentDate" class="form-control">
            </div>
        </section>
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — To'lov jarayonida`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelPaymentProcess">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmPaymentProcess">Keyingi bosqich</button>`,
        { wide: true }
    );

    const modalBody = document.getElementById('modalBody');
    initPaymentSurveyForm(modalBody);

    document.getElementById('cancelPaymentProcess').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmPaymentProcess').onclick = () => {
        const result = collectPaymentSurveyData(modalBody);
        if (result.error) {
            alert(result.error);
            return;
        }

        const user = getCurrentUser();
        const author = user?.name || 'Admin';
        const survey = result.data;
        const commentText = formatPaymentSurveyComment(survey);

        const updated = updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            return {
                ...base,
                paymentSurvey: survey,
                comments: [...base.comments, createLeadComment({
                    type: 'payment-process',
                    text: commentText,
                    author
                })]
            };
        });

        if (!updated) {
            alert('Lid topilmadi');
            return;
        }

        closeModal();
        openPaymentOnboardingModal(lang, leadId);
    };
}

function needsPaymentClosedPrompt(fromStatus, toStatus) {
    return toStatus === 'tolov-yopildi';
}

function leadHasPaymentDebt(paymentSurvey) {
    return paymentSurvey?.paymentType === 'partial'
        && Number.isFinite(paymentSurvey.debtAmount)
        && paymentSurvey.debtAmount > 0;
}

function leadHasInstallmentPayment(paymentSurvey) {
    return paymentSurvey?.paymentType === 'installment';
}

function getPaymentClosedDebtLabel(paymentSurvey) {
    if (paymentSurvey.debtAmountLabel) return `${paymentSurvey.debtAmountLabel} so'm`;
    if (Number.isFinite(paymentSurvey.debtAmount)) return `${formatUzMoney(paymentSurvey.debtAmount)} so'm`;
    return '';
}

function getPaymentClosedInstallmentLabel(paymentSurvey) {
    if (paymentSurvey.amountLabel) return paymentSurvey.amountLabel;
    if (Number.isFinite(paymentSurvey.totalAmount)) return formatUzMoney(paymentSurvey.totalAmount);
    return '';
}

function renderCloseSurveyYesNo(name, label) {
    return `<div class="lead-info-question">
        <p class="lead-info-question-text">${escapeHtml(label)}</p>
        <div class="lead-info-yesno">
            <label class="lead-reason-option lead-reason-option--inline">
                <input type="radio" name="${name}" value="yes" data-close-field="${name}">
                <span>Ha</span>
            </label>
            <label class="lead-reason-option lead-reason-option--inline">
                <input type="radio" name="${name}" value="no" data-close-field="${name}">
                <span>Yo'q</span>
            </label>
        </div>
    </div>`;
}

function renderCloseSurveyDateField(id, label, fieldName) {
    return `<div class="lead-survey-field" data-close-date-wrap="${fieldName}">
        <label for="${id}">${escapeHtml(label)}</label>
        <input type="date" id="${id}" class="form-control" data-close-field="${fieldName}" value="${todayIsoDate()}">
    </div>`;
}

function initPaymentClosedSurveyForm(modalBody) {
    const syncInstallmentDate = () => {
        const received = modalBody.querySelector('[data-close-field="installmentReceived"]:checked');
        const wrap = modalBody.querySelector('[data-close-date-wrap="installmentReceivedDate"]');
        if (!wrap) return;
        const show = received?.value === 'yes';
        wrap.hidden = !show;
        wrap.style.display = show ? '' : 'none';
        if (!show) {
            const input = modalBody.querySelector('#paymentClosedInstallmentDate');
            if (input) input.value = '';
        } else {
            const input = modalBody.querySelector('#paymentClosedInstallmentDate');
            if (input && !input.value) input.value = todayIsoDate();
        }
    };

    modalBody.querySelectorAll('[data-close-field="installmentReceived"]').forEach(radio => {
        radio.addEventListener('change', syncInstallmentDate);
    });

    syncInstallmentDate();
}

function collectPaymentClosedSurveyData(modalBody, paymentSurvey) {
    const getRadio = name => modalBody.querySelector(`[data-close-field="${name}"]:checked`);
    const getDate = name => modalBody.querySelector(`[data-close-field="${name}"]`)?.value || '';

    const closedDate = getDate('closedDate');
    if (!closedDate) return { error: 'Yopilgan sanani kiriting' };

    const hasDebt = leadHasPaymentDebt(paymentSurvey);
    const hasInstallment = leadHasInstallmentPayment(paymentSurvey);

    let debtPaid = null;
    let debtPaidLabel = '';
    let debtPaidDate = null;
    let debtPaidDateLabel = '';
    let installmentReceived = null;
    let installmentReceivedLabel = '';
    let installmentReceivedDate = null;
    let installmentReceivedDateLabel = '';

    if (hasDebt) {
        const debtPaidRadio = getRadio('debtPaid');
        if (!debtPaidRadio) {
            const debtLabel = getPaymentClosedDebtLabel(paymentSurvey);
            return { error: `«${debtLabel} summa to'landimi?» savoliga javob bering` };
        }
        debtPaid = debtPaidRadio.value;
        debtPaidLabel = debtPaid === 'yes' ? 'Ha' : 'Yo\'q';
        debtPaidDate = getDate('debtPaidDate');
        if (!debtPaidDate) return { error: 'Qarzdorlik summasi to\'langan sanani kiriting' };
        debtPaidDateLabel = formatUzDate(debtPaidDate);
    }

    if (hasInstallment) {
        const receivedRadio = getRadio('installmentReceived');
        if (!receivedRadio) {
            const amountLabel = getPaymentClosedInstallmentLabel(paymentSurvey);
            return { error: `«${amountLabel} summa to'lovi tushdimi?» savoliga javob bering` };
        }
        installmentReceived = receivedRadio.value;
        installmentReceivedLabel = installmentReceived === 'yes' ? 'Ha' : 'Yo\'q';
        if (installmentReceived === 'yes') {
            installmentReceivedDate = getDate('installmentReceivedDate');
            if (!installmentReceivedDate) return { error: 'To\'lov tushgan sanani kiriting' };
            installmentReceivedDateLabel = formatUzDate(installmentReceivedDate);
        }
    }

    return {
        data: {
            closedDate,
            closedDateLabel: formatUzDate(closedDate),
            hasDebt,
            debtAmount: hasDebt ? paymentSurvey.debtAmount : null,
            debtAmountLabel: hasDebt ? getPaymentClosedDebtLabel(paymentSurvey) : '',
            debtPaid,
            debtPaidLabel,
            debtPaidDate,
            debtPaidDateLabel,
            hasInstallment,
            installmentAmountLabel: hasInstallment ? getPaymentClosedInstallmentLabel(paymentSurvey) : '',
            installmentReceived,
            installmentReceivedLabel,
            installmentReceivedDate,
            installmentReceivedDateLabel
        }
    };
}

function formatPaymentClosedSurveyComment(survey) {
    const lines = [`• Qachon yopildi: ${survey.closedDateLabel}`];
    if (survey.hasDebt) {
        lines.push(`• ${survey.debtAmountLabel} summa to'landimi: ${survey.debtPaidLabel}`);
        if (survey.debtPaidDateLabel) {
            lines.push(`• ${survey.debtAmountLabel} qarzdorlik summasi qachon to'landi: ${survey.debtPaidDateLabel}`);
        }
    }
    if (survey.hasInstallment) {
        lines.push(`• ${survey.installmentAmountLabel} summa to'lovi tushdimi: ${survey.installmentReceivedLabel}`);
        if (survey.installmentReceived === 'yes' && survey.installmentReceivedDateLabel) {
            lines.push(`• Qachon tushdi: ${survey.installmentReceivedDateLabel}`);
        }
    }
    return ['To\'lov yopildi — so\'rovnoma:', ...lines].join('\n');
}

function renderCloseSurveyRadioGroup(name, options) {
    return `<div class="lead-survey-options">${options.map(o => `
        <label class="lead-reason-option">
            <input type="radio" name="${name}" value="${escapeHtml(o.id)}" data-close-field="${name}">
            <span>${escapeHtml(o.label)}</span>
        </label>`).join('')}</div>`;
}

function openPaymentClosedModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const ps = lead.paymentSurvey || null;
    const hasDebt = leadHasPaymentDebt(ps);
    const hasInstallment = leadHasInstallmentPayment(ps);
    const hasDebtor = ps?.paymentType === 'debtor';
    const debtLabel = hasDebt ? getPaymentClosedDebtLabel(ps) : '';
    const installmentLabel = hasInstallment ? getPaymentClosedInstallmentLabel(ps) : '';

    let contextHtml = '';
    if (ps) {
        const rows = [
            ps.paymentTypeLabel ? `<div class="pcs-row"><span>To'lov turi:</span><strong>${escapeHtml(ps.paymentTypeLabel)}</strong></div>` : '',
            ps.tariffLabel ? `<div class="pcs-row"><span>Tarif:</span><strong>${escapeHtml(ps.tariffLabel)}</strong></div>` : '',
            ps.amountLabel ? `<div class="pcs-row"><span>Summa:</span><strong>${escapeHtml(ps.amountLabel)}</strong></div>` : '',
            hasDebt && debtLabel ? `<div class="pcs-row pcs-row--debt"><span>Qarz miqdori:</span><strong>${escapeHtml(debtLabel)}</strong></div>` : '',
            ps.installmentPartnerLabel ? `<div class="pcs-row"><span>Nasiya hamkori:</span><strong>${escapeHtml(ps.installmentPartnerLabel)}</strong></div>` : ''
        ].filter(Boolean).join('');
        if (rows) contextHtml = `<div class="pcs-context">${rows}</div>`;
    }

    const debtSection = hasDebt ? `
    <section class="lead-survey-section">
        <h4 class="lead-survey-title">Avvalgi qarz: ${escapeHtml(debtLabel)}</h4>
        <div class="lead-info-question">
            <p class="lead-info-question-text">Qarz haqiqatdan yopilganmi?</p>
            <div class="lead-info-yesno">
                <label class="lead-reason-option lead-reason-option--inline"><input type="radio" name="debtCleared" value="yes" data-close-field="debtCleared"><span>Ha</span></label>
                <label class="lead-reason-option lead-reason-option--inline"><input type="radio" name="debtCleared" value="no" data-close-field="debtCleared"><span>Yo'q</span></label>
            </div>
        </div>
        <div id="debtClearMethodBlock" hidden style="display:none">
            <div class="lead-info-question">
                <p class="lead-info-question-text">Qanday usulda yopildi?</p>
                ${renderCloseSurveyRadioGroup('debtClearMethod', [
                    { id: 'full', label: "To'liq to'lab berildi" },
                    { id: 'installment', label: "Nasiya hamkor orqali yopildi" }
                ])}
            </div>
            <div id="debtClearPartnerBlock" hidden style="display:none">
                <div class="lead-info-question">
                    <p class="lead-info-question-text">Qaysi nasiya hamkor orqali?</p>
                    ${renderCloseSurveyRadioGroup('debtClearPartner', LEAD_INSTALLMENT_PARTNERS)}
                </div>
                ${renderCloseSurveyDateField('debtClearPartnerDate', 'Qarzlar yopilgan sana', 'debtClearDate')}
            </div>
        </div>
    </section>` : '';

    const debtorSection = hasDebtor ? `
    <section class="lead-survey-section">
        <h4 class="lead-survey-title">Qarzdor — umumiy summa: ${escapeHtml(ps?.amountLabel || '')}</h4>
        <div class="lead-info-question">
            <p class="lead-info-question-text">To'lov amalga oshirilganmi?</p>
            <div class="lead-info-yesno">
                <label class="lead-reason-option lead-reason-option--inline"><input type="radio" name="debtorPaid" value="yes" data-close-field="debtorPaid"><span>Ha</span></label>
                <label class="lead-reason-option lead-reason-option--inline"><input type="radio" name="debtorPaid" value="no" data-close-field="debtorPaid"><span>Yo'q</span></label>
            </div>
        </div>
        <div id="debtorPaidBlock" hidden style="display:none">
            ${renderCloseSurveyDateField('debtorPaidDate', "To'lov tushgan sana", 'debtorPaidDate')}
        </div>
    </section>` : '';

    const installmentSection = hasInstallment ? `
    <section class="lead-survey-section">
        <h4 class="lead-survey-title">Nasiya hamkor: ${escapeHtml(ps?.installmentPartnerLabel || '')} — ${escapeHtml(installmentLabel)}</h4>
        <div class="lead-info-question">
            <p class="lead-info-question-text">Nasiya hamkordan to'lov tushganmi?</p>
            <div class="lead-info-yesno">
                <label class="lead-reason-option lead-reason-option--inline"><input type="radio" name="installmentReceived" value="yes" data-close-field="installmentReceived"><span>Ha</span></label>
                <label class="lead-reason-option lead-reason-option--inline"><input type="radio" name="installmentReceived" value="no" data-close-field="installmentReceived"><span>Yo'q</span></label>
            </div>
        </div>
        <div id="installmentReceivedDateBlock" hidden style="display:none">
            ${renderCloseSurveyDateField('instReceivedDate', 'Qachon tushdi?', 'installmentReceivedDate')}
        </div>
    </section>` : '';

    const bodyHtml = `<div class="lead-survey lead-survey--info">
        ${contextHtml}
        ${renderCloseSurveyDateField('paymentClosedDate', "To'lov yopilgan sana", 'closedDate')}
        ${debtSection}
        ${debtorSection}
        ${installmentSection}
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — To'lov yopildi`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelPaymentClosed">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmPaymentClosed">Keyingi: Dars jadvali →</button>`,
        { wide: true }
    );

    const modalBody = document.getElementById('modalBody');
    initEnhancedPaymentClosedForm(modalBody);

    document.getElementById('cancelPaymentClosed').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmPaymentClosed').onclick = () => {
        const result = collectEnhancedPaymentClosedData(modalBody, ps, { hasDebt, hasInstallment, hasDebtor });
        if (result.error) { alert(result.error); return; }
        closeModal();
        openClosedScheduleModal(lang, leadId, result.data);
    };
}

function initEnhancedPaymentClosedForm(modalBody) {
    const show = (id, visible) => {
        const el = modalBody.querySelector(`#${id}`);
        if (!el) return;
        el.hidden = !visible;
        el.style.display = visible ? '' : 'none';
        if (!visible) el.querySelectorAll('input').forEach(i => { i.checked = false; i.value = ''; });
    };

    const syncDebtCleared = () => {
        const v = modalBody.querySelector('[data-close-field="debtCleared"]:checked')?.value;
        show('debtClearMethodBlock', v === 'yes');
        if (v !== 'yes') show('debtClearPartnerBlock', false);
    };
    const syncDebtMethod = () => {
        const v = modalBody.querySelector('[data-close-field="debtClearMethod"]:checked')?.value;
        show('debtClearPartnerBlock', v === 'installment');
    };
    const syncInstallmentReceived = () => {
        const v = modalBody.querySelector('[data-close-field="installmentReceived"]:checked')?.value;
        show('installmentReceivedDateBlock', v === 'yes');
    };
    const syncDebtorPaid = () => {
        const v = modalBody.querySelector('[data-close-field="debtorPaid"]:checked')?.value;
        show('debtorPaidBlock', v === 'yes');
    };

    modalBody.querySelectorAll('[data-close-field="debtCleared"]').forEach(r => r.addEventListener('change', syncDebtCleared));
    modalBody.querySelectorAll('[data-close-field="debtClearMethod"]').forEach(r => r.addEventListener('change', syncDebtMethod));
    modalBody.querySelectorAll('[data-close-field="installmentReceived"]').forEach(r => r.addEventListener('change', syncInstallmentReceived));
    modalBody.querySelectorAll('[data-close-field="debtorPaid"]').forEach(r => r.addEventListener('change', syncDebtorPaid));
}

function collectEnhancedPaymentClosedData(modalBody, ps, flags = {}) {
    const getRadio = name => modalBody.querySelector(`[data-close-field="${name}"]:checked`);
    const getDate = id => modalBody.querySelector(`#${id}`)?.value || '';

    const closedDate = getDate('paymentClosedDate');
    if (!closedDate) return { error: "Yopilgan sanani kiriting" };

    const data = {
        closedDate,
        closedDateLabel: formatUzDate(closedDate),
        paymentType: ps?.paymentType || null,
        paymentTypeLabel: ps?.paymentTypeLabel || '',
        tariff: ps?.tariff || null,
        tariffLabel: ps?.tariffLabel || '',
        amount: ps?.amount || null,
        amountLabel: ps?.amountLabel || ''
    };

    if (flags.hasDebt) {
        const debtCleared = getRadio('debtCleared');
        if (!debtCleared) return { error: "Qarz yopilganmi? savoliga javob bering" };
        data.debtCleared = debtCleared.value;
        data.debtClearedLabel = debtCleared.value === 'yes' ? 'Ha' : "Yo'q";
        data.debtAmount = ps?.debtAmount || null;
        data.debtAmountLabel = ps ? getPaymentClosedDebtLabel(ps) : '';

        if (debtCleared.value === 'yes') {
            const method = getRadio('debtClearMethod');
            if (!method) return { error: "Qarz qanday usulda yopildi?" };
            data.debtClearMethod = method.value;
            data.debtClearMethodLabel = method.value === 'full' ? "To'liq to'lab berildi" : "Nasiya hamkor orqali";

            if (method.value === 'installment') {
                const partner = getRadio('debtClearPartner');
                if (!partner) return { error: "Nasiya hamkorini tanlang" };
                const clearDate = getDate('debtClearPartnerDate');
                if (!clearDate) return { error: "Qarz yopilgan sanani kiriting" };
                data.debtClearPartner = partner.value;
                data.debtClearPartnerLabel = LEAD_INSTALLMENT_PARTNERS.find(p => p.id === partner.value)?.label || partner.value;
                data.debtClearDate = clearDate;
                data.debtClearDateLabel = formatUzDate(clearDate);
            }
        }
    }

    if (flags.hasDebtor) {
        const debtorPaid = getRadio('debtorPaid');
        if (!debtorPaid) return { error: "To'lov amalga oshirilganmi? savoliga javob bering" };
        data.debtorPaid = debtorPaid.value;
        data.debtorPaidLabel = debtorPaid.value === 'yes' ? 'Ha' : "Yo'q";
        if (debtorPaid.value === 'yes') {
            const d = getDate('debtorPaidDate');
            if (!d) return { error: "To'lov tushgan sanani kiriting" };
            data.debtorPaidDate = d;
            data.debtorPaidDateLabel = formatUzDate(d);
        }
    }

    if (flags.hasInstallment) {
        const received = getRadio('installmentReceived');
        if (!received) return { error: "Nasiya hamkordan to'lov tushganmi? savoliga javob bering" };
        data.installmentReceived = received.value;
        data.installmentReceivedLabel = received.value === 'yes' ? 'Ha' : "Yo'q";
        data.installmentPartner = ps?.installmentPartner || null;
        data.installmentPartnerLabel = ps?.installmentPartnerLabel || '';
        if (received.value === 'yes') {
            const d = getDate('instReceivedDate');
            if (!d) return { error: "To'lov tushgan sanani kiriting" };
            data.installmentReceivedDate = d;
            data.installmentReceivedDateLabel = formatUzDate(d);
        }
    }

    return { data };
}

function openClosedScheduleModal(lang, leadId, closedSurveyData) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    if (leadHasTeacherSchedule(lead)) {
        finalizePaymentClosed(lang, leadId, closedSurveyData, lead.paymentOnboarding);
        return;
    }

    const subject = lang === 'russian' ? 'russian' : 'english';
    const asosiyTeachers = filterTeachersByTypeAndSubject('asosiy', subject);

    const bodyHtml = `<div class="lead-survey lead-survey--schedule">
        <p class="lead-survey-hint" style="margin-bottom:12px">
            O'quvchini asosiy ustoz dars jadvaliga qo'shing.
            Ustoz jadvalining <strong>Dushanba-Chorshanba-Juma</strong> yoki <strong>Seshanba-Payshanba-Shanba</strong> kunlaridan mos bo'sh vaqtni tanlang.
        </p>
        ${renderTeacherScheduleSection(asosiyTeachers)}
    </div>`;

    openModal(
        `${escapeHtml(lead.name)} — Dars jadvali biriktirish`,
        bodyHtml,
        `<button type="button" class="btn-danger-sm" id="cancelClosedSchedule">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="confirmClosedSchedule">Saqlash va ko'chirish</button>`,
        { wide: true }
    );

    const modalBody = document.getElementById('modalBody');
    wireTeacherSchedulePicker(modalBody, { lead });

    document.getElementById('cancelClosedSchedule').onclick = () => {
        closeModal();
        renderLeads();
    };

    document.getElementById('confirmClosedSchedule').onclick = () => {
        const result = collectTeacherScheduleData(modalBody);
        if (result.error) { alert(result.error); return; }
        closeModal();
        finalizePaymentClosed(lang, leadId, closedSurveyData, result.data);
    };
}

function finalizePaymentClosed(lang, leadId, closedSurveyData, scheduleData) {
    const user = getCurrentUser();
    const author = user?.name || 'Admin';
    const commentText = formatEnhancedPaymentClosedComment(closedSurveyData, scheduleData);

    const updated = updateLeadInStorage(lang, leadId, l => {
        const base = normalizeLeadExtras(l);
        const onboarding = scheduleData
            ? { ...(base.paymentOnboarding || {}), ...scheduleData }
            : base.paymentOnboarding || {};
        return {
            ...base,
            status: 'tolov-yopildi',
            paymentClosedSurvey: closedSurveyData,
            paymentOnboarding: onboarding,
            comments: [...base.comments, createLeadComment({
                type: 'payment-closed',
                text: commentText,
                author
            })]
        };
    });

    if (!updated) { alert('Lid topilmadi'); return; }

    const leadAfter = getLeadById(lang, leadId);
    if (leadAfter && scheduleData?.teacherId) {
        promoteStudentFromClosed(lang, leadAfter, scheduleData);
    } else if (leadAfter?.paymentOnboarding?.becomeStudent === 'yes') {
        promoteStudentFromOnboarding(lang, leadAfter.paymentOnboarding, leadAfter);
    }

    renderLeads();
    if (document.getElementById('tab-timetable')?.classList.contains('active')) renderTimetable();
}

function promoteStudentFromClosed(lang, lead, scheduleData) {
    if (!scheduleData?.teacherId || scheduleData.lessonDayOfWeek == null || !scheduleData.lessonTime) return;
    const students = getItem(STORAGE_KEYS.students, []);
    const existing = students.find(s => s.name === lead.name && s.teacherId === scheduleData.teacherId);
    const ps = lead.paymentSurvey;
    const duration = ps?.tariff ? parseInt(ps.tariff, 10) : 15;
    if (existing) {
        updateStudent(existing.id, {
            lessonDayOfWeek: scheduleData.lessonDayOfWeek,
            lessonTime: scheduleData.lessonTime,
            lessonDuration: duration,
            source: 'lead-closed'
        });
        return existing.id;
    }
    const id = 's' + Date.now();
    students.push({
        id,
        name: lead.name,
        phone: lead.phone || '',
        group: '',
        subject: lang === 'russian' ? 'russian' : 'english',
        teacherId: scheduleData.teacherId,
        assistantTeacherId: null,
        lessonDayOfWeek: scheduleData.lessonDayOfWeek,
        lessonTime: scheduleData.lessonTime,
        lessonDuration: duration,
        source: 'lead-closed'
    });
    setItem(STORAGE_KEYS.students, students);
    return id;
}

function formatEnhancedPaymentClosedComment(closedSurvey, scheduleData) {
    const lines = [`• Yopilgan sana: ${closedSurvey.closedDateLabel || ''}`];
    if (closedSurvey.debtCleared !== undefined) {
        lines.push(`• Qarz yopilganmi: ${closedSurvey.debtClearedLabel}`);
        if (closedSurvey.debtCleared === 'yes') {
            lines.push(`• Yopilish usuli: ${closedSurvey.debtClearMethodLabel || ''}`);
            if (closedSurvey.debtClearPartnerLabel) {
                lines.push(`• Nasiya hamkori: ${closedSurvey.debtClearPartnerLabel}`);
                lines.push(`• Yopilgan sana: ${closedSurvey.debtClearDateLabel || ''}`);
            }
        }
    }
    if (closedSurvey.debtorPaid !== undefined) {
        lines.push(`• To'lov amalga oshirilganmi: ${closedSurvey.debtorPaidLabel}`);
        if (closedSurvey.debtorPaidDateLabel) lines.push(`• To'lov sanasi: ${closedSurvey.debtorPaidDateLabel}`);
    }
    if (closedSurvey.installmentReceived !== undefined) {
        lines.push(`• Nasiya to'lovi tushganmi: ${closedSurvey.installmentReceivedLabel}`);
        if (closedSurvey.installmentReceivedDateLabel) lines.push(`• Tushgan sana: ${closedSurvey.installmentReceivedDateLabel}`);
    }
    if (scheduleData?.teacherName) {
        lines.push(`• Ustoz: ${scheduleData.teacherName}`);
        lines.push(`• Dars vaqti: ${scheduleData.lessonScheduleLabel || ''}`);
    }
    return ["To'lov yopildi — so'rovnoma:", ...lines].join('\n');
}

const LEAD_COLUMNS = [
    { id: 'yangi-lidlar', label: 'Yangi lidlar', bg: '#EFF6FF', border: '#93C5FD', headerBg: 'rgba(59,130,246,0.14)', title: '#1D4ED8', count: '#2563EB' },
    { id: 'boglanishga-urinilmoqda', label: "Bog'lanishga urinilmoqda", bg: '#F5F3FF', border: '#C4B5FD', headerBg: 'rgba(124,58,237,0.12)', title: '#5B21B6', count: '#7C3AED' },
    { id: 'boglanildi', label: "Bog'lanildi", bg: '#ECFEFF', border: '#67E8F9', headerBg: 'rgba(6,182,212,0.12)', title: '#0E7490', count: '#0891B2' },
    { id: 'malumot-berildi', label: "Ma'lumot berildi", bg: '#EEF2FF', border: '#A5B4FC', headerBg: 'rgba(79,70,229,0.12)', title: '#3730A3', count: '#4F46E5' },
    { id: 'qaror-jarayonida', label: 'Qaror jarayonida', bg: '#FFF7ED', border: '#FDBA74', headerBg: 'rgba(234,88,12,0.12)', title: '#C2410C', count: '#EA580C' },
    { id: 'sinov-darsida', label: 'Sinov darsida', bg: '#F0FDF4', border: '#86EFAC', headerBg: 'rgba(22,163,74,0.12)', title: '#166534', count: '#16A34A' },
    { id: 'tolov-jarayonida', label: "To'lov jarayonida", bg: '#FFFBEB', border: '#FCD34D', headerBg: 'rgba(217,119,6,0.12)', title: '#B45309', count: '#D97706' },
    { id: 'tolov-yopildi', label: "To'lov yopildi", bg: '#ECFDF5', border: '#6EE7B7', headerBg: 'rgba(5,150,105,0.12)', title: '#047857', count: '#059669' },
    { id: 'muvaffaqiyatsiz-sotuv', label: 'Muvaffaqiyatsiz sotuv', bg: '#FEF2F2', border: '#FCA5A5', headerBg: 'rgba(220,38,38,0.12)', title: '#B91C1C', count: '#DC2626' },
    { id: 'sifatsiz-lidlar', label: 'Sifatsiz lidlar', bg: '#F8FAFC', border: '#CBD5E1', headerBg: 'rgba(100,116,139,0.12)', title: '#475569', count: '#64748B' }
];

const LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));

function normalizeLeadStatus(status) {
    if (!status || status === 'new') return 'yangi-lidlar';
    if (status === 'organic' || status === 'target') return 'yangi-lidlar';
    return LEAD_STATUS_IDS.has(status) ? status : 'yangi-lidlar';
}

function leadKindLabel(lead) {
    return getLeadKind(lead) === 'target' ? 'Target' : 'Organik';
}

let _leadsLangFilter = (() => {
    try {
        const saved = localStorage.getItem(LEADS_LANG_FILTER_KEY);
        return saved === 'russian' ? 'russian' : 'english';
    } catch {
        return 'english';
    }
})();
let _leadsManagerFilter = 'all';

function getDefaultVisibleColumnIds() {
    return LEAD_COLUMNS
        .filter(col => !LEAD_COLUMNS_HIDDEN_BY_DEFAULT.has(col.id))
        .map(col => col.id);
}

function loadVisibleColumnIds() {
    try {
        const raw = localStorage.getItem(LEADS_COLUMN_VISIBILITY_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            return LEAD_COLUMNS.filter(col => saved[col.id] === true).map(col => col.id);
        }
    } catch {
        /* default */
    }
    return getDefaultVisibleColumnIds();
}

let _leadsVisibleColumns = new Set(loadVisibleColumnIds());

function saveVisibleColumns() {
    const payload = {};
    LEAD_COLUMNS.forEach(col => {
        payload[col.id] = _leadsVisibleColumns.has(col.id);
    });
    localStorage.setItem(LEADS_COLUMN_VISIBILITY_KEY, JSON.stringify(payload));
}

function getVisibleLeadColumns() {
    return LEAD_COLUMNS.filter(col => _leadsVisibleColumns.has(col.id));
}

function closeLeadsColumnsDropdown() {
    const dropdown = document.getElementById('leadsColumnsDropdown');
    const btn = document.getElementById('leadsColumnsFilterBtn');
    if (dropdown) dropdown.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function isDefaultColumnVisibility() {
    const defaultIds = getDefaultVisibleColumnIds();
    if (_leadsVisibleColumns.size !== defaultIds.length) return false;
    return defaultIds.every(id => _leadsVisibleColumns.has(id));
}

function updateManagerFilterDisplay() {
    const select = document.getElementById('leadsManagerFilter');
    const display = document.getElementById('leadsManagerFilterDisplay');
    if (!select || !display) return;
    if (_leadsManagerFilter === 'all') {
        display.textContent = 'Sotuv menejerlari';
        display.classList.remove('is-selected');
        return;
    }
    const opt = select.options[select.selectedIndex];
    display.textContent = opt ? opt.textContent : 'Sotuv menejerlari';
    display.classList.add('is-selected');
}

function renderLeadsManagerFilter() {
    const select = document.getElementById('leadsManagerFilter');
    if (!select) return;
    const user = getCurrentUser();
    if (user && user.role === 'sales_manager') {
        const filterBox = select.closest('.leads-filter-box');
        if (filterBox) filterBox.style.display = 'none';
        if (_leadsManagerFilter === 'all') {
            _leadsManagerFilter = user.linkedManagerId || 'unassigned';
        }
        return;
    }
    const managers = getItem(STORAGE_KEYS.salesManagers, []);
    const current = _leadsManagerFilter;
    select.innerHTML = `<option value="all">Barcha menejerlar</option>
        <option value="unassigned">Biriktirilmagan</option>
        ${managers.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('')}`;
    select.value = current;
    updateManagerFilterDisplay();
}

function renderLeadsColumnsFilter() {
    initLeadsColumnsFilter();
    syncLeadsColumnsCheckboxes();
    updateLeadsColumnsFilterLabel();
}

function updateLeadsColumnsFilterLabel() {
    const valueEl = document.getElementById('leadsColumnsFilterValue');
    if (!valueEl) return;
    if (isDefaultColumnVisibility()) {
        valueEl.textContent = 'Ustunlar filtri';
        valueEl.classList.remove('is-selected');
        return;
    }
    const visibleCount = _leadsVisibleColumns.size;
    valueEl.textContent = visibleCount === LEAD_COLUMNS.length
        ? 'Barcha ustunlar'
        : `${visibleCount} ta ustun`;
    valueEl.classList.add('is-selected');
}

function syncLeadsColumnsCheckboxes() {
    const dropdown = document.getElementById('leadsColumnsDropdown');
    if (!dropdown) return;
    dropdown.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = _leadsVisibleColumns.has(input.value);
    });
}

function initLeadsColumnsFilter() {
    const dropdown = document.getElementById('leadsColumnsDropdown');
    if (!dropdown || dropdown.dataset.ready === '1') return;
    dropdown.dataset.ready = '1';

    dropdown.innerHTML = LEAD_COLUMNS.map(col => {
        const checked = _leadsVisibleColumns.has(col.id);
        const isHiddenByDefault = LEAD_COLUMNS_HIDDEN_BY_DEFAULT.has(col.id);
        return `<label class="leads-column-option${isHiddenByDefault ? ' leads-column-option--optional' : ''}">
            <input type="checkbox" value="${col.id}" ${checked ? 'checked' : ''}>
            <span>${escapeHtml(col.label)}</span>
        </label>`;
    }).join('');

    dropdown.addEventListener('change', e => {
        const input = e.target;
        if (input.type !== 'checkbox') return;
        if (input.checked) _leadsVisibleColumns.add(input.value);
        else _leadsVisibleColumns.delete(input.value);
        saveVisibleColumns();
        updateLeadsColumnsFilterLabel();
        renderLeads();
    });

    dropdown.addEventListener('click', e => e.stopPropagation());
}

function filterLeadsByManager(leads) {
    if (_leadsManagerFilter === 'all') return leads;
    if (_leadsManagerFilter === 'unassigned') return leads.filter(l => !l.managerId);
    return leads.filter(l => l.managerId === _leadsManagerFilter);
}

function getSalesManagerName(managerId) {
    if (!managerId) return '';
    const manager = getItem(STORAGE_KEYS.salesManagers, []).find(m => m.id === managerId);
    return manager?.name || '';
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function leadInitials(name) {
    return String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?';
}

function getLeadKind(lead) {
    if (lead.leadType === 'target') return 'target';
    const s = (lead.source || '').toLowerCase();
    if (s.includes('target') || s.includes('reklama') || s.includes('ads')) return 'target';
    return 'organic';
}

function formatLeadTime(lead) {
    if (lead.createdAt) {
        const d = new Date(lead.createdAt);
        if (!Number.isNaN(d.getTime())) {
            const now = new Date();
            const sameDay = d.toDateString() === now.toDateString();
            const time = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
            return sameDay ? `Bugun ${time}` : d.toLocaleDateString('uz-UZ');
        }
    }
    return lead.date || '—';
}

function leadSourceName(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('domwork')) return 'Domwork';
    if (s.includes('homework')) return 'Homework';
    if (s.includes('target') || s.includes('reklama')) return 'Target';
    return source || 'Organik';
}

function normalizeLeadExtras(lead) {
    let comments = Array.isArray(lead.comments) ? [...lead.comments] : [];
    const legacyReasons = Array.isArray(lead.contactFailReasons)
        ? lead.contactFailReasons.filter(Boolean)
        : [];
    if (legacyReasons.length) {
        const reason = legacyReasons[0];
        const alreadyMigrated = comments.some(c =>
            c.type === 'contact-fail' && (c.reason === reason || c.text?.includes(reason))
        );
        if (!alreadyMigrated) {
            comments.push({
                id: 'cf-' + (lead.contactFailAt || Date.now()),
                type: 'contact-fail',
                text: `Qo'ng'iroq qilindi, lekin: ${reason}`,
                reason,
                author: 'Admin',
                createdAt: lead.contactFailAt || new Date().toISOString()
            });
        }
    }
    comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const attachments = Array.isArray(lead.attachments) ? lead.attachments : [];
    const managerPhoto = lead.managerPhoto || attachments[0] || null;
    const { contactFailReasons, contactFailAt, ...rest } = lead;
    return {
        ...rest,
        phone2: lead.phone2 || '',
        managerId: lead.managerId || '',
        comments,
        managerPhoto,
        attachments: managerPhoto ? [managerPhoto] : []
    };
}

function closeLeadCardMenus() {
    document.querySelectorAll('.lead-card-menu-dropdown').forEach(el => {
        el.hidden = true;
    });
}

function toggleLeadCardMenu(btn) {
    const menu = btn.closest('.lead-card-menu-wrap')?.querySelector('.lead-card-menu-dropdown');
    if (!menu) return;
    const willOpen = menu.hidden;
    closeLeadCardMenus();
    menu.hidden = !willOpen;
}

function getLeadById(lang, leadId) {
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    const lead = (leads[lang] || []).find(l => l.id === leadId);
    return lead ? normalizeLeadExtras(lead) : null;
}

function updateLeadInStorage(lang, leadId, updater) {
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    const list = leads[lang] || [];
    const idx = list.findIndex(l => l.id === leadId);
    if (idx === -1) return null;
    const oldStatus = normalizeLeadStatus(list[idx].status);
    list[idx] = normalizeLeadExtras(updater({ ...list[idx] }));
    leads[lang] = list;
    setItem(STORAGE_KEYS.leads, leads);
    const newStatus = normalizeLeadStatus(list[idx].status);
    if (newStatus === 'tolov-jarayonida' && oldStatus !== 'tolov-jarayonida') {
        autoSyncLeadToBookRoadmap(lang, list[idx]);
    }
    return list[idx];
}

function formatCommentTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createLeadComment({ text, author, type, reason }) {
    return {
        id: 'c' + Date.now(),
        text,
        author: author || 'Admin',
        type: type || 'manual',
        reason: reason || null,
        createdAt: new Date().toISOString()
    };
}

function renderLeadCommentItem(c) {
    const isContactFail = c.type === 'contact-fail';
    const isConnectedSurvey = c.type === 'connected-survey';
    const isInfoProvided = c.type === 'info-provided';
    const isDecisionProcess = c.type === 'decision-process';
    const isPaymentProcess = c.type === 'payment-process';
    const isPaymentOnboarding = c.type === 'payment-onboarding';
    let badge = '';
    if (isContactFail) badge = '<span class="lead-comment-badge">Bog\'lanish sababi</span>';
    if (isConnectedSurvey) badge = '<span class="lead-comment-badge lead-comment-badge--survey">Anketa</span>';
    if (isInfoProvided) badge = '<span class="lead-comment-badge lead-comment-badge--info">Ma\'lumot</span>';
    if (isDecisionProcess) badge = '<span class="lead-comment-badge lead-comment-badge--decision">Qaror</span>';
    if (isPaymentProcess) badge = '<span class="lead-comment-badge lead-comment-badge--payment">To\'lov</span>';
    if (isPaymentOnboarding) badge = '<span class="lead-comment-badge lead-comment-badge--onboard">O\'quvchi</span>';
    const bodyText = c.text || (isContactFail && c.reason ? `Qo'ng'iroq qilindi, lekin: ${c.reason}` : '');
    const itemClass = isContactFail
        ? ' lead-comment-item--contact-fail'
        : (isConnectedSurvey ? ' lead-comment-item--survey'
            : (isInfoProvided ? ' lead-comment-item--info'
                : (isDecisionProcess ? ' lead-comment-item--decision'
                    : (isPaymentProcess ? ' lead-comment-item--payment'
                        : (isPaymentOnboarding ? ' lead-comment-item--onboard' : '')))));

    return `<div class="lead-comment-item${itemClass}">
        <div class="lead-comment-meta">
            <div class="lead-comment-meta-main">
                <strong>${escapeHtml(c.author || 'Admin')}</strong>
                ${badge}
            </div>
            <time class="lead-comment-time" datetime="${escapeHtml(c.createdAt || '')}">${escapeHtml(formatCommentTime(c.createdAt))}</time>
        </div>
        <p class="lead-comment-text">${escapeHtml(bodyText)}</p>
    </div>`;
}

function formatFileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function renderLeadCard(lead, langKey) {
    const normalized = normalizeLeadExtras(lead);
    const phone = normalized.phone || '—';
    const phone2 = normalized.phone2 || '—';
    const commentCount = normalized.comments.length;
    const hasManagerPhoto = Boolean(normalized.managerPhoto);

    // Menejer profil rasmi
    const _managers = getItem(STORAGE_KEYS.salesManagers, []);
    const _manager = _managers.find(m => m.id === normalized.managerId);
    const _managerAvatar = _manager?.avatar || '';
    const _managerInitials = _manager
        ? _manager.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : '';
    const managerAvatarHtml = _managerAvatar
        ? `<img src="${escapeHtml(_managerAvatar)}" alt="${escapeHtml(_manager?.name || '')}" class="lead-mgr-avatar-img">`
        : _managerInitials
        ? `<span class="lead-mgr-avatar-initials">${escapeHtml(_managerInitials)}</span>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const showSerial = normalizeLeadStatus(normalized.status) === 'tolov-jarayonida' && normalized.serialCode;
    const serialHtml = showSerial
        ? `<span class="lead-card-serial">#${escapeHtml(normalized.serialCode)}</span>`
        : '';

    const _cu = getCurrentUser();
    const _isAdminOrRop = _cu && (FULL_ACCESS_ROLES.has(_cu.role));
    const _isSalesManager = _cu?.role === 'sales_manager';

    const checkboxHtml = _isAdminOrRop
        ? `<input type="checkbox" class="lead-bulk-checkbox" data-id="${escapeHtml(normalized.id)}" data-lang="${langKey}" aria-label="Belgilash">`
        : '';

    // "Boshqa bosqichga o'tkazish" submenu items
    const moveItems = LEAD_COLUMNS.map(col => {
        const isDanger = col.id === 'muvaffaqiyatsiz-sotuv' || col.id === 'sifatsiz-lidlar';
        return `<button type="button" class="lead-card-menu-item${isDanger ? ' lead-card-menu-item--danger' : ''}" data-lead-menu-move="${langKey}" data-lead-id="${escapeHtml(normalized.id)}" data-move-to="${escapeHtml(col.id)}">${escapeHtml(col.label)}</button>`;
    }).join('');

    const deleteItem = !_isSalesManager
        ? `<button type="button" class="lead-card-menu-item lead-card-menu-item--danger" data-lead-menu-delete="${langKey}" data-lead-id="${escapeHtml(normalized.id)}">Lidni o'chirish</button>`
        : '';

    const assignManagerItem = !_isSalesManager
        ? `<button type="button" class="lead-card-menu-item" data-lead-menu-manager="${langKey}" data-lead-id="${escapeHtml(normalized.id)}">Menejer biriktirish</button>`
        : '';

    return `<article class="lead-card" draggable="true" data-lead-id="${escapeHtml(normalized.id)}" data-lead-lang="${langKey}">
        <div class="lead-card-top">
            ${checkboxHtml}
            <div class="lead-card-title-wrap">
                <h4 class="lead-card-name">${escapeHtml(normalized.name)}</h4>
                <div class="lead-card-meta">
                    <span class="lead-card-time">${escapeHtml(formatLeadTime(normalized))}</span>
                    ${serialHtml}
                </div>
            </div>
            <div class="lead-card-top-actions">
                <button type="button" class="lead-card-notify" data-lead-notify="${langKey}" data-lead-id="${escapeHtml(normalized.id)}" title="Bildirishnomalar" aria-label="Bildirishnomalar">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
                </button>
                <div class="lead-card-menu-wrap">
                    <button type="button" class="lead-card-menu-btn" data-lead-menu-toggle="${langKey}" data-lead-id="${escapeHtml(normalized.id)}" title="Boshqa amallar" aria-label="Boshqa amallar" aria-haspopup="true">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                    </button>
                    <div class="lead-card-menu-dropdown" hidden>
                        ${assignManagerItem}
                        <div class="lead-card-menu-submenu-wrap">
                            <button type="button" class="lead-card-menu-item lead-card-menu-item--submenu" data-lead-menu-move-toggle>
                                Boshqa bosqichga o'tkazish
                                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                            </button>
                            <div class="lead-card-menu-submenu" hidden>
                                ${moveItems}
                            </div>
                        </div>
                        ${deleteItem}
                    </div>
                </div>
            </div>
        </div>
        <div class="lead-card-contacts">
            <div class="lead-card-contact">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                <span>${escapeHtml(phone)}</span>
            </div>
            <div class="lead-card-contact">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                <span>${escapeHtml(phone2)}</span>
            </div>
        </div>
        <div class="lead-card-footer">
            <div class="lead-card-actions">
                <button type="button" class="lead-card-action lead-card-action--mgr${_manager ? ' lead-card-action--active' : ''}" data-lead-manager-photo="${langKey}" data-lead-id="${escapeHtml(normalized.id)}" title="${escapeHtml(_manager?.name || 'Menejer biriktirilmagan')}">
                    <span class="lead-mgr-avatar">${managerAvatarHtml}</span>
                </button>
                <button type="button" class="lead-card-action" data-lead-comments="${langKey}" data-lead-id="${escapeHtml(normalized.id)}" title="Izohlar">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <span>${commentCount}</span>
                </button>
            </div>
            <span class="lead-card-kind">${escapeHtml(leadKindLabel(normalized))}</span>
        </div>
    </article>`;
}

function openLeadNotifyModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    openModal(`${escapeHtml(lead.name)} — bildirishnomalar`,
        `<p class="text-muted lead-empty-hint">Bu lid uchun bildirishnomalar tez orada qo'shiladi.</p>`,
        ''
    );
}

function openLeadCommentsModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    const user = getCurrentUser();
    const author = user?.name || 'Admin';

    const listHtml = lead.comments.length
        ? lead.comments.map(renderLeadCommentItem).join('')
        : '<p class="text-muted lead-empty-hint">Hozircha izoh yo\'q</p>';

    openModal(`${escapeHtml(lead.name)} — izohlar`,
        `<div class="lead-comments-list">${listHtml}</div>
         <div class="form-group" style="margin-top:16px;margin-bottom:0">
            <label>Yangi izoh</label>
            <textarea id="mLeadCommentText" class="form-control" rows="3" placeholder="Izoh yozing..."></textarea>
         </div>`,
        `<button type="button" class="btn-primary-sm" id="saveLeadComment">Izoh qo'shish</button>`
    );

    document.getElementById('saveLeadComment').onclick = () => {
        const text = document.getElementById('mLeadCommentText').value.trim();
        if (!text) return;
        updateLeadInStorage(lang, leadId, l => {
            const base = normalizeLeadExtras(l);
            return {
                ...base,
                comments: [...base.comments, createLeadComment({ text, author, type: 'manual' })]
            };
        });
        closeModal();
        renderLeads();
    };
}

function openLeadManagerPhotoModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;

    const managers = getItem(STORAGE_KEYS.salesManagers, []);
    const manager = managers.find(m => m.id === lead.managerId);

    if (manager && manager.avatar) {
        // Menejer profil rasmi mavjud — uni ko'rsatamiz
        openModal(`${escapeHtml(lead.name)} — menejer`,
            `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0">
                <img src="${escapeHtml(manager.avatar)}" alt="${escapeHtml(manager.name)}"
                     style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)">
                <div style="text-align:center">
                    <div style="font-size:16px;font-weight:700;color:var(--text)">${escapeHtml(manager.name)}</div>
                    <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Sotuv menejeri</div>
                </div>
            </div>`,
            `<button type="button" class="btn-primary-sm" id="mgrPhotoCloseBtn">Yopish</button>`
        );
        document.getElementById('mgrPhotoCloseBtn').onclick = closeModal;
    } else if (manager) {
        // Menejer bor, lekin rasmi yo'q
        const initials = manager.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
        openModal(`${escapeHtml(lead.name)} — menejer`,
            `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0">
                <div style="width:80px;height:80px;border-radius:50%;background:var(--purple-light);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--purple)">${escapeHtml(initials)}</div>
                <div style="text-align:center">
                    <div style="font-size:16px;font-weight:700;color:var(--text)">${escapeHtml(manager.name)}</div>
                    <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Profil rasmi yo'q. Menejer o'z profilidan rasm qo'yishi kerak.</div>
                </div>
            </div>`,
            `<button type="button" class="btn-primary-sm" id="mgrPhotoCloseBtn">Yopish</button>`
        );
        document.getElementById('mgrPhotoCloseBtn').onclick = closeModal;
    } else {
        // Menejer biriktirilmagan
        openModal(`${escapeHtml(lead.name)} — menejer`,
            `<p class="text-muted lead-empty-hint" style="text-align:center;padding:16px">Bu lidga menejer hali biriktirilmagan</p>`,
            `<button type="button" class="btn-primary-sm" id="mgrPhotoCloseBtn">Yopish</button>`
        );
        document.getElementById('mgrPhotoCloseBtn').onclick = closeModal;
    }
}

function renderLeads() {
    const board = document.getElementById('leadsKanban');
    if (!board) return;

    backfillMissingLeadSerials();

    const _cuRender = getCurrentUser();
    const _isSalesManagerRender = _cuRender && _cuRender.role === 'sales_manager';
    if (_isSalesManagerRender) {
        _leadsLangFilter = _cuRender.linkedManagerLang || 'english';
        const langTabsEl = document.getElementById('leadsLangTabs');
        if (langTabsEl) langTabsEl.style.display = 'none';
        const bulkBarEl = document.getElementById('bulkActionsBar');
        if (bulkBarEl) bulkBarEl.style.display = 'none';
    } else {
        const langTabsEl = document.getElementById('leadsLangTabs');
        if (langTabsEl) langTabsEl.style.display = '';
    }

    document.querySelectorAll('[data-lead-lang-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.leadLangFilter === _leadsLangFilter);
    });

    renderLeadsManagerFilter();
    renderLeadsColumnsFilter();

    const leadsData = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    const lang = _leadsLangFilter === 'russian' ? 'russian' : 'english';
    const tagged = filterLeadsByManager(
        (leadsData[lang] || []).map(l => ({ ...l, _lang: lang }))
    );

    const visibleColumns = getVisibleLeadColumns();

    if (!visibleColumns.length) {
        board.innerHTML = '<div class="lead-column-empty leads-kanban-empty">Kamida bitta ustunni tanlang</div>';
        return;
    }

    board.innerHTML = visibleColumns.map(col => {
        const items = tagged.filter(l => normalizeLeadStatus(l.status) === col.id);
        const cards = items.length
            ? items.map(l => renderLeadCard(l, l._lang)).join('')
            : '<div class="lead-column-empty">Lidlar yo\'q</div>';

        return `<div class="lead-column" data-status="${col.id}" style="background:${col.bg};border-color:${col.border}">
            <div class="lead-column-header" style="background:${col.headerBg}">
                <h3 class="lead-column-title" style="color:${col.title}">${col.label}</h3>
                <span class="lead-column-count" style="color:${col.count}">${items.length}</span>
            </div>
            <div class="lead-column-cards" data-drop-status="${col.id}">${cards}</div>
        </div>`;
    }).join('');

    initLeadDragDrop(board);

    board.querySelectorAll('[data-lead-notify]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openLeadNotifyModal(btn.dataset.leadNotify, btn.dataset.leadId);
        });
    });

    board.querySelectorAll('[data-lead-menu-toggle]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            toggleLeadCardMenu(btn);
        });
    });

    board.querySelectorAll('.lead-card-menu-dropdown').forEach(menu => {
        menu.addEventListener('click', e => e.stopPropagation());
    });

    const bulkChecks = board.querySelectorAll('.lead-bulk-checkbox');
    const bulkBar = document.getElementById('bulkActionsBar');
    const bulkCount = document.getElementById('bulkSelectedCount');
    const bulkSelect = document.getElementById('bulkManagerSelect');
    const bulkAssignBtn = document.getElementById('bulkAssignBtn');
    const bulkCancelBtn = document.getElementById('bulkCancelBtn');

    if (bulkBar && bulkChecks.length) {
        const updateBulkBar = () => {
            const checked = Array.from(bulkChecks).filter(cb => cb.checked);
            if (checked.length > 0) {
                bulkBar.style.display = 'flex';
                bulkCount.textContent = `${checked.length} ta lid tanlandi`;
                if (!bulkSelect.dataset.populated) {
                    const allManagers = getItem(STORAGE_KEYS.salesManagers, []);
                    const bulkLang = _leadsLangFilter === 'russian' ? 'russian' : 'english';
                    const managers = allManagers.filter(m => (m.lang || 'english') === bulkLang);
                    bulkSelect.innerHTML = '<option value="">— Menejerni tanlang —</option>' + managers.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('');
                    bulkSelect.dataset.populated = '1';
                }
            } else {
                bulkBar.style.display = 'none';
            }
        };

        bulkChecks.forEach(cb => cb.addEventListener('change', updateBulkBar));

        bulkCancelBtn.onclick = () => {
            bulkChecks.forEach(cb => cb.checked = false);
            updateBulkBar();
        };

        bulkAssignBtn.onclick = () => {
            const managerId = bulkSelect.value;
            if (!managerId) return showNotification('Xatolik', 'Menejerni tanlang', 'error');
            const checked = Array.from(bulkChecks).filter(cb => cb.checked);
            let updated = false;
            checked.forEach(cb => {
                const lang = cb.dataset.lang;
                const id = cb.dataset.id;
                updateLeadInStorage(lang, id, l => ({ ...l, managerId }));
                updated = true;
            });
            if (updated) {
                renderLeads();
                showNotification('Muvaffaqiyatli', `${checked.length} ta lid biriktirildi`, 'success');
            }
        };
    } else if (bulkBar) {
        bulkBar.style.display = 'none';
    }

    board.querySelectorAll('[data-lead-menu-delete]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            closeLeadCardMenus();
            if (!confirm('Lidni o\'chirishni xohlaysizmi?')) return;
            const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
            const langKey = btn.dataset.leadMenuDelete;
            leads[langKey] = (leads[langKey] || []).filter(l => l.id !== btn.dataset.leadId);
            setItem(STORAGE_KEYS.leads, leads);
            renderLeads();
        });
    });

    board.querySelectorAll('[data-lead-menu-manager]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            closeLeadCardMenus();
            openAssignManagerModal(btn.dataset.leadMenuManager, btn.dataset.leadId);
        });
    });

    // Boshqa bosqichga o'tkazish — submenu toggle
    board.querySelectorAll('[data-lead-menu-move-toggle]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const sub = btn.closest('.lead-card-menu-submenu-wrap')?.querySelector('.lead-card-menu-submenu');
            if (sub) { sub.hidden = !sub.hidden; }
        });
    });

    // Boshqa bosqichga o'tkazish — ustun tanlanganda
    board.querySelectorAll('[data-lead-menu-move]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            closeLeadCardMenus();
            const lang = btn.dataset.leadMenuMove;
            const leadId = btn.dataset.leadId;
            const toStatus = btn.dataset.moveTo;
            const lead = getLeadById(lang, leadId);
            if (!lead) return;
            const from = normalizeLeadStatus(lead.status);
            if (from === toStatus) return;

            if (needsContactFailPrompt(from, toStatus)) { openContactFailModal(lang, leadId, toStatus); return; }
            if (SURVEY_CASCADE_TARGETS.has(toStatus)) {
                const _sk = getSkippedSurveySteps(from, toStatus, lead);
                if (_sk.length) { startMvCascade(lang, leadId, from, toStatus); return; }
            }
            if (needsTrialLessonPrompt(from, toStatus)) { openTrialLessonFlow(lang, leadId, from); return; }
            if (needsConnectedSurveyPrompt(toStatus)) { openConnectedSurveyModal(lang, leadId, toStatus); return; }
            if (needsInfoProvidedPrompt(from, toStatus)) { openMalumotBerildiFlow(lang, leadId, from); return; }
            if (needsDecisionPrompt(from, toStatus)) { openQarorJarayonidaFlow(lang, leadId, from); return; }
            if (needsPaymentPrompt(from, toStatus)) { openTolovJarayonidaFlow(lang, leadId, from); return; }
            if (needsPaymentClosedPrompt(from, toStatus)) { openTolovYopildiFlow(lang, leadId, from); return; }
            if (needsFailedSalePrompt(from, toStatus)) { openMuvaffaqiyatsizSotuvFlow(lang, leadId, from); return; }
            if (needsSifatsizLidPrompt(from, toStatus)) { openSifatsizLidFlow(lang, leadId); return; }
            moveLeadToStatus(lang, leadId, toStatus);
        });
    });

    board.querySelectorAll('[data-lead-comments]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openLeadCommentsModal(btn.dataset.leadComments, btn.dataset.leadId);
        });
    });

    board.querySelectorAll('[data-lead-manager-photo]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openLeadManagerPhotoModal(btn.dataset.leadManagerPhoto, btn.dataset.leadId);
        });
    });
}

function initLeadDragDrop(board) {
    board.querySelectorAll('.lead-card').forEach(card => {
        card.addEventListener('dragstart', e => {
            const lead = getLeadById(card.dataset.leadLang, card.dataset.leadId);
            const fromStatus = card.closest('.lead-column')?.dataset.status
                || normalizeLeadStatus(lead?.status);
            e.dataTransfer.setData('application/json', JSON.stringify({
                id: card.dataset.leadId,
                lang: card.dataset.leadLang,
                fromStatus
            }));
            card.classList.add('lead-card--dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('lead-card--dragging');
            board.querySelectorAll('.lead-column-cards').forEach(z => z.classList.remove('drag-over'));
        });
    });

    board.querySelectorAll('.lead-column-cards').forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', e => {
            if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            let payload;
            try {
                payload = JSON.parse(e.dataTransfer.getData('application/json'));
            } catch {
                return;
            }
            const toStatus = zone.dataset.dropStatus;
            if (!payload?.id || !payload?.lang || !toStatus) return;

            const fromStatus = payload.fromStatus || '';
            if (fromStatus === toStatus) return;

            if (needsContactFailPrompt(fromStatus, toStatus)) {
                openContactFailModal(payload.lang, payload.id, toStatus);
                return;
            }

            if (SURVEY_CASCADE_TARGETS.has(toStatus)) {
                const _ddLead = getLeadById(payload.lang, payload.id);
                const _sk = getSkippedSurveySteps(fromStatus, toStatus, _ddLead);
                if (_sk.length) { startMvCascade(payload.lang, payload.id, fromStatus, toStatus); return; }
            }

            if (needsTrialLessonPrompt(fromStatus, toStatus)) {
                openTrialLessonFlow(payload.lang, payload.id, fromStatus);
                return;
            }

            if (needsConnectedSurveyPrompt(toStatus)) {
                openConnectedSurveyModal(payload.lang, payload.id, toStatus);
                return;
            }

            if (needsInfoProvidedPrompt(fromStatus, toStatus)) {
                openMalumotBerildiFlow(payload.lang, payload.id, fromStatus);
                return;
            }

            if (needsDecisionPrompt(fromStatus, toStatus)) {
                openQarorJarayonidaFlow(payload.lang, payload.id, fromStatus);
                return;
            }

            if (needsPaymentPrompt(fromStatus, toStatus)) {
                openTolovJarayonidaFlow(payload.lang, payload.id, fromStatus);
                return;
            }

            if (needsPaymentClosedPrompt(fromStatus, toStatus)) {
                openTolovYopildiFlow(payload.lang, payload.id, fromStatus);
                return;
            }

            if (needsFailedSalePrompt(fromStatus, toStatus)) {
                openMuvaffaqiyatsizSotuvFlow(payload.lang, payload.id, fromStatus);
                return;
            }

            if (needsSifatsizLidPrompt(fromStatus, toStatus)) {
                openSifatsizLidFlow(payload.lang, payload.id);
                return;
            }

            moveLeadToStatus(payload.lang, payload.id, toStatus);
        });
    });
}

function openTeacherWorkScheduleModal(initialTeacherId) {
    const teachers = getItem(STORAGE_KEYS.teachers, []).filter(t => t.type === 'asosiy');
    const options = `<option value="">— Tanlang —</option>` +
        teachers.map(t => `<option value="${t.id}" ${t.id === initialTeacherId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

    openModal("Ustoz ish jadvalini sozlash",
        `<div class="form-group">
            <label>O'qituvchi</label>
            <select id="workScheduleTeacher" class="form-control">${options}</select>
        </div>
        <div id="workScheduleGridContainer"></div>`,
        `<button type="button" class="btn-danger-sm" id="cancelWorkSchedule">Yopish</button>
         <button type="button" class="btn-primary-sm" id="saveWorkSchedule">Saqlash</button>`
    );

    document.getElementById('cancelWorkSchedule').onclick = () => closeModal();

    let currentWorkSlots = null;
    let selectedTeacherId = initialTeacherId;

    const renderGrid = () => {
        const container = document.getElementById('workScheduleGridContainer');
        if (!selectedTeacherId) {
            container.innerHTML = `<p class="text-muted">Ustozni tanlang...</p>`;
            return;
        }

        const teacher = getItem(STORAGE_KEYS.teachers, []).find(t => t.id === selectedTeacherId);
        if (!teacher) return;

        const times = generateTimeSlots();
        const days = [1, 2, 3, 4, 5, 6];

        if (!currentWorkSlots) {
            currentWorkSlots = teacher.workSlots ? new Set(teacher.workSlots) : new Set(times.flatMap(t => days.map(d => `${d}_${t}`)));
        }

        let html = `<div style="display:flex;gap:12px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#fff;border:1px solid #ccc;display:inline-block;"></span> Ish vaqti (Oq)</div>
            <div style="display:flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#E2E8F0;border:1px solid #CBD5E1;display:inline-block;"></span> Belgilanmagan (Och kulrang)</div>
        </div>`;
        html += `<div class="table-responsive" style="max-height:60vh;overflow-y:auto;"><table class="table tt-week-table" style="user-select:none;margin-bottom:0;">`;
        html += `<thead><tr><th class="tt-time-col" style="top:0;">Vaqt</th>`;
        days.forEach(d => {
            html += `<th style="top:0;">${DAYS_UZ[d - 1]}</th>`;
        });
        html += `</tr></thead><tbody>`;

        times.forEach(time => {
            html += `<tr><td class="tt-time-col">${time}</td>`;
            days.forEach(d => {
                const key = `${d}_${time}`;
                const isWork = currentWorkSlots.has(key);
                html += `<td class="ws-cell" data-key="${key}" style="border:1px solid var(--border);cursor:pointer;background:${isWork ? 'var(--surface)' : '#E2E8F0'}; transition: 0.1s;"></td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;

        let isDragging = false;
        let dragMode = null;

        const cells = container.querySelectorAll('.ws-cell');
        cells.forEach(cell => {
            cell.addEventListener('mousedown', (e) => {
                isDragging = true;
                const key = cell.dataset.key;
                dragMode = !currentWorkSlots.has(key);
                toggleCell(cell, key, dragMode);
            });
            cell.addEventListener('mouseenter', (e) => {
                if (isDragging) toggleCell(cell, cell.dataset.key, dragMode);
            });
        });

        const releaseDrag = () => { isDragging = false; };
        document.addEventListener('mouseup', releaseDrag);

        container.dataset.bound = '1';
        container.cleanup = () => document.removeEventListener('mouseup', releaseDrag);

        function toggleCell(cell, key, isWork) {
            if (isWork) {
                currentWorkSlots.add(key);
                cell.style.background = 'var(--surface)';
            } else {
                currentWorkSlots.delete(key);
                cell.style.background = '#E2E8F0';
            }
        }
    };

    const selectEl = document.getElementById('workScheduleTeacher');
    selectEl.addEventListener('change', () => {
        selectedTeacherId = selectEl.value;
        currentWorkSlots = null;
        renderGrid();
    });

    document.getElementById('saveWorkSchedule').onclick = () => {
        const container = document.getElementById('workScheduleGridContainer');
        if (container?.cleanup) container.cleanup();

        if (!selectedTeacherId) return;
        updateTeacher(selectedTeacherId, { workSlots: Array.from(currentWorkSlots || []) });
        closeModal();
        renderTimetable();
    };

    const cleanupModal = () => {
        const container = document.getElementById('workScheduleGridContainer');
        if (container?.cleanup) container.cleanup();
    };
    document.getElementById('cancelWorkSchedule').addEventListener('click', cleanupModal);

    renderGrid();
}

function openAssignManagerModal(lang, leadId) {
    const lead = getLeadById(lang, leadId);
    if (!lead) return;
    const allManagers = getItem(STORAGE_KEYS.salesManagers, []);
    const managers = allManagers.filter(m => (m.lang || 'english') === lang);
    const options = `<option value="">— Biriktirilmagan —</option>
        ${managers.map(m => `<option value="${escapeHtml(m.id)}"${lead.managerId === m.id ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}`;

    openModal(`${escapeHtml(lead.name)} — menejer`,
        `<div class="form-group" style="margin-bottom:0">
            <label>Sotuv menejeri</label>
            <select id="mLeadManagerId" class="form-select">${options}</select>
         </div>`,
        `<button type="button" class="btn-primary-sm" id="saveLeadManager">Saqlash</button>`
    );

    document.getElementById('saveLeadManager').onclick = () => {
        const managerId = document.getElementById('mLeadManagerId').value;
        updateLeadInStorage(lang, leadId, l => ({
            ...l,
            managerId: managerId || ''
        }));
        closeModal();
        renderLeads();
    };
}

function openAddLeadModal() {
    const defaultLang = _leadsLangFilter === 'russian' ? 'russian' : 'english';
    const _cuModal = getCurrentUser();
    const _isSmModal = _cuModal && _cuModal.role === 'sales_manager';
    const allManagers = getItem(STORAGE_KEYS.salesManagers, []);
    const managers = allManagers.filter(m => (m.lang || 'english') === defaultLang);
    const autoManagerId = _isSmModal ? (_cuModal.linkedManagerId || '') : '';
    const managerOptions = `<option value="">— Biriktirilmagan —</option>
        ${managers.map(m => `<option value="${escapeHtml(m.id)}"${m.id === autoManagerId ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}`;

    openModal("Yangi lid qo'shish",
        `<div class="form-group"><label>Ism-familiya</label><input id="mLeadName" class="form-control" placeholder="Masalan: Ali Valiyev"></div>
         <div class="form-group"><label>Telefon</label><input id="mLeadPhone" class="form-control" placeholder="+998 90 123 45 67"></div>
         <div class="form-group"><label>2-telefon</label><input id="mLeadPhone2" class="form-control" placeholder="+998 91 234 56 78"></div>
         <div class="form-group" ${_isSmModal ? 'style="display:none"' : ''}><label>Sotuv menejeri</label>
            <select id="mLeadManagerId" class="form-select">${managerOptions}</select>
         </div>
         <div class="form-group"><label>Til</label>
            <select id="mLeadLang" class="form-select">
                <option value="english"${defaultLang === 'english' ? ' selected' : ''}>Ingliz tili</option>
                <option value="russian"${defaultLang === 'russian' ? ' selected' : ''}>Rus tili</option>
            </select>
         </div>
         <div class="form-group"><label>Lid turi</label>
            <select id="mLeadType" class="form-select">
                <option value="organic">Organik</option>
                <option value="target">Target (reklama)</option>
            </select>
         </div>`,
        `<button class="btn-primary-sm" id="saveLead">Saqlash</button>`
    );

    document.getElementById('saveLead').onclick = () => {
        const name = document.getElementById('mLeadName').value.trim();
        if (!name) return;
        const lang = document.getElementById('mLeadLang').value;
        const leadType = document.getElementById('mLeadType').value;
        const sourceLabel = leadType === 'organic' ? 'Organik' : 'Target (reklama)';

        const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
        leads[lang] = leads[lang] || [];
        leads[lang].push({
            id: 'l' + Date.now(),
            name,
            phone: document.getElementById('mLeadPhone').value.trim(),
            phone2: document.getElementById('mLeadPhone2').value.trim(),
            managerId: document.getElementById('mLeadManagerId').value || '',
            source: sourceLabel,
            leadType,
            status: 'yangi-lidlar',
            comments: [],
            managerPhoto: null,
            attachments: [],
            date: new Date().toLocaleDateString('uz-UZ')
        });
        setItem(STORAGE_KEYS.leads, leads);
        closeModal();
        renderLeads();
    };
}

const addLeadBtn = document.getElementById('addLeadBtn');
if (addLeadBtn) {
    addLeadBtn.addEventListener('click', openAddLeadModal);
    const _cuLead = getCurrentUser();
    if (_cuLead && !FULL_ACCESS_ROLES.has(_cuLead.role)) {
        addLeadBtn.style.display = 'none';
    }
}

const leadsManagerFilter = document.getElementById('leadsManagerFilter');
if (leadsManagerFilter) {
    leadsManagerFilter.addEventListener('change', () => {
        _leadsManagerFilter = leadsManagerFilter.value;
        updateManagerFilterDisplay();
        renderLeads();
    });
}

const leadsColumnsFilterBtn = document.getElementById('leadsColumnsFilterBtn');
if (leadsColumnsFilterBtn) {
    leadsColumnsFilterBtn.addEventListener('click', e => {
        e.stopPropagation();
        const dropdown = document.getElementById('leadsColumnsDropdown');
        if (!dropdown) return;
        const willOpen = dropdown.hidden;
        closeLeadsColumnsDropdown();
        closeLeadCardMenus();
        dropdown.hidden = !willOpen;
        leadsColumnsFilterBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
}

document.querySelectorAll('[data-lead-lang-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
        _leadsLangFilter = btn.dataset.leadLangFilter;
        try {
            localStorage.setItem(LEADS_LANG_FILTER_KEY, _leadsLangFilter);
        } catch { /* ignore */ }
        syncLeadsLangTabs();
        if (_tabContext.salesSection === 'leads') renderLeads();
        if (_tabContext.salesSection === 'book-roadmap') renderBookRoadmap();
    });
});

document.addEventListener('click', () => {
    closeLeadCardMenus();
    closeLeadsColumnsDropdown();
    closeBrColumnsDropdown();
});

// =========== HR EMPLOYEES ===========
const HR_EMPLOYEES_KEY = 'mh_hr_employees';
let _hrRoleFilter = 'all';
let _hrLangFilter = 'all'; // 'all' | 'ingliz' | 'rus'

const HR_ROLE_MAP = {
    'rop': 'ROP',
    'sotuv-menejeri': 'Sotuv menejeri',
    'oqituvchi': "O'qituvchi",
    'ingliz-oqituvchi': "Ingliz tili o'qituvchi",
    'rus-oqituvchi': "Rus tili o'qituvchi",
    'yordamchi': "Yordamchi o'qituvchi"
};

// Modal dropdown uchun (ingliz/rus — separate sub-field orqali belgilanadi)
const HR_ROLE_MAP_MODAL = {
    'rop': 'ROP',
    'sotuv-menejeri': 'Sotuv menejeri',
    'oqituvchi': "O'qituvchi",
    'yordamchi': "Yordamchi o'qituvchi"
};

function teacherLangHtml(selected = '') {
    return `<div class="form-group" id="empTeacherLangWrap" style="display:none">
        <label>Til yo'nalishi</label>
        <div class="emp-lang-sub">
            <label>
                <input type="radio" name="empTeacherLang" value="ingliz" ${selected === 'ingliz' ? 'checked' : ''}>
                <img src="images/flags/gb.svg" alt="" class="subject-flag" style="margin-right:4px"> Ingliz tili
            </label>
            <label>
                <input type="radio" name="empTeacherLang" value="rus" ${selected === 'rus' ? 'checked' : ''}>
                <img src="images/flags/ru.svg" alt="" class="subject-flag" style="margin-right:4px"> Rus tili
            </label>
        </div>
    </div>`;
}

function bindTeacherLangToggle(roleSelectId) {
    const roleEl = document.getElementById(roleSelectId);
    const wrap = document.getElementById('empTeacherLangWrap');
    if (!roleEl || !wrap) return;
    const toggle = () => {
        wrap.style.display = roleEl.value === 'oqituvchi' ? '' : 'none';
    };
    roleEl.addEventListener('change', toggle);
    toggle();
}

function resolveTeacherRole(baseRole) {
    if (baseRole !== 'oqituvchi') return baseRole;
    const checked = document.querySelector('input[name="empTeacherLang"]:checked');
    if (!checked) return 'oqituvchi';
    return checked.value === 'ingliz' ? 'ingliz-oqituvchi' : 'rus-oqituvchi';
}

function managerLangHtml(selected = 'english') {
    return `<div class="form-group" id="empManagerLangWrap" style="display:none">
        <label>Til yo'nalishi (sotuv bo'limi)</label>
        <div class="emp-lang-sub">
            <label>
                <input type="radio" name="empManagerLang" value="english" ${selected !== 'russian' ? 'checked' : ''}>
                Ingliz tili
            </label>
            <label>
                <input type="radio" name="empManagerLang" value="russian" ${selected === 'russian' ? 'checked' : ''}>
                Rus tili
            </label>
        </div>
    </div>`;
}

function bindManagerLangToggle(roleSelectId) {
    const roleEl = document.getElementById(roleSelectId);
    const wrap = document.getElementById('empManagerLangWrap');
    if (!roleEl || !wrap) return;
    const toggle = () => {
        wrap.style.display = roleEl.value === 'sotuv-menejeri' ? '' : 'none';
    };
    roleEl.addEventListener('change', toggle);
    toggle();
}

function resolveManagerLang() {
    const checked = document.querySelector('input[name="empManagerLang"]:checked');
    return (checked && checked.value === 'russian') ? 'russian' : 'english';
}

const HR_DEPARTMENTS = ['Sotuv', 'Akademik', 'Marketing', 'HR', 'IT'];

function getHrEmployees() {
    // Server cache ustunlik (initStorage dan keyin to'ldiriladi)
    const fromServer = getItem(STORAGE_KEYS.hrEmployees, undefined);
    if (fromServer !== undefined) return fromServer;
    // localStorage ga fallback (migration uchun)
    try {
        const raw = localStorage.getItem(HR_EMPLOYEES_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveHrEmployees(list) {
    // Serverga saqlash (parolsiz — xavfsizlik)
    const forServer = list.map(({ password, ...rest }) => rest);
    setItem(STORAGE_KEYS.hrEmployees, forServer);
    // localStorage ga ham yozamiz (migration support)
    localStorage.setItem(HR_EMPLOYEES_KEY, JSON.stringify(list));
}

function seedHrEmployees() {
    const existing = getHrEmployees();
    if (existing && existing.length > 0) return existing;
    // Agar server bo'sh bo'lsa, localStorage dan migratsiya
    if (Array.isArray(existing)) {
        try {
            const lsRaw = localStorage.getItem(HR_EMPLOYEES_KEY);
            const lsData = lsRaw ? JSON.parse(lsRaw) : null;
            if (lsData && lsData.length > 0) {
                saveHrEmployees(lsData);
                return lsData;
            }
        } catch {}
    }
    // Default seed
    const seed = [
        { id: 'hr1', name: 'Alisher Karimov', role: 'rop', phone: '+998 90 111 22 33', email: 'alisher@myhomework.uz', department: 'Sotuv', status: 'active', joinDate: '2023-05-15', login: 'alisher', password: '1234' },
        { id: 'hr2', name: 'Dilnoza Rashidova', role: 'sotuv-menejeri', phone: '+998 91 222 33 44', email: 'dilnoza@myhomework.uz', department: 'Sotuv', status: 'active', joinDate: '2023-08-20', login: 'dilnoza', password: '1234' },
        { id: 'hr3', name: 'Bobur Toshmatov', role: 'sotuv-menejeri', phone: '+998 93 333 44 55', email: 'bobur@myhomework.uz', department: 'Sotuv', status: 'active', joinDate: '2024-01-10', login: 'bobur', password: '1234' },
        { id: 'hr4', name: 'Nodira Saidova', role: 'oqituvchi', phone: '+998 94 444 55 66', email: 'nodira@myhomework.uz', department: 'Akademik', status: 'active', joinDate: '2023-02-01', login: 'nodira', password: '1234' },
        { id: 'hr5', name: 'Sardor Umarov', role: 'oqituvchi', phone: '+998 95 555 66 77', email: 'sardor@myhomework.uz', department: 'Akademik', status: 'active', joinDate: '2023-09-15', login: 'sardor', password: '1234' },
        { id: 'hr6', name: 'Zulfiya Abdullayeva', role: 'oqituvchi', phone: '+998 97 666 77 88', email: 'zulfiya@myhomework.uz', department: 'Akademik', status: 'inactive', joinDate: '2024-03-01', login: 'zulfiya', password: '1234' },
        { id: 'hr7', name: 'Javohir Nazarov', role: 'yordamchi', phone: '+998 90 777 88 99', email: 'javohir@myhomework.uz', department: 'Akademik', status: 'active', joinDate: '2024-06-01', login: 'javohir', password: '1234' },
        { id: 'hr8', name: 'Madina Xolmatova', role: 'yordamchi', phone: '+998 91 888 99 00', email: 'madina@myhomework.uz', department: 'Akademik', status: 'active', joinDate: '2024-07-15', login: 'madina', password: '1234' },
        { id: 'hr9', name: 'Sherzod Mirzayev', role: 'rop', phone: '+998 93 999 00 11', email: 'sherzod@myhomework.uz', department: 'Akademik', status: 'active', joinDate: '2022-11-20', login: 'sherzod', password: '1234' },
        { id: 'hr10', name: 'Kamola Ergasheva', role: 'sotuv-menejeri', phone: '+998 94 000 11 22', email: 'kamola@myhomework.uz', department: 'Sotuv', status: 'active', joinDate: '2024-02-14', login: 'kamola', password: '1234' }
    ];
    saveHrEmployees(seed);
    return seed;
}

// Eski xodimlarga login/parol qo'shish (migration)
function migrateHrCredentials() {
    const emps = getHrEmployees();
    if (!emps || !emps.length) return;
    let changed = false;
    emps.forEach(e => {
        if (!e.login) {
            e.login = e.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            e.password = '1234';
            changed = true;
        }
    });
    if (changed) saveHrEmployees(emps);
}

function renderHrEmployeeCard(emp) {
    const initials = getUserInitials(emp.name);
    const roleLabel = HR_ROLE_MAP[emp.role] || emp.role;
    const isActive = emp.status === 'active';
    const statusLabel = isActive ? 'ACTIVE' : 'INACTIVE';
    const statusClass = isActive ? '' : ' inactive';
    const joinFormatted = emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return `<div class="employee-card" data-emp-id="${emp.id}">
        <div class="emp-menu-wrap">
            <button class="employee-card-actions" title="Amallar" data-emp-menu="${emp.id}">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
            </button>
            <div class="emp-menu-dropdown" id="empMenu_${emp.id}" hidden>
                <button class="emp-menu-item" data-emp-edit="${emp.id}">
                    <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Tahrirlash
                </button>
                <button class="emp-menu-item emp-menu-item--danger" data-emp-delete="${emp.id}">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    O'chirish
                </button>
            </div>
        </div>
        <div class="employee-avatar-placeholder" ${emp.avatar ? `data-emp-avatar="${escapeHtml(emp.id)}"` : ''}>
            ${emp.avatar
                ? `<img class="employee-avatar-img" alt="${escapeHtml(emp.name)}">`
                : `<span>${escapeHtml(initials)}</span>`}
        </div>
        <div class="employee-name">${escapeHtml(emp.name)}</div>
        <div class="employee-role">${escapeHtml(roleLabel)}</div>
        <span class="employee-status${statusClass}">${statusLabel}</span>
        <div class="employee-contact">
            <div class="employee-contact-item">
                <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
                ${escapeHtml(emp.email || '—')}
            </div>
            <div class="employee-contact-item">
                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                ${escapeHtml(emp.phone || '—')}
            </div>
        </div>
        <div class="employee-footer">
            <div class="employee-footer-row">
                <span class="employee-footer-label">Bo'lim</span>
                <span class="employee-footer-value">${escapeHtml(emp.department || '—')}</span>
            </div>
            <div class="employee-footer-row">
                <span class="employee-footer-label">Qo'shilgan sana</span>
                <span class="employee-footer-value">${joinFormatted}</span>
            </div>
        </div>
    </div>`;
}

const TEACHER_ROLES = ['oqituvchi', 'ingliz-oqituvchi', 'rus-oqituvchi'];

function getHrFiltered(employees) {
    // Language filter (faqat o'qituvchilar uchun)
    if (_hrLangFilter === 'ingliz') return employees.filter(e => e.role === 'ingliz-oqituvchi');
    if (_hrLangFilter === 'rus')    return employees.filter(e => e.role === 'rus-oqituvchi');
    // Role filter
    if (_hrRoleFilter === 'all')        return employees;
    if (_hrRoleFilter === 'oqituvchi')  return employees.filter(e => TEACHER_ROLES.includes(e.role));
    return employees.filter(e => e.role === _hrRoleFilter);
}

function renderHrEmployees() {
    const employees = seedHrEmployees();
    migrateHrCredentials();
    const filtered = getHrFiltered(employees);
    const grid = document.getElementById('hrEmployeesGrid');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="card placeholder-card" style="grid-column:1/-1">
            <div class="placeholder-icon">👤</div>
            <h3>Xodim topilmadi</h3>
            <p class="text-muted">Tanlangan filtr bo'yicha xodimlar mavjud emas.</p>
        </div>`;
    } else {
        grid.innerHTML = filtered.map(e => renderHrEmployeeCard(e)).join('');
        filtered.forEach(e => {
            if (!e.avatar) return;
            const img = grid.querySelector(`[data-emp-avatar="${CSS.escape(e.id)}"] img.employee-avatar-img`);
            if (img) img.src = e.avatar;
        });
    }

    // 3-dot toggle
    grid.querySelectorAll('[data-emp-menu]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const dropdown = document.getElementById(`empMenu_${btn.dataset.empMenu}`);
            const isHidden = dropdown.hidden;
            closeEmpMenus();
            dropdown.hidden = !isHidden;
        });
    });

    // Edit
    grid.querySelectorAll('[data-emp-edit]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            closeEmpMenus();
            openEditEmployeeModal(btn.dataset.empEdit);
        });
    });

    // Delete
    grid.querySelectorAll('[data-emp-delete]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            closeEmpMenus();
            confirmDeleteEmployee(btn.dataset.empDelete);
        });
    });

    // Outside click closes menus
    document.addEventListener('click', closeEmpMenus);
}

function closeEmpMenus() {
    document.querySelectorAll('.emp-menu-dropdown').forEach(d => { d.hidden = true; });
}

function deleteHrEmployee(id) {
    let employees = getHrEmployees() || [];
    employees = employees.filter(e => e.id !== id);
    saveHrEmployees(employees);
    renderHrEmployees();
}

function confirmDeleteEmployee(empId) {
    const employees = getHrEmployees() || [];
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    openModal(
        "Xodimni o'chirish",
        `<div style="text-align:center;padding:16px 0">
            <div style="font-size:48px;margin-bottom:12px">🗑️</div>
            <p style="font-size:15px;color:var(--text);margin-bottom:6px">
                <strong>${escapeHtml(emp.name)}</strong> ni o'chirasizmi?
            </p>
            <p style="font-size:13px;color:var(--text-muted)">Bu amalni ortga qaytarib bo'lmaydi.</p>
        </div>`,
        `<button type="button" class="btn-ghost" id="cancelEmpDelete">Bekor qilish</button>
         <button type="button" class="btn-danger-sm" id="confirmEmpDelete" style="background:#dc2626;color:#fff;padding:8px 18px;font-size:13px">Ha, o'chirish</button>`,
        { wide: false }
    );
    document.getElementById('cancelEmpDelete').onclick = () => closeModal();
    document.getElementById('confirmEmpDelete').onclick = () => {
        deleteHrEmployee(empId);
        closeModal();
        showMiniToast(`${emp.name} o'chirildi`);
    };
}

function openEditEmployeeModal(empId) {
    const employees = getHrEmployees() || [];
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    // ingliz/rus-oqituvchi → display as 'oqituvchi' in dropdown
    const isTeacherLang = emp.role === 'ingliz-oqituvchi' || emp.role === 'rus-oqituvchi';
    const displayRole = isTeacherLang ? 'oqituvchi' : emp.role;
    const preselectedLang = emp.role === 'ingliz-oqituvchi' ? 'ingliz' : emp.role === 'rus-oqituvchi' ? 'rus' : '';

    const roleOptions = Object.entries(HR_ROLE_MAP_MODAL).map(([k, v]) =>
        `<option value="${k}"${displayRole === k ? ' selected' : ''}>${escapeHtml(v)}</option>`
    ).join('');
    const deptOptions = HR_DEPARTMENTS.map(d =>
        `<option value="${d}"${emp.department === d ? ' selected' : ''}>${escapeHtml(d)}</option>`
    ).join('');

    openModal("Xodimni tahrirlash",
        `<div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1">
                <label>Ism <span style="color:var(--danger)">*</span></label>
                <input type="text" id="editEmpFirstName" class="form-control" value="${escapeHtml(emp.firstName || emp.name.split(' ')[0] || '')}" placeholder="Ism">
            </div>
            <div class="form-group" style="flex:1">
                <label>Familiya <span style="color:var(--danger)">*</span></label>
                <input type="text" id="editEmpLastName" class="form-control" value="${escapeHtml(emp.lastName || emp.name.split(' ').slice(1).join(' ') || '')}" placeholder="Familiya">
            </div>
        </div>
        <div class="form-group">
            <label>Jinsi</label>
            <select id="editEmpGender" class="form-control">
                <option value="">— Tanlang —</option>
                <option value="erkak"${emp.gender === 'erkak' ? ' selected' : ''}>Erkak</option>
                <option value="ayol"${emp.gender === 'ayol' ? ' selected' : ''}>Ayol</option>
            </select>
        </div>
        <div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1">
                <label>Tug'ilgan sana</label>
                <input type="date" id="editEmpBirthDate" class="form-control" value="${escapeHtml(emp.birthDate || '')}">
            </div>
            <div class="form-group" style="flex:1">
                <label>Faoliyat boshlagan</label>
                <input type="date" id="editEmpStartDate" class="form-control" value="${escapeHtml(emp.startDate || emp.joinDate || '')}">
            </div>
        </div>
        <div class="form-group">
            <label>Lavozim (rol) <span style="color:var(--danger)">*</span></label>
            <select id="editEmpRole" class="form-control">${roleOptions}</select>
        </div>
        ${teacherLangHtml(preselectedLang)}
        ${managerLangHtml(emp.lang || 'english')}
        <div class="form-group">
            <label>Telefon raqam</label>
            <input type="tel" id="editEmpPhone" class="form-control" value="${escapeHtml(emp.phone || '')}" placeholder="+998 90 123 45 67">
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="editEmpEmail" class="form-control" value="${escapeHtml(emp.email || '')}" placeholder="email@example.com">
        </div>
        <div class="form-group">
            <label>Bo'lim</label>
            <select id="editEmpDepartment" class="form-control">${deptOptions}</select>
        </div>
        <div class="form-group">
            <label>Holati</label>
            <select id="editEmpStatus" class="form-control">
                <option value="active"${emp.status === 'active' ? ' selected' : ''}>Active</option>
                <option value="inactive"${emp.status !== 'active' ? ' selected' : ''}>Inactive</option>
            </select>
        </div>
        <hr style="margin:12px 0;border-color:var(--border)">
        <p style="font-weight:600;margin-bottom:8px;color:var(--text)">Parolni yangilash (ixtiyoriy)</p>
        <div class="form-group">
            <label>Yangi parol</label>
            <div class="input-password-wrap">
                <input type="password" id="editEmpPassword" class="form-control" placeholder="Bo'sh qoldirsangiz o'zgarmaydi" autocomplete="off">
                <button type="button" class="input-eye-btn" id="editEmpPasswordEye" tabindex="-1" aria-label="Parolni ko'rsat">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>
        </div>`,
        `<button type="button" class="btn-danger-sm" id="cancelEditEmployee">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="saveEditEmployee">Saqlash</button>`,
        { wide: false }
    );

    document.getElementById('editEmpPasswordEye').addEventListener('click', () => {
        const inp = document.getElementById('editEmpPassword');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Til sub-field toggle
    bindTeacherLangToggle('editEmpRole');
    bindManagerLangToggle('editEmpRole');

    document.getElementById('cancelEditEmployee').onclick = () => closeModal();

    document.getElementById('saveEditEmployee').onclick = () => {
        const firstName = document.getElementById('editEmpFirstName').value.trim();
        const lastName = document.getElementById('editEmpLastName').value.trim();
        if (!firstName) { alert('Ism kiritilishi shart'); return; }
        if (!lastName) { alert('Familiya kiritilishi shart'); return; }

        const newPassword = document.getElementById('editEmpPassword').value.trim();
        if (newPassword && newPassword.length < 4) { alert('Parol kamida 4 ta belgi bo\'lishi kerak'); return; }

        const resolvedRole = resolveTeacherRole(document.getElementById('editEmpRole').value);
        const isMgrEdit = resolvedRole === 'sotuv-menejeri' || resolvedRole === 'sotuv_menejeri';
        const updated = {
            ...emp,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            gender: document.getElementById('editEmpGender').value,
            birthDate: document.getElementById('editEmpBirthDate').value,
            startDate: document.getElementById('editEmpStartDate').value,
            role: resolvedRole,
            phone: document.getElementById('editEmpPhone').value.trim(),
            email: document.getElementById('editEmpEmail').value.trim(),
            department: document.getElementById('editEmpDepartment').value,
            status: document.getElementById('editEmpStatus').value,
            lang: isMgrEdit ? resolveManagerLang() : (emp.lang || 'english'),
        };
        if (newPassword) updated.password = newPassword;

        const allEmps = getHrEmployees() || [];
        const idx = allEmps.findIndex(e => e.id === empId);
        if (idx !== -1) allEmps[idx] = updated;
        saveHrEmployees(allEmps);
        closeModal();
        renderHrEmployees();
        showMiniToast(`${updated.name} ma'lumotlari saqlandi`);
    };
}

function openAddEmployeeModal() {
    const roleOptions = Object.entries(HR_ROLE_MAP_MODAL).map(([k, v]) =>
        `<option value="${k}">${escapeHtml(v)}</option>`
    ).join('');
    const deptOptions = HR_DEPARTMENTS.map(d =>
        `<option value="${d}">${escapeHtml(d)}</option>`
    ).join('');

    openModal("Yangi xodim qo'shish",
        `<div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1">
                <label>Ism <span style="color:var(--danger)">*</span></label>
                <input type="text" id="empFirstName" class="form-control" placeholder="Ism">
            </div>
            <div class="form-group" style="flex:1">
                <label>Familiya <span style="color:var(--danger)">*</span></label>
                <input type="text" id="empLastName" class="form-control" placeholder="Familiya">
            </div>
        </div>
        <div class="form-group">
            <label>Jinsi <span style="color:var(--danger)">*</span></label>
            <select id="empGender" class="form-control">
                <option value="">— Tanlang —</option>
                <option value="erkak">Erkak</option>
                <option value="ayol">Ayol</option>
            </select>
        </div>
        <div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1">
                <label>Tug'ilgan sana <span style="color:var(--danger)">*</span></label>
                <input type="date" id="empBirthDate" class="form-control">
            </div>
            <div class="form-group" style="flex:1">
                <label>Faoliyat boshlagan sana <span style="color:var(--danger)">*</span></label>
                <input type="date" id="empStartDate" class="form-control" value="${new Date().toISOString().slice(0,10)}">
            </div>
        </div>
        <div class="form-group">
            <label>Lavozim (rol) <span style="color:var(--danger)">*</span></label>
            <select id="empRole" class="form-control">${roleOptions}</select>
        </div>
        ${teacherLangHtml()}
        ${managerLangHtml()}
        <div class="form-group">
            <label>Telefon raqam <span style="color:var(--danger)">*</span></label>
            <input type="tel" id="empPhone" class="form-control" placeholder="+998 90 123 45 67">
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="empEmail" class="form-control" placeholder="email@example.com">
        </div>
        <div class="form-group">
            <label>Bo'lim</label>
            <select id="empDepartment" class="form-control">${deptOptions}</select>
        </div>
        <hr style="margin:12px 0;border-color:var(--border)">
        <p style="font-weight:600;margin-bottom:8px;color:var(--text)">Kirish ma'lumotlari</p>
        <div class="form-group">
            <label>Login (avtomatik — telefon raqami)</label>
            <input type="text" id="empLogin" class="form-control" placeholder="+998901234567" autocomplete="off">
        </div>
        <div class="form-group">
            <label>Parol <span style="color:var(--danger)">*</span></label>
            <div class="input-password-wrap">
                <input type="password" id="empPassword" class="form-control" placeholder="Kamida 4 ta belgi" autocomplete="off">
                <button type="button" class="input-eye-btn" id="empPasswordEye" tabindex="-1" aria-label="Parolni ko'rsat">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>
        </div>
        <div class="form-group">
            <label>Holati</label>
            <select id="empStatus" class="form-control">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
        </div>`,
        `<button type="button" class="btn-danger-sm" id="cancelAddEmployee">Bekor qilish</button>
         <button type="button" class="btn-primary-sm" id="saveAddEmployee">Saqlash</button>`,
        { wide: false }
    );

    // Login = tel raqam avtomatik
    document.getElementById('empPhone').addEventListener('input', () => {
        const phone = document.getElementById('empPhone').value.trim();
        const loginEl = document.getElementById('empLogin');
        loginEl.value = phone.replace(/\s/g, '');
    });

    // Parol ko'z tugmasi
    document.getElementById('empPasswordEye').addEventListener('click', () => {
        const inp = document.getElementById('empPassword');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Til sub-field toggle
    bindTeacherLangToggle('empRole');
    bindManagerLangToggle('empRole');

    document.getElementById('cancelAddEmployee').onclick = () => closeModal();

    document.getElementById('saveAddEmployee').onclick = async () => {
        const firstName = document.getElementById('empFirstName').value.trim();
        const lastName = document.getElementById('empLastName').value.trim();
        const gender = document.getElementById('empGender').value;
        const birthDate = document.getElementById('empBirthDate').value;
        const startDate = document.getElementById('empStartDate').value;
        const role = resolveTeacherRole(document.getElementById('empRole').value);
        const phone = document.getElementById('empPhone').value.trim();
        const email = document.getElementById('empEmail').value.trim();
        const department = document.getElementById('empDepartment').value;
        const status = document.getElementById('empStatus').value;
        const login = document.getElementById('empLogin').value.trim() || phone.replace(/\s/g, '');
        const password = document.getElementById('empPassword').value.trim();

        if (!firstName) { alert('Ism kiritilishi shart'); return; }
        if (!lastName) { alert('Familiya kiritilishi shart'); return; }
        if (!gender) { alert('Jinsi tanlanishi shart'); return; }
        if (!birthDate) { alert('Tug\'ilgan sana kiritilishi shart'); return; }
        if (!startDate) { alert('Faoliyat boshlagan sana kiritilishi shart'); return; }
        if (!phone) { alert('Telefon raqam kiritilishi shart'); return; }
        if (!login) { alert('Login kiritilishi shart'); return; }
        if (password.length < 4) { alert('Parol kamida 4 ta belgi bo\'lishi kerak'); return; }

        const employees = getHrEmployees() || [];
        if (employees.find(e => e.login === login)) {
            alert('Bu login (telefon raqami) allaqachon mavjud.');
            return;
        }

        const name = `${firstName} ${lastName}`;
        const isMgr = role === 'sotuv-menejeri' || role === 'sotuv_menejeri';
        const newEmp = {
            id: 'hr' + Date.now(),
            name, firstName, lastName, gender, birthDate, startDate,
            role, phone, email, department, status, login, password,
            joinDate: startDate || new Date().toISOString().slice(0, 10),
            lang: isMgr ? resolveManagerLang() : 'english'
        };
        employees.push(newEmp);
        saveHrEmployees(employees);

        const hrUserRole = role === 'rop' ? 'admin'
            : (role === 'sotuv-menejeri' || role === 'sotuv_menejeri') ? 'sales_manager'
            : (role === 'oqituvchi' || role === 'yordamchi') ? 'teacher'
            : 'employee';
        try {
            await apiCreateHrUser({ name, login, password, role: hrUserRole });
        } catch (err) {
            console.warn('Server user yaratishda xatolik:', err.message);
        }

        closeModal();
        renderHrEmployees();
    };
}

// HR role filter tab binding
function initHrEmployeeTabs() {
    // Role filter
    const tabsContainer = document.getElementById('hrRoleTabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-role]');
            if (!btn) return;
            _hrRoleFilter = btn.dataset.role;
            // Lang filter ni reset qilmaymiz — u mustaqil
            tabsContainer.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderHrEmployees();
        });
    }

    // Language filter (faqat o'qituvchilar uchun)
    const langContainer = document.getElementById('hrLangFilter');
    if (langContainer) {
        langContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-hr-lang]');
            if (!btn) return;
            _hrLangFilter = btn.dataset.hrLang;
            langContainer.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Role filterda "O'qituvchi" ni active qilish (til filtri ishlayotganda)
            const roleTabs = document.getElementById('hrRoleTabs');
            if (roleTabs) {
                if (_hrLangFilter !== 'all') {
                    roleTabs.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
                    _hrRoleFilter = 'oqituvchi';
                    const teacherTab = roleTabs.querySelector('[data-role="oqituvchi"]');
                    if (teacherTab) teacherTab.classList.add('active');
                } else {
                    roleTabs.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
                    _hrRoleFilter = 'all';
                    const allTab = roleTabs.querySelector('[data-role="all"]');
                    if (allTab) allTab.classList.add('active');
                }
            }
            renderHrEmployees();
        });
    }
}

document.addEventListener('click', (e) => {
    if (e.target.closest('#btnOpenAddEmployee')) {
        openAddEmployeeModal();
    }
});

initHrEmployeeTabs();

// ═══════════════════════════════════════════════════════════════════════════════
// KITOB YETKAZISH
// ═══════════════════════════════════════════════════════════════════════════════

function autoSyncLeadToBookRoadmap(lang, lead) {
    const items = getItem(STORAGE_KEYS.bookRoadmap, []);
    const alreadyExists = items.some(i => i.leadRef && i.leadRef.id === lead.id && i.leadRef.lang === lang);
    if (alreadyExists) return;

    // Copy existing lead comments + add a summary note with lead data
    const leadComments = Array.isArray(lead.comments) ? lead.comments : [];
    const summaryLines = [];
    if (lead.source) summaryLines.push(`Manba: ${lead.source}`);
    if (lead.connectedSurvey) {
        const s = lead.connectedSurvey;
        if (s.languageLevel) summaryLines.push(`Til darajasi: ${s.languageLevel}`);
        if (s.learningGoal) summaryLines.push(`Maqsad: ${s.learningGoal}`);
        if (s.region) summaryLines.push(`Hudud: ${s.region}`);
    }
    const user = getCurrentUser();
    const author = user?.name || 'Admin';
    const syncComment = createLeadComment({
        type: 'sync',
        text: `Liddan avtomatik qo'shildi (To'lov jarayonida)${summaryLines.length ? '\n' + summaryLines.join(' · ') : ''}`,
        author
    });

    const newEntry = {
        id: crypto.randomUUID(),
        leadRef: { lang, id: lead.id },
        name: lead.name || lead.fullName || '',
        studentId: lead.studentId || '',
        phone: lead.phone || '',
        region: lead.region || (lead.connectedSurvey?.region ? '' : ''),
        managerId: lead.managerId || '',
        managerPhoto: lead.managerPhoto || null,
        kind: lead.leadType === 'target' ? 'target' : 'organik',
        date: new Date().toLocaleDateString('uz-UZ'),
        status: 'yangi-oquvchi',
        lang,
        comments: [...leadComments, syncComment],
    };
    items.unshift(newEntry);
    setItem(STORAGE_KEYS.bookRoadmap, items);
}

const BR_COLUMN_VISIBILITY_KEY = 'mh_br_column_visibility';

let _brManagerFilter = 'all';
let _brVisibleColumns;

function getDefaultBrVisibleColumnIds() {
    return BOOK_ROADMAP_COLUMNS.map(col => col.id);
}

function loadBrVisibleColumns() {
    try {
        const raw = localStorage.getItem(BR_COLUMN_VISIBILITY_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            return BOOK_ROADMAP_COLUMNS.filter(col => saved[col.id] === true).map(col => col.id);
        }
    } catch { /* default */ }
    return getDefaultBrVisibleColumnIds();
}

function saveBrVisibleColumns() {
    const payload = {};
    BOOK_ROADMAP_COLUMNS.forEach(col => {
        payload[col.id] = _brVisibleColumns.has(col.id);
    });
    localStorage.setItem(BR_COLUMN_VISIBILITY_KEY, JSON.stringify(payload));
}

function getVisibleBrColumns() {
    return BOOK_ROADMAP_COLUMNS.filter(col => _brVisibleColumns.has(col.id));
}

function updateBrManagerFilterDisplay() {
    const select = document.getElementById('brManagerFilter');
    const display = document.getElementById('brManagerFilterDisplay');
    if (!select || !display) return;
    if (_brManagerFilter === 'all') {
        display.textContent = 'Sotuv menejerlari';
        display.classList.remove('is-selected');
        return;
    }
    const opt = select.options[select.selectedIndex];
    display.textContent = opt ? opt.textContent : 'Sotuv menejerlari';
    display.classList.add('is-selected');
}

function renderBrManagerFilter() {
    const select = document.getElementById('brManagerFilter');
    if (!select) return;
    const user = getCurrentUser();
    if (user && user.role === 'sales_manager') {
        const filterBox = select.closest('.leads-filter-box');
        if (filterBox) filterBox.style.display = 'none';
        if (_brManagerFilter === 'all') {
            _brManagerFilter = user.linkedManagerId || 'unassigned';
        }
        return;
    }
    const managers = getItem(STORAGE_KEYS.salesManagers, []);
    const current = _brManagerFilter;
    select.innerHTML = `<option value="all">Barcha menejerlar</option>
        <option value="unassigned">Biriktirilmagan</option>
        ${managers.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join('')}`;
    select.value = current;
    updateBrManagerFilterDisplay();
}

function updateBrColumnsFilterLabel() {
    const valueEl = document.getElementById('brColumnsFilterValue');
    if (!valueEl) return;
    const allIds = getDefaultBrVisibleColumnIds();
    if (_brVisibleColumns.size === allIds.length && allIds.every(id => _brVisibleColumns.has(id))) {
        valueEl.textContent = 'Ustunlar filtri';
        valueEl.classList.remove('is-selected');
        return;
    }
    valueEl.textContent = `${_brVisibleColumns.size} ta ustun`;
    valueEl.classList.add('is-selected');
}

function initBrColumnsFilter() {
    const dropdown = document.getElementById('brColumnsDropdown');
    if (!dropdown || dropdown.dataset.ready === '1') return;
    dropdown.dataset.ready = '1';

    dropdown.innerHTML = BOOK_ROADMAP_COLUMNS.map(col => {
        const checked = _brVisibleColumns.has(col.id);
        return `<label class="leads-column-option">
            <input type="checkbox" value="${col.id}" ${checked ? 'checked' : ''}>
            <span>${escapeHtml(col.label)}</span>
        </label>`;
    }).join('');

    dropdown.addEventListener('change', e => {
        const input = e.target;
        if (input.type !== 'checkbox') return;
        if (input.checked) _brVisibleColumns.add(input.value);
        else _brVisibleColumns.delete(input.value);
        saveBrVisibleColumns();
        updateBrColumnsFilterLabel();
        renderBookRoadmap();
    });

    dropdown.addEventListener('click', e => e.stopPropagation());
}

function closeBrColumnsDropdown() {
    const dropdown = document.getElementById('brColumnsDropdown');
    const btn = document.getElementById('brColumnsFilterBtn');
    if (dropdown) dropdown.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function filterBrByManager(items) {
    if (_brManagerFilter === 'all') return items;
    if (_brManagerFilter === 'unassigned') return items.filter(i => !i.managerId);
    return items.filter(i => i.managerId === _brManagerFilter);
}

function initBrDragDrop(kanban) {
    kanban.querySelectorAll('.lead-card[data-br-id]').forEach(card => {
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', card.dataset.brId);
            card.classList.add('lead-card--dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('lead-card--dragging');
            kanban.querySelectorAll('.lead-column-cards').forEach(z => z.classList.remove('drag-over'));
        });
    });

    kanban.querySelectorAll('.lead-column-cards[data-br-drop-col]').forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', e => {
            if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            const toStatus = zone.dataset.brDropCol;
            if (!id || !toStatus) return;
            updateBrInStorage(id, item => ({ ...item, status: toStatus }));
            renderBookRoadmap();
        });
    });
}

const BOOK_ROADMAP_COLUMNS = [
    { id: 'yangi-oquvchi',        label: "Yangi o'quvchi",        bg: '#EFF6FF', border: '#93C5FD', headerBg: 'rgba(59,130,246,0.14)', title: '#1D4ED8', count: '#2563EB' },
    { id: 'manzil-olindi',        label: 'Manzil olindi',          bg: '#F5F3FF', border: '#C4B5FD', headerBg: 'rgba(124,58,237,0.12)', title: '#5B21B6', count: '#7C3AED' },
    { id: 'pochtaga-tayyorlandi', label: 'Pochtaga tayyorlandi',   bg: '#ECFEFF', border: '#67E8F9', headerBg: 'rgba(6,182,212,0.12)',  title: '#0E7490', count: '#0891B2' },
    { id: 'pochtaga-topshirildi', label: 'Pochtaga topshirildi',   bg: '#EEF2FF', border: '#A5B4FC', headerBg: 'rgba(79,70,229,0.12)',  title: '#3730A3', count: '#4F46E5' },
    { id: 'pochta-yetib-bordi',   label: 'Pochta yetib bordi',     bg: '#FFF7ED', border: '#FDBA74', headerBg: 'rgba(234,88,12,0.12)',  title: '#C2410C', count: '#EA580C' },
    { id: 'mijoz-qabul-qildi',    label: 'Mijoz qabul qilib oldi', bg: '#ECFDF5', border: '#6EE7B7', headerBg: 'rgba(5,150,105,0.12)',  title: '#047857', count: '#059669' },
];

const BR_STATUS_IDS = new Set(BOOK_ROADMAP_COLUMNS.map(c => c.id));

_brVisibleColumns = new Set(loadBrVisibleColumns());

function normalizeBrStatus(s) {
    return BR_STATUS_IDS.has(s) ? s : 'yangi-oquvchi';
}

function getBrNextColumnId(currentStatus) {
    const idx = BOOK_ROADMAP_COLUMNS.findIndex(c => c.id === currentStatus);
    if (idx === -1 || idx >= BOOK_ROADMAP_COLUMNS.length - 1) return null;
    return BOOK_ROADMAP_COLUMNS[idx + 1].id;
}

function renderBookRoadmapCard(item) {
    const _cu = getCurrentUser();
    const _isAdminOrRop = _cu && FULL_ACCESS_ROLES.has(_cu.role);
    const _isSalesManager = _cu?.role === 'sales_manager';

    const managers = getItem(STORAGE_KEYS.salesManagers, []);
    const manager = managers.find(m => m.id === item.managerId);
    const commentCount = item.comments?.length || 0;
    const hasManagerPhoto = Boolean(item.managerPhoto);

    const _brMgrAvatar = manager?.avatar || '';
    const _brMgrInitials = manager
        ? manager.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : '';
    const brManagerAvatarHtml = _brMgrAvatar
        ? `<img src="${escapeHtml(_brMgrAvatar)}" alt="${escapeHtml(manager?.name || '')}" class="lead-mgr-avatar-img">`
        : _brMgrInitials
        ? `<span class="lead-mgr-avatar-initials">${escapeHtml(_brMgrInitials)}</span>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const checkboxHtml = _isAdminOrRop
        ? `<input type="checkbox" class="lead-bulk-checkbox" data-br-bulk-id="${escapeHtml(item.id)}" aria-label="Belgilash">`
        : '';

    const studentIdBadge = item.studentId
        ? `<span class="lead-card-serial">#${escapeHtml(item.studentId)}</span>`
        : '';

    const moveItems = BOOK_ROADMAP_COLUMNS.map(col =>
        `<button type="button" class="lead-card-menu-item" data-br-move="${item.id}" data-br-status="${col.id}">${escapeHtml(col.label)}</button>`
    ).join('');

    const deleteItem = !_isSalesManager
        ? `<button type="button" class="lead-card-menu-item lead-card-menu-item--danger" data-br-delete="${item.id}">Yozuvni o'chirish</button>`
        : '';

    const phoneSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;

    return `<article class="lead-card" draggable="true" data-br-id="${escapeHtml(item.id)}">
        <div class="lead-card-top">
            ${checkboxHtml}
            <div class="lead-card-title-wrap">
                <h4 class="lead-card-name">${escapeHtml(item.name)}</h4>
                <div class="lead-card-meta">
                    <span class="lead-card-time">${escapeHtml(item.date || '')}</span>
                    ${studentIdBadge}
                </div>
            </div>
            <div class="lead-card-top-actions">
                <button type="button" class="lead-card-notify" data-br-notify="${item.id}" title="Bildirishnomalar" aria-label="Bildirishnomalar">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
                </button>
                <div class="lead-card-menu-wrap">
                    <button type="button" class="lead-card-menu-btn" data-br-menu-toggle="${item.id}" title="Boshqa amallar" aria-label="Boshqa amallar" aria-haspopup="true">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                    </button>
                    <div class="lead-card-menu-dropdown" hidden>
                        <button type="button" class="lead-card-menu-item" data-br-edit="${item.id}">Tahrirlash</button>
                        <div class="lead-card-menu-submenu-wrap">
                            <button type="button" class="lead-card-menu-item lead-card-menu-item--submenu" data-br-move-toggle>
                                Boshqa bosqichga o'tkazish
                                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                            </button>
                            <div class="lead-card-menu-submenu" hidden>${moveItems}</div>
                        </div>
                        ${deleteItem}
                    </div>
                </div>
            </div>
        </div>
        <div class="lead-card-contacts">
            <div class="lead-card-contact">
                ${phoneSvg}
                <span>${escapeHtml(item.phone || '—')}</span>
            </div>
            <div class="lead-card-contact">
                ${phoneSvg}
                <span>${escapeHtml(item.region || '—')}</span>
            </div>
        </div>
        <div class="lead-card-footer">
            <div class="lead-card-actions">
                <button type="button" class="lead-card-action lead-card-action--mgr${manager ? ' lead-card-action--active' : ''}" data-br-manager-photo="${item.id}" title="${escapeHtml(manager?.name || 'Menejer biriktirilmagan')}">
                    <span class="lead-mgr-avatar">${brManagerAvatarHtml}</span>
                </button>
                <button type="button" class="lead-card-action" data-br-comment="${item.id}" title="Izohlar">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <span>${commentCount}</span>
                </button>
            </div>
            <span class="lead-card-kind">${item.kind === 'target' ? 'Target' : 'Organik'}${manager ? ` · ${escapeHtml(manager.name)}` : ''}</span>
        </div>
    </article>`;
}

function renderBookRoadmap() {
    const kanban = document.getElementById('bookRoadmapKanban');
    if (!kanban) return;

    renderBrManagerFilter();
    initBrColumnsFilter();
    updateBrColumnsFilterLabel();

    let items = getItem(STORAGE_KEYS.bookRoadmap, []);

    const lang = _leadsLangFilter === 'russian' ? 'russian' : 'english';
    items = items.filter(i => i.lang === lang);

    items = filterBrByManager(items);

    const visibleColumns = getVisibleBrColumns();

    if (!visibleColumns.length) {
        kanban.innerHTML = '<div class="lead-column-empty leads-kanban-empty">Kamida bitta ustunni tanlang</div>';
        return;
    }

    kanban.innerHTML = visibleColumns.map(col => {
        const colItems = items.filter(i => normalizeBrStatus(i.status) === col.id);
        const cards = colItems.length
            ? colItems.map(i => renderBookRoadmapCard(i)).join('')
            : '<div class="lead-column-empty">Yozuvlar yo\'q</div>';
        return `<div class="lead-column" data-br-col="${col.id}" style="background:${col.bg};border-color:${col.border}">
            <div class="lead-column-header" style="background:${col.headerBg}">
                <h3 class="lead-column-title" style="color:${col.title}">${escapeHtml(col.label)}</h3>
                <span class="lead-column-count" style="color:${col.count}">${colItems.length}</span>
            </div>
            <div class="lead-column-cards" data-br-drop-col="${col.id}">${cards}</div>
        </div>`;
    }).join('');

    initBrDragDrop(kanban);
}

function saveBrAndRender(items) {
    setItem(STORAGE_KEYS.bookRoadmap, items);
    renderBookRoadmap();
}

function getBrById(id) {
    return getItem(STORAGE_KEYS.bookRoadmap, []).find(i => i.id === id) || null;
}

function updateBrInStorage(id, updater) {
    const items = getItem(STORAGE_KEYS.bookRoadmap, []);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) items[idx] = updater(items[idx]);
    setItem(STORAGE_KEYS.bookRoadmap, items);
}

function openBookRoadmapModal(existing = null) {
    const allManagers = getItem(STORAGE_KEYS.salesManagers, []);
    const isEdit = !!existing;
    const defaultLang = _leadsLangFilter === 'russian' ? 'russian' : 'english';
    const d = existing || { name: '', studentId: '', phone: '', region: '', managerId: '', kind: 'organik', date: new Date().toLocaleDateString('uz-UZ'), status: 'yangi-oquvchi', lang: defaultLang };
    const managers = allManagers.filter(m => (m.lang || 'english') === defaultLang);
    const _cuBr = getCurrentUser();
    const _isSmBr = _cuBr && _cuBr.role === 'sales_manager';
    const brAutoManagerId = _isSmBr ? (_cuBr.linkedManagerId || '') : d.managerId;

    const managerOptions = `<option value="">— Menejerni tanlang —</option>` +
        managers.map(m => `<option value="${escapeHtml(m.id)}"${m.id === brAutoManagerId ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('');

    const statusOptions = BOOK_ROADMAP_COLUMNS.map(c =>
        `<option value="${c.id}"${c.id === (d.status || 'yangi-oquvchi') ? ' selected' : ''}>${escapeHtml(c.label)}</option>`
    ).join('');

    const dLang = d.lang || defaultLang;

    openModal(`${isEdit ? 'Tahrirlash' : 'Yangi yozuv'} — Kitob yetkazish`, `
        <div style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group">
                <label>Ism Familya *</label>
                <input type="text" id="brName" class="form-control" value="${escapeHtml(d.name)}" placeholder="To'liq ism">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group">
                    <label>Student ID</label>
                    <input type="text" id="brStudentId" class="form-control" value="${escapeHtml(d.studentId || '')}" placeholder="ID raqam">
                </div>
                <div class="form-group">
                    <label>Sana</label>
                    <input type="text" id="brDate" class="form-control" value="${escapeHtml(d.date || '')}" placeholder="kk.oo.yyyy">
                </div>
            </div>
            <div class="form-group">
                <label>Telefon raqam</label>
                <input type="text" id="brPhone" class="form-control" value="${escapeHtml(d.phone || '')}" placeholder="+998 90 000 00 00">
            </div>
            <div class="form-group">
                <label>Viloyat, tuman</label>
                <input type="text" id="brRegion" class="form-control" value="${escapeHtml(d.region || '')}" placeholder="Toshkent, Yunusobod">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <div class="form-group" ${_isSmBr ? 'style="display:none"' : ''}>
                    <label>Sotuv menejeri</label>
                    <select id="brManager" class="form-control">${managerOptions}</select>
                </div>
                <div class="form-group">
                    <label>Organik / Target</label>
                    <select id="brKind" class="form-control">
                        <option value="organik"${d.kind !== 'target' ? ' selected' : ''}>Organik</option>
                        <option value="target"${d.kind === 'target' ? ' selected' : ''}>Target</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Til</label>
                    <select id="brLang" class="form-control">
                        <option value="english"${dLang !== 'russian' ? ' selected' : ''}>Ingliz tili</option>
                        <option value="russian"${dLang === 'russian' ? ' selected' : ''}>Rus tili</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Bosqich</label>
                <select id="brStatus" class="form-control">${statusOptions}</select>
            </div>
        </div>
    `, `<button class="btn-primary" id="brSaveBtn">${isEdit ? 'Saqlash' : "Qo'shish"}</button>`);

    document.getElementById('brSaveBtn').onclick = () => {
        const name = document.getElementById('brName').value.trim();
        if (!name) { alert("Ism familya kiritilishi shart"); return; }
        const data = {
            id: existing?.id || crypto.randomUUID(),
            leadRef: existing?.leadRef || null,
            name,
            studentId: document.getElementById('brStudentId').value.trim(),
            date: document.getElementById('brDate').value.trim(),
            phone: document.getElementById('brPhone').value.trim(),
            region: document.getElementById('brRegion').value.trim(),
            managerId: _isSmBr ? brAutoManagerId : document.getElementById('brManager').value,
            kind: document.getElementById('brKind').value,
            lang: document.getElementById('brLang').value,
            status: document.getElementById('brStatus').value,
            comments: existing?.comments || [],
        };
        const items = getItem(STORAGE_KEYS.bookRoadmap, []);
        if (isEdit) {
            const idx = items.findIndex(i => i.id === data.id);
            if (idx !== -1) items[idx] = data;
        } else {
            items.unshift(data);
        }
        saveBrAndRender(items);
        closeModal();
    };
}

function openBrCommentModal(id) {
    const item = getBrById(id);
    if (!item) return;
    openModal(`Izoh — ${escapeHtml(item.name)}`, `
        <div style="display:flex;flex-direction:column;gap:10px">
            ${item.comments?.length ? `<div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
                ${item.comments.map(c => `<div style="background:var(--surface-2,#f4f4f5);padding:8px 10px;border-radius:6px;font-size:13px">${escapeHtml(c.text)}<span style="color:var(--text-muted);font-size:11px;float:right">${escapeHtml(c.date || '')}</span></div>`).join('')}
            </div>` : '<p style="color:var(--text-muted);font-size:13px">Izohlar yo\'q</p>'}
            <textarea id="brCommentText" class="form-control" rows="3" placeholder="Izoh yozing..."></textarea>
        </div>
    `, `<button class="btn-primary" id="brCommentSaveBtn">Qo'shish</button>`);

    document.getElementById('brCommentSaveBtn').onclick = () => {
        const text = document.getElementById('brCommentText').value.trim();
        if (!text) return;
        updateBrInStorage(id, item => ({
            ...item,
            comments: [...(item.comments || []), { text, date: new Date().toLocaleDateString('uz-UZ') }]
        }));
        renderBookRoadmap();
        closeModal();
    };
}

function openBrManagerPhotoModal(id) {
    const item = getBrById(id);
    if (!item) return;

    const managers = getItem(STORAGE_KEYS.salesManagers, []);
    const manager = managers.find(m => m.id === item.managerId);

    if (manager && manager.avatar) {
        openModal(`${escapeHtml(item.name)} — menejer`,
            `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0">
                <img src="${escapeHtml(manager.avatar)}" alt="${escapeHtml(manager.name)}"
                     style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid var(--purple)">
                <div style="text-align:center">
                    <div style="font-size:16px;font-weight:700;color:var(--text)">${escapeHtml(manager.name)}</div>
                    <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Sotuv menejeri</div>
                </div>
            </div>`,
            `<button type="button" class="btn-primary-sm" id="brMgrCloseBtn">Yopish</button>`
        );
    } else if (manager) {
        const initials = manager.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
        openModal(`${escapeHtml(item.name)} — menejer`,
            `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0">
                <div style="width:80px;height:80px;border-radius:50%;background:var(--purple-light);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--purple)">${escapeHtml(initials)}</div>
                <div style="text-align:center">
                    <div style="font-size:16px;font-weight:700;color:var(--text)">${escapeHtml(manager.name)}</div>
                    <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Profil rasmi yo'q</div>
                </div>
            </div>`,
            `<button type="button" class="btn-primary-sm" id="brMgrCloseBtn">Yopish</button>`
        );
    } else {
        openModal(`${escapeHtml(item.name)} — menejer`,
            `<p class="text-muted lead-empty-hint" style="text-align:center;padding:16px">Menejer biriktirilmagan</p>`,
            `<button type="button" class="btn-primary-sm" id="brMgrCloseBtn">Yopish</button>`
        );
    }
    document.getElementById('brMgrCloseBtn').onclick = closeModal;
}

// Book Roadmap event delegation
document.addEventListener('click', (e) => {
    // Menu toggle
    const menuToggle = e.target.closest('[data-br-menu-toggle]');
    if (menuToggle) {
        const id = menuToggle.dataset.brMenuToggle;
        const wrap = menuToggle.closest('.lead-card-menu-wrap');
        const dropdown = wrap?.querySelector('.lead-card-menu-dropdown');
        if (!dropdown) return;
        const isOpen = !dropdown.hidden;
        document.querySelectorAll('#bookRoadmapKanban .lead-card-menu-dropdown').forEach(d => d.hidden = true);
        dropdown.hidden = isOpen;
        return;
    }

    // Submenu toggle (move)
    const moveToggle = e.target.closest('[data-br-move-toggle]');
    if (moveToggle) {
        const submenu = moveToggle.closest('.lead-card-menu-submenu-wrap')?.querySelector('.lead-card-menu-submenu');
        if (submenu) submenu.hidden = !submenu.hidden;
        return;
    }

    // Next column button
    const nextBtn = e.target.closest('[data-br-next]');
    if (nextBtn) {
        const id = nextBtn.dataset.brNext;
        const status = nextBtn.dataset.brNextStatus;
        updateBrInStorage(id, item => ({ ...item, status }));
        renderBookRoadmap();
        return;
    }

    // Move to status
    const moveBtn = e.target.closest('[data-br-move]');
    if (moveBtn) {
        const id = moveBtn.dataset.brMove;
        const status = moveBtn.dataset.brStatus;
        updateBrInStorage(id, item => ({ ...item, status }));
        renderBookRoadmap();
        return;
    }

    // Edit
    const editBtn = e.target.closest('[data-br-edit]');
    if (editBtn) {
        const id = editBtn.dataset.brEdit;
        openBookRoadmapModal(getBrById(id));
        return;
    }

    // Notify (opens comment modal to show history)
    const notifyBtn = e.target.closest('[data-br-notify]');
    if (notifyBtn) {
        openBrCommentModal(notifyBtn.dataset.brNotify);
        return;
    }

    // Manager photo
    const managerPhotoBtn = e.target.closest('[data-br-manager-photo]');
    if (managerPhotoBtn) {
        openBrManagerPhotoModal(managerPhotoBtn.dataset.brManagerPhoto);
        return;
    }

    // Comment
    const commentBtn = e.target.closest('[data-br-comment]');
    if (commentBtn) {
        openBrCommentModal(commentBtn.dataset.brComment);
        return;
    }

    // Delete
    const deleteBtn = e.target.closest('[data-br-delete]');
    if (deleteBtn) {
        const id = deleteBtn.dataset.brDelete;
        const item = getBrById(id);
        if (!item) return;
        openModal("O'chirishni tasdiqlang",
            `<p><b>${escapeHtml(item.name)}</b> yozuvini o'chirmoqchimisiz?</p>`,
            `<button class="btn-danger" id="brConfirmDelete">O'chirish</button>`
        );
        document.getElementById('brConfirmDelete').onclick = () => {
            const items = getItem(STORAGE_KEYS.bookRoadmap, []).filter(i => i.id !== id);
            saveBrAndRender(items);
            closeModal();
        };
        return;
    }

    // Add new button (header btn)
    if (e.target.closest('#addBookRoadmapHeaderBtn')) {
        openBookRoadmapModal();
        return;
    }

    // Close dropdowns on outside click
    if (!e.target.closest('.lead-card-menu-wrap')) {
        document.querySelectorAll('#bookRoadmapKanban .lead-card-menu-dropdown').forEach(d => d.hidden = true);
    }
});

// Book Roadmap filter handlers
document.addEventListener('change', e => {
    if (e.target.id === 'brManagerFilter') {
        _brManagerFilter = e.target.value;
        updateBrManagerFilterDisplay();
        renderBookRoadmap();
    }
});

const brColumnsFilterBtn = document.getElementById('brColumnsFilterBtn');
if (brColumnsFilterBtn) {
    brColumnsFilterBtn.addEventListener('click', e => {
        e.stopPropagation();
        const dropdown = document.getElementById('brColumnsDropdown');
        if (!dropdown) return;
        const willOpen = dropdown.hidden;
        closeBrColumnsDropdown();
        closeLeadCardMenus();
        dropdown.hidden = !willOpen;
        brColumnsFilterBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
}

bootApp();
