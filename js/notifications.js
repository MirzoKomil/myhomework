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

// Bildirishnomalar rol bo'yicha quriladi va har biri haqiqiy, harakat talab
// qiladigan holat. Ilgari: har bir eski to'lov yozuvi uchun alohida
// "Qarzdorlik" (hammaga, ustozga ham), har kuni bir xil davomat eslatmasi,
// jami lidlar soni va hammasida "Hozirgina" vaqti chiqardi.
function notifTashkentDay(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function notifAt(dayKey, hhmm) {
    return Date.parse(`${dayKey}T${hhmm}:00+05:00`);
}

function buildRoleNotifications(user, now = new Date()) {
    const out = [];
    const role = user?.role || '';
    const todayKey = notifTashkentDay(now);
    const money = n => (typeof formatMoney === 'function' ? formatMoney(n) : `${Number(n || 0).toLocaleString('uz-UZ')} so'm`);
    let students = getItem(STORAGE_KEYS.students, []).filter(s => !s.frozen && !s.isStaffDemo);

    // Qarzdorlar — faqat pul bilan ishlaydigan rollarga; menejerga o'z o'quvchilari, ROPga o'z tili.
    if (['admin', 'boshliq', 'rop', 'sales_manager'].includes(role)) {
        let own = students;
        if (role === 'sales_manager' && typeof filterStudentsForSalesManager === 'function') own = filterStudentsForSalesManager(students, user);
        if (role === 'rop' && user.linkedRopLang) own = own.filter(s => (s.subject || 'english') === user.linkedRopLang);
        const dueKey = s => {
            const d = s.paymentDueDate ? new Date(s.paymentDueDate) : null;
            return d && !Number.isNaN(d.getTime()) ? notifTashkentDay(d) : null;
        };
        const withDebt = own.filter(s => Number(s.debtAmount || 0) > 0);
        const overdue = withDebt.filter(s => { const k = dueKey(s); return k && k < todayKey; })
            .sort((a, b) => Number(b.debtAmount || 0) - Number(a.debtAmount || 0));
        const dueToday = withDebt.filter(s => dueKey(s) === todayKey);
        if (overdue.length) {
            const sum = overdue.reduce((a, s) => a + Number(s.debtAmount || 0), 0);
            out.push({
                id: `debt-overdue-${todayKey}-${overdue.length}`, type: 'danger', title: "Muddati o'tgan to'lovlar",
                message: `${overdue.length} ta o'quvchi · ${money(sum)}. Eng kattasi: ${overdue[0].name || "O'quvchi"} — ${money(overdue[0].debtAmount)}`,
                tab: 'sales', section: 'debtors', debtQuick: 'overdue', time: notifAt(todayKey, '09:00')
            });
        }
        if (dueToday.length) {
            out.push({
                id: `debt-today-${todayKey}-${dueToday.length}`, type: 'warning', title: "Bugun to'lov kuni",
                message: `${dueToday.length} ta o'quvchi: ${dueToday.slice(0, 3).map(s => s.name || "O'quvchi").join(', ')}${dueToday.length > 3 ? ` va yana ${dueToday.length - 3} ta` : ''}`,
                tab: 'sales', section: 'debtors', debtQuick: 'all', time: notifAt(todayKey, '09:00')
            });
        }
    }

    // Ustozga — faqat bugun o'z darsi bo'lsa, nechta ekanini aytadi.
    if (role === 'teacher' && user.linkedTeacherId && typeof expandLessonPatternDays === 'function') {
        const ids = typeof getTeacherAssignmentIds === 'function' ? getTeacherAssignmentIds(user.linkedTeacherId) : new Set([String(user.linkedTeacherId)]);
        const dow = now.getDay() || 7;
        const mine = students.filter(s => ids.has(String(s.teacherId || '')) && s.lessonDayOfWeek != null && s.lessonTime
            && expandLessonPatternDays(s.lessonDayOfWeek).includes(dow) && !(s.startDate && String(s.startDate) > todayKey));
        if (mine.length) {
            const first = mine.map(s => s.lessonTime).sort()[0];
            out.push({
                id: `lessons-${todayKey}`, type: 'info', title: 'Bugungi darslar',
                message: `Bugun ${mine.length} ta darsingiz bor, birinchisi ${first} da. Har dars tugagach davomatni belgilang.`,
                tab: 'teachers-section', time: notifAt(todayKey, '08:00')
            });
        }
    }

    // Past KPI — faqat admin uchun, bitta umumiy xabar.
    if (['admin', 'boshliq'].includes(role) && typeof calculateKpiSalary === 'function') {
        const monthVal = getMonthKey(now);
        const low = getItem(STORAGE_KEYS.teachers, []).filter(t => {
            try {
                const store = t.type === 'yordamchi' ? getItem(STORAGE_KEYS.assistantAttendance, {}) : getItem(STORAGE_KEYS.mainAttendance, {});
                const kpi = calculateKpiSalary(t, monthVal, store);
                return kpi.expected > 0 && kpi.kpiPercent < 50 && kpi.completed < kpi.expected;
            } catch (e) { return false; }
        });
        if (low.length) {
            out.push({
                id: `kpi-low-${monthVal}-${low.length}`, type: 'warning', title: 'Past KPI',
                message: `${low.length} ta ustozda bu oy KPI 50% dan past: ${low.slice(0, 3).map(t => t.name).join(', ')}${low.length > 3 ? '…' : ''}`,
                tab: 'finance', time: notifAt(todayKey, '09:00')
            });
        }
    }
    return out;
}

function syncNotifications() {
    const existing = getNotifications();
    const readIds = new Set(existing.filter(n => n.read).map(n => n.id));
    const seenAt = new Map(existing.map(n => [n.id, n.time]));
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const fresh = buildRoleNotifications(user);

    // CRM SLA eslatmalari app.js ichida rol va til bo'yicha filtrlanadi:
    // menejerga buyruqlar, ROPga faqat kechikishlar, adminga yakuniy eskalatsiya.
    if (typeof getLeadSlaNotificationsForCurrentUser === 'function') {
        fresh.push(...getLeadSlaNotificationsForCurrentUser());
    }

    const merged = fresh.map(n => ({
        ...n,
        time: Number(n.time) || seenAt.get(n.id) || Date.now(),
        read: readIds.has(n.id)
    })).sort((a, b) => (a.read - b.read) || (b.time - a.time));

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

// 35-vazifa: bildirishnomalar ro'yxati endi ikki joyda ko'rinadi - header
// qo'ng'iroq oynasida (#notifList) va Sozlamalar > Bildirishnomalar
// sahifasida (#settingsNotifList) - shu sabab ro'yxat qurish alohida
// funksiyaga chiqarildi va har ikkala konteyner uchun ham chaqiriladi.
function renderNotificationPanel() {
    const list = syncNotifications();
    const badge = document.getElementById('notifBadge');
    const unread = list.filter(n => !n.read).length;

    if (badge) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
    }

    renderNotifListInto('notifList', list);
    renderNotifListInto('settingsNotifList', list);
}

function notifDayLabel(ts) {
    const key = notifTashkentDay(new Date(ts));
    const today = notifTashkentDay();
    const yesterday = notifTashkentDay(new Date(Date.now() - 86400000));
    if (key === today) return 'Bugun';
    if (key === yesterday) return 'Kecha';
    return 'Oldinroq';
}

function renderNotifListInto(targetId, list) {
    const body = document.getElementById(targetId);
    if (!body) return;

    if (!list.length) {
        body.innerHTML = '<div class="notif-empty">Hozircha yangi bildirishnoma yoʻq 👍</div>';
        return;
    }

    let lastGroup = null;
    body.innerHTML = list.map(n => {
        const group = n.read ? "O'qilgan" : notifDayLabel(n.time);
        const head = group !== lastGroup ? `<div class="notif-group">${notifEsc(group)}</div>` : '';
        lastGroup = group;
        return `${head}
        <button type="button" class="notif-item notif-item--${notifEsc(n.type || 'info')} ${n.read ? 'read' : ''}" data-notif-id="${notifEsc(n.id)}" data-notif-tab="${notifEsc(n.tab || '')}">
            <div class="notif-icon notif-${notifEsc(n.type)}">${notifIcon(n.type)}</div>
            <div class="notif-content">
                <strong>${notifEsc(n.title)}</strong>
                <p>${notifEsc(n.message)}</p>
                <span class="notif-time">${formatNotifTime(n.time)}</span>
            </div>
            ${!n.read ? '<span class="notif-dot"></span>' : ''}
        </button>`;
    }).join('');

    body.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => {
            const notif = list.find(x => x.id === item.dataset.notifId);
            markNotificationRead(item.dataset.notifId);
            const tab = item.dataset.notifTab;
            if (tab && typeof switchTab === 'function') {
                let ctx = {};
                if (tab === 'sales') ctx = { salesSection: notif?.section || 'leads' };
                else if (tab === 'teachers-section') ctx = { teachersSection: 'attendance' };
                if (notif?.debtQuick && typeof _debtorsQuick !== 'undefined') _debtorsQuick = notif.debtQuick;
                switchTab(tab, ctx);
                if (notif?.section && typeof switchSalesSection === 'function') switchSalesSection(notif.section);
                closeNotificationPanel();
                if (notif?.leadId && typeof openLeadNotifyModal === 'function') {
                    window.setTimeout(() => openLeadNotifyModal(notif.leadLang, notif.leadId), 0);
                }
            }
        });
    });
}

// Lid ismi tashqi formalardan keladi — HTML sifatida emas, matn sifatida chiqariladi.
function notifEsc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function notifIcon(type) {
    const icons = { warning: '⏰', info: '📅', success: '✅', danger: '❗' };
    return icons[type] || '🔔';
}

function formatNotifTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 0) return new Date(ts).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
    if (diff < 60000) return 'Hozirgina';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' daq oldin';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' soat oldin';
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
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

    const settingsMarkAll = document.getElementById('settingsNotifMarkAll');
    if (settingsMarkAll) settingsMarkAll.addEventListener('click', () => markAllNotificationsRead());

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
