// Myhomework.uz — bildirishnomalar

const NOTIF_KEY = 'mh_notifications';

function getNotifications() {
    try {
        return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveNotifications(list) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
}

function syncNotifications() {
    const existing = getNotifications();
    const readIds = new Set(existing.filter(n => n.read).map(n => n.id));
    const fresh = [];

    const students = getItem(STORAGE_KEYS.students, []);
    const payments = getItem(STORAGE_KEYS.payments, []);
    const leads = getItem(STORAGE_KEYS.leads, { english: [], russian: [] });
    const teachers = getItem(STORAGE_KEYS.teachers, []);
    const monthVal = getMonthKey(new Date());
    const today = new Date();
    const dayNum = today.getDate();

    payments.filter(p => p.debt > 0).forEach(p => {
        const st = students.find(s => s.id === p.studentId);
        fresh.push({
            id: `debt_${p.id}`,
            type: 'warning',
            title: 'Qarzdorlik',
            message: `${st?.name || 'O\'quvchi'} — ${formatMoney(p.debt)} qarzi bor`,
            tab: 'payments',
            time: Date.now()
        });
    });

    const todayDow = today.getDay();
    const isLessonDay = teachers.some(t => {
        const pattern = SCHEDULE_PATTERNS[t.schedulePattern || 'mwf'];
        return pattern.days.includes(todayDow);
    });
    if (isLessonDay) {
        fresh.push({
            id: `att_${monthVal}_${dayNum}`,
            type: 'info',
            title: 'Davomat eslatmasi',
            message: 'Bugun dars kuni — davomatni belgilashni unutmang',
            tab: 'main-attendance',
            time: Date.now()
        });
    }

    const timetable = getItem(STORAGE_KEYS.timetable, {});
    const todayStr = today.toISOString().split('T')[0];
    const probniyToday = Object.entries(timetable).filter(([k, v]) => k.startsWith(todayStr) && v.studentId);
    if (probniyToday.length) {
        fresh.push({
            id: `probniy_${todayStr}`,
            type: 'info',
            title: 'Probniy darslar',
            message: `Bugun ${probniyToday.length} ta probniy dars rejalashtirilgan`,
            tab: 'timetable',
            time: Date.now()
        });
    }

    const totalLeads = leads.english.length + leads.russian.length;
    const externalLeads = [...leads.english, ...leads.russian].filter(l => {
        const s = (l.source || '').toLowerCase();
        return s.includes('domwork') || s.includes('homework');
    });
    const domworkCount = externalLeads.filter(l => (l.source || '').toLowerCase().includes('domwork')).length;
    const homeworkCount = externalLeads.filter(l => (l.source || '').toLowerCase().includes('homework')).length;

    if (domworkCount > 0) {
        fresh.push({
            id: 'leads_domwork',
            type: 'success',
            title: 'Domwork lidlar',
            message: `${domworkCount} ta lid Domwork saytidan`,
            tab: 'leads',
            time: Date.now()
        });
    }
    if (homeworkCount > 0) {
        fresh.push({
            id: 'leads_homework',
            type: 'success',
            title: 'Homework lidlar',
            message: `${homeworkCount} ta lid Homework saytidan`,
            tab: 'leads',
            time: Date.now()
        });
    }
    if (totalLeads > 0 && externalLeads.length === 0) {
        fresh.push({
            id: 'leads_summary',
            type: 'success',
            title: 'Organik lidlar',
            message: `Jami ${totalLeads} ta lid (${leads.english.length} ingliz, ${leads.russian.length} rus)`,
            tab: 'leads',
            time: Date.now()
        });
    }

    teachers.forEach(t => {
        const attStore = t.type === 'yordamchi'
            ? getItem(STORAGE_KEYS.assistantAttendance, {})
            : getItem(STORAGE_KEYS.mainAttendance, {});
        const kpi = calculateKpiSalary(t, monthVal, attStore);
        if (kpi.expected > 0 && kpi.kpiPercent < 50 && kpi.completed < kpi.expected) {
            fresh.push({
                id: `kpi_${t.id}_${monthVal}`,
                type: 'warning',
                title: 'Past KPI',
                message: `${t.name}: ${kpi.completed}/${kpi.expected} dars (${kpi.kpiPercent}%)`,
                tab: 'salary',
                time: Date.now()
            });
        }
    });

    const merged = fresh.map(n => ({
        ...n,
        read: readIds.has(n.id)
    }));

    saveNotifications(merged);
    return merged;
}

function getUnreadCount() {
    return getNotifications().filter(n => !n.read).length;
}

function markNotificationRead(id) {
    const list = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(list);
    renderNotificationPanel();
}

function markAllNotificationsRead() {
    saveNotifications(getNotifications().map(n => ({ ...n, read: true })));
    renderNotificationPanel();
}

function renderNotificationPanel() {
    const list = syncNotifications();
    const badge = document.getElementById('notifBadge');
    const body = document.getElementById('notifList');
    const unread = list.filter(n => !n.read).length;

    if (badge) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }

    if (!body) return;

    if (!list.length) {
        body.innerHTML = '<div class="notif-empty">Bildirishnomalar yo\'q</div>';
        return;
    }

    body.innerHTML = list.map(n => `
        <button type="button" class="notif-item ${n.read ? 'read' : ''}" data-notif-id="${n.id}" data-notif-tab="${n.tab || ''}">
            <div class="notif-icon notif-${n.type}">${notifIcon(n.type)}</div>
            <div class="notif-content">
                <strong>${n.title}</strong>
                <p>${n.message}</p>
                <span class="notif-time">${formatNotifTime(n.time)}</span>
            </div>
            ${!n.read ? '<span class="notif-dot"></span>' : ''}
        </button>
    `).join('');

    body.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => {
            markNotificationRead(item.dataset.notifId);
            const tab = item.dataset.notifTab;
            if (tab && typeof switchTab === 'function') {
                switchTab(tab);
                closeNotificationPanel();
            }
        });
    });
}

function notifIcon(type) {
    const icons = { warning: '⚠️', info: 'ℹ️', success: '✅', danger: '🔴' };
    return icons[type] || '🔔';
}

function formatNotifTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Hozirgina';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' daq oldin';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' soat oldin';
    return new Date(ts).toLocaleDateString('uz-UZ');
}

function openNotificationPanel() {
    const panel = document.getElementById('notifPanel');
    if (panel) {
        panel.classList.add('open');
        renderNotificationPanel();
    }
}

function closeNotificationPanel() {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.remove('open');
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    if (panel.classList.contains('open')) closeNotificationPanel();
    else openNotificationPanel();
}

function initNotifications() {
    const btn = document.getElementById('notifToggle');
    const markAll = document.getElementById('notifMarkAll');

    if (btn) btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleNotificationPanel();
    });

    if (markAll) markAll.addEventListener('click', e => {
        e.stopPropagation();
        markAllNotificationsRead();
    });

    document.addEventListener('click', e => {
        const panel = document.getElementById('notifPanel');
        const toggle = document.getElementById('notifToggle');
        if (panel?.classList.contains('open') &&
            !panel.contains(e.target) && !toggle?.contains(e.target)) {
            closeNotificationPanel();
        }
    });

    renderNotificationPanel();
}

if (document.getElementById('notifToggle')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotifications);
    } else {
        initNotifications();
    }
}
